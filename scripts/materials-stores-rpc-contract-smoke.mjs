/**
 * Materials / Stores Action Queue shell integration / RPC contract smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampMsQueuePagination,
  mergeMsActionCodeOptions,
  nextMsQueueOffsetOnFilterChange,
  unwrapMaterialsStoresActionQueueRpcResult,
} from "../public/shared/js/costing-suite-materials-stores-explain-helpers.js";
import {
  MATERIALS_STORES_ACTION_QUEUE_DEBOUNCE_MS,
  pageToMsOffset,
  msActionRowIdentity,
} from "../public/shared/js/costing-suite-materials-stores-action-queue.js";
import { msTotalPages } from "../public/shared/js/costing-suite-materials-stores-explain-helpers.js";

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
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const queueSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-materials-stores-action-queue.js"),
  "utf8",
);
const htmlSrc = readFileSync(
  join(root, "public/shared/cost-sheet-review.html"),
  "utf8",
);
const costSheetSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-cost-sheet.js"),
  "utf8",
);
const helpersSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-materials-stores-explain-helpers.js"),
  "utf8",
);
const routeSrc = readFileSync(
  join(root, "public/shared/js/costing-route-config.js"),
  "utf8",
);
const registrySrc = readFileSync(
  join(root, "public/shared/js/costing-suite-registry.js"),
  "utf8",
);
const typesSrc = readFileSync(
  join(root, "public/shared/js/types/supabase.ts"),
  "utf8",
);

function buildQueueArgs({
  period_start = null,
  action_code = null,
  q = null,
  limit = 25,
  offset = 0,
} = {}) {
  return {
    p_period_start: period_start,
    p_action_code: action_code,
    p_q: q,
    p_limit: limit,
    p_offset: offset,
  };
}

function mapShellSearchToQueueArgs(searchValue, page = 1, pageSize = 25) {
  return buildQueueArgs({
    period_start: "2026-07-01",
    q: String(searchValue || "").trim() || null,
    limit: pageSize,
    offset: pageToMsOffset(page, pageSize),
  });
}

assert(MATERIALS_STORES_ACTION_QUEUE_DEBOUNCE_MS === 300, "debounce is 300 ms");

const fromSearch = mapShellSearchToQueueArgs("  abhraka ");
assert(fromSearch.p_q === "abhraka", "p_q mapping from shell search");
assert(fromSearch.p_limit === 25, "shell PAGE_SIZE 25 as p_limit");
assert(fromSearch.p_offset === 0, "page 1 offset 0");

assert(pageToMsOffset(2, 25) === 25, "page 2 → offset 25");
assert(nextMsQueueOffsetOnFilterChange() === 0, "filter resets offset");
assert(msTotalPages(85, 25) === 4, "total-page calculation");
assert(msTotalPages(0, 25) === 1, "empty queue still one page label");

const clamped = clampMsQueuePagination({
  offset: 500,
  limit: 25,
  total_count: 85,
});
assert(clamped.offset === 75, "out-of-range page clamp");

assert(
  mergeMsActionCodeOptions(
    ["BLOCKED_MISSING_PM_REFERENCE_OUTPUT"],
    ["FUTURE_Z"],
  ).includes("FUTURE_Z"),
  "unknown action-code retention",
);

assert(
  msActionRowIdentity({
    refresh_run_id: 74,
    sku_id: 12,
    action_code: "BLOCKED_MISSING_PM_REFERENCE_OUTPUT",
  }) === "74|12|BLOCKED_MISSING_PM_REFERENCE_OUTPUT",
  "stable SKU-grained row identity",
);

assert(
  unwrapMaterialsStoresActionQueueRpcResult([
    { total_count: 1, row_data: { sku_id: 1, action_code: "X" } },
  ]).rows.length === 1,
  "unwrap row_data contract",
);

assert(
  queueSrc.includes("rpc_get_materials_stores_action_queue") &&
    !queueSrc.includes('.from("') &&
    !queueSrc.includes("costingFrom("),
  "queue calls only rpc_get_materials_stores_action_queue",
);
assert(
  !queueSrc.includes("rpc_get_qc_action_queue"),
  "MS queue does not call QC RPC",
);
assert(
  !/\.from\(["']costing\./.test(helpersSrc) &&
    !/\.from\(["']costing\./.test(queueSrc) &&
    !queueSrc.includes("costingFrom(") &&
    !helpersSrc.includes("costingFrom("),
  "no direct costing schema view queries in MS helpers/queue",
);
assert(
  !queueSrc.includes("sales_share") &&
    !/from\(["'][^"']*sales_share/.test(helpersSrc),
  "no legacy sales-share Materials / Stores view",
);

assert(
  shellSrc.includes("isMaterialsStoresActionQueueLens(CURRENT_LENS)") &&
    shellSrc.includes("materialsStoresActionQueueCtrl.load"),
  "shell short-circuits MS queue load",
);
assert(
  shellSrc.includes('placeholder = "Search Product, Product ID, SKU ID or action"'),
  "search placeholder exact (no pack claim)",
);
assert(
  !/isMaterialsStoresActionQueueLens\(CURRENT_LENS\)[\s\S]{0,120}searchBox\.disabled\s*=\s*true/.test(
    shellSrc,
  ),
  "MS lens does not disable #search",
);
assert(
  htmlSrc.includes('data-peq-section="ms-action"') &&
    shellSrc.includes('key === "ms-action"'),
  "ms-action PEQ section wired",
);
assert(
  htmlSrc.includes("BLOCKED_MISSING_PM_REFERENCE_OUTPUT") &&
    htmlSrc.includes("BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE") &&
    htmlSrc.includes("REVIEW_MONTHLY_ALLOCATION_BASIS") &&
    htmlSrc.includes("REVIEW_ZERO_PM_CLASSIFICATION_REQUIRED") &&
    htmlSrc.includes("REVIEW_ZERO_RM_CLASSIFICATION_REQUIRED"),
  "five seed action codes in HTML",
);
assert(
  htmlSrc.includes("Missing PM reference output") &&
    htmlSrc.includes("No RM or PM standard evidence") &&
    htmlSrc.includes("Review monthly allocation basis") &&
    htmlSrc.includes("Classify zero PM requirement") &&
    htmlSrc.includes("Classify zero RM requirement"),
  "friendly labels in HTML",
);

assert(
  costSheetSrc.includes("openSkuMaterialsStoresExplainFromQueue") &&
    queueSrc.includes('data-ms-aq-nav="sku-explain"'),
  "SKU Explain is primary button-triggered",
);
assert(
  costSheetSrc.includes("openProductMaterialsStoresExplainFromQueue") &&
    queueSrc.includes('data-ms-aq-nav="product-explain"'),
  "Product Explain is secondary button-triggered",
);
assert(
  !queueSrc.includes("fillMsExplainSection") &&
    !queueSrc.includes("loadSkuMaterialsStoresExplain"),
  "Explain is not fetched on ordinary row open",
);
assert(
  queueSrc.includes('issue: ["MATERIAL_RATE_MANAGER_RM"]') &&
    queueSrc.includes('source: ["RM"]') &&
    queueSrc.includes("newTab: true"),
  "RM MCM navigation uses Manual Rate Manager filters in new tab",
);
assert(
  queueSrc.includes('issue: ["MATERIAL_RATE_MANAGER_PM"]') &&
    queueSrc.includes('source: ["PM"]'),
  "PM MCM navigation uses Manual Rate Manager PM filters",
);
assert(
  queueSrc.includes("COSTING_MONTHLY_ALLOCATION_BASIS") &&
    queueSrc.includes("openSkuMaterialsStoresExplainFromQueue"),
  "monthly-basis route stays in CSR Explain",
);
assert(
  costSheetSrc.includes('MATERIALS_STORES_OVERHEAD_LINE_LABEL') &&
    costSheetSrc.includes("fillMsExplainSection") &&
    costSheetSrc.includes("fillMonthlyAllocationDriverSection"),
  "MS overhead compose includes MS + Monthly Driver",
);
assert(
  /showMs[\s\S]{0,200}showMonthly/.test(costSheetSrc) ||
    /renderMsExplainLoading\(\)[\s\S]{0,120}renderMonthlyAllocationDriverLoading/.test(
      costSheetSrc,
    ),
  "composition order MS before Monthly",
);

assert(
  registrySrc.includes('"materials-stores-action-queue"') &&
    routeSrc.includes('"materials-stores-action-queue"'),
  "lens registered in suite + route config",
);
assert(
  typesSrc.includes("rpc_get_materials_stores_action_queue") &&
    typesSrc.includes("rpc_get_product_materials_stores_explain") &&
    typesSrc.includes("rpc_get_sku_materials_stores_explain"),
  "additive supabase RPC types present",
);

assert(
  shellSrc.includes("qcActionQueueCtrl.load") &&
    shellSrc.includes("isQcActionQueueLens"),
  "QC lens wiring untouched",
);
assert(
  costSheetSrc.includes("fillQcExplainSection") &&
    costSheetSrc.includes("fillMarketingExplainSection") &&
    costSheetSrc.includes("fillMonthlyAllocationDriverSection"),
  "QC / Marketing / Monthly Driver fill paths preserved",
);

assert(
  costSheetSrc.includes("resolveMsOverheadDescription") &&
    costSheetSrc.includes("resolveMsOverheadCalculation") &&
    costSheetSrc.includes("resolveMsOverheadSourceNote") &&
    costSheetSrc.includes("resolveMsOverheadSourceLineage"),
  "MS canonical Explain adapters wired",
);
assert(
  costSheetSrc.includes("resolveQcOverheadCalculationLineage") &&
    costSheetSrc.includes("scrubObsoleteQcSalesShareText"),
  "QC lineage scrub helpers still present",
);
assert(
  /else if \(isMsOverhead\)/.test(costSheetSrc) ||
    /isMsOverhead[\s\S]{0,80}resolveMsOverheadCalculation/.test(costSheetSrc),
  "MS override is exclusive of QC branch",
);
assert(
  costSheetSrc.includes("Overall Cost Sheet status") &&
    costSheetSrc.includes('kvSection("Materials / Stores status"'),
  "status scopes remain distinct in UI",
);
assert(
  helpersSrc.includes("MS_OVERHEAD_CALCULATION") &&
    !/product\s+sales\s+share/i.test(
      helpersSrc.match(/MS_OVERHEAD_CALCULATION\s*=\s*[^;]+/)?.[0] || "",
    ),
  "helper canonical calculation has no sales-share",
);
assert(
  !queueSrc.includes("resolveMsOverhead") &&
    !queueSrc.includes("MS_OVERHEAD_CALCULATION"),
  "queue controller does not own Explain lineage scrub",
);

if (failed) {
  console.error(`FAILED materials-stores-rpc-contract-smoke (${failed})`);
  process.exit(1);
}
console.log("PASSED materials-stores-rpc-contract-smoke");
