import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const apply=read("../../docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_APPLY_REVIEW_ONLY.sql");
const rollback=read("../../docs/master-data-costing/candidates/WP05_R55_SCHEME_REGISTER_PPM_ROLLBACK_REVIEW_ONLY.sql");
if(process.env.WP05_ISOLATED_PG!=="YES"||!["localhost","127.0.0.1"].includes(process.env.PGHOST)||process.env.PGDATABASE!=="wp05_scheme_fixture")throw Error("Refuse non-isolated target");
const psql=s=>execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{input:s,encoding:"utf8",timeout:30000,env:{...process.env,PGHOST:"127.0.0.1",PGDATABASE:"wp05_scheme_fixture"}}).trim();
const v="public.v_costing_scheme_master_register";
const hash=()=>psql(`SELECT md5(pg_get_viewdef('${v}'::regclass,true));`);
const rows=user=>Number(psql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true); SELECT count(*) FROM ${v}; ROLLBACK;`).split("\n").at(-1));
psql("CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth;");
psql(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.fixture_permission(user_id uuid,target text,can_view boolean,can_edit boolean);
CREATE FUNCTION public.app_has_permission(p_target text,p_mode text DEFAULT 'view') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.fixture_permission WHERE user_id=auth.uid() AND target=p_target
AND ((p_mode='view' AND can_view) OR (p_mode='edit' AND can_edit))) $$;
CREATE FUNCTION public.fn_costing_view_allowed() RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT CURRENT_USER=ANY(ARRAY['postgres','service_role']::name[])
OR app_has_permission('module:costing-control-center','view')
OR app_has_permission('module:cost-build-manager','view')
OR app_has_permission('module:cost-sheet-review','view')
OR app_has_permission('module:material-cost-manager','view') $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(),public.app_has_permission(text,text),public.fn_costing_view_allowed() TO authenticated;
INSERT INTO public.fixture_permission VALUES
('00000000-0000-0000-0000-000000000001','module:pricing-policy-manager',true,false),
('00000000-0000-0000-0000-000000000002','module:costing-control-center',true,false),
('00000000-0000-0000-0000-000000000003','module:cost-sheet-review',true,false),
('00000000-0000-0000-0000-000000000004','module:material-cost-manager',true,false),
('00000000-0000-0000-0000-000000000005','module:cost-build-manager',true,false),
('00000000-0000-0000-0000-000000000006','module:pricing-policy-manager',false,true);
`);
psql(read("./fixtures/dependencies.sql"));
psql(`INSERT INTO costing.scheme_master(id,scheme_name,paid_qty,free_qty,is_active,is_system_defined)
VALUES(1,'synthetic 5+1',5,1,true,false);`);
psql(read("./fixtures/original-view.sql"));
const u=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
test("original production definition has exact fingerprint and 34 fields",()=>{
assert.equal(hash(),"8fdc0306bd2f1efbe0638c7c13ba4dda");
assert.equal(psql(`SELECT count(*) FROM pg_attribute WHERE attrelid='${v}'::regclass AND attnum>0 AND NOT attisdropped;`),"34");
assert.equal(rows(u(1)),0,"PPM-only original was denied");
assert.equal(rows(u(2)),1,"CCC-only originally admitted");
});
test("exact guarded one-view candidate applies",()=>{
psql(apply);
console.log("R55_NEW_MD5="+hash());
assert.notEqual(hash(),"8fdc0306bd2f1efbe0638c7c13ba4dda");
assert.equal(psql(`SELECT array_to_string(reloptions,',') FROM pg_class WHERE oid='${v}'::regclass;`),"security_invoker=true");
assert.equal(psql(`SELECT relacl::text FROM pg_class WHERE oid='${v}'::regclass;`),"{postgres=arwdDxtm/postgres,authenticated=r/postgres}");
assert.equal(psql(`SELECT count(*) FROM pg_attribute WHERE attrelid='${v}'::regclass AND attnum>0 AND NOT attisdropped;`),"34");
});
test("PPM View-only signed-in fixture now reads populated Scheme Master",()=>assert.equal(rows(u(1)),1));
test("CCC, CSR, MCM, CBM-only and PPM Edit-only do not read full Register",()=>{for(const i of [2,3,4,5,6])assert.equal(rows(u(i)),0,String(i));});
test("repeat apply refuses changed baseline",()=>assert.throws(()=>psql(apply)));
test("unreviewed rollback fingerprint refuses",()=>assert.throws(()=>psql(rollback)));
test("guarded rollback restores original fingerprint and reader behavior",()=>{
psql(rollback);
assert.equal(hash(),"8fdc0306bd2f1efbe0638c7c13ba4dda");
assert.equal(rows(u(1)),0);
assert.equal(rows(u(2)),1);
});
test("rollback refuses repeat",()=>assert.throws(()=>psql(rollback)));
