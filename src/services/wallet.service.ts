import { api } from './api';
import { normalizeWalletInfo, normalizeWalletHistory, walletEnvelope } from './wallet-api-data';

export interface StoreWalletInfo {
  id?: string | number;
  storeId: string | number;
  balance: number;
  availableBalance?: number;
  pendingBalance?: number;
  frozenBalance?: number;
  payosPayoutBalance?: number;
  payosPayoutConnected?: boolean;
  bankAccount?: {
    bankName: string;
    bankBin: string;
    accountNumber: string;
    accountHolderName: string;
    isMasked?: boolean;
    verificationStatus?: string;
  };
  updatedAt?: string;
}

export interface UpdateBankAccountDto {
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface RequestWithdrawalDto {
  amount: number;
  idempotencyKey: string;
  bankAccountId?: string;
}

export interface WalletTransactionItem {
  id: string | number;
  amount: number;
  type: 'ORDER_REVENUE' | 'WITHDRAWAL' | 'FEE' | 'REFUND' | string;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  description?: string;
  createdAt: string;
}

export interface WithdrawalItem {
  id: string | number;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED' | string;
  referenceId?: string;
  payoutId?: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  note?: string;
  payoutRef?: string;
  createdAt: string;
  processedAt?: string;
  fee?: number;
  netAmount?: number;
  withdrawalCode?: string;
  providerPayoutId?: string | null;
  failureReason?: string | null;
  rejectionReason?: string | null;
}

export const walletService = {
  /**
   * Lấy thông tin ví và số dư khả dụng của cửa hàng
   */
  async getWallet(storeId?: string | number) {
    const res = await api.get('/store/wallet', {
      params: storeId ? { storeId } : undefined,
    });
    const response = walletEnvelope(res.data);
    return { ...response, data: normalizeWalletInfo(response.data) };
  },

  /**
   * Cập nhật tài khoản ngân hàng thụ hưởng nhận tiền rút
   */
  async updateBankAccount(data: UpdateBankAccountDto, storeId?: string | number) {
    // Backend.git DTO: { bankName, bankAccountNumber, bankAccountHolder }
    // Main.git DTO:    { bankName, bankBin, accountNumber, accountHolderName }
    try {
      const res = await api.put('/store/wallet/bank-account', {
        bankName: data.bankName,
        bankBin: data.bankBin,
        bankAccountNumber: data.accountNumber,
        bankAccountHolder: data.accountHolderName,
      }, {
        params: storeId ? { storeId } : undefined,
      });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 400) {
        const res = await api.put('/store/wallet/bank-account', {
          bankName: data.bankName,
          bankBin: data.bankBin,
          accountNumber: data.accountNumber,
          accountHolderName: data.accountHolderName,
        }, {
          params: storeId ? { storeId } : undefined,
        });
        return res.data;
      }
      throw err;
    }
  },

  /**
   * Lấy danh sách lịch sử biến động số dư ví
   */
  async getTransactions(storeId?: string | number, page = 1) {
    const res = await api.get('/store/wallet/transactions', {
      params: { ...(storeId ? { storeId } : {}), page, pageSize: 20 },
    });
    return normalizeWalletHistory(res.data, 'transactions');
  },

  /**
   * Tạo yêu cầu rút tiền; backend xác nhận trạng thái xử lý và chi tiền.
   */
  async requestWithdrawal(data: RequestWithdrawalDto, storeId?: string | number) {
    const idempotencyKey = data.idempotencyKey;
    if (!Number.isSafeInteger(data.amount) || data.amount < 50000 || !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey || '')) {
      throw new Error('Yêu cầu rút tiền chưa hợp lệ.');
    }
    if (data.bankAccountId !== undefined && !/^[1-9]\d*$/.test(data.bankAccountId)) {
      throw new Error('Tài khoản nhận tiền không hợp lệ.');
    }
    const payload = { amount: data.amount, ...(data.bankAccountId ? { bankAccountId: data.bankAccountId } : {}) };

    const res = await api.post('/store/wallet/withdrawals', payload, {
      params: storeId ? { storeId } : undefined,
      headers: {
        'idempotency-key': idempotencyKey,
        'x-idempotency-key': idempotencyKey,
      },
    });
    return walletEnvelope(res.data);
  },

  /**
   * Danh sách các đợt rút tiền của cửa hàng
   */
  async getWithdrawals(storeId?: string | number, page = 1) {
    const res = await api.get('/store/wallet/withdrawals', {
      params: { ...(storeId ? { storeId } : {}), page, pageSize: 20 },
    });
    return normalizeWalletHistory(res.data, 'withdrawals');
  },

  async getWithdrawal(withdrawalId: string | number, expectedStoreId: string): Promise<WithdrawalItem> {
    if (!/^[1-9]\d*$/.test(String(withdrawalId))) throw new Error('Mã lệnh rút tiền không hợp lệ.');
    const res = await api.get(`/store/wallet/withdrawals/${withdrawalId}`);
    const envelope = walletEnvelope(res.data);
    if (String(envelope.data?.storeId) !== expectedStoreId || String(envelope.data?.withdrawalId) !== String(withdrawalId)) {
      throw new Error('Lệnh rút tiền không thuộc cửa hàng hiện tại.');
    }
    return normalizeWalletHistory({ ...envelope, data: [envelope.data] }, 'withdrawals').data[0];
  },

  async lookupBankAccount(bankBin: string, accountNumber: string) {
    const res = await api.post('/stores/bank-accounts/lookup', { bankBin, accountNumber });
    return walletEnvelope(res.data);
  },

  /**
   * Đồng bộ trạng thái chi tiền trực tiếp từ PayOS
   */
  async syncWithdrawalStatus(withdrawalId: string | number, storeId?: string | number) {
    const res = await api.post(`/store/wallet/withdrawals/${withdrawalId}/sync-status`, {}, {
      params: storeId ? { storeId } : undefined,
    });
    return walletEnvelope(res.data);
  },
};
