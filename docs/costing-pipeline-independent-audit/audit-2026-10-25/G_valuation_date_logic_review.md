# G — Costing period valuation date: how it is set, advanced and locked (review)

> **SUPERSEDED by redesign v2.2 (27 Oct 2026).** This document describes an earlier design. For how costing approval, month-end and locking work now, see [COSTING_REDESIGN_V2_CURRENT_STATE.md](../COSTING_REDESIGN_V2_CURRENT_STATE.md). The text below is kept unchanged as history.
Prepared 26 Oct 2026 (IST). Read-only review of live function bodies in project qhmoqtxpeasamtlxaoak plus docs/costing-pipeline-independent-audit/PERIOD_LIFECYCLE_DESIGN.md.

## 1. What the valuation date is
Each month (cost period) has one valuation date. When a run is requested, the period's date is copied onto the run header (`costing_refresh_run.valuation_date`, "CAPTURED_AT_REQUEST"). After that, every stage reads that date. It does not use "today".
Everything effective-dated is resolved "as of" that date:
- material rates and stock valuation (`fn_resolve_material_rates_as_of`, `fn_resolve_stock_valuation_as_of`)
- BOM revisions and batch-size references
- routes and route families
- MRP, selling-price and GST policies
- scheme policies
- sales assumptions (SKU and regional), sales-allocation defaults
- labour, overhead, QC and stores workload policies
- cost-head ledger, standard rates, capacity rules, and so on (about 140 functions)
So the valuation date answers one question: which version of the master data is this costing using.

## 2. States
Period `status`: OPEN → LOCKED → CLOSED. LOCKED can be reopened. CLOSED is final, enforced by a trigger.
`valuation_date_status`: DRAFT (OPEN), LOCKED (LOCKED), FINAL (CLOSED).
`valuation_date_source`: SYSTEM_DEFAULT, GOVERNED_MANUAL, MIGRATION_BACKFILL.

Live today:

| Month | Status | Valuation date | Source | Runs |
|---|---|---|---|---|
| Mar, Jun, Jul | OPEN/DRAFT | 31 Mar, 30 Jun, 22 Jul | backfill | old drafts |
| Aug | OPEN/DRAFT | 7 Aug | manual | old drafts |
| Sep | LOCKED | 10 Sep | manual | 119 REFERENCE, 122 APPROVED |
| Oct | OPEN/DRAFT | 22 Oct | manual | 143 APPROVED (128/136/140 revoked) |

## 3. Who changes it
- **Period created** (`rpc_ensure_cost_period`, or `rpc_costing_open_next_period`): the default is today for the current month, the month end for a past month, and the 1st for a future month.
- **Manual change** (`rpc_set_cost_period_valuation_date`): OPEN periods only, a reason of at least 10 characters, no queued or running run. It does not check for an approved run. Moving October's date is allowed, but the next run would still need a supersession authorisation.
- **Scheduler** (`rpc_request_scheduled_costing_refresh_internal`). The cron times are in UTC.
  - Job 66, `30 20 * * 0`, runs Mondays at 02:00 IST. Weekly branch: the target is the current month and the cutoff is today. It auto-creates the month's period if missing.
  - Job 67, `30 20 28-31 * *`, runs on the 29th, 30th and 31st and on the 1st at 02:00 IST. The function acts only when the IST day is the 1st. Then the target is the previous month and the cutoff is the previous day (month end). It never creates a period. On the other days it returns NOT_SCHEDULED harmlessly.
  - The checks run in this order:
    1. The period must be OPEN and DRAFT, else PERIOD_NOT_OPEN_DRAFT, a quiet no-op.
    2. No queued or running run.
    3. Not the same cutoff already done, else EXISTING_RUN.
    4. No unresolved failed CRON_SCHEDULED run.
    5. No backdating.
  - Then it **moves the valuation date to the cutoff**, writes an audit row with source CRON_SCHEDULED, and requests a FULL run.
  - **The function does not check for an approved run itself.** The check happens one level down: the run-header trigger `fn_guard_designated_run_header` raises `AU2_PERIOD_HOLDS_APPROVED_RUN` when the period holds an APPROVED run and there is no unused supersession authorisation. The whole statement is one transaction, so the date move and the audit row roll back with it. Nothing is changed silently, but the cron job is logged as FAILED.
  - Today's bug is separate: the audit check constraint allows only MIGRATION, SYSTEM and GOVERNED_RPC, so CRON_SCHEDULED fails before the run is even requested.
  - **Deviation from the design doc:** PERIOD_LIFECYCLE_DESIGN.md said the tick would "advance only SYSTEM_DEFAULT periods with no designation; never GOVERNED_MANUAL or APPROVED-designated periods". The live scheduler drops both conditions. It relies on the AU2 trigger, which turns a "skip" into an error.

## 4. When the scheduler fails or is blocked (after the CRON_SCHEDULED constraint fix)

| Case | Result |
|---|---|
| (a) Period holds an APPROVED run (October now) | **FAILS** with AU2_PERIOD_HOLDS_APPROVED_RUN, everything rolled back. This repeats on every scheduled date for that month. Not harmful, but the cron history shows red. |
| (b) Latest run of the month not approved, or no run approved | **Works.** It moves the date to the cutoff and creates a new draft run. Unapproved runs do not block. Only a QUEUED or RUNNING run blocks (ACTIVE_RUN_PRESENT, a quiet no-op), or an unresolved failed scheduled run (UNRESOLVED_AUTOMATION_FAILURE, a quiet no-op until someone fixes it). |
| (c) Earlier months still open (Mar/Jun/Jul/Aug) | **No effect.** The scheduler only looks at the current month (weekly) or the month just ended (on the 1st). Old open months are never touched or required. |
| (d) Month rollover | On the 1st, job 67 tries the month just ended: a cutoff at month end, then case (a) or (b). The first Monday of the new month, job 66 creates the new period (date = that Monday) and drafts it. If the 1st is a Monday, only the month-end branch runs, so the new month waits until the next Monday. This is a small gap. |

## 5. Upcoming dates (assuming only the constraint is fixed)
- **Mon 26 Oct 02:00:** already failed, because of the constraint bug. A rerun after the fix would fail on AU2 (run 143 approved). October is unchanged.
- **Thu 29, Fri 30, Sat 31 Oct (job 67):** NOT_SCHEDULED, no change. Job 67 is now paused anyway.
- **Sun 1 Nov 02:00 (job 67):** target October, cutoff 31 Oct. It would try to move October to 31 Oct and request a run. That **fails** on AU2 and rolls back. October stays at 22 Oct with run 143. It would not run, because job 67 is paused.
- **Mon 2 Nov 02:00 (job 66):** creates November (OPEN/DRAFT, valuation date 2 Nov, SYSTEM_DEFAULT) and requests the first November draft run. **This works**, and job 68 processes it. It is the first natural run for CI-037 profit columns.
- **Mon 9, 16, 23, 30 Nov:** each week moves November's date forward and produces a new draft. Once a November run is approved, every later Monday **fails** on AU2.
- **Tue 1 Dec (job 67):** if November is approved, it fails. If not, it moves November to 30 Nov and drafts.

Answer to the user: **No. The weekly job does not fail because the last run is unapproved. It fails only when the month already has an APPROVED run.**

## 6. What locking protects beyond run immutability
An approved run is already protected:
- The run header can't change (AU2 trigger).
- Its snapshot rows are fingerprinted (`fn_verify_run_fingerprint`).
- A new run in its month needs a recorded supersession authorisation, valid for 120 minutes and single-use.
- The "frozen-through" date (`fn_frozen_valuation_through`) is the greatest of the APPROVED/REFERENCE run dates **and** the LOCKED/CLOSED period dates. It is used by the back-dating guard on about 45 policy tables, so nobody can enter master data effective on or before an approved date. Approval alone already sets this (currently 22 Oct, from run 143).

On top of that, the explicit period LOCK adds only three things:
1. While LOCKED, even an owner with a supersession authorisation can't start a run or move the date without first reopening. This is a second key on the same door.
2. Locking checks that the approved run's date matches the period date and that the fingerprints have not drifted. It is a good final self-check.
3. LOCKED is a required step before CLOSED. CLOSED is truly final (no reopen ever) and marks the valuation FINAL.

**Honest assessment:**
- The day-to-day protection comes from approval, not from the lock. LOCK is mostly redundant with approval plus the AU2 guard.
- Its real value is as a step before CLOSE (year-end, audit sign-off).
- It is *not* needed for pricing, and nothing reads or requires it monthly. Four months have stayed open with no harm.
- The real extra manual work today is not the lock. It is that the scheduler errors in every approved month, and that the valuation date drifts on draft months.

## 7. Manual steps per month today
1. Review the drafts.
2. Approve one run, which is required.
3. Optionally, lock.
4. Optionally, close later.

Opening the next month is automatic, on the first Monday. A manual valuation date is optional. If a correction is needed after approval: authorise supersession, run, then approve the new run. If the month is locked, reopen first.

## 8. Simplification options (approved-run immutability unchanged in all)
**Option 1 (recommended, small CI-039):** make the scheduler skip, not fail.
- Fix the audit constraint (add CRON_SCHEDULED).
- In the scheduler, before moving the date, return a quiet `PERIOD_HOLDS_APPROVED_RUN` when the month has an APPROVED run and no unused supersession authorisation.
- Optionally restore the design rule: don't move a GOVERNED_MANUAL date.
- Also handle "the 1st is a Monday" by doing both branches.
- Trade-off: none of substance. It is safe to resume job 67 afterwards.

**Option 2:** make locking optional and derive it from approval.
- Document LOCK as "only needed before CLOSE". Screens show "Approved = frozen".
- Optionally lock automatically on approval, and close in batches at quarter or year end.
- Trade-off: you lose the "second key" after approval. Superseding stays governed by the authorisation.

**Option 3 (later, bigger):** keep weekly drafts running after approval, as "shadow" runs that can never be designated and don't move the period date. They would show drift against the approved figure.
- Trade-off: needs changes to the AU2 trigger and the designation rules. More runs and more storage. Not needed now.

**Not recommended:**
- removing the back-dating (frozen-through) guard
- changing approved-run immutability
- letting the scheduler move a date on an approved month

**Recommendation:** Option 1 now, before 1 Nov is not required because job 67 is paused. Do it before 30 Nov. Adopt Option 2 as policy (no code needed yet). Keep Option 3 parked.

## 9. Unverified
- Jobs 66 and 67 behaviour after the fix is reasoned from function bodies, not executed.
- The interaction of job 68 with a November run is not tested (it processed manual runs fine).

## 10. Live actions taken 26 Oct 2026 (authorised, chat t158u)
- **Job 67 paused.** It was `costing_monthend_draft_0200_IST`, `30 20 28-31 * *`, active=true; it is now active=false. Jobs 66 and 68 are unchanged (active). To resume: `select cron.alter_job(67, active := true);`
- **CI-038 applied** via MCP apply_migration as live version 20261026022352 (07:53 IST). All checks passed:
  - 5 triggers on product_skus.
  - anon has no access to the RPC, helper or log. Authenticated can call only the check RPC and the set-active RPC.
  - The RPC is patched.
  - 0 of 627 active SKUs fail.
  - Fingerprint hashes are unchanged: 119 `681a7e47…` (1 pre-existing drift in sku_sales_allocation_basis_snapshot, column-set change, present before apply), 122 `7ddd336c…`, 143 `8363398f…`.
  - October period is untouched.
- **October readiness rebuilt.** Build 5 (period Oct, valuation date 22 Oct, evidence run 143) completed at 07:56 IST, is_current, 1,793 items.
  - Active SKUs: 560 READY, 67 REVIEW_REQUIRED, 0 BLOCKER.
  - SKUs 333, 603 and 1797 are READY.
  - No new runs or period audit rows.
