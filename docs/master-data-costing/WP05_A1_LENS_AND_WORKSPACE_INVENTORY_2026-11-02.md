# WP05-A1 — Complete lens and nested-workspace inventory (2 Nov 2026)

Part of the WP05 audit set (index: [WP-05-COSTING-SUITE-RATIONALISATION.md](WP-05-COSTING-SUITE-RATIONALISATION.md)). Audit baseline: `main` = `3d0b6185f4351469cf23969beefac0e8875e0c2e` (did not move during the audit).

**Evidence convention.** `[CC]` = code-confirmed by static source inspection (file:line at the baseline SHA). `[A]` = assumption / not verified. **No browser-confirmed behaviour is claimed anywhere in this set**: nothing was clicked, no signed-in session was used, no RPC was invoked. The only executed evidence is the test run in [A7](WP05_A7_REGRESSION_EVIDENCE_2026-11-02.md).

Path abbreviations: all JS under `public/shared/js/`; pages under `public/shared/`. `shell` = `costing-suite-shell.js`.

## 0. Lens-count reconciliation (32 vs 37)

* `costing-suite-registry.js` (HEAD `3d0b618`) registers **6 modules / 32 lenses**: CCC 4 + MCM 3 + CBM 4 + PPM 2 + CSR 6 + PRM 13 = 32 [CC].
* The same registry at the 25 Oct audit's era (`e20a8f0`, 10 Oct) also has exactly 32 `suiteId` entries [CC `git show e20a8f0:...`]. The registry file has only two commits (`e20a8f0`, `3d0b618`; the latter changed only the CSR *label*). **So no registry state ever held 37 lenses.**
* The 25 Oct audit's own table (4+3+4+2+6+13) sums to 32 as well; the "37" headline was a miscount. Plausible origin [A]: counting PPM's then-existing workspaces (7) instead of its 2 registry lenses (4+3+4+7+6+13 = 37). Today PPM has **10** workspaces (§3), so a "lenses + workspaces" count would now be 40 — a different metric.
* **Current canonical count: 32 top-level lenses; 10 PPM workspaces nested under 2 lenses.** Use these numbers going forward.

## 1. Cross-cutting facts

| Fact | Evidence |
|---|---|
| One shared shell drives all six pages; each page calls `bootstrapCostingSuite(<moduleKey>)` | `*-entry.js:4`; shell |
| Navigation = flat per-module lens list from `allowedLensIds`; **not filtered by permission** (trace tabs visible without trace role) | `costing-route-config.js:9-109`; shell `buildActiveLenses` 1457-1462 [CC] |
| Permission = one `module:<route>` row per page (`PERM_CAN_VIEW/EDIT`, strict `=== true`, fail-closed) | shell 3440-3523 [CC] |
| 8 default-OFF localStorage flags (`"1"` only) | `costing-feature-flags.js` [CC] — see A4 §4 |
| Module launcher / Utilities Hub entries are **not defined in repo JS** (server `public.app_modules`) | no match outside entry/route-config; [A] |
| `sw.js` cache `hub-cache-v390` | `public/sw.js:2` [CC]; live deployment unverified |

## 2. Costing Control Center (`costing-control-center.html`; `module:costing-control-center`; default `dashboard`)

All four lenses `periodScoped:true`; KPI strip shown on every CCC lens (`data-costing-show-kpi`, shell 1872-1878, reload shell 4592) [CC].

| Lens | Purpose / primary task | Entry & discoverability | Actions (R/W) | Controller | Data | Gating & period/run context | Cross-links |
|---|---|---|---|---|---|---|---|
| `dashboard` Dashboard | Control snapshot, readiness counts, integrity overview — landing | Default lens; KPI drill-downs `drillToLens` (shell 9558) | R only (drill; toolbar Refresh needs edit) | `control-center.js` `loadGlobalSummaries` 606, `loadDashboardRows` 637 | `v_costing_pricing_business_kpi_summary`, `_control_dashboard_snapshot`, `_control_integrity_audit_snapshot` (by `period_start`) | View `module:costing-control-center`. Governed-run snapshot; run caption/card only with `COSTING_REVIEW_WORKLIST_V1` | Drills to workbench / SKU control |
| `costing-review-workbench` Control Workbench | Triage material BLOCKER/REVIEW queue; accept/close review acceptance | Tab; remediation target from SKU control | **W:** Accept Review, Close Acceptance | `control-center.js` 629-660; accept code lives in `material-cost.js` 3128/3181/3513 | `v_costing_pricing_material_action_queue_snapshot`, `v_costing_material_review_acceptance_register`, `_material_action_drilldown_snapshot`, `_review_action_item_drilldown_snapshot` | Edit = `PERM_CAN_EDIT \|\| PERM_CONTROL_CENTER_EDIT` (shell 1722-1729) → **CCC-edit users can write material acceptances without MCM edit**. Governed-run, by period | → MCM Manual Rate Manager (`recommended-ui-route.js` 179-192) |
| `sku-control-status` SKU Control Status | Canonical SKU remediation index (primary control, recommended route, secondary material evidence) | Tab; deep link `?lens=sku-control-status`; KPI drills | R table/drawer/CSV; **"Open fix screen"** navigation | `control-center.js` `loadSkuControlStatusRows` 663-690; `costing-review-worklist.js` | `v_costing_pricing_sku_control_status_snapshot` (client paged 1000); flag ON: `v_costing_pricing_sku_control_status_by_run` + `v_costing_pricing_period_run_status` | View. Run-scoped (draft/approved frozen run selector) **only with `COSTING_REVIEW_WORKLIST_V1`** | PRM, MCM, PPM via `resolveRecommendedUiRouteTarget`; `COST_APPROVAL_WORKBENCH` is non-navigable (`recommended-ui-route.js` 326-332) |
| `portfolio-readiness` Readiness | Live portfolio readiness (LIVE_AS_OF governed server contract) | Tab | R only; no fix navigation, no shared CSV | `readiness.js` (2255 lines); shell 4600-4620 | RPCs `rpc_get_product_sku_readiness_portfolio`, `rpc_get_readiness_governed_periods`, `rpc_get_readiness_product_gaps` | View. Live, not run-frozen; no run selector; server keyset paging | Route code shown as text only |

Nested/cross-cutting CCC components: cost-period valuation chip (`cost-period-valuation*.js`; `rpc_get_cost_period_valuation_context`, `rpc_get_cost_period_governance_history`, `rpc_set_cost_period_valuation_date` — **W**, suppressed under `COSTING_RECALC_WITH_DATE_V1`); recalculation dialog (`costing-recalculation.js`, `rpc_costing_request_recalculation`); run-status badge/popover/screen, approval screen, lock screen (all flag-gated, see A4 §4).

## 3. Pricing Policy Manager (`pricing-policy-manager.html`; `module:pricing-policy-manager`; landing `sku-overview`)

The 2 registry lenses (`mrp-governance`, `policy-manager`) are **internal loader ids**; the real navigation is **10 flat workspaces** `PRICING_POLICY_WORKSPACES` (`pricing-policy.js` 84-200) in 3 presentation groups (65-69); canonical URL `?workspace=` (702-715) [CC]. All writes gated by the single `canEditPricingPolicyActions()` = `PERM_CAN_EDIT` (shell 1732-1734); all effective-dated via `p_effective_from`, future dates schedule and are cancellable. No feature flags in these controllers [CC by grep of controllers only].

| # | Workspace id | Purpose | Reads | Writes | Dating | Notes |
|---|---|---|---|---|---|---|
| 1 | `sku-mrp-policies` | Govern canonical SKU MRP (Current / Policy History) | `v_sku_mrp_current`, `v_sku_mrp_policy_history` | `rpc_set_sku_mrp_policy`, `rpc_cancel_scheduled_sku_mrp_policy` | Explicit effective-from; same/earlier date blocked (2802-2815); future → "Review Scheduled Policy" | Same modal reachable from #7 drawer |
| 2 | `product-derivation-policies` | Reusable product rules deriving SKU MRP from reference pack | `v_product_mrp_reference_readiness`, `v_product_mrp_derivation_current/_history` | `rpc_set_product_mrp_derivation_policy`, `rpc_cancel_scheduled_product_mrp_derivation_policy` | Effective-from; Scheduled/Expired derived by today | |
| 3 | `mrp-proposals` | Generate/adjust/submit dated MRP proposals | `v_product_mrp_proposal_register/_lines`, `v_product_mrp_derivation_current` | `rpc_generate_product_mrp_proposal`, `rpc_adjust_product_mrp_proposal_line`, `rpc_submit_product_mrp_proposal` | `p_proposed_effective_from` | `mrp-proposals.js` |
| 4 | `proposal-decisions` | Approve/reject submitted lines | shared proposal views | `rpc_decide_product_mrp_proposal_line` | server timestamp | **No client maker-checker found** (server unverified [A]) |
| 5 | `approved-for-application` | Atomic apply of approved proposals | shared proposal views | `rpc_apply_product_mrp_proposal` | proposal date | `mrp-application.js` |
| 6 | `applied-proposal-history` | Read-only trace of applied lines | `v_sku_mrp_policy_history` + proposal views | none | historical | `mrp-applied-history.js` |
| 7 | `sku-overview` (landing) | Per-SKU hub: Overview / MRP / Selling / Scheme / History / Status drawer | `v_costing_policy_manager_sku_overview`, `_selling_policy_history`, `_scheme_policy_history`, `_scheme_options` | `rpc_set_sku_selling_price_policy` (GST, discounts, **contingency %**), `rpc_set_sku_scheme_policy` | effective-from | No "contingency" workspace; it is a field here. Status tab overlaps CSR Diagnostics |
| 8 | `scheme-master` | Scheme definition lifecycle | `v_costing_scheme_master_register`, `_audit` | `rpc_create_scheme_master`, `rpc_update_scheme_master_metadata`, `rpc_deactivate_scheme_master`, `rpc_reactivate_scheme_master` | lifecycle | |
| 9 | `scheme-rule-register` | Hierarchy scheme rules (scope × region) | `v_costing_scheme_policy_rule_register`, `_scope_options` | `rpc_set_scheme_policy_rule`, `rpc_close_scheme_policy_rule` | effective-from; Current vs History | |
| 10 | `commercial-sales-assumptions` | Commercial-sales quantity assumptions + default policies (feeds QC absorption basis) | `v_costing_pricing_commercial_sales_basis`, `rpc_get_sku_sales_assumptions`, `rpc_get_sales_allocation_default_policies`, `rpc_get_regional_sales_allocation_default_policies` | `rpc_set_sku_sales_assumption`, `rpc_close_sku_sales_assumption`, `rpc_preview_sales_allocation_default_policy_scope`, `rpc_set_sales_allocation_default_policies_scoped` | **Only period-scoped PPM workspace**; applies to future refreshes only | Inbound deep link from CSR QC queue. Registry says `policy-manager.periodScoped:false` — metadata inconsistency |

Cross-module links *out* of PPM: none found [CC]. Inbound: CSR QC queue (CSA); `recommended_ui_route` codes `SELLING_PRICE_POLICY_REVIEW`/`PRICING_POLICY_REVIEW`; legacy SC5 redirect for Scheme Comparison.

## 4. Cost Sheet Review (`cost-sheet-review.html`; `module:cost-sheet-review`; default `sku-cost-sheet`)

All six lenses `periodScoped:true`; **all six strictly read-only** (every call is a view `select` or `rpc_get_*`). The only write on the page is shell-chrome **Request Costing Refresh** (`rpc_request_costing_refresh`, shell 2690; needs `PERM_CAN_EDIT \|\| PERM_CONTROL_CENTER_EDIT`) — a recompute request, not remediation [CC].

| Lens | Purpose | Controller | Data | Notes |
|---|---|---|---|---|
| `sku-cost-sheet` SKU Cost Details | SKU-grain interactive review: layers, price bridge, schemes, diagnostics | shell `renderSkuTab` (~7550), drawer tabs 7972-7976 | `v_costing_pricing_sku_selector`, `_sku_detailed_cost_sheet`, `_sku_scheme_comparison`, `_workflow_diagnostics`, `_sku_status_diagnosis` | Recommended Action is text only (shell 7521-7534) |
| `printable-cost-sheet` Cost Sheet | Product-grain A4 document, PDF, sign-off, Explain drawers | `cost-sheet.js` `loadPrintableLensRows` 5900, `generateCostSheetPdf` 5355 | `v_costing_pricing_printable_cost_sheet_product_summary/_lines`, `_cost_sheet_line_traceability`; explain RPCs (`rpc_get_monthly_allocation_driver_trace`, `rpc_get_cost_sheet_marketing_explain_summary`, `rpc_get_sku_qc_explain`, `rpc_get_product_qc_explain`, `rpc_get_sku_materials_stores_explain`, `rpc_get_product_materials_stores_explain`, `rpc_get_cost_sheet_rm_explain_summary`) | Exact-run context enforced (543, 594); sign-off names client-only, not persisted |
| `cost-comparison` Cost Comparison | MoM / YoY snapshot comparison | `cost-sheet.js` `renderCostComparisonTab` 5695 | `v_cost_sheet_snapshot_sku_monthly_comparison_governed` (`snapshot_period_start`) | One governed run per month (approved else labelled draft); period semantics differ from other lenses |
| `scheme-comparison` Scheme Comparison | Scheme viability / margin by SKU × scheme | `scheme-comparison.js` (148 lines) `loadRows` 80 | `v_costing_pricing_sku_scheme_comparison` | No link to PPM; same view as SKU drawer tab |
| `qc-action-queue` QC Action Queue | QC allocation blockers, absorption basis | `qc-action-queue.js` `fetchQueue` 225 | `rpc_get_qc_action_queue` | Routes out: LIMS Protocol Manager, Specification Profile Manager, PPM CSA (new tab) |
| `materials-stores-action-queue` Materials / Stores Queue | M/S overhead BLOCKED/REVIEW_REQUIRED | `materials-stores-action-queue.js` ~205 | `rpc_get_materials_stores_action_queue` | Routes out: MCM RM/PM manual-rate-manager; Explain stays in CSR. Structural clone of QC queue |

## 5. Material Cost Manager (`material-cost-manager.html`; `module:material-cost-manager`; default `manual-rate-manager`) — `material-cost.js` (6384 lines)

| Lens | Purpose | Reads | Writes | Gating |
|---|---|---|---|---|
| `manual-rate-manager` (not period-scoped) | Manual RM/PM rates, action queue, register, history | `v_costing_manual_rate_manager_action_queue`, `v_costing_material_manual_rate_register/_history/_review`, `rpc_get_material_vendor_rate_offers`, `v_costing_pricing_material_action_queue_snapshot` | `rpc_set_material_manual_rate`, `rpc_close_material_manual_rate` (and accept-review actions shared with Workbench) | MCM `PERM_CAN_EDIT` |
| `rm-cost-trace` (period) | Read-only **confidential** RM contribution trace | `rpc_get_material_rate_rm_cost_trace` (+`_filter_options`) | export `rpc_export_material_rate_rm_cost_trace` | `role:material-cost-rm-trace` (+`-export`); client `canAccessRmTrace` 3974-4012; server `require_permission` (migrations 20260917132804/132827/132859/132917, 20260808095237) |
| `pm-cost-trace` (period) | Read-only PM trace, current successful run | `rpc_get_material_rate_pm_cost_trace` (+filters) | `rpc_export_material_rate_pm_cost_trace` | `role:material-cost-pm-trace` (+`-export`) |

Trace tabs are visible to anyone with MCM view; the lens shows a "restricted" message (4630-4650) [CC].

## 6. Cost Build Manager (`cost-build-manager.html`; `module:cost-build-manager`; default `cost-governance`)

| Lens | Purpose | Reads | Writes |
|---|---|---|---|
| `cost-governance` | Expense-head mapping, exclusions, pool summary | `v_costing_expense_head_mapping_register`, `_cost_pool_monthly_summary`, `_unmapped_expense_heads_for_mapping`, `_expense_allocation_pool_options` | `rpc_set_expense_head_costing_map`, `rpc_close_expense_head_costing_map` |
| `staff-governance` | Staff costing classification | `v_costing_staff_classification_register`, `_staff_cost_pool_summary`, `_unclassified_staff_for_costing`, `_staff_costing_class_options` | `rpc_set_staff_costing_classification` |
| `manual-provisions` (period) | Manual pool provisions | `v_costing_manual_provision_pool_options/_type_options`, `_manual_cost_pool_provision_register` | `rpc_save_manual_cost_pool_provision`, `rpc_deactivate_manual_cost_pool_provision` |
| `driver-governance` | Cost-driver policy registry/validation/submit/approve | `rpc_get_cost_driver_policy_registry`, `rpc_get_cost_driver_governance_detail` | `rpc_submit_direct_labour_workload_policy_for_review`, `rpc_approve_direct_labour_workload_policy`, production-overhead equivalents, `rpc_create_cost_driver_policy_envelope_draft`, `rpc_submit_/approve_cost_driver_policy_envelope` |

Driver Governance: per-action `required_module` (`module:cost-build-manager` **or** `module:production-route-manager`) evaluated client-side, fail-closed on unknown (`driver-governance-helpers.js` 435-446, 866-871); server `require_permission` confirmed in migrations 20260805143028, 20260806164905. Server permission strings for the other three CBM lenses are **inferred** [A].

## 7. Production Route Manager (`production-route-manager.html`; `module:production-route-manager`; default `route-readiness`)

One module permission and **one `can_edit` for everything** (create, approve, supersede, inactivate) (shell 3496, 1748). Only flag: `COSTING_DIALOGS_V1`. Flat 13-pill strip + `<select>` (`production-route-manager.html` 3139-3164; shell 5068-5110). MAIN = `costing-suite-production-route.js`; ED = `-route-editor.js`; CAND = `-route-candidates.js`; SA = `-route-subgroup-archive.js`; CC = `-route-cost-centres.js`; RPCJS = `-route-rpc.js`; HLP = `-route-helpers.js`.

| # | Lens | Purpose | Entry | Writes (buttons) | Disposition note |
|---|---|---|---|---|---|
| 1 | `route-readiness` | Per-product route readiness (as-of) — default hub | Landing | Row actions: create product route, create assignment | Hub; links to editor/viewer/evidence/families |
| 2 | `product-route-assignments` | Product→Family assignment lifecycle | Pill / Product Summary | Create/Submit/Approve/Cancel/Inactivate/Correct effective-from | |
| 3 | `product-subgroup-mappings` | Subgroup→Family mapping lifecycle | Pill | Create DRAFT/Save/Submit/Approve/Inactivate | Group-level mapping lives in Route Families (inconsistent) |
| 4 | `shared-workload-preview` | Exact-run DL/POH workload preview + explain | Pill only | none (R) | Fixed fixture context: period 2026-08-01 / valuation 2026-08-07 / run 82 (HLP 177-203); not a current run selection |
| 5 | `route-families` | Family master, mappings, approved routes | Pill / Family Summary | Create Route Family (own code entry), Approve, Map Product Group, edit/approve mapping | Governed creation path (MAIN 6006-6130) |
| 6 | `route-family-mapping-review` | Exact-run coverage candidates for mapping review | From Route Families toolbar / pill | none (maps via Route Families) | Fixed fixture context (run 82; HLP 177-203) |
| 7 | `route-family-foundation-review` | Exact-run historical foundation evidence | Pill / links | none (R) | Fixed fixture context (run 82; HLP 177-203) |
| 8 | `production-cost-centres` | Cost Centre master lifecycle | Pill; editor blocker link | Create/Edit/Validate/Approve/Inactivate | |
| 9 | `route-family-route-editor` | Draft/validate/submit/approve family routes | Pill (empty chooser) / Family Summary | Create draft, Clone, step add/edit/delete/reorder, Validate, Submit, Approve | No Supersede button (stub toast, MAIN 10409-10416); approve supersedes server-side |
| 10 | `product-route-editor` | Product deltas over inherited family route | **Row actions only** (pill alone = dead-end empty state) | Create DRAFT, Validate, Submit, Approve, **Supersede**, delta add/edit/remove | Defect C1 (A5) |
| 11 | `historical-candidate-review` | Advisory historical previews; may stage drafts only | Pill / 4 inbound links | Create Route Family (Mode B), Stage evidence, Confirm use in draft | Defects C2, C3 (A5) |
| 12 | `effective-route-viewer` | Resolved route for a selected product | Pill (has product picker) | none (R) | |
| 13 | `archived-routes` | Read-only archived architecture | Pill | none (R) | No archival *action* located in PRM UI [A] |

Nested modals (single shared details modal stack, MAIN 1899): Product Summary 4373, Family Summary 4561, Workload Product Summary 4202 / Explain 9464, Mapping/Foundation group modals 8164/8409, Candidate modals 2051/4949, History 7640, approve modals (Family 6134, Mapping 6481, Family Route 10542, Product Route 10644, Assignment 5517, Subgroup SA 1058, Cost Centre CC 716), create/edit modals (Family 6006, Map Group 6246, Assignment 4984, Family Route Draft 6847, Clone 7136, Step 9873/10003, Product Delta 10030, Subgroup SA 596/841, Cost Centre CC 558/620), cancel/inactivate/correct assignment 5683/5764/5840. Sub-panels: product history chooser (9693-9711), family-route empty chooser, product-create handoff, workload tabs.

Journey context (D): a selected product/route is **not** carried when the user clicks a pill — shell tab click deletes `family_route_id`/`product_route_id` (shell 5262-5280); `navigate()` clears product/route ids for Subgroup Mappings and Archived (MAIN 2527-2538); `onLensExit` clears handoffs and closes the modal (MAIN 11949-11957). No breadcrumb, no persistent context chip; one back button only ("Back to Manufacturing Route Families", MAIN 9672). Approval/validate/submit exist only inside editors or register modals. [CC]
