import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck,
  BarChart3,
  Cpu,
  Key,
  Landmark,
  Layers,
  LayoutDashboard,
  Menu,
  Package,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';

type NavigationItem = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const storeLinks: NavigationItem[] = [
  { to: '/store/dashboard', label: 'Đơn hàng trực tiếp', icon: ShoppingBag },
  { to: '/store/devices', label: 'Hạm đội nút bấm', icon: Cpu },
  { to: '/store/device-templates', label: 'Mẫu thiết bị', icon: Layers },
  { to: '/store/products', label: 'Sản phẩm & tồn kho', icon: Package },
  { to: '/store/analytics', label: 'Báo cáo doanh thu', icon: BarChart3 },
  { to: '/store/wallet', label: 'Ví & rút tiền', icon: Wallet },
  { to: '/store/profile?tab=SECURITY', label: 'Đổi mật khẩu', icon: Key },
];

const customerLinks: NavigationItem[] = [
  { to: '/shop', label: 'Mua sắm', icon: ShoppingCart },
  { to: '/customer/home', label: 'Nút của tôi', icon: Smartphone },
  { to: '/customer/orders', label: 'Đơn hàng', icon: ReceiptText },
  { to: '/customer/verification', label: 'Xác minh eKYC', icon: BadgeCheck },
  { to: '/customer/profile', label: 'Tài khoản', icon: UserRound },
  { to: '/customer/profile?tab=SECURITY', label: 'Đổi mật khẩu', icon: Key },
];

const adminLinks: NavigationItem[] = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/admin/dashboard?section=STORES', label: '1. Trạm cửa hàng', icon: Store },
  { to: '/admin/dashboard?section=CATALOG', label: '2. Danh mục gốc', icon: Layers },
  { to: '/admin/dashboard?section=DEVICES', label: '3. Kho nút bấm', icon: Cpu },
  { to: '/admin/dashboard?section=RBAC', label: '4. Tài khoản & phân quyền', icon: UserRound },
  { to: '/admin/dashboard?section=TELEMETRY', label: '5. Giám sát IoT & pin', icon: Smartphone },
  { to: '/admin/dashboard?section=ANALYTICS', label: '6. Báo cáo & doanh thu', icon: BarChart3 },
  { to: '/admin/dashboard?section=NOTIFICATIONS', label: '7. Cấu hình FCM', icon: ShoppingBag },
  { to: '/admin/dashboard?section=SECURITY', label: '8. An ninh & giả mạo', icon: ShieldAlert },
  { to: '/admin/payouts', label: 'Theo dõi chi trả', icon: Wallet },
  { to: '/admin/profile', label: 'Tài khoản', icon: UserRound },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number } | null>(null);

  const isCustomer = user?.role === 'CUSTOMER';
  const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user?.role || '');
  const links = isCustomer
    ? customerLinks
    : isAdmin
      ? adminLinks
      : [
          ...storeLinks,
          ...(['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role || '')
            ? [{ to: '/store/finance', label: 'Gói & ngân hàng', icon: Landmark }]
            : []),
        ];
  const title = isCustomer ? 'Khách hàng' : isAdmin ? 'Quản trị hệ thống' : user?.store?.name || 'Đại lý Nước & Gas Gia Đình';
  const subtitle = isCustomer ? 'Không gian mua sắm' : isAdmin ? 'Trung tâm điều hành' : 'Edge Broker Connected';
  const icon = isCustomer ? UserRound : isAdmin ? ShieldCheck : Store;
  const HeaderIcon = icon;
  const compactOnMobile = isCustomer || isAdmin;

  const isLinkActive = (path: string) => {
    if (path === '/shop') return location.pathname === '/shop';
    const [pathname, search] = path.split('?');
    if (search) return location.pathname === pathname && location.search === `?${search}`;
    if (path.includes('profile')) {
      return location.pathname === pathname && (!location.search || location.search === '?tab=INFO');
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 256 : 68 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className={`min-h-[calc(100vh-4rem)] border-r border-zinc-200 dark:border-zinc-800 flex-col justify-between shrink-0 overflow-hidden bg-[#FBFBFC] dark:bg-zinc-950 select-none z-20 ${compactOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      <div>
        <div className="px-3 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 h-[58px] flex items-center relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isSidebarOpen ? (
              <motion.div key="expanded-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center min-w-0 flex-1 gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#287DA8] flex items-center justify-center shrink-0 text-white shadow-[0_2px_8px_rgba(40,125,168,0.25)]">
                    <HeaderIcon size={15} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug tracking-tight" title={title}>{title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-1.5 w-1.5 shrink-0"><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-none">{subtitle}</span>
                    </div>
                  </div>
                </div>
                <button onClick={toggleSidebar} className="w-7 h-7 rounded-md hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-500 hover:text-[#287DA8] dark:text-zinc-400 dark:hover:white transition-colors shrink-0 flex items-center justify-center cursor-pointer ml-1" title="Thu gọn thanh điều hướng" aria-label="Thu gọn thanh điều hướng">
                  <Menu size={17} strokeWidth={1.5} />
                </button>
              </motion.div>
            ) : (
              <motion.div key="collapsed-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="w-full flex items-center justify-center">
                <button onClick={toggleSidebar} onMouseEnter={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setHoveredItem({ label: 'Mở rộng thanh điều hướng', top: rect.top + rect.height / 2 }); }} onMouseLeave={() => setHoveredItem(null)} className="w-10 h-10 rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-600 hover:text-[#287DA8] dark:text-zinc-400 dark:hover:white transition-colors flex items-center justify-center cursor-pointer" title="Mở rộng thanh điều hướng" aria-label="Mở rộng thanh điều hướng">
                  <Menu size={18} strokeWidth={1.5} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-3.5 pt-3 pb-1 h-6 flex items-center">
          <motion.span initial={false} animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} transition={{ duration: 0.2 }} className="text-[9.5px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider overflow-hidden whitespace-nowrap">
            Điều hướng
          </motion.span>
        </div>

        <LayoutGroup id="sidebar-navigation">
          <nav className="px-3.5 space-y-1 mt-1">
            {links.map((item) => {
              const Icon = item.icon;
              const isActive = isLinkActive(item.to);
              return (
                <Link key={item.to} to={item.to} onClick={() => setHoveredItem(null)} onMouseEnter={(event) => { if (!isSidebarOpen) { const rect = event.currentTarget.getBoundingClientRect(); setHoveredItem({ label: item.label, top: rect.top + rect.height / 2 }); } }} onMouseLeave={() => setHoveredItem(null)} className={`relative flex items-center h-10 rounded-lg text-xs font-medium transition-colors group select-none cursor-pointer ${isActive ? 'text-[#287DA8] dark:text-[#38a5da] font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/40'}`}>
                  {isActive && <motion.div layoutId="sidebar-active-pill" className="absolute inset-0 bg-[#287DA8]/10 dark:bg-[#287DA8]/15 rounded-lg border-l-[3px] border-[#287DA8] dark:border-[#38a5da] pointer-events-none" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <div className="w-[40px] h-[40px] flex items-center justify-center shrink-0 relative z-10 pointer-events-none"><Icon size={18} strokeWidth={1.5} className={isActive ? 'text-[#287DA8] dark:text-[#38a5da]' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-[#287DA8] dark:group-hover:text-[#38a5da]'} /></div>
                  <motion.span initial={false} animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} transition={{ duration: 0.2 }} className="relative z-10 overflow-hidden whitespace-nowrap pl-1 text-[13px] pointer-events-none">{item.label}</motion.span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>

      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <div className={`flex items-center rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800 h-9 transition-all ${isSidebarOpen ? 'px-2 justify-between' : 'justify-center px-0'}`}>
          <div className="flex items-center gap-1.5 min-w-0"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={1.5} /><motion.span initial={false} animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }} transition={{ duration: 0.2 }} className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 truncate overflow-hidden whitespace-nowrap">Đang hoạt động</motion.span></div>
        </div>
      </div>

      {hoveredItem && !isSidebarOpen && ReactDOM.createPortal(<div style={{ top: hoveredItem.top }} className="fixed left-[76px] -translate-y-1/2 z-50 pointer-events-none"><div className="bg-zinc-900 text-white text-xs font-medium rounded-md px-2 py-1 shadow-lg whitespace-nowrap">{hoveredItem.label}</div></div>, document.body)}
    </motion.aside>
  );
};
