do $m$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_count int;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='fn_preview_shared_standard_batch_route_foundation';
  if v_oid is null then raise exception 'shared foundation function not found'; end if;
  v_def:=pg_get_functiondef(v_oid);

  v_count:=(length(v_def)-length(replace(v_def,$q$bool_or(b.monthly_driver_status='REVIEW_REQUIRED')$q$,'')))/length($q$bool_or(b.monthly_driver_status='REVIEW_REQUIRED')$q$);
  if v_count<>1 then raise exception 'expected one shared review-status predicate, found %',v_count; end if;
  v_def:=replace(v_def,$q$bool_or(b.monthly_driver_status='BLOCKED')$q$,$q$bool_or(ar.effective_status='BLOCKED')$q$);
  v_def:=replace(v_def,$q$bool_or(b.monthly_driver_status='REVIEW_REQUIRED')$q$,$q$bool_or(ar.effective_status='REVIEW_REQUIRED')$q$);

  v_count:=(length(v_def)-length(replace(v_def,$q$from costing.sku_sales_allocation_basis_snapshot b$q$,'')))/length($q$from costing.sku_sales_allocation_basis_snapshot b$q$);
  if v_count<>1 then raise exception 'expected one shared sales-basis source, found %',v_count; end if;
  v_def:=replace(v_def,
    $q$from costing.sku_sales_allocation_basis_snapshot b$q$,
    $q$from costing.sku_sales_allocation_basis_snapshot b
        cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar$q$);

  v_def:=replace(v_def,
    $q$'monthly_driver_source_month',b.monthly_driver_source_month,'monthly_driver_status',b.monthly_driver_status,$q$,
    $q$'monthly_driver_source_month',b.monthly_driver_source_month,'monthly_driver_status',b.monthly_driver_status,
                 'monthly_driver_effective_status',ar.effective_status,'quantity_driver_acceptance_id',ar.acceptance_id,$q$);
  execute v_def;

  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='rpc_refresh_sku_direct_labour_component_split_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  if v_oid is null then raise exception 'DL component writer not found'; end if;
  v_def:=pg_get_functiondef(v_oid);

  v_count:=(length(v_def)-length(replace(v_def,$q$b.monthly_driver_status='REVIEW_REQUIRED' or b.allocation_resolution_status='REVIEW_REQUIRED'$q$,'')))/length($q$b.monthly_driver_status='REVIEW_REQUIRED' or b.allocation_resolution_status='REVIEW_REQUIRED'$q$);
  if v_count<>3 then raise exception 'expected three packing review predicates, found %',v_count; end if;
  v_def:=replace(v_def,$q$b.monthly_driver_status='REVIEW_REQUIRED' or b.allocation_resolution_status='REVIEW_REQUIRED'$q$,$q$ar.effective_status='REVIEW_REQUIRED'$q$);

  v_count:=(length(v_def)-length(replace(v_def,$q$join tmp_packing_responsibility pr on pr.product_id=b.product_id$q$,'')))/length($q$join tmp_packing_responsibility pr on pr.product_id=b.product_id$q$);
  if v_count<2 then raise exception 'expected packing responsibility joins, found %',v_count; end if;
  v_def:=replace(v_def,
    $q$join tmp_packing_responsibility pr on pr.product_id=b.product_id$q$,
    $q$join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar$q$);
  execute v_def;
end;
$m$;