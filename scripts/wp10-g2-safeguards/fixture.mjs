// WP10 G2 isolated-PostgreSQL helpers. Builds on the G1 fixture (live-verbatim guards/writers/resolvers, labelled stand-ins) and loads the
// UNAPPLIED draft SQL from docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/ exactly as written. Throw-away local cluster only; never Supabase.
import fs from "node:fs";
import path from "node:path";
import { startCluster, pgAvailable } from "../wp08-g2-0-shared-master-data/pg-harness.mjs";
import { fixtureSql, session, PROVENANCE } from "../wp10-g1-safeguard-audit/fixture-sql.mjs";
import { repoRoot, liveFn2, read } from "../wp10-g1-safeguard-audit/lib.mjs";

export { pgAvailable, session, PROVENANCE };
export const DRAFT_DIR = path.join(repoRoot, "docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS");
export const draft = (name) => fs.readFileSync(path.join(DRAFT_DIR, name), "utf8");
export const DRAFTS = { clock: "01_clock_and_batch_size_contract.sql", states: "02_essential_states_and_boundaries.sql", horizon: "03_operational_expiry_horizon_rpc.sql", reparent: "04_active_sku_reparent_guard.sql", route: "05_product_route_impact_guard.sql", rollback: "99_rollback_all.sql" };

// STAND-IN clock: the proposal reads the clock in ONE function; the fixture replaces only that function so tests can fix 'today' (same technique as G1's fixture_now).
// The stand-in is then RE-STAMPED with the same receipt format so that provenance checks (99 rollback, prerequisite receipts) see an intact object; tests that need the
// UNMODIFIED proposal-01 clock use g2FixtureSql({ clock: false }).
const CLOCK_STANDIN = "create or replace function costing.fn_wp10_today_ist() returns date language sql stable as $$ select (public.fixture_now() at time zone 'Asia/Kolkata')::date $$;\n" +
  "do $$ declare v oid := to_regprocedure('costing.fn_wp10_today_ist()'); begin execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 01_clock_and_batch_size_contract.sql md5:' || md5(pg_get_functiondef(v))); end $$;\n";
export const PRODUCTS_SEED = "insert into public.products(item, sub_group_id, status) values ('P1',1,'Active'),('P2',1,'Inactive'),('P3',1,'Active'),('P4',1,'Active'),('P5',1,'Active'),('P6',1,'Active'),('P7',1,'Active'),('P8',2,'Active');\n";

// R2 route chain: the independent route-callee catalog (docs/.../independent-route-callee-catalog-2026-11-15.json, pg_get_functiondef text) provides the
// FIVE callee functions of the live route validator VERBATIM. The validator itself comes from the earlier independent catalog (also verbatim). Only the TABLES
// they read are stand-ins (column subsets derived from those function texts); labelled below and in PROVENANCE_ROUTE.
export const ROUTE_CATALOG = JSON.parse(read("docs/master-data-costing/WP10_G2_EVIDENCE/independent-route-callee-catalog-2026-11-15.json"));
const routeFn = (name) => ROUTE_CATALOG.functions.find((f) => f.proname === name)?.definition;
export const PROVENANCE_ROUTE = {
  "costing.fn_validate_effective_product_process_route": "LIVE-VERBATIM (independent catalog) - replaces the G1 STAND-IN in G2 suites only",
  "costing.fn_resolve_effective_product_process_route / fn_resolve_effective_route_family_route / fn_validate_product_process_route / fn_validate_route_family_route / fn_effective_product_process_route_steps": "LIVE-VERBATIM (independent route-callee catalog)",
  "tables read by those functions (product_process_route, _override, family_route_step, subsections, areas, activities, plant_machinery, production_cost_centre, route_behaviour, resource_class)": "STAND-IN (column subsets taken from the function texts; no constraints beyond those)",
  "trigger fx_auto_steps": "STAND-IN convenience: gives each inserted family route a valid RM-issue / production / FG-transfer step set unless fixture GUC fx.no_steps = 'on'",
};
export const ROUTE_CHAIN_SQL = `
-- ===== G2 route chain layer (R2) =====
drop function costing.fn_validate_effective_product_process_route(integer, date);
alter table costing.production_route_family add column allows_release_only_route boolean default false;
alter table costing.production_route_family_route add column route_version integer default 1, add column evidence_status text default 'MANUAL_COMPLETE';
create table public.subsections(id integer primary key, section_id integer);
create table public.areas(id integer primary key, section_id integer, subsection_id integer);
create table public.plant_machinery(id integer primary key, section_id integer, subsection_id integer, area_id integer);
create table public.activities(id integer primary key, section_id integer, sub_section_id integer, area_id integer);
create table costing.production_cost_centre(id bigint primary key, status text, effective_from date, effective_to date, pool_scope text);
create table costing.production_route_behaviour(code text primary key, is_active boolean);
create table costing.production_resource_class(code text primary key, is_active boolean);
create table costing.production_route_family_route_step(id bigserial primary key, family_route_id bigint, step_key text, sequence_no numeric, activity_id integer, cost_centre_id bigint, section_id integer, subsection_id integer, area_id integer, plant_id integer,
  behaviour_code text, resource_class_code text, route_step_scope text, expected_occurrence_count numeric default 1, standard_cycle_count numeric default 1, is_mandatory boolean default true, allows_repeat boolean default false, allows_skip_with_approval boolean default false,
  production_overhead_scope text default 'INCLUDE', direct_labour_scope text default 'INCLUDE');
create table costing.product_process_route(id bigserial primary key, product_id integer, archived_at timestamptz, status text, effective_from date, effective_to date, base_route_family_route_id bigint, batch_size_ref_id bigint, evidence_status text default 'MANUAL_COMPLETE');
create table costing.product_process_route_override(id bigserial primary key, product_route_id bigint, base_step_id bigint, operation_type text, override_step_key text, sequence_no numeric, activity_id integer, cost_centre_id bigint, section_id integer, subsection_id integer, area_id integer, plant_id integer,
  behaviour_code text, resource_class_code text, route_step_scope text, expected_occurrence_count numeric, standard_cycle_count numeric, is_mandatory boolean, allows_repeat boolean, allows_skip_with_approval boolean, production_overhead_scope text, direct_labour_scope text);
insert into public.subsections values (1, 1); insert into public.areas values (1, 1, 1); insert into public.activities values (1, 1, 1, 1);
insert into costing.production_cost_centre values (1, 'APPROVED', date '2026-01-01', null, 'PRODUCTION');
insert into costing.production_route_behaviour values ('B', true); insert into costing.production_resource_class values ('R', true);
${liveFn2("costing", "fn_resolve_route_family_for_product") ? "" : ""}
${routeFn("fn_resolve_effective_product_process_route")};
${routeFn("fn_resolve_effective_route_family_route")};
${routeFn("fn_effective_product_process_route_steps")};
${routeFn("fn_validate_product_process_route")};
${routeFn("fn_validate_route_family_route")};
${liveFn2("costing", "fn_validate_effective_product_process_route")};
create function costing.fx_auto_steps() returns trigger language plpgsql as $$ begin
  if coalesce(current_setting('fx.no_steps', true), '') <> 'on' then
    insert into costing.production_route_family_route_step(family_route_id, step_key, sequence_no, activity_id, cost_centre_id, section_id, subsection_id, area_id, behaviour_code, resource_class_code, route_step_scope) values
      (new.id, 'rm', 1, 1, 1, 1, 1, 1, 'B', 'R', 'BOUNDARY_RM_ISSUE'), (new.id, 'prod', 2, 1, 1, 1, 1, 1, 'B', 'R', 'PRODUCTION_PROCESS'), (new.id, 'fg', 3, 1, 1, 1, 1, 1, 'B', 'R', 'BOUNDARY_FG_TRANSFER');
  end if; return new; end $$;
create trigger fx_auto_steps after insert on costing.production_route_family_route for each row execute function costing.fx_auto_steps();
-- product-level route with a valid batch reference (helper for R2 scenarios)
create function public.fx_product_route(p_product int, p_from date, p_to date, p_base_family_route bigint, p_status text default 'APPROVED') returns bigint language plpgsql as $$ declare v_batch bigint; v bigint; begin
  select id into v_batch from public.production_batch_size_ref where product_id = p_product order by id limit 1;
  insert into costing.product_process_route(product_id, status, effective_from, effective_to, base_route_family_route_id, batch_size_ref_id) values (p_product, p_status, p_from, p_to, p_base_family_route, v_batch) returning id into v; return v; end $$;
`;

/** which drafts to load (default all five); `mutate(name, text)` lets mutation tests alter one file. */
export function g2FixtureSql({ load = ["clock", "states", "horizon", "reparent", "route"], mutate = (n, t) => t, clock = true } = {}) {
  let sql = fixtureSql() + ROUTE_CHAIN_SQL + "\ndo $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $$;\n";
  for (const k of load) sql += "\n" + mutate(k, draft(DRAFTS[k])) + "\n";
  if (load.includes("clock") && clock) sql += CLOCK_STANDIN;
  return sql;
}

export function makeRunner(cluster, { sql = g2FixtureSql(), seed = PRODUCTS_SEED } = {}) {
  return function scenario(body) {
    const db = cluster.newDb();
    const boot = cluster.script(db, sql + "\n" + seed);
    if (boot.code) throw new Error("fixture boot failed: " + boot.err);
    const run = cluster.script(db, body, { stopOnError: false });
    const q = (text, pre = "") => cluster.sql(db, pre + text);
    const logRows = q("select label || '#' || ok || '#' || coalesce(sqlstate,'') || '#' || coalesce(msg,'') || '#' || coalesce(detail,'') from public.fx_log order by id").split("\n").filter(Boolean);
    const log = Object.fromEntries(logRows.map((l) => { const [label, ok, state, msg, detail] = l.split("#"); return [label, { ok: ok === "true", state, msg, detail }]; }));
    return { db, q, log, run, one: (text, pre = "") => q(text, pre).split("\n").pop() };
  };
}
export const T = (label, stmt) => `select public.fx_try('${label}', $q$${stmt}$q$);\n`;
export const NEWSKU = (pid, pack = 50, uom = "mL") => `insert into public.product_skus(product_id, pack_size, uom) values (${pid}, ${pack}, '${uom}');\n`;
export const ACTIVATE = (id, reason = "go") => `select * from public.rpc_set_product_sku_active(${id}, true, '${reason}');\n`;
export const HORIZON = (days = 30, after = "null", limit = 50) => `select public.rpc_wp10_get_operational_expiry_horizon(${days}, ${after}, ${limit})`;
export const startPg = () => startCluster();
