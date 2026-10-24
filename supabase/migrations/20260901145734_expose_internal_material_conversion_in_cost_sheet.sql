-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_sku_detailed_cost_sheet as
select
  pb.period_start,
  pb.sku_id,
  pb.product_id,
  pb.product_name,
  pb.pack_size,
  pb.pack_uom,
  pb.mrp_ik,
  pb.mrp_ok,
  ilc.material_cost_per_sku,
  ilc.direct_labour_cost_per_sku,
  ilc.prime_cost_per_sku,
  ilc.production_overhead_cost_per_sku,
  ilc.quality_control_overhead_cost_per_sku,
  ilc.materials_stores_overhead_cost_per_sku,
  ilc.manufacturing_cop_per_sku,
  ilc.admin_overhead_cost_per_sku,
  ilc.finance_admin_overhead_cost_per_sku,
  ilc.internal_loaded_cost_per_sku,
  pb.marketing_expense_cost_per_sku,
  pb.pricing_cost_per_sku,
  sp.gst_percent,
  sp.ik_basic_price,
  sp.ok_basic_price,
  sp.ik_discount_percent,
  sp.ok_discount_percent,
  sp.ik_discount_amount,
  sp.ok_discount_amount,
  sp.ik_selling_price,
  sp.ok_selling_price,
  sp.contingency_percent,
  sp.ik_contingency_value,
  sp.ok_contingency_value,
  pb.ik_margin_amount_before_scheme,
  pb.ik_margin_percent_before_scheme,
  pb.ok_margin_amount_before_scheme,
  pb.ok_margin_percent_before_scheme,
  ilc.internal_loaded_cost_status,
  pb.pricing_bridge_status,
  sp.selling_price_bridge_status,
  case
    when ilc.internal_loaded_cost_status='BLOCKED' or pb.pricing_bridge_status='BLOCKED' or sp.selling_price_bridge_status='BLOCKED' then 'BLOCKED'
    when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or pb.pricing_bridge_status='REVIEW_REQUIRED' or sp.selling_price_bridge_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
    when ilc.internal_loaded_cost_status='READY' and pb.pricing_bridge_status='READY' and sp.selling_price_bridge_status='READY' then 'READY'
    else 'BLOCKED'
  end as cost_sheet_status,
  case
    when ilc.internal_loaded_cost_status='BLOCKED' then coalesce(ilc.internal_loaded_cost_note,'Internal loaded cost is blocked.')
    when pb.pricing_bridge_status='BLOCKED' then coalesce(pb.pricing_bridge_note,'Pricing Bridge is blocked.')
    when sp.selling_price_bridge_status='BLOCKED' then coalesce(sp.selling_price_bridge_note,'Selling Price Bridge is blocked.')
    when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' then coalesce(ilc.internal_loaded_cost_note,'Internal loaded cost requires review.')
    when pb.pricing_bridge_status='REVIEW_REQUIRED' then coalesce(pb.pricing_bridge_note,'Pricing Bridge requires review.')
    when sp.selling_price_bridge_status='REVIEW_REQUIRED' then coalesce(sp.selling_price_bridge_note,'Selling Price Bridge requires review.')
    when ilc.internal_loaded_cost_status='READY' and pb.pricing_bridge_status='READY' and sp.selling_price_bridge_status='READY' then 'Cost sheet is ready.'
    else 'Cost sheet is blocked because one or more exact-tuple source rows or statuses are missing.'
  end as cost_sheet_note,
  greatest(coalesce(ilc.refreshed_at,'1970-01-01 00:00:00+00'::timestamptz),coalesce(pb.refreshed_at,'1970-01-01 00:00:00+00'::timestamptz),coalesce(sp.refreshed_at,'1970-01-01 00:00:00+00'::timestamptz)) as refreshed_at,
  pb.valuation_date,
  pb.refresh_run_id,
  ic.internal_conversion_cost_per_sku as internal_material_conversion_cost_per_sku
from costing.sku_pricing_bridge_snapshot pb
left join costing.sku_internal_loaded_cost_snapshot ilc
  on ilc.period_start=pb.period_start and ilc.valuation_date=pb.valuation_date and ilc.refresh_run_id=pb.refresh_run_id and ilc.sku_id=pb.sku_id
left join costing.sku_selling_price_bridge_snapshot sp
  on sp.period_start=pb.period_start and sp.valuation_date=pb.valuation_date and sp.refresh_run_id=pb.refresh_run_id and sp.sku_id=pb.sku_id
left join costing.sku_internal_material_conversion_snapshot ic
  on ic.period_start=pb.period_start and ic.valuation_date=pb.valuation_date and ic.refresh_run_id=pb.refresh_run_id and ic.sku_id=pb.sku_id;

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  v_def:=pg_get_viewdef('public.v_costing_pricing_printable_cost_sheet_lines'::regclass,true);

  v_old:='            d.direct_labour_cost_per_sku,';
  if position(v_old in v_def)=0 then raise exception 'Printable view patch anchor 1 not found'; end if;
  v_def:=replace(v_def,v_old,v_old||E'\n            d.internal_material_conversion_cost_per_sku,');

  v_old:='(''A_COP''::text,''PART A: COST OF PRODUCTION''::text,50,''Production Overhead''::text';
  if position(v_old in v_def)=0 then raise exception 'Printable view patch anchor 2 not found'; end if;
  v_new:='(''A_COP''::text,''PART A: COST OF PRODUCTION''::text,45,''Internal Material Conversion Cost''::text,''Manufacturing conversion burden inherited from approved internally manufactured source materials consumed by this Product.''::text,''Approved internal-material lineage quantity × source Product manufacturing-only conversion burden (manufacturing labour + Production OH + QC + RM-share of Materials/Stores OH), recursively resolved.''::text,b.internal_material_conversion_cost_per_sku,NULL::text,''currency''::text,''Source: exact-run internal material conversion snapshot and approved source-product lineage.''::text), '||v_old;
  v_def:=replace(v_def,v_old,v_new);

  v_old:='Total Material Cost + Direct Labour + Production Overhead + Quality Control Overhead + Materials/Stores Overhead.';
  if position(v_old in v_def)=0 then raise exception 'Printable view patch anchor 3 not found'; end if;
  v_def:=replace(v_def,v_old,'Total Material Cost + Direct Labour + Internal Material Conversion Cost + Production Overhead + Quality Control Overhead + Materials/Stores Overhead.');

  execute 'create or replace view public.v_costing_pricing_printable_cost_sheet_lines as '||v_def;
end $$;

create or replace function costing.fn_cost_sheet_trace_source_snapshot(p_section_code text,p_line_label text)
returns text
language sql stable
set search_path to 'pg_catalog','costing','public','pg_temp'
as $$
select case
  when p_line_label in ('Raw Material Cost (RM)','Packing & Labelling Material Cost (PM)','Total Material Cost') then 'costing.v_sku_material_cost_build'
  when p_line_label='Direct Labour (DL)' then 'costing.v_staff_cost_pool_monthly / costing.v_sku_detailed_cost_sheet'
  when p_line_label='Internal Material Conversion Cost' then 'costing.sku_internal_material_conversion_snapshot / costing.internal_material_source_lineage'
  when p_line_label='Materials / Stores Overhead' then 'costing.sku_materials_stores_workload_snapshot / costing.sku_materials_stores_allocation_snapshot / costing.sku_overhead_allocation_snapshot'
  when p_line_label in ('Production Overhead','Quality Control Overhead','Administrative Overhead','Finance Admin Overhead','Marketing Expense') then 'public.v_costing_cost_pool_monthly_summary / costing.v_sku_detailed_cost_sheet'
  when p_line_label in ('Manufacturing COP','Internal Loaded Cost') then 'costing.v_sku_detailed_cost_sheet'
  when p_section_code in ('C_IK_PRICING','D_OK_PRICING') and (p_line_label ilike 'MRP:%' or p_line_label ilike 'GST Rate%' or p_line_label ilike 'Discount:%' or p_line_label ilike 'Contingency / Other Expense:%' or p_line_label ilike 'Selected Scheme:%') then 'public.v_costing_policy_manager_sku_overview'
  when p_section_code in ('C_IK_PRICING','D_OK_PRICING') and (p_line_label ilike 'Basic Price:%' or p_line_label ilike 'Discount Value:%' or p_line_label ilike 'Selling Price:%' or p_line_label ilike 'Contingency / Other Expense Value:%') then 'costing.v_sku_detailed_cost_sheet'
  when p_section_code in ('C_IK_PRICING','D_OK_PRICING') and (p_line_label ilike 'Scheme Value:%' or p_line_label ilike 'Sales Realisation:%') then 'costing.v_sku_scheme_comparison'
  when p_section_code='E_PROFIT' then 'costing.v_sku_scheme_comparison / costing.v_sku_detailed_cost_sheet'
  when p_section_code='Z_STATUS' then 'costing.v_sku_costing_control_status'
  else 'public.v_costing_pricing_printable_cost_sheet_lines'
end;
$$;