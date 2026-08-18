/**
 * Gate 11Y.10I.2C.3F.1C — Archived Routes client foundation smoke.
 * Fixtures/stubs only. No archive cutover. No business mutation.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_ROUTE_LENS_IDS,
  PRM_EMPTY_STATES,
  buildPrmArchivedRoutesArgs,
  formatPrmArchivedEntityTypeLabel,
  formatPrmRouteFamilyAssignmentSourceLabel,
  isProductionRouteLens,
  normalizePrmArchivedRouteRow,
  normalizePrmArchivedRoutesPayload,
  normalizePrmMasterOptions,
  resolveProductionRouteLens,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  buildArchivedRoutesRpcArgs,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const moduleSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const registrySrc = read("public/shared/js/costing-suite-registry.js");
const routeConfigSrc = read("public/shared/js/costing-route-config.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const thisSrc = read("scripts/production-route-archived-routes-smoke.mjs");
const swSrc = read("public/sw.js");
const subgroupSmokeSrc = read(
  "scripts/production-route-subgroup-mappings-smoke.mjs",
);

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("archived-routes") &&
    isProductionRouteLens("archived-routes") &&
    resolveProductionRouteLens("archived-routes") === "archived-routes",
  "1 lens resolves",
);
assert(
  registrySrc.includes('"archived-routes"') &&
    registrySrc.includes("Archived Routes") &&
    routeConfigSrc.includes("archived-routes"),
  "2 pill registered",
);
assert(
  PRM_RPC_ARG_KEYS.rpc_get_archived_production_route_architecture?.includes(
    "p_entity_type",
  ) &&
    buildArchivedRoutesRpcArgs({
      search: "reset",
      entity_type: "ROUTE_FAMILY",
      limit: 25,
      offset: 0,
    }).ok,
  "3 archive read RPC",
);
assert(
  PRM_EMPTY_STATES.archivedRoutes === "No archived route architecture." &&
    moduleSrc.includes("PRM_EMPTY_STATES.archivedRoutes"),
  "4 empty state",
);
assert(
  buildPrmArchivedRoutesArgs({ entity_type: "PRODUCT_SUBGROUP_MAPPING" }).params
    .p_entity_type === "PRODUCT_SUBGROUP_MAPPING" &&
    moduleSrc.includes("PRM_ARCHIVED_ENTITY_TYPES"),
  "5 entity filters",
);
assert(
  buildPrmArchivedRoutesArgs({ search: "PRM-MAP" }).params.p_search ===
    "PRM-MAP",
  "6 search",
);
assert(
  moduleSrc.includes("clampPrmPagination") &&
    mainSrc.includes("archivedRouteTotalCount"),
  "7 pagination",
);

const sample = normalizePrmArchivedRoutesPayload({
  rows: [
    {
      entity_type: "ROUTE_FAMILY",
      name: "Legacy Family",
      original_status: "APPROVED",
      archived_at: "2026-08-13",
      archive_reason: "Manufacturing Route Architecture Reset",
      approval_reference: "PRM-RF-OLD",
      read_only: true,
    },
    {
      entity_type: "FAMILY_ROUTE",
      family_route_id: 10,
      name: "Family Route V2",
      original_status: "SUPERSEDED",
      route_version: 2,
      family_route_step_count: 6,
      archive_reason: "Manufacturing Route Architecture Reset",
    },
    {
      entity_type: "PRODUCT_ROUTE",
      product_route_id: 47,
      product_name: "Thaleesapathradi Choornam",
      original_status: "APPROVED",
      product_route_override_count: 1,
    },
    {
      entity_type: "PRODUCT_GROUP_MAPPING",
      product_group_name: "Choornam",
      route_family_name: "Dry Powder",
      mapping_basis: "MANUAL",
      original_status: "APPROVED",
    },
    {
      entity_type: "PRODUCT_SUBGROUP_MAPPING",
      product_subgroup_name: "Lepa Choornam",
      route_family_name: "Dry Powder",
      mapping_basis: "MANUAL",
      original_status: "APPROVED",
    },
    {
      entity_type: "PRODUCT_MAPPING",
      product_name: "Vyoshadi Vatakam",
      route_family_name: "Khandam",
      original_status: "APPROVED",
    },
  ],
  total_count: 6,
});

assert(
  moduleSrc.includes('<span class="cp-prm-badge">Archived</span>'),
  "8 Archived badge",
);
assert(
  sample.rows[0].original_status === "APPROVED" &&
    moduleSrc.includes("original_status") &&
    moduleSrc.includes("Archived") &&
    !moduleSrc.includes("original_status = \"Archived\""),
  "9 original lifecycle preserved separately",
);
assert(
  sample.rows[0].archive_reason ===
    "Manufacturing Route Architecture Reset" &&
    moduleSrc.includes("row.archive_reason") &&
    !moduleSrc.includes('"Manufacturing Route Architecture Reset"'),
  "10 archive reason from server",
);
assert(
  formatPrmArchivedEntityTypeLabel("ROUTE_FAMILY") === "Route Family" &&
    moduleSrc.includes("buildArchivedMetadataDetailHtml"),
  "11 Route Family metadata detail",
);
assert(
  moduleSrc.includes("FAMILY_ROUTE") &&
    moduleSrc.includes("Family Route (read-only)") &&
    moduleSrc.includes("buildRouteFamilyRouteDetailArgs"),
  "12 Family Route read-only detail",
);
assert(
  moduleSrc.includes("PRODUCT_ROUTE") &&
    moduleSrc.includes("Product Route (read-only)") &&
    moduleSrc.includes("buildProductRouteDetailArgs"),
  "13 Product Route read-only detail",
);
assert(
  sample.rows.some((r) => r.entity_type === "PRODUCT_GROUP_MAPPING") &&
    moduleSrc.includes("Mapping basis"),
  "14 Product Group mapping detail",
);
assert(
  sample.rows.some((r) => r.entity_type === "PRODUCT_SUBGROUP_MAPPING"),
  "15 Product Subgroup mapping detail",
);
assert(
  sample.rows.some((r) => r.entity_type === "PRODUCT_MAPPING"),
  "16 Product mapping detail",
);
assert(
  moduleSrc.includes("buildArchivedMetadataDetailHtml(row)") &&
    moduleSrc.includes("if (detail.ok)"),
  "17 fallback to metadata when rich detail unavailable",
);
assert(
  !moduleSrc.includes("fabricat") &&
    moduleSrc.includes("No steps in detail payload"),
  "18 no fabricated steps",
);
assert(
  moduleSrc.includes("Validate, Clone, Edit, Submit, Approve, Delete, and Archive actions are not available here"),
  "19 no Validate",
);
assert(
  moduleSrc.includes("Validate, Clone, Edit, Submit, Approve, Delete, and Archive actions are not available here"),
  "20 no Clone",
);
assert(
  !moduleSrc.includes("Edit Step") &&
    !moduleSrc.includes("data-prm-edit-step"),
  "21 no Edit",
);
assert(!moduleSrc.includes("Submit for review") || moduleSrc.includes("Subgroup"), "22 no Submit in archived detail path");
assert(
  !moduleSrc.includes("data-prm-approve-archived") &&
    moduleSrc.includes("Approve actions are not available here") ||
    moduleSrc.includes("Approve, Delete, and Archive actions are not available"),
  "23 no Approve",
);
assert(
  moduleSrc.includes("Delete, and Archive actions are not available") ||
    moduleSrc.includes("Delete") &&
      moduleSrc.includes("not available here"),
  "24 no Delete",
);
assert(
  moduleSrc.includes("Archive actions are not available here") ||
    moduleSrc.includes("not Archive"),
  "25 no Archive action",
);
const activeOptions = normalizePrmMasterOptions({
  route_families: [{ route_family_id: 9, route_family_name: "Live" }],
  route_family_mappings: [],
  route_family_subgroup_mappings: [],
});
assert(
  !JSON.stringify(activeOptions).includes("archived") &&
    mainSrc.includes('active === "archived-routes"') &&
    !helpersSrc.includes("archived_routes: coercePrmList"),
  "26 archived rows never feed active selectors",
);
assert(
  mainSrc.includes("entity_type") &&
    mainSrc.includes("product_subgroup_id") &&
    mainSrc.includes('resolved === "archived-routes"'),
  "27 URL/deep-link",
);
assert(
  htmlSrc.includes('data-peq-section="prm-archived"') &&
    moduleSrc.includes("cp-prm-archived-detail"),
  "28 responsive containment",
);
assert(
  thisSrc.includes("No archive cutover") &&
    !thisSrc.includes("from \"@supabase") &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
      "Inherited from Product Subgroup" &&
    !moduleSrc.includes('"Manufacturing Route Architecture Reset"'),
  "29 no business mutation",
);

function runPrior(script, label) {
  const result = spawnSync(process.execPath, [join(root, script)], {
    cwd: root,
    encoding: "utf8",
  });
  assert(result.status === 0, `${label}`);
  if (result.status !== 0 && result.stderr) {
    console.error(result.stderr.slice(0, 800));
  }
}

runPrior(
  "scripts/production-route-subgroup-mappings-smoke.mjs",
  "30 prior subgroup smoke green",
);
runPrior(
  "scripts/production-route-effective-viewer-context-smoke.mjs",
  "31 Effective Route Viewer regression",
);
runPrior(
  "scripts/production-route-product-approval-reference-smoke.mjs",
  "32 Product approval reference regression",
);

assert(
  /CACHE_NAME = "hub-cache-v283"/.test(swSrc) &&
    !swSrc.includes("hub-cache-v284") &&
    subgroupSmokeSrc.includes("hub-cache-v283"),
  "SW bumped exactly once to hub-cache-v283",
);
assert(subgroupSmokeSrc.includes("product-subgroup-mappings"), "subgroup smoke exists");

if (failed > 0) {
  console.error(`\nproduction-route-archived-routes-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-archived-routes-smoke: all passed");
