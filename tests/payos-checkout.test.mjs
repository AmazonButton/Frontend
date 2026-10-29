import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { getShippingContactErrors, normalizeShippingContact } from '../src/services/shipping-contact-validation.ts';
import { normalizeOrder } from '../src/services/order-events.ts';

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

function harness({ method = 'PAYOS', envelope = 'nested', failPayment = false, invalidPhone = false } = {}) {
  const calls = [];
  const receipts = [];
  const notices = [];
  const navigations = [];
  const cached = new Map();
  const form = { customerName: 'Test Recipient', customerPhone: invalidPhone ? 'not-a-phone' : '0900000000', deliveryAddress: '12 Test Street, Test Ward, Test City', paymentMethod: method };
  const context = {
    busy: false, form, contactErrors: getShippingContactErrors(form), normalizeShippingContact, normalizeOrder,
    selectedStore: '3',
    selectedCart: [{ selected: true, quantity: 1, product: { id: '1', storeId: '3', name: 'Test item', price: 2000 } }],
    localStorage: { getItem: () => 'test-token' }, isTokenExpired: () => false,
    sessionStorage: { setItem: (key, value) => cached.set(key, value) },
    window: { location: { hostname: 'buttontdash.vercel.app', origin: 'https://buttontdash.vercel.app', assign: (url) => navigations.push(url) } },
    document: { getElementById: () => ({ focus() {} }) },
    setBusy() {}, setContactTouched() {}, setCart() {}, setCheckoutOpen() {}, setCartOpen() {},
    setReceipt: (order) => receipts.push(order), setNotice: (message) => notices.push(message), publishOrderEvent() {},
    api: { post: async (path, payload) => {
      calls.push({ path, payload });
      if (path === '/storefront/orders') return { data: { data: { id: '17', orderNumber: 'WEB-TEST', paymentMethod: method, paymentStatus: 'UNPAID', totalAmount: 2000, items: [], ...form } } };
      assert.equal(path, '/payments/payos/create-link');
      assert.ok(cached.has('pending_payos_order'), 'Recovery data exists before the link request');
      if (failPayment) throw { response: { data: { message: 'Test link unavailable' } } };
      const data = { checkoutUrl: 'https://pay.payos.vn/test-checkout' };
      return { data: envelope === 'nested' ? { data } : data };
    } },
  };
  const checkout = vm.runInNewContext(executable, context);
  return { checkout, calls, receipts, notices, navigations, cached };
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
