# CI-041 v2.1: scheduled drafts with their own date; safe, allowlisted retries (prepared, not applied)

**Unchanged from v2:**
- Weekly drafts use today's India date; month-end drafts use the last day of the month just ended.
- The stored month date is not moved.
- Drafts continue after approval and are marked "not for pricing".
- A repeat request for the same date reuses the run. A manual recalculation with a reason creates a new run.
- One month-end catch-up at most.

**v2.1 corrections:**
- **Retries only for known-temporary failures:**
  - The stage processor stores only the message text (no SQLSTATE). The allowlist therefore matches exact server texts for deadlock (40P01), serialization failure (40001) and lock not available / lock timeout (55P03), in `costing.fn_costing_failure_class`.
  - A statement timeout is not listed: it rolls back job 68's whole transaction, so it never creates a FAILED run.
  - Anything unknown is **never** retried. The health check flags it (WARN) and the next scheduled draft goes ahead.
  - Governance failures (AU2_/W2_/AU-9/immutable/fingerprint/append-only) and data failures (NO_EFFECTIVE_…) are never retried. Governance failures keep blocking the month.
  - Checked read-only: none of the 14 historical failures would have been retried.
- **No retry inside a trigger:**
  - `fn_after_refresh_run_au2` is no longer touched.
  - A sweep, `costing.fn_costing_retry_sweep()`, runs from job 68's existing entry point, `public.rpc_process_pending_costing_refresh_stage()`. The wrapper body is replaced; the **cron command is unchanged**. The sweep runs in an isolated sub-block whose errors only warn, followed by the identical call. The weekly and month-end entry points run it too.
  - **Latency:** about 5 minutes or less.
- **Attempts are tracked explicitly:**
  - Each decision is a durable row in `cost_period_governance_audit` (event_source CRON_SCHEDULED): SCHEDULED_RETRY_REQUESTED, SCHEDULED_RETRY_FAILED or SCHEDULED_RETRY_LIMIT_REACHED, carrying failed_run_id, origin_run_id, attempt and new_run_id.
  - The attempt count follows only these explicit retry records, never unrelated old failures.
  - The count is bounded by `scheduler_max_retries` (2).
  - Each failed run is handled at most once, so the sweep is idempotent.
  - If a retry cannot be created, the error is kept (SCHEDULED_RETRY_FAILED) and the health check shows it as ERROR.
- **Audit constraint:** event_type is widened by 3 values (widen only). No new table.

**Rollback:** restores the job-68 wrapper byte-identical (md5 81bd56fe…) and drops the sweep and the classifier. With no retry audit rows yet, the constraint returns to CI-040's; otherwise it is kept as evidence.

**Tests:** S2a–S2v, SW1–SW5, plus T01–T03, S1, S3, TZ, M1. All pass.
