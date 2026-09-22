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
const { evaluateDuplicateGuard, DUPLICATE_OUTCOME, deriveExactOnePortalProductId } = require("./portal-duplicate-guard");
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
  RUN_RESUME: "RUN_RESUME",
  FORM_FILLED: "FORM_FILLED",
  SAVE_REQUESTED: "SAVE_REQUESTED",
  SAVE_CONFIRMED: "SAVE_CONFIRMED",
  SAVE_AMBIGUOUS_MARKED: "SAVE_AMBIGUOUS_MARKED",
  ENTERED_MARKED: "ENTERED_MARKED",
  REREAD_REQUESTED: "REREAD_REQUESTED",
  REREAD_RECEIVED: "REREAD_RECEIVED",
  COMPARE_COMPLETE: "COMPARE_COMPLETE",
  PORTAL_VERIFIED_MARKED: "PORTAL_VERIFIED_MARKED",
});

const RESUME_ACTION = Object.freeze({
  CONTINUE_EXISTING_RUN: "CONTINUE_EXISTING_RUN",
  READ_ONLY_RECONCILE_EXACT_ONE: "READ_ONLY_RECONCILE_EXACT_ONE",
  STOP_NO_ACTIVE_RUN: "STOP_NO_ACTIVE_RUN",
  STOP_ACTIVE_RUN_AMBIGUOUS: "STOP_ACTIVE_RUN_AMBIGUOUS",
  STOP_DUPLICATE_AMBIGUOUS: "STOP_DUPLICATE_AMBIGUOUS",
  STOP_DUPLICATE_SEARCH_INCOMPLETE: "STOP_DUPLICATE_SEARCH_INCOMPLETE",
  STOP_DUPLICATE_COVERAGE_UNPROVEN: "STOP_DUPLICATE_COVERAGE_UNPROVEN",
  STOP_CONFLICTING_REFS: "STOP_CONFLICTING_REFS",
  STOP_AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY:
    "STOP_AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY",
  STOP: "STOP",
});

const globalSaveMutex = createSaveMutex();

function phaseLog(phases, id, detail) {
  phases.push({
    id,
    at: new Date().toISOString(),
    detail: detail || null,
  });
}

/**
 * Map known fill/attachment adapter failures to structured executor codes.
 * Prevents expected attachment failures from escaping as generic Worker IPC failed.
 */
function classifyFillFormFailure(error) {
  const msg = String(error?.message || error || "");
  const code = String(error?.code || "").trim();
  const humanUpload =
    "Approved Product Copy could not be applied to the portal upload control.";

  if (code === "APPROVED_COPY_NOT_APPLIED" || /APPROVED_COPY_NOT_APPLIED/.test(msg)) {
    return {
      code: "APPROVED_COPY_NOT_APPLIED",
      message: "Approved product copy was not proven on the upload control.",
    };
  }
  if (
    code === "APPROVED_COPY_LOCAL_PATH_MISSING" ||
    /approved_local_path_missing_for_upload/.test(msg)
  ) {
    return {
      code: "APPROVED_COPY_LOCAL_PATH_MISSING",
      message: "Approved product copy local path was missing for upload.",
    };
  }
  if (
    code === "APPROVED_COPY_LOCAL_FILE_MISSING" ||
    /APPROVED_COPY_LOCAL_FILE_MISSING/.test(msg)
  ) {
    return { code: "APPROVED_COPY_LOCAL_FILE_MISSING", message: humanUpload };
  }
  if (
    code === "APPROVED_COPY_LOCAL_FILE_NOT_REGULAR" ||
    /APPROVED_COPY_LOCAL_FILE_NOT_REGULAR/.test(msg)
  ) {
    return { code: "APPROVED_COPY_LOCAL_FILE_NOT_REGULAR", message: humanUpload };
  }
  if (
    code === "APPROVED_COPY_LOCAL_FILE_EMPTY" ||
    /APPROVED_COPY_LOCAL_FILE_EMPTY/.test(msg)
  ) {
    return { code: "APPROVED_COPY_LOCAL_FILE_EMPTY", message: humanUpload };
  }
  if (
    code === "APPROVED_COPY_LOCAL_FILE_READ_FAILED" ||
    /APPROVED_COPY_LOCAL_FILE_READ_FAILED/.test(msg)
  ) {
    return { code: "APPROVED_COPY_LOCAL_FILE_READ_FAILED", message: humanUpload };
  }
  if (
    code === "APPROVED_COPY_SET_INPUT_FILES_FAILED" ||
    /APPROVED_COPY_SET_INPUT_FILES_FAILED/.test(msg)
  ) {
    return { code: "APPROVED_COPY_SET_INPUT_FILES_FAILED", message: humanUpload };
  }
  if (code === "UPLOAD_ATTACHMENT_INPUT_MISSING" || /uploadAttachment_input_missing/.test(msg)) {
    return {
      code: "UPLOAD_ATTACHMENT_INPUT_MISSING",
      message: "Portal #uploadAttachment input was missing.",
    };
  }
  if (
    code === "PORTAL_PERMISSION_PURPOSE_CONTROL_MISSING" ||
    /PORTAL_PERMISSION_PURPOSE_CONTROL_MISSING/.test(msg)
  ) {
    return {
      code: "PORTAL_PERMISSION_PURPOSE_CONTROL_MISSING",
      message: "Portal Permission Purpose control did not become available after classification.",
    };
  }
  if (
    code === "PORTAL_PERMISSION_PURPOSE_NOT_READY" ||
    /PORTAL_PERMISSION_PURPOSE_NOT_READY/.test(msg)
  ) {
    return {
      code: "PORTAL_PERMISSION_PURPOSE_NOT_READY",
      message: "Portal Permission Purpose options did not become ready after classification.",
    };
  }
  if (
    code === "PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY" ||
    /PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY/.test(msg) ||
    /permissionPurpose match count\s*0/.test(msg)
  ) {
    return {
      code: "PORTAL_PERMISSION_PURPOSE_TARGET_NOT_READY",
      message:
        "Portal Permission Purpose exact target (Regular) did not become ready after classification.",
    };
  }
  if (
    code === "PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS" ||
    /PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS/.test(msg) ||
    /permissionPurpose match count\s*[2-9]/.test(msg)
  ) {
    return {
      code: "PORTAL_PERMISSION_PURPOSE_TARGET_AMBIGUOUS",
      message: "Portal Permission Purpose exact target matched more than one option.",
    };
  }
  if (
    code === "PORTAL_SHELFLIFE_CONTROL_MISSING" ||
    /PORTAL_SHELFLIFE_CONTROL_MISSING/.test(msg)
  ) {
    return {
      code: "PORTAL_SHELFLIFE_CONTROL_MISSING",
      message: "Portal Shelf Life control did not become available after classification.",
    };
  }
  if (
    code === "PORTAL_SHELFLIFE_TARGET_NOT_READY" ||
    /PORTAL_SHELFLIFE_TARGET_NOT_READY/.test(msg) ||
    /shelfmonth match count\s*0/.test(msg)
  ) {
    return {
      code: "PORTAL_SHELFLIFE_TARGET_NOT_READY",
      message:
        "Portal Shelf Life exact target (RegularAsPerClause) did not become visible and enabled.",
    };
  }
  if (
    code === "PORTAL_SHELFLIFE_TARGET_AMBIGUOUS" ||
    /PORTAL_SHELFLIFE_TARGET_AMBIGUOUS/.test(msg) ||
    /shelfmonth match count\s*[2-9]/.test(msg)
  ) {
    return {
      code: "PORTAL_SHELFLIFE_TARGET_AMBIGUOUS",
      message: "Portal Shelf Life exact target matched more than one visible radio.",
    };
  }
  if (
    code === "PORTAL_REQUIRED_CONTROL_MISSING" ||
    /PORTAL_REQUIRED_CONTROL_MISSING/.test(msg)
  ) {
    return {
      code: "PORTAL_REQUIRED_CONTROL_MISSING",
      message: "A required Product Details portal control did not become available after classification.",
    };
  }
  return {
    code: "FILL_FORM_FAILED",
    message: "Product Details form fill failed before Save.",
  };
}

const SAVE_AMBIGUOUS_MARKER_CODE = Object.freeze({
  MISSING: "SAVE_AMBIGUOUS_MARKER_MISSING",
  FAILED: "SAVE_AMBIGUOUS_MARKER_FAILED",
});

/**
 * Bounded, non-sensitive save evidence for the trusted AMBIGUOUS marker.
 * Category fields only — never HTML, response bodies, cookies or tokens.
 */
function buildBoundedSaveEvidence(saveClassified, saveObservation, phase) {
  const obs = saveObservation && typeof saveObservation === "object" ? saveObservation : {};
  const invokeCount = Number(obs.invokeCount);
  const httpStatus = Number(obs.status);
  const tri = (value) => (value === true ? true : value === false ? false : null);
  return {
    phase: phase || null,
    outcome: saveClassified?.outcome || null,
    reason: saveClassified?.reason || null,
    invoked: obs.invoked === true,
    invokeCount: Number.isFinite(invokeCount) ? invokeCount : null,
    settled: obs.settled === true,
    httpOk: tri(obs.httpOk),
    httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
    businessSuccess: tri(obs.businessSuccess),
    businessFailure: tri(obs.businessFailure),
    portalProductIdPresent: Boolean(saveClassified?.portalProductId),
  };
}

/**
 * Trusted live adapters MUST provide markSaveAmbiguous. AMBIGUOUS is never
 * reported to the caller unless the server-side marker was written first.
 * Never retries SaveData; never marks ENTERED.
 */
async function markSaveAmbiguousOrFail(adapters, args) {
  if (typeof adapters?.markSaveAmbiguous !== "function") {
    return {
      ok: false,
      code: SAVE_AMBIGUOUS_MARKER_CODE.MISSING,
      message:
        "Ambiguous Save cannot be recorded: markSaveAmbiguous adapter is missing. Reconcile read-only.",
    };
  }
  let result;
  try {
    result = await adapters.markSaveAmbiguous(args);
  } catch (error) {
    return {
      ok: false,
      code: SAVE_AMBIGUOUS_MARKER_CODE.FAILED,
      message: String(error?.message || error || "mark_save_ambiguous failed."),
    };
  }
  if (result && typeof result === "object" && result.ok === false) {
    return {
      ok: false,
      code: SAVE_AMBIGUOUS_MARKER_CODE.FAILED,
      message: String(result.message || "mark_save_ambiguous did not succeed."),
    };
  }
  return { ok: true, result: result ?? null };
}

/**
 * Server-returned workflow row version after mark_entered only.
 * Never infer +1 client-side; never fall back to begin/resume version.
 */
function extractEnteredWorkflowRowVersion(enteredResult) {
  const raw =
    enteredResult?.workflow_row_version ?? enteredResult?.workflowRowVersion ?? null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
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
  // Fresh Add pages may already carry a nonempty #id. Edit/stale state is
  // proven by actiontype (above) and/or explicit staleEditState — not by #id alone.
  if (s.staleEditState === true) {
    return { ok: false, code: "STALE_EDIT_STATE", message: "Stale edit state detected." };
  }
  if (s.saveDataAvailable !== true) {
    return { ok: false, code: "SAVEDATA_UNAVAILABLE", message: "SaveData is not available." };
  }
  return { ok: true };
}

function buildPreviewModel({
  productId,
  content,
  fieldGate,
  duplicate,
  pageGuard,
  contentHash,
  workflowRowVersion,
  resumeMode = false,
  resumeEnabled = false,
  resumeMessage = null,
}) {
  const blockers = [];
  if (Number(productId) !== FIRST_CONTROLLED_PRODUCT_ID) {
    blockers.push("PRODUCT_LOCK_REJECTED");
  }
  if (fieldGate && !fieldGate.ok) blockers.push(fieldGate.code || "FIELD_GOVERNANCE_INCOMPLETE");
  if (duplicate && duplicate.ok === false && !resumeMode) blockers.push(duplicate.outcome);
  if (pageGuard && pageGuard.ok === false) blockers.push(pageGuard.code);
  if (!contentHash) blockers.push("CONTENT_HASH_MISSING");

  return {
    productId: FIRST_CONTROLLED_PRODUCT_ID,
    productName: EXPECTED_PORTAL_PRODUCT_NAME,
    operation: resumeMode ? "Resume/reconcile Product Details" : "Create Product Details only",
    warning:
      "Karpooradi Thailam\nProduct 262\nProduct Details only\nWill write to Government e-Aushadhi portal\nWill NOT add Composition\nWill NOT final-submit",
    lifecyclePath: "NOT_STARTED -> IN_PROGRESS -> ENTERED -> PORTAL_VERIFIED (stop)",
    classification: content?.classification || null,
    fieldSummary: (fieldGate?.fields || [])
      .filter((f) => f.fill)
      .map((f) => ({ key: f.key, expected: f.expected })),
    governanceBlockers: fieldGate?.blockers || [],
    approvedFileName: EXPECTED_APPROVED_COPY_NAME,
    contentHash: contentHash || null,
    workflowRowVersion: workflowRowVersion || null,
    startEnabled: resumeMode ? false : blockers.length === 0,
    resumeEnabled: resumeMode ? resumeEnabled === true && blockers.length === 0 : false,
    resumeMessage: resumeMessage || null,
    blockers,
  };
}

function normalizePortalRef(value) {
  if (value == null) return "";
  return String(value).trim();
}

function extractPortalIdFromDuplicateMatch(match) {
  if (!match || typeof match !== "object") return null;
  // Authoritative identity: hid* parsed from edit HTML (or pre-attached portalProductId from guard).
  if (match.portalProductId != null) {
    const pre = String(match.portalProductId).trim();
    if (pre && pre !== "0" && pre !== "-1" && pre !== "262" && pre !== String(FIRST_CONTROLLED_PRODUCT_ID)) {
      return pre;
    }
  }
  const derived = deriveExactOnePortalProductId(match);
  if (derived.ok && derived.portalProductId) return String(derived.portalProductId);
  return null;
}

function buildExpectedCompare(preflight) {
  const permissionField = (preflight.fillPlan.fields || []).find((f) => f.key === "permissionPurpose");
  const permissionResolved = permissionField?.resolved || null;
  return {
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
    remarks: preflight.fillPlan.fields.find((f) => f.key === "remarks")?.expected,
    shelfmonth: preflight.fillPlan.fields.find((f) => f.key === "shelfmonth")?.expected,
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  };
}

/**
 * Pure preflight assessment used by UI preview and Start gating.
 * Does not call mutating RPCs.
 *
 * Production trusted path must set authorityMode: true so missing governance
 * never defaults to VERIFIED / READY / NOT_STARTED.
 * fieldGovernanceOverrides are ignored unless allowTestFieldGovernanceOverrides.
 */
function assessProductDetailsPreflight(input = {}) {
  const productId = Number(input.productId);
  const content = input.content || null;
  const phases = [];
  const authorityMode = input.authorityMode === true;
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

  let entryStatus = null;
  if (authorityMode) {
    if (input.entryStatus == null || String(input.entryStatus).trim() === "") {
      return {
        ok: false,
        code: "ENTRY_STATUS_UNKNOWN",
        message: "Authoritative entry_status is missing.",
        phases,
      };
    }
    entryStatus = String(input.entryStatus).toUpperCase();
  } else {
    entryStatus = String(content?.entry_status || input.entryStatus || "NOT_STARTED").toUpperCase();
  }
  if (entryStatus !== "NOT_STARTED" && input.resume !== true) {
    return {
      ok: false,
      code: "ENTRY_NOT_STARTABLE",
      message: `entry_status ${entryStatus} is not startable without safe resume.`,
      phases,
    };
  }

  if (authorityMode) {
    if (input.reviewStatus == null || String(input.reviewStatus).trim() === "") {
      return { ok: false, code: "WORKFLOW_STATUS_UNKNOWN", phases };
    }
    if (String(input.reviewStatus).toUpperCase() !== "VERIFIED") {
      return { ok: false, code: "WORKFLOW_NOT_VERIFIED", phases };
    }
    if (input.classificationVerified !== true) {
      return { ok: false, code: "CLASSIFICATION_NOT_VERIFIED", phases };
    }
    if (input.isReadyForEntry !== true) {
      return { ok: false, code: "NOT_READY", phases };
    }
    if (!input.pageState) {
      return { ok: false, code: "PAGE_STATE_UNKNOWN", phases };
    }
    if (!input.duplicateSearch) {
      return { ok: false, code: "DUPLICATE_SEARCH_UNKNOWN", phases };
    }
  } else {
    if (input.reviewStatus && String(input.reviewStatus).toUpperCase() !== "VERIFIED") {
      return { ok: false, code: "WORKFLOW_NOT_VERIFIED", phases };
    }
    if (input.classificationVerified === false) {
      return { ok: false, code: "CLASSIFICATION_NOT_VERIFIED", phases };
    }
    if (input.isReadyForEntry === false) {
      return { ok: false, code: "NOT_READY", phases };
    }
  }

  const allowOverrides = input.allowTestFieldGovernanceOverrides === true;
  const gateOptions = {
    approvedFileName: input.approvedFileName,
    fieldGovernanceOverrides: allowOverrides ? input.fieldGovernanceOverrides || null : null,
  };
  const fieldGate = assessRequiredFieldGate(content, gateOptions);
  const duplicate = input.duplicateSearch
    ? evaluateDuplicateGuard(input.duplicateSearch)
    : { ok: false, outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE, message: "Duplicate search not provided." };
  const pageGuard = input.pageState
    ? assertPageGuards(input.pageState)
    : authorityMode
      ? { ok: false, code: "PAGE_STATE_UNKNOWN" }
      : { ok: true, skipped: true };

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
    pageGuard.ok === true &&
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
 * Offline/test-only preflight that may inject fieldGovernanceOverrides.
 * Production trusted wrappers must never call this.
 */
function assessProductDetailsPreflightForTest(input = {}) {
  return assessProductDetailsPreflight({
    ...input,
    allowTestFieldGovernanceOverrides: true,
    authorityMode: false,
  });
}

/**
 * Execute controlled Product Details create using injected adapters only.
 * adapters may include: runBegin, markEntered, markPortalVerified, fillForm, saveOnce, reread, resolveFile
 * Smokes must inject mocks; never hit live portal.
 */
async function executeProductDetails(input = {}, adapters = {}) {
  return globalSaveMutex.runExclusive(async () => {
    const phases = [];
    const preflightInput =
      input.allowTestFieldGovernanceOverrides === true
        ? input
        : { ...input, fieldGovernanceOverrides: null, allowTestFieldGovernanceOverrides: false };
    const preflight = assessProductDetailsPreflight(preflightInput);
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
      try {
        await adapters.fillForm({
          fillPlan: preflight.fillPlan,
          classificationSteps: buildDependentClassificationSteps(preflight.fillPlan),
          permissionResolution: permissionField?.resolved || null,
        });
      } catch (error) {
        const classified = classifyFillFormFailure(error);
        return {
          ok: false,
          code: classified.code,
          message: classified.message,
          phases,
          runId,
          runBegun: true,
          mutated: true,
          requiresReadOnlyReconciliation: true,
          inventedFailureRpcCalled: false,
        };
      }
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

    if (saveClassified.outcome === SAVE_OUTCOME.AMBIGUOUS) {
      const marker = await markSaveAmbiguousOrFail(adapters, {
        runId,
        expectedWorkflowRowVersion:
          beginResult.workflow_row_version || workflowRowVersion,
        expectedContentHash: contentHash,
        saveEvidence: buildBoundedSaveEvidence(
          saveClassified,
          saveObservation,
          PHASE.SAVE_CONFIRMED,
        ),
      });
      if (!marker.ok) {
        return {
          ok: false,
          code: marker.code,
          message: marker.message,
          phases,
          runId,
          runBegun: true,
          mutated: saveObservation?.invoked === true,
          portalProductId: saveClassified.portalProductId,
          requiresReadOnlyReconciliation: true,
          markerOk: false,
          lastSaveOutcome: "AMBIGUOUS",
          inventedFailureRpcCalled: false,
        };
      }
      phaseLog(phases, PHASE.SAVE_AMBIGUOUS_MARKED, saveClassified.reason);
      return {
        ok: false,
        code: "SAVE_AMBIGUOUS",
        message: "Save outcome ambiguous; no retry create; reconcile read-only.",
        phases,
        runId,
        runBegun: true,
        mutated: saveObservation?.invoked === true,
        portalProductId: saveClassified.portalProductId,
        requiresReadOnlyReconciliation: true,
        markerOk: true,
        lastSaveOutcome: "AMBIGUOUS",
        // Intentionally no mark_failed RPC — none is supported in worker API.
        inventedFailureRpcCalled: false,
      };
    }

    if (saveClassified.outcome !== SAVE_OUTCOME.SUCCESS) {
      return {
        ok: false,
        code: "SAVE_FAILED",
        message: "Save failed; no retry create.",
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
    if (
      !portalProductId ||
      String(portalProductId).trim() === "" ||
      String(portalProductId).trim() === "262"
    ) {
      // Explicit ENTERED guard: never mark ENTERED without proven portal id.
      // Internal product 262 must never be accepted as portal product id.
      return {
        ok: false,
        code: "PORTAL_ID_UNPROVEN",
        message: "Save did not prove a portal product id; ENTERED refused; reconcile read-only.",
        phases,
        runId,
        runBegun: true,
        mutated: true,
        portalProductId: null,
        requiresReadOnlyReconciliation: true,
        inventedFailureRpcCalled: false,
      };
    }

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

    const enteredResult = await adapters.markEntered({
      runId,
      expectedWorkflowRowVersion: beginResult.workflow_row_version || workflowRowVersion,
      expectedContentHash: contentHash,
      portalProductRef: portalProductId,
      enteredAudit: {
        saveReason: saveClassified.reason,
        phase: PHASE.SAVE_CONFIRMED,
        hiddenIdBefore: saveClassified.hiddenIdBefore || null,
        hiddenIdAfter: saveClassified.hiddenIdAfter || null,
        // Fill-time exact approved copy proof — not re-proven via #uploadAttachment after reread.
        approvedCopyFileName: EXPECTED_APPROVED_COPY_NAME,
        approvedCopyProof: "fill_time_exact_v01",
      },
    });
    phaseLog(phases, PHASE.ENTERED_MARKED, portalProductId);

    const enteredWorkflowRowVersion = extractEnteredWorkflowRowVersion(enteredResult);
    if (enteredWorkflowRowVersion == null) {
      return {
        ok: false,
        code: "ENTERED_ROW_VERSION_UNPROVEN",
        message:
          "mark_entered succeeded but did not return a workflow row version; portal_verified refused.",
        phases,
        runId,
        portalProductId,
        runBegun: true,
        mutated: true,
        requiresReadOnlyReconciliation: true,
        inventedFailureRpcCalled: false,
      };
    }

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

    const expectedCompare = buildExpectedCompare(preflight);

    const compareResult = compareProductDetailsReread(expectedCompare, retained, {
      approvedCopyRereadUnavailable: true,
    });
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
      expectedWorkflowRowVersion: enteredWorkflowRowVersion,
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
 * Resume safety: never auto-create. Classifies continue vs reconcile vs stop.
 */
function planResumeAction(context = {}) {
  const base = {
    mayCreate: false,
    useRunResume: false,
    resumeEnabled: false,
    continueCreateOnSameRun: false,
  };

  const entryStatus =
    context.entryStatus != null ? String(context.entryStatus).toUpperCase() : null;
  const activeRunCount = Number(
    context.activeRunCount ?? context.active_run_count ?? 0,
  );
  const activeRun = context.activeRun || context.active_run || null;
  const runStatusRaw =
    activeRun?.run_status ??
    activeRun?.runStatus ??
    context.runStatus ??
    null;
  const runStatus = runStatusRaw != null ? String(runStatusRaw).toUpperCase() : null;
  const workflowPortalRef = normalizePortalRef(
    context.workflowPortalRef ??
      context.workflow_portal_ref ??
      context.portalProductRef ??
      null,
  );
  const runPortalRef = normalizePortalRef(
    activeRun?.portal_product_ref ?? activeRun?.portalProductRef ?? null,
  );
  const duplicateOutcome =
    context.duplicateOutcome ??
    context.duplicate?.outcome ??
    (context.duplicateSearch
      ? evaluateDuplicateGuard(context.duplicateSearch).outcome
      : null);

  if (activeRunCount === 0) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_NO_ACTIVE_RUN,
      code: "RESUME_STOP_NO_ACTIVE_RUN",
      message: "No active worker run to resume or reconcile.",
    };
  }

  if (activeRunCount > 1) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_ACTIVE_RUN_AMBIGUOUS,
      code: "RESUME_STOP_ACTIVE_RUN_AMBIGUOUS",
      message: "Multiple active worker runs; manual reconciliation required.",
    };
  }

  if (workflowPortalRef && runPortalRef && workflowPortalRef !== runPortalRef) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_CONFLICTING_REFS,
      code: "RESUME_STOP_CONFLICTING_REFS",
      message: "Workflow and active-run portal refs conflict.",
    };
  }

  if (duplicateOutcome === DUPLICATE_OUTCOME.AMBIGUOUS) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_DUPLICATE_AMBIGUOUS,
      code: "RESUME_STOP_DUPLICATE_AMBIGUOUS",
      message: "Ambiguous duplicate search; resume/reconcile blocked.",
    };
  }

  if (duplicateOutcome === DUPLICATE_OUTCOME.SEARCH_INCOMPLETE) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_DUPLICATE_SEARCH_INCOMPLETE,
      code: "RESUME_STOP_DUPLICATE_SEARCH_INCOMPLETE",
      message: "Duplicate search incomplete; resume/reconcile blocked.",
    };
  }

  if (duplicateOutcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_DUPLICATE_COVERAGE_UNPROVEN,
      code: "RESUME_STOP_DUPLICATE_COVERAGE_UNPROVEN",
      message: "Duplicate search coverage unproven; resume/reconcile blocked.",
    };
  }

  const lastSaveOutcome = String(
    activeRun?.last_save_outcome ??
      activeRun?.lastSaveOutcome ??
      context.lastSaveOutcome ??
      context.last_save_outcome ??
      "",
  ).toUpperCase();

  // Ambiguous-save + EXACT_ONE must use dedicated identity recovery — never ordinary Resume/SaveData.
  if (
    lastSaveOutcome === "AMBIGUOUS" &&
    duplicateOutcome === DUPLICATE_OUTCOME.EXACT_ONE &&
    activeRunCount === 1
  ) {
    return {
      ...base,
      action: RESUME_ACTION.STOP_AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY,
      code: "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY",
      message:
        "Ambiguous Save left an exact portal identity. Use Recover Saved Portal Identity — ordinary Resume is blocked.",
    };
  }

  if (
    entryStatus === "IN_PROGRESS" &&
    activeRunCount === 1 &&
    runStatus === "RUNNING" &&
    !workflowPortalRef &&
    !runPortalRef &&
    duplicateOutcome === DUPLICATE_OUTCOME.NONE
  ) {
    return {
      ...base,
      action: RESUME_ACTION.CONTINUE_EXISTING_RUN,
      useRunResume: true,
      resumeEnabled: true,
      continueCreateOnSameRun: true,
      code: "RESUME_CONTINUE_EXISTING_RUN",
      message:
        "Interrupted Product Details run detected. Resume/reconcile the existing run.",
    };
  }

  if (
    duplicateOutcome === DUPLICATE_OUTCOME.EXACT_ONE &&
    activeRunCount === 1
  ) {
    return {
      ...base,
      action: RESUME_ACTION.READ_ONLY_RECONCILE_EXACT_ONE,
      resumeEnabled: true,
      code: "RESUME_READ_ONLY_RECONCILE_EXACT_ONE",
      message:
        "Exact portal duplicate found; reconcile read-only against the existing portal product.",
    };
  }

  return {
    ...base,
    action: RESUME_ACTION.STOP,
    code: "RESUME_STOP",
    message: "Resume/reconcile is not available for the current state.",
  };
}

/**
 * Resume/reconcile preflight — gates Resume action without mutating RPCs.
 */
function assessProductDetailsResumePreflight(input = {}) {
  const productId = Number(input.productId);
  const content = input.content || null;
  const phases = [];
  const authorityMode = input.authorityMode === true;
  phaseLog(phases, PHASE.PRECHECK, "resume_begin");

  if (productId !== FIRST_CONTROLLED_PRODUCT_ID) {
    return {
      ok: false,
      code: "PRODUCT_LOCK_REJECTED",
      phases,
      preview: buildPreviewModel({
        productId,
        content,
        resumeMode: true,
        resumeEnabled: false,
        resumeMessage: "Product lock rejected.",
      }),
    };
  }

  if (!authorityMode) {
    return {
      ok: false,
      code: "AUTHORITY_MODE_REQUIRED",
      message: "Resume preflight requires authoritative server evidence.",
      phases,
    };
  }

  const entryStatus =
    input.entryStatus != null ? String(input.entryStatus).toUpperCase() : null;
  if (!entryStatus) {
    return { ok: false, code: "ENTRY_STATUS_UNKNOWN", phases };
  }
  const reconcileOnly = entryStatus === "ENTERED";
  if (entryStatus !== "IN_PROGRESS" && !reconcileOnly) {
    return {
      ok: false,
      code: "ENTRY_NOT_RESUMABLE",
      message: `entry_status ${entryStatus} is not resumable.`,
      phases,
    };
  }

  const activeRunCount = Number(input.activeRunCount ?? 0);
  const activeRun = input.activeRun || null;
  const runId = activeRun?.run_id ?? activeRun?.runId ?? null;
  if (activeRunCount !== 1 || !runId) {
    return {
      ok: false,
      code: "ACTIVE_RUN_INVALID",
      message: "Resume requires exactly one active run with run_id.",
      phases,
    };
  }

  const resumePlan =
    input.resumePlan ||
    planResumeAction({
      entryStatus,
      activeRunCount,
      activeRun,
      workflowPortalRef: input.workflowPortalRef,
      duplicateOutcome: input.duplicateSearch
        ? evaluateDuplicateGuard(input.duplicateSearch).outcome
        : input.duplicateOutcome,
      duplicateSearch: input.duplicateSearch,
    });

  if (resumePlan.resumeEnabled !== true) {
    return {
      ok: false,
      code: resumePlan.code || "RESUME_NOT_ENABLED",
      message: resumePlan.message || "Resume/reconcile is not enabled.",
      phases,
      resumePlan,
      preview: buildPreviewModel({
        productId,
        content,
        resumeMode: true,
        resumeEnabled: false,
        resumeMessage: resumePlan.message,
      }),
    };
  }

  if (resumePlan.action === RESUME_ACTION.CONTINUE_EXISTING_RUN) {
    const runStatus = String(activeRun.run_status || activeRun.runStatus || "").toUpperCase();
    const wfRef = normalizePortalRef(input.workflowPortalRef);
    const runRef = normalizePortalRef(
      activeRun.portal_product_ref ?? activeRun.portalProductRef,
    );
    const duplicate = input.duplicateSearch
      ? evaluateDuplicateGuard(input.duplicateSearch)
      : { outcome: input.duplicateOutcome };
    if (
      runStatus !== "RUNNING" ||
      wfRef ||
      runRef ||
      duplicate.outcome !== DUPLICATE_OUTCOME.NONE
    ) {
      return {
        ok: false,
        code: "CONTINUE_PATH_BLOCKED",
        message: "Continue-existing-run path preconditions not met.",
        phases,
        resumePlan,
      };
    }
  }

  if (resumePlan.action === RESUME_ACTION.READ_ONLY_RECONCILE_EXACT_ONE) {
    const duplicate = input.duplicateSearch
      ? evaluateDuplicateGuard(input.duplicateSearch)
      : null;
    const portalId = extractPortalIdFromDuplicateMatch(duplicate?.matches?.[0]);
    if (duplicate?.outcome !== DUPLICATE_OUTCOME.EXACT_ONE || !portalId) {
      return {
        ok: false,
        code: "EXACT_ONE_RECONCILE_BLOCKED",
        message: "Exact-one reconcile requires one proven portal product id.",
        phases,
        resumePlan,
      };
    }
  }

  if (input.reviewStatus == null || String(input.reviewStatus).trim() === "") {
    return { ok: false, code: "WORKFLOW_STATUS_UNKNOWN", phases, resumePlan };
  }
  if (String(input.reviewStatus).toUpperCase() !== "VERIFIED") {
    return { ok: false, code: "WORKFLOW_NOT_VERIFIED", phases, resumePlan };
  }
  if (input.classificationVerified !== true) {
    return { ok: false, code: "CLASSIFICATION_NOT_VERIFIED", phases, resumePlan };
  }
  // Resume must NOT require is_ready_for_entry (NOT_STARTED-only). Use source readiness.
  if (input.compositionReviewComplete !== true) {
    return {
      ok: false,
      code: "COMPOSITION_REVIEW_INCOMPLETE",
      message: "Composition review is incomplete; resume blocked.",
      phases,
      resumePlan,
    };
  }
  if (input.dossierReady !== true) {
    return {
      ok: false,
      code: "DOSSIER_NOT_READY",
      message: "Dossier is not ready; resume blocked.",
      phases,
      resumePlan,
    };
  }
  if (Number(input.openBlockers) !== 0) {
    return {
      ok: false,
      code: "OPEN_BLOCKERS",
      message: "Open blockers remain; resume blocked.",
      phases,
      resumePlan,
    };
  }
  if (Number(input.openPortalIssues) !== 0) {
    return {
      ok: false,
      code: "OPEN_PORTAL_ISSUES",
      message: "Open portal issues remain; resume blocked.",
      phases,
      resumePlan,
    };
  }
  if (input.resumeSourceReady !== true) {
    return {
      ok: false,
      code: "RESUME_SOURCE_NOT_READY",
      message: "Resume source readiness is not proven; resume blocked.",
      phases,
      resumePlan,
    };
  }
  if (input.contentHashMatchesRunStart === false) {
    return {
      ok: false,
      code: "CONTENT_HASH_DRIFT",
      message: "Content hash differs from the active run start hash.",
      phases,
      resumePlan,
    };
  }
  if (!input.pageState) {
    return { ok: false, code: "PAGE_STATE_UNKNOWN", phases, resumePlan };
  }
  if (!input.duplicateSearch) {
    return { ok: false, code: "DUPLICATE_SEARCH_UNKNOWN", phases, resumePlan };
  }

  const allowOverrides = input.allowTestFieldGovernanceOverrides === true;
  const gateOptions = {
    approvedFileName: input.approvedFileName,
    fieldGovernanceOverrides: allowOverrides ? input.fieldGovernanceOverrides || null : null,
  };
  const fieldGate = assessRequiredFieldGate(content, gateOptions);
  const duplicate = evaluateDuplicateGuard(input.duplicateSearch);
  const pageGuard = assertPageGuards(input.pageState);
  const preview = buildPreviewModel({
    productId,
    content,
    fieldGate,
    duplicate,
    pageGuard,
    contentHash: input.contentHash || content?.content_hash || null,
    workflowRowVersion: input.workflowRowVersion || content?.versions?.workflow_row_version,
    resumeMode: true,
    resumeEnabled: true,
    resumeMessage: resumePlan.message,
  });

  const ok =
    fieldGate.ok &&
    pageGuard.ok === true &&
    Boolean(preview.contentHash) &&
    resumePlan.resumeEnabled === true;

  return {
    ok,
    code: ok ? "RESUME_PREFLIGHT_PASS" : preview.blockers[0] || "RESUME_PREFLIGHT_BLOCKED",
    message: ok
      ? "Resume preflight passed (Resume still requires explicit user confirmation)."
      : resumePlan.message || "Resume preflight blocked.",
    phases,
    fieldGate,
    duplicate,
    pageGuard,
    preview,
    fillPlan: buildFillPlan(content, gateOptions),
    resumePlan,
  };
}

/**
 * Read-only preflight for AMBIGUOUS+EXACT_ONE identity recovery.
 * Uses the same authoritative gates as Resume (field/page/fill/hash/source)
 * but MUST NOT depend on resumePlan.resumeEnabled — ordinary Resume stays blocked.
 */
function assessExactOneIdentityRecoveryPreflight(input = {}) {
  const productId = Number(input.productId);
  const content = input.content || null;
  const phases = [];
  phaseLog(phases, PHASE.PRECHECK, "exact_one_identity_recovery_begin");

  if (productId !== FIRST_CONTROLLED_PRODUCT_ID) {
    return { ok: false, code: "PRODUCT_LOCK_REJECTED", phases };
  }
  if (input.authorityMode !== true) {
    return {
      ok: false,
      code: "AUTHORITY_MODE_REQUIRED",
      message: "Identity recovery preflight requires authoritative server evidence.",
      phases,
    };
  }

  const entryStatus =
    input.entryStatus != null ? String(input.entryStatus).toUpperCase() : null;
  if (entryStatus !== "IN_PROGRESS") {
    return {
      ok: false,
      code: "ENTRY_NOT_RECOVERABLE",
      message: `entry_status ${entryStatus || "unknown"} is not recoverable.`,
      phases,
    };
  }

  const activeRunCount = Number(input.activeRunCount ?? 0);
  const activeRun = input.activeRun || null;
  const runId = activeRun?.run_id ?? activeRun?.runId ?? null;
  if (activeRunCount !== 1 || !runId) {
    return {
      ok: false,
      code: "ACTIVE_RUN_INVALID",
      message: "Identity recovery requires exactly one active run with run_id.",
      phases,
    };
  }

  const duplicateOutcome =
    input.duplicateOutcome ??
    (input.duplicateSearch
      ? evaluateDuplicateGuard(input.duplicateSearch).outcome
      : null);
  const resumePlan =
    input.resumePlan ||
    planResumeAction({
      entryStatus,
      activeRunCount,
      activeRun,
      workflowPortalRef: input.workflowPortalRef,
      duplicateOutcome,
      duplicateSearch: input.duplicateSearch,
    });

  // Ordinary Resume must remain blocked for this state.
  if (
    resumePlan.code !== "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY" &&
    resumePlan.action !==
      RESUME_ACTION.STOP_AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY
  ) {
    return {
      ok: false,
      code: "RECOVERY_STATE_MISMATCH",
      message:
        "Identity recovery preflight expects ordinary Resume to be blocked as AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY.",
      phases,
      resumePlan,
    };
  }
  if (resumePlan.resumeEnabled === true) {
    return {
      ok: false,
      code: "RECOVERY_RESUME_STILL_ENABLED",
      message: "Identity recovery refused: ordinary Resume must stay disabled.",
      phases,
      resumePlan,
    };
  }

  if (input.reviewStatus == null || String(input.reviewStatus).trim() === "") {
    return { ok: false, code: "WORKFLOW_STATUS_UNKNOWN", phases, resumePlan };
  }
  if (String(input.reviewStatus).toUpperCase() !== "VERIFIED") {
    return { ok: false, code: "WORKFLOW_NOT_VERIFIED", phases, resumePlan };
  }
  if (input.classificationVerified !== true) {
    return { ok: false, code: "CLASSIFICATION_NOT_VERIFIED", phases, resumePlan };
  }
  if (input.compositionReviewComplete !== true) {
    return {
      ok: false,
      code: "COMPOSITION_REVIEW_INCOMPLETE",
      message: "Composition review is incomplete; recovery blocked.",
      phases,
      resumePlan,
    };
  }
  if (input.dossierReady !== true) {
    return {
      ok: false,
      code: "DOSSIER_NOT_READY",
      message: "Dossier is not ready; recovery blocked.",
      phases,
      resumePlan,
    };
  }
  if (Number(input.openBlockers) !== 0) {
    return {
      ok: false,
      code: "OPEN_BLOCKERS",
      message: "Open blockers remain; recovery blocked.",
      phases,
      resumePlan,
    };
  }
  if (Number(input.openPortalIssues) !== 0) {
    return {
      ok: false,
      code: "OPEN_PORTAL_ISSUES",
      message: "Open portal issues remain; recovery blocked.",
      phases,
      resumePlan,
    };
  }
  if (input.resumeSourceReady !== true) {
    return {
      ok: false,
      code: "SOURCE_NOT_READY",
      message: "Source readiness is not proven; recovery blocked.",
      phases,
      resumePlan,
    };
  }
  if (input.contentHashMatchesRunStart !== true) {
    return {
      ok: false,
      code: "CONTENT_HASH_DRIFT",
      message: "Content hash match to the active run start is not proven.",
      phases,
      resumePlan,
    };
  }
  if (!input.pageState) {
    return { ok: false, code: "PAGE_STATE_UNKNOWN", phases, resumePlan };
  }
  if (!input.duplicateSearch) {
    return { ok: false, code: "DUPLICATE_SEARCH_UNKNOWN", phases, resumePlan };
  }

  const allowOverrides = input.allowTestFieldGovernanceOverrides === true;
  const gateOptions = {
    approvedFileName: input.approvedFileName,
    fieldGovernanceOverrides: allowOverrides ? input.fieldGovernanceOverrides || null : null,
  };
  const fieldGate = assessRequiredFieldGate(content, gateOptions);
  const duplicate = evaluateDuplicateGuard(input.duplicateSearch);
  const pageGuard = assertPageGuards(input.pageState);
  const fillPlan = buildFillPlan(content, gateOptions);
  const ok =
    fieldGate.ok === true &&
    pageGuard.ok === true &&
    Boolean(content?.content_hash || input.contentHash) &&
    duplicate.outcome === DUPLICATE_OUTCOME.EXACT_ONE;

  return {
    ok,
    code: ok ? "RECOVERY_PREFLIGHT_PASS" : fieldGate.code || pageGuard.code || "RECOVERY_PREFLIGHT_BLOCKED",
    message: ok
      ? "Identity recovery preflight passed (ordinary Resume remains blocked)."
      : "Identity recovery preflight blocked.",
    phases,
    fieldGate,
    duplicate,
    pageGuard,
    fillPlan,
    resumePlan,
    ordinaryResumeBlocked: true,
    ordinaryResumeBlockCode: "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY",
  };
}

/**
 * Execute interrupted-run resume/reconcile using injected adapters only.
 * Must never call run_begin — resume adapters must expose runResume instead.
 */
async function executeProductDetailsResume(input = {}, adapters = {}) {
  return globalSaveMutex.runExclusive(async () => {
    const phases = [];

    if (typeof adapters.runBegin === "function") {
      return {
        ok: false,
        code: "RESUME_HAS_RUN_BEGIN",
        message: "Resume execution structurally refuses runBegin adapter.",
        phases,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    if (typeof adapters.runResume !== "function") {
      return {
        ok: false,
        code: "RUN_RESUME_ADAPTER_MISSING",
        message: "run_resume adapter not provided.",
        phases,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    const preflightInput =
      input.allowTestFieldGovernanceOverrides === true
        ? { ...input, resume: true }
        : {
            ...input,
            resume: true,
            fieldGovernanceOverrides: null,
            allowTestFieldGovernanceOverrides: false,
          };
    const preflight = assessProductDetailsResumePreflight(preflightInput);
    phaseLog(phases, PHASE.PRECHECK, preflight.code);
    if (!preflight.ok) {
      return {
        ok: false,
        code: preflight.code,
        message: preflight.message,
        phases,
        preflight,
        resumePlan: preflight.resumePlan,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    if (input.userConfirmed !== true) {
      return {
        ok: false,
        code: "USER_CONFIRMATION_REQUIRED",
        message: "Explicit Resume confirmation is required.",
        phases,
        preflight,
        resumePlan: preflight.resumePlan,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    const activeRun = input.activeRun || null;
    const runId = activeRun?.run_id ?? activeRun?.runId ?? null;
    const startContentHash =
      activeRun?.start_content_hash ?? activeRun?.startContentHash ?? null;
    const contentHash = input.finalContentHash || input.contentHash;
    const workflowRowVersion = input.workflowRowVersion;
    const resumePlan = preflight.resumePlan;
    const entryStatus = String(input.entryStatus || "").toUpperCase();
    const runStatus = String(
      activeRun?.run_status ?? activeRun?.runStatus ?? "",
    ).toUpperCase();

    if (
      startContentHash &&
      contentHash &&
      String(startContentHash) !== String(contentHash)
    ) {
      return {
        ok: false,
        code: "CONTENT_HASH_DRIFT",
        message: "Content hash changed since run start; refusing run_resume.",
        phases,
        runId,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    phaseLog(phases, PHASE.RUN_RESUME, "before_resume_mutation");
    let resumeResult;
    try {
      resumeResult = await adapters.runResume({
        runId,
        expectedWorkflowRowVersion: workflowRowVersion,
        expectedContentHash: contentHash,
      });
    } catch (error) {
      const msg = String(error?.message || error || "");
      if (/content.*(changed|drift|hash)/i.test(msg)) {
        return {
          ok: false,
          code: "CONTENT_HASH_DRIFT",
          message: msg,
          phases,
          runId,
          mutated: false,
          runBegun: false,
          runResumed: false,
        };
      }
      return {
        ok: false,
        code: "RUN_RESUME_FAILED",
        message: msg || "run_resume failed.",
        phases,
        runId,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    const resumedRunId =
      resumeResult?.run_id ?? resumeResult?.runId ?? runId ?? null;
    if (!resumedRunId) {
      return {
        ok: false,
        code: "RUN_RESUME_FAILED",
        message: "run_resume did not return run_id.",
        phases,
        mutated: false,
        runBegun: false,
        runResumed: false,
      };
    }

    let portalProductId = null;

    if (resumePlan.action === RESUME_ACTION.CONTINUE_EXISTING_RUN) {
      if (typeof adapters.fillForm === "function") {
        const permissionOpts = input.permissionOptions || [];
        const permissionField = (preflight.fillPlan.fields || []).find(
          (f) => f.key === "permissionPurpose",
        );
        if (permissionField?.fill) {
          const resolved = resolvePermissionPurposeByExactLabel(
            permissionField.expected,
            permissionOpts,
          );
          if (!resolved.ok) {
            return {
              ok: false,
              code: resolved.code,
              message:
                "Permission Purpose exact-label resolution failed during resume; stop without Save.",
              phases,
              runId: resumedRunId,
              runBegun: false,
              runResumed: true,
              mutated: false,
              requiresReadOnlyReconciliation: true,
            };
          }
          permissionField.resolved = resolved;
        }
        let fillResult;
        try {
          fillResult = await adapters.fillForm({
            fillPlan: preflight.fillPlan,
            classificationSteps: buildDependentClassificationSteps(preflight.fillPlan),
            permissionResolution: permissionField?.resolved || null,
          });
        } catch (error) {
          const classified = classifyFillFormFailure(error);
          return {
            ok: false,
            code: classified.code,
            message: classified.message,
            phases,
            runId: resumedRunId,
            runBegun: false,
            runResumed: true,
            mutated: true,
            requiresReadOnlyReconciliation: true,
            inventedFailureRpcCalled: false,
          };
        }
        const approvedApplied =
          fillResult?.approvedCopyProof?.applied === true ||
          (typeof adapters.proveAttachment === "function" &&
            (await adapters.proveAttachment())?.applied === true);
        if (!approvedApplied) {
          return {
            ok: false,
            code: "APPROVED_COPY_NOT_APPLIED",
            message: "Approved product copy was not proven on the upload control.",
            phases,
            runId: resumedRunId,
            runBegun: false,
            runResumed: true,
            mutated: true,
            requiresReadOnlyReconciliation: true,
          };
        }
        phaseLog(phases, PHASE.FORM_FILLED, "resume_ok");
      }

      phaseLog(phases, PHASE.SAVE_REQUESTED, "SaveData_once_resume");
      if (typeof adapters.saveOnce !== "function") {
        return {
          ok: false,
          code: "SAVE_ADAPTER_MISSING",
          phases,
          runId: resumedRunId,
          runBegun: false,
          runResumed: true,
          mutated: false,
          requiresReadOnlyReconciliation: true,
        };
      }
      const saveObservation = await adapters.saveOnce();
      const saveClassified = classifySaveOutcome(saveObservation);
      phaseLog(phases, PHASE.SAVE_CONFIRMED, saveClassified.outcome);

      if (saveClassified.outcome === SAVE_OUTCOME.AMBIGUOUS) {
        const marker = await markSaveAmbiguousOrFail(adapters, {
          runId: resumedRunId,
          expectedWorkflowRowVersion:
            resumeResult?.workflow_row_version ?? workflowRowVersion,
          expectedContentHash: contentHash,
          saveEvidence: buildBoundedSaveEvidence(
            saveClassified,
            saveObservation,
            PHASE.RUN_RESUME,
          ),
        });
        if (!marker.ok) {
          return {
            ok: false,
            code: marker.code,
            message: marker.message,
            phases,
            runId: resumedRunId,
            runBegun: false,
            runResumed: true,
            mutated: saveObservation?.invoked === true,
            portalProductId: saveClassified.portalProductId,
            requiresReadOnlyReconciliation: true,
            markerOk: false,
            lastSaveOutcome: "AMBIGUOUS",
            inventedFailureRpcCalled: false,
          };
        }
        phaseLog(phases, PHASE.SAVE_AMBIGUOUS_MARKED, saveClassified.reason);
        return {
          ok: false,
          code: "SAVE_AMBIGUOUS",
          message: "Save outcome ambiguous during resume; reconcile read-only.",
          phases,
          runId: resumedRunId,
          runBegun: false,
          runResumed: true,
          mutated: saveObservation?.invoked === true,
          portalProductId: saveClassified.portalProductId,
          requiresReadOnlyReconciliation: true,
          markerOk: true,
          lastSaveOutcome: "AMBIGUOUS",
          inventedFailureRpcCalled: false,
        };
      }

      if (saveClassified.outcome !== SAVE_OUTCOME.SUCCESS) {
        return {
          ok: false,
          code: "SAVE_FAILED",
          message: "Save failed during resume; reconcile read-only.",
          phases,
          runId: resumedRunId,
          runBegun: false,
          runResumed: true,
          mutated: saveObservation?.invoked === true,
          portalProductId: saveClassified.portalProductId,
          requiresReadOnlyReconciliation: true,
          inventedFailureRpcCalled: false,
        };
      }

      portalProductId = saveClassified.portalProductId;
      if (
        !portalProductId ||
        String(portalProductId).trim() === "" ||
        String(portalProductId).trim() === "262"
      ) {
        return {
          ok: false,
          code: "PORTAL_ID_UNPROVEN",
          message: "Save did not prove a portal product id during resume.",
          phases,
          runId: resumedRunId,
          runBegun: false,
          runResumed: true,
          mutated: true,
          portalProductId: null,
          requiresReadOnlyReconciliation: true,
          inventedFailureRpcCalled: false,
        };
      }
    } else if (resumePlan.action === RESUME_ACTION.READ_ONLY_RECONCILE_EXACT_ONE) {
      portalProductId = extractPortalIdFromDuplicateMatch(
        preflight.duplicate?.matches?.[0],
      );
      if (!portalProductId) {
        return {
          ok: false,
          code: "RESUME_STOP",
          message: "Cannot safely reconcile: portal id missing from exact-one match.",
          phases,
          runId: resumedRunId,
          runBegun: false,
          runResumed: true,
          mutated: false,
        };
      }
    } else {
      return {
        ok: false,
        code: preflight.code || "RESUME_STOP",
        message: preflight.message || "Resume action blocked at execute boundary.",
        phases,
        runId: resumedRunId,
        runBegun: false,
        runResumed: true,
        mutated: false,
      };
    }

    const shouldMarkEntered =
      resumePlan.action === RESUME_ACTION.CONTINUE_EXISTING_RUN ||
      (resumePlan.action === RESUME_ACTION.READ_ONLY_RECONCILE_EXACT_ONE &&
        runStatus === "RUNNING" &&
        entryStatus === "IN_PROGRESS");

    let portalVerifiedWorkflowRowVersion = null;

    if (shouldMarkEntered) {
      if (typeof adapters.markEntered !== "function") {
        return {
          ok: false,
          code: "MARK_ENTERED_ADAPTER_MISSING",
          phases,
          runId: resumedRunId,
          portalProductId,
          runBegun: false,
          runResumed: true,
          mutated: resumePlan.action === RESUME_ACTION.CONTINUE_EXISTING_RUN,
          requiresReadOnlyReconciliation: true,
        };
      }
      const enteredResult = await adapters.markEntered({
        runId: resumedRunId,
        expectedWorkflowRowVersion:
          resumeResult?.workflow_row_version ?? workflowRowVersion,
        expectedContentHash: contentHash,
        portalProductRef: portalProductId,
        enteredAudit: {
          phase: resumePlan.action,
          resume: true,
          approvedCopyFileName: EXPECTED_APPROVED_COPY_NAME,
        },
      });
      phaseLog(phases, PHASE.ENTERED_MARKED, portalProductId);

      portalVerifiedWorkflowRowVersion = extractEnteredWorkflowRowVersion(enteredResult);
      if (portalVerifiedWorkflowRowVersion == null) {
        return {
          ok: false,
          code: "ENTERED_ROW_VERSION_UNPROVEN",
          message:
            "mark_entered succeeded but did not return a workflow row version; portal_verified refused.",
          phases,
          runId: resumedRunId,
          portalProductId,
          runBegun: false,
          runResumed: true,
          mutated: true,
          requiresReadOnlyReconciliation: true,
          inventedFailureRpcCalled: false,
        };
      }
    } else if (
      resumePlan.action === RESUME_ACTION.READ_ONLY_RECONCILE_EXACT_ONE &&
      entryStatus === "IN_PROGRESS" &&
      runStatus === "RUNNING" &&
      !portalProductId
    ) {
      return {
        ok: false,
        code: "RESUME_STOP",
        message: "Cannot safely mark ENTERED during exact-one reconcile.",
        phases,
        runId: resumedRunId,
        portalProductId,
        runBegun: false,
        runResumed: true,
        mutated: false,
      };
    } else {
      // Already ENTERED (or reconcile without markEntered): use trusted current
      // resume/preflight version — never invent +1 or reuse a prior IN_PROGRESS guess.
      portalVerifiedWorkflowRowVersion =
        extractEnteredWorkflowRowVersion(resumeResult) ??
        extractEnteredWorkflowRowVersion({
          workflow_row_version: workflowRowVersion,
        });
      if (portalVerifiedWorkflowRowVersion == null) {
        return {
          ok: false,
          code: "ENTERED_ROW_VERSION_UNPROVEN",
          message:
            "Trusted current workflow row version missing for portal_verified after ENTERED reconcile.",
          phases,
          runId: resumedRunId,
          portalProductId,
          runBegun: false,
          runResumed: true,
          mutated: false,
        };
      }
    }

    phaseLog(phases, PHASE.REREAD_REQUESTED, portalProductId);
    if (typeof adapters.reread !== "function") {
      return {
        ok: false,
        code: "REREAD_ADAPTER_MISSING",
        phases,
        runId: resumedRunId,
        portalProductId,
        runBegun: false,
        runResumed: true,
        mutated: shouldMarkEntered,
      };
    }
    const retained = await adapters.reread({ portalProductId });
    phaseLog(phases, PHASE.REREAD_RECEIVED, "GetproductDataUpdate");

    const expectedCompare = buildExpectedCompare(preflight);
    const compareResult = compareProductDetailsReread(expectedCompare, retained, {
      approvedCopyRereadUnavailable: true,
    });
    phaseLog(phases, PHASE.COMPARE_COMPLETE, compareResult.overall);

    if (compareResult.overall !== OVERALL_COMPARE.MATCH) {
      return {
        ok: false,
        code: `COMPARE_${compareResult.overall}`,
        message: "Retained reread compare did not MATCH; portal_verified not marked.",
        phases,
        runId: resumedRunId,
        portalProductId,
        compareResult,
        markPortalVerifiedReport: toMarkPortalVerifiedReport(compareResult),
        runBegun: false,
        runResumed: true,
        mutated: shouldMarkEntered,
      };
    }

    if (typeof adapters.markPortalVerified !== "function") {
      return {
        ok: false,
        code: "MARK_PORTAL_VERIFIED_ADAPTER_MISSING",
        phases,
        runId: resumedRunId,
        portalProductId,
        compareResult,
        runBegun: false,
        runResumed: true,
        mutated: shouldMarkEntered,
      };
    }

    await adapters.markPortalVerified({
      runId: resumedRunId,
      expectedWorkflowRowVersion: portalVerifiedWorkflowRowVersion,
      expectedContentHash: contentHash,
      compareReport: toMarkPortalVerifiedReport(compareResult),
    });
    phaseLog(phases, PHASE.PORTAL_VERIFIED_MARKED, "stop_before_composition");

    return {
      ok: true,
      code: "PORTAL_VERIFIED",
      message: "Product Details portal-verified via resume/reconcile. Stopped before Composition.",
      phases,
      runId: resumedRunId,
      portalProductId,
      compareResult,
      resumePlan,
      runBegun: false,
      runResumed: true,
      mutated: true,
      compositionExecuted: false,
      submitProductExecuted: false,
      inventedFailureRpcCalled: false,
    };
  });
}

module.exports = {
  PHASE,
  RESUME_ACTION,
  SAVE_AMBIGUOUS_MARKER_CODE,
  buildBoundedSaveEvidence,
  FIRST_CONTROLLED_PRODUCT_ID,
  EXPECTED_PORTAL_PRODUCT_NAME,
  assessProductDetailsPreflight,
  assessProductDetailsPreflightForTest,
  assessProductDetailsResumePreflight,
  assessExactOneIdentityRecoveryPreflight,
  executeProductDetails,
  executeProductDetailsResume,
  planResumeAction,
  assertPageGuards,
  buildPreviewModel,
  globalSaveMutex,
};
