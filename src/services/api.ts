import axios from 'axios';
import { apiCooldownError, deferApiRequests, getApiRetryUntil, recordRateLimit, throwIfApiCoolingDown } from './request-backoff';

export const resolveApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryApi = urlParams.get('api') || urlParams.get('apiUrl') || urlParams.get('backend');
      if (queryApi) {
        const clean = queryApi.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
        localStorage.setItem('smart_order_api_url', clean);
        return clean;
      }
      // When hosted on Vercel or running locally with Vite proxy, route requests
      // through the same-origin proxy (/api/v1/*) to completely eliminate CORS preflight restrictions.
      const isProxyableHost =
        window.location.hostname.includes('vercel.app') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (isProxyableHost) {
        return '';
      }

      const stored = localStorage.getItem('smart_order_api_url');
      if (stored && (stored.includes('produces-accurately') || stored.includes('trycloudflare.com') || stored.includes('workers.dev'))) {
        localStorage.removeItem('smart_order_api_url');
      } else if (stored) {
        return stored.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
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

/**
 * Check if a JWT is expired or about to expire in the next 30 seconds
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return false;
    // Buffer of 30 seconds: refresh before actual expiration to prevent 401 on in-flight requests
    return Date.now() >= parsed.exp * 1000 - 30000;
  } catch {
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

export function apiSessionMarker(): string {
  try { const user = JSON.parse(localStorage.getItem('smart_order_user') || '{}'); return String(user.id || user.userId || '') + ':' + (localStorage.getItem('smart_order_push_session') || ''); } catch { return ''; }
}

function clearRejectedSession(refreshToken: string | null) {
  if (localStorage.getItem('smart_order_refresh_token') !== refreshToken) return;
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
api.interceptors.request.use(async (config) => {
  throwIfApiCoolingDown(config);
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
    const isAuthEndpoint = isPublicAuthEndpoint(originalRequest.url);
    if (error.response?.status === 404 && !originalRequest._prefixRetried && originalRequest.url) {
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
