import json
import sqlite3
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

ALLOWED_AGGS = {"SUM", "COUNT", "AVG", "MIN", "MAX"}
ALLOWED_FILTERS = {"=", ">", "<", ">=", "<=", "!=", "LIKE"}

@dataclass
class Report:
    name: str
    table: str
    query: dict[str, Any]
    visualization: str = "table"

def create_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("ATTACH DATABASE ':memory:' AS analytics")
    return conn

def seed_database(conn: sqlite3.Connection) -> None:
    conn.executescript(open('src/schema.sql').read())

def allowed_tables() -> set[str]:
    return {"orders", "order_items", "customers", "products", "analytics.daily_revenue"}

def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    if "." in table:
        schema, name = table.split(".", 1)
        rows = conn.execute(f"PRAGMA {schema}.table_info({name})").fetchall()
    else:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {r[1] for r in rows}

def build_select(conn: sqlite3.Connection, table: str, report_query: dict[str, Any]) -> tuple[str, list[Any]]:
    if table not in allowed_tables():
        raise ValueError("Table not allowed")
    known_cols = table_columns(conn, table)
    select_cols = report_query.get("select", [])
    group_by = report_query.get("group_by", [])
    aggs = report_query.get("aggregations", [])
    filters = report_query.get("filters", [])
    parts=[]
    for col in select_cols:
        if col not in known_cols: raise ValueError(f"Unknown column: {col}")
        parts.append(col)
    for agg in aggs:
        t=agg['type'].upper(); f=agg['field']
        if t not in ALLOWED_AGGS: raise ValueError("Bad agg")
        if f not in known_cols: raise ValueError("Bad field")
        parts.append(f"{t}({f}) AS {t.lower()}_{f}")
    if not parts: raise ValueError("Empty query")
    where=[]; params=[]
    for flt in filters:
        op=flt['operator'].upper(); field=flt['field']
        if op not in ALLOWED_FILTERS or field not in known_cols: raise ValueError("Bad filter")
        where.append(f"{field} {op} ?"); params.append(flt['value'])
    query=f"SELECT {', '.join(parts)} FROM {table}"
    if where: query += " WHERE " + " AND ".join(where)
    if group_by: query += " GROUP BY " + ", ".join(group_by)
    query += " LIMIT 1000"
    return query, params

def run_report(conn, report: Report):
    sql, params=build_select(conn, report.table, report.query)
    rows=conn.execute(sql, params).fetchall(); cols=list(rows[0].keys()) if rows else []
    return {"columns":cols,"rows":[[r[c] for c in cols] for r in rows],"row_count":len(rows),"sql":sql}

def schema_metadata(conn):
    return {"tables":[{"name":t,"columns":sorted(table_columns(conn,t))} for t in sorted(allowed_tables())]}

def simulate_ai_suggestion(prompt, schema):
    if "revenue" in prompt.lower():
        return {"action":"create","table":"analytics.daily_revenue","query":{"select":["region"],"aggregations":[{"type":"SUM","field":"revenue"}],"filters":[],"group_by":["region"]},"visualization":"bar","metadata_tables_seen":len(schema['tables'])}
    return {"action":"create","table":"orders","query":{"select":["order_date"],"aggregations":[{"type":"COUNT","field":"order_id"}],"filters":[],"group_by":["order_date"]},"visualization":"line","metadata_tables_seen":len(schema['tables'])}

def home_html():
    return """<!doctype html><html><body><h1>Awesome BI Local UI</h1><p>Endpoints: /api/schema /api/reports/run /api/ai/suggest</p></body></html>"""

if __name__=='__main__':
    conn=create_connection(); seed_database(conn)
    print(json.dumps(run_report(conn, Report('Revenue','analytics.daily_revenue',{"select":["region"],"aggregations":[{"type":"SUM","field":"revenue"}],"filters":[],"group_by":["region"]})), indent=2))
