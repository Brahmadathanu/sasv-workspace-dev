// WP10/CL15 reverse-order and contention controls. Disposable Unix-socket PG only.
import fs from "node:fs";
import {spawn} from "node:child_process";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED: disposable PG unavailable");process.exit(2);}
const cluster=startPg(),sess=session();
const candidate=fs.readFileSync(new URL("./review-only-activation-parent-lock-PROPOSAL.sql",import.meta.url),"utf8");
const route=[
"insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');",
"insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');",
"insert into public.product_skus(product_id,pack_size,uom) values(1,50,'mL');",
"select public.fx_complete(1,1,'ROUTE');"
].join("\n");
const fixture=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+route+"\n"+candidate;
function run(db,sql,marker=null,hold=false){
 const ch=spawn("psql",[...cluster.connectionArgs(db),"-X","-q","-t","-A","-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","pipe"]});
 let out="",err="",seen=false,resolveMarker,rejectMarker;
 const ready=new Promise((r,j)=>{resolveMarker=r;rejectMarker=j});
 ch.stdout.on("data",b=>{out+=b.toString();if(marker&&!seen&&out.includes(marker)){seen=true;resolveMarker();}});
 ch.stderr.on("data",b=>{err+=b.toString();});
 const end=new Promise(r=>ch.on("close",code=>{if(marker&&!seen)rejectMarker(Error("marker absent "+marker+" "+err));r({code,out,err});}));
 if(hold)ch.stdin.write(sql);else ch.stdin.end(sql);
 return{ch,ready,end,finish(t){if(!hold)throw Error("not held");ch.stdin.end(t);}};
}
async function barrier(p,label){await Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(Error(label+" barrier timeout")),10000))]);}
async function awaitLock(db,app){
 for(let i=0;i<30;i++){
  const state=cluster.sql(db,"select coalesce(max(wait_event_type),'') from pg_stat_activity where application_name='"+app+"'");
  if(state==="Lock")return true;
  await new Promise(r=>setTimeout(r,100));
 }
 return false;
}
const seedDb=()=>{const db=cluster.newDb(),b=cluster.script(db,fixture);if(b.code)throw Error("fixture setup: "+b.err.slice(-3000));return db;};
const final=db=>cluster.sql(db,"select ps.is_active::text||'|'||p.sub_group_id::text||'|'||(costing.fn_validate_effective_product_process_route(1,date '2026-11-15')->>'valid') from public.product_skus ps join public.products p on p.id=ps.product_id where ps.id=1");
const children=[];
try{
 const db=seedDb();
 const b=run(db,["begin;",sess,"select * from public.rpc_update_product(1,'P1',3,'ml','Active',null,null,false,false,null,null,false,'B first subgroup edit');","\\echo B_UPDATED",""].join("\n"),"B_UPDATED",true);
 children.push(b.ch);await barrier(b.ready,"B update");
 const a=run(db,["begin;",sess,"set local application_name='wp10_cl15_bfirst_A';","\\echo A_ATTEMPT","select * from public.rpc_set_product_sku_active(1,true,'A after B');","commit;",""].join("\n"),"A_ATTEMPT");
 children.push(a.ch);await barrier(a.ready,"A attempt");
 const waited=await awaitLock(db,"wp10_cl15_bfirst_A");
 b.finish("commit;\n");
 const [be,ae]=await Promise.all([b.end,a.end]);
 const x={scenario:"B_FIRST",saw_lock:waited,b_exit:be.code,a_exit:ae.code,a_error:ae.err.slice(-600),final:final(db)};
 console.log(JSON.stringify(x,null,2));
 if(!waited||be.code!==0||ae.code===0||x.final!=="false|3|false")throw Error("B-first route recheck failed");
 const db2=seedDb();
 const a2=run(db2,["begin;",sess,"select * from public.rpc_set_product_sku_active(1,true,'A first');","\\echo A_LOCKED",""].join("\n"),"A_LOCKED",true);
 children.push(a2.ch);await barrier(a2.ready,"A share lock");
 const b2=run(db2,["begin;",sess,"set local lock_timeout='400ms';","select * from public.rpc_update_product(1,'P1',3,'ml','Active',null,null,false,false,null,null,false,'B timeout');","commit;",""].join("\n"));
 children.push(b2.ch);
 const b2e=await b2.end;
 a2.finish("commit;\n");
 const a2e=await a2.end;
 const y={scenario:"A_FIRST_TIMEOUT",a_exit:a2e.code,b_exit:b2e.code,b_error:b2e.err.slice(-600),final:final(db2)};
 console.log(JSON.stringify(y,null,2));
 if(a2e.code!==0||b2e.code===0||!/(lock timeout|55P03)/i.test(b2e.err)||y.final!=="true|1|true")throw Error("A-first timeout control failed");
 console.log("PASS 2/2 isolated reverse order and lock-timeout controls");
}catch(e){console.error("FAIL/BLOCKED "+e.stack);process.exitCode=1;}
finally{for(const child of children)child.kill();cluster.stop();}
