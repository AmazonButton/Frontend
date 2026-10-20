import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/OrderSoundContext';
import { LogOut, Shield, ShieldAlert, Store, Smartphone, Sun, Moon, Wifi, CheckCircle2, User as UserIcon, Volume2, VolumeX, Bluetooth, Menu, X, ShoppingCart, ReceiptText, ChevronDown } from 'lucide-react';
import { WhiteDeviceAirPodsModal } from '../components/devices/WhiteDeviceAirPodsModal';
import { HeaderNavigation } from '../components/common/HeaderNavigation';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import { NotificationBellPopover } from '../components/common/NotificationBellPopover';

const MotionLink = motion(Link);

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
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerMenuRef = useRef<HTMLDivElement>(null);
  const isCustomer = user?.role === 'CUSTOMER';

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
    const closeCustomerMenu = (event: MouseEvent) => {
      if (customerMenuRef.current && !customerMenuRef.current.contains(event.target as Node)) setCustomerMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCustomerMenuOpen(false);
    };
    document.addEventListener('mousedown', closeCustomerMenu);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('mousedown', closeCustomerMenu);
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
      className={`fixed top-0 left-0 w-full z-30 transition-[background-color,border-color,box-shadow] duration-200 ease-in-out ${
        isCustomer || isScrolled
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border-b border-slate-200/80 dark:border-zinc-800'
          : 'bg-transparent border-b border-transparent backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* ================================================================= */}
        {/* LEFT: Clean Brand + Core Navigation Links                         */}
        {/* ================================================================= */}
        <div className="flex items-center gap-6 shrink-0">
          {/* Brand Logo & Name */}
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

          {/* Primary Nav Links based on login role */}
          {user && !isCustomer && (
            <nav className="hidden md:flex items-center gap-1 pl-3 border-l border-slate-200 dark:border-zinc-800">
              {user.role === 'CUSTOMER' && (
                <>
                  <Link
                    to="/customer/home"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/customer/home')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Nút Của Tôi</span>
                  </Link>
                  <MotionLink
                    to="/shop"
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/shop')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Mua Sắm</span>
                  </MotionLink>
                  <Link
                    to="/customer/orders"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/customer/orders')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    <span>Đơn Hàng Của Tôi</span>
                  </Link>
                  <Link
                    to="/customer/profile"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/customer/profile')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Hồ Sơ Của Tôi</span>
                  </Link>
                </>
              )}

              {['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(user.role) && (
                <>
                  <Link
                    to="/store/dashboard"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/store/dashboard')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Quản Lý Cửa Hàng</span>
                  </Link>
                  <Link
                    to="/store/devices"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/store/devices')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <span>Thiết Bị</span>
                  </Link>
                  <Link
                    to="/store/profile"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/store/profile')
                      ? 'bg-[#287DA8]/10 text-[#287DA8] border border-[#287DA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-[#38a5da] hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Hồ Sơ</span>
                  </Link>
                </>
              )}

              {user.role === 'SUPER_ADMIN' && (
                <>
                  <Link
                    to="/admin/dashboard"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/admin/dashboard')
                      ? 'bg-blue-50 dark:bg-sky-500/15 text-[#0E6BA8] dark:text-[#38a5da] border border-[#0E6BA8]/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Hub</span>
                  </Link>
                  <Link
                    to="/admin/security/devices"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/admin/security/devices')
                      ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/30 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Security Hub</span>
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        {isCustomer && (
          <nav aria-label="Điều hướng khách hàng" className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
            {[
              { to: '/shop', label: 'Mua sắm', icon: ShoppingCart },
              { to: '/customer/home', label: 'Nút của tôi', icon: Smartphone },
              { to: '/customer/orders', label: 'Đơn hàng', icon: ReceiptText },
            ].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${isActive(to) ? 'bg-white text-[#0E6BA8] shadow-xs dark:bg-zinc-800 dark:text-sky-400' : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        )}

        {/* ================================================================= */}
        {/* CENTER: Minimalist Navigation with Smooth Shared Layout Pill      */}
        {/* ================================================================= */}
        {!user && (
          <div className="hidden md:flex items-center justify-center">
            
            <HeaderNavigation />
          </div>
        )}

        {/* ================================================================= */}
        {/* RIGHT: Utilities, Status & User Account                           */}
        {/* ================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3">

          {isCustomer && user && (
            <div ref={customerMenuRef} className="flex items-center gap-1.5 sm:gap-2">
              <NotificationBellPopover />
              <div className="relative">
                <button type="button" onClick={() => setCustomerMenuOpen((open) => !open)} aria-expanded={customerMenuOpen} aria-haspopup="menu" aria-label="Mở menu tài khoản" className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 sm:px-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                  <span className="w-7 h-7 rounded-lg bg-[#0E6BA8] text-white flex items-center justify-center overflow-hidden text-[11px] font-bold">
                    {userAvatar ? <img src={userAvatar} alt="" className="w-full h-full object-cover" onError={() => setUserAvatar(null)} /> : getInitials(user.fullName)}
                  </span>
                  <span className="hidden lg:block max-w-28 truncate text-xs font-semibold text-slate-700 dark:text-zinc-200">{getDisplayName(user.fullName)}</span>
                  <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${customerMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {customerMenuOpen && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-zinc-800"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{getDisplayName(user.fullName)}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{user.email}</p></div>
                      <Link role="menuitem" to="/customer/profile" onClick={() => setCustomerMenuOpen(false)} className="mt-1 flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"><UserIcon className="w-3.5 h-3.5" />Hồ sơ của tôi</Link>
                      <button role="menuitem" type="button" onClick={toggleTheme} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">{theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}{theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}</button>
                      <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
                      <button role="menuitem" type="button" onClick={() => { setCustomerMenuOpen(false); setShowLogoutModal(true); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"><LogOut className="w-3.5 h-3.5" />Đăng xuất</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Internal Utilities (Only for logged in users) */}
          {user && !isCustomer && (
            <>
              {/* Bluetooth Nút Trắng (AirPods-style sleek pill) */}
              <button
                type="button"
                onClick={() => setShowAirPodsModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg transition-all group cursor-pointer whitespace-nowrap shrink-0"
                title="Ghép nối Nút Bấm Trắng qua Bluetooth (AirPods Mode)"
              >
                <Bluetooth className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="whitespace-nowrap">Nút Trắng Bluetooth</span>
              </button>

              {/* Sound Notification Toggle & Test */}
              <button
                onClick={() => {
                  if (!isSoundEnabled) {
                    toggleSound();
                  } else {
                    testSound();
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleSound();
                }}
                className={`p-2 rounded-lg transition-all relative group cursor-pointer ${isSoundEnabled
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                title={
                  isSoundEnabled
                    ? '🔔 Chuông đơn hàng: Đang BẬT (Bấm chuột trái để nghe thử, Chuột phải để Tắt)'
                    : '🔕 Chuông đơn hàng: Đang TẮT (Bấm để Bật)'
                }
                aria-label="Sound Notification"
              >
                {isSoundEnabled ? (
                  <Volume2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                {isSoundEnabled && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                )}
              </button>
            </>
          )}

          {/* Realtime Order & Cancellation Notification Bell */}
          {user && !isCustomer && <NotificationBellPopover />}

          {/* Dark/Light Mode Toggle */}
          {!isCustomer && <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>}

          {/* User Account / Auth Section */}
          {user ? (
            <div className={`${isCustomer ? 'hidden' : 'flex'} items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-zinc-800`}>
              {/* Clickable Profile Link (Avatar + Name) */}
              <Link
                to={getProfileRoute(user.role)}
                className="flex items-center gap-2.5 group cursor-pointer"
                title="Nhấn để xem và chỉnh sửa hồ sơ cá nhân"
              >
                {/* User Avatar with Image / Initials & Micro-animation */}
                <motion.div
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-sm shrink-0 ring-2 ring-transparent group-hover:ring-[#0E6BA8]/40 transition-all overflow-hidden"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={user.fullName}
                      className="w-full h-full object-cover"
                      onError={() => setUserAvatar(null)}
                    />
                  ) : (
                    getInitials(user.fullName)
                  )}
                </motion.div>

                {/* User Name & Role Info */}
                <div className="text-left hidden sm:block shrink-0">
                  <div className="leading-tight">
                    <span
                      className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[160px] block group-hover:text-[#0E6BA8] dark:group-hover:text-[#38a5da] transition-colors"
                      title={getDisplayName(user.fullName) || user.fullName}
                    >
                      {getDisplayName(user.fullName) || user.fullName}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <span className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded-[4px] border whitespace-nowrap shrink-0 inline-block ${getRoleBadge(user.role).color}`}>
                      {getRoleBadge(user.role).label}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-1 cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
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

      {isCustomer && (
        <nav aria-label="Điều hướng nhanh" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
          <div className="grid grid-cols-4 max-w-lg mx-auto">
            {[
              { to: '/shop', label: 'Mua sắm', icon: ShoppingCart },
              { to: '/customer/home', label: 'Nút của tôi', icon: Smartphone },
              { to: '/customer/orders', label: 'Đơn hàng', icon: ReceiptText },
              { to: '/customer/profile', label: 'Tài khoản', icon: UserIcon },
            ].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} aria-current={isActive(to) ? 'page' : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold transition ${isActive(to) ? 'text-[#0E6BA8]' : 'text-slate-400 dark:text-zinc-500'}`}>
                <Icon className="w-[18px] h-[18px]" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Apple AirPods-Style Bluetooth Modal */}
      <WhiteDeviceAirPodsModal
        isOpen={showAirPodsModal}
        onClose={() => setShowAirPodsModal(false)}
      />

      {/* Designer Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal && !!user}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          setShowLogoutModal(false);
          await logout();
          navigate('/login');
        }}
        user={user}
      />
    </header>
  );
};
