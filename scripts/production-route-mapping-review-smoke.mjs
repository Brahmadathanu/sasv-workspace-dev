/**
 * Gate 11Y.10I.2A / 10I.2A.1 — Mapping Review lens (non-mutating) smoke.
 * Must NOT call map/update/approve mapping RPCs against live data.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_RPC_NAMES,
  PRM_EXACT_RUN_CONTEXT,
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT,
  aggregatePrmMappingReviewGroups,
  buildPrmMappingReviewCandidatesArgs,
  buildPrmMappingReviewEvidenceNote,
  formatPrmMappingReviewClassLabel,
  getPrmMappingReviewClassSummaryCounts,
  normalizePrmMappingReviewPayload,
  resolveDefaultPrmMappingBasis,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  buildMappingReviewCandidatesRpcArgs,
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
  join(root, "scripts/production-route-mapping-review-smoke.mjs"),
  "utf8",
);

const mappingReviewFn =
  mainSrc.match(/function renderMappingReview\(\) \{[\s\S]*?\n  function /)?.[0] ||
  "";
const reviewModalFn =
  mainSrc.match(
    /function openMappingReviewGroupModal\([\s\S]*?\n  function renderMappingReview/,
  )?.[0] || "";
const handoffFn =
  mainSrc.match(
    /async function handoffMappingReviewToMapProductGroup\([\s\S]*?\n  function openMappingReviewGroupModal/,
  )?.[0] || "";
const bindRowsFn =
  mainSrc.match(/function bindRows\(\) \{[\s\S]*?\n  function /)?.[0] || "";

assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("route-family-mapping-review"),
  "lens registered",
);
assert(
  LENS_REGISTRY["route-family-mapping-review"]?.label === "Mapping Review",
  "lens label Mapping Review",
);
assert(
  COSTING_ROUTE_CONFIG["production-route-manager"].allowedLensIds.includes(
    "route-family-mapping-review",
  ),
  "allowed route configured",
);
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_route_family_mapping_review_candidates",
  ),
  "exact RPC name in inventory",
);
assert(assertAllPrmRpcBuildersPresent(), "every live RPC has a builder");

const built = buildMappingReviewCandidatesRpcArgs({});
assert(built.ok === true, "default Mapping Review args ok");
assert(
  built.params.p_period_start === "2026-08-01" &&
    built.params.p_valuation_date === "2026-08-07" &&
    built.params.p_refresh_run_id === 82,
  "Mapping Review sends Run-82 Aug context",
);
assert(
  PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80 &&
    PRM_EXACT_RUN_CONTEXT.period_start === "2026-07-01" &&
    PRM_EXACT_RUN_CONTEXT.valuation_date === "2026-07-22",
  "35. PRM_EXACT_RUN_CONTEXT remains Run 80",
);
assert(
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82 &&
    PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.period_start === "2026-08-01" &&
    PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.valuation_date === "2026-08-07",
  "36. PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT remains Run 82",
);

const payload = normalizePrmMappingReviewPayload({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  as_of_date: "2026-08-09",
  class_summary: [
    {
      candidate_class: "SAME_GROUP_SINGLE_FAMILY_EVIDENCE",
      product_count: 58,
      product_group_count: 3,
    },
    {
      candidate_class: "NO_READY_SAME_GROUP_EVIDENCE",
      product_count: 280,
      product_group_count: 51,
    },
  ],
  rows: [
    {
      product_id: 1,
      product_name: "A",
      product_group_id: 10,
      product_group_name: "G10",
      category_name: "Ayurveda",
      subcategory_name: "Classical",
      readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
      ready_products_same_group: 35,
      candidate_class: "SAME_GROUP_SINGLE_FAMILY_EVIDENCE",
      candidate_route_family_id: 7,
      candidate_route_family_code: "OIL_FORMULATIONS_REGULAR",
      candidate_route_family_name: "Oil Formulations - Regular",
      has_pending_group_mapping: false,
      has_pending_product_assignment: false,
    },
    {
      product_id: 2,
      product_name: "B",
      product_group_id: 10,
      product_group_name: "G10",
      category_name: "Ayurveda",
      subcategory_name: "Classical",
      readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
      ready_products_same_group: 35,
      candidate_class: "SAME_GROUP_SINGLE_FAMILY_EVIDENCE",
      candidate_route_family_id: 7,
      candidate_route_family_code: "OIL_FORMULATIONS_REGULAR",
      candidate_route_family_name: "Oil Formulations - Regular",
      has_pending_group_mapping: false,
      has_pending_product_assignment: true,
    },
    {
      product_id: 3,
      product_name: "C",
      product_group_id: 11,
      product_group_name: "G11",
      category_name: "Ayurveda",
      subcategory_name: "Proprietary",
      readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
      ready_products_same_group: 11,
      candidate_class: "SAME_GROUP_SINGLE_FAMILY_EVIDENCE",
      candidate_route_family_id: 7,
      candidate_route_family_code: "OIL_FORMULATIONS_REGULAR",
      candidate_route_family_name: "Oil Formulations - Regular",
      has_pending_group_mapping: true,
      has_pending_product_assignment: false,
    },
  ],
});
const groups = aggregatePrmMappingReviewGroups(payload.rows);
const counts = getPrmMappingReviewClassSummaryCounts(payload.class_summary);
assert(
  counts.same_group_products === 58 && counts.same_group_groups === 3,
  "32. 58 / 3 summary contract",
);
assert(
  counts.no_ready_products === 280 && counts.no_ready_groups === 51,
  "33. 280 / 51 summary contract",
);
assert(groups.length === 2, "grouping uses server rows only");
assert(
  groups.every((g) => g.candidate_route_family_id === 7),
  "14. candidate family from server data",
);

// 1–4: no expand / Action / inline products in main table render
assert(
  !/data-prm-mapping-review-toggle/.test(mainSrc),
  "1–2. no leading expand / data-prm-mapping-review-toggle",
);
assert(
  !/mappingReviewExpandedGroupId/.test(mainSrc),
  "2. expand state removed",
);
assert(
  !/<th>Action<\/th>/.test(mappingReviewFn) &&
    !/cp-prm-mapping-review-action/.test(mainSrc),
  "3. no Action column",
);
assert(
  !/expandRows|inline Product child/.test(mappingReviewFn) &&
    !/\$\{expandRows\}/.test(mappingReviewFn),
  "4. no inline Product child rows in main table",
);
assert(
  /Category[\s\S]*Subcategory[\s\S]*Product Group[\s\S]*Blocked[\s\S]*Ready Evidence[\s\S]*Candidate Route Family[\s\S]*Evidence Class[\s\S]*Mapping State/.test(
    mappingReviewFn,
  ),
  "main table 8 columns",
);

// 5–9: row interaction
assert(
  /data-prm-mapping-review-group/.test(mappingReviewFn) &&
    /tabindex="0"/.test(mappingReviewFn) &&
    /role="button"/.test(mappingReviewFn),
  "5–7. clickable row tabindex role=button",
);
assert(/event\.key !== "Enter"/.test(bindRowsFn), "8. Enter handler exists");
assert(/event\.key !== " "/.test(bindRowsFn), "9. Space handler exists");
assert(
  /openMappingReviewGroupModal/.test(bindRowsFn) &&
    /data-prm-mapping-review-group/.test(bindRowsFn),
  "10. row opens review modal",
);

// 11–17: modal evidence
assert(
  /Product Group ID/.test(reviewModalFn) && /Category/.test(reviewModalFn),
  "11. review modal renders group identity",
);
assert(/Blocked Products/.test(reviewModalFn), "12. blocked count");
assert(
  /Ready same-group evidence/.test(reviewModalFn),
  "13. Ready evidence count",
);
assert(
  /candidate_route_family_code/.test(reviewModalFn) &&
    /candidate_route_family_name/.test(reviewModalFn),
  "14. candidate family from server fields",
);
assert(
  /formatPrmMappingReviewClassLabel\(group\.candidate_class\)/.test(
    reviewModalFn,
  ),
  "15. candidate class shown",
);
assert(
  /cp-prm-mapping-review-products/.test(reviewModalFn) &&
    /Affected Products/.test(reviewModalFn),
  "16. Product evidence table shown",
);
assert(
  !/data-prm-mapping-review-product-map/.test(mainSrc) &&
    !/data-prm-product-map/.test(reviewModalFn),
  "17. no Product-level mapping buttons",
);

// 18–20: action area
assert(
  /data-prm-mapping-review-actions/.test(reviewModalFn) &&
    /data-prm-mapping-review-review/.test(reviewModalFn) &&
    !/data-prm-mapping-review-review/.test(mappingReviewFn),
  "18. Review Mapping exists only inside modal",
);
assert(
  /has_pending_group_mapping/.test(reviewModalFn) &&
    /Pending mapping/.test(reviewModalFn) &&
    /canReviewMap/.test(reviewModalFn),
  "19. pending mapping suppresses Review Mapping",
);
assert(
  /canReviewMap/.test(reviewModalFn) &&
    /editOk/.test(reviewModalFn) &&
    !/View only — mapping mutation/.test(reviewModalFn),
  "20/25. view-only suppresses mutation action (no empty action card)",
);

// 21–28: handoff + mapping modal reuse
assert(
  /openMapProductGroupModal\(familyId/.test(handoffFn) &&
    /fromEvidence:\s*true/.test(handoffFn),
  "21. map handoff uses existing Map Product Group flow",
);
assert(
  /closeModal\(\{\s*restorePrevious:\s*false\s*\}\)/.test(handoffFn) &&
    /nested:\s*false/.test(handoffFn),
  "22. no nested modal stacking",
);
assert(
  /preselectProductGroupId = groupId/.test(handoffFn),
  "23. Product Group preselection preserved",
);
assert(
  /candidate_route_family_id/.test(handoffFn),
  "24. candidate family ID preserved",
);
assert(/fromEvidence:\s*true/.test(handoffFn), "25. fromEvidence:true preserved");
assert(
  resolveDefaultPrmMappingBasis({ fromEvidence: true }) === "HISTORICAL_REVIEW",
  "26. HISTORICAL_REVIEW resolver reused",
);
assert(
  /prmMapEffectiveFrom/.test(mainSrc) && /Effective from/.test(mainSrc),
  "27. effective-date control untouched",
);
assert(
  buildPrmMappingReviewEvidenceNote({
    ready_products_same_group: 35,
    candidate_route_family_code: "OIL_FORMULATIONS_REGULAR",
  }).includes("35 Ready") && /mapping_note: buildPrmMappingReviewEvidenceNote/.test(handoffFn),
  "28. evidence note remains editable assistance",
);

// 29–34 + 10I.2A.2 density
assert(
  /is-visible/.test(mappingReviewFn) &&
    /cp-prm-mapping-review-summary-host/.test(mappingReviewFn),
  "2/29. Mapping Review context remains visible",
);
assert(
  /cp-prm-mapping-review-meta/.test(mappingReviewFn) &&
    /data-prm-mapping-review-context/.test(mappingReviewFn),
  "3. compact metadata strip exists",
);
assert(
  !/cp-prm-mapping-review-summary(?!-host)/.test(mappingReviewFn) &&
    !/cp-prm-mapping-review-classes/.test(mappingReviewFn) &&
    !/class="cp-prm-mapping-review-class"/.test(mappingReviewFn),
  "4. old multi-block summary grid is not rendered",
);
assert(
  !/Does not rewrite Run/.test(mappingReviewFn) &&
    !/Does not rewrite Run/.test(
      mappingReviewFn.match(/innerHTML\s*=\s*`[\s\S]*?`;/)?.[0] || "",
    ),
  "5. no permanent Does not rewrite Run prose line",
);
assert(
  /title="\$\{text\(immutability\)\}"/.test(mappingReviewFn) &&
    /aria-description="\$\{text\(immutability\)\}"/.test(mappingReviewFn) &&
    /does not rewrite Run/.test(mappingReviewFn),
  "6. immutability semantic remains in title/aria",
);
assert(
  /Frozen: Run \$\{text\(runId\)\}/.test(mappingReviewFn) ||
    /data-prm-mapping-review-frozen/.test(mappingReviewFn),
  "7. Run 82 marker present",
);
assert(
  /periodLabel/.test(mappingReviewFn) &&
    /formatPrmMonthYearLabel/.test(mappingReviewFn),
  "8. Aug 2026 marker present",
);
assert(
  /Valuation \$\{text\(valuationLabel\)\}/.test(mappingReviewFn),
  "9. valuation marker present",
);
assert(
  /Current source: \$\{text\(asOfLabel\)\}/.test(mappingReviewFn) ||
    /data-prm-mapping-review-asof/.test(mappingReviewFn),
  "10. current-source date present",
);
assert(
  /data-prm-mapping-review-class-same/.test(mappingReviewFn) &&
    /mapping-candidate groups/.test(mappingReviewFn) &&
    /same_group_products/.test(mappingReviewFn),
  "11. 58 Products / 3 groups marker present",
);
assert(
  /data-prm-mapping-review-class-no-ready/.test(mappingReviewFn) &&
    /foundation groups/.test(mappingReviewFn) &&
    /no_ready_products/.test(mappingReviewFn),
  "12. 280 Products / 51 groups marker present",
);
assert(
  !/cp-workbench-summary-card/.test(mappingReviewFn) &&
    !/class="cp-prm-mapping-review-class"/.test(mappingReviewFn),
  "13. no dashboard cards",
);
assert(
  formatPrmMappingReviewClassLabel("NO_READY_SAME_GROUP_EVIDENCE").includes(
    "foundation required",
  ) &&
    !/data-prm-mapping-review-no-ready-map/.test(mainSrc) &&
    !/NO_READY[\s\S]{0,200}Review Mapping/.test(reviewModalFn),
  "34. no NO_READY mapping CTA",
);

assert(
  /cp-prm-form-actions/.test(reviewModalFn) &&
    /data-prm-mapping-review-actions/.test(reviewModalFn) &&
    !/<h3 class="cp-section-title">Action<\/h3>/.test(reviewModalFn) &&
    !/cp-detail-section" data-prm-mapping-review-actions/.test(reviewModalFn),
  "18/19. old tall Action section removed; cp-prm-form-actions used",
);
assert(
  /icon-btn icon-btn-primary" data-prm-mapping-review-review/.test(
    reviewModalFn,
  ) ||
    (/icon-btn icon-btn-primary/.test(reviewModalFn) &&
      /data-prm-mapping-review-review/.test(reviewModalFn)),
  "20/21. Review Mapping uses icon-btn icon-btn-primary",
);

const mappingReviewCss =
  htmlSrc.match(
    /\.cp-prm-mapping-review-[\s\S]*?(?=\.cp-prm-editor-header)/,
  )?.[0] || "";
assert(
  !/#[0-9a-fA-F]{3,8}\b/.test(mappingReviewCss) &&
    !/rgb[a]?\(/.test(mappingReviewCss) &&
    !/hsl[a]?\(/.test(mappingReviewCss),
  "22/23. no new Mapping Review hex/rgb/hsl colors",
);

assert(
  !/rpc_create_route_family_mapping_review|rpc_bulk_map/.test(mainSrc),
  "no new mutation RPC",
);
assert(
  /RPC\.mapProductGroup/.test(mainSrc) &&
    /rpc_map_product_group_to_route_family/.test(helpersSrc),
  "create path remains existing DRAFT map RPC",
);
assert(
  !/costingRpc\(\s*["']rpc_map_product_group_to_route_family/.test(smokeSelf) &&
    !/costingRpc\(\s*["']rpc_approve_route_family_mapping/.test(smokeSelf) &&
    !/costingRpc\(\s*["']rpc_update_route_family_mapping_draft/.test(smokeSelf),
  "37. no mutation RPC invoked by smoke",
);
assert(
  !/rpc_request_costing_refresh/.test(
    mainSrc.match(/async function loadMappingReview[\s\S]*?\n  async function /)?.[0] ||
      "",
  ),
  "38. no refresh in Mapping Review load",
);
assert(
  !/mutate.*refresh_run_id|write.*Run 82|update.*run.?82/i.test(mainSrc),
  "39. no Run-82 write",
);

for (const lens of [
  "route-readiness",
  "product-route-assignments",
  "shared-workload-preview",
  "route-families",
  "route-family-route-editor",
  "product-route-editor",
  "historical-candidate-review",
  "effective-route-viewer",
]) {
  assert(PRODUCTION_ROUTE_LENS_IDS.includes(lens), `40. existing lens retained: ${lens}`);
}

assert(
  /lensId: "product-route-assignments"/.test(recommendedSrc),
  "CCC Product Assignments deep link unchanged",
);
assert(
  /function renderSetupChip\(/.test(mainSrc) &&
    /summarizePrmCostCentreSetup/.test(helpersSrc) &&
    !/prmSetupBanner/.test(mappingReviewFn),
  "1. Cost Centre chip remains (unchanged ownership)",
);
assert(
  /CACHE_NAME = "hub-cache-v255"/.test(swSrc),
  "31. SW advanced to hub-cache-v255 (Cost Centres bump)",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(
  "\nAll Gate 11Y.10I.2A.2 Mapping Review density/UX smokes passed (non-mutating).",
);
