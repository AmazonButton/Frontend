import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGrandfatheredStore,
  storeListingEntitlement,
  MAX_GRANDFATHERED_STORE_ID,
} from '../src/services/store-service-plans.ts';
import {
  parseStoreSubscriptionItem,
  calculateDaysRemaining,
} from '../src/services/admin-store-subscriptions.ts';

test('isGrandfatheredStore accurately identifies existing database stores', () => {
  assert.equal(isGrandfatheredStore({ storeId: '1' }), true);
  assert.equal(isGrandfatheredStore({ storeId: 381 }), true);
  assert.equal(isGrandfatheredStore({ store: { storeId: '200' } }), true);
  assert.equal(isGrandfatheredStore({ id: '381' }), true);
  assert.equal(isGrandfatheredStore({ ownedStores: [{ storeId: '10' }] }), true);

  // New store ID > 381 without old creation date
  assert.equal(isGrandfatheredStore({ storeId: '382', createdAt: '2026-11-09T10:00:00.000Z' }), false);
  assert.equal(isGrandfatheredStore({ storeId: 999 }), false);
  assert.equal(isGrandfatheredStore(null), false);
  assert.equal(isGrandfatheredStore(undefined), false);
});

test('storeListingEntitlement exempts grandfathered stores without subscriptions', () => {
  const grandfatheredUser = { role: 'STORE_OWNER', storeId: '5' };
  const result = storeListingEntitlement(null, 15, true, Date.now(), grandfatheredUser);

  assert.equal(result.allowed, true);
  assert.equal(result.isGrandfathered, true);
  assert.equal(result.requiresSubscription, false);
  assert.equal(result.reason, '');
});

test('storeListingEntitlement strictly blocks newly created stores without subscription', () => {
  const newStoreUser = { role: 'STORE_OWNER', storeId: '400', createdAt: '2026-11-09T12:00:00Z' };
  const result = storeListingEntitlement(null, 0, true, Date.now(), newStoreUser);

  assert.equal(result.allowed, false);
  assert.equal(result.isGrandfathered, false);
  assert.equal(result.requiresSubscription, true);
  assert.match(result.reason, /chưa đăng ký gói dịch vụ/i);
});

test('storeListingEntitlement allows newly created store with valid active subscription', () => {
  const newStoreUser = { role: 'STORE_OWNER', storeId: '400', createdAt: '2026-11-09T12:00:00Z' };
  const now = Date.parse('2026-11-10T00:00:00Z');
  const validSubscription = {
    subscriptionId: '100',
    storeId: '400',
    planId: '1',
    status: 'ACTIVE',
    startDate: '2026-11-09T00:00:00Z',
    endDate: '2026-12-09T00:00:00Z',
    plan: {
      planId: '1',
      planCode: 'PRO',
      planName: 'Gói Chuyên Nghiệp',
      price: 200000,
      durationDays: 30,
      maxProducts: 50,
      isActive: true,
    },
  };

  const result = storeListingEntitlement(validSubscription, 10, true, now, newStoreUser);
  assert.equal(result.allowed, true);
  assert.equal(result.requiresSubscription, false);
  assert.equal(result.reason, '');
});

test('parseStoreSubscriptionItem parses grandfathered store without subscription', () => {
  const store = { storeId: '1', name: 'Cửa hàng Gốc', code: 'STORE-1' };
  const item = parseStoreSubscriptionItem(store, null);

  assert.equal(item.storeId, '1');
  assert.equal(item.isGrandfathered, true);
  assert.equal(item.canListProducts, true);
  assert.equal(item.statusCategory, 'EXEMPT');
  assert.match(item.listingStatusLabel, /Miễn trừ/);
});

test('parseStoreSubscriptionItem parses new store without subscription', () => {
  const store = { storeId: '500', name: 'Shop Mới Mở', code: 'STORE-500', createdAt: '2026-11-10T00:00:00Z' };
  const item = parseStoreSubscriptionItem(store, null);

  assert.equal(item.storeId, '500');
  assert.equal(item.isGrandfathered, false);
  assert.equal(item.canListProducts, false);
  assert.equal(item.statusCategory, 'UNSUBSCRIBED');
  assert.match(item.listingStatusLabel, /Bị khóa/);
});

test('parseStoreSubscriptionItem parses subscribed store', () => {
  const store = { storeId: '500', name: 'Shop Mới Mở', code: 'STORE-500', createdAt: '2026-11-10T00:00:00Z' };
  const sub = {
    subscriptionId: '1',
    status: 'ACTIVE',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-01T00:00:00Z',
    plan: {
      planName: 'Gói Tiêu Chuẩn',
      planCode: 'STD-30',
      price: 100000,
      maxProducts: 100,
    },
  };
  const item = parseStoreSubscriptionItem(store, sub);

  assert.equal(item.isGrandfathered, false);
  assert.equal(item.statusCategory, 'SUBSCRIBED');
  assert.equal(item.canListProducts, true);
  assert.equal(item.planName, 'Gói Tiêu Chuẩn');
  assert.equal(item.listingStatusLabel, 'Được phép đăng bán');
});
