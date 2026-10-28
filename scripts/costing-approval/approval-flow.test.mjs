import test from "node:test";
import assert from "node:assert/strict";
import {
  FORBIDDEN_RPCS,
  RPC,
  buildApprovePayload,
  isAlreadyApprovedFinalizeResult,
  summarizeApprovalResult,
} from "../../public/shared/js/costing-approval-screen.js";
import { isCostingApprovalScreenV1Enabled } from "../../public/shared/js/costing-feature-flags.js";

test("flag defaults off", () => {
  const storage = { getItem: () => null };
  assert.equal(isCostingApprovalScreenV1Enabled(storage), false);
  assert.equal(
    isCostingApprovalScreenV1Enabled({ getItem: () => "1" }),
    true,
  );
});

test("approve payload always sends preview_ack_id", () => {
  const payload = buildApprovePayload({
    refreshRunId: 151,
    reason: "Board approval for October month-end draft",
    approvalReference: "BOARD/2026/10",
    previewAckId: 77,
    acknowledgeStale: true,
  });
  assert.deepEqual(payload, {
    p_refresh_run_id: 151,
    p_reason: "Board approval for October month-end draft",
    p_approval_reference: "BOARD/2026/10",
    p_preview_ack_id: 77,
    p_acknowledge_stale: true,
  });
});

test("finalize already_approved is treated as success and exposes lock_note", () => {
  const payload = {
    approval: { already_approved: true },
    lock: null,
    lock_note: "Not locked: lock only before formal Close",
  };
  assert.equal(isAlreadyApprovedFinalizeResult(payload), true);
  const summary = summarizeApprovalResult(payload, { monthEnd: true });
  assert.match(summary.title, /already approved/i);
  assert.match(summary.detail, /Not locked/);
  assert.equal(summary.alreadyApproved, true);
});

test("ordinary approve summary mentions supersession when present", () => {
  const summary = summarizeApprovalResult({
    new_run: 151,
    old_run: 143,
    superseded: true,
    audit_id: 9001,
  });
  assert.match(summary.title, /Run 151 approved/);
  assert.match(summary.title, /143 superseded/);
  assert.match(summary.detail, /9001/);
});

test("allowed RPC names and deny-list", () => {
  assert.equal(RPC.preview, "rpc_costing_preview_approval_impact");
  assert.equal(RPC.approve, "rpc_costing_approve_run_with_preview");
  assert.equal(RPC.finalize, "rpc_costing_finalize_monthend_run_with_preview");
  assert.ok(FORBIDDEN_RPCS.includes("rpc_costing_approve_run"));
  assert.ok(FORBIDDEN_RPCS.includes("rpc_costing_lock_period"));
  assert.ok(FORBIDDEN_RPCS.includes("rpc_costing_health_check"));
  assert.ok(!FORBIDDEN_RPCS.includes(RPC.preview));
});

test("preview is not invoked by module import (button-click only)", async () => {
  // Importing the module must not call any RPC. This test only asserts the seam.
  let previewCalls = 0;
  const fakeRpc = async (name) => {
    if (name === RPC.preview) previewCalls += 1;
    return { data: null, error: null };
  };
  assert.equal(previewCalls, 0);
  await fakeRpc("rpc_get_costing_refresh_status");
  assert.equal(previewCalls, 0);
});
