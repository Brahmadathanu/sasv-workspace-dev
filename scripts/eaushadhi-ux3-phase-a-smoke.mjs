/**
 * UX-3 Phase A — Fill on portal display-only contracts. No database calls.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSIFICATION_MISSING_OPTION_COPY,
  CLASSIFICATION_PLACEHOLDER_SUBTYPE_COPY,
  PORTAL_ENTRY_NOT_ENABLED_COPY,
  PORTAL_PRODUCT_CLOSED_COPY,
  PORTAL_SAME_PERSON_WARNING_COPY,
  PORTAL_STEP_COMPOSITION_BLOCKED_COPY,
  PORTAL_STEP_QC_BLOCKED_COPY,
  classificationSelectedOptionDisplay,
  isPortalPlaceholderSubtypeOption,
  portalFillStepperModel,
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
const sw = readFileSync(join(root, "public/sw.js"), "utf8");
const api = readFileSync(join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");

check(
  PORTAL_ENTRY_NOT_ENABLED_COPY === "Portal entry is not enabled for this product yet.",
  "not-enabled copy is exact",
);

const closed = portalFillStepperModel({
  productId: 262,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [{ source_composition_line_id: "1", source_row_no: 1, raw_ingredient_name: "X", review_status: "VERIFIED" }],
  actionsDraft: ["Action A"],
  actionsReviewStatus: "VERIFIED",
  stageReview: [],
});
check(closed.closedProduct === true, "Product 262 is closed");
check(closed.closedMessage === PORTAL_PRODUCT_CLOSED_COPY, "Product 262 shows closed copy only");
check(closed.portalSteps.length === 0, "Product 262 has no portal fill steps");
check(closed.showSaveUi === false && closed.showSubmit === false, "closed product exposes no Save or Submit flags");

const open = portalFillStepperModel({
  productId: 1,
  review: { review_status: "IN_REVIEW" },
  classification: { review_status: "PENDING" },
  lines: [
    {
      source_composition_line_id: "10",
      source_row_no: 1,
      raw_ingredient_name: "Guduchi",
      review_status: "VERIFIED",
    },
    {
      source_composition_line_id: "11",
      source_row_no: 2,
      raw_ingredient_name: "Amla",
      review_status: "PENDING",
    },
  ],
  actionsDraft: ["Deepana", "Pachana"],
  actionsReviewStatus: "IN_REVIEW",
  stageReview: [{ stage: "details", item_key: "", saved_at: "2026-10-29T10:00:00Z", saved_by_me: true }],
});
check(open.closedProduct === false, "non-262 product is not closed");
check(
  open.portalEntryMessage === PORTAL_ENTRY_NOT_ENABLED_COPY,
  "non-262 shows portal entry is not enabled for this product yet",
);
check(
  open.statusRows.some((row) => row.kind === "details")
    && open.statusRows.some((row) => row.kind === "classification")
    && open.statusRows.filter((row) => row.kind === "line").length === 2
    && open.statusRows.filter((row) => row.kind === "action").length === 2,
  "status lists Details, Classification, every line, every pharmacological action",
);
check(
  open.portalSteps.find((step) => step.id === "composition")?.reason
    === PORTAL_STEP_COMPOSITION_BLOCKED_COPY
    && open.portalSteps.find((step) => step.id === "qc")?.reason === PORTAL_STEP_QC_BLOCKED_COPY,
  "Composition and QC steps are blocked with plain reasons",
);
check(
  open.portalSteps.find((step) => step.id === "product_details")?.reason
    === PORTAL_ENTRY_NOT_ENABLED_COPY,
  "Product Details step uses the not-enabled sentence",
);
check(
  open.samePersonWarning === PORTAL_SAME_PERSON_WARNING_COPY
    && open.samePersonWarningBlocks === false,
  "same-person warning shows when saved by me and Details is not Verified",
);
const verifiedSelf = portalFillStepperModel({
  productId: 1,
  review: { review_status: "VERIFIED" },
  classification: { review_status: "VERIFIED" },
  lines: [],
  actionsDraft: [],
  actionsReviewStatus: "VERIFIED",
  stageReview: [{ stage: "details", item_key: "", saved_at: "2026-10-29T10:00:00Z", saved_by_me: true }],
});
check(
  verifiedSelf.samePersonWarning === ""
    && verifiedSelf.samePersonWarningBlocks === false,
  "same-person warning is hidden once Product Details is Verified",
);

// A1 — placeholder / missing subtype display (Product 262 evidence shape)
const karpooradiSubtype = {
  portal_option_id: "274",
  portal_external_id: "31",
  label: "-",
  fill_eligible: false,
};
const realSubtype = {
  portal_option_id: "99",
  portal_external_id: "12",
  label: "Tailam",
  fill_eligible: true,
};
check(
  isPortalPlaceholderSubtypeOption(karpooradiSubtype) === true
    && selectableClassificationOptions([karpooradiSubtype, realSubtype]).every(
      (opt) => String(opt.portal_option_id) !== "274",
    ),
  "A1 placeholder subtype '-' / portal value 31 is not a fill-selectable option",
);
check(
  classificationSelectedOptionDisplay([karpooradiSubtype, realSubtype], "274").label
    === CLASSIFICATION_PLACEHOLDER_SUBTYPE_COPY,
  "A1 Product 262 placeholder subtype displays No sub type (portal shows '-')",
);
check(
  classificationSelectedOptionDisplay([karpooradiSubtype, realSubtype], "99").label === "Tailam",
  "A1 non-placeholder selection shows the real option label",
);
check(
  classificationSelectedOptionDisplay([realSubtype], "274").label
    === CLASSIFICATION_MISSING_OPTION_COPY,
  "A1 missing selected option uses the administrator copy",
);
check(
  !control.includes("Current value ")
    && control.includes("classificationSelectedOptionDisplay"),
  "A1 never shows Current value <id> in classification option HTML",
);
check(
  open.showSaveUi === false
    && open.showSubmit === false
    && open.showAuthorizeUi === false
    && open.showTypedConfirmation === false,
  "Phase A model never exposes Save, Submit, Authorize, or typed confirmation",
);

const fillFn = control.slice(
  control.indexOf("function renderFillOnPortalSection"),
  control.indexOf("function renderReadiness"),
);
check(control.includes("function renderFillOnPortalSection"), "Fill on portal renderer exists");
check(
  control.includes("${renderFillOnPortalSection()}")
    && /function renderReadiness\([\s\S]*renderFillOnPortalSection\(\)/.test(control),
  "Fill on portal section is rendered inside Readiness",
);
check(
  fillFn.includes("fillOnPortalSection")
    && fillFn.includes("model.portalSteps")
    && !fillFn.includes("SAVE PRODUCT")
    && !fillFn.includes('type="checkbox"')
    && !fillFn.includes("btnFillOnPortal")
    && !fillFn.includes("data-portal-fill-save")
    && !fillFn.includes("data-portal-fill-submit")
    && !fillFn.includes("data-portal-fill-authorize"),
  "Fill on portal section markup has no Save, Submit, Authorize, or typed-confirmation control",
);
check(
  fillFn.includes("portal-fill-step") && fillFn.includes("model.portalSteps"),
  "Fill on portal renders portal steps from the model",
);
check(
  !helpers.includes("rpc_eaushadhi_portal_entry_gate_")
    && !control.includes("rpc_eaushadhi_portal_entry_gate_")
    && !api.includes("rpc_eaushadhi_portal_entry_gate_")
    && !control.includes("save_authorization")
    && !helpers.includes("save_authorization"),
  "Phase A introduces no portal gate or save_authorization RPC usage",
);
check(/hub-cache-v376/.test(sw) && !/hub-cache-v377/.test(sw), "cache stays at v376");

// Markup contract: Composition and QC blocked reasons appear via model constants used by UI path
check(
  control.includes("portalFillStepperModel")
    && helpers.includes("PORTAL_STEP_COMPOSITION_BLOCKED_COPY")
    && helpers.includes("PORTAL_STEP_QC_BLOCKED_COPY"),
  "Composition and QC blocked reasons are wired through the helper model",
);

const sectionHasNoActionControls =
  !/<(button|input|textarea)[^>]*(Save|Submit|Authorize|SAVE PRODUCT)/i.test(fillFn)
  && !/data-portal-fill-(save|submit|authorize)/i.test(fillFn);
check(
  sectionHasNoActionControls,
  "Fill on portal section has no Save, Submit, Authorize or typed-confirmation control elements",
);

console.log(`UX-3 smoke checks: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`UX-3 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-3 smoke passed");
