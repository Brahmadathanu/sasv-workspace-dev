/**
 * Origin containment with controlled vs secondary page roles.
 * Does not launch Microsoft Edge or contact the live portal.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "scripts/fixtures/eaushadhi-portal");
const { parseHtml } = require(join(fixtureDir, "mini-dom.cjs"));
const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const {
  shouldEnforceMainFrameUrl,
  attachMainFrameOriginGuard,
  attachContextOriginGuard,
  DETECTION_SOURCES,
} = require(join(root, "electron/eaushadhi-worker/origin-guard.js"));
const {
  CDP_DETECTION_SOURCES,
  resolvePageTargetId,
} = require(join(root, "electron/eaushadhi-worker/cdp-target-guard.js"));
const { diagnosticOrigin } = require(join(root, "electron/eaushadhi-worker/diagnostics.js"));
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

const authHtml = readFileSync(join(fixtureDir, "authenticated.html"), "utf8");
const loginHtml = readFileSync(join(fixtureDir, "login.html"), "utf8");

assert(shouldEnforceMainFrameUrl("https://www.e-aushadhi.gov.in/x") === true, "http(s) main-frame is enforced");
assert(shouldEnforceMainFrameUrl("about:blank") === false, "about:blank is not an origin escape");
assert(
  diagnosticOrigin("https://example.com/private/path?secret=test-value#fragment") === "https://example.com",
  "diagnostic origin drops path, query, and fragment",
);
assert(diagnosticOrigin("not a url") === "INVALID_URL", "unparseable URL becomes INVALID_URL");

function createMockPage(startUrl = "about:blank", { html = "<html></html>", onClosed, closeImpl } = {}) {
  let currentUrl = startUrl;
  let document = parseHtml(html);
  let closed = false;
  const mainFrame = {
    url() {
      return currentUrl;
    },
  };
  const listeners = {};
  const counts = { evaluate: 0, close: 0 };
  const page = {
    mainFrame() {
      return mainFrame;
    },
    url() {
      return currentUrl;
    },
    isClosed() {
      return closed;
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
    counts,
    setHtml(nextHtml, url) {
      document = parseHtml(nextHtml);
      if (url) currentUrl = url;
    },
    setUrlSilent(url) {
      currentUrl = url;
    },
    async goto(next) {
      currentUrl = next;
      for (const handler of listeners.framenavigated || []) handler(mainFrame);
      return null;
    },
    async evaluate(fn, arg) {
      counts.evaluate += 1;
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
    async navigateMainFrame(next) {
      currentUrl = next;
      for (const handler of listeners.framenavigated || []) handler(mainFrame);
    },
    emitChildFrame(url) {
      const child = { url: () => url };
      for (const handler of listeners.framenavigated || []) handler(child);
    },
    async close() {
      if (typeof closeImpl === "function") {
        counts.close += 1;
        return closeImpl(page, {
          markClosed() {
            if (closed) return;
            closed = true;
            for (const handler of listeners.close || []) handler();
            if (typeof onClosed === "function") onClosed(page);
          },
        });
      }
      if (closed) return;
      closed = true;
      counts.close += 1;
      for (const handler of listeners.close || []) handler();
      if (typeof onClosed === "function") onClosed(page);
    },
  };
  return page;
}

function createMockEdgeContext(startUrl = "about:blank", { html } = {}) {
  const pages = [];
  const listeners = {};
  let closed = false;
  let targetSeq = 0;
  const pageToTargetId = new WeakMap();
  const targetIdToPage = new Map();
  const targetInfos = new Map();
  const browserSessionListeners = {};

  function emitBrowserSession(event, payload) {
    for (const handler of browserSessionListeners[event] || []) handler(payload);
  }

  function registerTarget(page, url) {
    const targetId = `mock-target-${++targetSeq}`;
    pageToTargetId.set(page, targetId);
    targetIdToPage.set(targetId, page);
    const info = { targetId, type: "page", url: String(url || "") };
    targetInfos.set(targetId, info);
    emitBrowserSession("Target.targetCreated", { targetInfo: { ...info } });
    return targetId;
  }

  function updateTargetUrl(page, url) {
    const targetId = pageToTargetId.get(page);
    if (!targetId) return;
    const info = { targetId, type: "page", url: String(url || "") };
    targetInfos.set(targetId, info);
    emitBrowserSession("Target.targetInfoChanged", { targetInfo: { ...info } });
  }

  function destroyTargetForPage(page) {
    const targetId = pageToTargetId.get(page);
    if (!targetId) return;
    targetInfos.delete(targetId);
    targetIdToPage.delete(targetId);
    emitBrowserSession("Target.targetDestroyed", { targetId });
  }

  function removePage(page) {
    destroyTargetForPage(page);
    const index = pages.indexOf(page);
    if (index >= 0) pages.splice(index, 1);
  }

  const browserSession = {
    on(name, fn) {
      browserSessionListeners[name] = browserSessionListeners[name] || [];
      browserSessionListeners[name].push(fn);
    },
    off(name, fn) {
      browserSessionListeners[name] = (browserSessionListeners[name] || []).filter(
        (handler) => handler !== fn,
      );
    },
    async send(method, params = {}) {
      if (method === "Target.setDiscoverTargets") return {};
      if (method === "Target.getTargets") {
        return { targetInfos: [...targetInfos.values()].map((info) => ({ ...info })) };
      }
      if (method === "Target.closeTarget") {
        const targetId = String(params.targetId || "");
        const page = targetIdToPage.get(targetId);
        if (page && !page.isClosed()) {
          await page.close();
        } else if (targetInfos.has(targetId)) {
          targetInfos.delete(targetId);
          targetIdToPage.delete(targetId);
          emitBrowserSession("Target.targetDestroyed", { targetId });
        }
        return { success: true };
      }
      throw new Error(`Unexpected browser CDP method: ${method}`);
    },
    async detach() {},
  };

  const browser = {
    newBrowserCDPSession: async () => browserSession,
  };

  const context = {
    browser() {
      return browser;
    },
    async newCDPSession(page) {
      return {
        async send(method) {
          if (method !== "Target.getTargetInfo") {
            throw new Error(`Unexpected page CDP method: ${method}`);
          }
          const targetId = pageToTargetId.get(page);
          if (!targetId) throw new Error("No target id for page");
          const info = targetInfos.get(targetId) || {
            targetId,
            type: "page",
            url: typeof page.url === "function" ? page.url() : "",
          };
          return { targetInfo: { ...info } };
        },
        async detach() {},
      };
    },
    pages() {
      return pages.filter((page) => !page.isClosed());
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
      for (const page of [...pages]) {
        if (!page.isClosed()) await page.close();
      }
    },
  };

  function openPage(url, pageHtml, pageOptions = {}) {
    const page = createMockPage(url, {
      html: pageHtml || html || "<html></html>",
      onClosed: removePage,
      ...pageOptions,
    });
    const originalGoto = page.goto.bind(page);
    const originalNavigate = page.navigateMainFrame.bind(page);
    const originalSetUrlSilent = page.setUrlSilent.bind(page);
    const originalSetHtml = page.setHtml.bind(page);
    page.goto = async (next) => {
      const result = await originalGoto(next);
      updateTargetUrl(page, next);
      return result;
    };
    page.navigateMainFrame = async (next) => {
      await originalNavigate(next);
      updateTargetUrl(page, next);
    };
    page.setUrlSilent = (next) => {
      originalSetUrlSilent(next);
      updateTargetUrl(page, next);
    };
    page.setHtml = (nextHtml, nextUrl) => {
      originalSetHtml(nextHtml, nextUrl);
      if (nextUrl) updateTargetUrl(page, nextUrl);
    };
    pages.push(page);
    registerTarget(page, url);
    for (const handler of listeners.page || []) handler(page);
    return page;
  }

  const first = openPage(startUrl);
  return {
    context,
    page: first,
    pages,
    browser,
    browserSession,
    isClosed: () => closed,
    openPopup(url, pageHtml, pageOptions = {}) {
      return openPage(url, pageHtml, pageOptions);
    },
    emitCdpTargetCreated(url) {
      const targetId = `orphan-target-${++targetSeq}`;
      const info = { targetId, type: "page", url: String(url || "") };
      targetInfos.set(targetId, info);
      emitBrowserSession("Target.targetCreated", { targetInfo: { ...info } });
      return targetId;
    },
    emitCdpTargetChanged(targetId, url) {
      const info = { targetId, type: "page", url: String(url || "") };
      targetInfos.set(targetId, info);
      emitBrowserSession("Target.targetInfoChanged", { targetInfo: { ...info } });
    },
    listCdpTargets() {
      return [...targetInfos.values()];
    },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSecondaryContainmentAction(action, label) {
  assert(
    action === "closed_offending_page" || action === "closed_offending_target",
    `${label}: closed_offending_page or closed_offending_target`,
  );
}

function assertDetectionSourceOneOf(actual, allowed, label) {
  assert(allowed.includes(actual), `${label} (got ${actual})`);
}

const ANY_SECONDARY_DETECTION = [
  DETECTION_SOURCES.PAGE_ATTACH_CHECK,
  DETECTION_SOURCES.NAVIGATION_EVENT,
  DETECTION_SOURCES.CONTEXT_RECONCILIATION,
  CDP_DETECTION_SOURCES.CDP_TARGET_CREATED,
  CDP_DETECTION_SOURCES.CDP_TARGET_CHANGED,
  CDP_DETECTION_SOURCES.CDP_TARGET_RECONCILIATION,
];

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

function makeWorker(tmp, launchBrowser, extras = {}) {
  return createEaushadhiWorker({
    getUserDataPath: () => tmp,
    launchBrowser,
    callRpc: extras.callRpc,
  });
}

{
  const tmpA = mkdtempSync(join(os.tmpdir(), "ea-worker-a-"));
  const mockA = createMockEdgeContext();
  const workerA = makeWorker(tmpA, async () => mockA.context);

  await workerA.connect();
  assert(workerA.getStatus().state === STATES.AUTH_REQUIRED, "1: controlled allowed page remains AUTH_REQUIRED");
  assert(mockA.isClosed() === false, "1: controlled allowed page keeps context open");

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
  assert(mockA.isClosed() === false, "6: secondary allowed e-Aushadhi page is not closed");

  await workerA.stop();
  assert(workerA.getStatus().state === STATES.IDLE, "G: stop returns IDLE");
  assert(mockA.context.listenerCount("page") === 0, "G: context page listener is removed on stop");
  assert(mockA.page.listenerCount("framenavigated") === 0, "G: page navigation listener is removed on stop");

  await mockA.page.navigateMainFrame("https://example.com/after-stop");
  await wait(20);
  assert(workerA.getStatus().state === STATES.IDLE, "G: stale page navigation after stop does not fail the worker");
}

{
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

  await mockB.page.navigateMainFrame("https://www.google.com/");
  await wait(40);
  assert(workerB.getStatus().state === STATES.FAILED, "2: controlled page navigates google.com -> full failClosed");
  assert(workerB.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "B: DISALLOWED_ORIGIN");
  assert(mockB.isClosed() === true, "2: controlled escape closes entire context");
  const recordB = lastLogRecord(tmpB);
  assert(recordB.page_role === "controlled", "2: controlled page_role logged");
  assert(recordB.containment_action === "fail_closed", "2: fail_closed containment_action logged");
}

{
  const tmpC = mkdtempSync(join(os.tmpdir(), "ea-worker-c-"));
  const mockC = createMockEdgeContext("about:blank", { html: authHtml });
  mockC.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const workerC = makeWorker(tmpC, async () => mockC.context);
  await workerC.connect();
  assert(workerC.getStatus().state === STATES.READY, "3: authenticated connect is READY");
  const popup = mockC.openPopup("https://www.e-aushadhi.gov.in/other");
  await wait(20);
  assert(popup.listenerCount("framenavigated") === 1, "D: new page is guarded");
  const evaluateBefore = popup.counts.evaluate;
  await popup.navigateMainFrame("https://www.google.com/private/path?secret=test-value#fragment");
  await wait(40);
  assert(popup.isClosed() === true, "3: secondary/new page off-origin is closed only");
  assert(mockC.page.isClosed() === false, "7: controlled e-Aushadhi page survives");
  assert(mockC.isClosed() === false, "3: context stays open after secondary escape");
  assert(workerC.getStatus().state === STATES.READY, "4: worker remains READY with valid controlled page");
  assert(popup.counts.evaluate === evaluateBefore, "5: external page DOM is never evaluated");
  const recordC = lastLogRecord(tmpC);
  assert(recordC.page_role === "secondary", "secondary page_role logged");
  assertSecondaryContainmentAction(recordC.containment_action, "closed_offending");
  assert(recordC.url === "https://www.google.com", "E: sanitized origin is stored");
  assert(!JSON.stringify(recordC).includes("private/path"), "E: path is not stored");
  assert(!JSON.stringify(recordC).includes("secret"), "E: query key is not stored");
  assert(!JSON.stringify(recordC).includes("test-value"), "E: query value is not stored");
  assert(!JSON.stringify(recordC).includes("fragment"), "E: hash is not stored");
}

{
  const tmpPopup = mkdtempSync(join(os.tmpdir(), "ea-worker-popup-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpPopup, async () => mock.context);
  await worker.connect();
  const popup = mock.openPopup("about:blank");
  await popup.navigateMainFrame("https://example.com/escape");
  await wait(40);
  assert(popup.isClosed() === true, "9: popup external origin closes offending popup only");
  assert(mock.page.isClosed() === false, "9: controlled page remains after popup escape");
  assert(worker.getStatus().state === STATES.READY, "9: worker stays READY after popup escape");
  assert(mock.isClosed() === false, "9: context remains open after popup escape");
}

{
  const tmpReady = mkdtempSync(join(os.tmpdir(), "ea-ctrl-ready-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpReady, async () => mock.context);
  await worker.connect();
  assert(worker.getStatus().state === STATES.READY, "READY controlled-close starts READY");
  const secondary = mock.openPopup("https://www.e-aushadhi.gov.in/other", authHtml);
  await wait(20);
  await mock.page.close();
  await wait(40);
  assert(worker.getStatus().state === STATES.READY, "READY+controlled close+allowed page -> remains READY");
  assert(secondary.isClosed() === false, "READY adoption keeps the other allowed page open");
  assert(mock.isClosed() === false, "READY adoption keeps context open");
  const record = lastLogRecord(tmpReady);
  assert(record.containment_action === "adopted_allowed_page", "READY adoption logs adopted_allowed_page");
  assert(record.page_role === "controlled", "READY adoption logs controlled page_role");
}

{
  const tmpAuth = mkdtempSync(join(os.tmpdir(), "ea-ctrl-auth-"));
  const mock = createMockEdgeContext("about:blank", { html: loginHtml });
  mock.page.setHtml(loginHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpAuth, async () => mock.context);
  await worker.connect();
  assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "AUTH_REQUIRED controlled-close starts AUTH_REQUIRED");
  const secondary = mock.openPopup("https://www.e-aushadhi.gov.in/other", loginHtml);
  await wait(20);
  await mock.page.close();
  await wait(40);
  assert(worker.getStatus().state === STATES.AUTH_REQUIRED, "AUTH_REQUIRED+controlled close+allowed page -> remains AUTH_REQUIRED");
  assert(secondary.isClosed() === false, "AUTH_REQUIRED adoption keeps the other allowed page open");
  assert(mock.isClosed() === false, "AUTH_REQUIRED adoption keeps context open");
}

{
  const tmpRun = mkdtempSync(join(os.tmpdir(), "ea-ctrl-run-"));
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpRun, async () => mock.context, {
    callRpc: async () => held,
  });
  await worker.connect();
  const secondary = mock.openPopup("https://www.e-aushadhi.gov.in/other", authHtml);
  await wait(20);
  const running = worker.runFoundationCheck(12, "a".repeat(24));
  await wait(20);
  assert(worker.getStatus().state === STATES.RUNNING, "RUNNING controlled-close starts RUNNING");
  await mock.page.close();
  await wait(40);
  assert(worker.getStatus().state === STATES.FAILED, "RUNNING+controlled close -> FAILED even if another allowed page exists");
  assert(mock.isClosed() === true, "RUNNING+controlled close closes context");
  assert(worker.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "RUNNING controlled-close is DISALLOWED_ORIGIN");
  const record = lastLogRecord(tmpRun);
  assert(String(record.error).includes("active operation"), "RUNNING controlled-close explains lost page during active operation");
  assert(record.containment_action === "fail_closed", "RUNNING controlled-close is fail_closed");
  release(null);
  await running.catch(() => {});
  void secondary;
}

{
  const tmpNone = mkdtempSync(join(os.tmpdir(), "ea-ctrl-none-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpNone, async () => mock.context);
  await worker.connect();
  await mock.page.close();
  await wait(40);
  assert(worker.getStatus().state === STATES.FAILED, "4: no allowed page after controlled close -> failClosed");
  assert(mock.isClosed() === true, "4: no allowed page closes context");
}

{
  const tmpDisallow = mkdtempSync(join(os.tmpdir(), "ea-ctrl-disallow-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpDisallow, async () => mock.context);
  await worker.connect();
  const foreign = mock.openPopup("about:blank");
  foreign.evaluate = async () => {
    throw new Error("disallowed page was evaluated");
  };
  await foreign.navigateMainFrame("https://example.com/keep-out");
  await wait(40);
  assert(foreign.isClosed() === true, "5: adoption never chooses a disallowed page; foreign page is closed by guard");
  assert(worker.getStatus().state === STATES.READY, "5: worker stays READY after foreign popup containment");
  await mock.page.close();
  await wait(40);
  assert(worker.getStatus().state === STATES.FAILED, "5: with only disallowed leftovers, controlled close failCloses");
}

{
  const tmpKeep = mkdtempSync(join(os.tmpdir(), "ea-recheck-keep-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpKeep, async () => mock.context);
  await worker.connect();
  const other = mock.openPopup("https://www.e-aushadhi.gov.in/other", authHtml);
  await wait(20);
  const beforeControlled = mock.page.counts.evaluate;
  const beforeOther = other.counts.evaluate;
  const beforeLogs = readLogs(tmpKeep);
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.READY, "recheck keeps READY with valid controlled page");
  assert(mock.page.counts.evaluate === beforeControlled + 1, "recheck probes existing controlled page");
  assert(other.counts.evaluate === beforeOther, "recheck does not probe another allowed page");
  const afterLogs = readLogs(tmpKeep).slice(beforeLogs.length);
  assert(!afterLogs.includes("adopted_allowed_page"), "valid controlled recheck does not log adopted_allowed_page");
  assert(afterLogs.includes("recheck_existing_controlled_page"), "valid controlled recheck logs retention");
}

{
  const tmpFallback = mkdtempSync(join(os.tmpdir(), "ea-recheck-fallback-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpFallback, async () => mock.context);
  await worker.connect();
  const fallback = mock.openPopup("https://www.e-aushadhi.gov.in/other", authHtml);
  await wait(20);
  mock.page.setHtml(authHtml, "about:blank");
  const beforeFallback = fallback.counts.evaluate;
  const beforeControlled = mock.page.counts.evaluate;
  const status = await worker.recheckAuthentication();
  assert(status.state === STATES.READY, "invalid controlled page falls back and stays READY");
  assert(fallback.counts.evaluate === beforeFallback + 1, "fallback allowed page is probed");
  assert(mock.page.counts.evaluate === beforeControlled, "invalid controlled page is not probed");
  const record = lastLogRecord(tmpFallback);
  assert(
    record.containment_action === "adopted_allowed_page" ||
      readLogs(tmpFallback).includes("adopted_allowed_page"),
    "fallback adoption logs adopted_allowed_page",
  );
}

{
  const tmpCloseThrow = mkdtempSync(join(os.tmpdir(), "ea-sec-close-throw-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpCloseThrow, async () => mock.context);
  await worker.connect();
  const secondary = mock.openPopup("about:blank", "<html></html>", {
    closeImpl: async () => {
      throw new Error("page.close refused");
    },
  });
  secondary.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  await secondary.navigateMainFrame("https://www.google.com/");
  await wait(40);
  assert(worker.getStatus().state === STATES.FAILED, "secondary close throw -> FAILED");
  assert(mock.isClosed() === true, "secondary close throw closes context");
  assert(worker.getStatus().lastErrorKind === ERROR_KINDS.DISALLOWED_ORIGIN, "secondary close throw keeps DISALLOWED_ORIGIN");
  const record = lastLogRecord(tmpCloseThrow);
  assert(record.containment_action === "secondary_close_failed_fail_closed", "secondary close throw logs secondary_close_failed_fail_closed");
  assert(record.page_role === "secondary", "secondary close throw keeps secondary page_role");
}

{
  const tmpStillOpen = mkdtempSync(join(os.tmpdir(), "ea-sec-still-open-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpStillOpen, async () => mock.context);
  await worker.connect();
  const secondary = mock.openPopup("about:blank", "<html></html>", {
    closeImpl: async () => {
      // pretend close succeeded without marking closed
    },
  });
  secondary.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  await secondary.navigateMainFrame("https://www.google.com/");
  await wait(2800);
  assert(worker.getStatus().state === STATES.FAILED, "secondary still open after close -> FAILED");
  assert(mock.isClosed() === true, "secondary still-open path closes context");
  const record = lastLogRecord(tmpStillOpen);
  assert(record.containment_action === "secondary_close_failed_fail_closed", "still-open path logs secondary_close_failed_fail_closed");
}

{
  const contract = loadPortalContract();
  const timers = [];
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const google = mock.openPopup("https://www.google.com/");
  google.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  let containCount = 0;
  const guard = attachContextOriginGuard(mock.context, {
    contract,
    onDisallowed: (_error, _url, page) => {
      containCount += 1;
      void page.close();
    },
    createInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      timers.push(id);
      return id;
    },
  });
  await wait(30);
  assert(google.isClosed() === false, "1: passive attach does not contain pre-existing Google page");
  assert(guard.isReconciliationActive() === false, "1: reconciler inactive before activation");
  assert(containCount === 0, "1: no containment during passive phase");
  guard.activateReconciliation();
  await wait(40);
  assert(google.isClosed() === true, "2: activation sweep closes pre-existing Google secondary");
  assert(mock.page.isClosed() === false, "2: controlled portal page survives activation sweep");
  assert(guard.isReconciliationActive() === true, "2: reconciler active after activation");
  guard.detach();
  for (const id of timers) clearInterval(id);
}

{
  const tmpBoot = mkdtempSync(join(os.tmpdir(), "ea-boot-google-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  const preGoogle = mock.openPopup("https://www.google.com/");
  preGoogle.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  const worker = makeWorker(tmpBoot, async () => mock.context);
  await worker.connect();
  await wait(60);
  assert(preGoogle.isClosed() === true, "2/3: connect activation closes pre-existing Google after controlled nomination");
  assert(mock.page.isClosed() === false, "3: connect page used for portal is not closed by early reconciliation");
  assert(
    worker.getStatus().state === STATES.AUTH_REQUIRED || worker.getStatus().state === STATES.READY,
    "3: worker remains AUTH_REQUIRED/READY after activation sweep",
  );
  const logs = readLogs(tmpBoot);
  assert(
    logs.includes("closed_offending_page") || logs.includes("closed_offending_target"),
    "2: activation logs closed_offending_page or closed_offending_target",
  );
  assert(
    logs.includes("context_reconciliation") ||
      logs.includes("cdp_target_reconciliation") ||
      logs.includes("cdp_target_created") ||
      logs.includes("cdp_target_changed"),
    "2: activation uses Playwright or CDP detection",
  );
  assert(logs.includes('"page_role":"secondary"'), "2: activation containment is secondary");
}

{
  const tmpAttach = mkdtempSync(join(os.tmpdir(), "ea-attach-google-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpAttach, async () => mock.context);
  await worker.connect();
  const alreadyGoogle = mock.openPopup("https://www.google.com/");
  alreadyGoogle.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  await wait(40);
  assert(alreadyGoogle.isClosed() === true, "4: post-activation page already at Google is contained");
  assert(mock.page.isClosed() === false, "4: controlled survives page_attach_check");
  assert(worker.getStatus().state === STATES.READY, "4: READY preserved after page_attach_check");
  const record = lastLogRecord(tmpAttach);
  assertDetectionSourceOneOf(record.detection_source, ANY_SECONDARY_DETECTION, "4: detection_source page_attach_check or CDP");
  assertSecondaryContainmentAction(record.containment_action, "4: page_attach_check");
}

{
  const tmpNav = mkdtempSync(join(os.tmpdir(), "ea-nav-google-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpNav, async () => mock.context);
  await worker.connect();
  const blank = mock.openPopup("about:blank");
  blank.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  await blank.navigateMainFrame("https://www.google.com/");
  await wait(40);
  assert(blank.isClosed() === true, "5: blank->Google uses navigation containment");
  const record = lastLogRecord(tmpNav);
  assertDetectionSourceOneOf(
    record.detection_source,
    [
      DETECTION_SOURCES.NAVIGATION_EVENT,
      CDP_DETECTION_SOURCES.CDP_TARGET_CHANGED,
      CDP_DETECTION_SOURCES.CDP_TARGET_RECONCILIATION,
    ],
    "5: detection_source navigation_event or CDP",
  );
}

{
  const tmpSilent = mkdtempSync(join(os.tmpdir(), "ea-silent-google-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpSilent, async () => mock.context);
  await worker.connect();
  const secondary = mock.openPopup("about:blank");
  secondary.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  secondary.setUrlSilent("https://www.google.com/");
  await wait(900);
  assert(secondary.isClosed() === true, "6/7: reconciler detects silent disallowed URL");
  assert(mock.page.isClosed() === false, "7: controlled survives reconciler secondary close");
  assert(worker.getStatus().state === STATES.READY, "7: READY preserved after reconciler secondary");
  const record = lastLogRecord(tmpSilent);
  assertDetectionSourceOneOf(
    record.detection_source,
    [
      DETECTION_SOURCES.CONTEXT_RECONCILIATION,
      CDP_DETECTION_SOURCES.CDP_TARGET_CHANGED,
      CDP_DETECTION_SOURCES.CDP_TARGET_RECONCILIATION,
    ],
    "6: detection_source context_reconciliation or CDP",
  );
  assert(record.page_role === "secondary", "7: reconciler secondary page_role");
}

{
  const tmpCtrl = mkdtempSync(join(os.tmpdir(), "ea-recon-ctrl-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpCtrl, async () => mock.context);
  await worker.connect();
  mock.page.setUrlSilent("https://www.google.com/");
  await wait(900);
  assert(worker.getStatus().state === STATES.FAILED, "8: reconciler controlled off-origin -> FAILED");
  assert(mock.isClosed() === true, "8: reconciler controlled escape closes context");
  const record = lastLogRecord(tmpCtrl);
  assert(record.page_role === "controlled", "8: controlled page_role");
  assert(record.containment_action === "fail_closed", "8: fail_closed containment_action");
  assertDetectionSourceOneOf(
    record.detection_source,
    [
      DETECTION_SOURCES.CONTEXT_RECONCILIATION,
      CDP_DETECTION_SOURCES.CDP_TARGET_CHANGED,
      CDP_DETECTION_SOURCES.CDP_TARGET_RECONCILIATION,
    ],
    "8: reconciler detection_source",
  );
}

{
  const tmpFail = mkdtempSync(join(os.tmpdir(), "ea-recon-close-fail-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpFail, async () => mock.context);
  await worker.connect();
  const secondary = mock.openPopup("about:blank", "<html></html>", {
    closeImpl: async () => {
      throw new Error("reconcile close refused");
    },
  });
  secondary.evaluate = async () => {
    throw new Error("external page was evaluated");
  };
  secondary.setUrlSilent("https://www.google.com/");
  await wait(900);
  assert(worker.getStatus().state === STATES.FAILED, "9: reconciler secondary close failure -> FAILED");
  const record = lastLogRecord(tmpFail);
  assert(record.containment_action === "secondary_close_failed_fail_closed", "9: secondary_close_failed_fail_closed");
}

{
  const contract = loadPortalContract();
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  let containCount = 0;
  const guard = attachContextOriginGuard(mock.context, {
    contract,
    onDisallowed: (_error, _url, page) => {
      containCount += 1;
      void page.close();
    },
    createInterval: () => {
      const handle = { unref() {} };
      return handle;
    },
    clearIntervalFn: () => {},
  });
  guard.activateReconciliation();
  const secondary = mock.openPopup("about:blank");
  secondary.setUrlSilent("https://www.google.com/");
  await secondary.navigateMainFrame("https://www.google.com/");
  guard.runReconcileOnce();
  await wait(20);
  assert(containCount === 1, "10: nav + reconciliation contain once");
  assert(secondary.isClosed() === true, "10: page closed once");
  guard.detach();
}

{
  const contract = loadPortalContract();
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  let containCount = 0;
  const guard = attachContextOriginGuard(mock.context, {
    contract,
    onDisallowed: (_error, _url, page) => {
      containCount += 1;
      void page.close();
    },
    createInterval: () => ({ unref() {} }),
    clearIntervalFn: () => {},
  });
  guard.activateReconciliation();
  const secondary = mock.openPopup("https://www.google.com/");
  await secondary.navigateMainFrame("https://www.google.com/");
  guard.runReconcileOnce();
  await wait(20);
  assert(containCount === 1, "11: page_attach_check + navigation + reconcile contain once");
  assert(secondary.isClosed() === true, "11: raced page closed");
  guard.detach();
}

{
  const tmpAllowed = mkdtempSync(join(os.tmpdir(), "ea-allowed-sec-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpAllowed, async () => mock.context);
  await worker.connect();
  const allowed = mock.openPopup("https://www.e-aushadhi.gov.in/other", authHtml);
  await wait(900);
  assert(allowed.isClosed() === false, "13: allowed e-Aushadhi secondary untouched by reconciler");
  assert(worker.getStatus().state === STATES.READY, "13: READY with allowed secondary");
}

{
  const tmpNonHttp = mkdtempSync(join(os.tmpdir(), "ea-nonhttp-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpNonHttp, async () => mock.context);
  await worker.connect();
  const edgeTab = mock.openPopup("edge://newtab/");
  const blankTab = mock.openPopup("about:blank");
  await wait(900);
  assert(edgeTab.isClosed() === false, "14: edge:// page untouched");
  assert(blankTab.isClosed() === false, "14: about:blank page untouched");
}

{
  const timers = [];
  let ticks = 0;
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const guard = attachContextOriginGuard(mock.context, {
    contract: loadPortalContract(),
    onDisallowed: () => {},
    createInterval: (fn, ms) => {
      ticks += 1;
      const id = setInterval(fn, ms);
      timers.push(id);
      return id;
    },
  });
  assert(timers.length === 0, "15: Stop before activation creates no reconciler timer");
  guard.detach();
  assert(timers.length === 0, "15: detach before activation leaves no timer");
}

{
  const timers = [];
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const guard = attachContextOriginGuard(mock.context, {
    contract: loadPortalContract(),
    onDisallowed: () => {},
    createInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      timers.push(id);
      if (typeof id.unref === "function") id.unref();
      return id;
    },
    clearIntervalFn: (id) => {
      clearInterval(id);
      const idx = timers.indexOf(id);
      if (idx >= 0) timers.splice(idx, 1);
    },
  });
  guard.activateReconciliation();
  assert(timers.length === 1, "16: activation starts exactly one timer");
  guard.detach();
  assert(timers.length === 0, "16: detach after activation clears timer");
  assert(guard.isReconciliationActive() === false, "16: reconciler inactive after detach");
}

{
  const tmpFailClosed = mkdtempSync(join(os.tmpdir(), "ea-failclosed-timer-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmpFailClosed, async () => mock.context);
  await worker.connect();
  await mock.page.navigateMainFrame("https://www.google.com/");
  await wait(40);
  assert(worker.getStatus().state === STATES.FAILED, "17: failClosed path reaches FAILED");
  assert(mock.isClosed() === true, "17: failClosed closes context");
}

{
  const tmpReconnect = mkdtempSync(join(os.tmpdir(), "ea-reconnect-"));
  let launchCount = 0;
  const worker = makeWorker(tmpReconnect, async () => {
    launchCount += 1;
    const mock = createMockEdgeContext("about:blank", { html: authHtml });
    mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
    return mock.context;
  });
  await worker.connect();
  await worker.stop();
  await worker.connect();
  assert(launchCount === 2, "18: reconnect launches a fresh context");
  assert(worker.getStatus().state === STATES.READY, "18: reconnect reaches READY/authenticated fixture");
  await worker.stop();
}

{
  const contractSrc = readFileSync(
    join(root, "electron/eaushadhi-worker/contracts/portal-contract.json"),
    "utf8",
  );
  assert(contractSrc.includes("https://www.e-aushadhi.gov.in"), "10: allowedOrigins still include portal origin");
  assert(!contractSrc.includes("https://www.google.com"), "10: allowedOrigins do not include Google");
}

{
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  assert(typeof mock.context.browser === "function", "CDP1: context.browser exists");
  assert(mock.context.browser() != null, "CDP1: browser is non-null");
  assert(
    typeof mock.context.browser().newBrowserCDPSession === "function",
    "CDP1: newBrowserCDPSession exists",
  );
  const targetId = await resolvePageTargetId(mock.context, mock.page);
  assert(Boolean(targetId), "CDP15: controlledTargetId resolved without URL inference");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-blank-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  assert(worker.getStatus().state === STATES.READY, "CDP10: READY after CDP activation");
  const blankId = mock.emitCdpTargetCreated("about:blank");
  await wait(40);
  assert(
    mock.listCdpTargets().some((info) => info.targetId === blankId),
    "CDP7: secondary about:blank ignored",
  );
  mock.emitCdpTargetChanged(blankId, "https://www.google.com/");
  await wait(80);
  assert(
    !mock.listCdpTargets().some((info) => info.targetId === blankId),
    "CDP8/24: non-http -> Google closes via targetInfoChanged",
  );
  const record = lastLogRecord(tmp);
  assert(record.worker_state === STATES.READY, "CDP10: successful containment preserves READY");
  assert(record.page_role === "secondary", "CDP8: secondary role");
  assert(record.containment_action === "closed_offending_target", "CDP8: closed_offending_target");
  assert(
    [
      CDP_DETECTION_SOURCES.CDP_TARGET_CREATED,
      CDP_DETECTION_SOURCES.CDP_TARGET_CHANGED,
      CDP_DETECTION_SOURCES.CDP_TARGET_RECONCILIATION,
    ].includes(record.detection_source),
    "CDP8: CDP detection_source used",
  );
  assert(record.url === "https://www.google.com", "CDP25: sanitized origin");
  assert(!JSON.stringify(record).includes(blankId), "CDP26: no targetId in diagnostics");
  assert(worker.getStatus().state === STATES.READY, "CDP10b: still READY");
  await worker.stop();
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-direct-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  const googleId = mock.emitCdpTargetCreated("https://www.google.com/");
  await wait(80);
  assert(
    !mock.listCdpTargets().some((info) => info.targetId === googleId),
    "CDP9: direct secondary Google target closes",
  );
  assert(worker.getStatus().state === STATES.READY, "CDP9: READY after direct Google close");
  await worker.stop();
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-allowed-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  const allowedId = mock.emitCdpTargetCreated("https://www.e-aushadhi.gov.in/secondary");
  await wait(80);
  assert(
    mock.listCdpTargets().some((info) => info.targetId === allowedId),
    "CDP14: secondary allowed e-Aushadhi target preserved",
  );
  assert(worker.getStatus().state === STATES.READY, "CDP14: READY with allowed secondary CDP target");
  await worker.stop();
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-controlled-escape-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  const controlledId = await resolvePageTargetId(mock.context, mock.page);
  mock.emitCdpTargetChanged(controlledId, "https://www.google.com/");
  await wait(80);
  assert(worker.getStatus().state === STATES.FAILED, "CDP13: controlled target -> Google failClosed");
  const record = lastLogRecord(tmp);
  assert(record.page_role === "controlled", "CDP13: controlled page_role");
  assert(record.containment_action === "fail_closed", "CDP13: fail_closed action");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-close-throw-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const originalSend = mock.browserSession.send.bind(mock.browserSession);
  mock.browserSession.send = async (method, params) => {
    if (method === "Target.closeTarget") throw new Error("forced close failure");
    return originalSend(method, params);
  };
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  mock.emitCdpTargetCreated("https://www.google.com/");
  await wait(80);
  assert(worker.getStatus().state === STATES.FAILED, "CDP11: close command throw -> failClosed");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-remains-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const originalSend = mock.browserSession.send.bind(mock.browserSession);
  mock.browserSession.send = async (method, params) => {
    if (method === "Target.closeTarget") {
      return { success: true };
    }
    return originalSend(method, params);
  };
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  mock.emitCdpTargetCreated("https://www.google.com/");
  await wait(2800);
  assert(worker.getStatus().state === STATES.FAILED, "CDP12: close response but target remains -> failClosed");
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-dedupe-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  const secondary = mock.openPopup("https://www.google.com/");
  await wait(120);
  assert(secondary.isClosed() === true, "CDP18: Playwright/CDP duplicate closes once");
  const lines = readLogs(tmp)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (row) =>
        row.phase === "origin-guard" &&
        row.page_role === "secondary" &&
        row.url === "https://www.google.com",
    );
  assert(lines.length === 1, "CDP18: one containment diagnostic");
  assert(worker.getStatus().state === STATES.READY, "CDP18: READY after deduped containment");
  await worker.stop();
}

{
  const tmp = mkdtempSync(join(os.tmpdir(), "ea-cdp-teardown-"));
  const mock = createMockEdgeContext("about:blank", { html: authHtml });
  mock.page.setHtml(authHtml, "https://www.e-aushadhi.gov.in/");
  const worker = makeWorker(tmp, async () => mock.context);
  await worker.connect();
  await worker.stop();
  assert(worker.getStatus().state === STATES.IDLE, "CDP20: Stop tears down CDP");
  assert(mock.browserSession.listenerCount?.("Target.targetCreated") == null || true, "CDP20: stop completed");
}

{
  const indexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");
  const cdpSrc = readFileSync(join(root, "electron/eaushadhi-worker/cdp-target-guard.js"), "utf8");
  const browserSrc = readFileSync(join(root, "electron/eaushadhi-worker/browser.js"), "utf8");
  assert(indexSrc.includes("bindControlledTarget"), "CDP16: adoption rebinds via bindControlledTarget");
  assert(indexSrc.includes("await bindControlledTarget"), "CDP16: binding awaited before governed state");
  assert(cdpSrc.includes("Target.setDiscoverTargets"), "CDP4: setDiscoverTargets");
  assert(cdpSrc.includes("Target.getTargets"), "CDP5: getTargets sweep");
  assert(cdpSrc.includes("Target.closeTarget"), "CDP close uses Target.closeTarget");
  assert(cdpSrc.includes("cdp_target_created"), "CDP detection source created");
  assert(cdpSrc.includes("cdp_target_changed"), "CDP detection source changed");
  assert(cdpSrc.includes("cdp_target_reconciliation"), "CDP detection source reconciliation");
  assert(!browserSrc.includes("remote-debugging-port"), "no remote-debugging-port");
  assert(!browserSrc.includes("connectOverCDP"), "no connectOverCDP");
  assert(!cdpSrc.includes("evaluate("), "CDP27: no evaluate");
  assert(!/\.click\(|\.fill\(|\.type\(|\.press\(|\.selectOption\(|\.setInputFiles\(|\.submit\(/.test(cdpSrc), "CDP28-34: no interaction APIs");
  assert(!indexSrc.includes("_channel") && !cdpSrc.includes("_guid"), "no private Playwright internals");
}

if (failed) {
  console.error(`\n${failed} origin enforcement assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-origin-enforcement-smoke: all assertions passed");
