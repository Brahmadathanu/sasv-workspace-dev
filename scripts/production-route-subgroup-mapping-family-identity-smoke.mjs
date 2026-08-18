/**
 * Gate 11Y.10I.2C.3F.2B.3A — Subgroup Mapping Route Family identity display.
 * Client-only source/contract smoke. No live Product Subgroup mapping create.
 * Does not mutate Route Family 10 or Family Route 11. No costing refresh.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE,
  buildPrmProductSubgroupMappingOptions,
  buildPrmRouteFamilyMappingSelectOptions,
  findPrmApprovedSubgroupMapping,
  formatPrmApprovedFamilyRouteContextLabel,
  formatPrmRouteFamilyAssignmentSourceLabel,
  formatPrmRouteFamilyPrimaryLabel,
  formatPrmRouteFamilySelectorLabel,
  formatPrmRouteAssignmentSourceExplain,
  normalizePrmMasterOptions,
  resolvePrmApprovedFamilyRouteForFamily,
  resolvePrmRouteFamilyMasterIdentity,
  validatePrmSubgroupMappingCreateSelection,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { buildMapProductSubgroupToRouteFamilyArgs } from "../public/shared/js/costing-suite-production-route-rpc.js";

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
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-subgroup-mapping-family-identity-smoke.mjs",
);
const chromeSrc = read("public/shared/js/sasv-module-chrome.js");

const createFn =
  moduleSrc.match(
    /async function openCreateSubgroupMappingModal\([\s\S]*?\n  function openEditSubgroupMappingModal/,
  )?.[0] || "";
const optionFn =
  moduleSrc.match(
    /function buildRouteFamilySelectOptionsHtml\([\s\S]*?\n  function currentCreateSelectionGate/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function optionMatchesSearch(opt, term) {
  const q = String(term || "").toLowerCase();
  return String(opt.search || opt.label || "")
    .toLowerCase()
    .includes(q);
}

const aliasFamily = {
  id: 10,
  family_code: "DRY_FINE_POWDER_NO_WASH",
  family_name: "Dry Fine Powder — No-Wash",
  status: "APPROVED",
};
const approvedRoute11 = {
  id: 11,
  route_family_id: 10,
  name: "Dry Fine Powder — No-Wash Manufacturing Route",
  route_version: 1,
  status: "APPROVED",
};
const subgroup19 = {
  id: 19,
  name: "Lepa Choornam",
};
const masters = normalizePrmMasterOptions({
  product_subgroups: [subgroup19],
  route_families: [aliasFamily],
  approved_route_family_routes: [approvedRoute11],
});
const family10 = masters.route_families[0];
const identity10 = resolvePrmRouteFamilyMasterIdentity(family10);
const familyOptions = buildPrmRouteFamilyMappingSelectOptions(
  masters.route_families,
);
const subgroupOptions = buildPrmProductSubgroupMappingOptions(
  masters.product_subgroups,
);
const validGate = validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id: 19,
  route_family_id: 10,
  productSubgroups: masters.product_subgroups,
  routeFamilies: masters.route_families,
  mappings: [],
  approvedFamilyRoutes: masters.approved_route_family_routes,
});

assert(
  createFn.includes("Create Product Subgroup mapping Draft") &&
    createFn.includes("prmMapSubgroupFamilySelect") &&
    createFn.includes("enhanceSearchableSelect"),
  "1 Product Subgroup mapping modal opens",
);
assert(
  subgroupOptions[0]?.label === "Lepa Choornam" &&
    subgroupOptions[0]?.product_subgroup_id === 19 &&
    subgroupOptions[0].label !== "Product Subgroup 19",
  "2 Product Subgroup 19 displays Lepa Choornam",
);
assert(
  family10?.route_family_id === 10 &&
    identity10.resolved === true &&
    identity10.route_family_name === "Dry Fine Powder — No-Wash",
  "3 Route Family id 10 resolves governed master",
);
assert(
  identity10.primaryLabel !== "Route Family 10" &&
    identity10.compactLabel !== "Route Family 10" &&
    familyOptions[0]?.label !== "Route Family 10" &&
    familyOptions[0]?.primary !== "Route Family 10" &&
    !optionFn.includes("`Route Family ${id}`") &&
    !optionFn.includes("`Route Family ${"),
  "4 Route Family 10 generic label is absent for resolved master",
);
assert(
  identity10.route_family_code === "DRY_FINE_POWDER_NO_WASH" &&
    identity10.secondaryLabel.includes("DRY_FINE_POWDER_NO_WASH") &&
    familyOptions[0]?.search.includes("DRY_FINE_POWDER_NO_WASH"),
  "5 canonical code displayed",
);
assert(
  identity10.primaryLabel === "Dry Fine Powder — No-Wash" &&
    formatPrmRouteFamilyPrimaryLabel(family10) ===
      "Dry Fine Powder — No-Wash" &&
    formatPrmRouteFamilySelectorLabel(family10) ===
      "DRY_FINE_POWDER_NO_WASH — Dry Fine Powder — No-Wash",
  "6 canonical name displayed",
);
assert(
  identity10.status === "APPROVED" &&
    identity10.secondaryLabel.includes("Approved"),
  "7 APPROVED status available",
);

const approvedRoute = resolvePrmApprovedFamilyRouteForFamily(
  family10,
  masters.approved_route_family_routes,
);
const approvedCopy = formatPrmApprovedFamilyRouteContextLabel(approvedRoute);
assert(
  approvedRoute?.family_route_id === 11 && validGate.approvedRoute?.family_route_id === 11,
  "8 approved Family Route 11 resolved",
);
assert(
  approvedCopy.includes("Dry Fine Powder — No-Wash Manufacturing Route") &&
    moduleSrc.includes("Approved Family Route:") &&
    moduleSrc.includes("data-prm-subgroup-approved-family-route"),
  "9 approved route name displayed",
);
assert(
  approvedCopy.includes("V1") && approvedCopy.includes(" · "),
  "10 route version V1 displayed",
);
assert(
  identity10.genericIdLabel === "Route Family 10" &&
    identity10.primaryLabel !== identity10.genericIdLabel &&
    identity10.title === "Route family 10",
  "11 numeric id not primary label",
);
assert(
  optionMatchesSearch(familyOptions[0], "Dry Fine Powder") &&
    optionMatchesSearch(familyOptions[0], "No-Wash"),
  "12 search matches family name",
);
assert(
  optionMatchesSearch(familyOptions[0], "DRY_FINE_POWDER_NO_WASH") &&
    chromeSrc.includes("enhanceSearchableSelect") &&
    createFn.includes('placeholder: "Search or select Route Family"'),
  "13 search matches family code",
);
assert(
  createFn.includes("Selection alone never creates a mapping") &&
    createFn.includes('onModal(host, "change"') &&
    !/onModal\(host, "change"[\s\S]*governed\(/.test(createFn.split("onModal(host, \"click\"")[0]),
  "14 selection alone creates no mapping",
);
assert(
  createFn.includes("data-prm-map-subgroup-submit") &&
    createFn.includes("Create DRAFT") &&
    createFn.includes("currentCreateSelectionGate") &&
    moduleSrc.includes("rpc_map_product_subgroup_to_route_family") &&
    createFn.includes("RPC.mapSubgroup") &&
    buildMapProductSubgroupToRouteFamilyArgs({
      product_subgroup_id: 19,
      route_family_id: 10,
      mapping_basis: "MANUAL",
    }).ok,
  "15 Create DRAFT remains explicit mutation",
);

const unresolvedGate = validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id: 19,
  route_family_id: 99,
  productSubgroups: masters.product_subgroups,
  routeFamilies: [
    { route_family_id: 99, status: "APPROVED" },
  ],
  mappings: [],
  approvedFamilyRoutes: masters.approved_route_family_routes,
});
assert(
  unresolvedGate.ok === false &&
    unresolvedGate.reasons.some((reason) => reason.code === "route_family_unresolved") &&
    unresolvedGate.identity.primaryLabel === PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE &&
    moduleSrc.includes("data-prm-subgroup-family-unresolved") &&
    createFn.includes("disabled"),
  "16 unresolved Route Family blocks create",
);

const unapprovedGate = validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id: 19,
  route_family_id: 8,
  productSubgroups: masters.product_subgroups,
  routeFamilies: [
    {
      route_family_id: 8,
      route_family_code: "DRAFT_FAM",
      route_family_name: "Draft Family",
      status: "DRAFT",
    },
  ],
  mappings: [],
  approvedFamilyRoutes: [],
});
assert(
  unapprovedGate.ok === false &&
    unapprovedGate.reasons.some((reason) => reason.code === "route_family_unapproved"),
  "17 unapproved Route Family blocks create",
);

const staleGate = validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id: 19,
  route_family_id: 10,
  productSubgroups: masters.product_subgroups,
  routeFamilies: [
    {
      route_family_id: 7,
      route_family_code: "OTHER",
      route_family_name: "Other Family",
      status: "APPROVED",
    },
  ],
  mappings: [],
  approvedFamilyRoutes: masters.approved_route_family_routes,
});
assert(
  staleGate.ok === false &&
    staleGate.reasons.some((reason) => reason.code === "stale_route_family") &&
    validGate.ok === true,
  "18 stale Route Family selection blocks create",
);

const writableGate = validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id: 19,
  route_family_id: 10,
  productSubgroups: masters.product_subgroups,
  routeFamilies: masters.route_families,
  mappings: [
    {
      mapping_id: 44,
      product_subgroup_id: 19,
      status: "DRAFT",
      route_family_id: 10,
    },
  ],
  approvedFamilyRoutes: masters.approved_route_family_routes,
});
assert(
  writableGate.writable?.mapping_id === 44 &&
    writableGate.ok === false &&
    writableGate.reasons.some((reason) => reason.code === "writable_exists") &&
    moduleSrc.includes("A replacement mapping already exists") &&
    moduleSrc.includes("Open existing mapping") &&
    createFn.includes("earlyWritable"),
  "19 duplicate writable mapping handling preserved",
);

const replacementGate = validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id: 19,
  route_family_id: 10,
  productSubgroups: masters.product_subgroups,
  routeFamilies: masters.route_families,
  mappings: [
    {
      mapping_id: 3,
      product_subgroup_id: 19,
      status: "APPROVED",
      route_family_id: 9,
    },
  ],
  approvedFamilyRoutes: masters.approved_route_family_routes,
});
assert(
  findPrmApprovedSubgroupMapping(
    [
      {
        mapping_id: 3,
        product_subgroup_id: 19,
        status: "APPROVED",
      },
    ],
    19,
  )?.mapping_id === 3 &&
    replacementGate.ok === true &&
    replacementGate.requiresApprovedReplacement === true &&
    moduleSrc.includes("Create replacement") &&
    moduleSrc.includes("will supersede the currently effective Product Subgroup mapping"),
  "20 approved-replacement workflow preserved",
);
assert(
  rpcSrc.includes("rpc_map_product_group_to_route_family") &&
    mainSrc.includes("buildMapProductGroupToRouteFamilyArgs") &&
    !createFn.includes("rpc_map_product_group_to_route_family"),
  "21 Product Group mapping regression unchanged",
);
assert(
  rpcSrc.includes("rpc_create_product_route_family_assignment_draft") &&
    mainSrc.includes("buildCreateProductRouteFamilyAssignmentDraftArgs") &&
    !createFn.includes("rpc_create_product_route_family_assignment_draft"),
  "22 direct Product Assignment regression unchanged",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_ASSIGNMENT") ===
    "Product-specific assignment" &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
      "Inherited from Product Subgroup" &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_GROUP_FALLBACK") ===
      "Inherited from Product Group" &&
    formatPrmRouteAssignmentSourceExplain("PRODUCT_ASSIGNMENT").includes(
      "overrides Product Subgroup and Product Group",
    ) &&
    formatPrmRouteAssignmentSourceExplain("PRODUCT_SUBGROUP_FALLBACK").includes(
      "inherited from the Product Subgroup mapping",
    ) &&
    formatPrmRouteAssignmentSourceExplain("PRODUCT_GROUP_FALLBACK").includes(
      "inherited from the Product Group mapping",
    ),
  "23 resolver precedence unchanged",
);
const importBlock = thisSrc.slice(0, thisSrc.indexOf("const root"));
const mapArgs = buildMapProductSubgroupToRouteFamilyArgs({
  product_subgroup_id: 19,
  route_family_id: 10,
  mapping_basis: "MANUAL",
});
assert(
  thisSrc.includes("No live Product Subgroup mapping create") &&
    thisSrc.includes("Does not mutate Route Family 10") &&
    !importBlock.includes("supabase") &&
    !importBlock.includes("createClient"),
  "24 no live mapping created in smoke",
);
assert(
  !rpcSrc.includes("PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE") &&
    Number(mapArgs.params.p_route_family_id) === 10 &&
    Number(mapArgs.params.p_product_subgroup_id) === 19 &&
    !helpersSrc.includes("apply_migration") &&
    !moduleSrc.includes(".sql"),
  "25 no server files",
);
assert(
  !createFn.includes("costing refresh") &&
    !createFn.includes("rpc_refresh") &&
    moduleSrc.includes("does not trigger costing refresh"),
  "26 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc) &&
    htmlSrc.includes("data-prm-subgroup-family-context"),
  "27 SW cache name present (bump owned by later gates)",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-subgroup-mapping-family-identity-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-subgroup-mapping-family-identity-smoke: all passed",
);
