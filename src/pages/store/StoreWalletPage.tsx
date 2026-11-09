import { useDashboardRefresh } from '../../hooks/useDashboardRefresh';
import { useAuth } from '../../context/AuthContext';
import { formatMetric } from '../../services/dashboard-metrics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine,
  Landmark,
  RefreshCw,
  Wallet,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  walletService,
  type StoreWalletInfo,
  type WalletTransactionItem,
  type WithdrawalItem,
} from '../../services/wallet.service';
import { api } from '../../services/api';
import { createStoreFinanceFlow, financeStoreId, type FinanceBankAccount } from '../../services/store-finance-flow';
import { readPendingWithdrawal, withdrawalRecipient, withdrawalStatusLabel, type PendingWithdrawal } from '../../services/store-withdrawals';

const bankFlow = createStoreFinanceFlow(api);

const formatVND = (value = 0) => `${Number(value).toLocaleString('vi-VN')} ₫`;

const QUICK_AMOUNTS = [200000, 500000, 1000000, 2000000, 5000000];

export const StoreWalletPage: React.FC = () => {
  const { user } = useAuth();
  return <StoreWalletWorkspace key={`${user?.id || ''}:${financeStoreId(user) || ''}`} />;
};

export const StoreWalletWorkspace: React.FC = () => {
  const { user } = useAuth();
  const storeId = financeStoreId(user);
  const canManageBanks = user?.role === 'STORE_OWNER';
  const canWithdraw = canManageBanks || user?.role === 'STORE_MANAGER';
  const mounted = useRef(true);
  const refreshRequest = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; refreshRequest.current++; }; }, []);
  const [wallet, setWallet] = useState<StoreWalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);

  const [recipient, setRecipient] = useState<FinanceBankAccount | null>(null);
  const [accountsError, setAccountsError] = useState('');
  const pendingStorageKey = 'smart_order_withdrawal:' + user?.id + ':' + storeId;
  const [recovery] = useState(() => {
    try { return { pending: readPendingWithdrawal(sessionStorage.getItem(pendingStorageKey)), error: '' }; }
    catch { return { pending: null, error: 'Chưa đọc được yêu cầu rút tiền đang chờ. Vui lòng kiểm tra bộ nhớ trình duyệt hoặc liên hệ hỗ trợ trước khi tạo lệnh khác.' }; }
  });
  const [pending, setPending] = useState<PendingWithdrawal | null>(recovery.pending);
  const pendingRef = useRef(pending);
  const [storageError, setStorageError] = useState(recovery.error);
  const withdrawingRef = useRef(false);
  const [amount, setAmount] = useState(pending ? String(pending.amount) : '');
  const savePending = (request: PendingWithdrawal | null) => {
    if (request) sessionStorage.setItem(pendingStorageKey, JSON.stringify(request));
    else sessionStorage.removeItem(pendingStorageKey);
    pendingRef.current = request; setPending(request);
  };

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletReady, setWalletReady] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [transactionPagination, setTransactionPagination] = useState<any>(null);
  const [withdrawalPagination, setWithdrawalPagination] = useState<any>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'WITHDRAWALS' | 'TRANSACTIONS'>('WITHDRAWALS');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState('');
  const [withdrawalDetail, setWithdrawalDetail] = useState<WithdrawalItem | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);
  useEffect(() => {
    if (!selectedWithdrawal || !storeId) return;
    let stopped = false;
    setDetailLoading(true); setDetailError(''); setWithdrawalDetail(null);
    void walletService.getWithdrawal(selectedWithdrawal, storeId).then(result => {
      if (!stopped) setWithdrawalDetail(result);
    }).catch(error => {
      if (!stopped) setDetailError(error?.response?.data?.message || error.message || 'Chưa tải được chi tiết lệnh rút tiền.');
    }).finally(() => { if (!stopped) setDetailLoading(false); });
    return () => { stopped = true; };
  }, [selectedWithdrawal, storeId, loadedAt, detailRefresh]);

  const refresh = useCallback(async (syncBankForm = true) => {
    const request = ++refreshRequest.current;
    setRefreshing(true);
    if (syncBankForm) setError(null);
    setHistoryWarning(null);
    try {
      const [walletResult, transactionsResult, withdrawalsResult, accountsResult] = await Promise.allSettled([
        walletService.getWallet(),
        walletService.getTransactions(undefined, transactionPage),
        walletService.getWithdrawals(undefined, withdrawalPage),
        storeId && user?.role === 'STORE_OWNER' ? bankFlow.accounts(storeId) : Promise.reject(new Error('Chỉ chủ cửa hàng được quản lý tài khoản nhận tiền.')),
      ]);

      if (!mounted.current || request !== refreshRequest.current) return;

      if (walletResult.status !== 'fulfilled') throw walletResult.reason;

      const nextWallet = walletResult.value.data as StoreWalletInfo;
      if (!nextWallet || typeof nextWallet !== 'object' || Array.isArray(nextWallet)) throw new Error('Invalid wallet response');
      if (storeId && String(nextWallet.storeId) !== storeId) throw new Error('API trả về ví không thuộc cửa hàng hiện tại.');
      setWallet(nextWallet);
      setWalletReady(true); setLoadedAt(new Date().toISOString());
      const unavailableHistories: string[] = [];
      if (transactionsResult.status === 'fulfilled') {
        setTransactions(transactionsResult.value.data || []);
        setTransactionPagination(transactionsResult.value.pagination || null);
      } else {
        setTransactions([]);
        unavailableHistories.push('biến động số dư');
      }
      if (withdrawalsResult.status === 'fulfilled') {
        setWithdrawals(withdrawalsResult.value.data || []);
        setWithdrawalPagination(withdrawalsResult.value.pagination || null);
      } else {
        setWithdrawals([]);
        unavailableHistories.push('lịch sử rút tiền');
      }
      if (unavailableHistories.length > 0) {
        setHistoryWarning(`Chưa tải được ${unavailableHistories.join(' và ')} từ máy chủ. Số dư ví vẫn được hiển thị.`);
      }

      if (accountsResult.status === 'fulfilled' && storeId) {
        try { setRecipient(withdrawalRecipient(accountsResult.value, storeId)); setAccountsError(''); }
        catch (error: any) { setRecipient(null); setAccountsError(error.message); }
      } else {
        setRecipient(null);
        setAccountsError(canManageBanks
          ? 'Chưa tải được tài khoản nhận tiền đã xác minh. Chủ cửa hàng có thể kiểm tra tại mục Ngân hàng.'
          : 'Tài khoản nhận do hệ thống chọn trong danh sách đã xác minh của cửa hàng. Xem tài khoản thực nhận tại lịch sử sau khi hệ thống ghi nhận lệnh rút.');
      }
    } catch (err: any) {
      if (!mounted.current || request !== refreshRequest.current) return;
      setWalletReady(false);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Không thể tải dữ liệu ví cửa hàng. Vui lòng thử lại sau.'
      );
    } finally {
      if (mounted.current && request === refreshRequest.current) { setLoading(false); setRefreshing(false); }
    }
  }, [storeId, user?.role, canManageBanks, transactionPage, withdrawalPage]);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  // A retry reuses the exact request and key; it never becomes a second withdrawal.
  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawingRef.current || refreshing || storageError || !storeId || !canWithdraw) return;
    const previous = pendingRef.current;
    const withdrawAmount = previous?.amount ?? Number(amount);
    if (!Number.isSafeInteger(withdrawAmount) || withdrawAmount < 50000) {
      setError('Số tiền rút phải là số nguyên, tối thiểu 50.000 ₫.'); return;
    }
    if (!previous && (!walletReady || canManageBanks && (!recipient || accountsError))) {
      setError('Hãy tải lại ví và xác minh tài khoản nhận tiền trước khi rút.'); return;
    }
    if (previous && Date.now() - previous.createdAt >= 24 * 60 * 60 * 1000) {
      setError('Yêu cầu đã chờ quá lâu để gửi lại an toàn. Vui lòng kiểm tra lịch sử và liên hệ hỗ trợ; chưa tạo lệnh rút mới.'); return;
    }
    withdrawingRef.current = true; setWithdrawing(true); setError(null); setNotice(null);
    let dispatched = false;
    try {
      const freshAccount = canManageBanks ? withdrawalRecipient(await bankFlow.accounts(storeId), storeId) : null;
      if (!mounted.current) return;
      setRecipient(freshAccount); setAccountsError('');
      if (canManageBanks && (!freshAccount || String(freshAccount.id) !== String(previous?.accountId ?? recipient?.id))) {
        throw new Error('Tài khoản nhận tiền đã thay đổi hoặc chưa xác định được. Hãy kiểm tra tài khoản mặc định tại mục Ngân hàng trước khi tiếp tục.');
      }
      if (!previous) {
        const response = await walletService.getWallet();
        if (!mounted.current) return;
        const freshWallet = response.data;
        if (String(freshWallet.storeId) !== storeId) throw new Error('Thông tin ví không thuộc cửa hàng hiện tại.');
        setWallet(freshWallet);
        const available = freshWallet.availableBalance ?? freshWallet.balance;
        if (!Number.isFinite(available) || withdrawAmount > available) throw new Error('Số dư khả dụng chưa đủ để rút số tiền này.');
      }
      const request = previous || { key: 'wd_' + crypto.randomUUID(), amount: withdrawAmount, accountId: freshAccount ? String(freshAccount.id) : null, createdAt: Date.now() };
      // Persist before dispatch so a reload cannot lose an uncertain financial request.
      try { savePending(request); } catch { setStorageError('Chưa lưu được mã yêu cầu rút tiền. Vui lòng cho phép lưu trữ trình duyệt trước khi tiếp tục.'); return; }
      if (!mounted.current) return;
      dispatched = true;
      const response = await walletService.requestWithdrawal({ amount: request.amount, idempotencyKey: request.key });
      if (!mounted.current) return;
      const result = response.data;
      if (!/^[1-9]\d*$/.test(String(result?.withdrawalId ?? result?.id)) || String(result?.storeId) !== storeId || Number(result?.amount) !== request.amount) {
        throw new Error('Chưa nhận được kết quả rút tiền khớp với yêu cầu.');
      }
      try { savePending(null); } catch { setStorageError('Yêu cầu đã được ghi nhận nhưng chưa xóa được mã chờ trên trình duyệt. Vui lòng liên hệ hỗ trợ trước khi tạo lệnh khác.'); }
      setNotice('Yêu cầu rút ' + formatVND(request.amount) + ': ' + withdrawalStatusLabel(result.status) + '. Tài khoản nhận: ' + (result.bankName || '') + ' · ' + (result.bankAccountMasked || result.bankAccountNumber || 'Xem lịch sử') + '.');
      setAmount('');
      await refresh();
    } catch (err: any) {
      if (!mounted.current) return;
      const status = err?.response?.status;
      if (dispatched && [400, 401, 403, 404, 422].includes(status)) {
        try { savePending(null); } catch { setStorageError('Chưa cập nhật được mã yêu cầu trên trình duyệt. Vui lòng liên hệ hỗ trợ.'); }
      }
      setError(dispatched && (!status || status >= 500 || status === 409)
        ? 'Chưa xác nhận được kết quả rút tiền. Hãy kiểm tra lịch sử hoặc dùng “Kiểm tra lại yêu cầu” để dùng lại đúng mã cũ; chưa tạo thêm lệnh rút.'
        : err.response?.data?.message || err.message || 'Chưa thể gửi yêu cầu rút tiền.');
      if (dispatched) await refresh(false);
    } finally {
      withdrawingRef.current = false;
      if (mounted.current) setWithdrawing(false);
    }
  };

  // Handle sync withdrawal status
  const handleSyncWithdrawal = async (id: string | number) => {
    setSyncingId(id);
    try {
      await walletService.syncWithdrawalStatus(id);
      await refresh();
      setNotice('Đã cập nhật trạng thái lệnh rút từ hệ thống.');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Không thể đồng bộ trạng thái lệnh rút.'
      );
    } finally {
      setSyncingId(null);
    }
  };

  useDashboardRefresh(() => { if (!withdrawingRef.current && !syncingId) return refresh(false); }, 'wallet:' + user?.id + ':' + user?.storeId);
  const availableBalance = wallet?.availableBalance ?? wallet?.balance;
  const activePagination = activeTab === 'WITHDRAWALS' ? withdrawalPagination : transactionPagination;

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
    <div className="mx-auto w-full max-w-7xl space-y-6 text-zinc-900 dark:text-zinc-100">
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Ví Cửa Hàng & Rút Tiền
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Số dư & giao dịch
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Theo dõi số dư, các khoản đang giữ và yêu cầu rút tiền của cửa hàng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || withdrawing || !!syncingId}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </button>
      </div>

      {/* ── Alerts ── */}
      {loadedAt && <p className="text-xs text-zinc-500 dark:text-zinc-400">Lần tải gần nhất: {new Date(loadedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}{!walletReady && ' · Chưa xác nhận lại số dư. Vui lòng tải lại trước khi rút tiền.'}</p>}
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
              {walletReady ? 'Đã cập nhật' : 'Chưa xác nhận lại'}
            </span>
          </div>
          <div className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatMetric(wallet?.availableBalance ?? wallet?.balance, true)}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Số dư khả dụng được hệ thống ghi nhận cho cửa hàng.
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
            {formatMetric(wallet?.pendingBalance, true)}
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
              {wallet?.payosPayoutConnected === true ? 'Đã kết nối' : wallet?.payosPayoutConnected === false ? 'Chưa kết nối' : 'Chưa có thông tin'}
            </span>
          </div>
          <div className="mt-3 font-mono text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatMetric(wallet?.payosPayoutBalance, true)}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Hạn mức do cổng chi trả cung cấp, nếu hệ thống đã kết nối.
          </p>
        </div>
      </div>

      {/* ── Main Operations Grid ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="wallet-recipient-title" className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <h2 id="wallet-recipient-title" className="flex items-center gap-2 text-sm font-bold"><CreditCard className="h-4 w-4 text-[#287DA8]" />Tài khoản nhận tiền đã xác minh</h2>
            {accountsError ? <p role="alert" className="mt-4 text-sm text-amber-700 dark:text-amber-300">{accountsError}</p> : recipient ? <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-[#0F2347] p-5 text-white">
                <p className="font-semibold">{recipient.bankName}</p>
                <p className="mt-4 break-all font-mono text-xl tracking-wider">{recipient.accountNumberMasked}</p>
                <p className="mt-3 text-sm font-semibold">{recipient.accountName}</p>
                <p className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><ShieldCheck className="h-4 w-4" />Đã xác minh chính chủ{recipient.isDefault ? ' · Mặc định' : ''}</p>
              </div>
              <p className="text-xs leading-5 text-zinc-500">Hệ thống dùng tài khoản đã xác minh để xử lý lệnh rút. Tài khoản nhận thực tế được ghi nhận trong lịch sử của từng lệnh.</p>
            </div> : <p className="mt-4 text-sm leading-6 text-zinc-500">Chưa xác định được tài khoản nhận tiền. Hãy xác minh tài khoản và chọn tài khoản mặc định nếu có nhiều tài khoản đã xác minh.</p>}
            {user?.role === 'STORE_OWNER' && <Link to="/store/finance#store-bank-accounts" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#287DA8]">Quản lý & xác minh ngân hàng<ExternalLink className="h-4 w-4" /></Link>}
            <button type="button" disabled={refreshing || withdrawing} onClick={() => refresh(false)} className="mt-3 block text-xs font-semibold text-[#287DA8] disabled:opacity-50">Tải lại tài khoản nhận tiền</button>
          </div>
        </section>

        {/* ── RIGHT: Withdrawal Form (7 cols) ── */}
        <div className="space-y-4 lg:col-span-7">
          <form
            onSubmit={handleRequestWithdrawal}
            noValidate={!!pending}
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
                Yêu cầu rút tiền
              </span>
            </div>

            {storageError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{storageError}</p>}
            {pending && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Có yêu cầu rút {formatVND(pending.amount)} đang chờ xác nhận. Kiểm tra lịch sử hoặc dùng “Kiểm tra lại yêu cầu”; giữ nguyên số tiền để tránh tạo lệnh trùng.</p>}
            <div className="mt-4 space-y-4">
              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Số tiền cần rút (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    Số dư: <strong className="text-zinc-800 dark:text-zinc-200">{formatMetric(availableBalance, true)}</strong>
                  </span>
                </div>

                <div className="relative mt-1.5">
                  <input
                    required
                    type="number"
                    min="50000"
                    step="1000"
                    max={availableBalance}
                    disabled={!!pending || withdrawing || !!storageError}
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
                      disabled={!!pending || withdrawing || !!storageError}
                      onClick={() => setAmount(String(val))}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-[#287DA8] hover:text-[#287DA8] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {formatVND(val)}
                    </button>
                  ))}
                  {availableBalance != null && availableBalance > 0 && (
                    <button
                      type="button"
                      disabled={!!pending || withdrawing || !!storageError}
                      onClick={() => setAmount(String(availableBalance))}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      Toàn bộ số dư ({formatVND(availableBalance)})
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Box */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs space-y-1.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex justify-between text-zinc-500">
                  <span>Tài khoản nhận:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {recipient
                      ? `${recipient.bankName} - ${recipient.accountNumberMasked}`
                      : canManageBanks ? 'Chưa cấu hình tài khoản' : 'Do hệ thống xác định khi ghi nhận lệnh'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Thời gian xử lý:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Theo trạng thái xử lý của hệ thống
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Phí rút tiền:</span>
                  <span className="font-semibold text-zinc-500">Chưa có thông tin từ hệ thống</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={withdrawing || refreshing || !!storageError || !canWithdraw || (!pending && (!walletReady || canManageBanks && (!recipient || !!accountsError) || availableBalance == null || availableBalance < 50000))}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white shadow-md hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all cursor-pointer"
              >
                {withdrawing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Đang gửi yêu cầu rút tiền…
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    {pending ? 'Kiểm tra lại yêu cầu' : 'Xác nhận rút'} {amount ? formatVND(Number(amount)) : 'tiền'} về tài khoản
                  </>
                )}
              </button>

              {canManageBanks && !recipient && !pending && (
                <p className="text-center text-xs text-amber-600">
                  Vui lòng xác minh tài khoản nhận tiền và kiểm tra tài khoản mặc định trước khi rút.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── Bottom Section: History & Ledger Tabs ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        {historyWarning && (
          <div role="status" className="m-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{historyWarning}</span>
          </div>
        )}
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
              Lịch Sử Rút Tiền ({!wallet || historyWarning?.includes('lịch sử rút tiền') ? '—' : withdrawalPagination?.totalItems ?? withdrawals.length})
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
              Biến Động Số Dư Ví ({!wallet || historyWarning?.includes('biến động số dư') ? '—' : transactionPagination?.totalItems ?? transactions.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Withdrawals */}
        {activeTab === 'WITHDRAWALS' && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {withdrawals.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                {historyWarning?.includes('lịch sử rút tiền') ? 'Lịch sử rút tiền đang tạm thời không khả dụng.' : 'Chưa có yêu cầu rút tiền nào được tạo.'}
              </div>
            ) : (
              withdrawals.map((item) => {
                const isPending = ['PENDING', 'PROCESSING'].includes(item.status);
                const isSuccess = ['COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(item.status);
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
                              : isFailed ? 'Thất bại' : item.status}
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
                      <button type="button" onClick={() => setSelectedWithdrawal(String(item.id))} className="min-h-10 rounded-lg border border-zinc-200 px-3 font-semibold dark:border-zinc-700">Chi tiết</button>
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

        {activeTab === 'WITHDRAWALS' && selectedWithdrawal && <section aria-label="Chi tiết lệnh rút tiền" aria-busy={detailLoading} className="m-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">Lệnh rút #{selectedWithdrawal}</h3><button type="button" onClick={() => { setSelectedWithdrawal(''); setWithdrawalDetail(null); }} className="min-h-10 px-3 text-sm">Đóng chi tiết</button></div>
          {detailLoading && <p role="status" className="mt-3 text-sm text-zinc-500">Đang tải chi tiết lệnh rút…</p>}
          {detailError && <div role="alert" className="mt-3 text-sm text-rose-600"><p>{detailError}</p><button type="button" onClick={() => setDetailRefresh(value => value + 1)} className="mt-2 min-h-10 font-semibold underline">Thử lại</button></div>}
          {withdrawalDetail && <><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs text-zinc-500">Trạng thái hệ thống</dt><dd className="mt-1 font-semibold">{withdrawalStatusLabel(withdrawalDetail.status)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Số tiền yêu cầu</dt><dd className="mt-1">{formatMetric(withdrawalDetail.amount, true)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Phí / Số tiền chuyển</dt><dd className="mt-1">{formatMetric(withdrawalDetail.fee, true)} / {formatMetric(withdrawalDetail.netAmount, true)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Tài khoản nhận đã ghi nhận</dt><dd className="mt-1">{withdrawalDetail.bankName} · {withdrawalDetail.accountNumber}<br />{withdrawalDetail.accountHolderName}</dd></div>
            <div><dt className="text-xs text-zinc-500">Mã lệnh</dt><dd className="mt-1 break-all">{withdrawalDetail.withdrawalCode || '—'}</dd></div>
            <div><dt className="text-xs text-zinc-500">Mã chi tiền</dt><dd className="mt-1 break-all">{withdrawalDetail.providerPayoutId || '—'}</dd></div>
          </dl>{(withdrawalDetail.failureReason || withdrawalDetail.rejectionReason) && <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{withdrawalDetail.failureReason || withdrawalDetail.rejectionReason}</p>}</>}
        </section>}

        {/* Tab 2: Transactions */}
        {activeTab === 'TRANSACTIONS' && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                {historyWarning?.includes('biến động số dư') ? 'Lịch sử biến động số dư đang tạm thời không khả dụng.' : 'Chưa có giao dịch nào được ghi nhận. Đơn hàng thành công qua nút Smart Button sẽ được tự động cộng vào ví.'}
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
                        {tx.description || tx.type || 'Giao dịch ví'}
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
        {activePagination && <nav aria-label="Phân trang lịch sử ví" className="flex items-center justify-between gap-3 border-t border-zinc-100 p-4 text-xs dark:border-zinc-800"><span>Trang {activePagination.page} / {Math.max(1, activePagination.totalPages)}</span><div className="flex gap-2"><button type="button" disabled={refreshing || activePagination.page <= 1} onClick={() => activeTab === 'WITHDRAWALS' ? setWithdrawalPage(activePagination.page - 1) : setTransactionPage(activePagination.page - 1)} className="min-h-10 rounded-lg border border-zinc-200 px-3 disabled:opacity-40 dark:border-zinc-700">Trang trước</button><button type="button" disabled={refreshing || !activePagination.hasNextPage} onClick={() => activeTab === 'WITHDRAWALS' ? setWithdrawalPage(activePagination.page + 1) : setTransactionPage(activePagination.page + 1)} className="min-h-10 rounded-lg border border-zinc-200 px-3 disabled:opacity-40 dark:border-zinc-700">Trang sau</button></div></nav>}
      </div>
    </div>
  );
};
