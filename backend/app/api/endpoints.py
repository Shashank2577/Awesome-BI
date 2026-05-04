from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import uuid
import sqlite3
import json
import psycopg2
import psycopg2.extras
import os
import time

from app.models.report import DatasourceCreate, DatabaseSchema, ReportCreate

router = APIRouter()

# Orchestration database for internal metadata (datasources, reports)
ORCHESTRATION_DB = "orchestration.db"

# Environment variables for default reporting database (if using Postgres)
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "reporting")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")

USE_POSTGRES = bool(DB_HOST)
DEFAULT_DB_FILE = "reporting.db"

def get_orchestration_connection():
    conn = sqlite3.connect(ORCHESTRATION_DB)
    conn.row_factory = sqlite3.Row
    return conn

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_datasource_connection(ds_id: str = None):
    logger.info(f"Getting connection for ds_id={ds_id}")
    if ds_id:
        orch_conn = get_orchestration_connection()
        cur = orch_conn.cursor()
        cur.execute("SELECT * FROM datasources WHERE id = ?", (ds_id,))
        ds = cur.fetchone()
        orch_conn.close()
        if not ds:
            logger.error(f"Datasource {ds_id} not found in orchestration")
            raise HTTPException(status_code=404, detail="Datasource not found")
        
        logger.info(f"Found datasource: {ds['name']} at {ds['host']}")
        if ds["host"] and ds["host"] != "localhost":
            logger.info(f"Connecting to external POSTGRES at {ds['host']}:{ds['port']}")
            try:
                return psycopg2.connect(
                    host=ds["host"],
                    port=ds["port"],
                    database=ds["database"],
                    user=ds["username"],
                    password=ds["password"],
                    connect_timeout=10
                )
            except Exception as e:
                logger.error(f"External connection failed: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to connect to external DB: {str(e)}")
    
    logger.info(f"Falling back to default connection (USE_POSTGRES={USE_POSTGRES})")
    if USE_POSTGRES:
        return psycopg2.connect(host=DB_HOST, port=DB_PORT, database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    else:
        conn = sqlite3.connect(DEFAULT_DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    # 1. Initialize Orchestration DB
    orch_conn = get_orchestration_connection()
    orch_cur = orch_conn.cursor()
    orch_cur.execute("CREATE TABLE IF NOT EXISTS datasources (id TEXT PRIMARY KEY, name TEXT, host TEXT, port INTEGER, database TEXT, username TEXT, password TEXT)")
    orch_cur.execute("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, name TEXT, datasource_id TEXT, query TEXT, visualization TEXT, sql TEXT)")
    orch_cur.execute("CREATE TABLE IF NOT EXISTS dashboards (id TEXT PRIMARY KEY, name TEXT, description TEXT)")
    orch_cur.execute("CREATE TABLE IF NOT EXISTS dashboard_cards (id TEXT PRIMARY KEY, dashboard_id TEXT, report_id TEXT, row INTEGER, col INTEGER, width INTEGER DEFAULT 4, height INTEGER DEFAULT 3)")
    # Migration: add sql column to existing table if missing
    try:
        orch_cur.execute("ALTER TABLE reports ADD COLUMN sql TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists
    orch_conn.commit()
    orch_conn.close()

    # 2. Initialize Default Reporting DB (Seed data)
    try:
        conn = get_datasource_connection()
        cur = conn.cursor()
        if not USE_POSTGRES:
            cur.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, email TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
            cur.execute("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount REAL NOT NULL, status TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))")
            cur.execute("SELECT count(*) from users")
            if cur.fetchone()[0] == 0:
                cur.execute("INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com'), ('bob', 'bob@example.com')")
                cur.execute("INSERT INTO orders (user_id, amount, status) VALUES (1, 150.00, 'completed'), (2, 200.50, 'completed')")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing reporting DB: {e}")

init_db()

@router.post("/datasources", status_code=201)
def create_datasource(datasource: DatasourceCreate):
    ds_id = str(uuid.uuid4())
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO datasources (id, name, host, port, database, username, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (ds_id, datasource.name, datasource.host, datasource.port, datasource.database, datasource.username, datasource.password))
    conn.commit()
    conn.close()
    return {"id": ds_id, "message": "Datasource created successfully"}

@router.get("/datasources/{id}/schema", response_model=DatabaseSchema)
def get_datasource_schema(id: str):
    # Connect to the actual datasource
    conn = get_datasource_connection(id)
    
    schema = {"tables": []}
    try:
        if isinstance(conn, psycopg2.extensions.connection):
            cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            
            # DEBUG: List all databases
            cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
            dbs = [r[0] for r in cur.fetchall()]
            logger.info(f"Available databases on server: {dbs}")

            # Fetch tables from all schemas except internal ones
            cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')")
            tables = cur.fetchall()
            logger.info(f"Found tables in current DB ({conn.info.dbname}): {[(t['table_schema'], t['table_name']) for t in tables]}")
            for table_row in tables:
                table_schema = table_row["table_schema"]
                table_name = table_row["table_name"]
                full_name = f"{table_schema}.{table_name}"
                cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = %s AND table_name = %s", (table_schema, table_name))
                schema["tables"].append({"name": full_name, "columns": [{"name": c["column_name"], "type": c["data_type"]} for c in cur.fetchall()]})
        else:
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence')")
            tables = cur.fetchall()
            for table_row in tables:
                table_name = table_row["name"]
                cur.execute(f"PRAGMA table_info({table_name})")
                schema["tables"].append({"name": table_name, "columns": [{"name": c[1], "type": c[2]} for c in cur.fetchall()]})
    finally:
        conn.close()

    return schema

@router.post("/reports", status_code=201)
def create_report(report: ReportCreate):
    report_id = str(uuid.uuid4())
    conn = get_orchestration_connection()
    cur = conn.cursor()
    query_json = json.dumps(report.query.model_dump())
    cur.execute("INSERT INTO reports (id, name, datasource_id, query, visualization, sql) VALUES (?, ?, ?, ?, ?, ?)",
        (report_id, report.name, report.datasource_id, query_json, report.visualization, report.sql))
    conn.commit()
    conn.close()
    return {"id": report_id, "message": "Report created successfully"}

def build_dynamic_sql(query_config: Dict[str, Any], schema: DatabaseSchema) -> str:
    """
    Builds SQL from QueryConfig by introspecting actual database schema.
    Works with ANY database — auto-detects tables from column references.
    """
    select_fields = query_config.get("select") or []
    aggregations = query_config.get("aggregations") or []
    filters = query_config.get("filters") or []
    group_by = query_config.get("group_by") or []

    # Build column index across ALL tables: col_name -> [(table, full_ref)]
    col_index: Dict[str, List[tuple]] = {}
    for table in schema.tables:
        for col in table.columns:
            key = col.name.lower()
            full = f'"{table.name}"."{col.name}"'
            if key not in col_index:
                col_index[key] = []
            col_index[key].append((table.name, full))

    # Collect all referenced columns
    all_refs = list(select_fields) + [a.get("field", "") for a in aggregations] +                [f.get("field", "") for f in filters] + list(group_by)

    available: Dict[str, str] = {}
    needed_tables: set = set()
    for ref in all_refs:
        if ref and ref.lower() in col_index:
            entries = col_index[ref.lower()]
            available[ref] = entries[0][1]
            needed_tables.add(entries[0][0])

    if not schema.tables:
        return "SELECT 1"

    # Single table (or none referenced): use that one
    if len(needed_tables) <= 1:
        tbl = list(needed_tables)[0] if needed_tables else schema.tables[0].name
        from_clause = tbl
    else:
        # Multi-table: use the one with most column matches as primary
        scores = {t: sum(1 for r in all_refs if r and r.lower() in col_index
                   and any(x[0] == t for x in col_index[r.lower()]))
                   for t in needed_tables}
        primary = max(scores, key=scores.get)
        from_clause = primary

    # Build SELECT
    sql_selects = []
    for f in select_fields:
        sql_selects.append(available.get(f, f))
    for agg in aggregations:
        agg_type = agg.get("type", "COUNT")
        agg_field = agg.get("field", "*")
        col_ref = available.get(agg_field, agg_field)
        sql_selects.append(f'{agg_type}({col_ref}) as {agg_type.lower()}_{agg_field}')
    if not sql_selects:
        sql_selects = ["*"]

    sql = f"SELECT {', '.join(sql_selects)} FROM {from_clause}"

    # WHERE
    where_clauses = []
    valid_ops = {"=", "!=", ">", "<", ">=", "<=", "LIKE", "IN"}
    for f in filters:
        field = f.get("field", "")
        op = str(f.get("operator", "=")).upper()
        val = f.get("value")
        if field in available and op in valid_ops:
            col_ref = available[field]
            if isinstance(val, str):
                escaped = val.replace("'", "''")
                where_clauses.append(f"{col_ref} {op} '{escaped}'")
            else:
                where_clauses.append(f"{col_ref} {op} {val}")
    if where_clauses:
        sql += f" WHERE {' AND '.join(where_clauses)}"

    # GROUP BY
    if group_by:
        gb = [available.get(f, f) for f in group_by]
        sql += f" GROUP BY {', '.join(gb)}"

    return sql

# ─── AI Provider Imports ───────────────────────────────────────────
from app.ai.providers import (
    AIProviderConfig, create_provider, get_available_providers, AnthropicProvider
)
from app.ai.security import sanitize_schema_for_ai, build_metadata_prompt


# ─── AI: Multi-Provider Query Generation ──────────────────────────

@router.post("/ai/generate-query")
async def generate_ai_query(datasource_id: str, prompt: str, api_key: str,
                             provider: str = "anthropic", model: str = None,
                             base_url: str = None):
    """
    Generate SQL query configuration from natural language using AI.
    Supports: anthropic, deepseek, openai, custom.
    AI ONLY sees column names and types - never actual data values.
    """
    # 1. Get raw schema from datasource
    raw_schema = get_datasource_schema(datasource_id)

    # 2. SANITIZE - strip all data, keep only metadata (column names + types)
    safe_schema = sanitize_schema_for_ai(raw_schema)
    metadata_text = build_metadata_prompt(datasource_id, safe_schema)

    # 3. Create AI provider from config
    ai_config = AIProviderConfig(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.1,
    )
    ai = create_provider(ai_config)

    system_prompt = """You are a SQL and BI expert. You receive ONLY database schema metadata
(column names and data types). Generate a JSON query configuration.
Never attempt to access or infer actual data values."""

    user_prompt = f"""{metadata_text}

USER REQUEST: {prompt}

Return ONLY JSON:
{{
    "select": ["column1", "column2"],
    "aggregations": [{{ "type": "SUM|COUNT|AVG|MIN|MAX", "field": "column" }}],
    "filters": [{{ "field": "column", "operator": "=|>|<|LIKE", "value": "value" }}],
    "group_by": ["column1"],
    "explanation": "Brief explanation of what this query does"
}}
Use column names only (no table prefixes). Backend handles joins automatically."""

    try:
        result = await ai.generate_json(system_prompt, user_prompt)

        # Build actual SQL
        sql = build_dynamic_sql(result, DatabaseSchema(**raw_schema))
        result["sql"] = sql

        return result
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── AI: List Available Providers ─────────────────────────────────

@router.get("/ai/providers")
def list_ai_providers():
    """Return available AI providers and their default models."""
    return {"providers": get_available_providers()}


# ─── AI: Explain Report Data ──────────────────────────────────────

@router.post("/ai/explain-report")
async def explain_report(report_id: str, api_key: str,
                          provider: str = "anthropic", model: str = None,
                          base_url: str = None):
    """
    Generate a natural language explanation of a report's data.
    AI receives aggregate statistics about the report, not raw row data.
    """
    # Run the report
    report_data = run_report(report_id)

    if not report_data.get("rows"):
        return {"explanation": "No data available in this report to explain."}

    # Build safe summary (aggregates only, no individual rows)
    columns = report_data["columns"]
    rows = report_data["rows"]
    row_count = len(rows)

    # Compute safe aggregates
    summary = {
        "row_count": row_count,
        "columns": columns,
        "column_summaries": {},
    }

    for idx, col in enumerate(columns):
        values = [row[idx] for row in rows if row[idx] is not None]
        if not values:
            continue

        col_summary = {"non_null_count": len(values)}

        # Numeric columns: min/max/avg only (no individual values)
        try:
            numeric_vals = [float(v) for v in values]
            col_summary["type"] = "numeric"
            col_summary["min"] = min(numeric_vals)
            col_summary["max"] = max(numeric_vals)
            col_summary["average"] = round(sum(numeric_vals) / len(numeric_vals), 2)
        except (ValueError, TypeError):
            # Categorical: top categories only
            col_summary["type"] = "categorical"
            from collections import Counter
            top_cats = Counter([str(v) for v in values]).most_common(5)
            col_summary["top_categories"] = [{"value": v, "count": c} for v, c in top_cats]
            col_summary["unique_count"] = len(set(str(v) for v in values))

        summary["column_summaries"][col] = col_summary

    # Build AI prompt with aggregates only
    ai_config = AIProviderConfig(provider=provider, api_key=api_key, model=model, base_url=base_url)
    ai = create_provider(ai_config)

    system_prompt = """You are a data analyst. Given aggregate statistics about a report,
write a clear, insightful explanation using MARKDOWN formatting. Use:
- ## headings for sections
- **bold** for key numbers and findings
- - bullet points for lists
- > blockquotes for important takeaways
- `code` for column/field names
- --- horizontal rules between major sections
Make it visually scannable and professional."""

    user_prompt = f"""Report aggregate summary (NO individual data values):
{json.dumps(summary, indent=2, default=str)}

Write a markdown-formatted report explanation with these sections:

## Overview
What this report shows in 2-3 sentences.

## Key Findings
- Bullet points of the most important patterns with **bold numbers**

## Notable Patterns
Any outliers, trends, or surprising data points

## Recommendations
Business actions based on the data

---
> **Summary:** One-sentence bottom-line takeaway"""

    try:
        explanation = await ai.generate(system_prompt, user_prompt)
        return {"explanation": explanation, "summary": summary}
    except Exception as e:
        logger.error(f"AI explanation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _clean_metabase_templates(sql: str) -> str:
    """Strip Metabase template syntax: [[ ... ]] and {{variable}}."""
    import re
    sql = re.sub(r'\[\[.*?\]\]', '', sql)
    sql = re.sub(r'\{\{.*?\}\}', 'NULL', sql)
    sql = re.sub(r'WHERE\s+AND', 'WHERE', sql)
    sql = re.sub(r'WHERE\s+OR', 'WHERE', sql)
    sql = re.sub(r'\s+', ' ', sql)
    return sql.strip()


@router.get("/reports/{id}/run")
def run_report(id: str):
    orch_conn = get_orchestration_connection()
    orch_cur = orch_conn.cursor()
    orch_cur.execute("SELECT * FROM reports WHERE id = ?", (id,))
    report_row = orch_cur.fetchone()
    orch_conn.close()

    if not report_row:
        raise HTTPException(status_code=404, detail="Report not found")

    ds_id = report_row["datasource_id"]
    query_config = json.loads(report_row["query"])
    stored_sql = report_row["sql"] if "sql" in report_row.keys() else None

    # Prefer stored SQL (from AI generation or user-written) over dynamic building
    if stored_sql and stored_sql.strip():
        sql = _clean_metabase_templates(stored_sql.strip())
    else:
        # Fall back to building SQL from query config
        schema_data = get_datasource_schema(ds_id)
        schema = DatabaseSchema(**schema_data)
        sql = build_dynamic_sql(query_config, schema)

    conn = get_datasource_connection(ds_id)
    is_postgres = isinstance(conn, psycopg2.extensions.connection)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor) if is_postgres else conn.cursor()

    try:
        cur.execute(sql)
        results = cur.fetchall()
        if not results:
            conn.close()
            return {"columns": [], "rows": []}

        columns = [desc[0] for desc in cur.description] if is_postgres else list(results[0].keys())
        rows = [list(r) for r in results] if is_postgres else [[r[col] for col in columns] for r in results]

        conn.close()
        return {"columns": columns, "rows": rows, "sql": sql}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Datasource CRUD ──────────────────────────────────────────────

@router.get("/datasources")
def list_datasources():
    """List all configured datasources."""
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, host, port, database FROM datasources")
    rows = cur.fetchall()
    conn.close()
    return {"datasources": [dict(r) for r in rows]}


@router.delete("/datasources/{id}")
def delete_datasource(id: str):
    """Delete a datasource and its associated reports."""
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM reports WHERE datasource_id = ?", (id,))
    cur.execute("DELETE FROM datasources WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"message": "Datasource and associated reports deleted"}


@router.post("/datasources/{id}/test")
def test_datasource_connection(id: str):
    """Test if a datasource connection is working."""
    try:
        conn = get_datasource_connection(id)
        if isinstance(conn, psycopg2.extensions.connection):
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
        else:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
        conn.close()
        return {"status": "ok", "message": "Connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── Raw SQL Query Runner ────────────────────────────────────────

@router.post("/query/run")
def run_raw_query(datasource_id: str, sql: str):
    """
    Run a raw SQL query against a datasource.
    Only SELECT queries are allowed for safety.
    """
    # Safety: only allow SELECT statements
    sql_stripped = sql.strip()
    sql_upper = sql_stripped.upper()

    # Block dangerous statements
    dangerous = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE',
                 'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'MERGE']
    for keyword in dangerous:
        if sql_upper.startswith(keyword) or f' {keyword} ' in f' {sql_upper} ':
            raise HTTPException(
                status_code=403,
                detail=f"Only SELECT queries are allowed. Detected: {keyword}"
            )

    if not sql_upper.startswith('SELECT') and not sql_upper.startswith('WITH'):
        raise HTTPException(status_code=403, detail="Only SELECT queries are allowed")

    # Run the query
    conn = get_datasource_connection(datasource_id)
    is_postgres = isinstance(conn, psycopg2.extensions.connection)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor) if is_postgres else conn.cursor()

    try:
        cur.execute(sql)
        results = cur.fetchall()

        if not results:
            conn.close()
            return {"columns": [], "rows": [], "sql": sql}

        if is_postgres:
            columns = [desc[0] for desc in cur.description]
            rows = [list(r) for r in results]
        else:
            columns = list(results[0].keys())
            rows = [[r[col] for col in columns] for r in results]

        conn.close()
        return {"columns": columns, "rows": rows, "sql": sql, "row_count": len(rows)}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Report CRUD ──────────────────────────────────────────────────

@router.post("/reports/raw", status_code=201)
def create_report_raw(name: str, datasource_id: str, sql: str, visualization: str = "table"):
    """Create a report directly from raw SQL (bypasses query config)."""
    report_id = str(uuid.uuid4())
    conn = get_orchestration_connection()
    cur = conn.cursor()
    empty_query = json.dumps({})
    cur.execute(
        "INSERT INTO reports (id, name, datasource_id, query, visualization, sql) VALUES (?, ?, ?, ?, ?, ?)",
        (report_id, name, datasource_id, empty_query, visualization, sql),
    )
    conn.commit()
    conn.close()
    return {"id": report_id, "message": "Report created from raw SQL"}


@router.get("/reports")
def list_reports():
    """List all saved reports."""
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("SELECT r.id, r.name, r.datasource_id, r.visualization, d.name as datasource_name "
                "FROM reports r LEFT JOIN datasources d ON r.datasource_id = d.id")
    rows = cur.fetchall()
    conn.close()
    return {"reports": [dict(r) for r in rows]}


@router.get("/reports/{id}")
def get_report(id: str):
    """Get a single report by ID."""
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM reports WHERE id = ?", (id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    report = dict(row)
    report["query"] = json.loads(report["query"])
    return report


@router.delete("/reports/{id}")
def delete_report(id: str):
    """Delete a report."""
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM reports WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"message": "Report deleted"}


# ─── Report Export Endpoints ──────────────────────────────────────

import io
import csv
from fastapi.responses import StreamingResponse


def _run_report_for_export(report_id: str):
    """Internal: run a report and return structured data."""
    orch_conn = get_orchestration_connection()
    cur = orch_conn.cursor()
    cur.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
    row = cur.fetchone()
    orch_conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    ds_id = row["datasource_id"]
    stored_sql = row["sql"] if "sql" in row.keys() else None

    # Prefer stored SQL over dynamic builder (same as run_report)
    if stored_sql and stored_sql.strip():
        sql = _clean_metabase_templates(stored_sql.strip())
    else:
        query_config = json.loads(row["query"])
        schema_data = get_datasource_schema(ds_id)
        schema = DatabaseSchema(**schema_data)
        sql = build_dynamic_sql(query_config, schema)

    conn = get_datasource_connection(ds_id)
    is_postgres = isinstance(conn, psycopg2.extensions.connection)
    cur2 = conn.cursor(cursor_factory=psycopg2.extras.DictCursor) if is_postgres else conn.cursor()
    cur2.execute(sql)
    results = cur2.fetchall()
    if not results:
        conn.close()
        return {"columns": [], "rows": [], "report_name": row["name"]}
    columns = [desc[0] for desc in cur2.description] if is_postgres else list(results[0].keys())
    rows = [list(r) for r in results] if is_postgres else [[r[col] for col in columns] for r in results]
    conn.close()
    return {"columns": columns, "rows": rows, "report_name": row["name"]}


@router.get("/reports/{id}/export/json")
def export_report_json(id: str):
    """Export report data as JSON."""
    data = _run_report_for_export(id)
    return {
        "report_name": data["report_name"],
        "columns": data["columns"],
        "rows": data["rows"],
        "row_count": len(data["rows"]),
    }


@router.get("/reports/{id}/export/csv")
def export_report_csv(id: str):
    """Export report data as CSV file download."""
    data = _run_report_for_export(id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(data["columns"])
    for row in data["rows"]:
        writer.writerow(row)
    output.seek(0)
    filename = f"{data['report_name'].replace(' ', '_')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/{id}/export/excel")
def export_report_excel(id: str):
    """Export report data as Excel (.xlsx) file download."""
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=501, detail="openpyxl not installed. Run: pip install openpyxl")

    data = _run_report_for_export(id)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Report Data"

    # Header row with styling
    header_fill = openpyxl.styles.PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_font = openpyxl.styles.Font(color="FFFFFF", bold=True)
    for col_idx, col_name in enumerate(data["columns"], 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.fill = header_fill
        cell.font = header_font

    # Data rows
    for row_idx, row in enumerate(data["rows"], 2):
        for col_idx, value in enumerate(row, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)

    # Auto-fit columns
    for col_idx, col_name in enumerate(data["columns"], 1):
        max_length = len(str(col_name))
        for row in data["rows"]:
            val_len = len(str(row[col_idx - 1])) if row[col_idx - 1] is not None else 0
            max_length = max(max_length, val_len)
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = min(max_length + 2, 50)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"{data['report_name'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _build_pdf(report_id: str, chart_image: str = None, ai_summary: str = None):
    """Shared PDF builder used by both GET and POST endpoints."""
    try:
        from fpdf import FPDF
    except ImportError:
        raise HTTPException(status_code=501, detail="fpdf2 not installed. Run: pip install fpdf2")

    data = _run_report_for_export(report_id)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, data["report_name"], ln=True, align="C")
    pdf.ln(4)

    # Metadata
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 6, f"Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}  |  Rows: {len(data['rows'])}", ln=True)
    pdf.ln(6)

    # Chart image (if provided via base64)
    if chart_image:
        try:
            import base64, tempfile, os
            # Strip data URL prefix
            img_data = chart_image
            if ',' in img_data:
                img_data = img_data.split(',', 1)[1]
            img_bytes = base64.b64decode(img_data)
            tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tmp.write(img_bytes)
            tmp.close()
            pdf.image(tmp.name, x=10, w=pdf.w - 20)
            os.unlink(tmp.name)
            pdf.ln(6)
        except Exception as img_err:
            logger.warning(f"Chart image embed failed: {img_err}")

    # AI Summary for PDF
    if ai_summary:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(37, 99, 235)
        pdf.cell(0, 8, "AI Analysis", ln=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)
        import re as _re
        clean = ai_summary
        clean = _re.sub(r'^#{1,3} (.+)$', r'\1', clean, flags=_re.MULTILINE)
        clean = clean.replace('**', '').replace('*', '').replace('`', '')
        clean = _re.sub(r'\n---+', '\n', clean)
        paragraphs = [p.strip() for p in clean.split('\n\n') if p.strip()]
        for para in paragraphs[:8]:
            if para.startswith('> '):
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(100, 116, 139)
                pdf.multi_cell(0, 5, para.replace('> ', ''))
                pdf.set_text_color(0, 0, 0)
            else:
                pdf.set_font("Helvetica", "", 9)
                pdf.multi_cell(0, 5, para)
            pdf.ln(1)
        pdf.ln(4)

    if not data["rows"]:
        pdf.set_font("Helvetica", "", 12)
        pdf.cell(0, 10, "No data available.", ln=True)
    else:
        # Calculate column widths proportionally based on content
        cols = data["columns"]
        rows = data["rows"]

        # Measure max text width per column (approximate: ~2 chars per mm at font size 8)
        pdf.set_font("Helvetica", "", 8)
        char_width_mm = 1.8  # approximate mm per character at size 8
        col_max_chars = []
        for ci, col in enumerate(cols):
            max_chars = len(str(col))
            for row in rows[:100]:  # sample first 100 rows for performance
                val = str(row[ci]) if row[ci] is not None else ""
                max_chars = max(max_chars, len(val))
            col_max_chars.append(min(max_chars, 40))  # cap at 40 chars

        total_chars = sum(col_max_chars)
        available_width = pdf.w - 20  # 10mm margin each side
        col_widths = [(c / total_chars) * available_width for c in col_max_chars]
        # Ensure minimum width
        col_widths = [max(w, 18) for w in col_widths]

        # If total exceeds page, switch to landscape
        if sum(col_widths) > available_width:
            # Scale down proportionally
            scale = available_width / sum(col_widths)
            col_widths = [w * scale for w in col_widths]

        # Use landscape if many wide columns
        if len(cols) > 6 and total_chars > 100:
            pdf.add_page(orientation='L')
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 10, data["report_name"], ln=True, align="C")
            pdf.ln(4)
            pdf.set_font("Helvetica", "I", 10)
            pdf.cell(0, 6, f"Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}  |  Rows: {len(rows)}", ln=True)
            pdf.ln(6)
            available_width = pdf.w - 20
            scale = available_width / sum(col_widths)
            col_widths = [w * scale for w in col_widths]

        # Table header
        pdf.set_fill_color(37, 99, 235)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 9)
        for ci, col in enumerate(cols):
            pdf.cell(col_widths[ci], 8, str(col), border=1, fill=True)
        pdf.ln()

        # Table rows
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(0, 0, 0)
        for row_idx, row in enumerate(rows):
            if row_idx % 2 == 0:
                pdf.set_fill_color(245, 247, 250)
            else:
                pdf.set_fill_color(255, 255, 255)
            for ci, value in enumerate(row):
                display = str(value) if value is not None else ""
                # Truncate with ellipsis if needed
                text_w = pdf.get_string_width(display)
                while text_w > col_widths[ci] - 1 and len(display) > 3:
                    display = display[:-1]
                    text_w = pdf.get_string_width(display + '…')
                if text_w > col_widths[ci] - 1 and len(display) > 3:
                    display = display + '…'
                pdf.cell(col_widths[ci], 6, display, border=1, fill=True)
            pdf.ln()

    output = io.BytesIO()
    pdf.output(output)
    output.seek(0)
    filename = f"{data['report_name'].replace(' ', '_')}.pdf"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/{id}/export/pdf")
def export_report_pdf_get(id: str, chart_image: str = None, ai_summary: str = None):
    """GET: Export report as PDF. For large chart/summary, use POST."""
    return _build_pdf(id, chart_image, ai_summary)


@router.post("/reports/{id}/export/pdf")
def export_report_pdf_post(id: str, body: Dict[str, Any] = None):
    """POST: Export report as PDF. Accepts chart_image + ai_summary in body (no URL length limit)."""
    ci = body.get("chart_image") if body else None
    ai = body.get("ai_summary") if body else None
    return _build_pdf(id, ci, ai)


def _build_word(report_id: str, chart_image: str = None, ai_summary: str = None):
    """Shared Word builder used by both GET and POST endpoints."""
    try:
        from docx import Document
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
    except ImportError:
        raise HTTPException(status_code=501, detail="python-docx not installed. Run: pip install python-docx")

    data = _run_report_for_export(report_id)

    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"

    # Title
    title = doc.add_heading(data["report_name"], level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Metadata
    doc.add_paragraph(
        f"Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}  |  "
        f"Total Rows: {len(data['rows'])}"
    ).alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()

    # Chart image (if provided)
    if chart_image:
        try:
            import base64, tempfile, os
            img_data = chart_image
            if ',' in img_data:
                img_data = img_data.split(',', 1)[1]
            img_bytes = base64.b64decode(img_data)
            tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tmp.write(img_bytes)
            tmp.close()
            doc.add_picture(tmp.name, width=Inches(5.5))
            last_paragraph = doc.paragraphs[-1]
            last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            doc.add_paragraph()
            os.unlink(tmp.name)
        except Exception as img_err:
            logger.warning(f"Chart image embed failed: {img_err}")

    # AI Summary for Word
    if ai_summary:
        doc.add_heading("AI Analysis", level=2)
        import re as _re
        clean = ai_summary
        clean = _re.sub(r'^#{1,3} (.+)$', r'\1', clean, flags=_re.MULTILINE)
        clean = _re.sub(r'\n---+', '\n', clean)
        paragraphs = [p.strip() for p in clean.split('\n\n') if p.strip()]
        for para in paragraphs[:8]:
            if para.startswith('> '):
                p = doc.add_paragraph(para.replace('> ', ''))
                p.style = doc.styles['Intense Quote'] if 'Intense Quote' in [s.name for s in doc.styles] else doc.styles['Normal']
            else:
                clean_para = para.replace('**', '').replace('*', '').replace('`', '')
                doc.add_paragraph(clean_para)
        doc.add_paragraph()

    if not data["rows"]:
        doc.add_paragraph("No data available for this report.")
    else:
        # Create table
        table = doc.add_table(rows=1, cols=len(data["columns"]))
        table.style = "Light Grid Accent 1"

        # Headers
        hdr_cells = table.rows[0].cells
        for idx, col_name in enumerate(data["columns"]):
            hdr_cells[idx].text = str(col_name)

        # Data rows
        for row in data["rows"]:
            row_cells = table.add_row().cells
            for idx, value in enumerate(row):
                row_cells[idx].text = str(value) if value is not None else ""

    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    filename = f"{data['report_name'].replace(' ', '_')}.docx"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/{id}/export/word")
def export_report_word_get(id: str, chart_image: str = None, ai_summary: str = None):
    """GET: Export report as Word. For large chart/summary, use POST."""
    return _build_word(id, chart_image, ai_summary)


@router.post("/reports/{id}/export/word")
def export_report_word_post(id: str, body: Dict[str, Any] = None):
    """POST: Export report as Word. Accepts chart_image + ai_summary in body (no URL length limit)."""
    ci = body.get("chart_image") if body else None
    ai = body.get("ai_summary") if body else None
    return _build_word(id, ci, ai)


# ─── Dashboard CRUD ──────────────────────────────────────────────

@router.post("/dashboards", status_code=201)
def create_dashboard(name: str, description: str = ""):
    dash_id = str(uuid.uuid4())
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO dashboards (id, name, description) VALUES (?, ?, ?)", (dash_id, name, description))
    conn.commit()
    conn.close()
    return {"id": dash_id, "message": "Dashboard created"}

@router.get("/dashboards")
def list_dashboards():
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("SELECT d.*, (SELECT count(*) FROM dashboard_cards c WHERE c.dashboard_id = d.id) as card_count FROM dashboards d")
    rows = cur.fetchall()
    conn.close()
    return {"dashboards": [dict(r) for r in rows]}

@router.get("/dashboards/{id}")
def get_dashboard(id: str):
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM dashboards WHERE id = ?", (id,))
    dash = cur.fetchone()
    if not dash:
        conn.close()
        raise HTTPException(status_code=404, detail="Dashboard not found")
    cur.execute("SELECT * FROM dashboard_cards WHERE dashboard_id = ? ORDER BY row, col", (id,))
    cards = cur.fetchall()
    conn.close()
    return {"dashboard": dict(dash), "cards": [dict(c) for c in cards]}

@router.delete("/dashboards/{id}")
def delete_dashboard(id: str):
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM dashboard_cards WHERE dashboard_id = ?", (id,))
    cur.execute("DELETE FROM dashboards WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"message": "Dashboard deleted"}

@router.post("/dashboards/{id}/cards", status_code=201)
def add_card_to_dashboard(id: str, report_id: str, row: int = 0, col: int = 0, width: int = 4, height: int = 3):
    card_id = str(uuid.uuid4())
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO dashboard_cards (id, dashboard_id, report_id, row, col, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (card_id, id, report_id, row, col, width, height))
    conn.commit()
    conn.close()
    return {"id": card_id, "message": "Card added to dashboard"}

@router.delete("/dashboards/{dashboard_id}/cards/{card_id}")
def remove_card_from_dashboard(dashboard_id: str, card_id: str):
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM dashboard_cards WHERE id = ? AND dashboard_id = ?", (card_id, dashboard_id))
    conn.commit()
    conn.close()
    return {"message": "Card removed"}


# ─── System / Theme Endpoints ─────────────────────────────────────

THEME_FILE = "theme.json"

DEFAULT_THEME = {
    "name": "Default Light",
    "mode": "light",
    "colors": {
        "primary": "#2563EB",
        "secondary": "#7C3AED",
        "accent": "#F59E0B",
        "background": "#FFFFFF",
        "surface": "#F8FAFC",
        "text": "#1E293B",
        "textSecondary": "#64748B",
        "border": "#E2E8F0",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#3B82F6",
    },
    "fonts": {
        "heading": "Inter",
        "body": "Inter",
    },
    "borderRadius": 8,
    "logo": None,
    "branding": {
        "companyName": "Awesome BI",
        "tagline": "Intelligent Business Intelligence",
    },
}


def _load_theme() -> dict:
    if os.path.exists(THEME_FILE):
        with open(THEME_FILE, "r") as f:
            return json.load(f)
    return DEFAULT_THEME.copy()


def _save_theme(theme: dict):
    with open(THEME_FILE, "w") as f:
        json.dump(theme, f, indent=2)


@router.get("/theme")
def get_theme():
    """Get current UI theme configuration."""
    return _load_theme()


@router.put("/theme")
def update_theme(theme: Dict[str, Any]):
    """Update UI theme configuration."""
    current = _load_theme()
    # Deep merge with current theme
    def deep_merge(base, update):
        for key, value in update.items():
            if isinstance(value, dict) and isinstance(base.get(key), dict):
                deep_merge(base[key], value)
            else:
                base[key] = value

    deep_merge(current, theme)
    _save_theme(current)
    return {"message": "Theme updated", "theme": current}


@router.post("/theme/reset")
def reset_theme():
    """Reset theme to defaults."""
    _save_theme(DEFAULT_THEME.copy())
    return {"message": "Theme reset to defaults", "theme": DEFAULT_THEME}


# ─── Health / Stats ───────────────────────────────────────────────

@router.get("/health/stats")
def get_stats():
    """Get system statistics for dashboard."""
    conn = get_orchestration_connection()
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM datasources")
    ds_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM reports")
    report_count = cur.fetchone()[0]
    conn.close()
    return {
        "datasources": ds_count,
        "reports": report_count,
        "ai_providers": len(get_available_providers()),
    }
