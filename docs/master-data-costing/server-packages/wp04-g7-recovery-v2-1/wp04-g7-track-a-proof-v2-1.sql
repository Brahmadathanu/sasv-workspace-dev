-- WP04 G7 TRACK A V2 — POST-CUTOVER PROOF
-- PREPARED / REVIEW ONLY. DO NOT EXECUTE WITHOUT V2 PRODUCTION AUTHORIZATION.
-- Full-611 equality is already a mandatory PRE-CUTOVER gate inside forward-v2.
-- This proof validates the promoted index, fail-closed states, security, representative direct canonical equality,
-- filter/statistics behavior, and performance under the real 8-second native-equivalent ceiling.

BEGIN;

DO $p0$
DECLARE b record; fp record;
BEGIN
 SELECT * INTO b FROM costing.product_sku_readiness_portfolio_build
 WHERE period_start='2026-09-01' AND is_current ORDER BY id DESC LIMIT 1;
 IF b.id IS NULL OR b.status<>'COMPLETED' OR b.operational_count<>611 THEN
   RAISE EXCEPTION 'V2 current build invalid';
 END IF;
 IF b.source_fingerprint#>>'{contract_version}' IS DISTINCT FROM 'WP04_G7_TRACK_A_V2' THEN
   RAISE EXCEPTION 'V2 contract version mismatch';
 END IF;
 SELECT * INTO fp FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01');
 IF b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
   RAISE EXCEPTION 'V2 current build stale';
 END IF;
 IF b.item_count IS DISTINCT FROM (select count(*) from public.product_skus) THEN
   RAISE EXCEPTION 'V2 ALL_EXISTING item count mismatch';
 END IF;
END
$p0$;

-- Representative direct canonical-helper equivalence.
DO $direct$
DECLARE
 b bigint; v_period date:='2026-09-01'; v_val date; v_run bigint;
 v_route_map jsonb; v_shared jsonb:='[]'::jsonb; r record;
 canonical jsonb; stored jsonb;
BEGIN
 SELECT id,valuation_date,evidence_refresh_run_id INTO b,v_val,v_run
 FROM costing.product_sku_readiness_portfolio_build
 WHERE period_start=v_period AND is_current ORDER BY id DESC LIMIT 1;

 WITH route_rows AS MATERIALIZED (
   SELECT * FROM costing.fn_product_process_route_readiness(v_val)
 )
 SELECT jsonb_object_agg(product_id::text,to_jsonb(route_rows)) INTO v_route_map FROM route_rows;

 IF v_run IS NOT NULL THEN v_shared:=costing.fn_product_sku_readiness_shared_issues(v_val); END IF;

 FOR r IN
   WITH op AS (
     SELECT i.sku_id,i.overall_severity,row_number() over(partition by i.overall_severity order by i.sku_id) rn
     FROM costing.product_sku_readiness_portfolio_item i
     WHERE i.build_id=b AND i.product_status='Active' AND i.sku_is_active AND NOT coalesce(i.sku_is_sample,false)
   )
   SELECT sku_id FROM op WHERE rn<=2
   UNION
   SELECT min(sku_id) FROM costing.product_sku_readiness_portfolio_item WHERE build_id=b
   UNION
   SELECT max(sku_id) FROM costing.product_sku_readiness_portfolio_item WHERE build_id=b
 LOOP
   SELECT costing.fn_product_sku_readiness_live_core(
     r.sku_id,v_period,v_val,v_run,
     v_route_map->(i.product_id::text),v_shared
   ),i.assessment
   INTO canonical,stored
   FROM costing.product_sku_readiness_portfolio_item i
   WHERE i.build_id=b AND i.sku_id=r.sku_id;

   IF canonical IS DISTINCT FROM stored THEN
     RAISE EXCEPTION 'V2 direct canonical mismatch for SKU %',r.sku_id;
   END IF;
 END LOOP;
END
$direct$;

-- Public result statistics/filter/keyset consistency with stored canonical projections.
DO $reader$
DECLARE actor uuid; r jsonb; b bigint; expected bigint; first_id bigint;
BEGIN
 SELECT u.id INTO actor FROM auth.users u
 WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
 ORDER BY u.id LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'No Control Center proof actor'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);

 SELECT id INTO b FROM costing.product_sku_readiness_portfolio_build
 WHERE period_start='2026-09-01' AND is_current ORDER BY id DESC LIMIT 1;

 r:=public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50);
 SELECT count(*) INTO expected FROM costing.product_sku_readiness_portfolio_item
 WHERE build_id=b AND product_status='Active' AND sku_is_active AND NOT coalesce(sku_is_sample,false);
 IF (r#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM expected OR expected<>611 THEN
   RAISE EXCEPTION 'V2 OPERATIONAL population mismatch';
 END IF;

 SELECT min(sku_id) INTO first_id FROM costing.product_sku_readiness_portfolio_item
 WHERE build_id=b AND product_status='Active' AND sku_is_active AND NOT coalesce(sku_is_sample,false);
 IF (r#>>'{rows,0,context,sku_id}')::bigint IS DISTINCT FROM first_id THEN
   RAISE EXCEPTION 'V2 first-page keyset mismatch';
 END IF;

 r:=public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',ARRAY['BLOCKER'],NULL,NULL,NULL,NULL,NULL,50);
 SELECT count(*) INTO expected FROM costing.product_sku_readiness_portfolio_item
 WHERE build_id=b AND product_status='Active' AND sku_is_active AND NOT coalesce(sku_is_sample,false)
   AND overall_severity='BLOCKER';
 IF (r->>'matched_count')::bigint IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'V2 severity-filter parity mismatch';
 END IF;
END
$reader$;

-- Explicit fail-closed negative states, private metadata only, rolled back.
SAVEPOINT v2_stale;
UPDATE costing.readiness_portfolio_source_epoch
SET epoch=epoch+1,touched_at=clock_timestamp()
WHERE source_relation='public.products';
DO $stale$
DECLARE actor uuid;
BEGIN
 SELECT u.id INTO actor FROM auth.users u
 WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
 ORDER BY u.id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 BEGIN
   PERFORM public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50);
   RAISE EXCEPTION 'Expected READINESS_BUILD_STALE';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%READINESS_BUILD_STALE%' THEN RAISE; END IF;
 END;
END
$stale$;
ROLLBACK TO SAVEPOINT v2_stale;

SAVEPOINT v2_absent;
UPDATE costing.product_sku_readiness_portfolio_build SET is_current=false
WHERE period_start='2026-09-01' AND is_current;
DO $absent$
DECLARE actor uuid;
BEGIN
 SELECT u.id INTO actor FROM auth.users u
 WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
 ORDER BY u.id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 BEGIN
   PERFORM public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50);
   RAISE EXCEPTION 'Expected READINESS_BUILD_ABSENT';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%READINESS_BUILD_ABSENT%' THEN RAISE; END IF;
 END;
END
$absent$;
ROLLBACK TO SAVEPOINT v2_absent;

SAVEPOINT v2_incomplete;
UPDATE costing.product_sku_readiness_portfolio_build SET status='BUILDING'
WHERE period_start='2026-09-01' AND is_current;
DO $incomplete$
DECLARE actor uuid;
BEGIN
 SELECT u.id INTO actor FROM auth.users u
 WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
 ORDER BY u.id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 BEGIN
   PERFORM public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50);
   RAISE EXCEPTION 'Expected READINESS_BUILD_INCOMPLETE';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE '%READINESS_BUILD_INCOMPLETE%' THEN RAISE; END IF;
 END;
END
$incomplete$;
ROLLBACK TO SAVEPOINT v2_incomplete;

DO $security$
BEGIN
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)')))
    IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN RAISE EXCEPTION 'V2 CSE-P01 drift'; END IF;
 IF (select proacl::text from pg_proc where oid=to_regprocedure(
   'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
 )) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
   RAISE EXCEPTION 'V2 public ACL mismatch';
 END IF;
 IF EXISTS(
   SELECT 1 FROM information_schema.role_table_grants
   WHERE table_schema='costing'
     AND table_name IN ('readiness_portfolio_source_epoch','product_sku_readiness_portfolio_build',
                        'product_sku_readiness_portfolio_item','product_sku_readiness_portfolio_incidence')
     AND grantee IN ('anon','authenticated','service_role')
 ) THEN RAISE EXCEPTION 'V2 private table grant detected'; END IF;
END
$security$;

CREATE TEMP TABLE wp04_v2_perf(case_name text primary key,elapsed_ms numeric,returned_count bigint,population_count bigint) ON COMMIT DROP;
SET LOCAL statement_timeout='8s';

DO $perf$
DECLARE actor uuid; t timestamptz; r jsonb;
BEGIN
 SELECT u.id INTO actor FROM auth.users u
 WHERE public.app_has_permission_core(u.id,'module:costing-control-center','view')
 ORDER BY u.id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);

 t:=clock_timestamp();
 r:=public.rpc_get_product_sku_readiness_portfolio('2026-09-01','OPERATIONAL',NULL,NULL,NULL,NULL,NULL,NULL,50);
 INSERT INTO wp04_v2_perf VALUES('OPERATIONAL',extract(epoch from clock_timestamp()-t)*1000,
   (r->>'returned_count')::bigint,(r#>>'{statistics,population_sku_count}')::bigint);

 t:=clock_timestamp();
 r:=public.rpc_get_product_sku_readiness_portfolio('2026-09-01','ALL_EXISTING',NULL,NULL,NULL,NULL,NULL,NULL,50);
 INSERT INTO wp04_v2_perf VALUES('ALL_EXISTING',extract(epoch from clock_timestamp()-t)*1000,
   (r->>'returned_count')::bigint,(r#>>'{statistics,population_sku_count}')::bigint);
END
$perf$;

DO $perf_guard$
BEGIN
 IF EXISTS(select 1 from wp04_v2_perf where elapsed_ms>=8000) THEN
   RAISE EXCEPTION 'V2 indexed read exceeded 8-second ceiling';
 END IF;
END
$perf_guard$;

SELECT * FROM wp04_v2_perf ORDER BY case_name;

DO $final$
DECLARE b record; fp record;
BEGIN
 SELECT * INTO b FROM costing.product_sku_readiness_portfolio_build
 WHERE period_start='2026-09-01' AND is_current ORDER BY id DESC LIMIT 1;
 SELECT * INTO fp FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01');
 IF b.status<>'COMPLETED' OR b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
   RAISE EXCEPTION 'V2 final freshness mismatch';
 END IF;
END
$final$;

ROLLBACK;
