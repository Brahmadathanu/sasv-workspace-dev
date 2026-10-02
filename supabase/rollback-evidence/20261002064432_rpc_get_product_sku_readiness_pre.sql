-- Recovery only. Do not apply as a forward migration.
-- Restores the pre-change LIVE_AS_OF commercial-sales assignment and drops the point helper.
-- The forward migration replaces that assignment in the live function body exactly once.
-- After apply, reversing that unique replacement reproduces prosrc md5 5cd4d77c68e186b4ccdc416d71baea70.
-- Current post-change prosrc md5 is 8112a3e9b0ec06ec904e5fb79636520d.

do $wp02_point_rollback$
declare
  src text;
  repl text;
  old_lookup constant text := 'select * into v_sales from costing.v_sku_commercial_sales_basis c where c.sku_id=p_sku_id and c.period_start=v_period and c.management_valuation_date=v_val limit 1;';
  new_lookup constant text := 'select * into v_sales from costing.fn_resolve_sku_commercial_sales_basis_point(p_sku_id, v_period, v_val) limit 1;';
begin
  select p.prosrc into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'rpc_get_product_sku_readiness'
    and pg_get_function_identity_arguments(p.oid) = 'p_sku_id bigint, p_period_start date, p_context_type text, p_refresh_run_id bigint';
  if (length(src) - length(replace(src, new_lookup, ''))) / length(new_lookup) <> 1 then
    raise exception 'point lookup was not found exactly once';
  end if;
  repl := replace(src, new_lookup, old_lookup);
  execute
    'create or replace function public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text default ''LIVE_AS_OF''::text, p_refresh_run_id bigint default null::bigint)
     returns jsonb
     language plpgsql
     stable
     security definer
     set search_path to public, costing, pg_temp
     as $fn$' || repl || '$fn$';
end
$wp02_point_rollback$;

drop function if exists costing.fn_resolve_sku_commercial_sales_basis_point(bigint, date, date);
