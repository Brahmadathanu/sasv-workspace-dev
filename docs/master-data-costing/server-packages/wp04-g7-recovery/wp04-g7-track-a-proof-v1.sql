-- WP04 G7 TRACK A — PROOF PACKAGE V1
-- PREPARED / REVIEW ONLY. DO NOT EXECUTE WITHOUT EXPLICIT PROOF AUTHORIZATION.
-- Assumes forward-v1 has installed/promoted a current build and cut over the public portfolio RPC.
-- No business/master data mutation. Temporary metadata perturbations are rolled back to savepoints.

BEGIN;

-- =========================================================
-- P0 — target and identity guards
-- =========================================================
DO $p0$
DECLARE
  b record;
BEGIN
  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'
  ))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'CSE-P01 authority drift';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)'
  ))) IS DISTINCT FROM 'b47e4d07e13dffe5d38d37010ee5ff34' THEN
    RAISE EXCEPTION 'Canonical live core drift';
  END IF;

  SELECT * INTO b
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01'::date AND is_current
  ORDER BY id DESC LIMIT 1;

  IF b.id IS NULL OR b.status<>'COMPLETED' THEN
    RAISE EXCEPTION 'No completed current readiness build';
  END IF;
END
$p0$;

CREATE TEMP TABLE wp04_a_context ON COMMIT DROP AS
SELECT
  '2026-09-01'::date period_start,
  cp.valuation_date,
  (
    SELECT id
    FROM costing.costing_refresh_run r
    WHERE r.period_start='2026-09-01'::date
      AND r.valuation_date=cp.valuation_date
      AND r.overall_status='SUCCESS'
    ORDER BY r.finished_at DESC NULLS LAST,r.id DESC
    LIMIT 1
  ) evidence_refresh_run_id,
  (
    SELECT id
    FROM costing.product_sku_readiness_portfolio_build b
    WHERE b.period_start='2026-09-01'::date
      AND b.is_current AND b.status='COMPLETED'
    ORDER BY b.id DESC LIMIT 1
  ) build_id
FROM costing.cost_periods cp
WHERE cp.period_start='2026-09-01'::date;

-- =========================================================
-- P1 — full-611 canonical assessment parity
-- Builder must equal the existing canonical live-core authority.
-- =========================================================
CREATE TEMP TABLE wp04_a_route_map ON COMMIT DROP AS
WITH ctx AS (SELECT * FROM wp04_a_context),
route_rows AS MATERIALIZED (
  SELECT r.*
  FROM ctx
  CROSS JOIN LATERAL costing.fn_product_process_route_readiness(ctx.valuation_date) r
)
SELECT jsonb_object_agg(product_id::text,to_jsonb(route_rows)) route_map,
       count(*) route_count,
       count(distinct product_id) distinct_product_count
FROM route_rows;

DO $route_guard$
BEGIN
  IF EXISTS(
    SELECT 1 FROM wp04_a_route_map WHERE route_count<>distinct_product_count
  ) THEN
    RAISE EXCEPTION 'Nonunique route evidence in proof';
  END IF;
END
$route_guard$;

CREATE TEMP TABLE wp04_a_shared ON COMMIT DROP AS
SELECT
  CASE
    WHEN c.evidence_refresh_run_id IS NULL THEN '[]'::jsonb
    ELSE costing.fn_product_sku_readiness_shared_issues(c.valuation_date)
  END shared_issues
FROM wp04_a_context c;

CREATE TEMP TABLE wp04_a_baseline ON COMMIT DROP AS
SELECT
  s.id sku_id,
  s.product_id,
  costing.fn_product_sku_readiness_live_core(
    s.id,
    c.period_start,
    c.valuation_date,
    c.evidence_refresh_run_id,
    rm.route_map->(s.product_id::text),
    sh.shared_issues
  ) assessment
FROM public.product_skus s
JOIN public.products p ON p.id=s.product_id
CROSS JOIN wp04_a_context c
CROSS JOIN wp04_a_route_map rm
CROSS JOIN wp04_a_shared sh
WHERE p.status='Active'
  AND s.is_active
  AND NOT coalesce(s.is_sample,false);

DO $parity$
DECLARE
  v_count bigint;
  v_mismatch bigint;
  v_build bigint;
BEGIN
  SELECT build_id INTO v_build FROM wp04_a_context;
  SELECT count(*) INTO v_count FROM wp04_a_baseline;
  IF v_count<>611 THEN
    RAISE EXCEPTION 'Expected 611 OPERATIONAL canonical assessments, found %',v_count;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM wp04_a_baseline b
  FULL JOIN costing.product_sku_readiness_portfolio_item i
    ON i.build_id=v_build AND i.sku_id=b.sku_id
  WHERE b.sku_id IS NULL
     OR i.sku_id IS NULL
     OR i.assessment IS DISTINCT FROM b.assessment;

  IF v_mismatch<>0 THEN
    RAISE EXCEPTION 'Full-611 canonical parity mismatch count %',v_mismatch;
  END IF;
END
$parity$;

-- =========================================================
-- P2 — relational projection / statistics / filter parity
-- =========================================================
CREATE TEMP TABLE wp04_a_baseline_item ON COMMIT DROP AS
SELECT
  b.sku_id,
  (b.assessment#>>'{context,product_id}')::bigint product_id,
  b.assessment#>>'{identity,product_name}' product_name,
  b.assessment#>>'{summary,overall_severity}' overall_severity,
  b.assessment
FROM wp04_a_baseline b;

CREATE TEMP TABLE wp04_a_baseline_incidence ON COMMIT DROP AS
SELECT b.sku_id,'DEPENDENCY'::text incidence_kind,
       d->>'dependency_code' dependency_code,
       NULL::text issue_code,
       d->>'owner_module' owner_module,
       d->>'recommended_ui_route' route_code,
       coalesce(d->>'effective_status',d->>'raw_status') status,
       NULL::jsonb shared_issue
FROM wp04_a_baseline_item b
CROSS JOIN LATERAL jsonb_array_elements(b.assessment->'dependencies') x(d)
WHERE d->>'applicability'<>'NOT_REQUIRED'
  AND coalesce(d->>'effective_status',d->>'raw_status')
      IN ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN')
UNION ALL
SELECT b.sku_id,'SHARED',
       d->>'dependency_code',d->>'issue_code',
       d->>'owner_module',d->>'recommended_ui_route',
       d->>'status',d
FROM wp04_a_baseline_item b
CROSS JOIN LATERAL jsonb_array_elements(b.assessment->'shared_issues') x(d)
WHERE d->>'status' IN ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN');

CREATE TEMP TABLE wp04_a_baseline_regional ON COMMIT DROP AS
SELECT DISTINCT b.sku_id,
       e->>'region_code' region_code,
       e->>'raw_status' raw_status,
       e->>'effective_status' effective_status
FROM wp04_a_baseline_item b
CROSS JOIN LATERAL jsonb_array_elements(b.assessment->'dependencies') x(d)
CROSS JOIN LATERAL jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
WHERE d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE';

DO $stats$
DECLARE
  v_build bigint;
  got jsonb;
  expected jsonb;
BEGIN
  SELECT build_id INTO v_build FROM wp04_a_context;
  got:=costing.fn_wp04_readiness_portfolio_index_read(
    v_build,'2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50
  );

  WITH severity_counts AS (
    SELECT count(*) population_sku_count,
           count(*) FILTER(WHERE overall_severity='READY') ready_count,
           count(*) FILTER(WHERE overall_severity='REVIEW_REQUIRED') review_count,
           count(*) FILTER(WHERE overall_severity='BLOCKER') blocker_count,
           count(*) FILTER(WHERE overall_severity='UNKNOWN') unknown_count
    FROM wp04_a_baseline_item
  ), dependency_counts AS (
    SELECT dependency_code,count(distinct sku_id) affected_sku_count
    FROM wp04_a_baseline_incidence
    WHERE dependency_code IS NOT NULL
    GROUP BY dependency_code
  ), owner_counts AS (
    SELECT owner_module,count(distinct sku_id) affected_sku_count
    FROM wp04_a_baseline_incidence
    WHERE owner_module IS NOT NULL
    GROUP BY owner_module
  ), route_counts AS (
    SELECT route_code,count(distinct sku_id) affected_sku_count
    FROM wp04_a_baseline_incidence
    WHERE route_code IS NOT NULL
    GROUP BY route_code
  ), shared_counts AS (
    SELECT shared_issue issue,count(distinct sku_id) affected_sku_count,
           array_agg(distinct sku_id ORDER BY sku_id) affected_sku_ids
    FROM wp04_a_baseline_incidence
    WHERE incidence_kind='SHARED'
    GROUP BY shared_issue
  ), regional_counts AS (
    SELECT region_code,raw_status,effective_status,count(distinct sku_id) sku_region_count
    FROM wp04_a_baseline_regional
    GROUP BY region_code,raw_status,effective_status
  )
  SELECT jsonb_build_object(
    'population_sku_count',(SELECT population_sku_count FROM severity_counts),
    'overall_severity_counts',jsonb_build_object(
      'READY',(SELECT ready_count FROM severity_counts),
      'REVIEW_REQUIRED',(SELECT review_count FROM severity_counts),
      'BLOCKER',(SELECT blocker_count FROM severity_counts),
      'UNKNOWN',(SELECT unknown_count FROM severity_counts)
    ),
    'unresolved_dependency_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY dependency_code) FROM dependency_counts x),'[]'::jsonb),
    'unresolved_owner_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY owner_module) FROM owner_counts x),'[]'::jsonb),
    'unresolved_route_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY route_code) FROM route_counts x),'[]'::jsonb),
    'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
    'unresolved_shared_issue_counts',coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'context',jsonb_build_object(
            'context_type','LIVE_AS_OF',
            'period_start','2026-09-01'::date,
            'valuation_date',(SELECT valuation_date FROM wp04_a_context),
            'refresh_run_id',NULL,
            'evidence_refresh_run_id',(SELECT evidence_refresh_run_id FROM wp04_a_context)
          ),
          'issue',issue,
          'affected_sku_count',affected_sku_count,
          'affected_sku_ids',affected_sku_ids
        )
        ORDER BY issue
      )
      FROM shared_counts
    ),'[]'::jsonb),
    'regional_marketing_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY region_code,raw_status,effective_status) FROM regional_counts x),'[]'::jsonb)
  )
  INTO expected;

  IF got->'statistics' IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Statistics parity mismatch';
  END IF;
END
$stats$;

CREATE TEMP TABLE wp04_a_filter_cases(
  case_name text,
  severities text[],
  dep_codes text[],
  owners text[],
  routes text[],
  search text
) ON COMMIT DROP;

INSERT INTO wp04_a_filter_cases VALUES
 ('DEFAULT',NULL,NULL,NULL,NULL,NULL),
 ('REVIEW',ARRAY['REVIEW_REQUIRED'],NULL,NULL,NULL,NULL),
 ('BLOCKER',ARRAY['BLOCKER'],NULL,NULL,NULL,NULL),
 ('COMMERCIAL_DEP',NULL,ARRAY['COMMON_COMMERCIAL_BASIS'],NULL,NULL,NULL),
 ('PRICING_OWNER',NULL,NULL,ARRAY['PRICING_POLICY_MANAGER'],NULL,NULL),
 ('COMMERCIAL_ROUTE',NULL,NULL,NULL,ARRAY['COMMERCIAL_SALES_ASSUMPTIONS'],NULL),
 ('MIN_SKU_SEARCH',NULL,NULL,NULL,NULL,(SELECT min(sku_id)::text FROM wp04_a_baseline_item));

DO $filters$
DECLARE
  c record;
  v_build bigint;
  got jsonb;
  expected_count bigint;
BEGIN
  SELECT build_id INTO v_build FROM wp04_a_context;

  FOR c IN SELECT * FROM wp04_a_filter_cases ORDER BY case_name LOOP
    SELECT count(*)
    INTO expected_count
    FROM wp04_a_baseline_item b
    WHERE (c.severities IS NULL OR b.overall_severity=ANY(c.severities))
      AND (
        c.search IS NULL
        OR strpos(lower(coalesce(b.product_name,'')),lower(c.search))>0
        OR c.search=b.sku_id::text
        OR c.search=b.product_id::text
      )
      AND (
        (c.dep_codes IS NULL AND c.owners IS NULL AND c.routes IS NULL)
        OR EXISTS(
          SELECT 1 FROM wp04_a_baseline_incidence d
          WHERE d.sku_id=b.sku_id
            AND (c.dep_codes IS NULL OR d.dependency_code=ANY(c.dep_codes))
            AND (c.owners IS NULL OR d.owner_module=ANY(c.owners))
            AND (c.routes IS NULL OR d.route_code=ANY(c.routes))
        )
      );

    got:=costing.fn_wp04_readiness_portfolio_index_read(
      v_build,'2026-09-01','OPERATIONAL',
      c.severities,c.dep_codes,c.owners,c.routes,c.search,NULL,50
    );

    IF (got->>'matched_count')::bigint IS DISTINCT FROM expected_count THEN
      RAISE EXCEPTION 'Filter parity mismatch for %: expected %, got %',
        c.case_name,expected_count,got->>'matched_count';
    END IF;
  END LOOP;
END
$filters$;

DO $keyset$
DECLARE
  v_build bigint;
  got jsonb;
  got_ids bigint[];
  expected_ids bigint[];
BEGIN
  SELECT build_id INTO v_build FROM wp04_a_context;
  got:=costing.fn_wp04_readiness_portfolio_index_read(
    v_build,'2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50
  );

  SELECT array_agg((x.value#>>'{context,sku_id}')::bigint ORDER BY x.ord)
  INTO got_ids
  FROM jsonb_array_elements(got->'rows') WITH ORDINALITY x(value,ord);

  SELECT array_agg(sku_id ORDER BY sku_id)
  INTO expected_ids
  FROM (
    SELECT sku_id FROM wp04_a_baseline_item ORDER BY sku_id LIMIT 50
  ) q;

  IF got_ids IS DISTINCT FROM expected_ids THEN
    RAISE EXCEPTION 'First-page keyset parity mismatch';
  END IF;
END
$keyset$;

-- =========================================================
-- P3 — fail-closed stale / absent / incomplete behavior
-- =========================================================

SAVEPOINT wp04_stale;
UPDATE costing.readiness_portfolio_source_epoch
SET epoch=epoch+1,touched_at=clock_timestamp()
WHERE source_relation='public.products';

DO $expect_stale$
DECLARE
  actor uuid;
BEGIN
  SELECT u.id INTO actor
  FROM auth.users u
  WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
  ORDER BY u.id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No Control Center proof actor'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);

  BEGIN
    PERFORM public.rpc_get_product_sku_readiness_portfolio(
      '2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50
    );
    RAISE EXCEPTION 'Expected READINESS_BUILD_STALE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%READINESS_BUILD_STALE%' THEN RAISE; END IF;
  END;
END
$expect_stale$;
ROLLBACK TO SAVEPOINT wp04_stale;

SAVEPOINT wp04_absent;
UPDATE costing.product_sku_readiness_portfolio_build
SET is_current=false
WHERE period_start='2026-09-01' AND is_current;

DO $expect_absent$
DECLARE
  actor uuid;
BEGIN
  SELECT u.id INTO actor
  FROM auth.users u
  WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
  ORDER BY u.id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  BEGIN
    PERFORM public.rpc_get_product_sku_readiness_portfolio(
      '2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50
    );
    RAISE EXCEPTION 'Expected READINESS_BUILD_INCOMPLETE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%READINESS_BUILD_INCOMPLETE%' THEN RAISE; END IF;
  END;
END
$expect_absent$;
ROLLBACK TO SAVEPOINT wp04_absent;

SAVEPOINT wp04_incomplete;
UPDATE costing.product_sku_readiness_portfolio_build
SET status='BUILDING'
WHERE period_start='2026-09-01' AND is_current;

DO $expect_incomplete$
DECLARE
  actor uuid;
BEGIN
  SELECT u.id INTO actor
  FROM auth.users u
  WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
  ORDER BY u.id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  BEGIN
    PERFORM public.rpc_get_product_sku_readiness_portfolio(
      '2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50
    );
    RAISE EXCEPTION 'Expected fail-closed incomplete build';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%READINESS_BUILD_ABSENT%' THEN RAISE; END IF;
  END;
END
$expect_incomplete$;
ROLLBACK TO SAVEPOINT wp04_incomplete;

-- =========================================================
-- P4 — CSE-P01 + ACL proof
-- =========================================================
DO $security$
BEGIN
  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'
  ))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'CSE-P01 function changed';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)'
  ))) IS DISTINCT FROM 'b216b4dfdf3fbe3e7b837ceb3ee550f4' THEN
    RAISE EXCEPTION 'Sales assumption resolver changed';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)'
  ))) IS DISTINCT FROM '425596466bb9da9dadfc391f96350566' THEN
    RAISE EXCEPTION 'Default policy resolver changed';
  END IF;

  IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure(
    'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
  )) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'Public portfolio ACL mismatch';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema='costing'
      AND table_name IN (
        'readiness_portfolio_source_epoch',
        'product_sku_readiness_portfolio_build',
        'product_sku_readiness_portfolio_item',
        'product_sku_readiness_portfolio_incidence'
      )
      AND grantee IN ('anon','authenticated','service_role')
  ) THEN
    RAISE EXCEPTION 'Private readiness relation grant detected';
  END IF;
END
$security$;

-- =========================================================
-- P5 — performance under real native-equivalent 8s ceiling
-- This lowers the proof transaction from postgres default to the native ceiling.
-- =========================================================
CREATE TEMP TABLE wp04_a_perf(
  case_name text PRIMARY KEY,
  elapsed_ms numeric NOT NULL,
  returned_count bigint,
  population_count bigint
) ON COMMIT DROP;

SET LOCAL statement_timeout='8s';

DO $perf$
DECLARE
  actor uuid;
  t timestamptz;
  r jsonb;
BEGIN
  SELECT u.id INTO actor
  FROM auth.users u
  WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
  ORDER BY u.id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'No Control Center proof actor'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);

  t:=clock_timestamp();
  r:=public.rpc_get_product_sku_readiness_portfolio(
    '2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50
  );
  INSERT INTO wp04_a_perf
  VALUES(
    'OPERATIONAL_DEFAULT',
    extract(epoch FROM clock_timestamp()-t)*1000,
    (r->>'returned_count')::bigint,
    (r#>>'{statistics,population_sku_count}')::bigint
  );

  t:=clock_timestamp();
  r:=public.rpc_get_product_sku_readiness_portfolio(
    '2026-09-01','ALL_EXISTING',NULL,NULL,NULL,NULL,NULL,NULL,50
  );
  INSERT INTO wp04_a_perf
  VALUES(
    'ALL_EXISTING_DEFAULT',
    extract(epoch FROM clock_timestamp()-t)*1000,
    (r->>'returned_count')::bigint,
    (r#>>'{statistics,population_sku_count}')::bigint
  );
END
$perf$;

DO $perf_guard$
BEGIN
  IF EXISTS(SELECT 1 FROM wp04_a_perf WHERE elapsed_ms>=8000) THEN
    RAISE EXCEPTION 'Index reader exceeded native 8s ceiling';
  END IF;
END
$perf_guard$;

SELECT * FROM wp04_a_perf ORDER BY case_name;

-- =========================================================
-- P6 — final freshness/current-build proof
-- =========================================================
DO $final$
DECLARE
  b record;
  fp record;
BEGIN
  SELECT * INTO b
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current
  ORDER BY id DESC LIMIT 1;

  SELECT * INTO fp
  FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01');

  IF b.status<>'COMPLETED' OR b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
    RAISE EXCEPTION 'Final build freshness proof failed';
  END IF;
END
$final$;

ROLLBACK;
