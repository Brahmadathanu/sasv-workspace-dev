// WP10 RM1/CL15 two-session serialization witness in a disposable Unix-socket PG only.
// Prototype is not a deployable migration and route tables are explicit stand-ins.
import fs from "node:fs";
import {spawn} from "node:child_process";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED local PostgreSQL unavailable");process.exit(2);}
const cluster=startPg(),actor=session();
const parent=fs.readFileSync(new URL("./review-only-activation-parent-lock-PROPOSAL.sql",import.meta.url),"utf8");
const mapping=fs.readFileSync(new URL("./review-only-rm1-mapping-impact-PROTOTYPE.sql",import.meta.url),"utf8");
const seedSql=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+
"insert into costing.production_route_family(id,status,effective_from) values (777,'APPROVED',date '2026-01-01');"+
"insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');"+
"insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');"+
"insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');"+
"select public.fx_complete(1,1,'ROUTE');"+
parent+mapping;
const children=[];
function run(db,sql,marker=null,hold=false){
 const ch=spawn("psql",[...cluster.connectionArgs(db),"-X","-q","-t","-A","-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","pipe"]});
 children.push(ch);
 let out="",err="",seen=false,resolveMark,rejectMark;
 const ready=new Promise((r,j)=>{resolveMark=r;rejectMark=j;});
 ch.stdout.on("data",b=>{out+=b.toString();if(marker&&!seen&&out.includes(marker)){seen=true;resolveMark();}});
 ch.stderr.on("data",b=>{err+=b.toString();});
 const done=new Promise(r=>ch.on("close",code=>{if(marker&&!seen)rejectMark(Error("barrier not reached "+marker+" "+err));r({code,out,err});}));
 if(hold)ch.stdin.write(sql);else ch.stdin.end(sql);
 return{ready,done,finish(t){if(!hold)throw Error("not held");ch.stdin.end(t);}};
}
const fresh=()=>{const db=cluster.newDb();const x=cluster.script(db,seedSql);if(x.code)throw Error("seed "+x.err.slice(-1300));return db;};
const state=db=>cluster.sql(db,"select ps.is_active::text||'|'||(costing.fn_validate_effective_product_process_route(1,current_date)->>'valid')||'|'||(select status from costing.production_route_family_product_subgroup_map where id=1) from public.product_skus ps where id=1");
const deadline=(p)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(Error("10 second marker timeout")),10000))]);
const lockWait=async(db)=>{
 for(let i=0;i<35;i++){
  const w=cluster.sql(db,"select count(*) from pg_stat_activity where application_name='rm1_map_b' and wait_event_type='Lock'");
  if(Number(w)>0)return true;
  await new Promise(r=>setTimeout(r,100));
 }
 return false;
};
let pass=0;
try{
 const db1=fresh();
 const a=run(db1,["begin;",actor,"select * from public.rpc_set_product_sku_active(1,true,'A activate');","\\echo A_READY",""].join("\n"),"A_READY",true);
 await deadline(a.ready);
 const b=run(db1,["begin;","set local application_name='rm1_map_b';","update costing.production_route_family_product_subgroup_map set status='INACTIVE',effective_to=current_date where id=1;","\\echo B_BEFORE_COMMIT","commit;",""].join("\n"),"B_BEFORE_COMMIT");
 await deadline(b.ready);
 const sawWait=await lockWait(db1);
 a.finish("commit;\n");
 const [ar,br]=await Promise.all([a.done,b.done]);
 const x={scenario:"ACTIVATION_FIRST",a_exit:ar.code,b_exit:br.code,saw_lock_wait:sawWait,final:state(db1)};
 console.log(JSON.stringify(x));
 if(ar.code!==0||br.code===0||!sawWait||x.final!=="true|true|APPROVED")throw Error("A-first RM1 invariant failed");
 pass++;
 const db2=fresh();
 const b2=run(db2,["begin;","update costing.production_route_family_product_subgroup_map set status='INACTIVE',effective_to=current_date where id=1;","\\echo MAP_CHANGED_UNCOMMITTED",""].join("\n"),"MAP_CHANGED_UNCOMMITTED",true);
 await deadline(b2.ready);
 const a2=run(db2,["begin;",actor,"select * from public.rpc_set_product_sku_active(1,true,'A after uncommitted map change');","commit;",""].join("\n"));
 const a2r=await a2.done;
 b2.finish("commit;\n");
 const b2r=await b2.done;
 const y={scenario:"MAP_UNCOMMITTED_FIRST",a_exit:a2r.code,b_exit:b2r.code,final:state(db2)};
 console.log(JSON.stringify(y));
 if(a2r.code!==0||b2r.code===0||y.final!=="true|true|APPROVED")throw Error("map-uncommitted-first invariant failed");
 pass++;
 console.log("PASS "+pass+"/2 isolation-only RM1 activation/map-change concurrency controls");
}catch(e){console.error("FAIL/BLOCKED "+e.stack);process.exitCode=1;}
finally{for(const c of children)c.kill();cluster.stop();}
