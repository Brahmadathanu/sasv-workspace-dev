#!/usr/bin/env bash
# Synthetic fixture acceptance for SEC-01 (revoke PUBLIC EXECUTE on ten pinned SECURITY DEFINER functions).
# NEVER point at production. Env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE (superuser on the s3f fixture DB
# that already holds the costing fixture), RUNNER_TEMP. Prints S1_FIXTURE_ACCEPTANCE_PASS on success.
set -euo pipefail
S1="docs/master-data-costing/sql/sec01"
R2="docs/master-data-costing/sql/route2"
TMP="${RUNNER_TEMP:-/tmp}"
PW="fixture-only-$$"
ROLE_DSN="postgresql://sasv_archive_ro:${PW}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=disable"
A() { psql -X -q -At -v ON_ERROR_STOP=1 -c "$1"; }
F() { psql -X -q -v ON_ERROR_STOP=1 -f "$1"; }
fail() { echo "FAIL: $*"; exit 1; }
# expect_fail FILE REGEX LABEL : the script must fail with REGEX in its output.
expect_fail() {
  if F "$1" >"$TMP/s1-ef.txt" 2>&1; then fail "accepted: $3"; fi
  grep -Eq "$2" "$TMP/s1-ef.txt" || { cat "$TMP/s1-ef.txt"; fail "wrong failure for: $3"; }
  echo "SEC-01 fail-closed: $3"
}
expect_ok() { F "$1" >"$TMP/s1-ok.txt" 2>&1 || { cat "$TMP/s1-ok.txt"; fail "should pass: $2"; }; }
acl_snapshot() { A "SELECT string_agg(proname || '=' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(proacl::text[]) x),'NULL'), ';' ORDER BY proname) FROM pg_proc WHERE proname LIKE 'rpc\_eaushadhi\_zz\_%'"; }
matrix() { A "SELECT string_agg(r.rolname || ':' || p.proname || ':' || has_function_privilege(r.oid,p.oid,'EXECUTE'), ';' ORDER BY r.rolname, p.proname) FROM pg_roles r, pg_proc p WHERE r.rolname IN ('anon','authenticated','service_role','postgres') AND p.proname LIKE 'rpc\_eaushadhi\_zz\_%'"; }
mk() { sed "s#c_pinned constant text\[\] := ARRAY\[.*\]::text\[\];#c_pinned constant text[] := ARRAY[$LIST]::text[];#" "$1" > "$2"; }
empty_pins() { sed "s#c_pinned constant text\[\] := ARRAY\[.*\]::text\[\];#c_pinned constant text[] := ARRAY[]::text[];#" "$1" > "$2"; }
INFRA="authenticator cli_login_postgres dashboard_user pgbouncer supabase_auth_admin supabase_functions_admin supabase_privileged_role supabase_read_only_user supabase_realtime_admin supabase_replication_admin supabase_storage_admin"
create_fn() { # N
  local n="$1"
  if [ "$n" -ge 9 ]; then
    A "CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_zz_$n(a int, b text) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$f\$ BEGIN RETURN a + $n; END \$f\$"
    A "GRANT EXECUTE ON FUNCTION public.rpc_eaushadhi_zz_$n(int, text) TO anon, authenticated, service_role, postgres"
  else
    A "CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_zz_$n(a int) RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS 'SELECT a + $n'"
    A "GRANT EXECUTE ON FUNCTION public.rpc_eaushadhi_zz_$n(int) TO anon, authenticated, service_role, postgres"
  fi
}
STUBNAMES="$(grep -o "public\.rpc_eaushadhi_[a-z_]*(" $S1/S1_01_revoke_public_execute_eaushadhi_rpc.sql | sed "s/public\.//; s/($//" | sort -u | sed "s/.*/'&'/" | paste -sd, -)"
cleanup() {
  A "DO \$\$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS s FROM pg_proc WHERE proname LIKE 'rpc\_eaushadhi\_zz\_%' LOOP EXECUTE 'DROP FUNCTION ' || f.s; END LOOP; END \$\$"
  A "DO \$\$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS s FROM pg_proc WHERE proname IN ($STUBNAMES) LOOP EXECUTE 'DROP FUNCTION ' || f.s; END LOOP; END \$\$"
  for r in zz_dep zz_member zz_new $INFRA; do A "DROP ROLE IF EXISTS $r"; done
}

# ---- setup ---------------------------------------------------------------------------------------------------
if [ "$(A "SELECT count(*) FROM pg_roles WHERE rolname='sasv_archive_ro'")" != 0 ]; then F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1; fi
cleanup
for r in anon authenticated service_role; do A "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$r') THEN CREATE ROLE $r NOLOGIN; END IF; END \$\$"; done
# ---- the REAL production pins: shape, uniqueness, consistency, resolvability, gate behaviour ----------------------
REAL="$(grep -o "'public\.rpc_eaushadhi_[^']*|[0-9a-f]\{32\}'" $S1/S1_01_revoke_public_execute_eaushadhi_rpc.sql | tr -d "'")"
test "$(echo "$REAL" | wc -l)" = 10
test "$(echo "$REAL" | sort -u | wc -l)" = 10
for f in S1_02_verify_public_execute_revoked S1_03_role_compatibility_assessment S1_99_rollback_restore_public_execute; do
  [ "$(grep -o "'public\.rpc_eaushadhi_[^']*|[0-9a-f]\{32\}'" $S1/$f.sql | tr -d "'")" = "$REAL" ] || fail "pin list differs in $f"
done
echo "SEC-01 real pins: 10 unique entries, identical in S1_01/S1_02/S1_03/S1_99"
echo "$REAL" | while IFS= read -r line; do
  sig="${line%%|*}"; name="${sig#public.}"; name="${name%%(*}"; types="${sig#*(}"; types="${types%)}"
  A "CREATE FUNCTION public.$name($types) RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'" >/dev/null
  A "GRANT EXECUTE ON FUNCTION public.$name($types) TO anon, authenticated, service_role, postgres" >/dev/null
done
F $S1/S1_00_discover_public_definer_functions.sql >"$TMP/s1-stub00.txt" 2>&1
[ "$(grep -o "entry: '[^']*'" "$TMP/s1-stub00.txt" | sed "s/^entry: '//; s/|[0-9a-f]*'$//" | sort)" = "$(echo "$REAL" | sed 's/|[0-9a-f]*$//' | sort)" ] || fail "S1_00 signature format differs from the production pins"
echo "SEC-01 real pins: signature text matches what S1_00 prints for identical signatures"
expect_fail $S1/S1_01_revoke_public_execute_eaushadhi_rpc.sql 'definition fingerprint drift' "real pins reject same-signature functions with a different definition"
# Infrastructure roles: authenticator may SET ROLE into the API roles; the others are plain roles.
for r in $INFRA; do A "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$r') THEN CREATE ROLE $r NOLOGIN; END IF; END \$\$"; done
# Production topology (S1_03 on production): authenticator, cli_login_postgres, supabase_storage_admin can SET ROLE
# into the API roles; the other eight have no membership.
for r in authenticator cli_login_postgres supabase_storage_admin; do A "ALTER ROLE $r LOGIN NOINHERIT"; A "GRANT anon, authenticated, service_role TO $r"; done
EIGHT="dashboard_user pgbouncer supabase_auth_admin supabase_functions_admin supabase_privileged_role supabase_read_only_user supabase_realtime_admin supabase_replication_admin"
assess() { F $S1/S1_03_role_compatibility_assessment.sql >"$TMP/s1-03.txt" 2>&1 || { cat "$TMP/s1-03.txt"; fail "S1_03"; }; }
assess
grep -q 'role authenticator \[COVERED_BY_SET_ROLE\]: login=t inherit=f | direct=0/10 inherited=0/10 public_only=10/10' "$TMP/s1-03.txt" || { grep 'role ' "$TMP/s1-03.txt"; fail "authenticator should be COVERED_BY_SET_ROLE"; }
for r in cli_login_postgres supabase_storage_admin; do
  grep -q "role $r \[COVERED_BY_SET_ROLE\]" "$TMP/s1-03.txt" || fail "$r should be COVERED_BY_SET_ROLE"
done
GOT="$(grep -o 'role [a-z_]* \[LOSES_ACCESS_NO_PATH\]' "$TMP/s1-03.txt" | sed 's/^role //; s/ .*//' | grep -E "^($(echo $INFRA | tr ' ' '|'))$" | sort | paste -sd' ' -)"
[ "$GOT" = "$(echo $EIGHT | tr ' ' '
' | sort | paste -sd' ' -)" ] || fail "LOSES_ACCESS_NO_PATH set among infrastructure roles is [$GOT]"
grep -q 'function-level evidence' "$TMP/s1-03.txt"
echo "SEC-01 S1_03: authenticator, cli_login_postgres, supabase_storage_admin COVERED_BY_SET_ROLE; exactly the eight accepted roles LOSE access"
if [ "$(A "SHOW server_version_num")" -ge 160000 ]; then
  A "REVOKE anon, authenticated, service_role FROM authenticator"
  A "GRANT anon, authenticated, service_role TO authenticator WITH INHERIT FALSE, SET FALSE"
  assess
  grep -q 'role authenticator \[LOSES_ACCESS_NO_PATH\]' "$TMP/s1-03.txt" || fail "membership without SET must not count as covered"
  A "REVOKE anon, authenticated, service_role FROM authenticator"
  A "GRANT anon, authenticated, service_role TO authenticator WITH INHERIT TRUE, SET FALSE"
  assess
  grep -q 'role authenticator \[KEEPS_ACCESS\]' "$TMP/s1-03.txt" || fail "INHERIT membership keeps access"
  A "REVOKE anon, authenticated, service_role FROM authenticator"
  A "GRANT anon, authenticated, service_role TO authenticator"
  echo "SEC-01 S1_03: membership WITHOUT the SET/INHERIT options is not treated as coverage"
fi
A "DO \$\$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS s FROM pg_proc WHERE proname IN ($STUBNAMES) LOOP EXECUTE 'DROP FUNCTION ' || f.s; END LOOP; END \$\$"

for n in 01 02 03 04 05 06 07 08 09 10; do create_fn "$n"; done
ORIG_ACL="$(acl_snapshot)"; ORIG_MATRIX="$(matrix)"
echo "$ORIG_ACL" | grep -Eq '(=|,)=X/postgres' || fail "fixture functions should start PUBLIC-executable"

# ---- discovery (read-only) -----------------------------------------------------------------------------------
F $S1/S1_00_discover_public_definer_functions.sql >"$TMP/s1-00.txt" 2>&1
grep -q 'S1_00 RESULT: 10 PUBLIC-executable' "$TMP/s1-00.txt" || { cat "$TMP/s1-00.txt"; fail "S1_00 should find exactly 10"; }
LIST="$(grep -o "entry: '[^']*'" "$TMP/s1-00.txt" | sed "s/^entry: //" | paste -sd, -)"
test "$(echo "$LIST" | tr ',' '\n' | grep -c 'rpc_eaushadhi_zz_')" = 10
[ "$(acl_snapshot)" = "$ORIG_ACL" ] || fail "S1_00 changed an ACL"
mk $S1/S1_01_revoke_public_execute_eaushadhi_rpc.sql "$TMP/s1-01-raw.sql"
# Other roles that exist in a shared CI/dev cluster (e.g. S3L fixture roles) and rely only on PUBLIC are the
# owner's declared accepted losers for this synthetic run; zz_dep must still be caught.
SHIPPED8="$(grep -o "c_accepted_losers constant text\[\] := ARRAY\[[^]]*\]" $S1/S1_01_revoke_public_execute_eaushadhi_rpc.sql | grep -o "'[a-z_]*'" | tr -d "'" | sort | paste -sd' ' -)"
[ "$SHIPPED8" = "$(echo $EIGHT | tr ' ' '
' | sort | paste -sd' ' -)" ] || fail "shipped accepted-losers list is [$SHIPPED8], not exactly the owner-approved eight"
# Other roles that exist only in a shared dev/CI cluster (e.g. S3L fixture roles) are fixture noise: accept them in a
# test copy, never in the shipped file.
OTHER="$(A "SELECT coalesce(string_agg(quote_literal(rolname), ','), '') FROM pg_roles WHERE NOT rolsuper AND rolname !~ '^pg_' AND rolname NOT IN ('anon','authenticated','service_role','sasv_archive_ro','zz_dep','zz_member','zz_new','$(echo $INFRA | sed "s/ /','/g")')")"
EIGHTLIT="$(echo $EIGHT | sed "s/ /','/g; s/^/'/; s/\$/'/")"
sed "s#c_accepted_losers constant text\[\] := ARRAY\[[^]]*\]::text\[\];#c_accepted_losers constant text[] := ARRAY[$EIGHTLIT${OTHER:+,$OTHER}]::text[];#" "$TMP/s1-01-raw.sql" > "$TMP/s1-01.sql"
if [ -z "$OTHER" ]; then SHIPPED_EXACT=1; else SHIPPED_EXACT=0; fi
mk $S1/S1_02_verify_public_execute_revoked.sql      "$TMP/s1-02.sql"
mk $S1/S1_99_rollback_restore_public_execute.sql    "$TMP/s1-99.sql"
mk $S1/S1_03_role_compatibility_assessment.sql      "$TMP/s1-03z.sql"
expect_ok "$TMP/s1-03z.sql" "S1_03 on the fixture set"
grep -q "role authenticator \[COVERED_BY_SET_ROLE\]" "$TMP/s1-ok.txt"
sed "s#'pgbouncer',##" "$TMP/s1-01.sql" > "$TMP/s1-01-unaccepted.sql"
expect_fail "$TMP/s1-01-unaccepted.sql" "role pgbouncer relied solely on PUBLIC" "a ninth infrastructure role outside the accepted eight stops S1_01"
if [ "$SHIPPED_EXACT" = 1 ]; then
  : # the shipped file (eight only) is exercised unmodified below
else
  expect_fail "$TMP/s1-01-raw.sql" "relied solely on PUBLIC" "shipped list alone does not accept unrelated cluster roles (no wildcard)"
fi
echo "SEC-01 S1_00 discovery: 10 entries, read-only"

# ---- motive: Route 2 R2_03 rejects the reachable definers BEFORE the revoke ----------------------------------------
F $R2/R2_01_create_archive_ro_role.sql >/dev/null 2>&1
A "DO \$\$ BEGIN EXECUTE format('ALTER ROLE sasv_archive_ro LOGIN PASSWORD %L VALID UNTIL %L', '$PW', (now() + interval '2 days')::text); END \$\$"
if F $R2/R2_03_verify_archive_ro_permissions.sql >"$TMP/s1-r203a.txt" 2>&1; then fail "R2_03 should reject reachable definers before SEC-01"; fi
grep -q 'REACHABLE SECURITY DEFINER: public.rpc_eaushadhi_zz_01' "$TMP/s1-r203a.txt" || { cat "$TMP/s1-r203a.txt"; fail "R2_03 should name the functions"; }
echo "SEC-01 motive confirmed: R2_03 rejects the ten before the revoke"

# ---- fail-closed gates (each must leave ACLs untouched) -----------------------------------------------------------
for f in S1_01_revoke_public_execute_eaushadhi_rpc S1_02_verify_public_execute_revoked S1_99_rollback_restore_public_execute S1_03_role_compatibility_assessment; do
  empty_pins $S1/$f.sql "$TMP/s1-empty.sql"
  expect_fail "$TMP/s1-empty.sql" 'pinned list not populated' "$f with an empty pin list"
done
expect_fail "$TMP/s1-02.sql" 'PUBLIC still holds' "S1_02 before the revoke"
expect_fail "$TMP/s1-99.sql" 'already PUBLIC-executable' "rollback before the change"

A "CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_zz_01(a int) RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS 'SELECT a + 1001'"
expect_fail "$TMP/s1-01.sql" 'definition fingerprint drift' "changed function body"
[ "$(acl_snapshot)" = "$ORIG_ACL" ] || fail "ACL changed by a failed run (drift)"
create_fn 01

A "CREATE FUNCTION public.rpc_eaushadhi_zz_extra(a int) RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT a'"
expect_fail "$TMP/s1-01.sql" 'NOT in the pinned set' "extra PUBLIC-executable definer not pinned"
A "DROP FUNCTION public.rpc_eaushadhi_zz_extra(int)"

A "REVOKE EXECUTE ON FUNCTION public.rpc_eaushadhi_zz_02(int) FROM authenticated"
expect_fail "$TMP/s1-01.sql" 'no EXPLICIT EXECUTE grant to authenticated' "missing explicit API grant"
A "GRANT EXECUTE ON FUNCTION public.rpc_eaushadhi_zz_02(int) TO authenticated"

A "DROP FUNCTION public.rpc_eaushadhi_zz_10(int, text)"
expect_fail "$TMP/s1-01.sql" 'pinned signature not found' "pinned function missing"
create_fn 10

A "CREATE ROLE zz_dep NOLOGIN"
expect_fail "$TMP/s1-01.sql" 'role zz_dep relied solely on PUBLIC' "role depending solely on PUBLIC"
[ "$(acl_snapshot)" = "$ORIG_ACL" ] || fail "ACL changed by a failed run (zz_dep)"
[ "$(matrix)" = "$ORIG_MATRIX" ] || fail "API matrix changed by a failed run"

# Owner-accepted loser mechanism, then rollback to the exact original ACL.
sed "s#c_accepted_losers constant text\[\] := ARRAY\[#c_accepted_losers constant text[] := ARRAY['zz_dep',#" "$TMP/s1-01.sql" > "$TMP/s1-01-acc.sql"
expect_ok "$TMP/s1-01-acc.sql" "owner-accepted loser"
grep -q 'zz_dep(accepted)' "$TMP/s1-ok.txt"
expect_ok "$TMP/s1-99.sql" "rollback after accepted-loser run"
[ "$(acl_snapshot)" = "$ORIG_ACL" ] || fail "rollback did not restore the exact original ACLs"
echo "SEC-01 rollback restored the original ACL entries (order-normalised)"
A "DROP ROLE zz_dep"

# ---- the real change ----------------------------------------------------------------------------------------------
A "CREATE ROLE zz_member LOGIN NOINHERIT"; A "GRANT authenticated TO zz_member"
shape() { A "SELECT DISTINCT (SELECT string_agg(x, ',' ORDER BY x COLLATE \"C\") FROM unnest(proacl::text[]) x) FROM pg_proc WHERE proname LIKE 'rpc\_eaushadhi\_zz\_%'"; }
PROD_SHAPE="=X/postgres,anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres"
POST_SHAPE="anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres"
[ "$(shape)" = "$PROD_SHAPE" ] || fail "fixture ACL is not the production shape: $(shape)"
if [ "$SHIPPED_EXACT" = 1 ]; then APPLY="$TMP/s1-01-raw.sql"; else APPLY="$TMP/s1-01.sql"; fi
expect_ok "$APPLY" "SEC-01 apply (shipped file, owner-approved eight)"
[ "$(shape)" = "$POST_SHAPE" ] || fail "post-apply ACL shape is $(shape)"
for r in $EIGHT; do grep -q "$r(accepted)" "$TMP/s1-ok.txt" || fail "$r not reported as an accepted loser"; done
for r in authenticator cli_login_postgres supabase_storage_admin; do grep 'retain it by membership/SET ROLE' "$TMP/s1-ok.txt" | grep -q "$r" || fail "$r not reported as covered"; done
echo "SEC-01 applied: production ACL shape {PUBLIC,4 API roles} -> {4 API roles}; eight accepted losers reported; three SET-role infrastructure roles covered (shipped file unmodified: $SHIPPED_EXACT)"
grep -q 'S1_01 OK: PUBLIC EXECUTE revoked on 10 functions' "$TMP/s1-ok.txt"
grep 'retain it by membership/SET ROLE' "$TMP/s1-ok.txt" | grep -q 'authenticator' && grep 'retain it by membership/SET ROLE' "$TMP/s1-ok.txt" | grep -q 'zz_member' || { cat "$TMP/s1-ok.txt"; fail "NOINHERIT members should be reported as covered"; }
[ "$(matrix)" = "$ORIG_MATRIX" ] || fail "application-role EXECUTE matrix changed"
! acl_snapshot | grep -Eq '(=|,)=X/postgres' || fail "a PUBLIC entry remains"
for r in anon authenticated service_role; do
  psql -X -q -At -v ON_ERROR_STOP=1 -c "SET ROLE $r; SELECT public.rpc_eaushadhi_zz_01(1), public.rpc_eaushadhi_zz_09(1,'x')" >/dev/null || fail "$r lost access"
done
echo "SEC-01 anon/authenticated/service_role still execute all ten; postgres unchanged"
A "CREATE ROLE zz_new NOLOGIN"
if psql -X -q -At -c "SET ROLE zz_new; SELECT public.rpc_eaushadhi_zz_01(1)" >"$TMP/s1-new.txt" 2>&1; then fail "a new role could execute via PUBLIC"; fi
grep -q 'permission denied' "$TMP/s1-new.txt"
if psql "$ROLE_DSN" -X -q -At -c "SELECT public.rpc_eaushadhi_zz_01(1)" >"$TMP/s1-arc.txt" 2>&1; then fail "archive role executed a pinned function"; fi
grep -q 'permission denied' "$TMP/s1-arc.txt"
A "DROP ROLE zz_new"
expect_ok "$TMP/s1-02.sql" "S1_02 after apply"
grep -q 'S1_02 PASS' "$TMP/s1-ok.txt"
expect_ok $R2/R2_03_verify_archive_ro_permissions.sql "R2_03 after SEC-01"
echo "SEC-01 archive role cannot execute any of the ten; R2_03 passes after the revoke"
expect_fail "$TMP/s1-01.sql" 'not PUBLIC-executable' "re-running the migration (already applied)"

# ---- rollback guards ----------------------------------------------------------------------------------------------
A "CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_zz_03(a int) RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS 'SELECT a + 2003'"
expect_fail "$TMP/s1-99.sql" 'definition drift' "rollback refuses drifted function"
expect_fail "$TMP/s1-02.sql" 'definition drift' "S1_02 refuses drifted function"
create_fn 03
POST_ACL="$(acl_snapshot)"
expect_ok "$TMP/s1-99.sql" "rollback"
[ "$(acl_snapshot)" = "$ORIG_ACL" ] || fail "rollback ACL differs from original"
[ "$(shape)" = "$PROD_SHAPE" ] || fail "rollback did not restore the production ACL shape: $(shape)"
echo "SEC-01 rollback restored the exact production ACL shape"
expect_fail "$TMP/s1-99.sql" 'already PUBLIC-executable' "rollback twice"
expect_ok "$TMP/s1-01.sql" "re-apply after rollback"
[ "$(acl_snapshot)" = "$POST_ACL" ] || fail "re-apply ACL differs from first apply"
echo "SEC-01 apply -> rollback -> re-apply is repeatable and ACL-exact"

# ---- cleanup ------------------------------------------------------------------------------------------------------
F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1
cleanup
echo S1_FIXTURE_ACCEPTANCE_PASS
