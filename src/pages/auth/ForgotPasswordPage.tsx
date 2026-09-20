import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError('Định dạng email không hợp lệ.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email: trimmed });
      setSubmitted(true);
      setMessage(
        res.data.message ||
          'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết khôi phục mật khẩu đến hòm thư của bạn.'
      );
      if (res.data.devToken) {
        setDevResetToken(res.data.devToken);
      }
      setCooldown(60);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Có lỗi xảy ra trong quá trình gửi yêu cầu. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 telemetry-grid relative overflow-hidden">
      {/* Ambient Lighting Orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 relative z-10 transition-all">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <KeyRound className="w-7 h-7" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Khôi Phục Mật Khẩu
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Nhập địa chỉ email đăng ký để nhận mã và liên kết đặt lại mật khẩu an toàn
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Yêu cầu đã được tiếp nhận</span>
                <p className="text-[11px] leading-relaxed opacity-90">{message}</p>
              </div>
            </div>

            {/* Dev helper to quickly test reset */}
            {devResetToken && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <p className="font-bold text-[11px] mb-1">⚡ Tiện ích môi trường Dev:</p>
                <Link
                  to={`/reset-password?token=${devResetToken}`}
                  className="font-mono text-[11px] text-blue-600 dark:text-cyan-400 underline break-all"
                >
                  Bấm vào đây để đặt lại mật khẩu ngay (Token: {devResetToken.substring(0, 10)}...)
                </Link>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={handleSubmit}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-900 transition-all disabled:opacity-50"
              >
                {cooldown > 0 ? `Gửi lại yêu cầu sau (${cooldown}s)` : 'Gửi lại email'}
              </button>

              <Link
                to="/login"
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs text-center shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại trang Đăng nhập</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Địa chỉ Email đã đăng ký <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full pl-10 pr-4 py-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ĐANG GỬI LIÊN KẾT...</span>
                </>
              ) : (
                <>
                  <span>GỬI HƯỚNG DẪN KHÔI PHỤC</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Đăng nhập</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
