import React, { useState } from 'react';
import { Copy, Check, AlertCircle, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { bankCheckoutUrl, bankDate, bankMoney, bankSessionExpired, bankStatusLabel } from '../../services/banking-flow';

export const bankButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';
export const bankInput = 'mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/15 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white';
export const BankBadge: React.FC<{ value?: string | null; refund?: boolean }> = ({ value, refund }) => {
  const tone = ['VERIFIED', 'OWNERSHIP_VERIFIED', 'SUCCESS', 'REFUNDED'].includes(value || '')
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : ['FAILED', 'FAILED_MISMATCH', 'REFUND_FAILED', 'SUSPENDED', 'REVOKED'].includes(value || '')
      ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
      : ['PROCESSING', 'PROCESSING_REFUND'].includes(value || '')
        ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
        : ['PENDING', 'PENDING_REFUND', 'REFUND_PENDING', 'PENDING_SOURCE_EVIDENCE', 'PENDING_RECONCILIATION', 'PENDING_MANUAL_REFUND'].includes(value || '')
          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  const label = refund ? ({ SUCCESS: 'Đã hoàn tiền', REFUNDED: 'Đã hoàn tiền', PENDING: 'Chờ hoàn tiền', PROCESSING: 'Đang chuyển hoàn', FAILED_RETRY: 'Đang chờ thử lại', FAILED: 'Hoàn tiền chưa thành công' } as Record<string, string>)[value || ''] || (!value ? 'Chưa ghi nhận hoàn tiền' : null) : null;
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{label || bankStatusLabel(value)}</span>;
};
export const BankError: React.FC<{ message: string; retry?: () => void; busy?: boolean }> = ({ message, retry, busy }) => message ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p className="flex items-start gap-2"><AlertCircle className="mt-1 h-4 w-4 shrink-0" />{message}</p>{retry && <button type="button" disabled={busy} onClick={retry} className="mt-2 min-h-10 font-semibold underline underline-offset-4 disabled:opacity-50">Thử lại</button>}</div> : null;
export const BankPagination: React.FC<{ page: number; pages: number; total: number; busy: boolean; onPage: (page: number) => void }> = ({ page, pages, total, busy, onPage }) => <nav aria-label="Phân trang lịch sử xác minh" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800"><p className="text-xs text-zinc-500 dark:text-zinc-400">{total} phiên · Trang {page}/{pages}</p><div className="flex gap-2"><button type="button" className={bankButton} disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" /></button><button type="button" className={bankButton} disabled={busy || page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></button></div></nav>;
export const BankCopy: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [message, setMessage] = useState('');
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1"><span className="select-all break-all">{value}</span><button type="button" className="rounded-md p-2 text-[#287DA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8]" aria-label={`Sao chép ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(value); setMessage('Đã sao chép'); } catch { setMessage('Hãy chọn và sao chép nội dung'); } }}>{message === 'Đã sao chép' ? <Check size={15} /> : <Copy size={15} />}</button><span role="status" className="text-xs font-normal text-zinc-500">{message}</span></span>;
};
export interface BankTransferReceipt {
  amount: number; referenceCode: string; expiresAt: string; instructions?: string;
  recipientBankBin?: string; recipientBankName?: string; recipientAccountNumber?: string;
  recipientAccountHolder?: string; qrCodeUrl?: string; checkoutUrl?: string;
}
export const BankTransferInstructions: React.FC<{ receipt: BankTransferReceipt; now?: number }> = ({ receipt, now = Date.now() }) => {
  const expired = bankSessionExpired(receipt.expiresAt, now);
  const remaining = Math.max(0, Math.ceil((Date.parse(receipt.expiresAt) - now) / 1000));
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const checkoutUrl = !expired ? bankCheckoutUrl(receipt.checkoutUrl) : null;
  const complete = [receipt.recipientBankBin, receipt.recipientBankName, receipt.recipientAccountNumber, receipt.recipientAccountHolder].every(value => typeof value === 'string' && value.trim());
  let qr: string | null = null;
  try { const url = new URL(receipt.qrCodeUrl || ''); if (url.protocol === 'https:' && url.hostname === 'img.vietqr.io' && !url.username && !url.password) qr = url.href; } catch { /* Manual bank instructions remain available. */ }
  return <div className="mt-5 space-y-4 text-zinc-900 dark:text-zinc-100">
    {!expired && <p className="text-sm font-medium tabular-nums text-[#287DA8] dark:text-sky-300">Thời gian còn lại: <span role="timer" aria-label="Thời gian còn lại của hướng dẫn chuyển khoản" aria-live="off">{countdown}</span></p>}
    <dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-zinc-500">Số tiền xác minh</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{bankMoney(receipt.amount)}</dd></div><div><dt className="text-xs text-zinc-500">Nội dung chuyển khoản</dt><dd className="mt-1 text-sm font-semibold"><BankCopy value={receipt.referenceCode} label="nội dung chuyển khoản" /></dd></div><div><dt className="text-xs text-zinc-500">Hết hạn lúc</dt><dd className="mt-1 text-sm">{bankDate(receipt.expiresAt)}</dd></div></dl>
    {!expired && checkoutUrl && <div className="rounded-xl border border-[#287DA8]/30 bg-sky-50/70 p-4 dark:border-sky-800 dark:bg-sky-950/30"><p className="text-sm font-semibold">Thanh toán xác minh qua cổng PayOS</p><p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Ưu tiên mở cổng PayOS và chuyển từ đúng tài khoản vừa đăng ký để hệ thống tự động đối soát theo mã phiên.</p><a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#287DA8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1f6487] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8]">Mở thanh toán PayOS<ExternalLink size={16} /></a></div>}
    {expired ? <BankError message="Hướng dẫn này đã hết hạn. Không chuyển tiền theo mã hoặc QR cũ; hãy kiểm tra kết quả trước khi tạo phiên mới." /> : complete ? <div className="grid gap-5 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20 sm:grid-cols-[1fr_auto]"><div><h3 className="text-sm font-semibold">Tài khoản nhận tiền xác minh</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-zinc-500">Ngân hàng nhận</dt><dd className="mt-1 font-medium">{receipt.recipientBankName}</dd></div><div><dt className="text-xs text-zinc-500">Số tài khoản nhận</dt><dd className="mt-1 font-semibold"><BankCopy value={receipt.recipientAccountNumber!} label="số tài khoản nhận" /></dd></div><div><dt className="text-xs text-zinc-500">Tên người nhận</dt><dd className="mt-1 font-medium">{receipt.recipientAccountHolder}</dd></div></dl></div>{qr && <img src={qr} alt="QR chuyển khoản xác minh do hệ thống cung cấp" className="w-48 max-w-full rounded-lg bg-white p-2" referrerPolicy="no-referrer" />}</div> : <BankError message="Chưa có đầy đủ thông tin tài khoản nhận tiền. Vui lòng liên hệ hỗ trợ trước khi chuyển khoản. Tài khoản cần xác minh không phải tài khoản nhận tiền." />}
    {!expired && complete && <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Chuyển từ chính tài khoản bạn đang xác minh, đúng số tiền và nội dung. Kết quả xác minh và hoàn tiền được theo dõi riêng bên dưới.</p>}
  </div>;
};
