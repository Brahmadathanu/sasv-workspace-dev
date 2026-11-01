# C1B production deployment record — 1 November 2026
Status: APPLIED on project qhmoqtxpeasamtlxaoak with explicit owner approval in conversation. No GitHub PR merged.

## Production changes executed
1. Supabase migration name: c1b_run_scoped_sku_control_status_read_view. Applied exact SQL from C1B_EXACT_SQL_PROPOSED_NOT_APPLIED.sql in this draft PR. Result: success.
2. Postflight found inherited SELECT/INSERT/UPDATE/etc privileges for authenticated and service_role. Corrected immediately under approved read-only intent using migration c1b_run_scoped_sku_view_select_only_grants: revoked all on new view for authenticated, service_role, anon, public; granted SELECT only to authenticated and service_role. Result: success.

## Verified postflight
- New view security_invoker=true; authenticated SELECT true, INSERT and UPDATE false, anon SELECT false; only SELECT privilege for authenticated/service_role; owner postgres retains ownership privileges.
- New and prior approved-run status views have exactly 40 columns with matching names/types (independent information_schema comparison).
- October approved 143: 627 READY, unchanged; 148: 514 READY / 113 REVIEW_REQUIRED / 1 BLOCKER (628). Failed 147 returns zero rows; 143 control status parity comparison yielded zero mismatches.
- Approved October run remains 143. Pricing view was not modified.
- No costing snapshot data or run designation changes. No client flag changes or PR merges.

## Residual acceptance
Live permitted-versus-denied authenticated identity test not completed; do not label it passed until genuine application session tests. C1B client run selector package can now be prepared but cannot be accepted without browser validation and permissions exercise.

## Rollback
Disable dependent feature first. Owner-authorised DROP VIEW public.v_costing_pricing_sku_control_status_by_run; do not alter historical snapshots or existing approved view.

## Next
C1B client package: select approved run 143 or newer successful draft 148 from authorised period status, load by period + run through new view, honour readonly and frozen-run semantics, reuse existing row navigation. Coordinate PR #115 improvements and Jarvis cache bump. Keep all GitHub PRs draft until owner merge approval.
