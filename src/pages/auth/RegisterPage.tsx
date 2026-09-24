import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Store,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Send,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { FptSmartButton } from '../../components/hardware/FptSmartButton';
import {
  checkPasswordCriteria,
  getPasswordScore,
} from '../../components/auth/PasswordStrengthMeter';

export const RegisterPage: React.FC = () => {
  const [role, setRole] = useState<'STORE_OWNER' | 'CUSTOMER'>('STORE_OWNER');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Debounced Uniqueness States
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  // Submission States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Resend verification countdown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const usernameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emailTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  // Username validation & debounce check
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus(null);
      setIsCheckingUsername(false);
      return;
    }

    if (trimmed.length < 3) {
      setUsernameStatus({ available: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
      setIsCheckingUsername(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus({
        available: false,
        message: 'Chỉ cho phép chữ cái, chữ số và dấu gạch dưới (_)',
      });
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        if (res.data.available) {
          setUsernameStatus({ available: true, message: 'Tên đăng nhập khả dụng' });
        } else {
          setUsernameStatus({ available: false, message: 'Tên đăng nhập này đã được sử dụng' });
        }
      } catch (err) {
        setUsernameStatus(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [username]);

  // Email validation & debounce check
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setEmailStatus(null);
      setIsCheckingEmail(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailStatus({ available: false, message: 'Định dạng email chưa đúng' });
      setIsCheckingEmail(false);
      return;
    }

    setIsCheckingEmail(true);
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);

    emailTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-email?email=${encodeURIComponent(trimmed)}`);
        if (res.data.available) {
          setEmailStatus({ available: true, message: 'Email hợp lệ và khả dụng' });
        } else {
          setEmailStatus({ available: false, message: 'Email này đã được đăng ký tài khoản' });
        }
      } catch (err) {
        setEmailStatus(null);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500);

    return () => {
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    };
  }, [email]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resendLoading || !registeredEmail) return;
    setResendLoading(true);
    setResendMsg(null);

    try {
      const res = await api.post('/auth/resend-verification', { email: registeredEmail });
      setResendMsg({
        type: 'success',
        text: res.data.message || 'Đã gửi lại email xác thực. Vui lòng kiểm tra hòm thư!',
      });
      setResendCooldown(60);
    } catch (err: any) {
      setResendMsg({
        type: 'error',
        text: err.response?.data?.message || 'Không thể gửi lại email xác thực vào lúc này.',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (usernameStatus && !usernameStatus.available) {
      setError(usernameStatus.message);
      return;
    }
    if (emailStatus && !emailStatus.available) {
      setError(emailStatus.message);
      return;
    }

    const criteria = checkPasswordCriteria(password);
    if (!criteria.minLength || !criteria.hasLower || !criteria.hasUpper || !criteria.hasNumber) {
      setError('Mật khẩu chưa đáp ứng đủ tiêu chuẩn an toàn tối thiểu.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        storeName: role === 'STORE_OWNER' ? storeName.trim() : undefined,
        address: address.trim(),
      });

      if (res.data.success) {
        setRegisteredEmail(email.trim().toLowerCase());
        setRegistrationSuccess(true);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin đã nhập.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Password score calculation for sleek 2px meter
  const passwordCriteria = checkPasswordCriteria(password);
  const passwordScore = getPasswordScore(passwordCriteria);

  // Success State Screen
  if (registrationSuccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-[#FAFAFA] dark:bg-[#070A0F] transition-colors selection:bg-slate-900 selection:text-white">
        <div className="w-full max-w-lg bg-white dark:bg-[#0B0F17] rounded-3xl p-8 sm:p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Đăng Ký Thành Công
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Hệ thống đã gửi liên kết xác thực tới hòm thư:{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{registeredEmail}</strong>.
          </p>

          {role === 'STORE_OWNER' ? (
            <div className="my-5 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-left text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-bold mb-1 text-slate-900 dark:text-white">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Xét Duyệt Trạm Đại Lý</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Yêu cầu mở trạm cho cửa hàng <strong>"{storeName}"</strong> đã được chuyển tới Super Admin.
                Sau khi kích hoạt email và nhận phê duyệt, bạn có thể bắt đầu phân phối nút bấm vật lý và quản lý kho hàng.
              </p>
            </div>
          ) : (
            <div className="my-5 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-left text-xs space-y-1.5 text-slate-500 dark:text-slate-400">
              <div className="font-bold text-slate-900 dark:text-white mb-1.5">
                Hướng dẫn kích hoạt:
              </div>
              <p className="text-[11px]">1. Mở email của bạn và kiểm tra thư mới (kể cả thư mục Spam/Rác).</p>
              <p className="text-[11px]">2. Nhấp vào liên kết xác thực tài khoản để hoàn tất.</p>
              <p className="text-[11px]">3. Đăng nhập và bắt đầu ghép nối nút bấm thông minh IoT.</p>
            </div>
          )}

          {/* Resend verification block */}
          <div className="pt-1 pb-4">
            {resendMsg && (
              <div
                className={`mb-3 p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 ${
                  resendMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                <span>{resendMsg.text}</span>
              </div>
            )}

            <button
              type="button"
              disabled={resendCooldown > 0 || resendLoading}
              onClick={handleResendVerification}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1.5"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang gửi lại...</span>
                </>
              ) : resendCooldown > 0 ? (
                <span>Gửi lại mã xác thực sau ({resendCooldown}s)</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Chưa nhận được email? Gửi lại ngay</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link
              to="/login"
              className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs transition-colors text-center shadow-xs"
            >
              Về Trang Đăng Nhập
            </Link>
            <Link
              to="/verify-email"
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs transition-colors text-center"
            >
              Nhập Mã Xác Nhận
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#FAFAFA] dark:bg-[#070A0F] transition-colors selection:bg-slate-900 selection:text-white">
      {/* Centered Minimalist Hardware Split Card matching LoginPage */}
      <div className="w-full max-w-5xl bg-white dark:bg-[#0B0F17] rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-200/80 dark:border-slate-800 transition-all">

        {/* ========================================================================= */}
        {/* LEFT PANEL: HARDWARE VIBE (Exact match with LoginPage)                    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-slate-100 dark:bg-[#101522] p-8 sm:p-10 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 min-h-[360px] lg:min-h-[720px] overflow-hidden">
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
        {/* RIGHT PANEL: CLEAN FORM (Pure white, stark monochrome contrast)          */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white dark:bg-[#0B0F17]">
          <div className="max-w-md w-full mx-auto space-y-5">

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
                Tạo Hồ Sơ Mới
              </h1>
            </div>

            {/* Role Selector: Elegant Segmented Control */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRole('STORE_OWNER')}
                className={`py-2 px-3 text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 transition-all ${
                  role === 'STORE_OWNER'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs border border-slate-200/60 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Chủ Cửa Hàng</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className={`py-2 px-3 text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 transition-all ${
                  role === 'CUSTOMER'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs border border-slate-200/60 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Khách Hàng</span>
              </button>
            </div>

            {/* Error Alert */}
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

            <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
              {/* Store Name (for STORE_OWNER only) */}
              {role === 'STORE_OWNER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Tên Cửa Hàng / Đại Lý
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="VD: Đại lý Nước & Gas An Phú"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 transition-colors"
                  />
                </div>
              )}

              {/* Full Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Họ và Tên
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 transition-colors"
                  />
                </div>

                {/* Username with Realtime Status */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Tên Đăng Nhập
                    </label>
                    {isCheckingUsername && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Kiểm tra...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="nguyenvana"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none font-mono transition-colors ${
                        usernameStatus
                          ? usernameStatus.available
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-300'
                      }`}
                    />
                    {usernameStatus && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus.available ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {usernameStatus && (
                    <p
                      className={`text-[10px] mt-1 font-medium ${
                        usernameStatus.available
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {usernameStatus.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                      Địa Chỉ Email
                    </label>
                    {isCheckingEmail && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Kiểm tra...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@store.vn"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none font-mono transition-colors ${
                        emailStatus
                          ? emailStatus.available
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-300'
                      }`}
                    />
                    {emailStatus && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailStatus.available ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {emailStatus && (
                    <p
                      className={`text-[10px] mt-1 font-medium ${
                        emailStatus.available
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {emailStatus.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Số Điện Thoại
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0908xxxxxx"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 font-mono transition-colors"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                  {role === 'STORE_OWNER' ? 'Địa Chỉ Cửa Hàng / Kho Bãi' : 'Địa Chỉ Giao Hàng Mặc Định'}
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 transition-colors"
                />
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Mật Khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      className="w-full px-3.5 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 font-mono transition-colors"
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
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Xác Nhận Mật Khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className={`w-full px-3.5 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none font-mono transition-colors ${
                        confirmPassword
                          ? password === confirmPassword
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-300'
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiển thị mật khẩu xác nhận'}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p
                      className={`text-[10px] mt-1 font-medium ${
                        password === confirmPassword
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {password === confirmPassword
                        ? '✓ Mật khẩu trùng khớp'
                        : '✗ Mật khẩu xác nhận không khớp'}
                    </p>
                  )}
                </div>
              </div>

              {/* Minimalist 2px Password Strength Meter */}
              {password && (
                <div className="space-y-1 pt-0.5">
                  <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        passwordScore <= 1
                          ? 'w-1/4 bg-slate-400'
                          : passwordScore === 2
                          ? 'w-2/4 bg-amber-500'
                          : passwordScore === 3
                          ? 'w-3/4 bg-emerald-500'
                          : 'w-full bg-emerald-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>
                      Độ an toàn:{' '}
                      <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                        {passwordScore <= 1
                          ? 'Yếu'
                          : passwordScore === 2
                          ? 'Trung bình'
                          : passwordScore === 3
                          ? 'Mạnh'
                          : 'Rất mạnh'}
                      </strong>
                    </span>
                    <span>
                      {passwordScore >= 3
                        ? '✓ Đạt tiêu chuẩn bảo mật'
                        : 'Yêu cầu tối thiểu 8 ký tự, chữ hoa, số'}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit CTA Button: Solid Black / Slate-900 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-all disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 shadow-xs"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>ĐANG KHỞI TẠO TÀI KHOẢN...</span>
                  </>
                ) : (
                  <span>Hoàn tất đăng ký thành viên</span>
                )}
              </button>
            </form>

            {/* Bottom Login Link */}
            <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
              Đã có tài khoản hệ thống?{' '}
              <Link
                to="/login"
                className="font-semibold text-slate-900 dark:text-white hover:underline ml-1"
              >
                Đăng nhập ngay
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
