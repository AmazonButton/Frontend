// Retire the legacy offline shell; Firebase push uses its own worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith('smart-order-cache-')).map(name => caches.delete(name)));
    } finally {
      await self.registration.unregister();
    }
  })());
});
