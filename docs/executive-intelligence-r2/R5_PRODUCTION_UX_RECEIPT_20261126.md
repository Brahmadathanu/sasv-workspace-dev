# Executive Intelligence R5 — production UX harmonisation receipt (client)

Implements `R5_PRODUCTION_UX_HARMONISATION_20261126.md` on branch `fix/executive-intelligence-r5-production-ux`, started from assignment checkpoint `ee49e3301ec5138f39cf925c64613df7ae12007c` (main `7e17c91e`). Client only: no server, database, permission, shared stylesheet, shared component, Stock Checker, service-worker or Electron change. **Not formal R5 acceptance.** All evidence below is synthetic-fixture; none of it is owner production evidence.

## Commit identity
| Item | Value |
|---|---|
| Assignment checkpoint | `ee49e3301ec5138f39cf925c64613df7ae12007c` |
| Implementation commit | `d3ff6f3c` (full SHA in the PR) |
| This receipt | the commit that follows on the same branch |
Blobs of the three changed client files at the implementation commit: `executive-mis-dashboard.html` `ec5898296d58d6cafa20ac4daeb0f73e49987419`, `executive-mis-dashboard.js` `fc2156e0120ce41a499a809e9bfdd9c70cdc2abc`, `executive-intelligence-model.js` `6fb6a085b5b5dfa7c7712990b356a0670d096dc3`.

## The eight requirements
**1. Typography, incl. Exceptions > Activity this month.** In the fixture the cell was already 12 px; what the owner sees is a single ~480 px line of 70 characters in one table cell. It is now a compact badge ("No recorded rows") with the explanation as a small 11 px note below it, content bounded to 260 px; a test asserts the computed font of the cell and every descendant (11/12 px) at 1280 and 390. Whole-module sweep: the page body default was an inherited 16 px, so any element without an explicit size (the `font: inherit` buttons: Reset, Retry, Done, Export, and the finance/materials/FG filter-list labels on phones) rendered at 16 px. Body default is now the 13 px token, buttons use the token, phone filter-list labels use the 14 px token, and a test fails if any label, button, table or note renders at an inherited 16 px at 1280/390 in any lens. The 16 px iOS focus-zoom floor on phone inputs and the 16/18 px hero/title steps are kept.

**2. HOME, exact Stock Checker parity.** The page-local SVG, `.home-btn` class and three local `#homeBtn` CSS blocks are removed. The button is an empty `sasv-home-btn` shell that `mountModuleHome` (the shared helper Stock Checker uses) fills with the shared `ui-icons` home glyph and label, and it routes with `Platform.goHome()` exactly like Stock Checker, so PWA and Electron behave identically. Styling is the existing shared `#homeBtn / button.sasv-home-btn` rules already linked through `style.css` (desktop icon + HOME, 6px 12px, 16 px icon, ≤520 px icon only with a visually-hidden label, shared hover and focus ring). Tests: byte-equal DOM to the helper's output, shared padding/gap/icon size, accessible name, focus ring, click leaves the module, and a diff proving `style.css`, `sasv-module-chrome.js`, `ui-icons.js`, `platform.js`, `stock-checker.*` are unchanged. One difference to know about: Stock Checker applies the ≤520 px rules through its own `body.sasv-stock-checker` stylesheet; this page gets the same result from the shared rules, whose measured size at phone width is 30 px wide × 43 px high.

**3. Executive Summary card.** The first clickable cross-functional card now has the heading "Executive Summary" and a subtle fill derived from the semantic tokens (`color-mix(in srgb, var(--mis-accent-soft) 38%, var(--mis-surface))`, no literal colour). All four facts remain links to their lenses, every indicator keeps its provenance control (10 of 10), and loading/error states are unchanged. No figure was added or merged.

**4. Compact summary strips.** The tall chips existed in the Production lens (live batch counts, production-value cards); they are now one narrow segmented strip using the same grammar as the other lenses' metric strips. Values, status badges, captions, basis and scope text are untouched (a test pins every value and the badge/caption text, and that no essential element is `display:none`). The Finance, Materials, Finished Goods and Sales strips were already strips, so those only get tighter phone padding.

Vertical footprint (px, synthetic fixture):
| Region | 390 before → after | 1280 before → after |
|---|---|---|
| Production live counts | 146 → 123 | 58 → 42 |
| Production value cards | 304 → 254 | 104 → 91 |
| Sales month-to-date summary | 350 → 325 | 149 → 149 |
| Materials summary | 324 → 303 | 199 → 199 |
| Finished goods summary | 233 → 223 | 100 → 100 |
| Finance summary | 137 → 131 | 82 → 82 |
The phone strips stay two columns because several carry explanatory sub-text that I did not hide; further compaction would require shortening the text, which I did not do.

**5. Consolidated freshness.** The Overview muted line is removed. The header indicator is a real button (shared dot + relative label on desktop; shared `database` glyph with a state dot at ≤520 px so it never truncates) opening a dialog that separates **Snapshot generation** (executive snapshot time), **Loaded by this page** (live production and sales read times) and **Source refresh** (sales monthly/daily source times and the refresh job's latest run, once the Coverage view has loaded them). States are loading, ok, error (with the failing row marked "Unavailable (could not be loaded)") and unknown; there is **no staleness threshold** (the old 15/60-minute amber/red logic was removed) and the panel says times do not show the import is complete. Sales-only sees only "Loaded by this page" and "Source refresh" for sales, with no executive request. The panel is fixed-positioned, collision-aware (opens above when there is no room below, bounded height with inner scroll, clamped to the viewport), repositions on resize, closes on outside click, Escape (focus returns to the indicator), a second click, and on page scroll; the refresh button and its reload timing are unchanged.

**6. Canonical filter / sort / search.** Order is filter → sort → search everywhere it applies, with the shared `ui-icons` filter and search glyphs (sort is drawn in the same stroke grammar because the shared set has none), one 36 px control size (40 px on phones), a count badge for active filters and `aria-label`/title naming the control. Finance, Materials and Finished Goods: filter then search (they have no server sort, so none was invented); the filter popover now opens rightwards from the leading control. Sales: a single filter control replaces the always-open inline selects on every sub-view (anchor, region, godown, hierarchy, active-SKUs, facility months as before); History gets one sort control (the server's three sort values) that replaces the separate Order select and Top/Bottom buttons, shows the active sort and direction, resets to page 1 and sends the same `p_sort`; Exceptions gets filter + search; Facility and Coverage filter only; Month to date search only. Desktop popovers are bounded under their control; on phones both open as full-page sheets. Escape, Done/close, outside click, focus return and Reset behave consistently.

**7. Whole-module audit.** Reviewed Overview, Finance, Materials, Finished Goods, Production, every Sales sub-view, Alerts, sales-only and denied at 320–1440 by screenshots and by test (no page overflow, no clipped control, compact ladder). Defects found and fixed beyond the reported ones: inherited-16 px buttons and labels, filter drawers opening off-screen once the filter control moved first, a duplicate element id (`salesToolbar`) that would have let the Month-to-date list overwrite the sales toolbar, hidden notices after moving filters into a popover (now a visible notice row), a phone sort/filter re-render closing its own popover, and the sales-only header hiding the freshness control.

**8. Tests and evidence.** See below. Before/after: `docs/executive-intelligence-r2/r5-before/` and `r5-after/` (24 each: every lens plus each sales sub-view at 390 and 1280, full-page); the full post-change set is in `screenshots/` (91, widths 320/375/390/430/520/768/1280/1440, plus filter/sort/freshness popovers and sheets, sales-only, unavailable and failed states).

## Verification
| Check | Result |
|---|---|
| MIS reporting + C1 suites (all `scripts/mis-g7-reporting/*.test.mjs` and `scripts/mis-c1/*.test.mjs`) | **168 / 168 pass**, 0 fail, 0 skipped (150 before; +18 new in `executive-intelligence-r5.test.mjs`) |
| New R5 suite | HOME shared-component parity (static and rendered glyph/dimensions/focus/routing), Executive Summary, freshness for both roles with real timestamps, loading, error and unknown, viewport containment at 8 widths with resize/scroll/Escape/outside click, Activity cell computed font, canonical control order/size/glyph/sort behaviour on every lens, phone sheets, strip value equivalence and footprint, whole-module overflow audit, unchanged sales-only/denied, token-only CSS, shared files byte-identical to the checkpoint |
| Protected-file diff vs checkpoint (`sw.js`, `public/shared/css`, `sasv-module-chrome.js`, `ui-icons.js`, `platform.js`, `stock-checker.*`, `supabase`, `electron`) | **0 files changed** |
| WP10/PEC guard suites (`wp10-g2-safeguards/source.test.mjs`, PEC path guard, WP09 SW pin, PWA cache freshness, WP10 release contract) | 39 / 41 pass. `wp09-protected-sw-pin` fails identically at the checkpoint (a WP09-branch-pinned `sw.js` hash, file untouched). **S4 fails for this branch — see the decision below.** |
| Not run | Server PostgreSQL suites (no database access here; server untouched), Electron build |

## Decision needed: exact guard delta (not applied)
`main` carries an exact-blob owner approval (`scripts/wp10-g2-safeguards/ei-approved-delta.mjs`) pinned to the earlier branch `claude/upbeat-lovelace-tdc1jm` and to the previous blobs. Because R5 changes three of those files, WP10 S4 ("no new … route in the client package") rejects them on this branch. The assignment allows a new branch-specific exact delta only if necessary, so I prepared one — additive, leaving the earlier allowance unchanged — but the permission layer **blocked me from editing that PEC/WP10 enforcement file**, so I did not apply it and did not work around the block. The change, for you or the integrator to apply (pins are the committed blobs at `d3ff6f3c`):

```js
export const EI_R5_BRANCH = "fix/executive-intelligence-r5-production-ux";
export const EI_R5_CLIENT_BLOBS = Object.freeze({
  "public/shared/executive-mis-dashboard.html": "ec5898296d58d6cafa20ac4daeb0f73e49987419",
  "public/shared/js/executive-mis-dashboard.js": "fc2156e0120ce41a499a809e9bfdd9c70cdc2abc",
  "public/shared/js/executive-intelligence-model.js": "6fb6a085b5b5dfa7c7712990b356a0670d096dc3"
});
// eiClientApproved: keep the existing EI_BRANCH clause and add
//   || (branch === EI_R5_BRANCH && Object.hasOwn(EI_R5_CLIENT_BLOBS,path) && committedBlob === EI_R5_CLIENT_BLOBS[path])
// (workingBlob === committedBlob still required). module-registry.js and mis-evidence-report.js are unchanged by R5, so need no pin.
```
Any later edit to those three files invalidates the pins and they must be recomputed (`git rev-parse HEAD:<path>`).

## Cache delivery review
The page HTML is served network-first by the existing service worker, but `executive-mis-dashboard.js` and `executive-intelligence-model.js` are **not** in its network-first list, so they are cache-first by full URL. Module-local cache keys therefore carry delivery: the HTML now loads `executive-mis-dashboard.js?mis-c1=ei-r6-1` and that file imports `executive-intelligence-model.js?ei-r6=1` (both bumped; pinned by a static test), so an installed PWA that fetches the new HTML requests new asset URLs. The newly imported shared `sasv-module-chrome.js` and `ui-icons.js` are unchanged shared files and are fetched normally. No shared service-worker change is needed; I made none.

## Residual issues and limits
- The strips on phones remain two columns because several metrics carry explanatory sub-text that must stay visible.
- HOME's phone box (30 × 43 px) is whatever the shared rules produce; it was not forced to a different size to avoid diverging from Stock Checker.
- Sort is offered only on History (the only contract with a server sort); other lenses intentionally have none.
- The freshness panel shows sales source times only after the Coverage & refresh view has loaded them (no extra request is made for it).
- Tests use the in-page Supabase mock; real-session behaviour is unverified.

## Real-session acceptance checklist (owner; not yet performed)
Use signed-in PWA sessions (and Electron only after a separate approved release) for an executive, a sales-only and a denied account, at a desktop width and a phone width.
1. **HOME**: identical look, size, hover/focus and behaviour to Stock Checker; icon-only on a phone; returns to the launcher in PWA and Electron.
2. **Overview**: "Executive Summary" card titled and lightly filled; four facts open the right lens; no "Summary snapshot refreshed …" line; all provenance (i) controls still open.
3. **Freshness**: header indicator opens a panel that is fully inside the screen on a phone and desktop, separates snapshot / loaded-by-page / source refresh, shows real times, closes on Escape, outside click and scroll, returns focus; Refresh still reloads. Sales-only shows only sales items and requests nothing executive. Force a failure to see the error row.
4. **Exceptions**: "Activity this month" is a small badge with a small note; text size matches the other cells.
5. **Filters/sort/search**: on Finance, Materials, Finished Goods, Month to date, History, Exceptions the order is filter → (sort) → search with the same icons and size; History sort changes the order and returns to page 1; filter count appears when a filter is active; phone filter and sort open full-page and close with Escape/Done.
6. **Production**: live-count and value strips show the same numbers, badges and captions as before in less height.
7. **Whole module**: no oversized text or clipped control in any lens or sales sub-view at 320–1440; sales-only and denied behave as before.
8. After the guard decision above is applied, CI for this PR should show WP10 S4 passing; R5 formal acceptance, Electron release and Sales Viewer retirement remain separate gates.
