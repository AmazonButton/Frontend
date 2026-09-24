import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { FptSmartButton } from '../../components/hardware/FptSmartButton';

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('store@smartorder.local');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Field validation
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const validateEmailOrUsername = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return 'Vui lòng nhập email hoặc tên đăng nhập';
    if (trimmed.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) return 'Định dạng email không hợp lệ';
    } else if (trimmed.length < 3) {
      return 'Tên đăng nhập phải có ít nhất 3 ký tự';
    }
    return null;
  };

  const validatePassword = (val: string) => {
    if (!val) return 'Vui lòng nhập mật khẩu';
    if (!val.trim()) return 'Mật khẩu không được chỉ chứa khoảng trắng';
    return null;
  };

  const identifierError = identifierTouched ? validateEmailOrUsername(identifier) : null;
  const passwordError = passwordTouched ? validatePassword(password) : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentifierTouched(true);
    setPasswordTouched(true);

    const emailErr = validateEmailOrUsername(identifier);
    const passErr = validatePassword(password);
    if (emailErr || passErr) return;

    setError(null);
    setLoading(true);

    try {
      const normalizedIdentifier = identifier.trim().toLowerCase();
      const res = await api.post('/auth/login', {
        email: normalizedIdentifier,
        password,
        rememberMe,
      });

      if (res.data?.success) {
        const token = res.data.accessToken || res.data.data?.accessToken || res.data.data?.token;
        const refreshToken = res.data.refreshToken || res.data.data?.refreshToken;
        const user = res.data.user || res.data.data?.user;

        login(token, user, refreshToken);

        // Redirect based on role
        if (['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].includes(user.role)) {
          navigate('/store/dashboard');
        } else if (user.role === 'CUSTOMER') {
          navigate('/customer/home');
        } else if (user.role === 'SUPER_ADMIN') {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Email/Tên đăng nhập hoặc mật khẩu không chính xác.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (demoId: string) => {
    setIdentifier(demoId);
    setPassword('Password123!');
    setError(null);
    setIdentifierTouched(false);
    setPasswordTouched(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#FAFAFA] dark:bg-[#070A0F] transition-colors selection:bg-slate-900 selection:text-white">
      {/* Centered Minimalist Hardware Split Card */}
      <div className="w-full max-w-4xl bg-white dark:bg-[#0B0F17] rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-200/80 dark:border-slate-800 transition-all">

        {/* ========================================================================= */}
        {/* LEFT PANEL: THE HARDWARE PRODUCT VIBE (Apple / Teenage Engineering style) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 bg-slate-100 dark:bg-[#101522] p-8 sm:p-12 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 min-h-[360px] lg:min-h-[580px] overflow-hidden">
          {/* Subtle Ambient Light Wash */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/60 dark:bg-white/5 blur-3xl pointer-events-none" />

          {/* Top: Small Brand Mark */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src="/assets/logo.png"
                  alt="Smart Order"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Smart Order
              </span>
            </Link>
          </div>

          {/* Center: FPT Hardware Button Showcase */}
          <div className="relative z-10 my-auto py-8 flex flex-col items-center justify-center w-full">
            <FptSmartButton variant="minimal" />
          </div>

          {/* Bottom Left Tagline */}
          <div className="relative z-10">
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 tracking-tight">
              Smart Order Button • Instant IoT Commerce
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: MINIMALIST FORM (Pure White, stark typographic contrast)     */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 bg-white dark:bg-[#0B0F17] p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-sm w-full mx-auto space-y-6">

            {/* Header: Back Navigation & Bold Title */}
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-4 group"
                title="Quay lại trang chủ"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                <span>Quay lại trang chủ</span>
              </Link>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Đăng Nhập
              </h1>
            </div>

            {/* Demo Accounts: Minimalist Ghost Buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-100 dark:border-slate-800">
              {[
                { label: 'Chủ Cửa Hàng', id: 'store@smartorder.local' },
                { label: 'Khách Hàng', id: 'customer@smartorder.local' },
                { label: 'Super Admin', id: 'admin@smartorder.local' },
              ].map((demo) => {
                const isSelected = identifier === demo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => setDemoAccount(demo.id)}
                    className={`py-2 px-1.5 text-xs rounded-lg transition-all text-center truncate ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {demo.label}
                  </button>
                );
              })}
            </div>

            {/* Error Message Alert */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {/* Identifier Input */}
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5"
                >
                  Email hoặc Tên đăng nhập
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username email"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError(null);
                  }}
                  onBlur={() => setIdentifierTouched(true)}
                  placeholder="store@smartorder.local"
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-colors ${
                    identifierError
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-300'
                  }`}
                />
                {identifierError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
                    {identifierError}
                  </p>
                )}
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-slate-900 dark:text-slate-100"
                  >
                    Mật khẩu
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="Nhập mật khẩu"
                    className={`w-full px-3.5 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-colors ${
                      passwordError
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center pt-0.5">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer"
                >
                  Ghi nhớ đăng nhập trên thiết bị này
                </label>
              </div>

              {/* Primary Submit Button: Solid Black / Slate-900 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-all disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 shadow-xs"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>ĐANG XÁC THỰC...</span>
                  </>
                ) : (
                  <span>Đăng Nhập</span>
                )}
              </button>
            </form>

            {/* Bottom Register Link */}
            <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-semibold text-slate-900 dark:text-white hover:underline ml-1"
              >
                Đăng ký ngay
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
