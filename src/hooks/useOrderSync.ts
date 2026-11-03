// @refresh reset
// Remount consumers after hook edits/rollbacks instead of reusing stale hook queues.
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { publishOrderEvent } from '../services/order-events';
import { getUserStoreId, reconcileOrders } from '../services/order-reconciliation';

// Reconcile through the same authenticated API even when a WebSocket connects
// to a different backend node, or the browser temporarily loses its connection.
export function useOrderSync() {
  const { user, token } = useAuth();
  const lastSnapshot = useRef<{ scope: string; orders: Map<string, string> } | null>(null);
  const storeId = getUserStoreId(user);
  useEffect(() => {
    if (!user || !token || !['CUSTOMER', 'STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'STAFF_ORDER', 'STAFF_INVENTORY', 'STAFF_BUTTON', 'STAFF_DELIVERY'].includes(user.role)) return;
    let active = true;
    let busy = false;
    const scope = `${user.id}:${user.role}:${storeId || ''}:${user.customerProfileId || ''}`;
    const storageKey = `sob_order_snapshot:${scope}`;
    let previous = lastSnapshot.current?.scope === scope ? lastSnapshot.current.orders : null;
    if (!previous) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (Array.isArray(saved) && saved.every((entry) => Array.isArray(entry) && entry.length === 2 && entry.every((value) => typeof value === 'string'))) previous = new Map(saved);
      } catch { /* Recover with an in-memory baseline if storage is unavailable. */ }
    }
    const refresh = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const response = await api.get('/orders');
        const rows = response.data?.data;
        if (!active || !Array.isArray(rows)) return;
        const result = reconcileOrders(previous, rows);
        previous = result.snapshot;
        lastSnapshot.current = { scope, orders: previous };
        result.events.forEach(({ type, payload }) => publishOrderEvent(type, payload));
        try { sessionStorage.setItem(storageKey, JSON.stringify([...previous])); } catch { /* Keep the in-memory snapshot. */ }
      } catch {
        // Keep the last successful snapshot; a failed request is not an empty list.
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.id, user?.role, storeId, user?.customerProfileId, token]);
}
