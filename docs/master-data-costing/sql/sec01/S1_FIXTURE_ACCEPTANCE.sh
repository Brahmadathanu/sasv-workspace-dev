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
mk() { sed "s#c_pinned constant text\[\] := ARRAY\[\]::text\[\];#c_pinned constant text[] := ARRAY[$LIST]::text[];#" "$1" > "$2"; }
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
cleanup() {
  A "DO \$\$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS s FROM pg_proc WHERE proname LIKE 'rpc\_eaushadhi\_zz\_%' LOOP EXECUTE 'DROP FUNCTION ' || f.s; END LOOP; END \$\$"
  for r in zz_dep zz_member zz_new; do A "DROP ROLE IF EXISTS $r"; done
}

# ---- setup ---------------------------------------------------------------------------------------------------
if [ "$(A "SELECT count(*) FROM pg_roles WHERE rolname='sasv_archive_ro'")" != 0 ]; then F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1; fi
cleanup
for r in anon authenticated service_role; do A "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$r') THEN CREATE ROLE $r NOLOGIN; END IF; END \$\$"; done
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
PRE="$(A "SELECT coalesce(string_agg(quote_literal(rolname), ','), '') FROM pg_roles WHERE NOT rolsuper AND rolname !~ '^pg_' AND rolname NOT IN ('anon','authenticated','service_role','sasv_archive_ro')")"
sed "s#c_accepted_losers constant text\[\] := ARRAY\[\]::text\[\];#c_accepted_losers constant text[] := ARRAY[$PRE]::text[];#" "$TMP/s1-01-raw.sql" > "$TMP/s1-01.sql"
mk $S1/S1_02_verify_public_execute_revoked.sql      "$TMP/s1-02.sql"
mk $S1/S1_99_rollback_restore_public_execute.sql    "$TMP/s1-99.sql"
echo "SEC-01 S1_00 discovery: 10 entries, read-only"

# ---- motive: Route 2 R2_03 rejects the reachable definers BEFORE the revoke ----------------------------------------
F $R2/R2_01_create_archive_ro_role.sql >/dev/null 2>&1
A "DO \$\$ BEGIN EXECUTE format('ALTER ROLE sasv_archive_ro LOGIN PASSWORD %L VALID UNTIL %L', '$PW', (now() + interval '2 days')::text); END \$\$"
if F $R2/R2_03_verify_archive_ro_permissions.sql >"$TMP/s1-r203a.txt" 2>&1; then fail "R2_03 should reject reachable definers before SEC-01"; fi
grep -q 'REACHABLE SECURITY DEFINER: public.rpc_eaushadhi_zz_01' "$TMP/s1-r203a.txt" || { cat "$TMP/s1-r203a.txt"; fail "R2_03 should name the functions"; }
echo "SEC-01 motive confirmed: R2_03 rejects the ten before the revoke"

# ---- fail-closed gates (each must leave ACLs untouched) -----------------------------------------------------------
expect_fail $S1/S1_01_revoke_public_execute_eaushadhi_rpc.sql 'pinned list not populated' "unpopulated pin list"
expect_fail $S1/S1_02_verify_public_execute_revoked.sql 'pinned list not populated' "S1_02 unpopulated pin list"
expect_fail $S1/S1_99_rollback_restore_public_execute.sql 'pinned list not populated' "S1_99 unpopulated pin list"
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
sed "s#c_accepted_losers constant text\[\] := ARRAY\[$PRE\]::text\[\];#c_accepted_losers constant text[] := ARRAY[${PRE:+$PRE,}'zz_dep']::text[];#" "$TMP/s1-01.sql" > "$TMP/s1-01-acc.sql"
expect_ok "$TMP/s1-01-acc.sql" "owner-accepted loser"
grep -q 'zz_dep(accepted)' "$TMP/s1-ok.txt"
expect_ok "$TMP/s1-99.sql" "rollback after accepted-loser run"
[ "$(acl_snapshot)" = "$ORIG_ACL" ] || fail "rollback did not restore the exact original ACLs"
echo "SEC-01 rollback restored the original ACL entries (order-normalised)"
A "DROP ROLE zz_dep"

# ---- the real change ----------------------------------------------------------------------------------------------
A "CREATE ROLE zz_member LOGIN NOINHERIT"; A "GRANT authenticated TO zz_member"
expect_ok "$TMP/s1-01.sql" "SEC-01 apply"
grep -q 'S1_01 OK: PUBLIC EXECUTE revoked on 10 functions' "$TMP/s1-ok.txt"
grep -q 'retain it by membership/SET ROLE: \[zz_member\]' "$TMP/s1-ok.txt" || { cat "$TMP/s1-ok.txt"; fail "NOINHERIT member should be reported as covered"; }
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
expect_fail "$TMP/s1-99.sql" 'already PUBLIC-executable' "rollback twice"
expect_ok "$TMP/s1-01.sql" "re-apply after rollback"
[ "$(acl_snapshot)" = "$POST_ACL" ] || fail "re-apply ACL differs from first apply"
echo "SEC-01 apply -> rollback -> re-apply is repeatable and ACL-exact"

# ---- cleanup ------------------------------------------------------------------------------------------------------
F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1
cleanup
echo S1_FIXTURE_ACCEPTANCE_PASS
