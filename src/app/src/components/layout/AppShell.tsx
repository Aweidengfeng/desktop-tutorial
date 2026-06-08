import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  /** 页面标题，显示在顶部 header */
  title?: string;
  /** 是否显示底部导航（默认 true） */
  showNav?: boolean;
  /** 顶部右侧操作按钮 */
  headerRight?: ReactNode;
}

export function AppShell({ children, title, showNav = true, headerRight }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-dvh bg-slate-950">
      {/* Header */}
      {title !== undefined && (
        <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
          <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
            <h1 className="text-base font-semibold text-slate-100">{title}</h1>
            {headerRight && <div>{headerRight}</div>}
          </div>
        </header>
      )}

      {/* Main content — bottom padding = nav height */}
      <main className={`flex-1 overflow-y-auto ${showNav ? 'pb-20' : ''}`}>
        <div className="max-w-lg mx-auto">
          {children}
        </div>
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}
