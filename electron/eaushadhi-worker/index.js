/* eslint-env node */

const { randomUUID } = require("crypto");
const { STATES, createWorkerState, statusLabel } = require("./state");
const { ERROR_KINDS, WorkerError, workerError, classifyServerError } = require("./errors");
const { writeDiagnostic } = require("./diagnostics");
const {
  loadPortalContract,
  requireContract,
  assertAllowedUrl,
} = require("./contracts/portal-contract");
const { launchDedicatedEdge, dedicatedProfileDir } = require("./browser");
const { callWorkerRpc } = require("./server-client");
const { loadFoundationSnapshot } = require("./foundation-check");
const { validateProductId, validateAccessToken, publicStatus } = require("./validate");

function createEaushadhiWorker({ getUserDataPath, onStatus } = {}) {
  const machine = createWorkerState();
  let context = null;
  let phase = null;
  let productId = null;
  let lastErrorKind = null;
  let lastErrorMessage = null;
  let stopRequested = false;

  function emit() {
    const snapshot = getStatus();
    if (typeof onStatus === "function") onStatus(snapshot);
    return snapshot;
  }

  function getStatus() {
    return publicStatus({
      state: machine.get(),
      label: statusLabel(machine.get()),
      phase,
      productId,
      lastErrorKind,
      lastErrorMessage,
    });
  }

  function setError(error) {
    lastErrorKind = error?.kind || ERROR_KINDS.CRASH;
    lastErrorMessage = error?.message || "Worker failed";
  }

  function log(record) {
    try {
      writeDiagnostic(getUserDataPath(), {
        ...record,
        workerState: machine.get(),
        phase,
        productId: record.productId || productId,
      });
    } catch {
      // diagnostics must never crash the worker
    }
  }

  async function closeBrowser() {
    if (!context) return;
    const current = context;
    context = null;
    try {
      await current.close();
    } catch {
      // ignore close errors
    }
  }

  async function connect() {
    lastErrorKind = null;
    lastErrorMessage = null;
    stopRequested = false;
    if (machine.get() === STATES.FAILED) machine.reset();
    if (machine.get() !== STATES.IDLE) {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Browser worker is already active.",
      );
    }
    machine.transition(STATES.STARTING);
    phase = "connect";
    emit();
    try {
      requireContract("origins");
      const contract = loadPortalContract();
      const userDataDir = dedicatedProfileDir(getUserDataPath());
      context = await launchDedicatedEdge(userDataDir);
      const page = context.pages()[0] || (await context.newPage());
      page.on("framenavigated", (frame) => {
        if (frame !== page.mainFrame()) return;
        try {
          assertAllowedUrl(frame.url(), contract);
        } catch (error) {
          log({
            phase: "origin-guard",
            url: frame.url(),
            errorKind: error.kind,
            error: error.message,
          });
        }
      });
      await page.goto(contract.baseUrl, { waitUntil: "domcontentloaded" });
      assertAllowedUrl(page.url(), contract);
      try {
        requireContract("authProbe");
        machine.transition(STATES.READY);
      } catch (error) {
        if (error?.kind !== ERROR_KINDS.CONTRACT_INCOMPLETE) throw error;
        machine.transition(STATES.AUTH_REQUIRED);
        lastErrorKind = ERROR_KINDS.AUTH_REQUIRED;
        lastErrorMessage =
          "Login in the dedicated Edge window. Authenticated portal state cannot be proven yet.";
      }
      phase = "connected";
      log({ phase, url: page.url() });
      return emit();
    } catch (error) {
      const wrapped =
        error instanceof WorkerError
          ? error
          : workerError(ERROR_KINDS.CRASH, "Browser connect failed.");
      setError(wrapped);
      await closeBrowser();
      if (machine.get() !== STATES.FAILED) {
        try {
          machine.transition(STATES.FAILED);
        } catch {
          machine.reset();
          machine.transition(STATES.STARTING);
          machine.transition(STATES.FAILED);
        }
      }
      log({ phase: "connect", errorKind: wrapped.kind, error: wrapped.message });
      emit();
      throw wrapped;
    }
  }

  async function stop() {
    stopRequested = true;
    const current = machine.get();
    if (current === STATES.IDLE) return emit();
    if (current !== STATES.STOPPING && current !== STATES.FAILED) {
      try {
        machine.transition(STATES.STOPPING);
      } catch {
        machine.reset();
        return emit();
      }
    }
    phase = "stop";
    emit();
    await closeBrowser();
    machine.reset();
    phase = null;
    productId = null;
    lastErrorKind = null;
    lastErrorMessage = null;
    stopRequested = false;
    return emit();
  }

  async function runFoundationCheck(rawProductId, rawAccessToken) {
    const id = validateProductId(rawProductId);
    const accessToken = validateAccessToken(rawAccessToken);
    const runId = randomUUID();
    productId = id;
    lastErrorKind = null;
    lastErrorMessage = null;
    const previous = machine.get();
    if (previous === STATES.STOPPING) {
      throw workerError(ERROR_KINDS.CANCELLED, "Browser worker is stopping.");
    }
    if (previous === STATES.IDLE || previous === STATES.AUTH_REQUIRED || previous === STATES.READY) {
      machine.transition(STATES.RUNNING);
    } else if (previous === STATES.FAILED) {
      machine.reset();
      machine.transition(STATES.RUNNING);
    } else if (previous !== STATES.RUNNING) {
      throw workerError(ERROR_KINDS.CRASH, "Browser worker cannot run a foundation check now.");
    }
    phase = "foundation-check";
    emit();

    const restoreState = () => {
      if (stopRequested) return;
      if (previous === STATES.AUTH_REQUIRED) machine.transition(STATES.AUTH_REQUIRED);
      else if (previous === STATES.READY) machine.transition(STATES.READY);
      else if (context) machine.transition(STATES.AUTH_REQUIRED);
      else machine.transition(STATES.IDLE);
    };

    try {
      const result = await loadFoundationSnapshot({
        productId: id,
        callRpc: (name, args) => callWorkerRpc(accessToken, name, args),
      });
      result.runId = runId;

      lastErrorKind = result.errorKind;
      lastErrorMessage = result.message;
      log({
        runId,
        productId: id,
        phase: "foundation-check",
        errorKind: result.errorKind,
        error: result.message,
        contractSection: result.errorKind === ERROR_KINDS.CONTRACT_INCOMPLETE ? "authProbe" : null,
      });
      restoreState();
      emit();
      return result;
    } catch (error) {
      const wrapped =
        error instanceof WorkerError ? error : classifyServerError(error);
      setError(wrapped);
      log({
        runId,
        productId: id,
        phase,
        errorKind: wrapped.kind,
        error: wrapped.message,
      });
      try {
        restoreState();
      } catch {
        machine.reset();
      }
      emit();
      throw wrapped;
    }
  }

  return {
    getStatus,
    connect,
    stop,
    runFoundationCheck,
  };
}

module.exports = {
  createEaushadhiWorker,
};
