'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BarChart3, Database, Sparkles, Plus, ArrowRight, Activity, FileText, Terminal } from 'lucide-react';
import { getStats, listReports, listDatasources } from '@/lib/api';

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const { data: reports } = useQuery({ queryKey: ['reports'], queryFn: listReports });
  const { data: datasources } = useQuery({ queryKey: ['datasources'], queryFn: listDatasources });

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Awesome BI</h1>
          <p className="mt-1.5 text-muted">Your data, beautifully visualized. AI-assisted. Fully private.</p>
        </div>
        <Link href="/questions" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> New Question
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Datasources', value: stats?.datasources ?? '—', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Questions', value: stats?.reports ?? '—', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'AI Providers', value: '5', icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-6 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted">{s.label}</p><p className="mt-1 text-3xl font-bold">{s.value}</p></div>
              <div className={`rounded-xl p-3 ${s.bg}`}><s.icon className={`h-6 w-6 ${s.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-4"><Activity className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-semibold">Getting Started</h2></div>
          <div className="space-y-3">
            {[
              { step: 1, title: 'Connect your database', desc: 'Add PostgreSQL or SQLite in seconds', href: '/database' },
              { step: 2, title: 'Ask a question with AI', desc: 'Describe what you need in plain English', href: '/questions?mode=ai' },
              { step: 3, title: 'Export and share', desc: 'Download as JSON, Excel, PDF, or Word', href: '/questions' },
            ].map(i => (
              <Link key={i.step} href={i.href} className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface-hover group">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i.step}</span>
                <div className="flex-1"><p className="text-sm font-medium group-hover:text-primary transition-colors">{i.title}</p><p className="text-xs text-muted">{i.desc}</p></div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary transition-colors mt-1" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-violet-600" /><h2 className="text-lg font-semibold">Recent Questions</h2></div>
            <Link href="/questions" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {reports && reports.length > 0 ? (
            <div className="space-y-1">
              {reports.slice(0, 6).map((r: any) => (
                <Link key={r.id} href={`/questions/${r.id}`} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-surface-hover">
                  <div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted">{r.datasource_name || r.datasource_id}</p></div>
                  <span className="text-xs text-muted capitalize">{r.visualization}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-2 text-sm text-muted">No questions yet</p>
              <Link href="/questions" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Ask your first question</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
