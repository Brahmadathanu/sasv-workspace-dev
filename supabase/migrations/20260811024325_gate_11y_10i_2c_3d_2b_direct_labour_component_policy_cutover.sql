-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

do $$
declare
  v_count integer;
begin
  -- Preserve historical policy as APPROVED with a closed effective range so
  -- historical exact-run resolution remains possible.
  update costing.direct_labour_workload_policy
  set
    effective_to = date '2026-08-10',
    updated_at = clock_timestamp()
  where id = 2
    and policy_code = 'DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE'
    and policy_version = 2
    and status = 'APPROVED'
    and effective_from = date '2026-08-06'
    and effective_to is null;

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Expected exactly one open approved Direct Labour v2 policy row, found %', v_count;
  end if;

  update costing.direct_labour_workload_policy
  set
    status = 'APPROVED',
    effective_from = date '2026-08-11',
    effective_to = null,
    approval_reference = 'Gate 11Y.10I.2C.3D.2B — user-confirmed Direct Labour component split: Manufacturing Labour by route-attendance workload + Packing Labour by frozen expected package units, effective 2026-08-11',
    approved_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = 4
    and policy_code = 'DIRECT_LABOUR_COMPONENT_SPLIT'
    and policy_version = 3
    and status = 'REVIEW_REQUIRED';

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Expected exactly one Direct Labour component-split v3 REVIEW_REQUIRED row, found %', v_count;
  end if;

  if (select (costing.fn_resolve_direct_labour_workload_policy(date '2026-08-07')).id) <> 2 then
    raise exception 'Historical Direct Labour policy resolution for 2026-08-07 changed unexpectedly';
  end if;

  if (select (costing.fn_resolve_direct_labour_workload_policy(date '2026-08-11')).id) <> 4 then
    raise exception 'Direct Labour component policy does not resolve on 2026-08-11';
  end if;

  select count(*) into v_count
  from costing.direct_labour_workload_policy p
  where p.status='APPROVED'
    and p.effective_from <= date '2026-08-11'
    and (p.effective_to is null or p.effective_to >= date '2026-08-11');

  if v_count <> 1 then
    raise exception 'Expected exactly one approved policy effective on 2026-08-11, found %', v_count;
  end if;

  if exists (select 1 from costing.direct_labour_component_pool_snapshot where refresh_run_id=82)
     or exists (select 1 from costing.sku_packing_labour_workload_snapshot where refresh_run_id=82)
     or exists (
       select 1 from costing.sku_direct_labour_allocation_snapshot
       where refresh_run_id=82 and direct_labour_component_model_code is not null
     ) then
    raise exception 'Run 82 component lineage was populated unexpectedly';
  end if;
end
$$;

commit;