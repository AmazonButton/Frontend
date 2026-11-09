import { readAdminDashboard } from '../src/services/dashboard-metrics.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const ts = createRequire(import.meta.url)('typescript');
function evaluate(expression, context) {
  const code = ts.transpileModule(`(${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return vm.runInNewContext(code, context);
}

for (const prefix of ['../src/', '../../src/']) {
  const source = readFileSync(new URL(`${prefix}pages/admin/AdminDashboard.tsx`, import.meta.url), 'utf8');
  const ast = ts.createSourceFile('AdminDashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fetchCallback, initialTab, sectionEffect;
  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      if (node.name.getText(ast) === 'fetchAdminData') fetchCallback = node.initializer.getText(ast);
      if (node.name.getText(ast) === '[activeTab, setActiveTab]') initialTab = node.initializer.arguments[0].getText(ast);
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[1]?.getText(ast) === '[searchParams]') sectionEffect = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(fetchCallback && initialTab && sectionEffect);

  test(`${prefix}admin refresh still maps all retained resources and stops requesting Security Hub`, async () => {
    const data = {
      '/admin/stores/pending': [{ id: 'pending-store' }],
      '/admin/stats': { totalStores: 7 },
      '/admin/audit-logs': Array.from({ length: 8 }, (_, index) => ({ id: `audit-${index}` })),
      '/devices/unassigned': [{ deviceId: 'unassigned-device' }],
      '/admin/stores': [{ id: 'active-store' }],
      '/admin/users': [{ userId: 'kept-user', status: 'ACTIVE' }],
      '/admin/plans': [{ planId: 'kept-plan', isActive: true }],
    };
    const calls = [], state = {}, errors = [];
    const context = {
      api: { get: async path => {
        calls.push(path);
        assert.ok(Object.hasOwn(data, path), `Unexpected request: ${path}`);
        return { data: { success: true, data: data[path] } };
      } },
      adminRead: { current: 0 }, apiSessionMarker: () => 'admin-session', readAdminDashboard, toast: { error: message => errors.push(message) },
    };
    for (const key of ['PendingStores', 'Stats', 'AuditLogs', 'UnassignedDevices', 'AllStores', 'UsersList', 'SubscriptionPlans', 'Loading', 'PendingReady', 'StatsError']) context[`set${key}`] = value => { state[key] = value; };
    await evaluate(fetchCallback, context)();
    assert.deepEqual(calls.sort(), Object.keys(data).sort());
    assert.equal(state.PendingStores, data['/admin/stores/pending']);
    assert.equal(state.Stats, data['/admin/stats']);
    assert.deepEqual(Array.from(state.AuditLogs), data['/admin/audit-logs']);
    assert.equal(state.UnassignedDevices, data['/devices/unassigned']);
    assert.equal(state.AllStores, data['/admin/stores']);
    assert.equal(state.UsersList[0].id, 'kept-user');
    assert.equal(state.UsersList[0].isActive, true);
    assert.equal(state.SubscriptionPlans, data['/admin/plans']);
    assert.equal(state.Loading, false);
    assert.deepEqual(errors, []);
  });

  test(`${prefix}removed and invalid section links show Overview while retained sections still work`, () => {
    for (const section of [null, 'SECURITY', 'UNKNOWN', 'OVERVIEW', 'STORES', 'PLANS', 'RENTALS', 'CATALOG', 'DEVICES', 'RBAC', 'TELEMETRY', 'ANALYTICS', 'NOTIFICATIONS']) {
      let active = 'DEVICES';
      const replacements = [];
      const context = { searchParams: new URLSearchParams(section ? { section } : {}), setActiveTab: value => { active = value; }, setSearchParams: (params, options) => replacements.push({ params, options }) };
      const expected = !section || ['SECURITY', 'UNKNOWN'].includes(section) ? 'OVERVIEW' : section;
      assert.equal(evaluate(initialTab, context)(), expected);
      evaluate(sectionEffect, context)();
      assert.equal(active, expected);
    }
  });
}
