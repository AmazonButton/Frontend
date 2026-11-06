import React, { useEffect, useRef, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { assertPushSession, capturePushSession, currentPushUserId, isPushSessionCurrent, PUSH_SESSION_EVENT, PUSH_SETTINGS_EVENT, readPushToken } from '../../services/web-push-state';
import { WorkflowNotice, WorkflowReveal, workflowButton, workflowSecondary } from './WorkflowUI';
import { workflowError } from '../../utils/workflow';

export const PushNotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const operation = useRef(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID && import.meta.env.VITE_FIREBASE_VAPID_KEY);
  const supported = typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;
  useEffect(() => {
    mounted.current = true;
    const sync = () => { setRegistered(Boolean(user?.id && currentPushUserId() === user.id && readPushToken(user.id) && supported && Notification.permission === 'granted')); };
    const sessionChanged = () => { operation.current++; lock.current = false; setBusy(false); setError(''); setMessage(''); sync(); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === 'smart_order_push_session' || (event.key === 'smart_order_user' && currentPushUserId() !== user?.id) || (event.key === 'smart_order_token' && !event.newValue)) sessionChanged();
      else sync();
    };
    sync(); setError(''); setMessage('');
    window.addEventListener('storage', storageChanged); window.addEventListener(PUSH_SESSION_EVENT, sessionChanged); window.addEventListener(PUSH_SETTINGS_EVENT, sync); window.addEventListener('focus', sync);
    return () => { mounted.current = false; operation.current++; window.removeEventListener('storage', storageChanged); window.removeEventListener(PUSH_SESSION_EVENT, sessionChanged); window.removeEventListener(PUSH_SETTINGS_EVENT, sync); window.removeEventListener('focus', sync); };
  }, [user?.id, supported]);
  const change = async (enable: boolean) => {
    if (!user || lock.current) return;
    const activeOperation = ++operation.current;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    let session: ReturnType<typeof capturePushSession> | undefined;
    const current = () => mounted.current && activeOperation === operation.current && Boolean(session && isPushSessionCurrent(session));
    try {
      session = capturePushSession(user.id);
      if (enable) {
        // Ask on the explicit click, before loading the SDK, for mobile browsers.
        const permission = await Notification.requestPermission();
        if (!current()) return;
        if (permission !== 'granted') throw new Error('Trình duyệt chưa cho phép thông báo. Bạn có thể thay đổi quyền trong cài đặt trang web.');
      }
      const sdk = await import('../../services/firebase-push');
      if (!current()) return;
      assertPushSession(session);
      if (enable) await sdk.enableFirebasePush(user.id, session); else await sdk.disableFirebasePush(user.id, session);
      if (!current()) return;
      setRegistered(enable); setMessage(enable ? 'Đã đăng ký nhận thông báo trên thiết bị này.' : 'Đã tắt đăng ký thông báo trên thiết bị này.');
    } catch (err) { if (mounted.current && activeOperation === operation.current) setError(workflowError(err)); }
    finally { if (mounted.current && activeOperation === operation.current) { lock.current = false; setBusy(false); } }
  };
  return <WorkflowReveal className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start gap-3"><BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[#287DA8]" /><div><h3 className="text-sm font-bold">Thông báo trên thiết bị này</h3><p className="mt-1 text-xs leading-relaxed text-zinc-500">Nhận tin nhắn từ hệ thống khi bạn đang chuyển sang tab khác. Đăng ký được lưu riêng cho tài khoản của bạn.</p></div></div>
    <WorkflowNotice tone="error">{error}</WorkflowNotice><WorkflowNotice tone="success">{message}</WorkflowNotice>
    {!configured ? <p className="text-xs text-zinc-500">Thông báo đẩy chưa được bật cho hệ thống. Thông báo trong trang vẫn hoạt động.</p> : !supported ? <p className="text-xs text-zinc-500">Trình duyệt này chưa hỗ trợ thông báo đẩy. Bạn vẫn nhận được thông báo khi mở trang.</p> : <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => void change(!registered)} className={registered ? workflowSecondary : workflowButton}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? 'Đang cập nhật...' : registered ? 'Tắt thông báo đẩy' : 'Bật thông báo đẩy'}</button>{registered && <><span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Đã đăng ký</span><button type="button" disabled={busy} onClick={() => void change(true)} className="min-h-11 text-xs font-semibold text-[#287DA8] underline underline-offset-4">Đồng bộ lại</button></>}</div>}
  </WorkflowReveal>;
};
