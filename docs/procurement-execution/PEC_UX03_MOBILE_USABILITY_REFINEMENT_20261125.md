# PEC-UX03 — Purchase Allocations mobile usability and visual refinement

Base: v6.5.0 (`a72af1e`, `hub-cache-v395`), unchanged on main when work started. Client-only; no server, RPC, migration or data change.

## Findings (reproduced on the released build at 375/390/430/820/1440)
- At 390x844 the first indent card started at 594 px: the date segment, date pickers, range label, summary table, notes and a wrapped export button all sat above the data.
- Purchase Allocations used its own date panel and a separate title card; other lenses use one toolbar row (filter, search, actions).
- Vendor-wise Buying List also spent a full row on a lone export icon on phones.

## Design (reused, not reinvented)
- Filter panel: the existing shared `.pec-filter-drawer` anatomy (`enhanceFilterDrawer`, `openFloatingFilterDrawer`, `positionFloatingFilterDrawer` in `procurement-execution-console.js`; CSS section 3 of `sasv-procurement-execution-console.css`). Full-viewport sheet at <=640 px (header + close, scrolling body, footer, `100dvh`, safe-area, body scroll lock), anchored popover above. Escape and layering stay with `pec-modal-stack.js` transient sources; no new handler or z-index.
- Small shared extension: a drawer marked `data-pec-footer="apply"` gets Reset / Apply filters, fires a cancelable `pec-filter-apply`, and `pec-filter-open` (owner re-syncs its draft). `toggleFilterDrawerFrom` lets several triggers share one panel. Other drawers are untouched.
- Purchase Allocations: voucher period (Today/Yesterday/Date/Range + pickers), class, indent, vendor, status live in that single panel; draft is separate from applied state; Apply commits atomically (`applyFilters` reducer action, one request); invalid/reversed ranges block Apply with an inline message and send nothing; close/Escape discards the draft; Reset restores Yesterday + no filters (then Apply). Search stays live in the toolbar.
- Toolbar: [filter][search][export] row (same as other lenses) + one strip: view selector, applied-period indicator (`Yesterday · 23 Nov 2026`, `1–23 Nov 2026`; opens the same panel anchored at itself, focus on the period section), Allocation Summary toggle, count.
- Allocation Summary: collapsed by default; expands to the full existing figures per UOM (purchased, effective, allocated, matching-indent allocated when an indent filter is active, unallocated, accepted excess, net unallocated), receipt/indent/line counts and the coverage, reconstructed-balance and no-cross-UOM notes. Wraps without horizontal scrolling. Toggling reloads nothing. Quantities are server values; no client recalculation.
- Indent cards compacted to two lines; reconstructed-balance disclosure remains inside expanded indent lines, drill-downs and exports.
- Other lenses: Vendor-wise Buying List export moved into its toolbar row (same IDs/menu). Other lenses already matched the reference toolbar; left intact.

## Measurements (synthetic fixtures; `scripts/pec-ux03-measure.mjs`, top of first data row, includes unchanged app header/tab selector)
| Viewport | Before | After | Reduction |
|---|---|---|---|
| 375x812 | 594 | 276 | 53.5% |
| 390x844 | 594 | 276 | 53.5% |
| 430x932 | 572 | 269 | 53.0% |
| 820x1180 | 566 | 343 | 39.4% |
| 1440x900 | 543 | 297 | 45.3% |
At 390x844, Material-wise shows 7 and Vendor-wise 6 substantially visible cards (before: 3). No horizontal overflow at any size. Remaining constraint: ~170 px app header/tab selector above every lens (shared, out of scope).

Evidence: `docs/procurement-execution/evidence/pec-ux03/{before,after}` (per-mode screenshots, six-lens set, filter sheet, anchored panel, summary expanded, drill-downs; `measurements.json`).

## Verification
`pec-purchase-allocations-ui-smoke` 115 checks (was 88; adds panel location, same-panel triggers, draft/apply/reset, specific/range, invalid range, one-request apply, sheet geometry, focus return, collapsed/expanded summary, pre-data height <=386 px); model tests 25; contract parity, modal-stack smoke, paging, VWL, five-lens inventory, C2/fast-track/R12/resync/serial/PR-scope smokes, PWA freshness and protected-path guard pass. Pre-existing, identical on the unmodified v6.5.0 tree: `pec-erp-c1-layout-smoke` (4 checkbox-size checks) and `pec-erp-c1-static-smoke` (reports CRLF-normalised migration files in this checkout). Not performed: authenticated PWA or real-device/Windows acceptance.

Owner acceptance (consolidated, install the latest patch only): phone PWA/Windows — open Purchase Allocations; confirm period chip, filter sheet (full page on phone, anchored on desktop), Apply/Reset, summary expand, three modes, drill-down and Open indent return, CSV/print.
