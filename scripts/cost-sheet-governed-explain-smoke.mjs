/**
 * Gate 11Y.10D.2 — Cost Sheet Review run-82 governed Explain client smoke.
 * Pure helpers + source-contract checks. No live DB / refresh / valuation mutation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COST_SHEET_EVIDENCE_KEY_META,
  explainRequestIdentity,
  interpretTraceabilityRows,
  isTraceabilityLoadError,
  listPresentWhitelistedEvidence,
  resolveTraceabilityExactRunMode,
} from "../public/shared/js/costing-suite-cost-sheet.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const costSheetSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-cost-sheet.js"),
  "utf8",
);

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

// --- Exact-run mode ---
assert(
  resolveTraceabilityExactRunMode({
    valuationDate: "2026-08-07",
    refreshRunId: 82,
  }).mode === "exact-run",
  "exact-run mode when valuation + run present",
);
assert(
  resolveTraceabilityExactRunMode({
    valuationDate: "2026-08-07",
    refreshRunId: 82,
  }).refreshRunId === 82,
  "exact-run preserves refresh_run_id 82",
);
assert(
  resolveTraceabilityExactRunMode({
    valuationDate: "",
    refreshRunId: 82,
  }).mode === "missing-exact-run",
  "missing valuation → missing-exact-run",
);
assert(
  resolveTraceabilityExactRunMode({
    valuationDate: "2026-08-07",
  }).mode === "missing-exact-run",
  "missing run → missing-exact-run",
);

// --- Fail-closed row interpretation ---
assert(
  interpretTraceabilityRows([], { usedExactRunFilters: true }).code ===
    "NOT_FOUND",
  "empty rows → NOT_FOUND",
);
assert(
  interpretTraceabilityRows(
    [
      { refresh_run_id: 82, valuation_date: "2026-08-07" },
      { refresh_run_id: 81, valuation_date: "2026-08-07" },
    ],
    { usedExactRunFilters: true },
  ).code === "AMBIGUOUS",
  "multiple rows → AMBIGUOUS (no arbitrary pick)",
);
assert(
  interpretTraceabilityRows(
    [{ refresh_run_id: 81, valuation_date: "2026-08-07", line_label: "DL" }],
    {
      expectedRefreshRunId: 82,
      expectedValuationDate: "2026-08-07",
      usedExactRunFilters: true,
    },
  ).code === "WRONG_RUN",
  "wrong-run row rejected",
);
assert(
  interpretTraceabilityRows(
    [{ refresh_run_id: 82, valuation_date: "2026-08-07", line_label: "DL" }],
    {
      expectedRefreshRunId: 82,
      expectedValuationDate: "2026-08-07",
      usedExactRunFilters: true,
    },
  ).ok === true,
  "matching exact-run row accepted",
);

assert(
  isTraceabilityLoadError({
    __traceLoadError: true,
    message: "x",
  }),
  "trace load error sentinel detected",
);
assert(
  !isTraceabilityLoadError({ refresh_run_id: 82 }),
  "normal row is not a load error",
);

assert(
  explainRequestIdentity({
    periodStart: "2026-08-01",
    valuationDate: "2026-08-07",
    refreshRunId: 82,
    productId: 1,
    skuId: 2,
    lineLabel: "Direct Labour",
  }).includes("2026-08-07") &&
    explainRequestIdentity({
      periodStart: "2026-08-01",
      valuationDate: "2026-08-07",
      refreshRunId: 82,
      productId: 1,
      skuId: 2,
      lineLabel: "Direct Labour",
    }).includes("|82|"),
  "explain request identity includes valuation + run",
);

// --- Evidence whitelist ---
const sampleEvidence = {
  policy_id: "pol-1",
  pool_snapshot_id: "pool-1",
  frozen_pool_amount: 1000,
  product_workload_share: 0.0123,
  product_allocation_amount: 12.34,
  region_code: "IK",
  unknown_internal_noise: { nested: true },
  blank_skip: "",
  null_skip: null,
};
const present = listPresentWhitelistedEvidence(sampleEvidence);
assert(
  present.some((e) => e.key === "policy_id" && e.label === "Policy ID"),
  "policy_id maps to human label",
);
assert(
  present.some((e) => e.key === "frozen_pool_amount" && e.section === "governance"),
  "frozen_pool_amount in governance section",
);
assert(
  present.some((e) => e.key === "product_workload_share" && e.section === "workload"),
  "product_workload_share in workload section",
);
assert(
  present.some((e) => e.key === "region_code"),
  "marketing region_code whitelisted",
);
assert(
  !present.some((e) => e.key === "unknown_internal_noise"),
  "unknown keys are not dumped",
);
assert(
  !present.some((e) => e.key === "blank_skip" || e.key === "null_skip"),
  "null/empty evidence omitted",
);
assert(
  COST_SHEET_EVIDENCE_KEY_META.some(([k]) => k === "policy_envelope_id") &&
    COST_SHEET_EVIDENCE_KEY_META.some(([k]) => k === "monthly_sku_allocation_amount") &&
    COST_SHEET_EVIDENCE_KEY_META.some(
      ([k]) => k === "product_region_monetary_allocation_share",
    ),
  "run-82 governed keys present in meta",
);

// --- Source contract: loader / context ---
assert(
  costSheetSrc.includes('.eq("valuation_date"') &&
    costSheetSrc.includes('.eq("refresh_run_id"') &&
    /loadCostSheetLineTraceability[\s\S]{0,2500}maybeSingle\(/.test(costSheetSrc),
  "trace loader applies exact valuation/run filters with maybeSingle",
);
assert(
  !/loadCostSheetLineTraceability[\s\S]{0,2500}\.limit\(1\)/.test(costSheetSrc),
  "trace loader no longer uses .limit(1) ambiguity resolution",
);
assert(
  costSheetSrc.includes("MISSING_EXACT_RUN") &&
    costSheetSrc.includes("resolveTraceabilityExactRunMode"),
  "missing exact-run fails closed",
);
assert(
  costSheetSrc.includes('data-explain-valuation-date') &&
    costSheetSrc.includes('data-explain-refresh-run-id'),
  "explain cell attrs carry valuation + run",
);
assert(
  costSheetSrc.includes('kvSection("Context"') ||
    costSheetSrc.includes('kvSection("Context",'),
  "Explain Context section present",
);
assert(
  costSheetSrc.includes("rpc_get_cost_sheet_rm_explain_summary") &&
    costSheetSrc.includes("rpc_get_cost_sheet_marketing_explain_summary"),
  "RM and Marketing dedicated Explains preserved",
);
assert(
  !/Direct Labour[\s\S]{0,120}product\s+sales\s+share/i.test(costSheetSrc) &&
    !/Production Overhead[\s\S]{0,120}product\s+sales\s+share/i.test(costSheetSrc),
  "no DL/POH client sales-share formula authority",
);

if (failed) {
  console.error(`\ncost-sheet-governed-explain-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\ncost-sheet-governed-explain-smoke: all checks passed");
