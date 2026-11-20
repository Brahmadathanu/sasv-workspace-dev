# C1B exact deployment gate / acceptance record — 2026-11-01
Status: exact SQL prepared and reviewed as text. NOT APPLIED.

## Preflight confirmed
- Existing period-run-status view is permission filtered and exposes successful newer draft run 148. Existing governed-run view remains approved run 143.
- Existing public SKU-status snapshot view contains 41 fields. Proposed new view deliberately duplicates the same 41 names and direct-labour overrides without modifying the current view.
- Underlying SKU and labour snapshots are SELECT granted to authenticated, with RLS non-null auth.uid() policies and schema usage. Internal costing_refresh_run is NOT exposed to authenticated.
- public.app_has_permission(text,text) exists.
- Actual join: 143 = 627 READY, 148 = 514 READY / 113 REVIEW_REQUIRED / 1 BLOCKER; labour join preserves 628 rows in run 148.
- EXPLAIN selects idx_sku_control_snapshot_refresh_run for run 148. This is *not* a production latency benchmark.
- No paid staging branch per owner decision.

## Exact SQL
See C1B_EXACT_SQL_PROPOSED_NOT_APPLIED.sql on this draft branch. Do not copy old discussion drafts in preference to this reviewed file. Use a unique migration version when owner authorises deploy. No changes to migration 20261015045233.

## Deployment approval conditions
Owner explicitly approves migration by its exact filename/hash or repository PR and confirms deploy to project qhmoqtxpeasamtlxaoak. The owner-approved SQL is executed only once with Supabase apply_migration and logged.
Rollback if any invariant fails: disable dependent client flag; DROP VIEW public.v_costing_pricing_sku_control_status_by_run. The new view has no dependencies before C1B client adoption.

## Production postflight
1. Check metadata: view security_invoker=true, grants SELECT only to authenticated/service_role (plus owner), no grant to anon/Public.
2. Confirm exact field names/types parity with public.v_costing_pricing_sku_control_status_snapshot.
3. Run 143 row parity (627), run 148 status counts 514/113/1 (628); failed 147 inaccessible; arbitrary unlisted runs inaccessible.
4. Validate that pricing source still selects 143; no changed approved designation or run fingerprint.
5. Exercise permitted and denied browser identities if available; do not claim denied-access verified without a genuinely denied identity.
6. Check frontend request latency and error states before completing Gate 1.
7. Roll back promptly on grant, integrity, or performance failure.

## Client dependency
Claude PR #115 error-text correction and Jarvis cache coordination pending. Claude C1B run selector may be dispatched only once this read surface is approved, deployed and verified.

## Other programme work
No change in 3/10 completed-gate baseline. The remaining gates and parked items are tracked in PR #114; documentation PR #116 is the current C1B evidence package.
