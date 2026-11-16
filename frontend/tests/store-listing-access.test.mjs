import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import * as finance from '../src/services/store-finance-flow.ts';
import * as plans from '../src/services/store-service-plans.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/hooks/useStoreListingAccess.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const owner = { id: '701', role: 'STORE_OWNER', storeId: '71' };
const ok = (data) => ({ data: { success: true, data } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

function harness({ user = owner, get } = {}) {
  const slots = [], calls = [], intervals = new Map(), listeners = new Map();
  let cursor = 0, dirty = true, effects = [], value, mounted = true, cooldown = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (update) => {
        if (!mounted) return;
        const next = typeof update === 'function' ? update(slots[index].value) : update;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((dep, n) => !Object.is(dep, previous.deps[n]))) {
        slots[index] = { deps, cleanup: previous?.cleanup, fn, effect: true };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const transport = { get: async (path, config) => {
    calls.push({ path, config });
    if (get) return get(path, config);
    if (path === '/store/subscriptions/current') return ok(null);
    return { ...ok([]), data: { ...ok([]).data, pagination: { totalItems: 11 } } };
  } };
  const exports = {};
  const surface = (prefix) => ({
    addEventListener: (name, fn) => listeners.set(`${prefix}:${name}`, fn),
    removeEventListener: (name) => listeners.delete(`${prefix}:${name}`),
  });
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return hooks;
      if (name.endsWith('/api')) return { api: transport };
      if (name.endsWith('/store-finance-flow')) return finance;
      if (name.endsWith('/store-service-plans')) return plans;
      if (name.endsWith('/request-backoff')) return { getApiRetryUntil: () => cooldown };
      throw Error(`Unexpected import: ${name}`);
    },
    window: {
      ...surface('window'),
      setInterval(fn) { const id = intervals.size + 1; intervals.set(id, fn); return id; },
      clearInterval: (id) => intervals.delete(id),
    },
    document: { ...surface('document'), visibilityState: 'visible' },
  });
  const render = () => {
    cursor = 0; dirty = false; effects = [];
    value = exports.useStoreListingAccess(user);
    effects.forEach((run) => run());
  };
  render();
  return {
    calls, get value() { return value; },
    rerender(next = user) { user = next; render(); },
    focus() { listeners.get('window:focus')?.(); },
    poll() { [...intervals.values()].forEach((run) => run()); },
    setCooldown(value) { cooldown = value; },
    replayEffects() { slots.filter((slot) => slot.effect).forEach((slot) => { slot.cleanup?.(); slot.cleanup = slot.fn(); }); },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); mounted = false; },
    async flush() {
      for (let index = 0; index < 20; index++) {
        if (dirty) render();
        await new Promise((resolve) => setImmediate(resolve));
        if (!dirty) return;
      }
      assert.fail('The listing hook keeps scheduling render/request cycles');
    },
  };
}

test('Recreating the same account object does not restart subscription checks', async () => {
  const app = harness();
  await app.flush();
  assert.equal(app.value.allowed, true);
  const calls = app.calls.length, refresh = app.value.refresh;
  app.rerender({ ...owner, fullName: 'Updated display name' });
  await app.flush();
  assert.equal(app.calls.length, calls);
  assert.equal(app.value.refresh, refresh);
  app.unmount();
});

test('Focus, polling and a manual retry share the pending initial check', async () => {
  const gate = deferred();
  const app = harness({ get: (path) => path === '/store/subscriptions/current' ? gate.promise : { data: { success: true, data: [], pagination: { totalItems: 11 } } } });
  app.focus(); app.poll(); const manual = app.value.refresh();
  assert.equal(app.calls.filter(({ path }) => path === '/store/subscriptions/current').length, 1);
  gate.resolve(ok(null));
  await manual; await app.flush();
  assert.equal(app.value.checking, false);
  assert.equal(app.value.allowed, true);
  app.unmount();
});

test('A background check preserves the resolved permission without showing the loading banner again', async () => {
  let gate;
  const app = harness({ get: (path) => path === '/store/subscriptions/current' ? gate?.promise || ok(null) : { data: { success: true, data: [], pagination: { totalItems: 11 } } } });
  await app.flush();
  gate = deferred();
  app.poll(); await app.flush();
  assert.equal(app.value.checking, false);
  assert.equal(app.value.allowed, true);
  app.focus(); app.poll();
  assert.equal(app.calls.filter(({ path }) => path === '/store/subscriptions/current').length, 2);
  gate.resolve(ok(null)); await app.flush();
  app.unmount();
});

test('A failed request exits loading, exposes the error, and allows a deliberate retry', async () => {
  let fail = true;
  const app = harness({ get: (path) => {
    if (path === '/store/subscriptions/current') {
      if (fail) throw Error('Test subscription API failure');
      return ok(null);
    }
    return { data: { success: true, data: [], pagination: { totalItems: 11 } } };
  } });
  await app.flush();
  assert.equal(app.value.checking, false);
  assert.equal(app.value.allowed, false);
  assert.equal(app.value.error, 'Test subscription API failure');
  fail = false; await app.value.refresh(); await app.flush();
  assert.equal(app.value.allowed, true);
  assert.equal(app.value.error, '');
  app.unmount();
});

test('A late result from the previous store cannot replace the current store state', async () => {
  const old = deferred(); let requests = 0;
  const app = harness({ get: (path) => {
    if (path === '/store/subscriptions/current') return ++requests === 1 ? old.promise : ok(null);
    return { data: { success: true, data: [], pagination: { totalItems: 2 } } };
  } });
  app.rerender({ id: '702', role: 'STORE_OWNER', storeId: '500' });
  await app.flush();
  assert.equal(app.value.allowed, false);
  assert.equal(app.value.isGrandfathered, false);
  old.resolve(ok(null)); await app.flush();
  assert.equal(app.value.scope, '702:500');
  assert.equal(app.value.allowed, false);
  app.unmount();
});

test('Effect cleanup and replay cannot leave loading stuck on an invalidated request', async () => {
  const old = deferred(); let requests = 0;
  const app = harness({ get: (path) => {
    if (path === '/store/subscriptions/current') return ++requests === 1 ? old.promise : ok(null);
    return { data: { success: true, data: [], pagination: { totalItems: 2 } } };
  } });
  app.replayEffects(); await app.flush();
  assert.equal(app.value.checking, false);
  assert.equal(app.value.allowed, true);
  old.resolve(ok(null)); await app.flush();
  app.unmount();
});

test('Automatic checks respect the existing API cooldown', async () => {
  const app = harness(); await app.flush();
  const calls = app.calls.length;
  app.setCooldown(Date.now() + 30000); app.focus(); app.poll(); await app.flush();
  assert.equal(app.calls.length, calls);
  app.unmount();
});

// Render the real subscription section, including the states shown in the reported screenshot.
const page = readFileSync(new URL('../src/pages/store/StoreProductsPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('StoreProductsPage.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let banner;
const visit = (node) => {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'section'
    && node.openingElement.attributes.properties.some((attr) => attr.name?.getText(ast) === 'aria-label' && attr.initializer?.text === 'Điều kiện đăng sản phẩm')) banner = node.getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(banner, 'Render the actual product-listing permission banner');
const renderModule = {};
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(ts.transpileModule(`export const render = (listingAccess: any, user: any) => (${banner});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: renderModule, Link: 'a',
  require: () => ({ jsx, jsxs: jsx }),
});
const text = (node) => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(text).join(' ');

test('The initial banner shows a pending check without claiming exemption or asking for registration', () => {
  const rendered = text(renderModule.render({ checking: true, error: '', isGrandfathered: true, allowed: false }, owner));
  assert.match(rendered, /Đang kiểm tra gói dịch vụ/);
  assert.match(rendered, /Quyền đăng sản phẩm: Chưa xác nhận/);
  assert.doesNotMatch(rendered, /Không giới hạn|Miễn trừ gói dịch vụ|Đăng ký gói dịch vụ ngay/);
});

test('The banner exposes a subscription API error and still shows the exemption after a successful retry', () => {
  const failed = text(renderModule.render({ checking: false, error: 'Test subscription API failure', isGrandfathered: true, allowed: false }, owner));
  assert.match(failed, /Test subscription API failure/);
  assert.doesNotMatch(failed, /Đang kiểm tra gói dịch vụ|Không giới hạn/);
  const resolved = text(renderModule.render({ checking: false, error: '', isGrandfathered: true, allowed: true }, owner));
  assert.match(resolved, /Miễn trừ gói dịch vụ/);
  assert.match(resolved, /Quyền đăng sản phẩm: Không giới hạn/);
  assert.match(resolved, /Quản lý gói dịch vụ/);
});
