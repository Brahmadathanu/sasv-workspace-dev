/* eslint-env node */

const { randomUUID } = require("crypto");
const path = require("path");
const { STATES, createWorkerState, statusLabel } = require("./state");
const { ERROR_KINDS, WorkerError, workerError, classifyServerError } = require("./errors");
const { writeDiagnostic } = require("./diagnostics");
const {
  loadPortalContract,
  requireContract,
} = require("./contracts/portal-contract");
const { launchDedicatedEdge, dedicatedProfileDir } = require("./browser");
const { attachContextOriginGuard, assertAllowedUrl } = require("./origin-guard");
const { callWorkerRpc } = require("./server-client");
const { loadFoundationSnapshot } = require("./foundation-check");
const { validateProductId, validateAccessToken, publicStatus } = require("./validate");
const { captureOpenPages } = require("./capture");
const { capturesRoot, isPathInsideRoot } = require("./capture/persist");

function createEaushadhiWorker({
  getUserDataPath,
  onStatus,
  launchBrowser,
  callRpc,
  requireContract: requireContractFn,
} = {}) {
  const machine = createWorkerState();
  let context = null;
  let phase = null;
  let productId = null;
  let lastErrorKind = null;
  let lastErrorMessage = null;
  let stopRequested = false;
  let containingOrigin = false;
  let detachContextGuard = null;
  let lastCaptureDir = null;
  const rpcCall = typeof callRpc === "function" ? callRpc : callWorkerRpc;
  const requireSection =
    typeof requireContractFn === "function" ? requireContractFn : requireContract;

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
    if (detachContextGuard) {
      try {
        detachContextGuard();
      } catch {
        // ignore
      }
      detachContextGuard = null;
    }
    if (!context) return;
    const current = context;
    context = null;
    try {
      await current.close();
    } catch {
      // ignore close errors
    }
  }

  async function failClosed(error, url) {
    if (containingOrigin) return;
    containingOrigin = true;
    setError(error);
    log({
      phase: "origin-guard",
      url,
      errorKind: error?.kind || ERROR_KINDS.DISALLOWED_ORIGIN,
      error: error?.message,
    });
    await closeBrowser();
    const current = machine.get();
    if (current !== STATES.FAILED) {
      try {
        machine.transition(STATES.FAILED);
      } catch {
        try {
          if (current !== STATES.STOPPING) machine.transition(STATES.STOPPING);
          machine.transition(STATES.FAILED);
        } catch {
          machine.reset();
          machine.transition(STATES.FAILED);
        }
      }
    }
    emit();
  }

  async function connect() {
    lastErrorKind = null;
    lastErrorMessage = null;
    stopRequested = false;
    containingOrigin = false;
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
      requireSection("origins");
      const contract = loadPortalContract();
      const userDataDir = dedicatedProfileDir(getUserDataPath());
      const launcher = typeof launchBrowser === "function" ? launchBrowser : launchDedicatedEdge;
      context = await launcher(userDataDir);
      detachContextGuard = attachContextOriginGuard(context, {
        contract,
        onDisallowed: (error, url) => {
          void failClosed(error, url);
        },
      });
      const page = context.pages()[0] || (await context.newPage());
      await page.goto(contract.baseUrl, { waitUntil: "domcontentloaded" });
      assertAllowedUrl(page.url(), contract);
      try {
        requireSection("authProbe");
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
        callRpc: (name, args) => rpcCall(accessToken, name, args),
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

  async function requireViewPermission(accessToken) {
    try {
      await rpcCall(accessToken, "rpc_eaushadhi_require_permission", { p_edit: false });
    } catch (error) {
      throw error instanceof WorkerError ? error : classifyServerError(error);
    }
  }

  async function capturePortalContract(rawAccessToken) {
    const accessToken = validateAccessToken(rawAccessToken);
    await requireViewPermission(accessToken);
    const previous = machine.get();
    if (!context) {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Connect the dedicated browser before capturing the portal contract.",
      );
    }
    if (previous === STATES.STOPPING) {
      throw workerError(ERROR_KINDS.CANCELLED, "Browser worker is stopping.");
    }
    if (previous !== STATES.AUTH_REQUIRED && previous !== STATES.READY) {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Portal contract capture requires an active dedicated browser session.",
      );
    }
    machine.transition(STATES.RUNNING);
    const previousProductId = productId;
    productId = null;
    phase = "contract-capture";
    emit();

    const restoreState = () => {
      if (stopRequested) return;
      if (machine.get() !== STATES.RUNNING) return;
      if (previous === STATES.READY) machine.transition(STATES.READY);
      else if (previous === STATES.AUTH_REQUIRED) machine.transition(STATES.AUTH_REQUIRED);
      else if (context) machine.transition(STATES.AUTH_REQUIRED);
      else machine.transition(STATES.IDLE);
    };

    try {
      const contract = loadPortalContract();
      const result = await captureOpenPages({
        context,
        contract,
        userDataPath: getUserDataPath(),
        workerStateBefore: previous,
      });
      if (machine.get() === STATES.FAILED) {
        productId = previousProductId;
        emit();
        throw workerError(
          lastErrorKind || ERROR_KINDS.DISALLOWED_ORIGIN,
          lastErrorMessage || "Dedicated browser origin containment failed.",
        );
      }
      lastCaptureDir = result.captureDir;
      lastErrorKind = null;
      lastErrorMessage = null;
      log({
        phase: "contract-capture",
        errorKind: null,
        error: result.summary.auth_outcome,
      });
      restoreState();
      productId = previousProductId;
      emit();
      return result.summary;
    } catch (error) {
      productId = previousProductId;
      if (machine.get() === STATES.FAILED) {
        emit();
        throw error instanceof WorkerError
          ? error.kind === ERROR_KINDS.DISALLOWED_ORIGIN
            ? error
            : workerError(
                lastErrorKind || ERROR_KINDS.DISALLOWED_ORIGIN,
                lastErrorMessage || "Dedicated browser origin containment failed.",
              )
          : workerError(
              lastErrorKind || ERROR_KINDS.DISALLOWED_ORIGIN,
              lastErrorMessage || "Dedicated browser origin containment failed.",
            );
      }
      if (error?.kind === ERROR_KINDS.DISALLOWED_ORIGIN) {
        await failClosed(error, error.details?.url);
        emit();
        throw error;
      }
      const wrapped =
        error instanceof WorkerError ? error : workerError(ERROR_KINDS.CRASH, "Portal contract capture failed.");
      setError(wrapped);
      log({
        phase: "contract-capture",
        errorKind: wrapped.kind,
        error: wrapped.message,
      });
      try {
        restoreState();
      } catch {
        if (machine.get() !== STATES.FAILED && machine.get() !== STATES.STOPPING) {
          machine.reset();
        }
      }
      emit();
      throw wrapped;
    }
  }

  async function openLastCaptureFolder(rawAccessToken, { openPath } = {}) {
    const accessToken = validateAccessToken(rawAccessToken);
    await requireViewPermission(accessToken);
    if (!lastCaptureDir) {
      throw workerError(ERROR_KINDS.CRASH, "No portal contract capture is available to open.");
    }
    const root = capturesRoot(getUserDataPath());
    if (!isPathInsideRoot(lastCaptureDir, root)) {
      lastCaptureDir = null;
      throw workerError(ERROR_KINDS.CRASH, "The capture folder is not inside the governed capture root.");
    }
    if (typeof openPath === "function") {
      const opened = await openPath(lastCaptureDir);
      if (typeof opened === "string" && opened.trim()) {
        throw workerError(ERROR_KINDS.CRASH, "The capture folder could not be opened.");
      }
    }
    return {
      ok: true,
      folder_name: path.basename(lastCaptureDir),
    };
  }

  return {
    getStatus,
    connect,
    stop,
    runFoundationCheck,
    capturePortalContract,
    openLastCaptureFolder,
  };
}

module.exports = {
  createEaushadhiWorker,
};
