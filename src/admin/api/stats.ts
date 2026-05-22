import { apiClient } from './client';
import type { OverviewStats, PendingStats, PeakTop, SosStats, TrendPoint, WithdrawalStats } from '../types';

const periodDays: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 };

function sumByDate(rows: TrendPoint[]): TrendPoint[] {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const prev = map.get(row.date) ?? 0;
    map.set(row.date, prev + (row.amount ?? 0));
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
}

export async function fetchOverview(): Promise<OverviewStats> {
  const { data } = await apiClient.get<OverviewStats>('/api/admin/stats/overview');
  return data;
}

export async function fetchPending(): Promise<PendingStats> {
  const { data } = await apiClient.get<PendingStats>('/api/admin/stats/pending');
  return data;
}

export async function fetchRevenueTrend(period: '7d' | '30d' | '90d'): Promise<TrendPoint[]> {
  const { data } = await apiClient.get<TrendPoint[]>('/api/admin/stats/revenue', { params: { period } });
  return sumByDate(Array.isArray(data) ? data : []);
}

export async function fetchUserTrend(period: '7d' | '30d' | '90d'): Promise<TrendPoint[]> {
  const { data } = await apiClient.get<TrendPoint[]>('/api/admin/stats/users', { params: { period } });
  return Array.isArray(data) ? data : [];
}

export async function fetchSosStats(): Promise<SosStats> {
  const { data } = await apiClient.get<SosStats>('/api/admin/stats/sos');
  return data;
}

export async function fetchPeaksTop(limit = 10): Promise<PeakTop[]> {
  const { data } = await apiClient.get<PeakTop[]>('/api/admin/stats/peaks/top', { params: { limit } });
  return Array.isArray(data) ? data : [];
}

interface WithdrawalRaw {
  pending: number;
  approved: number;
  rejected: number;
  amounts?: Record<string, number>;
  requests: WithdrawalStats['requests'];
}

export async function fetchWithdrawals(page = 1): Promise<WithdrawalStats> {
  const { data } = await apiClient.get<WithdrawalRaw>('/api/admin/stats/withdrawals', { params: { page, size: 20 } });
  const requests = Array.isArray(data.requests) ? data.requests : [];
  const size = 20;
  const total = requests.length;
  return {
    summary: {
      pending: { count: data.pending ?? 0, amount: data.amounts?.pending ?? 0 },
      approved: { count: data.approved ?? 0, amount: data.amounts?.approved ?? 0 },
      rejected: { count: data.rejected ?? 0, amount: data.amounts?.rejected ?? 0 },
    },
    requests,
    pagination: {
      page,
      size,
      total,
      pages: Math.max(1, Math.ceil(total / size)),
    },
  };
}

export async function fetchPostsTrend(days = 30): Promise<TrendPoint[]> {
  const { data } = await apiClient.get<TrendPoint[]>('/api/admin/stats/posts/trend', {
    params: { days: Math.min(Math.max(days, 1), periodDays['90d']) },
  });
  return Array.isArray(data) ? data : [];
}
