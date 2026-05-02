# Monthly Revenue Comparison (Standard)

Standard multi-year comparison for Pivot Tables.

## SQL Query
```sql
SELECT 
    EXTRACT(MONTH FROM p.deposit_date) as month_num,
    TO_CHAR(p.deposit_date, 'Month') AS "Month Name",
    CAST(EXTRACT(YEAR FROM p.deposit_date) AS TEXT) AS "Year",
    SUM(p.consolidated_amount) AS "Amount"
FROM recon.payment p
WHERE EXTRACT(YEAR FROM p.deposit_date) BETWEEN 2023 AND 2026
GROUP BY 1, 2, 3
```
