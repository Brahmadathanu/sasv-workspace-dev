// WP10 RM1 mapping target-reassignment regression. Privileged mutation is not available
// to authenticated table callers today, but must not be silently treated metadata-only.
// RED models old reviewed guard; GREEN validates old/new affected active product at COMMIT.
// Entirely disposable PostgreSQL.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED isolated PostgreSQL unavailable");process.exit(2);}
const pg=startPg(),read=n=>fs.readFileSync(new URL(n,import.meta.url),"utf8");
const rm1=read("review-only-rm1-mapping-impact-PROTOTYPE.sql");
const old=rm1.replace(/^\s*and \(v_old->>'(?:product_id|product_subgroup_id|product_group_id)'\) is not distinct from \(v_new->>'(?:product_id|product_subgroup_id|product_group_id)'\)\s*$/gm,"");
if(old===rm1||old.includes("and (v_old->>'product_id') is not distinct from"))throw Error("could not reconstruct previous metadata-only omission");
const base=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+read("review-only-activation-parent-lock-PROPOSAL.sql");
const actor=session({perms:"module:manage-products:view,module:manage-products:edit,module:production-route-manager:edit"});
const setup=(which,guard)=>{
 const db=pg.newDb(),a=pg.script(db,base+(guard==="old"?old:guard==="new"?rm1:""));
 if(a.code)throw Error("boot "+a.err.slice(-900));
 const spec={
  product:{table:"production_route_family_product_map",column:"product_id",replacement:8},
  subgroup:{table:"production_route_family_product_subgroup_map",column:"product_subgroup_id",replacement:2},
  group:{table:"production_route_family_product_group_map",column:"product_group_id",replacement:2}
 }[which];
 const sm=spec.table,col=spec.column;
 const seed=actor+`
 insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');
 insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');
 insert into costing.${sm}(${col},route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');
 insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');
 select public.fx_complete(1,1,'ROUTE');
 select public.rpc_set_product_sku_active(1,true,'map target fixture');
 `;
 const b=pg.script(db,seed);if(b.code)throw Error("seed "+b.err.slice(-1200));
 return db;
};
let pass=0,fail=0;const check=(id,ok,detail="")=>{console.log((ok?"PASS ":"FAIL ")+id+(detail?" — "+detail:""));ok?pass++:fail++;};
const validity=db=>pg.sql(db,"select costing.fn_validate_effective_product_process_route(1,date '2026-11-15')->>'valid'");
try{
 for(const kind of ["product","subgroup","group"]){
  const spec={
   product:{table:"production_route_family_product_map",column:"product_id",replacement:8},
   subgroup:{table:"production_route_family_product_subgroup_map",column:"product_subgroup_id",replacement:2},
   group:{table:"production_route_family_product_group_map",column:"product_group_id",replacement:2}
  }[kind];
  const tbl=spec.table,col=spec.column,target=spec.replacement;
  const update=`update costing.${tbl} set ${col}=${target} where ${col}=1;`;
  const red=setup(kind,"old"),rr=pg.script(red,update);
  check(kind+"-RED1 old metadata-only shortcut permits mapping target reassignment",rr.code===0,rr.err.slice(-180));
  check(kind+"-RED2 old shortcut leaves active original product route invalid",validity(red)==="false");
  const green=setup(kind,"new"),gr=pg.script(green,update);
  check(kind+"-GREEN1 revised guard rejects rerouting without effective replacement",gr.code!==0&&/WP10_RM1_ROUTE_IMPACT_REJECTED/.test(gr.err),gr.err.slice(-230));
  check(kind+"-GREEN2 failed transaction retains mapping target and valid active route",
   validity(green)==="true"&&pg.sql(green,`select ${col} from costing.${tbl} where id=1`)==="1");
 }
 console.log(JSON.stringify({pass,fail,mode:"DISPOSABLE_POSTGRESQL",current_authenticated_DML_on_route_map:false,production_execution:false}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{pg.stop();}
if(fail)process.exitCode=1;
