import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readDeliveryLocation } from '../src/services/delivery-location.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/services/goong-maps.ts', import.meta.url), 'utf8');
function service(sdk) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, require: () => ({ readDeliveryLocation }), URLSearchParams, AbortSignal,
    window: { goongjs: sdk },
  });
  return exports;
}

test('Goong geocoding uses V2 and translates numeric coordinates into map positions', async () => {
  const { geocodeGoong } = service();
  let url;
  const response = await geocodeGoong('test-rest-key', { address: '91 Trung Kính, Hà Nội' }, async (request) => {
    url = new URL(request);
    return { ok: true, json: async () => ({ status: 'OK', results: [{ formatted_address: '91 Trung Kính, Hà Nội', geometry: { location: { lat: 21.0136, lng: 105.7982 } } }] }) };
  });
  assert.equal(url.pathname, '/v2/geocode');
  assert.equal(url.searchParams.get('address'), '91 Trung Kính, Hà Nội');
  assert.equal(response.results[0].geometry.location.lat(), 21.0136);
});

test('autocomplete and place detail use Goong V2 and return the label/address shown in the picker', async () => {
  const { suggestGoongAddresses, getGoongPlace } = service();
  const results = await suggestGoongAddresses('test', 'Vinhomes quan 9', async url => {
    assert.equal(new URL(url).pathname, '/v2/place/autocomplete');
    assert.equal(new URL(url).searchParams.get('input'), 'Vinhomes quan 9');
    return { ok: true, json: async () => ({ status: 'OK', predictions: [{ place_id: '1', description: 'VinHomes Quận 9, Long Bình, Hồ Chí Minh', structured_formatting: { main_text: 'VinHomes Quận 9', secondary_text: 'Long Bình, Hồ Chí Minh' } }] }) };
  });
  assert.equal(results[0].title, 'VinHomes Quận 9');
  assert.equal(results[0].detail, 'Long Bình, Hồ Chí Minh');
  const selected = await getGoongPlace('test', results[0].id, async url => {
    assert.equal(new URL(url).pathname, '/v2/place/detail');
    assert.equal(new URL(url).searchParams.get('place_id'), '1');
    return { ok: true, json: async () => ({ status: 'OK', result: { formatted_address: results[0].description, geometry: { location: { lat: 10, lng: 106 } } } }) };
  });
  assert.equal(selected.address, results[0].description);
  assert.equal(selected.point.lng, 106);
  await assert.rejects(() => getGoongPlace('test', 'bad', async () => ({ ok: true, json: async () => ({ status: 'OK', result: {} }) })));
});

test('reverse lookup keeps latitude/longitude order and handles no result, invalid points and API failures', async () => {
  const { geocodeGoong } = service();
  await geocodeGoong('test', { location: { lat: 10, lng: 106 } }, async (url) => {
    assert.equal(new URL(url).searchParams.get('latlng'), '10,106');
    return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
  });
  const invalid = await geocodeGoong('test', { address: 'test' }, async () => ({ ok: true, json: async () => ({ status: 'OK', results: [{ formatted_address: 'Bad', geometry: { location: { lat: 91, lng: 106 } } }] }) }));
  assert.equal(invalid.results.length, 0);
  await assert.rejects(() => geocodeGoong('test', { address: 'test' }, async () => ({ ok: false })));
  await assert.rejects(() => geocodeGoong('test', { address: 'test' }, async () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) })));
});

test('REST-only configuration renders an attributed OSM base; a Map Tiles key selects Goong tiles', async () => {
  const options = [];
  const sdk = { Map: class { constructor(config) { options.push(config); } }, Marker: class {} };
  const { loadGoongMaps } = service(sdk);
  const restOnly = await loadGoongMaps('rest-key');
  new restOnly.Map({}, { center: { lat: 10, lng: 106 }, zoom: 14 });
  assert.equal(options[0].style.sources.osm.tiles[0], 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.match(options[0].style.sources.osm.attribution, /OpenStreetMap/);
  const goongTiles = await loadGoongMaps('rest-key', 'tiles-key');
  new goongTiles.Map({}, { center: { lat: 10, lng: 106 }, zoom: 14 });
  assert.equal(options[1].style, 'https://tiles.goong.io/assets/goong_map_web.json');
  assert.equal(options[1].accessToken, 'tiles-key');
});

test('checkout map changes never add unsupported coordinate fields to the backend request', () => {
  for (const path of ['../src/pages/customer/ShopPage.tsx', '../../src/pages/customer/ShopPage.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const payload = source.slice(source.indexOf("api.post('/storefront/orders'"), source.indexOf("'x-idempotency-key'"));
    assert.doesNotMatch(payload, /shippingLatitude|shippingLongitude|deliveryLocation/);
    assert.match(source, /<DeliveryAddressMap/);
  }
});

test('selecting a distant address updates the native map camera and pin to the same point in one operation', async () => {
  let center = [106.7009, 10.7769], zoom = 14, markerPoint, resized = 0;
  const sdk = {
    Map: class {
      resize() { resized++; }
      jumpTo(options) { center = options.center; zoom = options.zoom; }
      // Reproduce the SDK behavior: zoom interrupts a pending pan animation.
      panTo() {}
      setZoom(value) { zoom = value; }
    },
    Marker: class { setLngLat(point) { markerPoint = point; return this; } addTo() { return this; } remove() {} },
  };
  const maps = await service(sdk).loadGoongMaps('rest-key', 'tiles-key');
  const map = new maps.Map({}, { center: { lat: 10.7769, lng: 106.7009 }, zoom: 14 });
  const marker = new maps.marker.AdvancedMarkerElement({ map, position: null });
  for (const point of [{ lat: 10.8376371, lng: 106.831874 }, { lat: 21.0136, lng: 105.7982 }]) {
    marker.position = point;
    map.focusOn(point, 17);
    assert.equal(center[0], point.lng);
    assert.equal(center[1], point.lat);
    assert.equal(markerPoint[0], center[0]);
    assert.equal(markerPoint[1], center[1]);
    assert.equal(zoom, 17);
  }
  assert.equal(resized, 2);
});
