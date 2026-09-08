/**
 * Browser launch runtime hardening contracts (viewport / sandbox / Stop UX).
 * Does not launch Microsoft Edge.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { edgeLaunchOptions } = require(join(root, "electron/eaushadhi-worker/browser.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const options = edgeLaunchOptions();
assert(options.channel === "msedge", "channel remains msedge");
assert(options.headless === false, "headed Edge retained");
assert(options.viewport === null, "11: viewport is null for native window sizing");
assert(!JSON.stringify(options).includes("1280"), "11: launch options no longer force 1280");
assert(!JSON.stringify(options).includes("800"), "11: launch options no longer force 800");
assert(Array.isArray(options.args) && options.args.includes("--start-maximized"), "12: --start-maximized present");
assert(!options.args.some((arg) => /--window-size=|--window-position=/i.test(arg)), "12: no hardcoded screen dimensions");
assert(options.chromiumSandbox === true, "13: chromiumSandbox is true");
assert(
  Array.isArray(options.ignoreDefaultArgs) &&
    options.ignoreDefaultArgs.length === 1 &&
    options.ignoreDefaultArgs[0] === "--no-sandbox",
  "13: ignoreDefaultArgs suppresses only --no-sandbox",
);
assert(options.ignoreDefaultArgs !== true, "13: ignoreDefaultArgs is not broadly true");
assert(!JSON.stringify(options).includes("--disable-web-security"), "14: no --disable-web-security");
assert(options.ignoreHTTPSErrors === false, "15: ignoreHTTPSErrors remains false");
assert(!JSON.stringify(options).includes("--ignore-certificate-errors"), "16: no certificate bypass flag");

const browserSrc = readFileSync(join(root, "electron/eaushadhi-worker/browser.js"), "utf8");
assert(browserSrc.includes("dedicatedProfileDir"), "dedicated profile helper retained");
assert(browserSrc.includes('channel: "msedge"'), "Edge channel launch path is present");
assert(browserSrc.includes("chromiumSandbox: true"), "sandbox enabled in source");
assert(browserSrc.includes('ignoreDefaultArgs: ["--no-sandbox"]'), "only --no-sandbox is ignored in source");
assert(browserSrc.includes("viewport: null"), "native viewport in source");
assert(browserSrc.includes("--start-maximized"), "start-maximized in source");
assert(!browserSrc.includes("width: 1280"), "fixed 1280 viewport removed from source");

const htmlSrc = readFileSync(join(root, "public/shared/e-aushadhi-review-control.html"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const originGuardSrc = readFileSync(join(root, "electron/eaushadhi-worker/origin-guard.js"), "utf8");
const workerIndexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");
const cdpGuardSrc = readFileSync(join(root, "electron/eaushadhi-worker/cdp-target-guard.js"), "utf8");
assert(originGuardSrc.includes("activateReconciliation"), "reconciler has explicit activation");
assert(originGuardSrc.includes("page_attach_check"), "attach-time URL classification exists");
assert(originGuardSrc.includes("context_reconciliation"), "context reconciliation exists");
assert(workerIndexSrc.includes("activateReconciliation"), "worker activates reconciliation after controlledPage");
assert(workerIndexSrc.includes("bindControlledTarget"), "worker binds controlled CDP target id");
assert(workerIndexSrc.includes("createCdpTargetGuard"), "worker activates CDP target discovery");
assert(workerIndexSrc.includes("closed_offending_target"), "worker records CDP target containment");
assert(cdpGuardSrc.includes("Target.setDiscoverTargets"), "CDP guard enables target discovery");
assert(cdpGuardSrc.includes("Target.getTargets"), "CDP guard reconciles via getTargets");
assert(cdpGuardSrc.includes("Target.closeTarget"), "CDP guard closes via Target.closeTarget");
assert(cdpGuardSrc.includes("cdp_target_created"), "CDP detection source: created");
assert(cdpGuardSrc.includes("cdp_target_changed"), "CDP detection source: changed");
assert(cdpGuardSrc.includes("cdp_target_reconciliation"), "CDP detection source: reconciliation");
assert(!browserSrc.includes("remote-debugging-port"), "no remote-debugging-port in browser launch");
assert(!browserSrc.includes("connectOverCDP"), "no connectOverCDP in browser launch");
assert(!cdpGuardSrc.includes("connectOverCDP"), "no connectOverCDP in CDP guard");
assert(!cdpGuardSrc.includes("_channel") && !cdpGuardSrc.includes("_guid"), "no private Playwright internals in CDP guard");
const stopHint = "Stop Browser — closes the dedicated browser; does not log out of e-Aushadhi.";
assert(htmlSrc.includes(stopHint), "18: Stop HTML title/tooltip uses canonical no-logout wording");
assert(controlSrc.includes(stopHint), "18: placeWorkerStop applies canonical Stop wording");
assert(controlSrc.includes("submitWorkerStop"), "17: Stop remains functional");
assert(!/logout/i.test(preloadSrc), "19: preload introduces no Logout API");
assert(!/logout/i.test(ipcSrc), "19: IPC introduces no Logout channel");

if (failed) {
  console.error(`\n${failed} browser-runtime assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-browser-runtime-smoke: all assertions passed");
console.log("Note: Microsoft Edge was not launched during browser-runtime smoke.");
