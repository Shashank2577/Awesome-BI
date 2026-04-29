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

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "reporting")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")

USE_POSTGRES = bool(DB_HOST)
DB_FILE = "reporting.db"

def get_connection():
    if USE_POSTGRES:
        return psycopg2.connect(host=DB_HOST, port=DB_PORT, database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    if USE_POSTGRES:
        max_retries = 30
        for i in range(max_retries):
            try:
                conn = get_connection()
                break
            except Exception as e:
                time.sleep(2)
                if i == max_retries - 1:
                    raise Exception("Could not connect to DB.")
    else:
        conn = get_connection()

    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS datasources (id TEXT PRIMARY KEY, name TEXT, host TEXT, port INTEGER, database TEXT, username TEXT, password TEXT)")
    cur.execute("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, name TEXT, datasource_id TEXT, query TEXT, visualization TEXT)")

    if not USE_POSTGRES:
        cur.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, email TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
        cur.execute("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount REAL NOT NULL, status TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))")
        cur.execute("SELECT count(*) from users")
        if cur.fetchone()["count(*)"] == 0:
            cur.execute("INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com'), ('bob', 'bob@example.com')")
            cur.execute("INSERT INTO orders (user_id, amount, status) VALUES (1, 150.00, 'completed'), (2, 200.50, 'completed')")

    conn.commit()
    conn.close()

try:
    init_db()
except Exception:
    pass

@router.post("/datasources", status_code=201)
def create_datasource(datasource: DatasourceCreate):
    ds_id = str(uuid.uuid4())
    conn = get_connection()
    cur = conn.cursor()
    if USE_POSTGRES:
        cur.execute("INSERT INTO datasources (id, name, host, port, database, username, password) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (ds_id, datasource.name, datasource.host, datasource.port, datasource.database, datasource.username, datasource.password))
    else:
        cur.execute("INSERT INTO datasources (id, name, host, port, database, username, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (ds_id, datasource.name, datasource.host, datasource.port, datasource.database, datasource.username, datasource.password))
    conn.commit()
    conn.close()
    return {"id": ds_id, "message": "Datasource created successfully"}

@router.get("/datasources/{id}/schema", response_model=DatabaseSchema)
def get_datasource_schema(id: str):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor) if USE_POSTGRES else conn.cursor()

    query = "SELECT * FROM datasources WHERE id = %s" if USE_POSTGRES else "SELECT * FROM datasources WHERE id = ?"
    cur.execute(query, (id,))
    ds = cur.fetchone()
    if not ds:
        conn.close()
        raise HTTPException(status_code=404, detail="Datasource not found")

    schema = {"tables": []}
    if USE_POSTGRES:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT IN ('datasources', 'reports')")
        for table_row in cur.fetchall():
            table_name = table_row["table_name"]
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s", (table_name,))
            schema["tables"].append({"name": table_name, "columns": [{"name": c["column_name"], "type": c["data_type"]} for c in cur.fetchall()]})
    else:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence', 'datasources', 'reports')")
        for table_row in cur.fetchall():
            table_name = table_row["name"]
            cur.execute(f"PRAGMA table_info({table_name})")
            schema["tables"].append({"name": table_name, "columns": [{"name": c["name"], "type": c["type"]} for c in cur.fetchall()]})

    conn.close()
    return schema

@router.post("/reports", status_code=201)
def create_report(report: ReportCreate):
    report_id = str(uuid.uuid4())
    conn = get_connection()
    cur = conn.cursor()
    query_json = json.dumps(report.query.dict())
    if USE_POSTGRES:
        cur.execute("INSERT INTO reports (id, name, datasource_id, query, visualization) VALUES (%s, %s, %s, %s, %s)",
            (report_id, report.name, report.datasource_id, query_json, report.visualization))
    else:
        cur.execute("INSERT INTO reports (id, name, datasource_id, query, visualization) VALUES (?, ?, ?, ?, ?)",
            (report_id, report.name, report.datasource_id, query_json, report.visualization))
    conn.commit()
    conn.close()
    return {"id": report_id, "message": "Report created successfully"}

@router.get("/reports/{id}/run")
def run_report(id: str):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor) if USE_POSTGRES else conn.cursor()
    query = "SELECT * FROM reports WHERE id = %s" if USE_POSTGRES else "SELECT * FROM reports WHERE id = ?"
    cur.execute(query, (id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")

    query_config = json.loads(row["query"])
    select_fields = query_config.get("select") or []
    aggregations = query_config.get("aggregations") or []

    sql_selects = []
    for f in select_fields:
        if f == "username": sql_selects.append("users.username")
        elif f == "email": sql_selects.append("users.email")
        elif f == "amount": sql_selects.append("orders.amount")

    for agg in aggregations:
        if agg["type"] == "SUM" and agg["field"] == "amount":
            sql_selects.append("SUM(orders.amount) as total_amount")

    if not sql_selects: sql_selects.append("*")

    sql = "SELECT " + ", ".join(sql_selects) + " FROM users LEFT JOIN orders ON users.id = orders.user_id"
    if select_fields and aggregations:
        sql += " GROUP BY " + ", ".join([f"users.{f}" for f in select_fields if f in ["username", "email"]])

    try:
        cur.execute(sql)
        results = cur.fetchall()
        if not results:
            conn.close()
            return {"columns": [], "rows": []}

        columns = [desc[0] for desc in cur.description] if USE_POSTGRES else list(results[0].keys())
        rows = [list(r) for r in results] if USE_POSTGRES else [[r[col] for col in columns] for r in results]

        conn.close()
        return {"columns": columns, "rows": rows}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
