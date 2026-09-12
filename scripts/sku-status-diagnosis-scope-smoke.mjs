/**
 * Static smoke: SKU status diagnosis must be selected-SKU on demand only.
 * Never period-wide fetchAllRows against v_costing_pricing_sku_status_diagnosis.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const shellSrc = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);

let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${msg}`);
}

assert(
  shellSrc.includes("function ensureSkuStatusDiagnosis("),
  "ensureSkuStatusDiagnosis helper exists",
);

assert(
  shellSrc.includes("function clearSkuStatusDiagnosisCache("),
  "cache clear helper exists",
);

assert(
  shellSrc.includes("function lensNeedsSkuStatusDiagnosis("),
  "lens capability helper exists",
);

assert(
  /lensNeedsSkuStatusDiagnosis\([^)]*\)\s*\{[\s\S]*?sku-cost-sheet[\s\S]*?isSchemeComparisonLens/.test(
    shellSrc,
  ),
  "capability helper covers sku-cost-sheet and scheme-comparison only",
);

assert(
  !/function isCsrDeferredDiagnosisLens\(/.test(shellSrc),
  "deferred period-wide diagnosis lens helper removed",
);

assert(
  !/function loadSkuStatusDiagnosis\(/.test(shellSrc) &&
    !/function scheduleDeferredSkuStatusDiagnosis\(/.test(shellSrc),
  "period-wide load and deferred scheduler removed",
);

assert(
  !/scheduleDeferredSkuStatusDiagnosis\s*\(/.test(shellSrc) &&
    !/await\s+loadSkuStatusDiagnosis\s*\(/.test(shellSrc),
  "no period-wide diagnosis call sites remain",
);

const diagnosisViewHits = [
  ...shellSrc.matchAll(/v_costing_pricing_sku_status_diagnosis/g),
];
assert(
  diagnosisViewHits.length >= 1,
  "diagnosis view still referenced for selected-SKU fetch",
);

assert(
  !/fetchAllRows\s*\(\s*\(\s*\)\s*=>[\s\S]{0,400}v_costing_pricing_sku_status_diagnosis/.test(
    shellSrc,
  ) &&
    !/fetchAllRows\s*\([\s\S]{0,500}v_costing_pricing_sku_status_diagnosis/.test(
      shellSrc,
    ),
  "no fetchAllRows around v_costing_pricing_sku_status_diagnosis",
);

const ensureFn = shellSrc.match(
  /async function ensureSkuStatusDiagnosis\([\s\S]*?\nfunction getSkuDiagnosis/,
);
assert(!!ensureFn, "ensureSkuStatusDiagnosis body extractable");
const ensureBody = ensureFn ? ensureFn[0] : "";
assert(
  /\.eq\(\s*["']period_start["']/.test(ensureBody) &&
    /\.eq\(\s*["']sku_id["']/.test(ensureBody) &&
    /\.limit\(\s*1\s*\)/.test(ensureBody),
  "selected-SKU query includes period_start, sku_id, and limit(1)",
);
assert(
  !/fetchAllRows/.test(ensureBody),
  "ensure path does not use fetchAllRows",
);

const loadRowsFn = shellSrc.match(
  /async function loadRowsForLens\([\s\S]*?\nasync function /,
);
assert(!!loadRowsFn, "loadRowsForLens extractable");
const loadRowsBody = loadRowsFn ? loadRowsFn[0] : "";
assert(
  /clearSkuStatusDiagnosisCache\s*\(/.test(loadRowsBody),
  "loadRowsForLens clears diagnosis cache on lens start",
);
assert(
  !/ensureSkuStatusDiagnosis\s*\(/.test(loadRowsBody) &&
    !/v_costing_pricing_sku_status_diagnosis/.test(loadRowsBody),
  "Pricing Policy Manager / lens startup does not invoke diagnosis load",
);
assert(
  !/cost-comparison[\s\S]{0,200}ensureSkuStatusDiagnosis/.test(loadRowsBody) &&
    !/isCsrDeferredDiagnosisLens/.test(loadRowsBody),
  "cost-comparison does not preload diagnosis",
);

assert(
  shellSrc.includes("function skuTabNeedsStatusDiagnosis(") &&
    /skuTabNeedsStatusDiagnosis\([^)]*\)\s*\{[\s\S]*?overview[\s\S]*?cost-layers[\s\S]*?scheme/.test(
      shellSrc,
    ),
  "diagnosis consumer tabs are explicitly scoped (overview/cost-layers/scheme)",
);

const renderSkuTabFn = shellSrc.match(
  /async function renderSkuTab\([\s\S]*?\nfunction setModalTabs/,
);
assert(!!renderSkuTabFn, "renderSkuTab extractable");
const renderSkuTabBody = renderSkuTabFn ? renderSkuTabFn[0] : "";
assert(
  /lensNeedsSkuStatusDiagnosis\s*\(\s*CURRENT_LENS\s*\)/.test(renderSkuTabBody) &&
    /skuTabNeedsStatusDiagnosis\s*\(\s*tabId\s*\)/.test(renderSkuTabBody) &&
    /await\s+ensureSkuStatusDiagnosis\s*\(/.test(renderSkuTabBody),
  "CSR selected-SKU drawer path gates ensure behind lens + tab eligibility",
);
assert(
  !/tabId\s*===\s*["']selling-price["'][\s\S]{0,200}ensureSkuStatusDiagnosis/.test(
    renderSkuTabBody,
  ) &&
    !/["']selling-price["'][\s\S]{0,80}skuTabNeedsStatusDiagnosis/.test(
      shellSrc.match(
        /function skuTabNeedsStatusDiagnosis\([\s\S]*?\nfunction isRowsLoadCurrent/,
      )?.[0] || "",
    ),
  "selling-price does not trigger ensure / is not a diagnosis consumer tab",
);
assert(
  /if\s*\(\s*[\s\S]*?lensNeedsSkuStatusDiagnosis\s*\(\s*CURRENT_LENS\s*\)[\s\S]*?skuTabNeedsStatusDiagnosis\s*\(\s*tabId\s*\)[\s\S]*?\)\s*\{[\s\S]*?await\s+ensureSkuStatusDiagnosis/.test(
    renderSkuTabBody,
  ),
  "ensure is only called inside the dual eligibility guard",
);

assert(
  /if\s*\(\s*!lensNeedsSkuStatusDiagnosis\s*\(\s*CURRENT_LENS\s*\)\s*\)\s*\{[\s\S]*?return\s*\{\s*applied:\s*false,\s*stale:\s*true/.test(
    ensureBody,
  ),
  "non-diagnosis lens fails eligibility before query",
);
const ensureLensGuardIdx = ensureBody.search(
  /if\s*\(\s*!lensNeedsSkuStatusDiagnosis\s*\(\s*CURRENT_LENS\s*\)\s*\)/,
);
const ensureQueryIdx = ensureBody.search(
  /costingFrom\s*\(\s*["']v_costing_pricing_sku_status_diagnosis["']/,
);
assert(
  ensureLensGuardIdx >= 0 &&
    ensureQueryIdx >= 0 &&
    ensureLensGuardIdx < ensureQueryIdx,
  "lens eligibility guard runs before PostgREST diagnosis query",
);

assert(
  /DIAGNOSIS_CACHE_PERIOD_START/.test(shellSrc) &&
    /clearSkuStatusDiagnosisCache\s*\(/.test(shellSrc) &&
    /setActiveCostingPeriod[\s\S]{0,400}clearSkuStatusDiagnosisCache/.test(
      shellSrc,
    ),
  "cache is period-scoped via clear on period change and lens load",
);

assert(
  /isRowsLoadCurrent/.test(ensureBody) &&
    /SELECTED_ROW/.test(ensureBody) &&
    /ACTIVE_PERIOD_START/.test(ensureBody),
  "stale load / selection / period guards remain in ensure",
);

assert(
  shellSrc.includes(
    "Costing diagnosis could not be loaded. Existing cost and scheme data are still displayed.",
  ) && /reportFailure/.test(ensureBody),
  "diagnosis toast retained for drawer failure context (not suppressed)",
);

assert(
  !/slice\(\s*0\s*,\s*\d+\s*\)/.test(ensureBody) &&
    !/\.range\(\s*0\s*,\s*\d+\s*\)/.test(ensureBody),
  "no arbitrary result cap used as correctness workaround",
);

assert(
  !/showToast\s*\(\s*["']Costing diagnosis could not be loaded[\s\S]{0,200}catch\s*\(\s*err\s*\)\s*\{\s*\}/.test(
    shellSrc,
  ),
  "no empty catch toast-suppression pattern around diagnosis",
);

if (failed) {
  console.error(`\n${failed} SKU status diagnosis scope smoke assertion(s) failed`);
  process.exit(1);
}
console.log("\nSKU status diagnosis scope smoke passed");
