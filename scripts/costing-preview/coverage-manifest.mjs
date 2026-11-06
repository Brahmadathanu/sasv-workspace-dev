// Single source of truth for the synthetic-preview coverage claim (R1/R2/R4 of PR #197 owner review).
// A lens may only be listed POPULATED if tests/lens-coverage.test.mjs renders >= minRows real data rows in Chromium
// with no failure banner and at least one SYNTHETIC-labelled value. Anything else must say why, and is NEVER a PASS.
//   status: POPULATED          - real page renders synthetic rows from contract-evidenced fixtures
//           UNSUPPORTED        - no safe contract evidence for the response shape; page shows an explicit offline message
//           SELECTION_REQUIRED - lens needs a selected route/product and its detail RPC has no safe fixture
//           RESTRICTED         - server-decided role gate; correct to be restricted under the view-only identity
// realData is always "NOT TESTED (real auth)" until the owner-approved authenticated read route (R3) is executed.
const REAL = "NOT TESTED (real auth)";
const T = "types/supabase.ts Row";
const M = "migration 20261019014458 (public view column list)";
const lens = (module, id, label, status, minRows, deps, evidence, extra = {}) => ({ module, id, label, status, minRows, deps, evidence, realData: REAL, ...extra });

export const COVERAGE = Object.freeze([
  // ---- Costing Control Center ----
  lens("costing-control-center", "dashboard", "Dashboard", "POPULATED", 1, ["v_costing_pricing_business_kpi_summary", "v_costing_pricing_control_dashboard_snapshot", "v_costing_pricing_control_integrity_audit_snapshot", "v_costing_pricing_period_run_status", "rpc_get_cost_period_valuation_context"], T + "; valuation Returns[] typed"),
  lens("costing-control-center", "costing-review-workbench", "Control Workbench", "POPULATED", 2, ["v_costing_pricing_material_action_queue_snapshot", "v_costing_material_review_acceptance_register"], T + "; ACTIVE/ACTIVE_MATCHED vocab from material-cost.js"),
  lens("costing-control-center", "sku-control-status", "SKU Control Status", "POPULATED", 3, ["v_costing_pricing_sku_control_status_snapshot"], T + "; status codes from costing-status-labels.js"),
  lens("costing-control-center", "portfolio-readiness", "Readiness", "POPULATED", 3, ["rpc_get_readiness_governed_periods", "rpc_get_product_sku_readiness_portfolio", "rpc_get_readiness_product_gaps"], "envelope + assessment shape from scripts/wp04-readiness-client-contract-smoke.mjs; dependency drill-down arrays left empty (shape not evidenced)"),
  // ---- Material Cost Manager ----
  lens("material-cost-manager", "manual-rate-manager", "Manual Rate Manager", "POPULATED", 2, ["v_costing_manual_rate_manager_action_queue", "v_costing_material_manual_rate_register", "v_costing_material_manual_rate_history", "v_costing_material_manual_rate_review"], T),
  lens("material-cost-manager", "rm-cost-trace", "RM Cost Trace", "RESTRICTED", 0, ["role:material-cost-rm-trace (server)"], "shell restriction notice; trace needs a separate server role", { blocker: "Role-gated by server; needs real authenticated test with the trace role" }),
  lens("material-cost-manager", "pm-cost-trace", "PM Cost Trace", "RESTRICTED", 0, ["role:material-cost-pm-trace (server)"], "shell restriction notice", { blocker: "Role-gated by server; needs real authenticated test with the trace role" }),
  // ---- Cost Build Manager ----
  lens("cost-build-manager", "cost-governance", "Cost Governance", "POPULATED", 3, ["v_costing_unmapped_expense_heads_for_mapping", "v_costing_expense_head_mapping_register", "v_costing_expense_allocation_pool_options", "v_costing_cost_pool_monthly_summary"], T + " (default sub-tab: Unmapped heads)"),
  lens("cost-build-manager", "staff-governance", "Staff Governance", "POPULATED", 2, ["v_costing_unclassified_staff_for_costing", "v_costing_staff_costing_class_options", "v_costing_staff_classification_register", "v_costing_staff_cost_pool_summary"], T),
  lens("cost-build-manager", "manual-provisions", "Manual Provisions", "POPULATED", 1, ["v_costing_manual_cost_pool_provision_register", "v_costing_manual_provision_pool_options", "v_costing_manual_provision_type_options", "v_costing_cost_pool_monthly_summary"], T),
  lens("cost-build-manager", "driver-governance", "Driver Governance", "POPULATED", 7, ["rpc_get_cost_driver_policy_registry"], "registry normaliser + seven-row payload in scripts/driver-governance-helpers-smoke.mjs"),
  // ---- Pricing Policy Manager (10 workspaces) ----
  lens("pricing-policy-manager", "sku-mrp-policies", "SKU MRP Policies", "POPULATED", 3, ["v_sku_mrp_current"], T),
  lens("pricing-policy-manager", "product-derivation-policies", "Product Derivation Policies", "POPULATED", 1, ["v_product_mrp_reference_readiness", "v_product_mrp_derivation_current"], T),
  lens("pricing-policy-manager", "mrp-proposals", "MRP Proposals", "POPULATED", 4, ["v_product_mrp_proposal_register"], T + "; proposal status lifecycle DRAFT/SUBMITTED/APPROVED/APPLIED"),
  lens("pricing-policy-manager", "proposal-decisions", "Proposal Decisions", "POPULATED", 1, ["v_product_mrp_proposal_register"], T),
  lens("pricing-policy-manager", "approved-for-application", "Approved for Application", "POPULATED", 1, ["v_product_mrp_proposal_register"], T),
  lens("pricing-policy-manager", "applied-proposal-history", "Applied Proposal History", "POPULATED", 1, ["v_product_mrp_proposal_register", "v_sku_mrp_policy_history"], T + "; v_sku_mrp_policy_history has no fixture, drill-down shows offline message", { caveat: "Per-line trace drawer not fixtured" }),
  lens("pricing-policy-manager", "sku-overview", "SKU Policy Overview", "POPULATED", 3, ["v_costing_policy_manager_sku_overview", "v_costing_policy_manager_scheme_options"], T + "; IK = Inside Kerala, OK = Outside Kerala"),
  lens("pricing-policy-manager", "scheme-master", "Scheme Master", "POPULATED", 2, ["v_costing_scheme_master_register"], T),
  lens("pricing-policy-manager", "scheme-rule-register", "Scheme Rule Register", "POPULATED", 1, ["v_costing_scheme_policy_rule_register", "v_costing_scheme_policy_scope_options"], T + "; rule_status ACTIVE/CLOSED from pricing-policy.js (Current shows ACTIVE; History tab shows CLOSED)"),
  lens("pricing-policy-manager", "commercial-sales-assumptions", "Commercial Sales Assumptions", "POPULATED", 3, ["v_costing_pricing_commercial_sales_basis", "rpc_get_sales_allocation_default_policies", "rpc_get_regional_sales_allocation_default_policies"], T + "; sales-policy Returns[] typed"),
  // ---- Cost Sheet Review ----
  lens("cost-sheet-review", "sku-cost-sheet", "SKU Cost Details", "POPULATED", 3, ["v_costing_pricing_sku_selector", "v_costing_pricing_sku_detailed_cost_sheet"], T),
  lens("cost-sheet-review", "printable-cost-sheet", "Cost Sheet (printable)", "POPULATED", 3, ["v_costing_pricing_printable_cost_sheet_product_summary", "v_costing_pricing_cost_sheet_line_traceability (drill-down)"], T + "; line-level printable view has no fixture", { caveat: "Product summary table only; per-line printable sheet not fixtured" }),
  lens("cost-sheet-review", "cost-comparison", "Cost Comparison", "POPULATED", 3, ["v_cost_sheet_snapshot_sku_monthly_comparison_governed"], M),
  lens("cost-sheet-review", "scheme-comparison", "Scheme Comparison", "POPULATED", 3, ["v_costing_pricing_sku_scheme_comparison"], T),
  lens("cost-sheet-review", "qc-action-queue", "QC Action Queue", "POPULATED", 2, ["rpc_get_qc_action_queue"], "{row_data,total_count}[] per types; row fields read by qc-action-queue.js; seed action codes from QC_ACTION_TYPE_SEED"),
  lens("cost-sheet-review", "materials-stores-action-queue", "Materials / Stores Action Queue", "POPULATED", 2, ["rpc_get_materials_stores_action_queue"], "same envelope; MS_ACTION_TYPE_SEED codes"),
  // ---- Production Route Manager ----
  lens("production-route-manager", "route-readiness", "Route Readiness", "POPULATED", 3, ["rpc_get_production_route_manager_readiness", "rpc_get_production_route_master_options"], "PRM_READINESS_STATUSES + normalizeReadinessPayload; master options per normalizePrmMasterOptions"),
  lens("production-route-manager", "product-route-assignments", "Product Assignments", "POPULATED", 2, ["rpc_get_production_route_manager_product_assignments"], "normalizePrmProductAssignmentsPayload"),
  lens("production-route-manager", "product-subgroup-mappings", "Subgroup Mappings", "POPULATED", 3, ["rpc_get_production_route_manager_subgroup_mappings"], "normalizePrmSubgroupMappingsPayload"),
  lens("production-route-manager", "shared-workload-preview", "Workload Preview", "UNSUPPORTED", 0, ["rpc_get_production_route_manager_workload_preview"], "no payload shape evidenced in smoke tests/types (Json)", { blocker: "Needs batch-size and route-step evidence payload contract; do not invent" }),
  lens("production-route-manager", "route-families", "Manufacturing Route Families", "POPULATED", 2, ["rpc_get_production_route_master_options"], "normalizePrmRouteFamilyMasterRow"),
  lens("production-route-manager", "route-family-mapping-review", "Mapping Review", "UNSUPPORTED", 0, ["rpc_get_route_family_mapping_review_candidates"], "nested candidate-group payload not evidenced", { blocker: "Needs candidate-group contract" }),
  lens("production-route-manager", "route-family-foundation-review", "Foundation Review", "UNSUPPORTED", 0, ["rpc_get_route_family_foundation_review"], "10-argument evidence payload not evidenced", { blocker: "Needs foundation-review contract" }),
  lens("production-route-manager", "production-cost-centres", "Cost Centres", "POPULATED", 3, ["rpc_get_production_cost_centres", "rpc_get_production_route_master_options"], "normalizePrmProductionCostCentresPayload; type codes EQUIPMENT/PROCESS_AREA/SERVICE_CENTRED", { caveat: "Location catalogues (plants/sections) not fixtured; header notes unavailable" }),
  lens("production-route-manager", "route-family-route-editor", "Route Family Route Editor", "SELECTION_REQUIRED", 0, ["rpc_get_route_family_route_detail (after selection)"], "detail payload not evidenced", { blocker: "Editor needs a selected Family Route; detail RPC not fixtured" }),
  lens("production-route-manager", "product-route-editor", "Product Route Editor", "SELECTION_REQUIRED", 0, ["rpc_get_product_route_detail (after selection)"], "detail payload not evidenced", { blocker: "Editor needs a selected Product Route; detail RPC not fixtured" }),
  lens("production-route-manager", "historical-candidate-review", "Historical Evidence Review", "SELECTION_REQUIRED", 0, ["rpc_preview_product_process_route_candidate (after preview click)"], "preview payload not evidenced", { blocker: "Explicit scope + preview required; preview RPC not fixtured" }),
  lens("production-route-manager", "effective-route-viewer", "Effective Route Viewer", "SELECTION_REQUIRED", 0, ["rpc_get_effective_product_process_route (after product search)"], "effective-route payload not evidenced", { blocker: "Needs a selected product; effective-route RPC not fixtured" }),
  lens("production-route-manager", "archived-routes", "Archived Routes", "POPULATED", 1, ["rpc_get_archived_production_route_architecture"], "normalizePrmArchivedRoutesPayload"),
]);
export const EXPECTED_TOTAL = { CCC: 4, MCM: 3, CBM: 4, PPM: 10, CSR: 6, PRM: 13 };
