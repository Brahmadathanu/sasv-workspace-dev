# EI R5 dashboard maturity: receipt (client only)
Branch `fix/executive-intelligence-r5-dashboard-maturity` from checkpoint `222d096`. Production edits: the three EI page-local files only. No SQL, RPC, permission, shared CSS, service-worker, Electron or guard-file change; migration line-ending noise untouched. Synthetic-fixture evidence only; owner acceptance remains open.

## 1. Redundancy removed
No chart block sits under KPI chips any more. Comparison is a thin inline bar inside the indicator or tile that already carries the figure (Overview finance/stock/production, Finance tiles, Materials category tiles, Production counts, Sales comparison/windows/facility/history value cells). Figures appear once; the bar has a text equivalent (`aria-label`) and one caption per Overview group states the basis (different valuation bases never added; stages do not overlap; overdue is a subset). FG statuses are one stacked bar with a count legend (the three duplicate tiles are removed when the bar is drawable). Alerts keep one compact state bar.

## 2. Compact record cards
Studied Stock Checker's result card (title, compact secondary line, chevron, tap opens a detail dialog). At <=640px each record table is **replaced** (not duplicated) by a card: title, secondary identity, one primary measure, 1-2 key values, one critical status chip. Per-lens metadata (finance party, materials, FG, MTD, comparison, windows, history, exceptions, coverage, facility, alerts). The in-page detail dialog (full-page on phones, Escape/close/back, focus trap, focus restored to the card) lists every field of the record built from the same rendered cells: no new request, no information loss, drill actions still work. Finance cards open the existing bill dialog. Desktop tables and the History month grid (contained scroll, hint) are unchanged. Card heights are asserted (<=130 px vs the stacked cards' ~300 px).

## 3. Overview and lens analytics
Overview indicators carry integrated bars; Sales shows a 12-month trend (one bounded `ei_sales_history` call, group month, only when the full series arrives; gaps, unavailable and the partial anchor month are marked; no call for denied users). Sales Viewer's line/bar analytics informed the trend; no chart library added. Lens summaries are shorter (no chart blocks under strips).

## 4. Infinite scroll (verified contract)
All installed list/history/exception RPCs are offset/limit with a deterministic ORDER BY and a total, so incremental append is valid (history/exceptions cap offset at 20000 server-side; the client stops at the reported total). Paginator, page numbers, Previous/Next and loaded counters are removed.
| Surface | Mechanism |
|---|---|
| Finance, Materials, Finished Goods, Sales month-to-date | one shared path: IntersectionObserver on the table wrap, one request in flight, latest-wins token shared with reset, identity dedup, terminal on total/short/empty chunk, failed chunk keeps rows with Retry for the same offset, reset (filter/search/lens) goes to top |
| Sales History, Exceptions | same, accumulating rows in the response; scroll position preserved; export relabelled "Export loaded rows" and the CSV scope line states the loaded count and has_more |
| Not applicable | Overview, Alerts, Coverage/Facility/Comparison/Windows (bounded, unpaginated); finance bill details (unpaginated) |
Observers are disposed on lens change and pagehide; no IntersectionObserver gives a Load more button. The monthly trend is only drawn for a complete series; ranking is by inline bars scaled to the loaded rows (labelled).

## Verification
New suite `executive-intelligence-r5-maturity.test.mjs` 10/10 (dedup/terminal/export/card models, static, infinite scroll incl. stale chunk, failure+retry, no automatic retry loop, offsets, no duplicate requests, history/exceptions + export scope, cards at 320/390/520 with detail dialog + keyboard + focus, finance bill dialog, integrated visuals, Overview single trend call, roles, 5-width fit). Old pagination/CSS-card assertions in the existing suites were rewritten to their infinite-scroll/card equivalents. One consolidated run of all `scripts/mis-g7-reporting` and `scripts/mis-c1` tests: 178/183; the 5 failures were the phone-width responsive adapters (waiting for a table / clicking a row at phone width), fixed, and those 8 responsive tests re-run 8/8. Server PostgreSQL, WP10/PEC guard suites and Electron not run.

## Evidence
`docs/executive-intelligence-r2/r5-maturity-before/` and `r5-maturity-after/` (Overview 1280/390, Finance 1280, Materials/FG/Exceptions/Production 390).

## Limits and owner checklist
Back-button closing of the detail dialog uses history state (verify on a real phone). Rows loaded stay in the DOM (bounded by the user's scrolling; no virtualisation). Checklist (real sessions): scroll Finance/Materials/FG/MTD/History/Exceptions to the end, change filter/search mid-scroll, force an offline chunk then Retry; open a card and check the full record; export History after partial scroll and read the scope line; Overview trend and bars for executive, sales-only, denied.
