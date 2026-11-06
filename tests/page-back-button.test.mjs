import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/common/PageBackButton.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function render({ pathname = '/customer/orders', search = '', state = { idx: 0 }, fallbackTo } = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    URLSearchParams,
    window: { history: { state } },
    require: (name) => {
      if (name === 'react-router-dom') return {
        useLocation: () => ({ pathname, search }),
        useNavigate: () => (...args) => calls.push(args),
      };
      if (name === 'lucide-react') return { ArrowLeft: () => null };
      return require(name);
    },
  });
  return { button: exports.PageBackButton({ fallbackTo }), calls };
}

test('clicking back follows the existing router history exactly once', () => {
  const app = render({ state: { idx: 2 } });
  assert.equal(app.calls.length, 0, 'rendering must not navigate');
  app.button.props.onClick();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][0], -1);
});

test('directly opened customer pages use a replacement fallback', () => {
  for (const pathname of ['/shop', '/customer/orders', '/customer/rentals', '/customer/verification', '/customer/profile']) {
    const app = render({ pathname });
    app.button.props.onClick();
    assert.equal(app.calls[0][0], '/customer/home');
    assert.equal(app.calls[0][1].replace, true);
  }
});

test('home opened directly returns to shopping', () => {
  const app = render({ pathname: '/customer/home' });
  app.button.props.onClick();
  assert.equal(app.calls[0][0], '/shop');
});

test('a directly opened password tab returns to account information', () => {
  const app = render({ pathname: '/customer/profile', search: '?tab=SECURITY' });
  app.button.props.onClick();
  assert.equal(app.calls[0][0], '/customer/profile?tab=INFO');
});

test('missing or invalid history cannot navigate outside the tab', () => {
  for (const state of [null, {}, { idx: -1 }, { idx: '2' }]) {
    const app = render({ state });
    app.button.props.onClick();
    assert.equal(app.calls[0][0], '/customer/home');
  }
});

test('the control has a readable accessible name and cannot submit a form', () => {
  const { button } = render();
  assert.equal(button.type, 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], 'Quay lại trang trước');
});

test('direct store links return to the store dashboard instead of a customer route', () => {
  for (const pathname of ['/store/devices', '/store/rentals', '/store/device-templates', '/store/products', '/store/analytics', '/store/wallet', '/store/finance', '/store/profile']) {
    const app = render({ pathname });
    app.button.props.onClick();
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0][0], '/store/dashboard');
    assert.equal(app.calls[0][1].replace, true);
  }
});

test('direct admin links and dashboard sections return to the admin overview', () => {
  const routes = [['/admin/payouts', ''], ['/admin/profile', ''], ...['STORES', 'PLANS', 'RENTALS', 'CATALOG', 'DEVICES', 'RBAC', 'TELEMETRY', 'ANALYTICS', 'NOTIFICATIONS'].map(section => ['/admin/dashboard', `?section=${section}`])];
  for (const [pathname, search] of routes) {
    const app = render({ pathname, search });
    app.button.props.onClick();
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0][0], '/admin/dashboard');
    assert.equal(app.calls[0][1].replace, true);
  }
});

test('a directly opened dashboard returns to the public home without navigating to itself', () => {
  for (const pathname of ['/store/dashboard', '/admin/dashboard']) {
    const app = render({ pathname });
    app.button.props.onClick();
    assert.equal(app.calls[0][0], '/');
    assert.equal(app.calls[0][1].replace, true);
  }
});

test('store and admin password tabs return to information in their own profile', () => {
  for (const pathname of ['/store/profile', '/admin/profile']) {
    const app = render({ pathname, search: '?tab=SECURITY' });
    app.button.props.onClick();
    assert.equal(app.calls[0][0], `${pathname}?tab=INFO`);
    assert.equal(app.calls[0][1].replace, true);
  }
});

test('the universal profile uses the supplied role fallback and retains its password-tab path', () => {
  for (const fallbackTo of ['/store/dashboard', '/admin/dashboard']) {
    for (const search of ['', '?tab=SECURITY']) {
      const app = render({ pathname: '/profile', search, fallbackTo });
      app.button.props.onClick();
      assert.equal(app.calls[0][0], search ? '/profile?tab=INFO' : fallbackTo);
      assert.equal(app.calls[0][1].replace, true);
    }
  }
});

test('existing router history takes priority on all roles and does not call a fallback', () => {
  for (const pathname of ['/store/dashboard', '/store/profile', '/admin/dashboard', '/admin/profile', '/profile', '/customer/orders']) {
    const app = render({ pathname, search: '?tab=SECURITY', state: { idx: 3 }, fallbackTo: '/admin/dashboard' });
    assert.equal(app.calls.length, 0);
    app.button.props.onClick();
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0][0], -1);
    assert.equal(app.calls[0].length, 1);
  }
});

test('both frontend copies use the same back-button implementation', () => {
  assert.equal(source, readFileSync(new URL('../frontend/src/components/common/PageBackButton.tsx', import.meta.url), 'utf8'));
});

test('the actual shared and standalone layouts show one back control for the intended roles', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const layouts = {};
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (['AppShellLayout', 'StandaloneProfileBackNavigation'].includes(declaration.name.getText(ast))) layouts[declaration.name.getText(ast)] = declaration.initializer.getText(ast);
    }
  }
  const React = require('react');
  const BackControl = () => null;
  const countControls = node => {
    if (!React.isValidElement(node)) return 0;
    return (node.type === BackControl ? 1 : 0) + React.Children.toArray(node.props.children).reduce((sum, child) => sum + countControls(child), 0);
  };
  for (const role of ['CUSTOMER', 'STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'STAFF_DELIVERY', undefined]) {
    const context = {
      require, exports: {}, useAuth: () => ({ user: role ? { role } : null }),
      Sidebar: 'sidebar', PageBackButton: BackControl, Suspense: React.Suspense,
      RouteLoadingFallback: 'loading', CustomerPageMotion: 'customer-motion', Outlet: 'outlet',
    };
    const evaluate = callback => vm.runInNewContext(ts.transpileModule(`(${callback})`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { ...context });
    const managedRole = ['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(role);
    assert.equal(countControls(evaluate(layouts.AppShellLayout)({})), managedRole || role === 'CUSTOMER' ? 1 : 0);
    assert.equal(countControls(evaluate(layouts.StandaloneProfileBackNavigation)()), managedRole ? 1 : 0);
  }
});
