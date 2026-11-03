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
  const state = { orders: initial.map(normalizeOrder), pending: {}, patches: [], reads: [], events: [], success: [], errors: [] };
  const context = {
    latestOrdersRef: { get current() { return state.orders; } },
    statusUpdatesRef: { current: new Map() }, orderListRevision: { current: 0 }, normalizeOrder, mergeOrderUpdate,
    setOrders: update => { state.orders = typeof update === 'function' ? update(state.orders) : update; },
    setPendingStatusUpdates: update => { state.pending = typeof update === 'function' ? update(state.pending) : update; },
    setNewOrderAlert: update => typeof update === 'function' && update(null), setChartData() {}, setLoading() {}, buildChartDataFromOrders: () => [],
    toast: { success: message => state.success.push(message), error: message => state.errors.push(message) },
    publishOrderEvent: (type, payload) => state.events.push({ type, payload }),
    api: {
      patch(path, data) { const job = deferred(); state.patches.push({ path, data, ...job }); return job.promise; },
      get() { const job = deferred(); state.reads.push(job); return job.promise; },
    },
  };
  Object.defineProperty(context, 'orders', { get: () => state.orders });
  context.fetchOrders = evaluate(callbacks.fetchOrders, context);
  return { state, context, update: evaluate(callbacks.handleUpdateStatus, context), fetch: context.fetchOrders };
}
const accepted = (status, extra = {}) => ({ data: { success: true, data: { id: '1', orderStatus: status, ...extra } } });

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
  for (const [from, next] of [['CONFIRMED', 'PREPARING'], ['PREPARING', 'READY_FOR_DELIVERY'], ['READY_FOR_DELIVERY', 'SHIPPING'], ['SHIPPING', 'DELIVERED']]) {
    const app = harness([{ ...original, status: from, orderStatus: from }]);
    const job = app.update('1', next);
    assert.equal(app.state.orders[0].orderStatus, next);
    assert.equal(app.state.orders[0].customerPhone, original.customerPhone);
    assert.equal(app.state.orders[0].paymentStatus, 'UNPAID');
    app.state.patches[0].resolve(accepted(next)); await job;
  }
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
