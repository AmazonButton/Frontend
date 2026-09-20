import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (newToken: string, userData: User, newRefreshToken?: string) => void;
  logout: () => Promise<void>;
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

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('smart_order_token')
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem('smart_order_refresh_token')
  );
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      const activeRefreshToken = localStorage.getItem('smart_order_refresh_token');
      if (activeRefreshToken) {
        await api.post('/auth/logout', { refreshToken: activeRefreshToken }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('smart_order_token');
      localStorage.removeItem('smart_order_refresh_token');
      localStorage.removeItem('smart_order_user');
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = localStorage.getItem('smart_order_token');
    if (!activeToken) {
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
      }
    } catch (e: any) {
      if (e.response?.status === 401) {
        await logout();
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
