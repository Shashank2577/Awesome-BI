'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BarChart3, LineChart, PieChart, AreaChart, ScatterChart, Table2, Download, FileJson, FileSpreadsheet, FileText, FileIcon, Sparkles, Loader2, RefreshCw, Code, ChevronDown, Shield, Hash, TableProperties, Gauge, FunnelIcon, Columns3, AlignStartHorizontal, Server, Database } from 'lucide-react';
import { getReport, runReport, explainReport, downloadReport, getReportDatasources, getCompatibleDatasources, linkDatasourceToReport, listDatasources, unlinkDatasourceFromReport } from '@/lib/api';
import { ChartViewer } from '@/components/charts/chart-viewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

const vizOpts = [
  { v: 'table', l: 'Table', i: Table2 }, { v: 'bar', l: 'Bar', i: BarChart3 },
  { v: 'line', l: 'Line', i: LineChart }, { v: 'pie', l: 'Pie', i: PieChart },
  { v: 'area', l: 'Area', i: AreaChart }, { v: 'scatter', l: 'Scatter', i: ScatterChart },
  { v: 'pivot', l: 'Pivot', i: TableProperties }, { v: 'number', l: 'KPI', i: Hash },
  { v: 'gauge', l: 'Gauge', i: Gauge }, { v: 'funnel', l: 'Funnel', i: FunnelIcon },
  { v: 'combo', l: 'Combo', i: Columns3 }, { v: 'row', l: 'Row', i: AlignStartHorizontal },
];
const exportFmts = [
  { f: 'json', l: 'JSON', i: FileJson }, { f: 'csv', l: 'CSV', i: FileText },
  { f: 'excel', l: 'Excel', i: FileSpreadsheet }, { f: 'pdf', l: 'PDF', i: FileIcon },
  { f: 'word', l: 'Word', i: FileText },
];

type Viz = 'table'|'bar'|'line'|'pie'|'area'|'scatter'|'pivot'|'number'|'gauge'|'funnel'|'combo'|'row';

export default function QuestionDetail() {
  const params = useParams(); const id = params.id as string;
  const chartRef = useRef<(() => Promise<string|null>)|null>(null);

  const { data: report, isLoading: rl } = useQuery({ queryKey: ['report',id], queryFn: ()=>getReport(id) });
  const [activeDsId, setActiveDsId] = useState<string | null>(null);
  const { data: result, isLoading: dl, refetch } = useQuery({
    queryKey: ['result', id, activeDsId],
    queryFn: () => runReport(id, activeDsId || undefined),
    enabled: !!id,
  });
  const { data: availableDs } = useQuery({ queryKey: ['report-ds', id], queryFn: ()=>getReportDatasources(id), enabled:!!id });

  const [viz, setViz] = useState<Viz>('table');
  const [showSQL, setShowSQL] = useState(false);
  const [aiExp, setAiExp] = useState<string|null>(null);
  const [aiCfg, setAiCfg] = useState({ provider:'anthropic',apiKey:'',model:'',baseUrl:'' });
  const [showAiCfg, setShowAiCfg] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportChart, setExportChart] = useState(true);
  const [exportSummary, setExportSummary] = useState(false);
  const [showLinkDs, setShowLinkDs] = useState(false);
  const { data: allDs } = useQuery({ queryKey: ['all-ds'], queryFn: listDatasources, enabled: showLinkDs });
  const qc = useQueryClient();

  // Auto-discover compatible datasources (dev/QA/prod with same schema)
  useEffect(() => {
    if (report?.datasource_id && availableDs && availableDs.length <= 1) {
      getCompatibleDatasources(report.datasource_id).then(compatible => {
        compatible.forEach((ds: any) => {
          linkDatasourceToReport(id, ds.id).catch(() => {});
        });
      }).catch(() => {});
    }
  }, [report?.datasource_id, availableDs?.length, id]);

  useEffect(() => { if (report?.visualization && vizOpts.some(o=>o.v===report.visualization)) setViz(report.visualization as Viz); }, [report?.visualization]);

  const handleChartReady = useCallback((fn: ()=>Promise<string|null>) => { chartRef.current = fn; }, []);

  const expMut = useMutation({ mutationFn: explainReport, onSuccess:(d:any)=>{setAiExp(d.explanation);toast.success('AI explanation ready');}, onError:(e:Error)=>toast.error(e.message) });

  const doExport = async (fmt:string, includeAiSummary = false) => {
    try {
      let chartImg: string | undefined;
      if ((fmt==='pdf'||fmt==='word') && exportChart && viz!=='table' && chartRef.current) {
        chartImg = await chartRef.current() || undefined;
      }
      await downloadReport(id, fmt, {
        chartImage: chartImg,
        aiSummary: includeAiSummary && aiExp ? aiExp : undefined,
      });
      const extras = [exportChart && viz!=='table'?'chart':'', includeAiSummary?'summary':''].filter(Boolean).join(' + ');
      toast.success(`Exported as ${fmt.toUpperCase()}` + (extras ? ` with ${extras}` : ''));
    } catch(e:any) { toast.error(e.message); }
  };

  if (rl) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted"/></div>;
  if (!report) return <div className="text-center py-20"><p className="text-lg font-medium">Not found</p><Link href="/questions" className="mt-2 text-primary hover:underline">Back</Link></div>;

  return <div className="animate-fade-in space-y-6">
    <div className="flex items-center gap-2 text-sm text-muted"><Link href="/questions" className="hover:text-foreground">Questions</Link><span>/</span><span className="text-foreground font-medium">{report.name}</span></div>

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-3xl font-bold">{report.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Database className="h-3.5 w-3.5 text-muted"/>
          <select value={activeDsId || ''} onChange={e => { setActiveDsId(e.target.value || null); }}
            className="text-sm text-muted bg-transparent border border-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
            {(availableDs||[]).map((ds: any) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          <button onClick={() => setShowLinkDs(!showLinkDs)} className="text-xs text-primary hover:underline ml-1">+ Link</button>
          {dl && <Loader2 className="h-3 w-3 animate-spin text-muted"/>}

          {/* Link datasource modal */}
          {showLinkDs && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowLinkDs(false)}>
            <div className="rounded-xl border bg-surface p-6 shadow-2xl w-96 max-h-96 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold mb-3">Link Environment</h3>
              <p className="text-xs text-muted mb-3">Select databases to run this question against.</p>
              <div className="space-y-1">
                {(allDs||[]).map((ds: any) => {
                  const isLinked = (availableDs||[]).some(d => d.id === ds.id);
                  return <button key={ds.id}
                    onClick={async () => {
                      if (isLinked) {
                        await unlinkDatasourceFromReport(id, ds.id);
                      } else {
                        await linkDatasourceToReport(id, ds.id);
                      }
                      qc.invalidateQueries({ queryKey: ['report-ds', id] });
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm flex items-center justify-between ${isLinked ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-surface-hover'}`}>
                    <span>{ds.name} <span className="text-xs text-muted">({ds.host}/{ds.database})</span></span>
                    {isLinked ? <span className="text-xs text-green-600">✓ linked</span> : <span className="text-xs text-muted">+ add</span>}
                  </button>;
                })}
              </div>
            </div>
          </div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={()=>refetch()} className="rounded-lg border p-2 text-muted hover:bg-surface-hover"><RefreshCw className="h-4 w-4"/></button>
        <div className="relative">
          <button onClick={() => setExportOpen(!exportOpen)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"><Download className="h-4 w-4"/> Export<ChevronDown className={`h-3.5 w-3.5 transition-transform ${exportOpen?'rotate-180':''}`}/></button>
          {exportOpen && <>
            <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
            <div className="absolute right-0 top-full mt-1 rounded-lg border bg-surface p-4 shadow-xl z-20 w-72 space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {exportFmts.map(e=><button key={e.f} onClick={() => { doExport(e.f, exportSummary); setExportOpen(false); }} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-hover transition-colors"><e.i className="h-4 w-4 text-primary"/>{e.l}</button>)}
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted uppercase tracking-wider">Options</p>
                {viz !== 'table' && <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={exportChart} onChange={e=>setExportChart(e.target.checked)} className="rounded accent-primary"/> Include chart image</label>}
                {aiExp && <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={exportSummary} onChange={e=>setExportSummary(e.target.checked)} className="rounded accent-primary"/> Include AI analysis</label>}
              </div>
            </div>
          </>}
        </div>
      </div>
    </div>

    <div className="flex items-center gap-1 rounded-lg border bg-surface p-1 w-fit">
      {vizOpts.map(o=><button key={o.v} onClick={()=>setViz(o.v as Viz)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viz===o.v?'bg-primary text-white shadow-sm':'text-muted hover:text-foreground'}`}><o.i className="h-3.5 w-3.5"/>{o.l}</button>)}
    </div>

    <div className="rounded-xl border bg-surface p-6 min-h-[400px]">
      {dl ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted"/></div>
      : result?.rows?.length > 0 ? <ChartViewer type={viz} columns={result.columns} rows={result.rows} onChartReady={handleChartReady}/>
      : <div className="flex justify-center py-20 text-muted">No data available</div>}
    </div>

    {result?.rows && <div className="rounded-lg border bg-surface p-3 text-sm text-muted">{result.rows.length} rows
      {result.sql && <button onClick={()=>setShowSQL(!showSQL)} className="ml-3 inline-flex items-center gap-1 text-primary hover:underline"><Code className="h-3.5 w-3.5"/>{showSQL?'Hide':'Show'} SQL</button>}</div>}
    {showSQL && result?.sql && <div className="rounded-xl border bg-gray-950 p-4"><pre className="text-xs text-green-400 overflow-x-auto">{result.sql}</pre></div>}

    {/* AI Explanation */}
    <div className="rounded-xl border bg-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500"/><h2 className="text-lg font-semibold">AI Explanation</h2></div>
        <button onClick={()=>setShowAiCfg(!showAiCfg)} className="text-sm text-primary hover:underline">{showAiCfg?'Hide':'Configure'}</button>
      </div>
      {showAiCfg && <div className="mb-4 grid grid-cols-3 gap-3">
        <select value={aiCfg.provider} onChange={e=>setAiCfg({...aiCfg,provider:e.target.value})} className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="anthropic">Anthropic</option><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="custom">Custom</option></select>
        <input value={aiCfg.model} onChange={e=>setAiCfg({...aiCfg,model:e.target.value})} placeholder="Model" className="rounded-lg border bg-background px-3 py-2 text-sm"/>
        <input type="password" value={aiCfg.apiKey} onChange={e=>setAiCfg({...aiCfg,apiKey:e.target.value})} placeholder="API Key" className="rounded-lg border bg-background px-3 py-2 text-sm"/>
        <div className="col-span-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950 flex items-start gap-2"><Shield className="h-4 w-4 text-green-600 mt-0.5"/><p className="text-xs text-green-800 dark:text-green-200">AI receives only aggregate statistics — never individual data rows.</p></div>
      </div>}
      {aiExp ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950 prose prose-sm prose-amber max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{aiExp}</ReactMarkdown></div>
      : <div className="rounded-lg border border-dashed p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-muted"/><p className="mt-2 text-sm text-muted">Get AI to explain this data</p>
        <button onClick={()=>{if(!aiCfg.apiKey){setShowAiCfg(true);return;}expMut.mutate({report_id:id,api_key:aiCfg.apiKey,provider:aiCfg.provider,model:aiCfg.model||'',base_url:aiCfg.baseUrl||''});}} disabled={expMut.isPending} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{expMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>} Explain</button></div>}
    </div>
  </div>;
}
