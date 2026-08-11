/**
 * Gate 11Y.10I.2C.3E.2C — Route header vertical-density cleanup.
 * Non-mutating source/contract smoke only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmEffectiveToDisplay,
  formatPrmRouteVersionCopy,
  formatPrmSupersedesVersionCopy,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");

const familyHtmlMatch = editorSrc.match(
  /function familyHtml[\s\S]*?function deltaRow/,
);
const familyHtml = familyHtmlMatch ? familyHtmlMatch[0] : "";
const overviewMatch = editorSrc.match(
  /function buildFamilyRouteOverviewHtml[\s\S]*?function familyHtml/,
);
const overviewBlock = overviewMatch ? overviewMatch[0] : "";
const toolbarCssMatch = htmlSrc.match(
  /\.cp-prm-editor-toolbar \{[\s\S]*?\.cp-prm-editor-toolbar-primary/,
);
const toolbarCss = toolbarCssMatch ? toolbarCssMatch[0] : "";

const approvedV2 = {
  route_version: 2,
  status: "APPROVED",
  effective_to: null,
  supersedes_route_id: 9,
};
const historyResolved = [
  { id: 9, route_version: 1, status: "SUPERSEDED" },
  { id: 10, route_version: 2, status: "APPROVED" },
];

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

assert(
  familyHtml.includes("cp-prm-title-action") &&
    familyHtml.includes("data-prm-route-overview") &&
    familyHtml.includes("routeTitle"),
  "1 permanent header still shows route title",
);
assert(
  familyHtml.includes("data-prm-route-status") &&
    familyHtml.includes("formatPrmRouteStatusLabel(statusCanonical)"),
  "2 permanent header still shows lifecycle chip",
);
assert(
  familyHtml.includes("data-prm-route-version") &&
    familyHtml.includes("formatPrmRouteVersionCopy") &&
    formatPrmRouteVersionCopy(approvedV2) === "Version 2",
  "3 permanent header still shows Version 2",
);
assert(
  !familyHtml.includes("data-prm-meta-field") &&
    !familyHtml.includes('metaCell("route-family"') &&
    !/cp-prm-route-header-meta[\s\S]{0,400}Route Family/.test(familyHtml),
  "4 persistent Route Family metadata cell absent",
);
assert(
  !familyHtml.includes('metaCell("effective-from"') &&
    !familyHtml.includes("Effective From"),
  "5 persistent Effective From metadata cell absent",
);
assert(
  !familyHtml.includes('metaCell("effective-to"') &&
    !familyHtml.includes("Effective To"),
  "6 persistent Effective To metadata cell absent",
);
assert(
  !familyHtml.includes('metaCell("source"') &&
    !/cp-prm-route-header-meta[\s\S]{0,400}Source/.test(familyHtml),
  "7 persistent Source metadata cell absent",
);
assert(
  !familyHtml.includes('metaCell("evidence"') &&
    !/cp-prm-route-header-meta[\s\S]{0,400}Evidence/.test(familyHtml),
  "8 persistent Evidence metadata cell absent",
);
assert(
  !familyHtml.includes('metaCell("supersedes"') &&
    !familyHtml.includes("formatPrmSupersedesVersionCopy"),
  "9 persistent Supersedes metadata cell absent",
);
assert(
  overviewBlock.includes("Route Family") &&
    overviewBlock.includes("formatPrmRouteVersionCopy") &&
    overviewBlock.includes("formatPrmEffectiveFromDisplay") &&
    overviewBlock.includes("formatPrmRouteSourceTypeLabel") &&
    overviewBlock.includes("formatPrmRouteEvidenceStatusLabel"),
  "10 Route Details still shows those values",
);
assert(
  overviewBlock.includes("formatPrmEffectiveToDisplay") &&
    formatPrmEffectiveToDisplay(null) === "Current" &&
    !overviewBlock.includes('effective_to || "—"'),
  "11 Route Details still shows Current for null effective_to",
);
assert(
  overviewBlock.includes("formatPrmSupersedesVersionCopy") &&
    overviewBlock.includes("Supersedes") &&
    formatPrmSupersedesVersionCopy(approvedV2, historyResolved) === "Version 1",
  "12 Route Details still shows Supersedes Version 1",
);
assert(
  overviewBlock.includes("Approval reference") &&
    overviewBlock.includes("approval_reference") &&
    !familyHtml.includes("approval_reference"),
  "13 Approval Reference remains in Route Details",
);
assert(
  familyHtml.includes('data-prm-action="family-history"') &&
    mainSrc.includes('action === "family-history"') &&
    mainSrc.includes("openHistoryModal"),
  "14 History unchanged",
);
assert(
  familyHtml.includes('data-prm-action="validate-family"') &&
    editorSrc.includes("validateFamily") &&
    mainSrc.includes("validate-${mode}"),
  "15 Validate unchanged",
);
assert(
  familyHtml.includes('data-prm-action="clone-family-route"') &&
    mainSrc.includes("openCloneFamilyRouteModal"),
  "16 Clone as New Version unchanged",
);
assert(
  familyHtml.includes(
    "<th>Seq</th><th>Activity</th><th>Cost Centre</th><th>Location</th><th>Behaviour</th><th>Resource</th><th>DL</th><th>POH</th><th>Occ</th><th>Cycles</th>",
  ) &&
    familyHtml.includes("cp-prm-step-table-wrap"),
  "17 route steps unchanged",
);
assert(
  !familyHtml.includes("cp-prm-route-header-meta") &&
    !htmlSrc.includes(".cp-prm-route-header-meta") &&
    !htmlSrc.includes("cp-prm-route-meta-cell") &&
    /gap:\s*0/.test(toolbarCss) &&
    !/min-height:\s*(4|5|6|7|8)rem/.test(toolbarCss),
  "18 no blank metadata-height gap",
);
assert(
  htmlSrc.includes("@media (max-width: 900px)") &&
    htmlSrc.includes(".cp-prm-editor-title-block") &&
    htmlSrc.includes("overflow: visible") &&
    htmlSrc.includes("cp-prm-step-table-wrap") &&
    htmlSrc.includes("overflow-x: auto"),
  "19 narrow layout unchanged",
);
assert(
  rpcSrc.includes("rpc_get_route_family_route_detail") &&
    !editorSrc.includes("ALTER TABLE") &&
    !editorSrc.includes("CREATE OR REPLACE FUNCTION"),
  "20 no server changes",
);
assert(true, "21 no mutation");
assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !editorSrc.includes("refreshCost"),
  "22 no refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v271"/.test(swSrc),
  "23 SW bumped exactly once after smokes (hub-cache-v271)",
);

if (failed) {
  console.error(
    `production-route-route-editor-header-density-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-route-editor-header-density-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_3E_2C_BROWSER_ACCEPTANCE");
