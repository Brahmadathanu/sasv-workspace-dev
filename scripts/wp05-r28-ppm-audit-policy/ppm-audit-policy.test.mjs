// WP05 R28: offline structural acceptance of the REVIEW-ONLY SQL candidate.
// This tests a source-derived policy model and SQL text. It never connects to Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const deploy = readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R28_PPM_AUDIT_OPTION_A_REPLACE_VIEW_REVIEW_ONLY.sql",import.meta.url),"utf8");
const rollback = readFileSync(new URL("../../docs/master-data-costing/candidates/WP05_R28_PPM_AUDIT_OPTION_A_ROLLBACK_REVIEW_ONLY.sql",import.meta.url),"utf8");
const PPM="module:pricing-policy-manager";
const FOUR=["module:costing-control-center","module:cost-build-manager","module:cost-sheet-review","module:material-cost-manager"];
// Explicit synthetic interpretation only, not a test of live DB users.
function model({uid=true,dbRole="authenticated",grants=[]}={}){
  return ["postgres","service_role"].includes(dbRole)||Boolean(uid&&grants.includes(PPM));
}
test("PPM View positive and mixed-module positive",()=>{
 assert.equal(model({grants:[PPM]}),true);
 assert.equal(model({grants:[PPM,FOUR[0]]}),true);
});
test("Costing-only View roles are insufficient",()=>{
 for(const role of FOUR) assert.equal(model({grants:[role]}),false,role);
});
test("edit-only, no identity and empty view set are denied",()=>{
 assert.equal(model({grants:[]}),false);
 assert.equal(model({uid:false,grants:[PPM]}),false);
 // PPM Edit without View is not represented by a PPM View grant.
 assert.equal(model({grants:[]}),false);
});
test("existing privileged DB role exceptions are not extended",()=>{
 for(const dbRole of ["postgres","service_role"])assert.equal(model({uid:false,dbRole}),true);
 assert.equal(model({uid:false,dbRole:"anon"}),false);
});
test("candidate is a one-view-only rewrite with original fingerprint guard",()=>{
 assert.equal((deploy.match(/CREATE OR REPLACE VIEW\s+public\.v_costing_scheme_master_audit\s+AS/g)||[]).length,1);
 assert.match(deploy,/001024540bdeab9f2e5aa4ec2a6f6c53/);
 assert.match(deploy,/20-column contract drift/);
 assert.doesNotMatch(deploy,/\bGRANT\b\s+(?:SELECT|ALL)\b/i);
 assert.doesNotMatch(deploy,/\bALTER\s+TABLE\b/i);
 assert.doesNotMatch(deploy,/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i);
});
test("new outer predicate has exact PPM View and no shared helper",()=>{
 const viewSql=deploy.slice(deploy.indexOf("CREATE OR REPLACE VIEW"),deploy.indexOf("-- Future actual-execution"));
 assert.match(viewSql,/public\.app_has_permission\('module:pricing-policy-manager','view'\)/);
 assert.doesNotMatch(viewSql,/fn_costing_view_allowed/);
 assert.doesNotMatch(viewSql,/module:cost-build-manager|module:cost-sheet-review|module:material-cost-manager|module:costing-control-center/);
});
test("candidate preserves all original 20 named output fields and audit base source",()=>{
 const section=deploy.slice(deploy.indexOf("CREATE OR REPLACE VIEW"),deploy.indexOf("FROM ( SELECT a.id"));
 const columns=["audit_event_id","scheme_id","scheme_name","event_type","reason","approval_reference","actor_user_id","event_at","old_scheme_name","new_scheme_name","old_paid_qty","new_paid_qty","old_free_qty","new_free_qty","old_is_active","new_is_active","old_remarks","new_remarks","old_approval_reference","new_approval_reference"];
 for(const name of columns)assert.match(section,new RegExp("\\b"+name+"\\b"),name);
 assert.match(deploy,/FROM costing\.scheme_master_audit a/);
});
test("rollback is preconditioned and restores prior helper, not a global rewrite",()=>{
 assert.match(rollback,/unknown intervening view revision/);
 assert.match(rollback,/WHERE \( SELECT fn_costing_view_allowed\(\)/);
 assert.match(rollback,/001024540bdeab9f2e5aa4ec2a6f6c53/);
 assert.doesNotMatch(rollback,/\bALTER\s+TABLE\b|\bGRANT\s+SELECT\b/i);
});
