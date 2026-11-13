// Contracts checked against deployed Swagger and backend b03ae5b (12/11/2026).
export interface BankingTransport {
  get(path: string, config?: any): Promise<any>;
  post(path: string, body?: any): Promise<any>;
  patch(path: string, body?: any): Promise<any>;
  delete(path: string): Promise<any>;
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
    expiresAt: string; isExpired: boolean; rejectionReason?: string | null; checkoutUrl?: string | null };
}
export interface CustomerBankHistory extends RefundSummary {
  sessionId: string; sessionReference: string; orderCode?: string | null; sessionStatus: string;
  verificationStatus: string; paymentReceived: boolean; receivedAmount: number | null;
  refundStatus: string; expiresAt: string; verifiedAt?: string | null; createdAt: string;
  accountId?: string | null; bankBin?: string | null; bankName?: string | null;
  accountNumberMasked?: string | null; accountName?: string | null; checkoutUrl?: string | null;
}
export interface StoreBankTransaction {
  verificationId: string; bankAccountId: string; storeId: string; bankName: string;
  accountNumberMasked: string; accountName: string; referenceCode: string;
  expectedAmount: number; actualAmount: number | null; status: string; refundStatus: string;
  expiresAt: string; verifiedAt?: string | null; createdAt: string;
  recipientBankBin?: string; recipientBankName?: string; recipientAccountNumber?: string;
  recipientAccountHolder?: string; qrCodeUrl?: string; checkoutUrl?: string; instructions?: string; failureReason?: string | null;
}
export interface BankingPage<T> { items: T[]; page: number; pageSize: number; total: number; pages: number }

// Verification and refund are separate outcomes, even when the transaction's
// overall status advances to REFUND_PENDING or REFUNDED.
export function storeVerificationStatus(transaction: StoreBankTransaction) {
  return ['VERIFIED', 'REFUND_PENDING', 'REFUNDED'].includes(transaction.status) ? 'VERIFIED' : transaction.status;
}
export function storeBankNeedsPolling(transaction: StoreBankTransaction, now = Date.now()) {
  return (transaction.status === 'PENDING' && !bankSessionExpired(transaction.expiresAt, now))
    || ['PENDING', 'PENDING_REFUND', 'PROCESSING', 'PROCESSING_REFUND', 'FAILED_RETRY', 'PENDING_RECONCILIATION'].includes(transaction.refundStatus);
}
export function bankRefundMessage(status: string | null | undefined, amount: unknown) {
  const value = bankMoney(amount);
  status = status === 'PENDING_REFUND' ? 'PENDING' : status === 'PROCESSING_REFUND' ? 'PROCESSING' : status;
  return ({
    PENDING: `Hệ thống đang chờ chuyển hoàn ${value}.`,
    PROCESSING: `Hệ thống đang xử lý chuyển hoàn ${value}; chưa xác nhận tiền đã về tài khoản.`,
    PENDING_RECONCILIATION: `Khoản hoàn ${value} đang chờ đối soát kết quả chi trả.`,
    PENDING_MANUAL_REFUND: `Khoản hoàn ${value} đang chờ xử lý hoàn thủ công (thiếu thông tin tài khoản nguồn hoặc cần đối soát); vui lòng liên hệ hỗ trợ nếu cần.`,
    PARTIALLY_REFUNDED: `Hệ thống đã hoàn một phần cho ${value}; phần còn lại đang được xử lý.`,
    FAILED_RETRY: `Khoản hoàn ${value} đang chờ hệ thống tự động thử lại.`,
    SUCCESS: `Hệ thống đã xác nhận hoàn ${value}.`,
    REFUNDED: `Hệ thống đã xác nhận hoàn ${value}.`,
    REFUND_FAILED: `Khoản hoàn ${value} chưa thành công. Kiểm tra lại trạng thái hoặc liên hệ hỗ trợ.`,
    FAILED: `Khoản hoàn ${value} chưa thành công. Kiểm tra lại trạng thái hoặc liên hệ hỗ trợ.`,
    NONE: 'Chưa ghi nhận yêu cầu hoàn tiền cho giao dịch này.',
  } as Record<string, string>)[status || ''] || 'Kết quả hoàn tiền được cập nhật riêng sau khi hệ thống xử lý; chưa có xác nhận hoàn thành.';
}

export function storeFailureMessage(reason?: string | null) {
  return ({
    SENDER_ACCOUNT_UNVERIFIABLE: 'Chưa nhận được số tài khoản chuyển tiền đầy đủ từ PayOS/ngân hàng (hoặc bị che dấu *). Nếu bạn đã chuyển 2.000 ₫, khoản tiền đang chờ hỗ trợ hoàn thủ công.',
    SENDER_ACCOUNT_MISMATCH: 'Số tài khoản chuyển tiền không khớp với tài khoản cửa hàng đang xác minh.',
    SENDER_BANK_MISMATCH: 'Ngân hàng chuyển tiền không khớp với ngân hàng đã đăng ký xác minh.',
    AMOUNT_MISMATCH: 'Số tiền nhận được không khớp đúng số tiền yêu cầu xác minh.',
    EXPIRED: 'Giao dịch được ghi nhận sau khi phiên xác minh đã hết hạn.',
    USER_CANCELLED: 'Yêu cầu xác minh đã được hủy.',
    DESTINATION_BANK_UNVERIFIABLE: 'Chưa xác thực được ngân hàng nhận tiền xác minh từ cổng thanh toán.',
    DESTINATION_ACCOUNT_UNVERIFIABLE: 'Chưa xác thực được số tài khoản nhận tiền xác minh từ cổng thanh toán.',
    DESTINATION_BANK_MISMATCH: 'Ngân hàng nhận tiền giao dịch không khớp kênh nhận xác minh của hệ thống.',
    DESTINATION_ACCOUNT_MISMATCH: 'Tài khoản nhận tiền giao dịch không khớp kênh nhận xác minh của hệ thống.',
    DUPLICATE_PROVIDER_TRANSACTION: 'Mã giao dịch ngân hàng này đã được ghi nhận cho một phiên xác minh khác.',
  } as Record<string, string>)[reason || ''] || (reason ? `Lý do: ${reason}` : 'Yêu cầu xác minh chưa thành công.');
}
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
/** A saved payment link is usable only while the server still expects this account's payment. */
export function customerBankCheckout(status: CustomerBankStatus | null, checkout: CustomerBankSession | null, now = Date.now()) {
  if (!status || status.accountVerificationStatus === 'VERIFIED') return null;
  const session = status.session;
  const matchingCheckout = checkout?.accountId === status.accountId
    && (!session || checkout.sessionReference === session.sessionReference) ? checkout : null;
  const current = session || matchingCheckout;
  if (!current || !current.sessionReference || current.sessionStatus !== 'ACTIVE'
    || current.verificationStatus !== 'PENDING' || bankSessionExpired(current.expiresAt, now)
    || (session && (session.isExpired || session.paymentStatus !== 'PENDING'))) return null;
  const url = bankCheckoutUrl(session?.checkoutUrl || matchingCheckout?.checkoutUrl);
  return url ? { url, expiresAt: current.expiresAt, amount: matchingCheckout?.amount ?? null } : null;
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
  const waitingForActivation = ['PAID', 'PENDING_RECONCILIATION'].includes(session.paymentStatus)
    && status?.accountVerificationStatus !== 'VERIFIED';
  return waitingForPayment || waitingForActivation || ['PENDING_REFUND', 'PROCESSING_REFUND', 'PARTIALLY_REFUNDED'].includes(session.refundStatus)
    || session.paymentStatus === 'PENDING_RECONCILIATION';
}
/** Resume an existing server session after reload/PayOS return, without creating a payment. */
export function customerBankResumeAccount(accounts: CustomerBankAccount[], history: CustomerBankHistory[]) {
  const active = history.find(item => item.accountId && accounts.some(acc => acc.id === item.accountId && acc.verificationStatus !== 'VERIFIED')
    && item.sessionStatus === 'ACTIVE' && item.verificationStatus === 'PENDING' && !bankSessionExpired(item.expiresAt));
  if (active) {
    const acc = accounts.find(a => a.id === active.accountId);
    if (acc) return acc;
  }
  const pending = history.filter(item => item.accountId && accounts.some(account => account.id === item.accountId)
    && (item.verificationStatus === 'PENDING' || item.verificationStatus === 'PENDING_SOURCE_EVIDENCE'
      || ['PENDING_REFUND', 'PROCESSING_REFUND', 'PARTIALLY_REFUNDED'].includes(item.refundStatus)));
  pending.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return accounts.find(account => account.id === pending[0]?.accountId) || null;
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
    PENDING_RECONCILIATION: 'Chờ đối soát', MANUAL_RECONCILIATION_REQUIRED: 'Cần đối soát thủ công', NONE: 'Chưa ghi nhận hoàn tiền', PENDING_REFUND: 'Chờ hoàn tiền',
    PROCESSING_REFUND: 'Đang hoàn tiền', PROCESSING: 'Đang xử lý', PARTIALLY_REFUNDED: 'Đã hoàn một phần',
    PENDING_MANUAL_REFUND: 'Chờ hỗ trợ hoàn tiền', REFUND_FAILED: 'Hoàn tiền chưa thành công',
    REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền', SUCCESS: 'Thành công', SUSPENDED: 'Tạm khóa', REVOKED: 'Đã thu hồi',
    FAILED_RETRY: 'Đang chờ thử lại',
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
    async setDefaultCustomerAccount(accountId: string) {
      const id = bankingId(accountId);
      const account = data<CustomerBankAccount>(await transport.patch(`/customers/me/bank-accounts/${id}/default`, {}));
      if (String(account?.id) !== id || account.verificationStatus !== 'VERIFIED' || account.isDefault !== true) {
        throw new Error('Chưa xác nhận được tài khoản mặc định. Hãy tải lại danh sách để kiểm tra.');
      }
      return account;
    },
    async removeCustomerAccount(accountId: string) {
      const result = data<{ success: boolean; message?: string }>(await transport.delete(`/customers/me/bank-accounts/${bankingId(accountId)}`));
      if (result?.success !== true) throw new Error('Chưa xác nhận được kết quả xóa. Hãy tải lại danh sách để kiểm tra.');
    },
    async initiateCustomerVerification(accountId: string) {
      const session = data<CustomerBankSession>(await transport.post(`/customers/me/bank-accounts/${bankingId(accountId)}/initiate-verification`, {}));
      if (String(session?.accountId) !== accountId || !session.verificationStatus) throw new Error('Phiên xác minh không khớp tài khoản đã chọn. Hãy kiểm tra trạng thái trước khi thử lại.');
      if (session.verificationStatus !== 'VERIFIED' && (!bankCheckoutUrl(session.checkoutUrl) || (!Number.isSafeInteger(session.amount) || session.amount <= 0)
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
      const result = bankingPage<StoreBankTransaction>(await transport.get(`/stores/${bankingId(storeId)}/bank-account-verifications`, { params: { page, pageSize: 10, ...(status ? { status } : {}) } }));
      if (result.items.some(item => String(item.storeId) !== storeId || !/^[1-9]\d*$/.test(String(item.verificationId)))) throw new Error('Lịch sử xác minh không thuộc cửa hàng hiện tại.');
      return result;
    },
    async pendingStoreVerification(storeId: string) {
      const result = bankingPage<StoreBankTransaction>(await transport.get(`/stores/${bankingId(storeId)}/bank-account-verifications`, { params: { page: 1, pageSize: 10, status: 'PENDING' } }));
      if (result.items.some(item => String(item.storeId) !== storeId)) throw new Error('Lịch sử xác minh không thuộc cửa hàng hiện tại.');
      const latest = result.items.find(item => item.status === 'PENDING');
      if (!latest) return null;
      const current = data<StoreBankTransaction>(await transport.get(`/bank-account-verifications/${bankingId(latest.verificationId)}`));
      if (String(current?.storeId) !== storeId || String(current?.verificationId) !== String(latest.verificationId)) throw new Error('Phiên xác minh không thuộc cửa hàng hiện tại.');
      return current.status === 'PENDING' ? current : null;
    },
    async storeDetail(storeId: string, verificationId: string) {
      const transaction = data<StoreBankTransaction>(await transport.get(`/bank-account-verifications/${bankingId(verificationId)}`));
      if (String(transaction?.storeId) !== storeId || String(transaction?.verificationId) !== verificationId) throw new Error('Giao dịch xác minh không thuộc cửa hàng hiện tại.');
      return transaction;
    },
  };
}
