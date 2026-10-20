import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
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
  ArrowRight,
} from 'lucide-react';
import { FptSmartButton } from '../../components/hardware/FptSmartButton';
import {
  checkPasswordCriteria,
  getPasswordScore,
} from '../../components/auth/PasswordStrengthMeter';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SO';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const RegisterPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<'STORE_OWNER' | 'CUSTOMER'>('STORE_OWNER');
  const [registeredData, setRegisteredData] = useState<any>(null);
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
        const isAvailable = res.data.available !== undefined ? Boolean(res.data.available) : !res.data.exists;
        if (isAvailable) {
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
        const isAvailable = res.data.available !== undefined ? Boolean(res.data.available) : !res.data.exists;
        if (isAvailable) {
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
        setRegisteredData(res.data);
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

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-gradient-to-b from-[#F0F6FA] via-white to-[#F8FAFC] dark:from-[#090D14] dark:via-[#0B0F17] dark:to-[#070A0F] transition-colors selection:bg-[#287DA8] selection:text-white relative overflow-hidden">
      {/* Soft Ambient Decorative Blur Curves (matching homepage) */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-sky-100/60 dark:bg-sky-950/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-sky-100/50 dark:bg-sky-950/20 blur-3xl pointer-events-none" />

      {/* Centered Minimalist Hardware Split Card matching LoginPage */}
      <div className="w-full max-w-5xl bg-white dark:bg-[#0B0F17] rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-200/90 dark:border-zinc-800 shadow-[0_20px_50px_-12px_rgba(40,125,168,0.12)] transition-all relative z-10">

        {/* ========================================================================= */}
        {/* LEFT PANEL: HARDWARE VIBE (Exact match with LoginPage)                    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-gradient-to-br from-sky-50/70 via-slate-50/60 to-blue-50/40 dark:from-[#0d1626] dark:via-[#0b101c] dark:to-[#070b14] p-8 sm:p-10 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-zinc-800 min-h-[360px] lg:min-h-[720px] overflow-hidden">
          {/* Subtle Ambient Light Wash */}
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-sky-200/40 dark:bg-sky-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-blue-100/40 dark:bg-blue-600/10 blur-3xl pointer-events-none" />

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

          {/* Center: Hardware Button Showcase (Brand Blue Theme matching Homepage) */}
          <div className="relative z-10 my-auto py-8 flex flex-col items-center justify-center w-full">
            <FptSmartButton variant="minimal" theme="brand" brandText="Smart" />
          </div>

          {/* Bottom Left Tagline */}
          <div className="relative z-10">
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 tracking-tight">
              Smart Order Button • Instant IoT Commerce
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: CLEAN FORM / DESIGNER ONBOARDING                            */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white dark:bg-[#0B0F17]">
          {registrationSuccess ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="max-w-md w-full mx-auto space-y-6"
            >
              {/* Header Title */}
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Chào mừng, {fullName || username}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tài khoản <strong className="text-slate-800 dark:text-slate-200 font-medium">{role === 'STORE_OWNER' ? 'Chủ Cửa Hàng / Đại Lý' : 'Khách Hàng'}</strong> đã sẵn sàng hoạt động trên hệ sinh thái Smart Order IoT.
                </p>
              </div>

              {/* Designer Identity Member Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-sky-50/40 dark:from-[#0d1526] dark:via-[#090e17] dark:to-sky-950/20 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(40,125,168,0.06)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#287DA8]/5 blur-2xl pointer-events-none" />

                <div className="flex items-center gap-3.5 pb-3.5 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#287DA8] to-sky-400 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                    {getInitials(fullName || username || 'SO')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {fullName || username}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#287DA8]/10 text-[#287DA8] dark:text-sky-300 text-[10px] font-bold">
                        {role === 'STORE_OWNER' ? <Store className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {role === 'STORE_OWNER' ? 'Đại Lý Phân Phối' : 'Khách Hàng'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                      @{username} • {registeredEmail}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                      {role === 'STORE_OWNER' ? 'Tên Cửa Hàng' : 'Số Điện Thoại'}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {role === 'STORE_OWNER' ? (storeName || 'Đang cập nhật') : (phone || 'Chưa cập nhật')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                      Trạng Thái Tài Khoản
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Sẵn Sàng Hoạt Động
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const token = registeredData?.accessToken || registeredData?.token;
                    const user = registeredData?.user || registeredData?.data?.user;
                    const refreshToken = registeredData?.refreshToken;
                    if (token && user) {
                      login(token, user, refreshToken);
                      if (['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role)) {
                        navigate('/store/dashboard');
                      } else {
                        navigate('/customer/home');
                      }
                    } else {
                      navigate('/login', {
                        state: {
                          email: registeredEmail,
                          message: 'Đăng ký tài khoản thành công! Hãy nhập mật khẩu để đăng nhập.',
                        },
                      });
                    }
                  }}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#287DA8] hover:bg-[#206588] text-white font-semibold text-sm transition-all shadow-[0_4px_16px_rgba(40,125,168,0.28)] hover:shadow-[0_6px_22px_rgba(40,125,168,0.38)] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>{role === 'STORE_OWNER' ? 'Vào Bảng Quản Trị Cửa Hàng' : 'Bắt Đầu Mua Sắm & Đặt Hàng'}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/login', {
                        state: {
                          email: registeredEmail,
                          message: 'Đăng ký tài khoản thành công! Hãy nhập mật khẩu để đăng nhập.',
                        },
                      });
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors underline-offset-4 hover:underline cursor-pointer"
                  >
                    Về Trang Đăng Nhập
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
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
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/90 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 relative">
              <button
                type="button"
                onClick={() => setRole('STORE_OWNER')}
                className="relative py-2.5 px-3 text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 transition-colors outline-none select-none cursor-pointer"
              >
                {role === 'STORE_OWNER' && (
                  <motion.div
                    layoutId="active-register-role-pill"
                    className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 border border-[#287DA8]/30 dark:border-sky-500/30 shadow-[0_2px_8px_rgba(40,125,168,0.12),0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] pointer-events-none"
                    transition={{
                      type: 'spring',
                      stiffness: 240,
                      damping: 24,
                      mass: 0.7
                    }}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-2 transition-colors duration-200 ${
                  role === 'STORE_OWNER'
                    ? 'text-[#287DA8] dark:text-sky-300 font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}>
                  <Store className="w-4 h-4" />
                  <span>Chủ Cửa Hàng</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className="relative py-2.5 px-3 text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 transition-colors outline-none select-none cursor-pointer"
              >
                {role === 'CUSTOMER' && (
                  <motion.div
                    layoutId="active-register-role-pill"
                    className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 border border-[#287DA8]/30 dark:border-sky-500/30 shadow-[0_2px_8px_rgba(40,125,168,0.12),0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] pointer-events-none"
                    transition={{
                      type: 'spring',
                      stiffness: 240,
                      damping: 24,
                      mass: 0.7
                    }}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-2 transition-colors duration-200 ${
                  role === 'CUSTOMER'
                    ? 'text-[#287DA8] dark:text-sky-300 font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}>
                  <User className="w-4 h-4" />
                  <span>Khách Hàng</span>
                </span>
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

              {/* Submit CTA Button: Brand Blue #287DA8 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 mt-2 rounded-xl bg-[#287DA8] hover:bg-[#206588] text-white font-semibold text-sm transition-all shadow-[0_4px_16px_rgba(40,125,168,0.25)] hover:shadow-[0_6px_20px_rgba(40,125,168,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2 disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                className="font-bold text-[#287DA8] dark:text-sky-400 hover:text-[#206588] hover:underline ml-1 transition-colors"
              >
                Đăng nhập ngay
              </Link>
            </div>

          </div>
          )}
        </div>

      </div>
    </div>
  );
};
