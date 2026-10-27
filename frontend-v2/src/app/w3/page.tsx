'use client';
import { useState } from 'react';
import { Loader2, Play, ClipboardList } from 'lucide-react';

const DATASOURCE_ID = 'b2588000-3eda-436d-b0f2-427612a7dfbf';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const BASE_SELECT = `SELECT
  t.LNAME                  AS [Employer],
  e.EMPLOYERTAXID          AS [EIN],
  e.TAXYEAR                AS [Tax Year],
  e.NUMBEROFW2S            AS [W3 # W2s],
  e.W3GROSSWAGES           AS [W3 Wages],
  e.W3WITHHOLDINGS         AS [W3 Withholdings],
  e.REPORTEDWH             AS [W3 Liability],
  e.YTDWITHHOLDINGPAYMENTS AS [WH Payments],
  e.YTDREFUNDS             AS [Refunds],
  e.ADJUSTMENTS            AS [Adjustments],
  e.ASSESSMENTS            AS [Assessments],
  e.CURRENTBALANCE         AS [Balance Due],
  e.ASSESSMENTBALANCE      AS [Assessment Balance],
  e.PENALTY_CHARGED        AS [Penalty],
  e.INTEREST_CHARGED       AS [Interest],
  e.FEES                   AS [Fees],
  e.PAYMENTFREQUENCY       AS [Pay Freq],
  e.TRANSACTIONNUMBER      AS [Transaction #],
  e.RESIDENCY              AS [Residency],
  e.RECORDSTATUS           AS [Record Status],
  e.BANKRUPT               AS [Bankrupt],
  e.DUEDATE                AS [Due Date],
  e.RECEIVED               AS [Date Received],
  e.STARTDATE              AS [Started],
  e.STOPDATE               AS [Stopped],
  e.W3POSTDATE             AS [W3 Post Date],
  e.W3POSTSTATUS           AS [W3 Post Status]
FROM EMPLOYER e
JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID`;

function buildSql(ein: string, year: string): string {
  const where = ein.trim()
    ? `WHERE e.EMPLOYERTAXID = '${ein.trim().replace(/'/g, "''")}' AND e.TAXYEAR = '${year}'`
    : `WHERE e.TAXYEAR = '${year}'`;
  return `${BASE_SELECT}\n${where}\nORDER BY t.LNAME`;
}

export default function W3Page() {
  const [ein, setEin] = useState('');
  const [year, setYear] = useState('2024');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ columns: string[]; rows: any[][]; row_count: number } | null>(null);

  async function runQuery() {
    setLoading(true);
    setError(null);
    setResult(null);

    const sql = buildSql(ein, year);
    const url = `${API}/query/run?datasource_id=${encodeURIComponent(DATASOURCE_ID)}&sql=${encodeURIComponent(sql)}`;

    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(body.detail || 'Query failed');
      }
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">W3 Employer Withholdings</h1>
          <p className="mt-1 text-muted">City of Dublin — CTTRAIN Database</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-sm font-medium">EIN</label>
            <input
              type="text"
              value={ein}
              onChange={e => setEin(e.target.value)}
              placeholder="All employers"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={e => { if (e.key === 'Enter') runQuery(); }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tax Year</label>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
            </select>
          </div>

          <button
            onClick={runQuery}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Query
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium">
              {result.row_count ?? result.rows?.length ?? 0} row{(result.row_count ?? result.rows?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {result.rows && result.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {result.columns.map((col: string) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row: any[], i: number) => (
                    <tr key={i} className="border-b border-border hover:bg-surface-hover">
                      {row.map((cell: any, j: number) => (
                        <td key={j} className="whitespace-nowrap px-3 py-1.5 text-xs">
                          {cell === null || cell === undefined
                            ? <span className="text-muted italic">—</span>
                            : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted">No records found for the selected filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
