/* eslint-env node */

const path = require("path");
const { ERROR_KINDS, workerError } = require("./errors");

function resolvePlaywrightCore() {
  return require("playwright-core");
}

function edgeLaunchOptions() {
  return {
    channel: "msedge",
    headless: false,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: false,
  };
}

async function launchDedicatedEdge(userDataDir) {
  if (!["win32", "darwin", "linux"].includes(process.platform)) {
    throw workerError(
      ERROR_KINDS.UNSUPPORTED_PLATFORM,
      "The e-Aushadhi browser worker is not supported on this platform.",
    );
  }
  let chromium;
  try {
    ({ chromium } = resolvePlaywrightCore());
  } catch {
    throw workerError(
      ERROR_KINDS.BROWSER_NOT_AVAILABLE,
      "playwright-core is not available in this packaged app.",
    );
  }
  try {
    const context = await chromium.launchPersistentContext(
      userDataDir,
      edgeLaunchOptions(),
    );
    return context;
  } catch (error) {
    const message = String(error?.message || error);
    throw workerError(
      ERROR_KINDS.BROWSER_NOT_AVAILABLE,
      /executable|browser|msedge|edge/i.test(message)
        ? "Microsoft Edge is not available for the dedicated e-Aushadhi profile."
        : "The dedicated Microsoft Edge session could not be started.",
    );
  }
}

function dedicatedProfileDir(userDataPath) {
  return path.join(userDataPath, "eaushadhi-portal-profile");
}

module.exports = {
  launchDedicatedEdge,
  dedicatedProfileDir,
  edgeLaunchOptions,
  resolvePlaywrightCore,
};
