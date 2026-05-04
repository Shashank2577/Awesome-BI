'use client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percent';
  sparkline?: number[];
}

export function NumberCard({ label, value, previousValue, format = 'number', sparkline }: Props) {
  const change = previousValue != null && previousValue !== 0
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : null;

  const formatted = format === 'currency'
    ? '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : format === 'percent'
    ? value.toFixed(1) + '%'
    : value.toLocaleString();

  const ChangeIcon = change === null ? Minus : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const changeColor = change === null ? 'text-muted' : change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted';

  const maxSpark = sparkline ? Math.max(...sparkline, 1) : 1;

  return (
    <div className="rounded-xl border bg-surface p-5 hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{formatted}</p>
      {change !== null && (
        <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${changeColor}`}>
          <ChangeIcon className="h-4 w-4" />
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
          <span className="text-xs text-muted font-normal ml-1">vs previous</span>
        </div>
      )}
      {sparkline && (
        <div className="mt-3 flex items-end gap-0.5 h-10">
          {sparkline.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-primary/30 hover:bg-primary/50 transition-colors"
              style={{ height: `${Math.max(4, (v / maxSpark) * 100)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
