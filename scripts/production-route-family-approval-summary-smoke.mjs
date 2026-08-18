/**
 * Gate 11Y.10I.2C.3F.2B.1A — Route Family canonical approval + assignment summary.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not approve DRY_FINE_POWDER_NO_WASH or create mappings.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmFamilyRouteApprovalReferenceTemplate,
  buildPrmProductionCostCentreApprovalReference,
  buildPrmProductRouteApprovalReference,
  buildPrmRouteFamilyApprovalReference,
  filterPrmRouteFamilyGroupMappings,
  filterPrmRouteFamilyProductAssignments,
  filterPrmRouteFamilySubgroupMappings,
  getPrmLocalIsoDate,
  getRouteFamilyWorkflowSteps,
  PRM_FAMILY_WORKFLOW_STEPS,
  PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_RE,
  resolvePrmRouteFamilyApprovalIdentity,
  summarizePrmRouteFamilyAssignments,
  validatePrmRouteFamilyApprovalReference,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-family-approval-summary-smoke.mjs",
);
const ccSmokeSrc = read(
  "scripts/production-route-cost-centre-approval-reference-smoke.mjs",
);
const productSmokeSrc = read(
  "scripts/production-route-product-approval-reference-smoke.mjs",
);

const openApproveFn =
  mainSrc.match(
    /async function openApproveFamilyModal\(row[\s\S]*?\n  async function openMapProductGroupModal/,
  )?.[0] || "";
const familySummaryFn =
  mainSrc.match(
    /async function openFamilySummary\(row[\s\S]*?\n  function bindSummaryActions/,
  )?.[0] || "";
const assignmentSummaryFns =
  mainSrc.match(
    /function mappingsSectionHtml\([\s\S]*?\n  async function openFamilySummary/,
  )?.[0] || "";
const familyRouteApproveBind =
  mainSrc.match(
    /if \(action === `approve-\$\{mode\}`\) \{[\s\S]*?\n      if \(action === `supersede-\$\{mode\}`\)/,
  )?.[0] || "";
const rfBuilderFn =
  helpersSrc.match(
    /export function buildPrmRouteFamilyApprovalReference\([\s\S]*?\nexport function validatePrmRouteFamilyApprovalReference/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const fixture = buildPrmRouteFamilyApprovalReference({
  routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
  approvalDate: "2026-08-13",
});
const lowerCode = buildPrmRouteFamilyApprovalReference({
  routeFamilyCode: "dry_fine_powder_no_wash",
  approvalDate: "2026-08-13",
});
const cleanSummary = summarizePrmRouteFamilyAssignments({
  groupMappings: [],
  subgroupMappings: [],
  productAssignments: [],
});
const subgroupOnlySummary = summarizePrmRouteFamilyAssignments({
  groupMappings: [],
  subgroupMappings: [
    {
      mapping_id: 19,
      route_family_id: 4,
      product_subgroup_id: 19,
      product_subgroup_name: "Lepa Choornam",
      status: "APPROVED",
    },
  ],
  productAssignments: [],
});
const subgroupOnlySteps = getRouteFamilyWorkflowSteps({
  status: "APPROVED",
  mappings: [],
  subgroup_mappings: subgroupOnlySummary.subgroupMappings,
  product_assignments: [],
});

assert(
  openApproveFn.includes('title: "Approve Route Family"') &&
    openApproveFn.includes('subtitle: "Canonical approval reference"') &&
    openApproveFn.includes("buildPrmRouteFamilyApprovalReference") &&
    openApproveFn.includes("PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_HELPER_TEXT"),
  "A1 Route Family Approve opens canonical modal",
);
assert(
  typeof buildPrmRouteFamilyApprovalReference === "function" &&
    helpersSrc.includes("export function buildPrmRouteFamilyApprovalReference") &&
    rfBuilderFn.includes("PRM-RF-"),
  "A2 canonical generator exists",
);
assert(
  fixture.ok &&
    PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_RE.test(fixture.reference) &&
    fixture.reference.startsWith("PRM-RF-") &&
    fixture.reference.includes("-APP-"),
  "A3 correct RF pattern",
);
assert(
  fixture.ok &&
    fixture.routeFamilyCode === "DRY_FINE_POWDER_NO_WASH" &&
    !rfBuilderFn.includes("route_family_id") &&
    resolvePrmRouteFamilyApprovalIdentity({
      detail: {
        route_family_id: 99,
        route_family_name: "Dry Fine Powder — No-Wash",
        route_family_code: "DRY_FINE_POWDER_NO_WASH",
      },
    }).routeFamilyCode === "DRY_FINE_POWDER_NO_WASH" &&
    !String(fixture.reference).includes("99") &&
    !String(fixture.reference).includes("Dry Fine"),
  "A4 uses Family code, not id/name",
);
assert(
  openApproveFn.includes("getPrmLocalIsoDate()") &&
    rfBuilderFn.includes("getPrmLocalIsoDate()") &&
    typeof getPrmLocalIsoDate === "function" &&
    !openApproveFn.includes("getAsOfDate()") &&
    !rfBuilderFn.includes("effective_from"),
  "A5 uses approval-event local date",
);
assert(
  !rfBuilderFn.includes("effective_from") &&
    !openApproveFn.includes('id: "prmApproveFamilyEffective"') &&
    !openApproveFn.includes("approvalDate: row.effective_from"),
  "A6 does not use Effective From",
);
assert(
  fixture.ok &&
    fixture.reference === "PRM-RF-DRY_FINE_POWDER_NO_WASH-APP-20260813" &&
    lowerCode.ok &&
    lowerCode.reference === fixture.reference,
  "A7 current fixture exact",
);
assert(
  openApproveFn.includes("readonly: true") &&
    openApproveFn.includes('id: "prmApproveFamilyRef"') &&
    openApproveFn.includes("value: generated.reference"),
  "A8 modal readonly",
);
assert(
  openApproveFn.includes("PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_HELPER_TEXT") &&
    !openApproveFn.includes("PRM_APPROVAL_REFERENCE_HELPER_TEXT") &&
    !openApproveFn.includes("may be edited") &&
    helpersSrc.includes(
      '"Generated from Route Family identity and approval date."',
    ),
  "A9 helper wording",
);
assert(
  openApproveFn.includes("const recomputed = buildPrmRouteFamilyApprovalReference") &&
    openApproveFn.indexOf("recomputed") <
      openApproveFn.indexOf("buildApproveRouteFamilyArgs"),
  "A10 recompute before RPC",
);
assert(
  openApproveFn.includes("approval_reference: recomputed.reference") &&
    !openApproveFn.includes(
      'approval_reference: host.querySelector("#prmApproveFamilyRef")',
    ) &&
    rpcSrc.includes("rpc_approve_route_family"),
  "A11 canonical value passed to server adapter",
);
assert(
  !buildPrmRouteFamilyApprovalReference({
    routeFamilyCode: "",
    approvalDate: "2026-08-13",
  }).ok &&
    !buildPrmRouteFamilyApprovalReference({
      routeFamilyCode: null,
      approvalDate: "2026-08-13",
    }).ok &&
    openApproveFn.includes("if (!identity.ok)") &&
    openApproveFn.includes("if (!checked.ok)"),
  "A12 invalid/missing code blocks",
);
assert(
  !validatePrmRouteFamilyApprovalReference("BOARD-MINUTES-12", {
    routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
    approvalDate: "2026-08-13",
  }).ok &&
    openApproveFn.includes("validatePrmRouteFamilyApprovalReference") &&
    !openApproveFn.includes("fallback") &&
    !openApproveFn.includes("manual entry"),
  "A13 no manual fallback",
);
assert(
  assignmentSummaryFns.includes("mapping.approval_reference") &&
    assignmentSummaryFns.includes("assignment.approval_reference") &&
    !assignmentSummaryFns.includes("buildPrmRouteFamilyApprovalReference") &&
    !openApproveFn.includes("backfill"),
  "A14 historical stored references untouched",
);
assert(
  !openApproveFn.includes("DRY_FINE_POWDER_NO_WASH") &&
    thisSrc.includes("Does not approve DRY_FINE_POWDER_NO_WASH") &&
    thisSrc.includes("Client-only source/contract smoke"),
  "A15 no live approval in smoke",
);

assert(
  !helpersSrc.includes('"Product Groups mapped"') &&
    PRM_FAMILY_WORKFLOW_STEPS.some((step) => step.label === "Assignments defined") &&
    PRM_FAMILY_WORKFLOW_STEPS.some((step) => step.label === "Assignments approved") &&
    !familySummaryFn.includes("Product Groups mapped"),
  "B16 Group-only workflow wording removed",
);
assert(
  helpersSrc.includes('if (current.id === "groups_mapped") return "Define assignment"') &&
    getRouteFamilyWorkflowSteps({ status: "DRAFT", mappings: [] })[2].label ===
      "Assignments defined",
  "B17 hierarchy-neutral assignment workflow",
);
assert(
  typeof filterPrmRouteFamilySubgroupMappings === "function" &&
    familySummaryFn.includes("filterPrmRouteFamilySubgroupMappings") &&
    assignmentSummaryFns.includes("Mapped Product Subgroups") &&
    assignmentSummaryFns.includes("subgroupMappingsSectionHtml"),
  "B18 Subgroup mappings normalized/renderable",
);
assert(
  familySummaryFn.includes("filterPrmRouteFamilyGroupMappings") &&
    assignmentSummaryFns.includes("Mapped Product Groups") &&
    assignmentSummaryFns.includes("mappingsSectionHtml"),
  "B19 Product Group mappings still supported",
);
assert(
  familySummaryFn.includes("filterPrmRouteFamilyProductAssignments") &&
    assignmentSummaryFns.includes("Direct Product Assignments") &&
    assignmentSummaryFns.includes("productAssignmentsSectionHtml"),
  "B20 direct Product assignments still supported",
);
assert(
  cleanSummary.counts.subgroups === 0 &&
    cleanSummary.counts.groups === 0 &&
    cleanSummary.counts.products === 0 &&
    !cleanSummary.hasDefinedAssignment &&
    assignmentSummaryFns.includes("No Product Subgroups mapped yet") &&
    assignmentSummaryFns.includes("No Product Groups mapped yet") &&
    assignmentSummaryFns.includes("No direct Product assignments yet"),
  "B21 zero-assignment clean state correct",
);
assert(
  subgroupOnlySummary.hasDefinedAssignment &&
    subgroupOnlySummary.hasApprovedAssignment &&
    subgroupOnlySummary.counts.subgroups === 1 &&
    subgroupOnlySummary.counts.groups === 0,
  "B22 future Subgroup-only fixture is recognized",
);
assert(
  subgroupOnlySteps[2].state === "complete" &&
    subgroupOnlySteps[3].state === "complete" &&
    subgroupOnlySummary.hasDefinedAssignment,
  "B23 Subgroup-only fixture is not reported as unmapped",
);
assert(
  !assignmentSummaryFns.includes("resolvePrmRouteFamilyAssignmentSource(") &&
    assignmentSummaryFns.includes("formatPrmRouteFamilyAssignmentSourceLabel") &&
    !familySummaryFn.includes("resolvePrmRouteFamilyAssignmentSource("),
  "B24 no resolver/client precedence change",
);
assert(
  !openApproveFn.includes("rpc_map_product_subgroup_to_route_family") &&
    !openApproveFn.includes("rpc_map_product_group_to_route_family") &&
    !openApproveFn.includes("rpc_create_product_route_family_assignment_draft") &&
    !openApproveFn.includes("rpc_create_route_family_route_draft") &&
    !openApproveFn.includes("rpc_refresh") &&
    !familySummaryFn.includes("rpc_refresh"),
  "B25 no business mutation",
);

assert(
  buildPrmProductionCostCentreApprovalReference({
    costCentreCode: "FG_TRANSFER_BOUNDARY_GENERAL",
    approvalDate: "2026-08-13",
  }).reference === "PRM-CC-FG_TRANSFER_BOUNDARY_GENERAL-APP-20260813" &&
    ccSmokeSrc.includes("buildPrmProductionCostCentreApprovalReference"),
  "regression Cost Centre generator unchanged",
);
assert(
  buildPrmProductRouteApprovalReference({
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).reference === "PRM-PR-139-V1-APP-20260812" &&
    productSmokeSrc.includes("buildPrmProductRouteApprovalReference"),
  "regression Product Route generator unchanged",
);
assert(
  familyRouteApproveBind.includes("openApproveFamilyRouteModal()") &&
    mainSrc.includes("function openApproveFamilyRouteModal") &&
    mainSrc.includes("buildPrmFamilyRouteApprovalReference") &&
    !openApproveFn.includes("buildPrmFamilyRouteApprovalReference") &&
    buildPrmFamilyRouteApprovalReferenceTemplate(
      "DRY_FINE_POWDER_NO_WASH",
      "1",
      "2026-08-13",
    ) === "PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260813",
  "regression Family Route approval uses canonical PRM-RFR path",
);

assert(
  /CACHE_NAME = "hub-cache-v302"/.test(swSrc) &&
    thisSrc.includes("hub-cache-v302"),
  "SW bumped exactly once to hub-cache-v302",
);

if (failed) {
  console.error(
    `\nproduction-route-family-approval-summary-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-approval-summary-smoke: all passed");
