-- CI-043 v2.2 ROLLBACK (review correction 2). One safe default behaviour, no flag needed:
--   * drops both read-only functions (they write nothing, so there is no history to undo);
--   * for each of the 9 health_* settings introduced by CI-043: DELETE it only if it still holds the installed default;
--     KEEP it (row untouched, including introduced_by='CI-043' and updated_at as the audit trail) if an authorised
--     change was made after install. The kept keys and values are reported (NOTICE) and listed by the query at the end.
--   => immediate rollback (nothing changed since install) removes all 9; post-use rollback preserves changed configuration.
--   Re-applying CI-043 later while a changed setting is kept aborts with CI043_SETTING_CONFLICT (by design: investigate).
BEGIN;
DO $$
DECLARE r record; v_kept text := '';
BEGIN
  FOR r IN SELECT s.setting_key, s.int_value, d.def FROM costing.costing_automation_setting s
             JOIN (VALUES ('health_quarter_lock_warn_days',45),('health_quarter_lock_info_days',30),('health_draft_freshness_days',8),
                          ('health_draft_review_days',14),('health_queued_stuck_hours',2),('health_running_stuck_hours',6),
                          ('health_preview_ack_unused_warn_count',50),('health_preview_ack_unused_min_age_days',30),
                          ('health_retry_overdue_minutes',20)) d(k, def) ON d.k = s.setting_key
            WHERE s.introduced_by = 'CI-043' LOOP
    IF r.int_value = r.def THEN
      DELETE FROM costing.costing_automation_setting WHERE setting_key = r.setting_key;
    ELSE
      v_kept := v_kept || r.setting_key || '=' || r.int_value || ' (default ' || r.def || '); ';
    END IF;
  END LOOP;
  RAISE NOTICE 'CI-043 v2.2 rollback: settings kept because changed after install: %', coalesce(nullif(v_kept, ''), 'none');
END $$;
DROP FUNCTION IF EXISTS public.rpc_costing_health_check();
DROP FUNCTION IF EXISTS costing.fn_costing_health_check(date);
COMMIT;
-- record for the APPLIED/ROLLBACK note (read-only):
SELECT setting_key, int_value, updated_at FROM costing.costing_automation_setting WHERE introduced_by = 'CI-043' ORDER BY setting_key;
