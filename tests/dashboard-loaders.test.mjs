import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');

function callback(prefix, page, name, context) {
  const text = readFileSync(new URL(`${prefix}pages/${page}.tsx`, import.meta.url), 'utf8');
  const ast = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      expression = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(ast) : node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression);
  return vm.runInNewContext(ts.transpileModule(`(${expression})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}failed product reads keep inventory counters; stale requests cannot publish errors`, async () => {
    const request = { current: 0 }; let products = [{ stock: 12 }], error = '', ready = true;
    const slow = deferred();
    const context = {
      productRequest: request, api: { get: () => slow.promise },
      setProducts: value => { products = value; }, setProductsReady: value => { ready = value; },
      setProductsError: value => { error = value; }, setLoading() {}, toast: { error() {} },
    };
    const fetch = callback(prefix, 'store/StoreProductsPage', 'fetchProducts', context);
    const work = fetch(); slow.resolve({ data: { success: false } }); await work;
    assert.equal(products[0].stock, 12); assert.equal(ready, true); assert.match(error, /Chưa cập nhật/);
    error = ''; const stale = deferred(); context.api.get = () => stale.promise;
    const old = fetch(); request.current++;
    stale.resolve({ data: { success: false } }); await old;
    assert.equal(error, ''); assert.equal(products[0].stock, 12);
  });

  test(`${prefix}wallet recovery refresh updates actual balance without overwriting an existing error`, async () => {
    const edits = []; let wallet;
    const context = {
      refreshRequest: { current: 0 }, mounted: { current: true }, storeId: null, user: { role: 'STORE_OWNER' }, canManageBanks: true, transactionPage: 1, withdrawalPage: 1,
      setRecipient() {}, setAccountsError() {},
      setRefreshing() {}, setWalletReady() {}, setLoadedAt() {}, setTransactionPagination() {}, setWithdrawalPagination() {},
      walletService: {
        getWallet: async () => ({ data: { availableBalance: '500000', pendingBalance: '0', bankAccount: { bankBin: '970436', accountNumber: 'new-server-number', accountHolderName: 'Server name' } } }),
        getTransactions: async () => ({ data: [] }), getWithdrawals: async () => ({ data: [] }),
      },
      api: { get: async () => ({ data: { data: [{ bin: '970436' }] } }) },
      setWallet: value => { wallet = value; }, setTransactions() {}, setWithdrawals() {}, setBanks() {}, setHistoryWarning() {}, setLoading() {},
      setError: value => edits.push(value), setSelectedBank: value => edits.push(value), setAccountNumber: value => edits.push(value), setAccountHolderName: value => edits.push(value), setIsEditingBank: value => edits.push(value),
    };
    await callback(prefix, 'store/StoreWalletPage', 'refresh', context)(false);
    assert.equal(wallet.availableBalance, '500000'); assert.equal(wallet.pendingBalance, '0'); assert.deepEqual(edits, []);
  });

  test(`${prefix}reports publish order metrics even when device or product APIs fail`, async () => {
    const state = { ready: { orders: false, devices: false, products: false } };
    const context = {
      analyticsFlight: { current: null }, analyticsGeneration: { current: 0 }, apiSessionMarker: () => 'session',
      api: { get: async path => { if (path !== '/orders') throw new Error('403'); return { data: { success: true, data: [{ id: '1', status: 'DELIVERED', totalAmount: '500000' }] } }; } },
      normalizeOrder: value => value,
      setOrders: value => { state.orders = value; }, setDevices: value => { state.devices = value; }, setProducts: value => { state.products = value; },
      setAnalyticsReady: fn => { state.ready = fn(state.ready); }, setAnalyticsError: value => { state.error = value; }, setLoading() {}, setRefreshing() {},
    };
    const fetch = callback(prefix, 'store/StoreAnalyticsPage', 'fetchData', context);
    await Promise.all([fetch(), fetch()]);
    assert.equal(state.orders[0].status, 'DELIVERED'); assert.equal(state.ready.orders, true);
    assert.equal(state.ready.devices, false); assert.equal(state.devices, undefined); assert.match(state.error, /Chưa cập nhật đủ/);
  });
}
