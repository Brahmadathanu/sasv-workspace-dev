-- WP02 LIVE_AS_OF readiness performance.
-- Narrow commercial-sales resolution to one SKU and period before resolver calls.
-- Does not choose a snapshot run and does not change EXACT_RUN.

create or replace function costing.fn_resolve_sku_commercial_sales_basis_point(
  p_sku_id bigint,
  p_period_start date,
  p_valuation_date date
)
returns setof costing.v_sku_commercial_sales_basis
language sql
stable
security definer
set search_path = costing, public, pg_temp
as $function$
with source_context as materialized (
  select
    sab.period_start,
    cp.valuation_date as management_valuation_date,
    sab.sku_id,
    sab.product_id,
    sab.product_name,
    sab.pack_size,
    sab.pack_uom,
    sab.allocation_basis_status,
    coalesce(sab.actual_sales_units_12m, sab.sales_units_12m) as actual_sales_units_12m,
    coalesce(sab.actual_sales_base_qty_12m, sab.sales_base_qty_12m) as actual_sales_base_qty_12m,
    coalesce(sab.actual_product_sales_units_12m, sab.product_sales_units_12m) as product_sales_units_12m,
    coalesce(sab.actual_product_sales_base_qty_12m, sab.product_sales_base_qty_12m) as product_sales_base_qty_12m,
    sab.product_allocation_share,
    sab.lookback_start,
    sab.lookback_end,
    case
      when coalesce(sab.actual_sales_units_12m, sab.sales_units_12m, 0::numeric) > 0::numeric then null::text
      when coalesce(sab.actual_product_sales_units_12m, sab.product_sales_units_12m, 0::numeric) > 0::numeric then 'NEW_SKU_EXISTING_PRODUCT'::text
      else 'NEW_PRODUCT_NO_HISTORY'::text
    end as required_default_scenario
  from costing.sku_sales_allocation_basis_snapshot sab
  join costing.cost_periods cp on cp.period_start = sab.period_start
  where sab.sku_id = p_sku_id
    and sab.period_start = date_trunc('month', p_period_start::timestamp)::date
    and cp.valuation_date = p_valuation_date
),
resolved_context as (
  select
    s.period_start,
    s.management_valuation_date,
    s.sku_id,
    s.product_id,
    s.product_name,
    s.pack_size,
    s.pack_uom,
    s.allocation_basis_status,
    s.actual_sales_units_12m,
    s.actual_sales_base_qty_12m,
    s.product_sales_units_12m,
    s.product_sales_base_qty_12m,
    s.product_allocation_share,
    s.lookback_start,
    s.lookback_end,
    s.required_default_scenario,
    ar.assumption_id as resolved_assumption_id,
    ar.assumption_basis as resolved_assumption_basis,
    ar.assumed_sales_units as resolved_assumed_sales_units,
    ar.assumed_sales_value as resolved_assumed_sales_value,
    ar.remarks as resolved_assumption_remarks,
    ar.approval_reference as resolved_assumption_approval_reference,
    ar.effective_from as resolved_assumption_effective_from,
    ar.effective_to as resolved_assumption_effective_to,
    ar.resolution_status as assumption_resolution_status,
    ar.qualifying_assumption_count,
    dp.policy_id as resolved_default_policy_id,
    dp.scenario_code as resolved_default_scenario,
    dp.default_sales_units as resolved_default_sales_units,
    dp.effective_from as resolved_default_effective_from,
    dp.effective_to as resolved_default_effective_to,
    dp.resolution_status as default_resolution_status,
    dp.qualifying_policy_count
  from source_context s
  cross join lateral costing.fn_resolve_sku_sales_assumption_as_of(s.period_start, s.sku_id, s.management_valuation_date) ar(
    assumption_id, assumption_basis, assumed_sales_units, assumed_sales_value, remarks, approval_reference,
    effective_from, effective_to, resolution_status, qualifying_assumption_count, resolution_note
  )
  left join lateral costing.fn_resolve_sales_allocation_default_policy_as_of(s.required_default_scenario, s.management_valuation_date) dp(
    policy_id, scenario_code, default_sales_units, effective_from, effective_to, resolution_status, qualifying_policy_count, resolution_note
  ) on s.required_default_scenario is not null
)
select
  period_start,
  sku_id,
  product_id,
  product_name,
  pack_size,
  pack_uom,
  allocation_basis_status,
  actual_sales_units_12m,
  actual_sales_base_qty_12m,
  product_sales_units_12m,
  product_sales_base_qty_12m,
  product_allocation_share,
  lookback_start,
  lookback_end,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumption_id else null::bigint end as assumption_id,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumption_basis else null::text end as manual_assumption_basis,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumed_sales_units else null::numeric end as manual_assumed_sales_units,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumed_sales_value else null::numeric end as manual_assumed_sales_value,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumption_remarks else null::text end as manual_assumption_remarks,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumption_effective_from else null::date end as manual_effective_from,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumption_effective_to else null::date end as manual_effective_to,
  case when assumption_resolution_status = 'RESOLVED'::text then 'ACTIVE'::text else null::text end as manual_assumption_status,
  case
    when assumption_resolution_status = 'AMBIGUOUS'::text then 'UNRESOLVED'::text
    when assumption_resolution_status = 'RESOLVED'::text then resolved_assumption_basis
    when coalesce(actual_sales_units_12m, 0::numeric) > 0::numeric then 'ACTUAL_12M'::text
    when default_resolution_status = 'RESOLVED'::text and required_default_scenario = 'NEW_SKU_EXISTING_PRODUCT'::text then 'DEFAULT_NEW_SKU_EXISTING_PRODUCT'::text
    when default_resolution_status = 'RESOLVED'::text and required_default_scenario = 'NEW_PRODUCT_NO_HISTORY'::text then 'DEFAULT_NEW_PRODUCT_NO_HISTORY'::text
    else 'UNRESOLVED'::text
  end as commercial_sales_basis,
  case
    when assumption_resolution_status = 'AMBIGUOUS'::text then null::numeric
    when assumption_resolution_status = 'RESOLVED'::text then resolved_assumed_sales_units
    when coalesce(actual_sales_units_12m, 0::numeric) > 0::numeric then actual_sales_units_12m
    when default_resolution_status = 'RESOLVED'::text then resolved_default_sales_units
    else null::numeric
  end as commercial_sales_units,
  case when assumption_resolution_status = 'RESOLVED'::text then resolved_assumed_sales_value else null::numeric end as commercial_sales_value,
  case
    when assumption_resolution_status = 'RESOLVED'::text then 'MANUAL'::text
    when assumption_resolution_status = 'AMBIGUOUS'::text then 'SYSTEM_WARNING'::text
    when coalesce(actual_sales_units_12m, 0::numeric) > 0::numeric then 'SYSTEM'::text
    when default_resolution_status = 'RESOLVED'::text then 'SYSTEM'::text
    else 'SYSTEM_WARNING'::text
  end as assumption_source,
  case
    when assumption_resolution_status = 'AMBIGUOUS'::text then 'Commercial sales basis is blocked because multiple SKU assumptions overlap on the governed valuation date.'::text
    when assumption_resolution_status = 'RESOLVED'::text then 'A governed SKU-specific commercial sales assumption is effective on the governed valuation date.'::text
    when coalesce(actual_sales_units_12m, 0::numeric) > 0::numeric then 'Positive cleaned 12-month SKU sales are used.'::text
    when default_resolution_status = 'AMBIGUOUS'::text then 'Commercial sales basis is blocked because multiple governed default policies overlap on the valuation date.'::text
    when default_resolution_status = 'MISSING'::text then 'No governed default sales-allocation policy is effective on the valuation date.'::text
    when default_resolution_status = 'RESOLVED'::text and required_default_scenario = 'NEW_SKU_EXISTING_PRODUCT'::text then 'The SKU has no cleaned sales in the lookback period; the governed new-SKU default quantity is used.'::text
    when default_resolution_status = 'RESOLVED'::text and required_default_scenario = 'NEW_PRODUCT_NO_HISTORY'::text then 'The product has no cleaned sales in the lookback period; the governed new-product default quantity is used.'::text
    else 'Commercial sales basis could not be resolved.'::text
  end as commercial_sales_warning,
  case
    when assumption_resolution_status = 'AMBIGUOUS'::text then 'REVIEW_REQUIRED'::text
    when assumption_resolution_status = 'RESOLVED'::text then 'REVIEW_REQUIRED'::text
    when coalesce(actual_sales_units_12m, 0::numeric) > 0::numeric then 'OK'::text
    when default_resolution_status = 'RESOLVED'::text then 'DEFAULTED'::text
    else 'REVIEW_REQUIRED'::text
  end as commercial_sales_status,
  management_valuation_date,
  case
    when assumption_resolution_status = 'MISSING'::text and coalesce(actual_sales_units_12m, 0::numeric) <= 0::numeric and default_resolution_status = 'RESOLVED'::text then resolved_default_policy_id
    else null::bigint
  end as default_policy_id,
  case
    when assumption_resolution_status = 'MISSING'::text and coalesce(actual_sales_units_12m, 0::numeric) <= 0::numeric and default_resolution_status = 'RESOLVED'::text then resolved_default_scenario
    else null::text
  end as default_policy_scenario,
  case
    when assumption_resolution_status = 'MISSING'::text and coalesce(actual_sales_units_12m, 0::numeric) <= 0::numeric and default_resolution_status = 'RESOLVED'::text then resolved_default_sales_units
    else null::numeric
  end as default_sales_units,
  case
    when assumption_resolution_status = 'MISSING'::text and coalesce(actual_sales_units_12m, 0::numeric) <= 0::numeric and default_resolution_status = 'RESOLVED'::text then resolved_default_effective_from
    else null::date
  end as default_policy_effective_from,
  case
    when assumption_resolution_status = 'MISSING'::text and coalesce(actual_sales_units_12m, 0::numeric) <= 0::numeric and default_resolution_status = 'RESOLVED'::text then resolved_default_effective_to
    else null::date
  end as default_policy_effective_to,
  resolved_assumption_approval_reference as manual_assumption_approval_reference,
  assumption_resolution_status,
  default_resolution_status
from resolved_context;
$function$;

alter function costing.fn_resolve_sku_commercial_sales_basis_point(bigint, date, date) owner to postgres;

revoke all on function costing.fn_resolve_sku_commercial_sales_basis_point(bigint, date, date) from public;
revoke all on function costing.fn_resolve_sku_commercial_sales_basis_point(bigint, date, date) from anon;
revoke all on function costing.fn_resolve_sku_commercial_sales_basis_point(bigint, date, date) from authenticated;

comment on function costing.fn_resolve_sku_commercial_sales_basis_point(bigint, date, date) is
  'Internal LIVE_AS_OF commercial-sales point resolver. Not an API entry. Does not select a snapshot run.';

do $wp02_point$
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
  if src is null then
    raise exception 'readiness RPC not found';
  end if;
  if (length(src) - length(replace(src, old_lookup, ''))) / length(old_lookup) <> 1 then
    raise exception 'LIVE_AS_OF commercial-sales lookup was not found exactly once';
  end if;
  repl := replace(src, old_lookup, new_lookup);
  execute
    'create or replace function public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text default ''LIVE_AS_OF''::text, p_refresh_run_id bigint default null::bigint)
     returns jsonb
     language plpgsql
     stable
     security definer
     set search_path to public, costing, pg_temp
     as $fn$' || repl || '$fn$';
end
$wp02_point$;

revoke all on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) from public;
revoke all on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) from anon;
grant execute on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) to authenticated;
grant execute on function public.rpc_get_product_sku_readiness(bigint, date, text, bigint) to service_role;
