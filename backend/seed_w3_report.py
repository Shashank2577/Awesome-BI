#!/usr/bin/env python3
"""
Seed script: creates two W3 Employer Withholdings reports via the backend API.
Run from the backend directory with the server running on port 8000:
  python seed_w3_report.py
"""

import json
import urllib.request
import urllib.error

API = "http://localhost:8000"
DATASOURCE_ID = "b2588000-3eda-436d-b0f2-427612a7dfbf"

W3_SQL = """SELECT
  t.LNAME                  AS [Employer],
  e.EMPLOYERTAXID          AS [EIN],
  e.TAXYEAR                AS [Tax Year],
  e.NUMBEROFW2S            AS [W3 # W2s],
  e.W3GROSSWAGES           AS [W3 Wages],
  e.W3WITHHOLDINGS         AS [W3 Withholdings],
  e.REPORTEDWH             AS [W3 Liability],
  e.YTDWITHHOLDINGPAYMENTS AS [WH Payments],
  e.YTDREFUNDS             AS [Refunds],
  e.ADJUSTMENTS            AS [Adjustments],
  e.ASSESSMENTS            AS [Assessments],
  e.CURRENTBALANCE         AS [Balance Due],
  e.ASSESSMENTBALANCE      AS [Assessment Balance],
  e.PENALTY_CHARGED        AS [Penalty],
  e.INTEREST_CHARGED       AS [Interest],
  e.FEES                   AS [Fees],
  e.PAYMENTFREQUENCY       AS [Pay Freq],
  e.TRANSACTIONNUMBER      AS [Transaction #],
  e.RESIDENCY              AS [Residency],
  e.RECORDSTATUS           AS [Record Status],
  e.BANKRUPT               AS [Bankrupt],
  e.DUEDATE                AS [Due Date],
  e.RECEIVED               AS [Date Received],
  e.STARTDATE              AS [Started],
  e.STOPDATE               AS [Stopped],
  e.W3POSTDATE             AS [W3 Post Date],
  e.W3POSTSTATUS           AS [W3 Post Status]
FROM EMPLOYER e
JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID
WHERE e.TAXYEAR IN ('2025','2024')
ORDER BY e.TAXYEAR DESC, t.LNAME"""

W3_SINGLE_SQL = """SELECT
  t.LNAME                  AS [Employer],
  e.EMPLOYERTAXID          AS [EIN],
  e.TAXYEAR                AS [Tax Year],
  e.NUMBEROFW2S            AS [W3 # W2s],
  e.W3GROSSWAGES           AS [W3 Wages],
  e.W3WITHHOLDINGS         AS [W3 Withholdings],
  e.REPORTEDWH             AS [W3 Liability],
  e.YTDWITHHOLDINGPAYMENTS AS [WH Payments],
  e.YTDREFUNDS             AS [Refunds],
  e.ADJUSTMENTS            AS [Adjustments],
  e.ASSESSMENTS            AS [Assessments],
  e.CURRENTBALANCE         AS [Balance Due],
  e.ASSESSMENTBALANCE      AS [Assessment Balance],
  e.PENALTY_CHARGED        AS [Penalty],
  e.INTEREST_CHARGED       AS [Interest],
  e.FEES                   AS [Fees],
  e.PAYMENTFREQUENCY       AS [Pay Freq],
  e.TRANSACTIONNUMBER      AS [Transaction #],
  e.RESIDENCY              AS [Residency],
  e.RECORDSTATUS           AS [Record Status],
  e.BANKRUPT               AS [Bankrupt],
  e.DUEDATE                AS [Due Date],
  e.RECEIVED               AS [Date Received],
  e.STARTDATE              AS [Started],
  e.STOPDATE               AS [Stopped],
  e.W3POSTDATE             AS [W3 Post Date],
  e.W3POSTSTATUS           AS [W3 Post Status]
FROM EMPLOYER e
JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID
WHERE e.EMPLOYERTAXID = '263290063W' AND e.TAXYEAR = '2024'
ORDER BY t.LNAME"""


def post_report(name: str, sql: str) -> dict:
    payload = json.dumps({
        "name": name,
        "datasource_id": DATASOURCE_ID,
        "visualization": "table",
        "sql": sql,
        "query": {},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{API}/reports",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            print(f"  [OK] Created report '{name}' → id: {result.get('id')}")
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [ERR] {e.code} for '{name}': {body}")
        raise


def main():
    print("Seeding W3 reports...")
    post_report("W3 Employer Withholdings", W3_SQL)
    post_report("W3 Single EIN Lookup", W3_SINGLE_SQL)
    print("Done.")


if __name__ == "__main__":
    main()
