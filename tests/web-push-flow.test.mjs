import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compile = file => ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').replaceAll('import.meta.env', 'testEnv'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const stateCode = compile('services/web-push-state.ts');
const pushCode = compile('services/firebase-push.ts');
const settingsCode = compile('components/operations/PushNotificationSettings.tsx');
const workerCode = compile('services/firebase-messaging-worker.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

function environment(options = {}) {
  const entries = new Map([['smart_order_user', JSON.stringify({ id: 'A' })], ['smart_order_token', 'jwt-A'], ['smart_order_push_session', 'session-A']]);
  const localStorage = { get length() { return entries.size; }, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key), key: index => [...entries.keys()][index] || null };
  const window = new EventTarget(); Object.assign(window, { location: { origin: 'https://example.test' }, isSecureContext: true, Notification: {}, setTimeout, clearTimeout });
  const requests = [], messages = [], sdkCalls = [], native = [];
  const registration = { active: { scriptURL: 'https://example.test/assets/firebase-messaging-worker-test.js', postMessage: message => messages.push(message) }, pushManager: { getSubscription: async () => ({ unsubscribe: async () => { native.push('unsubscribe'); return true; } }) }, getNotifications: async () => [{ close: () => native.push('close') }], unregister: async () => { native.push('unregister'); return true; } };
  const navigator = { serviceWorker: { register: async (url, config) => { sdkCalls.push({ method: 'register-worker', url, config }); return registration; }, getRegistrations: async () => [registration] } };
  const globals = { window, localStorage, navigator, Event, AbortController, URL, crypto: { randomUUID: () => `session-${Math.random()}` }, setTimeout, clearTimeout, Notification: { permission: 'granted' }, testEnv: { DEV: options.dev ?? false, VITE_FIREBASE_VAPID_KEY: 'test-vapid' } };
  function evaluate(code, imports) {
    const module = { exports: {} };
    vm.runInNewContext(code, { ...globals, module, exports: module.exports, require: name => {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    } });
    return module.exports;
  }
  const state = evaluate(stateCode, {});
  const axios = { create: config => ({ defaults: { baseURL: config.baseURL, headers: config.headers },
    post: async (path, body) => {
      if (config.signal?.aborted) throw new Error('Request aborted');
      requests.push({ method: 'POST', path, body, config });
      return options.post ? options.post({ path, body, config }) : { data: { success: true } };
    },
    delete: async (path, configOverride) => {
      if (config.signal?.aborted) throw new Error('Request aborted');
      requests.push({ method: 'DELETE', path, body: configOverride.data, config });
      return options.remove ? options.remove({ path, config }) : { data: { success: true } };
    },
  }) };
  const push = evaluate(pushCode, {
    axios: { default: axios }, './api': { api: { defaults: { baseURL: 'https://api.example.test/api/v1' } }, getOrRefreshValidToken: async () => localStorage.getItem('smart_order_token') },
    './firebase-web': { firebaseWebConfig: { projectId: 'test-project' }, getWebFirebaseApp: () => ({}), pushConfigured: true },
    './firebase-messaging-worker?worker&url': { default: '/assets/firebase-messaging-worker-test.js' },
    './web-push-state': state,
    'firebase/messaging': { isSupported: async () => true, getMessaging: () => ({}), getToken: async () => { sdkCalls.push({ method: 'get-token' }); return options.token ? options.token() : 'token-A'; } },
  });
  return { state, push, localStorage, entries, requests, messages, sdkCalls, native, navigator, window, registration, globals, evaluate };
}

test('registration sends only backend DTO fields and uses a captured JWT without global interceptors', async () => {
  const app = environment();
  await app.push.enableFirebasePush('A');
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].path, '/notifications/fcm-token');
  assert.deepEqual(JSON.parse(JSON.stringify(app.requests[0].body)), { token: 'token-A', deviceType: 'WEB' });
  assert.equal(app.requests[0].config.headers.Authorization, 'Bearer jwt-A');
  assert.equal(app.requests[0].config.baseURL, 'https://api.example.test/api/v1');
  assert.equal(app.state.readPushToken('A'), 'token-A');
  assert.equal(app.state.readPushOwner(), 'A');
});

test('service worker uses module type in Vite dev and classic for production IIFE output', async () => {
  for (const [dev, type] of [[true, 'module'], [false, 'classic']]) {
    const app = environment({ dev }); await app.push.enableFirebasePush('A');
    assert.equal(app.sdkCalls.find(call => call.method === 'register-worker').config.type, type);
  }
});

test('switching account while Firebase getToken waits stops the old registration before POST', async () => {
  const token = deferred();
  const app = environment({ token: () => token.promise });
  const result = app.push.enableFirebasePush('A');
  await flush();
  app.state.invalidatePushSession(); app.localStorage.setItem('smart_order_user', JSON.stringify({ id: 'B' })); app.localStorage.setItem('smart_order_token', 'jwt-B');
  token.resolve('token-A');
  await assert.rejects(result, /thay đổi/);
  assert.equal(app.requests.length, 0);
  assert.equal(app.state.readPushToken('A'), '');
  assert.equal(app.state.readPushToken('B'), '');
});

test('a stale successful POST is compensated with A credentials and never saved under B', async () => {
  const response = deferred();
  const app = environment({ post: () => response.promise });
  const result = app.push.enableFirebasePush('A'); await flush();
  assert.equal(app.requests[0].config.headers.Authorization, 'Bearer jwt-A');
  app.state.invalidatePushSession(); app.localStorage.setItem('smart_order_user', JSON.stringify({ id: 'B' })); app.localStorage.setItem('smart_order_token', 'jwt-B');
  response.resolve({ data: { success: true } });
  await assert.rejects(result, /thay đổi/);
  const compensation = app.requests.find(request => request.method === 'DELETE');
  assert.ok(compensation);
  assert.equal(compensation.config.headers.Authorization, 'Bearer jwt-A');
  assert.equal(app.state.readPushToken('B'), '');
});

test('same-user re-login invalidates a pending operation using a session marker', () => {
  const app = environment(); const captured = app.state.capturePushSession('A'); const watch = app.state.observePushSession(captured);
  app.state.invalidatePushSession();
  assert.equal(watch.signal.aborted, true);
  assert.equal(app.state.isPushSessionCurrent(captured), false);
  watch.dispose();
});

test('first capture initializes a marker without cancelling its own UI operation', () => {
  const app = environment(); app.localStorage.removeItem('smart_order_push_session'); let events = 0;
  app.window.addEventListener(app.state.PUSH_SESSION_EVENT, () => events++);
  const session = app.state.capturePushSession('A');
  assert.equal(app.state.isPushSessionCurrent(session), true); assert.equal(events, 0);
});

test('one browser subscription has one owner and a later owner never inherits the previous badge', () => {
  const app = environment(); app.state.savePushToken('A', 'shared-token'); app.state.savePushToken('B', 'shared-token');
  assert.equal(app.state.readPushToken('A'), ''); assert.equal(app.state.readPushToken('B'), 'shared-token');
  app.state.clearPushToken('A');
  assert.equal(app.state.readPushToken('B'), 'shared-token');
});

test('a failed disable keeps the saved registration and does not claim local success', async () => {
  const app = environment({ remove: () => { throw new Error('offline'); } }); app.state.savePushToken('A', 'token-A');
  await assert.rejects(app.push.disableFirebasePush('A'), /offline/);
  assert.equal(app.state.readPushToken('A'), 'token-A'); assert.equal(app.native.length, 0);
});

test('successful disable unregisters backend before removing browser registration', async () => {
  const app = environment(); app.state.savePushToken('A', 'token-A');
  await app.push.disableFirebasePush('A');
  assert.equal(app.requests[0].method, 'DELETE'); assert.equal(app.requests[0].body.token, 'token-A');
  assert.equal(app.state.readPushToken('A'), '');
  assert.ok(app.native.includes('unsubscribe')); assert.ok(app.native.includes('unregister')); assert.ok(app.native.includes('close'));
  assert.equal(app.messages[0].type, 'SMART_ORDER_PUSH_DISABLE');
});

test('browser cleanup failure does not turn a confirmed backend unsubscribe into a false failure', async () => {
  const app = environment(); app.state.savePushToken('A', 'token-A'); app.navigator.serviceWorker.getRegistrations = async () => { throw new Error('Browser cleanup unavailable'); };
  await app.push.disableFirebasePush('A');
  assert.equal(app.state.readPushToken('A'), '');
  assert.equal(app.requests[0].method, 'DELETE');
});

test('late logout cleanup never removes a new account registration', async () => {
  const app = environment(); app.state.savePushToken('B', 'token-B');
  await app.push.cleanupFirebasePushAfterLogout('A');
  assert.equal(app.native.length, 0); assert.equal(app.state.readPushToken('B'), 'token-B');
});

test('local cleanup is bounded when service worker enumeration never returns', async () => {
  const app = environment(); app.navigator.serviceWorker.getRegistrations = () => new Promise(() => undefined);
  const started = Date.now();
  await app.push.cleanupFirebasePushAfterLogout('A');
  assert.ok(Date.now() - started < 2500);
});

test('push changes are serialized, including after an earlier operation rejects', async () => {
  const app = environment(); const pause = deferred(); const order = [];
  const first = app.state.serializePushChange(async () => { order.push('first'); await pause.promise; throw new Error('rejected'); });
  const second = app.state.serializePushChange(async () => { order.push('second'); return 2; });
  await flush(); assert.deepEqual(order, ['first']); pause.resolve();
  await assert.rejects(first); assert.equal(await second, 2); assert.deepEqual(order, ['first', 'second']);
});

test('cross-tab storage changes abort a pending request but normal token refresh does not', () => {
  const app = environment(); const session = app.state.capturePushSession('A'); const watch = app.state.observePushSession(session);
  app.localStorage.setItem('smart_order_token', 'refreshed-jwt-A'); app.window.dispatchEvent(new Event('storage'));
  assert.equal(watch.signal.aborted, false);
  app.localStorage.setItem('smart_order_user', JSON.stringify({ id: 'B' })); app.window.dispatchEvent(new Event('storage'));
  assert.equal(watch.signal.aborted, true); watch.dispose();
});

function workerHarness() {
  const events = new Map(); const order = []; let background;
  const notifications = [];
  const scope = { location: { href: 'https://example.test/assets/firebase-messaging-worker-test.js?config=%7B%22projectId%22%3A%22test%22%7D', origin: 'https://example.test' }, addEventListener: (type, callback) => { events.set(type, callback); order.push(type); }, registration: { showNotification: async (title, options) => notifications.push({ title, options }) }, clients: { matchAll: async () => [], openWindow: async path => path } };
  const module = { exports: {} };
  vm.runInNewContext(workerCode, { module, exports: module.exports, self: scope, URL, require: name => name === 'firebase/app' ? { initializeApp: config => config } : { getMessaging: () => { order.push('sdk-messaging'); return {}; }, onBackgroundMessage: (_, callback) => { background = callback; } } });
  return { events, order, notifications, background };
}

test('custom notification click handler is installed before Firebase and data-only payload shows once', async () => {
  const worker = workerHarness();
  assert.ok(worker.order.indexOf('notificationclick') < worker.order.indexOf('sdk-messaging'));
  await worker.background({ notification: { title: 'SDK already displays this' } }); assert.equal(worker.notifications.length, 0);
  await worker.background({ data: { title: 'Data notification', body: 'Test' }, messageId: '1' });
  assert.equal(worker.notifications.length, 1); assert.equal(worker.notifications[0].options.data.smartOrder, true);
});

test('worker logout guard stops automatic push and custom handler before local unregister completes', async () => {
  const worker = workerHarness(); worker.events.get('message')({ data: { type: 'SMART_ORDER_PUSH_DISABLE' } });
  let stopped = false; worker.events.get('push')({ stopImmediatePropagation: () => { stopped = true; } });
  await worker.background({ data: { title: 'Do not display after logout' } });
  assert.equal(stopped, true); assert.equal(worker.notifications.length, 0);
});

test('notification clicks handle only this app notifications and open a safe same-origin route', async () => {
  const worker = workerHarness(); let work; let stopped = false; let closed = false;
  worker.events.get('notificationclick')({ notification: { data: { smartOrder: true }, close: () => { closed = true; } }, stopImmediatePropagation: () => { stopped = true; }, waitUntil: promise => { work = promise; } });
  assert.equal(await work, '/profile?tab=NOTIFICATIONS'); assert.equal(stopped, true); assert.equal(closed, true);
  stopped = false;
  worker.events.get('notificationclick')({ notification: { data: { otherApp: true } }, stopImmediatePropagation: () => { stopped = true; } });
  assert.equal(stopped, false);
});

test('unmounted settings ignore a later permission result and never register another account', async () => {
  const app = environment(); const permission = deferred(); const states = [], effects = [], sdkCalls = [];
  const react = { useState: initial => [initial, value => states.push(value)], useRef: initial => ({ current: initial }), useEffect: callback => effects.push(callback) };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(settingsCode, { ...app.globals, testEnv: Object.fromEntries(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_VAPID_KEY'].map(name => [name, 'configured'])), Notification: { permission: 'default', requestPermission: () => permission.promise }, module, exports: module.exports, require: name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { BellRing: 'icon', Loader2: 'icon' };
    if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { id: 'A' } }) };
    if (name.endsWith('/web-push-state')) return app.state;
    if (name === './WorkflowUI') return { WorkflowReveal: 'div', WorkflowNotice: 'div' };
    if (name.endsWith('/workflow')) return { workflowError: error => error.message };
    if (name.endsWith('/firebase-push')) return { enableFirebasePush: async () => sdkCalls.push('enable') };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const tree = module.exports.PushNotificationSettings(); const cleanups = effects.map(effect => effect());
  function findButton(node) { if (!node || typeof node !== 'object') return; if (node.type === 'button' && node.props.onClick) return node; for (const child of [node.props?.children].flat(Infinity)) { const button = findButton(child); if (button) return button; } }
  findButton(tree).props.onClick();
  cleanups.forEach(cleanup => cleanup?.()); const stateCount = states.length;
  permission.resolve('granted'); await flush(); await flush();
  assert.equal(states.length, stateCount); assert.equal(sdkCalls.length, 0);
});

test('logout clears the session immediately and unregisters with captured current credentials', async () => {
  const app = environment(); app.state.savePushToken('A', 'token-A');
  const unregister = deferred(); const requests = [], cleanups = [];
  const source = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('AuthContext.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'logout') callback = node.initializer.arguments[0].getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(callback);
  const js = ts.transpileModule(`const handler = ${callback}; handler;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const logout = vm.runInNewContext(js, {
    ...app.globals, ...app.state, cleanupBrowserPushAfterLogout: async id => cleanups.push(id), token: 'stale-jwt', refreshToken: 'stale-refresh', user: { id: 'stale-user' },
    api: { defaults: { baseURL: 'https://api.example.test/api/v1', headers: { common: { Authorization: 'Bearer jwt-A' } } }, post: async (path, body, options) => requests.push({ path, body, options }) },
    axios: { delete: (path, options) => { requests.push({ path, options }); return unregister.promise; } },
    setToken: () => undefined, setRefreshToken: () => undefined, setUser: () => undefined, setIsLoading: () => undefined,
    clearSocketSubscriptions: () => undefined, updateSocketAuth: () => undefined, isTokenExpired: () => false,
    require: name => { if (name === '../services/firebase-push') return { cleanupFirebasePushAfterLogout: async id => cleanups.push(id) }; throw new Error(`Unexpected ${name}`); },
  });
  logout();
  assert.equal(app.localStorage.getItem('smart_order_token'), null);
  assert.equal(app.localStorage.getItem('smart_order_user'), null);
  assert.equal(app.state.readPushToken('A'), '');
  assert.equal(requests.find(request => request.path === '/notifications/fcm-token').options.headers.Authorization, 'Bearer jwt-A');
  assert.equal(requests.find(request => request.path === '/auth/logout').options.headers.Authorization, 'Bearer jwt-A');
  app.state.savePushToken('B', 'token-B'); unregister.resolve({ data: { success: true } }); await flush();
  assert.equal(app.state.readPushToken('B'), 'token-B'); assert.deepEqual(cleanups, ['A']);
});
