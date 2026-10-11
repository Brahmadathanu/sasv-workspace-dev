/* eslint-env node */

const { ERROR_KINDS, WorkerError, workerError } = require("./errors");
const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { validateAccessToken } = require("./validate");

const QC_PROTOCOL_OPTIONS_RPC = "rpc_eaushadhi_qc_protocol_options_v1";
const QC_LABORATORY_OPTIONS_RPC = "rpc_eaushadhi_qc_portal_laboratory_options_v1";
const QC_PREPARATION_WORKSPACE_READ_RPC = "rpc_eaushadhi_qc_preparation_read_v1";
const QC_PREPARATION_REVIEW_RPC = "rpc_eaushadhi_qc_preparation_review_v1";
const QC_PREPARATION_SAVE_RPC = "rpc_eaushadhi_qc_preparation_save_v1";
const QC_PREPARATION_VERIFY_SOURCE_RPC = "rpc_eaushadhi_qc_preparation_verify_v2";
const QC_PREPARATION_REOPEN_RPC = "rpc_eaushadhi_qc_preparation_reopen_v1";
const QC_EVIDENCE_RECHECK_RPC = "rpc_eaushadhi_qc_evidence_recheck_v1";
const QC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QC_FACT_KEYS = [
  "study_start_date",
  "study_end_date",
  "report_date",
  "testing_protocol",
  "batches",
  "shelf_life_months",
];
const QC_FACT_ITEM_KEYS = new Set(["supported_by_report", "source_reference", "evidence_note"]);
const QC_PREPARATION_SOURCE_KEY = "manual-qc:262:primary";
const QC_DATE_BASIS = "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN";
const QC_CANONICAL_REPORT_FILENAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const QC_CANONICAL_REPORT_FILENAME_RE = /^EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V[0-9]{2}\.pdf$/;
const QC_OTHER_PROTOCOL_TEXT_RE = /^[a-zA-Z0-9()-_ .]*$/;
const QC_BATCH_TOKEN_RE = /^[A-Za-z0-9./_-]+$/;
const QC_BATCH_TEXT_RE = /^[A-Za-z0-9./_-]+(,[A-Za-z0-9./_-]+)*$/;

const PAYLOAD_KEYS = new Set([
  "testing_protocol_term_id",
  "other_testing_protocol_text",
  "study_start_date",
  "study_end_date",
  "date_basis",
  "date_evidence_note",
  "shelf_life_months",
  "batches",
  "report_date",
  "report_date_evidence_note",
  "quality_control_mode",
  "source_report_issuer",
  "source_report_approval_no",
  "portal_laboratory_candidate",
  "report_filename",
  "report_sha256",
  "report_evidence_note",
]);

const DATE_KEYS = ["study_start_date", "study_end_date", "report_date"];
const TEXT_KEYS = [
  "date_evidence_note",
  "report_date_evidence_note",
  "source_report_issuer",
  "source_report_approval_no",
  "report_filename",
  "report_evidence_note",
];

function assertWorkspaceProduct(productId) {
  const id = typeof productId === "number" ? productId : Number(productId);
  if (!Number.isInteger(id) || id !== FIRST_CONTROLLED_PRODUCT_ID) {
    throw workerError(
      ERROR_KINDS.PRODUCT_NOT_ALLOWED,
      "QC preparation workspace accepts only product 262.",
    );
  }
  return id;
}

function assertRpc(callRpc) {
  if (typeof callRpc !== "function") {
    throw workerError(ERROR_KINDS.CRASH, "Server RPC adapter is missing.");
  }
}

function toWorkspaceError(error) {
  if (error instanceof WorkerError) return error;
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || error?.errcode || "");
  if (status === 401 || status === 403 || code === "42501" || code === "PGRST301") {
    return workerError(ERROR_KINDS.AUTHORIZATION, "Not authorized for e-Aushadhi automation.");
  }
  if (code === "23505") {
    return workerError(ERROR_KINDS.STALE, "A QC preparation already exists — reload.");
  }
  if (code === "40001" || code === "P0002") {
    return workerError(
      ERROR_KINDS.STALE,
      "Server copy changed — reload to compare; nothing was overwritten.",
    );
  }
  if (code === "22023") {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
  }
  return workerError(ERROR_KINDS.CRASH, "QC preparation workspace failed.");
}

function blank(value) {
  return value == null || String(value).trim() === "";
}

function normalizeQcPayload(input) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
  }
  for (const key of Object.keys(input)) {
    if (!PAYLOAD_KEYS.has(key)) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Unsupported QC draft field.");
    }
  }
  const payload = {};
  const hints = [];
  if (!blank(input.testing_protocol_term_id)) {
    const term = String(input.testing_protocol_term_id).trim();
    if (!/^[0-9]+$/.test(term)) {
      hints.push("PROTOCOL_REQUIRED");
    } else {
      payload.testing_protocol_term_id = term;
    }
  }
  for (const key of TEXT_KEYS) {
    if (!blank(input[key])) payload[key] = String(input[key]).trim();
  }
  if (typeof input.other_testing_protocol_text === "string" && input.other_testing_protocol_text.trim()) {
    const other = input.other_testing_protocol_text.trim();
    if (!qcOtherProtocolTextAccepted(other)) hints.push("OTHER_PROTOCOL_TEXT_INVALID");
    else payload.other_testing_protocol_text = other;
  }
  if (typeof input.portal_laboratory_candidate === "string" && input.portal_laboratory_candidate.length > 0) {
    payload.portal_laboratory_candidate = input.portal_laboratory_candidate;
  }
  if (!blank(input.date_basis)) {
    const basis = String(input.date_basis).trim();
    if (basis !== QC_DATE_BASIS) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Date basis is not an accepted value.");
    }
    payload.date_basis = basis;
  }
  const maxQcDateYear = new Date().getUTCFullYear() + 1;
  for (const key of DATE_KEYS) {
    if (blank(input[key])) continue;
    const date = String(input[key]).trim();
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      hints.push(`${key.toUpperCase()}_REQUIRED_OR_INVALID`);
      continue;
    }
    const year = Number(date.slice(0, 4));
    if (year < 1900 || year > maxQcDateYear) {
      hints.push(`${key.toUpperCase()}_REQUIRED_OR_INVALID`);
    }
    payload[key] = date;
  }
  if (!blank(input.shelf_life_months)) {
    const shelf = String(input.shelf_life_months).trim();
    if (!/^[0-9]{1,4}$/.test(shelf) || Number(shelf) < 1) hints.push("SHELF_LIFE_REQUIRED");
    else payload.shelf_life_months = Number(shelf);
  }
  let duplicateBatches = false;
  if (input.batches != null && !(Array.isArray(input.batches) && input.batches.length === 0)) {
    if (!Array.isArray(input.batches)) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
    }
    const seen = new Set();
    const batches = [];
    let batchFormatInvalid = false;
    for (const item of input.batches) {
      if (item == null || typeof item !== "object" || Array.isArray(item)) {
        throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
      }
      const raw = item.batch_no == null ? "" : String(item.batch_no);
      const batchNo = raw.trim();
      if (!batchNo || !QC_BATCH_TOKEN_RE.test(raw)) {
        batchFormatInvalid = true;
        if (batchNo && QC_BATCH_TOKEN_RE.test(batchNo)) {
          if (seen.has(batchNo)) duplicateBatches = true;
          seen.add(batchNo);
          batches.push({ batch_no: batchNo });
        }
        continue;
      }
      if (seen.has(batchNo)) duplicateBatches = true;
      seen.add(batchNo);
      batches.push({ batch_no: batchNo });
    }
    if (batches.length) {
      const joined = batches.map((item) => item.batch_no).join(",");
      if (joined.length < 2 || joined.length > 256 || new Set(batches.map((item) => item.batch_no)).size !== batches.length) {
        batchFormatInvalid = true;
      }
      payload.batches = batches;
    } else if (input.batches.length) {
      batchFormatInvalid = true;
    }
    if (batchFormatInvalid) hints.push("BATCH_FORMAT_INVALID");
  }
  if (duplicateBatches) hints.push("DUPLICATE_BATCH_NUMBER");
  if (!blank(input.quality_control_mode)) {
    const mode = String(input.quality_control_mode).trim();
    if (mode !== "IN" && mode !== "OUT") {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
    }
    payload.quality_control_mode = mode;
  }
  if (!blank(input.report_sha256)) {
    payload.report_sha256 = String(input.report_sha256).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(payload.report_sha256)) hints.push("REPORT_SHA256_REQUIRED");
  }
  if (payload.quality_control_mode === "OUT" && blank(payload.source_report_issuer)) {
    hints.push("SOURCE_REPORT_ISSUER_REQUIRED");
  }
  if (payload.quality_control_mode === "OUT" && !Object.hasOwn(payload, "portal_laboratory_candidate")) {
    hints.push("PORTAL_LABORATORY_CANDIDATE_REQUIRED");
  }
  if (payload.study_start_date && payload.study_end_date && payload.study_end_date <= payload.study_start_date) {
    hints.push("STUDY_END_NOT_AFTER_START");
  }
  if (payload.study_end_date && payload.report_date && payload.report_date < payload.study_end_date) {
    hints.push("REPORT_DATE_BEFORE_STUDY_END");
  }
  if (payload.report_filename && !QC_CANONICAL_REPORT_FILENAME_RE.test(payload.report_filename)) {
    hints.push("REPORT_FILENAME_NONCANONICAL");
  }
  return { payload, hints, duplicateBatches };
}

const TYPED_FORMAT_HINTS = new Set([
  "PROTOCOL_REQUIRED",
  "STUDY_START_DATE_REQUIRED_OR_INVALID",
  "STUDY_END_DATE_REQUIRED_OR_INVALID",
  "REPORT_DATE_REQUIRED_OR_INVALID",
  "SHELF_LIFE_REQUIRED",
  "OTHER_PROTOCOL_TEXT_INVALID",
  "STUDY_END_NOT_AFTER_START",
  "REPORT_DATE_BEFORE_STUDY_END",
  "BATCH_FORMAT_INVALID",
  "PORTAL_LABORATORY_CANDIDATE_REQUIRED",
  "REPORT_FILENAME_NONCANONICAL",
]);

function hasTypedFormatHint(hints) {
  return hints.some((hint) => TYPED_FORMAT_HINTS.has(hint));
}

function qcOtherProtocolTextAccepted(text) {
  const value = String(text ?? "");
  return value.length >= 1
    && value.length <= 125
    && /\S/.test(value)
    && QC_OTHER_PROTOCOL_TEXT_RE.test(value);
}

function assessQcBatchText(text) {
  const value = String(text ?? "");
  const items = value.split(",");
  if (
    value.length < 2
    || value.length > 256
    || !QC_BATCH_TEXT_RE.test(value)
    || new Set(items).size !== items.length
  ) {
    return { ok: false, hint: "BATCH_FORMAT_INVALID", batches: [] };
  }
  return {
    ok: true,
    hint: null,
    batches: items.map((batch_no) => ({ batch_no })),
  };
}

function assertLaboratoryOptions(data) {
  if (!Array.isArray(data)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC laboratory options were not accepted.");
  }
  const labels = new Set();
  const options = data.map((item) => {
    const portalOptionId = item?.portal_option_id;
    const externalId = item?.external_id;
    const label = item?.label;
    const portalValue = item?.portal_value;
    if (
      typeof portalOptionId !== "number"
      || !Number.isInteger(portalOptionId)
      || typeof externalId !== "string"
      || !/^[0-9]+$/.test(externalId)
      || typeof label !== "string"
      || label.length === 0
      || portalValue !== label
      || labels.has(label)
    ) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC laboratory options were not accepted.");
    }
    labels.add(label);
    return {
      portal_option_id: portalOptionId,
      external_id: externalId,
      label,
      portal_value: portalValue,
    };
  });
  return options;
}

function assertProtocolOptions(data) {
  if (!Array.isArray(data)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC protocol options were not accepted.");
  }
  return data.map((item) => {
    const termId = Number(item?.term_id);
    const code = typeof item?.code === "string" ? item.code : "";
    const label = typeof item?.label === "string" ? item.label : "";
    if (!Number.isInteger(termId) || termId <= 0 || !code || !label) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC protocol options were not accepted.");
    }
    return { term_id: termId, code, label };
  });
}

function assertPreparationList(data) {
  if (!Array.isArray(data)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation read was not accepted.");
  }
  return data;
}

async function loadQcProtocolOptions({ productId, accessToken, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  let data;
  try {
    data = await callRpc(token, QC_PROTOCOL_OPTIONS_RPC, {});
  } catch (error) {
    throw toWorkspaceError(error);
  }
  return {
    ok: true,
    operation: "qc-protocol-options",
    productId: id,
    options: assertProtocolOptions(data),
    mutated: false,
  };
}

async function loadQcLaboratoryOptions({ productId, accessToken, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  let data;
  try {
    data = await callRpc(token, QC_LABORATORY_OPTIONS_RPC, {});
  } catch (error) {
    throw toWorkspaceError(error);
  }
  return {
    ok: true,
    operation: "qc-laboratory-options",
    productId: id,
    options: assertLaboratoryOptions(data),
    mutated: false,
  };
}

async function readQcPreparations({ productId, accessToken, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  let data;
  try {
    data = await callRpc(token, QC_PREPARATION_WORKSPACE_READ_RPC, { p_product_id: id });
  } catch (error) {
    throw toWorkspaceError(error);
  }
  const preparations = assertPreparationList(data);
  const matches = preparations.filter((row) => row?.source_key === QC_PREPARATION_SOURCE_KEY);
  return {
    ok: true,
    operation: "qc-preparation-workspace-read",
    productId: id,
    preparations,
    preparation: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1,
    mutated: false,
  };
}

async function reviewQcPreparation({ productId, accessToken, payload, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const normalized = normalizeQcPayload(payload || {});
  let data;
  try {
    data = await callRpc(token, QC_PREPARATION_REVIEW_RPC, { p_payload: normalized.payload });
  } catch (error) {
    throw toWorkspaceError(error);
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.reasons)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation review was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-preparation-review",
    productId: id,
    review: data,
    hints: normalized.hints,
    mutated: false,
  };
}

async function saveQcPreparation({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  payload,
  lastReadStatus,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  if (lastReadStatus === "VERIFIED") {
    throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Verified — editing is not available in C1.");
  }
  const normalized = normalizeQcPayload(payload || {});
  if (normalized.duplicateBatches) {
    throw workerError(
      ERROR_KINDS.CONTRACT_INCOMPLETE,
      "Duplicate batch numbers must be corrected before saving.",
    );
  }
  if (hasTypedFormatHint(normalized.hints)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Correct the highlighted fields before saving.");
  }
  const creating = preparationId == null || preparationId === "";
  const version = Number(expectedRowVersion);
  if (!Number.isInteger(version) || version < 0) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
  }
  const current = await readQcPreparations({ productId: id, accessToken: token, callRpc });
  if (creating) {
    const existing = current.preparations.some((row) => row?.source_key === QC_PREPARATION_SOURCE_KEY);
    if (existing) {
      throw workerError(ERROR_KINDS.STALE, "A QC preparation already exists — reload.");
    }
  } else {
    const row = current.preparations.find(
      (item) => String(item?.preparation_id) === String(preparationId)
        && item?.source_key === QC_PREPARATION_SOURCE_KEY,
    );
    if (!row || Number(row.row_version) !== version) {
      throw workerError(
        ERROR_KINDS.STALE,
        "Server copy changed — reload to compare; nothing was overwritten.",
      );
    }
    if (row.preparation_status === "VERIFIED") {
      throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Verified — editing is not available in C1.");
    }
  }
  if (Object.hasOwn(normalized.payload, "portal_laboratory_candidate")) {
    const listed = await loadQcLaboratoryOptions({
      productId: id,
      accessToken: token,
      callRpc,
    });
    const known = listed.options.some(
      (item) => item.label === normalized.payload.portal_laboratory_candidate,
    );
    if (!known) {
      throw workerError(
        ERROR_KINDS.CONTRACT_INCOMPLETE,
        "Portal laboratory must match a name from the portal laboratory list.",
        { details: { code: "PORTAL_LABORATORY_CANDIDATE_UNKNOWN" } },
      );
    }
  }
  const args = {
    p_preparation_id: creating ? null : String(preparationId),
    p_product_id: id,
    p_source_key: QC_PREPARATION_SOURCE_KEY,
    p_expected_row_version: version,
    p_payload: normalized.payload,
  };
  let data;
  try {
    data = await callRpc(token, QC_PREPARATION_SAVE_RPC, args);
  } catch (error) {
    throw toWorkspaceError(error);
  }
  if (!data || typeof data !== "object" || data.preparation_id == null) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation save was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-preparation-save",
    productId: id,
    preparation_id: data.preparation_id,
    row_version: data.row_version,
    preparation_status: data.preparation_status,
    review: data.review || null,
    hints: normalized.hints,
    mutated: true,
  };
}

function assertQcUuid(value, message) {
  if (typeof value !== "string" || !QC_UUID_RE.test(value)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
  }
  return value;
}

function assertQcRowVersion(value) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : String(value ?? "");
  if (!/^[0-9]+$/.test(text) || Number(text) <= 0) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC source verification was not accepted.");
  }
  return Number(text);
}

function assertFactEvidence(factEvidence) {
  const message = "Some fact rows need a page reference or an evidence note.";
  if (!factEvidence || typeof factEvidence !== "object" || Array.isArray(factEvidence)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
  }
  const keys = Object.keys(factEvidence);
  if (keys.length !== QC_FACT_KEYS.length || QC_FACT_KEYS.some((key) => !Object.hasOwn(factEvidence, key))) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
  }
  for (const key of QC_FACT_KEYS) {
    const item = factEvidence[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
    }
    if (Object.keys(item).some((prop) => !QC_FACT_ITEM_KEYS.has(prop))) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
    }
    if (typeof item.supported_by_report !== "boolean") {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
    }
    if (item.supported_by_report === true) {
      if (String(item.source_reference ?? "").trim().length < 5) {
        throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
      }
    } else if (String(item.evidence_note ?? "").trim().length < 10) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
    }
  }
}

function qcFactNamesFromIncomplete(message) {
  const body = String(message || "").split("FACT_EVIDENCE_INCOMPLETE:").slice(1).join("FACT_EVIDENCE_INCOMPLETE:");
  const names = new Set();
  for (const part of body.split(",")) {
    const token = part.trim();
    const fact = token.split("_").slice(-1)[0] === token
      ? ""
      : token.replace(/^(FACT_STATUS_REQUIRED_|SUPPORTED_FACT_REFERENCE_REQUIRED_|UNSUPPORTED_FACT_NOTE_REQUIRED_|FACT_UNKNOWN_)/, "");
    const key = fact.toLowerCase();
    if (QC_FACT_KEYS.includes(key)) names.add(key);
  }
  return [...names];
}

function mapQcSourceVerifyError(error) {
  if (error instanceof WorkerError) return error;
  const code = String(error?.code || error?.errcode || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "");
  if (code === "42501" || status === 401 || status === 403) {
    return workerError(ERROR_KINDS.AUTHORIZATION, "You need edit permission for e-Aushadhi.");
  }
  if (message.includes("ATTESTATION_REQUIRED")) {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the review confirmation first.");
  }
  if (message.includes("FACT_EVIDENCE_INCOMPLETE")) {
    return workerError(
      ERROR_KINDS.CONTRACT_INCOMPLETE,
      "Some fact rows need a page reference or an evidence note.",
      { details: { facts: qcFactNamesFromIncomplete(message) } },
    );
  }
  if (message.includes("REPORT_NOT_REGISTERED")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Upload and register the QC report first.");
  }
  if (message.includes("REPORT_BYTES_NOT_VERIFIED")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Run 'Check bytes on server' first.");
  }
  if (message.includes("PAYLOAD_SHA_NOT_VERIFIED_BYTES") || message.includes("PAYLOAD_FILENAME_MISMATCH")) {
    return workerError(
      ERROR_KINDS.STALE,
      "The draft does not match the verified report. Save the draft again from the latest report.",
    );
  }
  if (message.includes("OBJECT_CHANGED_OR_MISSING")) {
    return workerError(ERROR_KINDS.STALE, "The stored report changed or is missing. Upload a new version.");
  }
  if (message.includes("ASSET_NOT_VERIFIED") || message.includes("BYTE_EVENT_MISSING")) {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The report's verification record is incomplete. Contact support.");
  }
  if (message.includes("Stale QC draft version")) {
    return workerError(ERROR_KINDS.STALE, "Someone changed this draft. Reload and try again.");
  }
  if (/already source verified/i.test(message)) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Already verified.");
  }
  if (message.includes("complete human-entered fields")) {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Complete the QC draft fields before verifying source facts.");
  }
  return workerError(ERROR_KINDS.CRASH, "QC source verification failed.");
}

async function verifyQcPreparationSource({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  attest,
  factEvidence,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "QC source verification was not accepted.");
  const version = assertQcRowVersion(expectedRowVersion);
  if (attest !== true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the review confirmation first.");
  }
  assertFactEvidence(factEvidence);
  let data;
  try {
    data = await callRpc(token, QC_PREPARATION_VERIFY_SOURCE_RPC, {
      p_preparation_id: preparation,
      p_expected_row_version: version,
      p_attest: true,
      p_fact_evidence: factEvidence,
    });
  } catch (error) {
    throw mapQcSourceVerifyError(error);
  }
  if (!data || typeof data !== "object" || data.preparation_id == null) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC source verification was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-preparation-verify-source",
    productId: id,
    preparation_id: data.preparation_id,
    row_version: data.row_version,
    preparation_status: data.preparation_status,
    verified_payload_hash: data.verified_payload_hash,
    binding_id: data.binding_id,
    reservation_id: data.reservation_id,
    verified_sha256: data.verified_sha256,
    mutated: true,
  };
}

async function recheckQcEvidence({ productId, accessToken, preparationId, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "QC evidence recheck was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_EVIDENCE_RECHECK_RPC, {
      p_product_id: id,
      p_preparation_id: preparation,
    });
  } catch (error) {
    throw toWorkspaceError(error);
  }
  if (!data || typeof data !== "object" || typeof data.valid !== "boolean" || !Array.isArray(data.reasons)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC evidence recheck was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-evidence-recheck",
    productId: id,
    valid: data.valid === true,
    reasons: data.reasons.map((reason) => String(reason)),
    binding_id: data.binding_id ?? null,
    reservation_id: data.reservation_id ?? null,
    verified_sha256: data.verified_sha256 || "",
    portal_laboratory_candidate_status: data.portal_laboratory_candidate_status || "",
    checked_at: data.checked_at || null,
    binding_superseded: data.binding_superseded === true,
    fact_evidence: data.fact_evidence && typeof data.fact_evidence === "object" && !Array.isArray(data.fact_evidence)
      ? data.fact_evidence
      : null,
    mutated: false,
  };
}

function assertQcReopenVersion(value) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : String(value ?? "");
  if (!/^[0-9]+$/.test(text) || Number(text) <= 0) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Reopen failed.");
  }
  return Number(text);
}

function mapQcReopenError(error) {
  if (error instanceof WorkerError) return error;
  const code = String(error?.code || error?.errcode || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "");
  if (code === "PGRST202" || status === 404 || message.includes("PGRST202")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Reopen is not available on the server yet.");
  }
  if (code === "42501" || status === 401 || status === 403) {
    return workerError(ERROR_KINDS.AUTHORIZATION, "You need edit permission for e-Aushadhi.");
  }
  if (code === "40001" || message.includes("40001") || message.includes("Stale QC draft version")) {
    return workerError(ERROR_KINDS.STALE, "Someone changed this draft. Reload and try again.");
  }
  if (message.includes("REOPEN_NOT_VERIFIED")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "This draft is not verified.");
  }
  if (message.includes("REOPEN_REASON_REQUIRED")) {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a reason of at least 10 characters.");
  }
  if (message.includes("ATTESTATION_REQUIRED")) {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
  }
  return workerError(ERROR_KINDS.CRASH, "Reopen failed.");
}

async function reopenQcPreparation({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  attest,
  reasonNote,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "Reopen failed.");
  const version = assertQcReopenVersion(expectedRowVersion);
  if (attest !== true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
  }
  const note = String(reasonNote ?? "").trim();
  if (note.length < 10 || note.length > 2000) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a reason of at least 10 characters.");
  }
  let data;
  try {
    data = await callRpc(token, QC_PREPARATION_REOPEN_RPC, {
      p_preparation_id: preparation,
      p_expected_row_version: version,
      p_attest: true,
      p_reason_note: note,
    });
  } catch (error) {
    throw mapQcReopenError(error);
  }
  if (!data || typeof data !== "object" || data.preparation_id == null) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Reopen failed.");
  }
  return {
    ok: true,
    operation: "qc-preparation-reopen",
    productId: id,
    preparation_id: data.preparation_id,
    row_version: data.row_version,
    preparation_status: data.preparation_status,
    superseded_binding_id: data.superseded_binding_id ?? null,
    supersession_id: data.supersession_id ?? null,
    mutated: true,
  };
}

function qcEvidenceReasonText(code) {
  const text = String(code || "");
  if (text === "NOT_SOURCE_VERIFIED") return "Not verified yet";
  if (text === "BINDING_SUPERSEDED") return "Reopened — verify again";
  if (text === "BINDING_STALE_PREPARATION_VERSION" || text === "PAYLOAD_HASH_CHANGED") return "Draft edited after verification";
  if (text === "SUPERSEDED_BY_NEWER_REPORT") return "A newer report version was registered";
  if (text.startsWith("OBJECT_")) return "Stored report changed";
  if (text.startsWith("TUPLE_MISMATCH_")) return "Evidence record mismatch";
  return "Needs re-verify";
}

function qcEvidenceBadge(recheck) {
  const reasons = Array.isArray(recheck?.reasons) ? recheck.reasons.map((reason) => String(reason)) : [];
  const unique = new Set(reasons);
  if (unique.size === 2 && unique.has("NOT_SOURCE_VERIFIED") && unique.has("NO_BINDING")) {
    return { tone: "pending", label: "Not verified yet", detail: "" };
  }
  if (recheck?.valid === true) {
    return { tone: "valid", label: "Evidence valid ✓", detail: "" };
  }
  const detail = reasons.length ? qcEvidenceReasonText(reasons[0]) : "Needs re-verify";
  return { tone: "attention", label: "Needs re-verify", detail };
}

module.exports = {
  QC_PROTOCOL_OPTIONS_RPC,
  QC_LABORATORY_OPTIONS_RPC,
  QC_PREPARATION_WORKSPACE_READ_RPC,
  QC_PREPARATION_REVIEW_RPC,
  QC_PREPARATION_SAVE_RPC,
  QC_PREPARATION_VERIFY_SOURCE_RPC,
  QC_PREPARATION_REOPEN_RPC,
  QC_EVIDENCE_RECHECK_RPC,
  QC_FACT_KEYS,
  QC_PREPARATION_SOURCE_KEY,
  QC_DATE_BASIS,
  QC_CANONICAL_REPORT_FILENAME,
  QC_CANONICAL_REPORT_FILENAME_RE,
  QC_OTHER_PROTOCOL_TEXT_RE,
  normalizeQcPayload,
  assessQcBatchText,
  assertLaboratoryOptions,
  qcOtherProtocolTextAccepted,
  loadQcProtocolOptions,
  loadQcLaboratoryOptions,
  readQcPreparations,
  reviewQcPreparation,
  saveQcPreparation,
  mapQcSourceVerifyError,
  verifyQcPreparationSource,
  mapQcReopenError,
  reopenQcPreparation,
  recheckQcEvidence,
  qcEvidenceBadge,
};
