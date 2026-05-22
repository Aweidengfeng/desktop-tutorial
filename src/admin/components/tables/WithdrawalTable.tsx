import { useMemo, useState } from 'react';
import type { WithdrawalStats } from '../../types';

interface WithdrawalTableProps {
  data: WithdrawalStats;
  compact?: boolean;
}

type FilterValue = 'all' | 'pending' | 'approved' | 'rejected';

const statusLabel: Record<Exclude<FilterValue, 'all'>, string> = {
  pending: '待审批',
  approved: '已审批',
  rejected: '已拒绝',
};

const statusStyle: Record<Exclude<FilterValue, 'all'>, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

function money(v: number) {
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

export function WithdrawalTable({ data, compact = false }: WithdrawalTableProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [page, setPage] = useState(1);
  const size = compact ? 5 : 10;

  const filtered = useMemo(
    () => data.requests.filter((item) => filter === 'all' || item.status === filter),
    [data.requests, filter]
  );

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const rows = filtered.slice((page - 1) * size, page * size);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-slate-800">提现申请</h3>
        <div className="flex gap-2 text-xs">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setFilter(value); setPage(1); }}
              className={`rounded-md px-2 py-1 ${filter === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {value === 'all' ? '全部' : statusLabel[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-2">ID</th><th className="px-2 py-2">申请人</th><th className="px-2 py-2">金额</th>
              <th className="px-2 py-2">手续费</th><th className="px-2 py-2">实到</th><th className="px-2 py-2">账户</th>
              <th className="px-2 py-2">状态</th><th className="px-2 py-2">申请时间</th><th className="px-2 py-2">备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-2 py-6 text-center text-slate-400" colSpan={9}>暂无数据</td></tr>
            ) : rows.map((item) => {
              const statusKey = (item.status as Exclude<FilterValue, 'all'>) ?? 'pending';
              return (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{item.id}</td>
                  <td className="px-2 py-2">{item.owner_type}/{item.owner_id}</td>
                  <td className="px-2 py-2">{money(item.amount)}</td>
                  <td className="px-2 py-2">{money(item.fee)}</td>
                  <td className="px-2 py-2">{money(item.actual_amount)}</td>
                  <td className="px-2 py-2">{item.account_type}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded px-2 py-0.5 ${statusStyle[statusKey]}`}>
                      {statusLabel[statusKey] ?? item.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">{new Date(item.created_at).toLocaleString('zh-CN')}</td>
                  <td className="px-2 py-2">{item.note ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded bg-slate-100 px-2 py-1">上一页</button>
        <span>{page}/{pages}</span>
        <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} className="rounded bg-slate-100 px-2 py-1">下一页</button>
      </div>
    </div>
  );
}
