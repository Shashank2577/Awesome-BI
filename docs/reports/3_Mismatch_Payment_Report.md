# Mismatch Payment Report (Standard)

Standard mismatch report by status.

## SQL Query
```sql
SELECT 
    ft.file_type_name AS "FileType",
    p.payment_type AS "Pay Code",
    p.source_type AS "Tax Type",
    COUNT(p.id) AS "Count",
    SUM(p.consolidated_amount) AS "Amount Total"
FROM recon.payment p
LEFT JOIN recon.files f ON p.payment_batch_id = f.id
LEFT JOIN prc.file_type ft ON f.file_type_id = ft.id
WHERE (p.payment_status IN ('NSF', 'VOIDED', 'REJECTED'))
    [[ AND p.deposit_date >= {{start_date}}::date ]] 
    [[ AND p.deposit_date <= {{end_date}}::date ]]
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```
