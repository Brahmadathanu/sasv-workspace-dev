# October 2026 month-end approval — runbook (PREPARATION ONLY)

> **Do not execute without the owner's explicit approval.** Steps follow [COSTING_OPERATIONS_RUNBOOK_CURRENT.md](COSTING_OPERATIONS_RUNBOOK_CURRENT.md); this page adds only the October facts. Checked read-only 27 Oct 2026.

## Starting point
- October: OPEN; approved run **143** (official date 22 Oct, in use for pricing); legacy stored date 22 Oct (DRAFT). Runs 128, 136, 140 superseded.
- Fingerprint of runs 119/122/143 (combined): `3e5515ed97189b747ea3a8d18c3f4411`.

## Expected automatic step (no action)
- **Sun 1 Nov 02:00 IST** — job 67 creates the October month-end draft **dated 31 Oct**, labelled "not for pricing"; job 68 costs it over the following minutes. Run 143 stays approved.
- If it does not appear (e.g. a run was already active), the **Mon 2 Nov 02:00 IST** weekly pass adds it once as a catch-up.

## Review (read-only, any time after the draft finishes)
1. Status view shows October: approved 143 (22 Oct) and newer draft <id> (31 Oct).
2. Health check: no ERROR.
3. Combined fingerprint for 119/122/143 still `3e5515ed97189b747ea3a8d18c3f4411`.
4. SKU spot checks including SKUs 41 and 846.
5. Owner and ChatGPT review the draft's numbers.

## Approval (only after the owner's explicit approval text)
1. Owner opens the preview of the 31 Oct draft in his own session; reads impact; note `preview_ack_id` (valid 15 minutes).
2. Owner calls `rpc_costing_finalize_monthend_run_with_preview(<draft id>, <reason>, <approval reference>, <preview_ack_id>, <acknowledge_stale>)`.
3. Expected: run 143 becomes Superseded (kept unchanged); October's official date becomes 31 Oct; the legacy stored date stays 22 Oct (by design); the month is **not** locked.
4. Health check again; record in the decision log.

## Not part of this runbook
- Locking October (only before a formal quarter close; Q4 ends 31 Dec).
- June, July, August 2026 have no approved run; that is a separate governance reconciliation and must not be bypassed or bundled with October.
