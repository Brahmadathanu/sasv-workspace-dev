import assert from "node:assert/strict";
import fs from "node:fs";
import {
  contextDecision,
  isUsableApproval,
  meaningfulRepeatReason,
  normalizeRepeatStatus,
  repeatStatusLabel,
} from "../public/shared/js/lab-repeat-analysis-governance.js";

assert.equal(contextDecision({}).kind, "FIRST_ANALYSIS");
assert.equal(contextDecision({ active_analysis: { analysis_register_no: "A-2" } }).kind, "ACTIVE_BLOCK");
assert.equal(contextDecision({ prior_completed_analysis: { status: "SCRUTINY_PASSED" } }).kind, "AUTHORIZATION_REQUIRED");
assert.equal(contextDecision({ prior_completed_analysis: {}, latest_visible_request: { status: "APPROVED" } }).kind, "APPROVED_REPEAT");
assert.equal(isUsableApproval({ status: "APPROVED", consumed_at: "2026-10-20" }), false);
assert.equal(isUsableApproval({ status: "APPROVED", expires_at: "2000-01-01" }), false);
assert.equal(normalizeRepeatStatus("authorization consumed"), "CONSUMED");
assert.equal(repeatStatusLabel("expired"), "Authorization Expired");
assert.equal(repeatStatusLabel({ status: "APPROVED", consumed_at: "2026-10-20" }), "Authorization Consumed");
assert.equal(repeatStatusLabel({ status: "APPROVED", expires_at: "2000-01-01" }), "Authorization Expired");
assert.equal(meaningfulRepeatReason("repeat"), false);
assert.equal(meaningfulRepeatReason("Confirmation testing after investigation"), true);

const entrySource = fs.readFileSync(new URL("../public/shared/js/lab-analysis-entry.js", import.meta.url), "utf8");
for (const rpc of ["fn_get_repeat_analysis_context", "fn_request_repeat_analysis", "fn_list_repeat_analysis_requests", "fn_decide_repeat_analysis", "fn_receive_repeat_sample"]) {
  assert.equal(entrySource.includes(rpc), true, `missing RPC integration: ${rpc}`);
}
assert.match(entrySource, /repeatContextVerified && \["FIRST_ANALYSIS", "APPROVED_REPEAT"\]/);
assert.match(entrySource, /approvedRepeat \? "fn_receive_repeat_sample" : "fn_receive_sample_and_create_analysis"/);
assert.match(entrySource, /APPROVE_REPEAT_ANALYSIS/);

console.log("lab repeat-analysis governance smoke: PASS");
