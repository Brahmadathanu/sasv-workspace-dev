# PEC R2 — Add Line status control (server review gate)

**12 November 2026 | Parent #369 and #284 | REVIEW-ONLY**

Do not execute this proposal on production without separate owner authorization.

## Read-only live findings

- Authenticated public.proc_indent_add_line is a SECURITY DEFINER wrapper that requires PEC Edit; authenticated has EXECUTE, anonymous does not.
- Its internal proc_indent_add_line_pec_internal is not directly executable by authenticated or anonymous roles, only privileged callers.
- Existing internal logic rejects closed/cancelled but allows approved/issued with reason; it uses INSERT ON CONFLICT DO UPDATE. Thus both new line creation and existing-line correction use one wrapper.
- Uniqueness: (indent_id, material_class_id, stock_item_id, uom_id). Live approved header aggregate: 39 manual, 6 PR-linked. No live rows were changed.

## Additive server proposal

File: supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql

The wrapper's PEC Edit permission remains. Lock the indent header FOR UPDATE; check the exact existing line key. New identity is allowed only for draft manual/non-PR indents. New identity is rejected for approved, issued, closed, cancelled, and PR-linked indents, regardless of reason. Existing identity delegates to the established internal function so that governed approved/issued existing-line corrections retain their existing reason/status/quantity policies. No permission expansion, no new RPC, no modification of earlier production migration files.

## Required acceptance (all NOT TESTED until executed)

1. Isolated PostgreSQL fixture with real wrapper/internal and schemas. Test draft manual new PASS; draft PR-linked new DENY; approved manual and PR-linked new DENY even with reason; issued/closed/cancelled new DENY.
2. Existing key correction on approved/issued with reason follows existing rules; missing reason DENY. A changed item/class/UOM is a new identity and DENIED.
3. Real authenticated editor, View-only, no-access and anon permission negatives. Do not fake JWTs or claim SQL SET ROLE proves genuine user acceptance.
4. Concurrency: race a status transition with a new line request. Confirm serialized status check and no post-approval creation.
5. Run in isolated PostgreSQL or an approved disposable test database, never live production fixtures. Static CI is not a substitute.
6. After explicit separate owner SQL approval: hash migration, execute guarded migration, verify function source/ACL, run safe role tests and reconcile official history via CLI only under distinct approval.

## Current evidence

Static source assertions: scripts/pec-r2-server-addline-guard.test.mjs; separate CI workflow. These are static only. Live production SQL remains unmodified. Owner hands-on R2 preview, installed-PWA and Windows/signed-in Electron are pending. Formal G0–G5 unchanged.

## Cleanup

No production test rows or permissions were created. Preserve migrations, audit evidence and CI logs. Remove only confirmed disposable local test fixtures after release acceptance.

## 13 November independent pre-deployment test hardening

- Source migration remains **unchanged**; no live SQL or migration-history edit.
- The isolated PostgreSQL 17 negative-test helper now asserts exact SQLSTATE: `23514` for invalid new-row identity/status, `P0001` for governed existing-row reason rejection, and `42501` when the PEC Edit gate is not granted in the fixture.
- It also asserts that denials do not insert extra lines, and that replacing the stock-item identity on an approved indent is treated as a new row, not a correction.
- Dedicated PostgreSQL CI passed after this refinement at `f0d07c12`. This is simulated role/fixture evidence, **not genuine signed-in JWT evidence**.
- The unrelated general PEC browser workflow runs a client-only static guard that intentionally rejects `supabase/migrations/` changes on a non-integration descendant PR; that guard must not be modified to allow this migration. Treat the dedicated server PG17 workflow as the scoped server test while retaining the general CI failure visibly.
- A separate owner authorization is required before any production execution, followed by exact signature/ACL fingerprint verification and approved negative-role testing. The ten historical PEC migration records remain a distinct gated reconciliation.
