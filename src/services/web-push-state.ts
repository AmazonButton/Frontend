const prefix = 'smart_order_web_push_';
const ownerKey = 'smart_order_push_owner';
const sessionKey = 'smart_order_push_session';
export const PUSH_SETTINGS_EVENT = 'smart-order:push-settings';
export const PUSH_SESSION_EVENT = 'smart-order:push-session';
export interface PushSession { userId: string; marker: string }

const emit = (name: string) => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(name)); };
export function currentPushUserId() {
  try { const user = JSON.parse(localStorage.getItem('smart_order_user') || '{}'); return String(user.id || user.userId || ''); } catch { return ''; }
}
export function readPushOwner() {
  try { return localStorage.getItem(ownerKey) || ''; } catch { return ''; }
}
export function invalidatePushSession() {
  const marker = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  try { localStorage.setItem(sessionKey, marker); } catch { /* A denied storage context cannot register push. */ }
  emit(PUSH_SESSION_EVENT);
}
export function capturePushSession(userId: string): PushSession {
  if (!userId || currentPushUserId() !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang thông báo.');
  // A first capture initializes the marker without cancelling its own action.
  if (!localStorage.getItem(sessionKey)) localStorage.setItem(sessionKey, typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  return { userId, marker: localStorage.getItem(sessionKey) || '' };
}
export function isPushSessionCurrent(session: PushSession) {
  try { return currentPushUserId() === session.userId && localStorage.getItem(sessionKey) === session.marker; } catch { return false; }
}
export function assertPushSession(session: PushSession) {
  if (!isPushSessionCurrent(session)) throw new Error('Tài khoản đã thay đổi. Thao tác thông báo đã dừng.');
}
export function observePushSession(session: PushSession) {
  const controller = new AbortController();
  const check = () => { if (!isPushSessionCurrent(session)) controller.abort(); };
  window.addEventListener('storage', check); window.addEventListener(PUSH_SESSION_EVENT, check);
  check();
  return { signal: controller.signal, dispose: () => { window.removeEventListener('storage', check); window.removeEventListener(PUSH_SESSION_EVENT, check); } };
}
let pushQueue: Promise<unknown> = Promise.resolve();
export function serializePushChange<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request<Promise<T>>('smart-order-push-registration', task);
    return task();
  };
  const pending = pushQueue.then(run, run);
  pushQueue = pending.then(() => undefined, () => undefined);
  return pending;
}
function atMost<T>(operation: Promise<T>, milliseconds: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([operation, new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), milliseconds); })]).finally(() => clearTimeout(timer));
}
export async function clearLocalPushRegistration(userId: string) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const ownerChanged = () => Boolean(readPushOwner() && readPushOwner() !== userId);
  if (ownerChanged()) return;
  const registrations = await atMost(navigator.serviceWorker.getRegistrations(), 1500);
  if (!registrations || ownerChanged()) return;
  await Promise.allSettled(registrations.filter(registration => {
    const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || '';
    return script.includes('firebase-messaging-worker');
  }).map(async registration => {
    if (ownerChanged()) return;
    registration.active?.postMessage({ type: 'SMART_ORDER_PUSH_DISABLE' });
    // Native cleanup avoids a late SDK deleteToken removing a new account's
    // Firebase IndexedDB entry after an old logout operation timed out.
    await atMost(Promise.allSettled([
      registration.pushManager.getSubscription().then(subscription => ownerChanged() ? undefined : subscription?.unsubscribe()),
      registration.getNotifications().then(notifications => notifications.forEach(notification => notification.close())),
      registration.unregister(),
    ]), 2000);
  }));
}
export function cleanupBrowserPushAfterLogout(userId: string) {
  return serializePushChange(() => clearLocalPushRegistration(userId));
}

export function readPushToken(userId: string) {
  try { return readPushOwner() === userId ? localStorage.getItem(`${prefix}${userId}`) || '' : ''; } catch { return ''; }
}
export function savePushToken(userId: string, token: string) {
  // A browser subscription has one backend owner. Do not retain another account's
  // "registered" badge when the same SDK token has been re-bound on this device.
  const oldKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith(prefix) && key !== `${prefix}${userId}`));
  oldKeys.forEach(key => localStorage.removeItem(key));
  localStorage.setItem(`${prefix}${userId}`, token);
  localStorage.setItem(ownerKey, userId);
  emit(PUSH_SETTINGS_EVENT);
}
export function clearPushToken(userId: string) {
  try { localStorage.removeItem(`${prefix}${userId}`); if (readPushOwner() === userId) localStorage.removeItem(ownerKey); } catch { /* Storage can be disabled. */ }
  emit(PUSH_SETTINGS_EVENT);
}

export async function registerWebPush(transport: { post: (path: string, body: any) => Promise<any> }, token: string) {
  if (!token) throw new Error('Chưa tạo được đăng ký thông báo cho thiết bị.');
  const response = await transport.post('/notifications/fcm-token', { token, deviceType: 'WEB' });
  if (response.data?.success !== true) throw new Error(response.data?.message || 'Chưa lưu được đăng ký thông báo.');
}

export async function unregisterWebPush(transport: { delete: (path: string, options: any) => Promise<any> }, token: string, accessToken?: string) {
  if (!token) return;
  const response = await transport.delete('/notifications/fcm-token', { data: { token }, ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000 } : {}) });
  if (response.data?.success !== true) throw new Error(response.data?.message || 'Chưa hủy được đăng ký thông báo.');
}
