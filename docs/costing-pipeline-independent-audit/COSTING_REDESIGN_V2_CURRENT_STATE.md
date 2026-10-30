# Costing redesign v2 — current state

**Checked read-only on production on 27 Oct 2026, 21:40–22:00 IST** (project qhmoqtxpeasamtlxaoak, SELECT only). This page describes how costing approval, month-end and locking work **now**. Where older documents (G, J, W2 design, Step 166, the historical first-governed-run runbook) say something different, this page wins.

## 1. The design in plain words
- **Each run keeps its own valuation date, and it never changes.** A run's date is captured when the run is requested (scheduled drafts and the new recalculation route set it themselves; the legacy Refresh button copies the month's stored date, see §9).
- **The month's official valuation date comes from its approved run.** It is the approved run's own date. It is worked out (derived) each time from the approved run; it is not read from the month's stored date. A month with no approved run has no official date.
- **The month's stored date is a legacy field kept for compatibility.** It is not moved by the scheduler, approval, month-end finalise or lock, and it can legitimately stay at an older value. Example: October's stored date is 22 Oct; if a 31 Oct month-end run is later approved, October's official date becomes 31 Oct while the stored date can stay 22 Oct.
- **Drafts keep coming after approval.** Weekly drafts (Monday) and the month-end draft (on the 1st, for the month just ended) continue. A new draft never replaces the approved run by itself. Exact timing: §5.

### 1a. Official date vs legacy stored date (checked read-only 27 Oct 2026)
| | Official valuation date | Legacy stored month date |
|---|---|---|
| Where it comes from | The approved run's own date (`costing_refresh_run.valuation_date` of the APPROVED run) | Column `costing.cost_periods.valuation_date` |
| Where to read it | `official_valuation_date` (same as `approved_run_valuation_date`) in `costing.v_costing_period_run_status` / `public.v_costing_pricing_period_run_status` | `valuation_date` in the same views, or `cost_periods` |
| Who or what uses it | Pricing labels (`pricing_use_label`), month-end and approval decisions, screens (planned) | Only the legacy Refresh button route (`rpc_request_costing_refresh` copies it into the new run) and the legacy setter `rpc_set_cost_period_valuation_date` |
| Changed by | Approving a different run | Only the legacy setter (audited, needs reason) |
| Can they differ? | Yes, by design | Yes, by design |
| October 2026 today | **22 Oct** (approved run 143) | **22 Oct** (status DRAFT) — same value today, by coincidence of history |
| September 2026 today | 10 Sep (run 122) | 10 Sep (LOCKED) |
| June, July, August 2026 | none (no approved run) | 30 Jun, 22 Jul, 7 Aug |

Screens must label runs with the official date and the run's own date, never with the stored date.
- **Approval is one governed step with a preview.** The owner first opens a preview (it shows the impact, SKU changes, whether the run is stale, any cutoff message). Opening the preview writes a short-lived acknowledgement (valid 15 minutes). Approval must quote that acknowledgement. If a run is already approved for the month, the new approval supersedes it in the same step.
- **Month-end finalise** uses the same preview + acknowledgement and approves the month-end run; it no longer locks the month.
- **Locking only changes the lock state.** Locking a month (single month, or several months at quarter close) does not change any date or run. Locking requires an approved run and no run in progress.
- **Health check (reports only).** One read-only report lists problems as ERROR / WARN / INFO. It sends no alerts and is not scheduled; someone must call it.
- **Provenance guard (CI-045).** The approved and reference runs are protected so their source data cannot be changed underneath them.
- **The old routes are closed.** The old three-argument approve and month-end finalise functions still exist but now refuse with `W2_USE_NEW_APPROVAL_ROUTE` and write nothing.

## 2. Applied changes
| Change | What it did | Live version | Applied (IST) |
|---|---|---|---|
| CI-038 | SKU activation guard | 20261026022352 | 26 Oct |
| CI-039 | Scheduler: skip approved months, Monday first; allows audit source `CRON_SCHEDULED` | 20261026050322 | 26 Oct 10:33 |
| CI-038a | Activation checked as of today | 20261026083214 | 26 Oct |
| CI-040 v2.1 | Preview + acknowledgement, unified approve/supersede, old approve route closed | 20261027033918 | 27 Oct 09:09 |
| CI-041 v2.1 | Scheduler uses the India business date; limited retries | 20261027034040 | 27 Oct 09:10 |
| CI-045 | Provenance guard for designated runs | 20261027064617 | 27 Oct 12:16 |
| CI-042 v2.2 | Lock changes lock state only; quarter batch lock; month-end finalise with preview; display/status views | 20261027121655 | 27 Oct 17:46 |
| CI-046 | Lock routes owner-only (W2_OWNER_ONLY) | 20261029152138 | 29 Oct 20:51 |
| CI-047 | PUBLIC execute removed from 37 costing functions | 20261029152614 | 29 Oct 20:56 |
| CI-043 v2.2 rev B | Read-only health check + 9 adjustable thresholds | 20261027153126 | 27 Oct 21:01 |

Approval requests, summaries and apply records: [redesign-v2/](redesign-v2/).

## 3. Functions the app may call (exact names, from production)
| Purpose | Function | Who can call |
|---|---|---|
| Preview before approval (writes a 15-min acknowledgement) | `rpc_costing_preview_approval_impact(p_refresh_run_id bigint)` | logged-in users with costing permission |
| Approve (supersedes the current approved run if any) | `rpc_costing_approve_run_with_preview(p_refresh_run_id bigint, p_reason text, p_approval_reference text, p_preview_ack_id bigint, p_acknowledge_stale boolean)` | owner only (server checks) |
| Month-end finalise | `rpc_costing_finalize_monthend_run_with_preview(` same five arguments `)` | owner only |
| Lock one month | `rpc_costing_lock_period(p_period_start date, p_reason text, p_approval_reference text)` | costing edit permission **and owner only** (CI-046, 29 Oct) |
| Lock several months (quarter close) | `rpc_costing_lock_periods_for_close(p_period_starts date[], p_reason text, p_approval_reference text)` | costing edit permission **and owner only** (CI-046) |
| Health report | `rpc_costing_health_check()` | logged-in users with costing view permission; not anonymous |
| Request a recalculation draft (new, CI-041) | `rpc_costing_request_recalculation(p_period_start date, p_reason text, p_valuation_date date default null)` | costing edit permission, logged in; reason ≥ 10 characters |
| Request a refresh (legacy; used by today's Refresh button) | `rpc_request_costing_refresh(p_period_start date, p_requested_scope text, p_source_trigger text, p_request_note text)` | costing edit permission; **copies the stored month date** |
| Set month stored date (legacy; do not use) | `rpc_set_cost_period_valuation_date(p_period_start date, p_valuation_date date, p_reason text, p_approval_reference text)` | unchanged |
| Closed (refuse with `W2_USE_NEW_APPROVAL_ROUTE`, write nothing) | `rpc_costing_approve_run(bigint,text,text)`, `rpc_costing_finalize_monthend_run(bigint,text,text)`, `rpc_costing_supersede_approved_run(bigint,text,text)` | — |

Screens should read labels from `public.v_costing_pricing_run_display_status` (Draft / Approved / Reference / Superseded / Failed / Cancelled, with a ready-made label) rather than work them out.

## 4. Settings (table `costing.costing_automation_setting`, changeable only by governed update)
| Setting | Value | Meaning |
|---|---|---|
| approval_preview_ack_ttl_minutes | 15 | how long a preview acknowledgement stays valid |
| scheduler_catch_up_max_runs | 1 | catch-up drafts allowed per scheduler pass |
| scheduler_max_retries | 2 | retries for a temporary scheduled failure |
| health_quarter_lock_warn_days / _info_days | 45 / 30 | days after quarter end before WARN / INFO about unlocked approved months |
| health_draft_freshness_days / health_draft_review_days | 8 / 14 | no fresh draft for the open month / newer draft waiting for review |
| health_queued_stuck_hours / health_running_stuck_hours | 2 / 6 | run stuck queued / running |
| health_preview_ack_unused_warn_count / _min_age_days | 50 / 30 | pile-up of unused old preview acknowledgements |
| health_retry_overdue_minutes | 20 | temporary failure with no retry decision |

## 5. Scheduled jobs and month-end timing (unchanged by v2; checked read-only in `cron.job` on 27 Oct 2026)
Cron schedules on this database are in **UTC**. IST = UTC + 5:30.
| Job | Cron expression (UTC) | Fires (IST) | Calls |
|---|---|---|---|
| 66 `costing_weekly_draft_0200_IST` | `30 20 * * 0` | Every Monday 02:00 IST (Sunday 20:30 UTC) | `costing.rpc_request_scheduled_costing_refresh_internal()` |
| 67 `costing_monthend_draft_0200_IST` | `30 20 28-31 * *` | 02:00 IST on the 29th, 30th, 31st **and the 1st** of the next month (UTC days 28–31 at 20:30) | the same function |
| 68 `costing_stage_processor_5min_governed` | `*/5 * * * *` | every 5 minutes | `public.rpc_process_pending_costing_refresh_stage()` (works through queued runs) |

There is no health-check job and no alerting. Job 61 no longer exists.

**(a) When job 67 executes.** At 20:30 UTC on UTC days 28–31, i.e. 02:00 IST on the following IST day: in a 31-day month the 29th, 30th, 31st and the 1st; in a 30-day month the 29th, 30th and the 1st; after February (28 days) only on 1 March. Because the UTC days always include the month's last day, one firing always lands on the 1st (IST).

**(b) When an eligible month-end draft is created.** The function first works out today's **India business date** (`costing.fn_india_business_date()`, Asia/Kolkata). It only creates a month-end draft when that date is the **1st**. On the 29th–31st it does nothing except the retry sweep and returns `NOT_SCHEDULED` (unless that day is a Monday, when the weekly branch runs). On the 1st it drafts the month just ended, if all of these hold:
- the month exists and is OPEN with stored-date status DRAFT (a LOCKED month is skipped: `PERIOD_NOT_OPEN_DRAFT`);
- the draft date is not earlier than the approved run's date (otherwise `SKIPPED_BEFORE_APPROVED_DATE`);
- the latest scheduled run of that month did not fail for a governance reason (otherwise `GOVERNANCE_FAILURE_BLOCKS`);
- no run for that month is queued or running (otherwise it returns `ACTIVE_RUN_PRESENT` and creates nothing);
- no duplicate: if a scheduled run at the same date already succeeded, it is reused (`EXISTING_RUN`).
If the 1st produced nothing, the next **Monday** weekly pass adds the missed month-end draft once (`CATCH_UP_RUN_CREATED`), only if no scheduled or successful run exists at that date. When the 1st is a Monday, both month-end and weekly drafts are created.

**(c) Which valuation date it gets.** The **last day of the month just ended**. Weekly drafts get the Monday's India date, in the current month.

**October 2026 example.**
- 29, 30, 31 Oct 02:00 IST (Thu, Fri, Sat): job 67 runs, result `NOT_SCHEDULED`; no draft.
- **Sun 1 Nov 02:00 IST** (Sat 31 Oct 20:30 UTC): job 67 creates the **October month-end draft dated 31 Oct** (October is OPEN/DRAFT; 31 Oct is not before run 143's 22 Oct). Job 68 then costs it. It is labelled "not for pricing"; run 143 stays approved until the owner approves otherwise.
- **Mon 2 Nov 02:00 IST**: job 66 creates November's period if needed and a **November weekly draft dated 2 Nov**. The October catch-up is skipped because 1 Nov already produced the 31 Oct draft.
- November month-end: job 67 fires 29 and 30 Nov (nothing) and **Tue 1 Dec 02:00 IST** (30 Nov 20:30 UTC), which drafts November dated 30 Nov.
- The stored date is not moved by any of these.

## 6. Baseline and known findings (27 Oct 2026)
- Fingerprint of runs 119/122/143 (combined): `3e5515ed97189b747ea3a8d18c3f4411`.
- Runs: 119 REFERENCE, 122 APPROVED, 143 APPROVED (October), 128/136/140 REVOKED. September LOCKED; March, June, July, August, October OPEN (October stored date 22 Oct).
- Health check on 27 Oct 21:01 IST: **no ERROR**, two WARNs:
  - `REFERENCE_FINGERPRINT_DRIFT` run 119 — known and expected (one source table changed after run 119 was captured as reference).
  - `JOB_RECENT_FAILURE` job 66 — a single failure on **26 Oct 02:00 IST** (`cost_period_governance_audit_event_source_chk`): the scheduler wrote audit source `CRON_SCHEDULED`, which the check did not yet allow. CI-039 (applied 26 Oct 10:33 IST) added that value. Checked read-only in `cron.job_run_details`: no failures of jobs 66/67/68 since. The WARN clears when the failure is older than 7 days (2 Nov).

## 7. Known risks
- The preview writes a row on production each time it is opened; test previews must not be run against production.
- The health check only reports when called; nobody is alerted automatically.
- The month's stored date (legacy setter) still exists and the legacy Refresh button still copies it into new runs (October: 22 Oct). Screens must not use it to label runs. See §9.
- Rolling back CI-043 keeps settings changed after install; one changed and later set back to the default is deleted (no full change history).

## 8. Open items (not approved, separate decisions)
- **CI-044** — parked.
- **Health-check schedule and alert delivery** — not approved.
- **Backdating cutoff warning** — investigation pending.
- **Approval screen** (`COSTING_APPROVAL_SCREEN_V1`, off by default) — **shipped** in PR #99 (main `e2c5fde`, 29 Oct); first production walkthrough pending.
- **Refresh with date + date labels** (`COSTING_RECALC_WITH_DATE_V1`, off by default) — **shipped** in PR #100 (main `008fc26`, 30 Oct); hides the old change-date tab while on.
- **Lock screen** (`COSTING_LOCK_SCREEN_V1`, cache v378) — Codex Phase A request ready (30 Oct).
- **CI-049** month-ended lock guard — drafted, not authorised. **CI-048** health-check log/alerts — design only.

## 9. Legacy screen boundaries (checked in the repo on 27 Oct 2026; no code changed)
| Screen element today | File | Server route it calls | Status | Use meanwhile? |
|---|---|---|---|---|
| Toolbar **Refresh** button | `public/shared/js/costing-suite-shell.js` (around line 2653) | `rpc_request_costing_refresh` | Works; the new run copies the month's **stored** date (October: 22 Oct), not today | Only with the owner's approval, knowing the date it will use |
| **Cost period valuation** panel ("change valuation date") | `public/shared/js/costing-suite-cost-period-valuation.js` + `...-valuation-helpers.js` | `rpc_set_cost_period_valuation_date` | Works; moves only the legacy stored date (audited) | **Do not use.** It is no longer needed and does not change the official date |
| Approve / finalise / lock / health buttons | — | — | **None exist** in the client today. No client file calls the closed three-argument routes | Use the database routes in the runbook, with the owner's approval |

> **30 Oct 2026:** both rows below are now **built and merged** (PR #99, PR #100), flags OFF by default; the legacy rows above still describe behaviour while the flags are off. The table title is kept as written on 27 Oct.

| Planned on 27 Oct (now shipped) | Flag (default OFF) | What changes |
|---|---|---|
| Approval screen: preview → approve / month-end finalise | `COSTING_APPROVAL_SCREEN_V1` | Calls `rpc_costing_preview_approval_impact` then `rpc_costing_approve_run_with_preview` / `rpc_costing_finalize_monthend_run_with_preview`; shows server labels |
| Refresh with a date + date labels | `COSTING_RECALC_WITH_DATE_V1` | Refresh calls `rpc_costing_request_recalculation`; screens show "Official (approved) date" and "Latest draft date" from the status view; the stored date at most as a small legacy label |

## 10. Related documents
[README_COSTING_SUITE.md](README_COSTING_SUITE.md) · [COSTING_OPERATIONS_RUNBOOK_CURRENT.md](COSTING_OPERATIONS_RUNBOOK_CURRENT.md) · [MONTH_END_APPROVAL_RUNBOOK.md](MONTH_END_APPROVAL_RUNBOOK.md) · [STATUS_AND_REMAINING_WORK.md](STATUS_AND_REMAINING_WORK.md) · [DECISION_LOG.md](DECISION_LOG.md) · [MIGRATION_HISTORY_RECONCILIATION.md](MIGRATION_HISTORY_RECONCILIATION.md) · [GRANT_AUDIT_2026-10-27.md](GRANT_AUDIT_2026-10-27.md) · historical: [runbooks/HISTORICAL_FIRST_GOVERNED_CLIENT_RUN_RUNBOOK_2026-10.md](runbooks/HISTORICAL_FIRST_GOVERNED_CLIENT_RUN_RUNBOOK_2026-10.md)
