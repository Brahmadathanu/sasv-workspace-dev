-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare v_sql text;
begin
  select pg_get_functiondef(p.oid)
  into v_sql
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_production_overhead_workload_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_sql is null then
    raise exception 'Production Overhead snapshot writer not found';
  end if;

  v_sql:=replace(v_sql,'fn_resolve_route_family_for_product(r.product_id, p_valuation_date)','fn_resolve_route_family_for_product(r.product_id::integer, p_valuation_date)');
  v_sql:=replace(v_sql,'fn_resolve_route_family_for_product(r.product_id,p_valuation_date)','fn_resolve_route_family_for_product(r.product_id::integer,p_valuation_date)');
  v_sql:=replace(v_sql,'fn_resolve_effective_route_family_route(r.product_id, p_valuation_date)','fn_resolve_effective_route_family_route(r.product_id::integer, p_valuation_date)');
  v_sql:=replace(v_sql,'fn_resolve_effective_route_family_route(r.product_id,p_valuation_date)','fn_resolve_effective_route_family_route(r.product_id::integer,p_valuation_date)');
  v_sql:=replace(v_sql,'fn_validate_effective_product_process_route(r.product_id, p_valuation_date)','fn_validate_effective_product_process_route(r.product_id::integer, p_valuation_date)');
  v_sql:=replace(v_sql,'fn_validate_effective_product_process_route(r.product_id,p_valuation_date)','fn_validate_effective_product_process_route(r.product_id::integer,p_valuation_date)');
  v_sql:=replace(v_sql,'fn_effective_product_process_steps(r.product_id, p_valuation_date)','fn_effective_product_process_steps(r.product_id::integer, p_valuation_date)');
  v_sql:=replace(v_sql,'fn_effective_product_process_steps(r.product_id,p_valuation_date)','fn_effective_product_process_steps(r.product_id::integer,p_valuation_date)');
  v_sql:=replace(v_sql,'fn_effective_product_process_steps(s.product_id, p_valuation_date)','fn_effective_product_process_steps(s.product_id::integer, p_valuation_date)');
  v_sql:=replace(v_sql,'fn_effective_product_process_steps(s.product_id,p_valuation_date)','fn_effective_product_process_steps(s.product_id::integer,p_valuation_date)');

  execute v_sql;
end $$;