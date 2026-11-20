#!/usr/bin/env bash
# Extracts the REAL original view DDL from the W1 migration and the REAL scoped-RPC body from the design file
# (no hand copy => no drift), strips guards that need production objects, and prints SQL for the local fixture.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql"
RPC="$ROOT/docs/master-data-costing/evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql"
# costing governed view (inner) + public wrapper
python3 - "$MIG" <<'PY'
import sys,re
t=open(sys.argv[1],encoding='utf-8').read().replace('\r\n','\n')
a=t.index('create or replace view costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed as')
b=t.index(';\n',a)+2
print(t[a:b])
c=t.index('create or replace view public.v_cost_sheet_snapshot_sku_monthly_comparison_governed as')
d=t.index(';\n',c)+2
print(t[c:d])
PY
# RPC: drop transaction wrapper, hash guard DO block and grants; keep function verbatim
python3 - "$RPC" <<'PY'
import sys
t=open(sys.argv[1],encoding='utf-8').read().replace('\r\n','\n')
a=t.index('CREATE OR REPLACE FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped')
b=t.index('$csr$;\n',t.index('AS $csr$'))+len('$csr$;\n')
print(t[a:b])
PY
