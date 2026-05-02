# SuperSQL: Receipts Distribution Summary (DistSum7 PDF Replica)

This script produces the exact row structure of the **DistSum7** report, including banded sections and grand totals.

## SQL Query
```sql
WITH raw_data AS (
    SELECT 
        CASE 
            WHEN p.account_type = 'Withholding' THEN 'Withholding'
            WHEN p.account_type = 'Business' THEN 'Corporate'
            ELSE 'Individual' 
        END as category,
        CASE WHEN UPPER(t.residency_status) LIKE 'RESIDENT%' THEN 'Resident Totals' ELSE 'Non-Res Totals' END as residency,
        COALESCE(p.tax_paid, 0) as tax, COALESCE(p.interest_paid, 0) as interest, COALESCE(p.penalty_paid, 0) as penalty, COALESCE(p.other_fees, 0) as other
    FROM recon.payment p
    LEFT JOIN recon.individualtaxpayerpersonalinfo t ON p.entity_id = t.taxpayer_id
    WHERE 1=1
        [[ AND p.deposit_date >= {{start_date}}::date ]] 
        [[ AND p.deposit_date <= {{end_date}}::date ]]
),
section_data AS (
    SELECT category, residency as description, SUM(tax) as t, SUM(interest) as i, SUM(penalty) as p, SUM(other) as o, 1 as sort_order FROM raw_data GROUP BY 1, 2
    UNION ALL
    SELECT category, 'Grand Totals for ' || category, SUM(tax), SUM(interest), SUM(penalty), SUM(other), 2 FROM raw_data GROUP BY 1
),
report_totals AS (
    SELECT 'ZZZ' as category, residency as description, SUM(tax) as t, SUM(interest) as i, SUM(penalty) as p, SUM(other) as o, 3 as sort_order FROM raw_data GROUP BY 1, 2
    UNION ALL
    SELECT 'ZZZ', 'TOTAL RECEIPTS', SUM(tax), SUM(interest), SUM(penalty), SUM(other), 4 FROM raw_data
)
SELECT 
    CASE WHEN category = 'ZZZ' THEN 'REPORT TOTALS' ELSE category END AS "Section",
    description AS "Description", 
    t AS "Tax Paid", i AS "Interest Paid", p AS "Penalty Paid", o AS "Other Paid", (t+i+p+o) AS "Total Paid"
FROM (SELECT * FROM section_data UNION ALL SELECT * FROM report_totals) final
ORDER BY 
    CASE WHEN category = 'Withholding' THEN 1 WHEN category = 'Corporate' THEN 2 WHEN category = 'Individual' THEN 3 ELSE 4 END,
    sort_order, description;
```
