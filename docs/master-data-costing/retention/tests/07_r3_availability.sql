\i lib.sql
-- Fixture fidelity (informational): do the extracted real views reproduce the md5 pins recorded by W2 for live PG 17.4?
SELECT 'FIDELITY pointer_view_md5_matches_live_pin='||(md5(pg_get_viewdef('costing.v_current_successful_costing_refresh_run'::regclass))='5cc25791985abf5d336fb9311da3d6f1')
    || ' effective_designation='||(md5(pg_get_viewdef('costing.v_costing_run_effective_designation'::regclass))='b324068d66aef0c14bc6d47a921c6d56')
    || ' period_status='||(md5(pg_get_viewdef('costing.v_costing_period_run_status'::regclass))='d38be6e4c0c8bb9811f4872b78e72936')
    || ' server='||current_setting('server_version');
-- Pre-change snapshot of the pointer view for parity
CREATE TABLE t.ptr_before AS SELECT * FROM costing.v_current_successful_costing_refresh_run;
SELECT set_config('costing_retention.pointer_view_md5',md5(pg_get_viewdef('costing.v_current_successful_costing_refresh_run'::regclass)),false);
\i ../candidates/R3_run_detail_availability.sql
DO $$ BEGIN
 -- parity: with no purged runs the pointer view is unchanged for all rows and columns
 ASSERT NOT EXISTS (SELECT * FROM t.ptr_before WHERE refresh_run_id<>80 EXCEPT SELECT * FROM costing.v_current_successful_costing_refresh_run) AND NOT EXISTS (SELECT * FROM costing.v_current_successful_costing_refresh_run EXCEPT SELECT * FROM t.ptr_before),'pointer parity for every non-purged run (all columns)';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-08-01'),'August: top-ranked run 80 was purged in R1 test => explicit no current run';
 ASSERT (SELECT refresh_run_id FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-10-01')=143,'October approved run 143 remains the pointer';
 ASSERT (SELECT refresh_run_id FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-09-01')=122,'September approved run 122 remains the pointer';
 ASSERT (SELECT refresh_run_id FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-11-01')=153,'November (unapproved) keeps existing labelled LATEST_SUCCESS behaviour';
 ASSERT (SELECT selection_basis FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-11-01')='LATEST_SUCCESS','still labelled as non-approved';
END $$;

-- availability states
DO $$ BEGIN
 ASSERT (SELECT (available,state) FROM costing_retention.fn_run_detail_availability(122))=(true,'AVAILABLE_UNVERIFIED'::text),'success unverified';
 ASSERT (SELECT (available,state) FROM costing_retention.fn_run_detail_availability(149))=(false,'DETAILS_INCOMPLETE'::text),'failed run unavailable';
 ASSERT (SELECT (available,state) FROM costing_retention.fn_run_detail_availability(154))=(false,'RUN_IN_PROGRESS'::text),'running unavailable';
 ASSERT (SELECT state FROM costing_retention.fn_run_detail_availability(99999))='UNKNOWN_RUN','unknown run';
 ASSERT (SELECT (available,state) FROM costing_retention.fn_run_detail_availability(80))=(false,'DETAILS_PURGED'::text),'purged fixture run 80 from R1 tests';
 PERFORM t.fails('SELECT costing.fn_assert_run_details_available(80)','RUN_DETAILS_UNAVAILABLE.*DETAILS_PURGED');
 PERFORM t.fails('SELECT costing.fn_assert_run_details_available(149)','RUN_DETAILS_UNAVAILABLE');
 PERFORM costing.fn_assert_run_details_available(122);
END $$;
-- public RPC: permission gated, explicit payload, never executable by anon
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000002');
DO $$ DECLARE j jsonb; BEGIN
 j:=public.rpc_costing_run_detail_availability(80);
 ASSERT (j->>'available')='false' AND j->>'state'='DETAILS_PURGED' AND j->>'reason' LIKE '%removed%','explicit unavailable payload for view-only user';
 ASSERT (public.rpc_costing_run_detail_availability(122)->>'available')='true','available payload';
 PERFORM t.fails($q$SELECT costing.fn_assert_run_details_available(122)$q$,'permission denied');
 PERFORM t.fails($q$SELECT * FROM costing_retention.fn_run_detail_availability(122)$q$,'permission denied');
END $$;
SELECT t.as_user('00000000-0000-0000-0000-000000000099');
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_costing_run_detail_availability(122)$q$,'permission denied'); END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_costing_run_detail_availability(122)$q$,'permission denied'); END $$;
RESET ROLE;
-- pointer behaviour after purges: revoke 122 approval, purge 150 (latest success): September has NO current run (no silent fallback to 87)
INSERT INTO costing.costing_run_designation(refresh_run_id,period_start,designation,designated_by,reason) VALUES(122,'2026-09-01','REVOKED','owner','fixture revoke for pointer test');
DO $$ BEGIN ASSERT (SELECT refresh_run_id FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-09-01')=150,'after revoke the latest available success is displayed (existing semantics)'; END $$;
UPDATE costing.costing_run_retention_ledger SET detail_state='PURGE_IN_PROGRESS' WHERE refresh_run_id=150;
DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-09-01'),'purge in progress => no current run, not run 87'; END $$;
UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_PURGED',details_purged_at=now(),purge_receipt_id=gen_random_uuid(),verification_digest='fixture' WHERE refresh_run_id=150;
DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-09-01'),'purged => explicit no current run';
 ASSERT (SELECT refresh_run_id FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-10-01')=143,'October unaffected'; END $$;
-- restore fixture governance for later suites (fixture table is a plain table; live table is append-only)
DELETE FROM costing.costing_run_designation WHERE reason='fixture revoke for pointer test';
-- approval preflight real function: DETAILS_AVAILABLE check present, passes for available run, fails for purged run
INSERT INTO costing.v_sku_detailed_cost_sheet_t VALUES(152,1,'READY'),(150,1,'READY');
DO $$ DECLARE c jsonb; BEGIN
 c:=costing.fn_w2_run_checks(152,'APPROVE');
 ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(c->'checks') x WHERE x->>'code'='DETAILS_AVAILABLE' AND (x->>'pass')::boolean),'available run passes DETAILS_AVAILABLE';
 c:=costing.fn_w2_run_checks(150,'APPROVE');
 ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(c->'checks') x WHERE x->>'code'='DETAILS_AVAILABLE' AND NOT (x->>'pass')::boolean),'purged run fails DETAILS_AVAILABLE';
 ASSERT NOT (c->>'ok')::boolean,'approval of purged run refused';
END $$;
\echo PASS 07_r3_availability
