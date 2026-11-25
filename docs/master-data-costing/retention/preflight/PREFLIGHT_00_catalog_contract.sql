-- READ-ONLY live preflight 00: fixture-contract equality. Run on PRODUCTION (read-only) BEFORE trusting any fixture result.
-- Each row must report ok=true. Any false => the stub assumed by tests differs from live; stop and reconcile.
WITH want(tbl,col,typ) AS (VALUES
 ('costing_refresh_run','id','bigint'),('costing_refresh_run','period_start','date'),('costing_refresh_run','valuation_date','date'),('costing_refresh_run','overall_status','text'),
 ('costing_refresh_run','valuation_context_source','text'),('costing_refresh_run','finished_at','timestamp with time zone'),
 ('sku_sales_allocation_basis_snapshot','id','bigint'),('sku_sales_allocation_basis_snapshot','period_start','date'),('sku_sales_allocation_basis_snapshot','valuation_date','date'),
 ('sku_sales_allocation_basis_snapshot','refresh_run_id','bigint'),('sku_sales_allocation_basis_snapshot','sku_id','bigint'),('sku_sales_allocation_basis_snapshot','product_id','bigint'),
 ('sku_sales_allocation_basis_snapshot','monthly_driver_method','text'),('sku_sales_allocation_basis_snapshot','monthly_driver_source','text'),('sku_sales_allocation_basis_snapshot','monthly_driver_source_month','date'),
 ('sku_sales_allocation_basis_snapshot','monthly_driver_status','text'),('sku_sales_allocation_basis_snapshot','assumption_id','bigint'),('sku_sales_allocation_basis_snapshot','assumption_basis','text'),
 ('sku_sales_allocation_basis_snapshot','default_policy_id','bigint'),('sku_sales_allocation_basis_snapshot','default_policy_scenario','text'),
 ('sku_sales_allocation_basis_snapshot','monthly_allocation_units','numeric'),('sku_sales_allocation_basis_snapshot','monthly_allocation_base_qty','numeric'),
 ('sku_regional_marketing_allocation_basis_snapshot','id','bigint'),('sku_regional_marketing_allocation_basis_snapshot','period_start','date'),('sku_regional_marketing_allocation_basis_snapshot','valuation_date','date'),
 ('sku_regional_marketing_allocation_basis_snapshot','refresh_run_id','bigint'),('sku_regional_marketing_allocation_basis_snapshot','region_code','text'),
 ('sku_regional_marketing_allocation_basis_snapshot','regional_assumption_id','bigint'),('sku_regional_marketing_allocation_basis_snapshot','regional_default_policy_id','bigint'),
 ('sku_regional_marketing_allocation_basis_snapshot','regional_default_scenario','text'),
 ('sku_regional_marketing_expense_allocation_snapshot','id','bigint'),('sku_regional_marketing_expense_allocation_snapshot','period_start','date'),('sku_regional_marketing_expense_allocation_snapshot','valuation_date','date'),
 ('sku_regional_marketing_expense_allocation_snapshot','refresh_run_id','bigint'),('sku_regional_marketing_expense_allocation_snapshot','regional_basis_snapshot_id','bigint'),
 ('sku_regional_marketing_expense_allocation_snapshot','regional_basis_source','text'),('sku_regional_marketing_expense_allocation_snapshot','regional_basis_status','text'),
 ('sku_regional_marketing_expense_allocation_snapshot','marketing_value_source','text'),('sku_regional_marketing_expense_allocation_snapshot','resolved_regional_units','numeric'),
 ('sku_regional_marketing_expense_allocation_snapshot','resolved_regional_base_qty','numeric'),('sku_regional_marketing_expense_allocation_snapshot','marketing_expense_cost_per_sku_region','numeric'),
 ('sku_regional_marketing_expense_allocation_snapshot','resolved_product_region_marketing_sales_value','numeric'),
 ('regional_marketing_evidence_acceptance','source_refresh_run_id','bigint'),('sales_allocation_quantity_driver_acceptance','source_refresh_run_id','bigint'))
SELECT w.tbl,w.col,w.typ,c.data_type AS live_type,(c.data_type=w.typ) AS ok
FROM want w LEFT JOIN information_schema.columns c ON c.table_schema='costing' AND c.table_name=w.tbl AND c.column_name=w.col
UNION ALL
SELECT 'guard:'||p.proname,'md5',pins.md5,md5(pg_get_functiondef(p.oid)),md5(pg_get_functiondef(p.oid))=pins.md5
FROM (VALUES ('fn_enforce_mutable_refresh_run_snapshot','2fc573625296de9ccde5d722fdd4a3de'),('fn_guard_designated_run_rows','5629ce76254a5ed45cde5529ce91caee')) pins(fn,md5)
JOIN pg_proc p ON p.proname=pins.fn JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='costing'
UNION ALL
SELECT 'view:'||v.relname,'md5',pins.md5,md5(pg_get_viewdef(v.oid)),md5(pg_get_viewdef(v.oid))=pins.md5
FROM (VALUES ('v_current_successful_costing_refresh_run','5cc25791985abf5d336fb9311da3d6f1'),('v_costing_run_effective_designation','b324068d66aef0c14bc6d47a921c6d56'),('v_costing_period_run_status','d38be6e4c0c8bb9811f4872b78e72936')) pins(vn,md5)
JOIN pg_class v ON v.relname=pins.vn JOIN pg_namespace n ON n.oid=v.relnamespace AND n.nspname='costing'
ORDER BY 1,2;
