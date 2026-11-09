import { isGrandfatheredStore } from './store-service-plans.ts';

export interface AdminStoreSubscriptionItem {
  storeId: string;
  storeName: string;
  storeCode: string;
  storeStatus: string;
  ownerName: string;
  email: string;
  phone: string;
  createdAt: string;
  isGrandfathered: boolean;
  subscription: any | null;
  planName: string;
  planCode: string;
  planPrice: number;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  maxProducts: number;
  canListProducts: boolean;
  statusCategory: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'EXEMPT';
  listingStatusLabel: string;
}

export function calculateDaysRemaining(endDateStr?: string | null): number | null {
  if (!endDateStr) return null;
  const end = Date.parse(endDateStr);
  if (!Number.isFinite(end)) return null;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function parseStoreSubscriptionItem(store: any, subscriptionData: any | null): AdminStoreSubscriptionItem {
  const storeId = String(store.storeId || store.id || '');
  const storeName = String(store.name || store.storeName || `Cửa hàng #${storeId}`);
  const storeCode = String(store.code || store.storeCode || '—');
  const storeStatus = String(store.status || 'ACTIVE');
  const ownerName = String(store.ownerName || store.owner?.fullName || store.owner?.username || '—');
  const email = String(store.email || store.owner?.email || '—');
  const phone = String(store.phone || store.owner?.phone || '—');
  const createdAt = String(store.createdAt || '');

  const isGrandfathered = isGrandfatheredStore(store);

  const sub = subscriptionData?.data ?? subscriptionData;
  const hasSub = sub && (sub.subscriptionId || sub.id);

  let planName = 'Chưa đăng ký gói';
  let planCode = '—';
  let planPrice = 0;
  let startDate: string | null = null;
  let endDate: string | null = null;
  let daysRemaining: number | null = null;
  let maxProducts = 0;

  if (hasSub) {
    planName = sub.plan?.planName || sub.planName || 'Gói dịch vụ';
    planCode = sub.plan?.planCode || sub.planCode || '—';
    planPrice = Number(sub.plan?.price || sub.price || 0);
    startDate = sub.startDate || null;
    endDate = sub.endDate || null;
    daysRemaining = sub.daysRemaining !== undefined ? Number(sub.daysRemaining) : calculateDaysRemaining(endDate);
    maxProducts = Number(sub.plan?.maxProducts || sub.maxProducts || 0);
  } else if (isGrandfathered) {
    planName = 'Miễn trừ gói (Cửa hàng hiện hữu)';
    planCode = 'EXEMPT';
    maxProducts = 9999;
  }

  const isSubActive = Boolean(
    hasSub &&
    sub.status === 'ACTIVE' &&
    (!endDate || Date.parse(endDate) > Date.now())
  );

  const canListProducts = isGrandfathered || isSubActive;

  let statusCategory: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'EXEMPT';
  if (hasSub && isSubActive) {
    statusCategory = 'SUBSCRIBED';
  } else if (isGrandfathered) {
    statusCategory = 'EXEMPT';
  } else {
    statusCategory = 'UNSUBSCRIBED';
  }

  let listingStatusLabel = 'Bị khóa - Cần mua gói';
  if (isGrandfathered) {
    listingStatusLabel = 'Được phép đăng bán (Miễn trừ)';
  } else if (isSubActive) {
    listingStatusLabel = 'Được phép đăng bán';
  }

  return {
    storeId,
    storeName,
    storeCode,
    storeStatus,
    ownerName,
    email,
    phone,
    createdAt,
    isGrandfathered,
    subscription: hasSub ? sub : null,
    planName,
    planCode,
    planPrice,
    startDate,
    endDate,
    daysRemaining,
    maxProducts,
    canListProducts,
    statusCategory,
    listingStatusLabel,
  };
}

export async function loadStoresSubscriptionOverview(
  apiClient: { get(path: string, config?: any): Promise<any> },
  stores: any[],
  concurrency = 5
): Promise<AdminStoreSubscriptionItem[]> {
  if (!Array.isArray(stores) || stores.length === 0) return [];

  const results: AdminStoreSubscriptionItem[] = [];
  const queue = [...stores];

  // Run in chunks to avoid overwhelming server while maintaining high speed
  const executeWorker = async () => {
    while (queue.length > 0) {
      const store = queue.shift();
      if (!store) break;
      const sId = store.storeId || store.id;
      let subData: any = null;
      try {
        const response = await apiClient.get(`/store/subscriptions/current`, {
          params: { storeId: sId },
        });
        if (response?.data?.success && response.data.data) {
          subData = response.data.data;
        }
      } catch {
        // Silently catch and treat as no subscription
        subData = null;
      }
      results.push(parseStoreSubscriptionItem(store, subData));
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, stores.length) }, () => executeWorker());
  await Promise.all(workers);

  // Preserve initial ordering (sorted by storeId or original order)
  const storeIdOrder = new Map(stores.map((s, idx) => [String(s.storeId || s.id), idx]));
  return results.sort((a, b) => (storeIdOrder.get(a.storeId) ?? 0) - (storeIdOrder.get(b.storeId) ?? 0));
}
