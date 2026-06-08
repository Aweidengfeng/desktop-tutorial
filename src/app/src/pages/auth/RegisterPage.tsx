import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

export function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: '', password: '', confirmPassword: '', username: '' });
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(60);
    countdownRef.current = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
      return c - 1;
    }), 1000);
  };

  const handleSendCode = async () => {
    if (!form.phone.trim()) { setError('请输入手机号'); return; }
    setSending(true); setError('');
    try {
      await authApi.sendSmsCode(form.phone.trim());
      startCountdown();
      setStep('verify');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError('两次密码不一致'); return; }
    setLoading(true); setError('');
    try {
      // 先验证手机号
      await authApi.verifySmsCode(form.phone.trim(), code.trim());
      // 再注册
      const res = await authApi.register({
        phone: form.phone.trim(),
        password: form.password,
        username: form.username.trim() || undefined,
      });
      const { token, user } = res.data as { token: string; user: User };
      localStorage.setItem('sl_token', token);
      localStorage.setItem('sl_user', JSON.stringify(user));
      setUser(user);
      navigate('/', { replace: true });
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || (e as { message?: string })?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950">
      <div className="flex flex-col items-center pt-12 pb-6 px-6">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
          <span className="material-symbols-outlined text-2xl text-white">terrain</span>
        </div>
        <h1 className="text-xl font-bold text-white">创建账号</h1>
        <p className="text-slate-400 text-sm mt-1">加入全球高山攀登社区</p>
      </div>

      <div className="flex-1 px-6 pb-8">
        <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
          {step === 'form' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">用户名（选填）</label>
                <input
                  type="text"
                  placeholder="设置昵称"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">手机号</label>
                <input
                  type="tel"
                  placeholder="请输入手机号"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">密码</label>
                <input
                  type="password"
                  placeholder="至少 8 位"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">确认密码</label>
                <input
                  type="password"
                  placeholder="再次输入密码"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary-light transition-colors"
                />
              </div>
              {error && <p className="text-rose-400 text-sm bg-rose-950/50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                onClick={handleSendCode}
                disabled={sending}
                className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {sending ? '发送中...' : '获取验证码'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-slate-300 text-sm">验证码已发送至 <span className="text-white font-medium">{form.phone}</span></p>
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
                    onClick={handleSendCode}
                    disabled={sending || countdown > 0}
                    className="px-4 py-3 bg-slate-700 text-slate-200 rounded-xl text-sm font-medium whitespace-nowrap disabled:opacity-50 hover:bg-slate-600 transition-colors"
                  >
                    {countdown > 0 ? `${countdown}s` : '重新发送'}
                  </button>
                </div>
              </div>
              {error && <p className="text-rose-400 text-sm bg-rose-950/50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? '注册中...' : '完成注册'}
              </button>
              <button type="button" onClick={() => setStep('form')} className="w-full text-slate-400 text-sm py-2">
                ← 修改信息
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <span className="text-slate-500 text-sm">已有账号？</span>
            <Link to="/auth/login" className="text-primary-light text-sm font-medium ml-1">直接登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
