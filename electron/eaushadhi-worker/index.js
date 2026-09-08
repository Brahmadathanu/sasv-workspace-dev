/* eslint-env node */

const { randomUUID } = require("crypto");
const path = require("path");
const { STATES, createWorkerState, statusLabel } = require("./state");
const { ERROR_KINDS, WorkerError, workerError, classifyServerError } = require("./errors");
const { sanitizeText, writeDiagnostic } = require("./diagnostics");
const {
  loadPortalContract,
  requireContract,
} = require("./contracts/portal-contract");
const { launchDedicatedEdge, dedicatedProfileDir } = require("./browser");
const {
  attachContextOriginGuard,
  assertAllowedUrl,
  isAllowedPageUrl,
  selectAllowedOriginPage,
} = require("./origin-guard");
const { callWorkerRpc } = require("./server-client");
const { loadFoundationSnapshot } = require("./foundation-check");
const { runEntryDryRun } = require("./dry-run");
const { validateProductId, validateAccessToken, publicStatus } = require("./validate");
const { captureOpenPages } = require("./capture");
const { capturesRoot, isPathInsideRoot } = require("./capture/persist");
const { probeAuthenticatedSession } = require("./auth-probe");

const CONNECT_PHASES = Object.freeze({
  CONTRACT: "connect:contract",
  LAUNCH: "connect:launch",
  GUARD: "connect:guard",
  PAGE: "connect:page",
  NAVIGATE: "connect:navigate",
  ORIGIN_CHECK: "connect:origin-check",
  AUTH_PROBE: "connect:auth-probe",
  READY: "connect:ready",
});

const AUTH_REFRESH_PHASE = "auth-refresh";

function connectFailureDetails(error, connectPhase) {
  const existing =
    error?.details && typeof error.details === "object" ? { ...error.details } : {};
  const details = {
    ...existing,
    connectPhase: existing.connectPhase || connectPhase || null,
  };
  if (!details.causeMessageSanitized) {
    const raw = error instanceof WorkerError ? "" : String(error?.message || error || "");
    const cause = sanitizeText(raw);
    if (cause) details.causeMessageSanitized = cause;
  } else {
    details.causeMessageSanitized = sanitizeText(details.causeMessageSanitized);
  }
  return details;
}

function wrapConnectFailure(error, connectPhase) {
  const details = connectFailureDetails(error, connectPhase);
  if (error instanceof WorkerError) {
    return workerError(error.kind, error.message, {
      section: error.section,
      details,
    });
  }
  const cause = details.causeMessageSanitized || "Unknown error";
  return workerError(
    ERROR_KINDS.CRASH,
    sanitizeText(`Browser connect failed. ${cause}`),
    { details },
  );
}

function wrapAuthRefreshFailure(error, refreshPhase) {
  const details = connectFailureDetails(error, refreshPhase);
  if (error instanceof WorkerError) {
    return workerError(error.kind, error.message, {
      section: error.section,
      details,
    });
  }
  const cause = details.causeMessageSanitized || "Unknown error";
  return workerError(
    ERROR_KINDS.CRASH,
    sanitizeText(`Login recheck failed. ${cause}`),
    { details },
  );
}

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
  let authRefreshInFlight = false;
  let controlledPage = null;
  let detachControlledClose = null;
  let portalContract = null;
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
        phase: record.phase != null ? record.phase : phase,
        productId: record.productId || productId,
      });
    } catch {
      // diagnostics must never crash the worker
    }
  }

  function clearControlledPage() {
    if (detachControlledClose) {
      try {
        detachControlledClose();
      } catch {
        // ignore
      }
      detachControlledClose = null;
    }
    controlledPage = null;
  }

  function setControlledPage(page) {
    clearControlledPage();
    if (!page) return null;
    controlledPage = page;
    const onClose = () => {
      void handleControlledPageClosed();
    };
    if (typeof page.on === "function") {
      page.on("close", onClose);
      detachControlledClose = () => {
        if (typeof page.off === "function") page.off("close", onClose);
      };
    }
    return controlledPage;
  }

  async function handleControlledPageClosed() {
    if (containingOrigin || stopRequested) return;
    if (controlledPage && typeof controlledPage.isClosed === "function" && !controlledPage.isClosed()) {
      return;
    }
    const previousControlled = controlledPage;
    clearControlledPage();
    const state = machine.get();
    const contract = portalContract || loadPortalContract();

    if (state === STATES.RUNNING) {
      await failClosed(
        workerError(
          ERROR_KINDS.DISALLOWED_ORIGIN,
          "Controlled e-Aushadhi page was lost during an active operation.",
        ),
        typeof previousControlled?.url === "function" ? previousControlled.url() : null,
        {
          pageRole: "controlled",
          containmentAction: "fail_closed",
        },
      );
      return;
    }

    if (state === STATES.READY || state === STATES.AUTH_REQUIRED) {
      const next = context ? selectAllowedOriginPage(context, contract) : null;
      if (next) {
        setControlledPage(next);
        log({
          phase: "origin-guard",
          url: typeof next.url === "function" ? next.url() : null,
          pageRole: "controlled",
          containmentAction: "adopted_allowed_page",
          error: "Controlled page closed; adopted another allowed e-Aushadhi page.",
        });
        emit();
        return;
      }
    }

    await failClosed(
      workerError(
        ERROR_KINDS.DISALLOWED_ORIGIN,
        "No allowed e-Aushadhi page remains in the dedicated browser.",
      ),
      null,
      {
        pageRole: "controlled",
        containmentAction: "fail_closed",
      },
    );
  }

  async function closeBrowser() {
    clearControlledPage();
    if (detachContextGuard) {
      try {
        detachContextGuard();
      } catch {
        // ignore
      }
      detachContextGuard = null;
    }
    portalContract = null;
    if (!context) return;
    const current = context;
    context = null;
    try {
      await current.close();
    } catch {
      // ignore close errors
    }
  }

  function isUsableControlledPage(page, contract) {
    if (!page) return false;
    if (typeof page.isClosed === "function" && page.isClosed()) return false;
    const url = typeof page.url === "function" ? page.url() : "";
    return isAllowedPageUrl(url, contract);
  }

  async function containSecondaryPage(page, error, url) {
    let closeFailed = false;
    let closeErrorMessage = null;
    try {
      if (
        page &&
        typeof page.close === "function" &&
        !(typeof page.isClosed === "function" && page.isClosed())
      ) {
        await page.close();
      }
    } catch (closeError) {
      closeFailed = true;
      closeErrorMessage = String(closeError?.message || closeError || "page.close failed");
    }
    const stillOpen =
      !!page &&
      !(typeof page.isClosed === "function" && page.isClosed());
    if (closeFailed || stillOpen) {
      await failClosed(
        workerError(
          ERROR_KINDS.DISALLOWED_ORIGIN,
          sanitizeText(
            closeFailed
              ? `Secondary disallowed-origin page could not be closed. ${closeErrorMessage || ""}`.trim()
              : "Secondary disallowed-origin page remained open after close.",
          ),
        ),
        url,
        {
          pageRole: "secondary",
          containmentAction: "secondary_close_failed_fail_closed",
        },
      );
      return;
    }
    log({
      phase: "origin-guard",
      url,
      errorKind: error?.kind || ERROR_KINDS.DISALLOWED_ORIGIN,
      error: error?.message,
      pageRole: "secondary",
      containmentAction: "closed_offending_page",
    });
    emit();
  }

  async function failClosed(error, url, extras = {}) {
    if (containingOrigin) return;
    containingOrigin = true;
    setError(error);
    log({
      phase: "origin-guard",
      url,
      errorKind: error?.kind || ERROR_KINDS.DISALLOWED_ORIGIN,
      error: error?.message,
      pageRole: extras.pageRole || "controlled",
      containmentAction: extras.containmentAction || "fail_closed",
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
    phase = CONNECT_PHASES.CONTRACT;
    emit();
    try {
      phase = CONNECT_PHASES.CONTRACT;
      requireSection("origins");
      const contract = loadPortalContract();
      portalContract = contract;
      phase = CONNECT_PHASES.LAUNCH;
      const userDataDir = dedicatedProfileDir(getUserDataPath());
      const launcher = typeof launchBrowser === "function" ? launchBrowser : launchDedicatedEdge;
      context = await launcher(userDataDir);
      phase = CONNECT_PHASES.GUARD;
      detachContextGuard = attachContextOriginGuard(context, {
        contract,
        onDisallowed: (error, url, page) => {
          if (page && controlledPage && page === controlledPage) {
            void failClosed(error, url, {
              pageRole: "controlled",
              containmentAction: "fail_closed",
            });
            return;
          }
          void containSecondaryPage(page, error, url);
        },
      });
      phase = CONNECT_PHASES.PAGE;
      const page = context.pages()[0] || (await context.newPage());
      phase = CONNECT_PHASES.NAVIGATE;
      await page.goto(contract.baseUrl, { waitUntil: "domcontentloaded" });
      phase = CONNECT_PHASES.ORIGIN_CHECK;
      assertAllowedUrl(page.url(), contract);
      setControlledPage(page);
      try {
        phase = CONNECT_PHASES.AUTH_PROBE;
        const authSpec = requireSection("authProbe");
        const probe = await probeAuthenticatedSession(page, authSpec);
        phase = CONNECT_PHASES.READY;
        if (probe.authenticated) {
          machine.transition(STATES.READY);
          lastErrorKind = null;
          lastErrorMessage = null;
        } else {
          machine.transition(STATES.AUTH_REQUIRED);
          lastErrorKind = ERROR_KINDS.AUTH_REQUIRED;
          lastErrorMessage =
            probe.reason ||
            "Login in the dedicated Edge window. Authenticated portal state cannot be proven yet.";
        }
      } catch (error) {
        if (error?.kind !== ERROR_KINDS.CONTRACT_INCOMPLETE) throw error;
        phase = CONNECT_PHASES.READY;
        machine.transition(STATES.AUTH_REQUIRED);
        lastErrorKind = ERROR_KINDS.AUTH_REQUIRED;
        lastErrorMessage =
          "Login in the dedicated Edge window. Authenticated portal state cannot be proven yet.";
      }
      log({ phase, url: page.url() });
      return emit();
    } catch (error) {
      const wrapped = wrapConnectFailure(error, phase);
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
      log({
        phase: wrapped.details?.connectPhase || phase,
        errorKind: wrapped.kind,
        error: wrapped.details?.causeMessageSanitized || wrapped.message,
      });
      emit();
      throw wrapped;
    }
  }

  function applyAuthProbeResult(probe) {
    const current = machine.get();
    if (probe?.authenticated) {
      if (current === STATES.AUTH_REQUIRED) machine.transition(STATES.READY);
      lastErrorKind = null;
      lastErrorMessage = null;
      return;
    }
    if (current === STATES.READY) machine.transition(STATES.AUTH_REQUIRED);
    lastErrorKind = ERROR_KINDS.AUTH_REQUIRED;
    lastErrorMessage =
      probe?.reason ||
      "Login in the dedicated Edge window. Authenticated portal state cannot be proven yet.";
  }

  async function recheckAuthentication() {
    const previous = machine.get();
    if (!context) {
      throw workerError(
        ERROR_KINDS.WORKER_NOT_READY,
        "Connect the dedicated browser before rechecking login.",
      );
    }
    if (previous !== STATES.AUTH_REQUIRED && previous !== STATES.READY) {
      throw workerError(
        ERROR_KINDS.WORKER_NOT_READY,
        "Login can only be rechecked while the browser is waiting for login or already Ready.",
      );
    }
    if (authRefreshInFlight) {
      throw workerError(ERROR_KINDS.CRASH, "Login is already being rechecked.");
    }
    authRefreshInFlight = true;
    const previousPhase = phase;
    phase = AUTH_REFRESH_PHASE;
    emit();
    try {
      const contract = loadPortalContract();
      portalContract = contract;
      requireSection("origins");
      let page = null;
      let adoptedFallback = false;
      if (isUsableControlledPage(controlledPage, contract)) {
        page = controlledPage;
      } else {
        page = selectAllowedOriginPage(context, contract);
        if (!page) {
          throw workerError(
            ERROR_KINDS.CRASH,
            "No allowed e-Aushadhi page is available to recheck login.",
          );
        }
        setControlledPage(page);
        adoptedFallback = true;
        log({
          phase: "origin-guard",
          url: typeof page.url === "function" ? page.url() : null,
          pageRole: "controlled",
          containmentAction: "adopted_allowed_page",
          error: "Recheck adopted an allowed e-Aushadhi page because the prior controlled page was unavailable.",
        });
      }
      try {
        const authSpec = requireSection("authProbe");
        const probe = await probeAuthenticatedSession(page, authSpec);
        applyAuthProbeResult(probe);
      } catch (error) {
        if (error?.kind !== ERROR_KINDS.CONTRACT_INCOMPLETE) throw error;
        applyAuthProbeResult({
          authenticated: false,
          reason:
            "Login in the dedicated Edge window. Authenticated portal state cannot be proven yet.",
        });
      }
      phase = CONNECT_PHASES.READY;
      log({
        phase: AUTH_REFRESH_PHASE,
        url: typeof page.url === "function" ? page.url() : null,
        error: adoptedFallback ? "recheck_after_fallback_adoption" : "recheck_existing_controlled_page",
      });
      return emit();
    } catch (error) {
      const wrapped = wrapAuthRefreshFailure(error, AUTH_REFRESH_PHASE);
      if (wrapped.kind === ERROR_KINDS.DISALLOWED_ORIGIN) {
        await failClosed(wrapped, wrapped.details?.url, {
          pageRole: "controlled",
          containmentAction: "fail_closed",
        });
        throw wrapped;
      }
      if (machine.get() === STATES.READY) {
        machine.transition(STATES.AUTH_REQUIRED);
      }
      setError(wrapped);
      log({
        phase: wrapped.details?.connectPhase || AUTH_REFRESH_PHASE,
        errorKind: wrapped.kind,
        error: wrapped.details?.causeMessageSanitized || wrapped.message,
      });
      phase = previousPhase || CONNECT_PHASES.READY;
      emit();
      throw wrapped;
    } finally {
      authRefreshInFlight = false;
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

  async function runControlledEntryDryRun(rawProductId, rawAccessToken) {
    const id = validateProductId(rawProductId);
    const accessToken = validateAccessToken(rawAccessToken);
    const previous = machine.get();
    if (previous === STATES.STOPPING) {
      throw workerError(ERROR_KINDS.CANCELLED, "Browser worker is stopping.");
    }
    const runId = randomUUID();
    lastErrorKind = null;
    lastErrorMessage = null;
    phase = "entry-dry-run";
    emit();
    try {
      const result = await runEntryDryRun({
        productId: id,
        workerState: previous,
        callRpc: (name, args) => rpcCall(accessToken, name, args),
      });
      result.runId = runId;
      lastErrorKind = result.errorKind;
      lastErrorMessage = result.message;
      log({
        runId,
        productId: id,
        phase: "entry-dry-run",
        errorKind: result.errorKind,
        error: result.message,
      });
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
    recheckAuthentication,
    stop,
    runFoundationCheck,
    runControlledEntryDryRun,
    capturePortalContract,
    openLastCaptureFolder,
  };
}

module.exports = {
  AUTH_REFRESH_PHASE,
  CONNECT_PHASES,
  createEaushadhiWorker,
};
