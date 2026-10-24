# October close (run 128): STOPPED before any change (2026-10-18 ~14:20 IST)
User approval 14:14 IST: finalise the 16 Oct valuation date, approve run 128, lock October.
The instruction required sanctioned functions only (the September path) and said to STOP rather than hand-edit status columns.

## Finding
- **No sanctioned lock / finalise function exists.** Live functions touching cost periods:
  - `rpc_set_cost_period_valuation_date` (OPEN periods only; changes the date, does not lock);
  - `rpc_close_cost_period`;
  - `rpc_ensure_cost_period`;
  - read-only getters.
  No function writes PERIOD_LOCKED or the locked_* columns.
- **September was not locked by a function.** It was a user-approved guarded manual UPDATE of cost_periods (OPEN/DRAFT to LOCKED/LOCKED) plus a PERIOD_LOCKED audit row (`proposals/SEP2026_VALUATION_LOCK_PROPOSED.sql`; handover log 2026-10-16 20:07). That is exactly a hand-edit of status columns, so it was not repeated.
- **Approval:** `costing.rpc_designate_costing_run(run, 'APPROVED', by, reason)` exists and is sanctioned. It was not called: in September the lock came first, and acceptance check 6 requires the valuation date LOCKED/FINAL before approval.
- **Sanctioned alternative, not used:** `rpc_designate_costing_run(128,'APPROVED',...)` then `rpc_close_cost_period('2026-10-01',...)`. That sets the period **CLOSED / valuation FINAL**, a stronger and final state than September's LOCKED/LOCKED (no reopen RPC exists). It differs from what was approved ("lock"), so it needs an explicit user decision.

## State (unchanged)
- October 2026: OPEN / valuation 2026-10-16 DRAFT.
- Run 128: SUCCESS, not designated. Runs 124–127: not designated.
- Designations: 119 REFERENCE, 122 APPROVED only.
- Run 122 fingerprint: ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows (unchanged).
- Cron 60/61 inactive.

## Options for the user
- (A) Approve a one-off guarded lock exactly like September (prepared SQL mirroring SEP2026_VALUATION_LOCK_PROPOSED.sql with a PERIOD_LOCKED audit row), then designate run 128 via rpc_designate_costing_run.
- (B) Use the sanctioned designate + rpc_close_cost_period path (CLOSED/FINAL; final).
- (C) First add a governed `rpc_lock_cost_period` / `rpc_reopen_cost_period` (AU-2 backlog), then lock and approve through it.
