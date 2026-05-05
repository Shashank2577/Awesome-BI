'use client';
import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Play, Loader2, Table2, BarChart3, Database, Trash2, ArrowUp } from 'lucide-react';
import { ChartViewer } from '@/components/charts/chart-viewer';
import { SQLEditor } from '@/components/charts/sql-editor';
import toast from 'react-hot-toast';

interface FileTable { name: string; columns: string[]; rows: any[][]; }

export default function FilesPage() {
  const [tables, setTables] = useState<FileTable[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [sql, setSql] = useState('SELECT * FROM ');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dbRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initDB = useCallback(async () => {
    if (dbReady) return;
    setLoading(true);
    try {
      const duckdb = await import('@duckdb/duckdb-wasm');
      const JSDELIVR_BUNDLES = {
        mvp: { mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-mvp.wasm', mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-mvp.worker.js' },
      };
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule);
      const conn = await db.connect();
      dbRef.current = db;
      connRef.current = conn;
      setDbReady(true);
      toast.success('DuckDB ready — running in your browser');
    } catch (e: any) {
      toast.error('DuckDB init failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [dbReady]);

  const handleFile = useCallback(async (file: File) => {
    if (!dbReady) await initDB();
    if (!connRef.current) return;
    setLoading(true);
    try {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      const text = await file.text();
      // Parse CSV
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals: string[] = [];
        let cur = '', inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ',' && !inQuotes) { vals.push(cur.trim()); cur = ''; continue; }
          cur += ch;
        }
        vals.push(cur.trim());
        return vals.map(v => {
          const n = Number(v);
          return !isNaN(n) && v !== '' ? n : v.replace(/^"|"$/g, '');
        });
      });

      setTables(prev => [...prev.filter(t => t.name !== name), { name, columns: headers, rows }]);
      setActiveTable(name);
      setSql(`SELECT * FROM ${name}`);
      toast.success(`Loaded ${name}: ${rows.length} rows, ${headers.length} cols`);
    } catch (e: any) {
      toast.error('Parse failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [dbReady, initDB]);

  const runFileQuery = useCallback(async () => {
    if (!activeTable) return;
    const table = tables.find(t => t.name === activeTable);
    if (!table) return;
    setLoading(true);
    try {
      // Simple SQL parser for basic queries on loaded tables
      const query = sql.trim().toUpperCase();
      let cols = table.columns;
      let rows = table.rows;

      if (query.startsWith('SELECT')) {
        const selectPart = query.slice(7, query.indexOf('FROM')).trim();
        const whereIdx = query.indexOf('WHERE');
        const limitIdx = query.indexOf('LIMIT');
        const orderIdx = query.indexOf('ORDER BY');

        // Apply WHERE
        let filtered = rows;
        if (whereIdx > 0) {
          const whereEnd = Math.min(
            limitIdx > 0 ? limitIdx : Infinity,
            orderIdx > 0 ? orderIdx : Infinity
          );
          const whereClause = sql.slice(whereIdx + 6, whereEnd > 0 ? whereEnd : undefined).trim();
          // Simple equality filter
          const eqMatch = whereClause.match(/(\w+)\s*=\s*'?([^'\s]+)'?/);
          if (eqMatch) {
            const colIdx = table.columns.findIndex(c => c.toLowerCase() === eqMatch[1].toLowerCase());
            if (colIdx >= 0) {
              filtered = rows.filter(r => String(r[colIdx]) === eqMatch[2]);
            }
          }
          // Simple comparison
          const cmpMatch = whereClause.match(/(\w+)\s*([><]=?)\s*(\d+)/);
          if (cmpMatch) {
            const colIdx = table.columns.findIndex(c => c.toLowerCase() === cmpMatch[1].toLowerCase());
            const op = cmpMatch[2];
            const val = Number(cmpMatch[3]);
            if (colIdx >= 0) {
              filtered = filtered.filter(r => {
                const v = Number(r[colIdx]);
                return op === '>' ? v > val : op === '<' ? v < val : op === '>=' ? v >= val : op === '<=' ? v <= val : true;
              });
            }
          }
        }

        // Select specific columns
        if (selectPart !== '*') {
          const selCols = selectPart.split(',').map(s => s.trim().toLowerCase());
          const selIdx = selCols.map(sc => table.columns.findIndex(c => c.toLowerCase() === sc)).filter(i => i >= 0);
          if (selIdx.length > 0) {
            cols = selIdx.map(i => table.columns[i]);
            filtered = filtered.map(r => selIdx.map(i => r[i]));
          }
        }

        // ORDER BY
        if (orderIdx > 0) {
          const orderEnd = limitIdx > 0 ? limitIdx : undefined;
          const orderClause = sql.slice(orderIdx + 9, orderEnd).trim().replace(/DESC/i, '').trim().toLowerCase();
          const orderColIdx = table.columns.findIndex(c => c.toLowerCase() === orderClause);
          if (orderColIdx >= 0) {
            const desc = sql.toUpperCase().includes('DESC');
            filtered = [...filtered].sort((a, b) => {
              const av = a[orderColIdx], bv = b[orderColIdx];
              return desc ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
            });
          }
        }

        // LIMIT
        if (limitIdx > 0) {
          const limitVal = parseInt(sql.slice(limitIdx + 6).trim());
          if (limitVal > 0) filtered = filtered.slice(0, limitVal);
        }

        rows = filtered;
      }

      setResult({ columns: cols, rows: rows.slice(0, 1000), row_count: rows.length });
    } catch (e: any) {
      toast.error('Query failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [sql, activeTable, tables]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">File Analysis</h1>
          <p className="mt-1 text-muted">Upload CSV files, query them instantly in your browser. No data leaves your machine.</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
          <Upload className="h-4 w-4"/> Upload CSV
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>

      {/* Drop zone */}
      {tables.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-16 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <FileSpreadsheet className="mx-auto h-16 w-16 text-muted"/>
          <p className="mt-4 text-lg font-medium">Drop a CSV file here</p>
          <p className="mt-1 text-sm text-muted">or click Upload CSV above. DuckDB runs entirely in your browser.</p>
        </div>
      )}

      {/* Table tabs */}
      {tables.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tables.map(t => (
            <button key={t.name} onClick={() => { setActiveTable(t.name); setSql(`SELECT * FROM ${t.name}`); setResult(null); }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${activeTable === t.name ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground'}`}>
              <Database className="h-3.5 w-3.5"/>{t.name}
              <span className="text-xs text-muted">({t.rows.length})</span>
              <button onClick={e => { e.stopPropagation(); setTables(prev => prev.filter(x => x.name !== t.name)); if (activeTable === t.name) setActiveTable(''); }}
                className="ml-1 p-0.5 hover:text-red-600"><Trash2 className="h-3 w-3"/></button>
            </button>
          ))}
        </div>
      )}

      {/* SQL editor */}
      {activeTable && (
        <div className="space-y-4">
          <SQLEditor value={sql} onChange={setSql} onRun={runFileQuery} placeholder={`SELECT * FROM ${activeTable}`} height="120px"/>
          <div className="flex gap-3">
            <button onClick={runFileQuery} disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4"/>} Run Query
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl border bg-surface p-6 animate-fade-in">
          <p className="text-sm text-muted mb-3">{result.row_count} rows</p>
          <ChartViewer type="table" columns={result.columns} rows={result.rows}/>
        </div>
      )}
    </div>
  );
}
