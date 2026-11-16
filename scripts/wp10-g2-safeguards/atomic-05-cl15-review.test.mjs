// WP10 05+CL15 candidate installation/rollback; isolated disposable PG only.
// Checks exact atomic generator output, safeguards behaviour, scoped rollback, and receipt drift rejection.
// The candidate SQL is REVIEW ONLY and NEVER applied to a live database by this test.
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {pgAvailable,startPg,g2FixtureSql,makeRunner,session,T,ACTIVATE} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED disposable PG unavailable");process.exit(2);}
const cluster=startPg();
const sql=execFileSync(process.execPath,[new URL("./gen-atomic-05-cl15-review.mjs",import.meta.url).pathname],{encoding:"utf8"});
const rollback=fs.readFileSync(new URL("./review-only-atomic-05-cl15-scoped-rollback.sql",import.meta.url),"utf8");
let pass=0;
function check(label,ok){if(!ok)throw Error("FAIL "+label);console.log("PASS "+label);pass++;}
try{
 const run=makeRunner(cluster,{sql:g2FixtureSql({load:["clock","states","reparent"]})+"\n"+sql});
 const route=[
 "insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
 "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');",
 "insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
 "insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');",
 "select public.fx_complete(1,1,'ROUTE');"
 ].join("\n")+"\n";
 const writer="select * from public.rpc_update_product(1,'P1',3,'ml','Active',null,null,false,false,null,null,false,'atomic guard check')";
 const s=run(session()+route+ACTIVATE(1)+T("harmful",writer));
 check("A1 atomic review-only source creates exactly three targeted triggers",
   s.one("select count(*) from pg_trigger where tgname in ('trg_wp10_product_route_impact_before','trg_wp10_product_route_impact_after','trg_aa_wp10_activation_parent_lock')")==="3");
 check("A2 active SKU route-loss rejected by combined original05+parent lock",s.log.harmful?.ok===false);
 check("A3 no business row change after rejected product edit",s.one("select sub_group_id from public.products where id=1")==="1");
 const rollbackResult=cluster.script(s.db,rollback);
 check("R1 exact receipt-verified 05+CL15 scoped rollback succeeds",rollbackResult.code===0);
 check("R2 original WP10 Phase1 helpers remain untouched",
   s.one("select count(*) from pg_proc where proname in ('fn_wp10_today_ist','fn_wp10_batch_size_state_as_of')")==="2");
 check("R3 only target 05+CL15 functions removed",
   s.one("select count(*) from pg_proc where proname in ('fn_wp10_product_route_impact_before','fn_wp10_product_route_impact_after','fn_wp10_activation_parent_lock')")==="0");
 const t=run(session()+route+ACTIVATE(1));
 cluster.sql(t.db,"comment on function public.fn_wp10_activation_parent_lock() is 'tampered';");
 const negative=cluster.script(t.db,rollback);
 check("R4 provenance tamper aborts rollback",negative.code!==0);
 check("R5 no partial drop on provenance mismatch",
   t.one("select count(*) from pg_trigger where tgname in ('trg_wp10_product_route_impact_before','trg_wp10_product_route_impact_after','trg_aa_wp10_activation_parent_lock')")==="3");
 console.log(JSON.stringify({pass,fail:0,provenance:"DISPOSABLE_POSTGRESQL_ONLY",production_execution:false}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);process.exitCode=1;}
finally{cluster.stop();}
