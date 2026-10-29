import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { normalizeOrder, normalizeOrderEvent, ORDER_EVENT, orderEventKey } from '../src/services/order-events.ts';
import { getUserStoreId, reconcileOrders } from '../src/services/order-reconciliation.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/common/NotificationBellPopover.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('NotificationBellPopover.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effectBody;
let acceptBody;
const visit = (node) => {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('const handleStoreOrderCancelled')) effectBody = node.arguments[0].getText(ast);
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'acceptOrderEvent') acceptBody = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(effectBody && acceptBody, 'Exercise the actual notification effect and deduplication callback');
const evaluate = (code, context) => vm.runInNewContext(ts.transpileModule(`(() => { const callback = ${code}; return callback; })();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);

function harness(user = { id: '10', role: 'STORE_OWNER', storeId: '9' }) {
  const socket = new EventEmitter();
  const local = new EventEmitter();
  const state = { notifications: [], toasts: [], chimes: 0, subscriptions: [] };
  const context = {
    user, storeId: getUserStoreId(user), isStore: true, isCustomer: false, isAdmin: false,
    getSocket: () => socket, subscribeToStore: (id) => state.subscriptions.push(id),
    normalizeOrder, normalizeOrderEvent, orderEventKey, ORDER_EVENT,
    seenOrderEvents: { current: new Set() },
    setNotifications: (update) => { state.notifications = update(state.notifications); },
    playCancelChime: () => { state.chimes++; }, playOrderChime() {}, announceStoreOrder() {},
    toast: { info: (message) => state.toasts.push(message), success() {}, warning() {} },
    window: { addEventListener: (name, callback) => local.on(name, callback), removeEventListener: (name, callback) => local.off(name, callback) },
  };
  context.acceptOrderEvent = evaluate(acceptBody, context);
  const cleanup = evaluate(effectBody, context)();
  return { state, socket, local, cleanup };
}
const cancelledOrder = { id: '601', orderNumber: 'WEB-TEST-601', storeId: '9', status: 'CANCELLED', customerName: 'Test Recipient', customerPhone: '0900000000', deliveryAddress: 'Test destination', totalAmount: 2000 };

test('A customer cancellation creates an unread store notification, toast and chime', () => {
  const app = harness();
  app.socket.emit('ORDER_CANCELLED', { order: cancelledOrder, reason: 'Customer cancelled' });
  assert.equal(app.state.notifications.length, 1);
  assert.equal(app.state.notifications[0].type, 'ORDER_CANCELLED');
  assert.equal(app.state.notifications[0].isRead, false);
  assert.equal(app.state.notifications[0].orderNumber, 'WEB-TEST-601');
  assert.equal(app.state.notifications[0].customerPhone, '0900000000');
  assert.ok(app.state.toasts[0].includes('Customer cancelled'));
  assert.equal(app.state.chimes, 1);
  app.cleanup();
});

test('An owner without top-level storeId still receives their authorized cancellation event', () => {
  for (const user of [{ id: '10', role: 'STORE_OWNER' }, { id: '10', role: 'STORE_OWNER', store: { storeId: '9' } }, { id: '10', role: 'STORE_MANAGER', store: { id: '9' } }]) {
    const app = harness(user);
    app.socket.emit('ORDER_CANCELLED', { order: cancelledOrder });
    assert.equal(app.state.notifications.length, 1);
    app.cleanup();
  }
});

test('Known store scope rejects another store and listener cleanup prevents future alerts', () => {
  const app = harness();
  app.socket.emit('ORDER_CANCELLED', { order: { ...cancelledOrder, storeId: '999' } });
  assert.equal(app.state.notifications.length, 0);
  app.cleanup();
  app.socket.emit('ORDER_CANCELLED', { order: cancelledOrder });
  assert.equal(app.state.notifications.length, 0);
});

test('Status, cancellation, alias and API-recovery events for the same cancellation notify only once', () => {
  const app = harness();
  app.socket.emit('ORDER_STATUS_CHANGED', { order: cancelledOrder });
  app.socket.emit('ORDER_CANCELLED', { order: cancelledOrder });
  app.socket.emit('order:cancelled', { order: cancelledOrder });
  app.local.emit(ORDER_EVENT, { detail: { type: 'ORDER_CANCELLED', payload: { order: cancelledOrder } } });
  assert.equal(app.state.notifications.length, 1);
  assert.equal(app.state.toasts.length, 1);
  assert.equal(app.state.chimes, 1);
  app.cleanup();
});

test('An order-list update produces the store alert when the socket event is missed', () => {
  const app = harness();
  const baseline = reconcileOrders(null, [{ ...cancelledOrder, status: 'PENDING' }]);
  assert.equal(baseline.events.length, 0);
  const changed = reconcileOrders(baseline.snapshot, [cancelledOrder]);
  changed.events.forEach((detail) => app.local.emit(ORDER_EVENT, { detail }));
  assert.equal(app.state.notifications[0].type, 'ORDER_CANCELLED');
  assert.equal(app.state.notifications[0].orderId, '601');
  assert.equal(reconcileOrders(changed.snapshot, [cancelledOrder]).events.length, 0);
  app.cleanup();
});

test('A history entry arriving first is replaced with one unread cancellation rather than hiding the alert', () => {
  const app = harness();
  app.state.notifications.push({ id: orderEventKey('ORDER_CANCELLED', cancelledOrder), isRead: true, type: 'ORDER_CANCELLED' });
  app.socket.emit('ORDER_CANCELLED', { order: cancelledOrder });
  assert.equal(app.state.notifications.length, 1);
  assert.equal(app.state.notifications[0].isRead, false);
  assert.equal(app.state.toasts.length, 1);
  app.cleanup();
});

test('The saved status snapshot recovers a cancellation after a token refresh or page reload', () => {
  const saved = JSON.stringify([...new Map([['601', 'PENDING']])]);
  const changed = reconcileOrders(new Map(JSON.parse(saved)), [cancelledOrder]);
  assert.equal(changed.events.length, 1);
  assert.equal(changed.events[0].type, 'ORDER_CANCELLED');
});

test('A previously unseen cancelled order produces no misleading order-created success alert', () => {
  const changed = reconcileOrders(new Map(), [cancelledOrder]);
  assert.deepEqual(changed.events.map(({ type }) => type), ['ORDER_CANCELLED']);
});
