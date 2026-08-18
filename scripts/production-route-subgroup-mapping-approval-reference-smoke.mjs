/**
 * Gate 11Y.10I.2C.3F.2B.3C — Subgroup Mapping canonical approval reference.
 * Client-only source/contract smoke. Does not approve Mapping ID 1.
 * No live Subgroup create/edit/submit/approve/inactivate. No costing refresh.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmMappingApprovalReferenceTemplate,
  buildPrmProductSubgroupMappingApprovalReference,
  getPrmLocalIsoDate,
  PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_RE,
  resolvePrmProductSubgroupMappingApprovalIdentity,
  validatePrmProductSubgroupMappingApprovalReference,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { buildApproveProductSubgroupMappingArgs } from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const moduleSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-subgroup-mapping-approval-reference-smoke.mjs",
);
const registerRefreshSmokeSrc = read(
  "scripts/production-route-subgroup-mapping-register-refresh-smoke.mjs",
);

const approveFn =
  moduleSrc.match(
    /function openApproveSubgroupMappingModal\([\s\S]*?\n  function openInactivateSubgroupMappingModal/,
  )?.[0] || "";
const helperFn =
  helpersSrc.match(
    /export function buildPrmProductSubgroupMappingApprovalReference\([\s\S]*?\nexport function validatePrmProductSubgroupMappingApprovalReference/,
  )?.[0] || "";
const validateFn =
  helpersSrc.match(
    /export function validatePrmProductSubgroupMappingApprovalReference\([\s\S]*?\nexport function buildPrmFamilyRouteApprovalReferenceTemplate/,
  )?.[0] || "";
const refreshHelperFn =
  moduleSrc.match(
    /async function refreshSubgroupMappingsAfterMutation\([\s\S]*?\n  function buildSubgroupRowActionsHtml/,
  )?.[0] || "";
const importBlock = thisSrc.slice(0, thisSrc.indexOf("const root"));

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const mapping1 = {
  mapping_id: 1,
  product_subgroup_id: 19,
  product_subgroup_name: "Lepa Choornam",
  route_family_id: 10,
  route_family_code: "DRY_FINE_POWDER_NO_WASH",
  status: "IN_REVIEW",
  effective_from: "2026-08-13",
  approval_reference: null,
  approved_at: null,
};

const identity = resolvePrmProductSubgroupMappingApprovalIdentity({
  mapping: mapping1,
  routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
  productSubgroupId: 19,
});
const generated = buildPrmProductSubgroupMappingApprovalReference({
  routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
  productSubgroupId: 19,
  approvalDate: "2026-08-13",
});
const pgTemplate = buildPrmMappingApprovalReferenceTemplate(
  "DRY_FINE_POWDER_NO_WASH",
  19,
  "2026-08-13",
);

assert(
  mapping1.mapping_id === 1 &&
    mapping1.status === "IN_REVIEW" &&
    mapping1.approval_reference == null &&
    mapping1.approved_at == null,
  "1 Mapping ID 1 fixture",
);
assert(
  identity.ok &&
    identity.routeFamilyCode === "DRY_FINE_POWDER_NO_WASH" &&
    generated.routeFamilyCode === "DRY_FINE_POWDER_NO_WASH",
  "2 Route Family code DRY_FINE_POWDER_NO_WASH",
);
assert(
  identity.productSubgroupId === 19 && generated.productSubgroupId === 19,
  "3 Product Subgroup id 19",
);
assert(
  generated.ok &&
    generated.reference ===
      "PRM-MAP-DRY_FINE_POWDER_NO_WASH-SG19-APP-20260813",
  "4 generated SG19 reference",
);
assert(
  pgTemplate === "PRM-MAP-DRY_FINE_POWDER_NO_WASH-PG19-APP-20260813" &&
    generated.reference !== pgTemplate &&
    !generated.reference.includes("-PG19-") &&
    !validatePrmProductSubgroupMappingApprovalReference(pgTemplate, {
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      productSubgroupId: 19,
      approvalDate: "2026-08-13",
    }).ok,
  "5 PG19 rejected",
);
assert(
  PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_RE.test(
    generated.reference,
  ) &&
    helpersSrc.includes(
      "PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_RE =",
    ) &&
    helpersSrc.includes(
      "^PRM-MAP-[A-Z][A-Z0-9_]*-SG[1-9][0-9]*-APP-[0-9]{8}$",
    ),
  "6 canonical regex",
);
assert(
  approveFn.includes("readonly: true") &&
    approveFn.includes('id: "prmApproveSubgroupRef"') &&
    approveFn.includes('subtitle: "Canonical approval reference"'),
  "7 readonly field",
);
assert(
  !approveFn.includes("PRM_APPROVAL_REFERENCE_HELPER_TEXT") &&
    !approveFn.includes("The suggested reference may be edited.") &&
    approveFn.includes(
      "PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_HELPER_TEXT",
    ) &&
    PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_HELPER_TEXT.includes(
      "Product Subgroup identity",
    ),
  "8 editable helper text removed",
);
assert(
  approveFn.includes("getPrmLocalIsoDate()") &&
    helperFn.includes("getPrmLocalIsoDate()") &&
    typeof getPrmLocalIsoDate === "function",
  "9 local approval-event date",
);
assert(
  !approveFn.includes("approvalDate: mapping.effective_from") &&
    !approveFn.includes("approvalDate: currentMapping.effective_from") &&
    helpersSrc.includes("not effective_from") &&
    buildPrmProductSubgroupMappingApprovalReference({
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      productSubgroupId: 19,
      approvalDate: "2026-08-14",
    }).reference === "PRM-MAP-DRY_FINE_POWDER_NO_WASH-SG19-APP-20260814",
  "10 Effective From not used for reference date",
);
assert(
  !generated.reference.includes("-1-") &&
    !generated.reference.includes("SG1-") &&
    !/-MAP1-/.test(generated.reference) &&
    !approveFn.includes("mapping_id}") &&
    !helperFn.includes("mapping_id"),
  "11 mapping id not embedded",
);
assert(
  !generated.reference.includes("SG10") &&
    !generated.reference.includes("-10-") &&
    !generated.reference.includes("RF10"),
  "12 Route Family numeric id not embedded",
);
assert(
  !generated.reference.includes("-PG") &&
    !approveFn.includes("buildPrmMappingApprovalReferenceTemplate") &&
    mainSrc.includes("buildPrmMappingApprovalReferenceTemplate"),
  "13 Product Group id not used",
);
assert(
  approveFn.includes("const recomputed = buildPrmProductSubgroupMappingApprovalReference") &&
    approveFn.includes("approvalDate: getPrmLocalIsoDate()") &&
    approveFn.includes("approvalDate") &&
    approveFn.includes("resolvePrmProductSubgroupMappingApprovalIdentity"),
  "14 pre-RPC recompute",
);
assert(
  approveFn.includes("approval_reference: recomputed.reference") &&
    !approveFn.includes(
      'approval_reference: host.querySelector(\n                  "#prmApproveSubgroupRef",\n                )?.value',
    ) &&
    !approveFn.includes(
      'approval_reference: host.querySelector("#prmApproveSubgroupRef")?.value',
    ) &&
    !/#prmApproveSubgroupRef[\s\S]*?\.value/.test(
      approveFn.slice(approveFn.indexOf("await withMutation")),
    ),
  "15 DOM value ignored",
);
assert(
  !buildPrmProductSubgroupMappingApprovalReference({
    routeFamilyCode: null,
    productSubgroupId: 19,
    approvalDate: "2026-08-13",
  }).ok &&
    resolvePrmProductSubgroupMappingApprovalIdentity({
      productSubgroupId: 19,
    }).reason === "missing_route_family_code",
  "16 missing Route Family code blocks",
);
assert(
  !buildPrmProductSubgroupMappingApprovalReference({
    routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
    productSubgroupId: null,
    approvalDate: "2026-08-13",
  }).ok &&
    resolvePrmProductSubgroupMappingApprovalIdentity({
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
    }).reason === "missing_product_subgroup_id",
  "17 missing Subgroup id blocks",
);
assert(
  !validatePrmProductSubgroupMappingApprovalReference(
    "PRM-MAP-DRY_FINE_POWDER_NO_WASH-SG19-APP-20260101",
    {
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      productSubgroupId: 19,
      approvalDate: "2026-08-13",
    },
  ).ok &&
    !validatePrmProductSubgroupMappingApprovalReference("NOT-CANONICAL", {
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      productSubgroupId: 19,
      approvalDate: "2026-08-13",
    }).ok &&
    validateFn.includes("invalid_format"),
  "18 invalid generated reference blocks",
);
assert(
  buildApproveProductSubgroupMappingArgs({
    mapping_id: 1,
    approval_reference: generated.reference,
    effective_from: "2026-08-13",
  }).ok &&
    rpcSrc.includes("rpc_approve_product_subgroup_route_family_mapping") &&
    approveFn.includes("buildApproveProductSubgroupMappingArgs"),
  "19 existing approve RPC contract unchanged",
);
assert(
  refreshHelperFn.includes("await loadSubgroupMappings({ resetOffset: false })") &&
    approveFn.includes("refreshSubgroupMappingsAfterMutation") &&
    registerRefreshSmokeSrc.includes("refreshSubgroupMappingsAfterMutation"),
  "20 register-refresh helper unchanged",
);
assert(
  mainSrc.includes("buildPrmMappingApprovalReferenceTemplate") &&
    buildPrmMappingApprovalReferenceTemplate(
      "DRY_FINE_POWDER_NO_WASH",
      12,
      "2026-08-13",
    ) === "PRM-MAP-DRY_FINE_POWDER_NO_WASH-PG12-APP-20260813" &&
    !approveFn.includes("buildPrmMappingApprovalReferenceTemplate"),
  "21 Product Group mapping regression unchanged",
);
assert(
  thisSrc.includes("Does not approve Mapping ID 1") &&
    thisSrc.includes("No live Subgroup") &&
    !importBlock.includes("supabase") &&
    !importBlock.includes("createClient"),
  "22 no live approval",
);
assert(
  thisSrc.includes("Does not approve Mapping ID 1") &&
    mapping1.approval_reference == null &&
    mapping1.approved_at == null &&
    !importBlock.includes("costingRpc") &&
    !importBlock.includes("@supabase"),
  "23 Mapping ID 1 unchanged",
);
assert(
  !rpcSrc.includes("buildPrmProductSubgroupMappingApprovalReference") &&
    !rpcSrc.includes("PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_RE"),
  "24 no server files",
);
assert(
  !approveFn.includes("rpc_refresh") &&
    !approveFn.includes("markCostingRefreshDirty") &&
    !helperFn.includes("costing refresh"),
  "25 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "26 SW cache name present (bump owned by later gates)",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-subgroup-mapping-approval-reference-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-subgroup-mapping-approval-reference-smoke: all passed",
);
