# R8 owner-guided live refinement
27 Nov 2026: owner selected Stock & Purchase Explorer as nearest visual reference and requested shell padding and overall typography correction. R8.1 matches Explorer desktop/intermediate/phone gutters, body 14px/1.45, title tracking and line height, subtitle rhythm, header actions and 10px section spacing. No reporting, permissions, shared components, database or release version changes. Owner PWA acceptance pending. Next: Overview then Finance, Inventory, Finished Goods, Production, Sales, Alerts, responsive acceptance and final stable release. R6 retirement parked.

## R8 local refinement log (cumulative; local only, nothing pushed)
Environment: worktree `sasv-wt-r8-live`; preview `node scripts/ei-preview/serve.mjs` (live, :5180) / `--fixture` (:5181). Local-only no-store + service-worker kill-switch; production `sw.js` untouched.

### Corrections
- R8.1 (f38777ab): shell padding, body 14px/1.45, header, 10px section spacing. Owner inspection pending.
- R8.2 (local): `.ei-table` pins `--ei-fs-sm` (13px) so tables no longer inherit the 14px body; fixes CI failure `Exceptions > Activity this month` without changing the test.

### Open items before final integration (tests not to be weakened)
1. `executive-intelligence-r5.test.mjs` Freshness (sales-only): asserts a UTC rendering (`24-Nov-2026 01:00 AM`); fails on an IST machine (`06:30 AM`). Platform/timezone dependent; resolve by making the test timezone-deterministic (e.g. fixed browser timezoneId), not by loosening the assertion.
2. `executive-intelligence-live.test.mjs:142` static "Sales-only isolation": regex expects `\n`; a Windows CRLF checkout fails. Resolve by normalising line endings in the reader (or `.gitattributes`), keeping the same pattern.

### Owner approvals
(none yet)

### Round 1 — common shell (local, awaiting owner inspection)
Measured against Stock & Purchase Explorer computed styles (live, 998px): title/subtitle/HOME already identical; changed only the differing items.
- R8.3 gutter: Explorer's effective gutter is body 20px + `.page` 14/16/16 = 34/36/36 (phones 26/28/28), not 14/16/16 (R8.1 omitted the body 20px). EI body now 34px 36px 36px; ≤640px 26px 28px 28px. Content now starts at x=36,y=34 as in Explorer.
- R8.4 primary navigation: lens tabs use Explorer's segmented control (soft surface container, 4px padding/gap, 32px tabs, 13px/500, active 600 on `--sasv-selection-soft` with `--sasv-action-primary-active` text) instead of the solid-fill pill.
- R8.5 header controls: refresh icon button 36x36 and freshness chip use Explorer's neutral control tokens (`--sasv-surface-soft`, `--sasv-control-border`, 6px radius).
- Tests updated (not weakened): R8 gutter expectations; primary-tab parity now compared to Explorer `.tab-btn.active` (adds radius/border). Pin `EI_R8_CLIENT_BLOBS` in `scripts/wp10-g2-safeguards/ei-approved-delta.mjs` to be re-pinned once at consolidated integration (client blob changed).

### Round 2 — wide-screen shell + Overview (local, awaiting owner inspection)
- R8.6 Outer gutter reduced to 20/20/16 (phones 12) so the content card uses the viewport; lens tab tray now spans the full width.
- R8.7 Overview: five uniform domain cards (header rule, indicator rows, one visual region, optional footer), equal height per grid row (3+2 at wide, 2 columns <1200px, 1 column <760px). Visuals from already-loaded figures only: Finance balance comparison, Stock value comparison, Production stage stack + overdue share, Sales monthly line. Alerts card unchanged in content ("Not connected yet").
- R8.8 Info popovers opened by hover close when the pointer leaves button and popover; a click pins; Escape/outside click still close.
- R8.9 Monthly sales line (Overview and Sales > History): native aspect ratio (no stretching), area fill, constant strokes, peak ring, Latest/Peak/Lowest tiles; capped at 960px centred on very wide screens.
- Tests adjusted to the owner-directed design (not weakened): gutter values; R5 "no bar block beneath chips" now "one visual region per domain card, none outside it".

### Round 2b — owner corrections (local)
- Gutter reduced again (12px 16px 12px; `100dvh`) to use the viewport; Stock & Purchase Explorer left untouched (reference; owner to confirm whether its blank space also appears on their screen — not reproducible in the integrated browser, where the EI card ends 12px above the viewport bottom).
- Overview cards redesigned as separate Kanban-style cards (soft lane, tinted title bar, shadow-sm). Visuals now add information instead of repeating rows: Finance receivables-cover meter, Stock materials composition (RM/PM/Indirect), Production stage composition and a solid overdue meter (hatched bar removed), Sales monthly line.
- Info popovers: close on pointer leave / keyboard blur on pointer devices (cancelled-timer bug fixed); touch keeps tap-to-pin.
- Tests: gutter expectation updated; EI/R5-maturity/R7 files pass (62/62).

### Owner approvals (cumulative)
- Round 1 common shell: inspected; refined in round 2 (gutter, tab tray).
- Round 2/2b Overview + gutter + popovers: owner confirmed "Fixed now" (27 Nov 2026). Overview approved locally; Finance next on owner direction.

### Round 3 — Overview polish (local, awaiting owner inspection)
- Executive Summary rebuilt as an insight strip (tinted title bar; one tile per fact with a domain tag; money figures and leading count emphasised; link text unchanged).
- Info icons use the semantic info colour (`--mis-info`) at rest, hover and open.
- Net Sundry Position / Overdue WIP: gradient fill removed; a status dot before the title and a coloured figure instead.
- One-screen board: tighter heads, rows and charts; Production card uses two indicator columns and side-by-side visuals; trend/stage notes shortened (full wording kept as tooltips on the production figures). At ≥1200px wide the board fits without a page scrollbar at 900px viewport height and above (verified 1440x900, 1920x950); 1366x768 still scrolls ~110px.
- Tests: EI/R5/R7 files 68/68.
- R8.13: Executive Summary tiles styled as clickable cards (domain-coloured edge, chevron, hover lift/tint, focus ring; whole tile is the link). Board still fits 1440x900 without page scroll.
- R8.14: Executive Summary tiles redesigned as headline tiles (domain icon chip, tag with chevron, lead-in, hero figure, remainder; whole tile is the link; hover lift/tint kept). Words and reading order unchanged apart from dropped leading punctuation.
- R8.14b: summary card keeps the subtle theme fill (R5 test), tile font sizes tokenised, kpi min-height scoped to Overview cards, phone gutter 8px (restores the Production summary-strip footprint). Note: executive-intelligence-r5.test.mjs had not been run in earlier rounds; now included and passing except the known timezone test.
- R8.15: summary chevron right-aligned; tiles unified (lead, hero figure, one-line caption, as-at line; full sentence in tooltip); phone gutter 8px. Board fits 1440x900.
- OWNER APPROVAL: Overview tab approved locally (27 Nov 2026) after rounds 2, 2b, 3 and R8.13-R8.15. Next: Finance on owner direction.

### Round 4 — Finance common styling (local, awaiting owner inspection)
- R8.16: list toolbar (Finance/Materials/Finished Goods, Sales controls bar) in an Explorer-style card; filter button and search use Explorer control tokens (soft fill, control border, 6px radius); list tables to Explorer density (cells 4x8 / header 5x8, 13px text, 25px rows; activity cell stays 12px); Net Sundry row: fill and edge bar removed, status dot + amber figure. Header letter-spacing left at 0.02em to keep parity with Stock Checker (test). Bill detail dialog not yet reviewed.

### Round 5 — Finance (local, awaiting owner inspection)
- R8.17 summary: three position cards (payables, receivables, net with status dot) replace the strip.
- Single scroll region: the Finance (and Materials / Finished Goods) lens fills the card; the table shell flexes instead of a fixed height, so the second scrollbar is gone.
- Rows 35px with zebra (`--sasv-surface-soft`, as in the FG internal transfer / BOM reference tables) and selection-soft hover; shared by the four list tables.
- Bill dialog: widened to 1080px max; no horizontal scroll at desktop widths.
- Ageing: toggle, as-of date, band limits (presets + custom), age range; summary bands, party table band columns, bill dialog aged in the browser. Needs the two server objects specified in `FINANCE_AGEING_SERVER_SPEC.md` (not installed: the lens says so). Fixture mode (:5181) shows the full UI with synthetic data.
- Pins: `executive-mis-c1.test.mjs` allow-list gains the two ageing contract names.

### Round 6 — live ageing verification, Sales date, cosmetics (local)
- **Live ageing RPCs verified** against the production objects (as of 27 Nov 2026, 30/60/90): payables total 42,408,063.89, buckets [6,892,898; 5,049,588; 4,172,076; 26,293,501.89], counts [104, 49, 31, 353], 192 parties, 537 bills, oldest 4,624, weighted 456.43; receivables total 22,304,842.10, buckets [7,297,198.32; 4,642,200; 1,574,390; 8,791,053.78], counts [1,250; 596; 256; 2,368], 1,282 parties, 4,470 bills, oldest 6,780, weighted 482.45; zero undated. All match the expected figures. Party page: top 40 payables and top 40 receivables parties re-aged from `v_mis_finance_outstanding_detail` in the browser matched the server bucket and undated amounts 80/80. Custom bands (15,45), range 20–5000, receivables filter, search, infinite scroll (25 -> 50 -> 75) and party drill-down checked live; party row and bill dialog agree.
- **Parity**: pure rules moved to `executive-intelligence-model.js` (DOM-free) and covered by `finance-ageing-parity.test.mjs` (mixed signs, per-party orientation by filtered net, invalid calendar dates, on-account/unreferenced lines, future-dated bills, exact band boundaries, inclusive range, undated survive range incl. undated-only party, as-of re-ages without changing amounts, bound validation).
- **Sales date investigation (no code change)**: Overview "To 25 Nov 2026" comes from `mv_mis_executive_summary.sales_position_date` (materialised snapshot, `mv_refreshed_at` 27 Nov 03:00 UTC, MTD 11,965,232.40 = the monthly aggregate). The daily normalised source is newer: `v_ei_sales_mtd_summary` / `ei_sales_comparison` / `ei_sales_coverage` report 26 Nov 2026 (latest mapped = latest raw = 26 Nov; 224 mapped of 231 raw rows), MTD 12,446,248.33; difference 481,015.93 equals the 26 Nov latest-day value. So the displayed 25 Nov is a retained snapshot anchor, not a client rendering fault; the Sales lens (daily contracts) shows 26 Nov. **For ChatGPT**: (1) the executive-summary MV refresh (03:00 UTC) runs before the daily import (03:41-03:44) and uses the monthly aggregate, so Overview MTD/date lag the Sales lens by a day and the two MTD figures differ; (2) `ei_sales_coverage` reports MAPPING_COUNT_MISMATCH for every recent day (raw minus mapped = 7 rows/day: 371/364, 311/304, 355/348, 231/224) - confirm intended; (3) `ei_sales_refresh_status.amount_difference` = 481,015.93 (monthly vs daily) is the same gap.
- **Cosmetics**: KPI figures medium weight everywhere; summary figures coloured per domain; Finance position chips tinted with a coloured top edge; Ageing settings now an in-page dialog (full page at <=640px) with numbered steps, live band preview, position-date shortcut and an explicit note that the as-of date changes ageing only, not the outstanding position.
- Tests updated/added: pinned-name lists (two ageing RPCs), Finance toolbar gains the Ageing control, Finance phone chip height limit 140->160 (owner-directed redesign; sub-lines kept visible).

### Round 7 — Finance presentation (local, awaiting owner inspection)
- R8.19: position summary = slim chips on desktop (label + note left, figure right, ~48px) and one financial-statement block with a row per figure on <=640px; ageing summary = one slim distribution bar per group plus a miniature band table (Outstanding / Share / Bills per band, No date column when present) in an expandable row (open on desktop, collapsed on phones, where the breakdown is a vertical band list); oldest, weighted average, parties, bills and undated amounts kept; negative bands drawn in the table only; drill-down summary chips span the table width and the table has intentional column widths (colgroup, fixed layout, right-aligned numerics, band badge separated from age); phones scroll the table sideways instead of squeezing it. No calculation, RPC or filter change.
- R8.20: ageing summary rows start closed (slim row: name, total, bar, Breakdown) and open an in-page breakdown dialog (full page <=640px) with figure tiles, bar and band table (vertical list on phones); drill-down chips auto-fit the full width with share and bill count; Age (days) header no longer truncated (widths 12/22/12/14/20/20); the bill list becomes a card list on phones (also for the non-ageing dialog); both dialogs are full page on phones.
- R8.21: party drill-down on phones: single scrollbar (page behind locked while any Finance dialog is open), compact chips (label + share above, amount + bills below), explanatory notes (Tally basis and aged-as-of) moved into an 'About these figures' drawer (closed on phones, open on wide screens).

### Round 8 — narrow-screen layout, Inventory / Finished Goods (local, awaiting owner inspection)
- Narrow (<=640px): Ageing control is icon-only; Executive Summary tiles are slim rows (icon, lead + figure, caption + as-at; about 240px for four facts instead of about 420px); the page no longer scrolls: title block and lens selector stay fixed and the selected tab's panel is the single scroller (all tabs). Infinite scroll now observes the tab panel on phones (verified 25 -> 50 -> 75 on Finance, Materials, Finished Goods).
- Materials Inventory and Finished Goods adopt the Finance design: toolbar card, tinted compact position chips (statement block on phones), zebra rows, one scroll region (shared CSS from earlier rounds plus chips this round).
- Finished Goods cover chart redesigned: slim stacked bar with inline legend (status, count, share) in a soft card; counts text unchanged for the existing test.
- Scoped the phone page-lock rules with :has(.tab-panel) to respect the no-global-selector guard.

## R8 intermediate release scope — 27 Nov 2026 (owner-authorised; not final R8 acceptance)
**Completed and approved or released for use in this intermediate package (client only):**
- Common shell and typography aligned to Stock & Purchase Explorer (gutters, tabs, header controls, tokens); narrow-screen layout where the title block and lens selector stay fixed and the selected tab's panel is the single scroller.
- Overview: uniform Kanban-style domain cards, information-adding visuals (receivables cover, materials composition, stage composition and late-work meter, monthly sales line), Executive Summary headline tiles, popover hover/focus behaviour, one-screen desktop fit.
- Finance: position chips, Explorer-style toolbar card, taller zebra rows, single scroll region, wide bill dialog, ageing analysis (settings dialog, compact summary with breakdown dialog, party table band columns, drill-down with orientation by party net, card list on phones) on the installed `get_mis_finance_ageing_*` contracts.
- Materials Inventory and Finished Goods adopt the Finance chip / toolbar / table design; Finished Goods cover chart redesigned. These two tabs are *not yet individually reviewed or approved by the owner*.
- Tests: pinned-name lists, parity fixtures (`finance-ageing-parity.test.mjs`), fixed UTC context for the Freshness test, line-ending-neutral source readers, cache-busted asset versions (`executive-mis-dashboard.js?mis-c1=ei-r8-2`, `executive-intelligence-model.js?ei-r8=2`).
- Server (ChatGPT-controlled, already registered in production, not replayed): `20261127144051_ei_r8_finance_ageing`, `20261127154330_ei_guarded_summary_refresh`.

**Pending (interactive refinement continues after this release):** owner review and approval of Materials Inventory and Finished Goods, then Production Performance, Sales Performance and its secondary views, Management Alerts, and final dialogs/common controls/responsive acceptance. R6 database retirement, Sales Viewer retirement and any Overview sales-snapshot freshness follow-up remain separate and untouched. R8 and the Executive Intelligence programme are **not** closed.

## Debtor KYC server integration — 28 November 2026

Production migration `20261128084946_ei_r8_debtor_kyc_canonical` was registered and verified on PostgreSQL 17.4. Existing v6.6.1 Finance calls reconcile on the 28 November snapshot. Verified live receivables were ₹22,553,369.10 across 4,502 bills and 1,286 parties. Management Alerts now includes the outstanding debtor KYC finding alongside the six existing alerts. The [production receipt](debtor-kyc/SERVER_PRODUCTION_RECEIPT_20261128.md) records registration, reconciliation, permissions and tests. The [consolidated client assignment](debtor-kyc/CODEX_CLIENT_IMPLEMENTATION_ASSIGNMENT_20261128.md) is the handoff for the internal Finance Debtor KYC workspace and the remaining R8 visual work. R8 visual acceptance is 3/10. Stable Electron is v6.6.1.

The owner-approved client sequence uses a compact Finance entry, the existing Finance filter drawer, and one Management Alerts deep link to unclassified debtors. The PWA preview precedes owner approval and production PWA verification. The accepted client joins the later consolidated Electron v6.6.2 release. [Owner acceptance checklist and previews](debtor-kyc/CLIENT_PWA_ACCEPTANCE_20261128.md)
