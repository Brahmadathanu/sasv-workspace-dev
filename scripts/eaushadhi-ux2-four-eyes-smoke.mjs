/**
 * UX-2 four-eyes copy. No database calls.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPROVAL_UNKNOWN,
  FOUR_EYES_REFUSALS,
  approvalNoticeFromError,
  bulkApprovalSummary,
  classifyRpcError,
  fourEyesMessage,
  stageApprovalBlock,
  stageSaverCopy,
  userMessageForError,
} from "../public/shared/js/eaushadhi-review-helpers.js";
import {
  REASONS,
  actionDecision,
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

const samePerson = FOUR_EYES_REFUSALS.FOUR_EYES_SAME_PERSON;
check(
  stageSaverCopy({ saved_at: "2026-10-26T08:08:41Z", saved_by_me: true }, () => "26 Oct 2026, 01:38 pm")
    === "You saved this for review on 26 Oct 2026, 01:38 pm.",
  "saver line names you",
);
check(
  stageSaverCopy({ saved_at: "2026-10-26T08:08:41Z", saved_by_name: "Asha" }, () => "26 Oct 2026, 01:38 pm")
    === "Saved for review by Asha on 26 Oct 2026, 01:38 pm.",
  "saver line names the other person",
);
check(
  stageSaverCopy({ saved_at: "2026-10-26T08:08:41Z" }, () => "26 Oct 2026, 01:38 pm")
    === "Saved for review by another person on 26 Oct 2026, 01:38 pm.",
  "saver line stays plain when the name is missing",
);

const stages = ["details", "classification", "line", "actions", "qc"];
for (const stage of stages) {
  for (const code of Object.keys(FOUR_EYES_REFUSALS)) {
    const block = stageApprovalBlock({
      stage,
      item_key: stage === "line" || stage === "qc" ? "9" : null,
      review_status: "IN_REVIEW",
      block_code: code,
    }, { loaded: true });
    check(block?.code === code && block.userMessage === `${FOUR_EYES_REFUSALS[code].text} ${FOUR_EYES_REFUSALS[code].next}`, `${stage} ${code} disables Approve`);
  }
  check(stageApprovalBlock({ stage, review_status: "VERIFIED", block_code: "FOUR_EYES_SAME_PERSON" }, { loaded: true }) == null, `${stage} already verified has no block`);
}
check(stageApprovalBlock(null, { loaded: true })?.code === "FOUR_EYES_NOT_SAVED_FOR_REVIEW", "a missing stage row means it is not saved for review");
check(stageApprovalBlock({ block_code: "FOUR_EYES_SAME_PERSON" }, { failed: true, loaded: false }) == null, "a failed stage read does not invent a block");
check(stageApprovalBlock({ block_code: "FOUR_EYES_SAME_PERSON" }, { loaded: false }) == null, "a stage read that has not finished does not invent a block");

check(
  bulkApprovalSummary(["FOUR_EYES_SAME_PERSON", "FOUR_EYES_SAME_PERSON", "FOUR_EYES_SAME_PERSON", "FOUR_EYES_NOT_SAVED_FOR_REVIEW", "FOUR_EYES_NOT_SAVED_FOR_REVIEW"])
    === "3 need a different approver. 2 not saved for review yet",
  "bulk approval groups failures by reason",
);
check(
  bulkApprovalSummary(["APPROVER_ROLE_REQUIRED", "OTHER"]) === "1 need an approver. 1 could not be approved",
  "bulk approval counts the approver role and other failures",
);

const blocked = actionDecision({
  id: "btnVerifyDetails",
  label: "Approve",
  blockCode: "FOUR_EYES_SAME_PERSON",
  isApprover: true,
  productId: 11,
});
check(blocked.enabled === false && blocked.reason === `${samePerson.text} ${samePerson.next}`, "the stage block uses the same-person sentence");
const portalSame = actionDecision({
  id: "btnQcNativeSave",
  label: "Save to portal (one row)",
  selfApproval: true,
  isApprover: true,
  productId: 11,
});
check(portalSame.enabled === true, "portal save is not disabled for the same person");
const portalTextSame = actionDecision({
  id: "btnVerifyPortalDiseases",
  label: "Accept & Verify Portal Text",
  selfApproval: true,
  isApprover: true,
  productId: 11,
});
check(portalTextSame.enabled === true, "portal text is not disabled for the same person");
const lockedPortal = actionDecision({
  id: "btnQcNativeSave",
  label: "Save to portal (one row)",
  isApprover: true,
  productId: 262,
});
check(lockedPortal.enabled === false && lockedPortal.reason === REASONS.portal, "Product 262 portal save stays locked");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const control = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const api = readFileSync(join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const changelog = readFileSync(join(root, "docs/eaushadhi/CHANGELOG_DECISIONS.md"), "utf8");
check(!control.includes("selfMadeLastChange"), "workspace approval does not use the last editor");
check(api.includes("rpc_eaushadhi_stage_review_state_v1") && control.includes("fetchStageReviewState"), "the stage state read is wired");
check(changelog.includes("product_review.updated_by"), "the portal-text stamp limit is documented and not fixed in the client");

if (failed) {
  console.error(`UX-2 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-2 four-eyes smoke passed");
