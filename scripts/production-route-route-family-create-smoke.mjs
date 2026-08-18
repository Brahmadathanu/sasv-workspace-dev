/**
 * Gate 11Y.10I.2C.3F.2B.4C — Manufacturing Route Family Create UX.
 * Client-only source/contract smoke. Does not create DRY_FINE_POWDER_WASH_DRY.
 * Does not create a Family Route or mappings. Does not mutate DRY_FINE_POWDER_NO_WASH.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrmRouteFamilyApprovalReference } from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read("scripts/production-route-route-family-create-smoke.mjs");

const renderFamiliesFn =
  mainSrc.match(
    /function renderRouteFamilies\(\) \{[\s\S]*?\n  function workloadExplainStripItem/,
  )?.[0] || "";
const createFn =
  mainSrc.match(
    /function openCreateFamilyModal\(\) \{[\s\S]*?\n  async function openApproveFamilyModal/,
  )?.[0] || "";
const helperFn =
  mainSrc.match(
    /async function refreshRouteFamiliesAfterMutation\([\s\S]*?\n  async function loadMappingReview/,
  )?.[0] || "";
const renderFn =
  mainSrc.match(/function render\(\) \{[\s\S]*?\n  function syncPageFromShell/)?.[0] ||
  "";
const unbindFn =
  mainSrc.match(
    /\/\*\* Page\/register handlers only[\s\S]*?function unbind\(\) \{[\s\S]*?\n  \}\n\n  function hosts/,
  )?.[0] || "";
const loadFamiliesFn =
  mainSrc.match(
    /async function loadRouteFamilies\(\) \{[\s\S]*?\n  async function refreshRouteFamiliesAfterMutation/,
  )?.[0] || "";

const noWashRef = buildPrmRouteFamilyApprovalReference({
  routeFamilyCode: "DRY_FINE_POWDER_NO_WASH",
  approvalDate: "2026-08-13",
});

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function resultWouldRetryMutation(src) {
  const refreshIdx = src.indexOf("await refreshRouteFamiliesAfterMutation");
  if (refreshIdx < 0) return true;
  return src.slice(refreshIdx).includes("await governed");
}

assert(
  renderFamiliesFn.includes("cp-prm-route-families-summary-host") &&
    renderFamiliesFn.includes('classList.add(\n        "is-visible"') &&
    renderFn.includes('state.activeLens === "route-families"') &&
    htmlSrc.includes("cp-prm-route-families-chrome-active"),
  "1 route-families lens exposes toolbar",
);
assert(
  renderFamiliesFn.includes("state.routeFamilies") &&
    renderFamiliesFn.includes("cp-prm-route-families-toolbar") &&
    renderFamiliesFn.includes("data-prm-create-route-family"),
  "2 toolbar visible with existing approved Family",
);
assert(
  renderFamiliesFn.includes("Create Route Family") &&
    renderFamiliesFn.includes("canEdit()") &&
    renderFamiliesFn.includes("icon-btn icon-btn-primary") &&
    htmlSrc.includes(
      ".cp-prm-route-families-toolbar [data-prm-create-route-family]",
    ) &&
    htmlSrc.includes("margin-left: auto"),
  "3 Create Route Family visible with edit permission",
);
assert(
  renderFamiliesFn.includes("const createBtn = canEdit()") &&
    renderFamiliesFn.includes('? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-route-family>Create Route Family</button>`') &&
    renderFamiliesFn.includes(": \"\""),
  "4 hidden for view-only permission",
);
assert(
  createFn.includes('showToast?.("Edit permission required.", "warning")') &&
    createFn.includes("if (!canEdit())"),
  "5 no silent permission path",
);
assert(
  renderFamiliesFn.includes("data-prm-open-mapping-review") &&
    renderFamiliesFn.includes("Open Mapping Review"),
  "6 existing Mapping Review action preserved",
);
assert(
  renderFamiliesFn.includes("data-prm-review-pre-mapping") &&
    renderFamiliesFn.includes("Review pre-mapping evidence") &&
    renderFamiliesFn.includes("data-prm-empty-review-evidence"),
  "7 existing pre-mapping action preserved",
);
assert(
  renderFamiliesFn.includes("openCreateFamilyModal()") &&
    createFn.includes('title: "Create Manufacturing Route Family"'),
  "8 create modal opens",
);
assert(
  createFn.includes('id: "prmFamilyCode"') &&
    createFn.includes("Family code"),
  "9 Family Code field present",
);
assert(
  createFn.includes('id: "prmFamilyName"') &&
    createFn.includes("Family name"),
  "10 Family Name field present",
);
assert(
  createFn.includes('id: "prmFamilyEffectiveFrom"') &&
    createFn.includes("Effective from") &&
    createFn.includes("getAsOfDate()"),
  "11 Effective From present",
);
assert(
  createFn.includes('id: "prmFamilyDescription"') &&
    createFn.includes("Description"),
  "12 Description present",
);
assert(
  createFn.includes("Family code is required.") &&
    createFn.includes("if (!code)"),
  "13 Family Code required",
);
assert(
  createFn.includes("Family name is required.") &&
    createFn.includes("if (!name)"),
  "14 Family Name required",
);
assert(
  createFn.includes("Effective from is required.") &&
    createFn.includes("if (!effectiveFrom)"),
  "15 Effective From required",
);
assert(
  createFn.includes(".toUpperCase()") &&
    createFn.includes("route_family_code: code"),
  "16 code normalized uppercase on submit",
);
assert(
  createFn.includes("/^[A-Z][A-Z0-9_]*$/") &&
    helpersSrc.includes("/^[A-Z][A-Z0-9_]*$/"),
  "17 code regex enforced",
);
assert(
  !createFn.includes("from name") &&
    !createFn.includes("derive") &&
    !createFn.includes("route_family_code: name"),
  "18 no name-derived code",
);
assert(
  !createFn.includes("prmApproveFamilyRef") &&
    !createFn.includes("approval_reference") &&
    !createFn.includes("Approval reference"),
  "19 no approval-reference field",
);
assert(
  !createFn.includes("step_key") &&
    !createFn.includes("operation_type") &&
    !createFn.includes("cost_centre_id"),
  "20 no route-step fields",
);
assert(
  !createFn.includes("product_group_id") &&
    !createFn.includes("product_subgroup_id") &&
    !createFn.includes("Map Product Group"),
  "21 no mapping fields",
);
assert(
  !createFn.includes("family_route") &&
    !createFn.includes("openCreateFamilyRouteDraftModal") &&
    !createFn.includes("rpc_create_route_family_route_draft"),
  "22 no Family Route fields",
);
assert(
  createFn.indexOf("openModal") < createFn.indexOf("RPC.createFamily") &&
    createFn.indexOf("onModal") < createFn.indexOf("RPC.createFamily"),
  "23 no RPC on modal open",
);
assert(
  createFn.includes("buildCreateRouteFamilyArgs") &&
    rpcSrc.includes("rpc_create_route_family"),
  "24 create builder used",
);
assert(
  createFn.split("RPC.createFamily").length === 2 &&
    mainSrc.includes('createFamily: "rpc_create_route_family"'),
  "25 rpc_create_route_family called exactly once in fixture path",
);
assert(
  !createFn.includes("rpc_create_route_family_onboarding_draft") &&
    !createFn.includes("onboarding"),
  "26 no onboarding-draft RPC",
);
assert(
  !createFn.includes("RPC.createFamilyDraft") &&
    !createFn.includes("rpc_create_route_family_route_draft"),
  "27 no Family Route create RPC",
);
assert(
  !createFn.includes("RPC.approveFamily") &&
    !createFn.includes("rpc_approve_route_family"),
  "28 no approve RPC",
);
assert(
  !createFn.includes("mapProductGroup") &&
    !createFn.includes("rpc_map_product") &&
    !createFn.includes("RPC.mapProductGroup"),
  "29 no mapping RPC",
);
assert(
  createFn.includes("closeModal({ restorePrevious: false })") &&
    createFn.indexOf("closeModal({ restorePrevious: false })") <
      createFn.indexOf("await refreshRouteFamiliesAfterMutation"),
  "30 success closes modal",
);
assert(
  helperFn.includes('await loadMasterOptions({ catalogueScope: "unscoped" })') &&
    createFn.includes("await refreshRouteFamiliesAfterMutation"),
  "31 forced loadMasterOptions used after success",
);
assert(
  !helperFn.includes("ensureMasterOptions") &&
    !createFn.includes("loadRouteFamilies()") &&
    loadFamiliesFn.includes('catalogueScope: "unscoped"') &&
    !loadFamiliesFn.includes("ensureMasterOptions"),
  "32 ensureMasterOptions cache not used as post-create authority",
);
assert(
  mainSrc.includes("state.routeFamilies = payload.route_families") &&
    helperFn.includes('await loadMasterOptions({ catalogueScope: "unscoped" })'),
  "33 state.routeFamilies replaced from server",
);
assert(
  helperFn.includes("render()") &&
    helperFn.indexOf("await loadMasterOptions(") < helperFn.indexOf("render()") &&
    helperFn.includes('state.activeLens === "route-families"') &&
    renderFn.includes("renderRouteFamilies()"),
  "34 register repaint after state replacement",
);
assert(
  !createFn.includes('status: "DRAFT"') &&
    !/route_family_id:\s*id/.test(createFn) &&
    !helperFn.includes("optimistic") &&
    !helperFn.includes("fabricat"),
  "35 no optimistic/synthetic DRAFT row",
);
assert(
  createFn.includes("state.routeFamilies || []") &&
    createFn.includes("openFamilySummary(created") &&
    !createFn.includes("|| {"),
  "36 optional summary uses authoritative returned row only",
);
assert(
  !helperFn.includes("state.search =") &&
    !createFn.includes("state.search ="),
  "37 search preserved",
);
assert(
  !helperFn.includes("state.as_of_date =") &&
    !createFn.includes("state.as_of_date =") &&
    mainSrc.includes("as_of_date: getAsOfDate()"),
  "38 as-of preserved",
);
assert(
  helperFn.includes('state.activeLens === "route-families"') &&
    !helperFn.includes("beginLensTransition") &&
    !helperFn.includes("reloadCurrentLens"),
  "39 active lens preserved",
);
assert(
  mainSrc.includes("showToast?.(error.message || fallback, \"error\"") &&
    createFn.includes("if (!response.ok) return response"),
  "40 duplicate error surfaced",
);
assert(
  !createFn.includes("suffix") &&
    !createFn.includes("_2") &&
    !createFn.includes("code +"),
  "41 no code suffix",
);
assert(
  helperFn.includes("refreshFailureMessage") &&
    createFn.includes(
      "Route Family created, but the register could not be refreshed.",
    ),
  "42 refresh failure warning present",
);
assert(
  !helperFn.includes("governed(") &&
    !helperFn.includes("RPC.createFamily") &&
    !resultWouldRetryMutation(createFn),
  "43 no mutation retry",
);
assert(
  noWashRef.ok &&
    noWashRef.reference === "PRM-RF-DRY_FINE_POWDER_NO_WASH-APP-20260813" &&
    !createFn.includes("DRY_FINE_POWDER_NO_WASH"),
  "44 DRY_FINE_POWDER_NO_WASH unchanged fixture",
);
assert(
  thisSrc.includes("Does not create DRY_FINE_POWDER_WASH_DRY") &&
    !createFn.includes("DRY_FINE_POWDER_WASH_DRY") &&
    !helperFn.includes("DRY_FINE_POWDER_WASH_DRY"),
  "45 DRY_FINE_POWDER_WASH_DRY not created",
);
assert(
  !rpcSrc.includes("refreshRouteFamiliesAfterMutation") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION"),
  "46 no server files",
);
assert(
  !createFn.includes("rpc_refresh") &&
    !createFn.includes("requestCostingRefresh") &&
    !helperFn.includes("requestCostingRefresh"),
  "47 no costing refresh",
);
assert(
  !unbindFn.includes("unbindModalHandlers()") &&
    unbindFn.includes("Page/register handlers only"),
  "48 modal ownership regression preserved",
);
assert(
  /CACHE_NAME = "hub-cache-v302"/.test(swSrc),
  "49 SW bump once to hub-cache-v302",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-route-family-create-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-route-family-create-smoke: all passed");
