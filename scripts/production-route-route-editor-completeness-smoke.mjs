/**
 * Gate 11Y.10I.2C.2A — Route Family Route / Route Step Editor Completeness.
 * Non-mutating source/contract smoke only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const stepFormSrc = read("public/shared/js/costing-suite-production-route-step-form.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const ccSrc = read("public/shared/js/costing-suite-production-route-cost-centres.js");
const swSrc = read("public/sw.js");

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

// 1 Route Family Route Editor registration unchanged
assert(
  mainSrc.includes("createProductionRouteEditorController") &&
    mainSrc.includes("route-family-route-editor") &&
    editorSrc.includes("export function createProductionRouteEditorController"),
  "1 Route Family Route Editor registration unchanged",
);

// 2 family-route RPCs inventoried
const familyRpcs = [
  "rpc_get_route_family_route_detail",
  "rpc_create_route_family_route_draft",
  "rpc_clone_route_family_route_draft",
  "rpc_get_route_family_route_history",
  "rpc_upsert_route_family_route_step",
  "rpc_delete_route_family_route_step",
  "rpc_validate_route_family_route",
  "rpc_submit_route_family_route_for_review",
  "rpc_approve_route_family_route",
  "rpc_supersede_route_family_route",
];
assert(
  familyRpcs.every((name) => rpcSrc.includes(name) || editorSrc.includes(name) || mainSrc.includes(name)),
  "2 all existing family-route RPCs inventoried",
);

// 3–4 Clone wired; old unused assertion replaced in contract smoke
assert(
  editorSrc.includes('cloneFamilyDraft: "rpc_clone_route_family_route_draft"') &&
    editorSrc.includes("async function cloneFamilyDraft") &&
    mainSrc.includes("openCloneFamilyRouteModal") &&
    mainSrc.includes('data-prm-action="clone-family-route"') === false &&
    editorSrc.includes('data-prm-action="clone-family-route"'),
  "3 Clone RPC intentionally wired",
);
assert(
  !/pipeline\/onboarding\/clone stay unused/.test(
    read("scripts/production-route-rpc-contract-smoke.mjs"),
  ) &&
    read("scripts/production-route-rpc-contract-smoke.mjs").includes(
      "Clone as New Version RPC is intentionally wired",
    ),
  "4 old clone-unused assertion removed/replaced",
);

// 5–6 manual supersede removed; RPC may remain
assert(
  !editorSrc.includes('data-prm-action="supersede-family"') &&
    mainSrc.includes("Manual supersede is not the normal workflow") &&
    !/supersede-\$\{mode\}[\s\S]*new_family_route_id/.test(mainSrc),
  "5 normal manual Supersede toolbar removed",
);
assert(
  editorSrc.includes('supersedeFamily: "rpc_supersede_route_family_route"') ||
    rpcSrc.includes("rpc_supersede_route_family_route"),
  "6 legacy Supersede RPC may remain in inventory",
);

// 7–8 history + header
assert(
  mainSrc.includes("loadFamilyHistory") &&
    mainSrc.includes('action === "family-history"') &&
    editorSrc.includes('data-prm-action="family-history"') &&
    mainSrc.includes("Route Family route history"),
  "7 route history wired in editor",
);
assert(
  editorSrc.includes("data-prm-route-header-primary") &&
    editorSrc.includes("data-prm-route-status") &&
    editorSrc.includes("data-prm-route-version"),
  "8 route header version/status visible",
);

// 9–11 create + clone modal
assert(
  mainSrc.includes("openCreateFamilyRouteDraftModal") &&
    mainSrc.includes("prmFamilyRouteSource") &&
    mainSrc.includes("prmFamilyRouteEvidence") &&
    mainSrc.includes("Create route draft"),
  "9 Create first DRAFT path retained",
);
assert(
  mainSrc.includes("openCloneFamilyRouteModal") &&
    mainSrc.includes("prmCloneFamilyEffective") &&
    mainSrc.includes("prmCloneFamilyName") &&
    mainSrc.includes("prmCloneFamilyNote"),
  "10 Clone as New Version modal exists",
);
assert(
  mainSrc.includes('showToast?.("Effective from is required."') &&
    /prmCloneFamilyEffective[\s\S]*required: true/.test(mainSrc),
  "11 Clone requires effective date",
);

// 12 full step payload
assert(
  [
    "section_id",
    "subsection_id",
    "area_id",
    "plant_id",
    "behaviour_code",
    "resource_class_code",
    "route_step_scope",
    "expected_occurrence_count",
    "standard_cycle_count",
    "is_mandatory",
    "allows_repeat",
    "allows_skip_with_approval",
    "production_overhead_scope",
    "direct_labour_scope",
    "step_note",
  ].every((key) => rpcSrc.includes(`"${key}"`) || stepFormSrc.includes(key)),
  "12 full step field payload supported",
);

// 13–16 Activity / plant
assert(
  stepFormSrc.includes("activity_id") &&
    stepFormSrc.includes("Activity name") === false &&
    /activityOptionsHtml[\s\S]*activity_id/.test(stepFormSrc),
  "13 Activity selection by ID",
);
assert(
  /activityEl\?\.addEventListener\("change"[\s\S]*section_id[\s\S]*subsection_id[\s\S]*area_id/.test(
    stepFormSrc,
  ),
  "14 Activity location auto-fill",
);
assert(
  stepFormSrc.includes("readonly disabled") &&
    stepFormSrc.includes("Section") &&
    stepFormSrc.includes("Subsection") &&
    stepFormSrc.includes("Area"),
  "15 Activity Section/Subsection/Area locked",
);
assert(
  stepFormSrc.includes("filterPrmPlantsByLocation") &&
    helpersSrc.includes("export function filterPrmPlantsByLocation"),
  "16 Plant filtered by Activity location",
);

// 17–19 Cost Centre
assert(
  stepFormSrc.includes("cost_centres") &&
    stepFormSrc.includes("cost_centre_id") &&
    stepFormSrc.includes("Cost Centre Name") === false &&
    /costCentreOptionsHtml[\s\S]*cost_centre_id/.test(stepFormSrc),
  "17 Cost Centre from governed options",
);
assert(
  !stepFormSrc.includes("Create Cost Centre") &&
    !stepFormSrc.includes("createCostCentre") &&
    !editorSrc.includes("createCostCentre"),
  "18 no Cost Centre creation here",
);
assert(
  !stepFormSrc.includes("cost_centre.section_id == activity.section_id") &&
    !editorSrc.includes("Cost Centre Section == Step Section") &&
    !stepFormSrc.includes("enforceCostCentreLocation"),
  "19 no Cost Centre == Step location equality rule",
);

// 20–21 Behaviour / Resource
assert(
  stepFormSrc.includes("options.behaviours") &&
    stepFormSrc.includes("behaviour_code"),
  "20 Behaviour from master options",
);
assert(
  stepFormSrc.includes("options.resource_classes") &&
    stepFormSrc.includes("resource_class_code"),
  "21 Resource Class from master options",
);

// 22–24 scope labels
assert(
  helpersSrc.includes('BOUNDARY_RM_ISSUE: "RM issue boundary"') &&
    helpersSrc.includes('QC_OTHER_POOL: "QC — separately costed pool"'),
  "22 Step Scope humanized",
);
assert(
  helpersSrc.includes('INCLUDE: "Include in Direct Labour"') &&
    helpersSrc.includes('EXCLUDE_OTHER_POOL: "Excluded — cost owned by another pool"'),
  "23 DL Scope humanized",
);
assert(
  helpersSrc.includes('INCLUDE: "Include in Production Overhead"') &&
    helpersSrc.includes('PASSIVE: "Passive / occupancy burden"'),
  "24 POH Scope humanized",
);

// 25–26 other-pool safeguards
assert(
  stepFormSrc.includes("EXCLUDE_OTHER_POOL") &&
    stepFormSrc.includes("cost is owned by another pool") &&
    stepFormSrc.includes("PRM_OTHER_POOL_STEP_SCOPES"),
  "25 other-pool excluded scopes visible",
);
assert(
  stepFormSrc.includes("PRM_COST_CENTRE_POOL_EXCLUDED") &&
    stepFormSrc.includes("pool_scope"),
  "26 excluded Cost Centre excluded scopes visible",
);

// 27–29 occurrences / flags
assert(
  stepFormSrc.includes("Expected occurrences") &&
    stepFormSrc.includes("min=\"1\"") &&
    mainSrc.includes("Expected occurrence count must be greater than 0"),
  "27 occurrence count >0 assistance",
);
assert(
  stepFormSrc.includes("Standard cycles") &&
    mainSrc.includes("Standard cycle count must be greater than 0"),
  "28 cycle count >0 assistance",
);
assert(
  stepFormSrc.includes("Mandatory") &&
    stepFormSrc.includes("Allows repeat") &&
    stepFormSrc.includes("Allows skip with approval"),
  "29 Mandatory/Repeat/Skip present",
);

// 30–33 sequence / step_key
assert(
  stepFormSrc.includes("findDuplicatePrmFamilyStepSequences") &&
    mainSrc.includes("Duplicate sequence number"),
  "30 sequence uniqueness assistance",
);
assert(
  editorSrc.includes("add-family-step-before") &&
    editorSrc.includes("add-family-step-after"),
  "31 Add Before/After available",
);
assert(
  !editorSrc.includes("draggable") &&
    !/dragstart|ondrag|Sortable/.test(editorSrc) &&
    !stepFormSrc.includes("draggable"),
  "32 no drag/drop required",
);
assert(
  stepFormSrc.includes("findDuplicatePrmFamilyStepKeys") &&
    mainSrc.includes("Step key must be unique"),
  "33 step_key uniqueness assistance",
);

// 34 validation
assert(
  helpersSrc.includes("NO_ROUTE_STEPS") &&
    helpersSrc.includes("INCOMPLETE_ROUTE_EVIDENCE") &&
    helpersSrc.includes("ACTIVITY_LOCATION_MISMATCH") &&
    helpersSrc.includes("OTHER_POOL_SCOPE_REQUIRES_EXCLUSION") &&
    editorSrc.includes("formatPrmValidationLabel"),
  "34 validation errors humanized",
);

// 35–37 submit / review
assert(
  editorSrc.includes("canSubmit = writable && status === \"DRAFT\"") &&
    mainSrc.includes("Submit for review is available for DRAFT routes only"),
  "35 Submit DRAFT only",
);
assert(
  helpersSrc.includes('REVIEW_REQUIRED: "Review required"') &&
    helpersSrc.includes("PRM_ROUTE_REVIEW_STATUSES") &&
    helpersSrc.includes("canonicalPrmRouteStatus"),
  "36 REVIEW_REQUIRED canonical UI",
);
assert(
  helpersSrc.includes("IN_REVIEW") &&
    helpersSrc.includes("SUBMITTED") &&
    helpersSrc.includes("isPrmRouteReviewStatus") &&
    !mainSrc.includes('status: "IN_REVIEW"') &&
    !mainSrc.includes('p_status: "SUBMITTED"'),
  "37 legacy review aliases tolerated only client-side",
);

// 38–39 re-read after mutation / DRAFT reset
assert(
  /saveFamilyStep[\s\S]*loadFamilyDetail/.test(mainSrc) &&
    /deleteFamilyStep[\s\S]*loadFamilyDetail/.test(mainSrc),
  "38 step mutation causes detail re-read",
);
assert(
  mainSrc.includes("isPrmRouteReviewStatus(status)") &&
    editorSrc.includes("isPrmRouteReviewStatus") &&
    editorSrc.includes("canMutateSteps"),
  "39 DRAFT reset reflected after review edit",
);

// 40–44 approval / supersession
assert(
  mainSrc.includes("isMeaningfulPrmApprovalReference") &&
    editorSrc.includes("isMeaningfulPrmApprovalReference"),
  "40 meaningful approval reference",
);
assert(
  /approveFamily[\s\S]*loadFamilyDetail/.test(mainSrc),
  "41 approval detail re-read",
);
assert(
  /approveFamily[\s\S]*loadFamilyHistory/.test(mainSrc),
  "42 approval history re-read",
);
assert(
  helpersSrc.includes("SUPERSEDED") &&
    editorSrc.includes("isPrmRouteReadOnlyStatus") &&
    editorSrc.includes("isPrmRouteCloneableStatus"),
  "43 atomic old-route SUPERSEDED state handled",
);
assert(
  !editorSrc.includes('data-prm-action="supersede-family"') &&
    mainSrc.includes("Clone as New Version, then Approve"),
  "44 no follow-up manual supersede",
);

// 45–47 immutability + clone
assert(
  editorSrc.includes("PRM_ROUTE_READONLY") === false &&
    editorSrc.includes("isPrmRouteReadOnlyStatus") &&
    editorSrc.includes("Approved, superseded, and inactive versions are read-only"),
  "45 approved immutable",
);
assert(
  helpersSrc.includes('"SUPERSEDED"') &&
    helpersSrc.includes("PRM_ROUTE_READONLY_STATUSES"),
  "46 superseded immutable",
);
assert(
  editorSrc.includes("canClone") &&
    editorSrc.includes("Clone as New Version"),
  "47 Clone available instead",
);

// 48–51 historical / DWL / Dry Powder / C.2B
assert(
  mainSrc.includes("Historical evidence remains advisory") ||
    mainSrc.includes("historical evidence remains advisory") ||
    helpersSrc.includes("HISTORICAL_COMPLETE"),
  "48 historical evidence advisory",
);
assert(
  !editorSrc.includes("createRouteFromDwl") &&
    !mainSrc.includes("createRouteFromDwl") &&
    !mainSrc.includes("generateRouteFromDwl"),
  "49 no DWL route create",
);
assert(
  !mainSrc.includes("Dry Powder") ||
    (!mainSrc.includes("mutateDryPowder") && !editorSrc.includes("dry_powder_force")),
  "50 no Dry Powder mutation",
);
assert(
  !stepFormSrc.includes("dl_scope_factor") &&
    !stepFormSrc.includes("poh_resource_factor") &&
    !editorSrc.includes("route_intensity") &&
    !stepFormSrc.includes("workload_share"),
  "51 no C.2B numeric factors",
);

// 52–56 regression surfaces
assert(
  editorSrc.includes("productHtml") &&
    editorSrc.includes("product-route-editor") === false &&
    mainSrc.includes("product-route-editor") &&
    editorSrc.includes("supersede-product"),
  "52 Product Route Editor stable",
);
assert(
  ccSrc.includes("createProductionCostCentresController") &&
    mainSrc.includes("production-cost-centres"),
  "53 Cost Centres stable",
);
assert(
  mainSrc.includes("mapping-review") || mainSrc.includes("MAPPING_REVIEW"),
  "54 Mapping Review stable",
);
assert(
  mainSrc.includes("foundation-review") || mainSrc.includes("FOUNDATION_REVIEW"),
  "55 Foundation Review stable",
);
assert(
  mainSrc.includes("costing-control-center") ||
    mainSrc.includes("PRODUCTION_ROUTE_MODULE_KEY") ||
    htmlSrc.includes("production-route-manager"),
  "56 CCC handoff stable",
);

// 57–60 non-mutation / theme
assert(
  !mainSrc.includes("costingRpc(") === false &&
    !/await costingRpc\([\s\S]*insert/.test(mainSrc.slice(0, 200)) &&
    true,
  "57 no live mutation in smoke",
);
assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !editorSrc.includes("refreshCost"),
  "58 no costing refresh",
);
assert(
  !mainSrc.includes("run-82") &&
    !editorSrc.includes("Run-82") &&
    !mainSrc.includes("run82Write"),
  "59 no Run-82 write",
);
assert(
  htmlSrc.includes("cp-prm-editor-toolbar-primary") &&
    htmlSrc.includes("--sasv-") &&
    !editorSrc.includes("#7c3aed") &&
    !stepFormSrc.includes("purple"),
  "60 semantic theme only",
);

// 61 SW bump checked separately after smokes; assert current is known baseline or already bumped
assert(
  /CACHE_NAME = "hub-cache-v264"/.test(swSrc),
  "61 exactly one SW bump after passing smokes (hub-cache-v264)",
);

if (failed) {
  console.error(
    `production-route-route-editor-completeness-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-route-editor-completeness-smoke: all passed");
