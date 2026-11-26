# EI R5 final: visual intelligence and mobile presentation, receipt (client only)
Branch `fix/executive-intelligence-r5-production-ux` (PR #542), from checkpoint `912866c4`. Client only: no server, SQL, permission, registry, shared stylesheet, service-worker, Electron or guard-file change. Synthetic-fixture evidence only; **not owner production acceptance**. The six pre-existing migration line-ending differences are untouched and uncommitted.

## 1. HOME parity (root cause and fix)
Root cause of the missing fill: Stock Checker declares `<html data-sasv-theme="sasv-core">`, which activates the themed home tokens (`--sasv-home-bg` etc.). The MIS page lacked it, so the shared `#homeBtn` rule resolved the tokens to the neutral default surface (`rgb(244,247,248)`, no tint). Fix: the same attribute on the MIS `<html>` (plus `lang`), and one narrow token-only page rule for the two things Stock Checker takes from its body class: the shared sans family and a zero icon gap at <=520px. Test compares 18 computed properties of MIS `#homeBtn` with Stock Checker's (same glyph markup mounted by `mountModuleHome`) at 1280 and 390, light and dark: **identical**; also asserts it is not the neutral default and the label is icon-only <=520px.

## 2. Mobile record cards
Breakpoint: **<=640px**, the module's existing phone breakpoint (768 and wider keep tables with contained scrolling). Mechanism: CSS over the SAME table markup, rows, handlers and requests (no duplicate DOM or fetch). A small helper adds each cell's column label, an identity cell and explicit table roles (so semantics survive `display:block`), observing added nodes only. Identity cell is the first column (Item for Materials), other fields are labelled two-column, long text wraps, "Unavailable / No rows / Not reported" wording is unchanged (signed, zero, missing, unavailable stay distinct). Finance rows stay keyboard-operable (Enter opens bills); pagination, filters, search, sort and CSV export are untouched.
| Table | Phone treatment | Reason |
|---|---|---|
| Finance parties, Materials, Finished goods, Sales month-to-date | cards | ordinary records |
| Sales: period comparison, trailing windows, history (table view), exceptions, daily coverage, facility scope | cards | ordinary records (comparison/windows: one card per period/window) |
| Management alerts | cards | ordinary records |
| Finance bill-details dialog | cards (same class) | ordinary records |
| Sales history **month grid** | contained horizontal scroll, visible "swipe/scroll" hint and edge shadow | genuine month-by-dimension matrix |
| Production tiles/strips, freshness panel | already non-table | n/a |
Tested at 320/390/520 for 10 lens/sub-view combinations: same rows and cell text as the 1280 table, every cell labelled, one identity cell, roles table/row/cell, no duplicate ids, no page or in-list horizontal overflow, identical RPC set (no card-only request). 1280 stays a table.

## 3. Visual intelligence (all from already-loaded data, no new RPC, no dependency)
| Lens | Visual | Basis / semantics |
|---|---|---|
| Overview | receivables vs payables bars (existing, now titled/as-of) + signed net line; materials (canonical known value) vs finished goods bars; stage bars + overdue-within-WIP subset bar; Sales card discloses that periods/history are on the Sales lens | different bases stated, "never added into one stock total"; disjoint stages "not a sequence"; subset only when overdue <= WIP; legacy snapshot materials value never shown; no sales fan-out |
| Finance | receivable/payable magnitudes, signed net separate | no ageing: summary has no buckets (stated) |
| Sales overview | matched-period sales value bars; trailing-window average bars | missing period/window = labelled gap, not zero; not certified |
| Sales history | complete chronological monthly columns when group = Month; ranked bars for other groupings | trend only when the full series is in one response (no search, page 1); missing months = gaps, unavailable = hollow "n/a" with reported amount in the text, anchor month hatched + "*" partial; ranking labelled "this page only, not a share"; each column focusable with a text label |
| Sales facility | billed value by classification scope | missing amount = gap; "not product sales"; classification not certified |
| Materials | existing known-value-by-category bars (unchanged) | incomplete coverage line already shown |
| Finished goods | months-of-stock status stacked bar (zero / below 1 mo / above 6 mo / other) | only when the counts do not overlap; "other" = SKUs minus listed |
| Production | stage bars + overdue-within-WIP subset | as Overview; no invented plan/actual or PWL value |
| Alerts | checks-by-state stacked bar + text legend | Unavailable separate from "No findings", partial catalogue never an all-clear |
Omitted on purpose: Sales exceptions and coverage graphs (status/date tables are clearer); standalone Overview sales trend (would need an eager history fetch; disclosed instead); ageing, category/location composition beyond the existing Materials bars (no complete mutually-exclusive data in the loaded contracts); plan-vs-actual (no comparable verified measure). These are future controlled enhancements, not fabricated.

## Verification
- New suite `executive-intelligence-r5-visual.test.mjs`: 11/11 (4 pure model, 1 static, HOME computed parity, cards, card interactions + matrix, Sales graph semantics, cross-lens graph semantics incl. sales-only/denied, 5-width fit).
- Existing tests adjusted for deliberate changes only: phone tables are cards (not scroll containers), HOME now has the two-line parity rule, the inventory strip height is measured excluding the new chart card, cache keys `ei-r7-1`/`ei-r7=1`.
- **One consolidated regression on final code, all `scripts/mis-g7-reporting/*.test.mjs` + `scripts/mis-c1/*.test.mjs`: 179/179 pass, 0 fail, 0 skipped** (168 earlier + 11 new). Server PostgreSQL suites, WP10/PEC guard suites and Electron not run here (no database; guard files untouched; ChatGPT re-pins).
- Evidence: `docs/executive-intelligence-r2/r5-final/` (28 PNG: every lens at 390; Overview/Finance/Production/Alerts/Sales/History/Facility at 1280; 320 and 520 for Overview, Materials and History; HOME MIS beside Stock Checker at 1280 and 390). Capture script `scripts/mis-g7-reporting/capture-r5-final.mjs`.

## Limits
Synthetic fixtures only. A real executive session may return a month series larger than one response (then the trend correctly says it cannot be drawn). Materials/FG bars compare different bases side by side by design. 641-767px keeps the scrolling table.

## Owner checklist (real signed-in sessions: executive, sales-only, denied; desktop and phone)
1. HOME beside Stock Checker: same tint, border, size, hover, focus; icon-only on phone.
2. Phone: Finance, Materials, Finished Goods, every Sales sub-view and Alerts show compact cards, no sideways page scroll; tapping a Finance row still opens its bills; sort, filter, search, paging and CSV export behave as before; the History month grid scrolls inside its own panel.
3. Overview: summary and ten provenance controls intact; stock bars show the stated bases; overdue sits inside Work in Process.
4. Sales: matched-period bars, History monthly columns (gaps/partial/unavailable readable, tooltip/focus text), page-only ranking wording.
5. Alerts: Unavailable never looks clear. Sales-only sees no executive visual; denied sees none.
