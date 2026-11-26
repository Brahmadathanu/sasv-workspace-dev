# EI R3/R4 client package — implementation receipt (client)

Not an acceptance record. G7 7/11; R0–R7 formal acceptance 0/8; R3 active, R4 partial, R5–R7 pending. Synthetic fixtures only.

## What was built
- **Sales Performance** (executive + sales-only): sub-views Overview (matched-period comparison, trailing windows), Month to date (legacy, executive only), History (15 groupings, 1–12 months, search, top/bottom, paging, page-only CSV, month grid), Exceptions, Coverage + refresh status. Filters: as-of, region, godown, active SKUs. Contracts: `ei_sales_dimensions`, `ei_sales_comparison`, `ei_sales_window_totals`, `ei_sales_history`, `ei_sales_exceptions`, `ei_sales_coverage`, `ei_sales_refresh_status`.
- **Management Alerts**: `ei_management_alerts` rendered as a partial, review-only catalogue; missing counts unavailable; no urgency invented; unavailable/denied/expired/error states.
- **Capability discovery**: `ei_sales_access`; sales-only mode requests no executive data; any non-explicit answer fails closed.
- **Owner UX corrections**: compact ERP summary rows and metric strips, one-line context, no redundant headings, shared filter sheets; HOME icon+label, icon-only at 520px and below; scoped token-only CSS; zero-width bars for zero values; missing inventory diagnostic counts fail closed; Overview materials value now the canonical figure with the same coverage wording as the Materials lens (legacy snapshot value no longer shown).

## Verification (see PR for counts)
Static pin of every server object touched; pure model fixtures; browser fixtures for every view and state (not installed, 401/403/503, denied, empty, latest-wins, sales-only, export, grid, overview/lens alignment); responsive overflow at 320–1440; existing MIS/C1 suites updated for intentional changes.

## Not done / blockers
Server installation and acceptance of the R3/R4 candidates and access remediation; registry change for sales-only entry; category-level hierarchy filters; certified historical amounts; R5 Electron, R6 retirement. Authenticated PWA acceptance must precede any Electron release.
