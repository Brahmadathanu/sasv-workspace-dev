/* eslint-env node */

const fs = require("fs");
const path = require("path");

const SENSITIVE =
  /access_token|refresh_token|authorization|bearer\s+[a-z0-9._-]+|password|otp|captcha|cookie|storage.state/gi;

function sanitizeText(value) {
  return String(value || "")
    .replace(SENSITIVE, "[redacted]")
    .slice(0, 500);
}

function diagnosticOrigin(urlValue) {
  try {
    const parsed = new URL(String(urlValue || ""));
    if (!parsed.protocol || !parsed.host) return "INVALID_URL";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "INVALID_URL";
  }
}

function safeUrl(urlValue) {
  try {
    const parsed = new URL(String(urlValue || ""));
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeDiagnostic(userDataPath, record) {
  const root = path.join(userDataPath, "eaushadhi-worker-logs");
  ensureDir(root);
  const day = new Date().toISOString().slice(0, 10);
  const filePath = path.join(root, `${day}.jsonl`);
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    run_id: record.runId || null,
    product_id: record.productId || null,
    worker_state: record.workerState || null,
    phase: record.phase || null,
    url:
      record.errorKind === "DISALLOWED_ORIGIN" || record.phase === "origin-guard"
        ? diagnosticOrigin(record.url)
        : safeUrl(record.url),
    contract_section: record.contractSection || null,
    error_kind: record.errorKind || null,
    error: sanitizeText(record.error),
  });
  fs.appendFileSync(filePath, `${line}\n`, "utf8");
}

module.exports = {
  sanitizeText,
  safeUrl,
  diagnosticOrigin,
  writeDiagnostic,
};
