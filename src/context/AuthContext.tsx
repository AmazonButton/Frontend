import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api, isTokenExpired, getOrRefreshValidToken } from '../services/api';
import { updateSocketAuth, clearSocketSubscriptions } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (newToken: string, userData: User, newRefreshToken?: string) => void;
  logout: () => void | Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedToken = localStorage.getItem('smart_order_token');
    const saved = localStorage.getItem('smart_order_user');
    const refreshToken = localStorage.getItem('smart_order_refresh_token');
    if (savedToken && isTokenExpired(savedToken) && !refreshToken) {
      localStorage.removeItem('smart_order_token');
      localStorage.removeItem('smart_order_user');
      return null;
    }
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem('smart_order_token');
    const refreshToken = localStorage.getItem('smart_order_refresh_token');
    if (savedToken) {
      if (isTokenExpired(savedToken)) {
        if (!refreshToken) {
          localStorage.removeItem('smart_order_token');
          return null;
        }
        return null;
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      return savedToken;
    }
    return null;
  });

  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem('smart_order_refresh_token')
  );

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const isAuthRoute =
      typeof window !== 'undefined' &&
      ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(
        window.location.pathname
      );
    const savedToken = localStorage.getItem('smart_order_token');
    const savedUser = localStorage.getItem('smart_order_user');
    if (savedToken && savedUser && !isTokenExpired(savedToken)) {
      return false;
    }
    // If the user is on an auth page without a valid token, do not block with full-screen loading
    if (isAuthRoute) {
      return false;
    }
    const savedRefreshToken = localStorage.getItem('smart_order_refresh_token');
    if (savedRefreshToken) {
      return true;
    }
    return false;
  });

  // Instant optimistic logout: clears storage and state immediately, notifies backend in background
  const logout = useCallback(() => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null);
    const activeRefreshToken = refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_refresh_token') : null);

    // 1. Instantly wipe client credentials & state (0ms UI transition)
    localStorage.removeItem('smart_order_token');
    localStorage.removeItem('smart_order_refresh_token');
    localStorage.removeItem('smart_order_user');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setIsLoading(false);
    clearSocketSubscriptions();
    updateSocketAuth(null);

    // 2. Fire-and-forget background revoke to server without blocking UI
    // Only call /auth/logout if we have an active, unexpired access token, because the backend
    // requires a valid JWT for authentication. If already expired or missing, session is already terminated.
    if (activeToken && !isTokenExpired(activeToken)) {
      api
        .post(
          '/auth/logout',
          { refreshToken: activeRefreshToken || undefined },
          {
            headers: { Authorization: `Bearer ${activeToken}` },
          }
        )
        .catch(() => {});
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const isAuthRoute =
      typeof window !== 'undefined' &&
      ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(
        window.location.pathname
      );

    const activeToken = localStorage.getItem('smart_order_token');
    const activeRefreshToken = localStorage.getItem('smart_order_refresh_token');

    // If user is on an auth page (/login, /register) and has no valid active access token,
    // clear any stale credentials immediately without triggering background refresh calls.
    if (isAuthRoute && (!activeToken || isTokenExpired(activeToken))) {
      localStorage.removeItem('smart_order_token');
      localStorage.removeItem('smart_order_refresh_token');
      localStorage.removeItem('smart_order_user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    if (!activeToken && !activeRefreshToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    // Proactively verify or refresh the token BEFORE calling /auth/me
    const validToken = await getOrRefreshValidToken();
    if (!validToken) {
      localStorage.removeItem('smart_order_token');
      localStorage.removeItem('smart_order_refresh_token');
      localStorage.removeItem('smart_order_user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
      setIsLoading(false);
      clearSocketSubscriptions();
      updateSocketAuth(null);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.data) {
        const u = res.data.data;
        const normalizedUser: User = {
          ...u,
          customerProfileId: u.customerProfileId || u.customerProfile?.id || null,
        };
        setUser(normalizedUser);
        localStorage.setItem('smart_order_user', JSON.stringify(normalizedUser));

        setToken(validToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${validToken}`;
        updateSocketAuth(validToken);
      }
    } catch (e: any) {
      if (e.response?.status === 401) {
        // If /auth/me was rejected with 401, token is invalidated on server.
        // Clean local state directly; do not call /auth/logout with a rejected token.
        localStorage.removeItem('smart_order_token');
        localStorage.removeItem('smart_order_refresh_token');
        localStorage.removeItem('smart_order_user');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
        setToken(null);
        clearSocketSubscriptions();
        updateSocketAuth(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = (newToken: string, userData: User, newRefreshToken?: string) => {
    localStorage.setItem('smart_order_token', newToken);
    setToken(newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    if (newRefreshToken) {
      localStorage.setItem('smart_order_refresh_token', newRefreshToken);
      setRefreshToken(newRefreshToken);
    }

    const normalizedUser: User = {
      ...userData,
      customerProfileId:
        userData.customerProfileId || (userData as any).customerProfile?.id || null,
    };

    clearSocketSubscriptions();
    localStorage.setItem('smart_order_user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    setIsLoading(false);
    updateSocketAuth(newToken);
  };

  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isLoading,
        isAuthenticated,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
