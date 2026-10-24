import json,re
cols=json.load(open('cols.json'))
d=json.load(open('run126.json'))
out=["drop schema if exists costing cascade; create schema costing;",
"do $$ begin create role anon; exception when others then null; end $$; do $$ begin create role authenticated; exception when others then null; end $$;"]
for t,c in cols.items():
    out.append(f"create table costing.{t} ({c});")
cons=open('cons.sql').read()
out.append(cons)
out.append(open('guards.sql').read())
out.append("create table costing.demand_fixture(refresh_run_id bigint, product_id bigint, product_name text, product_base_uom text, commercial_base_qty numeric, internal_base_qty numeric, total_manufacturing_base_qty numeric, monthly_driver_status text, commercial_recipient_sku_count int, demand_source text, demand_note text, internal_evidence_json jsonb);")
out.append("""create function costing.fn_total_manufacturing_product_demand_as_of(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
returns table(product_id bigint, product_name text, product_base_uom text, commercial_base_qty numeric, internal_base_qty numeric, total_manufacturing_base_qty numeric, monthly_driver_status text, commercial_recipient_sku_count int, demand_source text, demand_note text, internal_evidence_json jsonb)
language sql stable as $$ select f.product_id, f.product_name, f.product_base_uom, f.commercial_base_qty, f.internal_base_qty, f.total_manufacturing_base_qty, f.monthly_driver_status, f.commercial_recipient_sku_count, f.demand_source, f.demand_note, f.internal_evidence_json from costing.demand_fixture f where f.refresh_run_id=p_refresh_run_id $$;""")
open('fixture_ddl.sql','w').write('\n'.join(out))
m={'run':'costing_refresh_run','pool':'cost_pool_monthly_snapshot','qcw':'product_qc_workload_snapshot','poh':'product_production_overhead_workload_snapshot','basis':'sku_sales_allocation_basis_snapshot'}
L=[]
for k,t in m.items():
    L.append(f"insert into costing.{t} select * from jsonb_populate_recordset(null::costing.{t}, $J${json.dumps(d[k])}$J$::jsonb);")
dem=[dict(x,refresh_run_id=126) for x in d['dem']]
L.append(f"insert into costing.demand_fixture select * from jsonb_populate_recordset(null::costing.demand_fixture, $J${json.dumps(dem)}$J$::jsonb);")
L.append(f"create table costing.live_qca as select * from jsonb_populate_recordset(null::costing.product_qc_allocation_snapshot, $J${json.dumps(d['qca'])}$J$::jsonb);")
L.append(f"create table costing.live_sqa as select * from jsonb_populate_recordset(null::costing.sku_qc_allocation_snapshot, $J${json.dumps(d['sqa'])}$J$::jsonb);")
open('fixture_data.sql','w').write('\n'.join(L))
