# Costing suite — overview

## Purpose
Works out the cost of every SKU each month from master data (materials, packing, routes, labour, overheads, sales allocation), so prices can be reviewed on an **approved** costing. Drafts are produced automatically; approval, month-end and locking are the owner's decisions.

## How it works (plain words)
1. **Runs.** A run costs one month at one valuation date. The date is fixed when the run is requested and never changes.
2. **Drafts** are created automatically (weekly on Monday, and on the 1st for the month just ended) or on request. Cron job 68 does the work in stages. Drafts are never used for pricing.
3. **Approval.** The owner previews a draft (15-minute acknowledgement) and approves it; the previous approved run is kept as Superseded. The month's **official date** is the approved run's own date.
4. **Lock** freezes a month's state before a formal close, normally per quarter.
5. **Health check** reports problems (ERROR/WARN/INFO) on request.
6. **Protection.** Approved and reference runs are guarded and fingerprinted; approved history never changes.

## Key objects
| Kind | Name |
|---|---|
| Runs | `costing.costing_refresh_run`, designations `costing.costing_run_designation` |
| Months | `costing.cost_periods` (the `valuation_date` column is the **legacy stored date**) |
| Status for screens | `public.v_costing_pricing_period_run_status`, `public.v_costing_pricing_run_display_status` |
| Settings | `costing.costing_automation_setting` |
| Routes | recalculation, preview, approve, month-end finalise, lock, health check — see the runbook |
| Jobs | 66 weekly, 67 month-end, 68 stage processor |

## Governance rules
- Approvals, finalise, locks, refreshes, migrations and cron changes on production need the owner's explicit approval text.
- Approved history (runs 119 reference, 122, 143) is immutable; no artificial supersession for testing.
- The server decides dates and eligibility; screens only display the server's answer.
- Migrations are tested in isolation with verification and rollback plans before an approved apply.

## Document map
- **Now:** [COSTING_REDESIGN_V2_CURRENT_STATE.md](COSTING_REDESIGN_V2_CURRENT_STATE.md) · [STATUS_AND_REMAINING_WORK.md](STATUS_AND_REMAINING_WORK.md)
- **How to operate:** [COSTING_OPERATIONS_RUNBOOK_CURRENT.md](COSTING_OPERATIONS_RUNBOOK_CURRENT.md) · [MONTH_END_APPROVAL_RUNBOOK.md](MONTH_END_APPROVAL_RUNBOOK.md)
- **Why:** [DECISION_LOG.md](DECISION_LOG.md) · [../master-data-costing/CHANGELOG_DECISIONS.md](../master-data-costing/CHANGELOG_DECISIONS.md)
- **Records:** [redesign-v2/](redesign-v2/README.md) · [MIGRATION_HISTORY_RECONCILIATION.md](MIGRATION_HISTORY_RECONCILIATION.md) · [GRANT_AUDIT_2026-10-27.md](GRANT_AUDIT_2026-10-27.md)
- **History (do not follow):** [runbooks/HISTORICAL_FIRST_GOVERNED_CLIENT_RUN_RUNBOOK_2026-10.md](runbooks/HISTORICAL_FIRST_GOVERNED_CLIENT_RUN_RUNBOOK_2026-10.md), [CURRENT_STATE.md](CURRENT_STATE.md) (24 Oct snapshot), [INDEX.md](INDEX.md), `audit-2026-10-25/`, `closure/`, `archive/`
