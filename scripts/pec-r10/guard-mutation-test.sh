#!/usr/bin/env bash
# Tests the F1 isolation guard (H1-H5) with stub psql/createdb/dropdb (no database needed), then
# MUTATION-tests it: every guard line tagged "# H<n>" is deleted in turn and the suite must FAIL
# for each mutant (a surviving mutant means a safeguard is not actually tested).
#   guard-mutation-test.sh            -> baseline suite + all mutants (CI mode, exit 0 only if all pass/killed)
#   guard-mutation-test.sh --suite G  -> run the suite against guard file G only
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
STUBS=$(mktemp -d); trap 'rm -rf "$STUBS"' EXIT
cat > "$STUBS/psql" <<'EOS'
#!/usr/bin/env bash
echo "psql $*" >> "$STUB_LOG"
q=""; while [ $# -gt 0 ]; do [ "$1" = "-c" ] && q=$2; shift; done
case "$q" in
  *"select datname from pg_database"*) for d in ${STUB_DBS:-postgres template0 template1}; do echo "$d"; done ;;
  *"from pg_database where datname="*) [ "${STUB_COLLIDE:-0}" = 1 ] && echo 1 ;;
  *schemata*) echo "${STUB_SUPA:-0}" ;;
  *to_regclass*) echo "${STUB_TABLES:-0}" ;;
  *pg_terminate_backend*) echo "terminate" >> "$STUB_LOG" ;;
esac
exit 0
EOS
cat > "$STUBS/createdb" <<'EOS'
#!/usr/bin/env bash
echo "createdb $*" >> "$STUB_LOG"
[ "${STUB_CREATE_FAIL:-0}" = 1 ] && exit 1
exit 0
EOS
cat > "$STUBS/dropdb" <<'EOS'
#!/usr/bin/env bash
echo "dropdb $*" >> "$STUB_LOG"
exit 0
EOS
chmod +x "$STUBS/psql" "$STUBS/createdb" "$STUBS/dropdb"

run_suite() { # $1 = guard file; prints CASE lines; returns number of failed cases
  local G=$1 fails=0 LOG="$STUBS/log"
  drive() { # drive <post-command> <VAR=val>...  -> sets RC and leaves $LOG
    local post=$1; shift
    : > "$LOG"
    env -i PATH="$STUBS:$PATH" HOME="${HOME:-/tmp}" STUB_LOG="$LOG" G="$G" SRC="${SRC:-guarded}" POST="$post" "$@" \
      "$BASH" -c 'set +e; . "$G"; pec_guard_preflight "$SRC"; pec_create_db; eval "$POST"' >/dev/null 2>"$STUBS/err"
    RC=$?
  }
  created() { grep -c '^createdb ' "$LOG"; }
  dropped() { grep -c '^dropdb ' "$LOG"; }
  expect_refused() { # name, VAR=val...
    local name=$1; shift; drive ":" "$@"
    if [ "$RC" = 3 ] && [ "$(created)" = 0 ] && [ "$(dropped)" = 0 ]; then echo "CASE $name PASS (refused, nothing created or dropped)"
    else echo "CASE $name FAIL rc=$RC created=$(created) dropped=$(dropped)"; fails=$((fails+1)); fi
  }
  OK_ENV=(PEC_FIXTURE_ONLY=1 PGHOST=127.0.0.1)
  # H1: connection target
  expect_refused H1-supabase-host PEC_FIXTURE_ONLY=1 PGHOST=db.abcdefghij.supabase.co
  expect_refused H1-pooler-host PEC_FIXTURE_ONLY=1 PGHOST=aws-0-ap-south-1.pooler.supabase.com
  expect_refused H1-private-ip PEC_FIXTURE_ONLY=1 PGHOST=10.0.0.5
  expect_refused H1-lookalike-host PEC_FIXTURE_ONLY=1 PGHOST=localhost.evil.example
  expect_refused H1-other-loopback PEC_FIXTURE_ONLY=1 PGHOST=127.0.0.2
  expect_refused H1-service-file PEC_FIXTURE_ONLY=1 PGHOST=127.0.0.1 PGSERVICE=prod
  expect_refused H1-database-url PEC_FIXTURE_ONLY=1 PGHOST=127.0.0.1 DATABASE_URL=postgresql://x@db.example.com/postgres
  expect_refused H1-hostaddr PEC_FIXTURE_ONLY=1 PGHOST=127.0.0.1 PGHOSTADDR=203.0.113.9
  # H2: explicit opt-in
  expect_refused H2-no-flag PGHOST=127.0.0.1
  expect_refused H2-wrong-flag PEC_FIXTURE_ONLY=yes PGHOST=127.0.0.1
  # H3: label validation and never reusing a database
  SRC='guarded;drop database postgres' expect_refused H3-injection "${OK_ENV[@]}"
  SRC='GUARDED' expect_refused H3-unknown-source "${OK_ENV[@]}"
  SRC='production' expect_refused H3-unknown-lowercase-source "${OK_ENV[@]}"   # valid name shape, only the label list rejects it
  expect_refused H3-existing-database "${OK_ENV[@]}" STUB_COLLIDE=1
  # H4: server must be fixture-only
  expect_refused H4-foreign-database "${OK_ENV[@]}" "STUB_DBS=postgres template0 template1 prod_main"
  expect_refused H4-supabase-schema "${OK_ENV[@]}" STUB_SUPA=1
  expect_refused H4-pec-tables "${OK_ENV[@]}" STUB_TABLES=1
  # creation failure must never trigger a drop (nothing was created by this run)
  drive ":" "${OK_ENV[@]}" STUB_CREATE_FAIL=1
  if [ "$RC" != 0 ] && [ "$(dropped)" = 0 ]; then echo "CASE H3-create-failure-no-drop PASS"; else echo "CASE H3-create-failure-no-drop FAIL rc=$RC dropped=$(dropped)"; fails=$((fails+1)); fi
  # positive control: valid environment creates exactly one unique db and drops exactly that one
  drive ":" "${OK_ENV[@]}"
  local cn dn
  cn=$(grep '^createdb ' "$LOG" | awk '{print $2}'); dn=$(grep '^dropdb ' "$LOG" | awk '{print $NF}')
  if [ "$RC" = 0 ] && [ "$(created)" = 1 ] && [ "$(dropped)" = 1 ] && printf '%s' "$cn" | grep -Eq '^pec_r10_guarded_[a-z0-9_]+$' && [ "$cn" = "$dn" ] && grep -q '^terminate' "$LOG"; then
    echo "CASE POSITIVE-create-and-cleanup PASS ($cn created then dropped, backends terminated)"
  else echo "CASE POSITIVE-create-and-cleanup FAIL rc=$RC cn=$cn dn=$dn"; fails=$((fails+1)); fi
  # H5: cleanup runs on failure and on signal, and only for the db this run created
  drive "false; exit 7" "${OK_ENV[@]}"
  cn=$(grep '^createdb ' "$LOG" | awk '{print $2}'); dn=$(grep '^dropdb ' "$LOG" | awk '{print $NF}')
  if [ "$RC" = 7 ] && [ "$(dropped)" = 1 ] && [ "$cn" = "$dn" ]; then echo "CASE H5-cleanup-on-failure PASS"; else echo "CASE H5-cleanup-on-failure FAIL rc=$RC created=$cn dropped=$dn"; fails=$((fails+1)); fi
  drive 'kill -TERM $$; sleep 1' "${OK_ENV[@]}"
  cn=$(grep '^createdb ' "$LOG" | awk '{print $2}'); dn=$(grep '^dropdb ' "$LOG" | awk '{print $NF}')
  if [ "$(dropped)" = 1 ] && [ "$cn" = "$dn" ]; then echo "CASE H5-cleanup-on-signal PASS"; else echo "CASE H5-cleanup-on-signal FAIL dropped=$(dropped) created=$cn dropped_name=$dn"; fails=$((fails+1)); fi
  return $fails
}

if [ "${1:-}" = "--suite" ]; then run_suite "$2"; exit $?; fi

echo "== baseline: guard.sh must pass every case =="
run_suite "$HERE/guard.sh"; base=$?
[ $base = 0 ] || { echo "BASELINE FAILED ($base cases)"; exit 1; }
echo "== mutation: neutralise each tagged guard line (replace by a no-op); the suite must fail for every mutant =="
survivors=0; n=0
while IFS=: read -r ln rest; do
  tag=$(printf '%s' "$rest" | sed -E 's/.*# (H[0-9]+)$/\1/')
  M="$STUBS/guard.mutant.$ln.sh"; sed "${ln}s/.*/  :/" "$HERE/guard.sh" > "$M"
  n=$((n+1))
  out=$(run_suite "$M" 2>&1); mrc=$?
  if [ $mrc -gt 0 ]; then echo "MUTANT line $ln ($tag) KILLED ($mrc failing cases)"; else echo "MUTANT line $ln ($tag) SURVIVED"; survivors=$((survivors+1)); fi
done < <(grep -nE '# H[0-9]+$' "$HERE/guard.sh")
# inner mutants: the individual refusal conditions inside each check function
while IFS=: read -r ln rest; do
  M="$STUBS/guard.inner.$ln.sh"; sed "${ln}s/.*/  :/" "$HERE/guard.sh" > "$M"
  n=$((n+1))
  out=$(run_suite "$M" 2>&1); mrc=$?
  if [ $mrc -gt 0 ]; then echo "MUTANT inner line $ln KILLED ($mrc failing cases)"; else echo "MUTANT inner line $ln SURVIVED"; survivors=$((survivors+1)); fi
done < <(grep -nE 'pec_refuse "H(1: PGHOST|1: connection indirection|2: set|3: database .* already exists|4: server hosts|4: maintenance database has|4: maintenance database already)' "$HERE/guard.sh" | grep -v '^[0-9]*:pec_refuse()')
echo "MUTATION_SUMMARY mutants=$n survivors=$survivors"
[ $survivors = 0 ] && echo "PEC_GUARD_MUTATION_PASS" || { echo "SURVIVING MUTANTS"; exit 1; }
