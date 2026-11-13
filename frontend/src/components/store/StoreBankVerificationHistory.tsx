import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import { createBankingFlow, bankDate, bankMoney, bankRefundMessage, storeFailureMessage, storeVerificationStatus, storeBankNeedsPolling, type BankingPage, type StoreBankTransaction } from '../../services/banking-flow';
import { financeError } from '../../services/store-finance-flow';
import { getApiRetryUntil } from '../../services/request-backoff';
import { BankBadge, BankCopy, BankError, BankPagination, bankButton, bankInput } from '../common/BankingPrimitives';
import { card } from '../../pages/operations/OperationPrimitives';

const flow = createBankingFlow(api);
export const StoreBankVerificationHistory: React.FC<{
  storeId: string; refreshKey: number; onResume: (transaction: StoreBankTransaction, force?: boolean) => void;
}> = ({ storeId, refreshKey, onResume }) => {
  const [result, setResult] = useState<BankingPage<StoreBankTransaction> | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<StoreBankTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const alive = useRef(true);
  const listSequence = useRef(0);
  const listRunning = useRef(0);
  const detailSequence = useRef(0);
  const detailRunning = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const recovery = useRef(onResume);
  recovery.current = onResume;
  useEffect(() => { alive.current = true; return () => { alive.current = false; listSequence.current++; detailSequence.current++; }; }, []);
  const recoverPending = useCallback(async () => {
    try {
      const pending = await flow.storeHistory(storeId, 1, 'PENDING');
      if (alive.current) { setRecoveryError(''); const latest = pending.items.find(item => item.status === 'PENDING' && String(item.storeId) === storeId); if (latest) recovery.current(latest); }
    } catch (error) { if (alive.current) setRecoveryError(financeError(error, 'Chưa thể khôi phục yêu cầu xác minh đang chờ.')); }
  }, [storeId]);
  useEffect(() => { void recoverPending(); }, [recoverPending, refreshKey]);
  const load = useCallback(async () => {
    listRunning.current++;
    const sequence = ++listSequence.current; setLoading(true);
    try { const next = await flow.storeHistory(storeId, page, filter); if (alive.current && sequence === listSequence.current) { setResult(next); setError(''); } }
    catch (error) { if (alive.current && sequence === listSequence.current) setError(financeError(error)); }
    finally { listRunning.current--; if (alive.current && sequence === listSequence.current) setLoading(false); }
  }, [storeId, page, filter]);
  useEffect(() => { void load(); return () => { listSequence.current++; }; }, [load, refreshKey]);
  useEffect(() => {
    if (!result || error || !result.items.some(item => storeBankNeedsPolling(item))) return;
    const refresh = () => { if (document.visibilityState === 'visible' && !getApiRetryUntil() && !listRunning.current) void load(); };
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [result, error, load]);
  const loadDetail = useCallback(async () => {
    if (!selected) return;
    detailRunning.current++;
    const sequence = ++detailSequence.current; setDetailLoading(true);
    try { const next = await flow.storeDetail(storeId, selected); if (alive.current && sequence === detailSequence.current) { setDetail(next); setDetailError(''); } }
    catch (error) { if (alive.current && sequence === detailSequence.current) setDetailError(financeError(error)); }
    finally { detailRunning.current--; if (alive.current && sequence === detailSequence.current) setDetailLoading(false); }
  }, [storeId, selected]);
  useEffect(() => { setDetail(null); setDetailError(''); void loadDetail(); return () => { detailSequence.current++; }; }, [loadDetail, refreshKey]);
  useEffect(() => { if (selected) titleRef.current?.focus(); }, [selected]);
  useEffect(() => {
    if (!detail || detailError || !storeBankNeedsPolling(detail)) return;
    const refresh = () => { if (document.visibilityState === 'visible' && !getApiRetryUntil() && !detailRunning.current) void loadDetail(); };
    const timer = window.setInterval(refresh, 4000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [detail, detailError, loadDetail]);

  return <section id="store-bank-verification-history" className={`${card} scroll-mt-24`} aria-labelledby="store-bank-history-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="store-bank-history-title" className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-white"><History size={18} className="text-[#287DA8]" />Lịch sử xác minh & hoàn tiền</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Đối chiếu từng yêu cầu và mở lại phiên đang chờ của cửa hàng.</p></div><button type="button" className={bankButton} disabled={loading} onClick={() => { void load(); void recoverPending(); }}><RefreshCw size={16} />Tải lại lịch sử</button></div>
    <label className="mt-4 block max-w-xs text-sm text-zinc-700 dark:text-zinc-300">Trạng thái xác minh<select className={bankInput} value={filter} disabled={loading} onChange={event => { setFilter(event.target.value); setPage(1); }}>{[['', 'Tất cả trạng thái'], ['PENDING', 'Chờ xác minh'], ['VERIFIED', 'Đã xác minh'], ['REFUND_PENDING', 'Chờ hoàn tiền'], ['REFUNDED', 'Đã hoàn tiền'], ['FAILED', 'Không thành công'], ['EXPIRED', 'Đã hết hạn']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="mt-4 space-y-3"><BankError message={recoveryError} retry={() => void recoverPending()} /><BankError message={error} retry={() => void load()} busy={loading} /></div>
    <div className="mt-4" aria-busy={loading}>{loading && !result ? <p role="status" className="py-6 text-sm text-zinc-500">Đang tải các phiên xác minh…</p> : result?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Các phiên xác minh ngân hàng của cửa hàng</caption><thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800"><tr>{['Tài khoản / Mã phiên', 'Thời gian', 'Số tiền', 'Xác minh', 'Hoàn tiền', 'Chi tiết'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{result.items.map(item => <tr key={item.verificationId}><td className="max-w-52 px-3 py-4"><p className="font-medium text-zinc-900 dark:text-white">{item.bankName} · {item.accountNumberMasked}</p><p className="mt-1 break-all text-xs text-zinc-500">{item.referenceCode}</p></td><td className="px-3 py-4 text-xs text-zinc-500">{bankDate(item.createdAt)}</td><td className="px-3 py-4 tabular-nums text-zinc-900 dark:text-white">{bankMoney(item.expectedAmount)}<p className="mt-1 text-xs text-zinc-500">Nhận: {bankMoney(item.actualAmount)}</p></td><td className="px-3 py-4"><BankBadge value={storeVerificationStatus(item)} /></td><td className="px-3 py-4"><BankBadge value={item.refundStatus} refund /><p className="mt-2 max-w-56 text-xs leading-5 text-zinc-500">{bankRefundMessage(item.refundStatus, item.expectedAmount)}</p></td><td className="px-3 py-4"><button type="button" className={bankButton} disabled={detailLoading} aria-label={`Xem phiên ${item.referenceCode}`} onClick={() => setSelected(item.verificationId)}>Xem</button></td></tr>)}</tbody></table></div> : !error && <p className="py-8 text-center text-sm text-zinc-500">Không có phiên xác minh phù hợp.</p>}</div>
    {result && <BankPagination page={result.page} pages={result.pages} total={result.total} busy={loading || !!error} onPage={setPage} />}
    {selected && <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-white" aria-busy={detailLoading}><div className="flex items-center justify-between gap-3"><h3 ref={titleRef} tabIndex={-1} className="font-semibold outline-none">Chi tiết phiên #{selected}</h3><button type="button" aria-label="Đóng chi tiết phiên" className={bankButton} disabled={detailLoading} onClick={() => { setSelected(''); setDetail(null); }}><X size={16} /></button></div><div className="mt-3"><BankError message={detailError} retry={() => void loadDetail()} busy={detailLoading} /></div>{detailLoading && !detail && <p role="status" className="mt-4 text-sm text-zinc-500">Đang tải chi tiết…</p>}{detail && <><p className="mt-3 text-sm">{detail.bankName} · {detail.accountNumberMasked} · {detail.accountName}</p><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs text-zinc-500">Mã chuyển khoản</dt><dd className="mt-1 text-sm font-medium"><BankCopy key={detail.referenceCode} value={detail.referenceCode} label="mã chuyển khoản" /></dd></div><div><dt className="text-xs text-zinc-500">Xác minh</dt><dd className="mt-2"><BankBadge value={storeVerificationStatus(detail)} /></dd></div><div><dt className="text-xs text-zinc-500">Hoàn tiền</dt><dd className="mt-2"><BankBadge value={detail.refundStatus} refund /></dd></div><div><dt className="text-xs text-zinc-500">Số tiền yêu cầu / thực nhận</dt><dd className="mt-1 text-sm tabular-nums">{bankMoney(detail.expectedAmount)} / {bankMoney(detail.actualAmount)}</dd></div><div><dt className="text-xs text-zinc-500">Hết hạn lúc</dt><dd className="mt-1 text-sm">{bankDate(detail.expiresAt)}</dd></div><div><dt className="text-xs text-zinc-500">Xác minh lúc</dt><dd className="mt-1 text-sm">{bankDate(detail.verifiedAt)}</dd></div></dl><p role="status" className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{bankRefundMessage(detail.refundStatus, detail.expectedAmount)}</p><p className="mt-2 text-xs leading-5 text-zinc-500">Hệ thống tự xử lý khoản hoàn xác minh về tài khoản nguồn. Bạn không cần tạo yêu cầu hoàn tiền.</p>{detail.failureReason && <p className="mt-4 text-sm text-amber-800 dark:text-amber-300">{storeFailureMessage(detail.failureReason)}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" className={bankButton} disabled={detailLoading} onClick={() => void loadDetail()}><RefreshCw size={16} />Kiểm tra trạng thái</button>{detail.status === 'PENDING' && <button type="button" disabled={!!detailError} className={bankButton} onClick={() => { onResume(detail, true); document.getElementById('bank-verification-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Mở lại yêu cầu / hủy xác minh</button>}</div></>}</div>}
  </section>;
};
