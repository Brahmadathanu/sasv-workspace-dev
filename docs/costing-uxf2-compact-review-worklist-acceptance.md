# Costing UX-F2 — Compact, unified SKU review filters

Status: implementation pending; Gate 1 usability remediation. Base main 74441b96329887b1e253c509d0154c2c9d869b5c (v390). Owner feedback: 2026-11-01.

## Problem
UX-F1 puts four tall worklist group cards above the SKU Control Status table when `COSTING_REVIEW_WORKLIST_V1=1`, reducing visible rows. Cards repeat filtering available in the drawer and offer separate 'Open fix screen' links although row-level in-page diagnosis/fix modals already exist.

## Desired behavior
1. Preserve the approved-run-143 / newer-draft-148 distinction. Only the selected draft's 628 SKU rows determine counts (1 Material Cost Blocked, 110 Prime Cost Review, 2 Material Review, 1 Pricing Bridge Review); counts are sample evidence, NOT hard-coded. Approved 143 KPI strip is still 627/627 and MUST never be relabeled as draft counts. All run/date facts from server.
2. Compact review panel: one slim row with run selector, approved/draft badge, selected-run date and a short explanatory icon/popover; one horizontally wrapping row of accessible clickable category pills with dynamic counts. Remove the tall cards, route descriptions, and redundant 'Open fix screen' links. Keep explanatory text in an accessible tooltip or detail disclosure without permanently expanding the panel. No hidden loss of essential caveats, draft not-for-pricing warnings, or permission errors.
3. Pill click filters SKU table immediately; click active pill again clears it; keyboard activation, focus-visible, accessible name and pressed state. Reuse the existing table search/filter and row resolution logic; do not create a second divergent filter pipeline or duplicate API calls.
4. Drawer and pill selections must be coherent: visible group selection reflected in both controls where semantically representable. Do not incorrectly map a precise first-control group to a broad status group. Where group-specific filters do not fit existing status/issue/source choices, provide one canonical compound filter predicate used by drawer and pills (or expose the precise first-control choice in the drawer). Document/reset cross-filter composition and show when other filters are active.
5. Preserve existing row-level modal; no direct navigation from the summary. Preserve routes in row actions and draft/run/period context.
6. Switching selected run, period, lens or reloading invalidates stale group selection and late responses. Loading/error/permission/no rows states remain explicit. Default flags OFF, no UI change in flag-OFF case.
7. Reduce panel height enough that materially more SKU rows appear at a 900px viewport; no unbounded header height on mobile. Avoid side effects to other lenses.

## Existing architecture (inspect before edits)
- `public/shared/js/costing-review-worklist.js`: `renderReviewWorklistHtml` currently produces `rwl-card` list and `data-rwl-select` and `data-rwl-open`.
- `public/shared/js/costing-suite-shell.js`: `REVIEW_WORKLIST_GROUP`, `reviewWorklistSelectedKey`, `renderReviewWorklistPanel`, `applyFilters`, `applySearch`; drawer uses `ACTIVE_FILTERS` status/issue/source and `syncFilterCheckboxes`. Group is currently a separate precise predicate in `applySearch`, not automatically equivalent to drawer statuses. Explicitly reconcile semantics, do not casually assign ACTIVE_FILTERS.status.
- `public/shared/css/sasv-costing.css` has `.rwl-` styles. Maintain append-only/scoped strategy if possible; preserve prior WP07 and UX-F1 tests.

## Tests and gates
- Add focused unit/DOM tests for count labels, selected pill, toggling, drawer synchronization/semantics, draft-vs-approved, disjoint run/period resets, non-matching groups, a11y, no fix links and row modal unchanged.
- Existing 308 Costing tests, scope guard, relevant e-Aushadhi/PEC/pricing smoke tests must pass on LF and CRLF; update prior large-card assertions only for intentional UX-F2 differences without weakening security/business assertions.
- Browser acceptance: 900px desktop screenshot, narrow/mobile screenshot, keyboard, drawer, draft 148 to approved 143 switch, row modal and denied-role JWT checks.
- No migrations, DB writes, run approvals, deployments, feature-flag flips or merge; protected `20261015045233_ppm_inactive_sku_mrp_policy_governance.sql` NEVER touch. User is sole final merge approver.
