import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { mkdtempSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const { shouldEnforceMainFrameUrl } = require(join(root, "electron/eaushadhi-worker/origin-guard.js"));

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

function createMockEdgeContext(startUrl = "about:blank") {
  let currentUrl = startUrl;
  let closed = false;
  const mainFrame = {
    url() {
      return currentUrl;
    },
  };
  let navHandler = null;
  const page = {
    mainFrame() {
      return mainFrame;
    },
    url() {
      return currentUrl;
    },
    on(name, fn) {
      if (name === "framenavigated") navHandler = fn;
    },
    async goto(next) {
      currentUrl = next;
      if (navHandler) navHandler(mainFrame);
      return null;
    },
    async navigateMainFrame(next) {
      currentUrl = next;
      if (navHandler) navHandler(mainFrame);
    },
    emitChildFrame(url) {
      const child = { url: () => url };
      if (navHandler) navHandler(child);
    },
  };
  return {
    context: {
      pages: () => [page],
      newPage: async () => page,
      close: async () => {
        closed = true;
      },
    },
    page,
    isClosed: () => closed,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tmp = mkdtempSync(join(os.tmpdir(), "ea-worker-"));
const mock = createMockEdgeContext();
const worker = createEaushadhiWorker({
  getUserDataPath: () => tmp,
  launchBrowser: async () => mock.context,
});

await worker.connect();
assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "connect stays AUTH_REQUIRED");
assert(mock.isClosed() === false, "allowed connect keeps context open");

await mock.page.navigateMainFrame("https://www.e-aushadhi.gov.in/next");
await wait(20);
assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "same-origin navigation remains active");
assert(mock.isClosed() === false, "same-origin navigation does not close the browser");

mock.page.emitChildFrame("https://example.com/iframe");
await wait(20);
assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "child-frame foreign URL does not fail closed");
assert(mock.isClosed() === false, "child-frame foreign URL does not close the browser");

await mock.page.navigateMainFrame("https://example.com/escape");
await wait(40);
assert(worker.getStatus().state === STATES.FAILED, "disallowed main-frame fails closed");
assert(worker.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "error kind is DISALLOWED_ORIGIN");
assert(mock.isClosed() === true, "disallowed main-frame stops the browser context");

if (failed) {
  console.error(`\n${failed} origin enforcement assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-origin-enforcement-smoke: all assertions passed");
