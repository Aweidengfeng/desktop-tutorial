interface HeaderProps {
  pendingCount: number;
  adminName: string;
  currentLabel: string;
  onToggleSidebar: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export function Header({ pendingCount, adminName, currentLabel, onToggleSidebar, onRefresh, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleSidebar} className="rounded p-2 hover:bg-slate-100 lg:hidden">☰</button>
        <span className="text-sm text-slate-500">后台 / <b className="text-slate-700">{currentLabel}</b></span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <button type="button" onClick={onRefresh} className="rounded-md bg-slate-100 px-2 py-1">刷新</button>
        <span className="relative rounded-md bg-slate-100 px-2 py-1">🔔{pendingCount > 0 && <b className="ml-1 text-rose-600">{pendingCount}</b>}</span>
        <span className="hidden text-slate-700 md:inline">{adminName}</span>
        <button type="button" onClick={onLogout} className="rounded-md bg-rose-50 px-2 py-1 text-rose-600">退出</button>
      </div>
    </header>
  );
}
