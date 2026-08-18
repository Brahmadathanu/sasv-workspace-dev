/**
 * Gate — Approved Product Assignment administrative effective-from correction.
 * Client-only source/contract smoke. Mocked only.
 * Does NOT mutate live Assignment 71 / Product 142.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmActionLabel,
  isMeaningfulPrmApprovalReference,
  isMeaningfulPrmCancellationReason,
  PRODUCTION_ROUTE_RPC_NAMES,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  assertAllPrmRpcBuildersPresent,
  buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs,
  enforceExactPrmRpcKeys,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-assignment-effective-from-correction-smoke.mjs",
);

const correctRpcName = [
  "rpc",
  "correct_product_route_family_assignment_effective_from",
].join("_");

const correctFn =
  mainSrc.match(
    /function openCorrectAssignmentEffectiveFromModal\([\s\S]*?\n  async function findFamilyRow/,
  )?.[0] || "";
const actionsFn =
  mainSrc.match(
    /function buildAssignmentRowActionsHtml\([\s\S]*?\n  function buildProductAssignmentRowHtml/,
  )?.[0] || "";
const bindFn =
  mainSrc.match(
    /function bindProductAssignmentActions\([\s\S]*?\n  function buildWorkloadOverviewPanelHtml/,
  )?.[0] || "";
const createFn =
  mainSrc.match(
    /function openCreateAssignmentDraftModal\([\s\S]*?\n  function openSubmitAssignmentModal/,
  )?.[0] || "";
const submitFn =
  mainSrc.match(
    /function openSubmitAssignmentModal\([\s\S]*?\n  function openApproveAssignmentModal/,
  )?.[0] || "";
const approveFn =
  mainSrc.match(
    /function openApproveAssignmentModal\([\s\S]*?\n  function openCancelAssignmentModal/,
  )?.[0] || "";
const builderFn =
  rpcSrc.match(
    /export function buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs\([\s\S]*?\nexport function buildProductAssignmentsRpcArgs/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(correctRpcName) &&
    helpersSrc.includes(correctRpcName) &&
    assertAllPrmRpcBuildersPresent(),
  "RPC name is registered",
);

const built = buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs({
  assignment_id: 71,
  corrected_effective_from: "2026-08-14",
  correction_reason:
    "Correction of accidental effective-date data entry error.",
  correction_reference: "PRM-PRFA-CORR-P142-EFFECTIVE-DATE-20260816",
});
assert(
  built.ok &&
    Object.keys(built.params).join(",") ===
      "p_assignment_id,p_corrected_effective_from,p_correction_reason,p_correction_reference" &&
    built.params.p_assignment_id === 71 &&
    built.params.p_corrected_effective_from === "2026-08-14",
  "exact argument keys are produced",
);
assert(
  builderFn.includes("fallbackToToday: false") &&
    !buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs({
      assignment_id: 71,
      corrected_effective_from: null,
      correction_reason: "Meaningful reason text here",
      correction_reference: "PRM-PRFA-CORR-REF-1",
    }).ok,
  "date has no today fallback",
);
assert(
  !isMeaningfulPrmCancellationReason("N/A") &&
    !isMeaningfulPrmCancellationReason("—") &&
    !buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs({
      assignment_id: 71,
      corrected_effective_from: "2026-08-14",
      correction_reason: "N/A",
      correction_reference: "PRM-PRFA-CORR-REF-1",
    }).ok,
  "meaningful correction reason validation",
);
assert(
  !isMeaningfulPrmApprovalReference("-") &&
    !buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs({
      assignment_id: 71,
      corrected_effective_from: "2026-08-14",
      correction_reason: "Meaningful reason text here",
      correction_reference: "N/A",
    }).ok,
  "meaningful correction reference validation",
);
assert(
  !enforceExactPrmRpcKeys(correctRpcName, {
    ...built.params,
    p_extra: 1,
  }).ok,
  "extra keys rejected",
);

assert(
  formatPrmActionLabel("correct-assignment-effective-from") ===
    "Correct effective date" &&
    actionsFn.includes('status === "APPROVED"') &&
    actionsFn.includes("correct-assignment-effective-from") &&
    actionsFn.includes("canEdit()"),
  "action appears for APPROVED editable assignments",
);
assert(
  /status === "DRAFT"[\s\S]*submit-assignment/.test(actionsFn) &&
    !/status === "DRAFT"[\s\S]*correct-assignment-effective-from/.test(
      actionsFn.split('if (status === "APPROVED")')[0] || "",
    ) &&
    actionsFn.indexOf('status === "APPROVED"') >
      actionsFn.indexOf("DRAFT") &&
    actionsFn.includes("IN_REVIEW") &&
    !actionsFn.includes("CORRECT_EFFECTIVE_FROM"),
  "action does not appear for non-APPROVED assignment statuses",
);

assert(
  correctFn.includes("Administrative correction") &&
    /does not create a replacement/i.test(correctFn) &&
    /supersede/i.test(correctFn) &&
    /inactivate/i.test(correctFn) &&
    /approval reference/i.test(correctFn) &&
    /costing refresh/i.test(correctFn) &&
    /Stage 03/i.test(correctFn) &&
    !correctFn.includes("will supersede the current assignment"),
  "modal copy clearly describes correction, not replacement/supersession",
);
assert(
  correctFn.includes("Current Effective From") &&
    correctFn.includes("readonly: true") &&
    !correctFn.includes('id: "prmCorrectAssignApprovalRef"') &&
    !/approval_reference[\s\S]*type: "text"/.test(correctFn),
  "original approval reference is not presented as editable",
);
assert(
  correctFn.includes('value: currentEffectiveFrom') &&
    !correctFn.includes("getAsOfDate()") &&
    !correctFn.includes("getPrmLocalIsoDate()"),
  "corrected date defaults to current stored effective_from",
);

assert(
  correctFn.includes("RPC.correctAssignmentEffectiveFrom") &&
    correctFn.includes("buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs") &&
    (correctFn.match(/RPC\.correctAssignmentEffectiveFrom/g) || []).length ===
      1 &&
    correctFn.includes("withMutation") &&
    correctFn.includes("governed("),
  "single correction mutation via governed path",
);
assert(
  correctFn.includes("refreshAfterAssignmentMutation") &&
    !correctFn.includes("loadProductAssignments({") &&
    correctFn.includes(
      "Effective from corrected, but the register could not be refreshed.",
    ),
  "successful correction uses refreshAfterAssignmentMutation",
);
assert(
  mainSrc.includes("async function refreshProductAssignmentsAfterMutation") &&
    mainSrc.includes(
      "await refreshProductAssignmentsAfterMutation({\n        refreshFailureMessage",
    ) &&
    correctFn.includes("await refreshAfterAssignmentMutation"),
  "authoritative Product Assignment reread occurs",
);
assert(
  !correctFn.includes("assignmentRows.push") &&
    !correctFn.includes("optimistic") &&
    !correctFn.includes(".effective_from ="),
  "no optimistic row mutation",
);
assert(
  !correctFn.includes("refreshCosting") &&
    !correctFn.includes("request_costing_refresh") &&
    (correctFn.match(/RPC\.[a-zA-Z]+/g) || []).every(
      (name) => name === "RPC.correctAssignmentEffectiveFrom",
    ),
  "no costing refresh call",
);
assert(
  !correctFn.includes("stage03") &&
    !correctFn.includes("Stage03") &&
    !correctFn.includes("rpc_stage") &&
    !/RPC\.[^\n]*[Ss]tage/.test(correctFn) &&
    /costing refresh \/ Stage 03/.test(correctFn),
  "no Stage03 call",
);
assert(
  createFn.includes("RPC.createAssignmentDraft") &&
    !createFn.includes("correctAssignmentEffectiveFrom") &&
    submitFn.includes("RPC.submitAssignment") &&
    !submitFn.includes("correctAssignmentEffectiveFrom") &&
    approveFn.includes("RPC.approveAssignment") &&
    !approveFn.includes("correctAssignmentEffectiveFrom"),
  "Create / Submit / Approve assignment paths remain unchanged",
);
assert(
  bindFn.includes('correct-assignment-effective-from') &&
    bindFn.includes("openCorrectAssignmentEffectiveFromModal"),
  "action bound through existing assignment action architecture",
);
assert(
  thisSrc.includes("Does NOT mutate live") &&
    !thisSrc.includes(["await", "governed"].join(" ")),
  "no live Assignment 71 mutation in smoke",
);
assert(
  /hub-cache-v311/.test(swSrc),
  "SW bumped once to hub-cache-v311",
);

if (failed) {
  console.error(
    `production-route-product-assignment-effective-from-correction-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-assignment-effective-from-correction-smoke: all assertions passed",
);
