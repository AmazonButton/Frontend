import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Lock,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Wifi,
  Truck,
  BarChart3,
  MousePointerClick,
  Sparkles,
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
          navigate('/store/dashboard', { replace: true });
        } else if (user.role === 'CUSTOMER') {
          navigate('/customer/home', { replace: true });
        } else if (['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
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
  const [isEnteringDashboard, setIsEnteringDashboard] = useState(false);

  const usernameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emailTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // GOOGLE OAUTH 2.0 FLOW
  // ==========================================
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSuccess = async (tokenResponse: any) => {
    try {
      setGoogleLoading(true);
      setGoogleError(null);

      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      });

      const { email, name, picture } = userInfoRes.data;

      if (!email) {
        throw new Error('Không thể lấy thông tin email từ tài khoản Google.');
      }

      const targetRole = mode === 'register' ? role : (role || 'CUSTOMER');
      const requestBody: any = {
        token: (tokenResponse as any).access_token,
        fullName: name || email.split('@')[0],
        avatarUrl: picture,
        role: targetRole,
      };

      if (targetRole === 'STORE_OWNER') {
        requestBody.storeName = storeName.trim() || `Cửa Hàng ${name || email.split('@')[0]}`;
        if (phone?.trim()) requestBody.phone = phone.trim();
        if (address?.trim()) requestBody.address = address.trim();
      } else {
        if (phone?.trim()) requestBody.phone = phone.trim();
        if (address?.trim()) requestBody.address = address.trim();
      }

      const res = await api.post('/auth/google-login', requestBody);

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

          if (['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(user?.role)) {
            navigate('/admin/dashboard');
          } else if (['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role)) {
            navigate('/store/dashboard');
          } else {
            navigate('/customer/home');
          }
          return;
        }
      }

      throw new Error(res.data?.message || 'Đăng nhập với Google không thành công.');
    } catch (err: any) {
      let errMsg =
        err.response?.data?.message ||
        err.message ||
        'Không thể xác thực với Google. Vui lòng thử lại.';
      if (typeof errMsg === 'string' && (errMsg.includes('Supabase') || err.response?.status === 401)) {
        errMsg = 'Backend hiện tại yêu cầu đăng nhập trực tiếp bằng Tên đăng nhập / Email và Mật khẩu.';
      }
      setGoogleError(errMsg);
      toast.error(errMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
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
      } catch {
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
      } catch {
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

      if (res.data?.success || res.status === 201) {
        setRegisteredEmail(registerEmail.trim().toLowerCase());
        setRegisteredData(res.data);

        // Pre-fill login credentials
        setIdentifier(username.trim() || registerEmail.trim());
        setLoginPassword(registerPassword);

        // Automatically authenticate so user has an active session immediately
        try {
          const loginIdentifier = username.trim().toLowerCase() || registerEmail.trim().toLowerCase();
          const loginRes = await api.post('/auth/login', {
            email: loginIdentifier,
            password: registerPassword,
            rememberMe: true,
          });

          if (loginRes.data?.success) {
            const token = loginRes.data.accessToken || loginRes.data.data?.accessToken || loginRes.data.data?.token;
            const refreshToken = loginRes.data.refreshToken || loginRes.data.data?.refreshToken;
            const userData = loginRes.data.user || loginRes.data.data?.user || res.data?.data?.user;
            if (token && userData) {
              login(token, userData, refreshToken);
              setRegisteredData({
                ...res.data,
                accessToken: token,
                refreshToken,
                user: userData,
              });
            }
          }
        } catch {
          // If auto login fails, user can click the CTA button or use standard login
        }

        setRegistrationSuccess(true);
      } else {
        throw new Error(res.data?.message || 'Đăng ký không thành công.');
      }
    } catch (err: any) {
      let msg =
        err.response?.data?.message ||
        err.message ||
        'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin đã nhập.';
      if (typeof msg === 'string') {
        if (msg.includes('(`phone`)') || msg.includes('phone')) {
          msg = 'Số điện thoại này đã được đăng ký trong hệ thống. Vui lòng nhập số điện thoại khác.';
        } else if (msg.includes('(`email`)') || msg.includes('email')) {
          msg = 'Email này đã được đăng ký. Vui lòng sử dụng email khác.';
        } else if (msg.includes('(`username`)') || msg.includes('username')) {
          msg = 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác.';
        }
      }
      setRegisterError(msg);
      toast.error(msg);
    } finally {
      setRegisterLoading(false);
    }
  };

  const registerCriteria = checkPasswordCriteria(registerPassword);
  const registerScore = getPasswordScore(registerCriteria);

  // Common input classes styled cleanly for the card
  const cardInputClasses =
    'w-full bg-[#f8fafc]/90 border border-slate-200/90 rounded-xl py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 outline-none transition-all shadow-2xs';

  return (
    <div
      className="relative w-full min-h-screen bg-white flex flex-col justify-between selection:bg-[#0284c7] selection:text-white overflow-x-hidden"
      style={{
        backgroundImage: "url('/assets/brands/Băng rôn giao hàng xanh SmartOrder.png'), url('/assets/brands/smartorder-banner-bg.png')",
        backgroundSize: '100% auto',
        backgroundPosition: 'left bottom -40px',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Top Floating Button: Back to Home */}
      <div className="absolute top-4 sm:top-5 left-4 sm:left-6 z-20 pointer-events-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-xs font-semibold text-slate-700 hover:text-[#0284c7] border border-slate-200/80 shadow-xs backdrop-blur-md transition-all active:scale-95 group"
          title="Quay lại trang chủ"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 text-slate-500 group-hover:text-[#0284c7]" />
          <span>Quay lại trang chủ</span>
        </Link>
      </div>

      {/* Main Content Area: Left Showcase + Right Floating Card */}
      <main className="relative z-10 w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 flex-1 flex items-start">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-start">
          
          {/* ======================================================================= */}
          {/* LEFT COLUMN: BRAND HERO SHOWCASE (Upper half, clear of products)         */}
          {/* ======================================================================= */}
          <div className="lg:col-span-6 flex flex-col items-center text-center space-y-3 pt-2 sm:pt-4">
            {/* Centered Brand Logo */}
            <Link to="/" className="flex flex-col items-center group transition-transform hover:scale-105">
              <img
                src="/assets/logo.png"
                alt="SmartOrderButton"
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/logo-brand.png';
                }}
              />
              <div className="mt-1.5 text-center">
                <span className="block text-xl sm:text-2xl font-black tracking-tight text-[#0f2942]">
                  SMART<span className="text-[#0284c7]">Order</span>BUTTON
                </span>
              </div>
            </Link>

            {/* Main Headline */}
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[#0f2942] tracking-tight leading-tight">
                Hệ sinh thái đặt nhu yếu phẩm
                <span className="block text-[#0284c7] mt-0.5">thông minh</span>
              </h1>
            </div>

            {/* Sub-headline */}
            <p className="text-xs sm:text-[13px] text-slate-600 max-w-md leading-relaxed font-normal">
              Một nút bấm vật lý – Đặt đúng thứ bạn cần,<br className="hidden sm:inline" />
              từ nước uống, gas, gạo đến nhu yếu phẩm gia đình.
            </p>

            {/* 4 Feature Circular Badges Row */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 pt-1 w-full max-w-md">
              {/* Badge 1: Đặt hàng 1 chạm */}
              <div className="flex flex-col items-center group w-18 sm:w-20">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#e0f2fe] border border-[#bae6fd] text-[#0284c7] flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                  <MousePointerClick className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 text-center mt-1.5 leading-tight">
                  Đặt hàng<br />1 chạm
                </span>
              </div>

              {/* Badge 2: Theo dõi thông minh */}
              <div className="flex flex-col items-center group w-18 sm:w-20">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                  <BarChart3 className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 text-center mt-1.5 leading-tight">
                  Theo dõi<br />thông minh
                </span>
              </div>

              {/* Badge 3: Giao nhanh ổn định */}
              <div className="flex flex-col items-center group w-18 sm:w-20">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#e0f2fe] border border-[#bae6fd] text-[#0284c7] flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                  <Truck className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 text-center mt-1.5 leading-tight">
                  Giao nhanh<br />ổn định
                </span>
              </div>

              {/* Badge 4: Kết nối thiết bị IoT */}
              <div className="flex flex-col items-center group w-18 sm:w-20">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[#0d9488] flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                  <Wifi className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 text-center mt-1.5 leading-tight">
                  Kết nối<br />thiết bị IoT
                </span>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* RIGHT COLUMN: FLOATING PASTEL CARD (Login / Register)                    */}
          {/* ======================================================================= */}
          <div className="lg:col-span-6 w-full flex items-center justify-center lg:justify-start lg:pl-6 pt-1 sm:pt-2">
            <div
              className="w-full max-w-[450px] p-6 sm:p-7 lg:p-8 relative transition-all duration-300 drop-shadow-[0_20px_40px_rgba(15,23,42,0.14)]"
              style={{
                backgroundImage: "url('/assets/brands/auth-card-pastel-bg.png'), url('/assets/brands/Thẻ nền pastel xanh lam lá mờ.png')",
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <AnimatePresence mode="wait">
                {mode === 'login' ? (
                  /* ================================================================= */
                  /* 1. LOGIN MODE                                                     */
                  /* ================================================================= */
                  <motion.div
                    key="login-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3.5"
                  >
                    {/* Header */}
                    <div className="text-center space-y-1">
                      <h2 className="text-2xl sm:text-[25px] font-bold text-[#0f2942] tracking-tight">
                        Đăng nhập hệ thống
                      </h2>
                      <p className="text-xs sm:text-[13px] text-slate-500 font-normal">
                        Quản lý đơn hàng và cấu hình thiết bị SmartOrderButton.
                      </p>
                    </div>

                    {/* Subtle Demo Accounts Quick Chips */}
                    <div className="flex items-center justify-center gap-1.5 py-0.5 text-[11px] text-slate-500 font-medium">
                      <span className="text-slate-400">Tài khoản mẫu:</span>
                      {[
                        { label: 'Chủ Quán', id: 'store@smartorder.local' },
                        { label: 'Khách Hàng', id: 'customer@smartorder.local' },
                        { label: 'Admin', id: 'admin@smartorder.local' },
                      ].map((demo, idx) => (
                        <React.Fragment key={demo.id}>
                          {idx > 0 && <span className="text-slate-300">•</span>}
                          <button
                            type="button"
                            onClick={() => {
                              setIdentifier(demo.id);
                              setLoginPassword('Password123!');
                              setIdentifierTouched(false);
                              setPasswordTouched(false);
                            }}
                            className={`cursor-pointer hover:underline transition-colors ${
                              identifier === demo.id ? 'font-bold text-[#0284c7]' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {demo.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Success Notice */}
                    {successNotice && !loginError && (
                      <div
                        role="status"
                        className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 animate-in fade-in"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span className="font-medium">{successNotice}</span>
                      </div>
                    )}

                    {/* Error Notice */}
                    {loginError && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span className="font-medium">{loginError}</span>
                      </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-3.5" noValidate>
                      {/* Identifier Input with User Icon */}
                      <div>
                        <label
                          htmlFor="loginIdentifier"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Email hoặc Tên đăng nhập
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                            placeholder="Nhập email hoặc tên đăng nhập"
                            className={`${cardInputClasses} pl-10 pr-3.5 ${
                              identifierError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15' : ''
                            }`}
                          />
                        </div>
                        {identifierError && (
                          <p className="text-[11px] text-rose-600 mt-1 font-medium pl-1">
                            {identifierError}
                          </p>
                        )}
                      </div>

                      {/* Password Input with Lock Icon & Eye Toggle */}
                      <div>
                        <label
                          htmlFor="loginPassword"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Mật khẩu
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                            className={`${cardInputClasses} pl-10 pr-10 ${
                              passwordError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15' : ''
                            }`}
                          />
                          <button
                            type="button"
                            aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                          >
                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {passwordError && (
                          <p className="text-[11px] text-rose-600 mt-1 font-medium pl-1">
                            {passwordError}
                          </p>
                        )}
                      </div>

                      {/* Checkbox: Remember Me & Forgot Password */}
                      <div className="flex items-center justify-between pt-0.5">
                        <label
                          htmlFor="rememberMe"
                          className="inline-flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer"
                        >
                          <input
                            id="rememberMe"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7] cursor-pointer"
                          />
                          <span>Ghi nhớ đăng nhập</span>
                        </label>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-[#0284c7] hover:text-[#0369a1] font-medium transition-colors"
                        >
                          Quên mật khẩu?
                        </Link>
                      </div>

                      {/* Primary CTA Button: Gradient Đăng nhập ➔ */}
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#0284c7] via-[#0284c7] to-[#10b981] hover:from-[#0369a1] hover:to-[#059669] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(2,132,199,0.32)] transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-60"
                      >
                        {loginLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>ĐANG XÁC THỰC...</span>
                          </>
                        ) : (
                          <>
                            <span>Đăng nhập</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                          </>
                        )}
                      </button>

                      {/* Divider: hoặc */}
                      <div className="relative flex items-center justify-center py-1">
                        <div className="w-full border-t border-slate-200" />
                        <span className="absolute bg-[#fbfdfc] px-3 text-[11px] text-slate-400 font-medium">
                          hoặc
                        </span>
                      </div>

                      {/* Google Login Button */}
                      <div>
                        <button
                          type="button"
                          onClick={handleGoogleClick}
                          disabled={googleLoading}
                          className="flex items-center justify-center gap-2.5 w-full bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-2xs active:scale-[0.99] disabled:opacity-60"
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

                        {googleError && (
                          <div
                            role="alert"
                            className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 animate-in fade-in"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{googleError}</span>
                          </div>
                        )}
                      </div>
                    </form>

                    {/* Switch to Register */}
                    <div className="pt-2 text-center text-xs text-slate-500">
                      Chưa có tài khoản?{' '}
                      <button
                        type="button"
                        onClick={switchToRegister}
                        className="font-bold text-[#0284c7] hover:text-[#0369a1] hover:underline ml-1 cursor-pointer transition-colors"
                      >
                        Đăng ký ngay
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* ================================================================= */
                  /* 2. REGISTER MODE                                                  */
                  /* ================================================================= */
                  <motion.div
                    key="register-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {registrationSuccess ? (
                      /* Registration Success View */
                      <div className="space-y-5">
                        <div className="text-center space-y-1">
                          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7" />
                          </div>
                          <h2 className="text-2xl font-bold text-[#0f2942] tracking-tight">
                            Chào mừng, {fullName || username}!
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                            Tài khoản <strong className="text-slate-800">{role === 'STORE_OWNER' ? 'Chủ Cửa Hàng / Đại Lý' : 'Khách Hàng'}</strong> đã sẵn sàng hoạt động trên hệ sinh thái Smart Order IoT.
                          </p>
                        </div>

                        {/* Identity Card */}
                        <div className="p-4 rounded-2xl bg-white/90 border border-slate-200 shadow-xs space-y-3">
                          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                            <div className="w-10 h-10 rounded-xl bg-[#0284c7] text-white font-bold text-sm flex items-center justify-center shrink-0">
                              {getInitials(fullName || username || 'SO')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-bold text-slate-900 truncate">
                                {fullName || username}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">
                                @{username} • {registeredEmail}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                {role === 'STORE_OWNER' ? 'Cửa Hàng' : 'Số Điện Thoại'}
                              </span>
                              <span className="font-semibold text-slate-800 truncate block">
                                {role === 'STORE_OWNER' ? (storeName || 'Đang cập nhật') : (phone || 'Chưa cập nhật')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                Trạng thái
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Đã kích hoạt
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <button
                          type="button"
                          disabled={isEnteringDashboard}
                          onClick={async () => {
                            setIsEnteringDashboard(true);
                            let token = registeredData?.accessToken || registeredData?.token;
                            let user = registeredData?.user || registeredData?.data?.user;
                            let refreshToken = registeredData?.refreshToken;

                            if (!token && (username || registerEmail) && registerPassword) {
                              try {
                                const loginIdentifier = username.trim().toLowerCase() || registerEmail.trim().toLowerCase();
                                const loginRes = await api.post('/auth/login', {
                                  email: loginIdentifier,
                                  password: registerPassword,
                                  rememberMe: true,
                                });
                                if (loginRes.data?.success) {
                                  token = loginRes.data.accessToken || loginRes.data.data?.accessToken || loginRes.data.data?.token;
                                  refreshToken = loginRes.data.refreshToken || loginRes.data.data?.refreshToken;
                                  user = loginRes.data.user || loginRes.data.data?.user;
                                  if (token && user) {
                                    login(token, user, refreshToken);
                                  }
                                }
                              } catch {
                                // fallback
                              }
                            }

                            setIsEnteringDashboard(false);
                            if (token && user) {
                              login(token, user, refreshToken);
                              if (['STORE_OWNER', 'STORE_MANAGER'].includes(user?.role)) {
                                navigate('/store/dashboard', { replace: true });
                              } else {
                                navigate('/customer/home', { replace: true });
                              }
                            } else {
                              setIdentifier(username.trim() || registerEmail.trim());
                              setLoginPassword(registerPassword);
                              switchToLogin();
                            }
                          }}
                          className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#10b981] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(2,132,199,0.32)] transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                        >
                          {isEnteringDashboard ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Đang chuyển hướng...</span>
                            </>
                          ) : (
                            <>
                              <span>{role === 'STORE_OWNER' ? 'Vào Bảng Quản Trị Cửa Hàng' : 'Bắt Đầu Mua Sắm & Đặt Hàng'}</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={switchToLogin}
                            className="text-xs font-semibold text-[#0284c7] hover:underline cursor-pointer"
                          >
                            Về Trang Đăng Nhập
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Registration Form View */
                      <div className="space-y-3.5">
                        <div className="text-center space-y-1">
                          <h2 className="text-2xl font-bold text-[#0f2942] tracking-tight">
                            Tạo tài khoản mới
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-500 font-normal">
                            Đăng ký tham gia mạng lưới đặt hàng SmartOrderButton.
                          </p>
                        </div>

                        {/* Role Selector */}
                        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setRole('STORE_OWNER')}
                            className={`py-1.5 px-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 font-semibold cursor-pointer ${
                              role === 'STORE_OWNER'
                                ? 'bg-white text-[#0284c7] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>Chủ Cửa Hàng</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRole('CUSTOMER')}
                            className={`py-1.5 px-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 font-semibold cursor-pointer ${
                              role === 'CUSTOMER'
                                ? 'bg-white text-[#0284c7] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>Khách Hàng</span>
                          </button>
                        </div>

                        {/* Error Alert */}
                        {registerError && (
                          <div
                            role="alert"
                            className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span className="font-medium">{registerError}</span>
                          </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleRegister} className="space-y-3" noValidate>
                          {/* Store Name (if STORE_OWNER) */}
                          {role === 'STORE_OWNER' && (
                            <div>
                              <label htmlFor="regStoreName" className="block text-xs font-semibold text-slate-700 mb-1">
                                Tên Cửa Hàng / Đại Lý
                              </label>
                              <div className="relative">
                                <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  id="regStoreName"
                                  name="storeName"
                                  required
                                  value={storeName}
                                  onChange={(e) => setStoreName(e.target.value)}
                                  placeholder="VD: Đại lý Nước & Gas An Phú"
                                  className={`${cardInputClasses} pl-10 pr-3.5`}
                                />
                              </div>
                            </div>
                          )}

                          {/* Full Name & Username */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label htmlFor="regFullName" className="block text-xs font-semibold text-slate-700 mb-1">
                                Họ và Tên
                              </label>
                              <div className="relative">
                                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  id="regFullName"
                                  name="fullName"
                                  required
                                  value={fullName}
                                  onChange={(e) => setFullName(e.target.value)}
                                  placeholder="VD: Nguyễn Văn A"
                                  className={`${cardInputClasses} pl-10 pr-3.5`}
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label htmlFor="regUsername" className="block text-xs font-semibold text-slate-700">
                                  Tên Đăng Nhập
                                </label>
                                {isCheckingUsername && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Kiểm tra...
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  id="regUsername"
                                  name="username"
                                  required
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                                  placeholder="VD: nguyenvana"
                                  className={`${cardInputClasses} px-3.5 ${
                                    usernameStatus
                                      ? usernameStatus.available
                                        ? 'border-emerald-500 focus:border-emerald-500'
                                        : 'border-rose-400 focus:border-rose-500'
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
                                <p className={`text-[10px] mt-0.5 font-medium ${usernameStatus.available ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {usernameStatus.message}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Email & Phone */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label htmlFor="regEmail" className="block text-xs font-semibold text-slate-700">
                                  Địa Chỉ Email
                                </label>
                                {isCheckingEmail && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Kiểm tra...
                                  </span>
                                )}
                              </div>
                              <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="email"
                                  id="regEmail"
                                  name="email"
                                  required
                                  value={registerEmail}
                                  onChange={(e) => setRegisterEmail(e.target.value)}
                                  placeholder="VD: contact@store.vn"
                                  className={`${cardInputClasses} pl-10 pr-3.5 ${
                                    emailStatus
                                      ? emailStatus.available
                                        ? 'border-emerald-500 focus:border-emerald-500'
                                        : 'border-rose-400 focus:border-rose-500'
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
                                <p className={`text-[10px] mt-0.5 font-medium ${emailStatus.available ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {emailStatus.message}
                                </p>
                              )}
                            </div>

                            <div>
                              <label htmlFor="regPhone" className="block text-xs font-semibold text-slate-700 mb-1">
                                Số Điện Thoại
                              </label>
                              <div className="relative">
                                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="tel"
                                  id="regPhone"
                                  name="phone"
                                  required
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  placeholder="VD: 0908xxxxxx"
                                  className={`${cardInputClasses} pl-10 pr-3.5`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Address */}
                          <div>
                            <label htmlFor="regAddress" className="block text-xs font-semibold text-slate-700 mb-1">
                              {role === 'STORE_OWNER' ? 'Địa Chỉ Cửa Hàng / Kho Bãi' : 'Địa Chỉ Giao Hàng'}
                            </label>
                            <div className="relative">
                              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                id="regAddress"
                                name="address"
                                required
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="VD: 142 Nguyễn Thị Minh Khai, Quận 1, TP.HCM"
                                className={`${cardInputClasses} pl-10 pr-3.5`}
                              />
                            </div>
                          </div>

                          {/* Password & Confirm Password */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label htmlFor="regPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                                Mật Khẩu
                              </label>
                              <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type={showRegisterPassword ? 'text' : 'password'}
                                  id="regPassword"
                                  name="password"
                                  required
                                  value={registerPassword}
                                  onChange={(e) => setRegisterPassword(e.target.value)}
                                  placeholder="Tối thiểu 8 ký tự"
                                  className={`${cardInputClasses} pl-10 pr-9`}
                                />
                                <button
                                  type="button"
                                  aria-label={showRegisterPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                >
                                  {showRegisterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label htmlFor="regConfirmPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                                Xác Nhận Mật Khẩu
                              </label>
                              <div className="relative">
                                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  id="regConfirmPassword"
                                  name="confirmPassword"
                                  required
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  placeholder="Nhập lại mật khẩu"
                                  className={`${cardInputClasses} pl-10 pr-9 ${
                                    confirmPassword
                                      ? registerPassword === confirmPassword
                                        ? 'border-emerald-500'
                                        : 'border-rose-400'
                                      : ''
                                  }`}
                                />
                                <button
                                  type="button"
                                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiển thị mật khẩu xác nhận'}
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                >
                                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Password Strength Score */}
                          {registerPassword && (
                            <div className="space-y-1 pt-0.5">
                              <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
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
                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>
                                  Độ bảo mật:{' '}
                                  <strong className="text-slate-700">
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
                                  {registerScore >= 3 ? '✓ Đạt chuẩn' : 'Yêu cầu 8 ký tự, chữ hoa, số'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Submit CTA Button */}
                          <button
                            type="submit"
                            disabled={registerLoading}
                            className="w-full py-3 px-5 mt-1 rounded-xl bg-gradient-to-r from-[#0284c7] via-[#0284c7] to-[#10b981] hover:from-[#0369a1] hover:to-[#059669] text-white font-semibold text-sm shadow-[0_4px_16px_rgba(2,132,199,0.32)] transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-60"
                          >
                            {registerLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>ĐANG KHỞI TẠO TÀI KHOẢN...</span>
                              </>
                            ) : (
                              <>
                                <span>Hoàn tất đăng ký thành viên</span>
                                <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                              </>
                            )}
                          </button>
                        </form>

                        {/* Switch to Login */}
                        <div className="pt-1 text-center text-xs text-slate-500">
                          Đã có tài khoản?{' '}
                          <button
                            type="button"
                            onClick={switchToLogin}
                            className="font-bold text-[#0284c7] hover:text-[#0369a1] hover:underline ml-1 cursor-pointer transition-colors"
                          >
                            Đăng nhập ngay
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Bottom Line */}
      <footer className="relative z-10 w-full px-4 sm:px-8 py-3 text-center sm:flex sm:items-center sm:justify-between text-xs text-slate-500">
        <p>© 2026 Smart Order Button · IoT Instant Commerce. Nền tảng Đặt Hàng Tức Thì.</p>
        <div className="hidden sm:flex items-center gap-4 text-slate-500">
          <Link to="/" className="hover:text-slate-800 transition-colors">Trang chủ</Link>
          <a href="#privacy" className="hover:text-slate-800 transition-colors">Bảo mật</a>
          <a href="#terms" className="hover:text-slate-800 transition-colors">Điều khoản</a>
        </div>
      </footer>
    </div>
  );
};
