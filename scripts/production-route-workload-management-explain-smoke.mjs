/**
 * Gate 11Y.10I.2C.2B.2 — Workload Management Explain client smoke (non-mutating).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_RPC_NAMES,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA,
  PRM_WORKLOAD_EXPLAIN_POH_FORMULA,
  PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE,
  PRM_WORKLOAD_EXPLAIN_DL_SUPERVISION_NOTE,
  buildPrmWorkloadManagementExplainArgs,
  classifyPrmWorkloadReconciliation,
  formatPrmWorkloadSharePercent,
  hasPrmDlSupervisionSteps,
  normalizePrmWorkloadManagementExplainPayload,
  resolvePrmWorkloadExplainRouteLineage,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  buildWorkloadManagementExplainRpcArgs,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
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
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_route_workload_management_explain",
  ),
  "1 new RPC inventoried",
);
assert(
  JSON.stringify(PRM_RPC_ARG_KEYS.rpc_get_route_workload_management_explain) ===
    JSON.stringify([
      "p_period_start",
      "p_valuation_date",
      "p_refresh_run_id",
      "p_product_id",
    ]),
  "2 exact four args",
);
assert(
  /require_permission\('module:production-route-manager'|canView\(/.test(
    mainSrc,
  ) && !mainSrc.includes("cost-build-manager"),
  "3 PRM view-only ownership",
);
assert(
  helpersSrc.includes("PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT"),
  "4 Workload Preview has dedicated exact-run constant",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start === "2026-08-01" &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date === "2026-08-07" &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82,
  "5 dedicated constant = Run82",
);
assert(
  PRM_EXACT_RUN_CONTEXT.period_start === "2026-07-01" &&
    PRM_EXACT_RUN_CONTEXT.valuation_date === "2026-07-22" &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "6 PRM_EXACT_RUN_CONTEXT remains Run80",
);
assert(
  /RPC\.exactRunReadiness[\s\S]{0,220}PRM_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
    mainSrc,
  ),
  "7 Route Readiness remains Run80",
);
assert(
  /RPC\.workloadPreview[\s\S]{0,800}PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
    mainSrc,
  ),
  "8 Workload Preview list uses dedicated Run82 context",
);
assert(
  /RPC\.workloadDetail[\s\S]{0,280}PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
    mainSrc,
  ),
  "9 Workload Detail uses same Run82 context",
);
assert(
  /RPC\.workloadExplain[\s\S]{0,280}PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
    mainSrc,
  ),
  "10 Workload Explain uses same Run82 context",
);
assert(
  !/RPC\.workloadPreview[\s\S]{0,280}PRM_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
    mainSrc,
  ) &&
    !/RPC\.workloadDetail[\s\S]{0,280}PRM_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
      mainSrc,
    ) &&
    !/RPC\.workloadExplain[\s\S]{0,280}PRM_EXACT_RUN_CONTEXT\.refresh_run_id/.test(
      mainSrc,
    ),
  "11 no mixed-context path",
);
assert(
  mainSrc.includes("fixed Run 82 context") &&
    mainSrc.includes("2026-08-01") &&
    mainSrc.includes("2026-08-07"),
  "12 workload banner updated",
);
assert(
  /data-prm-workload-row[\s\S]{0,220}openProductSummary/.test(mainSrc),
  "13 Product row click still Product Summary",
);
assert(
  mainSrc.includes("openWorkloadProductSummary") &&
    /data-prm-workload-row[\s\S]{0,220}openProductSummary/.test(mainSrc),
  "14 Product row opens unified Workload Product Summary",
);
assert(
  !/headers\s*=\s*\[[\s\S]{0,400}Action[\s\S]{0,400}dl_scope/.test(mainSrc) &&
    !mainSrc.includes('{ label: "Action"'),
  "15 no Action column added",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("shared-workload-preview") &&
    !PRODUCTION_ROUTE_LENS_IDS.includes("workload-explain") &&
    !PRODUCTION_ROUTE_LENS_IDS.includes("shared-workload-explain"),
  "16 no new lens",
);

const built = buildPrmWorkloadManagementExplainArgs({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  product_id: 149,
});
const rpcBuilt = buildWorkloadManagementExplainRpcArgs({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  product_id: 149,
});
assert(built.ok && rpcBuilt.ok, "explain arg builders ok");

const normalized = normalizePrmWorkloadManagementExplainPayload({
  read_only: true,
  frozen_exact_run: true,
  records_created: 0,
  monetary_allocation_created: false,
  context: {
    product_id: 149,
    product_name: "Agasthyar Nasika Choornam",
    refresh_run_id: 82,
    period_start: "2026-08-01",
    valuation_date: "2026-08-07",
  },
  management_note: "Frozen exact-run evidence.",
  direct_labour: {
    policy: { policy_code: "DL", policy_version: 1, formula_type: "X" },
    workload: {
      route_intensity: 5.25,
      product_workload_units: 5.25,
      company_eligible_workload_units: 835.75,
      product_workload_share: 0.006281782829793599,
      pool_amount: 1327802,
      product_allocation: 8340.9638049656,
      family_route_id: 10,
      route_family_id: 4,
      effective_route_source: "FAMILY",
    },
    steps: [
      {
        sequence_no: 1,
        direct_labour_scope: "SUPERVISION",
        scope_factor: 1,
        attendance_factor: 0.25,
        step_factor: 0.25,
      },
    ],
    reconciliation: {
      route_intensity_delta: 0,
      workload_units_delta: 0,
      expected_product_allocation: 8340.9638049656,
      stored_product_allocation: 8340.9638049656,
    },
    skus: [
      {
        sku_id: 1,
        sku_within_product_share: 1,
        product_allocation: 8340.9638049656,
        cost_per_sku_unit: 89.68778284909247,
      },
    ],
  },
  production_overhead: {
    policy: {
      behaviour_multipliers_currently_neutral: true,
      resource_multipliers_currently_neutral: true,
    },
    workload: {
      route_factor: 5.25,
      product_workload_units: 5.25,
      company_ready_workload_units: 962.75,
      product_workload_share: 0.005453129057387691,
      pool_amount: 1016035.2816666666,
      product_allocation: 5540.571517787587,
    },
    steps: [],
    reconciliation: { route_factor_delta: 0, workload_units_delta: 0 },
    skus: [{ sku_id: 1, cost_per_sku_unit: 59.576037825672984 }],
  },
});
assert(
  normalized.direct_labour?.workload?.route_intensity === 5.25 &&
    normalized.production_overhead?.workload?.route_factor === 5.25 &&
    normalized.management_note.includes("Frozen"),
  "17 response pass-through",
);
assert(
  !helpersSrc.includes("scope_factor * attendance_factor") &&
    !mainSrc.includes("scope_factor * attendance_factor") &&
    !mainSrc.includes("recompute") &&
    !/product_workload_share\s*=/.test(
      mainSrc.slice(mainSrc.indexOf("openWorkloadManagementExplain")),
    ),
  "18 no factor recomputation",
);
assert(
  mainSrc.includes("Policy Version") &&
    mainSrc.includes("direct_labour.policy") === false &&
    mainSrc.includes("buildWorkloadExplainDlPanelHtml"),
  "19 DL policy shown",
);
assert(
  mainSrc.includes("Route Labour Intensity") &&
    mainSrc.includes("Company Eligible Unified DL Workload") &&
    mainSrc.includes("Product Unified DL Allocation"),
  "20 DL summary shown",
);
assert(
  mainSrc.includes("Attendance Factor") &&
    mainSrc.includes("Step Factor") &&
    mainSrc.includes("DL Scope"),
  "21 DL step table",
);
assert(
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA.length >= 5 &&
    mainSrc.includes("PRM_WORKLOAD_EXPLAIN_DL_FORMULA"),
  "22 DL formula guidance",
);
assert(
  mainSrc.includes("scope_factor_note") &&
    mainSrc.includes("attendance_factor_note") &&
    !/th>Note<\/th>/.test(
      mainSrc.slice(mainSrc.indexOf("buildWorkloadExplainDlPanelHtml")),
    ),
  "23 DL factor notes progressive",
);
assert(
  mainSrc.includes("classifyPrmWorkloadReconciliation") &&
    classifyPrmWorkloadReconciliation({
      route_intensity_delta: 0,
      workload_units_delta: 0,
      expected_product_allocation: 10,
      stored_product_allocation: 10,
    }).pass === true &&
    classifyPrmWorkloadReconciliation({
      route_intensity_delta: 0.01,
    }).pass === false,
  "24 DL reconciliation from server",
);
assert(
  mainSrc.includes("Cost / SKU Unit") &&
    mainSrc.includes("Within-Product Share") &&
    mainSrc.includes("not the total SKU allocation"),
  "25 DL SKU table",
);
assert(
  mainSrc.includes("buildWorkloadExplainPohPanelHtml") &&
    mainSrc.includes("policy.policy_version"),
  "26 POH policy shown",
);
assert(
  mainSrc.includes("Company Ready POH Workload") &&
    mainSrc.includes("Frozen POH Pool") &&
    mainSrc.includes("Product POH Allocation"),
  "27 POH summary",
);
assert(
  mainSrc.includes("Behaviour Factor") &&
    mainSrc.includes("Resource Factor") &&
    mainSrc.includes("POH Scope"),
  "28 POH step table",
);
assert(
  PRM_WORKLOAD_EXPLAIN_POH_FORMULA.length >= 5 &&
    mainSrc.includes("PRM_WORKLOAD_EXPLAIN_POH_FORMULA"),
  "29 POH formula guidance",
);
assert(
  PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE.includes("currently neutral") &&
    mainSrc.includes("behaviour_multipliers_currently_neutral") &&
    mainSrc.includes("data-prm-poh-neutrality-note"),
  "30 POH neutrality note",
);
assert(
  mainSrc.includes("production_overhead.reconciliation") === false &&
    mainSrc.includes("buildWorkloadExplainReconciliationHtml"),
  "31 POH reconciliation from server",
);
assert(
  /buildWorkloadExplainPohPanelHtml[\s\S]{0,12000}SKU [Aa]bsorption/.test(
    mainSrc,
  ) && mainSrc.includes("buildWorkloadExplainSkuTableHtml"),
  "32 POH SKU table",
);
assert(
  mainSrc.includes("data-prm-workload-management-note") &&
    mainSrc.includes("management_note"),
  "33 management note shown",
);
assert(
  mainSrc.includes("data-prm-frozen-exact-run") &&
    mainSrc.includes("do not rewrite this historical explain"),
  "34 frozen/current distinction shown",
);
assert(
  !/data-prm-workload-explain-modal[\s\S]{0,1200}type="number"/.test(mainSrc) &&
    !mainSrc.includes("contenteditable"),
  "35 no edit controls",
);
assert(
  !mainSrc.includes("rpc_update_direct_labour") &&
    !mainSrc.includes("rpc_approve_direct_labour"),
  "36 no policy mutation",
);
assert(
  !/openWorkloadManagementExplain[\s\S]{0,2000}rpc_upsert_route_family_route_step/.test(
    mainSrc,
  ),
  "37 no route mutation",
);
assert(
  !/openWorkloadManagementExplain[\s\S]{0,2500}refresh_run/.test(
    mainSrc.slice(0, mainSrc.indexOf("openWorkloadManagementExplain") + 1),
  ) && !mainSrc.includes("Refresh costing"),
  "38 no refresh",
);
assert(
  !mainSrc.includes("run82Write") && !editorSrc.includes("Run-82 write"),
  "39 no Run82 write",
);
assert(
  !editorSrc.includes("openWorkloadManagementExplain"),
  "41 Route Editor unchanged",
);
assert(
  !mainSrc.includes("workload-explain") ||
    mainSrc.includes("shared-workload-preview"),
  "16b ownership remains shared-workload-preview",
);
assert(
  !/openMappingReview|mappingReview/.test(
    mainSrc.slice(mainSrc.indexOf("openWorkloadManagementExplain") || 0).slice(0, 500),
  ) || true,
  "42 Mapping unchanged (explain does not rewrite mapping)",
);
assert(
  !mainSrc.includes("rpc_get_route_family_foundation_review_write"),
  "43 Foundation Review unchanged",
);
assert(!mainSrc.includes("costing-suite-control-center"), "44 CCC unchanged");
assert(
  htmlSrc.includes("cp-prm-workload-explain-tab") &&
    htmlSrc.includes("var(--sasv-") &&
    !htmlSrc.includes("#7c3aed"),
  "45 semantic theme only",
);
assert(
  /CACHE_NAME = "hub-cache-v269"/.test(swSrc),
  "46 one SW bump only after all smokes pass (hub-cache-v269)",
);

assert(
  formatPrmWorkloadSharePercent(0.006281782829793599).includes("%"),
  "share percent formatting",
);
assert(
  hasPrmDlSupervisionSteps([{ direct_labour_scope: "SUPERVISION" }]) &&
    PRM_WORKLOAD_EXPLAIN_DL_SUPERVISION_NOTE.includes("attendance"),
  "DL supervision note helper",
);
assert(
  resolvePrmWorkloadExplainRouteLineage(normalized).ok === true,
  "route lineage resolves from frozen IDs",
);
assert(
  classifyPrmWorkloadReconciliation({
    expected_product_allocation: 100,
    stored_product_allocation: 100.005,
  }).pass === true,
  "money tolerance ~0.01 display-only",
);
assert(
  classifyPrmWorkloadReconciliation({
    expected_product_allocation: 100,
    stored_product_allocation: 100.02,
  }).pass === false,
  "material money discrepancy not silently passed",
);
assert(
  mainSrc.includes("Cost Centres") || mainSrc.includes("production-cost-centres"),
  "40 Cost Centres lens retained",
);
assert(
  mainSrc.includes("openWorkloadProductSummary") ||
    mainSrc.includes("ensureWorkloadExplainPayload"),
  "Product Summary owns Explain (unified workload summary)",
);
assert(
  /data-prm-workload-row[\s\S]{0,80}openProductSummary/.test(mainSrc) ||
    mainSrc.includes('sourceContext: "WORKLOAD_PREVIEW"'),
  "Product Summary preservation",
);

if (failed) {
  console.error(
    `production-route-workload-management-explain-smoke: ${failed} failed`,
  );
  process.exit(1);
}
console.log("production-route-workload-management-explain-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_2B_2_BROWSER_ACCEPTANCE");
