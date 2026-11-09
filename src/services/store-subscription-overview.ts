export interface SubscriptionPayment {
  id: string;
  amount: number;
  status: string;
  description: string;
  referenceId: string | null;
  createdAt: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
}

const DAY = 86400000;
export function subscriptionNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function subscriptionDate(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function subscriptionMoney(value: unknown) {
  const amount = subscriptionNumber(value);
  return amount === null ? '—' : `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ₫`;
}

export function subscriptionDateLabel(value: unknown, withTime = false) {
  const date = subscriptionDate(value);
  return date === null ? '—' : new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', ...(withTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

export function validateStoreSubscription(value: any, storeId: string | null) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Chưa nhận được thông tin gói hợp lệ.');
  if (value.storeId != null && String(value.storeId) !== storeId) throw new Error('Thông tin gói không thuộc cửa hàng đang xem. Vui lòng tải lại.');
  return value;
}

export function subscriptionOverview(subscription: any, now = Date.now()) {
  const start = subscriptionDate(subscription?.startDate);
  const end = subscriptionDate(subscription?.endDate);
  const validPeriod = start !== null && end !== null && end > start;
  const reportedDays = subscriptionNumber(subscription?.daysRemaining);
  const days = end !== null ? Math.max(0, Math.ceil((end - now) / DAY)) : reportedDays !== null && reportedDays >= 0 ? Math.ceil(reportedDays) : null;
  const state = !subscription ? 'NONE' : !validPeriod ? 'UNKNOWN' : end! <= now ? 'EXPIRED' : start! > now ? 'UPCOMING' : subscription.status === 'ACTIVE' ? 'ACTIVE' : 'UNKNOWN';
  const urgent = state === 'EXPIRED' || state === 'ACTIVE' && days !== null && days <= 3;
  const expiring = state === 'ACTIVE' && days !== null && days <= 7;
  const progress = validPeriod ? Math.min(100, Math.max(0, (now - start!) / (end! - start!) * 100)) : null;
  const labels = { NONE: 'Chưa có gói đang hoạt động', UNKNOWN: 'Chưa đủ thông tin hiệu lực', EXPIRED: 'Đã hết hạn', UPCOMING: 'Chưa đến ngày bắt đầu', ACTIVE: expiring ? 'Sắp hết hạn' : 'Đang sử dụng' };
  return { start, end, days, state, urgent, expiring, progress, label: labels[state] };
}

// Only explicit subscription ledger entries count; never infer a fee from text.
export function readSubscriptionPayments(response: any): SubscriptionPayment[] {
  if (response?.data?.success !== true || !Array.isArray(response.data.data)) throw new Error('Chưa tải được lịch sử đóng phí thuê sàn.');
  const rows = new Map<string, SubscriptionPayment>();
  for (const item of response.data.data) {
    if (item?.type !== 'SUBSCRIPTION_PAYMENT') continue;
    const amount = subscriptionNumber(item.amount);
    const date = subscriptionDate(item.createdAt);
    const id = String(item.id ?? item.transactionId ?? '');
    if (!/^[1-9]\d*$/.test(id) || typeof (item.id ?? item.transactionId) === 'number' && !Number.isSafeInteger(item.id ?? item.transactionId) || amount === null || !Number.isSafeInteger(Math.round(amount * 100)) || date === null) throw new Error('Lịch sử có giao dịch chưa đủ thông tin để đối soát. Vui lòng tải lại.');
    const row: SubscriptionPayment = {
      id, amount, status: typeof item.status === 'string' ? item.status : item.transactionId != null ? 'POSTED' : 'UNKNOWN',
      description: typeof item.description === 'string' ? item.description : 'Phí thuê gian hàng',
      referenceId: typeof item.referenceId === 'string' ? item.referenceId : null,
      createdAt: new Date(date).toISOString(),
      balanceBefore: subscriptionNumber(item.balanceBefore), balanceAfter: subscriptionNumber(item.balanceAfter),
    };
    if (rows.has(id) && JSON.stringify(rows.get(id)) !== JSON.stringify(row)) throw new Error('Thông tin giao dịch bị trùng và không khớp. Vui lòng tải lại.');
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const isPaidSubscription = (row: SubscriptionPayment) => ['SUCCESS', 'POSTED'].includes(row.status) && row.amount <= 0;
export const subscriptionPaymentStatus = (row: SubscriptionPayment) => isPaidSubscription(row) ? 'Đã trừ ví' : row.status === 'PENDING' ? 'Đang chờ' : row.status === 'FAILED' ? 'Không thành công' : 'Cần đối soát';

export async function loadSubscriptionPayments(transport: { get(path: string, config?: any): Promise<any> }, isCurrent: () => boolean = () => true): Promise<SubscriptionPayment[] | null> {
  const rows: any[] = [];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    if (!isCurrent()) return null;
    const response = await transport.get('/store/wallet/transactions', { params: { type: 'SUBSCRIPTION_PAYMENT', page, pageSize: 100 } });
    if (!isCurrent()) return null;
    readSubscriptionPayments(response); // Validate each response before aggregating.
    if (page === 1 && response.data.pagination) {
      const pagination = response.data.pagination;
      if (!Number.isSafeInteger(pagination.totalPages) || pagination.totalPages < 0 || pagination.totalPages > 500) throw new Error('Lịch sử đóng phí chưa có phân trang hợp lệ.');
      pages = Math.max(1, pagination.totalPages);
    }
    rows.push(...response.data.data);
  }
  return readSubscriptionPayments({ data: { success: true, data: rows } });
}
export function subscriptionPaidTotal(rows: SubscriptionPayment[]) {
  const cents = rows.filter(isPaidSubscription).reduce((sum, row) => sum + Math.round(-row.amount * 100), 0);
  return Number.isSafeInteger(cents) ? cents / 100 : null;
}

export function subscriptionMonth(value: string | number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date(value));
}

export function filterSubscriptionPayments(rows: SubscriptionPayment[], search: string, period: string, now = Date.now()) {
  const query = search.trim().toLocaleLowerCase('vi-VN');
  return rows.filter(row => {
    const timestamp = Date.parse(row.createdAt);
    if (period !== 'ALL' && (timestamp > now || timestamp < now - Number(period) * DAY)) return false;
    return !query || [row.id, row.referenceId, row.description].some(value => value?.toLocaleLowerCase('vi-VN').includes(query));
  });
}

export function subscriptionPaymentsCSV(rows: SubscriptionPayment[]) {
  const cell = (value: string) => `"${(/^(?:\s*[=+\-@]|[\t\r\n])/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  const lines = [['Mã giao dịch', 'Thời gian (Việt Nam)', 'Nội dung', 'Mã tham chiếu', 'Biến động ví (VNĐ)', 'Trạng thái'].map(cell).join(',')];
  for (const row of rows) lines.push([cell(row.id), cell(subscriptionDateLabel(row.createdAt, true)), cell(row.description), cell(row.referenceId || ''), row.amount.toFixed(2), cell(subscriptionPaymentStatus(row))].join(','));
  return '\uFEFF' + lines.join('\r\n');
}
