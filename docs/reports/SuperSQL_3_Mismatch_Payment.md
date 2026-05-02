# SuperSQL: Mismatch Payment Report (rptFlexRct PDF Replica)

This script produces the exact column headers and summary totals matching the **rptFlexRct** report.

## SQL Query
```sql
WITH data AS (
    SELECT 
        COALESCE(ft.file_type_code, 'Unknown') as file_type,
        p.payment_type as pay_code,
        p.source_type as tax_type,
        p.consolidated_amount as amount
    FROM recon.payment p
    LEFT JOIN recon.files f ON p.payment_batch_id = f.id
    LEFT JOIN prc.file_type ft ON f.file_type_id = ft.id
    WHERE (p.payment_status IN ('NSF', 'VOIDED', 'REJECTED'))
        [[ AND p.deposit_date >= {{start_date}}::date ]] 
        [[ AND p.deposit_date <= {{end_date}}::date ]]
),
aggregated AS (
    SELECT file_type, pay_code, tax_type, COUNT(*) as cnt, SUM(amount) as amt, 1 as ord FROM data GROUP BY 1, 2, 3
    UNION ALL
    SELECT 'Totals', '', '', COUNT(*), SUM(amount), 2 FROM data
)
SELECT 
    file_type AS "FileType", pay_code AS "Pay Code", tax_type AS "Tax Type", cnt AS "Count", amt AS "Amount Total"
FROM aggregated
ORDER BY ord, 1, 2, 3;
```
