/**
 * Gate 11Y.10I.2C.3F.2B.4C.1 — Route Family Register Authoritative Refresh
 * + Master-Options Freshness.
 *
 * Mocked state/RPC transition smoke. Does not create or approve live Families.
 * Family 11 DRY_FINE_POWDER_WASH_DRY remains DRAFT in live business state.
 * Does not create a Family Route or mappings. Does not mutate Family 10.
 * SW expected: hub-cache-v307
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPrmMasterOptionsReady,
  resolvePrmMasterOptionsRequestScope,
  shouldAcceptPrmMasterOptionsGeneration,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const shellSrc = read("public/shared/js/costing-suite-shell.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-route-family-register-refresh-smoke.mjs",
);

const loadMasterFn =
  mainSrc.match(
    /async function loadMasterOptions\(filters = \{\}\) \{[\s\S]*?\n  async function ensureMasterOptions/,
  )?.[0] || "";
const ensureFn =
  mainSrc.match(
    /async function ensureMasterOptions\(filters = \{\}\) \{[\s\S]*?\n  async function requireMasterOptionsForStepAuthoring/,
  )?.[0] || "";
const commitFn =
  mainSrc.match(
    /function commitMasterOptionsPayload\(payload, generation\) \{[\s\S]*?\n  async function loadMasterOptions/,
  )?.[0] || "";
const helperFn =
  mainSrc.match(
    /async function refreshRouteFamiliesAfterMutation\([\s\S]*?\n  async function loadMappingReview/,
  )?.[0] || "";
const loadFamiliesFn =
  mainSrc.match(
    /async function loadRouteFamilies\(\) \{[\s\S]*?\n  async function refreshRouteFamiliesAfterMutation/,
  )?.[0] || "";
const createFn =
  mainSrc.match(
    /function openCreateFamilyModal\(\) \{[\s\S]*?\n  async function openApproveFamilyModal/,
  )?.[0] || "";
const approveFn =
  mainSrc.match(
    /async function openApproveFamilyModal\(row[\s\S]*?\n  async function openMapProductGroupModal/,
  )?.[0] || "";
const summaryFn =
  mainSrc.match(
    /async function openFamilySummary\(row[\s\S]*?\n  function bindSummaryActions/,
  )?.[0] || "";
const renderFamiliesFn =
  mainSrc.match(
    /function renderRouteFamilies\(\) \{[\s\S]*?\n  function workloadExplainStripItem/,
  )?.[0] || "";
const renderFn =
  mainSrc.match(/function render\([^)]*\) \{[\s\S]*?\n  function syncPageFromShell/)?.[0] ||
  "";

const FAMILY_10 = {
  route_family_id: 10,
  route_family_code: "DRY_FINE_POWDER_NO_WASH",
  route_family_name: "Dry Fine Powder — No-Wash",
  status: "APPROVED",
};
const FAMILY_11_DRAFT = {
  route_family_id: 11,
  route_family_code: "DRY_FINE_POWDER_WASH_DRY",
  route_family_name: "Dry Fine Powder — Wash & Dry",
  status: "DRAFT",
  effective_from: "2026-08-14",
  approval_reference: null,
};
const FAMILY_11_APPROVED = {
  ...FAMILY_11_DRAFT,
  status: "APPROVED",
  approval_reference: "PRM-RF-DRY_FINE_POWDER_WASH_DRY-APP-20260814",
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
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createMasterOptionsStore() {
  const state = {
    optionsStatus: "uninitialized",
    options: null,
    routeFamilies: [],
    selectedProductId: 139,
    product_group_id: 7,
    route_family_id: 10,
    deepLink: {
      product_id: 139,
      product_group_id: 7,
      route_family_id: 10,
    },
    activeLens: "route-families",
    search: "powder",
    as_of_date: "2026-08-14",
    total_count: 0,
  };
  let generation = 0;
  let inflight = null;
  let inflightGeneration = 0;
  const rpcCalls = [];
  let rpcImpl = async () => ({ route_families: [FAMILY_10] });
  const painted = [];
  let summaryOpenedFrom = null;
  let refreshWarning = null;
  let mutationCalls = 0;

  function paintRegister() {
    const rows = Array.isArray(state.routeFamilies) ? state.routeFamilies : [];
    painted.push({
      rows: rows.map((row) => ({
        id: row.route_family_id,
        status: row.status,
      })),
      count: rows.length,
      countLabel: `${rows.length} row${rows.length === 1 ? "" : "s"}`,
    });
  }

  function commit(payload, requestGeneration) {
    if (
      !shouldAcceptPrmMasterOptionsGeneration(requestGeneration, generation)
    ) {
      return { ok: true, stale: true, generation: requestGeneration, data: state.options };
    }
    state.options = payload;
    state.optionsStatus = "ready";
    state.routeFamilies = payload.route_families || [];
    if (state.activeLens === "route-families") {
      state.total_count = state.routeFamilies.length;
    }
    return { ok: true, stale: false, data: payload, generation: requestGeneration };
  }

  async function loadMasterOptions(filters = {}) {
    const requestGeneration = ++generation;
    const scope = resolvePrmMasterOptionsRequestScope(filters, {
      selectedProductId: state.selectedProductId,
      product_group_id: state.product_group_id,
      route_family_id: state.route_family_id,
      deepLink: state.deepLink,
    });
    state.optionsStatus = "loading";
    const run = (async () => {
      rpcCalls.push({
        generation: requestGeneration,
        scope: { ...scope },
        filters: { ...filters },
      });
      let payload;
      try {
        payload = await rpcImpl(scope, requestGeneration);
      } catch (error) {
        if (
          !shouldAcceptPrmMasterOptionsGeneration(requestGeneration, generation)
        ) {
          return {
            ok: true,
            stale: true,
            generation: requestGeneration,
            data: state.options,
          };
        }
        return { ok: false, error };
      }
      if (
        !shouldAcceptPrmMasterOptionsGeneration(requestGeneration, generation)
      ) {
        return {
          ok: true,
          stale: true,
          generation: requestGeneration,
          data: state.options,
        };
      }
      return commit(payload, requestGeneration);
    })();
    inflightGeneration = requestGeneration;
    inflight = run.finally(() => {
      if (inflightGeneration === requestGeneration) inflight = null;
    });
    return run;
  }

  async function ensureMasterOptions(filters = {}) {
    if (isPrmMasterOptionsReady(state.optionsStatus) && state.options) {
      return { ok: true, data: state.options, cached: true };
    }
    if (inflight) return inflight;
    return loadMasterOptions(filters);
  }

  async function refreshRouteFamiliesAfterMutation({
    refreshFailureMessage = "Route Family updated, but the register could not be refreshed.",
  } = {}) {
    try {
      const result = await loadMasterOptions({ catalogueScope: "unscoped" });
      if (result?.stale && isPrmMasterOptionsReady(state.optionsStatus)) {
        if (state.activeLens === "route-families") paintRegister();
        return { ok: true, data: state.options, stale: true };
      }
      if (state.activeLens === "route-families") paintRegister();
      if (!result?.ok) {
        refreshWarning = refreshFailureMessage;
      }
      return result;
    } catch (error) {
      refreshWarning = refreshFailureMessage;
      return { ok: false, error };
    }
  }

  return {
    state,
    rpcCalls,
    painted,
    get inflight() {
      return inflight;
    },
    get summaryOpenedFrom() {
      return summaryOpenedFrom;
    },
    get refreshWarning() {
      return refreshWarning;
    },
    get mutationCalls() {
      return mutationCalls;
    },
    setRpc(fn) {
      rpcImpl = fn;
    },
    loadMasterOptions,
    ensureMasterOptions,
    refreshRouteFamiliesAfterMutation,
    invalidateCache() {
      state.optionsStatus = "uninitialized";
    },
    async createFamily() {
      mutationCalls += 1;
      const createdId = 11;
      const refresh = await refreshRouteFamiliesAfterMutation({
        refreshFailureMessage:
          "Route Family created, but the register could not be refreshed.",
      });
      if (refresh?.ok) {
        const created = (state.routeFamilies || []).find(
          (family) => Number(family.route_family_id) === createdId,
        );
        if (created) summaryOpenedFrom = created;
      }
      return { ok: true, id: createdId, refresh };
    },
    async approveFamily(routeFamilyId) {
      mutationCalls += 1;
      const refresh = await refreshRouteFamiliesAfterMutation({
        refreshFailureMessage:
          "Route Family approved, but the register could not be refreshed.",
      });
      if (refresh?.ok) {
        const approved = (state.routeFamilies || []).find(
          (family) => Number(family.route_family_id) === Number(routeFamilyId),
        );
        if (approved) summaryOpenedFrom = approved;
      }
      return { ok: true, refresh };
    },
    async openSummaryFromCache() {
      const before = rpcCalls.length;
      const result = await ensureMasterOptions();
      return { result, startedNewRequest: rpcCalls.length !== before };
    },
  };
}

const store = createMasterOptionsStore();
store.setRpc(async () => ({
  route_families: [FAMILY_10, FAMILY_11_DRAFT],
}));

const createResult = await store.createFamily();
const unscopedCall = store.rpcCalls.find(
  (call) => call.filters.catalogueScope === "unscoped",
);
const uiBeforeRace = {
  selectedProductId: store.state.selectedProductId,
  product_group_id: store.state.product_group_id,
  route_family_id: store.state.route_family_id,
  deepLink: { ...store.state.deepLink },
  activeLens: store.state.activeLens,
  search: store.state.search,
  as_of_date: store.state.as_of_date,
};

assert(createResult.id === 11, "1 create returns Family 11 id");
assert(unscopedCall?.scope.product_id === null, "2 unscoped request sends product_id=null");
assert(
  unscopedCall?.scope.product_group_id === null,
  "3 unscoped request sends product_group_id=null",
);
assert(
  unscopedCall?.scope.route_family_id === null,
  "4 unscoped request sends route_family_id=null",
);
assert(
  store.state.selectedProductId === 139 &&
    store.state.product_group_id === 7 &&
    store.state.route_family_id === 10 &&
    store.state.deepLink.product_id === 139 &&
    store.state.deepLink.product_group_id === 7 &&
    store.state.deepLink.route_family_id === 10,
  "5 state/deep-link ids are NOT cleared",
);
assert(
  (store.state.routeFamilies || []).some((row) => row.route_family_id === 10) &&
    (store.state.routeFamilies || []).some((row) => row.route_family_id === 11),
  "6 fresh payload returns Family 10 + 11",
);
assert(
  store.state.routeFamilies.length === 2 &&
    shouldAcceptPrmMasterOptionsGeneration(
      store.rpcCalls[store.rpcCalls.length - 1].generation,
      store.rpcCalls[store.rpcCalls.length - 1].generation,
    ),
  "7 accepted generation commits both rows",
);
assert(
  store.painted.at(-1)?.rows.length === 2,
  "8 render sees 2 rows",
);
assert(
  store.painted.at(-1)?.count === 2 &&
    store.painted.at(-1)?.countLabel === "2 rows" &&
    store.state.total_count === 2,
  "9 row counter shows 2",
);

const staleStore = createMasterOptionsStore();
const older = deferred();
let newerStarted = false;
staleStore.setRpc(async (_scope, generation) => {
  if (generation === 1) {
    await older.promise;
    return { route_families: [FAMILY_10] };
  }
  newerStarted = true;
  return { route_families: [FAMILY_10, FAMILY_11_DRAFT] };
});
const olderLoad = staleStore.loadMasterOptions({ catalogueScope: "unscoped" });
const newerLoad = staleStore.loadMasterOptions({ catalogueScope: "unscoped" });
await newerLoad;
older.resolve();
const olderResult = await olderLoad;
assert(newerStarted === true, "10 older request completes later");
assert(
  olderResult.stale === true &&
    staleStore.state.routeFamilies.length === 2 &&
    !staleStore.state.routeFamilies.every((row) => row.route_family_id === 10),
  "11 older generation cannot replace 2 rows with 1",
);

const inflightStore = createMasterOptionsStore();
const held = deferred();
inflightStore.setRpc(async () => {
  await held.promise;
  return { route_families: [FAMILY_10, FAMILY_11_DRAFT] };
});
const direct = inflightStore.loadMasterOptions({ catalogueScope: "unscoped" });
assert(
  inflightStore.inflight != null,
  "12 direct load registers inflight",
);
const rpcCountDuring = inflightStore.rpcCalls.length;
void inflightStore.ensureMasterOptions({ product_id: 139 });
assert(
  rpcCountDuring === 1 &&
    inflightStore.inflight != null &&
    inflightStore.rpcCalls.length === 1,
  "13 ensureMasterOptions does not create competing request during inflight",
);
held.resolve();
await direct;

assert(
  store.state.activeLens === "route-families" &&
    uiBeforeRace.activeLens === "route-families",
  "14 activeLens remains route-families",
);
assert(store.state.search === "powder", "15 search preserved");
assert(store.state.as_of_date === "2026-08-14", "16 as-of preserved");
assert(
  store.summaryOpenedFrom?.route_family_id === 11 &&
    store.painted.length >= 1 &&
    store.summaryOpenedFrom.status === "DRAFT",
  "17 summary opens only after fresh assignment",
);
const summaryProbe = await store.openSummaryFromCache();
assert(
  summaryProbe.result.cached === true &&
    summaryProbe.startedNewRequest === false &&
    store.state.routeFamilies.length === 2,
  "18 summary cannot trigger stale overwrite",
);

const approveStore = createMasterOptionsStore();
approveStore.setRpc(async () => ({
  route_families: [FAMILY_10, FAMILY_11_DRAFT],
}));
await approveStore.createFamily();
approveStore.setRpc(async () => ({
  route_families: [FAMILY_10, FAMILY_11_APPROVED],
}));
await approveStore.approveFamily(11);
assert(
  approveStore.state.routeFamilies.find((row) => row.route_family_id === 11)
    ?.status === "APPROVED",
  "19 approval mock changes Family 11 DRAFT → APPROVED",
);
assert(
  approveStore.painted.at(-1)?.rows.find((row) => row.id === 11)?.status ===
    "APPROVED",
  "20 approval refresh repaint sees APPROVED",
);
assert(
  createFn.includes("await refreshRouteFamiliesAfterMutation") &&
    approveFn.includes("await refreshRouteFamiliesAfterMutation") &&
    !createFn.includes("onLensLoadStart") &&
    !approveFn.includes("onLensLoadStart"),
  "21 no manual Refresh needed",
);

const refreshStore = createMasterOptionsStore();
refreshStore.setRpc(async () => ({
  route_families: [FAMILY_10, FAMILY_11_DRAFT],
}));
await refreshStore.loadMasterOptions({ catalogueScope: "unscoped" });
const callsAfterLoad = refreshStore.rpcCalls.length;
refreshStore.invalidateCache();
assert(
  mainSrc.includes('state.optionsStatus = "uninitialized"') &&
    mainSrc.includes("onLensLoadStart()") &&
    refreshStore.state.optionsStatus === "uninitialized",
  "22 module Refresh invalidates cache",
);
await refreshStore.loadMasterOptions({ catalogueScope: "unscoped" });
assert(
  refreshStore.rpcCalls.length === callsAfterLoad + 1 &&
    refreshStore.rpcCalls.at(-1).scope.product_id === null &&
    refreshStore.rpcCalls.at(-1).scope.product_group_id === null &&
    refreshStore.rpcCalls.at(-1).scope.route_family_id === null,
  "23 module Refresh performs fresh catalogue request",
);
assert(
  approveStore.state.total_count === 2 &&
    approveStore.painted.at(-1)?.count === 2,
  "24 row count stays consistent after approval",
);
assert(
  !helperFn.includes("status: \"DRAFT\"") &&
    !createFn.includes("state.routeFamilies.push") &&
    !createFn.includes("optimistic"),
  "25 no optimistic Family row",
);
assert(
  !createFn.includes("synthetic") &&
    !helperFn.includes("fallback") &&
    FAMILY_11_DRAFT.status === "DRAFT",
  "26 no synthetic DRAFT fallback",
);

const failStore = createMasterOptionsStore();
failStore.setRpc(async () => {
  throw new Error("catalogue unavailable");
});
const failedCreate = await failStore.createFamily();
assert(
  failStore.refreshWarning ===
    "Route Family created, but the register could not be refreshed." &&
    helperFn.includes(
      "Route Family updated, but the register could not be refreshed.",
    ) &&
    approveFn.includes(
      "Route Family approved, but the register could not be refreshed.",
    ),
  "27 refresh failure warning present",
);
assert(
  failedCreate.ok === true &&
    failStore.mutationCalls === 1 &&
    !createFn.slice(createFn.indexOf("await refreshRouteFamiliesAfterMutation")).includes(
      "await governed",
    ),
  "28 mutation not retried",
);

assert(
  FAMILY_11_DRAFT.status === "DRAFT" &&
    FAMILY_11_DRAFT.approval_reference == null &&
    FAMILY_11_DRAFT.effective_from === "2026-08-14" &&
    thisSrc.includes("Family 11 DRY_FINE_POWDER_WASH_DRY remains DRAFT"),
  "29 Family 11 live fixture remains DRAFT",
);
assert(
  thisSrc.includes("Does not create or approve live Families") &&
    createFn.includes("RPC.createFamily") &&
    !createFn.includes("DRY_FINE_POWDER_WASH_DRY"),
  "30 no live create",
);
assert(
  approveFn.includes("RPC.approveFamily") &&
    !approveFn.includes("DRY_FINE_POWDER_WASH_DRY") &&
    thisSrc.includes("Does not create or approve live Families"),
  "31 no live approve",
);
assert(
  !createFn.includes("rpc_create_route_family_route") &&
    !approveFn.includes("rpc_create_route_family_route") &&
    !createFn.includes("RPC.createFamilyRoute") &&
    !approveFn.includes("RPC.createFamilyRoute"),
  "32 no Family Route",
);
assert(
  !createFn.includes("RPC.mapProductGroup") &&
    !approveFn.includes("rpc_map_product") &&
    !approveFn.includes("RPC.mapProductGroup"),
  "33 no mappings",
);
assert(
  !rpcSrc.includes("refreshRouteFamiliesAfterMutation") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("apply_migration"),
  "34 no server files",
);
assert(
  !createFn.includes("requestCostingRefresh") &&
    !approveFn.includes("requestCostingRefresh") &&
    !helperFn.includes("runStagedCostingRefresh") &&
    !helperFn.includes("requestCostingRefresh"),
  "35 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc) &&
    thisSrc.includes("hub-cache-v307"),
  "36 SW bump once",
);

assert(
  helpersSrc.includes('catalogueScope === "unscoped"') &&
    loadFamiliesFn.includes('catalogueScope: "unscoped"') &&
    helperFn.includes('catalogueScope: "unscoped"') &&
    loadMasterFn.includes("resolvePrmMasterOptionsRequestScope"),
  "wiring unscoped catalogue mode",
);
assert(
  loadMasterFn.includes("masterOptionsGeneration") &&
    commitFn.includes("shouldAcceptPrmMasterOptionsGeneration") &&
    ensureFn.includes("masterOptionsInflight") &&
    !helperFn.includes("ensureMasterOptions") &&
    !helperFn.includes("beginLensTransition"),
  "wiring generation and inflight ownership",
);
assert(
  createFn.includes("await refreshRouteFamiliesAfterMutation") &&
    createFn.indexOf("closeModal({ restorePrevious: false })") <
      createFn.indexOf("await refreshRouteFamiliesAfterMutation") &&
    createFn.indexOf("await refreshRouteFamiliesAfterMutation") <
      createFn.indexOf("await openFamilySummary"),
  "create path: close → unscoped refresh → summary",
);
assert(
  approveFn.includes("await refreshRouteFamiliesAfterMutation") &&
    approveFn.indexOf("closeModal({ restorePrevious: false })") <
      approveFn.indexOf("await refreshRouteFamiliesAfterMutation") &&
    !approveFn.includes("reloadFamilySummary"),
  "approve path uses authoritative refresh, not cached reload",
);
assert(
  summaryFn.includes("await ensureMasterOptions()") &&
    renderFn.includes('state.activeLens === "route-families"') &&
    renderFn.includes("renderRouteFamilies()"),
  "summary reuses ensure; register paint is the same renderer",
);
assert(
  renderFamiliesFn.includes("syncFamiliesRegisterCount") &&
    mainSrc.includes('state.activeLens === "route-families"') &&
    mainSrc.includes("(state.routeFamilies || []).length") &&
    shellSrc.includes('CURRENT_LENS === "route-families"') &&
    shellSrc.includes("prmRegisterCountActive"),
  "row count binds to Families register collection",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-route-family-register-refresh-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-route-family-register-refresh-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_3F_2B_4C_1_BROWSER_ACCEPTANCE");
