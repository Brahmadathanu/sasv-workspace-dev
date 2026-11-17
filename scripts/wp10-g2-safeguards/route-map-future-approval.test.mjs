// WP10 RM1 future-dated approval shadowing: current-route validity is insufficient.
// Disposable PostgreSQL, pinned IST fixture date 2026-11-15; no live RPC/DML.
// Baseline old RM1 checks only today; green candidate must check new approval's effective_from.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED disposable PG unavailable");process.exit(2);}
const pg=startPg(),read=n=>fs.readFileSync(new URL(n,import.meta.url),"utf8");
const cl15=read("review-only-activation-parent-lock-PROPOSAL.sql");
const rm1=read("review-only-rm1-mapping-impact-PROTOTYPE.sql");
const common=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+cl15;
const actor=session({perms:"module:manage-products:view,module:manage-products:edit,module:production-route-manager:edit"});
const seed=actor+`
insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01'),(901,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');
insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');
select public.fx_complete(1,1,'ROUTE');
select * from public.rpc_set_product_sku_active(1,true,'future-mapping-control');
insert into costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) values(1,901,'DRAFT',date '2026-11-22');
`;
const boot=guarded=>{const db=pg.newDb(),a=pg.script(db,common+(guarded?rm1:""));if(a.code)throw Error("boot "+a.err.slice(-900));const b=pg.script(db,seed);if(b.code)throw Error("seed "+b.err.slice(-900));return db;};
const validity=(db,date)=>pg.sql(db,`select costing.fn_validate_effective_product_process_route(1,date '${date}')->>'valid'`);
const promote=db=>pg.script(db,"update costing.production_route_family_product_map set status='APPROVED' where product_id=1 and status='DRAFT';");
let pass=0,fail=0;const ck=(name,ok,extra="")=>{console.log((ok?"PASS ":"FAIL ")+name+(extra?" "+extra:""));ok?pass++:fail++;};
try{
 const a=boot(false),ar=promote(a);
 ck("FM-RED1 no impact guard permits future invalidating approval",ar.code===0);
 ck("FM-RED2 current route valid while future route invalid",validity(a,"2026-11-15")==="true"&&validity(a,"2026-11-22")==="false");
 const b=boot(true),br=promote(b);
 ck("FM-GREEN1 future invalidating approval rejected",br.code!==0,br.err.slice(-250));
 ck("FM-GREEN2 rejection retains valid current route and pending draft",validity(b,"2026-11-15")==="true"&&pg.sql(b,"select status from costing.production_route_family_product_map where product_id=1")==="DRAFT");
 const c=boot(true),ready=pg.script(c,"insert into costing.production_route_family_route(route_family_id,status,effective_from) values (901,'APPROVED',date '2026-11-22');");
 if(ready.code)throw Error("future route seed "+ready.err.slice(-850));
 const cr=promote(c);
 ck("FM-GREEN3 valid future replacement allowed",cr.code===0,cr.err.slice(-250));
 ck("FM-GREEN4 current and future canonical route remain valid",validity(c,"2026-11-15")==="true"&&validity(c,"2026-11-22")==="true");
 console.log(JSON.stringify({pass,fail,mode:"DISPOSABLE_POSTGRESQL",future_policy:"new approved mapping effective_from",production_ddl:false}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{pg.stop();}
if(fail)process.exitCode=1;
