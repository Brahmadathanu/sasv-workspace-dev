# Deployment approval request: CI-040 v2.1 and CI-041 v2.1
Prepared 27 Oct 2026, 08:55 IST. **Nothing has been applied.** This document asks for approval to apply two database migrations to production project qhmoqtxpeasamtlxaoak. CI-042, CI-043 and CI-045 are **not** part of this request; each will be asked for separately, with CI-045 first.

## What you are approving, in plain words

**CI-040: safer approval.**
- **How approval works:** before you approve a costing run, the system must first generate an "approval preview" for you. The preview shows what changes against the current approved run, estimated profit (from CI-037 only), and whether the inputs have changed since the run was costed.
- **What approval requires:** the approval has to quote that preview, and it is accepted only if all of these hold:
  - it is your own preview;
  - it was opened within the last 15 minutes;
  - it has not been used before;
  - nothing has been approved in that month since you opened it.
- **What the record proves:** the system records that the preview was *generated/opened*. It cannot prove that it was read or understood.
- **Superseding:** approving a newer run now replaces the old approved run in the same step. The old run stays stored, unchanged, and is shown as "Superseded".
- **Old approve buttons:** the old approve and supersede functions now refuse with a message pointing to the new route. Nothing in the app calls them today.

**CI-041: automatic drafts that keep their own date, with safe retries.**
- **Weekly draft:** every Monday at 02:00 India time, the current month is costed as of that day.
- **Month-end draft:** on the 1st, the month just ended is costed as of its last day.
- **Dates and pricing:** each run keeps its own date. The month's "stored date" is no longer moved by the scheduler. Drafts continue even in a month that already has an approved run, but they are "not for pricing" until you approve one.
- **Repeat requests:** a repeat request for the same date reuses the run. A deliberate recalculation needs a reason and always creates a new run.
- **Missed month-end:** if the month-end draft was missed, the next Monday adds it, once.
- **Retries:** a failed automatic run is retried only for three known temporary database conditions (deadlock, serialization conflict, lock not available). It is retried at most twice, by a separate retry step that runs within about 5 minutes, and every decision is written to the governance audit.
  - Unknown, data and governance failures are never retried.
  - Governance failures keep blocking that month until fixed; the others let the next schedule continue.

**One known difference from your wording.** You approved retries for SQLSTATE 40P01, 40001 and 55P03. Production does **not store SQLSTATE codes**: the stage processor saves only the error text. The implementation therefore matches the exact PostgreSQL message texts that these three codes produce:

| SQLSTATE | Exact message text matched |
|---|---|
| 40P01 deadlock | `deadlock detected` |
| 40001 serialization failure | `could not serialize access due to concurrent update` / `… concurrent delete` / `… read/write dependencies among transactions` |
| 55P03 lock not available | `could not obtain lock on row in relation "<table>"` / `could not obtain lock on relation "<table>"` / `canceling statement due to lock timeout` |

- **Why exact text is safe:** the server language is English (en_US). Any other text, including statement timeout, is never retried. A statement timeout cannot create a failed run anyway: it rolls back job 68's whole step, which simply runs again 5 minutes later.
- **Capturing the real SQLSTATE later is feasible.** The stage processor's error handler can read it with `GET STACKED DIAGNOSTICS … RETURNED_SQLSTATE` and store it in a new nullable column on `costing_refresh_run`. That requires replacing the large live stage-processor function, so it is proposed as a separate, later change. It is **not** part of this request.

**Why now.** The October month-end draft is due at 02:00 IST on Sun 1 Nov. The current code (CI-039) **skips October**, because October already has approved run 143. With CI-041 live, a draft dated 31 Oct is created at 02:00 IST on 1 Nov (details under "Timing").

**What does not change:**
- runs 119/122/143 and their stored data;
- the price feed (October stays on run 143 until you approve another);
- cron jobs 66/67/68 and their commands;
- the stage processor;
- the app;
- Google Sheets.

No business row is written by either migration, apart from the 3 settings rows (configuration).

## The fresh production baseline (read-only, 27 Oct 2026 08:55 IST)

| Check | Now | Expected | OK? |
|---|---|---|---|
| Combined fingerprint, runs 119/122/143 | `3e5515ed97189b747ea3a8d18c3f4411` | `3e5515ed97189b747ea3a8d18c3f4411` | ✔ |
| Fingerprints per run | 119 `c4cabe14…`, 122 `795193db…`, 143 `1a04c582…` | (as above) | ✔ |
| Stored fingerprint rows | 119 DESIGNATION #1; 122 RUN_SUCCESS #3, DESIGNATION #4, REBASELINE #12; 143 RUN_SUCCESS #28, DESIGNATION #30 | (as above) | ✔ |
| Drift vs stored fingerprint | 119 = 1 table, 122 = 0, 143 = 0 | 119 = 1 (known sales-allocation mismatch, unchanged), 122 = 0, 143 = 0 | ✔ |
| Designated runs (6) | 119 REFERENCE, 122 APPROVED (Sep), 143 APPROVED (Oct), 128/136/140 REVOKED | (as above) | ✔ |
| Latest run id / audit id | run 143 / audit 21 (17 rows); designation 11; fingerprint 30 | (as above) | ✔ |
| Queued or running runs | none | none | ✔ |
| Cron 66 | active; `30 20 * * 0`; `select * from costing.rpc_request_scheduled_costing_refresh_internal();` | (as above) | ✔ |
| Cron 67 | active; `30 20 28-31 * *`; same command | (as above) | ✔ |
| Cron 68 | active; `*/5 * * * *`; `set statement_timeout = '10min'; select public.rpc_process_pending_costing_refresh_stage();` (last success 03:25 UTC today) | (as above) | ✔ |
| Periods | Mar/Jun/Jul/Aug OPEN; Sep LOCKED (10 Sep); Oct OPEN, stored date 22 Oct, DRAFT | (as above) | ✔ |
| CI-040/041 objects already present | none (2 tables and 12 functions checked) | none | ✔ |
| Audit event types | the original 9 | 9 | ✔ |
| Replaced functions: live md5 = package pre-image | all 7 match (appendix A3) | match | ✔ |

**No mismatch was found.**

**Observation, not a blocker:** job 66 on Mon 26 Oct 02:00 IST (25 Oct 20:30 UTC) **failed**. Its audit insert used event_source `CRON_SCHEDULED`, which the constraint did not allow at the time. The constraint now includes `CRON_SCHEDULED`. No 26 Oct weekly draft exists (the latest run is still 143). CI-041 writes `CRON_SCHEDULED` audit rows, which the current constraint allows.

## Apply order (each step is its own `apply_migration`, with a verify step between)
1. Pre-check: run the baseline queries (appendix A2/A3). Everything must equal the table above. If anything differs, stop.
2. Tell Jarvis (see below).
3. `apply_migration` **CI-040**: name `ci040v21_unified_approval_preview_ack`, file `20261027090000_ci040v21_unified_approval_preview_ack.sql` (md5 `ab7fb504…`).
4. Run `verify_ci040v21.sql` and the fingerprint query. The combined value must still be `3e5515ed…`, and max ids must be unchanged (run 143, audit 21, designation 11, fingerprint 30).
5. `apply_migration` **CI-041**: name `ci041v21_scheduler_business_date_retries`, file `20261027091000_ci041v21_scheduler_business_date_retries.sql` (md5 `4408eaff…`). Avoid the 2 minutes around a 5-minute mark (job 68).
6. Run `verify_ci041v21.sql` and the fingerprint query again. The values must be the same as in step 4. Cron rows must be unchanged.
7. If any check fails: run the rollback of the phase just applied (Mode A), CI-041 first if both are applied.

**Version numbers:** the Supabase migration version is assigned by `apply_migration` at apply time. The package filenames carry the intended order (20261027090000 then 20261027091000). Record the assigned versions in the apply log. Never use `supabase db push`.

## Rollback
- **Mode A (immediate, before any use):** restores everything exactly. It was tested to give a catalogue identical to the pre-apply baseline.
  - **CI-041 rollback** restores the 4 replaced functions, including job 68's entry point (byte-identical, md5 81bd56fe…). It drops its 5 new functions and 2 settings rows, and returns the audit constraint to CI-040's list.
  - **CI-040 rollback** restores the 3 replaced functions. It drops its 7 new functions, 2 tables and the trigger, and returns the constraint to the original 9 values.
- **Mode B (after use; nothing deleted):** every run, designation, audit row, acknowledgement and fingerprint stays. Approvals already made stay approved and immutable.
  - **CI-041** keeps its widened constraint if retry audit rows exist. The old CI-039 scheduler is back; it skips approved months, moves the stored date and blocks after a failure.
  - **CI-040** keeps the widened constraint, the acknowledgement table, the settings table and its internal functions. It removes the public preview/approve RPCs, so the old approve/supersede work again.
  - Re-applying after a Mode-B rollback was tested and works.
- **Order:** roll back CI-041 before CI-040 (enforced).

## Timing
- **Job 67 timing:** job 67 fires at 02:00 IST on 29, 30 and 31 Oct and 1 Nov. It only acts when the India date is the 1st, so the October month-end run is **02:00 IST Sun 1 Nov (Sat 31 Oct 20:30 UTC)**.
  - **Old code:** October holds approved run 143, so it is skipped and there is no 31 Oct draft.
  - **New code:** a draft dated 31 Oct is created (not for pricing).
- **Job 66, Mon 2 Nov 02:00 IST:**
  - **Old code:** creates November, moves November's stored date to 2 Nov and drafts it. October's missed month-end is **never** drafted.
  - **New code:** drafts November at 2 Nov without moving any stored date. It adds the missed 31 Oct draft once if 1 Nov did not produce one (tested).
- **Recommendation: apply both before the 1 Nov run,** ideally on Thu 29 or Fri 30 Oct, during the day in India and away from 02:00 IST. Reasons:
  1. The month-end draft is then produced on time, by the normal route.
  2. If something goes wrong, there is still a working day to roll back before the run.
  3. Applying after 1 Nov is still recoverable, because the 2 Nov catch-up adds the 31 Oct draft. Only the timing is lost.

## What to tell Jarvis
Before step 3, send an FYI (non-priority): "CI-040 and CI-041 are being applied now. Approval moves to the preview route, and the old approve/supersede calls will refuse. Scheduled drafts keep their own date. Retries happen only for deadlock, serialization and lock-wait errors. No cron, app or pricing change." Send a second FYI after step 6 with the verify result. Nobody else needs notifying; Finance sees no change until a new approval.

## Remaining integration risks (honest list)
1. **Retry sweep inside job 68:** the sweep now runs inside job 68's transaction (under the 10-minute timeout). It was tested only with a stand-in processor. A sweep error only warns, but a sweep that hit the timeout would roll back that 5-minute tick, which then repeats. The sweep scans only 7 days of failed scheduled runs, so this is very unlikely.
2. **Retry matching is by text, not code:** see the known difference above. It is safe while the server language stays English.
3. **The UI Refresh button still costs at the stored month date** (October = 22 Oct) until the Cursor change (approved for plan mode only) is built and released. The new recalculation function is available but not wired to the app.
4. **No approval screen calls the new preview/approve route yet.** Approvals until then go through a governed SQL/RPC session with the owner's login: `auth.uid()` must be the governance owner, and a service key alone fails.
5. **Production preview speed** is unmeasured. Run EXPLAIN of `costing.fn_costing_approval_preview_core(143)` on apply day (read-only).
6. **Staleness gap:** 3 of the 47 guarded input tables cannot be checked for staleness. A change there after the preview does not invalidate it; the 15-minute expiry limits this.
7. **Test coverage:** the real stage chain, the real 56-table fingerprint and pg_cron firing were tested only with stand-ins and a simulated clock. The production fingerprint above was read live.
8. **Policy comment label:** the CI-040 policy comment text says "(CI-040 v2; …)" although the package is v2.1. The wording itself is the approved v2.1 wording. This is cosmetic.

## Approval sentence (reply with this exact text to approve)
> I approve applying to production project qhmoqtxpeasamtlxaoak, via apply_migration and in this order with verification between, migration 20261027090000_ci040v21_unified_approval_preview_ack.sql (CI-040 v2.1) and then 20261027091000_ci041v21_scheduler_business_date_retries.sql (CI-041 v2.1), introducing policy records COSTING-APPROVAL-POLICY-2026-10-26 and COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26 with the wording in this request, the new tables costing.costing_automation_setting and costing.costing_approval_preview_ack, the new and replaced functions and the trigger listed in appendix A1, three settings rows (approval_preview_ack_ttl_minutes=15, scheduler_max_retries=2, scheduler_catch_up_max_runs=1), and the widening of the audit event-type constraint, with Jarvis notified before and after, and rollback by the package rollback files if any verification fails. CI-042, CI-043 and CI-045 are not approved by this.

---
# Technical appendix

## A1. Objects per migration

**CI-040 v2.1** (`20261027090000_ci040v21_unified_approval_preview_ack.sql`)
- **ALTER (widen only, skipped if already wider):** `cost_period_governance_audit_event_type_chk` gains `STALE_APPROVAL_ACKNOWLEDGED`.
- **NEW table `costing.costing_automation_setting`:**
  - columns: setting_key PK, int_value ≥ 0, unit, description, introduced_by, updated_at;
  - CHECK `costing_automation_setting_range_chk`, one range per key, unknown keys refused;
  - RLS on; owner postgres only (no anon/authenticated/service_role).
  - Row: `approval_preview_ack_ttl_minutes = 15` (range 5–60).
- **NEW table `costing.costing_approval_preview_ack`:** index `costing_approval_preview_ack_run_idx`; RLS on; owner only.
- **NEW trigger `trg_preview_ack_guard`** (BEFORE UPDATE OR DELETE, function `costing.fn_guard_preview_ack()`): no delete; the only update allowed is marking the row used, once.
- **NEW functions:**
  - `costing.fn_costing_run_input_staleness(bigint)`
  - `costing.fn_costing_run_profit_availability(bigint)`
  - `costing.fn_costing_approval_preview_core(bigint)`
  - `costing.fn_w2_approve_unified(bigint,text,text,bigint,boolean,text)`
  - `costing.fn_guard_preview_ack()`
  - `public.rpc_costing_preview_approval_impact(bigint)` (EXECUTE: authenticated, service_role)
  - `public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean)` (EXECUTE: authenticated, service_role; carries the policy comment)
- **REPLACED:**
  - `costing.fn_w2_run_checks(bigint,text)`: the date-match check is dropped and RUN_DATE_NOT_BEFORE_APPROVED is added;
  - `public.rpc_costing_approve_run(bigint,text,text)`: now refuses with W2_USE_NEW_APPROVAL_ROUTE;
  - `public.rpc_costing_supersede_approved_run(bigint,text,text)`: now refuses with W2_USE_NEW_APPROVAL_ROUTE.
- **No view changes.**

**CI-041 v2.1** (`20261027091000_ci041v21_scheduler_business_date_retries.sql`)
- **Rows:** `scheduler_max_retries = 2` (range 0–3), `scheduler_catch_up_max_runs = 1` (range 0–1).
- **ALTER (widen only):** the event-type constraint gains `SCHEDULED_RETRY_REQUESTED`, `SCHEDULED_RETRY_FAILED` and `SCHEDULED_RETRY_LIMIT_REACHED`.
- **NEW functions** (no client grants, except as noted):
  - `costing.fn_request_costing_run_on_date(date,date,text,text,text,uuid,boolean)`
  - `costing.fn_costing_failure_class(text)` (IMMUTABLE)
  - `costing.fn_costing_retry_sweep()`
  - `public.rpc_costing_request_recalculation(date,text,date)` (EXECUTE: authenticated, service_role)
- **REPLACED:**
  - `costing.fn_guard_designated_run_header()`: drafts are allowed in approved months and noted "not for pricing";
  - `costing.rpc_request_scheduled_costing_refresh_internal()`: the scheduler; carries the policy comment;
  - `public.rpc_process_pending_costing_refresh_stage()`: job 68's entry point. Sweep first (isolated), then the identical processor call. Same signature, owner and ACL;
  - `public.rpc_costing_authorise_supersession(date,text,text)`: now returns `{not_required:true}` and writes nothing.
- **Not touched:**
  - cron rows and their commands;
  - `fn_after_refresh_run_au2`;
  - the stage processor;
  - `fn_request_costing_refresh_internal` and `rpc_request_costing_refresh`;
  - `rpc_set_cost_period_valuation_date`;
  - no view changes.

## A2. Policy record wording (exact, as in the SQL comments)
**COSTING-APPROVAL-POLICY-2026-10-26.** Comment on `public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean)`:
> COSTING-APPROVAL-POLICY-2026-10-26 (CI-040 v2; owner decisions 26 Oct 2026, Dr. Brahmadathan U): approval needs reason (>=10 chars), approval reference and a preview acknowledgement (preview_ack_id: proof the preview was generated/opened, not that it was reviewed or understood) recorded by rpc_costing_preview_approval_impact for the same authenticated user and run, unexpired (setting approval_preview_ack_ttl_minutes, default 15), unused and matching the current approved-run state, revalidated under the governance lock; stale drafts need p_acknowledge_stale=true (audited STALE_APPROVAL_ACKNOWLEDGED); a run dated before the month's approved run is refused; an existing APPROVED run is superseded in the same transaction (stored REVOKED, shown Superseded). Old 3-argument approve/supersede calls are refused (W2_USE_NEW_APPROVAL_ROUTE); no emergency route exists in this API.

**COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26.** Comment on `costing.rpc_request_scheduled_costing_refresh_internal()`:
> COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26 (CI-041 v2.1; D1, D3): weekly (Monday, India date) draft at today's India date; month-end (1st) draft at the last day of the month just ended; Monday the 1st runs both. Never moves cost_periods.valuation_date. Drafts continue in months with an APPROVED run (not for pricing until approved). Same month+date from the scheduler reuses the existing run. Failed scheduled drafts (v2.1): only allowlisted transient failures (40P01/40001/55P03 texts, fn_costing_failure_class) are retried, at most scheduler_max_retries per original run, by fn_costing_retry_sweep (run from job 68 every 5 minutes and from this function); every decision is audited; unknown/data failures are never retried and do not block the next schedule; governance failures stay blocking. Weekly adds at most scheduler_catch_up_max_runs catch-up for a missing previous month-end draft.

## A3. Pre-image check: md5 of pg_get_functiondef (live, 27 Oct 08:55 IST = package pre-image)

| Function | md5 | Replaced by |
|---|---|---|
| `costing.fn_w2_run_checks(bigint,text)` | 9ee598acf646fdc2a04395154eea7b46 | CI-040 |
| `public.rpc_costing_approve_run(bigint,text,text)` | 1f6459ac2f334720366de2962238ff03 | CI-040 |
| `public.rpc_costing_supersede_approved_run(bigint,text,text)` | 28f3b2cbcc4b1899f669d6caf2d2848a | CI-040 |
| `costing.fn_guard_designated_run_header()` | 59a4ad34fb5ab8fbfb042fa1f898ee78 | CI-041 |
| `costing.rpc_request_scheduled_costing_refresh_internal()` | 802f50e1aa38439808e00c2659af44db (CI-039) | CI-041 |
| `public.rpc_process_pending_costing_refresh_stage()` | 81bd56fe83b637e00faea546c0065230 | CI-041 |
| `public.rpc_costing_authorise_supersession(date,text,text)` | 0e2f69a09ddc8f5ee1e4fbd7406891bd | CI-041 |
| `costing.fn_after_refresh_run_au2()` | d03176c2b121021b0c5c444938884b4f | not replaced; must be unchanged after apply |

Query used (read-only):
```sql
select p.oid::regprocedure, md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid in (
 'costing.fn_w2_run_checks(bigint,text)'::regprocedure,'public.rpc_costing_approve_run(bigint,text,text)'::regprocedure,
 'public.rpc_costing_supersede_approved_run(bigint,text,text)'::regprocedure,'costing.fn_guard_designated_run_header()'::regprocedure,
 'costing.rpc_request_scheduled_costing_refresh_internal()'::regprocedure,'public.rpc_process_pending_costing_refresh_stage()'::regprocedure,
 'public.rpc_costing_authorise_supersession(date,text,text)'::regprocedure,'costing.fn_after_refresh_run_au2()'::regprocedure);
```

## A4. Combined fingerprint: method and recompute (read-only, before and after each step)
This is the same method as the CI-038/039 verify scripts (`../redesign/verify_ci04*.sql`, block C1):
```sql
select refresh_run_id, md5(costing.fn_compute_run_fingerprint(refresh_run_id)::text) fp_md5 from (values (119),(122),(143)) v(refresh_run_id);
select md5(string_agg(md5(costing.fn_compute_run_fingerprint(r)::text), '|' order by r)) combined from unnest(array[119,122,143]) r;
-- expected: 3e5515ed97189b747ea3a8d18c3f4411 (27 Oct 08:55 IST: matches)
select r, (select count(*) from costing.fn_verify_run_fingerprint(r) where not matches) drifted from unnest(array[119,122,143]) r;  -- 119=1 (known), 122=0, 143=0
select (select max(id) from costing.costing_refresh_run) run_max, (select max(audit_id) from costing.cost_period_governance_audit) audit_max,
       (select max(id) from costing.costing_run_designation) designation_max, (select max(id) from costing.costing_run_fingerprint) fingerprint_max;  -- 143/21/11/30
```

## A5. Verify scripts and expected results
- **`verify_ci040v21.sql`:**
  - the 3 new-route refusals are in place;
  - setting `approval_preview_ack_ttl_minutes=15`;
  - `costing_automation_setting_range_chk` present;
  - both new tables have ACL `{postgres=arwdDxtm/postgres}`;
  - the policy wording check returns true;
  - `fn_costing_approval_preview_core(143)` profit label is "Not available for historical run".
- **`verify_ci041v21.sql`:**
  - settings `scheduler_catch_up_max_runs=1,scheduler_max_retries=2`;
  - the scheduler comment starts `COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26`;
  - the scheduler no longer updates cost_periods (true);
  - the AU2 trigger is untouched (true);
  - the recalculation RPC grant includes authenticated and service_role;
  - cron 66/67/68 are unchanged and active;
  - October's stored date is still 2026-10-22;
  - max run id is 143 (until the next job run);
  - the job-68 entry point shows `plpgsql acl={postgres=X/postgres} calls sweep=true`, and the job-68 command is unchanged;
  - the event types include the 3 SCHEDULED_RETRY_* values;
  - the classifier self-test is true;
  - historical failures the sweep would retry = 0.
- **Before apply:** run A3 and A4 and keep the output. **After each step:** run the phase verify plus A4. A4 must be identical to before.

## A6. Rollback files
- **`20261027091000_ci041v21_ROLLBACK.sql`** (md5 `3a24f559…`): run first. It refuses if CI-042 or CI-043 is present.
- **`20261027090000_ci040v21_ROLLBACK.sql`** (md5 `c377c000…`): it refuses while CI-041 is present.
- **Mode selection:** each file picks Mode A or B automatically and prints which one it used.
- **Tests:** local tests R-A, R-B and R-C passed (27/27 in the rollback suite, 144/144 in the main suite, run on 27 Oct). They were not rerun for this request: no SQL changed.
