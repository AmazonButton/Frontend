import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// Check the actual production graph, including transitive imports. No app/API is run.
const result = await build({
  root: fileURLToPath(new URL('../', import.meta.url)),
  logLevel: 'silent',
  build: { write: false },
});
const chunks = result.output.filter(item => item.type === 'chunk');
const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
const moduleNames = chunk => Object.keys(chunk.modules).map(name => name.replaceAll('\\', '/'));
const chunkFor = suffix => {
  const chunk = chunks.find(item => moduleNames(item).some(name => name.endsWith(suffix)));
  assert.ok(chunk, `Built module exists: ${suffix}`);
  return chunk;
};
function staticDependencies(...entries) {
  const seen = new Set();
  function visit(chunk) {
    if (seen.has(chunk)) return;
    seen.add(chunk);
    chunk.imports.forEach(name => { if (byFile.has(name)) visit(byFile.get(name)); });
  }
  entries.forEach(visit);
  return [...seen];
}
const includesModule = (graph, pattern) => graph.some(chunk => moduleNames(chunk).some(name => pattern.test(name)));
const entry = chunks.find(chunk => chunk.isEntry);

test('Firebase authentication and messaging stay outside initial page loading', () => {
  assert.ok(!includesModule(staticDependencies(entry), /\/node_modules\/(?:@firebase|firebase)\//), 'Firebase only loads after the explicit phone or push action');
});
const pages = [
  ['/store/dashboard', '/pages/store/StoreDashboard.tsx'],
  ['/store/devices', '/pages/store/StoreDevicesPage.tsx'],
  ['/store/rentals', '/pages/customer/CustomerRentalsPage.tsx'],
  ['/store/device-templates', '/pages/store/StoreDeviceTemplatesPage.tsx'],
  ['/store/products', '/pages/store/StoreProductsPage.tsx'],
  ['/store/analytics', '/pages/store/StoreAnalyticsPage.tsx'],
  ['/store/wallet', '/pages/store/StoreWalletPage.tsx'],
  ['/store/profile?tab=SECURITY', '/pages/profile/ProfilePage.tsx'],
  ['/store/finance', '/pages/store/StoreFinancePage.tsx'],
];

for (const [route, suffix] of pages) {
  test(`${route} loads independently without camera code or unrelated owner pages`, () => {
    const page = chunkFor(suffix);
    assert.ok(!staticDependencies(entry).includes(page), 'Page stays outside the app entry');
    const initial = staticDependencies(entry, page);
    assert.ok(!includesModule(initial, /\/node_modules\/html5-qrcode\//), 'Camera decoder loads on demand');
    assert.equal(includesModule(initial, /\/node_modules\/recharts\//), route === '/store/analytics', 'Only the visible analytics page needs chart code initially');
    for (const [, other] of pages) {
      if (other !== suffix) assert.ok(!initial.some(chunk => moduleNames(chunk).some(name => name.endsWith(other))), `Does not eagerly load ${other}`);
    }
  });
}

test('the camera scanner and chart remain available through dynamic imports', () => {
  const devices = chunkFor('/pages/store/StoreDevicesPage.tsx');
  const scanner = chunkFor('/components/common/QrCameraScanner.tsx');
  assert.ok(devices.dynamicImports.includes(scanner.fileName));
  assert.ok(includesModule(staticDependencies(scanner), /\/node_modules\/html5-qrcode\//));
  const dashboard = chunkFor('/pages/store/StoreDashboard.tsx');
  const chart = chunkFor('/components/AnalyticsChart.jsx');
  assert.ok(dashboard.dynamicImports.includes(chart.fileName));
  assert.ok(includesModule(staticDependencies(chart), /\/node_modules\/recharts\//));
});

test('store finance does not load verification, driver or admin page implementations', () => {
  const finance = chunkFor('/pages/store/StoreFinancePage.tsx');
  assert.ok(!includesModule(staticDependencies(entry, finance), /\/pages\/operations\/OperationsPages\.tsx$/));
});

test('the removed Security Hub screen is absent from the production bundle', () => {
  assert.ok(!includesModule(chunks, /\/pages\/admin\/AdminSecurityHubPage\.tsx$/));
});

test('admin opens without chart code and can still load the chart on demand', () => {
  const admin = chunkFor('/pages/admin/AdminDashboard.tsx');
  const chart = chunkFor('/components/AnalyticsChart.jsx');
  assert.ok(!includesModule(staticDependencies(entry, admin), /\/node_modules\/recharts\//));
  assert.ok(admin.dynamicImports.includes(chart.fileName));
});

test('admin payouts loads without verification, driver or dashboard implementations', () => {
  const payout = chunkFor('/pages/admin/AdminPayoutsPage.tsx');
  const initial = staticDependencies(entry, payout);
  assert.ok(!includesModule(initial, /\/pages\/operations\/OperationsPages\.tsx$/));
  assert.ok(!includesModule(initial, /\/pages\/admin\/AdminDashboard\.tsx$/));
});
