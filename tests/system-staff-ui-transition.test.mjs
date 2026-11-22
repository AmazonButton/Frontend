import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTsModule(relPath, extraMocks = {}, extraGlobals = {}, transformSource = s => s) {
  const source = transformSource(readFileSync(new URL(relPath, import.meta.url), 'utf8'));
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Set,
    Map,
    Date,
    Math,
    RegExp,
    Error,
    URL,
    Promise,
    console,
    setTimeout,
    clearTimeout,
    ...extraGlobals,
    require(name) {
      if (name in extraMocks) return extraMocks[name];
      if (name === '../utils/authority' || name === './authority') {
        return loadTsModule('../src/utils/authority.ts');
      }
      throw new Error(`Unexpected import in ${relPath}: ${name}`);
    },
  });
  return module.exports;
}

const HAS_MIRROR = existsSync(new URL('../frontend/src/utils/authority.ts', import.meta.url));
const PREFIXES = HAS_MIRROR ? ['../src/', '../frontend/src/'] : ['../src/'];

for (const prefix of PREFIXES) {
  test(`${prefix}utils/authority enforces active role list, home paths, and normalized capabilities`, () => {
    const authority = loadTsModule(`${prefix}utils/authority.ts`);
    for (const active of ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'SYSTEM_STAFF', 'STORE_OWNER', 'CUSTOMER']) {
      assert.equal(authority.isActiveRole(active), true);
    }
    for (const deprecated of ['STORE_MANAGER', 'STORE_STAFF', 'STAFF_ORDER', 'STAFF_INVENTORY', 'STAFF_BUTTON', 'STAFF_DELIVERY', 'TECHNICIAN', 'DELIVERY_STAFF', 'UNKNOWN']) {
      assert.equal(authority.isActiveRole(deprecated), false);
      assert.equal(authority.getRoleHomePath(deprecated), '/');
    }

    assert.equal(authority.getRoleHomePath('SYSTEM_STAFF'), '/system-staff/devices');
    assert.equal(authority.getRoleHomePath('STORE_OWNER'), '/store/dashboard');
    assert.equal(authority.getRoleHomePath('SUPER_ADMIN'), '/admin/dashboard');
    assert.equal(authority.getRoleHomePath('SYSTEM_ADMIN'), '/admin/dashboard');
    assert.equal(authority.getRoleHomePath('ADMIN'), '/admin/dashboard');
    assert.equal(authority.getRoleHomePath('CUSTOMER'), '/shop');

    const staffUser = authority.normalizeAuthUser({
      userId: '77',
      role: 'SYSTEM_STAFF',
      platformRole: 'SYSTEM_STAFF',
      email: 'staff@example.com',
      fullName: 'Nhân viên kỹ thuật',
    });
    assert.equal(staffUser.id, '77');
    assert.equal(staffUser.platformRole, 'SYSTEM_STAFF');
    assert.equal(authority.hasCapability(staffUser, 'managePlatformDevices'), true);
    assert.equal(authority.hasCapability(staffUser, 'manageWarrantyTickets'), true);
    assert.equal(authority.hasCapability(staffUser, 'approveFinancialRefunds'), false);
    assert.equal(authority.hasCapability(staffUser, 'managePayoutsAndWithdrawals'), false);
    assert.equal(authority.hasCapability(staffUser, 'manageUsersAndRoles'), false);
    assert.equal(authority.hasCapability(staffUser, 'manageOwnStoreWallet'), false);

    const ownerUser = authority.normalizeAuthUser({
      userId: '88',
      role: 'STORE_OWNER',
      storeId: '12',
      platformMemberships: [{ roleCode: 'STORE_OWNER', status: 'ACTIVE' }],
    });
    assert.equal(ownerUser.platformRole, null);
    assert.equal(ownerUser.storeId, '12');
    assert.equal(ownerUser.platformMemberships?.length, 1);
    assert.equal(authority.hasCapability(ownerUser, 'manageOwnStoreSalesAndDelivery'), true);
    assert.equal(authority.hasCapability(ownerUser, 'manageOwnStoreWallet'), true);
    assert.equal(authority.hasCapability(ownerUser, 'managePlatformDevices'), false);
    assert.equal(authority.hasCapability(ownerUser, 'managePayoutsAndWithdrawals'), false);
  });

  test(`${prefix}services/phone-auth-flow routes SYSTEM_STAFF and STORE_OWNER and rejects legacy roles`, async () => {
    const flow = loadTsModule(`${prefix}services/phone-auth-flow.ts`);
    assert.equal(flow.roleHome('SYSTEM_STAFF'), '/system-staff/devices');
    assert.equal(flow.roleHome('STORE_OWNER'), '/store/dashboard');
    assert.equal(flow.roleHome('STAFF_DELIVERY'), '/');
    assert.equal(flow.roleHome('STORE_MANAGER'), '/');

    const res = await flow.exchangePhoneCredential(
      {
        post: async () => ({
          data: {
            success: true,
            data: {
              accessToken: 'jwt-1',
              user: {
                userId: '501',
                role: 'SYSTEM_STAFF',
                platformRole: 'SYSTEM_STAFF',
                capabilities: { managePlatformDevices: true, approveFinancialRefunds: false },
              },
            },
          },
        }),
      },
      'login',
      'fixture-token-'.repeat(12),
    );
    assert.equal(res.user.id, '501');
    assert.equal(res.user.platformRole, 'SYSTEM_STAFF');
    assert.equal(res.user.capabilities.managePlatformDevices, true);
    assert.equal(res.user.capabilities.approveFinancialRefunds, false);
  });

  test(`${prefix}services/driver-workflow & drivers.service consolidate delivery + legacy takeover under STORE_OWNER`, async () => {
    const workflow = loadTsModule(`${prefix}services/driver-workflow.ts`);
    const shippingOrder = { id: '301', storeId: '9', status: 'SHIPPING', assignedDriverId: '99' };

    assert.equal(workflow.canRecordDelivery(shippingOrder, '77', 'STORE_OWNER'), true);
    assert.equal(workflow.canRecordDelivery(shippingOrder, '77', 'SUPER_ADMIN'), true);
    assert.equal(workflow.canRecordDelivery(shippingOrder, '99', 'STAFF_DELIVERY'), false);
    assert.equal(workflow.canRecordDelivery(shippingOrder, '99', 'STORE_MANAGER'), false);
    assert.equal(workflow.canRecordDelivery(shippingOrder, '99', 'SYSTEM_STAFF'), false);

    assert.equal(workflow.canConfirmHandover({ shiftId: '5', status: 'CLOSED' }, 'STORE_OWNER'), true);
    assert.equal(workflow.canConfirmHandover({ shiftId: '5', status: 'CLOSED' }, 'STORE_MANAGER'), false);
    assert.equal(workflow.canConfirmHandover({ shiftId: '5', status: 'CLOSED' }, 'STAFF_DELIVERY'), false);

    const calls = [];
    const events = [];
    const { driversService } = loadTsModule(
      `${prefix}services/drivers.service.ts`,
      {
        './api': {
          api: {
            get: async (path, config) => {
              calls.push({ method: 'GET', path, config });
              if (path.includes('legacy-handover-status')) {
                return { data: { success: true, data: { storeId: '9', ownerUserId: '77', inFlightShipperOrders: [], openShifts: [], pendingHandoverClosedShifts: [], pendingCodHandoverTotal: 0 } } };
              }
              return { data: { success: true, data: [], pagination: { page: 1, totalPages: 1 } } };
            },
            post: async (path, body) => {
              calls.push({ method: 'POST', path, body });
              if (path.includes('takeover-delivery')) return { data: { success: true, data: { orderId: '301', status: 'SHIPPING', assignedDriverId: '77' } } };
              return { data: { success: true, data: { storeId: '9', reclaimedShippingOrdersCount: 1, settledOpenShiftsCount: 1, settledClosedShiftsCount: 1, totalCodSettled: 150000, totalVietqrSettled: 0 } } };
            },
            patch: async () => ({ data: { success: true, data: {} } }),
          },
        },
        './driver-workflow': workflow,
        './order-events': {
          normalizeOrder: raw => ({ ...raw, id: String(raw.id || raw.orderId) }),
          publishOrderEvent: (type, payload) => events.push({ type, payload }),
        },
      },
      { window: {} },
    );

    await driversService.getLegacyHandoverStatus('9');
    await driversService.getStoreDriverShifts('9', 2);
    await driversService.takeoverLegacyDelivery('301');
    await driversService.settleLegacyHandover('9', '  Đối soát cuối ca cũ  ');

    assert.equal(calls[0].path, '/stores/9/legacy-handover-status');
    assert.equal(calls[1].path, '/stores/9/driver-shifts');
    assert.equal(calls[1].config.params.page, 2);
    assert.equal(calls[2].path, '/orders/301/takeover-delivery');
    assert.equal(calls[3].path, '/stores/9/legacy-handover/settle');
    assert.equal(calls[3].body.note, 'Đối soát cuối ca cũ');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'ORDER_STATUS_CHANGED');
  });

  test(`${prefix}services/device-product-removal permits STORE_OWNER & SYSTEM_STAFF and denies deprecated STAFF_BUTTON and STORE_MANAGER`, () => {
    const mod = loadTsModule(`${prefix}services/device-product-removal.ts`);
    assert.equal(mod.canRemoveDeviceProducts('STORE_OWNER'), true);
    assert.equal(mod.canRemoveDeviceProducts('SYSTEM_STAFF'), true);
    assert.equal(mod.canRemoveDeviceProducts('SUPER_ADMIN'), true);
    assert.equal(mod.canRemoveDeviceProducts('STORE_MANAGER'), false);
    assert.equal(mod.canRemoveDeviceProducts('STAFF_BUTTON'), false);
    assert.equal(mod.canRemoveDeviceProducts('CUSTOMER'), false);
  });

  test(`${prefix}App.tsx enforces strict direct-URL guards with zero legacy staff/driver roles`, () => {
    const appSource = readFileSync(new URL(`${prefix}App.tsx`, import.meta.url), 'utf8');
    for (const removedRole of ['STORE_MANAGER', 'STORE_STAFF', 'STAFF_ORDER', 'STAFF_INVENTORY', 'STAFF_BUTTON', 'STAFF_DELIVERY', 'TECHNICIAN', 'DELIVERY_STAFF']) {
      assert.equal(appSource.includes(removedRole), false, `Legacy role ${removedRole} must not remain in ${prefix}App.tsx`);
    }
    assert.match(appSource, /allowedRoles=\{\['SYSTEM_STAFF'\]\}/);
    assert.match(appSource, /path="\/system-staff\/devices"/);
    assert.match(appSource, /path="\/system-staff\/warranty"/);
    assert.match(appSource, /path="\/system-staff\/returns"/);
    assert.match(appSource, /path="\/system-staff\/templates"/);
    assert.match(appSource, /path="\/system-staff\/profile"/);
    const sidebarSource = readFileSync(new URL(`${prefix}layouts/Sidebar.tsx`, import.meta.url), 'utf8');
    assert.match(sidebarSource, /to:\s*'\/system-staff\/returns'/);
    assert.match(appSource, /<ProtectedRoute allowedRoles=\{\['STORE_OWNER'\]\}>\s*<AppShellLayout \/>\s*<\/ProtectedRoute>/);
    assert.match(appSource, /<ProtectedRoute allowedRoles=\{\['STORE_OWNER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'\]\}>\s*<AppShellLayout \/>\s*<\/ProtectedRoute>/);
    assert.match(appSource, /<ProtectedRoute allowedRoles=\{\['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'\]\}>/);
  });

  test(`${prefix}services/socket.ts disconnects and emits sob_auth_revoked on live auth:revoked event`, () => {
    const listeners = new Map();
    const dispatched = [];
    let disconnected = false;
    const mockSocket = {
      connected: true,
      auth: { token: 'Bearer jwt-123' },
      io: { opts: {} },
      on(event, fn) {
        listeners.set(event, fn);
        return mockSocket;
      },
      emit() {},
      disconnect() {
        disconnected = true;
        mockSocket.connected = false;
      },
    };
    class MockCustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
    const socketMod = loadTsModule(
      `${prefix}services/socket.ts`,
      {
        'socket.io-client': { io: () => mockSocket },
        './api': {
          API_URL: 'https://api.example.test',
          isTokenExpired: () => false,
          resolveApiUrl: () => 'https://api.example.test',
          getOrRefreshValidToken: async () => 'jwt-123',
        },
        './request-backoff': {
          API_BACKOFF_EVENT: 'api_backoff',
          getApiRetryUntil: () => 0,
          recordRateLimit: () => {},
        },
      },
      {
        CustomEvent: MockCustomEvent,
        setInterval: () => 1,
        clearInterval: () => {},
        localStorage: {
          getItem: key => (key === 'smart_order_token' ? 'jwt-123' : null),
          setItem() {},
          removeItem() {},
        },
        window: {
          location: { protocol: 'https:', hostname: 'example.test' },
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent(evt) {
            dispatched.push(evt);
          },
        },
      },
      s => s.replace(/\(import\.meta\s+as\s+any\)/g, '({ env: {}, hot: false })').replace(/import\.meta/g, '({ env: {}, hot: false })'),
    );
    socketMod.getSocket();
    assert.equal(listeners.has('auth:revoked'), true);
    listeners.get('auth:revoked')({ reason: 'ROLE_REVOKED', message: 'Quyền đã thay đổi' });
    assert.equal(disconnected, true);
    assert.equal(mockSocket.auth.token, undefined);
    assert.equal(dispatched.some(e => e.type === 'sob_auth_revoked' && e.detail?.reason === 'ROLE_REVOKED'), true);
  });

  test(`${prefix}services/warranty never fakes localStorage success on 403/timeout and supports server pagination`, async () => {
    const store = new Map();
    const calls = [];
    const warranty = loadTsModule(
      `${prefix}services/warranty.ts`,
      {
        './api': {
          api: {
            get: async (path, cfg) => {
              calls.push({ method: 'GET', path, params: cfg?.params });
              if (path === '/warranty/tickets') {
                return {
                  data: {
                    success: true,
                    data: [{ ticketId: '91', ticketCode: 'WRT-91', deviceId: 'SOB-01', faultGroup: 'GROUP_A', faultCode: 'LOW_BATTERY', status: 'PENDING', depositAmount: 200000, deductionPercent: 0, deductionAmount: 0, refundAmount: 200000 }],
                    pagination: { page: 2, pageSize: 20, total: 42, totalPages: 3 },
                  },
                };
              }
              return { data: { success: true, data: { ticketId: '91', ticketCode: 'WRT-91', deviceId: 'SOB-01', faultGroup: 'GROUP_A', faultCode: 'LOW_BATTERY', status: 'PENDING' } } };
            },
            post: async () => {
              const err = new Error('Forbidden');
              err.response = { status: 403, data: { message: 'Forbidden' } };
              throw err;
            },
            patch: async () => {
              const err = new Error('timeout of 10000ms exceeded');
              err.code = 'ECONNABORTED';
              throw err;
            },
          },
        },
      },
      {
        localStorage: {
          getItem: k => store.get(k) ?? null,
          setItem: (k, v) => store.set(k, v),
          removeItem: k => store.delete(k),
        },
      },
    );

    const pageRes = await warranty.fetchWarrantyTicketsPaginated({ page: 2, pageSize: 20, deviceId: 'sob-01' });
    assert.equal(pageRes.pagination.total, 42);
    assert.equal(pageRes.pagination.totalPages, 3);
    assert.equal(calls[0].params.deviceId, 'SOB-01');

    await assert.rejects(
      warranty.createWarrantyTicketAsync({ deviceId: 'SOB-01', faultGroup: 'GROUP_A', faultCode: 'LOW_BATTERY' }),
      /Forbidden/,
    );
    assert.equal(store.size, 0, '403 create failure must never persist local fallback ticket');

    await assert.rejects(warranty.approveSwapTicketAsync('91'), /timeout/);

    const panelSrc = readFileSync(new URL(`${prefix}components/devices/WarrantyPanel.tsx`, import.meta.url), 'utf8');
    assert.equal(panelSrc.includes('/factory-reset'), false, 'WarrantyPanel must not trigger factory-reset fallback');
    assert.equal(panelSrc.includes('updateWarrantyTicket'), false, 'WarrantyPanel must not use localStorage completion');
    assert.match(panelSrc, /fetchWarrantyTicketById/);
    assert.match(panelSrc, /ticketTotalPages/);
  });

  test(`${prefix}utils/device-custody groups allocated buttons by custodyStoreId without relying on routing storeId`, () => {
    const custody = loadTsModule(`${prefix}utils/device-custody.ts`);
    const blankButton = {
      deviceId: 'BTN-BLANK-1',
      storeId: '1',
      custodyStoreId: null,
      inventoryState: 'IN_PLATFORM_WAREHOUSE',
      customerId: null,
    };
    const allocatedNoStoreId = {
      deviceId: 'BTN-ALLOC-1',
      storeId: null,
      custodyStoreId: '9',
      custodyStore: { storeId: '9', name: 'Đại lý Cửu Long', code: 'CL9' },
      inventoryState: 'ALLOCATED_TO_STORE',
      customerId: null,
    };
    const allocatedDifferentStoreId = {
      deviceId: 'BTN-ALLOC-2',
      storeId: '1',
      custodyStoreId: '9',
      custodyStore: { storeId: '9', name: 'Đại lý Cửu Long', code: 'CL9' },
      inventoryState: 'ALLOCATED_TO_STORE',
      customerId: null,
    };

    assert.equal(custody.isUnassignedWarehouseDevice(blankButton), true);
    assert.equal(custody.isAllocatedDevice(blankButton), false);
    assert.equal(custody.resolveCustodyStoreId(blankButton), '');

    assert.equal(custody.isUnassignedWarehouseDevice(allocatedNoStoreId), false);
    assert.equal(custody.isAllocatedDevice(allocatedNoStoreId), true);
    assert.equal(custody.resolveCustodyStoreId(allocatedNoStoreId), '9');
    assert.deepEqual(JSON.parse(JSON.stringify(custody.resolveCustodyStoreMeta(allocatedNoStoreId, []))), {
      storeId: '9',
      storeName: 'Đại lý Cửu Long',
      storeCode: 'CL9',
    });

    assert.equal(custody.resolveCustodyStoreId(allocatedDifferentStoreId), '9');
    assert.equal(custody.resolveCustodyStoreMeta(allocatedDifferentStoreId, []).storeId, '9');
  });

  test(`${prefix}StoreDeviceTemplatesPage & PlatformDevicesWorkspace support SYSTEM_STAFF navigation and server pagination`, () => {
    const tmplSrc = readFileSync(new URL(`${prefix}pages/store/StoreDeviceTemplatesPage.tsx`, import.meta.url), 'utf8');
    assert.match(tmplSrc, /backToDevicesPath/);
    assert.match(tmplSrc, /\/system-staff\/devices/);
    assert.match(tmplSrc, /required=\{!isPlatformOps\}/);

    const devSrc = readFileSync(new URL(`${prefix}components/devices/PlatformDevicesWorkspace.tsx`, import.meta.url), 'utf8');
    assert.match(devSrc, /\/devices\/unassigned/);
    assert.match(devSrc, /allocatedOnly:\s*'true'/);
    assert.match(devSrc, /custodyStoreId:\s*deviceStoreFilter/);
    assert.match(devSrc, /unassignedTotalPages/);
    assert.match(devSrc, /allocatedTotalPages/);
    assert.match(devSrc, /storeTotalPages/);
    assert.match(devSrc, /storeLoadedOnce \? serverStores : initialStores/);
    assert.match(devSrc, /unassignedAbortRef/);
    assert.match(devSrc, /allocatedAbortRef/);
    assert.match(devSrc, /storesAbortRef/);
  });

  test(`${prefix}WarrantyPanel never swallows device warning 403 and prevents out-of-order ticket overwrites`, async () => {
    const panelSrc = readFileSync(new URL(`${prefix}components/devices/WarrantyPanel.tsx`, import.meta.url), 'utf8');
    assert.equal(/\/notifications\/device-warning[\s\S]*?\.catch\(\(\)\s*=>\s*null\)/.test(panelSrc), false);
    assert.match(panelSrc, /ticketsAbortRef/);
    assert.match(panelSrc, /ticketsGenRef/);

    const compiled = ts.transpileModule(panelSrc, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;

    const slots = [];
    const effects = [];
    let cursor = 0;
    let dirty = true;
    let tree;
    const toasts = { success: [], error: [], warning: [], info: [] };
    const ticketFetchMap = new Map();
    const deferred = () => {
      let resolve, reject;
      const promise = new Promise((a, b) => { resolve = a; reject = b; });
      return { promise, resolve, reject };
    };
    const oldReq = deferred();
    const newReq = deferred();
    let fetchCount = 0;

    const react = {
      useState(initial) {
        const idx = cursor++;
        if (!(idx in slots)) slots[idx] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[idx].value, next => {
          const val = typeof next === 'function' ? next(slots[idx].value) : next;
          if (!Object.is(val, slots[idx].value)) { slots[idx].value = val; dirty = true; }
        }];
      },
      useRef: initial => slots[cursor++] ||= { current: initial },
      useCallback: fn => fn,
      useMemo: fn => fn(),
      useEffect(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        const changed = !prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
        if (changed) {
          slots[idx] = { deps, cleanup: prev?.cleanup };
          effects.push(() => { slots[idx].cleanup?.(); slots[idx].cleanup = fn(); });
        }
      },
    };
    const jsx = (type, props) => ({ type, props });
    const exports = {};
    const warrantyServiceMod = loadTsModule(
      `${prefix}services/warranty.ts`,
      {
        './api': {
          api: {
            get: async (path, cfg) => {
              fetchCount++;
              ticketFetchMap.set(fetchCount, { params: cfg?.params, signal: cfg?.signal });
              if (cfg?.params?.deviceId === 'OLD') return { data: await oldReq.promise };
              if (cfg?.params?.deviceId === 'NEW') return { data: await newReq.promise };
              return { data: { success: true, data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } } };
            },
          },
        },
      },
      { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } },
    );

    vm.runInNewContext(compiled, {
      exports,
      Object, Array, String, Number, Boolean, Set, Map, Date, Math, RegExp, Error, URL, Promise, console,
      AbortController, encodeURIComponent,
      document: { body: {}, getElementById: () => null },
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
        if (name === '../../services/socket') return { getSocket: () => null };
        if (name === '../../context/ToastContext') {
          return {
            toast: {
              success: m => toasts.success.push(m),
              error: m => toasts.error.push(m),
              warning: m => toasts.warning.push(m),
              info: m => toasts.info.push(m),
            },
          };
        }
        if (name === '../../services/warranty') return warrantyServiceMod;
        if (name === '../../services/api') {
          return {
            api: {
              post: async () => {
                const err = new Error('Forbidden');
                err.response = { status: 403, data: { message: 'Không có quyền gửi cảnh báo' } };
                throw err;
              },
            },
          };
        }
        throw new Error(`Unexpected import in WarrantyPanel VM: ${name}`);
      },
    });

    const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];
    const flush = async () => {
      for (let i = 0; i < 20; i++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = exports.WarrantyPanel({
            mode: 'admin',
            devices: [{ deviceId: 'SOB-BAT-1', batteryLevel: 10, store: { name: 'Store 1' } }],
            stores: [{ storeId: '1', name: 'Store 1' }],
          });
          const jobs = effects.splice(0);
          jobs.forEach(j => j());
        }
        await Promise.resolve();
      }
    };

    await flush();
    // 1. Trigger 403 on handleWarnFromAlert ("Báo tài khoản"): must toast.error, NEVER toast.success
    const warnBtn = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Báo tài khoản'));
    assert.ok(warnBtn);
    await warnBtn.props.onClick();
    await flush();
    assert.equal(toasts.success.length, 0);
    assert.equal(toasts.error.length, 1);
    assert.match(toasts.error[0], /Không có quyền gửi cảnh báo/);

    // 2. Race test: search OLD (slow) then NEW (fast), resolve NEW first then OLD late
    const searchInput = walk(tree).find(n => n.type === 'input' && n.props?.['aria-label'] === 'Tìm phiếu theo mã nút');
    assert.ok(searchInput);
    searchInput.props.onChange({ target: { value: 'OLD' } });
    await flush();
    searchInput.props.onChange({ target: { value: 'NEW' } });
    await flush();

    newReq.resolve({
      success: true,
      data: [{ ticketId: '202', ticketCode: 'WRT-NEW', deviceId: 'NEW-BTN', faultGroup: 'GROUP_A', faultCode: 'LOW_BATTERY', status: 'PENDING', depositAmount: 100000 }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await flush();
    oldReq.resolve({
      success: true,
      data: [{ ticketId: '101', ticketCode: 'WRT-OLD', deviceId: 'OLD-BTN', faultGroup: 'GROUP_A', faultCode: 'LOW_BATTERY', status: 'PENDING', depositAmount: 100000 }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await flush();

    const renderedText = JSON.stringify(tree);
    assert.equal(renderedText.includes('NEW-BTN'), true, 'Latest NEW search result must remain rendered');
    assert.equal(renderedText.includes('OLD-BTN'), false, 'Stale OLD response must not overwrite NEW result');
  });

  test(`${prefix}PlatformDevicesWorkspace preserves valid empty store search results and blocks stale out-of-order responses`, async () => {
    const devSrc = readFileSync(new URL(`${prefix}components/devices/PlatformDevicesWorkspace.tsx`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(devSrc, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;

    const slots = [];
    const effects = [];
    let cursor = 0;
    let dirty = true;
    let tree;
    const deferred = () => {
      let resolve, reject;
      const promise = new Promise((a, b) => { resolve = a; reject = b; });
      return { promise, resolve, reject };
    };
    const oldAlloc = deferred();
    const newAlloc = deferred();

    const react = {
      useState(initial) {
        const idx = cursor++;
        if (!(idx in slots)) slots[idx] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[idx].value, next => {
          const val = typeof next === 'function' ? next(slots[idx].value) : next;
          if (!Object.is(val, slots[idx].value)) { slots[idx].value = val; dirty = true; }
        }];
      },
      useRef: initial => slots[cursor++] ||= { current: initial },
      useCallback(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        if (!prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
          slots[idx] = { fn, deps };
        }
        return slots[idx].fn;
      },
      useEffect(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        const changed = !prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
        if (changed) {
          slots[idx] = { deps, cleanup: prev?.cleanup };
          effects.push(() => { slots[idx].cleanup?.(); slots[idx].cleanup = fn(); });
        }
      },
    };
    const jsx = (type, props) => ({ type, props });
    const custodyMod = loadTsModule(`${prefix}utils/device-custody.ts`);
    const exports = {};

    vm.runInNewContext(compiled, {
      exports,
      Object, Array, String, Number, Boolean, Set, Map, Date, Math, RegExp, Error, URL, Promise, console,
      AbortController, encodeURIComponent,
      document: { body: {}, getElementById: () => null },
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'framer-motion') return { motion: { div: 'div' }, AnimatePresence: 'presence' };
        if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
        if (name === '../../context/ToastContext') return { toast: { success() {}, error() {}, warning() {} } };
        if (name === '../../utils/device-custody') return custodyMod;
        if (name === '../../services/api') {
          return {
            api: {
              get: async (path, cfg) => {
                if (path === '/stores') {
                  if (cfg?.params?.search === 'NONEXISTENT') {
                    return { data: { success: true, data: [], pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 1 } } };
                  }
                  return {
                    data: {
                      success: true,
                      data: [{ storeId: '1', name: 'Store One', code: 'S1', status: 'ACTIVE' }],
                      pagination: { page: cfg?.params?.page || 1, pageSize: 50, totalItems: 75, totalPages: 2 },
                    },
                  };
                }
                if (path === '/devices' && cfg?.params?.search === 'OLD') return { data: await oldAlloc.promise };
                if (path === '/devices' && cfg?.params?.search === 'NEW') return { data: await newAlloc.promise };
                return { data: { success: true, data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } } };
              },
            },
          };
        }
        throw new Error(`Unexpected import in PlatformDevicesWorkspace VM: ${name}`);
      },
    });

    const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];
    const flush = async () => {
      for (let i = 0; i < 20; i++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = exports.PlatformDevicesWorkspace({
            stores: [{ storeId: '99', name: 'Initial Store Only', code: 'INIT', status: 'ACTIVE' }],
          });
          const jobs = effects.splice(0);
          jobs.forEach(j => j());
        }
        await Promise.resolve();
      }
    };

    await flush();
    // 1. Paginated stores (>50) exposes Next page button cleanly
    const nextStoreBtn = walk(tree).find(n => n.type === 'button' && n.props?.['aria-label'] === 'Trang cửa hàng sau');
    assert.ok(nextStoreBtn, 'Store filter must render pagination when storeTotalPages > 1');

    // 2. Empty server store search preserves empty [] instead of reviving initialStores
    const storeSearch = walk(tree).find(n => n.type === 'input' && n.props?.['aria-label'] === 'Tìm cửa hàng trên máy chủ');
    assert.ok(storeSearch);
    storeSearch.props.onChange({ target: { value: 'NONEXISTENT' } });
    await flush();
    const afterEmptySearch = JSON.stringify(tree);
    assert.equal(afterEmptySearch.includes('Initial Store Only'), false, 'Valid empty server store search must not fall back to initialStores');

    // 3. Out-of-order allocated search: OLD resolves after NEW, NEW stays visible
    const devSearch = walk(tree).find(n => n.type === 'input' && n.props?.placeholder === 'Tìm mã nút, cửa hàng...');
    devSearch.props.onChange({ target: { value: 'OLD' } });
    await flush();
    devSearch.props.onChange({ target: { value: 'NEW' } });
    await flush();

    newAlloc.resolve({
      success: true,
      data: [{ deviceId: 'SOB-NEW-999', custodyStoreId: '1', custodyStore: { storeId: '1', name: 'Store One' }, inventoryState: 'ALLOCATED_TO_STORE', status: 'ACTIVE' }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    await flush();
    oldAlloc.resolve({
      success: true,
      data: [{ deviceId: 'SOB-OLD-111', custodyStoreId: '1', custodyStore: { storeId: '1', name: 'Store One' }, inventoryState: 'ALLOCATED_TO_STORE', status: 'ACTIVE' }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    await flush();

    const finalText = JSON.stringify(tree);
    assert.equal(finalText.includes('SOB-NEW-999'), true, 'NEW allocated result must remain visible');
    assert.equal(finalText.includes('SOB-OLD-111'), false, 'Stale OLD allocated response must not overwrite NEW result');
  });

  test(`${prefix}StoreDeviceTemplatesPage renders deploy failures (success: false and partial reasons)`, async () => {
    const pageSrc = readFileSync(new URL(`${prefix}pages/store/StoreDeviceTemplatesPage.tsx`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(pageSrc, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;

    const slots = [];
    const effects = [];
    let cursor = 0;
    let dirty = true;
    let tree;
    let deployModeIdx = 0;
    let fetchCalls = 0;

    const react = {
      useState(initial) {
        const idx = cursor++;
        if (!(idx in slots)) slots[idx] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[idx].value, next => {
          const val = typeof next === 'function' ? next(slots[idx].value) : next;
          if (!Object.is(val, slots[idx].value)) { slots[idx].value = val; dirty = true; }
        }];
      },
      useEffect(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        const changed = !prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
        if (changed) {
          slots[idx] = { deps, cleanup: prev?.cleanup };
          effects.push(() => { slots[idx].cleanup?.(); slots[idx].cleanup = fn(); });
        }
      },
    };
    const jsx = (type, props) => {
      if (typeof type === 'function') return type(props || {});
      return { type, props };
    };
    const exports = {};

    vm.runInNewContext(compiled, {
      exports,
      Object, Array, String, Number, Boolean, Set, Map, Date, Math, RegExp, Error, Promise, console,
      document: { body: {}, getElementById: () => null },
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'framer-motion') {
          return {
            AnimatePresence: ({ children }) => children,
            motion: new Proxy({}, { get: (_, tag) => ({ children, ...props }) => jsx(String(tag), { ...props, children }) }),
          };
        }
        if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
        if (name === 'react-router-dom') return { Link: ({ children, ...props }) => jsx('a', { ...props, children }) };
        if (name === '../../hooks/useBodyScrollLock') return { useBodyScrollLock() {} };
        if (name === '../../context/AuthContext') {
          return { useAuth: () => ({ user: { role: 'SYSTEM_STAFF', userId: '10' } }) };
        }
        if (name === '../../services/api') {
          return {
            api: {
              get: async url => {
                fetchCalls++;
                if (url === '/device-templates') {
                  return { data: { success: true, data: [{ id: '99', name: 'Water Preset', category: 'Nước uống', singlePressAction: 'CREATE_ORDER', cancelWindowSeconds: 60 }] } };
                }
                return { data: { success: true, data: [] } };
              },
              post: async () => {
                deployModeIdx++;
                if (deployModeIdx === 1) {
                  return {
                    status: 201,
                    data: {
                      success: false,
                      total: 1,
                      succeeded: 0,
                      failed: 1,
                      message: 'Triển khai template thất bại: Sản phẩm mặc định không thuộc cửa hàng định tuyến',
                      results: [{ deviceId: 'SOB-MISMATCH-1', success: false, reason: 'Sản phẩm mặc định không thuộc cửa hàng định tuyến' }],
                    },
                  };
                }
                return {
                  status: 201,
                  data: {
                    success: true,
                    total: 2,
                    succeeded: 1,
                    failed: 1,
                    message: 'Đã triển khai template "Water Preset" cho 1/2 thiết bị',
                    results: [
                      { deviceId: 'SOB-OK-1', success: true },
                      { deviceId: 'SOB-FAIL-2', success: false, reason: 'Không tìm thấy thiết bị đích' },
                    ],
                  },
                };
              },
            },
          };
        }
        throw new Error(`Unexpected import in StoreDeviceTemplatesPage VM: ${name}`);
      },
    });

    const walk = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)];
    const flush = async () => {
      for (let i = 0; i < 20; i++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = exports.StoreDeviceTemplatesPage();
          const jobs = effects.splice(0);
          jobs.forEach(j => j());
        }
        await Promise.resolve();
      }
    };

    await flush();
    const initialFetches = fetchCalls;
    const openDeployBtn = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Triển khai hàng loạt'));
    assert.ok(openDeployBtn, 'Template card must expose deploy modal button');
    openDeployBtn.props.onClick();
    await flush();

    // 1. Total batch failure (success: false, failed: 1) must still render message & device failure reason (not skip res.data)
    const runDeployBtn1 = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Bắt Đầu Triển Khai'));
    assert.ok(runDeployBtn1);
    await runDeployBtn1.props.onClick();
    await flush();

    const failText = JSON.stringify(tree);
    assert.equal(failText.includes('Triển khai template thất bại'), true, 'UI must display failure summary when res.data.success is false');
    assert.equal(failText.includes('SOB-MISMATCH-1'), true, 'UI must display failed deviceId');
    assert.equal(failText.includes('Sản phẩm mặc định không thuộc cửa hàng định tuyến'), true, 'UI must display per-device failure reason');
    assert.equal(fetchCalls, initialFetches, 'Total failure must not unnecessarily re-fetch list');

    // 2. Partial batch failure (succeeded: 1, failed: 1) must display both summary & failed item reason
    const runDeployBtn2 = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Bắt Đầu Triển Khai'));
    await runDeployBtn2.props.onClick();
    await flush();

    const partialText = JSON.stringify(tree);
    assert.equal(partialText.includes('1/2 thất bại'), true, 'UI must surface failed/total ratio on partial batch');
    assert.equal(partialText.includes('SOB-FAIL-2'), true, 'UI must list failed device from partial batch');
    assert.equal(partialText.includes('Không tìm thấy thiết bị đích'), true, 'UI must display failure reason for partial batch');
    assert.equal(fetchCalls > initialFetches, true, 'Partial success must refresh data');
  });

  test(`${prefix}components/devices/ReturnInspectionPanel separates hardware receipt from financial PENDING_APPROVAL refund`, async () => {
    const src = readFileSync(new URL(`${prefix}components/devices/ReturnInspectionPanel.tsx`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;

    const slots = [];
    const effects = [];
    let cursor = 0;
    let dirty = true;
    let tree;
    let listFetches = 0;
    let confirmPosts = 0;
    let confirmedCallbacks = 0;
    const toasts = { success: [], error: [], warning: [], info: [] };

    const react = {
      default: {},
      useState(initial) {
        const idx = cursor++;
        if (!(idx in slots)) slots[idx] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[idx].value, next => {
          const val = typeof next === 'function' ? next(slots[idx].value) : next;
          if (!Object.is(val, slots[idx].value)) { slots[idx].value = val; dirty = true; }
        }];
      },
      useRef: initial => slots[cursor++] ||= { current: initial },
      useCallback(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        if (!prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
          slots[idx] = { fn, deps };
        }
        return slots[idx].fn;
      },
      useEffect(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        const changed = !prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
        if (changed) {
          slots[idx] = { deps, cleanup: prev?.cleanup };
          effects.push(() => { slots[idx].cleanup?.(); slots[idx].cleanup = fn(); });
        }
      },
    };
    const jsx = (type, props) => (typeof type === 'function' ? type(props || {}) : { type, props });
    const exports = {};
    class MockAbortController {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    }

    vm.runInNewContext(compiled, {
      exports,
      Object, Array, String, Number, Boolean, Set, Map, Date, Math, RegExp, Error, Promise, console, encodeURIComponent,
      AbortController: MockAbortController,
      document: { body: {}, getElementById: () => null },
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: ({ children }) => children };
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => () => jsx('span', { 'data-icon': String(key) }) });
        if (name === '../../context/ToastContext') {
          return {
            toast: {
              success: m => toasts.success.push(m),
              error: m => toasts.error.push(m),
              warning: m => toasts.warning.push(m),
              info: m => toasts.info.push(m),
            },
          };
        }
        if (name === '../../services/api') {
          return {
            api: {
              get: async url => {
                if (url === '/rentals/returns') {
                  listFetches++;
                  return {
                    data: {
                      success: true,
                      data: [
                        {
                          returnId: '501',
                          returnCode: 'RET-2026-0501',
                          rentalId: '88',
                          rentalCode: 'RNT-2026-0088',
                          buttonId: '42',
                          deviceId: 'SOB-000042',
                          buttonCode: 'BTN-000042',
                          customName: 'Nút Nước 20L',
                          inventoryState: 'RETURN_IN_TRANSIT',
                          status: 'PENDING_RECEIPT',
                          customerName: 'Nguyễn Văn Khách',
                          customerPhone: '0909123456',
                          store: { storeId: '10', name: 'Cửa hàng A', code: 'STORE-A' },
                          depositAmount: 150000,
                        },
                      ],
                      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
                    },
                  };
                }
                return { data: { success: true, data: [] } };
              },
              post: async () => {
                confirmPosts++;
                if (confirmPosts === 1) {
                  const err = new Error('Network temporary failure');
                  err.response = { status: 503, data: { message: 'Kết nối tạm gián đoạn' } };
                  throw err;
                }
                return {
                  data: {
                    success: true,
                    message: 'Đã tiếp nhận nút trả & xếp hàng đợi hoàn cọc.',
                    data: {
                      button: { deviceId: 'SOB-000042', inventoryState: 'ALLOCATED_TO_STORE' },
                      depositRefund: {
                        refundId: '77',
                        refundCode: 'DEP-2026-0077',
                        status: 'PENDING_APPROVAL',
                        refundAmount: 150000,
                      },
                    },
                  },
                };
              },
            },
          };
        }
        throw new Error(`Unexpected import in ReturnInspectionPanel VM: ${name}`);
      },
    });

    const walk = node => (!node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)]);
    const flush = async () => {
      for (let i = 0; i < 20; i++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = exports.ReturnInspectionPanel({
            onConfirmed: async () => {
              confirmedCallbacks++;
            },
          });
          const jobs = effects.splice(0);
          jobs.forEach(j => j());
        }
        await Promise.resolve();
      }
    };

    await flush();
    assert.equal(listFetches, 1);
    assert.equal(JSON.stringify(tree).includes('RET-2026-0501'), true);

    const openBtn = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Kiểm tra & Nhận nút'));
    assert.ok(openBtn, 'Return row must expose inspection modal button');
    openBtn.props.onClick();
    await flush();

    const noteTextarea = walk(tree).find(n => n.type === 'textarea');
    assert.ok(noteTextarea, 'Inspection modal must render inspectionNote textarea');
    noteTextarea.props.onChange({ target: { value: 'Pin tốt, nút bấm phản hồi chuẩn' } });
    await flush();

    // 1. First submit fails: error alert shows and note stays intact for retry
    const formFail = walk(tree).find(n => n.type === 'form');
    await formFail.props.onSubmit({ preventDefault() {} });
    await flush();
    assert.equal(JSON.stringify(tree).includes('Kết nối tạm gián đoạn'), true);
    const noteAfterFail = walk(tree).find(n => n.type === 'textarea');
    assert.equal(noteAfterFail?.props?.value, 'Pin tốt, nút bấm phản hồi chuẩn');

    // 2. Retry succeeds: renders separated hardware retrieval + PENDING_APPROVAL refund queue
    const formOk = walk(tree).find(n => n.type === 'form');
    await formOk.props.onSubmit({ preventDefault() {} });
    await flush();
    const okText = JSON.stringify(tree);
    assert.equal(okText.includes('Kết quả kỹ thuật: Đã thu hồi thiết bị về kho'), true);
    assert.equal(okText.includes('PENDING_APPROVAL'), true);
    assert.equal(okText.includes('DEP-2026-0077'), true);
    assert.equal(confirmedCallbacks, 1);
    assert.equal(listFetches, 2);
  });

  test(`${prefix}components/devices/PlatformDevicesWorkspace Bulk CSV preview validates duplicates/errors and submits clean rows`, async () => {
    const src = readFileSync(new URL(`${prefix}components/devices/PlatformDevicesWorkspace.tsx`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;

    const slots = [];
    const effects = [];
    let cursor = 0;
    let dirty = true;
    let tree;
    const bulkPosts = [];
    const toasts = { success: [], error: [], warning: [], info: [] };

    const react = {
      default: {},
      useState(initial) {
        const idx = cursor++;
        if (!(idx in slots)) slots[idx] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[idx].value, next => {
          const val = typeof next === 'function' ? next(slots[idx].value) : next;
          if (!Object.is(val, slots[idx].value)) { slots[idx].value = val; dirty = true; }
        }];
      },
      useRef: initial => slots[cursor++] ||= { current: initial },
      useCallback(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        if (!prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
          slots[idx] = { fn, deps };
        }
        return slots[idx].fn;
      },
      useEffect(fn, deps) {
        const idx = cursor++;
        const prev = slots[idx];
        const changed = !prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps[i]));
        if (changed) {
          slots[idx] = { deps, cleanup: prev?.cleanup };
          effects.push(() => { slots[idx].cleanup?.(); slots[idx].cleanup = fn(); });
        }
      },
    };
    const jsx = (type, props) => (typeof type === 'function' ? type(props || {}) : { type, props });
    const exports = {};
    class MockAbortController {
      constructor() {
        this.signal = { aborted: false };
      }
      abort() {
        this.signal.aborted = true;
      }
    }

    vm.runInNewContext(compiled, {
      exports,
      Object, Array, String, Number, Boolean, Set, Map, Date, Math, RegExp, Error, Promise, console,
      setTimeout, clearTimeout,
      AbortController: MockAbortController,
      document: { body: {}, getElementById: () => null },
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: ({ children }) => children };
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'framer-motion') {
          return {
            AnimatePresence: ({ children }) => children,
            motion: new Proxy({}, { get: (_, tag) => ({ children, ...props }) => jsx(String(tag), { ...props, children }) }),
          };
        }
        if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => () => jsx('span', { 'data-icon': String(key) }) });
        if (name === '../../utils/device-custody') return loadTsModule(`${prefix}utils/device-custody.ts`);
        if (name === '../../context/ToastContext') {
          return {
            toast: {
              success: m => toasts.success.push(m),
              error: m => toasts.error.push(m),
              warning: m => toasts.warning.push(m),
              info: m => toasts.info.push(m),
            },
          };
        }
        if (name === '../../services/api') {
          return {
            api: {
              get: async () => ({ data: { success: true, data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } } }),
              post: async (url, payload) => {
                if (url === '/devices/bulk-import') {
                  bulkPosts.push(payload);
                  return { data: { success: true, count: payload.rows.length, data: payload.rows } };
                }
                return { data: { success: true, data: [] } };
              },
            },
          };
        }
        throw new Error(`Unexpected import in PlatformDevicesWorkspace VM: ${name}`);
      },
    });

    // Pure CSV parse & duplicate/format validator checks
    const parsed = exports.parseBulkCsvText([
      'deviceId,buttonCode,serialNumber,macAddress,buttonName',
      'SOB-OK-101,BTN-OK-101,SN-1,AA:BB:CC:DD:EE:01,Nut Tot',
      'SOB-OK-101,BTN-DUP-01,SN-2,INVALID_MAC,Nut Loi 1',
      ',,,,Nut Thieu Ma',
    ].join('\n'));
    assert.equal(parsed.length, 3);
    const validated = exports.validateBulkCsvRows(parsed);
    assert.equal(validated[0].isValid, false, 'Duplicate deviceId marks both colliding rows invalid');
    assert.equal(validated[1].errors.some(e => e.includes('MAC')), true);
    assert.equal(validated[2].isValid, false, 'Missing both deviceId and buttonCode marks row invalid');

    const walk = node => (!node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(walk)]);
    const flush = async () => {
      for (let i = 0; i < 20; i++) {
        if (dirty) {
          dirty = false;
          cursor = 0;
          tree = exports.PlatformDevicesWorkspace({ unassignedDevices: [], allDevices: [], stores: [] });
          const jobs = effects.splice(0);
          jobs.forEach(j => j());
        }
        await Promise.resolve();
      }
    };

    await flush();
    const openCsvBtn = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Nhập lô CSV'));
    assert.ok(openCsvBtn, 'Toolbar must expose Nhập lô CSV button');
    openCsvBtn.props.onClick();
    await flush();

    const csvTextarea = walk(tree).find(n => n.type === 'textarea');
    assert.ok(csvTextarea, 'Bulk CSV modal must render textarea');
    csvTextarea.props.onChange({
      target: {
        value: [
          'deviceId,buttonCode,serialNumber,macAddress,buttonName',
          'SOB-OK-101,BTN-OK-101,SN-1,AA:BB:CC:DD:EE:01,Nut Tot',
          ',,SN-BAD,BADMAC,Thieu Ma',
        ].join('\n'),
      },
    });
    await flush();

    assert.equal(JSON.stringify(tree).includes('Hợp lệ:'), true);
    assert.equal(JSON.stringify(tree).includes('Lỗi:'), true);
    const disabledSubmit = walk(tree).find(n => n.type === 'button' && n.props?.type === 'submit' && JSON.stringify(n.props?.children).includes('Xác Nhận Nhập'));
    assert.equal(disabledSubmit?.props?.disabled, true, 'Submit button must remain disabled while invalid rows exist');

    const removeInvalidBtn = walk(tree).find(n => n.type === 'button' && JSON.stringify(n.props?.children).includes('Loại bỏ dòng lỗi'));
    assert.ok(removeInvalidBtn, 'Modal must expose one-click Loại bỏ dòng lỗi button');
    removeInvalidBtn.props.onClick();
    await flush();

    const enabledSubmit = walk(tree).find(n => n.type === 'button' && n.props?.type === 'submit' && JSON.stringify(n.props?.children).includes('Xác Nhận Nhập'));
    assert.equal(enabledSubmit?.props?.disabled, false, 'Submit button enables once invalid rows are removed');

    const bulkDialog = walk(tree).find(n => n.props?.['aria-label'] === 'Nhập lô thiết bị từ CSV');
    const bulkForm = walk(bulkDialog).find(n => n.type === 'form');
    await bulkForm.props.onSubmit({ preventDefault() {} });
    await flush();

    assert.equal(bulkPosts.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(bulkPosts[0].rows)), [
      {
        deviceId: 'SOB-OK-101',
        buttonCode: 'BTN-OK-101',
        serialNumber: 'SN-1',
        macAddress: 'AA:BB:CC:DD:EE:01',
        buttonName: 'Nut Tot',
      },
    ]);
    assert.equal(JSON.stringify(tree).includes('Đã nhập thành công 1 nút bấm vào kho hệ thống'), true);
    assert.equal(toasts.success.length, 1);
  });
}

if (HAS_MIRROR) {
  test('src/ and frontend/src/ modified files remain byte-identical', () => {
  const syncedFiles = [
    'App.tsx',
    'components/admin/AdminAccountNavigation.tsx',
    'components/common/LogoutConfirmModal.tsx',
    'components/common/NotificationBellPopover.tsx',
    'components/devices/PlatformDevicesWorkspace.tsx',
    'components/devices/ReturnInspectionPanel.tsx',
    'components/devices/WarrantyPanel.tsx',
    'context/AuthContext.tsx',
    'hooks/useOrderSync.ts',
    'layouts/Navbar.tsx',
    'layouts/Sidebar.tsx',
    'pages/admin/AdminDashboard.tsx',
    'pages/auth/AuthPage.tsx',
    'pages/auth/ForbiddenPage.tsx',
    'pages/operations/DriverDeliveryPage.tsx',
    'pages/operations/DriverShiftManagement.tsx',
    'pages/profile/ProfilePage.tsx',
    'pages/store/StoreDeviceTemplatesPage.tsx',
    'pages/store/StoreWalletPage.tsx',
    'pages/system-staff/SystemStaffWorkspace.tsx',
    'services/device-connection.ts',
    'services/device-product-removal.ts',
    'services/driver-workflow.ts',
    'services/drivers.service.ts',
    'services/phone-auth-flow.ts',
    'services/socket.ts',
    'services/warranty.ts',
    'types/index.ts',
    'utils/authority.ts',
    'utils/device-custody.ts',
  ];
    for (const rel of syncedFiles) {
      const a = readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
      const b = readFileSync(new URL(`../frontend/src/${rel}`, import.meta.url), 'utf8');
      assert.equal(a, b, `Mirror mismatch for ${rel}`);
    }
  });
}
