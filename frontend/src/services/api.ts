import axios from 'axios';
import { apiCooldownError, deferApiRequests, getApiRetryUntil, recordRateLimit, throwIfApiCoolingDown } from './request-backoff';

let cachedApiUrlKey = '';
let cachedApiUrlValue = '';

export const resolveApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const host = window.location.hostname;
      const search = window.location.search;
      const stored = localStorage.getItem('smart_order_api_url') || '';
      const cacheKey = `${host}|${search}|${stored}`;
      if (cacheKey === cachedApiUrlKey) {
        return cachedApiUrlValue;
      }

      if (search && (search.includes('api=') || search.includes('apiUrl=') || search.includes('backend='))) {
        const urlParams = new URLSearchParams(search);
        const queryApi = urlParams.get('api') || urlParams.get('apiUrl') || urlParams.get('backend');
        if (queryApi) {
          const clean = queryApi.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
          localStorage.setItem('smart_order_api_url', clean);
          cachedApiUrlKey = `${host}|${search}|${clean}`;
          cachedApiUrlValue = clean;
          return clean;
        }
      }
      // When hosted on Vercel or running locally with Vite proxy, route requests
      // through the same-origin proxy (/api/v1/*) to completely eliminate CORS preflight restrictions.
      const isProxyableHost =
        host.includes('vercel.app') ||
        host === 'localhost' ||
        host === '127.0.0.1';

      if (isProxyableHost) {
        cachedApiUrlKey = cacheKey;
        cachedApiUrlValue = '';
        return '';
      }

      if (stored && (stored.includes('produces-accurately') || stored.includes('trycloudflare.com') || stored.includes('workers.dev'))) {
        localStorage.removeItem('smart_order_api_url');
      } else if (stored) {
        const clean = stored.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
        cachedApiUrlKey = cacheKey;
        cachedApiUrlValue = clean;
        return clean;
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }
  }

  const rawEnv = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
  if (rawEnv && typeof rawEnv === 'string' && rawEnv.startsWith('http')) {
    return rawEnv.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
  }

  return 'https://backend-fae8.onrender.com';
};

export const API_URL = resolveApiUrl();
export const API_PREFIX = (import.meta as any).env?.VITE_API_PREFIX || '/api/v1';

export const api = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  timeout: 25000,
});

// Cache decoded JWT exp per token string to avoid atob + decodeURIComponent + JSON.parse on every request
let cachedJwtToken: string | null = null;
let cachedJwtExpMs: number | null = null;
let cachedJwtInvalid = false;

/**
 * Check if a JWT is expired or about to expire in the next 30 seconds
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  if (token === cachedJwtToken) {
    if (cachedJwtInvalid) return true;
    if (cachedJwtExpMs === null) return false;
    return Date.now() >= cachedJwtExpMs - 30000;
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      cachedJwtToken = token;
      cachedJwtExpMs = null;
      cachedJwtInvalid = true;
      return true;
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    cachedJwtToken = token;
    cachedJwtInvalid = false;
    cachedJwtExpMs = parsed.exp ? Number(parsed.exp) * 1000 : null;
    if (cachedJwtExpMs === null) return false;
    // Buffer of 30 seconds: refresh before actual expiration to prevent 401 on in-flight requests
    return Date.now() >= cachedJwtExpMs - 30000;
  } catch {
    cachedJwtToken = token;
    cachedJwtExpMs = null;
    cachedJwtInvalid = true;
    return true;
  }
}

export const isPublicAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/verify-email') ||
    url.includes('/auth/resend-verification') ||
    url.includes('/auth/google') ||
    url.includes('/auth/check-email') ||
    url.includes('/auth/check-username')
  );
};

let activeRefreshPromise: Promise<string | null> | null = null;

// Cache parsed session marker to avoid JSON.parse(localStorage) on every request
let cachedSessionUserRaw: string | null = null;
let cachedSessionPushRaw: string | null = null;
let cachedSessionMarker = '';

export function apiSessionMarker(): string {
  try {
    const userRaw = localStorage.getItem('smart_order_user') || '{}';
    const pushRaw = localStorage.getItem('smart_order_push_session') || '';
    if (userRaw === cachedSessionUserRaw && pushRaw === cachedSessionPushRaw) {
      return cachedSessionMarker;
    }
    const user = JSON.parse(userRaw);
    cachedSessionUserRaw = userRaw;
    cachedSessionPushRaw = pushRaw;
    cachedSessionMarker = String(user.id || user.userId || '') + ':' + pushRaw;
    return cachedSessionMarker;
  } catch {
    return '';
  }
}

// Short-TTL in-memory GET deduplication & response cache for heavy read endpoints.
// Cleared immediately on any mutating request (POST/PUT/PATCH/DELETE) or session switch.
const READ_CACHE_TTL_MS = 4000;
const CACHEABLE_READ_PREFIXES = [
  '/devices',
  '/stores',
  '/products/storefront',
  '/device-templates',
  '/warranty/tickets',
  '/rentals/returns',
  '/admin/stats',
  '/admin/stores',
  '/admin/audit-logs',
  '/admin/users',
  '/admin/plans',
  '/analytics',
];

const readResponseCache = new Map<string, { expiresAt: number; response: any }>();
const inFlightReadCache = new Map<string, Promise<any>>();
let readCacheSession = '';

function invalidateApiReadCache() {
  readResponseCache.clear();
  inFlightReadCache.clear();
}

function isCacheableReadUrl(url: string): boolean {
  const path = String(url || '').split('?')[0];
  if (!path || path.includes('/discounts') || path === '/admin/stores/pending') return false;
  return CACHEABLE_READ_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildReadCacheKey(url: string, params?: Record<string, any>): string {
  const session = apiSessionMarker();
  if (session !== readCacheSession) {
    readCacheSession = session;
    invalidateApiReadCache();
  }
  let query = '';
  if (params && typeof params === 'object') {
    const entries = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort()
      .map((k) => `${k}=${String(params[k])}`);
    if (entries.length) query = `?${entries.join('&')}`;
  }
  return `${session}|${url}${query}`;
}

const rawApiGet = api.get.bind(api);
api.get = ((url: string, config?: any) => {
  const noCache = Boolean(config?.headers?.['x-no-cache'] || config?.headers?.['X-No-Cache']);
  if (!noCache && isCacheableReadUrl(url)) {
    const key = buildReadCacheKey(url, config?.params);
    const cached = readResponseCache.get(key);
    if (cached && cached.expiresAt > Date.now() && !config?.signal?.aborted) {
      return Promise.resolve(cached.response);
    }
    if (!config?.signal) {
      const existing = inFlightReadCache.get(key);
      if (existing) return existing;
      const promise = rawApiGet(url, config)
        .then((res: any) => {
          readResponseCache.set(key, { expiresAt: Date.now() + READ_CACHE_TTL_MS, response: res });
          if (readResponseCache.size > 80) {
            const oldestKey = readResponseCache.keys().next().value;
            if (oldestKey) readResponseCache.delete(oldestKey);
          }
          return res;
        })
        .finally(() => {
          inFlightReadCache.delete(key);
        });
      inFlightReadCache.set(key, promise);
      return promise;
    }
    return rawApiGet(url, config).then((res: any) => {
      readResponseCache.set(key, { expiresAt: Date.now() + READ_CACHE_TTL_MS, response: res });
      return res;
    });
  }
  return rawApiGet(url, config);
}) as typeof api.get;

function clearRejectedSession(refreshToken: string | null) {
  if (localStorage.getItem('smart_order_refresh_token') !== refreshToken) return;
  invalidateApiReadCache();
  localStorage.removeItem('smart_order_token');
  localStorage.removeItem('smart_order_refresh_token');
  localStorage.removeItem('smart_order_user');
  delete api.defaults.headers.common['Authorization'];
}

// The request interceptor, 401 recovery and socket share exactly one refresh.
export async function getOrRefreshValidToken(forceRefresh = false): Promise<string | null> {
  const token = localStorage.getItem('smart_order_token');
  const refreshToken = localStorage.getItem('smart_order_refresh_token');
  if (!forceRefresh && token && !isTokenExpired(token)) return token;
  if (!refreshToken || getApiRetryUntil()) return null;
  if (activeRefreshPromise) return activeRefreshPromise;
  const scope = apiSessionMarker();
  activeRefreshPromise = (async () => {
    try {
      const base = resolveApiUrl();
      const res = await axios.post(`${base}${API_PREFIX}/auth/refresh`, { refreshToken }, { timeout: 25000 });
      if (apiSessionMarker() !== scope || localStorage.getItem('smart_order_refresh_token') !== refreshToken) return null;
      if (res.data?.success === false) { deferApiRequests(15000); return null; }
      const nextToken = res.data?.accessToken || res.data?.token || res.data?.data?.accessToken || res.data?.data?.token;
      if (!nextToken || isTokenExpired(nextToken)) { deferApiRequests(15000); return null; }
      localStorage.setItem('smart_order_token', nextToken);
      const nextRefresh = res.data?.refreshToken || res.data?.data?.refreshToken;
      if (nextRefresh) localStorage.setItem('smart_order_refresh_token', nextRefresh);
      api.defaults.headers.common['Authorization'] = `Bearer ${nextToken}`;
      return nextToken;
    } catch (error: any) {
      if (apiSessionMarker() !== scope || localStorage.getItem('smart_order_refresh_token') !== refreshToken) return null;
      const status = error?.response?.status;
      if (status === 401 || status === 403 || status === 400) clearRejectedSession(refreshToken);
      else if (status === 429) recordRateLimit(error);
      else deferApiRequests(15000);
      return null;
    } finally { activeRefreshPromise = null; }
  })();
  return activeRefreshPromise;
}

// Request interceptor to attach JWT Access Token proactively & ensure proper FormData handling
export function isRecoverableRead(config: any): boolean {
  return String(config?.method || 'get').toLowerCase() === 'get'
    && ['/orders', '/admin/stores/pending'].includes(String(config?.url || '').split('?')[0]);
}

export function isTransientConnectionError(error: any): boolean {
  if (error?.code === 'ERR_CANCELED' || error?.config?.signal?.aborted) return false;
  if (error?.response) return [502, 503, 504].includes(error.response.status);
  return ['ERR_NETWORK', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(error?.code);
}

api.interceptors.request.use(async (config) => {
  throwIfApiCoolingDown(config);
  if (typeof isRecoverableRead === 'function' && isRecoverableRead(config)) {
    const scoped = config as any;
    if (scoped._readSessionMarker == null) scoped._readSessionMarker = apiSessionMarker();
    if (scoped._readSessionMarker !== apiSessionMarker()) throw new axios.CanceledError('Tài khoản đã thay đổi.');
  }
  const currentBase = resolveApiUrl();
  if (config.baseURL && !config.baseURL.startsWith(currentBase)) {
    config.baseURL = `${currentBase}${API_PREFIX}`;
  }

  // If request data is FormData, remove Content-Type header so the browser automatically sets multipart/form-data with the correct boundary
  if (config.data instanceof FormData) {
    if (config.headers) {
      if (typeof (config.headers as any).delete === 'function') {
        (config.headers as any).delete('Content-Type');
        (config.headers as any).delete('content-type');
      } else {
        delete (config.headers as any)['Content-Type'];
        delete (config.headers as any)['content-type'];
      }
    }
  }

  // Auto-generate x-idempotency-key for state-mutating requests (POST, PUT, PATCH, DELETE)
  const method = (config.method || 'get').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (typeof invalidateApiReadCache === 'function') invalidateApiReadCache();
    const headers = config.headers as any;
    const existingKey =
      headers?.['x-idempotency-key'] ||
      headers?.['X-Idempotency-Key'];

    if (!existingKey) {
      const generatedKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 8)}`;
      if (config.headers && typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('x-idempotency-key', generatedKey);
      } else {
        config.headers = config.headers || {};
        config.headers['x-idempotency-key'] = generatedKey;
      }
    }
  }

  const isAuthEndpoint = isPublicAuthEndpoint(config.url);

  // AuthContext sets an application JWT on Axios defaults. Google login must
  // send only its fresh OAuth token in the body, never that previous session.
  if (/\/auth\/google(?:-login)?(?:\?|$)/.test(config.url || '') && config.headers) {
    if (typeof (config.headers as any).delete === 'function') {
      (config.headers as any).delete('Authorization');
      (config.headers as any).delete('authorization');
    } else {
      delete (config.headers as any)['Authorization'];
      delete (config.headers as any)['authorization'];
    }
  }

  if (!isAuthEndpoint) {
    const validToken = await getOrRefreshValidToken();
    if (validToken) {
      if (config.headers && typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${validToken}`);
      } else {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${validToken}`;
      }
    } else {
      if (config.headers) {
        if (typeof (config.headers as any).delete === 'function') {
          (config.headers as any).delete('Authorization');
          (config.headers as any).delete('authorization');
        } else {
          delete (config.headers as any)['Authorization'];
          delete (config.headers as any)['authorization'];
        }
      }
    }
  }
  return config;
});

// A 429 pauses later requests; it is never retried automatically.
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.isLocalCooldown) return Promise.reject(error);
    if (error.response?.status === 429) { recordRateLimit(error); return Promise.reject(apiCooldownError(originalRequest)); }
    if (!originalRequest) return Promise.reject(error);
    if (isRecoverableRead(originalRequest) && isTransientConnectionError(error)
      && !originalRequest._readRetried && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      originalRequest._readRetried = true;
      const scope = originalRequest._readSessionMarker;
      await new Promise(resolve => setTimeout(resolve, 750));
      if (originalRequest.signal?.aborted || scope !== apiSessionMarker()) return Promise.reject(new axios.CanceledError('Yêu cầu đã hủy hoặc tài khoản đã thay đổi.'));
      if (getApiRetryUntil()) return Promise.reject(apiCooldownError(originalRequest));
      return api(originalRequest);
    }
    const isAuthEndpoint = isPublicAuthEndpoint(originalRequest.url);
    const isMissingRoute404 =
      error.response?.status === 404 &&
      (!error.response?.data ||
        typeof error.response.data === 'string' ||
        String(error.response.data?.message || '').startsWith('Cannot '));
    if (isMissingRoute404 && !originalRequest._prefixRetried && originalRequest.url) {
      originalRequest._prefixRetried = true;
      const currentBase = originalRequest.baseURL || `${API_URL}${API_PREFIX}`;
      if (currentBase.includes('/api/v1')) { originalRequest.baseURL = currentBase.replace('/api/v1','/api'); return axios(originalRequest); }
      if (currentBase.endsWith('/api')) { originalRequest.baseURL = currentBase.replace(/\/api$/, '/api/v1'); return axios(originalRequest); }
    }
    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) return Promise.reject(error);
    if (originalRequest._sessionMarker != null && originalRequest._sessionMarker !== apiSessionMarker()) return Promise.reject(new axios.CanceledError('Tài khoản đã thay đổi.'));
    originalRequest._retry = true;
    const sentToken = originalRequest.headers?.get?.('Authorization') || originalRequest.headers?.Authorization;
    const currentToken = localStorage.getItem('smart_order_token');
    const scope = apiSessionMarker();
    const freshToken = currentToken && !isTokenExpired(currentToken) && sentToken !== `Bearer ${currentToken}` ? currentToken : await getOrRefreshValidToken(true);
    if (apiSessionMarker() !== scope && localStorage.getItem('smart_order_token')) return Promise.reject(new axios.CanceledError('Tài khoản đã thay đổi.'));
    if (freshToken) {
      if (originalRequest.headers?.set) originalRequest.headers.set('Authorization', `Bearer ${freshToken}`);
      else originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${freshToken}` };
      return api(originalRequest);
    }
    if (getApiRetryUntil()) return Promise.reject(apiCooldownError(originalRequest));
    if (!localStorage.getItem('smart_order_refresh_token')) {
      localStorage.removeItem('smart_order_token'); localStorage.removeItem('smart_order_user');
      delete api.defaults.headers.common['Authorization'];
      const publicPath = ['/', '/shop', '/quick-setup', '/phone-auth', '/login', '/register'].includes(window.location.pathname);
      if (!publicPath) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
