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

for (const prefix of ['../src/', '../frontend/src/']) {
  test(prefix + 'reload restores an existing payment and synchronizes verification and history without a click or POST', async () => {
    let paid = false;
    const row = () => ({ sessionId: '901', accountId: '31', sessionReference: session.sessionReference, sessionStatus: paid ? 'CONSUMED' : 'ACTIVE', verificationStatus: paid ? 'VERIFIED' : 'PENDING', paymentReceived: paid, receivedAmount: paid ? 2000 : null, refundStatus: paid ? 'PROCESSING_REFUND' : 'NONE', totalRefundedAmount: 0, totalPendingRefundAmount: paid ? 2000 : 0, expiresAt: future, createdAt: future });
    const app = harness(prefix, { override: (method, path) => path.endsWith('/verification-history') ? ok([row()], { page: 1, pageSize: 10, total: 1 }) : undefined });
    const status = pendingStatus(); status.session.checkoutUrl = session.checkoutUrl; app.setStatus(status);
    await app.flush();
    assert.equal(app.find('a', 'Mở thanh toán PayOS').props.href, session.checkoutUrl);
    assert.equal(app.calls.filter(c => c.path.endsWith('/verification-status')).length, 1);
    paid = true;
    app.setStatus({ ...status, accountVerificationStatus: 'VERIFIED', session: { ...status.session, sessionStatus: 'CONSUMED', verificationStatus: 'VERIFIED', paymentStatus: 'PAID', refundStatus: 'PROCESSING_REFUND' } });
    await app.tick();
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'VERIFIED'));
    assert.ok(app.nodes.some(n => n.type === 'td' && n.props.children === banking.bankMoney(2000)));
    assert.ok(!app.nodes.some(n => n.type === 'a'));
    assert.equal(app.calls.some(c => c.method !== 'get'), false);
    app.unmount();
  });
  test(prefix + 'PayOS return refreshes an expired session while payment alone cannot claim verified ownership', async () => {
    const row = { sessionId: '901', accountId: '31', sessionReference: session.sessionReference, sessionStatus: 'ACTIVE', verificationStatus: 'PENDING', paymentReceived: false, refundStatus: 'NONE', expiresAt: '2000-01-01', createdAt: future };
    const app = harness(prefix, { override: (method, path) => path.endsWith('/verification-history') ? ok([row], { page: 1, pageSize: 10, total: 1 }) : undefined });
    const expired = pendingStatus(); Object.assign(expired.session, { expiresAt: '2000-01-01', isExpired: true }); app.setStatus(expired);
    await app.flush();
    const reads = () => app.calls.filter(c => c.path.endsWith('/verification-status')).length;
    await app.tick(); assert.equal(reads(), 1);
    app.setStatus({ ...expired, session: { ...expired.session, sessionStatus: 'CONSUMED', paymentStatus: 'PAID', verificationStatus: 'PENDING_SOURCE_EVIDENCE', refundStatus: 'PENDING_MANUAL_REFUND' } });
    await app.event('focus'); assert.equal(reads(), 2);
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'PAID'));
    assert.ok(!app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'VERIFIED'));
    assert.ok(!app.nodes.some(n => n.type === 'a'));
    const initiate = app.nodes.find(n => n.type === 'button' && String(n.props.children).includes('Bắt đầu xác minh'));
    assert.ok(initiate?.props.disabled);
    assert.equal(app.calls.some(c => c.method !== 'get'), false); app.unmount();
  });
}

for (const flow of [banking, frontendBanking]) {
  test('resume chooses the newest unresolved session belonging to a current account', () => {
    const rows = [
      { accountId: '99', verificationStatus: 'PENDING', createdAt: '2099-01-01' },
      { accountId: '32', verificationStatus: 'PENDING', createdAt: '2026-11-12' },
      { accountId: '31', verificationStatus: 'PENDING', createdAt: '2026-11-11' },
    ];
    assert.equal(flow.customerBankResumeAccount([account, { ...account, id: '32' }], rows).id, '32');
    assert.equal(flow.customerBankResumeAccount([account], [{ accountId: '31', verificationStatus: 'VERIFIED', refundStatus: 'REFUNDED' }]), null);
    assert.equal(flow.customerBankResumeAccount([], rows), null);
  });
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(prefix + 'customer payment polling refreshes history on server changes without posting or reloading the page', async () => {
    let received = false;
    const app = harness(prefix, { override: (method, path) => path.endsWith('/verification-history')
      ? ok(received ? [{ sessionId: '901', sessionReference: session.sessionReference, sessionStatus: 'CONSUMED', verificationStatus: 'VERIFIED', paymentReceived: true, receivedAmount: 2000, refundStatus: 'PROCESSING_REFUND', totalRefundedAmount: 0, totalPendingRefundAmount: 2000, createdAt: future, expiresAt: future }] : [], { page: 1, pageSize: 10, total: received ? 1 : 0 }) : undefined });
    await app.flush(); await app.click('Xem xác minh & hoàn tiền');
    const historyReads = () => app.calls.filter(c => c.path.endsWith('/verification-history')).length;
    const initialReads = historyReads();
    await app.tick(); assert.equal(historyReads(), initialReads);
    received = true;
    const status = pendingStatus();
    status.accountVerificationStatus = 'VERIFIED';
    Object.assign(status.session, { sessionStatus: 'CONSUMED', verificationStatus: 'VERIFIED', paymentStatus: 'PAID', refundStatus: 'PROCESSING_REFUND' });
    app.setStatus(status); await app.tick();
    assert.equal(historyReads(), initialReads + 1);
    assert.ok(app.nodes.some(n => n.type === 'td' && n.props.children === banking.bankMoney(2000)));
    await app.tick(); assert.equal(historyReads(), initialReads + 1);
    app.setStatus({ ...status, session: { ...status.session, refundStatus: 'REFUNDED' } }); await app.tick();
    assert.equal(historyReads(), initialReads + 2);
    const finalReads = app.calls.length; await app.tick(); assert.equal(app.calls.length, finalReads);
    assert.equal(app.calls.some(c => c.method !== 'get'), false);
    app.unmount();
  });
}

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
  const transport = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, async (path, body) => {
    calls.push({ method, path, body });
    const custom = override?.(method, path, body);
    if (custom !== undefined) return custom;
    if (path === '/banks') return ok([{ bin: '970422', code: 'MB', name: 'Ngân hàng Quân Đội', shortName: 'MBBank' }]);
    if (path === '/customers/me/bank-accounts') { if (method === 'post') { serverAccounts = [{ ...account, id: '32' }]; return ok(serverAccounts[0]); } return ok(serverAccounts); }
    if (method === 'patch' && path.endsWith('/default')) {
      const id = path.split('/').at(-2);
      serverAccounts = serverAccounts.map(account => ({ ...account, isDefault: account.id === id }));
      return ok(serverAccounts.find(account => account.id === id));
    }
    if (method === 'delete') {
      serverAccounts = serverAccounts.filter(account => account.id !== path.split('/').at(-1));
      return ok({ success: true });
    }
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
    setStatus(value) { serverStatus = value; }, setAccounts(value) { serverAccounts = value; }, setCooldown(value) { cooldown = value; },
    find(type, label) { const node = walk(tree).find(n => n.type === type && (text(n).includes(label) || n.props['aria-label'] === label)); assert.ok(node, `Missing ${type}: ${label}`); return node; },
    async flush() { for (let i = 0; i < 45; i++) { if (dirty && mounted) { cursor = 0; dirty = false; tree = component === 'customer' ? exports.CustomerBankingWorkspace() : exports.StoreBankVerificationHistory({ storeId: '12', refreshKey: 0, onResume: tx => resumes.push(tx), ...props }); const jobs = effects; effects = []; jobs.forEach(fn => fn()); } await Promise.resolve(); } },
    async click(label) { const node = this.find('button', label); assert.ok(!node.props.disabled, `Disabled ${label}`); await node.props.onClick?.({ currentTarget: { focus() {} } }); await this.flush(); },
    async input(label, value) { const wrap = this.find('label', label); const node = walk(wrap).find(n => n.type === 'input' || n.type === 'select'); assert.ok(node); node.props.onChange({ target: { value, checked: value } }); await this.flush(); },
    async submit() { const node = walk(tree).find(n => n.type === 'form'); assert.ok(node); await node.props.onSubmit({ preventDefault() {} }); await this.flush(); },
    async tick() { for (const fn of [...intervals.values()]) await fn(); await this.flush(); },
    async event(name) { events.get(name)?.(); await this.flush(); },
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
    const api = flow.createBankingFlow({ get: async () => ok({ ...transaction, storeId: '99' }), post: async () => ok({ ...session, amount: 0 }) });
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

for (const flow of [banking, frontendBanking]) {
  test('new customer mutations use exact scoped endpoints and reject unconfirmed results', async () => {
    const calls = [];
    const verified = { ...account, verificationStatus: 'VERIFIED', isDefault: true };
    const client = flow.createBankingFlow({
      patch: async (path, body) => { calls.push({ method: 'patch', path, body }); return ok(verified); },
      delete: async path => { calls.push({ method: 'delete', path }); return ok({ success: true }); },
    });
    assert.equal((await client.setDefaultCustomerAccount('31')).id, '31');
    await client.removeCustomerAccount('31');
    assert.deepEqual(calls, [
      { method: 'patch', path: '/customers/me/bank-accounts/31/default', body: {} },
      { method: 'delete', path: '/customers/me/bank-accounts/31' },
    ]);
    await assert.rejects(client.removeCustomerAccount('../32'));
    assert.equal(calls.length, 2);
    for (const response of [ok({ ...verified, id: '32' }), ok(account), ok({ ...verified, isDefault: false }), { data: { success: false, message: 'Không được phép' } }]) {
      await assert.rejects(flow.createBankingFlow({ patch: async () => response }).setDefaultCustomerAccount('31'));
    }
    await assert.rejects(flow.createBankingFlow({ delete: async () => ok({ success: false }) }).removeCustomerAccount('31'));
  });

  test('server checkout recovery enforces the current account, session, payment state, expiry and provider origin', () => {
    const status = pendingStatus();
    status.session.checkoutUrl = session.checkoutUrl;
    assert.deepEqual(flow.customerBankCheckout(status, null), { url: session.checkoutUrl, expiresAt: future, amount: null });
    assert.equal(flow.customerBankCheckout(status, session).amount, 2000);
    const noSavedUrl = pendingStatus();
    assert.equal(flow.customerBankCheckout(noSavedUrl, { ...session, accountId: '32' }), null);
    assert.equal(flow.customerBankCheckout(noSavedUrl, { ...session, sessionReference: 'OTHER_SESSION' }), null);
    for (const changes of [
      { paymentStatus: 'PAID' }, { paymentStatus: 'PENDING_RECONCILIATION' }, { verificationStatus: 'PENDING_SOURCE_EVIDENCE' },
      { sessionStatus: 'CONSUMED' }, { isExpired: true }, { expiresAt: '2000-01-01' },
      { checkoutUrl: 'https://payos.vn.evil.invalid/payment' },
    ]) assert.equal(flow.customerBankCheckout({ ...status, session: { ...status.session, ...changes } }, null), null);
    assert.equal(flow.customerBankCheckout({ ...status, accountVerificationStatus: 'VERIFIED' }, session), null);
  });
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}only verified accounts offer default selection and confirmation sends one PATCH`, async () => {
    const app = harness(prefix);
    app.setAccounts([{ ...account, verificationStatus: 'VERIFIED', isDefault: false }, { ...account, id: '32', accountNumberMasked: '******5678' }]);
    await app.flush();
    assert.equal(app.nodes.filter(node => node.type === 'button' && node.props['aria-label']?.startsWith('Đặt mặc định')).length, 1);
    await app.click('Đặt mặc định tài khoản ******1234');
    assert.equal(app.calls.some(call => call.method === 'patch'), false);
    await app.click('Giữ nguyên');
    assert.equal(app.calls.some(call => call.method === 'patch'), false);
    await app.click('Đặt mặc định tài khoản ******1234');
    await app.click('Xác nhận đặt mặc định');
    assert.equal(app.calls.filter(call => call.method === 'patch').length, 1);
    assert.ok(app.text.includes('Đã cập nhật tài khoản nhận hoàn tiền mặc định'));
    assert.ok(!app.nodes.some(node => node.props?.['aria-label'] === 'Đặt mặc định tài khoản ******1234'));
    assert.equal(app.calls.some(call => call.path.endsWith('/initiate-verification')), false);
    app.unmount();
  });

  test(`${prefix}successful deletion clears the selected account, payment link and polling`, async () => {
    const app = harness(prefix);
    const status = pendingStatus(); status.session.checkoutUrl = session.checkoutUrl;
    app.setStatus(status);
    await app.flush(); await app.click('Xem xác minh & hoàn tiền');
    assert.equal(app.find('a', 'Mở thanh toán PayOS').props.href, session.checkoutUrl);
    await app.click('Xóa tài khoản ******1234');
    assert.equal(app.calls.some(call => call.method === 'delete'), false);
    await app.click('Xác nhận xóa');
    assert.equal(app.calls.filter(call => call.method === 'delete').length, 1);
    assert.ok(app.text.includes('Chưa có tài khoản ngân hàng'));
    assert.ok(!app.nodes.some(node => node.type === 'a'));
    const reads = app.calls.filter(call => call.path.endsWith('/verification-status')).length;
    await app.tick();
    assert.equal(app.calls.filter(call => call.path.endsWith('/verification-status')).length, reads);
    app.unmount();
  });

  test(`${prefix}backend deletion refusal preserves account and displays the real financial guard`, async () => {
    const app = harness(prefix, { override: method => method === 'delete' ? Promise.reject({ response: { status: 400, data: { message: 'Không thể xóa tài khoản ngân hàng đang có yêu cầu hoàn cọc chưa hoàn tất' } } }) : undefined });
    await app.flush(); await app.click('Xóa tài khoản ******1234'); await app.click('Xác nhận xóa');
    assert.ok(app.text.includes('******1234'));
    assert.ok(app.nodes.some(node => node.type === 'bank-error' && node.props.message.includes('hoàn cọc chưa hoàn tất')));
    assert.ok(!app.text.includes('Đã xóa tài khoản'));
    await app.tick(); assert.equal(app.calls.filter(call => call.method === 'delete').length, 1);
    app.unmount();
  });

  test(`${prefix}mutation timeout never retries or claims success and ignores duplicate clicks in flight`, async () => {
    const request = deferred();
    const app = harness(prefix, { override: method => method === 'patch' ? request.promise : undefined });
    app.setAccounts([{ ...account, verificationStatus: 'VERIFIED', isDefault: false }]);
    await app.flush(); await app.click('Đặt mặc định tài khoản ******1234');
    const confirm = app.find('button', 'Xác nhận đặt mặc định');
    const first = confirm.props.onClick(); await confirm.props.onClick(); await app.flush();
    assert.equal(app.calls.filter(call => call.method === 'patch').length, 1);
    request.reject(new Error('timeout')); await first; await app.flush(); await app.tick();
    assert.equal(app.calls.filter(call => call.method === 'patch').length, 1);
    assert.ok(!app.text.includes('Đã cập nhật tài khoản nhận hoàn tiền mặc định'));
    assert.ok(app.nodes.some(node => node.type === 'bank-error' && node.props.message.includes('Chưa rõ kết quả')));
    app.unmount();
  });

  test(`${prefix}history identifies the actual bank account and opens a saved checkout through GET only`, async () => {
    const row = { ...pendingStatus().session.refundSummary, sessionId: '901', sessionReference: session.sessionReference, accountId: '31', bankName: 'HISTORY BANK', accountNumberMasked: '******1234', accountName: 'HISTORY OWNER', sessionStatus: 'ACTIVE', verificationStatus: 'PENDING', paymentReceived: false, receivedAmount: null, refundStatus: 'NONE', expiresAt: future, createdAt: '2026-11-10T00:00:00Z', checkoutUrl: 'https://payos.vn.evil.invalid/old' };
    const app = harness(prefix, { override: (method, path) => path.endsWith('/verification-history') ? ok([row], { page: 1, pageSize: 10, total: 1 }) : undefined });
    const status = pendingStatus(); status.session.checkoutUrl = session.checkoutUrl; app.setStatus(status);
    await app.flush();
    assert.ok(app.text.includes('HISTORY BANK · ******1234'));
    assert.ok(app.text.includes('HISTORY OWNER'));
    assert.equal(app.find('a', 'Mở thanh toán PayOS').props.href, session.checkoutUrl);
    await app.click('Xem tài khoản của phiên');
    assert.equal(app.find('a', 'Mở thanh toán PayOS').props.href, session.checkoutUrl);
    assert.equal(app.calls.filter(call => call.method !== 'get').length, 0);
    app.unmount();
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


for (const flow of [banking, frontendBanking]) {
  test('store verification remains verified throughout independent refund processing', () => {
    for (const status of ['VERIFIED', 'REFUND_PENDING', 'REFUNDED']) assert.equal(flow.storeVerificationStatus({ ...transaction, status }), 'VERIFIED');
    assert.equal(flow.storeVerificationStatus(transaction), 'PENDING');
    for (const refundStatus of ['PENDING', 'PROCESSING', 'FAILED_RETRY', 'PENDING_RECONCILIATION']) {
      const tx = { ...transaction, status: 'REFUND_PENDING', refundStatus };
      assert.equal(flow.storeBankNeedsPolling(tx), true);
      assert.doesNotMatch(flow.bankRefundMessage(refundStatus, 3500), /đã xác nhận hoàn/i);
      assert.match(flow.bankRefundMessage(refundStatus, 3500), /3\.500/);
    }
    assert.equal(flow.storeBankNeedsPolling({ ...transaction, expiresAt: '2000-01-01' }), false);
    assert.equal(flow.storeBankNeedsPolling({ ...transaction, status: 'REFUNDED', refundStatus: 'SUCCESS' }), false);
    assert.match(flow.bankRefundMessage('SUCCESS', 3500), /đã xác nhận hoàn/i);
  });
  test('pending recovery verifies store, id and fresh state before resuming without mutation', async () => {
    const calls = [];
    const flowApi = flow.createBankingFlow({ get: async path => { calls.push(path); return path === '/bank-account-verifications/21' ? ok(transaction) : ok([transaction], { page: 1, pageSize: 10, totalItems: 1 }); } });
    assert.equal((await flowApi.pendingStoreVerification('12')).referenceCode, 'VERIFY_TEST');
    assert.deepEqual(calls, ['/stores/12/bank-account-verifications', '/bank-account-verifications/21']);
    for (const tx of [{ ...transaction, storeId: '99' }, { ...transaction, verificationId: '../21' }]) {
      await assert.rejects(flow.createBankingFlow({ get: async () => ok([tx], { page: 1, pageSize: 10, totalItems: 1 }) }).pendingStoreVerification('12'));
    }
    const finished = flow.createBankingFlow({ get: async path => path === '/bank-account-verifications/21' ? ok({ ...transaction, status: 'VERIFIED' }) : ok([transaction], { page: 1, pageSize: 10, totalItems: 1 }) });
    assert.equal(await finished.pendingStoreVerification('12'), null);
  });
}
for (const prefix of ['../src/', '../frontend/src/']) {
  test(prefix + 'refund history refreshes without opening details, pauses when hidden and stops on confirmed refund', async () => {
    let current = { ...transaction, status: 'REFUND_PENDING', refundStatus: 'PROCESSING' };
    const app = harness(prefix, { component: 'store', override: (method, path, config) => path.endsWith('/bank-account-verifications')
      ? ok(config.params.status ? [] : [current], { page: 1, pageSize: 10, totalItems: config.params.status ? 0 : 1 }) : undefined });
    await app.flush();
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'VERIFIED' && !n.props.refund));
    assert.match(app.text, /chưa xác nhận tiền đã về/);
    const reads = app.calls.length;
    app.document.visibilityState = 'hidden'; await app.tick(); assert.equal(app.calls.length, reads);
    app.document.visibilityState = 'visible'; app.setCooldown(Date.now() + 10000); await app.tick(); assert.equal(app.calls.length, reads);
    app.setCooldown(0); current = { ...current, status: 'REFUNDED', refundStatus: 'SUCCESS' }; await app.tick();
    assert.match(app.text, /đã xác nhận hoàn/i);
    const finished = app.calls.length; await app.tick(); assert.equal(app.calls.length, finished);
    assert.equal(app.calls.some(c => c.method !== 'get'), false); app.unmount();
  });
  test(prefix + 'transfer countdown follows server expiry and refund badges distinguish processing from retry', () => {
    const code = ts.transpileModule(readFileSync(new URL(prefix + 'components/common/BankingPrimitives.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const exports = {}; vm.runInNewContext(code, { exports, URL, Date, require: name => name.endsWith('/banking-flow') ? banking : require(name) });
    const now = Date.parse('2026-11-11T00:00:00Z');
    const html = renderToStaticMarkup(React.createElement(exports.BankTransferInstructions, { receipt: { amount: 3500, referenceCode: 'SERVER_CODE', expiresAt: '2026-11-11T00:02:03Z' }, now }));
    assert.match(html, /2:03/); assert.match(html, /3\.500/); assert.doesNotMatch(html, /15:00|2\.000/);
    for (const [value, label] of [['PROCESSING', 'Đang chuyển hoàn'], ['FAILED_RETRY', 'Đang chờ thử lại'], [null, 'Chưa ghi nhận hoàn tiền']]) {
      assert.match(renderToStaticMarkup(React.createElement(exports.BankBadge, { value, refund: true })), new RegExp(label));
    }
  });
}


for (const prefix of ['../src/', '../frontend/src/']) {
  test(prefix + 'disabled verification 503 remains visible after a successful status read and never auto-retries POST', async () => {
    const message = 'Tính năng thu tiền xác minh tài khoản đang tạm thời tắt (chờ cấu hình kết nối đối tác). Vui lòng thử lại sau.';
    const app = harness(prefix, { override: (method, path) => path.endsWith('/initiate-verification') ? Promise.reject({ response: { status: 503, data: { success: false, message, errorCode: 'Service Unavailable' } } }) : undefined });
    await app.flush(); await app.click('Xem xác minh & hoàn tiền'); await app.click('Tiếp tục phiên xác minh');
    const errors = () => app.nodes.filter(n => n.type === 'bank-error' && n.props.message === message);
    assert.equal(errors().length, 1); assert.equal(errors()[0].props.retry, undefined);
    assert.ok(app.text.includes('Tài khoản đã thêm vẫn được giữ lại'));
    await app.click('Kiểm tra kết quả');
    assert.equal(errors().length, 1, 'GET status cannot clear a failed initiation');
    await app.tick(); await app.tick();
    assert.equal(app.calls.filter(c => c.path.endsWith('/initiate-verification')).length, 1);
    assert.equal(app.nodes.some(n => n.type === 'a'), false);
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'UNVERIFIED'));
    assert.equal(app.calls.some(c => c.method === 'delete' || c.path.endsWith('/verify')), false);
    await app.click('Thử khởi tạo lại');
    assert.equal(app.calls.filter(c => c.path.endsWith('/initiate-verification')).length, 2);
    app.unmount();
  });
  test(prefix + 'an explicit retry after service restoration resumes a real session and clears the old error', async () => {
    let unavailable = true;
    const message = 'Chưa cấu hình khóa kết nối PayOS trong hệ thống';
    const app = harness(prefix, { override: (method, path) => path.endsWith('/initiate-verification') && unavailable ? Promise.reject({ response: { status: 503, data: { message } } }) : undefined });
    await app.flush(); await app.click('Xem xác minh & hoàn tiền'); await app.click('Tiếp tục phiên xác minh');
    const status = pendingStatus(); status.session.checkoutUrl = session.checkoutUrl; app.setStatus(status);
    await app.click('Kiểm tra kết quả');
    assert.equal(app.nodes.some(n => n.type === 'a'), false, 'a failed initiation cannot expose a cached payment link');
    unavailable = false; await app.click('Thử khởi tạo lại');
    assert.equal(app.find('a', 'Mở thanh toán PayOS').props.href, session.checkoutUrl);
    assert.equal(app.nodes.some(n => n.type === 'bank-error' && n.props.message === message), false);
    assert.equal(app.calls.filter(c => c.path.endsWith('/initiate-verification')).length, 2); app.unmount();
  });
  test(prefix + 'initiation timeout does not fake success or prevent reading independent verification results', async () => {
    const app = harness(prefix, { override: (method, path) => path.endsWith('/initiate-verification') ? Promise.reject(new Error('initiation timeout')) : undefined });
    await app.flush(); await app.click('Xem xác minh & hoàn tiền'); await app.click('Tiếp tục phiên xác minh');
    assert.ok(app.nodes.some(n => n.type === 'bank-error' && n.props.message === 'initiation timeout'));
    const status = pendingStatus(); status.accountVerificationStatus = 'VERIFIED'; status.session.paymentStatus = 'PAID'; status.session.verificationStatus = 'VERIFIED'; app.setStatus(status);
    await app.click('Kiểm tra kết quả');
    assert.ok(app.nodes.some(n => n.type === 'bank-badge' && n.props.value === 'VERIFIED'));
    assert.equal(app.nodes.some(n => n.type === 'bank-error' && n.props.message === 'initiation timeout'), false);
    assert.equal(app.calls.filter(c => c.path.endsWith('/initiate-verification')).length, 1); app.unmount();
  });
}

for (const flow of [banking, frontendBanking]) {
  test('verification accepts the server amount and rejects invalid monetary instructions', async () => {
    for (const amount of [3500, 5000]) {
      const result = await flow.createBankingFlow({ post: async () => ok({ ...session, amount }) }).initiateCustomerVerification('31');
      assert.equal(result.amount, amount);
    }
    for (const amount of [0, -1, 0.5, null, '2000', NaN]) {
      await assert.rejects(flow.createBankingFlow({ post: async () => ok({ ...session, amount }) }).initiateCustomerVerification('31'));
    }
    for (const refundStatus of ['PENDING_REFUND', 'PROCESSING_REFUND']) {
      assert.equal(flow.storeBankNeedsPolling({ ...transaction, status: 'REFUND_PENDING', expiresAt: '2000-01-01', refundStatus }), true);
      assert.match(flow.bankRefundMessage(refundStatus, 3500), /3\.500/);
    }
    assert.match(flow.bankRefundMessage('PENDING_MANUAL_REFUND', 2000), /hoàn thủ công/);
    assert.match(flow.storeFailureMessage('SENDER_ACCOUNT_UNVERIFIABLE'), /PayOS\/ngân hàng/);
  });
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}store transfer instructions expose valid PayOS checkout link and hide expired or untrusted links`, () => {
    const source = readFileSync(new URL(prefix + 'components/common/BankingPrimitives.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const exports = {}; vm.runInNewContext(code, { exports, URL, Date, require: name => name.endsWith('/banking-flow') ? banking : require(name) });
    const render = value => renderToStaticMarkup(React.createElement(exports.BankTransferInstructions, { receipt: value }));
    const withPayos = render({ amount: 2000, referenceCode: 'VERIFY_ABC', expiresAt: future, checkoutUrl: 'https://pay.payos.vn/web/store123', recipientBankBin: '970422', recipientBankName: 'MBBank', recipientAccountNumber: '0012345678', recipientAccountHolder: 'PLATFORM' });
    assert.match(withPayos, /https:\/\/pay\.payos\.vn\/web\/store123/);
    assert.match(withPayos, /Mở thanh toán PayOS/);
    const expiredPayos = render({ amount: 2000, referenceCode: 'VERIFY_ABC', expiresAt: '2000-01-01', checkoutUrl: 'https://pay.payos.vn/web/store123' });
    assert.doesNotMatch(expiredPayos, /Mở thanh toán PayOS/);
    const evilPayos = render({ amount: 2000, referenceCode: 'VERIFY_ABC', expiresAt: future, checkoutUrl: 'https://payos.vn.evil.invalid/store123' });
    assert.doesNotMatch(evilPayos, /Mở thanh toán PayOS/);
  });

  test(`${prefix}customer can re-initiate after FAILED_MISMATCH without unblocking PENDING_SOURCE_EVIDENCE`, async () => {
    const app = harness(prefix);
    const mismatch = pendingStatus();
    mismatch.session = { ...mismatch.session, sessionStatus: 'CONSUMED', verificationStatus: 'FAILED_MISMATCH', paymentStatus: 'PAID', refundStatus: 'PENDING_MANUAL_REFUND' };
    app.setStatus(mismatch);
    await app.flush(); await app.click('Xem xác minh & hoàn tiền');
    const initiate = app.find('button', 'Bắt đầu xác minh');
    assert.equal(initiate.props.disabled, false);
    await app.click('Bắt đầu xác minh');
    assert.equal(app.calls.filter(c => c.path.endsWith('/initiate-verification')).length, 1);
    app.unmount();
  });
}
