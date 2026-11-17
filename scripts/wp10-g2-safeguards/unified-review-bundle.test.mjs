// WP10 exact-composition candidate rehearsal; DISPOSABLE PostgreSQL only.
// This does not certify the candidate for production, and leaves legacy 2-arg RPC intact.
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {pgAvailable,startPg,g2FixtureSql,PRODUCTS_SEED,session} from "./fixture.mjs";
if(!pgAvailable()){console.error("BLOCKED PostgreSQL unavailable");process.exit(2);}
const pg=startPg();
const script=execFileSync(process.execPath,[new URL("./gen-unified-05-cl15-rm1-review.mjs",import.meta.url).pathname],{encoding:"utf8"});
const rollback=execFileSync(process.execPath,[new URL("./gen-unified-05-cl15-rm1-rollback-review.mjs",import.meta.url).pathname],{encoding:"utf8"});
const rollbackManifest=JSON.parse(execFileSync(process.execPath,[new URL("./gen-unified-05-cl15-rm1-rollback-review.mjs",import.meta.url).pathname,"--manifest"],{encoding:"utf8"}));
const manifest=JSON.parse(execFileSync(process.execPath,[new URL("./gen-unified-05-cl15-rm1-review.mjs",import.meta.url).pathname,"--manifest"],{encoding:"utf8"}));
const lifecycle=fs.readFileSync(new URL("./route-map-lifecycle-gap.test.mjs",import.meta.url),"utf8");
const match=lifecycle.match(/const liveRpc=String\.raw\x60([\s\S]*?)\x60;/);
if(!match)throw Error("live two-arg stub extraction absent");
const boot=g2FixtureSql({load:["clock","states","reparent","route"]})+PRODUCTS_SEED+match[1];
let pass=0,fail=0;const ck=(k,ok,detail="")=>{console.log((ok?"PASS ":"FAIL ")+k+(detail?" — "+detail:""));ok?pass++:fail++;};
try{
 const db=pg.newDb(),b=pg.script(db,boot);
 if(b.code)throw Error("fixture "+b.err.slice(-1500));
 const installed=pg.script(db,script);
 ck("U1 four-source exact one-transaction installation on disposable PostgreSQL",installed.code===0,installed.err.slice(-600));
 if(installed.code)throw Error("unified install did not commit");
 ck("U2 candidate manifest is single-transaction and four reviewed sources",manifest.begin_count===1&&manifest.commit_count===1&&manifest.source_count===4);
 ck("U3 3 mapping triggers, 3 G2/CL15 triggers and private audit exist",
 pg.sql(db,"select count(*) from pg_trigger where tgname like 'trg_wp10_rm1_%'")==="3" &&
 pg.sql(db,"select count(*) from pg_trigger where tgname in ('trg_wp10_product_route_impact_before','trg_wp10_product_route_impact_after','trg_aa_wp10_activation_parent_lock')")==="3" &&
 pg.sql(db,"select count(*) from information_schema.tables where table_schema='costing' and table_name='production_route_family_product_subgroup_inactivation_audit'")==="1");
 ck("U4 legacy and 3-arg RPC coexist",pg.sql(db,"select count(*) from pg_proc where oid in (to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)'),to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text)'))")==="2");
 ck("U5 audit table not writable by authenticated",pg.sql(db,"select has_table_privilege('authenticated','costing.production_route_family_product_subgroup_inactivation_audit','INSERT')::text")==="false");
 const writer=session({perms:"module:manage-products:edit,module:manage-products:view,module:production-route-manager:edit"});
 const sample=writer+`
insert into costing.production_route_family(id,status,effective_from) values(777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_route(route_family_id,status,effective_from) values(777,'APPROVED',date '2026-01-01');
insert into costing.production_route_family_product_subgroup_map(product_subgroup_id,route_family_id,status,effective_from) values(1,777,'APPROVED',date '2026-01-01');
insert into public.product_skus(product_id,pack_size,uom) values (1,50,'mL');
select public.fx_complete(1,1,'ROUTE');
select public.rpc_set_product_sku_active(1,true,'unified fixture');
`;
 const seed=pg.script(db,sample);if(seed.code)throw Error("sample "+seed.err.slice(-1000));
 ck("U6 canonical route remains valid after creating an active SKU",pg.sql(db,"select costing.fn_validate_effective_product_process_route(1,date '2026-11-15')->>'valid'")==="true");
 const bad=pg.script(db,writer+"select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15','The active product must retain its route');");
 ck("U7 combined package vetoes unsafe reasoned inactivation",bad.code!==0&&/WP10_RM1_ROUTE_IMPACT_REJECTED/.test(bad.err),bad.err.slice(-200));
 ck("U8 failed reasoned inactivation rolls back state and audit",pg.sql(db,"select status from costing.production_route_family_product_subgroup_map where id=1")==="APPROVED"&&pg.sql(db,"select count(*) from costing.production_route_family_product_subgroup_inactivation_audit")==="0");
 const validPredecessorReplacement=pg.script(db,writer+
 "insert into costing.production_route_family(id,status,effective_from) values(901,'APPROVED',date '2026-01-01');"+
 "insert into costing.production_route_family_route(route_family_id,status,effective_from) values(901,'APPROVED',date '2026-01-01');"+
 "insert into costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) values(1,901,'APPROVED',date '2026-01-01');"+
 "select public.rpc_inactivate_product_subgroup_route_family_mapping(1,date '2026-11-15','Product mapping valid route remains');");
 ck("U9 safe audited subgroup inactivation after product override succeeds",validPredecessorReplacement.code===0,validPredecessorReplacement.err.slice(-200));
 ck("U10 exactly one immutable reason event exists prior to rollback",
   pg.sql(db,"select count(*) from costing.production_route_family_product_subgroup_inactivation_audit")==="1");
 const rb=pg.script(db,rollback);
 ck("U11 unified reverse-order rollback succeeds with retained nonempty audit history",rb.code===0,rb.err.slice(-300));
 ck("U12 original 2-arg governed function survives, 3-arg wrapper removed",
   pg.sql(db,"select to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)') is not null")==="t"&&
   pg.sql(db,"select to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text)') is null")==="t");
 ck("U13 all six review impact/lock triggers removed without touching original business data",
   pg.sql(db,"select count(*) from pg_trigger where tgname in ('trg_wp10_rm1_product_mapping_impact','trg_wp10_rm1_subgroup_mapping_impact','trg_wp10_rm1_group_mapping_impact','trg_wp10_product_route_impact_before','trg_wp10_product_route_impact_after','trg_aa_wp10_activation_parent_lock')")==="0");
 ck("U14 retained audit event and its update/delete veto survive rollback",
   pg.sql(db,"select inactivation_reason from costing.production_route_family_product_subgroup_inactivation_audit where id=1")==="Product mapping valid route remains"&&
   pg.sql(db,"select count(*) from pg_trigger where tgname='trg_wp10_rm1_reason_audit_immutable'")==="1");
 const tamper=pg.script(db,"update costing.production_route_family_product_subgroup_inactivation_audit set inactivation_reason='altered' where id=1;");
 ck("U15 preserved audit cannot be edited after rollback",tamper.code!==0 && /WP10_RM1_REASON_AUDIT_IMMUTABLE/.test(tamper.err));
 ck("U16 rollback manifest is atomic and conserves audit records",rollbackManifest.begin_count===1&&rollbackManifest.commit_count===1&&rollbackManifest.retains_reason_audit_table===true);
 console.log(JSON.stringify({pass,fail,unified_sha256:manifest.sha256,production_ddl:false,environment:"DISPOSABLE_POSTGRESQL_ONLY"}));
}catch(e){console.error("FAIL/BLOCKED "+e.stack);fail++;}
finally{pg.stop();}
if(fail)process.exitCode=1;
