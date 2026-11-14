#!/usr/bin/env bash
# Shared prelude for the F2/F4 suites (writer-matrix.sh, roles-acl.sh, risk-characterization.sh).
# SOURCE it:  . "$(dirname "$0")/lib.sh" <label: matrix|roles|risk> [variant: guarded|legacy|nowrap]
# Creates a NEW disposable database through the F1 guard (guard.sh) and loads, in order:
#   fixture-schema.sql -> real internal Add Line -> 133000 PR writers -> 143000 resync
#   -> (variant guarded) the three R10 migrations -> Add Line wrapper (#374) -> fixture-extras.sql
# Variants are NEGATIVE CONTROLS: legacy = no R10; nowrap = Add Line wrapper without the
# new-row/status guard. Each suite documents which of its checks must FAIL on them.
set -u
PEC_LABEL=${1:?label}; VARIANT=${2:-guarded}
LIBDIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); ROOT=$(cd "$LIBDIR/../.." && pwd); MIG=$ROOT/supabase/migrations
. "$LIBDIR/guard.sh"
pec_guard_preflight "$PEC_LABEL"
pec_create_db
DB=$PEC_DB
export PGOPTIONS='-c client_min_messages=warning'
P() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
q() { P -c "$1"; }
lf() { tr -d '\r' < "$1"; }
TMPSQL=$(mktemp)
case $VARIANT in guarded | legacy | nowrap) : ;; *) echo "bad variant"; exit 2 ;; esac
P -f "$LIBDIR/fixture-schema.sql" >/dev/null
awk '/CREATE OR REPLACE FUNCTION public.proc_indent_add_line_pec_internal/{f=1} f{print} f&&/^\$function\$;/{exit}' <(lf "$MIG/20261112122500_pec_revision_and_manual_indent_internal_guard.sql") > "$TMPSQL"
P -f "$TMPSQL" >/dev/null || { echo "failed to load internal add_line"; rm -f "$TMPSQL"; exit 2; }
rm -f "$TMPSQL"
lf "$MIG/20261112133000_pec_manual_pr_internal_item_guards.sql" | P >/dev/null
lf "$MIG/20261112143000_pec_safe_resync_preserve_manual_lines.sql" | P >/dev/null
if [ "$VARIANT" != legacy ]; then
  lf "$(ls "$MIG"/*_pec_safe_resync_collision_guard_lock_order.sql | head -1)" | P >/dev/null
  lf "$(ls "$MIG"/*_pec_safe_resync_collision_preview_ro.sql | head -1)" | P >/dev/null
  lf "$(ls "$MIG"/*_pec_indent_set_source_pr_lock_prelude.sql | head -1)" | P >/dev/null
fi
lf "$LIBDIR/addline-wrapper-374-e252277.sql" | P >/dev/null
if [ "$VARIANT" = nowrap ]; then
  P -c "create or replace function public.proc_indent_add_line(p_indent_id bigint, p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_requested_qty numeric default 0, p_reason text default null) returns bigint language plpgsql security definer set search_path to 'public' as \$f\$ begin perform public.require_permission('module:procurement-execution-console', true); return public.proc_indent_add_line_pec_internal(p_indent_id,p_material_class_id,p_stock_item_id,p_uom_id,p_requested_qty,p_reason); end \$f\$" >/dev/null
fi
P -f "$LIBDIR/fixture-extras.sql" >/dev/null

FAILS=0
res() { echo "RESULT $1 $2 $3"; [ "$2" = PASS ] || FAILS=$((FAILS+1)); }
seed() { P -c "select public.fx_seed(); select public.fx_seed_extra()" >/dev/null; }
# try "<sql>" -> OK | SQLSTATE:message   (effects rolled back)
try() { q "select public.fx_try(\$t\$$1\$t\$)"; }
code_of() { printf '%s' "${1%%:*}"; }
# invariants: inv_begin <comma-separated indent ids under test>; inv_ok after the action
inv_begin() { EX="$1"; G0=$(q "select public.fx_global_md5('{$EX}')"); A0=$(q "select public.fx_acl_md5()"); }
inv_ok() { [ "$(q "select public.fx_global_md5('{$EX}')")" = "$G0" ] && [ "$(q "select public.fx_acl_md5()")" = "$A0" ]; }
has_preview() { [ "$(q "select count(*) from pg_proc where proname='proc_indent_resync_collision_preview'")" = 1 ]; }

# ---- deterministic concurrency helpers (same barrier design as concurrency-harness.sh) ----
OUT=$(mktemp -d)
A_ADV="wait_event='advisory'"; B_ROW="wait_event in ('transactionid','tuple')"
ctl_hold() { PGAPPNAME=ctl psql -X -q -At -d "$DB" -c "select pg_advisory_lock(777); select pg_sleep(3600)" >/dev/null 2>&1 & CTL=$!
  for _ in $(seq 200); do [ "$(q "select count(*) from pg_locks where locktype='advisory' and granted and objid=777")" = 1 ] && return 0; sleep 0.05; done; return 1; }
ctl_release() { q "select pg_terminate_backend(pid) from pg_stat_activity where application_name='ctl'" >/dev/null; wait $CTL 2>/dev/null; }
wait_wait() { for _ in $(seq 120); do [ "$(q "select count(*) from pg_stat_activity where application_name='$1' and wait_event_type='Lock' and $2")" -ge 1 ] && return 0; sleep 0.05; done; return 1; }
bg() { local app=$1 sql=$2 tag=$3; PGAPPNAME=$app psql -X -q -At -d "$DB" -c "$sql" >"$OUT/$tag.out" 2>"$OUT/$tag.err" & echo $! >"$OUT/$tag.pid"; }
finish() { wait "$(cat "$OUT/$1.pid")"; echo $? >"$OUT/$1.rc"; }
