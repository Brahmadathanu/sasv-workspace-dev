#!/usr/bin/env bash
set -uo pipefail
Q="psql -X -q -t -A -v ON_ERROR_STOP=1"
fail() { echo "FAIL: $*"; exit 1; }
# 1. deferred link constraint: with BOTH capture triggers disabled (privileged tamper) the write must not commit.
before="$($Q -c "SELECT count(*) FROM costing.governance_evidence_event")"
out="$($Q 2>&1 <<'SQL'
BEGIN;
ALTER TABLE costing.regional_marketing_evidence_acceptance DISABLE TRIGGER a_governance_evidence_prepare;
ALTER TABLE costing.regional_marketing_evidence_acceptance DISABLE TRIGGER z_governance_evidence_record;
UPDATE costing.regional_marketing_evidence_acceptance SET acceptance_note='silent tamper' WHERE sku_id=2;
COMMIT;
SQL
)"
echo "$out" | grep -qiE "GOVERNANCE_EVIDENCE_LINK|permanent_evidence_fk" || fail "tamper with disabled triggers committed or wrong error: $out"
[ "$($Q -c "SELECT acceptance_note IS DISTINCT FROM 'silent tamper' FROM costing.regional_marketing_evidence_acceptance WHERE sku_id=2")" = t ] || fail "tamper persisted"
[ "$($Q -c "SELECT count(*) FROM costing.governance_evidence_event")" = "$before" ] || fail "event count changed"
[ "$($Q -c "SELECT count(*) FROM pg_trigger WHERE tgrelid='costing.regional_marketing_evidence_acceptance'::regclass AND NOT tgenabled='O' AND NOT tgisinternal")" = 0 ] || fail "trigger left disabled"
echo "PASS deferred-link-commit-check"
# 2. immediate mode: SET CONSTRAINTS IMMEDIATE surfaces the same defect statement-by-statement
out="$($Q 2>&1 <<'SQL'
BEGIN;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance DISABLE TRIGGER a_governance_evidence_prepare;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance DISABLE TRIGGER z_governance_evidence_record;
SET CONSTRAINTS ALL IMMEDIATE;
UPDATE costing.sales_allocation_quantity_driver_acceptance SET acceptance_note='tamper2' WHERE sku_id=1;
COMMIT;
SQL
)"
echo "$out" | grep -qiE "GOVERNANCE_EVIDENCE_LINK|permanent_evidence_fk" || fail "immediate mode did not reject: $out"
echo "PASS immediate-constraint-mode"
# 3. concurrency: new key raced by two sessions (one INSERT + one conflict UPDATE), then same-row concurrent updates
$Q -c "SELECT t.mk_sales(150,4)" >/dev/null
$Q -c "SELECT t.mark('conc')" >/dev/null
call() { # $1 = sleep seconds inside txn
 $Q <<SQL
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
BEGIN;
SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(150,4,'concurrent $2') ;
SELECT pg_sleep($1);
COMMIT;
SQL
}
call 2 A >/tmp/conc_a.log 2>&1 &
pa=$!; sleep 0.7
call 0 B >/tmp/conc_b.log 2>&1 &
pb=$!
wait $pa || fail "session A: $(cat /tmp/conc_a.log)"; wait $pb || fail "session B: $(cat /tmp/conc_b.log)"
[ "$($Q -c "SELECT count(*) FROM costing.sales_allocation_quantity_driver_acceptance WHERE sku_id=4")" = 1 ] || fail "duplicate acceptance rows under race"
[ "$($Q -c "SELECT t.delta('conc')")" = 2 ] || fail "expected exactly 2 events for raced insert+upsert, got $($Q -c "SELECT t.delta('conc')")"
$Q -c "SELECT array_to_string(array_agg(event_kind ORDER BY id),',') FROM costing.governance_evidence_event WHERE evidence_category='SALES_QUANTITY_DRIVER' AND acceptance_id=(SELECT id FROM costing.sales_allocation_quantity_driver_acceptance WHERE sku_id=4)" | grep -qx "INSERT,UPDATE" || fail "event kinds under race"
[ "$($Q -c "SELECT (SELECT max(e.id) FROM costing.governance_evidence_event e WHERE e.acceptance_id=a.id AND e.evidence_category='SALES_QUANTITY_DRIVER')=a.governance_event_id AND e.acceptance_evidence=to_jsonb(a)-'governance_event_id'-'governance_category' FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id WHERE a.sku_id=4")" = t ] || fail "final pointer is not the latest event / payload mismatch"
echo "PASS concurrent-insert-upsert-race"
# 4. same-row concurrent plain updates serialise; final pointer == latest event
$Q -c "SELECT t.mark('conc2')" >/dev/null
( $Q -c "BEGIN; UPDATE costing.regional_marketing_evidence_acceptance SET acceptance_note='n1' WHERE sku_id=2; SELECT pg_sleep(1.5); COMMIT;" >/tmp/c1.log 2>&1 ) &
p1=$!; sleep 0.5
( $Q -c "UPDATE costing.regional_marketing_evidence_acceptance SET acceptance_note='n2' WHERE sku_id=2;" >/tmp/c2.log 2>&1 ) &
p2=$!
wait $p1 || fail "u1 $(cat /tmp/c1.log)"; wait $p2 || fail "u2 $(cat /tmp/c2.log)"
[ "$($Q -c "SELECT t.delta('conc2')")" = 2 ] || fail "concurrent updates events != 2"
[ "$($Q -c "SELECT acceptance_note FROM costing.regional_marketing_evidence_acceptance WHERE sku_id=2")" = n2 ] || fail "serial order"
[ "$($Q -c "SELECT e.acceptance_evidence->>'acceptance_note' FROM costing.regional_marketing_evidence_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id WHERE a.sku_id=2")" = n2 ] || fail "latest event not final row"
echo "PASS concurrent-same-row-updates"
