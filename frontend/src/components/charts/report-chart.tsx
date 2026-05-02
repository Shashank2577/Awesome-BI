'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  ScatterChart, Scatter, ZAxis, Legend,
} from 'recharts';
import type { VisualizationType } from '@/lib/types';

const COLORS = ['#2563EB', '#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899'];

interface ReportChartProps {
  type: VisualizationType;
  columns: string[];
  rows: (string | number | null)[][];
}

function prepareChartData(columns: string[], rows: (string | number | null)[][]): any[] {
  return rows.map((row) => {
    const item: Record<string, any> = {};
    columns.forEach((col, idx) => {
      const val = row[idx];
      // Try to parse as number for chart rendering
      if (val !== null && val !== undefined) {
        const num = Number(val);
        item[col] = isNaN(num) ? val : num;
      } else {
        item[col] = val;
      }
    });
    return item;
  });
}

export function ReportChart({ type, columns, rows }: ReportChartProps) {
  const data = prepareChartData(columns, rows);

  if (type === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left font-semibold text-textSecondary">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border hover:bg-background transition-colors">
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="px-4 py-2.5 whitespace-nowrap">
                    {cell === null || cell === undefined ? (
                      <span className="text-textSecondary italic">null</span>
                    ) : typeof cell === 'number' ? (
                      <span className="font-mono tabular-nums">{cell.toLocaleString()}</span>
                    ) : (
                      String(cell)
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

  // For charts, figure out which columns are numeric vs categorical
  const firstCol = columns[0];
  const numericCols = columns.filter((col, idx) => {
    return rows.some((row) => typeof row[idx] === 'number' || !isNaN(Number(row[idx])));
  });

  // If single numeric column, use the first col as label
  const dataKey = numericCols.length > 0 ? numericCols[numericCols.length > 1 ? 1 : 0] : columns[1] || columns[0];

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={firstCol} tick={{ fontSize: 12 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Legend />
          {numericCols.map((col, idx) => (
            <Bar key={col} dataKey={col} fill={COLORS[idx % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={firstCol} tick={{ fontSize: 12 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Legend />
          {numericCols.map((col, idx) => (
            <Line key={col} type="monotone" dataKey={col} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={firstCol} tick={{ fontSize: 12 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Legend />
          {numericCols.map((col, idx) => (
            <Area key={col} type="monotone" dataKey={col} fill={COLORS[idx % COLORS.length]} stroke={COLORS[idx % COLORS.length]} fillOpacity={0.15} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'pie') {
    const pieCol = numericCols[0] || columns[1] || columns[0];
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey={pieCol}
            nameKey={firstCol}
            cx="50%"
            cy="50%"
            outerRadius={140}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'scatter') {
    const scatYCol = numericCols[0] || columns[1] || columns[0];
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={firstCol} tick={{ fontSize: 12 }} name={firstCol} />
          <YAxis dataKey={scatYCol} tick={{ fontSize: 12 }} name={scatYCol} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Scatter data={data} fill={COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-textSecondary">Unsupported chart type: {type}</p>;
}
