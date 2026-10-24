-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_build_product_rm_requirement_for_product_as_of(p_product_id bigint,p_valuation_date date)
returns table(product_id bigint, product_name text, product_base_uom text, conversion_to_base numeric, root_bom_id bigint, reference_output_qty numeric, reference_output_uom_id bigint, reference_output_uom_code text, process_loss_pct numeric, consume_stock_item_id bigint, consume_stock_item_name text, purchase_stock_item_id bigint, purchase_stock_item_name text, consume_uom_id bigint, consume_uom_code text, purchase_uom_id bigint, purchase_uom_code text, qty_consume_form_per_base_unit numeric, qty_purchase_form_per_base_unit numeric, form_conversion_factor numeric, form_conversion_applied boolean, form_conversion_id bigint, form_conversion_status text, form_conversion_candidate_count bigint, wastage_pct numeric, is_optional boolean, source text, level integer, parent_bom_type text, explosion_path jsonb, calculation_warning_flag boolean, calculation_warning_code text)
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
begin
  if p_product_id is null then raise exception 'Product ID is required'; end if;
  if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
  return query
  select
    r.product_id,r.product_name,r.product_base_uom,r.conversion_to_base,
    r.root_bom_id,r.reference_output_qty,r.reference_output_uom_id,r.reference_output_uom_code,r.process_loss_pct,
    r.consume_stock_item_id,r.consume_stock_item_name,
    case when fc.resolution_status='AMBIGUOUS' then null::bigint else fc.purchase_stock_item_id end,
    case when fc.resolution_status='AMBIGUOUS' then null::text else pi.name end,
    r.required_uom_id,r.required_uom_code,
    case when fc.resolution_status='RESOLVED' then coalesce(fc.purchase_uom_id,r.required_uom_id)
         when fc.resolution_status='DIRECT_ITEM' then r.required_uom_id else null::bigint end,
    case when fc.resolution_status='AMBIGUOUS' then null::text else pu.code end,
    r.qty_consume_form_per_base_unit,
    case when fc.resolution_status='AMBIGUOUS' then null::numeric else r.qty_consume_form_per_base_unit*fc.factor end,
    case when fc.resolution_status='AMBIGUOUS' then null::numeric else fc.factor end,
    (fc.resolution_status='RESOLVED'),fc.conversion_id,fc.resolution_status,fc.qualifying_conversion_count,
    r.wastage_pct,r.is_optional,r.source,r.level,r.parent_bom_type,r.explosion_path,
    case when r.calculation_warning_flag=true or fc.resolution_status='AMBIGUOUS' then true else false end,
    case when fc.resolution_status='AMBIGUOUS' then 'AMBIGUOUS_RM_FORM_CONVERSION' else r.calculation_warning_code end
  from public.v_product_rm_requirement_unit r
  cross join lateral costing.fn_resolve_rm_form_conversion_as_of(r.consume_stock_item_id,p_valuation_date) fc
  left join public.inv_stock_item pi on pi.id=fc.purchase_stock_item_id
  left join public.inv_uom pu on pu.id=case when fc.resolution_status='RESOLVED' then coalesce(fc.purchase_uom_id,r.required_uom_id)
                                          when fc.resolution_status='DIRECT_ITEM' then r.required_uom_id else null::bigint end
  where r.product_id=p_product_id;
end;
$function$;

do $do$
declare v_def text;
begin
  select pg_get_functiondef('costing.fn_resolve_internal_material_rm_rate_as_of(bigint,date,bigint[])'::regprocedure) into v_def;
  v_def := replace(v_def,
    'costing.fn_build_product_rm_requirement_as_of(p_as_of_date) r',
    'costing.fn_build_product_rm_requirement_for_product_as_of(v_lineage.source_product_id,p_as_of_date) r');
  execute v_def;
end
$do$;