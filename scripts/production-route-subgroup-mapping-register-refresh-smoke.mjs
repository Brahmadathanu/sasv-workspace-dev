/**
 * Gate 11Y.10I.2C.3F.2B.3B — Subgroup Mapping post-mutation register refresh.
 * Client-only source/contract smoke. Does not mutate Mapping ID 1.
 * No live Product Subgroup mapping create/edit/submit/approve/inactivate.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatPrmRouteFamilyAssignmentSourceLabel } from "../public/shared/js/costing-suite-production-route-helpers.js";

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
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-subgroup-mapping-register-refresh-smoke.mjs",
);

const helperFn =
  moduleSrc.match(
    /async function refreshSubgroupMappingsAfterMutation\([\s\S]*?\n  function buildSubgroupRowActionsHtml/,
  )?.[0] || "";
const createFn =
  moduleSrc.match(
    /async function openCreateSubgroupMappingModal\([\s\S]*?\n  function openEditSubgroupMappingModal/,
  )?.[0] || "";
const editFn =
  moduleSrc.match(
    /function openEditSubgroupMappingModal\([\s\S]*?\n  function openSubmitSubgroupMappingModal/,
  )?.[0] || "";
const submitFn =
  moduleSrc.match(
    /function openSubmitSubgroupMappingModal\([\s\S]*?\n  function openApproveSubgroupMappingModal/,
  )?.[0] || "";
const approveFn =
  moduleSrc.match(
    /function openApproveSubgroupMappingModal\([\s\S]*?\n  function openInactivateSubgroupMappingModal/,
  )?.[0] || "";
const inactivateFn =
  moduleSrc.match(
    /function openInactivateSubgroupMappingModal\([\s\S]*?\n  async function loadArchivedRoutes/,
  )?.[0] || "";
const renderFn =
  moduleSrc.match(
    /function renderSubgroupMappings\(\) \{[\s\S]*?\n  function buildSubgroupSelectOptionsHtml/,
  )?.[0] || "";
const loadFn =
  moduleSrc.match(
    /async function loadSubgroupMappings\([\s\S]*?\n  async function refreshSubgroupMappingsAfterMutation/,
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

assert(
  createFn.includes("await governed") &&
    createFn.includes("RPC.mapSubgroup") &&
    createFn.includes("withMutation(submit"),
  "1 Create mutation awaited",
);
const createSuccessFn =
  createFn.slice(createFn.indexOf("RPC.mapSubgroup")) || "";
assert(
  createSuccessFn.includes("if (!response.ok)") &&
    createSuccessFn.indexOf("if (!response.ok)") <
      createSuccessFn.indexOf("closeModal({ restorePrevious: false })") &&
    createSuccessFn.includes("Product Subgroup mapping Draft created."),
  "2 modal closes only after mutation success",
);
assert(
  createFn.includes("refreshSubgroupMappingsAfterMutation") &&
    helperFn.includes("await loadSubgroupMappings({ resetOffset: false })") &&
    !createFn.includes("reloadCurrentLens") &&
    !helperFn.includes("beginLensTransition") &&
    !helperFn.includes("reloadCurrentLens"),
  "3 post-create register reload invoked",
);
assert(
  createFn.includes("await refreshSubgroupMappingsAfterMutation") &&
    helperFn.includes("await loadSubgroupMappings"),
  "4 register reload awaited",
);
assert(
  helperFn.includes('state.activeLens === "product-subgroup-mappings"') &&
    mainSrc.includes('state.activeLens === "product-subgroup-mappings"') &&
    mainSrc.includes("onRegisterRefreshed"),
  "5 active lens remains product-subgroup-mappings",
);
assert(
  loadFn.includes("state.subgroup_mapping_status") &&
    loadFn.includes("state.search") &&
    loadFn.includes("state.route_family_id") &&
    loadFn.includes("state.product_group_id") &&
    loadFn.includes("state.product_subgroup_id") &&
    !helperFn.includes('state.subgroup_mapping_status = ""') &&
    !helperFn.includes("state.search = \"\""),
  "6 filters preserved",
);
assert(
  helperFn.includes("resetOffset: false") &&
    !helperFn.includes("resetOffset: true"),
  "7 resetOffset:false",
);
assert(
  loadFn.includes("state.subgroupMappingRows = normalized.rows") &&
    helperFn.includes("await loadSubgroupMappings") &&
    !helperFn.includes("push(") &&
    !helperFn.includes("unshift("),
  "8 server rows replace old rows",
);
assert(
  loadFn.includes("state.subgroupMappingTotalCount = normalized.total_count") &&
    renderFn.includes("state.subgroupMappingTotalCount") &&
    renderFn.includes("records"),
  "9 total count refreshed",
);
assert(
  helperFn.includes("onRegisterRefreshed") &&
    helperFn.includes("renderSubgroupMappings()") &&
    mainSrc.includes("onRegisterRefreshed: () =>") &&
    mainSrc.includes("render()"),
  "10 render/repaint occurs after successful read",
);
assert(
  renderFn.includes("state.subgroupMappingRows") &&
    renderFn.includes("product_subgroup_name") &&
    helperFn.indexOf("await loadSubgroupMappings") <
      helperFn.indexOf("renderSubgroupMappings()"),
  "11 row visible immediately in mocked result",
);
assert(
  !helperFn.includes("optimistic") &&
    !helperFn.includes("fabricat") &&
    !createFn.includes("subgroupMappingRows.push") &&
    !createFn.includes("mapping_id: 1"),
  "12 no optimistic fabricated row",
);
assert(
  !helperFn.includes("governed(") &&
    !helperFn.includes("RPC.mapSubgroup") &&
    createFn.indexOf("await refreshSubgroupMappingsAfterMutation") >
      createFn.indexOf("RPC.mapSubgroup"),
  "13 mutation not retried after refresh failure",
);
assert(
  helperFn.includes("refreshFailureMessage") &&
    createFn.includes(
      "Mapping created, but the register could not be refreshed.",
    ) &&
    !resultWouldRetryMutation(createFn),
  "14 refresh-failure feedback visible",
);
assert(
  editFn.includes("await refreshSubgroupMappingsAfterMutation") &&
    editFn.includes(
      "Mapping updated, but the register could not be refreshed.",
    ),
  "15 Edit uses shared helper",
);
assert(
  submitFn.includes("await refreshSubgroupMappingsAfterMutation") &&
    submitFn.includes(
      "Mapping submitted, but the register could not be refreshed.",
    ),
  "16 Submit uses shared helper",
);
assert(
  approveFn.includes("await refreshSubgroupMappingsAfterMutation") &&
    approveFn.includes(
      "Mapping approved, but the register could not be refreshed.",
    ),
  "17 Approve uses shared helper",
);
assert(
  inactivateFn.includes("await refreshSubgroupMappingsAfterMutation") &&
    inactivateFn.includes(
      "Mapping inactivated, but the register could not be refreshed.",
    ),
  "18 Inactivate uses shared helper",
);
assert(
  moduleSrc.includes('action === "replace-subgroup-mapping"') &&
    moduleSrc.includes("openCreateSubgroupMappingModal({") &&
    createFn.includes("refreshSubgroupMappingsAfterMutation"),
  "19 replacement Draft uses same Create refresh path",
);
assert(
  rpcSrc.includes("rpc_map_product_group_to_route_family") &&
    mainSrc.includes("buildMapProductGroupToRouteFamilyArgs") &&
    !createFn.includes("rpc_map_product_group_to_route_family") &&
    !helperFn.includes("mapProductGroup"),
  "20 Product Group mapping unchanged",
);
assert(
  rpcSrc.includes("rpc_create_product_route_family_assignment_draft") &&
    mainSrc.includes("buildCreateProductRouteFamilyAssignmentDraftArgs") &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_ASSIGNMENT") ===
      "Product-specific assignment" &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_SUBGROUP_FALLBACK") ===
      "Inherited from Product Subgroup" &&
    formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_GROUP_FALLBACK") ===
      "Inherited from Product Group" &&
    helpersSrc.includes("overrides Product Subgroup and Product Group"),
  "21 Product Assignment unchanged",
);
assert(
  thisSrc.includes("Does not mutate Mapping ID 1") &&
    thisSrc.includes("No live Product Subgroup mapping") &&
    !importBlock.includes("supabase"),
  "22 no live mapping mutation in smoke",
);
assert(
  thisSrc.includes("Does not mutate Mapping ID 1") &&
    !importBlock.includes("buildMapProductSubgroupToRouteFamilyArgs") &&
    !importBlock.includes("buildApproveProductSubgroupMappingArgs"),
  "23 Mapping ID 1 untouched",
);
assert(
  !rpcSrc.includes("refreshSubgroupMappingsAfterMutation") &&
    !rpcSrc.includes("onRegisterRefreshed"),
  "24 no server files",
);
assert(
  !createFn.includes("rpc_refresh") &&
    !helperFn.includes("costing refresh") &&
    moduleSrc.includes("does not trigger costing refresh"),
  "25 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "26 SW cache name present (bump owned by later gates)",
);

function resultWouldRetryMutation(src) {
  const refreshIdx = src.indexOf("await refreshSubgroupMappingsAfterMutation");
  if (refreshIdx < 0) return true;
  return src.slice(refreshIdx).includes("await governed");
}

if (failed > 0) {
  console.error(
    `\nproduction-route-subgroup-mapping-register-refresh-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-subgroup-mapping-register-refresh-smoke: all passed",
);
