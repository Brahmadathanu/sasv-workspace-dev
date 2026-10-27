# Deployment-approval request: CI-042 v2.2 (lock is a state change only; validated quarterly batch lock; richer status views)

Prepared on Tue 27 Oct 2026, 17:10 IST. This is preparation only: nothing has been applied. Production project: `qhmoqtxpeasamtlxaoak`.

This version replaces the v2.1 request (kept in `superseded_v21/`). It makes the three corrections from your independent review (ChatGPT, 27 Oct) and fixes one grant problem.

## Plain-language summary (for the owner)

**What it is.** CI-042 is the next step of the costing redesign. CI-040, CI-041 and CI-045 are already live. CI-042 changes how months are **locked** and adds clearer status information. The review accepted the design in principle.

**What changes for you:**
1. **Approving freezes the numbers. Locking only changes the month's state.** Locking no longer moves or checks the stored date. The month's **official date** is the date of its approved run.
2. **Months are locked only before a formal Close, one quarter at a time.** The batch lock is all-or-nothing. It now **refuses** a wrong selection, and locks nothing, when the list:
   - is empty or has blank entries;
   - repeats a month;
   - has a date that is not the 1st of a month;
   - mixes months from different quarters;
   - names a month that does not exist.

   Each refusal has its own clear error code. Locking a single month is still possible for authorised exceptions.
3. **Month-end finalise approves but does not lock.** It goes through the CI-040 preview-and-acknowledge route. The old route refuses and points to the new one.
4. **Richer status view.** It shows the official date, the latest draft, newer drafts and superseded runs, plus a per-run label (Reference, Approved, Superseded, Draft).

**Review corrections made:**
- **Safe rollback.** Undoing CI-042 alone now keeps a working month-end finalise, by default. The full "restore everything" mode is used only when rolling back the whole chain, and only with an explicit switch. It cannot be chosen by accident.
- **Stricter batch-lock checks**, as listed in point 2.
- **Mandatory checks before and after the apply:** fingerprints, audit history, permissions, view columns and the state of the approved runs. **The apply goes ahead only if the pre-check passes, and a failed post-check triggers the rollback.**

**Extra problem found and fixed:**
- **What was wrong.** Supabase's default settings would have given anonymous (not logged-in) users full access to one new view (and to one restored view after a rollback).
- **What v2.2 does.** It sets the permissions explicitly. Anonymous users get nothing; logged-in users get read-only access, which the view also filters by permission.

**What does not change:**
- numbers;
- runs 119/122/143 and their fingerprint;
- September (LOCKED) and October (OPEN);
- how the approved run is chosen;
- the cron jobs and the 1 Nov / 2 Nov scheduled runs.

No back-dating of dates, no artificial approvals, no lock bypass. June–August stay a separate governance matter.

**Policy record.** `COSTING-LOCK-BEFORE-CLOSE-POLICY-2026-10-26` is stored as the comment on the batch-lock function. Its wording is unchanged from v2.1: "normally in quarterly batches (all-or-nothing)" already covers the new checks.
> COSTING-LOCK-BEFORE-CLOSE-POLICY-2026-10-26 (CI-042 v2; D1, D7): approval alone freezes the numbers; lock months only to prepare a formal Close, normally in quarterly batches (all-or-nothing). Lock changes only the month state; the official date is the approved run's own date (derived, never moved). Month-end finalise approves with a preview acknowledgement and does not lock.

**Tests (isolated local database only):** main 158/158, rollback 35/35, verification scripts 7/7.

**Recommendation.** Apply in a quiet window on 27 or 28 Oct (IST), before the October month-end approval. Do not apply within a minute of a 5-minute mark, or while a run is queued or running. Notify Jarvis before and after. Your approval sentence is in A9.

---

# Technical appendix

## A1. Files and version
| Item | Value |
|---|---|
| Migration | `20261027092000_ci042v22_lock_state_only_status_views.sql` (md5 d94771dd1e06646a1db705a2dd90ef49) |
| Intended version | `20261027092000`. apply_migration records the UTC apply time; the name will be `ci042v22_lock_state_only_status_views`. |
| Pre-check (mandatory) | `verify_ci042v22_pre.sql` (md5 ee18924701e2703859b5d03a6f435912): 17 checks + an `ALL PRE-CHECKS PASS` row |
| Post-check (mandatory) | `verify_ci042v22_post.sql` (md5 6862dc772852c19228914f19a2cef29b): 20 checks + an `ALL POST-CHECKS PASS` row |
| Rollback | `20261027092000_ci042v22_ROLLBACK.sql` (md5 84dafeefd0f46ebdbfd6e560b21c17d6) |
| Method | Supabase MCP `apply_migration` only, never `supabase db push` |

## A2. Objects
**Replaced** (same signatures; ACLs are kept and checked):

| Object | Change | Live md5 = pre-image |
|---|---|---|
| `public.rpc_costing_lock_period(date,text,text)` | State-only lock. The date-mismatch check and date alignment are removed; the active-run and fingerprint checks are kept. Still available for single-month exceptions. | 95612aa4… ✔ |
| `public.rpc_costing_finalize_monthend_run(bigint,text,text)` | Refuses with `W2_USE_NEW_APPROVAL_ROUTE` and writes nothing. | 1b221c05… ✔ |
| VIEW `costing.v_costing_period_run_status` | 18 columns unchanged; 9 appended. | d38be6e4… ✔ |
| VIEW `public.v_costing_pricing_period_run_status` | The same, same filter. | 49034542… ✔ |

**New:**
- `public.rpc_costing_lock_periods_for_close(date[],text,text)`: validated, all-or-nothing, one quarter per batch. It carries the policy comment.
  - Error codes: `W2_BATCH_NULL_ARRAY`, `W2_BATCH_EMPTY`, `W2_BATCH_NULL_ELEMENT`, `W2_BATCH_DUPLICATE_MONTH`, `W2_BATCH_NOT_FIRST_OF_MONTH`, `W2_BATCH_MIXED_QUARTER`, `W2_BATCH_UNKNOWN_MONTH`.
  - Any per-month refusal rolls back the whole batch.
- `public.rpc_costing_finalize_monthend_run_with_preview(bigint,text,text,bigint,boolean)`: calls `costing.fn_w2_approve_unified(...,'FINALIZE_MONTHEND')` and does not lock.
- `costing.v_costing_run_display_status`: SELECT for service_role only.
- `public.v_costing_pricing_run_display_status`: SELECT for authenticated and service_role, nothing for anon. The rows are permission-filtered.

**Designed ACLs** (checked by the post-check):
- **All 4 functions:** owner postgres, SECURITY DEFINER, `{postgres=X,authenticated=X,service_role=X}`, no anon or PUBLIC.
- **Status views:** unchanged from live.
- **Run-display views:** as listed above.

## A3. Compatibility with the live CI-040/041/045 state (read-only, 17:00 IST)
- **Replaced objects:** all 4 still match the tested pre-images (md5 checked).
- **Dependencies:** `fn_w2_approve_unified` (6 arguments) is live. CI-045 does not interact with CI-042.
- **Callers:**
  - no cron job or database function calls the replaced objects;
  - the app's run-status badge reads only unchanged columns.
- **Default privileges:** production's `pg_default_acl` gives anon, authenticated and service_role ALL on new public tables and views and EXECUTE on new public functions. This is the cause of the grant fix in v2.2. The tests now emulate it.

## A4. Fresh read-only baseline (17:00 IST; these literals are built into the pre- and post-check)
- **Fingerprint for 119/122/143:** 3e5515ed97189b747ea3a8d18c3f4411 ✔
- **Runs:** 118 rows, max 143; none queued or running.
- **Audit:** 17 rows, max 21. **Designations:** 9 rows, max 11. **Fingerprint table:** 28 rows, max 30.
- **Effective designations:** 119 REFERENCE, 122 APPROVED, 128/136/140 REVOKED, 143 APPROVED.
- **Periods (status : stored date):**

  | Month | Status | Stored date |
  |---|---|---|
  | 2026-03 | OPEN | 03-31 |
  | 2026-06 | OPEN | 06-30 |
  | 2026-07 | OPEN | 07-22 |
  | 2026-08 | OPEN | 08-07 |
  | 2026-09 | LOCKED | 09-10 |
  | 2026-10 | OPEN | 10-22 |

- **Cron 66/67/68:** active. Command md5s 0045bba6… / 0045bba6… / c3b74bfc…
- **Latest migration:** 20261027064617 (ci045). No CI-042 objects exist.

## A5. Apply-day checklist (mandatory; the apply is conditional on the pre-check)
1. **Pre-check.** Run `verify_ci042v22_pre.sql`. Every row must be `pass=true`, including `ALL PRE-CHECKS PASS`. Also confirm:
   - the time is more than 1 minute away from a 5-minute mark;
   - the file md5 is d94771dd….

   If any row fails, **do not apply**; report the difference. If a legitimate change has happened, such as a new approved run or audit row, re-baseline and ask the owner again.
2. `apply_migration` with the exact file text.
3. **Post-check.** Run `verify_ci042v22_post.sql`. Every row must be `pass=true`. It checks:
   - the history is unchanged (fingerprint, counts and max IDs, designations, periods);
   - the bodies are correct, including the batch validation;
   - the ACLs of all 8 objects, and no anon privilege;
   - 18+9 columns with identical names, types and order in both views;
   - the exact policy wording;
   - official dates of Oct 22 Oct and Sep 10 Sep;
   - the per-run labels;
   - cron.
4. **If any post-check row fails:** apply `20261027092000_ci042v22_ROLLBACK.sql` with no flag. It runs in Mode B by default because CI-040 is live. Then re-run the pre-check, whose structural rows must pass again, and report.
5. Write `APPLIED_CI-042_2026-10-xx.md`.

## A6. Rollback (`20261027092000_ci042v22_ROLLBACK.sql`)
- **Default: Mode B.** This applies whenever CI-040 is live, before or after use, with no flag.
  - **Kept:** the preview month-end finalise (it keeps working) and the strictly refusing old 3-argument finalise.
  - **Restored:** the pre-CI-042 lock (stored date must equal the approved date; align first with the audited `rpc_set_cost_period_valuation_date`), the status views with their exact live ACLs.
  - **Removed:** the batch lock and the run-display views.
  - **What stays:** locked months stay locked and all history is kept.
- **Mode A: full reverse chain (043→042→041→040) only.** Prepend `SET costing.ci042_rollback_mode='A_FULL_CHAIN';` to the file in the same session.
  - It is refused after any CI-042 use (`CI042_ROLLBACK_MODE_A_AFTER_USE`).
  - Any other value, such as `'A'`, is refused (`CI042_ROLLBACK_MODE_INVALID`).
  - It restores every object exactly, and CI-040's rollback must follow.
- **Tested:** R-A, R-B, R-D1–12, R-F1–6 and R-G1–2 pass.

## A7. Remaining risks (honest)
1. **Stored vs official date.** After the 31 Oct month-end run is approved, October's official date will be 31 Oct while the stored date stays 22 Oct (by design). Screens must use `official_valuation_date`. After a Mode B rollback, locking October needs a date alignment first.
2. **June–August cannot be locked** until they have approved runs. This is a separate governance item; there is no bypass.
3. **Quarter rule.** The batch accepts any subset of one calendar quarter. It does not require all three months, or that earlier quarters are already locked. Whole-quarter completeness is a Close-time decision. Tell me if you want it enforced.
4. **No UI yet** for the new finalise and batch lock (Cursor brief, plan mode).
5. **Policy location.** The policy is a function comment, not a table row.
6. **Fixed baseline literals.** The checks contain the 17:00 IST literals. Any legitimate change before the apply (for example a new audit row) makes the pre-check fail on purpose; it must then be re-baselined.
7. **Test scope.** The tests ran on a local fixture with emulated default privileges, not on production data volumes.
8. **Wider observation (not part of CI-042).** The default-privilege issue may also affect objects that other rollbacks re-create in schema `public`, such as the CI-040 rollback. Live CI-040 objects have correct ACLs (checked). I recommend a separate read-only review of the CI-040/041 rollback ACLs.

## A8. Timing and notification
- **Scheduled runs:** none of them is affected. Jobs 67 and 66 only create drafts.
- **Window:** 27–28 Oct IST, quiet, before the October month-end approval. Avoid 01:55–03:00 IST on 1 and 2 Nov.
- **Jarvis:** notify before the apply (what changes) and after (version, post-check result, new routes).

## A9. Exact approval sentence
> I approve applying to production project `qhmoqtxpeasamtlxaoak`, via `apply_migration`, migration `20261027092000_ci042v22_lock_state_only_status_views.sql` (CI-042 v2.2), which replaces `public.rpc_costing_lock_period` (state-only lock, no date alignment) and `public.rpc_costing_finalize_monthend_run` (refuses, points to the new route), replaces the views `costing.v_costing_period_run_status` and `public.v_costing_pricing_period_run_status` (18 columns unchanged, 9 appended), adds `public.rpc_costing_lock_periods_for_close` (validated, one quarter, all-or-nothing), `public.rpc_costing_finalize_monthend_run_with_preview`, `costing.v_costing_run_display_status` and `public.v_costing_pricing_run_display_status`, and records the policy `COSTING-LOCK-BEFORE-CLOSE-POLICY-2026-10-26` with the wording in APPROVAL_REQUEST_CI-042.md; conditional on `verify_ci042v22_pre.sql` passing in full before the apply and `verify_ci042v22_post.sql` after it, with rollback by `20261027092000_ci042v22_ROLLBACK.sql` (default mode B) if the post-check fails; with no data or cron change and Jarvis notified before and after. CI-043 and CI-044 are not approved by this.
