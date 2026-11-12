import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeviceTelemetry } from '../src/services/device-runtime.ts';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const owner = { id: '11', role: 'STORE_OWNER', storeId: '5' };
const customer = { id: '22', role: 'CUSTOMER', customerProfileId: '41' };
const ok = data => ({ data: { success: true, data } });
const initial = () => ({ id: '91', buttonId: '91', deviceId: 'BTN-REAL-91', storeId: '5', customerId: null, status: 'INACTIVE', inventoryState: 'ALLOCATED_TO_STORE', products: [{ productId: '6', productName: 'Old product', price: 20000, quantity: 1 }] });
const activeSession = () => ({ sessionId: 'sess_0123456789abcdef01234567', deviceId: 'BTN-REAL-91', storeId: '5', status: 'ACTIVE', expiresAt: new Date(Date.now() + 600000).toISOString() });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function storage() { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k), m }; }
function hardware({ id = 'BTN-REAL-91', readFail = false, writeFail = false } = {}) {
  const writes = []; const server = { connected: true, async getPrimaryService(uuid) { assert.equal(uuid.toLowerCase(), '0000fff0-0000-1000-8000-00805f9b34fb'); return { async getCharacteristic(uuid) {
    if (uuid.includes('fff1')) return { readValue: async () => { if (readFail) throw Error('Identity read failed'); return new TextEncoder().encode(JSON.stringify({ deviceId: id, firmware: '1.0' })); } };
    assert.ok(uuid.includes('fff2')); return { writeValueWithResponse: async bytes => { writes.push(new TextDecoder().decode(bytes)); if (writeFail) throw Error('GATT write failed'); } };
  } }; } };
  const device = { name: 'SmartOrder-WRONG-NAME', gatt: { ...server, connect: async () => server, disconnect() { server.connected = false; } } };
  return { server, device, writes, navigator: { bluetooth: { requestDevice: async () => device } } };
}
function backend() {
  let row = initial(); const calls = []; const session = activeSession();
  const client = {
    get: async path => { calls.push({ method: 'get', path }); if (path.startsWith('/devices/')) return ok(structuredClone(row)); if (path.startsWith('/products/')) return ok({ productId: path.split('/').at(-1), storeId: '5', status: 'ACTIVE' }); if (path === '/stores/5') return ok({ storeId: '5', status: 'ACTIVE', products: [{ productId: '7', name: 'New product', status: 'ACTIVE', price: 23000 }] }); throw Error(path); },
    post: async (path, body) => { calls.push({ method: 'post', path, body });
      if (path === '/devices/lookup-code') return ok({ deviceId: row.deviceId, isClaimed: !!row.customerId, status: row.status });
      if (path === '/provisioning/session') return ok(session);
      if (path === '/provisioning/verify') return { data: { success: true, valid: true, data: session } };
      if (path.endsWith('/confirmation')) { row = { ...row, customerId: '41', status: 'ACTIVE', inventoryState: 'IN_CUSTOMER_CUSTODY', products: [...row.products, { productId: body.productId, productName: 'New product', price: 23000, quantity: 1 }] }; return ok({ ...row, productId: body.productId }); }
      if (path.endsWith('/assign-product')) { row = { ...row, products: [{ productId: body.productId, productName: 'New product', price: 23000, quantity: 1 }] }; return ok(structuredClone(row)); }
      throw Error(path);
    }
  };
  client.put = async (path, body) => { calls.push({ method: 'put', path, body }); assert.ok(path.endsWith('/customer-config')); row = { ...row, products: [{ productId: body.productId, quantity: body.quantity, productName: 'New product', price: 23000 }] }; return ok(row); };
  return { client, calls, get row() { return row; }, set row(v) { row = v; } };
}
for (const prefix of ['../src/', '../frontend/src/']) {
  const flow = await import(new URL(prefix + 'services/device-connection.ts', import.meta.url));
  const pairing = await import(new URL(prefix + 'pages/customer/device-pairing.mjs', import.meta.url));
  test(prefix + 'BLE uses GATT identity, not the advertised name or a sample id; failed writes never become success', async () => {
    const h = hardware(); const connected = await flow.connectBle(h.navigator); assert.equal(connected.info.deviceId, 'BTN-REAL-91');
    await flow.sendBleWifi(connected.server, connected.info.deviceId, 'Real network', 'pass:word');
    assert.deepEqual(h.writes, ['Real network:pass:word']);
    await assert.rejects(flow.sendBleWifi(h.server, 'ANOTHER-BUTTON', 'Real network', 'secret'), /khác nút/);
    assert.equal(h.writes.length, 1);
    await assert.rejects(flow.connectBle(hardware({ readFail: true }).navigator), /Identity read failed/);
    const failed = hardware({ writeFail: true }); await assert.rejects(flow.sendBleWifi(failed.server, 'BTN-REAL-91', 'Net', 'password'), /GATT write failed/); assert.equal(failed.writes.length, 1);
    for (const ssid of ['', 'Network:bad', 'Network\n']) await assert.rejects(flow.sendBleWifi(h.server, 'BTN-REAL-91', ssid, 'secret'));
  });
  test(prefix + 'admin-allocated device stays the same physical row through store recognition, customer claim, Wi-Fi and reload', async () => {
    const be = backend(), disk = storage(), hw = hardware();
    const connected = await flow.connectBle(hw.navigator);
    const recognised = await flow.readScopedDevice(be.client, connected.info.deviceId, owner);
    flow.rememberBleReceipt(disk, owner, recognised); flow.saveDeviceCache(disk, owner, [recognised]);
    assert.equal(recognised.inventoryState, 'ALLOCATED_TO_STORE'); assert.equal(recognised.status, 'INACTIVE');
    assert.equal(flow.hasBleReceipt(disk, owner, recognised), true); assert.equal(flow.hasBleReceipt(disk, { ...owner, id: '99' }, recognised), false);
    assert.equal(be.calls.filter(c => c.method === 'post').length, 0, 'BLE receipt never creates a replacement device or changes lifecycle status');
    await assert.rejects(flow.readScopedDevice(be.client, recognised.deviceId, { ...owner, storeId: '6' }), /không thuộc lô/);
    await assert.rejects(flow.readScopedDevice(be.client, recognised.deviceId, customer), /chưa được ghép/);
    const active = await pairing.createPairingSession(be.client, { deviceId: recognised.deviceId, token: 'real-token' });
    await pairing.confirmAtomicPairing(be.client, active, customer, { productId: '7', buttonName: 'Water button' });
    const claimed = await pairing.readOwnedPairedDevice(be.client, active.deviceId, customer, { storeId: '5', productId: '7' });
    const saved = await flow.finishPairedProduct(be.client, claimed, customer, '5', '7', 'Water button');
    assert.equal(saved.id, '91'); assert.equal(saved.deviceId, recognised.deviceId); assert.equal(saved.storeId, '5');
    assert.deepEqual(flow.deviceProductIds(saved), ['7']); assert.equal(saved.product.name, 'New product');
    assert.equal(be.calls.filter(c => c.path.endsWith('/confirmation')).length, 1);
    assert.equal(be.calls.filter(c => c.path.endsWith('/customer-config') && c.method === 'put').length, 1, 'replace the old mapping instead of ordering both products');
    const before = structuredClone(be.row); await flow.sendBleWifi(hw.server, saved.deviceId, 'Customer network', 'exact password'); assert.deepEqual(be.row, before);
    flow.saveDeviceCache(disk, customer, [saved]); assert.equal(flow.readDeviceCache(disk, customer)[0].deviceId, recognised.deviceId);
    assert.equal(flow.readDeviceCache(disk, { ...customer, customerProfileId: '42' }).length, 0);
    assert.equal((await flow.readScopedDevice(be.client, saved.deviceId, owner)).product.id, '7');
    assert.equal(be.calls.some(c => c.path === '/devices' && c.method === 'post'), false);
    assert.equal(be.calls.some(c => c.body?.password), false);
  });
  test(prefix + 'product writes require actual ownership and product store, preserve large string IDs, and verify the persisted mapping', async () => {
    const be = backend(); let sent = 0;
    const actualGet = be.client.get;
    be.client.get = async path => path.startsWith('/products/') ? ok({ productId: path.split('/').at(-1), storeId: '6', status: 'ACTIVE' }) : actualGet(path);
    await assert.rejects(flow.saveDeviceProduct(be.client, 'BTN-REAL-91', '90071992547409931', owner, 'Test', () => sent++), /không thuộc cửa hàng/); assert.equal(sent, 0);
    be.client.get = actualGet;
    await flow.saveDeviceProduct(be.client, 'BTN-REAL-91', '90071992547409931', owner, 'Test', () => sent++);
    assert.equal(be.calls.find(c => c.path.endsWith('/assign-product')).body.productId, '90071992547409931'); assert.equal(sent, 1);
    be.client.post = async () => { throw Error('Network response lost'); };
    await assert.rejects(flow.saveDeviceProduct(be.client, 'BTN-REAL-91', '7', owner, 'Test'), /Network response lost/);
  });
  test(prefix + 'pairing recovery persists IDs and confirmation boundary without tokens or Wi-Fi passwords', () => {
    const disk = storage(), session = activeSession();
    pairing.savePairingProgress(disk, customer, { deviceId: session.deviceId, session: { ...session, token: 'must-not-save', hmacSecret: 'must-not-save' }, confirmationSent: true, productId: '7', buttonName: 'Water', password: 'must-not-save' });
    const restored = pairing.readPairingProgress(disk, customer);
    assert.equal(restored.confirmationSent, true); assert.equal(restored.session.sessionId, session.sessionId);
    assert.ok(![...disk.m.values()].join('').includes('must-not-save'));
    assert.equal(pairing.readPairingProgress(disk, { ...customer, id: 'other-user' }), null);
    pairing.clearPairingProgress(disk, customer); assert.equal(pairing.readPairingProgress(disk, customer), null);
  });
  test(prefix + 'customer configuration uses backend DTO names and preserves device store/status', async () => {
    const be = backend(); be.row = { ...be.row, customerId: '41', status: 'ACTIVE' }; const puts = [];
    be.client.put = async (path, body) => { puts.push({ path, body }); be.row = { ...be.row, buttonName: body.buttonName, products: [{ productId: body.productId, quantity: body.quantity, productName: 'Water' }] }; return ok(be.row); };
    const saved = await flow.saveCustomerDeviceConfig(be.client, 'BTN-REAL-91', '7', 3, 'Water at home', customer);
    assert.deepEqual(puts[0], { path: '/devices/BTN-REAL-91/customer-config', body: { buttonName: 'Water at home', productId: '7', quantity: 3 } });
    assert.equal(saved.storeId, '5'); assert.equal(saved.status, 'ACTIVE'); assert.equal(saved.products[0].quantity, 3);
    await assert.rejects(flow.saveCustomerDeviceConfig(be.client, 'BTN-REAL-91', '7', 1.5, 'Test', customer));
    assert.equal(puts.length, 1);
    let sent = 0; await assert.rejects(flow.saveDeviceProduct(be.client, 'BTN-REAL-91', '7', owner, 'Test', () => sent++, () => false), /Trang hoặc tài khoản/); assert.equal(sent, 0);
  });
  test(prefix + 'recovery after reload reads the existing device without repeating a sent confirmation', async () => {
    const source = readFileSync(new URL(prefix + 'pages/customer/DevicePairingPage.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let effect;
    function visit(n) { if (ts.isCallExpression(n) && n.expression.getText(ast)==='useEffect' && n.arguments[0]?.getText(ast).includes('readPairingProgress')) effect = n.arguments[0].getText(ast); ts.forEachChild(n,visit); } visit(ast); assert.ok(effect);
    const disk = storage(), active = activeSession(); const be = backend(); be.row = { ...be.row, customerId: '41', status: 'ACTIVE', products: [{ productId: '7', quantity: 1 }] };
    pairing.savePairingProgress(disk, customer, { deviceId: active.deviceId, session: active, confirmationSent: true, productId: '7', buttonName: 'Water' });
    let published; let confirmation = false;
    const context = { ...pairing, ...flow, user: customer, allowed: true, sessionStorage: disk, api: be.client, URLSearchParams, location: { search: '' }, busyRef: { current: false }, sentRef: { current: false }, sessionRef: { current: null }, expected: { current: null },
      setBusy(){}, setMode(){}, setDeviceCode(){}, setSession(){}, setProductId(){}, setButtonName(){}, setConfirmationSent: v => { confirmation = v; }, setError(){}, getStore: async()=>{}, publishDevice: value => { published = value; } };
    const run = vm.runInNewContext(ts.transpileModule('const fn = ' + effect + '; fn;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
    const cleanup = run(); for(let i=0;i<35;i++) await Promise.resolve();
    assert.equal(published.deviceId, active.deviceId); assert.equal(be.calls.some(c=>c.method==='post'), false); cleanup?.();
    published = null; be.row = { ...be.row, customerId: null }; const cleanup2 = run(); for(let i=0;i<35;i++) await Promise.resolve();
    assert.equal(published, null); assert.equal(confirmation, true); assert.equal(be.calls.some(c=>c.path.endsWith('/confirmation')), false); cleanup2?.();
  });
  test(prefix + 'page loader renders devices before a slow catalog, coalesces bursts and cancels old sessions', async () => {
    const loader = flow.createDevicePageLoader(), slow = deferred(); let devices = 0, products = 0;
    const work = loader.run([async () => { devices++; }, async () => { await slow.promise; products++; }]);
    await Promise.resolve(); await Promise.resolve(); assert.equal(devices, 1); assert.equal(products, 0);
    for (let i=0;i<20;i++) loader.run([async () => { devices++; }]);
    slow.resolve(); await work; assert.equal(devices, 2); assert.equal(products, 1);
    loader.dispose(); await loader.run([async () => { devices++; }]); assert.equal(devices, 2);
  });
  test(prefix + 'actual store/customer page loaders publish devices without waiting for orders or catalog', async () => {
    for (const [page, who] of [['store/StoreDevicesPage', owner], ['customer/CustomerHomePage', customer]]) {
      const source = readFileSync(new URL(prefix + 'pages/' + page + '.tsx', import.meta.url), 'utf8');
      const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let handler;
      function visit(n) { if(ts.isVariableDeclaration(n) && n.name.getText(ast)==='fetchData') handler=n.initializer.getText(ast); ts.forEachChild(n,visit); } visit(ast);
      const slow = deferred(), disk = storage(); let rows, loading = true;
      const row = { ...initial(), customerId: who.role === 'CUSTOMER' ? '41' : null };
      const context = { ...flow, user: who, apiSessionMarker: () => 'session', deviceLoader: { current: flow.createDevicePageLoader() }, dataFailures: { current: new Set() }, productsLoaded: { current: false }, deviceRevision: { current: 0 }, deviceTelemetry: { current: createDeviceTelemetry() },
        api: { get: async path => path === '/devices' ? ok([row]) : slow.promise }, sessionStorage: disk,
        setDevices: value => { rows = value; }, setHomeDevicesReady() {}, setDevicesReady() {}, setHomeDataError() {}, setLoadError() {}, setLoading: v => { loading = v; },
        setProducts() {}, setAvailableProducts() {}, setOrders() {}, setOrderListReady() {}, setOrdersLoading() {}, setActiveCancelOrder() {}, setActiveSuccessOrder() {}, normalizeOrder: v => v, mergeOrderUpdate: (a,b) => ({...a,...b}), setSecondsRemaining() {}
      };
      const fn = vm.runInNewContext(ts.transpileModule('const fn = ' + handler + '; fn;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, context);
      const work = fn(); for(let i=0;i<12;i++) await Promise.resolve();
      assert.equal(rows[0].deviceId, row.deviceId); assert.equal(rows[0].product.id, '6'); assert.equal(loading, false);
      slow.resolve(ok([])); await work;
      const stale = deferred(); let deviceReads = 0;
      const fresh = { ...row, products: [{ productId: '7', productName: 'New product', quantity: 1 }] };
      context.api.get = async path => path === '/devices' ? (++deviceReads === 1 ? stale.promise : ok([fresh])) : ok([]);
      const old = fn(); for (let i=0;i<5;i++) await Promise.resolve();
      context.deviceRevision.current++; rows = [flow.normalizeDevice(fresh)]; let emptySeen = false; context.setDevices = value => { if (!value.length) emptySeen = true; rows = value; }; const next = fn();
      stale.resolve(ok([])); await Promise.all([old,next]);
      assert.equal(rows.length,1); assert.equal(rows[0].deviceId,fresh.deviceId); assert.equal(rows[0].product.id,'7'); assert.equal(emptySeen, false);
    }
  });
}
