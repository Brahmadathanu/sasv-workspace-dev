# Costing redesign v2 — current state

**Checked read-only on production on 27 Oct 2026, 21:40–22:00 IST** (project qhmoqtxpeasamtlxaoak, SELECT only). This page describes how costing approval, month-end and locking work **now**. Where older documents (G, J, W2 design, Step 166, the first-governed-run runbook) say something different, this page wins.

## 1. The design in plain words
- **Each run keeps its own valuation date.** A refresh run captures its date when it is requested. The month no longer has one "working date" that moves around; the month's stored date is only the official date of the approved run.
- **Drafts keep coming after approval.** The weekly (Monday 02:00 IST) and month-end (02:00 IST on the 29th–31st) drafts continue to run. A new draft never replaces the approved run by itself.
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
| CI-043 v2.2 rev B | Read-only health check + 9 adjustable thresholds | 20261027153126 | 27 Oct 21:01 |

Approval requests, summaries and apply records: [redesign-v2/](redesign-v2/).

## 3. Functions the app may call (exact names, from production)
| Purpose | Function | Who can call |
|---|---|---|
| Preview before approval (writes a 15-min acknowledgement) | `rpc_costing_preview_approval_impact(p_refresh_run_id bigint)` | logged-in users with costing permission |
| Approve (supersedes the current approved run if any) | `rpc_costing_approve_run_with_preview(p_refresh_run_id bigint, p_reason text, p_approval_reference text, p_preview_ack_id bigint, p_acknowledge_stale boolean)` | owner only (server checks) |
| Month-end finalise | `rpc_costing_finalize_monthend_run_with_preview(` same five arguments `)` | owner only |
| Lock one month | `rpc_costing_lock_period(p_period_start date, p_reason text, p_approval_reference text)` | costing edit permission (server checks) |
| Lock several months (quarter close) | `rpc_costing_lock_periods_for_close(p_period_starts date[], p_reason text, p_approval_reference text)` | costing edit permission |
| Health report | `rpc_costing_health_check()` | logged-in users with costing view permission; not anonymous |
| Request a refresh (unchanged) | `rpc_request_costing_refresh(p_period_start date, p_requested_scope text, p_source_trigger text, p_request_note text)` | unchanged |
| Set month valuation date (unchanged, legacy) | `rpc_set_cost_period_valuation_date(p_period_start date, p_valuation_date date, p_reason text, p_approval_reference text)` | unchanged |
| Closed (refuse, write nothing) | `rpc_costing_approve_run(bigint,text,text)`, `rpc_costing_finalize_monthend_run(bigint,text,text)` | — |

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

## 5. Scheduled jobs (unchanged by v2)
| Job | Schedule | Purpose |
|---|---|---|
| 66 `costing_weekly_draft_0200_IST` | Monday 02:00 IST | weekly draft |
| 67 `costing_monthend_draft_0200_IST` | 02:00 IST on 29th–31st | month-end draft |
| 68 stage processor | every 5 minutes | runs queued stages |
There is no health-check job and no alerting.

## 6. Baseline and known findings (27 Oct 2026)
- Fingerprint of runs 119/122/143 (combined): `3e5515ed97189b747ea3a8d18c3f4411`.
- Runs: 119 REFERENCE, 122 APPROVED, 143 APPROVED (October), 128/136/140 REVOKED. September LOCKED; March, June, July, August, October OPEN (October stored date 22 Oct).
- Health check on 27 Oct 21:01 IST: **no ERROR**, two WARNs:
  - `REFERENCE_FINGERPRINT_DRIFT` run 119 — known and expected (one source table changed after run 119 was captured as reference).
  - `JOB_RECENT_FAILURE` job 66 — a single failure on **26 Oct 02:00 IST** (`cost_period_governance_audit_event_source_chk`): the scheduler wrote audit source `CRON_SCHEDULED`, which the check did not yet allow. CI-039 (applied 26 Oct 10:33 IST) added that value. Checked read-only in `cron.job_run_details`: no failures of jobs 66/67/68 since. The WARN clears when the failure is older than 7 days (2 Nov).

## 7. Known risks
- The preview writes a row on production each time it is opened; test previews must not be run against production.
- The health check only reports when called; nobody is alerted automatically.
- The month's stored valuation date (legacy setter) still exists; screens must not use it to label runs.
- Rolling back CI-043 keeps settings changed after install; one changed and later set back to the default is deleted (no full change history).

## 8. Open items (not approved, separate decisions)
- **CI-044** — parked.
- **Health-check schedule and alert delivery** — not approved.
- **Backdating cutoff warning** — investigation pending.
- **Cursor approval screen** (`COSTING_APPROVAL_SCREEN_V1`, off by default) — plan under review; no code yet.
- **Refresh and date-labels brief** (`costingRecalcWithDateV1`) — prepared for Cursor; no code yet.
