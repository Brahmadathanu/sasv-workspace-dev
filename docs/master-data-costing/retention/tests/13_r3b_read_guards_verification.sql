\i lib.sql
-- Stubs of the PUBLIC exact-run readers named in the reviewed manifest (security definer, permission first), plus one CRLF-bodied
-- function (live bodies can carry CRLF) and one with two consecutive permission checks. Resolvers are the REAL migration text.
DO $o$ DECLARE m record; body text; sig text; args text;
BEGIN
 FOR m IN VALUES ('rpc_get_exact_run_cost_pool_reconciliation'),('rpc_get_production_route_manager_exact_run_readiness'),('rpc_get_production_route_manager_workload_detail'),
   ('rpc_get_production_route_manager_workload_preview'),('rpc_get_production_route_pipeline_status'),('rpc_get_route_family_foundation_review'),('rpc_get_route_family_mapping_review_candidates'),
   ('rpc_get_route_workload_management_explain'),('rpc_get_regional_marketing_evidence_review_queue'),('rpc_preview_direct_labour_shadow_monetary_reconciliation'),
   ('rpc_preview_direct_labour_shadow_workload'),('rpc_preview_production_overhead_workload'),('rpc_preview_shared_standard_batch_route_foundation'),
   ('rpc_get_route_family_onboarding_status'),('rpc_get_product_sku_readiness') LOOP
  body:=E'\nBEGIN\n  PERFORM public.require_permission(''module:costing-control-center'', false);\n'
     ||CASE WHEN m.column1='rpc_get_production_route_pipeline_status' THEN E'  PERFORM public.require_permission(''role:second-gate'', false);\n' ELSE '' END
     ||E'  RETURN jsonb_build_object(''rows'',(SELECT count(*) FROM costing.v_sku_detailed_cost_sheet WHERE refresh_run_id=p_refresh_run_id));\nEND;\n';
  IF m.column1='rpc_get_route_workload_management_explain' THEN body:=replace(body,E'\n',E'\r\n'); END IF;
  EXECUTE format('CREATE FUNCTION public.%I(p_period_start date,p_valuation_date date,p_refresh_run_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,costing AS $f$%s$f$',m.column1,body);
  EXECUTE format('REVOKE ALL ON FUNCTION public.%I(date,date,bigint) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.%I(date,date,bigint) TO authenticated',m.column1,m.column1);
 END LOOP;
END $o$;
INSERT INTO public.user_permissions_canonical VALUES ('00000000-0000-0000-0000-000000000001','role:second-gate',true,false),('00000000-0000-0000-0000-000000000002','role:second-gate',true,false);
-- the live period-status view as it is BEFORE R3B (baseline for column/row preservation)
CREATE TABLE t.ps_before AS SELECT * FROM costing.v_costing_period_run_status;
CREATE TABLE t.ps_cols AS SELECT attname,format_type(atttypid,atttypmod) typ,attnum FROM pg_attribute WHERE attrelid='costing.v_costing_period_run_status'::regclass AND attnum>0 AND NOT attisdropped;
DO $$ BEGIN ASSERT (SELECT newer_draft_run_id FROM t.ps_before WHERE period_start='2026-09-01')=150,'precondition: stale newer draft 150 (purged in R3 test) is still offered'; END $$;
\i ../candidates/R3B_exact_run_read_guards_and_verification.sql

-- installer is fail-closed
DO $$ BEGIN
 PERFORM t.fails($q$SELECT * FROM costing_retention.install_read_guards()$q$,'no reviewed md5 pin');
 PERFORM t.fails($q$UPDATE costing_retention.read_guard_manifest SET expected_md5='00000000000000000000000000000000' WHERE status='INSTALL'; SELECT * FROM costing_retention.install_read_guards()$q$,'drifted from the reviewed pin');
 PERFORM t.fails($q$CREATE FUNCTION public.rpc_get_exact_run_cost_pool_reconciliation(p_refresh_run_id bigint,p_x int) RETURNS int LANGUAGE sql AS 'select 1'; SELECT * FROM costing_retention.install_read_guards(true)$q$,'overload|ambiguous');
 PERFORM t.fails($q$CREATE FUNCTION public.t_inv(p_refresh_run_id bigint) RETURNS int LANGUAGE plpgsql AS $z$ BEGIN RETURN 1; END $z$; INSERT INTO costing_retention.read_guard_manifest VALUES('public','t_inv','p_refresh_run_id','AFTER_BEGIN','INSTALL','invoker'); SELECT * FROM costing_retention.install_read_guards(true)$q$,'SECURITY INVOKER');
 PERFORM t.fails($q$CREATE FUNCTION public.t_sql(p_refresh_run_id bigint) RETURNS int LANGUAGE sql SECURITY DEFINER AS 'select 1'; INSERT INTO costing_retention.read_guard_manifest VALUES('public','t_sql','p_refresh_run_id','AFTER_BEGIN','INSTALL','sql'); SELECT * FROM costing_retention.install_read_guards(true)$q$,'not plpgsql');
 PERFORM t.fails($q$CREATE FUNCTION public.t_noperm(p_refresh_run_id bigint) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $z$ BEGIN RETURN 1; END $z$; INSERT INTO costing_retention.read_guard_manifest VALUES('public','t_noperm','p_refresh_run_id','AFTER_PERMISSIONS','INSTALL','noperm'); SELECT * FROM costing_retention.install_read_guards(true)$q$,'permission anchor not found');
 PERFORM t.fails($q$INSERT INTO costing_retention.read_guard_manifest VALUES('public','t_missing','p_refresh_run_id','AFTER_BEGIN','INSTALL','missing'); SELECT * FROM costing_retention.install_read_guards(true)$q$,'ambiguous or missing');
END $$;
CREATE TABLE t.before_md5 AS SELECT p.proname,md5(pg_get_functiondef(p.oid)) m,p.prosecdef sd,p.proowner,p.proacl::text acl FROM pg_proc p JOIN costing_retention.read_guard_manifest g ON g.function_name=p.proname AND g.status='INSTALL';
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM costing_retention.install_read_guards(true) WHERE outcome='INSTALLED';
 ASSERT n=16,'sixteen reviewed signatures installed, got '||n;
 ASSERT (SELECT count(*) FROM costing_retention.install_read_guards(true) WHERE outcome='ALREADY_GUARDED')=16,'idempotent';
 ASSERT (SELECT count(*) FROM costing_retention.read_guard_receipt)=16,'one append-only receipt per install';
 -- grants, owner, security mode preserved; deferred rows untouched
 ASSERT NOT EXISTS (SELECT 1 FROM t.before_md5 b JOIN pg_proc p ON p.proname=b.proname WHERE p.prosecdef<>b.sd OR p.proowner<>b.proowner OR p.proacl::text IS DISTINCT FROM b.acl),'grants/owner/secdef preserved';
 ASSERT position('fn_assert_run_details_not_purged' IN pg_get_functiondef('public.rpc_get_route_family_onboarding_status(date,date,bigint)'::regprocedure))=0,'deferred function untouched';
 ASSERT position('fn_assert_run_details_not_purged' IN pg_get_functiondef('public.rpc_get_product_sku_readiness(date,date,bigint)'::regprocedure))=0,'deferred function untouched';
 -- the guard sits AFTER the permission statement(s), including the two-gate and CRLF cases
 ASSERT pg_get_functiondef('public.rpc_get_production_route_pipeline_status(date,date,bigint)'::regprocedure) ~ 'second-gate[^;]*;\s*IF p_refresh_run_id IS NOT NULL THEN PERFORM costing.fn_assert_run_details_not_purged','guard after BOTH permission checks';
 ASSERT pg_get_functiondef('public.rpc_get_route_workload_management_explain(date,date,bigint)'::regprocedure) ~ 'require_permission[^;]*;\s*IF p_refresh_run_id IS NOT NULL THEN PERFORM costing.fn_assert_run_details_not_purged','CRLF-bodied function patched';
 ASSERT pg_get_functiondef('costing.fn_resolve_qc_explain_selected_run(date,date,bigint)'::regprocedure) ~* 'BEGIN\s+IF p_refresh_run_id IS NOT NULL THEN PERFORM costing.fn_assert_run_details_not_purged','real resolver guarded at body start';
END $$;

-- behaviour through real roles: no existence/state leak before the permission check, explicit error for purged, null/default context unchanged
SELECT t.as_user('00000000-0000-0000-0000-000000000002');
SET ROLE authenticated;
DO $$ BEGIN
 PERFORM t.fails($q$SELECT public.rpc_get_exact_run_cost_pool_reconciliation('2026-09-01','2026-09-10',150)$q$,'RUN_DETAILS_UNAVAILABLE.*DETAILS_PURGED');
 ASSERT (public.rpc_get_exact_run_cost_pool_reconciliation('2026-09-01','2026-09-20',122)->>'rows')::int=0,'available legacy approved run 122 still readable (unverified backfill preserved)';
 ASSERT (public.rpc_get_exact_run_cost_pool_reconciliation('2026-09-01',NULL,NULL)->>'rows')::int=0,'null context passes the guard untouched';
 PERFORM t.fails($q$SELECT public.rpc_get_production_route_pipeline_status('2026-09-01','2026-09-10',150)$q$,'RUN_DETAILS_UNAVAILABLE');
 PERFORM t.fails($q$SELECT public.rpc_get_route_workload_management_explain('2026-09-01','2026-09-10',150)$q$,'RUN_DETAILS_UNAVAILABLE');
 -- real resolvers (internal, API roles revoked) are exercised through a definer wrapper to prove default and exact branches
END $$;
RESET ROLE;
SELECT t.as_user('00000000-0000-0000-0000-000000000099');
SET ROLE authenticated;
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_get_exact_run_cost_pool_reconciliation('2026-09-01','2026-09-10',150)$q$,'permission denied'); END $$;   -- not RUN_DETAILS_UNAVAILABLE: no state leak
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_get_exact_run_cost_pool_reconciliation('2026-09-01','2026-09-10',150)$q$,'permission denied'); END $$;
RESET ROLE;
DO $$ BEGIN
 PERFORM t.fails($q$SELECT * FROM costing.fn_resolve_qc_explain_selected_run('2026-09-01','2026-09-10',150)$q$,'RUN_DETAILS_UNAVAILABLE.*DETAILS_PURGED');
 PERFORM t.fails($q$SELECT * FROM costing.fn_resolve_material_trace_selected_run('2026-09-01','2026-09-10',150)$q$,'RUN_DETAILS_UNAVAILABLE');
 PERFORM t.fails($q$SELECT * FROM costing.fn_resolve_materials_stores_explain_selected_run('2026-09-01','2026-09-10',150)$q$,'RUN_DETAILS_UNAVAILABLE');
 ASSERT (SELECT refresh_run_id FROM costing.fn_resolve_qc_explain_selected_run('2026-09-01',NULL,NULL))=122,'default context resolves to the approved pointer (unchanged semantics)';
 ASSERT (SELECT refresh_run_id FROM costing.fn_resolve_material_trace_selected_run('2026-09-01','2026-09-20',122))=122,'exact available run resolves';
 PERFORM t.fails($q$SELECT * FROM costing.fn_resolve_qc_explain_selected_run('2026-09-01','2026-09-20',NULL)$q$,'requires both|exact-run identity');   -- original validation preserved
 -- run in progress / failed: not blocked by the READ guard (original contract decides)
 PERFORM t.fails($q$SELECT * FROM costing.fn_resolve_qc_explain_selected_run('2026-11-01','2026-11-25',154)$q$,'No governed successful costing refresh run');
END $$;

-- verification: evidence-based, bounded, never status-only
INSERT INTO costing.v_sku_detailed_cost_sheet_t VALUES(153,1,'READY'),(213,1,'READY');
DO $$ DECLARE j jsonb; BEGIN
 j:=costing_retention.fn_verify_run_details(152,true);
 ASSERT (j->>'verified')='false' AND j->>'reason' LIKE 'NO_FINGERPRINT_EVIDENCE%','SUCCESS status alone does not verify: '||j::text;
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=152)='DETAILS_UNVERIFIED','state unchanged';
 ASSERT (SELECT last_blocker FROM costing.costing_run_retention_ledger WHERE refresh_run_id=152) LIKE 'VERIFY_FAILED: NO_FINGERPRINT%','blocker recorded';
 INSERT INTO costing.costing_run_fingerprint(refresh_run_id,purpose,captured_by,fingerprint) VALUES(152,'RUN_SUCCESS','fixture','{}'),(153,'RUN_SUCCESS','fixture','{}');
 INSERT INTO costing.fp_stub VALUES(152,'t1',true),(152,'t2',true),(153,'t1',true),(153,'t2',false);
 j:=costing_retention.fn_verify_run_details(153,true);
 ASSERT (j->>'verified')='false' AND j->>'reason' LIKE 'FINGERPRINT_DRIFT%','drift refuses: '||j::text;
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=153)='DETAILS_UNVERIFIED','drifted run stays unverified';
 INSERT INTO costing.costing_run_fingerprint(refresh_run_id,purpose,captured_by,fingerprint) VALUES(148,'RUN_SUCCESS','fixture','{}');
 INSERT INTO costing.fp_stub VALUES(148,'t1',true);
 j:=costing_retention.fn_verify_run_details(148,false);
 ASSERT (j->>'verified')='false' AND j->>'reason' LIKE 'cost sheet has no rows%','captured + matching fingerprint but an empty cost sheet refuses: '||j::text;
 j:=costing_retention.fn_verify_run_details(152,false);
 ASSERT (j->>'verified')='true' AND (j->>'marked')='false','p_mark=false proves without changing state';
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=152)='DETAILS_UNVERIFIED','no mutation on dry check';
 j:=costing_retention.fn_verify_run_details(152,true);
 ASSERT (j->>'verified')='true','evidence verifies';
 ASSERT (SELECT (detail_state,detail_verification_evidence->>'tables_compared',detail_verified_at IS NOT NULL) FROM costing.costing_run_retention_ledger WHERE refresh_run_id=152)=('DETAILS_AVAILABLE'::text,'2'::text,true),'ledger holds evidence';
 ASSERT (costing_retention.fn_verify_run_details(152,true)->>'already')='true','idempotent';
 ASSERT (costing_retention.fn_verify_run_details(149,true)->>'verified')='false','failed run cannot be verified';
 ASSERT (costing_retention.fn_verify_run_details(154,true)->>'verified')='false','running run cannot be verified';
 ASSERT (costing_retention.fn_verify_run_details(150,true)->>'verified')='false','purged run cannot be verified';
 ASSERT (costing_retention.fn_verify_run_details(99999,true)->>'verified')='false','unknown run';
 ASSERT (SELECT state FROM costing_retention.fn_run_detail_availability(152))='AVAILABLE' AND (SELECT state FROM costing_retention.fn_run_detail_availability(153))='AVAILABLE_UNVERIFIED','verified vs unverified are distinguishable to every consumer';
END $$;
SELECT t.as_user('00000000-0000-0000-0000-000000000002'); SET ROLE authenticated;
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_costing_verify_run_details(153)$q$,'permission denied'); END $$;   -- view-only user
RESET ROLE; SELECT t.as_user('00000000-0000-0000-0000-000000000099'); SET ROLE authenticated;
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_costing_verify_run_details(153)$q$,'permission denied'); END $$;
RESET ROLE; SET ROLE anon;
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_costing_verify_run_details(153)$q$,'permission denied'); PERFORM t.fails($q$SELECT costing_retention.fn_verify_run_details(153,true)$q$,'permission denied'); END $$;
RESET ROLE;
SELECT t.as_user('00000000-0000-0000-0000-000000000001'); SET ROLE authenticated;
DO $$ BEGIN ASSERT (public.rpc_costing_verify_run_details(152)->>'already')='true','editor can call the governed RPC'; END $$;
RESET ROLE;

-- approval gate: new approvals need verified evidence; legacy approved runs are untouched
DO $$ DECLARE c jsonb; BEGIN
 c:=costing.fn_w2_run_checks(152,'APPROVE');
 ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(c->'checks') x WHERE x->>'code'='DETAILS_VERIFIED' AND (x->>'pass')::boolean),'verified run passes the gate';
 c:=costing.fn_w2_run_checks(153,'APPROVE');
 ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(c->'checks') x WHERE x->>'code'='DETAILS_VERIFIED' AND NOT (x->>'pass')::boolean AND x->>'detail' LIKE 'AVAILABLE_UNVERIFIED%'),'unverified run fails the gate with an explicit reason';
 ASSERT NOT (c->>'ok')::boolean,'approval of an unverified run is refused';
 ASSERT (SELECT approved_run_id FROM costing.v_costing_period_run_status WHERE period_start='2026-10-01')=143 AND (SELECT approved_run_id FROM costing.v_costing_period_run_status WHERE period_start='2026-09-01')=122,'legacy active approved pricing runs unchanged and still selected while UNVERIFIED';
END $$;

-- period status: stale newer draft fixed, nothing else changes
DO $$ BEGIN
 ASSERT (SELECT newer_draft_run_id FROM costing.v_costing_period_run_status WHERE period_start='2026-09-01') IS NULL,'purged draft 150 no longer offered as newer draft';
 ASSERT (SELECT display_state FROM costing.v_costing_period_run_status WHERE period_start='2026-09-01')='APPROVED','label state follows';
 ASSERT (SELECT display_label FROM costing.v_costing_period_run_status WHERE period_start='2026-09-01') NOT LIKE '%newer DRAFT%','label no longer names a purged draft';
 ASSERT (SELECT newer_draft_run_id FROM costing.v_costing_period_run_status WHERE period_start='2026-10-01')=148,'available newer draft still offered';
 ASSERT (SELECT array_agg(attname||':'||typ ORDER BY attnum) FROM pg_attribute a JOIN LATERAL (SELECT format_type(a.atttypid,a.atttypmod) typ) q ON true WHERE attrelid='costing.v_costing_period_run_status'::regclass AND attnum>0 AND NOT attisdropped)
      =(SELECT array_agg(attname||':'||typ ORDER BY attnum) FROM t.ps_cols),'every (extended) column preserved, same order and types';
 ASSERT NOT EXISTS (SELECT 1 FROM (SELECT period_start,displayed_run_id,displayed_run_basis,approved_run_id,latest_success_run_id,active_run_id FROM costing.v_costing_period_run_status) a
   JOIN (SELECT period_start,displayed_run_id,displayed_run_basis,approved_run_id,latest_success_run_id,active_run_id FROM t.ps_before) b USING(period_start)
   WHERE a IS DISTINCT FROM b),'selection rank, pointer and pricing authority columns identical';
END $$;
BEGIN;
UPDATE costing.costing_run_retention_ledger SET detail_state='PURGE_IN_PROGRESS' WHERE refresh_run_id=148;
DO $$ BEGIN ASSERT (SELECT newer_draft_run_id FROM costing.v_costing_period_run_status WHERE period_start='2026-10-01') IS NULL,'purging draft is not offered either'; END $$;
ROLLBACK;
\echo PASS 13_r3b_read_guards_verification
