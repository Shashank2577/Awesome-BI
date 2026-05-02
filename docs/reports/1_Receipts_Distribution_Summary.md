# Receipts Distribution Summary (Standard)

Standard grouped report for revenue categorization.

## SQL Query
```sql
SELECT
    CASE 
        WHEN p.account_type = 'Withholding' THEN 'Withholding'
        WHEN p.account_type = 'Business' THEN 'Corporate'
        ELSE 'Individual' 
    END AS category,
    SUM(p.tax_paid) AS "Tax Paid",
    SUM(p.interest_paid) AS "Interest Paid",
    SUM(p.penalty_paid) AS "Penalty Paid",
    SUM(p.other_fees) AS "Other Paid",
    SUM(p.consolidated_amount) AS "Total Paid"
FROM recon.payment p
WHERE 1=1
    [[ AND p.deposit_date >= {{start_date}}::date ]] 
    [[ AND p.deposit_date <= {{end_date}}::date ]]
GROUP BY 1
ORDER BY 1 DESC;
```
