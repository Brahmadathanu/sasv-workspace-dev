# Approved price data contract v2

**Supersedes v1** (`PRICE_REVISION_FEED_CONTRACT_v1.md`, built on `public.v_costing_pricing_price_revision_feed_approved`, which no longer exists). Checked read-only on 24 Oct 2026, 15:50 IST.

## Source
- View: `costing.v_price_revision_current_approved_master`. Retirement and creation history: `docs/price-revision-proposal/STEP129`–`STEP134`, `STEP137`.
- Scope: one row per SKU from the latest approved run (now run 143, October 2026, 22 Oct valuation): **627 rows**.
- Grants (information_schema): `postgres` only. No `anon`/`authenticated`/`service_role` table grant is listed, so access is server-side/owner. Whether Sheets uses another route to read it is **unverified**.
- Column meanings are stored as view column comments (STEP133).

## Columns (65, in order)
refresh_run_id, period_start, valuation_date, sku_id, product_id, item, pack_size, pack_uom, product_group_id, product_group, product_subgroup_id, product_subgroup,
rm_cost_per_sku, pm_cost_per_sku, material_cost_per_sku, direct_labour_cost_per_sku, internal_material_conversion_cost_per_sku, prime_cost_per_sku,
production_overhead_cost_per_sku, quality_control_overhead_cost_per_sku, materials_stores_overhead_cost_per_sku, manufacturing_cop_per_sku,
admin_overhead_cost_per_sku, finance_admin_overhead_cost_per_sku, internal_loaded_cost_per_sku,
marketing_expense_cost_per_sku_ik, marketing_expense_cost_per_sku_ok, pricing_cost_per_sku_ik, pricing_cost_per_sku_ok,
mrp_ik, mrp_ok, gst_percent, ik_basic_price, ok_basic_price, ik_discount_percent, ok_discount_percent, ik_discount_amount, ok_discount_amount,
ik_selling_price, ok_selling_price, contingency_percent, ik_contingency_value, ok_contingency_value,
ik_scheme_id, ik_scheme_name, ik_scheme_paid_qty, ik_scheme_free_qty, ok_scheme_id, ok_scheme_name, ok_scheme_paid_qty, ok_scheme_free_qty,
ik_margin_amount_before_scheme, ik_margin_percent_before_scheme, ok_margin_amount_before_scheme, ok_margin_percent_before_scheme,
cost_sheet_status, refreshed_at (timestamptz), product_category_id, product_category, product_subcategory_id, product_subcategory,
price_list_ik (bool), price_list_ok (bool), refreshed_at_ist (text).

Types: ids bigint/integer, money and quantities numeric, names text.

## Rules
- Read-only. Price revision consumes this view; it does not recompute costs.
- `cost_sheet_status` is included so consumers can filter.
- When a newer run is approved for the period, the view follows it automatically (run 140 → 143 on 24 Oct).
