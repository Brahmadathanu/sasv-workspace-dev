# Step 134 — Canonical complete product classification + costing period (2026-10-22)

User requested (1) show costing period with view name/run ID/valuation date on the lean MASTER DATA REFERENCE, (2) expand the canonical view and Sheet MASTER DATA together to full product master classification rather than Group/Subgroup alone, (3) omit product/SKU active status fields if every cost-sheet recipient is active.

## Checks
Read-only join of all 627 latest approved run140 SKUs to public.products and public.product_skus: 627 rows, 0 products not Active, 0 SKUs with is_active false/null. Consequently did not add redundant status columns; product status is currently 'Active', SKU is_active true for all recipient rows. This is a current-run property verified live, not an assumption about future possible runs.

Product classification hierarchy traced from actual public relational master:
products.sub_group_id -> sub_groups.product_group_id -> product_groups.sub_category_id -> sub_categories.category_id -> categories; product_groups.kind_id -> product_group_kinds. Existing Product Group and Product Subgroup retained; added category, subcategory and product kind with their database IDs. Do not conflate this commercial product master hierarchy with inventory `inv_class_*` hierarchy, which belongs to inventory classification.

## Implementation
Supabase migration `20261022165929_price_revision_master_full_product_classification_20261022` extends `costing.v_price_revision_current_approved_master` by appending six canonical columns: product_category_id, product_category, product_subcategory_id, product_subcategory, product_kind_id, product_kind. Existing 57 fields and database comments preserved, canonical latest approved run selection unchanged. Versioned SQL in `supabase/migrations/20261022165929_price_revision_master_full_product_classification_20261022.sql`.

Live view check: 627 rows, 627 unique SKUs, no missing classification identifiers or names. No product/SKU status fields added.

Google Sheets workbook `SASV - PRICE REVISION PROPOSAL` ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`, MASTER DATA REFERENCE row4 now reads `Costing Period = 2026-10-01`; first four rows: source view, approved run ID 140, valuation date 2026-10-22, costing period 2026-10-01. Existing lean definitions begin row5. MASTER DATA extended from 57 to 63 columns by exactly six added columns sourced from canonical database view, 627/627 imported in batches; spot-check first two SKUs: category Ayurveda, subcategory Classical, kind Arishtam / Asavam / Shuktham. Existing rows, cost components, view comments, and no-legacy design preserved.

## Later refinement
For finance convenience, classification columns might be repositioned beside existing Group/Subgroup in a subsequent controlled sheet layout operation; canonical DB view preserves its column order for non-breaking schema migrations. Do not reproduce the product master hierarchy in Sheet formulas. Existing `MASTER DATA` is static controlled export, not live update.
