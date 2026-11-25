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
-- A. 25 Nov 2026: November is the first authoritative month; window = November only (greatest(Nov, Aug))
CREATE FUNCTION t.why(p_today date,p_run bigint) RETURNS text LANGUAGE sql AS $$ SELECT retention_decision||': '||retention_reason FROM costing_retention.fn_plan_retention(p_today) WHERE refresh_run_id=p_run $$;
DO $$ DECLARE d date:='2026-11-25'; BEGIN
 ASSERT costing_retention.fn_window_start(d)='2026-11-01','window never starts before the first authoritative month';
 ASSERT t.dec(d,200)='ELIGIBLE' AND t.dec(d,201)='ELIGIBLE' AND t.dec(d,202)='ELIGIBLE' AND t.dec(d,203)='ELIGIBLE','pre-November development data (no approval) is eligible: '||t.why(d,203);
 ASSERT t.dec(d,204)='ELIGIBLE' AND t.dec(d,206)='ELIGIBLE' AND t.dec(d,208)='ELIGIBLE' AND t.dec(d,209)='ELIGIBLE' AND t.dec(d,170)='ELIGIBLE','pre-November drafts and failed run are eligible';
 ASSERT t.dec(d,122)='HOLD' AND t.dec(d,143)='HOLD','approved Sep 122 / Oct 143 stay active pricing authority until a November approval exists: '||t.why(d,122)||' | '||t.why(d,143);
 ASSERT t.why(d,143) LIKE '%active pricing authority%','reason names the blocked consumer class';
 ASSERT t.dec(d,152)='RETAIN' AND t.dec(d,153)='RETAIN' AND t.dec(d,210)='RETAIN' AND t.dec(d,211)='RETAIN','all November details protected';
 ASSERT t.dec(d,154)='HOLD','running run is a HOLD';
 ASSERT t.dec(d,87)='RETAIN' AND t.dec(d,148)='RETAIN','already purged runs are RETAIN (nothing left)';
 ASSERT (SELECT c FROM t.plan(d) WHERE r=122)='FINAL_APPROVED' AND (SELECT c FROM t.plan(d) WHERE r=209)='FAILED' AND (SELECT c FROM t.plan(d) WHERE r=204)='DRAFT','classification';
END $$;
-- B. dry run never mutates data; persisting the plan only changes decision columns
CREATE TABLE t.cnt0 AS SELECT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot) a;
UPDATE costing_retention.test_clock SET fixed_today='2026-11-25';
DO $$ DECLARE j jsonb; BEGIN
 j:=costing_retention.retention_tick('DRY_RUN'); ASSERT j->>'outcome'='PLANNED','dry run planned';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot)=(SELECT a FROM t.cnt0),'dry run deleted nothing';
 ASSERT (SELECT retention_decision FROM costing.costing_run_retention_ledger WHERE refresh_run_id=204)='ELIGIBLE','plan persisted';
 j:=costing_retention.retention_tick('EXECUTE'); ASSERT j->>'outcome'='DISABLED','purge disabled by default';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot)=(SELECT a FROM t.cnt0),'disabled execute deleted nothing';
 PERFORM t.fails($q$SELECT costing_retention.retention_tick('PURGE')$q$,'RETENTION_BAD_MODE');
END $$;
-- C. enabled: ticks purge exactly the eligible runs, oldest month first, one step per tick; protected runs untouched
UPDATE costing_retention.retention_policy SET purge_enabled=true,step_batch_rows=3;
DO $$ DECLARE j jsonb; i int:=0; BEGIN
 LOOP i:=i+1; j:=costing_retention.retention_tick('EXECUTE'); EXIT WHEN j->>'outcome'='NOTHING_ELIGIBLE'; ASSERT i<300,'tick loop guard'; ASSERT j->>'outcome' IN ('PURGE_STEP','RUN_PURGED'),'unexpected '||j::text; END LOOP;
 ASSERT (SELECT array_agg(refresh_run_id ORDER BY refresh_run_id) FROM costing.costing_run_retention_ledger WHERE detail_state='DETAILS_PURGED' AND refresh_run_id>=170)=ARRAY[170,200,201,202,203,204,206,208,209]::bigint[],'exactly the eligible runs were purged';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.costing_run_retention_ledger WHERE refresh_run_id IN (210,211,152,153,154,122,143) AND detail_state='DETAILS_PURGED'),'HOLD/RETAIN runs untouched';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id IN (210,211))=8 AND (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id IN (152,153,122,143))=20,'protected detail intact';
 ASSERT (SELECT count(*) FROM costing_retention.retention_job_log WHERE outcome='RUN_PURGED')>=9,'receipts for each run';
 ASSERT costing_retention.retention_tick('EXECUTE')->>'outcome'='NOTHING_ELIGIBLE','idempotent repeat';
 -- pricing authority unchanged: the pointer still returns Sep 122 and Oct 143 as APPROVED
 ASSERT (SELECT array_agg(approved_run_id ORDER BY period_start) FROM costing.v_costing_period_run_status WHERE period_start IN ('2026-09-01','2026-10-01'))=ARRAY[122,143]::bigint[],'approved pointers untouched';
END $$;
-- D. 1 Dec 2026: November is a completed retained month without final approval -> explicit HOLD (never silently purged)
UPDATE costing_retention.test_clock SET fixed_today='2026-12-01';
DO $$ DECLARE d date:='2026-12-01'; BEGIN
 ASSERT t.dec(d,152)='HOLD' AND t.dec(d,153)='HOLD' AND t.dec(d,210)='HOLD' AND t.dec(d,211)='HOLD','completed November without final approval: HOLD';
 ASSERT t.why(d,152) LIKE '%no valid final approval%','reason explicit';
 ASSERT t.dec(d,122)='HOLD' AND t.dec(d,143)='HOLD','cutover still pending: no authoritative-month approval yet';
END $$;
-- the owner approves November run 153 (cutover) and 154 fails: drafts and the superseded pre-authoritative approvals become eligible
UPDATE costing.costing_refresh_run SET overall_status='FAILED' WHERE id=154;
INSERT INTO costing.costing_run_designation(refresh_run_id,period_start,designation,designated_by,reason) VALUES(153,'2026-11-01','APPROVED','owner','fixture November final approval');
DO $$ DECLARE d date:='2026-12-01'; BEGIN
 ASSERT t.dec(d,153)='RETAIN' AND (SELECT c FROM t.plan(d) WHERE r=153)='FINAL_APPROVED','November final retained: '||t.why(d,153);
 ASSERT t.dec(d,152)='ELIGIBLE' AND t.dec(d,210)='ELIGIBLE' AND t.dec(d,211)='ELIGIBLE' AND t.dec(d,154)='ELIGIBLE','drafts eligible promptly after valid final selection';
 ASSERT t.dec(d,122)='ELIGIBLE' AND t.dec(d,143)='ELIGIBLE','after cutover the previously approved Sep/Oct runs are removable (owner decision): '||t.why(d,143);
END $$;
-- E. failure then retry (silent-skip guard), then the designated runs are purged through the scoped guard exceptions
CREATE FUNCTION t.skip_delete2() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
CREATE TRIGGER a_skip BEFORE DELETE ON costing.sku_scheme_viability_snapshot FOR EACH ROW EXECUTE FUNCTION t.skip_delete2();
CREATE TABLE t.des_before AS SELECT count(*) n,md5(string_agg(id::text||designation,',' ORDER BY id)) h FROM costing.costing_run_designation;
DO $o$ DECLARE j jsonb; ok boolean:=false; BEGIN
 FOR i IN 1..60 LOOP j:=costing_retention.retention_tick('EXECUTE'); IF j->>'outcome'='FAILED' THEN ok:=true; EXIT; END IF; END LOOP;
 ASSERT ok,'failure surfaced';
 ASSERT (SELECT detail->>'error' FROM costing_retention.retention_job_log WHERE outcome='FAILED' ORDER BY id DESC LIMIT 1) LIKE '%PURGE_NO_PROGRESS%','error recorded';
END $o$;
DROP TRIGGER a_skip ON costing.sku_scheme_viability_snapshot;
DO $$ DECLARE j jsonb; i int:=0; BEGIN
 LOOP i:=i+1; j:=costing_retention.retention_tick('EXECUTE'); EXIT WHEN j->>'outcome'='NOTHING_ELIGIBLE'; ASSERT j->>'outcome' IN ('PURGE_STEP','RUN_PURGED'),'retry outcome '||j::text; ASSERT i<400,'guard'; END LOOP;
 ASSERT (SELECT array_agg(refresh_run_id ORDER BY refresh_run_id) FROM costing.costing_run_retention_ledger WHERE detail_state='DETAILS_PURGED' AND refresh_run_id IN (122,143,152,154,210,211))=ARRAY[122,143,152,154,210,211]::bigint[],'all newly eligible runs purged after retry';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=153)=5,'approved November detail intact';
 ASSERT (SELECT (n,h) FROM t.des_before)=(SELECT (count(*),md5(string_agg(id::text||designation,',' ORDER BY id))) FROM costing.costing_run_designation),'designation history untouched by purging designated runs';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.v_costing_period_run_status WHERE period_start IN ('2026-09-01','2026-10-01') AND approved_run_id IS NOT NULL),'purged approved months now report explicit no approved/current run (no silent fallback)';
 ASSERT (SELECT refresh_run_id FROM costing.v_current_successful_costing_refresh_run WHERE period_start='2026-11-01')=153,'November pointer is the approved final';
 ASSERT (SELECT state FROM costing_retention.fn_run_detail_availability(143))='DETAILS_PURGED','R3 reports the purged approved run explicitly';
END $$;
-- F. 1 March 2027 (window Dec-Mar): November leaves the window
CREATE FUNCTION t.mk_run2(p_id bigint,p_period date,p_final text) RETURNS void LANGUAGE sql AS $$ SELECT t.mk_run(p_id,p_period,p_final,3) $$;
SELECT t.mk_run2(213,'2026-12-01','SUCCESS'),t.mk_run2(214,'2026-12-01','SUCCESS'),t.mk_run2(215,'2027-01-01','SUCCESS');
UPDATE costing_retention.test_clock SET fixed_today='2027-03-01';
DO $$ DECLARE d date:='2027-03-01'; BEGIN
 ASSERT costing_retention.fn_window_start(d)='2026-12-01','window Dec-Mar';
 ASSERT t.dec(d,153)='HOLD' AND t.why(d,153) LIKE '%active pricing authority%','Nov final stays authority until December is approved';
 ASSERT t.dec(d,213)='HOLD' AND t.dec(d,214)='HOLD' AND t.dec(d,215)='HOLD','December and January completed without final approval: explicit HOLD';
END $$;
INSERT INTO costing.costing_run_designation(refresh_run_id,period_start,designation,designated_by,reason) VALUES(213,'2026-12-01','APPROVED','owner','fixture December final approval');
DO $$ DECLARE d date:='2027-03-01'; BEGIN
 ASSERT t.dec(d,213)='RETAIN' AND t.dec(d,214)='ELIGIBLE','December final retained, draft eligible';
 ASSERT t.dec(d,153)='ELIGIBLE' AND t.why(d,153) LIKE '%beyond the retention window%','Nov final beyond window and no longer authority';
 ASSERT t.dec(d,215)='HOLD' AND t.why(d,215) LIKE '%owner must approve or release%','January without approval is a flagged HOLD';
END $$;
-- owner month release: explicit, immutable, required reason
DO $$ BEGIN
 PERFORM t.fails($q$INSERT INTO costing_retention.retention_month_release(period_start,reason,released_by) VALUES('2027-01-15','mid-month date rejected by check','owner')$q$,'check');
 PERFORM t.fails($q$INSERT INTO costing_retention.retention_month_release(period_start,reason,released_by) VALUES('2027-01-01','short','owner')$q$,'check');
END $$;
INSERT INTO costing_retention.retention_month_release(period_start,reason,released_by) VALUES('2027-01-01','Owner released unapproved January draft; superseded by February work','owner');
DO $$ DECLARE d date:='2027-03-01'; BEGIN
 ASSERT t.dec(d,215)='ELIGIBLE' AND t.why(d,215) LIKE '%released by owner%','release turns the HOLD into ELIGIBLE';
 PERFORM t.fails($q$DELETE FROM costing_retention.retention_month_release$q$,'append_only');
 PERFORM t.fails($q$UPDATE costing_retention.retention_month_release SET reason='tampered reason text here'$q$,'append_only');
END $$;
DO $$ DECLARE j jsonb; i int:=0; BEGIN
 LOOP i:=i+1; j:=costing_retention.retention_tick('EXECUTE'); EXIT WHEN j->>'outcome'='NOTHING_ELIGIBLE'; ASSERT i<300,'guard'; END LOOP;
 ASSERT (SELECT array_agg(refresh_run_id ORDER BY refresh_run_id) FROM costing.costing_run_retention_ledger WHERE detail_state='DETAILS_PURGED' AND refresh_run_id IN (153,214,215))=ARRAY[153,214,215]::bigint[],'Nov final, Dec draft and released Jan purged';
 ASSERT (SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=213)=3,'December final intact';
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
