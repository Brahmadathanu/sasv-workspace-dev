do $mig$
declare
  v_def text;
  v_old text;
  v_new text;
  v_test_count integer;
begin
  select pg_get_functiondef('costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(date,date,bigint)'::regprocedure)
    into v_def;

  if v_def is null then
    raise exception 'Admin/finance exact-run writer not found';
  end if;

  select (length(v_def)-length(replace(v_def,'when b.allocation_resolution_status =','')))/length('when b.allocation_resolution_status =')
    into v_test_count;
  if v_test_count <> 8 then
    raise exception 'Expected 8 allocation-resolution readiness/note tests, found %', v_test_count;
  end if;

  v_old := E'    from costing.sku_sales_allocation_basis_snapshot b\n\n    left join costing.v_cost_pool_monthly_combined ad';
  v_new := E'    from costing.sku_sales_allocation_basis_snapshot b\n\n    cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) qdr\n\n    left join costing.v_cost_pool_monthly_combined ad';

  if strpos(v_def,v_old)=0 then
    raise exception 'Expected Admin/finance source join anchor not found';
  end if;

  v_def := replace(v_def,v_old,v_new);
  v_def := replace(v_def,'when b.allocation_resolution_status =','when qdr.effective_status =');

  execute v_def;
end
$mig$;