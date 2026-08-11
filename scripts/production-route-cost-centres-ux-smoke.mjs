/**
 * Non-mutating UX smoke — Gate 11Y.10I.2C.1C Cost Centre UX Harmonisation.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlSrc = readFileSync(
  join(root, "public/shared/production-route-manager.html"),
  "utf8",
);
const routeSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route.js"),
  "utf8",
);
const ccSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route-cost-centres.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`OK ${msg}`);
  }
}

function extractCostCentresCss(src) {
  const markers = [
    ".cp-prm-cost-centres-chrome-active",
    ".cp-workbench-summary.cp-prm-cost-centres-summary-host",
    ".cp-prm-cost-centres-toolbar",
    ".cp-prm-cc-catalog",
    ".cp-prm-cost-centre-manager-row",
    ".cp-prm-cc-desc",
    "#mainTable[data-prm-cost-centres-table]",
    ".cp-prm-cost-centre-modal",
  ];
  const chunks = [];
  for (const marker of markers) {
    const idx = src.indexOf(marker);
    if (idx < 0) continue;
    const end = src.indexOf("}", src.indexOf("{", idx)) + 1;
    if (end > idx) chunks.push(src.slice(idx, end));
  }
  // Also grab multi-rule modal blocks after first modal marker
  const modalIdx = src.indexOf(".cp-prm-cost-centre-modal");
  if (modalIdx >= 0) {
    chunks.push(src.slice(modalIdx, modalIdx + 900));
  }
  return chunks.join("\n");
}

// 1 Status/Pool removed from body
assert(
  !ccSrc.includes('summary.innerHTML = `<div class="cp-prm-cost-centres-toolbar"') ||
    !/summary\.innerHTML[\s\S]*?prmCcStatusFilter/.test(ccSrc),
  "1. Status/Pool removed from Cost Centres body/summary",
);
assert(
  !/<label class="cp-prm-cc-filter">[\s\S]*?prmCcStatusFilter/.test(ccSrc),
  "1b. no body Status label filter",
);

// 2–3 drawer section + IDs
assert(
  htmlSrc.includes('data-peq-section="prm-cost-centres"'),
  "2. prm-cost-centres drawer section exists",
);
assert(
  /id="prmCcStatusFilter"/.test(htmlSrc) && /id="prmCcPoolFilter"/.test(htmlSrc),
  "3. Status + Pool IDs preserved in drawer",
);
assert(
  (htmlSrc.match(/id="prmCcStatusFilter"/g) || []).length === 1 &&
    (htmlSrc.match(/id="prmCcPoolFilter"/g) || []).length === 1,
  "8. no duplicate Status/Pool control IDs",
);
assert(
  !ccSrc.includes('id="prmCcStatusFilter"') &&
    !ccSrc.includes('id="prmCcPoolFilter"'),
  "8b. Cost Centres JS does not re-emit filter IDs in body",
);

// 4–5 context-sensitive drawer
assert(
  routeSrc.includes('data-peq-section="prm-cost-centres"') &&
    routeSrc.includes('costCentresActive = state.activeLens === "production-cost-centres"'),
  "4. Cost Centre drawer shown only on Cost Centres lens",
);
assert(
  /costCentresSection\.hidden = !costCentresActive/.test(routeSrc) &&
    /costCentresSection\.style\.display = costCentresActive \? "" : "none"/.test(
      routeSrc,
    ),
  "5. leaving Cost Centres hides prm-cost-centres section",
);

// 6–7 Mapping / Foundation unchanged (still hide shared filters; no cost-centres on those lenses)
assert(
  routeSrc.includes('state.activeLens === "route-family-mapping-review"') &&
    routeSrc.includes('state.activeLens === "route-family-foundation-review"'),
  "6–7. Mapping/Foundation lens branches retained",
);
assert(
  /const showSharedFilters =\s*assignmentsActive \|\| readinessActive \|\| workloadActive/.test(
    routeSrc,
  ),
  "6b. Mapping/Foundation still exclude shared assignment filters",
);

// 9–10 Search / As-of global
assert(
  htmlSrc.includes('id="globalSearchCard"') || htmlSrc.includes("globalSearchCard"),
  "9. Search remains global shell surface",
);
assert(htmlSrc.includes('id="prmAsOfDate"'), "10. As-of remains global");
assert(
  !/data-peq-section="prm-cost-centres"[\s\S]{0,800}?(globalSearch|prmAsOfDate|As-of)/i.test(
    htmlSrc,
  ),
  "9–10b. drawer Cost Centres section does not duplicate Search/As-of",
);

// 11–13 loading / statusArea
assert(
  routeSrc.includes("function clearPrmDormantStatus") &&
    /statusArea[\s\S]{0,120}textContent = ""/.test(routeSrc) &&
    ccSrc.includes("clearPrmDormantStatus"),
  "11. successful render clears dormant statusArea",
);
assert(
  ccSrc.includes("Loading Cost Centres…") && ccSrc.includes("paintLoading"),
  "12. Loading text exists for pending RPC path",
);
assert(
  ccSrc.includes("data-prm-cc-loading-row") &&
    /state\.loading = false/.test(ccSrc),
  "13. pending loading row removed after success path",
);

// 14 Inactivate label
assert(
  /data-prm-cc-inactivate>Inactivate<\/button>/.test(ccSrc) &&
    !ccSrc.includes("Inactivate…"),
  "14. Inactivate visible label exact (no ellipsis)",
);

// 15–16 setup chip + chrome
assert(
  /navigate\("production-cost-centres"\)/.test(routeSrc) &&
    routeSrc.includes("cp-prm-setup-chip") &&
    !ccSrc.includes("cp-prm-setup-chip"),
  "15. single setup chip retained (not duplicated in Cost Centres module)",
);
assert(
  htmlSrc.includes("cp-prm-cost-centres-chrome-active") &&
    ccSrc.includes("Create Cost Centre") &&
    /cp-prm-cc-catalog">\$\{catalogMeta\}<\/span>\s*\$\{createBtn\}/.test(ccSrc) &&
    /cp-prm-cost-centres-toolbar \[data-prm-create-cost-centre\][\s\S]{0,80}margin-left:\s*auto/.test(
      htmlSrc,
    ),
  "16. chip + catalogue meta + Create (right-aligned) chrome",
);
assert(
  /prmChromeRow[\s\S]{0,200}?prmSetupBanner[\s\S]{0,200}?workbenchSummary/.test(
    htmlSrc,
  ) && htmlSrc.includes("cp-prm-chrome-row"),
  "16b. chrome row hosts chip+summary; table remains a sibling below",
);

// 17 counts response-driven
assert(
  /coercePrmList\(catalogs\.sections\)\.length/.test(ccSrc) &&
    !ccSrc.includes("Catalogues: 9 sections") &&
    !ccSrc.includes("86 areas"),
  "17. catalogue counts response-driven (not hardcoded acceptance values)",
);

// 18 narrow wrap
assert(
  /flex-wrap:\s*wrap/.test(htmlSrc) &&
    htmlSrc.includes("cp-prm-cost-centres-toolbar"),
  "18. narrow wrapping safe (flex-wrap)",
);

// 19–20 semantic tokens only in Cost Centres CSS
const ccCss = extractCostCentresCss(htmlSrc);
assert(ccCss.length > 80, "19. Cost Centres CSS blocks present");
assert(
  !/(?:^|[^a-zA-Z-])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.test(
    ccCss,
  ) && !/\brgba?\(/.test(ccCss) && !/\bhsla?\(/.test(ccCss),
  "19–20. Cost Centre CSS semantic-token only (no local colour literals)",
);

// 21 modal spacing
assert(
  htmlSrc.includes(".cp-prm-cost-centre-modal") &&
    (htmlSrc.includes("--sasv-space-2") || htmlSrc.includes("--sasv-space-4")) &&
    ccSrc.includes("cp-prm-cost-centre-modal"),
  "21. Cost Centre modal spacing modestly increased via tokens",
);

// 22 table structure
assert(
  /<th>Code<\/th><th>Cost Centre<\/th>/.test(ccSrc) &&
    !ccSrc.includes("<th>Action") &&
    ccSrc.includes("data-prm-cost-centre-row"),
  "22. table structure unchanged (dense, row click, no Action column)",
);

// 23 lifecycle / RPC
assert(
  ccSrc.includes("rpc_create_production_cost_centre_draft") &&
    ccSrc.includes("rpc_approve_production_cost_centre") &&
    ccSrc.includes("rpc_inactivate_production_cost_centre") &&
    !ccSrc.includes("rpc_preview_production_cost_centre_candidates") &&
    !ccSrc.includes("Create from DWL"),
  "23. lifecycle RPCs unchanged; no historical/DWL create paths",
);

// 24–31 non-mutation / safety
assert(
  !ccSrc.includes("execute_sql") && !routeSrc.includes("rpc_refresh"),
  "24–31. no mutation smoke / Dry Powder / refresh hooks in Cost Centres UX path",
);
assert(
  shellSrc.includes('CURRENT_LENS === "production-cost-centres"') &&
    shellSrc.includes("clearCostCentreFilters"),
  "shell Clear wiring for Cost Centres filters",
);
assert(
  routeSrc.includes("syncDrawerFilters") && ccSrc.includes("wireDrawerFiltersOnce"),
  "drawer filters wired once against existing statusFilter/poolFilter state",
);

assert(
  /body\.sasv-production-route-manager #kpiStripWrap/.test(htmlSrc) &&
    /kpiStripWrap[^>]*hidden/.test(htmlSrc),
  "KPI strip forced hidden on PRM to reclaim vertical space",
);
assert(
  /id="statusArea"[^>]*(hidden|display:\s*none)/.test(htmlSrc) &&
    !/>Loading\.\.\.<\/div>\s*<div\s+id="genericTableMetaRow"/.test(htmlSrc),
  "statusArea starts empty/hidden (no dormant Loading... text)",
);
assert(
  /#costingLoadingMask\.cp-loading-mask\.hidden/.test(htmlSrc) &&
    shellSrc.includes("costingLoadingMask.style.display") &&
    shellSrc.includes("costingLoadingMask.hidden = !visible"),
  "loading mask truly hidden when idle (fixes stray Loading under table)",
);

assert(
  /peq-filter-drawer \.cp-period-select:focus/.test(htmlSrc) &&
    /accent-color:\s*var\(--sasv-action-primary\)/.test(htmlSrc) &&
    !htmlSrc.includes("#eff6ff") &&
    !htmlSrc.includes("rgba(96, 165, 250"),
  "PRM filter selects use sasv-core accent (no legacy blue literals)",
);

// SW — bumped once after smokes pass (Gate 11Y.10I.2C.1C)
assert(
  /CACHE_NAME = "hub-cache-v264"/.test(swSrc),
  "32. SW bumped to hub-cache-v264",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10I.2C.1C Cost Centres UX smokes passed (non-mutating).");
console.log("READY_FOR_11Y_10I_2C_1C_BROWSER_ACCEPTANCE");
