import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as banking from '../src/services/banking-flow.ts';
import * as frontendBanking from '../frontend/src/services/banking-flow.ts';
import { financeError } from '../src/services/store-finance-flow.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ok = (data, pagination) => ({ data: { success: true, data, pagination } });
const account = { id: '31', bankBin: '970422', bankCode: 'MB', bankName: 'MBBank', accountName: 'NGUYEN VAN A', accountNumberMasked: '******1234', verificationStatus: 'UNVERIFIED', isDefault: true };
const future = '2099-01-01T00:00:00.000Z';
const session = { accountId: '31', sessionReference: 'CUST_VRF_TEST', orderCode: '901', checkoutUrl: 'https://pay.payos.vn/web/test', amount: 2000, sessionStatus: 'ACTIVE', verificationStatus: 'PENDING', expiresAt: future };
const pendingStatus = () => ({ accountId: '31', accountVerificationStatus: 'UNVERIFIED', message: 'Đang chờ chuyển khoản', session: { sessionReference: session.sessionReference, sessionStatus: 'ACTIVE', verificationStatus: 'PENDING', paymentStatus: 'PENDING', refundStatus: 'NONE', expiresAt: future, isExpired: false, refundSummary: { totalObligationAmount: 0, totalRefundedAmount: 0, totalPendingRefundAmount: 0 } } });
const transaction = { verificationId: '21', bankAccountId: '31', storeId: '12', bankName: 'MBBank', accountNumberMasked: '******1234', accountName: 'NGUYEN VAN A', referenceCode: 'VERIFY_TEST', expectedAmount: 2000, actualAmount: null, status: 'PENDING', refundStatus: null, expiresAt: future, createdAt: '2026-11-08T00:00:00Z' };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function harness(prefix, { component = 'customer', override, props = {} } = {}) {
  const file = component === 'customer' ? 'pages/customer/CustomerBankingPage.tsx' : 'components/store/StoreBankVerificationHistory.tsx';
  const code = ts.transpileModule(readFileSync(new URL(prefix + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let cursor = 0, dirty = true, tree, effects = [], mounted = true, cooldown = 0;
  const calls = [], slots = [], intervals = new Map(), events = new Map(), resumes = [];
  let serverStatus = pendingStatus(), serverAccounts = [account];
  const document = { visibilityState: 'visible', addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key), getElementById: () => ({ scrollIntoView() {} }) };
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) { const i = cursor++; slots[i] ||= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { const value = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, n) => !Object.is(v, slots[i].deps[n]))) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, n) => !Object.is(v, slots[i].deps[n]))) { const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const transport = Object.fromEntries(['get', 'post'].map(method => [method, async (path, body) => {
    calls.push({ method, path, body });
    const custom = override?.(method, path, body);
    if (custom !== undefined) return custom;
    if (path === '/banks') return ok([{ bin: '970422', code: 'MB', name: 'Ngân hàng Quân Đội', shortName: 'MBBank' }]);
    if (path === '/customers/me/bank-accounts') { if (method === 'post') { serverAccounts = [{ ...account, id: '32' }]; return ok(serverAccounts[0]); } return ok(serverAccounts); }
    if (path.endsWith('/verification-status')) return ok({ ...serverStatus, accountId: path.split('/').at(-2) });
    if (path.endsWith('/initiate-verification')) return ok(session);
    if (path.endsWith('/verification-history')) return ok([], { page: body.params.page, pageSize: 10, total: 0 });
    if (path.includes('/bank-account-verifications/')) return ok(transaction);
    if (path.includes('/bank-account-verifications')) return ok([transaction], { page: body.params.page, pageSize: 10, totalItems: 1 });
    throw new Error(`Unhandled ${method} ${path}`);
  }]));
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, Date,
    document,
    window: { setInterval(fn) { const id = intervals.size + 1; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id), addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { id: '7', role: 'CUSTOMER' } }) };
      if (name.endsWith('/api')) return { api: transport };
      if (name.endsWith('/banking-flow')) return banking;
      if (name.endsWith('/store-finance-flow')) return { financeError };
      if (name.endsWith('/request-backoff')) return { getApiRetryUntil: () => cooldown };
      if (name.endsWith('/BankingPrimitives')) return { BankBadge: 'bank-badge', BankCopy: 'bank-copy', BankError: 'bank-error', BankPagination: 'bank-pagination', bankButton: 'button', bankInput: 'input' };
      if (name.endsWith('/OperationPrimitives')) return { card: 'card', primaryButton: 'primary' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const walk = value => !value || typeof value !== 'object' ? [] : [value, ...[value.props?.children].flat(Infinity).flatMap(walk)];
  const text = value => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : [value.props?.children].flat(Infinity).map(text).join('');
  const app = {
    calls, resumes, document, get nodes() { return walk(tree); }, get text() { return text(tree); },
    setStatus(value) { serverStatus = value; }, setCooldown(value) { cooldown = value; },
    find(type, label) { const node = walk(tree).find(n => n.type === type && (text(n).includes(label) || n.props['aria-label'] === label)); assert.ok(node, `Missing ${type}: ${label}`); return node; },
    async flush() { for (let i = 0; i < 45; i++) { if (dirty && mounted) { cursor = 0; dirty = false; tree = component === 'customer' ? exports.CustomerBankingWorkspace() : exports.StoreBankVerificationHistory({ storeId: '12', refreshKey: 0, onResume: tx => resumes.push(tx), ...props }); const jobs = effects; effects = []; jobs.forEach(fn => fn()); } await Promise.resolve(); } },
    async click(label) { const node = this.find('button', label); assert.ok(!node.props.disabled, `Disabled ${label}`); await node.props.onClick?.(); await this.flush(); },
    async input(label, value) { const wrap = this.find('label', label); const node = walk(wrap).find(n => n.type === 'input' || n.type === 'select'); assert.ok(node); node.props.onChange({ target: { value, checked: value } }); await this.flush(); },
    async submit() { const node = walk(tree).find(n => n.type === 'form'); assert.ok(node); await node.props.onSubmit({ preventDefault() {} }); await this.flush(); },
    async tick() { for (const fn of [...intervals.values()]) await fn(); await this.flush(); },
    unmount() { mounted = false; slots.forEach(slot => slot.cleanup?.()); },
  };
  return app;
}

for (const flow of [banking, frontendBanking]) {
  test('bank contracts preserve ids, enforce DTO fields and validate checkout origins', async () => {
    const payload = flow.customerBankPayload({ bin: '970422', code: 'MB', name: 'MBBank' }, '00123456', ' Nguyễn Văn Định ', true);
    assert.equal(payload.accountName, 'NGUYEN VAN DINH'); assert.equal(payload.accountNumber, '00123456');
    assert.throws(() => flow.customerBankPayload({ bin: '970422' }, '12 34567', 'TEST NAME', true));
    assert.equal(flow.bankingId('90071992547409931'), '90071992547409931');
    for (const url of ['javascript:alert(1)', 'https://payos.vn.evil.invalid/x', 'https://payos.vn@evil.invalid/x', 'http://pay.payos.vn/x']) assert.equal(flow.bankCheckoutUrl(url), null);
    assert.equal(flow.bankCheckoutUrl(session.checkoutUrl), session.checkoutUrl);
    const calls = [];
    const api = flow.createBankingFlow({ get: async (path, config) => { calls.push({ path, config }); return ok([], { page: 2, pageSize: 10, totalItems: 21 }); } });
    const page = await api.storeHistory('12', 2, 'PENDING'); assert.equal(page.pages, 3);
    assert.deepEqual(calls[0], { path: '/stores/12/bank-account-verifications', config: { params: { page: 2, pageSize: 10, status: 'PENDING' } } });
    assert.throws(() => flow.bankingPage(ok([], {})));
  });
  test('bank detail rejects another store and does not infer financial success', async () => {
    const api = flow.createBankingFlow({ get: async () => ok({ ...transaction, storeId: '99' }), post: async () => ok({ ...session, amount: 1 }) });
    await assert.rejects(api.storeDetail('12', '21'), /cửa hàng/);
    await assert.rejects(api.initiateCustomerVerification('31'), /hợp lệ/);
    assert.equal(flow.customerBankNeedsPolling({ ...pendingStatus(), session: { ...pendingStatus().session, expiresAt: '2000-01-01', refundStatus: 'NONE' } }), false);
    assert.equal(flow.customerBankNeedsPolling({ ...pendingStatus(), accountVerificationStatus: 'VERIFIED', session: { ...pendingStatus().session, expiresAt: '2000-01-01', refundStatus: 'PROCESSING_REFUND' } }), true);
    assert.equal(flow.bankMoney(null), '—');
  });
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}customer account creation sends exact DTO and never initiates payment automatically`, async () => {
    const app = harness(prefix); await app.flush(); await app.click('Thêm tài khoản');
    await app.input('Ngân hàng', '970422'); await app.input('Số tài khoản', '00123456'); await app.input('Tên chủ tài khoản', 'Nguyễn Văn A');
    await app.input('Tôi xác nhận', true); await app.submit();
    const post = app.calls.find(c => c.method === 'post');
    assert.deepEqual(post.body, { bankBin: '970422', bankCode: 'MB', bankName: 'Ngân hàng Quân Đội', accountNumber: '00123456', accountName: 'NGUYEN VAN A', isDefault: true });
    assert.equal(app.calls.filter(c => c.method === 'post').length, 1); assert.equal(app.text.includes('Đã thêm tài khoản'), true); app.unmount();
  });
  test(`${prefix}PayOS link requires an explicit action and disappears when money is received`, async () => {
    const app = harness(prefix); await app.flush(); await app.click('Xem xác minh & hoàn tiền');
    assert.equal(app.nodes.some(n => n.type === 'a'), false);
    await app.click('Tiếp tục phiên xác minh');
    assert.equal(app.find('a', 'Mở thanh toán PayOS').props.href, session.checkoutUrl);
    assert.equal(app.calls.filter(c => c.path.endsWith('/initiate-verification')).length, 1);
    const status = pendingStatus(); status.accountVerificationStatus = 'VERIFIED'; status.session.verificationStatus = 'VERIFIED'; status.session.paymentStatus = 'PAID'; status.session.refundStatus = 'PROCESSING_REFUND'; status.session.refundSummary = { totalObligationAmount: 2000, totalRefundedAmount: 0, totalPendingRefundAmount: 2000 };
    app.setStatus(status); await app.tick();
    assert.equal(app.nodes.some(n => n.type === 'a'), false);
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'VERIFIED'));
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'PROCESSING_REFUND'));
    app.unmount();
  });
  test(`${prefix}customer polling respects hidden tabs, 429 backoff and stops after a failed read`, async () => {
    let fail = false;
    const app = harness(prefix, { override: (method, path) => path.endsWith('/verification-status') && fail ? Promise.reject(new Error('Máy chủ đang bận')) : undefined });
    await app.flush(); await app.click('Xem xác minh & hoàn tiền');
    const count = () => app.calls.filter(c => c.path.endsWith('/verification-status')).length;
    const initial = count(); app.document.visibilityState = 'hidden'; await app.tick(); assert.equal(count(), initial);
    app.document.visibilityState = 'visible'; app.setCooldown(123); await app.tick(); assert.equal(count(), initial);
    app.setCooldown(0); fail = true; await app.tick(); const failed = count(); await app.tick(); assert.equal(count(), failed);
    assert.ok(app.nodes.some(n => n.type === 'bank-error' && n.props.message.includes('Máy chủ đang bận'))); app.unmount();
  });
  test(`${prefix}timeout cannot auto-retry account creation or claim success`, async () => {
    const app = harness(prefix, { override: (method, path) => method === 'post' && path === '/customers/me/bank-accounts' ? Promise.reject(new Error('timeout')) : undefined });
    await app.flush(); await app.click('Thêm tài khoản'); await app.input('Ngân hàng', '970422'); await app.input('Số tài khoản', '00123456'); await app.input('Tên chủ tài khoản', 'TEST OWNER'); await app.input('Tôi xác nhận', true); await app.submit();
    assert.equal(app.find('button', 'Lưu tài khoản').props.disabled, true);
    assert.equal(app.calls.filter(c => c.method === 'post').length, 1);
    assert.ok(!app.text.includes('Đã thêm tài khoản')); app.unmount();
  });
  test(`${prefix}account-list 403 is shown independently of history and blocks mutations`, async () => {
    const app = harness(prefix, { override: (method, path) => path === '/customers/me/bank-accounts' ? Promise.reject({ response: { status: 403, data: { message: 'Không có quyền ngân hàng' } } }) : undefined });
    await app.flush(); assert.equal(app.find('button', 'Thêm tài khoản').props.disabled, true);
    assert.ok(app.nodes.some(n => n.type === 'bank-error' && n.props.message.includes('Không có quyền')));
    assert.ok(app.calls.some(c => c.path.endsWith('/verification-history'))); app.unmount();
  });
  test(`${prefix}store pending recovery and detail use server transaction and refund states`, async () => {
    const app = harness(prefix, { component: 'store' }); await app.flush();
    assert.equal(app.resumes.length, 1); assert.equal(app.resumes[0].verificationId, '21');
    assert.deepEqual(app.calls.find(c => c.path.endsWith('/bank-account-verifications') && c.body.params.status)?.body.params, { page: 1, pageSize: 10, status: 'PENDING' });
    await app.click('Xem phiên VERIFY_TEST');
    assert.ok(app.calls.some(c => c.path === '/bank-account-verifications/21'));
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === null && n.props.refund));
    assert.ok(app.text.includes('—')); app.unmount();
  });
  test(`${prefix}history ignores old-page responses and keeps an error visible`, async () => {
    const stale = deferred(); let first = true;
    const app = harness(prefix, { override: (method, path, body) => {
      if (!path.endsWith('/verification-history')) return undefined;
      if (first) { first = false; return ok([], { page: 1, pageSize: 10, total: 30 }); }
      if (body.params.page === 2) return stale.promise;
      return ok([], { page: 3, pageSize: 10, total: 30 });
    } });
    await app.flush(); app.nodes.find(n => n.type === 'bank-pagination').props.onPage(2); await app.flush();
    // Force navigation as a newer request while the old page is in flight.
    app.nodes.find(n => n.type === 'bank-pagination').props.onPage(3); await app.flush();
    stale.resolve(ok([], { page: 2, pageSize: 10, total: 30 })); await app.flush();
    assert.equal(app.nodes.find(n => n.type === 'bank-pagination').props.page, 3); app.unmount();
  });
  test(`${prefix}transfer instructions show server recipient and hide expired QR`, () => {
    const source = readFileSync(new URL(prefix + 'components/common/BankingPrimitives.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const exports = {}; vm.runInNewContext(code, { exports, URL, Date, require: name => name.endsWith('/banking-flow') ? banking : require(name) });
    const receipt = { amount: 2000, referenceCode: 'VERIFY_ABC', expiresAt: future, recipientBankBin: '970422', recipientBankName: 'RECEIVING BANK', recipientAccountNumber: '0012345678', recipientAccountHolder: 'PLATFORM', qrCodeUrl: 'https://img.vietqr.io/image/example.png' };
    const render = value => renderToStaticMarkup(React.createElement(exports.BankTransferInstructions, { receipt: value }));
    const html = render(receipt); assert.ok(html.includes('RECEIVING BANK')); assert.ok(html.includes('0012345678')); assert.ok(html.includes('<img'));
    const expired = render({ ...receipt, expiresAt: '2000-01-01' }); assert.ok(!expired.includes('<img')); assert.ok(expired.includes('Không chuyển tiền'));
    const missing = render({ ...receipt, recipientAccountNumber: undefined }); assert.ok(!missing.includes('<img')); assert.ok(missing.includes('Chưa có đầy đủ'));
  });
}

test('customer banking route is lazy, customer-scoped and both frontend defaults target deployed backend', () => {
  for (const prefix of ['../src/', '../frontend/src/']) {
    const app = readFileSync(new URL(prefix + 'App.tsx', import.meta.url), 'utf8');
    assert.match(app, /React\.lazy\(\(\) => import\('\.\/pages\/customer\/CustomerBankingPage'\)/);
    const source = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let route;
    const visit = node => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Route' && node.attributes.properties.some(a => a.name?.getText(source) === 'path' && a.initializer?.text === '/customer/banking')) route = node; ts.forEachChild(node, visit); };
    visit(source); assert.ok(route); let parent = route.parent; let guarded = false;
    while (parent) { if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(source) === 'Route' && parent.openingElement.getText(source).includes("allowedRoles={['CUSTOMER']}")) guarded = true; parent = parent.parent; }
    assert.equal(guarded, true);
  }
  for (const name of ['../vercel.json', '../frontend/vercel.json']) assert.equal(JSON.parse(readFileSync(new URL(name, import.meta.url))).rewrites[0].destination, 'https://backend-fae8.onrender.com/api/v1/:path*');
});
