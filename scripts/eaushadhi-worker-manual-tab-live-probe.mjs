/**
 * Live read-only secondary Google containment with injected Edge context.
 * No portal writes. No Capture.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { launchDedicatedEdge } = require(join(root, "electron/eaushadhi-worker/browser.js"));
const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
const { STATES } = require(join(root, "electron/eaushadhi-worker/state.js"));

const liveProfile = mkdtempSync(join(os.tmpdir(), "ea-manual-tab-live-"));
const liveUd = mkdtempSync(join(os.tmpdir(), "ea-manual-tab-live-ud-"));
const liveResult = {
  connectState: null,
  secondaryClosed: null,
  controlledOpen: null,
  stateAfter: null,
  pagesAfter: [],
  logHit: null,
  error: null,
};

let liveCtx;
let liveWorker;
try {
  liveCtx = await launchDedicatedEdge(liveProfile);
  liveWorker = createEaushadhiWorker({
    getUserDataPath: () => liveUd,
    launchBrowser: async () => liveCtx,
  });
  const connected = await liveWorker.connect();
  liveResult.connectState = connected.state;
  console.log("LIVE_CONNECT", connected.state, connected.lastErrorMessage || "");

  const controlled = liveCtx.pages()[0];
  const secondary = await liveCtx.newPage();
  let navError = null;
  try {
    await secondary.goto("https://www.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  } catch (error) {
    navError = String(error?.message || error);
  }
  await new Promise((r) => setTimeout(r, 1500));
  liveResult.secondaryClosed = secondary.isClosed();
  liveResult.controlledOpen = !!(controlled && !controlled.isClosed());
  liveResult.stateAfter = liveWorker.getStatus().state;
  liveResult.pagesAfter = liveCtx.pages().map((p) => {
    try {
      return p.isClosed() ? "closed" : p.url();
    } catch {
      return "unknown";
    }
  });
  console.log("AFTER_SECONDARY", {
    secondaryClosed: liveResult.secondaryClosed,
    controlledOpen: liveResult.controlledOpen,
    state: liveResult.stateAfter,
    navError,
    pages: liveResult.pagesAfter,
  });

  const logDir = join(liveUd, "eaushadhi-worker-logs");
  if (existsSync(logDir)) {
    const text = readdirSync(logDir)
      .map((name) => readFileSync(join(logDir, name), "utf8"))
      .join("\n");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((row) => row.phase === "origin-guard" && row.page_role === "secondary");
    liveResult.logHit = lines[lines.length - 1] || null;
    console.log("JSONL_SECONDARY", liveResult.logHit);
  }

  const ok =
    liveResult.secondaryClosed === true &&
    liveResult.controlledOpen === true &&
    (liveResult.stateAfter === STATES.AUTH_REQUIRED || liveResult.stateAfter === STATES.READY) &&
    liveResult.logHit &&
    (liveResult.logHit.containment_action === "closed_offending_page" ||
      liveResult.logHit.containment_action === "closed_offending_target") &&
    [
      "page_attach_check",
      "navigation_event",
      "context_reconciliation",
      "cdp_target_created",
      "cdp_target_changed",
      "cdp_target_reconciliation",
    ].includes(liveResult.logHit.detection_source) &&
    /google\.com/i.test(String(liveResult.logHit.url || ""));
  if (!ok) {
    liveResult.error =
      liveResult.secondaryClosed === false
        ? `Google tab remained visible. pages=${JSON.stringify(liveResult.pagesAfter)}`
        : "Secondary Google containment live gate failed.";
    process.exitCode = 1;
  }
} catch (error) {
  liveResult.error = String(error?.message || error);
  console.error("LIVE_ERROR", liveResult.error);
  process.exitCode = 1;
} finally {
  if (liveWorker) {
    try {
      await liveWorker.stop();
    } catch {
      // ignore
    }
  } else if (liveCtx) {
    try {
      await liveCtx.close();
    } catch {
      // ignore
    }
  }
}

console.log("LIVE_RESULT", JSON.stringify(liveResult, null, 2));
