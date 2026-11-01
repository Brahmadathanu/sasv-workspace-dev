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

## What was NOT verified (honest limits)
- The harness uses an empty-data fake backend, so data-heavy tables, the row details modal, loaded charts and the permission-denied states were not exercised with real rows. Page-level overflow is therefore proven for the page chrome, toolbars, tabs, selects and drawer, not for every populated lens. Wide tables already sit inside scroll containers.
- Run-status chip wording and the loading state were observed only as rendered by the fake ("Run status unavailable").
- No physical device or Safari/Firefox test; Chromium only.
- Inline-style clean-up (second half of the original CW-13 description) is deliberately not attempted: no defect was demonstrated, and changing 27 to 99 inline styles per page would be the wholesale restructuring the work package excludes.
- Touch-target size: header icon buttons are 28 px at ≤ 520 px (above the WCAG 2.2 minimum of 24 px, below the 44 px comfort size); left as designed, flagged for an owner decision.

## Tests
`scripts/costing-responsive/responsive.test.mjs` (7 tests): harness covers exactly the six route pages and five widths; the CSS block is one appended, `body.sasv-`-scoped, token-only block without `overflow-x: hidden` or `!important`; header wrap rules; focus outline rule; detector self-test (overflow, clipped title and overlap are really detected on synthetic pages); browser run over all 30 cases; focus-visibility run at 390 and 1280 px.

## Owner acceptance
Windows CMD (needs Playwright installed): `node --test scripts\costing-responsive\responsive.test.mjs`. Manual: open each suite at a phone width (browser device toolbar, 390 px): the title must be fully visible, the filter button must show a clear ring when tabbed to, and the header actions may sit on a second row.
