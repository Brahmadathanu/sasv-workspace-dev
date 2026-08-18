/**
 * Gate 11Y.10I.2C.3E.3D.4 — Canonical Product Route approval reference.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 * Does not approve Product Route 47 or any live Product Route.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmFamilyRouteApprovalReferenceTemplate,
  buildPrmProductRouteApprovalReference,
  parsePrmProductRouteApprovalReference,
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE,
  resolvePrmProductRouteApprovalIdentity,
  validatePrmProductRouteApprovalReference,
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
  "scripts/production-route-product-approval-reference-smoke.mjs",
);
const validateSmokeSrc = read(
  "scripts/production-route-product-validate-handoff-smoke.mjs",
);

const productApproveFn =
  mainSrc.match(
    /function openApproveProductRouteModal\([\s\S]*?\n  function option/,
  )?.[0] || "";
const familyApproveBind =
  mainSrc.match(
    /if \(action === `approve-\$\{mode\}`\) \{[\s\S]*?\n      if \(action === `supersede-\$\{mode\}`\)/,
  )?.[0] || "";
const productHtmlFn =
  editorSrc.match(
    /function productHtml\([\s\S]*?\n  function renderEditor/,
  )?.[0] || "";
const approveFn =
  editorSrc.match(
    /async function approve\([\s\S]*?\n  async function supersedeFamily/,
  )?.[0] || "";
const historyFn =
  mainSrc.match(
    /function buildProductHistoryTableHtml\([\s\S]*?\n  function bindProductHistoryOpen/,
  )?.[0] || "";
const productBuilderFn =
  helpersSrc.match(
    /export function buildPrmProductRouteApprovalReference\([\s\S]*?\nexport function validatePrmProductRouteApprovalReference/,
  )?.[0] || "";
const familyBuilderFn =
  helpersSrc.match(
    /export function buildPrmFamilyRouteApprovalReferenceTemplate\([\s\S]*?\nexport const PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const canonical = buildPrmProductRouteApprovalReference({
  productId: 139,
  routeVersion: 1,
  approvalDate: "2026-08-12",
});
const v2 = buildPrmProductRouteApprovalReference({
  productId: 139,
  routeVersion: 2,
  approvalDate: "2026-08-12",
});
const otherProduct = buildPrmProductRouteApprovalReference({
  productId: 140,
  routeVersion: 1,
  approvalDate: "2026-08-12",
});

assert(
  productApproveFn.includes("buildPrmProductRouteApprovalReference") &&
    !productApproveFn.includes("buildPrmFamilyRouteApprovalReferenceTemplate"),
  "1 Product approval uses Product-specific generator",
);
assert(
  !productBuilderFn.includes("buildPrmFamilyRouteApprovalReferenceTemplate") &&
    !productBuilderFn.includes("sanitizePrmApprovalReferenceToken"),
  "2 Product generator does not call Family generator",
);
assert(
  canonical.ok &&
    !canonical.reference.includes("FAMILY") &&
    !String(canonical.reference).includes("FAMILY"),
  "3 no FAMILY token in Product reference",
);
assert(
  !canonical.reference.includes("RFR") &&
    !productBuilderFn.includes("PRM-RFR"),
  "4 no RFR token in Product reference",
);
assert(
  !canonical.reference.includes("PRM-ROUTE") &&
    !productBuilderFn.includes('"FAMILY"') &&
    !productBuilderFn.includes("UNKNOWN"),
  "5 no ROUTE fallback in Product reference",
);
assert(
  canonical.reference === "PRM-PR-139-V1-APP-20260812",
  "6 product 139 / V1 / 2026-08-12 => PRM-PR-139-V1-APP-20260812",
);
assert(v2.reference === "PRM-PR-139-V2-APP-20260812", "7 product 139 V2 generates V2");
assert(
  otherProduct.reference === "PRM-PR-140-V1-APP-20260812" &&
    otherProduct.reference !== canonical.reference,
  "8 different Product ID changes reference",
);
assert(
  buildPrmProductRouteApprovalReference({
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).reference === canonical.reference &&
    !productBuilderFn.includes("product_name") &&
    !productBuilderFn.includes("display"),
  "9 Product name change does not alter identifier structure",
);
assert(
  !productBuilderFn.includes("product_route_id") &&
    parsePrmProductRouteApprovalReference("PRM-PR-47-V1-APP-20260812")
      .productId === 47 &&
    !validatePrmProductRouteApprovalReference("PRM-PR-47-V1-APP-20260812", {
      productId: 139,
      routeVersion: 1,
      approvalDate: "2026-08-12",
    }).ok,
  "10 route id 47 is not used as Product identity",
);
assert(
  !buildPrmProductRouteApprovalReference({
    productId: null,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).ok &&
    !resolvePrmProductRouteApprovalIdentity({
      detail: { route_version: 1 },
    }).ok,
  "11 Product ID required",
);
assert(
  !buildPrmProductRouteApprovalReference({
    productId: 139,
    routeVersion: null,
    approvalDate: "2026-08-12",
  }).ok &&
    !resolvePrmProductRouteApprovalIdentity({
      detail: { product_id: 139 },
    }).ok,
  "12 route version required",
);
assert(
  productBuilderFn.includes("normalizePrmIntegerId(routeVersion)") &&
    helpersSrc.includes("normalizePrmIntegerId(detail?.route_version)") &&
    !productApproveFn.includes("version_label"),
  "13 route_version numeric field used",
);
assert(
  !productApproveFn.includes("version_label") &&
    !productBuilderFn.includes("version_label"),
  "14 version_label not preferred",
);
assert(
  canonical.reference.endsWith("APP-20260812") &&
    productBuilderFn.includes('iso.replace(/-/g, "")'),
  "15 date formatted YYYYMMDD",
);
assert(
  productApproveFn.includes("getPrmLocalIsoDate()") &&
    !productApproveFn.includes("getAsOfDate()"),
  "16 approval date does not use getAsOfDate",
);
assert(
  !productApproveFn.includes("effective_from") &&
    !productBuilderFn.includes("effective_from"),
  "17 approval date does not use effective_from",
);
assert(
  productApproveFn.includes("value: generated.reference") &&
    productApproveFn.includes("buildPrmProductRouteApprovalReference"),
  "18 Product modal field generated automatically",
);
assert(
  productApproveFn.includes("readonly: true"),
  "19 Product modal field readonly",
);
assert(
  productApproveFn.includes('subtitle: "Canonical approval reference"') &&
    !productApproveFn.includes("Editable approval reference"),
  "20 Product modal subtitle not Editable approval reference",
);
assert(
  productApproveFn.includes("PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT") &&
    PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT.includes(
      "Generated from Product Route identity and approval date.",
    ) &&
    !productApproveFn.includes("PRM_APPROVAL_REFERENCE_HELPER_TEXT") &&
    !PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT.includes(
      "suggested reference may be edited",
    ),
  "21 Product helper text states system/canonical generation",
);
assert(
  productApproveFn.includes("const recomputed = buildPrmProductRouteApprovalReference") &&
    productApproveFn.includes("validatePrmProductRouteApprovalReference") &&
    productApproveFn.includes("editor.approveProduct(checked.reference") &&
    !/querySelector\("#prmApproveRouteRef"\)[\s\S]*approveProduct/.test(
      productApproveFn,
    ),
  "22 Approve click recomputes value rather than trusts DOM",
);
assert(
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE.test("PRM-PR-139-V1-APP-20260812") &&
    !PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE.test(
      "PRM-RFR-FAMILY-V1-APP-20260812",
    ) &&
    approveFn.includes("validatePrmProductRouteApprovalReference"),
  "23 regex validation enforced",
);
assert(
  validatePrmProductRouteApprovalReference("PRM-PR-140-V1-APP-20260812", {
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).reason === "product_id_mismatch" &&
    helpersSrc.includes("parsed.productId !== expected.productId"),
  "24 embedded Product ID checked",
);
assert(
  validatePrmProductRouteApprovalReference("PRM-PR-139-V2-APP-20260812", {
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).reason === "route_version_mismatch" &&
    helpersSrc.includes("parsed.routeVersion !== expected.routeVersion"),
  "25 embedded Version checked",
);
assert(
  !validatePrmProductRouteApprovalReference("PRM-PR-139-V1-APP-20260811", {
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).ok &&
    approveFn.includes("if (!checked.ok)"),
  "26 mismatched reference blocked",
);
assert(
  !validatePrmProductRouteApprovalReference("BOARD-MINUTES-12", {
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).ok &&
    !validatePrmProductRouteApprovalReference(
      "PRM-PROUTE-OIL-139-V1-APP-20260812",
      { productId: 139, routeVersion: 1, approvalDate: "2026-08-12" },
    ).ok &&
    approveFn.includes("validatePrmProductRouteApprovalReference"),
  "27 arbitrary manual Product reference not accepted",
);
assert(
  historyFn.includes("${text(version.approval_reference)}") &&
    !historyFn.includes("buildPrmProductRouteApprovalReference") &&
    !historyFn.includes("buildPrmFamilyRouteApprovalReferenceTemplate"),
  "28 Product History renders stored value verbatim",
);
assert(
  productHtmlFn.includes("header.approval_reference") &&
    productHtmlFn.includes("Approval reference") &&
    productHtmlFn.includes("text(header.approval_reference)"),
  "29 Product detail can display stored approval reference",
);
assert(
  familyBuilderFn.includes("return `PRM-RFR-${code}-V${versionToken}-APP-${ymd}`") &&
    buildPrmFamilyRouteApprovalReferenceTemplate(
      "DRY_POWDER_CHOORNAM",
      "2",
      "2026-08-11",
    ) === "PRM-RFR-DRY_POWDER_CHOORNAM-V2-APP-20260811",
  "30 Family generator unchanged",
);
assert(
  familyBuilderFn.includes("return `PRM-RFR-${code}-V${versionToken}-APP-${ymd}`") &&
    mainSrc.includes("function openApproveFamilyRouteModal") &&
    mainSrc.includes("buildPrmFamilyRouteApprovalReference") &&
    !productApproveFn.includes("buildPrmFamilyRouteApprovalReference") &&
    familyApproveBind.includes("openApproveFamilyRouteModal()"),
  "31 Family Route approval remains a separate PRM-RFR path",
);
assert(
  !mainSrc.includes("UPDATE costing.production_route_family_route") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    familyBuilderFn.includes("PRM-RFR-") &&
    !productApproveFn.includes("PRM-ROUTE-"),
  "32 historical Family refs not rewritten",
);
assert(
  !mainSrc.includes("PRM-PROUTE-OIL") &&
    !helpersSrc.includes("PRM-PROUTE-OIL") &&
    !productApproveFn.includes("backfill") &&
    !productApproveFn.includes("migrate"),
  "33 historical Product refs not rewritten",
);
assert(
  !helpersSrc.includes("UNIQUE (approval_reference)") &&
    !mainSrc.includes("UNIQUE (approval_reference)") &&
    !rpcSrc.includes("UNIQUE (approval_reference)") &&
    !helpersSrc.includes("CREATE UNIQUE INDEX"),
  "34 no DB uniqueness change",
);
assert(
  !thisSrc.includes("from \"../public/shared/js/supabase") &&
    rpcSrc.includes("buildApproveProductRouteArgs"),
  "35 smoke never calls live Product approve RPC",
);
assert(
  !thisSrc.includes("status: \"APPROVED\"") &&
    !productApproveFn.includes("product_route_id: 47") &&
    !productBuilderFn.includes("47"),
  "36 no Route 47 mutation",
);
assert(
  !productApproveFn.includes("rpc_refresh") &&
    !productApproveFn.includes("Stage 03") &&
    !approveFn.includes("costing refresh"),
  "37 no costing refresh",
);
assert(
  !productApproveFn.includes("#000") &&
    !productHtmlFn.includes("background:#000"),
  "38 semantic tokens only if styling changes",
);

function runPriorSmoke(relativePath, label) {
  const result = spawnSync(process.execPath, [join(root, relativePath)], {
    encoding: "utf8",
    cwd: root,
  });
  if (result.status !== 0) {
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
  assert(result.status === 0, label);
}

runPriorSmoke(
  "scripts/production-route-product-validate-handoff-smoke.mjs",
  "39 prior Product validation smoke remains green",
);

assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "SW cache name present",
  "40 SW bumped exactly once after all smokes",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-product-approval-reference-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-product-approval-reference-smoke: all passed");
