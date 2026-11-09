import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const customer = { id: '81', role: 'CUSTOMER', fullName: 'Khách kiểm thử', phone: '0912345678', email: 'test@example.invalid', customerProfile: { deliveryAddress: 'Địa chỉ kiểm thử' } };

function harness(prefix, { component = 'profile', user = customer, pathname = '/customer/profile', search = '', props = {}, patch } = {}) {
  const file = component === 'profile' ? 'pages/profile/ProfilePage.tsx' : component === 'navbar' ? 'layouts/Navbar.tsx' : 'components/customer/CustomerAccountNavigation.tsx';
  const compiled = ts.transpileModule(readFileSync(new URL(`${prefix}${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  let location = { pathname, search, hash: '' }, cursor = 0, dirty = true, effects = [], tree;
  const slots = [], calls = [], events = [], timeouts = [], storage = new Map(), navigation = [];
  const counts = { refresh: 0, logout: 0, reader: 0, focus: 0 };
  const jsx = (type, props) => ({ type, props });
  const changed = (old, deps) => !old || deps.some((value, index) => !Object.is(value, old.deps[index]));
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { const value = typeof next === 'function' ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }]; },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; if (changed(slots[index], deps)) slots[index] = { value: fn, deps }; return slots[index].value; },
    useEffect(fn, deps) { const index = cursor++; if (changed(slots[index], deps)) { const old = slots[index]; slots[index] = { deps, cleanup: old?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); }); } },
    lazy: load => ({ load }), Suspense: 'suspense',
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URLSearchParams,
    setTimeout(fn, delay) { timeouts.push({ fn, delay }); return timeouts.length; },
    FileReader: class { constructor() { counts.reader++; } readAsDataURL() { this.result = 'data:image/png;base64,fixture'; this.onloadend(); } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { location, scrollY: 0, addEventListener() {}, removeEventListener() {}, dispatchEvent: event => events.push(event) },
    document: { addEventListener() {}, removeEventListener() {}, body: {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-dom') return { createPortal: () => null };
      if (name === 'react-router-dom') return { Link: 'a', useLocation: () => location, useNavigate: () => (to, options) => navigation.push({ to, options }), useSearchParams: () => [new URLSearchParams(location.search), value => { location = { ...location, search: `?${new URLSearchParams(value)}` }; dirty = true; }] };
      if (name === 'framer-motion') return { motion: new Proxy({ create: () => 'a' }, { get: (target, key) => target[key] || `motion.${String(key)}` }), AnimatePresence: 'presence', useReducedMotion: () => false };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user, refreshUser: async () => { counts.refresh++; }, logout: () => { counts.logout++; } }) };
      if (name.endsWith('/OrderSoundContext')) return { useSound: () => ({ isSoundEnabled: true }) };
      if (name.endsWith('/ThemeContext')) return { useTheme: () => ({ theme: 'light' }) };
      if (name.endsWith('/api')) return { api: { get: async path => { calls.push({ method: 'GET', path }); return { data: { success: true, data: [] } }; }, patch: async (path, body) => { calls.push({ method: 'PATCH', path, body }); return patch ? patch(path, body) : { data: { success: true } }; }, post: async (path, body) => { calls.push({ method: 'POST', path, body }); return { data: { success: true } }; } } };
      if (name.endsWith('/order-events')) return { normalizeOrder: value => value };
      if (name.endsWith('.css')) return {};
      if (name.includes('/components/')) return new Proxy({}, { get: (_, key) => `component.${String(key)}` });
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const walk = value => {
    if (!value || typeof value !== 'object') return [];
    if (value.props?.ref) value.props.ref.current = { focus: () => { counts.focus++; } };
    return [value, ...[value.props?.children].flat(Infinity).flatMap(walk)];
  };
  const text = value => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : [value.props?.children].flat(Infinity).map(text).join('');
  const exported = component === 'profile' ? 'ProfilePage' : component === 'navbar' ? 'Navbar' : 'CustomerAccountNavigation';
  const app = {
    calls, counts, events, storage, timeouts, navigation,
    get nodes() { return walk(tree); }, get text() { return text(tree); },
    find(type, label) { const node = walk(tree).find(node => node.type === type && text(node).includes(label)); assert.ok(node, `Missing ${type}: ${label}`); return node; },
    async flush() { for (let n = 0; n < 30; n++) { if (dirty) { dirty = false; cursor = 0; tree = exports[exported](props); walk(tree); const jobs = effects; effects = []; jobs.forEach(job => job()); } await Promise.resolve(); } },
    async click(label) { await this.find('button', label).props.onClick(); await this.flush(); },
    async input(id, value) { const node = walk(tree).find(node => node.props.id === id); assert.ok(node, `Missing input: ${id}`); node.props.onChange({ target: { value } }); await this.flush(); },
    async submit() { const form = walk(tree).find(node => node.type === 'form'); assert.ok(form); await form.props.onSubmit({ preventDefault() {} }); await this.flush(); },
    async route(pathname, search = '', hash = '') { location = { pathname, search, hash }; dirty = true; await this.flush(); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
  return app;
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}account group opens for all existing tabs, highlights exactly one child and supports Escape`, async () => {
    const app = harness(prefix, { component: 'navigation' }); await app.flush();
    for (const tab of ['INFO', 'SECURITY']) {
      await app.route('/customer/profile', `?tab=${tab}&source=account`);
      assert.equal(app.find('button', 'Tài khoản').props['aria-expanded'], true);
      const current = app.nodes.filter(node => node.type === 'a' && node.props['aria-current'] === 'page');
      assert.equal(current.length, 1); assert.equal(current[0].props.to, `/customer/profile?tab=${tab}`);
    }
    await app.route('/customer/banking');
    const bankLink = app.nodes.filter(node => node.type === 'a' && node.props['aria-current'] === 'page');
    assert.equal(bankLink.length, 1); assert.equal(bankLink[0].props.to, '/customer/banking');
    await app.route('/customer/verification');
    const verification = app.nodes.filter(node => node.type === 'a' && node.props['aria-current'] === 'page');
    assert.equal(verification.length, 1); assert.equal(verification[0].props.to, '/customer/verification');
    const group = app.nodes[0]; let prevented = false;
    group.props.onKeyDown({ key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() {} }); await app.flush();
    assert.equal(app.find('button', 'Tài khoản').props['aria-expanded'], false); assert.equal(app.counts.focus, 1); assert.equal(prevented, true);
    await app.click('Tài khoản'); assert.equal(app.find('button', 'Tài khoản').props['aria-expanded'], true);
    app.unmount();
  });

  test(`${prefix}collapsed sidebar expands through its existing callback and mobile closes after navigation`, async () => {
    let expanded = 0, navigated = 0;
    const compact = harness(prefix, { component: 'navigation', props: { collapsed: true, onExpandSidebar: () => expanded++ } }); await compact.flush();
    assert.equal(compact.nodes.filter(node => node.type === 'a').length, 0);
    compact.nodes.find(node => node.type === 'button').props.onClick(); assert.equal(expanded, 1); compact.unmount();
    const mobile = harness(prefix, { component: 'navigation', props: { mobile: true, onNavigate: () => navigated++ } }); await mobile.flush();
    assert.equal(mobile.nodes.filter(node => node.type === 'a').length, 4);
    assert.ok(!mobile.text.includes('Địa chỉ đã lưu'));
    mobile.find('a', 'Thông tin cá nhân').props.onClick(); assert.equal(navigated, 1); mobile.unmount();
  });

  test(`${prefix}customer form has associated labels, editable fields and the same disabled email/role`, async () => {
    const app = harness(prefix); await app.flush();
    assert.ok(!app.nodes.some(node => node.props?.['aria-label'] === 'Quản lý tài khoản'));
    for (const field of ['name', 'phone', 'email', 'role', 'address']) {
      const id = `customer-profile-${field}`;
      assert.ok(app.nodes.some(node => ['input', 'textarea'].includes(node.type) && node.props.id === id));
      assert.ok(app.nodes.some(node => node.type === 'label' && node.props.htmlFor === id));
    }
    for (const field of ['email', 'role']) assert.equal(app.nodes.find(node => node.props.id === `customer-profile-${field}`).props.disabled, true);
    assert.ok(!app.text.includes('Đang kết nối')); assert.ok(!app.nodes.some(node => node.type === 'button' && textOf(node).includes('Đăng xuất')));
    await app.route('/customer/profile', '?tab=ADDRESSES');
    assert.ok(!app.text.includes('Địa chỉ đã lưu'));
    assert.ok(!app.text.includes('Thiết lập địa chỉ nhận hàng mặc định'));
    assert.equal(app.nodes.find(node => node.props.id === 'customer-profile-address').props.value, customer.customerProfile.deliveryAddress);
    await app.route('/customer/profile', '?tab=INFO', '#customer-identity-verification');
    assert.equal(app.navigation.at(-1).to, '/customer/verification');
    assert.equal(app.navigation.at(-1).options.replace, true);
    app.unmount();
  });

  test(`${prefix}save/cancel execute the existing callbacks and exact account-only PATCH payload`, async () => {
    const app = harness(prefix); await app.flush();
    await app.input('customer-profile-name', '  Tên cập nhật  '); await app.input('customer-profile-phone', ' 0988776655 ');
    await app.input('customer-profile-address', 'Địa chỉ nhập thử'); await app.submit();
    const mutations = app.calls.filter(call => call.method === 'PATCH');
    assert.equal(mutations.length, 1); assert.equal(mutations[0].path, '/auth/profile');
    assert.deepEqual(JSON.parse(JSON.stringify(mutations[0].body)), { fullName: 'Tên cập nhật', phone: '0988776655' });
    assert.equal(app.counts.refresh, 1); assert.match(app.text, /Đã cập nhật thông tin cá nhân/);
    await app.click('Hủy'); assert.equal(app.nodes.find(node => node.props.id === 'customer-profile-name').props.value, customer.fullName);
    assert.equal(app.nodes.find(node => node.props.id === 'customer-profile-address').props.value, customer.customerProfile.deliveryAddress);
    app.unmount();
  });

  test(`${prefix}save failure still displays backend feedback and restores the save control`, async () => {
    const app = harness(prefix, { patch: async () => { throw { response: { data: { message: ['Không thể lưu thông tin'] } } }; } });
    await app.flush(); await app.submit(); assert.match(app.text, /Không thể lưu thông tin/); assert.equal(app.find('button', 'Lưu thay đổi').props.disabled, false); app.unmount();
  });

  test(`${prefix}avatar upload/remove preserve file limit, preview, storage and header sync event`, async () => {
    const app = harness(prefix); await app.flush();
    const file = app.nodes.find(node => node.type === 'input' && node.props.type === 'file');
    assert.equal(file.props.accept, 'image/*'); assert.equal(file.props.className, 'sr-only');
    file.props.onChange({ target: { files: [{ size: 3 * 1024 * 1024 }] } }); await app.flush();
    assert.equal(app.counts.reader, 0); assert.match(app.text, /Kích thước ảnh tối đa là 2MB/);
    file.props.onChange({ target: { files: [{ size: 1000 }] } }); await app.flush();
    assert.equal(app.storage.get('sob_avatar_81'), 'data:image/png;base64,fixture');
    assert.equal(app.events.at(-1).type, 'sob_avatar_updated');
    assert.ok(app.nodes.some(node => node.type === 'img' && node.props.src === 'data:image/png;base64,fixture'));
    await app.click('Gỡ ảnh'); assert.equal(app.storage.has('sob_avatar_81'), false); assert.equal(app.events.at(-1).detail, null); app.unmount();
  });

  test(`${prefix}phone verification remains a real existing route and never invents a verified state`, async () => {
    const unknown = harness(prefix); await unknown.flush();
    assert.ok(unknown.nodes.some(node => node.type === 'a' && node.props.to === '/phone-auth?mode=verify'));
    assert.ok(!unknown.text.includes('Số điện thoại đã xác minh')); unknown.unmount();
    const verified = harness(prefix, { user: { ...customer, phoneVerified: true } }); await verified.flush();
    assert.match(verified.text, /Số điện thoại đã xác minh/);
    assert.ok(!verified.nodes.some(node => node.type === 'a' && node.props.to === '/phone-auth?mode=verify')); verified.unmount();
  });

  test(`${prefix}security keeps password validation, DTO and logout-after-success behavior`, async () => {
    const app = harness(prefix, { search: '?tab=SECURITY' }); await app.flush();
    const fill = async values => { const inputs = app.nodes.filter(node => node.type === 'input' && node.props.type === 'password'); assert.equal(inputs.length, 3); inputs.forEach((input, index) => input.props.onChange({ target: { value: values[index] } })); await app.flush(); };
    await fill(['Current8!', 'short', 'short']); await app.submit();
    assert.equal(app.calls.filter(call => call.method === 'POST').length, 0); assert.match(app.text, /tối thiểu 8 ký tự/);
    await fill(['Current8!', 'Updated9!', 'Updated9!']); await app.submit();
    const request = app.calls.find(call => call.method === 'POST');
    assert.equal(request.path, '/auth/change-password');
    assert.deepEqual(JSON.parse(JSON.stringify(request.body)), { currentPassword: 'Current8!', newPassword: 'Updated9!' });
    assert.equal(app.counts.logout, 0); app.timeouts.find(timer => timer.delay === 2000).fn();
    assert.equal(app.counts.logout, 1); assert.equal(app.navigation.at(-1).to, '/login'); app.unmount();
  });

  test(`${prefix}store profile navigation is retained while admin navigation moves to the sidebar`, async () => {
    for (const role of ['STORE_OWNER', 'STORE_MANAGER', 'SUPER_ADMIN']) {
      const app = harness(prefix, { user: { ...customer, role } }); await app.flush();
      assert.equal(app.nodes.some(node => node.props?.['aria-label'] === 'Quản lý tài khoản'), !['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(role));
      assert.equal(app.nodes.some(node => node.type === 'button' && textOf(node).includes('Đăng xuất')), !['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(role));
      assert.ok(!app.nodes.some(node => node.props?.className === 'profile-avatar account-profile-card'));
      app.unmount();
    }
  });

  test(`${prefix}existing avatar dropdown still confirms logout and uses the unchanged logout callback`, async () => {
    const app = harness(prefix, { component: 'navbar' }); await app.flush();
    app.nodes.find(node => node.props?.['aria-label'] === 'Mở menu tài khoản').props.onClick(); await app.flush();
    await app.click('Đăng xuất');
    const confirmation = app.nodes.find(node => node.type === 'component.LogoutConfirmModal');
    assert.equal(confirmation.props.isOpen, true); assert.equal(app.counts.logout, 0);
    confirmation.props.onConfirm(); assert.equal(app.counts.logout, 1);
    assert.equal(app.navigation.at(-1).to, '/login'); assert.equal(app.navigation.at(-1).options.replace, true); app.unmount();
  });
}

function textOf(node) { return node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(textOf).join(''); }
