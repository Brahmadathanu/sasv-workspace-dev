# Step 140 — Remove UTC timestamp from finance-facing MASTER DATA (2026-10-22)

By user direction, deleted the entire `Refreshed At (UTC)` column (former BI, zero-based index 60) from `SASV - PRICE REVISION PROPOSAL` / `MASTER DATA` using a native Google Sheets `deleteDimension` request. Re-verified final columns:
- BH: Cost Sheet Status
- BI: Price List IK
- BJ: Price List OK
- BK: Refreshed At (IST) — last populated column.

Retained `refreshed_at` (precise UTC) and `refreshed_at_ist` in canonical Supabase view `costing.v_price_revision_current_approved_master`; no database modifications. Future Google exports must **omit** UTC and display only `refreshed_at_ist` as final column. Regional flags and 627 SKU rows unchanged. Google grid now 64 columns with 63 data columns, including the IST display.

Workbook ID: `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`.
