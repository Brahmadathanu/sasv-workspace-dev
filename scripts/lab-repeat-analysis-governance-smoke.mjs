import assert from "node:assert/strict";
import fs from "node:fs";
import {
  contextDecision,
  isUsableApproval,
  meaningfulRepeatReason,
  normalizeRepeatStatus,
  priorAnalysisRegisterNumber,
  REPEAT_REASON_MIN_LENGTH,
  REPEAT_REQUEST_STATUS,
  repeatStatusLabel,
} from "../public/shared/js/lab-repeat-analysis-governance.js";

assert.equal(contextDecision({}).kind, "FIRST_ANALYSIS");
assert.equal(contextDecision({ active_analysis: { analysis_register_no: "A-2" } }).kind, "ACTIVE_BLOCK");
assert.equal(contextDecision({ prior_completed_analysis: { status: "SCRUTINY_PASSED" } }).kind, "AUTHORIZATION_REQUIRED");
assert.equal(contextDecision({ prior_completed_analysis: {}, latest_visible_request: { status: "APPROVED" } }).kind, "APPROVED_REPEAT");
assert.equal(contextDecision({ prior_completed_analysis: {}, latest_visible_request: { status: "REQUESTED" } }).kind, "AUTHORIZATION_REQUIRED");
assert.equal(contextDecision({ prior_completed_analysis: {}, latest_visible_request: { status: "REJECTED" } }).kind, "AUTHORIZATION_REQUIRED");
assert.equal(contextDecision({ prior_completed_analysis: {}, latest_visible_request: { status: "CONSUMED" } }).kind, "AUTHORIZATION_REQUIRED");
assert.equal(contextDecision({ prior_completed_analysis: {}, latest_visible_request: { status: "EXPIRED" } }).kind, "AUTHORIZATION_REQUIRED");
assert.equal(isUsableApproval({ status: "APPROVED", consumed_at: "2026-10-20" }), false);
assert.equal(isUsableApproval({ status: "APPROVED", expires_at: "2000-01-01" }), false);
assert.equal(normalizeRepeatStatus("authorization consumed"), "CONSUMED");
assert.equal(normalizeRepeatStatus("REQUESTED"), "PENDING");
assert.equal(repeatStatusLabel("expired"), "Authorization Expired");
assert.equal(repeatStatusLabel({ status: "APPROVED", consumed_at: "2026-10-20" }), "Authorization Consumed");
assert.equal(repeatStatusLabel({ status: "APPROVED", expires_at: "2000-01-01" }), "Authorization Expired");
assert.equal(meaningfulRepeatReason("repeat"), false);
assert.equal(meaningfulRepeatReason("12345678901234"), false);
assert.equal(meaningfulRepeatReason("123456789012345"), true);
assert.equal(meaningfulRepeatReason("Confirmation testing after investigation"), true);
assert.equal(REPEAT_REASON_MIN_LENGTH, 15);
assert.equal(REPEAT_REQUEST_STATUS, "REQUESTED");
assert.equal(priorAnalysisRegisterNumber({ prior_analysis_register_no: "FG/26/001" }), "FG/26/001");
assert.equal(priorAnalysisRegisterNumber({ previous_analysis_register_no: "invented" }), "—");

const entrySource = fs.readFileSync(new URL("../public/shared/js/lab-analysis-entry.js", import.meta.url), "utf8");
assert.match(entrySource, /rpc\("fn_get_repeat_analysis_context",\s*\{\s*p_bmr_id: Number\(bmrId\),?\s*\}\)/s);
assert.match(entrySource, /rpc\("fn_request_repeat_analysis",\s*\{ p_bmr_id: bmrId, p_reason: reason \}\)/);
assert.match(entrySource, /rpc\("fn_list_repeat_analysis_requests",\s*\{ p_status: REPEAT_REQUEST_STATUS \}\)/);
assert.match(entrySource, /rpc\("fn_decide_repeat_analysis",\s*\{\s*p_request_id: Number\(card\.dataset\.requestId\),\s*p_approve: button\.dataset\.repeatDecision === "approve",\s*p_remarks: remarksText,?\s*\}\)/s);
assert.match(entrySource, /p_request_id: requestId,\s*p_sample_received_date: selectedSampleDate\(\),\s*p_physical_register_ref: physRegRef\.value\.trim\(\),\s*p_analysed_by_staff_id: analysedBy\.value,\s*p_person_in_charge_staff_id: personInCharge\.value,\s*p_remarks: remarks\.value\.trim\(\) \|\| null,/s);
assert.match(entrySource, /repeatContextVerified && \["FIRST_ANALYSIS", "APPROVED_REPEAT"\]/);
assert.match(entrySource, /approvedRepeat \? "fn_receive_repeat_sample" : "fn_receive_sample_and_create_analysis"/);
assert.match(entrySource, /approvedRepeat[\s\S]*?: buildRpcParams\(\)/);
assert.match(entrySource, /APPROVE_REPEAT_ANALYSIS/);
assert.match(entrySource, /const previous = priorAnalysisRegisterNumber\(row\)/);
assert.doesNotMatch(entrySource, /previous_analysis_register_no/);
assert.doesNotMatch(entrySource, /p_status: "PENDING"/);
assert.match(entrySource, /if \(error\) throw error/g);
assert.match(entrySource, /catch \(err\)[\s\S]*?startAnalysisBtn\.classList\.remove\("loading"\);[\s\S]*?await loadRepeatContext\(bmrId\)/);
assert.doesNotMatch(entrySource, /messageEl\.textContent = msg;\s*card\.querySelectorAll\("button"\)[\s\S]*disabled = false/);

console.log("lab repeat-analysis governance smoke: PASS");
