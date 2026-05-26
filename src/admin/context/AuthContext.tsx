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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/admin/check');
      const data = res.data as Partial<AdminUser> & { username?: string };
      setUser({
        id: Number(data.id ?? 0),
        username: data.username || localStorage.getItem('adminUsername') || 'Admin',
        name: data.name,
        isAdmin: true,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await apiClient.post('/api/admin/login', { username, password });
      if (!res.data?.success) {
        throw new Error(res.data?.error || '登录失败，请检查账号密码');
      }
      const resolvedUsername = res.data?.username || username;
      localStorage.setItem('adminUsername', resolvedUsername);
      setUser({ id: 0, username: resolvedUsername, isAdmin: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('登录失败，请检查账号密码');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/admin/logout');
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('adminUsername');
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
