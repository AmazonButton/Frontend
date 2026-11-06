import React from 'react';

import { CheckCircle2, Clock3, XCircle } from 'lucide-react';

export const card = 'rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900';

export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#287DA8] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-colors hover:bg-[#206588] disabled:cursor-not-allowed disabled:opacity-50';

export const StatusPill: React.FC<{ value?: string }> = ({ value }) => {
  const normalized = (value || 'PENDING').toUpperCase();
  const isApproved =
    normalized.includes('APPROV') || normalized.includes('ACTIVE') || normalized.includes('SUCCESS');
  const isDeclined =
    normalized.includes('REJECT') ||
    normalized.includes('FAIL') ||
    normalized.includes('DECLIN') ||
    normalized.includes('CANCEL');

  const tone = isApproved
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
    : isDeclined
      ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
      : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ${tone}`}>
      {isApproved && <CheckCircle2 className="h-3 w-3" />}
      {isDeclined && <XCircle className="h-3 w-3" />}
      {!isApproved && !isDeclined && <Clock3 className="h-3 w-3" />}
      {value || 'PENDING'}
    </span>
  );
};

