/* eslint-env node */

const ERROR_KINDS = Object.freeze({
  UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",
  BROWSER_NOT_AVAILABLE: "BROWSER_NOT_AVAILABLE",
  CONTRACT_INCOMPLETE: "CONTRACT_INCOMPLETE",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTHORIZATION: "AUTHORIZATION",
  PREFLIGHT_DENIED: "PREFLIGHT_DENIED",
  STALE: "STALE",
  CANCELLED: "CANCELLED",
  CRASH: "CRASH",
  NETWORK: "NETWORK",
});

class WorkerError extends Error {
  constructor(kind, message, extras = {}) {
    super(message || kind);
    this.name = "WorkerError";
    this.kind = ERROR_KINDS[kind] || kind;
    this.section = extras.section || null;
    this.details = extras.details || null;
  }
}

function workerError(kind, message, extras) {
  return new WorkerError(kind, message, extras);
}

function classifyServerError(error) {
  const code = String(error?.code || error?.errcode || "");
  const message = String(error?.message || error?.error_description || "Server error");
  if (code === "42501" || /permission|not authenticated|jwt/i.test(message)) {
    return workerError(ERROR_KINDS.AUTHORIZATION, "Not authorized for e-Aushadhi automation.");
  }
  if (code === "40001" || /stale/i.test(message)) {
    return workerError(ERROR_KINDS.STALE, "Workflow version is stale. Reload the product.");
  }
  if (code === "P0002" || /not found/i.test(message)) {
    return workerError(ERROR_KINDS.PREFLIGHT_DENIED, "Product is not available for the worker.");
  }
  if (/fetch|network|timeout/i.test(message)) {
    return workerError(ERROR_KINDS.NETWORK, "Network error while calling the server.");
  }
  return workerError(ERROR_KINDS.CRASH, "Server call failed.");
}

module.exports = {
  ERROR_KINDS,
  WorkerError,
  workerError,
  classifyServerError,
};
