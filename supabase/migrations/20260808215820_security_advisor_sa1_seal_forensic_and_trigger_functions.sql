-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- SA-1A: seal retained forensic permission evidence from Data API clients.
ALTER TABLE public.user_permissions_canonical_backup_20260126 ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.user_permissions_canonical_backup_20260126 FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_permissions_canonical_backup_20260126 FROM authenticated;

-- SA-1B: trigger functions are internal execution machinery, not Data API RPC endpoints.
-- Remove default/public and explicit client EXECUTE without changing trigger bindings.
REVOKE EXECUTE ON FUNCTION costing.fn_apply_control_snapshot_refresh_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_apply_material_acceptance_source_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_apply_sku_control_hard_blocker_priority() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_enforce_material_snapshot_run_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_enforce_mutable_refresh_run_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_enforce_pricing_snapshot_run_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_enforce_scheme_snapshot_run_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_enforce_selling_price_snapshot_run_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_guard_stage05_exact_snapshot_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_stamp_validate_admin_finance_lineage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_stamp_validate_direct_labour_pool_lineage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION costing.fn_stamp_validate_direct_labour_sku_pool_lineage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bmr_block_changes_if_mapped() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_guard_active_sku_requires_active_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_guard_product_inactivation_requires_no_active_skus() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hub_handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_cols() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_bpb_edit_guard() FROM PUBLIC, anon, authenticated;