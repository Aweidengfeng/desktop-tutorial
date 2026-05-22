import { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, EChartsType } from 'echarts';
import type { TrendPoint } from '../../types';

interface UserTrendChartProps {
  data: TrendPoint[];
  period: '7d' | '30d' | '90d';
  onPeriodChange: (period: '7d' | '30d' | '90d') => void;
}

export function UserTrendChart({ data, period, onPeriodChange }: UserTrendChartProps) {
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const daily = data.map((d) => d.count ?? 0);
  const cumulative = daily.reduce<number[]>((acc, current) => {
    const prev = acc[acc.length - 1] ?? 0;
    acc.push(prev + current);
    return acc;
  }, []);

  const option = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增', '累计'] },
    grid: { left: 35, right: 10, top: 30, bottom: 25 },
    xAxis: { type: 'category', data: data.map((d) => d.date) },
    yAxis: { type: 'value' },
    series: [
      { name: '新增', type: 'bar', data: daily, itemStyle: { color: '#38bdf8' }, barMaxWidth: 18 },
      { name: '累计', type: 'line', data: cumulative, smooth: true, itemStyle: { color: '#10b981' } },
    ],
  }), [data, daily, cumulative]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-slate-800">用户增长</h3>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`rounded-md px-2 py-1 text-xs ${period === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              onClick={() => onPeriodChange(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">暂无用户数据</div>
      ) : (
        <ReactECharts option={option} style={{ height: 320 }} onChartReady={(chart) => { chartRef.current = chart; }} />
      )}
    </div>
  );
}
