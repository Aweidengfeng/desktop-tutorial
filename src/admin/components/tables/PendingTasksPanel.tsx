import type { PendingStats } from '../../types';

interface PendingTasksPanelProps {
  data: PendingStats;
}

const rows = [
  { key: 'guide_applications', label: '向导申请', href: '#/guides' },
  { key: 'club_applications', label: '俱乐部申请', href: '#/clubs' },
  { key: 'reported_posts', label: '被举报内容', href: '#/content' },
  { key: 'banned_users', label: '封禁用户', href: '#/users' },
] as const;

export function PendingTasksPanel({ data }: PendingTasksPanelProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 font-medium text-slate-800">待处理事项</h3>
      <div className="space-y-2">
        {rows.map((row) => {
          const value = data[row.key];
          return (
            <div key={row.key} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span>{row.label}</span>
                {value > 0 && <span className="rounded-full bg-rose-500 px-2 text-xs text-white">{value}</span>}
              </div>
              <a href={row.href} className="text-xs text-indigo-600 hover:underline">去处理</a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
