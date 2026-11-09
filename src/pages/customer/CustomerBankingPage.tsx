import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, ExternalLink, Landmark, Loader2, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { financeError } from '../../services/store-finance-flow';
import { getApiRetryUntil } from '../../services/request-backoff';
import { bankCheckoutUrl, bankDate, bankMoney, bankSessionExpired, createBankingFlow, customerBankNeedsPolling, customerBankPayload, type BankOption, type BankingPage, type CustomerBankAccount, type CustomerBankHistory, type CustomerBankSession, type CustomerBankStatus } from '../../services/banking-flow';
import { BankBadge, BankCopy, BankError, BankPagination, bankButton, bankInput } from '../../components/common/BankingPrimitives';
import { card, primaryButton } from '../operations/OperationPrimitives';

const flow = createBankingFlow(api);
export const CustomerBankingPage: React.FC = () => {
  const { user } = useAuth();
  return user?.role === 'CUSTOMER' ? <CustomerBankingWorkspace key={user.id} /> : null;
};
export const CustomerBankingWorkspace: React.FC = () => {
  const [accounts, setAccounts] = useState<CustomerBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [bankBin, setBankBin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<CustomerBankAccount | null>(null);
  const selectedRef = useRef('');
  const [status, setStatus] = useState<CustomerBankStatus | null>(null);
  const [checkout, setCheckout] = useState<CustomerBankSession | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [history, setHistory] = useState<BankingPage<CustomerBankHistory> | null>(null);
  const [page, setPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [now, setNow] = useState(Date.now());
  const alive = useRef(true);
  const historySequence = useRef(0);
  const statusSequence = useRef(0);
  const accountsSequence = useRef(0);
  const statusRunning = useRef(false);
  const formRef = useRef<HTMLSelectElement>(null);
  const detailRef = useRef<HTMLHeadingElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; historySequence.current++; statusSequence.current++; accountsSequence.current++; }; }, []);

  const loadAccounts = useCallback(async () => {
    const sequence = ++accountsSequence.current;
    setLoading(true);
    try { const list = await flow.customerAccounts(); if (alive.current && sequence === accountsSequence.current) { setAccounts(list); setAccountsError(''); } }
    catch (error) { if (alive.current && sequence === accountsSequence.current) setAccountsError(financeError(error)); }
    finally { if (alive.current && sequence === accountsSequence.current) setLoading(false); }
  }, []);
  const loadHistory = useCallback(async () => {
    const sequence = ++historySequence.current;
    setHistoryLoading(true);
    try { const result = await flow.customerHistory(page); if (alive.current && sequence === historySequence.current) { setHistory(result); setHistoryError(''); } }
    catch (error) { if (alive.current && sequence === historySequence.current) setHistoryError(financeError(error)); }
    finally { if (alive.current && sequence === historySequence.current) setHistoryLoading(false); }
  }, [page]);
  const loadBanks = useCallback(async () => {
    setBanksLoading(true);
    try { const list = await flow.banks(); if (alive.current) { setBanks(list); setBanksError(''); } }
    catch (error) { if (alive.current) setBanksError(financeError(error)); }
    finally { if (alive.current) setBanksLoading(false); }
  }, []);
  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => { void loadHistory(); return () => { historySequence.current++; }; }, [loadHistory]);
  useEffect(() => { if (formOpen && !banks.length && !banksLoading && !banksError) void loadBanks(); }, [formOpen, banks.length, banksLoading, banksError, loadBanks]);
  useEffect(() => { if (formOpen) formRef.current?.focus(); }, [formOpen]);

  const loadStatus = useCallback(async (accountId: string) => {
    if (statusRunning.current || !alive.current) return;
    statusRunning.current = true;
    const sequence = ++statusSequence.current;
    setStatusLoading(true);
    try {
      const result = await flow.customerStatus(accountId);
      if (alive.current && selectedRef.current === accountId && sequence === statusSequence.current) {
        setStatus(result); setStatusError('');
        setAccounts(list => list.map(account => account.id === accountId ? { ...account, verificationStatus: result.accountVerificationStatus } : account));
      }
    } catch (error) { if (alive.current && selectedRef.current === accountId && sequence === statusSequence.current) setStatusError(financeError(error)); }
    finally { statusRunning.current = false; if (alive.current && selectedRef.current === accountId && sequence === statusSequence.current) setStatusLoading(false); }
  }, []);
  useEffect(() => {
    const refresh = () => {
      const clock = Date.now(); setNow(clock);
      if (document.visibilityState === 'visible' && !getApiRetryUntil() && !busyRef.current && !statusError
        && selected && customerBankNeedsPolling(status, clock)) void loadStatus(selected.id);
    };
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [selected, status, statusError, loadStatus]);
  const selectAccount = (account: CustomerBankAccount) => {
    if (busyRef.current || statusRunning.current) return;
    selectedRef.current = account.id; setSelected(account); setStatus(null); setCheckout(null); setStatusError('');
    void loadStatus(account.id);
  };
  useEffect(() => { if (selected) detailRef.current?.focus(); }, [selected]);
  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current || statusRunning.current || !confirmed || uncertain || accountsError) return;
    busyRef.current = true; setBusy('create'); setFormError(''); setNotice('');
    let dispatched = false;
    try {
      const bank = banks.find(item => item.bin === bankBin);
      if (!bank) throw new Error('Vui lòng chọn ngân hàng trong danh sách.');
      const payload = customerBankPayload(bank, accountNumber, accountName, isDefault);
      dispatched = true;
      const account = await flow.addCustomerAccount(payload);
      if (!alive.current) return;
      setFormOpen(false); setAccountNumber(''); setAccountName(''); setConfirmed(false);
      setNotice('Đã thêm tài khoản. Hãy xác minh chính chủ trước khi sử dụng để nhận hoàn tiền.');
      selectAfterCreate(account);
      await loadAccounts();
    } catch (error: any) {
      if (!alive.current) return;
      const ambiguous = dispatched && (!error?.response || error.response.status >= 500);
      setUncertain(ambiguous);
      setFormError(financeError(error));
      if (ambiguous) { setFormError('Chưa xác nhận được kết quả thêm tài khoản. Hãy tải lại danh sách trước khi nhập lại để tránh trùng.'); await loadAccounts(); }
    } finally { if (alive.current) { busyRef.current = false; setBusy(''); } }
  };
  const selectAfterCreate = (account: CustomerBankAccount) => {
    selectedRef.current = account.id; setSelected(account); setStatus(null); setCheckout(null); setStatusError(''); void loadStatus(account.id);
  };
  const initiate = async () => {
    if (!selected || busyRef.current || statusRunning.current || accountsError || statusError || !status) return;
    busyRef.current = true; setBusy('initiate'); setStatusError('');
    try {
      const result = await flow.initiateCustomerVerification(selected.id);
      if (!alive.current || selectedRef.current !== selected.id) return;
      setCheckout(result); setNow(Date.now());
      await Promise.all([loadStatus(selected.id), loadHistory()]);
    } catch (error) {
      if (alive.current && selectedRef.current === selected.id) setStatusError(financeError(error));
    } finally { if (alive.current) { busyRef.current = false; setBusy(''); } }
  };
  const session = status?.session;
  const effectiveReference = session?.sessionReference || checkout?.sessionReference;
  const checkoutCurrent = checkout && (!session || session.sessionReference === checkout.sessionReference);
  const payable = !statusError && checkoutCurrent && checkout.sessionStatus === 'ACTIVE' && !bankSessionExpired(checkout.expiresAt, now)
    && !session?.isExpired && status?.accountVerificationStatus !== 'VERIFIED' && (!session || session.paymentStatus === 'PENDING');
  const checkoutUrl = payable ? bankCheckoutUrl(checkout.checkoutUrl) : null;
  const verified = status?.accountVerificationStatus === 'VERIFIED';
  const summary = session?.refundSummary;

  return <main className="mx-auto w-full max-w-6xl space-y-6 py-2 text-zinc-900 dark:text-zinc-100">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold text-[#287DA8] dark:text-sky-300">Tài khoản của bạn</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Ngân hàng & hoàn tiền</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">Quản lý tài khoản nhận hoàn cọc, xác minh chính chủ và theo dõi khoản tiền xác minh được hoàn lại.</p></div><button type="button" className={bankButton} disabled={loading || historyLoading || !!busy} onClick={() => { void loadAccounts(); void loadHistory(); if (selected) void loadStatus(selected.id); }}><RefreshCw size={16} />Tải lại</button></header>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</p>}
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Tổng quan tài khoản ngân hàng">{[[Landmark, 'Tài khoản đã thêm', accountsError ? '—' : loading && !accounts.length ? '…' : accounts.length], [ShieldCheck, 'Đã xác minh chính chủ', accountsError ? '—' : loading && !accounts.length ? '…' : accounts.filter(a => a.verificationStatus === 'VERIFIED').length], [CreditCard, 'Tài khoản mặc định', accountsError ? 'Chưa tải được' : accounts.find(a => a.isDefault)?.bankName || 'Chưa thiết lập']].map(([Icon, label, value]: any) => <div key={label} className={card}><Icon className="h-5 w-5 text-[#287DA8]" /><p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</section>
    <section className={card} aria-labelledby="customer-banks-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="customer-banks-title" className="font-semibold">Tài khoản nhận hoàn tiền</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Dùng tài khoản đứng tên bạn để hệ thống đối chiếu giao dịch.</p></div><button ref={addRef} type="button" className={`${primaryButton} min-h-11 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#287DA8]`} disabled={!!busy || statusLoading || loading || !!accountsError} aria-expanded={formOpen} aria-controls="customer-bank-form" onClick={() => { setFormOpen(value => !value); setFormError(''); setUncertain(false); }}><Plus size={16} />Thêm tài khoản</button></div>
      <div className="mt-4"><BankError message={accountsError} retry={() => void loadAccounts()} busy={loading} /></div>
      {formOpen && <form id="customer-bank-form" onSubmit={createAccount} className="mt-5 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Thêm tài khoản ngân hàng</h3><button type="button" disabled={!!busy} aria-label="Đóng biểu mẫu ngân hàng" className={bankButton} onClick={() => { setFormOpen(false); addRef.current?.focus(); }}><X size={16} /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Ngân hàng<select ref={formRef} className={bankInput} value={bankBin} required disabled={banksLoading || !!busy} onChange={event => { setBankBin(event.target.value); setConfirmed(false); }}><option value="">{banksLoading ? 'Đang tải ngân hàng…' : 'Chọn ngân hàng'}</option>{banks.map(bank => <option key={bank.bin} value={bank.bin}>{bank.shortName} — {bank.name}</option>)}</select></label><label className="text-sm">Số tài khoản<input className={bankInput} required type="text" inputMode="numeric" pattern="[0-9]{6,20}" minLength={6} maxLength={20} autoComplete="off" disabled={!!busy} value={accountNumber} onChange={event => { setAccountNumber(event.target.value); setConfirmed(false); }} /></label></div><label className="block text-sm">Tên chủ tài khoản<input className={bankInput} required maxLength={150} autoComplete="name" placeholder="Ví dụ: NGUYEN VAN A" disabled={!!busy} value={accountName} onChange={event => { setAccountName(event.target.value); setConfirmed(false); }} /><span className="mt-1 block text-xs text-zinc-500">Nhập đúng tên tại ngân hàng. Tên nhập vào sẽ được đối chiếu trong bước xác minh.</span></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={isDefault} disabled={!!busy} onChange={event => setIsDefault(event.target.checked)} className="mt-1 h-4 w-4 accent-[#287DA8]" />Chọn tài khoản này để nhận hoàn tiền mặc định</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} disabled={!!busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#287DA8]" />Tôi xác nhận thông tin đã nhập là tài khoản ngân hàng của mình.</label><BankError message={banksError} retry={() => void loadBanks()} busy={banksLoading} /><BankError message={formError} /><button type="submit" className={`${primaryButton} min-h-11 text-sm`} disabled={!!busy || statusLoading || !confirmed || !bankBin || !!banksError || banksLoading || uncertain || !!accountsError}>{busy === 'create' && <Loader2 size={16} className="motion-safe:animate-spin" />}Lưu tài khoản</button></form>}
      <div aria-busy={loading} className="mt-4">{loading && !accounts.length ? <p role="status" className="py-8 text-sm text-zinc-500">Đang tải tài khoản…</p> : accounts.length ? <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{accounts.map(account => <li key={account.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{account.bankName}</h3>{account.isDefault && <span className="text-xs text-[#287DA8] dark:text-sky-300">Mặc định</span>}<BankBadge value={account.verificationStatus} /></div><p className="mt-2 text-sm tabular-nums">{account.accountNumberMasked}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{account.accountName}</p></div><button type="button" className={bankButton} disabled={!!busy || statusLoading || loading || !!accountsError} aria-pressed={selected?.id === account.id} onClick={() => selectAccount(account)}>Xem xác minh & hoàn tiền</button></li>)}</ul> : !accountsError && <div className="py-8 text-center"><Landmark className="mx-auto h-8 w-8 text-zinc-400" /><h3 className="mt-3 text-sm font-semibold">Chưa có tài khoản ngân hàng</h3><p className="mt-1 text-sm text-zinc-500">Thêm tài khoản để chuẩn bị nhận hoàn cọc khi kết thúc hợp đồng thuê.</p></div>}</div>
    </section>
    {selected && <section className={`${card} border-sky-200 dark:border-sky-900`} aria-labelledby="customer-bank-session-title" aria-busy={statusLoading}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 ref={detailRef} tabIndex={-1} id="customer-bank-session-title" className="font-semibold outline-none">{selected.bankName} · {selected.accountNumberMasked}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{selected.accountName}</p></div>{status && <BankBadge value={status.accountVerificationStatus} />}</div><div className="mt-4"><BankError message={statusError} retry={() => void loadStatus(selected.id)} busy={statusLoading || !!busy} /></div>{statusLoading && !status && <p role="status" className="mt-4 text-sm text-zinc-500">Đang kiểm tra phiên xác minh…</p>}{status && <><p role="status" className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{status.message}</p>{session && <><dl className="mt-5 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-zinc-500">Xác minh phiên</dt><dd className="mt-2"><BankBadge value={session.verificationStatus} /></dd></div><div><dt className="text-xs text-zinc-500">Thanh toán xác minh</dt><dd className="mt-2"><BankBadge value={session.paymentStatus} /></dd></div><div><dt className="text-xs text-zinc-500">Hoàn tiền xác minh</dt><dd className="mt-2"><BankBadge value={session.refundStatus} /></dd></div></dl><p className="mt-4 text-xs text-zinc-500">Hạn phiên: {bankDate(session.expiresAt)}{session.isExpired || bankSessionExpired(session.expiresAt, now) ? ' · Đã hết hạn chuyển tiền' : ''}</p>{session.rejectionReason && <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">{session.rejectionReason}</p>}</>}{summary && <dl className="mt-5 grid gap-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950/50 sm:grid-cols-3">{[['Cần hoàn', summary.totalObligationAmount], ['Đã hoàn', summary.totalRefundedAmount], ['Còn chờ hoàn', summary.totalPendingRefundAmount]].map(([label, amount]) => <div key={String(label)}><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{bankMoney(amount)}</dd></div>)}</dl>}</>}{effectiveReference && <p className="mt-4 text-xs text-zinc-500">Mã phiên: <BankCopy key={effectiveReference} value={effectiveReference} label="mã phiên xác minh" /></p>}{checkoutUrl && <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20"><p className="text-sm font-semibold">Xác minh bằng {bankMoney(checkout?.amount)}</p><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Chuyển từ đúng tài khoản vừa đăng ký. Hãy hoàn tất trước {bankDate(checkout?.expiresAt)}. Kết quả và tiền hoàn được cập nhật sau khi hệ thống đối soát.</p><a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className={`${primaryButton} mt-4 min-h-11 text-sm`}>Mở thanh toán PayOS<ExternalLink size={16} /></a></div>}{checkout && bankSessionExpired(checkout.expiresAt, now) && <p className="mt-4 text-sm text-amber-800 dark:text-amber-300">Liên kết thanh toán đã hết hạn. Không sử dụng lại mã hoặc QR cũ.</p>}<div className="mt-5 flex flex-wrap gap-2">{!verified && <button type="button" onClick={initiate} disabled={!!busy || statusLoading || !status || !!statusError || !!accountsError || !!checkoutUrl} className={`${primaryButton} min-h-11 text-sm`}>{busy === 'initiate' ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <ShieldCheck size={16} />}{session && !session.isExpired && !bankSessionExpired(session.expiresAt, now) ? 'Tiếp tục phiên xác minh' : 'Bắt đầu xác minh'}</button>}<button type="button" className={bankButton} disabled={statusLoading || !!busy} onClick={() => { void loadStatus(selected.id); void loadHistory(); }}><RefreshCw size={16} />Kiểm tra kết quả</button></div><p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Hệ thống tự kiểm tra khi trang đang mở và còn giao dịch cần xử lý. Việc quay lại từ PayOS chưa đồng nghĩa xác minh hoặc hoàn tiền đã thành công.</p></section>}
    <section className={card} aria-labelledby="customer-bank-history-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="customer-bank-history-title" className="font-semibold">Lịch sử xác minh & hoàn tiền</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Khoản chuyển xác minh ngân hàng; tiền hoàn cọc hợp đồng được theo dõi tại hợp đồng thuê.</p></div><button type="button" className={bankButton} disabled={historyLoading} onClick={() => void loadHistory()}><RefreshCw size={16} />Làm mới lịch sử</button></div><div className="mt-4"><BankError message={historyError} retry={() => void loadHistory()} busy={historyLoading} /></div><div aria-busy={historyLoading} className="mt-4">{historyLoading && !history ? <p role="status" className="py-6 text-sm text-zinc-500">Đang tải lịch sử…</p> : history?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left text-sm"><caption className="sr-only">Lịch sử phiên xác minh và số tiền đã nhận, đã hoàn</caption><thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800"><tr>{['Phiên xác minh', 'Kết quả', 'Thực nhận', 'Đã hoàn / Còn chờ', 'Trạng thái hoàn'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{history.items.map(item => <tr key={item.sessionId}><td className="max-w-64 px-3 py-4"><p className="break-all font-medium">{item.sessionReference}</p><p className="mt-1 text-xs text-zinc-500">{bankDate(item.createdAt)}</p><p className="mt-1 text-xs text-zinc-500">Hạn: {bankDate(item.expiresAt)}</p></td><td className="px-3 py-4"><BankBadge value={item.verificationStatus} /><p className="mt-2 text-xs text-zinc-500">{bankStatusLabelForSession(item.sessionStatus)}</p></td><td className="px-3 py-4 tabular-nums">{item.paymentReceived ? bankMoney(item.receivedAmount) : 'Chưa ghi nhận'}</td><td className="px-3 py-4 tabular-nums">{bankMoney(item.totalRefundedAmount)}<p className="mt-1 text-xs text-zinc-500">Chờ: {bankMoney(item.totalPendingRefundAmount)}</p></td><td className="px-3 py-4"><BankBadge value={item.refundStatus} /></td></tr>)}</tbody></table></div> : !historyError && <p className="py-8 text-center text-sm text-zinc-500">Chưa có phiên xác minh ngân hàng.</p>}</div>{history && <BankPagination page={history.page} pages={history.pages} total={history.total} busy={historyLoading || !!historyError} onPage={setPage} />}</section>
  </main>;
};
const bankStatusLabelForSession = (value: string) => ({ ACTIVE: 'Phiên đang mở', CONSUMED: 'Đã hoàn tất phiên', EXPIRED: 'Phiên hết hạn', CANCELLED: 'Phiên đã hủy' }[value] || value);
