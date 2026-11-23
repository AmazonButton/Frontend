import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BatteryWarning,
  Boxes,
  Cpu,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PlatformDevicesWorkspace } from '../../components/devices/PlatformDevicesWorkspace';
import { WarrantyPanel } from '../../components/devices/WarrantyPanel';
import { ReturnInspectionPanel } from '../../components/devices/ReturnInspectionPanel';

interface FleetStatsSummary {
  total: number;
  unassigned: number;
  online: number;
  lowBattery: number;
}

export const SystemStaffWorkspace: React.FC<{ section: 'DEVICES' | 'WARRANTY' | 'RETURNS' }> = ({
  section,
}) => {
  const { user } = useAuth();
  const [unassignedDevices, setUnassignedDevices] = useState<any[]>([]);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchHardwareData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const reqConfig = forceRefresh ? { headers: { 'x-no-cache': '1' } } : undefined;
      const needsWarrantyContext = section === 'WARRANTY';
      const [statsRes, devicesRes, storesRes] = await Promise.all([
        api.get('/devices/fleet/stats', reqConfig).catch(() => ({ data: { success: false, data: null } })),
        needsWarrantyContext
          ? api.get('/devices?page=1&pageSize=20', reqConfig)
          : Promise.resolve({ data: { success: false, data: null } }),
        needsWarrantyContext
          ? api.get('/stores?page=1&pageSize=20', reqConfig).catch(() => ({ data: { success: false, data: [] } }))
          : Promise.resolve({ data: { success: false, data: null } }),
      ]);

      if (devicesRes.data?.success && Array.isArray(devicesRes.data.data)) {
        setAllDevices(devicesRes.data.data);
      }
      if (storesRes.data?.success && Array.isArray(storesRes.data.data)) {
        setStores(storesRes.data.data);
      }
      const rawStats = statsRes.data?.data;
      if (rawStats && typeof rawStats === 'object') {
        setFleetStats({
          total: Number(rawStats.total ?? rawStats.totalDevices ?? rawStats.totalButtons ?? 0),
          unassigned: Number(rawStats.unassigned ?? rawStats.inWarehouse ?? rawStats.available ?? 0),
          online: Number(rawStats.online ?? rawStats.active ?? rawStats.onlineDevices ?? 0),
          lowBattery: Number(rawStats.lowBattery ?? rawStats.lowBatteryCount ?? 0),
        });
      }
      setUnassignedDevices([]);
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message || 'Không tải được dữ liệu thiết bị từ máy chủ.'
      );
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    void fetchHardwareData();
  }, [fetchHardwareData]);

  const sectionMeta =
    section === 'DEVICES'
      ? {
          title: 'Kho nút bấm & Cấp phát thiết bị',
          desc: 'Quản lý kho trung tâm, tạo lô mới, nhập CSV, cấp phát về kho đại lý và vận hành phần cứng.',
        }
      : section === 'WARRANTY'
        ? {
            title: 'Bảo hành kỹ thuật & Đổi nút 1-1',
            desc: 'Tiếp nhận sự cố, duyệt đổi nút 1-1 kế thừa hợp đồng thuê hoặc khóa nút lỗi chuyển hoàn cọc chờ Admin duyệt.',
          }
        : {
            title: 'Nhận nút trả & Kiểm tra thu hồi',
            desc: 'Kiểm tra ngoại quan nút bấm khách hoàn trả và xác nhận nhập lại kho hệ thống.',
          };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Executive Header Card */}
      <header className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0E6BA8] dark:text-sky-300 border border-sky-200/80 dark:border-sky-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Kỹ thuật hệ thống · SYSTEM_STAFF
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {sectionMeta.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-2xl">
              {sectionMeta.desc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to="/system-staff/templates"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/70 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-[#0E6BA8]" />
              <span>Mẫu cấu hình nút</span>
            </Link>
            <button
              type="button"
              onClick={() => void fetchHardwareData(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Tải lại dữ liệu</span>
            </button>
          </div>
        </div>

        {/* Clean Segmented Module Switcher + Live Fleet KPIs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <nav aria-label="Phân hệ kỹ thuật" className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-800/70 p-1">
            {[
              { to: '/system-staff/devices', key: 'DEVICES', label: 'Kho & cấp phát nút', icon: Cpu },
              { to: '/system-staff/warranty', key: 'WARRANTY', label: 'Bảo hành thiết bị', icon: ShieldCheck },
              { to: '/system-staff/returns', key: 'RETURNS', label: 'Nhận nút trả', icon: RotateCcw },
            ].map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-[color,transform] duration-150 active:scale-[0.97] ${
                    active
                      ? 'text-[#0E6BA8] dark:text-sky-400'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="staff-module-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-900 shadow-xs pointer-events-none"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {fleetStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 px-3 py-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#0E6BA8] shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 leading-none">Tổng kho</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{fleetStats.total}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 px-3 py-1.5">
                <Boxes className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 leading-none">Chưa cấp phát</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{fleetStats.unassigned}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 px-3 py-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 leading-none">Đang online</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{fleetStats.online}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40 px-3 py-1.5">
                <BatteryWarning className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 leading-none">Pin yếu</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{fleetStats.lowBattery}</p>
                </div>
              </div>
            </div>
          )}
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

      <div key={section} className="motion-view-enter">
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
    </div>
  );
};
