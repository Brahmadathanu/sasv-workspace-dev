-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.rpc_refresh_sku_prime_cost_snapshot(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns table(
  refreshed_period_start date,
  inserted_row_count bigint,
  blocked_count bigint,
  review_required_count bigint,
  ready_count bigint
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_material_count bigint;
    v_labour_count bigint;
    v_material_distinct_count bigint;
    v_labour_distinct_count bigint;
begin
    if p_period_start is null then raise exception 'Costing period is required.'; end if;
    if p_valuation_date is null then raise exception 'Valuation date is required.'; end if;
    if p_refresh_run_id is null then raise exception 'Refresh run ID is required.'; end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % does not exist.', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date then
        raise exception 'Prime-cost context does not match refresh run %.', p_refresh_run_id;
    end if;

    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Refresh run % is not based on captured-at-request valuation context.', p_refresh_run_id;
    end if;

    perform * from costing.rpc_ensure_cost_period(v_period_start);

    select count(*)::bigint,count(distinct m.sku_id)::bigint
    into v_material_count,v_material_distinct_count
    from costing.sku_material_cost_snapshot m
    where m.period_start=v_period_start
      and m.valuation_date=p_valuation_date
      and m.refresh_run_id=p_refresh_run_id;

    select count(*)::bigint,count(distinct dl.sku_id)::bigint
    into v_labour_count,v_labour_distinct_count
    from costing.sku_direct_labour_allocation_snapshot dl
    where dl.period_start=v_period_start
      and dl.valuation_date=p_valuation_date
      and dl.refresh_run_id=p_refresh_run_id;

    if v_material_count=0 then
        raise exception 'Material-cost snapshot is missing for period %, valuation date % and refresh run %.',v_period_start,p_valuation_date,p_refresh_run_id;
    end if;
    if v_labour_count=0 then
        raise exception 'Direct-labour snapshot is missing for period %, valuation date % and refresh run %.',v_period_start,p_valuation_date,p_refresh_run_id;
    end if;
    if v_material_count<>v_material_distinct_count then
        raise exception 'Material-cost snapshot contains duplicate SKU rows for refresh run %.',p_refresh_run_id;
    end if;
    if v_labour_count<>v_labour_distinct_count then
        raise exception 'Direct-labour snapshot contains duplicate SKU rows for refresh run %.',p_refresh_run_id;
    end if;
    if v_material_count<>v_labour_count then
        raise exception 'Prime-cost upstream row-count mismatch: material %, direct labour %, refresh run %.',v_material_count,v_labour_count,p_refresh_run_id;
    end if;

    if exists (
      select 1
      from costing.sku_direct_labour_allocation_snapshot dl
      left join costing.sku_sales_allocation_basis_snapshot b
        on b.id=dl.allocation_basis_snapshot_id
       and b.refresh_run_id=dl.refresh_run_id
       and b.sku_id=dl.sku_id
      where dl.refresh_run_id=p_refresh_run_id
        and b.id is null
    ) then
      raise exception 'Direct Labour snapshot has missing canonical allocation-basis lineage for refresh run %.',p_refresh_run_id;
    end if;

    delete from costing.sku_prime_cost_snapshot s
    where s.refresh_run_id=p_refresh_run_id;

    insert into costing.sku_prime_cost_snapshot (
        period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,
        sku_id,product_id,product_name,pack_size,pack_uom,
        rm_cost_per_sku,pm_cost_per_sku,material_cost_per_sku,
        direct_labour_cost_per_sku,prime_cost_per_sku,
        material_costing_status,direct_labour_allocation_status,
        allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
        prime_costing_status,prime_costing_note,refreshed_at
    )
    select
        m.period_start,m.valuation_date,m.refresh_run_id,b.id,
        m.sku_id,m.product_id,m.product_name,m.pack_size,m.pack_uom,
        m.rm_cost_per_sku,m.pm_cost_per_sku,m.material_cost_per_sku,
        dl.direct_labour_cost_per_sku,
        case when m.material_cost_per_sku is null or dl.direct_labour_cost_per_sku is null
             then null::numeric
             else m.material_cost_per_sku+dl.direct_labour_cost_per_sku end,
        m.material_costing_status,dl.direct_labour_allocation_status,
        -- Common lineage must come from the canonical exact-run allocation basis,
        -- not from the component-specific Direct Labour method label.
        b.allocation_basis_source,b.allocation_resolution_status,b.allocation_resolution_note,
        case
            when m.material_costing_status='BLOCKED' or dl.direct_labour_allocation_status='BLOCKED' then 'BLOCKED'
            when m.material_cost_per_sku is null or dl.direct_labour_cost_per_sku is null then 'BLOCKED'
            when m.material_costing_status='REVIEW_REQUIRED' or dl.direct_labour_allocation_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        case
            when m.material_costing_status='BLOCKED' then 'Prime cost is blocked because material cost is blocked.'
            when dl.direct_labour_allocation_status='BLOCKED' then 'Prime cost is blocked because direct labour allocation is blocked.'
            when m.material_cost_per_sku is null then 'Prime cost is blocked because material cost is missing.'
            when dl.direct_labour_cost_per_sku is null then 'Prime cost is blocked because direct labour cost is missing.'
            when m.material_costing_status='REVIEW_REQUIRED' or dl.direct_labour_allocation_status='REVIEW_REQUIRED'
              then 'Prime cost can be calculated, but review is required because material cost or direct labour allocation requires review.'
            else 'Prime cost is ready.'
        end,
        clock_timestamp()
    from costing.sku_material_cost_snapshot m
    join costing.sku_direct_labour_allocation_snapshot dl
      on dl.period_start=m.period_start
     and dl.valuation_date=m.valuation_date
     and dl.refresh_run_id=m.refresh_run_id
     and dl.sku_id=m.sku_id
    join costing.sku_sales_allocation_basis_snapshot b
      on b.id=dl.allocation_basis_snapshot_id
     and b.refresh_run_id=dl.refresh_run_id
     and b.sku_id=dl.sku_id
    where m.period_start=v_period_start
      and m.valuation_date=p_valuation_date
      and m.refresh_run_id=p_refresh_run_id;

    return query
    select v_period_start,
           count(*)::bigint,
           count(*) filter(where s.prime_costing_status='BLOCKED')::bigint,
           count(*) filter(where s.prime_costing_status='REVIEW_REQUIRED')::bigint,
           count(*) filter(where s.prime_costing_status='READY')::bigint
    from costing.sku_prime_cost_snapshot s
    where s.period_start=v_period_start
      and s.valuation_date=p_valuation_date
      and s.refresh_run_id=p_refresh_run_id;
end;
$function$;