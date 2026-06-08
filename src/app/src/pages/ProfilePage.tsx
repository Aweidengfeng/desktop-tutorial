import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Avatar } from '../components/ui/Common';
import { useAuth } from '../context/AuthContext';

const MENU_ITEMS = [
  { icon: 'terrain',       label: '我的登顶',   to: '/profile/summits' },
  { icon: 'route',         label: '轨迹记录',   to: '/profile/tracks' },
  { icon: 'military_tech', label: '我的徽章',   to: '/profile/badges' },
  { icon: 'inventory_2',   label: '装备清单',   to: '/profile/gear' },
  { icon: 'local_hospital',label: '医疗信息',   to: '/profile/medical' },
  { icon: 'emergency',     label: '紧急联系人', to: '/profile/emergency' },
  { icon: 'settings',      label: '设置',       to: '/profile/settings' },
  { icon: 'help_outline',  label: '帮助与反馈', to: '/profile/help' },
] as const;

export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <AppShell title="我的">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-slate-600 text-4xl">person</span>
          </div>
          <p className="text-slate-300 font-medium mb-1">登录后查看个人资料</p>
          <p className="text-slate-500 text-sm mb-6">追踪攀登记录，认识志同道合的伙伴</p>
          <button
            onClick={() => navigate('/auth/login')}
            className="px-8 py-3 bg-primary hover:bg-primary-light text-white rounded-xl font-medium transition-colors"
          >
            立即登录
          </button>
          <button
            onClick={() => navigate('/auth/register')}
            className="mt-3 px-8 py-3 text-primary-light text-sm"
          >
            注册账号
          </button>
        </div>
      </AppShell>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <AppShell title="我的">
      {/* Profile header */}
      <section className="px-4 py-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar src={user?.avatar} name={user?.nickname || user?.username} size="lg" />
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xs">edit</span>
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-slate-100">
                {user?.nickname || user?.username || '用户'}
              </h2>
              {user?.bio && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{user.bio}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-1 mt-4 pt-4 border-t border-slate-800 text-center">
            <div>
              <p className="text-lg font-bold text-slate-100">{user?.summitCount ?? 0}</p>
              <p className="text-xs text-slate-500">登顶</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-100">{user?.followersCount ?? 0}</p>
              <p className="text-xs text-slate-500">粉丝</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-100">{user?.followingCount ?? 0}</p>
              <p className="text-xs text-slate-500">关注</p>
            </div>
          </div>
        </div>
      </section>

      {/* Menu */}
      <section className="px-4 pb-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
          {MENU_ITEMS.map(({ icon, label, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-800 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary-light text-xl">{icon}</span>
              <span className="text-sm text-slate-200 flex-1">{label}</span>
              <span className="material-symbols-outlined text-slate-600 text-lg">chevron_right</span>
            </button>
          ))}
        </div>
      </section>

      {/* Logout */}
      <section className="px-4 pb-8">
        <button
          onClick={handleLogout}
          className="w-full py-3.5 bg-rose-950/40 border border-rose-900 text-rose-400 rounded-2xl text-sm font-medium hover:bg-rose-950/60 transition-colors"
        >
          退出登录
        </button>
      </section>
    </AppShell>
  );
}
