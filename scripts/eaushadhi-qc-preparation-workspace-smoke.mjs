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
assert(saveFn.includes("reloadQcPreparationWorkspace({ preserveNotice: notice })"), "successful save reloads the server copy");
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
assert(defaultsOn.form.source_report_issuer === "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)", "an empty Product 262 form defaults the issuer to NUPAL");
for (const key of ["study_start_date", "study_end_date", "report_date", "batches", "report_sha256", "source_report_approval_no", "date_evidence_note", "report_date_evidence_note", "report_evidence_note"]) {
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
assert(defaultsOverDraft.form.source_report_issuer === "", "a loaded preparation keeps its saved issuer");
const otherProductDefaults = applyDefaults({ ...emptyPrepForm }, {
  productId: 261,
  hasPreparation: false,
  dirty: false,
  formEmpty: true,
  protocolOptions: defaultProtocols,
  laboratoryOptions: LAB_FIXTURE,
});
assert(otherProductDefaults.applied === false && otherProductDefaults.form.source_report_issuer === "", "the issuer default is only for an empty Product 262 form");
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
  "B3 — Evidence governance accepted",
  "B4 — QC portal readiness confirmed",
  "Portal entry (manual, later)",
]) {
  assert(html.includes(`${item} — not done`), `checklist marks ${item} not done`);
}
assert(html.includes("B1: Report registered"), "checklist names B1");
assert(html.includes("B2: Server byte check: pending"), "checklist names a pending byte check");
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
assert(revealUses.length === 4 && revealUses.every((arg) => arg === '"btnQcPrepReview"' || arg === '"btnQcPrepReload"' || arg === '"btnQcPrepSave"'), "revealQcPrepResult stays on Check, Save, and Reload");
assert(revealUses.includes('"btnQcPrepReview"') && revealUses.includes('"btnQcPrepReload"') && revealUses.includes('"btnQcPrepSave"'), "Check, Save, and Reload reveal their result");
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
  + extractFunction("qcPrepDateYearImplausible") + "\n"
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
const implausibleChecks = dateMessagesApi.checks.children.flatMap((node) => (node.children || []).map((item) => item.textContent));
assert(implausibleChecks.includes("STUDY_START_DATE_REQUIRED_OR_INVALID") && implausibleChecks.includes("STUDY_END_DATE_REQUIRED_OR_INVALID") && implausibleChecks.includes("REPORT_DATE_REQUIRED_OR_INVALID"), "blur lists an implausible year in Form checks");
const bareDates = renderQc({ open: true });
assert(bareDates.includes('id="qcPrepDateOrder"') && bareDates.includes('id="qcPrepReportDateOrder"'), "markup always contains both date message elements");
const validDateMarkup = renderQc({ open: true, studyStart: "2026-01-01", studyEnd: "2026-01-02", reportDate: "2026-01-02" });
assert(validDateMarkup.includes('id="qcPrepDateOrder" hidden') && validDateMarkup.includes('id="qcPrepReportDateOrder" hidden'), "valid dates keep both date messages hidden");

async function withUtcYear(year, run) {
  const RealDate = globalThis.Date;
  const fixedMs = RealDate.UTC(year, 9, 11);
  function PatchedDate(...args) {
    if (!new.target) return RealDate(...args);
    if (args.length === 0) return new RealDate(fixedMs);
    return new RealDate(...args);
  }
  PatchedDate.now = () => fixedMs;
  PatchedDate.parse = RealDate.parse;
  PatchedDate.UTC = RealDate.UTC;
  PatchedDate.prototype = RealDate.prototype;
  globalThis.Date = PatchedDate;
  try {
    return await run();
  } finally {
    globalThis.Date = RealDate;
  }
}

await withUtcYear(2026, async () => {
  for (const key of ["study_start_date", "study_end_date", "report_date"]) {
    const outcome = await savePayload({ [key]: "0002-10-01" });
    assert(!outcome.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), `${key} 0002-10-01 makes no save RPC`);
    const normalized = normalizeQcPayload({ [key]: "0002-10-01" });
    const hint = `${key.toUpperCase()}_REQUIRED_OR_INVALID`;
    assert(normalized.hints.includes(hint), `${key} 0002-10-01 keeps the invalid-date hint`);
    assert(normalized.payload[key] === "0002-10-01", `${key} 0002-10-01 is not dropped`);
  }
  const nextYear = await savePayload({ study_start_date: "2027-12-31" });
  assert(nextYear.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "2027-12-31 is accepted when the current year is 2026");
  const tooFar = await savePayload({ study_start_date: "2028-01-01" });
  assert(!tooFar.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "2028-01-01 is blocked when the current year is 2026");
  assert(normalizeQcPayload({ study_start_date: "2028-01-01" }).hints.includes("STUDY_START_DATE_REQUIRED_OR_INVALID"), "2028-01-01 keeps the invalid-date hint");
  const past = await savePayload({ study_start_date: "2021-10-01" });
  assert(past.rpc.calls.some((call) => call.name === QC_PREPARATION_SAVE_RPC), "2021-10-01 is accepted");
  const farMessages = dateMessagesApi.qcPrepDateOrderMessages("2028-01-01", "2028-01-01", "2028-06-01");
  assert(farMessages.end === "" && farMessages.report === "", "a year after next year does not produce an order message");
  const farHints = dateMessagesApi.qcPrepLocalHints({ ...hintForm, study_start_date: "2028-01-01", study_end_date: "", report_date: "" });
  assert(farHints.includes("STUDY_START_DATE_REQUIRED_OR_INVALID") && !farHints.includes("STUDY_END_NOT_AFTER_START"), "2028-01-01 is a form check and not an order hint");
  const nextHints = dateMessagesApi.qcPrepLocalHints({ ...hintForm, study_start_date: "2027-12-31", study_end_date: "", report_date: "" });
  assert(!nextHints.includes("STUDY_START_DATE_REQUIRED_OR_INVALID"), "2027-12-31 is not a form-check hint when the current year is 2026");
  const pastHints = dateMessagesApi.qcPrepLocalHints({ ...hintForm, study_start_date: "2021-10-01", study_end_date: "", report_date: "" });
  assert(!pastHints.includes("STUDY_START_DATE_REQUIRED_OR_INVALID"), "2021-10-01 is not a form-check hint");
  const reasonText = controlFunction("qcPrepReasonText");
  assert(reasonText("STUDY_START_DATE_REQUIRED_OR_INVALID") === "Study start date must be a valid date (year 1900\u20132027).", "study start uses the year-range message");
  assert(reasonText("STUDY_END_DATE_REQUIRED_OR_INVALID") === "Study end date must be a valid date (year 1900\u20132027).", "study end uses the year-range message");
  assert(reasonText("REPORT_DATE_REQUIRED_OR_INVALID") === "Report date must be a valid date (year 1900\u20132027).", "report date uses the year-range message");
});

const htmlSrc = readFileSync(join(root, "public/shared/e-aushadhi-review-control.html"), "utf8");
const actionsTabAt = htmlSrc.indexOf('id="wf-tab-actions"');
const qcTabAt = htmlSrc.indexOf('id="wf-tab-qc"');
const evidenceTabAt = htmlSrc.indexOf('id="wf-tab-evidence"');
assert(actionsTabAt >= 0 && qcTabAt > actionsTabAt && evidenceTabAt > qcTabAt, "QC Register tab sits between Pharmacological Action and Evidence");
assert(htmlSrc.includes('id="tab-qc"') && htmlSrc.includes('aria-controls="tab-qc"'), "the QC panel and its tab control exist");
assert(controlSrc.includes('else if (tab === "qc") renderQc();'), "renderActiveTab routes the qc tab");
assert(controlSrc.includes('if (stage.id === "evidence") stages.push({ id: "qc", label: "QC Register" })'), "keyboard stage order inserts QC Register before Evidence");
const readinessFn = extractFunction("renderReadiness");
assert(readinessFn.includes('id="btnOpenQcTab"') && readinessFn.includes("Open QC Register"), "Readiness has an Open QC Register button");
const summaryFn = extractFunction("qcReadinessSummaryText");
assert(readinessFn.includes("qcReadinessSummaryText()") && summaryFn.includes("No QC preparation saved yet.") && summaryFn.includes("form checks open"), "Readiness shows the QC summary");
assert(!readinessFn.includes("qcPrepBatches") && !readinessFn.includes('type="date"') && !readinessFn.includes("qcPrepSha"), "Readiness has no QC inputs");
assert(controlSrc.includes('$("tab-qc")?.addEventListener("input", onQcPrepField)'), "QC input listener is on tab-qc");
assert(controlSrc.includes('$("tab-qc")?.addEventListener("change", onQcPrepField)'), "QC change listener is on tab-qc");
assert(controlSrc.includes('$("tab-qc")?.addEventListener("focusout"'), "QC focusout listener is on tab-qc");
assert(controlSrc.includes('$("tab-qc")?.addEventListener("keydown"'), "QC keydown listener is on tab-qc");
assert(controlSrc.includes('$("tab-qc")?.addEventListener("toggle"'), "QC toggle listener is on tab-qc");
assert(!controlSrc.includes('$("tab-readiness")?.addEventListener("input", onQcPrepField)'), "QC input listener is not on tab-readiness");
assert(!controlSrc.includes('$("tab-readiness")?.addEventListener("change", onQcPrepField)'), "QC change listener is not on tab-readiness");
const cardHtml = renderQc({
  open: true,
  lab: "HARIDEV FORMULATIONS",
  labs: LAB_FIXTURE,
  sha: "",
  dateNote: "",
  reportDateNote: "",
  evidence: "",
});
assert(cardHtml.includes("Study facts (sent to portal)"), "card A title is present");
assert(cardHtml.includes("Evidence &amp; notes (not sent to portal)"), "card B title is present");
assert(cardHtml.includes("Test report"), "card C title is present");
assert(cardHtml.includes('id="qcPrepPortalLab" class="form-span-2 qc-prep-lab-select"'), "the laboratory select is full width");
const fileAt = cardHtml.indexOf('id="qcPrepFileName"');
const shaAt = cardHtml.indexOf('id="qcPrepShaView"');
assert(fileAt >= 0 && shaAt > fileAt, "the filename and SHA rows are separate blocks");
assert(cardHtml.includes("File name: EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf"), "the filename row shows the canonical name");
assert(cardHtml.includes("SHA-256: computed at upload (D2)"), "an empty hash says it is computed at upload");
assert(!cardHtml.includes('id="qcPrepSha"'), "the SHA-256 text input is gone");
const shaHtml = renderQc({ open: true, sha: "ab".repeat(32), labs: [], lab: "" });
assert(shaHtml.includes(`SHA-256: ${"ab".repeat(32)}`), "a saved hash is shown read-only");

const notesApi = new Function(
  `const QC_PREP_BATCH_TEXT_RE = /^[A-Za-z0-9.\\/_-]+(?:,[A-Za-z0-9.\\/_-]+)*$/;
   ${extractFunction("qcPrepDateYearImplausible")}
   ${extractFunction("qcPrepBatchTextInvalid")}
   ${extractFunction("qcPrepFmtDate")}
   ${extractFunction("qcPrepGeneratedNotes")}
   ${extractFunction("qcPrepNoteOverridesForLoad")}
   ${extractFunction("qcPrepDisplayNotes")}
   return { qcPrepGeneratedNotes, qcPrepNoteOverridesForLoad, qcPrepDisplayNotes };`,
)();
const issuerName = "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)";
const noteSample = {
  testing_protocol_term_id: "77",
  other_testing_protocol_text: "Cross Sectional Approach (API Vol VIII Page No:226)",
  study_start_date: "2021-10-01",
  study_end_date: "2024-09-30",
  report_date: "2024-10-15",
  batches: "A101,A102",
  source_report_issuer: issuerName,
  report_sha256: "",
};
const noteOptions = [{ term_id: "77", code: "OTHER", label: "Others" }];
const generatedNotes = notesApi.qcPrepGeneratedNotes(noteSample, noteOptions);
const protocolJoin = "Others \u2013 Cross Sectional Approach (API Vol VIII Page No:226)";
assert(generatedNotes.date_evidence_note === `Study period 01-10-2021 to 30-09-2024 entered manually by the operator on the operator-reviewed cross-sectional manufacturing-span basis for batch(es) A101, A102; testing protocol: ${protocolJoin}. Dates are not derived automatically.`, "date evidence note matches the sample");
assert(generatedNotes.report_date_evidence_note === `Report date 15-10-2024 entered manually as printed on the QC test report issued by ${issuerName}.`, "report-date evidence note matches the sample");
assert(generatedNotes.report_evidence_note === `QC test report issued by ${issuerName}, dated 15-10-2024, covering batch(es) A101, A102; canonical file EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf; SHA-256 to be computed at upload (D2); report bytes not yet verified (B2).`, "report evidence note uses the D2 hash phrase when empty");
const hexSha = "0123456789abcdef".repeat(4);
const hashedNotes = notesApi.qcPrepGeneratedNotes({ ...noteSample, report_sha256: hexSha }, noteOptions);
assert(hashedNotes.report_evidence_note.includes(`SHA-256 ${hexSha}`), "report evidence note includes a saved 64-hex hash");
assert(notesApi.qcPrepGeneratedNotes({ ...noteSample, study_start_date: "" }, noteOptions).date_evidence_note === "", "a missing date input leaves the date note empty");
assert(notesApi.qcPrepGeneratedNotes({ ...noteSample, source_report_issuer: "  " }, noteOptions).report_date_evidence_note === "", "a missing issuer leaves the report-date note empty");
const edited = { ...noteSample, date_evidence_note: "Operator note" };
const editFlags = { date_evidence_note: true, report_date_evidence_note: false, report_evidence_note: false };
assert(notesApi.qcPrepDisplayNotes(edited, noteOptions, editFlags).date_evidence_note === "Operator note", "an Edit note override is kept");
assert(notesApi.qcPrepDisplayNotes({ ...edited, batches: "B200" }, noteOptions, editFlags).date_evidence_note === "Operator note", "an Edit note override survives a field change");
assert(notesApi.qcPrepDisplayNotes({ ...edited, batches: "B200" }, noteOptions, editFlags).report_evidence_note.includes("B200"), "a note that is not being edited regenerates");
const loadFlags = notesApi.qcPrepNoteOverridesForLoad({
  ...noteSample,
  date_evidence_note: "Saved custom",
  report_date_evidence_note: generatedNotes.report_date_evidence_note,
  report_evidence_note: "",
}, noteOptions);
assert(loadFlags.date_evidence_note === true, "a saved note that differs from the template is an override");
assert(loadFlags.report_date_evidence_note === false, "a saved note that matches the template stays generated");
assert(loadFlags.report_evidence_note === false, "an empty saved note stays generated");

const savedSha = "fedcba9876543210".repeat(4);
const payloadApi = new Function(
  `const QC_PREP_DATE_BASIS = "OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN";
   const QC_PREP_CANONICAL_REPORT_FILENAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
   const state = { qcPrepOptions: ${JSON.stringify(noteOptions)} };
   ${extractFunction("qcPrepProtocolCode")}
   ${extractFunction("qcPrepPayloadFromForm")}
   return qcPrepPayloadFromForm;`,
)();
const shaPayload = payloadApi({ ...noteSample, report_sha256: savedSha, date_evidence_note: generatedNotes.date_evidence_note });
assert(shaPayload.report_sha256 === savedSha, "the payload sends the loaded report_sha256 unchanged");
assert(!extractFunction("syncQcPrepFormFromDom").includes("qcPrepSha"), "sync does not read a SHA input");

function extractCallable(name) {
  const asyncAt = controlSrc.indexOf(`async function ${name}(`);
  const plainAt = controlSrc.indexOf(`\nfunction ${name}(`);
  const start = asyncAt >= 0 ? asyncAt : plainAt + 1;
  let paren = 0;
  let seenParen = false;
  let bodyAt = -1;
  for (let index = start; index < controlSrc.length; index += 1) {
    const char = controlSrc[index];
    if (char === "(") {
      paren += 1;
      seenParen = true;
    } else if (char === ")") paren -= 1;
    else if (seenParen && paren === 0 && char === "{") {
      bodyAt = index;
      break;
    }
  }
  let depth = 0;
  for (let index = bodyAt; index < controlSrc.length; index += 1) {
    const char = controlSrc[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return controlSrc.slice(start, index + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

const saveHarness = new Function(
  `const toasts = [];
   const state = {
     busy: false,
     qcPrepLoading: false,
     qcPrepAmbiguous: false,
     qcPrepLabsUnavailable: false,
     selectedProductId: 262,
     tab: "qc",
     qcPrepServer: { preparation_status: "PREPARING", preparation_id: "prep-1", row_version: 1 },
     qcPrepRequest: 0,
     qcPrepDirty: true,
     qcPrepNotice: "",
     qcPrepPreserveNotice: "",
     qcPrepReloadFeedback: false,
     qcPrepForm: {},
     qcPrepOptions: [],
     qcPrepReasons: [],
     qcPrepFieldsComplete: false,
     qcPrepDefaultsApplied: false,
     qcPrepNoteOverrides: {},
   };
   function canWrite() { return true; }
   function workerApiAvailable() { return true; }
   function isFirstControlledEntryProduct() { return true; }
   function syncQcPrepFormFromDom() { return { report_sha256: "${savedSha}" }; }
   function qcPrepApplyGeneratedNotes(form) { return form; }
   function sessionAccessToken() { return Promise.resolve("token"); }
   function qcPrepPayloadFromForm(form) { return form; }
   function saveQcPreparation() { return Promise.resolve({ ok: true, row_version: 2 }); }
   function showToast(message) { toasts.push(message); }
   function userMessageForError() { return "failed"; }
   function renderQc() {}
   function renderQcSurface() {}
   function revealQcPrepResult() {}
   function loadQcProtocolOptions() { return Promise.resolve({ options: [] }); }
   function loadQcLaboratoryOptions() { return Promise.resolve({ options: [] }); }
   function readQcPreparationWorkspace() { return Promise.resolve({ preparation: { draft_payload: {}, review: { reasons: [] }, row_version: 2 } }); }
   function qcPrepFormFromPayload() { return { report_sha256: "${savedSha}" }; }
   function applyQcPreparationDefaults(form) { return { form, applied: false }; }
   function qcPrepFormIsEmpty() { return false; }
   function qcPrepNoteOverridesForLoad() { return { date_evidence_note: false, report_date_evidence_note: false, report_evidence_note: false }; }
   ${extractCallable("qcPrepCurrent")}
   ${extractCallable("loadQcPreparationWorkspace")}
   ${extractCallable("reloadQcPreparationWorkspace")}
   ${extractCallable("submitQcPreparationSave")}
   return { submitQcPreparationSave, state, toasts };`,
)();
await saveHarness.submitQcPreparationSave();
for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
assert(saveHarness.toasts.includes("Draft saved (version 2)"), "a save at row version 2 toasts Draft saved (version 2)");
assert(saveHarness.state.qcPrepNotice === "Draft saved (version 2)", "the save notice survives the follow-up reload");

function validFacts(overrides = {}) {
  const facts = {};
  for (const key of workspace.QC_FACT_KEYS) {
    facts[key] = { supported_by_report: true, source_reference: "NUPAL report p.1" };
  }
  return { ...facts, ...overrides };
}
async function rejectFacts(label, factEvidence, attest = true) {
  const rpc = mockRpc(async () => ({}));
  const error = await expectFailure(
    () => workspace.verifyQcPreparationSource({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP_ID,
      expectedRowVersion: 1,
      attest,
      factEvidence,
      callRpc: rpc.callRpc,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(rpc.calls.length === 0, `${label} makes no RPC call`);
  return error;
}
const attestError = await rejectFacts("attest false", validFacts(), false);
assert(attestError?.message === "Tick the review confirmation first.", "attest false asks for the review confirmation");
await rejectFacts("a missing fact key", (() => {
  const facts = validFacts();
  delete facts.batches;
  return facts;
})());
await rejectFacts("an extra fact key", validFacts({ extra_fact: { supported_by_report: true, source_reference: "page 1" } }));
await rejectFacts("Yes without a page reference", validFacts({ study_start_date: { supported_by_report: true } }));
await rejectFacts("a blank page reference", validFacts({ study_start_date: { supported_by_report: true, source_reference: "  " } }));
await rejectFacts("a 4 character page reference", validFacts({ study_start_date: { supported_by_report: true, source_reference: "1234" } }));
await rejectFacts("a 9 character evidence note", validFacts({ study_start_date: { supported_by_report: false, evidence_note: "123456789" } }));

const acceptedFacts = validFacts();
const verifiedRpc = mockRpc(async () => ({
  preparation_id: PREP_ID,
  row_version: 4,
  preparation_status: "VERIFIED",
  verified_payload_hash: "hash",
  binding_id: "22222222-2222-2222-2222-222222222222",
  reservation_id: "33333333-3333-3333-3333-333333333333",
  verified_sha256: "ab".repeat(32),
}));
const verifiedSource = await workspace.verifyQcPreparationSource({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 3,
  attest: true,
  factEvidence: acceptedFacts,
  callRpc: verifiedRpc.callRpc,
});
assert(verifiedRpc.calls.length === 1, "a valid payload calls verify once");
assert(verifiedRpc.calls[0].name === "rpc_eaushadhi_qc_preparation_verify_v2", "verify uses rpc_eaushadhi_qc_preparation_verify_v2");
assert(Object.keys(verifiedRpc.calls[0].args).join(",") === "p_preparation_id,p_expected_row_version,p_attest,p_fact_evidence", "verify argument names are exact");
assert(verifiedRpc.calls[0].args.p_preparation_id === PREP_ID && verifiedRpc.calls[0].args.p_expected_row_version === 3 && verifiedRpc.calls[0].args.p_attest === true, "verify sends the preparation, version, and attestation");
assert(verifiedRpc.calls[0].args.p_fact_evidence === acceptedFacts, "verify sends the fact evidence object");
assert(verifiedSource.ok === true && verifiedSource.row_version === 4 && verifiedSource.mutated === true, "verify returns the server row");

const mappedMessages = [
  ["ATTESTATION_REQUIRED", "Tick the review confirmation first."],
  ["FACT_EVIDENCE_INCOMPLETE: SUPPORTED_FACT_REFERENCE_REQUIRED_STUDY_START_DATE, UNSUPPORTED_FACT_NOTE_REQUIRED_BATCHES", "Some fact rows need a page reference or an evidence note."],
  ["REPORT_NOT_REGISTERED", "Upload and register the QC report first."],
  ["REPORT_BYTES_NOT_VERIFIED", "Run 'Check bytes on server' first."],
  ["PAYLOAD_SHA_NOT_VERIFIED_BYTES", "The draft does not match the verified report. Save the draft again from the latest report."],
  ["PAYLOAD_FILENAME_MISMATCH", "The draft does not match the verified report. Save the draft again from the latest report."],
  ["OBJECT_CHANGED_OR_MISSING", "The stored report changed or is missing. Upload a new version."],
  ["ASSET_NOT_VERIFIED", "The report's verification record is incomplete. Contact support."],
  ["BYTE_EVENT_MISSING", "The report's verification record is incomplete. Contact support."],
  ["40001 Stale QC draft version", "Someone changed this draft. Reload and try again."],
  ["QC draft already source verified", "Already verified."],
  ["QC draft source verification requires complete human-entered fields", "Complete the QC draft fields before verifying source facts."],
];
for (const [serverMessage, plain] of mappedMessages) {
  const mapped = workspace.mapQcSourceVerifyError({ message: serverMessage });
  assert(mapped.message === plain, `${serverMessage} maps to the plain sentence`);
}
const permissionMapped = workspace.mapQcSourceVerifyError({ code: "42501", message: "permission denied" });
assert(permissionMapped.message === "You need edit permission for e-Aushadhi.", "42501 maps to the edit-permission sentence");
const namedFacts = workspace.mapQcSourceVerifyError({
  message: "FACT_EVIDENCE_INCOMPLETE: SUPPORTED_FACT_REFERENCE_REQUIRED_STUDY_START_DATE, UNSUPPORTED_FACT_NOTE_REQUIRED_BATCHES",
});
assert(namedFacts.details?.facts?.includes("study_start_date") && namedFacts.details.facts.includes("batches"), "an incomplete fact error names the rows");

const recheckRpc = mockRpc(async () => ({
  valid: false,
  reasons: ["NOT_SOURCE_VERIFIED", "NO_BINDING"],
  binding_id: null,
  reservation_id: null,
  verified_sha256: "",
  portal_laboratory_candidate_status: "",
  checked_at: "2026-10-11T12:00:00Z",
}));
const recheck = await workspace.recheckQcEvidence({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  callRpc: recheckRpc.callRpc,
});
assert(recheckRpc.calls.length === 1 && recheckRpc.calls[0].name === "rpc_eaushadhi_qc_evidence_recheck_v1", "recheck uses rpc_eaushadhi_qc_evidence_recheck_v1");
assert(recheck.mutated === false && workspace.qcEvidenceBadge(recheck).label === "Not verified yet", "the unverified pair maps to Not verified yet");
assert(workspace.qcEvidenceBadge({ valid: true, reasons: [] }).label === "Evidence valid ✓", "a valid recheck maps to Evidence valid");
assert(workspace.qcEvidenceBadge({ valid: false, reasons: ["PAYLOAD_HASH_CHANGED"] }).detail === "Draft edited after verification", "a changed payload maps to the draft-edited sentence");
assert(workspace.qcEvidenceBadge({ valid: false, reasons: ["SUPERSEDED_BY_NEWER_REPORT"] }).detail === "A newer report version was registered", "a newer report maps to that sentence");
assert(workspace.qcEvidenceBadge({ valid: false, reasons: ["OBJECT_MISSING"] }).detail === "Stored report changed", "an object reason maps to the stored-report sentence");
assert(workspace.qcEvidenceBadge({ valid: false, reasons: ["TUPLE_MISMATCH_SHA"] }).detail === "Evidence record mismatch", "a tuple mismatch maps to the evidence-record sentence");
assert(workspace.qcEvidenceBadge({ valid: false, reasons: ["SOMETHING_ELSE"] }).label === "Needs re-verify" && workspace.qcEvidenceBadge({ valid: false, reasons: ["SOMETHING_ELSE"] }).detail === "Needs re-verify", "any other reason maps to Needs re-verify");

const factHelperSrc = controlSrc.slice(
  controlSrc.indexOf("const QC_STUDY_START_FALLBACK"),
  controlSrc.indexOf("function qcFactRowError"),
);
const factApi = new Function(
  `${controlSrc.slice(controlSrc.indexOf("const QC_SOURCE_FACT_FIELDS = ["), controlSrc.indexOf("];", controlSrc.indexOf("const QC_SOURCE_FACT_FIELDS = [")) + 2)}
   ${extractFunction("qcIssuerShortName")}
   ${factHelperSrc}
   ${extractFunction("qcFactEvidenceFromRows")}
   ${extractFunction("qcRowsFromFactEvidence")}
   ${extractFunction("qcSourceVerifyFactLines")}
   ${extractFunction("qcFactPageHintMissing")}
   return { qcIssuerShortName, qcFactDefaultRows, qcFactEvidenceFromRows, qcRowsFromFactEvidence, qcSourceVerifyFactLines, qcFactPageHintMissing };`,
)();
const issuerNameForFacts = "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)";
assert(factApi.qcIssuerShortName(issuerNameForFacts) === "NUPAL", "the issuer short name is the text inside parentheses");
const defaultRows = factApi.qcFactDefaultRows({
  source_report_issuer: issuerNameForFacts,
  date_evidence_note: "Study period entered manually by the operator.",
  other_testing_protocol_text: "Cross Sectional Approach",
}, []);
assert(defaultRows.study_start_date.supported === false && defaultRows.testing_protocol.supported === false, "study start and testing protocol default to No");
assert(defaultRows.study_end_date.supported === true && defaultRows.report_date.supported === true && defaultRows.batches.supported === true && defaultRows.shelf_life_months.supported === true, "the other facts default to Yes");
assert(defaultRows.study_end_date.text === "NUPAL report p.1" && defaultRows.report_date.text === "NUPAL report p.1" && defaultRows.batches.text === "NUPAL report p.1" && defaultRows.shelf_life_months.text === "NUPAL report p.1", "Yes rows prefill NUPAL report p.1");
assert(defaultRows.study_start_date.text === "Study period entered manually by the operator." && defaultRows.study_start_date.text.length >= 10, "a long date note prefills the No row");
assert(defaultRows.testing_protocol.text === "Protocol chosen by operator: Cross Sectional Approach; not stated in the report" && defaultRows.testing_protocol.text.length >= 10, "protocol defaults to an operator note");
const shortDefaults = factApi.qcFactDefaultRows({
  source_report_issuer: issuerNameForFacts,
  date_evidence_note: "too short",
  other_testing_protocol_text: "short",
}, []);
assert(shortDefaults.study_start_date.text === "Study period entered by operator on the manufacturing-span basis; not printed in the report" && shortDefaults.study_start_date.text.length >= 10, "a short date note uses the manufacturing-span fallback");
assert(shortDefaults.testing_protocol.text === "Protocol chosen by operator: short; not stated in the report" && shortDefaults.testing_protocol.text.length >= 10, "a short protocol still gets the operator note");

const verifyFn = extractCallable("submitQcSourceVerify");
const confirmReturn = verifyFn.indexOf("if (accepted !== true) return;");
assert(confirmReturn > 0 && verifyFn.includes("openQcConfirm") && !verifyFn.slice(0, confirmReturn).includes("verifyQcPreparationSource"), "verify is not called before confirm returns");
assert(verifyFn.slice(confirmReturn).includes("verifyQcPreparationSource"), "verify runs only after confirm OK");
assert(!extractCallable("loadQcPreparationWorkspace").includes("verifyQcPreparationSource"), "load does not call source verify");
assert(!extractCallable("submitQcPreparationSave").includes("verifyQcPreparationSource"), "save does not call source verify");
assert(!extractCallable("executeQcReportUpload").includes("verifyQcPreparationSource"), "upload does not call source verify");
assert(!extractCallable("submitQcReportUpload").includes("verifyQcPreparationSource"), "register does not call source verify");
const verifyUses = [...controlSrc.matchAll(/verifyQcPreparationSource/g)];
assert(verifyUses.length === 2, "verifyQcPreparationSource appears only as the import and the confirm-OK call");
const qcFlow = controlSrc.slice(controlSrc.indexOf("function qcReportByteCheckWarning"), controlSrc.indexOf("function workerFoundationSummary"));
assert(!qcFlow.includes("window.confirm"), "the QC and verify flow does not use window.confirm");
assert(!controlSrc.includes("qc_preparation_verify_v1"), "the client does not reference verify_v1");
assert(controlSrc.includes("Bytes verified ✓") && controlSrc.includes("<details") && controlSrc.includes("Bytes not yet verified") && controlSrc.includes("Bytes mismatch"), "the byte readout is a badge plus details");
assert(preloadSrc.includes("eaushadhi-worker:qc-preparation-verify-source") && preloadSrc.includes("eaushadhi-worker:qc-evidence-recheck"), "preload maps verify and recheck");
assert(ipcSrc.includes("CHANNELS.QC_PREPARATION_VERIFY_SOURCE") && ipcSrc.includes("CHANNELS.QC_EVIDENCE_RECHECK"), "ipc registers verify and recheck");

const savedReportFile = QC_CANONICAL_REPORT_FILENAME;
const savedReportSha = "ab".repeat(32);
const factFieldsStart = controlSrc.indexOf("const QC_SOURCE_FACT_FIELDS = [");
const reloadedDraft = new Function(
  `const state = {
     selectedProductId: 262,
     qcPrepServer: { preparation_id: "${PREP_ID}", preparation_status: "REVIEW_REQUIRED", row_version: 4 },
     qcPrepForm: null,
     qcPrepOptions: [],
     qcPrepReasons: [],
     qcPrepDirty: false,
     busy: false,
     qcSourceVerifyRunning: false,
     qcSourceConfirmOpen: false,
     qcReports: [{
       status: "REGISTERED",
       preparation_id: "${PREP_ID}",
       version_no: 1,
       integrity_status: "VERIFIED_BYTES",
       expected_file_name: ${JSON.stringify(savedReportFile)},
       reservation_id: "33333333-3333-3333-3333-333333333333",
     }],
     qcReportByteResult: null,
     qcFactScope: "",
     qcFactRows: null,
     qcFactAttest: false,
     qcFactHighlights: [],
     qcEvidenceRecheck: null,
   };
   function workerApiAvailable() { return true; }
   function canWrite() { return true; }
   ${controlSrc.slice(factFieldsStart, controlSrc.indexOf("];", factFieldsStart) + 2)}
   ${extractFunction("emptyQcPrepForm")}
   ${extractFunction("qcPrepForm")}
   ${extractFunction("qcPrepFormFromPayload")}
   ${extractFunction("qcRegisteredReport")}
   const esc = (value) => String(value ?? "");
   ${extractFunction("qcIssuerShortName")}
   ${extractFunction("qcFactPreviewValue")}
   ${factHelperSrc}
   ${extractFunction("qcFactPageHintMissing")}
   ${extractFunction("qcFactRowError")}
   ${extractFunction("qcFactRowsCurrent")}
   ${extractFunction("qcEvidenceReasonText")}
   ${extractFunction("qcEvidenceBadge")}
   ${extractFunction("qcSourceFactsBlockReason")}
   ${extractFunction("qcSourceFactsModel")}
   ${extractFunction("qcSourceFactsCardHtml")}
   const loaded = qcPrepFormFromPayload({
     report_sha256: ${JSON.stringify(savedReportSha)},
     report_filename: ${JSON.stringify(savedReportFile)},
     source_report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
     date_evidence_note: "Study period entered manually by the operator.",
     other_testing_protocol_text: "Cross Sectional Approach",
   });
   state.qcPrepForm = loaded;
   qcSourceFactsModel();
   state.qcFactAttest = true;
   const open = qcSourceFactsModel();
   const html = qcSourceFactsCardHtml(open);
   const warnRows = qcFactRowsCurrent();
   warnRows.batches = { supported: true, text: "Cross Sectional Approach (API Vol VIII Page No:226)" };
   state.qcFactRows = warnRows;
   const warned = qcSourceFactsCardHtml(qcSourceFactsModel());
   warnRows.batches = { supported: true, text: "NUPAL report p.1" };
   state.qcFactRows = warnRows;
   const quiet = qcSourceFactsCardHtml(qcSourceFactsModel());
   state.qcPrepForm = { ...loaded, report_filename: "other.pdf" };
   const blocked = qcSourceFactsModel();
   return { loaded, open, html, warned, quiet, blocked };`,
)();
assert(reloadedDraft.loaded.report_filename === savedReportFile && reloadedDraft.loaded.report_sha256 === savedReportSha, "a saved draft loads report_filename and report_sha256");
assert(!reloadedDraft.open.blockReason, "a matching reloaded draft with no session byte check has no block reason");
assert(reloadedDraft.open.canSubmit === true && reloadedDraft.html.includes('id="btnQcVerifySourceFacts"') && !reloadedDraft.html.includes('id="btnQcVerifySourceFacts" disabled'), "Verify source facts is enabled for that draft");
assert(reloadedDraft.blocked.blockReason === "The draft does not match the verified report. Save the draft again from the latest report." && reloadedDraft.blocked.canSubmit !== true, "a different filename still blocks Verify source facts");
assert(reloadedDraft.warned.includes("This does not look like a page or section in the report. If the value is not printed in the report, choose No and write a note."), "a Yes row without a page hint shows the soft warning");
assert(!reloadedDraft.quiet.includes("This does not look like a page or section in the report."), "NUPAL report p.1 does not show the soft warning");
assert(factApi.qcFactPageHintMissing({ supported: true, text: "Cross Sectional Approach (API Vol VIII Page No:226)" }) === true, "Page No:226 is not a page hint");
assert(factApi.qcFactPageHintMissing({ supported: true, text: "NUPAL report p.1" }) === false, "p.1 is a page hint");

const factKeys = ["study_start_date", "study_end_date", "report_date", "testing_protocol", "batches", "shelf_life_months"];
let roundTripExact = true;
for (let mask = 0; mask < 64; mask += 1) {
  const rows = {};
  for (let index = 0; index < factKeys.length; index += 1) {
    const supported = (mask & (1 << index)) !== 0;
    rows[factKeys[index]] = {
      supported,
      text: supported ? `NUPAL report p.${index + 1}` : `Operator note ${index} is long enough`,
    };
  }
  const evidence = factApi.qcFactEvidenceFromRows(rows);
  const back = factApi.qcRowsFromFactEvidence(evidence);
  if (JSON.stringify(back) !== JSON.stringify(rows)) roundTripExact = false;
  const lines = factApi.qcSourceVerifyFactLines(rows).split("\n");
  if (lines.length !== 6) roundTripExact = false;
  factKeys.forEach((key, index) => {
    const shown = rows[key].supported === true;
    const item = evidence[key];
    if (item.supported_by_report !== shown) roundTripExact = false;
    if (shown && item.source_reference !== rows[key].text) roundTripExact = false;
    if (!shown && item.evidence_note !== rows[key].text) roundTripExact = false;
    const line = lines[index];
    if (shown && !line.startsWith(`${["Study start date", "Study end date", "Report date", "Testing protocol", "Batches", "Shelf life"][index]}: Shown — `)) roundTripExact = false;
    if (!shown && !line.includes("Not shown — note:")) roundTripExact = false;
  });
}
assert(roundTripExact, "qcFactEvidenceFromRows is round-trip exact for every Yes/No combination");
const longNote = "n".repeat(70);
const truncated = factApi.qcSourceVerifyFactLines({
  study_start_date: { supported: false, text: longNote },
  study_end_date: { supported: true, text: "NUPAL report p.1" },
  report_date: { supported: true, text: "NUPAL report p.1" },
  testing_protocol: { supported: false, text: "Protocol chosen by operator: Cross Sectional Approach; not stated in the report" },
  batches: { supported: true, text: "NUPAL report p.1" },
  shelf_life_months: { supported: true, text: "NUPAL report p.1" },
});
assert(truncated.includes(`${"n".repeat(60)}…`) && !truncated.includes("n".repeat(61)), "the confirm summary truncates a reference or note at 60 characters");
assert(verifyFn.includes("structuredClone(qcFactRowsCurrent())") && verifyFn.includes("qcSourceVerifyFactLines(submittedRows)") && verifyFn.includes("factEvidence: qcFactEvidenceFromRows(submittedRows)"), "the confirm summary and the submitted payload use the same copied rows");
assert(verifyFn.includes("This marks the QC draft as source-verified against V${version} (SHA-256 ${model.sha12}…). Any later edit will require verifying again. Continue?"), "the verify confirm keeps its existing sentence");
assert(!verifyFn.includes("state.qcFactRows = null"), "a successful verify keeps the submitted rows");
assert(extractFunction("openQcConfirm").includes('paragraph.className = "sasv-modal__message"'), "the confirm message uses sasv-modal__message");
const modalCss = readFileSync(join(root, "public/shared/css/sasv-primitives.css"), "utf8");
assert(/\.sasv-modal__message \{\r?\n  white-space: pre-wrap;\r?\n\}/.test(modalCss), "the confirm message keeps fact lines with pre-wrap");
const snapshotRows = {
  study_start_date: { supported: false, text: "Study period entered by operator on the manufacturing-span basis; not printed in the report" },
  study_end_date: { supported: true, text: "NUPAL report p.1" },
  report_date: { supported: true, text: "NUPAL report p.1" },
  testing_protocol: { supported: false, text: "Protocol chosen by operator: Cross Sectional Approach; not stated in the report" },
  batches: { supported: true, text: "NUPAL report p.1" },
  shelf_life_months: { supported: true, text: "NUPAL report p.1" },
};
const capturedEvidence = await new Function(
  `const state = {
     selectedProductId: 262,
     tab: "other",
     qcSourceVerifyRunning: false,
     qcSourceConfirmOpen: false,
     qcPrepServer: { preparation_id: "${PREP_ID}", row_version: 5 },
     qcFactRows: ${JSON.stringify(snapshotRows)},
   };
   function qcSourceFactsModel() { return { canSubmit: true, version: "01", sha12: "abcdef123456" }; }
   function qcFactRowsCurrent() { return state.qcFactRows; }
   function qcSourceVerifyFactLines() { return "lines"; }
   async function openQcConfirm() {
     state.qcFactRows.study_start_date.text = "MUTATED AFTER COPY";
     state.qcFactRows.study_start_date.supported = true;
     return true;
   }
   let captured = null;
   async function verifyQcPreparationSource(_productId, _token, draft) {
     captured = draft.factEvidence;
     return { ok: true, row_version: 6 };
   }
   ${controlSrc.slice(controlSrc.indexOf("const QC_SOURCE_FACT_FIELDS = ["), controlSrc.indexOf("];", controlSrc.indexOf("const QC_SOURCE_FACT_FIELDS = [")) + 2)}
   ${extractFunction("qcFactEvidenceFromRows")}
   async function sessionAccessToken() { return "token"; }
   function renderQc() {}
   function showToast() {}
   function reloadQcPreparationWorkspace() {}
   function userMessageForError() { return "failed"; }
   ${extractCallable("submitQcSourceVerify")}
   return submitQcSourceVerify().then(() => captured);`,
)();
assert(capturedEvidence.study_start_date.supported_by_report === false && capturedEvidence.study_start_date.evidence_note === snapshotRows.study_start_date.text, "mutating the state rows after the copy leaves the submitted payload unchanged");

const savedEvidence = {
  study_start_date: { supported_by_report: false, evidence_note: "Study period entered by operator on the manufacturing-span basis; not printed in the report" },
  study_end_date: { supported_by_report: true, source_reference: "NUPAL report p.1" },
  report_date: { supported_by_report: true, source_reference: "NUPAL report p.1" },
  testing_protocol: { supported_by_report: false, evidence_note: "Protocol chosen by operator: Cross Sectional Approach; not stated in the report" },
  batches: { supported_by_report: true, source_reference: "NUPAL report p.1" },
  shelf_life_months: { supported_by_report: true, source_reference: "NUPAL report p.1" },
};
const verifiedCard = new Function(
  `const state = {
     selectedProductId: 262,
     qcPrepServer: { preparation_id: "${PREP_ID}", preparation_status: "VERIFIED", row_version: 5 },
     qcPrepForm: {
       source_report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
       date_evidence_note: "Study period entered manually by the operator.",
       other_testing_protocol_text: "Cross Sectional Approach",
       report_filename: ${JSON.stringify(savedReportFile)},
       report_sha256: ${JSON.stringify(savedReportSha)},
     },
     qcPrepOptions: [],
     qcPrepReasons: [],
     qcPrepDirty: false,
     busy: false,
     qcSourceVerifyRunning: false,
     qcSourceConfirmOpen: false,
     qcReopenRunning: false,
     qcReports: [{
       status: "REGISTERED",
       preparation_id: "${PREP_ID}",
       version_no: 1,
       integrity_status: "VERIFIED_BYTES",
       expected_file_name: ${JSON.stringify(savedReportFile)},
       verified_sha256: ${JSON.stringify(savedReportSha)},
     }],
     qcReportByteResult: null,
     qcFactScope: "",
     qcFactRows: null,
     qcFactAttest: false,
     qcFactHighlights: [],
     qcEvidenceRecheck: { valid: true, reasons: [], fact_evidence: ${JSON.stringify(savedEvidence)} },
   };
   function workerApiAvailable() { return true; }
   function canWrite() { return true; }
   const esc = (value) => String(value ?? "");
   ${controlSrc.slice(factFieldsStart, controlSrc.indexOf("];", factFieldsStart) + 2)}
   ${extractFunction("emptyQcPrepForm")}
   ${extractFunction("qcPrepForm")}
   ${extractFunction("qcRegisteredReport")}
   ${extractFunction("qcIssuerShortName")}
   ${extractFunction("qcFactPreviewValue")}
   ${factHelperSrc}
   ${extractFunction("qcFactRowError")}
   ${extractFunction("qcFactRowsCurrent")}
   ${extractFunction("qcEvidenceReasonText")}
   ${extractFunction("qcEvidenceBadge")}
   ${extractFunction("qcSourceFactsBlockReason")}
   ${extractFunction("qcRowsFromFactEvidence")}
   ${extractFunction("qcFactPageHintMissing")}
   ${extractFunction("qcSourceFactsModel")}
   ${extractFunction("qcSourceFactsCardHtml")}
   const withEvidence = qcSourceFactsCardHtml(qcSourceFactsModel());
   state.qcEvidenceRecheck = { valid: true, reasons: [] };
   const withoutEvidence = qcSourceFactsCardHtml(qcSourceFactsModel());
   state.qcPrepServer = { preparation_id: "${PREP_ID}", preparation_status: "VERIFIED", row_version: 5 };
   state.qcEvidenceRecheck = { valid: true, reasons: [], fact_evidence: ${JSON.stringify(savedEvidence)} };
   function canWriteDenied() { return false; }
   return { withEvidence, withoutEvidence, canReopen: qcSourceFactsModel().canReopen };`,
)();
assert(verifiedCard.withEvidence.includes("Shown in the report: No") && verifiedCard.withEvidence.includes("Shown in the report: Yes"), "a verified card shows Yes and No from the saved facts");
assert(verifiedCard.withEvidence.includes(savedEvidence.study_start_date.evidence_note) && verifiedCard.withEvidence.includes(savedEvidence.testing_protocol.evidence_note) && verifiedCard.withEvidence.includes("NUPAL report p.1"), "the read-only rows match the saved fact evidence");
assert(!verifiedCard.withEvidence.includes("<select"), "a verified card with fact evidence has no select");
assert(verifiedCard.withoutEvidence.includes("Saved fact evidence is not available in this view") && !verifiedCard.withoutEvidence.includes("<select") && !verifiedCard.withoutEvidence.includes("Study period entered manually by the operator."), "a verified card without fact evidence does not render the default rows");
assert(verifiedCard.withEvidence.includes("Reopen for re-verification") && verifiedCard.canReopen === true, "reopen is offered when the draft is verified and editable");
assert(controlSrc.includes('if (text === "BINDING_SUPERSEDED") return "Reopened — verify again";'), "BINDING_SUPERSEDED says Reopened — verify again");
assert(workspace.qcEvidenceBadge({ valid: false, reasons: ["BINDING_SUPERSEDED"] }).detail === "Reopened — verify again", "the worker badge maps BINDING_SUPERSEDED");

const reopenReason = "The saved Yes answers need to be checked again.";
async function rejectReopen(label, overrides) {
  const rpc = mockRpc(async () => ({}));
  const error = await expectFailure(
    () => workspace.reopenQcPreparation({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP_ID,
      expectedRowVersion: 5,
      attest: true,
      reasonNote: reopenReason,
      callRpc: rpc.callRpc,
      ...overrides,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(rpc.calls.length === 0, `${label} makes no RPC call`);
  return error;
}
const shortReopen = await rejectReopen("a short reason", { reasonNote: "too short" });
assert(shortReopen?.message === "Write a reason of at least 10 characters.", "a short reason asks for 10 characters");
const missingAttest = await rejectReopen("a missing attest", { attest: false });
assert(missingAttest?.message === "Tick the confirmation first.", "a missing attest asks for the confirmation");
await rejectReopen("a bad UUID", { preparationId: "not-a-uuid" });
await rejectReopen("a bad version", { expectedRowVersion: 0 });
const reopenRpc = mockRpc(async () => ({
  preparation_id: PREP_ID,
  row_version: 6,
  preparation_status: "REVIEW_REQUIRED",
  superseded_binding_id: "11111111-1111-1111-1111-111111111111",
  supersession_id: "22222222-2222-2222-2222-222222222222",
}));
const reopened = await workspace.reopenQcPreparation({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 5,
  attest: true,
  reasonNote: reopenReason,
  callRpc: reopenRpc.callRpc,
});
assert(reopenRpc.calls.length === 1 && reopenRpc.calls[0].name === "rpc_eaushadhi_qc_preparation_reopen_v1", "reopen uses rpc_eaushadhi_qc_preparation_reopen_v1");
assert(Object.keys(reopenRpc.calls[0].args).join(",") === "p_preparation_id,p_expected_row_version,p_attest,p_reason_note", "reopen sends exact parameter names");
assert(reopenRpc.calls[0].args.p_preparation_id === PREP_ID && reopenRpc.calls[0].args.p_expected_row_version === 5 && reopenRpc.calls[0].args.p_attest === true && reopenRpc.calls[0].args.p_reason_note === reopenReason, "reopen sends the preparation, version, attestation, and reason");
assert(reopened.row_version === 6 && reopened.preparation_status === "REVIEW_REQUIRED", "reopen returns the next version and Review required");
async function mapReopen(error, kind, message) {
  const rpc = mockRpc(async () => { throw error; });
  const caught = await expectFailure(
    () => workspace.reopenQcPreparation({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP_ID,
      expectedRowVersion: 5,
      attest: true,
      reasonNote: reopenReason,
      callRpc: rpc.callRpc,
    }),
    kind,
  );
  assert(caught?.message === message, message);
}
await mapReopen({ code: "40001" }, ERROR_KINDS.STALE, "Someone changed this draft. Reload and try again.");
await mapReopen({ message: "REOPEN_NOT_VERIFIED" }, ERROR_KINDS.PREFLIGHT_DENIED, "This draft is not verified.");
await mapReopen({ message: "REOPEN_REASON_REQUIRED" }, ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a reason of at least 10 characters.");
await mapReopen({ message: "ATTESTATION_REQUIRED" }, ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first.");
await mapReopen({ code: "42501" }, ERROR_KINDS.AUTHORIZATION, "You need edit permission for e-Aushadhi.");
await mapReopen({ status: 401 }, ERROR_KINDS.AUTHORIZATION, "You need edit permission for e-Aushadhi.");
await mapReopen({ status: 403 }, ERROR_KINDS.AUTHORIZATION, "You need edit permission for e-Aushadhi.");
await mapReopen({ code: "PGRST202" }, ERROR_KINDS.PREFLIGHT_DENIED, "Reopen is not available on the server yet.");
await mapReopen({ status: 404 }, ERROR_KINDS.PREFLIGHT_DENIED, "Reopen is not available on the server yet.");
await mapReopen({ message: "REOPEN_BINDING_MISSING" }, ERROR_KINDS.CRASH, "Reopen failed.");
await mapReopen({ message: "REOPEN_ALREADY_SUPERSEDED" }, ERROR_KINDS.CRASH, "Reopen failed.");

const reopenFn = extractCallable("submitQcReopen");
assert(reopenFn.includes("openQcConfirm.showing === true") && reopenFn.includes("state.qcReopenRunning === true"), "reopen guards a second dialog and a double click");
assert(reopenFn.includes('if (accepted?.ok !== true) return;') && reopenFn.indexOf("reopenQcPreparation") > reopenFn.indexOf("accepted?.ok"), "reopen runs only after confirm OK");
assert(!extractCallable("loadQcPreparationWorkspace").includes("reopenQcPreparation") && !extractCallable("submitQcPreparationSave").includes("reopenQcPreparation") && !extractCallable("submitQcSourceVerify").includes("reopenQcPreparation"), "load, save, and verify do not reopen");
assert(!extractCallable("executeQcReportUpload").includes("reopenQcPreparation") && !extractCallable("submitQcReportUpload").includes("reopenQcPreparation"), "upload and register do not reopen");
assert((controlSrc.match(/reopenQcPreparation\(/g) || []).length === 1, "reopenQcPreparation is called from one place");
assert(preloadSrc.includes("reopenQcPreparation") && preloadSrc.includes("eaushadhi-worker:qc-preparation-reopen"), "preload exposes reopenQcPreparation");
assert(ipcSrc.includes("CHANNELS.QC_PREPARATION_REOPEN") && ipcSrc.includes("eaushadhi-worker:qc-preparation-reopen"), "ipc registers the reopen channel");
assert(controlSrc.includes('onwheel="this.blur()"') && extractFunction("onQcSourceFactField").includes('event.type !== "change"') && extractFunction("onQcSourceFactField").includes("document.getElementById(focusId)?.focus()"), "a fact select changes only on change, restores focus, and blurs on the wheel");
assert(readFileSync(join(root, "public/sw.js"), "utf8").includes('const CACHE_NAME = "hub-cache-v373"'), "CACHE_NAME is v373");

const readinessRpc = mockRpc(async () => ({
  status: "NOT_READY",
  reasons: ["FACT_ACCEPTANCE_MISSING_STUDY_START_DATE"],
  flags: [],
  preparation_id: PREP_ID,
  preparation_row_version: 7,
  binding_id: 4,
  verified_by: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  verified_at: "2026-10-12T04:30:00Z",
  evidence_valid: true,
  report_supported_facts: ["batches"],
  operator_asserted_facts: [{ fact: "study_start_date", accepted: false, note: "operator note" }],
  lab_basis: null,
  canonical_promotion: "BLOCKED_OUT_OF_SCOPE_B4",
  portal_submission: "NOT_PART_OF_READINESS",
  checked_at: "2026-10-12T05:00:00Z",
}));
const readiness = await workspace.readQcReadiness({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  callRpc: readinessRpc.callRpc,
});
assert(readinessRpc.calls.length === 1 && readinessRpc.calls[0].name === "rpc_eaushadhi_qc_readiness_v1", "readiness uses rpc_eaushadhi_qc_readiness_v1");
assert(Object.keys(readinessRpc.calls[0].args).join(",") === "p_product_id,p_preparation_id", "readiness argument names are exact");
assert(readiness.mutated === false && readiness.status === "NOT_READY", "readiness is read-only");
assert(workspace.qcReadinessBadge({ status: "NOT_READY" }).label === "Not ready", "NOT_READY maps to Not ready");
assert(workspace.qcReadinessBadge({ status: "READY_PROVISIONAL" }).label === "Ready (provisional)", "READY_PROVISIONAL maps to Ready (provisional)");
assert(workspace.qcReadinessBadge({ status: "READY" }).label === "Ready", "READY maps to Ready");
assert(workspace.qcReadinessBadge({ status: "READY" }).tone === "ready" && workspace.qcReadinessBadge({ status: "READY_PROVISIONAL" }).tone === "provisional" && workspace.qcReadinessBadge({ status: "NOT_READY" }).tone === "not-ready", "the three readiness tones are distinct");
const reasonCodes = [
  ["FACT_ACCEPTANCE_MISSING_STUDY_START_DATE", "Study start date needs acceptance by a colleague"],
  ["FACT_ACCEPTANCE_MISSING_TESTING_PROTOCOL", "Testing protocol needs acceptance by a colleague"],
  ["FACT_SELF_ACCEPTED_STUDY_START_DATE", "Study start date was accepted by the same person who verified; a different editor must accept"],
  ["FACT_SELF_ACCEPTED_TESTING_PROTOCOL", "Testing protocol was accepted by the same person who verified; a different editor must accept"],
  ["LAB_DECISION_MISSING", "Record the laboratory decision"],
  ["LAB_DECISION_STALE_BINDING", "Laboratory decision was made on older evidence; record a correction"],
  ["LAB_DECISION_WITHDRAWN", "Laboratory decision withdrawn"],
  ["EVIDENCE_NOT_SOURCE_VERIFIED", "Not verified yet"],
  ["EVIDENCE_BINDING_SUPERSEDED", "Reopened — verify again"],
  ["EVIDENCE_PAYLOAD_HASH_CHANGED", "Draft edited after verification"],
  ["EVIDENCE_SUPERSEDED_BY_NEWER_REPORT", "A newer report version was registered"],
  ["EVIDENCE_OBJECT_MISSING", "Stored report changed"],
  ["EVIDENCE_TUPLE_MISMATCH_SHA", "Evidence record mismatch"],
];
for (const [code, plain] of reasonCodes) {
  assert(workspace.qcReadinessReasonText(code) === plain, `${code} maps to the readiness sentence`);
}
assert(controlSrc.includes("needs acceptance by a colleague") && controlSrc.includes("was accepted by the same person who verified; a different editor must accept") && controlSrc.includes("Ready (provisional)") && controlSrc.includes("color:#c2410c") && controlSrc.includes("color:#8a5a00") && controlSrc.includes("color:#166534"), "the QC card uses the three readiness colours and the acceptance sentences");

async function rejectAccept(label, overrides = {}) {
  const rpc = mockRpc(async () => ({}));
  const error = await expectFailure(
    () => workspace.acceptQcFact({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP_ID,
      expectedRowVersion: 7,
      factKey: "study_start_date",
      basisCategory: "MANUFACTURING_RECORDS",
      basisNote: "Manufacturing records cover the study start.",
      attest: true,
      callRpc: rpc.callRpc,
      ...overrides,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(rpc.calls.length === 0, `${label} makes no RPC call`);
  return error;
}
const badFact = await rejectAccept("a report-only fact key", { factKey: "batches" });
assert(badFact?.message === "That fact cannot be accepted.", "a fact outside the two allowed keys is rejected before the RPC");
const badCategory = await rejectAccept("a bad category", { basisCategory: "GUESS" });
assert(badCategory?.message === "Choose a valid basis category.", "a bad category is rejected before the RPC");
const shortNote = await rejectAccept("a short basis note", { basisNote: "too short" });
assert(shortNote?.message === "Write a basis note of at least 10 characters.", "a short basis note is rejected before the RPC");
const missingFactAttest = await rejectAccept("a missing fact attest", { attest: false });
assert(missingFactAttest?.message === "Tick the confirmation first.", "fact acceptance requires the attestation");
await rejectAccept("a bad fact UUID", { preparationId: "nope" });
await rejectAccept("a bad fact version", { expectedRowVersion: 0 });
const acceptRpc = mockRpc(async () => ({
  acceptance_id: 9,
  binding_id: 4,
  fact_key: "testing_protocol",
  self_accepted: false,
}));
const acceptedFact = await workspace.acceptQcFact({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 7,
  factKey: "testing_protocol",
  basisCategory: "OPERATOR_DETERMINATION",
  basisNote: "  Protocol chosen by the operator and checked.  ",
  attest: true,
  callRpc: acceptRpc.callRpc,
});
assert(acceptRpc.calls.length === 1 && acceptRpc.calls[0].name === "rpc_eaushadhi_qc_fact_accept_v1", "fact acceptance uses rpc_eaushadhi_qc_fact_accept_v1");
assert(Object.keys(acceptRpc.calls[0].args).join(",") === "p_preparation_id,p_expected_row_version,p_fact_key,p_basis_category,p_basis_note,p_attest", "fact acceptance argument names are exact");
assert(acceptRpc.calls[0].args.p_basis_note === "Protocol chosen by the operator and checked." && acceptRpc.calls[0].args.p_attest === true, "fact acceptance trims the note and sends attestation");
assert(acceptedFact.mutated === true && acceptedFact.acceptance_id === 9 && acceptedFact.self_accepted === false, "fact acceptance returns the server row");

const factMessages = [
  ["40001 Stale QC draft version", ERROR_KINDS.STALE, "Someone changed this draft. Reload and try again."],
  ["EVIDENCE_NOT_CURRENT", ERROR_KINDS.STALE, "The verified evidence changed. Reload and try again."],
  ["ATTESTATION_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Tick the confirmation first."],
  ["BASIS_NOTE_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a basis note of at least 10 characters."],
  ["BASIS_CATEGORY_INVALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "Choose a valid basis category."],
  ["EVIDENCE_NOT_VALID", ERROR_KINDS.CONTRACT_INCOMPLETE, "The verified evidence is no longer valid. Verify source facts again first."],
  ["FACT_UNKNOWN", ERROR_KINDS.CONTRACT_INCOMPLETE, "That fact cannot be accepted."],
  ["FACT_IS_REPORT_SUPPORTED", ERROR_KINDS.CONTRACT_INCOMPLETE, "This fact is shown in the report and does not need acceptance."],
  ["FACT_ALREADY_ACCEPTED", ERROR_KINDS.CONTRACT_INCOMPLETE, "This fact is already accepted for the current evidence."],
  ["PGRST202", ERROR_KINDS.PREFLIGHT_DENIED, "Not available on the server yet."],
];
for (const [serverMessage, kind, plain] of factMessages) {
  const rpc = mockRpc(async () => { throw { message: serverMessage, code: serverMessage === "PGRST202" ? "PGRST202" : "23514" }; });
  const caught = await expectFailure(
    () => workspace.acceptQcFact({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP_ID,
      expectedRowVersion: 7,
      factKey: "study_start_date",
      basisCategory: "MANUFACTURING_RECORDS",
      basisNote: "Manufacturing records cover the study start.",
      attest: true,
      callRpc: rpc.callRpc,
    }),
    kind,
  );
  assert(caught?.message === plain, `${serverMessage} maps to the fact-acceptance sentence`);
}
const factDenied = workspace.mapQcGovernanceError({ code: "42501", message: "permission denied" }, "Fact acceptance failed.");
assert(factDenied.message === "You need edit permission for e-Aushadhi.", "fact acceptance maps 42501 to the edit-permission sentence");
const readinessMissing = workspace.mapQcReadinessError({ status: 404, message: "missing" });
assert(readinessMissing.message === "Not available on the server yet.", "a missing readiness RPC says it is not available yet");

const labBase = {
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 7,
  action: "INITIAL",
  supersedesLabBasisId: null,
  basisType: "CROSS_LABORATORY_TIE_UP",
  documentReference: "Operator decision 2026-10-13",
  rationale: "HARIDEV FORMULATIONS selected provisionally as portal laboratory.",
  attest: true,
};
async function rejectLab(label, overrides = {}, kind = ERROR_KINDS.CONTRACT_INCOMPLETE) {
  const rpc = mockRpc(async () => ({}));
  const error = await expectFailure(
    () => workspace.recordQcLabDecision({ ...labBase, callRpc: rpc.callRpc, ...overrides }),
    kind,
  );
  assert(rpc.calls.length === 0, `${label} makes no RPC call`);
  return error;
}
const badAction = await rejectLab("a bad action", { action: "APPROVE" });
assert(badAction?.message === "Choose a valid laboratory decision.", "a bad laboratory action is rejected before the RPC");
const initialSupersede = await rejectLab("an initial row that supersedes", { supersedesLabBasisId: 3 });
assert(initialSupersede?.message === "The first laboratory decision cannot replace an earlier one.", "INITIAL cannot supersede");
const missingHead = await rejectLab("a correction without a head", { action: "CORRECTION", supersedesLabBasisId: null });
assert(missingHead?.message === "Someone changed the laboratory decision. Reload and try again.", "a correction needs the current head");
const badBasis = await rejectLab("a bad basis type", { basisType: "OTHER" });
assert(badBasis?.message === "The laboratory basis must be a cross laboratory tie-up.", "the basis type is fixed before the RPC");
const shortRef = await rejectLab("a short document reference", { documentReference: "abc" });
assert(shortRef?.message === "Enter a document reference of at least 5 characters.", "a short document reference is rejected before the RPC");
const shortRationale = await rejectLab("a short rationale", { rationale: "too short" });
assert(shortRationale?.message === "Write a rationale of at least 10 characters.", "a short rationale is rejected before the RPC");
await rejectLab("a missing laboratory attest", { attest: false });
const labRpc = mockRpc(async () => ({
  lab_basis_id: 15,
  decision_action: "CORRECTION",
  basis_status: "PROVISIONALLY_APPROVED",
  supersedes_lab_basis_id: 14,
  preparation_row_version: 7,
  binding_id: 4,
  report_issuer: "NUPAL",
  portal_laboratory: "HARIDEV FORMULATIONS",
  portal_external_id: "3980",
  legal_lab_identity_verified: false,
  portal_eligibility_verified: false,
}));
const recordedLab = await workspace.recordQcLabDecision({
  ...labBase,
  action: "CORRECTION",
  supersedesLabBasisId: 14,
  callRpc: labRpc.callRpc,
});
assert(labRpc.calls.length === 1 && labRpc.calls[0].name === "rpc_eaushadhi_qc_lab_decision_record_v1", "the laboratory decision uses rpc_eaushadhi_qc_lab_decision_record_v1");
assert(Object.keys(labRpc.calls[0].args).join(",") === "p_preparation_id,p_expected_row_version,p_action,p_supersedes_lab_basis_id,p_basis_type,p_document_reference,p_document_asset_id,p_rationale,p_attest", "laboratory decision argument names are exact");
assert(labRpc.calls[0].args.p_document_asset_id === null && labRpc.calls[0].args.p_supersedes_lab_basis_id === 14 && labRpc.calls[0].args.p_basis_type === "CROSS_LABORATORY_TIE_UP", "this release sends a null document asset and the current head");
assert(!Object.hasOwn(labRpc.calls[0].args, "p_report_issuer") && !Object.hasOwn(labRpc.calls[0].args, "p_portal_laboratory"), "the laboratory decision does not send the issuer or the portal laboratory");
assert(recordedLab.legal_lab_identity_verified === false && recordedLab.portal_eligibility_verified === false && recordedLab.mutated === true, "the laboratory decision stays unverified for legal identity and portal eligibility");
const supersedesMapped = workspace.mapQcGovernanceError({ code: "40001", message: "SUPERSEDES_NOT_CURRENT_HEAD" }, "Laboratory decision failed.");
assert(supersedesMapped.message === "Someone changed the laboratory decision. Reload and try again.", "SUPERSEDES_NOT_CURRENT_HEAD maps to the reload sentence");
const labMissing = workspace.mapQcGovernanceError({ status: 404, message: "not found" }, "Laboratory decision failed.");
assert(labMissing.message === "Not available on the server yet.", "a missing laboratory RPC says it is not available yet");

const labSubmit = extractCallable("submitQcLabDecision");
const factSubmit = extractCallable("submitQcFactAccept");
assert(labSubmit.includes("openQcConfirm") && labSubmit.indexOf("recordQcLabDecision") > labSubmit.indexOf("accepted !== true"), "the laboratory decision runs only after confirm OK");
assert(factSubmit.includes("openQcConfirm") && factSubmit.indexOf("acceptQcFact") > factSubmit.indexOf("accepted !== true"), "fact acceptance runs only after confirm OK");
assert(labSubmit.includes("qcGovernanceBlocked") && factSubmit.includes("qcGovernanceBlocked"), "laboratory and fact actions guard a second dialog and a double click");
assert(labSubmit.includes("supersedesLabBasisId: action === \"INITIAL\" ? null : headId") && labSubmit.includes("lab_basis?.lab_basis_id") && labSubmit.includes("preparation_row_version"), "Correct, Replace and Withdraw pass the current head and the preparation version");
assert(!labSubmit.includes("source_report_issuer") && !labSubmit.includes("portal_laboratory_candidate") && !factSubmit.includes("source_report_issuer"), "the write calls do not send the issuer or the portal laboratory");
assert(extractFunction("qcLabSuggestions").includes("portal_laboratory_candidate") && extractFunction("qcLabSuggestions").includes("source_report_issuer") && extractFunction("qcEnsureLabDraft").includes("qcLabSuggestions") && extractFunction("qcLabDecisionCardHtml").includes("qcEnsureLabDraft"), "the laboratory card is prefilled from the draft");
assert(extractFunction("qcFactAcceptCardHtml").includes("You verified this evidence. Your acceptance will be recorded but will not count. A different editor must accept.") && extractFunction("qcFactAcceptCardHtml").includes("access.userId") && extractFunction("qcFactAcceptCardHtml").includes("verified_by"), "self-acceptance shows the warning when the current user verified the evidence");
const confirmFn = extractFunction("openQcConfirm");
assert(confirmFn.includes('event.key === "Escape"') && confirmFn.includes("close(false)") && confirmFn.includes("Cancel") && confirmFn.includes("event.target === backdrop"), "Esc, Cancel and a backdrop click close the confirm without accepting");
for (const name of ["loadQcPreparationWorkspace", "loadQcEvidenceRecheck", "loadQcReadiness", "renderQc", "queueQcReadinessLoad", "renderReadiness"]) {
  const body = extractCallable(name);
  assert(!body.includes("acceptQcFact(") && !body.includes("recordQcLabDecision("), `${name} does not write readiness facts or the laboratory decision`);
}
assert((controlSrc.match(/acceptQcFact\(/g) || []).length === 1, "acceptQcFact is called from one place");
assert((controlSrc.match(/recordQcLabDecision\(/g) || []).length === 1, "recordQcLabDecision is called from one place");
assert((controlSrc.match(/readQcReadiness\(/g) || []).length === 1, "readQcReadiness is called from one place");
assert(!controlSrc.includes("same laboratory"), "the QC screen does not claim the issuer and the portal laboratory are the same laboratory");
assert(preloadSrc.includes("eaushadhi-worker:qc-readiness") && preloadSrc.includes("eaushadhi-worker:qc-fact-accept") && preloadSrc.includes("eaushadhi-worker:qc-lab-decision"), "preload exposes readiness, fact acceptance and the laboratory decision");
assert(preloadSrc.includes("readQcReadiness:") && preloadSrc.includes("acceptQcFact:") && preloadSrc.includes("recordQcLabDecision:"), "preload method names match the worker");
assert(ipcSrc.includes("CHANNELS.QC_READINESS") && ipcSrc.includes("eaushadhi-worker:qc-readiness") && ipcSrc.includes("CHANNELS.QC_FACT_ACCEPT") && ipcSrc.includes("CHANNELS.QC_LAB_DECISION"), "ipc registers the three readiness channels");
const reviewClientSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-worker-client.js"), "utf8");
assert(reviewClientSrc.includes("readQcReadiness") && reviewClientSrc.includes("acceptQcFact") && reviewClientSrc.includes("recordQcLabDecision"), "the review client exposes the three readiness calls");

if (failed) {
  console.error(`\n${failed} qc preparation workspace assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-preparation-workspace-smoke: all assertions passed");
