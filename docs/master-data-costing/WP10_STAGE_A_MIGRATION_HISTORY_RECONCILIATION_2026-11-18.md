# WP10 Stage A — already-applied migration-history reconciliation and receiving plan
**18 Nov 2026 IST. PLAN/REVIEW PACKAGE ONLY — no migration registered, schema change, SQL replay, PR merge or release.**

## Proven status on production
- Exact Stage A change from `02_stage_a_apply.sql` in commit `947ebe870fc67093876900c00c410ad79ca6dd1c` was owner-authorised and already applied once on Supabase project `qhmoqtxpeasamtlxaoak` (Postgres 17.4).
- Deployment-time preflight `119 PASS / 0 FAIL / 0 WARN / 14 INFO`; exact postflight `58 PASS / 0 FAIL`; separate read-only live catalog showed four policies per table and original `authenticated` SELECT/INSERT/UPDATE/DELETE grants preserved. See [production application receipt](../WP10_STAGE_A_PRODUCTION_APPLIED_RECEIPT_2026-11-18.md).
- As of the read-only follow-up on 18 Nov, `supabase_migrations.schema_migrations` had **705** entries, highest version **`20261116143310`**, **zero** matching Stage A/four-master-classification-RLS migration names. Therefore schema is **ahead of registered migration history**. No unsupported inference that `02` is a registered migration is permitted.
- Original old identity-only `FOR ALL` policies were removed. Current four-table policies are the intended **View AND Edit** DML guard; **Stage B REVOKE was not applied**.

## Migration strategy — conditional state reconciliation, not re-application
**Recommended only after a separate tested PR and owner approval:**

1. On a new branch from current `main`, use installed Supabase CLI `supabase migration new wp10_four_master_stage_a_state_reconciliation` (discover installed CLI version and `--help` first) to allocate a **unique timestamp** above every committed/current remote version. Never guess a migration filename or reuse historical versions. Do not modify any existing registered SQL/migration file. Keep CRLF-only noise untouched.
2. The new migration must be **transactional, fail-closed, state-aware**:
   - **Original baseline** (exact four identity-only `FOR ALL` policies, same grants/helpers) → apply only the exact reviewed Stage A change.
   - **Already-applied Stage A** (exact four named read/insert/update/delete policies per table, canonical View+Edit semantics in every write USING/WITH CHECK, correct roles, RLS, grants and 12 RPCs) → **no-op**, with post-assertion. This is the production path.
   - **Mixed, partially applied, Stage B, foreign policy, unknown grants or function drift** → throw a controlled error and **register nothing**. Never silently loosen/recreate identity-only policy.
3. Assertions must guard all four tables **as a unit**. Include the original `01` preflight only for baseline, and `03` postflight for Stage A. Protect against ambiguous mixed states and later Stage B. Since production is already in Stage A, **never rerun original `02` directly**.
4. Do not simply insert a migration-history row via ad-hoc SQL, and do not mark a migration applied using `supabase migration repair` without proving new/old deployment paths. The documented `migration repair` command changes history only; it does not execute schema repair. Avoid a production-only no-op migration that would leave fresh environments insecure.
5. Source registry/protected-path enforcement is strict (see existing `scripts/wp10-g2-safeguards/source.test.mjs` and earlier #443 receipt). Incorporate the new migration only in a reviewed **named server registration lane**, exact path/hash and branch, with unchanged historical pins and no wildcard bypass. Do not merge a draft source registration that makes protected CI green only by disabling the guard.
6. Test isolated PostgreSQL 16/17 where available: baseline→Stage A, pre-applied→unchanged no-op, mixed original/Stage A→refusal, altered role/policy/expression→refusal, Stage B revoked grants→refusal, second-run stability, and migration-history registration **exactly once**. Validate canonical `View && Edit` including `Edit=true, View=false` denied actor; the previous PG16 27/27 fixture remains author-reported, not real JWT proof.
7. Before any live history registration: independently read live policy/ACL/function fingerprints, read current migration history (version/name count), confirm the proposed exact SQL hash and one unused version, owner decision, test receipts, and rollback strategy for history-record errors. Never execute production DML or publish/release as part of migration recording.
8. After approved registration only: confirm one new migration version in history, unchanged four-table catalog state, unchanged unrelated objects and no client impact. Record before/after history count and exact version/name/hash; do not state this occurred until independently verified.

## Authenticated receiving — do not defer all security checks
- Genuine existing View-only/Editor/No-access sessions are required to validate read-only visibility and client control differences; do not manufacture identities. Existing permissions are counts/SQL-catalog only, not JWT results.
- Live master data must remain unchanged. Any **actual** WRITE test (positive or deliberately denied) goes to disposable non-production fixtures unless the owner expressly grants a tightly scoped production test operation. Never probe live rows or use administrator/service keys as a substitute for real actor roles.
- Verification of a denied JWT request requires actual HTTP status/error metadata; `200` with empty rows is not automatically a successful denial.
- Stage A remains an **interim mitigation**. Once all old installed Electron clients have migrated and been inventoried, separately approve Stage B revocation of authenticated direct DML.

## Security advisor inspection (18 Nov)
Supabase advisor returned seven lint categories; their current counts are **not** demonstrated as new Stage A regressions because there was no paired pre/post snapshot. These are outside the four-table change scope and require separate remediation review:
- `rls_enabled_no_policy` (INFO 129) — [reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- `security_definer_view` (ERROR 88) — [reference](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- `function_search_path_mutable` (WARN 1) — [reference](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- `anon_security_definer_function_executable` (WARN 14) — [reference](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- `authenticated_security_definer_function_executable` (WARN 631) — [reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- `auth_leaked_password_protection` (WARN 1) — [reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- `vulnerable_postgres_version` (WARN 1) — [reference](https://supabase.com/docs/guides/platform/upgrading)

## Receiving gate summary
| Gate | State |
| --- | --- |
| Production Stage A RLS | **APPLIED + 58/58 POSTFLIGHT PASS** |
| Current production migration history | **OBSERVED: 705 entries, Stage A not registered** |
| Collision-safe migration preparation/CI | **PENDING implementation on separate controlled branch** |
| Source-registration / remote history update | **NOT DONE** |
| Real JWT actor/view role validation | **NOT TESTED** |
| Stage B permanent direct-DML REVOKE | **NOT APPLIED / fleet-gated** |
| Formal WP10/WP12 | **OPEN; programme 11/13 CLOSED** |
| Formal Electron release | **HOLD** |

**Do not let this source file trigger an automatic SQL deployment.** It is a planning and receiving document, not an applied migration.
