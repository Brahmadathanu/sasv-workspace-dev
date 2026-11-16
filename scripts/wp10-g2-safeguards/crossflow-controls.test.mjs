// WP10 CL15 secondary controls: disposable PostgreSQL only, original 05 + review-only activation parent lock.
// No Supabase connections, no production migrations, and route map mutation is deliberately classified as a residual.
import fs from "node:fs";
import { pgAvailable, startPg, g2FixtureSql, makeRunner, session, T, ACTIVATE } from "./fixture.mjs";
if(!pgAvailable()){ console.error("BLOCKED: disposable PostgreSQL unavailable");process.exit(2); }
const cluster=startPg();
let pass=0,fail=0;
const check=(name,ok,info="")=>{console.log((ok?"PASS ":"FAIL ")+name+(info?" — "+info:""));if(ok)pass++;else fail++;};
const candidate=fs.readFileSync(new URL("./review-only-activation-parent-lock-PROPOSAL.sql",import.meta.url),"utf8");
const setup=g2FixtureSql({load:["clock","states","reparent","route"]})+"\n"+candidate;
const route1=`
insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');
`;
const createS=`insert into public.product_skus(product_id,pack_size,uom) values (1,50,'mL');select public.fx_complete(1,1,'ROUTE');\n`;
const upd=(sg,status="Active",reason="isolated")=>`select * from public.rpc_update_product(1,'P1',${sg},'ml','${status}',null,null,false,false,null,null,false,'${reason}')`;
try {
  const run=makeRunner(cluster,{sql:setup});
  {
    const s=run(session()+route1+createS+
      T("empty_move",upd(3))+
      T("activation_after_move",ACTIVATE(1))+
      T("privileged_direct_activation","update public.product_skus set is_active=true where id=1"));
    check("B1 no-active-SKU move allowed",s.log.empty_move?.ok===true);
    check("B2 B-first activation rechecks invalid committed route and is rejected",
      s.log.activation_after_move?.ok===false && s.one("select is_active::text from public.product_skus where id=1")==="false");
    check("B3 privileged direct activation cannot bypass existing five-essential validation",
      s.log.privileged_direct_activation?.ok===false && s.one("select is_active::text from public.product_skus where id=1")==="false");
  }
  {
    const s=run(session()+route1+createS+ACTIVATE(1)+
      "insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (2,777,'APPROVED',date '2026-01-01');\n"+
      T("valid_to_valid",upd(2))+
      T("parent_inactivation",upd(2,"Inactive","cannot inactivate with active child"))+
      T("harmful_move",upd(3)));
    check("V1 active SKU permitted valid-to-valid subgroup reassignment",
      s.log.valid_to_valid?.ok===true && s.one("select sub_group_id from public.products where id=1")==="2");
    check("V2 existing product inactive-with-active-child guard still rejects",
      s.log.parent_inactivation?.ok===false && s.one("select status from public.products where id=1")==="Active");
    check("V3 harmful valid-to-invalid edit rejected even without a concurrent writer",
      s.log.harmful_move?.ok===false && s.one("select sub_group_id from public.products where id=1")==="2");
    const s2=run(session()+route1+createS+ACTIVATE(1)+
      "insert into public.product_skus(product_id,pack_size,uom) values (1,75,'mL');select public.fx_complete(2,1,'ROUTE');\n"+ACTIVATE(2)+
      T("two_active_harmful",upd(3)));
    check("M1 two active SKUs protect the same parent from harmful move",
      s2.log.two_active_harmful?.ok===false &&
      s2.one("select count(*) from public.product_skus where is_active and product_id=1")==="2" &&
      s2.one("select sub_group_id from public.products where id=1")==="1");
    // Out-of-scope mapping edit is intentionally demonstrated, NOT counted as a resolved safety guard.
    const s3=run(session()+route1+createS+ACTIVATE(1)+
      T("remove_active_route_mapping","delete from costing.production_route_family_product_subgroup_map where product_subgroup_id=1"));
    check("RESIDUAL-RM1 route map can still be removed from beneath an active SKU (NOT CLOSED)",
      s3.log.remove_active_route_mapping?.ok===true &&
      s3.one("select costing.fn_validate_effective_product_process_route(1,date '2026-11-15')->>'valid'")==="false");
  }
} catch(e){console.error("BLOCKED: "+e.stack);fail++;}
finally{cluster.stop();}
console.log(JSON.stringify({pass,fail,provenance:"ISOLATED_PG_ROUTE_STANDINS",route_manager_guard:"NOT_CLOSED"}));
if(fail)process.exitCode=1;
