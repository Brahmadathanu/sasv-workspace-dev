import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  isAllowedEaushadhiRendererUrl,
  assertAllowedEaushadhiRenderer,
  EAUSHADHI_MODULE_PATH,
} = require(join(root, "electron/eaushadhi-worker/renderer-guard.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const allowedDev = `http://localhost:3000${EAUSHADHI_MODULE_PATH}`;
const allowedLoopback = `http://127.0.0.1:3000${EAUSHADHI_MODULE_PATH}`;
assert(isAllowedEaushadhiRendererUrl(allowedDev) === true, "localhost Review & Control is accepted");
assert(isAllowedEaushadhiRendererUrl(allowedLoopback) === true, "127.0.0.1 Review & Control is accepted");
assert(
  isAllowedEaushadhiRendererUrl(`${allowedDev}?product=12#readiness`) === true,
  "query/hash on the module document is accepted",
);

assert(
  isAllowedEaushadhiRendererUrl("http://localhost:3000/public/shared/production-route-manager.html") === false,
  "unrelated local module is rejected",
);
assert(
  isAllowedEaushadhiRendererUrl("http://localhost:3000/shared/e-aushadhi-review-control.html") === false,
  "PWA shared path is rejected",
);
assert(isAllowedEaushadhiRendererUrl("https://example.com/public/shared/e-aushadhi-review-control.html") === false, "external sender is rejected");
assert(isAllowedEaushadhiRendererUrl("file:///C:/public/shared/e-aushadhi-review-control.html") === false, "file URL is rejected");

assertAllowedEaushadhiRenderer({
  senderFrame: { url: allowedDev },
});
let denied = null;
try {
  assertAllowedEaushadhiRenderer({
    senderFrame: { url: "http://localhost:3000/index.html" },
  });
} catch (error) {
  denied = error.kind;
}
assert(denied === ERROR_KINDS.UNAUTHORIZED_RENDERER, "home renderer is UNAUTHORIZED_RENDERER");

if (failed) {
  console.error(`\n${failed} renderer-guard assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-renderer-guard-smoke: all assertions passed");
