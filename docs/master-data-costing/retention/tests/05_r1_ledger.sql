\i lib.sql
-- R1 inventory fidelity
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM costing.costing_run_retention_ledger)=(SELECT count(*) FROM costing.costing_refresh_run),'one ledger row per run';
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=149)='DETAILS_INCOMPLETE','FAILED run must never look complete';
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=154)='RUN_IN_PROGRESS','running run';
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=122)='DETAILS_UNVERIFIED','success not asserted available';
 ASSERT (SELECT valuation_date IS NULL FROM costing.costing_run_retention_ledger WHERE refresh_run_id=149),'null valuation_date preserved';
 ASSERT (SELECT (period_start,valuation_date)=('2026-09-01'::date,'2026-09-20'::date) FROM costing.costing_run_retention_ledger WHERE refresh_run_id=150),'original period/date preserved';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.costing_run_retention_ledger WHERE detail_state IN ('DETAILS_PURGED','PURGE_IN_PROGRESS')),'inventory never purges';
END $$;
-- transactional registration + lifecycle
BEGIN;
INSERT INTO costing.costing_refresh_run(id,period_start,valuation_date,overall_status,valuation_context_source) VALUES(160,'2026-11-01','2026-11-25','QUEUED','CAPTURED_AT_REQUEST');
DO $$ BEGIN ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=160)='RUN_IN_PROGRESS','registered with run'; END $$;
UPDATE costing.costing_refresh_run SET overall_status='RUNNING' WHERE id=160;
UPDATE costing.costing_refresh_run SET overall_status='SUCCESS' WHERE id=160;
DO $$ BEGIN ASSERT (SELECT (detail_state,current_overall_status,original_overall_status) FROM costing.costing_run_retention_ledger WHERE refresh_run_id=160)=('DETAILS_UNVERIFIED'::text,'SUCCESS'::text,'QUEUED'::text),'lifecycle sync keeps original status'; END $$;
ROLLBACK;
DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM costing.costing_run_retention_ledger WHERE refresh_run_id=160),'rolled-back run leaves no ledger row'; END $$;
INSERT INTO costing.costing_refresh_run(id,period_start,valuation_date,overall_status,valuation_context_source) VALUES(161,'2026-11-01','2026-11-25','RUNNING','CAPTURED_AT_REQUEST');
UPDATE costing.costing_refresh_run SET overall_status='FAILED' WHERE id=161;
DO $$ BEGIN ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=161)='DETAILS_INCOMPLETE','failed after running'; END $$;
-- immutability, state machine, terminal purge, check constraints, roles
DO $$ BEGIN
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET period_start='2026-10-01',valuation_month='2026-10-01' WHERE refresh_run_id=122$q$,'PROVENANCE_IMMUTABLE');
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET original_overall_status='FAILED' WHERE refresh_run_id=122$q$,'PROVENANCE_IMMUTABLE');
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_PURGED',details_purged_at=now(),purge_receipt_id=gen_random_uuid(),verification_digest='x' WHERE refresh_run_id=122$q$,'BAD_TRANSITION');
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_AVAILABLE' WHERE refresh_run_id=149$q$,'BAD_TRANSITION');
 PERFORM t.fails($q$DELETE FROM costing.costing_run_retention_ledger WHERE refresh_run_id=122$q$,'APPEND_ONLY');
 PERFORM t.fails($q$TRUNCATE costing.costing_run_retention_ledger$q$,'APPEND_ONLY');
 PERFORM t.fails($q$DELETE FROM costing.costing_refresh_run WHERE id=149$q$,'foreign key|violates');
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET valuation_month='2026-09-15' WHERE refresh_run_id=122$q$,'valuation_month_is_first|PROVENANCE');
END $$;
UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_AVAILABLE' WHERE refresh_run_id=87;  -- UNVERIFIED -> AVAILABLE (verification outcome)
DO $$ BEGIN
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET detail_state='PURGE_IN_PROGRESS' WHERE refresh_run_id=80;
   UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_PURGED',details_purged_at=now() WHERE refresh_run_id=80$q$,'purged_has_receipt|purged_iff|check');
END $$;
SET ROLE authenticated;
DO $$ BEGIN PERFORM t.fails($q$SELECT * FROM costing.costing_run_retention_ledger$q$,'permission denied');
            PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET retention_reason='x'$q$,'permission denied'); END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN PERFORM t.fails($q$SELECT * FROM costing.costing_run_retention_ledger$q$,'permission denied'); END $$;
RESET ROLE;
-- purged terminal (legitimate path with receipt) cannot be reversed or edited
DO $$ BEGIN
 UPDATE costing.costing_run_retention_ledger SET detail_state='PURGE_IN_PROGRESS' WHERE refresh_run_id=80;
 UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_PURGED',details_purged_at=now(),purge_receipt_id=gen_random_uuid(),verification_digest='fixture' WHERE refresh_run_id=80;
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET detail_state='DETAILS_AVAILABLE',details_purged_at=NULL WHERE refresh_run_id=80$q$,'TERMINAL');
 PERFORM t.fails($q$UPDATE costing.costing_run_retention_ledger SET retention_reason='edit' WHERE refresh_run_id=80$q$,'TERMINAL');
 -- run status sync must not resurrect a purged ledger row
 UPDATE costing.costing_refresh_run SET overall_status='FAILED' WHERE id=80;
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=80)='DETAILS_PURGED','sync respects purge';
 UPDATE costing.costing_refresh_run SET overall_status='SUCCESS' WHERE id=80;
END $$;
\echo PASS 05_r1_ledger
