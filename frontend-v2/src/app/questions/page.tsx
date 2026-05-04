'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Sparkles, Terminal, Shield, Loader2, Play, Eye, Trash2, FileText, BarChart3, LineChart, PieChart, AreaChart, ScatterChart, Table2 } from 'lucide-react';
import { listReports, deleteReport, listDatasources, generateAIQuery, createReport, runRawQuery } from '@/lib/api';
import toast from 'react-hot-toast';

const vizIcons: any = { bar: BarChart3, line: LineChart, pie: PieChart, table: Table2, area: AreaChart, scatter: ScatterChart };
const vizList = [
  { v: 'table', l: 'Table', i: Table2 }, { v: 'bar', l: 'Bar', i: BarChart3 },
  { v: 'line', l: 'Line', i: LineChart }, { v: 'pie', l: 'Pie', i: PieChart },
  { v: 'area', l: 'Area', i: AreaChart }, { v: 'scatter', l: 'Scatter', i: ScatterChart },
];

export default function QuestionsPage() {
  const qc = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [mode, setMode] = useState<'ai'|'sql'>('ai');
  const [search, setSearch] = useState('');

  // AI state
  const [aiStep, setAiStep] = useState(0);
  const [aiCfg, setAiCfg] = useState({ provider: 'anthropic', apiKey: '', model: '', baseUrl: '' });
  const [aiPrompt, setAiPrompt] = useState({ ds: '', text: '' });
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiName, setAiName] = useState('');
  const [aiViz, setAiViz] = useState('table');

  // SQL state
  const [sqlDs, setSqlDs] = useState('');
  const [sql, setSql] = useState('');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlName, setSqlName] = useState('');
  const [sqlViz, setSqlViz] = useState('table');

  const { data: reports, isLoading } = useQuery({ queryKey: ['reports'], queryFn: listReports });
  const { data: dss } = useQuery({ queryKey: ['datasources'], queryFn: listDatasources });

  const delMut = useMutation({ mutationFn: deleteReport, onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Deleted'); } });
  const aiMut = useMutation({ mutationFn: generateAIQuery, onSuccess: (d) => { setAiResult(d); setAiStep(3); toast.success('Query generated!'); }, onError: (e: Error) => toast.error(e.message) });
  const sqlMut = useMutation({ mutationFn: (p: { dsId: string; sql: string }) => runRawQuery(p.dsId, p.sql), onSuccess: (d) => { setSqlResult(d); toast.success(`${d.row_count} rows`); }, onError: (e: Error) => toast.error(e.message) });
  const createMut = useMutation({ mutationFn: createReport, onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); resetAll(); toast.success('Question saved!'); }, onError: (e: Error) => toast.error(e.message) });

  const resetAll = () => { setShowBuilder(false); setAiStep(0); setAiResult(null); setSqlResult(null); };

  const filtered = (reports || []).filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Questions</h1><p className="mt-1 text-muted">Ask questions with AI or write your own SQL.</p></div>
        <button onClick={() => setShowBuilder(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"><Plus className="h-4 w-4"/> New Question</button>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..." className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
      </div>

      {/* Builder panel */}
      {showBuilder && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex border-b border-border">
            <button onClick={() => setMode('ai')} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 ${mode==='ai'?'border-primary text-primary bg-primary/5':'border-transparent text-muted'}`}><Sparkles className="h-4 w-4"/> AI Assistant</button>
            <button onClick={() => setMode('sql')} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 ${mode==='sql'?'border-primary text-primary bg-primary/5':'border-transparent text-muted'}`}><Terminal className="h-4 w-4"/> SQL Editor</button>
            <button onClick={resetAll} className="ml-auto px-4 py-3 text-sm text-muted hover:text-foreground">✕</button>
          </div>

          {mode === 'ai' && (
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <div className="flex items-start gap-3"><Shield className="h-5 w-5 text-green-600 mt-0.5"/><div><p className="text-sm font-semibold text-green-800 dark:text-green-200">Privacy protected — AI only sees column names & types</p><p className="mt-1 text-xs text-green-700 dark:text-green-300">No actual data values are ever sent to any AI provider. Only table schema metadata.</p></div></div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted">
                {['Datasource','AI Config','Describe','Review'].map((s,i) => (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i<=aiStep?'bg-primary text-white':'bg-border text-muted'}`}>{i+1}</span><span className={i<=aiStep?'font-medium text-foreground':''}>{s}</span>
                    {i<3 && <div className={`h-px w-4 ${i<aiStep?'bg-primary':'bg-border'}`}/>}
                  </div>
                ))}
              </div>

              {aiStep===0 && <div className="space-y-3"><h3 className="font-semibold">Choose Datasource</h3>
                <select value={aiPrompt.ds} onChange={e=>setAiPrompt({...aiPrompt,ds:e.target.value})} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="">— Select —</option>{(dss||[]).map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
                <button onClick={()=>setAiStep(1)} disabled={!aiPrompt.ds} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Next</button></div>}

              {aiStep===1 && <div className="space-y-3"><h3 className="font-semibold">Configure AI</h3>
                <div className="grid grid-cols-2 gap-3">
                  <select value={aiCfg.provider} onChange={e=>setAiCfg({...aiCfg,provider:e.target.value})} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="anthropic">Anthropic</option><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="custom">Custom</option>
                  </select>
                  <input value={aiCfg.model} onChange={e=>setAiCfg({...aiCfg,model:e.target.value})} placeholder="Model (optional)" className="rounded-lg border bg-background px-3 py-2 text-sm"/>
                  <input type="password" value={aiCfg.apiKey} onChange={e=>setAiCfg({...aiCfg,apiKey:e.target.value})} placeholder="API Key" className="col-span-2 rounded-lg border bg-background px-3 py-2 text-sm"/>
                  {aiCfg.provider==='custom' && <input value={aiCfg.baseUrl} onChange={e=>setAiCfg({...aiCfg,baseUrl:e.target.value})} placeholder="Custom URL" className="col-span-2 rounded-lg border bg-background px-3 py-2 text-sm"/>}
                </div>
                <div className="flex gap-3"><button onClick={()=>setAiStep(0)} className="rounded-lg border px-4 py-2 text-sm">Back</button><button onClick={()=>setAiStep(2)} disabled={!aiCfg.apiKey} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Next</button></div></div>}

              {aiStep===2 && <div className="space-y-3"><h3 className="font-semibold">Describe Your Question</h3>
                <textarea value={aiPrompt.text} onChange={e=>setAiPrompt({...aiPrompt,text:e.target.value})} rows={4} placeholder="e.g., Show total tax paid by account type, grouped by month" className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none"/>
                <div className="flex gap-3"><button onClick={()=>setAiStep(1)} className="rounded-lg border px-4 py-2 text-sm">Back</button>
                <button onClick={()=>aiMut.mutate({datasource_id:aiPrompt.ds,prompt:aiPrompt.text,api_key:aiCfg.apiKey,provider:aiCfg.provider,model:aiCfg.model||'',base_url:aiCfg.baseUrl||''})} disabled={!aiPrompt.text||aiMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{aiMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>} Generate</button></div></div>}

              {aiStep===3 && aiResult && <div className="space-y-3">
                <h3 className="font-semibold">Review & Save</h3>
                <input value={aiName} onChange={e=>setAiName(e.target.value)} placeholder="Question name" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/>
                <div className="flex gap-2 flex-wrap">{vizList.map(o=><button key={o.v} onClick={()=>setAiViz(o.v)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${aiViz===o.v?'border-primary bg-primary/10 text-primary':'border-border text-muted'}`}><o.i className="h-3 w-3"/>{o.l}</button>)}</div>
                <div className="rounded-lg border bg-background p-3 text-xs font-mono text-muted truncate">{aiResult.sql}</div>
                {aiResult.explanation && <p className="text-xs text-muted italic">{aiResult.explanation}</p>}
                <div className="flex gap-3"><button onClick={()=>setAiStep(2)} className="rounded-lg border px-4 py-2 text-sm">Back</button>
                <button onClick={()=>createMut.mutate({name:aiName||'Question',datasource_id:aiPrompt.ds,query:aiResult,visualization:aiViz,sql:aiResult.sql})} disabled={createMut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{createMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:'Save'}</button></div></div>}
            </div>
          )}

          {mode === 'sql' && (
            <div className="p-6 space-y-4">
              <h3 className="font-semibold">Write SQL</h3>
              <p className="text-sm text-muted">Only <strong>SELECT</strong> queries allowed.</p>
              <select value={sqlDs} onChange={e=>setSqlDs(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                <option value="">— Select datasource —</option>{(dss||[]).map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
              <div className="rounded-lg border border-border bg-gray-950 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800"><span className="text-xs text-gray-400 font-mono">SQL Editor</span><span className="text-xs text-gray-500">SELECT only</span></div>
                <textarea value={sql} onChange={e=>setSql(e.target.value)} rows={8} placeholder="SELECT * FROM users" spellCheck={false} className="w-full bg-transparent px-4 py-3 text-sm font-mono text-green-400 placeholder:text-gray-600 focus:outline-none resize-y"/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>sqlMut.mutate({dsId:sqlDs,sql})} disabled={!sqlDs||!sql.trim()||sqlMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">{sqlMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>} Run</button>
                <button onClick={()=>{setSql('');setSqlResult(null);}} className="rounded-lg border px-4 py-2 text-sm">Clear</button>
              </div>
              {sqlResult && (
                <div className="rounded-lg border animate-fade-in">
                  <div className="px-4 py-2 border-b text-sm font-medium">{sqlResult.row_count} rows</div>
                  <div className="overflow-x-auto p-4">
                    <table className="w-full text-sm"><thead><tr className="border-b">{sqlResult.columns.map((c:string)=><th key={c} className="px-3 py-2 text-left text-xs font-semibold text-muted uppercase">{c}</th>)}</tr></thead>
                    <tbody>{sqlResult.rows.slice(0,50).map((r:any[],i:number)=><tr key={i} className="border-b hover:bg-surface-hover">{r.map((c:any,j:number)=><td key={j} className="px-3 py-1.5 text-xs whitespace-nowrap">{c===null?<span className="text-muted italic">—</span>:String(c)}</td>)}</tr>)}</tbody></table>
                  </div>
                  <div className="border-t p-4 bg-background rounded-b-lg">
                    <div className="flex items-end gap-4">
                      <input value={sqlName} onChange={e=>setSqlName(e.target.value)} placeholder="Name" className="flex-1 rounded-lg border bg-surface px-3 py-2 text-sm"/>
                      <select value={sqlViz} onChange={e=>setSqlViz(e.target.value)} className="rounded-lg border bg-surface px-3 py-2 text-sm">{vizList.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
                      <button onClick={()=>createMut.mutate({name:sqlName||'SQL Query',datasource_id:sqlDs,query:{select:sqlResult.columns,sql:sqlResult.sql},visualization:sqlViz,sql:sqlResult.sql})} disabled={!sqlName||createMut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Report list */}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted"/></div>
      : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r: any) => { const VI = vizIcons[r.visualization] || Table2;
            return <div key={r.id} className="group rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><VI className="h-4 w-4 text-primary"/></div><div><p className="font-medium text-sm">{r.name}</p><p className="text-xs text-muted">{r.datasource_name||r.datasource_id}</p></div></div><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">{r.visualization}</span></div>
              <div className="mt-4 flex gap-2">
                <Link href={`/questions/${r.id}`} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"><Eye className="h-3.5 w-3.5"/> View</Link>
                <button onClick={()=>{if(confirm('Delete?'))delMut.mutate(r.id)}} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5"/></button>
              </div>
            </div>;
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted"/>
          <p className="mt-4 text-lg font-medium">No questions yet</p>
          <p className="mt-1 text-sm text-muted">{search?'Try different search.':'Ask a question with AI or write SQL.'}</p>
        </div>
      )}
    </div>
  );
}
