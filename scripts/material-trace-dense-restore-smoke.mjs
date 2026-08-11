/**
 * Gate 11Y.10G.3B.3A.1 — Dense Trace restoration & Workbench operational
 * simplification smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWorkbenchEvidenceHierarchy,
  canShareMaterialEvidenceTraceTarget,
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
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const cccHtml = readFileSync(
  join(root, "public/shared/costing-control-center.html"),
  "utf8",
);
const mcmHtml = readFileSync(
  join(root, "public/shared/material-cost-manager.html"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const progressiveSmokeSrc = readFileSync(
  join(root, "scripts/material-trace-progressive-density-smoke.mjs"),
  "utf8",
);
const vendorSmoke = readFileSync(
  join(root, "scripts/material-vendor-rate-offers-smoke.mjs"),
  "utf8",
);
const stage05Smoke = readFileSync(
  join(root, "scripts/material-remediation-evidence-smoke.mjs"),
  "utf8",
);

const rmHeaders = [
  "Stock Item Code",
  "Stock Item Name",
  "Product",
  "SKU",
  "SKU Quantity",
  "UOM",
  "Selected Rate",
  "Rate Source",
  "Rate Date",
  "RM Contribution",
  "Contribution %",
  "Review State",
  "Warning",
  "Semi-process Source",
];
const pmHeaders = [
  "Stock Item Code",
  "Stock Item Name",
  "Product",
  "SKU",
  "Qty",
  "UOM",
  "Rate",
  "Rate Source",
  "Rate Date",
  "PM Line Cost",
  "Contribution %",
  "State",
  "Warning",
  "PM Source",
];

assert(
  /"rm-cost-trace":\s*\[[\s\S]*?"Stock Item Code"[\s\S]*?"Semi-process Source"/.test(
    materialSrc,
  ) && rmHeaders.every((h) => materialSrc.includes(`"${h}"`)),
  "1. committed pre-G.3B.3A RM header/row pattern restored",
);
assert(
  !/"rm-cost-trace":\s*\[[\s\S]*?"Detail"/.test(materialSrc) &&
    !/RM detail/.test(materialSrc) &&
    !/renderSharedTracePrimaryRow/.test(materialSrc),
  "2. RM generic Detail column / shared grammar removed",
);
assert(
  /function renderDenseRmTraceRow[\s\S]*?<td>\$\{text\(row\.stock_item_code\)\}<\/td>[\s\S]*?cpCellPrimary\(row\.stock_item_name/.test(
    materialSrc,
  ) && !/function renderDenseRmTraceRow[\s\S]*cp-trace-item-block/.test(materialSrc),
  "3. RM remains single-line/dense (separate code+name cells)",
);
assert(
  /TRACE_PAGE_SIZE\s*=\s*25/.test(materialSrc) &&
    /IntersectionObserver/.test(materialSrc) &&
    /TRACE_QUERY_VERSION/.test(materialSrc),
  "4. RM progressive fetch unchanged",
);
assert(
  /function renderDensePmTraceRow/.test(materialSrc) &&
    /"pm-cost-trace":\s*\[[\s\S]*?"PM Line Cost"[\s\S]*?"PM Source"/.test(
      materialSrc,
    ) &&
    pmHeaders.every((h) => materialSrc.includes(`"${h}"`)),
  "5. PM uses RM visual geometry with PM-native columns",
);
assert(
  !/function renderDensePmTraceRow[\s\S]*cp-trace-item-block/.test(materialSrc),
  "6. PM no stacked divergent Item presentation",
);
assert(
  /#search,\s*\r?\n\s*#rmTraceSearch,\s*\r?\n\s*#pmTraceSearch/.test(mcmHtml),
  "7. PM search width geometry equals RM",
);
assert(
  /TRACE_PAGE_SIZE\s*=\s*25/.test(materialSrc) &&
    /p_offset:\s*offset/.test(materialSrc),
  "8. PM progressive fetch unchanged",
);
assert(
  /function renderDensePmTraceRow[\s\S]*row\.pm_line_cost[\s\S]*row\.pm_source/.test(
    materialSrc,
  ),
  "9. PM-native fields still accessible inline",
);
assert(
  /renderTraceSnapshotBannerHtml/.test(materialSrc),
  "10. metadata component/style shared",
);
assert(
  /function renderPmTraceSnapshotBanner[\s\S]*Valuation[\s\S]*Run/.test(
    materialSrc,
  ),
  "11. PM Valuation/Run retained",
);
{
  const rmBanner =
    materialSrc.match(
      /function renderRmTraceSnapshotBanner\(\) \{[\s\S]*?\r?\n  function /,
    )?.[0] || "";
  assert(
    rmBanner.length > 0 &&
      /do not invent/.test(rmBanner) &&
      !/\bValuation\b/.test(rmBanner),
    "12. RM does not invent Valuation/Run",
  );
}
assert(
  /placePopover/.test(materialSrc) &&
    /placePopover/.test(controlSrc) &&
    /zIndex = "6000"/.test(materialSrc) &&
    /position: fixed/.test(mcmHtml) &&
    /z-index: 6000/.test(cccHtml),
  "warning popover uses fixed viewport placement above table overflow",
);
assert(
  /cp-evidence-warning-chip/.test(materialSrc) &&
    /cp-evidence-warning-chip/.test(controlSrc) &&
    /data-cp-disclosure-trigger/.test(controlSrc),
  "13. warning chip visually interactive",
);
assert(
  /cp-muted-text">Code</.test(controlSrc) &&
    /cp-muted-text">Warning</.test(controlSrc) &&
    /cp-muted-text">Code</.test(materialSrc) &&
    /cp-muted-text">Warning</.test(materialSrc),
  "14. warning popover retains full code/text",
);
assert(
  /Escape/.test(controlSrc) &&
    /aria-expanded/.test(controlSrc) &&
    /aria-haspopup="dialog"/.test(controlSrc),
  "15. warning popover keyboard usable",
);
assert(
  !/<details class="cp-evidence-warning">/.test(controlSrc) &&
    !/<details class="cp-trace-native-detail">/.test(materialSrc),
  "16. no default warning/detail row expansion",
);

const kaduRows = [];
for (let i = 0; i < 60; i += 1) {
  const productId = i < 47 ? i + 1 : ((i - 47) % 47) + 1;
  kaduRows.push({
    period_start: "2026-08-01",
    material_area: "RM",
    stock_item_id: 351,
    stock_item_name: "Kadukurohini (D)",
    stock_item_code: "KADU",
    product_id: productId,
    product_name: `Product ${productId}`,
    sku_id: i + 1,
    pack_size: 100,
    pack_uom: "mL",
    material_issue_code: "STALE_RM_PURCHASE_RATE",
    warning_code: "STALE_PURCHASE_RATE",
    warning_text: "Stale purchase rate text",
    selected_rate: 1650,
    rate_source: "LAST_PURCHASE",
    rate_date: "2026-02-05",
    approval_block_flag: false,
    source_line_key: `key-${i + 1}`,
    frozen_rm_line_snapshot_id: 1000 + i,
    bom_source: i < 56 ? "RM_BOM" : "SP_BOM",
    line_no: 8,
    qty_per_reference_output: 1,
  });
}
const hierarchy = buildWorkbenchEvidenceHierarchy(kaduRows);
assert(
  /cp-wb-l1-ops/.test(controlSrc) &&
    /frozen \/ affected lines/.test(controlSrc) &&
    /Affected Products \/ SKUs/.test(controlSrc),
  "17. Workbench summary compact",
);
assert(hierarchy.frozenLineCount === 60, "18. Kadukurohini raw count 60");
assert(hierarchy.productCount === 47, "19. Kadukurohini Product count 47");
assert(hierarchy.skuCount === 60, "20. Kadukurohini SKU count 60");
assert(
  /\.cp-wb-l2-list\.hidden\s*\{[\s\S]*display:\s*none\s*!important/.test(
    cccHtml,
  ) &&
    /Hide affected Products \/ SKUs/.test(controlSrc) &&
    /data-workbench-l1-toggle/.test(controlSrc),
  "21. affected Product/SKU table toggles visibly",
);
assert(
  /cp-wb-affected-table/.test(controlSrc) &&
    /SKU \/ Pack/.test(controlSrc) &&
    !/cp-wb-exact-inline/.test(controlSrc),
  "22. default Product/SKU rows contain no forensic IDs",
);
assert(
  /renderWorkbenchAuditPopover/.test(controlSrc) &&
    /source_line_key/.test(controlSrc) &&
    /frozen_rm_line_snapshot_id/.test(controlSrc),
  "23. Audit control exposes exact frozen identity",
);

const multiMembers = [
  { ...kaduRows[0], source_line_key: "A", frozen_rm_line_snapshot_id: 1 },
  { ...kaduRows[0], source_line_key: "B", frozen_rm_line_snapshot_id: 2 },
];
const multiHierarchy = buildWorkbenchEvidenceHierarchy(multiMembers);
assert(
  multiHierarchy.subgroups[0].members.length === 2 &&
    /Frozen line \$\{/.test(controlSrc),
  "24. multi-line Audit preserves every raw line",
);
assert(
  !/SELECT DISTINCT|new Set\(rows\.map/.test(
    controlSrc.match(
      /export function buildWorkbenchEvidenceHierarchy[\s\S]*?^}/m,
    )?.[0] || "",
  ),
  "25. no DISTINCT",
);
assert(
  canShareMaterialEvidenceTraceTarget(hierarchy.subgroups[0].members) === true &&
    /data-workbench-trace-subgroup/.test(controlSrc),
  "26. Product/SKU Trace target correct",
);
assert(
  /no single Trace target/.test(controlSrc) &&
    !/data-workbench-l1-trace/.test(controlSrc),
  "27. no portfolio-level arbitrary Trace",
);

const agasthyar = groupMaterialEvidenceLines([
  {
    material_area: "RM",
    stock_item_id: 1,
    material_issue_code: "STALE_RM_PURCHASE_RATE",
    warning_code: "STALE_PURCHASE_RATE",
    warning_text: "a",
    selected_rate: 1,
    rate_source: "LAST_PURCHASE",
    rate_date: "2025-01-01",
    product_id: 10,
    sku_id: 134,
    period_start: "2026-08-01",
    source_line_key: "rm1",
  },
  {
    material_area: "RM",
    stock_item_id: 2,
    material_issue_code: "STALE_RM_PURCHASE_RATE",
    warning_code: "STALE_PURCHASE_RATE",
    warning_text: "b",
    selected_rate: 2,
    rate_source: "LAST_PURCHASE",
    rate_date: "2025-01-01",
    product_id: 10,
    sku_id: 134,
    period_start: "2026-08-01",
    source_line_key: "rm2",
  },
  {
    material_area: "PM",
    stock_item_id: 3,
    material_issue_code: "PM_STOCK_VALUATION_FALLBACK",
    warning_code: "STOCK_VALUATION_FALLBACK",
    warning_text: "c",
    selected_rate: 3,
    rate_source: "STOCK_VALUATION",
    rate_date: "2025-01-01",
    product_id: 10,
    sku_id: 134,
    period_start: "2026-08-01",
    source_line_key: "pm1",
  },
]);
assert(
  agasthyar.length === 3 &&
    agasthyar.filter((g) => g.members[0].material_area === "RM").length === 2 &&
    agasthyar.filter((g) => g.members[0].material_area === "PM").length === 1,
  "28. Agasthyar Evidence regression",
);
assert(
  /aria-hidden/.test(materialSrc) &&
    /inert/.test(materialSrc) &&
    /moveFocusOutOfInteractiveRegion/.test(materialSrc),
  "29. aria/focus regression preserved",
);
assert(
  /VENDOR_RATE_BOOK/.test(materialSrc) ||
    /rpc_get_material_vendor_rate_offers/.test(vendorSmoke),
  "30. Vendor Rate Book regression smoke still present",
);
assert(
  /guardMaterialCostWriteAction/.test(materialSrc) ||
    /rpc_set_material_manual_rate/.test(materialSrc),
  "31. Set Costing Rate regression surface present",
);
assert(
  /TRACE_LOAD_STATE = "restricted"/.test(materialSrc) &&
    /canAccessRmTrace/.test(materialSrc) &&
    /permissionsResolved/.test(materialSrc),
  "32. permissions remain fail-closed",
);
assert(
  /TRACE_PAGE_SIZE/.test(progressiveSmokeSrc),
  "32b. progressive density smoke retained",
);
assert(/Stage-05|stage05|STAGE05/.test(stage05Smoke), "Stage-05 smoke retained");
assert(/CACHE_NAME = "hub-cache-v250"/.test(swSrc), "SW bumped to hub-cache-v250");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10G.3B.3A.1 dense-restore smokes passed.");
