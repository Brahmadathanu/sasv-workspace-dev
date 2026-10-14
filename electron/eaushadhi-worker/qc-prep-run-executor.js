/* eslint-env node */

const { createHash } = require("crypto");
const fs = require("fs");
const path = require("path");
const { ERROR_KINDS, workerError } = require("./errors");
const { FIRST_CONTROLLED_PRODUCT_ID, isFirstControlledProduct } = require("./product-lock");
const {
  QC_FILL_KEYS,
  QC_PORTAL_CONTRACT,
  QC_PORTAL_PRODUCT_LABEL,
  NATIVE_SAVE_AUTHORIZED,
  isPermittedSaveControl,
} = require("./qc-register-portal-contract");
const { assessQcListDuplicate, listEvidence, mapGetqcDataResponse, normalizeQcListRow, sameFillFields } = require("./qc-register-list");
const { decideSaveClick } = require("./qc-register-save-guard");
const { classifyQcSaveObservation } = require("./qc-register-save-observe");
const { buildQcRecapture } = require("./qc-register-recapture");
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

function normalizeQcProductLabel(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[.,()-]/g, "")
    .trim();
}

function assessPageIdentity(measured, portalProductRef) {
  const selected = measured?.productSelected
    ? String(measured.productSelected.value ?? "")
    : String(measured?.productId?.value || "");
  const selectedText = String(measured?.productSelected?.text ?? "");
  const options = Array.isArray(measured?.productOptions) ? measured.productOptions : [];
  const expectedLabel = QC_PORTAL_PRODUCT_LABEL[262];
  const matchingLabels = options.filter((option) => normalizeQcProductLabel(option?.text) === expectedLabel);
  const action = String(measured?.actiontype?.value || "");
  const hidden = String(measured?.hiddenId?.value || "");
  const routeOk = measured?.origin === QC_PORTAL_CONTRACT.origin && measured?.route === QC_PORTAL_CONTRACT.route;
  const productOk = selected !== ""
    && selected !== "-1"
    && normalizeQcProductLabel(selectedText) === expectedLabel
    && matchingLabels.length === 1;
  const addOk = action === "" || action.toLowerCase() === "add";
  const freshOk = hidden === "" || hidden === "0" || hidden === "-1";
  const saveDataPresent = measured?.saveData === true;
  const checks = {
    route: routeOk,
    product: productOk,
    actionAdd: addOk,
    freshRow: freshOk,
    saveDataPresent,
  };
  const seen = {
    route: String(measured?.route || ""),
    heading: String(measured?.heading || ""),
    productValue: selected,
    productText: selectedText,
    actiontype: action,
    hiddenId: hidden,
  };
  const failed = [];
  if (!checks.route) failed.push("route");
  if (!checks.product) failed.push("product");
  if (!checks.actionAdd) failed.push("actionAdd");
  if (!checks.freshRow) failed.push("freshRow");
  if (!checks.saveDataPresent) failed.push("saveData");
  const detail = `(failed: ${failed.join(", ")}; seen product ${JSON.stringify(seen.productText)}=${seen.productValue}, id ${JSON.stringify(seen.hiddenId)}, action ${JSON.stringify(seen.actiontype)})`;
  const expectedRef = String(portalProductRef || "").trim();
  if (!routeOk || !productOk || !addOk || !freshOk || !saveDataPresent) {
    return { ok: false, code: "PAGE_IDENTITY_INVALID", checks, seen, detail };
  }
  return {
    ok: true,
    checks,
    seen,
    detail: "",
    evidence: {
      actualRoute: QC_PORTAL_CONTRACT.route,
      expectedRoute: QC_PORTAL_CONTRACT.route,
      actualProductId: String(FIRST_CONTROLLED_PRODUCT_ID),
      expectedProductId: String(FIRST_CONTROLLED_PRODUCT_ID),
      actualPortalProductRef: selected,
      expectedPortalProductRef: expectedRef,
      productDetailsRef: expectedRef,
    },
    saveControl: measured.saveControl || null,
  };
}

const DRY_RUN_RESET_BANNER = "Form contains UNSAVED dry-run values. Do not press Submit. Reload the page.";

function dryRunFingerprint(preparationId, fillFields, reportContext) {
  const fields = {};
  for (const key of QC_FILL_KEYS) fields[key] = String(fillFields?.[key] ?? "");
  return createHash("sha256").update(JSON.stringify({
    preparationId: String(preparationId || ""),
    fields,
    report_filename: String(reportContext?.report_filename || ""),
    report_size_bytes: Number(reportContext?.report_size_bytes) || 0,
    report_sha256: String(reportContext?.report_sha256 || ""),
  })).digest("hex");
}

function compareProjection(expected, actual) {
  const rows = [];
  const reasons = [];
  const actualObject = actual && typeof actual === "object" ? actual : {};
  for (const key of QC_FILL_KEYS) {
    const left = String(expected?.[key] ?? "");
    const present = Object.prototype.hasOwnProperty.call(actualObject, key);
    const right = present ? String(actualObject[key] ?? "") : "";
    const match = present && right === left;
    rows.push({ key, expected: left, actual: right, match });
    if (!match) reasons.push(`FILLED_VALUE_DIFFERS:${key}`);
  }
  for (const key of Object.keys(actualObject)) {
    if (!QC_FILL_KEYS.includes(key)) reasons.push(`FILLED_VALUE_UNEXPECTED:${key}`);
  }
  return { rows, ok: reasons.length === 0, reasons };
}

function formIsEmpty(read) {
  const fields = read?.fields || {};
  const fileLength = Number(read?.file?.length) || 0;
  return fileLength === 0 && QC_FILL_KEYS.every((key) => String(fields[key] ?? "") === "");
}

function writeDryRunReport(dir, report) {
  const runId = String(report?.run_id || "");
  if (!dir || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) return false;
  fs.mkdirSync(dir, { recursive: true });
  const safe = { ...report };
  delete safe.pre_save_token;
  delete safe.token;
  delete safe.preSaveToken;
  fs.writeFileSync(path.join(dir, `${runId}.json`), `${JSON.stringify(safe, null, 2)}\n`);
  return true;
}

function findDryRunPass(dir, preparationId, fingerprint) {
  if (!dir || !fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  for (const name of names) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (parsed?.outcome === "DRY_RUN_PASS"
        && String(parsed.preparationId || "") === String(preparationId || "")
        && String(parsed.fingerprint || "") === String(fingerprint || "")) {
        return parsed;
      }
    } catch {
      // A damaged report cannot authorize Save.
    }
  }
  return null;
}

function withIdentityDetail(sentence, identity) {
  if (!identity || identity.ok || !identity.detail) return sentence;
  if (sentence.endsWith(".")) return `${sentence.slice(0, -1)} ${identity.detail}.`;
  return `${sentence} ${identity.detail}`;
}

function compareReportBytes({ name, bytes, context }) {
  const chosenFilename = String(name || "").split(/[/\\]/).pop();
  const expectedSha = String(context?.report_sha256 || "").toLowerCase();
  const expectedSize = Number(context?.report_size_bytes);
  const expectedName = String(context?.report_filename || "");
  const expected = {
    chosenFilename,
    filename: expectedName,
    expectedSha256: expectedSha,
    expectedSize: Number.isFinite(expectedSize) ? expectedSize : 0,
  };
  if (bytes == null) {
    return { ok: false, sha256: "", size: 0, reason: "NO_FILE", ...expected };
  }
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const size = buffer.length;
  let reason = null;
  if (!expectedSha) reason = "NO_EXPECTED_HASH";
  else if (size !== expectedSize) reason = "SIZE_DIFFERS";
  else if (sha256 !== expectedSha) reason = "SHA256_DIFFERS";
  return { ok: reason == null, sha256, size, reason, ...expected };
}

function canReuseArmedRun(run, preflight, preparationId) {
  if (String(run?.run_status || "") !== "SAVE_ARMED") return false;
  if (run?.save_outcome != null && String(run.save_outcome) !== "") return false;
  if (run?.pre_save_token_consumed_at != null && String(run.pre_save_token_consumed_at) !== "") return false;
  if (run?.preparation_id != null && String(run.preparation_id) !== String(preparationId || "")) return false;
  const currentTuple = String(preflight?.readiness?.readiness_tuple || "");
  if (run?.readiness_tuple != null && String(run.readiness_tuple) !== currentTuple) return false;
  return true;
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

function createQcPrepRunExecutor({ live, contract = QC_PORTAL_CONTRACT, dryRunDir = null } = {}) {
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
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, `${withIdentityDetail("The portal page is not Add QC Register for product 262.", identity)} Nothing was armed.`);
        }
        const list = await live.readList();
        const duplicate = assessQcListDuplicate(list, preflight.fill_fields);
        if (!duplicate.ok && duplicate.code === "DUPLICATE_ROW") {
          throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "This QC row is already on the portal list. Filling was not started.");
        }
        if (!duplicate.ok && duplicate.code === "DUPLICATE_UNPROVEN") {
          throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "The QC list has rows that cannot be compared yet. Filling was not started.");
        }
        if (!duplicate.ok && duplicate.code === "LIST_INCOMPLETE") {
          throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "List incomplete");
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
        if (result?.ok === false && result?.filled === false) {
          return {
            ok: false,
            errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE,
            message: result.message || "Laboratory not in the portal list",
            runStatus: session.runStatus,
          };
        }
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
        const measured = await live.pageIdentity();
        const decision = decideSaveClick({ contract, control: measured?.saveControl, page: measured });
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
    async inspect(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        if (input.userConfirmed !== true) {
          return { ok: false, errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE, message: "Confirm the portal check before it starts." };
        }
        const preflight = await readQcFillPreflight({
          productId: input.productId,
          accessToken: input.accessToken,
          preparationId: input.preparationId,
          callRpc: input.callRpc,
        });
        const measured = await live.pageIdentity();
        const identity = assessPageIdentity(measured, preflight.context?.portal_product_ref);
        const list = await live.readList();
        const facts = typeof live.readPortalFacts === "function"
          ? await live.readPortalFacts()
          : { laboratory: { options: [] }, studyType: { options: [] } };
        const expectedLab = String(preflight.fill_fields?.labName ?? "");
        const labOptions = Array.isArray(facts?.laboratory?.options) ? facts.laboratory.options : [];
        const labMatch = labOptions.find((option) => String(option?.value ?? "") === expectedLab) || null;
        const expectedStudy = String(preflight.context?.study_type_select_value ?? "");
        const studyOptions = Array.isArray(facts?.studyType?.options) ? facts.studyType.options : [];
        const studyMatch = studyOptions.find((option) => String(option?.value ?? "") === expectedStudy) || null;
        const hasBytes = input.bytes != null && (Buffer.isBuffer(input.bytes) || input.bytes.length > 0);
        const report = hasBytes
          ? compareReportBytes({ name: input.filename, bytes: input.bytes, context: preflight.context })
          : null;
        const captured = typeof live.readRecapture === "function"
          ? await live.readRecapture()
          : { saveDataSource: "", scriptText: "" };
        const recapture = buildQcRecapture({
          payload: list?.payload,
          saveDataSource: captured?.saveDataSource || "",
          scriptText: captured?.scriptText || "",
        });
        const message = [
          identity.ok ? "The portal page is Add QC Register for product 262." : withIdentityDetail("The portal page is not Add QC Register for product 262.", identity),
          list.coverageComplete === true ? "The QC list coverage is complete." : "The QC list coverage is not proven.",
          labMatch ? "The frozen laboratory name is an option value." : "The frozen laboratory name is not an option value on this page.",
          studyMatch ? "The study-type option value matches the server." : "The study-type option value does not match the server.",
          report ? (report.ok ? "The file matches the verified QC report. It was not attached." : "This file does not match the verified QC report. It was not attached.") : "No report file was checked.",
          "Save was not pressed. Filling was not armed.",
        ].join(" ");
        return {
          ok: identity.ok === true && list.coverageComplete === true && Boolean(labMatch) && Boolean(studyMatch) && (report == null || report.ok === true),
          nativeSaveEnabled: contract.nativeSaveClickEnabled === true,
          saveBlockedReason: contract.nativeSaveBlockedReason,
          pageIdentityOk: identity.ok === true,
          saveControlText: measured?.saveControl?.text || "",
          list: {
            success: list.success === true,
            coverageComplete: list.coverageComplete === true,
            reason: list.reason || null,
            totalCount: Number.isInteger(list.totalCount) ? list.totalCount : null,
            rowCount: Array.isArray(list.rows) ? list.rows.length : 0,
            requestedPage: list.requestedPage === 0 ? 0 : null,
          },
          laboratory: {
            expectedValue: expectedLab,
            optionPresent: Boolean(labMatch),
            optionValue: labMatch ? String(labMatch.value) : "",
            optionLabel: labMatch ? String(labMatch.label || "") : "",
          },
          studyType: {
            expectedValue: expectedStudy,
            optionPresent: Boolean(studyMatch),
            optionValue: studyMatch ? String(studyMatch.value) : "",
            optionLabel: studyMatch ? String(studyMatch.label || "") : "",
          },
          protocolMapping: preflight.protocol_mapping || null,
          report: report ? {
            ok: report.ok === true,
            size: report.size,
            filename: report.filename,
            chosenFilename: report.chosenFilename || "",
            sha256: report.sha256 || "",
            expectedSha256: report.expectedSha256 || "",
            expectedSize: report.expectedSize,
            reason: report.reason || null,
            attached: false,
          } : null,
          clickedSave: false,
          armed: false,
          recapture,
          message,
        };
      });
    },
    async verify(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        const list = await live.readList();
        if (list.reason === "LIST_INCOMPLETE") {
          return { ok: false, errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE, message: "List incomplete" };
        }
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
        const domId = (list.domRowIds || []).map((item) => String(item?.value || "").trim()).find(Boolean);
        const singleRowId = Array.isArray(list.rows) && list.rows.length === 1
          ? String(list.rows[0]?.id ?? list.rows[0]?.hid ?? "").trim()
          : "";
        const portalRowId = domId || singleRowId;
        if (!portalRowId || typeof live.reread !== "function") {
          return {
            ok: false,
            errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE,
            message: "The saved row could not be read back. It was not verified.",
          };
        }
        const raw = await live.reread({ id: portalRowId });
        const mapped = mapGetqcDataResponse(raw?.payload);
        if (!mapped.ok) {
          return {
            ok: false,
            runStatus: "ROW_MISMATCH",
            reason: mapped.reason || "date format unknown",
            message: mapped.reason || "date format unknown",
            display: {
              blocking: true,
              text: "The saved row does not match. It was not verified.",
              differences: [mapped.reason || "date format unknown"],
            },
          };
        }
        const verified = await verifyQcPrepRunRow({
          accessToken: input.accessToken,
          runId,
          afterListEvidence: listEvidence(list),
          rereadValues: mapped.values,
          resolvedPortalRowId: portalRowId,
          callRpc: input.callRpc,
        });
        if (session) session.runStatus = verified.run_status;
        const display = verifyDisplay(verified);
        return { ok: display.blocking !== true, runStatus: verified.run_status, display, qualification: verified.qualification };
      });
    },
    async dryRun(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        const refused = (reasons, message) => ({
          ok: false,
          outcome: "DRY_RUN_FAIL",
          reasons,
          message,
          banner: null,
          clicked: false,
          armed: false,
          report: null,
        });
        if (input.userConfirmed !== true) {
          return refused(["CONFIRM_REQUIRED"], "Confirm the dry run before it starts.");
        }
        if (input.provisionalAck !== true || input.derivedAck !== true || !noteAccepted(input.provisionalNote) || !noteAccepted(input.derivedNote)) {
          return refused(["ACK_REQUIRED"], "Tick both acknowledgements. Nothing was armed.");
        }
        const preflight = await readQcFillPreflight({
          productId: input.productId,
          accessToken: input.accessToken,
          preparationId: input.preparationId,
          callRpc: input.callRpc,
        });
        const blockers = preflight.blockers || [];
        if (blockers.length > 0) {
          return refused(blockers.map(String), "Filling was not started.");
        }
        const runs = Array.isArray(preflight.runs) ? preflight.runs : [];
        const active = runs.find((run) => ACTIVE_RUN_STATUSES.has(String(run?.run_status || "")));
        const latest = runs[0] || null;
        let reusedRun = null;
        let armNote = "";
        if (active && canReuseArmedRun(active, preflight, input.preparationId)) {
          reusedRun = active;
        } else if (active) {
          return refused(["ACTIVE_RUN"], `A QC filling run ${active.run_id || ""} is already ${active.run_status}.`);
        } else if (String(latest?.run_status || "") === "PRE_SAVE_ABORTED") {
          armNote = "previous run was aborted, a new run was armed";
        }
        const portalRef = preflight.context?.portal_product_ref;
        const measured = await live.pageIdentity();
        const identity = assessPageIdentity(measured, portalRef);
        if (!identity.ok) {
          return refused(["PAGE_IDENTITY_INVALID"], withIdentityDetail("The portal page is not Add QC Register for product 262.", identity));
        }
        let list = null;
        let armed = null;
        if (reusedRun) {
          armed = {
            run_id: reusedRun.run_id,
            run_status: "SAVE_ARMED",
            fill_fields: reusedRun.fill_fields || preflight.fill_fields,
            qualification: reusedRun.qualification || "",
          };
        } else {
          list = await live.readList();
          const duplicate = assessQcListDuplicate(list, preflight.fill_fields);
          if (!duplicate.ok) {
            const listMessage = duplicate.code === "LIST_INCOMPLETE"
              ? "List incomplete"
              : "The QC list was not fully read. Nothing was armed.";
            return refused([duplicate.code || "LIST"], listMessage);
          }
          const provisionalRequired = preflight.readiness?.status === "READY_PROVISIONAL";
          const derived = Array.isArray(preflight.context?.derived_facts) ? preflight.context.derived_facts : [];
          armed = await armQcPrepRun({
            productId: input.productId,
            accessToken: input.accessToken,
            preparationId: input.preparationId,
            expectedReadinessTuple: preflight.readiness?.readiness_tuple,
            provisionalLabAck: provisionalRequired ? true : false,
            provisionalAckNote: provisionalRequired ? noteAccepted(input.provisionalNote) : "",
            pageIdentityEvidence: identity.evidence,
            beforeListEvidence: listEvidence(list),
            derivedFactAck: derived.length > 0,
            derivedFactAckNote: derived.length > 0 ? noteAccepted(input.derivedNote) : "",
            callRpc: input.callRpc,
          });
        }
        const productValue = String(measured?.productSelected?.value || measured?.productId?.value || "");
        const reportContext = {
          report_sha256: preflight.context?.report_sha256,
          report_size_bytes: preflight.context?.report_size_bytes,
          report_filename: preflight.context?.report_filename,
        };
        const reasons = [];
        const again = assessPageIdentity(await live.pageIdentity(), portalRef);
        if (!again.ok) reasons.push("PAGE_IDENTITY_INVALID");
        let filled = null;
        if (again.ok) {
          const typed = await live.fill({
            fillFields: armed.fill_fields,
            studyTypeSelectValue: preflight.context?.study_type_select_value || "",
          });
          if (typed?.ok === false && typed?.filled === false) reasons.push("LAB_NOT_IN_LIST");
          else filled = typed?.filled_values || null;
        }
        const fileCompared = compareReportBytes({ name: input.filename, bytes: input.bytes, context: reportContext });
        let proof = null;
        if (!fileCompared.ok) reasons.push(fileCompared.reason || "FILE_MISMATCH");
        else if (again.ok) {
          proof = await live.attach({ filename: fileCompared.filename, buffer: Buffer.from(input.bytes) });
          if (proof?.length !== 1 || proof?.name !== fileCompared.filename || Number(proof?.size) !== Number(fileCompared.expectedSize)) {
            reasons.push("FILE_NOT_ATTACHED");
          }
        }
        const reread = typeof live.readForm === "function" ? await live.readForm() : { fields: filled || {}, file: { name: "", size: 0, length: 0 } };
        const compared = compareProjection(armed.fill_fields, reread.fields);
        if (!compared.ok) reasons.push(...compared.reasons);
        const fileMatch = fileCompared.ok === true
          && Number(reread?.file?.length) === 1
          && Number(reread?.file?.size) === Number(fileCompared.expectedSize)
          && String(reread?.file?.name || "") === String(fileCompared.filename || "");
        if (fileCompared.ok && !fileMatch) reasons.push("FILE_REREAD_MISMATCH");
        let payloadKeys = [];
        if (typeof live.readRecapture === "function") {
          const captured = await live.readRecapture();
          payloadKeys = buildQcRecapture({
            payload: null,
            saveDataSource: captured?.saveDataSource || "",
            scriptText: "",
          }).saveDataQcdetailsKeys.add;
        }
        if (payloadKeys.length === 0 && typeof live.payloadKeys === "function") {
          const fromForm = await live.payloadKeys();
          payloadKeys = Array.isArray(fromForm?.keys) ? fromForm.keys.map(String) : [];
        }
        if (payloadKeys.length === 0) payloadKeys = QC_FILL_KEYS.slice();
        const saved = await preSaveQcPrepRun({
          accessToken: input.accessToken,
          runId: armed.run_id,
          pageIdentityEvidence: again.ok ? again.evidence : identity.evidence,
          filledValues: reread.fields && typeof reread.fields === "object" ? reread.fields : {},
          callRpc: input.callRpc,
        });
        const go = saved?.go === true;
        const preSaveReasons = Array.isArray(saved?.reasons) ? saved.reasons.map(String) : [];
        if (saved && typeof saved === "object") delete saved.pre_save_token;
        if (!go) reasons.push(...(preSaveReasons.length ? preSaveReasons : ["PRE_SAVE_REFUSED"]));
        let resetRead = null;
        let resetOk = false;
        try {
          resetRead = typeof live.resetForm === "function"
            ? await live.resetForm({ productValue })
            : null;
          const productOk = productValue === "" || String(resetRead?.productValue ?? "") === productValue;
          resetOk = formIsEmpty(resetRead) && productOk;
        } catch {
          resetOk = false;
        }
        if (!resetOk) reasons.push("RESET_FAILED");
        const outcome = compared.ok && fileMatch && go && resetOk && reasons.length === 0 ? "DRY_RUN_PASS" : "DRY_RUN_FAIL";
        const banner = resetOk ? null : DRY_RUN_RESET_BANNER;
        const fingerprint = dryRunFingerprint(input.preparationId, armed.fill_fields, reportContext);
        const report = {
          run_id: armed.run_id,
          preparationId: String(input.preparationId || ""),
          fingerprint,
          arm: {
            reused: reusedRun != null,
            run_id: armed.run_id,
            run_status: armed.run_status || "SAVE_ARMED",
            note: armNote,
          },
          fields: compared.rows,
          file: {
            expected: {
              filename: fileCompared.filename || String(reportContext.report_filename || ""),
              size: Number(fileCompared.expectedSize) || 0,
              sha256: fileCompared.expectedSha256 || String(reportContext.report_sha256 || ""),
            },
            chosen: {
              filename: fileCompared.chosenFilename || String(input.filename || ""),
              size: Number(fileCompared.size) || 0,
              sha256: fileCompared.sha256 || "",
            },
            attached: {
              filename: proof?.name || "",
              size: Number(proof?.size) || 0,
              length: Number(proof?.length) || 0,
            },
            reread: {
              filename: String(reread?.file?.name || ""),
              size: Number(reread?.file?.size) || 0,
              length: Number(reread?.file?.length) || 0,
            },
            match: fileMatch,
            reason: fileCompared.reason || null,
          },
          payloadKeys,
          pre_save: { go, reasons: preSaveReasons },
          reset: { ok: resetOk, empty: formIsEmpty(resetRead) },
          clicked: false,
          outcome,
          reasons,
          banner,
          serverRunStatus: go ? "SAVE_ARMED" : (saved?.run_status || "PRE_SAVE_ABORTED"),
          serverNote: "The server run stays SAVE_ARMED or PRE_SAVE_ABORTED. That is expected.",
        };
        writeDryRunReport(dryRunDir, report);
        session = {
          runId: armed.run_id,
          productId: input.productId,
          preparationId: input.preparationId,
          fillFields: armed.fill_fields,
          qualification: armed.qualification,
          portalProductRef: portalRef,
          studyTypeSelectValue: preflight.context?.study_type_select_value || "",
          reportContext,
          filledValues: null,
          report: null,
          clickState: "not-clicked",
          observed: false,
          observation: null,
          recorded: false,
          token: null,
          validUntil: null,
          runStatus: report.serverRunStatus,
          beforeList: list,
        };
        return {
          ok: outcome === "DRY_RUN_PASS",
          outcome,
          reasons,
          message: [armNote, banner || (outcome === "DRY_RUN_PASS"
            ? "Dry run passed. The form was cleared. Save was not pressed."
            : "Dry run failed. Save was not pressed.")].filter(Boolean).join(" "),
          banner,
          clicked: false,
          armed: true,
          report,
        };
      });
    },
    async performGuardedNativeSave(input = {}) {
      return exclusive(async () => {
        requireProduct(input.productId);
        const reasons = [];
        if (NATIVE_SAVE_AUTHORIZED !== true) reasons.push("NATIVE_SAVE_AUTHORIZED");
        if (contract.nativeSaveClickEnabled !== true) reasons.push("nativeSaveClickEnabled");
        let pagePath = "";
        let selector = "";
        try {
          const measured = await live.pageIdentity();
          pagePath = String(measured?.route || "");
          const id = String(measured?.saveControl?.id || "");
          selector = id ? `#${id}` : "";
        } catch {
          reasons.push("saveControl");
        }
        if (!reasons.includes("saveControl") && !isPermittedSaveControl(pagePath, selector)) reasons.push("saveControl");
        const pass = findDryRunPass(dryRunDir, input.preparationId, input.fingerprint);
        if (!pass) reasons.push("DRY_RUN_PASS");
        const pre = input.preSave && typeof input.preSave === "object" ? input.preSave : null;
        const fresh = pre?.go === true
          && typeof pre.pre_save_token === "string"
          && pre.pre_save_token.length > 0
          && Date.parse(pre.valid_until) > Date.now();
        if (!fresh) reasons.push("preSave");
        if (reasons.length > 0) {
          const error = workerError(ERROR_KINDS.PREFLIGHT_DENIED, "NATIVE_SAVE_DISABLED", { details: { reasons } });
          error.code = "NATIVE_SAVE_DISABLED";
          error.reasons = reasons;
          throw error;
        }
        if (typeof live.evaluate === "function") {
          await live.evaluate("document.querySelector('#save_btn').click()");
        }
        return recordQcPrepRunSave({
          accessToken: input.accessToken,
          runId: input.runId || session?.runId,
          preSaveToken: pre.pre_save_token,
          saveOutcome: "CONFIRMED",
          saveEvidence: {
            action: "SAVE",
            outcome: "CONFIRMED",
            submitted: false,
            localSha256: null,
            localSize: null,
            localFilename: null,
            filled_values: null,
            observation: { clicked: true, settled: false, status: null, matchingRequestCount: 0, listDelta: "unknown" },
          },
          callRpc: input.callRpc,
        });
      });
    },
  };

  async function pageEvidence() {
    const measured = await live.pageIdentity();
    const identity = assessPageIdentity(measured, session?.portalProductRef);
    if (!identity.ok) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, withIdentityDetail("The portal page is not Add QC Register for product 262.", identity));
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
    const measured = await live.pageIdentity();
    const decision = decideSaveClick({ contract, control: measured?.saveControl, page: measured });
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
        observation = await live.observeSave({ allowClick: true });
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
