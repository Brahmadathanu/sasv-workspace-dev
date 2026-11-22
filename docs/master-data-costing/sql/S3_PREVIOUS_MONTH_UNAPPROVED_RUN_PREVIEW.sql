-- S3 PREVIEW ONLY: monthly previous-period unapproved costing run retention
-- Verified as a SELECT-only classification against live SASV on 2026-11-22.
-- Never use this query output directly in a DELETE. No production mutation.
-- The monthly automation must run AFTER the previous month's finalisation,
-- and must re-evaluate all protection gates under a database lock before acting.
WITH current_month AS (
  SELECT date_trunc('month', timezone('Asia/Kolkata', now()))::date AS period_start
),
designation_history AS (
  SELECT refresh_run_id,
         string_agg(designation, ' → ' ORDER BY designated_at) AS ledger
  FROM costing.costing_run_designation
  GROUP BY refresh_run_id
),
governance_links AS (
  SELECT r.id,
         (
           EXISTS (SELECT 1 FROM costing.material_review_acceptance_register x WHERE x.source_refresh_run_id = r.id)
           OR EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance x WHERE x.source_refresh_run_id = r.id)
           OR EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance x WHERE x.source_refresh_run_id = r.id)
           OR EXISTS (SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance x WHERE x.accepted_refresh_run_id = r.id)
           OR EXISTS (SELECT 1 FROM costing.manufacturing_cost_behaviour_split x WHERE x.reference_refresh_run_id = r.id)
           OR EXISTS (SELECT 1 FROM costing.costing_period_refresh_authorization x WHERE x.consumed_by_run_id = r.id)
         ) AS linked
  FROM costing.costing_refresh_run r
),
classified AS (
  SELECT r.period_start, r.id AS run_id, r.overall_status,
         COALESCE(d.ledger, '—') AS designation_history,
         v.period_status,
         COALESCE(v.displayed_run_id = r.id, false) AS displayed,
         g.linked AS governance_linked,
         CASE
           WHEN r.period_start >= c.period_start THEN 'HOLD_CURRENT_MONTH'
           WHEN d.refresh_run_id IS NOT NULL THEN 'HOLD_DESIGNATED'
           WHEN (v.displayed_run_id = r.id OR v.approved_run_id = r.id) THEN 'HOLD_PRESENTED'
           WHEN g.linked THEN 'HOLD_GOVERNANCE_LINK'
           WHEN r.overall_status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED') THEN 'HOLD_INCOMPLETE'
           ELSE 'PREVIEW_ONLY_UNAPPROVED_PREVIOUS_MONTH'
         END AS retention_class
  FROM costing.costing_refresh_run r
  CROSS JOIN current_month c
  LEFT JOIN designation_history d ON d.refresh_run_id = r.id
  LEFT JOIN governance_links g ON g.id = r.id
  LEFT JOIN costing.v_costing_period_run_status v ON v.period_start = r.period_start
)
SELECT *
FROM classified
ORDER BY period_start, run_id;

-- Guardrails not yet implemented as SQL predicates:
-- 1. Finalisation-grace + period lock check; no automatic purge of unresolved prior month.
-- 2. Every one of the 64 live FK consumers, including snapshot-to-snapshot child FKs.
-- 3. Immutable accepted financial/source ledger & external report links.
-- 4. Verified archive checksum, restore rehearsal, signed owner-authorised pilot.
-- 5. Idempotent batched deletion, controlled vacuum/reclaim, scheduler and telemetry.
-- Hence class PREVIEW_ONLY... is not DELETE_ELIGIBLE.
