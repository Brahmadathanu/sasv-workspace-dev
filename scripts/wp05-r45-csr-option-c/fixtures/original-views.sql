-- Source-exact original views, no production rows.
CREATE OR REPLACE VIEW public.v_costing_pricing_cost_sheet_line_traceability AS
 SELECT line_trace_id,
    period_start,
    product_id,
    product_name,
    sku_id,
    sku_column_label,
    section_code,
    section_title,
    line_order,
    line_label,
    value_numeric,
    value_text,
    value_type,
    line_description,
    calculation_basis,
    source_note,
    trace_summary,
    trace_formula,
    trace_source_type,
    trace_source_snapshot,
    source_module_key,
    source_lens_id,
    source_module_label,
    drill_route_module_key,
    drill_route_lens_id,
    drill_filter_json,
    evidence_json,
    audit_hint,
    control_hint,
    refresh_stage_code,
    cost_sheet_status,
    cost_sheet_note,
    evidence_refreshed_at,
    refreshed_at,
    created_at,
    valuation_date,
    refresh_run_id,
    material_cost_snapshot_id,
    selected_scheme_policy_context_id,
    scheme_viability_snapshot_id
   FROM ( SELECT t.line_trace_id,
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
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN 'Direct labour absorbed by the SKU from the frozen monthly Direct Labour pool using the approved Product route-attendance workload driver.'::text
                    WHEN 'Production Overhead'::text THEN 'Production overhead absorbed from the frozen monthly Production Overhead pool using the approved rounded-standard-batch Product route-workload driver.'::text
                    WHEN 'Quality Control Overhead'::text THEN 'Quality Control overhead absorbed from the frozen monthly QC pool using the governed Product QC workload driver.'::text
                    WHEN 'Materials / Stores Overhead'::text THEN 'Materials and Stores overhead absorbed from the frozen monthly pool using the governed SKU RM/PM workload driver.'::text
                    WHEN 'Administrative Overhead'::text THEN 'Administration overhead absorbed from the frozen monthly pool using the approved Product sales-unit-share driver.'::text
                    WHEN 'Finance Admin Overhead'::text THEN 'Finance/Admin overhead absorbed from the frozen monthly pool using the approved Product sales-unit-share driver.'::text
                    WHEN 'Marketing Expense'::text THEN 'Marketing expense absorbed from the one frozen company Marketing pool using signed billed-value evidence, with IK/OK decomposition of that same pool for regional pricing.'::text
                    ELSE t.line_description
                END AS line_description,
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN 'Frozen Direct Labour pool × Product route-attendance workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text
                    WHEN 'Production Overhead'::text THEN 'Frozen Production Overhead pool × Product rounded-standard-batch route-workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text
                    WHEN 'Quality Control Overhead'::text THEN 'Frozen Quality Control pool × governed Product QC workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.'::text
                    WHEN 'Materials / Stores Overhead'::text THEN 'Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.'::text
                    WHEN 'Administrative Overhead'::text THEN 'Frozen Administration pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'::text
                    WHEN 'Finance Admin Overhead'::text THEN 'Frozen Finance/Admin pool × governed Product sales-unit share; Product allocation is absorbed to SKU using the exact-run Product/SKU quantity basis.'::text
                    WHEN 'Marketing Expense'::text THEN 'Frozen Marketing pool × governed signed billed-value Product share, then absorbed to SKU; regional pricing uses the governed IK/OK decomposition of the same pool.'::text
                    ELSE t.calculation_basis
                END AS calculation_basis,
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN 'Source: exact-run Direct Labour Product workload, route-step and SKU allocation snapshots.'::text
                    WHEN 'Production Overhead'::text THEN 'Source: exact-run Production Overhead Product workload, route-step and SKU allocation snapshots.'::text
                    WHEN 'Quality Control Overhead'::text THEN 'Source: exact-run QC Product workload/allocation and SKU allocation snapshots.'::text
                    WHEN 'Materials / Stores Overhead'::text THEN 'Source: canonical exact-run Materials / Stores workload and monetary allocation snapshots.'::text
                    WHEN 'Administrative Overhead'::text THEN 'Source: exact-run Administration allocation snapshot with approved envelope and frozen-pool lineage.'::text
                    WHEN 'Finance Admin Overhead'::text THEN 'Source: exact-run Finance/Admin allocation snapshot with approved envelope and frozen-pool lineage.'::text
                    WHEN 'Marketing Expense'::text THEN 'Source: exact-run Marketing common/regional snapshots with approved policy-envelope and frozen-pool lineage.'::text
                    ELSE t.source_note
                END AS source_note,
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN 'Direct Labour is traced to the approved route-attendance policy, Product workload, standard batch count, frozen pool and exact SKU allocation basis.'::text
                    WHEN 'Production Overhead'::text THEN 'Production Overhead is traced to the approved rounded-batch route-workload policy, Product workload, frozen pool and exact SKU allocation basis.'::text
                    WHEN 'Quality Control Overhead'::text THEN 'QC is traced to the governed QC workload policy, Product workload/allocation, frozen QC pool and exact SKU absorption basis.'::text
                    WHEN 'Materials / Stores Overhead'::text THEN 'Materials / Stores is traced to the governed RM/PM workload policy, frozen pool and exact SKU workload share.'::text
                    WHEN 'Administrative Overhead'::text THEN 'Administration is traced to its approved policy envelope, frozen pool and governed Product sales-unit allocation basis.'::text
                    WHEN 'Finance Admin Overhead'::text THEN 'Finance/Admin is traced to its approved policy envelope, frozen pool and governed Product sales-unit allocation basis.'::text
                    WHEN 'Marketing Expense'::text THEN 'Marketing is traced to the approved signed billed-value policy, frozen company pool and common/regional allocation evidence.'::text
                    ELSE t.trace_summary
                END AS trace_summary,
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN 'Pool × Product workload share → Product DL allocation → exact-run SKU quantity absorption.'::text
                    WHEN 'Production Overhead'::text THEN 'Pool × Product rounded-batch route-workload share → Product POH allocation → exact-run SKU quantity absorption.'::text
                    WHEN 'Quality Control Overhead'::text THEN 'Pool × Product QC workload share → Product QC allocation → exact-run SKU quantity absorption.'::text
                    WHEN 'Materials / Stores Overhead'::text THEN 'Pool × SKU unified RM/PM workload share → monthly SKU allocation ÷ governed monthly SKU units.'::text
                    WHEN 'Administrative Overhead'::text THEN 'Pool × Product sales-unit share → Product allocation ÷ Product base quantity × SKU base quantity per unit.'::text
                    WHEN 'Finance Admin Overhead'::text THEN 'Pool × Product sales-unit share → Product allocation ÷ Product base quantity × SKU base quantity per unit.'::text
                    WHEN 'Marketing Expense'::text THEN 'Company pool × signed billed-value Product share → SKU absorption; IK/OK regional decomposition remains a decomposition of the same company pool.'::text
                    ELSE t.trace_formula
                END AS trace_formula,
            t.trace_source_type,
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN 'costing.sku_direct_labour_allocation_snapshot / costing.product_direct_labour_workload_snapshot'::text
                    WHEN 'Production Overhead'::text THEN 'costing.sku_production_overhead_allocation_snapshot / costing.product_production_overhead_workload_snapshot'::text
                    WHEN 'Quality Control Overhead'::text THEN 'costing.sku_qc_allocation_snapshot / costing.product_qc_allocation_snapshot'::text
                    WHEN 'Materials / Stores Overhead'::text THEN 'costing.sku_materials_stores_workload_snapshot / costing.sku_materials_stores_allocation_snapshot'::text
                    WHEN 'Administrative Overhead'::text THEN 'costing.sku_admin_finance_overhead_allocation_snapshot'::text
                    WHEN 'Finance Admin Overhead'::text THEN 'costing.sku_admin_finance_overhead_allocation_snapshot'::text
                    WHEN 'Marketing Expense'::text THEN 'costing.sku_marketing_expense_allocation_snapshot / costing.sku_regional_marketing_expense_allocation_snapshot'::text
                    ELSE t.trace_source_snapshot
                END AS trace_source_snapshot,
            t.source_module_key,
            t.source_lens_id,
            t.source_module_label,
            t.drill_route_module_key,
            t.drill_route_lens_id,
            t.drill_filter_json,
                CASE t.line_label
                    WHEN 'Direct Labour (DL)'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', dl.policy_id, 'pool_snapshot_id', dl.direct_labour_pool_snapshot_id, 'frozen_pool_amount', dl.direct_labour_pool_amount, 'product_workload_snapshot_id', dl.product_workload_snapshot_id, 'standard_batch_count', dl.standard_batch_count, 'product_workload_units', dl.direct_labour_workload_units, 'product_workload_share', dl.product_workload_share, 'product_allocation_amount', dl.product_direct_labour_allocation, 'allocation_basis_snapshot_id', dl.allocation_basis_snapshot_id, 'allocation_basis_source', dl.allocation_basis_source, 'allocation_resolution_status', dl.allocation_resolution_status, 'component_status', dl.direct_labour_allocation_status, 'component_note', dl.direct_labour_allocation_note))
                    WHEN 'Production Overhead'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', poh.policy_id, 'pool_snapshot_id', poh.pool_snapshot_id, 'frozen_pool_amount', poh.production_overhead_pool_amount, 'product_workload_snapshot_id', poh.product_workload_snapshot_id, 'product_workload_share', poh.product_workload_share, 'product_allocation_amount', poh.product_production_overhead_allocation, 'component_status', poh.allocation_status, 'component_note', poh.allocation_note))
                    WHEN 'Quality Control Overhead'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('product_qc_allocation_snapshot_id', qcs.product_qc_allocation_snapshot_id, 'policy_id', qcp.policy_id, 'pool_snapshot_id', qcp.quality_control_pool_snapshot_id, 'frozen_pool_amount', qcp.quality_control_pool_amount, 'product_workload_units', qcp.workload_units, 'company_workload_units', qcp.company_resolved_workload_units, 'product_workload_share', qcp.product_workload_share, 'product_allocation_amount', qcp.product_qc_allocation_amount, 'absorption_basis_source', qcp.absorption_basis_source, 'absorption_basis_status', qcp.absorption_basis_status, 'component_status', qcs.allocation_status, 'component_note', qcs.allocation_note))
                    WHEN 'Materials / Stores Overhead'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', msw.policy_id, 'pool_snapshot_id', msa.pool_snapshot_id, 'frozen_pool_amount', msa.frozen_pool_amount, 'workload_snapshot_id', msa.workload_snapshot_id, 'rm_workload_units', msw.rm_workload_units, 'pm_workload_units', msw.pm_workload_units, 'unified_workload_units', msa.unified_workload_units, 'company_eligible_workload_units', msa.company_eligible_workload_units, 'workload_share', msa.workload_share, 'monthly_sku_allocation_amount', msa.monthly_sku_allocation_amount, 'monthly_driver_source', msw.monthly_driver_source, 'monthly_driver_status', msw.monthly_driver_status, 'component_status', msa.allocation_status, 'component_note', msa.allocation_note))
                    WHEN 'Administrative Overhead'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_envelope_id', af.admin_policy_envelope_id, 'pool_snapshot_id', af.admin_pool_snapshot_id, 'allocation_basis_snapshot_id', af.allocation_basis_snapshot_id, 'allocation_basis_source', af.allocation_basis_source, 'allocation_resolution_status', af.allocation_resolution_status, 'product_allocation_share', af.resolved_product_allocation_share, 'component_status', af.admin_overhead_allocation_status, 'component_note', af.admin_overhead_allocation_note))
                    WHEN 'Finance Admin Overhead'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_envelope_id', af.finance_admin_policy_envelope_id, 'pool_snapshot_id', af.finance_admin_pool_snapshot_id, 'allocation_basis_snapshot_id', af.allocation_basis_snapshot_id, 'allocation_basis_source', af.allocation_basis_source, 'allocation_resolution_status', af.allocation_resolution_status, 'product_allocation_share', af.resolved_product_allocation_share, 'component_status', af.finance_admin_overhead_allocation_status, 'component_note', af.finance_admin_overhead_allocation_note))
                    WHEN 'Marketing Expense'::text THEN COALESCE(t.evidence_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('policy_id', mk.marketing_policy_id, 'policy_envelope_id', mk.marketing_policy_envelope_id, 'pool_snapshot_id', mk.marketing_pool_snapshot_id, 'allocation_basis_snapshot_id', mk.allocation_basis_snapshot_id, 'allocation_basis_source', mk.allocation_basis_source, 'allocation_resolution_status', mk.allocation_resolution_status, 'product_monetary_allocation_share', mk.product_monetary_allocation_share, 'product_marketing_allocation', mk.product_marketing_allocation, 'marketing_value_source', mk.marketing_value_source, 'marketing_evidence_status', mk.marketing_evidence_status, 'region_code',
                    CASE
                        WHEN t.section_code = 'C_IK_PRICING'::text THEN 'IK'::text
                        WHEN t.section_code = 'D_OK_PRICING'::text THEN 'OK'::text
                        ELSE NULL::text
                    END, 'regional_basis_source', rmk.regional_basis_source, 'regional_basis_status', rmk.regional_basis_status, 'product_region_monetary_allocation_share', rmk.product_region_monetary_allocation_share, 'regional_component_status', rmk.marketing_expense_allocation_status, 'component_status', mk.marketing_expense_allocation_status, 'component_note', mk.marketing_expense_allocation_note))
                    ELSE t.evidence_json
                END AS evidence_json,
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
           FROM costing.cost_sheet_line_traceability_snapshot t
             LEFT JOIN costing.sku_direct_labour_allocation_snapshot dl ON t.line_label = 'Direct Labour (DL)'::text AND dl.refresh_run_id = t.refresh_run_id AND dl.valuation_date = t.valuation_date AND dl.period_start = t.period_start AND dl.sku_id = t.sku_id
             LEFT JOIN costing.sku_production_overhead_allocation_snapshot poh ON t.line_label = 'Production Overhead'::text AND poh.refresh_run_id = t.refresh_run_id AND poh.valuation_date = t.valuation_date AND poh.period_start = t.period_start AND poh.sku_id = t.sku_id
             LEFT JOIN costing.sku_qc_allocation_snapshot qcs ON t.line_label = 'Quality Control Overhead'::text AND qcs.refresh_run_id = t.refresh_run_id AND qcs.valuation_date = t.valuation_date AND qcs.period_start = t.period_start AND qcs.sku_id = t.sku_id
             LEFT JOIN costing.product_qc_allocation_snapshot qcp ON qcs.product_qc_allocation_snapshot_id = qcp.id
             LEFT JOIN costing.sku_materials_stores_allocation_snapshot msa ON t.line_label = 'Materials / Stores Overhead'::text AND msa.refresh_run_id = t.refresh_run_id AND msa.valuation_date = t.valuation_date AND msa.period_start = t.period_start AND msa.sku_id = t.sku_id
             LEFT JOIN costing.sku_materials_stores_workload_snapshot msw ON msa.workload_snapshot_id = msw.id
             LEFT JOIN costing.sku_admin_finance_overhead_allocation_snapshot af ON (t.line_label = ANY (ARRAY['Administrative Overhead'::text, 'Finance Admin Overhead'::text])) AND af.refresh_run_id = t.refresh_run_id AND af.valuation_date = t.valuation_date AND af.period_start = t.period_start AND af.sku_id = t.sku_id
             LEFT JOIN costing.sku_marketing_expense_allocation_snapshot mk ON t.line_label = 'Marketing Expense'::text AND mk.refresh_run_id = t.refresh_run_id AND mk.valuation_date = t.valuation_date AND mk.period_start = t.period_start AND mk.sku_id = t.sku_id
             LEFT JOIN costing.sku_regional_marketing_expense_allocation_snapshot rmk ON t.line_label = 'Marketing Expense'::text AND rmk.refresh_run_id = t.refresh_run_id AND rmk.valuation_date = t.valuation_date AND rmk.period_start = t.period_start AND rmk.sku_id = t.sku_id AND rmk.region_code =
                CASE
                    WHEN t.section_code = 'C_IK_PRICING'::text THEN 'IK'::text
                    WHEN t.section_code = 'D_OK_PRICING'::text THEN 'OK'::text
                    ELSE NULL::text
                END) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);

CREATE OR REPLACE VIEW public.v_costing_pricing_sku_detailed_cost_sheet WITH (security_invoker=true) AS
 SELECT period_start,
    sku_id,
    product_id,
    product_name,
    pack_size,
    pack_uom,
    mrp_ik,
    mrp_ok,
    material_cost_per_sku,
    direct_labour_cost_per_sku,
    prime_cost_per_sku,
    production_overhead_cost_per_sku,
    quality_control_overhead_cost_per_sku,
    materials_stores_overhead_cost_per_sku,
    manufacturing_cop_per_sku,
    admin_overhead_cost_per_sku,
    finance_admin_overhead_cost_per_sku,
    internal_loaded_cost_per_sku,
    marketing_expense_cost_per_sku,
    pricing_cost_per_sku,
    gst_percent,
    ik_basic_price,
    ok_basic_price,
    ik_discount_percent,
    ok_discount_percent,
    ik_discount_amount,
    ok_discount_amount,
    ik_selling_price,
    ok_selling_price,
    contingency_percent,
    ik_contingency_value,
    ok_contingency_value,
    ik_margin_amount_before_scheme,
    ik_margin_percent_before_scheme,
    ok_margin_amount_before_scheme,
    ok_margin_percent_before_scheme,
    internal_loaded_cost_status,
    pricing_bridge_status,
    selling_price_bridge_status,
    cost_sheet_status,
    cost_sheet_note,
    refreshed_at,
    valuation_date,
    refresh_run_id
   FROM ( SELECT v_sku_detailed_cost_sheet_current.period_start,
            v_sku_detailed_cost_sheet_current.sku_id,
            v_sku_detailed_cost_sheet_current.product_id,
            v_sku_detailed_cost_sheet_current.product_name,
            v_sku_detailed_cost_sheet_current.pack_size,
            v_sku_detailed_cost_sheet_current.pack_uom,
            v_sku_detailed_cost_sheet_current.mrp_ik,
            v_sku_detailed_cost_sheet_current.mrp_ok,
            v_sku_detailed_cost_sheet_current.material_cost_per_sku,
            v_sku_detailed_cost_sheet_current.direct_labour_cost_per_sku,
            v_sku_detailed_cost_sheet_current.prime_cost_per_sku,
            v_sku_detailed_cost_sheet_current.production_overhead_cost_per_sku,
            v_sku_detailed_cost_sheet_current.quality_control_overhead_cost_per_sku,
            v_sku_detailed_cost_sheet_current.materials_stores_overhead_cost_per_sku,
            v_sku_detailed_cost_sheet_current.manufacturing_cop_per_sku,
            v_sku_detailed_cost_sheet_current.admin_overhead_cost_per_sku,
            v_sku_detailed_cost_sheet_current.finance_admin_overhead_cost_per_sku,
            v_sku_detailed_cost_sheet_current.internal_loaded_cost_per_sku,
            v_sku_detailed_cost_sheet_current.marketing_expense_cost_per_sku,
            v_sku_detailed_cost_sheet_current.pricing_cost_per_sku,
            v_sku_detailed_cost_sheet_current.gst_percent,
            v_sku_detailed_cost_sheet_current.ik_basic_price,
            v_sku_detailed_cost_sheet_current.ok_basic_price,
            v_sku_detailed_cost_sheet_current.ik_discount_percent,
            v_sku_detailed_cost_sheet_current.ok_discount_percent,
            v_sku_detailed_cost_sheet_current.ik_discount_amount,
            v_sku_detailed_cost_sheet_current.ok_discount_amount,
            v_sku_detailed_cost_sheet_current.ik_selling_price,
            v_sku_detailed_cost_sheet_current.ok_selling_price,
            v_sku_detailed_cost_sheet_current.contingency_percent,
            v_sku_detailed_cost_sheet_current.ik_contingency_value,
            v_sku_detailed_cost_sheet_current.ok_contingency_value,
            v_sku_detailed_cost_sheet_current.ik_margin_amount_before_scheme,
            v_sku_detailed_cost_sheet_current.ik_margin_percent_before_scheme,
            v_sku_detailed_cost_sheet_current.ok_margin_amount_before_scheme,
            v_sku_detailed_cost_sheet_current.ok_margin_percent_before_scheme,
            v_sku_detailed_cost_sheet_current.internal_loaded_cost_status,
            v_sku_detailed_cost_sheet_current.pricing_bridge_status,
            v_sku_detailed_cost_sheet_current.selling_price_bridge_status,
            v_sku_detailed_cost_sheet_current.cost_sheet_status,
            v_sku_detailed_cost_sheet_current.cost_sheet_note,
            v_sku_detailed_cost_sheet_current.refreshed_at,
            v_sku_detailed_cost_sheet_current.valuation_date,
            v_sku_detailed_cost_sheet_current.refresh_run_id
           FROM costing.v_sku_detailed_cost_sheet_current) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);

-- Preserve distinct relacl ordering seen in live PG catalogues, not merely equivalent privileges.
GRANT ALL ON public.v_costing_pricing_cost_sheet_line_traceability TO service_role;
GRANT SELECT ON public.v_costing_pricing_cost_sheet_line_traceability TO authenticated;
GRANT SELECT ON public.v_costing_pricing_sku_detailed_cost_sheet TO authenticated;
GRANT ALL ON public.v_costing_pricing_sku_detailed_cost_sheet TO service_role;
