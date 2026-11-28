import './admin-ui.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarPlus, CheckCircle2, KeyRound, PackageCheck, RefreshCw, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { rentalsService } from '../../services/rentals.service';
import { toast } from '../../context/ToastContext';
import { card, primaryButton } from '../operations/OperationPrimitives';
import { adminDate, adminField, adminMoney, adminSecondary, AdminWorkflowDialog, AdminWorkflowNotice, AdminWorkflowStatus } from './AdminWorkflowDialog';
import { activateRentalContract, cancelRentalContractByAdmin, canActivateRental, workflowError } from './admin-workflows.mjs';

export const AdminRentalActivationPanel: React.FC = () => {
  const { user } = useAuth(); const allowed = canActivateRental(user); const reduced = useReducedMotion();
  const [id, setId] = useState(''); const [confirmation, setConfirmation] = useState<'ACTIVATE' | 'CANCEL' | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<any>(null); const lock = useRef(false);

  // 8.3 Admin Rental Queue + Assign Fulfillment + Handover + Adjust Duration
  const [rentals, setRentals] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stores, setStores] = useState<any[]>([]);
  const [assignModalRental, setAssignModalRental] = useState<any | null>(null);
  const [fulfillmentStoreId, setFulfillmentStoreId] = useState('');
  const [storeDevices, setStoreDevices] = useState<any[]>([]);
  const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>([]);
  const [manualButtonIds, setManualButtonIds] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [handoverBusyId, setHandoverBusyId] = useState<string | null>(null);
  const [adjustModalRental, setAdjustModalRental] = useState<any | null>(null);
  const [adjustDays, setAdjustDays] = useState<number>(7);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!allowed) return;
    setQueueLoading(true);
    try {
      const [rentRes, storeRes] = await Promise.all([
        rentalsService.adminListRentals({
          page: 1,
          pageSize: 50,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        }),
        api.get('/admin/stores', { params: { pageSize: 100 } }).catch(() => ({ data: { success: false, data: [] } })),
      ]);
      setRentals(rentRes.items || []);
      if (storeRes.data?.success && Array.isArray(storeRes.data.data)) {
        setStores(storeRes.data.data.filter((s: any) => s.status === 'ACTIVE'));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tải được danh sách hợp đồng thuê.');
    } finally {
      setQueueLoading(false);
    }
  }, [allowed, statusFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!assignModalRental || !fulfillmentStoreId) {
      setStoreDevices([]);
      return;
    }
    api.get(`/devices?storeId=${encodeURIComponent(fulfillmentStoreId)}&pageSize=100`)
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setStoreDevices(list.filter((d: any) => !d.customerId && (!d.rentalId || String(d.rentalId) === String(assignModalRental.rentalId))));
      })
      .catch(() => setStoreDevices([]));
  }, [assignModalRental, fulfillmentStoreId]);

  const handleAssignFulfillmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalRental || !fulfillmentStoreId) return;
    const extraManual = manualButtonIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const buttonIds = [...new Set([...selectedButtonIds, ...extraManual])];
    if (buttonIds.length === 0) {
      toast.error('Vui lòng chọn hoặc nhập ít nhất 1 mã nút bấm (buttonIds).');
      return;
    }
    setAssignSubmitting(true);
    try {
      await rentalsService.adminAssignFulfillment(assignModalRental.rentalId, {
        fulfillmentStoreId,
        buttonIds,
        notes: assignNotes.trim() || undefined,
      });
      toast.success(`Đã phân công cửa hàng & gán ${buttonIds.length} nút cho hợp đồng #${assignModalRental.rentalId}.`);
      setAssignModalRental(null);
      setSelectedButtonIds([]);
      setManualButtonIds('');
      setAssignNotes('');
      await loadQueue();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể phân công cửa hàng & gán nút.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleHandover = async (rental: any) => {
    const rid = String(rental.rentalId);
    setHandoverBusyId(rid);
    try {
      await rentalsService.adminHandoverRental(rid);
      toast.success(`Đã xác nhận bàn giao thiết bị & kích hoạt thời hạn cho ${rental.rentalCode || `#${rid}`}!`);
      await loadQueue();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xác nhận bàn giao hợp đồng.');
    } finally {
      setHandoverBusyId(null);
    }
  };

  const handleAdjustDurationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalRental || !adjustReason.trim()) return;
    setAdjustSubmitting(true);
    try {
      await rentalsService.adminAdjustDuration(adjustModalRental.rentalId, {
        additionalDays: Number(adjustDays),
        reason: adjustReason.trim(),
      });
      toast.success(`Đã điều chỉnh ${adjustDays > 0 ? `+${adjustDays}` : adjustDays} ngày cho hợp đồng ${adjustModalRental.rentalCode || `#${adjustModalRental.rentalId}`}.`);
      setAdjustModalRental(null);
      setAdjustReason('');
      await loadQueue();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể điều chỉnh thời hạn thuê.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault(); if (!allowed || lock.current || !confirmation) return; lock.current = true; setBusy(true); setError('');
    try {
      setResult(confirmation === 'CANCEL' ? await cancelRentalContractByAdmin(api, id) : await activateRentalContract(api, id));
      setConfirmation(null);
      void loadQueue();
    }
    catch (failure) { setError(workflowError(failure)); } finally { lock.current = false; setBusy(false); }
  };

  return <div className="space-y-6">
    {/* 8.3 Bảng Hàng đợi Hợp đồng Thuê Toàn Hệ Thống */}
    {allowed && (
      <motion.section initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Store className="h-4 w-4 text-[#287DA8]" />
              <span>Hàng đợi hợp đồng thuê nút ({rentals.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Phân công cửa hàng xử lý, gán thiết bị nút bấm, xác nhận bàn giao hoặc bù ngày thuê.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc trạng thái hợp đồng thuê"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${adminField} !py-1.5 !text-xs cursor-pointer`}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING_PAYMENT">Chờ thanh toán (PENDING_PAYMENT)</option>
              <option value="PENDING_HANDOVER">Chờ phân công / bàn giao (PENDING_HANDOVER)</option>
              <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
              <option value="EXPIRED">Hết hạn (EXPIRED)</option>
              <option value="CANCELLED">Đã hủy (CANCELLED)</option>
            </select>
            <button type="button" onClick={() => void loadQueue()} disabled={queueLoading} className={`${adminSecondary} !py-1.5 !text-xs`}>
              <RefreshCw className={`h-3.5 w-3.5 ${queueLoading ? 'animate-spin' : ''}`} />
              <span>Tải lại</span>
            </button>
          </div>
        </div>

        {queueLoading && rentals.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-500">Đang tải hàng đợi hợp đồng thuê...</p>
        ) : rentals.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-500">Chưa có hợp đồng thuê nào phù hợp bộ lọc.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold bg-zinc-50/50 dark:bg-zinc-850/50">
                  <th className="py-2.5 px-3">Mã HĐ & Ngày tạo</th>
                  <th className="py-2.5 px-3">Khách hàng</th>
                  <th className="py-2.5 px-3">Gói & Số nút</th>
                  <th className="py-2.5 px-3">Thuê / Cọc</th>
                  <th className="py-2.5 px-3">Nút & Cửa hàng</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rentals.map((r) => (
                  <tr key={r.rentalId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-850/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900 dark:text-white">
                      <div>{r.rentalCode || `#${r.rentalId}`}</div>
                      <div className="text-[10px] font-normal text-zinc-400">ID: {r.rentalId} · {adminDate(r.createdAt)}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">{r.customer?.fullName || `Khách #${r.customerId}`}</div>
                      <div className="text-[11px] text-zinc-500">{r.customer?.phone || r.customer?.email || ''}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{r.package?.packageName || `Gói #${r.packageId}`}</div>
                      <div className="text-[11px] text-zinc-500">{r.monthsRented} tháng · {(r.package?.buttonQuantity || r.buttons?.length || 1)} nút</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div>{adminMoney(r.totalRentAmount)}</div>
                      <div className="text-[11px] text-zinc-500">Cọc: {adminMoney(r.depositAmount)}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      {r.fulfillmentStoreId ? (
                        <div className="text-[11px] text-zinc-700 dark:text-zinc-300">Store #{r.fulfillmentStoreId}</div>
                      ) : (
                        <span className="text-[11px] text-amber-600">Chưa gán Store</span>
                      )}
                      {Array.isArray(r.buttons) && r.buttons.length > 0 && (
                        <div className="text-[10px] font-mono text-zinc-500">{r.buttons.map((b: any) => b.buttonCode || b.buttonId).join(', ')}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <AdminWorkflowStatus value={r.status} />
                      {r.effectiveExpiresAt && (
                        <div className="mt-0.5 text-[10px] text-zinc-400">HH: {adminDate(r.effectiveExpiresAt)}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        {['PENDING_HANDOVER', 'PAID'].includes(r.status) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalRental(r);
                                setFulfillmentStoreId(r.fulfillmentStoreId ? String(r.fulfillmentStoreId) : (stores[0] ? String(stores[0].id || stores[0].storeId) : ''));
                                setSelectedButtonIds([]);
                                setManualButtonIds('');
                                setAssignNotes('');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-[#287DA8]/30 bg-sky-50 text-[#287DA8] hover:bg-sky-100 text-[11px] font-semibold cursor-pointer"
                            >
                              Phân công & Chọn nút
                            </button>
                            <button
                              type="button"
                              disabled={handoverBusyId === String(r.rentalId)}
                              onClick={() => void handleHandover(r)}
                              className={`${primaryButton} !py-1 !px-2.5 !text-[11px] inline-flex items-center gap-1`}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              <span>{handoverBusyId === String(r.rentalId) ? 'Đang xử lý...' : 'Xác nhận bàn giao'}</span>
                            </button>
                          </>
                        )}
                        {['ACTIVE', 'EXPIRED'].includes(r.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustModalRental(r);
                              setAdjustDays(7);
                              setAdjustReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            <span>Bù ngày thuê</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
    )}

    <motion.section initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={card}>
      <div className="flex items-start gap-3"><KeyRound className="mt-1 h-5 w-5 shrink-0 text-[#287DA8]" /><div><h2 className="font-semibold text-zinc-900 dark:text-white">Kích hoạt hoặc hủy nhanh theo mã số hợp đồng</h2><p className="mt-1 max-w-xl text-sm text-zinc-500">Sử dụng mã số hợp đồng từ hồ sơ thuê đã hoàn tất thanh toán để đưa hợp đồng vào sử dụng hoặc hủy trước bàn giao.</p></div></div>
      {!allowed ? <div className="mt-4"><AdminWorkflowNotice>Tài khoản hiện tại chưa được cấp quyền xử lý hợp đồng. Vui lòng sử dụng tài khoản quản trị có quyền phù hợp.</AdminWorkflowNotice></div> : <form onSubmit={event => { event.preventDefault(); if (/^[1-9]\d*$/.test(id.trim())) { setConfirmation('ACTIVATE'); setError(''); } else setError('Nhập mã số hợp đồng hợp lệ.'); }} className="mt-5 max-w-lg space-y-4"><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">Mã số hợp đồng<input required inputMode="numeric" pattern="[1-9][0-9]*" value={id} disabled={busy} onChange={event => { setId(event.target.value); setResult(null); setError(''); }} className={`${adminField} mt-2`} placeholder="Ví dụ: 125" /></label><p className="text-xs text-zinc-500">Dùng mã số trong hồ sơ, không nhập mã gói thuê hoặc mã nút bấm. Hệ thống sẽ kiểm tra điều kiện thanh toán trước khi kích hoạt hoặc hủy hoàn cọc.</p>{error && !confirmation && <AdminWorkflowNotice>{error}</AdminWorkflowNotice>}{result && <AdminWorkflowNotice success><span className="flex flex-wrap items-center gap-2"><CheckCircle2 className="h-4 w-4" />Hợp đồng {result.rentalCode || `#${result.rentalId || id}`} <AdminWorkflowStatus value={result.status} /></span></AdminWorkflowNotice>}<div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || !id.trim() || result?.status === 'ACTIVE'} className={primaryButton}><KeyRound className="h-4 w-4" />Tiếp tục kích hoạt</button><button type="button" disabled={busy || !id.trim() || result?.status === 'CANCELLED'} onClick={() => { if (/^[1-9]\d*$/.test(id.trim())) { setConfirmation('CANCEL'); setError(''); } else setError('Nhập mã số hợp đồng hợp lệ.'); }} className={`${adminSecondary} border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300`}>Hủy trước bàn giao (CANCELLED)</button></div></form>}
      {confirmation && <AdminWorkflowDialog title={confirmation === 'CANCEL' ? 'Xác nhận hủy hợp đồng trước bàn giao' : 'Xác nhận kích hoạt hợp đồng'} busy={busy} onClose={() => setConfirmation(null)}><form onSubmit={submitAction} className="space-y-4"><p className="text-sm text-zinc-600 dark:text-zinc-300">{confirmation === 'CANCEL' ? <>Bạn đang hủy hợp đồng <strong>#{id.trim()}</strong> ở trạng thái chờ thanh toán/chờ bàn giao và kích hoạt quy trình hoàn 100% tiền cọc nếu đã thu.</> : <>Bạn đang kích hoạt hợp đồng <strong>#{id.trim()}</strong>. Hợp đồng phải được máy chủ ghi nhận đã thanh toán.</>}</p>{error && <AdminWorkflowNotice>{error}</AdminWorkflowNotice>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setConfirmation(null)} className={adminSecondary}>Quay lại</button><button type="submit" disabled={busy} className={confirmation === 'CANCEL' ? 'inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50' : primaryButton}>{busy ? 'Đang xử lý…' : confirmation === 'CANCEL' ? 'Xác nhận hủy hợp đồng' : 'Xác nhận kích hoạt'}</button></div></form></AdminWorkflowDialog>}
    </motion.section>

    {/* Assign Fulfillment Modal */}
    {assignModalRental && (
      <AdminWorkflowDialog
        title={`Phân công & Gán nút cho ${assignModalRental.rentalCode || `#${assignModalRental.rentalId}`}`}
        onClose={() => { if (!assignSubmitting) setAssignModalRental(null); }}
        busy={assignSubmitting}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAssignFulfillmentSubmit} className="space-y-4 text-xs">
          <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
            Cửa hàng phụ trách (fulfillmentStoreId):
            <select
              required
              value={fulfillmentStoreId}
              onChange={(e) => {
                setFulfillmentStoreId(e.target.value);
                setSelectedButtonIds([]);
              }}
              className={`${adminField} mt-1 !text-xs`}
            >
              <option value="">-- Chọn cửa hàng đang hoạt động --</option>
              {stores.map((s) => (
                <option key={String(s.id || s.storeId)} value={String(s.id || s.storeId)}>
                  {s.name} ({s.code || `#${s.id || s.storeId}`})
                </option>
              ))}
            </select>
          </label>

          {storeDevices.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">Chọn thiết bị khả dụng trong kho Store ({storeDevices.length}):</span>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 space-y-1">
                {storeDevices.map((d) => {
                  const bid = String(d.buttonId || d.id);
                  const checked = selectedButtonIds.includes(bid);
                  return (
                    <label key={bid} className="flex items-center gap-2 p-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedButtonIds((prev) => checked ? prev.filter((x) => x !== bid) : [...prev, bid])}
                        className="accent-[#287DA8]"
                      />
                      <span className="font-mono font-semibold">{d.deviceId}</span>
                      <span className="text-zinc-400">(#{bid})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
            Hoặc nhập danh sách ID/mã nút thủ công (cách nhau dấu phẩy):
            <input
              type="text"
              value={manualButtonIds}
              onChange={(e) => setManualButtonIds(e.target.value)}
              placeholder="VD: 101, 102 hoặc SOB-000001"
              className={`${adminField} mt-1 !text-xs`}
            />
          </label>

          <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
            Ghi chú phân công (notes):
            <input
              type="text"
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="VD: Giao trong ngày..."
              className={`${adminField} mt-1 !text-xs`}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button type="button" disabled={assignSubmitting} onClick={() => setAssignModalRental(null)} className={adminSecondary}>Hủy</button>
            <button type="submit" disabled={assignSubmitting} className={primaryButton}>
              {assignSubmitting ? 'Đang lưu...' : 'Xác nhận phân công'}
            </button>
          </div>
        </form>
      </AdminWorkflowDialog>
    )}

    {/* Adjust Duration Modal */}
    {adjustModalRental && (
      <AdminWorkflowDialog
        title={`Điều chỉnh thời hạn thuê ${adjustModalRental.rentalCode || `#${adjustModalRental.rentalId}`}`}
        onClose={() => { if (!adjustSubmitting) setAdjustModalRental(null); }}
        busy={adjustSubmitting}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAdjustDurationSubmit} className="space-y-4 text-xs">
          <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
            Số ngày bù / điều chỉnh (additionalDays):
            <input
              type="number"
              required
              value={adjustDays}
              onChange={(e) => setAdjustDays(Number(e.target.value))}
              className={`${adminField} mt-1 !text-xs`}
            />
          </label>
          <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
            Lý do điều chỉnh (reason - bắt buộc):
            <input
              type="text"
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="VD: Bù ngày bảo trì hoặc hỗ trợ đổi nút"
              className={`${adminField} mt-1 !text-xs`}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button type="button" disabled={adjustSubmitting} onClick={() => setAdjustModalRental(null)} className={adminSecondary}>Hủy</button>
            <button type="submit" disabled={adjustSubmitting || !adjustReason.trim()} className={primaryButton}>
              {adjustSubmitting ? 'Đang lưu...' : 'Lưu điều chỉnh'}
            </button>
          </div>
        </form>
      </AdminWorkflowDialog>
    )}
  </div>;
};

export const AdminRentalActivationPage: React.FC = () => <main className="admin-ui mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-6"><header><p className="mb-1 text-xs font-semibold text-[#287DA8]">Quản trị hệ thống</p><h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Hợp đồng thuê nút bấm</h1><p className="mt-2 text-sm text-zinc-500">Quản lý hàng đợi hợp đồng thuê, phân công cửa hàng, bàn giao nút và kích hoạt hợp đồng.</p></header><AdminRentalActivationPanel /></main>;
