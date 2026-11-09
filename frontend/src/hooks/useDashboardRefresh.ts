import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { ORDER_EVENT } from '../services/order-events';
import { getApiRetryUntil } from '../services/request-backoff';

const events = [
  'connect', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED',
  'ORDER_PAYMENT_CONFIRMED', 'ORDER_DELIVERED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED',
  'PRODUCT_DELETED', 'PRODUCT_STOCK_CHANGED', 'DEVICES_ALLOCATED_TO_STORE',
  'DEVICE_CREATED', 'DEVICE_UPDATED', 'DEVICE_DELETED', 'DEVICE_CLAIMED',
  'DEVICE_UNCLAIMED', 'STORE_APPROVED', 'STORE_REJECTED', 'STORE_REGISTERED',
  'WALLET_UPDATED', 'WITHDRAWAL_UPDATED',
];

// Refresh the currently visible dashboard only. Bursts coalesce into one read;
// the existing 429 cooldown always takes precedence over automatic refreshing.
export function useDashboardRefresh(
  refresh: () => unknown | Promise<unknown>,
  scope: string,
  pollOnly = false,
) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    let active = true;
    let running = false;
    let queued = false;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const request = () => {
      if (!active || document.visibilityState === 'hidden' || getApiRetryUntil()) return;
      if (running) { queued = true; return; }
      if (timer) return;
      timer = setTimeout(async () => {
        timer = null;
        if (!active || document.visibilityState === 'hidden' || getApiRetryUntil()) return;
        running = true;
        last = Date.now();
        try { await latest.current(); }
        catch { /* The page presents its own fetch error. */ }
        finally {
          running = false;
          if (queued && active) { queued = false; request(); }
        }
      }, Math.max(250, 3000 - (Date.now() - last)));
    };
    const socket = getSocket();
    const windowEvents = ['focus', ORDER_EVENT, 'sob_device_claimed_success', 'storage', 'catalog:changed'];
    if (!pollOnly) {
      events.forEach(event => socket.on(event, request));
      windowEvents.forEach(event => window.addEventListener(event, request));
    }
    const interval = setInterval(request, 30000);
    document.addEventListener('visibilitychange', request);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      if (!pollOnly) {
        events.forEach(event => socket.off(event, request));
        windowEvents.forEach(event => window.removeEventListener(event, request));
      }
      document.removeEventListener('visibilitychange', request);
    };
  }, [scope, pollOnly]);
}
