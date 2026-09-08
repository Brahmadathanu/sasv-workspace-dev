/**
 * Live Edge probe: CDP-only orphan targets (not via context.newPage).
 * Proves browser-UI-class tabs are contained through public CDP Target APIs.
 * No portal writes. No Capture. No credential automation.
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

function readSecondaryLogs(userData) {
  const logDir = join(userData, "eaushadhi-worker-logs");
  if (!existsSync(logDir)) return [];
  return readdirSync(logDir)
    .map((name) => readFileSync(join(logDir, name), "utf8"))
    .join("\n")
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
}

async function createOrphanTarget(browser, url) {
  const session = await browser.newBrowserCDPSession();
  try {
    const created = await session.send("Target.createTarget", { url });
    return { session, targetId: String(created?.targetId || "") };
  } catch (error) {
    try {
      await session.detach();
    } catch {
      // ignore
    }
    throw error;
  }
}

async function targetPresent(session, targetId) {
  const result = await session.send("Target.getTargets");
  const list = Array.isArray(result?.targetInfos) ? result.targetInfos : [];
  return list.some((info) => String(info?.targetId || "") === String(targetId));
}

const profile = mkdtempSync(join(os.tmpdir(), "ea-cdp-orphan-edge-"));
const userData = mkdtempSync(join(os.tmpdir(), "ea-cdp-orphan-ud-"));
const result = {
  connectState: null,
  google: null,
  allowed: null,
  error: null,
};

let ctx;
let worker;
try {
  ctx = await launchDedicatedEdge(profile);
  worker = createEaushadhiWorker({
    getUserDataPath: () => userData,
    launchBrowser: async () => ctx,
  });
  const connected = await worker.connect();
  result.connectState = connected.state;
  console.log("CONNECT", connected.state, connected.lastErrorMessage || "");

  if (connected.state !== STATES.AUTH_REQUIRED && connected.state !== STATES.READY) {
    throw new Error(`Unexpected connect state: ${connected.state}`);
  }

  const browser = ctx.browser();
  if (!browser || typeof browser.newBrowserCDPSession !== "function") {
    throw new Error("browser.newBrowserCDPSession unavailable");
  }

  // Test A analogue: orphan Google target via CDP (not Playwright newPage).
  {
    const beforePages = ctx.pages().length;
    const { session, targetId } = await createOrphanTarget(browser, "https://www.google.com/");
    console.log("GOOGLE_TARGET_CREATED", { targetId: Boolean(targetId), beforePages, afterPages: ctx.pages().length });
    await new Promise((r) => setTimeout(r, 3000));
    const stillThere = targetId ? await targetPresent(session, targetId) : true;
    const logs = readSecondaryLogs(userData);
    const hit = [...logs].reverse().find((row) => /google\.com/i.test(String(row.url || "")));
    result.google = {
      targetClosed: stillThere === false,
      stateAfter: worker.getStatus().state,
      playwrightPageDelta: ctx.pages().length - beforePages,
      logHit: hit || null,
    };
    console.log("GOOGLE_RESULT", result.google);
    try {
      await session.detach();
    } catch {
      // ignore
    }
  }

  // Test B analogue: orphan allowed e-Aushadhi target must remain.
  {
    const { session, targetId } = await createOrphanTarget(browser, "https://www.e-aushadhi.gov.in/");
    await new Promise((r) => setTimeout(r, 2000));
    const stillThere = targetId ? await targetPresent(session, targetId) : false;
    result.allowed = {
      targetKept: stillThere === true,
      stateAfter: worker.getStatus().state,
    };
    console.log("ALLOWED_RESULT", result.allowed);
    if (targetId && stillThere) {
      try {
        await session.send("Target.closeTarget", { targetId });
      } catch {
        // ignore cleanup
      }
    }
    try {
      await session.detach();
    } catch {
      // ignore
    }
  }

  const googleOk =
    result.google?.targetClosed === true &&
    (result.google.stateAfter === STATES.AUTH_REQUIRED || result.google.stateAfter === STATES.READY) &&
    result.google.logHit &&
    result.google.logHit.containment_action === "closed_offending_target" &&
    ["cdp_target_created", "cdp_target_changed", "cdp_target_reconciliation"].includes(
      result.google.logHit.detection_source,
    );
  const allowedOk =
    result.allowed?.targetKept === true &&
    (result.allowed.stateAfter === STATES.AUTH_REQUIRED || result.allowed.stateAfter === STATES.READY);

  if (!googleOk || !allowedOk) {
    result.error = !googleOk
      ? "CDP orphan Google containment failed"
      : "Allowed CDP orphan e-Aushadhi target was closed";
    process.exitCode = 1;
  }
} catch (error) {
  result.error = String(error?.message || error);
  console.error("LIVE_ERROR", result.error);
  process.exitCode = 1;
} finally {
  if (worker) {
    try {
      await worker.stop();
    } catch {
      // ignore
    }
  } else if (ctx) {
    try {
      await ctx.close();
    } catch {
      // ignore
    }
  }
}

console.log("CDP_ORPHAN_LIVE_RESULT", JSON.stringify(result, null, 2));
