import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { readQcReport, QC_REPORT_READ_RPC } = require(
  join(root, "electron/eaushadhi-worker/qc-report-read.js"),
);
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));

const VALID_TOKEN = `probe-token-${"a".repeat(24)}`;
const FORBIDDEN = [
  "rpc_eaushadhi_qc_report_reserve_v1",
  "rpc_eaushadhi_qc_report_register_v1",
  "rpc_eaushadhi_qc_preparation_save_v1",
  "rpc_eaushadhi_qc_preparation_verify_v1",
  "storage.from",
  "service_role",
];

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

function mockRpc(impl) {
  const calls = [];
  const callRpc = async (accessToken, name, args) => {
    calls.push({ accessToken, name, args });
    return impl(accessToken, name, args);
  };
  return { calls, callRpc };
}

async function expectFailure(run, kind) {
  try {
    await run();
  } catch (error) {
    assert(error?.kind === kind, `failure kind ${kind}`);
    assert(!String(error?.message || "").includes(VALID_TOKEN), "failure message does not include the token");
    assert(!String(error?.message || "").includes("LEAK_MARKER"), "failure message does not include response content");
    return error;
  }
  assert(false, `expected failure ${kind}`);
  return null;
}

const success = mockRpc(async () => []);
const ok = await readQcReport({
  productId: 262,
  accessToken: VALID_TOKEN,
  callRpc: success.callRpc,
});
assert(ok.ok === true && ok.recordCount === 0 && ok.mutated === false, "empty-array read succeeds without mutation");
assert(ok.message === "QC report read probe returned no report reservations.", "empty list is reported as no reservations");
assert(success.calls.length === 1, "exactly one RPC call on success");
assert(success.calls[0].name === QC_REPORT_READ_RPC, "RPC name is the report read");
assert(success.calls[0].name === "rpc_eaushadhi_qc_report_read_v1", "RPC name is exact");
assert(
  JSON.stringify(success.calls[0].args) === JSON.stringify({ p_product_id: 262 }),
  "RPC arguments are only p_product_id 262",
);

for (const token of [undefined, null, "", "short", "bad token", 12345]) {
  const blocked = mockRpc(async () => []);
  await expectFailure(
    () => readQcReport({ productId: 262, accessToken: token, callRpc: blocked.callRpc }),
    ERROR_KINDS.AUTHORIZATION,
  );
  assert(blocked.calls.length === 0, "invalid token prevents the network call");
}

for (const productId of [0, 261, 263, "261", 262.5, null, "abc"]) {
  const blocked = mockRpc(async () => []);
  await expectFailure(
    () => readQcReport({ productId, accessToken: VALID_TOKEN, callRpc: blocked.callRpc }),
    ERROR_KINDS.PRODUCT_NOT_ALLOWED,
  );
  assert(blocked.calls.length === 0, "incorrect product id prevents the network call");
}

for (const shape of [null, {}, { rows: [] }, "[]", "LEAK_MARKER", [{ id: "LEAK_MARKER" }], [null]]) {
  const blocked = mockRpc(async () => shape);
  await expectFailure(
    () => readQcReport({ productId: 262, accessToken: VALID_TOKEN, callRpc: blocked.callRpc }),
    ERROR_KINDS.PREFLIGHT_DENIED,
  );
}

const expired = mockRpc(async () => {
  const error = new Error(`JWT expired ${VALID_TOKEN}`);
  error.code = "PGRST301";
  error.status = 401;
  throw error;
});
const authError = await expectFailure(
  () => readQcReport({ productId: 262, accessToken: VALID_TOKEN, callRpc: expired.callRpc }),
  ERROR_KINDS.AUTHORIZATION,
);
assert(authError?.message === "Not authorized for e-Aushadhi automation.", "unauthorized response is generic");

const helperSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-report-read.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const clientSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-worker-client.js"), "utf8");
for (const name of FORBIDDEN) {
  assert(!helperSrc.includes(name), `read helper does not reference ${name}`);
}
assert(helperSrc.includes("rpc_eaushadhi_qc_report_read_v1"), "read helper names the report read RPC");
assert(!/writeDiagnostic|capture|upload|remove\(/.test(helperSrc), "read helper does not upload, delete, or capture");

const handlerStart = ipcSrc.indexOf("CHANNELS.QC_REPORT_READ,");
const handler = ipcSrc.slice(handlerStart, ipcSrc.indexOf("return worker;", handlerStart));
assert(handler.includes("withRendererGuard") && handler.includes("callRpc: callWorkerRpc"), "report read IPC is guarded and user-scoped");
assert(ipcSrc.includes("previewProductDetailsExecution"), "Product Details preview path remains");
assert(ipcSrc.includes("startCompositionLineExecution"), "Composition start path remains");

const probeButton = controlSrc.slice(
  controlSrc.indexOf('id="btnQcReportRead"'),
  controlSrc.indexOf(">QC report read probe</button>"),
);
assert(!probeButton.includes("data-edit-action"), "report probe button is not an edit action");
const probeSubmit = controlSrc.slice(
  controlSrc.indexOf("async function submitQcReportReadProbe"),
  controlSrc.indexOf("async function submitWorkerEntryDryRun"),
);
assert(probeSubmit.startsWith("async function submitQcReportReadProbe"), "report probe handler is present");
assert(probeSubmit.includes("access.canView !== true"), "view permission gates the report read");
assert(!probeSubmit.includes("canWrite("), "report read is not blocked by the edit requirement");
assert(probeSubmit.includes("isFirstControlledEntryProduct"), "report read stays on product 262");
assert(probeSubmit.includes("state.selectedProductId !== productId"), "late report result is discarded");
assert(!probeSubmit.includes("supabase.rpc"), "report probe has no renderer RPC fallback");
for (const name of FORBIDDEN) {
  assert(!probeSubmit.includes(name), `report probe handler does not reference ${name}`);
}
assert(controlSrc.includes("state.workerQcReportReadResult = null"), "report result is cleared with the product workspace");

globalThis.window = {};
const client = await import(pathToFileURL(join(root, "public/shared/js/eaushadhi-review-worker-client.js")).href);
const pwaResult = await client.readQcReport(262, VALID_TOKEN);
assert(pwaResult?.errorKind === "UNSUPPORTED_PLATFORM", "PWA report read has no executable fallback");

let electronCalls = 0;
globalThis.window = {
  electronAPI: {},
  eaushadhiWorkerAPI: {
    getStatus() {
      return { state: "IDLE" };
    },
    readQcReport(productId, accessToken) {
      electronCalls += 1;
      assert(productId === 262 && accessToken === VALID_TOKEN, "Electron wrapper forwards product and session token");
      return { ok: true, recordCount: 0 };
    },
  },
};
const electronResult = await client.readQcReport(262, VALID_TOKEN);
assert(electronResult?.ok === true && electronCalls === 1, "Electron wrapper calls the preload method once");

if (failed) {
  console.error(`\n${failed} qc report read probe assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-report-read-probe-smoke: all assertions passed");
