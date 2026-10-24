# Step 135 — Item nomenclature, kind removed, classification order and sorting (2026-10-22)

User requirements executed:
1. Remove Product Kind ID/Name from canonical DB view AND Google Sheet.
2. Google MASTER DATA classification after Item/Pack: Category ID, Category; Subcategory ID, Subcategory; Group ID, Group; Subgroup ID, Subgroup.
3. Replace product-name heading with **Item**, following `public.products.item`. Canonical DB column changed from `product_name` to `item`; independently checked all 627 former displayed product names equal `products.item` before substitution.
4. Sort all full SKU rows ascending in priority Category > Group > Subgroup > Subcategory > Item > Pack Size.
5. Preserve all costing values, one latest APPROVED run, definitions and provenance.

Database:
- Live migrations `20261022171131_price_revision_master_remove_kind_20261022` and `20261022171203_price_revision_master_item_nomenclature_20261022`, each with repository parity migration SQL under same versioned `supabase/migrations` filename.
- Canonical `costing.v_price_revision_current_approved_master` retains other classifications, costing fields and all 19 PostgreSQL derived-column descriptions. Drop/recreate used to remove view columns correctly rather than leave legacy fields.
- Live verification 627 records/627 unique SKU ids/0 missing item; prior active-only check 627 active products and SKUs remains applicable.

Google workbook `SASV - PRICE REVISION PROPOSAL` ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`, `MASTER DATA`:
- Moved classification ranges using native `moveDimension`, deleted two obsolete kind columns with native `deleteDimension`, renamed headings by `updateCells`, then applied native `sortRange` on the entire 627 x 61 populated rows (header excluded) with keys numeric 0-based [9 Category,13 Group,15 Subgroup,11 Subcategory,5 Item,6 Pack Size], all ASCENDING. Numeric pack sizes retained as numbers.
- Now 61 columns exactly; verified Google A1:P4 fields, sorted first rows and BH1:BI2 last value columns. Top sorted row SKU859 Ilaneer Kuzhambu, Category Ayurveda/Group Anjanam/Subgroup Anjanam/Subcategory Classical; next SKU1 Abhayarishtam (Group Arishtam...). This is expected by alphabetical group sort. All rows moved intact by native sort, not separately re-sorting fields.
- No change to `MASTER DATA REFERENCE`, historical tabs not reintroduced.

Notes for future master refresh: canonical view physical column order need not match finance-facing Google display; mapping must be by column name/alias, NEVER by raw SELECT* positional order. Maintain explicit A:P finance order and fixed remainder. Keep view and Sheet in parallel.
