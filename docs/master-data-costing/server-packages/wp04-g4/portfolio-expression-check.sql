BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s'; SET LOCAL request.jwt.claim.sub='dff17104-c02a-4bca-95b1-e8ddff46a9b6';
DO $check$

declare
 p_search text:=NULL;
 v_period date; v_val date; v_run bigint; v_route_map jsonb; v_route_count bigint; v_route_distinct bigint;
 v_shared jsonb:='[]'::jsonb; v_rows jsonb; v_result jsonb; v_search text:=nullif(btrim(p_search),'');
 v_values text[]; v_allowed text[]; v_normalized text[]; i integer;
 v_severities text[]; v_codes text[]; v_owners text[]; v_routes text[];
 v_dependency_options constant text[]:=array['PRODUCT_MASTER','SKU_MASTER','PM_BOM_REVISION','BATCH_SIZE_REFERENCE','MANUFACTURING_ROUTE','MRP_POLICY','SELLING_PRICE_POLICY','COMMON_COMMERCIAL_BASIS','DIRECT_LABOUR','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD','MATERIALS_STORES_OVERHEAD','ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD','MARKETING_EXPENSE','SELECTED_SCHEME_POLICY','REGIONAL_MARKETING_EVIDENCE'];
 v_owner_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','SUPPLY_BATCH_PLAN','PRODUCTION_ROUTE_MANAGER','PRICING_POLICY_MANAGER','COST_SHEET_REVIEW','COST_BUILD_MANAGER','COSTING_CONTROL_CENTER'];
 v_route_options constant text[]:=array['MANAGE_PRODUCTS','PM_BOM_MANAGER','BATCH_SIZES','PRODUCTION_ROUTE_MANAGER','MRP_GOVERNANCE','SELLING_SCHEME_POLICIES','COMMERCIAL_SALES_ASSUMPTIONS','QC_ACTION_QUEUE','MATERIALS_STORES_ACTION_QUEUE','DRIVER_GOVERNANCE','REGIONAL_MARKETING_REVIEW'];
 p_period_start date:='2026-09-01'; p_population_scope text:='ALL_EXISTING'; p_after_sku_id bigint:=NULL; p_limit integer:=1;
begin
 v_period:='2026-09-01'; v_val:='2026-09-10'; v_run:=115;
 IF NOT public.app_has_permission('module:costing-control-center','view') THEN RAISE EXCEPTION 'Existing permission absent'; END IF;
 WITH samples AS MATERIALIZED (SELECT s.id AS sku_id,s.product_id,public.rpc_get_product_sku_readiness(s.id,v_period,'LIVE_AS_OF',null) AS assessment FROM public.product_skus s WHERE s.id IN (11,1795)) SELECT jsonb_agg(to_jsonb(samples) ORDER BY sku_id) INTO v_rows FROM samples;
 IF jsonb_array_length(v_rows)<>2 THEN RAISE EXCEPTION 'Sample membership drift'; END IF;
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

 IF (v_result#>>'{statistics,population_sku_count}')::integer<>2 OR (v_result->>'matched_count')::integer<>2 OR (v_result->>'returned_count')::integer<>1 OR (v_result->>'has_more')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Sample counts mismatch'; END IF;
 PERFORM set_config('wp04.expression_check',jsonb_build_object('scope','TWO_CURRENT_CANONICAL_SAMPLES_ONLY','aggregation','PASS','population_count',2,'returned_count',1,'portfolio_function','NOT_INVOKED','candidate_functions','NOT_CREATED','performance','NOT_PROVED')::text,true);
END $check$;
SELECT current_setting('wp04.expression_check')::jsonb AS bounded_expression_result;
ROLLBACK;

