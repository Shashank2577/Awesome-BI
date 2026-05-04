import psycopg2
import sys

try:
    conn = psycopg2.connect(
        host="taazaa-dev-k3s-active-node.taazaahost.com",
        port=30099,
        database="cityOfDublinV2",
        user="postgres",
        password="Pass@123"
    )
    cur = conn.cursor()
    query = """
    EXPLAIN SELECT w.account_id AS "Account Number", t.taxpayer_name AS "Taxpayer Name", SUM(w.amount) AS "Total Withheld" FROM prc.withholding_taxpayers w LEFT JOIN prc.taxpayer_info t ON w.taxpayer_id = t.id GROUP BY w.account_id, t.taxpayer_name ORDER BY "Total Withheld" DESC LIMIT 10;
    """
    cur.execute(query)
    results = cur.fetchall()
    print("Query parsed and explained successfully:")
    for row in results:
        print(row[0])
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
