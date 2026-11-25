import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const compileCjs = (relPath) =>
  ts.transpileModule(readFileSync(new URL(relPath, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;

const isFrontendDir = import.meta.url.includes('/frontend/tests/');
const prefixes = isFrontendDir ? ['../src/'] : ['../src/', '../frontend/src/'];

for (const prefix of prefixes) {
  test(`${prefix}buildDeliveryPayload supports doorstep COD fallback for unpaid PAYOS orders while rejecting unconfirmed unpaid PAYOS`, () => {
    const code = compileCjs(`${prefix}services/driver-workflow.ts`);
    const mod = { exports: {} };
    vm.runInNewContext(code, {
      module: mod,
      exports: mod.exports,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Math,
      RegExp,
      Error,
      URL,
      document: { createElement: () => ({ getContext: () => null }) },
      window: {},
      navigator: {},
    });
    const { buildDeliveryPayload } = mod.exports;
    const unpaidPayos = {
      id: '901',
      storeId: '5',
      totalAmount: 55000,
      paymentMethod: 'PAYOS',
      paymentStatus: 'UNPAID',
    };
    const pod = 'stores/5/pod/test.webp';

    assert.throws(() => buildDeliveryPayload(unpaidPayos, pod, '', false));
    const codPayload = buildDeliveryPayload(unpaidPayos, pod, '55000', true, null, 'COD');
    assert.equal(codPayload.paymentMethod, 'COD');
    assert.equal(codPayload.collectedAmount, 55000);
    assert.equal(codPayload.status, 'DELIVERED');
  });

  test(`${prefix}extractStoreOrderError and checkoutAcrossStores surface STORE_SUBSCRIPTION_EXPIRED, STORE_INACTIVE, STORE_CUSTOMER_BLOCKED`, async () => {
    const code = compileCjs(`${prefix}services/marketplace-checkout.ts`);
    const mod = { exports: {} };
    vm.runInNewContext(code, {
      module: mod,
      exports: mod.exports,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Set,
      Map,
      Error,
      JSON,
      TextEncoder,
      Uint8Array,
      crypto: globalThis.crypto,
    });
    const { checkoutAcrossStores, extractStoreOrderError } = mod.exports;

    for (const codeVal of ['STORE_SUBSCRIPTION_EXPIRED', 'STORE_INACTIVE', 'STORE_CUSTOMER_BLOCKED']) {
      const parsed = extractStoreOrderError({ response: { data: { errorCode: codeVal } } });
      assert.equal(parsed.errorCode, codeVal);
      assert.ok(parsed.message.length > 10);
    }

    const result = await checkoutAcrossStores({
      lines: [
        {
          product: { id: 'p1', storeId: '88', price: 10000, store: { name: 'Cửa hàng Hết Hạn' } },
          quantity: 1,
          selected: true,
        },
      ],
      contact: {
        customerName: 'A',
        customerPhone: '0901234567',
        deliveryAddress: '123 Street',
        paymentMethod: 'COD',
      },
      accountId: 'user-1',
      post: async () => {
        const err = new Error('Forbidden');
        err.response = { status: 403, data: { errorCode: 'STORE_SUBSCRIPTION_EXPIRED' } };
        throw err;
      },
      onPlaced: () => {},
    });

    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].storeId, '88');
    assert.equal(result.failed[0].errorCode, 'STORE_SUBSCRIPTION_EXPIRED');
  });

  test(`${prefix}rentals & notifications & admin-workflows expose exact backend endpoints`, async () => {
    const calls = [];
    const mockApi = {
      async get(url, config) {
        calls.push({ method: 'GET', url, config });
        if (url === '/notifications') return { data: { success: true, data: [], unreadCount: 2 } };
        if (url === '/notifications/unread-count') return { data: { success: true, data: { unreadCount: 3 } } };
        return { data: { success: true, data: {} } };
      },
      async post(url, body) {
        calls.push({ method: 'POST', url, body });
        return { data: { success: true, data: { status: 'CANCELLED' } } };
      },
      async patch(url, body) {
        calls.push({ method: 'PATCH', url, body });
        return { data: { success: true, data: { status: 'CANCELLED' } } };
      },
      async delete(url, config) {
        calls.push({ method: 'DELETE', url, config });
        return { data: { success: true } };
      },
    };

    const rentalsCode = compileCjs(`${prefix}services/rentals.service.ts`);
    const rentalsMod = { exports: {} };
    vm.runInNewContext(rentalsCode, {
      module: rentalsMod,
      exports: rentalsMod.exports,
      require: (name) => {
        if (name === './api') return { api: mockApi };
        if (name === './rental-notifications') return { publishRentalPurchased() {}, publishRentalPackageCreated() {} };
        throw new Error(`Unexpected import ${name}`);
      },
      console,
      localStorage: { setItem() {} },
      window: undefined,
    });
    await rentalsMod.exports.rentalsService.cancelRental('55', 'Không cần nữa');
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), {
      method: 'POST',
      url: '/rentals/55/cancel',
      body: { reason: 'Không cần nữa' },
    });

    const notifCode = compileCjs(`${prefix}services/notifications.service.ts`);
    const notifMod = { exports: {} };
    vm.runInNewContext(notifCode, {
      module: notifMod,
      exports: notifMod.exports,
      require: (name) => {
        if (name === './api') return { api: mockApi };
        throw new Error(`Unexpected import ${name}`);
      },
    });
    const listRes = await notifMod.exports.notificationsService.listNotifications({ page: 1, pageSize: 20 });
    assert.equal(listRes.unreadCount, 2);
    await notifMod.exports.notificationsService.markAsRead('9');
    await notifMod.exports.notificationsService.markAllAsRead();
    assert.equal(calls.some((c) => c.method === 'PATCH' && c.url === '/notifications/9/read'), true);
    assert.equal(calls.some((c) => c.method === 'PATCH' && c.url === '/notifications/read-all'), true);

    const { cancelRentalContractByAdmin } = await import(`${prefix}pages/admin/admin-workflows.mjs`);
    await cancelRentalContractByAdmin(mockApi, '77');
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), {
      method: 'PATCH',
      url: '/admin/rentals/77/status',
      body: { status: 'CANCELLED' },
    });
  });

  test(`${prefix}CustomerOrdersPage & AdminRefundsWorkspace handle ORDER_REFUNDED realtime & reconciliation diagnostics`, () => {
    const ordersSrc = readFileSync(new URL(`${prefix}pages/customer/CustomerOrdersPage.tsx`, import.meta.url), 'utf8');
    const refreshSrc = readFileSync(new URL(`${prefix}hooks/useDashboardRefresh.ts`, import.meta.url), 'utf8');
    const adminRefundsSrc = readFileSync(new URL(`${prefix}components/admin/AdminRefundsWorkspace.tsx`, import.meta.url), 'utf8');

    assert.ok(ordersSrc.includes("socket.on('ORDER_REFUNDED'"), 'CustomerOrdersPage must subscribe to ORDER_REFUNDED');
    assert.ok(ordersSrc.includes("socket.off('ORDER_REFUNDED'"), 'CustomerOrdersPage must unsubscribe from ORDER_REFUNDED');
    assert.ok(!ordersSrc.includes("window.addEventListener('focus', handleOrderCreated)"), 'Window focus must not trigger handleOrderCreated chime');
    assert.ok(ordersSrc.includes('isMountedRef.current'), 'loadOrders finally block must always reset spinner state while mounted');
    assert.ok(ordersSrc.includes('Đã hoàn tiền thành công về tài khoản'), 'CustomerOrdersPage must display refunded confirmation banner');

    assert.ok(refreshSrc.includes("'ORDER_REFUNDED'"), 'useDashboardRefresh must include ORDER_REFUNDED event');

    assert.ok(adminRefundsSrc.includes("['SETTLED', 'REFUNDED'].includes(i.status)"), 'AdminRefundsWorkspace metrics must count REFUNDED obligations');
    assert.ok(adminRefundsSrc.includes('<option value="REFUNDED">'), 'AdminRefundsWorkspace filter must support REFUNDED status');
    assert.ok(adminRefundsSrc.includes('syncData?.settled === true'), 'handleSyncObligation must inspect settled status instead of blindly showing success');
    assert.ok(adminRefundsSrc.includes('loadingRef.current'), 'AdminRefundsWorkspace loadData must guard against overlapping polling requests');
  });
}
