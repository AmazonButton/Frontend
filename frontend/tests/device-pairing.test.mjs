import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmAtomicPairing, createPairingSession, loadPairingStore, lookupPairingDevice, pairingConfirmationBody, pairingCustomer, parsePairingInput, readOwnedPairedDevice, validatePairingSession, verifyPairingSession } from '../src/pages/customer/device-pairing.mjs';

const response = data => ({ data: { success: true, data } });
const customer = { role: 'CUSTOMER', customerProfileId: '41' };
const session = () => ({ sessionId: 'sess_0123456789abcdef01234567', deviceId: 'SOB-000123', storeId: '5', storeName: 'Test Store', status: 'ACTIVE', expiresAt: new Date(Date.now() + 600000).toISOString() });
const selection = { buttonName: 'Nút nước bếp', productId: '7' };
const confirmed = { deviceId: 'SOB-000123', customerId: '41', storeId: '5', productId: '7', status: 'ACTIVE' };

function harness({ claimed = false, productStore = '5', productStatus = 'ACTIVE', invalidVerify = false, rejectConfirmation = false, confirmation = confirmed, rejectProduct = false } = {}) {
  const calls = []; const active = session();
  const client = {
    post: async (path, body) => {
      calls.push({ method: 'POST', path, body });
      if (path === '/provisioning/verify') return { data: { success: true, valid: !invalidVerify, data: active } };
      if (path === '/devices/lookup-code') return response({ deviceId: active.deviceId, isClaimed: claimed, status: 'ACTIVE' });
      assert.equal(path, `/provisioning/sessions/${active.sessionId}/confirmation`);
      if (rejectConfirmation) throw new Error('Response lost');
      return response(confirmation);
    },
    get: async path => {
      calls.push({ method: 'GET', path });
      if (rejectProduct) throw new Error('Cannot read product');
      assert.equal(path, '/products/7'); return response({ productId: '7', storeId: productStore, status: productStatus });
    },
  };
  return { active, client, calls };
}

test('parse full QR and query-token QR into supported DTO fields without retaining a URL', () => {
  for (const qrPayload of ['SOBPAIR://device/SOB-000123/token/p_test', 'https://store.test/device/SOB-000123?token=p_test', 'SOBPAIR://SOB-000123/token/p_test']) assert.deepEqual(parsePairingInput({ qrPayload }), { deviceId: 'SOB-000123', token: 'p_test' });
});
test('manual code requires a separate pairing token; code-only QR cannot pretend to pair', () => {
  assert.deepEqual(parsePairingInput({ deviceCode: ' sob-000123 ', token: ' p_test ' }), { deviceId: 'SOB-000123', token: 'p_test' });
  assert.throws(() => parsePairingInput({ qrPayload: 'SOBPAIR://device/SOB-000123' }), /đầy đủ/);
  assert.throws(() => parsePairingInput({ deviceCode: '123456' }), /mã ghép nối/);
  assert.throws(() => parsePairingInput({ deviceCode: '../secret', token: 'p_test' }));
});
test('pairing requires CUSTOMER and actual linked profile ID', () => {
  assert.equal(pairingCustomer(customer), '41');
  for (const user of [null, { role: 'SUPER_ADMIN', customerProfileId: '41' }, { role: 'CUSTOMER' }]) assert.throws(() => pairingCustomer(user));
});
test('lookup is read-only and checks explicit ownership capability fields', async () => {
  const calls = []; const lookup = await lookupPairingDevice({ post: async (...args) => { calls.push(args); return response({ deviceId: 'SOB-000123', isClaimed: false }); } }, '123456');
  assert.equal(lookup.isClaimed, false); assert.deepEqual(calls, [['/devices/lookup-code', { code: '123456' }]]);
  await assert.rejects(lookupPairingDevice({ post: async () => response({ deviceId: 'SOB-000123' }) }, '123456'));
});
test('create session uses only actual device/token and marks one-time request boundary', async () => {
  const active = session(); const calls = []; let sent = 0;
  const created = await createPairingSession({ post: async (...args) => { calls.push(args); return response(active); } }, { deviceId: 'SOB-000123', token: 'p_test', qrPayload: 'unused', extra: 'unused' }, () => { sent++; });
  assert.equal(created.sessionId, active.sessionId); assert.equal(sent, 1);
  assert.deepEqual(calls, [['/provisioning/session', { deviceId: 'SOB-000123', token: 'p_test' }]]);
  assert.ok(calls.every(([path]) => !path.includes('bootstrap')));
});
test('create session rejects application failure and mismatched device even under HTTP 200', async () => {
  await assert.rejects(createPairingSession({ post: async () => ({ data: { success: false, message: 'Token used' } }) }, { deviceId: 'SOB-000123', token: 'p_test' }), /Token used/);
  await assert.rejects(createPairingSession({ post: async () => response({ ...session(), deviceId: 'SOB-OTHER' }) }, { deviceId: 'SOB-000123', token: 'p_test' }), /không khớp/);
});
test('session validation rejects expired, used, malformed or swapped sessions', () => {
  const active = session(); assert.equal(validatePairingSession(active), active);
  for (const value of [{ ...active, expiresAt: new Date(0).toISOString() }, { ...active, status: 'CLAIMED' }, { ...active, sessionId: 'bad' }, { ...active, storeId: '6' }]) assert.throws(() => validatePairingSession(value, active));
});
test('verify checks server valid flag and sends session ID in body only', async () => {
  const active = session(); const calls = [];
  const actual = await verifyPairingSession({ post: async (...args) => { calls.push(args); return { data: { success: true, valid: true, data: active } }; } }, active);
  assert.equal(actual.deviceId, active.deviceId); assert.deepEqual(calls, [['/provisioning/verify', { sessionId: active.sessionId }]]);
  await assert.rejects(verifyPairingSession({ post: async () => ({ data: { success: true, valid: false, data: active } }) }, active));
});
test('store context is actual active store and only active valid products become selectable', async () => {
  const calls = []; const store = await loadPairingStore({ get: async path => { calls.push(path); return response({ storeId: '5', status: 'ACTIVE', products: [{ productId: '7', status: 'ACTIVE' }, { productId: '8', status: 'INACTIVE' }, { productId: '../9', status: 'ACTIVE' }] }); } }, session());
  assert.deepEqual(calls, ['/stores/5']); assert.deepEqual(store.products.map(item => item.productId), ['7']);
  await assert.rejects(loadPairingStore({ get: async () => { throw new Error('must not call'); } }, { ...session(), storeId: null }), /chưa được phân bổ/);
  await assert.rejects(loadPairingStore({ get: async () => response({ storeId: '6', status: 'ACTIVE' }) }, session()));
});
test('confirmation body includes supported service fields only, no ignored quantity/address/customer override', () => {
  const body = pairingConfirmationBody(session(), { ...selection, quantity: 9, addressId: '8', customerId: 'someone-else' });
  assert.deepEqual(body, { deviceId: 'SOB-000123', buttonName: 'Nút nước bếp', productId: '7' });
  assert.throws(() => pairingConfirmationBody(session(), { productId: '7', buttonName: ' ' }));
  assert.throws(() => pairingConfirmationBody(session(), { ...selection, buttonName: 'a'.repeat(101) }));
});
test('atomic confirmation checks session, ownership and current product before one confirmation POST', async () => {
  const app = harness(); let sent = 0; const outcome = await confirmAtomicPairing(app.client, app.active, customer, selection, () => { sent++; });
  assert.deepEqual(outcome, confirmed); assert.equal(sent, 1);
  assert.deepEqual(app.calls.map(item => item.path), ['/provisioning/verify', '/devices/lookup-code', '/products/7', `/provisioning/sessions/${app.active.sessionId}/confirmation`]);
  assert.deepEqual(app.calls.at(-1).body, { deviceId: 'SOB-000123', buttonName: 'Nút nước bếp', productId: '7' });
});
test('claimed devices, inactive/wrong-store products and invalid sessions block mutation', async () => {
  for (const options of [{ claimed: true }, { productStore: '6' }, { productStatus: 'INACTIVE' }, { invalidVerify: true }, { rejectProduct: true }]) {
    const app = harness(options); let sent = 0;
    await assert.rejects(confirmAtomicPairing(app.client, app.active, customer, selection, () => { sent++; }));
    assert.equal(sent, 0); assert.equal(app.calls.filter(item => item.path.endsWith('/confirmation')).length, 0);
  }
});
test('uncertain confirmation is not retried by flow helper', async () => {
  const app = harness({ rejectConfirmation: true }); let sent = 0;
  await assert.rejects(confirmAtomicPairing(app.client, app.active, customer, selection, () => { sent++; }), /Response lost/);
  assert.equal(sent, 1); assert.equal(app.calls.filter(item => item.path.endsWith('/confirmation')).length, 1);
});
test('wrong customer or product in confirmation response cannot display success', async () => {
  for (const confirmation of [{ ...confirmed, customerId: '99' }, { ...confirmed, productId: '99' }, { ...confirmed, status: 'PENDING' }]) {
    const app = harness({ confirmation }); await assert.rejects(confirmAtomicPairing(app.client, app.active, customer, selection), /chưa khớp/);
  }
});
test('canonical device read verifies actual owner and selected configuration after claim', async () => {
  const calls = []; const value = { deviceId: 'SOB-000123', customerId: '41', storeId: '5', status: 'ACTIVE', products: [{ productId: '7', quantity: 1 }] };
  const device = await readOwnedPairedDevice({ get: async path => { calls.push(path); return response(value); } }, 'SOB-000123', customer, { storeId: '5', productId: '7' });
  assert.equal(device, value); assert.deepEqual(calls, ['/devices/SOB-000123']);
  await assert.rejects(readOwnedPairedDevice({ get: async () => response({ ...value, customerId: '99' }) }, 'SOB-000123', customer), /tài khoản hiện tại/);
  await assert.rejects(readOwnedPairedDevice({ get: async () => response({ ...value, products: [] }) }, 'SOB-000123', customer, { storeId: '5', productId: '7' }), /chưa khớp/);
});
