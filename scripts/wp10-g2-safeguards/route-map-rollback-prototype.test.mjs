// WP10 RM1 independent receipt-verified scoped rollback, disposable PostgreSQL ONLY.
import fs from "node:fs";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED isolated PostgreSQL unavailable");process.exit(2);}
const cluster=startPg();
const load=name=>fs.readFileSync(new URL(name,import.meta.url),"utf8");
const init=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+
 load("review-only-activation-parent-lock-PROPOSAL.sql")+"\n"+
 load("review-only-rm1-mapping-impact-PROTOTYPE.sql");
const rollback=load("review-only-rm1-mapping-impact-scoped-rollback.sql");
const expected="('trg_wp10_rm1_product_mapping_impact','trg_wp10_rm1_subgroup_mapping_impact','trg_wp10_rm1_group_mapping_impact')";
let pass=0,fail=0;
const check=(name,ok,extra="")=>{console.log((ok?"PASS ":"FAIL ")+name+(extra?" — "+extra:""));ok?pass++:fail++;};
const fresh=()=>{const db=cluster.newDb();const x=cluster.script(db,init);if(x.code)throw Error("setup "+x.err.slice(-1600));return db;};
const count=(db)=>cluster.sql(db,"select count(*) from pg_trigger where tgname in "+expected);
try{
 const d=fresh();
 check("RB1 three candidate mapping triggers exist before rollback",count(d)==="3");
 const result=cluster.script(d,rollback);
 check("RB2 pristine exactly scoped RM1 rollback succeeds",result.code===0,result.err.slice(-600));
 check("RB3 candidate mapping triggers removed",count(d)==="0");
 check("RB4 parent-lock prerequisite remains installed",
   cluster.sql(d,"select count(*) from pg_trigger where tgname='trg_aa_wp10_activation_parent_lock'")==="1");
 check("RB5 original Phase1 WP10 clock helper remains installed",
   cluster.sql(d,"select count(*) from pg_proc where proname='fn_wp10_today_ist'")==="1");
 const changed=fresh();
 cluster.sql(changed,"comment on function costing.fn_wp10_rm1_deferred_mapping_impact() is 'tampered';");
 const bad=cluster.script(changed,rollback);
 check("RB6 edited function receipt fails closed",bad.code!==0);
 check("RB7 rollback cannot partly drop triggers on drift",count(changed)==="3");
 const altered=fresh();
 cluster.sql(altered,"comment on trigger trg_wp10_rm1_product_mapping_impact on costing.production_route_family_product_map is 'tampered';");
 const denied=cluster.script(altered,rollback);
 check("RB8 altered trigger receipt fails closed",denied.code!==0);
 check("RB9 altered trigger receipt preserves all three",count(altered)==="3");
 console.log(JSON.stringify({pass,fail,mode:"DISPOSABLE_POSTGRESQL",scope:"RM1_ONLY",original_lifecycle_untouched:true}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{cluster.stop();}
if(fail)process.exitCode=1;
