import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/',          icon: 'home',     label: '首页' },
  { path: '/explore',   icon: 'explore',  label: '探索' },
  { path: '/community', icon: 'groups',   label: '社区' },
  { path: '/profile',   icon: 'person',   label: '我的' },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ path, icon, label }) => {
          const active = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
                active ? 'text-primary-light' : 'text-slate-500'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${active ? 'font-semibold' : ''}`}>
                {icon}
              </span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
