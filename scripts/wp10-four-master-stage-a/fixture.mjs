// WP10 four-master Stage A — disposable PostgreSQL fixture. Throw-away LOCAL cluster only (unix socket, temp dir); never Supabase, never a network DB.
// PROVENANCE (all STAND-INS; nothing here is live evidence):
//  - public.app_has_permission / app_has_permission_core / require_permission: STAND-INS mirroring the documented live shape (WP05 R23: invoker wrapper reads auth.uid(), delegates to a
//    SECURITY DEFINER core that reads public.user_permissions_canonical; 'view'->can_view, 'edit'->can_edit; missing uid -> false). Live function text for require_permission is not in the repo;
//    its semantics here follow the independent live review of PR #477: require_permission(target, true) requires can_view = true AND can_edit = true (stand-in implements exactly that).
//  - the 12 rpc_wp10_* functions: STAND-INS (live bodies are not in the repository): SECURITY DEFINER, owned by the table owner, require_permission(<module>, true) then plain DML.
//  - original policies/grants: verbatim from supabase/migrations/20260809160830_security_advisor_sa2c_wave1_authenticated_master_crud.sql (live-applied).
//  - roles: authenticated/anon/service_role are plain NOLOGIN roles; the table/function owner `fx_owner` is NON-superuser without BYPASSRLS (like live: owner bypass only via table ownership).
//  - PostgreSQL 16 locally vs PostgreSQL 17.4 live. Real JWT / PostgREST / Supabase auth are NOT exercised.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startCluster, pgAvailable } from "../wp08-g2-0-shared-master-data/pg-harness.mjs";

export { startCluster, pgAvailable };
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const MIGRATION = "supabase/migrations/20261118161406_wp10_four_master_stage_a_state_reconciliation.sql";
export const SQL_DIR = path.join(root, "docs/master-data-costing/WP10_FOUR_MASTER_STAGE_A_UNAPPLIED_SQL");
export const sqlFile = (n) => fs.readFileSync(path.join(SQL_DIR, n), "utf8");
export const FILES = { pre: "01_preflight_readonly.sql", apply: "02_stage_a_apply.sql", post: "03_postflight_readonly.sql", rollback: "99_rollback_stage_a.sql" };

export const TABLES = [
  { tbl: "categories", target: "module:manage-categories", ins: "insert into public.categories(category_name) values ('NEW')", upd: "update public.categories set category_name = category_name || 'x' where id = 1", del: "delete from public.categories where id = 2",
    ups: "insert into public.categories(id, category_name) values (1, 'UPS') on conflict (id) do update set category_name = excluded.category_name" },
  { tbl: "sub_categories", target: "module:manage-subcategories", ins: "insert into public.sub_categories(subcategory_name, category_id) values ('NEW', 1)", upd: "update public.sub_categories set subcategory_name = subcategory_name || 'x' where id = 1", del: "delete from public.sub_categories where id = 2",
    ups: "insert into public.sub_categories(id, subcategory_name, category_id) values (1, 'UPS', 1) on conflict (id) do update set subcategory_name = excluded.subcategory_name" },
  { tbl: "product_groups", target: "module:manage-product-groups", ins: "insert into public.product_groups(group_name, sub_category_id) values ('NEW', 1)", upd: "update public.product_groups set group_name = group_name || 'x' where id = 1", del: "delete from public.product_groups where id = 2",
    ups: "insert into public.product_groups(id, group_name, sub_category_id) values (1, 'UPS', 1) on conflict (id) do update set group_name = excluded.group_name" },
  { tbl: "sub_groups", target: "module:manage-subgroups", ins: "insert into public.sub_groups(sub_group_name, product_group_id) values ('NEW', 1)", upd: "update public.sub_groups set sub_group_name = sub_group_name || 'x' where id = 1", del: "delete from public.sub_groups where id = 2",
    ups: "insert into public.sub_groups(id, sub_group_name, product_group_id) values (1, 'UPS', 1) on conflict (id) do update set sub_group_name = excluded.sub_group_name" },
];
// governed RPC calls (stand-in bodies) per table: [create, rename, delete]
export const RPC_CALLS = {
  categories: ["select public.rpc_wp10_create_category('RPC-NEW')", "select public.rpc_wp10_rename_category(1, 'RPC-REN')", "select public.rpc_wp10_delete_category(3)"],
  sub_categories: ["select public.rpc_wp10_create_subcategory(1, 'RPC-NEW')", "select public.rpc_wp10_rename_subcategory(1, 'RPC-REN')", "select public.rpc_wp10_delete_subcategory(3)"],
  product_groups: ["select public.rpc_wp10_create_product_group(1, 'RPC-NEW', 1)", "select public.rpc_wp10_rename_product_group(1, 'RPC-REN')", "select public.rpc_wp10_delete_product_group(3)"],
  sub_groups: ["select public.rpc_wp10_create_subgroup(1, 'RPC-NEW')", "select public.rpc_wp10_rename_subgroup(1, 'RPC-REN')", "select public.rpc_wp10_delete_subgroup(3)"],
};
export const ACTORS = {
  editorAll: "00000000-0000-0000-0000-0000000000a1",
  editorCategories: "00000000-0000-0000-0000-0000000000a2",
  editorSubcategories: "00000000-0000-0000-0000-0000000000a3",
  editorProductGroups: "00000000-0000-0000-0000-0000000000a4",
  editorSubgroups: "00000000-0000-0000-0000-0000000000a5",
  viewer: "00000000-0000-0000-0000-0000000000b1",      // can_view true, can_edit false on all four
  noAccess: "00000000-0000-0000-0000-0000000000c1",   // authenticated identity with no canonical rows
  editNoView: "00000000-0000-0000-0000-0000000000d1", // ANOMALOUS: can_edit true but can_view false on all four modules (rev 2 negative case)
};
export const OWN_EDITOR = { categories: "editorCategories", sub_categories: "editorSubcategories", product_groups: "editorProductGroups", sub_groups: "editorSubgroups" };

export function fixtureSql() {
  const rpc = (name, args, target, body) => `create function public.${name}(${args}) returns void language plpgsql security definer set search_path = public, pg_temp as $$ begin
  perform public.require_permission('${target}', true); ${body}; end $$;
alter function public.${name}(${args}) owner to fx_owner; revoke all on function public.${name}(${args}) from public; grant execute on function public.${name}(${args}) to authenticated;\n`;
  return `
set client_min_messages = warning;
do $$ declare r text; begin foreach r in array array['anon','authenticated','service_role','fx_owner'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if; end loop; end $$;
grant all on schema public to fx_owner; grant usage on schema public to authenticated, anon;
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, fx_owner;
create table public.user_permissions_canonical(user_id uuid, target text, can_view boolean, can_edit boolean); alter table public.user_permissions_canonical owner to fx_owner;
create function public.app_has_permission_core(p_uid uuid, p_target text, p_mode text) returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if lower(p_mode) not in ('view','edit') then raise exception 'invalid mode %', p_mode; end if;
  return coalesce((select case lower(p_mode) when 'view' then c.can_view else c.can_edit end from public.user_permissions_canonical c where c.user_id = p_uid and c.target = p_target), false); end $$;
alter function public.app_has_permission_core(uuid,text,text) owner to fx_owner; revoke all on function public.app_has_permission_core(uuid,text,text) from public; grant execute on function public.app_has_permission_core(uuid,text,text) to authenticated;
create function public.app_has_permission(p_target text, p_mode text) returns boolean language plpgsql stable as $$
declare v uuid := auth.uid(); begin if v is null then return false; end if; return public.app_has_permission_core(v, p_target, p_mode); end $$;
revoke all on function public.app_has_permission(text,text) from public; grant execute on function public.app_has_permission(text,text) to authenticated, fx_owner;
create function public.require_permission(p_target text, p_edit boolean) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin if not (public.app_has_permission(p_target, 'view') and (not p_edit or public.app_has_permission(p_target, 'edit'))) then raise exception 'Permission denied for %', p_target using errcode = '42501'; end if; end $$;
alter function public.require_permission(text,boolean) owner to fx_owner; revoke all on function public.require_permission(text,boolean) from public; grant execute on function public.require_permission(text,boolean) to authenticated;

create table public.categories(id serial primary key, category_name text not null unique);
create table public.sub_categories(id serial primary key, subcategory_name text not null, category_id int not null references public.categories(id));
create table public.product_groups(id serial primary key, group_name text not null, sub_category_id int not null references public.sub_categories(id), kind_id int default 1);
create table public.sub_groups(id serial primary key, sub_group_name text not null, product_group_id int not null references public.product_groups(id));
create table public.products(id serial primary key, item text, sub_group_id int references public.sub_groups(id));
alter table public.categories owner to fx_owner; alter table public.sub_categories owner to fx_owner; alter table public.product_groups owner to fx_owner; alter table public.sub_groups owner to fx_owner; alter table public.products owner to fx_owner;
alter sequence categories_id_seq owner to fx_owner; alter sequence sub_categories_id_seq owner to fx_owner; alter sequence product_groups_id_seq owner to fx_owner; alter sequence sub_groups_id_seq owner to fx_owner;
grant usage on all sequences in schema public to authenticated;
-- ORIGINAL live state (supabase/migrations/20260809160830_security_advisor_sa2c_wave1_authenticated_master_crud.sql)
alter table public.categories enable row level security; alter table public.sub_categories enable row level security; alter table public.product_groups enable row level security; alter table public.sub_groups enable row level security;
revoke all privileges on table public.categories, public.sub_categories, public.product_groups, public.sub_groups from anon, authenticated;
grant select, insert, update, delete on table public.categories, public.sub_categories, public.product_groups, public.sub_groups to authenticated;
create policy categories_authenticated_crud on public.categories for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy sub_categories_authenticated_crud on public.sub_categories for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy product_groups_authenticated_crud on public.product_groups for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy sub_groups_authenticated_crud on public.sub_groups for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
-- synthetic rows only
insert into public.categories(id, category_name) values (1,'C1'),(2,'C2'),(3,'C3'); select setval('categories_id_seq', 10);
insert into public.sub_categories(id, subcategory_name, category_id) values (1,'S1',1),(2,'S2',1),(3,'S3',1); select setval('sub_categories_id_seq', 10);
insert into public.product_groups(id, group_name, sub_category_id) values (1,'G1',1),(2,'G2',1),(3,'G3',1); select setval('product_groups_id_seq', 10);
insert into public.sub_groups(id, sub_group_name, product_group_id) values (1,'SG1',1),(2,'SG2',1),(3,'SG3',1); select setval('sub_groups_id_seq', 10);
insert into public.user_permissions_canonical values
 ('${ACTORS.editorAll}','module:manage-categories',true,true),('${ACTORS.editorAll}','module:manage-subcategories',true,true),('${ACTORS.editorAll}','module:manage-product-groups',true,true),('${ACTORS.editorAll}','module:manage-subgroups',true,true),
 ('${ACTORS.editorCategories}','module:manage-categories',true,true),('${ACTORS.editorSubcategories}','module:manage-subcategories',true,true),
 ('${ACTORS.editorProductGroups}','module:manage-product-groups',true,true),('${ACTORS.editorSubgroups}','module:manage-subgroups',true,true),
 ('${ACTORS.viewer}','module:manage-categories',true,false),('${ACTORS.viewer}','module:manage-subcategories',true,false),('${ACTORS.viewer}','module:manage-product-groups',true,false),('${ACTORS.viewer}','module:manage-subgroups',true,false),
 ('${ACTORS.editNoView}','module:manage-categories',false,true),('${ACTORS.editNoView}','module:manage-subcategories',false,true),('${ACTORS.editNoView}','module:manage-product-groups',false,true),('${ACTORS.editNoView}','module:manage-subgroups',false,true);
` + rpc("rpc_wp10_create_category", "p_name text", "module:manage-categories", "insert into public.categories(category_name) values (p_name)")
  + rpc("rpc_wp10_rename_category", "p_id int, p_name text", "module:manage-categories", "update public.categories set category_name = p_name where id = p_id")
  + rpc("rpc_wp10_delete_category", "p_id int", "module:manage-categories", "delete from public.categories where id = p_id")
  + rpc("rpc_wp10_create_subcategory", "p_parent_id int, p_name text", "module:manage-subcategories", "insert into public.sub_categories(subcategory_name, category_id) values (p_name, p_parent_id)")
  + rpc("rpc_wp10_rename_subcategory", "p_id int, p_name text", "module:manage-subcategories", "update public.sub_categories set subcategory_name = p_name where id = p_id")
  + rpc("rpc_wp10_delete_subcategory", "p_id int", "module:manage-subcategories", "delete from public.sub_categories where id = p_id")
  + rpc("rpc_wp10_create_product_group", "p_parent_id int, p_name text, p_kind_id int", "module:manage-product-groups", "insert into public.product_groups(group_name, sub_category_id, kind_id) values (p_name, p_parent_id, p_kind_id)")
  + rpc("rpc_wp10_rename_product_group", "p_id int, p_name text", "module:manage-product-groups", "update public.product_groups set group_name = p_name where id = p_id")
  + rpc("rpc_wp10_delete_product_group", "p_id int", "module:manage-product-groups", "delete from public.product_groups where id = p_id")
  + rpc("rpc_wp10_create_subgroup", "p_group_id int, p_name text", "module:manage-subgroups", "insert into public.sub_groups(sub_group_name, product_group_id) values (p_name, p_group_id)")
  + rpc("rpc_wp10_rename_subgroup", "p_subgroup_id int, p_name text", "module:manage-subgroups", "update public.sub_groups set sub_group_name = p_name where id = p_subgroup_id")
  + rpc("rpc_wp10_delete_subgroup", "p_subgroup_id int", "module:manage-subgroups", "delete from public.sub_groups where id = p_subgroup_id");
}

/** fresh database with the ORIGINAL (pre-Stage-A) state */
export function newFixture(cluster) { const db = cluster.newDb(); cluster.sql(db, fixtureSql()); return db; }

/** run one statement as an authenticated actor (real SET ROLE authenticated; uid via the same GUC Supabase uses). Returns {ok, rows, err}. uid=null => authenticated role without a uid. */
export function as(cluster, db, actor, statement) {
  const uid = actor == null ? "" : ACTORS[actor] ?? actor;
  const r = cluster.script(db, `set role authenticated;\nselect set_config('request.jwt.claim.sub', '${uid}', false);\n${statement};\n`, { stopOnError: true });
  const lines = r.out.trim().split("\n").filter(Boolean);
  return { ok: r.code === 0, out: lines[lines.length - 1] ?? "", err: r.err.trim() };
}
/** run a count-returning DML as actor: returns affected-row count, or "ERR:<sqlstate-ish>" */
export function dml(cluster, db, actor, statement) {
  const verb = statement.trim().split(/\s+/)[0].toLowerCase();
  const wrapped = verb === "insert" || verb === "update" || verb === "delete"
    ? `with x as (${statement} returning 1) select count(*) from x` : statement;
  const r = as(cluster, db, actor, wrapped);
  if (!r.ok) return /row-level security|permission denied|42501/i.test(r.err) ? "DENIED" : "ERR:" + r.err.split("\n")[0];
  return Number(r.out);
}
/** parse the output of preflight/postflight: [{id,status,detail}] and the RESULT row */
export function parseChecks(out) {
  const rows = out.split("\n").filter((l) => l.includes("|")).map((l) => { const [id, status, ...d] = l.split("|"); return { id, status, detail: d.join("|") }; });
  return { rows, result: rows.find((r) => r.id === "RESULT"), fails: rows.filter((r) => r.status === "FAIL") };
}
export function runFile(cluster, db, name, { stopOnError = true } = {}) { return cluster.script(db, sqlFile(FILES[name]), { stopOnError }); }
export const rowsHash = (cluster, db) => cluster.sql(db, "select md5(string_agg(t, '|' order by t)) from (" + TABLES.map((x) => `select '${x.tbl}:' || row_to_json(${x.tbl})::text t from public.${x.tbl}`).join(" union all ") + ") q");
export const policySnapshot = (cluster, db) => cluster.sql(db, `select coalesce(string_agg(tablename || '/' || policyname || '/' || cmd || '/' || permissive || '/' || roles::text || '/' || coalesce(qual,'') || '/' || coalesce(with_check,''), E'\\n' order by tablename, policyname), '') from pg_policies where schemaname = 'public' and tablename in ('categories','sub_categories','product_groups','sub_groups')`);
export const grantSnapshot = (cluster, db) => cluster.sql(db, `select string_agg(c.relname || ':' || coalesce(c.relacl::text,''), E'\\n' order by c.relname) from pg_class c where c.relname in ('categories','sub_categories','product_groups','sub_groups') and c.relnamespace = 'public'::regnamespace`);
