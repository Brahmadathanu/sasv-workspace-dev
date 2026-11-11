# PEC — ERP Modernisation / G0 Baseline and Execution Contract (2026-11-11)

**Authority:** Owner request, tracked in [issue #284](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/284). **State:** G0 ACTIVE; no ERP-modernisation gate independently verified, no live mutation approved by this document.

## Outcome
Build a professional, future-proof, ERP-style procurement planning and execution workflow, in both server business logic and client experience, with consistent SASV global design language. Comprehensive but economical; extend existing canonical implementations instead of creating duplicate module sources or extensive new scaffolding.

## Legacy programme reconciliation (do not erase historical closure)
- WP00 and WP01: CLOSED in existing master; retain achieved access, canonical serial and permission controls.
- WP02 operational stabilisation: NOT OPEN in older master; reconcile actual incidents before deciding whether it remains necessary as its own package.
- WP02-A PR PDF continuation header: older master says IN REVIEW; current shared JS and `scripts/pec-pr-pdf-continuation-header-smoke.mjs` contain implementation/test references, and repository records mention PR #58. Verify merge status, live PWA/Electron behaviour and signed-in multi-page export; do not mark operator PASS from code presence.
- Manual indent insertion order: `MANUAL_INDENT_INSERTION_ORDER_20261105.md` documents live SQL verification (550/550 manual lines, no PR-origin impact) with signed-in UI/export check outstanding. Preserve nonalphabetical insertion order.
- Vendor-wise buying-list search: `VWL_SEARCH_RELIABILITY_20261108.md` documents client latest-wins, cancellation, and split-lookup handling (PR #238); `VWL_SERVER_PERFORMANCE_20261108.md` documents applied migration 20261108165005 and strong SQL timing improvement but still flags signed-in and export-parity follow-ups. Do not mislabel as fully accepted.
- Other PEC popups missing canonical indent serial: earlier out-of-scope; inspect for relevance as part of new global consistency audit.
- Cross-programme migration-history drift: remains separate; never bulk repair or replay already applied migrations in PEC.

## Verified repo reconnaissance, not yet complete lens-by-lens acceptance
- Canonical PWA entry: `public/shared/procurement-execution-console.html`; JS: `public/shared/js/procurement-execution-console.js`. Verify Electron resolves to these shared assets; do not create separate PWA/Electron copies.
- Five primary lenses from HTML IDs: `tab-pr`, `tab-action`, `tab-indents`, `tab-vendor-buylist`, `tab-excess`.
- Current shared JS contains 43 distinct direct `.rpc()` name literals (including `get_user_permissions`). This is **not** the full set of server functions and does not prove 43 available UI controls; complete a function/permission/call-site/action matrix at G0.
- Live tables confirmed (read-only): `proc_indent_header.indent_date`, `approved_date`, `source_pr_id`, `status`; `proc_indent_line.requested_qty`. This establishes storage, not an authorized draft edit contract.
- Existing client calls include `proc_pec_indent_headers`, `proc_pec_indent_lines`, `proc_indent_add_line`, `proc_indent_create`, `proc_indent_create_from_pr`, `proc_indent_resync_from_pr`, `proc_request_snapshot_refresh`, vendor recommendations and filtered buylist operations.

## Functional contract to prepare at G1
1. All appropriate tables: server-side bounded pagination / infinite scroll, deterministic stable sorting, latest-wins, filter reset, no duplicate/missing rows, export independence from viewport.
2. Icon + text at wide widths; meaningful accessible icon-only mode on narrow screens. Comprehensive title/home parity, typography, colour tokens, spacing, responsive tables, dialogs, loading/empty/error states, keyboard access and role-gated controls.
3. Draft-only quantity editing and date editing on independent/manual indents (`source_pr_id IS NULL`); validate eligible status, downstream allocation dependencies, permissions, positive quantities/UOM, reason/audit, concurrency; prevent alterations to linked/approved/issued/closed records. Confirm whether existing RPCs support it; add minimal governed wrapper only if needed.
4. Indent lens shows **Indent date** and **Approval date** independently, with truthful null/not-approved rendering.
5. Create server→client matrix categorised EXPOSE / SERVER-ONLY / DEFER / ALREADY PRESENT; don't expose administrative or security-sensitive functions merely because they exist.
6. Immediate vendor-mapping availability after creation: determine whether published snapshot generation, stale RPC read, local cache, or client race causes delay; prefer targeted source-of-truth readiness plus reliable refresh, not periodic polling hacks.
7. Hybrid PR: production-plan need and separately evidenced stock replenishment need, net of usable stock, reservations and confirmed incoming commitments. Do not double count overlapping demand or open PR/indent/PO supply. Explicit policy proposal for lead time, safety stock, reorder/minimum parameters, historical consumption, horizon and overrides. No automatic purchases or invented values. Preview component breakdown and provenance before approval.
8. Review actual semantics of `Excess & Overshoot`; rename/split only if supported by data and actions.
9. Audit PR→indent→vendor→purchase/excess→closure lifecycle, permissions, transitions, ledger/auditability, and rapid back-to-back changes.

## Execution split and gates
| Gate | Exit criterion | State |
|---|---|---|
| G0 Baseline | Current branch/asset map, full lens/controls inventory, live RPC matrix, legacy acceptance triage, test baseline | ACTIVE |
| G1 Contract | Independent reviewed server and client plan, owner decision on replenishment and high-risk rules | PENDING |
| G2 Server | Approved migrations/RPC contracts implemented and independently verified, permissions and rollback proof | PENDING |
| G3 Client | Single bounded autonomous Claude package in isolated branch; canonical shared files, tests/self-review, draft PR | PENDING |
| G4 Acceptance | Independent responsive screenshots/DOM, functional, security and all-lens acceptance | PENDING |
| G5 Integration | Owner-approved merge, PWA live asset and behavior verification; Electron ships next scheduled release | PENDING |

**Progress denominator:** 0/6 VERIFIED, G0 ACTIVE. Count only independently evidenced gate closures, not code volume or subjective percent.

## Claude client bulk package constraints
After approved G1 contract: analyze every element in all five lenses, inventory title/home/buttons/icons/tables/modals/drawers/form validation/dates/exports/narrow-screen states; compare Stock Checker, Stock & Purchase Explorer and FG Bulk Internal Transfer shared design language. Plan and autonomously implement/fix/test in **one isolated PEC PR** (subcommits allowed). Preserve vendor-wise latest-wins (PR #238), manual indent insertion order, and canonical indent serials. Never silently alter SQL, grants, RLS, service-worker version, or unrelated app modules. No merge or deploy until ChatGPT independent audit and owner approval.

## Operational safeguards
No direct production data/SQL mutation at G0; no default merge or service-worker bump; protect other costing/e-Aushadhi worktrees and pending branches. Existing `IMPLEMENTATION_RULES.md` remains authoritative. Future updates should revise this compact file and existing master/decision ledger only on substantive state changes; no bookkeeping-only PRs.

## G0 next evidence tasks
- Locate PR #58 merged/release and real user acceptance of PDF continuation.
- Capture full five-lens DOM/elements and client RPC-to-UI table, including pagination mechanisms.
- Compare all server `proc_*` relevant RPC signatures, grants, dependencies and actual client actions; isolate writer vs backend-only internals.
- Trace indent creation through vendor-mapping views and snapshot refresh state; verify read-after-write and race handling.
- Inspect draft-edit invariants and PR generation algorithm, then propose precise G1 choices.

## Server Lane A — read-only SQL inspection 2026-11-11

**Evidence: live `qhmoqtxpeasamtlxaoak` function/view definitions, no mutations.**

1. **PR creation.** Public permission-gated `create_pr_from_mrp_plan` calls `create_pr_from_mrp_plan_pec_internal`, which inserts a draft header and line totals from `sum(v_mrp_procurement_plan.procure_qty)` over the selected months, filtered by material class and optional RM procurement scope. The recursive MRP view already incorporates opening stock anchors, consumption, MOQ, month carry-forward/closing stock. No separate explicit replenishment component is present in the PR creator. **Do not add an independent flat reorder quantity to existing MRP output**—first derive demand overlap and incoming-commitment treatment.
2. **Mapping delay diagnosis.** `v_proc_indent_line_buylist_base` reads `proc_indent_line_balance_generation` using the **published** `proc_snapshot_refresh_control.published_run_id`; it only includes approved/issued indents with remaining quantity. `proc_indent_set_status_pec_internal('approved')` calls `proc_request_snapshot_refresh('indent_approved')`, which *enqueues/coalesces* a revision; it does not synchronously publish it. `proc_indent_recommend_and_accept_vendors_step_pec_internal` also requires the **published** balance/vendor candidate views. Therefore an approval can legitimately precede buylist/mapping visibility; waiting for snapshot publication is a real architectural dependency. Current read-only control state at inspection: requested/completed/published revision **110/110/110**, published run **180**, published 2026-11-11 12:13 UTC. Refresh system is currently caught up, but that does not eliminate transient post-approval latency. Need live read-after-write timing/refresh orchestration evidence before choosing implementation.
3. **Draft line editing hazard.** Existing `proc_indent_add_line_pec_internal` uses an UPSERT that **replaces** `requested_qty` for existing (indent, class, item, UOM); blocks only closed/cancelled, while approved/issued require a reason and enqueue snapshot refresh. It does not itself enforce manual/unlinked draft-only scope, and would be unsafe to surface indiscriminately as the new draft edit control. G1 should specify a narrower server writer with row lock, `status='draft'`, `source_pr_id IS NULL` plus no active PR mapping, canonical item/UOM, positive quantity, reason/audit and downstream dependency checks; preserve existing broad legacy RPC semantics unless an independently authorized hardening is demonstrated safe.
4. **Approval.** `proc_indent_set_status_pec_internal` accepts only draft→approved and enqueues refresh; approved→issued; approved/issued→closed; cancellation; business guards are server-side. `proc_indent_create_from_pr_pec_internal` creates draft indents, maps PR and line origin, but does not publish a procurement snapshot at create-time. Hence vendor buying-list access must be presented as post-approval readiness, not instant draft sourcing, unless business policy is explicitly changed.
5. **Vendor recommendation split.** `proc_indent_recommend_vendor_pec_internal` ranks via live `v_proc_indent_line_vendor_ranked` (uses live balance), while bulk step recommendation uses `v_proc_published_indent_line_balance` and `v_proc_published_vendor_item_candidate`. This split needs G1 compatibility/parity evaluation before a targeted workaround. Existing approval auto-recommend helper catches all errors without blocking approval, potentially obscuring failure; investigate call sites and auditability before changing.

**G1 proposed policy decisions, NOT yet approved:** (a) hybrid MRP preview with separate planned-demand and stock-protection projections and anti-double-count guard; (b) targeted draft-only edit RPC(s); (c) server-authoritative snapshot published-readiness contract and client wait/status behaviour without periodic full refresh; (d) preserve approved/issued vendor-action semantics and validate any live-vs-published divergence.

**Status:** 0/6 independently verified; G0 ACTIVE. No deployment, permissions, PR line changes or snapshot refresh requested.
