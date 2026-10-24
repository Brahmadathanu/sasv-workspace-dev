-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function costing.fn_product_sku_readiness_enrich(
 p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint
) returns jsonb
language plpgsql stable security definer
set search_path=costing,public,pg_temp
as $$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb; scheme_status text; regional_status text;
begin
 e:=costing.fn_product_sku_readiness_run_evidence(p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id);
 scheme_status:=case
   when exists(select 1 from costing.sku_selected_scheme_policy_context_snapshot s where s.sku_id=p_sku_id and s.period_start=p_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id and s.resolution_status not in ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) then 'BLOCKED'
   when exists(select 1 from costing.sku_selected_scheme_policy_context_snapshot s where s.sku_id=p_sku_id and s.period_start=p_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id) then 'READY'
   else 'UNKNOWN' end;
 regional_status:=case
   when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id and r.effective_status='BLOCKED') then 'BLOCKED'
   when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id and r.effective_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
   when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id) then 'READY'
   else 'NOT_REQUIRED' end;

 deps:=coalesce(p_base->'dependencies','[]'::jsonb)||coalesce(e->'driver_dependencies','[]'::jsonb)
   ||jsonb_build_array(
     jsonb_build_object('dependency_code','SELECTED_SCHEME_POLICY','label','Selected scheme policy','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',scheme_status,'effective_status',scheme_status,'resolution_source','RUN_SNAPSHOT','reason_code',case when scheme_status='BLOCKED' then 'SCHEME_EVIDENCE_BLOCKED' when scheme_status='UNKNOWN' then 'SCHEME_EVIDENCE_NOT_CAPTURED' end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_selected_scheme_policy_context_snapshot','evidence',e->'scheme_evidence'),
     jsonb_build_object('dependency_code','REGIONAL_MARKETING_EVIDENCE','label','Regional Marketing evidence','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability',case when regional_status='NOT_REQUIRED' then 'NOT_REQUIRED' else 'APPLICABLE' end,'raw_status',regional_status,'effective_status',regional_status,'resolution_source',case when regional_status='NOT_REQUIRED' then 'NO_REVIEW_QUEUE_ITEM' else 'RUN_SNAPSHOT_PLUS_ACCEPTANCE' end,'reason_code',case when regional_status in ('BLOCKED','REVIEW_REQUIRED') then 'REGIONAL_MARKETING_'||regional_status end,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route','REGIONAL_MARKETING_REVIEW','authority','costing.v_regional_marketing_evidence_review_queue','evidence',e->'regional_marketing_evidence')
   );
 select case
   when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER')) then 'BLOCKED'
   when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
   when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='UNKNOWN') then 'UNKNOWN'
   else 'READY' end into ev;
 sev:=case when p_base#>>'{summary,costing_foundation_status}'='BLOCKED' or ev='BLOCKED' or p_base#>>'{summary,overall_severity}'='BLOCKER' then 'BLOCKER'
           when ev='REVIEW_REQUIRED' or p_base#>>'{summary,overall_severity}'='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
           when ev='UNKNOWN' and p_base#>>'{summary,overall_severity}'<>'READY' then 'UNKNOWN'
           else coalesce(p_base#>>'{summary,overall_severity}','UNKNOWN') end;
 ctx:=jsonb_set(p_base->'context','{evidence_refresh_run_id}',to_jsonb(p_refresh_run_id),true);
 return jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_base,'{context}',ctx,true),'{dependencies}',deps,true),'{summary,evidence_quality_status}',to_jsonb(ev),true),'{summary,overall_severity}',to_jsonb(sev),true);
end $$;
revoke all on function costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) from public,anon,authenticated;
grant execute on function costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) to service_role;
