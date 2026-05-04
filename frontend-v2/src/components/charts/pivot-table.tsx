'use client';
import { useMemo } from 'react';

interface Props {
  columns: string[];
  rows: any[][];
  rowField?: number;   // which column to use for row headers (0-indexed)
  colField?: number;   // which column to use for column headers
  valueField?: number; // which column to aggregate
}

export function PivotTable({ columns, rows, rowField = 0, colField = 1, valueField }: Props) {
  const valIdx = valueField ?? (columns.length - 1);
  const pivot = useMemo(() => {
    const rowVals = new Map<string, Map<string, { sum: number; count: number }>>();
    const colSet = new Set<string>();

    rows.forEach(r => {
      const rk = String(r[rowField] ?? '');
      const ck = String(r[colField] ?? '');
      const v = parseFloat(r[valIdx]) || 0;
      colSet.add(ck);
      if (!rowVals.has(rk)) rowVals.set(rk, new Map());
      const inner = rowVals.get(rk)!;
      const prev = inner.get(ck) || { sum: 0, count: 0 };
      inner.set(ck, { sum: prev.sum + v, count: prev.count + 1 });
    });

    const sortedCols = [...colSet].sort();
    const result: { rowHeader: string; cells: (number | null)[]; total: number }[] = [];
    let grandTotal = 0;

    [...rowVals.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([rk, inner]) => {
      const cells = sortedCols.map(ck => {
        const val = inner.get(ck);
        return val ? val.sum : null;
      });
      const total = cells.reduce((s: number, v) => s + (v ?? 0), 0);
      grandTotal += total;
      result.push({ rowHeader: rk, cells, total });
    });

    // Totals row
    const totalsRow: number[] = sortedCols.map(ck => {
      let t = 0;
      result.forEach(r => {
        const idx = sortedCols.indexOf(ck);
        const cellVal = r.cells[idx];
        t += cellVal ?? 0;
      });
      return t;
    });

    return { colHeaders: sortedCols, rows: result, totalsRow, grandTotal };
  }, [rows, rowField, colField, valIdx]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-hover">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted sticky left-0 bg-surface-hover z-10">
              {columns[rowField]} / {columns[colField]}
            </th>
            {pivot.colHeaders.map(ch => (
              <th key={ch} className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted">
                {ch}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted bg-primary/5">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pivot.rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-hover/50">
              <td className="px-4 py-2.5 text-sm font-medium sticky left-0 bg-surface">{r.rowHeader}</td>
              {r.cells.map((v, j) => (
                <td key={j} className="px-4 py-2.5 text-sm text-right font-mono tabular-nums">
                  {v !== null ? v.toLocaleString() : <span className="text-muted">—</span>}
                </td>
              ))}
              <td className="px-4 py-2.5 text-sm text-right font-mono font-semibold bg-primary/5">{r.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface-hover font-semibold">
            <td className="px-4 py-3 text-sm sticky left-0 bg-surface-hover">Total</td>
            {pivot.totalsRow.map((v, j) => (
              <td key={j} className="px-4 py-3 text-sm text-right font-mono">{v.toLocaleString()}</td>
            ))}
            <td className="px-4 py-3 text-sm text-right font-mono bg-primary/5">{pivot.grandTotal.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
