-- R4 PROPOSED allowlist seed — NOT REVIEWED, NOT APPLIED. Built relation-by-relation from repository migrations and the live
-- baselines recorded in STORAGE_S0 / issue #539; every row carries its reason. The repository contains DDL for only part of the
-- 64 live direct relations (older migrations were backfilled without bodies), so rows marked confirm_live=true rest on names/
-- evidence from the S0 audit and MUST be verified with preflight/PREFLIGHT_06 before use. Anything not listed stays UNCLASSIFIED,
-- which keeps the purge structurally blocked (fail closed). Run only after a named human has reviewed every row:
--   SELECT set_config('costing_retention.seed_reviewed_by','<reviewer name>',false);  then this file.
-- classification vocabulary: SNAPSHOT_PURGEABLE (run-scoped computed detail) | PERMANENT (governance/audit/identity) | SUMMARY_KEEP (tiny compact audit).
BEGIN;
DO $$ BEGIN
 IF coalesce(current_setting('costing_retention.seed_reviewed_by',true),'')='' THEN
  RAISE EXCEPTION 'R4 seed refused: set costing_retention.seed_reviewed_by to the reviewer name after reviewing every row'; END IF;
END $$;
CREATE TEMP TABLE _seed(table_schema text,table_name text,run_column text,classification text,note text,confirm_live boolean) ON COMMIT DROP;
INSERT INTO _seed VALUES
-- ---- PERMANENT: identity, designation, approval, acceptance and audit evidence (never touched) -------------------------
('costing','costing_run_designation','refresh_run_id','PERMANENT','Approval/reference/revoked history; designation rows are permanent provenance (owner: never delete).',false),
('costing','costing_run_fingerprint','refresh_run_id','PERMANENT','Append-only fingerprint evidence captured at success/designation; survives purge as proof of what was approved.',false),
('costing','costing_period_refresh_authorization','consumed_by_run_id','PERMANENT','Supersession authorisation consumed by a run; governance record.',false),
('costing','cost_driver_policy_cutover_acceptance','accepted_refresh_run_id','PERMANENT','Owner acceptance of a driver-policy cutover; approval evidence.',false),
('costing','manufacturing_cost_behaviour_split','reference_refresh_run_id','PERMANENT','Human-approved classification of reference amounts (approval_reference/approval_by/approved_at); a policy-input audit, not a computed run snapshot. reference_refresh_run_id only names the run it was drawn from.',false),
('costing','regional_marketing_evidence_acceptance','source_refresh_run_id','PERMANENT','Acceptance register; permanent evidence event (R2) replaces the snapshot FKs (R2C).',false),
('costing','sales_allocation_quantity_driver_acceptance','source_refresh_run_id','PERMANENT','Acceptance register; permanent evidence event (R2) replaces the snapshot FK (R2C).',false),
('costing','material_review_acceptance_register','source_refresh_run_id','PERMANENT','Acceptance copies its source rate evidence into the row (source_selected_rate, source_rate_source, source_evidence_fingerprint); matching recomputes from live as-of functions, not stored snapshot rows. Only the write-path trigger reads material_costing_action_queue_snapshot (see R4_DEPENDENCY_REVIEW.md).',true),
('costing','governance_evidence_event','source_refresh_run_id','PERMANENT','R2 append-only acceptance evidence events replacing the dropped snapshot FKs (R2C); never deleted.',false),
('costing','costing_run_retention_ledger','refresh_run_id','PERMANENT','R1 compact run ledger: identity, status, retention state and receipt reference for every run (header stays, detail goes).',false),
('costing_retention','purge_step_receipt','refresh_run_id','PERMANENT','R4 purge receipts: per-step and final counts plus residual proof; the durable record that a run was purged.',false),
-- ---- SUMMARY_KEEP -------------------------------------------------------------------------------------------------------
('costing','default_volume_cap_log','refresh_run_id','SUMMARY_KEEP','PK (run,pool): one tiny audit row per allocation pool recording the volume-cap scale factor applied; compact decision audit, not detail.',false),
-- ---- SNAPSHOT_PURGEABLE: run-scoped computed detail (repo-evidenced DDL) ------------------------------------------------
('costing','cost_pool_monthly_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Frozen pool amounts per run; parent of 6 nested snapshot FKs (14 inbound per S0). Purge children first.',false),
('costing','direct_labour_component_pool_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run frozen labour component pool amounts derived from cost_pool_monthly_snapshot; computed detail.',false),
('costing','product_direct_labour_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run product direct-labour workload computed from the route policy (FK to the labour component pool snapshot); recomputable detail, no approval content.',false),
('costing','product_direct_labour_step_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run route-step labour detail under a product workload row; computed lineage, child of product_direct_labour_workload_snapshot.',false),
('costing','sku_packing_labour_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run packing workload; child of sku_sales_allocation_basis_snapshot and labour pool snapshot.',false),
('costing','product_production_overhead_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run production-overhead workload by product (FK to cost pool snapshot); computed detail.',false),
('costing','product_production_overhead_step_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run overhead route-step detail under a product workload row; computed lineage.',false),
('costing','sku_production_overhead_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run SKU overhead allocation computed from the workload and pool snapshots; feeds sku_overhead_allocation_snapshot of the same run.',false),
('costing','product_qc_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run QC workload per product computed from the QC policy; recomputable detail.',false),
('costing','product_qc_method_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run QC method-level workload under a product QC workload row; computed detail.',false),
('costing','product_qc_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run product QC monetary allocation from workload and pool snapshots; parent of SKU QC allocation rows.',false),
('costing','sku_qc_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run SKU QC allocation derived from product QC allocation and the sales basis snapshot; computed detail.',false),
('costing','product_rm_stores_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run raw-material stores workload per product computed from the stores policy; computed detail.',false),
('costing','sku_pm_stores_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run packing-material stores workload per SKU; computed detail.',false),
('costing','sku_materials_stores_workload_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run SKU materials-stores workload combining RM and PM workloads; computed detail.',false),
('costing','sku_materials_stores_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run SKU materials-stores monetary allocation from workload and pool snapshots; computed detail.',false),
('costing','sku_overhead_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run overhead allocation detail; child of 4 other snapshots.',true),
('costing','product_internal_source_materials_stores_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run internal-source allocation detail.',false),
('costing','internal_source_material_review_queue_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run review queue snapshot (review decisions live in the acceptance register).',false),
('costing','sku_internal_material_conversion_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-run internal-material conversion costing per SKU; computed detail.',false),
('costing','regional_marketing_action_queue_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run action queue snapshot.',false),
('costing','sku_regional_marketing_expense_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run regional allocation; acceptance FKs removed by R2C first.',false),
('costing','sku_regional_marketing_allocation_basis_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run regional basis; acceptance FK removed by R2C first.',true),
('costing','sku_sales_allocation_basis_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run sales basis; acceptance FK removed by R2C first; parent of packing/qc/regional snapshot FKs.',true),
('costing','sku_pricing_bridge_profit_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run pricing-bridge profit detail; consumers read the pointer (approved/displayed) run only, which R3/R4 protect.',false),
('costing','route_step_load_provenance_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','AU-9 G4 per-step load lineage of the run''s own calculation (written from Nov 2026). Detail lineage, not approval evidence; OWNER TO CONFIRM it is not wanted as long-term audit.',true),
-- ---- relations known from the S0 live audit (names only; DDL not in repo) -> confirm with PREFLIGHT_06 -------------------
('costing','cost_sheet_line_traceability_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Largest relation (3.5 GB, ~1.45M rows): per-line traceability of a run.',true),
('costing','cost_sheet_line_monthly_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Per-line monthly cost sheet detail (1.3 GB).',true),
('costing','cost_sheet_rm_line_traceability_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','RM line traceability (655 MB).',true),
('costing','marketing_regional_sales_evidence_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Frozen regional sales evidence rows (3.1 GB); acceptance evidence is held in R2 events, not here.',true),
('costing','marketing_signed_billed_sales_evidence_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Frozen signed/billed sales evidence rows (2.7 GB).',true),
('costing','sku_rm_material_cost_line_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','RM cost line detail (679 MB).',true),
('costing','product_rm_material_cost_line_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','RM cost line detail (386 MB).',true),
('costing','sku_scheme_viability_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','NOT a redundant cache: stage-03 writes it and selected-scheme IK/OK viability, the scheme-master register, KPI and the governed pricing/profit views read it for the pointer run. Per-run rows of non-pointer runs are purgeable; retained months keep theirs.',true),
('costing','sku_direct_labour_allocation_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run allocation detail; FK to sku_packing_labour_workload_snapshot.',true),
('costing','sku_pricing_bridge_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run pricing bridge; parent of sku_pricing_bridge_profit_snapshot.',true),
('costing','material_costing_action_queue_snapshot','refresh_run_id','SNAPSHOT_PURGEABLE','Run action queue; read only by the material-acceptance WRITE trigger (re-saving an acceptance after purge would not find its queue row — by design, like R2).',true);
DO $$ DECLARE v text:=current_setting('costing_retention.seed_reviewed_by'); BEGIN
 INSERT INTO costing_retention.purge_allowlist(table_schema,table_name,run_column,classification,note,reviewed_by)
  SELECT table_schema,table_name,run_column,classification,note||CASE WHEN confirm_live THEN ' [confirm_live: verify against PREFLIGHT_06 before relying on this row]' ELSE '' END,v FROM _seed
  ON CONFLICT (table_schema,table_name) DO NOTHING;
END $$;
COMMIT;
-- After applying: SELECT * FROM costing_retention.fn_purge_structural_blockers();  must be empty. Expected until PREFLIGHT_06 is merged:
-- UNCLASSIFIED_RUN_LINKED_RELATION for the live direct relations this proposal does not yet name (the remaining ~25 of 64).
