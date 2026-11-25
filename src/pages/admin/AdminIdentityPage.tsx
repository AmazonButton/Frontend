import './admin-ui.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { card, primaryButton } from '../operations/OperationPrimitives';
import { adminDate, adminField, adminSecondary, AdminWorkflowDialog, AdminWorkflowNotice, AdminWorkflowStatus } from './AdminWorkflowDialog';
import { canManageIdentity, deleteIdentitySession, getIdentitySession, loadIdentitySessions, reviewIdentitySession, revokeUserIdentity, syncIdentitySession, workflowError } from './admin-workflows.mjs';
import { getKycReviewReasonMeta } from '../../utils/kyc.mjs';

export const AdminIdentityPage: React.FC = () => {
  const { user } = useAuth(); const allowed = canManageIdentity(user); const reduced = useReducedMotion();
  const [items, setItems] = useState<any[]>([]); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<any>(null); const [busy, setBusy] = useState(false); const [dialogError, setDialogError] = useState('');
  const [confirmMode, setConfirmMode] = useState<'NONE' | 'DELETE' | 'REVOKE'>('NONE');
  const [acknowledged, setAcknowledged] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'DECLINE'>('DECLINE');
  const [reviewReasonInput, setReviewReasonInput] = useState('');
  const [acceptOcrName, setAcceptOcrName] = useState(false);
  const [revokeReasonInput, setRevokeReasonInput] = useState('');
  const busyRef = useRef(false); const sequenceRef = useRef(0);

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    const sequence = ++sequenceRef.current; setLoading(true); setError('');
    try { const result = await loadIdentitySessions(api, page); if (sequence !== sequenceRef.current) return; setItems(result.items); setTotalPages(Math.max(1, Number(result.pagination.totalPages) || 1)); setTotal(Number(result.pagination.totalItems) || 0); }
    catch (failure) { if (sequence === sequenceRef.current) setError(workflowError(failure)); }
    finally { if (sequence === sequenceRef.current) setLoading(false); }
  }, [allowed, page]);

  useEffect(() => { void load(); return () => { sequenceRef.current += 1; }; }, [load]);
  const lock = () => { if (busyRef.current) return false; busyRef.current = true; setBusy(true); return true; };
  const unlock = () => { busyRef.current = false; setBusy(false); };

  const initDialogStates = (session: any) => {
    setConfirmMode('NONE'); setAcknowledged(false); setDialogError('');
    const isNameMismatch = String(session?.reviewReason || '').toUpperCase() === 'NAME_MISMATCH';
    setReviewDecision(isNameMismatch ? 'DECLINE' : 'APPROVE');
    setReviewReasonInput('');
    setAcceptOcrName(isNameMismatch);
    setRevokeReasonInput('');
  };

  const openDetail = async (item: any) => {
    if (!lock()) return; setDetail(item); initDialogStates(item);
    try { const fresh = await getIdentitySession(api, item.sessionId); setDetail(fresh); initDialogStates(fresh); }
    catch (failure) { setDialogError(workflowError(failure)); } finally { unlock(); }
  };

  const sync = async () => {
    if (!detail || !lock()) return; setDialogError('');
    try { const fresh = await syncIdentitySession(api, detail.sessionId); setDetail(fresh); await load(); }
    catch (failure) { setDialogError(workflowError(failure)); } finally { unlock(); }
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !lock()) return;
    setDialogError('');
    try {
      const updated = await reviewIdentitySession(api, detail.sessionId, {
        decision: reviewDecision,
        reason: reviewReasonInput,
        acceptOcrNameAsVerified: reviewDecision === 'APPROVE' ? acceptOcrName : undefined,
      });
      setDetail(updated);
      setNotice(reviewDecision === 'APPROVE' ? `Đã phê duyệt thủ công phiên #${detail.sessionId}.` : `Đã từ chối phiên #${detail.sessionId}.`);
      setReviewReasonInput('');
      await load();
    } catch (failure) {
      setDialogError(workflowError(failure));
    } finally {
      unlock();
    }
  };

  const submitRevoke = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !acknowledged || !lock()) return;
    setDialogError('');
    try {
      await revokeUserIdentity(api, detail.userId, revokeReasonInput);
      const refreshed = await getIdentitySession(api, detail.sessionId).catch(() => null);
      if (refreshed) { setDetail(refreshed); initDialogStates(refreshed); } else { setDetail(null); }
      setNotice(`Đã thu hồi định danh của người dùng #${detail.userId} và giải phóng CCCD.`);
      await load();
    } catch (failure) {
      setDialogError(workflowError(failure));
    } finally {
      unlock();
    }
  };

  const remove = async (event: React.FormEvent) => {
    event.preventDefault(); if (!detail || !acknowledged || !lock()) return; setDialogError('');
    try { await deleteIdentitySession(api, detail.sessionId); setDetail(null); setNotice('Đã xóa phiên xác minh theo kết quả xác nhận từ máy chủ.'); if (items.length === 1 && page > 1) setPage(page - 1); else await load(); }
    catch (failure) { setDialogError(workflowError(failure)); } finally { unlock(); }
  };

  const displayName = (item: any) => item?.user?.fullName || item?.metadata?.fullName || `Người dùng #${item?.userId}`;
  const displayContact = (item: any) => [item?.user?.email, item?.user?.phone].filter(Boolean).join(' · ');
  const visible = items.filter(item => `${item.sessionId} ${item.userId} ${item.user?.fullName || ''} ${item.user?.email || ''} ${item.user?.phone || ''} ${item.metadata?.fullName || ''} ${item.reviewReason || ''}`.toLowerCase().includes(query.toLowerCase()));
  const detailReasonMeta = detail ? getKycReviewReasonMeta(detail.reviewReason, detail.metadata, detail.user?.fullName) : null;
  const isDetailInReview = String(detail?.status || '').toUpperCase() === 'IN_REVIEW';
  const canRevokeDetail = String(detail?.status || '').toUpperCase() === 'APPROVED' || String(detail?.user?.kycStatus || '').toUpperCase() === 'APPROVED';

  return <motion.main initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="admin-ui mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold text-[#287DA8]">Quản trị hệ thống</p><h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Xác minh danh tính</h1><p className="mt-2 text-sm text-zinc-500">Theo dõi hồ sơ, đối chiếu OCR CCCD và xét duyệt hoặc thu hồi định danh.</p></div>{allowed && <button type="button" disabled={loading || busy} onClick={() => void load()} className={adminSecondary}><RefreshCw className={`h-4 w-4 ${loading && !reduced ? 'animate-spin' : ''}`} />Tải lại</button>}</header>
    {!allowed ? <AdminWorkflowNotice>Tài khoản hiện tại chưa được cấp quyền xem hồ sơ xác minh của người dùng khác. Vui lòng sử dụng tài khoản quản trị có quyền phù hợp.</AdminWorkflowNotice> : <>{notice && <AdminWorkflowNotice success>{notice}</AdminWorkflowNotice>}{error && <AdminWorkflowNotice>{error}</AdminWorkflowNotice>}<section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-zinc-900 dark:text-white">Hồ sơ xác minh <span className="text-zinc-500">({total})</span></h2><label className="relative min-w-0 sm:w-72"><span className="sr-only">Tìm trong trang hiện tại</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tên, email, SĐT hoặc lý do" className={`${adminField} !pl-9`} /></label></div>{loading ? <p role="status" className="py-12 text-center text-sm text-zinc-500">Đang tải hồ sơ…</p> : !visible.length ? <div className="py-12 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-zinc-300" /><p className="text-sm text-zinc-500">{error ? 'Chưa lấy được hồ sơ. Vui lòng tải lại.' : 'Chưa có hồ sơ phù hợp.'}</p></div> : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{visible.map(item => <article key={item.sessionId} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words font-semibold text-zinc-900 dark:text-white">{displayName(item)}</p><p className="mt-1 text-xs text-zinc-500">{displayContact(item) ? `${displayContact(item)} · ` : ''}Phiên #{item.sessionId} · {adminDate(item.createdAt)}</p>{(item.metadata?.fullName || item.metadata?.documentNumberMasked || item.reviewReason) && <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">{item.metadata?.fullName && <span>OCR: <strong>{item.metadata.fullName}</strong>{item.metadata?.documentNumberMasked ? ` (${item.metadata.documentNumberMasked})` : ''}</span>}{item.reviewReason && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">{item.reviewReason}</span>}</p>}</div><div className="flex flex-wrap items-center gap-3"><AdminWorkflowStatus value={item.status} /><button type="button" disabled={busy} onClick={() => void openDetail(item)} className={adminSecondary}><Eye className="h-4 w-4" />Xem hồ sơ</button></div></article>)}</div>}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800"><p className="text-zinc-500">Trang {page} / {totalPages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading || busy} onClick={() => setPage(value => value - 1)} className={adminSecondary}><ChevronLeft className="h-4 w-4" />Trước</button><button type="button" disabled={page >= totalPages || loading || busy} onClick={() => setPage(value => value + 1)} className={adminSecondary}>Sau<ChevronRight className="h-4 w-4" /></button></div></div></section></>}
    {detail && <AdminWorkflowDialog title={confirmMode === 'DELETE' ? 'Xóa phiên xác minh' : confirmMode === 'REVOKE' ? 'Thu hồi định danh tài khoản' : 'Hồ sơ xác minh'} busy={busy} onClose={() => setDetail(null)}><div className="space-y-4"><dl className="grid grid-cols-1 gap-4 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-2 dark:bg-zinc-800"><div><dt className="text-zinc-500">Tài khoản</dt><dd className="mt-1 break-words font-semibold">{displayName(detail)} (#{detail.userId})</dd>{displayContact(detail) && <dd className="mt-0.5 text-xs text-zinc-500">{displayContact(detail)}</dd>}</div><div><dt className="text-zinc-500">Trạng thái</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><AdminWorkflowStatus value={detail.status} />{detail.reviewReason && <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">{detail.reviewReason}</span>}</dd></div><div><dt className="text-zinc-500">Họ tên OCR trên CCCD</dt><dd className="mt-1 font-medium">{detail.metadata?.fullName || 'Chưa có dữ liệu OCR'}</dd></div><div><dt className="text-zinc-500">Số CCCD (đã che)</dt><dd className="mt-1 font-mono font-medium">{detail.metadata?.documentNumberMasked || detail.metadata?.documentNumber || '—'}</dd></div><div><dt className="text-zinc-500">Mã phiên</dt><dd className="mt-1 break-all">#{detail.sessionId}</dd></div><div><dt className="text-zinc-500">Ngày tạo / Hoàn tất</dt><dd className="mt-1 text-xs">{adminDate(detail.createdAt)} · {adminDate(detail.completedAt)}</dd></div></dl>{detailReasonMeta && <AdminWorkflowNotice><p className="font-semibold">{detailReasonMeta.title}</p><p className="mt-0.5 text-xs">{detailReasonMeta.description}</p></AdminWorkflowNotice>}{detail.reviewNote && <div className="rounded-xl border border-zinc-200 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"><strong>Ghi chú xét duyệt gần nhất:</strong> {detail.reviewNote} ({adminDate(detail.reviewedAt)})</div>}{busy && <p role="status" className="text-sm text-zinc-500">Đang cập nhật hồ sơ…</p>}{dialogError && <AdminWorkflowNotice>{dialogError}</AdminWorkflowNotice>}{confirmMode === 'DELETE' ? <form onSubmit={remove} className="space-y-4"><AdminWorkflowNotice>Phiên sẽ bị xóa tại dịch vụ xác minh và khỏi danh sách hoạt động. Thao tác này không thể hoàn tác từ giao diện.</AdminWorkflowNotice><label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#287DA8]" /><span>Tôi đã kiểm tra đúng hồ sơ và xác nhận xóa phiên #{detail.sessionId}.</span></label><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => { setConfirmMode('NONE'); setDialogError(''); }} className={adminSecondary}>Quay lại</button><button type="submit" disabled={busy || !acknowledged} className={`${primaryButton} !bg-rose-600 hover:!bg-rose-700`}><Trash2 className="h-4 w-4" />{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</button></div></form> : confirmMode === 'REVOKE' ? <form onSubmit={submitRevoke} className="space-y-4"><AdminWorkflowNotice>Thu hồi định danh sẽ đưa trạng thái KYC của tài khoản #{detail.userId} về REVOKED và giải phóng số CCCD đã gắn khỏi tài khoản này để phục vụ xử lý tranh chấp.</AdminWorkflowNotice><label className="block text-sm font-medium">Lý do thu hồi (tối thiểu 5 ký tự)<input required minLength={5} maxLength={500} value={revokeReasonInput} disabled={busy} onChange={e => setRevokeReasonInput(e.target.value)} placeholder="Ví dụ: Khách dùng CCCD không chính chủ hoặc chuyển nhượng tài khoản" className={`${adminField} mt-1.5`} /></label><label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#287DA8]" /><span>Tôi xác nhận thu hồi định danh KYC của người dùng #{detail.userId}.</span></label><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => { setConfirmMode('NONE'); setDialogError(''); }} className={adminSecondary}>Quay lại</button><button type="submit" disabled={busy || !acknowledged || revokeReasonInput.trim().length < 5} className={`${primaryButton} !bg-rose-600 hover:!bg-rose-700`}><ShieldAlert className="h-4 w-4" />{busy ? 'Đang thu hồi…' : 'Xác nhận thu hồi'}</button></div></form> : <div className="space-y-4">{isDetailInReview && <form onSubmit={submitReview} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="text-sm font-semibold text-zinc-900 dark:text-white">Xét duyệt thủ công (Phiên IN_REVIEW)</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => setReviewDecision('APPROVE')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${reviewDecision === 'APPROVE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}><CheckCircle2 className="h-3.5 w-3.5" />Phê duyệt (APPROVE)</button><button type="button" disabled={busy} onClick={() => setReviewDecision('DECLINE')} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${reviewDecision === 'DECLINE' ? 'border-rose-600 bg-rose-600 text-white' : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}><XCircle className="h-3.5 w-3.5" />Từ chối (DECLINE)</button></div>{reviewDecision === 'APPROVE' && String(detail.reviewReason || '').toUpperCase() === 'NAME_MISMATCH' && <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300"><input type="checkbox" checked={acceptOcrName} disabled={busy} onChange={e => setAcceptOcrName(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#287DA8]" /><span>Chấp nhận tên OCR trên CCCD làm tên pháp lý xác minh (bỏ qua lệch tên hiển thị).</span></label>}<label className="block text-xs font-medium text-zinc-700 dark:text-zinc-200">Lý do xét duyệt (tối thiểu 3 ký tự)<input required minLength={3} maxLength={500} value={reviewReasonInput} disabled={busy} onChange={e => setReviewReasonInput(e.target.value)} placeholder="Nhập lý do phê duyệt hoặc từ chối..." className={`${adminField} mt-1`} /></label><div className="flex justify-end"><button type="submit" disabled={busy || reviewReasonInput.trim().length < 3} className={primaryButton}>{busy ? 'Đang gửi…' : 'Lưu quyết định xét duyệt'}</button></div></form>}<div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setConfirmMode('DELETE'); setAcknowledged(false); setDialogError(''); }} className={`${adminSecondary} !text-rose-700 dark:!text-rose-300`}><Trash2 className="h-4 w-4" />Xóa phiên</button>{canRevokeDetail && <button type="button" disabled={busy} onClick={() => { setConfirmMode('REVOKE'); setAcknowledged(false); setDialogError(''); }} className={`${adminSecondary} !text-amber-700 dark:!text-amber-300`}><ShieldAlert className="h-4 w-4" />Thu hồi KYC</button>}</div><button type="button" disabled={busy} onClick={() => void sync()} className={primaryButton}><RefreshCw className="h-4 w-4" />Cập nhật kết quả</button></div></div>}</div></AdminWorkflowDialog>}
  </motion.main>;
};
