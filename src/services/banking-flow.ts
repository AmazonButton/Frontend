// Contracts checked against deployed Swagger and AmazonButton/Backend main (08/11/2026).
export interface BankingTransport {
  get(path: string, config?: any): Promise<any>;
  post(path: string, body?: any): Promise<any>;
}
export interface BankOption { bin: string; code: string; name: string; shortName: string }
export interface CustomerBankAccount {
  id: string; bankBin: string; bankCode?: string; bankName: string;
  accountNumberMasked: string; accountName: string; verificationStatus: string; isDefault: boolean;
}
export interface CustomerBankSession {
  accountId: string; sessionReference: string; orderCode: string; checkoutUrl: string;
  amount: number; sessionStatus: string; verificationStatus: string; expiresAt: string;
}
export interface RefundSummary { totalObligationAmount: number; totalRefundedAmount: number; totalPendingRefundAmount: number }
export interface CustomerBankStatus {
  accountId: string; accountVerificationStatus: string; message: string;
  session: null | { sessionReference: string; sessionStatus: string; verificationStatus: string;
    paymentStatus: string; refundStatus: string; refundSummary: RefundSummary;
    expiresAt: string; isExpired: boolean; rejectionReason?: string | null };
}
export interface CustomerBankHistory extends RefundSummary {
  sessionId: string; sessionReference: string; orderCode?: string | null; sessionStatus: string;
  verificationStatus: string; paymentReceived: boolean; receivedAmount: number | null;
  refundStatus: string; expiresAt: string; verifiedAt?: string | null; createdAt: string;
}
export interface StoreBankTransaction {
  verificationId: string; bankAccountId: string; storeId: string; bankName: string;
  accountNumberMasked: string; accountName: string; referenceCode: string;
  expectedAmount: number; actualAmount: number | null; status: string; refundStatus: string;
  expiresAt: string; verifiedAt?: string | null; createdAt: string;
}
export interface BankingPage<T> { items: T[]; page: number; pageSize: number; total: number; pages: number }

export function bankingId(value: unknown) {
  const id = String(value ?? '');
  if (!/^[1-9]\d*$/.test(id)) throw new Error('Không tìm thấy tài khoản hoặc cửa hàng hợp lệ.');
  return id;
}
function data<T>(response: any): T {
  if (!response?.data || response.data.success === false || response.data.data == null) {
    const message = response?.data?.message;
    throw new Error(typeof message === 'string' ? message : 'Chưa nhận được dữ liệu ngân hàng hợp lệ.');
  }
  return response.data.data;
}
export function bankingPage<T>(response: any): BankingPage<T> {
  const items = data<T[]>(response);
  const p = response.data.pagination;
  const total = p?.totalItems ?? p?.total;
  if (!Array.isArray(items) || !Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(p?.page)
    || p.page < 1 || !Number.isSafeInteger(p?.pageSize) || p.pageSize < 1) throw new Error('Dữ liệu phân trang ngân hàng chưa đầy đủ.');
  return { items, page: p.page, pageSize: p.pageSize, total, pages: Math.max(1, Math.ceil(total / p.pageSize)) };
}
export function bankCheckoutUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (url.hostname === 'payos.vn' || url.hostname.endsWith('.payos.vn')) ? url.href : null;
  } catch { return null; }
}
export function bankSessionExpired(expiresAt?: string, now = Date.now()) {
  const expiry = Date.parse(expiresAt || '');
  return !Number.isFinite(expiry) || expiry <= now;
}
export function customerBankPayload(bank: BankOption, number: string, name: string, isDefault: boolean) {
  if (!bank || !/^\d{6}$/.test(bank.bin)) throw new Error('Vui lòng chọn ngân hàng.');
  const accountNumber = number.trim();
  if (!/^\d{6,20}$/.test(accountNumber)) throw new Error('Số tài khoản phải gồm từ 6 đến 20 chữ số.');
  const accountName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!/^[A-Z ]{2,150}$/.test(accountName)) throw new Error('Vui lòng nhập tên chủ tài khoản bằng chữ, đúng tên tại ngân hàng.');
  return { bankBin: bank.bin, bankCode: bank.code, bankName: bank.name, accountNumber, accountName, isDefault };
}
export function customerBankNeedsPolling(status: CustomerBankStatus | null, now = Date.now()) {
  const session = status?.session;
  if (!session) return false;
  const waitingForPayment = session.sessionStatus === 'ACTIVE' && !session.isExpired && !bankSessionExpired(session.expiresAt, now)
    && status?.accountVerificationStatus !== 'VERIFIED';
  return waitingForPayment || ['PENDING_REFUND', 'PROCESSING_REFUND', 'PARTIALLY_REFUNDED'].includes(session.refundStatus)
    || session.paymentStatus === 'PENDING_RECONCILIATION';
}
export const bankMoney = (value: unknown) => value !== null && value !== undefined && Number.isFinite(Number(value))
  ? `${Number(value).toLocaleString('vi-VN')} ₫` : '—';
export const bankDate = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
export function bankStatusLabel(value?: string | null) {
  return ({ VERIFIED: 'Đã xác minh', OWNERSHIP_VERIFIED: 'Đã xác minh chính chủ', UNVERIFIED: 'Chưa xác minh',
    PENDING: 'Chờ xác minh', ACTIVE: 'Đang chờ', CONSUMED: 'Đã hoàn tất phiên', EXPIRED: 'Đã hết hạn',
    CANCELLED: 'Đã hủy', CANCELED: 'Đã hủy', FAILED: 'Không thành công', FAILED_MISMATCH: 'Thông tin không khớp',
    PENDING_SOURCE_EVIDENCE: 'Cần đối chiếu tài khoản nguồn', PAID: 'Đã nhận tiền',
    PENDING_RECONCILIATION: 'Chờ đối soát', NONE: 'Chưa ghi nhận hoàn tiền', PENDING_REFUND: 'Chờ hoàn tiền',
    PROCESSING_REFUND: 'Đang hoàn tiền', PROCESSING: 'Đang xử lý', PARTIALLY_REFUNDED: 'Đã hoàn một phần',
    PENDING_MANUAL_REFUND: 'Chờ hỗ trợ hoàn tiền', REFUND_FAILED: 'Hoàn tiền chưa thành công',
    REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền', SUCCESS: 'Thành công', SUSPENDED: 'Tạm khóa', REVOKED: 'Đã thu hồi',
  } as Record<string, string>)[value || ''] || (value ? `Trạng thái: ${value}` : 'Chưa có dữ liệu');
}
export function createBankingFlow(transport: BankingTransport) {
  return {
    async banks() {
      const list = data<BankOption[]>(await transport.get('/banks'));
      if (!Array.isArray(list)) throw new Error('Chưa tải được danh sách ngân hàng.');
      return list;
    },
    async customerAccounts() {
      const list = data<CustomerBankAccount[]>(await transport.get('/customers/me/bank-accounts'));
      if (!Array.isArray(list)) throw new Error('Chưa tải được tài khoản ngân hàng.');
      return list;
    },
    async addCustomerAccount(payload: ReturnType<typeof customerBankPayload>) {
      const account = data<CustomerBankAccount>(await transport.post('/customers/me/bank-accounts', payload));
      bankingId(account?.id);
      return account;
    },
    async initiateCustomerVerification(accountId: string) {
      const session = data<CustomerBankSession>(await transport.post(`/customers/me/bank-accounts/${bankingId(accountId)}/initiate-verification`, {}));
      if (String(session?.accountId) !== accountId || !session.verificationStatus) throw new Error('Phiên xác minh không khớp tài khoản đã chọn. Hãy kiểm tra trạng thái trước khi thử lại.');
      if (session.verificationStatus !== 'VERIFIED' && (!bankCheckoutUrl(session.checkoutUrl) || session.amount !== 2000
        || !session.sessionReference || !Number.isFinite(Date.parse(session.expiresAt)))) throw new Error('Hướng dẫn thanh toán chưa hợp lệ. Hãy kiểm tra trạng thái trước khi thử lại.');
      return session;
    },
    async customerStatus(accountId: string) {
      const status = data<CustomerBankStatus>(await transport.get(`/customers/me/bank-accounts/${bankingId(accountId)}/verification-status`));
      if (String(status?.accountId) !== accountId || !status.accountVerificationStatus) throw new Error('Kết quả xác minh không khớp tài khoản.');
      return status;
    },
    async customerHistory(page = 1) {
      return bankingPage<CustomerBankHistory>(await transport.get('/customers/me/bank-accounts/verification-history', { params: { page, pageSize: 10 } }));
    },
    async storeHistory(storeId: string, page = 1, status = '') {
      return bankingPage<StoreBankTransaction>(await transport.get(`/stores/${bankingId(storeId)}/bank-account-verifications`, { params: { page, pageSize: 10, ...(status ? { status } : {}) } }));
    },
    async storeDetail(storeId: string, verificationId: string) {
      const transaction = data<StoreBankTransaction>(await transport.get(`/bank-account-verifications/${bankingId(verificationId)}`));
      if (String(transaction?.storeId) !== storeId || String(transaction?.verificationId) !== verificationId) throw new Error('Giao dịch xác minh không thuộc cửa hàng hiện tại.');
      return transaction;
    },
  };
}
