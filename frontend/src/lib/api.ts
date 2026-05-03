/* ── API Client for Awesome BI Backend ── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

/* ── Datasources ── */

export async function listDatasources() {
  const data = await request<{ datasources: any[] }>('/datasources');
  return data.datasources;
}

export async function createDatasource(ds: any) {
  return request<{ id: string }>('/datasources', {
    method: 'POST',
    body: JSON.stringify(ds),
  });
}

export async function getDatasourceSchema(id: string) {
  return request<any>(`/datasources/${id}/schema`);
}

export async function testDatasourceConnection(id: string) {
  return request<{ status: string; message: string }>(`/datasources/${id}/test`, {
    method: 'POST',
  });
}

export async function deleteDatasource(id: string) {
  return request<{ message: string }>(`/datasources/${id}`, {
    method: 'DELETE',
  });
}

/* ── Reports ── */

export async function listReports() {
  const data = await request<{ reports: any[] }>('/reports');
  return data.reports;
}

export async function createReport(report: any) {
  return request<{ id: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export async function getReport(id: string) {
  return request<any>(`/reports/${id}`);
}

export async function runReport(id: string) {
  return request<any>(`/reports/${id}/run`);
}

export async function deleteReport(id: string) {
  return request<{ message: string }>(`/reports/${id}`, {
    method: 'DELETE',
  });
}

/* ── Exports ── */

export function exportReportUrl(id: string, format: string): string {
  return `${API_BASE}/reports/${id}/export/${format}`;
}

export async function downloadReport(id: string, format: string) {
  const url = exportReportUrl(id, format);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format;
  const filename = `report_${id}.${ext}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ── Raw SQL ── */

export async function runRawQuery(datasourceId: string, sql: string) {
  const searchParams = new URLSearchParams();
  searchParams.set('datasource_id', datasourceId);
  searchParams.set('sql', sql);
  return request<any>(`/query/run?${searchParams.toString()}`, {
    method: 'POST',
  });
}

/* ── AI ── */

export async function listAIProviders() {
  const data = await request<{ providers: any[] }>('/ai/providers');
  return data.providers;
}

export async function generateAIQuery(params: {
  datasource_id: string;
  prompt: string;
  api_key: string;
  provider?: string;
  model?: string;
  base_url?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('datasource_id', params.datasource_id);
  searchParams.set('prompt', params.prompt);
  searchParams.set('api_key', params.api_key);
  if (params.provider) searchParams.set('provider', params.provider);
  if (params.model) searchParams.set('model', params.model);
  if (params.base_url) searchParams.set('base_url', params.base_url);
  return request<any>(`/ai/generate-query?${searchParams.toString()}`, {
    method: 'POST',
  });
}

export async function explainReport(params: {
  report_id: string;
  api_key: string;
  provider?: string;
  model?: string;
  base_url?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('report_id', params.report_id);
  searchParams.set('api_key', params.api_key);
  if (params.provider) searchParams.set('provider', params.provider);
  if (params.model) searchParams.set('model', params.model);
  if (params.base_url) searchParams.set('base_url', params.base_url);
  return request<any>(`/ai/explain-report?${searchParams.toString()}`, {
    method: 'POST',
  });
}

/* ── Theme ── */

export async function getTheme() {
  return request<any>('/theme');
}

export async function updateTheme(theme: any) {
  return request<any>('/theme', {
    method: 'PUT',
    body: JSON.stringify(theme),
  });
}

export async function resetTheme() {
  return request<any>('/theme/reset', { method: 'POST' });
}

/* ── Stats ── */

export async function getStats() {
  return request<{ datasources: number; reports: number; ai_providers: number }>('/health/stats');
}
