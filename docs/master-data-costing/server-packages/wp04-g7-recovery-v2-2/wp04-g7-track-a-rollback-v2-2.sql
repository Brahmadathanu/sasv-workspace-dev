-- WP04 G7 TRACK A V2.2 — ROLLBACK TO EXACT PRE-V2.2 STATE
-- PREPARED / REVIEW ONLY. DO NOT EXECUTE WITHOUT EXPLICIT/CONDITIONAL V2.2 ROLLBACK AUTHORIZATION.
-- Pre-V2.2 state = original public C portfolio RPC + installed V2.1 builder + V2 fingerprint + empty substrate.
-- Builder/fingerprint are unchanged by V2.2 and are therefore retained.
-- No DROP CASCADE.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness_portfolio(
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
 with population as materialized (
  select s.id as sku_id,s.product_id from public.product_skus s join public.products p on p.id=s.product_id
  where p_population_scope='ALL_EXISTING' or (p.status='Active' and s.is_active and not coalesce(s.is_sample,false))
 ), evidence as materialized (
  select e.* from costing.fn_wp04_c_run_cohort(
   case when v_run is not null then coalesce((select array_agg(sku_id order by sku_id) from population),'{}'::bigint[]) else '{}'::bigint[] end,
   v_period,v_val,v_run) e
 ), assessed as materialized (
  select s.sku_id,s.product_id,
   costing.fn_wp04_c_live_core(s.sku_id,v_period,v_val,v_run,v_route_map->(s.product_id::text),v_shared,e.evidence_envelope) as assessment
  from population s left join evidence e on e.sku_id=s.sku_id
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

ALTER FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) TO authenticated;

-- Remove only V2.2 build data. Child item/incidence rows follow explicit FK cascade.
DELETE FROM costing.product_sku_readiness_portfolio_build;

DO $guard$
BEGIN
  IF md5(pg_get_functiondef(to_regprocedure(
    'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
  ))) IS DISTINCT FROM '667267b109a25f4dec3bd7d34c1b2972' THEN
    RAISE EXCEPTION 'V2.2 rollback public RPC mismatch';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_build_readiness_portfolio(date)')))
     IS DISTINCT FROM 'd9831a37e97f496dfe9f61f436f65e49' THEN
    RAISE EXCEPTION 'V2.2 rollback builder mismatch';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_readiness_source_fingerprint(date)')))
     IS DISTINCT FROM '606ec132a26899ae5336ff273e032552' THEN
    RAISE EXCEPTION 'V2.2 rollback fingerprint mismatch';
  END IF;

  IF EXISTS(SELECT 1 FROM costing.product_sku_readiness_portfolio_build)
     OR EXISTS(SELECT 1 FROM costing.product_sku_readiness_portfolio_item)
     OR EXISTS(SELECT 1 FROM costing.product_sku_readiness_portfolio_incidence) THEN
    RAISE EXCEPTION 'V2.2 rollback build data remains';
  END IF;

  IF (SELECT count(*) FROM costing.readiness_portfolio_source_epoch)<>44
     OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'wp04_readiness_epoch_%')<>44 THEN
    RAISE EXCEPTION 'V2.2 rollback substrate mismatch';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'
  ))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'V2.2 rollback CSE-P01 drift';
  END IF;
END
$guard$;

COMMIT;
