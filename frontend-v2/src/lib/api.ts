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
export const discoverDatabases = (host: string, port: number, username: string, password: string) =>
  req<{ databases: string[] }>(`/datasources/discover?host=${encodeURIComponent(host)}&port=${port}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, { method: 'POST' });

/* Reports / Questions */
export const listReports = () => req<{ reports: any[] }>('/reports').then(d => d.reports);
export const getReport = (id: string) => req<any>(`/reports/${id}`);
export const createReport = (r: any) => req('/reports', { method: 'POST', body: JSON.stringify(r) });
export const deleteReport = (id: string) => req(`/reports/${id}`, { method: 'DELETE' });
export const runReport = (id: string, dsId?: string) => req<any>(`/reports/${id}/run${dsId ? `?datasource_id=${encodeURIComponent(dsId)}` : ''}`);
export const getReportDatasources = (id: string) => req<{ datasources: any[] }>(`/reports/${id}/datasources`).then(d => d.datasources);
export const linkDatasourceToReport = (reportId: string, dsId: string) => req(`/reports/${reportId}/datasources?datasource_id=${encodeURIComponent(dsId)}`, { method: 'POST' });
export const unlinkDatasourceFromReport = (reportId: string, dsId: string) => req(`/reports/${reportId}/datasources/${dsId}`, { method: 'DELETE' });
export const getCompatibleDatasources = (dsId: string) => req<{ compatible: any[] }>(`/datasources/compatible?reference_ds_id=${encodeURIComponent(dsId)}`).then(d => d.compatible);
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
export const downloadReport = async (id: string, fmt: string, opts?: { chartImage?: string; aiSummary?: string }) => {
  const url = exportUrl(id, fmt);
  const hasBody = opts?.chartImage || opts?.aiSummary;
  const r = await fetch(url, hasBody ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart_image: opts?.chartImage || null, ai_summary: opts?.aiSummary || null }),
  } : { method: 'GET' });
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

/* Dashboards */
export const listDashboards = () => req<{ dashboards: any[] }>('/dashboards').then(d => d.dashboards);
export const getDashboard = (id: string) => req<any>(`/dashboards/${id}`);
export const createDashboard = (name: string, desc = '') => req(`/dashboards?name=${encodeURIComponent(name)}&description=${encodeURIComponent(desc)}`, { method: 'POST' });
export const deleteDashboard = (id: string) => req(`/dashboards/${id}`, { method: 'DELETE' });
export const addCardToDashboard = (dashId: string, reportId: string, row: number, col: number) => req(`/dashboards/${dashId}/cards?report_id=${reportId}&row=${row}&col=${col}`, { method: 'POST' });
export const removeCard = (dashId: string, cardId: string) => req(`/dashboards/${dashId}/cards/${cardId}`, { method: 'DELETE' });

/* Theme */
export const getTheme = () => req<any>('/theme');
export const updateTheme = (t: any) => req('/theme', { method: 'PUT', body: JSON.stringify(t) });
export const getStats = () => req<{ datasources: number; reports: number; dashboards: number }>('/health/stats');
