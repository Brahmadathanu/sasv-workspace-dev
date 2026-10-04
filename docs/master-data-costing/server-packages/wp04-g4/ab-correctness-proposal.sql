-- WP04 A/B BOUNDED CORRECTNESS PROPOSAL ONLY / NOT AUTHORIZED.
-- Target qhmoqtxpeasamtlxaoak via connected operation; main4a8525caf4bf95e9c60bb00188706154d36b3d85.
-- Zero operational portfolio invocations: aggregation fragments consume three captured assessments.
-- No native Auth/API or performance proof. Old/corrected package definitions are transaction-local.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
SET LOCAL idle_in_transaction_session_timeout='30s';
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
DO $events$
BEGIN
 IF (SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D') IS DISTINCT FROM '4e2c16f8333e51161dc11c5376fb3296' THEN RAISE EXCEPTION 'Reviewed DDL event-trigger state drifted'; END IF;
END $events$;
DO $context$
DECLARE latest_run bigint;
BEGIN
 IF (SELECT valuation_date FROM costing.cost_periods WHERE period_start='2026-09-01') IS DISTINCT FROM '2026-09-10'::date THEN RAISE EXCEPTION 'Governed context drift'; END IF;
 SELECT id INTO latest_run FROM costing.costing_refresh_run WHERE period_start='2026-09-01' AND valuation_date='2026-09-10' AND overall_status='SUCCESS' ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1;
 IF latest_run IS DISTINCT FROM 115::bigint THEN RAISE EXCEPTION 'Successful evidence drift'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('id',s.id,'product_id',s.product_id,'product_status',p.status,'sku_is_active',s.is_active,'sku_is_sample',s.is_sample) ORDER BY s.id) FROM public.product_skus s JOIN public.products p ON p.id=s.product_id WHERE s.id IN (1,11,1795)) IS DISTINCT FROM '[{"id":1,"product_id":1,"product_status":"Active","sku_is_active":true,"sku_is_sample":false},{"id":11,"product_id":14,"product_status":"Active","sku_is_active":true,"sku_is_sample":false},{"id":1795,"product_id":794,"product_status":"Inactive","sku_is_active":false,"sku_is_sample":true}]'::jsonb THEN RAISE EXCEPTION 'Bounded sample membership drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM costing.costing_refresh_run WHERE id=114 AND period_start='2026-09-01' AND valuation_date='2026-09-10') THEN RAISE EXCEPTION 'EXACT114 context drift'; END IF;
 PERFORM set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6',true);
 IF auth.uid() IS DISTINCT FROM 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid OR NOT public.app_has_permission('module:costing-control-center','view') THEN RAISE EXCEPTION 'Existing actor context/permission missing'; END IF;
END $context$;
DO $literals$
DECLARE scheme jsonb; regional jsonb; old_status text; new_status text;
BEGIN
 FOR scheme IN SELECT value FROM jsonb_array_elements('[[],[{"raw_status":"RESOLVED_POLICY"}],[{"raw_status":null}],[{"raw_status":"RESOLVED"},{"raw_status":"BLOCKED"}],[{"raw_status":"DEFAULT_NO_SCHEME"}]]'::jsonb) LOOP
  SELECT CASE WHEN EXISTS(SELECT 1 FROM jsonb_to_recordset(scheme) AS x(raw_status text) WHERE raw_status NOT IN ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) THEN 'BLOCKED' WHEN EXISTS(SELECT 1 FROM jsonb_to_recordset(scheme) AS x(raw_status text)) THEN 'READY' ELSE 'UNKNOWN' END INTO old_status;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(scheme) x(row) WHERE row->>'raw_status' NOT IN ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) THEN 'BLOCKED' WHEN jsonb_array_length(scheme)>0 THEN 'READY' ELSE 'UNKNOWN' END INTO new_status;
  IF old_status IS DISTINCT FROM new_status THEN RAISE EXCEPTION 'Scheme literal predicate parity failed'; END IF;
 END LOOP;
 FOR regional IN SELECT value FROM jsonb_array_elements('[[],[{"effective_status":null}],[{"effective_status":"READY"}],[{"effective_status":"REVIEW_REQUIRED"}],[{"effective_status":"REVIEW_REQUIRED"},{"effective_status":"BLOCKED"}]]'::jsonb) LOOP
  SELECT CASE WHEN EXISTS(SELECT 1 FROM jsonb_to_recordset(regional) AS x(effective_status text) WHERE effective_status='BLOCKED') THEN 'BLOCKED' WHEN EXISTS(SELECT 1 FROM jsonb_to_recordset(regional) AS x(effective_status text) WHERE effective_status='REVIEW_REQUIRED') THEN 'REVIEW_REQUIRED' WHEN EXISTS(SELECT 1 FROM jsonb_to_recordset(regional) AS x(effective_status text)) THEN 'READY' ELSE 'NOT_REQUIRED' END INTO old_status;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(regional) x(row) WHERE row->>'effective_status'='BLOCKED') THEN 'BLOCKED' WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(regional) x(row) WHERE row->>'effective_status'='REVIEW_REQUIRED') THEN 'REVIEW_REQUIRED' WHEN jsonb_array_length(regional)>0 THEN 'READY' ELSE 'NOT_REQUIRED' END INTO new_status;
  IF old_status IS DISTINCT FROM new_status THEN RAISE EXCEPTION 'Regional literal predicate parity failed'; END IF;
 END LOOP;
END $literals$;
DO $capture$
DECLARE baseline jsonb;
BEGIN
 baseline:=jsonb_build_object(
 'live1',public.rpc_get_product_sku_readiness(1,'2026-09-01','LIVE_AS_OF',null),
 'live11',public.rpc_get_product_sku_readiness(11,'2026-09-01','LIVE_AS_OF',null),
 'live1795',public.rpc_get_product_sku_readiness(1795,'2026-09-01','LIVE_AS_OF',null),
 'exact114',public.rpc_get_product_sku_readiness(11,'2026-09-01','EXACT_RUN',114),
 'exact115',public.rpc_get_product_sku_readiness(11,'2026-09-01','EXACT_RUN',115));
 IF EXISTS(SELECT 1 FROM public.product_skus WHERE id=-1) THEN RAISE EXCEPTION 'Missing-SKU test identity now exists'; END IF;
 BEGIN
  PERFORM public.rpc_get_product_sku_readiness(-1,'2026-09-01','LIVE_AS_OF',null);
  RAISE EXCEPTION 'Missing SKU unexpectedly returned';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'SKU -1 not found' THEN RAISE; END IF;
 END;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(baseline#>'{live1,dependencies}') d CROSS JOIN LATERAL jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) e WHERE d->>'dependency_code'='SELECTED_SCHEME_POLICY' AND e->>'raw_status'='RESOLVED_POLICY') THEN RAISE EXCEPTION 'Required RESOLVED_POLICY sample drift'; END IF;
 PERFORM set_config('wp04.ab_original',baseline::text,true);
END $capture$;

-- Exact historical candidate package, no full portfolio invocation.
-- UNAPPLIED HIGH-RISK REVIEW DRAFT. This file is traceability, NOT authorization.
-- Apply only via a separately approved direct server operation bound to the reviewed target/package.
-- Do not execute or rehearse on production from this planning gate.
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
-- UNAPPLIED REVIEW DRAFT: extracted canonical authority, not a second evaluator.
CREATE FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(p_base jsonb, p_sku_id bigint, p_period_start date, p_valuation_date date, p_refresh_run_id bigint, p_shared_issues jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb; scheme_status text; regional_status text; shared jsonb;
begin
 e:=costing.fn_product_sku_readiness_run_evidence(p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id);
 shared:=p_shared_issues;
 scheme_status:=case when exists(select 1 from costing.sku_selected_scheme_policy_context_snapshot s where s.sku_id=p_sku_id and s.period_start=p_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id and s.resolution_status not in ('RESOLVED','RESOLVED_POLICY','DEFAULT_NO_SCHEME')) then 'BLOCKED' when exists(select 1 from costing.sku_selected_scheme_policy_context_snapshot s where s.sku_id=p_sku_id and s.period_start=p_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id) then 'READY' else 'UNKNOWN' end;
 regional_status:=case when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id and r.effective_status='BLOCKED') then 'BLOCKED' when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id and r.effective_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' when exists(select 1 from costing.v_regional_marketing_evidence_review_queue r where r.sku_id=p_sku_id and r.period_start=p_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id) then 'READY' else 'NOT_REQUIRED' end;
 deps:=coalesce(p_base->'dependencies','[]')||coalesce(e->'driver_dependencies','[]')||jsonb_build_array(
 jsonb_build_object('dependency_code','SELECTED_SCHEME_POLICY','label','Selected scheme policy','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',scheme_status,'effective_status',scheme_status,'resolution_source','RUN_SNAPSHOT','reason_code',case when scheme_status='BLOCKED' then 'SCHEME_EVIDENCE_BLOCKED' when scheme_status='UNKNOWN' then 'SCHEME_EVIDENCE_NOT_CAPTURED' end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_selected_scheme_policy_context_snapshot','evidence',e->'scheme_evidence'),
 jsonb_build_object('dependency_code','REGIONAL_MARKETING_EVIDENCE','label','Regional Marketing evidence','scope','SKU_REGION_RUN','dimension','EVIDENCE_QUALITY','applicability',case when regional_status='NOT_REQUIRED' then 'NOT_REQUIRED' else 'APPLICABLE' end,'raw_status',regional_status,'effective_status',regional_status,'resolution_source',case when regional_status='NOT_REQUIRED' then 'NO_REVIEW_QUEUE_ITEM' else 'RUN_SNAPSHOT_PLUS_ACCEPTANCE' end,'reason_code',case when regional_status in ('BLOCKED','REVIEW_REQUIRED') then 'REGIONAL_MARKETING_'||regional_status end,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route','REGIONAL_MARKETING_REVIEW','authority','costing.v_regional_marketing_evidence_review_queue','evidence',e->'regional_marketing_evidence'));
 select case when jsonb_array_length(shared)>0 then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER')) then 'BLOCKED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' when exists(select 1 from jsonb_array_elements(deps)d where d->>'dimension'='EVIDENCE_QUALITY' and d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status')='UNKNOWN') then 'UNKNOWN' else 'READY' end into ev;
 sev:=case when p_base#>>'{summary,costing_foundation_status}'='BLOCKED' or ev='BLOCKED' or p_base#>>'{summary,overall_severity}'='BLOCKER' then 'BLOCKER' when ev='REVIEW_REQUIRED' or p_base#>>'{summary,overall_severity}'='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when ev='UNKNOWN' and p_base#>>'{summary,overall_severity}'<>'READY' then 'UNKNOWN' else coalesce(p_base#>>'{summary,overall_severity}','UNKNOWN') end;
 ctx:=jsonb_set(p_base->'context','{evidence_refresh_run_id}',to_jsonb(p_refresh_run_id),true);
 return jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_base,'{context}',ctx,true),'{dependencies}',deps,true),'{shared_issues}',shared,true),'{summary,evidence_quality_status}',to_jsonb(ev),true),'{summary,overall_severity}',to_jsonb(sev),true);
end $function$
;
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_enrich(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
begin
 return costing.fn_product_sku_readiness_enrich_with_shared(p_base,p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id,costing.fn_product_sku_readiness_shared_issues(p_valuation_date));
end $function$;

CREATE FUNCTION costing.fn_product_sku_readiness_live_core(
 p_sku_id bigint,p_period_start date,p_valuation_date date,p_evidence_run_id bigint,
 p_route_evidence jsonb,p_shared_issues jsonb)
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
 if v_run is not null then return costing.fn_product_sku_readiness_enrich_with_shared(v_base,p_sku_id,v_period,v_val,v_run,p_shared_issues); end if;
 return v_base;
end $function$
;
CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text DEFAULT 'LIVE_AS_OF'::text, p_refresh_run_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare
 v_context_type text:=upper(coalesce(nullif(btrim(p_context_type),''),'LIVE_AS_OF'));
 v_period date; v_val date; v_run bigint; v_run_status text; v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_route_json jsonb; v_shared_json jsonb;
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

 if v_context_type='LIVE_AS_OF' then
  select to_jsonb(x) into v_route_json from costing.fn_product_process_route_readiness(v_val) x where x.product_id=v_sku.product_id limit 1;
  v_shared_json:='[]'::jsonb;
  if v_run is not null then v_shared_json:=costing.fn_product_sku_readiness_shared_issues(v_val); end if;
  return costing.fn_product_sku_readiness_live_core(p_sku_id,v_period,v_val,v_run,v_route_json,v_shared_json);
 end if;
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
end $function$
;

-- UNAPPLIED REVIEW DRAFT. No application permitted by file presence.
CREATE FUNCTION public.rpc_get_readiness_governed_periods(p_before_period_start date DEFAULT NULL,p_limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid limit'; end if;
 with candidates as materialized (
  select period_start,valuation_date from costing.cost_periods
  where p_before_period_start is null or period_start<p_before_period_start
  order by period_start desc limit p_limit+1
 ), page as materialized (select * from candidates order by period_start desc limit p_limit)
 select jsonb_build_object('observed_at',statement_timestamp(),'before_period_start',p_before_period_start,'limit',p_limit,
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by period_start desc) from page p),'[]'::jsonb),
  'returned_count',(select count(*) from page),'has_more',(select count(*)>p_limit from candidates),
  'next_before_period_start',case when (select count(*)>p_limit from candidates) then (select min(period_start) from page) end)
 into result;
 return result;
end $function$;

CREATE FUNCTION public.rpc_get_readiness_product_gaps(p_product_scope text DEFAULT 'ACTIVE_PRODUCTS',p_gap_kind text DEFAULT 'NO_SKU',p_search text DEFAULT NULL,p_after_product_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare result jsonb; v_search text:=nullif(btrim(p_search),'');
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_product_scope is null or p_product_scope not in ('ACTIVE_PRODUCTS','ALL_PRODUCTS') then raise exception 'Invalid Product scope'; end if;
 if p_gap_kind is null or p_gap_kind not in ('NO_SKU','ACTIVE_WITHOUT_ACTIVE_SKU') then raise exception 'Invalid gap kind'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_product_id<0 then raise exception 'Invalid pagination'; end if;
 if length(v_search)>120 then raise exception 'Search too long'; end if;
 with membership as materialized (
  select p.id as product_id,p.item as product_name,p.status as product_status,
   not exists(select 1 from public.product_skus s where s.product_id=p.id) as no_sku,
   p.status='Active' and not exists(select 1 from public.product_skus s where s.product_id=p.id and s.is_active) as active_without_active_sku
  from public.products p where p_product_scope='ALL_PRODUCTS' or p.status='Active'
 ), matched as materialized (
  select * from membership where (case p_gap_kind when 'NO_SKU' then no_sku else active_without_active_sku end)
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=product_id::text)
 ), candidates as materialized (
  select * from matched where p_after_product_id is null or product_id>p_after_product_id order by product_id limit p_limit+1
 ), page as materialized (select * from candidates order by product_id limit p_limit)
 select jsonb_build_object('assessment_kind','PRODUCT_MEMBERSHIP_GAPS','observed_at',statement_timestamp(),
  'product_scope',p_product_scope,'gap_kind',p_gap_kind,'search',v_search,'after_product_id',p_after_product_id,'limit',p_limit,
  'statistics',jsonb_build_object('product_count',(select count(*) from membership),'no_sku_count',(select count(*) from membership where no_sku),
    'active_without_active_sku_count',(select count(*) from membership where active_without_active_sku)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'product_status',product_status,'gap_kind',p_gap_kind) order by product_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_product_id',case when (select count(*)>p_limit from candidates) then (select max(product_id) from page) end)
 into result;
 return result;
end $function$;

CREATE FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 p_period_start date,p_population_scope text DEFAULT 'OPERATIONAL',p_overall_severities text[] DEFAULT NULL,
 p_dependency_codes text[] DEFAULT NULL,p_owner_modules text[] DEFAULT NULL,p_route_codes text[] DEFAULT NULL,
 p_search text DEFAULT NULL,p_after_sku_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare
 v_period date; v_val date; v_run bigint; v_route_map jsonb; v_route_count bigint; v_route_distinct bigint;
 v_shared jsonb:='[]'::jsonb; v_rows jsonb; v_result jsonb; v_search text:=nullif(btrim(p_search),'');
 v_values text[]; v_allowed text[]; v_normalized text[]; i integer;
 v_severities text[]; v_codes text[]; v_owners text[]; v_routes text[];
 v_dependency_options constant text[]:=array['PRODUCT_MASTER','SKU_MASTER','PM_BOM_REVISION','BATCH_SIZE_REFERENCE','MANUFACTURING_ROUTE','MRP_POLICY','SELLING_PRICE_POLICY','COMMON_COMMERCIAL_BASIS','DIRECT_LABOUR','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD','MATERIALS_STORES_OVERHEAD','ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD','MARKETING_EXPENSE','SELECTED_SCHEME_POLICY','REGIONAL_MARKETING_EVIDENCE'];
 v_owner_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','SUPPLY_BATCH_PLAN','PRODUCTION_ROUTE_MANAGER','PRICING_POLICY_MANAGER','COST_SHEET_REVIEW','COST_BUILD_MANAGER','COSTING_CONTROL_CENTER'];
 v_route_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','BATCH_SIZES','PRODUCTION_ROUTE_MANAGER','MRP_GOVERNANCE','SELLING_SCHEME_POLICIES','COMMERCIAL_SALES_ASSUMPTIONS','QC_ACTION_QUEUE','MATERIALS_STORES_ACTION_QUEUE','DRIVER_GOVERNANCE','REGIONAL_MARKETING_REVIEW'];
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_period_start is null then raise exception 'Costing period start is required for LIVE_AS_OF'; end if;
 if p_population_scope is null or p_population_scope not in ('OPERATIONAL','ALL_EXISTING') then raise exception 'Invalid population scope'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_sku_id<0 then raise exception 'Invalid pagination'; end if;
 if length(v_search)>120 then raise exception 'Search too long'; end if;
 for i in 1..4 loop
  v_values:=case i when 1 then p_overall_severities when 2 then p_dependency_codes when 3 then p_owner_modules else p_route_codes end;
  v_allowed:=case i when 1 then array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'] when 2 then v_dependency_options when 3 then v_owner_options else v_route_options end;
  v_normalized:=null;
  if coalesce(cardinality(v_values),0)>0 then
   if array_ndims(v_values)<>1 or cardinality(v_values)>32 then raise exception 'Invalid filter cardinality'; end if;
   if exists(select 1 from unnest(v_values) x(value) where value is null or btrim(value)='' or not (btrim(value)=any(v_allowed))) then raise exception 'Unsupported filter value'; end if;
   select array_agg(value order by value) into v_normalized from (select distinct btrim(value) as value from unnest(v_values) x(value)) n;
  end if;
  if i=1 then v_severities:=v_normalized; elsif i=2 then v_codes:=v_normalized; elsif i=3 then v_owners:=v_normalized; else v_routes:=v_normalized; end if;
 end loop;
 v_period:=date_trunc('month',p_period_start::timestamp)::date;
 select valuation_date into v_val from costing.cost_periods where period_start=v_period;
 if v_val is null then raise exception 'Governed valuation date is missing for period %',v_period; end if;
 select id into v_run from costing.costing_refresh_run where period_start=v_period and valuation_date=v_val and overall_status='SUCCESS'
 order by finished_at desc nulls last,id desc limit 1;
 -- Exactly one route function evaluation; do not fabricate absent Product rows.
 with route_rows as materialized (select * from costing.fn_product_process_route_readiness(v_val))
 select count(*),count(distinct product_id),jsonb_object_agg(product_id::text,to_jsonb(r))
 into v_route_count,v_route_distinct,v_route_map from route_rows r;
 if v_route_count<>v_route_distinct then raise exception 'Nonunique route evidence'; end if;
 if v_run is not null then v_shared:=costing.fn_product_sku_readiness_shared_issues(v_val); end if;
 -- Materialized once before any filters/counts/page; no N calls to public canonical RPC.
 with assessed as materialized (
  select s.id as sku_id,s.product_id,
   costing.fn_product_sku_readiness_live_core(s.id,v_period,v_val,v_run,v_route_map->(s.product_id::text),v_shared) as assessment
  from public.product_skus s join public.products p on p.id=s.product_id
  where p_population_scope='ALL_EXISTING' or (p.status='Active' and s.is_active and not coalesce(s.is_sample,false))
 ) select coalesce(jsonb_agg(to_jsonb(a) order by sku_id),'[]'::jsonb) into v_rows from assessed a;
 if exists(select 1 from jsonb_array_elements(v_rows) x(row) where
  row#>>'{assessment,context,context_type}' is distinct from 'LIVE_AS_OF'
  or row#>>'{assessment,context,sku_id}' is distinct from row->>'sku_id'
  or row#>>'{assessment,context,product_id}' is distinct from row->>'product_id'
  or row#>>'{assessment,context,period_start}' is distinct from v_period::text
  or row#>>'{assessment,context,valuation_date}' is distinct from v_val::text
  or row#>'{assessment,context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and row#>>'{assessment,context,evidence_refresh_run_id}' is distinct from v_run::text)
  or row#>>'{assessment,summary,overall_severity}' is null
  or row#>>'{assessment,summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')) then
  raise exception 'Canonical assessment context or severity mismatch';
 end if;
 with r as materialized (
  select (row->>'sku_id')::bigint as sku_id,(row->>'product_id')::bigint as product_id,row->'assessment' as assessment,
   row#>>'{assessment,identity,product_name}' as product_name,row#>>'{assessment,summary,overall_severity}' as severity
  from jsonb_array_elements(v_rows) x(row)
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select count(*) from r),
   'overall_severity_counts',jsonb_build_object('READY',(select count(*) from r where severity='READY'),'REVIEW_REQUIRED',(select count(*) from r where severity='REVIEW_REQUIRED'),'BLOCKER',(select count(*) from r where severity='BLOCKER'),'UNKNOWN',(select count(*) from r where severity='UNKNOWN')),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end)
 into v_result;
 return v_result;
end $function$;

-- Atomic ACL closure: no committed default PUBLIC execute interval.
ALTER FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_readiness_governed_periods(date,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_readiness_governed_periods(date,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_readiness_governed_periods(date,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) TO authenticated;
DO $guard$
BEGIN
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Existing ACL changed'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Existing ACL changed'; END IF;
 IF has_function_privilege('anon','costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','public.rpc_get_readiness_governed_periods(date,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('authenticated','costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Internal helper exposed'; END IF;
 IF has_function_privilege('authenticated','costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Internal helper exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=costing, public, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=costing, public, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_governed_periods(date,integer)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.rpc_get_readiness_governed_periods(date,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public reader grant missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public reader grant missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public reader grant missing'; END IF;
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
DO $capture$
DECLARE baseline jsonb;
BEGIN
 baseline:=jsonb_build_object(
 'live1',public.rpc_get_product_sku_readiness(1,'2026-09-01','LIVE_AS_OF',null),
 'live11',public.rpc_get_product_sku_readiness(11,'2026-09-01','LIVE_AS_OF',null),
 'live1795',public.rpc_get_product_sku_readiness(1795,'2026-09-01','LIVE_AS_OF',null),
 'exact114',public.rpc_get_product_sku_readiness(11,'2026-09-01','EXACT_RUN',114),
 'exact115',public.rpc_get_product_sku_readiness(11,'2026-09-01','EXACT_RUN',115));
 IF baseline IS DISTINCT FROM current_setting('wp04.ab_original')::jsonb THEN RAISE EXCEPTION 'Full canonical JSON parity failed: old_candidate'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_skus WHERE id=-1) THEN RAISE EXCEPTION 'Missing-SKU test identity now exists'; END IF;
 BEGIN
  PERFORM public.rpc_get_product_sku_readiness(-1,'2026-09-01','LIVE_AS_OF',null);
  RAISE EXCEPTION 'Missing SKU unexpectedly returned';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'SKU -1 not found' THEN RAISE; END IF;
 END;
 PERFORM set_config('wp04.ab_old_candidate',baseline::text,true);
END $capture$;
DO $aggregation$
DECLARE baseline jsonb:=current_setting('wp04.ab_old_candidate')::jsonb;
 v_period date:='2026-09-01'; v_val date:='2026-09-10'; v_run bigint:=115;
 p_period_start date:='2026-09-01'; p_population_scope text:='ALL_EXISTING'; p_after_sku_id bigint; p_limit integer:=1;
 v_severities text[]; v_codes text[]; v_owners text[]; v_routes text[]; v_search text;
 v_dependency_options text[]:=ARRAY['PRODUCT_MASTER']; v_owner_options text[]:=ARRAY['MANAGE_PRODUCTS']; v_route_options text[]:=ARRAY['MANAGE_PRODUCTS'];
 v_rows jsonb; v_saved jsonb; v_result jsonb; v_context_invalid boolean; results jsonb:='[]'; case_id integer; refused boolean;
BEGIN
 v_saved:=jsonb_build_array(jsonb_build_object('sku_id',1,'product_id',1,'assessment',baseline->'live1'),jsonb_build_object('sku_id',11,'product_id',14,'assessment',baseline->'live11'),jsonb_build_object('sku_id',1795,'product_id',794,'assessment',baseline->'live1795'));
 FOR case_id IN 1..6 LOOP
  v_rows:=v_saved; p_after_sku_id:=null; v_severities:=null; v_codes:=null; v_owners:=null; v_routes:=null;
  IF case_id=2 THEN p_after_sku_id:=1795; END IF;
  IF case_id=3 THEN v_codes:=ARRAY['PRODUCT_MASTER']; v_owners:=ARRAY['MANAGE_PRODUCTS']; v_routes:=ARRAY['MANAGE_PRODUCTS']; END IF;
  IF case_id=4 THEN v_codes:=ARRAY['PRODUCT_MASTER']; v_owners:=ARRAY['COSTING_CONTROL_CENTER']; END IF;
  IF case_id=5 THEN v_severities:=ARRAY['READY']; END IF;
  IF case_id=6 THEN v_rows:='[]'; END IF;
 if exists(select 1 from jsonb_array_elements(v_rows) x(row) where
  row#>>'{assessment,context,context_type}' is distinct from 'LIVE_AS_OF'
  or row#>>'{assessment,context,sku_id}' is distinct from row->>'sku_id'
  or row#>>'{assessment,context,product_id}' is distinct from row->>'product_id'
  or row#>>'{assessment,context,period_start}' is distinct from v_period::text
  or row#>>'{assessment,context,valuation_date}' is distinct from v_val::text
  or row#>'{assessment,context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and row#>>'{assessment,context,evidence_refresh_run_id}' is distinct from v_run::text)
  or row#>>'{assessment,summary,overall_severity}' is null
  or row#>>'{assessment,summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')) then
  raise exception 'Canonical assessment context or severity mismatch';
 end if;
 with r as materialized (
  select (row->>'sku_id')::bigint as sku_id,(row->>'product_id')::bigint as product_id,row->'assessment' as assessment,
   row#>>'{assessment,identity,product_name}' as product_name,row#>>'{assessment,summary,overall_severity}' as severity
  from jsonb_array_elements(v_rows) x(row)
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select count(*) from r),
   'overall_severity_counts',jsonb_build_object('READY',(select count(*) from r where severity='READY'),'REVIEW_REQUIRED',(select count(*) from r where severity='REVIEW_REQUIRED'),'BLOCKER',(select count(*) from r where severity='BLOCKER'),'UNKNOWN',(select count(*) from r where severity='UNKNOWN')),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end)
 into v_result;
  IF case_id=1 AND ((v_result#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM 3 OR (v_result->>'matched_count')::bigint IS DISTINCT FROM 3 OR (v_result->>'returned_count')::bigint IS DISTINCT FROM 1 OR (v_result->>'has_more')::boolean IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Unfiltered bounded census mismatch'; END IF;
  IF case_id=2 AND ((v_result->>'returned_count')::bigint IS DISTINCT FROM 0 OR (v_result->>'matched_count')::bigint IS DISTINCT FROM 3) THEN RAISE EXCEPTION 'Empty cursor census mismatch'; END IF;
  IF case_id=4 AND (v_result->>'matched_count')::bigint IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Combined incidence filter mismatch'; END IF;
  IF case_id=6 AND ((v_result#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM 0 OR (v_result->>'rows') IS DISTINCT FROM '[]'::jsonb) THEN RAISE EXCEPTION 'Empty population mismatch'; END IF;
  IF jsonb_typeof(v_result->'observed_at') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Missing observation timestamp'; END IF;
  -- Natural observation time is not a business parity field; compare every other envelope field.
  results:=results||jsonb_build_array(v_result-'observed_at');
 END LOOP;
 -- JSON-only invalid context, paired with an empty cursor page: must still refuse.
 v_rows:=jsonb_set(v_saved,'{0,assessment,context,period_start}','"1999-01-01"'::jsonb);
 p_after_sku_id:=1795; v_severities:=null; v_codes:=null; v_owners:=null; v_routes:=null;
 refused:=false;
 BEGIN
 if exists(select 1 from jsonb_array_elements(v_rows) x(row) where
  row#>>'{assessment,context,context_type}' is distinct from 'LIVE_AS_OF'
  or row#>>'{assessment,context,sku_id}' is distinct from row->>'sku_id'
  or row#>>'{assessment,context,product_id}' is distinct from row->>'product_id'
  or row#>>'{assessment,context,period_start}' is distinct from v_period::text
  or row#>>'{assessment,context,valuation_date}' is distinct from v_val::text
  or row#>'{assessment,context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and row#>>'{assessment,context,evidence_refresh_run_id}' is distinct from v_run::text)
  or row#>>'{assessment,summary,overall_severity}' is null
  or row#>>'{assessment,summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')) then
  raise exception 'Canonical assessment context or severity mismatch';
 end if;
 with r as materialized (
  select (row->>'sku_id')::bigint as sku_id,(row->>'product_id')::bigint as product_id,row->'assessment' as assessment,
   row#>>'{assessment,identity,product_name}' as product_name,row#>>'{assessment,summary,overall_severity}' as severity
  from jsonb_array_elements(v_rows) x(row)
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select count(*) from r),
   'overall_severity_counts',jsonb_build_object('READY',(select count(*) from r where severity='READY'),'REVIEW_REQUIRED',(select count(*) from r where severity='REVIEW_REQUIRED'),'BLOCKER',(select count(*) from r where severity='BLOCKER'),'UNKNOWN',(select count(*) from r where severity='UNKNOWN')),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end)
 into v_result;
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Canonical assessment context or severity mismatch' THEN refused:=true; ELSE RAISE; END IF;
 END;
 IF NOT refused THEN RAISE EXCEPTION 'Invalid context escaped on empty cursor page'; END IF;
 PERFORM set_config('wp04.ab_aggregate_old',results::text,true);
END $aggregation$;

-- Restore historical candidate before source-guarded corrected package.
-- UNAPPLIED HIGH-RISK REVIEW DRAFT. This file is traceability, NOT authorization.
-- Apply only via a separately approved direct server operation bound to the reviewed target/package.
-- Do not execute or rehearse on production from this planning gate.
-- Exact revert of this package only; reject mismatched/missing candidate definitions.
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
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
DO $events$
BEGIN
 IF (SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D') IS DISTINCT FROM '4e2c16f8333e51161dc11c5376fb3296' THEN RAISE EXCEPTION 'Reviewed DDL event-trigger state drifted'; END IF;
END $events$;

-- Exact A/B corrected package.
-- UNAPPLIED A/B CORRECTION REVIEW DRAFT. NO DEPLOYMENT AUTHORIZATION. This file is traceability, NOT authorization.
-- Apply only via a separately approved direct server operation bound to the reviewed target/package.
-- Do not execute or rehearse on production from this planning gate.
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
-- UNAPPLIED REVIEW DRAFT: extracted canonical authority, not a second evaluator.
CREATE FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(p_base jsonb, p_sku_id bigint, p_period_start date, p_valuation_date date, p_refresh_run_id bigint, p_shared_issues jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare e jsonb; deps jsonb; ev text; sev text; ctx jsonb; scheme_status text; regional_status text; shared jsonb;
begin
 e:=costing.fn_product_sku_readiness_run_evidence(p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id);
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
end $function$
;
CREATE OR REPLACE FUNCTION costing.fn_product_sku_readiness_enrich(p_base jsonb,p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
begin
 return costing.fn_product_sku_readiness_enrich_with_shared(p_base,p_sku_id,p_period_start,p_valuation_date,p_refresh_run_id,costing.fn_product_sku_readiness_shared_issues(p_valuation_date));
end $function$;

CREATE FUNCTION costing.fn_product_sku_readiness_live_core(
 p_sku_id bigint,p_period_start date,p_valuation_date date,p_evidence_run_id bigint,
 p_route_evidence jsonb,p_shared_issues jsonb)
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
 if v_run is not null then return costing.fn_product_sku_readiness_enrich_with_shared(v_base,p_sku_id,v_period,v_val,v_run,p_shared_issues); end if;
 return v_base;
end $function$
;
CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text DEFAULT 'LIVE_AS_OF'::text, p_refresh_run_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare
 v_context_type text:=upper(coalesce(nullif(btrim(p_context_type),''),'LIVE_AS_OF'));
 v_period date; v_val date; v_run bigint; v_run_status text; v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_route_json jsonb; v_shared_json jsonb;
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

 if v_context_type='LIVE_AS_OF' then
  select to_jsonb(x) into v_route_json from costing.fn_product_process_route_readiness(v_val) x where x.product_id=v_sku.product_id limit 1;
  v_shared_json:='[]'::jsonb;
  if v_run is not null then v_shared_json:=costing.fn_product_sku_readiness_shared_issues(v_val); end if;
  return costing.fn_product_sku_readiness_live_core(p_sku_id,v_period,v_val,v_run,v_route_json,v_shared_json);
 end if;
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
end $function$
;

-- UNAPPLIED REVIEW DRAFT. No application permitted by file presence.
CREATE FUNCTION public.rpc_get_readiness_governed_periods(p_before_period_start date DEFAULT NULL,p_limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Invalid limit'; end if;
 with candidates as materialized (
  select period_start,valuation_date from costing.cost_periods
  where p_before_period_start is null or period_start<p_before_period_start
  order by period_start desc limit p_limit+1
 ), page as materialized (select * from candidates order by period_start desc limit p_limit)
 select jsonb_build_object('observed_at',statement_timestamp(),'before_period_start',p_before_period_start,'limit',p_limit,
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by period_start desc) from page p),'[]'::jsonb),
  'returned_count',(select count(*) from page),'has_more',(select count(*)>p_limit from candidates),
  'next_before_period_start',case when (select count(*)>p_limit from candidates) then (select min(period_start) from page) end)
 into result;
 return result;
end $function$;

CREATE FUNCTION public.rpc_get_readiness_product_gaps(p_product_scope text DEFAULT 'ACTIVE_PRODUCTS',p_gap_kind text DEFAULT 'NO_SKU',p_search text DEFAULT NULL,p_after_product_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare result jsonb; v_search text:=nullif(btrim(p_search),'');
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_product_scope is null or p_product_scope not in ('ACTIVE_PRODUCTS','ALL_PRODUCTS') then raise exception 'Invalid Product scope'; end if;
 if p_gap_kind is null or p_gap_kind not in ('NO_SKU','ACTIVE_WITHOUT_ACTIVE_SKU') then raise exception 'Invalid gap kind'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_product_id<0 then raise exception 'Invalid pagination'; end if;
 if length(v_search)>120 then raise exception 'Search too long'; end if;
 with membership as materialized (
  select p.id as product_id,p.item as product_name,p.status as product_status,
   not exists(select 1 from public.product_skus s where s.product_id=p.id) as no_sku,
   p.status='Active' and not exists(select 1 from public.product_skus s where s.product_id=p.id and s.is_active) as active_without_active_sku
  from public.products p where p_product_scope='ALL_PRODUCTS' or p.status='Active'
 ), matched as materialized (
  select * from membership where (case p_gap_kind when 'NO_SKU' then no_sku else active_without_active_sku end)
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=product_id::text)
 ), candidates as materialized (
  select * from matched where p_after_product_id is null or product_id>p_after_product_id order by product_id limit p_limit+1
 ), page as materialized (select * from candidates order by product_id limit p_limit)
 select jsonb_build_object('assessment_kind','PRODUCT_MEMBERSHIP_GAPS','observed_at',statement_timestamp(),
  'product_scope',p_product_scope,'gap_kind',p_gap_kind,'search',v_search,'after_product_id',p_after_product_id,'limit',p_limit,
  'statistics',jsonb_build_object('product_count',(select count(*) from membership),'no_sku_count',(select count(*) from membership where no_sku),
    'active_without_active_sku_count',(select count(*) from membership where active_without_active_sku)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'product_status',product_status,'gap_kind',p_gap_kind) order by product_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_product_id',case when (select count(*)>p_limit from candidates) then (select max(product_id) from page) end)
 into result;
 return result;
end $function$;

CREATE FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 p_period_start date,p_population_scope text DEFAULT 'OPERATIONAL',p_overall_severities text[] DEFAULT NULL,
 p_dependency_codes text[] DEFAULT NULL,p_owner_modules text[] DEFAULT NULL,p_route_codes text[] DEFAULT NULL,
 p_search text DEFAULT NULL,p_after_sku_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,costing,pg_temp AS $function$
declare
 v_period date; v_val date; v_run bigint; v_route_map jsonb; v_route_count bigint; v_route_distinct bigint;
 v_shared jsonb:='[]'::jsonb; v_result jsonb; v_context_invalid boolean; v_search text:=nullif(btrim(p_search),'');
 v_values text[]; v_allowed text[]; v_normalized text[]; i integer;
 v_severities text[]; v_codes text[]; v_owners text[]; v_routes text[];
 v_dependency_options constant text[]:=array['PRODUCT_MASTER','SKU_MASTER','PM_BOM_REVISION','BATCH_SIZE_REFERENCE','MANUFACTURING_ROUTE','MRP_POLICY','SELLING_PRICE_POLICY','COMMON_COMMERCIAL_BASIS','DIRECT_LABOUR','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD','MATERIALS_STORES_OVERHEAD','ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD','MARKETING_EXPENSE','SELECTED_SCHEME_POLICY','REGIONAL_MARKETING_EVIDENCE'];
 v_owner_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','SUPPLY_BATCH_PLAN','PRODUCTION_ROUTE_MANAGER','PRICING_POLICY_MANAGER','COST_SHEET_REVIEW','COST_BUILD_MANAGER','COSTING_CONTROL_CENTER'];
 v_route_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','BATCH_SIZES','PRODUCTION_ROUTE_MANAGER','MRP_GOVERNANCE','SELLING_SCHEME_POLICIES','COMMERCIAL_SALES_ASSUMPTIONS','QC_ACTION_QUEUE','MATERIALS_STORES_ACTION_QUEUE','DRIVER_GOVERNANCE','REGIONAL_MARKETING_REVIEW'];
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not public.app_has_permission('module:costing-control-center','view') then raise exception 'Permission denied'; end if;
 if p_period_start is null then raise exception 'Costing period start is required for LIVE_AS_OF'; end if;
 if p_population_scope is null or p_population_scope not in ('OPERATIONAL','ALL_EXISTING') then raise exception 'Invalid population scope'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_after_sku_id<0 then raise exception 'Invalid pagination'; end if;
 if length(v_search)>120 then raise exception 'Search too long'; end if;
 for i in 1..4 loop
  v_values:=case i when 1 then p_overall_severities when 2 then p_dependency_codes when 3 then p_owner_modules else p_route_codes end;
  v_allowed:=case i when 1 then array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'] when 2 then v_dependency_options when 3 then v_owner_options else v_route_options end;
  v_normalized:=null;
  if coalesce(cardinality(v_values),0)>0 then
   if array_ndims(v_values)<>1 or cardinality(v_values)>32 then raise exception 'Invalid filter cardinality'; end if;
   if exists(select 1 from unnest(v_values) x(value) where value is null or btrim(value)='' or not (btrim(value)=any(v_allowed))) then raise exception 'Unsupported filter value'; end if;
   select array_agg(value order by value) into v_normalized from (select distinct btrim(value) as value from unnest(v_values) x(value)) n;
  end if;
  if i=1 then v_severities:=v_normalized; elsif i=2 then v_codes:=v_normalized; elsif i=3 then v_owners:=v_normalized; else v_routes:=v_normalized; end if;
 end loop;
 v_period:=date_trunc('month',p_period_start::timestamp)::date;
 select valuation_date into v_val from costing.cost_periods where period_start=v_period;
 if v_val is null then raise exception 'Governed valuation date is missing for period %',v_period; end if;
 select id into v_run from costing.costing_refresh_run where period_start=v_period and valuation_date=v_val and overall_status='SUCCESS'
 order by finished_at desc nulls last,id desc limit 1;
 -- Exactly one route function evaluation; do not fabricate absent Product rows.
 with route_rows as materialized (select * from costing.fn_product_process_route_readiness(v_val))
 select count(*),count(distinct product_id),jsonb_object_agg(product_id::text,to_jsonb(r))
 into v_route_count,v_route_distinct,v_route_map from route_rows r;
 if v_route_count<>v_route_distinct then raise exception 'Nonunique route evidence'; end if;
 if v_run is not null then v_shared:=costing.fn_product_sku_readiness_shared_issues(v_val); end if;
 -- Materialized once before any filters/counts/page; no N calls to public canonical RPC.
 with assessed as materialized (
  select s.id as sku_id,s.product_id,
   costing.fn_product_sku_readiness_live_core(s.id,v_period,v_val,v_run,v_route_map->(s.product_id::text),v_shared) as assessment
  from public.product_skus s join public.products p on p.id=s.product_id
  where p_population_scope='ALL_EXISTING' or (p.status='Active' and s.is_active and not coalesce(s.is_sample,false))
 ), validation as materialized (
  select coalesce(bool_or(
  assessment#>>'{context,context_type}' is distinct from 'LIVE_AS_OF'
  or assessment#>>'{context,sku_id}' is distinct from sku_id::text
  or assessment#>>'{context,product_id}' is distinct from product_id::text
  or assessment#>>'{context,period_start}' is distinct from v_period::text
  or assessment#>>'{context,valuation_date}' is distinct from v_val::text
  or assessment#>'{context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and assessment#>>'{context,evidence_refresh_run_id}' is distinct from v_run::text)
  or assessment#>>'{summary,overall_severity}' is null
  or assessment#>>'{summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')),false) as invalid from assessed
 ), r as materialized (
  select sku_id,product_id,assessment,
   assessment#>>'{identity,product_name}' as product_name,
   assessment#>>'{summary,overall_severity}' as severity
  from assessed
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ), severity_counts as materialized (
  select count(*) as population_sku_count,
   count(*) filter(where severity='READY') as ready_count,
   count(*) filter(where severity='REVIEW_REQUIRED') as review_count,
   count(*) filter(where severity='BLOCKER') as blocker_count,
   count(*) filter(where severity='UNKNOWN') as unknown_count from r
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select population_sku_count from severity_counts),
   'overall_severity_counts',jsonb_build_object('READY',(select ready_count from severity_counts),'REVIEW_REQUIRED',(select review_count from severity_counts),'BLOCKER',(select blocker_count from severity_counts),'UNKNOWN',(select unknown_count from severity_counts)),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end),
 (select invalid from validation)
 into v_result,v_context_invalid;
 if v_context_invalid then raise exception 'Canonical assessment context or severity mismatch'; end if;
 return v_result;
end $function$;

-- Atomic ACL closure: no committed default PUBLIC execute interval.
ALTER FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_readiness_governed_periods(date,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_readiness_governed_periods(date,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_readiness_governed_periods(date,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer) TO authenticated;
DO $guard$
BEGIN
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Existing ACL changed'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Existing ACL changed'; END IF;
 IF has_function_privilege('anon','costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','public.rpc_get_readiness_governed_periods(date,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('anon','public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anon execute exposed'; END IF;
 IF has_function_privilege('authenticated','costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Internal helper exposed'; END IF;
 IF has_function_privilege('authenticated','costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Internal helper exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=costing, public, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=costing, public, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_governed_periods(date,integer)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.rpc_get_readiness_governed_periods(date,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public reader grant missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public reader grant missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)') AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND provolatile='s' AND prosecdef AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=public, costing, pg_temp']::text[]) THEN RAISE EXCEPTION 'Candidate function attributes mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public reader grant missing'; END IF;
END $guard$;
-- Exact reviewed identity, including the complete ACL set (order independent).
DO $identity$
DECLARE expected record; actual record; actual_acl text[];
BEGIN
 FOR expected IN SELECT * FROM (VALUES
  ('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','c24ce797c8e1a13cb8888eee12393aee',ARRAY['p_base','p_sku_id','p_period_start','p_valuation_date','p_refresh_run_id','p_shared_issues']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false']::text[]),
  ('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)','c1f37b9477f239cf87c44901ecd3ca6e',ARRAY['p_base','p_sku_id','p_period_start','p_valuation_date','p_refresh_run_id']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false','service_role:postgres:EXECUTE:false']::text[]),
  ('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','b79c5e8476aa3c645cf6c1083909beb6',ARRAY['p_sku_id','p_period_start','p_valuation_date','p_evidence_run_id','p_route_evidence','p_shared_issues']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)','7c54b0edc159d08647e8df73d51fbe51',ARRAY['p_sku_id','p_period_start','p_context_type','p_refresh_run_id']::text[],'''LIVE_AS_OF''::text, NULL::bigint',2,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false','service_role:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_readiness_governed_periods(date,integer)','671e150396f388875735e68818dcb574',ARRAY['p_before_period_start','p_limit']::text[],'NULL::date, 24',2,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','4ae66ab181270cfd41e16d2969d20d58',ARRAY['p_product_scope','p_gap_kind','p_search','p_after_product_id','p_limit']::text[],'''ACTIVE_PRODUCTS''::text, ''NO_SKU''::text, NULL::text, NULL::bigint, 50',5,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','f34055346694c45900af9f16b0fea1d5',ARRAY['p_period_start','p_population_scope','p_overall_severities','p_dependency_codes','p_owner_modules','p_route_codes','p_search','p_after_sku_id','p_limit']::text[],'''OPERATIONAL''::text, NULL::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text, NULL::bigint, 50',8,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[])
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
DO $capture$
DECLARE baseline jsonb;
BEGIN
 baseline:=jsonb_build_object(
 'live1',public.rpc_get_product_sku_readiness(1,'2026-09-01','LIVE_AS_OF',null),
 'live11',public.rpc_get_product_sku_readiness(11,'2026-09-01','LIVE_AS_OF',null),
 'live1795',public.rpc_get_product_sku_readiness(1795,'2026-09-01','LIVE_AS_OF',null),
 'exact114',public.rpc_get_product_sku_readiness(11,'2026-09-01','EXACT_RUN',114),
 'exact115',public.rpc_get_product_sku_readiness(11,'2026-09-01','EXACT_RUN',115));
 IF baseline IS DISTINCT FROM current_setting('wp04.ab_original')::jsonb THEN RAISE EXCEPTION 'Full canonical JSON parity failed: corrected'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_skus WHERE id=-1) THEN RAISE EXCEPTION 'Missing-SKU test identity now exists'; END IF;
 BEGIN
  PERFORM public.rpc_get_product_sku_readiness(-1,'2026-09-01','LIVE_AS_OF',null);
  RAISE EXCEPTION 'Missing SKU unexpectedly returned';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'SKU -1 not found' THEN RAISE; END IF;
 END;
 PERFORM set_config('wp04.ab_corrected',baseline::text,true);
END $capture$;
DO $aggregation$
DECLARE baseline jsonb:=current_setting('wp04.ab_corrected')::jsonb;
 v_period date:='2026-09-01'; v_val date:='2026-09-10'; v_run bigint:=115;
 p_period_start date:='2026-09-01'; p_population_scope text:='ALL_EXISTING'; p_after_sku_id bigint; p_limit integer:=1;
 v_severities text[]; v_codes text[]; v_owners text[]; v_routes text[]; v_search text;
 v_dependency_options text[]:=ARRAY['PRODUCT_MASTER']; v_owner_options text[]:=ARRAY['MANAGE_PRODUCTS']; v_route_options text[]:=ARRAY['MANAGE_PRODUCTS'];
 v_rows jsonb; v_saved jsonb; v_result jsonb; v_context_invalid boolean; results jsonb:='[]'; case_id integer; refused boolean;
BEGIN
 v_saved:=jsonb_build_array(jsonb_build_object('sku_id',1,'product_id',1,'assessment',baseline->'live1'),jsonb_build_object('sku_id',11,'product_id',14,'assessment',baseline->'live11'),jsonb_build_object('sku_id',1795,'product_id',794,'assessment',baseline->'live1795'));
 FOR case_id IN 1..6 LOOP
  v_rows:=v_saved; p_after_sku_id:=null; v_severities:=null; v_codes:=null; v_owners:=null; v_routes:=null;
  IF case_id=2 THEN p_after_sku_id:=1795; END IF;
  IF case_id=3 THEN v_codes:=ARRAY['PRODUCT_MASTER']; v_owners:=ARRAY['MANAGE_PRODUCTS']; v_routes:=ARRAY['MANAGE_PRODUCTS']; END IF;
  IF case_id=4 THEN v_codes:=ARRAY['PRODUCT_MASTER']; v_owners:=ARRAY['COSTING_CONTROL_CENTER']; END IF;
  IF case_id=5 THEN v_severities:=ARRAY['READY']; END IF;
  IF case_id=6 THEN v_rows:='[]'; END IF;
 with assessed as materialized (
  select (row->>'sku_id')::bigint as sku_id,(row->>'product_id')::bigint as product_id,
   row->'assessment' as assessment from jsonb_array_elements(v_rows) x(row)
 ), validation as materialized (
  select coalesce(bool_or(
  assessment#>>'{context,context_type}' is distinct from 'LIVE_AS_OF'
  or assessment#>>'{context,sku_id}' is distinct from sku_id::text
  or assessment#>>'{context,product_id}' is distinct from product_id::text
  or assessment#>>'{context,period_start}' is distinct from v_period::text
  or assessment#>>'{context,valuation_date}' is distinct from v_val::text
  or assessment#>'{context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and assessment#>>'{context,evidence_refresh_run_id}' is distinct from v_run::text)
  or assessment#>>'{summary,overall_severity}' is null
  or assessment#>>'{summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')),false) as invalid from assessed
 ), r as materialized (
  select sku_id,product_id,assessment,
   assessment#>>'{identity,product_name}' as product_name,
   assessment#>>'{summary,overall_severity}' as severity
  from assessed
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ), severity_counts as materialized (
  select count(*) as population_sku_count,
   count(*) filter(where severity='READY') as ready_count,
   count(*) filter(where severity='REVIEW_REQUIRED') as review_count,
   count(*) filter(where severity='BLOCKER') as blocker_count,
   count(*) filter(where severity='UNKNOWN') as unknown_count from r
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select population_sku_count from severity_counts),
   'overall_severity_counts',jsonb_build_object('READY',(select ready_count from severity_counts),'REVIEW_REQUIRED',(select review_count from severity_counts),'BLOCKER',(select blocker_count from severity_counts),'UNKNOWN',(select unknown_count from severity_counts)),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end),
 (select invalid from validation)
 into v_result,v_context_invalid;
 if v_context_invalid then raise exception 'Canonical assessment context or severity mismatch'; end if;
  IF case_id=1 AND ((v_result#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM 3 OR (v_result->>'matched_count')::bigint IS DISTINCT FROM 3 OR (v_result->>'returned_count')::bigint IS DISTINCT FROM 1 OR (v_result->>'has_more')::boolean IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Unfiltered bounded census mismatch'; END IF;
  IF case_id=2 AND ((v_result->>'returned_count')::bigint IS DISTINCT FROM 0 OR (v_result->>'matched_count')::bigint IS DISTINCT FROM 3) THEN RAISE EXCEPTION 'Empty cursor census mismatch'; END IF;
  IF case_id=4 AND (v_result->>'matched_count')::bigint IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Combined incidence filter mismatch'; END IF;
  IF case_id=6 AND ((v_result#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM 0 OR (v_result->>'rows') IS DISTINCT FROM '[]'::jsonb) THEN RAISE EXCEPTION 'Empty population mismatch'; END IF;
  IF jsonb_typeof(v_result->'observed_at') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Missing observation timestamp'; END IF;
  -- Natural observation time is not a business parity field; compare every other envelope field.
  results:=results||jsonb_build_array(v_result-'observed_at');
 END LOOP;
 -- JSON-only invalid context, paired with an empty cursor page: must still refuse.
 v_rows:=jsonb_set(v_saved,'{0,assessment,context,period_start}','"1999-01-01"'::jsonb);
 p_after_sku_id:=1795; v_severities:=null; v_codes:=null; v_owners:=null; v_routes:=null;
 refused:=false;
 BEGIN
 with assessed as materialized (
  select (row->>'sku_id')::bigint as sku_id,(row->>'product_id')::bigint as product_id,
   row->'assessment' as assessment from jsonb_array_elements(v_rows) x(row)
 ), validation as materialized (
  select coalesce(bool_or(
  assessment#>>'{context,context_type}' is distinct from 'LIVE_AS_OF'
  or assessment#>>'{context,sku_id}' is distinct from sku_id::text
  or assessment#>>'{context,product_id}' is distinct from product_id::text
  or assessment#>>'{context,period_start}' is distinct from v_period::text
  or assessment#>>'{context,valuation_date}' is distinct from v_val::text
  or assessment#>'{context,refresh_run_id}' is distinct from 'null'::jsonb
  or (v_run is not null and assessment#>>'{context,evidence_refresh_run_id}' is distinct from v_run::text)
  or assessment#>>'{summary,overall_severity}' is null
  or assessment#>>'{summary,overall_severity}' not in ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')),false) as invalid from assessed
 ), r as materialized (
  select sku_id,product_id,assessment,
   assessment#>>'{identity,product_name}' as product_name,
   assessment#>>'{summary,overall_severity}' as severity
  from assessed
 ), incidences as materialized (
  select r.sku_id,'DEPENDENCY'::text as incidence_kind,d->>'dependency_code' as dependency_code,
   null::text as issue_code,d->>'owner_module' as owner_module,d->>'recommended_ui_route' as route_code,
   null::jsonb as shared_issue
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  where d->>'applicability'<>'NOT_REQUIRED' and coalesce(d->>'effective_status',d->>'raw_status') in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
  union all
  select r.sku_id,'SHARED',d->>'dependency_code',d->>'issue_code',d->>'owner_module',d->>'recommended_ui_route',d
  from r cross join lateral jsonb_array_elements(r.assessment->'shared_issues') x(d)
  where d->>'status' in ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
 ), matched as materialized (
  select * from r where (v_severities is null or severity=any(v_severities))
   and (v_search is null or strpos(lower(coalesce(product_name,'')),lower(v_search))>0 or v_search=sku_id::text or v_search=product_id::text)
   and ((v_codes is null and v_owners is null and v_routes is null) or exists (
    select 1 from incidences d where d.sku_id=r.sku_id
     and (v_codes is null or d.dependency_code=any(v_codes))
     and (v_owners is null or d.owner_module=any(v_owners))
     and (v_routes is null or d.route_code=any(v_routes))))
 ), candidates as materialized (
  select * from matched where p_after_sku_id is null or sku_id>p_after_sku_id order by sku_id limit p_limit+1
 ), page as materialized (select * from candidates order by sku_id limit p_limit),
 dependency_counts as (select dependency_code,count(distinct sku_id) as affected_sku_count from incidences where dependency_code is not null group by dependency_code),
 owner_counts as (select owner_module,count(distinct sku_id) as affected_sku_count from incidences where owner_module is not null group by owner_module),
 route_counts as (select route_code,count(distinct sku_id) as affected_sku_count from incidences where route_code is not null group by route_code),
 shared_counts as (
  select shared_issue as issue,count(distinct sku_id) as affected_sku_count,
   array_agg(distinct sku_id order by sku_id) as affected_sku_ids
  from incidences where incidence_kind='SHARED' group by shared_issue
 ), severity_counts as materialized (
  select count(*) as population_sku_count,
   count(*) filter(where severity='READY') as ready_count,
   count(*) filter(where severity='REVIEW_REQUIRED') as review_count,
   count(*) filter(where severity='BLOCKER') as blocker_count,
   count(*) filter(where severity='UNKNOWN') as unknown_count from r
 ),
 regional as (
  select distinct r.sku_id,e->>'region_code' as region_code,e->>'raw_status' as raw_status,e->>'effective_status' as effective_status
  from r cross join lateral jsonb_array_elements(r.assessment->'dependencies') x(d)
  cross join lateral jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
  where d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE'
 ), regional_counts as (select region_code,raw_status,effective_status,count(*) as sku_region_count from regional group by region_code,raw_status,effective_status)
 select jsonb_build_object(
  'context',jsonb_build_object('context_type','LIVE_AS_OF','requested_period_start',p_period_start,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run,'context_integrity_status','LIVE_GOVERNED_PERIOD'),
  'observed_at',statement_timestamp(),'population_scope',p_population_scope,
  'filters',jsonb_build_object('overall_severities',v_severities,'dependency_codes',v_codes,'owner_modules',v_owners,'route_codes',v_routes,'search',v_search),
  'filter_options',jsonb_build_object('overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],'dependency_codes',v_dependency_options,'owner_modules',v_owner_options,'route_codes',v_route_options),
  'after_sku_id',p_after_sku_id,'limit',p_limit,
  'statistics',jsonb_build_object('population_sku_count',(select population_sku_count from severity_counts),
   'overall_severity_counts',jsonb_build_object('READY',(select ready_count from severity_counts),'REVIEW_REQUIRED',(select review_count from severity_counts),'BLOCKER',(select blocker_count from severity_counts),'UNKNOWN',(select unknown_count from severity_counts)),
   'unresolved_dependency_counts',coalesce((select jsonb_agg(to_jsonb(x) order by dependency_code) from dependency_counts x),'[]'::jsonb),
   'unresolved_owner_counts',coalesce((select jsonb_agg(to_jsonb(x) order by owner_module) from owner_counts x),'[]'::jsonb),
   'unresolved_route_counts',coalesce((select jsonb_agg(to_jsonb(x) order by route_code) from route_counts x),'[]'::jsonb),
   'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
   'unresolved_shared_issue_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'context',jsonb_build_object('context_type','LIVE_AS_OF','period_start',v_period,'valuation_date',v_val,'refresh_run_id',null,'evidence_refresh_run_id',v_run),
    'issue',issue,'affected_sku_count',affected_sku_count,'affected_sku_ids',affected_sku_ids) order by issue) from shared_counts),'[]'::jsonb),
   'regional_marketing_counts',coalesce((select jsonb_agg(to_jsonb(x) order by region_code,raw_status,effective_status) from regional_counts x),'[]'::jsonb)),
  'matched_count',(select count(*) from matched),'returned_count',(select count(*) from page),
  'rows',coalesce((select jsonb_agg(assessment order by sku_id) from page),'[]'::jsonb),
  'has_more',(select count(*)>p_limit from candidates),'next_after_sku_id',case when (select count(*)>p_limit from candidates) then (select max(sku_id) from page) end),
 (select invalid from validation)
 into v_result,v_context_invalid;
 if v_context_invalid then raise exception 'Canonical assessment context or severity mismatch'; end if;
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Canonical assessment context or severity mismatch' THEN refused:=true; ELSE RAISE; END IF;
 END;
 IF NOT refused THEN RAISE EXCEPTION 'Invalid context escaped on empty cursor page'; END IF;
 IF results IS DISTINCT FROM current_setting('wp04.ab_aggregate_old')::jsonb THEN RAISE EXCEPTION 'Bounded full-envelope orchestration parity failed'; END IF;
END $aggregation$;

-- Restore original live authority; outer transaction also ends in ROLLBACK.
-- UNAPPLIED A/B CORRECTION RESTORE DRAFT. NO EXECUTION AUTHORIZATION.
-- UNAPPLIED HIGH-RISK REVIEW DRAFT. This file is traceability, NOT authorization.
-- Apply only via a separately approved direct server operation bound to the reviewed target/package.
-- Do not execute or rehearse on production from this planning gate.
-- Exact revert of this package only; reject mismatched/missing candidate definitions.
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected rollback owner'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)')) IS DISTINCT FROM 'c24ce797c8e1a13cb8888eee12393aee' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM 'c1f37b9477f239cf87c44901ecd3ca6e' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)')) IS DISTINCT FROM 'b79c5e8476aa3c645cf6c1083909beb6' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '7c54b0edc159d08647e8df73d51fbe51' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_governed_periods(date,integer)')) IS DISTINCT FROM '671e150396f388875735e68818dcb574' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)')) IS DISTINCT FROM '4ae66ab181270cfd41e16d2969d20d58' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)')) IS DISTINCT FROM 'f34055346694c45900af9f16b0fea1d5' THEN RAISE EXCEPTION 'Rollback candidate missing/drifted'; END IF;
END $guard$;
-- Exact reviewed identity, including the complete ACL set (order independent).
DO $identity$
DECLARE expected record; actual record; actual_acl text[];
BEGIN
 FOR expected IN SELECT * FROM (VALUES
  ('costing.fn_product_sku_readiness_enrich_with_shared(jsonb,bigint,date,date,bigint,jsonb)','c24ce797c8e1a13cb8888eee12393aee',ARRAY['p_base','p_sku_id','p_period_start','p_valuation_date','p_refresh_run_id','p_shared_issues']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false']::text[]),
  ('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)','c1f37b9477f239cf87c44901ecd3ca6e',ARRAY['p_base','p_sku_id','p_period_start','p_valuation_date','p_refresh_run_id']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false','service_role:postgres:EXECUTE:false']::text[]),
  ('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)','b79c5e8476aa3c645cf6c1083909beb6',ARRAY['p_sku_id','p_period_start','p_valuation_date','p_evidence_run_id','p_route_evidence','p_shared_issues']::text[],NULL::text,0,'search_path=costing, public, pg_temp',ARRAY['postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)','7c54b0edc159d08647e8df73d51fbe51',ARRAY['p_sku_id','p_period_start','p_context_type','p_refresh_run_id']::text[],'''LIVE_AS_OF''::text, NULL::bigint',2,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false','service_role:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_readiness_governed_periods(date,integer)','671e150396f388875735e68818dcb574',ARRAY['p_before_period_start','p_limit']::text[],'NULL::date, 24',2,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_readiness_product_gaps(text,text,text,bigint,integer)','4ae66ab181270cfd41e16d2969d20d58',ARRAY['p_product_scope','p_gap_kind','p_search','p_after_product_id','p_limit']::text[],'''ACTIVE_PRODUCTS''::text, ''NO_SKU''::text, NULL::text, NULL::bigint, 50',5,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[]),
  ('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)','f34055346694c45900af9f16b0fea1d5',ARRAY['p_period_start','p_population_scope','p_overall_severities','p_dependency_codes','p_owner_modules','p_route_codes','p_search','p_after_sku_id','p_limit']::text[],'''OPERATIONAL''::text, NULL::text[], NULL::text[], NULL::text[], NULL::text[], NULL::text, NULL::bigint, 50',8,'search_path=public, costing, pg_temp',ARRAY['authenticated:postgres:EXECUTE:false','postgres:postgres:EXECUTE:false']::text[])
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
DO $guard$
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Unexpected apply owner'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=public, costing, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)') AND (proowner<>(SELECT oid FROM pg_roles WHERE rolname='postgres') OR provolatile<>'s' OR NOT prosecdef OR prorettype<>'jsonb'::regtype OR proconfig IS DISTINCT FROM ARRAY['search_path=costing, public, pg_temp']::text[])) THEN RAISE EXCEPTION 'Source function attributes drifted'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')))) IS DISTINCT FROM '0e966c3c1ab15d56420b234f5c2cef1f' THEN RAISE EXCEPTION 'Source definition drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('public.rpc_get_product_sku_readiness(bigint,date,text,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: public.rpc_get_product_sku_readiness(bigint,date,text,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')))) IS DISTINCT FROM '65b40f9ac648ee077641c84eaee18497' THEN RAISE EXCEPTION 'Source definition drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure('costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN RAISE EXCEPTION 'Source ACL drift: costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint)'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)')))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_shared_issues(date)')))) IS DISTINCT FROM '7467604a4929b59412181c3c7481e0e8' THEN RAISE EXCEPTION 'Evidence helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_product_process_route_readiness(date)')))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF (SELECT md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'Route/commercial helper drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_enrich_with_shared') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_enrich_with_shared'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='costing' AND q.proname='fn_product_sku_readiness_live_core') THEN RAISE EXCEPTION 'Candidate name collision: fn_product_sku_readiness_live_core'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_governed_periods') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_governed_periods'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_readiness_product_gaps') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_readiness_product_gaps'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc q JOIN pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname='rpc_get_product_sku_readiness_portfolio') THEN RAISE EXCEPTION 'Candidate name collision: rpc_get_product_sku_readiness_portfolio'; END IF;
END $guard$;
DO $events$
BEGIN
 IF (SELECT md5(coalesce(jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'tags',e.evttags,'enabled',e.evtenabled,'definition_md5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname),'[]'::jsonb)::text) FROM pg_event_trigger e WHERE e.evtenabled<>'D') IS DISTINCT FROM '4e2c16f8333e51161dc11c5376fb3296' THEN RAISE EXCEPTION 'Reviewed DDL event-trigger state drifted'; END IF;
END $events$;
SELECT jsonb_build_object('operation','WP04_AB_BOUNDED_CORRECTNESS','canonical_calls',18,'canonical_cases',5,'aggregation_cases',6,'invalid_context_cases',2,'scheme_literal_cases',5,'regional_literal_cases',5,'portfolio_invocations',0,'performance','NOT_PROVED','native_api','NOT_RUN','accepted_review_case','NOT_RUN_NOT_REQUIRED_IN_THIS_LIMITED_PROPOSAL','empty_regional_sample',CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(current_setting('wp04.ab_original')::jsonb#>'{live1795,dependencies}') d WHERE d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE' AND d->'evidence'='[]'::jsonb AND d->>'raw_status'='NOT_REQUIRED') THEN 'INCLUDED_FULL_JSON_PARITY' ELSE 'NOT_RUN' END,'restoration','IN_TRANSACTION_GUARDS_PASSED','full_G4','INCOMPLETE') AS bounded_result;
ROLLBACK;
