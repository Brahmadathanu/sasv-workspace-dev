# Step 149 — Grouped validation master, safe regional lookup references (23 October 2026)

Rearranged `DATA VALIDATION MASTER` in workbook `SASV - PRICING & PROMOTIONAL VIABILITY` (ID 1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q) into 12 ordered fields:
A Scheme IK; B Paid IK (Nos); C Free IK (Nos); D Discount IK (%);
E Scheme OK; F Paid OK (Nos); G Free OK (Nos); H Discount OK (%);
I Objective Code; J Objective Template; K Unit; L Metric Definition.

Scheme labels and paid/free quantities are physically adjacent in their own regional lookup blocks. Existing six scheme choices, four discount choices and four profitability templates remain identical. This is a workbook layout-only change; no DB or promotional master data altered.

Rebound strict dropdown validation on MARKETING PROMOTIONS MASTER proposed columns N/O/P/Q to validation A/D/E/H respectively, using fixed row2:100 references. Rebound PROFITABILITY OBJECTIVES dropdown B2:B3 to J2:J100 and unit formula D2:D3 to J:K, with existing one selection/target per region preserved. Rebuilt regional viability formulas for Paid and Free columns (R:S in each viability tab): IK lookup scheme in validation A against quantities B/C; OK scheme E against F/G. No downstream payment, profit or MRP formulas were modified. Current/future proposed values remain the independent working model.

Live post-change QA read all 525 rows from each region (525 distinct SKU IDs each); zero missing scheme quantities, zero formula errors. IK initial Profit-on-MRP 7%: 518 PASS, 7 BELOW TARGET; OK 517 PASS, 8 BELOW TARGET. Both 525/525 rounded viability PASS. Objective units correctly show %. All six scheme mappings were read back and found aligned.

Maintenance: when adding/reordering schemes, edit name + paid/free in the same regional block; never edit scheme labels without quantities. Discount values are independent vertical lists and **not** paired with schemes row-by-row. Any range additions must remain within validation rows 2:100 unless rules are deliberately extended. Select proposed rates from dropdown after adding any new rate. Any duplicated scheme names or blank/nonpositive paid quantities should be prevented by additional sheet validation if needed; current six choices distinct/valid.
