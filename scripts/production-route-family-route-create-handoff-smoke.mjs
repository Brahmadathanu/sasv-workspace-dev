/**
 * Gate 11Y.10I.2C.3F.2B.2A — Family Route authoring entry & create handoff.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmActionLabel,
  getApplicableRouteFamilyActions,
  isPrmRouteFamilyEligibleForFamilyRouteCreate,
  resolvePrmFamilyRouteCreateEligibility,
  resolveProductionRouteLens,
  selectPrmRouteFamiliesForFamilyRouteCreate,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");

const openCreateFn =
  mainSrc.match(
    /async function openCreateFamilyRouteDraftModal\([\s\S]*?\n  async function openCloneFamilyRouteModal/,
  )?.[0] || "";
const familyEmptyFn =
  editorSrc.match(/function familyHtml\([\s\S]*?\n  function productHtml/)?.[0] ||
  "";
const navigateFn =
  mainSrc.match(/function navigate\(lens[\s\S]*?\n  async function navigateToFamilyRouteEditor/)?.[0] ||
  mainSrc.match(/function navigate\(lens[\s\S]*?\n  function navigateToFamilyRouteEditor/)?.[0] ||
  "";
const loadFamilyEditorFn =
  mainSrc.match(
    /if \(active === "route-family-route-editor"\) \{[\s\S]*?\n    if \(active === "product-route-editor"\)/,
  )?.[0] || "";
const summaryDispatchFn =
  mainSrc.match(
    /if \(action\.includes\("create-family-route"\)[\s\S]*?\n    if \(action === "approve-route-family"/,
  )?.[0] || "";
const bindEditorFn =
  mainSrc.match(/function bindEditor\(host, mode\) \{[\s\S]*?\n  function resolveFamilyRouteApprovalLookupCode/)?.[0] ||
  "";
const refreshEmptyFn =
  mainSrc.match(
    /async function refreshFamilyRouteEmptyContext\([\s\S]*?\n  function buildFamilyRouteEmptyRenderOptions/,
  )?.[0] || "";
const buildCreateArgsFn =
  rpcSrc.match(
    /export function buildCreateRouteFamilyRouteDraftArgs\([\s\S]*?\nexport function/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const noFamilyRouteRow = {
  route_family_id: 42,
  route_family_code: "DRY_FINE_POWDER_NO_WASH",
  route_family_name: "Dry Fine Powder — No-Wash",
  status: "APPROVED",
  draft_family_route_id: null,
  approved_family_route_id: null,
};
const createFamilyAction = getApplicableRouteFamilyActions(noFamilyRouteRow).find(
  (action) => action.id === "create-family-route",
);
const approvedFamilyRow = {
  route_family_id: 7,
  status: "APPROVED",
  draft_family_route_id: null,
  approved_family_route_id: 99,
};
const createVersionAction = getApplicableRouteFamilyActions(approvedFamilyRow).find(
  (action) => action.id === "create-family-version",
);
const writableRow = {
  route_family_id: 8,
  status: "APPROVED",
  draft_family_route_id: 501,
  approved_family_route_id: null,
};
const openFamilyAction = getApplicableRouteFamilyActions(writableRow).find(
  (action) => action.id === "open-family-route",
);

const eligibleFamilies = selectPrmRouteFamiliesForFamilyRouteCreate(
  [
    {
      route_family_id: 1,
      route_family_code: "APPROVED_OK",
      status: "APPROVED",
      effective_from: "2020-01-01",
      effective_to: null,
    },
    {
      route_family_id: 2,
      route_family_code: "DRAFT_ONLY",
      status: "DRAFT",
    },
    {
      route_family_id: 3,
      route_family_code: "ARCHIVED",
      status: "APPROVED",
      archived_at: "2026-01-01",
    },
  ],
  "2026-08-13",
);

const firstDraftEligibility = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: null,
  draft_family_route_id: null,
  versions: [],
});
const writableEligibility = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: null,
  draft_family_route_id: 501,
  versions: [{ family_route_id: 501, status: "DRAFT" }],
});
const successorEligibility = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: 99,
  draft_family_route_id: null,
  versions: [{ family_route_id: 99, status: "APPROVED", route_name: "Approved v1" }],
});

assert(
  familyEmptyFn.includes("data-prm-create-family-route-draft") &&
    familyEmptyFn.includes("Create Family Route Draft"),
  "1 editor empty state exposes Create Family Route Draft",
);
assert(
  bindEditorFn.includes("if (!canEdit())") &&
    bindEditorFn.includes('showToast?.("Edit permission required."') &&
    familyEmptyFn.includes("canCreateFamilyRoute"),
  "2 create action edit-permission gated",
);
assert(
  !bindEditorFn.includes("editor.createFamilyDraft") &&
    !familyEmptyFn.includes("editor.createFamilyDraft") &&
    openCreateFn.includes("editor.createFamilyDraft"),
  "3 empty-state click does not mutate until explicit submit",
);
assert(
  openCreateFn.includes('title: "Create Family Route Draft"') &&
    openCreateFn.includes("openModal("),
  "4 create surface opens via canonical modal helper",
);
assert(
  openCreateFn.includes("enhanceSearchableSelect") &&
    openCreateFn.includes("#prmFamilyRouteFamilySelect") &&
    familyEmptyFn.includes("data-prm-family-empty-select"),
  "5 searchable Route Family selector when context absent",
);
assert(
  helpersSrc.includes("isPrmRouteFamilyApprovedForGovernance") &&
    helpersSrc.includes("isPrmRouteFamilyArchived") &&
    helpersSrc.includes("isPrmRouteFamilyEffectiveForAsOf") &&
    eligibleFamilies.length === 1 &&
    eligibleFamilies[0].route_family_id === 1 &&
    isPrmRouteFamilyEligibleForFamilyRouteCreate(
      { status: "DRAFT" },
      "2026-08-13",
    ) === false,
  "6 approved/non-archived/effective Family filter from master-options contract",
);
assert(
  !helpersSrc.includes("isPrmRouteFamilyValidForCreate") &&
    !mainSrc.includes("clientOnlyValidRouteFamily") &&
    helpersSrc.includes("isPrmRouteFamilyEligibleForFamilyRouteCreate"),
  "7 no invented client-only validity rule",
);
assert(
  summaryDispatchFn.includes("openCreateFamilyRouteDraftModal({") &&
    bindEditorFn.includes("openCreateFamilyRouteDraftModal({"),
  "8 Summary and editor entries reuse same helper",
);
assert(
  !helpersSrc.includes("Create Route Family route draft") &&
    formatPrmActionLabel("create-family-route") === "Create Family Route Draft",
  "9 old awkward label removed",
);
assert(
  summaryDispatchFn.includes("routeFamilyId,") &&
    openCreateFn.includes("familyLocked = lockedFamilyId != null") &&
    openCreateFn.includes("readonly: true"),
  "10 Summary launch preselects/locks Route Family context",
);
assert(
  firstDraftEligibility.mode === "first_draft" &&
    firstDraftEligibility.approvedRouteLabel === "None" &&
    mainSrc.includes("Current approved Family Route"),
  "11 first-Draft case shows no approved route",
);
assert(
  openCreateFn.includes("data-prm-family-route-draft-submit") &&
    openCreateFn.includes("Create DRAFT") &&
    !openCreateFn.includes("editor.createFamilyDraft(") ||
    openCreateFn.indexOf("editor.createFamilyDraft(") >
      openCreateFn.indexOf("data-prm-family-route-draft-submit"),
  "12 explicit Create DRAFT submit only invokes RPC",
);
assert(
  buildCreateArgsFn.includes('"rpc_create_route_family_route_draft"') &&
    openCreateFn.includes("editor.createFamilyDraft"),
  "13 correct existing create RPC via editor.createFamilyDraft",
);
assert(
  (mainSrc.match(/rpc_create_route_family_route_draft/g) || []).length <= 2 &&
    !mainSrc.includes("rpc_create_family_route_draft") &&
    !mainSrc.includes("rpc_create_route_family_draft"),
  "14 no second create RPC invented in controller",
);
assert(
  !buildCreateArgsFn.includes("p_route_code") &&
    !openCreateFn.includes("Route code") &&
    !familyEmptyFn.includes("route_code"),
  "15 no typed route-code contract invented",
);
assert(
  writableEligibility.mode === "writable_exists" &&
    openCreateFn.includes('ctx.eligibility.mode === "writable_exists"') &&
    openCreateFn.includes("return { ok: false, reason: \"writable_exists\" }"),
  "16 writable existing route blocks duplicate Draft UX",
);
assert(
  openCreateFn.includes("data-prm-family-create-open-existing") &&
    bindEditorFn.includes("data-prm-open-existing-family-route") &&
    bindEditorFn.includes("navigateToFamilyRouteEditor({"),
  "17 writable existing route opens exact route",
);
assert(
  successorEligibility.mode === "approved_successor" &&
    openCreateFn.includes("data-prm-family-create-successor-start") &&
    openCreateFn.includes("Create new route version") &&
    familyEmptyFn.includes("data-prm-open-approved-family-route") &&
    refreshEmptyFn.includes("openApprovedBtn"),
  "18 approved existing route shows open-approved and explicit successor context",
);
assert(
  openCreateFn.includes("supersedes_route_id: useSuccessor ? modalApprovedRouteId : null") &&
    openCreateFn.includes("approved_successor_required") &&
    !openCreateFn.includes("supersedes_route_id: ctx.eligibility.approvedRouteId"),
  "19 no silent supersede on first-Draft path",
);
assert(
  openCreateFn.includes("supersedes_route_id: useSuccessor ? modalApprovedRouteId : null") &&
    summaryDispatchFn.includes("create-family-version")
      ? summaryDispatchFn.includes("supersedesRouteId:")
      : true,
  "20 first Draft keeps supersedes_route_id null unless successor mode",
);
assert(
  openCreateFn.includes("result.family_route_id") &&
    openCreateFn.includes("await openCreatedFamilyRoute({"),
  "21 post-create uses returned family_route_id",
);
assert(
  openCreateFn.includes("await openCreatedFamilyRoute({") &&
    navigateFn.includes('"route-family-route-editor"') &&
    !openCreateFn.includes('navigate("route-families"'),
  "22 stays in Route Family Route Editor after create",
);
assert(
  helpersSrc.includes("buildFamilyRouteEditorNavParams") &&
    helpersSrc.includes("family_route_id: familyRouteId") &&
    htmlSrc.includes("route-family-route-editor"),
  "23 exact family_route_id deep-link contract preserved",
);
assert(
  navigateFn.includes("allowFamilyEditorWithoutId") &&
    resolveProductionRouteLens("route-family-route-editor", {
      allowEditorWithoutId: true,
    }) === "route-family-route-editor" &&
    resolveProductionRouteLens("route-family-route-editor", {
      allowEditorWithoutId: false,
    }) !== "route-family-route-editor",
  "24 empty/create editor no longer falls back to Readiness",
);
assert(
  loadFamilyEditorFn.includes("route_family_id") &&
    mainSrc.includes("applyPrmDeepLinkToUrl(\"route-family-route-editor\"") &&
    mainSrc.includes("refreshFamilyRouteEmptyContext"),
  "25 refresh/back keeps route_family_id and empty context sane",
);
assert(
  bindEditorFn.includes('action === "clone-family-route"') &&
    bindEditorFn.includes('action === `validate-${mode}`') &&
    bindEditorFn.includes('action === `submit-${mode}`') &&
    createVersionAction?.id === "create-family-version" &&
    openFamilyAction?.id === "open-family-route",
  "26 existing lifecycle actions unchanged",
);
assert(
  createFamilyAction?.mutation === true &&
    (openCreateFn.indexOf("await editor.createFamilyDraft") === -1 ||
      openCreateFn.indexOf("await editor.createFamilyDraft") >
        openCreateFn.indexOf("data-prm-family-route-draft-submit")),
  "27 no live Family Route creation in smoke runner",
);
assert(
  !mainSrc.includes("apply_migration") &&
    !mainSrc.includes("create table") &&
    !rpcSrc.includes("rpc_create_route_family_route_draft_v2"),
  "28 no server schema/RPC change in client layer",
);
assert(
  !openCreateFn.includes("rpc_refresh") &&
    !mainSrc.includes("costingRefresh") &&
    !loadFamilyEditorFn.includes("rpc_refresh"),
  "29 no costing refresh wired into create handoff",
);

assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc),
  "SW bumped exactly once to hub-cache-v307",
);

if (failed) {
  console.error(
    `\nproduction-route-family-route-create-handoff-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-route-create-handoff-smoke: all passed");
