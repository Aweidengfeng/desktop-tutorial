import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-2xl">
        <h1 className="text-center text-2xl font-bold text-indigo-300">SummitLink Admin</h1>
        <p className="mt-1 text-center text-sm text-slate-400">后台管理登录</p>
        <input className="mt-6 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="mt-3 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2" type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button disabled={loading} className="mt-4 w-full rounded-md bg-indigo-600 py-2 font-medium hover:bg-indigo-500 disabled:opacity-60" type="submit">
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
