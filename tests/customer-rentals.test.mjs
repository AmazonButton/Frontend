import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Sidebar includes Thuê nút bấm for customer and Gói thuê nút IoT for admin', () => {
  const sidebarPath = path.resolve('frontend/src/layouts/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  assert.match(
    content,
    /\{\s*to:\s*'\/customer\/rentals',\s*label:\s*'Thuê nút bấm'/,
    'Sidebar customerLinks must include /customer/rentals'
  );

  assert.match(
    content,
    /\{\s*to:\s*'\/admin\/dashboard\?section=RENTALS',\s*label:\s*'2\.1 Gói thuê nút IoT'/,
    'Sidebar adminLinks must include /admin/dashboard?section=RENTALS'
  );
});

test('App.tsx registers /customer/rentals route', () => {
  const appPath = path.resolve('frontend/src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.match(
    content,
    /import\s*\{\s*CustomerRentalsPage\s*\}\s*from\s*'\.\/pages\/customer\/CustomerRentalsPage'/,
    'App.tsx must import CustomerRentalsPage'
  );
  assert.match(
    content,
    /<Route\s+path="\/customer\/rentals"\s+element=\{<CustomerRentalsPage\s*\/>\}/,
    'App.tsx must register /customer/rentals route'
  );
});

test('rentalsService provides real API methods without mock data fallbacks', () => {
  const servicePath = path.resolve('frontend/src/services/rentals.service.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  assert.match(content, /listPackages\(/, 'rentalsService must provide listPackages');
  assert.match(content, /createRentalOrder\(/, 'rentalsService must provide createRentalOrder');
  assert.match(content, /getMyRentals\(/, 'rentalsService must provide getMyRentals');
  assert.match(content, /adminListPackages\(/, 'rentalsService must provide adminListPackages');
  assert.match(content, /adminCreatePackage\(/, 'rentalsService must provide adminCreatePackage');
  assert.match(content, /adminUpdatePackage\(/, 'rentalsService must provide adminUpdatePackage');
  assert.doesNotMatch(content, /FALLBACK_RENTAL_PACKAGES/, 'Mock data FALLBACK_RENTAL_PACKAGES must be removed');
});

test('AdminDashboard integrates rental packages creation and real API management', () => {
  const adminPath = path.resolve('frontend/src/pages/admin/AdminDashboard.tsx');
  const content = fs.readFileSync(adminPath, 'utf8');

  assert.match(content, /loadRentalPackages/, 'AdminDashboard must define loadRentalPackages');
  assert.match(content, /handleCreateRentalPackage/, 'AdminDashboard must define handleCreateRentalPackage');
  assert.match(content, /adminCreatePackage/, 'AdminDashboard must call rentalsService.adminCreatePackage');
  assert.match(content, /adminListPackages/, 'AdminDashboard must call rentalsService.adminListPackages');
  assert.match(content, /Gói thuê nút bấm IoT/, 'AdminDashboard must render rental packages view');
});

test('Rental notifications cross-notify store owners and customers', () => {
  const notifPath = path.resolve('frontend/src/services/rental-notifications.ts');
  const content = fs.readFileSync(notifPath, 'utf8');

  assert.match(content, /publishRentalPurchased/, 'Must export publishRentalPurchased');
  assert.match(content, /publishRentalPackageCreated/, 'Must export publishRentalPackageCreated');
  assert.match(content, /subscribeRentalChannelEvents/, 'Must export subscribeRentalChannelEvents');
});

test('CustomerHomePage provides rental entrypoints', () => {
  const homePath = path.resolve('frontend/src/pages/customer/CustomerHomePage.tsx');
  const content = fs.readFileSync(homePath, 'utf8');

  assert.match(
    content,
    /\/customer\/rentals/,
    'CustomerHomePage must include navigation link to /customer/rentals'
  );
});
