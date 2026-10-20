import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BMR_LIFECYCLE,
  isVerifiedActiveBmr,
  normalizeBmrLifecycle,
} from "../public/shared/js/bmr-lifecycle.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manage = read("public/shared/js/manage-bmr.js");
const manageHtml = read("public/shared/manage-bmr.html");
const lifecycle = read("public/shared/js/bmr-lifecycle.js");
const supply = read("js/supply-batch-plan.js");
const lab = read("public/shared/js/lab-analysis-entry.js");
const logAdd = read("js/log-add.js");
const logEdit = read("js/log-edit.js");
const updateStatus = read("js/update-log-status.js");

assert.match(manage, /\.eq\("lifecycle_status", BMR_LIFECYCLE\.ACTIVE\)/);
assert.match(manage, /BMR_LIFECYCLE\.SUPERSEDED[\s\S]*BMR_LIFECYCLE\.CANCELLED/);
assert.match(manageHtml, /value="HISTORY">History/);
assert.match(manageHtml, /value="ALL">All/);
assert.match(manageHtml, /lifecycle-superseded/);
assert.match(manageHtml, /lifecycle-cancelled/);
assert.match(manageHtml, /lifecycle-unknown/);
assert.match(manage, /Retained for audit purposes\. Superseded BMRs cannot be deleted\./);
assert.match(manage, /getAdminCorrectionHistory/);
assert.match(manage, /correction\.correction_no/);
assert.match(manage, /correction\.new_bn/);
assert.match(lifecycle, /\.eq\("lifecycle_status", BMR_LIFECYCLE\.ACTIVE\)/);
assert.match(supply, /retainActiveBmrCandidates/g);
assert.match(lab, /retainActiveBmrCandidates/);
assert.match(logAdd, /\.eq\("lifecycle_status", "ACTIVE"\)/);
assert.match(updateStatus, /\.eq\("lifecycle_status", "ACTIVE"\)/);
assert.match(logEdit, /\.eq\("lifecycle_status", "ACTIVE"\)/);
assert.match(logEdit, /if \(pre && !uniq\.some/);
assert.doesNotMatch(manage, /lifecycle_status\s*:/);

const validStatuses = ["ACTIVE", "SUPERSEDED", "CANCELLED"];
for (const status of validStatuses) {
  assert.equal(normalizeBmrLifecycle(status), status);
  assert.equal(normalizeBmrLifecycle(`  ${status.toLowerCase()}  `), status);
}
for (const unverified of [null, undefined, "", "   ", "ACTVE", "PENDING", 1, {}, []]) {
  assert.equal(normalizeBmrLifecycle(unverified), BMR_LIFECYCLE.UNKNOWN);
  assert.equal(isVerifiedActiveBmr(unverified), false);
}
assert.equal(isVerifiedActiveBmr("ACTIVE"), true);
assert.equal(isVerifiedActiveBmr("SUPERSEDED"), false);
assert.equal(isVerifiedActiveBmr("CANCELLED"), false);
assert.match(manage, /isVerifiedActiveBmr\(row\.lifecycleStatus\)/);
assert.match(manage, /Only a verified ACTIVE BMR can be deleted/);
assert.match(manage, /Only a verified ACTIVE BMR can be edited/);
assert.match(
  manage,
  /openAdminCorrectionFromDetail\(\)[\s\S]*!isVerifiedActiveBmr\(row\?\.lifecycleStatus\)/,
);

console.log("BMR lifecycle client smoke: PASS");
