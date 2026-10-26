/**
 * UX-2 four-eyes copy. No database calls.
 */
import {
  APPROVAL_UNKNOWN,
  FOUR_EYES_REFUSALS,
  approvalNoticeFromError,
  classifyRpcError,
  fourEyesMessage,
  userMessageForError,
} from "../public/shared/js/eaushadhi-review-helpers.js";
import {
  REASONS,
  nextActionDecision,
  whoCanActText,
} from "../public/shared/js/eaushadhi-review-worklist.js";

let failed = 0;
const check = (ok, label) => {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`OK ${label}`);
  }
};

const RAW = /42501|FOUR_EYES|APPROVER_ROLE_REQUIRED|pgrst|\bhint\b/i;

for (const [code, row] of Object.entries(FOUR_EYES_REFUSALS)) {
  const error = { code: "42501", message: code, hint: "raw server hint" };
  const mapped = fourEyesMessage(error);
  const classified = classifyRpcError(error);
  const shown = userMessageForError(error);
  check(mapped?.text === row.text && mapped?.next === row.next, `${code} plain text and next action`);
  check(classified.userMessage === `${row.text} ${row.next}`, `${code} is classified before the permission sentence`);
  check(shown === classified.userMessage && !RAW.test(shown), `${code} open sentence hides the database text`);
  const wrapped = fourEyesMessage({
    message: "You do not have permission for this e-Aushadhi action.",
    original: { message: code, hint: "raw server hint" },
  });
  check(wrapped?.code === code, `${code} is still read from the original server message`);
}

const otherPermission = classifyRpcError({ code: "42501", message: "permission denied for table" });
check(
  otherPermission.userMessage === "You do not have permission for this e-Aushadhi action.",
  "a different 42501 stays the permission sentence",
);

const unknown = approvalNoticeFromError({ code: "XX000", message: "relation eaushadhi_product_review does not exist", rpcName: "rpc_eaushadhi_product_review_save" });
check(
  unknown.unknown === true
    && unknown.text === APPROVAL_UNKNOWN.text
    && unknown.next === APPROVAL_UNKNOWN.next
    && !RAW.test(`${unknown.text} ${unknown.next}`),
  "an unknown approval error uses the generic pair",
);
check(unknown.code === "XX000", "the approver technical block can still see the code");

function sample(label, nextStage, status, extra = {}) {
  const row = {
    product_id: 80,
    product_name: "Role sample",
    queue: "TO_VERIFY",
    stage_overview: "DONE",
    stage_details: "TODO",
    stage_composition: "TODO",
    stage_actions: "TODO",
    stage_qc: "TODO",
    stage_evidence: "TODO",
    stage_readiness: "TODO",
    stage_portal: "NOT_STARTED",
    next_action: label,
    next_stage: nextStage,
    ...extra,
  };
  row[`stage_${nextStage}`] = status;
  return row;
}

const people = {
  verifier: { is_verifier: true, is_approver: false, user_id: "verifier" },
  approver: { is_verifier: false, is_approver: true, user_id: "approver" },
  both: { is_verifier: true, is_approver: true, user_id: "both" },
  none: { is_verifier: false, is_approver: false, user_id: "none" },
  self: { is_verifier: true, is_approver: true, user_id: "same", selfApproval: true },
};
const steps = [
  ["Approve details", "details", "IN_REVIEW"],
  ["Verify details", "details", "TODO"],
];
for (const [label, stage, status] of steps) {
  const row = sample(label, stage, status, { last_changed_by: "same" });
  for (const [name, roles] of Object.entries(people)) {
    const decision = nextActionDecision(row, roles);
    const card = whoCanActText(row, roles);
    if (!decision.enabled) {
      check(card === decision.reason, `${label} / ${name} card matches the button reason`);
    } else if (stage === "details" && status === "IN_REVIEW") {
      check(card === "You can approve this step.", `${label} / ${name} can approve`);
    } else {
      check(card.includes("different approver"), `${label} / ${name} saves for a later approver`);
    }
  }
}

const locked = sample("Fill portal", "portal", "NOT_STARTED", { product_id: 262, queue: "READY_FOR_PORTAL" });
check(
  whoCanActText(locked, people.both) === REASONS.portal
    && nextActionDecision(locked, people.both).reason === REASONS.portal,
  "Product 262 portal lock uses the same sentence on the card and the button",
);

if (failed) {
  console.error(`UX-2 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-2 four-eyes smoke passed");
