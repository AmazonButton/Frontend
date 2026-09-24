import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { ShoppingBag, Cpu, Package, BarChart3, ShieldCheck, Layers, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const links = [
    {
      to: '/store/dashboard',
      label: 'Đơn Hàng Trực Tiếp',
      icon: ShoppingBag,
    },
    {
      to: '/store/devices',
      label: 'Hạm Đội Nút Bấm',
      icon: Cpu,
    },
    {
      to: '/store/device-templates',
      label: 'Mẫu Thiết Bị',
      icon: Layers,
    },
    {
      to: '/store/products',
      label: 'Sản Phẩm & Tồn Kho',
      icon: Package,
    },
    {
      to: '/store/analytics',
      label: 'Báo Cáo Doanh Thu',
      icon: BarChart3,
    },
  ];

  const isLinkActive = (path: string) => {
    if (path === '/store/dashboard') {
      return location.pathname === '/store/dashboard' || location.pathname === '/store';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="w-[210px] bg-white dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800/80 min-h-[calc(100vh-4rem)] flex flex-col justify-between hidden md:flex shrink-0 select-none">
      <div>
        {/* ── Store Identity / Compact Header ── */}
        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6.5 h-6.5 rounded-md bg-slate-900 dark:bg-slate-100 flex items-center justify-center shrink-0 text-white dark:text-slate-900 shadow-xs">
              <Store className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate leading-snug tracking-tight"
                title={user?.store?.name || 'Đại lý Nước & Gas Gia Định'}
              >
                {user?.store?.name || 'Đại lý Nước & Gas Gia Định'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-none">
                  Edge Broker Connected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section Label ── */}
        <div className="px-3 pt-3 pb-1">
          <span className="text-[9.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Trạm Điều Hành
          </span>
        </div>

        {/* ── Navigation Links with Framer Motion Magic Glide ── */}
        <LayoutGroup id="sidebar-navigation">
          <nav className="px-2 space-y-0.5">
            {links.map((item) => {
              const Icon = item.icon;
              const isActive = isLinkActive(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors group ${
                    isActive
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Sliding Magic Background & Left Accent Line */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 bg-slate-100 dark:bg-slate-800/80 rounded-md border-l-2 border-slate-900 dark:border-slate-100"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}

                  <Icon
                    strokeWidth={1.5}
                    className={`relative z-10 w-3.5 h-3.5 shrink-0 transition-colors ${
                      isActive
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                    }`}
                  />
                  <span className="relative z-10 truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>

      {/* ── System Status Footer ── */}
      <div className="p-2.5 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" strokeWidth={1.5} />
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate">
              HMAC-SHA256
            </span>
          </div>
          <span className="text-[9px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
            Active
          </span>
        </div>
      </div>
    </aside>
  );
};

