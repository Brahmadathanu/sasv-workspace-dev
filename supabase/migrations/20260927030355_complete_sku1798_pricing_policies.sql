-- backfilled from live schema_migrations on 2026-10-24, CI-016

do $complete$
declare
  v_ts timestamptz := clock_timestamp();
  v_mrp_id bigint;
  v_sp_id bigint;
begin
  if not exists (
    select 1
    from public.product_skus ps
    join public.products p on p.id=ps.product_id
    where ps.id=1798
      and ps.product_id=1350
      and ps.is_active=true
      and upper(coalesce(p.status,''))='ACTIVE'
  ) then
    raise exception 'Completion abort: active SKU1798 / product1350 not found';
  end if;

  if exists (
    select 1 from costing.sku_mrp_policy where sku_id=1798
  ) then
    raise exception 'Completion abort: SKU1798 MRP policy unexpectedly already exists';
  end if;

  if exists (
    select 1 from costing.sku_selling_price_policy where sku_id=1798
  ) then
    raise exception 'Completion abort: SKU1798 selling-price policy unexpectedly already exists';
  end if;

  -- Commercial decision supplied by business owner: IK=150, OK=150.
  insert into costing.sku_mrp_policy(
    sku_id,mrp_ik,mrp_ok,ok_pct,calc_mode,
    effective_from,effective_to,status,reason,approval_reference,
    source_type,source_quality,source_snapshot,previous_policy_id,
    created_at,created_by
  )
  values(
    1798,150,150,0,'AUTO',
    date '2026-09-10',null,'APPROVED',
    'Initial governed MRP policy for newly created Mahamanjishtadi Kashaya Choornam 100 g; IK and OK MRP approved at 150 by the business owner to close the costing-suite pricing blocker exposed by unattended Run110 and successor proof runs.',
    'PPM-RUN113-SKU1798-INITIAL-MRP-2026-09-10',
    'MANUAL_ENTRY','GOVERNED',
    jsonb_build_object(
      'decision_context','BUSINESS_OWNER_APPROVED',
      'approved_mrp_ik',150,
      'approved_mrp_ok',150,
      'approved_ok_pct',0,
      'calc_mode','AUTO',
      'repair_context','UNATTENDED_COSTING_FIRST_CYCLE_COMPLETION'
    ),
    null,
    v_ts,null
  )
  returning id into v_mrp_id;

  -- Selling-price policy follows the governed September 2026 Ayurveda/Siddha standard:
  -- GST 5%, zero regional discounts, 2% contingency.
  if not exists (
    select 1
    from costing.sku_selling_price_policy
    where sku_id=167
      and effective_from=date '2026-09-01'
      and effective_to is null
      and is_active=true
      and gst_percent=5
      and ik_discount_percent=0
      and ok_discount_percent=0
      and ik_discount_amount is null
      and ok_discount_amount is null
      and contingency_percent=2
  ) or not exists (
    select 1
    from costing.sku_selling_price_policy
    where sku_id=1351
      and effective_from=date '2026-09-01'
      and effective_to is null
      and is_active=true
      and gst_percent=5
      and ik_discount_percent=0
      and ok_discount_percent=0
      and ik_discount_amount is null
      and ok_discount_amount is null
      and contingency_percent=2
  ) then
    raise exception 'Completion abort: peer 100 g Kashaya Choornam September selling-price policy pattern changed';
  end if;

  insert into costing.sku_selling_price_policy(
    sku_id,gst_percent,ik_discount_percent,ok_discount_percent,
    ik_discount_amount,ok_discount_amount,contingency_percent,
    effective_from,effective_to,is_active,remarks,created_at,updated_at
  )
  values(
    1798,5,0,0,null,null,2,
    date '2026-09-01',null,true,
    'Initial governed selling-price policy for Mahamanjishtadi Kashaya Choornam 100 g. Applies the same September 2026 Ayurveda/Siddha standard used by peer 100 g Kashaya Choornam SKUs: GST 5%, zero IK/OK discounts and 2% contingency.',
    v_ts,v_ts
  )
  returning id into v_sp_id;

  if v_mrp_id is null or v_sp_id is null then
    raise exception 'Completion abort: pricing policies were not both created';
  end if;
end;
$complete$;
