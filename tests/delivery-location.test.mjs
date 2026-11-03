import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readDeliveryLocation, deliveryMapUrl } from '../src/services/delivery-location.ts';
import { normalizeOrder, normalizeOrderEvent, mergeOrderUpdate } from '../src/services/order-events.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/orders/DeliveryAddressMap.tsx', import.meta.url), 'utf8').replaceAll('import.meta.env.VITE_GOONG_API_KEY', 'testKey').replaceAll('import.meta.env.VITE_GOONG_MAPTILES_KEY', 'undefined');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const result = (address, lat, lng) => ({ results: [{ formatted_address: address, geometry: { location: { lat: () => lat, lng: () => lng } } }] });

// Run the actual component effects with a controlled Maps SDK and clock.
function harness(key = 'test-key') {
  const slots = [], timers = new Map(), handlers = new Map(), requests = [], selected = [], searches = [], details = [], focused = [];
  let buttons = [];
  let cursor = 0, pending = [], dirty = true, listener, errorListener, marker, removed = false, timerId = 0, message = '';
  const props = { address: '', location: null, onSelect(address, location) { selected.push({ address, location }); props.address = address; props.location = location; dirty = true; } };
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, value => { slots[i].value = value; dirty = true; }]; },
    useEffect(fn, deps) { const i = cursor++; const old = slots[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) { slots[i] = { deps, cleanup: old?.cleanup }; pending.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const maps = {
    Map: class { focusOn(point, zoom) { focused.push({ lat: point.lat, lng: point.lng, zoom }); } addListener(name, fn) { if (name === "click") listener = fn; else errorListener = fn; return { remove() { removed = true; } }; } remove() { removed = true; } },
    marker: { AdvancedMarkerElement: class { constructor(options) { Object.assign(this, options); marker = this; } } },
    Geocoder: class { geocode(request) { const job = deferred(); requests.push({ request, ...job }); return job.promise; } },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, testKey: key,
    require(name) { if (name === 'react') return react; if (name === 'lucide-react') return { MapPin: 'icon' }; if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }; if (name.includes('goong-maps')) return {
      loadGoongMaps: async () => maps,
      suggestGoongAddresses: (key, input) => { const job = deferred(); searches.push({ input, ...job }); return job.promise; },
      getGoongPlace: (key, id) => { const job = deferred(); details.push({ id, ...job }); return job.promise; },
    }; throw new Error(name); },
    window: { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, addEventListener(name, fn) { handlers.set(name, fn); }, removeEventListener(name) { handlers.delete(name); } },
  });
  const visit = tree => { if (!tree || typeof tree !== 'object') return; if (tree.props?.ref) tree.props.ref.current = {}; if (tree.type === 'button') buttons.push(tree); if (tree.props?.role === 'status') message = tree.props.children; const children = tree.props?.children; (Array.isArray(children) ? children : [children]).flat().forEach(visit); };
  async function flush() { for (let i = 0; i < 8; i++) { if (dirty) { dirty = false; cursor = 0; buttons = []; visit(exports.DeliveryAddressMap(props)); const jobs = pending; pending = []; jobs.forEach(fn => fn()); } await Promise.resolve(); } }
  return {
    props, requests, selected, searches, details, focused, flush,
    get buttons() { return buttons; },
    pick(index) { return buttons[index].props.onClick(); },
    get marker() { return marker; }, get message() { return message; }, get removed() { return removed; },
    async input(address) { props.address = address; props.location = null; dirty = true; await flush(); },
    async timers() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); await flush(); },
    click(lat, lng) { return listener({ latLng: { lat: () => lat, lng: () => lng } }); },
    async authFailure() { errorListener({}); await flush(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('typing previews the address and preserves apartment details in the checkout value', async () => {
  const app = harness(); await app.flush();
  await app.input('Căn 203, 12 Đường Kiểm Thử, TP Hồ Chí Minh');
  await app.timers();
  assert.equal(app.requests.length, 1);
  app.requests[0].resolve(result('Google formatted address', 10, 106)); await app.flush();
  assert.equal(app.props.address, 'Căn 203, 12 Đường Kiểm Thử, TP Hồ Chí Minh');
  assert.equal(app.props.location.lat, 10);
  assert.equal(app.marker.position.lng, 106);
});

test('typing shows place suggestions; choosing one fills the address and exact place coordinates', async () => {
  const app = harness(); await app.flush();
  await app.input('Vinhomes quan 9'); await app.timers();
  assert.equal(app.searches[0].input, 'Vinhomes quan 9');
  app.searches[0].resolve([{ id: 'place-1', title: 'VinHomes Quận 9', detail: 'Long Bình, Hồ Chí Minh', description: 'VinHomes Quận 9, Long Bình, Hồ Chí Minh' }]);
  await app.flush(); assert.equal(app.buttons.length, 1);
  const selection = app.pick(0);
  assert.equal(app.details[0].id, 'place-1');
  app.details[0].resolve({ address: 'VinHomes Quận 9, Long Bình, Hồ Chí Minh', point: { lat: 10.8376371, lng: 106.831874 } });
  await selection; await app.flush();
  assert.equal(app.props.address, 'VinHomes Quận 9, Long Bình, Hồ Chí Minh');
  assert.equal(app.marker.position.lat, 10.8376371);
  assert.deepEqual(app.focused.at(-1), { lat: 10.8376371, lng: 106.831874, zoom: 17 });
  assert.equal(app.buttons.length, 0);
  // An older automatic preview must not move a selected place pin.
  app.requests[0].resolve(result('Old preview', 20, 100)); await app.flush();
  assert.equal(app.marker.position.lat, 10.8376371);
});

test('late autocomplete results cannot replace suggestions for newer input', async () => {
  const app = harness(); await app.flush();
  await app.input('Vinhomes'); await app.timers();
  await app.input('Vinhomes quan 9'); await app.timers();
  app.searches[1].resolve([{ id: 'new', title: 'New match', detail: 'New address' }]); await app.flush();
  app.searches[0].resolve([{ id: 'old', title: 'Old match', detail: 'Old address' }]); await app.flush();
  const selected = app.pick(0); assert.equal(app.details[0].id, 'new');
  app.details[0].resolve({ address: 'New match, Long Bình, Hồ Chí Minh', point: { lat: 10, lng: 106 } }); await selected; await app.flush();
  assert.match(app.props.address, /^New match/);
});

test('editing invalidates an old pin; stale geocode responses cannot overwrite the newest address', async () => {
  const app = harness(); await app.flush();
  await app.input('12 First Test Street'); await app.timers();
  await app.input('34 Second Test Street'); await app.timers();
  app.requests[1].resolve(result('Second', 20, 107)); await app.flush();
  app.requests[0].resolve(result('First', 10, 106)); await app.flush();
  assert.equal(app.props.location.lat, 20);
  assert.equal(app.props.address, '34 Second Test Street');
  await app.input('56 Third Test Street');
  assert.equal(app.marker.position, null);
});

test('map click reverse-geocodes the address and keeps the exact clicked point', async () => {
  const app = harness(); await app.flush();
  const click = app.click(10.123456, 106.123456);
  app.requests[0].resolve(result('12 Đường Kiểm Thử, TP Hồ Chí Minh', 10.1, 106.1));
  await click; await app.flush();
  assert.equal(app.props.address, '12 Đường Kiểm Thử, TP Hồ Chí Minh');
  assert.equal(app.marker.position.lat, 10.123456);
  assert.equal(app.marker.position.lng, 106.123456);
});

test('a later click wins even when an earlier reverse-geocode finishes last', async () => {
  const app = harness(); await app.flush();
  const first = app.click(10, 106), second = app.click(11, 107);
  app.requests[1].resolve(result('Second address', 11, 107)); await second; await app.flush();
  app.requests[0].resolve(result('First address', 10, 106)); await first; await app.flush();
  assert.equal(app.props.address, 'Second address');
});

test('geocoding failure leaves manual checkout usable, with no invented coordinates', async () => {
  const app = harness(); await app.flush();
  await app.input('12 Đường Kiểm Thử, TP Hồ Chí Minh'); await app.timers();
  app.requests[0].reject(new Error('REQUEST_DENIED')); await app.flush();
  assert.equal(app.props.location, null);
  assert.match(app.message, /Chưa xác định/);
});

test('unmount removes map listeners and ignores late responses', async () => {
  const app = harness(); await app.flush();
  const click = app.click(10, 106); app.unmount();
  app.requests[0].resolve(result('Late address', 10, 106)); await click;
  assert.equal(app.selected.length, 0);
  assert.equal(app.removed, true);
  assert.equal(app.marker.map, null);
});

test('missing key and map load failure show a usable manual-entry fallback', async () => {
  const missing = harness(''); await missing.flush(); assert.match(missing.message, /Chưa cấu hình/);
  const invalid = harness(); await invalid.flush(); await invalid.authFailure(); assert.match(invalid.message, /Không tải được/);
});

test('a tile error does not leave a correctly selected address pinned outside the map viewport', async () => {
  const app = harness(); await app.flush(); await app.authFailure();
  await app.input('Vinhomes Grand Park'); await app.timers();
  app.searches[0].resolve([{ id: 'grand-park', title: 'Vinhomes Grand Park', detail: 'Long Bình' }]); await app.flush();
  const select = app.pick(0);
  app.details[0].resolve({ address: 'Vinhomes Grand Park, Long Bình, Hồ Chí Minh', point: { lat: 10.8376, lng: 106.8318 } });
  await select; await app.flush();
  assert.equal(app.marker.position.lat, 10.8376);
  assert.deepEqual(app.focused.at(-1), { lat: 10.8376, lng: 106.8318, zoom: 17 });
});

test('API and socket order normalization share coordinates; partial updates preserve the pin', () => {
  const order = normalizeOrder({ id: '1', shippingAddress: 'Test address', shipping_latitude: '0', shipping_longitude: '106.7' });
  assert.equal(order.shippingLatitude, 0);
  assert.equal(normalizeOrderEvent({ order }).order.shippingLongitude, 106.7);
  const updated = mergeOrderUpdate(order, { status: 'CONFIRMED', shippingLatitude: null, shippingLongitude: null });
  assert.equal(updated.shippingLatitude, 0);
  assert.equal(updated.shippingLongitude, 106.7);
  assert.equal(mergeOrderUpdate(updated, { deliveryAddress: 'Different address' }).shippingLatitude, null);
});

test('Map links prefer the saved point and validate ranges without treating zero as missing', () => {
  assert.deepEqual(readDeliveryLocation(0, 0), { lat: 0, lng: 0 });
  for (const pair of [[null, 106], ['', ''], [91, 106], [10, -181], [NaN, 106]]) assert.equal(readDeliveryLocation(...pair), null);
  assert.equal(new URL(deliveryMapUrl({ deliveryAddress: 'Test', shippingLatitude: 0, shippingLongitude: 106 })).searchParams.get('query'), '0,106');
  assert.equal(new URL(deliveryMapUrl({ deliveryAddress: '12 Đường A, TP Hồ Chí Minh' })).searchParams.get('query'), '12 Đường A, TP Hồ Chí Minh');
});
