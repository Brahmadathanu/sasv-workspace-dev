-- ROUTE 2 / STEP 3c -- ADMINISTRATOR-ONLY eligibility check for run 87 (replaces the exporter's status-view gate).
-- Run as administrator immediately before the archive. READ ONLY; reads run ids/statuses only.
-- The archive role has NO access to the definer-rights status view; instead the exporter requires the
-- reference token printed here (--admin-eligibility-ref) and records it in the archive manifest.
-- Raises (and prints no token) unless run 87 is: SUCCESS, period 2026-09-01, not designated, and neither
-- displayed nor approved. It also reports, as information only, that the approved October run 143 is untouched.
-- The token proves WHEN and in WHAT state eligibility was checked; it is not an authorisation to delete.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
DO $r2g$
DECLARE
  v_status text; v_period text; v_designated boolean; v_shown boolean; v_143_approved int; v_ref text;
BEGIN
  SELECT overall_status, period_start::text INTO v_status, v_period FROM costing.costing_refresh_run WHERE id = 87;
  IF NOT FOUND OR v_status <> 'SUCCESS' OR v_period <> '2026-09-01' THEN
    RAISE EXCEPTION 'R2G HOLD: run 87 identity drift (%, %)', v_status, v_period;
  END IF;
  SELECT EXISTS (SELECT 1 FROM costing.costing_run_designation WHERE refresh_run_id = 87) INTO v_designated;
  IF v_designated THEN RAISE EXCEPTION 'R2G HOLD: run 87 is designated'; END IF;
  SELECT EXISTS (SELECT 1 FROM costing.v_costing_period_run_status WHERE displayed_run_id = 87 OR approved_run_id = 87) INTO v_shown;
  IF v_shown THEN RAISE EXCEPTION 'R2G HOLD: run 87 is displayed or approved'; END IF;
  SELECT count(*) INTO v_143_approved FROM costing.v_costing_period_run_status WHERE approved_run_id = 143;
  v_ref := 'R2E-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS') || '-' ||
           substr(md5(v_status || v_period || v_designated::text || v_shown::text || clock_timestamp()::text), 1, 8);
  RAISE NOTICE 'R2_05 ELIGIBLE: run 87 SUCCESS / 2026-09-01 / undesignated / not displayed or approved; run 143 approved rows in status view = %', v_143_approved;
  RAISE NOTICE 'R2_05 REFERENCE (pass to the exporter as --admin-eligibility-ref): %', v_ref;
END
$r2g$;
COMMIT;
