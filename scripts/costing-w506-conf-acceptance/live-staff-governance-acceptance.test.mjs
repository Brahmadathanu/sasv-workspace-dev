import test from "node:test";
import assert from "node:assert/strict";
import { verifyIdentity, evaluateCounts, evaluateUiRequests } from "./live-staff-governance-acceptance.mjs";
const target = "module:cost-build-manager", csr = "module:cost-sheet-review";
const view = [{target,can_view:true,can_edit:false}];
const editor = [{target,can_view:true,can_edit:true}];
const csrOnly = [{target:csr,can_view:true,can_edit:false}];
test("CBM view-only requires canonical equality", () => {
  assert.equal(verifyIdentity("cbm-view",view,view),true);
  assert.equal(verifyIdentity("cbm-view",view,editor),false);
  assert.equal(verifyIdentity("cbm-view",editor,editor),false);
});
test("CSR-only cannot carry Cost Build Manager view/edit", () => {
  assert.equal(verifyIdentity("csr-view",csrOnly,csrOnly),true);
  assert.equal(verifyIdentity("csr-view",csrOnly.concat(view),csrOnly.concat(view)),false);
});
test("CBM editor requires both view and edit", () => {
  assert.equal(verifyIdentity("cbm-editor",editor,editor),true);
  assert.equal(verifyIdentity("cbm-editor",view,view),false);
  assert.equal(verifyIdentity("unknown",editor,editor),false);
});
test("malformed permission rows fail closed", () => {
  assert.equal(verifyIdentity("cbm-view",[],[]),false);
  assert.equal(verifyIdentity("cbm-view",[{target,can_view:"true",can_edit:false}],view),false);
  assert.equal(verifyIdentity("cbm-view",null,view),false);
  assert.equal(verifyIdentity("cbm-view",view.concat(view),view),false);
});
test("view-only requires zero sensitive rows and positive aggregates", () => {
  assert.equal(evaluateCounts("cbm-view",{register:0,review:0,pool:42,details:0}),true);
  assert.equal(evaluateCounts("cbm-view",{register:1,review:0,pool:42,details:0}),false);
  assert.equal(evaluateCounts("csr-view",{register:0,review:0,pool:42,details:1}),false);
  assert.equal(evaluateCounts("cbm-view",{register:0,review:0,pool:0,details:0}),false);
});
test("editor must retain nonempty authorised view", () => {
  assert.equal(evaluateCounts("cbm-editor",{register:164,review:0,pool:42,details:42}),true);
  assert.equal(evaluateCounts("cbm-editor",{register:0,review:0,pool:42,details:42}),false);
});
test("no UI personnel calls by restricted users", () => {
  const u = "https://qhmoqtxpeasamtlxaoak.supabase.co/rest/v1/v_costing_staff_classification_register?select=staff_id";
  assert.equal(evaluateUiRequests("cbm-view",[u]),false);
  assert.equal(evaluateUiRequests("csr-view",[u]),false);
  assert.equal(evaluateUiRequests("cbm-editor",[u]),true);
});
test("explicit selected columns only; no salary or nested detail transfer", () => {
  const root = "https://qhmoqtxpeasamtlxaoak.supabase.co/rest/v1/v_costing_staff_cost_pool_summary?select=";
  assert.equal(evaluateUiRequests("cbm-view",[root+"period_start,staff_count,pool_amount"]),true);
  for(const col of ["*","staff_details","basic_salary","allowance_amount","employer_contribution","other_salary_cost"]) assert.equal(evaluateUiRequests("cbm-editor",[root+col]),false);
  assert.equal(evaluateUiRequests("cbm-editor",[root+"total_salary_cost"]),true);
  assert.equal(evaluateUiRequests("cbm-view",[root+"total_salary_cost"]),false);
});
test("unrelated backend paths and third-party URLs are not permitted", () => {
  assert.equal(evaluateUiRequests("cbm-editor",["https://malicious.invalid/rest/v1/v_costing_staff_cost_pool_summary?select=period_start"]),false);
  assert.equal(evaluateUiRequests("cbm-editor",["not-a-url"]),false);
});
