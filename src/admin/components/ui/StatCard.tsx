import { LoadingSkeleton } from './LoadingSkeleton';

interface StatCardProps {
  title: string;
  value: string | number;
  subLabel?: string;
  subValue?: string | number;
  icon: string;
  color?: 'indigo' | 'green' | 'amber' | 'red' | 'purple' | 'sky';
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  onClick?: () => void;
}

const colorMap: Record<NonNullable<StatCardProps['color']>, string> = {
  indigo: 'bg-indigo-100 text-indigo-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
  sky: 'bg-sky-100 text-sky-700',
};

const trendMap = {
  up: '↗',
  down: '↘',
  neutral: '→',
};

export function StatCard({
  title,
  value,
  subLabel,
  subValue,
  icon,
  color = 'indigo',
  trend = 'neutral',
  loading = false,
  onClick,
}: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="stat-card w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 disabled:cursor-default"
      disabled={!onClick}
    >
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`rounded-lg px-2 py-1 text-lg ${colorMap[color]}`}>{icon}</span>
      </div>
      {loading ? (
        <>
          <LoadingSkeleton className="mb-2 h-8 w-3/4" />
          <LoadingSkeleton className="h-4 w-1/2" />
        </>
      ) : (
        <>
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
          {(subLabel || subValue !== undefined) && (
            <p className="mt-1 text-xs text-slate-500">
              {subLabel} {subValue}
              <span className="ml-2">{trendMap[trend]}</span>
            </p>
          )}
        </>
      )}
    </button>
  );
}
