import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Cpu, Wallet } from 'lucide-react';

export const ADMIN_PACKAGE_LINKS = [
  { to: '/admin/dashboard?section=RENTALS', label: 'Gói thuê nút bấm', icon: Cpu },
  { to: '/admin/dashboard?section=PLANS', label: 'Gói dịch vụ', icon: Wallet },
];

export const AdminPackageNavigation: React.FC<{
  mobile?: boolean; collapsed?: boolean;
  onExpandSidebar?: () => void; onNavigate?: () => void;
}> = ({ mobile = false, collapsed = false, onExpandSidebar, onNavigate }) => {
  const location = useLocation();
  const section = new URLSearchParams(location.search).get('section');
  const isPackages = location.pathname === '/admin/dashboard' && ['RENTALS', 'PLANS'].includes(section || '');
  const [expanded, setExpanded] = useState(isPackages);
  const trigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const submenuId = `admin-package-submenu-${mobile ? 'mobile' : 'desktop'}`;
  useEffect(() => { if (isPackages) setExpanded(true); }, [isPackages, location.pathname, location.search]);

  return <div className={mobile ? 'sm:col-span-2' : ''} onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" aria-label="Gói nút bấm" title="Gói nút bấm" aria-expanded={expanded && !collapsed} aria-controls={submenuId}
      onClick={() => { if (collapsed) { onExpandSidebar?.(); setExpanded(true); } else setExpanded(value => !value); }}
      className={`flex min-h-11 w-full items-center rounded-lg text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${mobile ? 'px-3' : ''} ${isPackages ? 'bg-[#287DA8]/5 text-[#287DA8] dark:bg-sky-950/30 dark:text-sky-300' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
      <span className={`flex h-10 shrink-0 items-center justify-center ${mobile ? 'mr-3' : 'w-10'}`}><Cpu aria-hidden="true" size={18} strokeWidth={1.5} /></span>
      {!collapsed && <><span className="min-w-0 flex-1">Gói nút bấm</span><ChevronDown aria-hidden="true" className={`mx-2 h-3.5 w-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} /></>}
    </button>
    <AnimatePresence initial={false}>
      {expanded && !collapsed && <motion.div id={submenuId} key="package-submenu" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }} className="overflow-hidden">
        <ul className="my-1 ml-5 space-y-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          {ADMIN_PACKAGE_LINKS.map(({ to, label, icon: Icon }) => {
            const active = isPackages && new URLSearchParams(to.split('?')[1]).get('section') === section;
            return <li key={to}><Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-xs leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${active ? 'bg-[#287DA8]/10 font-semibold text-[#287DA8] dark:bg-sky-950/50 dark:text-sky-300' : 'font-medium text-zinc-500 hover:bg-zinc-100 hover:text-[#287DA8] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-sky-300'}`}>
              <Icon aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0" /><span>{label}</span>
            </Link></li>;
          })}
        </ul>
      </motion.div>}
    </AnimatePresence>
  </div>;
};
