/* eslint-env node */

/**
 * Controlled Karpooradi Product Details executor (product 262 only).
 *
 * Offline-safe orchestration with injectable adapters.
 * Live portal / mutating RPCs are never called from smokes.
 * No invented mark_failed / NEEDS_REVIEW server transitions.
 */

const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const {
  EXPECTED_PORTAL_PRODUCT_NAME,
  EXPECTED_APPROVED_COPY_NAME,
  assessRequiredFieldGate,
  resolvePermissionPurposeByExactLabel,
  buildFillPlan,
} = require("./product-details-field-map");
const { evaluateDuplicateGuard, DUPLICATE_OUTCOME } = require("./portal-duplicate-guard");
const { buildDependentClassificationSteps } = require("./portal-dom-fill");
const {
  createSaveMutex,
  classifySaveOutcome,
  SAVE_OUTCOME,
} = require("./portal-save-observe");
const {
  compareProductDetailsReread,
  toMarkPortalVerifiedReport,
  OVERALL_COMPARE,
} = require("./compare");

const PHASE = Object.freeze({
  PRECHECK: "PRECHECK",
  RUN_BEGIN: "RUN_BEGIN",
  FORM_FILLED: "FORM_FILLED",
  SAVE_REQUESTED: "SAVE_REQUESTED",
  SAVE_CONFIRMED: "SAVE_CONFIRMED",
  ENTERED_MARKED: "ENTERED_MARKED",
  REREAD_REQUESTED: "REREAD_REQUESTED",
  REREAD_RECEIVED: "REREAD_RECEIVED",
  COMPARE_COMPLETE: "COMPARE_COMPLETE",
  PORTAL_VERIFIED_MARKED: "PORTAL_VERIFIED_MARKED",
});

const globalSaveMutex = createSaveMutex();

function phaseLog(phases, id, detail) {
  phases.push({
    id,
    at: new Date().toISOString(),
    detail: detail || null,
  });
}

function assertPageGuards(pageState) {
  const s = pageState || {};
  if (s.workerState !== "READY") {
    return { ok: false, code: "WORKER_NOT_READY", message: "Browser worker must be READY." };
  }
  if (s.origin !== "https://www.e-aushadhi.gov.in") {
    return { ok: false, code: "WRONG_ORIGIN", message: "Portal origin mismatch." };
  }
  if (s.path !== "/admin/addproductforlegacy") {
    return { ok: false, code: "WRONG_PATH", message: "Portal path mismatch." };
  }
  const action = String(s.actiontype || "").toLowerCase();
  if (action && action !== "add" && action !== "new") {
    return { ok: false, code: "NOT_ADD_MODE", message: "Page is not in add/new mode." };
  }
  if (s.hiddenId != null && String(s.hiddenId).trim() !== "") {
    return { ok: false, code: "STALE_PRODUCT_ID", message: "Hidden #id is not empty." };
  }
  if (s.staleEditState === true) {
    return { ok: false, code: "STALE_EDIT_STATE", message: "Stale edit state detected." };
  }
  if (s.saveDataAvailable !== true) {
    return { ok: false, code: "SAVEDATA_UNAVAILABLE", message: "SaveData is not available." };
  }
  return { ok: true };
}

function buildPreviewModel({ productId, content, fieldGate, duplicate, pageGuard, contentHash, workflowRowVersion }) {
  const blockers = [];
  if (Number(productId) !== FIRST_CONTROLLED_PRODUCT_ID) {
    blockers.push("PRODUCT_LOCK_REJECTED");
  }
  if (fieldGate && !fieldGate.ok) blockers.push(fieldGate.code || "FIELD_GOVERNANCE_INCOMPLETE");
  if (duplicate && duplicate.ok === false) blockers.push(duplicate.outcome);
  if (pageGuard && pageGuard.ok === false) blockers.push(pageGuard.code);
  if (!contentHash) blockers.push("CONTENT_HASH_MISSING");

  return {
    productId: FIRST_CONTROLLED_PRODUCT_ID,
    productName: EXPECTED_PORTAL_PRODUCT_NAME,
    operation: "Create Product Details only",
    warning:
      "This action will write Product Details to the Government e-Aushadhi portal. It will NOT add Composition and will NOT final-submit the product.",
    lifecyclePath: "NOT_STARTED -> IN_PROGRESS -> ENTERED -> PORTAL_VERIFIED (stop)",
    classification: content?.classification || null,
    fieldSummary: (fieldGate?.fields || [])
      .filter((f) => f.fill)
      .map((f) => ({ key: f.key, expected: f.expected })),
    governanceBlockers: fieldGate?.blockers || [],
    approvedFileName: EXPECTED_APPROVED_COPY_NAME,
    contentHash: contentHash || null,
    workflowRowVersion: workflowRowVersion || null,
    startEnabled: blockers.length === 0,
    blockers,
  };
}

/**
 * Pure preflight assessment used by UI preview and Start gating.
 * Does not call mutating RPCs.
 */
function assessProductDetailsPreflight(input = {}) {
  const productId = Number(input.productId);
  const content = input.content || null;
  const phases = [];
  phaseLog(phases, PHASE.PRECHECK, "begin");

  if (productId !== FIRST_CONTROLLED_PRODUCT_ID) {
    return {
      ok: false,
      code: "PRODUCT_LOCK_REJECTED",
      phases,
      preview: buildPreviewModel({
        productId,
        content,
        fieldGate: { ok: false, code: "PRODUCT_LOCK_REJECTED", fields: [], blockers: [] },
        contentHash: null,
      }),
    };
  }

  const entryStatus = String(content?.entry_status || input.entryStatus || "NOT_STARTED").toUpperCase();
  if (entryStatus !== "NOT_STARTED" && input.resume !== true) {
    return {
      ok: false,
      code: "ENTRY_NOT_STARTABLE",
      message: `entry_status ${entryStatus} is not startable without safe resume.`,
      phases,
    };
  }

  if (input.reviewStatus && String(input.reviewStatus).toUpperCase() !== "VERIFIED") {
    return { ok: false, code: "WORKFLOW_NOT_VERIFIED", phases };
  }
  if (input.classificationVerified === false) {
    return { ok: false, code: "CLASSIFICATION_NOT_VERIFIED", phases };
  }
  if (input.isReadyForEntry === false) {
    return { ok: false, code: "NOT_READY", phases };
  }

  const gateOptions = {
    approvedFileName: input.approvedFileName,
    fieldGovernanceOverrides: input.fieldGovernanceOverrides || null,
  };
  const fieldGate = assessRequiredFieldGate(content, gateOptions);
  const duplicate = input.duplicateSearch
    ? evaluateDuplicateGuard(input.duplicateSearch)
    : { ok: false, outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE, message: "Duplicate search not provided." };
  const pageGuard = input.pageState ? assertPageGuards(input.pageState) : { ok: true, skipped: true };

  const preview = buildPreviewModel({
    productId,
    content,
    fieldGate,
    duplicate,
    pageGuard: pageGuard.skipped ? null : pageGuard,
    contentHash: input.contentHash || content?.content_hash || null,
    workflowRowVersion: input.workflowRowVersion || content?.versions?.workflow_row_version,
  });

  const ok =
    fieldGate.ok &&
    duplicate.ok === true &&
    duplicate.outcome === DUPLICATE_OUTCOME.NONE &&
    (pageGuard.ok === true || pageGuard.skipped === true) &&
    Boolean(preview.contentHash);

  return {
    ok,
    code: ok ? "PREFLIGHT_PASS" : preview.blockers[0] || "PREFLIGHT_BLOCKED",
    message: ok
      ? "Preflight passed (Start still requires explicit user confirmation)."
      : "Preflight blocked; Start Product Details remains disabled.",
    phases,
    fieldGate,
    duplicate,
    pageGuard,
    preview,
    fillPlan: buildFillPlan(content, gateOptions),
  };
}

/**
 * Execute controlled Product Details create using injected adapters only.
 * adapters may include: runBegin, markEntered, markPortalVerified, fillForm, saveOnce, reread, resolveFile
 * Smokes must inject mocks; never hit live portal.
 */
async function executeProductDetails(input = {}, adapters = {}) {
  return globalSaveMutex.runExclusive(async () => {
    const phases = [];
    const preflight = assessProductDetailsPreflight(input);
    phaseLog(phases, PHASE.PRECHECK, preflight.code);
    if (!preflight.ok) {
      return {
        ok: false,
        code: preflight.code,
        message: preflight.message,
        phases,
        preflight,
        mutated: false,
        runBegun: false,
      };
    }
    if (input.userConfirmed !== true) {
      return {
        ok: false,
        code: "USER_CONFIRMATION_REQUIRED",
        message: "Explicit Start confirmation is required.",
        phases,
        preflight,
        mutated: false,
        runBegun: false,
      };
    }
    if (input.finalContentHash && input.contentHash && input.finalContentHash !== input.contentHash) {
      return {
        ok: false,
        code: "CONTENT_HASH_DRIFT",
        message: "Content hash changed after preview; refusing run_begin.",
        phases,
        mutated: false,
        runBegun: false,
      };
    }

    const contentHash = input.finalContentHash || input.contentHash;
    const workflowRowVersion = input.workflowRowVersion;
    let runId = null;
    let portalProductId = null;

    if (typeof adapters.runBegin !== "function") {
      return {
        ok: false,
        code: "RUN_BEGIN_ADAPTER_MISSING",
        message: "run_begin adapter not provided (offline harness must inject mocks).",
        phases,
        mutated: false,
        runBegun: false,
      };
    }

    phaseLog(phases, PHASE.RUN_BEGIN, "before_first_dom_fill");
    const beginResult = await adapters.runBegin({
      productId: FIRST_CONTROLLED_PRODUCT_ID,
      expectedWorkflowRowVersion: workflowRowVersion,
      expectedContentHash: contentHash,
      expectedPayloadHash: input.payloadHash || null,
      startContext: {
        operation: "product_details_only",
        productName: EXPECTED_PORTAL_PRODUCT_NAME,
      },
    });
    runId = beginResult?.run_id || beginResult?.runId || null;
    if (!runId) {
      return {
        ok: false,
        code: "RUN_BEGIN_FAILED",
        message: "run_begin did not return run_id.",
        phases,
        mutated: false,
        runBegun: false,
      };
    }

    // First DOM fill only after run_begin.
    if (typeof adapters.fillForm === "function") {
      const permissionOpts = input.permissionOptions || [];
      const permissionField = (preflight.fillPlan.fields || []).find((f) => f.key === "permissionPurpose");
      if (permissionField?.fill) {
        const resolved = resolvePermissionPurposeByExactLabel(permissionField.expected, permissionOpts);
        if (!resolved.ok) {
          return {
            ok: false,
            code: resolved.code,
            message: "Permission Purpose exact-label resolution failed after run_begin; stop without Save.",
            phases,
            runId,
            runBegun: true,
            mutated: false,
            requiresReadOnlyReconciliation: true,
          };
        }
        permissionField.resolved = resolved;
      }
      await adapters.fillForm({
        fillPlan: preflight.fillPlan,
        classificationSteps: buildDependentClassificationSteps(preflight.fillPlan),
        permissionResolution: permissionField?.resolved || null,
      });
      phaseLog(phases, PHASE.FORM_FILLED, "ok");
    }

    phaseLog(phases, PHASE.SAVE_REQUESTED, "SaveData_once");
    if (typeof adapters.saveOnce !== "function") {
      return {
        ok: false,
        code: "SAVE_ADAPTER_MISSING",
        phases,
        runId,
        runBegun: true,
        mutated: false,
        requiresReadOnlyReconciliation: true,
      };
    }
    const saveObservation = await adapters.saveOnce();
    const saveClassified = classifySaveOutcome(saveObservation);
    phaseLog(phases, PHASE.SAVE_CONFIRMED, saveClassified.outcome);

    if (saveClassified.outcome !== SAVE_OUTCOME.SUCCESS) {
      return {
        ok: false,
        code:
          saveClassified.outcome === SAVE_OUTCOME.AMBIGUOUS
            ? "SAVE_AMBIGUOUS"
            : "SAVE_FAILED",
        message:
          saveClassified.outcome === SAVE_OUTCOME.AMBIGUOUS
            ? "Save outcome ambiguous; no retry create; reconcile read-only."
            : "Save failed; no retry create.",
        phases,
        runId,
        runBegun: true,
        mutated: saveObservation?.invoked === true,
        portalProductId: saveClassified.portalProductId,
        requiresReadOnlyReconciliation: true,
        // Intentionally no mark_failed RPC — none is supported in worker API.
        inventedFailureRpcCalled: false,
      };
    }

    portalProductId = saveClassified.portalProductId;

    if (typeof adapters.markEntered !== "function") {
      return {
        ok: false,
        code: "MARK_ENTERED_ADAPTER_MISSING",
        phases,
        runId,
        portalProductId,
        runBegun: true,
        mutated: true,
        requiresReadOnlyReconciliation: true,
      };
    }

    await adapters.markEntered({
      runId,
      expectedWorkflowRowVersion: beginResult.workflow_row_version || workflowRowVersion,
      expectedContentHash: contentHash,
      portalProductRef: portalProductId,
      enteredAudit: {
        saveReason: saveClassified.reason,
        phase: PHASE.SAVE_CONFIRMED,
      },
    });
    phaseLog(phases, PHASE.ENTERED_MARKED, portalProductId);

    phaseLog(phases, PHASE.REREAD_REQUESTED, portalProductId);
    if (typeof adapters.reread !== "function") {
      return {
        ok: false,
        code: "REREAD_ADAPTER_MISSING",
        phases,
        runId,
        portalProductId,
        runBegun: true,
        mutated: true,
      };
    }
    const retained = await adapters.reread({ portalProductId });
    phaseLog(phases, PHASE.REREAD_RECEIVED, "GetproductDataUpdate");

    const permissionField = (preflight.fillPlan.fields || []).find((f) => f.key === "permissionPurpose");
    const permissionResolved = permissionField?.resolved || null;
    const expectedCompare = {
      name: EXPECTED_PORTAL_PRODUCT_NAME,
      type: preflight.fillPlan.fields.find((f) => f.key === "type")?.expected,
      categoryId: preflight.fillPlan.fields.find((f) => f.key === "categoryId")?.expected,
      subTypeId: preflight.fillPlan.fields.find((f) => f.key === "subTypeId")?.expected,
      permissionPurpose: {
        label:
          permissionResolved?.resolvedLabel ||
          permissionResolved?.label ||
          permissionField?.expected ||
          null,
        value:
          permissionResolved?.resolvedPortalValue ||
          permissionResolved?.value ||
          null,
      },
      compositionTitle: preflight.fillPlan.fields.find((f) => f.key === "compositionTitle")?.expected,
      disease: preflight.fillPlan.fields.find((f) => f.key === "disease")?.expected,
      indications: preflight.fillPlan.fields.find((f) => f.key === "indications")?.expected,
      drugs: preflight.fillPlan.fields.find((f) => f.key === "drugs")?.expected,
      drugsValue: preflight.fillPlan.fields.find((f) => f.key === "drugsValue")?.expected,
      attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
    };

    const compareResult = compareProductDetailsReread(expectedCompare, retained);
    phaseLog(phases, PHASE.COMPARE_COMPLETE, compareResult.overall);

    if (compareResult.overall !== OVERALL_COMPARE.MATCH) {
      return {
        ok: false,
        code: `COMPARE_${compareResult.overall}`,
        message: "Retained reread compare did not MATCH; portal_verified not marked.",
        phases,
        runId,
        portalProductId,
        compareResult,
        markPortalVerifiedReport: toMarkPortalVerifiedReport(compareResult),
        runBegun: true,
        mutated: true,
      };
    }

    if (typeof adapters.markPortalVerified !== "function") {
      return {
        ok: false,
        code: "MARK_PORTAL_VERIFIED_ADAPTER_MISSING",
        phases,
        runId,
        portalProductId,
        compareResult,
        runBegun: true,
        mutated: true,
      };
    }

    await adapters.markPortalVerified({
      runId,
      expectedWorkflowRowVersion:
        beginResult.workflow_row_version || workflowRowVersion,
      expectedContentHash: contentHash,
      compareReport: toMarkPortalVerifiedReport(compareResult),
    });
    phaseLog(phases, PHASE.PORTAL_VERIFIED_MARKED, "stop_before_composition");

    return {
      ok: true,
      code: "PORTAL_VERIFIED",
      message: "Product Details portal-verified. Stopped before Composition and submit.",
      phases,
      runId,
      portalProductId,
      compareResult,
      runBegun: true,
      mutated: true,
      compositionExecuted: false,
      submitProductExecuted: false,
      inventedFailureRpcCalled: false,
    };
  });
}

/**
 * Resume safety: never auto-create. Read-only reconciliation only.
 */
function planResumeAction(context = {}) {
  return {
    mayCreate: false,
    action: "READ_ONLY_RECONCILE",
    useRunResume: context.runStatus === "RUNNING" || context.runStatus === "ENTERED",
    steps: [
      "reconcile_known_portal_id_if_any",
      "exact_name_duplicate_search",
      "inspect_server_run_state",
      "verify_content_hash",
      "never_auto_create",
    ],
    message: "Resume must reconcile read-only; create is forbidden.",
  };
}

module.exports = {
  PHASE,
  FIRST_CONTROLLED_PRODUCT_ID,
  EXPECTED_PORTAL_PRODUCT_NAME,
  assessProductDetailsPreflight,
  executeProductDetails,
  planResumeAction,
  assertPageGuards,
  buildPreviewModel,
  globalSaveMutex,
};
