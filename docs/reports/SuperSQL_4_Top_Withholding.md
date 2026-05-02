# SuperSQL: Top Withholding Accounts

This script produces a leaderboard of the top withholding accounts with dynamic limits.

## SQL Query
```sql
SELECT 
    p.account_number AS "Account Number",
    p.taxpayer_name AS "Taxpayer Name",
    SUM(p.tax_paid) AS "Total Withheld"
FROM recon.payment p
WHERE p.account_type = 'Withholding'
GROUP BY p.account_number, p.taxpayer_name
ORDER BY "Total Withheld" DESC
LIMIT {{top_limit}};
```
