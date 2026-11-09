import './admin-ui.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, Banknote, CheckCircle2, Loader2, RefreshCw, Search, Send, Wallet, XCircle } from 'lucide-react';
import { api, apiSessionMarker } from '../../services/api';
import { useDashboardRefresh } from '../../hooks/useDashboardRefresh';
import { card, primaryButton } from '../operations/OperationPrimitives';
import { adminDate, adminField, adminMoney, adminSecondary, AdminWorkflowDialog, AdminWorkflowNotice, AdminWorkflowStatus } from './AdminWorkflowDialog';
import { asItems, canPayout, checkedData, executeWithdrawalQueue, loadAdminPayoutOverview, payoutDestination, performWithdrawalAction, prepareWithdrawalBatch, withdrawalId, workflowError } from './admin-workflows.mjs';

type Action = 'transfer' | 'reject' | 'payout';
const actionLabels: Record<Action, string> = { transfer: 'Xác nhận đã chuyển khoản', reject: 'Từ chối yêu cầu', payout: 'Chuyển tiền qua PayOS' };

export const AdminPayoutsPage: React.FC = () => {
  const reduced = useReducedMotion();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadSequence = useRef(0);
  const [notice, setNotice] = useState('');
  const [noticeSuccess, setNoticeSuccess] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('PENDING');
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<{ item: any; type: Action } | null>(null);
  const [field, setField] = useState('');
  const [actionError, setActionError] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [batchSnapshot, setBatchSnapshot] = useState<any[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [providerStates, setProviderStates] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current; setLoading(true);
    try {
      const result = await loadAdminPayoutOverview(api, (section, value) => {
        if (sequence !== loadSequence.current) return;
        if (section === 0) { setWithdrawals(asItems(value)); setLoaded(true); setFresh(true); setLoading(false); }
        if (section === 1) setPayouts(asItems(value));
        if (section === 2) setBalance(value);
      });
      if (sequence !== loadSequence.current) return;
      setFresh(result.withdrawals !== undefined);
      if (result.withdrawals !== undefined) { setWithdrawals(result.withdrawals); setLoaded(true); setSelected(ids => ids.filter(id => result.withdrawals!.some((item: any) => withdrawalId(item) === id && canPayout(item)))); }
      if (result.payouts !== undefined) setPayouts(result.payouts);
      setBalance(result.balance ?? null); setErrors(result.errors);
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);
  useDashboardRefresh(() => { if (!busyRef.current && !action && !batchOpen) return load(); }, 'admin-payouts:' + apiSessionMarker());
  const pending = withdrawals.filter(item => item.status === 'PENDING');
  const visible = withdrawals.filter(item => (filter === 'ALL' || item.status === filter) && `${item.withdrawalCode || ''} ${withdrawalId(item)} ${item.wallet?.store?.name || ''}`.toLowerCase().includes(query.toLowerCase()));
  const lock = () => { if (busyRef.current) return false; busyRef.current = true; setBusy(true); return true; };
  const unlock = () => { busyRef.current = false; setBusy(false); };
  const openAction = (item: any, type: Action) => { if (!fresh) return; setField(''); setActionError(''); setAction({ item, type }); };
  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault(); if (!action || !fresh || !lock()) return; setActionError(''); setNotice('');
    try {
      await performWithdrawalAction(api, action.item, action.type, action.type === 'reject' ? { reason: field } : { transferEvidenceUrl: field });
      setNoticeSuccess(true);
      setNotice(action.type === 'payout' ? 'Đã gửi lệnh chuyển tiền. Trạng thái sẽ được cập nhật theo kết quả từ hệ thống.' : action.type === 'reject' ? 'Đã từ chối yêu cầu. Máy chủ đã xử lý hoàn tiền vào ví cửa hàng.' : 'Đã ghi nhận chứng từ và xác nhận chuyển khoản.'); setAction(null);
    } catch (error) { setActionError(workflowError(error)); }
    finally { await load(); unlock(); }
  };
  const sync = async (item: any) => {
    if (!lock()) return; setNotice('');
    try {
      const result = await performWithdrawalAction(api, item, 'sync-payout');
      const provider = result?.statusData?.data || result?.statusData || asItems(result?.listData)[0];
      const state = provider?.status || provider?.approvalState;
      setNoticeSuccess(!!state);
      setProviderStates(previous => ({ ...previous, [withdrawalId(item)]: state ? String(state) : 'UNKNOWN' }));
      setNotice(state ? 'Đã lấy kết quả từ PayOS. Trạng thái yêu cầu rút tiền bên dưới vẫn lấy từ hệ thống.' : 'PayOS chưa trả kết quả cho yêu cầu này. Hãy kiểm tra lại sau.');
    } catch (error) { setNoticeSuccess(false); setNotice(workflowError(error)); }
    finally { await load(); unlock(); }
  };
  const getEstimate = async () => {
    if (!lock()) return; setActionError('');
    try { setEstimate(checkedData(await api.post('/admin/payos/payouts/estimate-credit', prepareWithdrawalBatch(batchSnapshot)))); }
    catch (error) { setActionError(workflowError(error)); } finally { unlock(); }
  };
  const sendBatch = async () => {
    if (!estimate || !fresh || batchResults.length || !lock()) return; setActionError('');
    try {
      const results = await executeWithdrawalQueue(api, batchSnapshot, setBatchResults);
      setNoticeSuccess(results.every(result => result.success));
      setSelected([]); setNotice(`Đã xử lý ${results.length} yêu cầu: ${results.filter(result => result.success).length} lệnh được máy chủ tiếp nhận.`);
    } catch (error) { setActionError(workflowError(error)); } finally { await load(); unlock(); }
  };
  return <motion.main initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="admin-ui admin-payouts mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold text-[#287DA8]">Quản trị hệ thống</p><h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Chi trả cho cửa hàng</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">Kiểm tra tài khoản nhận tiền, xử lý yêu cầu rút và theo dõi kết quả chuyển khoản.</p></div><button type="button" onClick={() => void load()} disabled={loading || busy} className={adminSecondary}><RefreshCw className={`h-4 w-4 ${loading && !reduced ? 'animate-spin' : ''}`} />Tải lại</button></header>
    {notice && <AdminWorkflowNotice success={noticeSuccess}>{notice}</AdminWorkflowNotice>}
    {errors.map(error => <AdminWorkflowNotice key={error.section}>Chưa tải được {error.section}: {error.message}</AdminWorkflowNotice>)}
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Tổng quan chi trả">{[{ icon: Banknote, label: 'Yêu cầu đang chờ', value: loaded ? String(pending.length) : '—' }, { icon: ArrowDownToLine, label: 'Tổng tiền đang chờ', value: loaded ? adminMoney(pending.reduce((sum, item) => sum + Number(item.amount || 0), 0)) : '—' }, { icon: Wallet, label: 'Số dư chi trả PayOS', value: balance ? adminMoney(balance.balance ?? balance.data?.balance) : 'Chưa tải được' }].map(({ icon: Icon, label, value }) => <div key={label} className={card}><Icon className="mb-3 h-5 w-5 text-[#287DA8]" /><p className="break-words text-xl font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p><p className="mt-1 text-sm text-zinc-500">{label}</p></div>)}</section>
    <section className={`${card} !p-4 sm:!p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-zinc-900 dark:text-white">Yêu cầu rút tiền</h2><button type="button" disabled={!fresh || !selected.length || busy || loading} onClick={() => { setBatchSnapshot(withdrawals.filter(item => selected.includes(withdrawalId(item)))); setBatchOpen(true); setEstimate(null); setBatchResults([]); setActionError(''); }} className={primaryButton}><Send className="h-4 w-4" />Chi trả mục đã chọn ({selected.length})</button></div>
      <div className="my-4 flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><span className="sr-only">Tìm yêu cầu hoặc cửa hàng</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã yêu cầu hoặc tên cửa hàng" className={`${adminField} !pl-9`} /></label><label><span className="sr-only">Trạng thái yêu cầu</span><select value={filter} onChange={event => setFilter(event.target.value)} className={adminField}><option value="PENDING">Chờ xử lý</option><option value="PROCESSING">Đang chuyển tiền</option><option value="TRANSFERRED">Đã chuyển khoản</option><option value="REJECTED">Đã từ chối</option><option value="FAILED">Không thành công</option><option value="ALL">Tất cả trạng thái</option></select></label></div>
      {loading && !loaded ? <p role="status" className="py-12 text-center text-sm text-zinc-500">Đang tải yêu cầu rút tiền…</p> : !loaded ? <p className="py-10 text-center text-sm text-zinc-500">Chưa lấy được danh sách. Vui lòng tải lại.</p> : !visible.length ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-zinc-300" /><p className="text-sm text-zinc-500">Không có yêu cầu phù hợp.</p></div> : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{visible.map(item => {
        const id = withdrawalId(item); const destination = payoutDestination(item);
        return <article key={id} className="py-5 first:pt-1 last:pb-0"><div className="flex items-start gap-3"><input type="checkbox" aria-label={`Chọn yêu cầu ${item.withdrawalCode || id}`} checked={selected.includes(id)} disabled={!fresh || !canPayout(item) || busy || loading} onChange={event => setSelected(ids => event.target.checked ? [...ids, id] : ids.filter(value => value !== id))} className="mt-1 h-4 w-4 rounded border-zinc-300 accent-[#287DA8]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="break-words font-semibold text-zinc-900 dark:text-white">{item.wallet?.store?.name || `Cửa hàng #${item.wallet?.storeId || '—'}`}</p><p className="mt-1 break-all text-xs text-zinc-500">{item.withdrawalCode || `Yêu cầu #${id}`} · {adminDate(item.requestedAt)}</p></div><AdminWorkflowStatus value={item.status} /></div><p className="mt-3 text-xl font-semibold tabular-nums text-zinc-900 dark:text-white">{adminMoney(item.amount)}</p><p className="mt-2 break-words text-sm text-zinc-600 dark:text-zinc-300">{item.bankAccountHolder || item.bankAccountName || item.wallet?.bankAccountHolder || item.wallet?.bankAccountName || 'Chưa có tên người nhận'} · {destination.toAccountNumber || 'Chưa có số tài khoản'}</p><p className="mt-1 text-xs text-zinc-500">Ngân hàng: {item.bankName || item.wallet?.bankName || item.bankCode || destination.toBin || 'Chưa có thông tin'}</p>{item.rejectionReason && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">Lý do từ chối: {item.rejectionReason}</p>}{providerStates[id] && <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">Kết quả PayOS: <AdminWorkflowStatus value={providerStates[id]} /></p>}
          <div className="mt-4 flex flex-wrap gap-2">{item.status === 'PENDING' && <><button type="button" onClick={() => openAction(item, 'payout')} disabled={!fresh || busy || loading || !canPayout(item)} className={primaryButton}><Send className="h-4 w-4" />Chuyển qua PayOS</button><button type="button" onClick={() => openAction(item, 'transfer')} disabled={!fresh || busy || loading} className={adminSecondary}>Đã chuyển khoản</button><button type="button" onClick={() => openAction(item, 'reject')} disabled={!fresh || busy || loading} className={`${adminSecondary} !text-rose-700 dark:!text-rose-300`}><XCircle className="h-4 w-4" />Từ chối</button></>}{(item.providerPayoutId || item.providerReferenceId) && <button type="button" onClick={() => void sync(item)} disabled={!fresh || busy || loading} className={adminSecondary}><RefreshCw className="h-4 w-4" />Kiểm tra PayOS</button>}</div>{item.status === 'PENDING' && !canPayout(item) && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Chưa đủ thông tin ngân hàng hợp lệ để chuyển qua PayOS.</p>}
        </div></div></article>;
      })}</div>}
    </section>
    <details className={card}><summary className="cursor-pointer font-semibold text-zinc-900 dark:text-white">Lịch sử lệnh chi PayOS ({payouts.length})</summary><div className="mt-4 space-y-3">{payouts.length ? payouts.map((item, index) => <div key={item.id || index} className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800"><div className="min-w-0"><p className="break-all font-medium">{item.referenceId || item.id || `Lệnh chi ${index + 1}`}</p><p className="text-zinc-500">{adminMoney(item.amount)} · {adminDate(item.createdAt)}</p></div><AdminWorkflowStatus value={item.status || item.approvalState} /></div>) : <p className="text-sm text-zinc-500">Chưa có lệnh chi được tải.</p>}</div></details>
    {action && <AdminWorkflowDialog title={actionLabels[action.type]} onClose={() => setAction(null)} busy={busy}><form onSubmit={submitAction} className="space-y-4"><div className="rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800"><p className="font-semibold">{action.item.wallet?.store?.name || `Yêu cầu #${withdrawalId(action.item)}`}</p><p className="mt-1 text-lg font-semibold">{adminMoney(action.item.amount)}</p><p className="mt-1 break-all text-zinc-500">{payoutDestination(action.item).toAccountNumber || 'Chưa có số tài khoản'}</p></div>{action.type === 'payout' ? <p className="text-sm text-zinc-600 dark:text-zinc-300">Xác nhận gửi lệnh chuyển tiền tới tài khoản trên. Chỉ bấm một lần và chờ kết quả từ hệ thống.</p> : <label className="block text-sm font-medium">{action.type === 'reject' ? 'Lý do từ chối' : 'Đường dẫn chứng từ chuyển khoản'}{action.type === 'reject' ? <textarea required maxLength={1000} value={field} onChange={event => setField(event.target.value)} rows={3} disabled={busy} className={`${adminField} mt-2`} placeholder="Giải thích để cửa hàng biết cách xử lý" /> : <input type="url" required value={field} onChange={event => setField(event.target.value)} disabled={busy} className={`${adminField} mt-2`} placeholder="https://…" />}</label>}{action.type === 'transfer' && <p className="text-xs text-zinc-500">Chỉ xác nhận sau khi đã chuyển tiền thành công qua ngân hàng.</p>}{actionError && <AdminWorkflowNotice>{actionError}</AdminWorkflowNotice>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setAction(null)} className={adminSecondary}>Để sau</button><button type="submit" disabled={busy} className={primaryButton}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? 'Đang xử lý…' : actionLabels[action.type]}</button></div></form></AdminWorkflowDialog>}
    {batchOpen && <AdminWorkflowDialog title="Chi trả các yêu cầu đã chọn" onClose={() => setBatchOpen(false)} busy={busy}><div className="space-y-4"><p className="text-sm text-zinc-600 dark:text-zinc-300">Mỗi yêu cầu được gửi và theo dõi riêng. Hệ thống chỉ tiếp nhận yêu cầu còn đang chờ xử lý.</p><div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800"><p className="font-semibold">{batchSnapshot.length} yêu cầu · {adminMoney(batchSnapshot.reduce((sum, item) => sum + Number(item.amount), 0))}</p><ul className="mt-3 max-h-44 space-y-2 overflow-y-auto text-sm">{batchSnapshot.map(item => <li key={withdrawalId(item)} className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.wallet?.store?.name || item.withdrawalCode}</span><span className="shrink-0">{adminMoney(item.amount)}</span></li>)}</ul></div>{estimate && <AdminWorkflowNotice success>Đã kiểm tra dự kiến chi trả.{estimate.estimateCredit !== undefined ? ` Chi phí dự kiến: ${adminMoney(estimate.estimateCredit)}.` : ' Có thể tiếp tục gửi các lệnh chi.'}</AdminWorkflowNotice>}{batchResults.map(result => <AdminWorkflowNotice key={result.id} success={result.success}>Yêu cầu #{result.id}: {result.success ? 'Máy chủ đã tiếp nhận lệnh chi.' : result.message}</AdminWorkflowNotice>)}{actionError && <AdminWorkflowNotice>{actionError}</AdminWorkflowNotice>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setBatchOpen(false)} className={adminSecondary}>{batchResults.length ? 'Đóng' : 'Để sau'}</button>{!batchResults.length && (!estimate ? <button type="button" disabled={busy || !batchSnapshot.length} onClick={() => void getEstimate()} className={primaryButton}>{busy ? 'Đang kiểm tra…' : 'Kiểm tra trước khi chuyển'}</button> : <button type="button" disabled={busy} onClick={() => void sendBatch()} className={primaryButton}>{busy ? 'Đang gửi lệnh…' : 'Xác nhận chuyển tiền'}</button>)}</div></div></AdminWorkflowDialog>}
  </motion.main>;
};
