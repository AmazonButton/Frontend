import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Lock, CheckCircle2, XCircle, Plus, Wrench, BellRing, BatteryWarning } from 'lucide-react';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { toast } from '../../context/ToastContext';
import {
  WARRANTY_GROUPS,
  calculateWarrantyDeduction,
  fetchWarrantyTickets,
  createWarrantyTicketAsync,
  approveSwapTicketAsync,
  lockDeviceTicketAsync,
  resolveTicketAsync,
  rejectTicketAsync,
  loadWarrantyTickets,
  updateWarrantyTicket,
  type WarrantyFaultGroup,
  type WarrantyTicket,
  type WarrantyTicketStatus,
} from '../../services/warranty';

interface DeviceFaultAlert {
  id: string;
  deviceId: string;
  buttonName?: string;
  storeName?: string;
  faultCode: string;
  faultGroup: WarrantyFaultGroup;
  batteryLevel?: number;
  message: string;
  createdAt?: string;
}

interface WarrantyPanelProps {
  mode: 'admin' | 'staff';
  devices?: any[];
  stores?: any[];
  currentStoreId?: string;
  currentStoreName?: string;
  currentUserName?: string;
  currentUserRole?: string;
  onRefreshDevices?: () => void;
}

const STATUS_BADGE: Record<WarrantyTicketStatus, { label: string; cls: string }> = {
  PENDING: {
    label: 'Chờ xử lý',
    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  APPROVED_SWAP: {
    label: 'Đã duyệt đổi 1-1',
    cls: 'bg-sky-50 text-[#0E6BA8] border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  },
  RESOLVED: {
    label: 'Hoàn tất',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'Từ chối',
    cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
};

export const WarrantyPanel: React.FC<WarrantyPanelProps> = ({
  mode,
  devices = [],
  stores = [],
  currentStoreId,
  currentStoreName,
  currentUserName,
  currentUserRole,
  onRefreshDevices,
}) => {
  const [tickets, setTickets] = useState<WarrantyTicket[]>(() => loadWarrantyTickets());
  const [showPolicy, setShowPolicy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | WarrantyTicketStatus>('ALL');
  const [groupFilter, setGroupFilter] = useState<'ALL' | WarrantyFaultGroup>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [realtimeAlerts, setRealtimeAlerts] = useState<DeviceFaultAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // Tải danh sách phiếu bảo hành từ Backend API
  const refreshTickets = async () => {
    try {
      const list = await fetchWarrantyTickets(
        mode === 'staff' && currentStoreId ? { storeId: currentStoreId } : undefined
      );
      setTickets(list);
    } catch {
      // Fallback local handled inside fetchWarrantyTickets
    }
  };

  useEffect(() => {
    refreshTickets();
  }, [mode, currentStoreId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleFaultAlert = (payload: any) => {
      if (!payload?.deviceId) return;
      const alert: DeviceFaultAlert = {
        id: payload.id || `rt-${payload.deviceId}-${payload.faultCode || payload.faultType || 'FAULT'}-${Date.now()}`,
        deviceId: String(payload.deviceId),
        buttonName: payload.buttonName,
        storeName: payload.storeName,
        faultCode: payload.faultCode || payload.faultType || 'HARDWARE_FAULT',
        faultGroup: payload.faultGroup === 'GROUP_B' ? 'GROUP_B' : 'GROUP_A',
        batteryLevel: payload.batteryLevel,
        message: payload.message || `Nút ${payload.deviceId} vừa gửi cảnh báo lỗi (${payload.faultCode || payload.faultType || 'FAULT'}).`,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      setRealtimeAlerts((prev) => [alert, ...prev.filter((a) => a.deviceId !== alert.deviceId || a.faultCode !== alert.faultCode)]);
      toast.warning(alert.message, { title: 'Cảnh báo từ nút bấm', duration: 6000 });
    };

    const handleTicketCreated = (payload: any) => {
      refreshTickets();
      toast.info(`Có phiếu bảo hành mới #${payload?.ticketCode || ''}.`);
    };

    const handleTicketUpdated = () => {
      refreshTickets();
    };

    socket.on('DEVICE_FAULT_ALERT', handleFaultAlert);
    socket.on('WARRANTY_TICKET_CREATED', handleTicketCreated);
    socket.on('WARRANTY_TICKET_UPDATED', handleTicketUpdated);

    return () => {
      socket.off('DEVICE_FAULT_ALERT', handleFaultAlert);
      socket.off('WARRANTY_TICKET_CREATED', handleTicketCreated);
      socket.off('WARRANTY_TICKET_UPDATED', handleTicketUpdated);
    };
  }, [mode, currentStoreId]);

  const deviceFaultAlerts = useMemo<DeviceFaultAlert[]>(() => {
    if (mode !== 'admin') return [];
    const map = new Map<string, DeviceFaultAlert>();

    for (const rt of realtimeAlerts) {
      map.set(`${rt.deviceId}:${rt.faultCode}`, rt);
    }

    for (const d of devices) {
      const id = String(d?.deviceId || '');
      if (!id) continue;
      const storeName = d?.store?.storeName || d?.store?.name;
      const bat = d?.batteryLevel !== null && d?.batteryLevel !== undefined ? Number(d.batteryLevel) : null;
      if (bat !== null && bat <= 20) {
        const key = `${id}:LOW_BATTERY`;
        if (!map.has(key)) {
          map.set(key, {
            id: `dev-bat-${id}`,
            deviceId: id,
            buttonName: d?.customName || d?.buttonName || id,
            storeName,
            faultCode: 'LOW_BATTERY',
            faultGroup: 'GROUP_A',
            batteryLevel: bat,
            message: `Pin yếu (${bat}%) — Cần nhắc khách / đổi pin bảo hành`,
          });
        }
      }
      if (d?.status === 'ERROR' || d?.status === 'FAULT') {
        const key = `${id}:HARDWARE_FAULT`;
        if (!map.has(key)) {
          map.set(key, {
            id: `dev-err-${id}`,
            deviceId: id,
            buttonName: d?.customName || d?.buttonName || id,
            storeName,
            faultCode: 'HARDWARE_FAULT',
            faultGroup: 'GROUP_A',
            batteryLevel: bat ?? undefined,
            message: `Thiết bị đang ở trạng thái lỗi (${d.status})`,
          });
        }
      }
    }

    return Array.from(map.values()).filter((a) => !dismissedAlertIds.includes(a.id));
  }, [mode, devices, realtimeAlerts, dismissedAlertIds]);

  // Form state
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState(currentStoreId || '');
  const [faultGroup, setFaultGroup] = useState<WarrantyFaultGroup>('GROUP_A');
  const [faultCode, setFaultCode] = useState(WARRANTY_GROUPS.GROUP_A.faults[0].code);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const [deductionPercent, setDeductionPercent] = useState<number>(WARRANTY_GROUPS.GROUP_A.defaultDeduction);
  const [inspectionNote, setInspectionNote] = useState('');

  const activeGroup = WARRANTY_GROUPS[faultGroup];
  const calc = useMemo(
    () => calculateWarrantyDeduction(depositAmount, faultGroup, deductionPercent),
    [depositAmount, faultGroup, deductionPercent]
  );

  const handleGroupChange = (nextGroup: WarrantyFaultGroup) => {
    setFaultGroup(nextGroup);
    const cfg = WARRANTY_GROUPS[nextGroup];
    setFaultCode(cfg.faults[0].code);
    setDeductionPercent(cfg.defaultDeduction);
  };

  const handleQuickTicketFromAlert = (alert: DeviceFaultAlert) => {
    setDeviceIdInput(alert.deviceId);
    handleGroupChange(alert.faultGroup);
    setFaultCode(alert.faultCode);
    setInspectionNote(alert.message);
    setShowCreateForm(true);
  };

  const handleWarnFromAlert = async (alert: DeviceFaultAlert) => {
    setBusyId(alert.id);
    try {
      const res = await api.post('/notifications/device-warning', {
        deviceId: alert.deviceId,
        faultGroup: alert.faultGroup,
        faultCode: alert.faultCode,
        title: `Cảnh báo thiết bị ${alert.deviceId}`,
        message: alert.message,
      }).catch(() => null);
      toast.success(res?.data?.message || `Đã gửi cảnh báo tới tài khoản đang dùng nút ${alert.deviceId}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = deviceIdInput.trim().toUpperCase();
    if (!cleanId) {
      toast.warning('Vui lòng nhập hoặc chọn mã nút bấm (VD: SOB-000003).');
      return;
    }
    const matchedDevice = devices.find((d) => String(d.deviceId).toUpperCase() === cleanId);
    const resolvedStoreId = selectedStoreId || currentStoreId || (matchedDevice?.storeId ? String(matchedDevice.storeId) : undefined);
    const matchedStore = stores.find((s) => String(s.id || s.storeId) === String(resolvedStoreId));
    const resolvedStoreName =
      currentStoreName ||
      matchedDevice?.store?.storeName ||
      matchedDevice?.store?.name ||
      matchedStore?.name ||
      matchedStore?.storeName;

    setBusyId('CREATE_NEW');
    try {
      const created = await createWarrantyTicketAsync({
        deviceId: cleanId,
        storeId: resolvedStoreId,
        storeName: resolvedStoreName,
        faultGroup,
        faultCode,
        depositAmount,
        deductionPercent,
        inspectionNote,
        reportedBy: currentUserName || (mode === 'admin' ? 'Admin' : 'Nhân viên cửa hàng'),
        reportedRole: currentUserRole || (mode === 'admin' ? 'ADMIN' : 'STAFF'),
      });
      setTickets((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      setShowCreateForm(false);
      setDeviceIdInput('');
      setInspectionNote('');
      toast.success(`Đã lập phiếu bảo hành #${created.id} cho nút ${cleanId} (${activeGroup.shortLabel}).`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tạo phiếu bảo hành.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdminAction = async (
    ticket: WarrantyTicket,
    action: 'APPROVE_SWAP' | 'LOCK_DEVICE' | 'EXTEND_WARRANTY' | 'CHILD_LOCK_2S' | 'SEND_WARNING' | 'RESOLVE' | 'REJECT'
  ) => {
    setBusyId(ticket.id);
    const targetId = ticket.ticketId || ticket.id;
    try {
      const encodedId = encodeURIComponent(ticket.deviceId);
      if (action === 'SEND_WARNING') {
        const res = await api.post('/notifications/device-warning', {
          deviceId: ticket.deviceId,
          faultGroup: ticket.faultGroup,
          faultCode: ticket.faultCode,
          title: `Cảnh báo bảo hành nút ${ticket.deviceId}`,
          message: `${ticket.faultLabel}: ${ticket.inspectionNote}`,
        }).catch(() => null);
        const msg = res?.data?.message || `Đã ghi nhận gửi cảnh báo tới tài khoản đang dùng nút ${ticket.deviceId}.`;
        setTickets(updateWarrantyTicket(ticket.id, { adminNote: msg }));
        toast.success(msg);
      } else if (action === 'APPROVE_SWAP') {
        try {
          const updated = await approveSwapTicketAsync(targetId, {
            adminNote: 'Đã duyệt đổi mới 1-1 & thu hồi nút lỗi về kho.',
          });
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
        } catch {
          await api.post(`/devices/${encodedId}/factory-reset`).catch(() => null);
          setTickets(updateWarrantyTicket(ticket.id, { status: 'APPROVED_SWAP', adminNote: 'Đã duyệt đổi mới 1-1 & thu hồi nút lỗi về kho.' }));
        }
        toast.success(`Đã duyệt đổi 1-1 cho nút ${ticket.deviceId}.`);
        onRefreshDevices?.();
      } else if (action === 'LOCK_DEVICE') {
        try {
          const updated = await lockDeviceTicketAsync(targetId, {
            adminNote: 'Đã khóa nút hỏng/mất (DISABLED).',
          });
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
        } catch {
          await api.patch(`/devices/${encodedId}`, { status: 'DISABLED' }).catch(() => null);
          setTickets(updateWarrantyTicket(ticket.id, { status: 'RESOLVED', adminNote: 'Đã khóa nút hỏng/mất (DISABLED).' }));
        }
        toast.success(`Đã khóa nút ${ticket.deviceId} và chốt phiếu.`);
        onRefreshDevices?.();
      } else if (action === 'EXTEND_WARRANTY') {
        await api.patch(`/devices/${encodedId}/extend-warranty`, { months: 6 });
        try {
          const updated = await resolveTicketAsync(targetId, { adminNote: 'Đã gia hạn bảo hành +6 tháng.' });
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
        } catch {
          setTickets(updateWarrantyTicket(ticket.id, { status: 'RESOLVED', adminNote: 'Đã gia hạn bảo hành +6 tháng.' }));
        }
        toast.success(`Đã gia hạn bảo hành +6 tháng cho nút ${ticket.deviceId}.`);
        onRefreshDevices?.();
      } else if (action === 'CHILD_LOCK_2S') {
        await api.patch(`/devices/${encodedId}`, { holdDurationMs: 2000 }).catch(() => null);
        try {
          const updated = await resolveTicketAsync(targetId, { adminNote: 'Đã bật chế độ chống bấm nhầm (nhấn giữ 2s).' });
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
        } catch {
          setTickets(updateWarrantyTicket(ticket.id, { status: 'RESOLVED', adminNote: 'Đã bật chế độ chống bấm nhầm (nhấn giữ 2s).' }));
        }
        toast.success(`Đã bật giữ nút 2 giây chống trẻ em bấm phá cho ${ticket.deviceId}.`);
        onRefreshDevices?.();
      } else if (action === 'RESOLVE') {
        try {
          const updated = await resolveTicketAsync(targetId, { adminNote: 'Đã hoàn tất phiếu.' });
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
        } catch {
          setTickets(updateWarrantyTicket(ticket.id, { status: 'RESOLVED' }));
        }
        toast.success(`Đã hoàn tất phiếu ${ticket.id}.`);
      } else if (action === 'REJECT') {
        try {
          const updated = await rejectTicketAsync(targetId, { adminNote: 'Đã từ chối phiếu.' });
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
        } catch {
          setTickets(updateWarrantyTicket(ticket.id, { status: 'REJECTED' }));
        }
        toast.info(`Đã từ chối phiếu ${ticket.id}.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể thực hiện thao tác bảo hành.');
    } finally {
      setBusyId(null);
    }
  };

  const visibleTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        if (mode === 'staff' && currentStoreId && t.storeId && String(t.storeId) !== String(currentStoreId)) {
          return false;
        }
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (groupFilter !== 'ALL' && t.faultGroup !== groupFilter) return false;
        return true;
      });
  }, [tickets, mode, currentStoreId, statusFilter, groupFilter]);

  return (
    <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0E6BA8]" />
            <span>Bảo Hành & Đổi Trả 1-1 Thiết Bị</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-[#0E6BA8] dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              {visibleTickets.length} phiếu
            </span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {mode === 'admin'
              ? 'Tiếp nhận, phân loại lỗi Nhóm A/B/C/D, duyệt đổi mới 1-1 cho Store và khóa nút hỏng nặng.'
              : 'Kiểm tra ngoại quan khi thu hồi/đổi nút, tính mức khấu trừ cọc (0% / 30% / 70-100%) và gửi yêu cầu bảo hành.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPolicy((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {showPolicy ? 'Ẩn bảng quy chuẩn A/B/C/D' : 'Xem quy chuẩn Nhóm A/B/C/D'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0E6BA8] hover:bg-[#0B5585] text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lập phiếu bảo hành</span>
          </button>
        </div>
      </div>

      {mode === 'admin' && deviceFaultAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <BatteryWarning className="w-4 h-4" />
              <span>Cảnh báo lỗi từ nút bấm ({deviceFaultAlerts.length})</span>
            </h4>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400">
              Tự động nhận từ telemetry / pin ≤ 20% / trạng thái lỗi
            </span>
          </div>
          <div className="space-y-2">
            {deviceFaultAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white/90 dark:bg-zinc-900/80 border border-amber-200/80 dark:border-amber-900/60 px-3 py-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-white">{alert.deviceId}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                      {alert.faultCode}
                    </span>
                    {alert.storeName && <span className="text-[11px] text-zinc-500">· {alert.storeName}</span>}
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">{alert.message}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickTicketFromAlert(alert)}
                    className="px-2.5 py-1 rounded text-[11px] font-medium bg-[#0E6BA8] text-white hover:bg-[#0B5585] cursor-pointer"
                  >
                    Lập phiếu
                  </button>
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => void handleWarnFromAlert(alert)}
                    className="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <BellRing className="w-3 h-3" />
                    <span>Báo tài khoản</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedAlertIds((prev) => [...prev, alert.id])}
                    className="px-2 py-1 rounded text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Ẩn
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPolicy && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.values(WARRANTY_GROUPS) as typeof WARRANTY_GROUPS[WarrantyFaultGroup][]).map((g) => (
            <div key={g.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${g.badgeClass}`}>
                  {g.shortLabel}
                </span>
              </div>
              <p className="font-semibold text-zinc-900 dark:text-white">{g.title}</p>
              <p className="text-zinc-600 dark:text-zinc-400"><strong>Cư dân:</strong> {g.customerPolicy}</p>
              <p className="text-zinc-600 dark:text-zinc-400"><strong>Store ↔ Admin:</strong> {g.storeAdminPolicy}</p>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateTicket} className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/15 p-4 space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mã nút bấm *</label>
              <input
                type="text"
                list="warranty-device-options"
                value={deviceIdInput}
                onChange={(e) => setDeviceIdInput(e.target.value)}
                placeholder="VD: SOB-000003"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                required
              />
              <datalist id="warranty-device-options">
                {devices.slice(0, 100).map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceId} {d.store?.name || d.store?.storeName ? `— ${d.store?.name || d.store?.storeName}` : ''}
                  </option>
                ))}
              </datalist>
            </div>
            {mode === 'admin' && (
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Cửa hàng liên quan</label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                >
                  <option value="">Tự nhận theo nút / Kho tổng</option>
                  {stores.map((s) => (
                    <option key={String(s.id || s.storeId)} value={String(s.id || s.storeId)}>
                      {s.name || s.storeName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Phân nhóm lỗi *</label>
              <select
                value={faultGroup}
                onChange={(e) => handleGroupChange(e.target.value as WarrantyFaultGroup)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              >
                {Object.values(WARRANTY_GROUPS).map((g) => (
                  <option key={g.id} value={g.id}>{g.shortLabel}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mã lỗi chi tiết *</label>
              <select
                value={faultCode}
                onChange={(e) => setFaultCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              >
                {activeGroup.faults.map((f) => (
                  <option key={f.code} value={f.code}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tiền cọc gốc (VNĐ)</label>
              <input
                type="number"
                min={0}
                step={10000}
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                % Khấu trừ cọc ({activeGroup.deductionMin}%–{activeGroup.deductionMax}%)
              </label>
              <input
                type="number"
                min={activeGroup.deductionMin}
                max={activeGroup.deductionMax}
                disabled={activeGroup.deductionMin === activeGroup.deductionMax}
                value={deductionPercent}
                onChange={(e) => setDeductionPercent(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">Ghi chú kiểm tra ngoại quan / tình trạng nút</label>
            <input
              type="text"
              value={inspectionNote}
              onChange={(e) => setInspectionNote(e.target.value)}
              placeholder="VD: Vỏ nút bị nứt góc phải, mạch bên trong còn sống..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sky-200/70 dark:border-sky-900/50">
            <div className="flex flex-wrap gap-4 text-xs">
              <span>Khấu trừ: <strong className="text-rose-600 dark:text-rose-400">{calc.deductionAmount.toLocaleString('vi-VN')} ₫ ({calc.percent}%)</strong></span>
              <span>Hoàn lại / Giữ cọc: <strong className="text-emerald-600 dark:text-emerald-400">{calc.refundAmount.toLocaleString('vi-VN')} ₫</strong></span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#0E6BA8] text-white font-semibold hover:bg-[#0B5585] cursor-pointer"
              >
                Lưu phiếu bảo hành
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | WarrantyTicketStatus)}
          aria-label="Lọc theo trạng thái bảo hành"
          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ xử lý</option>
          <option value="APPROVED_SWAP">Đã duyệt đổi 1-1</option>
          <option value="RESOLVED">Hoàn tất</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as 'ALL' | WarrantyFaultGroup)}
          aria-label="Lọc theo nhóm lỗi bảo hành"
          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        >
          <option value="ALL">Tất cả nhóm lỗi (A/B/C/D)</option>
          <option value="GROUP_A">Nhóm A · Lỗi tự nhiên (0%)</option>
          <option value="GROUP_B">Nhóm B · Mạng & Trẻ em (0đ)</option>
          <option value="GROUP_C">Nhóm C · Vỡ vỏ nhẹ (30%)</option>
          <option value="GROUP_D">Nhóm D · Hỏng nặng/Mất (70-100%)</option>
        </select>
      </div>

      {visibleTickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-8 text-center text-xs text-zinc-500">
          Chưa có phiếu bảo hành nào. Bấm <strong>"Lập phiếu bảo hành"</strong> để ghi nhận nút lỗi hoặc hỗ trợ khách hàng.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2.5 px-3 font-medium">Mã Phiếu / Nút</th>
                <th className="py-2.5 px-3 font-medium">Nhóm & Mã Lỗi</th>
                <th className="py-2.5 px-3 font-medium">Khấu Trừ Cọc</th>
                <th className="py-2.5 px-3 font-medium">Trạng Thái</th>
                <th className="py-2.5 px-3 font-medium text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {visibleTickets.map((ticket) => {
                const grp = WARRANTY_GROUPS[ticket.faultGroup];
                const st = STATUS_BADGE[ticket.status];
                const isBusy = busyId === ticket.id;
                return (
                  <tr key={ticket.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/40">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-zinc-900 dark:text-white">{ticket.deviceId}</div>
                      <div className="text-[11px] text-zinc-500">{ticket.id}{ticket.storeName ? ` · ${ticket.storeName}` : ''}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${grp.badgeClass}`}>
                        {grp.shortLabel}
                      </span>
                      <div className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{ticket.faultLabel}</div>
                      <div className="text-[11px] text-zinc-500 max-w-xs truncate" title={ticket.inspectionNote}>{ticket.inspectionNote}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-rose-600 dark:text-rose-400">
                        -{ticket.deductionAmount.toLocaleString('vi-VN')} ₫ ({ticket.deductionPercent}%)
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Còn: {ticket.refundAmount.toLocaleString('vi-VN')} ₫
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${st.cls}`}>
                        {st.label}
                      </span>
                      {ticket.adminNote && (
                        <div className="mt-1 text-[10px] text-zinc-500 max-w-[180px] truncate" title={ticket.adminNote}>{ticket.adminNote}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        {ticket.faultGroup === 'GROUP_B' && ticket.status === 'PENDING' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAdminAction(ticket, 'CHILD_LOCK_2S')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-sky-50 text-[#0E6BA8] border border-sky-200 hover:bg-sky-100 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Giữ 2s</span>
                          </button>
                        )}
                        {mode === 'admin' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAdminAction(ticket, 'SEND_WARNING')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Gửi cảnh báo tới tài khoản đang dùng nút"
                          >
                            <BellRing className="w-3 h-3" />
                            <span>Gửi cảnh báo</span>
                          </button>
                        )}
                        {mode === 'admin' && ticket.status === 'PENDING' && (
                          <>
                            {(ticket.faultGroup === 'GROUP_A' || ticket.faultGroup === 'GROUP_C') && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleAdminAction(ticket, 'APPROVE_SWAP')}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Duyệt đổi 1-1</span>
                              </button>
                            )}
                            {ticket.faultGroup === 'GROUP_D' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleAdminAction(ticket, 'LOCK_DEVICE')}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Khóa nút</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleAdminAction(ticket, 'EXTEND_WARRANTY')}
                              className="px-2 py-1 rounded text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>+6T BH</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleAdminAction(ticket, 'REJECT')}
                              className="px-2 py-1 rounded text-[11px] font-medium text-zinc-500 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Từ chối"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {mode === 'admin' && ticket.status === 'APPROVED_SWAP' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAdminAction(ticket, 'RESOLVE')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Hoàn tất</span>
                          </button>
                        )}
                        {mode === 'staff' && ticket.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Chờ Admin duyệt</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
