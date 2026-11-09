import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Render the actual components and exercise their controls without a live account.
function screen(prefix, file, exported, { role = 'STORE_OWNER', tab = '', section = '', sound = true, pathname = '/store/analytics', hash = '', props = {} } = {}) {
  let search = new URLSearchParams(section ? { section } : tab ? { tab } : {});
  let cursor = 0;
  const slots = [], effects = [], requests = [], navigation = [];
  const state = { sound, theme: 'light', loggedOut: false };
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef: initial => ({ current: initial }),
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
    lazy: load => ({ load }),
    Suspense: 'suspense',
  };
  const user = { id: '7', role, fullName: 'Chủ cửa hàng', store: { id: '12', name: 'Cửa hàng kiểm thử' } };
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL(`${prefix}${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, URLSearchParams,
    localStorage: { getItem: () => null },
    window: {},
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'framer-motion') return { motion: new Proxy({ create: () => 'motion.a' }, { get: (target, key) => target[key] || `motion.${String(key)}` }), AnimatePresence: 'presence', LayoutGroup: 'layout', useReducedMotion: () => true };
      if (name === 'react-dom') return { createPortal: () => null };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => `icon.${String(key)}` });
      if (name === 'react-router-dom') return {
        Link: 'a', useLocation: () => ({ pathname, search: search.toString(), hash }),
        useNavigate: () => (to, options) => navigation.push({ to, options }),
        useSearchParams: () => [search, value => { search = new URLSearchParams(value); }],
      };
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user, logout: () => { state.loggedOut = true; } }) };
      if (name.endsWith('/OrderSoundContext')) return { useSound: () => ({ isSoundEnabled: state.sound, toggleSound: () => { state.sound = !state.sound; } }) };
      if (name.endsWith('/ThemeContext')) return { useTheme: () => ({ theme: state.theme, toggleTheme: () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; } }) };
      if (name.endsWith('/SidebarContext')) return { useSidebar: () => ({ isSidebarOpen: true }) };
      if (name.endsWith('/CustomerAccountNavigation')) return { CustomerAccountNavigation: 'customer-account-navigation', CUSTOMER_ACCOUNT_LINKS: [{ tab: 'INFO', label: 'Thông tin cá nhân' }, { tab: 'ADDRESSES', label: 'Địa chỉ đã lưu' }, { tab: 'SECURITY', label: 'Bảo mật & Đổi mật khẩu' }] };
      if (name.endsWith('/StoreFinanceNavigation')) return { StoreFinanceNavigation: 'store-finance-navigation' };
      if (name.endsWith('/StoreRevenueNavigation')) return { StoreRevenueNavigation: 'store-revenue-navigation' };
      if (name.endsWith('/AdminPackageNavigation')) return { AdminPackageNavigation: 'admin-package-navigation' };
      if (name.endsWith('/AdminAccountNavigation')) return { AdminAccountNavigation: 'admin-account-navigation' };
      if (name.endsWith('/AdminRevenueNavigation')) return { AdminRevenueNavigation: 'admin-revenue-navigation' };
      if (name.endsWith('/LogoutConfirmModal')) return { LogoutConfirmModal: 'logout-confirm-modal' };
      if (name.endsWith('/api') || name.endsWith('/services')) return { api: { get: async path => { requests.push(path); return { data: { success: true, data: [] } }; } } };
      if (name.endsWith('/order-events')) return { normalizeOrder: value => value };
      if (name.endsWith('.css')) return {};
      if (name.includes('/components/') || name.endsWith('/OperationPrimitives') || name === './CustomerVerificationDetails') return new Proxy({}, { get: (_, key) => `component.${String(key)}` });
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join('');
  let tree;
  const app = {
    render() { cursor = 0; effects.length = 0; tree = exports[exported](props); return app; },
    get nodes() { return nodes(tree); },
    get text() { return text(tree); },
    get search() { return search; },
    runEffects() { effects.forEach(effect => effect()); },
    state, requests, navigation,
  };
  return app.render();
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}admin payout tracking is nested under reports with its existing route`, () => {
    for (const [pathname, section, target] of [['/admin/payouts', '', '/admin/payouts'], ['/admin/dashboard', 'ANALYTICS', '/admin/dashboard?section=ANALYTICS']]) {
      const sidebar = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role: 'SYSTEM_ADMIN', pathname, section });
      assert.equal(sidebar.nodes.filter(node => node.type === 'admin-revenue-navigation').length, 2);
      assert.equal(sidebar.nodes.some(node => node.type === 'a' && node.props.to === '/admin/payouts'), false);
      const menu = screen(prefix, 'components/admin/AdminRevenueNavigation.tsx', 'AdminRevenueNavigation', { role: 'SYSTEM_ADMIN', pathname, section });
      assert.equal(menu.nodes.find(node => node.type === 'button').props['aria-expanded'], true);
      assert.equal(menu.nodes.find(node => node.type === 'a' && node.props['aria-current']).props.to, target);
      assert.equal(menu.nodes.filter(node => node.type === 'a').length, 2);
      menu.nodes.find(node => node.type === 'button').props.onClick(); menu.render();
      assert.equal(menu.nodes.some(node => node.type === 'a'), false); assert.deepEqual(menu.requests, []);
    }
  });
  test(`${prefix}admin account expands to personal information and keeps the existing profile route`, () => {
    for (const role of ['ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN']) {
      const sidebar = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role, pathname: '/admin/profile' });
      assert.equal(sidebar.nodes.filter(node => node.type === 'admin-account-navigation').length, 2);
      assert.equal(sidebar.nodes.some(node => node.type === 'a' && node.props.to === '/admin/profile'), false);
    }
    const app = screen(prefix, 'components/admin/AdminAccountNavigation.tsx', 'AdminAccountNavigation', { role: 'ADMIN', pathname: '/admin/dashboard' });
    assert.equal(app.nodes.find(node => node.type === 'button').props['aria-expanded'], false);
    app.nodes.find(node => node.type === 'button').props.onClick(); app.render();
    assert.equal(app.nodes.find(node => node.type === 'a').props.to, '/admin/profile?tab=INFO');
    app.nodes.find(node => node.type === 'button').props.onClick(); app.render(); assert.equal(app.nodes.some(node => node.type === 'a'), false);
    const profile = screen(prefix, 'components/admin/AdminAccountNavigation.tsx', 'AdminAccountNavigation', { role: 'ADMIN', pathname: '/admin/profile' });
    assert.equal(profile.nodes.find(node => node.type === 'a').props['aria-current'], 'page'); assert.deepEqual(profile.requests, []);
  });
  test(`${prefix}all admin account sections live in the sidebar and logout retains confirmation`, () => {
    for (const tab of ['INFO', 'ORDERS', 'ADDRESSES', 'SECURITY']) {
      const app = screen(prefix, 'components/admin/AdminAccountNavigation.tsx', 'AdminAccountNavigation', { role: 'ADMIN', pathname: '/admin/profile', tab });
      assert.equal(app.nodes.filter(node => node.type === 'a').length, 4);
      assert.equal(app.nodes.find(node => node.type === 'a' && node.props['aria-current']).props.to, '/admin/profile?tab=' + tab);
      const profile = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { role: 'ADMIN', pathname: '/admin/profile', tab });
      assert.equal(profile.nodes.some(node => node.type === 'nav' && node.props['aria-label'] === 'Quản lý tài khoản'), false);
    }
    const app = screen(prefix, 'components/admin/AdminAccountNavigation.tsx', 'AdminAccountNavigation', { role: 'ADMIN', pathname: '/admin/profile' });
    app.nodes.find(node => node.type === 'button' && node.props.children?.includes?.('Đăng xuất')).props.onClick(); app.render();
    assert.equal(app.state.loggedOut, false);
    const modal = app.nodes.find(node => node.type === 'logout-confirm-modal'); assert.equal(modal.props.isOpen, true);
    modal.props.onConfirm(); assert.equal(app.state.loggedOut, true); assert.equal(app.navigation.at(-1).to, '/login');
  });
  test(`${prefix}admin package menu groups service plans and button rentals without changing destinations`, () => {
    for (const section of ['PLANS', 'RENTALS']) {
      const sidebar = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role: 'SYSTEM_ADMIN', pathname: '/admin/dashboard', section });
      assert.equal(sidebar.nodes.filter(node => node.type === 'admin-package-navigation').length, 2);
      assert.equal(sidebar.nodes.some(node => node.type === 'a' && node.props.to === '/admin/dashboard?section=PLANS'), false);
      const app = screen(prefix, 'components/admin/AdminPackageNavigation.tsx', 'AdminPackageNavigation', { role: 'SYSTEM_ADMIN', pathname: '/admin/dashboard', section });
      assert.equal(app.nodes.find(node => node.type === 'button').props['aria-expanded'], true);
      assert.equal(app.nodes.find(node => node.type === 'a' && node.props['aria-current']).props.to, '/admin/dashboard?section=' + section);
      assert.equal(app.nodes.filter(node => node.type === 'a').length, 2);
      app.nodes.find(node => node.type === 'button').props.onClick(); app.render();
      assert.equal(app.nodes.some(node => node.type === 'a'), false); assert.deepEqual(app.requests, []);
    }
  });
  test(`${prefix}revenue sidebar expands into separate report and wallet destinations`, () => {
    const app = screen(prefix, 'components/store/StoreRevenueNavigation.tsx', 'StoreRevenueNavigation', { pathname: '/store/products' });
    assert.equal(app.nodes.find(node => node.type === 'button').props['aria-expanded'], false);
    app.nodes.find(node => node.type === 'button').props.onClick(); app.render();
    assert.deepEqual(app.nodes.filter(node => node.type === 'a').map(node => node.props.to), ['/store/analytics', '/store/analytics?tab=WALLET']);
    app.nodes.find(node => node.type === 'button').props.onClick(); app.render();
    assert.equal(app.nodes.some(node => node.type === 'a'), false);
    const wallet = screen(prefix, 'components/store/StoreRevenueNavigation.tsx', 'StoreRevenueNavigation', { pathname: '/store/analytics', tab: 'WALLET' });
    assert.equal(wallet.nodes.find(node => node.type === 'button').props['aria-expanded'], true);
    assert.equal(wallet.nodes.find(node => node.type === 'a' && node.props['aria-current']).props.to, '/store/analytics?tab=WALLET');
    assert.deepEqual(wallet.requests, []);
  });
  test(`${prefix}finance sidebar expands into the four existing destinations and collapses without navigation`, () => {
    const app = screen(prefix, 'components/store/StoreFinanceNavigation.tsx', 'StoreFinanceNavigation', { pathname: '/store/products', props: { canRegister: true } });
    const trigger = () => app.nodes.find(node => node.type === 'button');
    assert.equal(trigger().props['aria-expanded'], false);
    trigger().props.onClick(); app.render();
    assert.equal(trigger().props['aria-expanded'], true);
    assert.deepEqual(app.nodes.filter(node => node.type === 'a').map(node => node.props.to), ['/store/service-plans', '/store/finance#subscription-current', '/store/finance#subscription-payments', '/store/finance#store-bank-accounts']);
    app.nodes[0].props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); app.render();
    assert.equal(trigger().props['aria-expanded'], false); assert.deepEqual(app.requests, []); assert.deepEqual(app.navigation, []);
  });
  test(`${prefix}finance sidebar opens the active hash, respects manager links and supports a collapsed sidebar`, () => {
    const app = screen(prefix, 'components/store/StoreFinanceNavigation.tsx', 'StoreFinanceNavigation', { pathname: '/store/finance', hash: '#subscription-payments', props: { canRegister: false } });
    assert.equal(app.nodes.find(node => node.type === 'button').props['aria-expanded'], true);
    assert.equal(app.nodes.find(node => node.type === 'a' && node.props['aria-current']).props.to, '/store/finance#subscription-payments');
    assert.equal(app.nodes.some(node => node.type === 'a' && node.props.to === '/store/service-plans'), false);
    let expanded = 0;
    const collapsed = screen(prefix, 'components/store/StoreFinanceNavigation.tsx', 'StoreFinanceNavigation', { props: { canRegister: true, collapsed: true, onExpandSidebar: () => expanded++ } });
    collapsed.nodes.find(node => node.type === 'button').props.onClick(); assert.equal(expanded, 1);
    assert.equal(collapsed.nodes.some(node => node.type === 'a'), false);
  });
  test(`${prefix}owner opens service plans while other roles keep their IoT rental navigation`, () => {
    const owner = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role: 'STORE_OWNER', pathname: '/store/service-plans' });
    assert.equal(owner.nodes.filter(node => node.type === 'store-finance-navigation' && node.props.canRegister).length, 2);
    assert.equal(owner.nodes.some(node => node.type === 'a' && node.props.to === '/store/rentals'), false);
    const manager = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role: 'STORE_MANAGER' });
    assert.ok(manager.nodes.some(node => node.type === 'a' && node.props.to === '/store/rentals'));
    const customer = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role: 'CUSTOMER' });
    assert.ok(customer.nodes.some(node => node.type === 'a' && node.props.to === '/customer/rentals'));
    assert.equal(customer.nodes.some(node => node.type === 'a' && node.props.to === '/store/service-plans'), false);
  });
  test(`${prefix}customer sidebar keeps eKYC inside the account group`, () => {
    const app = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar', { role: 'CUSTOMER', pathname: '/customer/profile', tab: 'SECURITY' });
    const links = app.nodes.filter(node => node.type === 'a');
    assert.ok(!links.some(node => node.props.to === '/customer/profile?tab=SECURITY'));
    assert.ok(!links.some(node => node.props.to === '/customer/verification'));
    assert.equal(app.nodes.filter(node => node.type === 'customer-account-navigation').length, 2);
  });

  test(`${prefix}customer personal information no longer embeds eKYC and keeps its account form`, () => {
    const info = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { role: 'CUSTOMER' });
    const verification = info.nodes.filter(node => node.props.embedded === true);
    assert.equal(verification.length, 0);
    assert.ok(info.nodes.some(node => node.type === 'input' && node.props.id === 'customer-profile-name'));
    assert.ok(!info.nodes.some(node => node.props['aria-label'] === 'Quản lý tài khoản'));
    for (const options of [{ role: 'CUSTOMER', tab: 'SECURITY' }, { role: 'CUSTOMER', tab: 'ORDERS' }, { role: 'STORE_OWNER' }, { role: 'SUPER_ADMIN' }]) {
      const app = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', options);
      assert.equal(app.nodes.filter(node => node.props.embedded === true).length, 0);
      if (options.tab === 'SECURITY') assert.equal(app.nodes.filter(node => node.type === 'input' && node.props.type === 'password').length, 3);
    }
  });

  test(`${prefix}embedded eKYC preserves its start action and uses a section with subordinate heading`, () => {
    const app = screen(prefix, 'components/customer/CustomerIdentityVerification.tsx', 'CustomerIdentityVerification', { role: 'CUSTOMER', props: { embedded: true } });
    assert.equal(app.nodes[0].type, 'section');
    assert.equal(app.nodes[0].props.id, 'customer-identity-verification');
    assert.ok(!app.nodes.some(node => node.type === 'main' || node.type === 'h1'));
    assert.ok(app.nodes.some(node => node.type === 'h2'));
    assert.match(app.text, /Bắt đầu xác minh/);
    assert.match(app.text, /Quy trình xác minh/);
  });

  test(`${prefix}existing eKYC route renders its dedicated account screen`, () => {
    const source = readFileSync(new URL(`${prefix}App.tsx`, import.meta.url), 'utf8');
    const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let expression;
    const visit = node => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Route' && node.attributes.properties.some(attr => attr.name?.getText(ast) === 'path' && attr.initializer?.text === '/customer/verification')) expression = node.attributes.properties.find(attr => attr.name?.getText(ast) === 'element').initializer.expression.getText(ast);
      ts.forEachChild(node, visit);
    };
    visit(ast); assert.ok(expression);
    const compiled = ts.transpileModule(`exports.route = (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, { exports, CustomerVerificationPage: 'verification-screen', require: () => ({ jsx: (type, props) => ({ type, props }) }) });
    assert.equal(exports.route.type, 'verification-screen');
  });

  test(`${prefix}store sidebar exposes one revenue entry and no duplicate operations`, () => {
    const app = screen(prefix, 'layouts/Sidebar.tsx', 'Sidebar');
    const links = app.nodes.filter(node => node.type === 'a').map(node => node.props.to);
    for (const removed of ['/store/device-templates', '/store/wallet', '/driver/shifts', '/store/profile?tab=SECURITY']) assert.ok(!links.includes(removed));
    for (const kept of ['/store/dashboard', '/store/devices', '/store/products', '/driver/deliveries']) assert.ok(links.includes(kept));
    assert.equal(app.nodes.filter(node => node.type === 'store-finance-navigation').length, 2);
    assert.equal(app.nodes.filter(node => node.type === 'store-revenue-navigation').length, 2);
  });

  test(`${prefix}profile keeps password changes and avoids duplicate store data requests`, () => {
    for (const role of ['STORE_OWNER', 'STORE_MANAGER']) {
      const app = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { role });
      app.runEffects();
      assert.deepEqual(app.requests, []);
      for (const removed of ['Thiết bị đã cấp phát', 'Đơn hàng từ nút bấm', 'Kho bãi & Điểm bán']) assert.ok(!app.text.includes(removed));
      app.nodes.find(node => node.type === 'button' && node.props.children?.some?.(child => JSON.stringify(child).includes('Bảo mật & Đổi mật khẩu')))?.props.onClick();
      assert.equal(app.search.get('tab'), 'SECURITY');
      app.render();
      assert.equal(app.nodes.filter(node => node.type === 'input' && node.props.type === 'password').length, 3);
    }
  });

  test(`${prefix}admin profiles omit personal devices and old device tabs return to information`, () => {
    for (const role of ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN']) {
      const app = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { role, tab: 'DEVICES' });
      app.runEffects();
      assert.ok(!app.text.includes('Nút bấm của tôi'));
      assert.equal(app.search.get('tab'), 'INFO');
      assert.ok(!app.requests.includes('/devices'));
      assert.ok(app.requests.includes('/orders'));
    }
  });

  test(`${prefix}old profile tabs resolve safely and customer tabs remain available`, () => {
    for (const [tab, target] of [['DEVICES', '/store/devices'], ['ORDERS', '/store/dashboard']]) {
      const app = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { tab });
      app.runEffects();
      assert.equal(app.navigation[0].to, target);
      assert.equal(app.navigation[0].options.replace, true);
    }
    const removed = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { tab: 'WAREHOUSE' });
    removed.runEffects();
    assert.equal(removed.search.get('tab'), 'INFO');
    const customer = screen(prefix, 'pages/profile/ProfilePage.tsx', 'ProfilePage', { role: 'CUSTOMER', tab: 'DEVICES' });
    customer.runEffects();
    assert.ok(customer.text.includes('Nút bấm của tôi'));
    assert.deepEqual(customer.requests, ['/devices', '/orders']);
  });

  test(`${prefix}sound and theme controls work beside notifications without opening account menu`, () => {
    const app = screen(prefix, 'layouts/Navbar.tsx', 'Navbar');
    const group = app.nodes.find(node => node.props?.['aria-label'] === 'Thông báo và giao diện');
    assert.ok(group);
    const sound = app.nodes.find(node => node.props?.['aria-label'] === 'Chuông đơn hàng');
    assert.equal(sound.props['aria-pressed'], true);
    sound.props.onClick();
    app.render();
    assert.equal(app.nodes.find(node => node.props?.['aria-label'] === 'Chuông đơn hàng').props['aria-pressed'], false);
    app.nodes.find(node => node.props?.['aria-label'] === 'Chuyển sang giao diện tối').props.onClick();
    app.render();
    assert.ok(app.nodes.some(node => node.props?.['aria-label'] === 'Chuyển sang giao diện sáng'));
    assert.ok(!app.nodes.some(node => node.props?.role === 'menu'));
  });

  test(`${prefix}revenue navigation follows the URL and opens only the selected panel`, () => {
    for (const tab of ['', 'WALLET', 'invalid']) {
      const app = screen(prefix, 'pages/store/StoreRevenuePage.tsx', 'StoreRevenuePage', { tab });
      assert.equal(app.nodes.some(node => node.type === 'nav'), false);
      const panels = app.nodes.filter(node => node.type?.load);
      assert.equal(panels.length, 1);
      assert.ok(String(panels[0].type.load).includes(tab === 'WALLET' ? 'StoreWalletPage' : 'StoreAnalyticsPage'));
      assert.deepEqual(app.requests, []);
    }
  });
}
