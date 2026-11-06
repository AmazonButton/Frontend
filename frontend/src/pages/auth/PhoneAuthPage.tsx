import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { exchangePhoneCredential, normalizePhoneNumber, roleHome } from '../../services/phone-auth-flow';
import { PageBackButton } from '../../components/common/PageBackButton';
import { WorkflowNotice, WorkflowReveal, workflowButton, workflowInput, workflowSecondary } from '../../components/operations/WorkflowUI';
import { workflowError } from '../../utils/workflow';

export const PhoneAuthPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'verify' ? 'verify' : params.get('mode') === 'register' ? 'register' : 'login';
  const { user, login, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(mode === 'verify' ? user?.phone || '' : '');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'phone' | 'code' | 'complete'>('phone');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const credentialToken = useRef('');
  const alive = useRef(true);
  const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID);
  useEffect(() => { alive.current = true; return () => { alive.current = false; verifier.current?.clear(); }; }, []);
  useEffect(() => { if (!cooldown) return; const id = window.setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(id); }, [cooldown]);
  useEffect(() => { if (mode === 'verify' && !user) navigate('/login', { replace: true }); }, [mode, user, navigate]);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || cooldown || !configured) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const normalized = normalizePhoneNumber(phone);
      if (mode === 'register' && (fullName.trim().length < 2 || fullName.trim().length > 100)) throw new Error('Nhập họ tên từ 2 đến 100 ký tự trước khi nhận mã.');
      const [sdk, firebase] = await Promise.all([import('firebase/auth'), import('../../services/firebase-web')]);
      if (!alive.current) return;
      const auth = sdk.getAuth(firebase.getWebFirebaseApp());
      auth.languageCode = 'vi';
      await sdk.setPersistence(auth, sdk.inMemoryPersistence);
      verifier.current?.clear();
      verifier.current = new sdk.RecaptchaVerifier(auth, 'phone-recaptcha', { size: 'invisible' });
      confirmation.current = await sdk.signInWithPhoneNumber(auth, normalized, verifier.current);
      if (alive.current) { credentialToken.current = ''; setPhone(normalized); setOtp(''); setStage('code'); setCooldown(60); setNotice(`Mã xác nhận đã được gửi tới ${normalized}.`); }
    } catch (err) { if (alive.current) setError(phoneError(err)); verifier.current?.clear(); verifier.current = null; }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !confirmation.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (!credentialToken.current) {
        if (!/^\d{6}$/.test(otp)) throw new Error('Nhập đủ 6 chữ số trong tin nhắn.');
        const result = await confirmation.current.confirm(otp);
        credentialToken.current = await result.user.getIdToken();
      }
      if (!alive.current) return;
      const result = await exchangePhoneCredential(api, mode, credentialToken.current, { fullName, email });
      if (!alive.current) return;
      if (mode === 'verify') { await refreshUser(); setStage('complete'); setNotice('Số điện thoại đã được xác minh và lưu vào tài khoản.'); }
      else if (result.token && result.user) { login(result.token, result.user, result.refreshToken); navigate(roleHome(result.user.role), { replace: true }); }
      const sdk = await import('firebase/auth');
      const firebase = await import('../../services/firebase-web');
      await sdk.signOut(sdk.getAuth(firebase.getWebFirebaseApp()));
      credentialToken.current = '';
    } catch (err) { if (alive.current) setError(phoneError(err)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const reset = () => { if (busy) return; verifier.current?.clear(); verifier.current = null; confirmation.current = null; credentialToken.current = ''; setStage('phone'); setError(''); setNotice(''); setOtp(''); };
  return <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12"><PageBackButton fallbackTo={mode === 'verify' ? '/profile' : '/login'} /><WorkflowReveal className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-[#287DA8] dark:bg-sky-950"><Phone className="h-5 w-5" /></div>
    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{mode === 'verify' ? 'Xác minh số điện thoại' : mode === 'register' ? 'Tạo tài khoản bằng điện thoại' : 'Đăng nhập bằng điện thoại'}</h1>
    <p className="mt-2 text-sm leading-relaxed text-zinc-500">{mode === 'verify' ? 'Nhận mã qua tin nhắn để xác nhận số điện thoại của bạn.' : 'Dùng mã xác nhận được gửi qua tin nhắn. Không cần nhập mật khẩu.'}</p>
    <div className="mt-5 space-y-4"><WorkflowNotice tone="error">{error}</WorkflowNotice><WorkflowNotice tone={stage === 'complete' ? 'success' : 'info'}>{notice}</WorkflowNotice>
    {!configured && <WorkflowNotice>Đăng nhập bằng điện thoại chưa được bật. Bạn có thể tiếp tục sử dụng email và mật khẩu.</WorkflowNotice>}
    {stage === 'complete' ? <Link to="/profile" className={workflowButton}>Về tài khoản <ArrowRight className="h-4 w-4" /></Link> : <form onSubmit={stage === 'code' ? confirmCode : sendCode} className="space-y-4">
      {mode === 'register' && stage === 'phone' && <><label className="block space-y-1.5 text-sm font-medium">Họ và tên<input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" minLength={2} maxLength={100} required disabled={busy} className={workflowInput} /></label><label className="block space-y-1.5 text-sm font-medium">Email liên hệ <span className="font-normal text-zinc-500">(không bắt buộc)</span><input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={255} disabled={busy} className={workflowInput} /></label></>}
      <label className="block space-y-1.5 text-sm font-medium">Số điện thoại<input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912 345 678" disabled={busy || stage === 'code'} required className={workflowInput} /></label>
      {stage === 'code' && <label className="block space-y-1.5 text-sm font-medium">Mã xác nhận<input autoFocus inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} pattern="[0-9]{6}" required={!credentialToken.current} disabled={busy} className={`${workflowInput} text-center text-xl tracking-[0.3em]`} /><span className="block text-xs font-normal text-zinc-500">Nếu chưa nhận được mã, kiểm tra số điện thoại rồi gửi lại.</span></label>}
      <div id="phone-recaptcha" />
      <button disabled={busy || !configured || (stage === 'phone' && cooldown > 0)} className={`${workflowButton} w-full`}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? 'Đang xử lý...' : stage === 'code' ? (mode === 'verify' ? 'Xác minh số điện thoại' : 'Xác nhận và tiếp tục') : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Nhận mã xác nhận'}<ArrowRight className="h-4 w-4" /></button>
      {stage === 'code' && <button type="button" disabled={busy} onClick={reset} className={`${workflowSecondary} w-full`}>Đổi số điện thoại / gửi lại mã{cooldown > 0 ? ` (${cooldown}s)` : ''}</button>}
    </form>}
    {mode !== 'verify' && <p className="text-center text-sm text-zinc-500">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button disabled={busy} type="button" onClick={() => { reset(); setParams({ mode: mode === 'login' ? 'register' : 'login' }); }} className="min-h-11 font-semibold text-[#287DA8] underline-offset-4 hover:underline">{mode === 'login' ? 'Đăng ký khách hàng' : 'Đăng nhập'}</button></p>}
    <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500"><ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />Mã chỉ dùng để xác nhận số của bạn. Không chia sẻ mã với người khác.</p>
    </div></WorkflowReveal></main>;
};

function phoneError(error: any) {
  const code = error?.code;
  if (code === 'auth/invalid-verification-code') return 'Mã xác nhận chưa đúng. Vui lòng kiểm tra lại tin nhắn.';
  if (['auth/code-expired', 'auth/session-expired'].includes(code)) return 'Mã đã hết hạn. Vui lòng gửi lại mã.';
  if (['auth/too-many-requests', 'auth/quota-exceeded'].includes(code)) return 'Đã gửi nhiều yêu cầu. Vui lòng thử lại sau.';
  if (['auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/invalid-app-credential'].includes(code)) return 'Đăng nhập bằng điện thoại hiện chưa sẵn sàng. Vui lòng sử dụng email hoặc thử lại sau.';
  return workflowError(error, 'Chưa gửi được mã. Vui lòng kiểm tra kết nối và thử lại.');
}
