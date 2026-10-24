# Cron 60/61, run supersession, current-run pointer and the Sheets feed: read-only findings (18 Oct 2026, 21:45 IST)
Status: **READ-ONLY.** Nothing was written, no cron job was changed, and no view was built. The proposed feed view is `PROPOSED_v_price_revision_feed_approved.sql` (user, 21:48 IST: "not yet").

## 1. Cron jobs (both paused)
| | Job 60 `costing_refresh_request_daily_0200_IST` | Job 61 `costing_refresh_stage_processor_every_5min` |
|---|---|---|
| Schedule | `30 20 * * *` UTC = 02:00 IST daily | `*/5 * * * *`, with a 10-minute statement timeout |
| Command | `costing.rpc_request_daily_costing_refresh_internal()` | `public.rpc_process_pending_costing_refresh_stage()` → `fn_process_next_costing_refresh_stage_internal(null)` |
| What it does | Queues one FULL refresh for the current IST month. Only queues if the period exists, is OPEN, and has a non-null DRAFT valuation date. Never auto-creates a period. At most one cron run per day. Stops after a failed cron run until a later run succeeds. | Takes the oldest RUNNING/QUEUED run, under a per-run advisory lock, and runs its next PENDING stage. With nothing queued it returns `NO_QUEUED_OR_RUNNING_REFRESH_RUN_FOUND`. |
| Active | false; last run 16 Oct 02:00 IST | false; last run 18 Oct 13:55 IST |

**If job 61 is left on continuously**
- It never creates runs. It only advances queued ones, from the UI toolbar (`rpc_request_costing_refresh`, which auto-creates the period) or from job 60.
- It runs one stage per 5 minutes; a full run takes about 25 minutes (run 128: 13:15–13:40 IST).
- No run is queued now.

**If job 60 is on as well**
- In October it returns `CURRENT_PERIOD_NOT_OPEN`, because October is LOCKED.
- From 1 Nov it returns `CURRENT_PERIOD_NOT_GOVERNED` until a November period exists.
- After that it creates one November run per day at November's valuation date.
- G4 is OFF, so these runs use legacy loads.

## 2. Runs per period and supersession
- **Identity:** every refresh is a new `costing_refresh_run` id carrying `period_start` and the `valuation_date` captured at request time. Snapshots are keyed by `refresh_run_id` and **kept**: October has 124–128 side by side, and nothing deletes older runs.
- **Pointer:** `costing.v_current_successful_costing_refresh_run` selects one run per period:
  - first, the latest APPROVED run (effective designation, `costing_run_designation`)
  - otherwise the latest successful run
  - a REFERENCE run ranks *below* a newer undesignated success
- **Today:** Jul = 80 and Aug = 82 (LATEST_SUCCESS, never approved); Sep = 122 and Oct = 128 (APPROVED).
- **Supersession:** a period with no approved run is effectively superseded by every new successful run. With an approved run, newer runs do not displace it unless they are themselves APPROVED; between two approved runs, the newer finish wins.
- **Older unapproved runs** (124–127): kept, mutable, not formally retired, and hidden only by the pointer.
- **LOCKED period:** `fn_request_costing_refresh_internal` raises an error unless the period is OPEN with a DRAFT valuation date. In addition, `fn_guard_designated_run_header` blocks inserting a run for a period that holds an APPROVED run unless an unexpired, unconsumed `costing_period_refresh_authorization` exists (0 exist).
  - So a locked period cannot be rerun.
  - Rerunning needs a reopen plus a supersession authorisation. The new run is undesignated and the approved run stays current until the new one is approved.
- **Designated runs** are immutable (row and header guards; fingerprint captured at designation).

## 3. What reporting reads
- **Run-pinned via the pointer:**
  - `public.v_costing_pricing_sku_detailed_cost_sheet` (→ `costing.v_sku_detailed_cost_sheet_current`)
  - `public.v_costing_pricing_sku_control_status_snapshot`
  - `public.v_costing_pricing_sku_scheme_comparison`
  - `public.v_costing_pricing_sku_selector`
  - `public.v_costing_pricing_sku_status_diagnosis`
  - Fields: MRP IK/OK, full cost build-up, selling prices, margins before scheme (₹, %), after-scheme margins and bands, loss/low-margin scheme counts.
- **Gap, run-mixing:** `public.v_cost_sheet_snapshot_sku_monthly_comparison` reads `cost_sheet_line_monthly_snapshot` by month with `max()` and **no run filter**. October holds runs 124–128, and 475 of 648 SKUs differ from approved run 128 (648 rows vs 627 in run 128).

## 4. Gaps for an auto-updating price-revision Sheet
1. No approved-only view. "Current" falls back to the latest unapproved run (July/August today, November as soon as anyone runs it).
2. No "latest approved period" marker.
3. No explicit negative-margin boolean.
4. The monthly comparison view mixes runs.

**Proposed (not built):** `costing.v_price_revision_feed_approved`, latest APPROVED run per period only, with `is_latest_approved_period` and IK/OK negative-margin flags. Tested read-only: Sep 122 = 634 SKUs (74/70 negative); Oct 128 = 627 SKUs (9/9).
