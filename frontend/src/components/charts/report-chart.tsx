'use client';

import { useMemo, useRef, useCallback } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, TitleComponent, LegendComponent,
  ToolboxComponent, DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, LineChart, PieChart, ScatterChart,
  GridComponent, TooltipComponent, TitleComponent, LegendComponent,
  ToolboxComponent, DataZoomComponent, CanvasRenderer,
]);

import type { VisualizationType } from '@/lib/types';

const COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2',
  '#4F46E5', '#BE185D', '#B45309', '#15803D', '#0E7490', '#6D28D9',
  '#E11D48', '#D97706', '#059669', '#0284C7', '#5B21B6', '#9D174D',
];

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

interface ReportChartProps {
  type: VisualizationType;
  columns: string[];
  rows: (string | number | null)[][];
  onChartReady?: (getImage: () => Promise<string | null>) => void;
}

function detectMetrics(columns: string[], rows: (string | number | null)[][]) {
  const numericIdx: number[] = [];
  columns.forEach((_, idx) => {
    const hasNum = rows.some((r) => {
      const v = r[idx];
      return v !== null && v !== undefined && !isNaN(Number(v)) && typeof v !== 'boolean';
    });
    if (hasNum) numericIdx.push(idx);
  });
  // Category = first column; metrics = rest of numeric columns (excluding first if it's numeric and there are others)
  const catIdx = 0;
  const metricIdx = numericIdx.filter((i) => i !== catIdx);
  return { catIdx, metricIdx: metricIdx.length > 0 ? metricIdx : (numericIdx.length > 1 ? [numericIdx[numericIdx.length - 1]] : numericIdx) };
}

export function ReportChart({ type, columns, rows, onChartReady }: ReportChartProps) {
  const chartRef = useRef<any>(null);

  const getChartImage = useCallback(async (): Promise<string | null> => {
    const instance = chartRef.current?.getEchartsInstance?.();
    if (!instance) return null;
    return instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  }, []);

  // Expose image capture to parent
  useMemo(() => {
    if (onChartReady) onChartReady(getChartImage);
  }, [onChartReady, getChartImage]);

  const { catIdx, metricIdx } = useMemo(() => detectMetrics(columns, rows), [columns, rows]);
  const catCol = columns[catIdx] || columns[0];
  const metricCols = metricIdx.map((i) => columns[i]);
  const primaryMetric = metricCols[0] || columns[columns.length - 1] || columns[0];

  const categories = useMemo(() => rows.map((r) => String(r[catIdx] ?? '')), [rows, catIdx]);

  const baseTooltip = {
    trigger: 'axis' as const,
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    textStyle: { color: '#F1F5F9', fontSize: 13 },
    axisPointer: { type: 'shadow' as const },
  };

  const baseGrid = { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true };

  // ── TABLE ──
  if (type === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover">
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-textSecondary">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-surface-hover/50 transition-colors">
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="px-4 py-2.5 text-sm">
                    {cell === null || cell === undefined ? (
                      <span className="text-textSecondary italic text-xs">—</span>
                    ) : (
                      <span className={typeof cell === 'number' ? 'font-mono tabular-nums' : ''}>
                        {typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── BAR ──
  if (type === 'bar') {
    const option = {
      color: COLORS,
      tooltip: baseTooltip,
      legend: { top: 0, textStyle: { color: '#64748B', fontSize: 12 }, icon: 'circle', itemWidth: 8, itemHeight: 8 },
      grid: baseGrid,
      toolbox: { feature: { saveAsImage: { title: 'Save' } } },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: '#64748B', fontSize: 11, rotate: categories.length > 12 ? 35 : 0, interval: categories.length > 30 ? Math.floor(categories.length / 15) : 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => formatNumber(v) },
        splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
      },
      series: metricCols.map((col, idx) => ({
        name: col,
        type: 'bar',
        data: rows.map((r) => {
          const v = r[columns.indexOf(col)];
          return v === null || v === undefined ? null : Number(v);
        }),
        barMaxWidth: 48,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
      })),
    };
    return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: Math.max(350, Math.min(500, rows.length * 30)) }} />;
  }

  // ── LINE ──
  if (type === 'line') {
    const option = {
      color: COLORS,
      tooltip: baseTooltip,
      legend: { top: 0, textStyle: { color: '#64748B', fontSize: 12 }, icon: 'roundRect', itemWidth: 14, itemHeight: 4 },
      grid: baseGrid,
      toolbox: { feature: { saveAsImage: { title: 'Save' } } },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: '#64748B', fontSize: 11, rotate: categories.length > 12 ? 35 : 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => formatNumber(v) },
        splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
      },
      series: metricCols.map((col, idx) => ({
        name: col,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2.5 },
        data: rows.map((r) => {
          const v = r[columns.indexOf(col)];
          return v === null || v === undefined ? null : Number(v);
        }),
      })),
    };
    return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: Math.max(350, Math.min(500, rows.length * 30)) }} />;
  }

  // ── AREA ──
  if (type === 'area') {
    const option = {
      color: COLORS,
      tooltip: baseTooltip,
      legend: { top: 0, textStyle: { color: '#64748B', fontSize: 12 }, icon: 'rect', itemWidth: 14, itemHeight: 10 },
      grid: baseGrid,
      toolbox: { feature: { saveAsImage: { title: 'Save' } } },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: '#64748B', fontSize: 11, rotate: categories.length > 12 ? 35 : 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => formatNumber(v) },
        splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
      },
      series: metricCols.map((col, idx) => ({
        name: col,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.12 },
        data: rows.map((r) => {
          const v = r[columns.indexOf(col)];
          return v === null || v === undefined ? null : Number(v);
        }),
      })),
    };
    return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: Math.max(350, Math.min(500, rows.length * 30)) }} />;
  }

  // ── PIE ──
  if (type === 'pie') {
    const pieData = rows.map((r, i) => ({
      name: String(r[catIdx] ?? ''),
      value: Number(r[columns.indexOf(primaryMetric)]) || 0,
    }));
    const option = {
      color: COLORS,
      tooltip: { trigger: 'item' as const, backgroundColor: '#1E293B', borderColor: '#334155', textStyle: { color: '#F1F5F9', fontSize: 13 } },
      legend: { top: 'bottom', textStyle: { color: '#64748B', fontSize: 11 }, type: 'scroll' as const },
      toolbox: { feature: { saveAsImage: { title: 'Save' } } },
      series: [{
        name: primaryMetric,
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {d}%', fontSize: 11 },
        emphasis: { label: { fontSize: 14, fontWeight: 'bold' } },
        data: pieData,
      }],
    };
    return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: 420 }} />;
  }

  // ── SCATTER ──
  if (type === 'scatter') {
    const scatterData = rows.map((r) => {
      const x = Number(r[catIdx]);
      const y = Number(r[columns.indexOf(primaryMetric)]);
      return isNaN(x) || isNaN(y) ? null : [x, y];
    }).filter(Boolean);
    const option = {
      color: COLORS,
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        textStyle: { color: '#F1F5F9', fontSize: 13 },
        formatter: (params: any) => `${catCol}: ${params.value[0]}<br/>${primaryMetric}: ${params.value[1].toLocaleString()}`,
      },
      legend: { top: 0, textStyle: { color: '#64748B', fontSize: 12 } },
      grid: baseGrid,
      toolbox: { feature: { saveAsImage: { title: 'Save' } } },
      xAxis: { type: 'value', name: catCol, nameTextStyle: { color: '#64748B', fontSize: 12 }, axisLabel: { color: '#64748B', fontSize: 11 }, splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } } },
      yAxis: { type: 'value', name: primaryMetric, nameTextStyle: { color: '#64748B', fontSize: 12 }, axisLabel: { color: '#64748B', fontSize: 11, formatter: (v: number) => formatNumber(v) }, splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } } },
      series: [{
        name: `${catCol} vs ${primaryMetric}`,
        type: 'scatter',
        data: scatterData,
        symbolSize: 10,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
      }],
    };
    return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: 400 }} />;
  }

  return null;
}
