# Deployment-approval request: CI-043 v2.2 Revision B (read-only costing health check)

Prepared on Tue 27 Oct 2026, 18:25 IST. This is preparation only: nothing has been applied. Production project: `qhmoqtxpeasamtlxaoak`.

## Plain-language summary (for the owner)

**What it is.** CI-043 adds one **health check** that you, or the app, can call at any time. It lists problems graded **ERROR / WARN / INFO**:
- approved or reference runs whose fingerprint no longer matches;
- months with no fresh draft, or a newer draft waiting for review;
- months that ended without an approval, or with no month-end draft;
- runs stuck in the queue, including whether the 5-minute processor (job 68) is off or not running;
- scheduled failures and what happened to their automatic retries;
- cron jobs 66/67/68 missing, inactive or recently failing;
- a pile-up of unused approval previews;
- **quarter-lock reminders:** INFO 30 days and WARN 45 days after a quarter ends with approved but unlocked months. Both are adjustable.

**What it does not do:**
- It **only reports**. It sends **no alerts** (no e-mail, message or notification) and writes nothing when called.
- It creates **no cron job**. Running it daily, and delivering alerts, are **separate future decisions**, each with its own approval.
- It changes no numbers, runs, approvals or locks.

**What it adds to the database:**
- 2 read-only functions.
- 9 adjustable threshold settings, written once at apply time. These are the only rows it writes.
- No views and no policy record. (The request mentioned "views"; the package contains none.)

**Permissions:**
- Logged-in users with the Costing Control Centre permission can run the check.
- The internal function is owner-only.
- Anonymous users get nothing.

**Not included (honest gap).** The over-restrictive back-dating cut-off warning, agreed on 27 Oct as "record and investigate", is **not** in CI-043 as prepared. The package has no cut-off check. Adding one needs a definition of "over-restrictive" (for example: a refused back-dated entry dated inside the frozen window, or a cut-off that moved by more than N days). I recommend recording this as a separate small follow-up rather than delaying CI-043. If you want it inside CI-043, tell me the rule and I will prepare a later revision.

**Is it safe?** Yes. I checked the live state read-only at 18:10 IST:
- everything CI-043 depends on is unchanged;
- the settings guard already accepts its 9 keys;
- the CI-043 tests pass on top of the live CI-042 v2.2.

The SQL did not need changing. New mandatory **pre-check** and **post-check** scripts were added, in line with the lessons from CI-042.

**Recommendation.** Apply in any quiet window, for example 28 Oct. Avoid the minute around each 5-minute mark, never apply with a run queued or running, and avoid 01:55–03:00 IST on 1 and 2 Nov. Notify Jarvis before and after. Your approval sentence is in A9.

---

# Technical appendix

## A1. Files and version
| Item | Value |
|---|---|
| Migration | `20261027093000_ci043v22_costing_health_check.sql` (md5 cfae78680e4e1c2ddde0661eba8bfd24), v2.2, unchanged since tested |
| Intended version | `20261027093000`. apply_migration records the UTC apply time; the name will be `ci043v22_costing_health_check`. |
| Pre-check (mandatory) | `verify_ci043v22_pre.sql` (md5 021d44fe0640e877465a9b8bd4074119): 14 checks + ALL row. **Ran on production at 18:10 IST: all PASS.** |
| Post-check (mandatory) | `verify_ci043v22_post.sql` (md5 0e06e7ae378883afc29a0e2038817475): 18 checks + ALL row |
| Mandatory checks | `verify_ci043v22_pre.sql` (dd2eb814b6d4ea2cf2d949c8b7962eef), `verify_ci043v22_post.sql` (194dd6ec726e07576d7996eb13f8e0d1), `verify_ci043v22_post_rpc.sql` (9fbf3517ec96fe92846d692514d0301a) — v2.2 rev b |
| Rollback | `20261027093000_ci043v22_ROLLBACK.sql` (md5 d01ce828f068c2b2da19cbc93d7cdc96): drops both functions; deletes only health_* settings still at their installed default; keeps (and reports) any changed after install |
| Method | Supabase MCP `apply_migration` only, never `supabase db push` |

## A2. Objects
- **NEW `costing.fn_costing_health_check(p_today date default null)`:**
  - returns `TABLE(severity, check_code, period_start, run_id, detail)`;
  - STABLE, SECURITY DEFINER, owner postgres;
  - ACL `{postgres=X/postgres}` (anon and authenticated revoked; schema `costing`, so Supabase default privileges do not apply).
- **NEW `public.rpc_costing_health_check()`:**
  - the same columns, sorted ERROR → WARN → INFO;
  - calls `require_permission('module:costing-control-center', false)`;
  - ACL `{postgres=X,authenticated=X,service_role=X}`, anon revoked explicitly;
  - comment: "reports only; sends no alerts".
- **INSERT 9 rows into `costing.costing_automation_setting`** (`ON CONFLICT DO NOTHING`):

  | Setting | Value |
  |---|---|
  | health_quarter_lock_warn_days | 45 |
  | health_quarter_lock_info_days | 30 |
  | health_draft_freshness_days | 8 |
  | health_draft_review_days | 14 |
  | health_queued_stuck_hours | 2 |
  | health_running_stuck_hours | 6 |
  | health_preview_ack_unused_warn_count | 50 |
  | health_preview_ack_unused_min_age_days | 30 |
  | health_retry_overdue_minutes | 20 |

  CI-040's live `costing_automation_setting_range_chk` already contains these keys and ranges (verified).
- **Replaced: none.** No views, triggers, cron jobs or policy records.
- **Check codes** include:
  - `<DESIGNATION>_FINGERPRINT_MISSING/_DRIFT`
  - `MULTIPLE_APPROVED_RUNS`
  - `LOCKED_WITHOUT_APPROVED_RUN`
  - `LOCKED_STORED_DATE_AFTER_OFFICIAL`
  - `DRAFT_FRESHNESS`
  - `NEWER_DRAFT_UNREVIEWED`
  - `DRAFT_DATED_BEFORE_APPROVED`
  - `MONTH_ENDED_UNAPPROVED`
  - `MONTH_END_DRAFT_MISSING`
  - `QUARTER_LOCK_DUE` (INFO) / `QUARTER_LOCK_OVERDUE` (WARN)
  - `STUCK_QUEUED_RUN` / `STUCK_RUNNING_RUN`
  - `QUEUED_PROCESSOR_INACTIVE` / `_NOT_EXECUTING` / `QUEUED_BEHIND_RUNNING_RUN`
  - `SCHEDULED_RUN_GOVERNANCE_FAILURE` / `_DATA_GAP_NOT_RETRIED` / `_FAILED_NOT_RETRIED`
  - `SCHEDULED_RETRY_PENDING` / `_OVERDUE` / `_CREATION_FAILED` / `_FAILED` / `_LIMIT_REACHED` / `SCHEDULED_RETRIES_EXHAUSTED`
  - `JOB_MISSING` / `JOB_INACTIVE` / `JOB_RECENT_FAILURE`
  - `PREVIEW_ACK_UNUSED_ACCUMULATED`

## A3. Revalidation against the live CI-040/041/042 v2.2/045 state
- **Dependencies (live md5 = tested):**
  - `fn_costing_failure_class` 99dfd612… (live = local test);
  - `v_costing_run_effective_designation` b324068d… (live = local);
  - `costing_automation_setting` columns and range constraint.
- **Fixture stubs:** `fn_india_business_date` and `fn_verify_run_fingerprint` are stubs in the local fixture (test date and stand-in fingerprint) by design; their live bodies are unchanged since CI-040.
- **CI-042 assumptions:** CI-043 does **not** read the status views, the 18/27 columns, the lock RPCs or any CI-042 object. It reads tables, `v_costing_run_effective_designation`, `cron.job` and `cron.job_run_details`. CI-042 v2.2 therefore cannot affect it.
- **Tests:**
  - The main suite `test_v22.sh` applies CI-043 on top of CI-042 v2.2 and runs the H, SW, HQ and HA health sections: 22 health tests, 158/158 overall pass (`TEST_RESULTS_V2_2_main.txt`).
  - New `test_ci043_verify.sh` → `TEST_RESULTS_CI043_verify.txt`: 5/5 pass, under emulated Supabase default privileges. It covers pre on the live-equivalent state, post failing before the apply, the apply, post passing, and rollback + pre passing again.
- **Conclusion: no SQL change was needed.**

## A4. Fresh read-only baseline (18:10 IST; the literals are in the pre-check)
- **Fingerprint for 119/122/143:** 3e5515ed97189b747ea3a8d18c3f4411 ✔
- **Runs:** 118 rows, max 143; none queued or running.
- **Audit:** 17 rows, max 21. **Designations:** 9 rows, max 11. **Fingerprint table:** 28 rows, max 30.
- **Designations:** 119 REFERENCE, 122 APPROVED, 128/136/140 REVOKED, 143 APPROVED.
- **Periods:** Sep LOCKED; Mar/Jun/Jul/Aug/Oct OPEN (Oct stored date 22 Oct).
- **Settings:** 3 (ttl 15, max retries 2, catch-up 1).
- **Cron:** 34 jobs, max id 68. Jobs 66/67/68 are active, with command md5s 0045bba6… / 0045bba6… / c3b74bfc…
- **Latest migration:** 20261027121655 (CI-042 v2.2). CI-043 objects are absent.
- **Expected first output after the apply** (informational, not pass/fail):
  - WARN `REFERENCE_FINGERPRINT_DRIFT` for run 119 (known sales-allocation mismatch);
  - INFO `MONTH_ENDED_UNAPPROVED` for Mar/Jun/Jul/Aug;
  - quarter-lock items where applicable.

## A5. Apply-day checklist (mandatory; the apply is conditional on the pre-check)
1. **Pre-check.** Run `verify_ci043v22_pre.sql`. Every row must pass. Also confirm:
   - the time is more than 1 minute away from a 5-minute mark;
   - the file md5 is 0abdf6f9….

   If any row fails, STOP and report; re-baseline if the difference is a legitimate change.
2. `apply_migration` with the exact file.
3. **Post-check.** Run `verify_ci043v22_post.sql`. Every row must pass. It checks:
   - history and fingerprint unchanged;
   - 12 settings: 3 unchanged + 9 health_*;
   - ACLs, with no anon;
   - STABLE / SECURITY DEFINER / owner;
   - the check runs and returns only ERROR/WARN/INFO;
   - the "no alerts" comment;
   - **no new cron job (34/68)**;
   - CI-042 objects intact.

   Then run `verify_ci043v22_post_rpc.sql` (RPC as authenticated with simulated JWT; anon refused). H23c must show the known WARN REFERENCE_FINGERPRINT_DRIFT for run 119. Rows starting `INFO` list any ERROR/WARN findings for investigation; they do not fail the post-check and do not trigger rollback.
4. **If any post-check row fails:** apply `20261027093000_ci043v22_ROLLBACK.sql`, then re-run the pre-check.
5. Write `APPLIED_CI-043_<date>.md`.

## A6. Rollback
- **Single mode.** The check is read-only, so immediate and after-use rollback are identical. It drops both functions and deletes the 9 CI-043 setting rows (configuration only). No history is affected.
- **Order:** CI-043 must be rolled back before CI-042 (the CI-042 rollback refuses otherwise).
- **Grants:** the rollback re-creates nothing, so there is no default-privilege exposure (checked).

## A7. Remaining risks (honest)
1. **No cut-off warning** (see the summary). This is a separate follow-up.
2. **Visibility.** A report is visible only when someone calls it, until a daily job and alert delivery are separately approved.
3. **Output size.** The first run will show known items (run 119 drift, months ended without approval). This is expected and not a fault.
4. **Exposure to logged-in users.** Any user with the Costing Control Centre permission can read the operational detail, such as cron state and error text. That matches the screen's audience.
5. **`cron.job_run_details` dependency.** If pg_cron's history table is purged, the "not executing" check reports conservatively.
6. **Fixed literals.** The pre/post literals are as of 18:10 IST; a legitimate change requires a re-baseline.

## A8. Timing and notification
- **Scheduled runs:** none of them is affected (it is read-only).
- **Window:** a quiet window on 28 Oct, or any time before or after month-end. Avoid 01:55–03:00 IST on 1 and 2 Nov, the minute around 5-minute marks, and any queued or running run.
- **Jarvis:** notify before (what it is; no alerts; no cron) and after (version, post-check, first report summary).

## A8b. v2.2 statements (required by review)
- **Settings guard.** No silent ON CONFLICT: if any of the 9 `health_*` keys already exists with a different value, the migration aborts with `CI043_SETTING_CONFLICT` and installs nothing; an identical value is a no-op. Pre-check H25 detects this beforehand.
- **Pre-check revalidation.** The pre-check row counts and max ids are revalidated immediately before apply (fresh baseline taken 27 Oct 18:32 IST: all 15 rows + ALL pass). If a row differs because of legitimate activity, the apply stops for investigation or an owner-approved re-baseline; there is never automatic recovery.
- **Processor check scope.** The 30-minute processor check (`QUEUED_PROCESSOR_NOT_EXECUTING`) relates only to an overdue queued run; it is not a general heartbeat. A stopped (inactive) job 66/67/68 is reported as ERROR `JOB_INACTIVE` whether or not a run is queued (tested, C11).
- **Reporting only.** CI-043 only reports when someone calls it; it is not automatic alerting and sends nothing.
- **Operational findings (rev b).** Operational ERRORs (e.g. job 68 stopped) are reported in the post-check `INFO` rows and investigated, but do not count as a CI-043 migration failure and never trigger rollback. The post-check cron row now checks only that the 66/67/68 commands are unchanged; their active state is operational and is reported by JOB_INACTIVE.
- **Rollback precision.** The rollback compares each setting's current value with its installed default: a setting changed and later returned to its default is deleted. It does not claim to preserve a full history of setting changes.
- **Authenticated RPC test scope.** `verify_ci043v22_post_rpc.sql` is a database-level simulation (rolled-back transaction with simulated JWT claims), not a test of the application's Supabase auth path.
- **Rollback.** Immediate rollback removes both functions and all 9 settings; post-use rollback removes the functions, keeps settings changed since install (row, introduced_by and updated_at preserved as the audit trail) and lists them.

## A9. Exact approval sentence
> I approve applying to production project `qhmoqtxpeasamtlxaoak`, via `apply_migration`, migration `20261027093000_ci043v22_costing_health_check.sql` (CI-043 v2.2, md5 cfae78680e4e1c2ddde0661eba8bfd24), which adds the read-only functions `costing.fn_costing_health_check(date)` (owner-only) and `public.rpc_costing_health_check()` (authenticated, no anon), and inserts the 9 `health_*` threshold settings (health_quarter_lock_warn_days 45, health_quarter_lock_info_days 30, health_draft_freshness_days 8, health_draft_review_days 14, health_queued_stuck_hours 2, health_running_stuck_hours 6, health_preview_ack_unused_warn_count 50, health_preview_ack_unused_min_age_days 30, health_retry_overdue_minutes 20) into `costing.costing_automation_setting`, aborting if any exists with a different value, with no policy, view, data or cron change, conditional on `verify_ci043v22_pre.sql` (md5 dd2eb814b6d4ea2cf2d949c8b7962eef) passing in full immediately before apply and the pass/fail rows of `verify_ci043v22_post.sql` (md5 194dd6ec726e07576d7996eb13f8e0d1) plus `verify_ci043v22_post_rpc.sql` (md5 9fbf3517ec96fe92846d692514d0301a) passing after, with operational findings reported for investigation only, with rollback by `20261027093000_ci043v22_ROLLBACK.sql` if any post-check fails, and Jarvis notified before and after. CI-044, any health-check cron job, any alert delivery and the cutoff warning are not approved by this.
