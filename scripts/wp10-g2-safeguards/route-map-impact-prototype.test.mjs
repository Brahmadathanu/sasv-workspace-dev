// WP10 RM1 correction prototype: verify deferred final-state impact guard in disposable PG only.
// This is NOT production installation approval and does not cover group/family/route writers.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED disposable PostgreSQL unavailable");process.exit(2);}
const cluster=startPg();
const parent=fs.readFileSync(new URL("./review-only-activation-parent-lock-PROPOSAL.sql",import.meta.url),"utf8");
const rm1=fs.readFileSync(new URL("./review-only-rm1-mapping-impact-PROTOTYPE.sql",import.meta.url),"utf8");
const fixture=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+"\n"+parent+"\n"+rm1;
const actor=session({perms:"module:manage-products:edit,module:manage-products:view,module:production-route-manager:edit"});
const base=[
"insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
"insert into public.product_skus(product_id,pack_size,uom) values (1,50,'mL');",
"select public.fx_complete(1,1,'ROUTE');",
"select * from public.rpc_set_product_sku_active(1,true,'test activation');"
].join("\n")+"\n";
const db=()=>{const d=cluster.newDb();const r=cluster.script(d,fixture);if(r.code)throw Error("boot "+r.err.slice(-1600));return d;};
let pass=0,fail=0;
const chk=(n,b,extra="")=>{console.log((b?"PASS ":"FAIL ")+n+(extra?" "+extra:""));b?pass++:fail++;};
const status=(d)=>cluster.sql(d,"select ps.is_active::text||'|'||(costing.fn_validate_effective_product_process_route(1,current_date)->>'valid') from public.product_skus ps where ps.id=1");
try{
 const a=db(),s=cluster.script(a,actor+base);
 if(s.code)throw Error("A seed "+s.err.slice(-1200));
 const unsafe=cluster.script(a,"update costing.production_route_family_product_subgroup_map set status='INACTIVE',effective_to=current_date where id=1;");
 chk("RM-G1 harmful subgroup inactivation rejected",unsafe.code!==0);
 chk("RM-G2 failed inactivation is atomic and active route remains valid",
  cluster.sql(a,"select status from costing.production_route_family_product_subgroup_map where id=1")==="APPROVED"&&status(a)==="true|true",status(a));
 const b=db();
 const sb=cluster.script(b,actor+base+"insert into costing.production_route_family(id,status,effective_from) values(778,'APPROVED',date '2026-01-01');\ninsert into costing.production_route_family_route(route_family_id,status,effective_from) values(778,'APPROVED',date '2026-01-01');\n");
 if(sb.code)throw Error("B seed "+sb.err.slice(-1200));
 const replacement=cluster.script(b,"begin;update costing.production_route_family_product_subgroup_map set status='SUPERSEDED',effective_to=current_date-1 where id=1; insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,778,'APPROVED',current_date);commit;");
 chk("RM-G3 atomic valid-to-valid subgroup replacement allowed",replacement.code===0,replacement.err.slice(-500));
 chk("RM-G4 approved replacement preserves active route",status(b)==="true|true",status(b));
 const c=db();const sc=cluster.script(c,actor+base);
 if(sc.code)throw Error("C seed "+sc.err.slice(-1200));
 const fallback=cluster.script(c,"insert into costing.production_route_family(id,status,effective_from) values(901,'APPROVED',date '2026-01-01');insert into costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) values(1,901,'APPROVED',date '2026-01-01');insert into costing.production_route_family_route(route_family_id,status,effective_from) values(901,'APPROVED',date '2026-01-01');");
 if(fallback.code)throw Error("C product override "+fallback.err.slice(-1200));
 const unaffected=cluster.script(c,"update costing.production_route_family_product_subgroup_map set status='INACTIVE',effective_to=current_date where id=1;");
 chk("RM-G5 unaffected subgroup mapping inactivation allowed with effective product-level route",unaffected.code===0,unaffected.err.slice(-500));
 chk("RM-G6 product-level route still valid",status(c)==="true|true",status(c));
 const d=db();
 const sd=cluster.script(d,actor+"insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');");
 if(sd.code)throw Error("D seed "+sd.err.slice(-1200));
 const noActive=cluster.script(d,"update costing.production_route_family_product_subgroup_map set status='INACTIVE',effective_to=current_date where id=1;");
 chk("RM-G7 no-active-SKU route-map inactivation allowed",noActive.code===0,noActive.err.slice(-500));
 const e=db(),se=cluster.script(e,actor+base);
 if(se.code)throw Error("E seed "+se.err.slice(-1200));
 const invalid=cluster.script(e,"update costing.production_route_family_product_subgroup_map set status='INACTIVE',effective_to=current_date where id=1;");
 chk("RM-G8 rejection does not write a readiness-invalidating business state",invalid.code!==0 && status(e)==="true|true");
 const g=db();
 const groupSeed=cluster.script(g,actor+
 "insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');"+
 "insert into costing.production_route_family_product_group_map(product_group_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');"+
 "insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');"+
 "insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');"+
 "select public.fx_complete(1,1,'ROUTE');"+
 "select * from public.rpc_set_product_sku_active(1,true,'group route');");
 if(groupSeed.code)throw Error("G seed "+groupSeed.err.slice(-1200));
 const groupUnsafe=cluster.script(g,"update costing.production_route_family_product_group_map set status='INACTIVE',effective_to=current_date where id=1;");
 chk("RM-G9 harmful group-level mapping inactivation rejected",groupUnsafe.code!==0,groupUnsafe.err.slice(-400));
 chk("RM-G10 active group-inherited route preserved",status(g)==="true|true",status(g));

 console.log(JSON.stringify({pass,fail,provenance:"DISPOSABLE_POSTGRESQL_ONLY",guard_scope:"product-subgroup-group-maps",other_route_writers:"UNRESOLVED"}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{cluster.stop();}
if(fail)process.exitCode=1;
