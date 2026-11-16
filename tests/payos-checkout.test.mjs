import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { getShippingContactErrors, normalizeShippingContact } from '../src/services/shipping-contact-validation.ts';
import { normalizeOrder } from '../src/services/order-events.ts';
import { checkoutAcrossStores, groupCartByStore, hasPendingMarketplaceCheckout } from '../src/services/marketplace-checkout.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/customer/ShopPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ShopPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let checkoutBody;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'checkout') checkoutBody = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(checkoutBody, 'Exercise the actual checkout handler from ShopPage');
const executable = ts.transpileModule(`const checkout = ${checkoutBody}; checkout;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness({ method = 'PAYOS', envelope = 'nested', failPayment = false, invalidPhone = false, multiStore = false, guest = false, failStore = null } = {}) {
  const calls = [];
  const receipts = [];
  const notices = [];
  const navigations = [];
  const cached = new Map();
  const results = [];
  let failingStore = failStore;
  let cart = [{ selected: true, quantity: 1, product: { id: '1', storeId: '3', name: 'Test item', price: 2000, store: { name: 'Store Three' } } }];
  if (multiStore) cart.push({ selected: true, quantity: 2, product: { id: '2', storeId: '4', name: 'Other item', price: 5000, store: { name: 'Store Four' } } });
  const form = { customerName: 'Test Recipient', customerPhone: invalidPhone ? 'not-a-phone' : '0900000000', deliveryAddress: '12 Test Street, Test Ward, Test City', paymentMethod: method };
  const context = {
    busy: false, form, contactErrors: getShippingContactErrors(form), normalizeShippingContact, normalizeOrder,
    groupCartByStore, checkoutAcrossStores, hasPendingMarketplaceCheckout, apiSessionMarker: () => 'page-test:session', user: guest ? null : { id: 'page-test', role: 'CUSTOMER' },
    selectedStore: '3',
    selectedCart: cart,
    localStorage: { getItem: () => guest ? null : 'test-token' }, isTokenExpired: () => false,
    sessionStorage: { setItem: (key, value) => cached.set(key, value), getItem: (key) => cached.get(key), removeItem: (key) => cached.delete(key), get length() { return cached.size; }, key: (index) => [...cached.keys()][index] },
    window: { location: { hostname: 'buttontdash.vercel.app', origin: 'https://buttontdash.vercel.app', assign: (url) => navigations.push(url) } },
    document: { getElementById: () => ({ focus() {} }) },
    setBusy() {}, setContactTouched() {}, setCart(update) { cart = typeof update === 'function' ? update(cart) : update; }, setCheckoutOpen() {}, setCartOpen() {},
    setMarketplaceResult: (result) => results.push(result),
    setReceipt: (order) => receipts.push(order), setNotice: (message) => notices.push(message), publishOrderEvent() {},
    api: { post: async (path, payload, config) => {
      calls.push({ path, payload, config });
      if (path === '/storefront/orders') {
        if (payload.storeId === failingStore) throw { response: { data: { message: 'Test out of stock' } } };
        return { data: { data: { id: multiStore ? `order-${payload.storeId}` : '17', orderNumber: 'WEB-TEST', paymentMethod: method, paymentStatus: 'UNPAID', totalAmount: 2000, items: [], ...form } } };
      }
      assert.equal(path, '/payments/payos/create-link');
      assert.ok(cached.has('pending_payos_order'), 'Recovery data exists before the link request');
      if (failPayment) throw { response: { data: { message: 'Test link unavailable' } } };
      const data = { checkoutUrl: 'https://pay.payos.vn/test-checkout' };
      return { data: envelope === 'nested' ? { data } : data };
    } },
  };
  const checkout = vm.runInNewContext(executable, context);
  return {
    checkout, calls, receipts, notices, navigations, cached, results, get cart() { return cart; },
    retry() { failingStore = null; context.selectedCart = cart.filter((line) => line.selected); return checkout({ preventDefault() {} }); },
  };
}

for (const envelope of ['nested', 'flat']) {
  test(`PayOS ${envelope} response redirects immediately without an intermediate receipt`, async () => {
    const app = harness({ envelope });
    await app.checkout({ preventDefault() {} });
    assert.deepEqual(app.navigations, ['https://pay.payos.vn/test-checkout']);
    assert.equal(app.receipts.filter(Boolean).length, 0);
    assert.deepEqual(app.calls.map(({ path }) => path), ['/storefront/orders', '/payments/payos/create-link']);
  });
}

test('A link error keeps the existing order and offers recovery without creating another order', async () => {
  const app = harness({ failPayment: true });
  await app.checkout({ preventDefault() {} });
  assert.equal(app.navigations.length, 0);
  assert.equal(app.calls.filter(({ path }) => path === '/storefront/orders').length, 1);
  assert.equal(app.receipts.at(-1).id, '17');
  assert.ok(app.notices.at(-1).includes('không đặt lại đơn'));
  assert.equal(JSON.parse(app.cached.get('pending_payos_order')).orderId, '17');
});

test('COD still shows its receipt and does not call PayOS', async () => {
  const app = harness({ method: 'CASH_ON_DELIVERY' });
  await app.checkout({ preventDefault() {} });
  assert.equal(app.calls.length, 1);
  assert.equal(app.receipts.at(-1).id, '17');
  assert.equal(app.navigations.length, 0);
});

test('Invalid recipient input still blocks checkout before any order or payment request', async () => {
  const app = harness({ invalidPhone: true });
  await app.checkout({ preventDefault() {} });
  assert.equal(app.calls.length, 0);
  assert.equal(app.navigations.length, 0);
});

for (const method of ['PAYOS', 'CASH_ON_DELIVERY']) {
  test(`Multi-store ${method} uses only the existing per-store API and shows both orders`, async () => {
    const app = harness({ method, multiStore: true });
    await app.checkout({ preventDefault() {} });
    assert.deepEqual(app.calls.map(({ path }) => path), ['/storefront/orders', '/storefront/orders']);
    assert.deepEqual(app.calls.map(({ payload }) => payload.storeId), ['3', '4']);
    assert.equal(app.results.at(-1).placed.length, 2);
    assert.equal(app.results.at(-1).failed.length, 0);
    assert.equal(app.cart.length, 0);
    assert.equal(app.navigations.length, 0);
  });
}

test('Partial checkout removes only confirmed products and retains the failed store', async () => {
  const app = harness({ method: 'CASH_ON_DELIVERY', multiStore: true, failStore: '4' });
  await app.checkout({ preventDefault() {} });
  assert.equal(app.results.at(-1).placed.length, 1);
  assert.equal(app.results.at(-1).failed[0].storeId, '4');
  assert.equal(app.cart.length, 1);
  assert.equal(app.cart[0].product.storeId, '4');
});

test('Multi-store checkout requires the customer account before making any request', async () => {
  const app = harness({ method: 'CASH_ON_DELIVERY', multiStore: true, guest: true });
  await app.checkout({ preventDefault() {} });
  assert.equal(app.calls.length, 0);
  assert.ok(app.notices.at(-1).includes('đăng nhập'));
});

test('Retrying a partial checkout submits only the remaining store with its original request key', async () => {
  const app = harness({ method: 'CASH_ON_DELIVERY', multiStore: true, failStore: '4' });
  await app.checkout({ preventDefault() {} });
  const failedKey = app.calls[1].config.headers['x-idempotency-key'];
  await app.retry();
  assert.deepEqual(app.calls.map(({ payload }) => payload.storeId), ['3', '4', '4']);
  assert.equal(app.calls[2].config.headers['x-idempotency-key'], failedKey);
  assert.equal(app.results.at(-1).placed.length, 1);
  assert.equal(app.results.at(-1).failed.length, 0);
  assert.equal(app.cart.length, 0);
});
