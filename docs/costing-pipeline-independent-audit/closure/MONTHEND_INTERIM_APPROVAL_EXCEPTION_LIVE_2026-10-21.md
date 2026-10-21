# Month-end interim approval exception — live change 21 October 2026

## Deployed
Changed the installed function `costing.rpc_request_scheduled_costing_refresh_internal()` to let the **first-of-month scheduled final draft** be prepared even when the previous period contains an approved **interim** run. The `APPROVED_RUN_PRESENT` exclusion remains for ordinary Monday working drafts. No designation, period lock, valuation or run data were mutated during deployment.

Repository prepared SQL parity: commit `6958766938558193bfc93a23abfebf2b84649d06`. Active cron jobs #66, #67 and #68 read back `active=true` after deployment.

## Finalization remaining
An atomic, explicitly authenticated owner action is still required: verify final run uses calendar month-end valuation and period is OPEN/DRAFT, invoke existing APPROVE or SUPERSEDE, then existing LOCK in one PostgreSQL transaction. Enforce zero unresolved reviews and all existing fingerprint/authorization checks through underlying RPCs. Never autoapprove from cron. An attempted direct deployment of that new RPC was blocked; **do not claim that it was deployed**. Preserve October run136 interim APPROVED until final approved run supersedes it. No Google Sheets changes.

## Validation outstanding
No actual November 1 run has occurred, so boundary live-path SUCCESS is not yet verified. Check audit event and request run creation after scheduled firing. Cross-month errors must be monitored. The seven-weekly/date-selection fixture is not an execution test. Approval+lock integration and its negative tests remain outstanding.
