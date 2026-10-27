# CTTRAIN — W3 Employer Withholdings Query

## Connection Details

| Field    | Value                        |
|----------|------------------------------|
| Server   | `10.10.1.133,1433`           |
| Database | `CTTRAIN`                    |
| Username | `sa`                         |
| Password | `xxxs`                       |

---

## Run Command (replace `xxxs` with real password)

```cmd
sqlcmd -S 10.10.1.133,1433 -U sa -P "Pass123" -d CTTRAIN -Q "SELECT e.EMPLOYERTAXID AS [EIN], t.LNAME AS [Employer Name], e.TAXYEAR AS [Tax Year], e.NUMBEROFW2S AS [W3 # of W2s], e.W3GROSSWAGES AS [W3 Wages], e.W3WITHHOLDINGS AS [W3 Withholdings], e.REPORTEDWH AS [W3 Liability], e.YTDWITHHOLDINGPAYMENTS AS [WH Payments], e.YTDREFUNDS AS [Refunds], e.ADJUSTMENTS AS [Adjustments], e.ASSESSMENTS AS [Assessments], e.CURRENTBALANCE AS [Balance Due], e.ASSESSMENTBALANCE AS [Assessment Balance], e.PENALTY_CHARGED AS [Penalty], e.INTEREST_CHARGED AS [Interest], e.FEES AS [Fees], e.PAYMENTFREQUENCY AS [Pay Freq], e.TRANSACTIONNUMBER AS [Transaction #], e.RESIDENCY AS [Residency], e.RECORDSTATUS AS [Record Status], e.BANKRUPT AS [Bankrupt], e.DUEDATE AS [Due Date], e.RECEIVED AS [Date Received], e.STARTDATE AS [Started], e.STOPDATE AS [Stopped], e.W3POSTDATE AS [W3 Post Date], e.W3POSTSTATUS AS [W3 Post Status] FROM EMPLOYER e JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID WHERE e.TAXYEAR IN ('2025','2024') ORDER BY e.TAXYEAR DESC, t.LNAME;"
```

---

## Formatted (multi-line) version of the same query

```sql
SELECT
  e.EMPLOYERTAXID          AS [EIN],
  t.LNAME                  AS [Employer Name],
  e.TAXYEAR                AS [Tax Year],
  e.NUMBEROFW2S            AS [W3 # of W2s],
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
WHERE e.TAXYEAR IN ('2025', '2024')
ORDER BY e.TAXYEAR DESC, t.LNAME;
```

---

## Optional Filters (add to WHERE clause)

| Goal                        | Add to WHERE                              |
|-----------------------------|-------------------------------------------|
| Single employer by EIN      | `AND e.EMPLOYERTAXID = '263290063W'`      |
| Single year only            | `AND e.TAXYEAR = '2024'`                  |
| Only W3-posted records      | `AND e.W3POSTSTATUS = 'Y'`               |
| Only active accounts        | `AND e.RECORDSTATUS = 'A'`               |
| Has a balance due           | `AND e.CURRENTBALANCE <> 0`              |
| Monthly filers only         | `AND e.PAYMENTFREQUENCY = 'M'`           |

---

## Table & Column Reference

| Screen Label        | Table      | Column                   |
|---------------------|------------|--------------------------|
| EIN                 | EMPLOYER   | EMPLOYERTAXID            |
| Employer Name       | TAXPAYER   | LNAME                    |
| Tax Year            | EMPLOYER   | TAXYEAR                  |
| W3 # of W2s         | EMPLOYER   | NUMBEROFW2S              |
| W3 Wages            | EMPLOYER   | W3GROSSWAGES             |
| W3 Withholdings     | EMPLOYER   | W3WITHHOLDINGS           |
| W3 Liability        | EMPLOYER   | REPORTEDWH               |
| WH Payments         | EMPLOYER   | YTDWITHHOLDINGPAYMENTS   |
| Refunds             | EMPLOYER   | YTDREFUNDS               |
| Adjustments         | EMPLOYER   | ADJUSTMENTS              |
| Assessments         | EMPLOYER   | ASSESSMENTS              |
| Balance Due         | EMPLOYER   | CURRENTBALANCE           |
| Assessment Balance  | EMPLOYER   | ASSESSMENTBALANCE        |
| Penalty             | EMPLOYER   | PENALTY_CHARGED          |
| Interest            | EMPLOYER   | INTEREST_CHARGED         |
| Fees                | EMPLOYER   | FEES                     |
| Payment Frequency   | EMPLOYER   | PAYMENTFREQUENCY         |
| Transaction #       | EMPLOYER   | TRANSACTIONNUMBER        |
| Residency           | EMPLOYER   | RESIDENCY                |
| Record Status       | EMPLOYER   | RECORDSTATUS             |
| Bankrupt            | EMPLOYER   | BANKRUPT                 |
| Due Date            | EMPLOYER   | DUEDATE                  |
| Date Received       | EMPLOYER   | RECEIVED                 |
| Started             | EMPLOYER   | STARTDATE                |
| Stopped / Clear     | EMPLOYER   | STOPDATE                 |
| W3 Post Date        | EMPLOYER   | W3POSTDATE               |
| W3 Post Status      | EMPLOYER   | W3POSTSTATUS             |
