const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(e.detail || 'Request failed'); }
  return r.json();
}

/* Datasources */
export const listDatasources = () => req<{ datasources: any[] }>('/datasources').then(d => d.datasources);
export const createDatasource = (ds: any) => req('/datasources', { method: 'POST', body: JSON.stringify(ds) });
export const getSchema = (id: string) => req<any>(`/datasources/${id}/schema`);
export const deleteDatasource = (id: string) => req(`/datasources/${id}`, { method: 'DELETE' });

/* Reports / Questions */
export const listReports = () => req<{ reports: any[] }>('/reports').then(d => d.reports);
export const getReport = (id: string) => req<any>(`/reports/${id}`);
export const createReport = (r: any) => req('/reports', { method: 'POST', body: JSON.stringify(r) });
export const deleteReport = (id: string) => req(`/reports/${id}`, { method: 'DELETE' });
export const runReport = (id: string) => req<any>(`/reports/${id}/run`);
export const createReportRaw = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return req(`/reports/raw?${qs}`, { method: 'POST' });
};

/* Raw SQL */
export const runRawQuery = (dsId: string, sql: string) => {
  return req<any>(`/query/run?datasource_id=${encodeURIComponent(dsId)}&sql=${encodeURIComponent(sql)}`, { method: 'POST' });
};

/* Exports */
export const exportUrl = (id: string, fmt: string) => `${API}/reports/${id}/export/${fmt}`;
export const downloadReport = async (id: string, fmt: string) => {
  const r = await fetch(exportUrl(id, fmt));
  if (!r.ok) throw new Error('Export failed');
  const blob = await r.blob();
  const ext = fmt === 'excel' ? 'xlsx' : fmt === 'word' ? 'docx' : fmt;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `report.${ext}`;
  a.click();
};

/* AI */
export const listAIProviders = () => req<{ providers: any[] }>('/ai/providers').then(d => d.providers);
export const generateAIQuery = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return req<any>(`/ai/generate-query?${qs}`, { method: 'POST' });
};
export const explainReport = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return req<any>(`/ai/explain-report?${qs}`, { method: 'POST' });
};

/* Theme */
export const getTheme = () => req<any>('/theme');
export const updateTheme = (t: any) => req('/theme', { method: 'PUT', body: JSON.stringify(t) });
export const getStats = () => req<{ datasources: number; reports: number }>('/health/stats');
