# WP05-A6 — Bounded Claude implementation-package plan (2 Nov 2026)

**PLAN ONLY. Nothing here is authorised.** Packages start only after WP05 design acceptance and a written owner brief per [CLAUDE_CLOUD_WORKFLOW.md](CLAUDE_CLOUD_WORKFLOW.md) (one brief, one draft PR, never merge; sequential merges on the owner's exact sentence). Client-only; no migrations; new behaviour behind a default-OFF flag where it changes behaviour; no approval-preview RPC against production; migration `20261015045233` untouched; cache bump only on an owner-approved release pack, coordinated with Jarvis.

Baseline for every package: current `main` (re-verify SHA); test baseline 408/408 on LF and CRLF ([A7](WP05_A7_REGRESSION_EVIDENCE_2026-11-02.md)).

## 0. Shared prerequisite — IA spec (docs only, WP05 close)
One shared shell/IA spec (from [A3](WP05_A3_PROPOSED_NAVIGATION_ARCHITECTURE_2026-11-02.md)) is frozen **before** any parallel edit, because `costing-suite-shell.js` (10 276 lines) is shared by all six pages.

## 1. Packages

**G2 correction.** The first wave is **presentation-only** (Tier 1 in [A3](WP05_A3_PROPOSED_NAVIGATION_ARCHITECTURE_2026-11-02.md)): all six modules, 32 lens ids, 10 PPM workspaces, deep links, controllers, permissions and data models are preserved. Queue merging, SKU Control ↔ Readiness merging and evidence-lens merging are **Tier 2 / conditional** (§1b) and are not first-wave work.

### 1a. First-wave packages

| Pkg | Scope | Pack | Files owned (exclusive) | Depends on | Flag | Acceptance tests |
|---|---|---|---|---|---|---|
| **P02 — PRM defect fixes (C1–C3, run-context label)** | Candidate scope controls visible & preselected; candidate "Create Route Family" routed to the governed code-entry modal (user types `p_family_code`; never generated); prompt dialog stays open on `ok:false`; Product Route Editor product picker + route-history selector that preserves server eligibility (two active APPROVED routes of the same product; payload `p_old_product_route_id`/`p_new_product_route_id`; server validates; no client date logic); Supersede shown only when a valid pair can exist; fixed exact-run context shown as "fixed historical context" (label only, no resolver) | WP05 | `costing-suite-production-route.js` (candidates render 10740-10860, 11255), `-route-editor.js`, `-route-candidates.js`, `costing-dialogs-route-input.js`, `production-route-manager.html` (CSS only) | D9 | New behaviour behind `COSTING_DIALOGS_V1` or a new default-OFF flag; flag-OFF path byte-identical | Mock-backend browser test (pattern of `route-dialogs-browser.test.mjs`): controls visible; create-family sends `p_family_code` only when the user typed it, never auto-derived; dialog stays open on failure; supersede selector lists only same-product APPROVED routes; payload names unchanged; zero write RPCs on cancel; flag-OFF parity |
| **P01 — Readiness usability (strictly bounded)** | Readiness only: supported contextual remediation links via `resolveRecommendedUiRouteTarget`, shared CSV export, clearer LIVE_AS_OF information (as-of/valuation labels). **No run selector** on LIVE_AS_OF Readiness; no run-scoped semantics added; no change to RPC set | WP05 | `costing-suite-readiness.js` and its tests only. If a shell hook (e.g. `ALL_ROWS`/`VIEW`, shell 2054) is unavoidable it is a separate micro-change merged **before N1** or requested through N1 | B2 | none, or `COSTING_REVIEW_WORKLIST_V1` | `wp04-readiness-client-contract-smoke`; new unit tests for navigation and export; `FORBIDDEN_RPCS` and RPC list identical; assertion that no run selector/run parameter is introduced |
| **N1 — Shared navigation contract + grouped-nav renderer + context chip/breadcrumb** | Defines the group-metadata contract (group id, label, member lens ids, context label) and implements the renderer. Lens ids/aliases unchanged; no permission change. **N1 is the sole owner of shared files** | MDC-07 | **Exclusive:** `costing-suite-registry.js`, `costing-route-config.js`, shell nav render (5010-5110) and pill handler (5262-5280), `sasv-costing.css` (append-only block). Contains the group metadata for *all* modules | IA spec; P02 and P01 merged (or rebased) if they touch the same shell/PRM lines | `COSTING_NAV_GROUPS_V1` (default OFF) | Registry still 32 lenses / every id resolves; deep links `?lens=`/`?workspace=` unchanged; permission checks byte-identical; CW-13 responsive test extended (390/520/768/900/1280); flag-OFF parity |
| **N2 — MCM/CBM grouping + role-aware trace tabs** | Group labels via N1 contract; hide trace tabs without role view (UX only) | MDC-07 | Controller-side files only (`costing-suite-material-cost.js` tab visibility; read-only use of 3974-4012). **No registry/route-config/shell edits** | N1 merged, D8 | N1 flag | `canAccessRmTrace/PmTrace` unchanged; RM and PM remain separate ids; export roles untouched |
| **N3 — CSR cross-links + Action Queues nav group** | QC and M&S queues share a nav group but remain **two lenses with two controllers**; links CSR Scheme Comparison ↔ PPM SKU Policy Overview; remediation links open with period/product | MDC-07 | `costing-suite-scheme-comparison.js`, `-qc-action-queue.js`, `-materials-stores-action-queue.js` (links only). **No registry/shell edits** | N1 merged | N1 flag | Both RPC param shapes unchanged; `qc-rpc-contract-smoke`, `materials-stores-rpc-contract-smoke`; CSR stays read-only |
| **N4 — PRM five-group nav + context persistence** | Group PRM pills via N1 contract; keep selected ids across pills; "Evidence & Review" group with Mapping Review, Foundation Review and Historical Evidence Review as **three independently accessible lenses** | MDC-07 | `costing-suite-production-route*.js` navigation/context code. **No registry/shell edits** (pill handler change is N1's) | N1 merged, P02 merged | N1 flag | Journey test: select product → switch groups → context retained; every old lens id resolves; 24 read / 38 write RPC names unchanged |
| **W6 — PPM workspace grouping** | Group 10 workspaces via N1 contract; label disambiguation; metadata fix (C9) | WP06 | `costing-suite-pricing-policy.js` (84-200, 702-715). **No registry edit** (C9 metadata change goes through N1) | N1 merged, WP06 design | N1 flag | `?workspace=` URLs unchanged; legacy lens ids still resolve; SC5 redirect test retained; single edit flag unchanged |
| **U11 — Terminology/labels/status glossary pass** | Consistency across groups | WP11 | `costing-status-labels.js` and label maps | N-packs | `COSTING_UX_CONSISTENCY_V1` | `status-labels.test.mjs` extended |

### 1b. Conditional subsequent work (Tier 2 — NOT authorised, NOT first wave)
Each needs fresh evidence, an owner decision and a Plan gate before a brief is written.

| Item | Condition |
|---|---|
| Single SKU Review screen (SKU Control ⊕ Readiness) | D2 yes; P01 done; data models stay separate, no run selector on LIVE_AS_OF |
| Shared queue controller for QC + M&S | Evidence of duplicated maintenance cost; vocabularies/RPCs preserved |
| Tabbed Evidence & Review lens | Usability evidence from N4; deep links and independent access preserved |
| Effective Route read tab inside Product Route Editor | After P02 picker exists |
| Commercial Sales Assumptions relocation | D4 |

## 2. Dependency graph and integration order
`IA spec → {P02 ∥ P01} → N1 → {N2 ∥ N3 ∥ N4 ∥ W6 developed in parallel} → U11`.
* P02 (Production Route files) and strictly bounded P01 (`readiness.js`) are independent and can run in parallel.
* **Shared-file ownership:** only N1 edits `costing-suite-registry.js`, `costing-route-config.js`, the shell nav render/pill handler and the shared CSS block. N2/N3/N4/W6 are file-disjoint from each other **only** in their controller files; none edits the registry or shell, and they consume the N1 contract.
* **Merge order (sequential, one at a time on the owner's exact sentence):** P02 and P01 (any order) → N1 → N2 → N3 → N4 → W6 → U11; each later package rebases on the previous merge and reruns the full suite on LF and CRLF.

## 3. Out of packages (separate authorisation)
Server `app_modules` label (D10); exact-run selection contract (D5, server review first; no latest-run resolver); maker-checker policy and any server change (D7); any permission split; CW-01/CW-02 period & approval screens; CSA relocation (D4); retiring `v_costing_pricing_dashboard_summary` (CCC-P03).

## 4. Standard acceptance gate for every package
Full suite 408+new on LF **and** CRLF (Windows-equivalent autocrlf config) with Chromium tests not skipped; flag-OFF parity; no `supabase/`/migration diff; `FORBIDDEN_RPCS` unchanged; self-review; populated-data signed-in browser acceptance by owner before merge.
