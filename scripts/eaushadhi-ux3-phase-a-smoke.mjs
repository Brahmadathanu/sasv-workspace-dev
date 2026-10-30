/**
 * UX-3 Fill on portal contracts (Phase A + B1). No database calls.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSIFICATION_MISSING_OPTION_COPY,
  CLASSIFICATION_PLACEHOLDER_SUBTYPE_COPY,
  PORTAL_APPROVER_ONLY_GATE_COPY,
  PORTAL_MULTIPLE_SAVERS_COPY,
  PORTAL_ENTRY_NOT_ENABLED_COPY,
  PORTAL_ENTRY_ON_NO_AUTOSAVE_COPY,
  PORTAL_GATE_APPROVER_REFUSAL_COPY,
  PORTAL_PRODUCT_CLOSED_COPY,
  PORTAL_SAME_PERSON_WARNING_COPY,
  PORTAL_STEP_COMPOSITION_BLOCKED_COPY,
  PORTAL_STEP_QC_BLOCKED_COPY,
  classificationSelectedOptionDisplay,
  isFillEligibleClassificationOption,
  isPortalPlaceholderSubtypeOption,
  portalFillStepperModel,
  portalGateReasonOk,
  portalGateRefusalMessage,
  selectableClassificationOptions,
} from "../public/shared/js/eaushadhi-review-helpers.js";

let failed = 0;
let passed = 0;
const check = (ok, label) => {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${label}`);
  } else {
    passed += 1;
    console.log(`OK ${label}`);
  }
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const control = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const helpers = readFileSync(join(root, "public/shared/js/eaushadhi-review-helpers.js"), "utf8");
const api = readFileSync(join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const sw = readFileSync(join(root, "public/sw.js"), "utf8");

check(
  PORTAL_ENTRY_NOT_ENABLED_COPY === "Portal entry is not enabled for this product yet.",
  "not-enabled copy is exact",
);
check(
  PORTAL_ENTRY_ON_NO_AUTOSAVE_COPY
    === "Portal entry is turned on. Automatic portal Save for this product is not available yet.",
  "gate-on no-autosave copy is exact",
);
check(
  PORTAL_MULTIPLE_SAVERS_COPY
    === "More than one person saved steps for review on this product, including you. An Approver who saved none of them must authorize the portal Save.",
  "multiple-savers copy is exact",
);

check(
  !new RegExp(["both", "approvers"].join("_") + "|" + ["BOTH", "APPROVERS"].join("_") + "|" + "both" + "Approvers").test(helpers + control),
  "retired multiple-saver identifiers are absent from helpers and control",
);

const closed = portalFillStepperModel({
  productId: 262,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [],
  actionsDraft: [],
  actionsReviewStatus: "VERIFIED",
  stageReview: [],
  gateEnabled: true,
  isApprover: true,
});
check(closed.closedProduct === true && closed.showGateToggle === false, "Product 262 is closed with no gate toggle");
check(closed.closedMessage === PORTAL_PRODUCT_CLOSED_COPY, "Product 262 shows closed copy only");
check(closed.portalSteps.length === 0, "Product 262 has no portal fill steps");

const gateOff = portalFillStepperModel({
  productId: 1,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [],
  actionsDraft: ["Deepana"],
  actionsReviewStatus: "VERIFIED",
  stageReview: [],
  gateEnabled: false,
  isApprover: true,
});
check(gateOff.screenState === "gate_off", "gate off screen state");
check(gateOff.showGateToggle === true, "Approver sees gate toggle when product is not closed");
check(
  gateOff.portalSteps.find((s) => s.id === "product_details")?.reason === PORTAL_ENTRY_NOT_ENABLED_COPY,
  "Product Details step blocked while gate off",
);

const gateOnReady = portalFillStepperModel({
  productId: 1,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [{ source_composition_line_id: "1", source_row_no: 1, raw_ingredient_name: "X", review_status: "VERIFIED" }],
  actionsDraft: ["Deepana"],
  actionsReviewStatus: "VERIFIED",
  stageReview: [],
  gateEnabled: true,
  isApprover: true,
});
check(gateOnReady.screenState === "ready", "ready when gate on and stages verified");
check(
  gateOnReady.portalEntryMessage === PORTAL_ENTRY_ON_NO_AUTOSAVE_COPY
    && gateOnReady.portalSteps.find((s) => s.id === "product_details")?.reason
      === PORTAL_ENTRY_ON_NO_AUTOSAVE_COPY,
  "gate on shows automatic Save not available yet",
);

const unverified = portalFillStepperModel({
  productId: 1,
  review: { review_status: "IN_REVIEW" },
  classification: { review_status: "PENDING" },
  lines: [],
  actionsDraft: [],
  actionsReviewStatus: "PENDING",
  stageReview: [],
  gateEnabled: true,
  isApprover: false,
});
check(
  unverified.screenState === "stages_unverified"
    && unverified.unverifiedStageLabels.includes("Product Details")
    && unverified.showGateToggle === false
    && unverified.approverOnlyCopy === PORTAL_APPROVER_ONLY_GATE_COPY,
  "gate on with unverified stages lists them; non-Approver has no toggle",
);

const samePerson = portalFillStepperModel({
  productId: 1,
  review: { review_status: "IN_REVIEW" },
  classification: { review_status: "VERIFIED" },
  lines: [],
  actionsDraft: [],
  actionsReviewStatus: "VERIFIED",
  stageReview: [{ stage: "details", saved_at: "2026-10-29T10:00:00Z", saved_by_me: true }],
  gateEnabled: false,
  isApprover: true,
});
check(
  samePerson.samePersonWarning === PORTAL_SAME_PERSON_WARNING_COPY
    && samePerson.samePersonWarningBlocks === false,
  "same-person warning shows when saved by me and Details is not Verified",
);
const verifiedSelf = portalFillStepperModel({
  productId: 1,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [],
  actionsDraft: [],
  actionsReviewStatus: "VERIFIED",
  stageReview: [{ stage: "details", saved_at: "2026-10-29T10:00:00Z", saved_by_me: true }],
  gateEnabled: true,
  isApprover: true,
});
check(
  verifiedSelf.samePersonWarning === "" && verifiedSelf.screenState === "same_person_blocked",
  "same-person warning hidden when Verified; same-person blocked state when gate on",
);

const both = portalFillStepperModel({
  productId: 1,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [],
  actionsDraft: [],
  actionsReviewStatus: "VERIFIED",
  stageReview: [
    { stage: "details", saved_at: "2026-10-29T10:00:00Z", saved_by_me: true },
    { stage: "classification", saved_at: "2026-10-29T11:00:00Z", saved_by_me: false, saved_by_name: "Aneesh" },
  ],
  gateEnabled: true,
  isApprover: true,
});
check(
  both.multipleSavers === true && both.screenState === "multiple_savers" && both.portalEntryMessage === PORTAL_MULTIPLE_SAVERS_COPY,
  "multiple savers state and copy when two savers exist",
);

check(portalGateReasonOk("1234567890") === true, "reason length 10 is accepted");
check(portalGateReasonOk("123456789") === false, "reason length under 10 is refused");
check(portalGateReasonOk("x".repeat(1001)) === false, "reason length over 1000 is refused");
check(
  portalGateRefusalMessage({ message: "APPROVER_ROLE_REQUIRED" }) === PORTAL_GATE_APPROVER_REFUSAL_COPY,
  "gate APPROVER_ROLE_REQUIRED uses Only an Approver can do this",
);

const karpooradiSubtype = {
  portal_option_id: "274",
  portal_external_id: "31",
  label: "-",
  fill_eligible: false,
};
const categoryWith31 = {
  portal_option_id: "500",
  portal_external_id: "31",
  label: "Special Category",
  fill_eligible: true,
};
const realSubtype = {
  portal_option_id: "99",
  portal_external_id: "12",
  label: "Tailam",
  fill_eligible: true,
};
check(
  isPortalPlaceholderSubtypeOption(karpooradiSubtype) === true
    && selectableClassificationOptions([karpooradiSubtype, realSubtype], { domain: "PRODUCT_SUBTYPE" }).every(
      (opt) => String(opt.portal_option_id) !== "274",
    ),
  "A1 placeholder subtype is not fill-selectable for Sub Type",
);
check(
  classificationSelectedOptionDisplay([karpooradiSubtype, realSubtype], "274", {
    domain: "PRODUCT_SUBTYPE",
  }).label === CLASSIFICATION_PLACEHOLDER_SUBTYPE_COPY,
  "A1 Product 262 placeholder subtype displays No sub type copy",
);
check(
  classificationSelectedOptionDisplay([realSubtype], "99", { domain: "PRODUCT_SUBTYPE" }).label === "Tailam",
  "A1 non-placeholder Sub Type selection shows the real label",
);
check(
  classificationSelectedOptionDisplay([realSubtype], "274", { domain: "PRODUCT_SUBTYPE" }).label
    === CLASSIFICATION_MISSING_OPTION_COPY,
  "A1 missing Sub Type uses administrator copy",
);
check(
  isFillEligibleClassificationOption(categoryWith31, { domain: "PRODUCT_CATEGORY" }) === true
    && selectableClassificationOptions([categoryWith31], { domain: "PRODUCT_CATEGORY" }).length === 1
    && classificationSelectedOptionDisplay([categoryWith31], "500", { domain: "PRODUCT_CATEGORY" }).label
      === "Special Category",
  "31/32 placeholder rule does not treat Categories as placeholders",
);
check(
  !control.includes("Current value ") && control.includes("classificationSelectedOptionDisplay"),
  "A1 never shows Current value <id>",
);

check(
  api.includes("rpc_eaushadhi_portal_entry_gate_get_v1")
    && api.includes("rpc_eaushadhi_portal_entry_gate_set_v1")
    && api.includes("export async function fetchPortalEntryGate")
    && api.includes("export async function setPortalEntryGate"),
  "B1 gate get/set wrappers exist in api",
);
check(
  control.includes("btnPortalEntryGateOn")
    && control.includes("btnPortalEntryGateOff")
    && control.includes("fldPortalEntryGateReason")
    && control.includes("submitPortalEntryGateToggle")
    && control.includes("loadPortalEntryGate"),
  "B1 Approver gate toggle is wired in Fill on portal",
);
check(
  control.includes("loadPortalEntryGate(id)")
    && /await setPortalEntryGate\([\s\S]*?await loadPortalEntryGate\(id\)/.test(control),
  "B1 gate is re-read after set",
);

const fillFn = control.slice(
  control.indexOf("function renderFillOnPortalSection"),
  control.indexOf("function renderReadiness"),
);
check(
  !fillFn.includes("SAVE PRODUCT")
    && !fillFn.includes("data-portal-fill-authorize")
    && !fillFn.includes("btnFillOnPortalAuthorize")
    && !fillFn.includes("showAuthorizeUi: true")
    && !/<(button|input)[^>]*(Authorize|Submit)/i.test(fillFn),
  "Fill on portal has no Authorize, Submit, or typed-confirmation control",
);
check(
  !control.includes("save_authorization")
    && !helpers.includes("save_authorization")
    && !/startWorkerProductDetails|previewWorkerProductDetails/.test(fillFn),
  "B1 introduces no worker Save authorization path from Fill on portal",
);
check(
  gateOnReady.portalSteps.find((s) => s.id === "composition")?.reason
    === PORTAL_STEP_COMPOSITION_BLOCKED_COPY
    && gateOnReady.portalSteps.find((s) => s.id === "qc")?.reason === PORTAL_STEP_QC_BLOCKED_COPY,
  "Composition and QC stay blocked",
);
check(
  gateOff.showAuthorizeUi === false
    && gateOff.showTypedConfirmation === false
    && gateOff.showSubmit === false
    && gateOff.showSaveUi === false,
  "model never exposes Save, Submit, Authorize, or typed confirmation in B1",
);
check(/hub-cache-v376/.test(sw) && !/hub-cache-v377/.test(sw), "cache stays at v376");

console.log(`UX-3 smoke checks: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`UX-3 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-3 smoke passed");
