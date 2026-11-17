import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/hooks/useProductDiscounts.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };

function harness(list = async () => []) {
  const calls = [];
  const states = [];
  const effects = [];
  const intervals = new Map();
  const cleanups = [];
  let cooldown = 0;
  function events() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(name, listener) { listeners.set(name, listener); },
      removeEventListener(name) { listeners.delete(name); },
      emit(name, value) { listeners.get(name)?.(value); },
    };
  }
  const window = {
    ...events(),
    setInterval(callback, delay) { intervals.set(delay, callback); return delay; },
    clearInterval(id) { intervals.delete(id); },
  };
  const document = { ...events(), visibilityState: 'visible' };
  const socketEvents = events();
  const socket = { on: socketEvents.addEventListener, off: socketEvents.removeEventListener };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, window, document,
    require(name) {
      if (name === 'react') return {
        useState(initial) {
          const index = states.length;
          states.push(initial);
          return [initial, value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        },
        useEffect(effect) { effects.push(effect); },
      };
      if (name === '../services/product-discounts') return {
        productDiscounts: { list(id) { calls.push(id); return list(id); } },
      };
      if (name === '../services/socket') return { getSocket: () => socket };
      if (name === '../services/request-backoff') return { getApiRetryUntil: () => cooldown };
      assert.fail(name);
    },
  });
  exports.useProductDiscounts(['1', '1']);
  for (const effect of effects) cleanups.push(effect());
  return {
    calls, states, window, document, socketEvents, intervals,
    pause(value) { cooldown = value; },
    dispose() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

test('loads unique products and refreshes automatically every 15 seconds', async () => {
  const h = harness();
  await flush();
  assert.deepEqual(h.calls, ['1']);
  h.intervals.get(15000)();
  await flush();
  assert.equal(h.calls.length, 2);
  h.dispose();
});

test('save, cross-tab storage, socket events, mobile touch and returning to the page refresh prices', async () => {
  const h = harness();
  await flush();
  h.window.emit('catalog:changed'); await flush();
  h.window.emit('storage', { key: 'smart_order_catalog_changed' }); await flush();
  h.socketEvents.emit('CATALOG_UPDATED'); await flush();
  h.socketEvents.emit('connect'); await flush();
  h.window.emit('focus'); await flush();
  h.window.emit('pageshow'); await flush();
  h.window.emit('touchstart'); await flush();
  assert.equal(h.calls.length, 8);
  h.dispose();
});

test('hidden tabs and API cooldown skip polling, visible tabs refresh on return', async () => {
  const h = harness();
  await flush();
  h.document.visibilityState = 'hidden';
  h.intervals.get(15000)(); await flush();
  assert.equal(h.calls.length, 1);
  h.document.visibilityState = 'visible';
  h.pause(123);
  h.intervals.get(15000)(); await flush();
  assert.equal(h.calls.length, 1);
  h.pause(0);
  h.document.emit('visibilitychange'); await flush();
  assert.equal(h.calls.length, 2);
  h.dispose();
});

test('a save during an in-flight read queues one follow-up without parallel reads', async () => {
  let complete;
  const h = harness(() => new Promise(resolve => { complete = resolve; }));
  h.window.emit('catalog:changed');
  h.window.emit('catalog:changed');
  h.intervals.get(15000)();
  assert.equal(h.calls.length, 1);
  complete([]); await flush();
  assert.equal(h.calls.length, 2);
  h.dispose(); complete([]); await flush();
});

test('failed reads retain the last known discount and a successful empty list clears it', async () => {
  let mode = 'active';
  const h = harness(async () => {
    if (mode === 'failure') throw new Error('network unavailable');
    return mode === 'active' ? [{ discountId: '10' }] : [];
  });
  await flush();
  assert.equal(h.states[0]['1'][0].discountId, '10');
  mode = 'failure'; h.window.emit('catalog:changed'); await flush();
  assert.equal(h.states[0]['1'][0].discountId, '10');
  mode = 'disabled'; h.window.emit('catalog:changed'); await flush();
  assert.equal(h.states[0]['1'].length, 0);
  h.dispose();
});

test('unmount cleans listeners and timers and discards late responses', async () => {
  let complete;
  const h = harness(() => new Promise(resolve => { complete = resolve; }));
  h.dispose(); complete([{ discountId: 'late' }]); await flush();
  assert.equal(Object.keys(h.states[0]).length, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.window.listeners.size, 0);
  assert.equal(h.document.listeners.size, 0);
  assert.equal(h.socketEvents.listeners.size, 0);
});
