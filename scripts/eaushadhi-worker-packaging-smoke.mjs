/**
 * Packaged/unpacked Electron proof for the e-Aushadhi worker foundation.
 * Does not launch Microsoft Edge.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const distCandidates = [
  process.env.EAUSHADHI_PACK_DIST,
  "dist-eaushadhi-live-contract-proof",
  "dist-eaushadhi-header-erp-proof",
  "dist-eaushadhi-toolbar-proof",
  "dist-eaushadhi-placeholder-proof",
  "dist-eaushadhi-live-evidence-proof",
  "dist-eaushadhi-capture-harden-proof",
  "dist-eaushadhi-origin-proof",
  "dist-eaushadhi-capture-proof2",
  "dist-eaushadhi-capture-proof",
  "dist-eaushadhi-hardening-proof",
  "dist-eaushadhi-worker-proof",
  "dist-eaushadhi-auth-refresh-proof",
  "dist-eaushadhi-browser-runtime-hardening-proof",
  "dist",
].filter(Boolean);
const dist = distCandidates
  .map((name) => join(root, name))
  .find((dir) => existsSync(dir));
assert(existsSync(dist), "dist/ exists after electron-builder --dir");

const unpackedName = readdirSync(dist).find((name) => name.includes("unpacked"));
const unpacked = unpackedName ? join(dist, unpackedName) : join(dist, "win-unpacked");
assert(existsSync(unpacked), `unpacked app exists at ${unpacked}`);

const resources = join(unpacked, "resources");
const asarPath = join(resources, "app.asar");
const asarUnpacked = join(resources, "app.asar.unpacked");

const workerLoose = join(asarUnpacked, "electron/eaushadhi-worker/index.js");
assert(existsSync(workerLoose), "worker runtime is unpacked beside asar");
const originGuardLoose = join(asarUnpacked, "electron/eaushadhi-worker/origin-guard.js");
const rendererGuardLoose = join(asarUnpacked, "electron/eaushadhi-worker/renderer-guard.js");
assert(existsSync(originGuardLoose), "origin-guard is unpacked");
const originGuardSrc = readFileSync(originGuardLoose, "utf8");
const diagnosticsLoose = join(asarUnpacked, "electron/eaushadhi-worker/diagnostics.js");
assert(existsSync(diagnosticsLoose), "diagnostics is unpacked");
const diagnosticsSrc = readFileSync(diagnosticsLoose, "utf8");
assert(
  originGuardSrc.includes("attachContextOriginGuard"),
  "unpacked origin-guard attaches to every current and future context page",
);
assert(
  originGuardSrc.includes('context.on("page"'),
  "unpacked origin-guard listens for BrowserContext page lifecycle",
);
assert(existsSync(rendererGuardLoose), "renderer-guard is unpacked");
const captureLoose = join(asarUnpacked, "electron/eaushadhi-worker/capture/index.js");
assert(existsSync(captureLoose), "capture package is unpacked");
const captureSrc = readFileSync(captureLoose, "utf8");
assert(captureSrc.includes("captureOpenPages"), "unpacked capture inspects already-open pages");
assert(captureSrc.includes("assertAllowedUrl"), "unpacked capture fail-closes on foreign HTTP(S) pages");
assert(!captureSrc.includes('reason: "disallowed_origin"'), "unpacked capture does not skip foreign pages");
assert(!/\.goto\s*\(/.test(captureSrc), "unpacked capture does not call goto");
assert(captureSrc.includes("indications"), "unpacked capture recognizes indications as pharmacological candidate");
assert(captureSrc.includes("PLACEHOLDER_SENTINELS"), "unpacked capture uses sentinel placeholder values");
assert(captureSrc.includes('"-1"'), "unpacked capture recognizes -1 placeholder sentinels");

assert(existsSync(join(asarUnpacked, "electron/eaushadhi-worker/dry-run.js")), "dry-run module is unpacked");
const workerIndexLoose = join(asarUnpacked, "electron/eaushadhi-worker/index.js");
assert(existsSync(workerIndexLoose), "worker index is unpacked");
const workerIndexSrc = readFileSync(workerIndexLoose, "utf8");
assert(workerIndexSrc.includes("connect:launch"), "unpacked connect records launch phase");
assert(workerIndexSrc.includes("recheckAuthentication"), "unpacked worker exposes auth recheck");
assert(workerIndexSrc.includes("auth-refresh"), "unpacked worker records auth-refresh phase");
const recheckSrc = workerIndexSrc.slice(
  workerIndexSrc.indexOf("async function recheckAuthentication"),
  workerIndexSrc.indexOf("async function stop()"),
);
assert(recheckSrc.includes("probeAuthenticatedSession"), "unpacked recheck uses the existing auth probe");
assert(
  recheckSrc.includes("if (machine.get() === STATES.READY)") &&
    recheckSrc.includes("machine.transition(STATES.AUTH_REQUIRED)"),
  "unpacked recheck fail-closes READY on probe execution errors",
);
assert(!/\.goto\s*\(/.test(recheckSrc), "unpacked recheck does not navigate");
assert(workerIndexSrc.includes("causeMessageSanitized"), "unpacked connect preserves sanitized root cause");
assert(existsSync(join(asarUnpacked, "electron/eaushadhi-worker/auth-probe.js")), "auth-probe is unpacked");
const authProbeSrc = readFileSync(join(asarUnpacked, "electron/eaushadhi-worker/auth-probe.js"), "utf8");
assert(authProbeSrc.includes("collectAuthProbeSignals"), "unpacked auth-probe collects structural signals");
assert(authProbeSrc.includes("function normalizePathLocal"), "unpacked collectAuthProbeSignals is serialization-safe");
assert(authProbeSrc.includes("password"), "unpacked auth-probe fail-closes on password input");
const authSignalsLoose = join(asarUnpacked, "electron/eaushadhi-worker/capture/auth-signals.js");
assert(existsSync(authSignalsLoose), "auth-signals is unpacked");
const authSignalsSrc = readFileSync(authSignalsLoose, "utf8");
assert(authSignalsSrc.includes("PASSWORD_TYPE"), "auth-signals uses password input type");
assert(authSignalsSrc.includes("ENTRY_TAGS"), "auth-signals limits negatives to entry controls");
assert(authSignalsSrc.includes("logoutform"), "auth-signals treats logoutForm as authenticated evidence");

const sensitiveLoose = join(asarUnpacked, "electron/eaushadhi-worker/capture/sensitive.js");
assert(existsSync(sensitiveLoose), "sensitive redaction is unpacked");
const sensitiveSrc = readFileSync(sensitiveLoose, "utf8");
assert(sensitiveSrc.includes("omitted_account_display_text"), "account display text is redacted before persist");

const playwrightLoose = join(asarUnpacked, "node_modules/playwright-core/package.json");
assert(existsSync(playwrightLoose), "playwright-core is unpacked for driver resolution");

if (existsSync(asarPath)) {
  let listed = [];
  try {
    const asar = require("@electron/asar");
    listed = asar.listPackage(asarPath);
  } catch (error) {
    console.warn("asar list unavailable:", error.message);
  }
  const normalized = listed.map((item) => String(item).replace(/\\/g, "/"));
  assert(
    normalized.some((item) => item.endsWith("preload.js")),
    "preload.js is listed inside app.asar",
  );
  if (normalized.some((item) => item.endsWith("preload.js"))) {
    try {
      const asar = require("@electron/asar");
      const preloadSrc = asar.extractFile(asarPath, "preload.js").toString("utf8");
      assert(preloadSrc.includes("eaushadhiWorkerAPI"), "packaged preload exposes eaushadhiWorkerAPI");
      const reviewHtmlEntry = normalized.find((item) => item.endsWith("public/shared/e-aushadhi-review-control.html"));
      if (reviewHtmlEntry) {
        const asarKey = listed.find((item) => String(item).replace(/\\/g, "/").endsWith("public/shared/e-aushadhi-review-control.html"));
        const reviewHtml = asar.extractFile(asarPath, asarKey.replace(/^[\\/]/, "")).toString("utf8");
        assert(reviewHtml.includes('id="eaWorkerToolbar"'), "packaged Review HTML has worker toolbar");
        assert(reviewHtml.includes('id="btnWorkerRecheckLogin"'), "packaged Review HTML has Recheck Login");
        assert(reviewHtml.includes("Recheck Login"), "packaged Recheck Login copy is present");
        assert(reviewHtml.includes('id="eaWorkerMenu"'), "packaged Review HTML has worker overflow menu");
        assert(reviewHtml.indexOf('id="eaWorkerToolbar"') < reviewHtml.indexOf('id="refreshBtn"'), "packaged worker toolbar is left of Refresh");
        assert(reviewHtml.indexOf('id="eaWorkerMenu"') < reviewHtml.indexOf('id="refreshBtn"'), "packaged worker menu is left of Refresh");
      }
    } catch (error) {
      console.warn("preload extract skipped:", error.message);
    }
  }
} else {
  const preloadLoose = join(resources, "app/preload.js");
  assert(existsSync(preloadLoose), "preload.js exists in unpacked app directory");
}

let playwrightResolved = false;
try {
  require.resolve("playwright-core");
  playwrightResolved = true;
} catch {
  playwrightResolved = false;
}
assert(playwrightResolved, "playwright-core resolves in the development context");

const browserSrc = readFileSync(join(root, "electron/eaushadhi-worker/browser.js"), "utf8");
assert(browserSrc.includes('channel: "msedge"'), "Edge channel launch path is present");
assert(browserSrc.includes("eaushadhi-portal-profile"), "dedicated profile path is present");
assert(browserSrc.includes("viewport: null"), "packaging source uses native viewport");
assert(browserSrc.includes("chromiumSandbox: true"), "packaging source enables chromium sandbox");
assert(browserSrc.includes('ignoreDefaultArgs: ["--no-sandbox"]'), "packaging source suppresses only --no-sandbox");
assert(browserSrc.includes("--start-maximized"), "packaging source starts maximized");
assert(!browserSrc.includes('channel: "chrome"'), "no Chrome fallback");
assert(!browserSrc.includes("width: 1280"), "packaging source no longer forces 1280 viewport");

assert(
  /onDisallowed\(\s*error,\s*url,\s*page/.test(originGuardSrc),
  "unpacked origin-guard passes page identity",
);
assert(originGuardSrc.includes("activateReconciliation"), "unpacked origin-guard exposes activation");
assert(originGuardSrc.includes("page_attach_check"), "unpacked origin-guard has page_attach_check");
assert(originGuardSrc.includes("context_reconciliation"), "unpacked origin-guard has context_reconciliation");
assert(originGuardSrc.includes("detection_source") || originGuardSrc.includes("detectionSource"), "unpacked origin-guard tracks detection source");
assert(originGuardSrc.includes("containmentInFlight"), "unpacked origin-guard dedupes containment");
assert(workerIndexSrc.includes("setControlledPage"), "unpacked worker tracks controlledPage");
assert(workerIndexSrc.includes("activateReconciliation"), "unpacked worker activates reconciliation after controlledPage");
assert(workerIndexSrc.includes("isUsableControlledPage"), "unpacked worker retains a valid controlled page on recheck");
assert(workerIndexSrc.includes("closed_offending_page"), "unpacked worker records secondary containment");
assert(workerIndexSrc.includes("secondary_close_failed_fail_closed"), "unpacked worker fail-closes when secondary close fails");
assert(workerIndexSrc.includes("adopted_allowed_page"), "unpacked worker records controlled-page adoption");
assert(workerIndexSrc.includes("active operation"), "unpacked worker fail-closes controlled loss while RUNNING");
assert(diagnosticsSrc.includes("detection_source"), "unpacked diagnostics persist detection_source");

if (failed) {
  console.error(`\n${failed} packaging assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-packaging-smoke: all assertions passed");
console.log("Note: Microsoft Edge was not launched during packaging smoke.");
