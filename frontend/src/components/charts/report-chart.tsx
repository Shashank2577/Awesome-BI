'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
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

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

interface ReportChartProps {
  type: VisualizationType;
  columns: string[];
  rows: (string | number | null)[][];
}

function detectChartColumns(columns: string[], rows: (string | number | null)[][]) {
  // Determine which columns are category vs metric
  const numericIdx: number[] = [];
  columns.forEach((_, idx) => {
    const hasNum = rows.some((r) => {
      const v = r[idx];
      return v !== null && v !== undefined && !isNaN(Number(v)) && typeof v !== 'boolean';
    });
    if (hasNum) numericIdx.push(idx);
  });

  // Category = first non-numeric or first column
  const catIdx = numericIdx.includes(0) && columns.length > 2
    ? (numericIdx.length >= 2 ? 0 : 0)
    : 0;

  // Metrics = numeric columns excluding the category column
  const metricIdx = numericIdx.filter((i) => i !== catIdx);

  // If we wrongly identified everything as metric, use first col as category
  if (catIdx === 0 && metricIdx.length === columns.length) {
    return { catIdx: 0, metricIdx: metricIdx.slice(1) };
  }

  return { catIdx, metricIdx: metricIdx.length > 0 ? metricIdx : numericIdx };
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    borderRadius: '10px',
    color: '#F1F5F9',
    fontSize: '13px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    padding: '10px 14px',
  },
  itemStyle: { color: '#E2E8F0', padding: '2px 0' },
  labelStyle: { color: '#94A3B8', fontWeight: 600, marginBottom: '4px' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle.contentStyle}>
      <p style={tooltipStyle.labelStyle}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={tooltipStyle.itemStyle}>
          <span style={{ color: entry.color, fontWeight: 700 }}>● </span>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export function ReportChart({ type, columns, rows }: ReportChartProps) {
  const data = useMemo(() => rows.map((row) => {
    const item: Record<string, any> = {};
    columns.forEach((col, idx) => {
      const val = row[idx];
      item[col] = val !== null && val !== undefined ? val : null;
    });
    return item;
  }), [columns, rows]);

  const { catIdx, metricIdx } = useMemo(() => detectChartColumns(columns, rows), [columns, rows]);
  const catCol = columns[catIdx] || columns[0];
  const metricCols = metricIdx.map((i) => columns[i]);
  const primaryMetric = metricCols[0] || columns[columns.length - 1] || columns[0];

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

  const chartHeight = Math.max(350, Math.min(500, data.length * 30));

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey={catCol}
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            tickFormatter={(v) => truncate(String(v), 18)}
            angle={data.length > 12 ? -35 : 0}
            textAnchor={data.length > 12 ? 'end' : 'middle'}
            height={data.length > 12 ? 60 : 40}
            interval={data.length > 30 ? Math.floor(data.length / 15) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatNumber}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9', opacity: 0.5 }} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            iconType="circle"
            iconSize={8}
          />
          {metricCols.map((col, idx) => (
            <Bar
              key={col}
              dataKey={col}
              name={col}
              fill={COLORS[idx % COLORS.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey={catCol}
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            tickFormatter={(v) => truncate(String(v), 18)}
            angle={data.length > 12 ? -35 : 0}
            textAnchor={data.length > 12 ? 'end' : 'middle'}
            height={data.length > 12 ? 60 : 40}
            interval={data.length > 30 ? Math.floor(data.length / 15) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatNumber}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="line" iconSize={14} />
          {metricCols.map((col, idx) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              name={col}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2.5}
              dot={{ r: 2, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey={catCol}
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            tickFormatter={(v) => truncate(String(v), 18)}
            angle={data.length > 12 ? -35 : 0}
            textAnchor={data.length > 12 ? 'end' : 'middle'}
            height={data.length > 12 ? 60 : 40}
            interval={data.length > 30 ? Math.floor(data.length / 15) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatNumber}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="square" iconSize={10} />
          {metricCols.map((col, idx) => (
            <Area
              key={col}
              type="monotone"
              dataKey={col}
              name={col}
              fill={COLORS[idx % COLORS.length]}
              stroke={COLORS[idx % COLORS.length]}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'pie') {
    // For pie, use first col as name, last numeric as value
    const pieValueCol = primaryMetric;
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey={pieValueCol}
            nameKey={catCol}
            cx="50%"
            cy="45%"
            outerRadius={140}
            innerRadius={40}
            paddingAngle={2}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              (percent ?? 0) > 0.04 ? `${truncate(name ?? '', 15)} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
            }
            labelLine={{ stroke: '#94A3B8', strokeWidth: 1 }}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
            iconType="circle"
            iconSize={8}
            layout="horizontal"
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-textSecondary text-center py-12">Select a chart type to visualize this data</p>;
}
