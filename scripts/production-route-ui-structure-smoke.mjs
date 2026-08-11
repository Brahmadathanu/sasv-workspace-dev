/**
 * Production Route Manager UI structure smoke.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mainSrc = readFileSync(
  join(process.cwd(), "public/shared/js/costing-suite-production-route.js"),
  "utf8",
);
const editorSrc = readFileSync(
  join(process.cwd(), "public/shared/js/costing-suite-production-route-editor.js"),
  "utf8",
);
const stepFormSrc = readFileSync(
  join(process.cwd(), "public/shared/js/costing-suite-production-route-step-form.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(process.cwd(), "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const htmlSrc = readFileSync(
  join(process.cwd(), "public/shared/production-route-manager.html"),
  "utf8",
);

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  mainSrc.includes("data-prm-lens-root") &&
    mainSrc.includes("clearLensOwnedDom()") &&
    mainSrc.includes("ensureLensRoot("),
  "exactly one active PRM lens root ownership path",
);
assert(
  mainSrc.includes("beginLensTransition(active)") &&
    mainSrc.includes("activeLensRequestController.abort()") &&
    mainSrc.includes("if (token !== lensRenderGeneration || state.activeLens !== active)"),
  "stale route-detail completion cannot repaint inactive lens",
);
assert(
  mainSrc.includes('if (table) table.style.display = "none"') &&
    mainSrc.includes("host.tableWrap?.classList.remove(\"hidden\")"),
  "editor mounts in primary tableWrap scroll path",
);
assert(
  !htmlSrc.includes("#prmEditorHost:not(.hidden)") &&
    htmlSrc.includes("[data-prm-lens-root]"),
  "editor root is mounted path, not persistent special host",
);
assert(
  shellSrc.includes("hidePrmNonTableCount") &&
    shellSrc.includes('"route-family-route-editor"') &&
    shellSrc.includes('"product-route-editor"') &&
    shellSrc.includes('"historical-candidate-review"') &&
    shellSrc.includes('"effective-route-viewer"') &&
    shellSrc.includes("showPrmTableMeta") &&
    shellSrc.includes("!showPrmTableMeta && !showPager && !hasMetaActions"),
  "row counter hidden for Family editor and empty generic meta row suppressed",
);
assert(
  shellSrc.includes("tableWrap?.classList.add(\"tw-visible\")") &&
    shellSrc.includes("isProductionRouteLens(CURRENT_LENS)"),
  "tableWrap remains visible for non-table PRM lenses including cold deep links",
);
assert(
  editorSrc.includes("cp-prm-editor-toolbar") &&
    editorSrc.includes("cp-prm-editor-toolbar-left") &&
    editorSrc.includes("cp-prm-editor-toolbar-right") &&
    editorSrc.includes("data-prm-route-overview") &&
    editorSrc.includes("buildFamilyRouteOverviewHtml") &&
    editorSrc.includes("cp-prm-editor-cue") &&
    editorSrc.includes("summary.labels.rm") &&
    editorSrc.includes("summary.labels.valid") &&
    editorSrc.includes("summary.labels.steps"),
  "compact toolbar with route overview modal and attention cue",
);
assert(
  editorSrc.includes("canValidate") &&
    /canValidate \?[\s\S]*data-prm-action="validate-family"/.test(editorSrc) &&
    !editorSrc.includes('summary.valid ? "Route valid"') &&
    !editorSrc.includes('summary.step_count, "0")} steps'),
  "Validate is edit-gated; Route valid and step count stay out of toolbar",
);
assert(
  !editorSrc.includes(
    "Sequence changes use temporary values from ${PRM_SEQUENCE_TEMP_BASE} before final numbering.</p>",
  ) &&
    editorSrc.includes("add-family-step-before") &&
    editorSrc.includes("add-family-step-after") &&
    !editorSrc.includes("draggable") &&
    !/dragstart|ondrag|Sortable/.test(editorSrc),
  "Add before/after sequence UX; no drag/drop; no permanent sequence footer",
);
assert(
  editorSrc.includes("<th>Seq</th><th>Activity</th><th>Cost Centre</th><th>Location</th><th>Behaviour</th><th>Resource</th><th>DL</th><th>POH</th><th>Occ</th><th>Cycles</th>") &&
    editorSrc.includes("data-prm-step-row") &&
    editorSrc.includes("buildFamilyStepDetailHtml") &&
    editorSrc.includes("buildFamilyStepFormHtml") &&
    stepFormSrc.includes("data-prm-family-step-save") &&
    !editorSrc.includes("cp-prm-step-details ${expanded"),
  "row-click step modal; dense 10-column step table; full step form authoring",
);
assert(
  editorSrc.includes("clearFamilyStepExpansion") &&
    mainSrc.includes("editor.clearFamilyStepExpansion?.()") &&
    mainSrc.includes("openFamilyStepModal") &&
    mainSrc.includes("openFamilyRouteOverviewModal") &&
    mainSrc.includes("data-prm-route-overview"),
  "overview and step modals wired; expansion cleared on lens transition",
);
assert(
  editorSrc.includes("canMutateSteps") &&
    editorSrc.includes("canSubmit") &&
    editorSrc.includes("canReviewApprove") &&
    editorSrc.includes("canClone") &&
    /canSubmit \?[\s\S]*submit-family/.test(editorSrc) &&
    /canReviewApprove \?[\s\S]*approve-family/.test(editorSrc) &&
    /canClone \?[\s\S]*clone-family-route/.test(editorSrc) &&
    !editorSrc.includes('data-prm-action="supersede-family"'),
  "Draft submit; review approve; clone for immutable; no manual supersede toolbar",
);
assert(
  !editorSrc.includes("stage 03") &&
    !editorSrc.includes("Stage 03") &&
    !editorSrc.includes("refreshCost") &&
    !mainSrc.includes("runStagedCostingRefresh") &&
    !mainSrc.match(/invoke\([^)]*stage[\s_]*03/i),
  "no Stage 03 invoke or refresh calls in PRM paths; approve impact copy may mention Stage 03 as excluded",
);
assert(
  mainSrc.includes("selectPrmReadinessColumns") &&
    mainSrc.includes("getPrmReadinessCellValue") &&
    mainSrc.includes("formatPrmRouteValidationSummary") &&
    mainSrc.includes("formatPrmExactRunContextCue") &&
    mainSrc.includes("syncPrmAsOfDateChrome") &&
    mainSrc.includes("cp-prm-badge-danger") &&
    mainSrc.includes("SERVER CONTRACT REQUIRED") &&
    mainSrc.includes("action.mutation !== true") &&
    mainSrc.includes("data-prm-effective-host") &&
    mainSrc.includes(
      "Advisory historical evidence — no assignment or route is created automatically.",
    ) &&
    mainSrc.includes("Product Route Family Assignment") &&
    mainSrc.includes("data-prm-assignment-host") &&
    mainSrc.includes("data-prm-use-candidate-in-draft") &&
    mainSrc.includes("openCreateAssignmentDraftModal") &&
    mainSrc.includes("renderAssignments") &&
    mainSrc.includes("ASSIGNMENT_REGISTER") &&
    mainSrc.includes("data-prm-assignment-register") &&
    !mainSrc.includes(
      "exactRunContextHtml();\n    host.summary.innerHTML = assignmentRegister",
    ) &&
    mainSrc.includes("PRM_EXACT_RUN_CONTEXT"),
  "Gate 11Y.4C.2 Product Assignments lens + product detail handoff",
);
assert(
  mainSrc.includes("shared-workload-preview") &&
    mainSrc.includes("renderWorkloadPreview") &&
    mainSrc.includes("WORKLOAD_PREVIEW") &&
    mainSrc.includes("data-prm-workload-host") &&
    mainSrc.includes("Raw batch requirement") &&
    mainSrc.includes("Rounded standard batches") &&
    mainSrc.includes("data-prm-workload-row") &&
    mainSrc.includes("cp-prm-workload-compact") &&
    mainSrc.includes("formatPrmWorkloadBatchBasisHtml") &&
    mainSrc.includes("cp-prm-workload-product-id") &&
    !mainSrc.includes("Preferred:\\nRaw:") &&
    !mainSrc.includes("escapeHtmlMultiline(formatPrmWorkloadBatchBasis") &&
    mainSrc.includes("workloadGeneration") &&
    mainSrc.includes("workloadDetailGeneration") &&
    mainSrc.includes("selectPrmSecondaryWorkloadFilterStatuses") &&
    mainSrc.includes('"Batch basis"') &&
    !mainSrc.includes('"Product Group",\n      "Monthly quantity"') &&
    !mainSrc.includes('"Route source"') &&
    !mainSrc.includes('"Effective steps"') &&
    mainSrc.includes("Product context") &&
    mainSrc.includes("route_source") &&
    mainSrc.includes("effective_step_count") &&
    !mainSrc.includes("rpc_preview_shared_standard_batch_route_foundation") &&
    !mainSrc.includes("Monetary allocation created</div><div>Yes") &&
    htmlSrc.includes('data-peq-section="prm-workload"') &&
    htmlSrc.includes("prmWorkloadFoundationChecklist") &&
    htmlSrc.includes("prmWorkloadDlScopeFilter") &&
    htmlSrc.includes("data-prm-workload-table") &&
    htmlSrc.includes("cp-prm-workload-batch"),
  "Gate 11Y.4D.1B compact one-line Workload rows + modal precision retained",
);
assert(
  htmlSrc.includes("cp-prm-badge-danger") &&
    htmlSrc.includes("cp-prm-server-contract") &&
    htmlSrc.includes("cp-prm-asof-disabled") &&
    htmlSrc.includes('data-peq-section="prm-assignments"') &&
    htmlSrc.includes("prmAssignmentMoreStatuses"),
  "readiness chip danger + SERVER CONTRACT REQUIRED + as-of disabled + assignments PEQ present",
);
assert(
  mainSrc.includes("data-prm-exact-run") &&
    mainSrc.includes("formatPrmExactRunContextCue"),
  "exact-run cue rendered from controller summary",
);
assert(
  mainSrc.includes("data-prm-back-families") &&
    mainSrc.includes("Back to Manufacturing Route Families") &&
    mainSrc.includes('navigate("route-families"'),
  "Back to Manufacturing Route Families uses existing navigate mechanism",
);
assert(
  mainSrc.includes("Shared-route centres") &&
    mainSrc.includes("Excluded boundary centres") &&
    mainSrc.includes("cp-prm-cc-table") &&
    mainSrc.includes("openCostCentreSetupModal"),
  "cost-centre modal uses compact grouped table structure",
);
assert(
  !editorSrc.includes("Raw Material Store › Dispensation › -") &&
    mainSrc.includes("closeCostCentreSetupModal") &&
    mainSrc.includes("handleEscapeKey"),
  "hierarchy placeholders absent and cost-centre modal dismiss contracts retained",
);
assert(
  htmlSrc.includes(".cp-prm-editor-toolbar") &&
    htmlSrc.includes(".cp-prm-title-action") &&
    htmlSrc.includes(".cp-prm-editor-cue") &&
    htmlSrc.includes("tr[data-prm-step-row]:focus-visible") &&
    htmlSrc.includes(".cp-prm-text-action:focus-visible"),
  "compact editor CSS present with focus-visible support",
);

if (failed) {
  console.error(`production-route-ui-structure-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-ui-structure-smoke: all passed");
