// WP10 G2 isolated-PostgreSQL helpers. Builds on the G1 fixture (live-verbatim guards/writers/resolvers, labelled stand-ins) and loads the
// UNAPPLIED draft SQL from supabase/draft-proposals/wp10-g2-unapplied/ exactly as written. Throw-away local cluster only; never Supabase.
import fs from "node:fs";
import path from "node:path";
import { startCluster, pgAvailable } from "../wp08-g2-0-shared-master-data/pg-harness.mjs";
import { fixtureSql, session, PROVENANCE } from "../wp10-g1-safeguard-audit/fixture-sql.mjs";
import { repoRoot } from "../wp10-g1-safeguard-audit/lib.mjs";

export { pgAvailable, session, PROVENANCE };
export const DRAFT_DIR = path.join(repoRoot, "supabase/draft-proposals/wp10-g2-unapplied");
export const draft = (name) => fs.readFileSync(path.join(DRAFT_DIR, name), "utf8");
export const DRAFTS = { clock: "01_clock_and_batch_size_contract.sql", states: "02_essential_states_and_boundaries.sql", horizon: "03_operational_expiry_horizon_rpc.sql", reparent: "04_active_sku_reparent_guard.sql", route: "05_product_route_impact_guard.sql", rollback: "99_rollback_all.sql" };

// STAND-IN clock: the proposal reads the clock in ONE function; the fixture replaces only that function so tests can fix 'today' (same technique as G1's fixture_now).
const CLOCK_STANDIN = "create or replace function costing.fn_wp10_today_ist() returns date language sql stable as $$ select (public.fixture_now() at time zone 'Asia/Kolkata')::date $$;\n";
export const PRODUCTS_SEED = "insert into public.products(item, sub_group_id, status) values ('P1',1,'Active'),('P2',1,'Inactive'),('P3',1,'Active'),('P4',1,'Active'),('P5',1,'Active'),('P6',1,'Active'),('P7',1,'Active'),('P8',2,'Active');\n";

/** which drafts to load (default all five); `mutate(name, text)` lets mutation tests alter one file. */
export function g2FixtureSql({ load = ["clock", "states", "horizon", "reparent", "route"], mutate = (n, t) => t } = {}) {
  let sql = fixtureSql() + "\ndo $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $$;\n";
  for (const k of load) sql += "\n" + mutate(k, draft(DRAFTS[k])) + "\n";
  if (load.includes("clock")) sql += CLOCK_STANDIN;
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
