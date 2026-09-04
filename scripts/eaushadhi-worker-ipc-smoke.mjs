import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { validateProductId, validateAccessToken } = require(
  join(root, "electron/eaushadhi-worker/validate.js"),
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

assert(validateProductId(12) === 12, "positive integer productId");
let badId = null;
try {
  validateProductId(0);
} catch (error) {
  badId = error.kind;
}
assert(badId === "PREFLIGHT_DENIED", "zero productId rejected");
try {
  validateProductId("abc");
} catch (error) {
  badId = error.kind;
}
assert(badId === "PREFLIGHT_DENIED", "non-integer productId rejected");

assert(validateAccessToken("a".repeat(20)).length === 20, "token accepted");
let badToken = null;
try {
  validateAccessToken("short");
} catch (error) {
  badToken = error.kind;
}
assert(badToken === "AUTHORIZATION", "short token rejected");
try {
  validateAccessToken("bearer token with spaces");
} catch (error) {
  badToken = error.kind;
}
assert(badToken === "AUTHORIZATION", "whitespace token rejected");

if (failed) {
  console.error(`\n${failed} ipc validation assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-ipc-smoke: all assertions passed");
