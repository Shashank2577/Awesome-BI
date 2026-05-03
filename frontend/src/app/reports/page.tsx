'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, FileBarChart, Trash2, Loader2, Sparkles,
  Search, BarChart3, LineChart, PieChart, Table2, AreaChart, ScatterChart,
  Eye, Code2, Play, Shield, ShieldAlert, Columns, Terminal,
} from 'lucide-react';
import {
  listReports, deleteReport, listDatasources, generateAIQuery,
  createReport, runRawQuery,
} from '@/lib/api';
import toast from 'react-hot-toast';

const vizIcons: Record<string, any> = {
  bar: BarChart3, line: LineChart, pie: PieChart,
  table: Table2, area: AreaChart, scatter: ScatterChart,
};

const vizOptions = [
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: LineChart },
  { value: 'pie', label: 'Pie', icon: PieChart },
  { value: 'area', label: 'Area', icon: AreaChart },
  { value: 'scatter', label: 'Scatter', icon: ScatterChart },
];

type BuilderMode = 'ai' | 'sql';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [mode, setMode] = useState<BuilderMode>('ai');
  const [search, setSearch] = useState('');

  // ── AI Mode State ──
  const [wizardStep, setWizardStep] = useState(0);
  const [aiConfig, setAiConfig] = useState({
    provider: 'anthropic', apiKey: '', model: '', baseUrl: '',
  });
  const [reportForm, setReportForm] = useState({
    name: '', datasource_id: '', naturalLanguage: '',
  });
  const [aiResult, setAiResult] = useState<any>(null);

  // ── SQL Mode State ──
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlDatasourceId, setSqlDatasourceId] = useState('');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlReportName, setSqlReportName] = useState('');
  const [selectedViz, setSelectedViz] = useState('table');

  const { data: reports, isLoading } = useQuery({ queryKey: ['reports'], queryFn: listReports });
  const { data: datasources } = useQuery({ queryKey: ['datasources'], queryFn: listDatasources });

  const deleteMutation = useMutation({
    mutationFn: deleteReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiQueryMutation = useMutation({
    mutationFn: generateAIQuery,
    onSuccess: (data) => {
      setAiResult(data);
      setWizardStep(3);
      toast.success('AI query generated!');
    },
    onError: (e: Error) => toast.error('AI failed: ' + e.message),
  });

  const sqlRunMutation = useMutation({
    mutationFn: (params: { datasourceId: string; sql: string }) =>
      runRawQuery(params.datasourceId, params.sql),
    onSuccess: (data) => {
      setSqlResult(data);
      toast.success(`Query returned ${data.row_count} rows`);
    },
    onError: (e: Error) => toast.error('Query failed: ' + e.message),
  });

  const createReportMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      resetBuilder();
      toast.success('Report created!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetBuilder = () => {
    setShowCreatePanel(false);
    setMode('ai');
    setWizardStep(0);
    setAiResult(null);
    setSqlQuery('');
    setSqlResult(null);
    setSqlReportName('');
  };

  const filteredReports = (reports || []).filter((r: any) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="mt-1 text-textSecondary">Build reports with AI or write your own SQL.</p>
        </div>
        <button
          onClick={() => setShowCreatePanel(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Report
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports..."
          className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* ── Create Panel (Tabs: AI Builder + SQL Editor) ── */}
      {showCreatePanel && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden glass">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setMode('ai')}
              className={'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ' +
                (mode === 'ai'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-textSecondary hover:text-text')}
            >
              <Sparkles className="h-4 w-4" />
              AI Builder
            </button>
            <button
              onClick={() => setMode('sql')}
              className={'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ' +
                (mode === 'sql'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-textSecondary hover:text-text')}
            >
              <Terminal className="h-4 w-4" />
              SQL Editor
            </button>
            <button
              onClick={resetBuilder}
              className="ml-auto px-4 py-3 text-sm text-textSecondary hover:text-text transition-colors"
            >
              ✕ Close
            </button>
          </div>

          {/* ━━━ AI BUILDER MODE ━━━ */}
          {mode === 'ai' && (
            <div className="p-6">
              {/* Privacy Notice */}
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                      Your data stays private — AI only sees schema metadata
                    </p>
                    <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                      The AI receives only <strong>column names and data types</strong> (e.g., &quot;amount (numeric)&quot;, &quot;status (text)&quot;).
                      It does <strong>NOT</strong> see actual row values, user data, or any sensitive information.
                      Queries are generated from structure alone — your data never leaves your database.
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-2 mb-6">
                {['Choose Datasource', 'Configure AI', 'Describe Report', 'Review'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ' +
                      (i <= wizardStep ? 'bg-primary text-white' : 'bg-border text-textSecondary')}>
                      {i + 1}
                    </div>
                    <span className={'text-xs ' + (i <= wizardStep ? 'font-medium' : 'text-textSecondary')}>{step}</span>
                    {i < 3 && <div className={'h-px w-6 ' + (i < wizardStep ? 'bg-primary' : 'bg-border')} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Datasource */}
              {wizardStep === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 1: Choose a Datasource</h3>
                  <p className="text-sm text-textSecondary">Select which database to query for your report.</p>
                  <select
                    value={reportForm.datasource_id}
                    onChange={(e) => setReportForm({ ...reportForm, datasource_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Select datasource --</option>
                    {(datasources || []).map((ds: any) => (
                      <option key={ds.id} value={ds.id}>{ds.name} ({ds.host}/{ds.database})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setWizardStep(1)}
                    disabled={!reportForm.datasource_id}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Next: Configure AI
                  </button>
                </div>
              )}

              {/* Step 2: AI Config */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 2: AI Configuration</h3>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Schema-only mode: AI receives column names &amp; types — never your data
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">AI Provider</label>
                      <select
                        value={aiConfig.provider}
                        onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="custom">Custom Endpoint</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Model (optional)</label>
                      <input
                        type="text"
                        value={aiConfig.model}
                        onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                        placeholder="Uses default if empty"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1">API Key</label>
                      <input
                        type="password"
                        value={aiConfig.apiKey}
                        onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {aiConfig.provider === 'custom' && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Custom Base URL</label>
                        <input
                          type="text"
                          value={aiConfig.baseUrl}
                          onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                          placeholder="https://your-endpoint.com"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setWizardStep(0)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">Back</button>
                    <button
                      onClick={() => setWizardStep(2)}
                      disabled={!aiConfig.apiKey}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Next: Describe Report
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Describe in English */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 3: Describe Your Report</h3>
                  <p className="text-sm text-textSecondary">Write what you need in plain English.</p>
                  <textarea
                    value={reportForm.naturalLanguage}
                    onChange={(e) => setReportForm({ ...reportForm, naturalLanguage: e.target.value })}
                    rows={4}
                    placeholder="e.g., Show total sales by month for 2024, with a breakdown by product category"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setWizardStep(1)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">Back</button>
                    <button
                      onClick={() => aiQueryMutation.mutate({
                        datasource_id: reportForm.datasource_id,
                        prompt: reportForm.naturalLanguage,
                        api_key: aiConfig.apiKey,
                        provider: aiConfig.provider,
                        model: aiConfig.model || undefined,
                        base_url: aiConfig.baseUrl || undefined,
                      })}
                      disabled={!reportForm.naturalLanguage || aiQueryMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {aiQueryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate with AI
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 3 && aiResult && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 4: Review & Save</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">Report Name</label>
                    <input
                      type="text"
                      value={reportForm.name}
                      onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                      placeholder="My Report"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Visualization</label>
                    <div className="flex gap-2 flex-wrap">
                      {vizOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedViz(opt.value)}
                          className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ' +
                            (selectedViz === opt.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-textSecondary hover:text-text')}
                        >
                          <opt.icon className="h-3.5 w-3.5" /> {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-mono text-textSecondary truncate">SQL: {aiResult.sql}</p>
                  </div>
                  {aiResult.explanation && (
                    <p className="text-xs text-textSecondary italic">{aiResult.explanation}</p>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setWizardStep(2)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">Back</button>
                    <button
                      onClick={() => createReportMutation.mutate({
                        name: reportForm.name || 'Untitled Report',
                        datasource_id: reportForm.datasource_id,
                        query: aiResult,
                        visualization: selectedViz,
                      })}
                      disabled={createReportMutation.isPending}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {createReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Report'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ━━━ SQL EDITOR MODE ━━━ */}
          {mode === 'sql' && (
            <div className="p-6 space-y-4">
              {/* SQL Step 1: Datasource + SQL */}
              <div>
                <h3 className="text-lg font-semibold mb-1">Write SQL</h3>
                <p className="text-sm text-textSecondary mb-4">
                  Write your own SQL query. Only <strong>SELECT</strong> statements are allowed for security.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-medium mb-1">Datasource</label>
                    <select
                      value={sqlDatasourceId}
                      onChange={(e) => setSqlDatasourceId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Select --</option>
                      {(datasources || []).map((ds: any) => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 flex items-end gap-2">
                    <button
                      onClick={() => navigateToSchema?.(sqlDatasourceId)}
                      className="rounded-lg border border-border px-3 py-2 text-sm text-textSecondary hover:bg-surface-hover transition-colors flex items-center gap-1"
                    >
                      <Columns className="h-3.5 w-3.5" /> Browse Schema
                    </button>
                  </div>
                </div>

                {/* Schema quick-reference helper */}
                <SchemaQuickRef datasourceId={sqlDatasourceId} />

                {/* SQL Textarea */}
                <div className="relative rounded-lg border border-border bg-gray-950 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
                    <span className="text-xs text-gray-400 font-mono">SQL Editor</span>
                    <span className="text-xs text-gray-500">SELECT only</span>
                  </div>
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    rows={8}
                    placeholder={'-- Write your SQL here\nSELECT *\nFROM users\nWHERE ...'}
                    spellCheck={false}
                    className="w-full bg-transparent px-4 py-3 text-sm font-mono text-green-400 placeholder:text-gray-600 focus:outline-none resize-y"
                  />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => sqlRunMutation.mutate({ datasourceId: sqlDatasourceId, sql: sqlQuery })}
                    disabled={!sqlDatasourceId || !sqlQuery.trim() || sqlRunMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {sqlRunMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run Query
                  </button>
                  <button
                    onClick={() => {
                      setSqlQuery('');
                      setSqlResult(null);
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* SQL Results */}
              {sqlResult && (
                <div className="rounded-lg border border-border animate-in space-y-4">
                  <div className="px-4 py-2 border-b border-border bg-background flex items-center justify-between">
                    <span className="text-sm font-medium">{sqlResult.row_count} row{sqlResult.row_count !== 1 ? 's' : ''} returned</span>
                    <button
                      onClick={() => {
                        const sqlCols: string[] = [];
                        document.querySelectorAll('.sql-result-th').forEach((th) => sqlCols.push(th.textContent || ''));
                        const sqlRows: any[][] = [];
                        document.querySelectorAll('.sql-result-tr').forEach((tr) => {
                          const row: any[] = [];
                          tr.querySelectorAll('td').forEach((td) => row.push(td.textContent));
                          sqlRows.push(row);
                        });
                      }}
                      className="text-xs text-textSecondary hover:text-text"
                    >
                      SQL: {sqlResult.sql ? sqlResult.sql.substring(0, 80) + '...' : ''}
                    </button>
                  </div>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {sqlResult.columns.map((col: string) => (
                            <th key={col} className="sql-result-th px-3 py-2 text-left font-semibold text-textSecondary text-xs uppercase tracking-wider">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResult.rows.slice(0, 50).map((row: any[], i: number) => (
                          <tr key={i} className="sql-result-tr border-b border-border hover:bg-background transition-colors">
                            {row.map((cell: any, j: number) => (
                              <td key={j} className="px-3 py-1.5 whitespace-nowrap text-xs">
                                {cell === null ? <span className="text-textSecondary italic">null</span> : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sqlResult.rows.length > 50 && (
                      <p className="mt-2 text-xs text-textSecondary text-center">
                        Showing 50 of {sqlResult.row_count} rows
                      </p>
                    )}
                  </div>

                  {/* Save as Report */}
                  <div className="border-t border-border p-4 bg-background rounded-b-lg">
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Save as Report</label>
                        <input
                          type="text"
                          value={sqlReportName}
                          onChange={(e) => setSqlReportName(e.target.value)}
                          placeholder="Report name"
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Viz</label>
                        <select
                          value={selectedViz}
                          onChange={(e) => setSelectedViz(e.target.value)}
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {vizOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          const queryConfig = {
                            select: sqlResult.columns,
                            sql: sqlResult.sql,
                          };
                          createReportMutation.mutate({
                            name: sqlReportName || 'SQL Report',
                            datasource_id: sqlDatasourceId,
                            query: queryConfig,
                            visualization: selectedViz,
                          });
                        }}
                        disabled={!sqlReportName.trim() || createReportMutation.isPending}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 h-[38px]"
                      >
                        {createReportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Report'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Report List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-textSecondary" />
        </div>
      ) : filteredReports.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((r: any) => {
            const VizIcon = vizIcons[r.visualization] || Table2;
            return (
              <div key={r.id} className="group rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <VizIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-textSecondary">{r.datasource_name || 'Unknown DS'}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {r.visualization}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Link>
                  <button
                    onClick={() => { if (confirm('Delete this report?')) deleteMutation.mutate(r.id); }}
                    className="rounded-lg p-1.5 text-textSecondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <FileBarChart className="mx-auto h-12 w-12 text-textSecondary" />
          <p className="mt-4 text-lg font-medium">No reports found</p>
          <p className="mt-1 text-sm text-textSecondary">
            {search ? 'Try a different search term.' : 'Build reports with AI or write your own SQL.'}
          </p>
          {!search && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => { setShowCreatePanel(true); setMode('ai'); }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" /> AI Builder
              </button>
              <button
                onClick={() => { setShowCreatePanel(true); setMode('sql'); }}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
              >
                <Terminal className="h-4 w-4" /> SQL Editor
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Schema Quick Reference Component ── */
function SchemaQuickRef({ datasourceId }: { datasourceId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: schema } = useQuery({
    queryKey: ['schema-quick', datasourceId],
    queryFn: () => import('@/lib/api').then(m => m.getDatasourceSchema(datasourceId)),
    enabled: !!datasourceId && expanded,
  });

  if (!datasourceId) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        <Columns className="h-3 w-3" />
        {expanded ? 'Hide schema' : 'Show schema reference'}
      </button>
      {expanded && schema && (
        <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs animate-in max-h-40 overflow-y-auto">
          {schema.tables?.map((table: any) => (
            <div key={table.name} className="mb-2">
              <p className="font-semibold mb-1">{table.name}</p>
              {table.columns?.map((col: any) => (
                <span key={col.name} className="inline-block mr-3 mb-1">
                  <code className="text-primary">{col.name}</code>
                  <span className="text-textSecondary ml-1">({col.type})</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Schema Navigation Stub ── */
function navigateToSchema(id: string) {
  // Navigate to datasource schema view
  window.open(`/datasources?view=${id}`, '_blank');
}
