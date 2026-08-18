/**
 * Gate 4F.5D2-A — Route Readiness general as-of DQ surface.
 * Source/mock only. Does NOT mutate Product 161 or batch reference 528.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_READINESS_STATUSES,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT,
  PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildReadinessRpcArgs,
  buildExactRunReadinessRpcArgs,
  normalizeReadinessRow,
  normalizeReadinessPayload,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const shellSrc = read("public/shared/js/costing-suite-shell.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-route-readiness-general-asof-smoke.mjs",
);

const loadFn =
  mainSrc.match(
    /async function loadReadiness\([\s\S]*?\n  function applyExactRunStatusCounts/,
  )?.[0] || "";
const renderFn =
  mainSrc.match(
    /function renderReadiness\(\) \{[\s\S]*?\n  function mappingReviewGroupStateLabel/,
  )?.[0] || "";
const clearFn =
  mainSrc.match(
    /async function clearReadinessFilters\([\s\S]*?\n  async function clearWorkloadFilters/,
  )?.[0] || "";
const createAssignFn =
  mainSrc.match(
    /function buildAssignmentProductOptionsHtml\([\s\S]*?\n  function /,
  )?.[0] || "";
const asOfChromeFn =
  mainSrc.match(
    /function syncPrmAsOfDateChrome\([\s\S]*?\n  function applyPrmDeepLinkToUrl/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  loadFn.includes("RPC.generalReadiness") &&
    loadFn.includes("buildReadinessRpcArgs") &&
    mainSrc.includes(
      'generalReadiness: "rpc_get_production_route_manager_readiness"',
    ),
  "A route-readiness invokes general readiness RPC",
);
assert(
  !loadFn.includes("RPC.exactRunReadiness") &&
    !loadFn.includes("buildExactRunReadinessRpcArgs") &&
    !loadFn.includes("PRM_EXACT_RUN_CONTEXT"),
  "B loadReadiness does NOT invoke exact-run readiness",
);

const built = buildReadinessRpcArgs({
  as_of_date: "2026-08-16",
  search: "161",
  readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
  product_group_id: 9,
  route_family_id: null,
  limit: 25,
  offset: 0,
});
assert(
  loadFn.includes("as_of_date: getAsOfDate()") &&
    built.ok &&
    built.params.p_as_of_date === "2026-08-16",
  "C sends selected p_as_of_date via getAsOfDate",
);
assert(
  built.params.p_search === "161" &&
    built.params.p_readiness_status ===
      "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING" &&
    built.params.p_product_group_id === 9 &&
    built.params.p_route_family_id == null &&
    built.params.p_limit === 25 &&
    built.params.p_offset === 0 &&
    loadFn.includes("search: state.search") &&
    loadFn.includes("readiness_status: state.readiness_status") &&
    loadFn.includes("product_group_id: state.product_group_id") &&
    loadFn.includes("route_family_id: state.route_family_id") &&
    loadFn.includes("limit: state.limit") &&
    loadFn.includes("offset: state.offset"),
  "D search/status/group/family/limit/offset remain correctly built",
);

assert(
  PRM_READINESS_STATUSES.includes(
    "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
  ) && helpersSrc.includes("BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING"),
  "E BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING remains supported",
);

const nullFamily = normalizeReadinessRow({
  product_id: 161,
  product_name: "Kukkutappavu Choornam",
  readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
  route_family_id: null,
  route_family_name: null,
});
const payload = normalizeReadinessPayload({
  rows: [nullFamily],
  total_count: 1,
  status_counts: { BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING: 1 },
});
assert(
  nullFamily.route_family_id == null &&
    nullFamily.route_family_name == null &&
    payload.rows.length === 1 &&
    payload.rows[0].product_id === 161 &&
    renderFn.includes("state.readinessRows") &&
    !renderFn.includes("route_family_id != null") &&
    !renderFn.includes("filter((row)"),
  "F null route_family_id rows retained through normalize/render",
);

assert(
  clearFn.includes('state.readiness_status = ""') &&
    clearFn.includes('state.search = ""') &&
    clearFn.includes('state.product_group_id = ""') &&
    clearFn.includes('state.route_family_id = ""') &&
    clearFn.includes("resetOffset: true") &&
    shellSrc.includes("clearReadinessFilters") &&
    shellSrc.includes('CURRENT_LENS === "route-readiness"'),
  "G Clear Filters resets search/status/group/family/offset",
);

assert(
  mainSrc.includes("buildProductAssignmentsRpcArgs") &&
    mainSrc.includes("loadProductAssignments") &&
    !loadFn.includes("productAssignments") &&
    !loadFn.includes("buildProductAssignmentsRpcArgs"),
  "H Product Assignments register path unchanged by readiness load",
);

assert(
  createAssignFn.includes("state.products") &&
    mainSrc.includes("buildAssignmentProductOptionsHtml") &&
    !createAssignFn.includes("readinessRows") &&
    !createAssignFn.includes("READY"),
  "I Create Assignment Product options remain from state.products",
);

assert(
  mainSrc.includes("PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT") &&
    mainSrc.includes("PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT") &&
    mainSrc.includes("PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT") &&
    mainSrc.includes("buildWorkloadPreviewRpcArgs") &&
    mainSrc.includes("buildMappingReviewCandidatesRpcArgs") &&
    mainSrc.includes("buildFoundationReviewRpcArgs") &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80 &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    buildExactRunReadinessRpcArgs({
      period_start: "2026-07-01",
      valuation_date: "2026-07-22",
      refresh_run_id: 80,
      limit: 25,
      offset: 0,
    }).ok,
  "J exact-run surfaces / builders remain available",
);

assert(
  mainSrc.includes("readinessAsOfContextHtml") &&
    mainSrc.includes("Effective manufacturing-route readiness as of") &&
    renderFn.includes("readinessAsOfContextHtml") &&
    !asOfChromeFn.includes("Run 80 · Jul 2026") &&
    !renderFn.includes("exactRunContextHtml()"),
  "cue/copy describes as-of DQ readiness",
);

assert(
  thisSrc.includes("Does NOT mutate Product 161") &&
    thisSrc.includes("batch reference 528"),
  "K no smoke mutates Product 161 or batch reference",
);

assert(/hub-cache-v315/.test(swSrc), "SW bumped once to hub-cache-v315");

if (failed) {
  console.error(
    `production-route-route-readiness-general-asof-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-route-readiness-general-asof-smoke: all assertions passed",
);
