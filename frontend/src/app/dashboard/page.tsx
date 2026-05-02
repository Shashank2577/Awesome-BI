'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Database, FileBarChart, Sparkles, ArrowRight, TrendingUp,
  Plus, Zap, Activity,
} from 'lucide-react';
import { getStats, listReports, listDatasources } from '@/lib/api';

export default function DashboardPage() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const { data: reports } = useQuery({ queryKey: ['reports'], queryFn: listReports });
  const { data: datasources } = useQuery({ queryKey: ['datasources'], queryFn: listDatasources });

  const statCards = [
    { label: 'Datasources', value: stats?.datasources ?? '...', icon: Database, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Reports', value: stats?.reports ?? '...', icon: FileBarChart, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950' },
    { label: 'AI Providers', value: stats?.ai_providers ?? '...', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950' },
  ];

  return (
    <div className="animate-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back 👋</h1>
          <p className="mt-1 text-textSecondary">
            Here&apos;s what&apos;s happening with your BI system today.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Report
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-textSecondary">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold">{stat.value}</p>
              </div>
              <div className={`rounded-xl p-3 ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Start Guide */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Quick Start Guide</h2>
          </div>
          <div className="space-y-4">
            {[
              { step: 1, title: 'Connect a datasource', desc: 'Add your PostgreSQL or SQLite database', href: '/datasources' },
              { step: 2, title: 'Create a report with AI', desc: 'Describe what you need in plain English', href: '/reports/new' },
              { step: 3, title: 'Export & share', desc: 'Download as JSON, Excel, PDF, or Word', href: '/reports' },
            ].map((item) => (
              <Link
                key={item.step}
                href={item.href}
                className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-background group"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {item.step}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{item.title}</p>
                  <p className="text-xs text-textSecondary">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-textSecondary group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Recent Reports</h2>
            </div>
            <Link href="/reports" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {reports && reports.length > 0 ? (
            <div className="space-y-2">
              {reports.slice(0, 5).map((r: any) => (
                <Link
                  key={r.id}
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-background"
                >
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-textSecondary">{r.datasource_name || r.datasource_id}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {r.visualization}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <FileBarChart className="mx-auto h-8 w-8 text-textSecondary" />
              <p className="mt-2 text-sm text-textSecondary">No reports yet</p>
              <Link href="/reports/new" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <Plus className="h-3.5 w-3.5" /> Create your first report
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Connected Datasources */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Connected Datasources</h2>
          </div>
          <Link href="/datasources" className="text-sm text-primary hover:underline">
            Manage
          </Link>
        </div>
        {datasources && datasources.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {datasources.map((ds: any) => (
              <div key={ds.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
                  <Database className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{ds.name}</p>
                  <p className="text-xs text-textSecondary">{ds.host}:{ds.port}/{ds.database}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Database className="mx-auto h-8 w-8 text-textSecondary" />
            <p className="mt-2 text-sm text-textSecondary">No datasources connected</p>
            <Link href="/datasources/new" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Connect a database
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
