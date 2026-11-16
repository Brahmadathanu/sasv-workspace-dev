// WP10 Phase 2 — isolated PostgreSQL witness for first SKU activation vs route-changing product subgroup edit.
// NOT a production writer test. Uses the G2 fixture's live-verbatim writer/route functions and proposal 05,
// synthetic tables and an artificial AFTER trigger pause to expose the overlap. Exit 0 ONLY for a confirmed
// counterexample; no counterexample is NOT a proof of safety. All database writes target disposable local PG.
import fs from "node:fs";
import { spawn } from "node:child_process";
import { pgAvailable, startPg, g2FixtureSql, makeRunner, session, NEWSKU } from "./fixture.mjs";
import { makeResults } from "../wp10-g1-safeguard-audit/lib.mjs";

const { results, check, classify, failed } = makeResults();
if (!pgAvailable()) {
  classify("CF0", "SKIPPED", "Isolated PostgreSQL unavailable — cross-flow NOT TESTED");
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results }, null, 2) + "\n");
  process.exit(2);
}
const cluster = startPg();
function psql(sc, sqlText) {
  return new Promise((resolve) => {
    const c = spawn("psql", ["-X", "-q", "-h", sc.q("show unix_socket_directories"), "-p", sc.q("show port"),
      "-U", "postgres", "-d", sc.db, "-t", "-A", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("close", (code) => resolve({ code, out, err }));
    c.stdin.end(sqlText);
  });
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const scenario = makeRunner(cluster, { sql: g2FixtureSql() });
  // All state is synthetic. Product 1 has a route ONLY while assigned to subgroup 1.
  const setup = session() +
    "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
    "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
    "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
    NEWSKU(1, 55) + "select public.fx_complete(1,1,'ROUTE');\n" +
    // Delays only the COMMIT of a successful activation after the existing BEFORE validations.
    // Does not change parent/product or route/guard decisions; this represents a real open transaction.
    `create function public.fx_crossflow_pause() returns trigger language plpgsql as $$
      begin if new.is_active is true and old.is_active is not true then perform pg_sleep(4); end if;
      return null; end $$;
      create trigger zz_fx_crossflow_pause after update of is_active on public.product_skus
      for each row execute function public.fx_crossflow_pause();\n`;
  const sc = scenario(setup);
  const first = sc.one("select is_active::text from public.product_skus where id=1");
  check("CF1", "Initial fixture: first SKU inactive", first === "false", first);
  const a = psql(sc, "set application_name = 'wp10_crossflow_activation';\n" + session() +
    "begin; select * from public.rpc_set_product_sku_active(1,true,'synthetic concurrency activation'); commit;\n");
  // Observe the AFTER-trigger sleep rather than guessing based on elapsed wall-clock time.
  let paused = false;
  for (let i = 0; i < 40; i++) {
    const state = sc.q("select count(*) from pg_stat_activity where application_name='wp10_crossflow_activation' and wait_event='PgSleep'");
    if (Number(state) > 0) { paused = true; break; }
    await sleep(75);
  }
  check("CF2", "Activation reached the AFTER-validation pause with its SKU change uncommitted", paused);
  let b = { code: -1, err: "barrier not reached" };
  if (paused) {
    b = await psql(sc, "set application_name = 'wp10_crossflow_product';\n" + session() +
      "select * from public.rpc_update_product(1,'P1',3,'ml','Active',null,null,false,false,null,null,false,'synthetic subgroup change');\n");
  }
  const ra = await a;
  const sku = sc.one("select is_active::text from public.product_skus where id=1");
  const subgroup = sc.one("select sub_group_id from public.products where id=1");
  const route = sc.one("select coalesce((costing.fn_validate_effective_product_process_route(1, date '2026-01-01')->>'valid')::text,'NULL')");
  const witness = paused && b.code === 0 && ra.code === 0 && sku === "true" && subgroup === "3" && route === "false";
  check("CF3", "Original proposed 05 cross-flow counterexample: BOTH writers commit, SKU active, route invalid (synthetic witness)", witness,
    JSON.stringify({ activation: ra.code, productEdit: b.code, sku, subgroup, route, activationError: ra.err.slice(0,240), productError: b.err.slice(0,240) }));
  check("CF4", "Both writers returned without error only when a counterexample exists", witness && !/ERROR/.test(ra.err + b.err));
  console.log(witness ? "SYNTHETIC COUNTEREXAMPLE OBSERVED: 05 must not be applied without correction" : "NO VERIFIED COUNTEREXAMPLE: inspect schedule/fixture, do NOT infer safety");
} finally {
  cluster.stop();
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ provenance: "disposable PostgreSQL, live-verbatim G1 writer and G2 route chain, synthetic tables, un-applied 05, synthetic AFTER pause", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
