# C1B security preflight findings — 2026-11-01
Status: read-only investigation completed; **migration NOT applied**, final authorisation test pending.

## Verified production checks
- The current SKU snapshot and direct-labour snapshot have RLS enabled with authenticated SELECT policies requiring auth.uid() IS NOT NULL. Authenticated has schema usage and SELECT on both underlying tables.
- The existing public period-status view grants SELECT to authenticated and is permission filtered through app_has_permission('module:costing-control-center','view'). It is not security_invoker; therefore its internal run-table read is performed under its owner privileges. This is the reason not to add an internal run table grant.
- The period status newer_draft_run_id is generated from completed SUCCESS, CAPTURED_AT_REQUEST runs, excluding an already approved/reference latest run.
- A read-only join against the proposed run-id whitelist returns run 143: 627 READY; run 148: 514 READY, 113 REVIEW_REQUIRED, 1 BLOCKER. Joining the direct-labour snapshot retains 628 rows for 148 without multiplicity.
- Existing index idx_sku_control_snapshot_refresh_run is used by the EXPLAIN for run 148; no new index currently justified. The period-status view is nontrivial and query cost needs actual benchmarking.
- Privilege chain remains to be confirmed with two real, different authenticated identities: one with module permission and one without. Do not claim security approved on superuser-only data.

## Release blockers
1. Execute permitted and denied user access tests in an isolated controlled session, including RLS, correct JWT identity, and arbitrary run filtering.
2. Verify complete SQL in an isolated database/staging environment; assess execution plan and realistic latency. EXPLAIN alone does not measure runtime.
3. Reconcile the migration-history drift and register a uniquely named new migration; never reapply migration 20261015045233.
4. Present exact SQL, preflight/postflight, failure and rollback to owner; await exact written authorisation before production change.
5. Separately correct PR #115 error wording, coordinate Jarvis cache version and obtain its merge approval.

## Progress and parked status
Gate 1 remains underway; 3 of 10 programme acceptance gates passed. C1B read design and read-only schema/row checks complete. Database apply, client selector and frontend investigation are blocked in order. Other parked programme items remain as in ORCHESTRATION_COMPLETION_REGISTER_2026-11-01.md.
