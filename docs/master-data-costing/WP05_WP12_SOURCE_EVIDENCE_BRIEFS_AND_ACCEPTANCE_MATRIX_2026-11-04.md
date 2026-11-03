# WP05–WP12 source-evidence mapping, navigation briefs and acceptance matrix — 4 Nov 2026

Supersedes the SC-1/SC-2 framing of the 3 Nov audit (PR #143). Inputs: independent server findings in PR #141 (`CS_R3_LIVE_OPERATIONAL_AUDIT_2026-11-03.md` §2B–2E) and the owner review comment on PR #143. Baseline Git `main` `4bbadf8`. This session had **no database access**; server facts below are quoted from #141 (read-only, unmerged) and are not re-verified. No new RPC, SQL, approval path, flag change or write is proposed.

## 1. Root-cause lanes for draft 148 and what the client already offers

| Review class (run 148) | Source cause (per #141) | Existing client surface | Gap |
|---|---|---|---|
| 109 prime reviews: direct-labour component foundation (`REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION`; 52 basis OK, 32 `NO_SKU_SALES_IN_LOOKBACK`, 25 `NO_PRODUCT_SALES_IN_LOOKBACK`) | direct-labour component model `MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS` unresolved | **Production Route Manager** workload lenses: `rpc_get_production_route_manager_workload_preview` / `_detail`, `rpc_get_route_workload_management_explain`; direct-labour workload policy submit/approve RPCs (`rpc_submit_/rpc_approve_direct_labour_workload_policy…`) in `costing-suite-production-route*.js`; **Driver Governance** (`costing-suite-driver-governance*.js`); Cost Sheet evidence sections (Allocation Basis / Governance) showing `allocation_reason_code`, `allocation_basis_source`, `allocation_resolution_status/note` (`costing-suite-cost-sheet.js` L160–205, L3145, L4053) | Cost Sheet evidence reads `v_costing_pricing_*` views, which are **governed-run (143) pinned**; draft-148 component snapshots (`costing.sku_direct_labour_allocation_snapshot`) are **not displayed** by any client screen. The worklist drawer already warns that its evidence is not the draft run's. |
| 57 of those: no sales basis (SKU/product) | allocation resolution REVIEW_REQUIRED; notes mention SALES-01, Smart default v2/`NEW_PRODUCT_NO_HISTORY`/policy 6 | **Commercial Sales Assumptions** (`costing-suite-commercial-sales-assumptions.js`, inside Pricing Policy Manager): `rpc_get_sku_sales_assumptions`, `rpc_set_sku_sales_assumption`, `rpc_close_sku_sales_assumption` (needs `approval_reference`, edit permission via `canEditPricingPolicyActions` / `requireEditAccess`); default policies `rpc_get/set_sales_allocation_default_policies[_scoped]`, preview scope | Existing governed remedy exists; nothing to build. Which SKUs need it is read from the snapshot, which the client cannot show for a draft run. |
| 1 prime review: internal conversion (direct labour READY) | internal-conversion component REVIEW_REQUIRED | No dedicated conversion screen found in client (grep: conversion appears only in status labels/explain text) | Owner/server question, not invented here |
| 1 pricing-bridge review: Dhanyamlam SKU 41, OK region (`REGION_SCALED_COMMON_BASIS`; IK READY) | no positive regional SKU actual units or governed regional assumption | **Commercial Sales Assumptions → regional default policies** (`rpc_get_regional_sales_allocation_default_policies`, `rpc_set_regional_sales_allocation_default_policy`; scenarios `NO_ELIGIBLE_REGIONAL_HISTORY`, `NO_POSITIVE_REGIONAL_HISTORY`; regions IK/OK, "Outside Kerala"; scopes SAME_REGION_LINKED/ALL_REGIONAL) and per-SKU assumption (`rpc_set_sku_sales_assumption`); Cost Sheet shows `regional_basis_source/status`. The client **never calls** `rpc_accept_regional_marketing_review` / `rpc_get_regional_marketing_evidence_review_queue` (exist in migrations `20260915060034`, `20261014135001`) | Whether OK needs a *regional default policy*, a *SKU assumption* or the migration-defined *regional marketing review acceptance* is an **owner/server decision**; the last has no client surface and must not be added without governance. |

**Conclusion.** Remediation and per-SKU evidence for 148 exist as governed upstream screens; the single concrete display gap is *draft-run component evidence* (direct-labour reason code/basis status per SKU for run 148). Surfacing it needs an authorised read contract (RLS/RPC/view for `sku_direct_labour_allocation_snapshot` and `sku_regional_marketing_expense_allocation_snapshot` by run) — **owner decision O-1**; the client must not query `costing.*` tables directly. A successful refresh after upstream fixes, not acceptance of a prime/bridge status, resolves the reviews.

## 2. WP08/WP09 concrete navigation briefs (from #141 §2D: 11 sections, 115 nav-enabled module rows)

Code facts: the hub is entirely server-driven (`hub-auth.js loadUtilities` → `module-registry.js`: `app_nav_sections` + `v_app_module_registry` filtered `client_key="pwa"`, `nav_enabled`), access filtered per user by `getModuleAccessLevel(moduleKey, minNavMode)`; Costing's six modules come from `costing-route-config.js` (`costing-control-center`, `material-cost-manager`, `cost-build-manager`, `pricing-policy-manager`, `cost-sheet-review`, `production-route-manager`); the hub has **no search/filter/collapse** of sections (grep of `index.html`, `hub-auth.js`). Note: #141's 115 rows may span client keys; the PWA hub reads only `client_key="pwa"` — count of rows per client key is an open read (O-2).

| # | Change | Where | Type | Needs |
|---|---|---|---|---|
| N-A | Hub module search + section collapse (client-only, presentation, no new data) | `utilities-hub/index.html`, `hub-auth.js` | client, shared hub file (single writer) | Owner design approval; ON/OFF behind a new default-OFF flag or hub opt-in |
| N-B | Rename/reorder Product & Reference Master (22 rows) into Product → SKU → BOM → Route → Policy order | `app_modules`/`app_nav_sections` data | **server metadata** — governed data change | Owner-approved label/sort list from a read of the 22 rows (O-2); no client code |
| N-C | "Cost Sheet Review & Approval" label (B4 in A5) | `app_modules` | server metadata | owner-approved |
| N-D | Costing launcher entry for the six modules with correct `permissionTarget` and deep links | `costing-route-config.js` already complete | none | retest only (WP12) |
| N-E | e-Aushadhi appears in hub only via registry rows | — | read-only; paused code untouched | none |

Exposure needed: an authorised read of `v_app_module_registry` rows (module_key, section_key, label, route_path, min_nav_mode) per client key, produced by a human/read-only session; mapped to repo pages (`public/shared/*.html`, 46 shared pages) to find rows with no page and pages with no row.

## 3. WP10 / WP11 independent audit result
- WP10: no new client-only action is unambiguous. Owner policy gates remain: Malayalam-name requirement, Product status at creation (default/force Inactive), activation refused unless READY, warning vs block rule, and server vocabulary for `MASTER_COMPLETE→…→COSTING_READY` (none exists). Client invariants to preserve (WP03): Activate is never disabled by severity; UNKNOWN stays UNKNOWN; no local readiness computation.
- WP11: U11 implemented in PR #144 (presentation, flagged). UX-P02 (Manage Products density/dialog/narrow layout) is subjective visual polish with no accepted design; not started without a design pass. No other unambiguous low-risk label defect was found in this pass.

## 4. Decisions required from owner
| ID | Decision |
|---|---|
| O-1 | Authorise a read-only, role-gated exposure of per-run direct-labour and regional-marketing component snapshots to the client (or decide the Cost Sheet should accept a run id). Until then no draft-148 component evidence display. |
| O-2 | Authorise a read-only registry export (per client key) for IA08/IA09; approve any `app_modules`/section label or order change (server metadata). |
| O-3 | For Dhanyamlam OK: regional default policy vs SKU assumption vs regional marketing review acceptance (migration-defined, no client). |
| O-4 | Internal-conversion review: which screen/owner resolves it. |
| O-5 | D3 (CCC-edit vs MCM-edit on review acceptance), D5, D7, C9 as in A5. |
| O-6 | WP10 policy gates above. |
| O-7 | Approve hub search/collapse (N-A) and whether it needs a flag. |

## 5. WP12 comprehensive acceptance matrix

Flags (exact `"1"`, default OFF, all in `costing-feature-flags.js`): `COSTING_RECALC_WITH_DATE_V1`, `COSTING_APPROVAL_SCREEN_V1`, `COSTING_LOCK_SCREEN_V1`, `COSTING_RUN_STATUS_V1`, `COSTING_UX_CONSISTENCY_V1`, `COSTING_DIALOGS_V1`, `COSTING_TABLE_TOOLS_V1`, `COSTING_REVIEW_WORKLIST_V1`, `COSTING_NAV_GROUPS_V1`. Each is tested OFF (default, byte-parity) and ON; combined states: all-OFF, each-alone-ON, all-ON, plus `NAV_GROUPS` × `REVIEW_WORKLIST` × `UX_CONSISTENCY` (shared screens).

| # | Area | Checks | Where | Role / env |
|---|---|---|---|---|
| A1 | Regression | LF + CRLF full suite from explicit `scripts/**/*.test.*`, full history, Chromium executed, 0 skipped | cloud | — |
| A2 | Legacy smokes | run all `scripts/*-smoke.mjs`; classify pass / stale-pin / e-Aushadhi-dependent; no silent waiver | cloud | owner on retire/repin |
| A3 | Six modules × lenses | each of the six modules opens its default lens and every `allowedLensIds` entry; old lens IDs (32) and 10 workspaces resolve; unknown lens falls back; flags OFF & ON | cloud mock (nav-groups/n2/w6 suites) + signed-in | signed-in per role |
| A4 | Permissions | module access `none/view/edit` per module; write buttons hidden/guarded for view; RPC name baselines unchanged (`rpc-names.baseline.json`); `FORBIDDEN_RPCS` never called | cloud mock | role matrix signed-in |
| A5 | Deep links | `recommended_ui_route` targets (every code in `resolveRecommendedUiRouteTarget`), URL `?lens=`, `?module=`, period/run context params, back/breadcrumb context | cloud | — |
| A6 | Review journey (client) | run picker 143↔148↔149; groups (BLOCKER first); show-in-table; drawer evidence warning on non-default run; "no dedicated screen" text; fix link to Material Cost action queue; empty/foreign/error loads; late-answer discard | cloud mock (review-worklist, run-selection) | signed-in with populated 148 for live |
| A7 | Material acceptance | eligibility only REVIEW_REQUIRED + `MATERIAL_RATE_REVIEW`; reason ≥10; payload fields exact; close acceptance; view-only user blocked; no bulk path | cloud mock **(to add: no checked-in test references `rpc_accept_material_review_action` or `saveMaterialReviewAcceptance` — grep of `scripts/`)** | live accept only by authorised human |
| A8 | Run governance | preview→approve/finalise payloads; error mapping; no legacy RPC; lock screen; recalculation date; run-status badge | cloud mock (`costing-approval`) | live decision: owner |
| A9 | Source remediation journeys | open Production Route workload explain; Commercial Sales Assumptions view/manage regional defaults (OK) and SKU assumption modal validation; Cost Sheet allocation-basis evidence | cloud mock + signed-in | authorised pricing/route roles |
| A10 | SKU creation → readiness | Manage Products create → readiness dialog; Product with no SKU shows "not assessed"; Inactive+Blocked; Activate never blocked by severity | mock + signed-in | role |
| A11 | Period history | period switch resets run selector; closed/open periods; run 143 approved label scoped to its period | cloud | — |
| A12 | Responsive | `costing-responsive` narrow widths for all six modules | cloud Chromium | — |
| A13 | Hub/launcher | registry mapping: rows ↔ pages ↔ roles; e-Aushadhi read-only | needs registry export (O-2) | read-only session |
| A14 | Packaged Electron | NSIS/ZIP build, install, reopen, updater, rollback, checksums | **not cloud** | Windows runner/human |
| A15 | Live data proof | populated-data walk of A3–A10 under real roles | **not cloud** | signed-in staff |
| A16 | Final gate | all of the above on final merged head; version/tag/publish only on explicit owner approval | — | owner |

Cloud-runnable now: A1–A6, A8, A11, A12, mock parts of A3/A4/A7/A9/A10. A dedicated A7 test is a recommended follow-up package (test-only, file-disjoint).

## 6. Next packages (ordered)
1. Owner answers O-1…O-7. 2. A7 test-only PR. 3. If O-1 approved: client read-only component-evidence panel in the review worklist drawer (existing worklist file, flag `COSTING_REVIEW_WORKLIST_V1`), tests for no mutation. 4. N-A hub search after design approval (single hub writer). 5. IA08/IA09 metadata proposals from registry export. 6. WP10 only after policy gates. 7. Full A1 on the final head, then Windows gate.
