# Step 147 — Regional viability working tabs implementation (23 October 2026)

Workbook `SASV - PRICING & PROMOTIONAL VIABILITY` unchanged ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`.

Extended `DATA VALIDATION MASTER` columns I:L with region-specific numeric scheme quantities (IK paid/free, OK paid/free), aligned to existing A/C scheme names: No Scheme 1+0, 5+1, 8+1, 11+1, 16+2, 100+30. This is static workbook-owned lookup data, no DB connections.

Created `PROMOTIONAL VIABILITY - IK` (sheetId 1206261003) and `PROMOTIONAL VIABILITY - OK` (sheetId 1206261004) with 38 columns A:AL, 627 rows of native Google Sheets formulas each. Inputs reference only `MASTER DATA`, `MARKETING PROMOTIONS MASTER` working N:Q and region row in `PROFITABILITY OBJECTIVES`. Each SKU is retained with regional eligibility and EXCLUDED flag for non-listed SKUs. Current schemes/discounts refer only to editable proposed values; all other current monetary values from MASTER DATA. Income chain follows verified Step146: basic=MRP/(1+GST/100); selling=basic*(1-discount/100); scheme effective=selling*paid/(paid+free); contingency=basic*contingencyPct/100; net realisation=scheme effective-contingency-regional marketing; profit=net realization-internal loaded (=scheme effective-contingency-regional pricing cost). Metrics: profit/current MRP, profit/unschemed selling price, profit/net realization, absolute profit. One selected objective and target per region drives SWITCH calculations.

Exact minimum MRP analytic threshold for goal:
Let a=[(1-discount/100)*paid/(paid+free)-contingencyPct/100]/(1+GST/100); b=(1-discount/100)/(1+GST/100); P=regionalPricingCost; M=regionalMarketingExpense; t=target/100.
Profit/MRP: required=P/(a-t).
Profit/Selling: required=P/(a-t*b).
Profit/NetRealization: required=(P-t*M)/(a*(1-t)).
Absolute profit ₹: required=(P+target)/a.
Only positive denominator qualifies; other conditions yield blank/check input. Rounded candidate `CEILING(required,5)`. If current MRP already PASS, recommendation preserves existing MRP (may not be multiple of 5). Otherwise max(currentMRP,rounded candidate); final recommended MRP re-evaluated independently to prove PASS. Non-viable/zero denominators don't generate PASS. Arithmetic includes no double free-unit cost deduction.

Full read back QA: IK 627 total, 525 eligible, 102 excluded, 518 PASS and 7 below target at initial 7%-on-MRP; OK 627 total, 525 eligible, 102 excluded, 517 PASS and 8 below target. Zero missing lookup scheme quantities, zero formula errors in current 627-row state. Read approved run140 SKU1 parity: IK profit 33.16487979, agrees DB scheme snapshot at no-scheme 33.1649. Other scheme variants source verification was done Step146; next stage should execute explicit controlled formula scenario validation for edits to discount/scheme/objective before considering readiness final.

WARNING: Under user-requested 17-column static promotion master, no policy edits have been performed. No SQL modifications. Future refills of MASTER DATA must not overwrite promotions/targets. These tabs are live derived workbooks, not frozen snapshots. Filters and header frozen. `PROFITABILITY OBJECTIVES` template target values are input percentage points, e.g. 7=7%. Further testing needed for other objective choices and non-default scheme.

Current next gate: test scenario changes (e.g. 5+1, 33%, realization objective) in isolated scratch/test cells or controlled reversible edits and verify all four metric variants, then operational review of display and rounding decisions.
