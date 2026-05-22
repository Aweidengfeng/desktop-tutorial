import { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, EChartsType } from 'echarts';
import type { PeakTop } from '../../types';

interface PeaksRankChartProps {
  data: PeakTop[];
}

export function PeaksRankChart({ data }: PeaksRankChartProps) {
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const option = useMemo<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const row = Array.isArray(params) ? params[0] as { name: string; value: number; dataIndex: number } : null;
        if (!row) return '';
        const info = data[row.dataIndex];
        return `${row.name}<br/>海拔 ${info?.altitude ?? 0}m · ${info?.country ?? '-'}<br/>登顶 ${row.value}`;
      },
    },
    grid: { left: 90, right: 20, top: 20, bottom: 20 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: data.map((d) => d.name) },
    series: [{
      type: 'bar',
      data: data.map((d) => d.summit_count),
      itemStyle: { color: '#6366f1' },
      barMaxWidth: 18,
    }],
  }), [data]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 font-medium text-slate-800">热门山峰排行</h3>
      {data.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">暂无排行数据</div>
      ) : (
        <ReactECharts option={option} style={{ height: 300 }} onChartReady={(chart) => { chartRef.current = chart; }} />
      )}
    </div>
  );
}
