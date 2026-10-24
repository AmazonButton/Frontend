import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/OrderSoundContext';
import { LogOut, Shield, ShieldAlert, Store, Smartphone, Sun, Moon, Wifi, CheckCircle2, BadgeCheck, User as UserIcon, Volume2, VolumeX, Bluetooth, Menu, X, ShoppingCart, ReceiptText, ChevronDown } from 'lucide-react';
import { WhiteDeviceAirPodsModal } from '../components/devices/WhiteDeviceAirPodsModal';
import { HeaderNavigation } from '../components/common/HeaderNavigation';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import { NotificationBellPopover } from '../components/common/NotificationBellPopover';

const MotionLink = (motion.create || motion)(Link);

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSoundEnabled, toggleSound, testSound } = useSound();
  const navigate = useNavigate();
  const location = useLocation();

  const [showAirPodsModal, setShowAirPodsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isCustomer = user?.role === 'CUSTOMER';
  const isStoreUser = ['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(user?.role || '');

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

  useEffect(() => {
    const closeUserMenu = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', closeUserMenu);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('mousedown', closeUserMenu);
      document.removeEventListener('keydown', closeWithEscape);
    };
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
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Admin Hub', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'STORE_OWNER':
        return { label: 'Chủ Cửa Hàng', color: 'bg-[#287DA8]/10 text-[#287DA8] dark:text-[#38a5da] border-[#287DA8]/25' };
      case 'STORE_MANAGER':
      case 'STORE_STAFF':
        return { label: 'Nhân Viên Cửa Hàng', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' };
      case 'TECHNICIAN':
        return { label: 'Kỹ Thuật Viên', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'CUSTOMER':
      default:
        return { label: 'Khách Hàng', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }
  };

  const getDisplayName = (name?: string) => {
    if (!name) return '';
    // Strip trailing parentheses like "(Super Admin)" or "(Store Owner)"
    return name.replace(/\s*\([^)]*\)/g, '').trim();
  };

  const getProfileRoute = (role?: string) => {
    if (role === 'CUSTOMER') return '/customer/profile';
    if (['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(role || '')) return '/store/profile';
    if (role === 'SUPER_ADMIN') return '/admin/profile';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

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
          <nav aria-label="Điều hướng admin" className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
            {[
              { to: '/admin/dashboard', label: 'Admin Hub', icon: Shield },
              { to: '/admin/security/devices', label: 'Security Hub', icon: ShieldAlert },
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
          <div className="hidden md:flex items-center justify-center">
            <HeaderNavigation />
          </div>
        )}

        {/* ================================================================= */}
        {/* RIGHT: Realtime Notifications & Clean Profile Dropdown            */}
        {/* ================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div ref={userMenuRef} className="flex items-center gap-1.5 sm:gap-2">
              <NotificationBellPopover />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Mở menu tài khoản"
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 sm:px-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#0E6BA8] text-white flex items-center justify-center overflow-hidden text-[11px] font-bold">
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="w-full h-full object-cover" onError={() => setUserAvatar(null)} />
                    ) : (
                      getInitials(user.fullName)
                    )}
                  </span>
                  <span className="hidden lg:block max-w-28 truncate text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    {getDisplayName(user.fullName)}
                  </span>
                  <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      role="menu"
                      className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 z-50"
                    >
                      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {getDisplayName(user.fullName)}
                          </p>
                          <span className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded-[4px] border shrink-0 ${getRoleBadge(user.role).color}`}>
                            {getRoleBadge(user.role).label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{user.email}</p>
                      </div>

                      <div className="py-1">
                        <Link
                          role="menuitem"
                          to={getProfileRoute(user.role)}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                          {isStoreUser ? 'Hồ sơ cửa hàng' : 'Hồ sơ của tôi'}
                        </Link>

                        {isStoreUser && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setUserMenuOpen(false);
                                setShowAirPodsModal(true);
                              }}
                              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
                            >
                              <Bluetooth className="w-3.5 h-3.5 text-sky-500" />
                              Nút Trắng Bluetooth
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                toggleSound();
                              }}
                              className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                                Chuông đơn hàng
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSoundEnabled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800'}`}>
                                {isSoundEnabled ? 'BẬT' : 'TẮT'}
                              </span>
                            </button>
                          </>
                        )}

                        <button
                          role="menuitem"
                          type="button"
                          onClick={toggleTheme}
                          className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
                        >
                          {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
                          {theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                        </button>
                      </div>

                      <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />

                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setShowLogoutModal(true);
                        }}
                        className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Đăng xuất
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="hidden sm:inline-block text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white px-2.5 py-1.5 transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                to="/quick-setup"
                className="px-4.5 py-2 text-xs font-semibold text-white bg-[#287DA8] hover:bg-[#206588] rounded-full shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
              >
                Cài đặt ngay
              </Link>

              {/* Mobile menu toggle (Guest only) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                aria-label="Toggle Navigation Menu"
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
            className="md:hidden border-t border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md px-4 py-4 overflow-hidden"
          >
            <div className="flex flex-col space-y-1">
              
              <HeaderNavigation isMobile={true} onMobileSelect={() => setMobileMenuOpen(false)} />
              <div className="pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      

      {/* Apple AirPods-Style Bluetooth Modal */}
      <WhiteDeviceAirPodsModal
        isOpen={showAirPodsModal}
        onClose={() => setShowAirPodsModal(false)}
      />

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
