// WP10 CL15 cross-flow gate: real two-session PostgreSQL READ COMMITTED trace in a disposable Unix-socket cluster.
// This test intentionally REPRODUCES a hazardous end state if present; it does not validate production or authorise SQL.
// Fixture uses reviewed live-verbatim SKU activation/product writers, original 05 triggers,
// and the labelled stand-in tables/route resolver from the existing G2 fixture.
// Usage: node scripts/wp10-g2-safeguards/crossflow-concurrency.test.mjs
import { spawn } from "node:child_process";
import { pgAvailable, startPg, g2FixtureSql, PRODUCTS_SEED, session } from "./fixture.mjs";

if (!pgAvailable()) {
  console.error("BLOCKED: isolated PostgreSQL unavailable; concurrency NOT TESTED");
  process.exit(2);
}
const cluster = startPg();
const db = cluster.newDb();
const aSession = session();
let aChild;
let bChild;
function run(sql, marker = null, holdOpen = false) {
  const child = spawn("psql", [...cluster.connectionArgs(db), "-X", "-q", "-v", "ON_ERROR_STOP=1", "-t", "-A"], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "", resolvedMarker = false;
  let signalMarker, rejectMarker;
  const observed = new Promise((resolve, reject) => { signalMarker = resolve; rejectMarker = reject; });
  const ended = new Promise((resolve) => child.on("close", (code, sig) => {
    if (marker && !resolvedMarker) rejectMarker(new Error("session exited before " + marker + ": " + err + out));
    resolve({ code, sig, out, err });
  }));
  child.stdout.on("data", chunk => {
    out += chunk.toString();
    if (marker && !resolvedMarker && out.includes(marker)) { resolvedMarker = true; signalMarker(); }
  });
  child.stderr.on("data", chunk => { err += chunk.toString(); });
  if (holdOpen) child.stdin.write(sql); else child.stdin.end(sql);
  return { child, ended, observed, finish: tail => { if (!holdOpen) throw new Error("session not held open"); child.stdin.end(tail); } };
}
try {
  const setup = cluster.script(db, g2FixtureSql({load: ["clock", "states", "reparent", "route"]}) + PRODUCTS_SEED + `
    -- Route initially valid solely through subgroup 1. Subgroup 3 has no route.
    insert into costing.production_route_family(id,status,effective_from)
      values (777,'APPROVED',date '2026-01-01');
    insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from)
      values (1,777,'APPROVED',date '2026-01-01');
    insert into costing.production_route_family_route(route_family_id,status,effective_from)
      values (777,'APPROVED',date '2026-01-01');
    insert into public.product_skus(product_id,pack_size,uom) values (1,50,'mL');
    select public.fx_complete(1,1,'ROUTE');
  `);
  if (setup.code !== 0) throw new Error("isolated fixture setup failed: " + setup.err.slice(-4000));
  const before = cluster.sql(db, "select count(*) from public.product_skus where is_active");
  if (before !== "0") throw new Error("expected zero active SKUs before concurrency probe");

  // A locks the SKU and activates it; its transaction remains uncommitted.
  // B then updates the parent/subgroup with the exact original 05 triggers.
  // B can see zero committed active SKUs even while A has a pending activation.
  const a = run(`begin;
${aSession}
select * from public.product_skus where id=1 for update;
select * from public.rpc_set_product_sku_active(1,true,'isolated A activation');
\\echo A_ACTIVATED
select pg_sleep(4);
commit;
`, "A_ACTIVATED");
  aChild = a.child;
  await Promise.race([a.observed, new Promise((_,reject) => setTimeout(()=>reject(new Error("A barrier timeout")),10000))]);
  const b = run(`begin;
${aSession}
set local lock_timeout='1500ms';
select * from public.rpc_update_product(1,'P1',3,'ml','Active',null,null,false,false,null,null,false,'isolated B subgroup change');
commit;
`);
  bChild = b.child;
  const bOutcome = await b.ended;
  a.finish("commit;\\n");
  const aOutcome = await a.ended;
  const final = cluster.sql(db, `select ps.is_active::text || '|' || p.sub_group_id::text || '|' ||
   coalesce((costing.fn_validate_effective_product_process_route(p.id,date '2026-11-15')->>'valid'),'null')
   from public.product_skus ps join public.products p on p.id=ps.product_id where ps.id=1`);
  const summary = {
    provenance: "DISPOSABLE_POSTGRESQL_G2_FIXTURE; modelled route tables, reviewed original 05, live-verbatim activation/product writers",
    a_exit: aOutcome.code, b_exit: bOutcome.code,
    a_error: aOutcome.err.slice(-1000), b_error: bOutcome.err.slice(-1000),
    final,
    invariant_violation: final === "true|3|false",
  };
  console.log(JSON.stringify(summary, null, 2));
  if (aOutcome.code !== 0 || bOutcome.code !== 0) {
    console.error("NOT PROVEN: one session failed or blocked; examine lock trace, do not interpret as invariant safe");
    process.exitCode = 1;
  } else if (summary.invariant_violation) {
    console.log("REPRODUCED IN ISOLATED FIXTURE: active SKU committed with invalid product route. Original 05 is HOLD; corrected shared-lock contract required.");
  } else {
    console.error("NOT REPRODUCED in this ordering; repeat and inspect locks before any Phase 2 guard approval.");
    process.exitCode = 1;
  }
} catch (e) {
  console.error("BLOCKED / NOT TESTED: " + e.stack);
  process.exitCode = 1;
} finally {
  aChild?.kill();
  bChild?.kill();
  cluster.stop();
}
