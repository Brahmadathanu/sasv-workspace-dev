/**
 * Gate 11Y.10I.2C.3F.2B.0A — Canonical Production Cost Centre approval reference.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not approve FG_TRANSFER_BOUNDARY_GENERAL or any live Cost Centre.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmFamilyRouteApprovalReferenceTemplate,
  buildPrmProductRouteApprovalReference,
  buildPrmProductionCostCentreApprovalReference,
  getPrmLocalIsoDate,
  PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_RE,
  resolvePrmProductionCostCentreApprovalIdentity,
  validatePrmProductionCostCentreApprovalReference,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const ccSrc = read(
  "public/shared/js/costing-suite-production-route-cost-centres.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-cost-centre-approval-reference-smoke.mjs",
);
const productApprovalSmokeSrc = read(
  "scripts/production-route-product-approval-reference-smoke.mjs",
);

const openApproveFn =
  ccSrc.match(/function openApprove\(centre\) \{[\s\S]*?\n  function openInactivate/)?.[0] ||
  "";
const productBuilderFn =
  helpersSrc.match(
    /export function buildPrmProductRouteApprovalReference\([\s\S]*?\nexport function validatePrmProductRouteApprovalReference/,
  )?.[0] || "";
const ccBuilderFn =
  helpersSrc.match(
    /export function buildPrmProductionCostCentreApprovalReference\([\s\S]*?\nexport function validatePrmProductionCostCentreApprovalReference/,
  )?.[0] || "";
const familyApproveBind =
  mainSrc.match(
    /if \(action === `approve-\$\{mode\}`\) \{[\s\S]*?\n      if \(action === `supersede-\$\{mode\}`\)/,
  )?.[0] || "";
const detailGovernance =
  ccSrc.match(
    /<h3 class="cp-section-title">Governance<\/h3>[\s\S]*?<h3 class="cp-section-title">Description<\/h3>/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const fixture = buildPrmProductionCostCentreApprovalReference({
  costCentreCode: "FG_TRANSFER_BOUNDARY_GENERAL",
  approvalDate: "2026-08-13",
});
const lowerCode = buildPrmProductionCostCentreApprovalReference({
  costCentreCode: "fg_transfer_boundary_general",
  approvalDate: "2026-08-13",
});
const withIdIgnored = buildPrmProductionCostCentreApprovalReference({
  costCentreCode: "FG_TRANSFER_BOUNDARY_GENERAL",
  approvalDate: "2026-08-13",
});
const productCanonical = buildPrmProductRouteApprovalReference({
  productId: 139,
  routeVersion: 1,
  approvalDate: "2026-08-12",
});

assert(
  openApproveFn.includes('title: "Approve Production Cost Centre"') &&
    openApproveFn.includes('subtitle: "Canonical approval reference"') &&
    openApproveFn.includes("buildPrmProductionCostCentreApprovalReference") &&
    openApproveFn.includes("PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_HELPER_TEXT"),
  "1 Cost Centre Approve opens canonical modal",
);
assert(
  typeof buildPrmProductionCostCentreApprovalReference === "function" &&
    helpersSrc.includes("export function buildPrmProductionCostCentreApprovalReference") &&
    ccBuilderFn.includes("PRM-CC-"),
  "2 generator exists",
);
assert(
  fixture.ok &&
    fixture.costCentreCode === "FG_TRANSFER_BOUNDARY_GENERAL" &&
    !ccBuilderFn.includes("cost_centre_id") &&
    !ccBuilderFn.includes("cost_centre_name") &&
    !openApproveFn.includes("centre.cost_centre_name") &&
    resolvePrmProductionCostCentreApprovalIdentity({
      detail: {
        cost_centre_id: 999,
        cost_centre_name: "Should Not Appear",
        cost_centre_code: "FG_TRANSFER_BOUNDARY_GENERAL",
      },
    }).costCentreCode === "FG_TRANSFER_BOUNDARY_GENERAL" &&
    !String(fixture.reference).includes("999") &&
    !String(fixture.reference).includes("Should"),
  "3 code used, not id/name",
);
assert(
  openApproveFn.includes("getPrmLocalIsoDate()") &&
    ccBuilderFn.includes("getPrmLocalIsoDate()") &&
    typeof getPrmLocalIsoDate === "function" &&
    !ccBuilderFn.includes("effective_from") &&
    !ccBuilderFn.includes("getAsOfDate"),
  "4 local approval date used",
);
assert(
  !ccBuilderFn.includes("effective_from") &&
    openApproveFn.includes('id: "prmCcApproveEffective"') &&
    !openApproveFn.includes(
      "approvalDate: host.querySelector(\"#prmCcApproveEffective\")",
    ) &&
    !openApproveFn.includes("approvalDate: centre.effective_from"),
  "5 Effective From not used in generator",
);
assert(
  fixture.ok &&
    fixture.reference ===
      "PRM-CC-FG_TRANSFER_BOUNDARY_GENERAL-APP-20260813" &&
    lowerCode.ok &&
    lowerCode.reference === fixture.reference &&
    withIdIgnored.reference === fixture.reference &&
    PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_RE.test(fixture.reference),
  "6 exact expected reference fixture",
);
assert(
  openApproveFn.includes("readonly: true") &&
    openApproveFn.includes('id: "prmCcApproveRef"') &&
    openApproveFn.includes("value: generated.reference"),
  "7 readonly input",
);
assert(
  openApproveFn.includes(
    "PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_HELPER_TEXT",
  ) &&
    !openApproveFn.includes("PRM_APPROVAL_REFERENCE_HELPER_TEXT") &&
    !openApproveFn.includes("may be edited") &&
    !openApproveFn.includes("Editable approval") &&
    !openApproveFn.includes("suggested reference") &&
    helpersSrc.includes(
      '"Generated from Cost Centre identity and approval date."',
    ),
  "8 no editable approval wording",
);
assert(
  openApproveFn.includes("const recomputed = buildPrmProductionCostCentreApprovalReference") &&
    openApproveFn.includes("approvalDate: getPrmLocalIsoDate()") &&
    openApproveFn.indexOf("recomputed") <
      openApproveFn.indexOf("buildApproveProductionCostCentreRpcArgs"),
  "9 recompute immediately before RPC",
);
assert(
  openApproveFn.includes("approval_reference: recomputed.reference") &&
    !openApproveFn.includes(
      'approval_reference: host.querySelector("#prmCcApproveRef")',
    ) &&
    rpcSrc.includes("p_approval_reference") &&
    rpcSrc.includes("rpc_approve_production_cost_centre"),
  "10 canonical reference passed to p_approval_reference",
);
assert(
  !buildPrmProductionCostCentreApprovalReference({
    costCentreCode: "",
    approvalDate: "2026-08-13",
  }).ok &&
    !buildPrmProductionCostCentreApprovalReference({
      costCentreCode: null,
      approvalDate: "2026-08-13",
    }).ok &&
    !buildPrmProductionCostCentreApprovalReference({
      costCentreCode: "1BAD",
      approvalDate: "2026-08-13",
    }).ok &&
    openApproveFn.includes("if (!identity.ok)") &&
    openApproveFn.includes("if (!recomputed.ok)") &&
    openApproveFn.includes("if (!checked.ok)"),
  "11 invalid/missing code blocks",
);
assert(
  !validatePrmProductionCostCentreApprovalReference("BOARD-MINUTES-12", {
    costCentreCode: "FG_TRANSFER_BOUNDARY_GENERAL",
    approvalDate: "2026-08-13",
  }).ok &&
    !validatePrmProductionCostCentreApprovalReference(
      "PRM-CC-FG_TRANSFER_BOUNDARY_GENERAL-APP-20260812",
      {
        costCentreCode: "FG_TRANSFER_BOUNDARY_GENERAL",
        approvalDate: "2026-08-13",
      },
    ).ok &&
    openApproveFn.includes("validatePrmProductionCostCentreApprovalReference") &&
    !openApproveFn.includes("fallback") &&
    !openApproveFn.includes("manual entry"),
  "12 no fallback manual entry",
);
assert(
  detailGovernance.includes("centre.approval_reference") &&
    detailGovernance.includes("${text(\n              centre.approval_reference") &&
    !detailGovernance.includes("buildPrmProductionCostCentreApprovalReference") &&
    !openApproveFn.includes("UPDATE ") &&
    !openApproveFn.includes("backfill") &&
    !openApproveFn.includes("migrate"),
  "13 historical stored reference untouched",
);
assert(
  productCanonical.ok &&
    productCanonical.reference === "PRM-PR-139-V1-APP-20260812" &&
    productBuilderFn.includes("PRM-PR-") &&
    !productBuilderFn.includes("PRM-CC-") &&
    !ccBuilderFn.includes("PRM-PR-") &&
    productApprovalSmokeSrc.includes("buildPrmProductRouteApprovalReference"),
  "14 Product Route generator unchanged",
);
assert(
  familyApproveBind.includes("openApproveFamilyRouteModal()") &&
    mainSrc.includes("function openApproveFamilyRouteModal") &&
    mainSrc.includes("buildPrmFamilyRouteApprovalReference") &&
    !openApproveFn.includes("buildPrmFamilyRouteApprovalReference") &&
    buildPrmFamilyRouteApprovalReferenceTemplate(
      "DRY_POWDER_CHOORNAM",
      "2",
      "2026-08-11",
    ) === "PRM-RFR-DRY_POWDER_CHOORNAM-V2-APP-20260811",
  "15 Family Route approval remains a separate PRM-RFR path",
);
assert(
  !thisSrc.includes("from \"../public/shared/js/supabase") &&
    !thisSrc.includes("create" + "Client") &&
    !openApproveFn.includes("FG_TRANSFER_BOUNDARY_GENERAL") &&
    thisSrc.includes("Does not approve FG_TRANSFER_BOUNDARY_GENERAL") &&
    thisSrc.includes("Client-only source/contract smoke"),
  "16 no Cost Centre approval in smoke",
);
assert(
  !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !ccSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("CREATE OR REPLACE FUNCTION") &&
    rpcSrc.includes(
      'rpc_approve_production_cost_centre: Object.freeze([\n    "p_cost_centre_id",\n    "p_approval_reference",\n    "p_effective_from",\n  ])',
    ),
  "17 no server mutation",
);
assert(
  !openApproveFn.includes("rpc_refresh") &&
    !openApproveFn.includes("Stage 03") &&
    !openApproveFn.includes("requestCostingRefresh") &&
    !ccSrc.includes("Stage 03"),
  "18 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v299"/.test(swSrc) &&
    openApproveFn.includes("{ replace: true }"),
  "19 SW bumped exactly once to hub-cache-v299",
);

if (failed) {
  console.error(
    `\nproduction-route-cost-centre-approval-reference-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-cost-centre-approval-reference-smoke: all passed",
);
