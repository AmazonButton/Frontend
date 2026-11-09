import type { FinanceBankAccount } from './store-finance-flow';

export interface PendingWithdrawal {
  key: string;
  amount: number;
  accountId: string | null;
  createdAt: number;
}

// The current withdrawal DTO cannot select bankAccountId. Resolve a verified
// default (or the only verified account) rather than guessing among accounts.
export function withdrawalRecipient(accounts: FinanceBankAccount[], storeId: string): FinanceBankAccount | null {
  if (!Array.isArray(accounts) || accounts.some(account => String(account.storeId) !== storeId
    || !/^[1-9]\d*$/.test(String(account.id)))) throw new Error('Danh sách ngân hàng không thuộc cửa hàng hiện tại.');
  const verified = accounts.filter(account => account.verificationStatus === 'OWNERSHIP_VERIFIED');
  const defaults = verified.filter(account => account.isDefault === true);
  const recipient = defaults.length === 1 ? defaults[0] : defaults.length === 0 && verified.length === 1 ? verified[0] : null;
  if (recipient && (!recipient.bankName || !recipient.accountNumberMasked || !recipient.accountName)) {
    throw new Error('Chưa có đầy đủ thông tin tài khoản nhận tiền từ hệ thống.');
  }
  return recipient;
}

// Only request metadata is persisted, never a full bank account number.
export function readPendingWithdrawal(value: string | null): PendingWithdrawal | null {
  if (!value) return null;
  const pending = JSON.parse(value);
  if (!pending || !/^[A-Za-z0-9._:-]{1,128}$/.test(pending.key)
    || !Number.isSafeInteger(pending.amount) || pending.amount < 50000
    || !(pending.accountId === null || /^[1-9]\d*$/.test(pending.accountId)) || !Number.isFinite(pending.createdAt)) {
    throw new Error('Không đọc được yêu cầu rút tiền đang chờ. Vui lòng liên hệ hỗ trợ trước khi tạo lệnh khác.');
  }
  return { key: pending.key, amount: pending.amount, accountId: pending.accountId, createdAt: pending.createdAt };
}

export function withdrawalStatusLabel(status?: string) {
  return ({ PENDING: 'Chờ xử lý', PROCESSING: 'Đang chuyển tiền', COMPLETED: 'Đã chuyển thành công',
    SUCCEEDED: 'Đã chuyển thành công', REJECTED: 'Đã từ chối', FAILED: 'Không thành công',
    CANCELLED: 'Đã hủy' } as Record<string, string>)[status || ''] || (status ? `Trạng thái: ${status}` : 'Chưa có trạng thái xác nhận');
}
