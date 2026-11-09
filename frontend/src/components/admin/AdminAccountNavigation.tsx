import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, KeyRound, LogOut, MapPin, ShoppingBag, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoutConfirmModal } from '../common/LogoutConfirmModal';

export const ADMIN_ACCOUNT_LINKS = [
  { to: '/admin/profile?tab=INFO', tab: 'INFO', label: 'Thông tin cá nhân', icon: UserRound },
  { to: '/admin/profile?tab=ORDERS', tab: 'ORDERS', label: 'Lịch sử đặt hàng', icon: ShoppingBag },
  { to: '/admin/profile?tab=ADDRESSES', tab: 'ADDRESSES', label: 'Địa chỉ đã lưu', icon: MapPin },
  { to: '/admin/profile?tab=SECURITY', tab: 'SECURITY', label: 'Bảo mật & Đổi mật khẩu', icon: KeyRound },
];

export const AdminAccountNavigation: React.FC<{
  mobile?: boolean;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}> = ({ mobile = false, collapsed = false, onExpandSidebar, onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const isAccount = ['/admin/profile', '/profile'].includes(location.pathname);
  const activeTab = new URLSearchParams(location.search).get('tab') || 'INFO';
  const selectedTab = ADMIN_ACCOUNT_LINKS.some(item => item.tab === activeTab) ? activeTab : 'INFO';
  const [expanded, setExpanded] = useState(isAccount);
  const trigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const submenuId = `admin-account-submenu-${mobile ? 'mobile' : 'desktop'}`;

  useEffect(() => { if (isAccount) setExpanded(true); }, [isAccount, location.pathname, location.search, location.hash]);

  return <div className={mobile ? 'sm:col-span-2' : ''} onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); }
  }}>
    <button
      ref={trigger}
      type="button"
      aria-label="Tài khoản"
      title="Tài khoản"
      aria-expanded={expanded && !collapsed}
      aria-controls={submenuId}
      data-active={isAccount || undefined}
      onClick={() => { if (collapsed) { onExpandSidebar?.(); setExpanded(true); } else setExpanded(value => !value); }}
      className={`flex min-h-11 w-full items-center rounded-lg text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${mobile ? 'px-3' : ''} ${isAccount ? 'bg-[#287DA8]/5 text-[#287DA8] dark:bg-sky-950/30 dark:text-sky-300' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
    >
      <span className={`flex h-10 shrink-0 items-center justify-center ${mobile ? 'mr-3' : 'w-10'}`}><UserRound aria-hidden="true" size={18} strokeWidth={1.5} /></span>
      {!collapsed && <><span className="min-w-0 flex-1">Tài khoản</span><ChevronDown aria-hidden="true" className={`mx-2 h-3.5 w-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} /></>}
    </button>
    <AnimatePresence initial={false}>
      {expanded && !collapsed && <motion.div key="account-submenu" id={submenuId} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }} className="overflow-hidden">
        <ul className="my-1 ml-5 space-y-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          {ADMIN_ACCOUNT_LINKS.map(({ to, tab, label, icon: Icon }) => {
            const active = isAccount && selectedTab === tab;
            return <li key={tab}><Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-xs leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${active ? 'bg-[#287DA8]/10 font-semibold text-[#287DA8] dark:bg-sky-950/50 dark:text-sky-300' : 'font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{label}</span></Link></li>;
          })}
          <li className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800"><button type="button" onClick={() => setConfirmLogout(true)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-400 dark:hover:bg-rose-950/30"><LogOut aria-hidden="true" size={16} className="shrink-0" />Đăng xuất</button></li>
        </ul>
      </motion.div>}
    </AnimatePresence>
    <LogoutConfirmModal isOpen={confirmLogout && !!user} onClose={() => setConfirmLogout(false)} onConfirm={() => { setConfirmLogout(false); logout(); navigate('/login', { replace: true }); onNavigate?.(); }} user={user} />
  </div>;
};
