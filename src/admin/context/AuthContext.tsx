import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AdminUser } from '../types';

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function setAdminCookie(token: string) {
  document.cookie = `adminToken=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=strict`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      await apiClient.get('/api/admin/check');
      setUser({ id: 0, username: 'Admin', isAdmin: true });
    } catch {
      localStorage.removeItem('adminToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (username: string, password: string) => {
    const endpoints = ['/api/auth/admin-login', '/api/admin/login', '/api/auth/login'];
    let token = '';
    for (const endpoint of endpoints) {
      try {
        const payload = endpoint === '/api/auth/login'
          ? { username, password, isAdmin: true }
          : { username, password };
        const res = await apiClient.post(endpoint, payload);
        token = String(res.data?.token || '');
        if (token) break;
      } catch {
        // try next endpoint
      }
    }
    if (!token) {
      throw new Error('登录失败，请检查账号密码');
    }

    localStorage.setItem('adminToken', token);
    setAdminCookie(token);
    setUser({ id: 0, username, isAdmin: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/admin/logout');
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('adminToken');
    document.cookie = 'adminToken=; path=/; max-age=0';
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
  }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
