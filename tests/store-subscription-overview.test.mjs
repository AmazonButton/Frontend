import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const DAY = 86400000;
const now = Date.parse('2026-11-07T10:00:00Z');
const ok = data => ({ data: { success: true, data } });
const payment = (overrides = {}) => ({ id: '21', type: 'SUBSCRIPTION_PAYMENT', status: 'SUCCESS', amount: -150000, description: 'Phí gian hàng tháng 11', referenceId: 'SUB-9', createdAt: '2026-11-07T08:00:00Z', balanceBefore: 300000, balanceAfter: 150000, ...overrides });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function harness(prefix, helpers, get = async () => ok([payment()])) {
  const source = readFileSync(new URL(`${prefix}components/store/StoreSubscriptionPayments.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], calls = [], listeners = new Map(), timers = new Map(), blobs = [];
  let props = { scope: 'owner:12', storeId: '12', refreshKey: 0 }, session = 'A';
  let cursor = 0, dirty = true, effects = [], tree, mounted = true;
  const jsx = (type, props) => ({ type, props });
  const changed = (old, deps) => !old || deps.length !== old.deps.length || deps.some((value, index) => !Object.is(value, old.deps[index]));
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { const value = typeof next === 'function' ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }]; },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (changed(slots[index], deps)) slots[index] = { value: fn, deps }; return slots[index].value; },
    useMemo(fn, deps) { const index = cursor++; if (changed(slots[index], deps)) slots[index] = { value: fn(), deps }; return slots[index].value; },
    useEffect(fn, deps) { const index = cursor++; if (changed(slots[index], deps)) { const old = slots[index]; slots[index] = { deps, cleanup: old?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); }); } },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Blob,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:subscription-history'; }, revokeObjectURL() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
      if (name.endsWith('/store-subscription-overview')) return helpers;
      if (name.endsWith('/api')) return { apiSessionMarker: () => session, api: { get: async path => { calls.push(path); return get(path); } } };
      throw new Error(`Unexpected import: ${name}`);
    },
    window: { setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); } },
    document: { visibilityState: 'visible', addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); }, createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
  });
  const nodes = value => !value || typeof value !== 'object' ? [] : [value, ...[value.props?.children].flat(Infinity).flatMap(nodes)];
  const text = value => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : [value.props?.children].flat(Infinity).map(text).join('');
  const app = {
    calls, blobs,
    get text() { return text(tree); },
    get nodes() { return nodes(tree); },
    async flush() { for (let n = 0; n < 40; n++) { if (dirty && mounted) { cursor = 0; dirty = false; tree = exports.StoreSubscriptionPayments(props); const jobs = effects; effects = []; jobs.forEach(job => job()); } await Promise.resolve(); } },
    button(label) { const button = nodes(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || text(node).includes(label))); assert.ok(button, `Missing button: ${label}`); return button; },
    async click(label) { const button = this.button(label); assert.ok(!button.props.disabled, `Disabled: ${label}`); await button.props.onClick(); await this.flush(); },
    async change(type, value) { const node = nodes(tree).find(node => node.type === type); assert.ok(node); node.props.onChange({ target: { value } }); await this.flush(); },
    async props(next) { props = { ...props, ...next }; dirty = true; await this.flush(); },
    setSession(value) { session = value; },
    unmount() { mounted = false; slots.forEach(slot => slot.cleanup?.()); },
  };
  return app;
}

for (const prefix of ['../src/', '../frontend/src/']) {
  const helpers = await import(new URL(`${prefix}services/store-subscription-overview.ts`, import.meta.url));

  test(`${prefix}expiry warnings distinguish active, urgent, expired and prepaid future periods`, () => {
    const plan = { status: 'ACTIVE', startDate: new Date(now - 20 * DAY).toISOString(), endDate: new Date(now + 7 * DAY).toISOString() };
    assert.equal(helpers.subscriptionOverview(plan, now).expiring, true);
    assert.equal(helpers.subscriptionOverview(plan, now).urgent, false);
    assert.equal(helpers.subscriptionOverview({ ...plan, endDate: new Date(now + 3 * DAY).toISOString() }, now).urgent, true);
    assert.equal(helpers.subscriptionOverview({ ...plan, endDate: new Date(now).toISOString() }, now).state, 'EXPIRED');
    const future = helpers.subscriptionOverview({ ...plan, startDate: new Date(now + DAY).toISOString() }, now);
    assert.equal(future.state, 'UPCOMING'); assert.equal(future.progress, 0); assert.equal(future.expiring, false);
    assert.equal(helpers.subscriptionOverview(null, now).state, 'NONE');
    assert.equal(helpers.subscriptionOverview({ ...plan, endDate: 'bad', daysRemaining: null }, now).state, 'UNKNOWN');
    assert.equal(helpers.subscriptionOverview({ endDate: 'bad', daysRemaining: '' }, now).days, null);
  });

  test(`${prefix}current subscription cannot be attributed to a different store or malformed success`, () => {
    assert.throws(() => helpers.validateStoreSubscription({ storeId: '99' }, '12'), /không thuộc/);
    assert.throws(() => helpers.validateStoreSubscription(undefined, '12'));
    assert.throws(() => helpers.validateStoreSubscription([], '12'));
    assert.equal(helpers.validateStoreSubscription(null, '12'), null);
    assert.equal(helpers.validateStoreSubscription({ storeId: '90071992547409931' }, '90071992547409931').storeId, '90071992547409931');
  });

  test(`${prefix}only explicit successful subscription debits count, with exact decimal arithmetic`, () => {
    const rows = helpers.readSubscriptionPayments(ok([
      payment({ id: '90071992547409931', amount: '-100.10' }),
      payment({ id: '22', amount: '-200.20' }),
      payment({ id: '23', type: 'ORDER_REVENUE', amount: 900000 }),
      payment({ id: '24', type: 'WITHDRAWAL', amount: -900000 }),
      payment({ id: '25', type: 'FEE', amount: -900000, description: 'SUBSCRIPTION_PAYMENT' }),
      payment({ id: '26', status: 'PENDING', amount: -900000 }),
      payment({ id: '27', status: 'FAILED', amount: -900000 }),
      payment({ id: '28', status: undefined, amount: -900000 }),
      payment({ id: '29', amount: 900000 }),
    ]));
    assert.equal(rows.length, 6);
    assert.equal(helpers.subscriptionPaidTotal(rows), 300.3);
    assert.equal(helpers.subscriptionPaidTotal([]), 0);
    assert.ok(rows.some(row => row.id === '90071992547409931'));
    assert.equal(helpers.subscriptionMoney(null), '—');
    assert.equal(helpers.subscriptionMoney(''), '—');
  });

  test(`${prefix}malformed payment responses fail instead of presenting false zero totals`, () => {
    for (const envelope of [{ data: { success: false, data: [] } }, ok(null), ok({ items: [] }), ok([payment({ amount: null })]), ok([payment({ createdAt: 'invalid' })]), ok([payment({ id: '' })])]) assert.throws(() => helpers.readSubscriptionPayments(envelope));
    assert.equal(helpers.readSubscriptionPayments(ok([payment(), payment()])).length, 1);
    assert.throws(() => helpers.readSubscriptionPayments(ok([payment(), payment({ amount: -3 })])), /trùng/);
  });

  test(`${prefix}month grouping uses Vietnam time, filters use records and CSV escapes untrusted cells`, () => {
    assert.equal(helpers.subscriptionMonth('2026-10-31T18:00:00Z'), helpers.subscriptionMonth('2026-11-01T10:00:00Z'));
    const rows = helpers.readSubscriptionPayments(ok([payment(), payment({ id: '22', createdAt: '2026-08-01T00:00:00Z' })]));
    assert.equal(helpers.filterSubscriptionPayments(rows, 'THÁNG 11', '30', now).length, 1);
    assert.equal(helpers.filterSubscriptionPayments(rows, 'SUB-9', 'ALL', now).length, 2);
    const csv = helpers.subscriptionPaymentsCSV(helpers.readSubscriptionPayments(ok([payment({ description: '=SUM(1,2)\n"Test"', referenceId: '+CMD' })])));
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes("' =") === false);
    assert.ok(csv.includes("'=SUM(1,2)")); assert.ok(csv.includes('""Test""'));
    assert.ok(csv.includes("'+CMD")); assert.ok(csv.includes('-150000.00'));
  });

  test(`${prefix}actual history UI loads the authorized endpoint and expands genuine ledger details`, async () => {
    const app = harness(prefix, helpers); await app.flush();
    assert.deepEqual(app.calls, ['/store/wallet/transactions']);
    assert.match(app.text, /150\.000/); assert.match(app.text, /1 lần/);
    await app.click('Phí gian hàng tháng 11');
    assert.match(app.text, /SUB-9/); assert.match(app.text, /300\.000/);
    await app.click('Xuất CSV'); assert.equal(app.blobs.length, 1);
    assert.match(await app.blobs[0].text(), /SUB-9/);
    app.unmount();
  });

  test(`${prefix}history search and pagination work without additional requests`, async () => {
    const app = harness(prefix, helpers, async () => ok(Array.from({ length: 12 }, (_, index) => payment({ id: String(index + 1), description: `Gói ${index + 1}` }))));
    await app.flush(); assert.match(app.text, /Trang 1\/2/);
    await app.click('Trang giao dịch sau'); assert.match(app.text, /Trang 2\/2/);
    await app.change('input', 'Gói 12'); assert.match(app.text, /Trang 1\/1/);
    assert.equal(app.calls.length, 1);
    await app.change('input', 'Không tồn tại'); assert.match(app.text, /Không có giao dịch phù hợp/);
    assert.equal(app.button('Xuất CSV').props.disabled, true);
    app.unmount();
  });

  test(`${prefix}refresh failures retain known payments and first-load failure never claims zero`, async () => {
    let fail = false;
    const app = harness(prefix, helpers, async () => { if (fail) throw new Error('Unavailable'); return ok([payment()]); });
    await app.flush(); fail = true; await app.click('Tải lại lịch sử');
    assert.match(app.text, /150\.000/); assert.match(app.text, /Chưa cập nhật/);
    assert.equal(app.button('Xuất CSV').props.disabled, true);
    app.unmount();
    const broken = harness(prefix, helpers, async () => ok(null)); await broken.flush();
    assert.match(broken.text, /Chưa cập nhật/); assert.ok(!broken.text.includes('0 lần')); assert.ok(!broken.text.includes('Chưa ghi nhận phí'));
    broken.unmount();
  });

  test(`${prefix}in-flight history cannot leak across stores, sessions or unmounts`, async () => {
    const old = deferred(); let count = 0;
    const app = harness(prefix, helpers, async () => ++count === 1 ? old.promise : ok([payment({ id: '22', amount: -88000, description: 'Cửa hàng B' })]));
    await app.flush(); await app.props({ scope: 'owner-B:99', storeId: '99' });
    old.resolve(ok([payment({ description: 'Cửa hàng A' })])); await app.flush();
    assert.match(app.text, /Cửa hàng B/); assert.ok(!app.text.includes('Cửa hàng A')); app.unmount();
    const late = deferred(); const sessionApp = harness(prefix, helpers, async () => late.promise);
    await sessionApp.flush(); sessionApp.setSession('B'); late.resolve(ok([payment({ description: 'Phiên cũ' })])); await sessionApp.flush();
    assert.ok(!sessionApp.text.includes('Phiên cũ')); sessionApp.unmount();
  });

  test(`${prefix}global reload coalesces reads and absent store never sends a request`, async () => {
    const job = deferred(); const app = harness(prefix, helpers, async () => job.promise);
    await app.flush(); await app.props({ refreshKey: 1 }); await app.props({ refreshKey: 2 });
    assert.equal(app.calls.length, 1); job.resolve(ok([])); await app.flush();
    assert.match(app.text, /Chưa ghi nhận phí thuê sàn qua ví/); app.unmount();
    const missing = harness(prefix, helpers); await missing.props({ storeId: null });
    assert.equal(missing.calls.length, 0); assert.match(missing.text, /Chưa xác định được cửa hàng/); missing.unmount();
  });
}
