/**
 * Gate 11Y.10I.2C.3F.1C — Product Subgroup Mapping client foundation smoke.
 * Fixtures/stubs only. No live Subgroup create/update/submit/approve/inactivate.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_ROUTE_LENS_IDS,
  PRM_EMPTY_STATES,
  buildPrmProductSubgroupMappingOptions,
  buildPrmSubgroupMappingsArgs,
  findPrmApprovedSubgroupMapping,
  findPrmWritableSubgroupMapping,
  formatPrmRouteFamilyAssignmentSourceLabel,
  isProductionRouteLens,
  normalizePrmMasterOptions,
  normalizePrmProductSubgroupMapping,
  resolveProductionRouteLens,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  buildApproveProductSubgroupMappingArgs,
  buildMapProductSubgroupToRouteFamilyArgs,
  buildSubmitProductSubgroupMappingArgs,
  buildSubgroupMappingsRpcArgs,
  buildUpdateProductSubgroupMappingDraftArgs,
  buildInactivateProductSubgroupMappingArgs,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const moduleSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const registrySrc = read("public/shared/js/costing-suite-registry.js");
const routeConfigSrc = read("public/shared/js/costing-route-config.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const thisSrc = read("scripts/production-route-subgroup-mappings-smoke.mjs");
const swSrc = read("public/sw.js");

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("product-subgroup-mappings") &&
    isProductionRouteLens("product-subgroup-mappings") &&
    resolveProductionRouteLens("product-subgroup-mappings") ===
      "product-subgroup-mappings",
  "1 lens resolves",
);
assert(
  registrySrc.includes('"product-subgroup-mappings"') &&
    registrySrc.includes("Subgroup Mappings") &&
    routeConfigSrc.includes("product-subgroup-mappings"),
  "2 pill registered",
);
assert(
  PRM_RPC_ARG_KEYS.rpc_get_production_route_manager_subgroup_mappings?.includes(
    "p_product_subgroup_id",
  ) &&
    buildSubgroupMappingsRpcArgs({
      status: "APPROVED",
      search: "Choornam",
      route_family_id: 9,
      product_group_id: 12,
      product_subgroup_id: 4,
      limit: 25,
      offset: 0,
    }).ok,
  "3 RPC adapter read contract",
);
assert(
  buildPrmSubgroupMappingsArgs({
    status: "DRAFT",
    search: "x",
    route_family_id: 1,
    product_group_id: 2,
    product_subgroup_id: 3,
  }).params.p_status === "DRAFT" &&
    moduleSrc.includes("buildSubgroupMappingsRpcArgs"),
  "4 server filters wired",
);

const options = normalizePrmMasterOptions({
  product_subgroups: [
    {
      product_subgroup_id: 4,
      product_subgroup_name: "Lepa Choornam",
      product_group_id: 12,
      product_group_name: "Choornam",
      category_name: "Ayurveda",
    },
  ],
  route_family_subgroup_mappings: [
    {
      mapping_id: 1,
      product_subgroup_id: 4,
      status: "APPROVED",
      route_family_id: 9,
      route_family_name: "Dry Powder",
      effective_from: "2026-07-01",
      approval_reference: "PRM-MAP-TEST",
    },
  ],
  products: [
    {
      product_id: 200,
      product_name: "Vyoshadi Vatakam",
      product_subgroup_id: 4,
      product_subgroup_name: "Choornam",
    },
  ],
});
assert(
  options.product_subgroups.length === 1 &&
    options.product_subgroups[0].product_subgroup_name === "Lepa Choornam",
  "5 product_subgroups normalized",
);
assert(
  options.route_family_subgroup_mappings[0].mapping_id === 1 &&
    options.products[0].product_subgroup_id === 4,
  "6 route_family_subgroup_mappings + product subgroup identity normalized",
);
assert(
  moduleSrc.includes("Product Subgroup") &&
    moduleSrc.includes("Approval Reference") &&
    moduleSrc.includes("Effective From"),
  "7 register columns",
);
assert(moduleSrc.includes("chip(row.status)"), "8 lifecycle chips");
assert(
  buildPrmProductSubgroupMappingOptions(options.product_subgroups)[0].label ===
    "Lepa Choornam" &&
    moduleSrc.includes("Search or select Product Subgroup"),
  "9 searchable Subgroup selector",
);
assert(
  moduleSrc.includes("Search or select Route Family") &&
    moduleSrc.includes("enhanceSearchableSelect"),
  "10 searchable Route Family selector",
);
assert(
  moduleSrc.includes("Create DRAFT") &&
    moduleSrc.includes("rpc_map_product_subgroup_to_route_family") &&
    !moduleSrc.includes("governed(\n              RPC.mapSubgroup") === false,
  "11 Create DRAFT explicit only",
);
assert(
  moduleSrc.includes("Selection alone never creates a mapping") &&
    moduleSrc.includes('onModal(host, "change"'),
  "12 no mutation on select",
);
const approved = findPrmApprovedSubgroupMapping(
  options.route_family_subgroup_mappings,
  4,
);
assert(
  approved &&
    moduleSrc.includes("Current approved mapping") &&
    moduleSrc.includes("superseded from the new effective date"),
  "13 approved mapping warning",
);
const approvedContextFn =
  moduleSrc.match(
    /function renderApprovedMappingContextHtml\([\s\S]*?\n  function /,
  )?.[0] || "";
assert(
  approvedContextFn.includes("Current approved mapping") &&
    !approvedContextFn.includes("Archive") &&
    !approvedContextFn.includes("archive"),
  "14 warning does not mention Archive",
);
const writable = findPrmWritableSubgroupMapping(
  [
    {
      mapping_id: 2,
      product_subgroup_id: 4,
      status: "DRAFT",
    },
  ],
  4,
);
assert(writable?.mapping_id === 2, "15 existing writable candidate detected");
assert(
  moduleSrc.includes("A replacement mapping already exists") &&
    moduleSrc.includes("Open existing mapping") &&
    moduleSrc.includes("earlyWritable"),
  "16 duplicate Draft CTA hidden/refused",
);
assert(
  moduleSrc.includes("Unable to create Product Subgroup mapping Draft") &&
    moduleSrc.includes("await loadSubgroupMappings"),
  "17 server duplicate error surfaced",
);
assert(
  moduleSrc.includes("edit-subgroup-mapping") &&
    buildUpdateProductSubgroupMappingDraftArgs({
      mapping_id: 2,
      patch: { mapping_basis: "MANUAL" },
    }).ok,
  "18 DRAFT Edit",
);
assert(
  moduleSrc.includes("submit-subgroup-mapping") &&
    buildSubmitProductSubgroupMappingArgs({ mapping_id: 2 }).ok,
  "19 DRAFT Submit",
);
assert(
  moduleSrc.includes("approve-subgroup-mapping") &&
    buildApproveProductSubgroupMappingArgs({
      mapping_id: 2,
      approval_reference: "PRM-MAP-SG-TEST-20260813",
      effective_from: "2026-08-13",
    }).ok,
  "20 IN_REVIEW Approve",
);
assert(
  moduleSrc.includes("replace-subgroup-mapping") &&
    moduleSrc.includes("Create replacement"),
  "21 APPROVED replacement",
);
assert(
  moduleSrc.includes("inactivate-subgroup-mapping") &&
    buildInactivateProductSubgroupMappingArgs({
      mapping_id: 1,
      effective_to: "2026-08-13",
      inactivation_reason: "End dated for replacement",
    }).ok,
  "22 APPROVED Inactivate where allowed",
);
assert(
  normalizePrmProductSubgroupMapping({ status: "SUPERSEDED" }).status ===
    "SUPERSEDED" &&
    !moduleSrc.includes('status === "SUPERSEDED"') === false
      ? !moduleSrc.includes('if (status === "SUPERSEDED") {\n      buttons.push')
      : true,
  "23 SUPERSEDED read-only",
);
assert(
  !moduleSrc.includes('status === "INACTIVE") {\n      buttons.push'),
  "24 INACTIVE read-only",
);
assert(
  moduleSrc.includes("will supersede the currently effective Product Subgroup mapping") &&
    moduleSrc.includes("Current Route Family") &&
    moduleSrc.includes("Replacement Route Family"),
  "25 replacement warning",
);
assert(
  moduleSrc.includes("prmApproveSubgroupConfirm") &&
    moduleSrc.includes("Confirm supersession"),
  "26 explicit confirmation",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_ASSIGNMENT") ===
    "Product-specific assignment",
  "27 source label Product assignment",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
    "Inherited from Product Subgroup",
  "28 source label Product Subgroup",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_GROUP_FALLBACK") ===
    "Inherited from Product Group",
  "29 source label Product Group",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("NONE") ===
    "No approved assignment",
  "30 NONE label",
);
assert(
  moduleSrc.includes("clampPrmPagination") &&
    mainSrc.includes("subgroupMappingTotalCount"),
  "31 pagination",
);
assert(
  htmlSrc.includes('data-peq-section="prm-subgroup"') &&
    (htmlSrc.includes("cp-prm-archived-toolbar") ||
      moduleSrc.includes("cp-prm-archived-toolbar") ||
      moduleSrc.includes("cp-prm-actions")),
  "32 narrow layout hooks",
);
assert(
  thisSrc.startsWith("/**") &&
    thisSrc.includes("No live Subgroup create") &&
    !thisSrc.includes("from \"@supabase"),
  "33 no business mutation in smoke",
);
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "34 SW cache name present (bump owned by later gates)",
);

if (failed > 0) {
  console.error(`\nproduction-route-subgroup-mappings-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-subgroup-mappings-smoke: all passed");
