import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

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

const { CHANNELS } = require(join(root, "electron/eaushadhi-worker/ipc.js"));
assert(CHANNELS.RECHECK_LOGIN === "eaushadhi-worker:recheck-login", "recheck IPC channel is narrow");
assert(CHANNELS.COMPOSITION_PREVIEW === "eaushadhi-worker:composition-preview", "Composition preview channel is bounded");
assert(CHANNELS.COMPOSITION_START_LINE === "eaushadhi-worker:composition-start-line", "Composition start-line channel is bounded");
assert(CHANNELS.COMPOSITION_RECOVER_RUN === "eaushadhi-worker:composition-recover-run", "Composition recovery channel is bounded");
assert(CHANNELS.COMPOSITION_VERIFY_STAGE === "eaushadhi-worker:composition-verify-stage", "Composition stage verification channel is bounded");
assert(CHANNELS.PRODUCT_DETAILS_PREVIEW === "eaushadhi-worker:product-details-preview", "Product Details preview channel remains");
assert(CHANNELS.PRODUCT_DETAILS_START === "eaushadhi-worker:product-details-start", "Product Details start channel remains");
assert(CHANNELS.QC_PREPARATION_READ === "eaushadhi-worker:qc-preparation-read", "QC preparation read channel is bounded");
assert(CHANNELS.QC_REPORT_READ === "eaushadhi-worker:qc-report-read", "QC report read channel is bounded");
assert(!Object.values(CHANNELS).some((name) => /evaluate|execute|run-script/i.test(name)), "no generic evaluate IPC");

const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const qcHandlerStart = ipcSrc.indexOf("CHANNELS.QC_PREPARATION_READ,");
const qcReadHandler = ipcSrc.slice(
  qcHandlerStart,
  ipcSrc.indexOf("CHANNELS.OPEN_CAPTURE_FOLDER,", qcHandlerStart),
);
assert(qcReadHandler.includes("withRendererGuard"), "QC preparation read IPC is renderer-guarded");
assert(qcReadHandler.includes("validateAccessToken"), "QC preparation read IPC validates the session token");
assert(qcReadHandler.includes("validateProductId"), "QC preparation read IPC validates productId");
assert(qcReadHandler.includes("callRpc: callWorkerRpc"), "QC preparation read IPC uses the user-scoped RPC client");
assert(!/qc_preparation_save_v1|qc_preparation_verify_v1|qc_preparation_review_v1|qc_run_arm|SaveQCData/.test(qcReadHandler), "QC preparation read IPC does not reference mutation RPCs");
assert(ipcSrc.includes("previewProductDetailsExecution"), "Product Details preview path remains");
assert(ipcSrc.includes("startCompositionLineExecution"), "Composition start path remains");

const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
assert(preloadSrc.includes("recheckLogin:"), "preload exposes recheckLogin only");
assert(preloadSrc.includes("eaushadhi-worker:recheck-login"), "preload maps the recheck channel");
assert(!/evaluate\s*:/.test(preloadSrc), "preload does not expose evaluate");
for (const method of ["previewComposition:", "startCompositionLine:", "recoverCompositionRun:", "verifyCompositionStage:"]) {
  assert(preloadSrc.includes(method), `preload exposes bounded ${method}`);
}
const compositionBlock = preloadSrc.slice(
  preloadSrc.indexOf("previewComposition:"),
  preloadSrc.indexOf("capturePortalContract:"),
);
assert(!/(plannerReport|pageIdentityEvidence|portalListEvidence|target_projection|rpcName|scriptSource)/.test(compositionBlock), "preload exposes no Composition evidence/RPC/script authority");
assert(preloadSrc.includes("readQcPreparation:"), "preload exposes readQcPreparation");
assert(preloadSrc.includes("eaushadhi-worker:qc-preparation-read"), "preload maps the QC preparation read channel");
const qcPreload = preloadSrc.slice(
  preloadSrc.indexOf("readQcPreparation:"),
  preloadSrc.indexOf("onStatus:"),
);
assert(!/qc_preparation_save_v1|qc_preparation_verify_v1|service_role|actor/i.test(qcPreload), "preload QC read sends no mutation or actor authority");
assert(preloadSrc.includes("readQcReport:"), "preload exposes readQcReport");
assert(preloadSrc.includes("eaushadhi-worker:qc-report-read"), "preload maps the QC report read channel");
const qcReportHandlerStart = ipcSrc.indexOf("CHANNELS.QC_REPORT_READ,");
const qcReportHandler = ipcSrc.slice(qcReportHandlerStart, ipcSrc.indexOf("return worker;", qcReportHandlerStart));
assert(qcReportHandler.includes("withRendererGuard"), "QC report read IPC is renderer-guarded");
assert(qcReportHandler.includes("validateAccessToken"), "QC report read IPC validates the session token");
assert(qcReportHandler.includes("validateProductId"), "QC report read IPC validates productId");
assert(qcReportHandler.includes("callRpc: callWorkerRpc"), "QC report read IPC uses the user-scoped RPC client");
assert(!/qc_report_reserve_v1|qc_report_register_v1|storage\.from|service_role/.test(qcReportHandler), "QC report read IPC does not reserve, register, or upload");

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
