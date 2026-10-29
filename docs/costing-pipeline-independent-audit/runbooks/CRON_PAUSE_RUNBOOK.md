# HISTORICAL RECORD — cron pause/restore runbook for jobs 60 and 61 (16 Oct 2026)

> **Do not use.** Jobs 60 (`costing_refresh_request_daily_0200_IST`) and 61 (`costing_refresh_stage_processor_every_5min`) **no longer exist**. They were replaced by the governed scheduler jobs 66 (weekly Monday 02:00 IST), 67 (month-end 02:00 IST on the 1st) and 68 (stage processor every 5 minutes) — see [../COSTING_OPERATIONS_RUNBOOK_CURRENT.md](../COSTING_OPERATIONS_RUNBOOK_CURRENT.md) and [../COSTING_REDESIGN_V2_CURRENT_STATE.md](../COSTING_REDESIGN_V2_CURRENT_STATE.md). Runnable SQL was removed on 29 Oct 2026. Any pause of current jobs needs its own owner-approved runbook.

## What this was (16 Oct 2026)
Captured: job 60 `30 20 * * *` (02:00 IST) active; job 61 `*/5 * * * *` active. Plan: capture → check no queued/running run → pause both in one guarded block → confirm both inactive and other jobs unchanged; restore by re-activating to captured values. Status at the time: ready, never executed.
