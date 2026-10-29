/**
 * UX-5 client contracts. No database calls.
 * Goals: verified lock, in-page leave confirm, composition Save for review,
 * correction-note display, empty classification options.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSIFICATION_OPTIONS_UNLOADED_COPY,
  canVerifyClassification,
  classificationScopedOptionsUnloaded,
  classificationVerifyPendingCopy,
  LINE_SAVE_FOR_REVIEW_LABEL,
  LINE_SAVED_FOR_REVIEW_LABEL,
  lineSaveForReviewUi,
  normalizeReviewNotesForDisplay,
  verifyReviewedEmptyGuidance,
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
const sw = readFileSync(join(root, "public/sw.js"), "utf8");

// --- Goal 1: lock after VERIFIED ---
check(
  /classDisable = classLocked\s*\?\s*' disabled aria-disabled="true" data-force-disabled="true"'/.test(control),
  "Goal 1 classification uses force-disabled lock attrs",
);
check(
  /const disable = locked\s*\?\s*' disabled aria-disabled="true" data-force-disabled="true"'/.test(control),
  "Goal 1 Product Details / Actions use force-disabled lock attrs",
);
check(
  /const lockedControlAttrs = locked\s*\?\s*' disabled aria-disabled="true" data-force-disabled="true"'/.test(control),
  "Goal 1 composition already force-disables verified line controls",
);
check(
  control.includes('if (isVerifiedStatus(state.classification?.review_status))')
    && control.includes('if (isVerifiedStatus(state.review?.review_status))')
    && control.includes('if (isVerifiedStatus(state.actionsReviewStatus)'),
  "Goal 1 verified sections revert edits in event handlers",
);
check(!control.includes("hub-cache-v377"), "Goal 1 does not bump cache past v376 in control");
check(/hub-cache-v376/.test(sw) && !/hub-cache-v377/.test(sw), "cache stays at v376 for merge plan");

// --- Goal 2: in-page leave confirm ---
check(!control.includes("window.confirm("), "Goal 2 removes native window.confirm");
check(
  control.includes('okLabel: "Leave without saving"')
    && control.includes('cancelLabel: "Stay"')
    && control.includes('idPrefix: "leaveDirtyConfirm"'),
  "Goal 2 leave dialog uses Stay / Leave without saving",
);
check(
  control.includes("cancelLabel")
    && /cancelBtn\.textContent = String\(cancelLabel \|\| "Cancel"\)/.test(control),
  "Goal 2 openQcConfirm supports cancelLabel",
);
check(
  control.includes('await confirmLeaveDirty("backToQueueBtn")')
    && control.includes('await confirmLeaveDirty("homeBtn")')
    && control.includes('await confirmLeaveDirty("openReferenceDictionaryBtn")'),
  "Goal 2 leave confirm is awaited at exit paths",
);
const openProductFn = control.slice(
  control.indexOf("async function openProduct"),
  control.indexOf("async function reloadSelected"),
);
check(
  /async function openProduct\(productId,\s*returnFocus\s*=\s*null\)/.test(openProductFn)
    && openProductFn.includes('confirmLeaveDirty(returnFocus != null ? returnFocus : "backToQueueBtn")')
    && !openProductFn.includes('confirmLeaveDirty("backToQueueBtn")'),
  "UX-5.1 openProduct no longer hard-codes backToQueueBtn for leave focus",
);
check(
  control.includes("function resolveReturnFocus")
    && control.includes("resolveReturnFocus(returnFocus, returnFocusId)"),
  "UX-5.1 openQcConfirm accepts an element or id for return focus",
);
check(
  /openProduct\(row\.dataset\.productId,\s*row\)/.test(control),
  "UX-5.1 queue row click/Enter passes the clicked row as return focus",
);
check(
  control.includes(
    "This line has a save conflict. Refresh the product, then save for review again.",
  )
    && /if \(!verify\) \{[\s\S]*?lineHalted\.has\(id\) \|\| !canWrite\(\)[\s\S]*?This line has a save conflict/.test(
      control,
    ),
  "UX-5.1 explicit Save for review shows the conflict toast when halted or not writable",
);
const autosaveLineFn = control.slice(
  control.indexOf("async function autosaveLine"),
  control.indexOf("function queueLineAutosave"),
);
check(
  /if \(lineHalted\.has\(id\) \|\| !canWrite\(\)\) return;/.test(autosaveLineFn)
    && !autosaveLineFn.includes("This line has a save conflict"),
  "UX-5.1 background autosave stays silent on halt / no-write",
);

// --- Goal 3: composition Save for review + toast + notes ---
const draft = {
  sourceCompositionLineId: "12",
  ingredientTypeOptionId: "1",
  ingredientFormOptionId: "2",
  partUsedOptionId: "3",
  measurementOptionId: "4",
  reviewNotes: "",
  rowVersion: 1,
};
const baseline = { ...draft };
check(
  lineSaveForReviewUi({
    reviewStatus: "VERIFIED",
    draft,
    baseline,
    stageRow: null,
  }).visible === false,
  "Goal 3 Save for review is hidden on VERIFIED lines",
);
const pendingSave = lineSaveForReviewUi({
  reviewStatus: "PENDING",
  draft,
  baseline,
  stageRow: null,
  canWrite: true,
});
check(
  pendingSave.visible === true
    && pendingSave.enabled === true
    && pendingSave.label === LINE_SAVE_FOR_REVIEW_LABEL,
  "Goal 3 Save for review stays enabled when suggestions are unchanged",
);
const afterCorrect = lineSaveForReviewUi({
  reviewStatus: "PENDING",
  draft,
  baseline,
  stageRow: null,
  canWrite: true,
});
check(
  afterCorrect.enabled === true && afterCorrect.label === LINE_SAVE_FOR_REVIEW_LABEL,
  "Goal 3 Save for review is available after Correct source (PENDING, no saver)",
);
const savedByMe = lineSaveForReviewUi({
  reviewStatus: "IN_REVIEW",
  draft,
  baseline,
  stageRow: { saved_at: "2026-10-28T10:00:00Z", saved_by_me: true },
  canWrite: true,
});
check(
  savedByMe.enabled === false && savedByMe.label === LINE_SAVED_FOR_REVIEW_LABEL,
  "Goal 3 shows disabled Saved for review after a clean self-save",
);
const savedByOther = lineSaveForReviewUi({
  reviewStatus: "IN_REVIEW",
  draft,
  baseline,
  stageRow: { saved_at: "2026-10-28T10:00:00Z", saved_by_me: false, saved_by_name: "Aneesh" },
  canWrite: true,
});
check(
  savedByOther.enabled === false && savedByOther.label === LINE_SAVED_FOR_REVIEW_LABEL,
  "Goal 3 does not re-save a clean line saved by another person",
);
const dirtyAfterOther = lineSaveForReviewUi({
  reviewStatus: "IN_REVIEW",
  draft: { ...draft, measurementOptionId: "99" },
  baseline,
  stageRow: { saved_at: "2026-10-28T10:00:00Z", saved_by_me: false, saved_by_name: "Aneesh" },
  canWrite: true,
});
check(
  dirtyAfterOther.enabled === true && dirtyAfterOther.label === LINE_SAVE_FOR_REVIEW_LABEL,
  "Goal 3 allows Save for review after editing a line another person saved",
);
check(
  control.includes('data-line-save="')
    && control.includes('closest("[data-line-save]")')
    && control.includes("syncLineSaveReviewUi"),
  "Goal 3 wires the composition Save for review button",
);
check(
  control.includes("Source corrected. The line is back to Pending. Save it for review again."),
  "Goal 3 Correct source toast uses the exact Pending wording",
);
check(
  !control.includes("The line has been returned to review."),
  "Goal 3 removes the misleading returned-to-review toast",
);
check(
  normalizeReviewNotesForDisplay("Working source corrected: A\\nWorking source corrected: B")
    === "Working source corrected: A\nWorking source corrected: B",
  "Goal 3 display normalize turns a single-backslash \\n into a line break",
);
check(
  normalizeReviewNotesForDisplay("Working source corrected: A\\\\nWorking source corrected: B")
    === "Working source corrected: A\nWorking source corrected: B",
  "Goal 3 display normalize turns a doubled \\\\n into a line break",
);
check(
  normalizeReviewNotesForDisplay("plain note") === "plain note",
  "Goal 3 display normalize leaves ordinary notes alone",
);
const helpersSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-helpers.js"), "utf8");
const lineDraftFn = helpersSrc.slice(
  helpersSrc.indexOf("export function lineDraftFromRow"),
  helpersSrc.indexOf("export function actionsDraftFromRows"),
);
check(
  control.includes("normalizeReviewNotesForDisplay(draft.reviewNotes")
    && !lineDraftFn.includes("normalizeReviewNotesForDisplay"),
  "Goal 3 normalizes notes only when showing, not when building the draft",
);
check(
  verifyReviewedEmptyGuidance(0).includes("Save for review"),
  "Goal 3 empty-line guidance mentions Save for review",
);

// --- Goal 4: empty option lists ---
check(
  classificationScopedOptionsUnloaded([], { productTypeSelected: true }) === true,
  "Goal 4 marks empty scoped options as unloaded when a type is selected",
);
check(
  classificationScopedOptionsUnloaded([], { productTypeSelected: false }) === false,
  "Goal 4 does not treat options as unloaded before a product type is chosen",
);
check(
  classificationScopedOptionsUnloaded(
    [{ portal_option_id: "9", label: "Capsule", fill_eligible: true }],
    { productTypeSelected: true },
  ) === false,
  "Goal 4 keeps loaded categories as available",
);
check(
  classificationVerifyPendingCopy(
    { productTypeOptionId: "119", productCategoryOptionId: null, subtypeMode: "UNRESOLVED" },
    { categoryOptions: [], subtypeOptions: [] },
  ) === CLASSIFICATION_OPTIONS_UNLOADED_COPY,
  "Goal 4 Approve hint uses the unloaded-options sentence",
);
check(
  canVerifyClassification(
    { productTypeOptionId: "119", productCategoryOptionId: null, subtypeMode: "UNRESOLVED" },
    { categoryOptions: [], subtypeOptions: [] },
  ) === false,
  "Goal 4 Approve stays off when scoped options are unloaded",
);
check(
  control.includes("CLASSIFICATION_OPTIONS_UNLOADED_COPY")
    && control.includes("classCategoryUnloadedNote")
    && control.includes("classSubtypeUnloadedNote"),
  "Goal 4 renders the unloaded-options note under Category and Sub Type",
);
check(
  control.includes('classificationOptionHtml(state.classificationOptions.PRODUCT_TYPE')
    && !control.includes("PRODUCT_TYPE, classDraft.productTypeOptionId, {"),
  "Goal 4 leaves the Product Type option list unchanged",
);

console.log(`UX-5 smoke checks: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`UX-5 smoke failed ${failed}`);
  process.exit(1);
}
console.log("UX-5 smoke passed");
