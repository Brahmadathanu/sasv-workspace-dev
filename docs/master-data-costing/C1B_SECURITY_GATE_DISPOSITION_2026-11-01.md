# C1B — Security gate disposition (1 November 2026)

**Status: staging and identity-based security verification BLOCKED by environment availability. No production migration applied.**

Verified in live production by read-only SQL:
- public.app_has_permission(text,text) exists; it is not SECURITY DEFINER.
- Authenticated SELECT and schema USAGE exist on underlying SKU-control and direct-labour snapshots; both use RLS with non-null auth.uid() SELECT policies.
- Authenticated users have no direct SELECT on costing.costing_refresh_run.
- Existing permission-checked public period-run-status view exposes a successful newer_draft_run_id for October.
- Proposed run whitelist has 627 READY for 143 and 514 READY / 113 REVIEW_REQUIRED / 1 BLOCKER for 148. Direct-labour join preserves all 628 rows.
- EXPLAIN uses idx_sku_control_snapshot_refresh_run, but this is planner evidence, not end-user latency measurement.

Environmental limitations:
- Supabase list_branches returned zero branches. No existing staging database for isolated migration.
- This connector does not provide a known authenticated test identity/session impersonation for both an allowed and a denied user.
- An actual staging migration and real-user access-control exercise therefore have NOT been completed; do not mark these checks as passed.

Implementation proposal:
- Keep the proposed C1B SQL draft outside applied migrations until owner approval and independent verification.
- Provision an authorised staging environment only after cost confirmation and then perform positive/negative identity tests, denied arbitrary run, missing permission, run 147 failed, 143 parity and 148 counts, EXPLAIN ANALYZE, rollback.
- Do not broaden access to costing_refresh_run or replace pricing run selection; do not apply a production migration just to test access.
- PR #115 still needs status-read-error wording correction and Jarvis cache coordination. Both PR #115 and this documentation PR remain unmerged.
- Full end-to-end Gate 1 approval remains blocked until server read contract and client C1B are verified.

Decision: production migration is NOT ready for unconditional GO; recommend safe staging testing before requesting final production approval. The user has not approved adding a billable branch.
