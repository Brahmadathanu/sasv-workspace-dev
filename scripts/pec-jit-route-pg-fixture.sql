\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture for the PEC JIT MRP route (issue #502). NEVER connect this to production.
-- Loads the REAL repository SQL: internal PR creator, S4 hybrid plan/generator/reconcile, then the new migration.
-- Run from the repository root: psql -X -v ON_ERROR_STOP=1 -f scripts/pec-jit-route-pg-fixture.sql
DO $r$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.require_permission(p_target text,p_need_edit boolean) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
 IF current_setting('pec.fixture_access',true) IS NULL OR current_setting('pec.fixture_access',true)='no'
    OR (p_need_edit AND current_setting('pec.fixture_access',true)<>'edit') THEN
   RAISE EXCEPTION 'PEC permission denied' USING ERRCODE='42501'; END IF;
END $fn$;
SET pec.fixture_access='edit';
-- Fixture masters/views (tables stand in for the live views).
CREATE TABLE public.inv_uom(id bigint PRIMARY KEY, code text);
CREATE TABLE public.inv_stock_item(id bigint PRIMARY KEY, name text, active boolean DEFAULT true, default_uom_id bigint, rm_procurement_mode text);
CREATE TABLE public.v_inv_stock_item_with_class(stock_item_id bigint PRIMARY KEY, category_id bigint, active boolean, subcategory_code text);
CREATE TABLE public.v_mrp_procurement_plan(material_class_id bigint, stock_item_id bigint, uom_id bigint, month_start date, procure_qty numeric);
CREATE TABLE public.v_item_consumption_monthly_by_item(inv_stock_item_id bigint, month_start_date date, total_consumed_qty numeric);
CREATE TABLE public.v_stock_current_by_item(inv_stock_item_id bigint, qty_value numeric, source_kind text);
CREATE TABLE public.v_proc_indent_line_balance(material_class_id bigint, stock_item_id bigint, uom_id bigint, remaining_qty numeric);
CREATE TABLE public.inv_stock_item_moq_policy(stock_item_id bigint, uom_id bigint, moq_qty numeric, is_active boolean DEFAULT true, effective_from date, effective_to date);
CREATE TABLE public.tally_rm_stock_snapshot(as_of_date date);
CREATE TABLE public.tally_plm_stock_snapshot(as_of_date date);
CREATE TABLE public.proc_pr_header(pr_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, pr_number text UNIQUE NOT NULL, status text NOT NULL,
 effective_from_date date, horizon_start_month date, horizon_end_month date, material_class_id bigint, generation_filters jsonb, notes text,
 created_by uuid, updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.proc_pr_line(pr_line_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, pr_id bigint NOT NULL REFERENCES public.proc_pr_header(pr_id) ON DELETE CASCADE,
 material_class_id bigint, stock_item_id bigint, uom_id bigint, system_suggested_qty numeric, requested_qty numeric, manual_delta_qty numeric DEFAULT 0, manual_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(pr_id,material_class_id,stock_item_id,uom_id));

SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date) AS m0,
 (date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')+interval '1 month')::date AS m1,
 (date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')+interval '2 month')::date AS m2,
 (date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')+interval '3 month')::date AS m3,
 (now() AT TIME ZONE 'Asia/Kolkata')::date AS today \gset
INSERT INTO inv_uom VALUES (1,'Kg'),(2,'Nos'),(3,'L');
INSERT INTO inv_stock_item(id,name,default_uom_id,rm_procurement_mode) VALUES
 (101,'JIT stockless kg',1,'jit_procured'),(102,'JIT with open indent',1,'jit_procured'),(103,'JIT covered by indent',1,'jit_procured'),
 (104,'JIT nos fractional',2,'jit_procured'),(105,'JIT with MOQ',1,'jit_procured'),(106,'JIT MOQ conflict',1,'jit_procured'),
 (107,'JIT uom mismatch',2,'jit_procured'),(108,'JIT partial horizon',1,'jit_procured'),(109,'JIT consumption only',1,'jit_procured'),
 (110,'JIT negative mrp',1,'jit_procured'),(111,'JIT with genuine stock',1,'jit_procured'),
 (201,'Stock-required RM',1,'stock_required'),(202,'RM mode unset',1,NULL),(301,'PM item',2,NULL),(501,'IND item',2,NULL),
 (401,'JIT internal finished bulk',1,'jit_procured');
INSERT INTO v_inv_stock_item_with_class SELECT id, CASE WHEN id=301 THEN 2 WHEN id=501 THEN 5 ELSE 1 END, true,
 CASE WHEN id=401 THEN 'finished_bulk_material' ELSE 'raw' END FROM inv_stock_item;
-- MRP (stock-netted by the live view): two-month horizon m1..m2.
INSERT INTO v_mrp_procurement_plan(material_class_id,stock_item_id,uom_id,month_start,procure_qty) VALUES
 (1,101,1,:'m1',60),(1,101,1,:'m2',40),(1,102,1,:'m1',50),(1,102,1,:'m2',50),(1,103,1,:'m1',15),(1,103,1,:'m2',15),
 (1,104,2,:'m1',5.1),(1,104,2,:'m2',5.1),(1,105,1,:'m1',50),(1,105,1,:'m2',50),(1,106,1,:'m1',10),(1,106,1,:'m2',10),
 (1,107,1,:'m1',10),(1,107,1,:'m2',10),(1,108,1,:'m1',10),(1,110,1,:'m3',-5),(1,111,1,:'m1',12.5),(1,111,1,:'m2',12.5),
 (1,201,1,:'m1',25),(1,201,1,:'m2',25),(1,202,1,:'m1',10),(1,202,1,:'m2',10),(2,301,2,:'m1',20),(2,301,2,:'m2',20),
 (5,501,2,:'m1',8),(5,501,2,:'m2',7),(1,401,1,:'m1',99),(1,401,1,:'m2',99);
INSERT INTO v_item_consumption_monthly_by_item VALUES
 (101,(:'m0'::date-interval '1 month')::date,120),(109,(:'m0'::date-interval '1 month')::date,1200),
 (201,(:'m0'::date-interval '1 month')::date,600),(301,(:'m0'::date-interval '1 month')::date,240);
INSERT INTO v_stock_current_by_item VALUES (111,500,'rm'),(201,500,'rm'),(202,300,'rm'),(301,1000,'plm');
INSERT INTO tally_rm_stock_snapshot VALUES (:'today'); INSERT INTO tally_plm_stock_snapshot VALUES (:'today');
INSERT INTO v_proc_indent_line_balance VALUES (1,102,1,40),(1,103,1,50);
INSERT INTO inv_stock_item_moq_policy(stock_item_id,uom_id,moq_qty) VALUES (105,1,30),(106,1,20),(106,1,25);

CREATE FUNCTION public.pec_assert(p_ok boolean,p_msg text) RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAILED: %',p_msg; END IF; RAISE NOTICE 'ok: %',p_msg; END $fn$;
-- Load the REAL repository functions.
\! awk '/^-- create_pr_from_mrp_plan_pec_internal/{f=1} /^-- proc_pr_rebuild_from_mrp_pec_internal/{f=0} f' supabase/migrations/20261112114000_pec_uom_and_internal_pr_guard.sql > /tmp/pec_jit_internal_creator.sql
\i /tmp/pec_jit_internal_creator.sql
\i supabase/migrations/20261122082353_pec_s4_new_pr_hybrid_plan.sql
\i supabase/migrations/20261122082532_pec_s4_hybrid_generator_evidence.sql
\i supabase/migrations/20261122082653_pec_s4_reconcile_existing_draft.sql
\i supabase/migrations/20261122084452_pec_s4_duplicate_uom_candidate_guard.sql
\i supabase/migrations/20261122084655_pec_s4_duplicate_pr_horizon_guard.sql
-- Baseline: hybrid plan fingerprints BEFORE the new migration, for every route.
CREATE TABLE public.pec_baseline(label text PRIMARY KEY, h text);
INSERT INTO pec_baseline SELECT s.l, (SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) FROM public.proc_pec_s4_new_pr_plan(:'m1',:'m2',s.c,s.sc) x)
 FROM (VALUES ('normal',NULL::int,'normal'),('rm_normal',1,'normal'),('rm_all',1,'all'),('rm_jit_hybrid',1,'jit'),('pm',2,'normal'),('ind',5,'normal')) s(l,c,sc);
CREATE TABLE public.pec_baseline_pm(h text);
SELECT (x->>'recommended_qty')::numeric AS rec_201 FROM public.proc_pec_s4_new_pr_plan(:'m1',:'m2',1,'normal') x WHERE (x->>'stock_item_id')='201' \gset
SELECT public.pec_assert(:rec_201=50,'baseline RM normal item 201 hybrid recommendation is 50 (MRP-led, stock netted, unchanged)');
SELECT (x->>'gate') AS g101, (x->>'recommended_qty') IS NULL AS r101_null FROM public.proc_pec_s4_new_pr_plan(:'m1',:'m2',1,'jit') x WHERE (x->>'stock_item_id')='101' \gset
SELECT public.pec_assert(:'g101'='STOCK_MAPPING_REVIEW' AND :'r101_null'::boolean,'baseline: stockless JIT item is vetoed by the hybrid stock gate (the policy mismatch)');

\i supabase/migrations/20261122163830_pec_jit_mrp_route_plan_and_generator.sql

-- 1. Hybrid routes are byte-identical after the migration.
SELECT public.pec_assert(NOT EXISTS(SELECT 1 FROM pec_baseline b JOIN (
 SELECT s.l, (SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) FROM public.proc_pec_s4_new_pr_plan(:'m1',:'m2',s.c,s.sc) x) h
 FROM (VALUES ('normal',NULL::int,'normal'),('rm_normal',1,'normal'),('rm_all',1,'all'),('rm_jit_hybrid',1,'jit'),('pm',2,'normal'),('ind',5,'normal')) s(l,c,sc)) a
 ON a.l=b.label WHERE a.h<>b.h),'RM normal, RM all, PM, IND and legacy JIT hybrid plans unchanged after migration (fingerprints)');
CREATE TABLE public.pec_jit_rows AS SELECT x FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',true) x;
CREATE FUNCTION public.pec_j(p_item int,p_key text) RETURNS text LANGUAGE sql AS $$ SELECT x->>p_key FROM public.pec_jit_rows WHERE x->>'stock_item_id'=p_item::text $$;
-- 2. JIT plan content.
SELECT public.pec_assert((SELECT count(*) FROM pec_jit_rows)=9,'JIT plan has exactly the 9 JIT MRP items in the horizon (101-108 and 111)');
SELECT public.pec_assert(pec_j(101,'gate')='AUTO_ELIGIBLE' AND pec_j(101,'recommended_qty')::numeric=100,'stockless JIT with MRP>0 is AUTO_ELIGIBLE at the MRP quantity (missing stock no longer vetoes)');
SELECT public.pec_assert(pec_j(111,'recommended_qty')::numeric=25 AND pec_j(111,'stock_netting')='mrp_view_opening_qty','genuine stock is not deducted twice (MRP view already stock-netted)');
SELECT public.pec_assert(pec_j(102,'recommended_qty')::numeric=60,'existing open indent 40 netted once from MRP 100 => 60');
SELECT public.pec_assert(pec_j(103,'recommended_qty')::numeric=0,'open indent covering MRP => 0, never negative');
SELECT public.pec_assert(pec_j(104,'recommended_qty')::numeric=11,'indivisible Nos rounded up once (10.2 => 11)');
SELECT public.pec_assert(pec_j(105,'recommended_qty')::numeric=120,'governed MOQ applied once (100 with MOQ 30 => 120)');
SELECT public.pec_assert(pec_j(106,'gate')='MOQ_POLICY_REVIEW' AND pec_j(106,'recommended_qty') IS NULL,'conflicting MOQ policies remain flagged, no automatic quantity');
SELECT public.pec_assert(pec_j(107,'gate')='UOM_REVIEW' AND pec_j(107,'recommended_qty') IS NULL,'UOM mismatch remains flagged');
SELECT public.pec_assert(pec_j(108,'gate')='MRP_HORIZON_REVIEW','partial MRP horizon remains flagged');
SELECT public.pec_assert(pec_j(109,'gate') IS NULL AND pec_j(401,'gate') IS NULL AND pec_j(201,'gate') IS NULL AND pec_j(202,'gate') IS NULL AND pec_j(301,'gate') IS NULL AND pec_j(501,'gate') IS NULL,
 'consumption-only JIT item, internal finished-bulk, stock-required, unset-mode, PM and IND items are never in the JIT plan');
SELECT public.pec_assert((SELECT bool_and(x->>'mode'='jit_mrp') FROM pec_jit_rows),'every JIT row is labelled mode=jit_mrp');
SELECT public.pec_assert((SELECT x->>'gate' FROM public.proc_pec_jit_mrp_plan(:'m3',:'m3',true) x WHERE x->>'stock_item_id'='110')='MRP_QUANTITY_REVIEW','negative MRP quantity is flagged');
SELECT public.pec_assert((SELECT (x->>'gate')||'/'||coalesce(x->>'consumption_only','') FROM public.proc_pec_s4_new_pr_plan(:'m1',:'m2',1,'jit') x WHERE x->>'stock_item_id'='109')='STOCK_MAPPING_REVIEW/true','legacy hybrid still lists the consumption-only JIT item (only as review; not created by the JIT route)');
-- 3. Consumption comparison is optional and informational.
SELECT public.pec_assert((SELECT (x->>'usage_12m')::numeric FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',true) x WHERE x->>'stock_item_id'='101')=120,'comparison on: 12-month usage reported');
SELECT public.pec_assert((SELECT x->>'usage_12m' FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',false) x WHERE x->>'stock_item_id'='101') IS NULL,'comparison off: no consumption fields');
SELECT public.pec_assert((SELECT md5(string_agg((x->>'stock_item_id')||':'||coalesce(x->>'recommended_qty','n'),',' ORDER BY x->>'stock_item_id')) FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',true) x)
 =(SELECT md5(string_agg((x->>'stock_item_id')||':'||coalesce(x->>'recommended_qty','n'),',' ORDER BY x->>'stock_item_id')) FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',false) x),'comparison never changes any recommended quantity');
-- 4. ACL.
SELECT public.pec_assert(NOT has_function_privilege('anon','public.proc_pec_jit_mrp_plan(date,date,boolean)','EXECUTE')
 AND NOT has_function_privilege('anon','public.proc_pec_jit_generate_pr(text,date,date,date,jsonb,text,boolean,boolean)','EXECUTE')
 AND has_function_privilege('authenticated','public.proc_pec_jit_mrp_plan(date,date,boolean)','EXECUTE')
 AND has_function_privilege('authenticated','public.proc_pec_jit_generate_pr(text,date,date,date,jsonb,text,boolean,boolean)','EXECUTE'),'ACL: anon denied, authenticated allowed');
SELECT public.pec_assert(NOT has_table_privilege('authenticated','public.proc_pr_ccf_generation_evidence','INSERT'),'authenticated has no direct evidence-table write privilege');
-- 5. Authorization and input failures write nothing.
CREATE FUNCTION public.pec_expect(p_sql text,p_state text,p_like text DEFAULT '%') RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE s text; m text; BEGIN
 BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS s=RETURNED_SQLSTATE,m=MESSAGE_TEXT; END;
 IF s IS DISTINCT FROM p_state OR m NOT LIKE p_like THEN RAISE EXCEPTION 'EXPECTED % like % got % (%)',p_state,p_like,coalesce(s,'SUCCESS'),m; END IF;
 RAISE NOTICE 'ok: denied % (%)',s,left(m,60); END $fn$;
SELECT count(*) AS hdr0 FROM proc_pr_header \gset
SET ROLE authenticated;
SET pec.fixture_access='view';
SELECT public.pec_assert((SELECT count(*) FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',true))=9,'View-only can read the JIT plan');
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-V',%L,%L,%L,'{"rm_scope":"jit"}',NULL,true,true)$q$,:'today',:'m1',:'m2'),'42501','PEC permission denied');
SET pec.fixture_access='no';
SELECT public.pec_expect(format($q$SELECT * FROM public.proc_pec_jit_mrp_plan(%L,%L,true)$q$,:'m1',:'m2'),'42501','PEC permission denied');
SET pec.fixture_access='edit';
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-X',%L,%L,%L,'{"rm_scope":"jit"}',NULL,true,false)$q$,:'today',:'m1',:'m2'),'P0001','JIT generation confirmation required');
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('P',%L,%L,%L,'{"rm_scope":"jit"}',NULL,true,true)$q$,:'today',:'m1',:'m2'),'P0001','PR number required');
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-X',%L,%L,%L,'{"rm_scope":"normal"}',NULL,true,true)$q$,:'today',:'m1',:'m2'),'P0001','JIT generator only accepts%');
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-X',%L,%L,%L,'{"rm_scope":"all"}',NULL,true,true)$q$,:'today',:'m1',:'m2'),'P0001','JIT generator only accepts%');
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-X',%L,%L,%L,'{}',NULL,true,true)$q$,:'today','2020-01-01',:'m2'),'P0001','Invalid JIT horizon');
RESET ROLE;
SELECT public.pec_assert((SELECT count(*) FROM proc_pr_header)=:hdr0 AND (SELECT count(*) FROM proc_pr_line)=0,'denied/invalid calls wrote no header or line');
-- 6. Editor generates one JIT draft PR end to end.
SET ROLE authenticated; SET pec.fixture_access='edit';
SELECT (public.proc_pec_jit_generate_pr('PR-JIT-1',:'today',:'m1',:'m2','{"rm_scope":"jit","source":"client-claim","s4_mode":"forged"}','jit note',true,true)) AS r \gset
RESET ROLE;
SELECT (:'r'::jsonb->>'pr_id')::bigint AS pr1 \gset
SELECT public.pec_assert((:'r'::jsonb->>'mode')='jit_mrp' AND (:'r'::jsonb->>'total_candidates')::int=9 AND (:'r'::jsonb->>'auto_evidenced_lines')::int=6 AND (:'r'::jsonb->>'review_required_lines')::int=3 AND (:'r'::jsonb->>'consumption_only_lines')::int=0,'receipt: 9 candidates, 6 auto, 3 review, 0 consumption-only');
SELECT public.pec_assert((SELECT generation_filters->>'s4_mode' FROM proc_pr_header WHERE pr_id=:pr1)='jit_mrp' AND (SELECT generation_filters->>'source' FROM proc_pr_header WHERE pr_id=:pr1)='jit_mrp' AND (SELECT generation_filters->>'rm_scope' FROM proc_pr_header WHERE pr_id=:pr1)='jit' AND (SELECT status FROM proc_pr_header WHERE pr_id=:pr1)='draft' AND (SELECT material_class_id FROM proc_pr_header WHERE pr_id=:pr1)=1,'server overrides forged filter claims; header is draft/RM/jit_mrp');
SELECT public.pec_assert((SELECT count(*) FROM proc_pr_line WHERE pr_id=:pr1)=9 AND NOT EXISTS(SELECT 1 FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id IN(109,201,202,301,501,401,110)),'lines are exactly the JIT MRP items (no consumption-only, no other route)');
SELECT public.pec_assert((SELECT requested_qty FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id=101)=100 AND (SELECT requested_qty FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id=102)=60
 AND (SELECT requested_qty FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id=105)=120 AND (SELECT requested_qty FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id=104)=11,'auto lines carry the evidenced recommendation');
SELECT public.pec_assert((SELECT requested_qty FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id=106)=20 AND (SELECT requested_qty FROM proc_pr_line WHERE pr_id=:pr1 AND stock_item_id=107)=20,'review-required lines keep the MRP quantity unchanged');
SELECT public.pec_assert((SELECT count(*) FROM proc_pr_ccf_generation_evidence WHERE pr_id=:pr1)=9 AND (SELECT bool_and(evidence->>'mode'='jit_mrp') FROM proc_pr_ccf_generation_evidence WHERE pr_id=:pr1)
 AND (SELECT baseline_mrp_qty FROM proc_pr_ccf_generation_evidence WHERE pr_id=:pr1 AND stock_item_id=102)=100 AND (SELECT (evidence->>'outstanding_indent_qty')::numeric FROM proc_pr_ccf_generation_evidence WHERE pr_id=:pr1 AND stock_item_id=102)=40,'frozen evidence: mode=jit_mrp, source MRP and indent commitments recorded');
-- 7. Duplicate horizon / overlap rules.
SET ROLE authenticated; SET pec.fixture_access='edit';
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-DUP',%L,%L,%L,'{"rm_scope":"jit"}',NULL,true,true)$q$,:'today',:'m1',:'m2'),'P0001','An active or draft PR already exists%');
SELECT public.pec_expect(format($q$SELECT public.proc_pec_s4_generate_pr('PR-HYB-DUP',%L,%L,%L,1,'{"rm_scope":"all"}',NULL,true)$q$,:'today',:'m1',:'m2'),'P0001','An active or draft PR already exists%');
RESET ROLE;
INSERT INTO proc_pr_header(pr_number,status,horizon_start_month,horizon_end_month,material_class_id,generation_filters) VALUES ('PR-ALL-M3','draft',:'m3',:'m3',1,'{"rm_scope":"all"}');
INSERT INTO proc_pr_header(pr_number,status,horizon_start_month,horizon_end_month,material_class_id,generation_filters) VALUES ('PR-NORMAL-M2','draft',:'m2',:'m2',1,'{"rm_scope":"normal"}');
SET ROLE authenticated; SET pec.fixture_access='edit';
SELECT public.pec_expect(format($q$SELECT public.proc_pec_jit_generate_pr('PR-JIT-M3',%L,%L,%L,'{"rm_scope":"jit"}',NULL,true,true)$q$,:'today',:'m3',:'m3'),'P0001','An active or draft PR already exists%');
SELECT public.proc_pec_jit_generate_pr('PR-JIT-M2',:'today',:'m2',:'m2','{"rm_scope":"jit"}',NULL,false,true) AS r2 \gset
RESET ROLE;
SELECT public.pec_assert((:'r2'::jsonb->>'mode')='jit_mrp','a different-scope PR (RM Normal) for the same month does not block a JIT PR');
SELECT public.pec_assert((SELECT generation_filters->>'jit_consumption_comparison' FROM proc_pr_header WHERE pr_number='PR-JIT-M2')='false' AND (SELECT generation_filters->>'jit_consumption_comparison' FROM proc_pr_header WHERE pr_id=:pr1)='true','comparison choice is recorded on the PR');
-- 8. Reconciliation / rebuild of a JIT PR is blocked by the frozen evidence rule.
SELECT updated_at AS up1 FROM proc_pr_header WHERE pr_id=:pr1 \gset
SET ROLE authenticated; SET pec.fixture_access='edit';
SELECT public.pec_expect(format($q$SELECT public.proc_pec_s4_reconcile_draft(%s,%L,'Reconcile untouched draft lines with updated requirements',true)$q$,:pr1,:'up1'),'P0001','S4 evidence already recorded%');
RESET ROLE;
SELECT public.pec_assert((SELECT count(*) FROM proc_pr_line WHERE pr_id=:pr1)=9,'reconcile attempt left the JIT PR unchanged');
-- 9. Hybrid generator remains independent: RM normal PR via the existing writer still works.
SET ROLE authenticated; SET pec.fixture_access='edit';
SELECT public.proc_pec_s4_generate_pr('PR-NORM-1',:'today',:'m1',:'m2',2,'{}',NULL,true) AS rh \gset
RESET ROLE;
SELECT public.pec_assert((:'rh'::jsonb->>'mode')='hybrid_mrp_ccf' AND (SELECT generation_filters->>'s4_mode' FROM proc_pr_header WHERE pr_id=(:'rh'::jsonb->>'pr_id')::bigint)='12_calendar_months','PM hybrid generation unchanged (hybrid_mrp_ccf)');
-- 10. Registered production timeout hotfix: materialize approved indent balances once.
-- Full planned JSON output must match the pre-hotfix contract with comparison ON and OFF.
CREATE TABLE public.pec_hotfix_before AS
 SELECT 'true'::text choice, x FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',true) x
 UNION ALL SELECT 'false', x FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',false) x;
\i supabase/migrations/20261122174517_pec_jit_plan_indent_balance_once_timeout_fix.sql
CREATE TABLE public.pec_hotfix_after AS
 SELECT 'true'::text choice, x FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',true) x
 UNION ALL SELECT 'false', x FROM public.proc_pec_jit_mrp_plan(:'m1',:'m2',false) x;
SELECT public.pec_assert(
 (SELECT md5(string_agg(choice||':'||x::text, '|' ORDER BY choice,x::text)) FROM pec_hotfix_before) =
 (SELECT md5(string_agg(choice||':'||x::text, '|' ORDER BY choice,x::text)) FROM pec_hotfix_after),
 'JIT timeout hotfix preserves every plan field, quantity and review decision for both comparison modes');
SELECT public.pec_assert(
 (SELECT count(*) FROM pec_hotfix_before)=(SELECT count(*) FROM pec_hotfix_after),
 'JIT timeout hotfix does not add or remove planning candidates');
SELECT public.pec_assert(
 (SELECT count(*) FROM proc_pr_header WHERE pr_number='PR-JIT-1')=1,
 'JIT read-only planner hotfix leaves the generated fixture PR unchanged');
SELECT 'PEC_JIT_ROUTE_PG_FIXTURE_PASS' AS result;
