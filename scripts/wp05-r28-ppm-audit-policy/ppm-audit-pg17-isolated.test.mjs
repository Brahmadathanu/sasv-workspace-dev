// This test runs ONLY against a disposable GitHub Actions PostgreSQL 17 service.
// Never point PGHOST at Supabase. No network client SDK and no real user records.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const expectedHost = "127.0.0.1";
if (process.env.WP05_ISOLATED_PG !== "YES" || !["localhost", expectedHost].includes(process.env.PGHOST)) {
  throw new Error("Refusing DB execution: WP05_ISOLATED_PG=YES and localhost PGHOST required");
}
if (process.env.PGDATABASE !== "wp05_fixture") throw new Error("Refusing non-fixture database");
const candidate = readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R28_PPM_AUDIT_OPTION_A_REPLACE_VIEW_REVIEW_ONLY.sql",import.meta.url),"utf8");
const rollback = readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R28_PPM_AUDIT_OPTION_A_ROLLBACK_REVIEW_ONLY.sql",import.meta.url),"utf8");
function psql(sql){
 return execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{
  input:sql,encoding:"utf8",
  env:{...process.env,PGHOST:expectedHost,PGDATABASE:"wp05_fixture"},
  timeout:20000,
 }).trim();
}
function firstView(sql) {
 const begin=sql.indexOf("CREATE OR REPLACE VIEW public.v_costing_scheme_master_audit AS");
 const end=sql.indexOf("DO $check$",begin);
 assert.ok(begin>=0&&end>begin);
 return sql.slice(begin,end);
}
const users={
 ppm:"11111111-1111-4111-8111-111111111111",
 ccc:"22222222-2222-4222-8222-222222222222",
 cbm:"33333333-3333-4333-8333-333333333333",
 csr:"44444444-4444-4444-8444-444444444444",
 mcm:"55555555-5555-4555-8555-555555555555",
 mixed:"66666666-6666-4666-8666-666666666666",
 edit:"77777777-7777-4777-8777-777777777777",
};
const permissionKeys={
 ppm:"module:pricing-policy-manager",
 ccc:"module:costing-control-center",
 cbm:"module:cost-build-manager",
 csr:"module:cost-sheet-review",
 mcm:"module:material-cost-manager",
};
const schema=`
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA costing;
CREATE TABLE public.user_permissions_canonical (
 user_id uuid NOT NULL,
 target text NOT NULL,
 can_view boolean DEFAULT false,
 can_edit boolean DEFAULT false
);
CREATE TABLE costing.scheme_master_audit (
 id bigint NOT NULL,
 scheme_id bigint NOT NULL,
 old_snapshot jsonb,
 new_snapshot jsonb,
 event_type text,
 reason text,
 approval_reference text,
 actor_user_id uuid,
 event_at timestamptz
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.app_has_permission_core(p_user_id uuid,p_target text,p_mode text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public
AS $$
DECLARE v_allowed boolean := false;
BEGIN
 IF p_user_id IS NULL THEN RETURN false; END IF;
 IF p_mode NOT IN ('view','edit') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
 SELECT CASE WHEN p_mode='view' THEN can_view ELSE can_edit END
 INTO v_allowed FROM public.user_permissions_canonical
 WHERE user_id=p_user_id AND target=p_target;
 RETURN COALESCE(v_allowed,false);
END $$;
CREATE FUNCTION public.app_has_permission(p_target text,p_mode text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql SET search_path TO public
AS $$
DECLARE v_uid uuid;
BEGIN
 v_uid := auth.uid();
 IF v_uid IS NULL THEN RETURN false; END IF;
 RETURN public.app_has_permission_core(v_uid,p_target,p_mode);
END $$;
CREATE FUNCTION public.fn_costing_view_allowed() RETURNS boolean
LANGUAGE sql STABLE SET search_path TO public,pg_temp
AS $$
SELECT current_user=ANY(ARRAY['postgres','service_role']::name[])
 OR public.app_has_permission('module:costing-control-center','view')
 OR public.app_has_permission('module:cost-build-manager','view')
 OR public.app_has_permission('module:cost-sheet-review','view')
 OR public.app_has_permission('module:material-cost-manager','view')
$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public,auth TO authenticated,anon,service_role;
INSERT INTO costing.scheme_master_audit
 (id,scheme_id,old_snapshot,new_snapshot,event_type,reason,approval_reference,actor_user_id,event_at)
 VALUES (1,42,'{"scheme_name":"Old","paid_qty":"5","free_qty":"1"}',
 '{"scheme_name":"New","paid_qty":"10","free_qty":"2"}',
 'UPDATED','Fixture only','TEST-ONLY','88888888-8888-4888-8888-888888888888',now());
`;
psql(schema);
psql(firstView(rollback));
psql("GRANT SELECT ON public.v_costing_scheme_master_audit TO authenticated,service_role; REVOKE ALL ON public.v_costing_scheme_master_audit FROM anon;");
for(const [name,id] of Object.entries(users)) {
 const grants=name==="mixed"?[permissionKeys.ppm,permissionKeys.ccc]:name==="edit"?[permissionKeys.ppm]:[permissionKeys[name]];
 for(const g of grants) psql(`INSERT INTO public.user_permissions_canonical VALUES ('${id}', '${g}',${name!=="edit"},${name==="edit"});`);
}
function count(uid,role="authenticated"){
 const claim=uid? `SELECT set_config('request.jwt.claim.sub','${uid}',true);`: `SELECT set_config('request.jwt.claim.sub','',true);`;
 const result=psql(`BEGIN; SET LOCAL ROLE ${role}; ${claim} SELECT count(*) FROM public.v_costing_scheme_master_audit; ROLLBACK;`);
 return Number(result.split("\n").at(-1));
}
const originalHash="001024540bdeab9f2e5aa4ec2a6f6c53";
const md5=()=>psql("SELECT md5(pg_get_viewdef('public.v_costing_scheme_master_audit'::regclass,true));");
test("synthetic baseline reproduces original exact view fingerprint",()=>assert.equal(md5(),originalHash));
test("baseline original four-module helper yields expected role contrast",()=>{
 assert.equal(count(users.ppm),0);
 for(const k of ["ccc","cbm","csr","mcm"])assert.equal(count(users[k]),1,k);
});
test("approved candidate SQL parses, applies and preserves SQL grants and 20 columns",()=>{
 psql(candidate);
 assert.equal(psql("SELECT count(*) FROM pg_attribute WHERE attrelid='public.v_costing_scheme_master_audit'::regclass AND attnum>0 AND NOT attisdropped;"),"20");
 assert.equal(psql("SELECT has_table_privilege('authenticated','public.v_costing_scheme_master_audit','SELECT');"),"t");
 assert.equal(psql("SELECT has_table_privilege('anon','public.v_costing_scheme_master_audit','SELECT');"),"f");
 assert.equal(psql("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.v_costing_scheme_master_audit'::regclass;"),"postgres");
});
test("PPM View and mixed-scope reader positive, costing-only viewers denied",()=>{
 assert.equal(count(users.ppm),1);
 assert.equal(count(users.mixed),1);
 for(const k of ["ccc","cbm","csr","mcm"])assert.equal(count(users[k]),0,k);
});
test("edit-only and absent UID deny; privileged service remains eligible",()=>{
 assert.equal(count(users.edit),0);
 assert.equal(count(null),0);
 assert.equal(count(null,"service_role"),1);
});
test("guard prevents reapplying candidate after definition has changed",()=>{
 assert.throws(()=>psql(candidate));
});
test("guarded rollback restores original view and prior role behaviour",()=>{
 psql(rollback);
 assert.equal(md5(),originalHash);
 assert.equal(count(users.ppm),0);
 for(const k of ["ccc","cbm","csr","mcm"])assert.equal(count(users[k]),1,k);
});
test("guarded rollback fails closed on wrong starting view",()=>{
 assert.throws(()=>psql(rollback));
});
