-- UNAPPLIED HIGH-RISK REVIEW DRAFT. This file is traceability, NOT authorization.
-- Apply only via a separately approved direct server operation bound to the reviewed target/package.
-- Do not execute or rehearse on production from this planning gate.
-- Exact revert of this package only; reject mismatched/missing candidate definitions.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected rollback owner'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)')) IS DISTINCT FROM '7f7528b3dec9efa0dd0a9ba7e59fc50b' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM 'c1f37b9477f239cf87c44901ecd3ca6e' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)')) IS DISTINCT FROM 'b79c5e8476aa3c645cf6c1083909beb6' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '7c54b0edc159d08647e8df73d51fbe51' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_governed_periods(date,integer)')) IS DISTINCT FROM '671e150396f388875735e68818dcb574' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)')) IS DISTINCT FROM '4ae66ab181270cfd41e16d2969d20d58' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)')) IS DISTINCT FROM '4c841fe074170a13b9dbca57c5aeacbc' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
END $guard$;
-- Exact reviewed identity, including the complete ACL set (order independent).
DO $identity$
DECLARE expected record; actual record; actual_acl text[];
BEGIN
 FOR expected IN SELECT * FROM (VALUES
  ('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','7f7528b3dec9efa0dd0a9ba7e59fc50b',ARRAY['p_base','p_sku_id','p_period_start','p_valuation_date','p_refresh_run_id','p_shared_issues']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false']::text[]),
  ('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)','c1f37b9477f239cf87c44901ecd3ca6e',ARRAY['p_base','p_sku_id','p_period_start','p_valuation_date','p_refresh_run_id']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false','service_role:postgres:EXECUTE:false']::text[]),
  ('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','b79c5e8476aa3c645cf6c1083909beb6',ARRAY['p_sku_id','p_period_start','p_valuation_date','p_evidence_run_id','p_route_evidence','p_shared_issues']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)','7c54b0edc159d08647e8df73d51fbe51',ARRAY['p_sku_id','p_period_start','p_context_type','p_refresh_run_id']::text[],'''LIVE_AS_OF''::text, NULL::bigint',2,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false','service_role:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_readiness_governed_periods(date,integer)','671e150396f388875735e68818dcb574',ARRAY['p_before_period_start','p_limit']::text[],'NULL::date, 24',2,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','4ae66ab181270cfd41e16d2969d20d58',ARRAY['p_product_scope','p_gap_kind','p_search','p_after_product_id','p_limit']::text[],'''ACTIVE_PRODUCTS''::text, ''NO_SKU''::text, NULL::text, NULL::bigint, 50',5,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','4c841fe074170a13b9dbca57c5aeacbc',ARRAY['p_period_start','p_population_scope','p_overall_severities','p_dependency_codes','p_owner_modules','p_route_codes','p_search','p_after_sku_id','p_limit']::text[],'''OPERATIONAL''::text, NULL::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text, NULL::bigint, 50',8,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[])
 ) AS e(signature,body_md5,argnames,defaults_expression,default_count,path_setting,acl_entries)
 LOOP
  SELECT p.*,l.lanname,r.rolname AS owner_name INTO actual
   FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.oid=to_regprocedure(expected.signature);
  IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed package function missing: %',expected.signature; END IF;
  SELECT array_agg(coalesce(grantee_role.rolname,'PUBLIC')||':'||grantor_role.rolname||':'||a.privilege_type||':'||a.is_grantable::text ORDER BY coalesce(grantee_role.rolname,'PUBLIC'),grantor_role.rolname,a.privilege_type,a.is_grantable)
   INTO actual_acl FROM aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a
   LEFT JOIN pg_roles grantee_role ON grantee_role.oid=a.grantee
   JOIN pg_roles grantor_role ON grantor_role.oid=a.grantor;
  IF md5(actual.prosrc) IS DISTINCT FROM expected.body_md5
   OR actual.owner_name IS DISTINCT FROM 'postgres'
   OR actual.lanname IS DISTINCT FROM 'plpgsql'
   OR actual.prorettype IS DISTINCT FROM 'jsonb'::regtype
   OR actual.proargnames IS DISTINCT FROM expected.argnames
   OR actual.pronargdefaults IS DISTINCT FROM expected.default_count
   OR pg_get_expr(actual.proargdefaults,0) IS DISTINCT FROM expected.defaults_expression
   OR actual.proargmodes IS NOT NULL OR actual.proallargtypes IS NOT NULL
   OR actual.provariadic<>0 OR actual.proretset OR actual.prokind<>'f'
   OR actual.procost<>100 OR actual.prorows<>0 OR actual.prosupport<>0 OR actual.protrftypes IS NOT NULL
   OR actual.provolatile<>'s' OR NOT actual.prosecdef OR actual.proisstrict OR actual.proleakproof OR actual.proparallel<>'u'
   OR actual.proconfig IS DISTINCT FROM ARRAY[expected.path_setting]::text[]
   OR actual_acl IS DISTINCT FROM expected.acl_entries
  THEN RAISE EXCEPTION 'Reviewed package identity drift: %',expected.signature; END IF;
 END LOOP;
END $identity$;
DROP FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer);
DROP FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer);
DROP FUNCTION public.rpc_get_readiness_governed_periods(date,integer);
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_enrich(p_base jsonb, p_sku_id bigint, p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text DEFAULT 'LIVE_AS_OF'::text, p_refresh_run_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare
 v_context_type text:=upper(coalesce(nullif(btrim(p_context_type),''),'LIVE_AS_OF'));
 v_period date; v_val date; v_run bigint; v_run_status text; v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_sku record; v_bom record; v_route record; v_mrp record; v_sell record; v_batch record; v_sales record; v_control record;
 v_pm text; v_sm text; v_cf text; v_ev text; v_out text; v_sev text; v_dep jsonb:='[]'; v_base jsonb;
begin
 
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.app_has_permission('module:manage-products', 'view')
    or public.app_has_permission('module:costing-control-center', 'view')
  ) then
    raise exception 'Permission denied for module:manage-products or module:costing-control-center (edit=false)';
  end if;

 if p_sku_id is null then raise exception 'SKU ID is required'; end if;
 if v_context_type not in ('LIVE_AS_OF','EXACT_RUN') then raise exception 'Invalid context type %',p_context_type; end if;
 select s.id sku_id,s.product_id,s.pack_size,s.uom,s.is_active sku_is_active,s.is_sample,p.item product_name,p.status product_status,p.uom_base,p.conversion_to_base
 into v_sku from public.product_skus s join public.products p on p.id=s.product_id where s.id=p_sku_id;
 if not found then raise exception 'SKU % not found',p_sku_id; end if;

 if v_context_type='LIVE_AS_OF' then
  if p_period_start is null then raise exception 'Costing period start is required for LIVE_AS_OF'; end if;
  v_period:=date_trunc('month',p_period_start::timestamp)::date;
  select valuation_date into v_val from costing.cost_periods where period_start=v_period;
  if v_val is null then raise exception 'Governed valuation date is missing for period %',v_period; end if;
  if p_refresh_run_id is not null then raise exception 'Refresh run ID is not accepted for LIVE_AS_OF'; end if;
  select id,overall_status into v_run,v_run_status from costing.costing_refresh_run
   where period_start=v_period and valuation_date=v_val and overall_status='SUCCESS'
   order by finished_at desc nulls last,id desc limit 1;
 else
  if p_refresh_run_id is null then raise exception 'Refresh run ID is required for EXACT_RUN'; end if;
  select r.id,r.period_start,r.valuation_date,r.overall_status,
   case when exists(select 1 from costing.costing_refresh_run_stage st where st.refresh_run_id=r.id and (st.period_start is distinct from r.period_start or st.valuation_date is distinct from r.valuation_date)) then 'MISMATCH'
        when r.valuation_context_source='LEGACY_BACKFILL' then 'LEGACY_UNVERIFIED' else 'CONSISTENT' end
  into v_run,v_period,v_val,v_run_status,v_integrity from costing.costing_refresh_run r where r.id=p_refresh_run_id;
  if v_run is null then raise exception 'Refresh run % not found',p_refresh_run_id; end if;
  if p_period_start is not null and date_trunc('month',p_period_start::timestamp)::date<>v_period then raise exception 'Supplied period does not match refresh run context'; end if;
 end if;

 v_pm:=case when v_sku.uom_base is not null and btrim(v_sku.uom_base)<>'' and v_sku.conversion_to_base>0 then 'RESOLVED' else 'BLOCKED' end;
 v_sm:=case when v_sku.pack_size>0 and nullif(btrim(v_sku.uom),'') is not null then 'RESOLVED' else 'BLOCKED' end;

 if v_context_type='LIVE_AS_OF' then
  select * into v_bom from public.plm_sku_bom_revision_as_of(p_sku_id,v_val) limit 1;
  select * into v_route from costing.fn_product_process_route_readiness(v_val) x where x.product_id=v_sku.product_id limit 1;
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
 else
  select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1;
  v_pm:='UNKNOWN'; v_sm:=case when v_control.sku_id is not null and v_control.pack_size>0 and nullif(btrim(v_control.pack_uom),'') is not null then 'RESOLVED' else 'UNKNOWN' end;
  v_cf:=case when v_control.sku_id is null then 'UNKNOWN' when v_control.cost_sheet_status='BLOCKED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_control.sku_id is null then 'UNKNOWN' when v_control.control_severity='BLOCKER' then 'BLOCKED' when v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status','UNKNOWN','resolution_source','NOT_FROZEN_IN_RUN','reason_code','NOT_FROZEN_IN_RUN','owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','EXACT_RUN_FROZEN_EVIDENCE_ONLY'),
   jsonb_build_object('dependency_code','SKU_PACK_IDENTITY','label','SKU pack identity','scope','SKU_EXACT_RUN','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source',case when v_control.sku_id is null then 'NO_RUN_SNAPSHOT' else 'RUN_CONTROL_SNAPSHOT' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_EXACT_RUN','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_control.mrp_resolution_status='RESOLVED' then 'RESOLVED' when v_control.sku_id is null then 'UNKNOWN' else 'BLOCKED' end,'resolution_source','RUN_CONTROL_SNAPSHOT','owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_EXACT_RUN','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_control.selling_policy_resolution_status='RESOLVED' then 'RESOLVED' when v_control.sku_id is null then 'UNKNOWN' else 'BLOCKED' end,'resolution_source','RUN_CONTROL_SNAPSHOT','owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','FINAL_COSTING_CONTROL','label','Final costing control','scope','SKU_EXACT_RUN','dimension','COSTING_OUTCOME','applicability','APPLICABLE','raw_status',coalesce(v_control.cost_sheet_status,'UNKNOWN'),'resolution_source',case when v_control.sku_id is null then 'NO_RUN_SNAPSHOT' else 'RUN_CONTROL_SNAPSHOT' end,'reason_code',v_control.first_control_status,'note',v_control.control_note,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route',v_control.recommended_ui_route,'authority','costing.sku_costing_control_status_snapshot')
  );
 end if;
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
DROP FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb);
DROP FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb);
DO $guard$
BEGIN
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' OR (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Rollback restoration mismatch'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' OR (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Rollback restoration mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Rollback attributes mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=costing, public, pg_temp']::text[]) THEN RAISE EXCEPTION 'Rollback attributes mismatch'; END IF;
END $guard$;
COMMIT;
