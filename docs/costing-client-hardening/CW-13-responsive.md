> **Merged update — 2 Nov 2026:** PR #127 was squash-merged as `86b4ad5e326fa9ceae32f3d8c042901eddab6066`, following owner acceptance of the compact 390px header and run-status popover. Its 385/385 post-#126 and the 393/393 reconciled head tests (LF/CRLF) were Claude-reported. Final `main` retest and live deployment confirmation remain separate checks. The old draft/branch wording below is historical.

# CW-13 — Responsive hardening of the six Costing suites

Branch `feat/costing-cw13-responsive`, baseline main `28cfadb20de3e2f3daf0aadada096f541254819d`. Draft; not merged.

## Method (reproducible, no network, no Supabase)
`scripts/costing-responsive/responsive-audit.mjs` serves `public/` from disk, replaces the Supabase ESM module and the jsPDF CDN with inert fakes (view-only fake permissions, empty data, no writes) and loads each of the six pages (Costing Control Center, Cost Build Manager, Cost Sheet Review, Material Cost Manager, Pricing Policy Manager, Production Route Manager) at 390, 520, 768, 900 and 1280 px. It reports page-level horizontal overflow and its culprit elements, a module-title clipped by its own box, overlaps between the header title / subtitle / actions / run-status chip, and keyboard focus visibility (Tab through the first 14 controls; every control that is `:focus-visible` must show an outline or ring), and writes screenshots.
```
node scripts/costing-responsive/responsive-audit.mjs --json out.json --shots shots/
COSTING_AUDIT_ROOT=<other checkout> node scripts/costing-responsive/responsive-audit.mjs ...   # baseline comparison
```
Playwright (chromium) is required; the test file skips browser checks cleanly when it is missing (`COSTING_RESPONSIVE_SKIP=1` skips explicitly).

## Findings (baseline `28cfadb`, 30 page/width cases) and result
| Check | Baseline | After |
|---|---|---|
| Page-level horizontal overflow | 0 | 0 |
| Header overlaps | 0 | 0 |
| Module title clipped / run under the header actions | 6 cases: Control Center 390 and 520, Cost Sheet 390 and 520, Material Cost 390, Production Route 390 | 0 |
| Keyboard focus without a visible indicator | 31 findings, all the filter button (`#peqFilterBtn`, which only changed background by about 3 % on focus) on every page and width | 0 |

At 390 px the long titles ("Costing Control Center", "Cost Sheet Review & Approval", "Production Route Manager") were nowrap and ran underneath the action buttons and the compact run-status chip (screenshots in `evidence-cw13/header-390-before.png` versus `header-390-after.png`, top 260 px of each page, in the order Control Center, Cost Build, Cost Sheet, Material Cost, Pricing Policy, Production Route). Raw measurements: `evidence-cw13/audit-before.json` and `audit-after.json`.

## Fix (CSS only, appended, scoped, tokens only)
`public/shared/css/sasv-costing.css`, one appended block "CW-13":
- at ≤ 520 px `.page-header` may wrap: the title block keeps at least 10 rem, otherwise the actions move to their own right-aligned row; the title wraps normally instead of clipping;
- `:focus-visible` outline (2 px, `--sasv-action-primary`, 2 px offset) on `.peq-filter-btn` and `#prmAsOfDate`.
No HTML restructuring, no change to table scrolling, no `!important`, no new colours, no JavaScript, `hub-cache-v390` untouched.

## Follow-up: clipped Home button (owner preview acceptance, 2 Nov)
- **Reproduction.** The first audit used the fake backend's short chip text ("Run status unavailable"), so it missed this. On the real pages the run-status chip carries a longer label (approved run, newer draft, valuation date). `responsive-audit.mjs --stress-chip` sets the chip to `"Approved run 143 · Draft run 148 · valuation 31 Oct 2026"`, and the harness now also reports `clippedActions` (any header button or chip whose right edge is beyond the header or the viewport). Baseline with the stress chip, 30 cases: 15 cases failed; at 390 px the Home button was pushed completely off screen on all six pages and the page scrolled horizontally (scrollWidth up to 523 px at 390 px width); Cost Sheet Review also failed at 520 and 768 px. Evidence: `evidence-cw13/home-button-stress-390-before.png`, `stress-before.json`.
- **Cause.** `.sc-run-status` is `white-space: nowrap` with no width limit and the header actions row (`.page-header > div:last-child`) cannot wrap, and the Cost Sheet page sets it to `flex: 0 0 auto`.
- **Fix (CSS only, same appended block).** The actions row may shrink (`min-width: 0; max-width: 100%`), wraps and right-aligns at ≤ 900 px, and the non-compact chip is capped to the row with an ellipsis (the full text stays in its `title`). Result: 0 clipped actions and 0 page overflow in all 30 stress cases and all 30 normal cases (`evidence-cw13/home-button-stress-390-after.png`, `stress-after.json`). Trade-off: with a long chip the header can use up to three short rows on a phone (title, actions, chip and status).
- **Other five suites** are covered by the same 30-case run (stress and normal) and are clean.

## Follow-up 2: shared compact mobile header, status button, freshness chip retired (owner review comment, 2 Nov)
Owner request: after the Home fix the header grew to 3 lines on phones; make all six Costing modules compact without a broad redesign.

| Requirement | What changed | Where |
|---|---|---|
| Smaller heading at <= 520 px, full accessible title kept | `h1.sasv-module-title` 18 px to 13 px, wraps normally; the `<h1>` text, `<title>` and landmarks are untouched | `sasv-costing.css` CW-13 block |
| Same-row heading + actions at 390 px, safe wrap on extreme cases | header/actions on one row; the title may shrink to 6 rem before the actions wrap (320 px, large zoom, very long titles); header controls are 32 x 32 px (WCAG 2.2 minimum is 24 px) | CSS |
| Replace the large run-status badge visually on mobile with a status-coded, keyboard-accessible SVG button + popover | new `costing-run-status-popover.js` (loaded by the six `*-entry.js` files): icon button after the badge, shown only at <= 520 px and only once it exists; popover with state (APPROVED / DRAFT / approved-with-newer-draft / no status), label, displayed / approved / newer-draft run ids, valuation dates, and an explicit "Not approved ..." warning for any non-approved state. Click, Enter, Space; Escape closes and restores focus to the button; outside click, viewport change above 520 px and badge-hidden also close it; the popover is clamped inside the viewport | JS + CSS |
| Preserve desktop semantics and authoritative status/run binding | the badge element (`#costingRunStatusBadge`, `role="status"`) stays in the DOM and keeps its label, `title`, `data-tone`; nothing is fetched or computed by the popover, everything is read from the badge. Above 520 px the button is `display: none` and the chip is unchanged | JS + CSS |
| Run ids and valuation dates from the governed row | `costing-run-status-badge.js` gains an additive helper `applyRunStatusDataset` that writes `data-display-state`, `data-run-displayed`, `data-run-approved`, `data-run-draft`, `data-valuation-approved`, `data-valuation-draft` from the same row that produces the label (cleared when absent). No selected column, query, label or flag logic changed; valuation dates appear only when the row carries them (those columns are selected only when the approval flags are ON, so they are absent with flags OFF) | `costing-run-status-badge.js` |
| Remove the `lastRefreshed` elapsed-time green-dot/status UI on all six pages; keep Refresh | `body.sasv-costing #lastRefreshed { display: none }`. `#refreshBtn`, the refresh RPC, data loading/error handling, cron and run status are untouched. See the reference audit below | CSS |

**Reference audit for `lastRefreshed` (done before deciding how to remove it).** In the Costing shell (`costing-suite-shell.js`) the element is read by `$("lastRefreshed")` (module constant), `setVisible(lastRefreshed, ...)` (twice, null-safe), `lastRefreshed?.querySelector` / `lastRefreshed?.addEventListener` (optional chaining), `updateFreshnessIndicator`, `closeFreshnessDetail`, `toggleFreshnessDetail` (all start with `if (!lastRefreshed) return` or an `if (!lastRefreshed || !detail) return`), a 60 s `setInterval(updateFreshnessIndicator)`, and most importantly `createRunStatusBadge({ supabase, anchor: lastRefreshed })`: the run-status badge inserts itself *before* that element, so **deleting the node would silently stop the badge from appearing**. `execution-gate.js` and `executive-mis-dashboard.js` also use the id but belong to other pages and are not touched. A smoke script (`wp04-readiness-client-contract-smoke.mjs`) inspects the page CSS for `#lastRefreshed .sc-snapshot-label`. Decision: hide the element with CSS and keep it as an inert anchor (not rendered, not focusable, not announced: `display: none`), with no change to the shell or the six HTML pages, so no null crash is possible and the identity tests that protect the shell stay valid. Side effect to note: the "Refresh required" text that the dirty state wrote into that label is no longer visible; the Refresh button keeps its `costing-refresh-dirty` class, `data-refresh-required` and explanatory title.

**Measurements (`--no-focus` audit, six pages).** Header height at 390 px: 88 px to 47-50 px for the pages that show the status chip (control center and cost sheet) and 47-60 px to 47 px for the others; at 320 px: 129 px to 50-66 px. Same-row title/actions: 8 of 12 cases before, 12 of 12 after (320 and 390). Heading size 18 px to 13 px. Controls 36 px to 32 px (all >= 24 px). Freshness chip rendered: 12 of 12 before, 0 after. Full run, 6 pages x 6 widths (320/390/520/768/900/1280) = 36 cases, normal and with the long run-status text: 0 page overflow, 0 clipped actions, 0 clipped titles, 0 overlaps, 0 page errors. Evidence: `evidence-cw13/mobile-header-390-before.png` / `-after.png`, `mobile-header-320-before.png` / `-after.png`, `status-popover-390.png`, raw `header-before.json`, `header-final.json`, `header-final-stress.json`.

**CW-07 note.** The title on the Cost Sheet page reads "Cost Sheet Review & Approval" on this branch; it becomes "Cost Sheet Review" (and fits more easily) when PR #128 is merged. No label is changed here.

**Tests added** (`responsive.test.mjs`): CSS contracts (compact header, status button, freshness retirement, shell unchanged, entry imports); popover content and tones; dataset helper; browser: six pages at 320/390/520 (one row, <= 14 px title, >= 32 px controls, no freshness chip, Refresh present, no errors), above 520 px unchanged, status button replaces the chip on run-scoped pages; keyboard and mouse popover (Enter, Space, Escape with focus restoration, outside click, live status updates through the real badge functions, hide with the badge); popover inside the viewport at 320 px and closes when crossing 520 px; worklist flag ON and OFF both feed the button; Refresh remains and the retired chip is never focusable.

## What was NOT verified (honest limits)
- The harness uses an empty-data fake backend, so data-heavy tables, the row details modal, loaded charts and the permission-denied states were not exercised with real rows. Page-level overflow is therefore proven for the page chrome, toolbars, tabs, selects and drawer, not for every populated lens. Wide tables already sit inside scroll containers.
- Run-status chip wording and the loading state were observed only as rendered by the fake ("Run status unavailable").
- No physical device or Safari/Firefox test; Chromium only.
- Inline-style clean-up (second half of the original CW-13 description) is deliberately not attempted: no defect was demonstrated, and changing 27 to 99 inline styles per page would be the wholesale restructuring the work package excludes.
- Touch-target size: header icon buttons are 28 px at ≤ 520 px (above the WCAG 2.2 minimum of 24 px, below the 44 px comfort size); left as designed, flagged for an owner decision.

## Tests
`scripts/costing-responsive/responsive.test.mjs` (23 tests): harness covers exactly the six route pages and five widths; the CSS block is one appended, `body.sasv-`-scoped, token-only block without `overflow-x: hidden` or `!important`; header wrap rules; focus outline rule; detector self-test (overflow, clipped title and overlap are really detected on synthetic pages); browser run over all 30 cases; focus-visibility run at 390 and 1280 px.

## Owner acceptance
Windows CMD (needs Playwright installed): `node --test scripts\costing-responsive\responsive.test.mjs`. Manual: open each suite at a phone width (browser device toolbar, 390 px): the title must be fully visible, the filter button must show a clear ring when tabbed to, and the header actions may sit on a second row.
