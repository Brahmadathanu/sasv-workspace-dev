# Next implementation briefs — WP05/WP06 closure and WP08/WP09 navigation — 4 Nov 2026

Briefs only. No code, governed-metadata change (`app_modules`, `app_nav_sections`), server object, flag or business rule is introduced here. Baseline `main` `195b13c4df32a5fdcf22ee304066e96c1b138481`. Builds on PR #143 (audit), #145 (source-evidence/matrix), #147 (CDE-1 design) and the CDE-1a implementation PR. Correction to #145 §5: **eleven** default-OFF Costing flags exist, not nine — in addition to the nine in `costing-feature-flags.js` there are `COSTING_PRM_CORRECTIONS_V1` and `COSTING_PRM_NAV_CONTEXT_V1` (defined in their own modules). The WP12 matrix must test all eleven OFF and ON.

Each brief: one branch, one draft PR, one file writer, full-history LF + CRLF + Chromium (0 skipped), flag-OFF byte parity, no merge.

## WP05 closure

### Residual items (verified against `main`)
| ID | Item | State | Class |
|---|---|---|---|
| C1–C3 | Route Editor Supersede, candidate scope controls, governed family creation | merged P02, behind `COSTING_PRM_CORRECTIONS_V1`; owner signed-in ON acceptance outstanding | acceptance only |
| C5/D5 | Fixed exact-run contexts (runs 80/82) in Route Readiness/Workload/Mapping/Foundation | labelled "fixed historical context" under the flag; a selector needs a server selection contract | **server first** |
| C6 | `COST_APPROVAL_WORKBENCH` non-navigable; `COST_REVIEW_WORKBENCH` unmapped (111 of 114 draft-148 review/blocked SKUs have no fix link) | CDE-1a gives per-component fix links for the drawer; the table-level route remains unmapped | **owner decision O-8** (below) |
| C8/D8 | Trace tabs visible without trace roles | `resolveTraceNavVisibility` exists (N2) | verify only |
| C9 | Registry `policy-manager.periodScoped:false` vs period-scoped CSA workspace | open | owner authority |
| S2 | Printable Cost Sheet vs SKU Cost Details view families could diverge | unverified | read-only data comparison (owner/server session) |
| S3 | PPM Status tab not period-scoped | unverified | code read + mock test |
| S9 | CCC KPI strip reloads on every lens | code-confirmed, cost not measured | measure first |
| D3 | CCC-edit can accept reviews without MCM-edit | open | **owner policy** |

### Brief WP05-CL1 — closure evidence pack (docs + test-only)
Goal: produce the WP05 closure record without changing behaviour.
1. Reconcile A1–A7 against `main`: for every register row above write *delivered / flag-gated / owner-gated / server-gated* with file and test references (generated from `git grep`, not recalled).
2. Add test-only coverage for rows marked "verify only": C8 (trace tab visibility per role matrix via `resolveTraceNavVisibility`), S3 (PPM Status tab period identity with a mock controller; if the tab ignores the period, record a defect brief, do not fix here).
3. Write `WP-05` Gate Status update proposal (not applied): closed only when owner accepts the signed-in ON/OFF checklist for the 11 flags; Tier-2 items listed with explicit non-blocking rationale (D2 merge of Readiness/SKU Control, D4 CSA relocation).
Files: one docs file, one test directory. Tests: C8 matrix, S3 identity. Stop: any S3 defect becomes a separate brief.

### Brief WP05-CL2 — table-level fix link for review rows (blocked on O-8)
Only if the owner chooses an existing destination for `COST_REVIEW_WORKBENCH` (candidates: Costing Review Workbench lens already used by `MATERIAL_RATE_REVIEW`, or "none"). Change is in `costing-suite-recommended-ui-route.js` mapping + worklist copy; today's honest "no dedicated screen" text stays for any code without a verified destination. Needs: owner-approved code→destination table; tests for every `recommended_ui_route` code (navigable/non-navigable), OFF parity.

## WP06 closure

### Brief WP06-G1 — task-flow audit (read-only, then bounded fixes)
1. Map Pricing Policy Manager tasks to W6 groups and to the six user tasks in `WP-06` (MRP policy setup, change workflow, selling schemes, Commercial Sales Assumptions, SKU overview, status) with route/lens ids and permissions (`canEditPricingPolicyActions`, `requireEditAccess`), one table.
2. Identify defects by mock walkthrough (Chromium) of: set/close SKU sales assumption (validation, `approval_reference`), regional default policy IK/OK editing, scope preview (`rpc_preview_sales_allocation_default_policy_scope`), proposal decision flow.
3. Fix only unambiguous client defects behind `COSTING_NAV_GROUPS_V1` or existing opt-ins; no maker-checker change (D7), no registry change (C9).
Tests: extend `costing-w6-pricing-nav`; add CSA modal validation tests with mocked `costingRpc` (same pattern as A7).

### Brief WP06-G2 — C9 metadata (owner-authorised only)
`policy-manager.periodScoped` in `costing-suite-registry.js` L158 is shared registry (single writer). Options: (a) leave and document, (b) set per-workspace scope metadata. Needs owner decision and a registry-wide test of period handling for every lens; do not start without O-5/C9 approval.

## WP08 — Master-data navigation (IA08)

Facts: `public/shared/` has 46 pages including `manage-products.html`, `manage-rm-bom.html`, `manage-pm-bom.html`, `manage-sp-bom.html`, `production-route-manager.html`, `pricing-policy-manager.html`, `cost-build-manager.html`, `material-cost-manager.html`; the hub shows what `v_app_module_registry` (client_key `pwa`, nav_enabled) returns per user access (`getModuleAccessLevel`). Independent read-only audit (PR #141): 11 active sections, 115 nav-enabled rows, 22 in Product & Reference Master. Rows are modules, not necessarily distinct URLs; the PWA hub reads only `client_key="pwa"`, so the per-client-key split is still unknown.

### Brief IA08-1 — registry-to-page map (read-only, authorised session)
Input needed (**O-2**): export of `module_key, target_key, label, section_key, sort_order, min_nav_mode, route_path, client_key` for `app_modules`/`v_app_module_registry`. Output (docs): table row ↔ repo page ↔ owning WP ↔ required permission target; list rows with no page, pages with no row, duplicate destinations, and labels that differ from page titles. No edits.

### Brief IA08-2 — proposed Product → SKU → BOM → Route → Policy order (server metadata)
A label/sort proposal for the 22 Product & Reference Master rows, delivered as a table the owner can apply through governed metadata. Client code does not change. Acceptance: the hub renders the new order from the same query (no client sort override) — verified by a mock-registry Chromium test that asserts order = server `sort_order`.

### Brief IA08-3 — in-page cross-links between master-data pages (client)
Only after IA08-1: add flag-gated "Related" links between Manage Products ↔ BOM pages ↔ Production Route Manager ↔ Pricing Policy Manager using existing page URLs and the existing nav-context carrier (`costing-nav-context.js`) for product/SKU ids. Constraints: permission checks untouched (a link renders only if the user's module access ≥ view, as the hub does), links open in the same governed page contracts, no new route. Files: one writer per page; each page change is a separate small PR. Tests: link visible/hidden per access level, ids carried, flag OFF parity.

## WP09 — Wider application launcher (IA09)

Facts: `utilities-hub/js/hub-auth.js` `loadUtilities()` builds sections from `app_nav_sections` + registry rows; `index.html` has no search, filter or collapse; access filtering is per user via `getModuleAccessLevel`. 115 rows over 11 sections means long lists.

### Brief IA09-1 — hub search and section collapse (client, presentation)
Scope: add a search box and per-section collapse to the hub, **on top of** the unchanged server data. Rules: filter only among rows the user may already see (`accessLevel !== "none"`); never reveal hidden rows; matching on label/description/section label; collapse state in `localStorage` only as a per-user convenience, wrapped in try/catch; keyboard accessible (`/` focuses search is optional), 360 px; no change to hrefs or `normalizeClientRoute`. Flag: new default-OFF hub flag (exact `"1"`) so the owner can compare; **O-7** decides whether a flag or direct default is wanted. Shared files (`utilities-hub/index.html`, `hub-auth.js`) have a single writer; do not overlap with e-Aushadhi (paused) — the change must not touch any e-Aushadhi row logic. Tests: filter correctness with a mock registry of 115 rows across 11 sections, rows with `none` access never rendered or matched, collapse persistence failure tolerated, OFF parity (HTML identical), Chromium 360/1280.
### Brief IA09-2 — e-Aushadhi visibility (read-only)
Record how e-Aushadhi rows appear (section, labels, roles) from the IA08-1 export; no change while WP-07 is paused.
### Brief IA09-3 — non-Costing module rationalisation (metadata)
Duplicates/renames found in IA08-1 become an owner-approved metadata change list; no deactivation by the client.

## Decisions needed before coding
| ID | Decision | Unblocks |
|---|---|---|
| O-2 | Authorise registry export per client key | IA08-1/2/3, IA09-1 test data realism, IA09-2/3 |
| O-5 | D3, D5, D7, C9 | WP06-G2, parts of WP05 closure |
| O-7 | Hub search: flag or default | IA09-1 |
| O-8 | Destination (or "none") for `COST_REVIEW_WORKBENCH`/`COST_APPROVAL_WORKBENCH` | WP05-CL2 |
| O-1 | Protected draft-run read contract | CDE-1b (wire real provider) |

## Suggested order
CDE-1a review → WP05-CL1 (docs/test-only) ∥ WP06-G1 audit → IA08-1 export (owner) → IA09-1 → IA08-3 pages one by one → WP05-CL2/WP06-G2 after owner decisions → WP12 final matrix on final head (all eleven flags).
