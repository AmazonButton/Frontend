export interface MarketplaceCartLine {
  product: { id: string; storeId: string; price: number; store: { name: string } };
  quantity: number;
  selected: boolean;
}

export function groupCartByStore<T extends MarketplaceCartLine>(lines: T[]) {
  const stores = new Map<string, { storeId: string; storeName: string; lines: T[]; totalAmount: number }>();
  for (const line of lines) {
    const storeId = String(line.product.storeId);
    let group = stores.get(storeId);
    if (!group) {
      group = { storeId, storeName: line.product.store?.name || `Cửa hàng ${storeId}`, lines: [], totalAmount: 0 };
      stores.set(storeId, group);
    }
    group.lines.push(line);
    group.totalAmount += line.product.price * line.quantity;
  }
  return [...stores.values()];
}

interface CheckoutContact {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: string;
}

export interface MarketplacePlacedOrder {
  storeId: string;
  storeName: string;
  order: any;
}

export interface MarketplaceCheckoutResult {
  placed: MarketplacePlacedOrder[];
  failed: { storeId: string; storeName: string; message: string }[];
}

const pendingKeys = new Map<string, string>();

export function hasPendingMarketplaceCheckout(accountId: string, storage?: Storage) {
  const prefix = `sob_marketplace_attempt:${accountId}:`;
  if ([...pendingKeys.keys()].some((key) => key.startsWith(prefix))) return true;
  try {
    for (let index = 0; index < (storage?.length || 0); index++) {
      if (storage?.key(index)?.startsWith(prefix)) return true;
    }
  } catch { /* Fall back to this tab's in-memory attempts. */ }
  return false;
}

// Persist only a digest and request key, without recipient information or tokens.
async function checkoutKey(accountId: string, payload: unknown, storage?: Storage) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
  const storageKey = `sob_marketplace_attempt:${accountId}:${fingerprint}`;
  let key = pendingKeys.get(storageKey);
  try { key ||= storage?.getItem(storageKey) || undefined; } catch { /* Keep the in-memory key. */ }
  key ||= `marketplace-${crypto.randomUUID()}`;
  pendingKeys.set(storageKey, key);
  try { storage?.setItem(storageKey, key); } catch { /* Storage can be unavailable in private mode. */ }
  return { key, storageKey };
}

export async function checkoutAcrossStores<T extends MarketplaceCartLine>(options: {
  lines: T[];
  contact: CheckoutContact;
  accountId: string;
  post: (path: string, payload: any, config: any) => Promise<any>;
  storage?: Storage;
  isSessionCurrent?: () => boolean;
  onPlaced: (entry: MarketplacePlacedOrder, lines: T[]) => void;
}): Promise<MarketplaceCheckoutResult> {
  const result: MarketplaceCheckoutResult = { placed: [], failed: [] };
  for (const group of groupCartByStore(options.lines)) {
    const payload = {
      storeId: group.storeId,
      items: group.lines.map(({ product, quantity }) => ({ productId: product.id, quantity }))
        .sort((a, b) => a.productId.localeCompare(b.productId)),
      ...options.contact,
    };
    try {
      const attempt = await checkoutKey(options.accountId, payload, options.storage);
      if (options.isSessionCurrent && !options.isSessionCurrent()) {
        throw new Error('Tài khoản đã thay đổi. Vui lòng đăng nhập lại để tiếp tục đặt hàng.');
      }
      const response = await options.post('/storefront/orders', payload, {
        headers: { 'x-idempotency-key': attempt.key },
      });
      const order = response.data?.data || response.data;
      if (response.data?.success === false || !(order?.id || order?.orderId)) {
        throw new Error('Chưa xác nhận được mã đơn. Vui lòng thử lại để kiểm tra đơn hiện có.');
      }
      const entry = { storeId: group.storeId, storeName: group.storeName, order };
      result.placed.push(entry);
      options.onPlaced(entry, group.lines);
      pendingKeys.delete(attempt.storageKey);
      try { options.storage?.removeItem(attempt.storageKey); } catch { /* Non-critical cleanup. */ }
    } catch (error: any) {
      result.failed.push({
        storeId: group.storeId,
        storeName: group.storeName,
        message: error?.response?.data?.message || error?.message || 'Chưa đặt được đơn. Vui lòng thử lại.',
      });
    }
  }
  return result;
}
