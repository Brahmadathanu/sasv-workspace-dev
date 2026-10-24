# Interim approval no longer blocks weekly scheduled refresh — deployed 21 October 2026

## User-identified defect corrected
The live `costing.rpc_request_scheduled_costing_refresh_internal()` formerly returned `APPROVED_RUN_PRESENT` for weekly refreshes whenever the month had an interim APPROVED run. Removed that guard. An approved snapshot is immutable but **does not freeze an OPEN/DRAFT month**; only period status and other actual operational safeguards restrict new automatic refresh requests.

## Verification
- Server accepted new SQL function body; query of `pg_get_functiondef` confirms `APPROVED_RUN_PRESENT` substring absent and revised policy present.
- Scheduled jobs 66 weekly, 67 month-end, 68 stage processor all ACTIVE.
- October run136 still effective designation APPROVED; Oct period still OPEN / DRAFT at valuation 2026-10-20. No run or date mutated for this fix.
- Next Monday 26 Oct weekly request can advance valuation date and request draft **subject to** normal active-run, failed-run, cutoff, period and source integrity gates.
- Not an end-to-end simulated Monday run; awaiting real scheduled execution. Owner-only month-end approval+lock remains pending.

Prepared source updated on branch `costing/au4-normal-budget` commit `d499573b516bffa3bef6a6a6e29650393cb4a94b`. Do not reactivate the old daily cron. No Sheets work.
