/* eslint-env node */

const { ERROR_KINDS, WorkerError, workerError } = require("./errors");
const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { validateAccessToken } = require("./validate");

const QC_PREPARATION_READ_RPC = "rpc_eaushadhi_qc_preparation_read_v1";
const QC_REPORT_LIST_RPC = "rpc_eaushadhi_qc_report_read_v1";
const QC_REPORT_RESERVE_RPC = "rpc_eaushadhi_qc_report_reserve_v1";
const QC_REPORT_REGISTER_RPC = "rpc_eaushadhi_qc_report_register_v1";
const QC_PREPARATION_SOURCE_KEY = "manual-qc:262:primary";
const QC_REPORT_BUCKET = "eaushadhi-evidence";
const QC_REPORT_FILENAME_RE = /^EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V[0-9]{2}\.pdf$/;
const QC_REPORT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QC_REPORT_SHA_RE = /^[0-9a-f]{64}$/;
const QC_REPORT_STATUSES = new Set(["RESERVED", "REGISTERED", "REVOKED"]);

function assertReportProduct(productId) {
  const id = typeof productId === "number" ? productId : Number(productId);
  if (!Number.isInteger(id) || id !== FIRST_CONTROLLED_PRODUCT_ID) {
    throw workerError(
      ERROR_KINDS.PRODUCT_NOT_ALLOWED,
      "QC test report upload accepts only product 262.",
    );
  }
  return id;
}

function assertRpc(callRpc) {
  if (typeof callRpc !== "function") {
    throw workerError(ERROR_KINDS.CRASH, "Server RPC adapter is missing.");
  }
}

function toReportError(error) {
  if (error instanceof WorkerError) return error;
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || error?.errcode || "");
  if (status === 401 || status === 403 || code === "42501" || code === "PGRST301") {
    return workerError(ERROR_KINDS.AUTHORIZATION, "Not authorized for e-Aushadhi automation.");
  }
  if (code === "40001") {
    return workerError(ERROR_KINDS.STALE, "Stale reservation — reload and retry");
  }
  if (code === "P0002") {
    return workerError(
      ERROR_KINDS.STALE,
      "Server copy changed — reload to compare; nothing was overwritten.",
    );
  }
  if (code === "23505") {
    return workerError(ERROR_KINDS.STALE, "This reservation is already registered.");
  }
  if (code === "22023" || code === "23514") {
    return workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report was not accepted.");
  }
  return workerError(ERROR_KINDS.CRASH, "QC test report upload failed.");
}

function assertReportRows(data) {
  if (!Array.isArray(data)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report list was not accepted.");
  }
  return data.map((item) => {
    const versionNo = item?.version_no;
    const status = item?.status;
    const fileName = item?.expected_file_name;
    if (
      typeof versionNo !== "number"
      || !Number.isInteger(versionNo)
      || versionNo <= 0
      || !QC_REPORT_STATUSES.has(status)
      || typeof fileName !== "string"
      || !QC_REPORT_FILENAME_RE.test(fileName)
    ) {
      throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report list was not accepted.");
    }
    return item;
  });
}

function assertReservation(reservation, preparationId) {
  const fileName = reservation?.expected_file_name;
  const path = reservation?.expected_storage_path;
  if (
    reservation?.bucket !== QC_REPORT_BUCKET
    || typeof fileName !== "string"
    || !QC_REPORT_FILENAME_RE.test(fileName)
    || path !== `qc-test-report/262/${preparationId}/${fileName}`
    || reservation?.extension !== "pdf"
  ) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report reservation was not accepted.");
  }
  return reservation;
}

async function listQcReports({ productId, accessToken, callRpc } = {}) {
  const id = assertReportProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  let data;
  try {
    data = await callRpc(token, QC_REPORT_LIST_RPC, { p_product_id: id });
  } catch (error) {
    throw toReportError(error);
  }
  return {
    ok: true,
    operation: "qc-report-list",
    productId: id,
    reports: assertReportRows(data),
    mutated: false,
  };
}

async function reserveQcReport({
  productId,
  accessToken,
  preparationId,
  expectedRowVersion,
  callRpc,
} = {}) {
  const id = assertReportProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  if (typeof preparationId !== "string" || !QC_REPORT_UUID_RE.test(preparationId)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report was not accepted.");
  }
  const versionText = String(expectedRowVersion);
  if (!/^[0-9]+$/.test(versionText)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report was not accepted.");
  }
  let preparations;
  try {
    preparations = await callRpc(token, QC_PREPARATION_READ_RPC, { p_product_id: id });
  } catch (error) {
    throw toReportError(error);
  }
  if (!Array.isArray(preparations)) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC preparation read was not accepted.");
  }
  const matches = preparations.filter((row) => String(row?.preparation_id) === preparationId);
  if (matches.length !== 1) {
    throw workerError(
      ERROR_KINDS.STALE,
      "Server copy changed — reload to compare; nothing was overwritten.",
    );
  }
  const row = matches[0];
  if (row.source_key !== QC_PREPARATION_SOURCE_KEY) {
    throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "QC preparation source key was not accepted.");
  }
  if (row.preparation_status === "VERIFIED") {
    throw workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Verified — editing is not available in C1.");
  }
  if (String(row.row_version) !== versionText) {
    throw workerError(
      ERROR_KINDS.STALE,
      "Server copy changed — reload to compare; nothing was overwritten.",
    );
  }
  const listed = await listQcReports({ productId: id, accessToken: token, callRpc });
  const reserved = listed.reports
    .filter((item) => item.status === "RESERVED" && String(item.preparation_id) === preparationId)
    .sort((left, right) => right.version_no - left.version_no);
  if (reserved.length > 0) {
    return {
      ok: true,
      operation: "qc-report-reserve",
      productId: id,
      reservation: reserved[0],
      reused: true,
      mutated: false,
    };
  }
  let data;
  try {
    data = await callRpc(token, QC_REPORT_RESERVE_RPC, {
      p_product_id: id,
      p_preparation_id: preparationId,
      p_expected_row_version: Number(versionText),
    });
  } catch (error) {
    throw toReportError(error);
  }
  return {
    ok: true,
    operation: "qc-report-reserve",
    productId: id,
    reservation: assertReservation(data, preparationId),
    reused: false,
    mutated: true,
  };
}

async function registerQcReport({
  productId,
  accessToken,
  reservationId,
  expectedRowVersion,
  objectId,
  originalFileName,
  sha256,
  callRpc,
} = {}) {
  const id = assertReportProduct(productId);
  const token = validateAccessToken(accessToken);
  assertRpc(callRpc);
  const versionText = String(expectedRowVersion);
  const fileName = typeof originalFileName === "string" ? originalFileName : "";
  if (
    typeof reservationId !== "string"
    || !QC_REPORT_UUID_RE.test(reservationId)
    || typeof objectId !== "string"
    || !QC_REPORT_UUID_RE.test(objectId)
    || !/^[0-9]+$/.test(versionText)
    || !QC_REPORT_SHA_RE.test(String(sha256 || ""))
    || fileName.trim() === ""
    || fileName.length > 255
  ) {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report was not accepted.");
  }
  let data;
  try {
    data = await callRpc(token, QC_REPORT_REGISTER_RPC, {
      p_reservation_id: reservationId,
      p_expected_row_version: Number(versionText),
      p_object_id: objectId,
      p_original_upload_file_name: fileName,
      p_claimed_sha256: String(sha256),
    });
  } catch (error) {
    throw toReportError(error);
  }
  if (data?.integrity_status !== "UNVERIFIED_BYTES") {
    throw workerError(ERROR_KINDS.CONTRACT_INCOMPLETE, "QC test report registration was not accepted.");
  }
  return {
    ok: true,
    operation: "qc-report-register",
    productId: id,
    result: data,
    mutated: true,
  };
}

module.exports = {
  QC_PREPARATION_READ_RPC,
  QC_REPORT_LIST_RPC,
  QC_REPORT_RESERVE_RPC,
  QC_REPORT_REGISTER_RPC,
  QC_PREPARATION_SOURCE_KEY,
  QC_REPORT_FILENAME_RE,
  listQcReports,
  reserveQcReport,
  registerQcReport,
};
