// OFFICE-PC TEST CANDIDATE isolation (WP10/WP12). Inert unless the packaged package.json carries the marker key below.
// The marker is injected ONLY by electron/candidate/electron-builder.office-test.json (build `extraMetadata`); the normal
// `npm start` / `npm run build` / production package.json has no marker, so every function here returns null and
// main.js behaves exactly as before. Pure CommonJS; no Electron import, so it is unit-testable under plain Node.
"use strict";

const path = require("path");

const MARKER_KEY = "sasvOfficeTestCandidate";
const PRODUCTION = Object.freeze({
  appId: "com.brahmadathanu.sasvworkspace",
  productName: "SASV Workspace",
  packageName: "daily-worklog-app",
  nsisGuid: "A3F5C8D2-14BE-4E7A-9B3C-6D0E2F1A4B87",
});

/** Pure: what is wrong with a marker (empty array = valid). Never trusts a marker that could alias the production identity. */
function validateMarker(marker) {
  const problems = [];
  if (!marker || typeof marker !== "object") return ["marker missing"];
  if (marker.schema !== 1) problems.push("schema must be 1");
  if (marker.updaterDisabled !== true) problems.push("updaterDisabled must be true");
  const id = String(marker.appId || "");
  if (!id || id.toLowerCase() === PRODUCTION.appId) problems.push("appId missing or equals production appId");
  if (!id.toLowerCase().startsWith(`${PRODUCTION.appId}.officetest`)) problems.push("appId must extend the production id with .officetest");
  const dir = String(marker.userDataDirName || "");
  if (!dir || /[\\/:*?"<>|]/.test(dir) || dir === "." || dir === "..") problems.push("userDataDirName missing or not a single safe folder name");
  if ([PRODUCTION.productName, PRODUCTION.packageName].some((n) => n.toLowerCase() === dir.toLowerCase())) problems.push("userDataDirName equals a production data folder name");
  if (!/^[0-9a-f]{40}$/.test(String(marker.sourceCommit || ""))) problems.push("sourceCommit must be a 40-hex git SHA");
  if (!String(marker.candidateVersion || "").trim()) problems.push("candidateVersion missing");
  return problems;
}

function readMarker(pkg) {
  const m = pkg && typeof pkg === "object" ? pkg[MARKER_KEY] : undefined;
  return m === undefined ? null : m;
}

function userDataPathFor(appDataDir, marker) {
  return path.join(appDataDir, marker.userDataDirName);
}

/**
 * Call ONCE at the very top of main.js, before app.requestSingleInstanceLock() and before `ready`.
 * Returns null for the normal app (no side effects at all). For a valid candidate: sets a separate userData path and returns the marker.
 * For a marker that is present but invalid: shows an error and exits (fail closed) rather than running with an ambiguous identity.
 */
function activate({ app, dialog, readFileSync, appDir }) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path.join(appDir, "package.json"), "utf8"));
  } catch {
    return null; // cannot read package.json => not a candidate build; normal behaviour
  }
  const marker = readMarker(pkg);
  if (marker === null) return null;
  const problems = validateMarker(marker);
  if (problems.length) {
    try { dialog.showErrorBox("SASV Workspace OFFICE TEST candidate refused to start", `Invalid candidate identity: ${problems.join("; ")}`); } catch { /* headless */ }
    app.exit(3);
    throw new Error(`office-test candidate marker invalid: ${problems.join("; ")}`);
  }
  app.setPath("userData", userDataPathFor(app.getPath("appData"), marker));
  return Object.freeze({ ...marker });
}

module.exports = { MARKER_KEY, PRODUCTION, validateMarker, readMarker, userDataPathFor, activate };
