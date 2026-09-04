/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");

const guardedPages = new WeakSet();

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
    try {
      assertAllowedUrl(url, contract);
    } catch (error) {
      if (error?.kind === ERROR_KINDS.DISALLOWED_ORIGIN) {
        onDisallowed(error, url);
      } else {
        throw error;
      }
    }
  };
  page.on("framenavigated", handler);
  return () => {
    if (typeof page.off === "function") page.off("framenavigated", handler);
    guardedPages.delete(page);
  };
}

function attachContextOriginGuard(context, { contract, onDisallowed }) {
  if (!context) return () => {};
  const detachByPage = new Map();

  const guardPage = (page) => {
    if (!page || detachByPage.has(page)) return;
    detachByPage.set(
      page,
      attachMainFrameOriginGuard(page, { contract, onDisallowed }),
    );
  };

  const existing = typeof context.pages === "function" ? context.pages() : [];
  for (const page of existing) guardPage(page);

  const onPage = (page) => guardPage(page);
  if (typeof context.on === "function") context.on("page", onPage);

  return () => {
    if (typeof context.off === "function") context.off("page", onPage);
    for (const detach of detachByPage.values()) {
      try {
        detach();
      } catch {
        // ignore
      }
    }
    detachByPage.clear();
  };
}

module.exports = {
  originFromUrl,
  shouldEnforceMainFrameUrl,
  assertAllowedUrl,
  attachMainFrameOriginGuard,
  attachContextOriginGuard,
};
