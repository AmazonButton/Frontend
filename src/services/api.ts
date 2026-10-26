import axios from 'axios';

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
      const stored = localStorage.getItem('smart_order_api_url');
      if (stored && (stored.includes('produces-accurately') || stored.includes('trycloudflare.com'))) {
        localStorage.removeItem('smart_order_api_url');
      } else if (stored) {
        return stored.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/api$/, '');
      }
      // When hosted on Vercel, route requests through Vercel's same-origin edge proxy (/api/v1/*)
      // to completely bypass browser cross-origin CORS restrictions.
      if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
        return '';
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
    url.includes('/auth/phone') ||
    url.includes('/auth/check-email') ||
    url.includes('/auth/check-username')
  );
};

let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Proactively get a valid JWT, refreshing it if expired and refreshToken is present
 */
export async function getOrRefreshValidToken(): Promise<string | null> {
  const token = localStorage.getItem('smart_order_token');
  const refreshToken = localStorage.getItem('smart_order_refresh_token');

  if (token && !isTokenExpired(token)) {
    return token;
  }

  // Token is missing or expired, but we have a valid refreshToken
  if (refreshToken) {
    if (!activeRefreshPromise) {
      activeRefreshPromise = (async () => {
        try {
          const base = resolveApiUrl();
          const res = await axios.post(`${base}${API_PREFIX}/auth/refresh`, {
            refreshToken,
          });

          if (res.data?.success && (res.data?.accessToken || res.data?.token)) {
            const newToken = res.data.accessToken || res.data.token;
            localStorage.setItem('smart_order_token', newToken);
            if (res.data.refreshToken) {
              localStorage.setItem('smart_order_refresh_token', res.data.refreshToken);
            }
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            return newToken;
          }
        } catch (err: any) {
          // If refresh token is rejected (401/400) or fails, wipe client auth storage immediately
          // so we don't repeat failed refresh calls on every subsequent request.
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('smart_order_token');
              localStorage.removeItem('smart_order_refresh_token');
              localStorage.removeItem('smart_order_user');
              delete api.defaults.headers.common['Authorization'];
            } catch (_) {}
          }
        } finally {
          activeRefreshPromise = null;
        }
        return null;
      })();
    }
    return activeRefreshPromise;
  }

  return null;
}

// Request interceptor to attach JWT Access Token proactively & ensure proper FormData handling
api.interceptors.request.use(async (config) => {
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

  const isAuthEndpoint = isPublicAuthEndpoint(config.url);

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

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle unexpected 401 & fallback auto refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt refresh on auth endpoints (login, register, logout, refresh itself)
    const isAuthEndpoint = isPublicAuthEndpoint(originalRequest?.url);

    // Seamless Prefix Fallback: If 404 occurs on /api/v1, fallback to /api (or vice-versa)
    if (error.response?.status === 404 && !originalRequest._prefixRetried && originalRequest.url) {
      originalRequest._prefixRetried = true;
      const currentBase = originalRequest.baseURL || `${API_URL}${API_PREFIX}`;
      if (currentBase.includes('/api/v1')) {
        originalRequest.baseURL = currentBase.replace('/api/v1', '/api');
        return axios(originalRequest);
      } else if (currentBase.endsWith('/api')) {
        originalRequest.baseURL = currentBase.replace(/\/api$/, '/api/v1');
        return axios(originalRequest);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem('smart_order_refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('smart_order_token');
        localStorage.removeItem('smart_order_refresh_token');
        localStorage.removeItem('smart_order_user');
        const isPublicPath = ['/', '/shop', '/quick-setup'].includes(window.location.pathname);
        if (!isPublicPath && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
              originalRequest.headers.set('Authorization', `Bearer ${token}`);
            } else {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const base = resolveApiUrl();
        const res = await axios.post(`${base}${API_PREFIX}/auth/refresh`, {
          refreshToken,
        });

        if (res.data?.success && (res.data?.accessToken || res.data?.token)) {
          const newAccessToken = res.data.accessToken || res.data.token;
          const newRefreshToken = res.data.refreshToken;

          localStorage.setItem('smart_order_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('smart_order_refresh_token', newRefreshToken);
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
            originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          }

          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('smart_order_token');
        localStorage.removeItem('smart_order_refresh_token');
        localStorage.removeItem('smart_order_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
