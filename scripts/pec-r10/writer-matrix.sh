#!/usr/bin/env bash
# F2: Add Line positive/negative matrix, full SAFE collision grid, RESET consequence verification,
# and global state/ACL invariants. Synthetic data only; disposable database via the F1 guard.
#   writer-matrix.sh [guarded|legacy|nowrap]
# Negative controls (run-matrix.sh requires these to FAIL):
#   legacy -> C2 (grid), C4 (RESET consequences: preview absent), C6 (default mode must not reset: no guard)
#   nowrap -> A3, A4 (new rows on PR-linked / approved / issued / closed indents)
set -u
. "$(dirname "$0")/lib.sh" matrix "${1:-guarded}"

# ---------------- Add Line: positive ----------------
seed; inv_begin 23
id=$(q "select public.proc_indent_add_line(23,1,14,1,6,'new manual')")
ok=$(q "select (select count(*) from proc_indent_line where indent_id=23)=3 and (select requested_qty from proc_indent_line where indent_line_id=${id:-0})=6 and (select manual_reason from proc_indent_line where indent_line_id=${id:-0})='new manual' and (select updated_at is not null from proc_indent_header where indent_id=23)")
[ "$ok" = t ] && inv_ok && res A1 PASS "new row on a draft manual indent: one row added, header touched, nothing else changed" || res A1 FAIL "positive Add Line wrong (ok=$ok)"

seed; inv_begin 23
q "select public.proc_indent_add_line(23,1,11,1,9,'fix')" >/dev/null
a=$(q "select (select count(*) from proc_indent_line where indent_id=23)=2 and (select requested_qty from proc_indent_line where indent_line_id=2301)=9 and (select manual_reason from proc_indent_line where indent_line_id=2301)='fix'")
q "select public.proc_indent_add_line(23,1,11,1,10,NULL)" >/dev/null
b=$(q "select (select count(*) from proc_indent_line where indent_id=23)=2 and (select requested_qty from proc_indent_line where indent_line_id=2301)=10 and (select manual_reason from proc_indent_line where indent_line_id=2301)='fix'")
[ "$a" = t ] && [ "$b" = t ] && inv_ok && res A2 PASS "existing row updated in place (no duplicate); NULL reason keeps the previous reason" || res A2 FAIL "upsert wrong (a=$a b=$b)"

# ---------------- Add Line: negative ----------------
seed; inv_begin 1
r=$(try "select public.proc_indent_add_line(1,1,55,1,3,'x')")
[ "$(code_of "$r")" = 23514 ] && inv_ok && res A3 PASS "new row on a draft PR-linked indent: 23514, nothing changed" || res A3 FAIL "PR-linked draft accepted a new row ($r)"

seed; inv_begin 20,21,22; ok=1
for i in 20 21 22; do
  r=$(try "select public.proc_indent_add_line($i,1,14,1,4,'new row after approval')")
  [ "$(code_of "$r")" = 23514 ] || ok=0
done
inv_ok || ok=0
[ $ok = 1 ] && res A4 PASS "new row on approved / issued / closed indents: 23514 each, nothing changed" || res A4 FAIL "a non-draft indent accepted a new row"

seed; inv_begin 20,21,22; ok=1
q "select public.proc_indent_add_line(20,1,11,1,7,'correction')" >/dev/null
[ "$(q "select (select requested_qty from proc_indent_line where indent_line_id=2001)=7 and (select count(*) from proc_indent_line where indent_id=20)=2")" = t ] || ok=0
q "select public.proc_indent_add_line(21,1,11,1,5,'issued correction')" >/dev/null
[ "$(q "select (select requested_qty from proc_indent_line where indent_line_id=2101)=5 and (select count(*) from proc_indent_line where indent_id=21)=1")" = t ] || ok=0
r=$(try "select public.proc_indent_add_line(20,1,11,1,8,NULL)"); case $r in *"Reason is required"*) : ;; *) ok=0 ;; esac
r=$(try "select public.proc_indent_add_line(21,1,11,1,8,'   ')"); case $r in *"Reason is required"*) : ;; *) ok=0 ;; esac
r=$(try "select public.proc_indent_add_line(22,1,11,1,8,'closed edit')"); case $r in *"not editable"*) : ;; *) ok=0 ;; esac
[ "$(q "select (select requested_qty from proc_indent_line where indent_line_id=2001)=7 and (select requested_qty from proc_indent_line where indent_line_id=2201)=2")" = t ] || ok=0
[ $ok = 1 ] && res A5 PASS "existing-line correction: allowed with a reason on approved/issued, rejected without one, rejected on closed; no extra rows" || res A5 FAIL "governed correction contract broken"

seed; inv_begin 23; ok=1
r=$(try "select public.proc_indent_add_line(23,1,NULL,1,1,'x')"); case $r in *"p_stock_item_id is required"*) : ;; *) ok=0 ;; esac
r=$(try "select public.proc_indent_add_line(9999,1,11,1,1,'x')"); case $r in *"Indent not found"*) : ;; *) ok=0 ;; esac
r=$(try "select public.proc_indent_add_line(23,1,99,1,5,'internal item')"); case $r in *"prohibited for internal"*) : ;; *) ok=0 ;; esac
inv_ok || ok=0
[ $ok = 1 ] && res A6 PASS "invalid input: missing id, unknown indent and internal finished-bulk item all rejected, nothing changed" || res A6 FAIL "invalid-input handling wrong"

# ---------------- Collision grid (preview agrees with the writer for every state) ----------------
if has_preview; then havep=1; else havep=0; fi
okg=1; n=0; nb=0
for mapped in false true; do for qty in 4 5; do for reason in "'PR 13'" NULL "''" "'   '" "'other'"; do
  seed; q "select public.fx_grid_state(40,13,$qty,$reason,$mapped)" >/dev/null
  exp=false; if [ $mapped = false ]; then { [ $qty != 4 ] || [ "$reason" != "'PR 13'" ]; } && exp=true; fi
  bl=$(q "select public.proc_indent_resync_collision_preview(40)->>'blocked'" 2>/dev/null)
  r=$(try "select public.proc_indent_resync_from_pr_pec_internal(40,'safe')")
  w=false; [ "$(code_of "$r")" = 23514 ] && w=true
  [ "$bl" = "$exp" ] && [ "$w" = "$exp" ] || { okg=0; echo "  grid mismatch indent40 mapped=$mapped qty=$qty reason=$reason expected=$exp preview=$bl writer=$w" >&2; }
  n=$((n+1)); [ $exp = true ] && nb=$((nb+1))
done; done; done
for mapped in false true; do for qty in 3 4; do for reason in NULL "''" "'  '" "'x'"; do
  seed; q "select public.fx_grid_state(41,11,$qty,$reason,$mapped)" >/dev/null
  exp=false; if [ $mapped = false ]; then { [ $qty != 3 ] || [ "$reason" = "'x'" ]; } && exp=true; fi
  bl=$(q "select public.proc_indent_resync_collision_preview(41)->>'blocked'" 2>/dev/null)
  r=$(try "select public.proc_indent_resync_from_pr_pec_internal(41,'safe')")
  w=false; [ "$(code_of "$r")" = 23514 ] && w=true
  [ "$bl" = "$exp" ] && [ "$w" = "$exp" ] || { okg=0; echo "  grid mismatch indent41 mapped=$mapped qty=$qty reason=$reason expected=$exp preview=$bl writer=$w" >&2; }
  n=$((n+1)); [ $exp = true ] && nb=$((nb+1))
done; done; done
[ $okg = 1 ] && [ $n = 36 ] && [ $nb = 14 ] && res C2 PASS "collision grid: $n states ($nb blocked); preview.blocked == SAFE rejection == expected for every state; ''/whitespace/NULL normalise equal" || res C2 FAIL "grid disagreement or wrong state count (n=$n blocked=$nb ok=$okg preview=$havep)"

# ---------------- RESET consequences: preview numbers == what RESET actually does ----------------
okr=1
for ind in 1 2 7; do
  seed
  prev=$(q "select (public.proc_indent_resync_collision_preview($ind)->>'reset_consequence_delete_all_lines')||','||(public.proc_indent_resync_collision_preview($ind)->>'reset_consequence_manual_lines_lost')" 2>/dev/null)
  before_all=$(q "select string_agg(indent_line_id::text,',' order by indent_line_id) from proc_indent_line where indent_id=$ind")
  before_manual=$(q "select coalesce(string_agg(l.indent_line_id::text,',' order by l.indent_line_id),'') from proc_indent_line l where l.indent_id=$ind and not exists (select 1 from proc_pr_indent_line_map m where m.indent_id=$ind and m.indent_line_id=l.indent_line_id)")
  q "select public.proc_indent_resync_from_pr_pec_internal($ind,'reset')" >/dev/null
  gone_all=$(q "select count(*) from unnest(string_to_array('$before_all',',')::bigint[]) x where not exists (select 1 from proc_indent_line where indent_line_id=x)")
  gone_manual=$(q "select count(*) from unnest(string_to_array(nullif('$before_manual',''),',')::bigint[]) x where not exists (select 1 from proc_indent_line where indent_line_id=x)")
  [ "$prev" = "$gone_all,$gone_manual" ] || { okr=0; echo "  reset mismatch indent=$ind preview=$prev actual=$gone_all,$gone_manual" >&2; }
done
[ $okr = 1 ] && res C4 PASS "preview RESET consequences (lines deleted, manual lines lost) equal the real RESET effect on indents 1, 2, 7" || res C4 FAIL "preview RESET numbers differ from real RESET"

# ---------------- Resolve then SAFE ----------------
seed; ok=1
q "update proc_indent_line set requested_qty=4, manual_reason='PR 13' where indent_line_id=104" >/dev/null
[ "$(q "select public.proc_indent_resync_collision_preview(1)->>'blocked'" 2>/dev/null)" = false ] || ok=0
q "select public.proc_indent_resync_from_pr_pec_internal(1,'safe')" >/dev/null
[ "$(q "select exists(select 1 from proc_indent_line where indent_id=1 and stock_item_id=80 and manual_reason='manual independent') and (select requested_qty from proc_indent_line where indent_id=1 and stock_item_id=13)=4 and exists(select 1 from proc_pr_indent_line_map m join proc_indent_line l using(indent_line_id) where m.indent_id=1 and l.stock_item_id=13)")" = t ] || ok=0
seed; q "delete from proc_indent_line where indent_line_id=104" >/dev/null
q "select public.proc_indent_resync_from_pr_pec_internal(1,'safe')" >/dev/null
[ "$(q "select exists(select 1 from proc_indent_line where indent_id=1 and stock_item_id=80) and (select requested_qty from proc_indent_line where indent_id=1 and stock_item_id=13)=4")" = t ] || ok=0
[ $ok = 1 ] && res C5 PASS "after the operator edits or removes the colliding line SAFE succeeds, rebuilds the mapping and keeps the independent manual line" || res C5 FAIL "resolution path broken"

# ---------------- Mode default and RESET semantics ----------------
seed; inv_begin 2; ok=1
r=$(try "select public.proc_indent_resync_from_pr_pec_internal(2)")
[ "$(code_of "$r")" = 23514 ] || ok=0
inv_ok || ok=0
q "update proc_indent_line set requested_qty=4, manual_reason='PR 13' where indent_line_id=204" >/dev/null
q "select public.proc_indent_resync_from_pr_pec_internal(2)" >/dev/null
[ "$(q "select exists(select 1 from proc_indent_line where indent_id=2 and stock_item_id=80)")" = t ] || ok=0
[ $ok = 1 ] && res C6 PASS "omitting the mode runs SAFE (rejects the collision, keeps manual lines); only an explicit 'reset' deletes" || res C6 FAIL "default mode is not SAFE"

seed
q "select public.proc_indent_resync_from_pr_pec_internal(2,'reset')" >/dev/null
s1=$(q "select string_agg(concat_ws('|',stock_item_id,requested_qty,coalesce(manual_reason,'~')),';' order by stock_item_id) from proc_indent_line where indent_id=2")
c1=$(q "select count(*) from proc_pr_indent_line_map where indent_id=2")
q "select public.proc_indent_resync_from_pr_pec_internal(2,'reset')" >/dev/null
s2=$(q "select string_agg(concat_ws('|',stock_item_id,requested_qty,coalesce(manual_reason,'~')),';' order by stock_item_id) from proc_indent_line where indent_id=2")
c2=$(q "select count(*) from proc_pr_indent_line_map where indent_id=2")
a1=$(q "select count(*) from proc_pr_to_indent_map where indent_id=2 and is_active")
[ -n "$s1" ] && [ "$s1" = "$s2" ] && [ "$c1" = "$c2" ] && [ "$a1" = 1 ] && res C7 PASS "RESET is destructive by design and idempotent (same lines, same mapping, one active link)" || res C7 FAIL "RESET not idempotent ($s1 / $s2)"

# ---------------- Denials never mutate (extends S8 to approved/issued/closed) ----------------
seed; inv_begin 3,20,21,22; ok=1
for t in "3,'safe'" "20,'safe'" "21,'reset'" "22,'safe'" "4,'safe'" "5,'safe'" "1,'bogus'" "9999,'safe'"; do
  r=$(try "select public.proc_indent_resync_from_pr_pec_internal($t)")
  [ "$r" != OK ] || ok=0
done
inv_ok || ok=0
[ "$(q "select count(*) from proc_indent_line where indent_id in (3,20,21,22)")" = 6 ] || ok=0
[ $ok = 1 ] && res C8 PASS "resync on approved / issued / closed, no-PR, PR-not-active, bad mode and unknown indent is denied; nothing changed" || res C8 FAIL "a denied resync changed state or was accepted"

# ---------------- Global invariants over a mixed workload ----------------
seed; inv_begin 1,23
q "select public.proc_indent_resync_from_pr_pec_internal(1,'reset'); select public.proc_indent_add_line(23,1,14,1,2,'w')" >/dev/null
G1=$(q "select public.fx_global_md5('{1,23}')")
[ "$G1" = "$G0" ] && [ "$(q "select public.fx_acl_md5()")" = "$A0" ] && [ "$(q "select count(*) from proc_indent_line where indent_id in (3,20,21,22)")" = 6 ] && res I1 PASS "after a RESET on indent 1 and an Add Line on indent 23: every other indent, line, mapping and PR row is byte-identical; no ACL/policy change; approved/issued/closed sentinels intact" || res I1 FAIL "unintended change outside the target indents"

echo "SOURCE=matrix:${VARIANT} FAILS=$FAILS"
