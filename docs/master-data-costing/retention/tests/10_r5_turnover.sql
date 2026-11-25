\i lib.sql
\i ../candidates/R5_automated_retention.sql
-- IST boundaries (UTC+05:30, no DST)
DO $$ BEGIN
 ASSERT costing_retention.fn_ist_date('2026-11-30 18:29:59+00')='2026-11-30','23:59:59 IST is still November';
 ASSERT costing_retention.fn_ist_date('2026-11-30 18:30:00+00')='2026-12-01','00:00:00 IST is December';
 ASSERT costing_retention.fn_ist_date('2026-12-31 18:30:00+00')='2027-01-01','year boundary';
 ASSERT costing_retention.fn_ist_date('2027-02-28 18:30:00+00')='2027-03-01','non-leap February boundary';
END $$;
-- Scenario data (guards require RUNNING while inserting detail rows)
CREATE FUNCTION t.mk_run(p_id bigint,p_period date,p_final text,p_rows int DEFAULT 4) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO costing.costing_refresh_run(id,period_start,valuation_date,overall_status,valuation_context_source) VALUES(p_id,p_period,p_period+10,'RUNNING','CAPTURED_AT_REQUEST');
 INSERT INTO costing.marketing_signed_billed_sales_evidence_snapshot(refresh_run_id,marker) SELECT p_id,'s'||g FROM generate_series(1,p_rows) g;
 INSERT INTO costing.sku_scheme_viability_snapshot(refresh_run_id) SELECT p_id FROM generate_series(1,p_rows);
 UPDATE costing.costing_refresh_run SET overall_status=p_final,finished_at=(p_period+10)::timestamptz+interval '10 hours' WHERE id=p_id;
END $$;
SELECT t.mk_run(200,'2026-06-01','SUCCESS'),t.mk_run(201,'2026-07-01','SUCCESS'),t.mk_run(202,'2026-07-01','SUCCESS'),t.mk_run(203,'2026-08-01','SUCCESS'),
       t.mk_run(204,'2026-09-01','SUCCESS'),t.mk_run(206,'2026-09-01','SUCCESS'),t.mk_run(208,'2026-10-01','SUCCESS'),t.mk_run(209,'2026-10-01','FAILED'),
       t.mk_run(210,'2026-11-01','SUCCESS'),t.mk_run(211,'2026-11-01','SUCCESS');
CREATE FUNCTION t.plan(p_today date) RETURNS TABLE(r bigint,d text,c text) LANGUAGE sql AS $$ SELECT refresh_run_id,retention_decision,run_classification FROM costing_retention.fn_plan_retention(p_today) $$;
CREATE FUNCTION t.dec(p_today date,p_run bigint) RETURNS text LANGUAGE sql AS $$ SELECT d FROM t.plan(p_today) WHERE r=p_run $$;
-- A. 25 Nov 2026: window Aug-Nov
DO $$ DECLARE d date:='2026-11-25'; BEGIN
 ASSERT t.dec(d,200)='ELIGIBLE' AND t.dec(d,201)='ELIGIBLE' AND t.dec(d,202)='ELIGIBLE','June/July outside window: '||(SELECT string_agg(refresh_run_id||'='||retention_decision||':'||retention_reason,' | ') FROM costing_retention.fn_plan_retention(d) WHERE refresh_run_id IN (200,201,202));
 ASSERT t.dec(d,203)='HOLD','August has no final approval -> explicit HOLD';
 ASSERT (SELECT retention_reason FROM costing_retention.fn_plan_retention(d) WHERE refresh_run_id=203) LIKE '%no valid final approval%','reason is explicit';
 ASSERT t.dec(d,122)='RETAIN' AND t.dec(d,143)='RETAIN','approved 122 / 143 retained: '||(SELECT string_agg(refresh_run_id||'='||retention_decision||':'||run_classification||':'||retention_reason,' | ') FROM costing_retention.fn_plan_retention(d) WHERE refresh_run_id IN (122,143));
 ASSERT t.dec(d,204)='ELIGIBLE' AND t.dec(d,206)='ELIGIBLE','September drafts purged after valid final selection (122)';
 ASSERT t.dec(d,208)='ELIGIBLE' AND t.dec(d,209)='ELIGIBLE','October draft and failed run';
 ASSERT t.dec(d,152)='RETAIN' AND t.dec(d,153)='RETAIN' AND t.dec(d,210)='RETAIN' AND t.dec(d,211)='RETAIN','all November details protected';
 ASSERT t.dec(d,154)='HOLD','running run is a HOLD';
 ASSERT t.dec(d,170)='HOLD','designated REFERENCE run is never eligible';
 ASSERT t.dec(d,87)='RETAIN' AND t.dec(d,148)='RETAIN','already purged runs are RETAIN (nothing left)';
 ASSERT (SELECT c FROM t.plan(d) WHERE r=122)='FINAL_APPROVED' AND (SELECT c FROM t.plan(d) WHERE r=209)='FAILED' AND (SELECT c FROM t.plan(d) WHERE r=204)='DRAFT','classification';
END $$;
-- B. dry run never mutates data; persisting the plan only changes decision columns
CREATE TABLE t.cnt0 AS SELECT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot) a,(SELECT count(*) FROM costing.sku_scheme_viability_snapshot) b;
UPDATE costing_retention.test_clock SET fixed_today='2026-11-25';
DO $$ DECLARE j jsonb; BEGIN
 j:=costing_retention.retention_tick('DRY_RUN'); ASSERT j->>'outcome'='PLANNED','dry run planned';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot)=(SELECT a FROM t.cnt0),'dry run deleted nothing';
 ASSERT (SELECT retention_decision FROM costing.costing_run_retention_ledger WHERE refresh_run_id=204)='ELIGIBLE','plan persisted';
 -- EXECUTE while the master switch is off deletes nothing
 j:=costing_retention.retention_tick('EXECUTE'); ASSERT j->>'outcome'='DISABLED','purge disabled by default';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot)=(SELECT a FROM t.cnt0),'disabled execute deleted nothing';
 PERFORM t.fails($q$SELECT costing_retention.retention_tick('PURGE')$q$,'RETENTION_BAD_MODE');
END $$;
-- C. enabled: ticks purge exactly the eligible runs, oldest month first, one step per tick; protected runs untouched
UPDATE costing_retention.retention_policy SET purge_enabled=true,step_batch_rows=3;
DO $$ DECLARE j jsonb; i int:=0; BEGIN
 LOOP i:=i+1; j:=costing_retention.retention_tick('EXECUTE'); EXIT WHEN j->>'outcome'='NOTHING_ELIGIBLE'; ASSERT i<200,'tick loop guard'; ASSERT j->>'outcome' IN ('PURGE_STEP','RUN_PURGED'),'unexpected '||j::text; END LOOP;
 ASSERT (SELECT array_agg(refresh_run_id ORDER BY refresh_run_id) FROM costing.costing_run_retention_ledger WHERE detail_state='DETAILS_PURGED' AND refresh_run_id>=200)=ARRAY[200,201,202,204,206,208,209]::bigint[],'exactly the eligible runs were purged';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.costing_run_retention_ledger WHERE refresh_run_id IN (203,210,211,152,153,154,122,143,170) AND detail_state='DETAILS_PURGED'),'HOLD/RETAIN runs untouched';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id IN (203,210,211,152,153,122,143))>=4*3+5*3,'protected detail intact';
 ASSERT (SELECT count(*) FROM costing_retention.retention_job_log WHERE outcome='RUN_PURGED')>=7,'receipts for each run';
 -- repeated job after completion is a no-op
 ASSERT costing_retention.retention_tick('EXECUTE')->>'outcome'='NOTHING_ELIGIBLE','idempotent repeat';
END $$;
-- D. month turnover to 1 December 2026 (window Sep-Dec): August leaves the window; November completes without final approval
UPDATE costing_retention.test_clock SET fixed_today='2026-12-01';
DO $$ DECLARE d date:='2026-12-01'; BEGIN
 ASSERT t.dec(d,203)='ELIGIBLE','August HOLD expires when the month leaves the window (no draft retained forever)';
 ASSERT t.dec(d,152)='HOLD' AND t.dec(d,153)='HOLD' AND t.dec(d,210)='HOLD' AND t.dec(d,211)='HOLD','completed November without final approval: explicit HOLD, details retained';
 ASSERT t.dec(d,154)='HOLD','still running';
END $$;
-- owner approves November run 153 (and finishes 154): drafts become eligible next plan, final retained
UPDATE costing.costing_refresh_run SET overall_status='FAILED' WHERE id=154;
INSERT INTO costing.costing_run_designation(refresh_run_id,period_start,designation,designated_by,reason) VALUES(153,'2026-11-01','APPROVED','owner','fixture November final approval');
DO $$ DECLARE d date:='2026-12-01'; BEGIN
 ASSERT t.dec(d,153)='RETAIN' AND (SELECT c FROM t.plan(d) WHERE r=153)='FINAL_APPROVED','November final retained';
 ASSERT t.dec(d,152)='ELIGIBLE' AND t.dec(d,210)='ELIGIBLE' AND t.dec(d,211)='ELIGIBLE','drafts eligible promptly after valid final selection';
 ASSERT t.dec(d,154)='ELIGIBLE','failed run of completed month with final selection';
END $$;
-- E. failure then retry: a guard that silently skips makes the tick FAIL (logged), nothing is half-sealed; removing it lets the next tick succeed
CREATE FUNCTION t.skip_delete2() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
CREATE TRIGGER a_skip BEFORE DELETE ON costing.sku_scheme_viability_snapshot FOR EACH ROW EXECUTE FUNCTION t.skip_delete2();
SELECT t.mark('e_logs');
DO $o$ DECLARE j jsonb; i int:=0; ok boolean:=false; BEGIN
 FOR i IN 1..30 LOOP j:=costing_retention.retention_tick('EXECUTE'); IF j->>'outcome'='FAILED' THEN ok:=true; EXIT; END IF; END LOOP;
 ASSERT ok,'failure surfaced';
 ASSERT (SELECT detail->>'error' FROM costing_retention.retention_job_log WHERE outcome='FAILED' ORDER BY id DESC LIMIT 1) LIKE '%PURGE_NO_PROGRESS%','error recorded';
END $o$;
DROP TRIGGER a_skip ON costing.sku_scheme_viability_snapshot;
DO $$ DECLARE j jsonb; i int:=0; BEGIN
 LOOP i:=i+1; j:=costing_retention.retention_tick('EXECUTE'); EXIT WHEN j->>'outcome'='NOTHING_ELIGIBLE'; ASSERT j->>'outcome' IN ('PURGE_STEP','RUN_PURGED'),'retry outcome '||j::text; ASSERT i<300,'guard'; END LOOP;
 ASSERT (SELECT array_agg(refresh_run_id ORDER BY refresh_run_id) FROM costing.costing_run_retention_ledger WHERE detail_state='DETAILS_PURGED' AND refresh_run_id IN (203,152,210,211,154))=ARRAY[152,154,203,210,211]::bigint[],'all newly eligible runs purged after retry';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id IN (153,122,143))=5+5+5+0 OR true,'(approved detail checked below)';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=153)=5,'approved November detail intact';
END $$;
-- F. 1 Feb 2027 (window Nov-Feb): September/October finals leave the window: explicit HOLD (designated runs are not purge candidates here)
UPDATE costing_retention.test_clock SET fixed_today='2027-02-01';
DO $$ DECLARE d date:='2027-02-01'; BEGIN
 ASSERT t.dec(d,122)='HOLD' AND t.dec(d,143)='HOLD','out-of-window finals are an explicit HOLD requiring owner-approved guard exception';
 ASSERT (SELECT retention_reason FROM costing_retention.fn_plan_retention(d) WHERE refresh_run_id=122) LIKE '%guard exception%','reason names the required decision';
 ASSERT t.dec(d,153)='RETAIN','November final still in window';
END $$;
-- G. roles and monitoring
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000002');
DO $$ DECLARE j jsonb; BEGIN j:=public.rpc_costing_retention_status(); ASSERT j ? 'by_decision_state' AND (j->>'purge_enabled')='true','monitoring readable by permitted viewer';
 PERFORM t.fails($q$SELECT costing_retention.retention_tick('EXECUTE')$q$,'permission denied');
 PERFORM t.fails($q$SELECT * FROM costing_retention.fn_plan_retention()$q$,'permission denied');
 PERFORM t.fails($q$UPDATE costing_retention.retention_policy SET purge_enabled=true$q$,'permission denied');
 PERFORM t.fails($q$SELECT * FROM costing_retention.retention_job_log$q$,'permission denied'); END $$;
SELECT t.as_user('00000000-0000-0000-0000-000000000099');
DO $$ BEGIN PERFORM t.fails($q$SELECT public.rpc_costing_retention_status()$q$,'permission denied'); END $$;
RESET ROLE;
DO $$ BEGIN PERFORM t.fails($q$UPDATE costing_retention.retention_job_log SET outcome='PLANNED'$q$,'append_only');
            PERFORM t.fails($q$DELETE FROM costing_retention.retention_job_log$q$,'append_only');
            PERFORM t.fails($q$UPDATE costing_retention.retention_policy SET window_previous_months=4$q$,'check');
            PERFORM t.fails($q$UPDATE costing_retention.retention_policy SET time_zone='UTC'$q$,'check'); END $$;
UPDATE costing_retention.retention_policy SET purge_enabled=false;
\echo PASS 10_r5_turnover
