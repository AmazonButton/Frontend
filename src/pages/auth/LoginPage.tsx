import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import {
  Radio,
  Lock,
  Mail,
  ArrowRight,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Zap,
  Wifi,
  Battery,
  Store,
  User,
  ShieldAlert,
  Cpu,
} from 'lucide-react';

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
  const { theme } = useTheme();
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 telemetry-grid relative overflow-hidden">
      {/* Ambient Lighting Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-5xl bg-white/95 dark:bg-[#0A0A0E]/95 backdrop-blur-2xl border border-blue-100 dark:border-red-500/25 rounded-3xl shadow-2xl shadow-blue-500/10 dark:shadow-red-950/40 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-all">
        {/* Left Branding & Features Showcase (Dual-Theme: Blue-White in Light / Red-Black in Dark) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-[#180507] dark:via-[#110103] dark:to-[#080001] p-8 sm:p-10 text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-blue-500/20 dark:border-red-500/20 relative overflow-hidden transition-colors duration-500">
          {/* Subtle Ambient Highlights */}
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 dark:bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-sky-400/20 dark:bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Logo and Brand Pill */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-xl border border-white/25 dark:border-red-500/30 bg-slate-950 shrink-0">
                <img
                  src={theme === 'dark' ? '/assets/logo-red.png' : '/assets/logo.png'}
                  alt="Smart Order"
                  className="w-full h-full object-cover transition-all duration-300 dark:drop-shadow-[0_0_10px_rgba(239,68,68,0.55)]"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 dark:bg-red-500/15 border border-white/25 dark:border-red-500/30 text-white dark:text-red-300 text-[11px] font-mono font-semibold tracking-wider uppercase shadow-sm backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 dark:bg-red-400 animate-pulse" />
                  <span>Smart Order IoT SaaS</span>
                </div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-white">
              Hệ Thống Đặt Hàng <br />
              <span className="text-cyan-200 dark:text-red-400">
                Tức Thì 1 Nút Bấm
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 dark:text-zinc-300 mt-2.5 leading-relaxed font-normal">
              Kết nối nút bấm vật lý thông minh trực tiếp với kho phân phối. Nhận diện thiết bị tức thời, bảo mật mã hóa HMAC-SHA256 công nghiệp.
            </p>

            {/* Feature Highlights Cards */}
            <div className="mt-8 space-y-3.5">
              {[
                {
                  title: 'Zero-Touch Provisioning',
                  desc: 'Đổi Wi-Fi & kích hoạt thiết bị tự động không cần nhập mã PIN thủ công',
                  icon: Cpu,
                },
                {
                  title: 'Bảo Mật Cấp Công Nghiệp 3 Lớp',
                  desc: 'Ký số HMAC-SHA256 từng gói tin, Bcrypt băm mật khẩu và JWT Rotation',
                  icon: Shield,
                },
                {
                  title: 'Cửa Sổ Hủy Đơn An Toàn 60 Giây',
                  desc: 'Khách hàng an tâm nhấn nút, miễn phí hủy đơn ngay trên Web hoặc ESP32',
                  icon: Zap,
                },
                {
                  title: 'Đồng Bộ Đa Kênh Thời Gian Thực',
                  desc: 'Màn hình POS đại lý nhận đơn tức thì qua WebSocket Socket.io không độ trễ',
                  icon: Radio,
                },
              ].map((feat, idx) => {
                const IconComp = feat.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 dark:bg-red-950/20 dark:hover:bg-red-950/35 border border-white/20 dark:border-red-500/25 transition-all duration-300 flex items-start gap-3.5 group backdrop-blur-sm"
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/20 dark:bg-red-500/20 border border-white/30 dark:border-red-500/35 text-white transition-transform group-hover:scale-105">
                      <IconComp className="w-4 h-4 text-cyan-200 dark:text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 dark:group-hover:text-red-300 transition-colors">
                        {feat.title}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-blue-100/80 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-white/20 dark:border-red-500/20 flex items-center justify-between text-[11px] font-mono text-blue-100/80 dark:text-zinc-400">
            <span>Phiên bản v3.0 SaaS</span>
            <span className="flex items-center gap-1.5 text-white dark:text-red-400 font-semibold">
              <Shield className="w-3.5 h-3.5 text-cyan-300 dark:text-red-400" />
              Bảo Mật Cấp Cao
            </span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white dark:bg-[#0B0B0F]">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
                <span className="font-mono text-xs font-bold tracking-wider text-blue-600 dark:text-red-400 uppercase">
                  Authentication
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Đăng Nhập Tài Khoản
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Nhập thông tin xác thực để truy cập bảng điều khiển hệ thống
              </p>
            </div>

            {/* Quick Demo Switcher Tabs */}
            <div className="p-3 bg-blue-50/50 dark:bg-zinc-900/80 border border-blue-100 dark:border-red-500/20 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold text-blue-800 dark:text-zinc-300 uppercase flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-red-400" />
                  Chọn Nhanh Tài Khoản Demo (Pass: Password123!)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Chủ Cửa Hàng', id: 'store@smartorder.local', icon: Store },
                  { label: 'Khách Hàng', id: 'customer@smartorder.local', icon: User },
                  { label: 'Super Admin', id: 'admin@smartorder.local', icon: Shield },
                ].map((demo) => {
                  const isSelected = identifier === demo.id;
                  const Icon = demo.icon;
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => setDemoAccount(demo.id)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 truncate ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 dark:bg-red-600 dark:border-red-600 dark:shadow-red-600/30'
                          : 'bg-white dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-red-500/40 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{demo.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {/* Identifier Input */}
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5"
                >
                  Email hoặc Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    placeholder="VD: store@smartorder.local hoặc username"
                    className={`w-full pl-10 pr-4 py-3 text-xs sm:text-sm rounded-xl bg-slate-50/80 dark:bg-zinc-950/80 border text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-4 transition-all ${
                      identifierError
                        ? 'border-rose-300 focus:ring-rose-500/15 focus:border-rose-500'
                        : 'border-slate-200 dark:border-zinc-800 focus:border-blue-600 dark:focus:border-red-500 focus:ring-blue-500/15 dark:focus:ring-red-500/20 focus:bg-white dark:focus:bg-zinc-950'
                    }`}
                  />
                </div>
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
                    className="block text-xs font-bold text-slate-700 dark:text-zinc-300"
                  >
                    Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-blue-600 dark:text-red-400 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    placeholder="Nhập mật khẩu của bạn"
                    className={`w-full pl-10 pr-11 py-3 text-xs sm:text-sm rounded-xl bg-slate-50/80 dark:bg-zinc-950/80 border text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-4 transition-all ${
                      passwordError
                        ? 'border-rose-300 focus:ring-rose-500/15 focus:border-rose-500'
                        : 'border-slate-200 dark:border-zinc-800 focus:border-blue-600 dark:focus:border-red-500 focus:ring-blue-500/15 dark:focus:ring-red-500/20 focus:bg-white dark:focus:bg-zinc-950'
                    }`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1"
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
              <div className="flex items-center pt-1">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 dark:text-red-600 focus:ring-blue-500 dark:focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2.5 text-xs font-medium text-slate-600 dark:text-zinc-400 select-none cursor-pointer"
                >
                  Ghi nhớ đăng nhập trên thiết bị này (30 ngày)
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 dark:from-red-600 dark:via-red-500 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 dark:shadow-red-600/35 transition-all btn-press"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ĐANG XÁC THỰC...</span>
                  </>
                ) : (
                  <>
                    <span>ĐĂNG NHẬP VÀO HỆ THỐNG</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500 dark:text-zinc-400">
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-bold text-blue-600 dark:text-red-400 hover:underline inline-flex items-center gap-0.5 ml-1"
              >
                <span>Đăng ký thành viên ngay</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
