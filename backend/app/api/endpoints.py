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
    orch_cur.execute("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, name TEXT, datasource_id TEXT, query TEXT, visualization TEXT)")
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
    query_json = json.dumps(report.query.dict())
    cur.execute("INSERT INTO reports (id, name, datasource_id, query, visualization) VALUES (?, ?, ?, ?, ?)",
        (report_id, report.name, report.datasource_id, query_json, report.visualization))
    conn.commit()
    conn.close()
    return {"id": report_id, "message": "Report created successfully"}

def build_dynamic_sql(query_config: Dict[str, Any], schema: DatabaseSchema) -> str:
    """
    Dynamically builds SQL from QueryConfig, validating against the provided schema.
    """
    select_fields = query_config.get("select") or []
    aggregations = query_config.get("aggregations") or []
    filters = query_config.get("filters") or []
    group_by = query_config.get("group_by") or []

    # Simple heuristic: find the tables involved. 
    # For a robust BI tool, we'd need a more complex join logic.
    # Here we assume a single table or a joined view of users/orders for the demo.
    
    table_map = {t.name: [c.name for c in t.columns] for t in schema.tables}
    
    # Check if we should join users and orders
    if "users" in table_map and "orders" in table_map:
        from_clause = "users LEFT JOIN orders ON users.id = orders.user_id"
        available_columns = {
            "username": "users.username",
            "email": "users.email",
            "amount": "orders.amount",
            "status": "orders.status"
        }
    else:
        # Fallback to the first table if no join logic matches
        table_name = list(table_map.keys())[0] if table_map else "dual"
        from_clause = table_name
        available_columns = {c: f"{table_name}.{c}" for c in table_map.get(table_name, [])}

    sql_selects = []
    for f in select_fields:
        if f in available_columns:
            sql_selects.append(available_columns[f])
    
    for agg in aggregations:
        agg_type = agg.get("type")
        agg_field = agg.get("field")
        if agg_field in available_columns:
            sql_selects.append(f"{agg_type}({available_columns[agg_field]}) as {agg_type.lower()}_{agg_field}")

    if not sql_selects:
        sql_selects = ["*"]

    sql = f"SELECT {', '.join(sql_selects)} FROM {from_clause}"

    where_clauses = []
    for f in filters:
        field = f.get("field")
        op = f.get("operator")
        val = f.get("value")
        if field in available_columns:
            # Basic injection prevention for the operator
            if op.upper() in ["=", "!=", ">", "<", ">=", "<=", "LIKE"]:
                # In a real tool, use parameterized queries for the value
                if isinstance(val, str):
                    where_clauses.append(f"{available_columns[field]} {op} '{val}'")
                else:
                    where_clauses.append(f"{available_columns[field]} {op} {val}")
    
    if where_clauses:
        sql += f" WHERE {' AND '.join(where_clauses)}"

    if group_by:
        gb_fields = [available_columns[f] for f in group_by if f in available_columns]
        if gb_fields:
            sql += f" GROUP BY {', '.join(gb_fields)}"

    return sql

import google.generativeai as genai

@router.post("/ai/generate-query")
def generate_ai_query(datasource_id: str, prompt: str, api_key: str):
    # 1. Get Schema
    schema = get_datasource_schema(datasource_id)
    
    # 2. Configure Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-pro')
    
    # 3. Build AI Prompt
    ai_prompt = f"""
    You are a SQL and BI expert. Given the database schema below, generate a JSON query configuration that satisfies the user prompt.
    
    SCHEMA:
    {json.dumps(schema)}
    
    USER PROMPT:
    {prompt}
    
    RESPONSE FORMAT (JSON ONLY):
    {{
        "select": ["column_name1", "column_name2"],
        "aggregations": [{{ "type": "SUM|COUNT|AVG|MIN|MAX", "field": "column_name" }}],
        "filters": [{{ "field": "column_name", "operator": "=|>|<|LIKE", "value": "value" }}],
        "group_by": ["column_name1"]
    }}
    
    Ensure table names are NOT used in the field names, just the column names. 
    If a join is needed between users and orders, assume the backend handles it.
    """
    
    try:
        response = model.generate_content(ai_prompt)
        # Extract JSON from response (handling potential markdown formatting)
        content = response.text
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        query_config = json.loads(content)
        
        # Build SQL for direct use in Metabase
        sql = build_dynamic_sql(query_config, DatabaseSchema(**schema))
        query_config["sql"] = sql
        
        return query_config
    except Exception as e:
        logger.error(f"AI Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
    
    # Get schema to validate and build query
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
