import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { assertShiftCanClose, buildDeliveryPayload, canClaimDelivery, canConfirmHandover, canRecordDelivery, cloudinaryEvidenceUrl, evidenceFileError, failureReasons, validateFailurePayload } from '../src/services/driver-workflow.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const helper = require('../src/services/driver-workflow.ts');
const code = ts.transpileModule(readFileSync(new URL('../src/services/drivers.service.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const image = 'https://res.cloudinary.com/test/image/upload/v123/stores/9/pod/delivery-test.jpg';
const order = { id: '601', storeId: '9', status: 'READY_FOR_DELIVERY', assignedDriverId: null, totalAmount: 120000, paymentMethod: 'COD', paymentStatus: 'UNPAID', customerName: 'Test recipient', deliveryAddress: 'Test destination' };

function harness(handlers = {}) {
  const requests = [], events = [];
  const api = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, async (path, body, config) => {
    const request = { method, path, body, config }; requests.push(request);
    const response = handlers[method] ? await handlers[method](request) : { success: true, data: {} };
    return { data: response };
  }]));
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, window: {}, require: name => {
    if (name === './api') return { api };
    if (name === './driver-workflow') return helper;
    if (name === './order-events') return { normalizeOrder: raw => ({ ...raw, id: String(raw.id || raw.orderId), status: raw.status || raw.orderStatus }), publishOrderEvent: (type, payload) => events.push({ type, payload }) };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { service: module.exports.driversService, requests, events };
}

test('duty uses the exact ONLINE/OFFLINE contract, without unsupported location fields', async () => {
  const app = harness({ patch: ({ body }) => ({ success: true, data: { status: body.status } }) });
  await app.service.updateDuty('ONLINE');
  assert.deepEqual(JSON.parse(JSON.stringify(app.requests[0].body)), { status: 'ONLINE' });
  assert.equal(app.requests[0].path, '/drivers/me/duty');
  await assert.rejects(app.service.updateDuty('ON_DUTY'));
  await assert.rejects(app.service.updateDuty('BUSY'));
  assert.equal(app.requests.length, 1);
});

test('assigned-order and history endpoints read their actual top-level envelopes', async () => {
  const app = harness({ get: ({ path }) => path.includes('my-orders') ? { success: true, orders: [{ ...order, status: 'SHIPPING' }], pagination: { total: 1, totalPages: 1 } } : { success: true, shifts: [{ shiftId: '7', status: 'CLOSED' }], pagination: { totalPages: 1 } } });
  const assigned = await app.service.getMyOrders({ status: 'SHIPPING', page: 2, limit: 12 });
  const history = await app.service.getShiftHistory(2);
  assert.equal(assigned.orders[0].id, '601');
  assert.equal(history.shifts[0].shiftId, '7');
  assert.equal(app.requests[0].body.params.page, 2);
  assert.equal(app.requests[1].body.params.limit, 10);
});

test('malformed pagination cannot be mistaken for zero in-flight deliveries', async () => {
  const app = harness({ get: () => ({ success: true, orders: [] }) });
  await assert.rejects(app.service.getMyOrders());
  assert.throws(() => assertShiftCanClose('7', { data: { shiftId: '7', status: 'OPEN' } }, { orders: [] }));
});

test('claim eligibility requires current store, online duty and an open shift', () => {
  assert.equal(canClaimDelivery(order, { status: 'ONLINE' }, { status: 'OPEN' }, '9'), true);
  assert.equal(canClaimDelivery(order, { status: 'OFFLINE' }, { status: 'OPEN' }, '9'), false);
  assert.equal(canClaimDelivery(order, { status: 'ONLINE' }, null, '9'), false);
  assert.equal(canClaimDelivery(order, { status: 'ONLINE' }, { status: 'OPEN' }, '8'), false);
  assert.equal(canClaimDelivery({ ...order, assignedDriverId: '22' }, { status: 'ONLINE' }, { status: 'OPEN' }, '9'), false);
});

test('a successful claim publishes only the authoritative returned SHIPPING order', async () => {
  const shipping = { ...order, status: 'SHIPPING', assignedDriverId: '21' };
  const app = harness({ post: () => ({ success: true, data: shipping }) });
  const response = await app.service.claimOrder('601');
  assert.equal(app.requests[0].path, '/orders/601/claim');
  assert.equal(response.data.assignedDriverId, '21');
  assert.equal(app.events.length, 1);
  assert.equal(app.events[0].type, 'ORDER_STATUS_CHANGED');
  assert.equal(app.events[0].payload.order.status, 'SHIPPING');
});

test('a concurrent claim rejection or application error never publishes success', async () => {
  const app = harness({ post: () => { throw new Error('ORDER_ALREADY_CLAIMED'); } });
  await assert.rejects(app.service.claimOrder('601'), /ORDER_ALREADY_CLAIMED/);
  assert.equal(app.events.length, 0);
  const rejected = harness({ post: () => ({ success: false, message: 'Already claimed' }) });
  await assert.rejects(rejected.service.claimOrder('601'), /Already claimed/);
  assert.equal(rejected.events.length, 0);
  const stale = harness({ post: () => ({ success: true, data: order }) });
  await assert.rejects(stale.service.claimOrder('601'));
  assert.equal(stale.events.length, 0);
});

test('the ready queue excludes already assigned and changed orders', async () => {
  const app = harness({ get: () => ({ success: true, data: [order, { ...order, id: '602', assignedDriverId: '21' }, { ...order, id: '603', status: 'SHIPPING' }] }) });
  const ready = await app.service.getReadyOrders();
  assert.equal(ready.length, 1);
  assert.equal(ready[0].id, '601');
  assert.equal(app.requests[0].body.params.status, 'READY_FOR_DELIVERY');
});

test('COD completion requires an uploaded image and explicit exact cash confirmation', () => {
  const payload = buildDeliveryPayload(order, image, '120000', true);
  assert.deepEqual(payload, { status: 'DELIVERED', paymentMethod: 'COD', podImageUrl: image, collectedAmount: 120000 });
  assert.throws(() => buildDeliveryPayload(order, image, '119000', true));
  assert.throws(() => buildDeliveryPayload(order, image, '120000', false));
  assert.throws(() => buildDeliveryPayload(order, '', '120000', true));
  assert.throws(() => buildDeliveryPayload(order, image, '', true));
});

test('online payment completion never pretends an unpaid transfer is paid', () => {
  assert.throws(() => buildDeliveryPayload({ ...order, paymentMethod: 'PAYOS' }, image, '', false));
  const payload = buildDeliveryPayload({ ...order, paymentMethod: 'PAYOS', paymentStatus: 'PAID' }, image, '', false);
  assert.equal(payload.paymentMethod, 'PAYOS');
  assert.equal('collectedAmount' in payload, false);
  assert.throws(() => buildDeliveryPayload({ ...order, paymentMethod: 'UNKNOWN', paymentStatus: 'PAID' }, image, '', false));
});

test('failure uses exact backend enums and distinct evidenceImageUrl field', async () => {
  const app = harness({ post: ({ body }) => ({ success: true, data: { ...order, status: 'DELIVERY_FAILED', ...body } }) });
  await app.service.failDelivery('601', { failureReasonCode: 'CUSTOMER_UNREACHABLE', failureNote: 'Called recipient', evidenceImageUrl: image });
  assert.equal(app.requests[0].path, '/orders/601/fail');
  assert.equal(app.requests[0].body.failureReasonCode, 'CUSTOMER_UNREACHABLE');
  assert.equal(app.requests[0].body.evidenceImageUrl, image);
  assert.equal('failureReason' in app.requests[0].body, false);
  for (const reason of failureReasons) assert.doesNotThrow(() => validateFailurePayload({ failureReasonCode: reason.value, evidenceImageUrl: image }));
  await assert.rejects(app.service.failDelivery('601', { failureReasonCode: 'OTHER', evidenceImageUrl: image }));
  assert.equal(app.requests.length, 1);
});

test('evidence rejects oversized/non-image files, unsafe hosts and another store folder', () => {
  assert.equal(evidenceFileError({ type: 'image/jpeg', size: 100000 }), '');
  assert.notEqual(evidenceFileError({ type: 'image/jpeg', size: 2 * 1024 * 1024 }), '');
  assert.notEqual(evidenceFileError({ type: 'application/pdf', size: 1000 }), '');
  assert.equal(cloudinaryEvidenceUrl(image, '9'), true);
  assert.equal(cloudinaryEvidenceUrl(image, '8'), false);
  assert.equal(cloudinaryEvidenceUrl('https://res.cloudinary.com.evil.test/image/upload/stores/9/pod/x'), false);
  assert.equal(cloudinaryEvidenceUrl('http://res.cloudinary.com/test/image/upload/stores/9/pod/x'), false);
});

test('STAFF_DELIVERY can report only their own SHIPPING order', () => {
  const shipping = { ...order, status: 'SHIPPING', assignedDriverId: '21' };
  assert.equal(canRecordDelivery(shipping, '21', 'STAFF_DELIVERY'), true);
  assert.equal(canRecordDelivery(shipping, '22', 'STAFF_DELIVERY'), false);
  assert.equal(canRecordDelivery(shipping, '22', 'CUSTOMER'), false);
  assert.equal(canRecordDelivery({ ...shipping, status: 'DELIVERED' }, '21', 'STAFF_DELIVERY'), false);
});

test('closing a shift checks fresh assigned orders and matching current shift', () => {
  const current = { data: { shiftId: '7', status: 'OPEN' } };
  assert.doesNotThrow(() => assertShiftCanClose('7', current, { pagination: { total: 0 } }));
  assert.throws(() => assertShiftCanClose('7', current, { pagination: { total: 1 } }));
  assert.throws(() => assertShiftCanClose('8', current, { pagination: { total: 0 } }));
});

test('handover confirmation is available only for returned CLOSED shifts and cashier roles', async () => {
  const closed = { shiftId: '7', status: 'CLOSED' };
  assert.equal(canConfirmHandover(closed, 'STORE_MANAGER'), true);
  assert.equal(canConfirmHandover(closed, 'STAFF_DELIVERY'), false);
  assert.equal(canConfirmHandover({ ...closed, status: 'OPEN' }, 'STORE_MANAGER'), false);
  assert.equal(canConfirmHandover({ ...closed, status: 'HANDED_OVER' }, 'STORE_MANAGER'), false);
  const app = harness({ post: () => ({ success: true, data: { shiftId: '7', status: 'HANDED_OVER' } }) });
  await app.service.confirmHandover('7', ' Counted cash ');
  assert.equal(app.requests[0].path, '/driver-shifts/7/confirm-handover');
  assert.equal(app.requests[0].body.note, 'Counted cash');
});

test('canonical reads carry AbortSignal so stale page requests can be cancelled', async () => {
  const signal = new AbortController().signal;
  const app = harness({ get: () => ({ success: true, data: { status: 'OFFLINE' } }) });
  await app.service.getMyDuty(signal);
  assert.equal(app.requests[0].body.signal, signal);
});

test('mocked receive-deliver-close-handover flow refreshes saved server state', async () => {
  let currentOrder = { ...order };
  let currentShift = { shiftId: '7', status: 'OPEN', totalCodCollected: 0, totalOrdersDelivered: 0 };
  const app = harness({
    post: ({ path, body }) => {
      if (path.endsWith('/claim')) currentOrder = { ...currentOrder, assignedDriverId: '21', status: 'SHIPPING' };
      if (path.endsWith('/deliver')) { currentOrder = { ...currentOrder, ...body, status: 'DELIVERED', paymentStatus: 'PAID' }; currentShift = { ...currentShift, totalCodCollected: body.collectedAmount, totalOrdersDelivered: 1 }; }
      if (path.endsWith('/close')) { currentShift = { ...currentShift, status: 'CLOSED' }; return { success: true, data: currentShift }; }
      if (path.endsWith('/confirm-handover')) { currentShift = { ...currentShift, status: 'HANDED_OVER' }; return { success: true, data: currentShift }; }
      return { success: true, data: currentOrder };
    },
    get: ({ path }) => path === '/driver-shifts/current' ? { success: true, data: currentShift.status === 'OPEN' ? currentShift : null } : path.includes('my-orders') ? { success: true, orders: currentOrder.status === 'SHIPPING' ? [currentOrder] : [], pagination: { total: currentOrder.status === 'SHIPPING' ? 1 : 0 } } : { success: true, data: currentOrder },
  });
  await app.service.claimOrder('601');
  const latest = await app.service.getOrder('601');
  await app.service.completeDelivery('601', buildDeliveryPayload(latest, image, '120000', true));
  const current = await app.service.getCurrentShift();
  const assigned = await app.service.getMyOrders({ status: 'SHIPPING' });
  assert.equal(current.data.totalCodCollected, 120000);
  assertShiftCanClose('7', current, assigned);
  await app.service.closeShift('7');
  await app.service.confirmHandover('7', 'Test handover');
  assert.equal(currentShift.status, 'HANDED_OVER');
  assert.equal(currentShift.totalOrdersDelivered, 1);
  assert.equal(app.events.length, 2);
});

function resultDialogHarness(latestOrder = { ...order, status: 'SHIPPING', assignedDriverId: '21' }) {
  const serviceApp = harness({
    get: () => ({ success: true, data: latestOrder }),
    post: ({ body }) => ({ success: true, data: { ...latestOrder, ...body, status: 'DELIVERED', paymentStatus: 'PAID' } }),
  });
  const slots = [], done = [], uploads = [];
  let cursor = 0, dirty = true, tree;
  const react = {
    useState(initial) { const index = cursor++; slots[index] ||= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const source = readFileSync(new URL('../src/pages/operations/DriverDeliveryPage.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: module.exports, require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-router-dom') return { Link: 'a' };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
      if (name.endsWith('/AuthContext')) return {};
      if (name.endsWith('/drivers.service')) return { driversService: serviceApp.service };
      if (name.endsWith('/driver-workflow')) return helper;
      if (name.endsWith('/media.service')) return { mediaService: { uploadPodImage: async (file, id) => { uploads.push({ file, id }); return { success: true, data: { secureUrl: image } }; } } };
      if (name.endsWith('/DriverWorkflowUI')) return { DriverDialog: 'dialog', DriverNotice: 'notice', driverInput: 'input', driverPrimary: 'primary', driverSecondary: 'secondary' };
      throw new Error(`Unexpected dialog import ${name}`);
    },
  });
  const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];
  const flush = async () => {
    for (let n = 0; n < 35; n++) {
      if (dirty) { dirty = false; cursor = 0; tree = module.exports.DeliveryResultDialog({ order: { ...order, status: 'SHIPPING', assignedDriverId: '21' }, mode: 'delivered', userId: '7', role: 'STORE_OWNER', onClose() {}, onDone: async message => { done.push(message); } }); }
      await Promise.resolve();
    }
  };
  return { ...serviceApp, done, uploads, flush, get nodes() { return walk(tree); },
    async submit() { await walk(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await flush(); },
    async upload() { walk(tree).find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [{ type: 'image/jpeg', size: 100 }], value: 'fixture.jpg' } }); await flush(); },
    async confirmCash() { walk(tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await flush(); },
  };
}

test('the shared owner delivery form requires real uploaded POD and cash confirmation before POST deliver', async () => {
  const app = resultDialogHarness(); await app.flush();
  await app.submit(); assert.equal(app.requests.length, 0); assert.equal(app.done.length, 0);
  await app.upload(); assert.equal(app.uploads[0].id, '601');
  await app.submit(); assert.equal(app.requests.filter(request => request.method === 'post').length, 0);
  await app.confirmCash(); await app.submit();
  const posts = app.requests.filter(request => request.method === 'post');
  assert.equal(posts.length, 1); assert.equal(posts[0].path, '/orders/601/deliver');
  assert.deepEqual(JSON.parse(JSON.stringify(posts[0].body)), { status: 'DELIVERED', paymentMethod: 'COD', podImageUrl: image, collectedAmount: 120000 });
  assert.equal(app.done.length, 1); assert.equal(app.events.length, 1);
});

test('the shared owner form rechecks current order before recording delivery', async () => {
  const app = resultDialogHarness({ ...order, status: 'DELIVERED', paymentStatus: 'PAID' });
  await app.flush(); await app.upload(); await app.confirmCash(); await app.submit();
  assert.equal(app.requests.filter(request => request.method === 'get').length, 1);
  assert.equal(app.requests.filter(request => request.method === 'post').length, 0);
  assert.equal(app.done.length, 0); assert.equal(app.events.length, 0);
});
