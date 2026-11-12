import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const now = Date.parse('2026-11-11T12:00:00Z');
const healthy = { deviceId: 'BTN-1', status: 'ACTIVE', canOrder: true, customerId: '41', storeId: '5', products: [{ productId: '7' }], lastSeenAt: new Date(now - 1000).toISOString() };
for (const base of ['../src/', '../frontend/src/']) {
  const flow = await import(base + 'services/device-runtime.ts');
  test(base + 'only activated, configured and permitted devices with fresh heartbeat are running', () => {
    assert.equal(flow.deviceRuntime(healthy, now).running, true);
    for (const status of ['MANUFACTURED', 'UNCLAIMED', 'CLAIMED', 'ASSIGNED', 'READY_FOR_CUSTOMER', 'DISABLED', 'EXPIRED', 'ONLINE', undefined]) {
      const state = flow.deviceRuntime({ ...healthy, status }, now);
      assert.equal(state.running, false, status);
      assert.equal(state.canOrder, false, status);
    }
    for (const overrides of [{ customerId: null }, { storeId: null }, { products: [] }, { canOrder: false }, { canOrder: undefined }, { inventoryState: 'RETURN_IN_TRANSIT' }, { rentalStatus: 'EXPIRED' }, { rental: { effectiveExpiresAt: new Date(now).toISOString() } }]) {
      assert.equal(flow.deviceRuntime({ ...healthy, ...overrides }, now).running, false, JSON.stringify(overrides));
      assert.equal(flow.deviceRuntime({ ...healthy, ...overrides }, now).canOrder, false);
    }
    assert.match(flow.deviceRuntime({ ...healthy, canOrder: false, canOrderReason: 'Hợp đồng đã hết hạn' }, now).hint, /Hợp đồng đã hết hạn/);
  });
  test(base + 'no heartbeat, stale, invalid or future timestamp cannot imply Internet connectivity', () => {
    for (const time of [undefined, null, '', 'bad date', new Date(now - flow.DEVICE_HEARTBEAT_TTL_MS).toISOString(), new Date(now + 1).toISOString()]) {
      const state = flow.deviceRuntime({ ...healthy, lastSeenAt: time }, now);
      assert.equal(state.running, false);
      // Manual web orders keep server permission; they do not prove hardware connectivity.
      assert.equal(state.canOrder, true);
      assert.equal(state.label, 'Chờ kết nối');
    }
    assert.equal(flow.deviceRuntime(healthy, now + flow.DEVICE_HEARTBEAT_TTL_MS).running, false);
    assert.equal(flow.deviceRuntime({ ...healthy, lastSeenAt: null, updatedAt: new Date(now).toISOString(), bluetoothConnected: true, wifiConfigured: true }, now).running, false);
  });
  test(base + 'heartbeat survives REST refresh without overwriting new permissions, store, or product mapping', () => {
    const readings = flow.createDeviceTelemetry();
    readings.record({ ...healthy, status: 'ACTIVE', canOrder: true, storeId: 'evil', batteryLevel: 78, wifiRSSI: -62 }, now);
    const row = { ...healthy, status: 'DISABLED', canOrder: false, lastSeenAt: undefined, products: [{ productId: '8' }] };
    const merged = readings.merge([row])[0];
    assert.equal(merged.lastSeenAt, healthy.lastSeenAt);
    assert.equal(merged.batteryLevel, 78);
    assert.equal(merged.storeId, '5'); assert.equal(merged.status, 'DISABLED');
    assert.deepEqual(merged.products, [{ productId: '8' }]);
    assert.equal(flow.deviceRuntime(merged, now).running, false);
    assert.equal(readings.merge([{ deviceId: 'BTN-2' }])[0].lastSeenAt, undefined);
    assert.deepEqual(readings.merge([]), []);
  });
  test(base + 'invalid or older heartbeat cannot refresh liveness; newer server reading wins', () => {
    const readings = flow.createDeviceTelemetry();
    readings.record({ deviceId: healthy.deviceId, lastSeenAt: 'invalid' }, now);
    readings.record({ deviceId: healthy.deviceId, lastSeenAt: new Date(now + 1).toISOString() }, now);
    assert.equal(readings.merge([{ deviceId: healthy.deviceId }])[0].lastSeenAt, undefined);
    readings.record(healthy, now);
    readings.record({ ...healthy, lastSeenAt: new Date(now - 2000).toISOString(), batteryLevel: 10 }, now);
    assert.equal(readings.merge([{ deviceId: healthy.deviceId }])[0].lastSeenAt, healthy.lastSeenAt);
    const newer = { ...healthy, lastSeenAt: new Date(now).toISOString(), batteryLevel: 90 };
    assert.deepEqual(readings.merge([newer])[0], newer);
  });
  test(base + 'actual customer card renders honest state, compact errors, and keeps Wi-Fi configuration accessible', () => {
    const source = readFileSync(new URL(base + 'pages/customer/CustomerHomePage.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let initializer;
    const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'DeviceCardUI') initializer = node.initializer.getText(ast); ts.forEachChild(node, visit); };
    visit(ast); assert.ok(initializer);
    const jsx = (type, props) => ({ type, props });
    const icons = new Proxy({}, { get: (_, key) => String(key) });
    const context = { exports: {}, React: { useState: () => [false, () => {}] }, motion: icons, AnimatePresence: 'AnimatePresence', ...Object.fromEntries(['Settings','Radio','Battery','ShoppingBag','Wifi','Clock'].map(key => [key, key])), require: () => ({ jsx, jsxs: jsx }) };
    const card = vm.runInNewContext(ts.transpileModule('const card = ' + initializer + '; card;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
    const walk = node => node && typeof node === 'object' ? [node, ...[node.props?.children].flat(Infinity).flatMap(walk)] : [];
    const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(text).join('');
    for (const device of [healthy, { ...healthy, status: 'UNCLAIMED' }, { ...healthy, canOrder: false }, { ...healthy, lastSeenAt: null }]) {
      const runtime = flow.deviceRuntime(device, now);
      const tree = card({ dev: device, name: 'Nút nước', runtime, error: 'Không gửi được yêu cầu', battery: null, rssi: null });
      assert.ok(text(tree).includes(runtime.label));
      const nodes = walk(tree);
      assert.equal(nodes.find(node => node.props?.title?.startsWith?.('Đặt trên web') || node.props?.onClick?.toString().includes('onOrder')).props.disabled, !runtime.canOrder);
      const error = nodes.find(node => node.props?.role === 'alert');
      assert.ok(error.props.className.includes('text-xs')); assert.equal(text(error), 'Không gửi được yêu cầu');
      assert.ok(nodes.some(node => node.props?.title === 'Cài đặt thiết bị'));
    }
  });
  test(base + 'actual order/test handlers block unactivated nodes and report request failures inline', async () => {
    for (const [page, names] of [['customer/CustomerHomePage', ['handleQuickReorder', 'handleSimulatePress']], ['store/StoreDevicesPage', ['handleSimulatePress']]]) {
      const source = readFileSync(new URL(base + 'pages/' + page + '.tsx', import.meta.url), 'utf8');
      const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const initializers = {};
      const visit = node => { if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) initializers[node.name.getText(ast)] = node.initializer.getText(ast); ts.forEachChild(node, visit); };
      visit(ast);
      for (const name of names) {
        let errors = {}, requests = 0;
        const context = { devices: [{ ...healthy, status: 'UNCLAIMED' }], deviceRuntime: flow.deviceRuntime, setDeviceErrors: update => { errors = update(errors); }, setSimulatingDeviceId() {}, api: { post: async () => { requests++; return { data: { success: false, message: 'Thiết bị bị khóa' } }; } } };
        const handler = vm.runInNewContext(ts.transpileModule('const handler = ' + initializers[name] + '; handler;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
        await handler(healthy.deviceId); assert.equal(requests, 0); assert.ok(errors[healthy.deviceId]);
        context.devices = [healthy]; await handler(healthy.deviceId);
        assert.equal(requests, 1); assert.equal(errors[healthy.deviceId], 'Thiết bị bị khóa');
        context.api.post = async () => { throw { response: { data: { message: 'Mạng chưa sẵn sàng' } } }; };
        await handler(healthy.deviceId); assert.equal(errors[healthy.deviceId], 'Mạng chưa sẵn sàng');
      }
    }
  });
}
