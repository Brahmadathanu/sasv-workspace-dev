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
  QC_LABORATORY_OPTIONS_RPC,
  QC_PREPARATION_WORKSPACE_READ_RPC,
  QC_PREPARATION_REVIEW_RPC,
  QC_PREPARATION_SAVE_RPC,
  QC_PREPARATION_SOURCE_KEY,
  QC_CANONICAL_REPORT_FILENAME,
  normalizeQcPayload,
  assessQcBatchText,
  assertLaboratoryOptions,
  qcOtherProtocolTextAccepted,
  loadQcProtocolOptions,
  loadQcLaboratoryOptions,
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
  await expectFailure(
    () => loadQcLaboratoryOptions({ productId, accessToken: TOKEN, callRpc: blocked.callRpc }),
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
  payload: { report_filename: "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf" },
  callRpc: created.callRpc,
});
assert(created.calls[0].name === QC_PREPARATION_WORKSPACE_READ_RPC, "create reads before saving");
assert(created.calls[1].name === QC_PREPARATION_SAVE_RPC, "create uses the save RPC");
assert(created.calls[1].args.p_preparation_id === null, "create sends a null preparation id");
assert(created.calls[1].args.p_expected_row_version === 0, "create sends expected version 0");
assert(created.calls[1].args.p_source_key === QC_PREPARATION_SOURCE_KEY, "create uses the fixed source key");
assert(created.calls[1].args.p_source_key === "manual-qc:262:primary", "source key is manual-qc:262:primary");
assert(created.calls[1].args.p_payload.report_filename === "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf", "create payload keeps the canonical report filename");

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
  "CHANNELS.QC_LABORATORY_OPTIONS,",
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
assert(preloadSrc.includes("loadQcLaboratoryOptions"), "preload maps laboratory options");
assert(preloadSrc.includes("eaushadhi-worker:qc-laboratory-options"), "preload maps the laboratory options channel");
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
const pwaLabs = await client.loadQcLaboratoryOptions(262, TOKEN);
assert(pwaLabs?.errorKind === "UNSUPPORTED_PLATFORM", "PWA laboratory options have no writable fallback");

const LAB_FIXTURE = [
  { portal_option_id: 526, external_id: "3980", label: "HARIDEV FORMULATIONS", portal_value: "HARIDEV FORMULATIONS" },
  { portal_option_id: 527, external_id: "3991", label: "BIOTECHAYUR PRIVATE LIMITED ", portal_value: "BIOTECHAYUR PRIVATE LIMITED " },
];
const acceptedLabs = assertLaboratoryOptions(LAB_FIXTURE);
assert(acceptedLabs[1].label === "BIOTECHAYUR PRIVATE LIMITED ", "laboratory labels keep a trailing space");
assert(acceptedLabs[1].portal_value === acceptedLabs[1].label, "portal value stays equal to the label");
const labLoad = mockRpc(async () => LAB_FIXTURE);
const loadedLabs = await loadQcLaboratoryOptions({ productId: 262, accessToken: TOKEN, callRpc: labLoad.callRpc });
assert(loadedLabs.operation === "qc-laboratory-options", "laboratory options operation name");
assert(loadedLabs.mutated === false, "laboratory options do not mutate");
assert(labLoad.calls[0].name === QC_LABORATORY_OPTIONS_RPC, "laboratory RPC name is exact");
assert(JSON.stringify(labLoad.calls[0].args) === "{}", "laboratory RPC takes no arguments");
for (const [label, data] of [
  ["portal value mismatch", [{ ...LAB_FIXTURE[0], portal_value: "HARIDEV FORMULATIONS " }]],
  ["non-digit external id", [{ ...LAB_FIXTURE[0], external_id: "3980a" }]],
  ["duplicate labels", [LAB_FIXTURE[0], { ...LAB_FIXTURE[0], portal_option_id: 528, external_id: "3992" }]],
  ["non-array", { options: LAB_FIXTURE }],
]) {
  await expectFailure(async () => assertLaboratoryOptions(data), ERROR_KINDS.CONTRACT_INCOMPLETE);
  assert(true, `${label} is rejected`);
}

function controlFunction(name) {
  const start = controlSrc.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} is defined`);
  const brace = controlSrc.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < controlSrc.length; index += 1) {
    const char = controlSrc[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = controlSrc.slice(start, index + 1);
        return new Function(`${body}; return ${name};`)();
      }
    }
  }
  throw new Error(`could not extract ${name}`);
}

const applyDefaults = controlFunction("applyQcPreparationDefaults");
const renderQc = controlFunction("qcPrepWorkspaceHtml");
const emptyPrepForm = {
  testing_protocol_term_id: "",
  other_testing_protocol_text: "",
  study_start_date: "",
  study_end_date: "",
  date_basis: "",
  date_evidence_note: "",
  shelf_life_months: "",
  batches: "",
  report_date: "",
  report_date_evidence_note: "",
  quality_control_mode: "",
  source_report_issuer: "",
  source_report_approval_no: "",
  portal_laboratory_candidate: "",
  report_filename: "",
  report_sha256: "",
  report_evidence_note: "",
};
const defaultProtocols = [
  { term_id: 77, code: "OTHER", label: "Others" },
  { term_id: 11, code: "ACCELERATED_3_MONTH", label: "(3) Month Accelerated Stability" },
];
const defaultsOn = applyDefaults({ ...emptyPrepForm }, {
  productId: 262,
  hasPreparation: false,
  dirty: false,
  formEmpty: true,
  protocolOptions: defaultProtocols,
  laboratoryOptions: LAB_FIXTURE,
});
assert(defaultsOn.applied === true && defaultsOn.save === false, "defaults apply on an empty Product 262 form and do not save");
assert(defaultsOn.form.testing_protocol_term_id === "77", "default protocol is chosen by code OTHER");
assert(defaultsOn.form.other_testing_protocol_text === "Cross Sectional Approach (API Vol VIII Page No:226)", "default other-protocol text is exact");
assert(defaultsOn.form.date_basis === "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN", "default date basis is the cross-sectional value");
assert(defaultsOn.form.shelf_life_months === "36", "default shelf life is 36");
assert(defaultsOn.form.quality_control_mode === "OUT", "default laboratory status is OUT");
assert(defaultsOn.form.portal_laboratory_candidate === "HARIDEV FORMULATIONS", "Haridev is the default only when that label is listed");
for (const key of ["study_start_date", "study_end_date", "report_date", "batches", "report_sha256", "source_report_issuer", "source_report_approval_no", "date_evidence_note", "report_date_evidence_note", "report_evidence_note"]) {
  assert(defaultsOn.form[key] === "", `defaults do not prefill ${key}`);
}
const draftForm = { ...emptyPrepForm, shelf_life_months: "12", batches: "B9", study_start_date: "2020-01-01", report_sha256: "" };
const defaultsOverDraft = applyDefaults(draftForm, {
  productId: 262,
  hasPreparation: true,
  dirty: false,
  formEmpty: false,
  protocolOptions: defaultProtocols,
  laboratoryOptions: LAB_FIXTURE,
});
assert(defaultsOverDraft.applied === false && defaultsOverDraft.save === false, "defaults are not applied over a loaded draft and do not save");
assert(defaultsOverDraft.form.shelf_life_months === "12" && defaultsOverDraft.form.batches === "B9", "loaded draft values stay in place");
assert(defaultsOverDraft.form.study_start_date === "2020-01-01", "loaded draft dates stay in place");
const defaultsDirty = applyDefaults({ ...emptyPrepForm, shelf_life_months: "24" }, {
  productId: 262,
  hasPreparation: false,
  dirty: true,
  formEmpty: false,
  protocolOptions: defaultProtocols,
  laboratoryOptions: LAB_FIXTURE,
});
assert(defaultsDirty.applied === false && defaultsDirty.form.shelf_life_months === "24", "defaults are not applied over operator edits");
const defaultsNoLab = applyDefaults({ ...emptyPrepForm }, {
  productId: 262,
  hasPreparation: false,
  dirty: false,
  formEmpty: true,
  protocolOptions: defaultProtocols,
  laboratoryOptions: [{ label: "SOME OTHER LAB" }],
});
assert(defaultsNoLab.form.portal_laboratory_candidate === "", "Haridev is left empty when that label is absent");
const defaultsOtherProduct = applyDefaults({ ...emptyPrepForm }, {
  productId: 261,
  hasPreparation: false,
  dirty: false,
  formEmpty: true,
  protocolOptions: defaultProtocols,
  laboratoryOptions: LAB_FIXTURE,
});
assert(defaultsOtherProduct.applied === false, "defaults are not applied for another product");
const loadFn = controlSrc.slice(controlSrc.indexOf("async function loadQcPreparationWorkspace"), controlSrc.indexOf("function reloadQcPreparationWorkspace"));
assert(!loadFn.includes("saveQcPreparation"), "loading a preparation does not save");
assert(qcOtherProtocolTextAccepted("Cross Sectional Approach (API Vol VIII Page No:226)"), "default other-protocol text matches the portal regex");
assert(!qcOtherProtocolTextAccepted("A".repeat(126)), "126-character other-protocol text is rejected");
assert(!qcOtherProtocolTextAccepted("A#B"), "other-protocol text rejects a hash character");

async function savePayload(payload, rows = []) {
  const rpc = mockRpc(async (_token, name) => {
    if (name === QC_PREPARATION_WORKSPACE_READ_RPC) return rows;
    if (name === QC_LABORATORY_OPTIONS_RPC) return LAB_FIXTURE;
    if (name === QC_PREPARATION_SAVE_RPC) {
      return { preparation_id: PREP_ID, row_version: 1, preparation_status: "PREPARING", review: { reasons: [] } };
    }
    throw new Error(`unexpected rpc ${name}`);
  });
  let error = null;
  try {
    await saveQcPreparation({
      productId: 262,
      accessToken: TOKEN,
      preparationId: null,
      expectedRowVersion: 0,
      payload,
      callRpc: rpc.callRpc,
    });
  } catch (caught) {
    error = caught;
  }
  return { rpc, error };
}

for (const [start, end, report, ok] of [
  ["2026-01-01", "2026-01-01", "2026-01-02", false],
  ["2026-01-02", "2026-01-01", "2026-01-03", false],
  ["2026-01-01", "2026-01-02", "2026-01-01", false],
  ["2026-01-01", "2026-01-02", "2026-01-02", true],
]) {
  const outcome = await savePayload({ study_start_date: start, study_end_date: end, report_date: report });
  const saved = outcome.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC);
  assert(saved === ok, `dates ${start} / ${end} / ${report} ${ok ? "are accepted" : "are rejected with no save RPC"}`);
}

for (const text of ["A101", "A101,A102", "KT-01/26,KT.02_x"]) {
  const assessed = assessQcBatchText(text);
  assert(assessed.ok === true, `batch text ${text} is accepted`);
  const outcome = await savePayload({ batches: assessed.batches });
  const saveCall = outcome.rpc.calls.find((call) => call.name === QC_PREPARATION_SAVE_RPC);
  assert(saveCall, `batch text ${text} is saved`);
  assert(JSON.stringify(saveCall.args.p_payload.batches) === JSON.stringify(assessed.batches), `batch text ${text} is sent in order`);
}
for (const text of ["A101, A102", "A101,,A102", ",A101", "A101,", "A101,A101", "A 101", "A#1", "A", "B".repeat(257)]) {
  const assessed = assessQcBatchText(text);
  assert(assessed.ok === false && assessed.hint === "BATCH_FORMAT_INVALID", `batch text ${text} is rejected`);
  const outcome = await savePayload({ batches: text.split(",").map((batch_no) => ({ batch_no })) });
  assert(!outcome.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), `batch text ${text} makes no save RPC`);
}

for (const shelf of ["0", "-1", "1.5", "abc"]) {
  const outcome = await savePayload({ shelf_life_months: shelf });
  assert(!outcome.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), `shelf life ${shelf} makes no save RPC`);
}
const shelfOk = await savePayload({ shelf_life_months: "36" });
const shelfSave = shelfOk.rpc.calls.find((call) => call.name === QC_PREPARATION_SAVE_RPC);
assert(shelfSave?.args?.p_payload?.shelf_life_months === 36, "shelf life 36 is sent as a number");

const outEmpty = await savePayload({ quality_control_mode: "OUT" });
assert(!outEmpty.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "OUT with an empty laboratory makes no save RPC");
const unknownLab = await savePayload({ portal_laboratory_candidate: "NOT A REAL LABORATORY" });
assert(unknownLab.rpc.calls.some((call) => call.name === QC_LABORATORY_OPTIONS_RPC), "an unknown laboratory checks a fresh list");
assert(!unknownLab.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "an unknown laboratory makes no save RPC");
assert(unknownLab.error?.details?.code === "PORTAL_LABORATORY_CANDIDATE_UNKNOWN", "unknown laboratory uses its local code");
const spacedLab = "BIOTECHAYUR PRIVATE LIMITED ";
const exactLab = await savePayload({ portal_laboratory_candidate: spacedLab });
const exactSave = exactLab.rpc.calls.find((call) => call.name === QC_PREPARATION_SAVE_RPC);
assert(exactSave?.args?.p_payload?.portal_laboratory_candidate === spacedLab, "a trailing-space laboratory label is sent byte-exact");
assert(!Object.hasOwn(exactSave.args.p_payload, "external_id"), "external id is not a payload key");
assert(!JSON.stringify(exactSave.args.p_payload).includes("3991"), "external id is never sent in the payload");
const trimmedLab = await savePayload({ portal_laboratory_candidate: "BIOTECHAYUR PRIVATE LIMITED" });
assert(!trimmedLab.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "a trimmed laboratory label is rejected as unknown");
const badName = await savePayload({ report_filename: "claim.pdf" });
assert(!badName.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "a non-canonical report filename makes no save RPC");
const canonical = await savePayload({ report_filename: QC_CANONICAL_REPORT_FILENAME });
const canonicalSave = canonical.rpc.calls.find((call) => call.name === QC_PREPARATION_SAVE_RPC);
assert(canonicalSave?.args?.p_payload?.report_filename === QC_CANONICAL_REPORT_FILENAME, "the canonical report filename is sent");
assert(controlSrc.includes("payload.report_filename = QC_PREP_CANONICAL_REPORT_FILENAME"), "every form payload assigns the canonical report filename");

const html = renderQc({
  open: true,
  status: "No QC preparation saved yet.",
  verified: false,
  disabled: "",
  notice: "",
  defaultsNote: true,
  labsUnavailable: false,
  fieldsComplete: true,
  reasons: [],
  showOther: true,
  protocolOptions: defaultProtocols,
  protocolId: "77",
  savedProtocolMissing: false,
  otherText: "Cross Sectional Approach (API Vol VIII Page No:226)",
  studyStart: "",
  studyEnd: "",
  reportDate: "",
  dateBasis: "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN",
  dateBasisSelected: true,
  dateNote: "",
  reportDateNote: "",
  shelf: "36",
  batches: "A101,A102",
  mode: "OUT",
  issuer: "",
  approval: "",
  lab: "HARIDEV FORMULATIONS",
  labs: LAB_FIXTURE,
  sha: "",
  evidence: "",
  reviewDisabled: false,
  saveDisabled: false,
  reloadDisabled: false,
});
assert(!html.includes("READY"), "rendered QC markup does not contain READY");
assert(html.includes("Fields complete (draft only)"), "rendered QC markup says the draft fields are complete");
for (const item of [
  "C2 — Lab report PDF uploaded (PDF, ≤ 2 MB)",
  "B1/B2 — Report registered and bytes verified",
  "B3 — Evidence governance accepted",
  "B4 — QC portal readiness confirmed",
  "Portal entry (manual, later)",
]) {
  assert(html.includes(`${item} — not done`), `checklist marks ${item} not done`);
}
assert(html.includes("Issuing lab Form-48 approval no. (evidence only; not sent to portal)"), "Form-48 label text is exact");
assert(html.includes("portal id 3980"), "the selected laboratory shows its portal id");
const unavailableHtml = renderQc({
  open: true,
  status: "No QC preparation saved yet.",
  verified: false,
  disabled: " disabled",
  notice: "",
  defaultsNote: false,
  labsUnavailable: true,
  fieldsComplete: false,
  reasons: [],
  showOther: false,
  protocolOptions: [],
  protocolId: "",
  savedProtocolMissing: false,
  otherText: "",
  studyStart: "",
  studyEnd: "",
  reportDate: "",
  dateBasis: "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN",
  dateBasisSelected: false,
  dateNote: "",
  reportDateNote: "",
  shelf: "",
  batches: "",
  mode: "",
  issuer: "",
  approval: "",
  lab: "",
  labs: [],
  sha: "",
  evidence: "",
  reviewDisabled: false,
  saveDisabled: true,
  reloadDisabled: false,
});
assert(unavailableHtml.includes("Laboratory list unavailable"), "rendered markup says the laboratory list is unavailable");
assert(!unavailableHtml.includes("READY"), "unavailable markup does not contain READY");
assert(controlSrc.includes("Laboratory list unavailable"), "laboratory list failure copy is present");
assert(controlSrc.includes("Defaults filled — review every value before saving."), "defaults note copy is present");
assert(!helperSrc.includes("qc_preparation_verify_v1"), "workspace helper does not call verify");
assert(!helperSrc.includes("qc_report_reserve_v1") && !helperSrc.includes("qc_report_register_v1"), "workspace helper does not reserve or register");
assert(!helperSrc.includes("storage.from"), "workspace helper does not call storage");

const feedbackHtml = renderQc({
  open: true,
  status: "No QC preparation saved yet.",
  verified: false,
  disabled: "",
  notice: "Server review found items to complete.",
  defaultsNote: false,
  labsUnavailable: false,
  fieldsComplete: false,
  reasons: ["Testing protocol is required.", "Study end date must be after the study start date."],
  serverReasons: ["Testing protocol is required."],
  localHints: ["Study end date must be after the study start date."],
  showOther: false,
  protocolOptions: [],
  protocolId: "",
  savedProtocolMissing: false,
  otherText: "",
  studyStart: "2026-01-02",
  studyEnd: "2026-01-02",
  reportDate: "2026-01-01",
  dateBasis: "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN",
  dateBasisSelected: false,
  dateNote: "",
  reportDateNote: "",
  shelf: "",
  batches: "",
  mode: "",
  issuer: "",
  approval: "",
  lab: "",
  labs: [],
  sha: "",
  evidence: "",
  reviewDisabled: false,
  saveDisabled: false,
  reloadDisabled: false,
});
const resultAt = feedbackHtml.indexOf('id="qcPrepResult"');
const reviewAt = feedbackHtml.indexOf('id="btnQcPrepReview"');
assert(resultAt >= 0 && reviewAt > resultAt, "result panel is directly above the review button");
const panel = feedbackHtml.slice(resultAt, reviewAt);
const serverHeading = panel.indexOf('<h4 class="meta-label">Server review</h4>');
const formHeading = panel.indexOf('<h4 class="meta-label">Form checks</h4>');
const serverItem = panel.indexOf("Testing protocol is required.");
const localItem = panel.indexOf("Study end date must be after the study start date.");
assert(serverHeading >= 0 && formHeading > serverHeading, "result panel lists server reasons and form checks separately");
assert(serverItem > serverHeading && serverItem < formHeading, "server reasons stay under Server review");
assert(localItem > formHeading, "local hints stay under Form checks");
assert(feedbackHtml.includes("Server review found items to complete."), "result panel shows the current notice");
const endField = feedbackHtml.indexOf('id="qcPrepEnd"');
const dateOrder = feedbackHtml.indexOf('id="qcPrepDateOrder"');
const reportField = feedbackHtml.indexOf('id="qcPrepReportDate"');
assert(endField >= 0 && dateOrder > endField && dateOrder < reportField, "date-order message renders under the dates when end is not after start");
assert(feedbackHtml.slice(dateOrder, reportField).includes("Study end date must be after the study start date."), "date-order copy sits with the study dates");
assert(feedbackHtml.includes("Report date must be on or after the study end date."), "report-date order message renders under the report date");
assert(!feedbackHtml.includes("READY"), "QC feedback markup does not contain READY");
assert(controlSrc.includes('state.qcPrepNotice = "Server copy reloaded."'), "reload success notice reads Server copy reloaded.");
const releaseBusy = controlFunction("releaseQcPrepReviewBusy");
const staleReview = releaseBusy({ ownsBusy: true, busy: true, selectedProductId: 261, productId: 262 });
assert(staleReview.busy === false, "busy flag is released after a stale review");
assert(staleReview.render === false, "a stale product is not rendered");
assert(controlSrc.includes("event.type === \"change\" && liveField"), "live field edits re-render on change only");

const batchFormatCopy = "Batch numbers must be comma-separated, with no spaces or duplicates, and 2–256 characters.";
const spacedBatches = renderQc({ batches: "A101, A102", open: true });
const batchInputAt = spacedBatches.indexOf('id="qcPrepBatches"');
const batchNoteAt = spacedBatches.indexOf('id="qcPrepBatchFormat"');
const modeAt = spacedBatches.indexOf('id="qcPrepModeIn"');
assert(batchInputAt >= 0 && batchNoteAt > batchInputAt && batchNoteAt < modeAt, "invalid batch text renders the format message immediately after the batch input");
assert(!spacedBatches.slice(batchInputAt, batchNoteAt).includes("<input id="), "no other input sits between the batch field and its message");
assert(spacedBatches.slice(batchNoteAt, modeAt).includes(batchFormatCopy), "the batch message uses the batch-format wording");
const spacedPanel = spacedBatches.slice(spacedBatches.indexOf('id="qcPrepResult"'), spacedBatches.indexOf('id="btnQcPrepReview"'));
const spacedChecks = spacedPanel.slice(spacedPanel.indexOf("Form checks"));
assert(spacedChecks.includes(batchFormatCopy), "Form checks still lists the batch message");
assert(spacedBatches.includes('value="A101, A102"'), "the raw batch string survives re-render and esc");
const cleanBatches = renderQc({ batches: "A101,A102", open: true });
assert(!cleanBatches.includes('id="qcPrepBatchFormat"'), "valid batch text has no message under the field");
const cleanChecks = cleanBatches.slice(cleanBatches.indexOf("Form checks"), cleanBatches.indexOf('id="btnQcPrepReview"'));
assert(!cleanChecks.includes(batchFormatCopy), "valid batch text is absent from Form checks");
assert(controlSrc.includes('form.batches = qcPrepReadField("qcPrepBatches")'), "sync keeps the raw batch string");
const syncFn = controlSrc.slice(controlSrc.indexOf("function syncQcPrepFormFromDom"), controlSrc.indexOf("function onQcPrepField"));
assert(!/form\.batches\s*=\s*[^;\n]*\.trim\(/.test(syncFn), "sync does not trim the batch string");
assert(controlSrc.includes('value="${esc(model.batches)}"'), "re-render writes the raw batch string through esc");
assert(controlSrc.includes('payload.batches = batchText.split(",").map((batch_no) => ({ batch_no }))'), "batch splitting stays in the payload builder");

const fieldChange = controlSrc.slice(controlSrc.indexOf("function onQcPrepField"), controlSrc.indexOf("function releaseQcPrepReviewBusy"));
assert(!fieldChange.includes("revealQcPrepResult"), "the field-change path does not call revealQcPrepResult");
assert(!fieldChange.includes("scrollIntoView"), "the field-change path does not scroll");
assert(!fieldChange.includes("getElementById(target.id)") && !fieldChange.includes("getElementById(changedId)"), "the field-change path never focuses the changed field");
assert(fieldChange.includes("event.relatedTarget?.id") && fieldChange.includes("document.activeElement"), "the field-change path uses relatedTarget or the active element");
assert(fieldChange.includes("qcPrepPendingFocusId") && fieldChange.includes("qcPrepTabDirection"), "the field-change path keeps the recorded destination and Tab direction");
assert(fieldChange.includes("neighbor.focus({ preventScroll: false })"), "Tab moves to the next or previous focusable element");
assert(fieldChange.includes("destinationId !== changedId") && fieldChange.includes("neighbor.id === changedId"), "a recorded destination or Tab neighbor is never the field just left");
const revealUses = [...controlSrc.matchAll(/revealQcPrepResult\(([^)]*)\)/g)].map((match) => match[1]).filter((arg) => arg !== "focusId");
assert(revealUses.length === 3 && revealUses.every((arg) => arg === '"btnQcPrepReview"' || arg === '"btnQcPrepReload"'), "revealQcPrepResult stays on Check and Reload only");
assert(revealUses.includes('"btnQcPrepReview"') && revealUses.includes('"btnQcPrepReload"'), "Check and Reload still reveal their result");
assert(controlSrc.includes('qcPrepPendingFocusId = event.relatedTarget?.id || ""'), "focusout records the destination id");
assert(controlSrc.includes("qcPrepTabDirection = event.shiftKey ? -1 : 1"), "keydown records the Tab direction");

function extractFunction(name) {
  const start = controlSrc.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} is defined`);
  const brace = controlSrc.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < controlSrc.length; index += 1) {
    const char = controlSrc[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return controlSrc.slice(start, index + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

const onField = controlSrc.slice(controlSrc.indexOf("function onQcPrepField"), controlSrc.indexOf("function focusQcPrepFieldChangeDestination"));
const liveList = onField.slice(onField.indexOf("const liveField"), onField.indexOf("if (event.type === \"change\" && liveField)"));
assert(!liveList.includes("qcPrepStart") && !liveList.includes("qcPrepEnd") && !liveList.includes("qcPrepReportDate"), "date fields are not in the live re-render list");
const datePath = onField.slice(onField.indexOf('target.id === "qcPrepStart"'), onField.indexOf("state.qcPrepReasons"));
assert(datePath.includes("event.type === \"input\" || event.type === \"change\"") && datePath.includes("return"), "date input and change return after sync");
assert(!datePath.includes("renderReadiness") && !datePath.includes("focus") && !datePath.includes("scrollIntoView"), "date input and change do not re-render, focus, or scroll");
const focusoutAt = controlSrc.indexOf('addEventListener("focusout"');
const focusout = controlSrc.slice(focusoutAt, controlSrc.indexOf('addEventListener("keydown"', focusoutAt));
assert(focusout.includes("updateQcPrepDateMessages()") && focusout.includes("event.relatedTarget !== event.target"), "date blur calls updateQcPrepDateMessages");
assert(!focusout.includes("renderReadiness"), "date blur does not re-render");
const updater = extractFunction("updateQcPrepDateMessages");
assert(updater.includes('getElementById("qcPrepDateOrder")') && updater.includes('getElementById("qcPrepReportDateOrder")') && updater.includes('getElementById("qcPrepFormChecks")'), "date blur updates the inline messages and Form checks in place");
assert(!updater.includes("renderReadiness") && !updater.includes(".focus(") && !updater.includes("scrollIntoView"), "the date-message update does not re-render, focus, or scroll");

const dateMessagesApi = new Function(
  "const state = { qcPrepOptions: [], qcPrepLabs: [], qcPrepLabsUnavailable: false };\n"
  + "function qcPrepProtocolCode() { return \"\"; }\n"
  + "function qcPrepBatchTextInvalid() { return false; }\n"
  + "function qcPrepReasonText(code) {\n"
  + "  const labels = {\n"
  + "    STUDY_END_NOT_AFTER_START: \"Study end date must be after the study start date.\",\n"
  + "    REPORT_DATE_BEFORE_STUDY_END: \"Report date must be on or after the study end date.\",\n"
  + "    REPORT_DATE_BEFORE_STUDY_START: \"Report date is before the study start date.\",\n"
  + "  };\n"
  + "  return labels[code] || String(code);\n"
  + "}\n"
  + "const endEl = { textContent: \"\", hidden: true };\n"
  + "const reportEl = { textContent: \"\", hidden: true };\n"
  + "const checks = { children: [], replaceChildren() { this.children = []; }, append(node) { this.children.push(node); } };\n"
  + "const document = {\n"
  + "  getElementById(id) {\n"
  + "    if (id === \"qcPrepDateOrder\") return endEl;\n"
  + "    if (id === \"qcPrepReportDateOrder\") return reportEl;\n"
  + "    if (id === \"qcPrepFormChecks\") return checks;\n"
  + "    return null;\n"
  + "  },\n"
  + "  createElement(tag) {\n"
  + "    return { tag, className: \"\", textContent: \"\", children: [], append(node) { this.children.push(node); } };\n"
  + "  },\n"
  + "};\n"
  + extractFunction("qcPrepDateOrderMessages") + "\n"
  + extractFunction("qcPrepLocalHints") + "\n"
  + updater + "\n"
  + "return { qcPrepDateOrderMessages, qcPrepLocalHints, updateQcPrepDateMessages, endEl, reportEl, checks };",
)();
const endCopy = "Study end date must be after the study start date.";
const reportCopy = "Report date must be on or after the study end date.";
const sameDay = dateMessagesApi.qcPrepDateOrderMessages("2026-01-02", "2026-01-02", "2026-01-03");
assert(sameDay.end === endCopy && sameDay.report === "", "an end date equal to the start gives the end message");
const earlyReport = dateMessagesApi.qcPrepDateOrderMessages("2026-01-01", "2026-01-03", "2026-01-02");
assert(earlyReport.report === reportCopy && earlyReport.end === "", "a report date before the end gives the report message");
const orderedDates = dateMessagesApi.qcPrepDateOrderMessages("2026-01-01", "2026-01-02", "2026-01-02");
assert(orderedDates.end === "" && orderedDates.report === "", "valid dates give empty date messages");
const partialYearMessages = dateMessagesApi.qcPrepDateOrderMessages("0002-10-01", "0002-10-01", "0001-01-01");
assert(partialYearMessages.end === "" && partialYearMessages.report === "" && partialYearMessages.beforeStart === false, "a year before 1900 gives no date message");
const hintForm = {
  batches: "",
  shelf_life_months: "",
  quality_control_mode: "",
  portal_laboratory_candidate: "",
  other_testing_protocol_text: "",
};
const partialHints = dateMessagesApi.qcPrepLocalHints({
  ...hintForm,
  study_start_date: "0002-10-01",
  study_end_date: "0002-10-01",
  report_date: "0001-01-01",
});
assert(!partialHints.includes("STUDY_END_NOT_AFTER_START") && !partialHints.includes("REPORT_DATE_BEFORE_STUDY_END") && !partialHints.includes("REPORT_DATE_BEFORE_STUDY_START"), "qcPrepLocalHints gives no date hints for a year before 1900");
dateMessagesApi.updateQcPrepDateMessages({ ...hintForm, study_start_date: "2026-01-02", study_end_date: "2026-01-02", report_date: "2026-01-03" });
assert(dateMessagesApi.endEl.textContent === endCopy && dateMessagesApi.endEl.hidden === false, "blur shows the end message in place");
assert(dateMessagesApi.reportEl.textContent === "" && dateMessagesApi.reportEl.hidden === true, "blur hides an empty report message");
assert(dateMessagesApi.checks.children.some((node) => node.children?.some((item) => item.textContent === endCopy)), "blur updates the Form checks list in place");
dateMessagesApi.updateQcPrepDateMessages({ ...hintForm, study_start_date: "2026-01-01", study_end_date: "2026-01-03", report_date: "2026-01-02" });
assert(dateMessagesApi.reportEl.textContent === reportCopy && dateMessagesApi.reportEl.hidden === false, "blur shows the report message in place");
assert(dateMessagesApi.endEl.hidden === true, "blur hides an empty end message");
dateMessagesApi.updateQcPrepDateMessages({ ...hintForm, study_start_date: "2026-01-01", study_end_date: "2026-01-02", report_date: "2026-01-02" });
assert(dateMessagesApi.endEl.hidden === true && dateMessagesApi.reportEl.hidden === true, "valid dates leave both messages hidden");
dateMessagesApi.updateQcPrepDateMessages({ ...hintForm, study_start_date: "0002-10-01", study_end_date: "0002-10-01", report_date: "0001-01-01" });
assert(dateMessagesApi.endEl.textContent === "" && dateMessagesApi.reportEl.textContent === "" && dateMessagesApi.endEl.hidden === true && dateMessagesApi.reportEl.hidden === true, "an incomplete year shows no date message");
const bareDates = renderQc({ open: true });
assert(bareDates.includes('id="qcPrepDateOrder"') && bareDates.includes('id="qcPrepReportDateOrder"'), "markup always contains both date message elements");
const validDateMarkup = renderQc({ open: true, studyStart: "2026-01-01", studyEnd: "2026-01-02", reportDate: "2026-01-02" });
assert(validDateMarkup.includes('id="qcPrepDateOrder" hidden') && validDateMarkup.includes('id="qcPrepReportDateOrder" hidden'), "valid dates keep both date messages hidden");

if (failed) {
  console.error(`\n${failed} qc preparation workspace assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-preparation-workspace-smoke: all assertions passed");
