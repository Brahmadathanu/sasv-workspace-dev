-- Rolled-back live-path replay: a temporary August run (OPEN period, no approved run) is created, the refresh RPC is run,
-- a content hash is taken, and the block then raises, so nothing is committed.
do $rp$
declare v jsonb; n bigint; h text; lin bigint := -1; st jsonb;
begin
  insert into costing.costing_refresh_run
  select (jsonb_populate_record(null::costing.costing_refresh_run,
          to_jsonb(r) || jsonb_build_object('id', 990808, 'overall_status', 'RUNNING', 'finished_at', null,
                                            'period_start', date '2026-08-01', 'valuation_date', date '2026-08-07'))).*
    from costing.costing_refresh_run r where r.id = 128;
  select to_jsonb(x) into st from costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-08-01', '2026-08-07', 990808) x;
  select count(*), md5(string_agg(md5(row(period_start,sku_id,product_id,product_name,product_base_uom,conversion_to_base,pack_size,pack_uom,sku_base_qty_per_unit,sales_units_12m,sales_base_qty_12m,product_sales_units_12m,product_sales_base_qty_12m,company_sales_units_12m,product_allocation_share,allocation_basis_status,lookback_start,lookback_end,valuation_date,actual_sales_units_12m,actual_sales_base_qty_12m,actual_product_sales_units_12m,actual_product_sales_base_qty_12m,actual_company_sales_units_12m,resolved_sales_units,resolved_sales_base_qty,resolved_product_sales_units,resolved_product_sales_base_qty,resolved_company_sales_units,resolved_product_allocation_share,allocation_basis_source,allocation_resolution_status,allocation_resolution_note,assumption_id,assumption_basis,assumption_effective_from,assumption_effective_to,default_policy_id,default_policy_scenario,default_policy_effective_from,default_policy_effective_to,monthly_allocation_units,monthly_allocation_base_qty,monthly_product_allocation_units,monthly_product_allocation_base_qty,monthly_company_allocation_units,monthly_product_allocation_share,monthly_driver_method,monthly_driver_source,monthly_driver_source_month,monthly_driver_lookback_start,monthly_driver_lookback_end,monthly_driver_tied_month_count,monthly_driver_status,monthly_driver_note,monthly_driver_plan_id)::text), '' order by sku_id)) into n, h from costing.sku_sales_allocation_basis_snapshot where refresh_run_id = 990808;
  if to_regclass('costing.sku_demand_volume_selection_snapshot') is not null then
    execute 'select count(*) from costing.sku_demand_volume_selection_snapshot where refresh_run_id = 990808' into lin;
  end if;
  v := jsonb_build_object('rows', n, 'content_md5', h, 'rpc_result', st, 'lineage_rows', lin,
                          'rpc_md5', md5(pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure)));
  raise exception 'REPLAY_RESULT_ROLLED_BACK %', v;
end $rp$;