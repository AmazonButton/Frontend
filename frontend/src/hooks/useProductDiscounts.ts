import { useEffect, useState } from 'react';
import { ProductDiscount, productDiscounts } from '../services/product-discounts';

// Batch the existing per-product API and discard responses from obsolete catalogs.
export function useProductDiscounts(productIds: string[]) {
  const ids = [...new Set(productIds.map(String))].filter(id => /^\d+$/.test(id)).sort().join(',');
  const [discounts, setDiscounts] = useState<Record<string, ProductDiscount[]>>({});
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const storage = (event: StorageEvent) => { if (event.key === 'smart_order_catalog_changed') refresh(); };
    window.addEventListener('catalog:changed', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', storage);
    const timer = window.setInterval(() => { setNow(Date.now()); refresh(); }, 60000);
    return () => {
      window.removeEventListener('catalog:changed', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', storage);
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const boundaries = Object.values(discounts).flat().flatMap(item => [Date.parse(item.startAt), Date.parse(item.endAt) + 1]).filter(time => time > now);
    if (!boundaries.length) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(60000, Math.max(1, Math.min(...boundaries) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [discounts, now]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const keys = ids ? ids.split(',') : [];
      const next: Record<string, ProductDiscount[]> = {};
      for (let index = 0; index < keys.length; index += 4) {
        if (cancelled) return;
        const batch = keys.slice(index, index + 4);
        const results = await Promise.allSettled(batch.map(id => productDiscounts.list(id)));
        results.forEach((result, offset) => { next[batch[offset]] = result.status === 'fulfilled' ? result.value : []; });
        if (cancelled) return;
        setDiscounts({ ...next });
        if (results.some(result => result.status === 'rejected' && [404, 429, 503].includes(result.reason?.response?.status))) break;
      }
      if (!cancelled) { setDiscounts(next); setNow(Date.now()); }
    };
    void load();
    return () => { cancelled = true; };
  }, [ids, revision]);
  return { discounts, now };
}
