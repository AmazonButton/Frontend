import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  AlertTriangle,
  Clock,
  Terminal,
  Activity,
  Lock,
  RefreshCw,
} from 'lucide-react';

export const AdminSecurityHubPage: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const res = await api.get('/admin/security/devices');
      if (res.data.success) {
        setIncidents(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load security incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Cổng Giám Sát An Ninh Thiết Bị (Security Hub)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                ZERO-TRUST MONITOR
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phát hiện tấn công Replay, vi phạm độ lệch thời gian NTP, sai chữ ký HMAC-SHA256 & mã QR bất hợp lệ
            </p>
          </div>
        </div>

        <button
          onClick={fetchIncidents}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm Mới</span>
        </button>
      </div>

      {/* Security Status Badges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase font-mono">
            Chữ Ký HMAC-SHA256
          </div>
          <div className="flex items-center gap-2 mt-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Active (Hardware Crypto)</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase font-mono">
            Chống Tấn Công Replay
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Lock className="w-5 h-5 text-cyan-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Enforced (Nonce Cache)</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase font-mono">
            Độ Lệch Đồng Hồ NTP
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Dung Sai ±300s</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase font-mono">
            Sự Kiện Cảnh Báo
          </div>
          <div className="flex items-center gap-2 mt-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {incidents.length} cảnh báo gần nhất
            </span>
          </div>
        </div>
      </div>

      {/* Incident Feed */}
      <div className="p-6 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-cyan-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Nhật Ký Sự Kiện An Ninh Thiết Bị Thời Gian Thực
          </h2>
        </div>

        {incidents.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Hệ thống an toàn tuyệt đối
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Chưa phát hiện hành vi tấn công Replay hay sai chữ ký HMAC nào.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-black/40 text-slate-400 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="py-2.5 px-3">Thời Gian</th>
                  <th className="py-2.5 px-3">Loại Sự Kiện</th>
                  <th className="py-2.5 px-3">Device ID</th>
                  <th className="py-2.5 px-3">Chi Tiết Cảnh Báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {incidents.map((inc, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(inc.timestamp).toLocaleTimeString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-rose-500">
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                        {inc.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-cyan-500">{inc.deviceId}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{inc.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
