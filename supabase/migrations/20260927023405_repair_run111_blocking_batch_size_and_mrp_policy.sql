-- backfilled from live schema_migrations on 2026-10-24, CI-016

do $repair$
declare
  v_ts timestamptz := clock_timestamp();
  v_batch_id bigint;
  v_policy_id bigint;
  v_bmr_count integer;
  v_bmr_size numeric;
  v_prev costing.sku_mrp_policy%rowtype;
begin
  -- Product 1350 must still be active and have no governed batch-size reference.
  if not exists (
    select 1 from public.products
    where id=1350 and upper(coalesce(status,''))='ACTIVE'
  ) then
    raise exception 'Repair abort: product 1350 is not active';
  end if;

  if exists (
    select 1 from public.production_batch_size_ref
    where product_id=1350
  ) then
    raise exception 'Repair abort: product 1350 batch-size reference already exists';
  end if;

  select count(*)::integer, min(batch_size::numeric)
  into v_bmr_count,v_bmr_size
  from public.v_bmr_batch_sizes
  where product_id=1350;

  if v_bmr_count <> 1 or v_bmr_size is distinct from 35::numeric then
    raise exception
      'Repair abort: expected exactly one historical BMR batch-size evidence row at 35 Kg for product1350; count=% size=%',
      v_bmr_count,v_bmr_size;
  end if;

  insert into public.production_batch_size_ref(
    product_id,preferred_batch_size,min_batch_size,max_batch_size,
    effective_from,effective_to,is_active,notes,change_reason,
    created_by,updated_by,created_at,updated_at
  )
  values(
    1350,35,35,35,
    date '2026-09-10',null,true,
    'Run111 evidence-backed repair; historical BMR SP874 records a fixed 35 Kg batch size.',
    'Approved fixed minimum, preferred and maximum batch size from the single consistent historical BMR batch size identified after Run111 blocked on missing effective preferred batch size.',
    null,null,v_ts,v_ts
  )
  returning id into v_batch_id;

  -- SKU207 MRP successor continuity.
  if not exists (
    select 1 from public.product_skus
    where id=207 and is_active=true
  ) then
    raise exception 'Repair abort: SKU207 is not active';
  end if;

  select * into v_prev
  from costing.sku_mrp_policy
  where id=1195
    and sku_id=207
    and status='APPROVED'
    and mrp_ik=100
    and mrp_ok=110
    and calc_mode='AUTO'
    and effective_from=date '2025-04-01'
    and effective_to=date '2026-07-15';

  if not found then
    raise exception 'Repair abort: expected closed historical SKU207 MRP policy 1195 not found';
  end if;

  if exists (
    select 1 from costing.sku_mrp_policy
    where sku_id=207 and id<>1195
  ) then
    raise exception 'Repair abort: an unexpected additional SKU207 MRP policy exists';
  end if;

  insert into costing.sku_mrp_policy(
    sku_id,mrp_ik,mrp_ok,ok_pct,calc_mode,
    effective_from,effective_to,status,reason,approval_reference,
    source_type,source_quality,source_snapshot,previous_policy_id,
    created_at,created_by
  )
  values(
    207,100,110,0.10,'AUTO',
    date '2026-09-10',null,'APPROVED',
    'Reactivation governance continuity repair after Run111: restore the same legacy-approved MRP values for the now-active Bala Thailam 100 mL SKU without changing commercial pricing.',
    'PPM-RUN111-REACTIVATION-SKU207-2026-09-10',
    'MANUAL_ENTRY','GOVERNED',
    jsonb_build_object(
      'repair_context','RUN111_BLOCKER_REPAIR',
      'prior_policy_id',1195,
      'prior_mrp_ik',v_prev.mrp_ik,
      'prior_mrp_ok',v_prev.mrp_ok,
      'prior_ok_pct',v_prev.ok_pct,
      'prior_calc_mode',v_prev.calc_mode,
      'prior_effective_from',v_prev.effective_from,
      'prior_effective_to',v_prev.effective_to,
      'evidence_note','SKU is active again; successor restores identical commercial values.'
    ),
    1195,
    v_ts,null
  )
  returning id into v_policy_id;

  if v_batch_id is null or v_policy_id is null then
    raise exception 'Repair abort: expected evidence rows were not created';
  end if;
end;
$repair$;
