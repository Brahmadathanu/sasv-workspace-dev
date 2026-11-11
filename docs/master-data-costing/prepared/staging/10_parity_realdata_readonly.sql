-- STAGING ACCEPTANCE (#273) step 2 (after the owner has applied the prepared SQL to STAGING): real-data parity, SQL level, read-only.
-- psql -v confirm_not_production=1 -v idv_uuid=<uuid of the staging ID-V identity> -h <staging> -f 10_parity_realdata_readonly.sql
-- Executes the view and the function as the staging database owner with the ID-V identity simulated through JWT claim settings.
-- Real-role authorization and HTTP behaviour are covered by scripts/csr-scoped-rpc-staging/staging-acceptance.mjs, not by this file.
\if :{?confirm_not_production}
\else
  \echo 'REFUSED: pass -v confirm_not_production=1 after confirming this is the STAGING database'
  \quit
\endif
\if :{?idv_uuid}
\else
  \echo 'REFUSED: pass -v idv_uuid=<staging ID-V user uuid>'
  \quit
\endif
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub', :'idv_uuid', true), set_config('request.jwt.claims', json_build_object('sub', :'idv_uuid', 'role', 'authenticated')::text, true);
DO $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth.uid() is NULL: claim setting not honoured by this auth.uid(); use the HTTP runner instead'; END IF; END $$;
\echo '== column contract: names, order, types identical; exactly 63 =='
DO $$ DECLARE a text; b text; n int; BEGIN
  SELECT string_agg(attname||':'||format_type(atttypid,atttypmod), ',' ORDER BY attnum) INTO a FROM pg_attribute WHERE attrelid='public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped;
  SELECT string_agg(x.attname||':'||format_type(x.atttypid,x.atttypmod), ',' ORDER BY x.attnum), count(*) INTO b, n
    FROM pg_proc p JOIN pg_type t ON t.oid=p.prorettype JOIN pg_attribute x ON x.attrelid=t.typrelid AND x.attnum>0 AND NOT x.attisdropped
   WHERE p.oid='public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)'::regprocedure;
  IF a IS DISTINCT FROM b OR n <> 63 THEN RAISE EXCEPTION 'PARITY FAIL column contract (n=%)', n; END IF;
  RAISE NOTICE 'PASS column contract (63)';
END $$;
\echo '== bag equality (EXCEPT ALL both ways), counts, null profiles, order, per period =='
DO $parity$ DECLARE p date; a bigint; b bigint; d1 bigint; d2 bigint; ja jsonb; jb jsonb; oa text; ob text; BEGIN
  FOREACH p IN ARRAY ARRAY[date '2026-09-01', date '2026-10-01', date '2026-11-01', date '2025-11-01'] LOOP
    EXECUTE format('SELECT count(*) FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L', p) INTO a;
    EXECUTE format('SELECT count(*) FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000)', p) INTO b;
    EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L EXCEPT ALL SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000)) x', p, p) INTO d1;
    EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000) EXCEPT ALL SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L) x', p, p) INTO d2;
    EXECUTE format($q$SELECT jsonb_object_agg(k,c) FROM (SELECT e.key k, count(*) FILTER (WHERE e.value='null'::jsonb) c FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed v, jsonb_each(to_jsonb(v)) e WHERE v.snapshot_period_start=%L GROUP BY e.key) z$q$, p) INTO ja;
    EXECUTE format($q$SELECT jsonb_object_agg(k,c) FROM (SELECT e.key k, count(*) FILTER (WHERE e.value='null'::jsonb) c FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000) v, jsonb_each(to_jsonb(v)) e GROUP BY e.key) z$q$, p) INTO jb;
    EXECUTE format('SELECT string_agg(sku_id::text, $$,$$) FROM (SELECT sku_id FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L ORDER BY product_name, sku_column_label, sku_id LIMIT 2000) z', p) INTO oa;
    EXECUTE format('SELECT string_agg(sku_id::text, $$,$$) FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000)', p) INTO ob;
    RAISE NOTICE 'period % view=% rpc=% except_all(v-r)=% except_all(r-v)=% nulls_equal=% order_equal=% capped=%', p, a, b, d1, d2, ja IS NOT DISTINCT FROM jb, oa IS NOT DISTINCT FROM ob, b >= 2000;
    IF NOT (a=b AND d1=0 AND d2=0 AND ja IS NOT DISTINCT FROM jb AND oa IS NOT DISTINCT FROM ob) THEN RAISE EXCEPTION 'PARITY FAIL for %', p; END IF;
  END LOOP;
  RAISE NOTICE 'PASS real-data bag parity for Sep/Oct/Nov 2026 and absent 2025-11';
END $parity$;
\echo '== governed-run labelling on the Nov rows (draft vs approved must be preserved) =='
SELECT snapshot_refresh_run_id, snapshot_selection_basis, previous_month_refresh_run_id, previous_month_selection_basis, previous_year_refresh_run_id, count(*)
  FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000) GROUP BY 1,2,3,4,5;
\echo '== free-text review: distinct non-null cost_sheet_note values (confidential-column review; inspect, do not paste into issues) =='
SELECT count(DISTINCT cost_sheet_note) AS distinct_notes, count(*) FILTER (WHERE cost_sheet_note IS NOT NULL) AS rows_with_note
  FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000);
ROLLBACK;
