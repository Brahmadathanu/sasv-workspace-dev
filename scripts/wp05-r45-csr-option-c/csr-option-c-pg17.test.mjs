// WP05 R45 isolated PostgreSQL 17 integration, synthetic data only. Never target production.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const fixture=name=>readFileSync(new URL("./fixtures/"+name,import.meta.url),"utf8");
const candidate=readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R45_CSR_OPTION_C_APPLY_REVIEW_ONLY.sql",import.meta.url),"utf8");
const rollback=readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R45_CSR_OPTION_C_ROLLBACK_REVIEW_ONLY.sql",import.meta.url),"utf8");
if(process.env.WP05_ISOLATED_PG!=="YES"||!["localhost","127.0.0.1"].includes(process.env.PGHOST)||process.env.PGDATABASE!=="wp05_csr_fixture")throw Error("Refusing non-isolated PostgreSQL");
function psql(s){return execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{input:s,encoding:"utf8",timeout:40000,env:{...process.env,PGHOST:"127.0.0.1",PGDATABASE:"wp05_csr_fixture"}}).trim();}
const detail="public.v_costing_pricing_sku_detailed_cost_sheet";
const trace="public.v_costing_pricing_cost_sheet_line_traceability";
const original={ [detail]:"85585c98e6f184fb9a4eb3351b008c2e", [trace]:"b67b4ee28e0eb19804c073cb83e14e11"};
const hash=v=>psql(`SELECT md5(pg_get_viewdef('${v}'::regclass,true));`);
const count=(user,view)=>Number(psql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true); SELECT count(*) FROM ${view}; ROLLBACK;`).split("\n").at(-1));
psql("CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;");
psql(fixture("source-dependencies.sql"));
psql(`
CREATE TABLE public.fixture_permission(user_id text,target text,can_view boolean,can_edit boolean);
CREATE FUNCTION public.app_has_permission(p_target text,p_mode text DEFAULT 'view') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.fixture_permission WHERE user_id=current_setting('request.jwt.claim.sub',true)
 AND target=p_target AND ((p_mode='view' AND can_view) OR (p_mode='edit' AND can_edit))) $$;
CREATE FUNCTION public.fn_costing_view_allowed() RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT CURRENT_USER=ANY(ARRAY['postgres','service_role']::name[])
OR public.app_has_permission('module:costing-control-center','view')
OR public.app_has_permission('module:cost-build-manager','view')
OR public.app_has_permission('module:cost-sheet-review','view')
OR public.app_has_permission('module:material-cost-manager','view') $$;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.app_has_permission(text,text),public.fn_costing_view_allowed() TO authenticated,service_role;
INSERT INTO public.fixture_permission VALUES
('csr','module:cost-sheet-review',true,false),
('ccc','module:costing-control-center',true,false),
('mixed','module:cost-sheet-review',true,false),
('mixed','module:costing-control-center',true,false),
('cbm','module:cost-build-manager',true,false),
('mcm','module:material-cost-manager',true,false),
('ppm','module:pricing-policy-manager',true,false),
('edit_only','module:cost-sheet-review',false,true);
INSERT INTO costing.fixture_detail_source(sku_id,period_start,product_name,mrp_ik,mrp_ok)
VALUES(100,'2026-11-01','Synthetic product',100,120);
INSERT INTO costing.cost_sheet_line_traceability_snapshot
(line_trace_id,period_start,product_id,sku_id,section_code,line_order,line_label,valuation_date,refresh_run_id,evidence_json,drill_filter_json)
VALUES (1,'2026-11-01',10,100,'B_COST',1,'Synthetic Direct Labour','2026-11-01',1000,'{"fixture":"yes"}','{"fixture":"yes"}');
`);
psql(fixture("original-views.sql"));
test("Shared Costing SKU reader and trace evidence client contracts remain in source",()=>{
 const shell=readFileSync(new URL("../../public/shared/js/costing-suite-shell.js",import.meta.url),"utf8");
 const costSheet=readFileSync(new URL("../../public/shared/js/costing-suite-cost-sheet.js",import.meta.url),"utf8");
 assert.match(shell,/async function fetchSkuDetail\(row\)/);
 assert.match(shell,/"v_costing_pricing_sku_detailed_cost_sheet"/);
 assert.match(shell,/\.eq\("period_start", ACTIVE_PERIOD_START\)/);
 assert.match(shell,/\.eq\("sku_id", skuId\)/);
 assert.match(shell,/return data\?\.\[0\] \|\| row;/);
 assert.match(costSheet,/"v_costing_pricing_cost_sheet_line_traceability"/);
 for(const field of ["trace_source_snapshot","evidence_json","drill_filter_json","refresh_run_id","valuation_date"]){
  assert.ok(costSheet.includes('"' + field + '"'),"Missing line evidence contract "+field);
 }
});
test("Exact original 44 and 40 column views parse and retain metadata",()=>{
for(const [v,n] of [[detail,44],[trace,40]]){
assert.equal(hash(v),original[v]);
assert.equal(psql(`SELECT count(*) FROM pg_attribute WHERE attrelid='${v}'::regclass AND attnum>0 AND NOT attisdropped;`),String(n));
assert.equal(count("csr",v),1);
assert.equal(count("ccc",v),1);
}
});
test("Apply exact candidate transaction preserves differing view contracts",()=>{
psql(candidate);
console.log("WP05_R45_NEW_MD5_DETAIL="+hash(detail));
console.log("WP05_R45_NEW_MD5_TRACE="+hash(trace));
for(const v of [detail,trace])assert.notEqual(hash(v),original[v]);
assert.equal(psql(`SELECT array_to_string(reloptions,',') FROM pg_class WHERE oid='${detail}'::regclass;`),"security_invoker=true");
assert.equal(psql(`SELECT reloptions IS NULL FROM pg_class WHERE oid='${trace}'::regclass;`),"t");
assert.equal(psql(`SELECT relacl::text FROM pg_class WHERE oid='${detail}'::regclass;`),"{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}");
assert.equal(psql(`SELECT relacl::text FROM pg_class WHERE oid='${trace}'::regclass;`),"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}");
assert.equal(psql(`SELECT has_table_privilege('anon','${trace}','SELECT');`),"f");
});
test("CSR and mixed View users receive detailed and trace evidence",()=>{for(const u of ["csr","mixed"])for(const v of [detail,trace])assert.equal(count(u,v),1,u+v);});
test("CCC View sees detailed sheet, not full JSON trace",()=>{assert.equal(count("ccc",detail),1);assert.equal(count("ccc",trace),0);});
test("CBM MCM PPM and CSR Edit-only cannot read either view",()=>{for(const u of ["cbm","mcm","ppm","edit_only","none"])for(const v of [detail,trace])assert.equal(count(u,v),0,u+v);});
test("Apply drift guard rejects repeated deployment",()=>assert.throws(()=>psql(candidate)));
test("Rollback fail-closes on ACL drift and leaves both view definitions intact",()=>{
const d=hash(detail),t=hash(trace);
psql(`GRANT UPDATE ON ${trace} TO authenticated;`);
assert.throws(()=>psql(rollback));
assert.equal(hash(detail),d);assert.equal(hash(trace),t);
psql(`REVOKE UPDATE ON ${trace} FROM authenticated;`);
});
test("Guarded rollback restores exact both original definitions",()=>{
psql(rollback);
for(const v of [detail,trace]){assert.equal(hash(v),original[v]);for(const u of ["csr","ccc","cbm","mcm"])assert.equal(count(u,v),1);}
});
test("Rollback refuses re-execution",()=>assert.throws(()=>psql(rollback)));
