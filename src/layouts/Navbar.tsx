import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/OrderSoundContext';
import { LogOut, Shield, Store, Smartphone, Sun, Moon, Wifi, CheckCircle2, User as UserIcon, Volume2, VolumeX, Bluetooth, Menu, X } from 'lucide-react';
import { WhiteDeviceAirPodsModal } from '../components/devices/WhiteDeviceAirPodsModal';
import { HeaderNavigation } from '../components/common/HeaderNavigation';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSoundEnabled, toggleSound, testSound } = useSound();
  const navigate = useNavigate();
  const location = useLocation();

  const [showAirPodsModal, setShowAirPodsModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Admin Hub', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'STORE_OWNER':
        return { label: 'Chủ Cửa Hàng', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
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

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-zinc-800 transition-colors">
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
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Smart Order Button
            </span>
          </Link>

          {/* Primary Nav Links based on login role */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 pl-3 border-l border-slate-200 dark:border-zinc-800">
              {user.role === 'CUSTOMER' && (
                <Link
                  to="/customer/home"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/customer/home')
                      ? 'bg-blue-50 dark:bg-red-500/15 text-blue-600 dark:text-red-400 border border-blue-200/80 dark:border-red-500/30'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                    }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Nút Của Tôi</span>
                </Link>
              )}

              {['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(user.role) && (
                <>
                  <Link
                    to="/store/dashboard"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/store/dashboard')
                        ? 'bg-blue-50 dark:bg-red-500/15 text-blue-600 dark:text-red-400 border border-blue-200/80 dark:border-red-500/30'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Quản Lý Cửa Hàng</span>
                  </Link>
                  <Link
                    to="/store/devices"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/store/devices')
                        ? 'bg-blue-50 dark:bg-red-500/15 text-blue-600 dark:text-red-400 border border-blue-200/80 dark:border-red-500/30'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                      }`}
                  >
                    <span>Thiết Bị</span>
                  </Link>
                </>
              )}

              {user.role === 'SUPER_ADMIN' && (
                <Link
                  to="/admin/dashboard"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isActive('/admin/dashboard')
                      ? 'bg-blue-50 dark:bg-red-500/15 text-blue-600 dark:text-red-400 border border-blue-200/80 dark:border-red-500/30'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                    }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Hub</span>
                </Link>
              )}
            </nav>
          )}
        </div>

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

          {/* Internal Utilities (Only for logged in users) */}
          {user && (
            <>
              {/* Bluetooth Nút Trắng (AirPods-style sleek pill) */}
              <button
                type="button"
                onClick={() => setShowAirPodsModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full transition-all group"
                title="Ghép nối Nút Bấm Trắng qua Bluetooth (AirPods Mode)"
              >
                <Bluetooth className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Nút Trắng Bluetooth</span>
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
                className={`p-2 rounded-lg transition-all relative group ${isSoundEnabled
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

          {/* Dark/Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* User Account / Auth Section */}
          {user ? (
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-zinc-800">
              {/* User Avatar with Initials */}
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs shadow-sm shrink-0">
                {getInitials(user.fullName)}
              </div>

              {/* User Name & Role Info */}
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                    {user.fullName}
                  </span>
                  {user.emailVerified && (
                    <span title="Email đã xác thực">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${getRoleBadge(user.role).color}`}>
                    {getRoleBadge(user.role).label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    @{user.username || 'user'}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-1"
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
                className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 rounded-xl shadow-sm transition-all active:scale-[0.98]"
              >
                Cài Wi-Fi Nút Bấm
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
    </header>
  );
};
