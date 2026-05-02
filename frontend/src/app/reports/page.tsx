'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, FileBarChart, Trash2, Loader2, Sparkles,
  Search, BarChart3, LineChart, PieChart, Table2, AreaChart, ScatterChart,
  Eye,
} from 'lucide-react';
import { listReports, deleteReport, listDatasources, generateAIQuery, createReport } from '@/lib/api';
import toast from 'react-hot-toast';

const vizIcons: Record<string, any> = {
  bar: BarChart3, line: LineChart, pie: PieChart,
  table: Table2, area: AreaChart, scatter: ScatterChart,
};

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [search, setSearch] = useState('');
  const [wizardStep, setWizardStep] = useState(0);
  const [aiConfig, setAiConfig] = useState({
    provider: 'anthropic', apiKey: '', model: '', baseUrl: '',
  });
  const [reportForm, setReportForm] = useState({
    name: '', datasource_id: '', naturalLanguage: '',
  });
  const [aiResult, setAiResult] = useState<any>(null);

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
      toast.success('AI generated your query!');
    },
    onError: (e: Error) => toast.error('AI failed: ' + e.message),
  });

  const createReportMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowCreateWizard(false);
      setWizardStep(0);
      setAiResult(null);
      toast.success('Report created!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredReports = (reports || []).filter((r: any) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="mt-1 text-textSecondary">Create, view, and export your BI reports.</p>
        </div>
        <button
          onClick={() => setShowCreateWizard(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-4 w-4" />
          AI Report Builder
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

      {/* Create Wizard */}
      {showCreateWizard && (
        <div className="rounded-xl border border-border bg-surface p-6 glass">
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-6">
            {['Choose Datasource', 'AI Configuration', 'Describe Report', 'Review'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  i <= wizardStep ? 'bg-primary text-white' : 'bg-border text-textSecondary'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-sm ${i <= wizardStep ? 'font-medium' : 'text-textSecondary'}`}>{step}</span>
                {i < 3 && <div className={`h-px w-8 ${i < wizardStep ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Choose Datasource */}
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

          {/* Step 2: AI Configuration */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Step 2: AI Configuration</h3>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  🔒 AI only sees column names &amp; types. Your actual data stays private.
                </p>
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

          {/* Step 3: Describe Report in Natural Language */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Step 3: Describe Your Report</h3>
              <p className="text-sm text-textSecondary">Write what you want in plain English. AI will generate the SQL.</p>
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
                  onClick={() => {
                    aiQueryMutation.mutate({
                      datasource_id: reportForm.datasource_id,
                      prompt: reportForm.naturalLanguage,
                      api_key: aiConfig.apiKey,
                      provider: aiConfig.provider,
                      model: aiConfig.model || undefined,
                      base_url: aiConfig.baseUrl || undefined,
                    });
                  }}
                  disabled={!reportForm.naturalLanguage || aiQueryMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {aiQueryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate with AI
                </button>
              </div>

              {aiResult && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950 animate-in">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">AI Query Generated ✓</p>
                  <pre className="mt-2 text-xs overflow-x-auto">{JSON.stringify(aiResult, null, 2)}</pre>
                  <p className="mt-2 text-xs text-green-700 dark:text-green-300">{aiResult.explanation}</p>
                  <button
                    onClick={() => setWizardStep(3)}
                    className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Review & Create Report
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Save */}
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
                <select
                  defaultValue="table"
                  id="viz-select"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="table">Table</option>
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="area">Area Chart</option>
                  <option value="scatter">Scatter Plot</option>
                </select>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-mono text-textSecondary">SQL: {aiResult.sql}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setWizardStep(2)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">Back</button>
                <button
                  onClick={() => {
                    const viz = (document.getElementById('viz-select') as HTMLSelectElement)?.value || 'table';
                    createReportMutation.mutate({
                      name: reportForm.name || 'Untitled Report',
                      datasource_id: reportForm.datasource_id,
                      query: aiResult,
                      visualization: viz,
                    });
                  }}
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

      {/* Report List */}
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
            {search ? 'Try a different search term.' : 'Use the AI Report Builder to create your first report.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreateWizard(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" /> Create with AI
            </button>
          )}
        </div>
      )}
    </div>
  );
}
