/* eslint-env node */

const { buildOfflineCompositionExecutionPlan, PLAN_CODE } = require("./composition-offline-plan");

const PRODUCT_ID = 262;
const ACTIVE_RUNS = new Set(["SAVE_ARMED", "SAVE_CONFIRMED", "SAVE_AMBIGUOUS"]);
const PAGE_IDENTITY_FAILURE_CODES = new Set([
  "WORKER_NOT_READY",
  "COMPOSITION_WRONG_ORIGIN",
  "COMPOSITION_WRONG_ROUTE",
  "COMPOSITION_PRODUCT_TOKEN_MISSING",
  "COMPOSITION_PORTAL_TOKEN_MISMATCH",
  "COMPOSITION_MUTATION_MODE_NOT_ADD",
  "COMPOSITION_NATIVE_SAVE_UNAVAILABLE",
]);

function fail(code, message, extra = {}) {
  return { ok: false, code, message, mutated: false, ...extra };
}

function upper(value) {
  return String(value ?? "").toUpperCase();
}

function sourceId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function boundedPageIdentityFailureCode(value) {
  const code = String(value ?? "");
  return PAGE_IDENTITY_FAILURE_CODES.has(code) ? code : "COMPOSITION_PAGE_IDENTITY_FAILED";
}

function boundedRun(run) {
  if (!run || typeof run !== "object") return null;
  return {
    runId: run.run_id ?? null,
    targetSourceCompositionLineId: sourceId(run.target_source_composition_line_id),
    runStatus: upper(run.run_status),
    stageRowVersion: Number(run.current_stage_row_version) || null,
    workflowRowVersion: Number(run.workflow_row_version) || null,
    contentHash: run.content_hash || null,
  };
}

function targetFromContent(content, targetId) {
  const matches = Array.isArray(content?.composition)
    ? content.composition.filter(
        (line) => sourceId(line?.source_composition_line_id) === sourceId(targetId),
      )
    : [];
  return matches.length === 1 ? matches[0] : null;
}

function validateAuthority(authority) {
  if (!authority || authority.ok !== true) {
    return fail(
      authority?.code || "COMPOSITION_AUTHORITY_UNAVAILABLE",
      authority?.message || "Composition authority is unavailable.",
      { pageIdentityDiagnostics: authority?.pageIdentityDiagnostics || null },
    );
  }
  const preflight = authority.preflight;
  const content = authority.content;
  if (sourceId(preflight?.product_id) !== PRODUCT_ID) return fail("PRODUCT_LOCK_REJECTED", "Composition V1 accepts only Product 262.");
  if (Number(preflight?.workflow_row_version) !== Number(content?.workflow_row_version)) {
    return fail("WORKFLOW_VERSION_MISMATCH", "Composition workflow authority changed.");
  }
  if (!preflight?.content_hash || preflight.content_hash !== content?.content_hash) {
    return fail("CONTENT_HASH_MISMATCH", "Composition content hash authority changed.");
  }
  if (preflight?.ready !== true) return fail("COMPOSITION_NOT_READY", "Composition READY v1 is not satisfied.");
  if (!authority.pageIdentityEvidence || authority.portalListEvidence?.coverageComplete !== true) {
    return fail("COMPOSITION_EVIDENCE_INCOMPLETE", "Trusted page/list evidence is incomplete.");
  }
  return { ok: true };
}

function planAuthority(authority) {
  return buildOfflineCompositionExecutionPlan({
    governedSnapshot: authority.content,
    expectedContentHash: authority.preflight.content_hash,
    pageIdentityEvidence: authority.pageIdentityEvidence,
    portalListEvidence: authority.portalListEvidence,
  });
}

function previewProjection(authority, planner, liveArmed) {
  return {
    ok: planner.ok === true,
    code: planner.code,
    message: planner.ok ? "Composition preview complete." : "Composition preview is blocked.",
    liveArmed: liveArmed === true,
    mutationAllowed: false,
    productId: PRODUCT_ID,
    governedCount: planner.governedCount,
    portalCount: planner.portalCount,
    matchCount: planner.matches.length,
    matchedSourceLineIds: planner.matches.map((item) => item.sourceCompositionLineId),
    missingSourceLineIds: planner.missing.map((item) => item.sourceCompositionLineId),
    blockers: planner.blockers,
    stage: authority.preflight.stage || null,
    activeRun: boundedRun(authority.preflight.active_run),
    workflowRowVersion: Number(authority.preflight.workflow_row_version),
    contentHash: authority.preflight.content_hash,
    pageIdentityDiagnostics: authority.pageIdentityDiagnostics || null,
    startEnabled: false,
    recoveryEnabled: false,
    stageVerifyEnabled: false,
  };
}

function validateArmedResponse(armed, authority, requestedTarget) {
  const checks = [
    sourceId(armed?.product_id) === PRODUCT_ID,
    sourceId(armed?.target_source_composition_line_id) === requestedTarget,
    upper(armed?.run_status) === "SAVE_ARMED",
    Number(armed?.workflow_row_version) === Number(authority.preflight.workflow_row_version),
    armed?.content_hash === authority.preflight.content_hash,
    String(armed?.portal_product_ref ?? "") === String(authority.preflight.portal_product_ref ?? ""),
    typeof armed?.run_id === "string" && armed.run_id.length > 0,
    Number.isInteger(Number(armed?.stage_row_version)),
    armed?.target_projection && typeof armed.target_projection === "object",
  ];
  return checks.every(Boolean);
}

function classifySave(observation) {
  if (!observation || observation.invoked !== true || Number(observation.invokeCount) !== 1) {
    return { outcome: "REJECTED", reason: observation?.rejectionReason || "SAVE_NOT_INVOKED" };
  }
  if (
    observation.settled === true &&
    observation.transportSuccess === true &&
    observation.businessSuccess === true &&
    observation.responseParsed === true &&
    Number(observation.matchingRequestCount) === 1
  ) {
    return { outcome: "CONFIRMED", reason: "NATIVE_SUCCESS_CONFIRMED" };
  }
  if (observation.noMutationProven === true) {
    return { outcome: "REJECTED", reason: observation.rejectionReason || "NATIVE_NO_MUTATION_PROVEN" };
  }
  return { outcome: "AMBIGUOUS", reason: "SAVE_EFFECT_UNCERTAIN" };
}

function saveEvidence(observation, classification) {
  return {
    outcome: classification.outcome,
    reason: classification.reason,
    invoked: observation?.invoked === true,
    invokeCount: Number(observation?.invokeCount) || 0,
    settled: observation?.settled === true,
    transportSuccess: observation?.transportSuccess === true,
    businessSuccess: observation?.businessSuccess === true,
    responseParsed: observation?.responseParsed === true,
    matchingRequestCount: Number(observation?.matchingRequestCount) || 0,
    httpStatus: Number.isInteger(Number(observation?.httpStatus))
      ? Number(observation.httpStatus)
      : null,
  };
}

function findTargetMatch(planner, targetId) {
  return planner.matches.filter(
    (item) => sourceId(item?.sourceCompositionLineId) === sourceId(targetId),
  );
}

function recoveryDisposition(planner, targetId) {
  const matches = findTargetMatch(planner, targetId);
  const missing = planner.missing.filter(
    (item) => sourceId(item?.sourceCompositionLineId) === sourceId(targetId),
  );
  const clean =
    planner.ok === true &&
    planner.conflicts.length === 0 &&
    planner.duplicates.length === 0 &&
    planner.extras.length === 0 &&
    planner.blockers.length === 0;
  if (clean && matches.length === 1 && missing.length === 0) return "PRESENT_EXACT_ONE";
  if (clean && matches.length === 0 && missing.length === 1) return "ABSENT_PROVEN";
  return "UNCERTAIN";
}

function createCompositionExecutor() {
  let operationActive = false;
  const saveGuards = new Map();

  async function exclusive(task) {
    if (operationActive) return fail("COMPOSITION_OPERATION_IN_PROGRESS", "Another Composition operation is active.");
    operationActive = true;
    try {
      return await task();
    } finally {
      operationActive = false;
    }
  }

  async function collect(deps, options = {}) {
    if (typeof deps.loadAuthority !== "function") {
      return fail("COMPOSITION_ADAPTER_MISSING", "Trusted Composition adapter is unavailable.");
    }
    const authority = await deps.loadAuthority(options);
    const valid = validateAuthority(authority);
    if (!valid.ok) return valid;
    return { ok: true, authority, planner: planAuthority(authority) };
  }

  async function verifyFresh(deps, run, targetProjection) {
    const fresh = await collect(deps, { requireEditPermission: true, requireSaveCapability: false });
    if (!fresh.ok) return fresh;
    if (
      fresh.authority.preflight.content_hash !== run.contentHash ||
      Number(fresh.authority.preflight.workflow_row_version) !== Number(run.workflowRowVersion)
    ) {
      return fail("RUN_AUTHORITY_DRIFT", "Composition authority changed after Save.");
    }
    const matches = findTargetMatch(fresh.planner, run.targetId);
    const missing = fresh.planner.missing.filter(
      (item) => sourceId(item?.sourceCompositionLineId) === run.targetId,
    );
    if (matches.length !== 1 || missing.length !== 0) {
      return fail("TARGET_NOT_EXACTLY_VERIFIED", "Target is not exactly verified by the fresh planner.");
    }
    const rowId = matches[0].portalRowId;
    const reread = await deps.rereadRow(rowId);
    if (!reread?.ok || reread.row?.portalRowId !== rowId) {
      return fail("TARGET_REREAD_FAILED", "Native target reread failed.");
    }
    const verified = await deps.verifyRow({
      runId: run.runId,
      expectedStageRowVersion: run.stageRowVersion,
      expectedContentHash: run.contentHash,
      afterListEvidence: fresh.authority.portalListEvidence,
      rereadEvidence: reread.evidence,
      plannerReport: fresh.planner,
      resolvedPortalRowId: rowId,
    });
    return {
      ok: upper(verified?.run_status) === "ROW_VERIFIED",
      code: upper(verified?.run_status) === "ROW_VERIFIED" ? "ROW_VERIFIED" : "ROW_VERIFICATION_FAILED",
      message: upper(verified?.run_status) === "ROW_VERIFIED" ? "Composition row verified." : "Composition row verification failed.",
      mutated: false,
      runStatus: verified?.run_status || null,
      stageStatus: verified?.stage_status || null,
      stageRowVersion: verified?.stage_row_version || null,
      targetSourceCompositionLineId: run.targetId,
      targetProjectionUsed: targetProjection != null,
    };
  }

  async function preview(deps = {}) {
    if (Number(deps.productId) !== PRODUCT_ID) return fail("PRODUCT_LOCK_REJECTED", "Composition V1 accepts only Product 262.");
    const collected = await collect(deps, { requireEditPermission: false, requireSaveCapability: false });
    if (!collected.ok) return collected;
    return previewProjection(collected.authority, collected.planner, deps.liveArmed === true);
  }

  async function startLine(deps = {}, command = {}) {
    return exclusive(async () => {
      if (Number(deps.productId) !== PRODUCT_ID) return fail("PRODUCT_LOCK_REJECTED", "Composition V1 accepts only Product 262.");
      if (deps.liveArmed !== true) return fail("COMPOSITION_LIVE_NOT_ARMED", "Composition live execution is not armed.");
      if (command.userConfirmed !== true) return fail("USER_CONFIRMATION_REQUIRED", "Explicit Composition confirmation is required.");
      const targetId = sourceId(command.sourceCompositionLineId);
      if (!targetId) return fail("TARGET_LINE_INVALID", "A governed source line ID is required.");
      const collected = await collect(deps, { requireEditPermission: true, requireSaveCapability: true });
      if (!collected.ok) return collected;
      if (collected.authority.preflight.active_run) return fail("ACTIVE_RUN_EXISTS", "An active Composition run already exists.");
      if (collected.planner.code !== PLAN_CODE.OFFLINE_MISSING || collected.planner.mutationAllowed !== false) {
        return fail("PLANNER_NOT_ARM_ELIGIBLE", "Fresh Composition planner is not arm-eligible.");
      }
      const targetMissing = collected.planner.missing.filter(
        (item) => sourceId(item?.sourceCompositionLineId) === targetId,
      );
      if (targetMissing.length !== 1) return fail("TARGET_NOT_EXACTLY_MISSING", "Target is not exactly once in the missing set.");
      const armed = await deps.armRun({
        productId: PRODUCT_ID,
        targetSourceCompositionLineId: targetId,
        expectedWorkflowRowVersion: Number(collected.authority.preflight.workflow_row_version),
        expectedContentHash: collected.authority.preflight.content_hash,
        expectedStageRowVersion: collected.authority.preflight.stage?.row_version ?? null,
        pageIdentityEvidence: collected.authority.pageIdentityEvidence,
        beforeListEvidence: collected.authority.portalListEvidence,
        plannerReport: collected.planner,
      });
      if (!validateArmedResponse(armed, collected.authority, targetId)) {
        return fail("ARM_RESPONSE_INVALID", "Server SAVE_ARMED response failed trusted validation.");
      }
      const identityRecheck = await deps.recheckMutationIdentity(armed.portal_product_ref);
      if (!identityRecheck?.ok) {
        const identityFailureCode = boundedPageIdentityFailureCode(identityRecheck?.code);
        let rejected;
        try {
          rejected = await deps.recordSave({
            runId: armed.run_id,
            expectedStageRowVersion: Number(armed.stage_row_version),
            expectedContentHash: armed.content_hash,
            outcome: "REJECTED",
            saveEvidence: {
              outcome: "REJECTED",
              reason: "POST_ARM_IDENTITY_RECHECK_FAILED",
              identityFailureCode,
              invoked: false,
              invokeCount: 0,
              settled: true,
              noMutationProven: true,
            },
          });
        } catch {
          return fail(
            "COMPOSITION_POST_ARM_REJECTION_RECORD_FAILED",
            "Composition identity changed after SAVE_ARMED and the no-mutation rejection could not be recorded; the active run requires recovery.",
            { runStatus: "SAVE_ARMED" },
          );
        }
        if (upper(rejected?.run_status) !== "SAVE_REJECTED") {
          return fail(
            "COMPOSITION_POST_ARM_REJECTION_RECORD_FAILED",
            "Composition identity changed after SAVE_ARMED but the server did not confirm SAVE_REJECTED; the active run requires recovery.",
            { runStatus: upper(rejected?.run_status) || "SAVE_ARMED" },
          );
        }
        return fail(
          identityFailureCode,
          "Composition page identity changed after SAVE_ARMED.",
          {
            pageIdentityDiagnostics: identityRecheck?.diagnostics || null,
            runStatus: "SAVE_REJECTED",
          },
        );
      }
      await deps.fillTarget(armed.target_projection);
      const guard = saveGuards.get(armed.run_id) || { invoked: false, invokeCount: 0 };
      if (guard.invoked) return fail("SAVE_ALREADY_INVOKED", "Save was already invoked for this Composition run.");
      guard.invoked = true;
      guard.invokeCount += 1;
      saveGuards.set(armed.run_id, guard);
      let observation;
      try {
        observation = await deps.invokeSaveOnce(armed.run_id);
      } catch {
        observation = { invoked: true, invokeCount: 1, settled: false };
      }
      observation = { ...observation, invoked: true, invokeCount: guard.invokeCount };
      const classification = classifySave(observation);
      const recorded = await deps.recordSave({
        runId: armed.run_id,
        expectedStageRowVersion: Number(armed.stage_row_version),
        expectedContentHash: armed.content_hash,
        outcome: classification.outcome,
        saveEvidence: saveEvidence(observation, classification),
      });
      const run = {
        runId: armed.run_id,
        targetId,
        contentHash: armed.content_hash,
        workflowRowVersion: Number(armed.workflow_row_version),
        stageRowVersion: Number(recorded?.stage_row_version),
      };
      if (classification.outcome === "CONFIRMED") {
        const verified = await verifyFresh(deps, run, armed.target_projection);
        return {
          ...verified,
          mutated: observation.invoked === true,
          saveInvoked: observation.invoked === true,
          invokeCount: guard.invokeCount,
          saveOutcome: classification.outcome,
        };
      }
      return {
        ok: classification.outcome === "REJECTED",
        code: `SAVE_${classification.outcome}`,
        message: classification.outcome === "AMBIGUOUS" ? "Composition Save is ambiguous; it will not be retried." : "Composition Save was rejected with no-mutation proof.",
        mutated: observation.invoked === true,
        saveOutcome: classification.outcome,
        runStatus: recorded?.run_status || null,
        stageRowVersion: recorded?.stage_row_version || null,
      };
    });
  }

  async function recoverRun(deps = {}, command = {}) {
    return exclusive(async () => {
      if (Number(deps.productId) !== PRODUCT_ID) return fail("PRODUCT_LOCK_REJECTED", "Composition V1 accepts only Product 262.");
      if (command.userConfirmed !== true) return fail("USER_CONFIRMATION_REQUIRED", "Explicit recovery confirmation is required.");
      const collected = await collect(deps, { requireEditPermission: true, requireSaveCapability: false });
      if (!collected.ok) return collected;
      const active = boundedRun(collected.authority.preflight.active_run);
      if (!active || active.runId !== command.runId || !ACTIVE_RUNS.has(active.runStatus)) {
        return fail("RECOVERY_RUN_NOT_ACTIVE", "Requested Composition run is not the trusted active run.");
      }
      if (!["SAVE_ARMED", "SAVE_AMBIGUOUS"].includes(active.runStatus)) {
        return fail("RECOVERY_STATUS_BLOCKED", "Run status is not read-only recoverable.");
      }
      const target = targetFromContent(collected.authority.content, active.targetSourceCompositionLineId);
      if (!target) return fail("RECOVERY_TARGET_UNAVAILABLE", "Governed target projection is unavailable.");
      const disposition = recoveryDisposition(collected.planner, active.targetSourceCompositionLineId);
      let stageVersion = active.stageRowVersion;
      if (active.runStatus === "SAVE_ARMED") {
        const outcome = disposition === "ABSENT_PROVEN" ? "REJECTED" : "AMBIGUOUS";
        const recorded = await deps.recordSave({
          runId: active.runId,
          expectedStageRowVersion: active.stageRowVersion,
          expectedContentHash: active.contentHash,
          outcome,
          saveEvidence: {
            outcome,
            reason:
              disposition === "PRESENT_EXACT_ONE"
                ? "RECOVERY_COMPLETE_LIST_TARGET_PRESENT"
                : disposition === "ABSENT_PROVEN"
                  ? "RECOVERY_COMPLETE_LIST_TARGET_ABSENT"
                  : "RECOVERY_COMPLETE_LIST_TARGET_UNCERTAIN",
            invoked: false,
            invokeCount: 0,
            settled: true,
            coverageComplete: true,
          },
        });
        stageVersion = Number(recorded?.stage_row_version);
        if (outcome === "REJECTED") {
          return { ok: true, code: "SAVE_REJECTED", message: "Complete list proves the interrupted target is absent.", mutated: false, runStatus: recorded?.run_status || null };
        }
        if (disposition !== "PRESENT_EXACT_ONE") {
          return fail("SAVE_AMBIGUOUS", "Interrupted Save remains ambiguous; no Save was retried.", { runStatus: recorded?.run_status || null });
        }
      } else if (disposition !== "PRESENT_EXACT_ONE") {
        return fail("SAVE_AMBIGUOUS", "Ambiguous run is not yet exactly recoverable.");
      }
      return verifyFresh(
        deps,
        {
          runId: active.runId,
          targetId: active.targetSourceCompositionLineId,
          contentHash: active.contentHash,
          workflowRowVersion: active.workflowRowVersion,
          stageRowVersion: stageVersion,
        },
        target,
      );
    });
  }

  async function verifyStage(deps = {}, command = {}) {
    return exclusive(async () => {
      if (Number(deps.productId) !== PRODUCT_ID) return fail("PRODUCT_LOCK_REJECTED", "Composition V1 accepts only Product 262.");
      if (command.userConfirmed !== true) return fail("USER_CONFIRMATION_REQUIRED", "Explicit final-stage confirmation is required.");
      const collected = await collect(deps, { requireEditPermission: true, requireSaveCapability: false });
      if (!collected.ok) return collected;
      if (collected.authority.preflight.active_run) return fail("ACTIVE_RUN_EXISTS", "Active Composition run blocks final verification.");
      if (
        collected.planner.code !== PLAN_CODE.ALREADY_COMPLETE ||
        collected.planner.ok !== true ||
        collected.planner.mutationAllowed !== false ||
        collected.planner.matches.length !== collected.planner.governedCount ||
        collected.planner.missing.length || collected.planner.conflicts.length ||
        collected.planner.duplicates.length || collected.planner.extras.length ||
        collected.planner.blockers.length
      ) return fail("FINAL_EXACT_SET_UNPROVEN", "Final Composition exact set is not proven.");
      const result = await deps.markStageVerified({
        productId: PRODUCT_ID,
        expectedStageRowVersion: Number(collected.authority.preflight.stage?.row_version),
        expectedWorkflowRowVersion: Number(collected.authority.preflight.workflow_row_version),
        expectedContentHash: collected.authority.preflight.content_hash,
        finalListEvidence: collected.authority.portalListEvidence,
        plannerReport: collected.planner,
      });
      return {
        ok: upper(result?.stage_status) === "PORTAL_VERIFIED",
        code: upper(result?.stage_status) === "PORTAL_VERIFIED" ? "COMPOSITION_PORTAL_VERIFIED" : "STAGE_VERIFICATION_FAILED",
        message: upper(result?.stage_status) === "PORTAL_VERIFIED" ? "Composition stage is portal verified." : "Composition stage verification failed.",
        mutated: false,
        stageStatus: result?.stage_status || null,
        stageRowVersion: result?.stage_row_version || null,
      };
    });
  }

  return { preview, recoverRun, startLine, verifyStage };
}

module.exports = {
  PRODUCT_ID,
  classifySave,
  createCompositionExecutor,
  recoveryDisposition,
  validateArmedResponse,
};
