/**
 * Gate 5.11BU.11Y.4E.4 — Supply Batch Plan preferred batch-size RPC cutover smoke.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL,
  PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL_MISSING,
  SUPPLY_BATCH_PLAN_PERMISSION_TARGET,
  SUPPLY_BATCH_SIZE_INACTIVATE_COPY,
  SUPPLY_BATCH_SIZE_RPC_ARG_KEYS,
  SUPPLY_BATCH_SIZE_RPC_NAMES,
  buildCreateSupplyBatchSizeReferenceArgs,
  buildGetSupplyBatchSizeReferencesArgs,
  buildInactivateSupplyBatchSizeReferenceArgs,
  buildPrmPreferredBatchSizeHandoffAction,
  buildReviseSupplyBatchSizeReferenceArgs,
  buildSupplyBatchPlanPreferredBatchSizeHandoffUrl,
  enforceExactSupplyBatchSizeRpcKeys,
  isInvalidSupplyBatchSizeRange,
  isMeaningfulSupplyBatchSizeChangeReason,
  parseSupplyBatchPlanDeepLink,
  resolveQuickEditSupplyBatchSizeBranch,
  supplyBatchSizeTodayIsoDate,
  unwrapSupplyBatchSizeReferencesPayload,
  validateSupplyBatchSizeRange,
} from "../public/shared/js/supply-batch-size-references.js";
import {
  PRODUCTION_ROUTE_RPC_NAMES,
  getApplicableProductRouteActions,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("OK", msg);
  else {
    failed += 1;
    console.error("FAIL", msg);
  }
}

const sbpJs = fs.readFileSync(
  path.join(root, "js", "supply-batch-plan.js"),
  "utf8",
);
const sbpHtml = fs.readFileSync(
  path.join(root, "supply-batch-plan.html"),
  "utf8",
);
const prmJs = fs.readFileSync(
  path.join(root, "public", "shared", "js", "costing-suite-production-route.js"),
  "utf8",
);

const helpersJs = fs.readFileSync(
  path.join(root, "public", "shared", "js", "supply-batch-size-references.js"),
  "utf8",
);

// 1. No direct production_batch_size_ref access
assert(
  !/\.from\(\s*["']production_batch_size_ref["']\s*\)/.test(sbpJs),
  "no direct production_batch_size_ref select/insert/update/delete remains",
);

// 2. Register uses governed RPC
assert(
  helpersJs.includes("rpc_get_supply_batch_size_references") &&
    sbpJs.includes("SUPPLY_BATCH_SIZE_RPC_NAMES.register") &&
    sbpJs.includes("buildGetSupplyBatchSizeReferencesArgs"),
  "register uses rpc_get_supply_batch_size_references",
);

// 3–5. Create / Revise / Inactivate builders exact arguments
const createOk = buildCreateSupplyBatchSizeReferenceArgs({
  product_id: 616,
  preferred_batch_size: 150,
  min_batch_size: 100,
  max_batch_size: 200,
  effective_from: "2026-07-01",
  change_reason: "Set preferred batch size for Karappan Kashayam",
  notes: null,
});
assert(
  createOk.ok &&
    JSON.stringify(Object.keys(createOk.params).sort()) ===
      JSON.stringify(
        [...SUPPLY_BATCH_SIZE_RPC_ARG_KEYS[SUPPLY_BATCH_SIZE_RPC_NAMES.create]].sort(),
      ) &&
    createOk.params.p_product_id === 616 &&
    createOk.params.p_preferred_batch_size === 150 &&
    createOk.params.p_min_batch_size === 100 &&
    createOk.params.p_max_batch_size === 200 &&
    createOk.params.p_effective_from === "2026-07-01" &&
    createOk.params.p_change_reason.includes("Karappan") &&
    createOk.params.p_notes === null,
  "Create builder exact arguments",
);

const reviseOk = buildReviseSupplyBatchSizeReferenceArgs({
  reference_id: 408,
  preferred_batch_size: 120,
  min_batch_size: 90,
  max_batch_size: 150,
  effective_from: "2026-07-01",
  change_reason: "Correct invalid Punga range via revise",
  notes: "history retained",
});
assert(
  reviseOk.ok &&
    JSON.stringify(Object.keys(reviseOk.params).sort()) ===
      JSON.stringify(
        [...SUPPLY_BATCH_SIZE_RPC_ARG_KEYS[SUPPLY_BATCH_SIZE_RPC_NAMES.revise]].sort(),
      ) &&
    reviseOk.params.p_reference_id === 408,
  "Revise builder exact arguments",
);

const inactivateOk = buildInactivateSupplyBatchSizeReferenceArgs({
  reference_id: 408,
  effective_to: "2026-07-01",
  change_reason: "Retire obsolete preferred batch size",
});
assert(
  inactivateOk.ok &&
    JSON.stringify(Object.keys(inactivateOk.params).sort()) ===
      JSON.stringify(
        [
          ...SUPPLY_BATCH_SIZE_RPC_ARG_KEYS[SUPPLY_BATCH_SIZE_RPC_NAMES.inactivate],
        ].sort(),
      ) &&
    inactivateOk.params.p_reference_id === 408 &&
    inactivateOk.params.p_effective_to === "2026-07-01",
  "Inactivate builder exact arguments",
);

// 6. Unsupported keys rejected
assert(
  !enforceExactSupplyBatchSizeRpcKeys(SUPPLY_BATCH_SIZE_RPC_NAMES.create, {
    ...createOk.params,
    p_extra: true,
  }).ok,
  "unsupported keys rejected",
);

// 7. Change reason required
assert(
  !isMeaningfulSupplyBatchSizeChangeReason("") &&
    !isMeaningfulSupplyBatchSizeChangeReason("n/a") &&
    !buildCreateSupplyBatchSizeReferenceArgs({
      product_id: 1,
      preferred_batch_size: 10,
      min_batch_size: 5,
      max_batch_size: 15,
      effective_from: "2026-07-01",
      change_reason: "x",
    }).ok,
  "change reason required",
);

// 8. min/preferred/max validation
assert(
  !validateSupplyBatchSizeRange({
    preferred_batch_size: 90,
    min_batch_size: 120,
    max_batch_size: 90,
  }).ok,
  "min/preferred/max validation rejects Punga-style invalid range",
);

// 9. Future dates rejected client-side
const tomorrow = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return supplyBatchSizeTodayIsoDate(d);
})();
assert(
  !buildCreateSupplyBatchSizeReferenceArgs({
    product_id: 1,
    preferred_batch_size: 10,
    min_batch_size: 5,
    max_batch_size: 15,
    effective_from: tomorrow,
    change_reason: "Future dated create attempt",
  }).ok,
  "future dates rejected client-side",
);

// 10–11. Create only when no active; Revise only when active (client branch helpers)
assert(
  resolveQuickEditSupplyBatchSizeBranch(null) === "create",
  "Create only when no active reference",
);
assert(
  resolveQuickEditSupplyBatchSizeBranch({ reference_id: 12 }) === "revise",
  "Revise only when active reference exists",
);

// 12. Revise never update-in-place
assert(
  helpersJs.includes("rpc_revise_supply_batch_size_reference") &&
    sbpJs.includes("SUPPLY_BATCH_SIZE_RPC_NAMES.revise") &&
    !sbpJs.includes(".update(formData)") &&
    !/\.from\(\s*["']production_batch_size_ref["']\s*\)\s*\.update/.test(sbpJs),
  "Revise never update-in-place",
);

// 13. Delete UI and function absent
assert(
  !sbpJs.includes("window.deleteBatchSizeRef") &&
    !sbpJs.includes("async function deleteBatchSizeRef") &&
    !sbpJs.includes("function deleteBatchSizeRef") &&
    !sbpHtml.includes("deleteBatchSizeRef") &&
    !sbpHtml.includes('onclick="deleteBatchSizeRef'),
  "Delete UI and function absent",
);

// 14. Inactivate history-preserving copy
assert(
  sbpHtml.includes(SUPPLY_BATCH_SIZE_INACTIVATE_COPY.historyRetained) &&
    sbpHtml.includes("No costing") &&
    sbpHtml.includes("Stage 03"),
  "Inactivate history-preserving copy present",
);

// 15. Quick-edit branches Create/Revise
assert(
  sbpJs.includes("resolveQuickEditSupplyBatchSizeBranch") &&
    sbpJs.includes("SUPPLY_BATCH_SIZE_RPC_NAMES.create") &&
    sbpJs.includes("SUPPLY_BATCH_SIZE_RPC_NAMES.revise") &&
    helpersJs.includes("rpc_create_supply_batch_size_reference") &&
    helpersJs.includes("rpc_revise_supply_batch_size_reference"),
  "quick-edit branches Create/Revise",
);

// 16–17. Save+Recalc after successful save; separate errors
assert(
  sbpJs.includes("recalc_batch_plan_for_product") &&
    sbpJs.includes(
      "Batch-size reference saved successfully, but Product recalculation failed.",
    ) &&
    sbpJs.includes("recalculate: true"),
  "Save+Recalc invokes recalc only after successful save; errors separate",
);

// 18. Product history uses Product-scoped register RPC
assert(
  sbpJs.includes("loadProductBatchSizeHistory") &&
    /buildGetSupplyBatchSizeReferencesArgs\(\{[\s\S]*product_id: pid[\s\S]*state: "ALL"/.test(
      sbpJs,
    ),
  "Product history uses Product-scoped register RPC",
);

// 19–20. Invalid range chip; Punga not auto-corrected
const punga = {
  product_id: 900,
  reference_id: 408,
  preferred_batch_size: 90,
  min_batch_size: 120,
  max_batch_size: 90,
};
assert(isInvalidSupplyBatchSizeRange(punga), "Invalid range chip source for Punga");
assert(
  sbpJs.includes("Invalid range") &&
    !sbpJs.includes("auto-correct") &&
    !sbpJs.includes("autoCorrect"),
  "Punga not auto-corrected",
);

// 21–22. Deep-link parser; no auto-mutation
const deep = parseSupplyBatchPlanDeepLink(
  "supply-batch-plan.html?tab=batch-sizes&product_id=616&action=create-batch-size",
);
assert(
  deep.openBatchSizesTab &&
    deep.product_id === 616 &&
    deep.action === "create-batch-size" &&
    deep.autoMutate === false,
  "deep-link parser supports tab/product_id/action; no auto-mutation",
);

// 23. PRM handoff label and URL
const missingHandoff = buildPrmPreferredBatchSizeHandoffAction({
  product_id: 616,
  readiness_status: "BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE",
});
assert(
  missingHandoff.label === PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL_MISSING &&
    missingHandoff.href ===
      "/supply-batch-plan.html?tab=batch-sizes&product_id=616&action=create-batch-size" &&
    !missingHandoff.serverContractRequired &&
    missingHandoff.mutation === false,
  "PRM handoff label and URL for missing preferred",
);
const existingHandoff = buildSupplyBatchPlanPreferredBatchSizeHandoffUrl(616);
assert(
  existingHandoff ===
    "/supply-batch-plan.html?tab=batch-sizes&product_id=616",
  "PRM handoff URL without action for existing reference",
);

// 24. PRM inventory remains 45
assert(PRODUCTION_ROUTE_RPC_NAMES.length === 54, "PRM inventory remains 54");
assert(
  !PRODUCTION_ROUTE_RPC_NAMES.includes("rpc_get_supply_batch_size_references") &&
    !PRODUCTION_ROUTE_RPC_NAMES.includes("rpc_create_supply_batch_size_reference"),
  "Supply Batch Plan RPCs not added to PRM inventory",
);

// 25. preferred SERVER CONTRACT REQUIRED stub removed
const actions = getApplicableProductRouteActions({
  readiness_status: "BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE",
  product_id: 616,
});
const preferred = actions.find((a) => a.id === "preferred-batch-size");
assert(
  preferred &&
    preferred.navigateHandoff === true &&
    preferred.serverContractRequired !== true &&
    !prmJs.includes(
      "Governed preferred-batch-size mutation RPC is not approved for client use",
    ),
  "preferred SERVER CONTRACT REQUIRED stub removed",
);

// 26–29. Safety: no costing refresh / Stage 03 / policy approval / PRM mutation
assert(
  /No costing\s+refresh or Stage 03 occurs/.test(sbpHtml) &&
    !sbpJs.includes("rpc_refresh_cost") &&
    !sbpJs.includes("stage03"),
  "no costing refresh / Stage 03 from mutation path",
);
assert(
  !sbpJs.includes("rpc_approve_supply_batch") &&
    SUPPLY_BATCH_PLAN_PERMISSION_TARGET === "module:supply-batch-plan",
  "no policy approval lifecycle; permission target locked",
);
assert(
  preferred.mutation === false &&
    prmJs.includes('window.open(href, "_blank"') &&
    !prmJs.includes("window.location.assign(href)"),
  "no direct PRM mutation for preferred batch size; opens new window",
);

// Register unwrap + state
const unwrapped = unwrapSupplyBatchSizeReferencesPayload({
  rows: [punga],
  total_count: 1,
  status_counts: { ACTIVE: 1 },
  invalid_range_count: 1,
});
assert(
  unwrapped.rows[0].invalid_range === true &&
    unwrapped.invalid_range_count === 1,
  "register unwrap marks invalid range",
);

const registerArgs = buildGetSupplyBatchSizeReferencesArgs({
  search: "punga",
  state: "ACTIVE",
  limit: 50,
  offset: 0,
});
assert(
  registerArgs.ok &&
    registerArgs.params.p_state === "ACTIVE" &&
    registerArgs.params.p_search === "punga",
  "register builder supports search/state/pagination",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll supply-batch-size 11Y.4E.4 smokes passed");
