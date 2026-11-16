import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createServer as createViteServer } from 'vite';
const require = createRequire(import.meta.url);
const ts = require('typescript');

for (const prefix of ['../', '../frontend/']) {
  test(`${prefix}real Vite proxy returns JSON 502 on reset, preserves queries and never replays POST`, async () => {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`${prefix}dev-api-proxy.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require });
    const calls = []; let reset = true;
    const upstream = createHttpServer((request, response) => {
      calls.push({ method: request.method, url: request.url });
      if (reset) { request.socket.destroy(); return; }
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ success: true, data: [] }));
    });
    let vite, server;
    try {
      await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
      const target = `http://127.0.0.1:${upstream.address().port}`;
      const options = exports.createDevApiProxy(target);
      assert.equal(options.agent.keepAlive, false); assert.equal(options.proxyTimeout, 20000);
      vite = await createViteServer({ configFile: false, logLevel: 'silent', appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, proxy: { '/api': options } } });
      server = createHttpServer(vite.middlewares); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      for (const path of ['/api/v1/orders', '/api/v1/admin/stores/pending?pageSize=10&page=1']) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 502); assert.equal((await response.json()).errorCode, 'DEV_PROXY_UPSTREAM_UNAVAILABLE');
        assert.equal(calls.at(-1).url, path);
      }
      const beforePost = calls.length;
      const mutation = await fetch(origin + '/api/v1/orders', { method: 'POST', body: '{}' });
      assert.equal(mutation.status, 502); await mutation.body.cancel(); assert.equal(calls.length, beforePost + 1);
      reset = false;
      const recovered = await fetch(origin + '/api/v1/orders'); assert.equal(recovered.status, 200); assert.equal((await recovered.json()).success, true);
    } finally {
      await vite?.close();
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
    }
  });
}
