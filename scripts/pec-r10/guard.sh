#!/usr/bin/env bash
# PEC fixture isolation guard (F1, safeguards H1-H5). SOURCE this file; never execute it.
#
#   . "$(dirname "$0")/guard.sh"
#   pec_guard_preflight <source>   # refuses (exit 3) unless the target is a local throw-away server
#   pec_create_db                  # creates a NEW uniquely named database and registers cleanup
#
# H1  connection target must be local (127.0.0.1 / localhost / ::1 / unix socket); no service files,
#     no DATABASE_URL-style indirection
# H2  PEC_FIXTURE_ONLY=1 must be set explicitly
# H3  database name is pec_r10_<source>_<run-id>, generated per run; an existing database is never
#     reused or dropped; the source label is validated against a fixed list (no injection)
# H4  refuse if the server hosts any non-fixture database, or if the maintenance database already
#     carries a supabase_migrations schema or PEC tables
# H5  EXIT/INT/TERM trap terminates the run's own backends and drops ONLY the database this process
#     created (verified absent afterwards)
#
# Every check sits on its own line tagged "# H<n>" so scripts/pec-r10/guard-mutation-test.sh can
# delete it and prove the test-suite notices (mutation sensitivity).
# No Supabase credential or production host is ever read or required.

pec_refuse() { echo "REFUSED: $1" >&2; exit 3; }

pec_admin_psql() { psql -X -q -At -v ON_ERROR_STOP=1 -d postgres "$@"; }

pec_h1_local_target() {
  case "${PGHOST:-}" in "" | 127.0.0.1 | localhost | ::1 | /*) : ;; *) pec_refuse "H1: PGHOST '${PGHOST}' is not a local server" ;; esac
  [ -z "${PGSERVICE:-}${DATABASE_URL:-}${SUPABASE_DB_URL:-}${PGHOSTADDR:-}" ] || pec_refuse "H1: connection indirection (PGSERVICE/DATABASE_URL/PGHOSTADDR) is not allowed"
}
pec_h2_explicit_opt_in() {
  [ "${PEC_FIXTURE_ONLY:-}" = 1 ] || pec_refuse "H2: set PEC_FIXTURE_ONLY=1 to confirm this is a disposable fixture server"
}
pec_h3_source_label() {
  case "${1:-}" in guarded | legacy | r9proto | matrix | roles | risk) : ;; *) pec_refuse "H3: unknown fixture source '${1:-}'" ;; esac
}
pec_h3_unique_unused_name() {
  PEC_RUN_ID=$(printf '%s' "${GITHUB_RUN_ID:-local}_$$_$(date +%s)" | tr -c 'a-z0-9_' '_')
  PEC_DB="pec_r10_${PEC_SRC}_${PEC_RUN_ID}"
  printf '%s' "$PEC_DB" | grep -Eq '^pec_r10_[a-z0-9_]{1,40}$' || pec_refuse "H3: generated database name '$PEC_DB' is invalid"
  local taken
  taken=$(pec_admin_psql -c "select 1 from pg_database where datname='$PEC_DB'") || pec_refuse "H3: cannot inspect server"
  [ -z "$taken" ] || pec_refuse "H3: database '$PEC_DB' already exists; never reused or dropped"
}
pec_h4_server_is_fixture_only() {
  local dbs d n
  dbs=$(pec_admin_psql -c "select datname from pg_database order by 1") || pec_refuse "H4: cannot inspect server"
  while IFS= read -r d; do
    [ -z "$d" ] && continue
    case "$d" in postgres | template0 | template1 | pec_r10_*) : ;; *) pec_refuse "H4: server hosts non-fixture database '$d'" ;; esac
  done <<EOF
$dbs
EOF
  n=$(pec_admin_psql -c "select count(*) from information_schema.schemata where schema_name='supabase_migrations'") || pec_refuse "H4: cannot inspect maintenance database"
  [ "$n" = 0 ] || pec_refuse "H4: maintenance database has a supabase_migrations schema (looks like a Supabase project)"
  n=$(pec_admin_psql -c "select count(*) from (select to_regclass('public.proc_indent_header') r union all select to_regclass('public.proc_pr_header')) t where r is not null") || pec_refuse "H4: cannot inspect maintenance database"
  [ "$n" = 0 ] || pec_refuse "H4: maintenance database already contains PEC tables"
}

pec_cleanup() {
  local rc=$?
  trap - EXIT INT TERM HUP
  jobs -p 2>/dev/null | while read -r p; do kill "$p" 2>/dev/null; done
  if [ "${PEC_CREATED:-0}" = 1 ]; then
    printf '%s' "$PEC_DB" | grep -Eq '^pec_r10_[a-z0-9_]{1,40}$' || { echo "REFUSED: cleanup of invalid name" >&2; exit 3; }
    pec_admin_psql -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='$PEC_DB' and pid<>pg_backend_pid()" >/dev/null 2>&1
    dropdb --if-exists "$PEC_DB" >/dev/null 2>&1
    [ -z "$(pec_admin_psql -c "select 1 from pg_database where datname='$PEC_DB'" 2>/dev/null)" ] || { echo "WARNING: fixture database $PEC_DB still exists" >&2; rc=1; }
  fi
  exit $rc
}

pec_guard_preflight() {
  PEC_SRC=${1:-}
  pec_h3_source_label "$PEC_SRC"   # H3
  pec_h2_explicit_opt_in   # H2
  pec_h1_local_target   # H1
  pec_h4_server_is_fixture_only   # H4
  pec_h3_unique_unused_name   # H3
}

pec_create_db() {
  trap pec_cleanup EXIT INT TERM HUP   # H5
  createdb "$PEC_DB" || pec_refuse "H3: could not create database '$PEC_DB'"
  PEC_CREATED=1
  export PEC_DB
}
