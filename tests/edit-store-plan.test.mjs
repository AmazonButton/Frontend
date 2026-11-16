import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
function harness(prefix, overrides = {}) {
  const source = readFileSync(new URL(prefix + 'components/admin/EditStorePlanModal.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('modal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'submit') expression = node.initializer.getText(ast); ts.forEachChild(node, visit); }; visit(ast);
  const calls = [], saved = [], errors = [];
  const context = { form: { planName: ' Updated ', description: '', price: '2000', durationDays: '90', maxProducts: '100' }, plan: { planId: '44', planCode: 'FIXED', isActive: false }, pending: { current: false }, alive: { current: true }, apiSessionMarker: () => 'A', setSaving() {}, setError: error => errors.push(error), onSaved: payload => saved.push(payload), api: { put: async (path, payload) => { calls.push({ path, payload }); return { data: { success: true } }; } }, ...overrides };
  const submit = vm.runInNewContext(ts.transpileModule(`(${expression})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return { context, calls, saved, errors, submit: () => submit({ preventDefault() {} }) };
}
for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}edit saves only supported fields and blocks duplicate submissions`, async () => {
    const app = harness(prefix); await Promise.all([app.submit(), app.submit()]);
    assert.equal(app.calls.length, 1); assert.equal(app.saved.length, 1);
    assert.equal(app.calls[0].path, '/admin/plans/44');
    assert.deepEqual(JSON.parse(JSON.stringify(app.calls[0].payload)), { planName: 'Updated', description: '', price: 2000, durationDays: 90, maxProducts: 100 });
  });
  test(`${prefix}invalid prices and durations never reach API; failures keep the editor open`, async () => {
    for (const patch of [{ price: '' }, { price: '-1' }, { price: 'NaN' }, { durationDays: '0' }, { maxProducts: '1.5' }, { planName: ' ' }]) {
      const app = harness(prefix); Object.assign(app.context.form, patch); await app.submit();
      assert.equal(app.calls.length, 0); assert.ok(app.errors.at(-1));
    }
    const app = harness(prefix, { api: { put: async () => { throw { response: { data: { message: 'Server rejected update' } } }; } } });
    await app.submit(); assert.equal(app.saved.length, 0); assert.equal(app.errors.at(-1), 'Server rejected update'); assert.equal(app.context.pending.current, false);
  });
}
