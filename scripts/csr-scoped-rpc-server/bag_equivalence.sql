\set ON_ERROR_STOP on
\pset pager off
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false) AS signed_in_as_id_v;
\echo '== BAG EQUIVALENCE: original public view vs scoped RPC (EXCEPT ALL both ways, nulls, types, order, cap) =='
-- 0. column contract: names, order and types identical, exactly 63
DO $$ DECLARE a text; b text; n int; BEGIN
  SELECT string_agg(attname||':'||format_type(atttypid,atttypmod), ',' ORDER BY attnum) INTO a FROM pg_attribute WHERE attrelid='public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass AND attnum>0 AND NOT attisdropped;
  SELECT string_agg(a2.attname||':'||format_type(a2.atttypid,a2.atttypmod), ',' ORDER BY a2.attnum), count(*) INTO b, n
    FROM pg_proc p JOIN pg_type t ON t.oid=p.prorettype JOIN pg_attribute a2 ON a2.attrelid=t.typrelid AND a2.attnum>0 AND NOT a2.attisdropped
   WHERE p.oid='public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)'::regprocedure;
  IF a IS DISTINCT FROM b OR n <> 63 THEN RAISE EXCEPTION 'TEST FAIL column contract (n=%)', n; END IF;
  RAISE NOTICE 'PASS  column names/order/types identical, 63 columns';
END $$;
-- 1. multiset equality (EXCEPT ALL) both directions + per-column null counts + row count
DO $$ DECLARE p date; a bigint; b bigint; d1 bigint; d2 bigint; ja jsonb; jb jsonb; BEGIN
  FOREACH p IN ARRAY ARRAY[date '2026-09-01', date '2026-10-01', date '2026-11-01', date '2025-11-01', date '2026-12-01', date '2024-01-01', date '2025-10-01'] LOOP
    EXECUTE format('SELECT count(*) FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L', p) INTO a;
    EXECUTE format('SELECT count(*) FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000)', p) INTO b;
    EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L EXCEPT ALL SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000)) x', p, p) INTO d1;
    EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000) EXCEPT ALL SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start=%L) x', p, p) INTO d2;
    EXECUTE format($q$SELECT jsonb_object_agg(k, c) FROM (SELECT e.key k, count(*) FILTER (WHERE e.value = 'null'::jsonb) c FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed v, jsonb_each(to_jsonb(v)) e WHERE v.snapshot_period_start=%L GROUP BY e.key) z$q$, p) INTO ja;
    EXECUTE format($q$SELECT jsonb_object_agg(k, c) FROM (SELECT e.key k, count(*) FILTER (WHERE e.value = 'null'::jsonb) c FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(%L,2000) v, jsonb_each(to_jsonb(v)) e GROUP BY e.key) z$q$, p) INTO jb;
    RAISE NOTICE 'period % rows view=% rpc=% except_all(view-rpc)=% except_all(rpc-view)=% null_profiles_equal=%', p, a, b, d1, d2, ja IS NOT DISTINCT FROM jb;
    IF NOT (a=b AND d1=0 AND d2=0 AND ja IS NOT DISTINCT FROM jb) THEN RAISE EXCEPTION 'TEST FAIL bag equivalence for %', p; END IF;
  END LOOP;
  RAISE NOTICE 'PASS  multiset equality, row counts and per-column null profiles for 7 periods (incl. absent and empty)';
END $$;
-- 2. EXCEPT ALL is actually stronger than EXCEPT: a duplicated row is caught by ALL, invisible to plain EXCEPT (control)
DO $$ DECLARE plain bigint; allc bigint; BEGIN
  CREATE TEMP TABLE dup AS SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000);
  INSERT INTO dup SELECT * FROM dup WHERE sku_id = 1;
  SELECT count(*) INTO plain FROM (SELECT * FROM dup EXCEPT SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01') x;
  SELECT count(*) INTO allc  FROM (SELECT * FROM dup EXCEPT ALL SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01') x;
  IF plain <> 0 OR allc <> 1 THEN RAISE EXCEPTION 'TEST FAIL negative control: plain=% all=%', plain, allc; END IF;
  RAISE NOTICE 'PASS  negative control: duplicate row invisible to EXCEPT (0) but caught by EXCEPT ALL (1)';
  DROP TABLE dup;
END $$;
-- 3. order parity and determinism incl. a deliberate (product_name, sku_column_label) tie, and cardinality above the 2000 cap.
BEGIN;
  -- tie: SKU 9001 same product_name / label as SKU 1, inside governed Nov run 149 (rolled back below)
  INSERT INTO costing.cost_sheet_line_monthly_snapshot
  SELECT snapshot_period_start, valuation_date, refresh_run_id, product_id, product_name, category_name, subcategory_name, group_name, sub_group_name, 9001, sku_column_label, line_order, line_label, value_numeric, value_text, snapshot_refreshed_at
  FROM costing.cost_sheet_line_monthly_snapshot WHERE snapshot_period_start='2026-11-01' AND refresh_run_id=149 AND sku_id=1;
  DO $$ DECLARE r1 text; r2 text; vw text; BEGIN
    SELECT string_agg(sku_id::text, ',') INTO r1 FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000);
    SELECT string_agg(sku_id::text, ',') INTO r2 FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000);
    SELECT string_agg(sku_id::text, ',') INTO vw FROM (SELECT sku_id FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01' ORDER BY product_name, sku_column_label, sku_id LIMIT 2000) z;
    IF r1 IS DISTINCT FROM r2 THEN RAISE EXCEPTION 'TEST FAIL nondeterministic order under tie'; END IF;
    IF r1 IS DISTINCT FROM vw THEN RAISE EXCEPTION 'TEST FAIL order differs from view ordered by (product_name, sku_column_label, sku_id)'; END IF;
    IF position('1,9001' IN r1) = 0 THEN RAISE EXCEPTION 'TEST FAIL tie not broken by sku_id'; END IF;
    RAISE NOTICE 'PASS  deterministic order under (product_name, sku_column_label) tie; equals view order with sku_id tie-break';
  END $$;
ROLLBACK;
BEGIN;
  -- cardinality 2,630 > cap: add 2,000 more SKUs to governed Nov run 149 (rolled back below)
  INSERT INTO costing.cost_sheet_line_monthly_snapshot
  SELECT snapshot_period_start, valuation_date, refresh_run_id, product_id, product_name, category_name, subcategory_name, group_name, sub_group_name, 10000+sku_id*4+g, 'SKU X'||(10000+sku_id*4+g), line_order, line_label, value_numeric, value_text, snapshot_refreshed_at
  FROM costing.cost_sheet_line_monthly_snapshot, generate_series(0,3) g WHERE snapshot_period_start='2026-11-01' AND refresh_run_id=149 AND sku_id <= 500 AND g IS NOT NULL;
  DO $$ DECLARE n_view bigint; n_rpc bigint; diff bigint; BEGIN
    SELECT count(*) INTO n_view FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01';
    SELECT count(*) INTO n_rpc  FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000);
    SELECT count(*) INTO diff FROM (
      (SELECT * FROM public.rpc_get_cost_sheet_sku_monthly_comparison_scoped('2026-11-01',2000))
      EXCEPT ALL
      (SELECT * FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed WHERE snapshot_period_start='2026-11-01' ORDER BY product_name, sku_column_label, sku_id LIMIT 2000)) x;
    IF n_view <= 2000 OR n_rpc <> 2000 OR diff <> 0 THEN RAISE EXCEPTION 'TEST FAIL cap: view=% rpc=% diff=%', n_view, n_rpc, diff; END IF;
    RAISE NOTICE 'PASS  cardinality % > cap: RPC returns exactly 2000 = first 2000 of ordered view (truncation is explicit, client must warn)', n_view;
  END $$;
ROLLBACK;
\echo 'BAG EQUIVALENCE TESTS PASSED'
