# Costing UX-F2 — Compact, unified SKU review filters

Status: implementation complete (commit a5008fa, reconciled with main a6d35b9 / WP-07 PR #124); browser and denied-role acceptance OUTSTANDING. Gate 1 usability remediation. Base main 74441b96329887b1e253c509d0154c2c9d869b5c (v390). Owner feedback: 2026-11-01.

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

## Status of acceptance items
Implementation-complete (code and automated tests; verified under LF and CRLF checkouts):
- Compact panel: one slim run row (selector, approved/draft badge, run and date line, ⓘ details disclosure) and one wrapping row of toggle pills with dynamic counts; tall cards, route prose and "Open fix screen" links removed; draft not-for-pricing pill and drawer-evidence alert stay visible.
- One canonical group selection (`setReviewWorklistGroup`) shared by pills, a drawer "Review group" radio section and "Clear group"; filtering stays in the existing `applyFilters`/`applySearch` (no second pipeline, no extra reads); the precise group is never mapped onto broad Status choices; AND composition with Status/Issue/Source/search is shown in a scope note; drawer Clear resets the group and the badge counts it.
- Group invalidated on reload, run, period or lens change; unknown group keys are ignored; flag OFF unchanged.
- Appended, `.rwl-`-scoped CSS: focus-visible, 40px touch targets and bounded disclosure on mobile.
- Isolated-panel render measured with the real CSS (sample 1/110/2/1 rows): 247px to 90px at 1280px width, 710px to 319px at 390px width.

OUTSTANDING (not yet performed; needs the live app, a signed-in session and credentials):
- Browser acceptance in the live app: 900px desktop screenshot, narrow/mobile screenshot, keyboard operation, drawer interaction, draft 148 to approved 143 switch, row modal unchanged.
- Denied-role JWT checks (permission-denied and no-rows states with a role lacking Control Centre read access).
- eslint run (tooling not available in the development sandbox).
- Owner decision: ⓘ details are a native disclosure rather than a hover tooltip.

Merge remains the owner's decision; nothing here approves merge, deployment or flag changes.

## UX-F3 / UX-F4 design decisions (owner live-preview feedback, 2026-11-01)
UX-F3 (commit cff6b5e), accepted in principle:
- The page header already names Approved 143 / Draft 148, so the worklist toolbar repeats no run id, valuation date or approved badge. The run picker is kept. A draft run keeps one short marker ("Draft · not for pricing") so draft identity stays unmistakable.
- Run line, server status and the full drawer-evidence explanation moved into the accessible information disclosure. Because hiding it could blur provenance, a short visible note ("Drawer: run 143") stays beside it and the disclosure control is flagged (warning tone and accessible name) for drafts and any exception state.
- Operational problems (status error, run mismatch, mixed runs, period mismatch, missing status) remain visible outside the disclosure.
- Filter pills became secondary KPI chips (distinct from the global KPI cards).

UX-F4 (owner: saturated chips too intense):
- Chips use subtle tinted fills with dark severity-coloured label and count (red tint for blocker, amber tint for review; label contrast at least 7:1). Selected state: stronger tint, severity-colour border, inset ring and a check mark (never colour alone). Keyboard focus is a separate 2px outline with offset, so focus and selection are distinguishable.
- Four chips spread across the full width as equal flexible grid columns: 4 on desktop, 2 x 2 on tablets (up to 900px), 2 columns with 40px targets on phones (up to 520px). No left-aligned narrow cluster.
- Run selector follows the established Costing control language (control tokens, soft focus ring, native select semantics kept).
- Drawer note, Clear group and the information disclosure form one end group pinned to the toolbar far right (margin-left:auto; own right-aligned row on tablets/phones). The disclosure opens leftwards from the right edge.
- Desktop target: two rows (toolbar + chip row). A third row appears only when a real alert (error) or the filter-composition note applies.
- Unchanged: per-run server-derived counts, run isolation and draft safeguards, the single shared group state used by chips and drawer, row-level modals, flag-OFF behaviour, service-worker cache (v390), WP-07 files and migrations.
- Automated checks added: colour tint/contrast, pressed/focus distinctness, grid and breakpoint rules, selector tokens, end-group markup and two-row structure. Live-browser, keyboard and denied-role acceptance remain outstanding as listed above.

## UX-F5 final corrections (owner live-browser acceptance, 2026-11-01)
Owner live-browser functional acceptance PASSED for: pill filter / drawer synchronisation, same-pill toggle-clear, run 148 and 143 switching, and the row-level modal. Final small UI corrections applied:
- Removed the redundant "Clear group" toolbar button. Clearing is by clicking the active chip again (`aria-pressed` toggles) or the drawer Clear / "All rows"; both are unchanged and tested.
- Removed the redundant "Draft · not for pricing" toolbar badge. The native run selector's option already reads "Run 148 — Draft — not for pricing", and the page header keeps Approved and Draft separate. Status pills remain only for exception states (not approved, status unverified, mismatch, mixed runs). The drawer note ("Drawer: run 143"), the information disclosure and all error alerts are unchanged.
- Run selector: visibly tinted fill from the SASV primary tokens (--sasv-primary-100 resting, -200 hover), primary-300 border, a custom chevron, a soft focus ring, and a distinct disabled state. It remains a native `<select>` (keyboard, screen-reader and mobile-picker behaviour intact).
- Automated checks updated: no Clear control in markup, chip toggle clears, no draft badge while the picker carries the full wording, tint distinguishable from white with dark-text contrast, chevron/padding/hover/disabled rules.
- Still outstanding for the owner or deployment environment: denied-role JWT checks and eslint. No merge, deployment, migration, flag or cache change is part of this work; merge needs separate explicit approval.
