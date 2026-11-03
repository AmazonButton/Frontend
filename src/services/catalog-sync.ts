import type { Socket } from 'socket.io-client';

const CATALOG_KEY = 'smart_order_catalog_changed';
const CATALOG_EVENT = 'catalog:changed';
const EVENTS = ['PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'PRODUCT_STOCK_CHANGED', 'CATALOG_UPDATED', 'connect'];

export function notifyCatalogChanged() {
  window.dispatchEvent(new Event(CATALOG_EVENT));
  try { localStorage.setItem(CATALOG_KEY, `${Date.now()}-${Math.random()}`); } catch { /* Storage may be unavailable. */ }
}

// Refresh after a missed event/reconnect and across tabs, including when the
// HTTP request and WebSocket connection reach different backend instances.
export function subscribeCatalogChanges(socket: Socket, refresh: () => void) {
  const visibleRefresh = () => { if (document.visibilityState !== 'hidden') refresh(); };
  const onStorage = (event: StorageEvent) => { if (event.key === CATALOG_KEY) visibleRefresh(); };
  EVENTS.forEach(event => socket.on(event, refresh));
  window.addEventListener(CATALOG_EVENT, refresh);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', visibleRefresh);
  document.addEventListener('visibilitychange', visibleRefresh);
  const timer = window.setInterval(visibleRefresh, 10000);
  // Logout disconnects the authenticated socket; the public homepage still
  // needs a guest connection for live catalog events.
  if (!socket.connected) socket.connect();
  return () => {
    EVENTS.forEach(event => socket.off(event, refresh));
    window.removeEventListener(CATALOG_EVENT, refresh);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', visibleRefresh);
    document.removeEventListener('visibilitychange', visibleRefresh);
    window.clearInterval(timer);
  };
}
