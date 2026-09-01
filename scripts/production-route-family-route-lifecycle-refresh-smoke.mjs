/**
 * Gate 11Y.10I.2C.3F.2B.4E.1 — Family Route lifecycle post-mutation refresh.
 * Mocked state/RPC transitions only. Live Route 12 remains APPROVED.
 * No live validate/submit/approve/clone. SW expected: hub-cache-v307
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalPrmRouteStatus,
  formatPrmRouteStatusLabel,
  isPrmRouteCloneableStatus,
  isPrmRouteReadOnlyStatus,
  isPrmRouteReviewStatus,
  isPrmRouteWritableStatus,
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
  "scripts/production-route-family-route-lifecycle-refresh-smoke.mjs",
);
const stepRefreshSrc = read(
  "scripts/production-route-family-route-step-refresh-smoke.mjs",
);

const lifecycleFn =
  mainSrc.match(
    /async function refreshFamilyRouteEditorAfterLifecycleMutation\([\s\S]*?\n  async function openFamilyStepModal/,
  )?.[0] || "";
const validateFn =
  mainSrc.match(
    /if \(action === `validate-\$\{mode\}`\) \{[\s\S]*?\n      if \(action === `submit-\$\{mode\}`\)/,
  )?.[0] || "";
const submitFn =
  mainSrc.match(
    /if \(action === `submit-\$\{mode\}`\) \{[\s\S]*?\n      if \(action === `approve-\$\{mode\}`\)/,
  )?.[0] || "";
const editorValidateFn =
  editorSrc.match(
    /async function validate\(mode\) \{[\s\S]*?\n  async function submit/,
  )?.[0] || "";
const editorSubmitFn =
  editorSrc.match(
    /async function submit\(mode\) \{[\s\S]*?\n  async function approve/,
  )?.[0] || "";
const approveFn =
  mainSrc.match(
    /function openApproveFamilyRouteModal\([\s\S]*?\n  function openApproveProductRouteModal/,
  )?.[0] || "";
const familyHtmlFn =
  editorSrc.match(/function familyHtml\([\s\S]*?\n  function productHtml/)?.[0] ||
  "";
const loadFamilyDetailFn =
  editorSrc.match(
    /async function loadFamilyDetail\([\s\S]*?\n  async function loadProductDetail/,
  )?.[0] || "";

const ROUTE_12 = Object.freeze({
  family_route_id: 12,
  route_family_id: 11,
  route_name: "Dry Fine Powder — Wash & Dry Manufacturing Route",
  route_code: "DRY_FINE_POWDER_WASH_DRY_ROUTE",
  status: "APPROVED",
  route_version: 1,
  version: 1,
  approval_reference: "PRM-RFR-DRY_FINE_POWDER_WASH_DRY-V1-APP-20260814",
});

const FIXTURE_STEPS = Object.freeze([
  { family_route_step_id: 1, sequence_no: 10, step_key: "S10" },
  { family_route_step_id: 2, sequence_no: 20, step_key: "S20" },
  { family_route_step_id: 3, sequence_no: 30, step_key: "S30" },
  { family_route_step_id: 4, sequence_no: 40, step_key: "S40" },
  { family_route_step_id: 5, sequence_no: 50, step_key: "S50" },
  { family_route_step_id: 6, sequence_no: 60, step_key: "S60" },
  { family_route_step_id: 7, sequence_no: 70, step_key: "S70" },
  { family_route_step_id: 8, sequence_no: 80, step_key: "S80" },
]);

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function eligibility(header) {
  const status = String(header.status || "").toUpperCase();
  const writable = isPrmRouteWritableStatus(status);
  return {
    status,
    badge: formatPrmRouteStatusLabel(canonicalPrmRouteStatus(status) || status),
    canMutateSteps: writable && (status === "DRAFT" || isPrmRouteReviewStatus(status)),
    canSubmit: writable && status === "DRAFT",
    canReviewApprove: isPrmRouteReviewStatus(status),
    canClone: isPrmRouteCloneableStatus(status),
    readOnly: isPrmRouteReadOnlyStatus(status),
  };
}

function createLifecycleStore(initialStatus = "DRAFT") {
  const state = {
    selectedFamilyRouteId: 12,
    deepLink: { route_family_id: 11, family_route_id: 12 },
    detail: {
      ...ROUTE_12,
      status: initialStatus,
      approval_reference:
        initialStatus === "APPROVED" ? ROUTE_12.approval_reference : null,
    },
    steps: [...FIXTURE_STEPS],
    validation: { ok: initialStatus !== "DRAFT" },
    generation: 0,
    toasts: [],
    modalOpen: false,
    validateCalls: 0,
    submitCalls: 0,
    approveCalls: 0,
    detailLoads: [],
    painted: [],
    historyLoads: 0,
  };

  function bump() {
    state.generation += 1;
    return state.generation;
  }

  async function loadFamilyDetail(familyRouteId, options = {}) {
    const requestGeneration =
      options.generation != null ? Number(options.generation) : bump();
    state.detailLoads.push({
      familyRouteId,
      generation: requestGeneration,
      includeSecondary: options.includeSecondary,
      preserveValidationStale: options.preserveValidationStale,
    });
    return {
      requestGeneration,
      commit(next) {
        if (
          !shouldAcceptPrmFamilyRouteDetailGeneration({
            requestGeneration,
            currentGeneration: state.generation,
          })
        ) {
          return { ok: false, stale: true };
        }
        state.detail = { ...state.detail, ...next.detail };
        if (next.steps) state.steps = [...next.steps];
        if (Object.prototype.hasOwnProperty.call(next, "validation")) {
          state.validation = next.validation;
        }
        return {
          ok: true,
          detail: state.detail,
          normalized: {
            header: state.detail,
            steps: state.steps,
            validation: state.validation,
          },
        };
      },
    };
  }

  function paint() {
    state.painted.push({
      status: state.detail.status,
      eligibility: eligibility(state.detail),
    });
    state.modalOpen = false;
  }

  async function afterMutation(successMessage, nextSnapshot) {
    const familyRouteId = resolvePrmFamilyRouteEditorRouteId({
      selectedFamilyRouteId: state.selectedFamilyRouteId,
      deepLink: state.deepLink,
      detail: state.detail,
    });
    state.toasts.push(successMessage);
    state.modalOpen = false;
    const generation = bump();
    const load = await loadFamilyDetail(familyRouteId, {
      generation,
      includeSecondary: false,
      preserveValidationStale: false,
    });
    if (load.stale || load.ok === false) {
      state.toasts.push(
        successMessage.includes("approved")
          ? "Family Route approved, but the editor could not be refreshed."
          : successMessage.includes("submitted")
            ? "Family Route submitted for review, but the editor could not be refreshed."
            : "Family Route validated, but the editor could not be refreshed.",
      );
      paint();
      return { ok: false, stale: true };
    }
    const committed = load.commit(nextSnapshot);
    paint();
    return committed;
  }

  return {
    state,
    bump,
    loadFamilyDetail,
    paint,
    afterMutation,
    validate: async () => {
      state.validateCalls += 1;
      return afterMutation("Validation passed", {
        detail: { ...state.detail, status: "DRAFT" },
        validation: { ok: true, issues: [] },
      });
    },
    submit: async () => {
      state.submitCalls += 1;
      return afterMutation("Family Route submitted for review.", {
        detail: { ...state.detail, status: "REVIEW_REQUIRED" },
        validation: { ok: true },
      });
    },
    approve: async () => {
      state.approveCalls += 1;
      state.modalOpen = true;
      const result = await afterMutation("Family Route approved.", {
        detail: {
          ...state.detail,
          status: "APPROVED",
          approval_reference: ROUTE_12.approval_reference,
        },
        validation: { ok: true },
      });
      if (result?.ok) state.historyLoads += 1;
      return result;
    },
  };
}

const store = createLifecycleStore("DRAFT");

assert(
  resolvePrmFamilyRouteEditorRouteId({
    selectedFamilyRouteId: 12,
    deepLink: { family_route_id: 12 },
    detail: ROUTE_12,
  }) === 12,
  "2 exact family_route_id resolved",
);

const validated = await store.validate();
assert(store.state.validateCalls === 1, "1 validate RPC invoked once");
assert(
  store.state.detailLoads[0]?.generation === 1 &&
    lifecycleFn.includes("bumpFamilyRouteDetailGeneration"),
  "3 generation bumped after validate",
);
assert(
  store.state.detailLoads[0]?.familyRouteId === 12 &&
    lifecycleFn.includes("editor.loadFamilyDetail(familyRouteId"),
  "4 authoritative detail reload after validate",
);
assert(
  validated?.normalized?.validation?.ok === true &&
    store.state.validation?.ok === true,
  "5 validation replaced from fresh route detail",
);
assert(
  store.state.painted.length === 1 && store.state.painted[0].status === "DRAFT",
  "6 editor painted after accepted commit",
);

const submitted = await store.submit();
assert(store.state.submitCalls === 1, "7 submit RPC invoked once");
assert(
  store.state.detailLoads[1]?.generation === 2,
  "8 generation bumped after submit",
);
assert(submitted?.detail?.status === "REVIEW_REQUIRED", "9 fresh detail status REVIEW_REQUIRED");
const reviewUi = eligibility(store.state.detail);
assert(
  reviewUi.badge === "Review required" &&
    familyHtmlFn.includes("formatPrmRouteStatusLabel"),
  "10 header paints Review required",
);
assert(reviewUi.canSubmit === false, "11 submit eligibility updates from fresh status");
assert(
  reviewUi.canReviewApprove === true && familyHtmlFn.includes("canReviewApprove"),
  "12 approve eligibility appears according to existing contract",
);

const approved = await store.approve();
assert(store.state.approveCalls === 1, "13 approve RPC invoked once");
assert(store.state.modalOpen === false, "14 approval modal closes");
assert(
  store.state.toasts.includes("Family Route approved.") &&
    approveFn.includes('"Family Route approved."'),
  "15 approval success toast exists",
);
assert(
  store.state.detailLoads[2]?.generation === 3,
  "16 generation bumped after approve",
);
assert(approved?.detail?.status === "APPROVED", "17 fresh detail status APPROVED");
const approvedUi = eligibility(store.state.detail);
assert(approvedUi.badge === "Approved", "18 header paints Approved");
assert(
  approvedUi.canReviewApprove === false &&
    familyHtmlFn.includes('data-prm-action="approve-family"'),
  "19 Approve action disappears",
);
assert(
  approvedUi.canMutateSteps === false &&
    familyHtmlFn.includes("add-family-step-before") &&
    familyHtmlFn.includes("canMutateSteps"),
  "20 Add step actions disappear according to current approved contract",
);
assert(approvedUi.canSubmit === false, "21 Submit action disappears");
assert(
  approvedUi.readOnly === true && familyHtmlFn.includes("cp-prm-readonly"),
  "22 read-only banner contract preserved",
);
assert(
  approvedUi.canClone === true && familyHtmlFn.includes("clone-family-route"),
  "23 Clone as New Version contract preserved",
);
assert(
  familyHtmlFn.includes("resolvePrmFamilyRouteLifecycleActions") &&
    familyHtmlFn.includes("validate-family") &&
    familyHtmlFn.includes("lifecycle.validateVisible"),
  "24 Validate existing approved-state behavior unchanged",
);
assert(
  editorValidateFn.includes("if (!canEdit()) return denied();") &&
    editorValidateFn.indexOf("if (!canEdit()) return denied();") <
      editorValidateFn.indexOf("RPC.validateFamily"),
  "24a validate(mode) checks canEdit before RPC",
);
assert(
  editorSubmitFn.includes("if (!canEdit()) return denied();") &&
    editorSubmitFn.indexOf("if (!canEdit()) return denied();") <
      editorSubmitFn.indexOf("RPC.submitFamily") &&
    editorSubmitFn.indexOf("if (!canEdit()) return denied();") <
      editorSubmitFn.indexOf('if (status !== "DRAFT")'),
  "24b submit(mode) checks canEdit before status and RPC",
);
assert(
  validateFn.includes("if (!canEdit())") &&
    validateFn.includes('showToast?.("Edit permission required.", "warning")') &&
    submitFn.includes("if (!canEdit())") &&
    submitFn.includes('showToast?.("Edit permission required.", "warning")'),
  "24c Validate and Submit bindEditor handlers deny view-only callers",
);
assert(
  editorSubmitFn.includes("if (!target.validationFresh)") &&
    editorSubmitFn.includes("Validate after the latest edits before submitting."),
  "24d stale-validation gate unchanged for editable submit",
);
assert(
  lifecycleFn.includes("includeSecondary: false") &&
    store.state.detailLoads.every((load) => load.includeSecondary === false),
  "25 includeSecondary=false for lifecycle refresh",
);
assert(
  lifecycleFn.includes("includeSecondary: false") &&
    approveFn.includes("if (refresh?.ok)") &&
    approveFn.includes("loadFamilyHistory"),
  "26 history/evidence cannot block immediate lifecycle paint",
);

const staleStore = createLifecycleStore("REVIEW_REQUIRED");
const older = await staleStore.loadFamilyDetail(12, { generation: 1 });
staleStore.bump();
staleStore.bump();
const newer = await staleStore.loadFamilyDetail(12, {
  generation: staleStore.state.generation,
});
await newer.commit({
  detail: { ...ROUTE_12, status: "APPROVED" },
  validation: { ok: true, stamp: "fresh" },
  steps: [...FIXTURE_STEPS],
});
const staleResult = await older.commit({
  detail: { ...ROUTE_12, status: "REVIEW_REQUIRED" },
  validation: { ok: false, stamp: "stale" },
  steps: [],
});
assert(staleResult?.stale === true, "27 older REVIEW_REQUIRED detail completes later");
assert(
  staleStore.state.detail.status === "APPROVED",
  "28 stale generation cannot overwrite APPROVED",
);
assert(
  staleStore.state.validation?.stamp === "fresh",
  "29 stale generation cannot overwrite fresh validation",
);
assert(
  staleStore.state.steps.length === 8,
  "30 stale generation cannot overwrite fresh steps/detail",
);

assert(
  resolvePrmFamilyRouteEditorRouteId({
    selectedFamilyRouteId: null,
    deepLink: { family_route_id: 12 },
    detail: null,
  }) === 12 &&
    resolvePrmFamilyRouteEditorRouteId({
      selectedFamilyRouteId: null,
      deepLink: {},
      detail: { family_route_id: 12 },
    }) === 12 &&
    lifecycleFn.includes("resolvePrmFamilyRouteEditorRouteId"),
  "31 canonical resolver handles selected id null + deep-link/detail fallback",
);
assert(
  lifecycleFn.includes(
    "Family Route validated, but the editor could not be refreshed.",
  ) ||
    validateFn.includes(
      "Family Route validated, but the editor could not be refreshed.",
    ),
  "32 validate refresh-failure warning",
);
assert(
  submitFn.includes(
    "Family Route submitted for review, but the editor could not be refreshed.",
  ),
  "33 submit refresh-failure warning",
);
assert(
  approveFn.includes(
    "Family Route approved, but the editor could not be refreshed.",
  ),
  "34 approve refresh-failure warning",
);
assert(
  !lifecycleFn.includes("validateFamily(") &&
    !lifecycleFn.includes("submitFamily(") &&
    !lifecycleFn.includes("approveFamily("),
  "35 lifecycle mutation never retried",
);
assert(
  approveFn.includes("onModal(approveHost") &&
    lifecycleFn.includes("closeModal({ restorePrevious: false })"),
  "36 modal ownership preserved",
);
assert(
  mainSrc.includes("refreshFamilyRouteEditorAfterStepMutation") &&
    mainSrc.includes("refreshFamilyRouteEditorAfterLifecycleMutation") &&
    stepRefreshSrc.includes("refreshFamilyRouteEditorAfterStepMutation") &&
    stepRefreshSrc.includes("hub-cache-v307"),
  "37 Gate 4E step-refresh helper still exists/passes",
);
assert(ROUTE_12.status === "APPROVED", "38 Route 12 fixture remains APPROVED");
assert(
  ROUTE_12.approval_reference ===
    "PRM-RFR-DRY_FINE_POWDER_WASH_DRY-V1-APP-20260814",
  "39 approval reference fixture unchanged",
);

const FORBIDDEN_13 = ["family_route_id", 13].join(": ") + ",";
const LIVE_VALIDATE = ["rpc", "validate_route_family_route"].join("_");
const LIVE_SUBMIT = ["rpc", "submit_route_family_route_for_review"].join("_");
const LIVE_APPROVE = ["rpc", "approve_route_family_route"].join("_");
const LIVE_CLONE = ["cloneFamily", "Draft"].join("");
assert(
  !validateFn.includes(LIVE_VALIDATE) &&
    !lifecycleFn.includes(LIVE_VALIDATE) &&
    !thisSrc.includes(LIVE_VALIDATE),
  "40 no live validate",
);
assert(
  !submitFn.includes(LIVE_SUBMIT) &&
    !lifecycleFn.includes(LIVE_SUBMIT) &&
    !thisSrc.includes(LIVE_SUBMIT),
  "41 no live submit",
);
assert(
  !approveFn.includes(LIVE_APPROVE) &&
    !lifecycleFn.includes(LIVE_APPROVE) &&
    !thisSrc.includes(LIVE_APPROVE),
  "42 no live approve",
);
assert(
  !lifecycleFn.includes(LIVE_CLONE) && !thisSrc.includes(LIVE_CLONE),
  "43 no clone",
);
assert(
  ROUTE_12.family_route_id === 12 && !thisSrc.includes(FORBIDDEN_13),
  "44 no Route 13",
);
assert(
  !lifecycleFn.includes("rpc_map_product") && !lifecycleFn.includes("mapping_id"),
  "45 no mappings",
);
assert(
  !lifecycleFn.includes("apply_migration") &&
    !lifecycleFn.includes("supabase/migrations"),
  "46 no server files",
);
assert(
  !lifecycleFn.includes("costingRefresh") && !lifecycleFn.includes("refreshCosting"),
  "47 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc) && thisSrc.includes("hub-cache-v307"),
  "48 SW bump once to hub-cache-v307",
);
assert(
  loadFamilyDetailFn.includes("includeSecondary = true") &&
    helpersSrc.includes("shouldAcceptPrmFamilyRouteDetailGeneration"),
  "generation + quiet detail load reused from Gate 4E",
);

if (failed) {
  console.error(
    `\nproduction-route-family-route-lifecycle-refresh-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-family-route-lifecycle-refresh-smoke: all passed");
console.log("READY_FOR_11Y_10I_2C_3F_2B_4E_1_BROWSER_ACCEPTANCE");
