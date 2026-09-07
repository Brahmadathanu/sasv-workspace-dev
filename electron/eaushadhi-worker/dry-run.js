/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");
const { getContractCompleteness } = require("./contracts/portal-contract");
const { FIRST_CONTROLLED_PRODUCT_ID, isFirstControlledProduct } = require("./product-lock");

const DRY_RUN_PHASES = Object.freeze([
  "Preflight",
  "Content Snapshot",
  "Contract Readiness",
  "Lookup Contract",
  "Product Details Contract",
  "Composition Contract",
  "Evidence Contract",
  "Save/Update Contract",
  "Reread Contract",
  "Comparator Readiness",
]);

const REQUIRED_CONTRACT_SECTIONS = Object.freeze([
  { phase: "Lookup Contract", section: "productLookup" },
  { phase: "Product Details Contract", section: "productDetails" },
  { phase: "Composition Contract", section: "composition" },
  { phase: "Evidence Contract", section: "evidence" },
  { phase: "Save/Update Contract", section: "saveUpdate" },
  { phase: "Reread Contract", section: "reread" },
]);

const MUTATING_RPC_NAMES = Object.freeze([
  "rpc_eaushadhi_worker_run_begin",
  "rpc_eaushadhi_worker_run_resume",
  "rpc_eaushadhi_worker_mark_entered",
  "rpc_eaushadhi_worker_mark_portal_verified",
]);

function phaseRecord(id, status, detail) {
  return { id, status, detail: detail || "" };
}

function buildStoppedResult({
  productId,
  workerState,
  errorKind,
  message,
  phases,
  preflight,
  content,
  rpcsInvoked,
}) {
  return {
    ok: false,
    operation: "entry-dry-run",
    productId,
    workerState: workerState || null,
    firstControlledProductId: FIRST_CONTROLLED_PRODUCT_ID,
    phases,
    preflight: preflight || null,
    workflowRowVersion: content?.workflow_row_version || preflight?.workflow_row_version || null,
    payloadHash: content?.payload_hash || null,
    contentHash: content?.content_hash || null,
    contractCompleteness: getContractCompleteness(),
    mutated: false,
    entryStatusChanged: false,
    rpcsInvoked: rpcsInvoked || [],
    errorKind,
    message,
    stoppedPhase: [...phases].reverse().find((item) => item.status === "stop")?.id || null,
  };
}

async function runEntryDryRun({
  productId,
  workerState,
  callRpc,
  contract,
} = {}) {
  const rpcsInvoked = [];
  const phases = [];
  const wrappedCall = async (name, args) => {
    if (MUTATING_RPC_NAMES.includes(name)) {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Dry-run must not invoke mutating lifecycle RPCs.",
        { details: { name } },
      );
    }
    rpcsInvoked.push(name);
    return callRpc(name, args);
  };

  if (!isFirstControlledProduct(productId)) {
    phases.push(
      phaseRecord(
        "Preflight",
        "stop",
        `Dry-run is locked to product_id ${FIRST_CONTROLLED_PRODUCT_ID}.`,
      ),
    );
    return buildStoppedResult({
      productId,
      workerState,
      errorKind: ERROR_KINDS.PRODUCT_NOT_ALLOWED,
      message: `First controlled entry dry-run accepts only product_id ${FIRST_CONTROLLED_PRODUCT_ID}.`,
      phases,
      rpcsInvoked,
    });
  }

  if (workerState !== "READY") {
    phases.push(
      phaseRecord("Preflight", "stop", `Worker status is ${workerState || "unknown"}, not READY.`),
    );
    return buildStoppedResult({
      productId,
      workerState,
      errorKind: ERROR_KINDS.WORKER_NOT_READY,
      message: "Check Entry Readiness requires a READY dedicated browser session.",
      phases,
      rpcsInvoked,
    });
  }

  if (typeof callRpc !== "function") {
    throw workerError(ERROR_KINDS.CRASH, "Server RPC adapter is missing.");
  }

  const preflight = await wrappedCall("rpc_eaushadhi_worker_preflight", {
    p_product_id: productId,
  });
  if (preflight?.eligible !== true) {
    phases.push(
      phaseRecord(
        "Preflight",
        "stop",
        (preflight?.reasons || []).join("; ") || "Product is not eligible.",
      ),
    );
    return buildStoppedResult({
      productId,
      workerState,
      errorKind: ERROR_KINDS.PREFLIGHT_DENIED,
      message: "Product is not eligible for a future portal run.",
      phases,
      preflight: {
        eligible: false,
        reasons: preflight?.reasons || [],
        entryStatus: preflight?.entry_status || null,
        isReadyForEntry: preflight?.is_ready_for_entry === true,
        workflowRowVersion: preflight?.workflow_row_version || null,
      },
      rpcsInvoked,
    });
  }
  phases.push(phaseRecord("Preflight", "pass", "Preflight eligible."));

  const content = await wrappedCall("rpc_eaushadhi_worker_content_get", {
    p_product_id: productId,
    p_expected_workflow_row_version: preflight.workflow_row_version,
  });
  if (!content?.content_hash) {
    phases.push(phaseRecord("Content Snapshot", "stop", "content_hash is missing."));
    return buildStoppedResult({
      productId,
      workerState,
      errorKind: ERROR_KINDS.CRASH,
      message: "Governed content_hash is required before any future entry run.",
      phases,
      preflight: {
        eligible: true,
        reasons: preflight?.reasons || [],
        entryStatus: preflight?.entry_status || null,
        isReadyForEntry: preflight?.is_ready_for_entry === true,
        workflowRowVersion: preflight?.workflow_row_version || null,
      },
      content,
      rpcsInvoked,
    });
  }
  phases.push(
    phaseRecord(
      "Content Snapshot",
      "pass",
      `workflow_row_version ${content.workflow_row_version || preflight.workflow_row_version}; content_hash recorded.`,
    ),
  );

  const completeness = getContractCompleteness(contract);
  const firstGap = REQUIRED_CONTRACT_SECTIONS.find(
    ({ section }) => completeness[section] !== true,
  );
  phases.push(
    phaseRecord(
      "Contract Readiness",
      firstGap ? "stop" : "pass",
      firstGap
        ? `Required portal contract remains incomplete (${firstGap.section}).`
        : "Required portal contract sections are complete.",
    ),
  );

  for (const item of REQUIRED_CONTRACT_SECTIONS) {
    const ready = completeness[item.section] === true;
    phases.push(
      phaseRecord(
        item.phase,
        ready ? "pass" : "stop",
        ready
          ? `${item.section} is complete.`
          : `${item.section} is not proven for deterministic execution.`,
      ),
    );
  }

  phases.push(
    phaseRecord(
      "Comparator Readiness",
      "stop",
      "Retained-state reread is not wired; comparator scaffolding is offline-only.",
    ),
  );

  const preflightView = {
    eligible: true,
    reasons: preflight?.reasons || [],
    entryStatus: preflight?.entry_status || null,
    isReadyForEntry: preflight?.is_ready_for_entry === true,
    workflowRowVersion: preflight?.workflow_row_version || null,
  };

  return buildStoppedResult({
    productId,
    workerState,
    errorKind: ERROR_KINDS.CONTRACT_INCOMPLETE,
    message:
      "Entry dry-run stopped at CONTRACT_INCOMPLETE. No portal mutation and no lifecycle RPC were invoked.",
    phases,
    preflight: preflightView,
    content,
    rpcsInvoked,
  });
}

module.exports = {
  DRY_RUN_PHASES,
  REQUIRED_CONTRACT_SECTIONS,
  MUTATING_RPC_NAMES,
  runEntryDryRun,
};
