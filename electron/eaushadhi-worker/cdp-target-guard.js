/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");
const {
  shouldEnforceMainFrameUrl,
  assertAllowedUrl,
} = require("./origin-guard");

const CDP_DETECTION_SOURCES = Object.freeze({
  CDP_TARGET_CREATED: "cdp_target_created",
  CDP_TARGET_CHANGED: "cdp_target_changed",
  CDP_TARGET_RECONCILIATION: "cdp_target_reconciliation",
});

const DEFAULT_CDP_RECONCILE_INTERVAL_MS = 750;
const DEFAULT_CLOSE_VERIFY_TIMEOUT_MS = 2500;

function createTargetContainmentRegistry() {
  const claims = new Map();
  return {
    tryClaim(targetId) {
      const id = String(targetId || "");
      if (!id) return false;
      if (claims.has(id)) return false;
      claims.set(id, { status: "in_flight", at: Date.now() });
      return true;
    },
    markClosed(targetId) {
      const id = String(targetId || "");
      if (!id) return;
      claims.set(id, { status: "closed", at: Date.now() });
    },
    markFailed(targetId) {
      const id = String(targetId || "");
      if (!id) return;
      claims.delete(id);
    },
    has(targetId) {
      return claims.has(String(targetId || ""));
    },
    isClosed(targetId) {
      return claims.get(String(targetId || ""))?.status === "closed";
    },
    clear() {
      claims.clear();
    },
  };
}

async function resolvePageTargetId(context, page) {
  if (!context || !page || typeof context.newCDPSession !== "function") {
    throw workerError(
      ERROR_KINDS.CRASH,
      "Controlled page CDP binding is unavailable.",
    );
  }
  if (typeof page.isClosed === "function" && page.isClosed()) {
    throw workerError(
      ERROR_KINDS.CRASH,
      "Controlled page closed before CDP target binding.",
    );
  }
  const pageSession = await context.newCDPSession(page);
  try {
    const result = await pageSession.send("Target.getTargetInfo");
    const targetId = result?.targetInfo?.targetId;
    if (!targetId) {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Controlled page CDP target id could not be resolved.",
      );
    }
    return String(targetId);
  } finally {
    try {
      if (typeof pageSession.detach === "function") await pageSession.detach();
    } catch {
      // ignore detach errors
    }
  }
}

function createCdpTargetGuard({
  browser,
  contract,
  getControlledTargetId,
  onDisallowedTarget,
  containmentRegistry,
  reconcileIntervalMs = DEFAULT_CDP_RECONCILE_INTERVAL_MS,
  closeVerifyTimeoutMs = DEFAULT_CLOSE_VERIFY_TIMEOUT_MS,
  createInterval = setInterval,
  clearIntervalFn = clearInterval,
  createBrowserCdpSession,
} = {}) {
  let session = null;
  let active = false;
  let detached = false;
  let reconcileTimer = null;
  const knownTargets = new Map();
  const destroyWaiters = new Map();

  const registry = containmentRegistry || createTargetContainmentRegistry();

  function notifyDestroyed(targetId) {
    const id = String(targetId || "");
    const waiters = destroyWaiters.get(id);
    if (!waiters || !waiters.size) return;
    for (const resolve of waiters) {
      try {
        resolve(true);
      } catch {
        // ignore
      }
    }
    destroyWaiters.delete(id);
  }

  function waitForDestroyed(targetId, timeoutMs) {
    const id = String(targetId || "");
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        const set = destroyWaiters.get(id);
        if (set) {
          set.delete(finish);
          if (!set.size) destroyWaiters.delete(id);
        }
        resolve(value);
      };
      if (!destroyWaiters.has(id)) destroyWaiters.set(id, new Set());
      destroyWaiters.get(id).add(finish);
      setTimeout(() => finish(false), timeoutMs).unref?.();
    });
  }

  async function targetStillPresent(targetId) {
    if (!session) return false;
    const result = await session.send("Target.getTargets");
    const list = Array.isArray(result?.targetInfos) ? result.targetInfos : [];
    return list.some((info) => String(info?.targetId || "") === String(targetId));
  }

  function classifyTargetInfo(targetInfo, detectionSource) {
    if (detached || !active || !targetInfo) return;
    if (String(targetInfo.type || "") !== "page") return;
    const targetId = String(targetInfo.targetId || "");
    if (!targetId) return;
    const url = String(targetInfo.url || "");
    knownTargets.set(targetId, { url, type: targetInfo.type });
    if (!shouldEnforceMainFrameUrl(url)) return;
    if (registry.has(targetId)) return;
    try {
      assertAllowedUrl(url, contract);
      return;
    } catch (error) {
      if (error?.kind !== ERROR_KINDS.DISALLOWED_ORIGIN) throw error;
      if (!registry.tryClaim(targetId)) return;
      onDisallowedTarget(error, url, {
        targetId,
        detectionSource,
      });
    }
  }

  function onTargetCreated(event) {
    classifyTargetInfo(event?.targetInfo, CDP_DETECTION_SOURCES.CDP_TARGET_CREATED);
  }

  function onTargetInfoChanged(event) {
    classifyTargetInfo(event?.targetInfo, CDP_DETECTION_SOURCES.CDP_TARGET_CHANGED);
  }

  function onTargetDestroyed(event) {
    const targetId = String(event?.targetId || "");
    if (!targetId) return;
    knownTargets.delete(targetId);
    notifyDestroyed(targetId);
  }

  async function reconcileTargets() {
    if (detached || !active || !session) return;
    const result = await session.send("Target.getTargets");
    const list = Array.isArray(result?.targetInfos) ? result.targetInfos : [];
    for (const info of list) {
      classifyTargetInfo(info, CDP_DETECTION_SOURCES.CDP_TARGET_RECONCILIATION);
    }
  }

  function stopReconciler() {
    if (reconcileTimer == null) return;
    try {
      clearIntervalFn(reconcileTimer);
    } catch {
      // ignore
    }
    reconcileTimer = null;
  }

  function startReconciler() {
    if (detached || reconcileTimer != null) return;
    reconcileTimer = createInterval(() => {
      void reconcileTargets().catch(() => {});
    }, reconcileIntervalMs);
    if (reconcileTimer && typeof reconcileTimer.unref === "function") {
      reconcileTimer.unref();
    }
  }

  async function activate() {
    if (detached || active) return session;
    if (!browser || typeof browser.newBrowserCDPSession !== "function") {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Browser-level CDP session is unavailable for target discovery.",
      );
    }
    const createSession =
      typeof createBrowserCdpSession === "function"
        ? createBrowserCdpSession
        : () => browser.newBrowserCDPSession();
    session = await createSession();
    if (!session || typeof session.send !== "function") {
      throw workerError(
        ERROR_KINDS.CRASH,
        "Browser-level CDP session could not be created.",
      );
    }
    if (typeof session.on === "function") {
      session.on("Target.targetCreated", onTargetCreated);
      session.on("Target.targetInfoChanged", onTargetInfoChanged);
      session.on("Target.targetDestroyed", onTargetDestroyed);
    }
    await session.send("Target.setDiscoverTargets", { discover: true });
    active = true;
    await reconcileTargets();
    startReconciler();
    return session;
  }

  async function closeAndVerifyTarget(targetId) {
    const id = String(targetId || "");
    if (!id || !session) {
      return { closed: false, reason: "no_session" };
    }
    const destroyedPromise = waitForDestroyed(id, closeVerifyTimeoutMs);
    try {
      await session.send("Target.closeTarget", { targetId: id });
    } catch (error) {
      registry.markFailed(id);
      return {
        closed: false,
        reason: "close_threw",
        errorMessage: String(error?.message || error || "Target.closeTarget failed"),
      };
    }
    const destroyed = await destroyedPromise;
    if (destroyed) {
      registry.markClosed(id);
      return { closed: true };
    }
    let stillThere = true;
    try {
      stillThere = await targetStillPresent(id);
    } catch {
      stillThere = true;
    }
    if (!stillThere) {
      registry.markClosed(id);
      return { closed: true };
    }
    registry.markFailed(id);
    return { closed: false, reason: "target_remains" };
  }

  async function detach() {
    if (detached) return;
    detached = true;
    active = false;
    stopReconciler();
    for (const waiters of destroyWaiters.values()) {
      for (const resolve of waiters) {
        try {
          resolve(false);
        } catch {
          // ignore
        }
      }
    }
    destroyWaiters.clear();
    knownTargets.clear();
    if (session) {
      try {
        if (typeof session.off === "function") {
          session.off("Target.targetCreated", onTargetCreated);
          session.off("Target.targetInfoChanged", onTargetInfoChanged);
          session.off("Target.targetDestroyed", onTargetDestroyed);
        }
      } catch {
        // ignore
      }
      try {
        await session.send("Target.setDiscoverTargets", { discover: false });
      } catch {
        // ignore
      }
      try {
        if (typeof session.detach === "function") await session.detach();
      } catch {
        // ignore
      }
    }
    session = null;
  }

  return {
    activate,
    detach,
    closeAndVerifyTarget,
    reconcileOnce: reconcileTargets,
    isActive() {
      return active && !detached;
    },
    getControlledTargetIdSnapshot() {
      return typeof getControlledTargetId === "function" ? getControlledTargetId() : null;
    },
  };
}

module.exports = {
  CDP_DETECTION_SOURCES,
  DEFAULT_CDP_RECONCILE_INTERVAL_MS,
  DEFAULT_CLOSE_VERIFY_TIMEOUT_MS,
  createTargetContainmentRegistry,
  resolvePageTargetId,
  createCdpTargetGuard,
};
