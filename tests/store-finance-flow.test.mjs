import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as finance from '../src/services/store-finance-flow.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/store/StoreFinancePage.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const owner = { id: '7', role: 'STORE_OWNER', storeId: '12' };
const ok = data => ({ data: { success: true, data } });
const receipt = { verificationId: '21', bankAccountId: '31', bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******123', amount: 2000, referenceCode: 'VERIFY_ABCD', expiresAt: '2099-01-01T00:00:00.000Z', instructions: 'Hướng dẫn từ máy chủ' };
const account = { id: '31', storeId: '12', bankBin: '970422', bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******123', verificationStatus: 'PENDING', isDefault: false };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function harness({ user = owner, api: overrides = {}, storage = new Map() } = {}) {
  const calls = [], slots = [], timers = new Map(), listeners = new Map();
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
      if (name === 'react-router-dom') return { Link: 'a' };
      if (name.endsWith('/api')) return { api: transport };
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user }) };
      if (name.endsWith('/OperationPrimitives')) return { card: 'card', primaryButton: 'primary' };
      if (name.endsWith('/store-finance-flow')) return finance;
      throw new Error(`Unexpected import ${name}`);
    },
    window: { setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); } },
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
  assert.match(h.text, /VERIFY_ABCD/); assert.match(h.text, /Chưa có thông tin tài khoản nhận tiền/);
  assert.match(h.text, /Chờ xác minh/);
  assert.equal(h.find('button', 'Thêm tài khoản').props.disabled, true);
  assert.equal(h.nodes.some(node => node.type === 'button' && node.props.children === 'Đặt mặc định'), false);
  assert.ok(h.storage.has(finance.financeVerificationKey('7', '12')));
  h.setAccounts([{ ...account, verificationStatus: 'OWNERSHIP_VERIFIED' }]); await h.tick();
  assert.match(h.text, /Ngân hàng đã xác nhận tài khoản chính chủ/);
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
