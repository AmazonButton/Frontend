import axios from 'axios';

export const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
export const API_PREFIX = (import.meta as any).env?.VITE_API_PREFIX || '/api';

export const api = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
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
          const res = await axios.post(`${API_URL}${API_PREFIX}/auth/refresh`, {
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
        } catch (_) {
          // Refresh failed
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

// Request interceptor to attach JWT Access Token proactively
api.interceptors.request.use(async (config) => {
  const isAuthEndpoint =
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/register') ||
    config.url?.includes('/auth/refresh');

  if (!isAuthEndpoint) {
    const validToken = await getOrRefreshValidToken();
    if (validToken) {
      if (config.headers && typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${validToken}`);
      } else {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${validToken}`;
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

    // Do not attempt refresh on auth endpoints (login, register, refresh itself)
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

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
        const res = await axios.post(`${API_URL}${API_PREFIX}/auth/refresh`, {
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
