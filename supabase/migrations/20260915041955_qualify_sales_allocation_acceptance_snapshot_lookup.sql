do $m$
declare v_oid oid; v_def text; v_count int;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_accept_sales_allocation_quantity_driver_review'
    and pg_get_function_identity_arguments(p.oid)='p_refresh_run_id bigint, p_sku_id bigint, p_acceptance_reason text, p_acceptance_note text';
  if v_oid is null then raise exception 'acceptance rpc not found'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_count:=(length(v_def)-length(replace(v_def,$q$select * into v_s
  from costing.sku_sales_allocation_basis_snapshot
  where refresh_run_id=p_refresh_run_id and sku_id=p_sku_id$q$,'')))/length($q$select * into v_s
  from costing.sku_sales_allocation_basis_snapshot
  where refresh_run_id=p_refresh_run_id and sku_id=p_sku_id$q$);
  if v_count<>1 then raise exception 'expected one ambiguous snapshot lookup, found %',v_count; end if;
  v_def:=replace(v_def,
    $q$select * into v_s
  from costing.sku_sales_allocation_basis_snapshot
  where refresh_run_id=p_refresh_run_id and sku_id=p_sku_id$q$,
    $q$select b.* into v_s
  from costing.sku_sales_allocation_basis_snapshot b
  where b.refresh_run_id=p_refresh_run_id and b.sku_id=p_sku_id$q$);
  execute v_def;
end;
$m$;