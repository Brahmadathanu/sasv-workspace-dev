-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function costing.fn_product_sku_readiness_shared_issues(p_valuation_date date)
returns jsonb
language plpgsql stable security definer
set search_path=costing,public,pg_temp
as $$
declare v jsonb:='[]'::jsonb; x record; ok boolean;
begin
 if p_valuation_date is null then return jsonb_build_array(jsonb_build_object('issue_code','GLOBAL_CONTEXT_UNKNOWN','scope','GLOBAL','status','UNKNOWN','reason_code','VALUATION_DATE_REQUIRED','owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE')); end if;
 for x in select * from costing.v_cost_driver_policy_registry order by sort_order loop
  ok:=true;
  begin
   if x.cost_element_code='DIRECT_LABOUR' then perform costing.fn_resolve_direct_labour_workload_policy(p_valuation_date);
   elsif x.cost_element_code='PRODUCTION_OVERHEAD' then perform costing.fn_resolve_production_overhead_workload_policy(p_valuation_date);
   elsif x.cost_element_code='QUALITY_CONTROL_OVERHEAD' then perform costing.fn_resolve_qc_workload_policy(p_valuation_date);
   elsif x.cost_element_code='MATERIALS_STORES_OVERHEAD' then perform costing.fn_resolve_materials_stores_workload_policy(p_valuation_date);
   elsif x.cost_element_code='MARKETING_EXPENSE' then perform costing.fn_resolve_marketing_allocation_policy(p_valuation_date);
   elsif x.cost_element_code in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD') then
    if not exists(select 1 from costing.cost_driver_policy_envelope e where e.id=x.envelope_id and e.lifecycle_status='APPROVED' and e.effective_from<=p_valuation_date and (e.effective_to is null or e.effective_to>=p_valuation_date)) then ok:=false; end if;
   end if;
  exception when others then ok:=false;
  end;
  if x.registry_status<>'ACTIVE_FINAL_POLICY' or x.lifecycle_status<>'APPROVED' or x.cutover_status<>'CUTOVER_ACTIVE' or x.client_status<>'CLIENT_READY' or x.data_quality_status<>'DATA_QUALITY_READY' then ok:=false; end if;
  if not ok then
   v:=v||jsonb_build_array(jsonb_build_object('issue_code','GLOBAL_DRIVER_POLICY_'||x.cost_element_code,'dependency_code',x.cost_element_code,'scope','GLOBAL','status','BLOCKED','reason_code','GLOBAL_DRIVER_POLICY_NOT_READY','owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.v_cost_driver_policy_registry','evidence_ids',jsonb_build_object('envelope_id',x.envelope_id,'specialised_policy_id',x.specialised_policy_id)));
  end if;
 end loop;
 return v;
end $$;
revoke all on function costing.fn_product_sku_readiness_shared_issues(date) from public,anon,authenticated;
grant execute on function costing.fn_product_sku_readiness_shared_issues(date) to service_role;

create or replace function costing.fn_product_sku_readiness_enrich(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
returns jsonb language plpgsql stable security definer set search_path=costing,public,pg_temp as $$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb; scheme_status text; regional_status text; shared jsonb;
begin
 e:=costing.fn_product_sku_readiness_run_evidence(p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id);
 shared:=costing.fn_product_sku_readiness_shared_issues(p_valuation_date);
 scheme_status:=case when exists(select 1 from costing.sku_selected_scheme_policy_context_snapshot s where s.sku_id=p_sku_id and s.period_start=p_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id and s.resolution_status not in ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) then 'BLOCKED' when exists(select 1 from costing.sku_selected_scheme_policy_context_snapshot s where s.sku_id=p_sku_id and s.period_start=p_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id) then 'READY' else 'UNKNOWN' end;
 regional_status:=case when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id and r.effective_status='BLOCKED') then 'BLOCKED' when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id and r.effective_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id) then 'READY' else 'NOT_REQUIRED' end;
 deps:=coalesce(p_base->'dependencies','[]')||coalesce(e->'driver_dependencies','[]')||jsonb_build_array(
 jsonb_build_object('dependency_code','SELECTED_SCHEME_POLICY','label','Selected scheme policy','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',scheme_status,'effective_status',scheme_status,'resolution_source','RUN_SNAPSHOT','reason_code',case when scheme_status='BLOCKED' then 'SCHEME_EVIDENCE_BLOCKED' when scheme_status='UNKNOWN' then 'SCHEME_EVIDENCE_NOT_CAPTURED' end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_selected_scheme_policy_context_snapshot','evidence',e->'scheme_evidence'),
 jsonb_build_object('dependency_code','REGIONAL_MARKETING_EVIDENCE','label','Regional Marketing evidence','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability',case when regional_status='NOT_REQUIRED' then 'NOT_REQUIRED' else 'APPLICABLE' end,'raw_status',regional_status,'effective_status',regional_status,'resolution_source',case when regional_status='NOT_REQUIRED' then 'NO_REVIEW_QUEUE_ITEM' else 'RUN_SNAPSHOT_PLUS_ACCEPTANCE' end,'reason_code',case when regional_status in ('BLOCKED','REVIEW_REQUIRED') then 'REGIONAL_MARKETING_'||regional_status end,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route','REGIONAL_MARKETING_REVIEW','authority','costing.v_regional_marketing_evidence_review_queue','evidence',e->'regional_marketing_evidence'));
 select case when jsonb_array_length(shared)>0 then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER')) then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='UNKNOWN') then 'UNKNOWN' else 'READY' end into ev;
 sev:=case when p_base#>>'{summary,costing_foundation_status}'='BLOCKED' or ev='BLOCKED' or p_base#>>'{summary,overall_severity}'='BLOCKER' then 'BLOCKER' when ev='REVIEW_REQUIRED' or p_base#>>'{summary,overall_severity}'='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when ev='UNKNOWN' and p_base#>>'{summary,overall_severity}'<>'READY' then 'UNKNOWN' else coalesce(p_base#>>'{summary,overall_severity}','UNKNOWN') end;
 ctx:=jsonb_set(p_base->'context','{evidence_refresh_run_id}',to_jsonb(p_refresh_run_id),true);
 return jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_base,'{context}',ctx,true),'{dependencies}',deps,true),'{shared_issues}',shared,true),'{summary,evidence_quality_status}',to_jsonb(ev),true),'{summary,overall_severity}',to_jsonb(sev),true);
end $$;
revoke all on function costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) from public,anon,authenticated;
grant execute on function costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) to service_role;
