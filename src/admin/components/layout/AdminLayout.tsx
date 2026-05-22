import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export function AdminLayout({
  children,
  pendingCount,
  onRefresh,
}: {
  children: ReactNode;
  pendingCount: number;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const currentLabel = useMemo(() => {
    const segment = location.pathname.replace('/', '') || 'dashboard';
    return segment === 'dashboard' ? '数据总览' : '模块';
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        onLogout={async () => {
          await logout();
          navigate('/login');
        }}
      />
      <div className="lg:ml-[240px]">
        <Header
          pendingCount={pendingCount}
          adminName={user?.username ?? user?.name ?? '管理员'}
          currentLabel={currentLabel}
          onToggleSidebar={() => setOpen((v) => !v)}
          onRefresh={onRefresh}
          onLogout={async () => { await logout(); navigate('/login'); }}
        />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
