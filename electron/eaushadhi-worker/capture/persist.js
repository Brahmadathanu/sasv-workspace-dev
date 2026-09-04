/* eslint-env node */

const fs = require("fs");
const path = require("path");

const CAPTURE_ROOT_NAME = "eaushadhi-contract-captures";

function capturesRoot(userDataPath) {
  return path.resolve(String(userDataPath || ""), CAPTURE_ROOT_NAME);
}

function isPathInsideRoot(candidate, root) {
  const resolved = path.resolve(String(candidate || ""));
  const base = path.resolve(String(root || ""));
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  return resolved === base || resolved.startsWith(prefix);
}

function writeCaptureJson(userDataPath, captureId, payload) {
  const root = capturesRoot(userDataPath);
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, captureId);
  if (!isPathInsideRoot(dir, root)) {
    throw new Error("Capture path escaped the governed capture root.");
  }
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "capture.json");
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return dir;
}

module.exports = {
  CAPTURE_ROOT_NAME,
  capturesRoot,
  isPathInsideRoot,
  writeCaptureJson,
};
