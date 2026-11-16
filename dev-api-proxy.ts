import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import type { ProxyOptions } from 'vite';

export function createDevApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: false,
    // Dev requests are infrequent: don't reuse an upstream socket that a
    // remote load balancer may have closed while the tab was idle.
    agent: target.startsWith('https:') ? new HttpsAgent({ keepAlive: false }) : new HttpAgent({ keepAlive: false }),
    proxyTimeout: 20000,
    timeout: 25000,
    configure(proxy) {
      proxy.on('error', (_error, _request, response) => {
        if (!response || !('writeHead' in response) || response.headersSent || response.writableEnded) return;
        // No replay here: the proxy cannot know whether a mutation committed.
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({
          success: false,
          errorCode: 'DEV_PROXY_UPSTREAM_UNAVAILABLE',
          message: 'Kết nối tới máy chủ bị gián đoạn. Vui lòng thử lại sau ít giây.',
        }));
      });
    },
  };
}
