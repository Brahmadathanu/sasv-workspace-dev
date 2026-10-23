# Step 158 — Simplified consecutive pack discount consistency (23 October 2026)

User approved simplified inter-SKU consistency by comparing percentage unit-price discounts between consecutive ascending pack sizes of the same product and UOM, with **5 percentage-point tolerance**. Updated only `INTER-SKU PRICE COORDINATION` in native workbook `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`, gid 1206261006. The original 177 price-list-eligible SKUs / 71 multi-SKU products remain.

Retained A:K identity, approved MRP for reference, evaluation MRP IK/OK from the existing viability sheets, and evaluation MRP per physical unit.

Replaced the old simple larger-pack unit-price-reversal diagnostic with formulas in L:U:
- L Previous Pack (same product, UOM, ascending numerical size);
- M/N IK/OK Unit Discount (%) = 100 * (1 - evaluation unit price of this pack / evaluation unit price of previous pack);
- O/P Previous IK/OK Discount (%) = preceding pack's transition discount;
- Q/R absolute variation in percentage points between consecutive transition discounts;
- S/T IK/OK assessment: FIRST PACK (no prior pack), NOT EVALUATED (missing data), UNIT PRICE REVERSAL (negative discount), BASELINE TRANSITION (only first discount, cannot compare), CONSISTENT (<= 5 pp), REVIEW (>5 pp);
- U overall summary: UNIT PRICE REVERSAL, REVIEW, NOT EVALUATED, CONSISTENT or NO COMPARISON. For two-SKU products the second pack has a single discount but no comparison of discount steps and hence NO COMPARISON.

All new formula columns styled blue, header styled consistent and columns resized. Dynamic formulas use MAP/ARRAYFORMULA and are blank below spilled data. QA across 177 rows /71 products: 141 NO COMPARISON, 22 CONSISTENT, 12 REVIEW, 2 UNIT PRICE REVERSAL; **zero formula errors**. This is a non-binding preview with no changes to either viability engine, approved MRPs, price lists, promotions, assumptions or database.
