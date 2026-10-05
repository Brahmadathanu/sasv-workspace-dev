-- WP04 G7 TRACK A V2.2 — NARROW PRE-CUTOVER PARITY-SCOPE CORRECTION
-- PREPARED / REVIEW ONLY. DO NOT EXECUTE WITHOUT FRESH EXPLICIT PRODUCTION AUTHORIZATION.
-- Reuses the already-installed V2.1 builder and V2 fingerprint exactly.
-- Changes only the PRE-CUTOVER parity comparison scope: OPERATIONAL baseline vs OPERATIONAL stored subset.
-- Adds a separate ALL_EXISTING identity/count proof.
-- No timeout, canonical logic, builder, fingerprint, CSE-P01, route, governed-period, Product-gap, permission, client or business/master-data change.

-- =========================================================
-- V2.2-P0 — exact current-state guards
-- =========================================================
DO $guard$
BEGIN
  IF md5(pg_get_functiondef(to_regprocedure(
    'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
  ))) IS DISTINCT FROM '667267b109a25f4dec3bd7d34c1b2972' THEN
    RAISE EXCEPTION 'V2.2 source drift: public portfolio RPC';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_build_readiness_portfolio(date)')))
     IS DISTINCT FROM 'd9831a37e97f496dfe9f61f436f65e49' THEN
    RAISE EXCEPTION 'V2.2 source drift: installed V2.1 builder';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_readiness_source_fingerprint(date)')))
     IS DISTINCT FROM '606ec132a26899ae5336ff273e032552' THEN
    RAISE EXCEPTION 'V2.2 source drift: installed V2 fingerprint';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_wp04_readiness_portfolio_index_read(bigint,date,text,text[],text[],text[],text[],text,bigint,integer)'
  ))) IS DISTINCT FROM 'd691b39f9a9c088e7e38e8d41835cc0e' THEN
    RAISE EXCEPTION 'V2.2 source drift: index reader';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure('costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)')))
     IS DISTINCT FROM 'ea6f0e12b2004bd5819f54aaede5e730' THEN
    RAISE EXCEPTION 'V2.2 source drift: batched run cohort';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)'
  ))) IS DISTINCT FROM 'b47e4d07e13dffe5d38d37010ee5ff34' THEN
    RAISE EXCEPTION 'V2.2 source drift: canonical live core';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)'
  ))) IS DISTINCT FROM 'fd0b3fe63b40fa3c669da8af1fa5994f' THEN
    RAISE EXCEPTION 'V2.2 source drift: C live core';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'
  ))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'V2.2 CSE-P01 drift';
  END IF;

  IF (SELECT count(*) FROM costing.readiness_portfolio_source_epoch)<>44
     OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'wp04_readiness_epoch_%')<>44 THEN
    RAISE EXCEPTION 'V2.2 installed substrate mismatch';
  END IF;

  IF EXISTS(SELECT 1 FROM costing.product_sku_readiness_portfolio_build)
     OR EXISTS(SELECT 1 FROM costing.product_sku_readiness_portfolio_item)
     OR EXISTS(SELECT 1 FROM costing.product_sku_readiness_portfolio_incidence) THEN
    RAISE EXCEPTION 'V2.2 requires empty pre-cutover build substrate';
  END IF;
END
$guard$;

-- =========================================================
-- V2.2-P1 — one fresh governed build using installed V2.1 builder
-- =========================================================
SELECT costing.fn_wp04_build_readiness_portfolio('2026-09-01'::date) AS build_id;

DO $build_guard$
DECLARE
  b record;
  fp record;
  v_all bigint;
  v_operational bigint;
BEGIN
  SELECT * INTO b
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current
  ORDER BY id DESC LIMIT 1;

  SELECT count(*),
         count(*) FILTER(
           WHERE p.status='Active'
             AND s.is_active
             AND NOT coalesce(s.is_sample,false)
         )
  INTO v_all,v_operational
  FROM public.product_skus s
  JOIN public.products p ON p.id=s.product_id;

  IF b.id IS NULL OR b.status<>'COMPLETED' THEN
    RAISE EXCEPTION 'V2.2 initial build did not complete/promote';
  END IF;

  IF b.item_count IS DISTINCT FROM v_all
     OR b.operational_count IS DISTINCT FROM v_operational
     OR v_operational<>611 THEN
    RAISE EXCEPTION 'V2.2 build population mismatch: build all %, live all %, build op %, live op %',
      b.item_count,v_all,b.operational_count,v_operational;
  END IF;

  SELECT * INTO fp
  FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01');

  IF b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
    RAISE EXCEPTION 'V2.2 build stale before parity/cutover';
  END IF;
END
$build_guard$;

-- =========================================================
-- V2.2-P1.5 — separate ALL_EXISTING identity membership proof
-- =========================================================
DO $all_existing$
DECLARE
  v_build bigint;
  v_mismatch bigint;
BEGIN
  SELECT id INTO v_build
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current
  ORDER BY id DESC LIMIT 1;

  SELECT count(*) INTO v_mismatch
  FROM (
    SELECT s.id AS sku_id
    FROM public.product_skus s
    FULL JOIN costing.product_sku_readiness_portfolio_item i
      ON i.build_id=v_build AND i.sku_id=s.id
    WHERE s.id IS NULL OR i.sku_id IS NULL
  ) q;

  IF v_mismatch<>0 THEN
    RAISE EXCEPTION 'V2.2 ALL_EXISTING membership mismatch count %',v_mismatch;
  END IF;
END
$all_existing$;

-- =========================================================
-- V2.2-P2 — PRE-CUTOVER full-611 OPERATIONAL parity against current public C RPC
-- =========================================================
CREATE TEMP TABLE wp04_v22_baseline(
  sku_id bigint PRIMARY KEY,
  assessment jsonb
) ON COMMIT DROP;

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

  IF actor IS NULL THEN
    RAISE EXCEPTION 'No Control Center parity actor';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',actor::text,true);

  LOOP
    r:=public.rpc_get_product_sku_readiness_portfolio(
      '2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,after_id,100
    );

    INSERT INTO wp04_v22_baseline(sku_id,assessment)
    SELECT (x.value#>>'{context,sku_id}')::bigint,x.value
    FROM jsonb_array_elements(r->'rows') x(value)
    ON CONFLICT (sku_id) DO UPDATE SET assessment=excluded.assessment;

    page_rows:=(r->>'returned_count')::bigint;
    has_more:=(r->>'has_more')::boolean;

    EXIT WHEN NOT has_more;

    after_id:=(r->>'next_after_sku_id')::bigint;
    IF after_id IS NULL OR page_rows=0 THEN
      RAISE EXCEPTION 'Invalid baseline keyset progression';
    END IF;
  END LOOP;
END
$baseline$;

DO $parity$
DECLARE
  v_build bigint;
  v_base bigint;
  v_stored_operational bigint;
  v_mismatch bigint;
BEGIN
  SELECT id INTO v_build
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01' AND is_current
  ORDER BY id DESC LIMIT 1;

  SELECT count(*) INTO v_base
  FROM wp04_v22_baseline;

  SELECT count(*) INTO v_stored_operational
  FROM costing.product_sku_readiness_portfolio_item
  WHERE build_id=v_build
    AND product_status='Active'
    AND sku_is_active
    AND NOT coalesce(sku_is_sample,false);

  IF v_base<>611 OR v_stored_operational<>611 THEN
    RAISE EXCEPTION 'V2.2 OPERATIONAL parity population mismatch: baseline %, stored %',
      v_base,v_stored_operational;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM wp04_v22_baseline b
  FULL JOIN (
    SELECT sku_id,assessment
    FROM costing.product_sku_readiness_portfolio_item
    WHERE build_id=v_build
      AND product_status='Active'
      AND sku_is_active
      AND NOT coalesce(sku_is_sample,false)
  ) i
    ON i.sku_id=b.sku_id
  WHERE b.sku_id IS NULL
     OR i.sku_id IS NULL
     OR i.assessment IS DISTINCT FROM b.assessment;

  IF v_mismatch<>0 THEN
    RAISE EXCEPTION 'V2.2 full-611 OPERATIONAL parity mismatch count %',v_mismatch;
  END IF;
END
$parity$;

-- =========================================================
-- V2.2-P3/P4 — atomic public cutover and guards
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


