// RM1 reviewed RPC contract patch — 3-arg subgroup inactivation with mandatory audit reason.
// Disposable PostgreSQL only. Preserves live two-arg function body and active-route constraint.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session,makeRunner,T,ACTIVATE} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED: local PostgreSQL unavailable");process.exit(2);}
const cluster=startPg();
const read=name=>fs.readFileSync(new URL(name,import.meta.url),"utf8");
const from=read("route-map-lifecycle-gap.test.mjs");
const extracted=from.match(/const liveRpc=String\.raw\x60([\s\S]*?)\x60;/);
if(!extracted)throw Error("existing live-verbatim RPC control-flow fixture not found");
const sql=g2FixtureSql({load:["clock","states","reparent","route"]})+
 "\n"+extracted[1]+
 "\n"+read("review-only-activation-parent-lock-PROPOSAL.sql")+
 "\n"+read("review-only-rm1-mapping-impact-PROTOTYPE.sql")+
 "\n"+read("review-only-rm1-subgroup-inactivation-reason-contract.sql");
const run=makeRunner(cluster,{sql});
const editor=session({perms:"module:manage-products:edit,module:manage-products:view,module:production-route-manager:edit"});
const family=`
insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_route(route_family_id,status,effective_from) values (777,'APPROVED',date '2026-01-01');
`;
let pass=0,fail=0;const check=(name,cond)=>{console.log((cond?"PASS ":"FAIL ")+name);cond?pass++:fail++;};
try{
 const good=run(editor+family+
 "insert into public.product_skus(product_id,pack_size,uom) values (1,50,'mL');"+
 "select public.fx_complete(1,1,'ROUTE');"+
 ACTIVATE(1));
 const unsafeCall=cluster.script(good.db,editor+"select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15','Approved production route must not be lost');");
 const blankCall=cluster.script(good.db,editor+"select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15','   ');");
 check("C1 three-argument live-client-compatible overload available",
   good.one("select count(*) from pg_proc where oid=to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text)')")==="1");
 check("C2 unsafe inactivation rejected by route-integrity guard",unsafeCall.code!==0 && /WP10_RM1_ROUTE_IMPACT_REJECTED/.test(unsafeCall.err));
 check("C3 rejected mapping has no inactivation audit event",good.one("select count(*) from costing.production_route_family_product_subgroup_inactivation_audit")==="0");
 check("C4 no partial status change after rejected RPC",good.one("select status from costing.production_route_family_product_subgroup_map where id=1")==="APPROVED");
 check("C5 missing reason rejected",blankCall.code!==0 && /meaningful inactivation reason/.test(blankCall.err));
 const over=run(editor+family+
 "insert into costing.production_route_family(id,status,effective_from) values(901,'APPROVED',date '2026-01-01');"+
 "insert into costing.production_route_family_route(route_family_id,status,effective_from) values(901,'APPROVED',date '2026-01-01');"+
 "insert into costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) values(1,901,'APPROVED',date '2026-01-01');"+
 "insert into public.product_skus(product_id,pack_size,uom) values (1,50,'mL');"+
 "select public.fx_complete(1,1,'ROUTE');"+
 ACTIVATE(1)+
 T("safe","select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15','Product-level approved route remains effective')"));
 check("C6 unaffected subgroup mapping inactivation succeeds",over.log.safe?.ok===true);
 check("C7 one durable reason event recorded",over.one("select count(*) from costing.production_route_family_product_subgroup_inactivation_audit")==="1");
 check("C8 exact user reason preserved",over.one("select inactivation_reason from costing.production_route_family_product_subgroup_inactivation_audit limit 1")==="Product-level approved route remains effective");
 check("C9 private audit table DML denied to authenticated",over.one("select has_table_privilege('authenticated','costing.production_route_family_product_subgroup_inactivation_audit','INSERT')::text")==="false");
 check("C10 successful audit and inactivation atomic",over.one("select status from costing.production_route_family_product_subgroup_map where id=1")==="INACTIVE");
 const denied=run(family+
 T("permission","select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15','A genuine reason but no module edit')"));
 check("C11 no editor permission rejects request",denied.log.permission?.ok===false);
 const legacy=run(editor+family+
  T("legacy_two_arg","select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15')"));
 check("C12 legacy two-arg invocation still succeeds under prior edit permission",legacy.log.legacy_two_arg?.ok===true);
 check("C13 legacy two-arg invocation leaves no required reason audit (cutover risk)",
  legacy.one("select status from costing.production_route_family_product_subgroup_map where id=1")==="INACTIVE" &&
  legacy.one("select count(*) from costing.production_route_family_product_subgroup_inactivation_audit")==="0");
 // This is intentionally a positive proof of an OPEN governance hole. The three-arg overload
 // cannot enforce reason capture while legacy two-arg EXECUTE is still available.

 console.log(JSON.stringify({pass,fail,isolation:"DISPOSABLE_ONLY",production_ddl:false}));
}catch(err){console.error("FAIL/BLOCKED "+err.stack);fail++;}
finally{cluster.stop();}
if(fail)process.exitCode=1;
