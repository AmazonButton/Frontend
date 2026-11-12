import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { normalizeOrder, mergeOrderUpdate } from '../src/services/order-events.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/store/StoreDashboard.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('StoreDashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['handleUpdateStatus', 'fetchOrders'].includes(node.name.getText(ast))) callbacks[node.name.getText(ast)] = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const evaluate = (callback, context) => vm.runInNewContext(ts.transpileModule(`(() => { const callback = ${callback}; return callback; })();`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const original = { id: '1', orderNumber: 'WEB-1', storeId: '9', status: 'PENDING', orderStatus: 'PENDING', paymentStatus: 'UNPAID', paymentMethod: 'PAYOS', customerName: 'Test Recipient', customerPhone: '0900000000', deliveryAddress: 'Test destination', items: [] };
function harness(initial = [original]) {
  const state = { orders: initial.map(normalizeOrder), pending: {}, patches: [], posts: [], reads: [], events: [], success: [], errors: [], deliveryResult: null };
  const context = {
    latestOrdersRef: { get current() { return state.orders; } },
    statusUpdatesRef: { current: new Map() }, orderListRevision: { current: 0 }, normalizeOrder, mergeOrderUpdate,
    setOrders: update => { state.orders = typeof update === 'function' ? update(state.orders) : update; },
    setPendingStatusUpdates: update => { state.pending = typeof update === 'function' ? update(state.pending) : update; },
    setDeliveryResult: order => { state.deliveryResult = order; },
    setNewOrderAlert: update => typeof update === 'function' && update(null), setChartData() {}, setLoading() {}, buildChartDataFromOrders: () => [],
    setOrdersReady: value => { state.ready = value; },
    setOrdersError: value => { state.readError = value; },
    toast: { success: message => state.success.push(message), error: message => state.errors.push(message) },
    publishOrderEvent: (type, payload) => state.events.push({ type, payload }),
    api: {
      patch(path, data) { const job = deferred(); state.patches.push({ path, data, ...job }); return job.promise; },
      post(path, data) { const job = deferred(); state.posts.push({ path, data, ...job }); return job.promise; },
      get() { const job = deferred(); state.reads.push(job); return job.promise; },
    },
  };
  const driverModule = { exports: {} };
  const driverCode = ts.transpileModule(readFileSync(new URL('../src/services/drivers.service.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(driverCode, { exports: driverModule.exports, window: {}, require(name) {
    if (name === './api') return { api: context.api };
    if (name === './order-events') return { normalizeOrder, publishOrderEvent: context.publishOrderEvent };
    if (name === './driver-workflow') return require('../src/services/driver-workflow.ts');
    throw new Error(`Unexpected driver import ${name}`);
  } });
  context.driversService = driverModule.exports.driversService;
  Object.defineProperty(context, 'orders', { get: () => state.orders });
  context.fetchOrders = evaluate(callbacks.fetchOrders, context);
  return { state, context, update: evaluate(callbacks.handleUpdateStatus, context), fetch: context.fetchOrders };
}
const accepted = (status, extra = {}) => ({ data: { success: true, data: { id: '1', orderStatus: status, ...extra } } });

test('a failed dashboard read preserves the last orders and reports that they could not be refreshed', async () => {
  const app = harness(); const previous = app.state.orders; const job = app.fetch();
  app.state.reads[0].reject(new Error('Network unavailable')); await job;
  assert.equal(app.state.orders, previous); assert.equal(app.state.ready, undefined);
  assert.match(app.state.readError, /Chưa cập nhật/);
});

test('an invalid dashboard response cannot become a successful empty list', async () => {
  const app = harness(); const job = app.fetch();
  app.state.reads[0].resolve({ data: { success: false, data: [] } }); await job;
  assert.equal(app.state.orders.length, 1); assert.equal(app.state.ready, undefined);
  assert.match(app.state.readError, /Chưa cập nhật/);
});

test('accepting an order immediately updates both aliases so the next button appears before the API resolves', async () => {
  const app = harness(); const job = app.update('1', 'CONFIRMED');
  assert.equal(app.state.orders[0].status, 'CONFIRMED');
  assert.equal(app.state.orders[0].orderStatus, 'CONFIRMED');
  assert.equal(app.state.pending['1'], 'CONFIRMED');
  assert.equal(app.state.events.length, 0); assert.equal(app.state.success.length, 0);
  assert.equal(app.state.patches[0].path, '/orders/1/status');
  assert.equal(app.state.patches[0].data.status, 'CONFIRMED');
  app.state.patches[0].resolve(accepted('CONFIRMED')); await job;
  assert.equal(app.state.pending['1'], undefined);
  assert.equal(app.state.events.length, 1); assert.equal(app.state.success.length, 1);
});

test('each operating step updates immediately while preserving recipient/payment details', async () => {
  for (const [from, next] of [['CONFIRMED', 'PREPARING'], ['PREPARING', 'READY_FOR_DELIVERY']]) {
    const app = harness([{ ...original, status: from, orderStatus: from }]);
    const job = app.update('1', next);
    assert.equal(app.state.orders[0].orderStatus, next);
    assert.equal(app.state.orders[0].customerPhone, original.customerPhone);
    assert.equal(app.state.orders[0].paymentStatus, 'UNPAID');
    app.state.patches[0].resolve(accepted(next)); await job;
  }
});

test('start delivery uses POST claim, waits for server confirmation and publishes once', async () => {
  const app = harness([{ ...original, status: 'READY_FOR_DELIVERY', orderStatus: 'READY_FOR_DELIVERY' }]);
  const first = app.update('1', 'SHIPPING');
  await app.update('1', 'SHIPPING');
  assert.equal(app.state.orders[0].orderStatus, 'READY_FOR_DELIVERY');
  assert.equal(app.state.pending['1'], 'SHIPPING');
  assert.equal(app.state.patches.length, 0);
  assert.equal(app.state.posts.length, 1);
  assert.equal(app.state.posts[0].path, '/orders/1/claim');
  assert.equal(app.state.posts[0].data, undefined);
  assert.equal(app.state.success.length, 0); assert.equal(app.state.events.length, 0);
  app.state.posts[0].resolve(accepted('SHIPPING', { assignedDriverId: '7' })); await first;
  assert.equal(app.state.orders[0].status, 'SHIPPING');
  assert.equal(app.state.orders[0].assignedDriverId, '7');
  assert.equal(app.state.orders[0].customerPhone, original.customerPhone);
  assert.equal(app.state.pending['1'], undefined);
  assert.equal(app.state.success.length, 1); assert.equal(app.state.events.length, 1);
});

test('claim failure or timeout preserves ready status, reports real error and never falls back to PATCH', async () => {
  for (const error of [new Error('timeout'), { response: { status: 409, data: { message: 'Đơn hàng đã được tài xế khác nhận' } } }, { response: { status: 403, data: { message: 'Không có quyền nhận giao' } } }]) {
    const app = harness([{ ...original, status: 'READY_FOR_DELIVERY', orderStatus: 'READY_FOR_DELIVERY' }]);
    const job = app.update('1', 'SHIPPING'); app.state.posts[0].reject(error); await job;
    assert.equal(app.state.orders[0].status, 'READY_FOR_DELIVERY');
    assert.equal(app.state.events.length, 0); assert.equal(app.state.success.length, 0);
    assert.equal(app.state.errors.length, 1); assert.equal(app.state.reads.length, 1);
    assert.equal(app.state.posts.length, 1); assert.equal(app.state.patches.length, 0);
  }
});

test('claim cannot accept a different order or stale status and cannot announce success after leaving', async () => {
  for (const response of [accepted('SHIPPING', { id: '2' }), accepted('READY_FOR_DELIVERY')]) {
    const app = harness([{ ...original, status: 'READY_FOR_DELIVERY', orderStatus: 'READY_FOR_DELIVERY' }]);
    const job = app.update('1', 'SHIPPING'); app.state.posts[0].resolve(response); await job;
    assert.equal(app.state.success.length, 0); assert.equal(app.state.events.length, 0);
    assert.equal(app.state.orders[0].status, 'READY_FOR_DELIVERY');
  }
  const app = harness([{ ...original, status: 'READY_FOR_DELIVERY', orderStatus: 'READY_FOR_DELIVERY' }]);
  const job = app.update('1', 'SHIPPING'); app.context.statusUpdatesRef.current.clear(); app.state.orders = [];
  app.state.posts[0].resolve(accepted('SHIPPING')); await job;
  assert.equal(app.state.events.length, 0); assert.equal(app.state.success.length, 0);
});

test('delivered opens the shared POD form without changing status, money or calling generic PATCH', async () => {
  const app = harness([{ ...original, status: 'SHIPPING', orderStatus: 'SHIPPING', assignedDriverId: '7' }]);
  await app.update('1', 'DELIVERED');
  assert.equal(app.state.deliveryResult.id, '1');
  assert.equal(app.state.orders[0].orderStatus, 'SHIPPING');
  assert.equal(app.state.orders[0].paymentStatus, 'UNPAID');
  assert.equal(app.state.patches.length + app.state.posts.length, 0);
  assert.equal(app.state.success.length + app.state.events.length, 0);
});

test('double clicks or clicking the next step cannot submit overlapping transitions for the same order', async () => {
  const app = harness(); const first = app.update('1', 'CONFIRMED');
  await app.update('1', 'CONFIRMED'); await app.update('1', 'PREPARING');
  assert.equal(app.state.patches.length, 1);
  app.state.patches[0].resolve(accepted('CONFIRMED')); await first;
  const next = app.update('1', 'PREPARING'); assert.equal(app.state.patches.length, 2);
  app.state.patches[1].resolve(accepted('PREPARING')); await next;
});

test('different orders can be processed independently', async () => {
  const app = harness([original, { ...original, id: '2' }]);
  const first = app.update('1', 'CONFIRMED'), second = app.update('2', 'CONFIRMED');
  assert.equal(app.state.patches.length, 2);
  app.state.patches[0].resolve(accepted('CONFIRMED'));
  app.state.patches[1].resolve({ data: { success: true, data: { id: '2', status: 'CONFIRMED' } } });
  await Promise.all([first, second]); assert.equal(Object.keys(app.state.pending).length, 0);
});

test('server rejection rolls back instantly without erasing newer payment or address data', async () => {
  const app = harness(); const job = app.update('1', 'CONFIRMED');
  app.state.orders[0] = { ...app.state.orders[0], paymentStatus: 'PAID', deliveryAddress: 'Updated destination' };
  app.state.patches[0].reject({ response: { data: { message: 'Transition rejected' } } }); await job;
  assert.equal(app.state.orders[0].orderStatus, 'PENDING'); assert.equal(app.state.orders[0].status, 'PENDING');
  assert.equal(app.state.orders[0].paymentStatus, 'PAID'); assert.equal(app.state.orders[0].deliveryAddress, 'Updated destination');
  assert.equal(app.state.events.length, 0); assert.equal(app.state.success.length, 0); assert.equal(app.state.errors[0], 'Transition rejected');
  assert.equal(app.state.reads.length, 1); assert.equal(app.state.pending['1'], undefined);
});

test('an HTTP 200 with success:false is treated as a rejection and rolled back', async () => {
  const app = harness(); const job = app.update('1', 'CONFIRMED');
  app.state.patches[0].resolve({ data: { success: false, message: 'Rejected' } }); await job;
  assert.equal(app.state.orders[0].status, 'PENDING'); assert.equal(app.state.errors[0], 'Rejected');
  assert.equal(app.state.events.length, 0);
});

test('a list refresh that started before the click cannot restore the previous status', async () => {
  const app = harness(); const list = app.fetch(); const job = app.update('1', 'CONFIRMED');
  app.state.reads[0].resolve({ data: { success: true, data: [original] } }); await list;
  assert.equal(app.state.orders[0].orderStatus, 'CONFIRMED');
  app.state.patches[0].resolve(accepted('CONFIRMED')); await job;
});

test('refreshes during a transition preserve the displayed next step; late refreshes cannot revert a committed transition', async () => {
  const app = harness(); const job = app.update('1', 'CONFIRMED'); const list = app.fetch();
  app.state.reads[0].resolve({ data: { success: true, data: [original] } }); await list;
  assert.equal(app.state.orders[0].orderStatus, 'CONFIRMED');
  const late = app.fetch(); app.state.patches[0].resolve(accepted('PREPARING')); await job;
  app.state.reads[1].resolve({ data: { success: true, data: [original] } }); await late;
  assert.equal(app.state.orders[0].orderStatus, 'PREPARING');
});

test('completion does not display completed status, publish success or claim wallet settlement before confirmation', async () => {
  const app = harness([{ ...original, status: 'DELIVERED', orderStatus: 'DELIVERED' }]);
  const job = app.update('1', 'COMPLETED');
  assert.equal(app.state.orders[0].orderStatus, 'DELIVERED');
  assert.equal(app.state.events.length, 0); assert.equal(app.state.success.length, 0);
  app.state.patches[0].resolve(accepted('COMPLETED', { paymentStatus: 'PAID' })); await job;
  assert.equal(app.state.orders[0].orderStatus, 'COMPLETED'); assert.equal(app.state.success.length, 1);
});

test('a partial success response preserves newly received payment information in the published event', async () => {
  const app = harness(); const job = app.update('1', 'CONFIRMED');
  app.state.orders[0] = { ...app.state.orders[0], paymentStatus: 'PAID' };
  app.state.patches[0].resolve(accepted('CONFIRMED')); await job;
  assert.equal(app.state.orders[0].paymentStatus, 'PAID');
  assert.equal(app.state.events[0].payload.order.paymentStatus, 'PAID');
});

test('a response after leaving the store session cannot mutate orders or publish a success event', async () => {
  const app = harness(); const job = app.update('1', 'CONFIRMED');
  app.context.statusUpdatesRef.current.clear(); ++app.context.orderListRevision.current;
  app.state.orders = [];
  app.state.patches[0].resolve(accepted('CONFIRMED')); await job;
  assert.equal(app.state.orders.length, 0); assert.equal(app.state.events.length, 0);
});
