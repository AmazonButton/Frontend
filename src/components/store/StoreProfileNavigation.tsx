import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, Radio, Store, UserRound } from 'lucide-react';

export const STORE_PROFILE_LINKS = [
  { to: '/store/profile?tab=INFO', tab: 'INFO', label: 'Thông tin tài khoản & đại lý', icon: Store },
  { to: '/store/profile?tab=NOTIFICATIONS', tab: 'NOTIFICATIONS', label: 'Cài đặt thông báo', icon: Radio },
  { to: '/store/profile?tab=SECURITY', tab: 'SECURITY', label: 'Thay đổi mật khẩu', icon: KeyRound },
];

export const StoreProfileNavigation: React.FC<{
  mobile?: boolean;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}> = ({ mobile = false, collapsed = false, onNavigate }) => {
  const location = useLocation();
  const isAccount = ['/store/profile', '/profile'].includes(location.pathname);

  return (
    <Link
      to="/store/profile"
      aria-label="Tài khoản"
      title="Tài khoản"
      aria-current={isAccount ? 'page' : undefined}
      onClick={onNavigate}
      className={`flex min-h-10 w-full items-center rounded-lg text-left text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] ${mobile ? 'px-3' : ''} ${isAccount ? 'bg-[#287DA8]/10 font-semibold text-[#287DA8] dark:bg-sky-950/30 dark:text-sky-300' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
    >
      <span className={`flex h-10 shrink-0 items-center justify-center ${mobile ? 'mr-3' : 'w-10'}`}>
        <UserRound aria-hidden="true" size={18} strokeWidth={1.5} />
      </span>
      {!collapsed && <span className="min-w-0 flex-1 pl-1">Tài khoản</span>}
    </Link>
  );
};
