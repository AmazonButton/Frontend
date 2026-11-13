export interface FinanceBank {
  bin: string;
  code: string;
  name: string;
  shortName: string;
  lookupSupported?: boolean;
  transferSupported?: boolean;
}

export interface FinanceBankAccount {
  id: string;
  storeId: string;
  bankBin: string;
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
  verificationStatus: string;
  isDefault: boolean;
  verifiedAt?: string | null;
}

export interface FinanceVerification {
  verificationId: string;
  bankAccountId: string;
  bankName: string;
  accountNumberMasked: string;
  accountName: string;
  amount: number;
  referenceCode: string;
  expiresAt: string;
  instructions: string;
  recipientBankBin?: string;
  recipientBankName?: string;
  recipientAccountNumber?: string;
  recipientAccountHolder?: string;
  qrCodeUrl?: string;
  checkoutUrl?: string;
  initialAccountStatus?: string;
}

interface FinanceTransport {
  get: (path: string, config?: any) => Promise<any>;
  post: (path: string, body?: any) => Promise<any>;
  patch: (path: string, body?: any) => Promise<any>;
  delete: (path: string) => Promise<any>;
}

export function financeError(error: any, fallback = 'Chưa thể hoàn tất thao tác. Vui lòng thử lại.') {
  const message = error?.response?.data?.message || error?.message;
  if (Array.isArray(message)) return message.filter(item => typeof item === 'string').join('. ') || fallback;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function financeLookupError(error: any) {
  const code = error?.response?.data?.errorCode || error?.response?.data?.code;
  if (code === 'BANK_LOOKUP_SERVICE_UNAVAILABLE') {
    return `${financeError(error, 'Dịch vụ tra cứu ngân hàng chưa sẵn sàng.')} Chưa thể xác minh tên chủ tài khoản. Vui lòng thử lại sau hoặc gửi mã BANK_LOOKUP_SERVICE_UNAVAILABLE cho bộ phận hỗ trợ.`;
  }
  if (code === 'BANK_LOOKUP_UNAVAILABLE') {
    return 'Hệ thống chưa tra cứu được tên chủ tài khoản từ dịch vụ ngân hàng. Hãy kiểm tra lại ngân hàng và số tài khoản. Nếu thông tin đã đúng, vui lòng thử lại sau hoặc gửi mã BANK_LOOKUP_UNAVAILABLE cho bộ phận hỗ trợ. Chưa thể tạo yêu cầu xác minh.';
  }
  if (code === 'ACCOUNT_NAME_UNRESOLVED') {
    return 'Dịch vụ tra cứu tên chủ tài khoản tự động hiện không khả dụng ở gói ngân hàng hiện tại. Hãy nhập đúng tên chủ tài khoản để tiếp tục xác minh qua chuyển khoản 2.000 ₫.';
  }
  return financeError(error);
}

export function financeData<T>(response: any): T {
  const envelope = response?.data;
  if (!envelope || envelope.success === false) throw new Error(financeError({ response: { data: envelope } }));
  return envelope.data as T;
}

function positiveId(value: unknown) {
  const id = String(value ?? '');
  if (!/^[1-9]\d*$/.test(id)) throw new Error('Không tìm thấy thông tin cửa hàng hoặc tài khoản hợp lệ.');
  return id;
}

export function financeStoreId(user: any): string | null {
  const candidate = user?.storeId || user?.store?.storeId || user?.store?.id || user?.ownedStores?.[0]?.storeId;
  return candidate && /^[1-9]\d*$/.test(String(candidate)) ? String(candidate) : null;
}

export function bankVerificationPayload(storeId: string, bankBin: string, accountNumber: string, accountName?: string) {
  const account = accountNumber.trim();
  if (!/^[0-9]{6}$/.test(bankBin)) throw new Error('Vui lòng chọn ngân hàng.');
  if (!/^[0-9]{6,19}$/.test(account)) throw new Error('Số tài khoản cần có từ 6 đến 19 chữ số, không có khoảng trắng.');
  const normalizedName = accountName?.trim()
    ? accountName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').trim().replace(/\s+/g, ' ').toUpperCase()
    : '';
  if (accountName !== undefined && !/^[A-Z ]{2,150}$/.test(normalizedName)) {
    throw new Error('Vui lòng nhập tên chủ tài khoản bằng chữ, đúng tên tại ngân hàng.');
  }
  return normalizedName
    ? { storeId: positiveId(storeId), bankBin, accountNumber: account, accountName: normalizedName }
    : { storeId: positiveId(storeId), bankBin, accountNumber: account };
}

export function canSetFinanceDefault(account: FinanceBankAccount) {
  return account.verificationStatus === 'OWNERSHIP_VERIFIED' && !account.isDefault;
}

export function financeVerificationExpired(request: FinanceVerification, now = Date.now()) {
  const expiry = Date.parse(request.expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

export function financeVerificationKey(userId: string, storeId: string) {
  return `smart_order_bank_verification:${userId}:${storeId}`;
}

export function readFinanceVerification(value: string | null): FinanceVerification | null {
  if (!value) return null;
  try {
    const request = JSON.parse(value);
    if (!request || !/^[1-9]\d*$/.test(request.verificationId) || !/^[1-9]\d*$/.test(request.bankAccountId)
      || !Number.isFinite(request.amount) || request.amount <= 0 || !Number.isFinite(Date.parse(request.expiresAt))
      || !['bankName', 'accountNumberMasked', 'accountName', 'referenceCode', 'instructions'].every(key => typeof request[key] === 'string')) return null;
    return request;
  } catch { return null; }
}

// Uses existing controller contracts. A user-entered name is sent only after
// ACCOUNT_NAME_UNRESOLVED; the backend still decides ownership and the amount.
export function createStoreFinanceFlow(transport: FinanceTransport) {
  return {
    async currentSubscription() { return financeData<any>(await transport.get('/store/subscriptions/current')); },
    async banks() {
      const list = financeData<FinanceBank[]>(await transport.get('/banks'));
      if (!Array.isArray(list)) throw new Error('Danh sách ngân hàng chưa sẵn sàng.');
      return list;
    },
    async accounts(storeId: string) {
      const list = financeData<FinanceBankAccount[]>(await transport.get(`/stores/${positiveId(storeId)}/bank-accounts`));
      if (!Array.isArray(list)) throw new Error('Chưa nhận được danh sách tài khoản ngân hàng.');
      return list;
    },
    async lookup(bankBin: string, accountNumber: string) {
      const { storeId: _, ...payload } = bankVerificationPayload('1', bankBin, accountNumber);
      const result = financeData<{ bankBin: string; bankName: string; accountNumberMasked: string; accountName: string }>(await transport.post('/stores/bank-accounts/lookup', payload));
      if (!result?.accountName || result.bankBin !== bankBin) throw new Error('Chưa xác nhận được tên chủ tài khoản. Vui lòng kiểm tra lại.');
      return result;
    },
    async verify(storeId: string, bankBin: string, accountNumber: string, accountName?: string) {
      const result = financeData<FinanceVerification>(await transport.post('/stores/bank-accounts/verification', bankVerificationPayload(storeId, bankBin, accountNumber, accountName)));
      const validated = readFinanceVerification(JSON.stringify(result));
      if (!validated) throw new Error('Yêu cầu đã gửi nhưng thông tin hướng dẫn chưa đầy đủ. Hãy tải lại tài khoản trước khi thử lại.');
      return validated;
    },
    async setDefault(storeId: string, accountId: string) {
      const response = await transport.patch(`/stores/${positiveId(storeId)}/bank-accounts/${positiveId(accountId)}/default`, {});
      financeData(response);
    },
    async remove(storeId: string, accountId: string) {
      const response = await transport.delete(`/stores/${positiveId(storeId)}/bank-accounts/${positiveId(accountId)}`);
      financeData(response);
    },
    async cancel(verificationId: string) {
      const response = await transport.post(`/stores/bank-accounts/verification/${positiveId(verificationId)}/cancel`, {});
      financeData(response);
    },
  };
}
