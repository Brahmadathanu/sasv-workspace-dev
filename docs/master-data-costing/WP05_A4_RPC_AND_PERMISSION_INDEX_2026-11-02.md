# WP05-A4 — Server/RPC dependency and permission-boundary index (extracted from client code, 2 Nov 2026)

Static extraction from `main` `3d0b618`. **No RPC was invoked.** Server-side behaviour (permission strings inside SQL bodies, maker-checker, run semantics) is **not verified** here unless a migration reference is cited. Per-lens view/RPC lists are in [A1](WP05_A1_LENS_AND_WORKSPACE_INVENTORY_2026-11-02.md); this file is the boundary index.

## 1. Permission model (client)

| Permission key | Source | Gates | Evidence |
|---|---|---|---|
| `module:costing-control-center` view/edit | `get_user_permissions` RPC → `PERM_CAN_VIEW/EDIT`, `PERM_CONTROL_CENTER_EDIT` | CCC lenses; CCC-edit also enables Workbench accept/close and toolbar refresh on every costing page | shell 3440-3523, 1718-1729 |
| `module:material-cost-manager` view/edit | same | MCM rate writes | shell 1722-1724 |
| `module:cost-build-manager` view/edit | same | CBM writes (`canEditCbm`, shell 9521) | |
| `module:pricing-policy-manager` view/edit | same | **single flag** for all ~17 PPM write RPCs (`canEditPricingPolicyActions`) | shell 1732-1734 |
| `module:cost-sheet-review` view/edit | same | edit only enables refresh; lenses read-only | shell 1718-1720 |
| `module:production-route-manager` view/edit | same | **single flag** for create/approve/supersede/inactivate across 13 lenses; also `PERM_PRM_EDIT` for Driver Governance PRM-owned actions | shell 3496, 3508, 1748 |
| `role:material-cost-rm-trace`, `-rm-trace-export`, `-pm-trace`, `-pm-trace-export` | `can_view` of role rows | RM/PM trace load and export; independent of MCM module view | shell 3510-3522; material-cost.js 3974-4012; server `require_permission` in migrations 20260917132804/132827/132859/132917, 20260808095237 |
| Driver Governance per-action `required_module` (`module:cost-build-manager` or `module:production-route-manager`) | server-advertised, evaluated client-side, fail-closed | submit/approve driver policy actions | driver-governance-helpers.js 435-446, 866-871; migrations 20260805143028, 20260806164905 |

Fail-closed: any permission-load failure → all false (shell 3440-3484). Nav is **not** permission-filtered. Permissions are loaded for **one route per page load** (shell 3493).

**Boundary rules for any rationalisation:** (1) keep RM and PM trace roles separate; (2) CCC-edit vs MCM-edit asymmetry on material acceptance is existing behaviour — do not silently change (D3); (3) PPM and PRM have one edit flag each — splitting needs server design; (4) client permission checks are UX only, server `require_permission` is authority.

## 2. RPC / view index by module (names as called by client)

**CCC** — views: `v_costing_pricing_business_kpi_summary`, `_control_dashboard_snapshot`, `_control_integrity_audit_snapshot`, `_material_action_queue_snapshot`, `_material_action_drilldown_snapshot`, `_review_action_item_drilldown_snapshot`, `_sku_control_status_snapshot`, `_sku_control_status_by_run` (flag), `v_costing_pricing_period_run_status`, `v_costing_pricing_run_display_status`, `v_cost_periods`, `v_costing_material_review_acceptance_register`. RPC read: `rpc_get_product_sku_readiness_portfolio`, `rpc_get_readiness_governed_periods`, `rpc_get_readiness_product_gaps`, `rpc_get_cost_period_valuation_context`, `rpc_get_cost_period_governance_history`, `rpc_get_costing_refresh_status`, `rpc_costing_health_check`. **Writes:** `rpc_accept_material_review_action`, `rpc_close_material_review_acceptance`, `rpc_set_cost_period_valuation_date`, `rpc_request_costing_refresh`, `rpc_costing_request_recalculation` (flag). Flag-gated screens (OFF): `rpc_costing_preview_approval_impact` (read-only preview — **must never be called against production in audits**), `rpc_costing_approve_run_with_preview`, `rpc_costing_finalize_monthend_run_with_preview`, `rpc_costing_lock_periods_for_close`, `rpc_costing_lock_period`.

**MCM** — views: `v_costing_manual_rate_manager_action_queue`, `v_costing_material_manual_rate_register/_history/_review`. Reads: `rpc_get_material_vendor_rate_offers`, `rpc_get_material_rate_rm_cost_trace`(+`_filter_options`), `rpc_get_material_rate_pm_cost_trace`(+`_filter_options`). **Writes:** `rpc_set_material_manual_rate`, `rpc_close_material_manual_rate`, `rpc_accept_material_review_action`, `rpc_close_material_review_acceptance`. Exports (confidential): `rpc_export_material_rate_rm_cost_trace`, `rpc_export_material_rate_pm_cost_trace`.

**CBM** — views: `v_costing_expense_head_mapping_register`, `_cost_pool_monthly_summary`, `_unmapped_expense_heads_for_mapping`, `_expense_allocation_pool_options`, `_staff_classification_register`, `_staff_cost_pool_summary`, `_unclassified_staff_for_costing`, `_staff_costing_class_options`, `_manual_provision_pool_options/_type_options`, `_manual_cost_pool_provision_register`. Reads: `rpc_get_cost_driver_policy_registry`, `rpc_get_cost_driver_governance_detail`. **Writes:** `rpc_set_expense_head_costing_map`, `rpc_close_expense_head_costing_map`, `rpc_set_staff_costing_classification`, `rpc_save_manual_cost_pool_provision`, `rpc_deactivate_manual_cost_pool_provision`, driver-policy submit/approve/create-envelope RPCs (A1 §6).

**PPM** — views: `v_sku_mrp_current`, `v_sku_mrp_policy_history`, `v_product_mrp_reference_readiness`, `v_product_mrp_derivation_current/_history`, `v_product_mrp_proposal_register/_lines`, `v_costing_policy_manager_sku_overview`, `_selling_policy_history`, `_scheme_policy_history`, `_scheme_options`, `v_costing_scheme_master_register/_audit`, `v_costing_scheme_policy_rule_register`, `_scope_options`, `v_costing_pricing_commercial_sales_basis`. Reads: `rpc_get_sku_sales_assumptions`, `rpc_get_sales_allocation_default_policies`, `rpc_get_regional_sales_allocation_default_policies`. **Writes (≈17):** `rpc_set_sku_mrp_policy`, `rpc_cancel_scheduled_sku_mrp_policy`, `rpc_set_product_mrp_derivation_policy`, `rpc_cancel_scheduled_product_mrp_derivation_policy`, `rpc_generate_product_mrp_proposal`, `rpc_adjust_product_mrp_proposal_line`, `rpc_submit_product_mrp_proposal`, `rpc_decide_product_mrp_proposal_line`, `rpc_apply_product_mrp_proposal`, `rpc_set_sku_selling_price_policy`, `rpc_set_sku_scheme_policy`, `rpc_create_scheme_master`, `rpc_update_scheme_master_metadata`, `rpc_deactivate_scheme_master`, `rpc_reactivate_scheme_master`, `rpc_set_scheme_policy_rule`, `rpc_close_scheme_policy_rule`, `rpc_set_sku_sales_assumption`, `rpc_close_sku_sales_assumption`, `rpc_set_sales_allocation_default_policies_scoped` (+ read-only `rpc_preview_sales_allocation_default_policy_scope`).

**CSR** — views: `v_costing_pricing_sku_selector`, `_sku_detailed_cost_sheet`, `_sku_scheme_comparison`, `_workflow_diagnostics`, `_sku_status_diagnosis`, `_printable_cost_sheet_product_summary/_lines`, `_cost_sheet_line_traceability`, `v_cost_sheet_snapshot_sku_monthly_comparison_governed`. Reads: `rpc_get_qc_action_queue`, `rpc_get_materials_stores_action_queue`, explain RPCs (A1 §4), `rpc_get_monthly_allocation_driver_trace`. **Only write:** `rpc_request_costing_refresh` (shared chrome).

**PRM** — no views; all `rpc_*` via `costingRpc`. Reads (24): `rpc_get_production_route_master_options`, `_manager_readiness`, `_manager_exact_run_readiness`(mapped, **never called**), `_manager_product_assignments`, `_manager_subgroup_mappings`, `_manager_workload_preview`, `_manager_workload_detail`, `rpc_get_route_workload_management_explain`, `rpc_get_route_family_mapping_review_candidates`, `rpc_get_route_family_foundation_review`, `rpc_get_production_cost_centres`, `_centre_detail`, `rpc_get_route_family_route_detail/_history`, `rpc_get_product_route_detail/_history`, `rpc_get_effective_product_process_route`, `rpc_get_archived_production_route_architecture`, `rpc_preview_route_family_candidate`, `rpc_preview_product_process_route_candidate`, `rpc_preview_product_route_delta_candidate`, `rpc_preview_route_family_route_steps`, adapter-only `rpc_get_production_route_pipeline_status`, `rpc_get_route_family_onboarding_status`. Writes (≈38): family — `rpc_create_route_family`, `rpc_approve_route_family`, `rpc_map_product_group_to_route_family`, `rpc_update_route_family_mapping_draft`, `rpc_approve_route_family_mapping`; subgroup — `rpc_map_product_subgroup_to_route_family`, `rpc_update_…_mapping_draft`, `rpc_submit_…_for_review`, `rpc_approve_…`, `rpc_inactivate_…`; assignment — `rpc_create_product_route_family_assignment_draft`, `_submit_…_for_review`, `_approve_…`, `_cancel_…`, `_inactivate_…`, `rpc_correct_product_route_family_assignment_effective_from`; cost centre — `rpc_create/update/validate/approve/inactivate_production_cost_centre(_draft)`; family route — `rpc_create_route_family_route_draft`, `_clone_…_draft`, `rpc_upsert/delete_route_family_route_step`, `rpc_validate_/submit_/approve_route_family_route`, adapter-only (no UI) `rpc_supersede_route_family_route`, `rpc_create_route_family_onboarding_draft`; product route — `rpc_create/update_product_route_draft`, `rpc_upsert/delete_product_route_override`, `rpc_validate_/submit_/approve_/supersede_product_route`. Legacy `rpc_*_product_group_route*` names appear only in helper lists (not called).

## 3. Contract facts relevant to the known defects

| Fact | Evidence |
|---|---|
| `rpc_create_route_family` builder requires `p_family_code` and `p_family_name`; optional `p_effective_from`, `p_description` | RPCJS 806-836 |
| `rpc_supersede_product_route` takes `p_old_product_route_id`, `p_new_product_route_id` | ED 123; RPCJS 1661-1680 |
| `public.rpc_supersede_product_route` requires two active, APPROVED route versions of the same product; supersedes the old approved route and sets its ending effective date relative to the replacement (independent read-only server review; not re-verified by this audit) | review brief 2 Nov (G2) |
| `public.rpc_create_route_family` requires `p_family_code` **and** `p_family_name` — never generate a code | RPCJS 806-836 + independent review |
| `rpc_decide_product_mrp_proposal_line` checks PPM edit permission, validates proposal state, records the deciding user; inspected body has no explicit different-submitter/approver check (narrow finding; other safeguards not excluded; no implementation authorised) | independent review (G2); D7 |
| Fixed exact-run contexts: Route Readiness default run 80 (2026-07-01 / 2026-07-22; used only by the unused exact-run readiness builder), Workload/Mapping/Foundation run 82 (2026-08-01 / 2026-08-07) — historical fixtures | HLP 166-203, 1940 |
| Approval-reference required by builders for approvals (blank rejected) | RPCJS builders |

## 4. Feature-flag registry (`costing-feature-flags.js`) — all default OFF, `localStorage === "1"`, per-browser

| Flag | Gates |
|---|---|
| `COSTING_RECALC_WITH_DATE_V1` | Recalculation dialog replaces valuation-date chip; approval-mode badge |
| `COSTING_APPROVAL_SCREEN_V1` | Approval screen controller; badge `display_label_v2` |
| `COSTING_LOCK_SCREEN_V1` | Lock screen controller |
| `COSTING_RUN_STATUS_V1` | Run-status screen |
| `COSTING_UX_CONSISTENCY_V1` | Friendly status labels |
| `COSTING_DIALOGS_V1` | In-page dialogs instead of `prompt/confirm` (Production Route only) |
| `COSTING_TABLE_TOOLS_V1` | Sortable headers, column help, CSV formula guard |
| `COSTING_REVIEW_WORKLIST_V1` | Grouped worklist, frozen-run selector, KPI run caption/chip |

Implication: because flags are per-browser localStorage, different users can see different UIs; run-aware SKU inspection exists **only** under `COSTING_REVIEW_WORKLIST_V1`. This audit activated none.
