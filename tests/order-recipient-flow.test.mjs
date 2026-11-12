import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const contact = { customerName: 'Nguyễn Văn An', customerPhone: '0351234567', deliveryAddress: '12 Đường Kiểm Thử, phường Kiểm Thử, TP Hồ Chí Minh' };
const profile = { fullName: 'Người Đặt Hộ', phoneNumber: '0987654321', phone: '0987654321' };
const evaluate = (source, context) => vm.runInNewContext(ts.transpileModule('const callback = ' + source + '; callback;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
function callback(prefix, path, name) {
  const source = readFileSync(new URL(prefix + path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      if (node.name.getText(ast) === name) result = name === 'loadOrders' ? node.initializer.arguments[0].getText(ast) : node.initializer.getText(ast);
      if (name === 'cachedOrders' && node.name.getText(ast) === '[orders, setOrders]') result = node.initializer.arguments[0].getText(ast);
    }
    if (name === 'recoverOrder' && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'then' && node.expression.expression.getText(ast).includes('effectiveOrderId')) result = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(result, 'Missing actual callback ' + name); return result;
}
for (const prefix of ['../src/', '../frontend/src/']) {
  const flow = await import(new URL(prefix + 'services/order-events.ts', import.meta.url));
  const validation = await import(new URL(prefix + 'services/shipping-contact-validation.ts', import.meta.url));
  const location = await import(new URL(prefix + 'services/delivery-location.ts', import.meta.url));
  test(prefix + 'recipientPhone from backend wins over buyer phone and status updates keep the saved contact', () => {
    const raw = { id: '17', recipientPhone: contact.customerPhone, customerPhone: profile.phone,
      shippingRecipientName: contact.customerName, shippingAddress: contact.deliveryAddress, customer: profile };
    const order = flow.normalizeOrder(raw);
    assert.equal(order.customerPhone, contact.customerPhone);
    assert.equal(order.customerName, contact.customerName);
    assert.equal(order.deliveryAddress, contact.deliveryAddress);
    for (const incoming of [{ paymentStatus: 'PAID', customerPhone: profile.phone }, { orderStatus: 'CONFIRMED', recipientPhone: null, customerPhone: '' }]) {
      const updated = flow.mergeOrderUpdate(order, incoming);
      assert.equal(updated.customerPhone, contact.customerPhone);
      assert.equal(updated.deliveryAddress, contact.deliveryAddress);
    }
    assert.equal(flow.normalizeOrderEvent({ order: raw }).customerPhone, contact.customerPhone);
  });
  test(prefix + 'fresh recipient aliases replace stale cached snapshot aliases together', () => {
    const current = flow.normalizeOrder({ id: '17', shippingRecipientName: 'Old Recipient', shippingPhone: profile.phone, shippingAddress: 'Old address' });
    for (const incoming of [{ recipientPhone: contact.customerPhone, shipping_recipient_name: contact.customerName }, { shipping_phone: contact.customerPhone, shipping_recipient_name: contact.customerName }]) {
      const updated = flow.mergeOrderUpdate(current, { id: '17', ...incoming, shipping_address: contact.deliveryAddress, paymentStatus: 'PAID' });
      assert.equal(updated.customerPhone, contact.customerPhone); assert.equal(updated.shippingPhone, contact.customerPhone);
      assert.equal(updated.customerName, contact.customerName); assert.equal(updated.deliveryAddress, contact.deliveryAddress);
      assert.equal(updated.paymentStatus, 'PAID');
    }
    const legacy = flow.normalizeOrder({ id: '17', customer: { phone: profile.phone } }); assert.equal(legacy.customerPhone, profile.phone);
  });
  test(prefix + 'guest checkout sends string contact fields to persistence API and both roles reload the same recipient', async () => {
    const requests = [], receipts = [], events = [];
    let saved;
    const form = { ...contact, customerPhone: ' 0351234567 ', paymentMethod: 'CASH_ON_DELIVERY', shippingPhone: profile.phone };
    const context = {
      busy: false, form, contactErrors: validation.getShippingContactErrors(form), ...validation, ...flow,
      selectedStore: '3', selectedCart: [{ selected: true, quantity: 1, product: { id: '1', storeId: '3', price: 2000, name: 'Test product' } }],
      localStorage: { getItem: () => null }, window: {}, isTokenExpired: () => true,
      setBusy() {}, setContactTouched() {}, setCart() {}, setCheckoutOpen() {}, setCartOpen() {}, setNotice() {},
      setReceipt: value => receipts.push(value), publishOrderEvent: (type, payload) => events.push({ type, payload }),
      api: { post: async (path, body) => {
        requests.push({ path, body }); assert.equal(path, '/storefront/orders');
        assert.equal(typeof body.customerPhone, 'string'); assert.equal(body.customerPhone, contact.customerPhone);
        assert.equal('shippingPhone' in body, false, 'only DTO contact fields may be submitted');
        saved = { id: '17', orderNumber: 'WEB-17', storeId: '3', orderStatus: 'PENDING', paymentMethod: 'COD', paymentStatus: 'UNPAID',
          shippingRecipientName: body.customerName, shippingPhone: body.customerPhone, shippingAddress: body.deliveryAddress, items: [], totalAmount: 2000 };
        return { data: { success: true, data: saved } };
      } }
    };
    await evaluate(callback(prefix, 'pages/customer/ShopPage.tsx', 'checkout'), context)({ preventDefault() {} });
    assert.equal(requests.length, 1); assert.equal(receipts.at(-1).customerPhone, contact.customerPhone);
    assert.equal(events[0].payload.order.customerPhone, contact.customerPhone);
    // A subsequent server response can include a different account phone.
    const row = { ...saved, customerPhone: profile.phone, customer: profile };
    for (const role of ['customer', 'store']) {
      let orders;
      const common = { ...flow, api: { get: async path => { assert.equal(path, '/orders'); return { data: { success: true, data: [row] } }; } },
        setOrders: value => { orders = value; }, setError() {}, setIsLoading() {}, setIsRefreshing() {},
        orderRequests: { current: { generation: 0, flight: null, queued: false } },
        orderListRevision: { current: 0 }, statusUpdatesRef: { current: new Map() }, setOrdersReady() {}, setOrdersError() {}, setChartData() {}, setLoading() {}, buildChartDataFromOrders: () => [], setNewOrderAlert() {},
        toast: { error: message => assert.fail(message) }
      };
      const path = role === 'customer' ? 'pages/customer/CustomerOrdersPage.tsx' : 'pages/store/StoreDashboard.tsx';
      await evaluate(callback(prefix, path, role === 'customer' ? 'loadOrders' : 'fetchOrders'), common)();
      assert.equal(orders[0].customerPhone, contact.customerPhone); assert.equal(orders[0].customerName, contact.customerName); assert.equal(orders[0].deliveryAddress, contact.deliveryAddress);
    }
  });
  test(prefix + 'PayOS recovery uses saved recipient phone and leaves an absent response untouched', () => {
    const recoveries = [];
    const handler = evaluate(callback(prefix, 'pages/customer/ShopPage.tsx', 'recoverOrder'), { ...flow, effectiveOrderId: '17', pendingData: null, setRecoveryOrder: value => recoveries.push(value) });
    handler({ data: null }); assert.equal(recoveries.length, 0);
    handler({ data: { data: { id: '17', orderStatus: 'PENDING', paymentStatus: 'UNPAID', recipientPhone: contact.customerPhone, customerPhone: profile.phone, shippingRecipientName: contact.customerName, items: [] } } });
    assert.equal(recoveries[0].customerPhone, contact.customerPhone); assert.equal(recoveries[0].customerName, contact.customerName);
  });
  test(prefix + 'both role caches normalize saved recipient before first render', () => {
    const cached = [{ id: '17', customerPhone: profile.phone, recipientPhone: contact.customerPhone, shippingRecipientName: contact.customerName, shippingAddress: contact.deliveryAddress }];
    const storage = { getItem: () => JSON.stringify(cached) };
    for (const path of ['pages/customer/CustomerOrdersPage.tsx', 'pages/store/StoreDashboard.tsx']) {
      const orders = evaluate(callback(prefix, path, 'cachedOrders'), { ...flow, window: { localStorage: storage, sessionStorage: storage }, user: { storeId: '3' } })();
      assert.equal(orders[0].customerPhone, contact.customerPhone);
    }
  });
  test(prefix + 'shared contact view and tel link render the recipient snapshot without the buyer phone', () => {
    const path = new URL(prefix + 'components/orders/ShippingContact.tsx', import.meta.url);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const exports = {}; vm.runInNewContext(code, { exports, require: name => name.endsWith('/order-events') ? flow : name.endsWith('/delivery-location') ? location : require(name) });
    const html = renderToStaticMarkup(React.createElement(exports.ShippingContact, { order: { recipientPhone: contact.customerPhone, customerPhone: profile.phone, shippingRecipientName: contact.customerName, shippingAddress: contact.deliveryAddress } }));
    assert.ok(html.includes('tel:' + contact.customerPhone)); assert.ok(html.includes(contact.customerName)); assert.ok(html.includes(contact.deliveryAddress)); assert.ok(!html.includes(profile.phone));
  });
}
