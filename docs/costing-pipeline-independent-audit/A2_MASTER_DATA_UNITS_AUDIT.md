# A2: master data, units and material integrity (run 119)
Retrieved 2026-10-15 ~19:20 IST with `queries/A2_01_master_data_units.sql` plus one detail query. SELECT-only. Status: **COMPLETE for the audit scope (sweep 1).**

## What is sound (VERIFIED_LIVE)
- 635 SKUs are in run 119 and all have a conversion factor (no nulls).
- No duplicate active SKU definitions (product + pack + unit).
- Every product in the run has an RM BOM header with a reference output quantity.
- No BOM lines have zero or null quantity, null unit, or wastage over 50%.
- No product has process loss over 30%.
- RM status: all 635 READY. Material status: 634 READY and 1 REVIEW (SKU 207, unaccepted fallback, stale, manual or optional-missing rate).
- No SKU has zero RM, PM or material cost.
- Unit pairs: ml→Kg 248, g→Kg 222, ml→L 97, Nos→Nos 65, g→Nos 2.

## Findings
| ID | Finding (VERIFIED_LIVE) | Exposure | Sev |
|---|---|---|---|
| A2-F1 | **Mehasamani SKU 879**, a 20 g pack of P696 with base unit Kg, uses factor **0.02 per g** instead of 0.001 for g→Kg. The pack counts as 0.4 Kg, so RM/SKU is ₹3.53 (20×0.02×₹8.815). Either the factor is 20× too high, or the ₹8.815/Kg RM base rate is actually per 20 g. The same factor also feeds this product's monthly quantity, and so its labour and POH workload. | Material, labour and POH for this SKU could be off by 20× in either direction | P1 |
| A2-F2 | **Ilaneer Kuzhambu SKU 859** (5 mL, factor 0.000714) has RM ₹1.4553/Kg and RM/SKU ₹0.01. **Palthulli SKU 1277** (5 mL, factor 0.00127) has RM ₹0.9575/Kg and RM/SKU ₹0.01. RM below ₹2/Kg for a liquid herbal preparation is implausible (ANALYTICAL). The BOM reference output or its unit is likely wrong. Material cost totals ₹3.23 and ₹7.79, so most of it is PM. | Material cost understated; exact size UNVERIFIED | P1 |
| A2-F3 | A **single density of 0.91 g/mL** converts **248 SKUs / 140 products** from mL to Kg. Only 3 products have their own factor (0.714, 1.081, 1.27). No per-product density evidence is stored. | RM per pack scales 1:1 with density. A ±5% density error is ±5% RM on these packs. | P2 |
| A2-F4 | The conversion factor is **product-level** (`products.conversion_to_base`) and applied to every SKU of the product, whatever the pack unit. Two g-packs sit on Nos products with factor 1 (Kashaya Vasthi Kit 275 g, Karkkidaka Kanji 500 g); these are handled through `sku_base_quantity_exception` (2 rows). The model cannot express mixed pack units correctly without exceptions. | Same class of defect as A2-F1 | P2 (design) |
| A2-F5 | **Rate quality:** 554 of 635 SKUs carry at least one **stale purchase rate** (1,839 RM and 340 PM lines). 420 SKUs use **stock-valuation fallback** (732 RM, 245 PM lines). There are 228 manual-rate lines. 3,388 review lines are "accepted", which turns them READY. So "READY" here means review-accepted, not rate-current. | Size UNVERIFIED. Needs a rate-age table and a weighted-cost comparison (A2 sweep 2). | P2 |
| A2-F6 | **Coverage:** active SKU 1797 (P824, 5 g) is missing from run 119. SKU 1791 is inactive now but was costed in the run. | One SKU missing from the price list | P3 |

## Remediation (PROPOSAL)
- **A2-F1/F2:** production and QA to confirm, for P696, P678 and P1038: the BOM reference output, the base unit and the pack factor. Correct this in master data through governed change; do not touch the run-119 rows.
- **A2-F3:** add a per-product density table with an evidence document, and fail closed when an mL-to-Kg product has no measured density.
- **A2-F4:** move conversion factors to SKU level, with explicit pack unit → base unit and a check of dimensional consistency.
- **A2-F5:** record a rate-age policy (maximum age per class). "Accepted review" should carry an expiry and an approver.
- **Retest:** rerun `A2_01`. Expect no odd factor without a documented exception, and no RM below a set floor without a waiver.
