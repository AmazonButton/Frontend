import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutAcrossStores, groupCartByStore, hasPendingMarketplaceCheckout } from '../src/services/marketplace-checkout.ts';

const line = (id, storeId, quantity = 1, price = 2000) => ({
  product: { id, storeId, price, store: { name: `Store ${storeId}` } }, quantity, selected: true,
});
const contact = { customerName: 'Test Recipient', customerPhone: '0900000000', deliveryAddress: '12 Test Street', paymentMethod: 'COD' };
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] || null,
    get length() { return values.size; },
  };
}

test('Grouping keeps multiple items at one store and calculates a separate total per store', () => {
  const groups = groupCartByStore([line('1', '10', 2), line('2', '20', 3, 5000), line('3', '10')]);
  assert.deepEqual(groups.map(({ storeId, totalAmount }) => ({ storeId, totalAmount })), [
    { storeId: '10', totalAmount: 6000 }, { storeId: '20', totalAmount: 15000 },
  ]);
  assert.deepEqual(groups[0].lines.map(({ product }) => product.id), ['1', '3']);
});

test('One request per store contains only its own products, contact and a distinct idempotency key', async () => {
  const calls = [], placed = [];
  const cache = storage();
  const result = await checkoutAcrossStores({
    lines: [line('1', '10'), line('2', '20'), line('3', '10')], contact, accountId: 'group-test', storage: cache,
    post: async (path, payload, config) => {
      calls.push({ path, payload, key: config.headers['x-idempotency-key'] });
      return { data: { data: { orderId: `order-${payload.storeId}` } } };
    }, onPlaced: (entry, lines) => placed.push({ entry, lines }),
  });
  assert.equal(result.failed.length, 0);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ path }) => path === '/storefront/orders'));
  assert.deepEqual(calls[0].payload.items.map(({ productId }) => productId), ['1', '3']);
  assert.deepEqual(calls[1].payload.items.map(({ productId }) => productId), ['2']);
  assert.equal(calls[0].payload.customerName, contact.customerName);
  assert.notEqual(calls[0].key, calls[1].key);
  assert.equal(placed.length, 2);
  assert.equal(cache.length, 0);
});

test('One failed store does not prevent another store from completing', async () => {
  const confirmed = [];
  const result = await checkoutAcrossStores({
    lines: [line('1', '10'), line('2', '20')], contact, accountId: 'partial-test', storage: storage(),
    post: async (_path, payload) => {
      if (payload.storeId === '10') throw { response: { data: { message: 'Insufficient stock' } } };
      return { data: { orderId: 'order-20' } };
    }, onPlaced: (entry) => confirmed.push(entry.storeId),
  });
  assert.deepEqual(confirmed, ['20']);
  assert.equal(result.placed[0].order.orderId, 'order-20');
  assert.equal(result.failed[0].storeId, '10');
  assert.equal(result.failed[0].message, 'Insufficient stock');
});

test('An ambiguous timeout reuses the request key after reload, even for the last remaining store', async () => {
  const cache = storage(), keys = [];
  const options = {
    lines: [line('1', '10')], contact, accountId: 'timeout-test', storage: cache,
    post: async (_path, _payload, config) => { keys.push(config.headers['x-idempotency-key']); throw Error('Connection lost after commit'); },
    onPlaced() { assert.fail('Unconfirmed requests must not remove cart items'); },
  };
  await checkoutAcrossStores(options);
  assert.equal(hasPendingMarketplaceCheckout('timeout-test', cache), true);
  const reloaded = await import('../src/services/marketplace-checkout.ts?fresh-timeout-test');
  assert.equal(reloaded.hasPendingMarketplaceCheckout('timeout-test', cache), true);
  const recovered = await reloaded.checkoutAcrossStores({
    ...options,
    post: async (_path, _payload, config) => { keys.push(config.headers['x-idempotency-key']); return { data: { data: { id: 'original-order' } } }; },
    onPlaced() {},
  });
  assert.equal(keys[0], keys[1]);
  assert.equal(recovered.placed[0].order.id, 'original-order');
  assert.equal(cache.length, 0);
});

test('Pending requests are scoped to the account and storage contains no recipient details', async () => {
  const cache = storage(), keys = [];
  for (const accountId of ['account-a', 'account-b']) {
    await checkoutAcrossStores({
      lines: [line('1', '10')], contact, accountId, storage: cache,
      post: async (_path, _payload, config) => { keys.push(config.headers['x-idempotency-key']); throw Error('Network timeout'); }, onPlaced() {},
    });
  }
  assert.notEqual(keys[0], keys[1]);
  assert.equal(hasPendingMarketplaceCheckout('account-c', cache), false);
  for (let index = 0; index < cache.length; index++) {
    assert.ok(!cache.key(index).includes(contact.customerName));
    assert.ok(!cache.getItem(cache.key(index)).includes(contact.customerPhone));
  }
});

test('A response without an order ID retains the pending key and does not confirm the cart', async () => {
  const cache = storage();
  const result = await checkoutAcrossStores({
    lines: [line('1', '10')], contact, accountId: 'invalid-response-test', storage: cache,
    post: async () => ({ data: { success: false, message: 'Unavailable' } }),
    onPlaced() { assert.fail('An error response is not an order'); },
  });
  assert.equal(result.placed.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(cache.length, 1);
});

test('Changing accounts stops checkout before another store request is sent', async () => {
  let currentSession = true;
  const calls = [];
  const result = await checkoutAcrossStores({
    lines: [line('1', '10'), line('2', '20')], contact, accountId: 'switch-test', storage: storage(),
    isSessionCurrent: () => currentSession,
    post: async (_path, payload) => { calls.push(payload.storeId); currentSession = false; return { data: { id: 'first-order' } }; },
    onPlaced() {},
  });
  assert.deepEqual(calls, ['10']);
  assert.equal(result.failed[0].storeId, '20');
});
