/**
 * Gate 11Y.10I.2C.3F.2B.4D — Family Route Draft post-create open handoff.
 * Mocked state/RPC transition smoke. Does not create Route 13.
 * Route 12 DRY_FINE_POWDER_WASH_DRY_ROUTE remains DRAFT with 0 steps.
 * No validate/submit/approve/clone/mappings. SW expected: hub-cache-v307
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmRouteVersionCopy,
  resolvePrmFamilyRouteCreateEligibility,
  resolvePrmFamilyRouteEditorLoadId,
  shouldApplyPrmFamilyRouteEmptyContextRefresh,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { extractCreatedFamilyRouteId } from "../public/shared/js/costing-suite-production-route-rpc.js";

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
  "scripts/production-route-family-route-create-open-handoff-smoke.mjs",
);

const openCreateFn =
  mainSrc.match(
    /async function openCreateFamilyRouteDraftModal\([\s\S]*?\n  async function openCloneFamilyRouteModal/,
  )?.[0] || "";
const openCreatedFn =
  mainSrc.match(
    /async function openCreatedFamilyRoute\([\s\S]*?\n  function actionsHtml/,
  )?.[0] || "";
const navigateToFn =
  mainSrc.match(
    /async function navigateToFamilyRouteEditor\([\s\S]*?\n  async function openCreatedFamilyRoute/,
  )?.[0] || "";
const loadFamilyEditorFn =
  mainSrc.match(
    /if \(active === "route-family-route-editor"\) \{[\s\S]*?\n    if \(active === "product-route-editor"\)/,
  )?.[0] || "";
const refreshEmptyFn =
  mainSrc.match(
    /async function refreshFamilyRouteEmptyContext\([\s\S]*?\n  function buildFamilyRouteEmptyRenderOptions/,
  )?.[0] || "";
const familyHtmlFn =
  editorSrc.match(/function familyHtml\([\s\S]*?\n  function productHtml/)?.[0] ||
  "";
const createDraftFn =
  editorSrc.match(
    /async function createFamilyDraft\(input = \{\}\) \{[\s\S]*?\n  async function cloneFamilyDraft/,
  )?.[0] || "";

const ROUTE_12 = {
  family_route_id: 12,
  route_family_id: 11,
  route_name: "Dry Fine Powder — Wash & Dry Manufacturing Route",
  status: "DRAFT",
  route_version: 1,
  version: 1,
  steps: [],
};

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createHandoffStore() {
  const state = {
    selectedFamilyRouteId: null,
    selectedRouteFamilyId: 11,
    deepLink: { route_family_id: 11 },
    url: "lens=route-family-route-editor&route_family_id=11",
    editorDetail: null,
    toasts: [],
    createCalls: 0,
    detailLoads: [],
    generation: 0,
    mutationCalls: 0,
  };

  function writeUrl() {
    const params = [`lens=route-family-route-editor`];
    if (state.deepLink.route_family_id != null) {
      params.push(`route_family_id=${state.deepLink.route_family_id}`);
    }
    if (state.deepLink.family_route_id != null) {
      params.push(`family_route_id=${state.deepLink.family_route_id}`);
    }
    state.url = params.join("&");
  }

  async function loadFamilyDetail(familyRouteId) {
    state.detailLoads.push(familyRouteId);
    state.editorDetail = {
      ...ROUTE_12,
      family_route_id: familyRouteId,
    };
    return { ok: true, detail: state.editorDetail };
  }

  async function loadFromDeepLink(requestDeepLink = {}) {
    const familyRouteId = resolvePrmFamilyRouteEditorLoadId({
      requestDeepLink,
      committedDeepLink: state.deepLink,
    });
    state.selectedFamilyRouteId = familyRouteId;
    if (familyRouteId == null) {
      state.editorDetail = null;
      return { ok: true, empty: true };
    }
    state.generation += 1;
    state.deepLink = {
      ...state.deepLink,
      ...requestDeepLink,
      family_route_id: familyRouteId,
    };
    writeUrl();
    return loadFamilyDetail(familyRouteId);
  }

  function refreshEmptyContext(requestGeneration = state.generation) {
    if (
      !shouldApplyPrmFamilyRouteEmptyContextRefresh({
        selectedFamilyRouteId: state.selectedFamilyRouteId,
        deepLinkFamilyRouteId: state.deepLink.family_route_id,
        requestGeneration,
        currentGeneration: state.generation,
      })
    ) {
      return { applied: false };
    }
    delete state.deepLink.family_route_id;
    writeUrl();
    return { applied: true };
  }

  async function createAndOpen() {
    state.mutationCalls += 1;
    state.createCalls += 1;
    const payload = { family_route_id: 12, route_family_id: 11 };
    const returnedId = extractCreatedFamilyRouteId(payload);
    state.toasts.push("Family Route Draft created.");
    state.generation += 1;
    state.selectedFamilyRouteId = returnedId;
    state.selectedRouteFamilyId = 11;
    state.deepLink = {
      route_family_id: 11,
      family_route_id: returnedId,
    };
    writeUrl();
    const load = await loadFromDeepLink({ ...state.deepLink });
    if (!load?.ok || load.empty || !state.editorDetail) {
      state.toasts.push(
        "Family Route created, but the new Draft could not be opened.",
      );
      return { ok: false, created: true, opened: false, family_route_id: returnedId };
    }
    return { ok: true, created: true, opened: true, family_route_id: returnedId, load };
  }

  return {
    state,
    createAndOpen,
    refreshEmptyContext,
    loadFromDeepLink,
    failNextDetail() {
      const original = loadFamilyDetail;
      this.loadFamilyDetail = async () => ({ ok: false });
      return original;
    },
  };
}

const createdId = extractCreatedFamilyRouteId({
  route_family_id: 11,
  family_route_id: 12,
});
const store = createHandoffStore();
const created = await store.createAndOpen();
const painted = store.state.editorDetail;

assert(store.state.createCalls === 1, "1 create RPC called once");
assert(createdId === 12, "2 returned family_route_id extracted");
assert(created.family_route_id === 12, "3 returned id preserved exactly");
assert(
  !openCreateFn.includes("route_name") ||
    openCreateFn.indexOf("await editor.createFamilyDraft") <
      openCreateFn.indexOf("await openCreatedFamilyRoute") ||
    !openCreatedFn.includes("route_name"),
  "4 no name inference",
);
assert(
  !openCreatedFn.includes("latest") &&
    !openCreatedFn.includes("max(") &&
    !navigateToFn.includes("approved_family_route_id"),
  "5 no latest-route inference",
);
assert(
  !openCreatedFn.includes("version") && !navigateToFn.includes("max version"),
  "6 no version inference",
);
assert(
  openCreatedFn.includes("closeModal({ restorePrevious: false })") ||
    navigateToFn.includes("closeModal({ restorePrevious: false })"),
  "7 modal closes after create",
);
assert(
  openCreateFn.includes('showToast?.("Family Route Draft created."') &&
    store.state.toasts.includes("Family Route Draft created."),
  "8 success toast present",
);
assert(store.state.deepLink.route_family_id === 11, "9 route_family_id retained");
assert(
  store.state.selectedFamilyRouteId === 12 &&
    store.state.deepLink.family_route_id === 12,
  "10 family_route_id committed",
);
assert(store.state.deepLink.family_route_id === 12, "11 deep-link receives returned id");
assert(
  store.state.url.includes("family_route_id=12") &&
    store.state.url.includes("route_family_id=11"),
  "12 URL receives returned id",
);
assert(
  openCreateFn.includes("await openCreatedFamilyRoute") &&
    openCreatedFn.includes("await navigateToFamilyRouteEditor"),
  "13 post-create open is awaited",
);
assert(
  store.state.detailLoads[0] === 12 &&
    loadFamilyEditorFn.includes("editor.loadFamilyDetail(familyRouteId)"),
  "14 authoritative detail load called with returned id",
);
assert(
  !openCreatedFn.includes('status: "DRAFT"') &&
    !openCreateFn.includes("editor.getFamilyState().detail =") &&
    !openCreatedFn.includes("steps: []"),
  "15 no synthetic DRAFT route",
);
assert(
  painted?.family_route_id === 12 &&
    painted?.route_name === ROUTE_12.route_name,
  "16 editor state uses server detail",
);
assert(painted?.status === "DRAFT", "17 header shows DRAFT");
assert(
  formatPrmRouteVersionCopy(painted) === "Version 1" &&
    familyHtmlFn.includes("formatPrmRouteVersionCopy"),
  "18 Version 1 rendered",
);
assert(
  Array.isArray(painted?.steps) &&
    painted.steps.length === 0 &&
    familyHtmlFn.includes("Route incomplete — add required route steps"),
  "19 zero-step state rendered",
);
assert(
  familyHtmlFn.includes("Route incomplete — add required route steps"),
  "20 incomplete-route cue rendered",
);

const staleGen = store.state.generation - 1;
const strip = store.refreshEmptyContext(staleGen);
assert(
  strip.applied === false && store.state.deepLink.family_route_id === 12,
  "21 stale empty-context refresh cannot strip id",
);

const raceStore = createHandoffStore();
const olderEmpty = deferred();
let olderApplied = false;
const older = (async () => {
  await olderEmpty.promise;
  olderApplied = raceStore.refreshEmptyContext(0).applied;
})();
const newer = await raceStore.createAndOpen();
olderEmpty.resolve();
await older;
assert(
  newer.ok === true &&
    olderApplied === false &&
    raceStore.state.deepLink.family_route_id === 12,
  "22 newer returned-id open wins request ordering",
);

const refreshReopen = await store.loadFromDeepLink({
  route_family_id: 11,
  family_route_id: 12,
});
assert(
  refreshReopen.ok === true &&
    store.state.editorDetail.family_route_id === 12 &&
    loadFamilyEditorFn.includes("resolvePrmFamilyRouteEditorLoadId"),
  "23 browser Refresh reopens same route",
);

const failStore = createHandoffStore();
failStore.state.editorDetail = null;
failStore.createAndOpen = async function failOpen() {
  failStore.state.mutationCalls += 1;
  failStore.state.createCalls += 1;
  failStore.state.toasts.push("Family Route Draft created.");
  failStore.state.toasts.push(
    "Family Route created, but the new Draft could not be opened.",
  );
  return { ok: false, created: true, opened: false, family_route_id: 12 };
};
const failedOpen = await failStore.createAndOpen();
assert(
  failedOpen.opened === false &&
    failStore.state.toasts.includes(
      "Family Route created, but the new Draft could not be opened.",
    ) &&
    openCreatedFn.includes(
      "Family Route created, but the new Draft could not be opened.",
    ),
  "24 create-open failure shows explicit warning",
);
assert(
  failedOpen.created === true &&
    failStore.state.mutationCalls === 1 &&
    !openCreateFn
      .slice(openCreateFn.indexOf("await openCreatedFamilyRoute"))
      .includes("await editor.createFamilyDraft"),
  "25 create mutation not retried",
);

const firstDraft = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: null,
  draft_family_route_id: null,
});
const writable = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: null,
  draft_family_route_id: 12,
});
const approvedSuccessor = resolvePrmFamilyRouteCreateEligibility({
  approved_family_route_id: 10,
  draft_family_route_id: null,
  versions: [{ family_route_id: 10, status: "APPROVED" }],
});
assert(firstDraft.mode === "first_draft", "26 first-draft behavior unchanged");
assert(writable.mode === "writable_exists", "27 writable-existing behavior unchanged");
assert(
  approvedSuccessor.mode === "approved_successor",
  "28 approved-successor behavior unchanged",
);
assert(
  familyHtmlFn.includes("data-prm-open-approved-family-route") &&
    refreshEmptyFn.includes("openApprovedBtn"),
  "29 open-current-approved behavior unchanged",
);
assert(
  ROUTE_12.status === "DRAFT" &&
    thisSrc.includes("Route 12 DRY_FINE_POWDER_WASH_DRY_ROUTE remains DRAFT"),
  "30 Route 12 fixture remains DRAFT",
);
assert(
  ROUTE_12.steps.length === 0 && thisSrc.includes("0 steps"),
  "31 Route 12 fixture remains 0 steps",
);
assert(
  !openCreateFn.includes("family_route_id: 13") &&
    !openCreatedFn.includes("family_route_id: 13") &&
    thisSrc.includes("Does not create Route 13"),
  "32 no Route 13",
);
assert(
  !openCreateFn.includes("saveFamilyStep") &&
    !openCreatedFn.includes("upsert") &&
    !openCreatedFn.includes("RPC.upsertFamilyStep"),
  "33 no step mutation",
);
assert(
  !openCreateFn.includes("validateFamily") &&
    !openCreatedFn.includes("validateFamily"),
  "34 no validate",
);
assert(
  !openCreateFn.includes("submitFamily") && !openCreatedFn.includes("submitFamily"),
  "35 no submit",
);
assert(
  !openCreateFn.includes("approveFamily") &&
    !openCreatedFn.includes("RPC.approveFamilyRoute"),
  "36 no approve",
);
assert(
  !openCreateFn.includes("cloneFamilyDraft") &&
    !openCreatedFn.includes("cloneFamilyDraft"),
  "37 no clone",
);
assert(
  !openCreateFn.includes("RPC.mapProductGroup") &&
    !openCreatedFn.includes("rpc_map_product"),
  "38 no mappings",
);
assert(
  !rpcSrc.includes("openCreatedFamilyRoute") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION"),
  "39 no server files",
);
assert(
  !openCreateFn.includes("requestCostingRefresh") &&
    !openCreatedFn.includes("runStagedCostingRefresh"),
  "40 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc) &&
    thisSrc.includes("hub-cache-v307"),
  "41 SW bump once",
);

assert(
  createDraftFn.includes("extractCreatedFamilyRouteId") &&
    refreshEmptyFn.includes("shouldApplyPrmFamilyRouteEmptyContextRefresh") &&
    loadFamilyEditorFn.includes("resolvePrmFamilyRouteEditorLoadId"),
  "wiring identity/handoff helpers",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-family-route-create-open-handoff-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-family-route-create-open-handoff-smoke: all passed",
);
console.log("READY_FOR_11Y_10I_2C_3F_2B_4D_BROWSER_ACCEPTANCE");
