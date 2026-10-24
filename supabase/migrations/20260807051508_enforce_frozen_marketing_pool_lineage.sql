-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

create or replace function costing.fn_stamp_and_validate_marketing_snapshot_lineage()
returns trigger
language plpgsql
security definer
set search_path='costing','public','pg_temp'
as $$
declare
  v_policy costing.marketing_allocation_policy%rowtype;
  v_envelope costing.cost_driver_policy_envelope%rowtype;
  v_pool costing.cost_pool_monthly_snapshot%rowtype;
  v_count integer;
  v_expected numeric;
begin
  -- Historical rows are never rewritten by this migration. This guard applies on future writes.
  select p.* into v_policy from costing.fn_resolve_marketing_allocation_policy(new.valuation_date) p;
  if v_policy.id is null then
    raise exception 'Approved Marketing policy is required for valuation date %',new.valuation_date;
  end if;

  select e.* into v_envelope
  from costing.cost_driver_policy_envelope e
  where e.cost_element_code='MARKETING_EXPENSE'
    and e.lifecycle_status='APPROVED'
    and e.specialised_policy_schema='costing'
    and e.specialised_policy_table='marketing_allocation_policy'
    and e.specialised_policy_id=v_policy.id
    and e.effective_from<=new.valuation_date
    and (e.effective_to is null or e.effective_to>=new.valuation_date)
  order by e.policy_version desc,e.id desc
  limit 1;

  select count(*)::integer into v_count
  from costing.cost_pool_monthly_snapshot p
  where p.refresh_run_id=new.refresh_run_id
    and p.period_start=new.period_start
    and p.valuation_date=new.valuation_date
    and p.allocation_pool='MARKETING_EXPENSE';
  if v_count<>1 then
    raise exception 'Exactly one frozen Marketing pool is required for refresh run %, found %',new.refresh_run_id,v_count;
  end if;

  select * into v_pool
  from costing.cost_pool_monthly_snapshot p
  where p.refresh_run_id=new.refresh_run_id
    and p.period_start=new.period_start
    and p.valuation_date=new.valuation_date
    and p.allocation_pool='MARKETING_EXPENSE';

  if v_pool.pool_status='BLOCKED' then
    raise exception 'Frozen Marketing pool is blocked for refresh run %',new.refresh_run_id;
  end if;
  if v_pool.total_pool_amount is null or v_pool.total_pool_amount<0 then
    raise exception 'Frozen Marketing pool amount is missing or negative for refresh run %',new.refresh_run_id;
  end if;

  new.marketing_policy_id:=v_policy.id;
  new.marketing_policy_envelope_id:=v_envelope.id;
  new.marketing_pool_snapshot_id:=v_pool.id;

  if tg_table_name='sku_marketing_expense_allocation_snapshot' then
    if new.product_monetary_allocation_share is not null and new.product_marketing_allocation is not null then
      v_expected:=v_pool.total_pool_amount*new.product_monetary_allocation_share;
      if abs(new.product_marketing_allocation-v_expected)>0.000001 then
        raise exception 'Common Marketing allocation does not reconcile to frozen pool for run %, SKU %: row %, expected %',new.refresh_run_id,new.sku_id,new.product_marketing_allocation,v_expected;
      end if;
    end if;
  elsif tg_table_name='sku_regional_marketing_expense_allocation_snapshot' then
    if new.marketing_pool_amount is null or abs(new.marketing_pool_amount-v_pool.total_pool_amount)>0.000001 then
      raise exception 'Regional Marketing row pool amount does not match frozen pool for run %, SKU %, region %',new.refresh_run_id,new.sku_id,new.region_code;
    end if;
    if new.product_region_monetary_allocation_share is not null and new.product_region_marketing_allocation is not null then
      v_expected:=v_pool.total_pool_amount*new.product_region_monetary_allocation_share;
      if abs(new.product_region_marketing_allocation-v_expected)>0.000001 then
        raise exception 'Regional Marketing allocation does not reconcile to frozen pool for run %, SKU %, region %',new.refresh_run_id,new.sku_id,new.region_code;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stamp_marketing_common_lineage on costing.sku_marketing_expense_allocation_snapshot;
create trigger trg_stamp_marketing_common_lineage
before insert on costing.sku_marketing_expense_allocation_snapshot
for each row execute function costing.fn_stamp_and_validate_marketing_snapshot_lineage();

drop trigger if exists trg_stamp_marketing_regional_lineage on costing.sku_regional_marketing_expense_allocation_snapshot;
create trigger trg_stamp_marketing_regional_lineage
before insert on costing.sku_regional_marketing_expense_allocation_snapshot
for each row execute function costing.fn_stamp_and_validate_marketing_snapshot_lineage();

revoke all on function costing.fn_stamp_and_validate_marketing_snapshot_lineage() from public,anon,authenticated;

commit;