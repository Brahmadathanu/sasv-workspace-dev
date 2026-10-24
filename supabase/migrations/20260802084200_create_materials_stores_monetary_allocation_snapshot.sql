-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.sku_materials_stores_allocation_snapshot (
    id bigint generated always as identity primary key,
    period_start date not null,
    valuation_date date not null,
    refresh_run_id bigint not null references costing.costing_refresh_run(id),
    workload_snapshot_id bigint not null references costing.sku_materials_stores_workload_snapshot(id),
    pool_snapshot_id bigint not null references costing.cost_pool_monthly_snapshot(id),

    sku_id bigint not null,
    product_id bigint not null,
    product_name text not null,
    pack_size numeric,
    pack_uom text,

    monthly_sku_units numeric,
    unified_workload_units numeric,
    company_eligible_workload_units numeric,
    workload_share numeric,

    frozen_pool_amount numeric not null,
    monthly_sku_allocation_amount numeric,
    materials_stores_overhead_cost_per_sku numeric,

    allocation_status text not null,
    allocation_reason_code text not null,
    allocation_note text not null,

    captured_at timestamptz not null default clock_timestamp(),

    constraint sku_materials_stores_allocation_snapshot_run_sku_uq
        unique (refresh_run_id, sku_id),
    constraint sku_materials_stores_allocation_snapshot_status_chk
        check (allocation_status in ('READY','REVIEW_REQUIRED','BLOCKED')),
    constraint sku_materials_stores_allocation_snapshot_share_chk
        check (workload_share is null or (workload_share >= 0 and workload_share <= 1)),
    constraint sku_materials_stores_allocation_snapshot_pool_chk
        check (frozen_pool_amount >= 0),
    constraint sku_materials_stores_allocation_snapshot_amount_chk
        check (monthly_sku_allocation_amount is null or monthly_sku_allocation_amount >= 0),
    constraint sku_materials_stores_allocation_snapshot_cost_chk
        check (materials_stores_overhead_cost_per_sku is null or materials_stores_overhead_cost_per_sku >= 0),
    constraint sku_materials_stores_allocation_snapshot_blocked_null_chk
        check (
            allocation_status <> 'BLOCKED'
            or (
                workload_share is null
                and monthly_sku_allocation_amount is null
                and materials_stores_overhead_cost_per_sku is null
            )
        ),
    constraint sku_materials_stores_allocation_snapshot_nonblocked_value_chk
        check (
            allocation_status = 'BLOCKED'
            or (
                monthly_sku_units > 0
                and unified_workload_units > 0
                and company_eligible_workload_units > 0
                and workload_share is not null
                and monthly_sku_allocation_amount is not null
                and materials_stores_overhead_cost_per_sku is not null
            )
        )
);

create index if not exists sku_materials_stores_allocation_snapshot_context_idx
    on costing.sku_materials_stores_allocation_snapshot(period_start, valuation_date, refresh_run_id);

create index if not exists sku_materials_stores_allocation_snapshot_product_idx
    on costing.sku_materials_stores_allocation_snapshot(refresh_run_id, product_id);

create index if not exists sku_materials_stores_allocation_snapshot_status_idx
    on costing.sku_materials_stores_allocation_snapshot(refresh_run_id, allocation_status, allocation_reason_code);

create or replace function costing.rpc_refresh_materials_stores_allocation_snapshot(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    refreshed_period_start date,
    inserted_row_count bigint,
    blocked_count bigint,
    review_required_count bigint,
    ready_count bigint,
    eligible_monthly_allocation_sum numeric,
    frozen_pool_amount numeric
)
language plpgsql
security definer
set search_path = costing, public, pg_temp
as $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_workload_count bigint;
    v_workload_distinct_sku_count bigint;
    v_pool_count bigint;
    v_pool costing.cost_pool_monthly_snapshot%rowtype;
    v_allocation_sum numeric;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % does not exist', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Materials / Stores allocation context does not match refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint, count(distinct w.sku_id)::bigint
    into v_workload_count, v_workload_distinct_sku_count
    from costing.sku_materials_stores_workload_snapshot w
    where w.period_start = v_period_start
      and w.valuation_date = p_valuation_date
      and w.refresh_run_id = p_refresh_run_id;

    if v_workload_count = 0 then
        raise exception 'Materials / Stores workload snapshot is missing for refresh run %', p_refresh_run_id;
    end if;

    if v_workload_count <> v_workload_distinct_sku_count then
        raise exception 'Materials / Stores workload snapshot contains duplicate SKU rows for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint
    into v_pool_count
    from costing.cost_pool_monthly_snapshot p
    where p.period_start = v_period_start
      and p.valuation_date = p_valuation_date
      and p.refresh_run_id = p_refresh_run_id
      and p.allocation_pool = 'MATERIALS_STORES_OVERHEAD';

    if v_pool_count <> 1 then
        raise exception 'Exactly one frozen Materials / Stores pool is required for refresh run %, found %', p_refresh_run_id, v_pool_count;
    end if;

    select * into v_pool
    from costing.cost_pool_monthly_snapshot p
    where p.period_start = v_period_start
      and p.valuation_date = p_valuation_date
      and p.refresh_run_id = p_refresh_run_id
      and p.allocation_pool = 'MATERIALS_STORES_OVERHEAD';

    if v_pool.pool_status = 'BLOCKED' then
        raise exception 'Frozen Materials / Stores pool is blocked for refresh run %', p_refresh_run_id;
    end if;

    if v_pool.total_pool_amount is null or v_pool.total_pool_amount < 0 then
        raise exception 'Frozen Materials / Stores pool amount is missing or negative for refresh run %', p_refresh_run_id;
    end if;

    if exists (
        select 1
        from costing.sku_materials_stores_workload_snapshot w
        where w.refresh_run_id = p_refresh_run_id
          and w.allocation_status <> 'BLOCKED'
          and (
              w.monthly_sku_units is null
              or w.monthly_sku_units <= 0
              or w.unified_workload_units is null
              or w.unified_workload_units <= 0
              or w.company_eligible_workload_units is null
              or w.company_eligible_workload_units <= 0
              or w.workload_share is null
          )
    ) then
        raise exception 'Materials / Stores workload contains an invalid nonblocked absorption row for refresh run %', p_refresh_run_id;
    end if;

    delete from costing.sku_materials_stores_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    insert into costing.sku_materials_stores_allocation_snapshot (
        period_start,
        valuation_date,
        refresh_run_id,
        workload_snapshot_id,
        pool_snapshot_id,
        sku_id,
        product_id,
        product_name,
        pack_size,
        pack_uom,
        monthly_sku_units,
        unified_workload_units,
        company_eligible_workload_units,
        workload_share,
        frozen_pool_amount,
        monthly_sku_allocation_amount,
        materials_stores_overhead_cost_per_sku,
        allocation_status,
        allocation_reason_code,
        allocation_note
    )
    select
        w.period_start,
        w.valuation_date,
        w.refresh_run_id,
        w.id,
        v_pool.id,
        w.sku_id,
        w.product_id,
        w.product_name,
        w.pack_size,
        w.pack_uom,
        w.monthly_sku_units,
        w.unified_workload_units,
        w.company_eligible_workload_units,
        case when w.allocation_status = 'BLOCKED' then null else w.workload_share end,
        v_pool.total_pool_amount,
        case
            when w.allocation_status = 'BLOCKED' then null
            else v_pool.total_pool_amount * w.workload_share
        end,
        case
            when w.allocation_status = 'BLOCKED' then null
            else (v_pool.total_pool_amount * w.workload_share) / w.monthly_sku_units
        end,
        case
            when w.allocation_status = 'BLOCKED' then 'BLOCKED'
            when v_pool.pool_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            when w.allocation_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        case
            when w.allocation_status = 'BLOCKED' then w.allocation_reason_code
            when v_pool.pool_status = 'REVIEW_REQUIRED' then 'REVIEW_MATERIALS_STORES_POOL'
            else w.allocation_reason_code
        end,
        case
            when w.allocation_status = 'BLOCKED' then w.allocation_note
            when v_pool.pool_status = 'REVIEW_REQUIRED' then 'Materials / Stores allocation uses a frozen pool that requires governance review.'
            when w.allocation_status = 'REVIEW_REQUIRED' then 'Materials / Stores allocation is calculated and shown, but its governed workload basis requires review.'
            else 'Materials / Stores allocation is ready.'
        end
    from costing.sku_materials_stores_workload_snapshot w
    where w.period_start = v_period_start
      and w.valuation_date = p_valuation_date
      and w.refresh_run_id = p_refresh_run_id;

    select coalesce(sum(s.monthly_sku_allocation_amount),0)
    into v_allocation_sum
    from costing.sku_materials_stores_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id
      and s.allocation_status <> 'BLOCKED';

    if abs(v_allocation_sum - v_pool.total_pool_amount) > 0.000001 then
        raise exception 'Materials / Stores allocation does not reconcile for refresh run %: allocated %, pool %',
            p_refresh_run_id, v_allocation_sum, v_pool.total_pool_amount;
    end if;

    if exists (
        select 1
        from costing.sku_materials_stores_allocation_snapshot s
        where s.refresh_run_id = p_refresh_run_id
          and (
              (s.allocation_status = 'BLOCKED' and (
                  s.workload_share is not null
                  or s.monthly_sku_allocation_amount is not null
                  or s.materials_stores_overhead_cost_per_sku is not null
              ))
              or
              (s.allocation_status <> 'BLOCKED' and (
                  s.monthly_sku_allocation_amount is null
                  or s.materials_stores_overhead_cost_per_sku is null
                  or s.materials_stores_overhead_cost_per_sku < 0
              ))
          )
    ) then
        raise exception 'Materials / Stores monetary snapshot contains invalid null/value semantics for refresh run %', p_refresh_run_id;
    end if;

    return query
    select
        v_period_start,
        count(*)::bigint,
        count(*) filter (where s.allocation_status = 'BLOCKED')::bigint,
        count(*) filter (where s.allocation_status = 'REVIEW_REQUIRED')::bigint,
        count(*) filter (where s.allocation_status = 'READY')::bigint,
        coalesce(sum(s.monthly_sku_allocation_amount) filter (where s.allocation_status <> 'BLOCKED'),0),
        max(s.frozen_pool_amount)
    from costing.sku_materials_stores_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;
end;
$function$;

revoke all on table costing.sku_materials_stores_allocation_snapshot from public, anon, authenticated;
revoke all on function costing.rpc_refresh_materials_stores_allocation_snapshot(date,date,bigint) from public, anon, authenticated;
grant select, insert, update, delete on table costing.sku_materials_stores_allocation_snapshot to service_role;
grant usage, select on sequence costing.sku_materials_stores_allocation_snapshot_id_seq to service_role;
grant execute on function costing.rpc_refresh_materials_stores_allocation_snapshot(date,date,bigint) to service_role;