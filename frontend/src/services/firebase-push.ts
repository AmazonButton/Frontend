import axios from 'axios';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import workerUrl from './firebase-messaging-worker?worker&url';
import { firebaseWebConfig, getWebFirebaseApp, pushConfigured } from './firebase-web';
import { api, getOrRefreshValidToken } from './api';
import { assertPushSession, capturePushSession, clearLocalPushRegistration, clearPushToken, cleanupBrowserPushAfterLogout, isPushSessionCurrent, observePushSession, readPushToken, registerWebPush, savePushToken, serializePushChange, unregisterWebPush } from './web-push-state';
import type { PushSession } from './web-push-state';

async function capturedTransport(session: PushSession, signal: AbortSignal) {
  assertPushSession(session);
  const token = await getOrRefreshValidToken();
  assertPushSession(session);
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  // This instance has no global request interceptor. An account switch cannot
  // replace the captured JWT while a registration request is being sent.
  return axios.create({ baseURL: api.defaults.baseURL, headers: { Authorization: `Bearer ${token}` }, timeout: 8000, signal });
}

export function enableFirebasePush(userId: string, captured = capturePushSession(userId)) {
  return serializePushChange(async () => {
    assertPushSession(captured);
    const watcher = observePushSession(captured);
    let transport: Awaited<ReturnType<typeof capturedTransport>> | undefined;
    let registeredToken = '';
    try {
      if (!pushConfigured) throw new Error('Thông báo trên thiết bị chưa được bật cho hệ thống.');
      if (!window.isSecureContext || !('serviceWorker' in navigator) || !(await isSupported())) throw new Error('Trình duyệt này chưa hỗ trợ thông báo đẩy. Bạn vẫn nhận được thông báo khi mở trang.');
      assertPushSession(captured);
      if (Notification.permission !== 'granted') throw new Error('Cho phép thông báo trong trình duyệt trước khi tiếp tục.');
      transport = await capturedTransport(captured, watcher.signal);
      const url = new URL(workerUrl, window.location.origin);
      url.searchParams.set('config', JSON.stringify(firebaseWebConfig));
      const registration = await navigator.serviceWorker.register(url.href, { type: import.meta.env.DEV ? 'module' : 'classic' });
      assertPushSession(captured);
      if (!registration.active) {
        await new Promise<void>((resolve, reject) => {
          const worker = registration.installing || registration.waiting;
          if (!worker) { reject(new Error('Chưa khởi tạo được thông báo. Vui lòng thử lại.')); return; }
          const clean = () => { clearTimeout(timeout); worker.removeEventListener('statechange', check); watcher.signal.removeEventListener('abort', cancel); };
          const cancel = () => { clean(); reject(new Error('Tài khoản đã thay đổi. Thao tác thông báo đã dừng.')); };
          const check = () => {
            if (worker.state === 'activated') { clean(); resolve(); }
            else if (worker.state === 'redundant') { clean(); reject(new Error('Chưa khởi tạo được thông báo.')); }
          };
          const timeout = window.setTimeout(() => { clean(); reject(new Error('Khởi tạo thông báo quá lâu. Vui lòng thử lại.')); }, 15000);
          worker.addEventListener('statechange', check); watcher.signal.addEventListener('abort', cancel); check();
        });
      }
      assertPushSession(captured);
      const token = await getToken(getMessaging(getWebFirebaseApp()), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
      assertPushSession(captured);
      await registerWebPush(transport, token);
      registeredToken = token;
      assertPushSession(captured);
      savePushToken(userId, token);
      registration.active?.postMessage({ type: 'SMART_ORDER_PUSH_ENABLE' });
    } catch (error) {
      // If the session disappeared just after the server accepted the token,
      // compensate with the original credentials, never the next user's JWT.
      if (registeredToken && transport) {
        const cleanup = axios.create({ baseURL: transport.defaults.baseURL, headers: transport.defaults.headers, timeout: 4000 });
        await unregisterWebPush(cleanup, registeredToken).catch(() => undefined);
      }
      if (registeredToken || !isPushSessionCurrent(captured)) await clearLocalPushRegistration(userId).catch(() => undefined);
      throw error;
    } finally { watcher.dispose(); }
  });
}

export function disableFirebasePush(userId: string, captured = capturePushSession(userId)) {
  return serializePushChange(async () => {
    assertPushSession(captured);
    const watcher = observePushSession(captured);
    try {
      const token = readPushToken(userId);
      const transport = await capturedTransport(captured, watcher.signal);
      await unregisterWebPush(transport, token);
      assertPushSession(captured);
      clearPushToken(userId);
      await clearLocalPushRegistration(userId).catch(() => undefined);
      assertPushSession(captured);
    } finally { watcher.dispose(); }
  });
}

// Called without awaiting by AuthContext. Registration mutations are serialized
// across tabs where Web Locks is supported, and within each tab otherwise.
export function cleanupFirebasePushAfterLogout(userId: string) {
  return cleanupBrowserPushAfterLogout(userId);
}
