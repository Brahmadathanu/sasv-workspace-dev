-- backfilled from live schema_migrations on 2026-10-24, CI-016

do $repair$
declare
  v_ts timestamptz := clock_timestamp();
  v_id bigint;
begin
  if not exists (
    select 1 from public.product_skus
    where id=207 and product_id=190 and is_active=true
  ) then
    raise exception 'Repair abort: active Bala Thailam SKU207 not found';
  end if;

  if exists (
    select 1 from costing.sku_selling_price_policy where sku_id=207
  ) then
    raise exception 'Repair abort: SKU207 selling-price policy unexpectedly already exists';
  end if;

  -- Active sibling policies must still prove the governed September rule.
  if not exists (
    select 1 from costing.sku_selling_price_policy
    where sku_id=208
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
    select 1 from costing.sku_selling_price_policy
    where sku_id=209
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
    raise exception 'Repair abort: Bala Thailam sibling September selling-price policy pattern changed';
  end if;

  insert into costing.sku_selling_price_policy(
    sku_id,gst_percent,ik_discount_percent,ok_discount_percent,
    ik_discount_amount,ok_discount_amount,contingency_percent,
    effective_from,effective_to,is_active,remarks,created_at,updated_at
  )
  values(
    207,5,0,0,null,null,2,
    date '2026-09-01',null,true,
    'Run112 governance continuity repair for reactivated Bala Thailam 100 mL. Applies the same governed September 2026 Ayurveda/Siddha GST 5%, zero-discount and 2% contingency policy already effective for active Bala Thailam sibling packs; no commercial MRP value is changed.',
    v_ts,v_ts
  )
  returning id into v_id;

  if v_id is null then
    raise exception 'Repair abort: SKU207 selling-price policy was not created';
  end if;
end;
$repair$;
