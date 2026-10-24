# Step 159 — Commercially screened IK–OK evaluation-MRP alignment (23 October 2026)

Workbook `SASV - PRICING & PROMOTIONAL VIABILITY`, spreadsheet ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`, preview `IK-OK MRP ALIGNMENT REVIEW` (gid 1206261007).

User approved simple commercial-screening thresholds on top of the independent minimum viable IK and OK MRP calculations. The tab remains preview-only. Current approved MRP in F/G remains reference; **Evaluation MRPs** in H/I form the baseline for the common-price candidate (N) and the largest uplift between IK and OK (O). No revision propagates to the viability calculations.

Revised column P, `Alignment Review`, to:
- `INSUFFICIENT DATA` if required evaluation MRP, minimum viable MRP or common candidate is missing
- `ALREADY ALIGNED` if evaluation MRPs are already equal
- `ALIGNMENT REASONABLE` when maximum uplift required to reach the rounded common viable MRP is up to 10%
- `REVIEW` when over 10% through 20%
- `NOT RECOMMENDED` when over 20%.

The 10%/20% figures are provisional commercial judgment thresholds, **not empirical sales-volume forecasts or approved policy**. An identical common MRP meeting independent viability floors is mathematically feasible but can still be commercially unattractive. Add read-only blue-text column Q `Product Pricing Pattern`, dynamically marking `MIXED REGIONAL PRICING` wherever a product has both evaluation-aligned and evaluation-different eligible SKU rows.

Verified 265 eligible SKU rows: 127 NOT RECOMMENDED, 122 REVIEW, 14 ALIGNMENT REASONABLE, 2 ALREADY ALIGNED; 3 rows marked MIXED REGIONAL PRICING; 0 formula error cells. No changes to discounts/schemes/viability/assumptions/approved MRP/Supabase. All updates are formula-driven.
