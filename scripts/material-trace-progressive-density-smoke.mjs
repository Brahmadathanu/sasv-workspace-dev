/**
 * Gate 11Y.10G.3B.3 — RM/PM Trace progressive loading, evidence density,
 * frozen-line grouping, and MCM focus/aria lifecycle smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMaterialEvidenceGroupKey,
  canShareMaterialEvidenceTraceTarget,
  formatMaterialIssueLabel,
  formatMaterialWarningLabel,
  groupMaterialEvidenceLines,
} from "../public/shared/js/costing-suite-control-center.js";

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
const materialSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-material-cost.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const mcmHtml = readFileSync(
  join(root, "public/shared/material-cost-manager.html"),
  "utf8",
);
const cccHtml = readFileSync(
  join(root, "public/shared/costing-control-center.html"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const vendorSmoke = readFileSync(
  join(root, "scripts/material-vendor-rate-offers-smoke.mjs"),
  "utf8",
);
const stage05Smoke = readFileSync(
  join(root, "scripts/material-remediation-evidence-smoke.mjs"),
  "utf8",
);

// Progressive fetch contract
assert(
  /TRACE_PAGE_SIZE\s*=\s*25/.test(materialSrc),
  "RM/PM first-page size remains 25",
);
assert(
  /p_offset:\s*0/.test(materialSrc) && /p_limit:\s*TRACE_PAGE_SIZE/.test(materialSrc),
  "RM/PM first fetch uses offset 0 / limit 25",
);
assert(
  /const offset = TRACE_ROWS\.length/.test(materialSrc) &&
    /p_offset:\s*offset/.test(materialSrc),
  "append uses loadedCount as next offset",
);
assert(
  /TRACE_HAS_MORE\s*=\s*[\s\S]*TRACE_ROWS\.length < TRACE_TOTAL_COUNT/.test(
    materialSrc,
  ),
  "hasMore stops at totalCount",
);
assert(
  /if \(!rows\.length\)[\s\S]*TRACE_HAS_MORE = false/.test(materialSrc),
  "empty next batch stops further requests",
);
assert(
  /TRACE_LOAD_MORE_IN_FLIGHT/.test(materialSrc) &&
    /if \(TRACE_LOADING \|\| TRACE_LOAD_MORE_IN_FLIGHT \|\| !TRACE_HAS_MORE\)/.test(
      materialSrc,
    ),
  "no duplicate concurrent next fetch",
);
assert(
  /queryVersion !== TRACE_QUERY_VERSION/.test(materialSrc),
  "queryVersion discards stale response",
);
assert(
  /async function reloadRmTraceFromFilters[\s\S]*TRACE_ROWS = \[\]/.test(
    materialSrc,
  ) &&
    /async function reloadPmTraceFromFilters[\s\S]*TRACE_ROWS = \[\]/.test(
      materialSrc,
    ),
  "period/filter/search reset clears rows and restarts",
);
assert(
  /IntersectionObserver/.test(materialSrc) &&
    /root:\s*wrap/.test(materialSrc) &&
    !/window\.addEventListener\(\s*["']scroll["']/.test(materialSrc),
  "progressive loading uses container IntersectionObserver (not window scroll)",
);

// Paginator scope
assert(
  /rmTraceActive[\s\S]*setVisible\(shellPagination,\s*false\)/.test(shellSrc),
  "Trace lenses hide shell Prev/Next/Page UI",
);
assert(
  /prevPage\?\.addEventListener\("click", \(\) => \{\s*if \(isMaterialCostTraceLensActive\(\)\) \{\s*return;/.test(
    shellSrc,
  ),
  "Trace Prev handler is inert",
);
assert(
  /nextPage\?\.addEventListener\("click", \(\) => \{\s*if \(isMaterialCostTraceLensActive\(\)\) \{\s*return;/.test(
    shellSrc,
  ),
  "Trace Next handler is inert",
);
assert(
  /isQcActionQueueLens[\s\S]*setVisible\(shellPagination,\s*true/.test(shellSrc) ||
    /setVisible\(shellPaginationRestore,\s*true/.test(shellSrc),
  "other lenses retain existing paginator path",
);

// Placeholders
assert(
  mcmHtml.includes('placeholder="Search item code, item name, product or SKU"'),
  "RM placeholder exact",
);
assert(
  mcmHtml.includes(
    'placeholder="Search PM item code, item name, product or pack"',
  ),
  "PM placeholder exact",
);

// Metadata
assert(
  /function renderRmTraceSnapshotBanner[\s\S]*do not invent/.test(materialSrc) ||
    (/function renderRmTraceSnapshotBanner[\s\S]*Snapshot refreshed/.test(
      materialSrc,
    ) &&
      !/function renderRmTraceSnapshotBanner[\s\S]*Valuation/.test(materialSrc)),
  "RM does not fabricate valuation/run",
);
assert(
  /function renderPmTraceSnapshotBanner[\s\S]*Valuation/.test(materialSrc) &&
    /function renderPmTraceSnapshotBanner[\s\S]*Run/.test(materialSrc),
  "PM retains actual valuation/run context",
);
assert(
  /rmTraceActive[\s\S]*rowCount\.style\.display = "none"/.test(shellSrc),
  "one metadata row only (no duplicate Trace row-count line)",
);

// Evidence density / warning
assert(
  /cp-evidence-warning/.test(controlSrc) &&
    /data-cp-disclosure-trigger/.test(controlSrc) &&
    /cp-anchored-popover/.test(controlSrc) &&
    !/<details class="cp-evidence-warning">/.test(controlSrc),
  "long warnings compact with accessible popover affordance",
);
assert(
  formatMaterialWarningLabel("STOCK_VALUATION_FALLBACK") ===
    "Stock valuation fallback",
  "warning label humanizes STOCK_VALUATION_FALLBACK",
);
assert(
  formatMaterialIssueLabel("STALE_RM_PURCHASE_RATE") === "Stale purchase rate",
  "issue label humanizes STALE_RM_PURCHASE_RATE",
);
assert(
  /warning_code/.test(controlSrc) && /warning_text/.test(controlSrc),
  "full warning code/text remain available in detail",
);

// Grouping
const twinA = {
  material_area: "RM",
  stock_item_id: 11,
  material_issue_code: "STALE_RM_PURCHASE_RATE",
  warning_code: "STALE_PURCHASE_RATE",
  warning_text: "Stale",
  selected_rate: 10,
  rate_source: "LAST_PURCHASE",
  rate_date: "2025-01-01",
  approval_block_flag: false,
  product_id: 1,
  sku_id: 2,
  period_start: "2026-08-01",
  source_line_key: "A",
  frozen_rm_line_snapshot_id: 100,
};
const twinB = {
  ...twinA,
  source_line_key: "B",
  frozen_rm_line_snapshot_id: 101,
};
const mixed = {
  ...twinA,
  stock_item_id: 99,
  source_line_key: "C",
  frozen_rm_line_snapshot_id: 102,
};
const grouped = groupMaterialEvidenceLines([twinA, twinB, mixed]);
assert(grouped.length === 2, "grouping never removes underlying rows (3 -> 2 groups)");
assert(
  grouped[0].members.length === 2 &&
    grouped[0].members.every((m) => m.source_line_key),
  "grouped row retains distinct members with source_line_key",
);
assert(
  grouped[0].members.map((m) => m.frozen_rm_line_snapshot_id).join(",") ===
    "100,101",
  "expanded group preserves frozen snapshot IDs",
);
assert(
  /N frozen lines|frozen lines/.test(controlSrc),
  "grouped row displays N frozen lines badge copy",
);
assert(
  canShareMaterialEvidenceTraceTarget([twinA, twinB]) === true,
  "safe group Trace target is shared",
);
assert(
  canShareMaterialEvidenceTraceTarget([twinA, mixed]) === false,
  "unsafe mixed-target group is not shareable",
);
assert(
  /Trace target is ambiguous/.test(controlSrc) ||
    /disabled:\s*!shareTrace/.test(controlSrc),
  "unsafe mixed-target group does not expose ambiguous summary Trace",
);
assert(
  buildMaterialEvidenceGroupKey(twinA) === buildMaterialEvidenceGroupKey(twinB),
  "identical operator-visible tuples share group key",
);
assert(
  buildMaterialEvidenceGroupKey(twinA) !== buildMaterialEvidenceGroupKey(mixed),
  "operational stock-item difference splits groups",
);

// Trace handoff
assert(
  /rm-cost-trace/.test(controlSrc) && /pm-cost-trace/.test(controlSrc),
  "individual RM/PM Trace handoff retained",
);
assert(
  (/cp-evidence-trace-col/.test(controlSrc) ||
    /cp-evidence-action-col/.test(controlSrc)) &&
    /position:\s*sticky/.test(cccHtml) &&
    (/cp-evidence-trace-col/.test(cccHtml) ||
      /cp-evidence-action-col/.test(cccHtml)),
  "sticky Trace column styles present",
);

// Focus / aria
assert(
  /moveFocusOutOfInteractiveRegion/.test(materialSrc) &&
    /hideInteractiveRegion/.test(materialSrc),
  "focus moved before region becomes hidden/inert",
);
assert(
  /syncManualRateManagerControlsVisibility[\s\S]*hideInteractiveRegion\(controls/.test(
    materialSrc,
  ),
  "manualRateManagerControls hide path uses focus-safe helper",
);
assert(
  /inert/.test(materialSrc),
  "inert used for inactive interactive regions",
);
assert(
  !/controls\.setAttribute\("aria-hidden", show \? "false" : "true"\)/.test(
    materialSrc,
  ),
  "no raw aria-hidden focused-descendant pattern remains on MCM controls",
);

// Regressions
assert(
  /Set Costing Rate|openManualRateEditModal|rpc_set_material_manual_rate/.test(
    materialSrc,
  ),
  "Set Costing Rate regression anchor present",
);
assert(
  /rpc_get_material_vendor_rate_offers/.test(vendorSmoke),
  "Vendor Rate Book regression smoke retained",
);
assert(
  /Stage-05|isStage05MaterialRemediationMode/.test(stage05Smoke),
  "Stage-05 remediation regression smoke retained",
);
assert(
  /rpc_get_current_material_foundation_diagnosis/.test(controlSrc),
  "foundation diagnosis retained",
);
assert(
  /renderWorkbenchLineEvidenceTab/.test(controlSrc) &&
    /renderSkuControlEvidenceTab/.test(controlSrc),
  "SKU Evidence + Workbench regression anchors present",
);
assert(
  /TRACE_LOAD_STATE = "restricted"/.test(materialSrc),
  "permission failures still fail closed",
);

assert(
  /CACHE_NAME = "hub-cache-v250"/.test(swSrc),
  "service worker bumped to hub-cache-v250",
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10G.3B.3 progressive/density smokes passed.");
