#!/usr/bin/env bash
# Synthetic fixture acceptance for the Route 2 package. NEVER point at production.
# Env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE (admin on the fixture DB), RUNNER_TEMP.
# Optional R2_ROLE_PORT (defaults to PGPORT). Prints R2_FIXTURE_ACCEPTANCE_PASS on success.
set -euo pipefail
R2="docs/master-data-costing/sql/route2"
TMP="${RUNNER_TEMP:-/tmp}"
PW="fixture-only-$$"
ROLE_DSN="postgresql://sasv_archive_ro:${PW}@${PGHOST}:${R2_ROLE_PORT:-$PGPORT}/${PGDATABASE}?sslmode=disable"
A() { psql -X -q -At -v ON_ERROR_STOP=1 -c "$1"; }
F() { psql -X -q -v ON_ERROR_STOP=1 -f "$1"; }
enable_login() { A "DO \$\$ BEGIN EXECUTE format('ALTER ROLE sasv_archive_ro LOGIN PASSWORD %L VALID UNTIL %L', '$PW', (now() + interval '2 days')::text); END \$\$"; }
fresh_role() { F $R2/R2_01_create_archive_ro_role.sql >/dev/null 2>&1; enable_login; }
must_pass_03() { F $R2/R2_03_verify_archive_ro_permissions.sql >"$TMP/r2-03.txt" 2>&1 || { cat "$TMP/r2-03.txt"; echo "FAIL: R2_03 should pass: $1"; exit 1; }; }
# mutation NAME 'sql that breaks the invariant' 'sql that restores it' 'regex expected in failure'
mutation() {
  local name="$1" bad="$2" good="$3" rx="$4"
  A "$bad" >/dev/null
  if F $R2/R2_03_verify_archive_ro_permissions.sql >"$TMP/r2-mut.txt" 2>&1; then
    A "$good" >/dev/null; echo "FAIL: R2_03 accepted mutation: $name"; exit 1; fi
  grep -Eq "$rx" "$TMP/r2-mut.txt" || { cat "$TMP/r2-mut.txt"; echo "FAIL: wrong failure for: $name"; exit 1; }
  A "$good" >/dev/null
  must_pass_03 "after reverting $name"
  echo "R2 mutation caught: $name"
}

if [ "$(A "SELECT count(*) FROM pg_roles WHERE rolname='sasv_archive_ro'")" != 0 ]; then F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1; fi
A "DROP FUNCTION IF EXISTS costing.zz_sd(); DROP VIEW IF EXISTS costing.zz_v; DROP SEQUENCE IF EXISTS costing.zz_seq; DROP TABLE IF EXISTS costing.zz_extra, costing.zz_drift, public.zz_own"
A "REVOKE EXECUTE ON FUNCTION pg_read_file(text) FROM PUBLIC" 2>/dev/null || true
fresh_role
must_pass_03 baseline
grep -q 'R2_03 PASS: exact effective SELECT set = 65' "$TMP/r2-03.txt"
F $R2/R2_04_control_row_count_run87.sql >"$TMP/r2-04.txt" 2>&1; grep -E 'R2_04 CONTROL' "$TMP/r2-04.txt"
grep -Eq 'across 64 direct relations = [0-9]+' "$TMP/r2-04.txt"

A "CREATE TABLE costing.zz_extra(a int)"
mutation "extra table SELECT"        "GRANT SELECT ON costing.zz_extra TO sasv_archive_ro"  "REVOKE SELECT ON costing.zz_extra FROM sasv_archive_ro" "UNEXPECTED effective SELECT"
mutation "column-level SELECT"       "GRANT SELECT (a) ON costing.zz_extra TO sasv_archive_ro" "REVOKE SELECT (a) ON costing.zz_extra FROM sasv_archive_ro" "UNEXPECTED effective SELECT|column"
mutation "SELECT via PUBLIC"         "GRANT SELECT ON costing.zz_extra TO PUBLIC"           "REVOKE SELECT ON costing.zz_extra FROM PUBLIC"        "UNEXPECTED effective SELECT"
mutation "status view granted"       "GRANT SELECT ON costing.v_costing_period_run_status TO sasv_archive_ro" "REVOKE SELECT ON costing.v_costing_period_run_status FROM sasv_archive_ro" "UNEXPECTED effective SELECT"
A "CREATE VIEW costing.zz_v AS SELECT * FROM costing.s3n_pk_07"
mutation "extra view via PUBLIC"     "GRANT SELECT ON costing.zz_v TO PUBLIC"               "REVOKE SELECT ON costing.zz_v FROM PUBLIC"            "UNEXPECTED effective SELECT"
A "CREATE SEQUENCE costing.zz_seq"
mutation "sequence privilege"        "GRANT USAGE, SELECT ON SEQUENCE costing.zz_seq TO sasv_archive_ro" "REVOKE ALL ON SEQUENCE costing.zz_seq FROM sasv_archive_ro" "UNEXPECTED effective SELECT|write-class"
mutation "missing allowlisted grant" "REVOKE SELECT ON costing.s3n_pk_07 FROM sasv_archive_ro" "GRANT SELECT ON costing.s3n_pk_07 TO sasv_archive_ro" "NOT effectively readable"
mutation "column-only SELECT on allowlisted table" "REVOKE SELECT ON costing.s3n_pk_08 FROM sasv_archive_ro; GRANT SELECT (refresh_run_id) ON costing.s3n_pk_08 TO sasv_archive_ro" "REVOKE SELECT (refresh_run_id) ON costing.s3n_pk_08 FROM sasv_archive_ro; GRANT SELECT ON costing.s3n_pk_08 TO sasv_archive_ro" "column-level only|column"
mutation "INSERT privilege"          "GRANT INSERT ON costing.s3n_pk_07 TO sasv_archive_ro" "REVOKE INSERT ON costing.s3n_pk_07 FROM sasv_archive_ro" "write-class"
mutation "grant option"              "GRANT SELECT ON costing.s3n_pk_09 TO sasv_archive_ro WITH GRANT OPTION" "REVOKE GRANT OPTION FOR SELECT ON costing.s3n_pk_09 FROM sasv_archive_ro" "outside SELECT-on-allowlist"
mutation "CREATE on database"        "GRANT CREATE ON DATABASE $PGDATABASE TO sasv_archive_ro" "REVOKE CREATE ON DATABASE $PGDATABASE FROM sasv_archive_ro" "CREATE|direct database"
mutation "TEMPORARY granted directly" "GRANT TEMPORARY ON DATABASE $PGDATABASE TO sasv_archive_ro" "REVOKE TEMPORARY ON DATABASE $PGDATABASE FROM sasv_archive_ro" "TEMPORARY granted directly|direct database"
mutation "CREATE on schema public"   "GRANT CREATE ON SCHEMA public TO sasv_archive_ro" "REVOKE CREATE ON SCHEMA public FROM sasv_archive_ro" "CREATE|direct schema grants"
mutation "USAGE on another schema"   "GRANT USAGE ON SCHEMA public TO sasv_archive_ro" "REVOKE USAGE ON SCHEMA public FROM sasv_archive_ro" "direct schema grants"
A "CREATE FUNCTION costing.zz_sd() RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'"
mutation "SECURITY DEFINER function via PUBLIC" "SELECT 1" "DROP FUNCTION costing.zz_sd()" "SECURITY DEFINER functions reachable"
mutation "dangerous file function"   "GRANT EXECUTE ON FUNCTION pg_read_file(text) TO PUBLIC" "REVOKE EXECUTE ON FUNCTION pg_read_file(text) FROM PUBLIC" "dangerous server/file functions"
A "CREATE ROLE zz_member NOLOGIN"
mutation "role membership"           "GRANT zz_member TO sasv_archive_ro" "REVOKE zz_member FROM sasv_archive_ro" "member of another role"
A "DROP ROLE zz_member"
mutation "INHERIT enabled"           "ALTER ROLE sasv_archive_ro INHERIT" "ALTER ROLE sasv_archive_ro NOINHERIT" "attributes too broad"
mutation "CREATEDB attribute"        "ALTER ROLE sasv_archive_ro CREATEDB" "ALTER ROLE sasv_archive_ro NOCREATEDB" "attributes too broad"
mutation "no expiry"                 "ALTER ROLE sasv_archive_ro VALID UNTIL 'infinity'" "ALTER ROLE sasv_archive_ro VALID UNTIL '$(date -u -d '+2 days' '+%Y-%m-%d %H:%M:%S+00' 2>/dev/null || date -u '+%Y-%m-%d %H:%M:%S+00')'" "not time-limited"
mutation "validity longer than 3 days" "ALTER ROLE sasv_archive_ro VALID UNTIL '$(date -u -d '+6 days' '+%Y-%m-%d %H:%M:%S+00')'" "ALTER ROLE sasv_archive_ro VALID UNTIL '$(date -u -d '+2 days' '+%Y-%m-%d %H:%M:%S+00')'" "not time-limited"
mutation "read-only default removed" "ALTER ROLE sasv_archive_ro RESET default_transaction_read_only" "ALTER ROLE sasv_archive_ro SET default_transaction_read_only = on" "default_transaction_read_only"
A "CREATE TABLE public.zz_own(a int)"
mutation "role owns an object"       "ALTER TABLE public.zz_own OWNER TO sasv_archive_ro" "ALTER TABLE public.zz_own OWNER TO $PGUSER" "owns 1 objects"
A "DROP TABLE public.zz_own"
mutation "RLS policy names the role" "CREATE POLICY zz_pol ON costing.s3n_pk_10 TO sasv_archive_ro USING (true)" "DROP POLICY zz_pol ON costing.s3n_pk_10" "policy|dependencies other than privileges"
mutation "default ACL names the role" "ALTER DEFAULT PRIVILEGES IN SCHEMA costing GRANT SELECT ON TABLES TO sasv_archive_ro" "ALTER DEFAULT PRIVILEGES IN SCHEMA costing REVOKE SELECT ON TABLES FROM sasv_archive_ro" "default ACL|dependencies other than privileges"
A "DROP SEQUENCE costing.zz_seq; DROP VIEW costing.zz_v; DROP TABLE costing.zz_extra"
must_pass_03 "clean state"


# --- SECURITY DEFINER exception list: exact, md5-pinned, both directions -------------------------------
A "CREATE FUNCTION public.zz_rpc_save(a int) RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT a'"
F $R2/R2_03_verify_archive_ro_permissions.sql >"$TMP/r2-sd.txt" 2>&1 && { echo "FAIL: unlisted definer accepted"; exit 1; }
grep -q "NOT in the owner exception list" "$TMP/r2-sd.txt"
grep -q "REACHABLE SECURITY DEFINER: public.zz_rpc_save(a integer)" "$TMP/r2-sd.txt"
grep -q "body guard=none found" "$TMP/r2-sd.txt"
ENTRY="$(grep -o "entry: 'public.zz_rpc_save(a integer)|[0-9a-f]*'" "$TMP/r2-sd.txt" | head -1 | sed "s/^entry: //")"
test -n "$ENTRY"
with_list() { sed "s#c_accepted_definers constant text\[\] := ARRAY\[\]::text\[\];#c_accepted_definers constant text[] := ARRAY[$1]::text[];#" $R2/R2_03_verify_archive_ro_permissions.sql > "$TMP/r2-03-accept.sql"; }
with_list "$ENTRY"
F "$TMP/r2-03-accept.sql" >"$TMP/r2-sd2.txt" 2>&1 || { cat "$TMP/r2-sd2.txt"; echo "FAIL: exactly listed definer rejected"; exit 1; }
echo "R2 exception list: exact entry accepted"
A "CREATE OR REPLACE FUNCTION public.zz_rpc_save(a int) RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT a + 1'"
F "$TMP/r2-03-accept.sql" >"$TMP/r2-sd3.txt" 2>&1 && { echo "FAIL: changed definer body still accepted"; exit 1; }
grep -q "NOT in the owner exception list" "$TMP/r2-sd3.txt"
echo "R2 exception list: changed function body rejected"
A "DROP FUNCTION public.zz_rpc_save(int)"
F "$TMP/r2-03-accept.sql" >"$TMP/r2-sd4.txt" 2>&1 && { echo "FAIL: stale exception entry accepted"; exit 1; }
grep -q "stale/changed entries" "$TMP/r2-sd4.txt"
echo "R2 exception list: stale entry rejected"
A "CREATE FUNCTION public.zz_jwt(a int) RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT a /* auth.uid() */'"
F $R2/R2_03_verify_archive_ro_permissions.sql >"$TMP/r2-sd5.txt" 2>&1 || true
grep -q "JWT-claim ONLY" "$TMP/r2-sd5.txt"
A "DROP FUNCTION public.zz_jwt(int)"
must_pass_03 "definer fixtures removed"

# --- PostgreSQL 17 timeout semantics R2_04 relies on ------------------------------------------------------------
if psql -X -q -d "$PGDATABASE" -c "BEGIN READ ONLY; SET LOCAL statement_timeout='300ms'; DO \$\$ BEGIN PERFORM pg_sleep(1.5); END \$\$; COMMIT;" >"$TMP/r2-to.txt" 2>&1; then echo "FAIL: SET LOCAL statement_timeout did not cap the DO"; exit 1; fi
grep -q "statement timeout" "$TMP/r2-to.txt"
grep -q "SET LOCAL statement_timeout = '120s'" $R2/R2_04_control_row_count_run87.sql
if psql -X -q -d "$PGDATABASE" -c "DO \$\$ BEGIN PERFORM set_config('statement_timeout','300ms',true); PERFORM pg_sleep(1.2); END \$\$" >/dev/null 2>&1; then
  echo "R2 timeout: confirmed mid-DO set_config(statement_timeout) does NOT cap the DO; SET LOCAL before the DO does (R2_04 hard 120 s budget)"
else
  echo "NOTE: mid-DO set_config(statement_timeout) now takes effect on this server; R2_04 design still valid"
fi

# --- R2_05 administrator eligibility gate -----------------------------------------------------------------------
F $R2/R2_05_admin_eligibility_run87.sql >"$TMP/r2-05.txt" 2>&1 || { cat "$TMP/r2-05.txt"; echo "FAIL: R2_05 should pass"; exit 1; }
REF="$(grep -o 'R2E-[0-9]\{14\}-[0-9a-f]\{8\}' "$TMP/r2-05.txt" | head -1)"; test -n "$REF"
grep -q 'run 143 approved rows in status view = 1' "$TMP/r2-05.txt"
gate_fail() { # NAME bad good regex
  A "$2" >/dev/null
  if F $R2/R2_05_admin_eligibility_run87.sql >"$TMP/r2-05b.txt" 2>&1; then A "$3" >/dev/null; echo "FAIL: R2_05 accepted: $1"; exit 1; fi
  grep -q "$4" "$TMP/r2-05b.txt" || { cat "$TMP/r2-05b.txt"; echo "FAIL: wrong R2_05 failure for $1"; exit 1; }
  if grep -q 'R2E-' "$TMP/r2-05b.txt"; then echo "FAIL: token printed on failure"; exit 1; fi
  A "$3" >/dev/null; echo "R2_05 gate caught: $1"
}
VIEWDEF="$(A "SELECT pg_get_viewdef('costing.v_costing_period_run_status'::regclass)")"
gate_fail "run 87 displayed" "CREATE OR REPLACE VIEW costing.v_costing_period_run_status AS SELECT period_start, displayed_run_id, approved_run_id FROM (VALUES ('2026-09-01'::date,87::bigint,NULL::bigint),('2026-10-01'::date,143::bigint,143::bigint)) x(period_start,displayed_run_id,approved_run_id)" "CREATE OR REPLACE VIEW costing.v_costing_period_run_status AS $VIEWDEF" "displayed or approved"
gate_fail "run 87 status drift" "UPDATE costing.costing_refresh_run SET overall_status='FAILED' WHERE id=87" "UPDATE costing.costing_refresh_run SET overall_status='SUCCESS' WHERE id=87" "identity drift"
gate_fail "run 87 designated" "INSERT INTO costing.costing_run_designation(refresh_run_id,designation) VALUES (87,'zz_test')" "DELETE FROM costing.costing_run_designation WHERE refresh_run_id=87" "is designated"
must_pass_03 "after eligibility mutations (grants unchanged)"

# --- Archive AS the least-privilege role: refused without the R2_05 token, allowed with it ----------------------
export SASV_ARCHIVE_DATABASE_URL="$ROLE_DSN"
rm -rf "$TMP"/role-archive-*
if node docs/master-data-costing/tools/archive-run87-direct-fks.mjs --run-id 87 --out "$TMP/role-archive-a" --expected-relations 64 >"$TMP/r2-ra.txt" 2>&1; then echo "FAIL: role archived without R2_05 token"; exit 1; fi
grep -q 'run R2_05 as administrator' "$TMP/r2-ra.txt"; test ! -e "$TMP/role-archive-a"
if node docs/master-data-costing/tools/archive-run87-direct-fks.mjs --run-id 87 --out "$TMP/role-archive-b" --expected-relations 64 --admin-eligibility-ref R2E-bogus >"$TMP/r2-rb.txt" 2>&1; then echo "FAIL: bogus token accepted"; exit 1; fi
node docs/master-data-costing/tools/archive-run87-direct-fks.mjs --run-id 87 --out "$TMP/role-archive-c" --expected-relations 64 --admin-eligibility-ref "$REF" > "$TMP/r2-rc.txt"
grep -q '"rows":217964' "$TMP/r2-rc.txt"
node docs/master-data-costing/tools/verify-run87-direct-fks.mjs "$TMP/role-archive-c" | grep -q '"verifiedRows":217964'
grep -q "\"reference\": \"$REF\"" "$TMP/role-archive-c/manifest.json"
unset SASV_ARCHIVE_DATABASE_URL
echo "R2 role archive: refused without/with bogus token; 217,964 rows with the R2_05 token recorded in the manifest"

# Positive + negative access AS the role.
R2_ROLE_DSN="$ROLE_DSN" node $R2/R2_FIXTURE_ROLE_NEGATIVE.mjs | tee "$TMP/r2-neg.txt" | grep -E 'FAIL|R2_ROLE_NEGATIVE'
grep -q R2_ROLE_NEGATIVE_PASS "$TMP/r2-neg.txt"
must_pass_03 "after the role attempted to self-grant"

# R2_01 fail-closed cases.
if F $R2/R2_01_create_archive_ro_role.sql >/dev/null 2>&1; then echo "FAIL: duplicate R2_01 allowed"; exit 1; fi
A "DROP ROLE sasv_archive_ro" 2>/dev/null || F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1
A "CREATE TABLE costing.zz_drift(run_id bigint REFERENCES costing.costing_refresh_run(id))"
if F $R2/R2_01_create_archive_ro_role.sql >"$TMP/r2-drift.txt" 2>&1; then echo "FAIL: R2_01 accepted FK drift"; exit 1; fi
grep -q 'inventory drift: 65 vs expected 64' "$TMP/r2-drift.txt"
A "DROP TABLE costing.zz_drift"
test "$(A "SELECT count(*) FROM pg_roles WHERE rolname='sasv_archive_ro'")" = 0
echo "R2 fail-closed: duplicate create and FK drift refused, nothing created"

# RLS on granted tables: BYPASSRLS is added only then, and the audit still passes with the exact set.
A "ALTER TABLE costing.s3n_pk_07 ENABLE ROW LEVEL SECURITY"
fresh_role
test "$(A "SELECT rolbypassrls FROM pg_roles WHERE rolname='sasv_archive_ro'")" = t
must_pass_03 "RLS granted set with BYPASSRLS"
F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1
A "ALTER TABLE costing.s3n_pk_07 DISABLE ROW LEVEL SECURITY"
fresh_role
test "$(A "SELECT rolbypassrls FROM pg_roles WHERE rolname='sasv_archive_ro'")" = f
F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >/dev/null 2>&1
echo "R2 BYPASSRLS granted only when a granted relation has RLS"

# R2_99: refuse on policy dependency, then drop with a LIVE session attached.
fresh_role
A "CREATE POLICY zz_pol ON costing.s3n_pk_10 TO sasv_archive_ro USING (true)"
if F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >"$TMP/r2-99a.txt" 2>&1; then echo "FAIL: R2_99 ignored policy"; exit 1; fi
grep -Eq 'R2D HOLD' "$TMP/r2-99a.txt"
A "DROP POLICY zz_pol ON costing.s3n_pk_10"
enable_login   # re-enable (R2_99 statement A may have rolled back or applied NOLOGIN)
cat > "$TMP/r2-hold.mjs" <<'JS'
import { createRequire } from 'node:module';
const require = createRequire(process.env.R2_REQUIRE_FROM);
const pg = require('pg');
const c = new pg.Client({ connectionString: process.env.R2_ROLE_DSN });
await c.connect(); await c.query('SELECT 1'); console.log('SESSION_UP');
c.on('error', () => process.exit(0));
setTimeout(() => process.exit(0), 60000);
JS
R2_REQUIRE_FROM="$(pwd)/package.json" R2_ROLE_DSN="$ROLE_DSN" node "$TMP/r2-hold.mjs" > "$TMP/r2-hold.out" 2>&1 &
HOLD_PID=$!
for i in $(seq 1 20); do grep -q SESSION_UP "$TMP/r2-hold.out" && break; sleep 0.5; done
grep -q SESSION_UP "$TMP/r2-hold.out"
test "$(A "SELECT count(*) FROM pg_stat_activity WHERE usename='sasv_archive_ro'")" -ge 1
F $R2/R2_99_revoke_and_drop_archive_ro_role.sql >"$TMP/r2-99b.txt" 2>&1 || { cat "$TMP/r2-99b.txt"; echo 'FAIL: R2_99 with live session'; exit 1; }
grep -q 'R2_99 OK' "$TMP/r2-99b.txt"
test "$(A "SELECT count(*) FROM pg_roles WHERE rolname='sasv_archive_ro'")" = 0
wait $HOLD_PID 2>/dev/null || true
echo "R2_99 dropped the role with an active session; policy dependency refused"
echo R2_FIXTURE_ACCEPTANCE_PASS
