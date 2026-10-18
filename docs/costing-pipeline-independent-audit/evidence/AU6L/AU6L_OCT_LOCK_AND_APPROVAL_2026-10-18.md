# October 2026 lock and run 128 approval (option A), 2026-10-18

Approval: USER-APPROVAL-20261018-OCT-LOCK-OPTION-A (user, 14:17 IST). Acting user dff17104-c02a-4bca-95b1-e8ddff46a9b6.
Method: the same as September. One guarded transaction (script `live/OCT2026_LOCK_AND_APPROVE_RUN128_APPLIED.sql`):
1. Guards: exactly 1 October row; prior state OPEN/DRAFT at valuation 2026-10-16; no run in flight; run 128 SUCCESS at 16 Oct; no existing October designation.
2. UPDATE cost_periods to LOCKED/LOCKED (row_count = 1 guard) + PERIOD_LOCKED audit row.
3. `rpc_designate_costing_run(128,'APPROVED',...)`, the sanctioned function, which writes the fingerprint and the designation.

Attempt 1 rolled back (the final report SELECT used the column `id` instead of `audit_id`). I verified nothing persisted. Attempt 2 committed at 14:18:51 IST. Audit id 12 and designation id 3 were used up by the rolled-back attempt, so those numbers are skipped.

| Check | Result |
|---|---|
| October period | LOCKED, locked 14:18:51 IST, ref USER-APPROVAL-20261018-OCT-LOCK-OPTION-A |
| Valuation date | 2026-10-16 LOCKED |
| Audit | id 13 PERIOD_LOCKED (plus id 11 PERIOD_CREATED) |
| Run 128 | APPROVED (designation 4, fingerprint 11, uid = user); fingerprint verify 0 drift |
| Current-run view | Sep → 122 APPROVED; Oct → 128 APPROVED |
| Runs 124–127 | no designation |
| Cron 60 / 61 | both inactive |
| Run 122 fingerprint before = after | ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows, run row 547983c7…, 56 tables |

Approval notes recorded in the reason: capacities provisional (equipment-loads config); 60% seasonal cut-off chosen by Aryabhatta; 37 open reviews accepted as known exceptions (non-blocking); 9 negative-margin SKUs to pricing review.

Not done: the period is not CLOSED/FINAL (rpc_close_cost_period was not asked for). No Sheets, merges or deploys.
