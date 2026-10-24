-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function costing.fn_product_sku_readiness_run_evidence(
 p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint
) returns jsonb
language sql stable security definer
set search_path=costing,public,pg_temp
as $$
with dl as (
 select * from costing.sku_direct_labour_allocation_snapshot where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id limit 1),
poh as (
 select * from costing.sku_production_overhead_allocation_snapshot where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id limit 1),
qc as (
 select * from costing.sku_qc_allocation_snapshot where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id limit 1),
ms as (
 select * from costing.sku_materials_stores_allocation_snapshot where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id limit 1),
af as (
 select * from costing.sku_admin_finance_overhead_allocation_snapshot where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id limit 1),
mk as (
 select * from costing.sku_marketing_expense_allocation_snapshot where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id limit 1),
scheme as (
 select coalesce(jsonb_agg(jsonb_build_object('region_code',region_code,'raw_status',resolution_status,'effective_status',resolution_status,'resolution_source',policy_source,'reason_code',resolution_status,'note',resolution_note,'evidence_ids',jsonb_build_object('scheme_id',scheme_id,'policy_rule_id',policy_rule_id)) order by region_code),'[]'::jsonb) rows,
        count(*) n,
        bool_or(resolution_status not in ('RESOLVED','DEFAULT_NO_SCHEME')) bad
 from costing.sku_selected_scheme_policy_context_snapshot
 where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id),
regional as (
 select coalesce(jsonb_agg(jsonb_build_object('region_code',region_code,'raw_status',raw_status,'effective_status',effective_status,'resolution_source',regional_basis_source,'reason_code',regional_basis_status,'acceptance_eligible',is_acceptance_eligible,'accepted',is_accepted,'evidence_ids',jsonb_build_object('regional_marketing_snapshot_id',regional_marketing_snapshot_id,'regional_basis_snapshot_id',regional_basis_snapshot_id,'acceptance_id',acceptance_id)) order by region_code),'[]'::jsonb) rows,
        count(*) n,
        bool_or(effective_status='BLOCKED') blocked,
        bool_or(effective_status='REVIEW_REQUIRED') review
 from costing.v_regional_marketing_evidence_review_queue
 where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id)
select jsonb_build_object(
 'snapshot_present',coalesce((select true from dl),false) or coalesce((select true from poh),false) or coalesce((select true from qc),false) or coalesce((select true from ms),false) or coalesce((select true from af),false) or coalesce((select true from mk),false),
 'driver_dependencies',jsonb_build_array(
  jsonb_build_object('dependency_code','DIRECT_LABOUR','label','Direct Labour','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select direct_labour_allocation_status from dl),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from dl),'note',(select direct_labour_allocation_note from dl),'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_direct_labour_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from dl),'policy_id',(select policy_id from dl))),
  jsonb_build_object('dependency_code','PRODUCTION_OVERHEAD','label','Production Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from poh),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from poh),'note',(select allocation_note from poh),'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_production_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from poh),'policy_id',(select policy_id from poh))),
  jsonb_build_object('dependency_code','QUALITY_CONTROL_OVERHEAD','label','Quality Control Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from qc),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from qc),'note',(select allocation_note from qc),'owner_module','COST_SHEET_REVIEW','recommended_ui_route','QC_ACTION_QUEUE','authority','costing.sku_qc_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from qc))),
  jsonb_build_object('dependency_code','MATERIALS_STORES_OVERHEAD','label','Materials / Stores Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from ms),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from ms),'note',(select allocation_note from ms),'owner_module','COST_SHEET_REVIEW','recommended_ui_route','MATERIALS_STORES_ACTION_QUEUE','authority','costing.sku_materials_stores_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from ms))),
  jsonb_build_object('dependency_code','ADMIN_OVERHEAD','label','Administrative Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select admin_overhead_allocation_status from af),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_resolution_status from af),'note',(select admin_overhead_allocation_note from af),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from af),'policy_envelope_id',(select admin_policy_envelope_id from af))),
  jsonb_build_object('dependency_code','FINANCE_ADMIN_OVERHEAD','label','Finance/Admin Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select finance_admin_overhead_allocation_status from af),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_resolution_status from af),'note',(select finance_admin_overhead_allocation_note from af),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from af),'policy_envelope_id',(select finance_admin_policy_envelope_id from af))),
  jsonb_build_object('dependency_code','MARKETING_EXPENSE','label','Marketing Expense','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select marketing_expense_allocation_status from mk),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select marketing_evidence_status from mk),'note',(select marketing_expense_allocation_note from mk),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_marketing_expense_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from mk),'policy_id',(select marketing_policy_id from mk),'policy_envelope_id',(select marketing_policy_envelope_id from mk)))
 ),
 'scheme_evidence',(select rows from scheme),
 'scheme_status',case when (select n from scheme)=0 then 'UNKNOWN' when coalesce((select bad from scheme),false) then 'BLOCKED' else 'READY' end,
 'regional_marketing_evidence',(select rows from regional),
 'regional_marketing_status',case when (select n from regional)=0 then 'UNKNOWN' when coalesce((select blocked from regional),false) then 'BLOCKED' when coalesce((select review from regional),false) then 'REVIEW_REQUIRED' else 'READY' end
);
$$;

revoke all on function costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint) from public,anon,authenticated;
grant execute on function costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint) to service_role;
