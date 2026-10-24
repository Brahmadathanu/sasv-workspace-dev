-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.direct_labour_component_pool_snapshot (
    id bigserial primary key,
    period_start date not null,
    valuation_date date not null,
    refresh_run_id bigint not null references costing.costing_refresh_run(id),
    direct_labour_pool_snapshot_id bigint null references costing.cost_pool_monthly_snapshot(id),
    component_code text not null,
    source_costing_class text not null,
    staff_count bigint null,
    component_pool_amount numeric not null,
    allocation_driver_code text not null,
    source_basis text not null,
    created_at timestamptz not null default clock_timestamp(),
    constraint ck_direct_labour_component_pool_component_code check (component_code in ('MANUFACTURING_LABOUR','PACKING_LABOUR')),
    constraint ck_direct_labour_component_pool_driver_code check (allocation_driver_code in ('ROUTE_ATTENDANCE_WORKLOAD','EXPECTED_PACKAGE_UNITS')),
    constraint ck_direct_labour_component_pool_amount check (component_pool_amount >= 0),
    constraint uq_direct_labour_component_pool_run_component unique (refresh_run_id, component_code)
);

create index if not exists idx_direct_labour_component_pool_snapshot_context
on costing.direct_labour_component_pool_snapshot(period_start, valuation_date, refresh_run_id);

create table if not exists costing.sku_packing_labour_workload_snapshot (
    id bigserial primary key,
    period_start date not null,
    valuation_date date not null,
    refresh_run_id bigint not null references costing.costing_refresh_run(id),
    allocation_basis_snapshot_id bigint not null references costing.sku_sales_allocation_basis_snapshot(id),
    sku_id bigint not null,
    product_id bigint not null,
    product_name text null,
    pack_size numeric null,
    pack_uom text null,
    sku_base_qty_per_unit numeric null,
    monthly_sku_base_qty numeric null,
    expected_package_units numeric null,
    company_expected_package_units numeric null,
    package_workload_share numeric null,
    packing_labour_component_pool_snapshot_id bigint null references costing.direct_labour_component_pool_snapshot(id),
    packing_labour_pool_amount numeric null,
    packing_labour_allocation numeric null,
    packing_labour_cost_per_sku_unit numeric null,
    workload_status text not null,
    workload_reason_code text null,
    workload_note text null,
    source_method text not null,
    created_at timestamptz not null default clock_timestamp(),
    constraint ck_sku_packing_labour_expected_package_units check (expected_package_units is null or expected_package_units >= 0),
    constraint ck_sku_packing_labour_company_package_units check (company_expected_package_units is null or company_expected_package_units >= 0),
    constraint ck_sku_packing_labour_workload_share check (package_workload_share is null or (package_workload_share >= 0 and package_workload_share <= 1)),
    constraint ck_sku_packing_labour_allocation check (packing_labour_allocation is null or packing_labour_allocation >= 0),
    constraint ck_sku_packing_labour_status check (workload_status in ('READY','REVIEW_REQUIRED','BLOCKED')),
    constraint uq_sku_packing_labour_run_sku unique (refresh_run_id, sku_id)
);

create index if not exists idx_sku_packing_labour_workload_snapshot_context
on costing.sku_packing_labour_workload_snapshot(period_start, valuation_date, refresh_run_id);

create index if not exists idx_sku_packing_labour_workload_snapshot_product
on costing.sku_packing_labour_workload_snapshot(refresh_run_id, product_id);

create index if not exists idx_sku_packing_labour_workload_snapshot_status
on costing.sku_packing_labour_workload_snapshot(refresh_run_id, workload_status);

alter table costing.sku_direct_labour_allocation_snapshot
    add column if not exists manufacturing_direct_labour_pool_amount numeric null,
    add column if not exists packing_labour_pool_amount numeric null,
    add column if not exists manufacturing_direct_labour_allocation numeric null,
    add column if not exists packing_labour_allocation numeric null,
    add column if not exists manufacturing_direct_labour_cost_per_sku numeric null,
    add column if not exists packing_labour_cost_per_sku numeric null,
    add column if not exists packing_labour_workload_snapshot_id bigint null,
    add column if not exists direct_labour_component_model_code text null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname='fk_sku_direct_labour_packing_workload_snapshot'
          and conrelid='costing.sku_direct_labour_allocation_snapshot'::regclass
    ) then
        alter table costing.sku_direct_labour_allocation_snapshot
            add constraint fk_sku_direct_labour_packing_workload_snapshot
            foreign key (packing_labour_workload_snapshot_id)
            references costing.sku_packing_labour_workload_snapshot(id);
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname='ck_sku_direct_labour_component_amounts'
          and conrelid='costing.sku_direct_labour_allocation_snapshot'::regclass
    ) then
        alter table costing.sku_direct_labour_allocation_snapshot
            add constraint ck_sku_direct_labour_component_amounts
            check (
                (manufacturing_direct_labour_pool_amount is null or manufacturing_direct_labour_pool_amount >= 0)
                and (packing_labour_pool_amount is null or packing_labour_pool_amount >= 0)
                and (manufacturing_direct_labour_allocation is null or manufacturing_direct_labour_allocation >= 0)
                and (packing_labour_allocation is null or packing_labour_allocation >= 0)
                and (manufacturing_direct_labour_cost_per_sku is null or manufacturing_direct_labour_cost_per_sku >= 0)
                and (packing_labour_cost_per_sku is null or packing_labour_cost_per_sku >= 0)
            );
    end if;
end $$;

do $$
begin
    if exists (select 1 from costing.direct_labour_component_pool_snapshot where refresh_run_id=82) then
        raise exception 'Gate 11Y.10I.2C.3D.2A safety failure: Run 82 component pool rows must not be backfilled';
    end if;
    if exists (select 1 from costing.sku_packing_labour_workload_snapshot where refresh_run_id=82) then
        raise exception 'Gate 11Y.10I.2C.3D.2A safety failure: Run 82 packing workload rows must not be backfilled';
    end if;
end $$;