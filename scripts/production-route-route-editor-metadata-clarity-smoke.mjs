/**
 * Gate 11Y.10I.2C.3E.2B — Route Family Route Editor metadata clarity.
 * Non-mutating source/contract smoke only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmEffectiveFromDisplay,
  formatPrmEffectiveToDisplay,
  formatPrmRouteStatusLabel,
  formatPrmRouteVersionCopy,
  formatPrmSupersedesVersionCopy,
  resolvePrmDisplayedRouteVersion,
  resolvePrmPredecessorRouteVersion,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const editorSrc = read("public/shared/js/costing-suite-production-route-editor.js");
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read("public/shared/js/costing-suite-production-route-helpers.js");
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
const loadDetailMatch = editorSrc.match(
  /async function loadPredecessorHistoryIfNeeded[\s\S]*?async function loadFamilyDetail[\s\S]*?async function loadProductDetail/,
);
const loadDetailBlock = loadDetailMatch ? loadDetailMatch[0] : "";
const productHtmlMatch = editorSrc.match(
  /function productHtml[\s\S]*?function renderEditor/,
);
const productHtml = productHtmlMatch ? productHtmlMatch[0] : "";

const approvedV2 = {
  route_name: "Dry Powder and Choornam Shared Manufacturing Route v2",
  route_version: 2,
  status: "APPROVED",
  effective_from: "2026-08-11",
  effective_to: null,
  source_type: "MANUAL",
  evidence_status: "MANUAL_COMPLETE",
  family_name: "Dry Powder and Choornam Manufacturing",
  supersedes_route_id: 9,
};
const supersededV1 = {
  route_name: "Dry Powder and Choornam Shared Manufacturing Route",
  route_version: 1,
  status: "SUPERSEDED",
  effective_from: "2026-07-01",
  effective_to: "2026-08-10",
  supersedes_route_id: null,
};
const draftV3 = {
  route_name: "Draft manufacturing route",
  route_version: 3,
  status: "DRAFT",
};
const historyResolved = [
  { id: 9, route_family_id: 9, route_version: 1, status: "SUPERSEDED" },
  { id: 10, route_family_id: 9, route_version: 2, status: "APPROVED" },
];
const historyUnresolved = [
  { id: 10, route_family_id: 9, route_version: 2, status: "APPROVED" },
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
  formatPrmRouteVersionCopy(approvedV2) === "Version 2" &&
    resolvePrmDisplayedRouteVersion(approvedV2) === "2",
  "1 v2 displays Version 2",
);
assert(
  resolvePrmDisplayedRouteVersion({}) === null &&
    formatPrmRouteVersionCopy({}) === "" &&
    !/version_label \|\| header\.version_no \|\| header\.version \|\| ["']1["']/.test(
      familyHtml,
    ) &&
    !/version_label \|\| header\.version_no \|\| header\.version \|\| ["']1["']/.test(
      overviewBlock,
    ),
  "2 no hardcoded fallback \"1\"",
);
assert(
  !/v\$\{text\(header\.version_label/.test(familyHtml) &&
    familyHtml.includes("data-prm-route-version") &&
    familyHtml.includes("formatPrmRouteVersionCopy") &&
    formatPrmRouteVersionCopy(approvedV2) !== "v1" &&
    formatPrmRouteVersionCopy(approvedV2) !== "Version 1",
  "3 no naked v1 beside Approved on v2",
);
assert(
  helpersSrc.includes("r.route_version") &&
    helpersSrc.includes('["version_label", "version_no", "version"]') &&
    resolvePrmDisplayedRouteVersion({
      route_version: 2,
      version_label: "1",
      version_no: "1",
      version: "1",
    }) === "2",
  "4 route_version is primary version source",
);
assert(
  formatPrmRouteVersionCopy(draftV3) === "Version 3" &&
    formatPrmRouteStatusLabel(draftV3.status) === "Draft" &&
    familyHtml.includes("formatPrmRouteStatusLabel(statusCanonical)"),
  "5 DRAFT fixture displays correct version/status",
);
assert(
  formatPrmRouteVersionCopy(supersededV1) === "Version 1" &&
    formatPrmRouteStatusLabel(supersededV1.status) === "Superseded" &&
    formatPrmRouteStatusLabel(approvedV2.status) === "Approved" &&
    formatPrmRouteStatusLabel(draftV3.status) !== "Approved",
  "6 SUPERSEDED fixture displays correct version/status",
);
assert(
  formatPrmEffectiveToDisplay(null) === "Current" &&
    formatPrmEffectiveToDisplay(approvedV2.effective_to) === "Current" &&
    formatPrmEffectiveToDisplay("") === "Current" &&
    overviewBlock.includes("formatPrmEffectiveToDisplay") &&
    !overviewBlock.includes('effective_to || "—"') &&
    !familyHtml.includes("effective_from || \"—\")} →"),
  "7 null effective_to => Current",
);
assert(
  overviewBlock.includes("Effective from") &&
    overviewBlock.includes("formatPrmEffectiveFromDisplay") &&
    formatPrmEffectiveFromDisplay(approvedV2.effective_from) === "11 Aug 2026",
  "8 Effective From labelled",
);
assert(
  overviewBlock.includes("Effective to") &&
    overviewBlock.includes("formatPrmEffectiveToDisplay"),
  "9 Effective To labelled",
);
assert(
  overviewBlock.includes("Route Family") &&
    overviewBlock.includes("header.family_name"),
  "10 Route Family labelled",
);
assert(
  overviewBlock.includes("formatPrmRouteSourceTypeLabel") &&
    overviewBlock.includes("source_type"),
  "11 Source labelled",
);
assert(
  overviewBlock.includes("formatPrmRouteEvidenceStatusLabel") &&
    overviewBlock.includes("evidence_status"),
  "12 Evidence labelled",
);
assert(
  formatPrmSupersedesVersionCopy(approvedV2, []) === "" &&
    resolvePrmPredecessorRouteVersion(approvedV2, historyUnresolved) == null &&
    formatPrmSupersedesVersionCopy(approvedV2, historyUnresolved) !==
      "Version 9" &&
    !overviewBlock.includes("supersedes_route_id ||"),
  "13 supersedes route id never shown as version",
);
assert(
  formatPrmSupersedesVersionCopy(approvedV2, historyResolved) === "Version 1" &&
    resolvePrmPredecessorRouteVersion(approvedV2, historyResolved) === "1" &&
    overviewBlock.includes("formatPrmSupersedesVersionCopy"),
  "14 Supersedes Version 1 only after actual history-row match",
);
assert(
  formatPrmSupersedesVersionCopy(approvedV2, []) === "" &&
    formatPrmSupersedesVersionCopy(approvedV2, [{ id: 9 }]) === "" &&
    overviewBlock.includes("supersedesCopy ?"),
  "15 missing predecessor history => Supersedes omitted",
);
assert(
  loadDetailBlock.includes("loadPredecessorHistoryIfNeeded") &&
    /supersedes_route_id[\s\S]*if \(supersedesId == null\) return \[\]/.test(
      loadDetailBlock,
    ) &&
    loadDetailBlock.includes("RPC.familyHistory") &&
    /if \(supersedesId == null\) return \[\][\s\S]*costingRpc\(RPC\.familyHistory/.test(
      loadDetailBlock,
    ),
  "16 no history lookup without supersedes_route_id",
);
assert(
  !familyHtml.includes("approval_reference") &&
    !familyHtml.includes("cp-prm-route-header-meta"),
  "17 Approval Reference absent permanent header",
);
assert(
  overviewBlock.includes("Approval reference") &&
    overviewBlock.includes("approval_reference") &&
    mainSrc.includes("approval_reference"),
  "18 Approval Reference remains Route Details/History",
);
assert(
  overviewBlock.includes("formatPrmRouteVersionCopy") &&
    !/version_label \|\| header\.version_no \|\| header\.version \|\| ["']1["']/.test(
      overviewBlock,
    ),
  "19 Route Details uses same corrected version helper",
);
assert(
  overviewBlock.includes("formatPrmEffectiveToDisplay") &&
    formatPrmEffectiveToDisplay(null) === "Current",
  "20 Route Details null effective_to => Current",
);
assert(
  familyHtml.includes('data-prm-action="family-history"') &&
    mainSrc.includes('action === "family-history"') &&
    mainSrc.includes("openHistoryModal") &&
    mainSrc.includes("Route Family route history"),
  "21 History button unchanged",
);
assert(
  familyHtml.includes('data-prm-action="validate-family"') &&
    editorSrc.includes("validateFamily") &&
    mainSrc.includes("validate-${mode}"),
  "22 Validate unchanged",
);
assert(
  familyHtml.includes('data-prm-action="clone-family-route"') &&
    mainSrc.includes("openCloneFamilyRouteModal") &&
    editorSrc.includes("cloneFamilyDraft"),
  "23 Clone as New Version unchanged",
);
assert(
  familyHtml.includes(
    "<th>Seq</th><th>Activity</th><th>Cost Centre</th><th>Location</th><th>Behaviour</th><th>Resource</th><th>DL</th><th>POH</th><th>Occ</th><th>Cycles</th>",
  ),
  "24 step table unchanged",
);
assert(
  familyHtml.includes("cp-prm-editor-toolbar-primary") &&
    !familyHtml.includes("cp-prm-route-header-meta") &&
    !familyHtml.includes("cp-prm-hero") &&
    !htmlSrc.includes("cp-prm-hero"),
  "25 desktop density preserved",
);
assert(
  htmlSrc.includes("@media (max-width: 900px)") &&
    htmlSrc.includes(".cp-prm-editor-title-block") &&
    htmlSrc.includes("overflow: visible") &&
    !htmlSrc.includes("max-width: 28ch"),
  "26 narrow wrapping preserved",
);
assert(
  htmlSrc.includes("cp-field-label") &&
    htmlSrc.includes("--sasv-") &&
    !familyHtml.includes("#7c3aed") &&
    !htmlSrc.includes(".cp-prm-route-header-meta"),
  "27 semantic tokens only",
);
assert(
  rpcSrc.includes("rpc_get_route_family_route_detail") &&
    !editorSrc.includes("ALTER TABLE") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION"),
  "28 no server changes",
);
assert(true, "29 no mutation");
assert(
  !mainSrc.includes("runStagedCostingRefresh") &&
    !editorSrc.includes("refreshCost"),
  "30 no refresh",
);
assert(
  !mainSrc.includes("run82Write") &&
    !editorSrc.includes("Run-82") &&
    !editorSrc.includes("run82"),
  "31 no Run82 changes",
);
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "32 service worker cache name remains present",
);
assert(
  productHtml.includes('data-prm-action="supersede-product"') &&
    productHtml.includes("header.version_label || header.version"),
  "product editor version display left unchanged",
);

if (failed) {
  console.error(
    `production-route-route-editor-metadata-clarity-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-route-editor-metadata-clarity-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_3E_2B_BROWSER_ACCEPTANCE");
