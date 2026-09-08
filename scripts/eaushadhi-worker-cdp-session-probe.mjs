/**
 * Step 0: prove direct public browser CDP API on persistent Edge.
 * No remote-debugging-port. No connectOverCDP. No private internals.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { launchDedicatedEdge } = require(join(root, "electron/eaushadhi-worker/browser.js"));

function sanitize(message) {
  return String(message || "")
    .replace(/[A-Za-z]:\\[^\s"']+/g, "<path>")
    .replace(/\/(?:Users|home|tmp|var)[^\s"']+/g, "<path>")
    .slice(0, 400);
}

const report = {
  browserNull: null,
  newBrowserCDPSessionExists: null,
  sessionCreated: false,
  getTargetsOk: false,
  error: null,
};

const profileDir = mkdtempSync(join(os.tmpdir(), "ea-cdp-probe-"));
let context = null;
let session = null;

try {
  context = await launchDedicatedEdge(profileDir);
  const browser = typeof context.browser === "function" ? context.browser() : null;
  report.browserNull = browser == null;
  if (!browser) {
    throw new Error("context.browser() returned null");
  }
  report.newBrowserCDPSessionExists = typeof browser.newBrowserCDPSession === "function";
  if (!report.newBrowserCDPSessionExists) {
    throw new Error("browser.newBrowserCDPSession is not a function");
  }
  session = await browser.newBrowserCDPSession();
  report.sessionCreated = true;
  const targets = await session.send("Target.getTargets");
  if (!targets || !Array.isArray(targets.targetInfos)) {
    throw new Error("Target.getTargets did not return targetInfos array");
  }
  report.getTargetsOk = true;
  console.log(
    JSON.stringify(
      {
        ok: true,
        browserNull: report.browserNull,
        newBrowserCDPSessionExists: report.newBrowserCDPSessionExists,
        sessionCreated: report.sessionCreated,
        getTargetsOk: report.getTargetsOk,
        targetCount: targets.targetInfos.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  report.error = sanitize(error?.message || error);
  console.error(
    JSON.stringify(
      {
        ok: false,
        browserNull: report.browserNull,
        newBrowserCDPSessionExists: report.newBrowserCDPSessionExists,
        sessionCreated: report.sessionCreated,
        getTargetsOk: report.getTargetsOk,
        error: report.error,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  try {
    if (session && typeof session.detach === "function") await session.detach();
  } catch {
    // ignore
  }
  try {
    if (context && typeof context.close === "function") await context.close();
  } catch {
    // ignore
  }
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
