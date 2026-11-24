import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, CheckCircle2, AlertCircle, X, Loader2, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { exchangePhoneCredential, normalizePhoneNumber } from '../../services/phone-auth-flow';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
  onSuccess?: (verifiedPhone: string) => void;
}

export const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({
  isOpen,
  onClose,
  initialPhone = '',
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState(initialPhone || user?.phone || '');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'phone' | 'code' | 'complete'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const lock = useRef(false);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const credentialToken = useRef('');
  const alive = useRef(true);

  // Check if Firebase is configured in frontend environment
  const isFirebaseConfigured = Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID
  );

  useBodyScrollLock(isOpen);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      try {
        verifier.current?.clear();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPhone(initialPhone || user?.phone || '');
      setOtp('');
      setStage('phone');
      setError('');
      setNotice('');
    }
  }, [isOpen, initialPhone, user?.phone]);

  useEffect(() => {
    if (!cooldown) return;
    const id = window.setTimeout(() => setCooldown(v => v - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !busy) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, onClose]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current || cooldown > 0) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const normalized = normalizePhoneNumber(phone);

      // Real Firebase Phone Auth
      const [sdk, firebase] = await Promise.all([
        import('firebase/auth'),
        import('../../services/firebase-web'),
      ]);
      if (!alive.current) return;
      const auth = sdk.getAuth(firebase.getWebFirebaseApp());
      auth.languageCode = 'vi';
      await sdk.setPersistence(auth, sdk.inMemoryPersistence);

      try {
        verifier.current?.clear();
      } catch {}
      verifier.current = new sdk.RecaptchaVerifier(auth, 'phone-modal-recaptcha', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setError('Phiên bảo mật reCAPTCHA đã hết hạn. Vui lòng thử lại.');
        },
      });

      confirmation.current = await sdk.signInWithPhoneNumber(auth, normalized, verifier.current);

      if (alive.current) {
        credentialToken.current = '';
        setPhone(normalized);
        setOtp('');
        setStage('code');
        setCooldown(60);
        setNotice(`Mã xác thực SMS 6 chữ số đã được gửi tới số điện thoại ${normalized}. Vui lòng kiểm tra tin nhắn.`);
      }
    } catch (err: any) {
      if (alive.current) {
        setError(parsePhoneError(err));
      }
      try {
        verifier.current?.clear();
      } catch {}
      verifier.current = null;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (!confirmation.current) {
      setError('Phiên xác thực chưa sẵn sàng. Vui lòng nhấn gửi lại mã.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (!/^\d{6}$/.test(otp)) {
        throw new Error('Vui lòng nhập đủ 6 chữ số mã xác nhận từ tin nhắn SMS.');
      }

      // 1. Verify real OTP code with Firebase
      const result = await confirmation.current.confirm(otp);
      credentialToken.current = await result.user.getIdToken();

      if (!alive.current) return;

      // 2. Exchange token with backend: POST /api/v1/auth/phone/verify
      await exchangePhoneCredential(api, 'verify', credentialToken.current);

      // 3. Clean up Firebase session
      try {
        const sdk = await import('firebase/auth');
        const firebase = await import('../../services/firebase-web');
        await sdk.signOut(sdk.getAuth(firebase.getWebFirebaseApp()));
      } catch {}

      if (!alive.current) return;

      // 4. Refresh user in AuthContext to update phoneVerified status
      try {
        await refreshUser();
      } catch {}

      setStage('complete');
      setNotice(`Số điện thoại ${phone} đã được xác minh thành công!`);
      if (onSuccess) {
        onSuccess(phone);
      }
    } catch (err: any) {
      if (alive.current) {
        setError(parsePhoneError(err));
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const resetForm = () => {
    if (busy) return;
    try {
      verifier.current?.clear();
    } catch {}
    verifier.current = null;
    confirmation.current = null;
    credentialToken.current = '';
    setStage('phone');
    setError('');
    setNotice('');
    setOtp('');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overscroll-contain overflow-y-auto">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
            onClick={() => !busy && onClose()}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/80 dark:border-zinc-800"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Đóng popup"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Icon & Title */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-[#0E6BA8] dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs border border-sky-100 dark:border-sky-900/50">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Xác minh số điện thoại
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {stage === 'complete'
                    ? 'Hoàn tất xác thực tài khoản'
                    : stage === 'code'
                    ? 'Nhập mã OTP đã gửi qua tin nhắn'
                    : 'Bảo mật và liên kết số điện thoại tài khoản'}
                </p>
              </div>
            </div>

            {/* Error & Info Feedback */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs leading-relaxed animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{error}</span>
              </div>
            )}

            {notice && stage !== 'complete' && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-sky-800 dark:text-sky-300 text-xs leading-relaxed animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#0E6BA8] dark:text-sky-400 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{notice}</span>
              </div>
            )}

            {/* Hidden Recaptcha container */}
            <div id="phone-modal-recaptcha" />

            {/* STAGE 1: ENTER PHONE NUMBER */}
            {stage === 'phone' && (
              <form onSubmit={sendCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Số điện thoại của bạn <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Ví dụ: 0912345678"
                      required
                      disabled={busy}
                      autoFocus
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0E6BA8] focus:border-transparent transition-all"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    Hệ thống sẽ gửi mã xác thực SMS 6 chữ số tới số điện thoại này.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={busy || !phone.trim() || cooldown > 0}
                    className="px-5 py-2.5 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang gửi mã...</span>
                      </>
                    ) : cooldown > 0 ? (
                      <span>Gửi lại sau ({cooldown}s)</span>
                    ) : (
                      <>
                        <span>Nhận mã OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STAGE 2: ENTER OTP CODE */}
            {stage === 'code' && (
              <form onSubmit={confirmCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 text-center">
                    Nhập mã 6 chữ số
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="------"
                    autoFocus
                    required
                    disabled={busy}
                    className="w-full text-center text-2xl font-mono font-bold tracking-[0.35em] py-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0E6BA8] focus:border-transparent transition-all"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-zinc-400">
                      Gửi tới: <strong className="text-slate-800 dark:text-zinc-200">{phone}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={busy}
                      className="text-[#0E6BA8] hover:underline font-semibold cursor-pointer"
                    >
                      Đổi số điện thoại
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={busy || otp.length !== 6}
                    className="w-full py-2.5 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xác minh...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Xác nhận & Hoàn tất</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={busy || cooldown > 0}
                    className="w-full py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-center"
                  >
                    {cooldown > 0 ? (
                      `Chưa nhận được mã? Gửi lại sau (${cooldown}s)`
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#0E6BA8] font-semibold">
                        <RefreshCw className="w-3.5 h-3.5" /> Gửi lại mã OTP
                      </span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STAGE 3: COMPLETE / SUCCESS */}
            {stage === 'complete' && (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center animate-in zoom-in-75 duration-300">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Xác minh số điện thoại thành công!
                  </h4>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
                    Số điện thoại <strong className="text-slate-800 dark:text-zinc-200">{phone}</strong> đã được xác nhận và liên kết an toàn vào tài khoản của bạn.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            )}

            {/* Security note */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
              <ShieldCheck className="w-4 h-4 shrink-0 text-slate-400" />
              <span>Mã chỉ dùng một lần để bảo vệ tài khoản. Tuyệt đối không chia sẻ cho bất kỳ ai.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

function parsePhoneError(error: any) {
  const code = error?.code || error?.response?.data?.code;
  const backendMsg = error?.response?.data?.message;

  if (backendMsg) {
    if (typeof backendMsg === 'string') return backendMsg;
    if (Array.isArray(backendMsg)) return backendMsg.join(', ');
  }

  if (code === 'auth/invalid-verification-code') {
    return 'Mã xác nhận chưa chính xác. Vui lòng kiểm tra lại tin nhắn SMS trên điện thoại của bạn.';
  }
  if (
    code?.includes('BILLING_NOT_ENABLED') ||
    backendMsg?.includes('BILLING_NOT_ENABLED') ||
    error?.message?.includes('BILLING_NOT_ENABLED')
  ) {
    return 'Dự án Firebase chưa bật gói thanh toán Blaze (Cloud Billing) để gửi tin nhắn SMS thật qua nhà mạng viễn thông. Vui lòng nâng cấp gói Blaze trên Firebase Console hoặc sử dụng số đã khai báo trong cấu hình dự án.';
  }
  if (code === 'auth/code-expired' || code === 'auth/session-expired') {
    return 'Mã xác minh đã hết hạn. Vui lòng nhấn "Gửi lại mã OTP" để nhận mã mới.';
  }
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
    return 'Đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng đợi vài phút rồi thử lại.';
  }
  if (code === 'auth/invalid-phone-number') {
    return 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam đúng định dạng (VD: 0912345678).';
  }
  if (code === 'auth/missing-phone-number') {
    return 'Vui lòng nhập số điện thoại để nhận mã xác minh.';
  }
  if (code === 'auth/captcha-check-failed') {
    return 'Kiểm tra bảo mật reCAPTCHA không thành công. Vui lòng thử lại.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Tên miền chưa được cấp quyền gửi SMS Firebase. Vui lòng liên hệ quản trị viên.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền Internet của bạn.';
  }

  return error?.message || 'Không thể gửi mã xác nhận. Vui lòng kiểm tra lại số điện thoại.';
}

