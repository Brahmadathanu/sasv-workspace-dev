# CCC information architecture and layout correction — decision brief
Date: 1 November 2026. Status: DESIGN/EXECUTION BRIEF ONLY; no feature rollout or retirement.

## Evidence from real browser acceptance
User screenshots of October 2026 show draft run 148 correctly selected with 628 rows (1 blocker, 113 review, 514 ready); approved run 143 shows 627 ready. Run 148 worklist displays raw-looking stacked text with no effective hierarchy and large vertical occupation. Header run badge repeats verbose status; global KPI strip continues to describe governed approved run 143 when worklist switches to 148, creating a serious context ambiguity. Browser access positive-path is partially demonstrated, not full UX or negative-role acceptance.
GitHub main: 9c189d60967c2efd3b99f4703416eb22123d96e2, v388. Back end: approved 143, draft 148. Preserve the existing approved/pricing run invariant.

## Earlier governing decision
WP05 parked item CCC-P01: SKU Control Status ↔ Portfolio Readiness rationalisation candidate; evaluate superset and dependencies before retirement. CCC-P02 covers wider duplication. WP04 preserved separate Dashboard, Workbench, SKU Control Status, Readiness with different loading/data contracts; do not erase server views or change keyset-paged readiness merely to make UI uniform. User preferences: keep global KPI strip; avoid duplicate in-lens KPI chips; one adaptive filter and Stock-Checker-style continuous/infinite tables; preserve distinct remediating specialists.

## Target information architecture (conditional destination)
1. Dashboard: governed period summary, approved and draft run identities, valuation, readiness metrics, explicit context title and one concise call-to-action per exception group. Show status in small two-line cards with responsive wrapping; use 'Approved 143' header chip or compact info icon, never long live badge in global portrait header. Provide 'Review draft 148' navigation to diagnostic lens (not an automatic approval). Display approved KPIs under explicit 'Approved run 143' heading. If showing draft KPIs, identify them separately, no mixed denominators.
2. Readiness: canonical SKU-level searchable investigation after parity audit: run selector, status/severity filters, grouped issue categories, recommended route, detail drawer, fix links. Must preserve governed snapshot vs historical run semantics. Ensure readiness keyset pagination server-authoritative; do not replace with an all-rows client snapshot or accidentally drop SKU actions.
3. Control Workbench: material/operational review and correction routing, not duplicated portfolio summary.
4. SKU Control Status: current operational diagnostic source retained until WP05 parity and dependency audit passes; then retire only redundant *client tab* with explicit separate release decision. No premature drop of views/RPCs or route aliases; preserve deep links.

## Immediate UX correction (before retirement)
- Give C1B worklist an actual responsive visual design: compact run-selection toolbar, one-line 'Draft run 148 • Not for pricing' status, short frozen-data info disclosure (popover/details), single visible contextual drawer warning, rows/groups as compact summary cards with severity count and one primary action. No long multiline prose as default.
- Global header: shorten approved/draft status badge to 'Approved 143' with secondary accessible details from Dashboard; do not simply hide whether a newer draft exists. On narrow view: truncate appropriately, wrap only in Dashboard.
- Global KPI strip remains approved-run-scoped; label this once and never make 143 KPIs appear as 148 KPIs. Draft run totals belong to the draft-review context.
- True category labels not raw codes; preserve accessibility, keyboard, colour-independent status, semantic native controls.
- Search and fix navigation remain unchanged; do not fabricate missing line evidence or dedicated COST_REVIEW_WORKBENCH links.
- Retain flag-off baseline, rollback and old view until acceptance. Consider separate 'run-context UI' flag only if necessary to avoid breaking other work; no unnecessary flag sprawl.

## WP05 parity matrix required before retirement
Compare all SKU Control Status capabilities (full snapshot severity, first control, route notes, grouped counts, period selector, run-aware frozen snapshots, drawer and fix link, full filter/search, export, SKU navigation and permission boundary) against Portfolio Readiness (server-side keyset paging, scope and batch behavior). Confirm parity and performance and get real user approval. Only then remove duplicate tab in a controlled client PR; never delete backing views without dependency analysis.

## Acceptance and workflow
Package UX-F1: dashboard run-context + compact header + responsive worklist CSS; test desktop and portrait, approved/draft labels, no mixed-run KPI, regression, screen readers. Package WP05-P01: readiness functional-parity inventory, integration proposal, migration strategy, then owner-gated retirement. Keep implementation separate from historical run-148 root-cause investigation (blocked by detailed evidence and review-route contracts).
Real-browser screenshots establish positive-path loading only; denied-role test pending. No feature flag activated globally, no costing run designation altered. Gate 1 is not closed. 3/10 programme acceptance gates passed.