import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { updateSocketAuth } from '../services/socket';

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
    const saved = localStorage.getItem('smart_order_user');
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
    if (savedToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
    return savedToken;
  });

  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem('smart_order_refresh_token')
  );

  // If user and token already exist in localStorage, do NOT block the UI with a full-screen spinner
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('smart_order_token');
    const savedUser = localStorage.getItem('smart_order_user');
    return !(savedToken && savedUser);
  });

  // Instant optimistic logout: clears storage and state immediately, notifies backend in background
  const logout = useCallback(() => {
    const activeToken = localStorage.getItem('smart_order_token');
    const activeRefreshToken = localStorage.getItem('smart_order_refresh_token');

    // 1. Instantly wipe client credentials & state (0ms UI transition)
    localStorage.removeItem('smart_order_token');
    localStorage.removeItem('smart_order_refresh_token');
    localStorage.removeItem('smart_order_user');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setIsLoading(false);
    updateSocketAuth(null);

    // 2. Fire-and-forget background revoke to server without blocking UI
    if (activeRefreshToken || activeToken) {
      api
        .post(
          '/auth/logout',
          { refreshToken: activeRefreshToken },
          {
            headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
          }
        )
        .catch(() => {});
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = localStorage.getItem('smart_order_token');
    const activeRefreshToken = localStorage.getItem('smart_order_refresh_token');
    if (!activeToken && !activeRefreshToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
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

        const latestToken = localStorage.getItem('smart_order_token');
        if (latestToken) {
          setToken(latestToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${latestToken}`;
        }
      }
    } catch (e: any) {
      if (e.response?.status === 401) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

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
