// WP10 classification SELECT hardening - disposable PostgreSQL fixture. Throw-away LOCAL cluster only (unix socket, temp dir); never Supabase, never a network DB.
// PROVENANCE (all STAND-INS; nothing here is live evidence):
//  - Starting state = production "Stage A": four tables, RLS on (not forced), identity-only read policy, View AND Edit write policies, original authenticated DML grants
//    (shape taken from the Stage A apply script, PR #477 / docs/master-data-costing/WP10_FOUR_MASTER_STAGE_A_UNAPPLIED_SQL/02_stage_a_apply.sql).
//  - public.app_has_permission / require_permission / user_permissions_canonical: stand-ins mirroring the documented live shape (invoker wrapper reads auth.uid(),
//    SECURITY DEFINER core reads the canonical table; require_permission(target, true) needs can_view AND can_edit).
//  - Representative readers are stand-ins: products table, invoker views (v_product_details, v_stock_checker, bottled_stock_on_hand, v_costing_scheme_policy_scope_options),
//    a definer view with and without its own predicate, a SECURITY DEFINER route RPC that checks its own module permission, an invoker helper function.
//  - Owner fx_owner is NON-superuser without BYPASSRLS (like live: the owner bypasses only through table ownership). PostgreSQL 16 locally/CI vs 17.4 live.
//  - Real JWT / PostgREST / Supabase auth are NOT exercised; "denied" for SELECT shows as zero rows (RLS filtering), exactly as PostgREST would return 200 + [].
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCluster, pgAvailable } from '../wp08-g2-0-shared-master-data/pg-harness.mjs';

export { startCluster, pgAvailable };
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SQL_DIR = path.join(root, 'docs/master-data-costing/WP10_CLASSIFICATION_SELECT_HARDENING_UNAPPLIED_SQL');
export const sqlFile = n => fs.readFileSync(path.join(SQL_DIR, n), 'utf8');
export const FILES = { pre: '01_preflight_readonly.sql', apply: '02_apply_provisioned_read_gate.sql', post: '03_postflight_readonly.sql', coverage: '04_coverage_readonly.sql', rollback: '99_rollback.sql' };
export const TABLES = ['categories', 'sub_categories', 'product_groups', 'sub_groups'];
const U = n => `00000000-0000-0000-0000-0000000000${n}`;
export const ACTORS = {
  editorAll: U('a1'),        // View+Edit on all four classification modules (legacy direct writers)
  viewer: U('b1'),           // View only on all four
  noAccess: U('c1'),         // authenticated identity with NO canonical rows at all
  denyAll: U('c2'),          // canonical rows exist but all false/false (explicit deny everywhere)
  editNoView: U('d1'),       // anomalous: edit true, view false on the four modules (no other grant)
  stockOnly: U('e1'),        // only module:stock-checker view
  logOnly: U('e2'),          // only module:add-log-entry view (Electron daily work log)
  bmrOnly: U('e3'),          // only module:manage-bmr view
  costingOnly: U('e4'),      // only module:pricing-policy-manager view
  routeOnly: U('e5'),        // only module:production-route-manager view
  productsOnly: U('e6')      // only module:manage-products view
};
export const READERS = ['stockOnly', 'logOnly', 'bmrOnly', 'costingOnly', 'routeOnly', 'productsOnly'];
const CLASS_TARGETS = ['module:manage-categories', 'module:manage-subcategories', 'module:manage-product-groups', 'module:manage-subgroups'];

function permRows() {
  const rows = [];
  for (const t of CLASS_TARGETS) { rows.push(`('${ACTORS.editorAll}','${t}',true,true)`); rows.push(`('${ACTORS.viewer}','${t}',true,false)`); rows.push(`('${ACTORS.editNoView}','${t}',false,true)`); }
  rows.push(`('${ACTORS.denyAll}','module:manage-categories',false,false)`);
  rows.push(`('${ACTORS.denyAll}','module:stock-checker',false,false)`);
  rows.push(`('${ACTORS.stockOnly}','module:stock-checker',true,false)`);
  rows.push(`('${ACTORS.logOnly}','module:add-log-entry',true,false)`);
  rows.push(`('${ACTORS.bmrOnly}','module:manage-bmr',true,false)`);
  rows.push(`('${ACTORS.costingOnly}','module:pricing-policy-manager',true,false)`);
  rows.push(`('${ACTORS.routeOnly}','module:production-route-manager',true,false)`);
  rows.push(`('${ACTORS.productsOnly}','module:manage-products',true,false)`);
  return rows.join(',\n ');
}

function rpc(name, args, target, body) {
  return `create function public.${name}(${args}) returns void language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.require_permission('${target}', true); ${body}; end $$;
alter function public.${name}(${args}) owner to fx_owner; revoke all on function public.${name}(${args}) from public; grant execute on function public.${name}(${args}) to authenticated;\n`;
}

/** production "Stage A" state plus representative readers, with synthetic rows only */
export function fixtureSql() {
  return `
set client_min_messages = warning;
do $$ declare r text; begin foreach r in array array['anon','authenticated','service_role','fx_owner'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if; end loop; end $$;
grant all on schema public to fx_owner; grant usage on schema public to authenticated, anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users(id uuid primary key, last_sign_in_at timestamptz);
grant usage on schema auth to authenticated, fx_owner;
create table public.user_permissions_canonical(user_id uuid, target text, can_view boolean, can_edit boolean); alter table public.user_permissions_canonical owner to fx_owner;
create function public.app_has_permission_core(p_uid uuid, p_target text, p_mode text) returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if lower(p_mode) not in ('view','edit') then raise exception 'invalid mode %', p_mode; end if;
  return coalesce((select case lower(p_mode) when 'view' then c.can_view else c.can_edit end from public.user_permissions_canonical c where c.user_id = p_uid and c.target = p_target), false); end $$;
alter function public.app_has_permission_core(uuid,text,text) owner to fx_owner; revoke all on function public.app_has_permission_core(uuid,text,text) from public; grant execute on function public.app_has_permission_core(uuid,text,text) to authenticated, fx_owner;
create function public.app_has_permission(p_target text, p_mode text) returns boolean language plpgsql stable as $$
declare v uuid := auth.uid(); begin if v is null then return false; end if; return public.app_has_permission_core(v, p_target, p_mode); end $$;
revoke all on function public.app_has_permission(text,text) from public; grant execute on function public.app_has_permission(text,text) to authenticated, fx_owner;
create function public.require_permission(p_target text, p_edit boolean) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin if not (public.app_has_permission(p_target, 'view') and (not p_edit or public.app_has_permission(p_target, 'edit'))) then raise exception 'Permission denied for %', p_target using errcode = '42501'; end if; end $$;
alter function public.require_permission(text,boolean) owner to fx_owner; revoke all on function public.require_permission(text,boolean) from public; grant execute on function public.require_permission(text,boolean) to authenticated, fx_owner;

create table public.categories(id serial primary key, category_name text not null unique);
create table public.sub_categories(id serial primary key, subcategory_name text not null, category_id int not null references public.categories(id));
create table public.product_groups(id serial primary key, group_name text not null, sub_category_id int not null references public.sub_categories(id), kind_id int default 1);
create table public.sub_groups(id serial primary key, sub_group_name text not null, product_group_id int not null references public.product_groups(id));
create table public.products(id serial primary key, item text, sub_group_id int references public.sub_groups(id));
alter table public.categories owner to fx_owner; alter table public.sub_categories owner to fx_owner; alter table public.product_groups owner to fx_owner; alter table public.sub_groups owner to fx_owner; alter table public.products owner to fx_owner;
alter sequence categories_id_seq owner to fx_owner; alter sequence sub_categories_id_seq owner to fx_owner; alter sequence product_groups_id_seq owner to fx_owner; alter sequence sub_groups_id_seq owner to fx_owner; alter sequence products_id_seq owner to fx_owner;
grant usage on all sequences in schema public to authenticated;
alter table public.categories enable row level security; alter table public.sub_categories enable row level security; alter table public.product_groups enable row level security; alter table public.sub_groups enable row level security;
revoke all privileges on table public.categories, public.sub_categories, public.product_groups, public.sub_groups from anon, authenticated;
grant select, insert, update, delete on table public.categories, public.sub_categories, public.product_groups, public.sub_groups to authenticated;
-- Stage A policies (identity-only read; View AND Edit writes)
${TABLES.map(t => {
    const target = { categories: 'module:manage-categories', sub_categories: 'module:manage-subcategories', product_groups: 'module:manage-product-groups', sub_groups: 'module:manage-subgroups' }[t];
    const gate = `(select public.app_has_permission('${target}', 'view')) and (select public.app_has_permission('${target}', 'edit'))`;
    return `create policy ${t}_authenticated_read on public.${t} for select to authenticated using ((select auth.uid()) is not null);
create policy ${t}_authenticated_insert on public.${t} for insert to authenticated with check (${gate});
create policy ${t}_authenticated_update on public.${t} for update to authenticated using (${gate}) with check (${gate});
create policy ${t}_authenticated_delete on public.${t} for delete to authenticated using (${gate});`;
  }).join('\n')}
-- synthetic rows only
insert into public.categories(id, category_name) values (1,'C1'),(2,'C2'),(3,'C3'); select setval('categories_id_seq', 10);
insert into public.sub_categories(id, subcategory_name, category_id) values (1,'S1',1),(2,'S2',1),(3,'S3',1); select setval('sub_categories_id_seq', 10);
insert into public.product_groups(id, group_name, sub_category_id) values (1,'G1',1),(2,'G2',1),(3,'G3',1); select setval('product_groups_id_seq', 10);
insert into public.sub_groups(id, sub_group_name, product_group_id) values (1,'SG1',1),(2,'SG2',1),(3,'SG3',1); select setval('sub_groups_id_seq', 10);
insert into public.products(id, item, sub_group_id) values (1,'P1',1),(2,'P2',2);
insert into public.user_permissions_canonical values
 ${permRows()};
insert into auth.users(id, last_sign_in_at) values
 ${Object.values(ACTORS).map((id, i) => `('${id}', ${i % 3 === 0 ? 'null' : i % 3 === 1 ? "now() - interval '5 days'" : "now() - interval '200 days'"})`).join(',\n ')};
-- representative readers (invoker views mirror the six live security_invoker dependents; definer objects mirror the others)
create view public.v_product_details with (security_invoker = true) as
  select p.id, p.item, sg.sub_group_name, pg.group_name, sc.subcategory_name, c.category_name
  from public.products p join public.sub_groups sg on sg.id = p.sub_group_id join public.product_groups pg on pg.id = sg.product_group_id
  join public.sub_categories sc on sc.id = pg.sub_category_id join public.categories c on c.id = sc.category_id;
create view public.v_stock_checker with (security_invoker = true) as select p.id, pg.group_name from public.products p join public.sub_groups sg on sg.id = p.sub_group_id join public.product_groups pg on pg.id = sg.product_group_id;
create view public.bottled_stock_on_hand with (security_invoker = true) as select p.id, c.category_name from public.products p join public.sub_groups sg on sg.id = p.sub_group_id join public.product_groups pg on pg.id = sg.product_group_id join public.sub_categories sc on sc.id = pg.sub_category_id join public.categories c on c.id = sc.category_id;
create view public.v_costing_scheme_policy_scope_options with (security_invoker = true) as select sc.id, sc.subcategory_name, c.category_name from public.sub_categories sc join public.categories c on c.id = sc.category_id;
create view public.v_definer_no_predicate as select id, category_name from public.categories;
create view public.v_definer_with_predicate as select id, category_name from public.categories where public.app_has_permission('module:pricing-policy-manager', 'view');
create function public.rpc_get_production_route_master_options() returns setof text language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public.require_permission('module:production-route-manager', false); return query select g.group_name from public.product_groups g order by g.id; end $$;
create function public.fn_product_group_id_for_product(p_id int) returns int language sql stable as $$ select sg.product_group_id from public.sub_groups sg join public.products p on p.sub_group_id = sg.id where p.id = p_id $$;
alter view public.v_definer_no_predicate owner to fx_owner; alter view public.v_definer_with_predicate owner to fx_owner;
alter view public.v_product_details owner to fx_owner; alter view public.v_stock_checker owner to fx_owner; alter view public.bottled_stock_on_hand owner to fx_owner; alter view public.v_costing_scheme_policy_scope_options owner to fx_owner;
alter function public.rpc_get_production_route_master_options() owner to fx_owner; alter function public.fn_product_group_id_for_product(int) owner to fx_owner;
revoke all on function public.rpc_get_production_route_master_options() from public; grant execute on function public.rpc_get_production_route_master_options() to authenticated;
revoke all on function public.fn_product_group_id_for_product(int) from public; grant execute on function public.fn_product_group_id_for_product(int) to authenticated;
grant select on public.products, public.v_product_details, public.v_stock_checker, public.bottled_stock_on_hand, public.v_costing_scheme_policy_scope_options, public.v_definer_no_predicate, public.v_definer_with_predicate to authenticated;
` + rpc('rpc_wp10_create_category', 'p_name text', 'module:manage-categories', 'insert into public.categories(category_name) values (p_name)')
  + rpc('rpc_wp10_rename_category', 'p_id int, p_name text', 'module:manage-categories', 'update public.categories set category_name = p_name where id = p_id')
  + rpc('rpc_wp10_delete_category', 'p_id int', 'module:manage-categories', 'delete from public.categories where id = p_id');
}

export const newFixture = cluster => { const db = cluster.newDb(); cluster.sql(db, fixtureSql()); return db; };

/** run one statement as an authenticated actor (real SET ROLE authenticated; uid via the GUC Supabase uses) */
export function as(cluster, db, actor, statement) {
  const uid = actor == null ? '' : ACTORS[actor] ?? actor;
  const r = cluster.script(db, `set role authenticated;\nselect set_config('request.jwt.claim.sub', '${uid}', false);\n${statement};\n`, { stopOnError: true });
  const lines = r.out.trim().split('\n').filter(Boolean);
  return { ok: r.code === 0, out: lines[lines.length - 1] ?? '', err: r.err.trim() };
}
/** SELECT count(*) as actor: a number, or "DENIED" for privilege errors */
export function count(cluster, db, actor, relation) {
  const r = as(cluster, db, actor, `select count(*) from ${relation}`);
  if (!r.ok) return /permission denied|42501/i.test(r.err) ? 'DENIED' : 'ERR:' + r.err.split('\n')[0];
  return Number(r.out);
}
/** DML as actor: affected-row count, "DENIED" (RLS/privilege) or ERR */
export function dml(cluster, db, actor, statement) {
  const verb = statement.trim().split(/\s+/)[0].toLowerCase();
  const wrapped = `with x as (${statement} returning 1) select count(*) from x`;
  const r = as(cluster, db, actor, verb === 'insert' || verb === 'update' || verb === 'delete' ? wrapped : statement);
  if (!r.ok) return /row-level security|permission denied|42501/i.test(r.err) ? 'DENIED' : 'ERR:' + r.err.split('\n')[0];
  return Number(r.out);
}
export function asAnon(cluster, db, statement) {
  const r = cluster.script(db, `set role anon;\n${statement};\n`, { stopOnError: true });
  return { ok: r.code === 0, err: r.err.trim(), out: r.out.trim() };
}
export function parseChecks(out) {
  const rows = out.split('\n').filter(l => l.includes('|')).map(l => { const [id, status, ...d] = l.split('|'); return { id, status, detail: d.join('|') }; });
  return { rows, result: rows.find(r => r.id === 'RESULT'), fails: rows.filter(r => r.status === 'FAIL') };
}
export const runFile = (cluster, db, name, { stopOnError = true } = {}) => cluster.script(db, sqlFile(FILES[name]), { stopOnError });
export const policySnapshot = (cluster, db) => cluster.sql(db, `select coalesce(string_agg(tablename || '/' || policyname || '/' || cmd || '/' || permissive || '/' || roles::text || '/' || coalesce(qual,'') || '/' || coalesce(with_check,''), E'\\n' order by tablename, policyname), '') from pg_policies where schemaname = 'public' and tablename in ('categories','sub_categories','product_groups','sub_groups')`);
export const grantSnapshot = (cluster, db) => cluster.sql(db, `select string_agg(c.relname || ':' || coalesce(c.relacl::text, ''), E'\\n' order by c.relname) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('categories','sub_categories','product_groups','sub_groups','products')`);
export const rowsHash = (cluster, db) => cluster.sql(db, `select md5(string_agg(t, '|' order by t)) from (${TABLES.map(x => `select '${x}:' || row_to_json(${x})::text t from public.${x}`).join(' union all ')}) s`);
