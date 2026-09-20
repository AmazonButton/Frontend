import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getHomePath = () => {
    if (!user) return '/login';
    if (['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(user.role)) {
      return '/store/dashboard';
    }
    if (user.role === 'CUSTOMER') {
      return '/customer/home';
    }
    if (user.role === 'SUPER_ADMIN') {
      return '/admin/dashboard';
    }
    return '/';
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 telemetry-grid relative overflow-hidden">
      {/* Ambient Lighting Orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-rose-600/10 via-amber-500/10 to-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 text-center relative z-10 transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold text-xs mb-2">
          Lỗi Phân Quyền 403 Forbidden
        </span>

        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Truy Cập Bị Từ Chối
        </h1>

        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          Tài khoản của bạn không được cấp quyền để truy cập vào phân vùng hệ thống này.
        </p>

        {user && (
          <div className="my-5 p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs flex items-center justify-between font-mono">
            <span className="text-slate-500 dark:text-slate-400">Vai trò hiện tại:</span>
            <span className="font-bold text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
              {user.role}
            </span>
          </div>
        )}

        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to={getHomePath()}
            className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Về Trang Của Bạn</span>
          </Link>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Đổi Tài Khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
};
