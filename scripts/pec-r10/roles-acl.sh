#!/usr/bin/env bash
# F1 real-role layer: genuine require_permission, grants and RLS mirroring the live shape, exercised
# with SET ROLE (grants are really enforced). Synthetic users only.
#   roles-acl.sh [guarded|open|noperm]
# Negative controls (run-roles.sh requires these to FAIL):
#   open   -> EXECUTE broadened to PUBLIC/anon/authenticated: G5 and G6 must fail
#   noperm -> require_permission is a no-op: G2 and G3 must fail
set -u
MODE=${1:-guarded}
. "$(dirname "$0")/lib.sh" roles guarded
P -f "$LIBDIR/fixture-rbac.sql" >/dev/null
case $MODE in
  open) P -c "grant execute on all functions in schema public to public, anon, authenticated" >/dev/null ;;
  noperm) P -c "create or replace function public.require_permission(p_target text, p_need_edit boolean) returns void language sql as \$f\$ select \$f\$" >/dev/null ;;
  guarded) : ;;
  *) echo "bad mode"; exit 2 ;;
esac
EDITOR=aaaaaaaa-0000-0000-0000-000000000001; VIEWER=aaaaaaaa-0000-0000-0000-000000000002; NONE=aaaaaaaa-0000-0000-0000-000000000003

# as <role> <uuid|-> "<sql>"  ->  OK | SQLSTATE:message   (statement runs and commits as that role)
as() {
  local role=$1 uid=$2 sql=$3 sub out
  [ "$uid" = - ] && sub='' || sub=$uid
  out=$(psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$DB" -c "set role $role; select set_config('request.jwt.claim.sub','$sub',false); $sql" 2>&1) && { echo OK; return; }
  printf '%s' "$out" | tr '\n' ' ' | sed -E 's/.*ERROR: +([0-9A-Z]{5}): *([^ ].{0,100}).*/\1:\2/'
}
ADD="select public.proc_indent_add_line(23,1,14,1,2,'role test')"
SRC="select public.proc_indent_set_source_pr(4,100,'role test')"
PRV="select public.proc_indent_resync_collision_preview(1)"
gmd() { q "select public.fx_global_md5()"; }

seed; A0=$(q "select public.fx_acl_md5()"); G0=$(gmd)

# G1 viewer: preview allowed
r=$(as authenticated $VIEWER "$PRV"); [ "$r" = OK ] && res G1 PASS "View-only: R10 preview permitted" || res G1 FAIL "viewer preview -> $r"
# G2 viewer: writers denied by the permission gate, no mutation
ok=1
for s in "$ADD" "$SRC"; do r=$(as authenticated $VIEWER "$s"); case $r in "P0001:Permission denied for module:procurement-execution-console (edit=t)"*) : ;; *) ok=0; echo "  viewer writer -> $r" >&2 ;; esac; done
[ "$(gmd)" = "$G0" ] || ok=0
[ $ok = 1 ] && res G2 PASS "View-only: Add Line and source-PR change denied (P0001, 'Permission denied ... (edit=t)': PostgreSQL prints the boolean as t/f); nothing changed" || res G2 FAIL "viewer writer not denied or state changed"
# G3 no-access: preview and writers denied; unauthenticated session rejected
ok=1
r=$(as authenticated $NONE "$PRV"); case $r in "P0001:Permission denied for module:procurement-execution-console (edit=f)"*) : ;; *) ok=0; echo "  none preview -> $r" >&2 ;; esac
r=$(as authenticated $NONE "$ADD"); case $r in P0001:Permission\ denied*) : ;; *) ok=0; echo "  none writer -> $r" >&2 ;; esac
r=$(as authenticated - "$PRV"); case $r in "P0001:Not authenticated"*) : ;; *) ok=0; echo "  no-sub preview -> $r" >&2 ;; esac
[ "$(gmd)" = "$G0" ] || ok=0
[ $ok = 1 ] && res G3 PASS "No-access: preview and writers denied (edit=f / edit=t wording); a session without identity is 'Not authenticated'; nothing changed" || res G3 FAIL "no-access gate wrong"
# G4 editor: everything permitted (these two writes commit; reseed afterwards)
ok=1
r=$(as authenticated $EDITOR "$PRV"); [ "$r" = OK ] || { ok=0; echo "  editor preview -> $r" >&2; }
r=$(as authenticated $EDITOR "$ADD"); [ "$r" = OK ] || { ok=0; echo "  editor add_line -> $r" >&2; }
r=$(as authenticated $EDITOR "$SRC"); [ "$r" = OK ] || { ok=0; echo "  editor set_source -> $r" >&2; }
[ "$(q "select (select count(*) from proc_indent_line where indent_id=23 and stock_item_id=14)=1 and (select source_pr_id from proc_indent_header where indent_id=4)=100")" = t ] || ok=0
[ $ok = 1 ] && res G4 PASS "Editor: preview, Add Line and source-PR change all permitted and effective" || res G4 FAIL "editor flow wrong"
# G5 anon: no EXECUTE on any wrapper or the preview
seed; ok=1
for s in "$ADD" "$SRC" "$PRV"; do r=$(as anon - "$s"); case $r in 42501:*) : ;; *) ok=0; echo "  anon -> $r" >&2 ;; esac; done
[ "$(gmd)" = "$(q "select public.fx_global_md5()")" ] || ok=0
[ $ok = 1 ] && res G5 PASS "anon: Add Line, source-PR change and preview all 42501 (no EXECUTE)" || res G5 FAIL "anon reached a wrapper or the preview"
# G6 authenticated and anon cannot call any internal writer
ok=1
for who in authenticated anon; do
  for s in "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" \
           "select public.proc_indent_add_line_pec_internal(23,1,14,1,2,'x')" \
           "select public.proc_indent_set_source_pr_pec_internal(4,100,'x')" \
           "select public.proc_pr_add_line_pec_internal(200,1,12,1,1,'x')" \
           "select public.proc_pr_set_manual_delta_pec_internal(2001,1,'x')"; do
    r=$(as $who $EDITOR "$s"); case $r in 42501:*) : ;; *) ok=0; echo "  $who internal -> $r" >&2 ;; esac
  done
done
[ $ok = 1 ] && res G6 PASS "authenticated (even with Edit) and anon cannot execute any *_pec_internal writer (42501)" || res G6 FAIL "an internal writer is executable by a client role"
# G7 direct table DML by client roles
seed; G0=$(gmd); ok=1
for s in "insert into proc_indent_line(indent_id,material_class_id,stock_item_id,uom_id,requested_qty) values (23,1,15,1,1)" \
         "update proc_indent_line set requested_qty=99" "delete from proc_indent_line" \
         "update proc_pr_line set requested_qty=99" "insert into proc_pr_header(pr_id,status) values (900,'active')"; do
  r=$(as authenticated $EDITOR "$s"); case $r in 42501:*) : ;; *) ok=0; echo "  authenticated DML -> $r" >&2 ;; esac
done
r=$(as authenticated $EDITOR "insert into proc_pr_indent_line_map(indent_id,indent_line_id,pr_id,pr_line_id) values (23,2301,100,1001)"); case $r in 42501:*) : ;; *) ok=0; echo "  map insert -> $r" >&2 ;; esac
r=$(as anon - "insert into proc_pr_indent_line_map(indent_id,indent_line_id,pr_id,pr_line_id) values (23,2301,100,1001)"); case $r in 42501:*) : ;; *) ok=0; echo "  anon map insert -> $r" >&2 ;; esac
as authenticated $EDITOR "update proc_pr_indent_line_map set pr_id=999; delete from proc_pr_indent_line_map; update proc_pr_to_indent_map set is_active=false; delete from proc_pr_to_indent_map" >/dev/null
r=$(as anon - "select count(*) from proc_indent_line"); case $r in 42501:*) : ;; *) ok=0; echo "  anon select -> $r" >&2 ;; esac
[ "$(gmd)" = "$G0" ] || { ok=0; echo "  state changed by direct DML" >&2; }
[ $ok = 1 ] && res G7 PASS "client roles cannot write indent/PR tables; line-map writes are stopped by RLS (insert 42501, update/delete affect 0 rows); anon cannot read; state unchanged" || res G7 FAIL "direct DML or anon read succeeded"
# characterisation of the pre-existing read exposure (issue #400): any signed-in user can read the tables
seed; n=$(psql -X -q -At -d "$DB" -c "set role authenticated; select set_config('request.jwt.claim.sub','$NONE',false); select count(*) from proc_indent_line" 2>/dev/null | tail -1)
echo "RESULT G7b INFO a signed-in user WITHOUT any PEC grant can read $n indent lines directly (policy auth.uid() IS NOT NULL) — characterisation of #400, not a fix"
# G8 nothing above changed any ACL or policy
[ "$(q "select public.fx_acl_md5()")" = "$A0" ] && res G8 PASS "ACL/policy fingerprint unchanged across the whole role suite" || res G8 FAIL "ACL fingerprint changed"

echo "SOURCE=roles:${MODE} FAILS=$FAILS"
