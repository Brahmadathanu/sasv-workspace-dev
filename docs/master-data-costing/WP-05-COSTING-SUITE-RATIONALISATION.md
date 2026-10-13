# WP-05 — Costing Suite Functional Rationalisation Audit

## Objective
Inventory every Costing Suite module/tab/launcher and classify responsibilities before consolidation.

## Why this work pack exists
See MASTER_PROGRAMME.md. Receives parked items CCC-P01, CCC-P02, CCC-P03 from WP04 Track B acceptance.

## Entry criteria
All prerequisite work packs (WP-1, WP00–WP04) completed and verified — **satisfied** (WP04 closed at `1ff8d13e`). WP05 explicitly opened by the programme owner on 2026-10-13.

## Scope
Audit/classification of the six Costing Suite modules, their lenses, launcher entries, client files and live server data sources; disposition of CCC-P01/P02/P03; proposed design scope. Implementation of any consolidation belongs to later WP05 gates (or WP06/WP07 where noted).

## Explicit exclusions
No server or client mutation in G0/G1. No e-Aushadhi changes (parallel WP-07 e-Aushadhi programme is active on `feat/wp07-*` / PR #59 — untouched). No guessed data. Pricing Policy Manager *simplification* is WP06; costing navigation/IA is WP07; this WP only audits and recommends.

---

## Gate ledger

| Gate | Status |
|---|---|
| WP05-G0 — entry criteria / start | [x] COMPLETED AND VERIFIED (2026-10-13 22:07 IST) |
| WP05-G1 — current-state/audit gate | [~] IN PROGRESS — audit complete, self-audited (§11), owner decisions D1–D7 recorded 2026-10-13 (DEC-016…DEC-022); awaiting independent ChatGPT audit of the pushed docs branch + docs merge approval |
| WP05-G2 — design/contract gate | [~] DRAFTED (§12), owner business choices Q1–Q5 resolved; pending independent plan audit of high-risk packages (S1, S2, S3, S4, C2) |
| WP05-C1 — dead mapping cleanup (routine) | [~] IN PROGRESS — draft PR, awaiting audit |
| WP05-S1 — KPI view rebuild prep | [~] SQL + read-only value-match proof drafted (`docs/master-data-costing/wp05-s1/`); NOT applied |
| WP05-G3 — implementation gate(s) | [ ] NOT STARTED |
| WP05-G4 — focused verification | [ ] |
| WP05-G5 — independent audit | [ ] |
| WP05-G6 — merge/post-merge proof | [ ] |
| WP05-G7 — final handover | [ ] |

## Current Gate
`WP05-G1 — current-state / functional rationalisation audit`

## Gate Status
[~] IN PROGRESS

## Required to close
1. [ ] Independent audit of this inventory against current `main` (`c598083`) and live Supabase (`qhmoqtxpeasamtlxaoak`).
2. [x] Programme owner decisions D1–D7 recorded (§8, CHANGELOG_DECISIONS DEC-016…DEC-022).
3. [x] Discoveries classified (§7); PARKED items recorded in PARKED_BACKLOG.md (CCC-P05, CCC-P06; CCC-P01/P02/P03 dispositioned).
4. [ ] Docs committed on a pushed docs branch and merged with explicit approval (currently local commit only on `local/wp05-g1-audit`).
5. [x] Owner answers Q1–Q5 recorded (§12.0, DEC-023…DEC-027).

## Next gate
`WP05-G2 — design/contract gate` — draft in §12; approval requires independent plan audit (high-risk items) and answers to Q1–Q4.

---

## 1. Evidence base (2026-10-13, read-only)
- Repo `Brahmadathanu/sasv-workspace-dev`, `main` = `c598083` (PR #58). Local clone only; nothing pushed.
- Live Supabase project `sasv-workspace` (`qhmoqtxpeasamtlxaoak`): read-only SQL on `pg_class`, `pg_proc`, `pg_depend`/`pg_rewrite`, `information_schema`, `v_app_module_registry`, `cron.job`.
- Method: every string literal in `public/shared/js/costing-*.js`, `cost-*.js`, `material-cost-manager-entry.js` was matched against the live `public`/`costing` catalogue (relations + functions). Results: every referenced DB object exists live, except 11 `rpc_*product_group_route*` names that are an intentional deny-list (`OBSOLETE_PRM_RPC_NAMES`, production-route-helpers.js) and `rpc_refresh_cost` (prefix used for string matching, not a call).
- No GitHub CI evidence exists or is claimed.

## 2. Launcher entries (live `v_app_module_registry`)
All six are `nav_enabled=true`, `min_nav_mode=view`, section "Product & Reference Master", identical for `electron` and `pwa` clients:

| sort | module_key | label | route_path |
|---|---|---|---|
| 92 | costing-control-center | Costing Control Center (CCC) | public/shared/costing-control-center.html |
| 93 | material-cost-manager | Material Cost Manager (MCM) | public/shared/material-cost-manager.html |
| 94 | cost-build-manager | Cost Build Manager (CBM) | public/shared/cost-build-manager.html |
| 95 | pricing-policy-manager | Pricing Policy Manager (PPM) | public/shared/pricing-policy-manager.html |
| 95 | production-route-manager | Production Route Manager (PRM) | public/shared/production-route-manager.html |
| 96 | cost-sheet-review | Cost Sheet Review & Approval (CSR) | public/shared/cost-sheet-review.html |

Note: the suite has **six** pages, not four (PPM and PRM pages were not in the original brief). PPM and PRM share sort_order 95 (ordering tie). Costing modules sit under "Product & Reference Master" — there is no "Costing" launcher section (WP07/WP09 input).

## 3. Architecture
One SPA-style shell (`costing-suite-shell.js`, 9 577 lines) is bootstrapped by six 3-line entry files (`*-entry.js` → `bootstrapCostingSuite(moduleKey)`). `costing-route-config.js` maps module → permission target `module:<key>`, default lens and allowed lenses; `costing-suite-registry.js` defines 6 suites / 31 lenses. Shell-level server calls: `get_user_permissions`, `rpc_get_costing_refresh_status`, `rpc_request_costing_refresh`, plus `VIEW_BY_LENS` direct view reads. Each page HTML is large (3.3k–7.5k lines, mostly inline CSS) and loads jsPDF.

No orphaned client file: every `costing-*.js`/`cost-*.js` is imported by at least one other file or page.

## 4. Inventory — modules, lenses, files, live data sources

### 4.1 CCC — Costing Control Center (`costing-control-center.html`, 4 733 L)
| Lens | Purpose | Client file(s) | Live data sources |
|---|---|---|---|
| dashboard | Control snapshot, KPI, integrity overview | costing-suite-control-center.js (2 544 L) | v_costing_pricing_business_kpi_summary, v_costing_pricing_control_dashboard_snapshot, v_costing_pricing_control_integrity_audit_snapshot |
| costing-review-workbench ("Control Workbench") | Material action queue, blockers, review acceptance | control-center.js | v_costing_pricing_material_action_queue_snapshot, v_costing_pricing_material_action_drilldown_snapshot, rpc_get_current_material_foundation_diagnosis |
| sku-control-status | Per-SKU costing remediation index + recommended route | control-center.js, costing-suite-recommended-ui-route.js (340 L) | v_costing_pricing_sku_control_status_snapshot |
| portfolio-readiness ("Readiness") | WP04 multidimensional readiness (LIVE_AS_OF) | costing-suite-readiness.js (2 232 L) | rpc_get_product_sku_readiness_portfolio, rpc_get_readiness_governed_periods, rpc_get_readiness_product_gaps |
| (chip/modal) Cost Period Valuation | Period valuation date governance | costing-suite-cost-period-valuation.js (812 L) + -helpers.js (352 L) | rpc_get_cost_period_valuation_context, rpc_get_cost_period_governance_history, rpc_set_cost_period_valuation_date, rpc_request_costing_refresh, v_cost_periods |

### 4.2 MCM — Material Cost Manager (`material-cost-manager.html`, 4 980 L)
| Lens | Purpose | Client file | Live data sources |
|---|---|---|---|
| manual-rate-manager | Manual RM/PM rates, action queue, register, history, review acceptance | costing-suite-material-cost.js (6 384 L) | v_costing_manual_rate_manager_action_queue, v_costing_material_manual_rate_register/_history/_review, v_costing_material_review_acceptance_register, v_costing_pricing_material_action_queue_snapshot, v_costing_pricing_material_action_drilldown_snapshot, v_costing_pricing_review_action_item_drilldown_snapshot, rpc_set/close_material_manual_rate, rpc_accept_material_review_action, rpc_close_material_review_acceptance, rpc_get_material_vendor_rate_offers, inv_stock_item (direct table read) |
| rm-cost-trace / pm-cost-trace | Read-only RM/PM contribution traceability + export | material-cost.js | rpc_get/export_material_rate_{rm,pm}_cost_trace, *_filter_options |

### 4.3 CBM — Cost Build Manager (`cost-build-manager.html`, 4 353 L)
| Lens | Purpose | Client file | Live data sources |
|---|---|---|---|
| cost-governance | Expense-head → cost pool mapping | costing-suite-cost-build.js (2 234 L) | v_costing_unmapped_expense_heads_for_mapping, v_costing_expense_head_mapping_register, v_costing_expense_allocation_pool_options, v_costing_cost_pool_monthly_summary, rpc_set/close_expense_head_costing_map |
| staff-governance | Staff costing classification | cost-build.js | v_costing_unclassified_staff_for_costing, v_costing_staff_classification_register, v_costing_staff_costing_class_options, v_costing_staff_cost_pool_summary, rpc_set_staff_costing_classification |
| manual-provisions | Manual cost-pool provisions | cost-build.js | v_costing_manual_cost_pool_provision_register, v_costing_manual_provision_{pool,type}_options, rpc_save/deactivate_manual_cost_pool_provision |
| driver-governance | Cost-driver policy envelopes, DL/PO workload policies | costing-suite-driver-governance.js (1 120 L) + -helpers.js (929 L) | rpc_get_cost_driver_policy_registry, rpc_get_cost_driver_governance_detail, rpc_create/submit/approve_cost_driver_policy_envelope*, rpc_submit/approve_{direct_labour,production_overhead}_workload_policy* |

### 4.4 PPM — Pricing Policy Manager (`pricing-policy-manager.html`, 7 463 L — largest page)
| Lens / workspace | Purpose | Client file(s) | Live data sources |
|---|---|---|---|
| mrp-governance | Product MRP derivation, proposals, decisions, application, applied history, SKU MRP policy | costing-suite-pricing-policy.js (8 189 L), mrp-proposals.js (2 190), mrp-decisions.js (1 576), mrp-application.js (1 437), mrp-applied-history.js (1 521), mrp-proposal-shared.js (414) | v_product_mrp_derivation_current/_history, v_product_mrp_reference_readiness, v_product_mrp_proposal_register/_lines, v_sku_mrp_current, v_sku_mrp_policy_history, rpc_generate/adjust/submit_product_mrp_proposal*, rpc_decide_product_mrp_proposal_line, rpc_apply_product_mrp_proposal, rpc_set_product_mrp_derivation_policy, rpc_set_sku_mrp_policy, rpc_cancel_scheduled_* |
| policy-manager ("Selling & Scheme Policies") | SKU selling price policy, scheme policy, scheme masters & rules | pricing-policy.js | v_costing_policy_manager_sku_overview/_scheme_options/_selling_policy_history/_scheme_policy_history, v_costing_scheme_master_register/_audit, v_costing_scheme_policy_rule_register/_scope_options, product_skus, rpc_set_sku_selling_price_policy, rpc_set_sku_scheme_policy, rpc_*scheme_master*, rpc_set/close_scheme_policy_rule |
| Commercial Sales Assumptions (period-scoped workspace inside PPM) | Sales-quantity assumptions when sales history unusable; regional default policies | costing-suite-commercial-sales-assumptions.js (1 913 L) | v_costing_pricing_commercial_sales_basis, rpc_get/set/close_sku_sales_assumption, rpc_get_(regional_)sales_allocation_default_policies, rpc_preview/set_sales_allocation_default_policy_scope(d) |

### 4.5 CSR — Cost Sheet Review & Approval (`cost-sheet-review.html`, 5 053 L)
| Lens | Purpose | Client file(s) | Live data sources |
|---|---|---|---|
| sku-cost-sheet ("SKU Cost Details") | SKU cost layers, price bridge, explain panels | costing-suite-cost-sheet.js (6 150 L), qc-explain-helpers.js (774), materials-stores-explain-helpers.js (779) | v_costing_pricing_sku_selector, v_costing_pricing_sku_detailed_cost_sheet, v_costing_pricing_sku_status_diagnosis, v_costing_pricing_workflow_diagnostics, v_costing_pricing_cost_sheet_line_traceability, rpc_get_cost_sheet_{rm,marketing}_explain_summary, rpc_get_{sku,product}_{qc,materials_stores}_explain, rpc_get_monthly_allocation_driver_trace |
| printable-cost-sheet | A4/PDF cost sheet | cost-sheet.js | v_costing_pricing_printable_cost_sheet_lines, v_costing_pricing_printable_cost_sheet_product_summary |
| cost-comparison | Monthly/yearly snapshot comparison | shell | v_cost_sheet_snapshot_sku_monthly_comparison |
| scheme-comparison | Scheme viability & margin (moved here from PPM in SC1/SC4/SC5) | costing-suite-scheme-comparison.js (148 L) | v_costing_pricing_sku_scheme_comparison |
| qc-action-queue | QC remediation queue | costing-suite-qc-action-queue.js (933 L) | rpc_get_qc_action_queue |
| materials-stores-action-queue | Materials/Stores remediation queue | costing-suite-materials-stores-action-queue.js (774 L) | rpc_get_materials_stores_action_queue |

### 4.6 PRM — Production Route Manager (`production-route-manager.html`, 3 310 L)
13 lenses: route-readiness, product-route-assignments, product-subgroup-mappings, shared-workload-preview, route-families, route-family-mapping-review, route-family-foundation-review, production-cost-centres, route-family-route-editor, product-route-editor, historical-candidate-review, effective-route-viewer, archived-routes.
Client: production-route.js (11 945 L — largest file), -helpers.js (8 696), -rpc.js (2 530, strict 61-RPC adapter), -editor.js (1 634), -delta-form.js (1 314), -step-form.js (734), -cost-centres.js (1 210), -candidates.js (429), -subgroup-archive.js (1 499).
Data: RPC-only; all ~62 RPCs referenced in production-route-rpc.js exist live (route families, product routes, assignments, subgroup mappings, cost centres, workload preview/explain, readiness, archived architecture).

### 4.7 Shared infrastructure
costing-suite-shell.js, costing-suite-registry.js, costing-route-config.js, six `*-entry.js`, css/sasv-costing.css, `public/sw.js` (service worker cache; PRM URLs special-cased).

## 5. Overlaps / duplications / dead items (evidence)
| # | Finding | Evidence |
|---|---|---|
| O1 | **Material action queue is surfaced in two modules**: CCC Control Workbench and MCM Manual Rate Manager both read `v_costing_pricing_material_action_queue_snapshot` and `_drilldown_snapshot`. | xref of both files |
| O2 | **Remediation queues are split across three modules**: material queue (CCC + MCM), QC queue and Materials/Stores queue (CSR). CSR is labelled "Review & Approval" but hosts operational remediation queues. | registry.js, qc/materials-stores action-queue files |
| O3 | **Two SKU status surfaces in CCC** (CCC-P01): SKU Control Status vs Readiness — see 6.1. | |
| O4 | **Shell duplicates per-lens view mapping** (`VIEW_BY_LENS`) for lenses whose controllers already own their loads (dashboard, sku-control-status, workbench). `VIEW_BY_LENS.dashboard = "v_costing_pricing_dashboard_summary"` is a **dead entry**: the dashboard branch returns via `controlCenterCtrl.loadDashboardRows()` before `viewName` is used (shell.js 4606–4616). | shell.js |
| O5 | PPM is a 7.5k-line page + 8.2k-line controller holding three distinct domains (MRP governance, selling/scheme policy, commercial sales assumptions). Scheme comparison already moved out to CSR. | file sizes, registry |
| O6 | Seven client-unreferenced public views with **no view/function dependents**: v_costing_pricing_cost_sheet_rm_line_traceability, v_costing_pricing_material_rate_issue_lines, v_costing_pricing_product_status_summary, v_costing_pricing_review_top_action_items, v_costing_pricing_review_workbench_summary, v_costing_pricing_selected_scheme_policy, v_product_mrp_adjustment_evidence. Investigated further in §12 S3 (pg_stat_statements: 0 calls since 2026-08-11 22:02 IST stats reset; no cron, edge-function or repo references). Removal is now in scope per D5. | pg_depend, prosrc, client grep |
| O7 | `OBSOLETE_PRM_RPC_NAMES` (11 `product_group_route` RPCs, not live) is an intentional deny-list, not dead code. | helpers.js 148–160 |
| O8 | `costing-suite-material-cost.js` reads table `inv_stock_item` directly (only direct table read in suite). Not a defect by itself; noted for WP10/security review consistency. | xref |
| O9 | 73 smoke scripts in `scripts/` assert a hard-coded service-worker cache version (`hub-cache-vNNN`); the e-Aushadhi branch already edits a costing smoke script just to bump this. Cross-programme coupling. | rg scripts; branch diff |

## 6. Parked-item findings

### 6.1 CCC-P01 — SKU Control Status ↔ Portfolio Readiness
- **SKU Control Status**: `public.v_costing_pricing_sku_control_status_snapshot`, built from `costing.sku_costing_control_status_snapshot`, `sku_direct_labour_allocation_snapshot`, `v_current_successful_costing_refresh_run`. The public view exposes **only the current successful run per period**, one row per SKU (2026-09: 636; 2026-08: 679; 2026-07: 678). The underlying table holds more history (2026-09: 24 runs / 15 997 rows; 2026-08: 1 run; 2026-07: 1 run; 2026-06: 656 rows with no run id). Access is gated by `module:costing-control-center` view permission inside the view. Answers "**why is this SKU's cost sheet blocked/under review in this costing run, and where do I fix it**" (first_control_status, control_severity, recommended_ui_route, RM/PM blocking/review/stale/fallback/manual line counts, material cost, MRP, selling price, margins).
- **Readiness**: WP04 server contract (`rpc_get_product_sku_readiness_portfolio` etc.), LIVE_AS_OF governed period, multidimensional master-data/costing-foundation readiness; populations 1 793 ALL_EXISTING / 611 OPERATIONAL (WP04 G8 evidence of 2026-10-08; **not re-measured in G1**). Answers "**is the product/SKU's master data and costing foundation complete**".
- **Conclusion**: overlapping audience, **different authority, population and time basis** (run snapshot vs LIVE_AS_OF). They cannot be merged into one server contract without changing evidence authority (forbidden without decision). Population counts differ (636 vs 611 vs 1 793) and will confuse users if shown side-by-side without explanation. Recommendation: keep both contracts; rationalise **presentation** (cross-links per SKU, explicit labels "Costing run status" vs "Master-data readiness", one default entry lens). → decision D1.

### 6.2 CCC-P02 — Wider Costing Suite / PPM duplication
- No server object is shared between PPM and any other module except the shell's default view for `policy-manager`. PPM's MRP, selling/scheme and commercial-sales domains are not duplicated elsewhere in the client.
- Real duplication sits outside PPM: O1 (material queue in CCC + MCM) and O2 (queues split CCC/MCM/CSR).
- PPM's problem is **size/cohesion** (O5), which is WP06's remit (simplification), not a WP05 consolidation.
- Recommendation: close CCC-P02 as "no cross-module PPM duplication found"; hand PPM internal split to WP06; take O1/O2 into WP05 design (D2, D3).

### 6.3 CCC-P03 — Legacy dashboard-summary objects
- Code grep: the only client reference is the dead `VIEW_BY_LENS.dashboard` entry (O4). Also `types/supabase.ts` (generated types) and two smoke scripts (`pricing-dashboard-summary-cardinality-smoke.mjs`, `cost-sheet-printable-lens-load-smoke.mjs`; the latter asserts the dead mapping string exists).
- Live dependencies (pg_depend):
  - `costing.v_pricing_workflow_dashboard_summary` → used by `public.v_costing_pricing_dashboard_summary`.
  - `public.v_costing_pricing_dashboard_summary` → used by **`public.v_costing_pricing_business_kpi_summary`** (CTE `dashboard`, 18 columns consumed), which CCC's dashboard **loads on every open** (`costing-suite-control-center.js` line 586, inside `loadDashboardRows`) and which the shell uses as period fallback (`costing-suite-shell.js` ~3502).
  - The legacy chain itself reads `costing.cost_periods`, `costing.costing_refresh_run`, `costing.sku_pricing_bridge_snapshot`, `costing.sku_selling_price_bridge_snapshot`, `costing.sku_scheme_viability_snapshot` (filtered to the current successful run and gated by `module:costing-control-center`).
  - No function bodies, no cron jobs reference either view. Grants: public view SELECT to `authenticated`, full to `service_role`; costing view only `postgres`.
- **Conclusion: the legacy chain is NOT parked in practice — it executes transitively on every CCC dashboard load through the KPI summary.** WP04's "no new calls to v_costing_pricing_dashboard_summary" proof covered only direct calls. Neither object can be dropped without first re-basing `v_costing_pricing_business_kpi_summary`. Recommendation: server package (high-risk, ChatGPT-owned per DEC-014) to re-base KPI summary onto governed snapshot sources with value-parity proof, then retire the two views; client removes dead mapping and fixes the smoke assertion. → decision D4.

## 7. Discovery classification
| ID | Discovery | Class |
|---|---|---|
| F-01 (CCC-P03) | KPI summary depends on legacy dashboard-summary chain; executed on every CCC dashboard load | **REQUIRED NOW** (must be resolved within WP05 design before any retirement; affects the closure claim of CCC-P03) |
| F-02 (O4) | Dead `VIEW_BY_LENS.dashboard` entry + smoke assertion pinned to it | REQUIRED NOW (WP05 routine client cleanup, tied to F-01) |
| F-03 (CCC-P01) | SKU Control Status vs Readiness — distinct contracts, presentation overlap | REQUIRED NOW (D1 → C2 + S4) |
| F-13 | SKU Control Status public view hides run history (only current successful run per period); table keeps every run | REQUIRED NOW — input to D1/S4 design; exposing per-run history needs a new server contract (Q1) |
| F-14 | Readiness numbers 1 793/611 are WP04-dated, not re-measured | FUTURE DEPENDENCY → re-measure in WP05 G4 verification |
| F-04 (O1/O2) | Material queue duplicated CCC/MCM; remediation queues split across CCC/MCM/CSR | REQUIRED NOW (WP05 decisions D2/D3) |
| F-05 (CCC-P02) | No PPM cross-module duplication; PPM internal size/cohesion | FUTURE DEPENDENCY → WP06 |
| F-06 | Six pages not four; costing launcher entries under "Product & Reference Master"; PPM/PRM sort tie at 95 | FUTURE DEPENDENCY → WP07 (costing IA) / WP09 |
| F-07 (O6) | Seven possibly-dead public views (no client/view/function/cron/edge-function consumers; 0 calls in pg_stat_statements since 2026-08-11) | **REQUIRED NOW** (owner decision D5 → WP05 package S3) |
| F-08 (O9) | 73 smoke scripts pin SW cache version; cross-programme edit collision with e-Aushadhi | PARKED ENHANCEMENT → WP12 test hygiene (proposed CCC-P05) |
| F-09 (O8) | Only direct table read (`inv_stock_item`) in the suite | PARKED ENHANCEMENT → WP10/security review (proposed CCC-P06) |
| F-10 | Very large page HTML files with inline CSS (3.3k–7.5k lines) | FUTURE DEPENDENCY → WP11 |
| F-11 | PRM (13 lenses) is self-contained and governed; no overlap found | OUT OF SCOPE for consolidation (keep as is) |
| F-12 | e-Aushadhi WP-07 branch touches shared `public/sw.js` and costing smoke script | OUT OF SCOPE (other programme) — coordination note only |

## 8. Decisions required from the programme owner (to close G1 / enter G2)
| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | CCC-P01: SKU Control Status vs Readiness | (a) keep both lenses, add per-SKU cross-links + clarifying labels and population notes; (b) make Readiness the CCC default and demote SKU Control Status to a drill-down; (c) merge into one lens (requires new server contract — changes authority) | **(a)**, optionally (b) for default lens. Reject (c). |
| D2 | Material action queue in CCC Workbench and MCM | (a) MCM owns the material queue; CCC Workbench becomes a summary that deep-links to MCM; (b) CCC owns it, MCM keeps only rate maintenance; (c) keep both | **(a)** — MCM is where rates are fixed; CCC stays the control overview |
| D3 | Remediation queues (QC, Materials/Stores) currently in CSR | (a) move both queues to CCC (one "Action queues" area); (b) leave in CSR; (c) defer to WP07 IA | **(c) defer placement to WP07**, record principle "CCC = control & remediation, CSR = review & approval" now |
| D4 | CCC-P03 legacy views | (a) server re-base of KPI summary with parity proof, then retire both views (high-risk server package); (b) keep views indefinitely, only remove dead client mapping; (c) re-base KPI only, keep views parked | **(a)**, sequenced: re-base + parity → client cleanup → retirement after an observation window |
| D5 | Seven possibly-dead views (F-07) | (a) park as CCC-P04 pending usage evidence; (b) include in WP05 retirement | **(a)** — UNKNOWN ≠ unused |
| D6 | PPM internal split (F-05) | (a) hand to WP06; (b) split within WP05 | **(a)** |
| D7 | Launcher/IA items (F-06) | (a) hand to WP07 (costing nav) / WP09; (b) fix PPM/PRM sort tie now | **(a)**; the sort tie is a trivial data fix that can ride with WP07 |

### 8.1 Owner decisions recorded 2026-10-13
| # | Outcome | DEC |
|---|---|---|
| D1 | **CHANGED from recommendation**: fold SKU Control Status capabilities into the Readiness tab, including a costing-month / period-snapshot view so per-run history is not lost; then retire the SKU Control Status tab | DEC-016 |
| D2 | Approved: MCM owns the material action queue; CCC Control Workbench shows summary + link | DEC-017 |
| D3 | Approved: queue placement deferred to WP07 | DEC-018 |
| D4 | Approved: rebuild KPI view with value-match proof, then retire both legacy views | DEC-019 |
| D5 | **CHANGED from recommendation**: investigate the 7 possibly-dead views fully and remove the truly unused ones with a restore script (not parked) | DEC-020 |
| D6 | Approved: PPM split deferred to WP06 | DEC-021 |
| D7 | Approved: launcher/IA items deferred to WP07/WP09 | DEC-022 |

## 9. Initial scope proposal (superseded by §12 after D1–D7)
| Package | Content | Owner | Risk class |
|---|---|---|---|
| S1 | Server: re-base `v_costing_pricing_business_kpi_summary` off `v_costing_pricing_dashboard_summary` onto governed snapshot sources; value-parity proof across ≥3 periods; rollback SQL; performance check | ChatGPT (server, DEC-014) | **HIGH-RISK** (view contract used by CCC dashboard; production read path) |
| S2 | Server: retire `public.v_costing_pricing_dashboard_summary` and `costing.v_pricing_workflow_dashboard_summary` after S1 + observation window; regenerate types | ChatGPT (server) | **HIGH-RISK** (destructive DDL) |
| C1 | Client: remove dead `VIEW_BY_LENS.dashboard`; update `cost-sheet-printable-lens-load-smoke.mjs` and legacy cardinality smoke | Cursor/Codex | Routine |
| C2 | Client: CCC-P01 presentation — labels, per-SKU cross-links Readiness ↔ SKU Control Status, population explanation (uses existing contracts only) | Cursor/Codex | Routine (no new contract) |
| C3 | Client: D2 — CCC Workbench becomes summary + deep link into MCM material queue (no server change) | Cursor/Codex | Routine if existing contracts suffice; becomes high-risk if any permission target changes (CCC vs MCM module permissions differ: `module:costing-control-center` vs `module:material-cost-manager`) — **plan gate required to confirm users' permissions before removing a surface** |
| — | PPM split, IA/launcher, queue placement, visual hardening | WP06 / WP07 / WP11 | — |

Recommended order: C1 (independent) → S1 → C2/C3 → S2.

## 10. e-Aushadhi overlap (parallel programme — untouched)
- PR #59 (`feat/wp07-s2c-c1-qc-protocol-options`, draft): 1 file, `supabase/migrations/20261010125640_wp07_s2c_c1_qc_protocol_options.sql` — **no costing overlap**.
- `feat/wp07-s2c-c1-qc-preparation-ui` (42 files): overlaps with costing-relevant files **`public/sw.js`** (cache version bump to v364) and **`scripts/pricing-dashboard-summary-cardinality-smoke.mjs`** (only the SW-version assertion). Any WP05 change to C1 smoke scripts or `sw.js` will conflict; coordinate merge order.
- `docs/wp07-s2a-qc-operator-contract` (1 file, docs/eaushadhi), `feat/wp07-s2b-b1-*` (already merged, empty diff): no overlap.
- Neither branch touches `costing-suite-*.js`, costing pages, `sasv-costing.css` or the QC explain/action-queue costing files.

## Server changes
None (G0/G1 read-only).

## Client changes
None (local documentation only).

## Tests / verification
Read-only evidence listed in section 1. No CI evidence.

## Decisions created
DEC-016 … DEC-022 (owner decisions D1–D7, 2026-10-13). See §8 and CHANGELOG_DECISIONS.md.

## Risks
Retiring legacy views without re-basing KPI summary would break the CCC dashboard; treating population differences (636/611/1 793) as errors; removing a surface without checking module permissions; collision with e-Aushadhi SW-version bumps.

## Parked discoveries
CCC-P05 (F-08) and CCC-P06 (F-09) recorded in PARKED_BACKLOG.md. F-07 was not parked: D5 brought it into scope (S3).

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not reached. Local branch `local/wp05-g1-audit` (unpushed) in `/workspace/sasv-workspace-dev`, based on `main` `c598083`.

## 11. Independent self-audit of G1 against IMPLEMENTATION_RULES (2026-10-13)
| # | Issue found | Rule | Fix applied |
|---|---|---|---|
| A1 | O6 said "no query statistics for views" — false; `pg_stat_statements` is installed | Evidence / no guessed data | Measured: 0 calls for all seven since stats reset 2026-08-11 22:02 IST; recorded in O6 and S3 |
| A2 | CCC-P01 implied the SKU Control Status view keeps period history | No guessed data | Clarified: view shows current successful run only; table holds 24 runs for 2026-09 (F-13) |
| A3 | Readiness 1 793/611 presented without date | Evidence | Labelled as WP04 G8 (2026-10-08) evidence, not re-measured (F-14) |
| A4 | CCC-P03 claim "every dashboard load" lacked code citation | Evidence | Cited control-center.js line 586 and the 18 consumed columns |
| A5 | §9 classed C2 (Readiness changes) as Routine; after D1 it needs a server read contract and touches a permission boundary | High-risk definition (schema/RPC contracts, permissions) | C2 reclassified; server part split out as S4 (high-risk); C2 needs a plan gate |
| A6 | F-07 classed PARKED but owner brought it into scope | Scope discipline | Reclassified REQUIRED NOW (D5) |
| A7 | Required-to-close list had no checkbox state | Mandatory gate ledger | Converted to checklist with current state |
| A8 | Retiring the SKU Control Status tab would break existing drill-downs (`drillToLens("sku-control-status", …)` in control-center.js line 855), saved lens/URL restoration (a WP04 G7 check) and the `recommended_ui_route` resolver | Fail-closed / no regression | Added redirect + regression tests to C2 spec |
| A9 | C3 permission impact unstated | High-risk check | Measured: today exactly 1 user holds CCC view and the same user holds MCM view/edit; 0 CCC-only users. Spec still requires a no-access state for future CCC-only users |
| A10 | DEC numbering: procurement programme also uses a "DEC-016" (in sw.js comment) | Traceability | Kept per-programme numbering (each programme has its own changelog); every new entry names "master-data-costing" to avoid ambiguity |
Remaining limitations (not fixable read-only): no GitHub CI evidence; pg_stat_statements is only cumulative since 2026-08-11 (a period-end/month-end-only consumer before that date cannot be excluded — mitigated by the S3 restore script and observation window).

## 12. G2 design / contract draft (NOT APPROVED)

### 12.0 Owner questions — ANSWERED 2026-10-13 (DEC-023…DEC-027)
All five recommendations approved: **Q1 (a)** one official run per month; **Q2 (a)** Readiness opens on master-data view with a switch; **Q3** hide un-numbered 2026-06 rows with a note, never delete; **Q4** 14-day block-and-watch window including one completed month-end costing run; **Q5** retire `v_product_mrp_adjustment_evidence` with a restore script.

Original questions:
- **Q1 — How much costing history should the new Readiness "costing month" view show?** Today the system keeps every costing run (September has 24 runs), but the screen only ever showed the final, official run per month. Options: (a) one official run per month (same as today, no new server work beyond S4); (b) every run of every month, so you can compare runs within a month (bigger server work, more data on screen). *Recommendation: (a), with history going back to every month already kept.*
- **Q2 — What should the Readiness tab open on?** (a) the current "is master data complete" view (today's Readiness), with a switch to the costing-month view; (b) the costing-month view. *Recommendation: (a).*
- **Q3 — Old 2026-06 rows with no run number** (656 rows). Show them as "unverified history" or hide them? *Recommendation: hide them by default and show a note; never delete them.*
- **Q4 — Observation window before deleting the old views (S2, S3)?** *Recommendation: 14 days with the restore script ready, deleting only after one month-end costing run has completed without errors.*

### 12.1 Package order
1. **C1** (routine, independent; coordinate sw.js with Jarvis — §12.8)
2. **S1** (high-risk server) → **S4** (high-risk server, after Q1/Q2)
3. **C2** (client, plan gate) and **C3** (client, plan gate) — may run in parallel after S1/S4 verified
4. **S3-phase-1** (revoke + observe) can start right after G2 approval, in parallel
5. **S2** and **S3-phase-2** (drops) — last, after the observation window (Q4)

### 12.2 C1 — Dead mapping + smoke fixes — **ROUTINE**
- Spec: delete `dashboard: "v_costing_pricing_dashboard_summary"` from `VIEW_BY_LENS` (costing-suite-shell.js ~2411). Update `scripts/cost-sheet-printable-lens-load-smoke.mjs` (line ~343) to assert the mapping is **absent**. Leave `pricing-dashboard-summary-cardinality-smoke.mjs` legacy assertions until S2. No sw.js bump unless required by the cache policy (see §12.8).
- Files: costing-suite-shell.js, scripts/cost-sheet-printable-lens-load-smoke.mjs.
- Acceptance: `rg v_costing_pricing_dashboard_summary public/shared/js --glob '!types/*'` → 0 hits; smoke scripts pass; CCC dashboard opens and shows identical KPI numbers before/after (screenshot compare, same period).
- Rollback: revert commit.

### 12.3 S1 — Rebuild `public.v_costing_pricing_business_kpi_summary` — **HIGH-RISK (server, ChatGPT-owned, DEC-014)**
- Spec: replace the `dashboard` CTE so it reads the governed snapshots directly (`costing.sku_pricing_bridge_snapshot`, `sku_selling_price_bridge_snapshot`, `sku_scheme_viability_snapshot`, `costing_refresh_run`, `cost_periods`, joined to `costing.v_current_successful_costing_refresh_run`) instead of the legacy chain. **Same 19 output columns, names, types and order**; same permission gate (`module:costing-control-center` view, service_role/postgres bypass); `security_invoker`/owner and grants identical to current. No other view changes.
- Pre-work (read-only): capture current definition, grants, owner, reloptions, and a baseline snapshot of all rows (all periods) into a scratch/evidence file.
- Value-match proof: `EXCEPT` both directions between baseline rows and new-view rows for **every** period present → 0 rows; plus row count equal; run as `authenticated` user with permission and as user without (both views must return the same, i.e. rows vs no rows). Timing: EXPLAIN ANALYZE before/after; new must not be slower than baseline.
- Rollback: `CREATE OR REPLACE VIEW` with captured original definition + re-apply captured grants (script stored with the migration).
- Acceptance: proof 0-diff; CCC dashboard identical; no new statement-timeout in logs for 24 h; pg_depend shows KPI no longer depends on the legacy view.
- Business choice: none. Backend contract: unchanged externally.

### 12.4 S4 (new) + C2 — Readiness absorbs SKU Control Status (D1)
**S4 — server read contract — HIGH-RISK (new RPC, permission boundary)**
- New RPC proposal `rpc_get_sku_costing_run_status(p_period_start date, p_refresh_run_id bigint default null, p_search text default null, p_severity text[] default null, p_after_sku_id bigint default null, p_limit int default 50) returns jsonb`, SECURITY DEFINER, gated by `app_has_permission('module:costing-control-center','view')`, keyset-paginated like the Readiness RPC. Returns exactly the 40 columns of today's SKU Control Status view (already including `refresh_run_id`, `valuation_date`; no new business calculations) plus one flag `is_current_successful_run`.
- Companion `rpc_get_sku_costing_run_periods()` listing periods (and, if Q1=b, runs per period).
- Why a new contract rather than reading the view from the client: keeps the "server responses are sole authority" rule of the Readiness lens, adds pagination (15 997 rows in one month under Q1=b), and allows history beyond the current run. **Flag: new backend contract — requires plan audit.**
- Rollback: drop the two functions (no data change).
- Acceptance: for the current run of each period, RPC output = current view output (EXCEPT 0 rows); permission-denied user gets an explicit error, not empty data; p95 < 3 s per page.

**C2 — client — HIGH-RISK client (plan → audit → implement), because it retires a tab and changes navigation**
- Readiness tab gains a two-way switch: **"Master-data readiness" (today's view)** | **"Costing month status" (former SKU Control Status)**; costing-month view has a period picker (governed periods only) and, if Q1=b, a run picker. Every capability of SKU Control Status preserved: severity/status filters, search, first control status, control note, recommended route links (via existing `costing-suite-recommended-ui-route.js`), RM/PM line counts, material cost, MRP/selling/margin columns, export if present.
- Per-SKU cross-link: Master-data row → "Costing month status" for that SKU, and back.
- Retirement: remove `sku-control-status` from registry/route-config/lens pills; **redirect** old lens ids and saved/URL state to Readiness → Costing month status (with filters carried over); update dashboard drill (`drillToLens("sku-control-status", {status:["BLOCKER"]})`) to the new target.
- Files: costing-suite-readiness.js, costing-suite-control-center.js, costing-suite-shell.js (VIEW_BY_LENS, lens switching), costing-suite-registry.js, costing-route-config.js, costing-control-center.html (+ CSS), new smoke script; possibly sw.js cache bump.
- Acceptance: (1) every column/filter of the old tab is reachable; (2) BLOCKER drill from dashboard lands on correct filtered list; (3) old bookmarked lens and restored lens open the new view; (4) counts for current month equal old tab (636 for 2026-09 at time of audit — re-measure); (5) WP04 G7 seven-check regression re-run passes (startup, OPERATIONAL, filter/search, ALL_EXISTING, detail/Membership, lens restoration, narrow screen); (6) user without CCC permission sees access-denied state.
- Rollback: revert client commit (server RPCs are additive and harmless).
- Business choices: Q1, Q2, Q3.

### 12.5 C3 — Material action queue consolidation (D2) — **ROUTINE client after a short plan check** (no server change)
- Permission analysis (live, 2026-10-13): `module:costing-control-center` view = 1 user; `module:material-cost-manager` view = 1 user, edit = 1 user; CCC-only users = 0. Today no one loses access. For future CCC-only users the summary must show a "You need Material Cost Manager access" state instead of a broken link.
- Spec: CCC Control Workbench keeps summary KPIs (blocked/review counts, top items count, material foundation diagnosis via `rpc_get_current_material_foundation_diagnosis`) and a **"Open in Material Cost Manager"** link carrying period + filter. Remove the full queue/drilldown table and review-acceptance actions from CCC (MCM already has `rpc_accept_material_review_action`, register, drilldown).
- Must verify in plan: every action available in CCC Workbench exists in MCM (feature parity checklist); if any is missing, it moves to MCM first.
- Files: costing-suite-control-center.js, costing-suite-shell.js, costing-suite-material-cost.js (accept incoming filter params), costing-control-center.html, registry description text.
- Acceptance: parity checklist 100 %; link opens MCM with same period/filter; counts equal between CCC summary and MCM queue; no-access state verified with a test user lacking MCM view.
- Rollback: revert commit.

### 12.6 S2 — Drop legacy views — **HIGH-RISK (destructive DDL, server)**
- Preconditions: S1 verified; C1 merged; pg_depend shows **zero** dependents on both views; pg_stat_statements shows **zero** calls after S1 for the whole observation window (Q4).
- Step 1 (reversible): `REVOKE SELECT ... FROM authenticated` on `public.v_costing_pricing_dashboard_summary`; observe.
- Step 2: `DROP VIEW public.v_costing_pricing_dashboard_summary; DROP VIEW costing.v_pricing_workflow_dashboard_summary;` (no CASCADE).
- Restore script: captured `CREATE VIEW` definitions (both), owners, grants, comments — produced and test-applied on a Supabase **branch** before production drop.
- Client follow-up: regenerate `types/supabase.ts`; retire `pricing-dashboard-summary-cardinality-smoke.mjs` legacy assertions.
- Acceptance: CCC dashboard unaffected; restore script proven on branch.

### 12.7 S3 — Dead-view investigation + removal (D5) — **HIGH-RISK (destructive DDL, server)**
Evidence collected so far (read-only, 2026-10-13):
| View | Source | Grants (SELECT) | pg_stat_statements calls since 2026-08-11 | View/fn/cron/edge/repo refs | Note |
|---|---|---|---|---|---|
| v_costing_pricing_cost_sheet_rm_line_traceability | costing.cost_sheet_rm_line_traceability_snapshot | postgres, service_role only | 0 | none | Comment: "Internal diagnostic … browser clients must use RPCs" — **intentionally internal, recommend KEEP** |
| v_costing_pricing_material_rate_issue_lines | costing.v_material_rate_issue_lines | authenticated | 0 | none | candidate |
| v_costing_pricing_product_status_summary | costing.v_costing_product_status_summary | authenticated | 0 | none | candidate |
| v_costing_pricing_review_top_action_items | costing.v_costing_review_top_action_items | authenticated | 0 | none | candidate (snapshot twin is used) |
| v_costing_pricing_review_workbench_summary | costing.v_costing_review_workbench_summary | authenticated | 0 | none | candidate (snapshot twin used by KPI view) |
| v_costing_pricing_selected_scheme_policy | costing.v_sku_selected_scheme_policy | authenticated | 0 | none | candidate |
| v_product_mrp_adjustment_evidence | product_skus, products, v_product_mrp_derivation_current, v_sku_mrp_current | authenticated, postgres | 0 | none | Comment says "analytical evidence" — **business choice**: retire or keep as an analysis view? Recommend retire (no consumer) with restore script |
Edge functions checked: `cleanup-raw`, `lookup-reference-doi`, `eaushadhi-qc-report-verify` — none reference these views. Cron: 0 references. Repo (all files incl. scripts/tools): 0 references outside this doc.
- Only the **public wrappers** are in scope. The `costing.*` source views behind them are a follow-up check (they may become orphaned after the drop) — re-run the same evidence on them in S3 phase 2.
- Phase 1 (reversible): revoke `authenticated` SELECT on the 5–6 candidates; observe for the Q4 window; any client error = immediate re-grant.
- Phase 2: `DROP VIEW` (no CASCADE) with restore script (definitions, owner, grants, comments) proven on a Supabase branch.
- Acceptance: zero dependency/usage evidence at drop time; all six costing pages open cleanly; restore script tested.

### 12.8 Collision with Jarvis's e-Aushadhi branch
`feat/wp07-s2c-c1-qc-preparation-ui` (another bot, parallel programme) bumps `public/sw.js` `CACHE_NAME` to `hub-cache-v364` and edits `scripts/pricing-dashboard-summary-cardinality-smoke.mjs` (SW-version assertion only). Rule for WP05: (1) do not edit either file until that branch merges or the owner decides merge order; (2) any WP05 sw.js bump must be computed from the then-current main at merge time; (3) CCC-P05 (stop pinning SW version in 73 smoke scripts) would remove this recurring collision.

### 12.9 Summary of risk classes
| Package | Class | New backend contract? | Business choice? |
|---|---|---|---|
| C1 | Routine | No | No |
| S1 | High-risk server | No (same output) | No |
| S4 | High-risk server | **Yes** (2 read RPCs) | Q1, Q3 |
| C2 | High-risk client (plan gate) | Consumes S4 | Q1, Q2, Q3 |
| C3 | Routine (with parity plan check) | No | No |
| S2 | High-risk destructive | No | Q4 |
| S3 | High-risk destructive | No | Q4; keep/retire `v_product_mrp_adjustment_evidence` (recommend retire) |
