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
