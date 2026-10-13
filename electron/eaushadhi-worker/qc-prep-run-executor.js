/* eslint-env node */

const { createHash } = require("crypto");
const { ERROR_KINDS, workerError } = require("./errors");
const { FIRST_CONTROLLED_PRODUCT_ID, isFirstControlledProduct } = require("./product-lock");
const { QC_FILL_KEYS, QC_PORTAL_CONTRACT } = require("./qc-register-portal-contract");
const { assessQcListDuplicate, listEvidence, normalizeQcListRow, sameFillFields } = require("./qc-register-list");
const { decideSaveClick } = require("./qc-register-save-guard");
const { classifyQcSaveObservation } = require("./qc-register-save-observe");
const {
  readQcFillPreflight,
  armQcPrepRun,
  preSaveQcPrepRun,
  recordQcPrepRunSave,
  resolveQcPrepRunAmbiguous,
  verifyQcPrepRunRow,
} = require("./qc-preparation-workspace");

const QC_QUALIFICATION_STATEMENT = "Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified.";
const QC_PROVISIONAL_NOTE_PREFILL = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection; NUPAL is the report issuer; legal identity and portal eligibility are not verified.";
const ACTIVE_RUN_STATUSES = new Set([
  "SAVE_ARMED",
  "SAVE_CONFIRMED",
  "SAVE_AMBIGUOUS",
  "SAVE_UNAUTHORIZED",
  "SAVE_FOUND_UNAUTHORIZED",
  "ROW_MISMATCH",
  "DOCUMENT_MISMATCH",
]);
const VERIFIED_RUN_STATUSES = new Set([
  "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED",
  "FULLY_VERIFIED",
]);

function noteAccepted(value) {
  const text = String(value || "").trim();
  return text.length >= 10 && text.length <= 2000 ? text : "";
}

function assessPageIdentity(measured, portalProductRef) {
  const selected = String(measured?.productId?.value || "");
  const expectedRef = String(portalProductRef || "").trim();
  const action = String(measured?.actiontype?.value || "");
  const hidden = String(measured?.hiddenId?.value || "");
  const routeOk = measured?.origin === QC_PORTAL_CONTRACT.origin && measured?.route === QC_PORTAL_CONTRACT.route;
  const productOk = expectedRef !== "" && selected === expectedRef && selected !== "-1";
  const addOk = action === "" || action.toLowerCase() === "add";
  const freshOk = hidden === "" || hidden === "0" || hidden === "-1";
  if (!routeOk || !productOk || !addOk || !freshOk || measured?.saveData !== true) {
    return { ok: false, code: "PAGE_IDENTITY_INVALID" };
  }
  return {
    ok: true,
    evidence: {
      actualRoute: QC_PORTAL_CONTRACT.route,
      expectedRoute: QC_PORTAL_CONTRACT.route,
      actualProductId: String(FIRST_CONTROLLED_PRODUCT_ID),
      expectedProductId: String(FIRST_CONTROLLED_PRODUCT_ID),
      actualPortalProductRef: selected,
      expectedPortalProductRef: expectedRef,
    },
    saveControl: measured.saveControl || null,
  };
}

function compareReportBytes({ name, bytes, context }) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const filename = String(name || "").split(/[/\\]/).pop();
  const expectedSha = String(context?.report_sha256 || "").toLowerCase();
  const expectedSize = Number(context?.report_size_bytes);
  const expectedName = String(context?.report_filename || "");
  const ok = sha256 === expectedSha && buffer.length === expectedSize && filename === expectedName && expectedName !== "";
  return { ok, sha256, size: buffer.length, filename };
}

function verifyDisplay(result) {
  const status = String(result?.run_status || "");
  if (status === "ROW_MISMATCH") {
    const differences = Array.isArray(result?.differences) ? result.differences.map((item) => String(item)) : [];
    return {
      blocking: true,
      text: "The saved row does not match. It was not verified.",
      differences,
    };
  }
  if (status === "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED" || result?.fully_verified === true || status === "FULLY_VERIFIED") {
    return {
      blocking: false,
      text: "Row verified — document not verified (trusted document check not available yet)",
      differences: [],
    };
  }
  return { blocking: true, text: "The row was not verified.", differences: [] };
}

function recoveryDisposition(session, runStatus) {
  if (session?.clickState === "not-clicked" && session?.observed !== true) return "DEFINITELY_NOT_CLICKED";
  if (session?.clickState === "clicked" && session?.observed !== true && session?.recorded !== true) return "CLICKED_BUT_UNKNOWN";
  if (session?.observed === true && session?.recorded !== true) return "RESPONSE_OBSERVED_NOT_RECORDED";
  if (!session && (runStatus === "SAVE_ARMED" || runStatus === "SAVE_AMBIGUOUS" || runStatus === "SAVE_UNAUTHORIZED")) {
    return "SESSION_UNKNOWN";
  }
  return "NONE";
}

function publicSession(session) {
  if (!session) return null;
  return {
    runId: session.runId,
    runStatus: session.runStatus,
    clickState: session.clickState,
    observed: session.observed === true,
    recorded: session.recorded === true,
    validUntil: session.validUntil,
    qualification: session.qualification,
    nativeSaveEnabled: QC_PORTAL_CONTRACT.nativeSaveClickEnabled === true,
    saveBlockedReason: QC_PORTAL_CONTRACT.nativeSaveBlockedReason,
  };
}

function createQcPrepRunExecutor({ live, contract = QC_PORTAL_CONTRACT } = {}) {
  let session = null;
  let busy = false;

  async function exclusive(task) {
    if (busy) {
      throw workerError(ERROR_KINDS.WORKER_NOT_READY, "A QC filling step is already running.");
    }
    busy = true;
    try {
      return await task();
    } finally {
      busy = false;
    }
  }

  function requireProduct(productId) {
    if (!isFirstControlledProduct(productId)) {
      throw workerError(ERROR_KINDS.PRODUCT_NOT_ALLOWED, "QC filling is only for product 262.");
    }
  }

  return {
    status() {
      return { ok: true, session: publicSession(session), contractGaps: contract.gaps };
    },
    async arm(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        if (input.userConfirmed !== true) {
          return { ok: false, errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE, message: "Confirm filling before it starts." };
        }
        const preflight = await readQcFillPreflight({
          productId: input.productId,
          accessToken: input.accessToken,
          preparationId: input.preparationId,
          callRpc: input.callRpc,
        });
        const blockers = preflight.blockers || [];
        if (blockers.length > 0) {
          return { ok: false, errorKind: ERROR_KINDS.PREFLIGHT_DENIED, message: "Filling was not started.", blockers };
        }
        const active = (preflight.runs || []).find((run) => ACTIVE_RUN_STATUSES.has(String(run?.run_status || "")));
        if (active) {
          return {
            ok: false,
            errorKind: ERROR_KINDS.STALE,
            message: "A QC filling run is already open. Continue that run.",
            runStatus: active.run_status,
          };
        }
        const verified = (preflight.runs || []).find((run) => VERIFIED_RUN_STATUSES.has(String(run?.run_status || "")));
        if (verified) {
          return {
            ok: false,
            errorKind: ERROR_KINDS.PREFLIGHT_DENIED,
            message: "A QC row is already verified for this product. Filling will not start.",
          };
        }
        const provisionalRequired = preflight.readiness?.status === "READY_PROVISIONAL";
        const derived = Array.isArray(preflight.context?.derived_facts) ? preflight.context.derived_facts : [];
        const provisionalNote = noteAccepted(input.provisionalNote);
        const derivedNote = noteAccepted(input.derivedNote);
        if (provisionalRequired && (input.provisionalAck !== true || !provisionalNote)) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the provisional laboratory acknowledgement and write at least 10 characters.");
        }
        if (derived.length > 0 && (input.derivedAck !== true || !derivedNote)) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the derived-date acknowledgement and write at least 10 characters.");
        }
        const portalRef = preflight.context?.portal_product_ref;
        const measured = await live.pageIdentity();
        const identity = assessPageIdentity(measured, portalRef);
        if (!identity.ok) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The portal page is not Add QC Register for product 262. Nothing was armed.");
        }
        const list = await live.readList();
        const duplicate = assessQcListDuplicate(list, preflight.fill_fields);
        if (!duplicate.ok && duplicate.code === "DUPLICATE_ROW") {
          throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "This QC row is already on the portal list. Filling was not started.");
        }
        if (!duplicate.ok && duplicate.code === "DUPLICATE_UNPROVEN") {
          throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "The QC list has rows that cannot be compared yet. Filling was not started.");
        }
        if (!duplicate.ok) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC list was not fully read. Nothing was armed.");
        }
        const armed = await armQcPrepRun({
          productId: input.productId,
          accessToken: input.accessToken,
          preparationId: input.preparationId,
          expectedReadinessTuple: preflight.readiness?.readiness_tuple,
          provisionalLabAck: provisionalRequired ? true : false,
          provisionalAckNote: provisionalRequired ? provisionalNote : "",
          pageIdentityEvidence: identity.evidence,
          beforeListEvidence: listEvidence(list),
          derivedFactAck: derived.length > 0,
          derivedFactAckNote: derived.length > 0 ? derivedNote : "",
          callRpc: input.callRpc,
        });
        const projectionChanged = !sameFillFields(armed.fill_fields, preflight.fill_fields);
        session = {
          runId: armed.run_id,
          productId: input.productId,
          preparationId: input.preparationId,
          fillFields: armed.fill_fields,
          qualification: armed.qualification,
          portalProductRef: portalRef,
          studyTypeSelectValue: preflight.context?.study_type_select_value || "",
          reportContext: {
            report_sha256: preflight.context?.report_sha256,
            report_size_bytes: preflight.context?.report_size_bytes,
            report_filename: preflight.context?.report_filename,
          },
          filledValues: null,
          report: null,
          clickState: "not-clicked",
          observed: false,
          observation: null,
          recorded: false,
          token: null,
          validUntil: null,
          runStatus: armed.run_status,
          beforeList: list,
        };
        return {
          ok: true,
          runId: armed.run_id,
          runStatus: armed.run_status,
          fillFields: armed.fill_fields,
          qualification: armed.qualification,
          projectionSha256: armed.projection_sha256,
          nativeSaveEnabled: false,
          projectionChanged,
          session: publicSession(session),
        };
      });
    },
    async fill(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        if (!session || session.runStatus !== "SAVE_ARMED" || session.clickState !== "not-clicked") {
          throw workerError(ERROR_KINDS.STALE, "There is no open filling run to type into.");
        }
        const result = await live.fill({
          fillFields: session.fillFields,
          studyTypeSelectValue: session.studyTypeSelectValue,
        });
        const filled = result?.filled_values;
        if (!sameFillFields(filled, session.fillFields)) {
          const aborted = await preSaveQcPrepRun({
            accessToken: input.accessToken,
            runId: session.runId,
            pageIdentityEvidence: (await pageEvidence()),
            filledValues: filled && typeof filled === "object" ? filled : {},
            callRpc: input.callRpc,
          });
          session.runStatus = aborted.run_status || "PRE_SAVE_ABORTED";
          session.token = null;
          return {
            ok: false,
            errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE,
            message: "The page does not match the frozen values. Nothing was saved. Start filling again.",
            runStatus: session.runStatus,
            reasons: aborted.reasons || [],
          };
        }
        session.filledValues = filled;
        return { ok: true, runStatus: session.runStatus, filledValues: filled, session: publicSession(session) };
      });
    },
    async checkPdf(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        if (!session?.filledValues) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Fill the portal form before choosing the report.");
        }
        const compared = compareReportBytes({
          name: input.filename,
          bytes: input.bytes,
          context: session.reportContext,
        });
        if (!compared.ok) {
          return { ok: false, errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE, message: "This file does not match the verified QC report. It was not attached." };
        }
        const proof = await live.attach({ filename: compared.filename, buffer: Buffer.from(input.bytes) });
        if (proof?.length !== 1 || proof?.name !== compared.filename) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC report was not attached.");
        }
        session.report = { sha256: compared.sha256, size: compared.size, filename: compared.filename };
        return { ok: true, report: session.report, session: publicSession(session) };
      });
    },
    async preSave(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        if (input.userConfirmed !== true) {
          return { ok: false, errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE, message: "Confirm the fields before Save." };
        }
        const decision = decideSaveClick({ contract, control: (await live.pageIdentity())?.saveControl });
        if (!decision.allow) {
          return {
            ok: false,
            errorKind: ERROR_KINDS.PREFLIGHT_DENIED,
            code: decision.reason,
            clickState: "not-clicked",
            message: "The portal control that runs Save is labelled Submit. Save was not pressed.",
            session: publicSession(session),
          };
        }
        if (!session?.filledValues || !session.report) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Fill the form and attach the matching report before Save.");
        }
        const identity = await pageEvidence();
        const saved = await preSaveQcPrepRun({
          accessToken: input.accessToken,
          runId: session.runId,
          pageIdentityEvidence: identity,
          filledValues: session.filledValues,
          callRpc: input.callRpc,
        });
        if (saved.go !== true) {
          session.runStatus = saved.run_status || "PRE_SAVE_ABORTED";
          session.token = null;
          return {
            ok: false,
            runStatus: session.runStatus,
            reasons: saved.reasons || [],
            message: "This run was stopped. Start filling again.",
          };
        }
        session.token = saved.pre_save_token;
        session.validUntil = saved.valid_until;
        return {
          ok: true,
          go: true,
          validUntil: saved.valid_until,
          singleUse: true,
          session: publicSession(session),
        };
      });
    },
    async save(input = {}) {
      return exclusive(async () => recordObservedSave(input, null));
    },
    async recover(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        if (input.userConfirmed !== true) {
          return { ok: false, message: "Confirm before recording an unknown Save." };
        }
        const preflight = await readQcFillPreflight({
          productId: input.productId,
          accessToken: input.accessToken,
          preparationId: input.preparationId,
          callRpc: input.callRpc,
        });
        const latest = (preflight.runs || [])[0] || null;
        const disposition = recoveryDisposition(session && session.runId === latest?.run_id ? session : null, latest?.run_status);
        if (disposition === "DEFINITELY_NOT_CLICKED") {
          return { ok: true, disposition, message: "Save was not pressed. This run is still open.", session: publicSession(session) };
        }
        if (disposition === "NONE") {
          return { ok: true, disposition, runStatus: latest?.run_status || null, display: verifyDisplay(latest) };
        }
        if (session?.recorded === true) {
          return { ok: true, disposition, message: "The Save result is already recorded.", session: publicSession(session) };
        }
        const outcome = disposition === "RESPONSE_OBSERVED_NOT_RECORDED"
          ? classifyQcSaveObservation(session.observation).outcome || "AMBIGUOUS"
          : "AMBIGUOUS";
        const recorded = await recordQcPrepRunSave({
          accessToken: input.accessToken,
          runId: latest.run_id,
          preSaveToken: session?.token || null,
          saveOutcome: outcome,
          saveEvidence: saveEvidence(outcome, session?.observation),
          callRpc: input.callRpc,
        });
        if (session) {
          session.recorded = true;
          session.runStatus = recorded.run_status;
          session.token = null;
        }
        return {
          ok: true,
          disposition,
          runStatus: recorded.run_status,
          message: "Check the portal list.",
          autoRetry: false,
        };
      });
    },
    async resolve(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        const note = noteAccepted(input.note);
        if (input.attest !== true || !note) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the attestation and write at least 10 characters.");
        }
        if (input.resolution !== "FOUND_SAVED" && input.resolution !== "NOT_SAVED") {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose whether the row is on the portal list.");
        }
        const list = await live.readList();
        if (list.success !== true || list.coverageComplete !== true) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC list was not fully read.");
        }
        const resolved = await resolveQcPrepRunAmbiguous({
          accessToken: input.accessToken,
          runId: input.runId || session?.runId,
          resolution: input.resolution,
          afterListEvidence: listEvidence(list),
          note,
          attest: true,
          callRpc: input.callRpc,
        });
        if (session) session.runStatus = resolved.run_status;
        const message = resolved.run_status === "SAVE_FOUND_UNAUTHORIZED"
          ? "A row was found, but this save was not authorized. Do not verify it. Portal clean-up is a later step."
          : resolved.run_status === "SAVE_NOT_SAVED"
            ? "The portal list does not contain this row. You can start filling again."
            : "Check the portal list.";
        return { ok: true, runStatus: resolved.run_status, message, qualification: resolved.qualification };
      });
    },
    async verify(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        const list = await live.readList();
        if (list.success !== true || list.coverageComplete !== true) {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC list was not fully read.");
        }
        let expected = session?.fillFields || null;
        let runId = session?.runId || input.runId || null;
        if (!expected) {
          const preflight = await readQcFillPreflight({
            productId: input.productId,
            accessToken: input.accessToken,
            preparationId: input.preparationId,
            callRpc: input.callRpc,
          });
          expected = preflight.fill_fields;
          if (!runId) runId = (preflight.runs || [])[0]?.run_id || null;
        }
        const match = (list.rows || []).map(normalizeQcListRow).find((row) => row && sameFillFields(row.values, expected));
        const domId = (list.domRowIds || []).map((item) => String(item?.value || "").trim()).find(Boolean);
        const portalRowId = match?.portalRowId || domId || "";
        if (!match || !portalRowId) {
          return {
            ok: false,
            errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE,
            message: "The saved row could not be read back. It was not verified.",
          };
        }
        const verified = await verifyQcPrepRunRow({
          accessToken: input.accessToken,
          runId,
          afterListEvidence: listEvidence(list),
          rereadValues: match.values,
          resolvedPortalRowId: portalRowId,
          callRpc: input.callRpc,
        });
        if (session) session.runStatus = verified.run_status;
        const display = verifyDisplay(verified);
        return { ok: display.blocking !== true, runStatus: verified.run_status, display, qualification: verified.qualification };
      });
    },
  };

  async function pageEvidence() {
    const measured = await live.pageIdentity();
    const identity = assessPageIdentity(measured, session?.portalProductRef);
    if (!identity.ok) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The portal page is not Add QC Register for product 262.");
    }
    return identity.evidence;
  }

  async function recordObservedSave(input, presetObservation) {
    requireProduct(input.productId);
    if (!session || session.recorded === true) {
      throw workerError(ERROR_KINDS.STALE, "This Save was already recorded.");
    }
    if (!session.token) {
      throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Review the fields again before Save.");
    }
    if (session.validUntil && Date.parse(session.validUntil) <= Date.now()) {
      return {
        ok: false,
        clickState: "not-clicked",
        message: "The save authorisation expired. Review the fields again.",
      };
    }
    const decision = decideSaveClick({ contract, control: (await live.pageIdentity())?.saveControl });
    if (!decision.allow) {
      return {
        ok: false,
        code: decision.reason,
        clickState: "not-clicked",
        message: "The portal control that runs Save is labelled Submit. Save was not pressed.",
      };
    }
    session.clickState = "clicked";
    let observation = presetObservation;
    if (!observation) {
      try {
        observation = await live.observeSave();
        const after = await live.readList();
        observation.listDelta = listDelta(session.beforeList, after, session.filledValues);
      } catch {
        observation = { clicked: true, settled: false, matchingRequestCount: 0, listDelta: "unknown" };
      }
    }
    session.observed = true;
    session.observation = observation;
    const classified = classifyQcSaveObservation(observation);
    const recorded = await recordQcPrepRunSave({
      accessToken: input.accessToken,
      runId: session.runId,
      preSaveToken: session.token,
      saveOutcome: classified.outcome || "AMBIGUOUS",
      saveEvidence: saveEvidence(classified.outcome || "AMBIGUOUS", observation),
      callRpc: input.callRpc,
    });
    session.recorded = true;
    session.token = null;
    session.runStatus = recorded.run_status;
    return {
      ok: true,
      runStatus: recorded.run_status,
      outcome: classified.outcome,
      reasons: recorded.reasons || [],
      autoRetry: false,
      message: recorded.run_status === "SAVE_CONFIRMED"
        ? "Save was recorded. The row still has to be read back."
        : "Check the portal list.",
      session: publicSession(session),
    };
  }

  function saveEvidence(outcome, observation) {
    return {
      action: "SAVE",
      outcome,
      localSha256: session?.report?.sha256 || null,
      localSize: session?.report?.size || null,
      localFilename: session?.report?.filename || null,
      filled_values: session?.filledValues || null,
      observation: {
        clicked: observation?.clicked === true,
        settled: observation?.settled === true,
        status: observation?.status == null ? null : String(observation.status),
        matchingRequestCount: Number(observation?.matchingRequestCount) || 0,
        listDelta: observation?.listDelta || "unknown",
      },
    };
  }

  function listDelta(before, after, filled) {
    const beforeCount = Array.isArray(before?.rows) ? before.rows.length : null;
    const afterCount = Array.isArray(after?.rows) ? after.rows.length : null;
    if (beforeCount == null || afterCount == null) return "unknown";
    if (afterCount === beforeCount) return "none";
    if (afterCount === beforeCount + 1) {
      const match = after.rows.map(normalizeQcListRow).find((row) => row && sameFillFields(row.values, filled));
      return match ? "one-match" : "unknown";
    }
    return "unknown";
  }
}

module.exports = {
  QC_FILL_KEYS,
  QC_PROVISIONAL_NOTE_PREFILL,
  QC_QUALIFICATION_STATEMENT,
  ACTIVE_RUN_STATUSES,
  assessPageIdentity,
  compareReportBytes,
  createQcPrepRunExecutor,
  noteAccepted,
  recoveryDisposition,
  sameFillFields,
  verifyDisplay,
};
