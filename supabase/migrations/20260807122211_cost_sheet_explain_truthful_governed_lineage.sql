-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_def text;
begin
  select pg_get_viewdef('public.v_costing_pricing_printable_cost_sheet_lines'::regclass,true)
    into v_def;

  v_def := replace(v_def,
    'Direct labour allocated to the SKU based on product sales share and SKU pack quantity.',
    'Direct labour absorbed by the SKU from the frozen monthly Direct Labour pool using the approved Product route-attendance workload driver.');
  v_def := replace(v_def,
    'Allocated direct labour cost per base UOM × SKU pack quantity.',
    'Frozen Direct Labour pool × Product route-attendance workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.');
  v_def := replace(v_def,
    'Source: exact direct labour allocation snapshot.',
    'Source: exact-run Direct Labour Product workload, route-step and SKU allocation snapshots.');

  v_def := replace(v_def,
    'Production overhead pool allocated by product sales share and SKU pack quantity.',
    'Frozen Production Overhead pool × Product rounded-standard-batch route-workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.');
  v_def := replace(v_def,
    'Source: exact overhead allocation snapshot.',
    'Source: exact-run governed overhead allocation snapshot chain.');

  v_def := replace(v_def,
    'QC overhead pool allocated by product sales share and SKU pack quantity.',
    'Frozen Quality Control pool × governed Product QC workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.');

  v_def := replace(v_def,
    'Admin overhead allocation per SKU.',
    'Frozen Administration pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.');
  v_def := replace(v_def,
    'Source: exact administrative overhead allocation snapshot.',
    'Source: exact-run Administration allocation snapshot with approved policy-envelope and frozen-pool lineage.');

  v_def := replace(v_def,
    'Finance admin overhead allocation per SKU.',
    'Frozen Finance/Admin pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.');
  v_def := replace(v_def,
    'Source: exact finance/admin overhead allocation snapshot.',
    'Source: exact-run Finance/Admin allocation snapshot with approved policy-envelope and frozen-pool lineage.');

  v_def := replace(v_def,
    'Marketing expense allocated to the exact SKU context.',
    'Frozen Marketing pool × governed signed billed-value Product share, then absorbed to the exact SKU context; regional pricing uses the governed IK/OK decomposition of the same pool.');
  v_def := replace(v_def,
    'Source: exact marketing expense allocation snapshot.',
    'Source: exact-run Marketing common/regional allocation snapshots with approved policy-envelope and frozen-pool lineage.');

  execute 'create or replace view public.v_costing_pricing_printable_cost_sheet_lines as ' || v_def;
end $$;

create or replace view public.v_costing_pricing_cost_sheet_line_traceability as
select
  t.line_trace_id,
  t.period_start,
  t.product_id,
  t.product_name,
  t.sku_id,
  t.sku_column_label,
  t.section_code,
  t.section_title,
  t.line_order,
  t.line_label,
  t.value_numeric,
  t.value_text,
  t.value_type,
  case t.line_label
    when 'Direct Labour (DL)' then 'Direct labour absorbed by the SKU from the frozen monthly Direct Labour pool using the approved Product route-attendance workload driver.'
    when 'Production Overhead' then 'Production overhead absorbed from the frozen monthly Production Overhead pool using the approved rounded-standard-batch Product route-workload driver.'
    when 'Quality Control Overhead' then 'Quality Control overhead absorbed from the frozen monthly QC pool using the governed Product QC workload driver.'
    when 'Materials / Stores Overhead' then 'Materials and Stores overhead absorbed from the frozen monthly pool using the governed SKU RM/PM workload driver.'
    when 'Administrative Overhead' then 'Administration overhead absorbed from the frozen monthly pool using the approved Product sales-unit-share driver.'
    when 'Finance Admin Overhead' then 'Finance/Admin overhead absorbed from the frozen monthly pool using the approved Product sales-unit-share driver.'
    when 'Marketing Expense' then 'Marketing expense absorbed from the one frozen company Marketing pool using signed billed-value evidence, with IK/OK decomposition of that same pool for regional pricing.'
    else t.line_description
  end as line_description,
  case t.line_label
    when 'Direct Labour (DL)' then 'Frozen Direct Labour pool × Product route-attendance workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'
    when 'Production Overhead' then 'Frozen Production Overhead pool × Product rounded-standard-batch route-workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'
    when 'Quality Control Overhead' then 'Frozen Quality Control pool × governed Product QC workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'
    when 'Materials / Stores Overhead' then 'Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.'
    when 'Administrative Overhead' then 'Frozen Administration pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'
    when 'Finance Admin Overhead' then 'Frozen Finance/Admin pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'
    when 'Marketing Expense' then 'Frozen Marketing pool × governed signed billed-value Product share, then absorbed to SKU; regional pricing uses the governed IK/OK decomposition of the same pool.'
    else t.calculation_basis
  end as calculation_basis,
  case t.line_label
    when 'Direct Labour (DL)' then 'Source: exact-run Direct Labour Product workload, route-step and SKU allocation snapshots.'
    when 'Production Overhead' then 'Source: exact-run Production Overhead Product workload, route-step and SKU allocation snapshots.'
    when 'Quality Control Overhead' then 'Source: exact-run QC Product workload/allocation and SKU allocation snapshots.'
    when 'Materials / Stores Overhead' then 'Source: canonical exact-run Materials / Stores workload and monetary allocation snapshots.'
    when 'Administrative Overhead' then 'Source: exact-run Administration allocation snapshot with approved envelope and frozen-pool lineage.'
    when 'Finance Admin Overhead' then 'Source: exact-run Finance/Admin allocation snapshot with approved envelope and frozen-pool lineage.'
    when 'Marketing Expense' then 'Source: exact-run Marketing common/regional snapshots with approved policy-envelope and frozen-pool lineage.'
    else t.source_note
  end as source_note,
  case t.line_label
    when 'Direct Labour (DL)' then 'Direct Labour is traced to the approved route-attendance policy, Product workload, standard batch count, frozen pool and exact SKU allocation basis.'
    when 'Production Overhead' then 'Production Overhead is traced to the approved rounded-batch route-workload policy, Product workload, frozen pool and exact SKU allocation basis.'
    when 'Quality Control Overhead' then 'QC is traced to the governed QC workload policy, Product workload/allocation, frozen QC pool and exact SKU absorption basis.'
    when 'Materials / Stores Overhead' then 'Materials / Stores is traced to the governed RM/PM workload policy, frozen pool and exact SKU workload share.'
    when 'Administrative Overhead' then 'Administration is traced to its approved policy envelope, frozen pool and governed Product sales-unit allocation basis.'
    when 'Finance Admin Overhead' then 'Finance/Admin is traced to its approved policy envelope, frozen pool and governed Product sales-unit allocation basis.'
    when 'Marketing Expense' then 'Marketing is traced to the approved signed billed-value policy, frozen company pool and common/regional allocation evidence.'
    else t.trace_summary
  end as trace_summary,
  case t.line_label
    when 'Direct Labour (DL)' then 'Pool × Product workload share → Product DL allocation → exact-run SKU quantity absorption.'
    when 'Production Overhead' then 'Pool × Product rounded-batch route-workload share → Product POH allocation → exact-run SKU quantity absorption.'
    when 'Quality Control Overhead' then 'Pool × Product QC workload share → Product QC allocation → exact-run SKU quantity absorption.'
    when 'Materials / Stores Overhead' then 'Pool × SKU unified RM/PM workload share → monthly SKU allocation ÷ governed monthly SKU units.'
    when 'Administrative Overhead' then 'Pool × Product sales-unit share → Product allocation ÷ Product base quantity × SKU base quantity per unit.'
    when 'Finance Admin Overhead' then 'Pool × Product sales-unit share → Product allocation ÷ Product base quantity × SKU base quantity per unit.'
    when 'Marketing Expense' then 'Company pool × signed billed-value Product share → SKU absorption; IK/OK regional decomposition remains a decomposition of the same company pool.'
    else t.trace_formula
  end as trace_formula,
  t.trace_source_type,
  case t.line_label
    when 'Direct Labour (DL)' then 'costing.sku_direct_labour_allocation_snapshot / costing.product_direct_labour_workload_snapshot'
    when 'Production Overhead' then 'costing.sku_production_overhead_allocation_snapshot / costing.product_production_overhead_workload_snapshot'
    when 'Quality Control Overhead' then 'costing.sku_qc_allocation_snapshot / costing.product_qc_allocation_snapshot'
    when 'Materials / Stores Overhead' then 'costing.sku_materials_stores_workload_snapshot / costing.sku_materials_stores_allocation_snapshot'
    when 'Administrative Overhead' then 'costing.sku_admin_finance_overhead_allocation_snapshot'
    when 'Finance Admin Overhead' then 'costing.sku_admin_finance_overhead_allocation_snapshot'
    when 'Marketing Expense' then 'costing.sku_marketing_expense_allocation_snapshot / costing.sku_regional_marketing_expense_allocation_snapshot'
    else t.trace_source_snapshot
  end as trace_source_snapshot,
  t.source_module_key,
  t.source_lens_id,
  t.source_module_label,
  t.drill_route_module_key,
  t.drill_route_lens_id,
  t.drill_filter_json,
  case t.line_label
    when 'Direct Labour (DL)' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'policy_id', dl.policy_id,
      'pool_snapshot_id', dl.direct_labour_pool_snapshot_id,
      'frozen_pool_amount', dl.direct_labour_pool_amount,
      'product_workload_snapshot_id', dl.product_workload_snapshot_id,
      'standard_batch_count', dl.standard_batch_count,
      'product_workload_units', dl.direct_labour_workload_units,
      'product_workload_share', dl.product_workload_share,
      'product_allocation_amount', dl.product_direct_labour_allocation,
      'allocation_basis_snapshot_id', dl.allocation_basis_snapshot_id,
      'allocation_basis_source', dl.allocation_basis_source,
      'allocation_resolution_status', dl.allocation_resolution_status,
      'component_status', dl.direct_labour_allocation_status,
      'component_note', dl.direct_labour_allocation_note
    ))
    when 'Production Overhead' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'policy_id', poh.policy_id,
      'pool_snapshot_id', poh.pool_snapshot_id,
      'frozen_pool_amount', poh.production_overhead_pool_amount,
      'product_workload_snapshot_id', poh.product_workload_snapshot_id,
      'product_workload_share', poh.product_workload_share,
      'product_allocation_amount', poh.product_production_overhead_allocation,
      'component_status', poh.allocation_status,
      'component_note', poh.allocation_note
    ))
    when 'Quality Control Overhead' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'product_qc_allocation_snapshot_id', qcs.product_qc_allocation_snapshot_id,
      'policy_id', qcp.policy_id,
      'pool_snapshot_id', qcp.quality_control_pool_snapshot_id,
      'frozen_pool_amount', qcp.quality_control_pool_amount,
      'product_workload_units', qcp.workload_units,
      'company_workload_units', qcp.company_resolved_workload_units,
      'product_workload_share', qcp.product_workload_share,
      'product_allocation_amount', qcp.product_qc_allocation_amount,
      'absorption_basis_source', qcp.absorption_basis_source,
      'absorption_basis_status', qcp.absorption_basis_status,
      'component_status', qcs.allocation_status,
      'component_note', qcs.allocation_note
    ))
    when 'Materials / Stores Overhead' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'policy_id', msw.policy_id,
      'pool_snapshot_id', msa.pool_snapshot_id,
      'frozen_pool_amount', msa.frozen_pool_amount,
      'workload_snapshot_id', msa.workload_snapshot_id,
      'rm_workload_units', msw.rm_workload_units,
      'pm_workload_units', msw.pm_workload_units,
      'unified_workload_units', msa.unified_workload_units,
      'company_eligible_workload_units', msa.company_eligible_workload_units,
      'workload_share', msa.workload_share,
      'monthly_sku_allocation_amount', msa.monthly_sku_allocation_amount,
      'monthly_driver_source', msw.monthly_driver_source,
      'monthly_driver_status', msw.monthly_driver_status,
      'component_status', msa.allocation_status,
      'component_note', msa.allocation_note
    ))
    when 'Administrative Overhead' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'policy_envelope_id', af.admin_policy_envelope_id,
      'pool_snapshot_id', af.admin_pool_snapshot_id,
      'allocation_basis_snapshot_id', af.allocation_basis_snapshot_id,
      'allocation_basis_source', af.allocation_basis_source,
      'allocation_resolution_status', af.allocation_resolution_status,
      'product_allocation_share', af.resolved_product_allocation_share,
      'component_status', af.admin_overhead_allocation_status,
      'component_note', af.admin_overhead_allocation_note
    ))
    when 'Finance Admin Overhead' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'policy_envelope_id', af.finance_admin_policy_envelope_id,
      'pool_snapshot_id', af.finance_admin_pool_snapshot_id,
      'allocation_basis_snapshot_id', af.allocation_basis_snapshot_id,
      'allocation_basis_source', af.allocation_basis_source,
      'allocation_resolution_status', af.allocation_resolution_status,
      'product_allocation_share', af.resolved_product_allocation_share,
      'component_status', af.finance_admin_overhead_allocation_status,
      'component_note', af.finance_admin_overhead_allocation_note
    ))
    when 'Marketing Expense' then coalesce(t.evidence_json,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'policy_id', mk.marketing_policy_id,
      'policy_envelope_id', mk.marketing_policy_envelope_id,
      'pool_snapshot_id', mk.marketing_pool_snapshot_id,
      'allocation_basis_snapshot_id', mk.allocation_basis_snapshot_id,
      'allocation_basis_source', mk.allocation_basis_source,
      'allocation_resolution_status', mk.allocation_resolution_status,
      'product_monetary_allocation_share', mk.product_monetary_allocation_share,
      'product_marketing_allocation', mk.product_marketing_allocation,
      'marketing_value_source', mk.marketing_value_source,
      'marketing_evidence_status', mk.marketing_evidence_status,
      'region_code', case when t.section_code='C_IK_PRICING' then 'IK' when t.section_code='D_OK_PRICING' then 'OK' end,
      'regional_basis_source', rmk.regional_basis_source,
      'regional_basis_status', rmk.regional_basis_status,
      'product_region_monetary_allocation_share', rmk.product_region_monetary_allocation_share,
      'regional_component_status', rmk.marketing_expense_allocation_status,
      'component_status', mk.marketing_expense_allocation_status,
      'component_note', mk.marketing_expense_allocation_note
    ))
    else t.evidence_json
  end as evidence_json,
  t.audit_hint,
  t.control_hint,
  t.refresh_stage_code,
  t.cost_sheet_status,
  t.cost_sheet_note,
  t.evidence_refreshed_at,
  t.refreshed_at,
  t.created_at,
  t.valuation_date,
  t.refresh_run_id,
  t.material_cost_snapshot_id,
  t.selected_scheme_policy_context_id,
  t.scheme_viability_snapshot_id
from costing.cost_sheet_line_traceability_snapshot t
left join costing.sku_direct_labour_allocation_snapshot dl
  on t.line_label='Direct Labour (DL)'
 and dl.refresh_run_id=t.refresh_run_id and dl.valuation_date=t.valuation_date and dl.period_start=t.period_start and dl.sku_id=t.sku_id
left join costing.sku_production_overhead_allocation_snapshot poh
  on t.line_label='Production Overhead'
 and poh.refresh_run_id=t.refresh_run_id and poh.valuation_date=t.valuation_date and poh.period_start=t.period_start and poh.sku_id=t.sku_id
left join costing.sku_qc_allocation_snapshot qcs
  on t.line_label='Quality Control Overhead'
 and qcs.refresh_run_id=t.refresh_run_id and qcs.valuation_date=t.valuation_date and qcs.period_start=t.period_start and qcs.sku_id=t.sku_id
left join costing.product_qc_allocation_snapshot qcp
  on qcs.product_qc_allocation_snapshot_id=qcp.id
left join costing.sku_materials_stores_allocation_snapshot msa
  on t.line_label='Materials / Stores Overhead'
 and msa.refresh_run_id=t.refresh_run_id and msa.valuation_date=t.valuation_date and msa.period_start=t.period_start and msa.sku_id=t.sku_id
left join costing.sku_materials_stores_workload_snapshot msw
  on msa.workload_snapshot_id=msw.id
left join costing.sku_admin_finance_overhead_allocation_snapshot af
  on t.line_label in ('Administrative Overhead','Finance Admin Overhead')
 and af.refresh_run_id=t.refresh_run_id and af.valuation_date=t.valuation_date and af.period_start=t.period_start and af.sku_id=t.sku_id
left join costing.sku_marketing_expense_allocation_snapshot mk
  on t.line_label='Marketing Expense'
 and mk.refresh_run_id=t.refresh_run_id and mk.valuation_date=t.valuation_date and mk.period_start=t.period_start and mk.sku_id=t.sku_id
left join costing.sku_regional_marketing_expense_allocation_snapshot rmk
  on t.line_label='Marketing Expense'
 and rmk.refresh_run_id=t.refresh_run_id and rmk.valuation_date=t.valuation_date and rmk.period_start=t.period_start and rmk.sku_id=t.sku_id
 and rmk.region_code = case when t.section_code='C_IK_PRICING' then 'IK' when t.section_code='D_OK_PRICING' then 'OK' end;