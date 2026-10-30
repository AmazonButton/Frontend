import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript');

function pageCallback(path, name, context) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) callback = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(callback, `${name} exists in the actual page`);
  return vm.runInNewContext(ts.transpileModule(`const callback = ${callback}; callback;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
}

test('owner submit notifies the homepage only after a successful save and refreshes the owner list', async () => {
  for (const fails of [false, true]) {
    let notified = 0;
    let refreshed = 0;
    let closed = false;
    const context = {
      submitLoading: false, imageUploading: false, imageUrl: '', name: ' Water ', brand: ' Brand ', sku: ' water ',
      category: 'Water', unit: 'Bottle', price: '68000', stock: '0',
      api: { post: async (url, body) => {
        assert.equal(url, '/products');
        assert.equal(body.stock, 0);
        assert.equal(body.name, 'Water');
        assert.equal(body.sku, 'WATER');
        if (fails) throw new Error('save failed');
        return { data: { success: true } };
      } },
      notifyCatalogChanged: () => notified++, fetchProducts: async () => refreshed++,
      setShowAddModal: value => { closed = !value; }, resetAddForm() {}, setSearchQuery() {}, setCategoryFilter() {},
      setSubmitLoading() {}, toast: { success() {} }, alert() {},
    };
    const submit = pageCallback('../src/pages/store/StoreProductsPage.tsx', 'handleCreateProduct', context);
    await submit({ preventDefault() {} });
    assert.equal(notified, fails ? 0 : 1);
    assert.equal(refreshed, fails ? 0 : 1);
    assert.equal(closed, !fails);
  }
});

test('a late homepage response cannot hide the newly created product', async () => {
  const pending = [];
  let products = [];
  const fetch = pageCallback('../src/pages/LandingPage.tsx', 'fetchStorefrontProducts', {
    catalogRequest: { current: 0 },
    api: { get: () => new Promise(resolve => pending.push(resolve)) },
    setStorefrontProducts: value => { products = value; }, setProductsLoading() {},
  });
  fetch();
  fetch();
  pending[1]({ data: { data: [{ id: 'new', category: 'Water' }] } });
  await new Promise(resolve => setImmediate(resolve));
  pending[0]({ data: { data: [] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(products[0].id, 'new');
});

test('catalog refreshes on create, reconnect, local write, other tab, focus; cleans up on unmount', () => {
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  let poll;
  let cleared = false;
  window.setInterval = fn => { poll = fn; return 1; };
  window.clearInterval = () => { cleared = true; };
  let key;
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../src/services/catalog-sync.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, window, document, Event, localStorage: { setItem: k => { key = k; } } });
  const socket = new EventEmitter();
  let connected = false;
  socket.connect = () => { connected = true; };
  let refreshes = 0;
  const stop = module.exports.subscribeCatalogChanges(socket, () => refreshes++);
  assert.ok(connected, 'restore the public socket after logout');
  socket.emit('PRODUCT_CREATED');
  socket.emit('connect');
  module.exports.notifyCatalogChanged();
  const storage = new Event('storage');
  storage.key = key;
  window.dispatchEvent(storage);
  window.dispatchEvent(new Event('focus'));
  poll();
  assert.equal(refreshes, 6);
  document.visibilityState = 'hidden';
  poll();
  assert.equal(refreshes, 6);
  stop();
  assert.ok(cleared);
  socket.emit('PRODUCT_CREATED');
  module.exports.notifyCatalogChanged();
  assert.equal(refreshes, 6);
});
