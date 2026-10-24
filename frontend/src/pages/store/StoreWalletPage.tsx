import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine,
  Landmark,
  RefreshCw,
  Wallet,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  ChevronDown,
  Search,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  walletService,
  type StoreWalletInfo,
  type WalletTransactionItem,
  type WithdrawalItem,
} from '../../services/wallet.service';
import {
  type VietnameseBank,
} from '../../data/vietnameseBanks';
import { api } from '../../services/api';

const formatVND = (value = 0) => `${Number(value).toLocaleString('vi-VN')} ₫`;

const QUICK_AMOUNTS = [200000, 500000, 1000000, 2000000, 5000000];

export const StoreWalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<StoreWalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);

  // Bank form state
  const [selectedBank, setSelectedBank] = useState<VietnameseBank | null>(null);
  const [banks, setBanks] = useState<VietnameseBank[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [lookingUpAccount, setLookingUpAccount] = useState(false);
  const accountLookupRequestId = useRef(0);
  const [isEditingBank, setIsEditingBank] = useState(false);

  // Withdrawal form state
  const [amount, setAmount] = useState('');
  const [withdrawalNote, setWithdrawalNote] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'WITHDRAWALS' | 'TRANSACTIONS'>('WITHDRAWALS');

  // Filter banks by search
  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return banks;
    const q = bankSearch.toLowerCase().trim();
    return banks.filter(
      (b) =>
        b.shortName.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.bin.includes(q)
    );
  }, [bankSearch, banks]);

  const handleSelectBank = (bank: VietnameseBank) => {
    if (selectedBank?.bin === bank.bin) return;
    accountLookupRequestId.current += 1;
    setSelectedBank(bank);
    setAccountNumber('');
    setAccountHolderName('');
    setLookingUpAccount(false);
    setError(null);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [walletRes, transactionsRes, withdrawalsRes, banksRes] = await Promise.all([
        walletService.getWallet(),
        walletService.getTransactions(),
        walletService.getWithdrawals(),
        api.get('/banks'),
      ]);

      const nextWallet = walletRes.data as StoreWalletInfo;
      setWallet(nextWallet);
      setTransactions(transactionsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
      const realBanks = (banksRes.data?.data || []) as VietnameseBank[];
      setBanks(realBanks);

      if (nextWallet.bankAccount?.bankBin) {
        const matched = realBanks.find((bank) => bank.bin === nextWallet.bankAccount?.bankBin);
        if (matched) setSelectedBank(matched);
        setAccountNumber(nextWallet.bankAccount.accountNumber || '');
        setAccountHolderName(nextWallet.bankAccount.accountHolderName || '');
        setIsEditingBank(false);
      } else {
        setIsEditingBank(true);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Không thể tải dữ liệu ví cửa hàng. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const cleanAccountNumber = accountNumber.trim();
    if (!selectedBank || cleanAccountNumber.length < 5) return;
    const requestId = ++accountLookupRequestId.current;

    const timer = window.setTimeout(async () => {
      setLookingUpAccount(true);
      setError(null);
      try {
        const response = await walletService.lookupBankAccount(selectedBank.bin, cleanAccountNumber);
        if (requestId === accountLookupRequestId.current && response?.data?.accountName) {
          setAccountHolderName(response.data.accountName);
        }
      } catch (err: any) {
        void err // Bank lookup may fail for unknown accounts;
      } finally {
        if (requestId === accountLookupRequestId.current) setLookingUpAccount(false);
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [selectedBank, accountNumber]);

  // Handle save bank info
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank) {
      setError('Vui lòng chọn ngân hàng từ danh sách.');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Vui lòng nhập số tài khoản ngân hàng.');
      return;
    }
    if (!accountHolderName.trim()) {
      setError('Vui lòng nhập họ và tên chủ tài khoản.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await walletService.updateBankAccount({
        bankName: selectedBank.shortName,
        bankBin: selectedBank.bin,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
      });
      setNotice('Đã lưu thông tin tài khoản ngân hàng thụ hưởng thành công!');
      setIsEditingBank(false);
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu tài khoản ngân hàng.');
    } finally {
      setSaving(false);
    }
  };

  // Handle request withdrawal
  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawAmount = Number(amount);
    const available = wallet?.availableBalance ?? wallet?.balance ?? 0;

    if (!withdrawAmount || withdrawAmount <= 0) {
      setError('Vui lòng nhập số tiền hợp lệ lớn hơn 0 ₫.');
      return;
    }
    if (withdrawAmount > available) {
      setError(`Số dư khả dụng không đủ. Bạn chỉ có thể rút tối đa ${formatVND(available)}.`);
      return;
    }
    if (!wallet?.bankAccount?.accountNumber) {
      setError('Vui lòng lưu thông tin tài khoản ngân hàng thụ hưởng trước khi tạo lệnh rút.');
      return;
    }

    setWithdrawing(true);
    setError(null);
    setNotice(null);

    try {
      const response = await walletService.requestWithdrawal({
        amount: withdrawAmount,
        note: withdrawalNote.trim() || undefined,
      });

      const resData = response.data;
      setNotice(
        resData?.providerMessage ||
          `Đã tạo lệnh rút tiền ${formatVND(withdrawAmount)} thành công! Trạng thái: ${
            resData?.status === 'COMPLETED' ? 'Đã chuyển thành công' : 'Đang xử lý chi'
          }.`
      );
      setAmount('');
      setWithdrawalNote('');
      await refresh();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Không thể xử lý yêu cầu rút tiền. Vui lòng kiểm tra lại số dư hoặc cấu hình PayOS Payout.'
      );
    } finally {
      setWithdrawing(false);
    }
  };

  // Handle sync withdrawal status
  const handleSyncWithdrawal = async (id: string | number) => {
    setSyncingId(id);
    try {
      await walletService.syncWithdrawalStatus(id);
      await refresh();
      setNotice('Đã cập nhật trạng thái mới nhất từ PayOS!');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Không thể đồng bộ trạng thái lệnh rút.'
      );
    } finally {
      setSyncingId(null);
    }
  };

  const availableBalance = wallet?.availableBalance ?? wallet?.balance ?? 0;
  const pendingBalance = wallet?.pendingBalance ?? 0;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <RefreshCw className="h-4 w-4 animate-spin text-[#287DA8]" />
          Đang nạp dữ liệu ví cửa hàng...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-zinc-900 dark:text-zinc-100 sm:p-6 lg:p-8">
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Ví Cửa Hàng & Rút Tiền
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              PayOS Payout 24/7
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Doanh thu bán hàng từ nút Smart Order Button được ghi nhận tự động. Bạn có thể rút trực tiếp về tài khoản ngân hàng bất kỳ lúc nào.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </button>
      </div>

      {/* ── Alerts ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-700 backdrop-blur-xs dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 font-medium">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              ✕
            </button>
          </motion.div>
        )}

        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 backdrop-blur-xs dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{notice}</div>
            <button
              onClick={() => setNotice(null)}
              className="text-emerald-600 hover:text-emerald-900"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Balance Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Available Balance */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50/60 p-5 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <Wallet className="h-4 w-4 text-[#287DA8]" />
              Số Dư Khả Dụng
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              Có thể rút ngay
            </span>
          </div>
          <div className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatVND(availableBalance)}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Cộng từ các đơn hàng Smart Button khách đã thanh toán.
          </p>
        </div>

        {/* Pending Balance */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50/60 p-5 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <Clock className="h-4 w-4 text-amber-500" />
              Đang Xử Lý / Giữ Chỗ
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              Tạm giữ
            </span>
          </div>
          <div className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
            {formatVND(pendingBalance)}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Số tiền trong các lệnh rút đang được ngân hàng đối soát.
          </p>
        </div>

        {/* Payout Liquidity Pool */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50/60 p-5 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/40">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <Landmark className="h-4 w-4 text-indigo-500" />
              Hạn Mức Chi PayOS
            </span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
              {wallet?.payosPayoutConnected ? 'Sẵn sàng' : 'Chưa kích hoạt'}
            </span>
          </div>
          <div className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {wallet?.payosPayoutConnected
              ? formatVND(wallet.payosPayoutBalance)
              : '--- ₫'}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Số dư thanh khoản thực trên cổng PayOS giải ngân tự động.
          </p>
        </div>
      </div>

      {/* ── Main Operations Grid ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── LEFT: Bank Account Management (5 cols) ── */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#287DA8]" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Tài Khoản Nhận Tiền
                </h2>
              </div>
              {wallet?.bankAccount && !isEditingBank && (
                <button
                  type="button"
                  onClick={() => setIsEditingBank(true)}
                  className="text-xs font-semibold text-[#287DA8] hover:underline"
                >
                  Thay đổi
                </button>
              )}
            </div>

            {/* If bank is saved and not editing -> Show Sleek Virtual Bank Card */}
            {wallet?.bankAccount && !isEditingBank ? (
              <div className="mt-4 space-y-4">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-[#0B1527] via-[#0F2347] to-[#1E3A8A] p-5 text-white shadow-lg">
                  {/* Card Background Accents */}
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      {selectedBank?.logo ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 p-1 shadow-xs">
                          <img
                            src={selectedBank.logo}
                            alt={selectedBank.shortName}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white">
                          {wallet.bankAccount.bankName}
                        </div>
                        <div className="text-[10px] text-blue-200/80">
                          Mã BIN: {wallet.bankAccount.bankBin}
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-xs">
                      <ShieldCheck className="h-3 w-3" />
                      Đã xác thực
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="text-[10px] font-medium tracking-wider text-blue-200/70 uppercase">
                      Số tài khoản
                    </div>
                    <div className="mt-0.5 font-mono text-xl font-bold tracking-widest text-white">
                      {wallet.bankAccount.accountNumber.replace(
                        /(\d{4})(?=\d)/g,
                        '$1 '
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-3">
                    <div>
                      <div className="text-[9px] font-medium tracking-wider text-blue-200/70 uppercase">
                        Chủ tài khoản
                      </div>
                      <div className="text-xs font-bold tracking-wide uppercase text-white">
                        {wallet.bankAccount.accountHolderName}
                      </div>
                    </div>
                    <div className="text-[10px] font-medium text-blue-200/60">
                      NAPAS 247
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Tiền rút sẽ được chuyển thẳng về tài khoản này qua mạng lưới liên ngân hàng <strong>NAPAS 24/7</strong>.
                  </span>
                </div>
              </div>
            ) : (
              /* Bank Editing Form */
              <form onSubmit={handleSaveBank} className="mt-4 space-y-4">
                {/* Bank Select with Dropdown & Search */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Ngân hàng thụ hưởng <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-xs shadow-2xs hover:border-[#287DA8] focus:outline-hidden focus:ring-2 focus:ring-[#287DA8]/20 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      {selectedBank ? (
                        <div className="flex items-center gap-2.5">
                          <img
                            src={selectedBank.logo}
                            alt={selectedBank.shortName}
                            className="h-5 w-5 object-contain"
                          />
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {selectedBank.shortName}
                            </span>
                            <span className="ml-1.5 text-[11px] text-zinc-400">
                              ({selectedBank.code} - BIN: {selectedBank.bin})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-400">
                          Chọn ngân hàng (Vietcombank, Techcombank, MB...)
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    </button>

                    {/* Dropdown Menu */}
                    {isBankDropdownOpen && (
                      <div className="absolute z-30 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                        <div className="border-b border-zinc-100 p-2 dark:border-zinc-700">
                          <div className="flex items-center gap-2 rounded-lg border border-transparent bg-zinc-100 px-2.5 py-1.5 text-xs transition-colors focus-within:border-[#287DA8]/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#287DA8]/15 dark:bg-zinc-700/60 dark:focus-within:bg-zinc-800">
                            <Search className="h-3.5 w-3.5 text-zinc-400" />
                            <input
                              type="text"
                              value={bankSearch}
                              onChange={(e) => setBankSearch(e.target.value)}
                              placeholder="Tìm tên ngân hàng hoặc mã..."
                              className="w-full min-w-0 bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:outline-none focus:ring-0 dark:text-zinc-100"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-700/40">
                          {filteredBanks.map((b) => (
                            <button
                              key={b.bin}
                              type="button"
                              onClick={() => {
                                handleSelectBank(b);
                                setIsBankDropdownOpen(false);
                                setBankSearch('');
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/60"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={b.logo}
                                  alt={b.shortName}
                                  className="h-5 w-5 object-contain"
                                />
                                <div>
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {b.shortName}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 line-clamp-1">
                                    {b.name}
                                  </div>
                                </div>
                              </div>
                              <span className="font-mono text-[10px] font-bold text-zinc-400">
                                {b.bin}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Popular Banks Quick-Pick Chips */}
                <div>
                  <div className="text-[11px] font-medium text-zinc-400">
                    Ngân hàng phổ biến:
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {banks.slice(0, 6).map((b) => (
                      <button
                        key={b.bin}
                        type="button"
                        onClick={() => handleSelectBank(b)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                          selectedBank?.bin === b.bin
                            ? 'bg-[#287DA8] text-white shadow-2xs'
                            : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        <img
                          src={b.logo}
                          alt={b.shortName}
                          className="h-3.5 w-3.5 object-contain"
                        />
                        {b.shortName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Số tài khoản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))
                    }
                    placeholder="Ví dụ: 1903678912301"
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono font-medium shadow-2xs focus:border-[#287DA8] focus:outline-hidden focus:ring-2 focus:ring-[#287DA8]/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                {/* Account Holder Name */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Họ và tên chủ tài khoản <span className="text-rose-500">*</span>
                    </label>
                    {lookingUpAccount && (
                      <span className="text-[11px] text-[#287DA8] flex items-center gap-1 font-medium animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Đang tra cứu...
                      </span>
                    )}
                  </div>
                  <input
                    required
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value.toUpperCase())}
                    placeholder="NGUYEN VAN A (viết hoa không dấu)"
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs uppercase font-medium shadow-2xs focus:border-[#287DA8] focus:outline-hidden focus:ring-2 focus:ring-[#287DA8]/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Tên chủ tài khoản được tự động tra cứu, bạn có thể chỉnh sửa nếu cần.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-[#287DA8] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#20698e] disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu tài khoản thụ hưởng'}
                  </button>

                  {wallet?.bankAccount && (
                    <button
                      type="button"
                      onClick={() => setIsEditingBank(false)}
                      className="rounded-xl border border-zinc-200 px-3 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── RIGHT: Withdrawal Form (7 cols) ── */}
        <div className="space-y-4 lg:col-span-7">
          <form
            onSubmit={handleRequestWithdrawal}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Tạo Lệnh Rút Tiền Về Ngân Hàng
                </h2>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                Miễn phí giao dịch
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Số tiền cần rút (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    Số dư: <strong className="text-zinc-800 dark:text-zinc-200">{formatVND(availableBalance)}</strong>
                  </span>
                </div>

                <div className="relative mt-1.5">
                  <input
                    required
                    type="number"
                    min="50000"
                    step="1000"
                    max={availableBalance || undefined}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Nhập số tiền (tối thiểu 50.000 ₫)"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-base font-mono font-bold shadow-2xs focus:border-[#287DA8] focus:outline-hidden focus:ring-2 focus:ring-[#287DA8]/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <div className="absolute inset-y-0 right-3.5 flex items-center text-xs font-bold text-zinc-400">
                    VNĐ
                  </div>
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div>
                <div className="text-[11px] font-medium text-zinc-400">
                  Chọn nhanh số tiền:
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(String(val))}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-[#287DA8] hover:text-[#287DA8] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {formatVND(val)}
                    </button>
                  ))}
                  {availableBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(availableBalance))}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      Toàn bộ số dư ({formatVND(availableBalance)})
                    </button>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Ghi chú lệnh rút (Tùy chọn)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={withdrawalNote}
                  onChange={(e) => setWithdrawalNote(e.target.value)}
                  placeholder="Ví dụ: Rút doanh thu đợt 1 tháng 10"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-2xs focus:border-[#287DA8] focus:outline-hidden focus:ring-2 focus:ring-[#287DA8]/20 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>

              {/* Summary Box */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs space-y-1.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex justify-between text-zinc-500">
                  <span>Tài khoản nhận:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {wallet?.bankAccount
                      ? `${wallet.bankAccount.bankName} - ${wallet.bankAccount.accountNumber}`
                      : 'Chưa cấu hình tài khoản'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Thời gian xử lý:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Ngay tức thì (Tự động 24/7)
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Phí rút tiền:</span>
                  <span className="font-semibold text-emerald-600">0 ₫</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={withdrawing || !wallet?.bankAccount || availableBalance <= 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white shadow-md hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all cursor-pointer"
              >
                {withdrawing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Đang gửi yêu cầu chi qua PayOS...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    Xác nhận rút {amount ? formatVND(Number(amount)) : 'tiền'} về tài khoản
                  </>
                )}
              </button>

              {!wallet?.bankAccount && (
                <p className="text-center text-xs text-amber-600">
                  Vui lòng lưu thông tin tài khoản nhận tiền ở cột bên trái trước khi rút.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── Bottom Section: History & Ledger Tabs ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 pt-3 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('WITHDRAWALS')}
              className={`border-b-2 pb-3 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'WITHDRAWALS'
                  ? 'border-[#287DA8] text-[#287DA8]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              Lịch Sử Rút Tiền ({withdrawals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`border-b-2 pb-3 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'TRANSACTIONS'
                  ? 'border-[#287DA8] text-[#287DA8]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              Biến Động Số Dư Ví ({transactions.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Withdrawals */}
        {activeTab === 'WITHDRAWALS' && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {withdrawals.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Chưa có yêu cầu rút tiền nào được tạo.
              </div>
            ) : (
              withdrawals.map((item) => {
                const isPending = ['PENDING', 'PROCESSING'].includes(item.status);
                const isSuccess = ['COMPLETED', 'SUCCESS'].includes(item.status);
                const isFailed = ['FAILED', 'REJECTED'].includes(item.status);

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isPending
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                            {formatVND(item.amount)}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              isSuccess
                                ? 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : isPending
                                ? 'bg-amber-100/70 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100/70 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {isSuccess
                              ? 'Đã chuyển thành công'
                              : isPending
                              ? 'Đang xử lý chi'
                              : 'Thất bại'}
                          </span>
                        </div>

                        <div className="mt-1 text-[11px] text-zinc-500">
                          {item.bankName} · {item.accountNumber} ·{' '}
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </div>

                        {item.note && (
                          <div className="mt-0.5 text-[11px] text-zinc-400 italic">
                            "{item.note}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isPending && (
                        <button
                          type="button"
                          disabled={syncingId === item.id}
                          onClick={() => handleSyncWithdrawal(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              syncingId === item.id ? 'animate-spin' : ''
                            }`}
                          />
                          Đồng bộ trạng thái
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Transactions */}
        {activeTab === 'TRANSACTIONS' && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Chưa có giao dịch nào được ghi nhận. Đơn hàng thành công qua nút Smart Button sẽ được tự động cộng vào ví.
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        tx.amount >= 0
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {tx.amount >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownToLine className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {tx.description || (tx.amount >= 0 ? 'Doanh thu đơn hàng Smart Button' : 'Rút tiền về tài khoản')}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        {new Date(tx.createdAt).toLocaleString('vi-VN')} ·{' '}
                        <span className="font-mono">{tx.status}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`font-mono font-bold text-sm ${
                      tx.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {formatVND(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
