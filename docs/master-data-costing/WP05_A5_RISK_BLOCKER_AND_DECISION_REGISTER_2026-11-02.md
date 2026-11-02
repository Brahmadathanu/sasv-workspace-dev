# WP05-A5 — Risk, blocker and owner-decision register (2 Nov 2026)

Baseline `main` `3d0b618`. Class per IMPLEMENTATION_RULES scope discipline. **Confirmed** = reproduced by static code reading with file:line (not browser-reproduced). **Suspected** = inference or unverified.

## 1. Defects

### Confirmed (code-confirmed; none browser-confirmed)

| ID | Defect | Root cause (file:line) | Safe correction (no lifecycle change, no invented codes) | Pack |
|---|---|---|---|---|
| C1 | Product Route Editor **Supersede needs a loaded route record** | "Supersede" button is rendered only in the loaded-route branch (`production-route-editor.js` 1501), after the empty-state early return (1463-1469). Old route id comes from `productState.detail` via `productId()` (ED 201-205, `supersedeProduct` 869-883); without it the builder (RPCJS 1661-1680) rejects. The pill alone has **no product picker** (ED 1464-1468; HLP 545) and tab switch strips `product_route_id` (shell 5264-5266) | (a) product picker in the empty state reusing the Effective Viewer picker pattern (MAIN 10862-10890) + existing history chooser (MAIN 9693); (b) gate Supersede to the server-valid state using the existing lifecycle helper (ED 1470-1500) — currently **always visible** on any loaded route; (c) replace the raw-integer "New approved draft route ID" prompt (MAIN 10409-10455) with a chooser from `state.productHistory`, still sending the same `p_old/p_new`; (d) name the route being superseded in the dialog | WP05-P02 |
| C2 | **Historical Evidence Review scope controls hidden** | `renderCandidates` (MAIN 10740-10765) writes selectors (`#prmCandidateFamily/Groups/Product` + four Preview buttons) into `#workbenchSummary`, which is `display:none` until `.is-visible` (html 882-892). It never adds `is-visible`, and render cleanup actively removes it for this lens (MAIN 11255-11264). Deep-link `product_id`/`route_family_id`/`candidate_kind` set state (11154-11161) but `option()` (10736) is called without `selected`, so controls would not preselect | add `is-visible` and keep the lens in the keep-visible condition (11255) **or** render controls into the lens root; pass `selected` from state. Pure presentation | WP05-P02 |
| C3 | **Candidate-based family creation never calls the RPC** (missing `p_family_code`) | Candidate handler (MAIN 10814-10860) passes only `route_family_name` to `candidates.createRouteFamily` (CAND 229-249) → `buildCreateRouteFamilyArgs` (RPCJS 806-836) has `p_family_code` `required:true` → returns `{ok:false}`; CAND toasts; **the dialog still closes** (`costing-dialogs-route-input.js` ~153-160 treats any returned outcome as ran); user sees only a warning toast | Do **not** derive a code. Route to the governed Route Families modal `openCreateFamilyModal` (MAIN 6006-6130: user-typed code, uppercase, `/^[A-Z][A-Z0-9_]*$/` at 6073-6078), optionally prefilled name/description (never code); and make the prompt dialog stay open on `ok:false` | WP05-P02 |
| C4 | Route Families lens already has the **correct governed creation path** (code typed, validated) | MAIN 6006-6130 → `rpc_create_route_family`; approval separate | Reference implementation for C3; no change | — |
| C5 | PRM exact-run lenses (Workload Preview, Mapping Review, Foundation Review) are **fixed to run 82 / period 2026-08-01 / valuation 2026-08-07** and not user-selectable | HLP 177-203 | Show run explicitly in the UI now (label only); selection needs owner/server decision (D5) | WP05-P02 (label) / Later |
| C6 | `COST_APPROVAL_WORKBENCH` remediation route is **non-navigable** (dead end from SKU Control Status) | `recommended-ui-route.js` 326-332 | Keep non-navigable until a target exists (CW-02 approval screen is flag-gated); show explicit message | MDC-07 |
| C7 | A selected product/route is **dropped when a pill is clicked**; no breadcrumb/context chip; no back from Product Editor | shell 5262-5280; MAIN 2527-2538, 11949-11957 | Context chip + breadcrumb + preserve ids across pills | MDC-07 |
| C8 | Trace tabs visible to users lacking trace roles (restricted message only) | nav unfiltered; material-cost.js 4630-4650 | Role-aware tab visibility (UX only; server unchanged) | MDC-07 |
| C9 | Registry metadata: `policy-manager.periodScoped:false` while its CSA workspace is period-scoped | registry:158; pricing-policy.js 401-407 | Document/correct metadata with WP06 | WP06 |

Note: the 8 CRLF test failures seen in the first CRLF run were an error in my reproduction environment, not a product defect (see A7).

### Suspected / unverified

| ID | Suspicion | Why unverified |
|---|---|---|
| S1 | Proposal Decisions has no maker-checker (client shows submitted_by/decided_by only) | Server RPC not inspected (D7) |
| S2 | Printable Cost Sheet and SKU Cost Details view families (`printable_*` vs `sku_detailed_cost_sheet`) or Scheme/Cost Comparison runs could diverge | Needs read-only data comparison, not done |
| S3 | PPM Status tab can be stale vs selected period | not period-scoped; no data check |
| S4 | `product_id` pass-through in `buildCostingRouteQuery` | agent marked [A] |
| S5 | No archival *action* in PRM UI (only read-only Archived Routes) | RPC allowlist inspected only |
| S6 | Module launcher / Utilities Hub entries and `app_modules` labels | server-sourced; not in repo |
| S7 | Narrow-screen/density of proposed grouped nav | not browser-verified (CW-13 covers current pages) |
| S8 | Server permission strings for Cost Governance/Staff/Provision RPCs | inferred from module model |
| S9 | Dashboard KPI strip reloads same summaries on every CCC lens (perf) | code-confirmed reload (shell 4592) but cost not measured |

## 2. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Grouping nav erodes the CCC-edit/MCM-edit or RM/PM role separation | Presentation-only wave; permission checks untouched; acceptance tests assert unchanged checks |
| R2 | Merging queues/lenses breaks deep links and `recommended_ui_route` targets | Keep all lens ids as aliases; test every `resolveRecommendedUiRouteTarget` code |
| R3 | Combining SKU Control Status and Readiness mixes run-scoped and live truth | Keep as two labelled tabs with separate loaders until D2 |
| R4 | Giant shared files (`shell` 10 276 lines, `production-route.js` 12 042) — parallel edits conflict | One shared IA spec first; assign file ownership (A6); sequential merges |
| R5 | Old table-tools tests are source-string-sensitive (REMAINING_WORK note) | New shell features extend per-feature tests; budget time |
| R6 | Per-browser flags create UI divergence during rollout | Treat flag state as part of acceptance matrix (ON/OFF) |
| R7 | Open October state (run 143 approved / 148 draft) must not be implied by any UI work | No data-dependent claims in packages |
| R8 | Cache bump coordination with e-Aushadhi smokes | Only on owner-approved release packs; this audit made none |

## 3. Blockers

| ID | Blocker | For |
|---|---|---|
| B1 | WP05 design-review acceptance (this PR) | every implementation pack |
| B2 | SKU Control ↔ Readiness parity gaps (WP05-P01): Readiness lacks run selector, fix navigation, shared CSV | combine of CCC lenses |
| B3 | Server contract for run selection on exact-run PRM lenses | un-hard-coding run 82 |
| B4 | Server `app_modules` label change (owner-approved governed metadata) | Utilities Hub "Cost Sheet Review & Approval" |
| B5 | October finalise decision (existing item 1 in REMAINING_WORK_2026-11-01) | read-only views and run-scoped follow-ups |

## 4. Owner decisions required

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Accept the proposed task-oriented architecture (A3) as the target for MDC-07, or choose a subset | Accept presentation-only wave 1 |
| D2 | Combine SKU Control Status + Readiness as one "SKU Review" with two truth-model tabs after parity | Yes, tabs not merge |
| D3 | Reconcile CCC Workbench vs MCM action queue: keep both, or one authority? (CCC-edit can accept reviews without MCM-edit today) | Keep both until authority confirmed |
| D4 | Relocate Commercial Sales Assumptions out of PPM into a "costing inputs" home? | Defer; group only |
| D5 | Source of run for Workload/Mapping/Foundation Review (hard-coded run 82) | Server-owned selection contract first |
| D6 | Where "Request Costing Refresh" belongs (CCC, CSR, PPM all show it) | Keep until D-decision |
| D7 | Server check: is proposal-decision maker-checker enforced? | Verify read-only on server |
| D8 | Hide trace tabs lacking role vs keep visible-with-message | Hide (UX only) |
| D9 | Authorise WP05-P02 defect fixes (C1-C3) as a bounded client package | Yes — behind `COSTING_DIALOGS_V1`-style opt-in where behaviour changes |
| D10 | Utilities Hub label change via governed server metadata | Separate server approval |
