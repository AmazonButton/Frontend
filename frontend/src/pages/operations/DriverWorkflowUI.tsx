import React, { useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';

export const driverCard = 'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6';
export const driverPrimary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#287DA8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#206588] disabled:cursor-not-allowed disabled:opacity-50';
export const driverSecondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';
export const driverInput = 'mt-2 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white';
export const DriverNotice: React.FC<{ children: React.ReactNode; success?: boolean }> = ({ children, success }) => <div role={success ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-6 ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'}`}><AlertCircle className="mt-1 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{children}</span></div>;
export const DriverLoading: React.FC = () => <div className="flex items-center gap-2 py-6 text-sm text-zinc-500" role="status"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Đang tải dữ liệu...</div>;
export const DriverEntrance: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const reduced = useReducedMotion();
  return <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="min-w-0">{children}</motion.div>;
};
export const DriverDialog: React.FC<{ title: string; children: React.ReactNode; busy?: boolean; onClose: () => void }> = ({ title, children, busy, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} aria-labelledby={heading} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/45 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"><motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="p-5 sm:p-6"><header className="mb-5 flex items-start justify-between gap-3"><h2 id={heading} className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng hộp thoại" className="-mr-1 -mt-1 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></header>{children}</motion.div></dialog>;
};
const statusLabels: Record<string, string> = { READY_FOR_DELIVERY: 'Chờ nhận giao', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao', DELIVERY_FAILED: 'Chưa giao được', ONLINE: 'Sẵn sàng nhận đơn', OFFLINE: 'Tạm nghỉ', OPEN: 'Đang trong ca', CLOSED: 'Chờ bàn giao', HANDED_OVER: 'Đã bàn giao' };
export const DriverStatus: React.FC<{ status: string }> = ({ status }) => <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${['ONLINE', 'DELIVERED', 'HANDED_OVER'].includes(status) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : ['DELIVERY_FAILED', 'OFFLINE'].includes(status) ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'}`}>{statusLabels[status] || 'Đang cập nhật'}</span>;
