-- S3H — live PostgreSQL deletion-governance preflight, SELECT ONLY.
-- Discovers current-run mutation rules BEFORE any staging rehearsal.
-- No DELETE, trigger disablement, flag manipulation, schema changes or cron.
SELECT r.period_start, r.overall_status, count(*) AS runs,
       CASE WHEN r.overall_status IN ('QUEUED','RUNNING','FAILED')
            THEN 'STATUS_GUARD_ONLY_POTENTIALLY_PERMITS'
            ELSE 'BLOCKED_BY_EXISTING_TERMINAL_RUN_GUARD' END AS terminal_guard
FROM costing.costing_refresh_run r
WHERE r.period_start < DATE '2026-11-01'
GROUP BY r.period_start, r.overall_status
ORDER BY r.period_start, r.overall_status;

SELECT n.nspname||'.'||c.relname AS snapshot,
       t.tgname,t.tgenabled, fn.proname AS function_name,
       pg_get_triggerdef(t.oid) AS guard_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc fn ON fn.oid=t.tgfoid
WHERE NOT t.tgisinternal
  AND t.tgrelid IN (
    'costing.marketing_signed_billed_sales_evidence_snapshot'::regclass,
    'costing.marketing_regional_sales_evidence_snapshot'::regclass
  )
ORDER BY snapshot,t.tgname;

SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) AS source
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='costing' AND p.proname IN
('fn_guard_designated_run_rows','fn_enforce_mutable_refresh_run_snapshot','fn_guard_snapshot_truncate')
ORDER BY p.proname;

-- The status guard rejects ALL historical SUCCESS and CANCELLED snapshot
-- deletions regardless of FK leaf status or absent run designations.
-- Do not attempt the old S3E deletion under current production-like schema.
-- Next required work: explicit owner-reviewed retention governance transition
-- that preserves immutability for ordinary writers, historical APPROVED/REVOKED,
-- external references and current month; isolate the maintenance identity,
-- prove audit receipts, recoverability, permissions, and selected-run cutover.
