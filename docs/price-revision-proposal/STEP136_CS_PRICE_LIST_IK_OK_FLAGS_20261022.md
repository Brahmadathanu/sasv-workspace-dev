# Step 136 — CS Product Pricing IK/OK price-list eligibility reconciliation (2026-10-22)

## Authoritative user instruction and source
The user corrected the workbook name to **CS - PRODUCT PRICING DATABASE**. Native Google workbook id `1B-NBD6lmZxfXVnseighCVMV5HsCte-v676KopFbNs98`, `PRODUCT PRICING` tab sheetId2136105377. Headers: ITEM (A), PACK SIZE (B), UOM (C), PRICE LIST IK (Q), PRICE LIST OK (R), SKU_ID (W). Values Y/N are regional membership, independent of MRP/discount and independent for each region.

## Read and reconciliation (safe matching by SKU ID + exact Item + Pack Size + UOM)
1,854 sheet data rows; 1,753 with valid unique SKU_ID and 101 without SKU_ID. All matched-id rows exist in public.product_skus, with 0 item/pack/UOM mismatches, 0 duplicate SKU IDs, 0 invalid Y/N. Source Q and R each have 598 Y values, but TWO Y/Y rows have blank SKU_ID: sheet row32 Kumaryasavam 200 mL and row1848 AM Ointment 15 g. These have NOT been assigned speculatively. Source blank SKU rows must not be read as authoritative mapped IDs.
Supabase public.product_skus: 1793 total; 627 active; 29 samples. 40 SKUs absent from source id coverage, of which 11 active. Imports did **not** assume absent -> false.

## Live mutations
- Migration `20261022172703_price_list_ik_ok_sku_flags_nullable_20261022` added nullable boolean `price_list_ik` and `price_list_ok` directly to public.product_skus with provenance comments. TRUE=Y, FALSE=N, NULL=not verified.
- Six source-verified atomic import migrations:
  `20261022172736_price_list_ik_ok_reconciled_import_p1_20261022` through `20261022172750_price_list_ik_ok_reconciled_import_p6_20261022`; 300+300+300+300+300+253 = 1753 matched rows. Per-batch DB UPDATE requires full exact SKU ID/Item/Pack/UOM and raises if affected row count mismatches. Source snapshots and migration SQL committed as versioned six files to this branch, no new legacy table.
- Migration `20261022172811_price_revision_master_ik_ok_price_list_membership_20261022` extends canonical `costing.v_price_revision_current_approved_master` with `price_list_ik`, `price_list_ok` sourced from `product_skus`; all existing 19 finance column comments retained and two new provenance comments added. Existing view selects only latest formally APPROVED run.
- DB verification: total 1793 SKU rows, 1753 imported nonnull, 40 null; 596 TRUE IK and 596 TRUE OK. Of latest approved costing view: 627 rows/627 distinct SKUs, 11 unresolved (NULL) flags; 525 TRUE IK and 525 TRUE OK.
- Google `SASV - PRICE REVISION PROPOSAL` workbook ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`: `MASTER DATA` appended two columns BJ/BK `Price List IK`, `Price List OK`. 627 rows updated with Boolean types directly from new canonical view, mapping each current sorted sheet row back to SKU ID (D). NULL left empty. Existing six-key sort and 61 earlier columns untouched. Spot-read shows correct headers/TRUE values.
- Master reference unchanged because raw Boolean eligibility fields are self-explanatory; PostgreSQL view comments are available for provenance.

## Outstanding 11 active SKUs without source SKU_ID match
180 Kottamchukkadi Lepa Choornam 500 g; 975 Linga Chendooram 1000 g; 1768 Aswagandhadi Choornam 1000 g; 1771 Brihat Chagaladi Ghritham 150 mL; 1772 Brihat Chagaladi Ghritham 450 mL; 1783 Arkkadi Thailam 450 mL; 1787 Jeevaneeya Choornam 100 g; 1788 Balamooladi Choornam 100 g; 1792 Abhraka Bhasmam 1000 g; 1797 Special Medicine 2 5 g; 1798 Mahamanjishtadi Kashaya Choornam 100 g. Their flags MUST remain NULL until explicit corrected source or user approval. Two unmapped Y/Y source items must also be resolved before claiming total source coverage.

## Future guards
Never treat NULL membership as false; do not infer inclusion merely from an MRP or existing prices. A pricing proposal should flag unknown membership, and only include TRUE in respective IK/OK price-list candidate scope. The independent membership source in product_skus is canonical after this import, not the old Sheet.
