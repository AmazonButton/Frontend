import { useEffect, useState } from 'react';
import { ProductDiscount, productDiscounts } from '../services/product-discounts';
import { getSocket } from '../services/socket';
import { getApiRetryUntil } from '../services/request-backoff';

export function useProductDiscounts(productIds: string[]) {
  const ids = [...new Set(productIds.map(String))].filter(id => /^\d+$/.test(id)).sort().join(',');
  const [discounts, setDiscounts] = useState<Record<string, ProductDiscount[]>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const keys = ids ? ids.split(',') : [];
    if (!keys.length) { setDiscounts({}); return; }
    let cancelled = false;
    let running = false;
    let queued = false;
    const refresh = async () => {
      if (cancelled || document.visibilityState === 'hidden' || getApiRetryUntil()) return;
      // A save during a pending read needs one more read after it completes.
      if (running) { queued = true; return; }
      running = true;
      setNow(Date.now());
      try {
        for (let index = 0; index < keys.length; index += 4) {
          if (cancelled || getApiRetryUntil()) break;
          const batch = keys.slice(index, index + 4);
          const results = await Promise.allSettled(batch.map(id => productDiscounts.list(id)));
          if (cancelled) return;
          const updates: Record<string, ProductDiscount[]> = {};
          results.forEach((result, offset) => {
            if (result.status === 'fulfilled') updates[batch[offset]] = result.value;
          });
          setDiscounts(previous => ({ ...previous, ...updates }));
          if (results.some(result => result.status === 'rejected' && [404, 429, 503].includes(result.reason?.response?.status))) break;
        }
      } finally {
        running = false;
        if (queued && !cancelled) { queued = false; void refresh(); }
      }
    };
    const onChange = () => { void refresh(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'smart_order_catalog_changed') onChange();
    };
    let lastTouch = 0;
    const onTouch = () => {
      const currentTime = Date.now();
      if (currentTime - lastTouch >= 4000) {
        lastTouch = currentTime;
        onChange();
      }
    };
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const socketEvents = ['CATALOG_UPDATED', 'PRODUCT_UPDATED', 'connect'];
    socketEvents.forEach(event => socket.on(event, onChange));
    window.addEventListener('catalog:changed', onChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onChange);
    window.addEventListener('pageshow', onChange);
    window.addEventListener('touchstart', onTouch, { passive: true } as any);
    document.addEventListener('visibilitychange', onChange);
    // The discount API currently has no broadcast event across devices.
    const timer = window.setInterval(() => { if (!running) onChange(); }, 15000);
    onChange();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      socketEvents.forEach(event => socket.off(event, onChange));
      window.removeEventListener('catalog:changed', onChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onChange);
      window.removeEventListener('pageshow', onChange);
      window.removeEventListener('touchstart', onTouch);
      document.removeEventListener('visibilitychange', onChange);
    };
  }, [ids]);

  useEffect(() => {
    const boundaries = Object.values(discounts).flat()
      .flatMap(item => [Date.parse(item.startAt), Date.parse(item.endAt) + 1])
      .filter(time => time > now);
    if (!boundaries.length) return;
    const delay = Math.min(60000, Math.max(1, Math.min(...boundaries) - Date.now()));
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [discounts, now]);
  return { discounts, now };
}
