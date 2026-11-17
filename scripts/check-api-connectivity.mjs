// Public GET probes only. No credentials or response bodies are printed.
const viaVite = process.argv[2] === '--via-vite';
let vite;
if (viaVite) {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  await vite.listen();
}
const base = viaVite ? `http://127.0.0.1:${vite.httpServer.address().port}` : process.argv[2] || 'https://backend-fae8.onrender.com';
const paths = [...(viaVite ? [] : ['/healthz']), '/api/v1/orders', '/api/v1/admin/stores/pending?pageSize=10&page=1'];
try {
for (let round = 1; round <= 3; round++) {
  await Promise.all(paths.map(async path => {
    const started = Date.now();
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000), redirect: 'error' });
      console.log(JSON.stringify({ round, path, status: response.status, milliseconds: Date.now() - started }));
      if (![200, 401, 403].includes(response.status)) process.exitCode = 1;
      await response.body?.cancel();
    } catch (error) {
      console.log(JSON.stringify({ round, path, error: error.cause?.code || error.name, milliseconds: Date.now() - started }));
      process.exitCode = 1;
    }
  }));
}
} finally {
  await vite?.close();
}
