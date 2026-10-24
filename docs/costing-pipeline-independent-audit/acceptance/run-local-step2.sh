#!/usr/bin/env bash
# Step 2 local test: ledger + engine link, switch OFF/ON, idempotency, rollback. Box PG17 copy only.
set -euo pipefail; cd "$(dirname "$0")/.."
P="psql -h /tmp -p 54329 -U postgres -d costing_local -At -q -v ON_ERROR_STOP=1"
pass=0; fail=0; chk(){ if [ "$2" = "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 got=[$2] want=[$3]"; fail=$((fail+1)); fi; }
SEED=acceptance/heads_seed_2026-10-16.json
# fixtures: map + FY25-26 year-end Tally snapshot (live values) + live engine view bodies
$P -c "delete from costing.expense_head_costing_map; delete from tally_expenses_snapshot where source_key='AU4TEST';"
python3 - "$SEED" <<'PY' | $P
import json,sys;q=lambda s:"'"+str(s).replace("'","''")+"'"
for h in json.load(open(sys.argv[1])):
  print(f"insert into costing.expense_head_costing_map(expense_group,head_name,allocation_pool,include_in_costing,is_active) values({q(h['g'])},{q(h['h'])},{q(h['pool'])},{h['inc']},true);")
  print(f"insert into tally_expenses_snapshot(as_of_date,expense_group,head_name,net_cb_value,source_key) values('2026-03-31',{q(h['g'])},{q(h['h'])},{h['v25'] or 0},'AU4TEST');")
PY
$P -f acceptance/local_fixture_provision_view.sql; $P -f acceptance/local_fixture_combined_orig.sql
Q="select allocation_pool||'='||round(expense_provision_amount,2) from costing.v_cost_pool_monthly_combined where period_start='2026-09-01' and expense_provision_amount<>0 order by 1"
BASE=$($P -c "$Q")
$P -f proposals/cost_head_policy_ledger.sql 2>/dev/null; $P -f proposals/cost_head_policy_engine_link.sql
chk S1_switch_off_identical "$($P -c "$Q")" "$BASE"
$P -f proposals/cost_head_policy_engine_link.sql
chk S2_reapply_idempotent "$($P -c "$Q")" "$BASE"
chk S3_default_off "$($P -c 'select is_enabled from costing.cost_head_policy_switch')" f
$P -c "update costing.cost_head_policy_switch set is_enabled=true"
chk S4_on_interest_excluded "$($P -c "select round(standard_monthly_provision,2) from costing.v_expense_head_monthly_provision_policy where period_start='2026-09-01' and head_name='Interest Paid'")" 0.00
chk S4b_pool_equals_policy_sum "$($P -c "select count(*) from costing.v_cost_pool_monthly_combined c left join (select allocation_pool,sum(standard_monthly_provision) s from costing.v_expense_head_monthly_provision_policy where period_start='2026-09-01' group by 1) p using(allocation_pool) where c.period_start='2026-09-01' and abs(c.expense_provision_amount-coalesce(p.s,0))>0.01")" 0
chk S5_on_ledger_governs "$($P -c "select count(*) from costing.v_expense_head_monthly_provision_policy v join costing.cost_head_policy_ledger l using(expense_group,head_name) where v.period_start='2026-09-01' and l.policy_status in ('APPROVED','PROVISIONAL') and l.allocation_pool<>'MATERIAL_LANDED_COST' and v.standard_monthly_provision<>l.normal_monthly_amount")" 0
chk S6_on_central_office_engine "$($P -c "select round(standard_monthly_provision,2) from costing.v_expense_head_monthly_provision_policy where period_start='2026-09-01' and head_name='Central Office Charges'")" 871972.83
chk S7_on_carriage_not_dropped "$($P -c "select allocation_pool||'='||round(standard_monthly_provision,2) from costing.v_expense_head_monthly_provision_policy where period_start='2026-09-01' and head_name='Carriage Inward (DE)'")" "MATERIALS_STORES_OVERHEAD=50132.50"
chk S8_on_fuel_approved "$($P -c "select round(standard_monthly_provision,2) from costing.v_expense_head_monthly_provision_policy where period_start='2026-09-01' and head_name='Fuel & Gas (DE)'")" 161969.07
$P -c "update costing.cost_head_policy_switch set is_enabled=false"
chk S9_off_again_identical "$($P -c "$Q")" "$BASE"
$P -v run_id=0 -f acceptance/policy_ledger_checks.sql | sed 's/^/CHECK /'
$P -f proposals/cost_head_policy_engine_link_ROLLBACK.sql
chk S10_rollback_engine_identical "$($P -c "$Q")" "$BASE"
chk S11_rollback_objects_gone "$($P -c "select coalesce(to_regclass('costing.v_expense_head_monthly_provision_policy')::text,'')||coalesce(to_regclass('costing.cost_head_policy_switch')::text,'')")" ""
$P -c "drop view if exists costing.v_cost_head_policy_reconciliation; drop table if exists costing.cost_head_policy_ledger;"
$P -c "delete from tally_expenses_snapshot where source_key='AU4TEST'; delete from costing.expense_head_costing_map;"
echo "STEP2: $pass pass, $fail fail"; [ $fail -eq 0 ]
