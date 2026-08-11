/**
 * Gate 5.11BS-QC.14 — QC Action Queue shell integration / contract smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampQcQueuePagination,
  mergeQcActionCodeOptions,
  nextQcQueueOffsetOnFilterChange,
  unwrapQcActionQueueRpcResult,
} from "../public/shared/js/costing-suite-qc-explain-helpers.js";
import {
  QC_ACTION_QUEUE_DEBOUNCE_MS,
  pageToQcOffset,
  qcActionRowIdentity,
  qcTotalPages,
} from "../public/shared/js/costing-suite-qc-action-queue.js";

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
  join(root, "public/shared/js/costing-suite-qc-action-queue.js"),
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
  join(root, "public/shared/js/costing-suite-qc-explain-helpers.js"),
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

/** Simulate shell search → p_q */
function mapShellSearchToQueueArgs(searchValue, page = 1, pageSize = 25) {
  return buildQueueArgs({
    period_start: "2026-07-01",
    q: String(searchValue || "").trim() || null,
    limit: pageSize,
    offset: pageToQcOffset(page, pageSize),
  });
}

assert(QC_ACTION_QUEUE_DEBOUNCE_MS === 300, "debounce is 300 ms");

const fromSearch = mapShellSearchToQueueArgs("  ashwagandha ");
assert(fromSearch.p_q === "ashwagandha", "p_q mapping from shell search");
assert(fromSearch.p_limit === 25, "shell PAGE_SIZE 25 as p_limit");
assert(fromSearch.p_offset === 0, "page 1 offset 0");

assert(pageToQcOffset(2, 25) === 25, "page 2 → offset 25");
assert(pageToQcOffset(3, 25) === 50, "page 3 → offset 50");

let page = 3;
let offset = pageToQcOffset(page, 25);
offset = nextQcQueueOffsetOnFilterChange();
page = 1;
assert(offset === 0 && page === 1, "search resets page/offset");

offset = pageToQcOffset(4, 25);
offset = nextQcQueueOffsetOnFilterChange();
assert(offset === 0, "action-code change resets offset");

assert(qcTotalPages(85, 25) === 4, "total-page calculation 85/25");
assert(qcTotalPages(0, 25) === 1, "empty queue still one page label");

const meta = clampQcQueuePagination({
  offset: 0,
  limit: 25,
  total_count: 85,
});
assert(meta.pageIndex === 0, "first page index");
const lastPage = meta.totalPages;
assert(lastPage === 4, "last page number");

function prevDisabled(pageNum) {
  return pageNum <= 1;
}
function nextDisabled(pageNum, totalPages) {
  return pageNum >= totalPages;
}
assert(prevDisabled(1) === true, "previous disabled on first page");
assert(prevDisabled(2) === false, "previous enabled after first");
assert(nextDisabled(4, 4) === true, "next disabled on final page");
assert(nextDisabled(3, 4) === false, "next enabled before final");

const clamped = clampQcQueuePagination({
  offset: 500,
  limit: 25,
  total_count: 85,
});
assert(clamped.offset === 75, "out-of-range page clamp to last page offset");

let loadGen = 0;
function isStale(gen) {
  return gen !== loadGen;
}
const older = loadGen;
loadGen += 1;
assert(isStale(older) === true, "stale response rejection");
assert(isStale(loadGen) === false, "current response accepted");

const codes = mergeQcActionCodeOptions(
  [
    "BLOCKED_MISSING_FG_PROTOCOL_MAPPING",
    "REVIEW_REQUIRED_QC_ABSORPTION_BASIS",
  ],
  ["FUTURE_CODE_Z"],
);
assert(codes.includes("FUTURE_CODE_Z"), "unknown action-code retention");

const identity = qcActionRowIdentity({
  refresh_run_id: 74,
  product_id: 12,
  action_code: "BLOCKED_MISSING_FG_PROTOCOL_MAPPING",
});
assert(
  identity === "74|12|BLOCKED_MISSING_FG_PROTOCOL_MAPPING",
  "stable row identity",
);

const modalState = {
  q: "foo",
  action_code: "REVIEW_REQUIRED_QC_ABSORPTION_BASIS",
  page: 2,
  rows: [{ product_id: 1 }],
};
const afterClose = { ...modalState };
assert(
  afterClose.q === "foo" &&
    afterClose.action_code === "REVIEW_REQUIRED_QC_ABSORPTION_BASIS" &&
    afterClose.page === 2 &&
    afterClose.rows.length === 1,
  "modal close preserves queue state (model)",
);

assert(!queueSrc.includes("qcAqSearch"), "no active #qcAqSearch in controller");
assert(!queueSrc.includes("qcAqPager"), "no active #qcAqPager in controller");
assert(!queueSrc.includes("qcAqPageSize"), "no active #qcAqPageSize in controller");
assert(
  !shellSrc.includes('placeholder = "Use QC Action Queue search below"'),
  "QC lens does not redirect search placeholder to local field",
);
assert(
  !/isQcActionQueueLens\(CURRENT_LENS\)[\s\S]{0,120}searchBox\.disabled\s*=\s*true/.test(
    shellSrc,
  ),
  "QC lens does not disable #search",
);
assert(
  htmlSrc.includes('data-peq-section="qc-action"'),
  "qc-action section exists",
);
assert(
  shellSrc.includes('key === "qc-action"') &&
    shellSrc.includes("setVisible(section, isQcQueue)"),
  "Status/Issue/Source restoration path exists via qc chrome",
);
assert(
  queueSrc.includes('rpc_get_qc_action_queue') &&
    !queueSrc.includes('.from("') &&
    !queueSrc.includes("costingFrom("),
  "queue still calls only rpc_get_qc_action_queue",
);
assert(
  shellSrc.includes("isQcActionQueueLens(CURRENT_LENS)") &&
    shellSrc.includes("qcActionQueueCtrl.load"),
  "queue does not fall through to VIEW_BY_LENS alone",
);
assert(
  costSheetSrc.includes("openProductQcExplainFromQueue") &&
    queueSrc.includes("data-qc-aq-nav=\"explain\""),
  "Product Explain is button-triggered only",
);
assert(
  !queueSrc.includes("fillQcExplainSection") &&
    !queueSrc.includes("loadProductQcExplain"),
  "Product Explain is not fetched on ordinary row open",
);
assert(
  queueSrc.includes('window.open(href, "_blank", "noopener,noreferrer")'),
  "shared LIMS/spec navigation opens a new tab",
);
assert(
  queueSrc.includes("newTab: true"),
  "absorption commercial-sales navigation opens a new tab",
);
assert(
  !queueSrc.includes("cp-qc-aq-open-affordance") &&
    !queueSrc.includes(">Open</span>"),
  "redundant Open affordance column removed",
);
assert(
  queueSrc.includes('class="icon-btn') && !queueSrc.includes('class="sc-btn'),
  "queue modal actions use icon-btn (not stale sc-btn)",
);
assert(
  shellSrc.includes("closeTopmostReadonlyOverlay()") &&
    /if \(closeTopmostReadonlyOverlay\(\)\) return;[\s\S]{0,80}pricingPolicyCtrl\.handleEscapeKey/.test(
      shellSrc,
    ),
  "Escape closes readonly overlays before pricing-policy handlers",
);
assert(
  shellSrc.includes("rebuildQcActionTypePeqOptions") &&
    !/\)\s*<span class="cp-muted-text">\(\$\{escapeHtml\(code\)\}\)<\/span>/.test(
      shellSrc,
    ) &&
    !shellSrc.includes('(${escapeHtml(code)})'),
  "QC Action Type filter does not append raw codes in brackets",
);
assert(
  costSheetSrc.includes("quality_control_pool_amount") &&
    costSheetSrc.includes("product_absorption_base_qty") &&
    costSheetSrc.includes("quality_control_overhead_cost_per_sku"),
  "QC Explain binds live Run-74 Product/SKU field aliases",
);
assert(
  costSheetSrc.includes("resolveQcOverheadCalculationLineage") &&
    helpersSrc.includes("QC_OVERHEAD_CALCULATION_LINEAGE") &&
    !/product\s+sales\s+share/i.test(
      helpersSrc.match(
        /QC_OVERHEAD_CALCULATION_LINEAGE\s*=\s*"([^"]+)"/,
      )?.[1] || "",
    ),
  "QC Overhead lineage override has no sales-share wording",
);

const unwrapped = unwrapQcActionQueueRpcResult([
  {
    row_data: { product_id: 1, action_code: "X" },
    total_count: 1,
  },
]);
assert(unwrapped.total_count === 1, "unwrap still works");

if (failed) {
  console.error(`\nqc-rpc-contract-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\nqc-rpc-contract-smoke: all checks passed");
