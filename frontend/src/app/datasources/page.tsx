'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Database, Plus, Trash2, Loader2, CheckCircle, XCircle,
  Eye, EyeOff, RefreshCw, ChevronRight,
} from 'lucide-react';
import {
  listDatasources, createDatasource, deleteDatasource,
  getDatasourceSchema, testDatasourceConnection,
} from '@/lib/api';
import toast from 'react-hot-toast';

export default function DatasourcesPage() {
  const queryClient = useQueryClient();
  const { data: datasources, isLoading } = useQuery({
    queryKey: ['datasources'],
    queryFn: listDatasources,
  });

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDs, setNewDs] = useState({
    name: '', host: 'localhost', port: 5432, database: '', username: '', password: '',
  });
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [schemaData, setSchemaData] = useState<any>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: string; message: string }>>({});

  const createMutation = useMutation({
    mutationFn: createDatasource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      setShowNewForm(false);
      setNewDs({ name: '', host: 'localhost', port: 5432, database: '', username: '', password: '' });
      toast.success('Datasource connected!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDatasource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      toast.success('Datasource removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleViewSchema = async (id: string) => {
    if (expandedSchema === id) {
      setExpandedSchema(null);
      return;
    }
    try {
      const schema = await getDatasourceSchema(id);
      setSchemaData(schema);
      setExpandedSchema(id);
    } catch (e: any) {
      toast.error('Failed to load schema: ' + e.message);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const result = await testDatasourceConnection(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
      toast.success(result.status === 'ok' ? 'Connection OK' : 'Test result: ' + result.message);
    } catch (e: any) {
      toast.error('Test failed: ' + e.message);
    }
  };

  return (
    <div className="animate-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Datasources</h1>
          <p className="mt-1 text-textSecondary">Manage your database connections.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Datasource
        </button>
      </div>

      {/* Help handout */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>💡 Getting started:</strong> Connect your database here. We support PostgreSQL and SQLite.
          Your credentials are stored locally and never shared with AI models.
          AI only sees column names and types, not your actual data.
        </p>
      </div>

      {/* New Datasource Form */}
      {showNewForm && (
        <div className="rounded-xl border border-border bg-surface p-6 glass">
          <h2 className="text-lg font-semibold mb-4">Connect New Database</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={newDs.name}
                onChange={(e) => setNewDs({ ...newDs, name: e.target.value })}
                placeholder="e.g., Production DB"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Host</label>
              <input
                type="text"
                value={newDs.host}
                onChange={(e) => setNewDs({ ...newDs, host: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <input
                type="number"
                value={newDs.port}
                onChange={(e) => setNewDs({ ...newDs, port: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Database</label>
              <input
                type="text"
                value={newDs.database}
                onChange={(e) => setNewDs({ ...newDs, database: e.target.value })}
                placeholder="reporting"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={newDs.username}
                onChange={(e) => setNewDs({ ...newDs, username: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={newDs.password}
                onChange={(e) => setNewDs({ ...newDs, password: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => createMutation.mutate(newDs)}
              disabled={createMutation.isPending || !newDs.name}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Connect
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Datasource List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-textSecondary" />
        </div>
      ) : datasources && datasources.length > 0 ? (
        <div className="space-y-3">
          {datasources.map((ds: any) => (
            <div key={ds.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{ds.name}</p>
                    <p className="text-xs text-textSecondary">{ds.host}:{ds.port}/{ds.database}</p>
                  </div>
                  {testResults[ds.id] && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      testResults[ds.id].status === 'ok'
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {testResults[ds.id].status === 'ok' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {testResults[ds.id].status === 'ok' ? 'Connected' : 'Failed'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(ds.id)}
                    className="rounded-lg p-2 text-textSecondary hover:bg-surface-hover hover:text-text transition-colors"
                    title="Test connection"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleViewSchema(ds.id)}
                    className="rounded-lg p-2 text-textSecondary hover:bg-surface-hover hover:text-text transition-colors"
                    title="View schema"
                  >
                    {expandedSchema === ds.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this datasource and all its reports?')) deleteMutation.mutate(ds.id); }}
                    className="rounded-lg p-2 text-textSecondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Schema Viewer */}
              {expandedSchema === ds.id && schemaData && (
                <div className="border-t border-border bg-background p-4 animate-in">
                  <h3 className="text-sm font-semibold mb-3">Schema</h3>
                  <div className="space-y-3">
                    {schemaData.tables?.map((table: any) => (
                      <div key={table.name} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <ChevronRight className="h-3.5 w-3.5" />
                          {table.name}
                          <span className="text-xs text-textSecondary">({table.columns?.length || 0} columns)</span>
                        </p>
                        <div className="ml-5 grid grid-cols-2 gap-1">
                          {table.columns?.map((col: any) => (
                            <div key={col.name} className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-primary">{col.name}</span>
                              <span className="text-textSecondary">{col.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Database className="mx-auto h-12 w-12 text-textSecondary" />
          <p className="mt-4 text-lg font-medium">No datasources yet</p>
          <p className="mt-1 text-sm text-textSecondary">Connect your first database to start building reports.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Connect Database
          </button>
        </div>
      )}
    </div>
  );
}
