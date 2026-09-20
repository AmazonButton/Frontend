import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/OrderSoundContext';
import { LogOut, Shield, Store, Smartphone, Sun, Moon, Wifi, CheckCircle2, User as UserIcon, Volume2, VolumeX, Bluetooth } from 'lucide-react';
import { WhiteDeviceAirPodsModal } from '../components/devices/WhiteDeviceAirPodsModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSoundEnabled, toggleSound, testSound } = useSound();
  const navigate = useNavigate();
  const location = useLocation();

  const [showAirPodsModal, setShowAirPodsModal] = useState(false);

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
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-zinc-800 group-hover:scale-105 group-hover:shadow-md transition-all bg-zinc-950 flex items-center justify-center shrink-0">
              <img
                src={theme === 'dark' ? '/assets/logo-red.png' : '/assets/logo.png'}
                alt="Smart Order"
                className="w-full h-full object-cover transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-red-400 transition-colors">
                SMART ORDER
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                v2.0
              </span>
            </div>
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
        {/* RIGHT: Utilities, Status & User Account                           */}
        {/* ================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3">

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

          {/* Quick Wi-Fi Setup shortcut */}
          <Link
            to="/quick-setup"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
            title="Cài đặt Wi-Fi cho nút bấm"
          >
            <Wifi className="w-3.5 h-3.5 text-slate-500" />
            <span>Cài Wi-Fi</span>
          </Link>


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

          {/* Dark/Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 dark:from-red-600 dark:to-rose-600 text-white flex items-center justify-center font-mono font-bold text-xs shadow-sm shrink-0">
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
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-zinc-800">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          )}

        </div>

      </div>

      {/* Apple AirPods-Style Bluetooth Modal */}
      <WhiteDeviceAirPodsModal
        isOpen={showAirPodsModal}
        onClose={() => setShowAirPodsModal(false)}
      />
    </header>
  );
};
