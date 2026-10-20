import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  CheckCircle2,
  AlertCircle,
  MailCheck,
  ArrowRight,
  Loader2,
  Send,
  Mail,
} from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();

  // If token is provided in URL, auto-verify on load
  useEffect(() => {
    if (tokenFromUrl) {
      verifyToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const verifyToken = async (verificationToken: string) => {
    const trimmed = verificationToken.trim();
    if (!trimmed) {
      setError('Vui lòng nhập mã xác thực email.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/verify-email', { token: trimmed });
      if (res.data.success) {
        setVerified(true);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Mã xác thực không hợp lệ hoặc đã hết hiệu lực. Bạn có thể yêu cầu gửi lại email xác thực bên dưới.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyToken(token);
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resendEmail.trim().toLowerCase();
    if (!trimmed) return;

    setResendLoading(true);
    setResendSuccessMsg(null);
    setError(null);

    try {
      const res = await api.post('/auth/resend-verification', { email: trimmed });
      setResendSuccessMsg(
        res.data.message || 'Liên kết xác thực mới đã được gửi tới email của bạn.'
      );
      setResendCooldown(60);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Không thể gửi lại email xác thực vào lúc này. Vui lòng kiểm tra lại địa chỉ email.'
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 telemetry-grid relative overflow-hidden">
      {/* Ambient Lighting Orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 relative z-10 transition-all">
        {verified ? (
          <div className="text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Xác Thực Thành Công!
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Email của bạn đã được xác minh chính xác. Tài khoản hiện đã sẵn sàng để truy cập và quản lý các thiết bị IoT thông minh.
            </p>

            <div className="pt-4">
              <Link
                to="/login"
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
              >
                <span>ĐĂNG NHẬP VÀO HỆ THỐNG</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-7 h-7" />
            </div>

            <div className="text-center mb-6">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Xác Thực Địa Chỉ Email
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {tokenFromUrl
                  ? 'Đang tiến hành kiểm tra và kích hoạt tài khoản của bạn...'
                  : 'Nhập mã token xác thực đã được gửi tới email của bạn'}
              </p>
            </div>

            {loading && (
              <div className="p-8 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Đang đối chiếu dữ liệu xác thực...
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {!loading && (
              <div className="space-y-6">
                {/* Manual Token Form */}
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="token"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Mã Token Xác Thực
                    </label>
                    <input
                      id="token"
                      type="text"
                      required
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Dán chuỗi token xác thực vào đây"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                  >
                    <span>KÍCH HOẠT TÀI KHOẢN</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Resend Section */}
                <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Chưa nhận được mã hoặc token đã hết hạn?
                  </span>

                  {resendSuccessMsg && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{resendSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleResend} className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="Nhập email của bạn"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={resendLoading || resendCooldown > 0}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold shrink-0 transition-all disabled:opacity-50"
                    >
                      {resendLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : resendCooldown > 0 ? (
                        `${resendCooldown}s`
                      ) : (
                        'Gửi lại'
                      )}
                    </button>
                  </form>
                </div>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400"
                  >
                    Quay lại Đăng nhập
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
