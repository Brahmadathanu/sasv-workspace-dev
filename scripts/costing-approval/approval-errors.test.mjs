import test from "node:test";
import assert from "node:assert/strict";
import {
  ALREADY_DONE_RELOAD,
  REOPEN_PREVIEW,
  mapCostingApprovalError,
  mapCostingLockError,
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

test("CODE prefix is mapped before free-text patterns", () => {
  const mapped = mapCostingApprovalError(
    "W2_OWNER_ONLY: Permission denied for module:costing-control-center",
  );
  assert.equal(mapped.kind, "owner");
  assert.equal(mapped.title, "Only the costing governance owner can approve.");
});

test("module permission denial uses edit-permission wording, not owner-only", () => {
  const mapped = mapCostingApprovalError(
    "Permission denied for module:costing-control-center",
  );
  assert.equal(mapped.kind, "permission");
  assert.equal(
    mapped.title,
    "You don't have edit permission for the Costing Control Centre.",
  );
  assert.match(mapped.detail, /Permission denied for module:costing-control-center/);
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
    "Permission denied for module:costing-control-center; MONTHEND_PERIOD_NOT_OPEN: locked",
  );
  assert.equal(permission.kind, "permission");
  assert.match(permission.title, /edit permission/i);
});

const lockCase = (name, message, title) =>
  test(name, () => assert.equal(mapCostingLockError(message).title, title));

lockCase("lock permission whole text is matched before its embedded colon", "Permission denied for module:costing-control-center (edit=true)", "You do not have costing permission.");
lockCase("lock Not authenticated text asks for sign in", "Not authenticated", "Please sign in again.");
lockCase("lock W2_AUTH_REQUIRED remains mapped", "W2_AUTH_REQUIRED: session", "Please sign in again.");
lockCase("lock owner wording is action specific", "W2_OWNER_ONLY: reserved", "Only the costing owner can lock a month.");
lockCase("lock reason refusal is mapped", "W2_REASON_REQUIRED: short", "Please give a reason (at least 10 characters).");
lockCase("lock approval reference code without colon is mapped", "W2_APPROVAL_REFERENCE_REQUIRED", "Please give an approval reference.");
lockCase("lock missing period is mapped", "W2_PERIOD_NOT_FOUND: 2026-08-01", "This month does not exist in costing.");
lockCase("lock requires open and keeps lock wording", "W2_LOCK_REQUIRES_OPEN: period is LOCKED", "This month is not open (it is already locked or closed).");
lockCase("lock requires approved run", "W2_LOCK_REQUIRES_APPROVED_RUN: none", "This month has no approved run, so it cannot be locked.");
lockCase("lock active run is mapped", "W2_ACTIVE_RUN: queued", "A run is queued or running for this month. Try again after it finishes.");
lockCase("lock fingerprint drift is mapped", "W2_FINGERPRINT_DRIFT: run 143", "The approved run's data no longer matches its fingerprint. Do not lock; tell the costing assistant.");
lockCase("batch null array chooses a month", "W2_BATCH_NULL_ARRAY: null", "Choose at least one month.");
lockCase("batch empty chooses a month", "W2_BATCH_EMPTY: empty", "Choose at least one month.");
lockCase("batch null element chooses a month", "W2_BATCH_NULL_ELEMENT: null", "Choose at least one month.");
lockCase("batch duplicate month is mapped", "W2_BATCH_DUPLICATE_MONTH: 2026-09-01", "A month is listed twice.");
lockCase("batch first-of-month refusal is mapped", "W2_BATCH_NOT_FIRST_OF_MONTH: 2026-09-02", "Months must be given as the first day of the month.");
lockCase("batch mixed quarter is mapped", "W2_BATCH_MIXED_QUARTER: mixed", "Lock one calendar quarter at a time.");
lockCase("batch unknown month is mapped", "W2_BATCH_UNKNOWN_MONTH: missing", "One or more months do not exist in costing.");
test("both month-not-finished prefixes use the lock wording", () => {
  for (const code of ["W2_PERIOD_NOT_FINISHED", "MONTHEND_PERIOD_NOT_FINISHED"]) {
    assert.equal(mapCostingLockError(`${code}: open`).title, "This month has not ended yet, so it cannot be locked.");
  }
});
test("unknown lock refusal falls back with its first line", () => {
  const mapped = mapCostingLockError("ODD_REFUSAL no colon\nsecret second line");
  assert.equal(mapped.title, "The server refused:");
  assert.equal(mapped.detail, "ODD_REFUSAL no colon");
});
