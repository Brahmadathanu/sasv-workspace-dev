/**
 * Client-only checks for laboratory specification validation and user-facing errors.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAB_ACTIVE_ANALYSIS_MESSAGE,
  LAB_INVALID_EFFECTIVE_SPEC_READINESS_MESSAGE,
  LAB_INVALID_SPEC_MESSAGE,
  LAB_NETWORK_MESSAGE,
  LAB_PERMISSION_MESSAGE,
  LAB_RANGE_ORDER_MESSAGE,
  LAB_SESSION_MESSAGE,
  LAB_SPEC_RESOLUTION_MESSAGE,
  LAB_UNKNOWN_MESSAGE,
  buildValidateCurrentActiveSpecArgs,
  normalizeLabUserError,
  rangePayloadError,
  readinessFailureCopy,
  reviewRangeApprovalBlock,
  validateFiniteRange,
} from "../public/shared/js/lab-user-error.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entrySource = readFileSync(
  join(root, "public/shared/js/lab-analysis-entry.js"),
  "utf8",
);
const managerSource = readFileSync(
  join(root, "public/shared/js/lab-spec-profile-manager.js"),
  "utf8",
);

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertBefore(source, earlier, later, label) {
  const earlierAt = source.indexOf(earlier);
  const laterAt = source.indexOf(later);
  assert.ok(earlierAt !== -1, `${label} missing ${earlier}`);
  assert.ok(laterAt !== -1, `${label} missing ${later}`);
  assert.ok(earlierAt < laterAt, `${label}: ${earlier} should precede ${later}`);
}

const invalidRequest = {
  test_name: "Specific Gravity",
  proposed_reference_snapshot: {
    spec_type: "RANGE",
    min_value: 1.1,
    max_value: 1.02,
  },
};

const validDirect = validateFiniteRange("1.01", "1.02");
assert.equal(validDirect.ok, true, "direct range 1.01-1.02 should pass");
assert.equal(rangePayloadError("RANGE", "1.01", "1.02"), "");

const blockedDirect = validateFiniteRange("1.10", "1.02");
assert.equal(blockedDirect.ok, false);
assert.equal(blockedDirect.error, LAB_RANGE_ORDER_MESSAGE);

const saveOverride = sliceFunction(managerSource, "saveOverrideModal");
assertBefore(
  saveOverride,
  "rangePayloadError",
  "fn_save_spec_override_direct",
  "direct override",
);
assert.match(saveOverride, /if \(rangeError\) \{\s*showBanner/);

const supersedeCollect = sliceFunction(managerSource, "collectSupersedeFormPayload");
assert.match(supersedeCollect, /rangePayloadError\("RANGE", minVal, maxVal\)/);
assert.match(supersedeCollect, /if \(rangeError\) return \{ error: rangeError \}/);

const supersedeConfirm = sliceFunction(
  managerSource,
  "confirmAppliedOverrideSupersede",
);
assertBefore(
  supersedeConfirm,
  "rangePayloadError",
  "fn_supersede_spec_override",
  "supersede confirm",
);
assert.equal(rangePayloadError("RANGE", 1.01, 1.01), "");
assert.equal(validateFiniteRange(null, 1).ok, false);

const approveBlock = reviewRangeApprovalBlock("approve", invalidRequest);
assert.equal(approveBlock.blocked, true);
assert.equal(approveBlock.error, LAB_RANGE_ORDER_MESSAGE);

const approveNextBlock = reviewRangeApprovalBlock("approve", {
  proposed_reference_snapshot: JSON.stringify({
    spec_type: "RANGE",
    min_value: "1.10",
    max_value: "1.02",
  }),
});
assert.equal(approveNextBlock.blocked, true);

const rejectBlock = reviewRangeApprovalBlock("reject", invalidRequest);
assert.equal(rejectBlock.blocked, false);
assert.equal(rejectBlock.error, "");

const reviewSubmit = sliceFunction(managerSource, "submitSpecRequestReview");
assertBefore(
  reviewSubmit,
  "reviewRangeApprovalBlock",
  "fn_review_spec_change_request_decision",
  "review decision",
);
assert.match(reviewSubmit, /if \(approvalRangeBlock\.blocked\)/);

const readyCopy = readinessFailureCopy({
  ok: true,
  code: "READY",
  message: "The applicable laboratory specification is valid.",
  invalid_count: 0,
  invalid_lines: [],
});
assert.equal(readyCopy.ready, true);

const invalidCopy = readinessFailureCopy({
  ok: false,
  code: "INVALID_EFFECTIVE_SPEC",
  message: "The applicable laboratory specification contains an invalid value or range.",
  invalid_count: 1,
  invalid_lines: [
    {
      test_name: "Specific Gravity",
      message: LAB_RANGE_ORDER_MESSAGE,
    },
  ],
});
assert.equal(invalidCopy.ready, false);
assert.equal(
  invalidCopy.label,
  `Specification validation failed: Specific Gravity — ${LAB_RANGE_ORDER_MESSAGE}`,
);
assert.doesNotMatch(invalidCopy.label, /readiness check passed/i);

const noLineCopy = readinessFailureCopy({
  ok: false,
  code: "INVALID_EFFECTIVE_SPEC",
  message: "The applicable laboratory specification contains an invalid value or range.",
  invalid_count: 0,
  invalid_lines: [],
});
assert.equal(noLineCopy.label, LAB_INVALID_EFFECTIVE_SPEC_READINESS_MESSAGE);

const resolutionCopy = readinessFailureCopy({
  ok: false,
  code: "SPEC_RESOLUTION_FAILED",
  message: 'relation "spec_line" does not exist',
  invalid_lines: [],
});
assert.equal(resolutionCopy.ready, false);
assert.equal(resolutionCopy.label, LAB_SPEC_RESOLUTION_MESSAGE);
assert.doesNotMatch(resolutionCopy.label, /spec_line|relation/);

for (const name of ["checkFgReadiness", "checkInventoryReadiness", "checkPmReadiness"]) {
  const body = sliceFunction(entrySource, name);
  assertBefore(body, "confirmEffectiveSpecIsValid", "readiness check passed", name);
  assert.match(body, /specValidation\.ok !== true/);
  assert.match(body, /normalizeLabUserError\(err\)/);
}

assert.deepEqual(buildValidateCurrentActiveSpecArgs("FG", "15", "99"), {
  p_subject_type: "FG",
  p_product_id: 15,
  p_stock_item_id: null,
});
assert.deepEqual(buildValidateCurrentActiveSpecArgs("RM", "15", "44"), {
  p_subject_type: "RM",
  p_product_id: null,
  p_stock_item_id: 44,
});
assert.deepEqual(buildValidateCurrentActiveSpecArgs("PM", "15", "44"), {
  p_subject_type: "PM",
  p_product_id: null,
  p_stock_item_id: 44,
});

const rawConstraint = normalizeLabUserError({
  message:
    'new row for relation "spec_line" violates check constraint "chk_lab_spec_line_value_rules"',
  code: "23514",
});
assert.equal(rawConstraint, LAB_INVALID_SPEC_MESSAGE);
assert.doesNotMatch(rawConstraint, /spec_line|chk_lab_spec_line_value_rules|new row for relation|23514/);

const friendlyRange = normalizeLabUserError({
  message: LAB_RANGE_ORDER_MESSAGE,
  details: "code=INVALID_RANGE_ORDER",
  code: "22023",
});
assert.equal(friendlyRange, LAB_RANGE_ORDER_MESSAGE);

const activeAnalysis = normalizeLabUserError({
  code: "23505",
  message: "Active analysis already exists for this FG batch: AY/2026/1 (DRAFT)",
  details: "existing_analysis_id=10; bmr_id=2",
  hint: "Complete, approve for COA, or cancel the existing analysis.",
});
assert.equal(activeAnalysis, LAB_ACTIVE_ANALYSIS_MESSAGE);
assert.doesNotMatch(activeAnalysis, /23505|existing_analysis_id|AY\/2026|SQLSTATE/i);

assert.equal(
  normalizeLabUserError({
    message: 'permission denied for table lab.spec_override',
    code: "42501",
  }),
  LAB_PERMISSION_MESSAGE,
);
assert.equal(
  normalizeLabUserError({ message: "JWT expired", code: "PGRST301" }),
  LAB_SESSION_MESSAGE,
);
assert.equal(
  normalizeLabUserError({ message: "TypeError: Failed to fetch" }),
  LAB_NETWORK_MESSAGE,
);
assert.equal(
  normalizeLabUserError({
    message: 'null value in column "status" of relation "analysis_record"',
    code: "23502",
  }),
  LAB_UNKNOWN_MESSAGE,
);
assert.equal(
  normalizeLabUserError({
    message: "Batch No required for FG",
    code: "P0001",
  }),
  "Batch No required for FG",
);
assert.equal(
  normalizeLabUserError({
    message: "Not permitted to receive sample",
  }),
  "Not permitted to receive sample",
);

const startAnalysis = sliceFunction(entrySource, "startAnalysis");
assert.match(startAnalysis, /fn_receive_sample_and_create_analysis/);
assert.match(startAnalysis, /normalizeLabUserError\(err\)/);
assert.doesNotMatch(startAnalysis, /err\.message/);

assert.match(
  managerSource,
  /Min value must be less than Max value for RANGE\./,
);

assert.match(entrySource, /fn_resolve_current_active_spec_lines/);
assert.match(entrySource, /fn_validate_current_active_spec/);

console.log("lab-spec-validation-friendly-errors smoke: PASS");
