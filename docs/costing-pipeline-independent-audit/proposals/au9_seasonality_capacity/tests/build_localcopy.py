import json
j=json.load(open('live_copy.json')); cap=json.load(open('cap128.json')); cost=json.load(open('cost128.json'))
q=lambda v: 'null' if v is None else ("'"+str(v).replace("'","''")+"'")
L=[]
L.append("""
do $$ begin
 if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create schema extensions; create extension btree_gist schema extensions;
create schema costing; grant usage on schema costing to authenticated, service_role;
create table public.sections(id int primary key); create table public.subsections(id int primary key); create table public.areas(id int primary key);
create table public.machine_types(id serial primary key, name text not null unique);
create table public.plant_machinery(id serial primary key, section_id int not null references sections(id) on delete cascade,
 subsection_id int not null references subsections(id) on delete cascade, area_id int not null references areas(id) on delete cascade,
 plant_name text not null, status char(1) not null check (status = any (array['O'::bpchar,'N'::bpchar])),
 type_id int not null references machine_types(id) on delete cascade,
 constraint plant_machinery_unique_sec_subsec_area_name_type unique (section_id, subsection_id, area_id, plant_name, type_id));
create table costing.production_resource_class(code text primary key, label text not null, description text not null, is_active boolean not null default true, sort_order int not null default 100, created_at timestamptz not null default now());
create table costing.route_equipment_load_capacity(id bigint primary key, equipment_class_code text not null, equipment_class_label text not null,
 resource_class_code text not null references costing.production_resource_class(code), load_basis text not null check (load_basis in ('WEIGHT','FIXED')),
 charge_basis text check (charge_basis in ('SOLID','OUTPUT')), capacity_kg numeric check (capacity_kg>0), capacity_l numeric check (capacity_l>0),
 is_resource_class_default boolean not null default false, is_provisional boolean not null default true, source_note text not null, approval_reference text not null,
 effective_from date not null check (effective_from >= '2026-10-01'), effective_to date, created_at timestamptz not null default now(), created_by text,
 check (effective_to is null or effective_to >= effective_from),
 check ((load_basis='FIXED' and charge_basis is null and capacity_kg is null and capacity_l is null) or (load_basis='WEIGHT' and charge_basis is not null and coalesce(capacity_kg,capacity_l) is not null)),
 unique (equipment_class_code, effective_from));
grant select on costing.route_equipment_load_capacity to authenticated;
""")
L.append("insert into public.sections values "+",".join(f"({i})" for i in j['sec'])+";")
L.append("insert into public.subsections values "+",".join(f"({i})" for i in j['sub'])+";")
L.append("insert into public.areas values "+",".join(f"({i})" for i in j['area'])+";")
L.append("insert into public.machine_types(id,name) values "+",".join(f"({m['id']},{q(m['name'])})" for m in j['mt'])+";")
L.append("insert into public.plant_machinery(id,section_id,subsection_id,area_id,plant_name,status,type_id) values "+",".join(f"({p['id']},{p['section_id']},{p['subsection_id']},{p['area_id']},{q(p['plant_name'])},{q(p['status'])},{p['type_id']})" for p in j['pm'])+";")
L.append("insert into costing.production_resource_class(code,label,description,is_active,sort_order) values "+",".join(f"({q(r['code'])},{q(r['label'])},{q(r['description'])},{str(r['is_active']).lower()},{r['sort_order']})" for r in j['prc'])+";")
cols=['id','equipment_class_code','equipment_class_label','resource_class_code','load_basis','charge_basis','capacity_kg','capacity_l','is_resource_class_default','is_provisional','source_note','approval_reference','effective_from','effective_to','created_by']
L.append("insert into costing.route_equipment_load_capacity("+",".join(cols)+") values "+",".join("("+",".join(q(r[c]) if not isinstance(r[c],bool) else str(r[c]).lower() for c in cols)+")" for r in j['relc'])+";")
L.append(j['fn']+";")
L.append("""create or replace function costing.fn_costing_run_scoped_tables() returns setof text language sql stable set search_path to 'costing','public','pg_temp' as $f$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='costing' and c.relkind='r' and c.relname like '%snapshot%'
    and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='refresh_run_id' and not a.attisdropped)
  order by 1 $f$;
create or replace function costing.fn_compute_run_fingerprint(p_refresh_run_id bigint) returns jsonb language plpgsql stable set search_path to 'costing','public','pg_temp' as $f$
declare t text; v_n bigint; v_h text; v jsonb := '{}'::jsonb;
begin
  for t in select * from costing.fn_costing_run_scoped_tables() loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from costing.%I x where x.refresh_run_id = $1', '|', '', t)
      into v_n, v_h using p_refresh_run_id;
    if v_n > 0 then v := v || jsonb_build_object(t, jsonb_build_object('rows', v_n, 'md5', v_h)); end if;
  end loop;
  return v;
end $f$;""")
# run-scoped snapshot copies (run 128 actual extract; run 122 rows are a stand-in copy of the 128 cost rows)
L.append("create table costing.route_load_scaling_snapshot(id bigserial primary key, refresh_run_id bigint not null, allocation_pool text, product_id bigint, solid_charge_kg numeric, output_charge numeric, output_charge_uom text, raw_factor numeric, scaled_factor numeric);")
L.append("insert into costing.route_load_scaling_snapshot(refresh_run_id,allocation_pool,product_id,solid_charge_kg,output_charge,output_charge_uom,raw_factor,scaled_factor) values "+",".join(f"(128,{q(x['pool'])},{x['p']},{q(x['s'])},{q(x['o'])},{q(x['ou'])},{q(x['raw'])},{q(x['sc'])})" for x in cap['scal'])+";")
L.append("create table costing.route_step_factor_snapshot(id bigserial primary key, refresh_run_id bigint not null, allocation_pool text, product_id bigint, resource_class_code text, step_factor numeric);")
vals=[f"(128,'PRODUCTION_OVERHEAD',{x['p']},{q(x['rc'])},{q(x['f'])})" for x in cap['poh']]+[f"(128,'MANUFACTURING_LABOUR',{x['p']},{q(x['rc'])},{q(x['f'])})" for x in cap['dl']]
L.append("insert into costing.route_step_factor_snapshot(refresh_run_id,allocation_pool,product_id,resource_class_code,step_factor) values "+",".join(vals)+";")
L.append("create table costing.sku_cost_snapshot(id bigserial primary key, refresh_run_id bigint not null, sku_id bigint, cop numeric, dl numeric, poh numeric, qc numeric, ms numeric);")
L.append("insert into costing.sku_cost_snapshot(refresh_run_id,sku_id,cop,dl,poh,qc,ms) values "+",".join(f"({r},{c['sku_id']},{q(c['cop'])},{q(c['dl'])},{q(c['poh'])},{q(c['qc'])},{q(c['ms'])})" for r in (122,128) for c in cost)+";")
# simple guard like live: approved run rows immutable
L.append("""create function costing.fn_local_guard_designated() returns trigger language plpgsql as $f$ begin
 if old.refresh_run_id in (122,128) then raise exception 'designated run % rows are immutable', old.refresh_run_id; end if; return coalesce(new,old); end $f$;
create trigger g before update or delete on costing.route_load_scaling_snapshot for each row execute function costing.fn_local_guard_designated();
create trigger g before update or delete on costing.sku_cost_snapshot for each row execute function costing.fn_local_guard_designated();
create trigger g before update or delete on costing.route_step_factor_snapshot for each row execute function costing.fn_local_guard_designated();""")
open('localcopy.sql','w').write("\n".join(L))
print('ok')
