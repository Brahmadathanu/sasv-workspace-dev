import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { readQcPreparation, QC_PREPARATION_READ_RPC } = require(
  join(root, "electron/eaushadhi-worker/qc-preparation-read.js"),
);
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));

const VALID_TOKEN = `probe-token-${"a".repeat(24)}`;
const MUTATION_RPCS = [
  "rpc_eaushadhi_qc_preparation_save_v1",
  "rpc_eaushadhi_qc_preparation_verify_v1",
  "rpc_eaushadhi_qc_preparation_review_v1",
  "rpc_eaushadhi_qc_run_arm",
  "rpc_eaushadhi_qc_run_record_save",
  "rpc_eaushadhi_qc_run_verify_row",
  "rpc_eaushadhi_qc_stage_mark_portal_verified",
  "SaveQCData",
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
const ok = await readQcPreparation({
  productId: 262,
  accessToken: VALID_TOKEN,
  callRpc: success.callRpc,
});
assert(ok.ok === true, "empty-array read succeeds");
assert(ok.recordCount === 0, "success record count is zero");
assert(ok.mutated === false, "success path does not mutate");
assert(ok.productId === 262, "success product is 262");
assert(success.calls.length === 1, "exactly one RPC call on success");
assert(success.calls[0].name === QC_PREPARATION_READ_RPC, "RPC name is the preparation read");
assert(
  JSON.stringify(success.calls[0].args) === JSON.stringify({ p_product_id: 262 }),
  "RPC arguments are only p_product_id 262",
);
assert(!Object.prototype.hasOwnProperty.call(success.calls[0].args, "p_actor"), "no client-supplied actor");

for (const token of [undefined, null, "", "short", "bad token", 12345]) {
  const blocked = mockRpc(async () => []);
  await expectFailure(
    () => readQcPreparation({ productId: 262, accessToken: token, callRpc: blocked.callRpc }),
    ERROR_KINDS.AUTHORIZATION,
  );
  assert(blocked.calls.length === 0, "invalid token prevents the network call");
}

for (const productId of [0, 261, 263, "261", 262.5, null, "abc"]) {
  const blocked = mockRpc(async () => []);
  await expectFailure(
    () => readQcPreparation({ productId, accessToken: VALID_TOKEN, callRpc: blocked.callRpc }),
    ERROR_KINDS.PRODUCT_NOT_ALLOWED,
  );
  assert(blocked.calls.length === 0, "incorrect product id prevents the network call");
}

const unexpected = [
  null,
  undefined,
  {},
  { rows: [] },
  "[]",
  "LEAK_MARKER",
  [{ preparation_id: "LEAK_MARKER" }],
  [null],
  0,
  false,
];
for (const shape of unexpected) {
  const blocked = mockRpc(async () => shape);
  await expectFailure(
    () => readQcPreparation({ productId: 262, accessToken: VALID_TOKEN, callRpc: blocked.callRpc }),
    ERROR_KINDS.PREFLIGHT_DENIED,
  );
  assert(blocked.calls.length === 1, "unexpected shape is rejected after the single read");
}

const expired = mockRpc(async () => {
  const error = new Error(`JWT expired ${VALID_TOKEN}`);
  error.code = "PGRST301";
  error.status = 401;
  throw error;
});
const authError = await expectFailure(
  () => readQcPreparation({ productId: 262, accessToken: VALID_TOKEN, callRpc: expired.callRpc }),
  ERROR_KINDS.AUTHORIZATION,
);
assert(authError?.message === "Not authorized for e-Aushadhi automation.", "unauthorized response is generic");
assert(expired.calls.length === 1, "expired token is rejected from the server response");

const helperSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-preparation-read.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
const clientSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-worker-client.js"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");

for (const name of MUTATION_RPCS) {
  assert(!helperSrc.includes(name), `read helper does not reference ${name}`);
}
assert(!/service_role|SUPABASE_SERVICE|writeDiagnostic|capture/i.test(helperSrc), "read helper has no service role, diagnostics, or captures");
assert(helperSrc.includes(QC_PREPARATION_READ_RPC), "read helper names only the preparation read RPC");
assert(preloadSrc.includes("eaushadhi-worker:qc-preparation-read"), "preload maps the read channel");
assert(!preloadSrc.includes("rpc_eaushadhi_qc_preparation_save_v1"), "preload does not expose QC save");

const qcHandlerStart = ipcSrc.indexOf("CHANNELS.QC_PREPARATION_READ,");
const qcReadHandler = ipcSrc.slice(
  qcHandlerStart,
  ipcSrc.indexOf("CHANNELS.OPEN_CAPTURE_FOLDER,", qcHandlerStart),
);
assert(qcHandlerStart >= 0 && qcReadHandler.includes("readQcPreparation"), "QC preparation read handler is present");
assert(qcReadHandler.includes("withRendererGuard"), "IPC channel is guarded");
assert(qcReadHandler.includes("validateAccessToken(payload?.accessToken)"), "IPC validates the token before the read");
assert(ipcSrc.includes("previewProductDetailsExecution"), "Product Details preview path remains");
assert(ipcSrc.includes("startProductDetailsExecution"), "Product Details start path remains");
assert(ipcSrc.includes("previewCompositionExecution"), "Composition preview path remains");
assert(ipcSrc.includes("startCompositionLineExecution"), "Composition start path remains");
assert(controlSrc.includes("async function submitWorkerProductDetailsStart"), "Product Details start handler remains");
assert(controlSrc.includes("async function submitWorkerProductDetailsPreview"), "Product Details preview handler remains");
assert(controlSrc.includes("async function submitWorkerCompositionPreview"), "Composition preview handler remains");
assert(controlSrc.includes("startWorkerCompositionLine"), "Composition line start path remains");

const probeUi = controlSrc.slice(
  controlSrc.indexOf("function workerQcPreparationReadSummary"),
  controlSrc.indexOf("function workerDryRunSummary"),
);
assert(probeUi.includes(">QC preparation read probe</button>"), "button label is QC preparation read probe");
assert(!/QC Ready|\bVerified\b|\bCompleted\b/.test(probeUi), "probe label is not QC Ready, Verified, or Completed");
assert(probeUi.includes("isFirstControlledEntryProduct"), "probe UI is limited to product 262");
assert(probeUi.includes('id="btnWorkerFoundation"'), "Foundation Check remains in the same card");

const probeSubmit = controlSrc.slice(
  controlSrc.indexOf("async function submitQcPreparationReadProbe"),
  controlSrc.indexOf("async function submitWorkerEntryDryRun"),
);
assert(probeSubmit.indexOf("if (!workerApiAvailable()) return;") < probeSubmit.indexOf("sessionAccessToken"), "PWA returns before a session read");
assert(!probeSubmit.includes("supabase.rpc"), "probe handler has no renderer RPC fallback");
assert(!probeSubmit.includes("startWorkerProductDetails"), "probe handler does not start Product Details");
assert(!probeSubmit.includes("startWorkerCompositionLine"), "probe handler does not start Composition");
for (const name of MUTATION_RPCS) {
  assert(!probeSubmit.includes(name), `probe handler does not reference ${name}`);
}

const clientFn = clientSrc.slice(
  clientSrc.indexOf("export async function readQcPreparation"),
  clientSrc.indexOf("export function onWorkerStatus"),
);
assert(clientFn.includes("if (!workerApiAvailable()) return unsupported();"), "PWA client returns unsupported");
assert(!clientFn.includes("supabase"), "worker client has no Supabase fallback");
assert(!clientFn.includes(".rpc("), "worker client does not call an RPC directly");

globalThis.window = {};
const client = await import(pathToFileURL(join(root, "public/shared/js/eaushadhi-review-worker-client.js")).href);
const pwaResult = await client.readQcPreparation(262, VALID_TOKEN);
assert(pwaResult?.ok === false, "PWA read is not successful");
assert(pwaResult?.errorKind === "UNSUPPORTED_PLATFORM", "PWA read has no executable fallback");

let electronCalls = 0;
globalThis.window = {
  electronAPI: {},
  eaushadhiWorkerAPI: {
    getStatus() {
      return { state: "IDLE" };
    },
    readQcPreparation(productId, accessToken) {
      electronCalls += 1;
      assert(productId === 262, "Electron wrapper forwards product 262");
      assert(accessToken === VALID_TOKEN, "Electron wrapper forwards the session token");
      return { ok: true, recordCount: 0 };
    },
  },
};
const electronResult = await client.readQcPreparation(262, VALID_TOKEN);
assert(electronResult?.ok === true, "Electron wrapper returns the worker result");
assert(electronCalls === 1, "Electron wrapper calls the preload method once");

if (failed) {
  console.error(`\n${failed} qc preparation read probe assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-preparation-read-probe-smoke: all assertions passed");
