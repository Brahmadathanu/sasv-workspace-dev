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
  "dist-eaushadhi-toolbar-proof",
  "dist-eaushadhi-placeholder-proof",
  "dist-eaushadhi-live-evidence-proof",
  "dist-eaushadhi-capture-harden-proof",
  "dist-eaushadhi-origin-proof",
  "dist-eaushadhi-capture-proof2",
  "dist-eaushadhi-capture-proof",
  "dist-eaushadhi-hardening-proof",
  "dist-eaushadhi-worker-proof",
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
        assert(reviewHtml.indexOf('id="eaWorkerToolbar"') < reviewHtml.indexOf('id="refreshBtn"'), "packaged worker toolbar is left of Refresh");
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
assert(!browserSrc.includes('channel: "chrome"'), "no Chrome fallback");

if (failed) {
  console.error(`\n${failed} packaging assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-packaging-smoke: all assertions passed");
console.log("Note: Microsoft Edge was not launched during packaging smoke.");
