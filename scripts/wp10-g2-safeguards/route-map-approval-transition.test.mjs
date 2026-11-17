// WP10 RM1 critical approval-transition regression. Entirely disposable PG, no Supabase DML.
// RED: without RM1, approving a higher-precedence product mapping to a family with no route
// silently invalidates a valid active SKU. GREEN: RM1 must veto Draft->Approved and direct
// approved insertion while allowing a valid approved replacement.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED isolated PostgreSQL unavailable");process.exit(2);}
const cluster=startPg();
const parent=fs.readFileSync(new URL("./review-only-activation-parent-lock-PROPOSAL.sql",import.meta.url),"utf8");
const rm1=fs.readFileSync(new URL("./review-only-rm1-mapping-impact-PROTOTYPE.sql",import.meta.url),"utf8");
const base=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+parent;
const seed=[
"insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family(id,status,effective_from) values(901,'APPROVED',date '2026-01-01');",
"insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');",
"select public.fx_complete(1,1,'ROUTE');",
"select * from public.rpc_set_product_sku_active(1,true,'RM1 approval test');",
"insert into costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) values(1,901,'DRAFT',date '2026-01-01');"
].join("\n")+"\n";
const actor=session({perms:"module:manage-products:view,module:manage-products:edit,module:production-route-manager:edit"});
let pass=0,fail=0;
const chk=(name,ok,extra="")=>{console.log((ok?"PASS ":"FAIL ")+name+(extra?" — "+extra:""));ok?pass++:fail++;};
const setup=(guarded)=>{let d=cluster.newDb(),f=cluster.script(d,base+(guarded?"\n"+rm1:""));if(f.code)throw Error("fixture "+f.err.slice(-1800));f=cluster.script(d,actor+seed);if(f.code)throw Error("seed "+f.err.slice(-1800));return d;};
const valid=d=>cluster.sql(d,"select costing.fn_validate_effective_product_process_route(1,current_date)->>'valid'");
try{
 const red=setup(false);
 const r=cluster.script(red,"update costing.production_route_family_product_map set status='APPROVED' where product_id=1 and status='DRAFT';");
 chk("AP-RED1 baseline Draft->Approved commits without continuity veto",r.code===0);
 chk("AP-RED2 active SKU route now invalid due to shadowing product map",valid(red)==="false");
 const green=setup(true);
 const g=cluster.script(green,"update costing.production_route_family_product_map set status='APPROVED' where product_id=1 and status='DRAFT';");
 chk("AP-GREEN1 review-only guard rejects unsafe Draft->Approved",g.code!==0,g.err.slice(-300));
 chk("AP-GREEN2 rejected promotion preserves valid route",
  valid(green)==="true"&&cluster.sql(green,"select status from costing.production_route_family_product_map where product_id=1")==="DRAFT");
 const greenInsert=setup(true);
 const ins=cluster.script(greenInsert,
  "insert into costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) values(1,901,'APPROVED',date '2026-01-01');");
 chk("AP-GREEN3 directly inserted approved shadow mapping rejected",ins.code!==0,ins.err.slice(-300));
 chk("AP-GREEN4 no invalid approved mapping survives failed insert",
  valid(greenInsert)==="true"&&cluster.sql(greenInsert,"select count(*) from costing.production_route_family_product_map where status='APPROVED'")==="0");
 const greenValid=setup(true);
 const complete=cluster.script(greenValid,"insert into costing.production_route_family_route(route_family_id,status,effective_from) values(901,'APPROVED',date '2026-01-01');");
 if(complete.code)throw Error("valid route seed "+complete.err.slice(-900));
 const ok=cluster.script(greenValid,"update costing.production_route_family_product_map set status='APPROVED' where product_id=1 and status='DRAFT';");
 chk("AP-GREEN5 valid promotion to family with approved route allowed",ok.code===0,ok.err.slice(-250));
 chk("AP-GREEN6 valid active route remains effective",valid(greenValid)==="true");
 console.log(JSON.stringify({pass,fail,environment:"DISPOSABLE_POSTGRESQL_ONLY",live_INCIDENT:false,coverage:"Draft promotion and approved INSERT"}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{cluster.stop();}
if(fail)process.exitCode=1;
