import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, UserRound } from 'lucide-react';

export const ADMIN_ACCOUNT_LINKS = [
  { to: '/admin/profile?tab=INFO', tab: 'INFO', label: 'Thông tin tài khoản', icon: UserRound },
  { to: '/admin/profile?tab=SECURITY', tab: 'SECURITY', label: 'Thay đổi mật khẩu', icon: KeyRound },
];

export const AdminAccountNavigation: React.FC<{
  mobile?: boolean;
  collapsed?: boolean;
  profileBasePath?: string;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}> = ({ mobile = false, collapsed = false, profileBasePath = '/admin/profile', onNavigate }) => {
  const location = useLocation();
  const isAccount = [profileBasePath, '/profile'].includes(location.pathname);

  return (
    <Link
      to={profileBasePath}
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
