/**
 * Gate 11Y.10G.3B.2 — Material Evidence & Foundation Remediation UX smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSkuExactEvidenceCacheKey,
  buildSkuFoundationDiagnosisCacheKey,
  formatFoundationStatusLabel,
  formatSkuEvidenceAreaLabel,
  isUnverifiedFoundationRoute,
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
const skuControlSnapshotParitySrc = readFileSync(
  join(
    root,
    "supabase/migrations/20260917113016_expose_exact_run_context_on_sku_control_snapshot_view.sql",
  ),
  "utf8",
);
const remediationSmokeSrc = readFileSync(
  join(root, "scripts/material-remediation-evidence-smoke.mjs"),
  "utf8",
);

const skuExactEvidenceLoaderSrc =
  controlSrc.match(
    /async function loadSkuExactEvidenceRows\([\s\S]*?\n  function /,
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

// Source-control parity for already-applied SKU Control snapshot exact-run columns
assert(
  /SOURCE-CONTROL PARITY/.test(skuControlSnapshotParitySrc) &&
    /DO NOT reapply to production/.test(skuControlSnapshotParitySrc) &&
    /expose_exact_run_context_on_sku_control_snapshot_view/.test(
      skuControlSnapshotParitySrc,
    ),
  "SKU Control snapshot migration is source-control parity for the live production change",
);
assert(
  /security_invoker\s*=\s*true/.test(skuControlSnapshotParitySrc) &&
    /v_current_successful_costing_refresh_run/.test(
      skuControlSnapshotParitySrc,
    ) &&
    /DIRECT_LABOUR_ROUTE_BLOCKED/.test(skuControlSnapshotParitySrc) &&
    /grant select on public\.v_costing_pricing_sku_control_status_snapshot to authenticated, service_role/.test(
      skuControlSnapshotParitySrc,
    ),
  "parity view keeps invoker security, current-successful-run join, DL override, and SELECT grants",
);
assert(
  /s\.ok_margin_percent_before_scheme,\s*s\.valuation_date,\s*s\.refresh_run_id/s.test(
    skuControlSnapshotParitySrc,
  ),
  "valuation_date and refresh_run_id are appended after existing snapshot columns",
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
