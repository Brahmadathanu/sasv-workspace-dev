# Live deployment verification — approved stock-valuation source continuity (21 Oct 2026)

## Scope and deployment
User explicitly approved implementation. Source committed to branch costing/au4-normal-budget at commit 7adbcaf9ed77f681fe07aa0d2aedf40a537c9197 in docs/costing-pipeline-independent-audit/closure/prepared/PREPARED_20261021_material_approved_fallback_source_continuity.sql.
Supabase project qhmoqtxpeasamtlxaoak migration costing_approved_stock_fallback_source_continuity_20261021 applied successfully.
Only replaced costing.fn_material_review_acceptance_matches. Existing selection hierarchy untouched: governed zero cost > manual > purchase > stock fallback.

## Exact semantics
Carry an ACTIVE MATERIAL_ACTION acceptance within the same approved period/month, after original valuation and within acceptance effective dates, for exact stock item, area, material route, issue/warning/action context and identical source family + selected manual/purchase IDs + stock valuation source. For RM_STOCK_VALUATION_FALLBACK and PM_STOCK_VALUATION_FALLBACK, permit the same source to supply a new positive numeric stock valuation and updated rate_date, provided rate_date<=current valuation_date. Other categories continue to require original selected numeric rate and rate_date. If a better hierarchy source is selected, the rate_source differs and the old acceptance fails; no automatic new acceptance. Internal-source derived materials remain fail-closed when rate changes.

## Read-only result of live function on frozen run131 drilldown
841 historical active actions: effective RM fallback117, PM fallback215, stale RM182, stale PM238, manual RM45, manual PM21, optional missing RM1/PM2 = 821; changed internal source5 still REVIEW; old absent15. No acceptance inserts/updates. Frozen run131 SUCCESS, UNAPPROVED; refresh count 612 remains historical, no new refresh executed.

Negative test using accepted fallback861: changed positive fallback rate matches TRUE; switched source to LAST_PURCHASE FALSE; Nov1 cross-month FALSE; Oct15 backward FALSE. Note acceptance matcher validates against source evidence *supplied by its governed caller*; direct scalar invocation with made-up positive fallback rate is not an approval or an independently validated new source. The actual selection function must continue to provide that evidence, and valuation/source-context reviews remain necessary.

## Remaining programme
Five internal-source rate changes, seven pricing-bridge reviews, full downstream financial conservation, G2 attestation and G6 approval gating. No pricing/Sheets integration. No capacity-based additions, artificial balancing, or historical run modifications.
