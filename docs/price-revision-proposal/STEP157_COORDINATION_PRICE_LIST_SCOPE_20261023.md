# Step 157 — Price-list-only scope for both previews (23 October 2026)

Workbook: `SASV - PRICING & PROMOTIONAL VIABILITY` ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`.

User instructed limiting both review tabs to eligible price-list items. Updated only each tab's source spill formula at A2.

- `INTER-SKU PRICE COORDINATION` (gid 1206261006): select SKU rows in BOTH regional viability price-list populations (SKU ID match), then retain only product IDs with two or more **eligible** SKUs. Price/ratio preview remains formula-driven and unaffected. Verified **177 SKU rows across 71 products**; 175 NO FLAG, 2 REVIEW, **0 missing-value results or formula errors**.
- `IK-OK MRP ALIGNMENT REVIEW` (gid 1206261007): select only IK price-list rows whose SKU IDs also occur in OK price-list, and whose product family contains a current *evaluation* IK/OK price differential, including equal-price sibling rows. Verified **265 SKU rows across 184 products**, zero errors. Its eligibility is now explicitly based on both regional price lists even though the current effective source populations overlap.
- No modification to master lists, MRP assumptions, promotion settings, viability formulas, approved MRPs or Supabase.
