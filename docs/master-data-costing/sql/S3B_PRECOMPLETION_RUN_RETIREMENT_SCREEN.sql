-- SASV STORAGE / S3b — PRE-COMPLETION COSTING RETIREMENT SCREEN
-- SELECT ONLY. 2026-11 is first fully implemented costing-suite month.
-- No DELETE, ALTER, DROP, cron, or implicit owner approval of destructive execution.
-- Run against production only as a governed read-only assessment.

-- A. Pre-November detail retirement universe; safeguard formal history separately.
WITH designated AS (
    SELECT refresh_run_id, string_agg(designation, ' -> ' ORDER BY designated_at) AS designation_history
    FROM costing.costing_run_designation GROUP BY refresh_run_id
), governance_refs AS (
    SELECT r.id,
        EXISTS (SELECT 1 FROM costing.material_review_acceptance_register x WHERE x.source_refresh_run_id=r.id)
        OR EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance x WHERE x.source_refresh_run_id=r.id)
        OR EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance x WHERE x.source_refresh_run_id=r.id)
        OR EXISTS (SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance x WHERE x.accepted_refresh_run_id=r.id)
        OR EXISTS (SELECT 1 FROM costing.manufacturing_cost_behaviour_split x WHERE x.reference_refresh_run_id=r.id)
        OR EXISTS (SELECT 1 FROM costing.costing_period_refresh_authorization x WHERE x.consumed_by_run_id=r.id)
        AS has_direct_governance_reference
    FROM costing.costing_refresh_run r
)
SELECT r.period_start, r.id AS refresh_run_id, r.overall_status,
       (r.period_start < DATE '2026-11-01') AS legacy_detail_retirement_target,
       COALESCE(d.designation_history, '') AS historical_designation,
       COALESCE(v.displayed_run_id=r.id, FALSE) AS displayed_in_period,
       COALESCE(v.approved_run_id=r.id, FALSE) AS period_approved_pointer,
       COALESCE(g.has_direct_governance_reference, FALSE) AS direct_governance_reference,
       CASE
         WHEN r.period_start >= DATE '2026-11-01'
           THEN 'KEEP_POST_COMPLETION_OPERATIONAL'
         WHEN COALESCE(v.approved_run_id=r.id,FALSE) OR COALESCE(v.displayed_run_id=r.id,FALSE)
           THEN 'LEGACY_DETAIL_HOLD_UNTIL_CONSUMER_CUTOVER'
         WHEN COALESCE(g.has_direct_governance_reference,FALSE)
           THEN 'LEGACY_DETAIL_HOLD_UNTIL_REFERENCE_SEPARATION'
         WHEN d.refresh_run_id IS NOT NULL
           THEN 'LEGACY_DETAIL_HOLD_UNTIL_GOVERNANCE_SEAL'
         ELSE 'LEGACY_DETAIL_PILOT_CANDIDATE_PENDING_FK_AND_ARCHIVE'
       END AS execution_gate
FROM costing.costing_refresh_run r
LEFT JOIN designated d ON d.refresh_run_id=r.id
LEFT JOIN governance_refs g ON g.id=r.id
LEFT JOIN costing.v_costing_period_run_status v ON v.period_start=r.period_start
ORDER BY r.period_start, r.id;

-- B. Current official pointers (November must not silently inherit October costs after retirement).
SELECT period_start,period_status,approved_run_id,displayed_run_id,displayed_run_basis,valuation_date
FROM costing.v_costing_period_run_status
WHERE period_start >= DATE '2026-07-01'
ORDER BY period_start;

-- C. Full FK map of every direct run-header consumer.
-- confdeltype a=NO ACTION, r=RESTRICT, c=CASCADE, n=SET NULL, d=SET DEFAULT.
SELECT n.nspname AS schema_name, t.relname AS child_relation,
       a.attname AS child_column, con.conname AS constraint_name,
       con.confdeltype AS on_delete,
       pg_total_relation_size(t.oid) AS relation_allocated_bytes
FROM pg_constraint con
JOIN pg_class t ON t.oid=con.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(con.conkey)
WHERE con.contype='f'
  AND con.confrelid='costing.costing_refresh_run'::regclass
ORDER BY relation_allocated_bytes DESC, child_relation;

-- D. Snapshot second-order foreign keys: do not retire a parent row while a
--    historical detail consumer still references its id.
WITH direct_children AS (
  SELECT DISTINCT con.conrelid AS relid
  FROM pg_constraint con
  WHERE con.contype='f'
    AND con.confrelid='costing.costing_refresh_run'::regclass
)
SELECT parent_ns.nspname AS parent_schema, parent.relname AS referenced_parent,
       child_ns.nspname AS child_schema, child.relname AS referencing_child,
       con.conname, con.confdeltype AS on_delete
FROM pg_constraint con
JOIN direct_children dc ON dc.relid=con.confrelid
JOIN pg_class parent ON parent.oid=con.confrelid
JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
JOIN pg_class child ON child.oid=con.conrelid
JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
WHERE con.contype='f'
ORDER BY parent_schema,referenced_parent,child_schema,referencing_child;

-- E. Explicit selected-scheme FK risk; PR #492 must solve this lineage.
SELECT con.conname, child_ns.nspname AS child_schema, child.relname AS child_table,
       con.confdeltype AS delete_action
FROM pg_constraint con
JOIN pg_class child ON child.oid=con.conrelid
JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
WHERE con.contype='f'
  AND con.confrelid='costing.sku_scheme_viability_snapshot'::regclass;

-- No result in this file is eligible for direct translation to DML.
