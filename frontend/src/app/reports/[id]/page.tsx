'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Table2, BarChart3, LineChart, PieChart, AreaChart, ScatterChart,
  Download, FileJson, FileSpreadsheet, FileText, FileIcon,
  Sparkles, Loader2, RefreshCw, Code, ChevronDown,
} from 'lucide-react';
import {
  getReport, runReport, downloadReport, explainReport,
} from '@/lib/api';
import { ReportChart } from '@/components/charts/report-chart';
import type { VisualizationType } from '@/lib/types';
import toast from 'react-hot-toast';

const vizOptions: { value: VisualizationType; label: string; icon: any }[] = [
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: LineChart },
  { value: 'pie', label: 'Pie', icon: PieChart },
  { value: 'area', label: 'Area', icon: AreaChart },
  { value: 'scatter', label: 'Scatter', icon: ScatterChart },
];

const exportFormats = [
  { format: 'json', label: 'JSON', icon: FileJson },
  { format: 'csv', label: 'CSV', icon: FileText },
  { format: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', icon: FileIcon },
  { format: 'word', label: 'Word', icon: FileText },
];

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => getReport(id),
  });

  const { data: result, isLoading: resultLoading, refetch: refetchResult } = useQuery({
    queryKey: ['report-result', id],
    queryFn: () => runReport(id),
    enabled: !!id,
  });

  const [activeViz, setActiveViz] = useState<VisualizationType>('table');
  const [showSQL, setShowSQL] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState({
    provider: 'anthropic', apiKey: '', model: '', baseUrl: '',
  });
  const [showAiConfig, setShowAiConfig] = useState(false);

  const explainMutation = useMutation({
    mutationFn: explainReport,
    onSuccess: (data: any) => {
      setAiExplanation(data.explanation);
      toast.success('AI explanation generated!');
    },
    onError: (e: Error) => toast.error('AI failed: ' + e.message),
  });

  const handleExport = async (format: string) => {
    try {
      await downloadReport(id, format);
      toast.success('Report exported as ' + format.toUpperCase());
    } catch (e: any) {
      toast.error('Export failed: ' + e.message);
    }
  };

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-textSecondary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium">Report not found</p>
        <Link href="/reports" className="mt-2 text-primary hover:underline">Back to reports</Link>
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-textSecondary">
        <Link href="/reports" className="hover:text-text transition-colors">Reports</Link>
        <span>/</span>
        <span className="text-text font-medium">{report.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{report.name}</h1>
          <p className="text-sm text-textSecondary">Datasource: {report.datasource_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchResult()}
            className="rounded-lg border border-border p-2 text-textSecondary hover:bg-surface-hover transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="relative group">
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block rounded-lg border border-border bg-surface p-2 shadow-lg z-10 min-w-[160px]">
              {exportFormats.map((fmt) => (
                <button
                  key={fmt.format}
                  onClick={() => handleExport(fmt.format)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-background transition-colors"
                >
                  <fmt.icon className="h-4 w-4" />
                  Export as {fmt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Viz Selector */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        {vizOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveViz(opt.value)}
            className={'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ' +
              (activeViz === opt.value
                ? 'bg-primary text-white shadow-sm'
                : 'text-textSecondary hover:text-text')}
          >
            <opt.icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Chart / Table Area */}
      <div className="rounded-xl border border-border bg-surface p-6 min-h-[400px]">
        {resultLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-textSecondary" />
          </div>
        ) : result && result.rows?.length > 0 ? (
          <ReportChart type={activeViz} columns={result.columns} rows={result.rows} />
        ) : (
          <div className="flex items-center justify-center py-20 text-textSecondary">
            <p>No data available. Try running the report again.</p>
          </div>
        )}
      </div>

      {/* Row count + SQL toggle */}
      {result && result.rows && (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm text-textSecondary">
          {result.rows.length} row{result.rows.length !== 1 ? 's' : ''} returned
          {result.sql && (
            <button onClick={() => setShowSQL(!showSQL)} className="ml-3 inline-flex items-center gap-1 text-primary hover:underline">
              <Code className="h-3.5 w-3.5" />
              {showSQL ? 'Hide SQL' : 'Show SQL'}
            </button>
          )}
        </div>
      )}

      {showSQL && result?.sql && (
        <div className="rounded-xl border border-border bg-gray-950 p-4 animate-in">
          <pre className="text-xs text-green-400 overflow-x-auto">{result.sql}</pre>
        </div>
      )}

      {/* AI Explanation */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">AI Explanation</h2>
          </div>
          <button onClick={() => setShowAiConfig(!showAiConfig)} className="text-sm text-primary hover:underline">
            {showAiConfig ? 'Hide settings' : 'Configure AI'}
          </button>
        </div>

        {showAiConfig && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select value={aiConfig.provider} onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="anthropic">Anthropic Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="custom">Custom Endpoint</option>
            </select>
            <input type="text" value={aiConfig.model} onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
              placeholder="Model (optional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="password" value={aiConfig.apiKey} onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
              placeholder="API Key" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        )}

        {aiExplanation ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950 animate-in">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiExplanation}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-textSecondary" />
            <p className="mt-2 text-sm text-textSecondary">Generate an AI explanation of this report data</p>
            <button
              onClick={() => {
                if (!aiConfig.apiKey) { setShowAiConfig(true); toast.error('Please configure your AI API key'); return; }
                explainMutation.mutate({ report_id: id, api_key: aiConfig.apiKey, provider: aiConfig.provider, model: aiConfig.model || undefined, base_url: aiConfig.baseUrl || undefined });
              }}
              disabled={explainMutation.isPending}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {explainMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Explain with AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
