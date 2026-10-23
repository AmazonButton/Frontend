import { api } from './api';

export interface StoreWalletInfo {
  id?: string | number;
  storeId: string | number;
  balance: number;
  availableBalance?: number;
  pendingBalance?: number;
  payosPayoutBalance?: number;
  payosPayoutConnected?: boolean;
  bankAccount?: {
    bankName: string;
    bankBin: string;
    accountNumber: string;
    accountHolderName: string;
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
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  note?: string;
}

export interface WalletTransactionItem {
  id: string | number;
  amount: number;
  type: 'ORDER_REVENUE' | 'WITHDRAWAL' | 'FEE' | 'REFUND' | string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
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
}

export const walletService = {
  /**
   * Lấy thông tin ví và số dư khả dụng của cửa hàng
   */
  async getWallet(storeId?: string | number) {
    const res = await api.get('/store/wallet', {
      params: storeId ? { storeId } : undefined,
    });
    return res.data;
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
  async getTransactions(storeId?: string | number) {
    const res = await api.get('/store/wallet/transactions', {
      params: storeId ? { storeId } : undefined,
    });
    return res.data;
  },

  /**
   * Tạo yêu cầu rút tiền tự động qua cổng PayOS Payout
   */
  async requestWithdrawal(data: RequestWithdrawalDto, storeId?: string | number) {
    const idempotencyKey = `wd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload: any = {
      amount: data.amount,
      note: data.note,
    };
    if (data.bankName) payload.bankName = data.bankName;
    if (data.accountNumber) {
      payload.bankAccountNumber = data.accountNumber;
      payload.accountNumber = data.accountNumber;
    }
    if (data.accountHolderName) {
      payload.bankAccountHolder = data.accountHolderName;
      payload.accountHolderName = data.accountHolderName;
    }

    const res = await api.post('/store/wallet/withdrawals', payload, {
      params: storeId ? { storeId } : undefined,
      headers: {
        'idempotency-key': idempotencyKey,
        'x-idempotency-key': idempotencyKey,
      },
    });
    return res.data;
  },

  /**
   * Danh sách các đợt rút tiền của cửa hàng
   */
  async getWithdrawals(storeId?: string | number) {
    const res = await api.get('/store/wallet/withdrawals', {
      params: storeId ? { storeId } : undefined,
    });
    return res.data;
  },

  async lookupBankAccount(bankBin: string, accountNumber: string) {
    const res = await api.post('/stores/bank-accounts/lookup', { bankBin, accountNumber });
    return res.data;
  },

  /**
   * Đồng bộ trạng thái chi tiền trực tiếp từ PayOS
   */
  async syncWithdrawalStatus(withdrawalId: string | number, storeId?: string | number) {
    const res = await api.post(`/store/wallet/withdrawals/${withdrawalId}/sync-status`, {}, {
      params: storeId ? { storeId } : undefined,
    });
    return res.data;
  },
};
