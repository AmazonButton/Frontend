import React, { useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export const workflowInput = 'min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/15 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
export const workflowButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#287DA8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#206588] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const workflowSecondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800';

export const WorkflowNotice: React.FC<{ children?: React.ReactNode; tone?: 'error' | 'success' | 'info' }> = ({ children, tone = 'info' }) => !children ? null : (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-relaxed ${tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200'}`}>
    {tone === 'success' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}<div className="min-w-0 break-words">{children}</div>
  </div>
);

export const WorkflowLoading: React.FC<{ label?: string }> = ({ label = 'Đang tải dữ liệu...' }) => <div role="status" className="flex min-h-24 items-center justify-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}</div>;

export const WorkflowReveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const reduced = useReducedMotion();
  return <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} className={className}>{children}</motion.div>;
};

export const WorkflowDialog: React.FC<{ open: boolean; title: string; description?: string; busy?: boolean; onClose: () => void; children: React.ReactNode }> = ({ open, title, description, busy, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === ref.current && !busy) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/45 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
    <WorkflowReveal className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-lg font-bold">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>}</div><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng hộp thoại" className="rounded-lg p-2 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-[#287DA8] disabled:opacity-40 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-4">{children}</div></WorkflowReveal>
  </dialog>;
};
