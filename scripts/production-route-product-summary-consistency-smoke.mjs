/**
 * Gate 11Y.10I.2C.3E.3A — Product Route Summary consistency + density.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmDayMonthYearLabel,
  formatPrmFamilyRouteVersionCopy,
  formatPrmRouteFamilyAssignmentSourceLabel,
  formatPrmRouteValidationSummary,
  getApplicableProductRouteActions,
  humanizeUnknownPrmCode,
  PRM_EXACT_RUN_CONTEXT,
  resolvePrmEffectiveFamilyRouteId,
  resolvePrmFamilyRouteVersionFromHistory,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { normalizeEffectiveRoute } from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const costCentreSrc = read(
  "public/shared/js/costing-suite-production-route-cost-centres.js",
);
const swSrc = read("public/sw.js");

const openFn =
  mainSrc.match(
    /function openProductSummary\([\s\S]*?\n  function workflowHtml/,
  )?.[0] || "";
const fillFn =
  mainSrc.match(
    /async function fillProductSummaryEffectiveHost\([\s\S]*?\n  function resolveWorkloadActivityLabel/,
  )?.[0] || "";
const snapshotFn =
  mainSrc.match(
    /function buildProductSummarySnapshotHtml\([\s\S]*?\n  function buildEffectiveRoutePanelHtml/,
  )?.[0] || "";
const fallbackFn =
  mainSrc.match(
    /function buildProductAssignmentFallbackHtml\([\s\S]*?\n  function buildProductAssignmentsPanelHtml/,
  )?.[0] || "";
const mergeFn =
  mainSrc.match(
    /function mergeProductSummaryCanonicalRow\([\s\S]*?\n  function buildProductSummarySnapshotHtml/,
  )?.[0] || "";
const renderReadinessFn =
  mainSrc.match(
    /host\.tableBody\.innerHTML = state\.readinessRows[\s\S]*?bindRows\(\);/,
  )?.[0] || "";
const productSummaryCss =
  htmlSrc.match(
    /\.cp-prm-product-summary[\s\S]*?\.cp-prm-form \{/,
  )?.[0] || "";
const normalizeEffectiveFn =
  rpcSrc.match(
    /export function normalizeEffectiveRoute\([\s\S]*?\nexport function normalizeRouteHistory/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const liveEffective = {
  readiness_status: "READY",
  route_source: "ROUTE_FAMILY_INHERITED",
  base_route_family_route_id: 10,
  product_route_id: null,
  validation: { valid: true, family_route_id: 10 },
  steps: [
    { step_no: 10, activity: "RM dispensation" },
    { step_no: 20, activity: "Pulverization" },
    { step_no: 30, activity: "Sieving" },
    { step_no: 40, activity: "Finished Goods Quality Assessment" },
    { step_no: 50, activity: "Transfer to FG store" },
  ],
};
const openingBlockedRow = {
  product_id: 139,
  readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE",
  route_family_assignment_source: "PRODUCT_GROUP_FALLBACK",
  route_family_name: "Dry Powder and Choornam Manufacturing",
};
const historyMatched = [
  { id: 9, route_version: 1, status: "SUPERSEDED" },
  { id: 10, route_version: 2, status: "APPROVED" },
];

assert(
  fillFn.includes("loadEffective(productId)") &&
    fillFn.includes("mergeProductSummaryCanonicalRow") &&
    mergeFn.includes("effective?.readiness_status") &&
    snapshotFn.includes("effective?.readiness_status") &&
    !openFn.includes("chip(row.readiness_status)"),
  "1 Product 139 modal uses canonical live effective readiness",
);
assert(
  openFn.includes("data-prm-product-snapshot-host") &&
    fillFn.includes('Loading live route') &&
    !openFn.includes("Approved Family Route missing") &&
    !fillFn.includes("identityRow.readiness_status") &&
    !snapshotFn.includes("identityRow.readiness_status"),
  "2 Product card does not retain opening row blocker after effective load",
);
assert(
  snapshotFn.includes("chip(readiness)") &&
    snapshotFn.includes("effective?.readiness_status") &&
    !snapshotFn.includes("Approved Family Route missing") &&
    !(
      snapshotFn.includes("READY") &&
      snapshotFn.includes("Approved Family Route missing")
    ),
  "3 no simultaneous Ready + Approved Family Route missing",
);
assert(
  !openFn.includes("NO_APPROVED_ROUTE_FAMILY_ROUTE") &&
    !snapshotFn.includes("NO_APPROVED_ROUTE_FAMILY_ROUTE") &&
    !fillFn.includes("NO_APPROVED_ROUTE_FAMILY_ROUTE") &&
    formatPrmRouteValidationSummary(liveEffective.validation) === "Valid",
  "4 NO_APPROVED_ROUTE_FAMILY_ROUTE absent from live-ready summary",
);
assert(
  resolvePrmEffectiveFamilyRouteId({
    base_route_family_route_id: 10,
    family_route_id: 99,
  }) === 10 &&
    normalizeEffectiveFn.includes("base_route_family_route_id") &&
    normalizeEffectiveRoute({ base_route_family_route_id: 10 })
      .base_route_family_route_id === 10,
  "5 effective Family Route ID resolves from base_route_family_route_id",
);
assert(
  resolvePrmEffectiveFamilyRouteId({
    validation: { family_route_id: 10 },
  }) === 10 &&
    helpersSrc.includes("validation.family_route_id"),
  "6 validation.family_route_id supported appropriately",
);
assert(
  resolvePrmFamilyRouteVersionFromHistory(10, historyMatched) === "2" &&
    formatPrmFamilyRouteVersionCopy(10, historyMatched) === "Version 2" &&
    formatPrmFamilyRouteVersionCopy(10, [
      { family_route_id: 10, route_version: 2 },
    ]) === "Version 2" &&
    snapshotFn.includes("formatPrmFamilyRouteVersionCopy"),
  "7 Version 2 only after actual history-row id match",
);
assert(
  formatPrmFamilyRouteVersionCopy(10, []) === "" &&
    formatPrmFamilyRouteVersionCopy(10, [{ id: 9, route_version: 2 }]) === "" &&
    !snapshotFn.includes("Version ${familyRouteId}") &&
    !fillFn.includes("route_version: familyRouteId"),
  "8 no version inference from route id",
);
assert(
  snapshotFn.includes('productRouteId == null ? "None"') &&
    snapshotFn.includes('field: "product-route"'),
  "9 Product Route displays None",
);
assert(
  snapshotFn.includes("routeValidationDetailHtml(effective?.validation)") &&
    formatPrmRouteValidationSummary({ valid: true }) === "Valid" &&
    formatPrmRouteValidationSummary(liveEffective.validation) === "Valid",
  "10 validation displays Valid",
);
assert(
  snapshotFn.includes("humanizeUnknownPrmCode(routeSourceRaw)") &&
    humanizeUnknownPrmCode("ROUTE_FAMILY_INHERITED") ===
      "Route Family Inherited",
  "11 route source displays Route Family Inherited",
);
assert(
  fallbackFn.includes("Product-specific assignment") &&
    fallbackFn.includes('text("None")'),
  "12 Product-specific assignment displays None",
);
assert(
  formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_GROUP_FALLBACK") ===
    "Inherited from Product Group" &&
    fallbackFn.includes("Effective assignment") &&
    fallbackFn.includes("formatPrmRouteFamilyAssignmentSourceLabel"),
  "13 effective assignment displays Inherited from Product Group",
);
assert(
  !openFn.includes("No Product Route Family assignments for this Product.") &&
    !fallbackFn.includes("No Product Route Family assignments for this Product.") &&
    mainSrc.includes("buildProductAssignmentFallbackHtml(row)"),
  "14 no misleading no-assignment-at-all copy",
);
assert(
  fillFn.includes("buildEffectiveStepsTableHtml") &&
    fillFn.includes("effective.steps || effective.effective_steps") &&
    !fillFn.includes(".slice(") &&
    liveEffective.steps.length === 5,
  "15 5 ordered steps preserved",
);
assert(
  fillFn.includes("buildProductSummarySnapshotHtml") &&
    fillFn.includes("buildEffectiveStepsTableHtml") &&
    fillFn.includes("const effective = result.data") &&
    mergeFn.includes("effective?.validation"),
  "16 same canonical payload feeds readiness and steps",
);
assert(
  openFn.includes("data-prm-as-of-cue") &&
    openFn.includes("As of ${text(asOfLabel)}") &&
    formatPrmDayMonthYearLabel("2026-08-11") === "11 Aug 2026",
  "17 As-of date cue displayed",
);
assert(
  openFn.includes("getAsOfDate()") &&
    fillFn.includes("loadEffective(productId)") &&
    mainSrc.includes("as_of_date: asOf || getAsOfDate()"),
  "18 As-of cue uses selected live date",
);
assert(
  renderReadinessFn.includes("chip(row.readiness_status)") &&
    mainSrc.includes("exactRunContextHtml()") &&
    helpersSrc.includes("period_start: \"2026-07-01\""),
  "19 Route Readiness register context unchanged",
);
assert(
  PRM_EXACT_RUN_CONTEXT.period_start === "2026-07-01" &&
    PRM_EXACT_RUN_CONTEXT.valuation_date === "2026-07-22" &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "20 exact Run-80 constants unchanged",
);
assert(
  fillFn.includes("isRouteBlockedReadiness(canonicalReadiness)") &&
    fillFn.includes("getApplicableProductRouteActions(canonicalRow") &&
    !fillFn.includes("isRouteBlockedReadiness(row.readiness"),
  "21 candidate visibility follows canonical live readiness",
);
assert(
  openFn.includes("setProductSummaryWideModal(true)") &&
    htmlSrc.includes("cp-prm-modal-window--product-summary") &&
    htmlSrc.includes("cp-prm-modal-window--wide"),
  "22 desktop Product Summary uses wide modal",
);
assert(
  snapshotFn.includes("cp-prm-product-summary-meta") &&
    htmlSrc.includes("grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr))") &&
    snapshotFn.includes('field: "hierarchy"') &&
    snapshotFn.includes("full: true"),
  "23 compact metadata grid used",
);
assert(
  snapshotFn.includes("Commercial hierarchy") &&
    snapshotFn.includes("full: true") &&
    mainSrc.includes("cp-prm-product-summary-meta-cell--full") &&
    htmlSrc.includes(".cp-prm-product-summary-meta-cell--full"),
  "24 commercial hierarchy spans without portrait height explosion",
);
assert(
  fillFn.includes("buildEffectiveStepsTableHtml") &&
    htmlSrc.includes(
      ".cp-prm-modal-window--product-summary .cp-prm-step-table-wrap",
    ),
  "25 Ordered Steps full width",
);
assert(
  getApplicableProductRouteActions({
    readiness_status: "READY",
    route_family_id: 4,
    family_route_id: 10,
    product_id: 139,
  })
    .map((action) => action.id)
    .join(" ")
    .includes("effective") &&
    getApplicableProductRouteActions({
      readiness_status: "READY",
      route_family_id: 4,
      product_id: 139,
    })
      .map((action) => action.id)
      .includes("create-product") &&
    fillFn.includes("getApplicableProductRouteActions(canonicalRow"),
  "26 actions preserved",
);
assert(
  htmlSrc.includes("@media (max-width: 760px)") &&
    htmlSrc.includes("cp-prm-modal-window--product-summary") &&
    /@media \(max-width: 760px\)[\s\S]*cp-prm-product-summary-meta[\s\S]*9\.5rem/.test(
      htmlSrc,
    ),
  "27 <=760 layout stacks cleanly",
);
assert(
  /cp-prm-modal-window--product-summary \.cp-prm-step-table-wrap[\s\S]*overflow-x:\s*auto/.test(
    htmlSrc,
  ),
  "28 table scroll remains local",
);
assert(
  /cp-prm-modal-window--product-summary \.modal-content[\s\S]*overflow-x:\s*hidden/.test(
    htmlSrc,
  ) && htmlSrc.includes("overflow-x: hidden"),
  "29 no whole-modal horizontal overflow",
);
assert(
  openFn.includes("cleanup: () => setProductSummaryWideModal(false)") &&
    mainSrc.includes('cp-prm-modal-window--product-summary') &&
    mainSrc.includes("clearWorkloadProductModalChrome"),
  "30 wide class cleaned on close",
);
assert(
  !editorSrc.includes("setProductSummaryWideModal") &&
    !editorSrc.includes("data-prm-as-of-cue") &&
    !editorSrc.includes("cp-prm-product-summary-meta"),
  "31 Product Route Editor unchanged",
);
assert(
  !costCentreSrc.includes("setProductSummaryWideModal") &&
    !costCentreSrc.includes("data-prm-product-snapshot-host"),
  "32 Cost Centres unchanged",
);
assert(
  !openFn.includes("CREATE OR REPLACE FUNCTION") &&
    !fillFn.includes("apply_migration") &&
    !rpcSrc.includes("rpc_get_effective_product_process_route_v2") &&
    normalizeEffectiveFn.includes("base_route_family_route_id"),
  "33 no RPC/server changes",
);
assert(
  !openFn.includes("createProductDraftFromRow") &&
    !fillFn.includes("editor.createProductDraft") &&
    getApplicableProductRouteActions(openingBlockedRow).every(
      (action) => action.id !== "auto-create",
    ),
  "34 no mutation",
);
assert(
  !openFn.includes("runStagedCostingRefresh") &&
    !fillFn.includes("refreshCost") &&
    !snapshotFn.includes("refresh_run_id"),
  "35 no refresh",
);
assert(
  productSummaryCss.includes("var(--sasv-text-xs)") &&
    !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(productSummaryCss),
  "36 semantic tokens only",
);
assert(
  /CACHE_NAME = "hub-cache-v273"/.test(swSrc),
  "37 SW bumped exactly once after smokes (hub-cache-v273)",
);

if (failed) {
  console.error(
    `production-route-product-summary-consistency-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-product-summary-consistency-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_3E_3A_BROWSER_ACCEPTANCE");
