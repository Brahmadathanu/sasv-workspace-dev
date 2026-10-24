# Weekly costing automation — valuation date and on-demand control audit (21 October 2026)

Read-only live inspection. **No cron, function, period, valuation, run, or Sheets mutation.**

## Verified server functions
- `public.rpc_request_costing_refresh(date,text,text,text)`: authenticated actor via `auth.uid()`, requires module:costing-control-center. Calls existing `costing.fn_request_costing_refresh_internal(...,allow_period_autocreate=true)`. Keep existing client facility; audit each module's wiring separately against the same governed server path rather than implement duplicate client buttons.
- Internal refresh guard: OPEN period, DRAFT valuation, nonnull date, transaction advisory lock, active run reused only if date matches. Each completed invocation inserts a new run/six stage records and **does not overwrite/delete old drafts**. A default request can auto-create missing period.
- `public.rpc_set_cost_period_valuation_date`: requires module permission, >=10 char reason, OPEN period, date inside period, no active run, transactional lock, audited GOV­ERNED_MANUAL change. Returns NO_CHANGE if date same. **Currently does not test existence of an APPROVED run before changing an OPEN period's date**.
- `costing.fn_default_cost_period_valuation_date`: assigns initial period date only at creation. Current month uses India date at creation; past month month-end; future month first day; it does not advance weekly.
- `public.rpc_costing_lock_period`: separate permissioned transaction; requires APPROVED run, valuation-date match, no active run, clean fingerprint; locks both status and valuation date. Run136 APPROVED while Oct period still OPEN, valuation DRAFT Oct20.
- Live cron costing jobs 60 (daily request) and 61 (5min stage processor) disabled; no additional valuation advance/period-lock cron observed.

## Adopted proposed lifecycle pending controlled implementation
1. Run weekly, plus one month-end draft candidate; manual refresh remains available from Costing Suite modules with existing permissions.
2. Before each *automatic* draft request, set current month's valuation to scheduled India-local cutoff, only while OPEN/DRAFT and **no currently APPROVED run for the period**. Never advance dates beyond period end. Ensure atomic date selection and request, avoid overlapping active runs.
3. Each new successful draft supersedes older *working selection only*; preserve all approved immutable runs, audit trail, and failed diagnostics. Snapshot retention must be separately safety-checked, not delete old runs by fiat.
4. At boundary, freeze prior month's valuation cutoff at month end, carry its pending approval forward as prominent obligation; new month draft may be prepared only under explicit defined cross-month gating policy. No auto-approval.
5. When approved, stop automatic valuations and refresh requests; lock period by governed owner operation after approval, never automatically infer approval from cron SUCCESS.
6. On-demand client: audit calls, run status polling, on-demand scope, actor identity, period selection and prevent hidden bypass of new zero-unresolved-review approval rule. Do not recreate the facility.

## Important open policy/engineering question
Current valuation date setter allows date changes on OPEN period even after a run is APPROVED; to prevent accidental post-approval date drift, plan a **prospective guarded distinction** between automatic (never) and explicit authorised supersession (possible) before activation. No change has yet been deployed. No old period will be altered silently. Preserve valuation dates of historical approved runs.

## Next bounded work
Trace costing Suite client request paths and stage processor, determine source-cutoff readiness and exact weekly/month-end cadence; implement only a fail-closed orchestrator and revised cron after verification, with a rollback path. Do NOT restart daily job 60 as-is. Sheets embargo continues pending owner requirements.
