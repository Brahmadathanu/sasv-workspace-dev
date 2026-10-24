# Costing period and cron lifecycle — independent live audit, 21 Oct 2026

**Stage: diagnosis complete, changes NOT deployed.** No costing cron was enabled and no period/valuation state was mutated.

## Live cron inventory
- Job60 `costing_refresh_request_daily_0200_IST`, schedule `30 20 * * *` UTC = 02:00 IST next day, **INACTIVE**. Command `costing.rpc_request_daily_costing_refresh_internal()`.
- Job61 `costing_refresh_stage_processor_every_5min`, schedule `*/5 * * * *`, **INACTIVE**. Command `public.rpc_process_pending_costing_refresh_stage()` with statement_timeout 10min.
- Retained pg_cron execution history: job60 37 succeeded /39 failed (last succeeded 15 Oct UTC); job61 21,641 succeeded /255 failed (last succeeded 18 Oct UTC). 'succeeded, 1 row' reports SQL wrapper returned, **not proof of six-stage costing SUCCESS**. Need correlate to refresh-run lifecycle and errors.
- No separate costing valuation-date change, period opening, or period locking cron job appears in live `cron.job` inventory. Governance RPCs exist for each but are distinct manual/gated operations.
- Cost periods: October OPEN, valuation date 20 Oct; September LOCKED, 10 Sep valuation; older Aug/July/June remain OPEN. This confirms `APPROVED` and `LOCKED` are not synonymous; no automatic lock should be inferred.

## Mechanism and gaps
- `fn_default_cost_period_valuation_date(period)` determines default **only when a period is first created**: today in IST for current month, month-end for historical, month-start for future. It does not advance the date daily.
- `rpc_ensure_cost_period` inserts an OPEN/DRAFT period, defaults date, emits PERIOD_CREATED audit event, and ON CONFLICT DO NOTHING (safe from overwriting an existing period). But job60 calls a daily request function that returns `CURRENT_PERIOD_NOT_GOVERNED` if current period absent, rather than creating it; **month-opening requires explicit orchestration**.
- `rpc_request_daily_costing_refresh_internal` checks IST date, OPEN/DRAFT valuation, no duplicate CRON_DAILY request that IST day, and stops on unresolved earlier failed cron refresh. It does **not** advance valuation_date to today and does not inherently check for currently APPROVED run as a reason to stop recurring daily refreshes.
- `public.rpc_costing_lock_period` requires proper module permission, OPEN period, APPROVED run, matching valuation date, no active runs and clean fingerprint; locks period/date and audits. This is a governed transaction, not cron-driven.
- New approval policy requires zero unresolved reviews for any *future* designation; cannot equate daily refresh SUCCESS with eligibility or auto-approval.

## Proposed minimal reliable lifecycle
1. Monthly period creation once, with India-local date, audited and idempotent. Keep valuation date DRAFT until explicitly managed and protect APPROVED/LOCKED context.
2. Make valuation cutoff policy explicit: a daily cron must not silently backdate or advance an approved run; define when/how valuation date advances only in DRAFT and what authority is needed.
3. Auto-request refresh only when period OPEN, date DRAFT, no active run, appropriate source freshness, no unresolved prior cron failure, no conflicting approved run, and governance authorisation where required. Idempotent same-day request.
4. Stage processor may be enabled only alongside a controlled request policy and observed stage-failure/retry behaviour, with an execution log distinguished from full run completion.
5. Approval remains owner-gated and requires zero unresolved reviews; period LOCK separately owner-gated only after approved run and matched valuation cutoff. Do not auto-lock on a timer.
6. Add operational monitoring for cron execution failures, stalled run, and mismatch between claimed success and run SUCCESS, rather than merely relying on job_run_details 'succeeded'.

**Do not enable existing jobs 60/61 as-is.** First decide intended monthly/daily valuation business behaviour and implement minimal fail-closed guards; preserve approved run136, historical runs and audit trail. Sheets remains on hold for user's additional requirements.
