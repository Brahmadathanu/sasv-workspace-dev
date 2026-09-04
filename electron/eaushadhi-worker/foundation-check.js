/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");
const { getContractCompleteness, requireContract } = require("./contracts/portal-contract");

const FOUNDATION_CONTRACT_SECTIONS = [
  "authProbe",
  "productLookup",
  "productDetails",
  "pharmacologicalActions",
  "composition",
  "saveUpdate",
  "reread",
];

function firstIncompleteSection(requireFn = requireContract) {
  for (const section of FOUNDATION_CONTRACT_SECTIONS) {
    try {
      requireFn(section);
    } catch (error) {
      if (error?.kind === ERROR_KINDS.CONTRACT_INCOMPLETE) return error;
      throw error;
    }
  }
  return null;
}

function buildFoundationResult({ productId, runId, preflight, payload, contractError }) {
  const eligible = preflight?.eligible === true;
  const errorKind = contractError
    ? ERROR_KINDS.CONTRACT_INCOMPLETE
    : eligible
      ? null
      : ERROR_KINDS.PREFLIGHT_DENIED;
  return {
    ok: false,
    operation: "foundation-check",
    productId,
    runId,
    preflight: {
      eligible,
      reasons: preflight?.reasons || [],
      entryStatus: preflight?.entry_status || null,
      isReadyForEntry: preflight?.is_ready_for_entry === true,
      workflowRowVersion: preflight?.workflow_row_version || null,
    },
    payloadHash: payload?.payload_hash || null,
    entryStatus: payload?.entry_status || preflight?.entry_status || null,
    contractCompleteness: getContractCompleteness(),
    mutated: false,
    entryStatusChanged: false,
    errorKind,
    message: contractError
      ? contractError.message
      : eligible
        ? "Foundation check completed."
        : "Foundation check completed. Product is not eligible for a future portal run.",
  };
}

async function loadFoundationSnapshot({ productId, callRpc }) {
  if (typeof callRpc !== "function") {
    throw workerError(ERROR_KINDS.CRASH, "Server RPC adapter is missing.");
  }
  const preflight = await callRpc("rpc_eaushadhi_worker_preflight", {
    p_product_id: productId,
  });
  const payload = await callRpc("rpc_eaushadhi_worker_payload_get", {
    p_product_id: productId,
    p_expected_workflow_row_version: preflight.workflow_row_version,
  });
  const contractError = firstIncompleteSection();
  return buildFoundationResult({
    productId,
    runId: null,
    preflight,
    payload,
    contractError,
  });
}

module.exports = {
  FOUNDATION_CONTRACT_SECTIONS,
  firstIncompleteSection,
  buildFoundationResult,
  loadFoundationSnapshot,
};
