# WP10 — Four-level privilege-revoke rollout, isolation evidence and Electron compatibility (2026-11-16)

## Live ACL baseline (read only)
All four tables `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups` grant `authenticated=arwd` (INSERT, SELECT, UPDATE, DELETE). `service_role` and `postgres` retain their grants. All four RLS policies currently allow authenticated CRUD on `auth.uid() IS NOT NULL`, without a module Edit check. The new RPCs instead enforce the appropriate `module:manage-*` canonical Edit permission.

## Four-level revoke and recovery — NOT APPLIED
- `scripts/wp10-g2-safeguards/review-only-four-level-auth-dml-revoke.sql`: transactional preflight requiring current direct-DML baseline, presence of all 12 RPCs and SELECT, then REVOKE INSERT/UPDATE/DELETE from `authenticated` on the four tables, followed by postflight asserting SELECT preserved and DML absent.
- `scripts/wp10-g2-safeguards/review-only-four-level-auth-dml-revoke-rollback.sql`: transactional preflight requiring revoked state; GRANT exactly the prior three write privileges; postflight asserts restoration. Requires its own owner decision.
- Isolated PostgreSQL fixture `classification-crud-pg.test.mjs` now installs all 12 RPCs, tests all 12 View-only denials, editor writes, anonymous denial, cascades/foreign keys, kind validation, direct-DML revoke, preserved read privileges, editor RPC survival, bypass rejection and privilege/function rollbacks. Fixture uses synthetic schema and identities; never live Supabase.

## Electron compatibility is a hard release gate
`main.js` bundles the application’s local files through `express.static(path.join(__dirname))` and configures `electron-updater` for GitHub releases. It checks at startup, interval and focus, with `autoDownload=true` and `autoInstallOnAppQuit=true`, plus a user-initiated restart handler. **This does not force an already-running old client to update immediately.** Old versions of the four screens contain direct table writes and would fail after the revoke.

Only after a sufficiently verified uptake of a compatible Electron release, or an explicitly owner-approved change to the old-client support policy, may the authenticated DML revoke be proposed for actual application. A staged server-first and client-release-first deployment without REVOKE is the compatibility-safe sequence, but leaves the existing permission exposure temporarily open. Do not pretend an immediate revoke is harmless.

## Evidence and decisions
- Prior exact-head CI run `43838729809` completed SUCCESS for staged 12-RPC integration: 24/24 isolated PG checks, static contract and existing WP10 suites. This was **before** adding four-level revoke fixtures.
- Revised revoke, comprehensive negative-role coverage and rollback tests are on the draft review branch; full exact-head CI verification is required before claiming PASS.
- WP10 CL15 product activation / route concurrency and unapplied G2 proposals 04/05 remain independent blockers for closure. A green four-level CRUD fixture is not a proof that CL15 is resolved.
- No production writes, no merge, no permissions revoked, no deployment, no flags, no closure. WP10 OPEN.
