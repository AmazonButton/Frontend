import assert from 'node:assert/strict';
import test from 'node:test';
import { canRemoveDeviceProducts, createDeviceProductRemoval, hasDeviceProducts } from '../src/services/device-product-removal.ts';

const ok = data => ({ data: { success: true, data } });
const selected = { id: '90071992547409931', deviceId: 'BTN-TEST', products: [{ productId: '5' }] };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('unassign capability follows exact backend controller roles', () => {
  for (const role of ['STORE_OWNER', 'STORE_MANAGER', 'SUPER_ADMIN']) assert.equal(canRemoveDeviceProducts(role), true);
  for (const role of ['SYSTEM_ADMIN', 'ADMIN', 'STAFF_BUTTON', 'CUSTOMER', '']) assert.equal(canRemoveDeviceProducts(role), false);
});

test('assignment detection supports canonical arrays and current legacy UI shapes', () => {
  assert.equal(hasDeviceProducts(selected), true);
  assert.equal(hasDeviceProducts({ deviceId: 'BTN', productId: '5' }), true);
  assert.equal(hasDeviceProducts({ deviceId: 'BTN', configuration: { productId: '5' } }), true);
  assert.equal(hasDeviceProducts({ deviceId: 'BTN', products: [] }), false);
});

test('unassign targets the captured database id and awaits canonical detail and fleet refresh', async () => {
  const sequence = [], refresh = deferred();
  const removal = createDeviceProductRemoval({ delete: async path => { sequence.push(['DELETE', path]); return ok(undefined); }, get: async path => { sequence.push(['GET', path]); return ok({ ...selected, products: [] }); } }, selected, 'STORE_OWNER');
  let finished = false;
  const pending = removal.run(async () => { sequence.push(['refresh']); await refresh.promise; }).then(result => { finished = result; });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(finished, false);
  assert.deepEqual(sequence, [['DELETE', '/devices/90071992547409931/product'], ['GET', '/devices/90071992547409931'], ['refresh']]);
  refresh.resolve(); await pending; assert.equal(finished, true);
});

test('denied role and missing identifier never send a request', async () => {
  let calls = 0;
  const transport = { delete: async () => { calls++; }, get: async () => { calls++; } };
  await assert.rejects(createDeviceProductRemoval(transport, selected, 'CUSTOMER').run(async () => {}), /không có quyền/);
  await assert.rejects(createDeviceProductRemoval(transport, { deviceId: '' }, 'STORE_OWNER').run(async () => {}));
  assert.equal(calls, 0);
});

test('server rejection never refreshes or reports removal', async () => {
  let reads = 0, refreshes = 0;
  const removal = createDeviceProductRemoval({ delete: async () => ({ data: { success: false, message: 'Không thể gỡ' } }), get: async () => { reads++; } }, selected, 'STORE_OWNER');
  await assert.rejects(removal.run(async () => { refreshes++; }), /Không thể gỡ/);
  assert.equal(removal.removed, false); assert.equal(reads, 0); assert.equal(refreshes, 0);
});

test('a failed read after DELETE retries only reads, preserving another user changes', async () => {
  let deletes = 0, reads = 0;
  const removal = createDeviceProductRemoval({ delete: async () => { deletes++; return ok(undefined); }, get: async () => { reads++; if (reads === 1) throw new Error('timeout'); return ok({ ...selected, products: [] }); } }, selected, 'STORE_OWNER');
  await assert.rejects(removal.run(async () => {}), /timeout/);
  assert.equal(removal.removed, true);
  assert.equal(await removal.run(async () => {}), true);
  assert.equal(deletes, 1); assert.equal(reads, 2);
});

test('concurrent confirmation calls issue a single DELETE', async () => {
  const job = deferred(); let deletes = 0;
  const removal = createDeviceProductRemoval({ delete: async () => { deletes++; return job.promise; }, get: async () => ok({ ...selected, products: [] }) }, selected, 'STORE_OWNER');
  const first = removal.run(async () => {});
  assert.equal(await removal.run(async () => {}), false);
  assert.equal(deletes, 1);
  job.resolve(ok(undefined)); assert.equal(await first, true);
});

test('canonical detail still containing products is not reported as cleared', async () => {
  let deletes = 0, refreshes = 0;
  const removal = createDeviceProductRemoval({ delete: async () => { deletes++; return ok(undefined); }, get: async () => ok(selected) }, selected, 'STORE_OWNER');
  await assert.rejects(removal.run(async () => { refreshes++; }), /vẫn có sản phẩm/);
  await assert.rejects(removal.run(async () => { refreshes++; }), /vẫn có sản phẩm/);
  assert.equal(deletes, 1); assert.equal(refreshes, 0);
});
