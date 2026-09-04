/* eslint-env node */

const { sanitizeText, diagnosticOrigin } = require("../diagnostics");

const FORBIDDEN_KEY =
  /password|otp|captcha|cookie|localstorage|sessionstorage|storagestate|access_token|refresh_token|authorization|bearer|csrf|anti-?csrf/i;

function safePathFromUrl(urlValue) {
  try {
    const parsed = new URL(String(urlValue || ""));
    if (parsed.protocol === "about:") return "about:blank";
    return parsed.pathname || "/";
  } catch {
    return null;
  }
}

function safeOriginFromUrl(urlValue) {
  return diagnosticOrigin(urlValue);
}

function childFrameOrigins(page) {
  if (!page || typeof page.frames !== "function") return [];
  const main = typeof page.mainFrame === "function" ? page.mainFrame() : null;
  const seen = new Set();
  const origins = [];
  for (const frame of page.frames()) {
    if (main && frame === main) continue;
    const raw = typeof frame?.url === "function" ? frame.url() : "";
    const origin = safeOriginFromUrl(raw);
    if (!origin || origin === "INVALID_URL") continue;
    if (seen.has(origin)) continue;
    seen.add(origin);
    origins.push(origin);
  }
  return origins;
}

function stripForbiddenKeys(value, path, dropped) {
  if (Array.isArray(value)) {
    return value.map((item, index) => stripForbiddenKeys(item, `${path}[${index}]`, dropped));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return sanitizeText(value);
    return value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      dropped.push(path ? `${path}.${key}` : key);
      continue;
    }
    if (key === "current_value" || key === "innerHTML" || key === "outerHTML") {
      dropped.push(path ? `${path}.${key}` : key);
      continue;
    }
    if (key === "value" && !/options\[\d+\]$/.test(path)) {
      dropped.push(path ? `${path}.${key}` : key);
      continue;
    }
    out[key] = stripForbiddenKeys(child, path ? `${path}.${key}` : key, dropped);
  }
  return out;
}

function redactCapture(record) {
  const dropped = [];
  const redacted = stripForbiddenKeys(record, "", dropped);
  redacted.redaction = {
    omitted_input_values: true,
    omitted_query_and_hash: true,
    omitted_html_dumps: true,
    omitted_keys: dropped,
  };
  return redacted;
}

module.exports = {
  safePathFromUrl,
  safeOriginFromUrl,
  childFrameOrigins,
  redactCapture,
};
