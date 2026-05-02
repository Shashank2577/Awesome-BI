/* ── Core Types for Awesome BI ── */

export interface Datasource {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
}

export interface DatasourceCreate {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  description?: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface DatabaseSchema {
  tables: TableSchema[];
}

export interface FilterConfig {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE';
  value: string | number;
}

export interface AggregationConfig {
  type: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
  field: string;
}

export interface QueryConfig {
  select?: string[];
  aggregations?: AggregationConfig[];
  filters?: FilterConfig[];
  group_by?: string[];
  sql?: string;
  explanation?: string;
}

export interface Report {
  id: string;
  name: string;
  datasource_id: string;
  datasource_name?: string;
  query: QueryConfig;
  visualization: 'table' | 'bar' | 'line' | 'pie' | 'area' | 'scatter';
}

export interface ReportCreate {
  name: string;
  datasource_id: string;
  query: QueryConfig;
  visualization: string;
}

export interface ReportResult {
  columns: string[];
  rows: (string | number | null)[][];
  sql: string;
}

export interface AIProvider {
  id: string;
  name: string;
  default_model: string;
}

export interface AIQueryResult extends QueryConfig {}

export interface AIExplanation {
  explanation: string;
  summary: {
    row_count: number;
    columns: string[];
    column_summaries: Record<string, {
      type: 'numeric' | 'categorical';
      min?: number;
      max?: number;
      average?: number;
      top_categories?: { value: string; count: number }[];
      unique_count?: number;
      non_null_count: number;
    }>;
  };
}

export interface Theme {
  name: string;
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  fonts: { heading: string; body: string };
  borderRadius: number;
  logo: string | null;
  branding: {
    companyName: string;
    tagline: string;
  };
}

export type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf' | 'word';

export type VisualizationType = 'table' | 'bar' | 'line' | 'pie' | 'area' | 'scatter';
