-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.sku_overhead_allocation_snapshot
  add column if not exists materials_stores_allocation_snapshot_id bigint;

create index if not exists sku_overhead_allocation_stores_alloc_idx
  on costing.sku_overhead_allocation_snapshot(materials_stores_allocation_snapshot_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sku_overhead_allocation_stores_alloc_fk'
      and conrelid = 'costing.sku_overhead_allocation_snapshot'::regclass
  ) then
    alter table costing.sku_overhead_allocation_snapshot
      add constraint sku_overhead_allocation_stores_alloc_fk
      foreign key (materials_stores_allocation_snapshot_id)
      references costing.sku_materials_stores_allocation_snapshot(id);
  end if;
end
$$;

create or replace function costing.rpc_refresh_sku_overhead_allocation_snapshot(
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
set search_path to 'costing', 'public', 'pg_temp'
as $$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_basis_row_count bigint;
    v_basis_distinct_sku_count bigint;
    v_pool_count bigint;
    v_qc_row_count bigint;
    v_qc_distinct_sku_count bigint;
    v_stores_row_count bigint;
    v_stores_distinct_sku_count bigint;
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
        raise exception 'Overhead allocation context does not match refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint, count(distinct b.sku_id)::bigint
    into v_basis_row_count, v_basis_distinct_sku_count
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start = v_period_start
      and b.valuation_date = p_valuation_date
      and b.refresh_run_id = p_refresh_run_id;

    if v_basis_row_count = 0 or v_basis_row_count <> v_basis_distinct_sku_count then
        raise exception 'Canonical sales-allocation basis missing or duplicated for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint into v_pool_count
    from costing.cost_pool_monthly_snapshot p
    where p.period_start = v_period_start
      and p.valuation_date = p_valuation_date
      and p.refresh_run_id = p_refresh_run_id
      and p.allocation_pool in ('PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD','MATERIALS_STORES_OVERHEAD');

    if v_pool_count <> 3 then
        raise exception 'Exactly three shared overhead pools are required for refresh run %, found %', p_refresh_run_id, v_pool_count;
    end if;

    select count(*)::bigint, count(distinct q.sku_id)::bigint
    into v_qc_row_count, v_qc_distinct_sku_count
    from costing.sku_qc_allocation_snapshot q
    where q.period_start = v_period_start
      and q.valuation_date = p_valuation_date
      and q.refresh_run_id = p_refresh_run_id;

    if v_qc_row_count <> v_basis_row_count or v_qc_row_count <> v_qc_distinct_sku_count then
        raise exception 'Canonical effective-spec QC SKU allocation is missing, incomplete or duplicated for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint, count(distinct s.sku_id)::bigint
    into v_stores_row_count, v_stores_distinct_sku_count
    from costing.sku_materials_stores_allocation_snapshot s
    where s.period_start = v_period_start
      and s.valuation_date = p_valuation_date
      and s.refresh_run_id = p_refresh_run_id;

    if v_stores_row_count <> v_basis_row_count
       or v_stores_row_count <> v_stores_distinct_sku_count then
        raise exception 'Canonical Materials / Stores SKU allocation is missing, incomplete or duplicated for refresh run %', p_refresh_run_id;
    end if;

    if exists (
        select 1
        from costing.sku_materials_stores_allocation_snapshot s
        where s.period_start = v_period_start
          and s.valuation_date = p_valuation_date
          and s.refresh_run_id = p_refresh_run_id
          and (
            (s.allocation_status = 'BLOCKED' and (
                s.monthly_sku_allocation_amount is not null
                or s.materials_stores_overhead_cost_per_sku is not null
            ))
            or
            (s.allocation_status <> 'BLOCKED' and (
                s.monthly_sku_allocation_amount is null
                or s.materials_stores_overhead_cost_per_sku is null
            ))
          )
    ) then
        raise exception 'Canonical Materials / Stores SKU allocation contains invalid monetary null semantics for refresh run %', p_refresh_run_id;
    end if;

    delete from costing.sku_overhead_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    insert into costing.sku_overhead_allocation_snapshot (
        period_start,
        valuation_date,
        refresh_run_id,
        allocation_basis_snapshot_id,
        quality_control_allocation_snapshot_id,
        materials_stores_allocation_snapshot_id,
        sku_id,
        product_id,
        product_name,
        pack_size,
        pack_uom,
        production_pool_snapshot_id,
        quality_control_pool_snapshot_id,
        materials_stores_pool_snapshot_id,
        production_pool_amount,
        quality_control_pool_amount,
        materials_stores_pool_amount,
        production_overhead_cost_per_sku,
        quality_control_overhead_cost_per_sku,
        materials_stores_overhead_cost_per_sku,
        allocation_basis_source,
        allocation_resolution_status,
        allocation_resolution_note,
        production_overhead_allocation_status,
        quality_control_overhead_allocation_status,
        materials_stores_overhead_allocation_status,
        refreshed_at
    )
    select
        b.period_start,
        b.valuation_date,
        b.refresh_run_id,
        b.id,
        q.id,
        msa.id,
        b.sku_id,
        b.product_id,
        b.product_name,
        b.pack_size,
        b.pack_uom,
        po.id,
        qc.id,
        ms.id,
        po.total_pool_amount,
        qc.total_pool_amount,
        ms.total_pool_amount,
        case
            when po.pool_status = 'BLOCKED'
              or b.resolved_product_allocation_share is null
              or b.resolved_product_sales_base_qty is null
              or b.resolved_product_sales_base_qty <= 0
              or b.sku_base_qty_per_unit is null
              or b.sku_base_qty_per_unit <= 0
                then null
            else
                (po.total_pool_amount * b.resolved_product_allocation_share / b.resolved_product_sales_base_qty)
                * b.sku_base_qty_per_unit
        end,
        q.quality_control_overhead_cost_per_sku,
        msa.materials_stores_overhead_cost_per_sku,
        b.allocation_basis_source,
        b.allocation_resolution_status,
        b.allocation_resolution_note,
        case
            when po.pool_status = 'BLOCKED'
              or b.allocation_resolution_status = 'BLOCKED'
              or b.resolved_product_sales_base_qty is null
              or b.resolved_product_sales_base_qty <= 0
              or b.sku_base_qty_per_unit is null
              or b.sku_base_qty_per_unit <= 0
                then 'BLOCKED'
            when po.pool_status = 'REVIEW_REQUIRED'
              or b.allocation_resolution_status = 'REVIEW_REQUIRED'
                then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        q.allocation_status,
        msa.allocation_status,
        clock_timestamp()
    from costing.sku_sales_allocation_basis_snapshot b
    join costing.cost_pool_monthly_snapshot po
      on po.refresh_run_id = b.refresh_run_id
     and po.allocation_pool = 'PRODUCTION_OVERHEAD'
    join costing.cost_pool_monthly_snapshot qc
      on qc.refresh_run_id = b.refresh_run_id
     and qc.allocation_pool = 'QUALITY_CONTROL_OVERHEAD'
    join costing.cost_pool_monthly_snapshot ms
      on ms.refresh_run_id = b.refresh_run_id
     and ms.allocation_pool = 'MATERIALS_STORES_OVERHEAD'
    join costing.sku_qc_allocation_snapshot q
      on q.refresh_run_id = b.refresh_run_id
     and q.sku_id = b.sku_id
    join costing.sku_materials_stores_allocation_snapshot msa
      on msa.refresh_run_id = b.refresh_run_id
     and msa.sku_id = b.sku_id
    where b.period_start = v_period_start
      and b.valuation_date = p_valuation_date
      and b.refresh_run_id = p_refresh_run_id;

    if exists (
        select 1
        from costing.sku_overhead_allocation_snapshot oh
        join costing.sku_materials_stores_allocation_snapshot msa
          on msa.id = oh.materials_stores_allocation_snapshot_id
        where oh.refresh_run_id = p_refresh_run_id
          and (
            oh.materials_stores_overhead_cost_per_sku
                is distinct from msa.materials_stores_overhead_cost_per_sku
            or oh.materials_stores_overhead_allocation_status
                is distinct from msa.allocation_status
            or oh.materials_stores_pool_snapshot_id
                is distinct from msa.pool_snapshot_id
            or oh.materials_stores_pool_amount
                is distinct from msa.frozen_pool_amount
          )
    ) then
        raise exception 'Combined overhead does not reconcile to canonical Materials / Stores allocation for refresh run %', p_refresh_run_id;
    end if;

    return query
    select
        v_period_start,
        count(*)::bigint,
        count(*) filter (
            where s.production_overhead_allocation_status = 'BLOCKED'
               or s.quality_control_overhead_allocation_status = 'BLOCKED'
               or s.materials_stores_overhead_allocation_status = 'BLOCKED'
        )::bigint,
        count(*) filter (
            where s.production_overhead_allocation_status = 'REVIEW_REQUIRED'
               or s.quality_control_overhead_allocation_status = 'REVIEW_REQUIRED'
               or s.materials_stores_overhead_allocation_status = 'REVIEW_REQUIRED'
        )::bigint,
        count(*) filter (
            where s.production_overhead_allocation_status = 'READY'
              and s.quality_control_overhead_allocation_status = 'READY'
              and s.materials_stores_overhead_allocation_status = 'READY'
        )::bigint
    from costing.sku_overhead_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;
end;
$$;

revoke all on function costing.rpc_refresh_sku_overhead_allocation_snapshot(date,date,bigint) from public;
grant execute on function costing.rpc_refresh_sku_overhead_allocation_snapshot(date,date,bigint) to service_role;
