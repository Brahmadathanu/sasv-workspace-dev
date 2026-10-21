# G6 security and executable-test availability — 21 October 2026

Scope: read-only production SQL metadata and local executable availability; no server change, run, approval or Sheets operation.

## Verified permissions
- `costing.rpc_accept_regional_marketing_review`: EXECUTE = authenticated TRUE; anon FALSE; source function calls `public.require_permission('module:costing-control-center',true)` before mutation.
- `costing.fn_regional_marketing_review_status`: EXECUTE = authenticated TRUE; anon TRUE; SECURITY DEFINER; BUT anon schema USAGE for costing is FALSE, and anon acceptance and designation table SELECT FALSE. Thus direct anonymous invocation through the costing schema is denied by schema USAGE; granting EXECUTE alone does not demonstrate external exposure. Verify API exposed-schema configuration separately before final acceptance.
- authenticated schema USAGE = TRUE. The two sensitive tables have RLS disabled, but authenticated direct INSERT into acceptance and designation was verified FALSE in prior read-only checks; RLS disabled with denied table grants does not imply writable public exposure.
- Run136 has zero designation entries.
- Earlier 17/17 integrity and all seven pool financial conservation PASS.

## Negative and concurrency test execution status
Local available runtime inspection found no `psql`, `postgres` or `docker` binaries, and no installed Python psycopg or testing.postgresql. Therefore isolated native PostgreSQL transaction/concurrency tests **were not executed**. Do not equate inspected SQL predicates or mathematical fixtures with executable transaction isolation proof. Production was not used as a mutation testbed.

## G6 disposition
Current-release G2 numerical pass; G6 financial pass. G6 full server assurance remains HOLD until isolated PostgreSQL permission, denied/changed evidence and parallel-session test results plus API exposure and governed release provenance are verified. No user approval/designation and no Sheets.
