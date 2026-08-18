/**
 * Gate 11Y.10I.2C.3F.2B.4B.1 — Cost Centre Approve action + modal handler lifecycle.
 * Client-only source/contract smoke. Does not approve CC40, CC41, or any live Cost Centre.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmProductionCostCentreApprovalReference,
  normalizePrmCostCentreValidation,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const ccSrc = read(
  "public/shared/js/costing-suite-production-route-cost-centres.js",
);
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const subgroupSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-cost-centre-approve-action-smoke.mjs",
);

const unbindFn =
  mainSrc.match(
    /\/\*\* Page\/register handlers only[\s\S]*?function unbind\(\) \{[\s\S]*?\n  \}\n\n  function hosts/,
  )?.[0] || "";
const closeModalFn =
  mainSrc.match(
    /function closeModal\([\s\S]*?\n  \}\n\n  function clearWorkloadProductModalChrome/,
  )?.[0] || "";
const applyModalFn =
  mainSrc.match(
    /function applyModalContent\([\s\S]*?\n  \}\n\n  function openModal/,
  )?.[0] || "";
const openModalFn =
  mainSrc.match(
    /function openModal\([\s\S]*?\n  \}\n\n  \/\*\* Shared PRM form field/,
  )?.[0] || "";
const openApproveFn =
  ccSrc.match(/function openApprove\(centre\) \{[\s\S]*?\n  function openInactivate/)?.[0] ||
  "";
const openDetailFn =
  ccSrc.match(
    /async function openDetail\(row[\s\S]*?\n  function render\(\)/,
  )?.[0] || "";
const familyApproveFn =
  mainSrc.match(
    /function openApproveFamilyRouteModal\([\s\S]*?\n  function openApproveProductRouteModal/,
  )?.[0] || "";
const productApproveFn =
  mainSrc.match(
    /function openApproveProductRouteModal\([\s\S]*?\n  function option\(/,
  )?.[0] || "";
const familyStepModalFn =
  mainSrc.match(
    /async function openFamilyStepModal\([\s\S]*?\n  async function openFamilyStepCreateModal/,
  )?.[0] || "";
const productDeltaFn =
  mainSrc.match(
    /async function openProductDeltaModal\([\s\S]*?\n  function bindEditor/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const cc40 = {
  cost_centre_id: 40,
  cost_centre_code: "PROD_POWDER_RM_WASHING",
  cost_centre_name: "Raw Material Washing - Powder Formulations",
  status: "APPROVED",
  approval_reference: "PRM-CC-PROD_POWDER_RM_WASHING-APP-20260814",
  validation: { valid: true, errors: [] },
  effective_from: "2026-08-14",
};
const cc41 = {
  cost_centre_id: 41,
  cost_centre_code: "PROD_POWDER_RM_DRYING",
  cost_centre_name: "Raw Material Drying - Powder Formulations",
  status: "APPROVED",
  approval_reference: "PRM-CC-PROD_POWDER_RM_DRYING-APP-20260814",
  validation: { valid: true, errors: [] },
  effective_from: "2026-08-14",
};
const cc40Ref = buildPrmProductionCostCentreApprovalReference({
  costCentreCode: cc40.cost_centre_code,
  approvalDate: "2026-08-14",
});

assert(
  openDetailFn.includes('status === "DRAFT"') &&
    openDetailFn.includes("validation.valid") &&
    openDetailFn.includes("data-prm-cc-approve"),
  "1 valid DRAFT renders Approve…",
);
assert(
  openDetailFn.includes("data-prm-cc-approve>Approve…</button>"),
  "2 data-prm-cc-approve present",
);
assert(
  openDetailFn.includes("onModal(host, \"click\"") &&
    openDetailFn.includes("openApprove(centre)"),
  "3 detail handler bound to openApprove",
);
assert(
  !unbindFn.includes("unbindModalHandlers()") &&
    unbindFn.includes("Page/register handlers only") &&
    applyModalFn.includes("unbindModalHandlers()") &&
    closeModalFn.includes("unbindModalHandlers()"),
  "4 register render/unbind does not clear live modal handler",
);
assert(
  closeModalFn.includes("unbindModalHandlers()"),
  "5 modal close clears modal handler",
);
assert(
  applyModalFn.includes("unbindModalHandlers()") &&
    applyModalFn.indexOf("unbindModalHandlers()") <
      applyModalFn.indexOf("if (typeof bind === \"function\")"),
  "6 applyModalContent clears old modal handler before new bind",
);
assert(
  openDetailFn.includes("openApprove(centre)") &&
    !openDetailFn.includes("closeModal({ restorePrevious: false });\n            openApprove"),
  "7 Approve click reaches openApprove without orphan close",
);
assert(
  openDetailFn.includes("event.stopPropagation()") &&
    openDetailFn.includes("[data-prm-cc-approve]"),
  "8 nested/overlay event does not swallow action",
);
assert(
  openApproveFn.includes("centre.cost_centre_id") &&
    openDetailFn.includes("centre.cost_centre_id"),
  "9 current Cost Centre id preserved",
);
assert(
  openApproveFn.includes("resolvePrmProductionCostCentreApprovalIdentity") &&
    cc40Ref.ok &&
    cc40Ref.reference.includes("PROD_POWDER_RM_WASHING"),
  "10 current Cost Centre code preserved",
);
assert(
  openApproveFn.includes('title: "Approve Production Cost Centre"') &&
    openApproveFn.includes("{ replace: true }"),
  "11 canonical approval modal opens via replace",
);
assert(
  openApproveFn.includes("readonly: true") &&
    openApproveFn.includes('id: "prmCcApproveRef"'),
  "12 readonly canonical reference",
);
assert(
  openApproveFn.includes('id: "prmCcApproveEffective"') &&
    !helpersSrc.match(
      /export function buildPrmProductionCostCentreApprovalReference\([\s\S]*?\nexport function validatePrmProductionCostCentreApprovalReference/,
    )?.[0]?.includes("effective_from"),
  "13 Effective From separate from reference generator",
);
assert(
  !openApproveFn.includes("RPC.approve") ||
    openApproveFn.indexOf("openModal") < openApproveFn.indexOf("RPC.approve"),
  "14 no RPC on modal open",
);
assert(
  unbindFn.includes("!prmOwnsDetailsModal") &&
    openApproveFn.includes("onModal(host, \"click\""),
  "15 submit handler survives unrelated register render",
);
assert(
  openApproveFn.includes("buildApproveProductionCostCentreRpcArgs") &&
    openApproveFn.split("buildApproveProductionCostCentreRpcArgs").length === 2,
  "16 submit invokes existing approve builder once",
);
assert(
  rpcSrc.includes("rpc_approve_production_cost_centre") &&
    openApproveFn.includes("RPC.approve"),
  "17 correct rpc_approve_production_cost_centre path",
);
assert(
  openApproveFn.includes("closeModal({ restorePrevious: false })") &&
    openApproveFn.indexOf("closeModal({ restorePrevious: false })") <
      openApproveFn.indexOf("await refreshCostCentresAfterMutation") &&
    openApproveFn.includes(
      "Cost Centre approved, but the register could not be refreshed.",
    ) &&
    !openApproveFn.includes("onMutated"),
  "18 post-success register refresh path retained",
);
assert(
  openDetailFn.includes("Validate the Cost Centre before approval") &&
    openDetailFn.includes("Only DRAFT Cost Centres can be approved"),
  "19 invalid state gives explicit feedback",
);
assert(
  openApproveFn.includes("Edit permission required") &&
    openDetailFn.includes("Edit permission required"),
  "20 no-permission gives explicit feedback",
);
assert(
  mainSrc.includes("Please wait for the current action to finish") &&
    openApproveFn.includes("withMutation"),
  "21 mutation-in-flight gives explicit feedback",
);
assert(
  openDetailFn.includes("showToast?.") &&
    openApproveFn.includes("showToast?.") &&
    openDetailFn.includes("openApprove(centre)") &&
    openDetailFn.includes("Validate the Cost Centre before approval"),
  "22 no silent return on recognized approve action",
);
assert(
  mainSrc.includes("openApproveFamilyRouteModal") &&
    familyApproveFn.includes("openModal"),
  "23 Route Family modal regression",
);
assert(
  familyApproveFn.includes("openApproveFamilyRouteModal") &&
    openModalFn.includes("replace"),
  "24 Family Route modal regression",
);
assert(
  productApproveFn.includes("openModal") &&
    productApproveFn.includes("data-prm-approve-route-submit"),
  "25 Product Route modal regression",
);
assert(
  subgroupSrc.includes("openModal") &&
    subgroupSrc.includes("onModal"),
  "26 Subgroup Mapping modal regression",
);
assert(
  openDetailFn.includes("data-prm-cc-validate") &&
    openEditDraftFnIncludes(ccSrc),
  "27 Cost Centre Validate/Edit regression",
);
assert(
  familyStepModalFn.includes("openModal") &&
    familyStepModalFn.includes("onModal"),
  "28 route-step modal regression",
);
assert(
  productDeltaFn.includes("openModal") &&
    productDeltaFn.includes("onModal"),
  "29 Product Delta modal regression",
);
assert(
  cc40.status === "APPROVED" &&
    cc40.cost_centre_code === "PROD_POWDER_RM_WASHING" &&
    cc40.approval_reference === cc40Ref.reference &&
    normalizePrmCostCentreValidation(cc40.validation).valid === true,
  "30 CC40 fixture remains APPROVED",
);
assert(
  cc41.status === "APPROVED" &&
    cc41.cost_centre_code === "PROD_POWDER_RM_DRYING" &&
    cc41.approval_reference ===
      buildPrmProductionCostCentreApprovalReference({
        costCentreCode: cc41.cost_centre_code,
        approvalDate: "2026-08-14",
      }).reference,
  "31 CC41 fixture remains APPROVED",
);
assert(
  thisSrc.includes("Does not approve CC40") &&
    !openApproveFn.includes("costingRpc(") &&
    openApproveFn.indexOf("RPC.approve") > openApproveFn.indexOf("onModal"),
  "32 no live approve",
);
assert(
  !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("CREATE OR REPLACE FUNCTION"),
  "33 no server files",
);
assert(
  !openApproveFn.includes("rpc_refresh") &&
    !openApproveFn.includes("requestCostingRefresh"),
  "34 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v299"/.test(swSrc),
  "35 SW bump exactly once to hub-cache-v299",
);

function openEditDraftFnIncludes(src) {
  return /function openEditDraft\(centre\)[\s\S]*?\{ replace: true \}/.test(src);
}

if (failed > 0) {
  console.error(
    `\nproduction-route-cost-centre-approve-action-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-cost-centre-approve-action-smoke: all passed");
