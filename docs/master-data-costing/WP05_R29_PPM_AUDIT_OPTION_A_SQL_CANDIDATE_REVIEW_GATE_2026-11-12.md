# WP05 R29 — Option A Scheme audit VIEW-SPECIFIC SQL candidate, execution HOLD (12 November 2026)

**POLICY APPROVED in R28. IMPLEMENTATION IS REVIEW ONLY AND NOT APPLIED.** Scope: `public.v_costing_scheme_master_audit` only, issue #297. No other D-2 view or production privileges are changed. This document and PR explicitly **do not grant production-execution authority**.

## Prepared artifacts (not in supabase/migrations)

- [Candidate SQL](candidates/WP05_R28_PPM_AUDIT_OPTION_A_REPLACE_VIEW_REVIEW_ONLY.sql): transactionally guarded `CREATE OR REPLACE VIEW`, not DROP/CREATE, for **the same 20 columns**, same `costing.scheme_master_audit` source, same object owner and grants. Uses a single PPM View predicate for ordinary users and preserves existing privileged postgres/service_role branch. Does not modify the global `fn_costing_view_allowed()` used by 48 other views. Precondition checks live prior view MD5 `001024540bdeab9f2e5aa4ec2a6f6c53`, 20 columns, owner and anon/auth SQL ACL. Output postcheck confirms PPM helper and absence of shared helper.
- [Review-only rollback](candidates/WP05_R28_PPM_AUDIT_OPTION_A_ROLLBACK_REVIEW_ONLY.sql): guarded `CREATE OR REPLACE VIEW` restoring the exact prior four-module reader predicate and original 20-column projection. Refuses unknown intervening definitions and checks original fingerprint. Do **not** execute a rollback indiscriminately if live schema has moved.
- [Offline structural/role model tests](../../scripts/wp05-r28-ppm-audit-policy/ppm-audit-policy.test.mjs) and targeted GitHub Actions workflow. Synthetic positive: PPM View, PPM+other, service roles. Synthetic negative: each of CCC/CBM/CSR/MCM View-only, no-UID, PPM Edit-only without View. The assertions check policy design and SQL text, **not** a real Postgres view execution under six distinct JWT identities.

## Independent review and verification gates BEFORE production authorization

1. Compare the candidate with a **fresh** live `pg_get_viewdef` and column/owner/ACL fingerprint to detect drift. Validate the exact view query parses on an isolated compatible PostgreSQL instance with a synthetic `costing.scheme_master_audit` fixture and a synthetic `app_has_permission` contract. The offline Node tests **do not** validate PostgreSQL syntax, privilege behavior or optimizer/security-barrier effects; mark these as NOT TESTED until run.
2. Confirm `CREATE OR REPLACE VIEW` leaves the original `authenticated` SELECT and `anon` denied, with no new direct grants to the audit table. Confirm 20 columns and stable client `actor_user_id` contract. Include exact rollback test on synthetic fixture; original view remains in use in production.
3. Obtain and record the owner's **separate production-execution permission**. If absent, stop at ready-to-review. Do not add to applied Supabase migrations or run the SQL via MCP.
4. After any separately approved deployment, perform controlled catalogue checks (view fingerprint, owner/ACL, role gate metadata), then a distinct, narrowly authorised authenticated **no-row-export** role test where feasible. Without that test, real PPM positive and unrelated-module negative remain **NOT TESTED**. Do not enable flags or alter PWA; client Actor fix already merged #306.
5. If acceptance fails, use the reviewed guarded rollback only after separate operational approval; keep a change record and re-run W5-06 security/freshness acceptance on the exact deployed state.

## Residual truth

**R28 Option A: owner-approved policy.** **Candidate: source prepared, not executed.** W5-06 parent **OPEN**, D-2 role behaviour **NOT TESTED**, other five sensitive view policies undecided, D-1 direct writer-denial **NOT TESTED**, D-4 four-second p95 **HOLD**. Historical AE1 results frozen, WP05 programme **6/13**. No SQL view rows, staff/vendor/actor records, production accounts or permissions were accessed/modified by this preparation.
