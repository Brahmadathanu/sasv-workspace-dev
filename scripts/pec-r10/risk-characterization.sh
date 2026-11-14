#!/usr/bin/env bash
# F4: characterise residual risks R-1 / R-2 / R-3 in a disposable fixture. NOTHING here is a production
# correction: the R-2 "proposed fix" is applied only inside the throw-away database.
#   risk-characterization.sh [guarded]
# Result vocabulary: PASS/FAIL = a property that must hold; CONFIRMED = a known defect that the test
# REPRODUCES on purpose (FAIL if it can no longer be reproduced); INFO = observation, never a failure.
set -u
. "$(dirname "$0")/lib.sh" risk guarded
P -f "$LIBDIR/fixture-risk.sql" >/dev/null
P -f "$LIBDIR/fixture-live-defs.sql" >/dev/null
seed() { P -c "select public.fx_seed_risk()" >/dev/null; }

# L1 parity: the live-copied bodies are byte-identical to the live catalog (hashes taken 14 Nov 2026)
ok=1
for pair in "proc_indent_set_status_pec_internal:052dfcbd06e19746213aaada2b588036" \
            "proc_apply_vendor_to_same_item_lines_pec_internal:547b5348a0808f99dde8c5ff23533a16" \
            "proc_clear_vendor_assignment_for_same_item_lines_pec_internal:c6be0665c3906b9c37da8adcc755bedc"; do
  fn=${pair%%:*}; h=${pair##*:}
  [ "$(q "select md5(replace(prosrc,chr(13),'')) from pg_proc where proname='$fn' and pronamespace='public'::regnamespace")" = "$h" ] || { ok=0; echo "  parity mismatch $fn" >&2; }
done
[ $ok = 1 ] && res L1 PASS "approval and both vendor bulk writers in the fixture are byte-identical to the live function bodies" || res L1 FAIL "fixture copy differs from live"

# ===================== R-1: vendor bulk writers =====================
# Mechanism established from the live bodies: they upsert proc_indent_line_sourcing_decision rows and then
# UPDATE many proc_indent_header rows (updated_at/by) in scan order, with no header-first protocol. They
# never lock or update proc_indent_line rows.
seed; ctl_hold
bg sess_A "set fx.pause_hdr_row='20'; select * from public.proc_apply_vendor_to_same_item_lines_pec_internal(1,11,1,7,5,'because')" A
wait_wait sess_A "$A_ADV" || res R1a FAIL "vendor apply never reached the pause on header 20"
# R1a: a governed approved-line correction on the header the vendor writer holds must WAIT, then succeed
bg sess_B "select public.proc_indent_add_line(20,1,11,1,9,'correction')" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
# R1c: indent LINES are not locked by the vendor writer (so no line-lock inversion with resync)
if timeout 20 env PGAPPNAME=sess_C psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "update proc_indent_line set requested_qty=requested_qty where indent_line_id=2101" >/dev/null 2>&1; then lines_free=1; else lines_free=0; fi
# R1d: a resync of a DRAFT indent is not blocked (vendor writer only touches published indents' headers)
if timeout 20 env PGAPPNAME=sess_D psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" >/dev/null 2>&1; then draft_free=1; else draft_free=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(cat "$OUT/A.rc")" = 0 ] && [ "$(cat "$OUT/B.rc")" = 0 ] && [ "$(q "select requested_qty from proc_indent_line where indent_line_id=2001")" = 9 ] && [ "$(q "select count(*) from proc_indent_line_sourcing_decision where selected_vendor_id=7")" = 3 ] \
  && res R1a PASS "approved-line correction waited for the vendor bulk writer's header lock, then applied; 3 vendor decisions written; no deadlock" || res R1a FAIL "no serialization or wrong result (blocked=$blocked)"
[ $lines_free = 1 ] && res R1c PASS "while the vendor bulk writer holds header rows, indent lines stay writable (it does not lock lines)" || res R1c FAIL "indent line update blocked by vendor writer"
[ $draft_free = 1 ] && res R1d PASS "a resync of a draft indent is not blocked by the vendor bulk writer (disjoint indents)" || res R1d FAIL "resync blocked by vendor writer"

# R1b: opposite-order multi-header writers: bounded random probe, observation only
dl=0; seed
for i in $(seq 20); do
  PGAPPNAME=v1 psql -X -q -At -d "$DB" -c "select * from public.proc_apply_vendor_to_same_item_lines_pec_internal(1,11,1,7,5,'r$i',true)" >/dev/null 2>"$OUT/v1.err" & p1=$!
  PGAPPNAME=v2 psql -X -q -At -d "$DB" -c "select * from public.proc_clear_vendor_assignment_for_same_item_lines_pec_internal(1,11,1,'c$i',true)" >/dev/null 2>"$OUT/v2.err" & p2=$!
  PGAPPNAME=v3 psql -X -q -At -d "$DB" -c "select * from public.proc_apply_vendor_to_same_item_lines_pec_internal(1,11,1,8,6,'s$i',true)" >/dev/null 2>"$OUT/v3.err" & p3=$!
  PGAPPNAME=v4 psql -X -q -At -d "$DB" -c "select public.proc_indent_add_line(20,1,11,1,$((i+1)),'k$i')" >/dev/null 2>"$OUT/v4.err" & p4=$!
  wait $p1 $p2 $p3 $p4
  grep -qi deadlock "$OUT"/v?.err && dl=$((dl+1))
done
echo "RESULT R1b INFO two vendor bulk writers plus an approved-line correction, 20 concurrent rounds: rounds with a deadlock abort (40P01) = $dl (observation only; a deadlock aborts one transaction cleanly; independent of R10; absence does not prove safety)"

# ===================== R-2: approval vs resync (live approval body) =====================
# Window: the live approval reads status, counts lines, then UPDATEs the header WITHOUT locking first.
seed; q "update proc_pr_line set requested_qty=0 where pr_id=500" >/dev/null
ctl_hold
bg sess_A "set fx.pause_hdr_stmt='on'; select public.proc_indent_set_status_pec_internal(31,'approved')" A
wait_wait sess_A "$A_ADV" || res R2a FAIL "approval never reached the pause before its UPDATE"
q "select public.proc_indent_resync_from_pr_pec_internal(31,'safe')" >/dev/null
ctl_release; finish A
st=$(q "select status from proc_indent_header where indent_id=31"); n=$(q "select count(*) from proc_indent_line where indent_id=31")
if [ "$st" = approved ] && [ "$n" = 0 ]; then
  echo "RESULT R2a CONFIRMED known defect reproduced with the live approval body: indent 31 ended 'approved' with $n lines (approval used a stale line count; resync emptied the draft in between)"
else res R2a FAIL "defect not reproduced (status=$st lines=$n): re-assess R-2"; fi
# R2b: PROPOSED fix, applied only in this throw-away database: take the header row lock first (FOR UPDATE).
P -c "DO \$\$ DECLARE d text; BEGIN d := pg_get_functiondef('public.proc_indent_set_status_pec_internal(bigint,text,date)'::regprocedure); IF (length(d) - length(replace(d,'from public.proc_indent_header where indent_id = p_indent_id;',''))) <> length('from public.proc_indent_header where indent_id = p_indent_id;') THEN RAISE EXCEPTION 'expected exactly one match'; END IF; EXECUTE replace(d,'from public.proc_indent_header where indent_id = p_indent_id;','from public.proc_indent_header where indent_id = p_indent_id for update;'); END \$\$" >/dev/null || res R2b FAIL "could not apply the proposed fix in the fixture"
seed; q "update proc_pr_line set requested_qty=0 where pr_id=500" >/dev/null
ctl_hold
bg sess_A "set fx.pause_hdr_stmt='on'; select public.proc_indent_set_status_pec_internal(31,'approved')" A
wait_wait sess_A "$A_ADV"
bg sess_B "select public.proc_indent_resync_from_pr_pec_internal(31,'safe')" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
st=$(q "select status from proc_indent_header where indent_id=31"); n=$(q "select count(*) from proc_indent_line where indent_id=31")
[ $blocked = 1 ] && [ "$st" = approved ] && [ "$n" = 3 ] && [ "$(cat "$OUT/B.rc")" != 0 ] && res R2b PASS "with the proposed header-lock-first approval: the resync waits, the approval keeps its 3 lines, the resync is then rejected (indent no longer draft)" || res R2b FAIL "proposed fix does not close the race (blocked=$blocked status=$st lines=$n)"
# the same invariant stated generally, on the fixed fixture: no approved indent without lines
[ "$(q "select count(*) from proc_indent_header h where h.status='approved' and not exists (select 1 from proc_indent_line l where l.indent_id=h.indent_id) and h.indent_id=31")" = 0 ] && res R2c PASS "invariant 'approved => at least one line' holds for indent 31 under the proposed fix" || res R2c FAIL "approved indent without lines under the proposed fix"

# ===================== R-3: privileged callers =====================
# R3a: a direct INSERT of a NEW line (service-role style, no wrapper) while a resync is in flight. The live FK
# (indent_id -> header) takes FOR KEY SHARE on the header row, which conflicts with the resync's FOR UPDATE.
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV" || res R3a FAIL "resync never reached the barrier"
bg sess_B "insert into proc_indent_line(indent_id,material_class_id,stock_item_id,uom_id,requested_qty,manual_reason) values (9,1,91,1,1,'direct insert')" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(cat "$OUT/A.rc")" = 0 ] && [ "$(cat "$OUT/B.rc")" = 0 ] && [ "$(q "select count(*) from proc_indent_line where indent_id=9 and stock_item_id=91 and manual_reason='direct insert'")" = 1 ] \
  && res R3a PASS "a direct new-line INSERT waited behind the in-flight resync (FK key-share vs header FOR UPDATE), then landed as an unmapped manual line; resync mapping intact" || res R3a FAIL "direct insert not serialized (blocked=$blocked)"
# R3b: a direct UPDATE of an existing line is blocked by the resync's line locks
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV"
bg sess_B "update proc_indent_line set requested_qty=77 where indent_line_id=903" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(cat "$OUT/B.rc")" = 0 ] && [ "$(q "select requested_qty from proc_indent_line where indent_line_id=903")" = 77 ] && res R3b PASS "a direct UPDATE of an existing line waited for the resync's line locks and applied afterwards (no lost update)" || res R3b FAIL "direct update not serialized (blocked=$blocked)"
echo "RESULT R3c INFO what remains for privileged callers: they can call the *_pec_internal functions and skip the wrapper's permission check and lock prelude (by design; clients cannot: see roles-acl G6). Database row locks and the FK still serialize them with the resync."

echo "SOURCE=risk:guarded FAILS=$FAILS"
