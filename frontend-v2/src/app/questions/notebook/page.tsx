'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Database, Filter, Sigma, Group, ArrowRight, ArrowLeft,
  Plus, Trash2, Loader2, Play, Save, BarChart3,
  LineChart, PieChart, AreaChart, ScatterChart,
  Table2, TableProperties, Hash,
  Gauge, FunnelIcon, Columns3, AlignStartHorizontal,
} from 'lucide-react';
import { listDatasources, getSchema, createReport, runRawQuery } from '@/lib/api';
import { SQLEditor } from '@/components/charts/sql-editor';
import toast from 'react-hot-toast';

type Step = 'data' | 'filter' | 'summarize' | 'group' | 'visualize';

interface FilterRule { column: string; operator: string; value: string; }
interface AggregateRule { column: string; function: string; alias: string; }

const AGG_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
const FILTER_OPS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL'];
const VIZ_OPTS = [
  { v: 'table', l: 'Table', i: Table2 }, { v: 'bar', l: 'Bar', i: BarChart3 },
  { v: 'line', l: 'Line', i: LineChart }, { v: 'pie', l: 'Pie', i: PieChart },
  { v: 'area', l: 'Area', i: AreaChart }, { v: 'scatter', l: 'Scatter', i: ScatterChart },
  { v: 'pivot', l: 'Pivot', i: TableProperties }, { v: 'number', l: 'KPI', i: Hash },
  { v: 'gauge', l: 'Gauge', i: Gauge }, { v: 'funnel', l: 'Funnel', i: FunnelIcon },
  { v: 'combo', l: 'Combo', i: Columns3 }, { v: 'row', l: 'Row', i: AlignStartHorizontal },
];

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: 'data', label: 'Pick Data', icon: Database },
  { id: 'filter', label: 'Filter', icon: Filter },
  { id: 'summarize', label: 'Summarize', icon: Sigma },
  { id: 'group', label: 'Group By', icon: Group },
  { id: 'visualize', label: 'Visualize', icon: BarChart3 },
];

export default function NotebookPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: dss } = useQuery({ queryKey: ['datasources'], queryFn: listDatasources });

  const [step, setStep] = useState<Step>('data');
  const [dsId, setDsId] = useState('');
  const [table, setTable] = useState('');
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [aggregates, setAggregates] = useState<AggregateRule[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'ASC'|'DESC'>('ASC');
  const [limit, setLimit] = useState(100);
  const [viz, setViz] = useState('table');
  const [reportName, setReportName] = useState('');
  const [sql, setSql] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: schema, isLoading: schemaLoading, isError: schemaError } = useQuery({
    queryKey: ['schema', dsId],
    queryFn: () => getSchema(dsId),
    enabled: !!dsId,
  });

  const currentTable = schema?.tables?.find((t: any) => t.name === table);
  const columns = currentTable?.columns || [];
  const tablesList = schema?.tables || [];

  // Auto-select first table when schema loads with exactly 1 table
  useEffect(() => {
    if (tablesList.length === 1 && !table) {
      setTable(tablesList[0].name);
    }
  }, [tablesList, table]);

  const buildQuery = useCallback(async () => {
    if (!dsId || !table) return;
    setPreviewLoading(true);
    try {
      let s = 'SELECT ';
      const activeAggs = aggregates.filter(a => a.column && a.column.trim());
      if (activeAggs.length > 0) {
        const ap = activeAggs.map(a => `${a.function}(${a.column}) AS "${a.alias || a.function.toLowerCase()}"`);
        if (groupBy.length > 0) s += groupBy.join(', ') + ', ' + ap.join(', ');
        else s += ap.join(', ');
      } else if (groupBy.length > 0) {
        s += groupBy.join(', ');
      } else { s += '*'; }
      s += ` FROM ${table}`;
      const activeFilters = filters.filter(f => f.column && f.column.trim());
      if (activeFilters.length > 0) {
        const wp = activeFilters.map(f => {
          if (f.operator === 'IS NULL') return `${f.column} IS NULL`;
          if (f.operator === 'IS NOT NULL') return `${f.column} IS NOT NULL`;
          if (f.operator === 'IN') return `${f.column} IN (${f.value})`;
          const val = isNaN(Number(f.value)) ? `'${f.value.replace(/'/g, "''")}'` : f.value;
          return `${f.column} ${f.operator} ${val}`;
        });
        s += ' WHERE ' + wp.join(' AND ');
      }
      if (groupBy.length > 0 && aggregates.length > 0) s += ' GROUP BY ' + groupBy.join(', ');
      if (sortCol) s += ` ORDER BY ${sortCol} ${sortDir}`;
      s += ` LIMIT ${limit}`;
      setSql(s);
      if (dsId && s.trim()) { const r = await runRawQuery(dsId, s); setPreview(r); }
    } catch (e: any) { toast.error(e.message); }
    finally { setPreviewLoading(false); }
  }, [dsId, table, filters, aggregates, groupBy, sortCol, sortDir, limit]);

  const createMut = useMutation({
    mutationFn: () => createReport({ name: reportName || 'Notebook Question', datasource_id: dsId, query: {}, visualization: viz, sql }),
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Saved!'); router.push(`/questions/${d.id}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/questions" className="text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4"/></Link>
        <div><h1 className="text-2xl font-bold">Notebook Editor</h1><p className="text-sm text-muted">Build your question step by step — no SQL required.</p></div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 rounded-lg border bg-surface p-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => setStep(s.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap ${
              step === s.id ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}>
            <s.icon className="h-4 w-4"/>{s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* DATA */}
          {step === 'data' && <div className="rounded-xl border bg-surface p-6 space-y-4">
            <h3 className="font-semibold"><Database className="h-5 w-5 inline mr-2 text-blue-600"/>Pick your data</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-muted">Datasource</label>
                <select value={dsId} onChange={e=>{setDsId(e.target.value);setTable('');}} className="w-full rounded-lg border bg-background px-3 py-2 text-sm mt-1">
                  <option value="">— Select —</option>{(dss||[]).map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="text-xs text-muted">Table {schemaLoading && '(loading...)'}</label>
                <select value={table} onChange={e=>setTable(e.target.value)} disabled={schemaLoading || schemaError || tablesList.length===0} className="w-full rounded-lg border bg-background px-3 py-2 text-sm mt-1 disabled:opacity-50">
                  {schemaLoading && <option>Loading tables...</option>}
                  {schemaError && <option>Failed to load</option>}
                  {!schemaLoading && !schemaError && <option value="">— {tablesList.length} table{tablesList.length!==1?'s':''} —</option>}
                  {!schemaLoading && tablesList.map((t:any)=><option key={t.name} value={t.name}>{t.name} ({t.columns?.length||0} cols)</option>)}
                </select></div>
            </div>
            {table && columns.length > 0 && <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted mb-2">{columns.length} columns</p>
              <div className="flex flex-wrap gap-1.5">{columns.map((c:any)=><span key={c.name} className="rounded border px-2 py-0.5 text-xs"><code className="text-primary">{c.name}</code> <span className="text-muted">{c.type}</span></span>)}</div></div>}
            <button onClick={()=>{if(table)setStep('filter');else toast.error('Pick a table');}} disabled={!table} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Next <ArrowRight className="h-4 w-4 inline"/></button>
          </div>}

          {/* FILTER */}
          {step === 'filter' && <div className="rounded-xl border bg-surface p-6 space-y-4">
            <h3 className="font-semibold"><Filter className="h-5 w-5 inline mr-2 text-amber-600"/>Filter (optional)</h3>
            {filters.map((f,i)=><div key={i} className="flex gap-2">
              <select value={f.column} onChange={e=>{const n=[...filters];n[i].column=e.target.value;setFilters(n);}} className="rounded-lg border bg-background px-2 py-2 text-sm flex-1"><option value="">Column</option>{columns.map((c:any)=><option key={c.name} value={c.name}>{c.name}</option>)}</select>
              <select value={f.operator} onChange={e=>{const n=[...filters];n[i].operator=e.target.value;setFilters(n);}} className="rounded-lg border bg-background px-2 py-2 text-sm w-28">{FILTER_OPS.map(o=><option key={o} value={o}>{o}</option>)}</select>
              {!['IS NULL','IS NOT NULL'].includes(f.operator)&&<input value={f.value} onChange={e=>{const n=[...filters];n[i].value=e.target.value;setFilters(n);}} placeholder="Value" className="rounded-lg border bg-background px-2 py-2 text-sm flex-1"/>}
              <button onClick={()=>setFilters(filters.filter((_,j)=>j!==i))} className="p-2 text-muted hover:text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}
            <button onClick={()=>setFilters([...filters,{column:'',operator:'=',value:''}])} className="text-sm text-primary hover:underline"><Plus className="h-3.5 w-3.5 inline"/> Add filter</button>
            <div className="flex gap-3"><button onClick={()=>setStep('data')} className="rounded-lg border px-4 py-2 text-sm">Back</button><button onClick={()=>setStep('summarize')} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Next</button></div>
          </div>}

          {/* SUMMARIZE */}
          {step === 'summarize' && <div className="rounded-xl border bg-surface p-6 space-y-4">
            <h3 className="font-semibold"><Sigma className="h-5 w-5 inline mr-2 text-violet-600"/>Summarize (optional)</h3>
            {aggregates.map((a,i)=><div key={i} className="flex gap-2">
              <select value={a.function} onChange={e=>{const n=[...aggregates];n[i].function=e.target.value;setAggregates(n);}} className="rounded-lg border bg-background px-2 py-2 text-sm w-32">{AGG_FUNCTIONS.map(fn=><option key={fn} value={fn}>{fn}</option>)}</select>
              <span className="text-muted text-sm py-2">of</span>
              <select value={a.column} onChange={e=>{const n=[...aggregates];n[i].column=e.target.value;setAggregates(n);}} className="rounded-lg border bg-background px-2 py-2 text-sm flex-1"><option value="">Column</option>{columns.map((c:any)=><option key={c.name} value={c.name}>{c.name}</option>)}</select>
              <input value={a.alias} onChange={e=>{const n=[...aggregates];n[i].alias=e.target.value;setAggregates(n);}} placeholder="Alias" className="rounded-lg border bg-background px-2 py-2 text-sm w-24"/>
              <button onClick={()=>setAggregates(aggregates.filter((_,j)=>j!==i))} className="p-2 text-muted hover:text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}
            <button onClick={()=>setAggregates([...aggregates,{column:'',function:'COUNT',alias:''}])} className="text-sm text-primary hover:underline"><Plus className="h-3.5 w-3.5 inline"/> Add metric</button>
            <div className="flex gap-3"><button onClick={()=>setStep('filter')} className="rounded-lg border px-4 py-2 text-sm">Back</button><button onClick={()=>setStep('group')} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Next</button></div>
          </div>}

          {/* GROUP */}
          {step === 'group' && <div className="rounded-xl border bg-surface p-6 space-y-4">
            <h3 className="font-semibold"><Group className="h-5 w-5 inline mr-2 text-green-600"/>Group, Sort & Limit</h3>
            <div><label className="text-xs text-muted mb-2 block">Group by</label>
              <div className="flex flex-wrap gap-2">{columns.map((c:any)=><button key={c.name} onClick={()=>setGroupBy(groupBy.includes(c.name)?groupBy.filter(g=>g!==c.name):[...groupBy,c.name])} className={`rounded-md px-2.5 py-1 text-xs border ${groupBy.includes(c.name)?'border-primary bg-primary/10 text-primary':'border-border text-muted'}`}>{c.name}</button>)}</div></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-muted">Sort by</label><select value={sortCol} onChange={e=>setSortCol(e.target.value)} className="w-full rounded-lg border bg-background px-2 py-2 text-sm mt-1"><option value="">None</option>{columns.map((c:any)=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
              <div><label className="text-xs text-muted">Direction</label><select value={sortDir} onChange={e=>setSortDir(e.target.value as any)} className="w-full rounded-lg border bg-background px-2 py-2 text-sm mt-1"><option value="ASC">Ascending</option><option value="DESC">Descending</option></select></div>
              <div><label className="text-xs text-muted">Row limit</label><input type="number" value={limit} onChange={e=>setLimit(parseInt(e.target.value)||100)} className="w-full rounded-lg border bg-background px-2 py-2 text-sm mt-1"/></div>
            </div>
            <div className="flex gap-3"><button onClick={()=>setStep('summarize')} className="rounded-lg border px-4 py-2 text-sm">Back</button><button onClick={()=>{buildQuery();setStep('visualize');}} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Next</button></div>
          </div>}

          {/* VISUALIZE */}
          {step === 'visualize' && <div className="rounded-xl border bg-surface p-6 space-y-4">
            <h3 className="font-semibold"><BarChart3 className="h-5 w-5 inline mr-2 text-pink-600"/>Visualize & Save</h3>
            <div className="flex flex-wrap gap-2">{VIZ_OPTS.map(o=><button key={o.v} onClick={()=>setViz(o.v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${viz===o.v?'border-primary bg-primary/10 text-primary':'border-border text-muted'}`}><o.i className="h-3.5 w-3.5"/>{o.l}</button>)}</div>
            <input value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="Question name" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/>
            <div className="flex gap-3">
              <button onClick={()=>setStep('group')} className="rounded-lg border px-4 py-2 text-sm">Back</button>
              <button onClick={()=>buildQuery()} disabled={previewLoading} className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50">{previewLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>}Run</button>
              <button onClick={()=>createMut.mutate()} disabled={createMut.isPending||!reportName} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{createMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Save</button>
            </div>
          </div>}
        </div>

        {/* Preview */}
        <div className="rounded-xl border bg-surface p-4">
          <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-semibold">Preview</h4>
            <button onClick={()=>buildQuery()} disabled={previewLoading||!table} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-surface-hover disabled:opacity-50">{previewLoading?<Loader2 className="h-3 w-3 animate-spin"/>:<Play className="h-3 w-3"/>}Run</button></div>
          {preview ? <div>
            <p className="text-xs text-muted mb-2">{preview.row_count} rows</p>
            <div className="overflow-x-auto max-h-96"><table className="w-full text-xs"><thead><tr className="border-b">{preview.columns?.map((c:string)=><th key={c} className="px-2 py-1.5 text-left font-semibold text-muted">{c}</th>)}</tr></thead><tbody>{preview.rows?.slice(0,30).map((r:any[],i:number)=><tr key={i} className="border-b">{r.map((c:any,j:number)=><td key={j} className="px-2 py-1 whitespace-nowrap">{c===null?'—':String(c)}</td>)}</tr>)}</tbody></table></div>
            {sql && <div className="mt-3 rounded bg-gray-950 p-2"><pre className="text-xs text-green-400 overflow-x-auto">{sql}</pre></div>}
          </div> : <div className="text-center py-8 text-muted text-sm">Pick a table → Run</div>}
        </div>
      </div>
    </div>
  );
}
