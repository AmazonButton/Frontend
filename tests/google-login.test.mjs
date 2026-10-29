import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { getGoogleLoginError, getGooglePopupError } from '../src/services/google-auth-errors.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/auth/AuthPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('AuthPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = {};
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && ['handleGoogleSuccess', 'handleGoogleClick'].includes(node.name.getText(ast))) callbacks[node.name.getText(ast)] = node.initializer.getText(ast);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useGoogleLogin') {
    for (const property of node.arguments[0].properties) if (property.name?.getText(ast) === 'onNonOAuthError') callbacks.popupError = property.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
};
visit(ast);
const evaluate = (callback, context) => vm.runInNewContext(ts.transpileModule(`(() => { const callback = ${callback}; return callback; })();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);

function harness({ backendError, scriptReady = true, popupThrows = false } = {}) {
  const state = { loading: false, error: null, logins: [], navigations: [], requests: [], popupCalls: 0 };
  const context = {
    mode: 'login', role: 'CUSTOMER', phone: '', address: '', storeName: '', scriptLoadedSuccessfully: scriptReady,
    getGoogleLoginError, getGooglePopupError,
    setGoogleLoading: (value) => { state.loading = value; }, setGoogleError: (value) => { state.error = value; },
    axios: { get: async () => ({ data: { email: 'test@example.com', name: 'Test Recipient' } }) },
    api: { post: async (path, payload) => {
      state.requests.push({ path, payload });
      if (backendError) throw backendError;
      return { data: { success: true, data: { accessToken: 'test-app-session', refreshToken: 'test-refresh-session', user: { id: '1', role: 'CUSTOMER' } } } };
    } },
    login: (...args) => state.logins.push(args), navigate: (path) => state.navigations.push(path), toast: { success() {}, error() {}, warning() {} },
    loginWithGoogle: () => { state.popupCalls++; if (popupThrows) throw new Error('Test popup launch failed'); },
  };
  return { state, context, success: evaluate(callbacks.handleGoogleSuccess, context), popupError: evaluate(callbacks.popupError, context), click: evaluate(callbacks.handleGoogleClick.replace('import.meta.env.VITE_GOOGLE_CLIENT_ID', "'test-client.apps.googleusercontent.com'"), context) };
}

test('A Google access token uses the existing authenticated API contract and stores only the returned app session', async () => {
  const app = harness();
  await app.success({ access_token: 'test-google-access-token' });
  assert.equal(app.state.requests[0].path, '/auth/google-login');
  assert.equal(app.state.requests[0].payload.token, 'test-google-access-token');
  assert.equal(app.state.requests[0].payload.email, undefined);
  assert.equal(app.state.logins[0][0], 'test-app-session');
  assert.equal(app.state.navigations[0], '/customer/home');
  assert.equal(app.state.loading, false);
});

test('API 401 preserves the actual error and never signs in or retries with unverified identity fields', async () => {
  const app = harness({ backendError: { response: { status: 401, data: { message: 'Google token verification failed' } } } });
  await app.success({ access_token: 'test-google-access-token' });
  assert.equal(app.state.error, 'Google token verification failed');
  assert.equal(app.state.requests.length, 1);
  assert.equal(app.state.logins.length, 0);
  assert.equal(app.state.navigations.length, 0);
  assert.equal(app.state.loading, false);
});

test('Missing Google access token is rejected before any application login request', async () => {
  const app = harness();
  await app.success({});
  assert.equal(app.state.requests.length, 0);
  assert.equal(app.state.logins.length, 0);
  assert.equal(app.state.loading, false);
});

test('Closing or blocking the popup ends loading so the user can retry', () => {
  for (const type of ['popup_closed', 'popup_failed_to_open']) {
    const app = harness();
    app.state.loading = true;
    app.popupError({ type });
    assert.equal(app.state.loading, false);
    assert.ok(app.state.error);
    assert.equal(app.state.requests.length, 0);
  }
});

test('An unloaded Google script does not leave the button spinning', () => {
  const app = harness({ scriptReady: false });
  app.click();
  assert.equal(app.state.popupCalls, 0);
  assert.equal(app.state.loading, false);
  assert.ok(app.state.error);
});

test('A synchronous popup error is displayed and clears loading', () => {
  const app = harness({ popupThrows: true });
  app.click();
  assert.equal(app.state.popupCalls, 1);
  assert.equal(app.state.loading, false);
  assert.equal(app.state.error, 'Test popup launch failed');
});

test('401 without an API message never invents a password-only backend limitation', () => {
  const message = getGoogleLoginError({ response: { status: 401, data: {} } });
  assert.ok(message.includes('401'));
  assert.ok(!message.includes('Mật khẩu'));
});

test('Validation errors and denied Google consent remain readable', () => {
  assert.equal(getGoogleLoginError({ response: { data: { message: ['First error', 'Second error'] } } }), 'First error; Second error');
  assert.ok(getGooglePopupError({ error: 'access_denied' }).includes('chưa cấp quyền'));
});
