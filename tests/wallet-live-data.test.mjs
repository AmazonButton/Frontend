import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as walletData from '../src/services/wallet-api-data.ts';
import * as frontendWalletData from '../frontend/src/services/wallet-api-data.ts';
import * as withdrawalsFlow from '../src/services/store-withdrawals.ts';
import * as frontendWithdrawalsFlow from '../frontend/src/services/store-withdrawals.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const liveResponse = { success: true, data: { walletId: '1', storeId: '1', balance: 15000000, frozenBalance: 0, bankName: 'Test Bank', bankAccountNumber: null, bankAccountNumberMasked: null, bankAccountHolder: 'TEST OWNER' } };
const verifiedAccount = { id: '90071992547409931', storeId: '1', bankBin: '970422', bankName: 'Verified Bank', accountName: 'VERIFIED OWNER', accountNumberMasked: '******4321', isDefault: true, verificationStatus: 'OWNERSHIP_VERIFIED' };
for (const flow of [withdrawalsFlow, frontendWithdrawalsFlow]) {
  test('recipient resolution uses only verified accounts in the authenticated store and never guesses between defaults', () => {
    assert.equal(flow.withdrawalRecipient([verifiedAccount], '1').id, verifiedAccount.id);
    assert.equal(flow.withdrawalRecipient([{ ...verifiedAccount, isDefault: false }], '1').id, verifiedAccount.id);
    assert.equal(flow.withdrawalRecipient([{ ...verifiedAccount, verificationStatus: 'PENDING' }], '1'), null);
    assert.equal(flow.withdrawalRecipient([{ ...verifiedAccount, isDefault: false }, { ...verifiedAccount, id: '2', isDefault: false }], '1'), null);
    assert.equal(flow.withdrawalRecipient([verifiedAccount, { ...verifiedAccount, id: '2' }], '1'), null);
    assert.throws(() => flow.withdrawalRecipient([{ ...verifiedAccount, storeId: '2' }], '1'));
    assert.throws(() => flow.withdrawalRecipient([{ ...verifiedAccount, accountNumberMasked: '' }], '1'));
    const pending = flow.readPendingWithdrawal(JSON.stringify({ key: 'wd_old', amount: 50000, accountId: verifiedAccount.id, createdAt: Date.now(), accountNumber: 'must-not-persist' }));
    assert.equal(pending.accountId, verifiedAccount.id); assert.equal(pending.accountNumber, undefined);
    for (const value of ['{', '{}', JSON.stringify({ ...pending, amount: 49999 })]) assert.throws(() => flow.readPendingWithdrawal(value));
  });
}

for (const data of [walletData, frontendWalletData]) {
  test('wallet preserves the actual API balance and maps frozenBalance without subtracting twice', () => {
    const actual = data.normalizeWalletInfo(liveResponse.data);
    assert.equal(actual.balance, 15000000); assert.equal(actual.availableBalance, 15000000); assert.equal(actual.pendingBalance, 0);
    assert.equal(actual.bankAccount, undefined); assert.equal(actual.payosPayoutBalance, undefined); assert.equal(actual.payosPayoutConnected, undefined);
    const zero = data.normalizeWalletInfo({ storeId: '1', balance: '0', frozenBalance: '123000' });
    assert.equal(zero.availableBalance, 0); assert.equal(zero.pendingBalance, 123000);
    const missing = data.normalizeWalletInfo({ storeId: '1', balance: '73450' });
    assert.equal(missing.availableBalance, 73450); assert.equal(missing.pendingBalance, undefined);
    for (const raw of [{ storeId: '1' }, { storeId: '1', balance: '' }, { storeId: '1', balance: null }, { storeId: '1', balance: 'bad' }, []]) assert.throws(() => data.normalizeWalletInfo(raw));
    assert.throws(() => data.walletEnvelope({ success: false, data: { balance: 15000000 } }));
  });
  test('masked bank fields and paginated ledger rows keep their real ids, amounts and states', () => {
    const wallet = data.normalizeWalletInfo({ ...liveResponse.data, bankAccountNumberMasked: '******1234' });
    assert.equal(wallet.bankAccount.isMasked, true); assert.equal(wallet.bankAccount.bankBin, ''); assert.equal(wallet.bankAccount.verificationStatus, undefined);
    const page = { page: 2, pageSize: 20, totalItems: 21, totalPages: 2, hasNextPage: false };
    const transactions = data.normalizeWalletHistory({ success: true, data: [{ transactionId: '90071992547409931', amount: '-50000', type: 'SUBSCRIPTION_PAYMENT' }], pagination: page }, 'transactions');
    assert.equal(transactions.data[0].id, '90071992547409931'); assert.equal(transactions.data[0].amount, -50000); assert.equal(transactions.data[0].status, undefined); assert.deepEqual(transactions.pagination, page);
    const withdrawals = data.normalizeWalletHistory({ success: true, data: [{ withdrawalId: '8', amount: '50000', bankAccountMasked: '******1234', bankAccountHolder: 'TEST OWNER', status: 'SUCCEEDED' }] }, 'withdrawals');
    assert.equal(withdrawals.data[0].id, '8'); assert.equal(withdrawals.data[0].accountNumber, '******1234'); assert.equal(withdrawals.data[0].status, 'SUCCEEDED');
    assert.throws(() => data.normalizeWalletHistory({ success: true, data: [{ id: '1', amount: null }] }, 'transactions'));
  });
}

function service(prefix, overrides) {
  const code = ts.transpileModule(readFileSync(new URL(prefix + 'services/wallet.service.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name === './api' ? { api: overrides } : name === './wallet-api-data' ? walletData : require(name) });
  return exports.walletService;
}
function walletScreen(prefix, { fail = false, wallet = liveResponse.data, accounts = [], post, storage = new Map(), role = 'STORE_OWNER', accountsFailure = false, storageFailure = false, history = [], detail } = {}) {
  const code = ts.transpileModule(readFileSync(new URL(prefix + 'pages/store/StoreWalletPage.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], calls = [], posts = []; let cursor = 0, dirty = true, effects = [], tree, failed = fail, registry = accounts, balance = wallet;
  const jsx = (type, props) => ({ type, props });
  const changed = (old, deps) => !old || deps.some((v, i) => !Object.is(v, old.deps[i]));
  const react = {
    useState(initial) { const i = cursor++; slots[i] ||= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; dirty = true; }]; },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (changed(slots[i], deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useMemo(fn, deps) { const i = cursor++; if (changed(slots[i], deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (changed(slots[i], deps)) { const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, Date, crypto: { randomUUID: () => 'test-uuid' }, sessionStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => { if (storageFailure) throw Error('storage blocked'); storage.set(key, value); },
    removeItem: key => storage.delete(key),
  }, window: { setTimeout: () => 1, clearTimeout() {} }, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'framer-motion') return { motion: new Proxy({}, { get: (_, k) => `motion.${String(k)}` }), AnimatePresence: 'presence' };
    if (name === 'lucide-react') return new Proxy({}, { get: (_, k) => `icon.${String(k)}` });
    if (name === 'react-router-dom') return { Link: 'a' };
    if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { id: '1', storeId: '1', role } }) };
    if (name.endsWith('/useDashboardRefresh')) return { useDashboardRefresh() {} };
    if (name.endsWith('/dashboard-metrics')) return { formatMetric: (value, money) => value == null ? '—' : Number(value).toLocaleString('vi-VN') + (money ? ' ₫' : '') };
    if (name.endsWith('/store-withdrawals')) return withdrawalsFlow;
    if (name.endsWith('/store-finance-flow')) return { financeStoreId: () => '1', createStoreFinanceFlow: () => ({ accounts: async id => {
      calls.push('accounts:' + id); if (accountsFailure) throw Error('registry unavailable'); return registry;
    } }) };
    if (name.endsWith('/wallet.service')) return { walletService: {
      getWallet: async () => { calls.push('wallet'); if (failed) throw new Error('Ví chưa sẵn sàng'); return { data: walletData.normalizeWalletInfo(balance) }; },
      getTransactions: async () => ({ data: [] }), getWithdrawals: async () => ({ data: history }),
      getWithdrawal: async (id, storeId) => { calls.push('detail:' + id + ':' + storeId); return detail; },
      requestWithdrawal: async data => { posts.push({ ...data }); if (post) return post(data); return { data: { withdrawalId: '71', storeId: '1', amount: data.amount, status: 'PROCESSING', bankName: 'Verified Bank', bankAccountMasked: '******4321' } }; },
    } };
    if (name.endsWith('/api')) return { api: { get: async () => ({ data: { success: true, data: [] } }) } };
    throw new Error('Unexpected import ' + name);
  } });
  const walk = value => value && typeof value === 'object' ? [value, ...[value.props?.children].flat(Infinity).flatMap(walk)] : [];
  const text = value => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : [value.props?.children].flat(Infinity).map(text).join('');
  const app = { calls, posts, storage, get text() { return text(tree); }, get nodes() { return walk(tree); },
    async flush() { for (let i = 0; i < 40; i++) { if (dirty) { cursor = 0; dirty = false; tree = exports.StoreWalletWorkspace(); const jobs = effects; effects = []; jobs.forEach(fn => fn()); } await Promise.resolve(); } },
    async failRefresh() { failed = true; const button = walk(tree).find(n => n.type === 'button' && text(n).includes('Làm mới')); await button.props.onClick(); await this.flush(); },
    async amount(value) { walk(tree).find(n => n.type === 'input' && n.props.type === 'number').props.onChange({ target: { value } }); await this.flush(); },
    submit() { return walk(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); },
    accounts(value) { registry = value; }, wallet(value) { balance = value; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  }; return app;
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}withdrawal sends only supported DTO fields and the caller's stable key`, async () => {
    const calls = [];
    const api = service(prefix, { post: async (path, body, config) => { calls.push({ path, body, config }); return { data: { success: true, data: { withdrawalId: '1' } } }; } });
    await api.requestWithdrawal({ amount: 50000, idempotencyKey: 'wd_fixed', note: 'unsupported', accountNumber: 'secret' });
    await api.requestWithdrawal({ amount: 50000, idempotencyKey: 'wd_fixed' });
    assert.equal(calls[0].path, '/store/wallet/withdrawals');
    assert.deepEqual({ ...calls[0].body }, { amount: 50000 });
    assert.equal(calls[0].config.headers['x-idempotency-key'], 'wd_fixed');
    assert.equal(calls[1].config.headers['idempotency-key'], 'wd_fixed');
    for (const invalid of [{ amount: 1, idempotencyKey: 'wd_fixed' }, { amount: 50000 }, { amount: 50000.5, idempotencyKey: 'wd_fixed' }]) await assert.rejects(api.requestWithdrawal(invalid));
    assert.equal(calls.length, 2);
  });
  test(`${prefix}withdrawal detail reads the existing scoped API and rejects a different store or id`, async () => {
    const response = { withdrawalId: '90071992547409931', storeId: '1', amount: 50000, fee: 1000, netAmount: 49000, bankAccountMasked: '******4321', bankAccountHolder: 'VERIFIED OWNER', status: 'PROCESSING', failureReason: 'PENDING_RECONCILIATION' };
    const calls = [];
    const api = service(prefix, { get: async path => { calls.push(path); return { data: { success: true, data: response } }; } });
    const detail = await api.getWithdrawal(response.withdrawalId, '1');
    assert.equal(detail.accountNumber, '******4321'); assert.equal(detail.fee, 1000); assert.equal(detail.netAmount, 49000);
    assert.equal(detail.status, 'PROCESSING'); assert.equal(detail.failureReason, 'PENDING_RECONCILIATION');
    assert.equal(calls[0], '/store/wallet/withdrawals/90071992547409931');
    await assert.rejects(api.getWithdrawal(response.withdrawalId, '2'), /không thuộc/);
    await assert.rejects(api.getWithdrawal('99', '1'), /không thuộc/);
  });
  test(`${prefix}withdrawal details show the actual recipient, fees and pending reconciliation without inventing success`, async () => {
    const app = walletScreen(prefix, { accounts: [verifiedAccount], history: [{ id: '71', amount: 50000, status: 'PROCESSING', bankName: 'Snapshot Bank', accountNumber: '******9876' }], detail: { id: '71', amount: 50000, fee: 1000, netAmount: 49000, status: 'PROCESSING', bankName: 'Snapshot Bank', accountNumber: '******9876', accountHolderName: 'SNAPSHOT OWNER', failureReason: 'PENDING_RECONCILIATION', providerPayoutId: 'payout_71' } });
    await app.flush(); app.nodes.find(node => node.type === 'button' && node.props.children === 'Chi tiết').props.onClick(); await app.flush();
    assert.match(app.text, /SNAPSHOT OWNER|Snapshot Bank/); assert.match(app.text, /49\.000/);
    assert.match(app.text, /PENDING_RECONCILIATION/); assert.doesNotMatch(app.text, /Đã chuyển thành công/); app.unmount();
  });
  test(`${prefix}verified registry supplies the recipient even when the legacy wallet bank is missing`, async () => {
    const app = walletScreen(prefix, { accounts: [verifiedAccount] }); await app.flush();
    assert.match(app.text, /VERIFIED OWNER/); assert.match(app.text, /\*\*\*\*\*\*4321/);
    await app.amount('50000'); await app.submit(); await app.flush();
    assert.equal(app.posts.length, 1); assert.equal(app.storage.size, 0);
    assert.match(app.text, /Đang chuyển tiền/); assert.doesNotMatch(app.text, /Đã chuyển thành công/);
    assert.ok(app.nodes.some(n => n.type === 'a' && n.props.to === '/store/finance#store-bank-accounts'));
    app.unmount();
  });
  test(`${prefix}legacy saved bank, a registry failure or another store's bank cannot enable withdrawals`, async () => {
    for (const options of [{ accounts: [] }, { accountsFailure: true }, { accounts: [{ ...verifiedAccount, storeId: '2' }] }, { accounts: [{ ...verifiedAccount, verificationStatus: 'PENDING' }] }]) {
      const app = walletScreen(prefix, { wallet: { ...liveResponse.data, bankAccountNumber: 'old-number', bankAccountHolder: 'OLD HOLDER' }, ...options }); await app.flush();
      assert.doesNotMatch(app.text, /OLD HOLDER|old-number/);
      assert.ok(app.nodes.find(n => n.type === 'button' && n.props.type === 'submit').props.disabled);
      await app.amount('50000'); await app.submit(); assert.equal(app.posts.length, 0); app.unmount();
    }
  });
  test(`${prefix}an account change immediately before confirmation stops the withdrawal`, async () => {
    const app = walletScreen(prefix, { accounts: [verifiedAccount] }); await app.flush(); await app.amount('50000');
    app.accounts([{ ...verifiedAccount, id: '99' }]); await app.submit(); await app.flush();
    assert.equal(app.posts.length, 0); assert.match(app.text, /Tài khoản nhận tiền đã thay đổi/); app.unmount();
  });
  test(`${prefix}leaving while the bank preflight is pending cannot dispatch a withdrawal`, async () => {
    let resolve;
    const app = walletScreen(prefix, { accounts: [verifiedAccount] }); await app.flush(); await app.amount('50000');
    app.accounts(new Promise(done => { resolve = done; })); const request = app.submit(); app.unmount();
    resolve([verifiedAccount]); await request; assert.equal(app.posts.length, 0);
  });
  test(`${prefix}a timeout survives reload and recovery reuses amount and key without demanding the old balance`, async () => {
    const storage = new Map();
    const first = walletScreen(prefix, { accounts: [verifiedAccount], storage, post: async () => { throw Error('timeout'); } });
    await first.flush(); await first.amount('50000'); await first.submit(); await first.flush();
    assert.equal(first.posts.length, 1); assert.equal(storage.size, 1);
    assert.match(first.text, /Chưa xác nhận được kết quả/);
    const initial = first.posts[0]; first.unmount();
    const restored = walletScreen(prefix, { accounts: [verifiedAccount], storage, wallet: { ...liveResponse.data, balance: 0 } });
    await restored.flush();
    assert.equal(restored.nodes.find(n => n.type === 'input' && n.props.type === 'number').props.disabled, true);
    assert.equal(restored.nodes.find(n => n.type === 'button' && n.props.type === 'submit').props.disabled, false);
    await restored.submit(); await restored.flush();
    assert.deepEqual(restored.posts[0], initial); assert.equal(storage.size, 0); restored.unmount();
  });
  test(`${prefix}duplicate submits cannot dispatch two withdrawals and storage failure dispatches none`, async () => {
    let resolve;
    const job = new Promise(done => { resolve = done; });
    const app = walletScreen(prefix, { accounts: [verifiedAccount], post: () => job });
    await app.flush(); await app.amount('50000');
    const one = app.submit(), two = app.submit(); await app.flush(); assert.equal(app.posts.length, 1);
    resolve({ data: { withdrawalId: '71', storeId: '1', amount: 50000, status: 'PENDING' } });
    await Promise.all([one, two]); await app.flush(); assert.match(app.text, /Chờ xử lý/); app.unmount();
    const blocked = walletScreen(prefix, { accounts: [verifiedAccount], storageFailure: true });
    await blocked.flush(); await blocked.amount('50000'); await blocked.submit(); await blocked.flush();
    assert.equal(blocked.posts.length, 0); assert.match(blocked.text, /Chưa lưu được mã yêu cầu/); blocked.unmount();
  });
  test(`${prefix}manager wallet operations retain backend permissions without claiming to manage owner banks`, async () => {
    const app = walletScreen(prefix, { role: 'STORE_MANAGER' }); await app.flush(); await app.amount('50000');
    await app.submit(); await app.flush(); assert.equal(app.posts.length, 1);
    assert.equal(app.calls.some(call => call.startsWith('accounts:')), false);
    assert.equal(app.nodes.some(n => n.type === 'a' && n.props.to === '/store/finance#store-bank-accounts'), false); app.unmount();
  });
  test(`${prefix}wallet service uses the real wallet response and deployed history pagination`, async () => {
    const calls = [];
    const api = service(prefix, { get: async (path, config) => { calls.push({ path, config }); return path === '/store/wallet' ? { data: liveResponse } : { data: { success: true, data: [], pagination: { totalItems: 0 } } }; }, put: async (path, body) => { calls.push({ path, body }); return { data: liveResponse }; } });
    assert.equal((await api.getWallet()).data.availableBalance, 15000000);
    await api.getTransactions(undefined, 2); await api.getWithdrawals(undefined, 3);
    assert.equal(calls[1].config.params.page, 2); assert.equal(calls[2].config.params.page, 3);
  });
  test(`${prefix}wallet UI shows API balance and zero hold, without fabricated PayOS/fee/verification claims`, async () => {
    const app = walletScreen(prefix); await app.flush();
    assert.match(app.text, /15\.000\.000/); assert.match(app.text, /0 ₫/);
    assert.match(app.text, /Chưa có thông tin/); assert.doesNotMatch(app.text, /Có thể rút ngay|Miễn phí giao dịch|Ngay tức thì|Đã xác thực/);
    assert.ok(app.nodes.some(n => n.type === 'button' && n.props.type === 'submit' && n.props.disabled));
    await app.failRefresh(); assert.match(app.text, /15\.000\.000/); assert.match(app.text, /Chưa xác nhận lại/); app.unmount();
  });
  test(`${prefix}failed first load and wrong-store responses never fabricate a balance`, async () => {
    for (const options of [{ fail: true }, { wallet: { ...liveResponse.data, storeId: '2' } }]) {
      const app = walletScreen(prefix, options); await app.flush(); assert.ok(!app.text.includes('15.000.000')); assert.match(app.text, /—/); app.unmount();
    }
  });
}
