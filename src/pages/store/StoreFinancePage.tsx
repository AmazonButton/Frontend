import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, Clock3, CreditCard, Info, Landmark, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, WalletCards, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { card, primaryButton } from '../operations/OperationPrimitives';
import { StoreSubscriptionPayments } from '../../components/store/StoreSubscriptionPayments';
import { StoreBankVerificationHistory } from '../../components/store/StoreBankVerificationHistory';
import { StoreRegisteredPeriods } from '../../components/store/StoreRegisteredPeriods';
import { BankTransferInstructions } from '../../components/common/BankingPrimitives';
import { createBankingFlow, type StoreBankTransaction } from '../../services/banking-flow';
import { getApiRetryUntil } from '../../services/request-backoff';
import { subscriptionDateLabel, subscriptionMoney, subscriptionNumber, subscriptionOverview, validateStoreSubscription } from '../../services/store-subscription-overview';
import { bankVerificationPayload, canSetFinanceDefault, createStoreFinanceFlow, financeError, financeLookupError, financeStoreId, financeVerificationExpired, financeVerificationKey, readFinanceVerification, type FinanceBank, type FinanceBankAccount, type FinanceVerification } from '../../services/store-finance-flow';

const flow = createStoreFinanceFlow(api);
const banking = createBankingFlow(api);
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';
const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/15 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white';
const statusLabel = (status?: string) => ({ OWNERSHIP_VERIFIED: 'Đã xác minh chính chủ', PENDING: 'Chờ xác minh', SUSPENDED: 'Tạm khóa', REVOKED: 'Đã thu hồi' }[status || ''] || 'Chưa xác minh');

export function financeViewForHash(hash: string) {
  if (hash === '#subscription-payments') return 'payments';
  if (['#store-bank-accounts', '#store-bank-verification-history', '#bank-verification-title'].includes(hash)) return 'banks';
  return 'current';
}
type AccountAction = { kind: 'default' | 'delete'; account: FinanceBankAccount } | { kind: 'cancel' };

export const StoreFinancePage: React.FC = () => {
  const { user } = useAuth();
  const { hash } = useLocation();
  const view = financeViewForHash(hash);
  const heading = {
    current: { title: 'Gói đang dùng', description: 'Theo dõi gói hiện tại, thời hạn sử dụng và các kỳ đã đăng ký của gian hàng.' },
    payments: { title: 'Chi phí & lịch sử đóng tiền', description: 'Xem các khoản phí và giao dịch đóng tiền đã được hệ thống ghi nhận.' },
    banks: { title: 'Tài khoản ngân hàng', description: 'Quản lý tài khoản ngân hàng, xác minh chính chủ và theo dõi hoàn tiền xác minh.' },
  }[view];
  const storeId = financeStoreId(user);
  const canManageBanks = String(user?.role) === 'STORE_OWNER';
  const scope = `${user?.id || ''}:${storeId || ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const storageKey = storeId && user?.id ? financeVerificationKey(user.id, storeId) : null;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (['#subscription-current', '#subscription-payments', '#store-bank-accounts', '#store-bank-verification-history'].includes(hash)) {
      document.getElementById?.(hash.slice(1))?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [hash, reducedMotion]);
  const [storedSubscription, setSubscription] = useState<any>(null);
  const subscriptionOwner = useRef(scope);
  const subscription = subscriptionOwner.current === scope ? storedSubscription : null;
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [bankRefresh, setBankRefresh] = useState(0);
  const [requestRefresh, setRequestRefresh] = useState(0);
  const [accounts, setAccounts] = useState<FinanceBankAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [banks, setBanks] = useState<FinanceBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [bankBin, setBankBin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [lookup, setLookup] = useState<Awaited<ReturnType<typeof flow.lookup>> | null>(null);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [formError, setFormError] = useState('');
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [activeRequest, setActiveRequest] = useState<FinanceVerification | null>(null);
  const [requestChecked, setRequestChecked] = useState(false);
  const requestRef = useRef<FinanceVerification | null>(null);
  const [action, setAction] = useState<AccountAction | null>(null);
  const [operation, setOperation] = useState('');
  const operationRef = useRef('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(Date.now());
  const accountsRequest = useRef(0);
  const subscriptionRequest = useRef(0);
  const lookupRequest = useRef(0);
  const lookupTimer = useRef<number | null>(null);
  const formRef = useRef<HTMLSelectElement>(null);
  const actionRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const saveRequest = useCallback((request: FinanceVerification | null) => {
    if (scopeRef.current !== scope) return;
    setRequestChecked(false);
    requestRef.current = request; setActiveRequest(request);
    try { if (storageKey) { if (request) sessionStorage.setItem(storageKey, JSON.stringify(request)); else sessionStorage.removeItem(storageKey); } } catch { /* Browser storage is optional. */ }
  }, [scope, storageKey]);

  const restoreRequest = useCallback((transaction: StoreBankTransaction, force = false) => {
    if (scopeRef.current !== scope || String(transaction.storeId) !== storeId || transaction.status !== 'PENDING') return false;
    const sameRequest = requestRef.current?.verificationId === transaction.verificationId;
    if (operationRef.current || (requestRef.current && !sameRequest && !force)) return false;
    const request = readFinanceVerification(JSON.stringify({ verificationId: transaction.verificationId, bankAccountId: transaction.bankAccountId,
      bankName: transaction.bankName, accountName: transaction.accountName, accountNumberMasked: transaction.accountNumberMasked,
      referenceCode: transaction.referenceCode, amount: transaction.expectedAmount, expiresAt: transaction.expiresAt,
      instructions: transaction.instructions || '', recipientBankBin: transaction.recipientBankBin,
      recipientBankName: transaction.recipientBankName, recipientAccountNumber: transaction.recipientAccountNumber,
      recipientAccountHolder: transaction.recipientAccountHolder, qrCodeUrl: transaction.qrCodeUrl }));
    if (!request) return false;
    if (JSON.stringify(requestRef.current) === JSON.stringify(request)) return true;
    if (!sameRequest) { setAction(null); setActionError(''); setCreationUncertain(false); setFormOpen(false); setLookup(null); setNameConfirmed(false); }
    saveRequest(request);
    return true;
  }, [scope, storeId, saveRequest]);

  const loadAccounts = useCallback(async (quiet = false) => {
    if (scopeRef.current !== scope || !storeId || !canManageBanks) return false;
    const request = ++accountsRequest.current;
    if (!quiet) setAccountsLoading(true);
    try {
      const list = await flow.accounts(storeId);
      if (request !== accountsRequest.current || scopeRef.current !== scope) return false;
      setAccounts(list); setAccountsError('');
      return true;
    } catch (error) {
      if (request === accountsRequest.current && scopeRef.current === scope) setAccountsError(financeError(error, 'Chưa tải được danh sách tài khoản. Vui lòng thử lại.'));
      return false;
    } finally { if (request === accountsRequest.current && scopeRef.current === scope) setAccountsLoading(false); }
  }, [storeId, canManageBanks, scope, saveRequest]);

  const loadSubscription = useCallback(async () => {
    const request = ++subscriptionRequest.current;
    if (scopeRef.current !== scope) return;
    setSubscriptionLoading(true);
    try {
      const next = validateStoreSubscription(await flow.currentSubscription(), storeId);
      if (request === subscriptionRequest.current && scopeRef.current === scope) { subscriptionOwner.current = scope; setSubscription(next); setSubscriptionError(''); }
    } catch (error) {
      if (request === subscriptionRequest.current && scopeRef.current === scope) setSubscriptionError(financeError(error, 'Chưa tải được gói dịch vụ.'));
    } finally { if (request === subscriptionRequest.current && scopeRef.current === scope) setSubscriptionLoading(false); }
  }, [scope, storeId]);

  const loadBanks = useCallback(async () => {
    if (!canManageBanks || scopeRef.current !== scope) return;
    setBanksLoading(true);
    try {
      const next = await flow.banks();
      if (scopeRef.current === scope) { setBanks(next.filter(bank => bank.lookupSupported !== false)); setBanksError(''); }
    } catch (error) { if (scopeRef.current === scope) setBanksError(financeError(error, 'Chưa tải được danh sách ngân hàng.')); }
    finally { if (scopeRef.current === scope) setBanksLoading(false); }
  }, [canManageBanks, scope]);

  useEffect(() => {
    let saved: FinanceVerification | null = null;
    try { if (storageKey) saved = readFinanceVerification(sessionStorage.getItem(storageKey)); } catch { /* Browser storage is optional. */ }
    requestRef.current = saved; setActiveRequest(saved); setRequestChecked(false);
    subscriptionOwner.current = scope;
    operationRef.current = ''; setOperation('');
    setAccounts([]); setSubscription(null); setFormOpen(false); setAction(null); setNotice(''); setActionError(''); setFormError(''); setLookup(null); setNameConfirmed(false); setBankBin(''); setAccountNumber(''); setBanks([]); setBanksLoading(false); setBanksError(''); setCreationUncertain(false);
    setAccountsError(''); setAccountsLoading(canManageBanks && !!storeId);
    void loadSubscription();
    if (canManageBanks && storeId) void loadAccounts();
    return () => { accountsRequest.current += 1; subscriptionRequest.current += 1; lookupRequest.current += 1; };
  }, [scope, storageKey, canManageBanks, storeId, loadAccounts, loadSubscription]);

  useEffect(() => { if (formOpen && !banks.length && !banksLoading && !banksError) void loadBanks(); }, [formOpen, banks.length, banksLoading, banksError, loadBanks]);
  useEffect(() => { if (formOpen) formRef.current?.focus(); }, [formOpen]);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, activeRequest ? 1000 : 60000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [activeRequest]);
  useEffect(() => { if (action) actionRef.current?.focus(); }, [action]);
  useEffect(() => {
    if (!activeRequest || !canManageBanks || !storeId) return;
    let stopped = false;
    let running = false;
    let failed = false;
    const refresh = async () => {
      setNow(Date.now());
      if (stopped || running || failed || document.visibilityState !== 'visible' || operationRef.current || getApiRetryUntil()) return;
      running = true;
      try {
        const result = await banking.storeDetail(storeId, activeRequest.verificationId);
        if (stopped || scopeRef.current !== scope || requestRef.current?.verificationId !== result.verificationId) return;
        if (result.status !== 'PENDING') { saveRequest(null); setBankRefresh(value => value + 1); setNotice('Phiên xác minh đã cập nhật. Xem kết quả xác minh và trạng thái hoàn tiền riêng tại lịch sử bên dưới.'); }
        else { restoreRequest(result); setRequestChecked(true); }
        await loadAccounts(true);
      } catch (error) {
        failed = true;
        if (!stopped && scopeRef.current === scope) setRequestChecked(false);
        if (!stopped && scopeRef.current === scope) setActionError(financeError(error, 'Chưa thể kiểm tra phiên xác minh. Hãy mở lịch sử để kiểm tra lại.'));
      } finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    document.addEventListener('visibilitychange', refresh);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [activeRequest, canManageBanks, storeId, scope, saveRequest, restoreRequest, loadAccounts, requestRefresh]);

  const clearLookup = () => { lookupRequest.current += 1; setLookup(null); setNameConfirmed(false); setFormError(''); };
  const closeForm = () => { if (operationRef.current) return; setFormOpen(false); setFormError(''); addRef.current?.focus(); };
  const begin = useCallback((kind: string) => { if (operationRef.current) return false; operationRef.current = kind; setOperation(kind); setNotice(''); setActionError(''); return true; }, []);
  const end = useCallback(() => { if (scopeRef.current === scope) { operationRef.current = ''; setOperation(''); } }, [scope]);
  const recoverExistingVerification = async () => {
    const current = await banking.pendingStoreVerification(storeId!);
    if (scopeRef.current !== scope) return;
    if (!current) throw new Error('Chưa tìm thấy phiên đang chờ. Hãy kiểm tra lịch sử hoặc liên hệ hỗ trợ trước khi tạo yêu cầu khác.');
    // Restoration is a read operation. Release the form lock before resuming.
    end();
    if (!restoreRequest(current, true)) throw new Error('Thông tin phiên đang chờ chưa đầy đủ. Hãy kiểm tra lịch sử hoặc liên hệ hỗ trợ trước khi chuyển tiền.');
    setNotice('Đã mở lại phiên xác minh đang chờ. Tiếp tục dùng hướng dẫn hiện tại; chưa tạo phiên mới.');
  };
  const lookupAccount = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (lookupTimer.current !== null) { window.clearTimeout(lookupTimer.current); lookupTimer.current = null; }
    if (!storeId || !canManageBanks || !begin('lookup')) return;
    const request = ++lookupRequest.current;
    setFormError(''); setLookup(null); setNameConfirmed(false);
    try {
      bankVerificationPayload(storeId, bankBin, accountNumber);
      const result = await flow.lookup(bankBin, accountNumber);
      if (request === lookupRequest.current && scopeRef.current === scope) setLookup(result);
    } catch (error) { if (request === lookupRequest.current && scopeRef.current === scope) setFormError(financeLookupError(error)); }
    finally { end(); }
  }, [storeId, canManageBanks, bankBin, accountNumber, begin, end, scope]);
  useEffect(() => {
    if (!formOpen || view !== 'banks' || !canManageBanks || !storeId || banksLoading
      || !/^\d{6}$/.test(bankBin) || !/^[0-9a-zA-Z]{5,30}$/.test(accountNumber.trim())) return;
    // A new edit cancels the previous delay. Failed lookups are never auto-retried.
    const timer = window.setTimeout(() => { lookupTimer.current = null; void lookupAccount(); }, 700);
    lookupTimer.current = timer;
    return () => { window.clearTimeout(timer); if (lookupTimer.current === timer) lookupTimer.current = null; };
  }, [formOpen, view, canManageBanks, storeId, banksLoading, bankBin, accountNumber, lookupAccount]);
  const createVerification = async () => {
    if (!storeId || !canManageBanks || !lookup || !nameConfirmed || activeRequest || creationUncertain || !begin('create')) return;
    setFormError('');
    try {
      const request = await flow.verify(storeId, bankBin, accountNumber);
      if (scopeRef.current !== scope) return;
      saveRequest({ ...request, initialAccountStatus: accounts.find(account => String(account.id) === request.bankAccountId)?.verificationStatus || 'PENDING' }); setRequestChecked(true); setNow(Date.now()); setFormOpen(false); setLookup(null); setNameConfirmed(false); setAccountNumber('');
      setNotice('Đã tạo yêu cầu xác minh. Tài khoản chỉ được xác nhận sau khi ngân hàng trả kết quả.');
      setBankRefresh(value => value + 1);
      await loadAccounts();
    } catch (error: any) {
      if (scopeRef.current === scope) {
        if (error?.response?.status === 409) {
          setCreationUncertain(true);
          try { await recoverExistingVerification(); }
          catch (recoveryError) { if (scopeRef.current === scope) setFormError(financeError(recoveryError)); }
          return;
        }
        const definitelyRejected = error?.response?.status >= 400 && error?.response?.status < 500;
        setCreationUncertain(!definitelyRejected);
        setFormError(definitelyRejected ? financeError(error) : 'Chưa xác nhận được kết quả gửi yêu cầu. Không gửi lại để tránh tạo trùng; hãy kiểm tra danh sách và liên hệ quản trị viên nếu cần.');
        setBankRefresh(value => value + 1);
        await loadAccounts(true);
      }
    } finally { end(); }
  };
  const confirmAction = async () => {
    if (!action || !storeId || !canManageBanks || !begin('action')) return;
    try {
      if (action.kind === 'cancel') {
        if (!activeRequest) throw new Error('Không tìm thấy yêu cầu cần hủy. Hãy tải lại tài khoản.');
        await flow.cancel(activeRequest.verificationId);
        if (scopeRef.current !== scope) return;
        saveRequest(null); setNotice('Đã hủy yêu cầu xác minh.');
      } else if (action.kind === 'default') {
        if (!canSetFinanceDefault(action.account)) throw new Error('Chỉ tài khoản đã xác minh mới có thể đặt làm mặc định.');
        await flow.setDefault(storeId, action.account.id);
        if (scopeRef.current !== scope) return;
        setNotice('Đã cập nhật tài khoản mặc định trong danh sách ngân hàng.');
      } else {
        if (activeRequest?.bankAccountId === String(action.account.id)) throw new Error('Hãy hủy yêu cầu xác minh trước khi xóa tài khoản này.');
        await flow.remove(storeId, action.account.id);
        if (scopeRef.current !== scope) return;
        setNotice('Đã xóa tài khoản khỏi danh sách ngân hàng.');
      }
      setAction(null);
      setBankRefresh(value => value + 1);
      if (!await loadAccounts()) setNotice(message => `${message} Danh sách chưa cập nhật; hãy tải lại trước khi thao tác tiếp.`);
    } catch (error) { if (scopeRef.current === scope) { setActionError(financeError(error)); await loadAccounts(true); } }
    finally { end(); }
  };
  const isExpired = activeRequest ? financeVerificationExpired(activeRequest, now) : false;
  const isBusy = !!operation;
  const verifiedCount = accounts.filter(account => account.verificationStatus === 'OWNERSHIP_VERIFIED').length;
  const planOverview = subscriptionOverview(subscription, now);
  const price = subscriptionNumber(subscription?.plan?.price);
  const duration = subscriptionNumber(subscription?.plan?.durationDays);
  const maxProducts = subscriptionNumber(subscription?.plan?.maxProducts);
  const entrance = reducedMotion ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold text-[#287DA8]">{user?.store?.name || 'Tài chính cửa hàng'}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{heading.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{heading.description}</p></div>
      <button type="button" className={secondaryButton} disabled={isBusy || subscriptionLoading || accountsLoading} onClick={() => { void loadSubscription(); setHistoryRefresh(value => value + 1); if (canManageBanks) void loadAccounts(); }}><RefreshCw className={`h-4 w-4 ${subscriptionLoading || accountsLoading ? 'motion-safe:animate-spin' : ''}`} />Tải lại</button>
    </header>

    <div hidden={view !== 'banks'} aria-live="polite" aria-atomic="true" className="space-y-2">
      {notice && <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /><p>{notice}</p></div>}
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{actionError}</p>}
      {!storeId && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Chưa xác định được cửa hàng liên kết. Vui lòng đăng nhập lại trước khi quản lý tài khoản ngân hàng.</p>}
    </div>
    <div data-finance-view="current" hidden={view !== 'current'} className="space-y-6">
    <section id="subscription-current" className="scroll-mt-24 grid gap-4" aria-label="Tổng quan tài chính">
      <motion.div {...entrance} className={`${card} min-w-0`} aria-busy={subscriptionLoading}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="shrink-0 rounded-xl bg-sky-50 p-3 text-[#287DA8] dark:bg-sky-950/30"><WalletCards className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Gói thuê gian hàng hiện tại</p><h2 className="mt-1 break-words text-lg font-semibold text-zinc-900 dark:text-white">{subscriptionLoading && !subscription ? 'Đang tải gói dịch vụ…' : subscription?.plan?.planName || subscription?.planName || (subscriptionError ? 'Chưa tải được thông tin' : 'Chưa có gói đang hoạt động')}</h2>{subscription?.plan?.planCode && <p className="mt-1 text-xs text-zinc-400">{subscription.plan.planCode}</p>}</div></div>{!subscriptionLoading && !subscriptionError && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planOverview.urgent ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : planOverview.expiring ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : planOverview.state === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>{planOverview.label}</span>}</div>
        {subscriptionError && <div className="mt-4 text-sm text-rose-700 dark:text-rose-300"><p role="alert">{subscriptionError}</p><button type="button" onClick={() => void loadSubscription()} className="mt-2 font-semibold underline underline-offset-4">Thử lại</button></div>}
        {subscription && <>
          {!subscriptionError && (planOverview.expiring || planOverview.state === 'EXPIRED') && <div role="status" className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${planOverview.urgent ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}><strong>{planOverview.state === 'EXPIRED' ? 'Gói đã đến hạn kết thúc.' : `Gói còn ${planOverview.days} ngày.`}</strong> Liên hệ quản trị viên để kiểm tra phương án gia hạn. Thời điểm hết hạn: {subscriptionDateLabel(subscription.endDate, true)}.</div>}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800 sm:grid-cols-3">
            <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Ngày bắt đầu</dt><dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{subscriptionDateLabel(subscription.startDate)}</dd></div>
            <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Ngày hết hạn</dt><dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{subscriptionDateLabel(subscription.endDate, true)}</dd></div>
            <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Thời gian còn lại</dt><dd className="mt-1 font-semibold tabular-nums text-[#287DA8] dark:text-sky-300">{planOverview.days === null ? '—' : `${planOverview.days} ngày`}</dd></div>
            <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Giá niêm yết hiện tại</dt><dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-white">{subscriptionMoney(price !== null && price >= 0 ? price : null)}</dd></div>
            <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Chu kỳ của gói</dt><dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{duration !== null && duration > 0 ? `${duration} ngày` : '—'}</dd></div>
            <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Giới hạn sản phẩm</dt><dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{maxProducts !== null && maxProducts >= 0 ? `${maxProducts.toLocaleString('vi-VN')} sản phẩm` : '—'}</dd></div>
          </dl>
          {planOverview.progress !== null && <div className="mt-5"><div className="mb-2 flex justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span>{planOverview.state === 'UPCOMING' ? 'Kỳ sử dụng chưa bắt đầu' : 'Thời gian đã sử dụng trong kỳ'}</span><span className="tabular-nums">{Math.round(planOverview.progress)}%</span></div><div role="progressbar" aria-label="Thời gian gói đã sử dụng" aria-valuenow={Math.round(planOverview.progress)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${planOverview.urgent ? 'bg-rose-500' : planOverview.expiring ? 'bg-amber-500' : 'bg-[#287DA8]'}`} style={{ width: `${planOverview.progress}%` }} /></div></div>}
          {subscription.plan?.description && <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{subscription.plan.description}</p>}
          <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{subscription.subscriptionId ? `Mã đăng ký #${subscription.subscriptionId}` : 'Chưa có mã đăng ký'}{subscription.paymentMethod && ` · Phương thức đăng ký: ${{ WALLET: 'Ví cửa hàng', PAYOS: 'PayOS' }[subscription.paymentMethod as string] || subscription.paymentMethod}`}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Giá niêm yết có thể khác số tiền đã đóng. Xem giao dịch thực tế tại mục Chi phí & lịch sử đóng tiền.</p>
        </>}
        {!subscription && !subscriptionLoading && !subscriptionError && <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Chưa có gói đang hoạt động được ghi nhận. Bạn có thể xem các lần đóng phí tại mục Chi phí & lịch sử đóng tiền.</p>}
        <p className="mt-5 flex gap-2 border-t border-zinc-100 pt-4 text-xs leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"><Info className="mt-0.5 h-4 w-4 shrink-0" />Trang hiển thị cảnh báo khi gói còn tối đa 7 ngày. Vui lòng liên hệ quản trị viên nếu cần gia hạn hoặc đổi gói.</p>
      </motion.div>
    </section>
    {view === 'current' && canManageBanks && storeId && <StoreRegisteredPeriods key={scope} storeId={storeId} refreshKey={historyRefresh} />}
    </div>
    <div data-finance-view="payments" hidden={view !== 'payments'}>
      <StoreSubscriptionPayments scope={scope} storeId={storeId} refreshKey={historyRefresh} />
    </div>
    <div data-finance-view="banks" hidden={view !== 'banks'} className="space-y-6">
      <motion.div {...entrance} className={card}>
        <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"><Landmark className="h-5 w-5" /></div><div><p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tài khoản ngân hàng</p><h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">{!canManageBanks ? 'Quản lý bởi chủ cửa hàng' : accountsLoading ? 'Đang tải tài khoản…' : accountsError ? 'Cần tải lại danh sách' : `${verifiedCount} tài khoản đã xác minh`}</h2></div></div>
        <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Tên chủ tài khoản được đối chiếu với ngân hàng. Trạng thái xác minh chỉ thay đổi khi hệ thống nhận kết quả thực tế.</p>
        <Link to="/store/analytics?tab=WALLET" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#287DA8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8]">Mở ví & lịch sử rút tiền<ArrowRight className="h-4 w-4" /></Link>
      </motion.div>

    {canManageBanks && activeRequest && <motion.section {...entrance} className={`${card} border-sky-200 dark:border-sky-900`} aria-labelledby="bank-verification-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#287DA8]">Yêu cầu xác minh đã tạo</p><h2 id="bank-verification-title" className="mt-1 font-semibold text-zinc-900 dark:text-white">{activeRequest.bankName} · {activeRequest.accountNumberMasked}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Tài khoản cần xác minh · {activeRequest.accountName}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isExpired ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}><Clock3 className="h-3.5 w-3.5" />{isExpired ? 'Đã qua hạn hướng dẫn' : 'Đang chờ kết quả'}</span></div>
      {requestChecked ? <BankTransferInstructions key={activeRequest.verificationId} receipt={activeRequest} now={now} /> : <p role="status" className="mt-4 text-sm leading-6 text-amber-800 dark:text-amber-300">Chưa xác nhận lại trạng thái phiên từ máy chủ. Bấm “Kiểm tra kết quả” trước khi chuyển tiền.</p>}
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setActionError(''); setRequestRefresh(value => value + 1); }} disabled={isBusy || accountsLoading} className={secondaryButton}><RefreshCw className="h-4 w-4" />Kiểm tra kết quả</button><button type="button" onClick={() => { setAction({ kind: 'cancel' }); setActionError(''); }} disabled={isBusy} className={secondaryButton}>Hủy yêu cầu</button></div>
      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{isExpired ? 'Không chuyển tiền theo hướng dẫn đã quá hạn. Hãy hủy yêu cầu này trước khi tạo lại.' : 'Trang tự kiểm tra kết quả khi đang mở. Việc tạo yêu cầu chưa có nghĩa là tài khoản đã được xác minh hoặc tiền đã được hoàn.'}</p>
    </motion.section>}
    <section id="store-bank-accounts" className={`${card} scroll-mt-24`} aria-labelledby="bank-accounts-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="bank-accounts-title" className="text-base font-semibold text-zinc-900 dark:text-white">Danh sách tài khoản ngân hàng</h2><p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Chỉ tài khoản đã xác minh chính chủ mới có thể được chọn làm mặc định.</p></div>{canManageBanks && storeId && <button ref={addRef} type="button" className={`${primaryButton} min-h-10 text-sm`} disabled={isBusy || !!activeRequest || !!accountsError || accountsLoading} aria-expanded={formOpen} aria-controls="bank-account-form" onClick={() => { if (formOpen) closeForm(); else setFormOpen(true); }}><Plus className="h-4 w-4" />Thêm tài khoản<ChevronDown className={`h-4 w-4 transition-transform ${formOpen ? 'rotate-180' : ''}`} /></button>}</div>
      {!canManageBanks ? <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">Chỉ chủ cửa hàng có thể xem và quản lý tài khoản ngân hàng. Bạn vẫn có thể xem gói dịch vụ ở phía trên.</div> : <>
        <AnimatePresence initial={false}>{formOpen && <motion.div id="bank-account-form" key="bank-form" initial={{ opacity: reducedMotion ? 1 : 0, height: reducedMotion ? 'auto' : 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: reducedMotion ? 1 : 0, height: reducedMotion ? 'auto' : 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} className="overflow-hidden"><div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-zinc-900 dark:text-white">Xác minh tài khoản mới</h3><button type="button" onClick={closeForm} disabled={isBusy} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] dark:hover:bg-zinc-800" aria-label="Đóng biểu mẫu ngân hàng"><X className="h-4 w-4" /></button></div><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Chọn ngân hàng và nhập số tài khoản. Hệ thống tự tra cứu tên chủ tài khoản sau khi bạn ngừng nhập.</p>
          <form onSubmit={lookupAccount} className="mt-4 space-y-4"><p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">{operation === 'lookup' ? 'Đang tra cứu tên chủ tài khoản…' : 'Tự động tra cứu sau khi ngừng nhập 0,7 giây. Bạn vẫn có thể bấm nút bên dưới để tra cứu lại.'}</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ngân hàng<select ref={formRef} value={bankBin} onChange={event => { setBankBin(event.target.value); clearLookup(); }} className={inputClass} disabled={isBusy || banksLoading} required><option value="">{banksLoading ? 'Đang tải ngân hàng…' : 'Chọn ngân hàng'}</option>{banks.map(bank => <option key={bank.bin} value={bank.bin}>{bank.shortName} — {bank.name}</option>)}</select></label><label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Số tài khoản<input value={accountNumber} onChange={event => { setAccountNumber(event.target.value); clearLookup(); }} className={inputClass} type="text" autoComplete="off" spellCheck={false} minLength={5} maxLength={30} pattern="[0-9a-zA-Z]{5,30}" disabled={isBusy} placeholder="Nhập số tài khoản" required /></label></div>{banksError && <div role="alert" className="text-sm text-rose-700 dark:text-rose-300"><p>{banksError}</p><button type="button" onClick={() => void loadBanks()} disabled={banksLoading} className="mt-1 font-semibold underline underline-offset-4">Tải lại danh sách ngân hàng</button></div>}<button type="submit" disabled={isBusy || !bankBin || !accountNumber.trim() || banksLoading} className={secondaryButton}>{operation === 'lookup' ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Landmark className="h-4 w-4" />}Tra cứu chủ tài khoản</button></form>
          {lookup && <div className="mt-4 rounded-lg border border-sky-200 bg-white p-4 dark:border-sky-900 dark:bg-zinc-900"><p className="text-xs text-zinc-500 dark:text-zinc-400">Tên do ngân hàng cung cấp</p><p className="mt-1 break-words text-base font-semibold text-zinc-900 dark:text-white">{lookup.accountName}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{lookup.bankName} · {lookup.accountNumberMasked}</p><label className="mt-4 flex cursor-pointer items-start gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#287DA8]" checked={nameConfirmed} onChange={event => setNameConfirmed(event.target.checked)} disabled={isBusy} />Tôi đã kiểm tra và xác nhận đây là tài khoản của mình.</label><p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Bước tiếp theo sẽ hiển thị hướng dẫn chuyển tiền do hệ thống cung cấp. Chỉ chuyển khi có đủ thông tin người nhận và phiên còn hạn.</p><button type="button" onClick={createVerification} disabled={isBusy || !nameConfirmed || creationUncertain} className={`${primaryButton} mt-4 min-h-10 text-sm`}>{operation === 'create' ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Tạo yêu cầu xác minh</button></div>}
          {formError && <p role="alert" className="mt-4 text-sm leading-6 text-rose-700 dark:text-rose-300">{formError}</p>}{creationUncertain && <button type="button" disabled={isBusy} className={`${secondaryButton} mt-3`} onClick={async () => { if (!begin("recover")) return; try { await recoverExistingVerification(); } catch (error) { if (scopeRef.current === scope) setFormError(financeError(error)); } finally { end(); } }}><RefreshCw size={16} />Kiểm tra phiên đang chờ</button>}
        </div></motion.div>}</AnimatePresence>
        <AnimatePresence initial={false}>{action && <motion.div key="bank-confirmation" {...entrance} exit={{ opacity: 0 }} className="mt-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/20"><h3 ref={actionRef} tabIndex={-1} className="font-semibold text-zinc-900 outline-none dark:text-white">{action.kind === 'delete' ? 'Xóa tài khoản ngân hàng?' : action.kind === 'default' ? 'Chọn làm tài khoản mặc định?' : 'Hủy yêu cầu xác minh?'}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{action.kind === 'cancel' ? 'Yêu cầu hiện tại sẽ ngừng chờ xác minh. Nếu đã chuyển tiền, hãy kiểm tra với quản trị viên trước khi hủy.' : `${action.account.bankName} · ${action.account.accountNumberMasked} · ${action.account.accountName}`}</p>{action.kind === 'delete' && <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{action.account.isDefault ? 'Tài khoản này đang được đánh dấu mặc định. Sau khi xóa, bạn cần chọn lại một tài khoản đã xác minh khác.' : 'Thao tác xóa không thể hoàn tác. Yêu cầu xác minh đang chờ cần được hủy trước.'}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={isBusy} onClick={confirmAction} className={`${primaryButton} min-h-10 text-sm ${action.kind === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : ''}`}>{operation === 'action' && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}{action.kind === 'delete' ? 'Xác nhận xóa' : action.kind === 'default' ? 'Đặt làm mặc định' : 'Xác nhận hủy'}</button><button type="button" disabled={isBusy} onClick={() => { setAction(null); setActionError(''); }} className={secondaryButton}>Giữ nguyên</button></div></motion.div>}</AnimatePresence>
        {accountsError && <div role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p>{accountsError}</p><button type="button" onClick={() => void loadAccounts()} disabled={accountsLoading} className="mt-1 font-semibold underline underline-offset-4">Tải lại tài khoản</button></div>}
        <div className="mt-4" aria-busy={accountsLoading}>{accountsLoading && accounts.length === 0 ? <div role="status" className="flex items-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 motion-safe:animate-spin" />Đang tải tài khoản ngân hàng…</div> : accounts.length ? <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{accounts.map(account => <li key={account.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="rounded-lg border border-zinc-200 p-2.5 text-[#287DA8] dark:border-zinc-800"><CreditCard className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{account.bankName}</h3>{account.isDefault && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Mặc định</span>}</div><p className="mt-1 break-all text-sm tabular-nums text-zinc-600 dark:text-zinc-300">{account.accountNumberMasked}</p><p className="mt-0.5 break-words text-xs text-zinc-500 dark:text-zinc-400">{account.accountName}</p><p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${account.verificationStatus === 'OWNERSHIP_VERIFIED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>{account.verificationStatus === 'OWNERSHIP_VERIFIED' ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{statusLabel(account.verificationStatus)}</p></div></div><div className="flex flex-wrap gap-2 sm:justify-end">{canSetFinanceDefault(account) && <button type="button" disabled={isBusy || accountsLoading || !!accountsError} onClick={() => { setAction({ kind: 'default', account }); setActionError(''); }} className={secondaryButton}>Đặt mặc định</button>}<button type="button" disabled={isBusy || accountsLoading || !!accountsError || activeRequest?.bankAccountId === String(account.id)} onClick={() => { setAction({ kind: 'delete', account }); setActionError(''); }} className={`${secondaryButton} text-rose-600 dark:text-rose-400`} aria-label={`Xóa tài khoản ${account.bankName} ${account.accountNumberMasked}`} title={activeRequest?.bankAccountId === String(account.id) ? 'Hủy yêu cầu xác minh trước khi xóa tài khoản' : undefined}><Trash2 className="h-4 w-4" />Xóa</button></div></li>)}</ul> : !accountsError && <div className="py-10 text-center"><Landmark className="mx-auto h-7 w-7 text-zinc-400" /><h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Chưa có tài khoản ngân hàng</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">Thêm tài khoản và kiểm tra tên chủ tài khoản để bắt đầu xác minh.</p></div>}</div>
        {!!accounts.length && <p className="border-t border-zinc-100 pt-4 text-xs leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">Yêu cầu đã tạo ở phiên khác có thể được mở lại tại lịch sử xác minh bên dưới. Hủy yêu cầu đang chờ trước khi xóa tài khoản liên quan.</p>}
      </>}
    </section>
    {canManageBanks && storeId && <StoreBankVerificationHistory key={scope} storeId={storeId} refreshKey={bankRefresh} onResume={restoreRequest} />}
    </div>
  </main>;
};
