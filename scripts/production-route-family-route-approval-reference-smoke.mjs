/**
 * Gate 11Y.10I.2C.3F.2B.2C.2 — Family Route canonical approval reference.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not approve Family Route 11.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmFamilyRouteApprovalReference,
  buildPrmFamilyRouteApprovalReferenceTemplate,
  buildPrmProductionCostCentreApprovalReference,
  buildPrmProductRouteApprovalReference,
  buildPrmRouteFamilyApprovalReference,
  PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE,
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE,
  PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_RE,
  resolvePrmFamilyRouteApprovalIdentity,
  validatePrmFamilyRouteApprovalReference,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-family-route-approval-reference-smoke.mjs",
);

const familyApproveFn =
  mainSrc.match(
    /function openApproveFamilyRouteModal\([\s\S]*?\n  function openApproveProductRouteModal/,
  )?.[0] || "";
const productApproveFn =
  mainSrc.match(
    /function openApproveProductRouteModal\([\s\S]*?\n  function option/,
  )?.[0] || "";
const routeFamilyApproveFn =
  mainSrc.match(
    /async function openApproveFamilyModal\(row[\s\S]*?\n  async function openMapProductGroupModal/,
  )?.[0] || "";
const approveFn =
  editorSrc.match(
    /async function approve\([\s\S]*?\n  async function supersedeFamily/,
  )?.[0] || "";
const historyFn =
  mainSrc.match(
    /function buildFamilyHistoryTableHtml\([\s\S]*?\n  function bindFamilyHistoryOpen/,
  )?.[0] ||
  mainSrc.match(
    /function buildHistoryTableHtml\([\s\S]*?\n  function bindHistoryOpen/,
  )?.[0] ||
  "";
const familyBuilderFn =
  helpersSrc.match(
    /export function buildPrmFamilyRouteApprovalReference\([\s\S]*?\nexport function validatePrmFamilyRouteApprovalReference/,
  )?.[0] || "";
const rfBuilderFn =
  helpersSrc.match(
    /export function buildPrmRouteFamilyApprovalReference\([\s\S]*?\nexport function validatePrmRouteFamilyApprovalReference/,
  )?.[0] || "";
const productBuilderFn =
  helpersSrc.match(
    /export function buildPrmProductRouteApprovalReference\([\s\S]*?\nexport function validatePrmProductRouteApprovalReference/,
  )?.[0] || "";
const ccBuilderFn =
  helpersSrc.match(
    /export function buildPrmProductionCostCentreApprovalReference\([\s\S]*?\nexport function validatePrmProductionCostCentreApprovalReference/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const fixture = buildPrmFamilyRouteApprovalReference({
  routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
  routeVersion: 1,
  approvalDate: "2026-08-13",
});

assert(
  fixture.ok &&
    fixture.reference ===
      "PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260813" &&
    thisSrc.includes("Family Route 11") &&
    thisSrc.includes("Does not approve Family Route 11"),
  "1 current Route 11 fixture",
);
assert(
  fixture.reference === "PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260813",
  "2 generated PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260813",
);
assert(
  familyApproveFn.includes("readonly: true") &&
    familyApproveFn.includes("value: generated.reference"),
  "3 readonly field",
);
assert(
  !familyApproveFn.includes("The suggested reference may be edited.") &&
    !familyApproveFn.includes("Editable approval reference") &&
    !familyApproveFn.includes("PRM_APPROVAL_REFERENCE_HELPER_TEXT") &&
    PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT.includes(
      "Generated from Route Family identity, route version, and approval date.",
    ) &&
    !PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT.includes(
      "suggested reference may be edited",
    ),
  "4 editable helper text removed",
);
assert(
  familyApproveFn.includes("identity.routeFamilyCode") &&
    familyBuilderFn.includes("identity.routeFamilyCode") &&
    resolvePrmFamilyRouteApprovalIdentity({
      detail: {
        route_family_code: "DRY_FINE_POWDER_NO_WASH",
        route_version: 1,
      },
    }).routeFamilyCode === "DRY_FINE_POWDER_NO_WASH",
  "5 uses Route Family code",
);
assert(
  familyApproveFn.includes("identity.routeVersion") &&
    helpersSrc.includes("detail?.route_version ?? detail?.version_no") &&
    !familyApproveFn.includes("version_label") &&
    resolvePrmFamilyRouteApprovalIdentity({
      detail: {
        route_family_code: "DRY_FINE_POWDER_NO_WASH",
        route_version: 1,
      },
    }).routeVersion === 1,
  "6 uses route_version",
);
assert(
  !familyBuilderFn.includes("family_route_id") &&
    !familyBuilderFn.includes("route_name") &&
    !String(fixture.reference).includes("-11-") &&
    fixture.reference.includes("DRY_FINE_POWDER_NO_WASH") &&
    !fixture.reference.includes("DRY_FINE_POWDER_NO_WASH_ROUTE"),
  "7 does not use route id",
);
assert(
  familyApproveFn.includes("getPrmLocalIsoDate()") &&
    familyBuilderFn.includes("getPrmLocalIsoDate()") &&
    !familyApproveFn.includes("getAsOfDate()"),
  "8 local approval date",
);
assert(
  !familyApproveFn.includes("effective_from") &&
    !familyBuilderFn.includes("effective_from"),
  "9 effective_from not used",
);
assert(
  familyApproveFn.includes("editor.approveFamily(checked.reference") &&
    !/querySelector\("#prmApproveRouteRef"\)[\s\S]*approveFamily/.test(
      familyApproveFn,
    ),
  "10 DOM value ignored at Approve",
);
assert(
  familyApproveFn.includes("const recomputed = buildPrmFamilyRouteApprovalReference") &&
    familyApproveFn.includes("validatePrmFamilyRouteApprovalReference") &&
    approveFn.includes("validatePrmFamilyRouteApprovalReference"),
  "11 pre-RPC recompute",
);
assert(
  PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE.test(
    "PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260813",
  ) &&
    !PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE.test(
      "PRM-RF-DRY_FINE_POWDER_NO_WASH-APP-20260813",
    ) &&
    !PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE.test("BOARD-MINUTES-12") &&
    familyBuilderFn.includes("PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE.test"),
  "12 canonical regex",
);
assert(
  !buildPrmFamilyRouteApprovalReference({
    routeFamilyCode: null,
    routeVersion: 1,
    approvalDate: "2026-08-13",
  }).ok &&
    !resolvePrmFamilyRouteApprovalIdentity({
      detail: { route_version: 1 },
    }).ok,
  "13 missing family code blocks",
);
assert(
  !buildPrmFamilyRouteApprovalReference({
    routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
    routeVersion: null,
    approvalDate: "2026-08-13",
  }).ok &&
    !resolvePrmFamilyRouteApprovalIdentity({
      detail: { route_family_code: "DRY_FINE_POWDER_NO_WASH" },
    }).ok,
  "14 missing version blocks",
);
assert(
  !buildPrmFamilyRouteApprovalReference({
    routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
    routeVersion: 1,
    approvalDate: "not-a-date",
  }).ok &&
    !validatePrmFamilyRouteApprovalReference("BOARD-MINUTES-12", {
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      routeVersion: 1,
      approvalDate: "2026-08-13",
    }).ok &&
    !validatePrmFamilyRouteApprovalReference(
      "PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260812",
      {
        routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
        routeVersion: 1,
        approvalDate: "2026-08-13",
      },
    ).ok,
  "15 invalid generation blocks",
);
assert(
  routeFamilyApproveFn.includes("buildPrmRouteFamilyApprovalReference") &&
    PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_RE.test(
      "PRM-RF-DRY_FINE_POWDER_NO_WASH-APP-20260813",
    ) &&
    buildPrmRouteFamilyApprovalReference({
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      approvalDate: "2026-08-13",
    }).reference === "PRM-RF-DRY_FINE_POWDER_NO_WASH-APP-20260813" &&
    !rfBuilderFn.includes("PRM-RFR-") &&
    !routeFamilyApproveFn.includes("buildPrmFamilyRouteApprovalReference("),
  "16 Route Family PRM-RF logic unchanged",
);
assert(
  productApproveFn.includes("buildPrmProductRouteApprovalReference") &&
    PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE.test("PRM-PR-139-V1-APP-20260812") &&
    buildPrmProductRouteApprovalReference({
      productId: 139,
      routeVersion: 1,
      approvalDate: "2026-08-12",
    }).reference === "PRM-PR-139-V1-APP-20260812" &&
    !productBuilderFn.includes("PRM-RFR-") &&
    !productApproveFn.includes("buildPrmFamilyRouteApprovalReference"),
  "17 Product PRM-PR logic unchanged",
);
assert(
  ccBuilderFn.includes("PRM-CC-") &&
    buildPrmProductionCostCentreApprovalReference({
      costCentreCode: "FG_TRANSFER_BOUNDARY_GENERAL",
      approvalDate: "2026-08-13",
    }).reference === "PRM-CC-FG_TRANSFER_BOUNDARY_GENERAL-APP-20260813" &&
    !ccBuilderFn.includes("PRM-RFR-") &&
    !familyApproveFn.includes("buildPrmProductionCostCentreApprovalReference"),
  "18 Cost Centre PRM-CC logic unchanged",
);
assert(
  !thisSrc.includes("from \"../public/shared/js/supabase") &&
    !familyApproveFn.includes("DRY_FINE_POWDER_NO_WASH_ROUTE") &&
    thisSrc.includes("Does not approve Family Route 11") &&
    fixture.routeVersion === 1,
  "19 no live approval",
);
assert(
  !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !mainSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("CREATE OR REPLACE FUNCTION") &&
    rpcSrc.includes("rpc_approve_route_family_route"),
  "20 no server changes",
);
assert(
  !familyApproveFn.includes("rpc_refresh") &&
    !familyBuilderFn.includes("rpc_refresh") &&
    !approveFn.includes("rpc_refresh"),
  "21 no costing refresh",
);
assert(
  familyApproveFn.includes('subtitle: "Canonical approval reference"') &&
    familyApproveFn.includes("PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT") &&
    buildPrmFamilyRouteApprovalReferenceTemplate(
      "DRY_FINE_POWDER_NO_WASH",
      "1",
      "2026-08-13",
    ) === "PRM-RFR-DRY_FINE_POWDER_NO_WASH-V1-APP-20260813" &&
    !historyFn.includes("buildPrmFamilyRouteApprovalReference("),
  "historical display not rewritten; template retained",
);
assert(
  /CACHE_NAME = "hub-cache-v291"/.test(swSrc),
  "SW bumped exactly once to hub-cache-v291",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-family-route-approval-reference-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-family-route-approval-reference-smoke: all passed",
);
