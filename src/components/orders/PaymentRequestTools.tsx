import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ChevronDown, FileText, Loader2, RefreshCw, Unlink, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { paymentsService } from '../../services/payments.service';
import { normalizeOrder, publishOrderEvent } from '../../services/order-events';
import { cancelPendingPaymentLink, paymentToolError, readKnownPaymentTransaction, refreshPaymentRecords, validPaymentOrderCode } from './payment-request-tools.mjs';

type Records = { provider: any; order: any };
type Props = { orderCode: string | number; orderId: string | number; transactionId?: string | number; linkStatus?: string; disabled?: boolean; onRefresh?: (records: Records) => void };
const statusNames: Record<string, string> = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', SUCCESS: 'Thành công', COMPLETED: 'Hoàn tất', CANCELLED: 'Liên kết đã hủy', FAILED: 'Không thành công', EXPIRED: 'Đã hết hạn', PROCESSING: 'Đang xử lý' };
const smallButton = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8]';

function CancelLinkDialog({ busy, error, onClose, onSubmit }: { busy: boolean; error: string; onClose: () => void; onSubmit: (reason: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId(); const reduced = useReducedMotion(); const [reason, setReason] = useState('');
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => { dialog.current?.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }} className="fixed inset-0 z-[150] m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"><motion.form initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} onSubmit={event => { event.preventDefault(); onSubmit(reason); }} className="space-y-4 p-5"><div className="flex items-start justify-between gap-4"><h3 id={titleId} className="text-lg font-semibold">Hủy liên kết thanh toán?</h3><button type="button" aria-label="Đóng xác nhận" disabled={busy} onClick={onClose} className={`${smallButton} -mr-2 -mt-2 text-slate-500`}><X className="h-4 w-4" /></button></div><p className="text-sm leading-relaxed text-slate-600">Thao tác này chỉ hủy liên kết PayOS đang chờ thanh toán. <strong className="font-semibold text-slate-800">Đơn hàng vẫn được giữ nguyên.</strong></p><label className="block text-sm font-medium text-slate-700">Lý do <span className="font-normal text-slate-500">(không bắt buộc)</span><textarea rows={2} maxLength={200} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-sky-100" placeholder="Ví dụ: Tôi muốn dừng thanh toán liên kết này" /></label>{error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className={`${smallButton} border border-slate-200 text-slate-700 hover:bg-slate-50`}>Giữ liên kết</button><button type="submit" disabled={busy} className={`${smallButton} bg-rose-600 text-white hover:bg-rose-700`}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? 'Đang kiểm tra và hủy…' : 'Xác nhận hủy liên kết'}</button></div></motion.form></dialog>;
}

export const PaymentRequestTools: React.FC<Props> = ({ orderCode, orderId, transactionId, linkStatus, disabled = false, onRefresh }) => {
  const { isAuthenticated } = useAuth(); const reduced = useReducedMotion();
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [dialogError, setDialogError] = useState(''); const [message, setMessage] = useState(''); const [provider, setProvider] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false); const [transaction, setTransaction] = useState<any>(null); const [detailBusy, setDetailBusy] = useState(false); const [detailError, setDetailError] = useState(''); const lock = useRef(false); const detailLock = useRef(false); const sequence = useRef(0); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current += 1; }; }, []);
  useEffect(() => { sequence.current += 1; setConfirm(false); setDialogError(''); setMessage(''); setProvider(null); setTransaction(null); setDetailOpen(false); setDetailError(''); }, [orderCode, orderId]);
  const refresh = async () => {
    const current = sequence.current;
    const records = await refreshPaymentRecords(paymentsService, api, orderCode, orderId);
    if (records.order) publishOrderEvent('ORDER_PAYMENT_CHANGED', { order: normalizeOrder(records.order) });
    if (mounted.current && current === sequence.current) { if (records.provider) setProvider(records.provider); onRefresh?.(records); }
    return records;
  };
  const cancel = async (reason: string) => {
    if (disabled || lock.current) return; lock.current = true; setBusy(true); setDialogError(''); setMessage('');
    let completed = false;
    try { const result = await cancelPendingPaymentLink(paymentsService, orderCode, reason); setProvider(result.link); setConfirm(false); setMessage(result.alreadyCancelled ? 'PayOS xác nhận liên kết này đã được hủy trước đó. Đơn hàng vẫn giữ nguyên.' : 'PayOS đã xác nhận hủy liên kết thanh toán. Đơn hàng vẫn giữ nguyên.'); completed = true; }
    catch (error) { setDialogError(paymentToolError(error)); }
    finally {
      try { const records = await refresh(); if (records.warnings.length) { const warning = records.warnings.join(' '); if (completed) setMessage(value => `${value} ${warning}`); else setDialogError(value => `${value} ${warning}`); } }
      finally { lock.current = false; setBusy(false); }
    }
  };
  const check = async () => {
    if (disabled || lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try { const records = await refresh(); setMessage(records.warnings.join(' ') || `Cổng thanh toán: ${statusNames[records.provider?.status] || 'Chưa có kết quả'}.`); }
    catch (error) { setMessage(paymentToolError(error)); } finally { lock.current = false; setBusy(false); }
  };
  const showTransaction = async () => {
    if (detailOpen) { setDetailOpen(false); return; }
    setDetailOpen(true); if (!transactionId || detailLock.current) return; detailLock.current = true; setDetailBusy(true); setDetailError(''); const current = sequence.current;
    try { const result = await readKnownPaymentTransaction(paymentsService, transactionId, orderId); if (current === sequence.current) setTransaction(result); }
    catch (error) { if (current === sequence.current) setDetailError(paymentToolError(error)); } finally { detailLock.current = false; if (current === sequence.current) setDetailBusy(false); }
  };
  if (!isAuthenticated || !validPaymentOrderCode(orderCode)) return null;
  const paid = linkStatus === 'PAID' || provider?.status === 'PAID'; const cancelled = !paid && (provider?.status || linkStatus) === 'CANCELLED';
  return <div className="space-y-2 border-t border-slate-100 pt-2">
    <div className="flex flex-wrap items-center justify-between gap-1">{transactionId && <button type="button" disabled={detailBusy || busy || disabled} onClick={() => void showTransaction()} aria-expanded={detailOpen} className={`${smallButton} text-slate-600 hover:bg-slate-50`}><FileText className="h-3.5 w-3.5" />Thông tin giao dịch<ChevronDown className={`h-3 w-3 transition-transform ${detailOpen ? 'rotate-180' : ''}`} /></button>}{!paid && !cancelled && <button type="button" disabled={busy || disabled} onClick={() => { setConfirm(true); setDialogError(''); }} className={`${smallButton} text-rose-700 hover:bg-rose-50`}><Unlink className="h-3.5 w-3.5" />Hủy liên kết thanh toán</button>}{cancelled && <span className="px-2 text-xs font-medium text-slate-600">Liên kết đã hủy</span>}</div>
    {message && <p role="status" className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{message}</p>}
    {cancelled && <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><p>Liên kết này không còn sử dụng được. Trạng thái đơn hàng và giao dịch ghi nhận có thể chưa cập nhật cùng lúc. Cửa hàng sẽ hỗ trợ nếu bạn cần liên kết thanh toán mới.</p><button type="button" disabled={busy || disabled} onClick={() => void check()} className={`${smallButton} mt-1 !px-0 text-[#287DA8]`}><RefreshCw className={`h-3.5 w-3.5 ${busy && !reduced ? 'animate-spin' : ''}`} />Kiểm tra lại</button></div>}
    <AnimatePresence initial={false}>{detailOpen && <motion.div initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden"><div className="space-y-2 rounded-xl border border-slate-200 p-3 text-xs">{detailBusy ? <p role="status" className="text-slate-500">Đang tải giao dịch…</p> : detailError ? <p role="alert" className="flex items-start gap-2 text-amber-800"><AlertCircle className="h-4 w-4 shrink-0" />{detailError}</p> : transaction ? <dl className="space-y-2">{[['Mã giao dịch', transaction.transactionCode], ['Số tiền', `${Number(transaction.amount).toLocaleString('vi-VN')} ₫`], ['Trạng thái ghi nhận', statusNames[transaction.status] || 'Đang cập nhật'], ['Ngày tạo', transaction.createdAt ? new Date(transaction.createdAt).toLocaleString('vi-VN') : '—'], ['Ngày thanh toán', transaction.paidAt ? new Date(transaction.paidAt).toLocaleString('vi-VN') : 'Chưa ghi nhận']].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">{label}</dt><dd className="max-w-full break-all font-medium text-slate-800">{value}</dd></div>)}</dl> : <p className="text-slate-500">Chưa có thông tin giao dịch.</p>}</div></motion.div>}</AnimatePresence>
    {confirm && <CancelLinkDialog busy={busy} error={dialogError} onClose={() => setConfirm(false)} onSubmit={reason => void cancel(reason)} />}
  </div>;
};
