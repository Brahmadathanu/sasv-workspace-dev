-- S3I — Governed historical snapshot RETENTION POLICY PREVIEW; SELECT ONLY.
-- Source-verified 2026-11-23 (no production modifications).
-- Legacy end 2026-11-01 = first accepted implementation epoch.
-- This file CLASSIFIES only; cannot authorise deletion or bypass live triggers.
--
-- This is one part of the complete S3I preflight:
-- absence of listed six direct acceptance FKs is NOT complete reference safety.
-- Snapshot-to-snapshot FKs (62) + external consumers must be verified separately.
WITH run_facts AS (
 SELECT r.id, r.period_start, r.overall_status,
        EXISTS (SELECT 1 FROM costing.costing_run_designation d
                WHERE d.refresh_run_id=r.id) AS designated,
        EXISTS (SELECT 1 FROM costing.material_review_acceptance_register x
                WHERE x.source_refresh_run_id=r.id) AS material_link,
        EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance x
                WHERE x.source_refresh_run_id=r.id) AS regional_link,
        EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance x
                WHERE x.source_refresh_run_id=r.id) AS sales_link,
        EXISTS (SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance x
                WHERE x.accepted_refresh_run_id=r.id) AS cutover_link,
        EXISTS (SELECT 1 FROM costing.manufacturing_cost_behaviour_split x
                WHERE x.reference_refresh_run_id=r.id) AS behaviour_link,
        EXISTS (SELECT 1 FROM costing.costing_period_refresh_authorization x
                WHERE x.consumed_by_run_id=r.id) AS authorization_link
 FROM costing.costing_refresh_run r
),
classified AS (
 SELECT r.id AS refresh_run_id, r.period_start, r.overall_status, r.designated,
        COALESCE(v.displayed_run_id=r.id,false) AS is_displayed,
        COALESCE(v.approved_run_id=r.id,false) AS has_approved_period_pointer,
        (r.material_link OR r.regional_link OR r.sales_link
          OR r.cutover_link OR r.behaviour_link OR r.authorization_link)
            AS direct_governance_reference,
        CASE
         WHEN r.period_start >= DATE '2026-11-01' THEN 'HOLD_POST_COMPLETION'
         WHEN r.designated THEN 'HOLD_HISTORIC_DESIGNATION'
         WHEN COALESCE(v.displayed_run_id=r.id,false)
           OR COALESCE(v.approved_run_id=r.id,false) THEN 'HOLD_PERIOD_POINTER'
         WHEN (r.material_link OR r.regional_link OR r.sales_link
               OR r.cutover_link OR r.behaviour_link OR r.authorization_link)
           THEN 'HOLD_ACCEPTANCE_LINK'
         WHEN r.overall_status IN ('SUCCESS','FAILED','CANCELLED')
           THEN 'PREVIEW_ONLY_NEEDS_ARCHIVE_AND_GOVERNED_EXECUTOR'
         ELSE 'HOLD_QUEUED_RUNNING_OR_UNKNOWN'
        END AS retention_class
 FROM run_facts r
 LEFT JOIN costing.v_costing_period_run_status v
   ON v.period_start=r.period_start
)
SELECT * FROM classified ORDER BY period_start, refresh_run_id;

-- Negative/positive fixtures: the results are ASSERTIONS FOR REVIEW, not
-- a permission to DELETE.
WITH ids(id, expected) AS (
 VALUES (87::bigint, 'PREVIEW_ONLY_NEEDS_ARCHIVE_AND_GOVERNED_EXECUTOR'),
        (122::bigint,'HOLD_HISTORIC_DESIGNATION'),
        (128::bigint,'HOLD_HISTORIC_DESIGNATION'),
        (136::bigint,'HOLD_HISTORIC_DESIGNATION'),
        (140::bigint,'HOLD_HISTORIC_DESIGNATION'),
        (143::bigint,'HOLD_HISTORIC_DESIGNATION'),
        (148::bigint,'PREVIEW_ONLY_NEEDS_ARCHIVE_AND_GOVERNED_EXECUTOR'),
        (152::bigint,'HOLD_POST_COMPLETION'),
        (153::bigint,'HOLD_POST_COMPLETION')
)
SELECT f.id, f.expected,
  CASE
    WHEN r.id IS NULL THEN 'MISSING_RUN'
    WHEN r.period_start >= DATE '2026-11-01' THEN 'HOLD_POST_COMPLETION'
    WHEN EXISTS(SELECT 1 FROM costing.costing_run_designation d WHERE d.refresh_run_id=r.id)
      THEN 'HOLD_HISTORIC_DESIGNATION'
    WHEN COALESCE(v.displayed_run_id=r.id,false)
       OR COALESCE(v.approved_run_id=r.id,false)
      THEN 'HOLD_PERIOD_POINTER'
    WHEN EXISTS(SELECT 1 FROM costing.material_review_acceptance_register x WHERE x.source_refresh_run_id=r.id)
       OR EXISTS(SELECT 1 FROM costing.regional_marketing_evidence_acceptance x WHERE x.source_refresh_run_id=r.id)
       OR EXISTS(SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance x WHERE x.source_refresh_run_id=r.id)
       OR EXISTS(SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance x WHERE x.accepted_refresh_run_id=r.id)
       OR EXISTS(SELECT 1 FROM costing.manufacturing_cost_behaviour_split x WHERE x.reference_refresh_run_id=r.id)
       OR EXISTS(SELECT 1 FROM costing.costing_period_refresh_authorization x WHERE x.consumed_by_run_id=r.id)
      THEN 'HOLD_ACCEPTANCE_LINK'
    WHEN r.overall_status IN ('SUCCESS','FAILED','CANCELLED')
      THEN 'PREVIEW_ONLY_NEEDS_ARCHIVE_AND_GOVERNED_EXECUTOR'
    ELSE 'HOLD_QUEUED_RUNNING_OR_UNKNOWN'
  END AS actual
FROM ids f
LEFT JOIN costing.costing_refresh_run r ON r.id=f.id
LEFT JOIN costing.v_costing_period_run_status v ON v.period_start=r.period_start
ORDER BY f.id;

-- Do not activate deletion until:
-- 1. An independent retention-specific identity, fixed execution grants and
--    immutable approval/restore receipts exist.
-- 2. Explicit run-ID + allowed table + transaction-scoped authorization is
--    checked by BOTH existing trigger paths, not a session GUC alone.
-- 3. The operator verifies source/restored bytes, all 64+62 FK relationships,
--    external reporting, period finalisation and accepted November cutover.
-- 4. Atomic complete audit receipts, irreversible logical row count checkpoints,
--    maintenance batch limits, regression tests and rollback are proven.
-- 5. Security review verifies that normal authenticated/service_role users
--    cannot exploit any maintenance exception.
