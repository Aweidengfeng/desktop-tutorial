import { useCallback, useMemo, useState } from 'react';
import { fetchOverview, fetchPeaksTop, fetchPending, fetchPostsTrend, fetchRevenueTrend, fetchSosStats, fetchUserTrend, fetchWithdrawals } from '../api/stats';
import type { OverviewStats, PeakTop, PendingStats, SosStats, TrendPoint, WithdrawalStats } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { RevenueChart } from '../components/charts/RevenueChart';
import { UserTrendChart } from '../components/charts/UserTrendChart';
import { PeaksRankChart } from '../components/charts/PeaksRankChart';
import { PendingTasksPanel } from '../components/tables/PendingTasksPanel';
import { SosChart } from '../components/charts/SosChart';
import { WithdrawalTable } from '../components/tables/WithdrawalTable';
import { AdminLayout } from '../components/layout/AdminLayout';
import { useAdminData } from '../hooks/useAdminData';
import { useToast } from '../components/ui/Toast';

interface DashboardData {
  overview: OverviewStats;
  pending: PendingStats;
  revenue: TrendPoint[];
  users: TrendPoint[];
  sos: SosStats;
  peaks: PeakTop[];
  withdrawals: WithdrawalStats;
  postsTrend: TrendPoint[];
}

const emptySos: SosStats = { monthly: [], recent: [] };
const emptyWithdrawal: WithdrawalStats = { summary: {}, requests: [], pagination: { page: 1, size: 20, total: 0, pages: 1 } };

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN');
}

function formatWan(value: number) {
  return `${(value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}万`;
}

function pendingTotal(pending: PendingStats) {
  return pending.guide_applications + pending.club_applications + pending.reported_posts + pending.banned_users;
}

export function DashboardPage() {
  const [revenuePeriod, setRevenuePeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [userPeriod, setUserPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { showToast } = useToast();

  const fetchDashboard = useCallback(async (): Promise<DashboardData> => {
    const [overview, pending, revenue, users, sos, peaks, withdrawals, postsTrend] = await Promise.all([
      fetchOverview(),
      fetchPending(),
      fetchRevenueTrend(revenuePeriod),
      fetchUserTrend(userPeriod),
      fetchSosStats(),
      fetchPeaksTop(10),
      fetchWithdrawals(1),
      fetchPostsTrend(30),
    ]);
    return { overview, pending, revenue, users, sos, peaks, withdrawals, postsTrend };
  }, [revenuePeriod, userPeriod]);

  const { data, loading, error, refresh } = useAdminData<DashboardData>(fetchDashboard, [fetchDashboard], 60000);

  const pendingCount = useMemo(() => pendingTotal(data?.pending ?? { guide_applications: 0, club_applications: 0, reported_posts: 0, banned_users: 0 }), [data?.pending]);

  const doRefresh = useCallback(async () => {
    await refresh();
    showToast('数据已刷新', 'success');
  }, [refresh, showToast]);

  const overview = data?.overview;
  const pending = data?.pending ?? { guide_applications: 0, club_applications: 0, reported_posts: 0, banned_users: 0 };

  return (
    <AdminLayout pendingCount={pendingCount} onRefresh={doRefresh}>
      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="总用户数" value={overview ? formatNumber(overview.users.total) : '--'} subLabel="今日新增" subValue={overview ? formatNumber(overview.users.today) : '--'} icon="👥" color="indigo" loading={loading} trend="up" />
        <StatCard title="GMV 总营收" value={overview ? formatWan(overview.revenue) : '--'} icon="💹" color="green" loading={loading} trend="up" />
        <StatCard title="总订单数" value={overview ? formatNumber(overview.orders) : '--'} icon="📦" color="sky" loading={loading} />
        <StatCard title="待处理事项" value={formatNumber(pendingCount)} icon="⚠️" color="red" loading={loading} trend={pendingCount > 0 ? 'up' : 'neutral'} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="活跃向导数" value={overview ? formatNumber(overview.guides) : '--'} icon="🧗" color="purple" loading={loading} />
        <StatCard title="活跃俱乐部数" value={overview ? formatNumber(overview.clubs) : '--'} icon="🏕️" color="amber" loading={loading} />
        <StatCard title="山峰总数" value={overview ? formatNumber(overview.peaks) : '--'} icon="⛰️" color="sky" loading={loading} />
        <StatCard title="内容帖子数" value={overview ? formatNumber(overview.posts.total) : '--'} subLabel="今日" subValue={overview ? formatNumber(overview.posts.today) : '--'} icon="🧾" color="indigo" loading={loading} />
      </div>

      {loading && !data ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <LoadingSkeleton className="h-[370px] w-full" />
          <LoadingSkeleton className="h-[370px] w-full" />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <RevenueChart data={data?.revenue ?? []} period={revenuePeriod} onPeriodChange={setRevenuePeriod} />
          <UserTrendChart data={data?.users ?? []} period={userPeriod} onPeriodChange={setUserPeriod} />
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2"><PeaksRankChart data={data?.peaks ?? []} /></div>
        <PendingTasksPanel data={pending} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <SosChart data={data?.sos ?? emptySos} />
        <div>
          <WithdrawalTable data={data?.withdrawals ?? emptyWithdrawal} compact />
          <div className="mt-2 text-right">
            <a href="#/applications" className="text-sm text-indigo-600 hover:underline">查看全部</a>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>最后更新时间：{overview ? new Date(overview.generated_at).toLocaleString('zh-CN') : '-'}</span>
        <button type="button" onClick={doRefresh} className="rounded bg-slate-100 px-2 py-1">手动刷新</button>
      </div>
    </AdminLayout>
  );
}
