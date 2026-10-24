# Step 130 — Latest-approved database master and Finance reference Sheets live (2026-10-22)

## Scope and approvals
Continuation of Price Revision Proposal only, branch `costing/au4-normal-budget`, Supabase project `qhmoqtxpeasamtlxaoak`. User approved master-column scope plus a preceding finance `MASTER DATA REFERENCE` tab (plain-language derivations) and database-only `MASTER DATA` without Sheet costing formulas. The independently governed run140 (valuation 2026-10-22) was NOT refreshed, designated or mutated. Historical run136 Sheet was not touched.

## Stage03 — Actual database implementation
- Applied Supabase migration `20261022154130_price_revision_current_approved_master_20261022` successfully.
- New `costing.v_price_revision_current_approved_master` selects one latest **formally APPROVED** period/run via `v_current_successful_costing_refresh_run` plus effective APPROVED designation sorted by period/date/run, and joins exact run-specific cost, product hierarchy, regional pricing, and frozen selected IK and OK scheme snapshots.
- 57 explicit columns: approved run/period/date; SKU/product/pack/group/subgroup identity; RM/PM/material, labour, recursive internal conversion, Prime, production/QC/stores OH, COP, admin/finance, loaded; canonical IK/OK marketing and pricing; IK/OK MRP, GST, basic prices, discounts, selling prices, contingency; current selected IK and OK scheme IDs, names, paid/free quantities; existing pre-scheme margins; readiness/refresh provenance.
- Old `costing.v_price_revision_feed_approved` and dependent `public.v_costing_pricing_price_revision_feed_approved` both preserved. Existing old feed remains historical multi-period 1261 rows and is NOT used by Sheet. No removal until a separate consumer/ACL impact assessment. Public wrapper uses a dedicated view-permission gate.
- Repository parity migration file: `supabase/migrations/20261022154130_price_revision_current_approved_master_20261022.sql`, captured from live pg_get_viewdef after Supabase migration.

## Live DB verification
- New view: exactly 627 rows, 627 distinct SKU IDs, `min(refresh_run_id)=max(refresh_run_id)=140`; 0 non-READY; 0 missing key RM/PM, regional pricing, group/subgroup or IK/OK selected scheme.
- Product classification mapping coverage 627/627.
- Frozen scheme selections: 627 unique IK and 627 unique OK.
- SKU54 values match prior Step127: conversion 0.967683518083218..., prime 86.226309048..., COP 89.433245604..., internal loaded 96.900842253..., pricing IK104.9395293037 / OK103.3748630937; both current schemes No Scheme. SKU191 and SKU193 internal conversion 0, as expected.
- Verified across all 627 records: IK/OK pre-scheme margin amount = respective MRP - respective canonical regional pricing cost exactly; percentage = margin/MRP*100 to high numeric precision. These definitions are in finance reference; NOT Sheet formulas.

## Native Google Sheets live implementation
Workbook `SASV - PRICE REVISION PROPOSAL`, ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`.
Ordered tabs now:
1. `MASTER DATA REFERENCE` sheetId1961794564, header plus 57 definitions; source database keys, plain-language derivations, no costing formulas.
2. `MASTER DATA` sheetId1559398124, 57 columns, header plus full 627 row payload direct from governed database view. Data imported in 75-row controlled batches; all nine writes acknowledged. Freeze header and 6 identification columns; simple header fill, filter; currency/cost display formatting at 4 decimal places (underlying numeric cell inputs from database retained as Numbers, not recomputed formulas). Latest run ID, dates and first and last imported rows verified directly via Sheets connector.
3. `APPROVED BASELINE - RUN 136` sheetId0 — existing historical baseline retained untouched and moved to index2 by new-tab insertion.

## QA and limits
- Verified live Google metadata: three sheet tabs in correct order, exact sheet IDs.
- Verified Google `MASTER DATA!A1:F4`: 140 / 2026-10-01 / 2026-10-22, SKU IDs 1,2,3 and expected product names.
- Verified `MASTER DATA!A626:F628`: run140 persists through final row, SKUs 1792,1797,1798. All 627 writes acknowledged.
- Source of truth remains approved-run DB; Sheet is **static copied values**, not auto-refresh. Future governed refresh should update the same tab only via controlled stage and verify new formally approved run, not mix historical data.
- Do not describe these figures as live formula-recalculated. No pricing proposal calculation has yet been built.
- Upstream view exists in `costing`; public-facing access for prospective app consumption was not granted or altered (Sheet import uses admin connector). No old view drop.

## Programme checkpoint
- [x] 02c finance cost-component design confirmed.
- [x] 03a audited legacy views and direct dependency.
- [x] 03b created separate governed one-latest-approved view, source counts and sample QA verified; existing dependent views preserved.
- [x] 05 user-requested finance reference tab and static master imported, initial QA passed.
- [ ] User review of actual Sheets appearance and master columns; optional exact-row cross-sampling.
- [ ] Stage06 separate sheet-managed MARKETING PROMOTIONS MASTER and current/proposed regional commercial fields.
- [ ] Stage07 dated objectives incl Profit on MRP >=7%; Stage08/09 formula-driven IK and OK proposals; Stage10 live QA; Stage11 dated historical snapshots.
