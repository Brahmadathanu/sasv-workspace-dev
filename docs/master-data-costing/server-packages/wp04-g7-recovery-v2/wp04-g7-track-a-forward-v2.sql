-- WP04 G7 TRACK A V2 — BATCHED GOVERNED READINESS BUILD
-- PREPARED / REVIEW ONLY. DO NOT EXECUTE WITHOUT NEW EXPLICIT PRODUCTION AUTHORIZATION.
-- Reuses the already-installed V1 private substrate.
-- Does not change timeout settings, governed-period reader, Product-gap reader, CSE-P01, RLS/Auth, or business/master data.

-- =========================================================
-- V2-P0 — exact pre-V2 state guards
-- =========================================================
DO $guard$
BEGIN
  IF md5(pg_get_functiondef(to_regprocedure('public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)')))
     IS DISTINCT FROM '667267b109a25f4dec3bd7d34c1b2972' THEN
    RAISE EXCEPTION 'V2 source drift: public portfolio RPC';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_build_readiness_portfolio(date)')))
     IS DISTINCT FROM '2f50384afe6cf1bea2ecd9c3b12f164c' THEN
    RAISE EXCEPTION 'V2 source drift: installed V1 builder';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_readiness_source_fingerprint(date)')))
     IS DISTINCT FROM 'fb0965cc075b72b1a71919bcaac28212' THEN
    RAISE EXCEPTION 'V2 source drift: installed V1 fingerprint';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_readiness_portfolio_index_read(bigint,date,text,text[],text[],text[],text[],text,bigint,integer)')))
     IS DISTINCT FROM 'd691b39f9a9c088e7e38e8d41835cc0e' THEN
    RAISE EXCEPTION 'V2 source drift: index reader';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)')))
     IS DISTINCT FROM md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)'))) THEN
    RAISE EXCEPTION 'unreachable';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)')))
     IS DISTINCT FROM 'b47e4d07e13dffe5d38d37010ee5ff34' THEN
    RAISE EXCEPTION 'V2 source drift: canonical live core';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)')))
     IS DISTINCT FROM 'fd0b3fe63b40fa3c669da8af1fa5994f' THEN
    RAISE EXCEPTION 'V2 source drift: C live core';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))
     IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'V2 CSE-P01 drift';
  END IF;
  IF (select count(*) from costing.readiness_portfolio_source_epoch)<>44 THEN
    RAISE EXCEPTION 'V2 source epoch registry mismatch';
  END IF;
  IF (select count(*) from pg_trigger where not tgisinternal and tgname like 'wp04_readiness_epoch_%')<>44 THEN
    RAISE EXCEPTION 'V2 source epoch trigger mismatch';
  END IF;
  IF exists(select 1 from costing.product_sku_readiness_portfolio_build)
     OR exists(select 1 from costing.product_sku_readiness_portfolio_item)
     OR exists(select 1 from costing.product_sku_readiness_portfolio_incidence) THEN
    RAISE EXCEPTION 'V2 requires empty pre-cutover build substrate';
  END IF;
END
$guard$;

-- =========================================================
-- V2-P1 — version fingerprint + replace builder only
-- =========================================================
BEGIN;

CREATE OR REPLACE FUNCTION costing.fn_wp04_readiness_source_fingerprint(p_period_start date)
RETURNS TABLE(fingerprint jsonb,digest text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO costing,public,pg_temp
AS $function$
DECLARE
  v_period date;
  v_val date;
  v_run bigint;
  v_epochs jsonb;
  v_defs text;
  v_schema text;
  v_fp jsonb;
BEGIN
  IF p_period_start IS NULL THEN RAISE EXCEPTION 'Period is required'; END IF;
  v_period:=date_trunc('month',p_period_start::timestamp)::date;

  SELECT valuation_date INTO v_val
  FROM costing.cost_periods
  WHERE period_start=v_period;
  IF v_val IS NULL THEN RAISE EXCEPTION 'Governed valuation date missing for %',v_period; END IF;

  SELECT id INTO v_run
  FROM costing.costing_refresh_run
  WHERE period_start=v_period
    AND valuation_date=v_val
    AND overall_status='SUCCESS'
  ORDER BY finished_at DESC NULLS LAST,id DESC
  LIMIT 1;

  SELECT jsonb_object_agg(source_relation,epoch ORDER BY source_relation)
  INTO v_epochs
  FROM costing.readiness_portfolio_source_epoch;

  SELECT string_agg(sig||'='||md5(pg_get_functiondef(to_regprocedure(sig))),'|' ORDER BY sig)
  INTO v_defs
  FROM unnest(ARRAY[
    'costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)',
    'costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)',
    'costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)',
    'costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot)',
    'costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb)',
    'costing.fn_product_sku_readiness_shared_issues(date)',
    'costing.fn_product_process_route_readiness(date)',
    'costing.fn_resolve_sku_mrp_as_of(bigint,date)',
    'costing.fn_resolve_sku_selling_price_policy_as_of(bigint,date)',
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)',
    'costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)',
    'costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)',
    'public.plm_sku_bom_revision_as_of(bigint,date)'
  ]::text[]) x(sig);

  v_defs:=v_defs
    ||'|view:costing.v_cost_driver_policy_registry='
    ||md5(pg_get_viewdef('costing.v_cost_driver_policy_registry'::regclass,true))
    ||'|view:costing.v_sku_commercial_sales_basis='
    ||md5(pg_get_viewdef('costing.v_sku_commercial_sales_basis'::regclass,true))
    ||'|view:costing.v_regional_marketing_evidence_review_queue='
    ||md5(pg_get_viewdef('costing.v_regional_marketing_evidence_review_queue'::regclass,true));

  SELECT string_agg(
    e.source_relation||':'||
    coalesce((
      SELECT string_agg(
        a.attname||'/'||a.atttypid::regtype::text||'/'||a.attnotnull::text,
        ',' ORDER BY a.attnum
      )
      FROM pg_attribute a
      WHERE a.attrelid=to_regclass(e.source_relation)
        AND a.attnum>0
        AND NOT a.attisdropped
    ),''),
    '|' ORDER BY e.source_relation
  )
  INTO v_schema
  FROM costing.readiness_portfolio_source_epoch e;

  v_fp:=jsonb_build_object(
    'contract_version','WP04_G7_TRACK_A_V2',
    'period_start',v_period,
    'valuation_date',v_val,
    'evidence_refresh_run_id',v_run,
    'source_epochs',v_epochs,
    'canonical_definition_digest',md5(v_defs),
    'source_schema_digest',md5(v_schema)
  );

  RETURN QUERY SELECT v_fp,md5(v_fp::text);
END
$function$;


ALTER FUNCTION costing.fn_wp04_readiness_source_fingerprint(date) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_readiness_source_fingerprint(date)
FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION costing.fn_wp04_build_readiness_portfolio(p_period_start date)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO costing,public,pg_temp
AS $function$
DECLARE
  v_period date;
  v_val date;
  v_run bigint;
  v_build bigint;
  v_start_fp jsonb;
  v_start_digest text;
  v_end_fp jsonb;
  v_end_digest text;
  v_route_map jsonb;
  v_route_count bigint;
  v_route_distinct bigint;
  v_shared jsonb:='[]'::jsonb;
  v_sku_ids bigint[];
  v_run_map jsonb:='{}'::jsonb;
  v_items bigint;
  v_operational bigint;
  v_invalid bigint;
  v_relation record;
BEGIN
  v_period:=date_trunc('month',p_period_start::timestamp)::date;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('WP04_READINESS_BUILD:'||v_period::text,0)) THEN
    RAISE EXCEPTION 'READINESS_BUILD_IN_PROGRESS';
  END IF;

  SELECT valuation_date INTO v_val
  FROM costing.cost_periods WHERE period_start=v_period;
  IF v_val IS NULL THEN RAISE EXCEPTION 'Governed valuation date missing for %',v_period; END IF;

  SELECT id INTO v_run
  FROM costing.costing_refresh_run
  WHERE period_start=v_period AND valuation_date=v_val AND overall_status='SUCCESS'
  ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1;

  SELECT array_agg(id ORDER BY id) INTO v_sku_ids
  FROM public.product_skus;
  IF coalesce(cardinality(v_sku_ids),0)=0 THEN
    RAISE EXCEPTION 'No SKUs available for readiness build';
  END IF;

  SELECT fingerprint,digest INTO v_start_fp,v_start_digest
  FROM costing.fn_wp04_readiness_source_fingerprint(v_period);

  INSERT INTO costing.product_sku_readiness_portfolio_build(
    period_start,valuation_date,evidence_refresh_run_id,status,is_current,
    source_fingerprint,source_fingerprint_digest
  )
  VALUES(v_period,v_val,v_run,'BUILDING',false,v_start_fp,v_start_digest)
  RETURNING id INTO v_build;

  BEGIN
    WITH route_rows AS MATERIALIZED (
      SELECT * FROM costing.fn_product_process_route_readiness(v_val)
    )
    SELECT count(*),count(distinct product_id),jsonb_object_agg(product_id::text,to_jsonb(r))
    INTO v_route_count,v_route_distinct,v_route_map
    FROM route_rows r;

    IF v_route_count<>v_route_distinct THEN
      RAISE EXCEPTION 'Nonunique route evidence';
    END IF;

    IF v_run IS NOT NULL THEN
      v_shared:=costing.fn_product_sku_readiness_shared_issues(v_val);

      SELECT coalesce(jsonb_object_agg(c.sku_id::text,c.evidence_envelope),'{}'::jsonb)
      INTO v_run_map
      FROM costing.fn_wp04_c_run_cohort(v_sku_ids,v_period,v_val,v_run) c;

      IF jsonb_object_length(v_run_map)<>cardinality(v_sku_ids) THEN
        RAISE EXCEPTION 'Batched run cohort cardinality mismatch';
      END IF;
    END IF;

    INSERT INTO costing.product_sku_readiness_portfolio_item(
      build_id,sku_id,product_id,product_name,product_status,
      sku_is_active,sku_is_sample,overall_severity,assessment
    )
    SELECT
      v_build,
      s.id,
      s.product_id,
      a.assessment#>>'{identity,product_name}',
      a.assessment#>>'{lifecycle,product_status}',
      coalesce((a.assessment#>>'{lifecycle,sku_is_active}')::boolean,false),
      coalesce((a.assessment#>>'{lifecycle,sku_is_sample}')::boolean,false),
      a.assessment#>>'{summary,overall_severity}',
      a.assessment
    FROM public.product_skus s
    CROSS JOIN LATERAL (
      SELECT costing.fn_wp04_c_live_core(
        s.id,v_period,v_val,v_run,
        v_route_map->(s.product_id::text),
        v_shared,
        CASE WHEN v_run IS NULL THEN NULL ELSE v_run_map->(s.id::text) END
      ) AS assessment
    ) a;

    SELECT count(*),
           count(*) FILTER(
             WHERE product_status='Active'
               AND sku_is_active
               AND NOT coalesce(sku_is_sample,false)
           ),
           count(*) FILTER(
             WHERE assessment#>>'{context,context_type}' IS DISTINCT FROM 'LIVE_AS_OF'
                OR assessment#>>'{context,sku_id}' IS DISTINCT FROM sku_id::text
                OR assessment#>>'{context,product_id}' IS DISTINCT FROM product_id::text
                OR assessment#>>'{context,period_start}' IS DISTINCT FROM v_period::text
                OR assessment#>>'{context,valuation_date}' IS DISTINCT FROM v_val::text
                OR assessment#>'{context,refresh_run_id}' IS DISTINCT FROM 'null'::jsonb
                OR (v_run IS NOT NULL AND assessment#>>'{context,evidence_refresh_run_id}' IS DISTINCT FROM v_run::text)
                OR overall_severity NOT IN ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')
           )
    INTO v_items,v_operational,v_invalid
    FROM costing.product_sku_readiness_portfolio_item
    WHERE build_id=v_build;

    IF v_items IS DISTINCT FROM cardinality(v_sku_ids) THEN
      RAISE EXCEPTION 'Readiness build item count mismatch';
    END IF;
    IF v_invalid<>0 THEN
      RAISE EXCEPTION 'Readiness build canonical validation failed for % items',v_invalid;
    END IF;

    INSERT INTO costing.product_sku_readiness_portfolio_incidence(
      build_id,sku_id,incidence_kind,dependency_code,issue_code,
      owner_module,route_code,status,shared_issue
    )
    SELECT i.build_id,i.sku_id,'DEPENDENCY',
           d->>'dependency_code',NULL,d->>'owner_module',d->>'recommended_ui_route',
           coalesce(d->>'effective_status',d->>'raw_status'),NULL
    FROM costing.product_sku_readiness_portfolio_item i
    CROSS JOIN LATERAL jsonb_array_elements(i.assessment->'dependencies') x(d)
    WHERE i.build_id=v_build
      AND d->>'applicability'<>'NOT_REQUIRED'
      AND coalesce(d->>'effective_status',d->>'raw_status')
          IN ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN');

    INSERT INTO costing.product_sku_readiness_portfolio_incidence(
      build_id,sku_id,incidence_kind,dependency_code,issue_code,
      owner_module,route_code,status,shared_issue
    )
    SELECT i.build_id,i.sku_id,'SHARED',
           d->>'dependency_code',d->>'issue_code',d->>'owner_module',
           d->>'recommended_ui_route',d->>'status',d
    FROM costing.product_sku_readiness_portfolio_item i
    CROSS JOIN LATERAL jsonb_array_elements(i.assessment->'shared_issues') x(d)
    WHERE i.build_id=v_build
      AND d->>'status' IN ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN');

    INSERT INTO costing.product_sku_readiness_portfolio_incidence(
      build_id,sku_id,incidence_kind,dependency_code,region_code,raw_status,effective_status
    )
    SELECT DISTINCT i.build_id,i.sku_id,'REGIONAL','REGIONAL_MARKETING_EVIDENCE',
           e->>'region_code',e->>'raw_status',e->>'effective_status'
    FROM costing.product_sku_readiness_portfolio_item i
    CROSS JOIN LATERAL jsonb_array_elements(i.assessment->'dependencies') x(d)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
    WHERE i.build_id=v_build
      AND d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE';

    FOR v_relation IN
      SELECT source_relation,epoch
      FROM costing.readiness_portfolio_source_epoch
      ORDER BY source_relation
      FOR UPDATE
    LOOP NULL; END LOOP;

    SELECT fingerprint,digest INTO v_end_fp,v_end_digest
    FROM costing.fn_wp04_readiness_source_fingerprint(v_period);

    IF v_end_digest IS DISTINCT FROM v_start_digest THEN
      UPDATE costing.product_sku_readiness_portfolio_build
      SET status='FAILED',completed_at=clock_timestamp(),error_text='SOURCE_CHANGED_DURING_BUILD'
      WHERE id=v_build;
      RETURN v_build;
    END IF;

    UPDATE costing.product_sku_readiness_portfolio_build
    SET is_current=false,
        status=CASE WHEN status='COMPLETED' THEN 'SUPERSEDED' ELSE status END
    WHERE period_start=v_period AND is_current;

    UPDATE costing.product_sku_readiness_portfolio_build
    SET status='COMPLETED',is_current=true,
        source_fingerprint=v_end_fp,source_fingerprint_digest=v_end_digest,
        item_count=v_items,operational_count=v_operational,
        completed_at=clock_timestamp(),promoted_at=clock_timestamp(),error_text=NULL
    WHERE id=v_build;

    RETURN v_build;
  EXCEPTION WHEN OTHERS THEN
    UPDATE costing.product_sku_readiness_portfolio_build
    SET status='FAILED',is_current=false,completed_at=clock_timestamp(),
        error_text=left(SQLSTATE||': '||SQLERRM,2000)
    WHERE id=v_build;
    RETURN v_build;
  END;
END
$function$;

ALTER FUNCTION costing.fn_wp04_build_readiness_portfolio(date) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_build_readiness_portfolio(date)
FROM PUBLIC,anon,authenticated,service_role;

COMMIT;

-- =========================================================
-- V2-P2 — build once
-- =========================================================
SELECT costing.fn_wp04_build_readiness_portfolio('2026-09-01'::date) AS build_id;

DO $build_guard$
DECLARE b record; fp record;
BEGIN
  SELECT * INTO b FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current ORDER BY id DESC LIMIT 1;
  IF b.id IS NULL OR b.status<>'COMPLETED' OR b.operational_count<>611 THEN
    RAISE EXCEPTION 'V2 initial build did not complete/promote with 611 OPERATIONAL';
  END IF;
  SELECT * INTO fp FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01');
  IF b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
    RAISE EXCEPTION 'V2 build stale before parity/cutover';
  END IF;
END
$build_guard$;

-- =========================================================
-- V2-P2.5 — PRE-CUTOVER full-611 parity against the current public C RPC
-- =========================================================
CREATE TEMP TABLE wp04_v2_baseline(sku_id bigint PRIMARY KEY,assessment jsonb) ON COMMIT DROP;

DO $baseline$
DECLARE
  actor uuid;
  r jsonb;
  after_id bigint:=NULL;
  page_rows bigint;
  has_more boolean;
BEGIN
  SELECT u.id INTO actor
  FROM auth.users u
  WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
  ORDER BY u.id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No Control Center parity actor'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);

  LOOP
    r:=public.rpc_get_product_sku_readiness_portfolio(
      '2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,after_id,100
    );
    INSERT INTO wp04_v2_baseline(sku_id,assessment)
    SELECT (x.value#>>'{context,sku_id}')::bigint,x.value
    FROM jsonb_array_elements(r->'rows') x(value)
    ON CONFLICT (sku_id) DO UPDATE SET assessment=excluded.assessment;

    page_rows:=(r->>'returned_count')::bigint;
    has_more:=(r->>'has_more')::boolean;
    EXIT WHEN NOT has_more;
    after_id:=(r->>'next_after_sku_id')::bigint;
    IF after_id IS NULL OR page_rows=0 THEN RAISE EXCEPTION 'Invalid baseline keyset progression'; END IF;
  END LOOP;
END
$baseline$;

DO $parity$
DECLARE
  v_build bigint;
  v_base bigint;
  v_mismatch bigint;
BEGIN
  SELECT id INTO v_build FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current ORDER BY id DESC LIMIT 1;
  SELECT count(*) INTO v_base FROM wp04_v2_baseline;
  IF v_base<>611 THEN RAISE EXCEPTION 'V2 baseline expected 611, got %',v_base; END IF;

  SELECT count(*) INTO v_mismatch
  FROM wp04_v2_baseline b
  FULL JOIN costing.product_sku_readiness_portfolio_item i
    ON i.build_id=v_build AND i.sku_id=b.sku_id
  WHERE b.sku_id IS NULL OR i.sku_id IS NULL OR i.assessment IS DISTINCT FROM b.assessment;

  IF v_mismatch<>0 THEN RAISE EXCEPTION 'V2 full-611 parity mismatch count %',v_mismatch; END IF;
END
$parity$;

-- =========================================================
-- V2-P3/P4 — atomic public cutover and guards
-- =========================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 p_period_start date,p_population_scope text DEFAULT 'OPERATIONAL',p_overall_severities text[] DEFAULT NULL,
 p_dependency_codes text[] DEFAULT NULL,p_owner_modules text[] DEFAULT NULL,p_route_codes text[] DEFAULT NULL,
 p_search text DEFAULT NULL,p_after_sku_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public,costing,pg_temp
AS $function$
DECLARE
  v_period date;
  v_result jsonb;
  v_has_current boolean;
  v_current_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.app_has_permission('module:costing-control-center','view') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'Costing period start is required for LIVE_AS_OF';
  END IF;

  v_period:=date_trunc('month',p_period_start::timestamp)::date;

  -- One SQL statement/snapshot binds freshness, current-build identity and indexed read.
  SELECT costing.fn_wp04_readiness_portfolio_index_read(
           b.id,p_period_start,p_population_scope,p_overall_severities,
           p_dependency_codes,p_owner_modules,p_route_codes,p_search,p_after_sku_id,p_limit
         )
  INTO v_result
  FROM costing.fn_wp04_readiness_source_fingerprint(v_period) fp
  JOIN costing.product_sku_readiness_portfolio_build b
    ON b.period_start=v_period
   AND b.valuation_date=(fp.fingerprint->>'valuation_date')::date
   AND b.evidence_refresh_run_id IS NOT DISTINCT FROM
       nullif(fp.fingerprint->>'evidence_refresh_run_id','')::bigint
   AND b.status='COMPLETED'
   AND b.is_current
   AND b.source_fingerprint_digest=fp.digest
  ORDER BY b.id DESC
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM costing.product_sku_readiness_portfolio_build b
    WHERE b.period_start=v_period AND b.is_current
  )
  INTO v_has_current;

  IF NOT v_has_current THEN
    RAISE EXCEPTION 'READINESS_BUILD_ABSENT';
  END IF;

  SELECT status INTO v_current_status
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start=v_period AND is_current
  ORDER BY id DESC LIMIT 1;

  IF v_current_status<>'COMPLETED' THEN
    RAISE EXCEPTION 'READINESS_BUILD_INCOMPLETE';
  END IF;

  RAISE EXCEPTION 'READINESS_BUILD_STALE';
END
$function$;

ALTER FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) TO authenticated;

DO $post$
DECLARE b record; fp record;
BEGIN
  SELECT * INTO b FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current ORDER BY id DESC LIMIT 1;
  SELECT * INTO fp FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01');
  IF b.status<>'COMPLETED' OR b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
    RAISE EXCEPTION 'V2 cutover build not fresh';
  END IF;
  IF (select proacl::text from pg_proc where oid=to_regprocedure(
    'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
  )) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'V2 public ACL mismatch';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))
     IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'V2 CSE-P01 drift';
  END IF;
END
$post$;

COMMIT;
