/**
 * Gate 11Y.10G.3B.2 — Material Evidence & Foundation Remediation UX smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSkuExactEvidenceCacheKey,
  buildSkuFoundationDiagnosisCacheKey,
  buildWorkbenchEvidenceHierarchy,
  canShareMaterialEvidenceTraceTarget,
  formatFoundationStatusLabel,
  formatSkuEvidenceAreaLabel,
  isUnverifiedFoundationRoute,
  resolveWorkbenchExactEvidenceIdentity,
} from "../public/shared/js/costing-suite-control-center.js";
import { resolveSkuControlPrimaryMessage } from "../public/shared/js/costing-suite-recommended-ui-route.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const typesSrc = readFileSync(
  join(root, "public/shared/js/types/supabase.ts"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const remediationSmokeSrc = readFileSync(
  join(root, "scripts/material-remediation-evidence-smoke.mjs"),
  "utf8",
);

const skuExactEvidenceLoaderSrc =
  controlSrc.match(
    /async function loadSkuExactEvidenceRows\([\s\S]*?\n  function /,
  )?.[0] || "";
const workbenchEvidenceLoaderSrc =
  controlSrc.match(
    /async function loadWorkbenchLineEvidenceRows\([\s\S]*?\n  function /,
  )?.[0] || "";
const workbenchEvidenceTabSrc =
  controlSrc.match(
    /async function renderWorkbenchLineEvidenceTab\([\s\S]*?\n  function /,
  )?.[0] || "";
const navigateTraceSrc =
  controlSrc.match(
    /function navigateMaterialEvidenceTrace\([\s\S]*?\n  function /,
  )?.[0] || "";
const normalizeDrillSrc =
  shellSrc.match(
    /function normalizeDrillContext\([\s\S]*?\nfunction /,
  )?.[0] || "";
const buildRouteQuerySrc =
  shellSrc.match(
    /function buildCostingRouteQuery\([\s\S]*?\nfunction /,
  )?.[0] || "";
const stashPendingSrc =
  shellSrc.match(
    /function stashPendingDrillContext\([\s\S]*?\nfunction /,
  )?.[0] || "";
const applyRouteLaunchSrc =
  shellSrc.match(
    /function applyRouteLaunchParams\([\s\S]*?\nfunction /,
  )?.[0] || "";
const drillToTargetSrc =
  shellSrc.match(
    /async function drillToCostingTarget\([\s\S]*?\nlet LENSES/,
  )?.[0] || "";
const skuExactEvidenceTabSrc =
  controlSrc.match(
    /async function renderSkuControlEvidenceTab\([\s\S]*?\n  async function /,
  )?.[0] || "";
const reloadAfterRefreshSrc =
  shellSrc.match(
    /async function reloadCostingUiAfterRefreshRun\([\s\S]*?\nasync function /,
  )?.[0] || "";

// A/B. Exact lines filter + exact-run fields in model/UI
assert(
  /loadSkuExactEvidenceRows/.test(controlSrc),
  "SKU exact evidence loader exists",
);
assert(
  skuExactEvidenceLoaderSrc.includes(
    "v_costing_pricing_material_action_drilldown_snapshot",
  ) &&
    skuExactEvidenceLoaderSrc.includes('.eq("period_start"') &&
    skuExactEvidenceLoaderSrc.includes('.eq("valuation_date"') &&
    skuExactEvidenceLoaderSrc.includes('.eq("refresh_run_id"') &&
    skuExactEvidenceLoaderSrc.includes('.eq("product_id"') &&
    skuExactEvidenceLoaderSrc.includes('.eq("sku_id"'),
  "exact evidence filters by period_start + valuation_date + refresh_run_id + product_id + sku_id",
);
assert(
  /valuation_date/.test(controlSrc) && /refresh_run_id/.test(controlSrc),
  "exact-run fields valuation_date / refresh_run_id supported in evidence UI",
);
assert(
  /Unable to load exact material evidence because this SKU's costing run context is incomplete/.test(
    skuExactEvidenceTabSrc,
  ),
  "Evidence tab has a distinct missing-exact-context state",
);
assert(
  /No exact material issue lines are available for this SKU in the current successful run snapshot/.test(
    controlSrc,
  ),
  "valid-tuple empty snapshot message remains separate",
);
assert(
  formatSkuEvidenceAreaLabel({ material_area: "RM" }) === "RM" &&
    formatSkuEvidenceAreaLabel({ material_area: "PM" }) === "PM",
  "Area labels are human RM/PM text",
);

// Agasthyar acceptance shape (contract fixture — area distribution)
const agasthyarFixture = [
  {
    material_area: "RM",
    stock_item_name: "Eucalyptus Oil (P Sridhar & Co)",
    material_issue_code: "STALE_RM_PURCHASE_RATE",
  },
  {
    material_area: "RM",
    stock_item_name: "Lemon Grass Oil (P Sridhar & Co)",
    material_issue_code: "STALE_RM_PURCHASE_RATE",
  },
  {
    material_area: "PM",
    stock_item_name: "5 ML PP Jar - Natural (Nasika Choornam)",
    material_issue_code: "PM_STOCK_VALUATION_FALLBACK",
  },
];
const rmCount = agasthyarFixture.filter(
  (r) => formatSkuEvidenceAreaLabel(r) === "RM",
).length;
const pmCount = agasthyarFixture.filter(
  (r) => formatSkuEvidenceAreaLabel(r) === "PM",
).length;
assert(
  agasthyarFixture.length === 3 && rmCount === 2 && pmCount === 1,
  "Agasthyar SKU evidence contract resolves 3 lines (RM=2, PM=1)",
);

// C/D. Trace handoff
assert(
  /rowAttrPrefix:\s*"data-sku-evidence"/.test(controlSrc) &&
    /\$\{rowAttrPrefix\}-trace-group/.test(controlSrc),
  "SKU evidence rows expose a Trace action",
);
assert(
  /lensId\s*=\s*[\s\S]*pm-cost-trace[\s\S]*rm-cost-trace|pm-cost-trace[\s\S]*rm-cost-trace/.test(
    controlSrc,
  ) ||
    (/pm-cost-trace/.test(controlSrc) && /rm-cost-trace/.test(controlSrc)),
  "RM/PM Trace lenses are used for evidence Trace CTA",
);
assert(
  /stockItemId:\s*line\.stock_item_id/.test(controlSrc) &&
    /productId:\s*line\.product_id/.test(controlSrc) &&
    /skuId:\s*line\.sku_id/.test(controlSrc),
  "Trace handoff passes period/product/SKU/stock-item context",
);

// E. Lazy evidence — table render must not load line grid
const tableRowFn = controlSrc.match(
  /function renderTableRow\([\s\S]*?\n  function /,
)?.[0] || "";
assert(
  tableRowFn && !/loadSkuExactEvidenceRows/.test(tableRowFn),
  "SKU table render does not trigger exact evidence line-grid query",
);
assert(
  /renderSkuControlEvidenceTab[\s\S]*loadSkuExactEvidenceRows/.test(controlSrc),
  "Evidence-tab load invokes exact evidence loader",
);

// F. Diagnosis lazy load
assert(
  /rpc_get_current_material_foundation_diagnosis/.test(controlSrc),
  "Control drawer uses foundation diagnosis RPC",
);
assert(
  tableRowFn && !/loadSkuFoundationDiagnosis|rpc_get_current_material_foundation_diagnosis/.test(tableRowFn),
  "Main SKU table does not invoke diagnosis RPC",
);
assert(
  /renderSkuControlControlTab[\s\S]*loadSkuFoundationDiagnosis/.test(controlSrc),
  "Control drawer tab invokes foundation diagnosis loader",
);

// G. Cache keys
assert(
  buildSkuExactEvidenceCacheKey({
    periodStart: "2026-08-01",
    valuationDate: "2026-08-07",
    refreshRunId: 108,
    productId: 10,
    skuId: 134,
  }) === "2026-08-01|2026-08-07|108|10|134",
  "Evidence cache key is period|valuation|run|product|sku",
);
assert(
  buildSkuExactEvidenceCacheKey({
    periodStart: "2026-08-01",
    productId: 10,
    skuId: 134,
  }) === null,
  "Missing valuationDate fails closed (null, no period-only key)",
);
assert(
  buildSkuExactEvidenceCacheKey({
    periodStart: "2026-08-01",
    valuationDate: "2026-08-07",
    productId: 10,
    skuId: 134,
  }) === null,
  "Missing refreshRunId fails closed (null, no period-only key)",
);
assert(
  buildSkuExactEvidenceCacheKey({
    periodStart: "2026-08-01",
    valuationDate: "2026-08-07",
    refreshRunId: 108,
    skuId: 134,
  }) === null &&
    buildSkuExactEvidenceCacheKey({
      periodStart: "2026-08-01",
      valuationDate: "2026-08-07",
      refreshRunId: 108,
      productId: 10,
    }) === null,
  "Missing productId or skuId fails closed (null)",
);
assert(
  skuExactEvidenceLoaderSrc.includes("if (!cacheKey) return [];") &&
    skuExactEvidenceLoaderSrc.indexOf("if (!cacheKey) return [];") <
      skuExactEvidenceLoaderSrc.indexOf("fetchAllRows") &&
    skuExactEvidenceLoaderSrc.indexOf("if (!cacheKey) return [];") <
      skuExactEvidenceLoaderSrc.indexOf("SKU_EXACT_EVIDENCE_CACHE.set") &&
    !/getActivePeriodStart/.test(skuExactEvidenceLoaderSrc) &&
    !/CONTROL_DASHBOARD_SUMMARY/.test(skuExactEvidenceLoaderSrc) &&
    !/ACTIVE_REFRESH_RUN/.test(skuExactEvidenceLoaderSrc),
  "Incomplete exact identity does not query or write the evidence cache",
);
assert(
  buildSkuFoundationDiagnosisCacheKey({ productId: 10, skuId: 134 }) ===
    "10|134",
  "Diagnosis cache key is product|sku",
);
assert(
  /SKU_EXACT_EVIDENCE_CACHE/.test(controlSrc) &&
    /SKU_FOUNDATION_DIAGNOSIS_CACHE/.test(controlSrc),
  "Session caches exist for evidence and diagnosis",
);
assert(
  /clearSkuExactEvidenceCache/.test(controlSrc) &&
    /clearSkuExactEvidenceCache/.test(shellSrc),
  "Exact-evidence cache clears on period/context change path",
);
assert(
  /clearSkuExactEvidenceCache/.test(reloadAfterRefreshSrc),
  "Refresh completion clears SKU exact evidence cache",
);

// H. Arkkadi — frozen control note untouched; diagnosis separate
const frozenNote =
  "Material cost is blocked because RM standard cost is missing for this product.";
assert(
  resolveSkuControlPrimaryMessage({
    firstControlStatus: "MATERIAL_RATE_MANAGER_RM",
    controlNote: frozenNote,
  }) === frozenNote,
  "Frozen control note remains untouched (not rewritten to missing BOM)",
);
assert(
  /PRIMARY CONTROL \(frozen costing state\)/.test(controlSrc) &&
    /CURRENT SOURCE STATE/.test(controlSrc),
  "Frozen vs current source sections are visually separated",
);

// I. FOUNDATION_PRESENT compact behavior
assert(
  /overall === "FOUNDATION_PRESENT"/.test(controlSrc) ||
    /FOUNDATION_PRESENT/.test(controlSrc),
  "FOUNDATION_PRESENT has dedicated compact presentation",
);
assert(
  /Current source foundation: Present/.test(controlSrc),
  "FOUNDATION_PRESENT shows compact Present copy",
);
assert(
  formatFoundationStatusLabel("FOUNDATION_PRESENT") === "Present",
  "FOUNDATION_PRESENT label is Present (not blocker/review)",
);

// J. Unknown diagnosis route — no CTA
assert(
  isUnverifiedFoundationRoute("RM_BOM_MANAGEMENT") === true &&
    isUnverifiedFoundationRoute("PM_REQUIREMENT_MANAGEMENT") === true,
  "BOM/PM requirement management routes are unverified",
);
assert(
  !/data-sku-foundation-nav/.test(controlSrc) &&
    !/Material Rate Manager/.test(
      controlSrc.match(/renderCurrentSourceDiagnosisSection[\s\S]*?async function/)?.[0] ||
        "",
    ),
  "Current-source diagnosis section has no foundation navigation CTA",
);
assert(
  /navigation not available/.test(controlSrc),
  "Unknown diagnosis route fails closed without CTA",
);

async function shellAsyncSkuDrawer() {
  assert(
    /await controlCenterCtrl\.renderSkuControlDrawerTab/.test(shellSrc),
    "Shell awaits asynchronous SKU drawer tab rendering",
  );
  assert(
    /wireSkuControlDrawerActions\(tabId,\s*SELECTED_ROW\)/.test(shellSrc),
    "Shell wires SKU drawer actions with active tab id",
  );
  assert(
    /costingRpc/.test(
      shellSrc.match(
        /const controlCenterCtrl = createControlCenterController\(\{[\s\S]*?\n\}\);/,
      )?.[0] || "",
    ),
    "Shell passes costingRpc into control-center controller",
  );
}

// K. Permission failure fail-closed
assert(
  /Exact material evidence is restricted for your access/.test(controlSrc) &&
    /Current source diagnosis is restricted for your access/.test(controlSrc),
  "Permission failure uses restricted-state presentation (fail closed)",
);
assert(
  !/Define the governed Product RM BOM/.test(
    controlSrc.match(/isPermissionDeniedError[\s\S]*?return `/)?.[0] || "x",
  ),
  "Permission failure does not synthesize diagnosis text",
);

// L. Regression anchors still present
assert(
  /isStage05MaterialRemediationMode|Stage-05/.test(remediationSmokeSrc) ||
    /STAGE_05|stage-05|remediation/.test(remediationSmokeSrc),
  "Prior material remediation smoke still present",
);
assert(
  /costing-review-workbench/.test(controlSrc) &&
    /renderWorkbenchLineEvidenceTab/.test(controlSrc),
  "Costing Review Workbench Line Evidence preserved",
);

const workbenchExactIdentity = resolveWorkbenchExactEvidenceIdentity({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 108,
  stock_item_id: 351,
  material_area: "RM",
});
assert(
  workbenchExactIdentity?.periodStart === "2026-08-01" &&
    workbenchExactIdentity?.valuationDate === "2026-08-07" &&
    workbenchExactIdentity?.refreshRunId === 108 &&
    workbenchExactIdentity?.stockItemId === 351 &&
    workbenchExactIdentity?.materialArea === "RM",
  "Workbench identity is taken from the selected queue row tuple",
);
assert(
  resolveWorkbenchExactEvidenceIdentity({
    stock_item_id: 351,
    material_area: "RM",
  }) === null &&
    resolveWorkbenchExactEvidenceIdentity({
      period_start: "2026-08-01",
      stock_item_id: 351,
      material_area: "RM",
    }) === null &&
    resolveWorkbenchExactEvidenceIdentity({
      period_start: "2026-08-01",
      valuation_date: "2026-08-07",
      stock_item_id: 351,
      material_area: "RM",
    }) === null,
  "Incomplete Workbench exact identity fails closed",
);

const workbenchBranchCount = (
  workbenchEvidenceLoaderSrc.match(/\.eq\("valuation_date"/g) || []
).length;
const workbenchRunCount = (
  workbenchEvidenceLoaderSrc.match(/\.eq\("refresh_run_id"/g) || []
).length;
const workbenchPeriodCount = (
  workbenchEvidenceLoaderSrc.match(/\.eq\("period_start"/g) || []
).length;
assert(
  workbenchBranchCount === 2 &&
    workbenchRunCount === 2 &&
    workbenchPeriodCount === 2 &&
    workbenchEvidenceLoaderSrc.includes('.eq("stock_item_id"') &&
    workbenchEvidenceLoaderSrc.includes('.eq("material_area"') &&
    workbenchEvidenceLoaderSrc.includes('.eq("action_severity"') &&
    workbenchEvidenceLoaderSrc.includes('.eq("recommended_ui_route"'),
  "both Workbench drilldown branches filter exact-run identity and keep optional narrowing",
);
assert(
  workbenchEvidenceLoaderSrc.includes("resolveWorkbenchExactEvidenceIdentity(row)") &&
    /row\?\.period_start/.test(
      controlSrc.match(
        /export function resolveWorkbenchExactEvidenceIdentity\([\s\S]*?\nfunction /,
      )?.[0] || "",
    ),
  "Workbench loader derives period_start from the selected queue row",
);
assert(
  workbenchEvidenceLoaderSrc.includes("if (!identity) return [];") &&
    workbenchEvidenceLoaderSrc.indexOf("if (!identity) return [];") <
      workbenchEvidenceLoaderSrc.indexOf("fetchAllRows") &&
    workbenchEvidenceLoaderSrc.indexOf("if (!identity) return [];") <
      workbenchEvidenceLoaderSrc.indexOf("costingFrom") &&
    !/getActivePeriodStart/.test(workbenchEvidenceLoaderSrc) &&
    !/ACTIVE_REFRESH_RUN/.test(workbenchEvidenceLoaderSrc) &&
    !/CONTROL_DASHBOARD_SUMMARY/.test(workbenchEvidenceLoaderSrc),
  "incomplete Workbench identity returns before fetchAllRows/costingFrom and ignores current-run helpers",
);
assert(
  /Unable to load exact frozen evidence because costing run context is incomplete/.test(
    workbenchEvidenceTabSrc,
  ),
  "Workbench missing exact-context state is distinct",
);
assert(
  /No exact material line evidence is available for this queue row/.test(
    controlSrc,
  ),
  "valid Workbench tuple + zero rows keeps empty-snapshot meaning",
);

const hierarchyBase = {
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 108,
  material_area: "RM",
  stock_item_id: 351,
  product_id: 1,
  sku_id: 2,
  product_name: "Product 1",
};
const hierarchyByValuation = buildWorkbenchEvidenceHierarchy([
  hierarchyBase,
  { ...hierarchyBase, valuation_date: "2026-08-08" },
]);
const hierarchyByRun = buildWorkbenchEvidenceHierarchy([
  hierarchyBase,
  { ...hierarchyBase, refresh_run_id: 109 },
]);
const hierarchySame = buildWorkbenchEvidenceHierarchy([
  hierarchyBase,
  { ...hierarchyBase, source_line_key: "B" },
]);
assert(
  hierarchyByValuation.subgroups.length === 2,
  "hierarchy separates rows differing only by valuation_date",
);
assert(
  hierarchyByRun.subgroups.length === 2,
  "hierarchy separates rows differing only by refresh_run_id",
);
assert(
  hierarchySame.subgroups.length === 1 &&
    hierarchySame.subgroups[0].period_start === "2026-08-01" &&
    hierarchySame.subgroups[0].valuation_date === "2026-08-07" &&
    hierarchySame.subgroups[0].refresh_run_id === 108,
  "subgroup object retains the exact costing tuple",
);

const shareTwinA = {
  ...hierarchyBase,
  source_line_key: "A",
};
const shareTwinB = {
  ...hierarchyBase,
  source_line_key: "B",
};
assert(
  canShareMaterialEvidenceTraceTarget([shareTwinA, shareTwinB]) === true,
  "same exact tuple remains shareable",
);
assert(
  canShareMaterialEvidenceTraceTarget([
    shareTwinA,
    { ...shareTwinB, valuation_date: "2026-08-08" },
  ]) === false,
  "different valuation_date is not shareable",
);
assert(
  canShareMaterialEvidenceTraceTarget([
    shareTwinA,
    { ...shareTwinB, refresh_run_id: 109 },
  ]) === false,
  "different refresh_run_id is not shareable",
);
assert(
  canShareMaterialEvidenceTraceTarget([
    shareTwinA,
    { ...shareTwinB, valuation_date: null },
  ]) === false,
  "missing valuation_date is not shareable",
);
assert(
  canShareMaterialEvidenceTraceTarget([
    shareTwinA,
    { ...shareTwinB, refresh_run_id: null },
  ]) === false,
  "missing refresh_run_id is not shareable",
);
assert(
  canShareMaterialEvidenceTraceTarget([
    { period_start: "2026-08-01", stock_item_id: 351, product_id: 1, sku_id: 2 },
  ]) === false,
  "period-only Trace sharing is rejected",
);

assert(
  /valuationDate/.test(navigateTraceSrc) &&
    /refreshRunId/.test(navigateTraceSrc) &&
    /line\?\.valuation_date/.test(navigateTraceSrc) &&
    /line\?\.refresh_run_id/.test(navigateTraceSrc) &&
    !/getActivePeriodStart/.test(navigateTraceSrc) &&
    !/line\.period_start\s*\|\|/.test(navigateTraceSrc),
  "Trace handoff forwards valuationDate/refreshRunId with no active-period fallback",
);
assert(
  /Exact frozen Trace cannot open because costing run context is incomplete/.test(
    navigateTraceSrc,
  ),
  "incomplete Trace identity shows an informational toast and does not navigate",
);

assert(
  /qs\.set\(\s*"valuation_date"/.test(buildRouteQuerySrc) &&
    /qs\.set\(\s*"refresh_run_id"/.test(buildRouteQuerySrc) &&
    /qs\.set\("family_route_id"/.test(buildRouteQuerySrc) &&
    /qs\.set\("route_family_id"/.test(buildRouteQuerySrc) &&
    /qs\.set\("product_route_id"/.test(buildRouteQuerySrc),
  "buildCostingRouteQuery emits valuation_date/refresh_run_id and retains PRM deep-link IDs",
);
assert(
  /valuationDate:/.test(normalizeDrillSrc) &&
    /refreshRunId:\s*normalizeDrillId/.test(normalizeDrillSrc) &&
    /payload\.valuation_date \|\| payload\.valuationDate/.test(normalizeDrillSrc) &&
    /payload\.refresh_run_id \?\? payload\.refreshRunId/.test(normalizeDrillSrc),
  "normalizeDrillContext round-trips valuationDate / refreshRunId",
);
assert(
  /pending\.valuationDate = normalized\.valuationDate/.test(stashPendingSrc) &&
    /pending\.refreshRunId = normalized\.refreshRunId/.test(stashPendingSrc),
  "stashPendingDrillContext retains the exact-run tuple",
);
assert(
  /valuation_date:\s*qp\.get\("valuation_date"\)/.test(applyRouteLaunchSrc) &&
    /refresh_run_id:\s*qp\.get\("refresh_run_id"\)/.test(applyRouteLaunchSrc),
  "applyRouteLaunchParams reads valuation_date / refresh_run_id from the URL",
);
assert(
  /params\.valuationDate = normalizedFilters\.valuationDate/.test(drillToTargetSrc) &&
    /params\.refreshRunId = normalizedFilters\.refreshRunId/.test(drillToTargetSrc) &&
    /applyTraceLaunchContext\(\{[\s\S]*\.\.\.normalizedFilters/.test(drillToTargetSrc),
  "same-route and new-tab drill paths retain exact-run launch fields",
);
assert(
  /rm-cost-trace/.test(controlSrc) && /pm-cost-trace/.test(controlSrc),
  "RM Trace / PM Trace handoff preserved",
);
assert(
  /resolveRecommendedUiRouteTarget/.test(controlSrc),
  "recommended route resolver still used for frozen remediation CTA",
);

// Types
assert(
  /rpc_get_current_material_foundation_diagnosis/.test(typesSrc),
  "supabase.ts includes foundation diagnosis RPC typing",
);
const skuControlSnapshotTypes =
  typesSrc.match(
    /v_costing_pricing_sku_control_status_snapshot:\s*\{\s*Row:\s*\{[\s\S]*?\n        \}/,
  )?.[0] || "";
assert(
  /refresh_run_id:\s*number\s*\|\s*null/.test(skuControlSnapshotTypes) &&
    /valuation_date:\s*string\s*\|\s*null/.test(skuControlSnapshotTypes),
  "SKU Control snapshot generated type includes exact-run valuation_date and refresh_run_id",
);

// Service worker (bump after successful smokes)
assert(
  /CACHE_NAME = "hub-cache-v324"/.test(swSrc),
  "service worker cache name remains hub-cache-v324",
);

await shellAsyncSkuDrawer();

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10G.3B.2 foundation evidence smokes passed.");
