import { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, EChartsType } from 'echarts';
import type { TrendPoint } from '../../types';

interface RevenueChartProps {
  data: TrendPoint[];
  period: '7d' | '30d' | '90d';
  onPeriodChange: (period: '7d' | '30d' | '90d') => void;
}

function formatCurrency(value: number) {
  return `¥${(value / 10000).toFixed(1)}万`;
}

export function RevenueChart({ data, period, onPeriodChange }: RevenueChartProps) {
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const option = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params as Array<{ axisValue: string; data: number }> : [];
        const first = list[0];
        if (!first) return '';
        return `${first.axisValue}<br/>营收：${formatCurrency(Number(first.data || 0))}`;
      },
    },
    grid: { left: 40, right: 12, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: data.map((d) => d.date) },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatCurrency(value),
      },
    },
    series: [{
      name: '营收',
      type: 'line',
      smooth: true,
      data: data.map((d) => d.amount ?? 0),
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(99,102,241,0.35)' },
            { offset: 1, color: 'rgba(99,102,241,0.02)' },
          ],
        },
      },
      lineStyle: { width: 3, color: '#6366f1' },
      itemStyle: { color: '#6366f1' },
    }],
  }), [data]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-slate-800">营收趋势</h3>
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
        <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">暂无营收数据</div>
      ) : (
        <ReactECharts option={option} style={{ height: 320 }} onChartReady={(chart) => { chartRef.current = chart; }} />
      )}
    </div>
  );
}
