# Run 131 — material provenance and manufacturing internal labour checkpoint
Date: 20 October 2026 IST. Read-only investigation; no Supabase mutation, acceptance, refresh, price publishing, or Sheets operation.

## Material evidence result
Inspected live definitions of costing.fn_material_review_acceptance_matches, costing.fn_apply_material_acceptance_source_context and both costing.rpc_accept_material_review_action overloads. Exact valuation date remains mandatory. Approval trigger requires consistent selected-rate provenance tuple.

Compared all 841 ACTIVE October material acceptances (run124, valuation 2026-10-16) with frozen run131 action queue and qualifying drilldown lines. All-line null-safe check used selected numeric rate, rate source, rate date, selected manual-rate ID, purchase-fact ID and stock-valuation source, plus matching stock-item, area, route, issue, warning and action summaries.
RM: 232 complete provenance matches (2050 lines); 14 numeric-rate changed (155 lines); 104 rate source or date changed (571 lines); 7 no matching action.
PM: 269 complete provenance matches (440 lines); 207 source or date changed (214 lines); 8 no matching action.
TOTAL: 501 candidates have complete matching rate/provenance across 2490 qualifying lines; 325 differ; 15 lack corresponding group.
These are preliminary carry-forward CANDIDATES, not accepted for run131. Remaining: per-field comparison of 325, historical-to-current line coverage and cardinality, wider action metadata, all linked SKU/cost exposure and independent verification of acceptance applicability. Do not weaken valuation-date check or copy approvals absent explicit authorisation.

## Five-product SKU manufacturing labour residual
Live foundation function includes commercial SKU monthly demand plus internal-source material demand in product-level monthly quantity. The SKU labour split writer uses SKU quantity divided by that combined product quantity. This exactly explains commercial SKU shares below one; no artificial denominator is needed.
Product 824 internal qty 1.057794444444 and labour 43.6882633947 (3 paths).
Product 275 internal qty 0.545561764706 and labour 22.1568586377 (2 paths).
Product 278 internal qty 0.68 and labour 15.0956174469 (1 path).
Product 277 internal qty 0.283333333333 and labour 4.8636558150 (1 path).
Product 260 internal qty 0.004681372549 and labour 0.0896913735 (2 paths).
Together approximately INR 85.89408667 of manufacturing labour, numerically equal to the difference between product pool 706203 and saleable SKU manufacturing allocation 706117.11. All five source products are present in run131 SKU internal material conversion evidence, including the direct_manufacturing_labour_per_base field. This establishes designed internal-cost attribution but not yet a completed destination-weighted reconciliation. Do not claim G6 closed before downstream financial conservation and nested transfer checks.

## Next
Finish fieldwise old/current material line evidence and monetary/SKU impact; inspect full end-to-end internal conversion absorption; create bounded approval packet only after read-only confirmation. Leave run128 APPROVED; run131 unapproved; no G2 attestation, G6 acceptance, pricing or Sheets.
