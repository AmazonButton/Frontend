import { io, Socket } from 'socket.io-client';
import { API_URL, isTokenExpired, resolveApiUrl, getOrRefreshValidToken } from './api';
import { API_BACKOFF_EVENT, getApiRetryUntil, recordRateLimit } from './request-backoff';

let socket: Socket | null = null;
let subscribedStoreId: string | null = typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_store') : null;
let subscribedCustomerId: string | null = typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_customer') : null;
let refreshing = false;
let connecting = false;
let failures = 0;
let lastAuthRefresh = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAt = 0;
let pagePaused = false;
let disposed = false;

const getStoredToken = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null;
  return token && !isTokenExpired(token) ? token : null;
};
const hasSession = () => Boolean(getStoredToken() || (typeof window !== 'undefined' && localStorage.getItem('smart_order_refresh_token')));
const clearRetry = () => { if (retryTimer) clearTimeout(retryTimer); retryTimer = null; };
function resubscribe() {
  if (!socket?.connected) return;
  if (subscribedStoreId) socket.emit('subscribe:store', subscribedStoreId);
  if (subscribedCustomerId) socket.emit('subscribe:customer', subscribedCustomerId);
}
function setSocketToken(token: string | null) {
  if (socket) socket.auth = { token: token ? `Bearer ${token}` : undefined };
}
function scheduleConnection() {
  if (disposed || pagePaused || !socket || socket.connected || connecting || !hasSession() || retryTimer) return;
  const delay = Math.max(0, retryAt - Date.now(), getApiRetryUntil() - Date.now());
  retryTimer = setTimeout(() => { retryTimer = null; void reconnectSocketWithFreshToken(false); }, Math.min(delay, 2147483647));
}
function connectionFailed() {
  connecting = false;
  failures += 1;
  retryAt = Date.now() + Math.min(60000, 5000 * 2 ** Math.min(failures - 1, 4)) + Math.floor(Math.random() * 1000);
  scheduleConnection();
}

// Transport errors are not authentication errors. Only explicit auth rejection
// refreshes a still-valid JWT; all other retries keep their increasing delay.
export async function reconnectSocketWithFreshToken(forceRefresh = true): Promise<void> {
  if (disposed || pagePaused || refreshing || !socket || !hasSession()) return;
  if (getApiRetryUntil()) { scheduleConnection(); return; }
  if (forceRefresh && lastAuthRefresh && Date.now() - lastAuthRefresh < 30000) { connectionFailed(); return; }
  if (!forceRefresh && Date.now() < retryAt) { scheduleConnection(); return; }
  refreshing = true;
  if (forceRefresh) lastAuthRefresh = Date.now();
  try {
    const token = await getOrRefreshValidToken(forceRefresh);
    if (disposed || pagePaused || !socket) return;
    if (!token) { connectionFailed(); return; }
    setSocketToken(token);
    if (socket.connected) { socket.emit('authenticate', { token }); resubscribe(); }
    else if (!connecting && !getApiRetryUntil()) { connecting = true; socket.connect(); }
  } finally { refreshing = false; }
}
export const reconnectSocket = reconnectSocketWithFreshToken;

const CLUSTER_WEBSOCKET_NODES = ['https://backend-fae8.onrender.com', 'https://backend-node2-ukib.onrender.com'];
export function resolveSocketUrl(): string {
  const envSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL;
  if (typeof envSocketUrl === 'string' && envSocketUrl.startsWith('http') && !envSocketUrl.includes('workers.dev')) return envSocketUrl.trim().replace(/\/+$/, '');
  const resolved = typeof resolveApiUrl === 'function' ? resolveApiUrl() : API_URL;
  if (typeof resolved === 'string' && resolved.startsWith('http') && !resolved.includes('workers.dev')) return resolved.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  return CLUSTER_WEBSOCKET_NODES[0];
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      autoConnect: false,
      auth: cb => cb({ token: getStoredToken() ? `Bearer ${getStoredToken()}` : undefined }),
      transports: ['websocket'], upgrade: false,
      // One scheduler owns retries, including retries after an opaque WS 429.
      reconnection: false, timeout: 15000,
    });
    socket.on('connect', () => {
      connecting = false; failures = 0; retryAt = 0; clearRetry();
      const token = getStoredToken();
      if (token) socket?.emit('authenticate', { token }); else socket?.disconnect();
      resubscribe();
    });
    socket.on('authenticated', resubscribe);
    socket.on('disconnect', reason => { connecting = false; if (reason !== 'io client disconnect') connectionFailed(); });
    socket.on('connect_error', (error: any) => {
      connecting = false;
      const status = Number(error?.data?.status || error?.data?.statusCode || error?.context?.status || error?.status);
      if (status === 429) recordRateLimit({ response: { status, headers: error?.context?.headers } });
      if (status === 401 || status === 403 || /unauthorized|jwt|token expired|invalid token/i.test(error?.message || '')) void reconnectSocketWithFreshToken(true);
      else connectionFailed();
    });
    socket.on('unauthorized', () => { void reconnectSocketWithFreshToken(true); });
    socket.on('error', (error: any) => {
      if (error?.code === 'UNAUTHORIZED' || /unauthorized|jwt|token expired|invalid token/i.test(error?.message || '')) void reconnectSocketWithFreshToken(true);
    });
  }
  setSocketToken(getStoredToken()); scheduleConnection();
  return socket;
}

export function updateSocketAuth(token?: string | null) {
  const validToken = token !== undefined ? token && !isTokenExpired(token) ? token : null : getStoredToken();
  if (!validToken) { clearRetry(); connecting = false; socket?.disconnect(); setSocketToken(null); return; }
  const previous = socket && typeof socket.auth === 'object' ? socket.auth.token : undefined;
  const s = getSocket(); setSocketToken(validToken);
  if (previous !== `Bearer ${validToken}`) { clearRetry(); failures = 0; retryAt = 0; lastAuthRefresh = 0; }
  if (s.connected) { s.emit('authenticate', { token: validToken }); resubscribe(); }
  else scheduleConnection();
}
export function subscribeToStore(storeId: string) {
  subscribedStoreId = storeId;
  if (typeof window !== 'undefined' && storeId) localStorage.setItem('smart_order_sub_store', storeId);
  const s = getSocket(); if (storeId && s.connected && getStoredToken()) s.emit('subscribe:store', storeId);
}
export function subscribeToCustomer(customerId: string) {
  subscribedCustomerId = customerId;
  if (typeof window !== 'undefined' && customerId) localStorage.setItem('smart_order_sub_customer', customerId);
  const s = getSocket(); if (customerId && s.connected && getStoredToken()) s.emit('subscribe:customer', customerId);
}
export function clearSocketSubscriptions() {
  subscribedStoreId = null; subscribedCustomerId = null; clearRetry(); retryAt = 0; failures = 0;
  if (typeof window !== 'undefined') { localStorage.removeItem('smart_order_sub_store'); localStorage.removeItem('smart_order_sub_customer'); }
}

const onPageHide = () => { pagePaused = true; clearRetry(); socket?.disconnect(); connecting = false; };
const onPageShow = () => { pagePaused = false; scheduleConnection(); };
const onApiBackoff = () => { clearRetry(); scheduleConnection(); };
let tokenTimer: ReturnType<typeof setInterval> | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', onPageHide); window.addEventListener('pageshow', onPageShow); window.addEventListener(API_BACKOFF_EVENT, onApiBackoff);
  tokenTimer = setInterval(() => {
    if (!pagePaused && hasSession() && !getStoredToken() && !getApiRetryUntil()) void reconnectSocketWithFreshToken(false);
  }, 30000);
}
if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true; clearRetry(); if (tokenTimer) clearInterval(tokenTimer); socket?.disconnect();
  if (typeof window !== 'undefined') { window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow); window.removeEventListener(API_BACKOFF_EVENT, onApiBackoff); }
});
