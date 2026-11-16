// WP10 Phase 2 — isolated PostgreSQL witness for first SKU activation vs route-changing product subgroup edit.
// NOT a production writer test. Uses the G2 fixture's live-verbatim writer/route functions and proposal 05,
// synthetic tables and an artificial AFTER trigger pause to expose the overlap. Exit 0 ONLY for a confirmed
// counterexample; no counterexample is NOT a proof of safety. All database writes target disposable local PG.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  const candidate = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "experimental-parent-lock.sql"), "utf8");
  const setup = candidate + "\n" + session() +
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
  check("CL1", "Initial fixture: first SKU inactive", first === "false", first);
  const a = psql(sc, "set application_name = 'wp10_crossflow_activation';\n" + session() +
    "begin; select * from public.rpc_set_product_sku_active(1,true,'synthetic concurrency activation'); commit;\n");
  // Observe the AFTER-trigger sleep rather than guessing based on elapsed wall-clock time.
  let paused = false;
  for (let i = 0; i < 40; i++) {
    const state = sc.q("select count(*) from pg_stat_activity where application_name='wp10_crossflow_activation' and wait_event='PgSleep'");
    if (Number(state) > 0) { paused = true; break; }
    await sleep(75);
  }
  check("CL2", "Activation reached the AFTER-validation pause with its SKU change uncommitted", paused);
  let b = { code: -1, err: "barrier not reached" };
  if (paused) {
    b = await psql(sc, "set application_name = 'wp10_crossflow_product';\n" + session() +
      "select * from public.rpc_update_product(1,'P1',3,'ml','Active',null,null,false,false,null,null,false,'synthetic subgroup change');\n");
  }
  const ra = await a;
  const sku = sc.one("select is_active::text from public.product_skus where id=1");
  const subgroup = sc.one("select sub_group_id from public.products where id=1");
  const route = sc.one("select coalesce((costing.fn_validate_effective_product_process_route(1, date '2026-01-01')->>'valid')::text,'NULL')");
  const safe = paused && b.code !== 0 && ra.code === 0 && sku === "true" && subgroup === "1" && route === "true";
  check("CL3", "Parent lock candidate serialises activation first: subgroup edit rejected, active SKU retains valid route", safe,
    JSON.stringify({ activation: ra.code, productEdit: b.code, sku, subgroup, route, activationError: ra.err.slice(0,240), productError: b.err.slice(0,240) }));
  check("CL4", "Activation commits and product writer rejects with route-impact guard", safe && /WP10_PRODUCT_ROUTE_IMPACT/.test(b.err));
  console.log(safe ? "CANDIDATE BLOCKED THE REPRODUCED SCHEDULE" : "CANDIDATE NOT VERIFIED; DO NOT DEPLOY");
  // Reverse schedule: product edit holds the parent lock first. The activation's
  // existing friendly precheck may run before it waits, but the final parent-lock
  // trigger MUST revalidate after the product writer commits.
  {
    const reverse = makeRunner(cluster, { sql: g2FixtureSql() });
    const sr = reverse(candidate + "\n" + session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n");
    const product = psql(sr, "set application_name='wp10_reverse_product';\n" + session() +
      "begin; update public.products set sub_group_id=3 where id=1; select pg_sleep(3); commit;\n");
    let holding = false;
    for (let i = 0; i < 40; i++) {
      const n = sr.q("select count(*) from pg_stat_activity where application_name='wp10_reverse_product' and wait_event='PgSleep'");
      if (Number(n) > 0) { holding = true; break; }
      await sleep(75);
    }
    check("CL5", "Reverse schedule: subgroup writer holds product lock before activation", holding);
    const activation = holding ? psql(sr, "set application_name='wp10_reverse_activation';\n" + session() +
      "select * from public.rpc_set_product_sku_active(1,true,'reverse activation');\n") : Promise.resolve({code:-1,err:"barrier missing"});
    const [pr, ar] = await Promise.all([product, activation]);
    const state = {product:pr.code,activation:ar.code,sku:sr.one("select is_active::text from public.product_skus where id=1"),subgroup:sr.one("select sub_group_id from public.products where id=1")};
    check("CL6", "Reverse schedule: subgroup edit commits and activation is refused; SKU remains inactive", holding && pr.code===0 && ar.code!==0 && state.sku==="false" && state.subgroup==="3", JSON.stringify(state)+" "+ar.err.slice(0,200));
  }
  // Parent inactivation must serialize against first activation, in both orders.
  // All waits are bounded; a timeout or deadlock is a test failure, never PASS.
  {
    const mk = () => makeRunner(cluster, { sql: g2FixtureSql() })(candidate + "\n" + session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n");
    const ac = mk();
    const pa = psql(ac, "set application_name='wp10_inactivation_activation_first'; set statement_timeout='7000ms';\n"+session()+
      "begin; update public.product_skus set is_active=true where id=1; select pg_sleep(2); commit;\n");
    let aHeld=false;
    for(let i=0;i<40;i++){if(Number(ac.q("select count(*) from pg_stat_activity where application_name='wp10_inactivation_activation_first' and wait_event='PgSleep'"))>0){aHeld=true;break;}await sleep(50);}
    const pb=aHeld ? psql(ac,"set statement_timeout='7000ms';\n"+session()+"update public.products set status='Inactive' where id=1;\n"):Promise.resolve({code:-1,err:"barrier missing"});
    const [ar,br]=await Promise.all([pa,pb]);
    const af={sku:ac.one("select is_active::text from public.product_skus where id=1"),status:ac.one("select status from public.products where id=1")};
    check("CL12","Activation-first blocks concurrent product inactivation",aHeld && ar.code===0 && br.code!==0 && /Cannot mark product/.test(br.err) && af.sku==="true" && af.status==="Active",JSON.stringify({ar:ar.code,br:br.code,af,error:br.err.slice(0,200)}));
    const bc=mk();
    const ia=psql(bc,"set application_name='wp10_inactivation_product_first'; set statement_timeout='7000ms';\n"+session()+
      "begin; update public.products set status='Inactive' where id=1; select pg_sleep(2); commit;\n");
    let iHeld=false;
    for(let i=0;i<40;i++){if(Number(bc.q("select count(*) from pg_stat_activity where application_name='wp10_inactivation_product_first' and wait_event='PgSleep'"))>0){iHeld=true;break;}await sleep(50);}
    const ib=iHeld ? psql(bc,"set statement_timeout='7000ms';\n"+session()+"update public.product_skus set is_active=true where id=1;\n"):Promise.resolve({code:-1,err:"barrier missing"});
    const [ir,jr]=await Promise.all([ia,ib]);
    const bf={sku:bc.one("select is_active::text from public.product_skus where id=1"),status:bc.one("select status from public.products where id=1")};
    check("CL13","Inactivation-first blocks concurrent SKU activation",iHeld && ir.code===0 && jr.code!==0 && bf.sku==="false" && bf.status==="Inactive" && !/deadlock detected|statement timeout|lock timeout/i.test(jr.err),JSON.stringify({ir:ir.code,jr:jr.code,bf,error:jr.err.slice(0,200)}));
  }
  // Multi-SKU product: one active sibling must prevent parent inactivation.
  {
    const multi = makeRunner(cluster, { sql: g2FixtureSql() });
    const ms = multi(candidate + "\n" + session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n" +
      NEWSKU(1,56) + "select public.fx_complete(2,1,'ROUTE');\n");
    const first = await psql(ms, "set statement_timeout='7000ms';\n" + session() + "update public.product_skus set is_active=true where id=1;\n");
    const blocked = await psql(ms, "set statement_timeout='7000ms';\n" + session() + "update public.products set status='Inactive' where id=1;\n");
    const second = await psql(ms, "set statement_timeout='7000ms';\n" + session() + "update public.product_skus set is_active=true where id=2;\n");
    const siblingCount = ms.one("select count(*) from public.product_skus where product_id=1 and is_active");
    check("CL14","Multiple active SKUs retain active parent; inactivation rejected",first.code===0 && blocked.code!==0 && /Cannot mark product/.test(blocked.err) && second.code===0 && siblingCount==="2" && ms.one("select status from public.products where id=1")==="Active",JSON.stringify({first:first.code,blocked:blocked.code,second:second.code,siblingCount,error:blocked.err.slice(0,150)}));
  }
  // Two concurrent activations under the same parent must serialize without a
  // deadlock or timeout. This is bounded contention coverage, not a global proof.
  {
    const contention = makeRunner(cluster, { sql: g2FixtureSql() });
    const cs = contention(candidate + "\n" + session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n" +
      NEWSKU(1,56) + "select public.fx_complete(2,1,'ROUTE');\n");
    const [a,b] = await Promise.all([
      psql(cs,"set statement_timeout='7000ms'; set lock_timeout='6000ms';\n"+session()+"update public.product_skus set is_active=true where id=1;\n"),
      psql(cs,"set statement_timeout='7000ms'; set lock_timeout='6000ms';\n"+session()+"update public.product_skus set is_active=true where id=2;\n")
    ]);
    const active=cs.one("select count(*) from public.product_skus where product_id=1 and is_active");
    check("CL16","Concurrent sibling SKU activations finish without timeout or deadlock",a.code===0 && b.code===0 && active==="2",JSON.stringify({a:a.code,b:b.code,active,errors:[a.err.slice(0,150),b.err.slice(0,150)]}));
  }
  // Reparent an already-active SKU to a product lacking an approved route.
  // Existing BEFORE guards and the candidate recheck must reject the move.
  {
    const reparent = makeRunner(cluster, { sql: g2FixtureSql() });
    const rs = reparent(candidate + "\n" + session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n");
    const activated=await psql(rs,"set statement_timeout='7000ms';\n"+session()+"update public.product_skus set is_active=true where id=1;\n");
    const moved=await psql(rs,"set statement_timeout='7000ms';\n"+session()+"update public.product_skus set product_id=2 where id=1;\n");
    const state={active:rs.one("select is_active::text from public.product_skus where id=1"),parent:rs.one("select product_id from public.product_skus where id=1")};
    check("CL17","Active SKU reparent to product without route is rejected atomically",activated.code===0 && moved.code!==0 && state.active==="true" && state.parent==="1" && !/deadlock detected|statement timeout|lock timeout/i.test(moved.err),JSON.stringify({activated:activated.code,moved:moved.code,state,error:moved.err.slice(0,220)}));
  }
  // Negative mutation: removing the candidate parent lock must restore the unsafe
  // activation-first cross-flow witness. A witness is not a proof of safety.
  {
    const mutated = makeRunner(cluster, { sql: g2FixtureSql() });
    const ns = mutated(session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n" +
      `create function public.fx_mutation_pause() returns trigger language plpgsql as $mut$
         begin if new.is_active is true and old.is_active is not true then perform pg_sleep(4); end if;
         return null; end $mut$;
         create trigger zz_fx_mutation_pause after update of is_active on public.product_skus
         for each row execute function public.fx_mutation_pause();\n`);
    check("CL15_SETUP","Negative mutation pause trigger installed",ns.one("select count(*) from pg_trigger where tgname='zz_fx_mutation_pause'")==="1");
    const activation = psql(ns,"set application_name='wp10_negative_mutation_activation'; set statement_timeout='7000ms';\n"+session()+
      "begin; update public.product_skus set is_active=true where id=1; commit;\n");
    let paused=false;
    for(let i=0;i<80;i++){if(Number(ns.q("select count(*) from pg_stat_activity where application_name='wp10_negative_mutation_activation' and wait_event='PgSleep'"))>0){paused=true;break;}await sleep(50);}
    const move=paused ? psql(ns,"set statement_timeout='7000ms';\n"+session()+"update public.products set sub_group_id=3 where id=1;\n"):Promise.resolve({code:-1,err:"barrier missing"});
    const [ar,mr]=await Promise.all([activation,move]);
    const state={activation:ar.code,move:mr.code,sku:ns.one("select is_active::text from public.product_skus where id=1"),subgroup:ns.one("select sub_group_id from public.products where id=1")};
    check("CL15","Negative mutation without parent-lock recheck reproduces unsafe active-SKU route state",paused && ar.code===0 && mr.code===0 && state.sku==="true" && state.subgroup==="3",JSON.stringify(state)+" "+mr.err.slice(0,150));
  }
  // Direct privileged table writes must be governed by the same trigger, not just RPCs.
  {
    const direct = makeRunner(cluster, { sql: g2FixtureSql() });
    const ds = direct(candidate + "\n" + session() +
      "insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');\n" +
      "insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');\n" +
      NEWSKU(1,55) + "select public.fx_complete(1,1,'ROUTE');\n");
    const activate = await psql(ds, "update public.product_skus set is_active=true where id=1;\n");
    check("CL7", "Privileged direct activation uses the parent-lock trigger and succeeds when route valid", activate.code===0 && ds.one("select is_active::text from public.product_skus where id=1")==="true",activate.err);
    const harmful = await psql(ds, "update public.products set sub_group_id=3 where id=1;\n");
    check("CL8", "Privileged direct harmful subgroup update is rejected, leaving active SKU route valid", harmful.code!==0 && /WP10_PRODUCT_ROUTE_IMPACT/.test(harmful.err) && ds.one("select sub_group_id from public.products where id=1")==="1",harmful.err.slice(0,200));
    const deactivate = await psql(ds, "update public.product_skus set is_active=false where id=1;\n");
    const move = await psql(ds, "update public.products set sub_group_id=3 where id=1;\n");
    const invalidActivation = await psql(ds, "update public.product_skus set is_active=true where id=1;\n");
    check("CL9", "Direct deactivate then subgroup change allowed; subsequent direct activation refused",deactivate.code===0 && move.code===0 && invalidActivation.code!==0 && ds.one("select is_active::text from public.product_skus where id=1")==="false",invalidActivation.err.slice(0,200));
    const rollbackSql=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "experimental-parent-lock-rollback.sql"),"utf8");
    const rollback=await psql(ds,rollbackSql);
    const removed=ds.one("select to_regprocedure('public.fn_wp10_activation_parent_lock_recheck()') is null and not exists (select 1 from pg_trigger where tgname='zz_wp10_activation_parent_lock_recheck')");
    const retained=ds.one("select to_regprocedure('costing.fn_wp10_today_ist()') is not null");
    check("CL10","Fixture rollback removes correction only while retaining Phase 1",rollback.code===0 && removed==="t" && retained==="t",rollback.err.slice(0,300));
    const second=await psql(ds,rollbackSql);
    check("CL11","Rollback fails closed when correction objects already absent",second.code!==0 && /rollback refused/.test(second.err),second.err.slice(0,240));
  }
} finally {
  cluster.stop();
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ provenance: "disposable PostgreSQL, live-verbatim G1 writer and G2 route chain, synthetic tables, unapplied 05 plus experimental trigger, synthetic AFTER pause", results }, null, 2) + "\n");
process.exit(failed() ? 1 : 0);
