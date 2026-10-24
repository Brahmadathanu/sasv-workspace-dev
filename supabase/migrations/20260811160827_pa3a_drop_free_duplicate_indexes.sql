-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- app_private.mv_forecast_plan_12m: retain higher-use valid UNIQUE index mv_fp_unique_idx.
drop index if exists app_private.mv_forecast_plan_12m_uniq;

-- app_private.sales_monthly: retain one index per identical definition.
-- Keep sales_monthly_v2_month_idx (higher observed scan count), legacy month_start/godown & region indexes (actively used),
-- legacy sku/godown/month (nonzero use), and legacy unique key (active and suitable for concurrent refresh).
drop index if exists app_private.sales_monthly_month_idx;
drop index if exists app_private.idx_sales_monthly_v2__month_start_godown;
drop index if exists app_private.idx_sales_monthly_v2__month_start_region;
drop index if exists app_private.sales_monthly_v2__sku_godown_month_idx;
drop index if exists app_private.ux_sales_monthly_v2_key;

-- Lab active partial uniqueness: retain established actively-used canonical copies.
drop index if exists lab.uq_lab_protocol_pm_subcategory_map_active;
drop index if exists lab.uq_lab_spec_profile_inv_group_map_active;
drop index if exists lab.uq_lab_spec_profile_pm_subcategory_map_active;
drop index if exists lab.uq_lab_spec_profile_product_group_map_active;

-- FG bulk ledger: retain heavily/actively used copies.
drop index if exists public.fg_bulk_stock_ledger_product_id_batch_number_idx;
drop index if exists public.idx_fg_ledger_prod_bn;
drop index if exists public.fg_bulk_stock_ledger_source_table_source_id_idx;

-- Inventory classification map: retain ix_item_map_* copies, which carry current usage.
drop index if exists public.idx_map_category;
drop index if exists public.idx_map_group;
drop index if exists public.idx_map_subcategory;
drop index if exists public.idx_map_subgroup;

-- RM issue lines: retain *_lines_* copies / actively used copies.
drop index if exists public.idx_mrp_rm_issue_date;
drop index if exists public.idx_mrp_rm_issue_product_batch;
drop index if exists public.idx_mrp_rm_issue_rm;

-- Snapshot PK duplicates: retain PRIMARY KEY indexes.
drop index if exists public.uq_pm_issue_priority_snapshot_current_month;
drop index if exists public.uq_rm_issue_priority_snapshot_current_month;
drop index if exists public.uq_rm_unassigned_issues_snapshot_current_month;

-- Vendor alias: retain UNIQUE-constraint-backed index.
drop index if exists public.ux_proc_vendor_alias_source_key;

-- Product SKU: retain PRIMARY KEY; drop free duplicate unique index.
drop index if exists public.pk_product_skus_id;

-- RM BOM header: retain UNIQUE-constraint-backed uq_rm_bom_per_product.
drop index if exists public.uq_rm_bom_header_product;

-- SOP sections: retain UNIQUE-constraint-backed index.
drop index if exists public.u_sop_sections_pos;

-- Tally snapshots: retain currently used voucher-date indexes.
drop index if exists public.idx_rmpm_voucher_date;
drop index if exists public.idx_vreg_voucher_date;

-- sku_stock_snapshot: remove only the free third copy here; constraint consolidation is held for PA-3B.
drop index if exists public.sku_stock_snapshot_uniq_idx;