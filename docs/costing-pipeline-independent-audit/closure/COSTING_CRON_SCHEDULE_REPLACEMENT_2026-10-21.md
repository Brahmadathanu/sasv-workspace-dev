> **UPDATE 24 Oct 2026:** the INACTIVE state below was a pre-activation snapshot. Jobs 66/67/68 were later activated (see [WEEKLY_COSTING_LIVE_CRON_ACTIVATION_2026-10-21.md](WEEKLY_COSTING_LIVE_CRON_ACTIVATION_2026-10-21.md)) and are confirmed **active** as of 24 Oct 15:50 IST. Jobs 60/61 do not exist.

# Live Supabase costing cron schedule replacement — 21 October 2026

## Executed and independently verified
- `cron.unschedule(60)` returned true: old `costing_refresh_request_daily_0200_IST` removed.
- `cron.unschedule(61)` returned true: old `costing_refresh_stage_processor_every_5min` removed.
- Three replacement job rows registered in one transaction, then set `active=false` **before COMMIT**; direct readback confirms:
  - Job66 `costing_weekly_draft_0200_IST`: `30 20 * * 0` UTC = Monday 02:00 IST; INACTIVE.
  - Job67 `costing_monthend_draft_0200_IST`: `30 20 28-31 * *` UTC; date-screened by India-local first-of-month business date = first day 02:00 IST when UTC date was preceding month-end; INACTIVE.
  - Job68 `costing_stage_processor_5min_governed`: `*/5 * * * *` UTC, INACTIVE.
- Both candidate request schedules call `costing.rpc_request_scheduled_costing_refresh_internal()`; stage schedule calls existing `public.rpc_process_pending_costing_refresh_stage()`.
- Scheduler SQL currently only prepared in `closure/prepared/PREPARED_WEEKLY_MONTHEND_AUTOMATION_20261021.sql` and has NOT been deployed or PostgreSQL regression verified. Registered request jobs reference a not-yet-installed function. **They must remain INACTIVE until a complete tested scheduler is deployed**.
- Existing October run136 APPROVED, period OPEN, valuation 20 Oct; no period or refresh run change made; no Sheets integration.

## Release prerequisites
The prepared scheduler needs precise month opening, IST schedule-day gating and collision/failure handling verified. Month-end finalization needs an owner-only approval+lock wrapper and regression tests. Validate production data governance auditing and transaction semantics, ensure manual refresh paths unaffected, then separately authorize activation. A cron job whose SQL returns successfully is not proof that a costing run completed.

This is a **scheduling configuration completion** with no automatic costing execution yet. Do not mislabel as operational automation.
