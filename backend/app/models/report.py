from pydantic import BaseModel
from typing import List, Optional, Any

class DatasourceCreate(BaseModel):
    name: str
    host: str
    port: int = 5432
    database: str
    username: str
    password: str

class ColumnSchema(BaseModel):
    name: str
    type: str

class TableSchema(BaseModel):
    name: str
    columns: List[ColumnSchema]

class DatabaseSchema(BaseModel):
    tables: List[TableSchema]

class FilterConfig(BaseModel):
    field: str
    operator: str
    value: Any

class AggregationConfig(BaseModel):
    type: str
    field: str

class QueryConfig(BaseModel):
    select: Optional[List[str]] = None
    aggregations: Optional[List[AggregationConfig]] = None
    filters: Optional[List[FilterConfig]] = None
    group_by: Optional[List[str]] = None

class ReportCreate(BaseModel):
    name: str
    datasource_id: str
    query: QueryConfig
    visualization: str
    sql: Optional[str] = None  # Direct SQL that bypasses build_dynamic_sql
