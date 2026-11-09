export interface StoreServicePlan {
  planId: string; planCode: string; planName: string; description?: string | null;
  price: number; durationDays: number; maxProducts: number; isActive: boolean;
}
export interface StorePlanSubscription {
  subscriptionId: string; storeId: string; planId: string; status: string;
  startDate: string; endDate: string; paymentMethod?: string; plan: StoreServicePlan | null;
  upcomingSubscription?: StorePlanSubscription | null;
}
export interface PlanTransport { get(path: string, config?: any): Promise<any>; post(path: string, body: any, config?: any): Promise<any> }
export function eligibleStorePayosPlan(catalog: StoreServicePlan[], planId: string) {
  // The deployed renew-charge endpoint and settlement select the single active
  // 60,000 VND plan and grant 30 days. Never use it for an arbitrary planId.
  const candidates = catalog.filter(plan => plan.isActive && plan.price === 60000);
  return candidates.length === 1 && candidates[0].durationDays === 30 && candidates[0].planId === planId;
}
export function storePlanCheckoutUrl(value: unknown) {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && (url.hostname === 'payos.vn' || url.hostname.endsWith('.payos.vn')) && !/\/web\/pl_/.test(url.pathname) ? url.href : null; } catch { return null; }
}
export function planData(response: any): any {
  if (response?.data?.success !== true || !Object.prototype.hasOwnProperty.call(response.data, 'data')) throw new Error('Chưa nhận được dữ liệu gói dịch vụ hợp lệ.');
  return response.data.data;
}
const number = (value: any) => (typeof value === 'number' || typeof value === 'string') && String(value).trim() ? Number(value) : NaN;
export function readStorePlan(raw: any): StoreServicePlan {
  const price = number(raw?.price), days = number(raw?.durationDays), quota = number(raw?.maxProducts);
  if (!/^[1-9]\d*$/.test(String(raw?.planId)) || typeof raw?.planName !== 'string' || !raw.planName.trim()
    || !Number.isFinite(price) || price < 0 || !Number.isInteger(days) || days <= 0 || !Number.isInteger(quota) || quota < 0 || typeof raw?.isActive !== 'boolean') throw new Error('Gói dịch vụ chưa có đầy đủ giá, thời hạn hoặc giới hạn sản phẩm.');
  return { ...raw, planId: String(raw.planId), price, durationDays: days, maxProducts: quota };
}
export function readStorePlanSubscription(raw: any, storeId: string): StorePlanSubscription | null {
  if (raw === null) return null;
  if (!raw || String(raw.storeId) !== storeId || !/^[1-9]\d*$/.test(String(raw.subscriptionId))) throw new Error('Thông tin gói không thuộc cửa hàng đang xem hoặc chưa đầy đủ.');
  return { ...raw, storeId: String(raw.storeId), subscriptionId: String(raw.subscriptionId), planId: String(raw.planId), plan: raw.plan ? readStorePlan(raw.plan) : null };
}
export const GRANDFATHERED_STORE_CUTOFF_DATE = '2026-11-08T23:59:59.999Z';
export const MAX_GRANDFATHERED_STORE_ID = 381;

export function isGrandfatheredStore(userOrStore: any): boolean {
  if (!userOrStore) return false;
  const storeId =
    userOrStore.storeId ||
    userOrStore.store?.storeId ||
    userOrStore.id ||
    userOrStore.ownedStores?.[0]?.storeId;
  const createdAt = userOrStore.store?.createdAt || userOrStore.createdAt;

  const numId = Number(storeId);
  if (Number.isInteger(numId) && numId > 0 && numId <= MAX_GRANDFATHERED_STORE_ID) {
    return true;
  }

  if (createdAt) {
    const time = new Date(createdAt).getTime();
    if (!Number.isNaN(time) && time <= new Date(GRANDFATHERED_STORE_CUTOFF_DATE).getTime()) {
      return true;
    }
  }

  return false;
}

export function storeListingEntitlement(
  subscription: StorePlanSubscription | null,
  totalProducts: number | null,
  creating = true,
  now = Date.now(),
  userOrStore?: any
) {
  const isGrandfathered = Boolean(userOrStore && isGrandfatheredStore(userOrStore));
  if (isGrandfathered && !subscription) {
    return {
      allowed: true,
      isGrandfathered: true,
      requiresSubscription: false,
      reason: '',
    };
  }

  if (!subscription) {
    return {
      allowed: false,
      isGrandfathered: false,
      requiresSubscription: true,
      reason: 'Cửa hàng chưa đăng ký gói dịch vụ. Vui lòng đăng ký gói dịch vụ để có thể đăng sản phẩm bán lên sàn.',
    };
  }
  const start = Date.parse(subscription.startDate), end = Date.parse(subscription.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { allowed: false, isGrandfathered, requiresSubscription: false, reason: 'Chưa xác định được thời hạn gói. Vui lòng tải lại trước khi đăng sản phẩm.' };
  if (end <= now) {
    if (isGrandfathered) {
      return { allowed: true, isGrandfathered: true, requiresSubscription: false, reason: '' };
    }
    return { allowed: false, isGrandfathered: false, requiresSubscription: true, reason: 'Gói dịch vụ đã hết hạn. Hãy đăng ký hoặc gia hạn gói dịch vụ để tiếp tục đăng bán sản phẩm.' };
  }
  if (start > now) return { allowed: false, isGrandfathered, requiresSubscription: false, reason: 'Gói đã đăng ký chưa đến ngày bắt đầu. Bạn có thể đăng sản phẩm khi gói có hiệu lực.' };
  if (subscription.status !== 'ACTIVE') {
    if (isGrandfathered) {
      return { allowed: true, isGrandfathered: true, requiresSubscription: false, reason: '' };
    }
    return { allowed: false, isGrandfathered: false, requiresSubscription: true, reason: 'Gói dịch vụ chưa ở trạng thái hoạt động. Vui lòng kiểm tra lại đăng ký.' };
  }
  if (!creating) return { allowed: true, isGrandfathered, requiresSubscription: false, reason: '' };
  const quota = subscription.plan?.maxProducts;
  if (!Number.isInteger(totalProducts) || totalProducts! < 0 || !Number.isInteger(quota) || quota! < 0) return { allowed: false, isGrandfathered, requiresSubscription: false, reason: 'Chưa kiểm tra được giới hạn sản phẩm của gói. Vui lòng tải lại.' };
  if (totalProducts! >= quota!) return { allowed: false, isGrandfathered, requiresSubscription: false, reason: `Gian hàng đã dùng ${totalProducts}/${quota} sản phẩm của gói. Hãy xem gói dịch vụ trước khi đăng thêm.` };
  return { allowed: true, isGrandfathered, requiresSubscription: false, reason: '' };
}
export function createStorePlanFlow(api: PlanTransport) {
  return {
    async plans() {
      const rows = planData(await api.get('/store/subscriptions/plans'));
      if (!Array.isArray(rows)) throw new Error('Chưa tải được danh sách gói dịch vụ.');
      return rows.map(readStorePlan).filter(plan => plan.isActive);
    },
    async current(storeId: string) { return readStorePlanSubscription(planData(await api.get('/store/subscriptions/current')), storeId); },
    async listingAccess(storeId: string, creating = true, userOrStore?: any) {
      const subscription = await this.current(storeId);
      // An inactive period never needs a product-count read to reject publishing.
      const period = storeListingEntitlement(subscription, 0, false, Date.now(), userOrStore);
      if (!period.allowed || !creating) return { subscription, totalProducts: null, ...period };
      const response = await api.get('/products', { params: { page: 1, pageSize: 1 } });
      planData(response);
      const count = response.data.pagination?.totalItems ?? response.data.pagination?.total;
      const totalProducts = Number.isInteger(count) && count >= 0 ? count : null;
      return { subscription, totalProducts, ...storeListingEntitlement(subscription, totalProducts, creating, Date.now(), userOrStore) };
    },
    async subscribe(storeId: string, planId: string, idempotencyKey: string) {
      const id = Number(planId);
      if (!Number.isSafeInteger(id) || id < 1 || !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) throw new Error('Yêu cầu đăng ký chưa hợp lệ.');
      const result = readStorePlanSubscription(planData(await api.post('/store/subscriptions/subscribe', { planId: id, idempotencyKey }, { headers: { 'idempotency-key': idempotencyKey, 'x-idempotency-key': idempotencyKey } })), storeId);
      if (!result) throw new Error('Chưa nhận được đăng ký gói từ hệ thống.');
      return result;
    },
    async history(page = 1) {
      const response = await api.get('/store/subscriptions', { params: { page, pageSize: 10 } });
      const rows = planData(response);
      if (!Array.isArray(rows) || !response.data.pagination) throw new Error('Chưa nhận được lịch sử gói dịch vụ.');
      return { rows, pagination: response.data.pagination };
    },
    async createPayosCharge(returnUrl: string, cancelUrl: string) {
      const result = planData(await api.post('/store/subscriptions/renew-charge', { returnUrl, cancelUrl }));
      if (!/^[1-9]\d*$/.test(String(result?.paymentTransactionId)) || result?.amount !== 60000 || result.currency !== 'VND' || !storePlanCheckoutUrl(result.checkoutUrl)) throw new Error('Hướng dẫn thanh toán gói từ server chưa hợp lệ. Vui lòng kiểm tra yêu cầu trước khi tạo lại.');
      return { chargeId: String(result.paymentTransactionId), checkoutUrl: storePlanCheckoutUrl(result.checkoutUrl)!, amount: result.amount as number };
    },
    async charge(storeId: string, chargeId: string) {
      if (!/^[1-9]\d*$/.test(chargeId)) throw new Error('Mã khoản thu không hợp lệ.');
      const result = planData(await api.get(`/billing-charges/${chargeId}`));
      if (String(result?.chargeId) !== chargeId || result?.purpose !== 'STORE_SUBSCRIPTION' || result?.targetType !== 'STORE'
        || String(result?.storeId ?? result?.targetId) !== storeId || Number(result.totalAmount) !== 60000) throw new Error('Khoản thu không khớp với gói dịch vụ của cửa hàng này.');
      return result;
    },
  };
}
