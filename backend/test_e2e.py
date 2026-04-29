import requests
import json
import time
import sys

base_url = "http://localhost:8000"

def run_tests():
    print("=== Starting E2E Tests ===")

    for i in range(5):
        try:
            requests.get(base_url)
            break
        except requests.ConnectionError:
            time.sleep(1)

    print("1. Creating datasource...")
    res = requests.post(f"{base_url}/datasources", json={
        "name": "Test DB",
        "host": "localhost",
        "port": 5432,
        "database": "reporting",
        "username": "admin",
        "password": "password"
    })

    if res.status_code != 201:
        print(f"Failed to create datasource: {res.text}")
        sys.exit(1)

    ds_id = res.json()["id"]
    print("✓ Datasource created.")

    print("\n2. Getting schema...")
    res = requests.get(f"{base_url}/datasources/{ds_id}/schema")
    if res.status_code != 200:
        print(f"Failed to get schema: {res.text}")
        sys.exit(1)

    schema = res.json()
    tables = [t["name"] for t in schema["tables"]]
    if "users" not in tables or "orders" not in tables:
        print(f"Missing expected tables. Found: {tables}")
        sys.exit(1)
    print("✓ Schema fetched successfully.")

    print("\n3. Creating report (with aggregations)...")
    res = requests.post(f"{base_url}/reports", json={
        "name": "User Order Amount",
        "datasource_id": ds_id,
        "query": {
            "select": ["username"],
            "aggregations": [{"type": "SUM", "field": "amount"}]
        },
        "visualization": "bar"
    })

    if res.status_code != 201:
        print(f"Failed to create report: {res.text}")
        sys.exit(1)

    rep_id = res.json()["id"]
    print("✓ Report created.")

    print("\n4. Running report (with aggregations)...")
    res = requests.get(f"{base_url}/reports/{rep_id}/run")
    if res.status_code != 200:
        print(f"Failed to run report: {res.text}")
        sys.exit(1)

    data = res.json()
    if "total_amount" not in data["columns"]:
        print(f"Missing expected column 'total_amount'. Found: {data['columns']}")
        sys.exit(1)
    print("✓ Report executed successfully.")

    print("\n5. Creating report (no aggregations)...")
    res = requests.post(f"{base_url}/reports", json={
        "name": "User List",
        "datasource_id": ds_id,
        "query": {
            "select": ["username", "email"]
        },
        "visualization": "table"
    })

    if res.status_code != 201:
        print(f"Failed to create second report: {res.text}")
        sys.exit(1)

    rep_id2 = res.json()["id"]
    print("✓ Second report created.")

    print("\n6. Running report (no aggregations)...")
    res = requests.get(f"{base_url}/reports/{rep_id2}/run")
    if res.status_code != 200:
        print(f"Failed to run second report: {res.text}")
        sys.exit(1)

    data = res.json()
    if "email" not in data["columns"]:
        print(f"Missing expected column 'email'. Found: {data['columns']}")
        sys.exit(1)
    print("✓ Second report executed successfully.")

    print("\n=== All E2E Tests Passed ===")

if __name__ == "__main__":
    run_tests()
