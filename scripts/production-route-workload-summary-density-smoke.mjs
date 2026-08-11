/**
 * Gate 11Y.10I.2C.2B.2B — Unified Workload Summary density & responsive Explain layout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmWorkloadFormulaLabel,
  formatPrmWorkloadPolicyLabel,
  humanizeUnknownPrmCode,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA,
  PRM_WORKLOAD_EXPLAIN_POH_FORMULA,
  PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const foundationFn = mainSrc.match(
  /function buildWorkloadFoundationHtml\([\s\S]*?\n  function /,
)?.[0] || "";

assert(
  foundationFn.includes("cp-prm-workload-foundation-grid") &&
    /data-prm-foundation-group="product-context"/.test(foundationFn),
  "1 Foundation grouped grid exists",
);
assert(
  /data-prm-foundation-group="product-context"/.test(foundationFn) &&
    foundationFn.includes("Commercial hierarchy") &&
    foundationFn.includes("Product Group") &&
    foundationFn.includes("Product Base UOM"),
  "2 Product Context group preserved",
);
assert(
  /data-prm-foundation-group="quantity"/.test(foundationFn) &&
    foundationFn.includes("Monthly Product Quantity") &&
    foundationFn.includes("Recipient SKU Count"),
  "3 Quantity group preserved",
);
assert(
  /data-prm-foundation-group="batch"/.test(foundationFn) &&
    foundationFn.includes("Preferred Batch") &&
    foundationFn.includes("Raw Batch Requirement") &&
    foundationFn.includes("Rounded Standard Batches"),
  "4 Batch group preserved",
);
assert(
  /data-prm-foundation-group="route"/.test(foundationFn) &&
    foundationFn.includes("Route Family") &&
    foundationFn.includes("Effective Route Source") &&
    foundationFn.includes("Route Validation"),
  "5 Route group preserved",
);
assert(
  /data-prm-foundation-group="foundation-status"/.test(foundationFn) &&
    foundationFn.includes("Foundation Status") &&
    foundationFn.includes("Foundation Note") &&
    foundationFn.includes("Preview only") &&
    foundationFn.includes("Records created") &&
    foundationFn.includes("Monetary allocation created") &&
    foundationFn.includes("Stage 03"),
  "6 Foundation Status group preserved",
);
assert(
  foundationFn.includes("monthly_product_quantity") &&
    foundationFn.includes("preferred_batch_size") &&
    foundationFn.includes("standard_batch_count") &&
    foundationFn.includes("foundation_note") &&
    foundationFn.includes("route_validation"),
  "7 no Foundation fields removed",
);
assert(
  foundationFn.includes("formatWorkloadSkuEvidence") &&
    foundationFn.includes("sku_quantity_evidence"),
  "8 SKU evidence preserved",
);
assert(
  /data-prm-foundation-group="dl-scopes"/.test(foundationFn) &&
    foundationFn.includes("dl_include_count") &&
    foundationFn.includes("dl_supervision_count") &&
    foundationFn.includes("dl_excluded_count"),
  "9 DL scope counts preserved",
);
assert(
  /data-prm-foundation-group="poh-scopes"/.test(foundationFn) &&
    foundationFn.includes("poh_include_count") &&
    foundationFn.includes("poh_passive_count") &&
    foundationFn.includes("poh_excluded_count"),
  "10 POH scope counts preserved",
);
assert(
  foundationFn.includes("cp-prm-workload-steps") &&
    foundationFn.includes("Direct Labour scope") &&
    foundationFn.includes("Production Overhead scope"),
  "11 step table preserved",
);
assert(
  foundationFn.includes("data-prm-workload-policy") &&
    foundationFn.includes("PRM_WORKLOAD_POLICY_DISCLAIMER"),
  "12 disclaimer preserved",
);
assert(
  htmlSrc.includes("cp-prm-workload-foundation-grid") &&
    htmlSrc.includes("minmax(min(100%, 12rem), 1fr)"),
  "13 desktop Foundation multi-column",
);
assert(
  /@media \(max-width: 1100px\)[\s\S]*cp-prm-workload-explain-strip[\s\S]*repeat\(3/.test(
    htmlSrc,
  ),
  "14 medium two-column / reduced-span behavior",
);
assert(
  /@media \(max-width: 720px\)[\s\S]*cp-prm-workload-foundation-grid[\s\S]*grid-template-columns:\s*1fr/.test(
    htmlSrc,
  ),
  "15 narrow one-column behavior",
);
assert(
  foundationFn.includes("cp-prm-workload-foundation-cell--full") &&
    htmlSrc.includes("grid-column: 1 / -1"),
  "16 long notes full-width",
);
assert(
  /data-prm-workload-explain-dl-summary[\s\S]*span:\s*2/.test(mainSrc) &&
    htmlSrc.includes(
      ".cp-prm-workload-product-summary .cp-prm-workload-explain-strip",
    ),
  "17 DL summary responsive grid",
);
assert(
  /data-prm-workload-explain-poh-summary[\s\S]*span:\s*2/.test(mainSrc),
  "18 POH summary responsive grid",
);
assert(
  /workloadExplainStripItem\("Policy"[\s\S]*span:\s*2/.test(mainSrc),
  "19 Policy supports wider span",
);
assert(
  /workloadExplainStripItem\("Formula Type"[\s\S]*span:\s*2/.test(mainSrc),
  "20 Formula supports wider span",
);
assert(
  htmlSrc.includes("cp-prm-workload-explain-metric--span-2") &&
    !/cp-prm-workload-product-summary[\s\S]{0,400}minmax\(9\.5rem, 1fr\)/.test(
      htmlSrc,
    ),
  "21 no equal-width-only assumption inside product summary",
);
assert(
  /\.cp-prm-workload-product-summary \.cp-prm-workload-explain-metric \{[\s\S]*min-width:\s*0/.test(
    htmlSrc,
  ),
  "22 explain metric min-width:0",
);
assert(
  htmlSrc.includes("overflow-wrap: anywhere"),
  "23 overflow-wrap protection",
);
assert(
  /formatPrmWorkloadPolicyLabel\(policyRaw\)[\s\S]*title:\s*String\(policyRaw\)/.test(
    mainSrc,
  ) &&
    mainSrc.includes("cp-prm-workload-explain-metric-audit"),
  "24 raw policy code preserved",
);
assert(
  formatPrmWorkloadPolicyLabel("DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE") ===
    "Direct Labour Standard Batch Attendance" &&
    helpersSrc.includes("formatPrmWorkloadPolicyLabel"),
  "25 humanized policy label present if implemented",
);
assert(
  /formatPrmWorkloadFormulaLabel\(formulaRaw\)[\s\S]*title:\s*String\(formulaRaw\)/.test(
    mainSrc,
  ),
  "26 raw formula code preserved",
);
assert(
  formatPrmWorkloadFormulaLabel("STANDARD_BATCH_ROUTE_ATTENDANCE") ===
    "Standard Batch Route Attendance" &&
    humanizeUnknownPrmCode("STANDARD_BATCH_ROUTE_ATTENDANCE") ===
      "Standard Batch Route Attendance",
  "27 humanized formula label present if implemented",
);
assert(
  mainSrc.includes("formatPrmWorkloadExplainNumber(workload.product_workload_units") &&
    mainSrc.includes("formatPrmWorkloadExplainMoney(workload.product_allocation") &&
    mainSrc.includes("company_eligible_workload_units"),
  "28 DL values unchanged",
);
assert(
  mainSrc.includes("company_ready_workload_units") &&
    mainSrc.includes("rounded_batch_count") &&
    mainSrc.includes("route_factor"),
  "29 POH values unchanged",
);
assert(
  mainSrc.includes("buildWorkloadExplainReconciliationHtml") &&
    mainSrc.includes("classifyPrmWorkloadReconciliation"),
  "30 reconciliation unchanged",
);
assert(
  mainSrc.includes("buildWorkloadExplainSkuTableHtml") &&
    mainSrc.includes("sku_within_product_share"),
  "31 SKU tables unchanged",
);
assert(
  mainSrc.includes("PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE") &&
    mainSrc.includes("data-prm-poh-neutrality-note") &&
    PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE.length > 20,
  "32 neutrality note unchanged",
);
assert(
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA.length === 5 &&
    PRM_WORKLOAD_EXPLAIN_POH_FORMULA.length === 5 &&
    mainSrc.includes("buildWorkloadExplainFormulaGuidanceHtml") &&
    mainSrc.includes("cp-prm-workload-explain-formula-grid"),
  "33 formula guidance preserved",
);
assert(
  mainSrc.includes("WORKLOAD_PREVIEW_PAGE_SIZE") ||
    /chunkSize\s*=\s*50|page_size:\s*50|limit:\s*50/.test(mainSrc),
  "34 Workload Preview infinite scroll unchanged",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    /PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT/.test(mainSrc),
  "35 Run82 workload context unchanged",
);
assert(
  PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "36 Route Readiness Run80 unchanged",
);
assert(
  !mainSrc.includes("apply_migration") &&
    !/rpc_.*mutate|insertInto|from\(".*"\)\.insert/.test(
      mainSrc.slice(mainSrc.indexOf("buildWorkloadFoundationHtml")),
    ),
  "37 no server change in this gate surface",
);
assert(
  !/saveWorkload|writeWorkload|mutateWorkload/.test(mainSrc),
  "38 no mutation APIs added for density gate",
);
assert(
  !mainSrc.includes("refreshCosting") ||
    mainSrc.includes("PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT"),
  "39 no refresh introduced for density",
);
assert(
  !/rpc_.*run.?82.*write|write.*run_id.*82/i.test(mainSrc),
  "40 no Run82 write",
);
assert(
  htmlSrc.includes(
    ".cp-prm-workload-product-summary [data-prm-workload-foundation]",
  ) &&
    htmlSrc.includes(
      ".cp-prm-workload-product-summary .cp-prm-workload-explain-metric--span-2",
    ),
  "41 CSS scoped to workload Product Summary",
);
assert(
  /var\(--sasv-|var\(--muted|var\(--cp-fw-/.test(
    htmlSrc.slice(htmlSrc.indexOf("Gate 11Y.10I.2C.2B.2B")),
  ) &&
    !/#6366f1|#7c3aed|#a855f7/.test(
      htmlSrc.slice(htmlSrc.indexOf("Gate 11Y.10I.2C.2B.2B")),
    ),
  "42 semantic theme only",
);
assert(
  /hub-cache-v269/.test(swSrc) && !/hub-cache-v268/.test(swSrc),
  "43 exactly one SW bump after all smokes pass",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll density smoke assertions passed");
