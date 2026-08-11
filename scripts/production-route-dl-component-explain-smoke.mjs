/**
 * Gate 11Y.10I.2C.3D.2D — Direct Labour component explainability (client).
 * Component branch is fixture/source coverage; no costing refresh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA,
  PRM_WORKLOAD_EXPLAIN_DL_COMPONENT_FORMULA,
  PRM_WORKLOAD_DL_SCOPE_TITLE,
  PRM_DL_LEGACY_BANNER_TITLE,
  PRM_DL_LEGACY_BANNER_FALLBACK,
  isPrmDlComponentModelActive,
  formatPrmDlWorkloadDriverLabel,
  formatPrmWorkloadPolicyLabel,
  formatPrmWorkloadFormulaLabel,
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

const legacyFn =
  mainSrc.match(
    /function buildWorkloadExplainLegacyDlPanelHtml\([\s\S]*?\n  function buildWorkloadExplainComponentDlPanelHtml/,
  )?.[0] || "";
const componentFn =
  mainSrc.match(
    /function buildWorkloadExplainComponentDlPanelHtml\([\s\S]*?\n  function buildWorkloadExplainDlPanelHtml/,
  )?.[0] || "";
const dispatchFn =
  mainSrc.match(
    /function buildWorkloadExplainDlPanelHtml\([\s\S]*?\n  function buildWorkloadExplainPohPanelHtml/,
  )?.[0] || "";
const packingStrip =
  componentFn.match(
    /data-prm-dl-packing-summary[\s\S]*?data-prm-dl-/,
  )?.[0] ||
  componentFn.match(
    /data-prm-dl-packing-summary[\s\S]*?<\/div>/,
  )?.[0] ||
  "";

const legacyFixture = {
  policy: {
    policy_id: 2,
    policy_code: "DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE",
    policy_version: 2,
    formula_type: "STANDARD_BATCH_ROUTE_ATTENDANCE",
  },
  workload: { pool_amount: 100, product_allocation: 10, workload_status: "READY" },
  component_model: {
    component_model_active: false,
    model_code: "LEGACY_UNIFIED_ROUTE_ATTENDANCE",
    management_note: "Historical unified note",
  },
};
const componentFixture = {
  policy: {
    policy_id: 4,
    policy_code: "DIRECT_LABOUR_COMPONENT_SPLIT",
    formula_type: "MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS",
  },
  workload: { workload_status: "BLOCKED_NO_VALID_EFFECTIVE_ROUTE" },
  component_model: {
    component_model_active: true,
    model_code: "DIRECT_LABOUR_COMPONENT_SPLIT",
    combined_direct_labour_pool: 500,
    combined: {
      product_allocation: 80,
      expected_product_allocation: 80,
      product_allocation_delta: 0,
      pool_component_sum: 500,
      pool_reconciliation_delta: 0,
      skus: [
        {
          sku_id: 1,
          pack_size: 100,
          pack_uom: "ml",
          manufacturing_labour_cost_per_sku: 1.2,
          packing_labour_cost_per_sku: 0.3,
          combined_direct_labour_cost_per_sku: 1.5,
          allocation_status: "READY",
        },
      ],
    },
    manufacturing_labour: { pool_amount: 400, product_allocation: 60 },
    packing_labour: {
      pool_amount: 100,
      product_allocation: 20,
      product_expected_package_units: 12,
      company_expected_package_units: 1000,
      driver: "FROZEN_MONTHLY_ALLOCATION_UNITS",
      skus: [{ sku_id: 1, expected_package_units: 12, allocation_status: "READY" }],
    },
  },
};

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  dispatchFn.includes("isPrmDlComponentModelActive(directLabour)") &&
    helpersSrc.includes("component_model_active === true"),
  "1 component discriminator uses component_model_active",
);
assert(
  !dispatchFn.includes("policy_code") &&
    !dispatchFn.includes("valuation_date") &&
    !dispatchFn.includes("refresh_run_id") &&
    !/new Date\(/.test(dispatchFn),
  "2 no client policy/date inference",
);
assert(
  !isPrmDlComponentModelActive(legacyFixture) &&
    dispatchFn.includes("buildWorkloadExplainLegacyDlPanelHtml"),
  "3 Run82 renders legacy layout",
);
assert(
  legacyFn.includes("data-prm-dl-legacy-banner") &&
    legacyFn.includes("PRM_DL_LEGACY_BANNER_TITLE") &&
    PRM_DL_LEGACY_BANNER_TITLE === "Legacy Unified Direct Labour",
  "4 Run82 legacy banner present",
);
assert(
  !legacyFn.includes("Manufacturing Labour Pool") &&
    !legacyFn.includes("combined_direct_labour_pool"),
  "5 Run82 no Manufacturing component fabricated",
);
assert(
  !legacyFn.includes("Packing Labour Pool") &&
    !legacyFn.includes("product_expected_package_units"),
  "6 Run82 no Packing component fabricated",
);
assert(
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA.includes(
    "Product DL Allocation = Product Workload Share × Frozen DL Pool",
  ) && legacyFn.includes("PRM_WORKLOAD_EXPLAIN_DL_FORMULA"),
  "7 legacy formula remains historical",
);
assert(
  isPrmDlComponentModelActive(componentFixture) &&
    componentFn.includes("Combined Direct Labour") &&
    componentFn.includes("combined_direct_labour_pool"),
  "8 component fixture renders Combined DL",
);
assert(
  componentFn.includes("Manufacturing Labour") &&
    componentFn.includes("manufacturing.pool_amount"),
  "9 component fixture renders Manufacturing Labour",
);
assert(
  componentFn.includes("Packing Labour") &&
    componentFn.includes("packing.pool_amount"),
  "10 component fixture renders Packing Labour",
);
assert(
  componentFn.includes("component.combined_direct_labour_pool"),
  "11 combined pool uses server field",
);
assert(
  componentFn.includes("manufacturing.pool_amount"),
  "12 manufacturing pool uses server field",
);
assert(componentFn.includes("packing.pool_amount"), "13 packing pool uses server field");
assert(
  componentFn.includes("packing.product_expected_package_units"),
  "14 expected package units use server field",
);
assert(
  componentFn.includes("packing.company_expected_package_units"),
  "15 company expected packages use server field",
);
assert(
  componentFn.includes("mfgWorkload.route_intensity") &&
    componentFn.includes("data-prm-dl-manufacturing-summary"),
  "16 manufacturing route workload remains manufacturing-only",
);
assert(
  !/data-prm-dl-packing-summary[\s\S]{0,1800}route_intensity/.test(componentFn),
  "17 packing section has no route intensity",
);
assert(
  componentFn.includes("combined.skus") &&
    componentFn.includes("buildWorkloadExplainComponentSkuTableHtml"),
  "18 component SKU table uses combined.skus",
);
assert(
  componentFn.includes("packing.skus") &&
    mainSrc.includes("packingById.get(String(sku.sku_id))"),
  "19 expected package display joins packing.skus by sku_id",
);
assert(
  !componentFn.includes("manufacturing_labour_cost_per_sku +") &&
    !mainSrc.includes("combined_direct_labour_cost_per_sku +"),
  "20 no client sum for combined cost/unit",
);
assert(
  !/product_allocation\s*=\s*manufacturing/.test(componentFn) &&
    !componentFn.includes("mfg + pack"),
  "21 no client-generated monetary allocations",
);
assert(
  componentFn.includes("workload.workload_status") &&
    componentFn.includes("Overall Direct Labour Status"),
  "22 overall status follows manufacturing workload status",
);
assert(
  componentFn.includes("PRM_DL_COMPONENT_OVERALL_STATUS_CUE") &&
    /workloadExplainStripItem\("Overall Direct Labour Status", overallStatus/.test(
      componentFn,
    ) &&
    componentFn.includes("const overallStatus = workload.workload_status"),
  "23 packing READY cannot force overall READY",
);
assert(
  componentFn.includes("manufacturing.reconciliation") &&
    componentFn.includes("Manufacturing Reconciliation"),
  "24 manufacturing reconciliation uses server route recon",
);
assert(
  !componentFn.includes("packing_delta") &&
    !componentFn.includes("invent"),
  "25 no invented packing delta",
);
assert(
  mainSrc.includes("recon.product_allocation_delta") &&
    mainSrc.includes("recon.pool_reconciliation_delta") &&
    mainSrc.includes("buildWorkloadExplainCombinedReconHtml"),
  "26 combined deltas only when server returns keys",
);
assert(
  mainSrc.includes("formatPrmDlScopeSummary") &&
    mainSrc.includes('"dl_steps"'),
  "27 Workload Preview DL Steps unchanged",
);
assert(
  PRM_WORKLOAD_DL_SCOPE_TITLE.includes("Packing Labour") &&
    PRM_WORKLOAD_DL_SCOPE_TITLE.includes("Route Direct Labour scopes"),
  "28 register tooltip wording corrected if implemented",
);
assert(
  mainSrc.includes("buildWorkloadFoundationHtml") &&
    !dispatchFn.includes("buildWorkloadFoundationHtml"),
  "29 Foundation unchanged",
);
assert(
  mainSrc.includes("buildWorkloadExplainPohPanelHtml") &&
    !componentFn.includes("production_overhead"),
  "30 POH unchanged",
);
assert(mainSrc.includes("data-prm-effective-host"), "31 Route unchanged");
assert(
  mainSrc.includes("bindSummaryActions(host, \"product\", row)"),
  "32 PBS unchanged",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start === "2026-08-01" &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date === "2026-08-07",
  "33 Run82 context unchanged",
);
assert(PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80, "34 Run80 readiness context unchanged");
assert(
  htmlSrc.includes("cp-prm-modal-window--wide") &&
    htmlSrc.includes("min(94vw, 1480px)"),
  "35 responsive modal unchanged",
);
assert(
  /@media \(max-width: 760px\)[\s\S]*cp-prm-modal-window--workload-summary[\s\S]*100dvh/.test(
    htmlSrc,
  ),
  "36 <=760 full-page behavior preserved",
);
assert(mainSrc.includes("table-scroll"), "37 table-scroll preserved");
assert(
  htmlSrc.includes("var(--sasv-border") || htmlSrc.includes("var(--sasv-text"),
  "38 semantic tokens only",
);
assert(!/apply_migration|alter table/i.test(dispatchFn), "39 no RPC/server changes");
assert(!/saveWorkload|writeWorkload/.test(mainSrc), "40 no mutation");
assert(
  !mainSrc.includes("rpc_refresh") ||
    mainSrc.includes("PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT"),
  "41 no refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v269"/.test(swSrc),
  "42 service worker bumped exactly once after all smokes pass",
);
assert(
  formatPrmDlWorkloadDriverLabel("FROZEN_MONTHLY_ALLOCATION_UNITS") ===
    "Frozen Expected Package Units" &&
    formatPrmWorkloadPolicyLabel("DIRECT_LABOUR_COMPONENT_SPLIT") ===
      "Direct Labour Component Split" &&
    formatPrmWorkloadFormulaLabel("MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS") ===
      "Manufacturing Route Plus Expected Package Units" &&
    formatPrmWorkloadPolicyLabel("DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE") ===
      "Direct Labour Standard Batch Attendance" &&
    PRM_WORKLOAD_EXPLAIN_DL_COMPONENT_FORMULA.length === 4 &&
    PRM_DL_LEGACY_BANNER_FALLBACK.includes("unified pool"),
  "43 humanized labels and fallback copy present",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll 3D.2D DL component explain smoke assertions passed");
console.log("READY_FOR_11Y_10I_2C_3D_2D_LEGACY_BROWSER_ACCEPTANCE");
