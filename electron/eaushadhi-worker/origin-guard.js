/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");

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
  };
}

module.exports = {
  originFromUrl,
  shouldEnforceMainFrameUrl,
  assertAllowedUrl,
  attachMainFrameOriginGuard,
};
