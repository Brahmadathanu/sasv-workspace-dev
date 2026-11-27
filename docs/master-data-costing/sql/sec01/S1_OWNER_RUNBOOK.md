# SEC-01 owner runbook - revoke PUBLIC EXECUTE on ten eAushadhi SECURITY DEFINER functions

Status: PREPARED, NOT EXECUTED. Separate from Route 2 role creation. No production run is authorised by this file;
the owner approves the exact SQL in this folder (commit hash recorded in the PR) before anything is applied.

Scope: exactly the ten pinned `public.rpc_eaushadhi_*` functions (signature + md5 of `pg_get_functiondef`, identical
in S1_01, S1_02, S1_03, S1_99). The only privilege change is `REVOKE EXECUTE ... FROM PUBLIC`.
The explicit EXECUTE grants for `anon`, `authenticated`, `service_role`, `postgres` are verified and preserved.

Owner decision recorded (25 Nov 2026): the eight roles below lose their PUBLIC-derived EXECUTE and are the only
accepted losers (`c_accepted_losers` in S1_01, no wildcard): dashboard_user, pgbouncer, supabase_auth_admin,
supabase_functions_admin, supabase_privileged_role, supabase_read_only_user, supabase_realtime_admin,
supabase_replication_admin. Basis: no repository code, SQL caller, trigger or cron job uses these functions from those
roles. This is absence of repository evidence, not proof of non-use (production `track_functions` is `none`);
access loss is expected, service impact is not expected. Covered by SET ROLE into the API roles and therefore not
losers: authenticator, cli_login_postgres, supabase_storage_admin.

## Sequence (administrator, as the function owner `postgres`, `psql -v ON_ERROR_STOP=1 -f`)

1. Preflight, read-only, immediately before apply (fingerprints can drift):
   - `S1_00_discover_public_definer_functions.sql` - must print `RESULT: 10` and the same ten entries as the pin list.
   - `S1_03_role_compatibility_assessment.sql` - the LOSES_ACCESS_NO_PATH set must be exactly the eight accepted roles
     (any other name: stop, do not apply).
2. Apply: `S1_01_revoke_public_execute_eaushadhi_rpc.sql`. One transaction, `lock_timeout 3s`, `statement_timeout 60s`.
   It aborts with no change on: unpopulated/duplicate pins, missing function, owner / SECURITY DEFINER / fingerprint
   drift, an API role without its explicit grant, a PUBLIC-executable `rpc_eaushadhi_*` definer outside the pin, any
   role that would lose access and is neither SET-role covered nor one of the eight, any gained access, any changed
   non-PUBLIC ACL entry, or `sasv_archive_ro` still able to execute a pinned function.
   Expected last notices: `S1_01 OK ...`, covered roles `[authenticator cli_login_postgres supabase_storage_admin ...]`,
   owner-accepted losers (the eight).
3. Verify, read-only: `S1_02_verify_public_execute_revoked.sql` must end with `S1_02 PASS`.
   Application smoke: sign in as an ordinary eAushadhi user and open a product review (the browser client calls the
   functions through PostgREST as `authenticated`).
4. Rollback (only if step 3 shows an application break): `S1_99_rollback_restore_public_execute.sql`, same drift
   guards, re-grants EXECUTE TO PUBLIC on the same ten and verifies the PUBLIC entry is restored (owner-granted,
   non-grantable), i.e. the original production ACL shape
   `{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}`.
   Rolling back re-opens the exposure that blocks Route 2 `R2_03`.

## Evidence (PostgreSQL 17 fixture, `S1_FIXTURE_ACCEPTANCE.sh`, also a CI step)

Real pins validated for shape/uniqueness/identity; production topology reproduced (three SET-role roles, eight with
no path); shipped S1_01 applied unmodified; ACL shape PUBLIC+4 -> 4 and back verified; API role matrix unchanged;
new role and archive role denied; drift, missing grant, missing function, unpinned definer, ninth loser, rerun, double
rollback, drifted rollback all fail closed; apply -> rollback -> re-apply repeatable.

## After SEC-01 is applied

Return directly to the Route 2 archive-access workflow (R2_01 ... R2_05). No other Supabase permission redesign.
