import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Clock3, Landmark, Plus, WalletCards } from 'lucide-react';

export const STORE_FINANCE_LINKS = [
  { to: '/store/service-plans', label: 'Đăng ký gói dịch vụ', icon: Plus, ownerOnly: true },
  { to: '/store/finance#subscription-current', label: 'Gói đang dùng', icon: WalletCards },
  { to: '/store/finance#subscription-payments', label: 'Chi phí & lịch sử đóng tiền', icon: Clock3 },
  { to: '/store/finance#store-bank-accounts', label: 'Tài khoản ngân hàng', icon: Landmark },
];

export function isStoreFinanceLinkActive(to: string, pathname: string, hash: string, search = '') {
  if (to === '/store/service-plans') return pathname === to;
  if (pathname !== '/store/finance') return false;
  const anchor = to.split('#')[1];
  if (anchor === 'store-bank-accounts' && ['#store-bank-verification-history', '#bank-verification-title'].includes(hash)) return true;
  if (!hash && /(?:^|[?&])status=(success|cancelled)(?:&|$)/.test(search)) return anchor === 'store-bank-accounts';
  return (hash || '#subscription-current') === `#${anchor}`;
}

export const StoreFinanceNavigation: React.FC<{
  canRegister: boolean; mobile?: boolean; collapsed?: boolean;
  onExpandSidebar?: () => void; onNavigate?: () => void;
}> = ({ canRegister, mobile = false, collapsed = false, onExpandSidebar, onNavigate }) => {
  const location = useLocation();
  const isFinance = ['/store/finance', '/store/service-plans'].includes(location.pathname);
  const [expanded, setExpanded] = useState(isFinance);
  const trigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const submenuId = `store-finance-submenu-${mobile ? 'mobile' : 'desktop'}`;
  useEffect(() => { if (isFinance) setExpanded(true); }, [isFinance, location.pathname, location.hash]);

  return <div className={mobile ? 'sm:col-span-2' : ''} onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" aria-label="Gói & ngân hàng" title="Gói & ngân hàng" aria-expanded={expanded && !collapsed} aria-controls={submenuId}
      onClick={() => { if (collapsed) { onExpandSidebar?.(); setExpanded(true); } else setExpanded(value => !value); }}
      className={`flex min-h-11 w-full items-center rounded-lg text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${mobile ? 'px-3' : ''} ${isFinance ? 'bg-[#287DA8]/5 text-[#287DA8] dark:bg-sky-950/30 dark:text-sky-300' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
      <span className={`flex h-10 shrink-0 items-center justify-center ${mobile ? 'mr-3' : 'w-10'}`}><Landmark aria-hidden="true" size={18} strokeWidth={1.5} /></span>
      {!collapsed && <><span className="min-w-0 flex-1">Gói & ngân hàng</span><ChevronDown aria-hidden="true" className={`mx-2 h-3.5 w-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} /></>}
    </button>
    <AnimatePresence initial={false}>
      {expanded && !collapsed && <motion.div id={submenuId} key="finance-submenu" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }} className="overflow-hidden">
        <ul className="my-1 ml-5 space-y-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          {STORE_FINANCE_LINKS.filter(item => !item.ownerOnly || canRegister).map(({ to, label, icon: Icon }) => {
            const active = isStoreFinanceLinkActive(to, location.pathname, location.hash || '', location.search || '');
            return <li key={to}><Link to={to} onClick={() => {
              onNavigate?.();
              if (active && to.includes('#')) document.getElementById?.(to.split('#')[1])?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
            }} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-xs leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${active ? 'bg-[#287DA8]/10 font-semibold text-[#287DA8] dark:bg-sky-950/50 dark:text-sky-300' : 'font-medium text-zinc-500 hover:bg-zinc-100 hover:text-[#287DA8] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-sky-300'}`}>
              <Icon aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0" /><span>{label}</span>
            </Link></li>;
          })}
        </ul>
      </motion.div>}
    </AnimatePresence>
  </div>;
};
