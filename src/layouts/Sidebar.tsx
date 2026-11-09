import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Cpu,
  Landmark,
  Layers,
  LayoutDashboard,
  Menu,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  UserRound,
  Wallet,
  Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { CustomerAccountNavigation, CUSTOMER_ACCOUNT_LINKS } from '../components/customer/CustomerAccountNavigation';
import { StoreFinanceNavigation } from '../components/store/StoreFinanceNavigation';
import { StoreRevenueNavigation } from '../components/store/StoreRevenueNavigation';
import { AdminPackageNavigation } from '../components/admin/AdminPackageNavigation';
import { AdminAccountNavigation } from '../components/admin/AdminAccountNavigation';
import { AdminRevenueNavigation } from '../components/admin/AdminRevenueNavigation';

type NavigationItem = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const storeLinks: NavigationItem[] = [
  { to: '/store/dashboard', label: 'Đơn hàng trực tiếp', icon: ShoppingBag },
  { to: '/store/devices', label: 'Danh sách nút bấm', icon: Cpu },
  { to: '/store/rentals', label: 'Gói thuê nút IoT', icon: Cpu },
  { to: '/store/products', label: 'Sản phẩm & tồn kho', icon: Package },
  { to: '/store/analytics', label: 'Báo cáo doanh thu', icon: BarChart3 },
];

const customerLinks: NavigationItem[] = [
  { to: '/shop', label: 'Mua sắm', icon: ShoppingCart },
  { to: '/customer/home', label: 'Nút của tôi', icon: Smartphone },
  { to: '/customer/rentals', label: 'Thuê nút bấm', icon: Cpu },
  { to: '/customer/orders', label: 'Đơn hàng', icon: ReceiptText },
  { to: '/customer/profile', label: 'Tài khoản', icon: UserRound },
];

const adminLinks: NavigationItem[] = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/admin/dashboard?section=STORES', label: 'Cửa hàng', icon: Store },
  { to: '/admin/dashboard?section=RENTALS', label: 'Gói thuê nút bấm', icon: Cpu },
  { to: '/admin/dashboard?section=DEVICES', label: 'Kho nút bấm', icon: Cpu },
  { to: '/admin/dashboard?section=RBAC', label: 'Tài khoản & phân quyền', icon: UserRound },
  { to: '/admin/dashboard?section=ANALYTICS', label: 'Báo cáo & doanh thu', icon: BarChart3 },
  { to: '/admin/dashboard?section=NOTIFICATIONS', label: 'Cài đặt thông báo', icon: ShoppingBag },
  { to: '/admin/rental-activation', label: 'Kích hoạt hợp đồng thuê', icon: Cpu },
  { to: '/admin/profile', label: 'Tài khoản', icon: UserRound },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number } | null>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  }, [location.pathname, location.search, location.hash]);

  const isCustomer = user?.role === 'CUSTOMER';
  const accountTab = new URLSearchParams(location.search).get('tab') || 'INFO';
  const selectedAccountTab = location.pathname === '/customer/verification' ? 'VERIFICATION' : accountTab;
  const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user?.role || '');
  const links = isCustomer
    ? customerLinks
    : isAdmin
      ? adminLinks
      : [
          ...storeLinks.filter(link => !(user?.role === 'STORE_OWNER' && link.to === '/store/rentals')),
          ...(['STORE_OWNER', 'STORE_MANAGER', 'STAFF_ORDER'].includes(user?.role || '') ? [{ to: '/driver/deliveries', label: 'Giao hàng', icon: Truck }] : []),
          ...(['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role || '')
            ? [{ to: '/store/finance', label: 'Gói & ngân hàng', icon: Landmark }]
            : []),
        ];
  const title = isCustomer ? 'Khách hàng' : isAdmin ? 'Quản trị hệ thống' : user?.store?.name || 'Đại lý Nước & Gas Gia Đình';
  const subtitle = isCustomer ? 'Không gian mua sắm' : isAdmin ? 'Trung tâm điều hành' : 'Edge Broker Connected';
  const icon = isCustomer ? UserRound : isAdmin ? ShieldCheck : Store;
  const HeaderIcon = icon;

  const isLinkActive = (path: string) => {
    if (path === '/shop') return location.pathname === '/shop';
    if (isAdmin && path === '/admin/dashboard') {
      const section = new URLSearchParams(location.search).get('section');
      return location.pathname === path && (!section || section === 'OVERVIEW');
    }
    const [pathname, search] = path.split('?');
    if (isAdmin && pathname === '/admin/dashboard' && search) {
      return location.pathname === pathname && new URLSearchParams(location.search).get('section') === new URLSearchParams(search).get('section');
    }
    if (search) return location.pathname === pathname && location.search === `?${search}`;
    if (path.includes('profile')) {
      return location.pathname === pathname && (pathname === '/customer/profile' || !location.search || location.search === '?tab=INFO');
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
    <details ref={mobileMenuRef} className="w-full border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:hidden" onKeyDown={(event) => {
      if (event.key === 'Escape' && mobileMenuRef.current) {
        mobileMenuRef.current.open = false;
        mobileMenuRef.current.querySelector('summary')?.focus();
      }
    }}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
        <Menu size={20} className="shrink-0" />
        <span className="min-w-0 break-words">{isAdmin && location.pathname === '/admin/payouts' ? 'Theo dõi chi trả' : isAdmin && location.pathname === '/admin/dashboard' && ['PLANS', 'RENTALS'].includes(new URLSearchParams(location.search).get('section') || '') ? 'Gói nút bấm' : !isCustomer && !isAdmin && ['/store/finance', '/store/service-plans'].includes(location.pathname) ? 'Gói & ngân hàng' : isCustomer && ['/customer/profile', '/profile', '/customer/verification'].includes(location.pathname) ? CUSTOMER_ACCOUNT_LINKS.find(item => item.tab === selectedAccountTab)?.label || 'Tài khoản' : links.find((item) => isLinkActive(item.to))?.label || 'Menu điều hướng'}</span>
        <span className="ml-auto shrink-0 text-xs text-zinc-500">Menu</span>
      </summary>
      <nav aria-label="Điều hướng trên điện thoại" className="grid gap-1 px-3 pb-3 sm:grid-cols-2">
        {links.map(({ to, label, icon: Icon }) => to === '/admin/dashboard?section=ANALYTICS' ? <AdminRevenueNavigation key={to} mobile onNavigate={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }} /> : to === '/admin/profile' ? <AdminAccountNavigation key={to} mobile onNavigate={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }} /> : to === '/admin/dashboard?section=RENTALS' ? <AdminPackageNavigation key={to} mobile onNavigate={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }} /> : to === '/store/analytics' ? <StoreRevenueNavigation key={to} mobile onNavigate={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }} /> : to === '/store/finance' ? <StoreFinanceNavigation key={to} mobile canRegister={user?.role === 'STORE_OWNER'} onNavigate={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }} /> : isCustomer && to === '/customer/profile' ? <CustomerAccountNavigation key={to} mobile onNavigate={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }} /> : (
          <Link key={to} to={to} aria-current={isLinkActive(to) ? 'page' : undefined}
            onClick={() => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; }}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm ${isLinkActive(to) ? 'bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900'}`}>
            <Icon size={18} className="shrink-0" /><span className="min-w-0 break-words">{label}</span>
          </Link>
        ))}
      </nav>
    </details>
    <motion.aside
      initial={false}
      animate={{ width: isSidebarOpen ? 256 : 68 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className={`${isAdmin ? 'admin-navigation ' : ''}min-h-[calc(100vh-4rem)] border-r border-zinc-200 dark:border-zinc-800 flex-col justify-between shrink-0 overflow-hidden bg-[#FBFBFC] dark:bg-zinc-950 select-none z-20 hidden lg:flex`}
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
              if (item.to === '/admin/dashboard?section=ANALYTICS') return <AdminRevenueNavigation key={item.to} collapsed={!isSidebarOpen} onExpandSidebar={toggleSidebar} onNavigate={() => setHoveredItem(null)} />;
              if (item.to === '/admin/profile') return <AdminAccountNavigation key={item.to} collapsed={!isSidebarOpen} onExpandSidebar={toggleSidebar} onNavigate={() => setHoveredItem(null)} />;
              if (item.to === '/admin/dashboard?section=RENTALS') return <AdminPackageNavigation key={item.to} collapsed={!isSidebarOpen} onExpandSidebar={toggleSidebar} onNavigate={() => setHoveredItem(null)} />;
              if (item.to === '/store/analytics') return <StoreRevenueNavigation key={item.to} collapsed={!isSidebarOpen} onExpandSidebar={toggleSidebar} onNavigate={() => setHoveredItem(null)} />;
              if (item.to === '/store/finance') return <StoreFinanceNavigation key={item.to} canRegister={user?.role === 'STORE_OWNER'} collapsed={!isSidebarOpen} onExpandSidebar={toggleSidebar} onNavigate={() => setHoveredItem(null)} />;
              if (isCustomer && item.to === '/customer/profile') return <CustomerAccountNavigation key={item.to} collapsed={!isSidebarOpen} onExpandSidebar={toggleSidebar} onNavigate={() => setHoveredItem(null)} />;
              const Icon = item.icon;
              const isActive = isLinkActive(item.to);
              return (
                <Link key={item.to} to={item.to} aria-current={isActive ? 'page' : undefined} title={item.label} onClick={() => setHoveredItem(null)} onMouseEnter={(event) => { if (!isSidebarOpen) { const rect = event.currentTarget.getBoundingClientRect(); setHoveredItem({ label: item.label, top: rect.top + rect.height / 2 }); } }} onMouseLeave={() => setHoveredItem(null)} className={`relative flex items-center h-10 rounded-lg text-xs font-medium transition-colors group select-none cursor-pointer ${isActive ? 'text-[#287DA8] dark:text-[#38a5da] font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/40'}`}>
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
    </>
  );
};
