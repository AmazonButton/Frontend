import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/OrderSoundContext';
import { LogOut, Shield, Store, Sun, Moon, Volume2, VolumeX, Menu, X, ShoppingCart } from 'lucide-react';
import { HeaderNavigation } from '../components/common/HeaderNavigation';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import { NotificationBellPopover } from '../components/common/NotificationBellPopover';

import { ROLE_BADGE_META } from '../utils/authority';

const MotionLink = (motion.create || motion)(Link);

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSoundEnabled, toggleSound } = useSound();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isCustomer = user?.role === 'CUSTOMER';
  const isStoreUser = user?.role === 'STORE_OWNER';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash, location.search]);

  // Auto-dismiss logout modal if route goes to login or user is logged out
  useEffect(() => {
    if (showLogoutModal && (location.pathname === '/login' || !user)) {
      setShowLogoutModal(false);
    }
  }, [location.pathname, user, showLogoutModal]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync user avatar with ProfilePage storage and realtime event
  const [userAvatar, setUserAvatar] = useState<string | null>(() => {
    if (!user) return null;
    const uid = user.id || 'store-owner';
    return localStorage.getItem(`sob_avatar_${uid}`) || (user as any)?.avatar || null;
  });

  useEffect(() => {
    const syncAvatar = (e?: any) => {
      if (e?.detail !== undefined) {
        setUserAvatar(e.detail);
        return;
      }
      if (!user) {
        setUserAvatar(null);
        return;
      }
      const uid = user.id || 'store-owner';
      setUserAvatar(localStorage.getItem(`sob_avatar_${uid}`) || (user as any)?.avatar || null);
    };

    syncAvatar();
    window.addEventListener('sob_avatar_updated', syncAvatar);
    window.addEventListener('storage', syncAvatar);
    return () => {
      window.removeEventListener('sob_avatar_updated', syncAvatar);
      window.removeEventListener('storage', syncAvatar);
    };
  }, [user]);

  const isActive = (path: string) => location.pathname === path;

  const getRoleBadge = (role: string) => {
    return ROLE_BADGE_META[role] || ROLE_BADGE_META.CUSTOMER;
  };

  const getDisplayName = (name?: string) => {
    if (!name) return '';
    // Strip trailing parentheses like "(Super Admin)" or "(Store Owner)"
    return name.replace(/\s*\([^)]*\)/g, '').trim();
  };

  const getProfileRoute = (role?: string) => {
    if (role === 'CUSTOMER') return '/customer/profile';
    if (role === 'STORE_OWNER') return '/store/profile';
    if (role === 'SYSTEM_STAFF') return '/system-staff/profile';
    if (['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(role || '')) return '/admin/profile';
    return '/profile';
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const cleanName = getDisplayName(name) || name;
    const parts = cleanName.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <header
      data-navbar="true"
      className={`fixed top-0 left-0 w-full z-50 transition-[background-color,border-color,box-shadow] duration-200 ease-in-out ${
        isCustomer || isStoreUser || isScrolled
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border-b border-slate-200/80 dark:border-zinc-800'
          : 'bg-transparent border-b border-transparent backdrop-blur-sm'
      }`}
    >
      <div className={`h-16 flex items-center justify-between gap-2 sm:gap-4 transition-all duration-200 ${
        user ? 'w-full px-4 sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'
      }`}>

        {/* ================================================================= */}
        {/* LEFT: Clean Brand Logo & Name                                     */}
        {/* ================================================================= */}
        <div className="flex items-center gap-6 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 flex items-center justify-center shrink-0">
              <img
                src="/assets/logo.png"
                alt="Smart Order Button"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="hidden sm:block text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Smart Order Button
            </span>
          </Link>
        </div>

        {/* ================================================================= */}
        {/* CENTER: Clean Minimalist Navigation Pill                          */}
        {/* ================================================================= */}
        

        {user && user.role === 'SUPER_ADMIN' && (
          <nav aria-label="Điều hướng admin" className="hidden lg:flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
            {[
              { to: '/admin/dashboard', label: 'Quản trị', icon: Shield },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive(to)
                    ? 'bg-white text-[#0E6BA8] shadow-xs dark:bg-zinc-800 dark:text-sky-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        )}

        {!user && (
          <div className="hidden lg:flex items-center justify-center">
            <HeaderNavigation />
          </div>
        )}

        {/* ================================================================= */}
        {/* RIGHT: Realtime Notifications & Clean Profile Dropdown            */}
        {/* ================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isCustomer && location.pathname !== '/shop' && (
                <Link
                  to="/shop"
                  aria-label="Không gian mua sắm"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#287DA8] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#206588] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                  <span className="sm:hidden">Mua sắm</span>
                  <span className="hidden sm:inline">Không gian mua sắm</span>
                </Link>
              )}
              {user.role === 'STORE_OWNER' && location.pathname !== '/store/dashboard' && (
                <Link
                  to="/store/dashboard"
                  aria-label="Quản lý cửa hàng"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#287DA8] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#206588] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <Store aria-hidden="true" className="h-4 w-4" />
                  <span className="sm:hidden">Quản lý</span>
                  <span className="hidden sm:inline">Quản lý cửa hàng</span>
                </Link>
              )}
              <div role="group" aria-label="Thông báo và giao diện" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <NotificationBellPopover />
                {isStoreUser && (
                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={isSoundEnabled}
                    aria-label="Chuông đơn hàng"
                    title={isSoundEnabled ? 'Chuông đơn hàng đang bật — bấm để tắt' : 'Chuông đơn hàng đang tắt — bấm để bật'}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] cursor-pointer ${isSoundEnabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800'}`}
                  >
                    {isSoundEnabled ? <Volume2 aria-hidden="true" className="h-4 w-4" /> : <VolumeX aria-hidden="true" className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                  title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
                >
                  {theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4 text-amber-400" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  to={getProfileRoute(user.role)}
                  aria-label="Mở trang tài khoản"
                  title="Tài khoản của tôi"
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 sm:px-2.5 text-left transition hover:border-[#287DA8]/40 hover:bg-sky-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#0E6BA8] text-white flex items-center justify-center overflow-hidden text-[11px] font-bold shrink-0">
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="w-full h-full object-cover" onError={() => setUserAvatar(null)} />
                    ) : (
                      getInitials(user.fullName)
                    )}
                  </span>
                  <div className="hidden lg:flex flex-col min-w-0">
                    <span className="max-w-32 truncate text-xs font-semibold text-slate-800 dark:text-zinc-100 leading-tight">
                      {getDisplayName(user.fullName)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 leading-tight truncate">
                      {getRoleBadge(user.role).label}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#cce3ef] bg-[#eaf4f9] px-4 py-1.5 text-xs font-semibold text-[#216d92] transition-colors hover:border-[#afd2e4] hover:bg-[#dceef7] active:bg-[#cfe5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8] dark:border-[#2a5267] dark:bg-[#183649] dark:text-[#a7deee] dark:hover:bg-[#21485e] dark:active:bg-[#2a5267]"
              >
                Đăng nhập
              </Link>
              {/* Mobile menu toggle (Guest only) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                aria-label="Mở menu điều hướng"
                aria-expanded={mobileMenuOpen}
                aria-controls="guest-navigation"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Dropdown (Guest only) */}
      <AnimatePresence>
        {mobileMenuOpen && !user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            id="guest-navigation"
            className="lg:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md px-4 py-4"
          >
            <div className="flex flex-col space-y-1">
              
              <HeaderNavigation isMobile={true} onMobileSelect={() => setMobileMenuOpen(false)} />
              <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#cce3ef] bg-[#eaf4f9] px-4 py-2 text-xs font-semibold text-[#216d92] transition-colors hover:border-[#afd2e4] hover:bg-[#dceef7] active:bg-[#cfe5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8] dark:border-[#2a5267] dark:bg-[#183649] dark:text-[#a7deee] dark:hover:bg-[#21485e] dark:active:bg-[#2a5267]"
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      

      {/* Designer Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal && !!user}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
          navigate('/login', { replace: true });
        }}
        user={user}
      />
    </header>
  );
};
