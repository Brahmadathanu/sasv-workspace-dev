# HISTORICAL RECORD — First governed client-triggered refresh (prepared 16 Oct 2026)

> **Historical record only. Do not follow any step here.** This runbook was prepared on 16 Oct 2026 for the first governed September 2026 run. The procedures it described were retired by the costing redesign v2 (27 Oct 2026). The runnable SQL it contained has been removed so it cannot be copied by mistake; the original text stays in git history (file `runbooks/FIRST_GOVERNED_CLIENT_RUN_RUNBOOK.md` at commit 32ccf18).
>
> **For today's procedure use [../COSTING_OPERATIONS_RUNBOOK_CURRENT.md](../COSTING_OPERATIONS_RUNBOOK_CURRENT.md)** (and [../MONTH_END_APPROVAL_RUNBOOK.md](../MONTH_END_APPROVAL_RUNBOOK.md) for October 2026).

## What it covered (summary)
1. **Target:** a September 2026 refresh from the toolbar Refresh button (route `rpc_request_costing_refresh`), at September's stored date 10 Sep.
2. **Ledger switch:** align one ledger amount (Registration Charges) and switch the cost-head policy ledger on, with the owner's approval.
3. **Job 61 window:** temporarily enable cron job 61 (the old stage processor) for the run, then pause it again.
4. **Expected effect:** a read-only simulation of pool totals against run 118.
5. **Acceptance:** run the acceptance SQL (`acceptance/`), then designate the run APPROVED through the old designation route after the owner's sign-off, with the month's valuation date locked first.

## What happened
Runs 118–122 were produced in this way in mid-October; run 122 became September's approved run (16 Oct 2026) and September was locked at 10 Sep. Those results are approved history and are unchanged.

## Why each step is obsolete
| Old step | Why it must not be used now |
|---|---|
| Enable / pause job 61 | Job 61 (and 60) no longer exist. Job 68 processes queued stages every 5 minutes. |
| Move or lock the month's valuation date before approval | Redesign v2: the official date is the approved run's own date. The stored month date is a legacy field and must not be moved. |
| Approve with the old three-argument route or direct designation | `rpc_costing_approve_run` / `rpc_costing_finalize_monthend_run` / `rpc_costing_supersede_approved_run` now refuse with `W2_USE_NEW_APPROVAL_ROUTE`. Approval needs preview → `rpc_costing_approve_run_with_preview`. |
| Lock as part of approval | Locking is a separate decision that changes the lock state only (`rpc_costing_lock_period` / `rpc_costing_lock_periods_for_close`). |
| Acceptance "valuation date must be LOCKED or FINAL" | No longer required for approval. |
