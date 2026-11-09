import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, ChevronDown, KeyRound, Landmark, UserRound } from 'lucide-react';

export const CUSTOMER_ACCOUNT_LINKS = [
  { to: '/customer/profile?tab=INFO', tab: 'INFO', label: 'Thông tin cá nhân', icon: UserRound },
  { to: '/customer/verification', tab: 'VERIFICATION', label: 'Xác minh eKYC', icon: BadgeCheck },
  { to: '/customer/banking', tab: 'BANKING', label: 'Ngân hàng & hoàn tiền', icon: Landmark },
  { to: '/customer/profile?tab=SECURITY', tab: 'SECURITY', label: 'Bảo mật & Đổi mật khẩu', icon: KeyRound },
];

export const CustomerAccountNavigation: React.FC<{
  mobile?: boolean;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}> = ({ mobile = false, collapsed = false, onExpandSidebar, onNavigate }) => {
  const location = useLocation();
  const isAccount = ['/customer/profile', '/profile', '/customer/verification', '/customer/banking'].includes(location.pathname);
  const activeTab = new URLSearchParams(location.search).get('tab') || 'INFO';
  const selectedTab = location.pathname === '/customer/verification' ? 'VERIFICATION' : location.pathname === '/customer/banking' ? 'BANKING' : activeTab;
  const [expanded, setExpanded] = useState(isAccount);
  const trigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const submenuId = `customer-account-submenu-${mobile ? 'mobile' : 'desktop'}`;

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
          {CUSTOMER_ACCOUNT_LINKS.map(({ to, tab, label, icon: Icon }) => {
            const active = isAccount && selectedTab === tab;
            return <li key={tab}><Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-xs leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${active ? 'bg-[#287DA8]/10 font-semibold text-[#287DA8] dark:bg-sky-950/50 dark:text-sky-300' : 'font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{label}</span></Link></li>;
          })}
        </ul>
      </motion.div>}
    </AnimatePresence>
  </div>;
};
