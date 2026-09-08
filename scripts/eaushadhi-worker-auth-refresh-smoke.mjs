/**
 * Login recheck on an existing dedicated browser session.
 * Does not launch Microsoft Edge or contact the live portal.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "scripts/fixtures/eaushadhi-portal");
const { parseHtml } = require(join(fixtureDir, "mini-dom.cjs"));
const { createEaushadhiWorker, AUTH_REFRESH_PHASE, CONNECT_PHASES } = require(
  join(root, "electron/eaushadhi-worker/index.js"),
);
const { attachMockBrowserCdp } = require(join(fixtureDir, "mock-browser-cdp.cjs"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { ERROR_KINDS, WorkerError, workerError } = require(
  join(root, "electron/eaushadhi-worker/errors.js"),
);
const { CHANNELS } = require(join(root, "electron/eaushadhi-worker/ipc.js"));
const { selectAllowedOriginPage } = require(join(root, "electron/eaushadhi-worker/origin-guard.js"));
const { loadPortalContract } = require(
  join(root, "electron/eaushadhi-worker/contracts/portal-contract.js"),
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

assert(AUTH_REFRESH_PHASE === "auth-refresh", "auth-refresh phase name is stable");
assert(CHANNELS.RECHECK_LOGIN === "eaushadhi-worker:recheck-login", "recheck channel is dedicated");

const loginHtml = readFileSync(join(fixtureDir, "login.html"), "utf8");
const authHtml = readFileSync(join(fixtureDir, "authenticated.html"), "utf8");
const workerIndexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
const recheckSrc = workerIndexSrc.slice(
  workerIndexSrc.indexOf("async function recheckAuthentication"),
  workerIndexSrc.indexOf("async function stop()"),
);
assert(recheckSrc.includes("probeAuthenticatedSession"), "recheck uses probeAuthenticatedSession");
assert(
  recheckSrc.includes("if (machine.get() === STATES.READY)") &&
    recheckSrc.includes("machine.transition(STATES.AUTH_REQUIRED)"),
  "recheck fail-closes READY to AUTH_REQUIRED on execution errors",
);
assert(!/\.goto\s*\(/.test(recheckSrc), "recheck source does not call goto");
assert(!/\.(?:click|fill|type|press|selectOption)\s*\(/.test(recheckSrc), "recheck source does not click/fill/submit");
assert(!recheckSrc.includes("run_begin"), "recheck does not begin a worker run");
assert(!recheckSrc.includes("callRpc"), "recheck does not call server lifecycle RPCs");
assert(
  controlSrc.includes("available && !busy && workerState === \"READY\""),
  "toolbar Capture is enabled only when READY",
);
assert(
  !/captureEnabled\s*=\s*available && !busy && \(workerState === "AUTH_REQUIRED"/.test(controlSrc),
  "toolbar Capture is not enabled in AUTH_REQUIRED",
);
function captureEnabledForWorkerState(workerState) {
  return workerState === STATES.READY;
}
assert(preloadSrc.includes("recheckLogin:"), "preload exposes recheckLogin");
assert(!/evaluate\s*:/.test(preloadSrc), "preload does not expose evaluate");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockPage(html, { startUrl = "about:blank", evaluateImpl } = {}) {
  let currentUrl = startUrl;
  let document = parseHtml(html);
  const listeners = {};
  const mainFrame = { url: () => currentUrl };
  const counts = { goto: 0, click: 0, fill: 0, evaluate: 0 };
  const page = {
    url: () => currentUrl,
    mainFrame: () => mainFrame,
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off() {},
    async goto(next) {
      counts.goto += 1;
      currentUrl = next;
      return null;
    },
    async click() {
      counts.click += 1;
    },
    async fill() {
      counts.fill += 1;
    },
    setHtml(nextHtml, url) {
      document = parseHtml(nextHtml);
      if (url) currentUrl = url;
    },
    counts,
    async evaluate(fn, arg) {
      counts.evaluate += 1;
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
  return page;
}

function createMockContext(pages) {
  let closed = false;
  const list = [...pages];
  return attachMockBrowserCdp({
    pages: () => [...list],
    on() {},
    off() {},
    async newPage() {
      return list[0];
    },
    addPage(page) {
      list.push(page);
    },
    async close() {
      closed = true;
    },
    isClosed: () => closed,
  });
}

function makeWorker(tmp, context, extras = {}) {
  return createEaushadhiWorker({
    getUserDataPath: () => tmp,
    launchBrowser: async () => context,
    callRpc: extras.callRpc,
  });
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-login-"));
  const page = createMockPage(loginHtml);
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  await worker.connect();
  const gotoAfterConnect = page.counts.goto;
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.AUTH_REQUIRED, "1: login fixture recheck remains AUTH_REQUIRED");
  assert(context.isClosed() === false, "1: browser stays open after unauthenticated recheck");
  assert(page.counts.goto === gotoAfterConnect, "7: recheck does not navigate");
  assert(page.counts.click === 0 && page.counts.fill === 0, "7: recheck does not click or fill");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-ready-"));
  const page = createMockPage(loginHtml);
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  await worker.connect();
  assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "connect starts AUTH_REQUIRED");
  page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.READY, "2: authenticated fixture after page change is READY");
  assert(status.label === "Ready", "2: status label becomes Ready");
  assert(status.lastErrorKind == null, "2: AUTH_REQUIRED error is cleared");
  assert(context.isClosed() === false, "2: browser stays open after READY transition");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-stay-ready-"));
  const page = createMockPage(authHtml);
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  await worker.connect();
  assert(worker.getStatus().state === STATES.READY, "connect authenticated is READY");
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.READY, "3: READY recheck stays READY");
  assert(status.lastErrorKind == null, "3: only current authenticated proof preserves READY");
  assert(context.isClosed() === false, "3: browser stays open while READY");
  assert(captureEnabledForWorkerState(status.state) === true, "9: Capture stays enabled only while READY");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-nocontext-"));
  const worker = createEaushadhiWorker({ getUserDataPath: () => tmp });
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof WorkerError, "4: no context is a governed WorkerError");
  assert(thrown.kind === ERROR_KINDS.WORKER_NOT_READY, "4: no context is WORKER_NOT_READY");
  assert(worker.getStatus().state === STATES.IDLE, "4: idle worker stays IDLE");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-failed-"));
  const worker = makeWorker(tmp, {
    pages: () => [],
    on() {},
    off() {},
    async newPage() {
      throw new Error("no page");
    },
    async close() {},
  });
  try {
    await worker.connect();
  } catch {
    // expected FAILED
  }
  assert(worker.getStatus().state === STATES.FAILED, "5: failed connect is FAILED");
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  assert(thrown.kind === ERROR_KINDS.WORKER_NOT_READY, "5: FAILED is an invalid recheck state");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-running-"));
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const page = createMockPage(authHtml);
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context, {
    callRpc: async () => held,
  });
  await worker.connect();
  const running = worker.runFoundationCheck(12, "a".repeat(24));
  await wait(20);
  assert(worker.getStatus().state === STATES.RUNNING, "5: foundation check is RUNNING");
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  assert(thrown.kind === ERROR_KINDS.WORKER_NOT_READY, "5: RUNNING is an invalid recheck state");
  release(null);
  await running.catch(() => {});
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-probe-throw-"));
  let probeThrows = false;
  const page = createMockPage(loginHtml, {
    evaluateImpl: async (fn, arg) => {
      if (probeThrows) throw new Error("page.evaluate: Execution context was destroyed");
      const document = parseHtml(loginHtml);
      const prevDoc = global.document;
      const prevLoc = global.location;
      global.document = document;
      global.location = { href: "https://www.e-aushadhi.gov.in/" };
      try {
        return fn(arg);
      } finally {
        global.document = prevDoc;
        global.location = prevLoc;
      }
    },
  });
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  const connected = await worker.connect();
  assert(connected.state === STATES.AUTH_REQUIRED, "probe throw fixture connects as AUTH_REQUIRED");
  probeThrows = true;
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof WorkerError, "6: probe throw is a governed WorkerError");
  assert(thrown.kind === ERROR_KINDS.CRASH, "6: probe throw is not converted to AUTH_REQUIRED");
  assert(thrown.kind !== ERROR_KINDS.AUTH_REQUIRED, "6: probe throw is not unauthenticated");
  assert(String(thrown.message).includes("Login recheck failed."), "6: probe throw has a useful recheck message");
  assert(
    String(thrown.details?.causeMessageSanitized).includes("Execution context was destroyed"),
    "6: probe throw retains sanitized cause",
  );
  assert(worker.getStatus().state !== STATES.READY, "6: probe throw does not set READY");
  assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "6: probe throw remains AUTH_REQUIRED");
  assert(context.isClosed() === false, "6: probe throw keeps the dedicated context open");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-ready-unauth-"));
  const page = createMockPage(authHtml);
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  await worker.connect();
  assert(worker.getStatus().state === STATES.READY, "ordinary unauth starts READY");
  page.setHtml(loginHtml, "https://www.e-aushadhi.gov.in/");
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.AUTH_REQUIRED, "ordinary unauthenticated READY recheck becomes AUTH_REQUIRED");
  assert(status.lastErrorKind === ERROR_KINDS.AUTH_REQUIRED, "ordinary unauthenticated result is AUTH_REQUIRED");
  assert(context.isClosed() === false, "ordinary unauthenticated READY recheck keeps the browser open");
  assert(captureEnabledForWorkerState(status.state) === false, "ordinary unauthenticated READY recheck disables Capture");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-ready-throw-"));
  let probeThrows = false;
  const page = createMockPage(authHtml, {
    evaluateImpl: async (fn, arg) => {
      if (probeThrows) throw new Error("page.evaluate: Execution context was destroyed");
      const document = parseHtml(authHtml);
      const prevDoc = global.document;
      const prevLoc = global.location;
      global.document = document;
      global.location = { href: "https://www.e-aushadhi.gov.in/" };
      try {
        return fn(arg);
      } finally {
        global.document = prevDoc;
        global.location = prevLoc;
      }
    },
  });
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  const connected = await worker.connect();
  assert(connected.state === STATES.READY, "READY probe-throw fixture connects as READY");
  assert(captureEnabledForWorkerState(connected.state) === true, "Capture is enabled while READY before failed recheck");
  probeThrows = true;
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  const status = worker.getStatus();
  assert(thrown instanceof WorkerError, "READY probe throw is a governed WorkerError");
  assert(thrown.kind === ERROR_KINDS.CRASH, "READY probe throw stays CRASH");
  assert(thrown.kind !== ERROR_KINDS.AUTH_REQUIRED, "READY probe throw is not ordinary unauthenticated");
  assert(String(thrown.message).includes("Login recheck failed."), "READY probe throw has a useful recheck message");
  assert(
    String(thrown.details?.causeMessageSanitized).includes("Execution context was destroyed"),
    "READY probe throw retains sanitized cause",
  );
  assert(status.state === STATES.AUTH_REQUIRED, "READY probe throw fails closed to AUTH_REQUIRED");
  assert(status.state !== STATES.READY, "READY probe throw does not retain READY");
  assert(status.lastErrorKind === ERROR_KINDS.CRASH, "READY probe throw records governed CRASH");
  assert(status.lastErrorKind !== ERROR_KINDS.AUTH_REQUIRED, "READY probe throw does not rewrite CRASH as AUTH_REQUIRED");
  assert(context.isClosed() === false, "READY probe throw keeps the dedicated context open");
  assert(captureEnabledForWorkerState(status.state) === false, "failed READY recheck disables Capture");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-ready-origin-"));
  let originThrows = false;
  const page = createMockPage(authHtml, {
    evaluateImpl: async (fn, arg) => {
      if (originThrows) {
        throw workerError(
          ERROR_KINDS.DISALLOWED_ORIGIN,
          "Main-frame navigation left the allowed e-Aushadhi origin.",
        );
      }
      const document = parseHtml(authHtml);
      const prevDoc = global.document;
      const prevLoc = global.location;
      global.document = document;
      global.location = { href: "https://www.e-aushadhi.gov.in/" };
      try {
        return fn(arg);
      } finally {
        global.document = prevDoc;
        global.location = prevLoc;
      }
    },
  });
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  const connected = await worker.connect();
  assert(connected.state === STATES.READY, "DISALLOWED_ORIGIN fixture connects as READY");
  originThrows = true;
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  assert(thrown.kind === ERROR_KINDS.DISALLOWED_ORIGIN, "DISALLOWED_ORIGIN is preserved");
  assert(worker.getStatus().state === STATES.FAILED, "DISALLOWED_ORIGIN still fail-closes to FAILED");
  assert(context.isClosed() === true, "DISALLOWED_ORIGIN still closes the dedicated context");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-origin-"));
  const allowed = createMockPage(authHtml);
  const foreign = createMockPage("<html></html>", { startUrl: "https://example.com/escape" });
  foreign.evaluate = async () => {
    throw new Error("foreign page was inspected");
  };
  const context = createMockContext([allowed]);
  const worker = makeWorker(tmp, context);
  await worker.connect();
  context.addPage(foreign);
  const selected = selectAllowedOriginPage(context, loadPortalContract());
  assert(selected === allowed, "page selection prefers an allowed-origin page");
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.READY, "allowed page is used when a foreign page is also open");
  assert(foreign.counts.evaluate === 0, "disallowed pages are not inspected");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-recheck-nopage-"));
  const page = createMockPage(loginHtml);
  const context = createMockContext([page]);
  const worker = makeWorker(tmp, context);
  await worker.connect();
  page.setHtml(loginHtml, "about:blank");
  let thrown = null;
  try {
    await worker.recheckAuthentication();
  } catch (error) {
    thrown = error;
  }
  assert(thrown.kind === ERROR_KINDS.CRASH, "no suitable page is a governed failure");
  assert(context.isClosed() === false, "no suitable page keeps the browser open");
  assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "no suitable page does not invent READY");
}

assert(CONNECT_PHASES.AUTH_PROBE === "connect:auth-probe", "connect auth-probe phase remains");

if (failed) {
  console.error(`\n${failed} auth-refresh assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-auth-refresh-smoke: all assertions passed");
console.log("Note: Microsoft Edge was not launched and the portal was not contacted.");
