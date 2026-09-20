import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Store,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserCheck,
  Building,
  Phone,
  MapPin,
  Send,
  Sparkles,
  Loader2,
  Shield,
  Zap,
  Cpu,
  Layers,
} from 'lucide-react';
import {
  PasswordStrengthMeter,
  checkPasswordCriteria,
} from '../../components/auth/PasswordStrengthMeter';
import { Floating3DCard } from '../../components/3d/Floating3DCard';

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

  // Success State Screen
  if (registrationSuccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 telemetry-grid relative">
        <div className="w-full max-w-lg bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Đăng Ký Thành Công!
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            Hệ thống đã gửi liên kết xác thực tới hòm thư:{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{registeredEmail}</strong>.
          </p>

          {role === 'STORE_OWNER' ? (
            <div className="my-5 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold mb-1 text-xs">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Xét Duyệt Trạm Đại Lý</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Yêu cầu mở trạm cho cửa hàng <strong>"{storeName}"</strong> đã được chuyển tới Super Admin.
                Sau khi kích hoạt email và nhận phê duyệt, bạn có thể bắt đầu phân phối nút bấm vật lý và quản lý kho hàng.
              </p>
            </div>
          ) : (
            <div className="my-5 p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-left text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>Hướng dẫn kích hoạt:</span>
              </div>
              <p className="text-[11px]">1. Mở email của bạn và kiểm tra thư mới (kể cả thư mục Spam/Rác).</p>
              <p className="text-[11px]">2. Nhấp vào đường dẫn xác thực tài khoản để hoàn tất.</p>
              <p className="text-[11px]">3. Đăng nhập và bắt đầu ghép nối nút bấm thông minh IoT!</p>
            </div>
          )}

          {/* Resend verification block */}
          <div className="pt-2 pb-4">
            {resendMsg && (
              <div
                className={`mb-3 p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 ${
                  resendMsg.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}
              >
                <span>{resendMsg.text}</span>
              </div>
            )}

            <button
              type="button"
              disabled={resendCooldown > 0 || resendLoading}
              onClick={handleResendVerification}
              className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline disabled:opacity-50 disabled:no-underline inline-flex items-center gap-1.5"
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
              className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all text-center flex items-center justify-center gap-1.5 btn-press"
            >
              <span>Về Trang Đăng Nhập</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/verify-email"
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all text-center flex items-center justify-center btn-press"
            >
              <span>Nhập Mã Xác Nhận</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 telemetry-grid relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-gradient-to-tr from-blue-600/10 via-cyan-500/10 to-indigo-600/5 blur-[120px] pointer-events-none rounded-full" />

      {/* 2-Column Luxury SaaS Container matching LoginPage */}
      <div className="w-full max-w-5xl bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-all">
        {/* Left Branding & Value Props Panel (Desktop/Tablet) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-[#0B1426] to-[#080D1A] p-8 sm:p-10 text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-xs font-mono font-semibold tracking-wider uppercase mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Gia Nhập Nền Tảng IoT</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
              Bắt Đầu Cùng <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Smart Order Button
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/80 mt-2.5 leading-relaxed font-normal">
              Đăng ký để triển khai hạm đội nút bấm thông minh hoặc đặt hàng nhu yếu phẩm chỉ với một lần nhấn.
            </p>

            {/* Benefit Highlights */}
            <div className="mt-8 space-y-3.5">
              {[
                {
                  title: 'Dành Cho Đại Lý & Phân Phối',
                  desc: 'Quản lý kho hàng, hạm đội nút bấm, giám sát pin và nhận đơn hàng tự động tức thời qua Socket.',
                  icon: Store,
                },
                {
                  title: 'Dành Cho Khách Hàng',
                  desc: 'Nhấn nút là có nước / gas / gạo. Tự do thay đổi Wi-Fi hoặc chuyển nhượng nút bấm nhanh chóng.',
                  icon: User,
                },
                {
                  title: 'Phần Cứng Chuẩn Công Nghiệp',
                  desc: 'ESP32 siêu tiết kiệm pin, thời lượng sử dụng vượt trội, bảo mật phần cứng chống can thiệp.',
                  icon: Cpu,
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Floating3DCard key={idx} depth={15} className="rounded-2xl">
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-lg hover:border-cyan-500/30 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-slate-200">{item.title}</h2>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </Floating3DCard>
                );
              })}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Bảo mật dữ liệu tuyệt đối</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Shield className="w-3.5 h-3.5" />
              Chuẩn Mã Hóa AES-256
            </span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-lg w-full mx-auto space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
                <span className="font-mono text-xs font-bold tracking-wider text-blue-600 dark:text-cyan-400 uppercase">
                  Đăng Ký Tài Khoản
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Tạo Hồ Sơ Mới
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Lựa chọn vai trò để thiết lập tài khoản và kết nối thiết bị
              </p>
            </div>

            {/* Role Tab Toggle - Synchronized Colors */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-white/5">
              <button
                type="button"
                onClick={() => setRole('STORE_OWNER')}
                className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  role === 'STORE_OWNER'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Chủ Cửa Hàng / Đại Lý</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className={`py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  role === 'CUSTOMER'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Khách Hàng Sử Dụng</span>
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
              {role === 'STORE_OWNER' && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên Cửa Hàng / Doanh Nghiệp <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="VD: Đại lý Nước & Gas An Phú"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Full Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                {/* Username with Realtime Check */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tên Đăng Nhập <span className="text-rose-500">*</span>
                    </label>
                    {isCheckingUsername && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
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
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm border rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-4 transition-all ${
                        usernameStatus
                          ? usernameStatus.available
                            ? 'border-emerald-400 focus:ring-emerald-500/15'
                            : 'border-rose-400 focus:ring-rose-500/15'
                          : 'border-slate-200 dark:border-slate-800 focus:ring-blue-500/15 focus:border-blue-600'
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Địa Chỉ Email <span className="text-rose-500">*</span>
                    </label>
                    {isCheckingEmail && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Kiểm tra...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@store.vn"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-4 transition-all ${
                        emailStatus
                          ? emailStatus.available
                            ? 'border-emerald-400 focus:ring-emerald-500/15'
                            : 'border-rose-400 focus:ring-rose-500/15'
                          : 'border-slate-200 dark:border-slate-800 focus:ring-blue-500/15 focus:border-blue-600'
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số Điện Thoại <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0908xxxxxx"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 font-mono transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {role === 'STORE_OWNER' ? 'Địa Chỉ Cửa Hàng / Kho Bãi' : 'Địa Chỉ Giao Hàng Mặc Định'}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mật Khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 font-mono transition-all"
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Xác Nhận Mật Khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-4 font-mono transition-all ${
                        confirmPassword
                          ? password === confirmPassword
                            ? 'border-emerald-400 focus:ring-emerald-500/15'
                            : 'border-rose-400 focus:ring-rose-500/15'
                          : 'border-slate-200 dark:border-slate-800 focus:ring-blue-500/15 focus:border-blue-600'
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

              {/* Password Strength Meter */}
              <PasswordStrengthMeter password={password} />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 btn-press"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ĐANG KHỞI TẠO TÀI KHOẢN...</span>
                  </>
                ) : (
                  <>
                    <span>HOÀN TẤT ĐĂNG KÝ THÀNH VIÊN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Đã có tài khoản hệ thống?{' '}
              <Link to="/login" className="text-blue-600 dark:text-cyan-400 font-bold hover:underline">
                Đăng nhập ngay
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
