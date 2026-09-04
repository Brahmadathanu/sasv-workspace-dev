/* eslint-env node */

const { ERROR_KINDS, workerError } = require("./errors");

const EAUSHADHI_MODULE_PATH = "/public/shared/e-aushadhi-review-control.html";
const LOCAL_STATIC_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_STATIC_PORT = "3000";

function senderUrlFromEvent(event) {
  const frameUrl = event?.senderFrame?.url;
  if (typeof frameUrl === "string" && frameUrl) return frameUrl;
  if (typeof event?.sender?.getURL === "function") {
    try {
      return event.sender.getURL() || "";
    } catch {
      return "";
    }
  }
  return "";
}

function normalizePathname(pathname) {
  return String(pathname || "").replace(/\\/g, "/").replace(/\/+$/, "") || "/";
}

function isAllowedEaushadhiRendererUrl(urlValue) {
  let parsed;
  try {
    parsed = new URL(String(urlValue || ""));
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  if (!LOCAL_STATIC_HOSTS.has(parsed.hostname)) return false;
  if (parsed.port !== LOCAL_STATIC_PORT) return false;
  return normalizePathname(parsed.pathname) === EAUSHADHI_MODULE_PATH;
}

function assertAllowedEaushadhiRenderer(event) {
  const url = senderUrlFromEvent(event);
  if (!isAllowedEaushadhiRendererUrl(url)) {
    throw workerError(
      ERROR_KINDS.UNAUTHORIZED_RENDERER,
      "The e-Aushadhi browser worker can be used only from Review & Control.",
    );
  }
  return url;
}

function windowIsEaushadhiReview(win) {
  if (!win || win.isDestroyed()) return false;
  try {
    return isAllowedEaushadhiRendererUrl(win.webContents.getURL());
  } catch {
    return false;
  }
}

module.exports = {
  EAUSHADHI_MODULE_PATH,
  senderUrlFromEvent,
  isAllowedEaushadhiRendererUrl,
  assertAllowedEaushadhiRenderer,
  windowIsEaushadhiReview,
};
