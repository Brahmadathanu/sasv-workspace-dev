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
const QC_READINESS_RPC = "rpc_eaushadhi_qc_readiness_v1";
const QC_FACT_ACCEPT_RPC = "rpc_eaushadhi_qc_fact_accept_v1";
const QC_FACT_CORRECT_RPC = "rpc_eaushadhi_qc_fact_acceptance_correct_v1";
const QC_PROTOCOL_MAPPING_VERIFY_RPC = "rpc_eaushadhi_qc_protocol_mapping_verify_v1";
const QC_FILL_PREFLIGHT_RPC = "rpc_eaushadhi_qc_prep_run_preflight_v1";
const QC_LAB_DECISION_RPC = "rpc_eaushadhi_qc_lab_decision_record_v1";
const QC_ACCEPT_FACT_KEYS = ["study_start_date", "testing_protocol"];
const QC_BASIS_CATEGORIES = [
  "MANUFACTURING_RECORDS",
  "PHARMACOPOEIA_OR_MONOGRAPH",
  "REGULATORY_GUIDANCE",
  "LABORATORY_CORRESPONDENCE",
  "OPERATOR_DETERMINATION",
  "OPERATOR_DERIVATION",
];
const QC_LAB_ACTIONS = ["INITIAL", "CORRECTION", "REPLACEMENT", "WITHDRAWAL"];
const QC_LAB_BASIS_TYPE = "CROSS_LABORATORY_TIE_UP";
const QC_FACT_LABELS = {
  study_start_date: "Study start date",
  study_end_date: "Study end date",
  report_date: "Report date",
  testing_protocol: "Testing protocol",
  batches: "Batches",
  shelf_life_months: "Shelf life",
};
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

function assertQcRowVersion(value, message = "QC source verification was not accepted.") {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : String(value ?? "");
  if (!/^[0-9]+$/.test(text) || Number(text) <= 0 || !Number.isSafeInteger(Number(text))) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
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

function qcFactLabel(factKey) {
  const key = String(factKey || "").toLowerCase();
  return QC_FACT_LABELS[key] || key.replaceAll("_", " ");
}

function qcReadinessReasonText(code) {
  const text = String(code || "");
  if (text.startsWith("FACT_ACCEPTANCE_MISSING_")) {
    return `${qcFactLabel(text.slice("FACT_ACCEPTANCE_MISSING_".length))} needs acceptance by a colleague`;
  }
  if (text.startsWith("FACT_SELF_ACCEPTED_")) {
    return `${qcFactLabel(text.slice("FACT_SELF_ACCEPTED_".length))} was accepted by the same person who verified; a different editor must accept`;
  }
  if (text === "LAB_DECISION_MISSING") return "Record the laboratory decision";
  if (text === "LAB_DECISION_STALE_BINDING") return "Laboratory decision was made on older evidence; record a correction";
  if (text === "LAB_DECISION_WITHDRAWN") return "Laboratory decision withdrawn";
  if (text.startsWith("EVIDENCE_")) return qcEvidenceReasonText(text.slice("EVIDENCE_".length));
  if (text === "PAYLOAD_DRIFT_SINCE_VERIFY") return "Draft edited after verification";
  return qcEvidenceReasonText(text);
}

function qcReadinessBadge(readiness) {
  const status = String(readiness?.status || "");
  if (status === "READY") return { tone: "ready", label: "Ready" };
  if (status === "READY_PROVISIONAL") return { tone: "provisional", label: "Ready (provisional)" };
  return { tone: "not-ready", label: "Not ready" };
}

function mapQcReadinessError(error) {
  if (error instanceof WorkerError) return error;
  const code = String(error?.code || error?.errcode || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "");
  if (code === "PGRST202" || status === 404 || message.includes("PGRST202")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Not available on the server yet.");
  }
  if (code === "42501" || status === 401 || status === 403) {
    return workerError(ERROR_KINDS.AUTHORIZATION, "You need view permission for e-Aushadhi.");
  }
  return workerError(ERROR_KINDS.CRASH, "QC readiness failed.");
}

function mapQcGovernanceError(error, fallback) {
  if (error instanceof WorkerError) return error;
  const code = String(error?.code || error?.errcode || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "");
  if (code === "PGRST202" || status === 404 || message.includes("PGRST202")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Not available on the server yet.");
  }
  if (code === "42501" || status === 401 || status === 403) {
    return workerError(ERROR_KINDS.AUTHORIZATION, "You need edit permission for e-Aushadhi.");
  }
  const table = [
    ["SUPERSEDES_NOT_CURRENT_HEAD", ERROR_KINDS.STALE, "Someone changed the laboratory decision. Reload and try again."],
    ["ACCEPTANCE_ALREADY_SUPERSEDED", ERROR_KINDS.STALE, "Someone already corrected this acceptance. Reload and try again."],
    ["EVIDENCE_NOT_CURRENT", ERROR_KINDS.STALE, "The verified evidence changed. Reload and try again."],
    ["MAPPING_STATE_CHANGED", ERROR_KINDS.STALE, "The mapping changed. Reload and try again."],
    ["MAPPING_OPTION_CHANGED", ERROR_KINDS.STALE, "The portal option changed. Reload and try again."],
    ["Stale QC draft version", ERROR_KINDS.STALE, "Someone changed this draft. Reload and try again."],
    ["ACCEPTANCE_NOT_ON_CURRENT_BINDING", ERROR_KINDS.CONTRACT_INCOMPLETE, "This acceptance belongs to older evidence."],
    ["CORRECTION_REASON_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a correction reason of at least 10 characters."],
    ["MAPPING_REASON_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a mapping reason of at least 10 characters."],
    ["ONLY_DRAFT_CAN_BE_VERIFIED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Only a draft mapping can be verified."],
    ["MAPPING_NOT_CURRENT", ERROR_KINDS.CONTRACT_INCOMPLETE, "This mapping is not current."],
    ["TERM_NOT_ACTIVE_QC_PROTOCOL", ERROR_KINDS.CONTRACT_INCOMPLETE, "The protocol term is not an active QC protocol."],
    ["OPTION_NOT_ACTIVE_QC_PROTOCOL", ERROR_KINDS.CONTRACT_INCOMPLETE, "The portal option is not an active QC protocol option."],
    ["TERM_ALREADY_HAS_VERIFIED_MAPPING", ERROR_KINDS.CONTRACT_INCOMPLETE, "This protocol already has a verified mapping."],
    ["ACCEPTANCE_NOT_FOUND", ERROR_KINDS.CONTRACT_INCOMPLETE, "That acceptance was not found."],
    ["MAPPING_NOT_FOUND", ERROR_KINDS.CONTRACT_INCOMPLETE, "The mapping was not found."],
    ["QC draft missing", ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC draft is missing."],
    ["QC draft not found for product", ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC draft was not found."],
    ["ATTESTATION_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first."],
    ["BASIS_NOTE_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a basis note of at least 10 characters."],
    ["BASIS_CATEGORY_INVALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose a valid basis category."],
    ["EVIDENCE_NOT_VALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "The verified evidence is no longer valid. Verify source facts again first."],
    ["FACT_UNKNOWN", ERROR_KINDS.CONTRACT_INCOMPLETE, "That fact cannot be accepted."],
    ["FACT_IS_REPORT_SUPPORTED", ERROR_KINDS.CONTRACT_INCOMPLETE, "This fact is shown in the report and does not need acceptance."],
    ["FACT_ALREADY_ACCEPTED", ERROR_KINDS.CONTRACT_INCOMPLETE, "This fact is already accepted for the current evidence."],
    ["DECISION_ACTION_INVALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose a valid laboratory decision."],
    ["BASIS_TYPE_INVALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "The laboratory basis must be a cross laboratory tie-up."],
    ["DOCUMENT_REFERENCE_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Enter a document reference of at least 5 characters."],
    ["RATIONALE_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a rationale of at least 10 characters."],
    ["DOCUMENT_ASSET_INVALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "The attached document is not valid."],
    ["DECISION_EXISTS_USE_CORRECTION_REPLACEMENT_OR_WITHDRAWAL", ERROR_KINDS.CONTRACT_INCOMPLETE, "A laboratory decision already exists. Correct, replace, or withdraw it."],
    ["INITIAL_CANNOT_SUPERSEDE", ERROR_KINDS.CONTRACT_INCOMPLETE, "The first laboratory decision cannot replace an earlier one."],
    ["ALREADY_WITHDRAWN", ERROR_KINDS.CONTRACT_INCOMPLETE, "The laboratory decision is already withdrawn."],
    ["LAB_FIELDS_MISSING", ERROR_KINDS.CONTRACT_INCOMPLETE, "The draft is missing the report issuer or the portal laboratory."],
    ["PORTAL_LAB_NOT_FOUND", ERROR_KINDS.CONTRACT_INCOMPLETE, "The portal laboratory on the draft was not found."],
  ];
  for (const [token, kind, plain] of table) {
    if (message.includes(token)) return workerError(kind, plain);
  }
  if (code === "40001") {
    return workerError(ERROR_KINDS.STALE, "Someone changed this draft. Reload and try again.");
  }
  return workerError(ERROR_KINDS.CRASH, fallback);
}

function assertTrimmedSpan(value, min, max, message) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, message);
  }
  return text;
}

async function readQcReadiness({ productId, accessToken, preparationId, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "QC readiness was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_READINESS_RPC, {
      p_product_id: id,
      p_preparation_id: preparation,
    });
  } catch (error) {
    throw mapQcReadinessError(error);
  }
  if (!data || typeof data !== "object" || typeof data.status !== "string") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC readiness was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-readiness",
    productId: id,
    status: data.status,
    reasons: Array.isArray(data.reasons) ? data.reasons.map((reason) => String(reason)) : [],
    flags: Array.isArray(data.flags) ? data.flags.map((flag) => String(flag)) : [],
    preparation_id: data.preparation_id ?? preparation,
    preparation_row_version: data.preparation_row_version ?? null,
    binding_id: data.binding_id ?? null,
    verified_by: data.verified_by ?? null,
    verified_at: data.verified_at ?? null,
    evidence_valid: data.evidence_valid === true,
    report_supported_facts: Array.isArray(data.report_supported_facts)
      ? data.report_supported_facts.map((fact) => String(fact))
      : [],
    operator_asserted_facts: Array.isArray(data.operator_asserted_facts) ? data.operator_asserted_facts : [],
    lab_basis: data.lab_basis && typeof data.lab_basis === "object" && !Array.isArray(data.lab_basis) ? data.lab_basis : null,
    canonical_promotion: data.canonical_promotion ?? null,
    portal_submission: data.portal_submission ?? null,
    checked_at: data.checked_at ?? null,
    mutated: false,
  };
}

async function acceptQcFact({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  factKey,
  basisCategory,
  basisNote,
  attest,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "Fact acceptance was not accepted.");
  const version = assertQcRowVersion(expectedRowVersion, "Fact acceptance was not accepted.");
  if (attest !== true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
  }
  if (!QC_ACCEPT_FACT_KEYS.includes(factKey)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "That fact cannot be accepted.");
  }
  if (!QC_BASIS_CATEGORIES.includes(basisCategory)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose a valid basis category.");
  }
  const note = assertTrimmedSpan(basisNote, 10, 2000, "Write a basis note of at least 10 characters.");
  let data;
  try {
    data = await callRpc(token, QC_FACT_ACCEPT_RPC, {
      p_preparation_id: preparation,
      p_expected_row_version: version,
      p_fact_key: factKey,
      p_basis_category: basisCategory,
      p_basis_note: note,
      p_attest: true,
    });
  } catch (error) {
    throw mapQcGovernanceError(error, "Fact acceptance failed.");
  }
  if (!data || typeof data !== "object" || data.acceptance_id == null) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Fact acceptance was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-fact-accept",
    productId: id,
    acceptance_id: data.acceptance_id,
    binding_id: data.binding_id,
    fact_key: data.fact_key,
    self_accepted: data.self_accepted === true,
    mutated: true,
  };
}

async function recordQcLabDecision({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  action,
  supersedesLabBasisId,
  basisType,
  documentReference,
  rationale,
  attest,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "Laboratory decision was not accepted.");
  const version = assertQcRowVersion(expectedRowVersion, "Laboratory decision was not accepted.");
  if (attest !== true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
  }
  if (!QC_LAB_ACTIONS.includes(action)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose a valid laboratory decision.");
  }
  let supersedes = null;
  if (action === "INITIAL") {
    if (supersedesLabBasisId != null && supersedesLabBasisId !== "") {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The first laboratory decision cannot replace an earlier one.");
    }
  } else {
    supersedes = assertQcRowVersion(
      supersedesLabBasisId,
      "Someone changed the laboratory decision. Reload and try again.",
    );
  }
  if (basisType !== QC_LAB_BASIS_TYPE) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The laboratory basis must be a cross laboratory tie-up.");
  }
  const reference = String(documentReference ?? "").trim();
  if (reference.length < 5) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Enter a document reference of at least 5 characters.");
  }
  const note = assertTrimmedSpan(rationale, 10, 2000, "Write a rationale of at least 10 characters.");
  let data;
  try {
    data = await callRpc(token, QC_LAB_DECISION_RPC, {
      p_preparation_id: preparation,
      p_expected_row_version: version,
      p_action: action,
      p_supersedes_lab_basis_id: supersedes,
      p_basis_type: QC_LAB_BASIS_TYPE,
      p_document_reference: reference,
      p_document_asset_id: null,
      p_rationale: note,
      p_attest: true,
    });
  } catch (error) {
    throw mapQcGovernanceError(error, "Laboratory decision failed.");
  }
  if (!data || typeof data !== "object" || data.lab_basis_id == null) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Laboratory decision was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-lab-decision",
    productId: id,
    lab_basis_id: data.lab_basis_id,
    decision_action: data.decision_action,
    basis_status: data.basis_status,
    supersedes_lab_basis_id: data.supersedes_lab_basis_id ?? null,
    preparation_row_version: data.preparation_row_version,
    binding_id: data.binding_id,
    report_issuer: data.report_issuer,
    portal_laboratory: data.portal_laboratory,
    portal_external_id: data.portal_external_id,
    legal_lab_identity_verified: false,
    portal_eligibility_verified: false,
    mutated: true,
  };
}

function mapQcFillPreflightError(error) {
  if (error instanceof WorkerError) return error;
  const code = String(error?.code || error?.errcode || "");
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "");
  if (code === "PGRST202" || status === 404 || message.includes("PGRST202")) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Not available on the server yet.");
  }
  if (code === "42501" || status === 401 || status === 403) {
    return workerError(ERROR_KINDS.AUTHORIZATION, "You need view permission for e-Aushadhi.");
  }
  if (code === "P0002" || message.includes("QC draft")) {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC draft was not found.");
  }
  return workerError(ERROR_KINDS.CRASH, "QC filling preflight failed.");
}

async function correctQcFactAcceptance({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  supersedesAcceptanceId,
  basisCategory,
  basisNote,
  correctionReason,
  attest,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "Fact correction was not accepted.");
  const version = assertQcRowVersion(expectedRowVersion, "Fact correction was not accepted.");
  const supersedes = assertQcRowVersion(supersedesAcceptanceId, "Fact correction was not accepted.");
  if (attest !== true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
  }
  if (!QC_BASIS_CATEGORIES.includes(basisCategory)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose a valid basis category.");
  }
  const note = assertTrimmedSpan(basisNote, 10, 2000, "Write a basis note of at least 10 characters.");
  const reason = assertTrimmedSpan(correctionReason, 10, 2000, "Write a correction reason of at least 10 characters.");
  let data;
  try {
    data = await callRpc(token, QC_FACT_CORRECT_RPC, {
      p_preparation_id: preparation,
      p_expected_row_version: version,
      p_supersedes_acceptance_id: supersedes,
      p_basis_category: basisCategory,
      p_basis_note: note,
      p_correction_reason: reason,
      p_attest: true,
    });
  } catch (error) {
    throw mapQcGovernanceError(error, "Fact correction failed.");
  }
  if (!data || typeof data !== "object" || data.acceptance_id == null) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Fact correction was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-fact-correct",
    productId: id,
    acceptance_id: data.acceptance_id,
    supersedes_acceptance_id: data.supersedes_acceptance_id,
    binding_id: data.binding_id,
    fact_key: data.fact_key,
    self_accepted: data.self_accepted === true,
    mutated: true,
  };
}

async function verifyQcProtocolMapping({
  productId,
  accessToken,
  mappingId,
  expectedStatus,
  expectedPortalOptionId,
  mappingReason,
  attest,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const mapping = assertQcRowVersion(mappingId, "Protocol mapping verification was not accepted.");
  if (expectedStatus !== "DRAFT") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Only a draft mapping can be verified.");
  }
  const optionId = assertQcRowVersion(expectedPortalOptionId, "Protocol mapping verification was not accepted.");
  if (attest !== true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
  }
  const reason = assertTrimmedSpan(mappingReason, 10, 2000, "Write a mapping reason of at least 10 characters.");
  let data;
  try {
    data = await callRpc(token, QC_PROTOCOL_MAPPING_VERIFY_RPC, {
      p_mapping_id: mapping,
      p_expected_status: "DRAFT",
      p_expected_portal_option_id: optionId,
      p_mapping_reason: reason,
      p_attest: true,
    });
  } catch (error) {
    throw mapQcGovernanceError(error, "Protocol mapping verification failed.");
  }
  if (!data || typeof data !== "object" || data.mapping_id == null || data.mapping_status !== "VERIFIED") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Protocol mapping verification was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-protocol-mapping-verify",
    productId: id,
    mapping_id: data.mapping_id,
    mapping_status: data.mapping_status,
    term_code: data.term_code,
    portal_external_id: data.portal_external_id,
    portal_label: data.portal_label,
    verified_by: data.verified_by,
    mutated: true,
  };
}

async function readQcFillPreflight({ productId, accessToken, preparationId, callRpc } = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "QC filling preflight was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_FILL_PREFLIGHT_RPC, {
      p_product_id: id,
      p_preparation_id: preparation,
    });
  } catch (error) {
    throw mapQcFillPreflightError(error);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC filling preflight was not accepted.");
  }
  const mapping = data.protocol_mapping;
  return {
    ok: true,
    operation: "qc-fill-preflight",
    productId: id,
    blockers: Array.isArray(data.blockers) ? data.blockers.map((code) => String(code)) : [],
    readiness: data.readiness && typeof data.readiness === "object" && !Array.isArray(data.readiness) ? data.readiness : null,
    protocol_mapping: mapping && typeof mapping === "object" && !Array.isArray(mapping) ? mapping : null,
    fill_fields: data.fill_fields && typeof data.fill_fields === "object" && !Array.isArray(data.fill_fields) ? data.fill_fields : null,
    context: data.context && typeof data.context === "object" && !Array.isArray(data.context) ? data.context : null,
    runs: Array.isArray(data.runs) ? data.runs : [],
    mutated: false,
  };
}

const QC_PREP_RUN_ARM_RPC = "rpc_eaushadhi_qc_prep_run_arm_v1";
const QC_PREP_RUN_PRE_SAVE_RPC = "rpc_eaushadhi_qc_prep_run_pre_save_v1";
const QC_PREP_RUN_RECORD_SAVE_RPC = "rpc_eaushadhi_qc_prep_run_record_save_v1";
const QC_PREP_RUN_RESOLVE_RPC = "rpc_eaushadhi_qc_prep_run_resolve_ambiguous_v1";
const QC_PREP_RUN_VERIFY_ROW_RPC = "rpc_eaushadhi_qc_prep_run_verify_row_v1";

function mapQcPrepRunError(error) {
  if (error instanceof WorkerError) return error;
  const code = String(error?.code || error?.errcode || "");
  const message = String(error?.message || "");
  const known = [
    ["READINESS_CHANGED", ERROR_KINDS.STALE, "Readiness changed. Reload preflight. Nothing was armed."],
    ["PROVISIONAL_LAB_ACK_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the provisional laboratory acknowledgement and write at least 10 characters."],
    ["DERIVED_FACT_ACK_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the derived-date acknowledgement and write at least 10 characters."],
    ["PAGE_IDENTITY_INVALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "The portal page is not Add QC Register for product 262. Nothing was armed."],
    ["BEFORE_LIST_EVIDENCE_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC list was not fully read. Nothing was armed."],
    ["AFTER_LIST_EVIDENCE_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC list was not fully read."],
    ["ACTIVE_RUN_EXISTS", ERROR_KINDS.STALE, "A QC filling run is already open. Continue that run."],
    ["ALREADY_ROW_VERIFIED", ERROR_KINDS.PREFLIGHT_DENIED, "A QC row is already verified for this product. Filling will not start."],
    ["ARM_BLOCKED", ERROR_KINDS.PREFLIGHT_DENIED, "Filling was not started."],
    ["SAVE_ONLY_SUBMIT_REFUSED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Submit is not allowed. The outcome was not recorded as a successful Save."],
    ["restricted to Product 262", ERROR_KINDS.AUTHORIZATION, "QC filling is only for product 262."],
    ["RUN_NOT_FOUND", ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC filling run was not found."],
  ];
  for (const [needle, kind, text] of known) {
    if (message.includes(needle)) return workerError(kind, text);
  }
  if (code === "42501" || code === "PGRST301") {
    return workerError(ERROR_KINDS.AUTHORIZATION, "QC filling is only for product 262.");
  }
  if (code === "40001") return workerError(ERROR_KINDS.STALE, "Readiness changed. Reload preflight. Nothing was armed.");
  if (code === "PGRST202") return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Not available on the server yet.");
  return workerError(ERROR_KINDS.CRASH, "QC filling failed.");
}

async function armQcPrepRun({
  productId,
  accessToken,
  preparationId,
  expectedReadinessTuple,
  provisionalLabAck,
  provisionalAckNote,
  pageIdentityEvidence,
  beforeListEvidence,
  derivedFactAck,
  derivedFactAckNote,
  callRpc,
} = {}) {
  const id = assertWorkspaceProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const preparation = assertQcUuid(preparationId, "QC filling was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_PREP_RUN_ARM_RPC, {
      p_product_id: id,
      p_preparation_id: preparation,
      p_expected_readiness_tuple: String(expectedReadinessTuple || ""),
      p_provisional_lab_ack: provisionalLabAck === true,
      p_provisional_ack_note: String(provisionalAckNote || ""),
      p_page_identity_evidence: pageIdentityEvidence,
      p_before_list_evidence: beforeListEvidence,
      p_derived_fact_ack: derivedFactAck === true,
      p_derived_fact_ack_note: String(derivedFactAckNote || ""),
    });
  } catch (error) {
    throw mapQcPrepRunError(error);
  }
  if (!data || data.run_status !== "SAVE_ARMED" || !data.run_id) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC filling was not armed.");
  }
  return data;
}

async function preSaveQcPrepRun({
  accessToken,
  runId,
  pageIdentityEvidence,
  filledValues,
  callRpc,
} = {}) {
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const run = assertQcUuid(runId, "QC filling was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_PREP_RUN_PRE_SAVE_RPC, {
      p_run_id: run,
      p_page_identity_evidence: pageIdentityEvidence,
      p_filled_values: filledValues,
    });
  } catch (error) {
    throw mapQcPrepRunError(error);
  }
  if (!data || typeof data !== "object") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The save check was not accepted.");
  }
  return data;
}

async function recordQcPrepRunSave({
  accessToken,
  runId,
  preSaveToken,
  saveOutcome,
  saveEvidence,
  callRpc,
} = {}) {
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const run = assertQcUuid(runId, "QC filling was not accepted.");
  if (!["CONFIRMED", "AMBIGUOUS", "REJECTED"].includes(saveOutcome)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The save result was not accepted.");
  }
  if (!saveEvidence || saveEvidence.action !== "SAVE" || saveEvidence.submitted === true) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Submit is not allowed. The outcome was not recorded as a successful Save.");
  }
  let data;
  try {
    data = await callRpc(token, QC_PREP_RUN_RECORD_SAVE_RPC, {
      p_run_id: run,
      p_pre_save_token: preSaveToken || null,
      p_save_outcome: saveOutcome,
      p_save_evidence: saveEvidence,
    });
  } catch (error) {
    throw mapQcPrepRunError(error);
  }
  if (!data || typeof data.run_status !== "string") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The save result was not recorded.");
  }
  return data;
}

async function resolveQcPrepRunAmbiguous({
  accessToken,
  runId,
  resolution,
  afterListEvidence,
  note,
  attest,
  callRpc,
} = {}) {
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const run = assertQcUuid(runId, "QC filling was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_PREP_RUN_RESOLVE_RPC, {
      p_run_id: run,
      p_resolution: resolution,
      p_after_list_evidence: afterListEvidence,
      p_note: note,
      p_attest: attest === true,
    });
  } catch (error) {
    throw mapQcPrepRunError(error);
  }
  if (!data || typeof data.run_status !== "string") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The list result was not accepted.");
  }
  return data;
}

async function verifyQcPrepRunRow({
  accessToken,
  runId,
  afterListEvidence,
  rereadValues,
  resolvedPortalRowId,
  callRpc,
} = {}) {
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const run = assertQcUuid(runId, "QC filling was not accepted.");
  let data;
  try {
    data = await callRpc(token, QC_PREP_RUN_VERIFY_ROW_RPC, {
      p_run_id: run,
      p_after_list_evidence: afterListEvidence,
      p_reread_values: rereadValues,
      p_resolved_portal_row_id: String(resolvedPortalRowId || ""),
    });
  } catch (error) {
    throw mapQcPrepRunError(error);
  }
  if (!data || typeof data.run_status !== "string") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "The row check was not accepted.");
  }
  return data;
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
  QC_READINESS_RPC,
  QC_FACT_ACCEPT_RPC,
  QC_FACT_CORRECT_RPC,
  QC_PROTOCOL_MAPPING_VERIFY_RPC,
  QC_FILL_PREFLIGHT_RPC,
  QC_LAB_DECISION_RPC,
  QC_ACCEPT_FACT_KEYS,
  QC_BASIS_CATEGORIES,
  QC_LAB_ACTIONS,
  QC_LAB_BASIS_TYPE,
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
  qcFactLabel,
  qcReadinessReasonText,
  qcReadinessBadge,
  mapQcReadinessError,
  mapQcGovernanceError,
  readQcReadiness,
  acceptQcFact,
  correctQcFactAcceptance,
  verifyQcProtocolMapping,
  mapQcFillPreflightError,
  readQcFillPreflight,
  mapQcPrepRunError,
  armQcPrepRun,
  preSaveQcPrepRun,
  recordQcPrepRunSave,
  resolveQcPrepRunAmbiguous,
  verifyQcPrepRunRow,
  recordQcLabDecision,
};
