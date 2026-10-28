import test from "node:test";
import assert from "node:assert/strict";
import {
  ALREADY_DONE_RELOAD,
  REOPEN_PREVIEW,
  mapCostingApprovalError,
} from "../../public/shared/js/costing-approval-errors.js";

test("W2_APPROVAL_CHECKS_FAILED includes the server failed-check detail", () => {
  const mapped = mapCostingApprovalError(
    "W2_APPROVAL_CHECKS_FAILED: RUN_DATE_NOT_BEFORE_APPROVED; NO_BLOCKED_SKUS failed",
  );
  assert.equal(mapped.title, "This draft cannot be approved:");
  assert.match(mapped.detail, /RUN_DATE_NOT_BEFORE_APPROVED/);
});

test("W2_PREVIEW_ACK_ALREADY_USED means already done and reload", () => {
  const mapped = mapCostingApprovalError("W2_PREVIEW_ACK_ALREADY_USED: ack 9");
  assert.equal(mapped.action, ALREADY_DONE_RELOAD);
});

test("expired preview asks to reopen", () => {
  assert.equal(
    mapCostingApprovalError("W2_PREVIEW_ACK_EXPIRED: ttl").action,
    REOPEN_PREVIEW,
  );
});

test("MONTHEND refusals match by message start and keep server text", () => {
  const open = mapCostingApprovalError(
    "MONTHEND_PERIOD_NOT_OPEN: period 2026-10-01 is LOCKED",
  );
  assert.equal(
    open.title,
    "This month is not open for month-end finalisation.",
  );
  assert.match(open.detail, /MONTHEND_PERIOD_NOT_OPEN/);

  assert.equal(
    mapCostingApprovalError("MONTHEND_PERIOD_NOT_FINISHED: still October")
      .title,
    "The month has not ended yet.",
  );
  assert.equal(
    mapCostingApprovalError(
      "MONTHEND_VALUATION_DATE_MISMATCH: dated 2026-10-15",
    ).title,
    "This run is not dated at the month end.",
  );
  assert.equal(
    mapCostingApprovalError("MONTHEND_RUN_NOT_FOUND: missing").title,
    "Run not found.",
  );
});

test("owner / permission / reason / reference errors come before MONTHEND_*", () => {
  const owner = mapCostingApprovalError(
    "W2_OWNER_ONLY: MONTHEND_PERIOD_NOT_OPEN: should not win",
  );
  assert.equal(owner.kind, "owner");

  const reason = mapCostingApprovalError(
    "W2_REASON_REQUIRED: MONTHEND_RUN_NOT_FOUND: should not win",
  );
  assert.equal(reason.kind, "reason");

  const reference = mapCostingApprovalError(
    "W2_APPROVAL_REFERENCE_REQUIRED: MONTHEND_PERIOD_NOT_FINISHED: should not win",
  );
  assert.equal(reference.kind, "reference");

  const permission = mapCostingApprovalError(
    "permission denied for module:costing-control-center; MONTHEND_PERIOD_NOT_OPEN: locked",
  );
  assert.equal(permission.kind, "permission");
});
