import { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, EChartsType } from 'echarts';
import type { SosStats } from '../../types';

interface SosChartProps {
  data: SosStats;
}

const statusMap: Record<string, string> = {
  pending: '待处理',
  resolved: '已处理',
  rejected: '已拒绝',
};

export function SosChart({ data }: SosChartProps) {
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    data.monthly.forEach((item) => {
      map.set(item.status, (map.get(item.status) ?? 0) + item.count);
    });
    return Array.from(map.entries()).map(([status, count]) => ({
      name: statusMap[status] ?? status,
      value: count,
    }));
  }, [data.monthly]);

  const option = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['40%', '45%'],
      data: pieData,
      label: { formatter: '{b}: {d}%' },
    }],
  }), [pieData]);

  return (
    <div className="grid gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 md:grid-cols-[1.1fr_1fr]">
      <div>
        <h3 className="mb-3 font-medium text-slate-800">SOS 告警统计</h3>
        {pieData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">暂无 SOS 统计</div>
        ) : (
          <ReactECharts option={option} style={{ height: 260 }} onChartReady={(chart) => { chartRef.current = chart; }} />
        )}
      </div>
      <div>
        <h4 className="mb-3 text-sm font-medium text-slate-700">最近告警</h4>
        <div className="max-h-[260px] space-y-2 overflow-auto">
          {data.recent.length === 0 ? (
            <p className="text-sm text-slate-400">暂无记录</p>
          ) : data.recent.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">#{item.id}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5">{statusMap[item.status] ?? item.status}</span>
              </div>
              <p className="mt-1 text-slate-500">{new Date(item.created_at).toLocaleString('zh-CN')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
