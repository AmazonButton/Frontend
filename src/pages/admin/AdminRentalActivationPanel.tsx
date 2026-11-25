import './admin-ui.css';
import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { card, primaryButton } from '../operations/OperationPrimitives';
import { adminField, adminSecondary, AdminWorkflowDialog, AdminWorkflowNotice, AdminWorkflowStatus } from './AdminWorkflowDialog';
import { activateRentalContract, cancelRentalContractByAdmin, canActivateRental, workflowError } from './admin-workflows.mjs';

export const AdminRentalActivationPanel: React.FC = () => {
  const { user } = useAuth(); const allowed = canActivateRental(user); const reduced = useReducedMotion();
  const [id, setId] = useState(''); const [confirmation, setConfirmation] = useState<'ACTIVATE' | 'CANCEL' | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<any>(null); const lock = useRef(false);
  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault(); if (!allowed || lock.current || !confirmation) return; lock.current = true; setBusy(true); setError('');
    try {
      setResult(confirmation === 'CANCEL' ? await cancelRentalContractByAdmin(api, id) : await activateRentalContract(api, id));
      setConfirmation(null);
    }
    catch (failure) { setError(workflowError(failure)); } finally { lock.current = false; setBusy(false); }
  };
  return <motion.section initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={card}>
    <div className="flex items-start gap-3"><KeyRound className="mt-1 h-5 w-5 shrink-0 text-[#287DA8]" /><div><h2 className="font-semibold text-zinc-900 dark:text-white">Kích hoạt hoặc hủy hợp đồng thuê</h2><p className="mt-1 max-w-xl text-sm text-zinc-500">Sử dụng mã số hợp đồng từ hồ sơ thuê đã hoàn tất thanh toán để đưa hợp đồng vào sử dụng hoặc hủy trước bàn giao.</p></div></div>
    {!allowed ? <div className="mt-4"><AdminWorkflowNotice>Tài khoản hiện tại chưa được cấp quyền xử lý hợp đồng. Vui lòng sử dụng tài khoản quản trị có quyền phù hợp.</AdminWorkflowNotice></div> : <form onSubmit={event => { event.preventDefault(); if (/^[1-9]\d*$/.test(id.trim())) { setConfirmation('ACTIVATE'); setError(''); } else setError('Nhập mã số hợp đồng hợp lệ.'); }} className="mt-5 max-w-lg space-y-4"><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">Mã số hợp đồng<input required inputMode="numeric" pattern="[1-9][0-9]*" value={id} disabled={busy} onChange={event => { setId(event.target.value); setResult(null); setError(''); }} className={`${adminField} mt-2`} placeholder="Ví dụ: 125" /></label><p className="text-xs text-zinc-500">Dùng mã số trong hồ sơ, không nhập mã gói thuê hoặc mã nút bấm. Hệ thống sẽ kiểm tra điều kiện thanh toán trước khi kích hoạt hoặc hủy hoàn cọc.</p>{error && !confirmation && <AdminWorkflowNotice>{error}</AdminWorkflowNotice>}{result && <AdminWorkflowNotice success><span className="flex flex-wrap items-center gap-2"><CheckCircle2 className="h-4 w-4" />Hợp đồng {result.rentalCode || `#${result.rentalId || id}`} <AdminWorkflowStatus value={result.status} /></span></AdminWorkflowNotice>}<div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || !id.trim() || result?.status === 'ACTIVE'} className={primaryButton}><KeyRound className="h-4 w-4" />Tiếp tục kích hoạt</button><button type="button" disabled={busy || !id.trim() || result?.status === 'CANCELLED'} onClick={() => { if (/^[1-9]\d*$/.test(id.trim())) { setConfirmation('CANCEL'); setError(''); } else setError('Nhập mã số hợp đồng hợp lệ.'); }} className={`${adminSecondary} border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300`}>Hủy trước bàn giao (CANCELLED)</button></div></form>}
    {confirmation && <AdminWorkflowDialog title={confirmation === 'CANCEL' ? 'Xác nhận hủy hợp đồng trước bàn giao' : 'Xác nhận kích hoạt hợp đồng'} busy={busy} onClose={() => setConfirmation(null)}><form onSubmit={submitAction} className="space-y-4"><p className="text-sm text-zinc-600 dark:text-zinc-300">{confirmation === 'CANCEL' ? <>Bạn đang hủy hợp đồng <strong>#{id.trim()}</strong> ở trạng thái chờ thanh toán/chờ bàn giao và kích hoạt quy trình hoàn 100% tiền cọc nếu đã thu.</> : <>Bạn đang kích hoạt hợp đồng <strong>#{id.trim()}</strong>. Hợp đồng phải được máy chủ ghi nhận đã thanh toán.</>}</p>{error && <AdminWorkflowNotice>{error}</AdminWorkflowNotice>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setConfirmation(null)} className={adminSecondary}>Quay lại</button><button type="submit" disabled={busy} className={confirmation === 'CANCEL' ? 'inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50' : primaryButton}>{busy ? 'Đang xử lý…' : confirmation === 'CANCEL' ? 'Xác nhận hủy hợp đồng' : 'Xác nhận kích hoạt'}</button></div></form></AdminWorkflowDialog>}
  </motion.section>;
};

export const AdminRentalActivationPage: React.FC = () => <main className="admin-ui mx-auto max-w-4xl space-y-5 px-4 py-7 sm:px-6"><header><p className="mb-1 text-xs font-semibold text-[#287DA8]">Quản trị hệ thống</p><h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Hợp đồng thuê nút bấm</h1><p className="mt-2 text-sm text-zinc-500">Kích hoạt hợp đồng sau khi hoàn tất thanh toán.</p></header><AdminRentalActivationPanel /></main>;
