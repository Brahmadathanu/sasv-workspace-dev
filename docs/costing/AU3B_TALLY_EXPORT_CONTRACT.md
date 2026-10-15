# AU-3b — Explicit-window Tally expense export & ETL contract (DRAFT)

Status: draft, additive, **no consumers switched** (D-019/D-020). Deploy separately from #68. Default mode OFF = zero behaviour change.

## Problem
Live FETCH_XML sends FROM=20260401, TO=today, and the parser stores only `as_of_date`. Whether a snapshot is FYTD or MTD is inferred from value drops. A live window that started on 08-08 was neither FYTD nor MTD. Bad periods are silently accepted today.

## Contract (decision D-018)
1. The worker computes the request window explicitly per basis: FYTD = [FY start (1 Apr), as_of]; MTD = [month start, as_of] (`requestWindow`).
2. The worker records **requested** from/to and the **returned** from/to that Tally echoes. Returned-range tags are assumed to be SVFROMDATE/SVTODATE; **this must be verified on a real raw response** before WARN mode.
3. Rows go to `tally_expense_export_staging` under a `tally_expense_export_batch`, then `rpc_tally_validate_and_load_expense_batch` (service_role only) runs.

## Classifier truth table (SQL `fn_tally_classify_export_window` = JS `classifyExportWindow`)
| Condition | Result |
|---|---|
| requested or returned range missing / basis missing | REJECTED_AMBIGUOUS |
| empty batch | REJECTED_AMBIGUOUS |
| start is neither FY start nor month start (e.g. 08-08) | REJECTED_AMBIGUOUS |
| from > to; requested ≠ returned; to ≠ as_of; crosses 1 Apr; declared basis contradicts dates | REJECTED_INCONSISTENT |
| values fall like a reset vs the previous accepted batch on the same window start | REJECTED_INCONSISTENT |
| 1–N April (both FYTD and MTD) | ACCEPTED for either declaration |
| otherwise | ACCEPTED |
Rejections are logged in `tally_expense_contract_violation` and never reach the snapshot. Re-validation is idempotent. A corrected reload supersedes the earlier load.

## Snapshot lineage
Nullable `period_from, period_to, window_basis, export_batch_id` columns are added to `tally_expenses_snapshot`. `fn_tally_snapshot_regimes` uses a declared window (EXPORT_DECLARED) when one is present and otherwise falls back to inference. An ambiguous drop signal marks the month PROVISIONAL (`AMBIGUOUS_REGIME_SIGNAL`).

## Rollout
OFF (deploy; no effect) → WARN (direct inserts allowed but logged; worker moves to RPC) → ENFORCE (direct inserts refused). Each step is a separate user decision.

## Finding
`authenticated` currently has INSERT/UPDATE/DELETE on `tally_expenses_snapshot`, so any logged-in user can alter expense inputs. Proposal: revoke these grants at ENFORCE (not done in this draft).

## Tests
SQL AU-3 21/21 and AU-3b 29/29 (local PG17 parity DB; see RESULTS files). JS 15/15 (`node --test scripts/tally-etl-contract/`). Real-data parity unchanged: 178/179 identical, with the one known difference documented. No ambiguous dates in live data.
