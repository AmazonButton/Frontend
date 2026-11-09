import test from 'node:test';
import assert from 'node:assert/strict';
import { isStoreSuspended, getStoreSuspendedNotice } from '../src/services/store-status.ts';

test('isStoreSuspended correctly identifies suspended user or store', () => {
  assert.equal(isStoreSuspended(null), false);
  assert.equal(isStoreSuspended(undefined), false);

  // User with active status and active store
  const activeUser = {
    id: '1',
    role: 'STORE_OWNER',
    status: 'ACTIVE',
    store: { id: '10', status: 'ACTIVE', name: 'Shop Gas A' },
    ownedStores: [{ storeId: 10, status: 'ACTIVE', name: 'Shop Gas A' }],
  };
  assert.equal(isStoreSuspended(activeUser), false);

  // User with user.status === 'SUSPENDED'
  const suspendedUserStatus = {
    id: '2',
    role: 'STORE_OWNER',
    status: 'SUSPENDED',
  };
  assert.equal(isStoreSuspended(suspendedUserStatus), true);

  // User with store.status === 'SUSPENDED'
  const suspendedStore = {
    id: '3',
    role: 'STORE_OWNER',
    status: 'ACTIVE',
    store: { id: '20', status: 'SUSPENDED', name: 'Shop Gas B' },
  };
  assert.equal(isStoreSuspended(suspendedStore), true);

  // User with ownedStores[0].status === 'SUSPENDED'
  const suspendedOwnedStore = {
    id: '4',
    role: 'STORE_OWNER',
    status: 'ACTIVE',
    ownedStores: [{ storeId: 30, status: 'SUSPENDED', name: 'Shop Gas C' }],
  };
  assert.equal(isStoreSuspended(suspendedOwnedStore), true);
});

test('getStoreSuspendedNotice produces accurate store name and suspension notice', () => {
  const activeUser = {
    id: '1',
    role: 'STORE_OWNER',
    status: 'ACTIVE',
    store: { id: '10', status: 'ACTIVE', name: 'Cửa hàng Hoạt Động' },
  };
  const activeNotice = getStoreSuspendedNotice(activeUser);
  assert.equal(activeNotice.isSuspended, false);
  assert.equal(activeNotice.storeName, '');

  const suspendedUser = {
    id: '2',
    role: 'STORE_OWNER',
    status: 'ACTIVE',
    store: {
      id: '20',
      status: 'SUSPENDED',
      name: 'Đại lý Nước Khoáng',
      rejectionReason: 'Tạm ngừng theo yêu cầu thanh tra an toàn',
    },
  };
  const suspendedNotice = getStoreSuspendedNotice(suspendedUser);
  assert.equal(suspendedNotice.isSuspended, true);
  assert.equal(suspendedNotice.storeName, 'Đại lý Nước Khoáng');
  assert.equal(suspendedNotice.reason, 'Tạm ngừng theo yêu cầu thanh tra an toàn');
});

