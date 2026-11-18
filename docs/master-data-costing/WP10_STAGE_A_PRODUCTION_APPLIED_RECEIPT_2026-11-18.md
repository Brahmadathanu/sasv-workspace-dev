# WP10 Stage A — production RLS application receipt (18 Nov 2026 IST)

**Status: APPLIED AND POSTFLIGHT PASSED — interim permission hardening only.** This is an operator receipt for Supabase project `qhmoqtxpeasamtlxaoak` (PostgreSQL 17.4); not formal WP10 closure, Stage B, migration registration, Electron publication, or real-JWT acceptance.

## Owner authority and provenance
Owner explicitly approved: "Go ahead and implement it" after receiving the specific scope for Stage A RLS, refreshed preflight, postflight and preserving Stage B/release HOLD. Applied **exactly** from PR #477 reviewed head `947ebe870fc67093876900c00c410ad79ca6dd1c`, with no extra SQL changes:
- `01_preflight_readonly.sql`: Git blob `73ffd379a71ccd707c91fe8bdcc0b30d9e20c033`.
- `02_stage_a_apply.sql`: Git blob `a2239914fb910fab3142842d02765741c3c90769`.
- `03_postflight_readonly.sql`: Git blob `828b10bce94fbf91dfe756f781cb23183f9b33bc`.
- `99_rollback_stage_a.sql`: available in the same reviewed commit but **NOT EXECUTED**.

## Execution and independent results
1. Before deployment, executed the exact `01` query read-only on the connected live database: **RESULT PASS 119 / FAIL 0 / WARN 0 / INFO 14**. Four P21 counts of canonical `can_edit=true, can_view!=true` were **0**.
2. Executed `02_stage_a_apply.sql` **once** on production. Transaction returned successfully (the SQL itself includes drift guards, post-assertions and explicit `COMMIT`).
3. Executed exact `03_postflight_readonly.sql`: **RESULT PASS 58 / FAIL 0**. Expected four per-table policies, 12 governed RPCs and all prior `authenticated` table grants confirmed.
4. Independently re-read live catalog in a separate read-only transaction: each of four tables shows exactly 4 policies (`_read` SELECT, `_insert` INSERT, `_update` UPDATE, `_delete` DELETE), all permissive; `authenticated` SELECT/INSERT/UPDATE/DELETE table grants still true for all four.
5. No product, hierarchy, costing, permission-row or other business-record DML was intentionally issued. No real user-token or direct write probe was performed. This receipt does **not** assert data-content fingerprints or fully demonstrated real-user behaviour.

## Effective scoped change
Replaced a single `auth.uid() IS NOT NULL` `FOR ALL` policy on each of `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups` with:
- SELECT: retains existing signed-in read condition.
- INSERT/UPDATE/DELETE: requires both `public.app_has_permission(<module>,'view')` **AND** `public.app_has_permission(<module>,'edit')`. UPDATE applies both `USING` and `WITH CHECK`.
- Table grants, RPC bodies, identities, permissions and other schema objects unchanged. Existing RPCs are SECURITY DEFINER and their catalog compatibility has been checked; no actual Editor/V-only/No-access JWT HTTP case was performed.

## Risk and receiving gates
- **Improved:** View-only and lacking-Edit identities should now fail direct table writes as a matter of policy; positive/negative real JWT acceptance remains **NOT TESTED**.
- **Not eliminated:** authorised legacy Editors can still write directly and may bypass governed RPC validation. Stage B removal of direct authenticated DML remains mandatory **after** staff-installed client versions are independently verified RPC-only.
- **Versioned migration reconciliation:** the SQL was deliberately stored outside `supabase/migrations`. A separately reviewed and collision-aware history/reconciliation plan is required to ensure future deploys do not accidentally replay the already-applied policy change. Do not blindly convert this to an ordinary auto-applied migration or re-run `02`.
- **Rollback:** `99` is NOT executed. It recreates identity-only broad access and must be treated as an emergency security incident with separate owner approval.
- **Formal status:** WP10 OPEN, WP12 OPEN, WP11 CLOSED, 11/13 workpacks closed. Electron release HOLD, PR #476/#477 draft/unmerged, optional SQL PR #463 draft/unapplied, no Stage B revocation.

## Next actions
1. Run appropriately authorised read-only real-account permission and hierarchy access checks; non-production disposable fixtures for any actual write-negative/positive behaviour.
2. Reconcile operational deployment receipt into the source/migration governance without rerunning applied SQL.
3. Stage B only after final formal Electron release deployed and actual managed fleet versions verified; separate owner approval required.
