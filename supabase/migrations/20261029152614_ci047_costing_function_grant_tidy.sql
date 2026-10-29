-- CI-047 costing function grant tidy-up (prepared 29 Oct 2026, NOT APPLIED). Production project qhmoqtxpeasamtlxaoak.
-- Scope: the 37 costing functions that still carry the Postgres default ACL (proacl NULL = EXECUTE for PUBLIC + owner postgres):
-- 11 trigger functions + 26 helpers. Captured read-only 29 Oct 2026 18:45 IST (preimages/pre_ci047_live_function_acls_2026-10-29.json).
-- Change: REVOKE EXECUTE ... FROM PUBLIC on all 37 (anon/authenticated/service_role had EXECUTE only through PUBLIC; none is granted directly).
-- Re-grant EXECUTE TO authenticated on exactly 2 helpers that are called inside views authenticated can read
-- (Postgres checks EXECUTE of functions used in a view against the user querying the view):
--   fn_regional_marketing_review_status(bigint)          <- costing.v_regional_marketing_evidence_review_queue
--   fn_sales_allocation_quantity_driver_review_status(bigint) <- costing.v_sales_allocation_quantity_driver_review_queue
-- Everything else is reached only through SECURITY DEFINER functions owned by postgres, through triggers (EXECUTE is checked
-- when a trigger is created, not when it fires), through cron jobs 66/67/68 (run as postgres = owner), or not at all.
-- service_role and anon have no USAGE on schema costing, so they could never call these directly; no grant is needed for them.
-- No table/view grant, no default-privilege change, no function body change, no data change, no cron change.
BEGIN;
DO $g$
DECLARE v_bad text; v_missing text;
BEGIN
  SELECT string_agg(s, ', ') INTO v_missing FROM unnest(array['costing.fn_after_refresh_run_au2()','costing.fn_apply_regional_default_to_basis_snapshot()','costing.fn_au3_append_only()','costing.fn_enforce_prm_approval_reference()','costing.fn_guard_append_only()','costing.fn_guard_designated_run_header()','costing.fn_guard_designated_run_rows()','costing.fn_guard_refresh_authorization()','costing.fn_guard_regional_sales_default_policy_overlap()','costing.fn_guard_sales_planning_fallback_unit_policy()','costing.fn_guard_snapshot_truncate()','costing.fn_build_internal_source_material_review_actions_as_of(date,date)','costing.fn_build_product_rm_cost_as_of(date,date,bigint)','costing.fn_build_product_rm_requirement_for_product_as_of(bigint,date)','costing.fn_build_sku_material_cost_as_of(date,date,bigint)','costing.fn_build_sku_pm_cost_as_of(date,date,bigint)','costing.fn_compute_run_fingerprint(bigint)','costing.fn_costing_run_scoped_tables()','costing.fn_frozen_valuation_through()','costing.fn_fy_start(date)','costing.fn_internal_source_product_demand_as_of(date,date,bigint)','costing.fn_material_review_acceptance_matches(date,date,bigint,text,text,text,text,numeric,text,date,bigint,bigint,text)','costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)','costing.fn_regional_marketing_review_status(bigint)','costing.fn_resolve_internal_material_rm_rate_as_of(bigint,date,bigint[])','costing.fn_resolve_internal_material_rm_rates_as_of(date)','costing.fn_resolve_packing_labour_responsibility(bigint,date)','costing.fn_resolve_product_internal_conversion_burden(bigint,bigint,bigint[])','costing.fn_resolve_regional_default_commercial_value(bigint,text,numeric,date)','costing.fn_resolve_regional_sales_default_policy_as_of(text,text,date)','costing.fn_resolve_sales_planning_fallback_units_as_of(date)','costing.fn_sales_allocation_quantity_driver_fingerprint(bigint,bigint,date,text,text,date,bigint,bigint,text,numeric,numeric)','costing.fn_sales_allocation_quantity_driver_review_status(bigint)','costing.fn_total_manufacturing_product_demand_as_of(date,date,bigint)','costing.fn_validate_internal_material_source_lineage(bigint)','costing.fn_validate_packing_labour_responsibility_rule(bigint)','costing.fn_verify_run_fingerprint(bigint)']) s WHERE to_regprocedure(s) IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'CI047_FUNCTION_MISSING: %; nothing changed', v_missing; END IF;
  SELECT string_agg(s||'='||coalesce(p.proacl::text,'NULL'), ', ') INTO v_bad FROM unnest(array['costing.fn_after_refresh_run_au2()','costing.fn_apply_regional_default_to_basis_snapshot()','costing.fn_au3_append_only()','costing.fn_enforce_prm_approval_reference()','costing.fn_guard_append_only()','costing.fn_guard_designated_run_header()','costing.fn_guard_designated_run_rows()','costing.fn_guard_refresh_authorization()','costing.fn_guard_regional_sales_default_policy_overlap()','costing.fn_guard_sales_planning_fallback_unit_policy()','costing.fn_guard_snapshot_truncate()','costing.fn_build_internal_source_material_review_actions_as_of(date,date)','costing.fn_build_product_rm_cost_as_of(date,date,bigint)','costing.fn_build_product_rm_requirement_for_product_as_of(bigint,date)','costing.fn_build_sku_material_cost_as_of(date,date,bigint)','costing.fn_build_sku_pm_cost_as_of(date,date,bigint)','costing.fn_compute_run_fingerprint(bigint)','costing.fn_costing_run_scoped_tables()','costing.fn_frozen_valuation_through()','costing.fn_fy_start(date)','costing.fn_internal_source_product_demand_as_of(date,date,bigint)','costing.fn_material_review_acceptance_matches(date,date,bigint,text,text,text,text,numeric,text,date,bigint,bigint,text)','costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric)','costing.fn_regional_marketing_review_status(bigint)','costing.fn_resolve_internal_material_rm_rate_as_of(bigint,date,bigint[])','costing.fn_resolve_internal_material_rm_rates_as_of(date)','costing.fn_resolve_packing_labour_responsibility(bigint,date)','costing.fn_resolve_product_internal_conversion_burden(bigint,bigint,bigint[])','costing.fn_resolve_regional_default_commercial_value(bigint,text,numeric,date)','costing.fn_resolve_regional_sales_default_policy_as_of(text,text,date)','costing.fn_resolve_sales_planning_fallback_units_as_of(date)','costing.fn_sales_allocation_quantity_driver_fingerprint(bigint,bigint,date,text,text,date,bigint,bigint,text,numeric,numeric)','costing.fn_sales_allocation_quantity_driver_review_status(bigint)','costing.fn_total_manufacturing_product_demand_as_of(date,date,bigint)','costing.fn_validate_internal_material_source_lineage(bigint)','costing.fn_validate_packing_labour_responsibility_rule(bigint)','costing.fn_verify_run_fingerprint(bigint)']) s JOIN pg_proc p ON p.oid = to_regprocedure(s)
   WHERE NOT (p.proacl IS NULL OR p.proacl::text IN ('{postgres=X/postgres}','{postgres=X/postgres,authenticated=X/postgres}','{postgres=X/postgres,=X/postgres}','{=X/postgres,postgres=X/postgres}')) OR p.proowner <> 'postgres'::regrole;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'CI047_ACL_CHANGED: % differ from the captured default ACL; nothing changed - investigate', v_bad; END IF;
END $g$;

-- 37 revokes (11 trigger functions first, then 26 helpers)
REVOKE EXECUTE ON FUNCTION costing.fn_after_refresh_run_au2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_apply_regional_default_to_basis_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_au3_append_only() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_enforce_prm_approval_reference() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_append_only() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_designated_run_header() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_designated_run_rows() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_refresh_authorization() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_regional_sales_default_policy_overlap() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_sales_planning_fallback_unit_policy() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_snapshot_truncate() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_build_internal_source_material_review_actions_as_of(date,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_build_product_rm_cost_as_of(date,date,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_build_product_rm_requirement_for_product_as_of(bigint,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_build_sku_material_cost_as_of(date,date,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_build_sku_pm_cost_as_of(date,date,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_compute_run_fingerprint(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_costing_run_scoped_tables() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_frozen_valuation_through() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_fy_start(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_internal_source_product_demand_as_of(date,date,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_material_review_acceptance_matches(date,date,bigint,text,text,text,text,numeric,text,date,bigint,bigint,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_regional_marketing_evidence_fingerprint(bigint,bigint,text,date,text,numeric,numeric,bigint,bigint,text,text,numeric,numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_regional_marketing_review_status(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_internal_material_rm_rate_as_of(bigint,date,bigint[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_internal_material_rm_rates_as_of(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_packing_labour_responsibility(bigint,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_product_internal_conversion_burden(bigint,bigint,bigint[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_regional_default_commercial_value(bigint,text,numeric,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_regional_sales_default_policy_as_of(text,text,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_resolve_sales_planning_fallback_units_as_of(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_sales_allocation_quantity_driver_fingerprint(bigint,bigint,date,text,text,date,bigint,bigint,text,numeric,numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_sales_allocation_quantity_driver_review_status(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_total_manufacturing_product_demand_as_of(date,date,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_validate_internal_material_source_lineage(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_validate_packing_labour_responsibility_rule(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION costing.fn_verify_run_fingerprint(bigint) FROM PUBLIC;

-- 2 explicit grants (view callers)
GRANT EXECUTE ON FUNCTION costing.fn_regional_marketing_review_status(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION costing.fn_sales_allocation_quantity_driver_review_status(bigint) TO authenticated;
COMMIT;
