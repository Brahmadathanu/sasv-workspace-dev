-- Gate C: flip PM costing composition to governed as-of BOM identity.
-- BOM identity only. Rate resolution / return contract / MRP / current PLM unchanged.
--
-- DO NOT apply to production until audited.
-- This migration is source-control only until live apply is explicitly approved.

create or replace function costing.fn_build_sku_pm_cost_lines_as_of(
  p_period_start date,
  p_valuation_date date
)
returns table (
  period_start date,
  valuation_date date,
  sku_id bigint,
  product_id bigint,
  product_name text,
  pack_size numeric,
  pack_uom text,
  stock_item_id bigint,
  stock_item_name text,
  uom_id bigint,
  uom_code text,
  qty_per_reference_output numeric,
  wastage_pct numeric,
  qty_required_unit_final numeric,
  is_optional boolean,
  is_override boolean,
  selected_rate numeric,
  rate_source text,
  rate_date date,
  selected_uom_id bigint,
  selected_manual_rate_id bigint,
  selected_purchase_fact_id bigint,
  selected_vendor_id bigint,
  selected_stock_valuation_source text,
  rate_resolution_status text,
  rate_warning_flag boolean,
  rate_warning_code text,
  rate_warning_text text,
  pm_cost_per_sku_line numeric,
  required_missing_rate_block_flag boolean,
  review_required_flag boolean,
  action_required text,
  approval_block_flag boolean,
  acceptance_issue_codes text,
  acceptance_warning_codes text,
  acceptance_action_required_summary text
)
language plpgsql
stable
security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
declare
  v_period_start date;
  v_missing_count integer;
  v_missing_sample text;
begin
  if p_period_start is null then
    raise exception
      'Costing period is required';
  end if;

  if p_valuation_date is null then
    raise exception
      'Valuation date is required';
  end if;

  v_period_start :=
    date_trunc(
      'month',
      p_period_start
    )::date;

  if p_valuation_date < v_period_start
     or p_valuation_date >
        (
          v_period_start
          + interval '1 month - 1 day'
        )::date
  then
    raise exception
      'Valuation date % is outside costing period %',
      p_valuation_date,
      v_period_start;
  end if;

  -- Fail-closed: every active costing SKU must have exactly one governed
  -- revision effective on the valuation date. Do not fall back to current PLM.
  with costing_skus as (
    select ps.id as sku_id
    from public.product_skus ps
    join public.products p
      on p.id = ps.product_id
    where ps.is_active = true
      and coalesce(p.status, '') ilike 'active'
  ),
  coverage as (
    select
      c.sku_id,
      (
        select count(*)::integer
        from public.plm_bom_revision r
        where r.sku_id = c.sku_id
          and r.status in ('APPROVED', 'SUPERSEDED')
          and r.effective_from <= p_valuation_date
          and (r.effective_to is null or r.effective_to >= p_valuation_date)
      ) as rev_count
    from costing_skus c
  )
  select
    count(*) filter (where c.rev_count = 0)::integer,
    string_agg(c.sku_id::text, ',' order by c.sku_id)
      filter (where c.rev_count = 0)
  into
    v_missing_count,
    v_missing_sample
  from coverage c;

  if coalesce(v_missing_count, 0) > 0 then
    raise exception
      'NO_EFFECTIVE_PM_BOM_REVISION: valuation_date=% missing_count=% missing_sku_ids=%',
      p_valuation_date,
      v_missing_count,
      left(coalesce(v_missing_sample, ''), 500)
      using detail = format(
        'Active costing SKUs lack a governed PM-BOM revision effective on %s',
        p_valuation_date
      );
  end if;

  return query

  with requirements as materialized (
    select
      p.sku_id,
      p.product_id,
      p.product_name,
      p.pack_size,
      p.pack_uom,
      p.stock_item_id,
      p.stock_item_name,
      p.uom_id,
      p.uom_code,
      p.qty_per_reference_output,
      p.wastage_pct,
      p.qty_required_unit_final,
      coalesce(p.is_optional, false) as is_optional,
      coalesce(p.is_override, false) as is_override
    from public.plm_sku_requirement_unit_as_of(p_valuation_date) p
  ),

  requested_rate_items as materialized (
    select
      array_agg(
        distinct r.stock_item_id
        order by r.stock_item_id
      ) filter (
        where r.stock_item_id is not null
      ) as stock_item_ids
    from requirements r
  ),

  resolved_rates as materialized (
    select rate.*
    from requested_rate_items x
    cross join lateral
      costing.fn_resolve_material_rates_as_of(
        coalesce(
          x.stock_item_ids,
          array[]::bigint[]
        ),
        p_valuation_date
      ) rate
  )

  select
    v_period_start,
    p_valuation_date,

    r.sku_id,
    r.product_id,
    r.product_name,
    r.pack_size,
    r.pack_uom,

    r.stock_item_id,
    r.stock_item_name,
    r.uom_id,
    r.uom_code,

    r.qty_per_reference_output,
    r.wastage_pct,
    r.qty_required_unit_final,

    r.is_optional,
    r.is_override,

    rate.selected_rate,
    rate.rate_source,
    rate.rate_date,
    rate.selected_uom_id,

    rate.selected_manual_rate_id,
    rate.selected_purchase_fact_id,
    rate.selected_vendor_id,
    rate.selected_stock_valuation_source,

    rate.resolution_status,
    rate.warning_flag,
    rate.warning_code,
    rate.warning_text,

    case
      when rate.resolution_status = 'AMBIGUOUS'
        then null::numeric
      when rate.selected_rate is null
        then null::numeric
      else
        r.qty_required_unit_final
        * rate.selected_rate
    end as pm_cost_per_sku_line,

    case
      when rate.resolution_status = 'AMBIGUOUS'
        then true
      when rate.selected_rate is null
       and r.is_optional = false
        then true
      else false
    end as required_missing_rate_block_flag,

    case
      when rate.resolution_status = 'AMBIGUOUS'
        then false

      when rate.selected_rate is null
       and r.is_optional = true
        then true

      when rate.warning_flag = true
       and rate.selected_rate is not null
        then true

      else false
    end as review_required_flag,

    case
      when rate.resolution_status = 'AMBIGUOUS'
        then 'BLOCKING_AMBIGUOUS_RATE'

      when rate.selected_rate is null
       and r.is_optional = false
        then 'BLOCKING_MISSING_REQUIRED_RATE'

      when rate.selected_rate is null
       and r.is_optional = true
        then 'OPTIONAL_MISSING_RATE'

      when rate.warning_flag = true
       and rate.selected_rate is not null
        then 'REVIEW_RATE'

      else 'OK'
    end as action_required,

    case
      when rate.resolution_status = 'AMBIGUOUS'
        then true

      when rate.selected_rate is null
       and r.is_optional = false
        then true

      else false
    end as approval_block_flag,

    case
      when rate.resolution_status = 'AMBIGUOUS'
        then 'AMBIGUOUS_PM_MATERIAL_RATE'

      when rate.selected_rate is null
       and r.is_optional = true
        then 'OPTIONAL_PM_RATE_MISSING'

      when rate.warning_code = 'STALE_PURCHASE_RATE'
        then 'STALE_PM_PURCHASE_RATE'

      when rate.warning_code = 'STOCK_VALUATION_FALLBACK'
        then 'PM_STOCK_VALUATION_FALLBACK'

      when rate.warning_code = 'MANUAL_RATE_USED'
        then 'PM_MANUAL_RATE_USED'

      when rate.warning_code is not null
        then rate.warning_code

      else null::text
    end as acceptance_issue_codes,

    case
      when rate.selected_rate is null
       and r.is_optional = true
        then 'MISSING_RATE'

      when rate.warning_code is not null
        then rate.warning_code

      else null::text
    end as acceptance_warning_codes,

    case
      when rate.selected_rate is null
       and r.is_optional = true
        then 'OPTIONAL_MISSING_RATE'

      when rate.warning_flag = true
       and rate.selected_rate is not null
        then 'REVIEW_RATE'

      else null::text
    end as acceptance_action_required_summary

  from requirements r

  left join resolved_rates rate
    on rate.stock_item_id = r.stock_item_id;
end;
$function$;
