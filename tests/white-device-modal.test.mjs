import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('WhiteDeviceAirPodsModal defines WIFI_CONFIG step and handles Wi-Fi deployment', () => {
  const filePath = path.resolve('frontend/src/components/devices/WhiteDeviceAirPodsModal.tsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify step type includes WIFI_CONFIG
  assert.match(
    content,
    /'WIFI_CONFIG'/,
    'Modal step type must include WIFI_CONFIG'
  );

  // Verify Wi-Fi state exists
  assert.match(content, /const \[ssid, setSsid\] = useState/, 'Must manage SSID state');
  assert.match(content, /const \[wifiPassword, setWifiPassword\] = useState/, 'Must manage Wi-Fi password state');

  // Verify BLE command WIFI:ten_wifi:mat_khau is prepared
  assert.match(content, /WIFI:\$\{ssid\.trim\(\)\}:\$\{wifiPassword\}/, 'Must format Bluetooth command as WIFI:ssid:pass');

  // Verify step === 'WIFI_CONFIG' UI block exists
  assert.match(content, /step === 'WIFI_CONFIG'/, 'Must render Wi-Fi config UI block');
});

test('WhiteDeviceAirPodsModal dynamically fetches catalog from API and defaults to Tất cả', () => {
  const filePath = path.resolve('frontend/src/components/devices/WhiteDeviceAirPodsModal.tsx');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify API call to /products
  assert.match(content, /api\.get\('\/products'\)/, 'Must call api.get("/products") to fetch live products');

  // Verify fallback to storefront catalog
  assert.match(
    content,
    /api\.get\('\/products\/storefront\/catalog'\)/,
    'Must fall back to /products/storefront/catalog'
  );

  // Verify default category is Tất cả so products are not hidden
  assert.match(
    content,
    /selectedCategory.*'Tất cả'/,
    'Default category must be Tất cả so products are immediately visible'
  );

  // Verify loading state indicator
  assert.match(content, /isLoadingCatalog/, 'Must have loading state indicator');
});
