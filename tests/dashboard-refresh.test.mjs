import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');

function target() {
  const handlers = new Map();
  return {
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
    emit(name) { for (const fn of handlers.get(name) || []) fn(); },
    count(name) { return handlers.get(name)?.size || 0; },
  };
}
for (const prefix of ['../src/', '../frontend/src/']) {
  const source = readFileSync(new URL(`${prefix}hooks/useDashboardRefresh.ts`, import.meta.url), 'utf8');
  function harness(refresh, pollOnly = false) {
    let now = 100000, cooldown = 0, next = 1, cleanup;
    const timers = new Map(), win = target(), doc = { ...target(), visibilityState: 'visible' }, socket = target();
    socket.on = socket.addEventListener; socket.off = socket.removeEventListener;
    const timer = (fn, delay, interval = 0) => { const id = next++; timers.set(id, { fn, due: now + delay, interval }); return id; };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, {
      exports, require: name => name === 'react' ? { useRef: current => ({ current }), useEffect: fn => { cleanup = fn(); } } : name.endsWith('/socket') ? { getSocket: () => socket } : name.endsWith('/order-events') ? { ORDER_EVENT: 'order:updated' } : { getApiRetryUntil: () => cooldown },
      window: win, document: doc, Date: { now: () => now },
      setTimeout: (fn, ms) => timer(fn, ms), clearTimeout: id => timers.delete(id),
      setInterval: (fn, ms) => timer(fn, ms, ms), clearInterval: id => timers.delete(id),
    });
    exports.useDashboardRefresh(refresh, 'store:1', pollOnly);
    async function tick(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!due) break;
        const [id, t] = due; now = t.due;
        if (t.interval) t.due += t.interval; else timers.delete(id);
        void t.fn(); await Promise.resolve(); await Promise.resolve();
      }
      now = end; await Promise.resolve();
    }
    return { socket, win, doc, tick, timers, cleanup: () => cleanup(), cooldown: value => { cooldown = value; } };
  }
  test(`${prefix}socket/catalog bursts coalesce and unmount removes every listener and timer`, async () => {
    let calls = 0; const app = harness(async () => { calls++; });
    for (let i = 0; i < 20; i++) { app.socket.emit('ORDER_CREATED'); app.win.emit('catalog:changed'); }
    await app.tick(249); assert.equal(calls, 0); await app.tick(1); assert.equal(calls, 1);
    app.socket.emit('ORDER_CREATED'); app.cleanup(); await app.tick(60000);
    assert.equal(calls, 1); assert.equal(app.timers.size, 0); assert.equal(app.socket.count('ORDER_CREATED'), 0);
    assert.equal(app.win.count('catalog:changed'), 0); assert.equal(app.doc.count('visibilitychange'), 0);
  });
  test(`${prefix}hidden pages and server cooldown suppress automatic requests and resume later`, async () => {
    let calls = 0; const app = harness(async () => { calls++; });
    app.doc.visibilityState = 'hidden'; app.socket.emit('ORDER_CREATED'); await app.tick(30000); assert.equal(calls, 0);
    app.doc.visibilityState = 'visible'; app.cooldown(999999); app.win.emit('focus'); await app.tick(30000); assert.equal(calls, 0);
    app.cooldown(0); app.doc.emit('visibilitychange'); await app.tick(250); assert.equal(calls, 1); app.cleanup();
  });
  test(`${prefix}events arriving during a fetch queue only one later read without overlapping`, async () => {
    let resolve, calls = 0, active = 0, maxActive = 0;
    const app = harness(async () => { calls++; active++; maxActive = Math.max(maxActive, active); if (calls === 1) await new Promise(done => { resolve = done; }); active--; });
    app.socket.emit('ORDER_CREATED'); await app.tick(250);
    for (let i = 0; i < 15; i++) app.socket.emit('ORDER_STATUS_CHANGED');
    await app.tick(4000); assert.equal(calls, 1); resolve(); await new Promise(done => setImmediate(done));
    await app.tick(250); assert.equal(calls, 2); assert.equal(maxActive, 1); app.cleanup();
  });
  test(`${prefix}pages with existing event handlers only receive a recovery poll`, async () => {
    let calls = 0; const app = harness(async () => { calls++; }, true);
    app.socket.emit('ORDER_CREATED'); app.win.emit('focus'); await app.tick(1000); assert.equal(calls, 0);
    await app.tick(29250); assert.equal(calls, 1); app.cleanup();
  });
}
