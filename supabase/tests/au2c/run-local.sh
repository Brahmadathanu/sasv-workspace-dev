#!/usr/bin/env bash
# AU-2c local test: seed fixtures in a scratch copy of the parity DB tables, apply (COMMIT variant), check, rollback, check guards.
set -euo pipefail
P="psql -h /tmp -p 54329 -U postgres -d costing_local -v ON_ERROR_STOP=1 -qAt"
D=$(dirname "$0")/../../../docs/costing/au2c
pass=0; fail=0; chk(){ if [ "$2" = "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 got=$2 want=$3"; fail=$((fail+1)); fi; }
$P <<'SQL'
set session_replication_role = replica;  -- fixtures only: skip FK checks
delete from public.rm_bom_header where id in (2283,2289,2379);
delete from public.products where id in (678,696,1038);
insert into public.products(id,item,sub_group_id,status,uom_base,conversion_to_base) values
 (678,'Ilaneer Kuzhambu',1,'Active','Kg',0.000714),(696,'Mehasamani',1,'Active','Kg',0.02),(1038,'Palthulli',1,'Active','Kg',0.00127);
insert into public.rm_bom_header(id,product_id,reference_output_qty,reference_output_uom_id) values (2283,678,28039,1),(2289,696,320,1),(2379,1038,2697,1);
SQL
q(){ $P -c "$1"; }
sed 's/^rollback;  -- change to COMMIT.*/commit;/' $D/AU2C_PROPOSED_CHANGES.sql | $P >/dev/null
chk T1_859_output "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2283')" 28.039
chk T2_879_factor "$(q 'select conversion_to_base from public.products where id=696')" 0.001
chk T3_879_output "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2289')" 16.000
chk T4_1277_untouched "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2379')" 2697.000
chk T5_rm_scale_859 "$(q 'select round(28039/reference_output_qty) from public.rm_bom_header where id=2283')" 1000
# idempotent re-apply: guards make it a no-op
sed 's/^rollback;  -- change to COMMIT.*/commit;/' $D/AU2C_PROPOSED_CHANGES.sql | $P >/dev/null
chk T6_reapply_noop "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2283')" 28.039
$P -f $D/AU2C_ROLLBACK.sql >/dev/null
chk T7_rb_859 "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2283')" 28039.000
chk T8_rb_879f "$(q 'select conversion_to_base from public.products where id=696')" 0.02
chk T9_rb_879o "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2289')" 320.000
# guard: drifted value is not overwritten
q "update public.rm_bom_header set reference_output_qty=30000 where id=2283" >/dev/null
sed 's/^rollback;  -- change to COMMIT.*/commit;/' $D/AU2C_PROPOSED_CHANGES.sql | $P >/dev/null
chk T10_guard_drift "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2283')" 30000.000
# default file ends in ROLLBACK: no effect
q "update public.rm_bom_header set reference_output_qty=28039 where id=2283" >/dev/null
$P -f $D/AU2C_PROPOSED_CHANGES.sql >/dev/null
chk T11_default_rollback "$(q 'select reference_output_qty::numeric(12,3) from public.rm_bom_header where id=2283')" 28039.000
# run-in-progress preflight
q "set session_replication_role=replica; insert into costing.costing_refresh_run(id,period_start,valuation_date,overall_status,period_status_at_request,valuation_date_status_at_request,valuation_context_source,valuation_context_captured_at) values (999001,'2026-10-01','2026-10-10','RUNNING','OPEN','DRAFT','CAPTURED_AT_REQUEST',now())" >/dev/null
if $P -f $D/AU2C_PROPOSED_CHANGES.sql >/dev/null 2>&1; then r=applied; else r=refused; fi
q "set session_replication_role=replica; delete from costing.costing_refresh_run where id=999001" >/dev/null
chk T12_preflight_running "$r" refused
$P -c "set session_replication_role=replica; delete from public.rm_bom_header where id in (2283,2289,2379); delete from public.products where id in (678,696,1038);"
echo "AU-2c: $pass pass, $fail fail"; [ $fail -eq 0 ]
