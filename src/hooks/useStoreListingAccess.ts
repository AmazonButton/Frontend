// @refresh reset
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { financeError, financeStoreId } from '../services/store-finance-flow';
import { createStorePlanFlow, storeListingEntitlement, type StorePlanSubscription } from '../services/store-service-plans';
import { getApiRetryUntil } from '../services/request-backoff';

const flow = createStorePlanFlow(api);
type ListingAccess = Awaited<ReturnType<typeof flow.listingAccess>>;
export function useStoreListingAccess(user: any) {
  const owner = user?.role === 'STORE_OWNER';
  const storeId = financeStoreId(user);
  const scope = `${user?.id || ''}:${storeId || ''}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const userRef = useRef(user); userRef.current = user;
  const sequence = useRef(0);
  const inFlight = useRef<{ scope: string; creating: boolean; request: number; promise: Promise<ListingAccess | null> } | null>(null);
  const [state, setState] = useState<{ scope: string; checking: boolean; error: string; subscription: StorePlanSubscription | null; totalProducts: number | null }>({ scope, checking: owner, error: '', subscription: null, totalProducts: null });
  const actionRead = useRef(false);
  const refresh = useCallback((creating = true, background = false): Promise<ListingAccess | null> => {
    if (!owner || !storeId) {
      if (scopeRef.current === scope) setState({ scope, checking: false, error: owner ? 'Chưa xác định được cửa hàng để kiểm tra gói dịch vụ.' : '', subscription: null, totalProducts: null });
      return Promise.resolve(null);
    }
    if (inFlight.current?.scope === scope && inFlight.current.creating === creating) {
      return inFlight.current.promise;
    }
    const request = ++sequence.current;
    // Automatic refreshes keep the last result visible instead of reopening the loading banner.
    setState(current => background && current.scope === scope ? current : { ...current, scope, checking: true, error: '' });
    const promise = (async () => {
      try {
        const access = await flow.listingAccess(storeId, creating, userRef.current);
        if (scopeRef.current !== scope || sequence.current !== request) return null;
        setState(current => ({ scope, checking: false, error: '', subscription: access.subscription, totalProducts: creating ? access.totalProducts : current.totalProducts }));
        return access;
      } catch (error) {
        if (scopeRef.current === scope && sequence.current === request) setState(current => ({ ...current, scope, checking: false, error: financeError(error, 'Chưa kiểm tra được gói dịch vụ.') }));
        return null;
      } finally {
        if (inFlight.current?.request === request) inFlight.current = null;
      }
    })();
    inFlight.current = { scope, creating, request, promise };
    return promise;
  }, [owner, storeId, scope]);
  useEffect(() => {
    void refresh();
    const update = () => { if (document.visibilityState === 'visible' && !getApiRetryUntil() && !actionRead.current) void refresh(true, true); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { sequence.current++; inFlight.current = null; window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  const validScope = state.scope === scope;
  const entitlement = storeListingEntitlement(validScope ? state.subscription : null, validScope ? state.totalProducts : null, true, Date.now(), user);
  return {
    ...state, checking: owner && (!validScope || state.checking),
    allowed: !owner || (validScope && !state.checking && !state.error && entitlement.allowed),
    isGrandfathered: Boolean(entitlement.isGrandfathered),
    requiresSubscription: Boolean(entitlement.requiresSubscription),
    reason: state.error || entitlement.reason,
    refresh,
    async assertAllowed(creating = true) {
      if (!owner) return true;
      if (actionRead.current) return false;
      actionRead.current = true;
      try {
        const access = await refresh(creating);
        if (!access || !access.allowed) throw new Error(access?.reason || 'Chưa kiểm tra được quyền đăng sản phẩm. Hãy tải lại gói dịch vụ.');
        return true;
      } finally { actionRead.current = false; }
    },
  };
}
