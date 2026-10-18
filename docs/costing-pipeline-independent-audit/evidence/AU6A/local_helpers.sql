create or replace function costing.t_mkrun(p_id bigint, p_kit boolean) returns void language plpgsql as $$
declare off bigint := p_id*100000;
begin
  insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run,
    (select to_jsonb(r) || jsonb_build_object('id',p_id,'overall_status','RUNNING','current_stage_code','03_COST_BUILD_TO_SCHEME') from costing.costing_refresh_run r where id=126));
  insert into costing.costing_refresh_run_stage select * from jsonb_populate_recordset(null::costing.costing_refresh_run_stage,
    (select jsonb_agg(to_jsonb(s) || jsonb_build_object('id',s.id+off,'refresh_run_id',p_id,'stage_status',case when s.stage_code='03_COST_BUILD_TO_SCHEME' then 'RUNNING' else s.stage_status end)) from costing.costing_refresh_run_stage s where refresh_run_id=126));
  insert into costing.cost_pool_monthly_snapshot select * from jsonb_populate_recordset(null::costing.cost_pool_monthly_snapshot,
    (select jsonb_agg(to_jsonb(s) || jsonb_build_object('id',s.id+off,'refresh_run_id',p_id)) from costing.cost_pool_monthly_snapshot s where refresh_run_id=126));
  insert into costing.direct_labour_component_pool_snapshot select * from jsonb_populate_recordset(null::costing.direct_labour_component_pool_snapshot,
    (select jsonb_agg(to_jsonb(s) || jsonb_build_object('id',s.id+off,'refresh_run_id',p_id,'direct_labour_pool_snapshot_id',s.direct_labour_pool_snapshot_id+off)) from costing.direct_labour_component_pool_snapshot s where refresh_run_id=126));
  insert into costing.sku_sales_allocation_basis_snapshot select * from jsonb_populate_recordset(null::costing.sku_sales_allocation_basis_snapshot,
    (select jsonb_agg(to_jsonb(s) || jsonb_build_object('id',s.id+off,'refresh_run_id',p_id)
       || case when p_kit and s.sku_id in (865,878) then jsonb_build_object(
            'sku_base_qty_per_unit',1,
            'sales_base_qty_12m',s.sales_base_qty_12m/s.sku_base_qty_per_unit,'product_sales_base_qty_12m',s.product_sales_base_qty_12m/s.sku_base_qty_per_unit,
            'actual_sales_base_qty_12m',s.actual_sales_base_qty_12m/s.sku_base_qty_per_unit,'actual_product_sales_base_qty_12m',s.actual_product_sales_base_qty_12m/s.sku_base_qty_per_unit,
            'resolved_sales_base_qty',s.resolved_sales_base_qty/s.sku_base_qty_per_unit,'resolved_product_sales_base_qty',s.resolved_product_sales_base_qty/s.sku_base_qty_per_unit,
            'monthly_allocation_base_qty',s.monthly_allocation_base_qty/s.sku_base_qty_per_unit,'monthly_product_allocation_base_qty',s.monthly_product_allocation_base_qty/s.sku_base_qty_per_unit)
          else '{}'::jsonb end) from costing.sku_sales_allocation_basis_snapshot s where refresh_run_id=126));
  insert into costing.product_qc_workload_snapshot select * from jsonb_populate_recordset(null::costing.product_qc_workload_snapshot,
    (select jsonb_agg(to_jsonb(s) || jsonb_build_object('id',s.id+off,'refresh_run_id',p_id)) from costing.product_qc_workload_snapshot s where refresh_run_id=126));
  insert into costing.demand_fixture select p_id, d.product_id, d.product_name, d.product_base_uom,
     d.commercial_base_qty/case when p_kit and d.product_id=685 then 275 when p_kit and d.product_id=695 then 500 else 1 end,
     d.internal_base_qty,
     d.total_manufacturing_base_qty/case when p_kit and d.product_id=685 then 275 when p_kit and d.product_id=695 then 500 else 1 end,
     d.monthly_driver_status, d.commercial_recipient_sku_count, d.demand_source, d.demand_note, d.internal_evidence_json
    from costing.demand_fixture d where d.refresh_run_id=126;
  insert into costing.fx_foundation select p_id, jsonb_set(j,'{rows}',(select jsonb_agg(case when p_kit and (r->>'product_id')::int in (685,695)
      then r || jsonb_build_object('monthly_product_base_qty',(r->>'monthly_product_base_qty')::numeric/case when (r->>'product_id')::int=685 then 275 else 500 end) else r end)
      from jsonb_array_elements(j->'rows') r)) from costing.fx_foundation where refresh_run_id=126;
  insert into costing.fx_dlprev select p_id, jsonb_set(j,'{rows}',(select jsonb_agg(case when p_kit and (r->>'product_id')::int in (685,695)
      then r || jsonb_build_object('monthly_product_base_qty',(r->>'monthly_product_base_qty')::numeric/case when (r->>'product_id')::int=685 then 275 else 500 end) else r end)
      from jsonb_array_elements(j->'rows') r)) from costing.fx_dlprev where refresh_run_id=126;
end $$;
create or replace function costing.t_chain(p_id bigint) returns jsonb language plpgsql as $$
declare a jsonb; b jsonb; c jsonb;
begin
  select to_jsonb(x) into a from costing.rpc_refresh_sku_direct_labour_component_split_snapshot('2026-10-01','2026-10-16',p_id) x;
  b := costing.rpc_refresh_production_overhead_workload_snapshot('2026-10-01','2026-10-16',p_id);
  select to_jsonb(x) into c from costing.rpc_refresh_qc_monetary_allocation_snapshot('2026-10-01','2026-10-16',p_id) x;
  return jsonb_build_object('dl',a,'poh',b - 'step_snapshot_count','qc',c);
end $$;
