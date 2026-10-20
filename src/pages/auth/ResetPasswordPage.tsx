import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Loader2,
  KeyRound,
} from 'lucide-react';
import {
  PasswordStrengthMeter,
  checkPasswordCriteria,
} from '../../components/auth/PasswordStrengthMeter';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Mã token khôi phục không được để trống.');
      return;
    }

    const criteria = checkPasswordCriteria(newPassword);
    if (!criteria.minLength || !criteria.hasLower || !criteria.hasUpper || !criteria.hasNumber) {
      setError('Mật khẩu mới chưa đáp ứng đủ tiêu chuẩn an toàn.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        token: trimmedToken,
        newPassword,
      });

      if (res.data.success) {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn hoặc không hợp lệ.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 telemetry-grid">
        <div className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Đặt Lại Mật Khẩu Thành Công!
          </h2>

          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            Mật khẩu mới của bạn đã có hiệu lực ngay lập tức. Để bảo vệ an toàn, toàn bộ phiên đăng nhập cũ trên các thiết bị khác đã được thu hồi.
          </p>

          <div className="pt-6">
            <Link
              to="/login"
              className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
            >
              <span>ĐĂNG NHẬP NGAY BẰNG MẬT KHẨU MỚI</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 telemetry-grid relative overflow-hidden">
      {/* Ambient Lighting Orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 relative z-10 transition-all">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <KeyRound className="w-7 h-7" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Thiết Lập Mật Khẩu Mới
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Vui lòng nhập mật khẩu mới đảm bảo các tiêu chuẩn bảo mật
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="space-y-1">
              <span className="font-medium">{error}</span>
              <p className="text-[11px] opacity-80">
                Nếu liên kết đã hết hạn,{' '}
                <Link to="/forgot-password" className="underline font-bold">
                  yêu cầu liên kết mới tại đây
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          {/* Token input if not provided in URL */}
          {!tokenFromUrl && (
            <div>
              <label
                htmlFor="token"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Mã Khôi Phục (Token) <span className="text-rose-500">*</span>
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Dán mã token khôi phục vào đây"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>
          )}

          {/* New Password */}
          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="w-full pl-10 pr-10 py-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className={`w-full pl-10 pr-10 py-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 transition-all ${
                  confirmPassword
                    ? newPassword === confirmPassword
                      ? 'border-emerald-400 focus:ring-emerald-500/20'
                      : 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 focus:border-blue-600 focus:ring-blue-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p
                className={`text-[10px] mt-1 font-medium ${
                  newPassword === confirmPassword
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {newPassword === confirmPassword
                  ? '✓ Mật khẩu trùng khớp'
                  : '✗ Mật khẩu xác nhận không trùng khớp'}
              </p>
            )}
          </div>

          {/* Password Strength Meter */}
          <PasswordStrengthMeter password={newPassword} />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>ĐANG CẬP NHẬT MẬT KHẨU...</span>
              </>
            ) : (
              <>
                <span>XÁC NHẬN ĐỔI MẬT KHẨU</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 text-center">
          <Link
            to="/login"
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
          >
            Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};
