/**
 * Gate 11Y.10G.3B.4B — SKU grid column separation & modal evidence density smoke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatFirstControlStatusLabel,
  formatRecommendedUiRouteLabel,
} from "../public/shared/js/costing-suite-recommended-ui-route.js";
import {
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
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const cccHtml = readFileSync(
  join(root, "public/shared/costing-control-center.html"),
  "utf8",
);
const materialSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-material-cost.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

const skuHeadersMatch = controlSrc.match(
  /"sku-control-status":\s*\[([\s\S]*?)\],\s*\n\};/,
);
const skuHeaderBlock = skuHeadersMatch?.[1] || "";
assert(
  /"Product"/.test(skuHeaderBlock) &&
    /"SKU"/.test(skuHeaderBlock) &&
    /"Pack"/.test(skuHeaderBlock) &&
    /"Status"/.test(skuHeaderBlock) &&
    /"Primary Control"/.test(skuHeaderBlock) &&
    /"Recommended Route"/.test(skuHeaderBlock),
  "1. headers Product|SKU|Pack|Status|Primary Control|Recommended Route",
);
assert(
  !/"SKU \/ Pack"/.test(skuHeaderBlock),
  "2. no combined SKU / Pack header",
);
assert(
  !/"Action"/.test(skuHeaderBlock) &&
    !/"Primary Issue"/.test(skuHeaderBlock) &&
    !/"Material Status"/.test(skuHeaderBlock) &&
    !/"Control Note"/.test(skuHeaderBlock) &&
    !/"Snapshot Refreshed"/.test(skuHeaderBlock),
  "3. no Action / Material Status / Control Note / Snapshot headers",
);

const rowFn =
  controlSrc.match(
    /function renderSkuControlStatusTableRow\([\s\S]*?\n  function /,
  )?.[0] || "";
assert(
  /formatSkuControlSkuLabel/.test(rowFn) &&
    /SKU \$\{row\.sku_id\}/.test(controlSrc) &&
    /sku_id != null \? `SKU \$\{row\.sku_id\}` : "--"/.test(controlSrc),
  "4. SKU renders truthful SKU {sku_id} with -- fallback",
);
assert(
  /formatSkuControlPackLabel/.test(rowFn) &&
    /pack_size/.test(controlSrc) &&
    /pack_uom/.test(controlSrc) &&
    /cp-sku-control-pack/.test(rowFn),
  "5. Pack renders pack_size + pack_uom in own column",
);
assert(
  !/formatSkuPackLabel\(row\)/.test(rowFn),
  "6. main row does not use combined formatSkuPackLabel",
);
assert(!/data-sku-control-open/.test(rowFn) && !/>Open</.test(rowFn), "7. no Open/Action button");
assert(
  !/data-sku-control-open/.test(shellSrc) &&
    !/cp-sku-control-open-btn/.test(shellSrc),
  "8. no data-sku-control-open wiring",
);
assert(
  /class="clickable" data-row-index=/.test(shellSrc) &&
    /openDetails\(row, preferred\)/.test(shellSrc),
  "9. row remains clickable; openDetails path preserved",
);
assert(
  /statusChip\(statusDisplay\)/.test(rowFn) &&
    /formatSkuControlStatusDisplayLabel/.test(controlSrc),
  "10. one Status chip only",
);
assert(
  /formatFirstControlStatusLabel\(row\.first_control_status\)/.test(rowFn),
  "11. Primary Control uses existing formatter",
);
assert(
  /cp-sku-control-route/.test(rowFn) &&
    /formatRecommendedUiRouteLabel\(row\.recommended_ui_route\)/.test(rowFn) &&
    !/data-sku-control-nav/.test(rowFn),
  "12. Recommended Route separate + non-navigable",
);
assert(
  /row\.control_severity/.test(shellSrc) &&
    /statusTokenMatches/.test(shellSrc) &&
    /BLOCKER: \["BLOCKER", "BLOCKED"\]/.test(shellSrc),
  "13. filter semantics unchanged",
);
assert(
  /function getSearchBlob/.test(shellSrc) &&
    /row\.first_control_status/.test(shellSrc) &&
    /row\.recommended_ui_route/.test(shellSrc),
  "14. search blob unchanged",
);
assert(
  /severityRank = \{ BLOCKER: 0, REVIEW_REQUIRED: 1, READY: 2 \}/.test(
    controlSrc,
  ),
  "15. severity ordering unchanged",
);

const evidenceFn =
  controlSrc.match(
    /function renderDenseMaterialEvidenceTable\([\s\S]*?\n  function /,
  )?.[0] || "";
assert(
  /"Material"/.test(evidenceFn) &&
    /"Code"/.test(evidenceFn) &&
    /"Area"/.test(evidenceFn) &&
    /"Issue"/.test(evidenceFn) &&
    /"Rate"/.test(evidenceFn) &&
    /"Source"/.test(evidenceFn) &&
    /"Date"/.test(evidenceFn) &&
    /"Warning"/.test(evidenceFn) &&
    /"Trace"/.test(evidenceFn),
  "16. Exact Evidence headers Material|Code|Area|Issue|Rate|Source|Date|Warning|Trace",
);
assert(
  !/"Action"/.test(evidenceFn),
  "17. Trace header used (not Action)",
);
assert(
  /stock_item_code \|\| "--"/.test(evidenceFn) &&
    /cp-evidence-code/.test(evidenceFn),
  "18. Material and Code separate",
);
assert(
  !/cp-muted-text">\$\{text\(line\.stock_item_code/.test(evidenceFn) &&
    !/cp-muted-text">\$\{text\(line\.material_issue_code/.test(evidenceFn),
  "19. no primary material/code or issue-code stack",
);
assert(
  /formatMoney\(line\.selected_rate\)/.test(evidenceFn) &&
    /cp-evidence-source/.test(evidenceFn) &&
    /formatDate\(line\.rate_date\)/.test(evidenceFn) &&
    !/renderEvidenceRateCell/.test(evidenceFn) &&
    !/cp-evidence-rate">/.test(evidenceFn),
  "20. Rate/Source/Date separate; no stacked rate cell",
);
assert(
  /renderAccessibleWarningDetail\(line\)/.test(evidenceFn),
  "21. Warning popover renderer preserved",
);
assert(
  /evidenceColCount = 9/.test(evidenceFn) &&
    /colspan="\$\{evidenceColCount\}"/.test(evidenceFn),
  "22. grouped detail colspan uses 9",
);
assert(
  /cp-evidence-group-badge/.test(evidenceFn) &&
    /cp-evidence-material-line/.test(evidenceFn) &&
    /renderFrozenLineAuditDetail\(member\)/.test(evidenceFn),
  "23. grouping badge + audit detail preserved",
);
assert(
  /Open RM Trace/.test(controlSrc) &&
    /Open PM Trace/.test(controlSrc) &&
    /icon-btn cp-evidence-trace-btn/.test(controlSrc) &&
    /cp-evidence-trace-col/.test(evidenceFn),
  "24. Trace CTA labels + compact button class",
);
assert(
  /cp-evidence-trace-btn/.test(cccHtml) &&
    /min-height: 28px/.test(cccHtml) &&
    /cp-sku-evidence-table/.test(cccHtml) &&
    /cp-sku-control-pack/.test(cccHtml),
  "25. evidence/main density CSS present",
);
assert(
  /buildWorkbenchEvidenceHierarchy/.test(controlSrc) &&
    /costing-review-workbench/.test(controlSrc) &&
    !/cp-sku-evidence-table/.test(
      controlSrc.match(
        /function buildWorkbenchEvidenceHierarchy[\s\S]*?\n  function /,
      )?.[0] || "",
    ),
  "26. Workbench hierarchy untouched by SKU evidence table class",
);
assert(
  /TRACE_PAGE_SIZE\s*=\s*25/.test(materialSrc) &&
    /renderDenseRmTraceRow/.test(materialSrc),
  "27. RM/PM Trace lenses untouched",
);
assert(
  /CURRENT SOURCE STATE/.test(controlSrc) &&
    /loadSkuFoundationDiagnosis/.test(controlSrc) &&
    /\["Control code", text\(row\.first_control_status\)\]/.test(controlSrc),
  "28. drawer Control / CURRENT SOURCE STATE unchanged",
);

const agasthyarLines = [
  {
    material_area: "RM",
    stock_item_id: 1,
    material_issue_code: "A",
    selected_rate: 1,
    rate_source: "LAST_PURCHASE",
    rate_date: "2026-01-01",
    product_id: 10,
    sku_id: 20,
    source_line_key: "rm-1",
  },
  {
    material_area: "RM",
    stock_item_id: 2,
    material_issue_code: "B",
    selected_rate: 2,
    rate_source: "STOCK_VALUATION",
    rate_date: "2026-01-02",
    product_id: 10,
    sku_id: 20,
    source_line_key: "rm-2",
  },
  {
    material_area: "PM",
    stock_item_id: 3,
    material_issue_code: "C",
    selected_rate: 3,
    rate_source: "PM_SKU_OVERRIDE",
    rate_date: "2026-01-03",
    product_id: 10,
    sku_id: 20,
    source_line_key: "pm-1",
  },
];
const groups = groupMaterialEvidenceLines(agasthyarLines);
const rmCount = groups
  .filter((g) => String(g.members[0]?.material_area || "").toUpperCase() === "RM")
  .reduce((n, g) => n + g.members.length, 0);
const pmCount = groups
  .filter((g) => String(g.members[0]?.material_area || "").toUpperCase() === "PM")
  .reduce((n, g) => n + g.members.length, 0);
assert(
  groups.length === 3 && rmCount === 2 && pmCount === 1,
  "29. Agasthyar-style evidence grouping RM2 / PM1 preserved (no DISTINCT)",
);
assert(
  formatFirstControlStatusLabel("DIRECT_LABOUR_ROUTE_BLOCKED") ===
    "Production Route required" &&
    formatRecommendedUiRouteLabel("PRODUCTION_ROUTE_MANAGER") ===
      "Production Route Manager",
  "30. Abhraka presentation formatters intact",
);
assert(
  /isPermissionDeniedError/.test(controlSrc) || /permission/i.test(controlSrc),
  "31. permission fail-closed unchanged",
);
assert(/CACHE_NAME = "hub-cache-v250"/.test(swSrc), "32. SW bumped to hub-cache-v250");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(
  "\nAll Gate 11Y.10G.3B.4B SKU grid / Exact Evidence density smokes passed.",
);
