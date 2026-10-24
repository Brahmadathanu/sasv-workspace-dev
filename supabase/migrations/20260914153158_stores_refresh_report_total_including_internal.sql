-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare v_oid oid; v_def text; v_new text;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_materials_stores_allocation_snapshot'
 and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 v_new:=replace(v_def,
E'        coalesce(sum(s.monthly_sku_allocation_amount) filter (where s.allocation_status <> ''BLOCKED''),0),\n        max(s.frozen_pool_amount)',
E'        coalesce(sum(s.monthly_sku_allocation_amount) filter (where s.allocation_status <> ''BLOCKED''),0)\n          + coalesce((select sum(i.allocation_amount) from costing.product_internal_source_materials_stores_allocation_snapshot i where i.refresh_run_id=p_refresh_run_id and i.allocation_status <> ''BLOCKED''),0),\n        max(s.frozen_pool_amount)');
 if v_new=v_def then raise exception 'Stores return total patch did not match'; end if;
 execute v_new;
end $do$;