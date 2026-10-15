# A6: costing refresh run lifecycle
Retrieved 2026-10-15 ~19:40 IST. Catalog and SELECT queries only. No run was requested and no RPC was executed. Status: **COMPLETE for the audit scope**, except the adversarial dry-run tests, which are BLOCKED until an isolated DB exists (A10).

## How a run works (VERIFIED_LIVE)
1. A request comes from one of two places:
   - The UI or manual path, `rpc_request_costing_refresh`. Granted to `authenticated` and guarded by `require_permission('module:costing-control-center')` plus `auth.uid()`.
   - pg_cron `costing_refresh_request_daily_0200_IST` (20:30 UTC), which calls `rpc_request_daily_costing_refresh_internal`. That takes an advisory lock and `FOR UPDATE` on the period, then requires the period to be OPEN, the valuation to be DRAFT, and no cron run already that day.
2. pg_cron `costing_refresh_stage_processor_every_5min` runs `rpc_process_pending_costing_refresh_stage` (statement timeout 10 min).
3. Six stages run in order: `01_ENSURE_PERIOD`, `02_MATERIAL_SNAPSHOT`, `03_COST_BUILD_TO_SCHEME`, `04_COST_SHEET_SNAPSHOT`, `05_CONTROL_MAINTENANCE`, `06_FINAL_STATUS_CHECK`. For run 119 they inserted 0 / 635 / 3,810 / 27,940 / 9,137 / 0 rows.
4. Concurrency: a unique partial index allows only one QUEUED/RUNNING run per (period, scope). Stage records are unique per (run, stage).
5. "Current" run = latest `finished_at` among SUCCESS runs with valuation captured at request, per period (`v_current_successful_costing_refresh_run`).

## History (VERIFIED_LIVE)
- 99 runs in total: 86 SUCCESS, 12 FAILED, 1 CANCELLED, none stuck.
- Sep-2026: 35 runs, 26 successful. Aug: 5 runs, 4 successful. Jul: 59 runs, 56 successful.
- Triggers: UI_TOOLBAR 52, CRON_DAILY 21, MANUAL and variants 13, CHATGPT_CONTROLLED_BACKEND 3, SERVER_CLEANUP_SMOKE 1. The requests that carry a user all come from **one** user id (dff17104…).
- Failure modes: missing effective PM BOM revision (runs 110, 116, 117); an SQL defect, "valuation_date is ambiguous" (run 102); PM reconciliation (run 98). All failed closed, as intended.
- **Every** successful run was requested while its period was OPEN/DRAFT (86/86). No run has ever been made against a locked period.

## Findings
| ID | Finding | Sev |
|---|---|---|
| A6-F1 | **Run 119 can be superseded silently.** September is OPEN and DRAFT, so any holder of `module:costing-control-center` can request a new FULL_COSTING_REFRESH for 2026-09 from the UI. The resulting run 120+ would become "current" for September, by latest `finished_at`. Every consumer of the current-run view (pricing bridge, dashboards) would switch away from run 119. Run 119's rows would not change, but the reference would. That is a D-010 risk alongside V1–V3 (unprotected tables, re-runnable COP RPC). | P1 |
| A6-F2 | "Current successful" is chosen by recency, not by approval. Nothing marks a run as the approved or reference run, so READY means computed, not approved. | P1 (design) |
| A6-F3 | The daily cron only targets the current calendar month. It returns NOT_REQUESTED when that month is not governed or not OPEN/DRAFT: it ran on 15-Oct 02:00 IST with "1 row" and created no run, because there is no 2026-10 period. Once October is opened, a run is created daily. That is acceptable for a draft month but makes "current" a moving target. | P2 |
| A6-F4 | 12 failed runs exist and the stages are not idempotent across runs: each run rebuilds all its snapshots. That is fine. But the COP stage RPC can be re-pointed at an old run id (V2, A0). Stage processing has no lock beyond the unique active-run index; `rpc_process_next_costing_refresh_stage` is callable by `authenticated` and does its own role check. | P2 |
| A6-F5 | Security: `authenticated` has SELECT on 25 costing tables and no INSERT/UPDATE/DELETE grants. 76 of 116 costing tables have RLS off, so read access is controlled by grants only. Writes happen only through SECURITY DEFINER functions. | P3 |
| A6-F6 | Provisional consumers: every run is OPEN/DRAFT, so all downstream prices (A7) rest on draft-context runs. There is no period-close or approval stage in the lifecycle. | P1 (design) |
| A6-F7 | Audit trail: runs record `requested_by` and `source_trigger`. Stage `output_json` holds counts. No content fingerprint is stored per run, so tampering cannot be detected without the external hashes (A0 sweep 2). | P2 |

## Adversarial tests specified (to run on an isolated branch DB; NOT executed)
1. Request a refresh for period 2026-09. Expected: refused once run 119 is reference-locked. Currently it is accepted (based on reading the code).
2. Call `rpc_refresh_sku_manufacturing_cop_snapshot('2026-09-01','2026-09-10',119)`. Expected: refused for a SUCCESS run.
3. UPDATE/DELETE on run-119 rows of the 15 unprotected tables. Expected: refused.
4. Start two concurrent requests for the same period. Expected: the second fails on `uq_costing_refresh_run_one_active_period_scope`.
5. Kill a stage mid-run. Expected: the run ends FAILED with no partial rows visible through the current-run view.
6. As an authenticated user without the permission, try the request and process RPCs. Expected: refused.
7. Recompute the fingerprints after each test. Expected: unchanged for run 119.

## Remediation (PROPOSAL, in ARCHITECTURE_UPGRADE_STRATEGY AU-2)
- Add a reference/approval designation table (run_id, designation REFERENCE/APPROVED, approver, approved_at, reason; append-only).
- The current-run view prefers APPROVED or REFERENCE over most-recent. Requests for a period holding a REFERENCE run are refused unless a superseding approval exists.
- Store a per-run fingerprint at stage 06.
- Add a period-close stage, which needs user authorisation.
