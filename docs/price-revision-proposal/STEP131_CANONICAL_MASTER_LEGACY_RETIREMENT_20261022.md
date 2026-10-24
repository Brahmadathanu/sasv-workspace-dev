# Step 131 — Legacy feeds retired; canonical master governance (22 October 2026)

## Decision and scope
User requested removal of the two previously discovered obsolete price-revision views, investigation of a possible obsolete marketing view/table, and one maintained canonical source for `MASTER DATA` in `SASV - PRICE REVISION PROPOSAL`. Keep database view and Sheet header/content expansion coordinated through controlled work stages.

## Verified retirement, live
- Old `costing.v_price_revision_feed_approved` was historically contaminated (1261 rows; September 122 and October 140), incomplete and exposed obsolete common marketing/pricing representations.
- Old `public.v_costing_pricing_price_revision_feed_approved` was its sole direct dependent view. Database dependency scan found no other dependent database views; GitHub default-branch code search found no client references to either exact view.
- Supabase migration `20261022160047_price_revision_retire_legacy_feeds_20261022` executed successfully with explicit DROP VIEW for the public wrapper first, then costing legacy view; NO CASCADE. Repository parity SQL recorded at `supabase/migrations/20261022160047_price_revision_retire_legacy_feeds_20261022.sql`.
- Post-migration catalog confirms only `costing.v_price_revision_current_approved_master` among the three named views. Canonical source still 627 rows/627 distinct SKU IDs from approved run140.
- Existing master view originally created by live migration `20261022154130_price_revision_current_approved_master_20261022`; repository parity SQL already recorded. **This is the only designated price-revision database master source**. Sheet master is a static, controlled export of this view; not independently recalculated costing.

## Marketing-object distinction (DO NOT REMOVE)
Investigated marketing-named tables/views. `public.v_marketing_baseline_export` uses forecast `sku_forecast_monthly_base` and `public.marketing_export_settings` and is unrelated to price revision. `public.marketing_overrides_staging` is explicitly read/written by `public/shared/js/forecast-console.js` in live app repository; `public.v_marketing_overrides_staging_issues` validates entries. These are forecasting/planning objects and **must not be removed merely because the word marketing appears**. Within costing, `sku_regional_marketing_expense_allocation_snapshot` and related monthly pools are the live authoritative regional marketing allocation process and likewise must not be removed. The allegedly obsolete marketing-specific object has not yet been identified with evidence from earlier documentation; defer any such retirement until a specific name and consumer/dependency check. No marketing table/view was changed.

## Google workbook and three tabs
Workbook ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q` presently contains:
1. `MASTER DATA REFERENCE`: finance explanations of 57 fields.
2. `MASTER DATA`: 627 approved-run database values, 57 columns, no Sheet costing formulas.
3. `APPROVED BASELINE - RUN 136`: old preliminary snapshot pre-dating run140, carried forward untouched as historical evidence.
The third tab is NOT part of the two-tab current design and should NOT be used as pricing input. Its removal from the active workbook is a cleanup choice: first preserve it as a dated historical snapshot in an appropriate archive if retaining history; do not quietly delete potentially useful historical evidence based solely on a question about why there are three tabs.

## Canonical expansion contract
- Freeze source at one governed latest APPROVED run for each controlled export. When a new costing run is approved, independently verify target row uniqueness/READY and source tuple, then replace only the MASTER DATA values as a controlled refresh, keeping historic proposal snapshots separately.
- When adding fields: update canonical DB view through versioned migration first; assert 627 or current approved-run population with one row per SKU, non-null essentials, regional IK/OK pairing and sample values; then update Sheet header/columns and `MASTER DATA REFERENCE` definitions in lockstep, finally verify live Google Sheet.
- Never reproduce existing database costing equations in Sheets. Reference explanations are prose, not calculation formulas.
- Proposed commercial policies, date-effective objectives and IK/OK proposals stay in separate dedicated future tabs.
- Do not recreate legacy feeds or obsolete compatibility projections.

## Next
Proceed to user-visible workbook review and Stage06 marketing promotions design. Establish whether historical run136 tab should be archived to a separate workbook and deleted from live proposal workbook; preserve evidence if doing so.
