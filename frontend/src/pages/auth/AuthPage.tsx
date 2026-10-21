import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  Store,
  User,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
} from 'lucide-react';
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

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { email?: string; message?: string } | undefined;
  const { login } = useAuth();

  // Mode state: 'login' | 'register'
  const currentPathMode = location.pathname === '/register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode || currentPathMode);

  // Sync mode with browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const pMode = window.location.pathname === '/register' ? 'register' : 'login';
      setMode(pMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync mode if react router location changes externally
  useEffect(() => {
    const pMode = location.pathname === '/register' ? 'register' : 'login';
    setMode(pMode);
  }, [location.pathname]);

  const switchToRegister = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMode('register');
    window.history.pushState(null, '', '/register');
  };

  const switchToLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMode('login');
    window.history.pushState(null, '', '/login');
  };

  // ==========================================
  // LOGIN FORM STATES & LOGIC
  // ==========================================
  const [identifier, setIdentifier] = useState(locationState?.email || 'store@smartorder.local');
  const [loginPassword, setLoginPassword] = useState(locationState?.email ? '' : 'Password123!');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(locationState?.message || null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

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
  const passwordError = passwordTouched ? validatePassword(loginPassword) : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentifierTouched(true);
    setPasswordTouched(true);

    const emailErr = validateEmailOrUsername(identifier);
    const passErr = validatePassword(loginPassword);
    if (emailErr || passErr) return;

    setLoginError(null);
    setSuccessNotice(null);
    setLoginLoading(true);

    try {
      const normalizedIdentifier = identifier.trim().toLowerCase();
      const res = await api.post('/auth/login', {
        email: normalizedIdentifier,
        password: loginPassword,
        rememberMe,
      });

      if (res.data?.success) {
        const token = res.data.accessToken || res.data.data?.accessToken || res.data.data?.token;
        const refreshToken = res.data.refreshToken || res.data.data?.refreshToken;
        const user = res.data.user || res.data.data?.user;

        login(token, user, refreshToken);

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
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const setDemoAccount = (demoId: string) => {
    setIdentifier(demoId);
    setLoginPassword('Password123!');
    setLoginError(null);
    setSuccessNotice(null);
    setIdentifierTouched(false);
    setPasswordTouched(false);
  };

  // ==========================================
  // REGISTER FORM STATES & LOGIC
  // ==========================================
  const [role, setRole] = useState<'STORE_OWNER' | 'CUSTOMER'>('STORE_OWNER');
  const [registeredData, setRegisteredData] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const usernameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emailTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // GOOGLE OAUTH 2.0 FLOW (Real OAuth via @react-oauth/google)
  // ==========================================
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSuccess = async (tokenResponse: any) => {
    try {
      setGoogleLoading(true);
      setGoogleError(null);

      // 1. Fetch user profile from Google using access_token
      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      });

      const { email, name, picture, sub } = userInfoRes.data;

      if (!email) {
        throw new Error('Không thể lấy thông tin email từ tài khoản Google.');
      }

      // 2. Prepare payload for Backend /api/auth/google
      const targetRole = mode === 'register' ? role : (role || 'CUSTOMER');
      const payload: any = {
        email,
        fullName: name || email.split('@')[0],
        avatarUrl: picture,
        googleId: sub,
        role: targetRole,
      };

      if (targetRole === 'STORE_OWNER') {
        payload.storeName = storeName.trim() || `Cửa Hàng ${name || email.split('@')[0]}`;
        payload.phone = phone.trim() || undefined;
        payload.address = address.trim() || undefined;
      } else {
        payload.phone = phone.trim() || undefined;
        payload.address = address.trim() || undefined;
      }

      const res = await api.post('/auth/google', payload);

      if (res.data?.success) {
        const token = res.data.accessToken || res.data.token || res.data.data?.accessToken;
        const refreshToken = res.data.refreshToken || res.data.data?.refreshToken;
        const user = res.data.user || res.data.data?.user;

        if (token && user) {
          login(token, user, refreshToken);
          toast.success(
            res.data.message ||
              (mode === 'register'
                ? 'Đăng ký tài khoản Google thành công!'
                : 'Đăng nhập Google thành công!')
          );

          if (['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role)) {
            navigate('/store/dashboard');
          } else {
            navigate('/customer/home');
          }
          return;
        }
      }

      throw new Error(res.data?.message || 'Đăng nhập với Google không thành công.');
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Không thể xác thực với Google. Vui lòng thử lại.';
      setGoogleError(errMsg);
      toast.error(errMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: (errResponse) => {
      console.error('Google Login Popup Error:', errResponse);
      const msg = 'Đăng nhập Google thất bại hoặc bạn đã đóng cửa sổ xác thực.';
      setGoogleError(msg);
      toast.error(msg);
      setGoogleLoading(false);
    },
  });

  const handleGoogleClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (
      !clientId ||
      clientId.trim() === '' ||
      clientId.includes('placeholder') ||
      clientId.includes('abcdefghijklmnopqrstuvwxyz') ||
      clientId === 'YOUR_GOOGLE_CLIENT_ID'
    ) {
      const msg =
        'Vui lòng cấu hình VITE_GOOGLE_CLIENT_ID trong file .env để kết nối Google Cloud Console.';
      setGoogleError(msg);
      toast.warning(msg, { duration: 5000 });
      return;
    }
    setGoogleLoading(true);
    setGoogleError(null);
    loginWithGoogle();
  };

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
    const trimmed = registerEmail.trim().toLowerCase();
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
  }, [registerEmail]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (usernameStatus && !usernameStatus.available) {
      setRegisterError(usernameStatus.message);
      return;
    }
    if (emailStatus && !emailStatus.available) {
      setRegisterError(emailStatus.message);
      return;
    }

    const criteria = checkPasswordCriteria(registerPassword);
    if (!criteria.minLength || !criteria.hasLower || !criteria.hasUpper || !criteria.hasNumber) {
      setRegisterError('Mật khẩu chưa đáp ứng đủ tiêu chuẩn an toàn tối thiểu.');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setRegisterLoading(true);

    try {
      const res = await api.post('/auth/register', {
        email: registerEmail.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        password: registerPassword,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        storeName: role === 'STORE_OWNER' ? storeName.trim() : undefined,
        address: address.trim(),
      });

      if (res.data.success) {
        setRegisteredEmail(registerEmail.trim().toLowerCase());
        setRegisteredData(res.data);
        setRegistrationSuccess(true);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin đã nhập.';
      setRegisterError(msg);
    } finally {
      setRegisterLoading(false);
    }
  };

  const registerCriteria = checkPasswordCriteria(registerPassword);
  const registerScore = getPasswordScore(registerCriteria);

  const inputClasses =
    'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/15 outline-none transition-all [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_#0b0f17_inset] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#ffffff]';

  return (
    <div className="relative w-full min-h-screen bg-white dark:bg-[#0B0F17] transition-colors selection:bg-[#0E6BA8] selection:text-white overflow-x-hidden">
      {/* ========================================================================= */}
      {/* DESKTOP SLIDING OVERLAY: BRAND SHOWCASE (#0F172A)                          */}
      {/* 50% WIDTH, SLIDES LEFT <-> RIGHT VIA 60FPS CUBIC-BEZIER CURVE             */}
      {/* ========================================================================= */}
      <motion.div
        initial={false}
        animate={{
          x: mode === 'login' ? '100%' : '0%',
        }}
        transition={{
          duration: 0.65,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ willChange: 'transform' }}
        className="hidden lg:flex flex-col justify-between absolute top-0 bottom-0 left-0 w-1/2 h-full z-30 bg-[#0F172A] text-white p-8 sm:p-10 lg:p-12 overflow-hidden shadow-2xl pointer-events-auto select-none"
      >
        {/* Ambient Subtle Light Washes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#0E6BA8]/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        {/* Top: Logo Smart Order Button */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 p-1 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
              <img
                src="/assets/logo.png"
                alt="Smart Order Button"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">
              Smart Order Button
            </span>
          </Link>
        </div>

        {/* Middle: Brand Headline with Fixed Line Break & 3 Value Props */}
        <div className="relative z-10 my-auto py-10 lg:py-16 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0E6BA8]/20 border border-[#0E6BA8]/40 text-[#38BDF8] text-xs font-medium">
              IoT Commerce Platform
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold leading-snug text-white tracking-tight">
              Hệ sinh thái đặt hàng
              <br />
              nhu yếu phẩm <span className="whitespace-nowrap">1-chạm.</span>
            </h2>
          </div>

          <div className="space-y-4 pt-2">
            {[
              'Kết nối trực tiếp thiết bị ESP32',
              'Tự động điều phối đơn hàng thời gian thực',
              'Dự báo chu kỳ tiêu dùng thông minh',
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                </div>
                <span className="font-normal">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Clean Sans-serif Copyright */}
        <div className="relative z-10">
          <p className="text-xs text-slate-400 tracking-normal font-normal">
            © 2026 Smart Order Button · IoT Instant Commerce
          </p>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* 50% - 50% SPLIT BASE LAYOUT (LEFT: LOGIN FORM | RIGHT: REGISTER FORM)     */}
      {/* ========================================================================= */}
      <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2 relative">
        {/* ======================================================================= */}
        {/* COLUMN 1 (LEFT 50%): LOGIN FORM                                         */}
        {/* Active when mode === 'login' (uncovered)                                */}
        {/* Covered by Navy overlay when mode === 'register'                       */}
        {/* ======================================================================= */}
        <motion.div
          initial={false}
          animate={{
            opacity: mode === 'login' ? 1 : 0,
            x: mode === 'login' ? 0 : -35,
            scale: mode === 'login' ? 1 : 0.97,
          }}
          transition={{
            duration: 0.65,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ willChange: 'transform, opacity' }}
          className={`col-start-1 col-end-2 row-start-1 row-end-2 lg:col-start-1 lg:col-end-2 lg:row-start-1 w-full min-h-screen flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 overflow-y-auto ${
            mode === 'login' ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'
          }`}
        >
          <div className="max-w-md w-full mx-auto space-y-5">
            {/* Mobile Header Branding */}
            <div className="lg:hidden flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white/10 p-1 flex items-center justify-center shrink-0">
                <img src="/assets/logo.png" alt="Smart Order" className="w-full h-full object-contain" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                Smart Order Button
              </span>
            </div>

            {/* Header: Back & Title */}
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-3 group"
                title="Quay lại trang chủ"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                <span>Quay lại trang chủ</span>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Đăng Nhập
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Đăng nhập để điều phối đơn hàng và cấu hình thiết bị nút bấm.
              </p>
            </div>

            {/* Demo Accounts: Segmented Control */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
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
                    className={`py-2 px-1 text-xs rounded-md transition-all font-medium text-center truncate cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {demo.label}
                  </button>
                );
              })}
            </div>

            {/* Success Message Alert */}
            {successNotice && !loginError && (
              <div
                role="status"
                className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">{successNotice}</span>
              </div>
            )}

            {/* Error Message Alert */}
            {loginError && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="font-medium">{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-3.5" noValidate>
              <div>
                <label
                  htmlFor="loginIdentifier"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Email hoặc Tên đăng nhập
                </label>
                <input
                  id="loginIdentifier"
                  name="loginIdentifier"
                  type="text"
                  autoComplete="username email"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setLoginError(null);
                  }}
                  onBlur={() => setIdentifierTouched(true)}
                  placeholder="VD: store@smartorder.local"
                  className={`${inputClasses} ${
                    identifierError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15' : ''
                  }`}
                />
                {identifierError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
                    {identifierError}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="loginPassword"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Mật khẩu
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#0E6BA8] hover:text-[#0B5586] dark:text-sky-400 font-medium transition-colors"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="loginPassword"
                    name="loginPassword"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError(null);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="Nhập mật khẩu"
                    className={`${inputClasses} pr-10 ${
                      passwordError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15' : ''
                    }`}
                  />
                  <button
                    type="button"
                    aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center pt-0.5">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0E6BA8] focus:ring-[#0E6BA8] cursor-pointer"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer"
                >
                  Ghi nhớ đăng nhập trên thiết bị này
                </label>
              </div>

              {/* Google Login Button (Phía trên nút Đăng Nhập) */}
              <div className="pt-2 space-y-2.5">
                <div className="relative flex items-center justify-center my-0.5">
                  <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
                  <span className="absolute bg-white dark:bg-[#0B0F17] px-3 text-[11px] text-slate-400 dark:text-slate-500">
                    hoặc tiếp tục với
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={googleLoading}
                  className="flex items-center justify-center gap-2.5 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm transition-colors cursor-pointer dark:bg-slate-900 dark:border-zinc-800 dark:text-slate-200 dark:hover:bg-slate-800 shadow-xs active:scale-[0.99] disabled:opacity-60"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#4285F4]" />
                      <span>Đang kết nối tài khoản Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Đăng nhập nhanh bằng Google</span>
                    </>
                  )}
                </button>

                {googleError && mode === 'login' && (
                  <div
                    role="alert"
                    className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{googleError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ĐANG XÁC THỰC...</span>
                  </>
                ) : (
                  <span>Đăng Nhập</span>
                )}
              </button>
            </form>

            {/* Switch to Register Button */}
            <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={switchToRegister}
                className="font-semibold text-[#0E6BA8] dark:text-sky-400 hover:text-[#0B5586] hover:underline ml-1 transition-colors cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </div>
          </div>
        </motion.div>

        {/* ======================================================================= */}
        {/* COLUMN 2 (RIGHT 50%): REGISTER FORM                                     */}
        {/* Active when mode === 'register' (uncovered)                             */}
        {/* Covered by Navy overlay when mode === 'login'                          */}
        {/* ======================================================================= */}
        <motion.div
          initial={false}
          animate={{
            opacity: mode === 'register' ? 1 : 0,
            x: mode === 'register' ? 0 : 35,
            scale: mode === 'register' ? 1 : 0.97,
          }}
          transition={{
            duration: 0.65,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ willChange: 'transform, opacity' }}
          className={`col-start-1 col-end-2 row-start-1 row-end-2 lg:col-start-2 lg:col-end-3 lg:row-start-1 w-full min-h-screen flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 overflow-y-auto ${
            mode === 'register' ? 'pointer-events-auto z-20' : 'pointer-events-none z-10'
          }`}
        >
          {registrationSuccess ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="max-w-md w-full mx-auto space-y-6"
            >
              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Chào mừng, {fullName || username}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tài khoản <strong className="text-slate-800 dark:text-slate-200 font-medium">{role === 'STORE_OWNER' ? 'Chủ Cửa Hàng / Đại Lý' : 'Khách Hàng'}</strong> đã sẵn sàng hoạt động trên hệ sinh thái Smart Order IoT.
                </p>
              </div>

              {/* Designer Identity Member Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-zinc-800 shadow-xs relative overflow-hidden">
                <div className="flex items-center gap-3.5 pb-3.5 border-b border-slate-200/70 dark:border-zinc-800">
                  <div className="w-11 h-11 rounded-xl bg-[#0E6BA8] text-white font-bold text-sm flex items-center justify-center shrink-0 tracking-wider">
                    {getInitials(fullName || username || 'SO')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {fullName || username}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0E6BA8]/10 text-[#0E6BA8] dark:text-sky-400 text-[10px] font-bold">
                        {role === 'STORE_OWNER' ? <Store className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {role === 'STORE_OWNER' ? 'Đại Lý Phân Phối' : 'Khách Hàng'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
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
                      switchToLogin();
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>{role === 'STORE_OWNER' ? 'Vào Bảng Quản Trị Cửa Hàng' : 'Bắt Đầu Mua Sắm & Đặt Hàng'}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={switchToLogin}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors underline-offset-4 hover:underline cursor-pointer"
                  >
                    Về Trang Đăng Nhập
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="max-w-md w-full mx-auto space-y-4">
              {/* Mobile Header Branding */}
              <div className="lg:hidden flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white/10 p-1 flex items-center justify-center shrink-0">
                  <img src="/assets/logo.png" alt="Smart Order" className="w-full h-full object-contain" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                  Smart Order Button
                </span>
              </div>

              {/* Header: Back Navigation & Clean Title */}
              <div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-3 group"
                  title="Quay lại trang chủ"
                >
                  <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                  <span>Quay lại trang chủ</span>
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Tạo Hồ Sơ Mới
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Hệ thống nhận diện đơn hàng thông minh qua nút bấm vật lý.
                </p>
              </div>

              {/* Role Selector: Segmented Control */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRole('STORE_OWNER')}
                  className={`py-2 px-3 text-sm rounded-md transition-all flex items-center justify-center gap-2 font-medium cursor-pointer ${
                    role === 'STORE_OWNER'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Chủ Cửa Hàng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('CUSTOMER')}
                  className={`py-2 px-3 text-sm rounded-md transition-all flex items-center justify-center gap-2 font-medium cursor-pointer ${
                    role === 'CUSTOMER'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Khách Hàng</span>
                </button>
              </div>

              {/* Error Alert */}
              {registerError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">{registerError}</span>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-3" noValidate>
                {/* Store Name for STORE_OWNER */}
                {role === 'STORE_OWNER' && (
                  <div>
                    <label htmlFor="regStoreName" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Tên Cửa Hàng / Đại Lý
                    </label>
                    <input
                      type="text"
                      id="regStoreName"
                      name="storeName"
                      autoComplete="organization"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="VD: Đại lý Nước & Gas An Phú"
                      className={inputClasses}
                    />
                  </div>
                )}

                {/* Full Name & Username */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="regFullName" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Họ và Tên
                    </label>
                    <input
                      type="text"
                      id="regFullName"
                      name="fullName"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A"
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="regUsername" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Tên Đăng Nhập
                      </label>
                      {isCheckingUsername && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Kiểm tra...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        id="regUsername"
                        name="username"
                        autoComplete="username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="VD: nguyenvana"
                        className={`${inputClasses} ${
                          usernameStatus
                            ? usernameStatus.available
                              ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/15'
                              : 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                            : ''
                        }`}
                      />
                      {usernameStatus && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
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
                        className={`text-[11px] mt-1 font-medium ${
                          usernameStatus.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
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
                      <label htmlFor="regEmail" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Địa Chỉ Email
                      </label>
                      {isCheckingEmail && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Kiểm tra...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="email"
                        id="regEmail"
                        name="email"
                        autoComplete="email"
                        required
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="VD: contact@store.vn"
                        className={`${inputClasses} ${
                          emailStatus
                            ? emailStatus.available
                              ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/15'
                              : 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                            : ''
                        }`}
                      />
                      {emailStatus && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
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
                        className={`text-[11px] mt-1 font-medium ${
                          emailStatus.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {emailStatus.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="regPhone" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Số Điện Thoại
                    </label>
                    <input
                      type="tel"
                      id="regPhone"
                      name="phone"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="VD: 0908xxxxxx"
                      className={inputClasses}
                    />
                  </div>
                </div>

                {/* Address: Street address autocomplete without blue autofill */}
                <div>
                  <label htmlFor="regAddress" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    {role === 'STORE_OWNER' ? 'Địa Chỉ Cửa Hàng / Kho Bãi' : 'Địa Chỉ Giao Hàng Mặc Định'}
                  </label>
                  <input
                    type="text"
                    id="regAddress"
                    name="address"
                    autoComplete="street-address"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="VD: 142 Nguyễn Thị Minh Khai, Quận 1, TP.HCM"
                    className={inputClasses}
                  />
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="regPassword" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Mật Khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showRegisterPassword ? 'text' : 'password'}
                        id="regPassword"
                        name="password"
                        autoComplete="new-password"
                        required
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="Tối thiểu 8 ký tự"
                        className={`${inputClasses} pr-10`}
                      />
                      <button
                        type="button"
                        aria-label={showRegisterPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="regConfirmPassword" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Xác Nhận Mật Khẩu
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="regConfirmPassword"
                        name="confirmPassword"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu"
                        className={`${inputClasses} pr-10 ${
                          confirmPassword
                            ? registerPassword === confirmPassword
                              ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/15'
                              : 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
                            : ''
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
                        className={`text-[11px] mt-1 font-medium ${
                          registerPassword === confirmPassword
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {registerPassword === confirmPassword
                          ? '✓ Mật khẩu trùng khớp'
                          : '✗ Mật khẩu xác nhận không khớp'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Strength Meter */}
                {registerPassword && (
                  <div className="space-y-1 pt-0.5">
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          registerScore <= 1
                            ? 'w-1/4 bg-slate-400'
                            : registerScore === 2
                            ? 'w-2/4 bg-amber-500'
                            : registerScore === 3
                            ? 'w-3/4 bg-emerald-500'
                            : 'w-full bg-emerald-600'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Độ an toàn:{' '}
                        <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                          {registerScore <= 1
                            ? 'Yếu'
                            : registerScore === 2
                            ? 'Trung bình'
                            : registerScore === 3
                            ? 'Mạnh'
                            : 'Rất mạnh'}
                        </strong>
                      </span>
                      <span>
                        {registerScore >= 3
                          ? '✓ Đạt chuẩn bảo mật'
                          : 'Yêu cầu tối thiểu 8 ký tự, chữ hoa, số'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Google Register Button (Phía trên nút Hoàn tất đăng ký) */}
                <div className="pt-2 space-y-2.5">
                  <div className="relative flex items-center justify-center my-0.5">
                    <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
                    <span className="absolute bg-white dark:bg-[#0B0F17] px-3 text-[11px] text-slate-400 dark:text-slate-500">
                      hoặc đăng ký nhanh
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleClick}
                    disabled={googleLoading}
                    className="flex items-center justify-center gap-2.5 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm transition-colors cursor-pointer dark:bg-slate-900 dark:border-zinc-800 dark:text-slate-200 dark:hover:bg-slate-800 shadow-xs active:scale-[0.99] disabled:opacity-60"
                  >
                    {googleLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#4285F4]" />
                        <span>Đang kết nối tài khoản Google...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Đăng ký nhanh bằng Google</span>
                      </>
                    )}
                  </button>

                  {googleError && mode === 'register' && (
                    <div
                      role="alert"
                      className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{googleError}</span>
                    </div>
                  )}
                </div>

                {/* Submit CTA Button */}
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="w-full py-2.5 px-4 mt-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white font-medium text-sm transition-all shadow-xs active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {registerLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>ĐANG KHỞI TẠO TÀI KHOẢN...</span>
                    </>
                  ) : (
                    <span>Hoàn tất đăng ký thành viên</span>
                  )}
                </button>
              </form>

              {/* Switch to Login Link */}
              <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
                Đã có tài khoản hệ thống?{' '}
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="font-semibold text-[#0E6BA8] dark:text-sky-400 hover:text-[#0B5586] hover:underline ml-1 transition-colors cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
