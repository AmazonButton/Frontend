import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const evaluate = (source, context) => vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

for (const prefix of ['../src/', '../frontend/src/']) {
  const metrics = await import(new URL(`${prefix}services/dashboard-metrics.ts`, import.meta.url));
  const { metricNumber, formatMetric, adminDashboardMetrics, orderDashboardMetrics, dashboardOrderStatus, deviceDashboardMetrics, filterDashboardOrders, dashboardOrderSeries, readAdminDashboard } = metrics;

  test(`${prefix}admin cards read the backend DTO, including numeric strings and zero`, () => {
    const actual = adminDashboardMetrics({ totalStores: 34, activeButtons: '21', totalButtons: 47, totalOrders: 144, totalGmv: '0' }, [{ id: 1 }, { id: 2 }]);
    assert.deepEqual(actual, { totalStores: 34, activeDevices: 21, totalDevices: 47, totalOrders: 144, confirmedOrderValue: 0, pendingStores: 2 });
    for (const value of [null, undefined, '', ' ', NaN, Infinity, false, {}, 'missing']) {
      assert.equal(metricNumber(value), null);
      assert.equal(formatMetric(value), '—');
    }
    assert.equal(metricNumber('0'), 0);
    assert.match(formatMetric(0, true), /0.*₫/);
    assert.equal(adminDashboardMetrics({}).activeDevices, null);
    assert.equal(adminDashboardMetrics({}).confirmedOrderValue, null);
    assert.equal(adminDashboardMetrics({}, []).pendingStores, 0);
  });

  test(`${prefix}order summaries count every backend state without mutating operational statuses`, () => {
    const orders = [
      { status: 'PENDING', totalAmount: '100' }, { status: 'READY_FOR_DELIVERY', totalAmount: '200' },
      { status: 'DELIVERED', totalAmount: '300' }, { orderStatus: 'COMPLETED', totalAmount: '400' },
      { status: 'CANCELLED', totalAmount: '900' }, { status: 'REJECTED', totalAmount: '900' },
    ];
    const summary = orderDashboardMetrics(orders);
    assert.equal(summary.total, 6); assert.equal(summary.active, 2); assert.equal(summary.completed, 2);
    assert.equal(summary.cancelled, 2); assert.equal(summary.provisionalSales, 1000); assert.equal(summary.averageOrderValue, 250);
    assert.equal(orders[2].status, 'DELIVERED');
    assert.equal(dashboardOrderStatus({ status: 'DELIVERED' }), 'COMPLETED');
    assert.equal(orderDashboardMetrics([]).completionRate, 0);
    assert.equal(orderDashboardMetrics([{ status: 'PENDING' }]).provisionalSales, null);
  });

  test(`${prefix}device cards use measured batteries and configured products without guessed defaults`, () => {
    const result = deviceDashboardMetrics([
      { status: 'ACTIVE', batteryLevel: 0, productId: 1 },
      { status: 'DISABLED', batteryLevel: '10', buttonProducts: [{ productId: 2 }] },
      { status: 'UNASSIGNED', batteryLevel: null },
      { status: 'MAINTENANCE', batteryLevel: 150 },
    ]);
    assert.equal(result.total, 4); assert.equal(result.active, 1); assert.equal(result.lowBattery, 2);
    assert.equal(result.batteryReadings, 2); assert.equal(result.averageBattery, 5); assert.equal(result.unconfigured, 2);
    assert.equal(deviceDashboardMetrics([{ status: 'ACTIVE' }]).averageBattery, null);
  });

  test(`${prefix}period filters and daily charts use actual dates and never insert sample sales`, () => {
    const now = Date.parse('2026-11-07T12:00:00Z');
    const orders = [
      { createdAt: '2026-11-06T12:00:00Z', totalAmount: '120', status: 'DELIVERED' },
      { createdAt: '2026-11-06T12:01:00Z', totalAmount: '880', status: 'CANCELLED' },
      { createdAt: '2025-11-06T12:00:00Z', totalAmount: '50', status: 'PENDING' },
      { createdAt: '2026-11-08T12:00:00Z', totalAmount: '30' }, { createdAt: 'bad-date' },
    ];
    assert.equal(filterDashboardOrders(orders, '7D', now).length, 2);
    assert.equal(filterDashboardOrders(orders, '30D', now).length, 2);
    assert.equal(filterDashboardOrders(orders, 'ALL', now).length, 5);
    const series = dashboardOrderSeries(orders.slice(0, 3));
    assert.equal(series.length, 2); assert.equal(series[1].orders, 2); assert.equal(series[1].revenue, 120);
    assert.deepEqual(dashboardOrderSeries([]), []);
  });

  test(`${prefix}admin stats appear before slow unrelated APIs, and failures preserve other results`, async () => {
    const slow = deferred(); const values = new Map(); const errors = [];
    const work = readAdminDashboard({ get: async path => {
      if (path === '/admin/users') return slow.promise;
      if (path === '/admin/plans') throw new Error('403');
      return { data: { success: true, data: path === '/admin/stats' ? { activeButtons: 12 } : [] } };
    } }, (index, value) => values.set(index, value), index => errors.push(index));
    await new Promise(done => setImmediate(done));
    assert.equal(values.get(1).activeButtons, 12);
    assert.equal(values.has(5), false); assert.deepEqual(errors, [6]);
    slow.resolve({ data: { success: false, data: [] } }); await work;
    assert.deepEqual(errors, [6, 5]); assert.equal(values.get(1).activeButtons, 12);
  });

  const analyticsSource = readFileSync(new URL(`${prefix}pages/store/StoreAnalyticsPage.tsx`, import.meta.url), 'utf8');
  const analyticsAst = ts.createSourceFile('analytics.tsx', analyticsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(analyticsAst) === 'topProducts') callbacks.topProducts = node.initializer.arguments[0].getText(analyticsAst);
    ts.forEachChild(node, visit);
  }
  visit(analyticsAst);
  test(`${prefix}actual report aggregators stay empty without orders and add decimal strings numerically`, () => {
    const context = { filteredOrders: [], devices: [{ deviceId: 'BTN-1' }], products: [{ id: 'p1', name: 'Nước', price: 20000 }] };
    for (const callback of Object.values(callbacks)) assert.equal(evaluate(`(${callback})`, context)().length, 0);
    context.filteredOrders = [{ status: 'DELIVERED', deviceId: 'BTN-1', totalAmount: '200', items: [{ productId: 'p1', productName: 'Nước', quantity: '2', unitPrice: '100' }] }, { status: 'DELIVERED', deviceId: 'BTN-1', totalAmount: '300', items: [{ productId: 'p1', productName: 'Nước', quantity: '3', unitPrice: '100' }] }];
    assert.equal(evaluate(`(${callbacks.topProducts})`, context)()[0].revenue, 500);
    assert.equal(evaluate(`(${callbacks.topProducts})`, context)()[0].quantity, 5);
    assert.ok(!analyticsSource.includes('+16.8%'));
  });

  const admin = readFileSync(new URL(`${prefix}pages/admin/AdminDashboard.tsx`, import.meta.url), 'utf8');
  const adminAst = ts.createSourceFile('admin.tsx', admin, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fetchCallback;
  function findFetch(node) { if (ts.isVariableDeclaration(node) && node.name.getText(adminAst) === 'fetchAdminData') fetchCallback = node.initializer.getText(adminAst); ts.forEachChild(node, findFetch); }
  findFetch(adminAst);
  test(`${prefix}responses from a departed admin session cannot update dashboard cards`, async () => {
    const response = deferred(); let session = 'A'; const updates = [];
    const context = { adminRead: { current: 0 }, apiSessionMarker: () => session, api: { get: () => response.promise }, readAdminDashboard, toast: { error: () => {}, success: () => {}, warning: () => {} } };
    for (const name of ['PendingStores', 'PendingReady', 'Stats', 'AuditLogs', 'UnassignedDevices', 'AllStores', 'UsersList', 'SubscriptionPlans', 'StatsError', 'Loading']) context[`set${name}`] = value => updates.push(value);
    const work = evaluate(`(${fetchCallback})`, context)(); session = 'B';
    response.resolve({ data: { success: true, data: [] } }); await work;
    assert.equal(updates.length, 0);
  });
}
