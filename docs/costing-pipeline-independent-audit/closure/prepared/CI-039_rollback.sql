-- CI-039 ROLLBACK
-- A) IMMEDIATE structural rollback (before any CRON_SCHEDULED audit row exists):
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM costing.cost_period_governance_audit WHERE event_source='CRON_SCHEDULED') THEN
    RAISE EXCEPTION 'CRON_SCHEDULED audit rows exist: use section B (keep constraint), audit is append-only';
  END IF; END $$;
ALTER TABLE costing.cost_period_governance_audit DROP CONSTRAINT cost_period_governance_audit_event_source_chk;
ALTER TABLE costing.cost_period_governance_audit ADD CONSTRAINT cost_period_governance_audit_event_source_chk
  CHECK (event_source = ANY (ARRAY['MIGRATION'::text,'SYSTEM'::text,'GOVERNED_RPC'::text]));
\i ci039_preimage_scheduler_fn.sql
COMMENT ON FUNCTION costing.rpc_request_scheduled_costing_refresh_internal() IS NULL;
COMMIT;
-- (For MCP apply, paste the contents of ci039_preimage_scheduler_fn.sql in place of \i.)
--
-- B) ROLLBACK AFTER USE (scheduler has written CRON_SCHEDULED audit rows / created runs):
--  * Restore ONLY the function (ci039_preimage_scheduler_fn.sql). KEEP the widened constraint:
--    the audit table is append-only (trg_w2_audit_append_only) and re-adding the old CHECK would fail
--    on existing rows. Do not delete audit rows.
--  * Pause jobs 66/67 first if the reason for rollback is scheduler behaviour:
--      select cron.alter_job(66, active := false); select cron.alter_job(67, active := false);
--  * Draft runs created by the scheduler (source_trigger='CRON_SCHEDULED') are ordinary drafts;
--    leave them (they never affect pricing unless approved). Any valuation-date advance already made
--    to a month WITHOUT an approved run is the pre-existing designed behaviour, not caused by CI-039.
