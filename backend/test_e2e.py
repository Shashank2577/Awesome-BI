import requests
import json
import time
import sys
import os

base_url = "http://localhost:8000"

def run_tests():
    print("=== Starting Synthesis E2E Tests ===")

    # Wait for server to be ready
    for i in range(10):
        try:
            res = requests.get(base_url)
            if res.status_code == 200:
                print("✓ Server is up.")
                break
        except requests.ConnectionError:
            time.sleep(1)
    else:
        print("Error: Server not responding.")
        sys.exit(1)

    print("\n1. Creating datasource...")
    res = requests.post(f"{base_url}/datasources", json={
        "name": "Local SQLite DB",
        "host": "localhost",
        "port": 5432,
        "database": "reporting.db",
        "username": "admin",
        "password": "password"
    })

    if res.status_code != 201:
        print(f"Failed to create datasource: {res.text}")
        sys.exit(1)

    ds_id = res.json()["id"]
    print(f"✓ Datasource created: {ds_id}")

    print("\n2. Getting schema...")
    res = requests.get(f"{base_url}/datasources/{ds_id}/schema")
    if res.status_code != 200:
        print(f"Failed to get schema: {res.text}")
        sys.exit(1)

    schema = res.json()
    tables = [t["name"] for t in schema["tables"]]
    print(f"Tables found: {tables}")
    if "users" not in tables or "orders" not in tables:
        print(f"Error: Missing expected tables. Found: {tables}")
        sys.exit(1)
    print("✓ Schema fetched and validated.")

    print("\n3. Creating dynamic report (SUM(amount) grouped by username)...")
    res = requests.post(f"{base_url}/reports", json={
        "name": "User Total Orders",
        "datasource_id": ds_id,
        "query": {
            "select": ["username"],
            "aggregations": [{"type": "SUM", "field": "amount"}],
            "group_by": ["username"]
        },
        "visualization": "bar"
    })

    if res.status_code != 201:
        print(f"Failed to create report: {res.text}")
        sys.exit(1)

    rep_id = res.json()["id"]
    print(f"✓ Report created: {rep_id}")

    print("\n4. Running dynamic report...")
    res = requests.get(f"{base_url}/reports/{rep_id}/run")
    if res.status_code != 200:
        print(f"Failed to run report: {res.text}")
        sys.exit(1)

    data = res.json()
    print(f"Result columns: {data['columns']}")
    # The new dynamic builder uses aggType_fieldName naming
    if "sum_amount" not in data["columns"]:
        print(f"Error: Missing expected column 'sum_amount'. Found: {data['columns']}")
        sys.exit(1)
    
    print(f"Sample data: {data['rows'][0]}")
    print("✓ Dynamic aggregation report executed successfully.")

    print("\n5. Creating filtered report (users where username = 'alice')...")
    res = requests.post(f"{base_url}/reports", json={
        "name": "Filter Test",
        "datasource_id": ds_id,
        "query": {
            "select": ["username", "email"],
            "filters": [{"field": "username", "operator": "=", "value": "alice"}]
        },
        "visualization": "table"
    })

    if res.status_code != 201:
        print(f"Failed to create filtered report: {res.text}")
        sys.exit(1)

    rep_id_f = res.json()["id"]
    print("✓ Filtered report created.")

    print("\n6. Running filtered report...")
    res = requests.get(f"{base_url}/reports/{rep_id_f}/run")
    if res.status_code != 200:
        print(f"Failed to run filtered report: {res.text}")
        sys.exit(1)

    data = res.json()
    print(f"Rows found: {len(data['rows'])}")
    if len(data["rows"]) != 1 or data["rows"][0][0] != "alice":
        print(f"Error: Filter failed or returned wrong data. Data: {data['rows']}")
        sys.exit(1)
    print("✓ Filtered report executed successfully.")

    print("\n7. Verifying Database Isolation...")
    # Check if orchestration.db exists and contains the expected tables
    if not os.path.exists("orchestration.db"):
        print("Error: orchestration.db not found!")
        sys.exit(1)
    
    import sqlite3
    conn = sqlite3.connect("orchestration.db")
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    orch_tables = [t[0] for t in cur.fetchall()]
    conn.close()
    
    print(f"Orchestration tables: {orch_tables}")
    if "datasources" not in orch_tables or "reports" not in orch_tables:
        print("Error: Orchestration DB missing core tables.")
        sys.exit(1)
    if "users" in orch_tables or "orders" in orch_tables:
        print("Error: Leaked user data into Orchestration DB!")
        sys.exit(1)
    print("✓ Database isolation verified.")

    print("\n=== All Synthesis E2E Tests Passed ===")

if __name__ == "__main__":
    run_tests()
