-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_def text;
  v_old text := E'create temporary table tmp_dl_product_pack on commit drop as\n  select product_id,sum(packing_labour_allocation) as product_packing_labour_allocation\n  from costing.sku_packing_labour_workload_snapshot\n  where refresh_run_id=p_refresh_run_id\n  group by product_id;\n\n  insert into costing.sku_direct_labour_allocation_snapshot(';
  v_new text := E'create temporary table tmp_dl_product_pack on commit drop as\n  select product_id,sum(packing_labour_allocation) as product_packing_labour_allocation\n  from costing.sku_packing_labour_workload_snapshot\n  where refresh_run_id=p_refresh_run_id\n  group by product_id;\n\n  -- These exact-run snapshots are populated immediately before the large SKU join.\n  -- Refresh planner statistics so the current run is not mis-estimated as a one-row slice,\n  -- which otherwise causes catastrophic nested-loop rescans of the same run snapshots.\n  execute ''analyze costing.sku_sales_allocation_basis_snapshot'';\n  execute ''analyze costing.product_direct_labour_workload_snapshot'';\n  execute ''analyze costing.sku_packing_labour_workload_snapshot'';\n\n  insert into costing.sku_direct_labour_allocation_snapshot(';
begin
  select pg_get_functiondef('costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)'::regprocedure) into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'Direct Labour optimization anchor not found; no change applied';
  end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;