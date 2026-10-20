import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, Landmark, RefreshCw, Wallet } from 'lucide-react';
import { walletService, type StoreWalletInfo, type WalletTransactionItem, type WithdrawalItem } from '../../services/wallet.service';

const money = (value = 0) => `${Number(value).toLocaleString('vi-VN')} ₫`;

export const StoreWalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<StoreWalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [bankName, setBankName] = useState('');
  const [bankBin, setBankBin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [walletRes, transactionsRes, withdrawalsRes] = await Promise.all([
        walletService.getWallet(), walletService.getTransactions(), walletService.getWithdrawals(),
      ]);
      const nextWallet = walletRes.data as StoreWalletInfo;
      setWallet(nextWallet);
      setTransactions(transactionsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
      setBankName(nextWallet.bankAccount?.bankName || '');
      setBankBin(nextWallet.bankAccount?.bankBin || '');
      setAccountNumber(nextWallet.bankAccount?.accountNumber || '');
      setAccountHolderName(nextWallet.bankAccount?.accountHolderName || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải ví cửa hàng. Kiểm tra cấu hình PayOS Payout và API backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveBank = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      await walletService.updateBankAccount({ bankName, bankBin, accountNumber, accountHolderName });
      setNotice('Đã lưu tài khoản nhận tiền.');
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu tài khoản ngân hàng.');
    } finally { setSaving(false); }
  };

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const response = await walletService.requestWithdrawal({ amount: Number(amount) });
      setNotice(response.data?.providerMessage || `Yêu cầu rút tiền đang ở trạng thái ${response.data?.status || 'PENDING'}.`);
      setAmount('');
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'PayOS không thể nhận yêu cầu rút tiền.');
    } finally { setSaving(false); }
  };

  const syncWithdrawal = async (id: string | number) => {
    setSaving(true);
    try {
      await walletService.syncWithdrawalStatus(id);
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể đồng bộ trạng thái lệnh chi PayOS.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-sm text-zinc-500">Đang tải ví cửa hàng…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 text-zinc-900 dark:text-zinc-100 sm:p-7">
      <header>
        <h1 className="text-xl font-bold">Ví cửa hàng</h1>
        <p className="mt-1 text-sm text-zinc-500">Doanh thu PayOS đã xác minh được ghi vào số dư riêng của cửa hàng.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500"><Wallet className="h-4 w-4" /> Số dư ví cửa hàng</div>
          <div className="mt-4 text-3xl font-bold tabular-nums">{money(wallet?.availableBalance ?? wallet?.balance)}</div>
          <p className="mt-2 text-xs text-zinc-500">Rút được khi tài khoản chi PayOS dùng chung có đủ số dư.</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500"><Landmark className="h-4 w-4" /> Tài khoản chi PayOS dùng chung</div>
          <div className="mt-4 text-3xl font-bold tabular-nums">{wallet?.payosPayoutConnected ? money(wallet.payosPayoutBalance) : 'Chưa kết nối'}</div>
          <p className="mt-2 text-xs text-zinc-500">Số dư thực lấy từ API PayOS; đây là số dư merchant chung, không phải số dư riêng của cửa hàng.</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={saveBank} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">Tài khoản nhận tiền</h2>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tên ngân hàng
            <input required value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Mã BIN ngân hàng (6 số)
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={bankBin} onChange={(e) => setBankBin(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Số tài khoản
            <input required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tên chủ tài khoản
            <input required value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm uppercase dark:border-zinc-700" />
          </label>
          <button disabled={saving} className="rounded-lg bg-[#0E6BA8] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu tài khoản</button>
        </form>

        <form onSubmit={requestWithdrawal} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">Rút tiền qua PayOS</h2>
          <p className="text-xs leading-5 text-zinc-500">Lệnh rút dùng API PayOS Payout thật. PayOS có thể trả trạng thái đang xử lý; hãy đồng bộ lại để cập nhật kết quả.</p>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Số tiền (VNĐ)
            <input required type="number" min="1" step="1" max={wallet?.availableBalance || undefined} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
          </label>
          <button disabled={saving || !wallet?.bankAccount} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"><ArrowDownToLine className="h-4 w-4" /> Tạo lệnh rút</button>
          {!wallet?.bankAccount && <p className="text-xs text-amber-600">Hãy lưu tài khoản nhận tiền trước.</p>}
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 font-semibold dark:border-zinc-800">Lệnh rút PayOS</div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {withdrawals.length === 0 ? <p className="p-5 text-sm text-zinc-500">Chưa có lệnh rút tiền.</p> : withdrawals.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div><div className="font-semibold">{money(item.amount)} · {item.status}</div><div className="mt-1 text-xs text-zinc-500">{item.bankName} · {item.accountNumber} · {new Date(item.createdAt).toLocaleString('vi-VN')}</div></div>
              {['PENDING', 'PROCESSING'].includes(item.status) && <button type="button" disabled={saving} onClick={() => syncWithdrawal(item.id)} className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-700"><RefreshCw className="h-3.5 w-3.5" /> Đồng bộ</button>}
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 font-semibold dark:border-zinc-800">Lịch sử biến động ví</div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {transactions.length === 0 ? <p className="p-5 text-sm text-zinc-500">Chưa có giao dịch. Đơn PayOS được cộng sau khi PayOS xác nhận webhook.</p> : transactions.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div><div className="font-medium">{item.description || item.type}</div><div className="mt-1 text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString('vi-VN')} · {item.status}</div></div>
              <span className={`font-mono font-bold ${item.amount >= 0 ? 'text-emerald-600' : 'text-zinc-700 dark:text-zinc-300'}`}>{item.amount >= 0 ? '+' : ''}{money(item.amount)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
