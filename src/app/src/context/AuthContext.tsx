import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { authApi } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  loginWithSms: (phone: string, code: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('sl_user');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sl_token'));
  const [loading, setLoading] = useState(true);

  // 启动时校验会话有效性
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((res) => {
        const u = res.data as User;
        setUser(u);
        localStorage.setItem('sl_user', JSON.stringify(u));
      })
      .catch(() => {
        // token 失效
        localStorage.removeItem('sl_token');
        localStorage.removeItem('sl_user');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // 只在挂载时运行一次

  const _persistSession = useCallback((userData: User, authToken: string) => {
    localStorage.setItem('sl_token', authToken);
    localStorage.setItem('sl_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const res = await authApi.loginPassword(phone, password);
    const { token: t, user: u } = res.data as { token: string; user: User };
    _persistSession(u, t);
  }, [_persistSession]);

  const loginWithSms = useCallback(async (phone: string, code: string) => {
    const res = await authApi.verifySmsCode(phone, code);
    const { token: t, user: u } = res.data as { token: string; user: User };
    _persistSession(u, t);
  }, [_persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem('sl_token');
    localStorage.removeItem('sl_user');
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, token, isAuthenticated: Boolean(user && token), loading,
    login, loginWithSms, logout, setUser,
  }), [user, token, loading, login, loginWithSms, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
