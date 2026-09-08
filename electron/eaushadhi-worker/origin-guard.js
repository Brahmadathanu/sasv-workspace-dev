/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");

const DETECTION_SOURCES = Object.freeze({
  NAVIGATION_EVENT: "navigation_event",
  PAGE_ATTACH_CHECK: "page_attach_check",
  CONTEXT_RECONCILIATION: "context_reconciliation",
});

const DEFAULT_RECONCILE_INTERVAL_MS = 750;

const guardedPages = new WeakSet();
const containmentInFlight = new WeakSet();

function originFromUrl(urlValue) {
  let parsed;
  try {
    parsed = new URL(String(urlValue || ""));
  } catch {
    throw workerError(
      ERROR_KINDS.DISALLOWED_ORIGIN,
      "Main-frame URL is not a valid e-Aushadhi origin.",
    );
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function shouldEnforceMainFrameUrl(urlValue) {
  const raw = String(urlValue || "").trim();
  if (!raw) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

function assertAllowedUrl(urlValue, contract) {
  const origin = originFromUrl(urlValue);
  const allowed = new Set(
    (Array.isArray(contract?.allowedOrigins) ? contract.allowedOrigins : []).map(
      (value) => String(value).replace(/\/+$/, ""),
    ),
  );
  if (!allowed.has(origin)) {
    throw workerError(
      ERROR_KINDS.DISALLOWED_ORIGIN,
      "Main-frame navigation left the allowed e-Aushadhi origin.",
    );
  }
  return origin;
}

function classifyMainFrameUrl(page, { contract, onDisallowed, detectionSource }) {
  if (!page) return false;
  if (typeof page.isClosed === "function" && page.isClosed()) return false;
  if (containmentInFlight.has(page)) return false;
  const url = typeof page.url === "function" ? page.url() : "";
  if (!shouldEnforceMainFrameUrl(url)) return false;
  try {
    assertAllowedUrl(url, contract);
    return false;
  } catch (error) {
    if (error?.kind !== ERROR_KINDS.DISALLOWED_ORIGIN) throw error;
    if (containmentInFlight.has(page)) return false;
    containmentInFlight.add(page);
    onDisallowed(error, url, page, { detectionSource });
    return true;
  }
}

function attachMainFrameOriginGuard(page, { contract, onDisallowed }) {
  if (!page || typeof page.on !== "function") return () => {};
  if (guardedPages.has(page)) return () => {};
  guardedPages.add(page);
  const handler = (frame) => {
    if (typeof page.mainFrame === "function" && frame !== page.mainFrame()) {
      return;
    }
    const url = typeof frame?.url === "function" ? frame.url() : page.url?.();
    if (!shouldEnforceMainFrameUrl(url)) return;
    classifyMainFrameUrl(page, {
      contract,
      onDisallowed,
      detectionSource: DETECTION_SOURCES.NAVIGATION_EVENT,
    });
  };
  page.on("framenavigated", handler);
  return () => {
    if (typeof page.off === "function") page.off("framenavigated", handler);
    guardedPages.delete(page);
  };
}

function isAllowedPageUrl(urlValue, contract) {
  if (!shouldEnforceMainFrameUrl(urlValue)) return false;
  try {
    assertAllowedUrl(urlValue, contract);
    return true;
  } catch (error) {
    if (error?.kind === ERROR_KINDS.DISALLOWED_ORIGIN) return false;
    throw error;
  }
}

function selectAllowedOriginPage(context, contract) {
  const pages = typeof context.pages === "function" ? context.pages() : [];
  let selected = null;
  for (const page of pages) {
    if (!page) continue;
    if (typeof page.isClosed === "function" && page.isClosed()) continue;
    const url = typeof page.url === "function" ? page.url() : "";
    if (!isAllowedPageUrl(url, contract)) continue;
    selected = page;
  }
  return selected;
}

function attachContextOriginGuard(
  context,
  {
    contract,
    onDisallowed,
    reconcileIntervalMs = DEFAULT_RECONCILE_INTERVAL_MS,
    createInterval = setInterval,
    clearIntervalFn = clearInterval,
  } = {},
) {
  if (!context) {
    return {
      detach() {},
      activateReconciliation() {},
      isReconciliationActive() {
        return false;
      },
      runReconcileOnce() {},
    };
  }

  const detachByPage = new Map();
  let reconciliationActive = false;
  let detached = false;
  let reconcileTimer = null;

  const ensurePageGuard = (page) => {
    if (!page || detachByPage.has(page)) return;
    detachByPage.set(
      page,
      attachMainFrameOriginGuard(page, { contract, onDisallowed }),
    );
  };

  const reconcileOpenPages = () => {
    if (detached || !reconciliationActive) return;
    const pages = typeof context.pages === "function" ? context.pages() : [];
    for (const page of pages) {
      if (!page) continue;
      if (typeof page.isClosed === "function" && page.isClosed()) continue;
      ensurePageGuard(page);
      classifyMainFrameUrl(page, {
        contract,
        onDisallowed,
        detectionSource: DETECTION_SOURCES.CONTEXT_RECONCILIATION,
      });
    }
  };

  const stopReconciler = () => {
    if (reconcileTimer != null) {
      try {
        clearIntervalFn(reconcileTimer);
      } catch {
        // ignore
      }
      reconcileTimer = null;
    }
  };

  const startReconciler = () => {
    if (detached || reconcileTimer != null) return;
    reconcileTimer = createInterval(() => {
      reconcileOpenPages();
    }, reconcileIntervalMs);
    if (reconcileTimer && typeof reconcileTimer.unref === "function") {
      reconcileTimer.unref();
    }
  };

  // Passive attach: existing pages get navigation listeners only.
  const existing = typeof context.pages === "function" ? context.pages() : [];
  for (const page of existing) ensurePageGuard(page);

  const onPage = (page) => {
    if (detached || !page) return;
    ensurePageGuard(page);
    if (!reconciliationActive) return;
    classifyMainFrameUrl(page, {
      contract,
      onDisallowed,
      detectionSource: DETECTION_SOURCES.PAGE_ATTACH_CHECK,
    });
  };
  if (typeof context.on === "function") context.on("page", onPage);

  const activateReconciliation = () => {
    if (detached || reconciliationActive) return;
    reconciliationActive = true;
    reconcileOpenPages();
    startReconciler();
  };

  const detach = () => {
    if (detached) return;
    detached = true;
    reconciliationActive = false;
    stopReconciler();
    if (typeof context.off === "function") context.off("page", onPage);
    for (const detachPage of detachByPage.values()) {
      try {
        detachPage();
      } catch {
        // ignore
      }
    }
    detachByPage.clear();
  };

  return {
    detach,
    activateReconciliation,
    isReconciliationActive() {
      return reconciliationActive && !detached;
    },
    runReconcileOnce() {
      reconcileOpenPages();
    },
  };
}

module.exports = {
  DETECTION_SOURCES,
  DEFAULT_RECONCILE_INTERVAL_MS,
  originFromUrl,
  shouldEnforceMainFrameUrl,
  assertAllowedUrl,
  isAllowedPageUrl,
  selectAllowedOriginPage,
  classifyMainFrameUrl,
  attachMainFrameOriginGuard,
  attachContextOriginGuard,
};
