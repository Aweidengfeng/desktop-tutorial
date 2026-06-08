import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/client';

type LoginMode = 'password' | 'sms';

export function LoginPage() {
  const { login, loginWithSms } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendSms = async () => {
    if (!phone.trim()) { setError('请输入手机号'); return; }
    setSending(true);
    setError('');
    try {
      await authApi.sendSmsCode(phone.trim());
      startCountdown();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || '发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'password') {
        await login(phone.trim(), password);
      } else {
        await loginWithSms(phone.trim(), code.trim());
      }
      navigate('/', { replace: true });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e as { message?: string })?.message
        || '登录失败，请检查信息后重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950">
      {/* Hero */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
          <span className="material-symbols-outlined text-3xl text-white">terrain</span>
        </div>
        <h1 className="text-2xl font-bold text-white font-display">巅峰探索</h1>
        <p className="text-slate-400 text-sm mt-1">SummitLink · 全球高山攀登平台</p>
      </div>

      {/* Card */}
      <div className="flex-1 px-6 pb-8">
        <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
          {/* Mode toggle */}
          <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
            {(['password', 'sms'] as LoginMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === m ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                {m === 'password' ? '密码登录' : '验证码登录'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">手机号</label>
              <input
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
              />
            </div>

            {mode === 'password' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">密码</label>
                <input
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">验证码</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="6位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSendSms}
                    disabled={sending || countdown > 0}
                    className="px-4 py-3 bg-slate-700 text-slate-200 rounded-xl text-sm font-medium whitespace-nowrap disabled:opacity-50 hover:bg-slate-600 transition-colors"
                  >
                    {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="text-rose-400 text-sm bg-rose-950/50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-slate-500 text-sm">还没有账号？</span>
            <Link to="/auth/register" className="text-primary-light text-sm font-medium ml-1">立即注册</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
