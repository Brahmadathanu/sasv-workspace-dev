-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.product_direct_labour_workload_snapshot
  add column if not exists direct_labour_pool_snapshot_id bigint references costing.cost_pool_monthly_snapshot(id) on delete restrict;

alter table costing.sku_direct_labour_allocation_snapshot
  add column if not exists direct_labour_pool_snapshot_id bigint references costing.cost_pool_monthly_snapshot(id) on delete restrict;

alter table costing.sku_admin_finance_overhead_allocation_snapshot
  add column if not exists admin_policy_envelope_id bigint references costing.cost_driver_policy_envelope(id) on delete restrict,
  add column if not exists finance_admin_policy_envelope_id bigint references costing.cost_driver_policy_envelope(id) on delete restrict,
  add column if not exists admin_pool_snapshot_id bigint references costing.cost_pool_monthly_snapshot(id) on delete restrict,
  add column if not exists finance_admin_pool_snapshot_id bigint references costing.cost_pool_monthly_snapshot(id) on delete restrict;

create or replace function costing.fn_stamp_validate_direct_labour_pool_lineage()
returns trigger
language plpgsql
security definer
set search_path = costing, public, pg_temp
as $$
declare
  v_pool costing.cost_pool_monthly_snapshot%rowtype;
  v_policy_count bigint;
begin
  if new.refresh_run_id is null or new.valuation_date is null or new.period_start is null then
    raise exception 'Direct Labour exact-run lineage requires period_start, valuation_date and refresh_run_id.';
  end if;

  select count(*) into v_policy_count
  from costing.direct_labour_workload_policy p
  where p.id = new.policy_id
    and p.policy_status = 'APPROVED'
    and p.effective_from <= new.valuation_date
    and (p.effective_to is null or p.effective_to >= new.valuation_date);

  if v_policy_count <> 1 then
    raise exception 'Direct Labour policy % is not uniquely approved/effective for valuation date %.', new.policy_id, new.valuation_date;
  end if;

  select * into v_pool
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id = new.refresh_run_id
    and s.period_start = new.period_start
    and s.valuation_date = new.valuation_date
    and s.allocation_pool = 'DIRECT_LABOUR';

  if not found then
    raise exception 'Frozen DIRECT_LABOUR pool is missing for refresh run %.', new.refresh_run_id;
  end if;

  if new.direct_labour_pool_amount is distinct from v_pool.total_pool_amount then
    raise exception 'Direct Labour calculated pool % differs from frozen pool % for refresh run %.', new.direct_labour_pool_amount, v_pool.total_pool_amount, new.refresh_run_id;
  end if;

  new.direct_labour_pool_snapshot_id := v_pool.id;
  return new;
end;
$$;

create or replace function costing.fn_stamp_validate_direct_labour_sku_pool_lineage()
returns trigger
language plpgsql
security definer
set search_path = costing, public, pg_temp
as $$
declare
  v_pool costing.cost_pool_monthly_snapshot%rowtype;
  v_product_pool_id bigint;
begin
  select * into v_pool
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id = new.refresh_run_id
    and s.period_start = new.period_start
    and s.valuation_date = new.valuation_date
    and s.allocation_pool = 'DIRECT_LABOUR';

  if not found then
    raise exception 'Frozen DIRECT_LABOUR pool is missing for refresh run %.', new.refresh_run_id;
  end if;

  if new.direct_labour_pool_amount is distinct from v_pool.total_pool_amount then
    raise exception 'Direct Labour SKU calculated pool % differs from frozen pool % for refresh run %.', new.direct_labour_pool_amount, v_pool.total_pool_amount, new.refresh_run_id;
  end if;

  select pw.direct_labour_pool_snapshot_id into v_product_pool_id
  from costing.product_direct_labour_workload_snapshot pw
  where pw.id = new.product_workload_snapshot_id
    and pw.refresh_run_id = new.refresh_run_id;

  if v_product_pool_id is distinct from v_pool.id then
    raise exception 'Direct Labour SKU/Product workload pool lineage mismatch for refresh run %.', new.refresh_run_id;
  end if;

  new.direct_labour_pool_snapshot_id := v_pool.id;
  return new;
end;
$$;

create or replace function costing.fn_stamp_validate_admin_finance_lineage()
returns trigger
language plpgsql
security definer
set search_path = costing, public, pg_temp
as $$
declare
  v_admin_env costing.cost_driver_policy_envelope%rowtype;
  v_fin_env costing.cost_driver_policy_envelope%rowtype;
  v_admin_pool costing.cost_pool_monthly_snapshot%rowtype;
  v_fin_pool costing.cost_pool_monthly_snapshot%rowtype;
  v_live_admin numeric;
  v_live_fin numeric;
begin
  if new.refresh_run_id is null or new.valuation_date is null or new.period_start is null then
    raise exception 'Admin/Finance exact-run lineage requires period_start, valuation_date and refresh_run_id.';
  end if;

  select e.* into strict v_admin_env
  from costing.cost_driver_policy_envelope e
  where e.cost_element_code = 'ADMIN_OVERHEAD'
    and e.lifecycle_status = 'APPROVED'
    and e.effective_from <= new.valuation_date
    and (e.effective_to is null or e.effective_to >= new.valuation_date);

  select e.* into strict v_fin_env
  from costing.cost_driver_policy_envelope e
  where e.cost_element_code = 'FINANCE_ADMIN_OVERHEAD'
    and e.lifecycle_status = 'APPROVED'
    and e.effective_from <= new.valuation_date
    and (e.effective_to is null or e.effective_to >= new.valuation_date);

  select * into strict v_admin_pool
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id = new.refresh_run_id
    and s.period_start = new.period_start
    and s.valuation_date = new.valuation_date
    and s.allocation_pool = 'ADMIN_OVERHEAD';

  select * into strict v_fin_pool
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id = new.refresh_run_id
    and s.period_start = new.period_start
    and s.valuation_date = new.valuation_date
    and s.allocation_pool = 'FINANCE_ADMIN_OVERHEAD';

  select total_pool_amount into v_live_admin
  from costing.v_cost_pool_monthly_combined
  where period_start = new.period_start and allocation_pool = 'ADMIN_OVERHEAD';

  select total_pool_amount into v_live_fin
  from costing.v_cost_pool_monthly_combined
  where period_start = new.period_start and allocation_pool = 'FINANCE_ADMIN_OVERHEAD';

  if v_live_admin is distinct from v_admin_pool.total_pool_amount then
    raise exception 'Live Administration pool % differs from frozen exact-run pool % for refresh run %.', v_live_admin, v_admin_pool.total_pool_amount, new.refresh_run_id;
  end if;

  if v_live_fin is distinct from v_fin_pool.total_pool_amount then
    raise exception 'Live Finance/Admin pool % differs from frozen exact-run pool % for refresh run %.', v_live_fin, v_fin_pool.total_pool_amount, new.refresh_run_id;
  end if;

  new.admin_policy_envelope_id := v_admin_env.id;
  new.finance_admin_policy_envelope_id := v_fin_env.id;
  new.admin_pool_snapshot_id := v_admin_pool.id;
  new.finance_admin_pool_snapshot_id := v_fin_pool.id;
  return new;
exception
  when no_data_found then
    raise exception 'Approved policy or frozen pool lineage is missing for Admin/Finance refresh run %.', new.refresh_run_id;
  when too_many_rows then
    raise exception 'Approved policy or frozen pool lineage is ambiguous for Admin/Finance refresh run %.', new.refresh_run_id;
end;
$$;

drop trigger if exists trg_stamp_direct_labour_product_pool_lineage on costing.product_direct_labour_workload_snapshot;
create trigger trg_stamp_direct_labour_product_pool_lineage
before insert on costing.product_direct_labour_workload_snapshot
for each row execute function costing.fn_stamp_validate_direct_labour_pool_lineage();

drop trigger if exists trg_stamp_direct_labour_sku_pool_lineage on costing.sku_direct_labour_allocation_snapshot;
create trigger trg_stamp_direct_labour_sku_pool_lineage
before insert on costing.sku_direct_labour_allocation_snapshot
for each row execute function costing.fn_stamp_validate_direct_labour_sku_pool_lineage();

drop trigger if exists trg_stamp_admin_finance_lineage on costing.sku_admin_finance_overhead_allocation_snapshot;
create trigger trg_stamp_admin_finance_lineage
before insert on costing.sku_admin_finance_overhead_allocation_snapshot
for each row execute function costing.fn_stamp_validate_admin_finance_lineage();