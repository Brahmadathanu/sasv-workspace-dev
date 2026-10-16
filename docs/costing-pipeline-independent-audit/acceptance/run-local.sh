#!/usr/bin/env bash
# Reproducible local test (box PG17 copy, port 54329). Never targets live.
set -euo pipefail; cd "$(dirname "$0")/.."
P="psql -h /tmp -p 54329 -U postgres -d costing_local -At -v ON_ERROR_STOP=1"
SEED=${SEED:-acceptance/heads_seed_2026-10-16.json}
$P -c "select 1 from costing.expense_head_costing_map limit 1" >/dev/null
if [ "$($P -c 'select count(*) from costing.expense_head_costing_map')" = 0 ]; then
  python3 -c "
import json;q=lambda s:\"'\"+str(s).replace(\"'\",\"''\")+\"'\"
for h in json.load(open('$SEED')): print(f\"insert into costing.expense_head_costing_map(expense_group,head_name,allocation_pool,include_in_costing,is_active) values({q(h['g'])},{q(h['h'])},{q(h['pool'])},{h['inc']},true);\")" | $P -q; fi
pass(){ echo "PASS $1"; }; fail(){ echo "FAIL $1"; exit 1; }
$P -q -f proposals/cost_head_policy_ledger.sql
[ "$($P -c 'select count(*) from costing.cost_head_policy_ledger')" = 52 ] && pass L1_apply_52_heads || fail L1
$P -q -f proposals/cost_head_policy_ledger.sql
[ "$($P -c 'select count(*) from costing.cost_head_policy_ledger')" = 52 ] && pass L2_reapply_idempotent || fail L2
$P -c "insert into costing.cost_head_policy_ledger(expense_group,head_name,allocation_pool,policy_status,normal_monthly_amount,basis,evidence_ref,effective_from) values('Direct Expenses','Fuel & Gas (DE)','PRODUCTION_OVERHEAD','APPROVED',1,'x','x','2026-10-01')" >/dev/null 2>&1 && fail L3 || pass L3_second_open_row_rejected
$P -c "insert into costing.cost_head_policy_ledger(expense_group,head_name,allocation_pool,policy_status,normal_monthly_amount,basis,evidence_ref,effective_from,effective_to) values('Indirect Expenses','Fine & Penalty','EXCLUDED','EXCLUDED',5,'x','x','2025-04-01','2026-03-31')" >/dev/null 2>&1 && fail L4 || pass L4_excluded_nonzero_rejected
$P -v run_id=0 -f acceptance/policy_ledger_checks.sql | sed 's/^/CHECK /'
$P -q -c "begin; drop view if exists costing.v_cost_head_policy_reconciliation; drop table if exists costing.cost_head_policy_ledger; commit;"
[ -z "$($P -c "select to_regclass('costing.cost_head_policy_ledger')")" ] && pass L5_rollback_clean || fail L5
