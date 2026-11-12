import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as finance from '../src/services/store-finance-flow.ts';
import * as banking from '../src/services/banking-flow.ts';
import * as subscriptionOverview from '../src/services/store-subscription-overview.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/store/StoreFinancePage.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const owner = { id: '7', role: 'STORE_OWNER', storeId: '12' };
const ok = data => ({ data: { success: true, data } });
const receipt = { verificationId: '21', bankAccountId: '31', bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******123', amount: 2000, referenceCode: 'VERIFY_ABCD', expiresAt: '2099-01-01T00:00:00.000Z', instructions: 'Hướng dẫn từ máy chủ' };
const account = { id: '31', storeId: '12', bankBin: '970422', bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******123', verificationStatus: 'PENDING', isDefault: false };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function harness({ user = owner, api: overrides = {}, storage = new Map(), hash = '' } = {}) {
  const calls = [], slots = [], timers = new Map(), timeouts = new Map(), listeners = new Map();
  let timeoutId = 0;
  let cursor = 0, dirty = true, effects = [], tree, mounted = true;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { const result = typeof next === 'function' ? next(slots[index].value) : next; if (!Object.is(result, slots[index].value)) { slots[index].value = result; dirty = true; } }]; },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (!slots[index] || deps.some((value, n) => !Object.is(value, slots[index].deps[n]))) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) { slots[index] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); }); } },
  };
  let serverAccounts = [];
  const transport = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, async (path, body) => {
    calls.push({ method, path, body });
    if (overrides[method]) return overrides[method](path, body);
    if (path === '/store/subscriptions/current') return ok({ plan: { planName: 'Gói kiểm thử' }, daysRemaining: 5 });
    if (path === '/bank-account-verifications/21') return ok({ ...receipt, storeId: '12', status: serverAccounts.some(a => a.verificationStatus === 'OWNERSHIP_VERIFIED') ? 'VERIFIED' : 'PENDING' });
    if (path === '/banks') return ok([{ bin: '970422', code: 'TEST', shortName: 'Test Bank', name: 'Ngân hàng kiểm thử' }]);
    if (method === 'get' && path.endsWith('/bank-accounts')) return ok(serverAccounts);
    if (path.endsWith('/lookup')) return ok({ bankBin: body.bankBin, bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******123' });
    if (path.endsWith('/verification')) { serverAccounts = [account]; return ok(receipt); }
    if (path.endsWith('/cancel')) return ok(undefined);
    if (method === 'patch') { serverAccounts = serverAccounts.map(item => ({ ...item, isDefault: true })); return ok(undefined); }
    if (method === 'delete') { serverAccounts = []; return ok(undefined); }
    throw new Error(`Unhandled ${method} ${path}`);
  }]));
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'framer-motion') return { motion: new Proxy({}, { get: (_, key) => `motion.${String(key)}` }), AnimatePresence: 'presence', useReducedMotion: () => true };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
      if (name === 'react-router-dom') return { Link: 'a', useLocation: () => ({ hash }) };
      if (name.endsWith('/api')) return { api: transport };
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user }) };
      if (name.endsWith('/OperationPrimitives')) return { card: 'card', primaryButton: 'primary' };
      if (name.endsWith('/store-finance-flow')) return finance;
      if (name.endsWith('/banking-flow')) return banking;
      if (name.endsWith('/request-backoff')) return { getApiRetryUntil: () => 0 };
      if (name.endsWith('/StoreBankVerificationHistory')) return { StoreBankVerificationHistory: 'bank-history' };
      if (name.endsWith('/StoreRegisteredPeriods')) return { StoreRegisteredPeriods: 'registered-periods' };
      if (name.endsWith('/BankingPrimitives')) return { BankTransferInstructions: 'bank-transfer' };
      if (name.endsWith('/store-subscription-overview')) return subscriptionOverview;
      if (name.endsWith('/StoreSubscriptionPayments')) return { StoreSubscriptionPayments: 'subscription-payments' };
      throw new Error(`Unexpected import ${name}`);
    },
    window: { setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); },
      setTimeout(fn, delay) { const id = ++timeoutId; timeouts.set(id, { fn, delay }); return id; }, clearTimeout(id) { timeouts.delete(id); } },
    document: { visibilityState: 'visible', addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } },
    navigator: { clipboard: { writeText: async () => {} } },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  const walk = value => {
    if (!value || typeof value !== 'object') return [];
    if (value.props?.ref) value.props.ref.current = { focus() {} };
    const children = [value.props?.children].flat(Infinity);
    return [value, ...children.flatMap(walk)];
  };
  const text = value => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : [value.props?.children].flat(Infinity).map(text).join('');
  async function flush() {
    for (let index = 0; index < 30; index++) {
      if (dirty && mounted) { dirty = false; cursor = 0; tree = exports.StoreFinancePage(); walk(tree); const jobs = effects; effects = []; jobs.forEach(fn => fn()); }
      await Promise.resolve();
    }
  }
  return {
    calls, storage, flush,
    async lookupTimers() { for (const [id, timer] of [...timeouts]) { if (timer.delay === 700) { timeouts.delete(id); timer.fn(); } } await flush(); },
    async navigateHash(value) { hash = value; dirty = true; await flush(); },
    get nodes() { return walk(tree); },
    get text() { return text(tree); },
    find(type, label) { const node = walk(tree).find(item => item.type === type && text(item).includes(label)); assert.ok(node, `Missing ${type}: ${label}`); return node; },
    async click(label) { const button = this.find('button', label); assert.ok(!button.props.disabled, `Disabled button: ${label}`); await button.props.onClick?.(); await flush(); },
    async change(type, value) { const node = walk(tree).find(item => item.type === type); assert.ok(node, `Missing input ${type}`); node.props.onChange({ target: { value, checked: value } }); await flush(); },
    async submit() { const node = walk(tree).find(item => item.type === 'form'); assert.ok(node); await node.props.onSubmit({ preventDefault() {} }); await flush(); },
    setAccounts(next) { serverAccounts = next; },
    async tick() { for (const fn of timers.values()) fn(); await flush(); },
    unmount() { mounted = false; slots.forEach(slot => slot.cleanup?.()); },
  };
}

test('bank name lookup waits for typing to stop and sends only the final bank/account without creating verification', async () => {
  const h = harness({ hash: '#store-bank-accounts' }); await h.flush(); await h.click('Thêm tài khoản');
  await h.change('select', '970422'); await h.change('input', '00123'); await h.change('input', '00123456');
  assert.equal(h.calls.some(call => call.path.endsWith('/lookup')), false);
  await h.lookupTimers();
  const lookups = h.calls.filter(call => call.path.endsWith('/lookup')); assert.equal(lookups.length, 1);
  assert.equal(lookups[0].body.accountNumber, '00123456'); assert.equal(lookups[0].body.bankBin, '970422');
  assert.match(h.text, /TEST OWNER/); assert.equal(h.calls.some(call => call.path.endsWith('/verification')), false);
  await h.lookupTimers(); assert.equal(h.calls.filter(call => call.path.endsWith('/lookup')).length, 1); h.unmount();
});

test('manual lookup cancels the automatic duplicate; closing or leaving cancels the pending timer', async () => {
  for (const action of ['manual', 'close', 'leave']) {
    const h = harness({ hash: '#store-bank-accounts' }); await h.flush(); await h.click('Thêm tài khoản');
    await h.change('select', '970422'); await h.change('input', '00123456');
    if (action === 'manual') await h.submit();
    else if (action === 'leave') await h.navigateHash('#subscription-current');
    else await h.click('Thêm tài khoản');
    await h.lookupTimers(); assert.equal(h.calls.filter(call => call.path.endsWith('/lookup')).length, action === 'manual' ? 1 : 0); h.unmount();
  }
});

test('automatic lookup failures remain visible and are not automatically retried', async () => {
  const h = harness({ hash: '#store-bank-accounts', api: { post: async () => { throw { response: { status: 503, data: { message: 'Dịch vụ tra cứu chưa sẵn sàng' } } }; } } });
  await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '00123456');
  await h.lookupTimers(); await h.lookupTimers(); assert.match(h.text, /Dịch vụ tra cứu chưa sẵn sàng/);
  assert.equal(h.calls.filter(call => call.method === 'post').length, 1); assert.equal(h.text.includes('Tạo yêu cầu xác minh'), false); h.unmount();
});

test('finance navigation displays only the selected section and keeps API mutations unchanged', async () => {
  const h = harness(); await h.flush();
  for (const [hash, expected] of [['', 'current'], ['#subscription-current', 'current'], ['#subscription-payments', 'payments'], ['#store-bank-accounts', 'banks'], ['#store-bank-verification-history', 'banks']]) {
    await h.navigateHash(hash);
    const panels = h.nodes.filter(node => node.props['data-finance-view']);
    assert.equal(panels.filter(node => !node.props.hidden).length, 1);
    assert.equal(panels.find(node => !node.props.hidden).props['data-finance-view'], expected);
  }
  assert.equal(h.calls.some(call => call.method !== 'get'), false); h.unmount();
});

test('verification payload accepts only controller fields and preserves large string ids', () => {
  assert.deepEqual(finance.bankVerificationPayload('90071992547409931', '970422', ' 0012345 '), { storeId: '90071992547409931', bankBin: '970422', accountNumber: '0012345' });
  for (const values of [['0', '970422', '0012345'], ['12', 'abc', '0012345'], ['12', '970422', '12 34'], ['12', '970422', '1234']]) assert.throws(() => finance.bankVerificationPayload(...values));
});

test('default selection requires exact ownership-verified status', () => {
  assert.equal(finance.canSetFinanceDefault(account), false);
  assert.equal(finance.canSetFinanceDefault({ ...account, verificationStatus: 'OWNERSHIP_VERIFIED' }), true);
  assert.equal(finance.canSetFinanceDefault({ ...account, verificationStatus: 'OWNERSHIP_VERIFIED', isDefault: true }), false);
  assert.equal(finance.canSetFinanceDefault({ ...account, verificationStatus: 'UNVERIFIED' }), false);
});

test('lookup sends only validated DTO fields and preserves leading zeroes', async () => {
  const calls = [];
  const flow = finance.createStoreFinanceFlow({ post: async (path, body) => {
    calls.push({ path, body });
    return ok({ bankBin: body.bankBin, bankName: 'Test Bank', accountNumberMasked: '******345', accountName: 'TEST OWNER' });
  } });
  await flow.lookup('970422', ' 0012345 ');
  assert.deepEqual(calls, [{ path: '/stores/bank-accounts/lookup', body: { bankBin: '970422', accountNumber: '0012345' } }]);
});

test('provider lookup 400 explains the error without bypassing lookup or creating verification', async () => {
  const h = harness({ api: { post: async () => { throw { response: { status: 400, data: { errorCode: 'BANK_LOOKUP_UNAVAILABLE', message: 'Không thể xác minh tài khoản ngân hàng lúc này' } } }; } } });
  await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  assert.match(h.text, /BANK_LOOKUP_UNAVAILABLE/);
  assert.match(h.text, /Chưa thể tạo yêu cầu xác minh/);
  assert.equal(h.calls.filter(call => call.path.endsWith('/lookup')).length, 1);
  assert.equal(h.calls.some(call => call.path.endsWith('/verification')), false);
  await h.tick(); assert.equal(h.calls.filter(call => call.path.endsWith('/lookup')).length, 1);
  assert.equal(finance.financeLookupError({ response: { status: 400, data: { message: ['Số tài khoản không hợp lệ'] } } }), 'Số tài khoản không hợp lệ');
  assert.equal(finance.financeLookupError({ response: { status: 403, data: { message: 'Không có quyền' } } }), 'Không có quyền');
  h.unmount();
});

test('verification receipt validation rejects malformed responses and never infers refund success', () => {
  assert.deepEqual(finance.readFinanceVerification(JSON.stringify(receipt)), receipt);
  for (const value of [null, '{', JSON.stringify({ ...receipt, amount: 0 }), JSON.stringify({ ...receipt, bankAccountId: 'unknown' }), JSON.stringify({ ...receipt, expiresAt: 'bad' })]) assert.equal(finance.readFinanceVerification(value), null);
  assert.equal(finance.financeVerificationExpired(receipt, Date.parse('2099-01-01T00:00:00Z')), true);
  assert.equal(finance.financeVerificationExpired(receipt, Date.parse('2098-01-01T00:00:00Z')), false);
  assert.equal('refundStatus' in receipt, false);
});

test('mutation endpoints keep ids in their correct scope and do not call legacy wallet update', async () => {
  const calls = [];
  const adapter = Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, async (path, body) => { calls.push({ method, path, body }); return ok(path.endsWith('/verification') ? receipt : undefined); }]));
  const flow = finance.createStoreFinanceFlow(adapter);
  await flow.verify('12', '970422', '0012345'); await flow.setDefault('12', '31'); await flow.cancel('21'); await flow.remove('12', '31');
  assert.deepEqual(calls.map(item => [item.method, item.path]), [['post', '/stores/bank-accounts/verification'], ['patch', '/stores/12/bank-accounts/31/default'], ['post', '/stores/bank-accounts/verification/21/cancel'], ['delete', '/stores/12/bank-accounts/31']]);
  assert.deepEqual(calls[0].body, { storeId: '12', bankBin: '970422', accountNumber: '0012345' });
});

test('a 200 response with success false rejects and cannot become UI success', async () => {
  const flow = finance.createStoreFinanceFlow({ get: async () => ({ data: { success: false, message: 'Không có quyền' } }), post: async () => ({ data: { success: false, message: ['Không thể xác minh'] } }), patch: async () => ({ data: { success: false } }), delete: async () => ({ data: { success: false } }) });
  await assert.rejects(flow.accounts('12'), /Không có quyền/);
  await assert.rejects(flow.verify('12', '970422', '0012345'), /Không thể xác minh/);
  await assert.rejects(flow.setDefault('12', '31'));
  await assert.rejects(flow.remove('12', '31'));
});

test('store context resolves backend-auth shapes without inventing an id', () => {
  assert.equal(finance.financeStoreId({ ownedStores: [{ storeId: '12' }] }), '12');
  assert.equal(finance.financeStoreId({ store: { id: '12' } }), '12');
  assert.equal(finance.financeStoreId({ storeId: 'invalid' }), null);
  assert.notEqual(finance.financeVerificationKey('7', '12'), finance.financeVerificationKey('8', '12'));
});

test('UI keeps subscription usable when bank list fails and avoids admin plan catalog', async () => {
  const h = harness({ api: { get: async path => { if (path === '/store/subscriptions/current') return ok({ plan: { planName: 'Gói đang dùng' }, daysRemaining: 8 }); throw new Error('Không tải được tài khoản'); } } });
  await h.flush();
  assert.match(h.text, /Gói đang dùng/);
  assert.match(h.text, /Không tải được tài khoản/);
  assert.equal(h.calls.some(call => call.path.includes('/admin/plans')), false);
  assert.equal(h.calls.some(call => call.path === '/banks'), false, 'bank catalog loads only after opening the form');
  h.unmount();
});

test('store manager sees subscription without owner-only bank requests or actions', async () => {
  const h = harness({ user: { ...owner, role: 'STORE_MANAGER' } });
  await h.flush();
  assert.match(h.text, /Chỉ chủ cửa hàng có thể xem/);
  assert.equal(h.calls.some(call => call.path.includes('/bank-accounts')), false);
  assert.equal(h.nodes.some(node => node.type === 'button' && String(node.props.children).includes('Thêm tài khoản')), false);
  h.unmount();
});

test('current plan presents dates, real price and urgent expiry without changing banking actions', async () => {
  const endDate = new Date(Date.now() + 2 * 86400000).toISOString();
  const current = { storeId: '12', subscriptionId: '99', status: 'ACTIVE', startDate: new Date(Date.now() - 28 * 86400000).toISOString(), endDate, plan: { planName: 'Gói cửa hàng', price: '150000', durationDays: 30, maxProducts: 100 } };
  const h = harness({ api: { get: async path => ok(path === '/store/subscriptions/current' ? current : []) } });
  await h.flush();
  assert.match(h.text, /Gói còn 2 ngày/); assert.match(h.text, /150\.000/);
  assert.match(h.text, /Mã đăng ký #99/); assert.match(h.text, /100 sản phẩm/);
  assert.equal(h.nodes.find(node => node.props?.role === 'progressbar').props['aria-valuenow'], 93);
  h.unmount();
});

test('future periods and missing current plan do not claim an active paid subscription', async () => {
  const future = { storeId: '12', status: 'ACTIVE', startDate: new Date(Date.now() + 30 * 86400000).toISOString(), endDate: new Date(Date.now() + 60 * 86400000).toISOString(), plan: { planName: 'Kỳ đã mua trước' } };
  const h = harness({ api: { get: async path => ok(path === '/store/subscriptions/current' ? future : []) } });
  await h.flush(); assert.match(h.text, /Chưa đến ngày bắt đầu/); assert.ok(!h.text.includes('Gói còn'));
  h.unmount();
  const empty = harness({ api: { get: async path => ok(path === '/store/subscriptions/current' ? null : []) } });
  await empty.flush(); assert.match(empty.text, /Chưa có gói đang hoạt động/); assert.ok(!empty.text.includes('Đã hết hạn')); empty.unmount();
});

test('a subscription from another store is rejected without hiding the bank section', async () => {
  const h = harness({ api: { get: async path => ok(path === '/store/subscriptions/current' ? { storeId: '99', plan: { planName: 'Gói cửa hàng khác' } } : []) } });
  await h.flush(); assert.match(h.text, /không thuộc cửa hàng/); assert.ok(!h.text.includes('Gói cửa hàng khác'));
  assert.match(h.text, /Chưa có tài khoản ngân hàng/); h.unmount();
});

test('actual UI runs lookup then confirmation then verification and server refresh', async () => {
  const h = harness(); await h.flush(); await h.click('Thêm tài khoản');
  await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  assert.match(h.text, /TEST OWNER/);
  assert.equal(h.find('button', 'Tạo yêu cầu xác minh').props.disabled, true);
  const checkbox = h.nodes.find(node => node.type === 'input' && node.props.type === 'checkbox'); checkbox.props.onChange({ target: { checked: true } }); await h.flush();
  await h.click('Tạo yêu cầu xác minh');
  const posts = h.calls.filter(call => call.method === 'post');
  assert.deepEqual(posts.map(call => call.path), ['/stores/bank-accounts/lookup', '/stores/bank-accounts/verification']);
  assert.equal(h.calls.at(-1).path, '/stores/12/bank-accounts');
  assert.equal(h.nodes.find(n => n.type === 'bank-transfer').props.receipt.referenceCode, 'VERIFY_ABCD');
  assert.equal(h.nodes.find(n => n.type === 'bank-transfer').props.receipt.recipientAccountNumber, undefined);
  assert.match(h.text, /Chờ xác minh/);
  assert.equal(h.find('button', 'Thêm tài khoản').props.disabled, true);
  assert.equal(h.nodes.some(node => node.type === 'button' && node.props.children === 'Đặt mặc định'), false);
  assert.ok(h.storage.has(finance.financeVerificationKey('7', '12')));
  h.setAccounts([{ ...account, verificationStatus: 'OWNERSHIP_VERIFIED' }]); await h.tick();
  assert.match(h.text, /Phiên xác minh đã cập nhật/);
  assert.equal(h.storage.has(finance.financeVerificationKey('7', '12')), false);
  assert.equal(h.find('button', 'Đặt mặc định').props.disabled, false);
  h.unmount();
});

test('editing the bank account invalidates the looked-up name and confirmation', async () => {
  const h = harness(); await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  assert.match(h.text, /TEST OWNER/);
  await h.change('input', '0099999');
  assert.doesNotMatch(h.text, /Tên do ngân hàng cung cấp/);
  assert.equal(h.calls.filter(call => call.path.endsWith('/verification')).length, 0);
  h.unmount();
});

test('a timeout never retries verification or pretends the account is verified', async () => {
  const h = harness({ api: { post: async (path, body) => { if (path.endsWith('/lookup')) return ok({ bankBin: body.bankBin, bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******123' }); throw new Error('timeout'); } } });
  await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  h.nodes.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await h.flush(); await h.click('Tạo yêu cầu xác minh');
  assert.match(h.text, /Không gửi lại để tránh tạo trùng/);
  assert.equal(h.find('button', 'Tạo yêu cầu xác minh').props.disabled, true);
  assert.equal(h.calls.filter(call => call.path.endsWith('/verification')).length, 1);
  assert.equal(h.storage.size, 0); assert.doesNotMatch(h.text, /Đã tạo yêu cầu xác minh\./);
  h.unmount();
});

test('canceling a restored request requires explicit confirmation and refreshes accounts', async () => {
  const storage = new Map([[finance.financeVerificationKey('7', '12'), JSON.stringify(receipt)]]);
  const h = harness({ storage }); await h.flush();
  await h.click('Hủy yêu cầu');
  assert.equal(h.calls.filter(call => call.path.endsWith('/cancel')).length, 0);
  await h.click('Xác nhận hủy');
  assert.equal(h.calls.filter(call => call.path.endsWith('/cancel')).length, 1);
  assert.equal(h.calls.at(-1).path, '/stores/12/bank-accounts');
  assert.equal(storage.size, 0); assert.doesNotMatch(h.text, /VERIFY_ABCD/);
  h.unmount();
});

test('UI blocks duplicate confirmation clicks while mutation is in flight', async () => {
  const job = deferred();
  const h = harness({ storage: new Map([[finance.financeVerificationKey('7', '12'), JSON.stringify(receipt)]]), api: { post: async path => path.endsWith('/cancel') ? job.promise : ok(undefined) } });
  await h.flush(); await h.click('Hủy yêu cầu'); const confirm = h.find('button', 'Xác nhận hủy');
  const one = confirm.props.onClick(); const two = confirm.props.onClick(); await h.flush();
  assert.equal(h.calls.filter(call => call.path.endsWith('/cancel')).length, 1);
  job.resolve(ok(undefined)); await Promise.all([one, two]); await h.flush();
  h.unmount();
});

test('restored pending store verification keeps the server recipient and QR without creating a new request', async () => {
  const transaction = { ...receipt, storeId: '12', expectedAmount: 2000, status: 'PENDING', actualAmount: null,
    recipientBankBin: '970422', recipientBankName: 'PLATFORM BANK', recipientAccountNumber: '0012345678',
    recipientAccountHolder: 'PLATFORM RECIPIENT', qrCodeUrl: 'https://img.vietqr.io/image/test.png' };
  const get = async path => {
    if (path === '/bank-account-verifications/21') return ok(transaction);
    if (path === '/store/subscriptions/current') return ok(null);
    return ok([account]);
  };
  const h = harness({ api: { get }, hash: '#store-bank-accounts' }); await h.flush();
  h.nodes.find(node => node.type === 'bank-history').props.onResume(transaction);
  await h.flush();
  const restored = h.nodes.find(node => node.type === 'bank-transfer').props.receipt;
  assert.equal(restored.recipientAccountNumber, transaction.recipientAccountNumber);
  assert.equal(restored.recipientBankBin, transaction.recipientBankBin);
  assert.equal(restored.qrCodeUrl, transaction.qrCodeUrl);
  assert.equal(restored.instructions, transaction.instructions);
  assert.equal(restored.amount, 2000);
  assert.equal(h.calls.filter(call => call.method !== 'get').length, 0);
  assert.ok(h.calls.filter(call => call.path === '/bank-account-verifications/21').length <= 2, 'restoration must not create a polling render loop');
  h.unmount();
});

test('same-id legacy cached request is enriched from GET without replacing a different pending request', async () => {
  const storage = new Map([[finance.financeVerificationKey('7', '12'), JSON.stringify(receipt)]]);
  const transaction = { ...receipt, storeId: '12', expectedAmount: 2000, status: 'PENDING',
    recipientBankBin: '970422', recipientBankName: 'PLATFORM BANK', recipientAccountNumber: '0012345678',
    recipientAccountHolder: 'PLATFORM', qrCodeUrl: 'https://img.vietqr.io/image/test.png' };
  const h = harness({ storage, hash: '#store-bank-accounts', api: { get: async path => path === '/bank-account-verifications/21' ? ok(transaction) : path === '/store/subscriptions/current' ? ok(null) : ok([account]) } });
  await h.flush();
  assert.equal(h.nodes.find(node => node.type === 'bank-transfer').props.receipt.recipientAccountNumber, transaction.recipientAccountNumber);
  h.nodes.find(node => node.type === 'bank-history').props.onResume({ ...transaction, verificationId: '99', referenceCode: 'OTHER_SESSION', recipientAccountNumber: 'OTHER_ACCOUNT' });
  await h.flush();
  const stored = JSON.parse(storage.get(finance.financeVerificationKey('7', '12')));
  assert.equal(stored.verificationId, '21');
  assert.equal(stored.recipientAccountNumber, transaction.recipientAccountNumber);
  assert.equal(h.calls.filter(call => call.method !== 'get').length, 0);
  h.unmount();
});


test('409 resumes the current server session through GET without retrying verification', async () => {
  const current = { ...receipt, storeId: '12', expectedAmount: 3500, status: 'PENDING', amount: undefined,
    referenceCode: 'VERIFY_SERVER_EXISTING', recipientBankBin: '970422', recipientBankName: 'RECEIVER',
    recipientAccountNumber: '0011111111', recipientAccountHolder: 'PLATFORM', qrCodeUrl: 'https://img.vietqr.io/image/server.png' };
  const h = harness({ hash: '#store-bank-accounts', api: {
    get: async path => path.endsWith('/bank-account-verifications')
      ? { data: { success: true, data: [current], pagination: { page: 1, pageSize: 10, totalItems: 1 } } }
      : path === '/bank-account-verifications/21' ? ok(current) : path === '/store/subscriptions/current' ? ok(null)
      : path === '/banks' ? ok([{ bin: '970422', name: 'Test Bank', shortName: 'TEST' }]) : ok([]),
    post: async (path, body) => { if (path.endsWith('/lookup')) return ok({ bankBin: body.bankBin, accountName: 'OWNER', bankName: 'Test Bank', accountNumberMasked: '******123' }); throw { response: { status: 409, data: { message: 'Phiên xác thực đang hoạt động' } } }; }
  } });
  await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  h.nodes.find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await h.flush();
  await h.click('Tạo yêu cầu xác minh');
  assert.equal(h.calls.filter(c => c.path.endsWith('/verification')).length, 1);
  assert.match(h.text, /Đã mở lại phiên xác minh đang chờ/);
  const transfer = h.nodes.find(n => n.type === 'bank-transfer').props.receipt;
  assert.equal(transfer.referenceCode, current.referenceCode); assert.equal(transfer.amount, 3500);
  assert.equal(transfer.recipientAccountNumber, current.recipientAccountNumber);
  h.unmount();
});

test('unresolved 409 blocks another creation and recovery only reads existing sessions', async () => {
  const h = harness({ api: {
    get: async path => path.endsWith('/bank-account-verifications') ? { data: { success: true, data: [], pagination: { page: 1, pageSize: 10, totalItems: 0 } } }
      : path === '/banks' ? ok([{ bin: '970422', name: 'Test Bank', shortName: 'TEST' }]) : path === '/store/subscriptions/current' ? ok(null) : ok([]),
    post: async (path, body) => { if (path.endsWith('/lookup')) return ok({ bankBin: body.bankBin, accountName: 'OWNER', bankName: 'Test Bank', accountNumberMasked: '******123' }); throw { response: { status: 409 } }; }
  } });
  await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  h.nodes.find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await h.flush();
  await h.click('Tạo yêu cầu xác minh');
  assert.equal(h.find('button', 'Tạo yêu cầu xác minh').props.disabled, true);
  await h.click('Kiểm tra phiên đang chờ');
  assert.equal(h.calls.filter(c => c.path.endsWith('/verification')).length, 1);
  assert.match(h.text, /Chưa tìm thấy phiên đang chờ/); h.unmount();
});

test('a cached receipt cannot display a payable QR when current status cannot be read', async () => {
  const h = harness({ storage: new Map([[finance.financeVerificationKey('7', '12'), JSON.stringify(receipt)]]), api: {
    get: async path => { if (path === '/bank-account-verifications/21') throw Error('status unavailable'); return path === '/store/subscriptions/current' ? ok(null) : ok([]); }
  } });
  await h.flush();
  assert.equal(h.nodes.some(n => n.type === 'bank-transfer'), false);
  assert.match(h.text, /Chưa xác nhận lại trạng thái phiên/);
  assert.equal(h.calls.some(c => c.method !== 'get'), false); h.unmount();
});


test('provider authentication failure stays visible without enabling manual-name verification', async () => {
  const error = { response: { status: 503, data: { errorCode: 'BANK_LOOKUP_SERVICE_UNAVAILABLE', message: 'Xác thực dịch vụ thất bại' } } };
  assert.match(finance.financeLookupError(error), /Xác thực dịch vụ thất bại/);
  assert.match(finance.financeLookupError(error), /BANK_LOOKUP_SERVICE_UNAVAILABLE/);
  const h = harness({ api: { post: async () => { throw error; } } });
  await h.flush(); await h.click('Thêm tài khoản'); await h.change('select', '970422'); await h.change('input', '0012345'); await h.submit();
  assert.match(h.text, /Xác thực dịch vụ thất bại/);
  assert.equal(h.nodes.some(n => n.type === 'button' && n.props.children === 'Tạo yêu cầu xác minh'), false);
  assert.equal(h.calls.some(c => c.path.endsWith('/verification')), false); h.unmount();
});
