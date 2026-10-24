# Weekly/month-end costing cron activation — 21 October 2026

**LIVE** scheduler function deployed as `costing.rpc_request_scheduled_costing_refresh_internal()` from prepared SQL `closure/prepared/PREPARED_WEEKLY_MONTHEND_AUTOMATION_20261021.sql`; PostgreSQL accepted DDL. Its EXECUTE privilege revoked from PUBLIC, anon and authenticated. Read-only role checks showed anon=false/authenticated=false. Actual off-schedule call returned NOT_SCHEDULED and no run.

**LIVE ACTIVE** cron job #66 weekly Monday 02:00 IST; #67 first-of-month month-end trigger 02:00 IST via UTC days 28-31 with IST date predicate; #68 stage processor 5-minute intervals. Direct `cron.job` readback confirmed all active=true. Previous jobs #60/61 were already unscheduled.

Before activation there were no queued/running costing runs. After activation run136 still SUCCESS, valuation 2026-10-20; October period still OPEN and valuation 2026-10-20. No manual snapshots modified.

**Important known release limitation:** scheduler refuses automatic costing for periods that already contain an APPROVED run, including run136 in October. Thus it will NOT create the October 31 final candidate on 1 November automatically; October month-end needs owner-governed supersession / explicit follow-up workflow. Similarly, owner-only atomic month-end approval-and-lock wrapper has not been deployed. No auto approval, locking, storage pruning, alerts or guaranteed successful scheduled refresh is claimed. First scheduled live run must be monitored in cron history and costing run snapshots.

Safety guards: period OPEN/DRAFT, no approved run, active-run check, duplicate-cutoff guard, no backdating, unresolved automation failure hold, transactional valuation audit, current-month idempotent bootstrap; no destructive delete. Client manual refresh retained.

This is activation of the **working-draft cron** component, not complete end-to-end monthly financial close automation. Preserve run136 and Sheets embargo.
