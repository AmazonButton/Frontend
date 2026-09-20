import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingBag, Cpu, Package, BarChart3, ShieldCheck, Activity, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const links = [
    { to: '/store/dashboard', label: 'Đơn Hàng Trực Tiếp', icon: ShoppingBag, badge: 'Realtime' },
    { to: '/store/devices', label: 'Hạm Đội Nút Bấm', icon: Cpu, badge: 'Fleet' },
    { to: '/store/device-templates', label: 'Mẫu Thiết Bị (Templates)', icon: Layers, badge: null },
    { to: '/store/products', label: 'Sản Phẩm & Tồn Kho', icon: Package, badge: null },
    { to: '/store/analytics', label: 'Báo Cáo Doanh Thu', icon: BarChart3, badge: null },
  ];

  return (
    <aside className="w-64 bg-white/70 dark:bg-[#08080A]/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-red-500/20 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 hidden md:flex transition-colors">
      <div className="space-y-4">
        {/* Store Profile Card */}
        <div className="p-3.5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-black border border-slate-200/80 dark:border-red-500/20 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-red-400/90 uppercase tracking-wider">Trạm Điều Hành</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 dark:bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-red-500"></span>
            </span>
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.store?.name || 'Đại Lý Nước & Gas'}</p>
          <div className="flex items-center space-x-1.5 mt-2 pt-2 border-t border-slate-200/60 dark:border-red-500/15">
            <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-red-400" />
            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">Edge Broker Connected</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="space-y-1.5">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 dark:bg-red-600 text-white shadow-lg shadow-blue-500/25 dark:shadow-red-600/35 border border-transparent dark:border-red-500/40'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-red-950/30 dark:hover:border dark:hover:border-red-500/20'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 transition-transform ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-red-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-red-400 border border-emerald-500/20 dark:border-red-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Node Card */}
      <div className="p-3 bg-slate-50 dark:bg-black/50 border border-slate-200/80 dark:border-red-500/20 rounded-2xl">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-red-400" />
          <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200">HMAC-SHA256 Active</span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Nút bấm IoT được ký điện tử bảo mật tại phần cứng</p>
      </div>
    </aside>
  );
};
