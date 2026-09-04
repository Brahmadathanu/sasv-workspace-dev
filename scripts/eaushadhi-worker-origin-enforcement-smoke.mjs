import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const {
  shouldEnforceMainFrameUrl,
  attachMainFrameOriginGuard,
} = require(join(root, "electron/eaushadhi-worker/origin-guard.js"));
const { diagnosticOrigin } = require(join(root, "electron/eaushadhi-worker/diagnostics.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

assert(shouldEnforceMainFrameUrl("https://www.e-aushadhi.gov.in/x") === true, "http(s) main-frame is enforced");
assert(shouldEnforceMainFrameUrl("about:blank") === false, "about:blank is not an origin escape");
assert(
  diagnosticOrigin("https://example.com/private/path?secret=test-value#fragment") === "https://example.com",
  "diagnostic origin drops path, query, and fragment",
);
assert(diagnosticOrigin("not a url") === "INVALID_URL", "unparseable URL becomes INVALID_URL");

function createMockPage(startUrl = "about:blank") {
  let currentUrl = startUrl;
  const mainFrame = {
    url() {
      return currentUrl;
    },
  };
  const listeners = {};
  const page = {
    mainFrame() {
      return mainFrame;
    },
    url() {
      return currentUrl;
    },
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off(name, fn) {
      listeners[name] = (listeners[name] || []).filter((handler) => handler !== fn);
    },
    listenerCount(name) {
      return (listeners[name] || []).length;
    },
    async goto(next) {
      currentUrl = next;
      for (const handler of listeners.framenavigated || []) handler(mainFrame);
      return null;
    },
    async navigateMainFrame(next) {
      currentUrl = next;
      for (const handler of listeners.framenavigated || []) handler(mainFrame);
    },
    emitChildFrame(url) {
      const child = { url: () => url };
      for (const handler of listeners.framenavigated || []) handler(child);
    },
  };
  return page;
}

function createMockEdgeContext(startUrl = "about:blank") {
  const pages = [];
  const listeners = {};
  let closed = false;
  const context = {
    pages() {
      return [...pages];
    },
    on(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    off(name, fn) {
      listeners[name] = (listeners[name] || []).filter((handler) => handler !== fn);
    },
    listenerCount(name) {
      return (listeners[name] || []).length;
    },
    async newPage() {
      return openPage("about:blank");
    },
    async close() {
      closed = true;
    },
  };

  function openPage(url) {
    const page = createMockPage(url);
    pages.push(page);
    for (const handler of listeners.page || []) handler(page);
    return page;
  }

  const first = createMockPage(startUrl);
  pages.push(first);
  return {
    context,
    page: first,
    isClosed: () => closed,
    openPopup(url) {
      return openPage(url);
    },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLogs(tmp) {
  const dir = join(tmp, "eaushadhi-worker-logs");
  return readdirSync(dir)
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

function makeWorker(tmp, launchBrowser) {
  return createEaushadhiWorker({
    getUserDataPath: () => tmp,
    launchBrowser,
  });
}

const tmpA = mkdtempSync(join(os.tmpdir(), "ea-worker-a-"));
const mockA = createMockEdgeContext();
const workerA = makeWorker(tmpA, async () => mockA.context);

await workerA.connect();
assert(workerA.getStatus().state === STATES.AUTH_REQUIRED, "A: initial allowed page remains AUTH_REQUIRED");
assert(mockA.isClosed() === false, "A: initial allowed page keeps context open");

await mockA.page.navigateMainFrame("https://www.e-aushadhi.gov.in/next");
await wait(20);
assert(workerA.getStatus().state === STATES.AUTH_REQUIRED, "A: same-origin navigation remains active");

mockA.page.emitChildFrame("https://example.com/iframe");
await wait(20);
assert(workerA.getStatus().state === STATES.AUTH_REQUIRED, "F: child-frame foreign URL does not fail closed");
assert(mockA.isClosed() === false, "F: child-frame foreign URL does not close the browser");

const sameOriginPopup = mockA.openPopup("https://www.e-aushadhi.gov.in/popup");
await wait(20);
assert(sameOriginPopup.listenerCount("framenavigated") === 1, "C: new same-origin page is guarded automatically");
assert(mockA.isClosed() === false, "C: same-origin popup keeps context active");

await workerA.stop();
assert(workerA.getStatus().state === STATES.IDLE, "G: stop returns IDLE");
assert(mockA.context.listenerCount("page") === 0, "G: context page listener is removed on stop");
assert(mockA.page.listenerCount("framenavigated") === 0, "G: page navigation listener is removed on stop");

await mockA.page.navigateMainFrame("https://example.com/after-stop");
await wait(20);
assert(workerA.getStatus().state === STATES.IDLE, "G: stale page navigation after stop does not fail the worker");

const tmpB = mkdtempSync(join(os.tmpdir(), "ea-worker-b-"));
const mockB = createMockEdgeContext();
const workerB = makeWorker(tmpB, async () => mockB.context);
await workerB.connect();
const pageObj = mockB.page;
attachMainFrameOriginGuard(pageObj, {
  contract: { allowedOrigins: ["https://www.e-aushadhi.gov.in"] },
  onDisallowed: () => {},
});
assert(pageObj.listenerCount("framenavigated") === 1, "duplicate page guard is not attached");

await mockB.page.navigateMainFrame("https://example.com/escape");
await wait(40);
assert(workerB.getStatus().state === STATES.FAILED, "B: foreign navigation on initial page fails closed");
assert(workerB.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "B: DISALLOWED_ORIGIN");
assert(mockB.isClosed() === true, "B: entire context closes");

const tmpC = mkdtempSync(join(os.tmpdir(), "ea-worker-c-"));
const mockC = createMockEdgeContext();
const workerC = makeWorker(tmpC, async () => mockC.context);
await workerC.connect();
const popup = mockC.openPopup("https://www.e-aushadhi.gov.in/other");
await wait(20);
assert(popup.listenerCount("framenavigated") === 1, "D: new page is guarded");
await popup.navigateMainFrame("https://example.com/private/path?secret=test-value#fragment");
await wait(40);
assert(workerC.getStatus().state === STATES.FAILED, "D: new-page foreign navigation fails the worker");
assert(workerC.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "D: DISALLOWED_ORIGIN from new page");
assert(mockC.isClosed() === true, "D: entire browser context closes");

const logs = readLogs(tmpC);
assert(logs.includes("https://example.com"), "E: sanitized origin is stored");
assert(!logs.includes("private/path"), "E: path is not stored");
assert(!logs.includes("secret"), "E: query key is not stored");
assert(!logs.includes("test-value"), "E: query value is not stored");
assert(!logs.includes("fragment"), "E: hash is not stored");
assert(!logs.includes("INVALID_URL") || logs.includes("https://example.com"), "E: parsed origin is used");

if (failed) {
  console.error(`\n${failed} origin enforcement assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-origin-enforcement-smoke: all assertions passed");
