-- CI-038a ROLLBACK: restores live pre-image (md5 cb3b293d159cc6c9065f55db8c588208)
begin;
CREATE OR REPLACE FUNCTION costing.fn_sku_activation_missing_items(p_sku_id bigint, p_product_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_product_id bigint;
  v_period date;
  v_val date;
  v_missing jsonb := '[]'::jsonb;
  v_family bigint;
  v_valid jsonb;
begin
  v_product_id := coalesce(p_product_id, (select s.product_id from public.product_skus s where s.id = p_sku_id));
  if v_product_id is null then
    raise exception 'SKU % not found', p_sku_id;
  end if;

  -- Current governed costing period = latest period; its valuation date is the as-of date.
  select cp.period_start, cp.valuation_date into v_period, v_val
  from costing.cost_periods cp order by cp.period_start desc limit 1;
  v_val := coalesce(v_val, current_date);   -- documented fallback if valuation date not yet set

  -- (1) Approved PM-BOM revision (SKU level)
  if not exists (select 1 from public.plm_sku_bom_revision_as_of(p_sku_id, v_val) b where b.id is not null) then
    v_missing := v_missing || jsonb_build_object('code','PM_BOM_REVISION','label','Approved packing-material BOM','where','PM BOM Manager');
  end if;

  -- (2) Batch-size reference (product level)
  if not exists (select 1 from public.production_batch_size_ref b
                 where b.product_id = v_product_id and b.is_active
                   and b.effective_from <= v_val and (b.effective_to is null or b.effective_to >= v_val)) then
    v_missing := v_missing || jsonb_build_object('code','BATCH_SIZE_REFERENCE','label','Batch size reference','where','Batch Sizes (Supply / Batch Plan)');
  end if;

  -- (3) Production route READY (single-product version of costing.fn_product_process_route_readiness)
  v_family := costing.fn_resolve_route_family_for_product(v_product_id::int, v_val);
  v_valid  := costing.fn_validate_effective_product_process_route(v_product_id::int, v_val);
  if v_family is null
     or not exists (select 1 from costing.production_route_family_route r
                    where r.route_family_id = v_family and r.archived_at is null and r.status = 'APPROVED'
                      and r.effective_from <= v_val and (r.effective_to is null or r.effective_to >= v_val))
     or not coalesce((v_valid->>'valid')::boolean, false) then
    v_missing := v_missing || jsonb_build_object('code','MANUFACTURING_ROUTE','label','Production route','where','Production Route Manager');
  end if;

  -- (4) MRP policy
  if coalesce((select m.resolution_status from costing.fn_resolve_sku_mrp_as_of(p_sku_id, v_val) m limit 1), '') <> 'RESOLVED' then
    v_missing := v_missing || jsonb_build_object('code','MRP_POLICY','label','MRP policy','where','Pricing Policy Manager > MRP');
  end if;

  -- (5) Selling-price / GST policy
  if coalesce((select x.resolution_status from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id, v_val) x limit 1), '') <> 'RESOLVED' then
    v_missing := v_missing || jsonb_build_object('code','SELLING_PRICE_POLICY','label','Selling price / GST policy','where','Pricing Policy Manager > Selling & scheme policies');
  end if;

  return jsonb_build_object('sku_id', p_sku_id, 'period_start', v_period, 'as_of_date', v_val, 'missing', v_missing);
end
$function$;
revoke all on function costing.fn_sku_activation_missing_items(bigint, bigint) from public, anon, authenticated;
commit;
