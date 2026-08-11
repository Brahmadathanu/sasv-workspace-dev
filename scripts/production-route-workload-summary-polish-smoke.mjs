/**
 * Gate 11Y.10I.2C.2B.2C — Workload Summary navigation, hierarchy & narrow modal polish.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmPreferredBatchSizeHandoffAction,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  classifyPrmWorkloadReconciliation,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildSupplyBatchPlanPreferredBatchSizeHandoffUrl,
  PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL,
  PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL_MISSING,
} from "../public/shared/js/supply-batch-size-references.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const refsSrc = read("public/shared/js/supply-batch-size-references.js");
const swSrc = read("public/sw.js");

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const openWorkloadBind = mainSrc.match(
  /function openWorkloadProductSummary\([\s\S]*?\n  function openProductSummary/,
)?.[0] || "";
const foundationFn = mainSrc.match(
  /function buildWorkloadFoundationHtml\([\s\S]*?\n  async function fillProductSummaryWorkloadHost/,
)?.[0] || "";
const reconFn = mainSrc.match(
  /function buildWorkloadExplainReconciliationHtml\([\s\S]*?\n  function buildWorkloadExplainSkuTableHtml/,
)?.[0] || "";
const dlFn = mainSrc.match(
  /function buildWorkloadExplainDlStepRows\([\s\S]*?\n  function buildWorkloadExplainPohPanelHtml/,
)?.[0] || "";
const pohFn = mainSrc.match(
  /function buildWorkloadExplainPohPanelHtml\([\s\S]*?\n  function buildWorkloadExplainModalHtml/,
)?.[0] || "";

assert(
  openWorkloadBind.includes('bindSummaryActions(host, "product", row)'),
  "1 workload Summary calls existing summary-action binder",
);
assert(
  mainSrc.includes('actionId === "preferred-batch-size"') &&
    mainSrc.includes('action === "preferred-batch-size"'),
  "2 preferred-batch action has bound handler",
);
assert(
  mainSrc.includes("buildPrmPreferredBatchSizeHandoffAction") &&
    refsSrc.includes("buildSupplyBatchPlanPreferredBatchSizeHandoffUrl"),
  "3 canonical PBS URL builder reused",
);
assert(
  buildSupplyBatchPlanPreferredBatchSizeHandoffUrl(149).includes(
    "product_id=149",
  ) &&
    buildSupplyBatchPlanPreferredBatchSizeHandoffUrl(149).includes(
      "tab=batch-sizes",
    ),
  "4 product_id passed",
);
assert(
  !mainSrc.includes("supply-batch-plan.html?focus=") &&
    !mainSrc.includes("openSupplyBatchPlanCustom"),
  "5 no new PBS path",
);
assert(
  buildPrmPreferredBatchSizeHandoffAction({ product_id: 1 }).mutation === false &&
    refsSrc.includes("autoMutate: false"),
  "6 no PBS mutation",
);
assert(
  foundationFn.includes('workloadSectionHead("Batch"') &&
    foundationFn.includes('data-prm-summary-action="preferred-batch-size"') &&
    foundationFn.includes("cp-prm-link-btn"),
  "7 Batch action in section header",
);
assert(
  !/Preferred Batch[\s\S]{0,120}preferred-batch-size/.test(foundationFn) ||
    !foundationFn.includes("${preferredHandoffHtml}"),
  "8 no orphan action under metric",
);
assert(
  PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL === "Open in Supply Batch Plan" &&
    buildPrmPreferredBatchSizeHandoffAction({
      product_id: 1,
      preferred_batch_size: 50,
    }).label === "Open in Supply Batch Plan",
  "9 preferred-present label correct",
);
assert(
  PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL_MISSING === "Open Supply Batch Plan" &&
    buildPrmPreferredBatchSizeHandoffAction({
      product_id: 1,
      preferred_batch_size: null,
    }).label === "Open Supply Batch Plan",
  "10 preferred-missing label correct",
);
assert(
  mainSrc.includes("function workloadSectionHead") &&
    htmlSrc.includes(".cp-prm-workload-section-head") &&
    htmlSrc.includes(".cp-prm-workload-section-title"),
  "11 section-head primitive exists",
);
assert(
  /cp-prm-workload-section-head[\s\S]*border-bottom:\s*1px solid var\(--sasv-border/.test(
    htmlSrc,
  ),
  "12 semantic divider token used",
);
assert(
  /workloadSectionHead\("Product Context"\)/.test(foundationFn) &&
    /workloadSectionHead\("Quantity"\)/.test(foundationFn) &&
    /workloadSectionHead\("SKU Quantity Evidence"\)/.test(foundationFn) &&
    /workloadSectionHead\("Route"\)/.test(foundationFn) &&
    /workloadSectionHead\("DL Scopes"\)/.test(foundationFn) &&
    /workloadSectionHead\("POH Scopes"\)/.test(foundationFn) &&
    /workloadSectionHead\("Step Table"\)/.test(foundationFn) &&
    /workloadSectionHead\("Foundation Status"\)/.test(foundationFn),
  "13 Foundation major groups separated",
);
assert(
  dlFn.includes('workloadSectionHead("Policy / Unified Workload Summary")') &&
    dlFn.includes('workloadSectionHead("Step Labour Factors")') &&
    dlFn.includes('workloadSectionHead("Formula Guidance")') &&
    dlFn.includes('workloadSectionHead("SKU Absorption")'),
  "14 DL sections separated",
);
assert(
  pohFn.includes('workloadSectionHead("Policy / Workload Summary")') &&
    pohFn.includes('workloadSectionHead("Step Factors")') &&
    pohFn.includes('workloadSectionHead("Formula Guidance")') &&
    pohFn.includes('workloadSectionHead("SKU Absorption")'),
  "15 POH sections separated",
);
assert(
  openWorkloadBind.includes('workloadSectionHead("Product Route Family Assignment")') &&
    openWorkloadBind.includes('workloadSectionHead("Effective Route")'),
  "16 Route groups separated where appropriate",
);
assert(
  !htmlSrc.includes("box-shadow: 0 22px") ||
    !/cp-prm-workload-section-head[\s\S]{0,200}box-shadow/.test(htmlSrc),
  "17 no heavy card explosion on section heads",
);
assert(
  reconFn.includes("cp-prm-workload-explain-recon-grid") &&
    htmlSrc.includes("cp-prm-workload-explain-recon-grid"),
  "18 reconciliation responsive grid exists",
);
assert(reconFn.includes('"Step Sum"'), "19 Step Sum retained");
assert(
  reconFn.includes('"Route Intensity / Factor"'),
  "20 Route intensity/factor retained",
);
assert(reconFn.includes('"Route Delta"'), "21 Route delta retained");
assert(
  reconFn.includes('"Expected Workload"') &&
    reconFn.includes('"Stored Workload"'),
  "22 expected/stored workload retained",
);
assert(reconFn.includes('"Workload Delta"'), "23 workload delta retained");
assert(
  reconFn.includes('"Expected Share"') && reconFn.includes('"Stored Share"'),
  "24 expected/stored share retained",
);
assert(
  reconFn.includes("workload_share_delta") &&
    reconFn.includes("share_delta") &&
    reconFn.includes("Share Delta"),
  "25 share delta shown only if returned",
);
assert(
  reconFn.includes('"Expected Allocation"') &&
    reconFn.includes('"Stored Allocation"'),
  "26 expected/stored allocation retained",
);
assert(
  reconFn.includes("product_allocation_delta") &&
    reconFn.includes("allocation_delta") &&
    reconFn.includes("Allocation Delta"),
  "27 allocation delta shown only if returned",
);
assert(
  reconFn.includes("classifyPrmWorkloadReconciliation") &&
    classifyPrmWorkloadReconciliation({ workload_units_delta: 0 }).label ===
      "Reconciled",
  "28 reconciliation classification unchanged",
);
assert(
  mainSrc.includes("buildWorkloadExplainSkuTableHtml") &&
    mainSrc.includes("sku_within_product_share"),
  "29 SKU table unchanged",
);
assert(
  foundationFn.includes("cp-prm-workload-steps") &&
    dlFn.includes("cp-prm-workload-explain-table"),
  "30 step table unchanged",
);
assert(
  foundationFn.includes("cp-prm-workload-foundation-full") &&
    htmlSrc.includes("grid-column: 1 / -1"),
  "31 long prose full-width",
);
assert(
  /@media \(max-width: 760px\)[\s\S]*cp-prm-modal-window--workload-summary/.test(
    htmlSrc,
  ),
  "32 <=760 workload full-page rule exists",
);
assert(/width:\s*100vw/.test(htmlSrc), "33 width 100vw");
assert(/height:\s*100dvh/.test(htmlSrc), "34 height 100dvh");
assert(
  /cp-prm-modal-window--workload-summary[\s\S]*max-width:\s*none[\s\S]*max-height:\s*none/.test(
    htmlSrc,
  ),
  "35 max dimensions removed at narrow",
);
assert(
  htmlSrc.includes("min(94vw, 1480px)") && htmlSrc.includes("max-height: 90vh"),
  "36 desktop wide modal unchanged",
);
assert(
  mainSrc.includes("cp-prm-modal-window--workload-summary") &&
    mainSrc.includes("cp-prm-modal-overlay--workload-summary"),
  "37 full-page rule scoped to workload Summary only",
);
assert(
  /clearWorkloadProductModalChrome[\s\S]*cp-prm-modal-window--workload-summary[\s\S]*cp-prm-modal-overlay--workload-summary/.test(
    mainSrc,
  ),
  "38 modal classes clear on close",
);
assert(
  htmlSrc.includes("modal-close-btn") &&
    /workload-summary[\s\S]*modal-close-btn/.test(htmlSrc),
  "39 close visible",
);
assert(
  /cp-prm-workload-explain-tabs[\s\S]*overflow-x:\s*auto/.test(htmlSrc) &&
    /flex-wrap:\s*nowrap/.test(htmlSrc),
  "40 narrow tabs scroll horizontally",
);
assert(
  openWorkloadBind.includes(">Overview<") &&
    openWorkloadBind.includes(">Foundation<") &&
    openWorkloadBind.includes(">Direct Labour<") &&
    openWorkloadBind.includes(">Production Overhead<") &&
    openWorkloadBind.includes(">Route<") &&
    !openWorkloadBind.includes(">DL<") &&
    !openWorkloadBind.includes(">POH<"),
  "41 no tab abbreviation",
);
assert(
  /@media \(max-width: 720px\)[\s\S]*foundation-grid[\s\S]*grid-template-columns:\s*1fr/.test(
    htmlSrc,
  ),
  "42 narrow metric grid one-column",
);
assert(
  foundationFn.includes("table-scroll") && dlFn.includes("table-scroll"),
  "43 table-scroll preserved",
);
assert(
  mainSrc.includes("ensureWorkloadExplainPayload") &&
    mainSrc.includes("workloadExplainPayload"),
  "44 Explain cache unchanged",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82,
  "45 Run82 workload context unchanged",
);
assert(
  PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "46 Route Readiness Run80 unchanged",
);
assert(
  mainSrc.includes("appendWorkloadRowsDeduped"),
  "47 infinite scroll unchanged",
);
assert(
  mainSrc.includes("restoreWorkloadPreviewScroll") &&
    mainSrc.includes("captureWorkloadPreviewScroll"),
  "48 scroll restoration unchanged",
);
assert(
  !/apply_migration|alter table/i.test(mainSrc),
  "49 no RPC/server changes",
);
assert(!/saveWorkload|writeWorkload/.test(mainSrc), "50 no mutation");
assert(
  !mainSrc.includes("refreshCostingFromWorkloadPolish"),
  "51 no refresh",
);
assert(!/rpc_.*run.?82.*write/i.test(mainSrc), "52 no Run82 write");
assert(
  /var\(--sasv-border/.test(
    htmlSrc.slice(htmlSrc.indexOf("Gate 11Y.10I.2C.2B.2C")),
  ),
  "53 semantic theme only",
);
assert(
  /CACHE_NAME = "hub-cache-v269"/.test(swSrc),
  "54 exactly one SW bump after all smokes pass",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll 2B.2C polish smoke assertions passed");
console.log("READY_FOR_11Y_10I_2C_2B_2C_BROWSER_ACCEPTANCE");
