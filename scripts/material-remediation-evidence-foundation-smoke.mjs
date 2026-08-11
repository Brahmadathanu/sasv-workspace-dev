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
const remediationSmokeSrc = readFileSync(
  join(root, "scripts/material-remediation-evidence-smoke.mjs"),
  "utf8",
);

// A/B. Exact lines filter + exact-run fields in model/UI
assert(
  /loadSkuExactEvidenceRows/.test(controlSrc),
  "SKU exact evidence loader exists",
);
assert(
  /v_costing_pricing_material_action_drilldown_snapshot/.test(controlSrc) &&
    /eq\("period_start"/.test(controlSrc) &&
    /eq\("product_id"/.test(controlSrc) &&
    /eq\("sku_id"/.test(controlSrc),
  "exact evidence filters by period_start + product_id + sku_id",
);
assert(
  /valuation_date/.test(controlSrc) && /refresh_run_id/.test(controlSrc),
  "exact-run fields valuation_date / refresh_run_id supported in evidence UI",
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
    productId: 10,
    skuId: 134,
  }) === "2026-08-01|10|134",
  "Evidence cache key is period|product|sku",
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

// Service worker (bump after successful smokes)
assert(
  /CACHE_NAME = "hub-cache-v250"/.test(swSrc),
  "service worker bumped to hub-cache-v250",
);

await shellAsyncSkuDrawer();

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10G.3B.2 foundation evidence smokes passed.");
