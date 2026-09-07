/**
 * Connect-phase diagnostic hardening. Does not launch Microsoft Edge or contact the portal.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "scripts/fixtures/eaushadhi-portal");
const { parseHtml } = require(join(fixtureDir, "mini-dom.cjs"));
const { createEaushadhiWorker, CONNECT_PHASES } = require(
  join(root, "electron/eaushadhi-worker/index.js"),
);
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { ERROR_KINDS, WorkerError } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const { writeDiagnostic, sanitizeText } = require(
  join(root, "electron/eaushadhi-worker/diagnostics.js"),
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

assert(CONNECT_PHASES.LAUNCH === "connect:launch", "launch phase name is stable");
assert(CONNECT_PHASES.NAVIGATE === "connect:navigate", "navigate phase name is stable");
assert(CONNECT_PHASES.AUTH_PROBE === "connect:auth-probe", "auth-probe phase name is stable");
assert(CONNECT_PHASES.READY === "connect:ready", "ready phase name is stable");

function readLogs(tmp) {
  const dir = join(tmp, "eaushadhi-worker-logs");
  return readdirSync(dir)
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function lastLogRecord(tmp) {
  const lines = readLogs(tmp)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

function createMockPage(html, { startUrl = "about:blank", gotoImpl, evaluateImpl } = {}) {
  let currentUrl = startUrl;
  const document = parseHtml(html);
  const listeners = {};
  const mainFrame = { url: () => currentUrl };
  return {
    url: () => currentUrl,
    mainFrame: () => mainFrame,
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off() {},
    async goto(next) {
      if (typeof gotoImpl === "function") return gotoImpl(next);
      currentUrl = next;
      return null;
    },
    async evaluate(fn, arg) {
      if (typeof evaluateImpl === "function") return evaluateImpl(fn, arg);
      const prevDoc = global.document;
      const prevLoc = global.location;
      global.document = document;
      global.location = { href: currentUrl };
      try {
        return fn(arg);
      } finally {
        global.document = prevDoc;
        global.location = prevLoc;
      }
    },
  };
}

function createMockContext(page, { newPageImpl } = {}) {
  let closed = false;
  return {
    pages: () => (page ? [page] : []),
    on() {},
    off() {},
    async newPage() {
      if (typeof newPageImpl === "function") return newPageImpl();
      if (page) return page;
      throw new Error("newPage failed");
    },
    async close() {
      closed = true;
    },
    isClosed: () => closed,
  };
}

function makeWorker(tmp, launchBrowser) {
  return createEaushadhiWorker({
    getUserDataPath: () => tmp,
    launchBrowser,
  });
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-launch-"));
  const worker = makeWorker(tmp, async () => {
    throw new Error("browserType.launchPersistentContext: Target page, context or browser has been closed");
  });
  let thrown = null;
  try {
    await worker.connect();
  } catch (error) {
    thrown = error;
  }
  const record = lastLogRecord(tmp);
  assert(thrown instanceof WorkerError, "launch throw is a WorkerError");
  assert(thrown.kind === ERROR_KINDS.CRASH, "ordinary launch throw is classified CRASH");
  assert(thrown.details?.connectPhase === CONNECT_PHASES.LAUNCH, "launch throw records connect:launch");
  assert(
    String(thrown.details?.causeMessageSanitized).includes("Target page, context or browser has been closed"),
    "launch throw retains sanitized Playwright message",
  );
  assert(record.phase === CONNECT_PHASES.LAUNCH, "JSONL phase is connect:launch");
  assert(record.error_kind === ERROR_KINDS.CRASH, "JSONL error_kind is CRASH");
  assert(
    String(record.error).includes("Target page, context or browser has been closed"),
    "JSONL error retains the underlying launch message",
  );
  assert(worker.getStatus().state === STATES.FAILED, "launch throw leaves worker FAILED");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-page-"));
  let closed = false;
  const context = {
    pages: () => [],
    on() {},
    off() {},
    async newPage() {
      throw new Error("browserContext.newPage: Protocol error");
    },
    async close() {
      closed = true;
    },
  };
  const worker = makeWorker(tmp, async () => context);
  let thrown = null;
  try {
    await worker.connect();
  } catch (error) {
    thrown = error;
  }
  const record = lastLogRecord(tmp);
  assert(thrown.details?.connectPhase === CONNECT_PHASES.PAGE, "newPage throw records connect:page");
  assert(String(thrown.details?.causeMessageSanitized).includes("Protocol error"), "page throw retains cause");
  assert(record.phase === CONNECT_PHASES.PAGE, "JSONL phase is connect:page");
  assert(closed === true, "failed page acquisition closes context");
  assert(worker.getStatus().state === STATES.FAILED, "page throw leaves worker FAILED");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-nav-"));
  const page = createMockPage("<html></html>", {
    gotoImpl: async () => {
      throw new Error("page.goto: net::ERR_CONNECTION_RESET at https://www.e-aushadhi.gov.in/");
    },
  });
  const context = createMockContext(page);
  const worker = makeWorker(tmp, async () => context);
  let thrown = null;
  try {
    await worker.connect();
  } catch (error) {
    thrown = error;
  }
  const record = lastLogRecord(tmp);
  assert(thrown.details?.connectPhase === CONNECT_PHASES.NAVIGATE, "goto throw records connect:navigate");
  assert(String(thrown.message).includes("Browser connect failed."), "public message stays concise");
  assert(String(thrown.details?.causeMessageSanitized).includes("page.goto: net::ERR_CONNECTION_RESET"), "navigate retains Playwright message");
  assert(record.phase === CONNECT_PHASES.NAVIGATE, "JSONL phase is connect:navigate");
  assert(String(record.error).includes("page.goto: net::ERR_CONNECTION_RESET"), "JSONL error retains goto cause");
  assert(context.isClosed() === true, "failed navigate closes context");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-origin-"));
  const page = createMockPage("<html></html>", {
    gotoImpl: async (next) => {
      page._url = next;
    },
  });
  page.url = () => "https://example.com/escape";
  const context = createMockContext(page);
  const worker = makeWorker(tmp, async () => context);
  let thrown = null;
  try {
    await worker.connect();
  } catch (error) {
    thrown = error;
  }
  const record = lastLogRecord(tmp);
  assert(thrown.kind === ERROR_KINDS.DISALLOWED_ORIGIN, "assertAllowedUrl stays DISALLOWED_ORIGIN");
  assert(thrown.kind !== ERROR_KINDS.CRASH, "DISALLOWED_ORIGIN is not collapsed to CRASH");
  assert(thrown.details?.connectPhase === CONNECT_PHASES.ORIGIN_CHECK, "origin check records connect:origin-check");
  assert(record.error_kind === ERROR_KINDS.DISALLOWED_ORIGIN, "JSONL keeps DISALLOWED_ORIGIN");
  assert(context.isClosed() === true, "disallowed origin during connect closes context");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-probe-"));
  const page = createMockPage("<html></html>", {
    evaluateImpl: async () => {
      throw new Error("page.evaluate: Execution context was destroyed");
    },
  });
  const context = createMockContext(page);
  const worker = makeWorker(tmp, async () => context);
  let thrown = null;
  try {
    await worker.connect();
  } catch (error) {
    thrown = error;
  }
  const record = lastLogRecord(tmp);
  assert(thrown.details?.connectPhase === CONNECT_PHASES.AUTH_PROBE, "auth probe throw records connect:auth-probe");
  assert(
    String(thrown.details?.causeMessageSanitized).includes("Execution context was destroyed"),
    "auth probe retains sanitized cause",
  );
  assert(record.phase === CONNECT_PHASES.AUTH_PROBE, "JSONL phase is connect:auth-probe");
  assert(context.isClosed() === true, "failed auth probe closes context");
}

{
  const loginHtml = readFileSync(join(fixtureDir, "login.html"), "utf8");
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-authreq-"));
  const page = createMockPage(loginHtml);
  const context = createMockContext(page);
  const worker = makeWorker(tmp, async () => context);
  const status = await worker.connect();
  assert(status.state === STATES.AUTH_REQUIRED, "unauthenticated login page is AUTH_REQUIRED");
  assert(status.state !== STATES.FAILED, "AUTH_REQUIRED is not FAILED");
  assert(context.isClosed() === false, "AUTH_REQUIRED keeps the dedicated context open");
  assert(status.lastErrorKind === ERROR_KINDS.AUTH_REQUIRED, "AUTH_REQUIRED is not converted to CRASH");
  assert(status.phase === CONNECT_PHASES.READY, "successful connect ends at connect:ready");
}

{
  const authHtml = readFileSync(join(fixtureDir, "authenticated.html"), "utf8");
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-connect-ready-"));
  const page = createMockPage(authHtml);
  const context = createMockContext(page);
  const worker = makeWorker(tmp, async () => context);
  const status = await worker.connect();
  assert(status.state === STATES.READY, "authenticated page is READY");
  assert(context.isClosed() === false, "READY keeps the dedicated context open");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-diag-sanitize-"));
  writeDiagnostic(tmp, {
    phase: CONNECT_PHASES.LAUNCH,
    errorKind: ERROR_KINDS.CRASH,
    error:
      "access_token=secret.token value Authorization: Bearer abc.def.ghi password=hunter2 otp=123456 captcha=xyz cookie=session storage.state=leak",
  });
  const record = lastLogRecord(tmp);
  const blob = JSON.stringify(record);
  assert(blob.includes("[redacted]"), "diagnostics sanitizer redacts sensitive tokens");
  assert(!/access_token=secret/i.test(blob), "access token value is not stored");
  assert(!/Bearer abc\.def\.ghi/i.test(blob), "bearer value is not stored");
  assert(!/password=hunter2/i.test(blob), "password is not stored");
  assert(!/otp=123456/i.test(blob), "OTP is not stored");
  assert(!/captcha=xyz/i.test(blob), "CAPTCHA is not stored");
  assert(!/cookie=session/i.test(blob), "cookie is not stored");
  assert(!/storage\.state=leak/i.test(blob), "storage state is not stored");
  assert(sanitizeText("password=secret").includes("[redacted]"), "sanitizeText redacts password");
}

if (failed) {
  console.error(`\n${failed} connect diagnostic assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-connect-diagnostics-smoke: all assertions passed");
