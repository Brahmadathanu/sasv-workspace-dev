import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = require(join(root, "electron/eaushadhi-worker/qc-preparation-workspace.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const {
  QC_PROTOCOL_OPTIONS_RPC,
  QC_PREPARATION_WORKSPACE_READ_RPC,
  QC_PREPARATION_REVIEW_RPC,
  QC_PREPARATION_SAVE_RPC,
  QC_PREPARATION_SOURCE_KEY,
  normalizeQcPayload,
  loadQcProtocolOptions,
  readQcPreparations,
  reviewQcPreparation,
  saveQcPreparation,
} = workspace;

const TOKEN = `workspace-token-${"a".repeat(24)}`;
const PROTOCOL_FIXTURE = [
  { term_id: 11, code: "ACCELERATED_3_MONTH", label: "(3) Month Accelerated Stability" },
  { term_id: 12, code: "ACCELERATED_6_MONTH", label: "(6) Month Accelerated Stability" },
  { term_id: 13, code: "REAL_TIME_STABILITY", label: "Real Time Stability" },
  { term_id: 14, code: "OTHER", label: "Others" },
  { term_id: 161, code: "NOT_APPLICABLE", label: "N/A" },
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
    return impl(accessToken, name, args, calls);
  };
  return { calls, callRpc };
}

async function expectFailure(run, kind) {
  try {
    await run();
  } catch (error) {
    assert(error?.kind === kind, `failure kind ${kind} (${error?.kind})`);
    assert(!String(error?.message || "").includes(TOKEN), "failure message does not include the token");
    return error;
  }
  assert(false, `expected failure ${kind}`);
  return null;
}

for (const productId of [0, 261, 263, "261"]) {
  const blocked = mockRpc(async () => []);
  await expectFailure(
    () => loadQcProtocolOptions({ productId, accessToken: TOKEN, callRpc: blocked.callRpc }),
    ERROR_KINDS.PRODUCT_NOT_ALLOWED,
  );
  await expectFailure(
    () => saveQcPreparation({ productId, accessToken: TOKEN, expectedRowVersion: 0, payload: {}, callRpc: blocked.callRpc }),
    ERROR_KINDS.PRODUCT_NOT_ALLOWED,
  );
  assert(blocked.calls.length === 0, "wrong product makes no RPC call");
}

const options = mockRpc(async () => PROTOCOL_FIXTURE);
const loaded = await loadQcProtocolOptions({ productId: 262, accessToken: TOKEN, callRpc: options.callRpc });
assert(loaded.options.length === 5, "protocol options pass through the server list");
assert(loaded.options[0].term_id === 11 && loaded.options[3].code === "OTHER", "protocol fixture order is preserved");
assert(options.calls[0].name === QC_PROTOCOL_OPTIONS_RPC, "protocol RPC name is exact");
assert(JSON.stringify(options.calls[0].args) === "{}", "protocol RPC takes no arguments");

const empty = normalizeQcPayload({});
assert(!Object.hasOwn(empty.payload, "study_start_date"), "empty draft does not prefill a study start date");
assert(!Object.hasOwn(empty.payload, "study_end_date"), "empty draft does not prefill a study end date");
assert(!Object.hasOwn(empty.payload, "report_date"), "empty draft does not prefill a report date");

const normalized = normalizeQcPayload({
  testing_protocol_term_id: "14",
  other_testing_protocol_text: "  Cross check  ",
  shelf_life_months: "24",
  batches: [{ batch_no: " A1 ", extra: "strip-me" }],
  quality_control_mode: "OUT",
  source_report_issuer: "NUPAL",
  source_report_approval_no: "APP-1",
  portal_laboratory_candidate: "Haridev Formulations",
  report_sha256: "AB".repeat(32),
});
assert(normalized.payload.batches[0].batch_no === "A1", "batch number is trimmed");
assert(!Object.hasOwn(normalized.payload.batches[0], "extra"), "batch objects keep only batch_no");
assert(normalized.payload.source_report_issuer === "NUPAL", "source issuer stays separate");
assert(normalized.payload.portal_laboratory_candidate === "Haridev Formulations", "portal laboratory candidate stays separate");
assert(normalized.payload.source_report_issuer !== normalized.payload.portal_laboratory_candidate, "issuer and portal candidate are not equated");
assert(normalized.payload.report_sha256 === "ab".repeat(32), "claimed SHA-256 is lowercased");
assert(normalized.payload.shelf_life_months === 24, "shelf life is sent as a number");

const duplicate = mockRpc(async () => ({ source_verified_eligible: false, reasons: ["DUPLICATE_BATCH_NUMBER"] }));
const reviewed = await reviewQcPreparation({
  productId: 262,
  accessToken: TOKEN,
  payload: { batches: [{ batch_no: "B1" }, { batch_no: " B1 " }] },
  callRpc: duplicate.callRpc,
});
assert(reviewed.hints.includes("DUPLICATE_BATCH_NUMBER"), "duplicate batches are flagged");
assert(duplicate.calls.length === 1, "review still asks the server about duplicate batches");
const saveBlocked = mockRpc(async () => ({}));
await expectFailure(
  () => saveQcPreparation({
    productId: 262,
    accessToken: TOKEN,
    expectedRowVersion: 0,
    payload: { batches: [{ batch_no: "B1" }, { batch_no: "B1" }] },
    callRpc: saveBlocked.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(saveBlocked.calls.length === 0, "duplicate batches are not saved");

const unknown = mockRpc(async () => ({}));
await expectFailure(
  () => saveQcPreparation({
    productId: 262,
    accessToken: TOKEN,
    expectedRowVersion: 0,
    payload: { invented_field: "no" },
    callRpc: unknown.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(unknown.calls.length === 0, "unknown key is rejected before the RPC");

const PREP_ID = "11111111-1111-1111-1111-111111111111";
function preparationRow(overrides = {}) {
  return {
    preparation_id: PREP_ID,
    product_id: 262,
    source_key: QC_PREPARATION_SOURCE_KEY,
    row_version: 1,
    preparation_status: "PREPARING",
    ...overrides,
  };
}
function readThenSave(rows, saveResult) {
  return mockRpc(async (_token, name) => {
    if (name === QC_PREPARATION_WORKSPACE_READ_RPC) return rows;
    if (name === QC_PREPARATION_SAVE_RPC) return saveResult;
    throw new Error(`unexpected rpc ${name}`);
  });
}

const created = readThenSave([], {
  preparation_id: PREP_ID,
  row_version: 1,
  preparation_status: "PREPARING",
  review: { source_verified_eligible: false, reasons: ["PROTOCOL_REQUIRED"] },
});
await saveQcPreparation({
  productId: 262,
  accessToken: TOKEN,
  preparationId: null,
  expectedRowVersion: 0,
  payload: { report_filename: "claim.pdf" },
  callRpc: created.callRpc,
});
assert(created.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "create reads before saving");
assert(created.calls[1].name === QC_PREPARATION_SAVE_RPC, "create uses the save RPC");
assert(created.calls[1].args.p_preparation_id === null, "create sends a null preparation id");
assert(created.calls[1].args.p_expected_row_version === 0, "create sends expected version 0");
assert(created.calls[1].args.p_source_key === QC_PREPARATION_SOURCE_KEY, "create uses the fixed source key");
assert(created.calls[1].args.p_source_key === "manual-qc:262:primary", "source key is manual-qc:262:primary");
assert(created.calls[1].args.p_payload.report_filename === "claim.pdf", "create payload keeps the entered filename");

const updated = readThenSave([preparationRow()], {
  preparation_id: PREP_ID,
  row_version: 2,
  preparation_status: "REVIEW_REQUIRED",
  review: { source_verified_eligible: false, reasons: [] },
});
await saveQcPreparation({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 1,
  payload: {},
  callRpc: updated.callRpc,
});
assert(updated.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "update reads before saving");
assert(updated.calls[1].args.p_expected_row_version === 1, "update sends the current row version");
assert(updated.calls[1].args.p_source_key === "manual-qc:262:primary", "update cannot substitute another source key");

const stale = mockRpc(async () => {
  const error = new Error("stale");
  error.code = "40001";
  throw error;
});
const staleError = await expectFailure(
  () => saveQcPreparation({ productId: 262, accessToken: TOKEN, expectedRowVersion: 1, preparationId: PREP_ID, payload: {}, callRpc: stale.callRpc }),
  ERROR_KINDS.STALE,
);
assert(staleError?.message === "Server copy changed — reload to compare; nothing was overwritten.", "stale save keeps the operator copy");

const exists = mockRpc(async () => {
  const error = new Error("duplicate");
  error.code = "23505";
  throw error;
});
const existsError = await expectFailure(
  () => saveQcPreparation({ productId: 262, accessToken: TOKEN, expectedRowVersion: 0, payload: {}, callRpc: exists.callRpc }),
  ERROR_KINDS.STALE,
);
assert(existsError?.message === "A QC preparation already exists — reload.", "duplicate create tells the operator to reload");

const denied = mockRpc(async () => {
  const error = new Error("permission denied");
  error.code = "42501";
  error.status = 403;
  throw error;
});
const deniedError = await expectFailure(
  () => readQcPreparations({ productId: 262, accessToken: TOKEN, callRpc: denied.callRpc }),
  ERROR_KINDS.AUTHORIZATION,
);
assert(deniedError?.message === "Not authorized for e-Aushadhi automation.", "permission failure is generic");
assert(denied.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "read uses the preparation read RPC");

const verified = mockRpc(async () => ({}));
await expectFailure(
  () => saveQcPreparation({
    productId: 262,
    accessToken: TOKEN,
    preparationId: "11111111-1111-1111-1111-111111111111",
    expectedRowVersion: 3,
    lastReadStatus: "VERIFIED",
    payload: {},
    callRpc: verified.callRpc,
  }),
  ERROR_KINDS.PREFLIGHT_DENIED,
);
assert(verified.calls.length === 0, "verified preparation is not saved");

for (const [label, payload] of [
  ["invalid shelf life", { shelf_life_months: "0" }],
  ["invalid date", { study_start_date: "10/10/2026" }],
  ["invalid protocol term", { testing_protocol_term_id: "abc" }],
]) {
  const invalid = mockRpc(async () => {
    throw new Error("rpc should not run");
  });
  const invalidError = await expectFailure(
    () => saveQcPreparation({
      productId: 262,
      accessToken: TOKEN,
      preparationId: null,
      expectedRowVersion: 0,
      payload,
      callRpc: invalid.callRpc,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(invalidError?.message === "Correct the highlighted fields before saving.", `${label} is refused before saving`);
  assert(invalid.calls.length === 0, `${label} makes no RPC call`);
}

const verifiedOnServer = readThenSave([preparationRow({ preparation_status: "VERIFIED", row_version: 4 })], {
  preparation_id: PREP_ID,
});
await expectFailure(
  () => saveQcPreparation({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 4,
    lastReadStatus: null,
    payload: {},
    callRpc: verifiedOnServer.callRpc,
  }),
  ERROR_KINDS.PREFLIGHT_DENIED,
);
assert(verifiedOnServer.calls.length === 1, "server-verified row makes no save call");
assert(verifiedOnServer.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "server-verified refusal reads first");

const mismatch = readThenSave([preparationRow({ row_version: 2 })], { preparation_id: PREP_ID });
const mismatchError = await expectFailure(
  () => saveQcPreparation({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 1,
    payload: {},
    callRpc: mismatch.callRpc,
  }),
  ERROR_KINDS.STALE,
);
assert(mismatchError?.message === "Server copy changed — reload to compare; nothing was overwritten.", "version mismatch stays stale");
assert(mismatch.calls.length === 1 && mismatch.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "version mismatch makes no save call");

const already = readThenSave([preparationRow()], { preparation_id: PREP_ID });
const alreadyError = await expectFailure(
  () => saveQcPreparation({
    productId: 262,
    accessToken: TOKEN,
    preparationId: null,
    expectedRowVersion: 0,
    payload: {},
    callRpc: already.callRpc,
  }),
  ERROR_KINDS.STALE,
);
assert(alreadyError?.message === "A QC preparation already exists — reload.", "create finds the existing preparation");
assert(already.calls.length === 1 && already.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "existing preparation makes no save call");

const helperSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-preparation-workspace.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const forbidden = [
  "qc_preparation_verify_v1",
  "qc_report_reserve_v1",
  "qc_report_register_v1",
  "storage.from",
  "service_role",
  "SaveData",
];
for (const name of forbidden) assert(!helperSrc.includes(name), `workspace helper does not reference ${name}`);
assert(!/term_id:\s*(11|12|13|14|161)\b/.test(helperSrc), "worker source does not hard-code protocol term ids");
for (const channel of [
  "CHANNELS.QC_PROTOCOL_OPTIONS,",
  "CHANNELS.QC_PREPARATION_WORKSPACE_READ,",
  "CHANNELS.QC_PREPARATION_REVIEW,",
  "CHANNELS.QC_PREPARATION_SAVE,",
]) {
  const start = ipcSrc.indexOf(channel);
  const nextHandler = ipcSrc.indexOf("ipcMain.handle", start + channel.length);
  const slice = ipcSrc.slice(start, nextHandler === -1 ? ipcSrc.indexOf("return worker;", start) : nextHandler);
  assert(slice.includes("withRendererGuard"), `${channel} is renderer-guarded`);
  assert(slice.includes("validateProductId"), `${channel} validates product id`);
  assert(slice.includes("validateAccessToken"), `${channel} validates the session token`);
  assert(slice.includes("callRpc: callWorkerRpc"), `${channel} uses the user-scoped RPC client`);
  for (const name of forbidden) assert(!slice.includes(name), `${channel} does not reference ${name}`);
}
assert(preloadSrc.includes("eaushadhi-worker:qc-protocol-options"), "preload maps protocol options");
assert(preloadSrc.includes("eaushadhi-worker:qc-preparation-workspace-read"), "preload maps workspace read");
assert(preloadSrc.includes("eaushadhi-worker:qc-preparation-review"), "preload maps review");
assert(preloadSrc.includes("eaushadhi-worker:qc-preparation-save"), "preload maps save");
assert(controlSrc.includes("Expected to report a non-empty list after the first preparation is saved."), "read probe explains the future non-empty list");
const ui = controlSrc.slice(controlSrc.indexOf("function emptyQcPrepForm"), controlSrc.indexOf("function workerFoundationSummary"));
for (const name of forbidden) assert(!ui.includes(name), `workspace UI does not reference ${name}`);
assert(ui.includes("request !== qcPrepCurrent() || state.selectedProductId !== productId"), "late workspace result is discarded after a product switch");
assert(ui.includes("QC preparation is available only in the SASV Electron app."), "PWA has no writable QC preparation form");
assert(ui.includes('study_start_date: ""') && ui.includes('report_date: ""'), "form dates start empty");
assert(!ui.includes("qc_preparation_verify_v1"), "UI does not call source verify");
const saveFn = ui.slice(ui.indexOf("async function submitQcPreparationSave"), ui.indexOf("function workerFoundationSummary"));
assert(saveFn.includes("reloadQcPreparationWorkspace()"), "successful save reloads the server copy");
assert(!saveFn.includes("draft_payload:"), "successful save does not keep an un-normalised local copy");
const fieldFn = ui.slice(ui.indexOf("function onQcPrepField"), ui.indexOf("async function submitQcPreparationReview"));
assert(fieldFn.includes("state.qcPrepReasons = []"), "form edits clear the previous server reasons");

globalThis.window = {};
const client = await import(pathToFileURL(join(root, "public/shared/js/eaushadhi-review-worker-client.js")).href);
const pwa = await client.saveQcPreparation(262, TOKEN, { expectedRowVersion: 0, payload: {} });
assert(pwa?.errorKind === "UNSUPPORTED_PLATFORM", "PWA save has no writable fallback");

if (failed) {
  console.error(`\n${failed} qc preparation workspace assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-preparation-workspace-smoke: all assertions passed");
