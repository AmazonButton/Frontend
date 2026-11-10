import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FileText, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { readCustomerVerificationDetails } from './customer-verification-details.mjs';

const labels: Record<string, string> = { PENDING: 'Đang chờ xác minh', APPROVED: 'Đã xác minh', DECLINED: 'Chưa đạt xác minh', IN_REVIEW: 'Đang xem xét', EXPIRED: 'Đã hết hạn', REJECTED: 'Chưa đạt xác minh', FAILED: 'Chưa hoàn tất' };
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';
const button = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-[#287DA8] hover:text-[#287DA8] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300';

function VerificationDialog({ sessionId, userId, onClose }: { sessionId: string | number; userId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId(); const reduced = useReducedMotion(); const sequence = useRef(0);
  const [session, setSession] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => {
    const current = ++sequence.current; setLoading(true); setError('');
    try { const result = await readCustomerVerificationDetails(api, sessionId, userId); if (current === sequence.current) setSession(result); }
    catch (failure: any) { if (current === sequence.current) setError(failure.response?.data?.message || failure.message || 'Chưa thể tải hồ sơ xác minh.'); }
    finally { if (current === sequence.current) setLoading(false); }
  };
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const node = dialog.current; node?.showModal(); void load(); return () => { sequence.current += 1; node?.close(); previous?.focus(); }; }, [sessionId, userId]);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[120] m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"><motion.div initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-5 p-5 sm:p-6"><header className="flex items-start justify-between gap-3"><div><h2 id={titleId} className="text-lg font-semibold">Chi tiết xác minh</h2><p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Thông tin hồ sơ của tài khoản hiện tại.</p></div><button type="button" aria-label="Đóng chi tiết" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></header>{loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Đang tải hồ sơ…</p> : error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{error}</p> : session && <dl className="space-y-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-zinc-800">{[['Trạng thái', labels[session.status] || 'Đang cập nhật'], ['Họ và tên', session.metadata?.fullName || 'Chưa ghi nhận'], ['Ngày tạo', date(session.createdAt)], ['Hoàn tất', date(session.completedAt)], ['Hết hạn', date(session.expiresAt)]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500 dark:text-zinc-400">{label}</dt><dd className="max-w-full break-words text-right font-medium">{value}</dd></div>)}</dl>}<footer data-footer-motion-root className="flex flex-wrap justify-end gap-2"><button type="button" disabled={loading} onClick={() => void load()} className={button}><RefreshCw className={`h-3.5 w-3.5 ${loading && !reduced ? 'animate-spin' : ''}`} />Tải lại</button><button type="button" onClick={onClose} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#287DA8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#206588]">Đóng</button></footer></motion.div></dialog>;
}

export function CustomerVerificationDetails({ sessionId }: { sessionId: string | number }) {
  const { user } = useAuth(); const [open, setOpen] = useState(false);
  if (user?.role !== 'CUSTOMER' || !sessionId) return null;
  return <><button type="button" onClick={() => setOpen(true)} className={button}><FileText className="h-3.5 w-3.5" />Xem chi tiết</button>{open && <VerificationDialog sessionId={sessionId} userId={String(user.id)} onClose={() => setOpen(false)} />}</>;
}
