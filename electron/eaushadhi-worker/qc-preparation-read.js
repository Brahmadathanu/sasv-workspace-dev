/* eslint-env node */

const { ERROR_KINDS, WorkerError, workerError } = require("./errors");
const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { validateAccessToken } = require("./validate");

const QC_PREPARATION_READ_RPC = "rpc_eaushadhi_qc_preparation_read_v1";

function assertProbeProduct(productId) {
  const id = typeof productId === "number" ? productId : Number(productId);
  if (!Number.isInteger(id) || id !== FIRST_CONTROLLED_PRODUCT_ID) {
    throw workerError(
      ERROR_KINDS.PRODUCT_NOT_ALLOWED,
      "QC preparation read probe accepts only product 262.",
    );
  }
  return id;
}

function toProbeError(error) {
  if (error instanceof WorkerError) return error;
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || error?.errcode || "");
  const message = String(error?.message || "");
  const unauthorized =
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    code === "PGRST301" ||
    /permission|not authenticated|jwt|unauthorized/i.test(message);
  if (unauthorized) {
    return workerError(
      ERROR_KINDS.AUTHORIZATION,
      "Not authorized for e-Aushadhi automation.",
    );
  }
  return workerError(ERROR_KINDS.CRASH, "QC preparation read probe failed.");
}

function assertEmptyPreparationList(data) {
  if (!Array.isArray(data) || data.length !== 0) {
    throw workerError(
      ERROR_KINDS.PREFLIGHT_DENIED,
      "QC preparation read probe did not return an empty preparation list.",
    );
  }
}

async function readQcPreparation({ productId, accessToken, callRpc } = {}) {
  const id = assertProbeProduct(productId);
  const token = validateAccessToken(accessToken);
  if (typeof callRpc !== "function") {
    throw workerError(ERROR_KINDS.CRASH, "Server RPC adapter is missing.");
  }
  let data;
  try {
    data = await callRpc(token, QC_PREPARATION_READ_RPC, { p_product_id: id });
  } catch (error) {
    throw toProbeError(error);
  }
  assertEmptyPreparationList(data);
  return {
    ok: true,
    operation: "qc-preparation-read-probe",
    productId: id,
    recordCount: 0,
    mutated: false,
    message: "QC preparation read probe returned no preparations.",
  };
}

module.exports = {
  QC_PREPARATION_READ_RPC,
  readQcPreparation,
};
