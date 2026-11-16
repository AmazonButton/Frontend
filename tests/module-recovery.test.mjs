import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as root from '../src/services/module-recovery.ts';
import * as frontend from '../frontend/src/services/module-recovery.ts';

const chunkError = new TypeError('Failed to fetch dynamically imported module: https://example.invalid/assets/StoreDashboard-old.js');
const documentResponse = () => ({ ok: true, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), text: async () => '<html><script type="module" src="/assets/index-new.js"></script></html>' });

function environment(overrides = {}) {
  const values = new Map();
  let reloads = 0, reads = 0;
  const env = {
    online: () => true, now: () => 100_000,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    fetchDocument: async () => { reads++; return documentResponse(); },
    reload: () => { reloads++; }, ...overrides,
  };
  return { env, values, get reloads() { return reloads; }, get reads() { return reads; } };
}

for (const [name, service, prefix] of [['root', root, '../'], ['frontend', frontend, '../frontend/']]) {
  test(`${name}: Vite and React share a reload, a new document cannot reload in a loop`, async () => {
    const app = environment(), recover = service.createModuleRecovery(app.env);
    assert.deepEqual(await Promise.all([recover(chunkError), recover(chunkError)]), [true, true]);
    assert.equal(app.reloads, 1); assert.equal(app.reads, 1);
    assert.equal(await service.createModuleRecovery(app.env)(chunkError), false);
    assert.equal(app.reloads, 1);
    const afterCooldown = service.createModuleRecovery({ ...app.env, now: () => 161_000 });
    assert.equal(await afterCooldown(chunkError), true); assert.equal(app.reloads, 2);
  });

  test(`${name}: recognizes browser chunk/CSS failures but never reloads ordinary application errors`, async () => {
    for (const message of ['error loading dynamically imported module', 'Importing a module script failed.', 'Loading chunk 123 failed.', 'Unable to preload CSS for /assets/page.css']) assert.equal(service.isModuleLoadError({ message }), true);
    const app = environment();
    assert.equal(await service.createModuleRecovery(app.env)(new Error('Cannot read properties of undefined')), false);
    assert.equal(app.reloads, 0); assert.equal(app.reads, 0);
  });

  test(`${name}: offline, inaccessible storage and unsuccessful document probes never auto-reload`, async () => {
    for (const overrides of [
      { online: () => false },
      { fetchDocument: async () => { throw new Error('network timeout'); } },
      { fetchDocument: async () => ({ ...documentResponse(), ok: false }) },
      { fetchDocument: async () => ({ ...documentResponse(), headers: new Headers({ 'content-type': 'application/json' }) }) },
      { fetchDocument: async () => ({ ...documentResponse(), text: async () => '<html>Maintenance</html>' }) },
      { storage: { getItem() { throw new Error('denied'); }, setItem() {} } },
      { storage: { getItem: () => null, setItem() { throw new Error('quota'); } } },
    ]) {
      const app = environment(overrides);
      assert.equal(await service.createModuleRecovery(app.env)(chunkError), false);
      assert.equal(app.reloads, 0);
    }
  });

  test(`${name}: a transient failure can recover once connectivity returns`, async () => {
    let available = false;
    const app = environment({ fetchDocument: async () => { if (!available) throw new Error('network'); return documentResponse(); } });
    const recover = service.createModuleRecovery(app.env);
    assert.equal(await recover(chunkError), false);
    available = true;
    assert.equal(await recover(chunkError), true); assert.equal(app.reloads, 1);
  });

  test(`${name}: retiring the legacy worker deletes only its caches and has no fetch interception`, async () => {
    const events = {}, deleted = []; let unregistered = 0, waiting, skipped = 0;
    vm.runInNewContext(readFileSync(new URL(`${prefix}public/sw.js`, import.meta.url), 'utf8'), {
      self: { addEventListener: (name, fn) => { events[name] = fn; }, skipWaiting: () => { skipped++; }, registration: { unregister: async () => { unregistered++; } } },
      caches: { keys: async () => ['smart-order-cache-v1', 'smart-order-cache-v2', 'firebase-messaging'], delete: async key => { deleted.push(key); } },
    });
    events.install(); events.activate({ waitUntil: promise => { waiting = promise; } }); await waiting;
    assert.equal(skipped, 1); assert.equal(unregistered, 1); assert.equal(events.fetch, undefined);
    assert.deepEqual(deleted, ['smart-order-cache-v1', 'smart-order-cache-v2']);
  });

  test(`${name}: HTML cleanup preserves push registration and unrelated caches`, async () => {
    const html = readFileSync(new URL(`${prefix}index.html`, import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
    let legacy = 0, push = 0; const deleted = [];
    const caches = { keys: async () => ['smart-order-cache-v2', 'firebase-messaging'], delete: async key => { deleted.push(key); } };
    vm.runInNewContext(inline, {
      URL, window: { caches }, caches,
      navigator: { serviceWorker: { getRegistrations: async () => [
        { active: { scriptURL: 'https://example.invalid/sw.js' }, unregister: async () => { legacy++; } },
        { active: { scriptURL: 'https://example.invalid/assets/firebase-messaging-worker.js' }, unregister: async () => { push++; } },
      ] } },
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(legacy, 1); assert.equal(push, 0); assert.deepEqual(deleted, ['smart-order-cache-v2']);
  });

  test(`${name}: deep-link documents revalidate while API and static assets keep their own policies`, () => {
    const config = JSON.parse(readFileSync(new URL(`${prefix}vercel.json`, import.meta.url), 'utf8'));
    const rule = config.headers.find(rule => rule.source.startsWith('/((?!assets/'));
    const pattern = new RegExp(`^${rule.source}$`);
    for (const path of ['/store/dashboard', '/customer/orders', '/admin/dashboard', '/']) assert.equal(pattern.test(path), true);
    for (const path of ['/api/v1/orders', '/assets/page.js', '/logo.png', '/sw.js']) assert.equal(pattern.test(path), false);
    assert.equal(rule.headers[0].value, 'no-cache, no-store, must-revalidate');
  });
}
