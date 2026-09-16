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
  if position('#variable_conflict use_column' in v_def)>0 then return; end if;
  v_count:=(length(v_def)-length(replace(v_def,$q$AS $function$
declare$q$,'')))/length($q$AS $function$
declare$q$);
  if v_count<>1 then raise exception 'expected one function-body declare anchor, found %',v_count; end if;
  v_def:=replace(v_def,$q$AS $function$
declare$q$,$q$AS $function$
#variable_conflict use_column
declare$q$);
  execute v_def;
end;
$m$;