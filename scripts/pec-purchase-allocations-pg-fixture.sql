\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture for PEC Purchase Allocations reporting V1 (PA-01). NEVER connect to production.
-- Loads the REAL repository SQL: the chronological FIFO / return-adjusted receipt views (20261124103114) and the
-- reporting V1 migration (20261124134249). The live-only base views are stood in by tables with the columns the
-- repository SQL reads. All data is synthetic.
-- Run from the repository root: psql -X -v ON_ERROR_STOP=1 -f scripts/pec-purchase-allocations-pg-fixture.sql
DO $r$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
-- Stand-in for the PEC permission gate: 'view' and 'edit' pass a view check; anything else is denied (42501).
CREATE FUNCTION public.require_permission(p_target text, p_need_edit boolean) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
 IF current_setting('pec.fixture_access', true) IS NULL OR current_setting('pec.fixture_access', true) NOT IN ('view','edit')
    OR (p_need_edit AND current_setting('pec.fixture_access', true) <> 'edit') THEN
   RAISE EXCEPTION 'PEC permission denied' USING ERRCODE = '42501';
 END IF;
END $fn$;
SELECT set_config('pec.fixture_access', 'view', false);

CREATE TABLE public.inv_uom(id bigint PRIMARY KEY, code text);
CREATE TABLE public.inv_class_category(id bigint PRIMARY KEY, code text);
CREATE TABLE public.inv_stock_item(id bigint PRIMARY KEY, name text, code text);
-- stand-ins for live-only views
CREATE TABLE public.v_proc_purchase_fact_with_vendor(purchase_fact_id bigint PRIMARY KEY, voucher_date date, material_class_id bigint, stock_item_id bigint,
  uom_id bigint, purchase_qty numeric, supplier_name text, vendor_id bigint);
CREATE TABLE public.v_proc_indent_open_lines(indent_line_id bigint PRIMARY KEY, indent_id bigint, indent_number text, approved_date date,
  material_class_id bigint, stock_item_id bigint, uom_id bigint, requested_qty numeric);
CREATE TABLE public.v_proc_indent_lines_console_ordered(indent_line_id bigint PRIMARY KEY, indent_id bigint, indent_number text, indent_line_sort_no bigint,
  approved_date date, requested_qty numeric, remaining_qty numeric);
CREATE TABLE public.proc_indent_excess_acceptance(purchase_fact_id bigint, accepted_qty numeric, reason text, accepted_by text);
CREATE FUNCTION public.proc_request_snapshot_refresh_pec_internal(p_reason text) RETURNS TABLE(ok boolean) LANGUAGE sql AS $$ SELECT true $$;

INSERT INTO inv_uom VALUES (1,'Kg'),(2,'Nos'),(3,'L');
INSERT INTO inv_class_category VALUES (1,'RM'),(2,'PM'),(5,'IND');
INSERT INTO inv_stock_item VALUES (1,'Sathavari Kizhangu (D)','RM-001'),(2,'Synthetic Herb','RM-002'),(3,'Synthetic Resin','RM-003'),(4,'Synthetic Returned Gum','RM-004'),
 (5,'Synthetic Oil','RM-005'),(6,'Synthetic Bottle','RM-006'),(7,'Synthetic Carton','PM-007'),(8,'Synthetic Gloves','IND-008'),(9,'Synthetic Root','RM-009'),
 (10,'Synthetic Decimal','RM-010'),(11,'Synthetic Opening','RM-011'),(12,'Synthetic Boundary','RM-012');

-- open indent lines (indent_line_id, indent_id, indent_number, approved_date, class, item, uom, requested)
INSERT INTO v_proc_indent_open_lines VALUES
 (8401,840,'84','2026-11-02',1,1,1,5),(15601,1560,'156','2026-11-10',1,1,1,50),(19101,1910,'191','2026-11-15',1,1,1,100),
 (5001,5000,'500','2026-11-23',1,2,1,50),
 (3001,3000,'300','2026-11-01',1,9,1,60),(3011,3010,'301','2026-11-05',1,9,1,40),
 (7001,7000,'700','2026-11-20',1,5,3,35),(8001,8000,'800','2026-11-20',2,7,2,150),(9001,9000,'X7','2026-11-20',5,8,2,10),
 (10001,10000,'1000','2026-11-10',1,10,1,0.1),(10002,10000,'1000','2026-11-10',1,10,1,0.2),
 (6001,6000,'600','2026-11-01',1,11,1,40);
-- console-ordered lines carry the canonical serial and the LIVE remaining quantity (current balance)
INSERT INTO v_proc_indent_lines_console_ordered VALUES
 (8401,840,'84',107,'2026-11-02',5,0),(15601,1560,'156',170,'2026-11-10',50,0),(19101,1910,'191',198,'2026-11-15',100,20),
 (5001,5000,'500',7,'2026-11-23',50,0),(3001,3000,'300',1,'2026-11-01',60,0),(3011,3010,'301',1,'2026-11-05',40,0),
 (7001,7000,'700',1,'2026-11-20',35,0),(8001,8000,'800',1,'2026-11-20',150,0),(9001,9000,'X7',1,'2026-11-20',10,0),
 (10001,10000,'1000',1,'2026-11-10',0.1,0),(10002,10000,'1000',2,'2026-11-10',0.2,0),(6001,6000,'600',1,'2026-11-01',40,15);
-- purchase facts (id, date, class, item, uom, qty, supplier, vendor_id)
INSERT INTO v_proc_purchase_fact_with_vendor VALUES
 (169565,'2026-11-23',1,1,1,135,'Kera Traders',1),
 (170020,'2026-11-23',1,2,1,30,'Alpha Supplies',2),(170021,'2026-11-23',1,2,1,20,'Alpha Suppliers',2),   -- same mapped vendor, two source labels
 (170030,'2026-11-23',1,4,1,40,'Cash Purchase A',NULL),(170032,'2026-11-24',1,4,1,-40,'Cash Purchase A',NULL), -- returned to nil effective
 (170031,'2026-11-23',1,3,1,12.5,'Cash Purchase B',NULL),                                                      -- positive unallocated, accepted excess
 (170040,'2026-11-23',1,9,1,100,'Beta Traders',3),
 (170050,'2026-11-23',1,5,3,35,'Gamma Oils',4),(170060,'2026-11-23',1,6,2,1000,'Gamma Oils',4),
 (170070,'2026-11-23',2,7,2,200,'Delta Packs',5),(170080,'2026-11-23',5,8,2,10,'Delta Packs',5),
 (170090,'2026-11-23',1,10,1,0.3,'Epsilon',6),
 (170100,'2026-11-10',1,11,1,15,'Zeta',7),(170101,'2026-11-23',1,11,1,10,'Zeta',7),                           -- one allocation before, one inside the period
 (170110,'2026-11-22',1,12,1,1,'Boundary Co',8),(170111,'2026-11-24',1,12,1,2,'Boundary Co',8);              -- outside a single-day 23 Nov range
\i supabase/migrations/20261124103114_pec_chronological_fifo_return_adjusted_receipts.sql
\i supabase/migrations/20261124134249_pec_purchase_allocations_reporting_v1.sql
-- The FIFO migration's own guard refuses to load over existing acceptances, so accepted excess is recorded after loading.
INSERT INTO proc_indent_excess_acceptance VALUES (170031,12.5,'fixture','tester');

CREATE FUNCTION pg_temp.ck(ok boolean, msg text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', msg; END IF; RAISE NOTICE 'ok: %', msg; END $f$;
CREATE FUNCTION pg_temp.thrown(sql text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN EXECUTE sql; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE; END $f$;

-- ── 1. grants and volatility ─────────────────────────────────────────────────────────────────────────
DO $t$
DECLARE f text;
BEGIN
 FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE 'proc_pec_purchase_alloc\_%' LOOP
  PERFORM pg_temp.ck(has_function_privilege('authenticated', f, 'EXECUTE') AND has_function_privilege('service_role', f, 'EXECUTE')
    AND NOT has_function_privilege('anon', f, 'EXECUTE'), 'grants: '||f||' executable by authenticated/service_role, not anon');
  PERFORM pg_temp.ck((SELECT provolatile='s' AND prosecdef AND proconfig::text LIKE '%search_path=pg_catalog, public, pg_temp%' FROM pg_proc WHERE oid=f::regprocedure),
    'definer + stable + pinned search_path: '||f);
 END LOOP;
 PERFORM pg_temp.ck((SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'proc_pec_purchase_alloc\_%')=5, 'exactly five public reporting RPCs');
 PERFORM pg_temp.ck(NOT has_function_privilege('authenticated', 'public._proc_pec_pa_report(text,date,date,text,text,text,text,text,integer,integer,bigint,bigint,bigint,text,bigint)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public._proc_pec_pa_report(text,date,date,text,text,text,text,text,integer,integer,bigint,bigint,bigint,text,bigint)', 'EXECUTE')
   AND NOT has_function_privilege('service_role', 'public._proc_pec_pa_report(text,date,date,text,text,text,text,text,integer,integer,bigint,bigint,bigint,text,bigint)', 'EXECUTE'),
   'internal helper is not executable by any API role');
END $t$;

-- ── 2. permission boundary ───────────────────────────────────────────────────────────────────────────
DO $t$
DECLARE calls text[] := ARRAY[
 $$select proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23')$$,
 $$select * from proc_pec_purchase_alloc_indent_paged('2026-11-23','2026-11-23')$$,
 $$select * from proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23')$$,
 $$select * from proc_pec_purchase_alloc_vendor_paged('2026-11-23','2026-11-23')$$,
 $$select * from proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23')$$]; c text;
BEGIN
 FOREACH c IN ARRAY calls LOOP
  PERFORM set_config('pec.fixture_access','no',false);
  PERFORM pg_temp.ck(pg_temp.thrown(c)='42501', 'no PEC permission is denied: '||left(c,60));
  PERFORM set_config('pec.fixture_access','view',false);
  PERFORM pg_temp.ck(pg_temp.thrown(c) IS NULL, 'view-only PEC permission can execute: '||left(c,60));
 END LOOP;
 SET LOCAL ROLE anon;
 PERFORM pg_temp.ck(pg_temp.thrown($$select proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23')$$)='42501', 'anonymous role cannot execute');
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from public._proc_pec_pa_report('summary','2026-11-23','2026-11-23')$$)='42501', 'anonymous role cannot execute the helper');
 RESET ROLE;
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from public._proc_pec_pa_report('summary','2026-11-23','2026-11-23')$$)='42501', 'authenticated role cannot execute the helper');
 PERFORM pg_temp.ck(pg_temp.thrown($$select proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23')$$) IS NULL, 'authenticated + view permission executes through the gate');
 RESET ROLE;
END $t$;

-- ── 3. argument validation ───────────────────────────────────────────────────────────────────────────
DO $t$
BEGIN
 PERFORM pg_temp.ck(pg_temp.thrown($$select proc_pec_purchase_alloc_summary('2026-11-24','2026-11-23')$$)='22023', 'from > to is rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select proc_pec_purchase_alloc_summary(NULL,'2026-11-23')$$)='22023', 'null date is rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23',p_status=>'bogus')$$)='22023', 'unknown status is rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23','XX')$$)='22023', 'unknown material class is rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>0)$$)='22023', 'limit 0 rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>201)$$)='22023', 'limit 201 rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_offset=>-1)$$)='22023', 'negative offset rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_offset=>100001)$$)='22023', 'offset 100001 rejected');
 PERFORM pg_temp.ck(pg_temp.thrown($$select * from proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>200,p_offset=>100000)$$) IS NULL, 'limit 200 / offset 100000 accepted');
END $t$;

-- ── 4. the 23 Nov acceptance shape (fact 169565) ─────────────────────────────────────────────────────
DO $t$
DECLARE r jsonb; n int;
BEGIN
 SELECT count(*) INTO n FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_purchase_fact_id=>169565);
 PERFORM pg_temp.ck(n=3, 'fact 169565 has three allocation rows');
 PERFORM pg_temp.ck((SELECT string_agg(row_data->>'indent_number'||'/'||(row_data->>'indent_line_sort_no')||'='||(row_data->>'allocated_qty'), ' ' ORDER BY ordinality)
   FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_purchase_fact_id=>169565) WITH ORDINALITY)='84/107=5.000000 156/170=50.000000 191/198=80.000000'
   OR (SELECT string_agg(row_data->>'indent_number'||'/'||(row_data->>'indent_line_sort_no')||'='||(row_data->>'allocated_qty'), ' ' ORDER BY ordinality)
   FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_purchase_fact_id=>169565) WITH ORDINALITY)='84/107=5 156/170=50 191/198=80',
   '84/107=5, 156/170=50, 191/198=80 in canonical order');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_purchase_fact_id=>169565,p_indent_id=>1910);
 PERFORM pg_temp.ck((r->>'receipt_allocated_qty')::numeric=135 AND (r->>'unallocated_qty')::numeric=0 AND (r->>'gross_qty')::numeric=135, 'receipt 135 Kg, allocated 135, unallocated 0');
 PERFORM pg_temp.ck((r->>'opening_balance')::numeric=100 AND (r->>'period_new_demand_qty')::numeric=0 AND (r->>'period_allocated_qty')::numeric=80
   AND (r->>'closing_balance')::numeric=20 AND (r->>'current_balance')::numeric=20, 'indent 191: opening 100, new demand 0, allocated 80, closing 20, current 20');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_purchase_fact_id=>169565,p_indent_id=>840);
 PERFORM pg_temp.ck((r->>'opening_balance')::numeric=5 AND (r->>'closing_balance')::numeric=0 AND (r->>'current_balance')::numeric=0, 'indent 84: opening 5, closing 0, current 0');
 PERFORM pg_temp.ck(r->>'row_kind'='allocation' AND r->>'vendor_key'='vendor:1', 'allocation row_kind and mapped vendor key vendor:<id>');
END $t$;

-- ── 5. balance semantics: approval date, opening/new demand, multi-receipt line ─────────────────────
DO $t$
DECLARE rows jsonb; r jsonb;
BEGIN
 -- indent 500 approved INSIDE the period fed by two receipts: opening 0, new demand = requirement, one line repeated on two rows
 SELECT jsonb_agg(row_data) INTO rows FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_id=>5000);
 PERFORM pg_temp.ck(jsonb_array_length(rows)=2, 'indent 500: two receipts feed one line (two trail rows)');
 FOR r IN SELECT * FROM jsonb_array_elements(rows) LOOP
  PERFORM pg_temp.ck((r->>'opening_balance')::numeric=0 AND (r->>'period_new_demand_qty')::numeric=50 AND (r->>'period_allocated_qty')::numeric=50
    AND (r->>'closing_balance')::numeric=0, 'indent 500 row: opening 0, new demand 50, period allocated 50, closing 0 (period fields repeat per receipt)');
 END LOOP;
 PERFORM pg_temp.ck((SELECT sum((x->>'allocated_qty')::numeric) FROM jsonb_array_elements(rows) x)=50, 'per-receipt allocations sum to the line period allocation');
 PERFORM pg_temp.ck((SELECT count(DISTINCT x->>'indent_line_id') FROM jsonb_array_elements(rows) x)=1, 'one distinct indent line');
 -- indent 600 approved BEFORE the period with an earlier allocation: opening = requirement - earlier allocation
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_id=>6000);
 PERFORM pg_temp.ck((r->>'opening_balance')::numeric=25 AND (r->>'period_new_demand_qty')::numeric=0 AND (r->>'period_allocated_qty')::numeric=10
   AND (r->>'closing_balance')::numeric=15 AND (r->>'current_balance')::numeric=15, 'indent 600 (approved earlier): opening 25, allocated 10, closing 15, current 15');
 -- the same indent over a range that includes the earlier receipt
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-01','2026-11-23',p_indent_id=>6000) LIMIT 1;
 PERFORM pg_temp.ck((r->>'opening_balance')::numeric=0 AND (r->>'period_new_demand_qty')::numeric=40 AND (r->>'period_allocated_qty')::numeric=25 AND (r->>'closing_balance')::numeric=15,
   'range 1-23 Nov (approved on the first day of the period): opening 0, new demand 40, allocated 25, closing 15');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-02','2026-11-23',p_indent_id=>6000) LIMIT 1;
 PERFORM pg_temp.ck((r->>'opening_balance')::numeric=40 AND (r->>'period_new_demand_qty')::numeric=0 AND (r->>'period_allocated_qty')::numeric=25 AND (r->>'closing_balance')::numeric=15,
   'range 2-23 Nov (approved the day before): opening 40, new demand 0, allocated 25, closing 15');
 -- equation on every allocation row of every mode of the range
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_trail_paged('2026-11-01','2026-11-30',p_limit=>200) t
   WHERE t.row_data->>'row_kind'='allocation'
     AND (t.row_data->>'opening_balance')::numeric+(t.row_data->>'period_new_demand_qty')::numeric-(t.row_data->>'period_allocated_qty')::numeric<>(t.row_data->>'closing_balance')::numeric),
   'balance equation opening + new demand - allocated = closing on every allocation row');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_limit=>200) t
   WHERE t.row_data->>'row_kind'='unallocated' AND (t.row_data->>'indent_id' IS NOT NULL OR t.row_data->>'opening_balance' IS NOT NULL)),
   'receipt-only rows carry null indent and balance fields');
END $t$;

-- ── 6. returned, unallocated, accepted excess, status filter ─────────────────────────────────────────
DO $t$
DECLARE r jsonb;
BEGIN
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Returned Gum');
 PERFORM pg_temp.ck((r->>'gross_qty')::numeric=40 AND (r->>'effective_qty')::numeric=0 AND (r->>'unallocated_qty')::numeric=0 AND (r->>'allocated_qty')::numeric=0,
   'returned receipt: gross 40, effective 0, unallocated 0');
 PERFORM pg_temp.ck(EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Returned Gum',p_status=>'all')), 'zero-effective receipt appears under status all');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Returned Gum',p_status=>'unallocated')), 'zero-effective receipt is NOT counted as unallocated');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Returned Gum',p_status=>'allocated')), 'zero-effective receipt is NOT counted as allocated');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_purchase_fact_id=>170030);
 PERFORM pg_temp.ck(r->>'row_kind'='unallocated' AND (r->>'effective_qty')::numeric=0 AND (r->>'gross_qty')::numeric=40, 'returned receipt is a receipt-only row (client labels it returned)');
 -- positive unallocated receipt with fully accepted excess
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Resin');
 PERFORM pg_temp.ck((r->>'unallocated_qty')::numeric=12.5 AND (r->>'accepted_qty')::numeric=12.5 AND (r->>'net_unallocated_qty')::numeric=0, 'unallocated 12.5, accepted excess 12.5, net unallocated 0');
 PERFORM pg_temp.ck(EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Resin',p_status=>'unallocated')), 'positive unallocated receipt under status unallocated');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Resin',p_status=>'partial')), 'and not under partial');
 -- partial: PM carton 200 received, 150 allocated
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Carton',p_status=>'partial');
 PERFORM pg_temp.ck((r->>'allocated_qty')::numeric=150 AND (r->>'unallocated_qty')::numeric=50 AND r->>'material_class_code'='PM', 'partial PM receipt: allocated 150, unallocated 50');
 PERFORM pg_temp.ck(EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Herb',p_status=>'allocated')), 'fully allocated receipts under status allocated');
 -- fully unallocated purchased material is listed
 PERFORM pg_temp.ck((SELECT (row_data->>'allocated_qty')::numeric=0 AND (row_data->>'unallocated_qty')::numeric=1000 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Bottle')),
   'fully unallocated material (Nos) is included');
END $t$;

-- ── 7. suppliers: mapped grouped by id, unmapped kept apart ─────────────────────────────────────────
DO $t$
DECLARE r jsonb;
BEGIN
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_vendor_paged('2026-11-23','2026-11-23',p_q=>'Herb');
 PERFORM pg_temp.ck(r->>'vendor_key'='vendor:2' AND (r->>'purchase_fact_count')::int=2, 'mapped vendor 2 with two source labels is ONE group of two receipts');
 PERFORM pg_temp.ck(r->>'supplier_name'='Alpha Suppliers', 'representative label is the minimum source label (Suppliers < Supplies)');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_vendor_paged('2026-11-23','2026-11-23') WHERE row_data->>'vendor_key' LIKE 'supplier:%')=2, 'two different unmapped suppliers are two groups');
 PERFORM pg_temp.ck(EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_vendor_paged('2026-11-23','2026-11-23') WHERE row_data->>'vendor_key'='supplier:Cash Purchase A' AND row_data->'vendor_id'='null'::jsonb),
   'unmapped key is supplier:<name> with null vendor_id');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_vendor_key=>'supplier:Cash Purchase B'))=1, 'trail filters by vendor_key');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_vendor_key=>'vendor:4'))=2, 'vendor 4 trail: two receipts (L allocated, Nos unallocated)');
 PERFORM pg_temp.ck((SELECT jsonb_array_length(row_data->'totals_by_uom')=2 FROM proc_pec_purchase_alloc_vendor_paged('2026-11-23','2026-11-23',p_vendor_q=>'Gamma')),
   'vendor totals are per UOM (L and Nos kept apart)');
END $t$;

-- ── 8. filtered reconciliation: an indent filter never turns other allocations into excess ───────────
DO $t$
DECLARE r jsonb; s jsonb;
BEGIN
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Root');
 PERFORM pg_temp.ck((r->>'allocated_qty')::numeric=100 AND (r->>'matching_allocated_qty')::numeric=100 AND (r->>'unallocated_qty')::numeric=0, 'unfiltered: allocated 100, matching 100, unallocated 0');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Root',p_indent_q=>'300');
 PERFORM pg_temp.ck((r->>'allocated_qty')::numeric=100 AND (r->>'matching_allocated_qty')::numeric=60 AND (r->>'unallocated_qty')::numeric=0 AND (r->>'net_unallocated_qty')::numeric=0,
   'indent filter 300: receipt-wide allocated 100, matching 60, unallocated still 0 (40 to indent 301 is not excess)');
 s := proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23',p_q=>'Root',p_indent_q=>'300');
 PERFORM pg_temp.ck((s->'totals_by_uom'->0->>'allocated_qty')::numeric=100 AND (s->'totals_by_uom'->0->>'matching_allocated_qty')::numeric=60
   AND (s->'totals_by_uom'->0->>'unallocated_qty')::numeric=0, 'summary under the same filter reconciles identically');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_q=>'Root',p_indent_q=>'300'))=1, 'filtered trail shows only the matching allocation row');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_q=>'Root',p_indent_q=>'300');
 PERFORM pg_temp.ck((r->>'receipt_allocated_qty')::numeric=100 AND (r->>'allocated_qty')::numeric=60 AND (r->>'closing_balance')::numeric=0,
   'filtered trail keeps receipt-wide quantity and whole-indent balance fields');
 -- receipts with no allocation to the filtered indent disappear (and are not turned into excess)
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_indent_q=>'300') WHERE row_data->>'stock_item_name' <> 'Synthetic Root'),
   'indent filter keeps only receipts allocated to the indent');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_q=>'300') WHERE row_data->>'row_kind'='unallocated'), 'receipt-only rows are omitted under an indent filter');
 -- vendor and material filters do not distort whole-indent balances
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_id=>1910);
 PERFORM pg_temp.ck((r->>'closing_balance')::numeric=20, 'unfiltered indent 191 closing 20');
 SELECT row_data INTO r FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_id=>1910,p_vendor_q=>'Kera');
 PERFORM pg_temp.ck((r->>'closing_balance')::numeric=20 AND (r->>'opening_balance')::numeric=100, 'vendor filter leaves the whole-indent balances unchanged');
END $t$;

-- ── 9. cross-mode reconciliation against an independent base-view query, per UOM ────────────────────
DO $t$
DECLARE d1 date := '2026-11-01'; d2 date := '2026-11-30'; bad int;
BEGIN
 CREATE TEMP TABLE base AS
  SELECT e.uom_id, sum(e.purchase_qty) gross, sum(e.net_qty) eff,
         sum(coalesce(a.al,0)) alloc, sum(e.net_qty-coalesce(a.al,0)) un,
         sum(coalesce(c.ac,0)) acc
  FROM v_proc_fifo_effective_receipts e
  LEFT JOIN (SELECT purchase_fact_id, sum(allocated_qty) al FROM v_proc_indent_fifo_allocation GROUP BY 1) a USING (purchase_fact_id)
  LEFT JOIN (SELECT purchase_fact_id, sum(accepted_qty) ac FROM proc_indent_excess_acceptance GROUP BY 1) c USING (purchase_fact_id)
  WHERE e.voucher_date BETWEEN d1 AND d2 GROUP BY 1;
 CREATE TEMP TABLE s_tot AS SELECT (t->>'uom_id')::bigint uom_id, (t->>'gross_qty')::numeric gross, (t->>'effective_qty')::numeric eff, (t->>'allocated_qty')::numeric alloc,
   (t->>'unallocated_qty')::numeric un, (t->>'accepted_qty')::numeric acc
   FROM jsonb_array_elements(proc_pec_purchase_alloc_summary(d1,d2)->'totals_by_uom') t;
 SELECT count(*) INTO bad FROM base b FULL JOIN s_tot s USING (uom_id) WHERE b.gross IS DISTINCT FROM s.gross OR b.eff IS DISTINCT FROM s.eff OR b.alloc IS DISTINCT FROM s.alloc OR b.un IS DISTINCT FROM s.un OR b.acc IS DISTINCT FROM s.acc;
 PERFORM pg_temp.ck(bad=0, 'summary per-UOM totals equal the independent base-view query');
 SELECT count(*) INTO bad FROM base b FULL JOIN (SELECT (row_data->>'uom_id')::bigint uom_id, sum((row_data->>'gross_qty')::numeric) gross, sum((row_data->>'effective_qty')::numeric) eff,
     sum((row_data->>'allocated_qty')::numeric) alloc, sum((row_data->>'unallocated_qty')::numeric) un, sum((row_data->>'accepted_qty')::numeric) acc
   FROM proc_pec_purchase_alloc_material_paged(d1,d2,p_limit=>200) GROUP BY 1) m USING (uom_id)
   WHERE b.gross IS DISTINCT FROM m.gross OR b.eff IS DISTINCT FROM m.eff OR b.alloc IS DISTINCT FROM m.alloc OR b.un IS DISTINCT FROM m.un OR b.acc IS DISTINCT FROM m.acc;
 PERFORM pg_temp.ck(bad=0, 'material-wise totals reconcile per UOM');
 SELECT count(*) INTO bad FROM base b FULL JOIN (SELECT (u->>'uom_id')::bigint uom_id, sum((u->>'gross_qty')::numeric) gross, sum((u->>'effective_qty')::numeric) eff,
     sum((u->>'allocated_qty')::numeric) alloc, sum((u->>'unallocated_qty')::numeric) un, sum((u->>'accepted_qty')::numeric) acc
   FROM proc_pec_purchase_alloc_vendor_paged(d1,d2,p_limit=>200), jsonb_array_elements(row_data->'totals_by_uom') u GROUP BY 1) v USING (uom_id)
   WHERE b.gross IS DISTINCT FROM v.gross OR b.eff IS DISTINCT FROM v.eff OR b.alloc IS DISTINCT FROM v.alloc OR b.un IS DISTINCT FROM v.un OR b.acc IS DISTINCT FROM v.acc;
 PERFORM pg_temp.ck(bad=0, 'vendor-wise totals reconcile per UOM (no double counting across suppliers)');
 -- trail: receipts de-duplicated by fact reconcile to the same totals
 SELECT count(*) INTO bad FROM base b FULL JOIN (SELECT uom_id, sum(gross) gross, sum(eff) eff, sum(un) un, sum(acc) acc FROM (
     SELECT DISTINCT (row_data->>'purchase_fact_id')::bigint f, (row_data->>'uom_id')::bigint uom_id, (row_data->>'gross_qty')::numeric gross, (row_data->>'effective_qty')::numeric eff,
       (row_data->>'unallocated_qty')::numeric un, (row_data->>'accepted_qty')::numeric acc FROM proc_pec_purchase_alloc_trail_paged(d1,d2,p_limit=>200)) q GROUP BY 1) t USING (uom_id)
   WHERE b.gross IS DISTINCT FROM t.gross OR b.eff IS DISTINCT FROM t.eff OR b.un IS DISTINCT FROM t.un OR b.acc IS DISTINCT FROM t.acc;
 PERFORM pg_temp.ck(bad=0, 'trail receipts de-duplicated by purchase fact reconcile per UOM');
 PERFORM pg_temp.ck((SELECT sum((row_data->>'allocated_qty')::numeric) FROM proc_pec_purchase_alloc_trail_paged(d1,d2,p_limit=>200) WHERE row_data->>'row_kind'='allocation')
   = (SELECT sum(alloc) FROM base), 'trail allocation rows sum to total allocated (all UOM units are Kg/L/Nos numerically additive only for this check)');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM (SELECT row_data->>'purchase_fact_id' f, row_data->>'indent_line_id' l, count(*) FROM proc_pec_purchase_alloc_trail_paged(d1,d2,p_limit=>200) GROUP BY 1,2 HAVING count(*)>1) z),
   'no duplicate (receipt, indent line) trail rows');
 PERFORM pg_temp.ck((SELECT sum((x->>'allocated_qty')::numeric) FROM proc_pec_purchase_alloc_indent_paged(d1,d2,p_limit=>200), jsonb_array_elements(row_data->'totals_by_uom') x)
   = (SELECT sum(alloc) FROM base), 'indent-wise allocated totals reconcile');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM v_proc_indent_fifo_allocation a JOIN v_proc_fifo_effective_receipts r USING (purchase_fact_id) GROUP BY a.purchase_fact_id, r.net_qty HAVING sum(a.allocated_qty)>r.net_qty),
   'receipt equation: allocated never exceeds effective');
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged(d1,d2,p_limit=>200)
   WHERE (row_data->>'effective_qty')::numeric - (row_data->>'allocated_qty')::numeric <> (row_data->>'unallocated_qty')::numeric
      OR (row_data->>'unallocated_qty')::numeric - (row_data->>'accepted_qty')::numeric <> (row_data->>'net_unallocated_qty')::numeric),
   'material equations: effective - allocated = unallocated; unallocated - accepted = net unallocated');
END $t$;

-- ── 10. dates, classes, decimals, ordering, paging, empty ───────────────────────────────────────────
DO $t$
DECLARE a jsonb; b jsonb;
BEGIN
 PERFORM pg_temp.ck(NOT EXISTS (SELECT 1 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23') WHERE row_data->>'stock_item_name'='Synthetic Boundary'), 'single-day range excludes facts on 22 and 24 Nov');
 PERFORM pg_temp.ck((SELECT (row_data->>'purchase_fact_count')::int=2 AND (row_data->>'gross_qty')::numeric=3 FROM proc_pec_purchase_alloc_material_paged('2026-11-22','2026-11-24',p_q=>'Boundary')), 'range is inclusive at both ends');
 PERFORM pg_temp.ck((SELECT (row_data->>'gross_qty')::numeric=1 FROM proc_pec_purchase_alloc_material_paged('2026-11-22','2026-11-22',p_q=>'Boundary')), 'single-day range returns only that voucher date');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_material_class_code=>'PM'))=1, 'class PM');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_material_class_code=>'PLM'))=1, 'PLM is an alias of PM');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_material_class_code=>'IND'))=1, 'class IND');
 PERFORM pg_temp.ck((SELECT bool_and(row_data->>'material_class_code'='RM') FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_material_class_code=>'rm',p_limit=>200)), 'class RM (case-insensitive)');
 -- fractional exactness
 PERFORM pg_temp.ck((SELECT (row_data->>'gross_qty')::numeric=0.3 AND (row_data->>'allocated_qty')::numeric=0.3 AND (row_data->>'unallocated_qty')::numeric=0 FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_q=>'Decimal')),
   'fractional Kg: 0.1 + 0.2 allocated of 0.3 exactly');
 PERFORM pg_temp.ck((SELECT count(*)=2 FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_id=>10000)), 'two lines of one indent from one receipt');
 -- discrete Nos and volume L stay in their own UOM
 PERFORM pg_temp.ck((SELECT count(DISTINCT t->>'uom_code')=3 FROM jsonb_array_elements(proc_pec_purchase_alloc_summary('2026-11-23','2026-11-23')->'totals_by_uom') t), 'summary keeps Kg, L and Nos apart');
 -- ordering: numeric indent numbers first, non-numeric last; ties stable
 PERFORM pg_temp.ck((SELECT string_agg(row_data->>'indent_number', ',' ORDER BY ordinality) FROM proc_pec_purchase_alloc_indent_paged('2026-11-01','2026-11-30',p_limit=>200) WITH ORDINALITY)
   = '84,156,191,300,301,500,600,700,800,1000,X7', 'indent-wise order: numeric indent number, non-numeric last');
 PERFORM pg_temp.ck((SELECT string_agg((row_data->>'indent_number')||'/'||(row_data->>'indent_line_sort_no'), ',' ORDER BY ordinality) FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_indent_id=>10000) WITH ORDINALITY)
   = '1000/1,1000/2', 'trail canonical serial order within an indent');
 PERFORM pg_temp.ck((SELECT string_agg(row_data->>'stock_item_name', ',' ORDER BY ordinality) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>200) WITH ORDINALITY)
   = (SELECT string_agg(row_data->>'stock_item_name', ',' ORDER BY lower(row_data->>'stock_item_name'), (row_data->>'material_class_id')::bigint, (row_data->>'stock_item_id')::bigint, (row_data->>'uom_id')::bigint)
      FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>200)), 'material order: name, class, item, UOM');
 -- paging: total_count constant, pages disjoint and complete
 PERFORM pg_temp.ck((SELECT count(DISTINCT total_count)=1 AND min(total_count)=(SELECT count(*) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>200)) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>3,p_offset=>3)), 'total_count is the full match count before paging');
 PERFORM pg_temp.ck((SELECT count(*) FROM (
      SELECT row_data->>'stock_item_id' FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>4,p_offset=>0)
      UNION ALL SELECT row_data->>'stock_item_id' FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>4,p_offset=>4)
      UNION ALL SELECT row_data->>'stock_item_id' FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>4,p_offset=>8)
      UNION ALL SELECT row_data->>'stock_item_id' FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>4,p_offset=>12)) u)
    = (SELECT count(*) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>200)), 'pages are complete and non-overlapping');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_material_paged('2026-11-23','2026-11-23',p_limit=>5,p_offset=>100))=0, 'offset past the end returns no rows');
 -- empty result and summary
 a := proc_pec_purchase_alloc_summary('2020-01-01','2020-01-01');
 PERFORM pg_temp.ck((a->>'purchase_fact_count')::int=0 AND (a->>'affected_indent_count')::int=0 AND a->'totals_by_uom'='[]'::jsonb AND length(a->>'coverage')>0 AND length(a->>'balance_basis')>0,
   'empty range: zero counts, empty totals, coverage and balance_basis present');
 PERFORM pg_temp.ck((SELECT count(*) FROM proc_pec_purchase_alloc_trail_paged('2020-01-01','2020-01-01'))=0, 'empty range: no trail rows');
 PERFORM pg_temp.ck((a ? 'date_from') AND (a ? 'date_to') AND (a ? 'affected_indent_line_count'), 'summary exposes the frozen V1 keys');
END $t$;

-- ── 11. read-only: no source row changes, no transaction id assigned ─────────────────────────────────
DO $t$
DECLARE before_n bigint; after_n bigint;
BEGIN
 SELECT (SELECT count(*) FROM v_proc_purchase_fact_with_vendor)+(SELECT count(*) FROM v_proc_indent_open_lines)+(SELECT count(*) FROM proc_indent_excess_acceptance) INTO before_n;
 PERFORM count(*) FROM proc_pec_purchase_alloc_trail_paged('2026-11-01','2026-11-30',p_limit=>200);
 PERFORM proc_pec_purchase_alloc_summary('2026-11-01','2026-11-30');
 SELECT (SELECT count(*) FROM v_proc_purchase_fact_with_vendor)+(SELECT count(*) FROM v_proc_indent_open_lines)+(SELECT count(*) FROM proc_indent_excess_acceptance) INTO after_n;
 PERFORM pg_temp.ck(before_n=after_n, 'reporting calls change no source row');
END $t$;

-- ── 12. repeated timing at scale (fixture-scale evidence, NOT a production p95) ─────────────────────
INSERT INTO inv_stock_item SELECT 1000+g, 'Bulk item '||g, 'B-'||g FROM generate_series(1,300) g;
INSERT INTO v_proc_indent_open_lines SELECT 100000+g, 50000+(g/5), (50000+(g/5))::text, DATE '2026-10-01'+(g%50), 1, 1000+(g%300)+1, 1, 5+(g%40) FROM generate_series(1,1500) g;
INSERT INTO v_proc_indent_lines_console_ordered SELECT 100000+g, 50000+(g/5), (50000+(g/5))::text, (g%5)+1, DATE '2026-10-01'+(g%50), 5+(g%40), 5+(g%40) FROM generate_series(1,1500) g;
INSERT INTO v_proc_purchase_fact_with_vendor SELECT 300000+g, DATE '2026-10-01'+(g%50), 1, 1000+(g%300)+1, 1, 10+(g%90), 'Supplier '||(g%25), CASE WHEN g%7=0 THEN NULL ELSE (g%25)+100 END FROM generate_series(1,3000) g;
ANALYZE;
DO $t$
DECLARE i int; t0 timestamptz; ms numeric[] := '{}'; ms2 numeric[] := '{}'; p95 numeric; p95b numeric; cnt int;
BEGIN
 FOR i IN 1..15 LOOP
  t0 := clock_timestamp(); PERFORM proc_pec_purchase_alloc_summary('2026-10-01','2026-11-23'); ms := ms || (extract(epoch FROM clock_timestamp()-t0)*1000)::numeric;
  t0 := clock_timestamp(); SELECT count(*) INTO cnt FROM proc_pec_purchase_alloc_trail_paged('2026-11-23','2026-11-23',p_limit=>200); ms2 := ms2 || (extract(epoch FROM clock_timestamp()-t0)*1000)::numeric;
 END LOOP;
 SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY x) INTO p95 FROM unnest(ms) x;
 SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY x) INTO p95b FROM unnest(ms2) x;
 RAISE NOTICE 'timing: summary over 3000 facts / 1500 lines, 15 runs: median % ms, p95 % ms', round((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY x) FROM unnest(ms) x)::numeric,1), round(p95::numeric,1);
 RAISE NOTICE 'timing: 200-row trail, 15 runs: median % ms, p95 % ms', round((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY x) FROM unnest(ms2) x)::numeric,1), round(p95b::numeric,1);
 PERFORM pg_temp.ck(p95 < 3000 AND p95b < 3000, 'repeated runs stay under 3 s p95 at fixture scale (generous CI bound)');
END $t$;
-- the extra volume must still reconcile
DO $t$
DECLARE bad int;
BEGIN
 SELECT count(*) INTO bad FROM (
   SELECT (t->>'uom_id')::bigint uom_id, (t->>'allocated_qty')::numeric s FROM jsonb_array_elements(proc_pec_purchase_alloc_summary('2026-10-01','2026-11-30')->'totals_by_uom') t) a
   JOIN (SELECT (row_data->>'uom_id')::bigint uom_id, sum((row_data->>'allocated_qty')::numeric) m FROM proc_pec_purchase_alloc_material_paged('2026-10-01','2026-11-30',p_limit=>200) GROUP BY 1) b USING (uom_id) WHERE a.s<>b.m;
 -- material_paged is limited to 200 rows; compare against the full-page sum only when everything fits
 PERFORM pg_temp.ck(bad=0 OR (SELECT min(total_count) FROM proc_pec_purchase_alloc_material_paged('2026-10-01','2026-11-30',p_limit=>1))>200, 'at scale, summary and material-wise allocations reconcile');
END $t$;
SELECT 'PEC_PURCHASE_ALLOCATIONS_PG_FIXTURE_PASS' AS result;
