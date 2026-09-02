/**
 * e-Aushadhi Review & Control — helper smoke.
 */
import {
  PROVENANCE,
  QUEUE_FILTERS,
  actionsDirty,
  canPromoteFormulation,
  canVerifyProductWorkflow,
  classifyRpcError,
  detailsDraftFromReview,
  detailsDirty,
  ERROR_KIND,
  effectiveOptionId,
  filterQueueRows,
  formatIssueDetails,
  formatVerifiedTotal,
  issuesForLine,
  lineDirty,
  lineDraftFromRow,
  lineHasBlockerOrError,
  lineSelectionsComplete,
  matchesQueueFilter,
  mergePreservedLineDraft,
  openErrorOrBlockerCount,
  provenanceLabel,
  queueKpis,
  resolveFieldProvenance,
  suggestionFieldMode,
} from "../public/shared/js/eaushadhi-review-helpers.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const dummyBasis = {
  basis: "latest_resolution_plus_historical_portal_mapping",
  ingredient_type: { mode: "DUMMY_REVIEW_DEFAULT", rule: "DEFAULT_ACTIVE_INGREDIENTS_WHEN_UNRESOLVED" },
  ingredient_form: { mode: "DUMMY_REVIEW_DEFAULT" },
  part_used: { mode: "DUMMY_REVIEW_DEFAULT" },
};

const exactBasis = {
  basis: "latest_resolution_plus_historical_portal_mapping",
  ingredient_type: { mode: "HISTORICAL_PORTAL_MAPPING" },
  measurement_unit: { mode: "SOURCE_UNIT_MATCH" },
};

assert(QUEUE_FILTERS.some((item) => item.id === "ayurveda"), "Ayurveda filter exists");
assert(QUEUE_FILTERS.some((item) => item.id === "classical"), "Classical filter exists");

assert(
  resolveFieldProvenance({
    reviewStatus: "VERIFIED",
    selectedId: 1,
    suggestedId: 2,
    suggestionBasis: dummyBasis,
    fieldKey: "ingredient_type",
  }) === PROVENANCE.VERIFIED,
  "verified wins over dummy/manual",
);

assert(
  resolveFieldProvenance({
    reviewStatus: "PENDING",
    selectedId: 9,
    suggestedId: 2,
    suggestionBasis: dummyBasis,
    fieldKey: "ingredient_type",
  }) === PROVENANCE.MANUALLY_CHANGED,
  "selected != suggested is manually changed",
);

assert(
  resolveFieldProvenance({
    reviewStatus: "PENDING",
    selectedId: 2,
    suggestedId: 2,
    suggestionBasis: dummyBasis,
    fieldKey: "ingredient_type",
  }) === PROVENANCE.DEFAULT_SUGGESTION,
  "DUMMY_REVIEW_DEFAULT uses suggestion_basis not labels",
);

assert(
  resolveFieldProvenance({
    reviewStatus: "IN_REVIEW",
    selectedId: 4,
    suggestedId: 4,
    suggestionBasis: exactBasis,
    fieldKey: "ingredient_type",
  }) === PROVENANCE.EXACT_SUGGESTION,
  "non-dummy mode is exact suggestion",
);

assert(
  resolveFieldProvenance({
    reviewStatus: "PENDING",
    selectedId: null,
    suggestedId: null,
    suggestionBasis: dummyBasis,
    fieldKey: "measurement_unit",
  }) === PROVENANCE.NO_SUGGESTION,
  "missing suggested id is no suggestion",
);

assert(
  suggestionFieldMode(JSON.stringify(dummyBasis), "ingredient_form") ===
    "DUMMY_REVIEW_DEFAULT",
  "suggestion_basis JSON string is parsed",
);

assert(provenanceLabel(PROVENANCE.DEFAULT_SUGGESTION) === "Default suggestion", "provenance label");

const queue = [
  {
    product_id: 1,
    product_name: "Dasamularishtam",
    system_label: "Ayurveda",
    medicine_class_label: "Classical",
    review_status: "PENDING",
    open_blockers: 2,
    is_ready_for_entry: false,
  },
  {
    product_id: 2,
    product_name: "Amukkara Chooranam",
    system_label: "Siddha",
    medicine_class_label: "Proprietary",
    review_status: "IN_REVIEW",
    open_blockers: 0,
    is_ready_for_entry: false,
  },
  {
    product_id: 3,
    product_name: "Ready Oil",
    system_label: "Ayurveda",
    medicine_class_label: "Proprietary",
    review_status: "VERIFIED",
    open_blockers: 0,
    is_ready_for_entry: true,
  },
];

assert(matchesQueueFilter(queue[0], "ayurveda"), "Ayurveda filter matches system_label");
assert(matchesQueueFilter(queue[1], "siddha"), "Siddha filter matches system_label");
assert(matchesQueueFilter(queue[0], "classical"), "Classical filter matches medicine class");
assert(matchesQueueFilter(queue[1], "proprietary"), "Proprietary filter matches medicine class");
assert(matchesQueueFilter(queue[0], "blocked"), "Blocked filter uses open_blockers");
assert(matchesQueueFilter(queue[2], "ready"), "Ready filter uses is_ready_for_entry");
assert(filterQueueRows(queue, { search: "amukkara" }).length === 1, "search by product name");
assert(queueKpis(queue).ready === 1, "KPI ready count");
assert(formatVerifiedTotal(4, 12) === "4 / 12", "verified/total format");

const issues = [
  { source_composition_line_id: 10, severity: "BLOCKER", status: "OPEN" },
  { source_composition_line_id: 10, severity: "WARNING", status: "OPEN" },
  { source_composition_line_id: 11, severity: "ERROR", status: "OPEN" },
];
assert(issuesForLine(issues, 10).length === 2, "line-linked issues");
assert(lineHasBlockerOrError(issues, 10) === true, "blocker flags composition row");
assert(openErrorOrBlockerCount(issues) === 2, "error/blocker count ignores warnings");
assert(
  formatIssueDetails({ raw_unit_text: "µL", message: "portal option missing" }).includes("µL"),
  "issue details expose useful keys",
);

assert(effectiveOptionId(null, 88) === "88", "effective option prefers selected then suggested");
assert(
  lineSelectionsComplete({
    ingredientTypeOptionId: 1,
    ingredientFormOptionId: 2,
    partUsedOptionId: 3,
    measurementOptionId: 4,
  }),
  "complete line selections",
);

const review = {
  selected_permission_purpose_term_id: null,
  suggested_permission_purpose_term_id: 5,
  selected_composition_title: "Title",
  selected_diseases_conditions_text: "Fever",
  selected_contains_bhang: false,
  review_notes: "",
  row_version: 3,
};
const draft = detailsDraftFromReview(review);
assert(draft.permissionPurposeTermId === "5", "details draft uses suggested purpose when selected empty");
assert(detailsDirty({ ...draft, compositionTitle: "X" }, draft) === true, "details dirty detect");

const lineRow = {
  source_composition_line_id: 10,
  selected_ingredient_type_option_id: null,
  suggested_ingredient_type_option_id: 2,
  selected_ingredient_form_option_id: 3,
  suggested_ingredient_form_option_id: 3,
  selected_part_used_option_id: 4,
  suggested_part_used_option_id: 4,
  selected_measurement_option_id: 5,
  suggested_measurement_option_id: 5,
  review_notes: "",
  row_version: 1,
};
const lineDraft = lineDraftFromRow(lineRow);
assert(lineDraft.ingredientTypeOptionId === "2", "line draft prefills suggested");
assert(lineDirty({ ...lineDraft, reviewNotes: "check" }, lineDraft), "line dirty notes");
assert(actionsDirty(["A", "B"], ["A", "B"]) === false, "actions not dirty");
assert(actionsDirty(["B", "A"], ["A", "B"]) === true, "action order is dirty");

const merged = mergePreservedLineDraft(
  { ...lineRow, row_version: 8 },
  { ...lineDraft, ingredientTypeOptionId: "99", rowVersion: 1 },
);
assert(merged.preserved === true, "stale merge preserves local draft");
assert(merged.draft.rowVersion === 8, "stale merge takes server row version");
assert(merged.draft.ingredientTypeOptionId === "99", "stale merge keeps local selection");

assert(
  canPromoteFormulation({
    canEdit: true,
    productReviewStatus: "VERIFIED",
    compositionReviewComplete: true,
    verifiedLines: 4,
    compositionLines: 4,
    openBlockers: 0,
    errorOrBlockerIssueCount: 0,
    approvedFormulationPresent: false,
    workflowRowVersion: 6,
  }) === true,
  "promote gate true when prerequisites hold",
);
assert(
  canPromoteFormulation({
    canEdit: true,
    productReviewStatus: "VERIFIED",
    compositionReviewComplete: true,
    openBlockers: 0,
    errorOrBlockerIssueCount: 1,
    approvedFormulationPresent: false,
    workflowRowVersion: 6,
  }) === false,
  "promote gate false when live ERROR/BLOCKER issues exist",
);
assert(
  canVerifyProductWorkflow({
    canEdit: true,
    compositionReviewComplete: true,
    openBlockers: 1,
    workflowRowVersion: 1,
  }) === false,
  "product verify gated by blockers",
);

assert(classifyRpcError({ code: "42501", message: "Nope" }).kind === ERROR_KIND.AUTHORIZATION, "auth error class");
assert(classifyRpcError({ code: "40001", message: "Review row changed" }).kind === ERROR_KIND.STALE, "stale error class");
assert(
  classifyRpcError({ message: "Open ERROR/BLOCKER reconciliation issue prevents formulation promotion" }).kind ===
    ERROR_KIND.BLOCKER,
  "blocker error class",
);
assert(
  classifyRpcError({ message: "All four portal dropdown selections are required before line verification" }).kind ===
    ERROR_KIND.VALIDATION,
  "validation error class",
);
assert(classifyRpcError({ message: "Failed to fetch" }).kind === ERROR_KIND.NETWORK, "network error class");

if (failed) {
  console.error(`\n${failed} helper smoke assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-review-helpers-smoke: all assertions passed");
