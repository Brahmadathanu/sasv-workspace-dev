/* eslint-env node */

const { ERROR_KINDS, WorkerError, workerError } = require("./errors");
const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { validateAccessToken } = require("./validate");

const QC_PROTOCOL_OPTIONS_RPC = "rpc_eaushadhi_qc_protocol_options_v1";
const QC_PREPARATION_WORKSPACE_READ_RPC = "rpc_eaushadhi_qc_preparation_read_v1";
const QC_PREPARATION_REVIEW_RPC = "rpc_eaushadhi_qc_preparation_review_v1";
const QC_PREPARATION_SAVE_RPC = "rpc_eaushadhi_qc_preparation_save_v1";
const QC_PREPARATION_SOURCE_KEY = "manual-qc:262:primary";
const QC_DATE_BASIS = "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN";

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
  "other_testing_protocol_text",
  "date_evidence_note",
  "report_date_evidence_note",
  "source_report_issuer",
  "source_report_approval_no",
  "portal_laboratory_candidate",
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
  if (!blank(input.date_basis)) {
    const basis = String(input.date_basis).trim();
    if (basis !== QC_DATE_BASIS) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "Date basis is not an accepted value.");
    }
    payload.date_basis = basis;
  }
  for (const key of DATE_KEYS) {
    if (blank(input[key])) continue;
    const date = String(input[key]).trim();
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      hints.push(`${key.toUpperCase()}_REQUIRED_OR_INVALID`);
      continue;
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
    for (const item of input.batches) {
      if (item == null || typeof item !== "object" || Array.isArray(item)) {
        throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
      }
      const batchNo = blank(item.batch_no) ? "" : String(item.batch_no).trim();
      if (!batchNo) continue;
      if (seen.has(batchNo)) duplicateBatches = true;
      seen.add(batchNo);
      batches.push({ batch_no: batchNo });
    }
    if (batches.length) payload.batches = batches;
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
  return { payload, hints, duplicateBatches };
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
  const creating = preparationId == null || preparationId === "";
  const version = Number(expectedRowVersion);
  if (!Number.isInteger(version) || version < 0) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation draft was not accepted.");
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

module.exports = {
  QC_PROTOCOL_OPTIONS_RPC,
  QC_PREPARATION_WORKSPACE_READ_RPC,
  QC_PREPARATION_REVIEW_RPC,
  QC_PREPARATION_SAVE_RPC,
  QC_PREPARATION_SOURCE_KEY,
  QC_DATE_BASIS,
  normalizeQcPayload,
  loadQcProtocolOptions,
  readQcPreparations,
  reviewQcPreparation,
  saveQcPreparation,
};
