#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../.."
fixture=supabase/tests/mis_g7/debtor_kyc
scratch=$(mktemp -d)
container="sasv-debtor-kyc-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT

shopt -s nullglob
migrations=(supabase/migrations/*_ei_r8_debtor_kyc_canonical.sql)
[[ ${#migrations[@]} -eq 1 ]]
docker run -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.4 >/dev/null
for ((attempt=0; attempt<80; attempt++)); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep .25
done
pg() { docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
pg -Atqc 'select version()'
pg -q -f - < "$fixture/baseline.sql"
pg -q -f - < supabase/migrations/20261127144051_ei_r8_finance_ageing.sql
pg -q -f - < "$fixture/capture.sql"
pg -q -1 -f - < "${migrations[0]}"
if ! pg -q -f - < "$fixture/regression.sql" >"$scratch/assertions.log" 2>&1; then
  cat "$scratch/assertions.log"
  exit 1
fi
grep -E 'NOTICE:  PASS |^Time:' "$scratch/assertions.log"

wait_for_wait_event() {
  local application=$1 event=$2
  for ((attempt=0; attempt<50; attempt++)); do
    if [[ $(pg -Atqc "select exists(select 1 from pg_stat_activity where application_name='$application' and wait_event='$event')") == t ]]; then
      return
    fi
    sleep .025
  done
  echo "FAIL session $application never waited on $event" >&2
  return 1
}

# Observe both the first session holding its transaction and the contender
# waiting in PostgreSQL. The latter must fail using the original revision.
concurrent_writes() {
  local label=$1 actor=$2 first=$3 second=$4 sqlstate=$5 primary challenger
  pg -q -f - >"$scratch/primary.log" 2>&1 <<SQL &
set application_name='kyc-primary';
select fixture.claim($actor);
set role authenticated;
begin;
$first
select pg_sleep(2);
commit;
SQL
  primary=$!
  wait_for_wait_event kyc-primary PgSleep
  pg -q -f - >"$scratch/challenger.log" 2>&1 <<SQL &
\set VERBOSITY verbose
set application_name='kyc-challenger';
select fixture.claim($actor);
set role authenticated;
$second
SQL
  challenger=$!
  wait_for_wait_event kyc-challenger "$6"
  if ! wait "$primary"; then cat "$scratch/primary.log"; return 1; fi
  if wait "$challenger" || ! grep -q "ERROR:  $sqlstate:" "$scratch/challenger.log"; then
    cat "$scratch/challenger.log"
    return 1
  fi
  echo "PASS $label ($sqlstate)"
}

alpha=$(pg -Atqc "select id from public.ei_debtor where ledger_name='Alpha'")
bravo=$(pg -Atqc "select id from public.ei_debtor where ledger_name='Bravo'")
area=$(pg -Atqc "select id from public.ei_debtor_area where area_name='Test IK'")
concurrent_writes 'two-session override writer waits on matching scope and rejects stale revision' 4 \
  "select public.ei_debtor_terms_set($alpha,null,null,3,3,null,'2026-11-26','winner');" \
  "select public.ei_debtor_terms_set($alpha,null,null,3,4,null,'2026-11-27','stale');" 40001 advisory
concurrent_writes 'two-session alias write waits on normalized key and rejects collision' 1 \
  "select public.ei_debtor_alias_set($alpha,'Unregistered',true,2,'winner');" \
  "select public.ei_debtor_alias_set($bravo,' UNREGISTERED ',true,2,'collision');" 23505 advisory
concurrent_writes 'two-session area edit waits on row and rejects stale revision' 1 \
  "select public.ei_debtor_master_set('area',$area,null,3,'{\"area_name\":\"Test IK renamed\"}','winner');" \
  "select public.ei_debtor_master_set('area',$area,null,3,'{\"is_active\":false}','stale');" 40001 transactionid
printf 'Assertions passed %s, failed 0\n' "$(( $(grep -c 'NOTICE:  PASS ' "$scratch/assertions.log") + 3 ))"
