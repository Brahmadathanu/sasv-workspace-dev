# AU-3 — Tally period-interpretation fix (DRAFT, not applied live)

## Defect
`public.tally_expenses_snapshot` holds cumulative closing balances per head per pull date. The window behind those balances changed without any marker:

| From | Window (inferred) | Evidence: total vs previous pull, share of heads falling |
|---|---|---|
| FY start (06-09 first pull) | FYTD from 1 Apr | — |
| 2026-03-17 | partial pull (one day) | 0.027×, 100% fell; FYTD again on 03-19 (91×) |
| 2026-08-08 | reset window | 0.058×, 100% fell |
| 2026-09-04 | reset window | 0.113×, 83% fell |
| 2026-10-06 | reset window | 0.105×, 100% fell |

`etl_jobs` still requests FROM 20260401, so the reset comes from the source side, not from the ETL parameters. The data alone **cannot** prove where a reset window starts. On 08-08, 6 of 19 heads are below their 1–7 Aug movement, so the window is not cleanly MTD from the 1st. `costing.v_expense_head_monthly_provision` divides every month-end value by elapsed FY months as if it were FYTD.

## Fix (migration `20261015170228_au3_tally_period_interpretation.sql`, additive only)
1. `fn_tally_snapshot_regimes` / `v_tally_snapshot_regime`: each pull date is assigned a regime, a basis (FYTD or RESET_WINDOW), a `window_start` with its basis (FY_START, INFERRED_RESET_DATE or USER_CONFIRMED), and detection evidence. The thresholds are parameters (total ratio < 0.5 and ≥ 60% of common heads falling).
2. `tally_snapshot_window_override` (append-only): the user records the true window start for a range of pull dates, with name and reason. This is the only way an inferred window becomes COMPLETE.
3. `v_tally_expense_head_month_normalised`: per head and calendar month, it differences values within a regime and stitches regimes. A regime's contribution ends the day before the next regime's window starts, so nothing is double-counted. Output: `COMPLETE` or `PROVISIONAL`, with flags (WINDOW_START_INFERRED, GAP_BETWEEN_REGIMES, NO_MONTH_END_SNAPSHOT, MONTH_START_NOT_COVERED, BASELINE_NOT_AT_MONTH_END, NO_BASELINE_IN_REGIME) and full lineage (regime, window, end and baseline snapshot, values, contribution).
4. `v_expense_head_monthly_provision_au3` sits side by side with the live view; the live view is **not** replaced. The policy is unchanged (the highest monthly equivalent among candidates), but only snapshots verified as FYTD are divided by elapsed months. Once window starts are confirmed, COMPLETE stitched months extend the FYTD base. Each row carries lineage.

## Results
- Synthetic tests: 21/21 pass (`RESULTS-2026-10-15.txt`). The suite covers regime detection, stitching, gap flags, the old-logic defect, the override path (no double count) and append-only behaviour. No real ledger data is committed.
- Real data, local only (not committed). The old view rebuilt locally matches live in 179/179 rows. The AU-3 view is identical in 178/179 rows. The single difference is Registration Charges, Sep-2026 period: 2,400/month → 0, because the old figure came from the 2026-08-31 reset-window snapshot read as FYTD.
- Why the impact is small today: the max policy picks the last FYTD month-end (07-31). That masks the defect, but it also means **current provisions are frozen at July FYTD**. From now on, only window data arrives, and the old view will keep reading window month-ends as FYTD.
- Normalised months on real data: Jul-2026 is COMPLETE. Jun is PROVISIONAL (no 31-May baseline). Aug, Sep and Oct are PROVISIONAL (window start inferred, gaps on 09-03 and 10-04/05).

## Needs the user's decision
1. Confirm the true window start of the 08-08, 09-04 and 10-06 pulls, or fix the Tally export to send an explicit FROM/TO and store it per row. The recommended ETL change is to add `window_from`, `window_to` and `window_basis` columns per pull; it is not included here.
2. Whether to apply this migration and later switch the provision consumer to the `_au3` view. That switch is a costing-number change.
