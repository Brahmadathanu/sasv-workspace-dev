-- S3b Pilot-85 read-only evidence manifest (no DML; no deletion approval)
-- Run 85 is September pre-completion SUCCESS and has no direct formal designation,
-- no current displayed pointer, and zero links through six audited governance reference types.
-- Snapshot-to-snapshot FKs, non-FK citations and external exports remain unverified.
WITH run_context AS (
  SELECT r.id AS refresh_run_id, r.period_start, r.valuation_date, r.overall_status
  FROM costing.costing_refresh_run r WHERE r.id=85
), child_counts AS (
  SELECT 'cost_sheet_line_traceability_snapshot' AS relation_name, COUNT(*) AS rows
    FROM costing.cost_sheet_line_traceability_snapshot WHERE refresh_run_id=85
  UNION ALL SELECT 'cost_sheet_line_monthly_snapshot', COUNT(*)
    FROM costing.cost_sheet_line_monthly_snapshot WHERE refresh_run_id=85
  UNION ALL SELECT 'marketing_signed_billed_sales_evidence_snapshot', COUNT(*)
    FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=85
  UNION ALL SELECT 'marketing_regional_sales_evidence_snapshot', COUNT(*)
    FROM costing.marketing_regional_sales_evidence_snapshot WHERE refresh_run_id=85
  UNION ALL SELECT 'sku_scheme_viability_snapshot', COUNT(*)
    FROM costing.sku_scheme_viability_snapshot WHERE refresh_run_id=85
)
SELECT r.*, c.relation_name, c.rows,
       'STAGING_ARCHIVE_RESTORE_ONLY_NOT_DELETE_ELIGIBLE' AS decision
FROM run_context r CROSS JOIN child_counts c
ORDER BY c.rows DESC;
-- Separate price/print/report parity against run 152 (current draft) and run 143
-- (previous approved) is mandatory before a production pilot.
