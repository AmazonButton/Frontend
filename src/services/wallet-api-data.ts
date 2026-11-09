// Read only values returned by wallet APIs. Missing financial values stay unknown.
function amount(value: unknown): number | undefined {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
export function normalizeWalletInfo(raw: any) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !/^[1-9]\d*$/.test(String(raw.storeId))) throw new Error('Thông tin ví từ API chưa hợp lệ.');
  const balance = amount(raw.balance ?? raw.availableBalance);
  const availableBalance = amount(raw.availableBalance ?? raw.balance);
  if (balance === undefined || availableBalance === undefined) throw new Error('API chưa cung cấp số dư ví hợp lệ.');
  const pendingBalance = amount(raw.pendingBalance ?? raw.frozenBalance);
  const saved = raw.bankAccount;
  const accountNumber = saved?.accountNumberMasked || saved?.accountNumber || raw.bankAccountNumberMasked || raw.bankAccountNumber;
  const bankName = saved?.bankName || raw.bankName;
  const accountHolderName = saved?.accountHolderName || raw.bankAccountHolder;
  const bankAccount = accountNumber && bankName && accountHolderName ? {
    bankName: String(bankName), bankBin: String(saved?.bankBin || raw.bankBin || ''),
    accountNumber: String(accountNumber), accountHolderName: String(accountHolderName),
    isMasked: /[*•]/.test(String(accountNumber)), verificationStatus: saved?.verificationStatus,
  } : undefined;
  return { ...raw, id: raw.id ?? raw.walletId, storeId: String(raw.storeId), balance, availableBalance, pendingBalance, bankAccount,
    payosPayoutBalance: amount(raw.payosPayoutBalance),
    payosPayoutConnected: typeof raw.payosPayoutConnected === 'boolean' ? raw.payosPayoutConnected : undefined,
  };
}
export function walletEnvelope(response: any) {
  if (!response || response.success === false || response.data == null) throw new Error(typeof response?.message === 'string' ? response.message : 'Chưa nhận được dữ liệu ví từ API.');
  return response;
}
export function normalizeWalletHistory(response: any, kind: 'transactions' | 'withdrawals') {
  const envelope = walletEnvelope(response);
  if (!Array.isArray(envelope.data)) throw new Error('Lịch sử ví từ API chưa hợp lệ.');
  const data = envelope.data.map((row: any) => {
    const id = row?.id ?? (kind === 'transactions' ? row?.transactionId : row?.withdrawalId);
    const value = amount(row?.amount);
    if (id == null || value === undefined) throw new Error('Chi tiết giao dịch ví từ API chưa đầy đủ.');
    return kind === 'transactions' ? { ...row, id: String(id), amount: value } : {
      ...row, id: String(id), amount: value, accountNumber: row.accountNumber ?? row.bankAccountMasked ?? row.bankAccountNumber,
      accountHolderName: row.accountHolderName ?? row.bankAccountHolder,
      createdAt: row.createdAt ?? row.requestedAt,
    };
  });
  return { ...envelope, data };
}
