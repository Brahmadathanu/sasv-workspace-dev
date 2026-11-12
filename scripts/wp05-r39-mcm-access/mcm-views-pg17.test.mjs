// Disposable PostgreSQL 17 integration, synthetic identities and rows ONLY.
// Refuse nonlocal DB. No Supabase project access.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const dir=new URL("./fixtures/",import.meta.url);
const sql = name=>readFileSync(new URL(name,dir),"utf8");
const candidate=readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R39_MCM_TWO_VIEWS_APPLY_REVIEW_ONLY.sql",import.meta.url),"utf8");
const rollback=readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R39_MCM_TWO_VIEWS_ROLLBACK_REVIEW_ONLY.sql",import.meta.url),"utf8");
if(process.env.WP05_ISOLATED_PG!=="YES"||!["localhost","127.0.0.1"].includes(process.env.PGHOST)||process.env.PGDATABASE!=="wp05_mcm_fixture")throw Error("Refusing non-isolated PostgreSQL");
function psql(s){return execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{input:s,encoding:"utf8",timeout:25000,env:{...process.env,PGHOST:"127.0.0.1",PGDATABASE:"wp05_mcm_fixture"}}).trim();}
psql("CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;");
psql(sql("source-dependencies.sql"));
psql(`
CREATE TABLE public.fixture_permission (user_id text, target text, can_view boolean);
CREATE FUNCTION public.app_has_permission(p_target text,p_mode text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.fixture_permission WHERE user_id=current_setting('request.jwt.claim.sub',true)
AND target=p_target AND can_view AND p_mode='view') $$;
CREATE FUNCTION public.fn_costing_view_allowed() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT CURRENT_USER=ANY(ARRAY['postgres','service_role']::name[])
 OR public.app_has_permission('module:costing-control-center','view')
 OR public.app_has_permission('module:cost-build-manager','view')
 OR public.app_has_permission('module:cost-sheet-review','view')
 OR public.app_has_permission('module:material-cost-manager','view') $$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_has_permission(text,text),public.fn_costing_view_allowed() TO authenticated;
INSERT INTO public.fixture_permission VALUES
 ('user-mcm','module:material-cost-manager',true),
 ('user-ccc','module:costing-control-center',true),
 ('user-cbm','module:cost-build-manager',true),
 ('user-csr','module:cost-sheet-review',true),
 ('user-mixed','module:material-cost-manager',true),
 ('user-mixed','module:costing-control-center',true);
INSERT INTO costing.material_manual_rates (id,stock_item_id,rate_value,status,source_snapshot)
 VALUES (100,200,90,'ACTIVE','{"vendor_display_name":"Synthetic Supplier","rate_value":"90"}');
INSERT INTO public.inv_stock_item (id,name,code) VALUES(200,'Fixture Ingredient','TEST-RM');
`);
psql(sql("original-views.sql"));
const views=["v_costing_material_manual_rate_history","v_costing_material_manual_rate_register"];
const old=["e827e401cc2bb8ccadf782ee5b98add4","8a4c73fd3f4562679af3ed0638fa87e4"];
const hash=v=>psql(`SELECT md5(pg_get_viewdef('public.${v}'::regclass,true));`);
const count=(who,view)=>{
 const x=psql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${who}',true); SELECT count(*) FROM public.${view}; ROLLBACK;`);
 return Number(x.split("\n").at(-1));
};
test("baseline reproduces exact original view definitions and nested register",()=>{
 views.forEach((v,i)=>assert.equal(hash(v),old[i]));
 for(const v of views){assert.equal(count("user-mcm",v),1);assert.equal(count("user-ccc",v),1);}
});
test("candidate applies in one transaction and preserves both full view contracts",()=>{
 psql(candidate);
 const newHashes=views.map(hash);
 for(let i=0;i<2;i++){assert.notEqual(newHashes[i],old[i]);console.log("WP05_R39_NEW_HASH_"+views[i]+"="+newHashes[i]);}
 for(const [i,v] of views.entries()){
  assert.equal(psql(`SELECT count(*) FROM pg_attribute WHERE attrelid='public.${v}'::regclass AND attnum>0 AND NOT attisdropped;`),String(i===0?32:34));
  assert.equal(psql(`SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.${v}'::regclass;`),"postgres");
  assert.equal(psql(`SELECT relacl::text FROM pg_class WHERE oid='public.${v}'::regclass;`),"{postgres=arwdDxtm/postgres,authenticated=r/postgres}");
  assert.equal(psql(`SELECT has_table_privilege('service_role','public.${v}','SELECT');`),"f");
 }
});
test("MCM View-only and mixed readers allowed on BOTH nested views",()=>{
 for(const v of views)for(const who of ["user-mcm","user-mixed"])assert.equal(count(who,v),1,v+who);
});
test("CCC CBM CSR-only and no permission denied on BOTH views",()=>{
 for(const v of views)for(const who of ["user-ccc","user-cbm","user-csr","user-none"])assert.equal(count(who,v),0,v+who);
});
test("original candidate guard refuses reapply, no partial rewrite",()=>{
 assert.throws(()=>psql(candidate));
});
test("guarded rollback restores exact originals and old separate-role behaviour",()=>{
 psql(rollback);
 views.forEach((v,i)=>assert.equal(hash(v),old[i]));
 for(const v of views)for(const who of ["user-mcm","user-ccc","user-cbm","user-csr"])assert.equal(count(who,v),1);
});
test("rollback refuses unexpected prior state",()=>assert.throws(()=>psql(rollback)));
