// WP10 RM1 mapped-subgroup fan-out rehearsal; 41 active products = observed live maximum
// (read-only aggregate on 17 Nov 2026). Entire execution uses disposable PostgreSQL.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED: disposable PostgreSQL unavailable");process.exit(2);}
const pg=startPg(),read=name=>fs.readFileSync(new URL(name,import.meta.url),"utf8");
const setup=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+
read("review-only-activation-parent-lock-PROPOSAL.sql")+
read("review-only-rm1-mapping-impact-PROTOTYPE.sql");
const actor=session({perms:"module:manage-products:edit,module:manage-products:view,module:production-route-manager:edit"});
let pass=0,fail=0;
const check=(name,ok,detail="")=>{console.log((ok?"PASS ":"FAIL ")+name+(detail?" — "+detail:""));ok?pass++:fail++;};
try{
 const db=pg.newDb(),boot=pg.script(db,setup);if(boot.code)throw Error("boot: "+boot.err.slice(-1300));
 const seeds=actor+`
insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01'),(778,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01'),(778,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');
insert into public.products(item,sub_group_id,status)
select 'RM1_FAN_'||g,1,'Active' from generate_series(1,40)g;
insert into public.product_skus(product_id,pack_size,uom)
select id,50,'mL' from public.products where id=1 or item like 'RM1_FAN_%';
select public.fx_complete(s.id,s.product_id,'ROUTE') from public.product_skus s;
select public.rpc_set_product_sku_active(s.id,true,'RM1 fanout fixture') from public.product_skus s;
`;
 const seedRun=pg.script(db,seeds);
 if(seedRun.code)throw Error("41 active seed: "+seedRun.err.slice(-1400));
 const active=pg.sql(db,"select count(distinct ps.product_id) from public.product_skus ps where ps.is_active and ps.product_id in (select id from public.products where sub_group_id=1)");
 check("F1 exactly 41 real-RPC-activated products share one subgroup route",active==="41",active);
 const t0=Date.now();
 const unsafe=pg.script(db,"begin; set local statement_timeout='30s'; update costing.production_route_family_product_subgroup_map set status='INACTIVE', effective_to=current_date where id=1; commit;");
 const ms1=Date.now()-t0;
 check("F2 41-product inactivation rejected atomically",unsafe.code!==0,unsafe.err.slice(-180));
 check("F3 all 41 active products retain canonical valid effective routes",
 pg.sql(db,"select count(*) from public.product_skus ps where ps.is_active and (costing.fn_validate_effective_product_process_route(ps.product_id::integer,current_date)->>'valid')='true'")==="41");
 const t1=Date.now();
 const replacement=pg.script(db,"begin; set local statement_timeout='30s';update costing.production_route_family_product_subgroup_map set status='SUPERSEDED',effective_to=date '2026-11-14' where id=1; insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values (1,778,'APPROVED',date '2026-11-15');commit;");
 const ms2=Date.now()-t1;
 check("F4 41-product valid-to-valid atomic subgroup replacement allowed",replacement.code===0,replacement.err.slice(-200));
 check("F5 41 active routes stay valid after approved replacement",
 pg.sql(db,"select count(*) from public.product_skus ps where ps.is_active and (costing.fn_validate_effective_product_process_route(ps.product_id::integer,current_date)->>'valid')='true'")==="41");
 console.log(JSON.stringify({pass,fail,active_products:41,observed_live_max:41,unsafe_reject_elapsed_ms:ms1,valid_replacement_elapsed_ms:ms2,pg_statement_timeout_ms:30000,environment:"DISPOSABLE_POSTGRESQL",performance_slo_certified:false}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{pg.stop();}
if(fail)process.exitCode=1;
