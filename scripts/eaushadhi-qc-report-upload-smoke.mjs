import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const upload = require(join(root, "electron/eaushadhi-worker/qc-report-upload.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));
const {
  QC_PREPARATION_READ_RPC,
  QC_REPORT_LIST_RPC,
  QC_REPORT_RESERVE_RPC,
  QC_REPORT_REGISTER_RPC,
  listQcReports,
  reserveQcReport,
  registerQcReport,
} = upload;

const TOKEN = `report-token-${"b".repeat(24)}`;
const PREP_ID = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RESERVATION_ID = "11111111-1111-4111-8111-111111111111";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";
const FILE_NAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const SHA = "0795de1d0e186cec278040cd16f1431e7422ceeaf7b48f7b6a50ca9bdba60ee9";

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

function preparationRow(overrides = {}) {
  return {
    preparation_id: PREP_ID,
    source_key: "manual-qc:262:primary",
    preparation_status: "REVIEW_REQUIRED",
    row_version: 2,
    ...overrides,
  };
}

function reservationRow(overrides = {}) {
  return {
    reservation_id: RESERVATION_ID,
    preparation_id: PREP_ID,
    version_no: 1,
    expected_file_name: FILE_NAME,
    expected_storage_path: `qc-test-report/262/${PREP_ID}/${FILE_NAME}`,
    status: "RESERVED",
    bucket: "eaushadhi-evidence",
    extension: "pdf",
    integrity_status: "UNVERIFIED_BYTES",
    preparation_row_version: 2,
    ...overrides,
  };
}

const uploadSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-report-upload.js"), "utf8");
assert(!/qc_preparation_verify_v1|storage\.from|service_role|SaveData/.test(uploadSrc), "upload worker does not verify, store, or use a service role");

for (const productId of [261, "261"]) {
  const blocked = mockRpc(async () => []);
  await expectFailure(
    () => listQcReports({ productId, accessToken: TOKEN, callRpc: blocked.callRpc }),
    ERROR_KINDS.PRODUCT_NOT_ALLOWED,
  );
  assert(blocked.calls.length === 0, "wrong product makes no report RPC call");
}
await expectFailure(
  () => listQcReports({ productId: 262, accessToken: "short", callRpc: mockRpc(async () => []).callRpc }),
  ERROR_KINDS.AUTHORIZATION,
);

const stale = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow({ row_version: 1 })];
  return [];
});
await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 2,
    callRpc: stale.callRpc,
  }),
  ERROR_KINDS.STALE,
);
assert(!stale.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "a stale preparation makes no reserve call");

const verified = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow({ preparation_status: "VERIFIED" })];
  return [];
});
await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: "2",
    callRpc: verified.callRpc,
  }),
  ERROR_KINDS.PREFLIGHT_DENIED,
);
assert(!verified.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "a verified preparation makes no reserve call");

const wrongKey = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow({ source_key: "other" })];
  return [];
});
await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 2,
    callRpc: wrongKey.callRpc,
  }),
  ERROR_KINDS.PREFLIGHT_DENIED,
);
assert(!wrongKey.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "a wrong source key makes no reserve call");

const reused = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow()];
  if (name === QC_REPORT_LIST_RPC) {
    return [
      reservationRow({ version_no: 1, status: "RESERVED" }),
      reservationRow({
        version_no: 3,
        status: "RESERVED",
        expected_file_name: "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V03.pdf",
      }),
    ];
  }
  return reservationRow();
});
const reusedResult = await reserveQcReport({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 2,
  callRpc: reused.callRpc,
});
assert(reusedResult.reused === true && reusedResult.reservation.version_no === 3, "an existing RESERVED row is reused");
assert(!reused.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "reuse makes no new reserve call");

const reserved = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow()];
  if (name === QC_REPORT_LIST_RPC) return [];
  return reservationRow({ bucket: "other-bucket" });
});
await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 2,
    callRpc: reserved.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(reserved.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "a new reserve is called when nothing is reserved");

const badPath = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow()];
  if (name === QC_REPORT_LIST_RPC) return [];
  return reservationRow({ expected_storage_path: "wrong/path.pdf" });
});
await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 2,
    callRpc: badPath.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);

await expectFailure(
  () => registerQcReport({
    productId: 262,
    accessToken: TOKEN,
    reservationId: "not-a-uuid",
    expectedRowVersion: 2,
    objectId: OBJECT_ID,
    originalFileName: "lab.pdf",
    sha256: SHA,
    callRpc: mockRpc(async () => ({})).callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
const badShaRpc = mockRpc(async () => ({}));
await expectFailure(
  () => registerQcReport({
    productId: 262,
    accessToken: TOKEN,
    reservationId: RESERVATION_ID,
    expectedRowVersion: 2,
    objectId: OBJECT_ID,
    originalFileName: "lab.pdf",
    sha256: "abc",
    callRpc: badShaRpc.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(badShaRpc.calls.length === 0, "a bad SHA makes no register call");

for (const [code, kind] of [
  ["40001", ERROR_KINDS.STALE],
  ["23505", ERROR_KINDS.STALE],
  ["23514", ERROR_KINDS.CONTRACT_INCOMPLETE],
  ["42501", ERROR_KINDS.AUTHORIZATION],
]) {
  const rpc = mockRpc(async () => {
    const error = new Error("server");
    error.code = code;
    throw error;
  });
  const error = await expectFailure(
    () => registerQcReport({
      productId: 262,
      accessToken: TOKEN,
      reservationId: RESERVATION_ID,
      expectedRowVersion: 2,
      objectId: OBJECT_ID,
      originalFileName: "lab.pdf",
      sha256: SHA,
      callRpc: rpc.callRpc,
    }),
    kind,
  );
  if (code === "40001") assert(error?.message === "Stale reservation — reload and retry", "a stale reservation tells the operator to reload");
}

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const apiSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
for (const channel of ["eaushadhi-worker:qc-report-list", "eaushadhi-worker:qc-report-reserve", "eaushadhi-worker:qc-report-register"]) {
  assert(ipcSrc.includes(channel), `IPC defines ${channel}`);
  assert(preloadSrc.includes(channel), `preload maps ${channel}`);
}
for (const method of ["listQcReports", "reserveQcReport", "registerQcReport"]) {
  assert(preloadSrc.includes(`${method}:`), `preload exposes ${method}`);
  assert(ipcSrc.includes(`withRendererGuard`) && ipcSrc.includes(method), `${method} handler is guarded`);
}
assert(apiSrc.includes("upsert: false") && apiSrc.includes("function uploadQcReportObject"), "QC upload uses upsert false");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = controlSrc.indexOf(marker);
  assert(start >= 0, `${name} is defined`);
  let bodyStart = start;
  if (controlSrc.slice(bodyStart - 6, bodyStart) === "async ") bodyStart -= 6;
  const brace = controlSrc.indexOf("{", bodyStart);
  let depth = 0;
  for (let index = brace; index < controlSrc.length; index += 1) {
    const char = controlSrc[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return controlSrc.slice(bodyStart, index + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

const flow = new Function(
  `${extractFunction("qcReportFileProblem")}
   ${extractFunction("qcReportObjectId")}
   ${extractFunction("qcReportStorageExists")}
   ${extractFunction("qcReportRemovalWarning")}
   ${extractFunction("executeQcReportUpload")}
   return { qcReportFileProblem, executeQcReportUpload };`,
)();
const pdfHeader = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
assert(flow.qcReportFileProblem({ name: "note.txt", type: "application/pdf", size: 10 }, pdfHeader), "a non-PDF extension is rejected");
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "text/plain", size: 10 }, pdfHeader), "a wrong MIME type is rejected");
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "application/pdf", size: 10 }, Uint8Array.from([1, 2, 3, 4, 5])), "a missing PDF header is rejected");
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "application/pdf", size: 0 }, pdfHeader) === "Portal limit: PDF must be 2 MB or smaller.", "an empty file is rejected");
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "application/pdf", size: 2097153 }, pdfHeader) === "Portal limit: PDF must be 2 MB or smaller.", "a file over 2 MB is rejected");
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "application/pdf", size: 2097152 }, pdfHeader) === "", "a 2 MB PDF is accepted");

const preparation = { preparation_id: PREP_ID, row_version: 2, preparation_status: "REVIEW_REQUIRED" };
const file = { name: "lab.pdf", size: 1200 };
async function runFlow(overrides = {}) {
  const calls = [];
  let current = true;
  const result = await flow.executeQcReportUpload({
    dirty: false,
    busy: false,
    preparation,
    file,
    sha256: SHA,
    form: { report_evidence_note: "" },
    overrides: {},
    protocolOptions: [],
    generatedNotes: () => ({ report_evidence_note: `SHA-256 ${SHA}` }),
    payloadFromForm: (form) => form,
    isCurrent: () => current,
    reserve: async () => {
      calls.push("reserve");
      if (overrides.afterReserve) current = overrides.afterReserve();
      return { ok: true, reservation: reservationRow() };
    },
    upload: async (_path, _file, options) => {
      calls.push(`upload:${options.upsert}`);
      return overrides.uploadId === undefined ? { id: OBJECT_ID } : { id: overrides.uploadId };
    },
    remove: async () => {
      calls.push("remove");
      if (overrides.removeFails) return false;
      return true;
    },
    register: async () => {
      calls.push("register");
      return overrides.registerResult || { ok: true };
    },
    save: async (draft) => {
      calls.push("save");
      overrides.saved = draft;
      return { ok: true, row_version: 3 };
    },
    ...overrides.input,
  });
  return { result, calls, saved: overrides.saved };
}

const happy = await runFlow();
assert(happy.calls.join(",") === "reserve,upload:false,register,save", "upload order is reserve, upload, register, save");
assert(happy.saved.payload.report_filename === FILE_NAME && happy.saved.payload.report_sha256 === SHA, "the re-save payload carries the file name and SHA");
assert(String(happy.saved.payload.report_evidence_note).includes(SHA), "the regenerated note includes the SHA");
assert(happy.result.toast === "QC test report V01 registered; draft saved (version 3).", "success names the registered version");

const registerFailed = await runFlow({ registerResult: { ok: false, message: "QC test report was not accepted." } });
assert(registerFailed.calls.includes("remove") && !registerFailed.calls.includes("save"), "register failure removes the object and does not save");
const removalFailed = await runFlow({
  registerResult: { ok: false, message: "QC test report was not accepted." },
  removeFails: true,
});
assert(removalFailed.result.warning.includes("Tell Jarvis/support."), "a removal failure stays as a persistent warning");

const missingId = await runFlow({ uploadId: "" });
assert(!missingId.calls.includes("register") && missingId.calls.includes("remove"), "a missing object id does not register and removes the object");
assert(missingId.result.inline === "Upload could not be registered (no object id). Nothing was registered.", "a missing object id explains that nothing was registered");

const dirty = await runFlow({ input: { dirty: true } });
assert(dirty.calls.length === 0 && dirty.result.inline === "Save or reload the QC form first.", "upload is blocked while the QC form is dirty");
const second = await runFlow({ input: { busy: true } });
assert(second.calls.length === 0 && second.result.blocked === true, "a second click is blocked while busy");
const switched = await runFlow({ afterReserve: () => false });
assert(switched.result.abandoned === true && !switched.calls.includes("upload:false"), "a product switch discards the rest of the upload");

function extractMarkup(name) {
  return extractFunction(name);
}
const markup = new Function(`${extractMarkup("qcPrepWorkspaceHtml")}; return qcPrepWorkspaceHtml;`)();
const registeredHtml = markup({
  open: true,
  labs: [],
  lab: "",
  sha: SHA,
  reportRegistered: true,
  reportVersion: "01",
  reportFileName: FILE_NAME,
  reasons: [],
  serverReasons: [],
  localHints: [],
  protocolOptions: [],
});
assert(registeredHtml.includes(`Test report: V01 registered \u2013 ${FILE_NAME}; SHA-256 ${SHA}; bytes not yet verified (B2)`), "card C shows the registered report");
assert(registeredHtml.includes("done (registered, bytes unverified)"), "C2 is done when a report is registered");
assert(registeredHtml.includes("B1/B2 — Report registered and bytes verified") && registeredHtml.includes("— not done"), "other checklist items stay not done");
assert(!registeredHtml.includes("READY"), "registered QC markup does not contain READY");
const emptyHtml = markup({ open: true, labs: [], protocolOptions: [], reasons: [], serverReasons: [], localHints: [] });
assert(emptyHtml.includes("No report uploaded. Upload in the Evidence tab."), "card C points to the Evidence tab when nothing is uploaded");

if (failed) {
  console.error(`\n${failed} qc report upload assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-report-upload-smoke: all assertions passed");
