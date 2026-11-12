# PEC Phase A R2b — shared ERP design-system correction (12 Nov 2026)

Issue #375 (parent #369 / master #284). Client only: `public/shared/procurement-execution-console.{html,js}` and `css/sasv-procurement-execution-console.css`. No SQL, migrations, grants, `public/sw.js`, Electron versions or procurement records. #374 (server Add Line guard) stays separate. **Fixture evidence only. Owner mobile acceptance: NOT YET PASSED.**

Base `integration/pec-erp-staging-20261112` @ `9894213f`; head = this branch (see PR).

## Design decisions (one system, not per-screen patches)
1. **Compact record card (≤640px)** — one CSS mechanism; field priority is declared once in JS (`PEC_CARD_ROLES` → `td[data-role]`): title · status · key number · sub line · inline label/value meta · aux · note · field (controls keep stacked label). Avg card height at 390px: 157px → 68–115px.
2. **`.pec-detail` row-detail modal contract** — header (title/status/Close) → toolbar → scrolling body → optional docked footer. `--page` (PR, Indent: full viewport at all widths), `--panel` (Vendor-wise, Action Queue: centred panel ≥641px, full-width natural-height sheet ≤640px), `--feed` (Acceptance Audit: fixed height so the feed scroller drives loading).
3. **One filter implementation** — previously four (inline script in the HTML, module line filters, Excess, Vendor-wise). Now `bindFilterTrigger` + `enhanceFilterDrawer`: header (title, Close), scrollable body, footer (Clear, Done); full-viewport sheet ≤640px (scroll lock, focus trap, Escape, focus return), anchored popover above. Filters still apply live through the original handlers (server-side filtering, latest-wins, reset untouched). Clear reuses an existing handler (Vendor-wise) or resets to markup defaults.
4. **Search fill in modals** — root cause: `.modal input` (0,2,2) beat `.pec-search-input` (0,2,1). Fixed with a token-based modal rule (dark mode follows the token).
5. **Redundant counters removed** — `#iLinesCount`, `#prLineRange` (markup + JS). Feed status / Load more / end-of-list footers retained.
6. **Vendor-wise whitespace** — cause: full-viewport-height modal around 1 short row. Now natural height up to the full viewport with a docked footer (summary + Close); 40 lines scroll inside the body. **Owner decision needed:** a very short list no longer fills the whole phone screen.
7. **Excess period gap** — summary is a pill with a deliberate gap (≥8px horizontal / ≥4px vertical at all widths).

## Uniformity matrix
| Surface | Card (≤640) | Detail modal | Filter | Search | Counter noise |
|---|---|---|---|---|---|
| PR list / detail | roles: PR Number·Status | `pec-detail--page` | shared panel | lens + line search filled | `prLineRange` removed |
| Indent list / detail | Indent Number·Status (Indent ID aux) | `--page` | shared panel | filled | `iLinesCount` removed |
| Vendor-wise / breakdown | Item·Amount, vendor sub-line | `--panel` + docked footer | shared panel | lens | n/a |
| Action Queue / detail | Item·Qty Pending·Band | `--panel` (rail layout kept) | shared panel | lens | n/a |
| Excess / audit | Item·Net Unalloc, voucher sub-line | `--panel --feed` + footer | shared panel | lens | n/a |
| Nested line filters (PR/Indent) | line cards (Item·Final/Remaining) | inside `--page` | shared panel | filled | removed |
Form/confirm dialogs (create PR/indent, accept excess, vendor select, …) are not row-detail modals; they keep the ≤640px full-viewport + sticky actions treatment.

## Before/after evidence (synthetic data)
`docs/procurement-execution/evidence/pec-r2b/before/` (integration `9894213f`) and `…/after/` — 320/390/820/1440 px: five lists, five filter panels, detail modals incl. `detail-vwl-short` / `detail-vwl-long`; `metrics.json` has computed card/modal dimensions. Full acceptance set: `…/pec-r2b/visual-acceptance/`. R2 evidence folder untouched.

## Tests (this environment, Node 22, Chromium; synthetic stub — not genuine-session acceptance)
| Suite | Result |
|---|---|
| `pec-r2b-ui-smoke` (new) | **396 PASS / 0 FAIL** (cards, 5 detail modals × 4 widths, counters, search fill incl. dark, Excess gap, 5+2 filter panels × 4 widths: keyboard open, anatomy, live re-query, badge, Clear, trap, Escape/focus return, Done/Close) |
| `pec-phase-a-visual-acceptance` | 164 PASS / 0 FAIL |
| `pec-r2-ui-smoke` | 80 PASS / 0 FAIL (Vendor-wise + card assertions updated to the new design) |
| `pec-paging-contract-smoke` | 128 PASS / 0 FAIL (jsPDF from npm; card assertion updated) |
| `pec-erp-c1-layout` 118 · `c2-vendor-selection` 53 · `c1-five-lens-fasttrack` 23 · `narrow-regression` 8 | PASS, 0 FAIL |
| `five-lens-inventory`, `vwl-search-reliability`, `plm-pm-canonical`, `wp01-indent-serial`, `pr-scope`, `resync-mode`, `pr-pdf-continuation-header` | exit 0 (own output format) |
| `pwa-cache-freshness` 13 · `vwl-offset-export-integrity` 6 · `protected-path-guard` 1 | pass, 0 fail |
| `pec-erp-c1-static-smoke` | 16 PASS / **1 FAIL** — "no unauthorized new SQL/SW paths": **pre-existing**, identical on untouched `9894213f` (it diffs against main, which lacks the integration migrations); not caused by R2b |
| `pec-electron-acceptance` | **NOT TESTED** (no electron-builder/node_modules here). Static parity only: the three canonical files are the only PEC copies in the repo |
Not tested: genuine Editor/View-only/no-access sessions, hosted preview, real phones (landscape/keyboard), Windows/macOS builds.

## Fixes found while testing
- Audit dialog loaded two pages eagerly after the 55vh cap was removed → fixed height restored the first-page-only invariant.
- Popover filters did not move focus into the panel; Excess popover clipped its last field → fixed.
- Evidence script overwrote the R2 screenshots once → restored from git; runs now use `--out`.

## Cleanup (proved unused)
Inline `.modal-fullpage` ID rules, `#prLinesScroll` 55vh cap, legacy drawer title/actions/clear CSS, the 520px fixed-drawer rule, the inline `wireFilterDrawer` open/close/outside-click/Escape logic, `toggleExcessFilterPanel`/`closeExcessFilterPanel`/resize closer, per-line-filter open handlers, ID-lists of full-screen modals in the stylesheet.

## Known limitations
- Vendor-wise Export button still sits on its own row on phones.
- Inline legacy CSS remains in the HTML `<style>` (~1,500 lines); only conflicting blocks were removed.
- Server review: none required by R2b.

## Owner hands-on checklist (phone, 320–390px)
- [ ] Card density in all five lenses reads comfortably; status/amount visible without opening a row
- [ ] Row-detail modals look uniform (PR, Indent, Vendor-wise, Action Queue, Audit)
- [ ] Vendor-wise: short and long lists — accept natural-height sheet?
- [ ] Filter sheet in every lens and in PR/Indent line filters (keyboard on-screen, Clear, Done)
- [ ] No `loaded/total` counter after modal searches; Load more still works
- [ ] Modal search field fill, light and dark
- [ ] Excess "last 30 days" gap at phone and desktop
