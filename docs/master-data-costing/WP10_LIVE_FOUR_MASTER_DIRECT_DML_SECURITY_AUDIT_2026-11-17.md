# WP10 — Live four-master direct-DML security catalog assessment (17 November 2026)

**READ-ONLY PRODUCTION CATALOG AUDIT — CONTROL GAP CONFIRMED; NO ACTUAL DML, USER IMPERSONATION OR DATA EXPOSURE TEST.** Project: `qhmoqtxpeasamtlxaoak`.

## Evidence

Used the connected project-approved Supabase SQL interface, transaction `BEGIN READ ONLY`, statement timeout 8 seconds, and SELECT-only PostgreSQL catalog views (`pg_class`, `pg_namespace`, `pg_policies`, `has_table_privilege`).

| `public` table | RLS | `authenticated` INSERT | UPDATE | DELETE | Effective existing RLS policy |
|---|---|---|---|---|---|
| `categories` | ENABLED | GRANTED | GRANTED | GRANTED | `categories_authenticated_crud`, FOR ALL, `auth.uid() IS NOT NULL` for USING and WITH CHECK |
| `sub_categories` | ENABLED | GRANTED | GRANTED | GRANTED | `sub_categories_authenticated_crud`, FOR ALL, same identity-only predicate |
| `product_groups` | ENABLED | GRANTED | GRANTED | GRANTED | `product_groups_authenticated_crud`, FOR ALL, same identity-only predicate |
| `sub_groups` | ENABLED | GRANTED | GRANTED | GRANTED | `sub_groups_authenticated_crud`, FOR ALL, same identity-only predicate |

SELECT grants on all four also observed. RLS `relforcerowsecurity=false`; not required to assess ordinary authenticated callers.

**Assessment:** The four master tables grant data modification to the `authenticated` database role, and their broad `ALL` policies check only for presence of a non-null authenticated user ID. They do **not** enforce per-module Edit permissions, governed classification RPC usage, or the richer server-side invariants. Accordingly, an authenticated caller with REST/table access can potentially use the direct base-table path to evade the governed RPC checks, subject to other controls not exercised by this metadata inspection.

This is a **confirmed authorisation design gap**, not a demonstrated malicious action or observed exploit. Since RLS and privileges combine to allow a broad class of callers, simply leaving the current policy while enabling governed clients does **not** make direct writes impossible. No mutation was attempted because the production business-data boundary remains in force.

## Release relevance and decision options

1. **Safer preferred option (before unconditional WP10 security acceptance):** inventory deployed/legacy Electron callers and their direct-table dependencies; develop a reviewed compatibility/cutover, scoped grant/policy remediation, rollback plan and approved actual-role negative acceptance. A wholesale immediate four-table REVOKE **without client inventory** could break still-installed legacy Electron versions.
2. **Bounded deferral only with explicit risk acceptance:** maintain current legacy compatibility for a named, short-lived migration window, record exposure as **CONFIRMED OPEN SECURITY GAP**, not speculative, assign server/security receiving owner and a dated removal milestone, and retain WP10 OPEN until the owner has accepted an exact functional/security release scope. Do not describe this as secure parity or full access control.
3. **Optional PR #463 is not a direct substitute:** its atomic guards / route hardening are distinct from direct base-table DML revocation. Installing #463 without the separately governed ACL/migration cutover does not close this direct-write gap.

## Controls and limits

No user IDs, credentials, JWT, business records, table rows, insert/update/delete, grant changes, DDL, permission impersonation or API probe were used.

Independent real JWT identity/role and denial tests remain **NOT TESTED**. Metadata demonstrates the policy weakness but not an HTTP status or actual staff-account action. Any claim that direct DML is fully blocked by RLS would contradict the reviewed live policy.

**Formal state:** WP10 OPEN, WP11 CLOSED, WP12 OPEN; 11/13 workpacks CLOSED. Electron release HOLD, optional #463 DRAFT/UNAPPLIED, and NO production permission or SQL changes authorised.

## Owner decision needed

Choose whether to require completed direct-DML cutover before accepting WP10 closure and the combined release, or explicitly accept a strictly bounded, documented exposure with named security owner, firm migration milestone and independently documented legacy fleet safety. Neither option is approved merely by this read-only audit.
