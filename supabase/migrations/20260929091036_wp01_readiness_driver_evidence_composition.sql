-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function costing.fn_product_sku_readiness_enrich(
 p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint
) returns jsonb
language plpgsql stable security definer
set search_path=costing,public,pg_temp
as $$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb;
begin
 e:=costing.fn_product_sku_readiness_run_evidence(p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id);
 deps:=coalesce(p_base->'dependencies','[]'::jsonb)||coalesce(e->'driver_dependencies','[]'::jsonb)
   ||jsonb_build_array(
     jsonb_build_object('dependency_code','SELECTED_SCHEME_POLICY','label','Selected scheme policy','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',e->>'scheme_status','effective_status',e->>'scheme_status','resolution_source','RUN_SNAPSHOT','reason_code',case when e->>'scheme_status' not in ('READY') then 'SCHEME_EVIDENCE_'||(e->>'scheme_status') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_selected_scheme_policy_context_snapshot','evidence',e->'scheme_evidence'),
     jsonb_build_object('dependency_code','REGIONAL_MARKETING_EVIDENCE','label','Regional Marketing evidence','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',e->>'regional_marketing_status','effective_status',e->>'regional_marketing_status','resolution_source','RUN_SNAPSHOT_PLUS_ACCEPTANCE','reason_code',case when e->>'regional_marketing_status'<>'READY' then 'REGIONAL_MARKETING_'||(e->>'regional_marketing_status') end,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route','REGIONAL_MARKETING_REVIEW','authority','costing.v_regional_marketing_evidence_review_queue','evidence',e->'regional_marketing_evidence')
   );

 select case
   when exists(select 1 from jsonb_array_elements(deps) d where d->>'dimension'='EVIDENCE_QUALITY' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER')) then 'BLOCKED'
   when exists(select 1 from jsonb_array_elements(deps) d where d->>'dimension'='EVIDENCE_QUALITY' and coalesce(d->>'effective_status',d->>'raw_status')='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
   when exists(select 1 from jsonb_array_elements(deps) d where d->>'dimension'='EVIDENCE_QUALITY' and coalesce(d->>'effective_status',d->>'raw_status')='UNKNOWN') then 'UNKNOWN'
   else 'READY' end into ev;

 sev:=case
   when p_base#>>'{summary,costing_foundation_status}'='BLOCKED' or ev='BLOCKED' or p_base#>>'{summary,overall_severity}'='BLOCKER' then 'BLOCKER'
   when ev='REVIEW_REQUIRED' or p_base#>>'{summary,overall_severity}'='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
   when ev='UNKNOWN' and p_base#>>'{summary,overall_severity}'<>'READY' then 'UNKNOWN'
   else coalesce(p_base#>>'{summary,overall_severity}','UNKNOWN') end;

 ctx:=jsonb_set(p_base->'context','{evidence_refresh_run_id}',to_jsonb(p_refresh_run_id),true);
 return jsonb_set(
   jsonb_set(
    jsonb_set(
     jsonb_set(p_base,'{context}',ctx,true),
     '{dependencies}',deps,true),
    '{summary,evidence_quality_status}',to_jsonb(ev),true),
   '{summary,overall_severity}',to_jsonb(sev),true);
end $$;

revoke all on function costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) from public,anon,authenticated;
grant execute on function costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) to service_role;
