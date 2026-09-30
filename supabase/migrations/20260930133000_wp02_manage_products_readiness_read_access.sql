-- WP02-G3: widen product/SKU readiness reads to Manage Products view,
-- and expose the latest governed cost period start. The readiness body is
-- copied from the live definition at apply time and the authorization
-- statement is the only composition change.

do $wp02$
declare
  src text;
  replaced text;
  gate text := $gate$
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.app_has_permission('module:manage-products', 'view')
    or public.app_has_permission('module:costing-control-center', 'view')
  ) then
    raise exception 'Permission denied for module:manage-products or module:costing-control-center (edit=false)';
  end if;
$gate$;
begin
  select pg_get_functiondef(p.oid)
    into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'rpc_get_product_sku_readiness'
    and pg_get_function_identity_arguments(p.oid) = 'p_sku_id bigint, p_period_start date, p_context_type text, p_refresh_run_id bigint';

  if src is null then
    raise exception 'rpc_get_product_sku_readiness was not found';
  end if;

  replaced := replace(
    src,
    'perform public.require_permission(''module:costing-control-center'',false);',
    gate
  );

  if replaced = src then
    raise exception 'WP02 readiness authorization anchor was not found; refusing to apply';
  end if;

  if position('costing.fn_product_sku_readiness_enrich' in replaced) = 0
     and position('fn_product_sku_readiness_enrich' in replaced) = 0 then
    raise exception 'WP02 readiness body lost its composition helper';
  end if;

  execute replaced;
end
$wp02$;

create or replace function public.rpc_get_latest_governed_cost_period_start()
returns date
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $function$
declare
  v_period date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.app_has_permission('module:manage-products', 'view')
    or public.app_has_permission('module:costing-control-center', 'view')
  ) then
    raise exception 'Permission denied for module:manage-products or module:costing-control-center (edit=false)';
  end if;

  select max(period_start)
    into v_period
  from costing.cost_periods;

  return v_period;
end;
$function$;

revoke all on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) from public;
revoke all on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) from anon;
grant execute on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) to authenticated, service_role;

revoke all on function public.rpc_get_latest_governed_cost_period_start() from public;
revoke all on function public.rpc_get_latest_governed_cost_period_start() from anon;
grant execute on function public.rpc_get_latest_governed_cost_period_start() to authenticated, service_role;
