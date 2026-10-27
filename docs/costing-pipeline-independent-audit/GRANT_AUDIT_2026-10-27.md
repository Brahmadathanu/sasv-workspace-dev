# Grant audit — costing schema (read-only, 27 Oct 2026)

Checked on production with `has_function_privilege`, `has_table_privilege`, `pg_proc.proacl` and `pg_class` (SELECT only). **Nothing was changed. The fix below is prepared text, not a migration.**

## Findings
| Item | Count | Notes |
|---|---|---|
| Schema `costing` usage | authenticated: yes; anon: **no** | Without schema usage, anon cannot reach any costing object even where a grant exists |
| Costing functions | 312 | |
| Functions executable by PUBLIC (default grant) | **37** | 11 trigger functions + 26 helper functions |
| Tables/views readable by authenticated | **47** of 224 | 37 tables (16 with row-level security) + 10 views |
| Tables/views readable by anon | 0 | |
| Tables writable by authenticated | 0 | |

**Correction to earlier figures:** "three older trigger functions" was an undercount — **11** costing trigger functions keep the default PUBLIC execute grant. "47 objects readable by authenticated" is confirmed.

### Trigger functions with PUBLIC execute (11)
`fn_guard_regional_sales_default_policy_overlap`, `fn_guard_sales_planning_fallback_unit_policy`, `fn_au3_append_only`, `fn_enforce_prm_approval_reference`, `fn_apply_regional_default_to_basis_snapshot`, `fn_guard_refresh_authorization`, `fn_guard_append_only`, `fn_guard_designated_run_rows`, `fn_guard_snapshot_truncate`, `fn_guard_designated_run_header`, `fn_after_refresh_run_au2`. Trigger functions cannot be called directly (Postgres refuses outside a trigger), so the practical risk is low; tidying is hygiene.

### Helper functions with PUBLIC execute (26)
Read/compute helpers such as `fn_verify_run_fingerprint`, `fn_compute_run_fingerprint`, `fn_build_sku_material_cost_as_of`, `fn_build_sku_pm_cost_as_of`, resolvers (`fn_resolve_*`) and review-status helpers. The API exposes only the `public` schema, so these are not callable over the API; logged-in users could reach them only through a public wrapper.

### Readable by authenticated (47)
Tables: batch_true_absorption_variance, batch_true_standard_switch, capacity_fallback_policy, capacity_master_revision, costing_control_dashboard_snapshot*, costing_control_integrity_audit_snapshot*, costing_review_action_item_drilldown_snapshot*, costing_review_top_action_item_snapshot*, costing_review_workbench_summary_snapshot*, costing_run_designation, costing_run_fingerprint, costing_run_fingerprint_rebaseline, costing_sales_feed_switch, machine_applicability_class, machine_equipment_class, material_costing_action_drilldown_snapshot*, material_costing_action_queue_snapshot*, material_manual_rates*, plant_aware_load_switch, plant_capacity_profile, product_mrp_derivation_policy*, product_mrp_proposal*, product_mrp_proposal_line*, qc_batch_true_switch, route_batch_charge_unit_mass, route_equipment_load_capacity, route_load_scaling_snapshot, route_load_scaling_switch, route_step_capacity_rule, route_step_load_provenance_snapshot, scheme_master*, scheme_policy_rules*, sku_costing_control_status_snapshot*, sku_direct_labour_allocation_snapshot*, sku_mrp_policy*, sku_scheme_policy*, sku_scheme_viability_snapshot* (* = row-level security on).
Views: v_capacity_value_origin, v_costing_run_effective_designation, v_costing_sku_selector, v_current_successful_costing_refresh_run, v_plant_capacity_readiness, v_regional_marketing_evidence_review_queue, v_run_fingerprint_method, v_sales_allocation_quantity_driver_review_queue, v_sku_detailed_cost_sheet_current, v_sku_scheme_comparison_current.
These are not exposed over the API (schema `costing` is not in the API schema list); the risk is low but read access should be deliberate.

## Proposed fix (prepared, NOT applied; needs the owner's approval and isolation testing)
1. `REVOKE EXECUTE ON FUNCTION costing.<each of the 11 trigger functions>() FROM PUBLIC;` — triggers keep working (Postgres checks EXECUTE on a trigger function when the trigger is created, not when it fires).
2. For the 26 helpers: `REVOKE EXECUTE … FROM PUBLIC;` then `GRANT EXECUTE … TO authenticated` only where a public wrapper needs it (to be checked function by function).
3. For the 47 relations: check each against client and wrapper use (not yet checked); revoke SELECT from authenticated where unused.
4. Rollback text: the matching `GRANT` statements. Verify with the same read-only queries.
