# Step 144 — Profitability Objectives control (23 October 2026)

Workbook is now user-renamed `SASV - PRICING & PROMOTIONAL VIABILITY` (unchanged Google ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`).

Created `PROFITABILITY OBJECTIVES` (sheet ID 1206261002), index4, four columns: Region (A), Selected Objective (B), Minimum Target (C), Unit (D). Exactly two control rows: IK row2, OK row3. Each region can select ONE template and nonnegative numeric target independently. Initial placeholders both `Profit on MRP (%)` at target 7. Unit is a Google Sheets lookup formula tied to selected template; both show %.

Extended workbook-owned `DATA VALIDATION MASTER` with columns E:H: Objective Code, Objective Template, Unit, Metric Definition. Four initial templates: MRP_MARGIN (Profit on MRP %), SELLING_PRICE_MARGIN (Profit on Selling Price %), REALIZATION_MARGIN (Profit on Sales Realization %), UNIT_PROFIT (Minimum Profit per SKU ₹). Metric definitions indicate denominators but exact definition of shared post-promotion PROFIT numerator and realization/contingency/GST must be ratified against existing approved costing before implementing financial viability formulas. Do not treat this draft definition list as certification of those monetary derivations.

Objective names have strict live range dropdown validation using F2:F100 of DATA VALIDATION MASTER; target has non-negative numeric validation. Unit derived by VLOOKUP of selected objective F:G, calculated in Google Sheet. These two selected objectives and targets are the only user-editable controls for the later IK/OK tabs; each future viability worksheet must use its regional B/C inputs, and codes/labels should not be manually retyped across SKU rows. No direct database connectivity, no sales viability tabs implemented yet, no canonical costing or promotions modification.

Verified both rows' name, target and unit; data validation applied. Validation master template codes are stable identifiers for future SWITCH mapping; expanding templates later requires updating corresponding formula mapping. Percentage targets are percentage-point values, e.g. 7 means 7%, not 0.07.

Future next gate: validate financial profit numerator, net-realization denominator, tax/discount/free-goods and contingency treatment against approved snapshot; then implement two formula-driven promotional viability tabs.
