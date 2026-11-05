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

function render({ pathname = '/customer/orders', search = '', state = { idx: 0 } } = {}) {
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
  return { button: exports.PageBackButton(), calls };
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
