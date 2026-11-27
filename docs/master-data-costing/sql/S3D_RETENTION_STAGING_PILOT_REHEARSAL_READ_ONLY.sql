-- S3D: PRE-NOVEMBER COSTING RETENTION — REHEARSAL ASSERTIONS (READ ONLY)
-- Source: live schema, November 22 2026. Designed for staging rehearsal.
-- This file is NOT a delete script; do not auto-convert it into DELETE.
-- Run 87 = illustrative legacy September 2026 unapproved pilot candidate.
-- A passing result is NOT clearance to delete: external SQL/view consumers,
-- 64 run-header FKs, 62 second-order FKs and archival proof still require review.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '120s';

WITH test_runs(run_id) AS (VALUES (87::bigint),(148::bigint),(152::bigint)),
evidence AS (
 SELECT r.id, r.period_start, r.overall_status,
   (r.period_start < DATE '2026-11-01') AS is_legacy,
   EXISTS(SELECT 1 FROM costing.costing_run_designation d WHERE d.refresh_run_id = r.id) AS has_designation,
   EXISTS(SELECT 1 FROM costing.material_review_acceptance_register a WHERE a.source_refresh_run_id=r.id)
     OR EXISTS(SELECT 1 FROM costing.regional_marketing_evidence_acceptance a WHERE a.source_refresh_run_id=r.id)
     OR EXISTS(SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a WHERE a.source_refresh_run_id=r.id)
     OR EXISTS(SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance a WHERE a.accepted_refresh_run_id=r.id)
     OR EXISTS(SELECT 1 FROM costing.manufacturing_cost_behaviour_split a WHERE a.reference_refresh_run_id=r.id)
     OR EXISTS(SELECT 1 FROM costing.costing_period_refresh_authorization a WHERE a.consumed_by_run_id=r.id)
     AS has_known_governance_reference,
   COALESCE(v.approved_run_id=r.id,false) AS approved_period_pointer,
   COALESCE(v.displayed_run_id=r.id,false) AS displayed_period_pointer,
   (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot s WHERE s.refresh_run_id=r.id) AS signed_sales_rows,
   (SELECT count(*) FROM costing.marketing_regional_sales_evidence_snapshot s WHERE s.refresh_run_id=r.id) AS regional_sales_rows,
   (SELECT count(*) FROM costing.cost_sheet_line_traceability_snapshot s WHERE s.refresh_run_id=r.id) AS cost_trace_rows,
   (SELECT count(*) FROM costing.cost_sheet_line_monthly_snapshot s WHERE s.refresh_run_id=r.id) AS cost_line_rows,
   (SELECT count(*) FROM costing.sku_scheme_viability_snapshot s WHERE s.refresh_run_id=r.id) AS scheme_rows
 FROM test_runs t
 JOIN costing.costing_refresh_run r ON r.id=t.run_id
 LEFT JOIN costing.v_costing_period_run_status v ON v.period_start=r.period_start
)
SELECT *,
 CASE WHEN id=87 AND is_legacy AND NOT has_designation AND NOT has_known_governance_reference
       AND NOT approved_period_pointer AND NOT displayed_period_pointer
      THEN 'S3D_STAGING_REHEARSAL_CANDIDATE_NOT_DELETE_AUTHORITY'
      WHEN period_start >= DATE '2026-11-01' THEN 'PROTECTED_OPERATIONAL_PERIOD'
      ELSE 'CONTROLLED_HOLD'
 END AS rehearsal_gate,
 signed_sales_rows+regional_sales_rows+cost_trace_rows+cost_line_rows+scheme_rows AS observed_five_table_rows
FROM evidence
ORDER BY id;

-- Test invariant: the live November display must not be falsely promoted to APPROVED.
SELECT period_start,approved_run_id,displayed_run_id,displayed_run_basis,period_status
FROM costing.v_costing_period_run_status
WHERE period_start IN (DATE '2026-09-01',DATE '2026-10-01',DATE '2026-11-01')
ORDER BY period_start;

-- Authoritative non-numeric acceptance contract:
-- (1) Independently archive/restore the EXACT run 87 per-run rows from all 64 direct
--     run-linked relations and all nested or non-FK references; full type-safe COPY/
--     checksums, identifiers, and FK metadata retained.
-- (2) Compare all approved and current-period SKU prices, cost sheets, printable
--     outputs and signed accounting evidence before/after staging pilot.
-- (3) Validate no cross-run FK joins; reject any cross-run link and preserve
--     accepted ledger, policy/audit fingerprint and historic designation.
-- (4) Deletion executor must use explicit allowlist, advisory locking plus
--     period/finalization checks inside its transaction, idempotent receipts,
--     bounded batches and per-child dependency ordering.
-- (5) Staging pilot sign-off must precede separate authorization to touch
--     production; rollback/reimport receipt must prove reproducibility.
ROLLBACK;
