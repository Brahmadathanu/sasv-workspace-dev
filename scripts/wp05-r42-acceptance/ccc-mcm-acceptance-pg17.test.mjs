// WP05 R42 disposable PG17 actual-SQL integration; no network, no real Supabase identities.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const fixture=name=>readFileSync(new URL("./fixtures/"+name,import.meta.url),"utf8");
const candidate=readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R42_CCC_MCM_ACCEPTANCE_APPLY_REVIEW_ONLY.sql",import.meta.url),"utf8");
const rollback=readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R42_CCC_MCM_ACCEPTANCE_ROLLBACK_REVIEW_ONLY.sql",import.meta.url),"utf8");
if(process.env.WP05_ISOLATED_PG!=="YES"||!["localhost","127.0.0.1"].includes(process.env.PGHOST)||process.env.PGDATABASE!=="wp05_accept_fixture")throw Error("Refuse non-isolated database");
function psql(s){return execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{input:s,encoding:"utf8",timeout:25000,env:{...process.env,PGHOST:"127.0.0.1",PGDATABASE:"wp05_accept_fixture"}}).trim();}
const v="public.v_costing_material_review_acceptance_register";
const fingerprint=()=>psql(`SELECT md5(pg_get_viewdef('${v}'::regclass,true));`);
const count=user=>Number(psql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true); SELECT count(*) FROM ${v}; ROLLBACK;`).split("\n").at(-1));
psql("CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;");
psql(fixture("underlying.sql"));
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
 GRANT EXECUTE ON FUNCTION public.app_has_permission(text,text), public.fn_costing_view_allowed() TO authenticated,service_role;
 INSERT INTO public.fixture_permission VALUES
 ('ccc','module:costing-control-center',true,false),
 ('mcm','module:material-cost-manager',true,false),
 ('mixed','module:costing-control-center',true,false),
 ('mixed','module:material-cost-manager',true,false),
 ('cbm','module:cost-build-manager',true,false),
 ('csr','module:cost-sheet-review',true,false),
 ('ppm','module:pricing-policy-manager',true,false),
 ('edit_only','module:material-cost-manager',false,true);
 INSERT INTO costing.v_material_review_acceptance_register
 (acceptance_id,period_start,stock_item_id,accepted_by_email,acceptance_note,acceptance_reason)
 VALUES (10,'2026-11-01',20,'synthetic@example.invalid','Synthetic acceptance note','Fixture only');
`);
psql(fixture("original-view.sql"));
const acl=()=>psql(`SELECT relacl::text FROM pg_class WHERE oid='${v}'::regclass;`);
test("Original 38-column view fingerprint and mixed CCC/CBM/MCM/CSR reader baseline",()=>{
 assert.equal(fingerprint(),"df6c6771423c2aecb0130822a804a239");
 assert.equal(psql(`SELECT count(*) FROM pg_attribute WHERE attrelid='${v}'::regclass AND attnum>0 AND NOT attisdropped;`),"38");
 for(const u of ["ccc","mcm","mixed","cbm","csr"]) assert.equal(count(u),1,u);
});
test("Exact one-view SQL candidate applies and retains schema/owner/grants",()=>{
 psql(candidate);
 console.log("WP05_R42_CANDIDATE_MD5="+fingerprint());
 assert.notEqual(fingerprint(),"df6c6771423c2aecb0130822a804a239");
 assert.equal(acl(),"{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}");
 assert.equal(psql(`SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='${v}'::regclass;`),"postgres");
 assert.equal(psql(`SELECT reloptions IS NULL FROM pg_class WHERE oid='${v}'::regclass;`),"t");
 assert.equal(psql(`SELECT count(*) FROM pg_attribute WHERE attrelid='${v}'::regclass AND attnum>0 AND NOT attisdropped;`),"38");
 assert.equal(psql(`SELECT has_table_privilege('anon','${v}','SELECT');`),"f");
 assert.equal(psql(`SELECT has_table_privilege('authenticated','${v}','UPDATE');`),"f");
});
test("CCC View, MCM View and mixed readers allowed",()=>{for(const u of ["ccc","mcm","mixed"])assert.equal(count(u),1,u);});
test("CBM, CSR, PPM, MCM Edit-only and no-view denied",()=>{for(const u of ["cbm","csr","ppm","edit_only","none"])assert.equal(count(u),0,u);});
test("Apply refuses unexpected reapplication",()=>assert.throws(()=>psql(candidate)));
test("Rollback refuses an unexpected SQL ACL expansion without changing the view",()=>{
 psql(`GRANT UPDATE ON ${v} TO authenticated;`);
 assert.throws(()=>psql(rollback));
 psql(`REVOKE UPDATE ON ${v} FROM authenticated;`);
 assert.equal(acl(),"{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}");
});
test("Guarded rollback restores original view fingerprint and original readers",()=>{
 // Will pass after tested candidate hash is pinned to rollback guard.
 psql(rollback);
 assert.equal(fingerprint(),"df6c6771423c2aecb0130822a804a239");
 for(const u of ["ccc","mcm","cbm","csr"])assert.equal(count(u),1,u);
});
test("Rollback refuses a second application against original",()=>assert.throws(()=>psql(rollback)));
