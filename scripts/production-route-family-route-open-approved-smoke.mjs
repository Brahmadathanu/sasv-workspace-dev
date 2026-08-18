/**
 * Gate 11Y.10I.2C.3F.2B.3F.1 — Open existing approved Family Route from editor selection.
 * Client-only navigation smoke. No live route create/clone/mutation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmActionLabel,
  resolvePrmFamilyRouteCreateEligibility,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-family-route-open-approved-smoke.mjs",
);
const handoffSmokeSrc = read(
  "scripts/production-route-family-route-create-handoff-smoke.mjs",
);

const familyEmptyFn =
  editorSrc.match(
    /function familyHtml\([\s\S]*?\n  function productHtml/,
  )?.[0] || "";
const refreshFn =
  mainSrc.match(
    /async function refreshFamilyRouteEmptyContext\([\s\S]*?\n  function buildFamilyRouteEmptyRenderOptions/,
  )?.[0] || "";
const openApprovedHandlerFn =
  mainSrc.match(
    /const openRoute = event\.target\.closest\(\s*\n\s*"\[data-prm-open-existing-family-route\], \[data-prm-open-approved-family-route\]",[\s\S]*?\n        \}\n        const startSuccessor/,
  )?.[0] || "";
const navigateToFamilyFn =
  mainSrc.match(
    /function navigateToFamilyRouteEditor\([\s\S]*?\n  \}\n\n  function actionsHtml/,
  )?.[0] || "";

const importBlock = thisSrc.slice(0, thisSrc.indexOf("const root"));

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const routeFamily10Approved = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: 11,
  draft_family_route_id: null,
  versions: [
    {
      family_route_id: 11,
      status: "APPROVED",
      route_name: "Dry Fine Powder — No-Wash Manufacturing Route",
      version: 1,
    },
  ],
});

const writableState = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: 11,
  draft_family_route_id: 12,
  versions: [
    { family_route_id: 11, status: "APPROVED" },
    { family_route_id: 12, status: "DRAFT" },
  ],
});

const firstDraftState = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: null,
  draft_family_route_id: null,
  versions: [],
});

assert(
  familyEmptyFn.includes("data-prm-family-empty-select") &&
    refreshFn.includes("resolveFamilyRouteCreateContext"),
  "1 Route Family selected resolves context",
);
assert(
  routeFamily10Approved.mode === "approved_successor" &&
    routeFamily10Approved.approvedRouteId === 11,
  "2 approved Family Route resolved",
);
assert(
  familyEmptyFn.includes("data-prm-open-approved-family-route") &&
    familyEmptyFn.includes("Open current approved route") &&
    formatPrmActionLabel("open-approved-family-route") ===
      "Open current approved route",
  "3 Open current approved route visible in empty editor markup",
);
assert(
  refreshFn.includes("approvedRouteId") &&
    refreshFn.includes('data-prm-family-route-id",\n        String(ctx.eligibility.approvedRouteId)'),
  "4 exact approved route id wired from eligibility",
);
assert(
  openApprovedHandlerFn.includes("[data-prm-open-approved-family-route]") &&
    openApprovedHandlerFn.includes("navigateToFamilyRouteEditor({") &&
    !openApprovedHandlerFn.includes("createFamilyDraft") &&
    !openApprovedHandlerFn.includes("cloneFamilyDraft") &&
    !openApprovedHandlerFn.includes("openCreateFamilyRouteDraftModal"),
  "5 click navigates editor without create/clone mutation",
);
assert(
  familyEmptyFn.includes("data-prm-create-family-route-successor") &&
    refreshFn.includes('mode === "approved_successor"') &&
    refreshFn.includes("successorBtn?.classList.remove(\"icon-btn-primary\")"),
  "7 Create new route version remains separate secondary action",
);
assert(
  writableState.mode === "writable_exists" &&
    refreshFn.includes('mode === "writable_exists"') &&
    refreshFn.includes("data-prm-open-existing-family-route") &&
    !refreshFn.includes('openApprovedBtn?.classList.toggle("hidden", !writable)'),
  "8 no duplicate draft when writable route exists",
);
assert(
  firstDraftState.mode === "first_draft" &&
    refreshFn.includes('mode === "first_draft"') &&
    familyEmptyFn.includes("data-prm-create-family-route-draft"),
  "9 first-draft zero-route state unchanged",
);
assert(
  writableState.mode === "writable_exists" &&
    writableState.writableRouteId === 12,
  "10 writable-route open-existing state unchanged",
);
assert(
  mainSrc.includes("buildFamilyRouteEditorNavParams") &&
    mainSrc.includes('applyPrmDeepLinkToUrl("route-family-route-editor"') &&
    navigateToFamilyFn.includes("family_route_id: params.family_route_id") &&
    openApprovedHandlerFn.includes("family_route_id: routeId"),
  "11 deep-link uses family_route_id",
);
assert(
  !rpcSrc.includes("open-approved-family-route") &&
    thisSrc.includes("No server files"),
  "12 no server files",
);
assert(
  !refreshFn.includes("rpc_refresh") &&
    !refreshFn.includes("costing refresh") &&
    thisSrc.includes("No costing refresh"),
  "13 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc) &&
    helpersSrc.includes("open-approved-family-route") &&
    handoffSmokeSrc.includes("openApprovedBtn"),
  "14 SW bump once (after functional smokes)",
);
assert(
  familyEmptyFn.indexOf("openApprovedBtn") <
    familyEmptyFn.indexOf("successorBtn"),
  "6 action hierarchy: open approved before create successor",
);
assert(
  routeFamily10Approved.approvedRouteId === 11 &&
    refreshFn.includes("ctx.eligibility.approvedRouteId"),
  "15 server-resolved id not inferred from label",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-family-route-open-approved-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-route-open-approved-smoke: all passed");
