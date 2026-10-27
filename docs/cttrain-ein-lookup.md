# CTTRAIN — Employer Withholdings Screen Query

Fetches exactly the fields shown on the Employer Withholdings Reconciliation screen for a given EIN and year.

## Connection

| Field    | Value              |
|----------|--------------------|
| Server   | `10.10.1.133,1433` |
| Database | `CTTRAIN`          |
| User     | `sa`               |
| Password | `xxxs`             |

---

## Run This (replace `xxxs` and set your EIN/year)

```cmd
sqlcmd -S 10.10.1.133,1433 -U sa -P "Pass123" -d CTTRAIN -Q "SELECT t.LNAME AS [Employer], e.EMPLOYERTAXID AS [EIN], e.TAXYEAR AS [Year], e.NUMBEROFW2S AS [W3 # W2s], e.W3GROSSWAGES AS [W3 Wages], e.W3WITHHOLDINGS AS [W3 Withholdings], e.REPORTEDWH AS [W3 Liability], e.YTDWITHHOLDINGPAYMENTS AS [WH Payments], e.YTDREFUNDS AS [Refunds], e.CURRENTBALANCE AS [Balance Due], e.ASSESSMENTBALANCE AS [Assessment Balance], e.PENALTY_CHARGED AS [Penalty], e.INTEREST_CHARGED AS [Interest], e.FEES AS [Fees], e.ADJUSTMENTS AS [Adjustments], e.ASSESSMENTS AS [Assessments], e.PAYMENTFREQUENCY AS [Pay Freq], e.TRANSACTIONNUMBER AS [Transaction #], e.AUDITORID AS [Auditor ID], e.RESIDENCY AS [Residency], e.RECORDSTATUS AS [Record Status], e.BANKRUPT AS [Bankrupt], e.DUEDATE AS [Due Date], e.RECEIVED AS [Date Received], e.STARTDATE AS [Started], e.STOPDATE AS [Stopped], e.W3POSTDATE AS [W3 Post Date], e.W3POSTSTATUS AS [W3 Post Status] FROM EMPLOYER e JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID WHERE e.EMPLOYERTAXID = '263290063W' AND e.TAXYEAR = '2024';"
```

---

## Readable version of the same query

```sql
SELECT
  t.LNAME                  AS [Employer],
  e.EMPLOYERTAXID          AS [EIN],
  e.TAXYEAR                AS [Year],

  -- W3 Page Data & Balance (right column on screen)
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

  -- Dates, Flags, etc. panel (top-right on screen)
  e.DUEDATE                AS [Due Date],
  e.RECEIVED               AS [Date Received],
  e.STARTDATE              AS [Started],
  e.STOPDATE               AS [Stopped / Clear],
  e.PAYMENTFREQUENCY       AS [Pay Freq],
  e.TRANSACTIONNUMBER      AS [Transaction #],
  e.AUDITORID              AS [Auditor ID],
  e.RESIDENCY              AS [Residency],
  e.RECORDSTATUS           AS [Record Status],
  e.BANKRUPT               AS [Bankrupt],
  e.W3POSTDATE             AS [W3 Post Date],
  e.W3POSTSTATUS           AS [W3 Post Status]

FROM EMPLOYER e
JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID

WHERE e.EMPLOYERTAXID = '263290063W'   -- ← change EIN here
  AND e.TAXYEAR       = '2024';        -- ← change year here
```

---

## Change the filter

| To look up…              | Change the WHERE clause to…                       |
|--------------------------|---------------------------------------------------|
| Different EIN            | `e.EMPLOYERTAXID = 'XXXXXXXXX'`                   |
| Different year           | `e.TAXYEAR = '2025'`                              |
| All years for one EIN    | Remove `AND e.TAXYEAR = '2024'`                   |
| All 2024 records         | Remove `AND e.EMPLOYERTAXID = '263290063W'`       |
| Search by employer name  | `t.LNAME LIKE '%ABILITY MATTERS%'`                |

---

## What each field maps to on screen

| Screen location               | Column            | Table    |
|-------------------------------|-------------------|----------|
| Employer name (top)           | LNAME             | TAXPAYER |
| EIN number                    | EMPLOYERTAXID     | EMPLOYER |
| Year                          | TAXYEAR           | EMPLOYER |
| W3 # of W2s                   | NUMBEROFW2S       | EMPLOYER |
| W3 Wages                      | W3GROSSWAGES      | EMPLOYER |
| W3 Withholdings               | W3WITHHOLDINGS    | EMPLOYER |
| W3 Liability                  | REPORTEDWH        | EMPLOYER |
| WH Payments                   | YTDWITHHOLDINGPAYMENTS | EMPLOYER |
| Refunds                       | YTDREFUNDS        | EMPLOYER |
| Adjustments                   | ADJUSTMENTS       | EMPLOYER |
| Assessments                   | ASSESSMENTS       | EMPLOYER |
| Balance Due / Owes            | CURRENTBALANCE    | EMPLOYER |
| Assessment Balance            | ASSESSMENTBALANCE | EMPLOYER |
| Penalty                       | PENALTY_CHARGED   | EMPLOYER |
| Interest                      | INTEREST_CHARGED  | EMPLOYER |
| Fees                          | FEES              | EMPLOYER |
| Due Date                      | DUEDATE           | EMPLOYER |
| Date Received                 | RECEIVED          | EMPLOYER |
| Started                       | STARTDATE         | EMPLOYER |
| Stopped / Clear               | STOPDATE          | EMPLOYER |
| Payment Frequency             | PAYMENTFREQUENCY  | EMPLOYER |
| Transaction Number            | TRANSACTIONNUMBER | EMPLOYER |
| Auditor                       | AUDITORID         | EMPLOYER |
| Residency                     | RESIDENCY         | EMPLOYER |
| Record Status                 | RECORDSTATUS      | EMPLOYER |
| Bankrupt checkbox             | BANKRUPT          | EMPLOYER |
| W3 Post Date                  | W3POSTDATE        | EMPLOYER |
| W3 Post Status (Posted Final) | W3POSTSTATUS      | EMPLOYER |






Employer                                 EIN        Year W3 # W2s    W3 Wages                 W3 Withholdings          W3 Liability             WH Payments              Refunds                  Balance Due              Assessment Balance       Penalty                  Interest                 Fees                     Adjustments              Assessments              Pay Freq Transaction #          Auditor ID  Residency Record Status Bankrupt Due Date                Date Received           Started                 Stopped                 W3 Post Date            W3 Post Status
---------------------------------------- ---------- ---- ----------- ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ ------------------------ -------- ---------------------- ----------- --------- ------------- -------- ----------------------- ----------------------- ----------------------- ----------------------- ----------------------- --------------
ABILITY MATTERS LLC                      263290063W 2024         477             8221625.3200              164435.3800              164435.3800              164451.6300                  16.2500                   0.0000               -6626.6600                   0.0000                   0.0000                   0.0000                   0.0000              157808.7200 M        68290109                        27 R         A             N        2025-01-31 00:00:00.000 2025-03-24 00:00:00.000 2019-05-16 00:00:00.000                    NULL 2025-04-09 00:00:00.000 Y             

(1 row affected)
shashanksaxena@TZIN-L-291 ~ % 
