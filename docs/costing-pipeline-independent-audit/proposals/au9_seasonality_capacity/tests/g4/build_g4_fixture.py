# Local-only fixture for AU-9 G4 tests: route-step lineage of run 128, activities, refresh runs,
# run-128 workloads/pools and the two live refresh RPC definitions (read-only extracts of 18 Oct 2026).
import json
d=json.load(open('steps128.json')); pw=json.load(open('pools128.json'))
q=lambda v: 'null' if v is None else ("'"+str(v).replace("'","''")+"'")
L=["""
create table if not exists public.activities(id integer primary key, activity_name text not null, area_id integer, sub_section_id integer);
create table if not exists costing.production_route_family_route_step(id bigint primary key, plant_id integer, activity_id integer, area_id integer, subsection_id integer, resource_class_code text);
create table if not exists costing.product_process_route_override(id bigint primary key, operation_type text, plant_id integer, activity_id integer, area_id integer, subsection_id integer, resource_class_code text);
create table if not exists costing.costing_refresh_run(id bigint primary key, period_start date not null, valuation_date date not null, overall_status text not null);
create table if not exists costing.local_step_evidence(id bigserial primary key, allocation_pool text, product_id bigint, effective_step_key text, sequence_no numeric, source_type text,
  base_step_id bigint, override_id bigint, activity_id integer, resource_class_code text, step_factor numeric);
create table if not exists costing.local_product_workload(allocation_pool text, product_id bigint, workload_units numeric, workload_status text, primary key(allocation_pool, product_id));
create table if not exists costing.production_overhead_workload_policy(id bigint primary key); -- local stub for %rowtype only
create table if not exists costing.direct_labour_workload_policy(id bigint primary key); -- local stub for %rowtype only
create table if not exists costing.local_pool(allocation_pool text primary key, pool_amount numeric);
"""]
L.append("insert into public.activities values "+",".join(f"({a['id']},{q(a['name'])},{q(a['area'])},{q(a['sub'])})" for a in d['act'])+" on conflict do nothing;")
L.append("insert into costing.production_route_family_route_step values "+",".join(f"({b['id']},{q(b['plant'])},{q(b['a'])},{q(b['area'])},{q(b['sub'])},{q(b['rc'])})" for b in d['base'])+" on conflict do nothing;")
L.append("insert into costing.product_process_route_override values "+",".join(f"({o['id']},{q(o['op'])},{q(o['plant'])},{q(o['a'])},{q(o['area'])},{q(o['sub'])},{q(o['rc'])})" for o in d['ovr'])+" on conflict do nothing;")
L.append("insert into costing.costing_refresh_run values (122,'2026-09-01','2026-09-10','SUCCESS'),(128,'2026-10-01','2026-10-16','SUCCESS'),(9001,'2026-11-01','2026-11-30','LOCAL_SIMULATION_NON_DESIGNATED') on conflict do nothing;")
B={b['id']:b for b in d['base']}; O={o['id']:o for o in d['ovr']}
pm={(s['p'],s['k']):s for s in d['poh']}
rows=[]
for s in d['poh']:
    a=(O[s['o']]['a'] if s['o'] and O[s['o']]['a'] is not None else (B[s['b']]['a'] if s['b'] else None))
    rows.append(('PRODUCTION_OVERHEAD',s['p'],s['k'],s['seq'],s['src'],s['b'],s['o'],a,s['rc'],s['f']))
for s in d['dl']:
    m=pm.get((s['p'],s['k']))
    rows.append(('MANUFACTURING_LABOUR',s['p'],s['k'],s['seq'],s['src'],m['b'] if m else None,m['o'] if m else None,s['a'],s['rc'],s['f']))
L.append("truncate costing.local_step_evidence;")
for i in range(0,len(rows),2000):
    L.append("insert into costing.local_step_evidence(allocation_pool,product_id,effective_step_key,sequence_no,source_type,base_step_id,override_id,activity_id,resource_class_code,step_factor) values "+
             ",".join("("+",".join(q(v) for v in r)+")" for r in rows[i:i+2000])+";")
L.append("truncate costing.local_product_workload; truncate costing.local_pool;")
L.append("insert into costing.local_product_workload values "+",".join(f"('PRODUCTION_OVERHEAD',{x['p']},{q(x['wl'])},{q(x['st'])})" for x in pw['poh_wl'])+","+
         ",".join(f"('MANUFACTURING_LABOUR',{x['p']},{q(x['wl'])},{q(x['st'])})" for x in pw['dl_wl'])+";")
pools={x['pool']:x['amt'] for x in pw['pools']}
L.append(f"insert into costing.local_pool values ('PRODUCTION_OVERHEAD',{q(pools['PRODUCTION_OVERHEAD'])}),('MANUFACTURING_LABOUR',{q(pw['dl_wl'][0]['pool'])});")
for k in ('poh','dl'):
    L.append(open(f'def_{k}_refresh.sql').read().rstrip()+";")
L.append("revoke all on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint), costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint) from public;")
open('g4/g4_fixture.sql','w').write("\n".join(L)+"\n")
print('fixture rows',len(rows))
