-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Exact-run RM material cost builder. Existing 2-arg function remains unchanged.
create or replace function costing.fn_build_product_rm_cost_as_of(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    period_start date,
    valuation_date date,
    product_id bigint,
    product_name text,
    product_base_uom text,
    conversion_to_base numeric,
    rm_line_count bigint,
    direct_rm_line_count bigint,
    expanded_sp_line_count bigint,
    form_converted_line_count bigint,
    rm_cost_per_base_unit numeric,
    ok_line_count bigint,
    review_rate_line_count bigint,
    optional_missing_rate_line_count bigint,
    blocking_line_count bigint,
    blocking_stock_item_count bigint,
    stale_purchase_rate_line_count bigint,
    stock_valuation_fallback_line_count bigint,
    manual_rate_line_count bigint,
    calculation_warning_line_count bigint,
    rm_costing_status text,
    rm_costing_note text,
    accepted_review_rate_line_count bigint,
    unaccepted_review_rate_line_count bigint
)
language sql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $$
with run_guard as (
    select 1
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id
      and r.period_start = date_trunc('month',p_period_start)::date
      and r.valuation_date = p_valuation_date
      and r.valuation_context_source = 'CAPTURED_AT_REQUEST'
),
line_classified as (
    select
        l.*,
        case
            when l.rate_warning_code='STALE_PURCHASE_RATE' then 'STALE_RM_PURCHASE_RATE'
            when l.rate_warning_code='STOCK_VALUATION_FALLBACK' then 'RM_STOCK_VALUATION_FALLBACK'
            when l.rate_warning_code='MANUAL_RATE_USED' then 'RM_MANUAL_RATE_USED'
            when l.action_required='OPTIONAL_MISSING_RATE' then 'OPTIONAL_RM_RATE_MISSING'
            when l.calculation_warning_code is not null then l.calculation_warning_code
            when l.rate_warning_code is not null then l.rate_warning_code
            else l.action_required
        end as acceptance_issue_codes,
        case when l.rate_warning_code is not null then l.rate_warning_code else null::text end as acceptance_warning_codes,
        case when l.action_required in ('REVIEW_RATE','OPTIONAL_MISSING_RATE') then l.action_required else null::text end as acceptance_action_required_summary,
        case
            when l.approval_block_flag is not true
             and (l.action_required in ('REVIEW_RATE','OPTIONAL_MISSING_RATE') or l.rate_warning_code is not null)
            then true else false
        end as non_blocking_review_flag
    from costing.fn_build_product_rm_cost_lines_as_of(p_period_start,p_valuation_date) l
    where exists (select 1 from run_guard)
),
line_acceptance as (
    select
        lc.*,
        case
            when lc.non_blocking_review_flag=true
             and exists (
                select 1
                from costing.material_review_acceptance_register ar
                where ar.acceptance_status='ACTIVE'
                  and ar.period_start=date_trunc('month',p_period_start)::date
                  and ar.source_valuation_date=p_valuation_date
                  and ar.source_refresh_run_id=p_refresh_run_id
                  and ar.stock_item_id=lc.purchase_stock_item_id
                  and upper(ar.material_area)='RM'
                  and upper(ar.recommended_ui_route)='MATERIAL_RATE_REVIEW'
                  and coalesce(ar.issue_codes,'')=coalesce(lc.acceptance_issue_codes,'')
                  and coalesce(ar.warning_codes,'')=coalesce(lc.acceptance_warning_codes,'')
                  and coalesce(ar.action_required_summary,'')=coalesce(lc.acceptance_action_required_summary,'')
             )
            then true else false
        end as review_acceptance_active
    from line_classified lc
)
select
    date_trunc('month',p_period_start)::date,
    p_valuation_date,
    product_id,
    product_name,
    product_base_uom,
    max(conversion_to_base),
    count(*)::bigint,
    count(*) filter(where source='RM_BOM')::bigint,
    count(*) filter(where source='SP_BOM')::bigint,
    count(*) filter(where form_conversion_applied=true)::bigint,
    sum(coalesce(rm_cost_per_base_unit_line,0)),
    count(*) filter(where action_required='OK')::bigint,
    count(*) filter(where action_required='REVIEW_RATE' and approval_block_flag is not true)::bigint,
    count(*) filter(where action_required='OPTIONAL_MISSING_RATE' and approval_block_flag is not true)::bigint,
    count(*) filter(where approval_block_flag=true)::bigint,
    count(distinct purchase_stock_item_id) filter(where approval_block_flag=true)::bigint,
    count(*) filter(where rate_warning_code='STALE_PURCHASE_RATE' and approval_block_flag is not true)::bigint,
    count(*) filter(where rate_warning_code='STOCK_VALUATION_FALLBACK' and approval_block_flag is not true)::bigint,
    count(*) filter(where rate_warning_code='MANUAL_RATE_USED' and approval_block_flag is not true)::bigint,
    count(*) filter(where calculation_warning_flag=true)::bigint,
    case
      when count(*) filter(where approval_block_flag=true)>0 then 'BLOCKED'
      when count(*) filter(where non_blocking_review_flag=true and review_acceptance_active is not true)>0 then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when count(*) filter(where approval_block_flag=true)>0 then 'Raw material cost is incomplete because required RM items have missing, ambiguous, or invalid calculation inputs.'
      when count(*) filter(where non_blocking_review_flag=true and review_acceptance_active is not true)>0 then 'Raw material cost can be calculated, but review is required because fallback, stale, manual, or optional-missing rates are present.'
      when count(*) filter(where non_blocking_review_flag=true and review_acceptance_active=true)>0 then 'Raw material cost is ready because all review-required RM rate issues are accepted for this exact costing refresh run.'
      else 'Raw material cost is ready.'
    end,
    count(*) filter(where non_blocking_review_flag=true and review_acceptance_active=true)::bigint,
    count(*) filter(where non_blocking_review_flag=true and review_acceptance_active is not true)::bigint
from line_acceptance
group by product_id,product_name,product_base_uom;
$$;

-- Exact-run PM material cost builder. Existing 2-arg function remains unchanged.
create or replace function costing.fn_build_sku_pm_cost_as_of(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    period_start date,
    valuation_date date,
    sku_id bigint,
    product_id bigint,
    product_name text,
    pack_size numeric,
    pack_uom text,
    pm_line_count bigint,
    required_pm_line_count bigint,
    optional_pm_line_count bigint,
    pm_cost_per_sku numeric,
    blocking_missing_rate_line_count bigint,
    blocking_missing_rate_item_count bigint,
    optional_missing_rate_line_count bigint,
    stale_purchase_rate_line_count bigint,
    stock_valuation_fallback_line_count bigint,
    manual_rate_line_count bigint,
    review_rate_line_count bigint,
    pm_costing_status text,
    pm_costing_note text,
    accepted_review_rate_line_count bigint,
    unaccepted_review_rate_line_count bigint
)
language sql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $$
with run_guard as (
    select 1
    from costing.costing_refresh_run r
    where r.id=p_refresh_run_id
      and r.period_start=date_trunc('month',p_period_start)::date
      and r.valuation_date=p_valuation_date
      and r.valuation_context_source='CAPTURED_AT_REQUEST'
),
line_acceptance as (
    select
        l.*,
        case
          when l.review_required_flag=true
           and l.required_missing_rate_block_flag is not true
           and exists (
              select 1
              from costing.material_review_acceptance_register ar
              where ar.acceptance_status='ACTIVE'
                and ar.period_start=date_trunc('month',p_period_start)::date
                and ar.source_valuation_date=p_valuation_date
                and ar.source_refresh_run_id=p_refresh_run_id
                and ar.stock_item_id=l.stock_item_id
                and upper(ar.material_area)='PM'
                and upper(ar.recommended_ui_route)='MATERIAL_RATE_REVIEW'
                and coalesce(ar.issue_codes,'')=coalesce(l.acceptance_issue_codes,'')
                and coalesce(ar.warning_codes,'')=coalesce(l.acceptance_warning_codes,'')
                and coalesce(ar.action_required_summary,'')=coalesce(l.acceptance_action_required_summary,'')
           )
          then true else false
        end as review_acceptance_active
    from costing.fn_build_sku_pm_cost_lines_as_of(p_period_start,p_valuation_date) l
    where exists (select 1 from run_guard)
),
aggregated as (
    select
      date_trunc('month',p_period_start)::date as period_start,
      p_valuation_date as valuation_date,
      sku_id,product_id,product_name,pack_size,pack_uom,
      count(*)::bigint as pm_line_count,
      count(*) filter(where is_optional=false)::bigint as required_pm_line_count,
      count(*) filter(where is_optional=true)::bigint as optional_pm_line_count,
      count(*) filter(where approval_block_flag=true)::bigint as blocking_missing_rate_line_count,
      count(distinct stock_item_id) filter(where approval_block_flag=true)::bigint as blocking_missing_rate_item_count,
      count(*) filter(where action_required='OPTIONAL_MISSING_RATE')::bigint as optional_missing_rate_line_count,
      count(*) filter(where rate_warning_code='STALE_PURCHASE_RATE')::bigint as stale_purchase_rate_line_count,
      count(*) filter(where rate_warning_code='STOCK_VALUATION_FALLBACK')::bigint as stock_valuation_fallback_line_count,
      count(*) filter(where rate_warning_code='MANUAL_RATE_USED')::bigint as manual_rate_line_count,
      count(*) filter(where review_required_flag=true)::bigint as review_rate_line_count,
      count(*) filter(where review_required_flag=true and review_acceptance_active=true)::bigint as accepted_review_rate_line_count,
      count(*) filter(where review_required_flag=true and review_acceptance_active is not true)::bigint as unaccepted_review_rate_line_count,
      sum(pm_cost_per_sku_line) filter(where pm_cost_per_sku_line is not null) as calculated_pm_cost
    from line_acceptance
    group by sku_id,product_id,product_name,pack_size,pack_uom
)
select
  period_start,valuation_date,sku_id,product_id,product_name,pack_size,pack_uom,
  pm_line_count,required_pm_line_count,optional_pm_line_count,
  case when blocking_missing_rate_line_count>0 then null::numeric else calculated_pm_cost end,
  blocking_missing_rate_line_count,blocking_missing_rate_item_count,
  optional_missing_rate_line_count,stale_purchase_rate_line_count,stock_valuation_fallback_line_count,manual_rate_line_count,review_rate_line_count,
  case when blocking_missing_rate_line_count>0 then 'BLOCKED' when unaccepted_review_rate_line_count>0 then 'REVIEW_REQUIRED' else 'READY' end,
  case
    when blocking_missing_rate_line_count>0 then 'Packing material cost is incomplete because required PM items have missing or ambiguous rates.'
    when unaccepted_review_rate_line_count>0 then 'Packing material cost can be calculated, but review is required because fallback, stale, manual, or optional-missing rates are present.'
    when accepted_review_rate_line_count>0 then 'Packing material cost is ready because all review-required PM rate issues are accepted for this exact costing refresh run.'
    else 'Packing material cost is ready.'
  end,
  accepted_review_rate_line_count,unaccepted_review_rate_line_count
from aggregated;
$$;

-- Exact-run combined material-cost builder. Existing 2-arg function remains unchanged.
create or replace function costing.fn_build_sku_material_cost_as_of(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    period_start date,
    valuation_date date,
    sku_id bigint,
    product_id bigint,
    product_name text,
    pack_size numeric,
    pack_uom text,
    product_base_uom text,
    conversion_to_base numeric,
    rm_cost_per_base_unit numeric,
    rm_cost_per_sku numeric,
    pm_cost_per_sku numeric,
    material_cost_per_sku numeric,
    rm_costing_status text,
    pm_costing_status text,
    rm_blocking_line_count bigint,
    rm_blocking_stock_item_count bigint,
    pm_blocking_line_count bigint,
    pm_blocking_stock_item_count bigint,
    rm_review_rate_line_count bigint,
    pm_review_rate_line_count bigint,
    rm_stale_purchase_rate_line_count bigint,
    pm_stale_purchase_rate_line_count bigint,
    rm_stock_valuation_fallback_line_count bigint,
    pm_stock_valuation_fallback_line_count bigint,
    rm_manual_rate_line_count bigint,
    pm_manual_rate_line_count bigint,
    material_costing_status text,
    material_costing_note text,
    rm_accepted_review_rate_line_count bigint,
    pm_accepted_review_rate_line_count bigint,
    rm_unaccepted_review_rate_line_count bigint,
    pm_unaccepted_review_rate_line_count bigint,
    material_review_acceptance_note text
)
language sql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $$
with rm as materialized (
  select * from costing.fn_build_product_rm_cost_as_of(p_period_start,p_valuation_date,p_refresh_run_id)
),
pm as materialized (
  select * from costing.fn_build_sku_pm_cost_as_of(p_period_start,p_valuation_date,p_refresh_run_id)
),
base as (
  select
    date_trunc('month',p_period_start)::date as period_start,
    p_valuation_date as valuation_date,
    ps.id as sku_id, ps.product_id, p.item as product_name, ps.pack_size, ps.uom as pack_uom,
    rm.product_base_uom,rm.conversion_to_base,
    case when rm.product_id is null or rm.rm_costing_status='BLOCKED' then null::numeric else rm.rm_cost_per_base_unit end as rm_cost_per_base_unit,
    case when rm.product_id is null or rm.rm_costing_status='BLOCKED' or rm.rm_cost_per_base_unit is null or ps.pack_size is null or rm.conversion_to_base is null then null::numeric else rm.rm_cost_per_base_unit*ps.pack_size*rm.conversion_to_base end as rm_cost_per_sku,
    case when pm.sku_id is null or pm.pm_costing_status='BLOCKED' then null::numeric else pm.pm_cost_per_sku end as pm_cost_per_sku,
    rm.rm_costing_status,pm.pm_costing_status,
    coalesce(rm.blocking_line_count,0)::bigint as rm_blocking_line_count,
    coalesce(rm.blocking_stock_item_count,0)::bigint as rm_blocking_stock_item_count,
    coalesce(pm.blocking_missing_rate_line_count,0)::bigint as pm_blocking_line_count,
    coalesce(pm.blocking_missing_rate_item_count,0)::bigint as pm_blocking_stock_item_count,
    coalesce(rm.review_rate_line_count,0)::bigint as rm_review_rate_line_count,
    coalesce(pm.review_rate_line_count,0)::bigint as pm_review_rate_line_count,
    coalesce(rm.stale_purchase_rate_line_count,0)::bigint as rm_stale_purchase_rate_line_count,
    coalesce(pm.stale_purchase_rate_line_count,0)::bigint as pm_stale_purchase_rate_line_count,
    coalesce(rm.stock_valuation_fallback_line_count,0)::bigint as rm_stock_valuation_fallback_line_count,
    coalesce(pm.stock_valuation_fallback_line_count,0)::bigint as pm_stock_valuation_fallback_line_count,
    coalesce(rm.manual_rate_line_count,0)::bigint as rm_manual_rate_line_count,
    coalesce(pm.manual_rate_line_count,0)::bigint as pm_manual_rate_line_count,
    coalesce(rm.accepted_review_rate_line_count,0)::bigint as rm_accepted_review_rate_line_count,
    coalesce(pm.accepted_review_rate_line_count,0)::bigint as pm_accepted_review_rate_line_count,
    coalesce(rm.unaccepted_review_rate_line_count,0)::bigint as rm_unaccepted_review_rate_line_count,
    coalesce(pm.unaccepted_review_rate_line_count,0)::bigint as pm_unaccepted_review_rate_line_count
  from public.product_skus ps
  join public.products p on p.id=ps.product_id
  left join rm on rm.product_id=ps.product_id
  left join pm on pm.sku_id=ps.id
  where ps.is_active=true and coalesce(p.status,'') ilike 'active'
),
classified as (
  select b.*,
    case when b.rm_cost_per_sku is null or b.pm_cost_per_sku is null then null::numeric else b.rm_cost_per_sku+b.pm_cost_per_sku end as material_cost_per_sku,
    case
      when b.rm_costing_status is null or b.pm_costing_status is null then 'BLOCKED'
      when b.rm_costing_status='BLOCKED' or b.pm_costing_status='BLOCKED' then 'BLOCKED'
      when b.rm_costing_status='REVIEW_REQUIRED' or b.pm_costing_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end as material_costing_status
  from base b
)
select
  period_start,valuation_date,sku_id,product_id,product_name,pack_size,pack_uom,product_base_uom,conversion_to_base,
  rm_cost_per_base_unit,rm_cost_per_sku,pm_cost_per_sku,material_cost_per_sku,rm_costing_status,pm_costing_status,
  rm_blocking_line_count,rm_blocking_stock_item_count,pm_blocking_line_count,pm_blocking_stock_item_count,
  rm_review_rate_line_count,pm_review_rate_line_count,rm_stale_purchase_rate_line_count,pm_stale_purchase_rate_line_count,
  rm_stock_valuation_fallback_line_count,pm_stock_valuation_fallback_line_count,rm_manual_rate_line_count,pm_manual_rate_line_count,
  material_costing_status,
  case
    when rm_costing_status is null then 'Material cost is blocked because RM standard cost is missing for this product.'
    when pm_costing_status is null then 'Material cost is blocked because no governed PM requirement result exists for this SKU.'
    when material_costing_status='BLOCKED' then 'Material cost is incomplete because RM or PM has blocking missing, ambiguous, or invalid required inputs.'
    when material_costing_status='REVIEW_REQUIRED' then 'Material cost can be calculated, but review is required because RM or PM has unaccepted fallback, stale, manual, or optional-missing rate issues.'
    when rm_accepted_review_rate_line_count>0 or pm_accepted_review_rate_line_count>0 then 'Material cost is ready because all review-required material-rate issues are accepted for this exact costing refresh run.'
    else 'Material cost is ready.'
  end,
  rm_accepted_review_rate_line_count,pm_accepted_review_rate_line_count,
  rm_unaccepted_review_rate_line_count,pm_unaccepted_review_rate_line_count,
  case when rm_accepted_review_rate_line_count>0 or pm_accepted_review_rate_line_count>0 then 'One or more material review warnings are accepted for this exact costing refresh run.' else null::text end
from classified;
$$;

-- Route immutable material snapshot generation through the exact-run builder.
create or replace function costing.rpc_refresh_sku_material_cost_snapshot(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(refreshed_at timestamptz, inserted_row_count bigint, blocked_sku_count bigint, review_required_sku_count bigint, ready_sku_count bigint)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
    v_period_start date;
    v_refreshed_at timestamptz := now();
    v_inserted bigint := 0;
    v_run costing.costing_refresh_run%rowtype;
    v_rm_line_result record;
    v_pm_line_result record;
begin
    if p_period_start is null then raise exception 'Costing period is required'; end if;
    if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
    if p_refresh_run_id is null then raise exception 'Refresh run ID is required'; end if;

    v_period_start := date_trunc('month',p_period_start)::date;
    select r.* into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date then
      raise exception 'Material snapshot context does not match refresh run %',p_refresh_run_id;
    end if;
    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
      raise exception 'Refresh run % does not have captured valuation context',p_refresh_run_id;
    end if;
    if p_valuation_date<v_period_start or p_valuation_date>=(v_period_start+interval '1 month')::date then
      raise exception 'Valuation date % is outside costing period %',p_valuation_date,v_period_start;
    end if;

    delete from costing.sku_material_cost_snapshot sm
    where sm.period_start=v_period_start and sm.valuation_date=p_valuation_date and sm.refresh_run_id=p_refresh_run_id;

    insert into costing.sku_material_cost_snapshot(
      period_start,valuation_date,refresh_run_id,calculated_at,sku_id,product_id,product_name,pack_size,pack_uom,product_base_uom,conversion_to_base,
      rm_cost_per_base_unit,rm_cost_per_sku,pm_cost_per_sku,material_cost_per_sku,material_costing_status,rm_costing_status,pm_costing_status,
      rm_blocking_line_count,rm_blocking_stock_item_count,pm_blocking_line_count,pm_blocking_stock_item_count,
      rm_review_rate_line_count,pm_review_rate_line_count,rm_stale_purchase_rate_line_count,pm_stale_purchase_rate_line_count,
      rm_stock_valuation_fallback_line_count,pm_stock_valuation_fallback_line_count,rm_manual_rate_line_count,pm_manual_rate_line_count,
      material_costing_note,rm_accepted_review_rate_line_count,pm_accepted_review_rate_line_count,rm_unaccepted_review_rate_line_count,pm_unaccepted_review_rate_line_count,material_review_acceptance_note
    )
    select
      v_period_start,p_valuation_date,p_refresh_run_id,v_refreshed_at,
      b.sku_id,b.product_id,b.product_name,b.pack_size,b.pack_uom,b.product_base_uom,b.conversion_to_base,
      b.rm_cost_per_base_unit,b.rm_cost_per_sku,b.pm_cost_per_sku,b.material_cost_per_sku,b.material_costing_status,b.rm_costing_status,b.pm_costing_status,
      b.rm_blocking_line_count,b.rm_blocking_stock_item_count,b.pm_blocking_line_count,b.pm_blocking_stock_item_count,
      b.rm_review_rate_line_count,b.pm_review_rate_line_count,b.rm_stale_purchase_rate_line_count,b.pm_stale_purchase_rate_line_count,
      b.rm_stock_valuation_fallback_line_count,b.pm_stock_valuation_fallback_line_count,b.rm_manual_rate_line_count,b.pm_manual_rate_line_count,
      b.material_costing_note,b.rm_accepted_review_rate_line_count,b.pm_accepted_review_rate_line_count,b.rm_unaccepted_review_rate_line_count,b.pm_unaccepted_review_rate_line_count,b.material_review_acceptance_note
    from costing.fn_build_sku_material_cost_as_of(v_period_start,p_valuation_date,p_refresh_run_id) b;

    get diagnostics v_inserted=row_count;

    select * into v_rm_line_result
    from costing.rpc_refresh_rm_material_cost_line_snapshots(v_period_start,p_valuation_date,p_refresh_run_id);
    if v_rm_line_result.refresh_status is distinct from 'SUCCESS' then
      raise exception 'Frozen RM line snapshot failed for refresh run %',p_refresh_run_id;
    end if;

    select * into v_pm_line_result
    from costing.rpc_refresh_sku_pm_material_cost_line_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
    if v_pm_line_result.refresh_status is distinct from 'SUCCESS' then
      raise exception 'Frozen PM line snapshot failed for refresh run %',p_refresh_run_id;
    end if;

    return query
    select v_refreshed_at,v_inserted,
      count(*) filter(where sm.material_costing_status='BLOCKED')::bigint,
      count(*) filter(where sm.material_costing_status='REVIEW_REQUIRED')::bigint,
      count(*) filter(where sm.material_costing_status='READY')::bigint
    from costing.sku_material_cost_snapshot sm
    where sm.period_start=v_period_start and sm.valuation_date=p_valuation_date and sm.refresh_run_id=p_refresh_run_id;
end;
$$;

-- Ensure frozen RM-line aggregate reconciliation uses the same exact-run acceptance scope.
create or replace function costing.rpc_refresh_rm_material_cost_line_snapshots(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    refreshed_period_start date,
    valuation_date date,
    refresh_run_id bigint,
    deleted_product_line_count bigint,
    inserted_product_line_count bigint,
    deleted_sku_line_count bigint,
    inserted_sku_line_count bigint,
    product_count bigint,
    sku_count bigint,
    product_total_mismatch_count bigint,
    sku_total_mismatch_count bigint,
    blocked_sku_integrity_mismatch_count bigint,
    captured_at timestamptz,
    refresh_status text
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
    v_period_start date:=date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_deleted_product_lines bigint:=0;
    v_inserted_product_lines bigint:=0;
    v_deleted_sku_lines bigint:=0;
    v_inserted_sku_lines bigint:=0;
    v_product_count bigint:=0;
    v_sku_count bigint:=0;
    v_product_total_mismatch_count bigint:=0;
    v_sku_total_mismatch_count bigint:=0;
    v_blocked_sku_integrity_mismatch_count bigint:=0;
    v_material_snapshot_count bigint:=0;
    v_captured_at timestamptz:=clock_timestamp();
    v_lock_key bigint;
begin
    if p_period_start is null then raise exception 'Costing period is required'; end if;
    if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
    if p_refresh_run_id is null then raise exception 'Refresh run ID is required'; end if;
    select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date then raise exception 'RM material-line context does not match refresh run %',p_refresh_run_id; end if;
    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then raise exception 'Refresh run % is not based on captured valuation context',p_refresh_run_id; end if;
    if p_valuation_date<v_period_start or p_valuation_date>=(v_period_start+interval '1 month')::date then raise exception 'Valuation date % is outside costing period %',p_valuation_date,v_period_start; end if;

    v_lock_key:=hashtext('rm_material_cost_line_snapshot_'||p_refresh_run_id::text)::bigint;
    perform pg_advisory_xact_lock(v_lock_key);

    select count(*)::bigint into v_material_snapshot_count
    from costing.sku_material_cost_snapshot s
    where s.period_start=v_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id;
    if v_material_snapshot_count=0 then raise exception 'No exact SKU material snapshot exists for refresh run %',p_refresh_run_id; end if;

    drop table if exists pg_temp.c7b4_product_rm_line_build;
    create temporary table c7b4_product_rm_line_build on commit drop as
      select * from costing.fn_build_product_rm_cost_lines_as_of(v_period_start,p_valuation_date);
    alter table pg_temp.c7b4_product_rm_line_build add column source_duplicate_ordinal integer;

    with ranked as (
      select l.ctid as source_ctid,
        row_number() over(
          partition by md5(concat_ws('|',l.product_id::text,coalesce(l.root_bom_id::text,''),coalesce(l.source,''),coalesce(l.level::text,''),coalesce(l.parent_bom_type,''),l.consume_stock_item_id::text,l.purchase_stock_item_id::text,coalesce(l.consume_uom_id::text,''),coalesce(l.purchase_uom_id::text,''),coalesce(l.form_conversion_id::text,''),coalesce(l.explosion_path::text,''),coalesce(l.qty_consume_form_per_base_unit::text,''),coalesce(l.qty_purchase_form_per_base_unit::text,''),coalesce(l.selected_rate::text,''),coalesce(l.rate_source,''),coalesce(l.rate_date::text,''),coalesce(l.selected_manual_rate_id::text,''),coalesce(l.selected_purchase_fact_id::text,''),coalesce(l.selected_stock_valuation_source,'')))
          order by to_jsonb(l)::text,l.ctid
        )::integer as source_duplicate_ordinal
      from pg_temp.c7b4_product_rm_line_build l
    )
    update pg_temp.c7b4_product_rm_line_build l set source_duplicate_ordinal=r.source_duplicate_ordinal from ranked r where l.ctid=r.source_ctid;

    if exists(select 1 from pg_temp.c7b4_product_rm_line_build where source_duplicate_ordinal is null or source_duplicate_ordinal<=0) then raise exception 'Canonical RM source-line occurrence ordinal assignment failed for refresh run %',p_refresh_run_id; end if;
    if not exists(select 1 from pg_temp.c7b4_product_rm_line_build) then raise exception 'Canonical RM line builder returned no rows for run %',p_refresh_run_id; end if;
    if exists(select 1 from pg_temp.c7b4_product_rm_line_build l where l.period_start is distinct from v_period_start or l.valuation_date is distinct from p_valuation_date or l.product_id is null or l.consume_stock_item_id is null or l.purchase_stock_item_id is null or l.explosion_path is null) then raise exception 'Canonical RM line builder returned incomplete or mismatched identities for run %',p_refresh_run_id; end if;

    with line_totals as (
      select product_id,sum(coalesce(rm_cost_per_base_unit_line,0::numeric)) as line_rm_cost_per_base_unit
      from pg_temp.c7b4_product_rm_line_build group by product_id
    ), product_totals as materialized (
      select * from costing.fn_build_product_rm_cost_as_of(v_period_start,p_valuation_date,p_refresh_run_id)
    )
    select count(*)::bigint into v_product_total_mismatch_count
    from product_totals p left join line_totals l on l.product_id=p.product_id
    where l.product_id is null or p.rm_cost_per_base_unit is distinct from l.line_rm_cost_per_base_unit;
    if v_product_total_mismatch_count>0 then raise exception 'Canonical product RM line totals mismatch for % products in refresh run %',v_product_total_mismatch_count,p_refresh_run_id; end if;

    delete from costing.sku_rm_material_cost_line_snapshot s where s.period_start=v_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id;
    get diagnostics v_deleted_sku_lines=row_count;
    delete from costing.product_rm_material_cost_line_snapshot s where s.period_start=v_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id;
    get diagnostics v_deleted_product_lines=row_count;

    insert into costing.product_rm_material_cost_line_snapshot(
      period_start,valuation_date,refresh_run_id,source_line_key,product_id,product_name,product_base_uom,conversion_to_base,root_bom_id,reference_output_qty,reference_output_uom_code,process_loss_pct,
      consume_stock_item_id,consume_stock_item_name,purchase_stock_item_id,purchase_stock_item_name,consume_uom_id,consume_uom_code,purchase_uom_id,purchase_uom_code,qty_consume_form_per_base_unit,qty_purchase_form_per_base_unit,
      form_conversion_factor,form_conversion_applied,form_conversion_id,form_conversion_status,bom_source,level,parent_bom_type,explosion_path,is_optional,selected_rate,rate_source,rate_date,selected_uom_id,
      selected_manual_rate_id,selected_purchase_fact_id,selected_vendor_id,selected_stock_valuation_source,rate_resolution_status,rate_warning_flag,rate_warning_code,rate_warning_text,rm_cost_per_base_unit_line,action_required,approval_block_flag,
      calculation_warning_flag,calculation_warning_code,semi_stock_item_ids,semi_stock_item_names,captured_at
    )
    select
      v_period_start,p_valuation_date,p_refresh_run_id,
      md5(concat_ws('|',p_refresh_run_id::text,l.product_id::text,coalesce(l.root_bom_id::text,''),coalesce(l.source,''),coalesce(l.level::text,''),coalesce(l.parent_bom_type,''),l.consume_stock_item_id::text,l.purchase_stock_item_id::text,coalesce(l.consume_uom_id::text,''),coalesce(l.purchase_uom_id::text,''),coalesce(l.form_conversion_id::text,''),coalesce(l.explosion_path::text,''),coalesce(l.qty_consume_form_per_base_unit::text,''),coalesce(l.qty_purchase_form_per_base_unit::text,''),coalesce(l.selected_rate::text,''),coalesce(l.rate_source,''),coalesce(l.rate_date::text,''),coalesce(l.selected_manual_rate_id::text,''),coalesce(l.selected_purchase_fact_id::text,''),coalesce(l.selected_stock_valuation_source,''),l.source_duplicate_ordinal::text)),
      l.product_id,l.product_name,l.product_base_uom,l.conversion_to_base,l.root_bom_id,l.reference_output_qty,l.reference_output_uom_code,l.process_loss_pct,l.consume_stock_item_id,l.consume_stock_item_name,l.purchase_stock_item_id,l.purchase_stock_item_name,
      l.consume_uom_id,l.consume_uom_code,l.purchase_uom_id,l.purchase_uom_code,l.qty_consume_form_per_base_unit,l.qty_purchase_form_per_base_unit,l.form_conversion_factor,l.form_conversion_applied,l.form_conversion_id,l.form_conversion_status,
      l.source,l.level,l.parent_bom_type,l.explosion_path,l.is_optional,l.selected_rate,l.rate_source,l.rate_date,l.selected_uom_id,l.selected_manual_rate_id,l.selected_purchase_fact_id,l.selected_vendor_id,l.selected_stock_valuation_source,
      l.rate_resolution_status,l.rate_warning_flag,l.rate_warning_code,l.rate_warning_text,l.rm_cost_per_base_unit_line,l.action_required,coalesce(l.approval_block_flag,false),coalesce(l.calculation_warning_flag,false),l.calculation_warning_code,
      semi.semi_stock_item_ids,semi.semi_stock_item_names,v_captured_at
    from pg_temp.c7b4_product_rm_line_build l
    left join lateral (
      with path_tokens as (
        select regexp_replace(path_item::text,'\"','','g') as path_token
        from jsonb_array_elements(coalesce(l.explosion_path,'[]'::jsonb)) as path_item
      ), semi_tokens as (
        select replace(path_token,'SEMI:','')::bigint as semi_stock_item_id from path_tokens where path_token like 'SEMI:%'
      )
      select jsonb_agg(distinct st.semi_stock_item_id order by st.semi_stock_item_id) as semi_stock_item_ids,
             string_agg(distinct si.name,', ' order by si.name) as semi_stock_item_names
      from semi_tokens st left join public.inv_stock_item si on si.id=st.semi_stock_item_id
    ) semi on true;
    get diagnostics v_inserted_product_lines=row_count;

    insert into costing.sku_rm_material_cost_line_snapshot(
      period_start,valuation_date,refresh_run_id,sku_line_key,product_rm_material_cost_line_snapshot_id,sku_material_cost_snapshot_id,sku_id,product_id,product_name,sku_column_label,pack_size,pack_uom,product_base_uom,conversion_to_base,line_sort,bom_source,level,parent_bom_type,
      consume_stock_item_id,consume_stock_item_name,purchase_stock_item_id,purchase_stock_item_name,consume_uom_id,consume_uom_code,purchase_uom_id,purchase_uom_code,qty_consume_form_per_base_unit,qty_purchase_form_per_base_unit,sku_qty_purchase_form,
      form_conversion_applied,form_conversion_factor,form_conversion_id,form_conversion_status,selected_rate,rate_source,rate_date,selected_uom_id,selected_manual_rate_id,selected_purchase_fact_id,selected_vendor_id,selected_stock_valuation_source,rate_resolution_status,
      rm_cost_per_base_unit_line,rm_cost_per_sku_line,rm_cost_share_percent,rate_warning_flag,rate_warning_code,rate_warning_text,action_required,approval_block_flag,calculation_warning_flag,calculation_warning_code,explosion_path,semi_stock_item_ids,semi_stock_item_names,
      expansion_note,review_state_label,captured_at
    )
    with expanded as (
      select pl.id as product_line_snapshot_id,sm.id as sku_material_snapshot_id,sm.sku_id,sm.product_id,sm.product_name,concat_ws(' ',nullif(btrim(sm.pack_size::text),''),nullif(btrim(sm.pack_uom),'')) as sku_column_label,
        sm.pack_size,sm.pack_uom,sm.product_base_uom,sm.conversion_to_base,pl.source_line_key,pl.bom_source,pl.level,pl.parent_bom_type,pl.consume_stock_item_id,pl.consume_stock_item_name,pl.purchase_stock_item_id,pl.purchase_stock_item_name,
        pl.consume_uom_id,pl.consume_uom_code,pl.purchase_uom_id,pl.purchase_uom_code,pl.qty_consume_form_per_base_unit,pl.qty_purchase_form_per_base_unit,
        case when pl.qty_purchase_form_per_base_unit is null or sm.pack_size is null or sm.conversion_to_base is null then null::numeric else pl.qty_purchase_form_per_base_unit*sm.pack_size*sm.conversion_to_base end as sku_qty_purchase_form,
        pl.form_conversion_applied,pl.form_conversion_factor,pl.form_conversion_id,pl.form_conversion_status,pl.selected_rate,pl.rate_source,pl.rate_date,pl.selected_uom_id,pl.selected_manual_rate_id,pl.selected_purchase_fact_id,pl.selected_vendor_id,pl.selected_stock_valuation_source,
        pl.rate_resolution_status,pl.rm_cost_per_base_unit_line,
        case when pl.rm_cost_per_base_unit_line is null or sm.pack_size is null or sm.conversion_to_base is null then null::numeric else pl.rm_cost_per_base_unit_line*sm.pack_size*sm.conversion_to_base end as rm_cost_per_sku_line,
        sm.rm_cost_per_sku,pl.rate_warning_flag,pl.rate_warning_code,pl.rate_warning_text,pl.action_required,pl.approval_block_flag,pl.calculation_warning_flag,pl.calculation_warning_code,pl.explosion_path,pl.semi_stock_item_ids,pl.semi_stock_item_names,
        case when pl.semi_stock_item_names is not null then 'Expanded from semi-processed item: '||pl.semi_stock_item_names when pl.bom_source='RM_BOM' then 'Direct RM BOM line' else coalesce(pl.bom_source,'RM line') end as expansion_note,
        case when pl.approval_block_flag=true then 'Blocked' when pl.calculation_warning_flag=true then 'Calculation warning' when pl.action_required='REVIEW_RATE' then 'Review rate' when pl.rate_warning_flag=true then 'Review rate' when pl.action_required='OK' then 'OK' else coalesce(pl.action_required,'OK') end as review_state_label
      from costing.product_rm_material_cost_line_snapshot pl
      join costing.sku_material_cost_snapshot sm on sm.period_start=pl.period_start and sm.valuation_date=pl.valuation_date and sm.refresh_run_id=pl.refresh_run_id and sm.product_id=pl.product_id
      where pl.period_start=v_period_start and pl.valuation_date=p_valuation_date and pl.refresh_run_id=p_refresh_run_id
    ), numbered as (
      select e.*,row_number() over(partition by e.product_id,e.sku_id order by case when e.bom_source='RM_BOM' then 0 else 1 end,e.level nulls last,e.consume_stock_item_name,e.purchase_stock_item_name,e.consume_stock_item_id,e.purchase_stock_item_id,e.explosion_path::text,e.qty_purchase_form_per_base_unit,e.selected_rate,e.rm_cost_per_base_unit_line,e.product_line_snapshot_id)::integer as line_sort
      from expanded e
    )
    select v_period_start,p_valuation_date,p_refresh_run_id,md5(concat_ws('|',p_refresh_run_id::text,n.product_line_snapshot_id::text,n.sku_id::text)),n.product_line_snapshot_id,n.sku_material_snapshot_id,n.sku_id,n.product_id,n.product_name,n.sku_column_label,n.pack_size,n.pack_uom,n.product_base_uom,n.conversion_to_base,n.line_sort,
      n.bom_source,n.level,n.parent_bom_type,n.consume_stock_item_id,n.consume_stock_item_name,n.purchase_stock_item_id,n.purchase_stock_item_name,n.consume_uom_id,n.consume_uom_code,n.purchase_uom_id,n.purchase_uom_code,n.qty_consume_form_per_base_unit,n.qty_purchase_form_per_base_unit,n.sku_qty_purchase_form,
      n.form_conversion_applied,n.form_conversion_factor,n.form_conversion_id,n.form_conversion_status,n.selected_rate,n.rate_source,n.rate_date,n.selected_uom_id,n.selected_manual_rate_id,n.selected_purchase_fact_id,n.selected_vendor_id,n.selected_stock_valuation_source,n.rate_resolution_status,n.rm_cost_per_base_unit_line,n.rm_cost_per_sku_line,
      case when n.rm_cost_per_sku is null or n.rm_cost_per_sku=0 or n.rm_cost_per_sku_line is null then null::numeric else n.rm_cost_per_sku_line/n.rm_cost_per_sku*100 end,
      n.rate_warning_flag,n.rate_warning_code,n.rate_warning_text,n.action_required,n.approval_block_flag,n.calculation_warning_flag,n.calculation_warning_code,n.explosion_path,n.semi_stock_item_ids,n.semi_stock_item_names,n.expansion_note,n.review_state_label,v_captured_at
    from numbered n;
    get diagnostics v_inserted_sku_lines=row_count;

    with line_totals as (
      select sl.sku_id,sum(sl.rm_cost_per_sku_line) filter(where sl.rm_cost_per_sku_line is not null) as line_rm_cost_per_sku,count(*) filter(where sl.approval_block_flag=true)::bigint as blocking_line_count
      from costing.sku_rm_material_cost_line_snapshot sl
      where sl.period_start=v_period_start and sl.valuation_date=p_valuation_date and sl.refresh_run_id=p_refresh_run_id group by sl.sku_id
    )
    select count(*)::bigint into v_sku_total_mismatch_count
    from costing.sku_material_cost_snapshot sm left join line_totals lt on lt.sku_id=sm.sku_id
    where sm.period_start=v_period_start and sm.valuation_date=p_valuation_date and sm.refresh_run_id=p_refresh_run_id and sm.rm_costing_status<>'BLOCKED'
      and (lt.sku_id is null or sm.rm_cost_per_sku is distinct from lt.line_rm_cost_per_sku);

    with line_totals as (
      select sl.sku_id,count(*) filter(where sl.approval_block_flag=true)::bigint as blocking_line_count
      from costing.sku_rm_material_cost_line_snapshot sl
      where sl.period_start=v_period_start and sl.valuation_date=p_valuation_date and sl.refresh_run_id=p_refresh_run_id group by sl.sku_id
    )
    select count(*)::bigint into v_blocked_sku_integrity_mismatch_count
    from costing.sku_material_cost_snapshot sm left join line_totals lt on lt.sku_id=sm.sku_id
    where sm.period_start=v_period_start and sm.valuation_date=p_valuation_date and sm.refresh_run_id=p_refresh_run_id and sm.rm_costing_status='BLOCKED'
      and (sm.rm_cost_per_sku is not null or coalesce(lt.blocking_line_count,0)=0);

    if v_sku_total_mismatch_count>0 then raise exception 'Frozen RM SKU line totals mismatch for % non-blocked SKUs in refresh run %',v_sku_total_mismatch_count,p_refresh_run_id; end if;
    if v_blocked_sku_integrity_mismatch_count>0 then raise exception 'Frozen RM blocked-SKU integrity failed for % SKUs in refresh run %',v_blocked_sku_integrity_mismatch_count,p_refresh_run_id; end if;

    select count(distinct product_id)::bigint,count(distinct sku_id)::bigint into v_product_count,v_sku_count
    from costing.sku_rm_material_cost_line_snapshot s where s.period_start=v_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id;

    return query select v_period_start,p_valuation_date,p_refresh_run_id,v_deleted_product_lines,v_inserted_product_lines,v_deleted_sku_lines,v_inserted_sku_lines,v_product_count,v_sku_count,v_product_total_mismatch_count,v_sku_total_mismatch_count,v_blocked_sku_integrity_mismatch_count,v_captured_at,'SUCCESS'::text;
end;
$$;