# Step 132 — Live master only; legacy Sheet removed (2026-10-22)

User directive:
- Drop the separate marketing-object cleanup topic entirely. No marketing table/view maintenance under this workstream.
- Do not maintain legacy tabs in the dedicated Google workbook.
- The canonical Supabase view must expose **only the latest formally APPROVED costing run**, not an aggregate of all historical approved periods.

Read-only database verification (2026-10-22): `costing.v_price_revision_current_approved_master` grouped by run/period/date produces exactly one tuple: refresh_run_id=140, period_start=2026-10-01, valuation_date=2026-10-22, row_count=627, distinct SKUs=627. The view uses ordered latest APPROVED run selection with `LIMIT 1`; upon a later formal approval, it will select the newer approved run when queried, provided it is the latest by period/date/run. The Google MASTER DATA tab is a *controlled static copy* of the view at last import, not continuously synchronized. Refresh it after formal approvals using the documented gated process. Never conflate current DB view and static last-export values.

Google workbook `SASV - PRICE REVISION PROPOSAL` ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`: deleted the obsolete `APPROVED BASELINE - RUN 136` tab (sheetId=0) per explicit user direction, no archive maintained inside workbook. Confirmed the workbook now contains exactly two tabs in order:
0 `MASTER DATA REFERENCE`; 1 `MASTER DATA`.
All current-run master data and finance definitions were retained untouched. No new database schema migration required since canonical view already enforces latest approved run. Other marketing objects untouched.
