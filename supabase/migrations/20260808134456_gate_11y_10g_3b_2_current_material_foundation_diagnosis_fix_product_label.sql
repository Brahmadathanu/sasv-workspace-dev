-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_current_material_foundation_diagnosis(
  p_product_id bigint,
  p_sku_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $$
declare
  v_rm_header_count bigint;
  v_rm_line_count bigint;
  v_pm_line_count bigint;
  v_product_name text;
  v_sku_pack text;
  v_rm_status text;
  v_pm_status text;
  v_overall_status text;
  v_recommended_route text;
  v_recommended_action text;
begin
  perform public.require_permission('module:costing-control-center', false);

  if p_product_id is null then
    raise exception 'product_id is required';
  end if;

  select p.item into v_product_name
  from public.products p
  where p.id = p_product_id;

  if v_product_name is null then
    raise exception 'Product not found';
  end if;

  select count(distinct h.id), count(l.id)
  into v_rm_header_count, v_rm_line_count
  from public.rm_bom_header h
  left join public.rm_bom_line l on l.rm_bom_id = h.id
  where h.product_id = p_product_id;

  if p_sku_id is not null then
    select concat_ws(' ', ps.pack_size::text, ps.uom)
    into v_sku_pack
    from public.product_skus ps
    where ps.id = p_sku_id and ps.product_id = p_product_id;

    select count(*)
    into v_pm_line_count
    from public.v_sku_plm_requirement_unit pm
    where pm.product_id = p_product_id
      and pm.sku_id = p_sku_id;
  else
    v_pm_line_count := null;
  end if;

  v_rm_status := case
    when v_rm_header_count = 0 then 'MISSING_RM_BOM'
    when v_rm_line_count = 0 then 'EMPTY_RM_BOM'
    else 'RM_FOUNDATION_PRESENT'
  end;

  v_pm_status := case
    when p_sku_id is null then 'NOT_EVALUATED_NO_SKU'
    when coalesce(v_pm_line_count,0) = 0 then 'MISSING_PM_REQUIREMENT'
    else 'PM_FOUNDATION_PRESENT'
  end;

  v_overall_status := case
    when v_rm_status = 'MISSING_RM_BOM' and v_pm_status = 'MISSING_PM_REQUIREMENT' then 'MISSING_RM_AND_PM_FOUNDATION'
    when v_rm_status in ('MISSING_RM_BOM','EMPTY_RM_BOM') then v_rm_status
    when v_pm_status = 'MISSING_PM_REQUIREMENT' then v_pm_status
    else 'FOUNDATION_PRESENT'
  end;

  v_recommended_route := case
    when v_rm_status in ('MISSING_RM_BOM','EMPTY_RM_BOM') then 'RM_BOM_MANAGEMENT'
    when v_pm_status = 'MISSING_PM_REQUIREMENT' then 'PM_REQUIREMENT_MANAGEMENT'
    else null
  end;

  v_recommended_action := case
    when v_overall_status = 'MISSING_RM_AND_PM_FOUNDATION' then 'Define the governed Product RM BOM and the governed SKU PM requirement before the next costing refresh.'
    when v_rm_status = 'MISSING_RM_BOM' then 'Define the governed Product RM BOM before the next costing refresh.'
    when v_rm_status = 'EMPTY_RM_BOM' then 'Complete the governed Product RM BOM lines before the next costing refresh.'
    when v_pm_status = 'MISSING_PM_REQUIREMENT' then 'Define or correct the governed SKU PM requirement before the next costing refresh.'
    else 'Current RM/PM foundation is present.'
  end;

  return jsonb_build_object(
    'diagnosis_scope','CURRENT_SOURCE_STATE',
    'diagnosed_at',clock_timestamp(),
    'product_id',p_product_id,
    'product_name',v_product_name,
    'sku_id',p_sku_id,
    'sku_pack',v_sku_pack,
    'rm_bom_header_count',v_rm_header_count,
    'rm_bom_line_count',v_rm_line_count,
    'pm_requirement_line_count',v_pm_line_count,
    'rm_foundation_status',v_rm_status,
    'pm_foundation_status',v_pm_status,
    'overall_foundation_status',v_overall_status,
    'recommended_ui_route',v_recommended_route,
    'recommended_action',v_recommended_action,
    'historical_evidence_note','This diagnosis reflects current master-data state and does not rewrite or reinterpret frozen historical costing evidence.'
  );
end;
$$;