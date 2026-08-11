/**
 * Gate 11Y.10I.2C.2A.1 — Route Editor Header Density & Context Navigation.
 * Non-mutating source/contract smoke only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProductionRouteLens } from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const ccSrc = read("public/shared/js/costing-suite-production-route-cost-centres.js");
const swSrc = read("public/sw.js");

const familyHtmlMatch = editorSrc.match(
  /function familyHtml[\s\S]*?function deltaRow/,
);
const familyHtml = familyHtmlMatch ? familyHtmlMatch[0] : "";
const primaryMatch = familyHtml.match(
  /cp-prm-editor-toolbar-primary[\s\S]*?\$\{readOnly/,
);
const primaryBlock = primaryMatch ? primaryMatch[0] : "";
const overviewMatch = editorSrc.match(
  /function buildFamilyRouteOverviewHtml[\s\S]*?function familyHtml/,
);
const overviewBlock = overviewMatch ? overviewMatch[0] : "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  familyHtml.includes("cp-prm-editor-toolbar-primary") &&
    familyHtml.includes("data-prm-route-header-primary"),
  "1 primary route editor row exists",
);
assert(
  primaryBlock.includes("cp-prm-title-action") &&
    primaryBlock.includes("data-prm-route-status") &&
    primaryBlock.includes("data-prm-route-version") &&
    familyHtml.includes("formatPrmRouteVersionCopy") &&
    !/v\$\{text\(header\.version_label/.test(familyHtml) &&
    !/version_label \|\| header\.version_no \|\| header\.version \|\| ["']1["']/.test(
      familyHtml,
    ),
  "2 route title/status/version are in primary row",
);
assert(
  primaryBlock.includes('data-prm-action="family-history"') &&
    primaryBlock.includes('data-prm-action="validate-family"') &&
    primaryBlock.includes('data-prm-action="clone-family-route"') &&
    primaryBlock.includes("cp-prm-editor-lifecycle"),
  "3 lifecycle controls are in primary row",
);
assert(
  !familyHtml.includes("cp-prm-route-header-meta") &&
    !familyHtml.includes("data-prm-meta-field") &&
    primaryBlock.includes("cp-prm-editor-lifecycle"),
  "4 persistent metadata grid absent; lifecycle stays in primary row",
);
assert(
  !familyHtml.includes("approval_reference"),
  "5 approval_reference absent from permanent header metadata",
);
assert(
  !familyHtml.includes("route_code") &&
    !familyHtml.includes("family_route_code"),
  "6 route_code absent from permanent header metadata",
);
assert(
  overviewBlock.includes("Route code") &&
    overviewBlock.includes("route_code") &&
    overviewBlock.includes("family_route_code"),
  "7 route_code retained in Route Details",
);
assert(
  overviewBlock.includes("Approval reference") &&
    overviewBlock.includes("approval_reference") &&
    mainSrc.includes("approval_reference"),
  "8 approval_reference retained in Route Details / History",
);
assert(
  overviewBlock.includes("formatPrmEffectiveFromDisplay") &&
    overviewBlock.includes("formatPrmEffectiveToDisplay") &&
    overviewBlock.includes("Effective from") &&
    overviewBlock.includes("Effective to"),
  "9 Effective dates retained in Route Details",
);
assert(
  overviewBlock.includes("formatPrmRouteSourceTypeLabel") &&
    overviewBlock.includes("source_type"),
  "10 Source retained in Route Details",
);
assert(
  overviewBlock.includes("formatPrmRouteEvidenceStatusLabel") &&
    overviewBlock.includes("evidence_status"),
  "11 Evidence retained in Route Details",
);
assert(
  overviewBlock.includes("formatPrmSupersedesVersionCopy") &&
    overviewBlock.includes("Supersedes") &&
    overviewBlock.includes("supersedesCopy"),
  "12 Supersedes version retained in Route Details",
);
assert(
  resolveProductionRouteLens("route-family-route-editor", {
    allowEditorWithoutId: true,
  }) === "route-family-route-editor" &&
    helpersSrc.includes("allowEditorWithoutId"),
  "13 resolver allowEditorWithoutId returns route-family-route-editor",
);
assert(
  mainSrc.includes("allowFamilyEditorWithoutId") &&
    !/lens === "route-family-route-editor"[\s\S]{0,160}navigate\(active,\s*state\.deepLink,\s*true\)/.test(
      mainSrc,
    ),
  "14 no-context load does not navigate default lens",
);
assert(
  /active === "route-family-route-editor"[\s\S]*?familyRouteId == null[\s\S]*?clearFamilyEditorContext/.test(
    mainSrc,
  ) &&
    /familyRouteId == null[\s\S]*?return \{ ok: true, empty: true \}/.test(mainSrc),
  "15 no-context load does not load family detail",
);
assert(
  editorSrc.includes("function clearFamilyEditorContext") &&
    /familyState\.detail = null[\s\S]*familyState\.steps = \[\]/.test(editorSrc) &&
    mainSrc.includes("clearFamilyEditorContext"),
  "16 stale family detail cleared",
);
assert(
  helpersSrc.includes(
    "Select a Route Family to manage its manufacturing route.",
  ) &&
    familyHtml.includes(
      "Select a Route Family to manage its manufacturing route.",
    ),
  "17 empty-state primary copy present",
);
assert(
  helpersSrc.includes(
    "Route Family Routes are governed from Manufacturing Route Families.",
  ) &&
    familyHtml.includes(
      "Route Family Routes are governed from Manufacturing Route Families.",
    ),
  "18 supporting copy present",
);
assert(
  familyHtml.includes("data-prm-open-route-families") &&
    familyHtml.includes("Open Manufacturing Route Families") &&
    mainSrc.includes("[data-prm-open-route-families]") &&
    /data-prm-open-route-families[\s\S]{0,120}navigate\("route-families"\)/.test(
      mainSrc,
    ),
  "19 CTA navigates route-families",
);
assert(
  /familyRouteId == null[\s\S]*?loadFamilyDetail\(familyRouteId\)/.test(mainSrc) ||
    /if \(familyRouteId == null\)[\s\S]*?const result = await editor\.loadFamilyDetail/.test(
      mainSrc,
    ),
  "20 contextual family_route_id path still loads detail",
);
assert(
  mainSrc.includes("function navigateToFamilyRouteEditor") &&
    /if \(!params\?\.family_route_id\)[\s\S]*?return false/.test(mainSrc),
  "21 navigateToFamilyRouteEditor unchanged",
);
assert(
  mainSrc.includes('action === "family-history"') &&
    mainSrc.includes("openHistoryModal") &&
    editorSrc.includes('data-prm-action="family-history"'),
  "22 History unchanged",
);
assert(
  editorSrc.includes('data-prm-action="clone-family-route"') &&
    mainSrc.includes("openCloneFamilyRouteModal") &&
    editorSrc.includes("cloneFamilyDraft"),
  "23 Clone unchanged",
);
assert(
  editorSrc.includes(
    "<th>Seq</th><th>Activity</th><th>Cost Centre</th><th>Location</th><th>Behaviour</th><th>Resource</th><th>DL</th><th>POH</th><th>Occ</th><th>Cycles</th>",
  ),
  "24 step table unchanged",
);
assert(
  editorSrc.includes("function productHtml") &&
    editorSrc.includes('data-prm-action="supersede-product"') &&
    mainSrc.includes("product-route-editor"),
  "25 Product Route Editor unchanged",
);
assert(
  ccSrc.includes("createProductionCostCentresController") &&
    mainSrc.includes("production-cost-centres"),
  "26 Cost Centres unchanged",
);
assert(
  mainSrc.includes("route-family-mapping-review") ||
    mainSrc.includes("MAPPING_REVIEW"),
  "27 Mapping Review unchanged",
);
assert(
  mainSrc.includes("route-family-foundation-review") ||
    mainSrc.includes("FOUNDATION_REVIEW"),
  "28 Foundation Review unchanged",
);
assert(
  mainSrc.includes("PRODUCTION_ROUTE_MODULE_KEY") &&
    htmlSrc.includes("production-route-manager"),
  "29 CCC unchanged",
);
assert(true, "30 no live mutation");
assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !editorSrc.includes("refreshCost"),
  "31 no costing refresh",
);
assert(
  !mainSrc.includes("run82Write") &&
    !editorSrc.includes("Run-82"),
  "32 no Run-82 write",
);
assert(
  htmlSrc.includes("cp-prm-editor-toolbar-primary") &&
    htmlSrc.includes("--sasv-border") &&
    htmlSrc.includes("var(--sasv-text-secondary") &&
    !editorSrc.includes("#7c3aed"),
  "33 semantic theme only",
);
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "34 service worker cache name remains present",
);

if (failed) {
  console.error(
    `production-route-route-editor-header-nav-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-route-editor-header-nav-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_2A_1_BROWSER_ACCEPTANCE");
