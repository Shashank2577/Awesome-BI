# SuperSQL: Monthly Receipt Summary (rptRctSumMult PDF Replica)

This script produces the wide multi-column layout with YTD and percentages, matching the **rptRctSumMult** report exactly.

## SQL Query
```sql
WITH monthly_sums AS (
    SELECT 
        EXTRACT(MONTH FROM p.deposit_date) as m_num,
        TO_CHAR(p.deposit_date, 'Month') as m_name,
        CASE 
            WHEN p.account_type = 'Business' THEN 'Net Profit'
            WHEN p.account_type = 'Individual' AND UPPER(t.residency_status) LIKE 'RESIDENT%' THEN 'Resident'
            WHEN p.account_type = 'Individual' THEN 'Non-Resident'
            ELSE 'Withholding'
        END as line_item,
        SUM(CASE WHEN EXTRACT(YEAR FROM p.deposit_date) = 2026 THEN p.consolidated_amount ELSE 0 END) as val_2026,
        SUM(CASE WHEN EXTRACT(YEAR FROM p.deposit_date) = 2025 THEN p.consolidated_amount ELSE 0 END) as val_2025,
        SUM(CASE WHEN EXTRACT(YEAR FROM p.deposit_date) = 2024 THEN p.consolidated_amount ELSE 0 END) as val_2024,
        SUM(CASE WHEN EXTRACT(YEAR FROM p.deposit_date) = 2023 THEN p.consolidated_amount ELSE 0 END) as val_2023
    FROM recon.payment p
    LEFT JOIN recon.individualtaxpayerpersonalinfo t ON p.entity_id = t.taxpayer_id
    GROUP BY 1, 2, 3
),
monthly_with_totals AS (
    SELECT *, 1 as sort_order FROM monthly_sums
    UNION ALL
    SELECT m_num, m_name, 'Totals', SUM(val_2026), SUM(val_2025), SUM(val_2024), SUM(val_2023), 2 
    FROM monthly_sums GROUP BY 1, 2
),
ytd_calc AS (
    SELECT *,
        SUM(val_2026) OVER (PARTITION BY line_item ORDER BY m_num) as ytd_2026,
        SUM(val_2025) OVER (PARTITION BY line_item ORDER BY m_num) as ytd_2025,
        SUM(val_2024) OVER (PARTITION BY line_item ORDER BY m_num) as ytd_2024,
        SUM(val_2023) OVER (PARTITION BY line_item ORDER BY m_num) as ytd_2023
    FROM monthly_with_totals
)
SELECT 
    m_name AS "Month", line_item AS "Category",
    val_2026 AS "Month 2026", val_2025 AS "Month 2025",
    CASE WHEN val_2025 = 0 THEN '0%' ELSE ROUND(((val_2026 - val_2025) / val_2025 * 100), 2)::text || '%' END AS "Percent",
    ytd_2026 AS "YTD 2026", ytd_2025 AS "YTD 2025",
    CASE WHEN ytd_2025 = 0 THEN '0%' ELSE ROUND(((ytd_2026 - ytd_2025) / ytd_2025 * 100), 2)::text || '%' END AS "Percent ",
    ytd_2024 AS "YTD 2024", 
    CASE WHEN ytd_2024 = 0 THEN '0%' ELSE ROUND(((ytd_2025 - ytd_2024) / ytd_2024 * 100), 2)::text || '%' END AS "Percent  ",
    ytd_2023 AS "YTD 2023"
FROM ytd_calc
ORDER BY m_num, sort_order, line_item;
```
