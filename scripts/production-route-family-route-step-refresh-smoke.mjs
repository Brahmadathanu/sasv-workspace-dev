/**
 * Gate 11Y.10I.2C.3F.2B.4E — Family Route step post-mutation editor refresh.
 * Mocked state/RPC transitions. Route 12 DRAFT with Seq 10/20/30 only.
 * No live Seq 40, validate/submit/approve, Route 13, mappings, or server writes.
 * SW expected: hub-cache-v307
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyPrmFamilyRouteValidationPresentation,
  PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION,
  resolvePrmFamilyRouteEditorRouteId,
  shouldAcceptPrmFamilyRouteDetailGeneration,
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
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-family-route-step-refresh-smoke.mjs",
);

const refreshHelperFn =
  mainSrc.match(
    /async function refreshFamilyRouteEditorAfterStepMutation\([\s\S]*?\n  async function openFamilyStepModal/,
  )?.[0] || "";
const paintFn =
  mainSrc.match(
    /function paintFamilyRouteEditor\([\s\S]*?\n  function familyStateHasStepId/,
  )?.[0] || "";
const stepModalFn =
  mainSrc.match(
    /async function openFamilyStepModal\([\s\S]*?\n  async function openFamilyStepCreateModal/,
  )?.[0] || "";
const loadFamilyDetailFn =
  editorSrc.match(
    /async function loadFamilyDetail\([\s\S]*?\n  async function loadProductDetail/,
  )?.[0] || "";
const familyHtmlFn =
  editorSrc.match(/function familyHtml\([\s\S]*?\n  function productHtml/)?.[0] ||
  "";

const ROUTE_12 = Object.freeze({
  family_route_id: 12,
  route_family_id: 11,
  route_name: "DRY_FINE_POWDER_WASH_DRY_ROUTE",
  status: "DRAFT",
  route_version: 1,
  version: 1,
});

const BASE_STEPS = Object.freeze([
  {
    family_route_step_id: 101,
    sequence_no: 10,
    step_key: "RM_ISSUE",
    activity_name: "RM dispensation",
  },
  {
    family_route_step_id: 102,
    sequence_no: 20,
    step_key: "RM_WASHING",
    activity_name: "RM washing",
  },
  {
    family_route_step_id: 103,
    sequence_no: 30,
    step_key: "RM_DRYING",
    activity_name: "RM drying",
  },
]);

const MOCK_NEW_STEP = Object.freeze({
  family_route_step_id: 199,
  sequence_no: 35,
  step_key: "MOCK_ONLY",
  activity_name: "Mock-only step",
});

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

function createDetailLoader(initialSteps = BASE_STEPS) {
  let generation = 0;
  let steps = [...initialSteps];
  let validation = { ok: false, mode: "INCOMPLETE" };
  const loads = [];
  const pending = new Map();

  function bumpGeneration() {
    generation += 1;
    return generation;
  }

  async function loadFamilyDetail(familyRouteId, options = {}) {
    const requestGeneration =
      options.generation != null ? Number(options.generation) : bumpGeneration();
    loads.push({ familyRouteId, generation: requestGeneration, options });

    const ticket = deferred();
    pending.set(requestGeneration, ticket);

    return {
      requestGeneration,
      complete(payloadSteps = steps, payloadValidation = validation) {
        if (
          !shouldAcceptPrmFamilyRouteDetailGeneration({
            requestGeneration,
            currentGeneration: generation,
          })
        ) {
          pending.delete(requestGeneration);
          ticket.resolve({ ok: false, stale: true });
          return { ok: false, stale: true };
        }
        steps = [...payloadSteps];
        validation = payloadValidation;
        pending.delete(requestGeneration);
        ticket.resolve({
          ok: true,
          detail: { ...ROUTE_12, family_route_id: familyRouteId },
          normalized: {
            header: { ...ROUTE_12, family_route_id: familyRouteId },
            steps,
            validation,
          },
        });
        return ticket.promise;
      },
      failStale() {
        generation += 1;
        pending.delete(requestGeneration);
        ticket.resolve({ ok: false, stale: true });
        return { ok: false, stale: true };
      },
    };
  }

  function getSteps() {
    return steps;
  }

  function getValidation() {
    return validation;
  }

  return {
    bumpGeneration,
    get generation() {
      return generation;
    },
    loads,
    loadFamilyDetail,
    getSteps,
    getValidation,
    setSteps(next) {
      steps = [...next];
    },
  };
}

async function simulatePostMutationRefresh(store, loader, {
  successMessage = "Route step saved.",
  refreshFailureMessage = "Route step saved, but the Family Route could not be refreshed.",
} = {}) {
  const familyRouteId = resolvePrmFamilyRouteEditorRouteId({
    selectedFamilyRouteId: store.selectedFamilyRouteId,
    deepLink: store.deepLink,
    detail: store.detail,
  });
  const events = [];
  if (familyRouteId == null) {
    events.push({ type: "success", message: successMessage });
    events.push({ type: "closeModal" });
    events.push({ type: "warning", message: refreshFailureMessage });
    return { ok: false, events, rendered: false };
  }
  events.push({ type: "success", message: successMessage });
  events.push({ type: "closeModal" });
  const generation = loader.bumpGeneration();
  events.push({ type: "bump", generation });
  const load = await loader.loadFamilyDetail(familyRouteId, {
    preserveValidationStale: true,
    generation,
  });
  const result = await load.complete([...loader.getSteps(), MOCK_NEW_STEP]);
  if (!result?.ok) {
    events.push({ type: "warning", message: refreshFailureMessage });
    return { ok: false, events, rendered: false, result };
  }
  store.detail = result.detail;
  store.steps = [...result.normalized.steps];
  store.validation = result.normalized.validation;
  events.push({ type: "render" });
  return { ok: true, events, rendered: true, result };
}

const store = {
  selectedFamilyRouteId: 12,
  deepLink: { route_family_id: 11, family_route_id: 12 },
  detail: { ...ROUTE_12 },
  steps: [...BASE_STEPS],
  validation: { ok: false },
  modalOpen: true,
  mutationCalls: 0,
};

const loader = createDetailLoader();

assert(
  resolvePrmFamilyRouteEditorRouteId({
    selectedFamilyRouteId: 12,
    deepLink: { family_route_id: 12 },
    detail: ROUTE_12,
  }) === 12,
  "2 exact family_route_id resolved from canonical sources",
);
assert(
  !refreshHelperFn.includes("route_name") &&
    !refreshHelperFn.includes("DRY_FINE_POWDER") &&
    !refreshHelperFn.includes("latest"),
  "3 no route-name or latest-route inference",
);

store.mutationCalls += 1;
const refresh = await simulatePostMutationRefresh(store, loader);
assert(store.mutationCalls === 1, "1 add-step mutation invoked once");
assert(
  refresh.events.some((event) => event.message === "Route step saved."),
  "4 success toast emitted",
);
assert(refresh.events.some((event) => event.type === "closeModal"), "5 modal closes");
assert(
  refresh.events.some((event) => event.type === "bump" && event.generation > 0),
  "6 authoritative generation bumped",
);
assert(
  loader.loads.length === 1 && loader.loads[0].familyRouteId === 12,
  "7 loadFamilyDetail invoked for exact route id",
);
assert(
  loader.loads[0].options.generation === loader.generation,
  "8 authoritative load uses bumped generation",
);
assert(refresh.rendered === true, "10 render occurs after fresh commit");
assert(
  store.steps.some((step) => step.family_route_step_id === MOCK_NEW_STEP.family_route_step_id),
  "11 mocked new step visible immediately",
);
assert(
  !stepModalFn.includes("familyState.steps.push") &&
    !stepModalFn.includes("optimistic"),
  "13 no optimistic local row insertion",
);

const staleLoader = createDetailLoader();
const olderTicket = await staleLoader.loadFamilyDetail(12, { generation: 1 });
staleLoader.bumpGeneration();
staleLoader.bumpGeneration();
const newerTicket = await staleLoader.loadFamilyDetail(12, {
  generation: staleLoader.generation,
});
await newerTicket.complete([...BASE_STEPS, MOCK_NEW_STEP]);
const staleResult = await olderTicket.complete(BASE_STEPS);
assert(staleResult?.stale === true, "14 older request cannot overwrite fresh steps");
assert(
  staleLoader.getSteps().some((step) => step.family_route_step_id === MOCK_NEW_STEP.family_route_step_id),
  "15 stale generation cannot overwrite fresh steps",
);

assert(
  shouldAcceptPrmFamilyRouteDetailGeneration({
    requestGeneration: 2,
    currentGeneration: 2,
  }) === true &&
    shouldAcceptPrmFamilyRouteDetailGeneration({
      requestGeneration: 1,
      currentGeneration: 2,
    }) === false,
  "16 stale generation guard is pure/testable",
);

assert(
  refreshHelperFn.includes("includeSecondary: false") &&
    refreshHelperFn.includes("paintFamilyRouteEditor()") &&
    (paintFn.includes("paintAcceptedPrmLens") ||
      paintFn.includes("afterPrmNavigate")) &&
    (paintFn.includes("tw-visible") ||
      helpersSrc.includes("applyPrmTableWrapVisible") ||
      mainSrc.includes("applyPrmTableWrapVisible")) &&
    loadFamilyDetailFn.includes("includeSecondary = true") &&
    loadFamilyDetailFn.includes("if (!includeSecondary)") &&
    loadFamilyDetailFn.includes("loadPredecessorHistoryIfNeeded") &&
    loadFamilyDetailFn.includes("loadFamilyEvidencePreview") &&
    loadFamilyDetailFn.includes("isCurrentFamilyRouteDetailGeneration(requestGeneration)"),
  "18 post-step reload paints after detail commit without waiting on evidence/history",
);

assert(
  stepModalFn.includes("refreshFamilyRouteEditorAfterStepMutation") &&
    refreshHelperFn.includes("Route step saved."),
  "19 edit/add path uses shared refresh helper",
);
assert(
  stepModalFn.includes("Route step removed.") &&
    stepModalFn.includes("refreshFamilyRouteEditorAfterStepMutation"),
  "20 delete path uses shared refresh helper",
);
assert(
  mainSrc.includes('action === "apply-family-order"') &&
    mainSrc.includes("refreshFamilyRouteEditorAfterStepMutation"),
  "21 reorder path uses shared refresh helper",
);

const presentation = classifyPrmFamilyRouteValidationPresentation(
  store.validation,
  store.steps,
);
assert(
  familyHtmlFn.includes("classifyPrmFamilyRouteValidationPresentation") &&
    (presentation?.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE ||
      !store.validation?.ok),
  "22 validity/incomplete cue uses fresh detail",
);

assert(
  refreshHelperFn.includes(
    "Route step saved, but the Family Route could not be refreshed.",
  ),
  "23 refresh failure warning present",
);
assert(
  !refreshHelperFn.includes("saveFamilyStep") &&
    !refreshHelperFn.includes("deleteFamilyStep") &&
    !refreshHelperFn.includes("applyFamilyStepOrder"),
  "24 mutation is not retried in refresh helper",
);
assert(
  stepModalFn.includes("onModal(modalHost") &&
    refreshHelperFn.includes("closeModal({ restorePrevious: false })"),
  "25 modal handler ownership preserved",
);

assert(store.detail.status === "DRAFT", "26 Route 12 fixture remains DRAFT");
assert(
  BASE_STEPS.some((step) => step.sequence_no === 10 && step.step_key === "RM_ISSUE"),
  "27 fixture Seq 10 unchanged",
);
assert(
  BASE_STEPS.some((step) => step.sequence_no === 20 && step.step_key === "RM_WASHING"),
  "28 fixture Seq 20 unchanged",
);
assert(
  BASE_STEPS.some((step) => step.sequence_no === 30 && step.step_key === "RM_DRYING"),
  "29 fixture Seq 30 unchanged",
);
assert(
  !BASE_STEPS.some((step) => step.sequence_no === 40) &&
    MOCK_NEW_STEP.sequence_no !== 40,
  "30 no live Seq 40",
);

const FORBIDDEN_ROUTE_13 = ["family_route_id", 13].join(": ") + ",";
assert(
  !refreshHelperFn.includes("validateFamily(") &&
    !refreshHelperFn.includes("rpc_validate_route_family_route"),
  "31 no validate",
);
assert(
  !refreshHelperFn.includes("submitFamily") &&
    !stepModalFn.includes("submitFamily"),
  "32 no submit",
);
assert(
  !refreshHelperFn.includes("approveFamily") &&
    !stepModalFn.includes("approveFamily"),
  "33 no approve",
);
assert(
  ROUTE_12.family_route_id === 12 && !thisSrc.includes(FORBIDDEN_ROUTE_13),
  "34 no Route 13",
);
assert(
  !refreshHelperFn.includes("rpc_map_product") &&
    !refreshHelperFn.includes("mapping_id"),
  "35 no mappings",
);
assert(
  !refreshHelperFn.includes("apply_migration") &&
    !refreshHelperFn.includes("supabase/migrations"),
  "36 no server files",
);
assert(
  !refreshHelperFn.includes("costingRefresh") &&
    !refreshHelperFn.includes("refreshCosting"),
  "37 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc) && thisSrc.includes("hub-cache-v307"),
  "38 SW bump once to hub-cache-v307",
);

assert(
  editorSrc.includes("familyRouteDetailGeneration") &&
    editorSrc.includes("bumpFamilyRouteDetailGeneration") &&
    helpersSrc.includes("shouldAcceptPrmFamilyRouteDetailGeneration") &&
    helpersSrc.includes("resolvePrmFamilyRouteEditorRouteId"),
  "generation + route-id helpers wired in source",
);
assert(
  loadFamilyDetailFn.includes("generation = null") &&
    loadFamilyDetailFn.includes("{ ok: false, stale: true }"),
  "state-commit guards return stale without overwrite",
);
assert(
  !refresh.events.some((event) => event.type === "manualRefresh"),
  "12 no manual Refresh dependency",
);

const failRefreshLoader = createDetailLoader();
const failRefresh = await (async () => {
  const generation = failRefreshLoader.bumpGeneration();
  const load = await failRefreshLoader.loadFamilyDetail(12, {
    preserveValidationStale: true,
    generation,
  });
  return load.failStale();
})();
assert(failRefresh?.stale === true, "17 stale generation cannot overwrite fresh detail");

if (failed) {
  console.error(
    `\nproduction-route-family-route-step-refresh-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-route-step-refresh-smoke: all passed");
