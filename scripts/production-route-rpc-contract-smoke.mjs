/**
 * Production Route Manager — Family architecture source/HTML contract smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OBSOLETE_PRM_LENS_IDS,
  OBSOLETE_PRM_RPC_NAMES,
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_RPC_NAMES,
  resolveProductionRouteLens,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const candidatesSrc = read("public/shared/js/costing-suite-production-route-candidates.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const builderSrc = read("scripts/build-production-route-manager-html.mjs");
const typesSrc = read("public/shared/js/types/supabase.ts");

assert(PRODUCTION_ROUTE_RPC_NAMES.length === 62, "exactly 62 live RPCs");
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_production_route_manager_exact_run_readiness",
  ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_get_production_route_manager_readiness",
    ),
  "exact-run Costing readiness and general readiness both live",
);
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_production_route_manager_workload_preview",
  ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_get_production_route_manager_workload_detail",
    ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_get_route_workload_management_explain",
    ),
  "workload preview, detail, and management explain RPCs live",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.length === 11 &&
    PRODUCTION_ROUTE_LENS_IDS.includes("product-route-assignments") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("shared-workload-preview") &&
    PRODUCTION_ROUTE_LENS_IDS.indexOf("shared-workload-preview") ===
      PRODUCTION_ROUTE_LENS_IDS.indexOf("product-route-assignments") + 1 &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-families") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-mapping-review") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-foundation-review") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("production-cost-centres") &&
    PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-foundation-review") ===
      PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-mapping-review") + 1 &&
    PRODUCTION_ROUTE_LENS_IDS.indexOf("production-cost-centres") ===
      PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-foundation-review") + 1 &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-route-editor"),
  "eleven Family architecture lenses with Cost Centres after Foundation Review",
);
assert(
  OBSOLETE_PRM_RPC_NAMES.every((name) => !PRODUCTION_ROUTE_RPC_NAMES.includes(name)),
  "obsolete RPC names never coexist in live inventory",
);

for (const name of PRODUCTION_ROUTE_RPC_NAMES) {
  // Types regen is optional for some live RPCs added before supabase.ts catch-up.
  if (
    name === "rpc_get_production_route_manager_exact_run_readiness" ||
    name === "rpc_get_production_route_manager_product_assignments" ||
    name === "rpc_cancel_product_route_family_assignment" ||
    name === "rpc_get_production_route_manager_workload_preview" ||
    name === "rpc_get_production_route_manager_workload_detail" ||
    name === "rpc_get_route_workload_management_explain" ||
    name === "rpc_get_route_family_mapping_review_candidates" ||
    name === "rpc_get_route_family_foundation_review" ||
    name === "rpc_get_production_cost_centres" ||
    name === "rpc_get_production_cost_centre_detail" ||
    name === "rpc_create_production_cost_centre_draft" ||
    name === "rpc_update_production_cost_centre_draft" ||
    name === "rpc_validate_production_cost_centre" ||
    name === "rpc_approve_production_cost_centre" ||
    name === "rpc_inactivate_production_cost_centre"
  ) {
    continue;
  }
  assert(typesSrc.includes(`${name}: {`), `Supabase types include ${name}`);
}
for (const obsolete of OBSOLETE_PRM_RPC_NAMES) {
  assert(
    !typesSrc.includes(`${obsolete}: {`),
    `Supabase types exclude obsolete ${obsolete}`,
  );
}

const prmModules = [helpersSrc, rpcSrc, mainSrc, editorSrc, candidatesSrc];
for (const [index, source] of prmModules.entries()) {
  assert(
    !/\.from\s*\(/.test(source) && !source.includes("costingFrom("),
    `PRM module ${index + 1} has no direct table access`,
  );
}

for (const source of prmModules) {
  assert(!source.includes("GROUP_ROUTE"), "GROUP_ROUTE terminology absent");
  assert(
    !source.includes("base_group_route_id"),
    "base_group_route_id terminology absent",
  );
}

for (const obsoleteLens of OBSOLETE_PRM_LENS_IDS) {
  assert(
    resolveProductionRouteLens(obsoleteLens) === "route-readiness",
    `obsolete lens resolves to readiness: ${obsoleteLens}`,
  );
  assert(
    helpersSrc.includes(`"${obsoleteLens}"`) &&
      mainSrc.includes(`lens === "${obsoleteLens}"`) &&
      !rpcSrc.includes(obsoleteLens) &&
      !editorSrc.includes(obsoleteLens) &&
      !candidatesSrc.includes(obsoleteLens),
    `obsolete lens appears only in reject/fallback handling: ${obsoleteLens}`,
  );
}
assert(
  resolveProductionRouteLens("route-family-route-editor") === "route-readiness" &&
    resolveProductionRouteLens("product-route-editor") === "route-readiness",
  "malformed editor deep-links without id still fall back",
);
assert(
  resolveProductionRouteLens("route-family-route-editor", {
    allowEditorWithoutId: true,
  }) === "route-family-route-editor",
  "intentional no-context family editor entry stays on editor lens",
);
assert(
  resolveProductionRouteLens("product-route-editor", {
    allowEditorWithoutId: true,
  }) === "product-route-editor",
  "intentional no-context product editor entry stays on editor lens",
);
assert(
  resolveProductionRouteLens(undefined) === "route-readiness",
  "fresh launch resolves to readiness",
);

const deadPrefixes = [
  "manualProvision",
  "expenseMapping",
  "costSheet",
  "sellingPolicy",
  "schemePolicy",
  "schemeRule",
  "manualRate",
  "materialReview",
  "staffGovernance",
  "staffClassification",
];
for (const prefix of deadPrefixes) {
  assert(
    !htmlSrc.includes(prefix) && !builderSrc.includes(prefix),
    `dead HTML prefix absent: ${prefix}`,
  );
}

const requiredIds = [
  "globalSearchCard",
  "lensSelect",
  "lensPills",
  "prmAsOfDate",
  "prmProductGroupFilter",
  "prmRouteFamilyFilter",
  "workbenchSummary",
  "prmSetupBanner",
  "prmEditorHost",
  "prmCandidateHost",
  "prmEffectiveHost",
  "costingLoadingMask",
  "detailsModal",
  "peqToastContainer",
];
for (const id of requiredIds) {
  assert(htmlSrc.includes(`id="${id}"`), `HTML retains ${id}`);
}
assert(
  htmlSrc.includes('placeholder="Search Product or Product Group"') &&
    !htmlSrc.includes('placeholder="Search Product or Product Group."'),
  "search placeholder is exact",
);
assert(
  htmlSrc.includes("Manufacturing Route Families") &&
    builderSrc.includes("Manufacturing Route Families"),
  "Manufacturing Route Families subtitle is retained",
);
assert(
  (htmlSrc.match(/id="detailsModal"/g) || []).length === 1 &&
    !/class="(?:cost-sheet-modal|cost-sheet-sign-modal)/.test(htmlSrc),
  "one reusable details modal remains",
);
assert(
  builderSrc.includes('["source parity", generated === html]') &&
    builderSrc.includes("requiredIds") &&
    builderSrc.includes("single reusable details modal"),
  "builder enforces generated-source parity and retained hosts",
);

assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !mainSrc.includes("costing_refresh_run"),
  "Reload cannot start Costing refresh work",
);
assert(
  mainSrc.includes("prmSetupBanner") &&
    (mainSrc.includes("PRM_COST_CENTRE_SETUP_CHIP") ||
      mainSrc.includes("summary.chip")) &&
    helpersSrc.includes('"Cost centres: Setup required"') &&
    helpersSrc.includes("Cost centres:") &&
    helpersSrc.includes("approved"),
  "compact setup chip uses the retained host and exact text",
);
assert(
  editorSrc.includes("cp-prm-editor-toolbar") &&
    editorSrc.includes("data-prm-route-overview") &&
    editorSrc.includes("data-prm-step-row") &&
    editorSrc.includes("buildFamilyStepDetailHtml") &&
    editorSrc.includes("canValidate") &&
    !editorSrc.includes('summary.valid ? "Route valid"'),
  "compact header with route overview and row-click step details",
);
assert(
  helpersSrc.includes("root.rm_boundary_count") &&
    helpersSrc.includes("scope === \"BOUNDARY_RM_ISSUE\"") &&
    helpersSrc.includes("scope === \"PRODUCTION_PROCESS\"") === false,
  "canonical validation count precedence is enforced",
);
assert(
  editorSrc.includes("sortPrmFamilyRouteSteps") &&
    editorSrc.includes(
      "<th>Seq</th><th>Activity</th><th>Cost Centre</th><th>Location</th><th>Behaviour</th><th>Resource</th><th>DL</th><th>POH</th><th>Occ</th><th>Cycles</th>",
    ),
  "dense sorted family step table columns",
);

assert(
  typesSrc.includes("rpc_approve_route_family_mapping") &&
    typesSrc.includes("p_mapping_id: number") &&
    !typesSrc.match(
      /rpc_approve_route_family_mapping:[\s\S]*?p_route_family_mapping_id/,
    ),
  "types use p_mapping_id for mapping approval",
);
assert(
  rpcSrc.includes('"p_mapping_id"') &&
    !rpcSrc.includes('"p_route_family_mapping_id"') &&
    mainSrc.includes("mapping_id:") &&
    !mainSrc.includes("route_family_mapping_id:"),
  "adapter/controller emit p_mapping_id only",
);
assert(
  typesSrc.includes("rpc_update_product_route_draft") &&
    /rpc_update_product_route_draft:\s*\{\s*Args:\s*\{[^}]*p_patch:\s*Json/.test(
      typesSrc,
    ) &&
    !/rpc_update_product_route_draft:\s*\{\s*Args:\s*\{[^}]*p_notes/.test(
      typesSrc,
    ),
  "types use p_patch for Product draft update",
);
assert(
  rpcSrc.includes('"p_patch"') &&
    /rpc_update_product_route_draft: Object\.freeze\(\[\s*"p_product_route_id",\s*"p_patch",\s*\]\)/.test(
      rpcSrc,
    ),
  "adapter accepts only p_product_route_id and p_patch",
);
assert(
  mainSrc.includes("buildPrmProductGroupMappingOptions") &&
    mainSrc.includes("prmMapProductGroupSelect") &&
    !mainSrc.includes('prompt("Product Group ID to map:'),
  "mapping selector uses hierarchy options instead of raw ID prompt",
);

assert(
  mainSrc.includes("data-prm-create-route-family") &&
    mainSrc.includes("data-prm-review-pre-mapping") &&
    mainSrc.includes("data-prm-empty-review-evidence") &&
    mainSrc.includes("openCreateFamilyModal"),
  "empty Family lens has visible create and evidence actions",
);
assert(
  mainSrc.includes("openCreateFamilyModal") &&
    mainSrc.includes("prmFamilyCode") &&
    mainSrc.includes("prmFamilyName"),
  "Family creation modal is reachable",
);
assert(
  mainSrc.includes("openApproveFamilyModal") &&
    mainSrc.includes("prmApproveFamilyRef"),
  "Family approval modal is reachable",
);
assert(
  mainSrc.includes("prmMapBasis") &&
    mainSrc.includes("buildPrmMappingBasisOptionsHtml") &&
    mainSrc.includes("readPrmMapProductGroupFormValues") &&
    mainSrc.includes("prmMapNote") &&
    mainSrc.includes("prmMapEffectiveFrom") &&
    !mainSrc.includes('placeholder: "Reviewed manufacturing similarity"'),
  "mapping modal uses hierarchy selector with canonical basis select",
);
assert(
  mainSrc.includes("openEditPendingMappingModal") &&
    mainSrc.includes("rpc_update_route_family_mapping_draft") &&
    mainSrc.includes("data-prm-edit-mapping-id"),
  "Edit pending mapping modal uses update draft RPC",
);
assert(
  typesSrc.includes("rpc_update_route_family_mapping_draft") &&
    /rpc_update_route_family_mapping_draft:\s*\{\s*Args:\s*\{[^}]*p_mapping_id:\s*number/.test(
      typesSrc,
    ) &&
    /rpc_update_route_family_mapping_draft:\s*\{\s*Args:\s*\{[^}]*p_patch:\s*Json/.test(
      typesSrc,
    ),
  "types include update mapping draft with p_mapping_id and p_patch",
);
assert(
  rpcSrc.includes("buildUpdateRouteFamilyMappingDraftArgs") &&
    rpcSrc.includes('"p_patch"') &&
    /rpc_update_route_family_mapping_draft: Object\.freeze\(\[\s*"p_mapping_id",\s*"p_patch",\s*\]\)/.test(
      rpcSrc,
    ),
  "adapter accepts only p_mapping_id and p_patch for mapping update",
);
assert(
  mainSrc.includes("PRM_APPROVAL_REFERENCE_HELPER_TEXT") &&
    mainSrc.includes("buildPrmFamilyApprovalReferenceTemplate") &&
    mainSrc.includes("buildPrmMappingApprovalReferenceTemplate"),
  "approval-reference templates are generated in Family/mapping modals",
);
assert(
  mainSrc.includes("handleEscapeKey") &&
    mainSrc.includes("attachPrmEscapeCapture") &&
    mainSrc.includes("openCostCentreSetupModal") &&
    mainSrc.includes("data-prm-cost-centre-modal") &&
    !mainSrc.includes("function openSetupModal"),
  "Escape handler and compact cost-centre modal are present",
);
assert(
  mainSrc.includes("withMutation") &&
    mainSrc.includes("mutationInFlight") &&
    mainSrc.includes("refreshRouteFamiliesAfterMutation") &&
    mainSrc.includes(
      "Route Family created, but the register could not be refreshed.",
    ),
  "duplicate submits blocked and post-create register refresh is contextual",
);
assert(
  mainSrc.includes("openApproveMappingModal") &&
    mainSrc.includes("data-prm-approve-mapping-id") &&
    mainSrc.includes("p_mapping_id") === false &&
    mainSrc.includes("mapping_id:"),
  "pending mapping shows Approve mapping and submits mapping_id",
);
assert(
  mainSrc.includes("openCreateFamilyRouteDraftModal") &&
    mainSrc.includes("prmFamilyRouteName") &&
    mainSrc.includes(
      "Available even when Production cost centres are not yet approved",
    ),
  "Route Family route-header draft remains available without cost centres",
);
assert(
  mainSrc.includes("assign-route-family") &&
    mainSrc.includes("preselectProductGroupId"),
  "readiness Assign to Route Family preselects Product Group by ID",
);
assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !mainSrc.includes("costing_refresh_run"),
  "no full Costing refresh is triggered by Family governance",
);

// Gate 5.11BU.11Y.4B Phase B — deny-list + readiness wiring
const denyPatterns = [
  "stage 03",
  "refreshCost",
  "request_costing_refresh",
  "rpc_request_costing_refresh",
  "runStagedCostingRefresh",
  "approve_direct_labour",
  "approve_production_overhead",
  "rpc_approve_direct_labour",
  "rpc_approve_production_overhead_policy",
];
for (const source of prmModules) {
  for (const pattern of denyPatterns) {
    assert(
      !source.includes(pattern),
      `deny-list: PRM module excludes ${pattern}`,
    );
  }
}
assert(
  !mainSrc.match(/invoke\([^)]*stage[\s_]*03/i) &&
    !mainSrc.includes("runStagedCostingRefresh"),
  "Stage 03 is not invoked; impact copy may mention it as excluded",
);

assert(
  mainSrc.includes("productAssignments:") &&
    mainSrc.includes(
      '"rpc_get_production_route_manager_product_assignments"',
    ) &&
    mainSrc.includes('cancelAssignment: "rpc_cancel_product_route_family_assignment"') &&
    mainSrc.includes("submitAssignment:") &&
    mainSrc.includes(
      '"rpc_submit_product_route_family_assignment_for_review"',
    ) &&
    mainSrc.includes('approveAssignment: "rpc_approve_product_route_family_assignment"') &&
    mainSrc.includes(
      'inactivateAssignment: "rpc_inactivate_product_route_family_assignment"',
    ) &&
    mainSrc.includes("correctAssignmentEffectiveFrom:") &&
    mainSrc.includes(
      '"rpc_correct_product_route_family_assignment_effective_from"',
    ) &&
    mainSrc.includes(
      'createAssignmentDraft: "rpc_create_product_route_family_assignment_draft"',
    ) &&
    mainSrc.includes(
      'productCandidate: "rpc_preview_product_process_route_candidate"',
    ),
  "controller RPC map includes assignment lifecycle and product-candidate",
);
assert(
  !mainSrc.includes("rpc_get_production_route_pipeline_status") &&
    !mainSrc.includes("rpc_get_route_family_onboarding_status"),
  "pipeline/onboarding stay unused in controller UI",
);
assert(
  editorSrc.includes("rpc_clone_route_family_route_draft") &&
    mainSrc.includes("openCloneFamilyRouteModal") &&
    mainSrc.includes("clone-family-route") &&
    editorSrc.includes('cloneFamilyDraft: "rpc_clone_route_family_route_draft"'),
  "Clone as New Version RPC is intentionally wired in family route editor UX",
);
assert(
  mainSrc.includes("selectPrmReadinessColumns") &&
    mainSrc.includes("getPrmReadinessCellValue") &&
    mainSrc.includes("getPrmReadinessTone") &&
    mainSrc.includes("PRM_EXACT_RUN_CONTEXT") &&
    mainSrc.includes("exactRunReadiness") &&
    mainSrc.includes("buildExactRunReadinessRpcArgs") &&
    mainSrc.includes("formatPrmExactRunContextCue") &&
    mainSrc.includes("formatPrmRouteValidationSummary") &&
    mainSrc.includes("syncPrmAsOfDateChrome") &&
    mainSrc.includes("status_counts_baseline") &&
    mainSrc.includes("selectPrmPrimaryReadinessFilterStatuses") &&
    mainSrc.includes("RPC.generalReadiness") &&
    mainSrc.includes("buildReadinessRpcArgs") &&
    mainSrc.includes("readinessAsOfContextHtml") &&
    mainSrc.includes("clearReadinessFilters") &&
    mainSrc.includes("cp-prm-badge-ok") &&
    mainSrc.includes("cp-prm-badge-warn") &&
    mainSrc.includes("cp-prm-badge-danger") &&
    mainSrc.includes("SERVER CONTRACT REQUIRED") &&
    mainSrc.includes("action.mutation !== true") &&
    mainSrc.includes("data-prm-effective-host") &&
    mainSrc.includes("data-prm-candidate-host") &&
    mainSrc.includes("data-prm-assignment-host") &&
    mainSrc.includes("Product Route Family Assignment") &&
    mainSrc.includes(
      "Advisory historical evidence — no assignment or route is created automatically.",
    ) &&
    mainSrc.includes("openCreateAssignmentDraftModal") &&
    mainSrc.includes("buildCreateProductRouteFamilyAssignmentDraftArgs") &&
    mainSrc.includes("buildProductAssignmentsRpcArgs") &&
    mainSrc.includes("buildCancelProductRouteFamilyAssignmentArgs") &&
    mainSrc.includes("assignmentLifecycleIncludes") &&
    mainSrc.includes("refreshAfterAssignmentMutation") &&
    mainSrc.includes("normalizeProductRouteFamilyAssignmentPayload") &&
    mainSrc.includes("renderAssignments") &&
    mainSrc.includes("ASSIGNMENT_REGISTER") &&
    mainSrc.includes("assignment_status_counts_baseline") &&
    mainSrc.includes('optionsStatus = "loading"') &&
    mainSrc.includes("refreshAfterAssignmentMutation") &&
    mainSrc.includes("loadWorkloadPreview") &&
    mainSrc.includes("renderWorkloadPreview") &&
    mainSrc.includes("WORKLOAD_PREVIEW") &&
    mainSrc.includes("buildWorkloadPreviewRpcArgs") &&
    mainSrc.includes("buildWorkloadDetailRpcArgs") &&
    mainSrc.includes("shared-workload-preview") &&
    !mainSrc.includes("rpc_preview_shared_standard_batch_route_foundation"),
  "Gate 11Y.4D.1 Workload Preview + Assignments + exact-run isolation",
);
assert(
  !mainSrc.includes("RPC.readiness") &&
    mainSrc.includes("generalReadiness:") &&
    /await invoke\(\r?\n\s*RPC\.generalReadiness/.test(mainSrc) &&
    /async function loadReadiness[\s\S]*?RPC\.generalReadiness/.test(mainSrc) &&
    !/async function loadReadiness[\s\S]*?RPC\.exactRunReadiness/.test(mainSrc),
  "Route Readiness invokes general readiness; exact-run not used for that lens",
);
assert(
  htmlSrc.includes("cp-prm-badge-danger") &&
    htmlSrc.includes("cp-prm-server-contract"),
  "HTML includes readiness danger chip and SERVER CONTRACT REQUIRED styles",
);

if (failed) {
  console.error(`production-route-rpc-contract-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-rpc-contract-smoke: all passed");
