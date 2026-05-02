'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Settings, Palette, Sparkles, Database, RotateCcw, Save,
  Sun, Moon, Loader2, Info,
} from 'lucide-react';
import { getTheme, updateTheme, resetTheme, listAIProviders } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: theme, isLoading: themeLoading } = useQuery({
    queryKey: ['theme'],
    queryFn: getTheme,
  });

  const { data: providers } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: listAIProviders,
  });

  const [localTheme, setLocalTheme] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'appearance' | 'ai'>('appearance');

  const themeMutation = useMutation({
    mutationFn: updateTheme,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['theme'] });
      setLocalTheme(data.theme);
      toast.success('Theme saved!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: resetTheme,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['theme'] });
      setLocalTheme(data.theme);
      toast.success('Theme reset to defaults');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeTheme = localTheme || theme;

  const updateColor = (key: string, value: string) => {
    const updated = { ...activeTheme };
    const keys = key.split('.');
    if (keys.length === 2) {
      updated[keys[0]][keys[1]] = value;
    } else {
      updated[key] = value;
    }
    setLocalTheme(updated);
  };

  if (themeLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-textSecondary" />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-textSecondary">Customize your BI experience.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        {[
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'ai', label: 'AI Configuration', icon: Sparkles },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ' +
              (activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-textSecondary hover:text-text')}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appearance Tab */}
      {activeTab === 'appearance' && activeTheme && (
        <div className="space-y-6">
          {/* Branding */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Branding
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  value={activeTheme.branding?.companyName || ''}
                  onChange={(e) => updateColor('branding.companyName', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tagline</label>
                <input
                  type="text"
                  value={activeTheme.branding?.tagline || ''}
                  onChange={(e) => updateColor('branding.tagline', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-500" />
              Color Palette
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { key: 'primary', label: 'Primary' },
                { key: 'secondary', label: 'Secondary' },
                { key: 'accent', label: 'Accent' },
                { key: 'background', label: 'Background' },
                { key: 'surface', label: 'Surface' },
                { key: 'text', label: 'Text' },
                { key: 'textSecondary', label: 'Text Secondary' },
                { key: 'border', label: 'Border' },
                { key: 'success', label: 'Success' },
                { key: 'warning', label: 'Warning' },
                { key: 'error', label: 'Error' },
                { key: 'info', label: 'Info' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeTheme.colors?.[key] || '#000000'}
                      onChange={(e) => updateColor(`colors.${key}`, e.target.value)}
                      className="h-8 w-8 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={activeTheme.colors?.[key] || ''}
                      onChange={(e) => updateColor(`colors.${key}`, e.target.value)}
                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {['primary', 'secondary', 'accent', 'success', 'warning', 'error'].map((key) => (
                <div
                  key={key}
                  className="h-16 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: activeTheme.colors?.[key] }}
                >
                  <span className="text-xs font-medium text-white drop-shadow">{key}</span>
                </div>
              ))}
            </div>
            <div
              className="mt-4 rounded-lg p-4 text-sm"
              style={{
                backgroundColor: activeTheme.colors?.surface,
                color: activeTheme.colors?.text,
                border: `1px solid ${activeTheme.colors?.border}`,
              }}
            >
              <p style={{ fontWeight: 600 }}>Sample Card Title</p>
              <p style={{ color: activeTheme.colors?.textSecondary }}>This is how your text will look on surfaces.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => themeMutation.mutate(activeTheme)}
              disabled={themeMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {themeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Theme
            </button>
            <button
              onClick={() => resetMutation.mutate({} as any)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* AI Configuration Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Supported AI Providers
            </h2>
            <p className="text-sm text-textSecondary mb-4">
              Configure your API keys as environment variables or enter them per-use in the report builder.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(providers || []).map((p: any) => (
                <div key={p.id} className="rounded-lg border border-border p-4 hover:border-primary/30 transition-colors">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-textSecondary mt-1">Default: {p.default_model}</p>
                  <p className="text-xs text-textSecondary mt-1">
                    Env: {p.id === 'anthropic'
                      ? 'ANTHROPIC_API_KEY'
                      : p.id === 'deepseek'
                      ? 'DEEPSEEK_API_KEY'
                      : p.id === 'gemini'
                      ? 'GEMINI_API_KEY'
                      : p.id === 'openai'
                      ? 'OPENAI_API_KEY'
                      : 'CUSTOM_API_KEY'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>🔒 Security note:</strong> AI models only receive database metadata
              (column names and data types), never actual row data. Your sensitive data stays
              private and is never sent to external AI APIs. Custom endpoints allow you to
              use self-hosted LLMs for complete data locality.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
