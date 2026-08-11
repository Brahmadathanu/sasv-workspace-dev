/**
 * Gate 11Y.10I.2B.3 — Foundation Review lens (non-mutating) smoke.
 * Must NOT call create/map/approve RPCs against live data.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_RPC_NAMES,
  PRM_EXACT_RUN_CONTEXT,
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT,
  PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT,
  PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES,
  buildPrmFoundationReviewArgs,
  formatPrmFoundationGroupEvidenceClassLabel,
  formatPrmFoundationProductEvidenceClassLabel,
  formatPrmFoundationReviewGuidanceNote,
  getPrmFoundationReviewClassSummaryMap,
  normalizePrmFoundationReviewPayload,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  buildFoundationReviewRpcArgs,
  assertAllPrmRpcBuildersPresent,
} from "../public/shared/js/costing-suite-production-route-rpc.js";
import { LENS_REGISTRY, COSTING_SUITE_MODULES } from "../public/shared/js/costing-suite-registry.js";
import { COSTING_ROUTE_CONFIG } from "../public/shared/js/costing-route-config.js";

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
const mainSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route.js"),
  "utf8",
);
const helpersSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route-helpers.js"),
  "utf8",
);
const recommendedSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-recommended-ui-route.js"),
  "utf8",
);
const htmlSrc = readFileSync(
  join(root, "public/shared/production-route-manager.html"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const smokeSelf = readFileSync(
  join(root, "scripts/production-route-foundation-review-smoke.mjs"),
  "utf8",
);

const foundationFn =
  mainSrc.match(/function renderFoundationReview\(\) \{[\s\S]*?\n  function /)?.[0] ||
  "";
const foundationModalFn =
  mainSrc.match(
    /function openFoundationReviewGroupModal\([\s\S]*?\n  function renderFoundationReview/,
  )?.[0] || "";
const bindRowsFn =
  mainSrc.match(/function bindRows\(\) \{[\s\S]*?\n  function /)?.[0] || "";
const mappingFn =
  mainSrc.match(/function renderMappingReview\(\) \{[\s\S]*?\n  function /)?.[0] ||
  "";

assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("route-family-foundation-review"),
  "1. Foundation Review lens registered",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-foundation-review") ===
    PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-mapping-review") + 1,
  "2. correct position after Mapping Review",
);
assert(
  LENS_REGISTRY["route-family-foundation-review"]?.label === "Foundation Review",
  "lens label Foundation Review",
);
assert(
  COSTING_ROUTE_CONFIG["production-route-manager"].allowedLensIds.includes(
    "route-family-foundation-review",
  ),
  "allowed route configured",
);
const suite = COSTING_SUITE_MODULES.find((s) => s.id === "production-route");
assert(
  suite?.lensIds?.indexOf("route-family-foundation-review") ===
    suite?.lensIds?.indexOf("route-family-mapping-review") + 1,
  "suite places Foundation Review after Mapping Review",
);
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes("rpc_get_route_family_foundation_review"),
  "3. exact RPC name",
);
assert(assertAllPrmRpcBuildersPresent(), "every live RPC has a builder");
assert(
  PRM_RPC_ARG_KEYS.rpc_get_route_family_foundation_review?.includes(
    "p_lookback_months",
  ),
  "ARG keys include lookback",
);

const built = buildFoundationReviewRpcArgs({});
assert(built.ok === true, "default Foundation Review args ok");
assert(
  built.params.p_period_start === "2026-08-01" &&
    built.params.p_valuation_date === "2026-08-07" &&
    built.params.p_refresh_run_id === 82 &&
    built.params.p_limit === 25,
  "4. bounded Run-82 Foundation context + default page 25",
);
assert(
  PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "5. global PRM_EXACT_RUN_CONTEXT unchanged at Run 80",
);
assert(
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT !== PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT,
  "6. Mapping Review exact context unchanged / independent constant",
);
assert(
  PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82,
  "Foundation context remains Run 82",
);

const payload = normalizePrmFoundationReviewPayload({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  as_of_date: "2026-08-09",
  target_product_count: 280,
  target_product_group_count: 51,
  filtered_group_count: 51,
  class_summary: [
    { group_evidence_class: "ALL_PRODUCTS_SUFFICIENT", group_count: 10, product_count: 17 },
    { group_evidence_class: "MIXED_WITH_SUFFICIENT", group_count: 17, product_count: 146 },
    { group_evidence_class: "LIMITED_ONLY", group_count: 17, product_count: 29 },
    { group_evidence_class: "LIMITED_AND_NONE", group_count: 2, product_count: 15 },
    { group_evidence_class: "NO_EVIDENCE_ALL", group_count: 5, product_count: 73 },
  ],
  groups: [
    {
      product_group_id: 67,
      product_group_name: "Lehyam",
      category_name: "Ayurveda",
      subcategory_name: "Classical",
      product_count: 9,
      sufficient_products: 9,
      limited_products: 0,
      no_evidence_products: 0,
      total_eligible_batches: 56,
      avg_eligible_batches: 6.2,
      max_eligible_batches: 28,
      group_evidence_class: "ALL_PRODUCTS_SUFFICIENT",
      products: [
        {
          product_id: 957,
          product_name: "Thippili Rasayanam",
          evidence_class: "HISTORICAL_EVIDENCE_SUFFICIENT",
          eligible_batches: 28,
          candidate_status: "REVIEWABLE_CANDIDATE",
        },
      ],
      family_steps: [
        {
          activity_kind_name: "RM dispensation",
          activity_short_code: "RMDI",
          family_evidence_class: "FAMILY_CORE_STEP",
          products_supporting_step: 9,
          product_support_ratio: 1,
          average_product_batch_coverage: 0.9,
          modal_area_id: 1,
          modal_plant_id: 2,
        },
      ],
      approval_note:
        "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.",
    },
  ],
  approvable: false,
});
const classMap = getPrmFoundationReviewClassSummaryMap(payload.class_summary);
assert(payload.target_product_count === 280, "7. target counts read from response");
assert(payload.target_product_group_count === 51, "7b. target groups from response");
assert(
  classMap.ALL_PRODUCTS_SUFFICIENT.group_count === 10 &&
    classMap.NO_EVIDENCE_ALL.group_count === 5,
  "8. class_summary read from response",
);
assert(
  PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES.length === 5,
  "9. all five group evidence classes supported",
);
assert(
  !/reclassif|infer.*group_evidence_class|derive.*sufficient_products/i.test(
    helpersSrc,
  ),
  "10. no client evidence reclassification",
);
assert(/data-prm-foundation-review-group/.test(foundationFn), "11. Product Group grain");
assert(
  /Category[\s\S]*Subcategory[\s\S]*Product Group[\s\S]*Products[\s\S]*Sufficient[\s\S]*Limited[\s\S]*No Evidence[\s\S]*Eligible Batches[\s\S]*Evidence Class/.test(
    foundationFn,
  ),
  "12. nine table columns",
);
assert(
  !/<th>Action<\/th>/.test(foundationFn) &&
    !/data-prm-foundation-create/.test(mainSrc),
  "13. no Action column",
);
assert(!/data-prm-foundation-toggle/.test(mainSrc), "14. no expand column");
assert(
  /openFoundationReviewGroupModal/.test(bindRowsFn),
  "15. row-click modal",
);
assert(/tabindex="0"/.test(foundationFn), "16. tabindex");
assert(/role="button"/.test(foundationFn), "17. role=button");
assert(/event\.key !== "Enter"/.test(bindRowsFn), "18. Enter handler");
assert(/event\.key !== " "/.test(bindRowsFn), "19. Space handler");
assert(
  /cp-prm-foundation-products/.test(foundationModalFn),
  "20. Product evidence table",
);
assert(
  /cp-prm-foundation-steps/.test(foundationModalFn) &&
    /family_steps/.test(foundationModalFn),
  "21. family_steps table",
);
assert(
  /activity_kind_name|activity_short_code/.test(foundationModalFn),
  "22. family-step data server-owned",
);
assert(
  !/guess.*activity|invent.*area_name/i.test(foundationModalFn),
  "23. no speculative name inference",
);
assert(
  formatPrmFoundationReviewGuidanceNote("ALL_PRODUCTS_SUFFICIENT").includes(
    "governed design review",
  ),
  "24. sufficient wording",
);
assert(
  formatPrmFoundationReviewGuidanceNote("LIMITED_ONLY").includes("incomplete"),
  "25. limited wording",
);
assert(
  formatPrmFoundationReviewGuidanceNote("NO_EVIDENCE_ALL").includes(
    "manual foundation design",
  ),
  "26. no-evidence wording",
);
assert(
  !/suggest.*family|recommended Route Family|Ready to create/i.test(
    foundationModalFn,
  ),
  "27. no family suggestion for no-evidence",
);
assert(
  !/data-prm-create-route-family|data-prm-map-submit|data-prm-approve|data-prm-use-candidate/.test(
    foundationModalFn,
  ),
  "28–32. no mutation CTA / Create / Map / Approve / Use in draft",
);
assert(
  /navigate\("historical-candidate-review"/.test(foundationModalFn) &&
    /candidate_kind:\s*"product"/.test(foundationModalFn),
  "33. Historical Evidence navigation reuses existing lens",
);
assert(
  !/previewProductCandidate|createRouteFamily/.test(foundationModalFn),
  "34. no duplicate preview engine / create in Foundation modal",
);
assert(
  /canView\(\)/.test(mainSrc.match(/async function loadFoundationReview[\s\S]*?\n  async function /)?.[0] || ""),
  "35. view permission gate",
);

const foundationCss =
  htmlSrc.match(
    /\.cp-prm-foundation-[\s\S]*?(?=\.cp-prm-editor-header)/,
  )?.[0] || "";
assert(
  !/#[0-9a-fA-F]{3,8}\b/.test(foundationCss) &&
    !/rgb[a]?\(/.test(foundationCss) &&
    !/hsl[a]?\(/.test(foundationCss),
  "36/37. no local Foundation hex/rgb/hsl colors",
);
assert(
  !/rpc_request_costing_refresh/.test(
    mainSrc.match(/async function loadFoundationReview[\s\S]*?\n  async function /)?.[0] ||
      "",
  ),
  "38. no refresh",
);
assert(
  !/mutate.*refresh_run_id|write.*Run 82/i.test(mainSrc),
  "39. no Run-82 write",
);
assert(
  /cp-prm-mapping-review-meta/.test(mappingFn) &&
    /renderMappingReview/.test(mainSrc),
  "40. Mapping Review unchanged (still present)",
);
assert(
  /lensId: "product-route-assignments"/.test(recommendedSrc),
  "41. CCC handoff unchanged",
);
for (const lens of [
  "route-readiness",
  "product-route-assignments",
  "shared-workload-preview",
  "route-families",
  "route-family-mapping-review",
  "route-family-route-editor",
  "product-route-editor",
  "historical-candidate-review",
  "effective-route-viewer",
]) {
  assert(PRODUCTION_ROUTE_LENS_IDS.includes(lens), `42. existing lens retained: ${lens}`);
}
assert(
  !/costingRpc\(\s*["']rpc_create_route_family/.test(smokeSelf) &&
    !/costingRpc\(\s*["']rpc_map_product_group/.test(smokeSelf) &&
    !/costingRpc\(\s*["']rpc_approve_/.test(smokeSelf),
  "smoke does not mutate live mappings",
);
assert(
  formatPrmFoundationGroupEvidenceClassLabel("NO_EVIDENCE_ALL").includes(
    "No eligible",
  ) &&
    formatPrmFoundationProductEvidenceClassLabel(
      "HISTORICAL_EVIDENCE_SUFFICIENT",
    ) === "Sufficient",
  "evidence class labels",
);
assert(
  buildPrmFoundationReviewArgs({ group_evidence_class: "LIMITED_ONLY" }).ok,
  "group_evidence_class filter supported",
);
assert(
  /CACHE_NAME = "hub-cache-v255"/.test(swSrc),
  "43. SW bumped to hub-cache-v255",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(
  "\nAll Gate 11Y.10I.2B.3 Foundation Review smokes passed (non-mutating).",
);
