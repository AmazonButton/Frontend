import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { mergeOrderUpdate, normalizeOrder, normalizeOrderEvent } from '../src/services/order-events.ts';
import { reconcileOrders } from '../src/services/order-reconciliation.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const original = { id: '601', storeId: '9', orderNumber: 'WEB-TEST-601', status: 'PENDING', paymentMethod: 'PAYOS', paymentStatus: 'UNPAID', customerName: 'Test Recipient', customerPhone: '0900000000', deliveryAddress: 'Test destination' };
const cod = { ...original, paymentMethod: 'COD' };

const dashboardSource = readFileSync(new URL('../src/pages/store/StoreDashboard.tsx', import.meta.url), 'utf8');
const dashboardAst = ts.createSourceFile('StoreDashboard.tsx', dashboardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let updateBody;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(dashboardAst) === 'handleOrderUpdated') updateBody = node.initializer.getText(dashboardAst);
  ts.forEachChild(node, visit);
};
visit(dashboardAst);

test('PayOS to COD is detected even when the order status does not change, and updates the actual store handler', () => {
  const initial = reconcileOrders(null, [original]);
  const changed = reconcileOrders(initial.snapshot, [cod]);
  assert.equal(changed.events.length, 1);
  assert.equal(changed.events[0].type, 'ORDER_PAYMENT_CHANGED');
  let orders = [normalizeOrder(original)];
  let refreshes = 0;
  const context = {
    storeId: '9', normalizeOrderEvent, mergeOrderUpdate,
    setOrders: (update) => { orders = update(orders); }, fetchOrders: () => { refreshes++; },
    setNewOrderAlert: (update) => update(null), handleOrderCancelled: () => assert.fail('Not a cancellation'),
  };
  assert.ok(updateBody);
  const handler = vm.runInNewContext(ts.transpileModule(`const callback = ${updateBody}; callback;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
  handler(changed.events[0].payload);
  assert.equal(orders[0].paymentMethod, 'COD');
  assert.equal(orders[0].paymentStatus, 'UNPAID');
  assert.equal(orders[0].customerPhone, original.customerPhone);
  assert.equal(orders[0].deliveryAddress, original.deliveryAddress);
  assert.equal(refreshes, 1);
  assert.equal(reconcileOrders(changed.snapshot, [cod]).events.length, 0);
});

test('Payment confirmation is detected without inventing a change to the order status', () => {
  const initial = reconcileOrders(null, [cod]);
  const changed = reconcileOrders(initial.snapshot, [{ ...cod, paymentStatus: 'PAID' }]);
  assert.equal(changed.events[0].type, 'ORDER_PAYMENT_CHANGED');
  assert.equal(changed.events[0].payload.order.status, 'PENDING');
  assert.equal(changed.events[0].payload.order.paymentStatus, 'PAID');
});

test('COD and CASH_ON_DELIVERY aliases do not generate duplicate payment changes', () => {
  const initial = reconcileOrders(null, [cod]);
  assert.equal(reconcileOrders(initial.snapshot, [{ ...cod, paymentMethod: 'CASH_ON_DELIVERY' }]).events.length, 0);
});

test('Older status-only session snapshots migrate without a false payment notification', () => {
  const upgraded = reconcileOrders(new Map([['601', 'PENDING']]), [cod]);
  assert.equal(upgraded.events.length, 0);
  assert.equal(reconcileOrders(upgraded.snapshot, [{ ...cod, paymentStatus: 'PAID' }]).events[0].type, 'ORDER_PAYMENT_CHANGED');
});

const serviceSource = readFileSync(new URL('../src/services/payments.service.ts', import.meta.url), 'utf8');
const serviceCode = ts.transpileModule(serviceSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function serviceHarness({ rejectChange = false, rejectRead = false, applicationError = false } = {}) {
  const requests = [];
  const events = [];
  const module = { exports: {} };
  const api = {
    post: async (path, payload) => {
      requests.push({ method: 'POST', path, payload });
      if (rejectChange) throw new Error('Test API 400');
      return { data: applicationError ? { success: false, message: 'Test rejection' } : { success: true } };
    },
    get: async (path) => {
      requests.push({ method: 'GET', path });
      if (rejectRead) throw new Error('Test temporary read failure');
      return { data: { data: cod } };
    },
  };
  vm.runInNewContext(serviceCode, {
    module, exports: module.exports,
    require: (name) => {
      if (name === './api') return { api };
      if (name === './order-events') return { normalizeOrder, publishOrderEvent: (type, payload) => events.push({ type, payload }) };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { service: module.exports.paymentsService, requests, events };
}

test('A successful change reads the authoritative order and publishes it to update the UI', async () => {
  const app = serviceHarness();
  await app.service.selectOrderPaymentMethod('601', 'CASH_ON_DELIVERY');
  assert.equal(app.requests[0].path, '/payments/orders/601/payment-method');
  assert.equal(app.requests[0].payload.paymentMethod, 'COD');
  assert.equal(app.requests[1].path, '/orders/601');
  assert.equal(app.events[0].type, 'ORDER_PAYMENT_CHANGED');
  assert.equal(app.events[0].payload.order.paymentMethod, 'COD');
  assert.equal(app.events[0].payload.order.paymentStatus, 'UNPAID');
});

test('A rejected change never publishes a fake COD update or reports success', async () => {
  for (const options of [{ rejectChange: true }, { applicationError: true }]) {
    const app = serviceHarness(options);
    await assert.rejects(app.service.selectOrderPaymentMethod('601', 'COD'));
    assert.equal(app.requests.length, 1);
    assert.equal(app.events.length, 0);
  }
});

test('A failed follow-up read does not turn a committed change into a false failure', async () => {
  const app = serviceHarness({ rejectRead: true });
  const result = await app.service.selectOrderPaymentMethod('601', 'COD');
  assert.equal(result.success, true);
  assert.equal(app.events.length, 0);
});
