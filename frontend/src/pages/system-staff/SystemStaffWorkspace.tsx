import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PlatformDevicesWorkspace } from '../../components/devices/PlatformDevicesWorkspace';
import { WarrantyPanel } from '../../components/devices/WarrantyPanel';
import { ReturnInspectionPanel } from '../../components/devices/ReturnInspectionPanel';

export const SystemStaffWorkspace: React.FC<{ section: 'DEVICES' | 'WARRANTY' | 'RETURNS' }> = ({
  section,
}) => {
  const { user } = useAuth();
  const [unassignedDevices, setUnassignedDevices] = useState<any[]>([]);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchHardwareData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [devicesRes, storesRes] = await Promise.all([
        api.get('/devices?page=1&pageSize=20'),
        api.get('/stores?page=1&pageSize=20').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (devicesRes.data?.success && Array.isArray(devicesRes.data.data)) {
        setAllDevices(devicesRes.data.data);
      }
      if (storesRes.data?.success && Array.isArray(storesRes.data.data)) {
        setStores(storesRes.data.data);
      }
      setUnassignedDevices([]);
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || 'Không tải được dữ liệu thiết bị từ máy chủ.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHardwareData();
  }, [fetchHardwareData]);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              SYSTEM_STAFF · Kỹ thuật hệ thống
            </span>
          </div>
          <h1 className="mt-1.5 text-lg font-bold text-zinc-900 dark:text-white">
            {section === 'DEVICES'
              ? 'Kho nút bấm & Cấp phát thiết bị'
              : section === 'WARRANTY'
                ? 'Xử lý bảo hành & Đổi thiết bị 1-1'
                : 'Tiếp nhận & Kiểm tra Nút Khách trả'}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Phạm vi kỹ thuật: quản lý kho nút, cấp phát, khôi phục xuất xưởng và bảo hành kỹ thuật (không bao gồm duyệt hoàn cọc tài chính, chi trả hay quản trị cửa hàng).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/system-staff/devices"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors ${
              section === 'DEVICES'
                ? 'bg-[#0E6BA8] text-white border-[#0E6BA8]'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Kho nút bấm</span>
          </Link>
          <Link
            to="/system-staff/warranty"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors ${
              section === 'WARRANTY'
                ? 'bg-[#0E6BA8] text-white border-[#0E6BA8]'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bảo hành</span>
          </Link>
          <Link
            to="/system-staff/returns"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors ${
              section === 'RETURNS'
                ? 'bg-[#0E6BA8] text-white border-[#0E6BA8]'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Nhận nút trả</span>
          </Link>
          <button
            type="button"
            onClick={() => void fetchHardwareData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {section === 'DEVICES' ? (
        <PlatformDevicesWorkspace
          unassignedDevices={unassignedDevices}
          allDevices={allDevices}
          stores={stores}
          onRefresh={fetchHardwareData}
        />
      ) : section === 'RETURNS' ? (
        <ReturnInspectionPanel onConfirmed={fetchHardwareData} />
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs">
          <WarrantyPanel
            mode="system_staff"
            devices={allDevices}
            stores={stores}
            currentUserName={user?.fullName}
            currentUserRole={user?.role}
            onRefreshDevices={fetchHardwareData}
          />
        </div>
      )}
    </div>
  );
};
