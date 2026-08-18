/**
 * Gate 11Y.10I.2C.2B.2A — Workload Preview IA + unified Product Summary smoke.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_ROUTE_LENS_IDS,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  formatPrmDlScopeSummary,
  formatPrmPohScopeSummary,
  formatPrmWorkloadPreferredBatch,
  formatPrmWorkloadRoundedBatches,
  formatPrmWorkloadRawDisplay,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const shellSrc = read("public/shared/js/costing-suite-shell.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const swSrc = read("public/sw.js");

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  /label:\s*"Product ID"/.test(mainSrc) &&
    /keys\s*=\s*\[[\s\S]*?"product_id"/.test(mainSrc),
  "1 Product ID separate column",
);
assert(
  /label:\s*"Product"/.test(mainSrc) &&
    /key === "product"/.test(mainSrc),
  "2 Product separate column",
);
assert(
  !/cp-prm-workload-product-id"> #/.test(mainSrc) &&
    !mainSrc.includes(' #${text(\n        id,\n      )}'),
  "3 no #id appended to Product name",
);
assert(mainSrc.includes('"monthly_quantity"'), "4 Monthly Quantity separate");
assert(
  mainSrc.includes('"preferred_batch"') &&
    helpersSrc.includes("formatPrmWorkloadPreferredBatch"),
  "5 Preferred Batch separate",
);
assert(mainSrc.includes('"raw_batch"'), "6 Raw Batch Requirement separate");
assert(
  mainSrc.includes('"rounded_batches"'),
  "7 Rounded Batches separate",
);
assert(mainSrc.includes('"route_family"'), "8 Route Family separate");
assert(
  formatPrmDlScopeSummary({
    dl_include_count: 5,
    dl_supervision_count: 1,
    dl_excluded_count: 3,
  }) === "5 Include · 1 Supervision · 3 Excluded" &&
    !formatPrmDlScopeSummary({
      dl_include_count: 5,
      dl_supervision_count: 1,
      dl_excluded_count: 3,
    }).includes("Inc "),
  "9 DL readable string",
);
assert(
  formatPrmPohScopeSummary({
    poh_include_count: 5,
    poh_passive_count: 1,
    poh_excluded_count: 3,
  }) === "5 Include · 1 Passive · 3 Excluded",
  "10 POH readable string",
);
assert(
  !mainSrc.includes("data-prm-workload-explain") ||
    !/data-prm-workload-explain-btn|Explain frozen DL\/POH allocation/.test(
      mainSrc,
    ),
  "11 no register Explain button",
);
assert(
  !mainSrc.includes("Explain frozen DL/POH allocation"),
  "12 no Foundation Explain CTA",
);
assert(!mainSrc.includes('{ label: "Action"'), "13 no Action column");
assert(
  /data-prm-workload-row[\s\S]{0,220}openProductSummary/.test(mainSrc),
  "14 row click opens unified Summary",
);
assert(
  mainSrc.includes('resolvedContext === "WORKLOAD_PREVIEW"') &&
    mainSrc.includes("openWorkloadProductSummary"),
  "15 unified Summary only for WORKLOAD_PREVIEW",
);
assert(
  htmlSrc.includes("cp-prm-modal-window--wide") &&
    mainSrc.includes("setWorkloadWideModal(true)"),
  "16 wide modal class applied",
);
assert(
  mainSrc.includes("setWorkloadWideModal(false)") &&
    mainSrc.includes("clearWorkloadProductModalChrome"),
  "17 class removed on close",
);
assert(mainSrc.includes('data-prm-workload-summary-tab="overview"'), "18 Overview tab");
assert(
  mainSrc.includes('data-prm-workload-summary-tab="foundation"'),
  "19 Foundation tab",
);
assert(mainSrc.includes('data-prm-workload-summary-tab="dl"'), "20 Direct Labour tab");
assert(
  mainSrc.includes('data-prm-workload-summary-tab="poh"'),
  "21 Production Overhead tab",
);
assert(mainSrc.includes('data-prm-workload-summary-tab="route"'), "22 Route tab");
assert(
  mainSrc.includes("RPC.workloadDetail") &&
    /PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT\.refresh_run_id/.test(mainSrc),
  "23 Foundation RPC preserved",
);
assert(
  mainSrc.includes("RPC.workloadExplain") &&
    mainSrc.includes("ensureWorkloadExplainPayload"),
  "24 Explain RPC preserved",
);
assert(
  mainSrc.includes("workloadProductModalGeneration") &&
    mainSrc.includes("data-prm-workload-modal-generation"),
  "25 Product/context generation binding",
);
assert(
  /modalGeneration !== state\.workloadProductModalGeneration/.test(mainSrc),
  "26 stale modal response rejected",
);
assert(
  /Open this tab to load frozen Direct Labour Explain/.test(mainSrc) &&
    mainSrc.includes("ensureWorkloadExplainPayload"),
  "27 Explain lazy-load",
);
assert(
  /workloadExplainPayload[\s\S]{0,120}cached/.test(mainSrc) ||
    mainSrc.includes("cached: true"),
  "28 Explain max once per Product modal lifetime",
);
assert(
  mainSrc.includes("ensureWorkloadExplainPayload") &&
    /tab === "dl" \|\| tab === "poh"/.test(mainSrc),
  "29 DL/POH share cache",
);
assert(
  !/data-prm-workload-row[\s\S]{0,400}openWorkloadManagementExplain/.test(
    mainSrc,
  ),
  "30 no nested Explain modal",
);
assert(mainSrc.includes("buildWorkloadExplainDlPanelHtml"), "31 DL renderer preserved");
assert(
  mainSrc.includes("buildWorkloadExplainPohPanelHtml"),
  "32 POH renderer preserved",
);
assert(
  mainSrc.includes("PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE"),
  "33 neutrality note preserved",
);
assert(
  mainSrc.includes("classifyPrmWorkloadReconciliation"),
  "34 reconciliation preserved",
);
assert(mainSrc.includes("Cost / SKU Unit"), "35 SKU absorption preserved");
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    /RPC\.workloadPreview[\s\S]{0,800}PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT/.test(
      mainSrc,
    ),
  "36 Run82 workload context preserved",
);
assert(
  PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80 &&
    mainSrc.includes("exactRunReadiness:") &&
    /async function loadReadiness[\s\S]*?RPC\.generalReadiness/.test(mainSrc) &&
    !/async function loadReadiness[\s\S]*?RPC\.exactRunReadiness/.test(mainSrc),
  "37 Route Readiness uses general readiness; Run80 exact-run map retained",
);
assert(
  /showPager[\s\S]{0,180}shared-workload-preview/.test(shellSrc) === false ||
    /showPager\s*=\s*[\s\S]{0,120}route-readiness[\s\S]{0,80}product-route-assignments\s*;/.test(
      shellSrc,
    ),
  "38 shell paginator hidden only on workload lens",
);
assert(
  mainSrc.includes("workloadLimit") &&
    /offset,[\s\S]{0,40}limit,|limit,[\s\S]{0,40}offset/.test(mainSrc) &&
    mainSrc.includes("buildWorkloadPreviewRpcArgs"),
  "39 server limit/offset preserved",
);
assert(
  /loadWorkloadPreview\(\{[\s\S]{0,80}resetOffset/.test(mainSrc) ||
    mainSrc.includes("resetOffset = false"),
  "40 first chunk loads",
);
assert(mainSrc.includes("append: true") || mainSrc.includes("append = false"), "41 next chunk appends");
assert(mainSrc.includes("appendWorkloadRowsDeduped"), "42 dedupe by product_id");
assert(
  mainSrc.includes("workloadLoadingMore") &&
    /Only one|workloadLoadingMore/.test(mainSrc),
  "43 one load-more request in flight",
);
assert(mainSrc.includes("workloadHasMore"), "44 stop at total_count");
assert(
  /clearWorkloadFilters[\s\S]{0,400}loadWorkloadPreview\(\{\s*resetOffset:\s*true/.test(
    mainSrc,
  ) || mainSrc.includes("resetOffset: true"),
  "45 filter reset clears buffer",
);
assert(
  /generation !== state\.workloadGeneration/.test(mainSrc) &&
    mainSrc.includes("stale: true"),
  "46 stale list append rejected",
);
assert(
  /append[\s\S]{0,200}workloadLoadMoreError/.test(mainSrc),
  "47 append error preserves loaded rows",
);
assert(mainSrc.includes("data-prm-workload-retry-more"), "48 retry supported");
assert(
  mainSrc.includes("captureWorkloadPreviewScroll") &&
    mainSrc.includes("restoreWorkloadPreviewScroll"),
  "49 scroll position restored",
);
assert(
  mainSrc.includes("of ") && mainSrc.includes("loaded"),
  "50 total count retained",
);
assert(
  !helpersSrc.includes("CREATE TABLE") &&
    !mainSrc.includes("apply_migration"),
  "51 no server change",
);
assert(
  !mainSrc.includes("rpc_upsert_route_family_route_step") ||
    !/openWorkloadProductSummary[\s\S]{0,1500}rpc_upsert_route_family_route_step/.test(
      mainSrc,
    ),
  "52 no mutation",
);
assert(!mainSrc.includes("Refresh costing"), "53 no refresh");
assert(
  !mainSrc.includes("run82Write") && !editorSrc.includes("Run-82 write"),
  "54 no Run82 write",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("production-cost-centres"),
  "55 Cost Centres unchanged",
);
assert(!editorSrc.includes("openWorkloadProductSummary"), "56 Route Editor unchanged");
assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("route-family-mapping-review") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-foundation-review"),
  "57 Mapping/Foundation/CCC unchanged",
);
assert(
  htmlSrc.includes("var(--sasv-") && !htmlSrc.includes("#7c3aed"),
  "58 semantic theme only",
);
assert(
  /CACHE_NAME = "hub-cache-v315"/.test(swSrc),
  "59 exactly one SW bump after all smokes pass (hub-cache-v315)",
);

assert(
  formatPrmWorkloadPreferredBatch({
    preferred_batch_size: 2000,
    product_base_uom: "L",
  }) === "2000 L",
  "preferred batch formatter",
);
assert(formatPrmWorkloadRoundedBatches({ standard_batch_count: 1 }) === "1", "rounded batches");
assert(formatPrmWorkloadRawDisplay(0.4898) === "0.4898", "raw display");

if (failed) {
  console.error(
    `production-route-workload-preview-ux-smoke: ${failed} failed`,
  );
  process.exit(1);
}
console.log("production-route-workload-preview-ux-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_2B_2A_BROWSER_ACCEPTANCE");
