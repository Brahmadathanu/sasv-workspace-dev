/**
 * Gate 11Y.10I.2C.3F.2B.3E — Subgroup Mapping compact register + row detail.
 * Client-only source/contract smoke. Does not mutate Mapping ID 1.
 * No live Product Subgroup mapping create/edit/submit/approve/inactivate.
 * No costing refresh. No server files.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmProductSubgroupMappingApprovalReference,
  formatPrmRouteFamilyAssignmentSourceLabel,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const moduleSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-subgroup-mapping-compact-register-smoke.mjs",
);
const registerRefreshSmokeSrc = read(
  "scripts/production-route-subgroup-mapping-register-refresh-smoke.mjs",
);
const approvalRefSmokeSrc = read(
  "scripts/production-route-subgroup-mapping-approval-reference-smoke.mjs",
);

const renderFn =
  moduleSrc.match(
    /function renderSubgroupMappings\(\) \{[\s\S]*?\n  function buildSubgroupSelectOptionsHtml/,
  )?.[0] || "";
const detailFn =
  moduleSrc.match(
    /function openSubgroupMappingDetailModal\([\s\S]*?\n  function renderSubgroupMappings/,
  )?.[0] || "";
const actionsFn =
  moduleSrc.match(
    /function buildSubgroupRowActionsHtml\([\s\S]*?\n  function setSubgroupDetailWideModal/,
  )?.[0] || "";
const dispatchFn =
  moduleSrc.match(
    /function dispatchSubgroupMappingAction\([\s\S]*?\n  function openSubgroupMappingDetailModal/,
  )?.[0] || "";
const refreshHelperFn =
  moduleSrc.match(
    /async function refreshSubgroupMappingsAfterMutation\([\s\S]*?\n  function buildSubgroupRowActionsHtml/,
  )?.[0] || "";
const approveFn =
  moduleSrc.match(
    /function openApproveSubgroupMappingModal\([\s\S]*?\n  function openInactivateSubgroupMappingModal/,
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

const headerBlock =
  renderFn.match(/host\.tableHead\.innerHTML = `[\s\S]*?`;/)?.[0] || "";
const expectedHeaders = [
  "Product Subgroup",
  "Product Group",
  "Route Family",
  "Status",
  "Effective From",
  "Basis",
];
assert(
  expectedHeaders.every((label) => headerBlock.includes(`<th>${label}</th>`)) &&
    (headerBlock.match(/<th>/g) || []).length === 6,
  "1 compact register headers exactly expected",
);
assert(
  !headerBlock.includes("Actions") && !renderFn.includes("<th>Actions</th>"),
  "2 Actions column absent",
);
assert(
  !headerBlock.includes("Effective To") &&
    !renderFn.includes("<th>Effective To</th>"),
  "3 Effective To absent from register",
);
assert(
  !headerBlock.includes("Approval Reference") &&
    !renderFn.includes("<th>Approval Reference</th>"),
  "4 Approval Reference absent from register",
);
assert(headerBlock.includes("<th>Product Subgroup</th>"), "5 Product Subgroup retained");
assert(headerBlock.includes("<th>Product Group</th>"), "6 Product Group retained");
assert(headerBlock.includes("<th>Route Family</th>"), "7 Route Family retained");
assert(headerBlock.includes("<th>Status</th>"), "8 Status retained");
assert(headerBlock.includes("<th>Effective From</th>"), "9 Effective From retained");
assert(headerBlock.includes("<th>Basis</th>"), "10 Basis retained");
assert(
  renderFn.includes('tabindex="0"') &&
    renderFn.includes('role="button"') &&
    renderFn.includes("cp-prm-subgroup-mapping-row") &&
    renderFn.includes("data-prm-subgroup-mapping-row"),
  "11 row carries open-detail affordance",
);
assert(
  renderFn.includes('on(host.tableBody, "click"') &&
    renderFn.includes("openSubgroupMappingDetailModal"),
  "12 row click opens detail",
);
assert(
  renderFn.includes('event.key !== "Enter"') &&
    renderFn.includes("openSubgroupMappingDetailModal"),
  "13 Enter opens",
);
assert(
  renderFn.includes('event.key !== " "') &&
    renderFn.includes("openRow"),
  "14 Space opens",
);
assert(
  renderFn.includes(
    'event.target.closest("button,a,input,select,textarea,label")',
  ),
  "15 nested interactive target does not double-open",
);
assert(
  !renderFn.includes("await governed") &&
    !renderFn.includes("RPC.") &&
    detailFn.includes("openModal") &&
    !detailFn.includes("await governed"),
  "16 opening row causes no mutation",
);
assert(detailFn.includes("Mapping ID"), "17 detail shows Mapping ID");
assert(
  detailFn.includes("Product Subgroup") && detailFn.includes("subgroupName"),
  "18 detail shows Subgroup",
);
assert(detailFn.includes("Product Group"), "19 detail shows Group");
assert(detailFn.includes("Route Family"), "20 detail shows Route Family");
assert(detailFn.includes("Effective From"), "21 detail shows Effective From");
assert(detailFn.includes("Effective To"), "22 detail shows Effective To");
assert(detailFn.includes("Basis"), "23 detail shows Basis");
assert(
  detailFn.includes("Approval Reference") &&
    detailFn.includes("data-prm-subgroup-detail-approval-reference") &&
    detailFn.includes("mapping.approval_reference"),
  "24 detail shows Approval Reference verbatim",
);
assert(
  actionsFn.includes('status === "DRAFT"') &&
    actionsFn.includes("Edit") &&
    actionsFn.includes("Submit for review"),
  "25 DRAFT actions correct",
);
assert(
  actionsFn.includes('status === "IN_REVIEW"') &&
    actionsFn.includes("Approve"),
  "26 IN_REVIEW actions correct",
);
assert(
  actionsFn.includes('status === "APPROVED"') &&
    actionsFn.includes("Create replacement") &&
    actionsFn.includes("Inactivate"),
  "27 APPROVED actions correct",
);
assert(
  !actionsFn.includes("SUPERSEDED") &&
    detailFn.includes("data-prm-subgroup-detail-readonly") &&
    detailFn.includes("No lifecycle actions for this mapping status"),
  "28 SUPERSEDED read-only",
);
assert(
  !actionsFn.includes("INACTIVE") &&
    detailFn.includes("data-prm-subgroup-detail-readonly"),
  "29 INACTIVE read-only",
);
assert(
  renderFn.includes("Create DRAFT") &&
    renderFn.includes("data-prm-create-subgroup-mapping") &&
    renderFn.includes("openCreateSubgroupMappingModal"),
  "30 Create DRAFT toolbar retained",
);
assert(
  !detailFn.includes("state.search") &&
    !detailFn.includes("state.activeLens") &&
    !detailFn.includes("subgroup_mapping_status") &&
    !detailFn.includes("location.hash") &&
    !detailFn.includes("URLSearchParams"),
  "31 detail close preserves filters",
);
assert(
  !detailFn.includes('activeLens =') &&
    !detailFn.includes("setActiveLens") &&
    moduleSrc.includes('activeLens === "product-subgroup-mappings"'),
  "32 detail close preserves lens",
);
assert(
  dispatchFn.includes("openEditSubgroupMappingModal") &&
    dispatchFn.includes("openSubmitSubgroupMappingModal") &&
    dispatchFn.includes("openApproveSubgroupMappingModal") &&
    dispatchFn.includes("openCreateSubgroupMappingModal") &&
    dispatchFn.includes("openInactivateSubgroupMappingModal") &&
    !detailFn.includes("closeModal({ restorePrevious: false })") &&
    detailFn.includes("dispatchSubgroupMappingAction") &&
    moduleSrc.includes("subgroupLifecycleModalOpts"),
  "33 existing lifecycle modals reused with nested handoff",
);
assert(
  refreshHelperFn.includes("loadSubgroupMappings") &&
    refreshHelperFn.includes("onRegisterRefreshed") &&
    registerRefreshSmokeSrc.includes("refreshSubgroupMappingsAfterMutation") &&
    !refreshHelperFn.includes("fabricat"),
  "34 Gate 3B refresh helper unchanged",
);
assert(
  helpersSrc.includes("buildPrmProductSubgroupMappingApprovalReference") &&
    approveFn.includes("buildPrmProductSubgroupMappingApprovalReference") &&
    buildPrmProductSubgroupMappingApprovalReference({
      routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
      productSubgroupId: 19,
      approvalDate: "2026-08-14",
    }).reference ===
      "PRM-MAP-DRY_FINE_POWDER_NO_WASH-SG19-APP-20260814" &&
    approvalRefSmokeSrc.includes(
      "PRM-MAP-DRY_FINE_POWDER_NO_WASH-SG19-APP-20260814",
    ),
  "35 Gate 3C canonical approval reference unchanged",
);
assert(
  rpcSrc.includes("rpc_map_product_group_to_route_family") &&
    mainSrc.includes("buildMapProductGroupToRouteFamilyArgs") &&
    !detailFn.includes("rpc_map_product_group_to_route_family") &&
    !renderFn.includes("rpc_map_product_group_to_route_family"),
  "36 Product Group mapping unchanged",
);
assert(
  rpcSrc.includes("rpc_create_product_route_family_assignment_draft") &&
    mainSrc.includes("buildCreateProductRouteFamilyAssignmentDraftArgs") &&
    !detailFn.includes("rpc_create_product_route_family_assignment_draft"),
  "37 Product Assignment unchanged",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_ASSIGNMENT") ===
    "Product-specific assignment" &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
      "Inherited from Product Subgroup" &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_GROUP_FALLBACK") ===
      "Inherited from Product Group" &&
    helpersSrc.includes("overrides Product Subgroup and Product Group"),
  "38 resolver precedence unchanged",
);
assert(
  thisSrc.includes("Does not mutate Mapping ID 1") &&
    thisSrc.includes("No live Product Subgroup mapping") &&
    !importBlock.includes("supabase") &&
    !importBlock.includes("buildApproveProductSubgroupMappingArgs"),
  "39 no live mutation",
);
assert(
  !rpcSrc.includes("openSubgroupMappingDetailModal") &&
    !rpcSrc.includes("data-prm-subgroup-mappings-table") &&
    thisSrc.includes("No server files"),
  "40 no server files",
);
assert(
  !detailFn.includes("rpc_refresh") &&
    !renderFn.includes("costing refresh") &&
    thisSrc.includes("No costing refresh"),
  "41 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v312"/.test(swSrc) &&
    htmlSrc.includes("data-prm-subgroup-mappings-table") &&
    htmlSrc.includes("cp-prm-modal-window--subgroup-detail") &&
    moduleSrc.includes("setSubgroupDetailWideModal") &&
    moduleSrc.includes("openSubgroupMappingDetailModal"),
  "42 SW bump once",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-subgroup-mapping-compact-register-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-subgroup-mapping-compact-register-smoke: all passed",
);
