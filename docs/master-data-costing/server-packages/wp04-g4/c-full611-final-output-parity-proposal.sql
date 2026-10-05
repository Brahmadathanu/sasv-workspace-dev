-- WP04-G4 C full-611 final-output parity proposal. NOT AUTHORIZED / NOT RUN.
-- Preserves closed C-R01/C-R02/readback/CSE/payload/no-success/filter evidence; does not rerun them.
-- Compares original enrichment path vs C cohort enrichment over the same reviewed common LIVE composition.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
SET LOCAL idle_in_transaction_session_timeout='30s';

DO $guard$
DECLARE n bigint; fp text; latest bigint;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'C-F611 unexpected owner'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'C-F611 enrich source drift'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'C-F611 run-evidence source drift'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)'))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'C-F611 shared source drift'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)'))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'C-F611 route source drift'; END IF;
 IF EXISTS(
   SELECT 1 FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace
   WHERE (nsp.nspname,p.proname) IN (
    ('costing','fn_wp04_c_run_assemble'),('costing','fn_wp04_c_run_cohort'),
    ('costing','fn_wp04_c_enrich'),('costing','fn_wp04_c_live_core'),
    ('costing','fn_wp04_old_live_core')
   )
 ) THEN RAISE EXCEPTION 'C-F611 proof function collision'; END IF;
 SELECT valuation_date INTO STRICT fp FROM costing.cost_periods WHERE period_start='2026-09-01'::date;
 IF fp::text IS DISTINCT FROM '2026-09-10' THEN RAISE EXCEPTION 'C-F611 governed valuation drift'; END IF;
 SELECT id INTO latest FROM costing.costing_refresh_run
  WHERE period_start='2026-09-01'::date AND valuation_date='2026-09-10'::date AND overall_status='SUCCESS'
  ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1;
 IF latest IS DISTINCT FROM 115::bigint THEN RAISE EXCEPTION 'C-F611 SUCCESS run drift'; END IF;
 SELECT count(*),md5(coalesce(jsonb_agg(jsonb_build_array(s.id,s.product_id) ORDER BY s.id),'[]'::jsonb)::text)
 INTO n,fp
 FROM public.product_skus s JOIN public.products p ON p.id=s.product_id
 WHERE p.status='Active' AND s.is_active AND NOT coalesce(s.is_sample,false);
 IF n IS DISTINCT FROM 611::bigint OR fp IS DISTINCT FROM 'eeba4bf20f54589fe5b037173a79ed82' THEN
   RAISE EXCEPTION 'C-F611 operational membership drift';
 END IF;
END $guard$;

CREATE OR REPLACE FUNCTION costing.fn_wp04_c_run_assemble(p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,p_dl costing.sku_direct_labour_allocation_snapshot,p_poh costing.sku_production_overhead_allocation_snapshot,p_qc costing.sku_qc_allocation_snapshot,p_ms costing.sku_materials_stores_allocation_snapshot,p_af costing.sku_admin_finance_overhead_allocation_snapshot,p_mk costing.sku_marketing_expense_allocation_snapshot)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
with dl as (select (p_dl).* where (p_dl).id is not null),
poh as (select (p_poh).* where (p_poh).id is not null),
qc as (select (p_qc).* where (p_qc).id is not null),
ms as (select (p_ms).* where (p_ms).id is not null),
af as (select (p_af).* where (p_af).id is not null),
mk as (select (p_mk).* where (p_mk).id is not null),
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
$function$;

CREATE OR REPLACE FUNCTION costing.fn_wp04_c_run_cohort(p_sku_ids bigint[],p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
RETURNS TABLE(sku_id bigint,evidence_envelope jsonb) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
with cohort as materialized (select distinct u.sku_id from unnest(p_sku_ids) as u(sku_id))
select c.sku_id,jsonb_build_object('sku_id',c.sku_id,'period_start',p_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'evidence',
 costing.fn_wp04_c_run_assemble(c.sku_id,p_period_start,p_valuation_date,p_refresh_run_id,dl,poh,qc,ms,af,mk))
from cohort c
left join costing.sku_direct_labour_allocation_snapshot dl on dl.sku_id=c.sku_id and dl.period_start=p_period_start and dl.valuation_date=p_valuation_date and dl.refresh_run_id=p_refresh_run_id
left join costing.sku_production_overhead_allocation_snapshot poh on poh.sku_id=c.sku_id and poh.period_start=p_period_start and poh.valuation_date=p_valuation_date and poh.refresh_run_id=p_refresh_run_id
left join costing.sku_qc_allocation_snapshot qc on qc.sku_id=c.sku_id and qc.period_start=p_period_start and qc.valuation_date=p_valuation_date and qc.refresh_run_id=p_refresh_run_id
left join costing.sku_materials_stores_allocation_snapshot ms on ms.sku_id=c.sku_id and ms.period_start=p_period_start and ms.valuation_date=p_valuation_date and ms.refresh_run_id=p_refresh_run_id
left join costing.sku_admin_finance_overhead_allocation_snapshot af on af.sku_id=c.sku_id and af.period_start=p_period_start and af.valuation_date=p_valuation_date and af.refresh_run_id=p_refresh_run_id
left join costing.sku_marketing_expense_allocation_snapshot mk on mk.sku_id=c.sku_id and mk.period_start=p_period_start and mk.valuation_date=p_valuation_date and mk.refresh_run_id=p_refresh_run_id;
$function$;

CREATE OR REPLACE FUNCTION costing.fn_wp04_c_enrich(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,p_shared_issues jsonb,p_run_envelope jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb; scheme_status text; regional_status text; shared jsonb;
begin
 if jsonb_typeof(p_run_envelope) is distinct from 'object' then raise exception 'C evidence envelope required'; end if;
 if (select count(*) from jsonb_object_keys(p_run_envelope))<>5
 or p_run_envelope->'sku_id' is distinct from coalesce(to_jsonb(p_sku_id),'null'::jsonb)
 or p_run_envelope->'period_start' is distinct from coalesce(to_jsonb(p_period_start),'null'::jsonb)
 or p_run_envelope->'valuation_date' is distinct from coalesce(to_jsonb(p_valuation_date),'null'::jsonb)
 or p_run_envelope->'refresh_run_id' is distinct from coalesce(to_jsonb(p_refresh_run_id),'null'::jsonb)
 or jsonb_typeof(p_run_envelope->'evidence') is distinct from 'object' then raise exception 'C evidence context mismatch'; end if;
 e:=p_run_envelope->'evidence';
 if (select count(*) from jsonb_object_keys(e))<>6
 or jsonb_typeof(e->'scheme_status') is distinct from 'string'
 or jsonb_typeof(e->'regional_marketing_status') is distinct from 'string'
 or jsonb_typeof(e->'snapshot_present') is distinct from 'boolean'
 or jsonb_typeof(e->'driver_dependencies') is distinct from 'array' then raise exception 'C driver evidence shape mismatch'; end if;
 if jsonb_array_length(e->'driver_dependencies')<>7
 or (select jsonb_agg(d->>'dependency_code' order by ord) from jsonb_array_elements(e->'driver_dependencies') with ordinality as x(d,ord))
 is distinct from '["DIRECT_LABOUR","PRODUCTION_OVERHEAD","QUALITY_CONTROL_OVERHEAD","MATERIALS_STORES_OVERHEAD","ADMIN_OVERHEAD","FINANCE_ADMIN_OVERHEAD","MARKETING_EXPENSE"]'::jsonb then raise exception 'C driver evidence coverage mismatch'; end if;
 shared:=p_shared_issues;
 -- The unchanged run-evidence helper always emits both arrays; do not collapse invalid shapes to empty.
 if jsonb_typeof(e->'scheme_evidence') is distinct from 'array'
    or jsonb_typeof(e->'regional_marketing_evidence') is distinct from 'array' then
  raise exception 'Canonical run evidence array shape mismatch';
 end if;
 scheme_status:=case
  when exists(select 1 from jsonb_array_elements(e->'scheme_evidence') x(row)
   where row->>'raw_status' not in ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) then 'BLOCKED'
  when jsonb_array_length(e->'scheme_evidence')>0 then 'READY' else 'UNKNOWN' end;
 regional_status:=case
  when exists(select 1 from jsonb_array_elements(e->'regional_marketing_evidence') x(row)
   where row->>'effective_status'='BLOCKED') then 'BLOCKED'
  when exists(select 1 from jsonb_array_elements(e->'regional_marketing_evidence') x(row)
   where row->>'effective_status'='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
  when jsonb_array_length(e->'regional_marketing_evidence')>0 then 'READY' else 'NOT_REQUIRED' end;
 deps:=coalesce(p_base->'dependencies','[]')||coalesce(e->'driver_dependencies','[]')||jsonb_build_array(
 jsonb_build_object('dependency_code','SELECTED_SCHEME_POLICY','label','Selected scheme policy','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',scheme_status,'effective_status',scheme_status,'resolution_source','RUN_SNAPSHOT','reason_code',case when scheme_status='BLOCKED' then 'SCHEME_EVIDENCE_BLOCKED' when scheme_status='UNKNOWN' then 'SCHEME_EVIDENCE_NOT_CAPTURED' end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_selected_scheme_policy_context_snapshot','evidence',e->'scheme_evidence'),
 jsonb_build_object('dependency_code','REGIONAL_MARKETING_EVIDENCE','label','Regional Marketing evidence','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability',case when regional_status='NOT_REQUIRED' then 'NOT_REQUIRED' else 'APPLICABLE' end,'raw_status',regional_status,'effective_status',regional_status,'resolution_source',case when regional_status='NOT_REQUIRED' then 'NO_REVIEW_QUEUE_ITEM' else 'RUN_SNAPSHOT_PLUS_ACCEPTANCE' end,'reason_code',case when regional_status in ('BLOCKED','REVIEW_REQUIRED') then 'REGIONAL_MARKETING_'||regional_status end,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route','REGIONAL_MARKETING_REVIEW','authority','costing.v_regional_marketing_evidence_review_queue','evidence',e->'regional_marketing_evidence'));
 select case when jsonb_array_length(shared)>0 then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER')) then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='UNKNOWN') then 'UNKNOWN' else 'READY' end into ev;
 sev:=case when p_base#>>'{summary,costing_foundation_status}'='BLOCKED' or ev='BLOCKED' or p_base#>>'{summary,overall_severity}'='BLOCKER' then 'BLOCKER' when ev='REVIEW_REQUIRED' or p_base#>>'{summary,overall_severity}'='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when ev='UNKNOWN' and p_base#>>'{summary,overall_severity}'<>'READY' then 'UNKNOWN' else coalesce(p_base#>>'{summary,overall_severity}','UNKNOWN') end;
 ctx:=jsonb_set(p_base->'context','{evidence_refresh_run_id}',to_jsonb(p_refresh_run_id),true);
 return jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_base,'{context}',ctx,true),'{dependencies}',deps,true),'{shared_issues}',shared,true),'{summary,evidence_quality_status}',to_jsonb(ev),true),'{summary,overall_severity}',to_jsonb(sev),true);
end $function$;

CREATE OR REPLACE FUNCTION costing.fn_wp04_c_live_core(p_sku_id bigint,p_period_start date,p_valuation_date date,p_evidence_run_id bigint,p_route_evidence jsonb,p_shared_issues jsonb,p_run_envelope jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare
 v_context_type text:='LIVE_AS_OF'; v_period date:=p_period_start; v_val date:=p_valuation_date;
 v_run bigint:=p_evidence_run_id; v_run_status text:=case when p_evidence_run_id is not null then 'SUCCESS' end;
 v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_sku record; v_bom record; v_route record; v_mrp record; v_sell record; v_batch record; v_sales record; v_control record;
 v_pm text; v_sm text; v_cf text; v_ev text; v_out text; v_sev text; v_dep jsonb:='[]'; v_base jsonb;
begin
 select s.id sku_id,s.product_id,s.pack_size,s.uom,s.is_active sku_is_active,s.is_sample,p.item product_name,p.status product_status,p.uom_base,p.conversion_to_base
 into v_sku from public.product_skus s join public.products p on p.id=s.product_id where s.id=p_sku_id;
 if not found then raise exception 'SKU % not found',p_sku_id; end if;

 v_pm:=case when v_sku.uom_base is not null and btrim(v_sku.uom_base)<>'' and v_sku.conversion_to_base>0 then 'RESOLVED' else 'BLOCKED' end;
 v_sm:=case when v_sku.pack_size>0 and nullif(btrim(v_sku.uom),'') is not null then 'RESOLVED' else 'BLOCKED' end;

  select * into v_bom from public.plm_sku_bom_revision_as_of(p_sku_id,v_val) limit 1;
  select * into v_route from jsonb_to_record(p_route_evidence) x(readiness_status text,effective_route_source text);
  select * into v_mrp from costing.fn_resolve_sku_mrp_as_of(p_sku_id,v_val) limit 1;
  select * into v_sell from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id,v_val) limit 1;
  select * into v_batch from public.production_batch_size_ref b where b.product_id=v_sku.product_id and b.is_active and b.effective_from<=v_val and (b.effective_to is null or b.effective_to>=v_val) order by b.effective_from desc,b.id desc limit 1;
  select * into v_sales from costing.fn_resolve_sku_commercial_sales_basis_point(p_sku_id, v_period, v_val) limit 1;
  if v_run is not null then select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1; end if;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_pm,'resolution_source','PRODUCT_MASTER','reason_code',case when v_pm='BLOCKED' then 'PRODUCT_BASE_UOM_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.products'),
   jsonb_build_object('dependency_code','SKU_MASTER','label','SKU master','scope','SKU','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source','SKU_MASTER','reason_code',case when v_sm='BLOCKED' then 'SKU_PACK_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.product_skus'),
   jsonb_build_object('dependency_code','PM_BOM_REVISION','label','Approved PM-BOM revision','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_bom.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_bom.id is null then 'MISSING' else 'APPROVED_EFFECTIVE_REVISION' end,'reason_code',case when v_bom.id is null then 'PM_BOM_REVISION_MISSING' end,'owner_module','PM_BOM_MANAGER','recommended_ui_route','PM_BOM_MANAGER','authority','public.plm_sku_bom_revision_as_of','evidence_ids',jsonb_build_object('revision_id',v_bom.id)),
   jsonb_build_object('dependency_code','BATCH_SIZE_REFERENCE','label','Batch-size reference','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_batch.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_batch.id is null then 'MISSING' else 'EFFECTIVE_REFERENCE' end,'reason_code',case when v_batch.id is null then 'BATCH_SIZE_REFERENCE_MISSING' end,'owner_module','SUPPLY_BATCH_PLAN','recommended_ui_route','BATCH_SIZES','authority','public.production_batch_size_ref','evidence_ids',jsonb_build_object('reference_id',v_batch.id)),
   jsonb_build_object('dependency_code','MANUFACTURING_ROUTE','label','Manufacturing route','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_route.readiness_status='READY' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_route.effective_route_source,'reason_code',case when coalesce(v_route.readiness_status,'')<>'READY' then 'MANUFACTURING_ROUTE_NOT_READY' end,'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.fn_product_process_route_readiness'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_mrp.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_mrp.source_type,'reason_code',case when coalesce(v_mrp.resolution_status,'MISSING')<>'RESOLVED' then 'MRP_POLICY_'||coalesce(v_mrp.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.fn_resolve_sku_mrp_as_of','evidence_ids',jsonb_build_object('policy_id',v_mrp.policy_id)),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_sell.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source','SELLING_PRICE_POLICY','reason_code',case when coalesce(v_sell.resolution_status,'MISSING')<>'RESOLVED' then 'SELLING_POLICY_'||coalesce(v_sell.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.fn_resolve_sku_selling_price_policy_as_of','evidence_ids',jsonb_build_object('policy_id',v_sell.policy_id)),
   jsonb_build_object('dependency_code','COMMON_COMMERCIAL_BASIS','label','Common commercial sales basis','scope','SKU_PERIOD','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end,'resolution_source',v_sales.assumption_source,'reason_code',v_sales.commercial_sales_warning,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','COMMERCIAL_SALES_ASSUMPTIONS','authority','costing.v_sku_commercial_sales_basis')
  );
  v_cf:=case when v_pm='BLOCKED' or v_sm='BLOCKED' or v_bom.id is null or v_batch.id is null or coalesce(v_route.readiness_status,'')<>'READY' or coalesce(v_mrp.resolution_status,'')<>'RESOLVED' or coalesce(v_sell.resolution_status,'')<>'RESOLVED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end;
 v_out:=coalesce(v_control.cost_sheet_status,'UNKNOWN');
 v_sev:=case when v_cf='BLOCKED' or v_ev='BLOCKED' or v_control.control_severity='BLOCKER' then 'BLOCKER' when v_ev='REVIEW_REQUIRED' or v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
 v_base:=jsonb_build_object(
  'context',jsonb_build_object('context_type',v_context_type,'sku_id',p_sku_id,'product_id',v_sku.product_id,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',case when v_context_type='EXACT_RUN' then v_run else null end,'run_status',v_run_status,'context_integrity_status',v_integrity),
  'lifecycle',case when v_context_type='LIVE_AS_OF' then jsonb_build_object('product_status',v_sku.product_status,'sku_is_active',v_sku.sku_is_active,'sku_is_sample',v_sku.is_sample) else jsonb_build_object('status','UNKNOWN','reason_code','NOT_FROZEN_IN_RUN') end,
  'identity',jsonb_build_object('product_name',v_sku.product_name,'pack_size',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_size else v_sku.pack_size end,'pack_uom',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_uom else v_sku.uom end),
  'summary',jsonb_build_object('product_master_foundation_status',v_pm,'sku_master_foundation_status',v_sm,'costing_foundation_status',v_cf,'evidence_quality_status',v_ev,'costing_outcome_status',v_out,'overall_severity',v_sev),
  'dependencies',v_dep,'shared_issues','[]'::jsonb,
  'downstream_control',case when v_control.sku_id is null then null else jsonb_build_object('first_control_status',v_control.first_control_status,'control_severity',v_control.control_severity,'recommended_ui_route',v_control.recommended_ui_route,'control_note',v_control.control_note,'material_costing_status',v_control.material_costing_status,'pm_costing_status',v_control.pm_costing_status,'manufacturing_cop_status',v_control.manufacturing_cop_status,'internal_loaded_cost_status',v_control.internal_loaded_cost_status,'pricing_bridge_status',v_control.pricing_bridge_status,'selling_price_bridge_status',v_control.selling_price_bridge_status,'cost_sheet_status',v_control.cost_sheet_status,'refresh_run_id',v_control.refresh_run_id) end);
 if v_run is not null then return costing.fn_wp04_c_enrich(v_base,p_sku_id,v_period,v_val,v_run,p_shared_issues,p_run_envelope); end if;
 return v_base;
end $function$;

CREATE OR REPLACE FUNCTION costing.fn_wp04_old_live_core(p_sku_id bigint,p_period_start date,p_valuation_date date,p_evidence_run_id bigint,p_route_evidence jsonb,p_shared_issues jsonb,p_run_envelope jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
declare
 v_context_type text:='LIVE_AS_OF'; v_period date:=p_period_start; v_val date:=p_valuation_date;
 v_run bigint:=p_evidence_run_id; v_run_status text:=case when p_evidence_run_id is not null then 'SUCCESS' end;
 v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_sku record; v_bom record; v_route record; v_mrp record; v_sell record; v_batch record; v_sales record; v_control record;
 v_pm text; v_sm text; v_cf text; v_ev text; v_out text; v_sev text; v_dep jsonb:='[]'; v_base jsonb;
begin
 select s.id sku_id,s.product_id,s.pack_size,s.uom,s.is_active sku_is_active,s.is_sample,p.item product_name,p.status product_status,p.uom_base,p.conversion_to_base
 into v_sku from public.product_skus s join public.products p on p.id=s.product_id where s.id=p_sku_id;
 if not found then raise exception 'SKU % not found',p_sku_id; end if;

 v_pm:=case when v_sku.uom_base is not null and btrim(v_sku.uom_base)<>'' and v_sku.conversion_to_base>0 then 'RESOLVED' else 'BLOCKED' end;
 v_sm:=case when v_sku.pack_size>0 and nullif(btrim(v_sku.uom),'') is not null then 'RESOLVED' else 'BLOCKED' end;

  select * into v_bom from public.plm_sku_bom_revision_as_of(p_sku_id,v_val) limit 1;
  select * into v_route from jsonb_to_record(p_route_evidence) x(readiness_status text,effective_route_source text);
  select * into v_mrp from costing.fn_resolve_sku_mrp_as_of(p_sku_id,v_val) limit 1;
  select * into v_sell from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id,v_val) limit 1;
  select * into v_batch from public.production_batch_size_ref b where b.product_id=v_sku.product_id and b.is_active and b.effective_from<=v_val and (b.effective_to is null or b.effective_to>=v_val) order by b.effective_from desc,b.id desc limit 1;
  select * into v_sales from costing.fn_resolve_sku_commercial_sales_basis_point(p_sku_id, v_period, v_val) limit 1;
  if v_run is not null then select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1; end if;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_pm,'resolution_source','PRODUCT_MASTER','reason_code',case when v_pm='BLOCKED' then 'PRODUCT_BASE_UOM_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.products'),
   jsonb_build_object('dependency_code','SKU_MASTER','label','SKU master','scope','SKU','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source','SKU_MASTER','reason_code',case when v_sm='BLOCKED' then 'SKU_PACK_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.product_skus'),
   jsonb_build_object('dependency_code','PM_BOM_REVISION','label','Approved PM-BOM revision','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_bom.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_bom.id is null then 'MISSING' else 'APPROVED_EFFECTIVE_REVISION' end,'reason_code',case when v_bom.id is null then 'PM_BOM_REVISION_MISSING' end,'owner_module','PM_BOM_MANAGER','recommended_ui_route','PM_BOM_MANAGER','authority','public.plm_sku_bom_revision_as_of','evidence_ids',jsonb_build_object('revision_id',v_bom.id)),
   jsonb_build_object('dependency_code','BATCH_SIZE_REFERENCE','label','Batch-size reference','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_batch.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_batch.id is null then 'MISSING' else 'EFFECTIVE_REFERENCE' end,'reason_code',case when v_batch.id is null then 'BATCH_SIZE_REFERENCE_MISSING' end,'owner_module','SUPPLY_BATCH_PLAN','recommended_ui_route','BATCH_SIZES','authority','public.production_batch_size_ref','evidence_ids',jsonb_build_object('reference_id',v_batch.id)),
   jsonb_build_object('dependency_code','MANUFACTURING_ROUTE','label','Manufacturing route','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_route.readiness_status='READY' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_route.effective_route_source,'reason_code',case when coalesce(v_route.readiness_status,'')<>'READY' then 'MANUFACTURING_ROUTE_NOT_READY' end,'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.fn_product_process_route_readiness'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_mrp.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_mrp.source_type,'reason_code',case when coalesce(v_mrp.resolution_status,'MISSING')<>'RESOLVED' then 'MRP_POLICY_'||coalesce(v_mrp.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.fn_resolve_sku_mrp_as_of','evidence_ids',jsonb_build_object('policy_id',v_mrp.policy_id)),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_sell.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source','SELLING_PRICE_POLICY','reason_code',case when coalesce(v_sell.resolution_status,'MISSING')<>'RESOLVED' then 'SELLING_POLICY_'||coalesce(v_sell.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.fn_resolve_sku_selling_price_policy_as_of','evidence_ids',jsonb_build_object('policy_id',v_sell.policy_id)),
   jsonb_build_object('dependency_code','COMMON_COMMERCIAL_BASIS','label','Common commercial sales basis','scope','SKU_PERIOD','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end,'resolution_source',v_sales.assumption_source,'reason_code',v_sales.commercial_sales_warning,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','COMMERCIAL_SALES_ASSUMPTIONS','authority','costing.v_sku_commercial_sales_basis')
  );
  v_cf:=case when v_pm='BLOCKED' or v_sm='BLOCKED' or v_bom.id is null or v_batch.id is null or coalesce(v_route.readiness_status,'')<>'READY' or coalesce(v_mrp.resolution_status,'')<>'RESOLVED' or coalesce(v_sell.resolution_status,'')<>'RESOLVED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end;
 v_out:=coalesce(v_control.cost_sheet_status,'UNKNOWN');
 v_sev:=case when v_cf='BLOCKED' or v_ev='BLOCKED' or v_control.control_severity='BLOCKER' then 'BLOCKER' when v_ev='REVIEW_REQUIRED' or v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
 v_base:=jsonb_build_object(
  'context',jsonb_build_object('context_type',v_context_type,'sku_id',p_sku_id,'product_id',v_sku.product_id,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',case when v_context_type='EXACT_RUN' then v_run else null end,'run_status',v_run_status,'context_integrity_status',v_integrity),
  'lifecycle',case when v_context_type='LIVE_AS_OF' then jsonb_build_object('product_status',v_sku.product_status,'sku_is_active',v_sku.sku_is_active,'sku_is_sample',v_sku.is_sample) else jsonb_build_object('status','UNKNOWN','reason_code','NOT_FROZEN_IN_RUN') end,
  'identity',jsonb_build_object('product_name',v_sku.product_name,'pack_size',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_size else v_sku.pack_size end,'pack_uom',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_uom else v_sku.uom end),
  'summary',jsonb_build_object('product_master_foundation_status',v_pm,'sku_master_foundation_status',v_sm,'costing_foundation_status',v_cf,'evidence_quality_status',v_ev,'costing_outcome_status',v_out,'overall_severity',v_sev),
  'dependencies',v_dep,'shared_issues','[]'::jsonb,
  'downstream_control',case when v_control.sku_id is null then null else jsonb_build_object('first_control_status',v_control.first_control_status,'control_severity',v_control.control_severity,'recommended_ui_route',v_control.recommended_ui_route,'control_note',v_control.control_note,'material_costing_status',v_control.material_costing_status,'pm_costing_status',v_control.pm_costing_status,'manufacturing_cop_status',v_control.manufacturing_cop_status,'internal_loaded_cost_status',v_control.internal_loaded_cost_status,'pricing_bridge_status',v_control.pricing_bridge_status,'selling_price_bridge_status',v_control.selling_price_bridge_status,'cost_sheet_status',v_control.cost_sheet_status,'refresh_run_id',v_control.refresh_run_id) end);
 if v_run is not null then return costing.fn_product_sku_readiness_enrich(v_base,p_sku_id,v_period,v_val,v_run); end if;
 return v_base;
end $function$;


ALTER FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_wp04_old_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_old_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $proof$
DECLARE
  route_map jsonb; route_n bigint; route_dist bigint;
  shared jsonb;
  sku_ids bigint[];
  r record;
  old_json jsonb; c_json jsonb;
  compared bigint:=0; mismatches bigint:=0;
  first_mismatch bigint:=null;
BEGIN
 WITH rr AS MATERIALIZED (SELECT * FROM costing.fn_product_process_route_readiness('2026-09-10'::date))
 SELECT count(*),count(distinct product_id),jsonb_object_agg(product_id::text,to_jsonb(rr))
 INTO route_n,route_dist,route_map FROM rr;
 IF route_n<>route_dist THEN RAISE EXCEPTION 'C-F611 nonunique route evidence'; END IF;

 shared:=costing.fn_product_sku_readiness_shared_issues('2026-09-10'::date);

 SELECT array_agg(s.id ORDER BY s.id) INTO sku_ids
 FROM public.product_skus s JOIN public.products p ON p.id=s.product_id
 WHERE p.status='Active' AND s.is_active AND NOT coalesce(s.is_sample,false);

 CREATE TEMP TABLE wp04_f611_evidence(
   sku_id bigint PRIMARY KEY,
   evidence_envelope jsonb NOT NULL
 ) ON COMMIT DROP;

 INSERT INTO wp04_f611_evidence(sku_id,evidence_envelope)
 SELECT sku_id,evidence_envelope
 FROM costing.fn_wp04_c_run_cohort(sku_ids,'2026-09-01'::date,'2026-09-10'::date,115);

 IF (SELECT count(*) FROM wp04_f611_evidence)<>611 THEN RAISE EXCEPTION 'C-F611 cohort coverage mismatch'; END IF;

 FOR r IN
   SELECT s.id sku_id,s.product_id,e.evidence_envelope
   FROM public.product_skus s
   JOIN public.products p ON p.id=s.product_id
   JOIN wp04_f611_evidence e ON e.sku_id=s.id
   WHERE p.status='Active' AND s.is_active AND NOT coalesce(s.is_sample,false)
   ORDER BY s.id
 LOOP
   old_json:=costing.fn_wp04_old_live_core(
     r.sku_id,'2026-09-01'::date,'2026-09-10'::date,115,
     route_map->(r.product_id::text),shared,r.evidence_envelope);
   c_json:=costing.fn_wp04_c_live_core(
     r.sku_id,'2026-09-01'::date,'2026-09-10'::date,115,
     route_map->(r.product_id::text),shared,r.evidence_envelope);
   compared:=compared+1;
   IF old_json IS DISTINCT FROM c_json THEN
     mismatches:=mismatches+1;
     IF first_mismatch IS NULL THEN first_mismatch:=r.sku_id; END IF;
   END IF;
 END LOOP;

 IF compared<>611 THEN RAISE EXCEPTION 'C-F611 comparison coverage mismatch: %',compared; END IF;
 IF mismatches<>0 THEN RAISE EXCEPTION 'C-F611 final-output mismatch count %, first SKU %',mismatches,first_mismatch; END IF;

 PERFORM set_config('wp04.c_f611_result',jsonb_build_object(
  'scope','FULL_611_COMMON_LIVE_COMPOSITION_FINAL_JSON_PARITY',
  'population_skus',611,
  'compared',compared,
  'mismatches',mismatches,
  'first_mismatch_sku',first_mismatch,
  'old_arm','CURRENT_ORIGINAL_ENRICH_AND_POINT_RUN_EVIDENCE',
  'c_arm','C_COHORT_ENVELOPE_AND_C_ENRICH',
  'route_map_shared_between_arms',true,
  'shared_issues_argument_shared_between_arms',true,
  'public_canonical_611_calls',0,
  'portfolio_calls',0,
  'performance_proved',false,
  'native_api_proved',false,
  'application_authorized',false
 )::text,true);
END $proof$;

DROP FUNCTION costing.fn_wp04_old_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb);
DROP FUNCTION costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb);
DROP FUNCTION costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb);
DROP FUNCTION costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint);
DROP FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot);

DO $restore$
BEGIN
 IF EXISTS(
   SELECT 1 FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace
   WHERE (nsp.nspname,p.proname) IN (
    ('costing','fn_wp04_c_run_assemble'),('costing','fn_wp04_c_run_cohort'),
    ('costing','fn_wp04_c_enrich'),('costing','fn_wp04_c_live_core'),
    ('costing','fn_wp04_old_live_core')
   )
 ) THEN RAISE EXCEPTION 'C-F611 temporary proof function remains'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'C-F611 original enrich changed'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'C-F611 original run helper changed'; END IF;
END $restore$;

SELECT current_setting('wp04.c_f611_result')::jsonb AS full611_final_output_parity_result;
ROLLBACK;
