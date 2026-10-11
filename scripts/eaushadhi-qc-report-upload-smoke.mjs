import { createHash } from "node:crypto";
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
  verifyQcReportBytes,
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
    fileSize: 1200,
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
    fileSize: 1200,
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
    fileSize: 1200,
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
        expected_storage_path: `qc-test-report/262/${PREP_ID}/EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V03.pdf`,
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
  fileSize: 1200,
  callRpc: reused.callRpc,
});
assert(reusedResult.reused === true && reusedResult.reservation.version_no === 3, "an existing RESERVED row is reused");
assert(!reused.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "reuse makes no new reserve call");

const badReuse = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow()];
  if (name === QC_REPORT_LIST_RPC) return [reservationRow({ expected_storage_path: "wrong/path.pdf" })];
  return reservationRow();
});
await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 2,
    fileSize: 1200,
    callRpc: badReuse.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(!badReuse.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "a reused row with a bad path makes no reserve call");

const forced = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow()];
  if (name === QC_REPORT_LIST_RPC) return [reservationRow()];
  return reservationRow({ version_no: 2, expected_file_name: "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V02.pdf", expected_storage_path: `qc-test-report/262/${PREP_ID}/EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V02.pdf` });
});
const forcedResult = await reserveQcReport({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 2,
  forceNew: true,
  fileSize: 1200,
  callRpc: forced.callRpc,
});
assert(forcedResult.reused === false && forced.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "forceNew reserves a new version");

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
    fileSize: 1200,
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
    fileSize: 1200,
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
    fileSize: 1200,
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
    fileSize: 1200,
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
      fileSize: 1200,
      callRpc: rpc.callRpc,
    }),
    kind,
  );
  if (code === "40001") assert(error?.message === "Stale reservation — reload and retry", "a stale reservation tells the operator to reload");
}

function verifyClient(payload) {
  const calls = [];
  return {
    calls,
    createClient(token) {
      calls.push(token);
      return {
        functions: {
          invoke: async (name, options) => {
            calls.push({ name, options });
            return payload(name, options);
          },
        },
      };
    },
  };
}
const verifiedBytes = {
  ok: true,
  integrity_status: "VERIFIED_BYTES",
  already_checked: false,
  reasons: [],
  verified_sha256: SHA,
  verified_size_bytes: 1200,
  document_asset_id: 2,
};
const verifiedClient = verifyClient(async () => ({ data: verifiedBytes, error: null }));
const byteCheck = await verifyQcReportBytes({
  productId: 262,
  accessToken: TOKEN,
  reservationId: RESERVATION_ID,
  createClient: verifiedClient.createClient,
});
assert(byteCheck.ok === true && byteCheck.integrity_status === "VERIFIED_BYTES" && byteCheck.verified_sha256 === SHA && byteCheck.document_asset_id === "2", "verify success accepts a numeric document asset id");
assert(verifiedClient.calls.some((call) => call?.name === "eaushadhi-qc-report-verify" && call.options.body.product_id === 262), "verify calls the edge function with the user token client");
for (const badAssetId of ["abc", -1]) {
  await expectFailure(
    () => verifyQcReportBytes({
      productId: 262,
      accessToken: TOKEN,
      reservationId: RESERVATION_ID,
      createClient: verifyClient(async () => ({
        data: { ...verifiedBytes, document_asset_id: badAssetId },
        error: null,
      })).createClient,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
}
assert(true, "a document asset id of abc or -1 is rejected");
const mismatch = await verifyQcReportBytes({
  productId: 262,
  accessToken: TOKEN,
  reservationId: RESERVATION_ID,
  createClient: verifyClient(async () => ({
    data: { ...verifiedBytes, integrity_status: "BYTES_MISMATCH", reasons: ["SHA256_MISMATCH", "NOT_PDF_HEADER"] },
    error: null,
  })).createClient,
});
assert(mismatch.integrity_status === "BYTES_MISMATCH" && mismatch.reasons.includes("SHA256_MISMATCH"), "verify mismatch keeps the reason codes");
const already = await verifyQcReportBytes({
  productId: 262,
  accessToken: TOKEN,
  reservationId: RESERVATION_ID,
  createClient: verifyClient(async () => ({
    data: { ...verifiedBytes, already_checked: true },
    error: null,
  })).createClient,
});
assert(already.already_checked === true && already.mutated === false, "an already checked report is returned without a new check");
const notRegistered = await verifyQcReportBytes({
  productId: 262,
  accessToken: TOKEN,
  reservationId: RESERVATION_ID,
  createClient: verifyClient(async () => ({ data: null, error: { context: { code: "RESERVATION_NOT_REGISTERED" } } })).createClient,
});
assert(notRegistered.ok === false && notRegistered.code === "RESERVATION_NOT_REGISTERED", "a report that is not registered is a typed error");
const changed = await verifyQcReportBytes({
  productId: 262,
  accessToken: TOKEN,
  reservationId: RESERVATION_ID,
  createClient: verifyClient(async () => ({ data: null, error: { context: { code: "OBJECT_CHANGED" } } })).createClient,
});
assert(changed.code === "OBJECT_CHANGED" && changed.errorKind === ERROR_KINDS.STALE, "OBJECT_CHANGED is a typed stale error");
const blockedVerify = verifyClient(async () => ({ data: verifiedBytes, error: null }));
await expectFailure(
  () => verifyQcReportBytes({ productId: 261, accessToken: TOKEN, reservationId: RESERVATION_ID, createClient: blockedVerify.createClient }),
  ERROR_KINDS.PRODUCT_NOT_ALLOWED,
);
assert(blockedVerify.calls.length === 0, "verify for another product makes no function call");
assert(upload.QC_REPORT_MAX_BYTES === 2 * 1024 * 1024, "the shared byte limit is 2 MB");
const oversizedReserve = mockRpc(async () => reservationRow());
const oversizedReserveError = await expectFailure(
  () => reserveQcReport({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP_ID,
    expectedRowVersion: 2,
    fileSize: upload.QC_REPORT_MAX_BYTES + 1,
    callRpc: oversizedReserve.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(oversizedReserve.calls.length === 0, "an oversized PDF makes no reserve call");
assert(oversizedReserveError?.message === "PDF is larger than 2 MB (2.00 MB). Reduce it before uploading.", "reserve names the 2 MB limit");
const exactReserve = mockRpc(async (_token, name) => {
  if (name === QC_PREPARATION_READ_RPC) return [preparationRow()];
  if (name === QC_REPORT_LIST_RPC) return [];
  return reservationRow();
});
await reserveQcReport({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 2,
  fileSize: upload.QC_REPORT_MAX_BYTES,
  callRpc: exactReserve.callRpc,
});
assert(exactReserve.calls.some((call) => call.name === QC_REPORT_RESERVE_RPC), "a 2 MB PDF is accepted by reserve");
const oversizedRegister = mockRpc(async () => ({}));
await expectFailure(
  () => registerQcReport({
    productId: 262,
    accessToken: TOKEN,
    reservationId: RESERVATION_ID,
    expectedRowVersion: 2,
    objectId: OBJECT_ID,
    originalFileName: "lab.pdf",
    sha256: SHA,
    fileSize: upload.QC_REPORT_MAX_BYTES + 1,
    callRpc: oversizedRegister.callRpc,
  }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(oversizedRegister.calls.length === 0, "an oversized PDF makes no register call");
for (const missingSize of [undefined, null]) {
  const missingReserve = mockRpc(async () => reservationRow());
  const missingReserveError = await expectFailure(
    () => reserveQcReport({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP_ID,
      expectedRowVersion: 2,
      fileSize: missingSize,
      callRpc: missingReserve.callRpc,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(missingReserve.calls.length === 0, "reserve without fileSize makes no RPC call");
  assert(missingReserveError?.message === "QC test report was not accepted.", "reserve without fileSize is not accepted");
  const missingRegister = mockRpc(async () => ({}));
  const missingRegisterError = await expectFailure(
    () => registerQcReport({
      productId: 262,
      accessToken: TOKEN,
      reservationId: RESERVATION_ID,
      expectedRowVersion: 2,
      objectId: OBJECT_ID,
      originalFileName: "lab.pdf",
      sha256: SHA,
      fileSize: missingSize,
      callRpc: missingRegister.callRpc,
    }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(missingRegister.calls.length === 0, "register without fileSize makes no RPC call");
  assert(missingRegisterError?.message === "QC test report was not accepted.", "register without fileSize is not accepted");
}
const exactRegister = mockRpc(async () => ({ integrity_status: "UNVERIFIED_BYTES" }));
const exactRegistered = await registerQcReport({
  productId: 262,
  accessToken: TOKEN,
  reservationId: RESERVATION_ID,
  expectedRowVersion: 2,
  objectId: OBJECT_ID,
  originalFileName: "lab.pdf",
  sha256: SHA,
  fileSize: upload.QC_REPORT_MAX_BYTES,
  callRpc: exactRegister.callRpc,
});
assert(exactRegistered.ok === true && exactRegister.calls.length === 1, "a 2 MB PDF is accepted by register");
assert(!/service_role|SERVICE_ROLE|storage\.from|qc_preparation_verify_v1/.test(uploadSrc), "the upload worker has no service role or source verify call");

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const apiSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-api.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
for (const channel of [
  "eaushadhi-worker:qc-report-list",
  "eaushadhi-worker:qc-report-reserve",
  "eaushadhi-worker:qc-report-register",
  "eaushadhi-worker:qc-report-verify-bytes",
]) {
  assert(ipcSrc.includes(channel), `IPC defines ${channel}`);
  assert(preloadSrc.includes(channel), `preload maps ${channel}`);
}
for (const method of ["listQcReports", "reserveQcReport", "registerQcReport", "verifyQcReportBytes"]) {
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
  `const QC_REPORT_MAX_BYTES = 2 * 1024 * 1024;
   ${extractFunction("qcReportTooLargeMessage")}
   ${extractFunction("qcReportFileProblem")}
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
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "application/pdf", size: 0 }, pdfHeader) === "The PDF is empty.", "an empty file is rejected");
assert(flow.qcReportFileProblem({ name: "note.pdf", type: "application/pdf", size: 2097153 }, pdfHeader) === "PDF is larger than 2 MB (2.00 MB). Reduce it before uploading.", "a file over 2 MB is rejected");
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
      if (overrides.afterUpload) current = overrides.afterUpload();
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
    verify: overrides.verify,
    ...overrides.input,
  });
  return { result, calls, saved: overrides.saved };
}

const happy = await runFlow();
assert(happy.calls.join(",") === "reserve,upload:false,register,save", "upload order is reserve, upload, register, save");
assert(happy.saved.payload.report_filename === FILE_NAME && happy.saved.payload.report_sha256 === SHA, "the re-save payload carries the file name and SHA");
assert(String(happy.saved.payload.report_evidence_note).includes(SHA), "the regenerated note includes the SHA");
assert(happy.result.toast === "QC test report V01 registered; draft saved (version 3).", "success names the registered version");
const tooBig = await runFlow({ input: { file: { name: "big.pdf", size: 2097153 } } });
assert(tooBig.calls.length === 0 && tooBig.result.message === "PDF is larger than 2 MB (2.00 MB). Reduce it before uploading.", "an oversized PDF is rejected before any upload call");

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
const abandonedUpload = await runFlow({ afterUpload: () => false, removeFails: true });
assert(abandonedUpload.calls.includes("remove") && !abandonedUpload.calls.includes("register"), "a product switch after upload removes the object before register");
assert(abandonedUpload.result.warning.includes("Tell Jarvis/support."), "a failed cleanup after switching products stays as a persistent warning");
let verifyCalls = 0;
const autoVerified = await runFlow({
  verify: async () => {
    verifyCalls += 1;
    return { ok: true, integrity_status: "VERIFIED_BYTES", verified_sha256: SHA, verified_size_bytes: 1200, reasons: [] };
  },
});
assert(autoVerified.calls.join(",").endsWith("save") && verifyCalls === 1 && autoVerified.result.steps.at(-1) === "verify", "byte check runs once after the draft is saved");
const noAuto = await runFlow();
assert(!noAuto.result.steps.includes("verify"), "byte check is not called when the caller does not ask for it");
const staleReuse = await runFlow({
  input: {
    reserve: async () => ({ ok: true, reused: true, reservation: reservationRow() }),
  },
  registerResult: { ok: false, message: "Stale reservation — reload and retry" },
});
assert(staleReuse.result.offerNewVersion === true && staleReuse.calls.includes("remove") && !staleReuse.calls.includes("save"), "a stale reused reservation offers a new version and does not reserve again");

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
assert(registeredHtml.includes(`Test report: V01 registered \u2013 ${FILE_NAME}; SHA-256 ${SHA}. B1: Report registered (V01). B2: Server byte check: pending`), "card C shows the registered report");
assert(registeredHtml.includes("done (registered)"), "C2 is done when a report is registered");
assert(!registeredHtml.includes("bytes unverified"), "C2 no longer says the bytes are unverified");
assert(registeredHtml.includes("B3 — Evidence governance accepted") && registeredHtml.includes("— not done"), "other checklist items stay not done");
assert(registeredHtml.includes("B1: Report registered (V01)") && registeredHtml.includes("B2: Server byte check: pending"), "B1 and B2 are shown on the checklist");
assert(!registeredHtml.includes("READY"), "registered QC markup does not contain READY");
assert(!registeredHtml.includes("bytes not yet verified"), "a pending card does not use the old unverified sentence");
const emptyHtml = markup({ open: true, labs: [], protocolOptions: [], reasons: [], serverReasons: [], localHints: [] });
assert(emptyHtml.includes("No report uploaded. Upload in the Evidence tab."), "card C points to the Evidence tab when nothing is uploaded");

const cardApi = new Function(
  `${extractFunction("qcReportByteReasonText")}
   ${extractFunction("qcReportShowByteCheck")}
   ${extractFunction("qcTestReportCardHtml")}
   return qcTestReportCardHtml;`,
)();
const cardModel = {
  electron: true,
  productAllowed: true,
  canWrite: true,
  reports: [],
  nextLabel: "assigned at upload (next: V02)",
  nextFileName: "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V02.pdf",
  latestRegistered: {
    version_no: 1,
    status: "REGISTERED",
    expected_file_name: FILE_NAME,
    integrity_status: "UNVERIFIED_BYTES",
  },
};
const pendingCard = cardApi({ ...cardModel, integrityStatus: "UNVERIFIED_BYTES", byteCheck: "pending" });
assert(pendingCard.includes("Bytes not yet verified") && pendingCard.includes("btnQcReportCheckBytes"), "an unverified report offers a manual byte check");
assert(!extractFunction("loadQcReportList").includes("verifyQcReportBytes"), "loading the report list does not auto-run the byte check");
const objectChangedCard = cardApi({
  ...cardModel,
  verifyCode: "OBJECT_CHANGED",
  verifyError: "The stored file changed before the byte check finished.",
});
assert(objectChangedCard.includes("btnQcReportCheckBytes") && objectChangedCard.includes("stored file changed"), "OBJECT_CHANGED shows the retry button");
const mismatchCard = cardApi({
  ...cardModel,
  byteCheck: "mismatch",
  reasons: ["SHA256_MISMATCH", "SIZE_MISMATCH_STORAGE_METADATA", "SIZE_OUT_OF_RANGE_2MB", "NOT_PDF_HEADER"],
});
assert(mismatchCard.includes("file on server differs from the file you picked"), "mismatch explains a SHA difference");
assert(mismatchCard.includes("stored size does not match the storage metadata"), "mismatch explains a metadata size difference");
assert(mismatchCard.includes("over 2 MB") && mismatchCard.includes("not a PDF"), "mismatch explains size and header failures");
assert(mismatchCard.includes("This version is final. Upload a corrected file as a new version."), "mismatch says this version is final");
assert(mismatchCard.includes("is-failed") && !mismatchCard.includes("READY"), "mismatch stays visible without READY");
const verifiedCard = cardApi({
  ...cardModel,
  byteCheck: "verified",
  verifiedSha: SHA,
  verifiedSize: 1200,
});
assert(verifiedCard.includes("Bytes verified ✓") && verifiedCard.includes("<details") && verifiedCard.includes(SHA), "verified bytes show a badge and the SHA in details");
assert(verifiedCard.includes("is-verified") && !verifiedCard.includes("Bytes not yet verified") && !verifiedCard.includes("btnQcReportCheckBytes"), "verified bytes replace the pending check");
const chosen = {
  ...cardModel,
  latestRegistered: null,
  chosenName: "nupal.pdf",
  chosenSizeText: "1200 bytes (1.2 KB / 0.00 MB)",
  shaPreview: SHA,
};
const firstDraw = cardApi(chosen);
const secondDraw = cardApi(chosen);
assert(firstDraw.includes("Selected: nupal.pdf (1200 bytes (1.2 KB / 0.00 MB))") && secondDraw.includes("Selected: nupal.pdf (1200 bytes (1.2 KB / 0.00 MB))") && secondDraw.includes(SHA), "the selected file line survives a redraw");
assert(firstDraw.includes("btnQcReportClearFile") && firstDraw.includes("1200 bytes (1.2 KB / 0.00 MB)"), "the chosen file shows its size and a Clear button");
assert(extractFunction("qcTestReportCardModel").includes("state.qcReportFile"), "upload enablement uses the stored file");
assert(!extractFunction("submitQcReportUpload").includes("verifyQcReportBytes"), "register does not call the byte check");
assert(extractFunction("submitQcReportUpload").includes("This reservation is out of date. Reserve a new version"), "a stale reused reservation tells the operator to reserve a new version");
const confirmApi = new Function(
  `${extractFunction("qcReportByteCheckWarning")}
   ${extractFunction("runConfirmedQcReportByteCheck")}
   return { qcReportByteCheckWarning, runConfirmedQcReportByteCheck };`,
)();
let byteCalls = 0;
const denied = await confirmApi.runConfirmedQcReportByteCheck("01", () => false, async () => { byteCalls += 1; });
assert(denied === false && byteCalls === 0, "cancelling the byte-check warning makes no verify call");
const acceptedCheck = await confirmApi.runConfirmedQcReportByteCheck("01", () => true, async () => { byteCalls += 1; });
assert(acceptedCheck === true && byteCalls === 1, "confirming the byte-check warning calls verify once");
const asyncDenied = await confirmApi.runConfirmedQcReportByteCheck("01", async () => false, async () => { byteCalls += 1; });
assert(asyncDenied === false && byteCalls === 1, "async confirm false makes no verify call");
const asyncAccepted = await confirmApi.runConfirmedQcReportByteCheck("01", async () => true, async () => { byteCalls += 1; });
assert(asyncAccepted === true && byteCalls === 2, "async confirm true calls verify once");
assert(confirmApi.qcReportByteCheckWarning("01").includes("this version (V01) is permanently marked BYTES_MISMATCH"), "the warning names the version");
const submitByteCheckSrc = extractFunction("submitQcReportByteCheck");
assert(submitByteCheckSrc.includes("runConfirmedQcReportByteCheck") && submitByteCheckSrc.includes("verifyQcReportBytes"), "only the button path calls the byte check");
const qcFlowStart = controlSrc.indexOf("function qcReportByteCheckWarning");
const qcFlowEnd = controlSrc.indexOf("async function reserveNewQcReportVersion");
assert(qcFlowStart >= 0 && qcFlowEnd > qcFlowStart && !controlSrc.slice(qcFlowStart, qcFlowEnd).includes("window.confirm"), "the QC report flow contains no window.confirm");
const confirmGuard = submitByteCheckSrc.indexOf("qcReportConfirmOpen");
const verifyGuard = submitByteCheckSrc.indexOf("qcReportVerifying");
const modalCall = submitByteCheckSrc.indexOf("runConfirmedQcReportByteCheck");
assert(confirmGuard >= 0 && verifyGuard >= 0 && confirmGuard < modalCall && verifyGuard < modalCall, "submitQcReportByteCheck checks confirm and verifying before the modal");
assert(extractFunction("reserveNewQcReportVersion").includes("fileSize"), "reserve new version passes fileSize");

function installQcConfirmDom() {
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.id = "";
      this.className = "";
      this.textContent = "";
      this.type = "";
      this.tabIndex = 0;
      this.hidden = false;
      this.disabled = false;
      this.offsetParent = {};
      this.attrs = {};
      this.listeners = new Map();
    }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name]; }
    append(...nodes) {
      for (const node of nodes) {
        node.parentNode = this;
        this.children.push(node);
      }
    }
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }
    addEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      list.push(fn);
      this.listeners.set(type, list);
    }
    removeEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      this.listeners.set(type, list.filter((item) => item !== fn));
    }
    dispatch(type, event) {
      for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
    }
    focus() { globalThis.document.activeElement = this; }
    click() { this.dispatch("click", { target: this, currentTarget: this }); }
    querySelectorAll() {
      const found = [];
      const walk = (node) => {
        for (const child of node.children) {
          found.push(child);
          walk(child);
        }
      };
      walk(this);
      return found;
    }
  }
  const body = new El("body");
  const button = new El("button");
  button.id = "btnQcReportCheckBytes";
  body.append(button);
  const keyListeners = [];
  const document = {
    body,
    activeElement: button,
    createElement(tag) { return new El(tag); },
    getElementById(id) {
      const all = [body, ...body.querySelectorAll()];
      return all.find((el) => el.id === id) || null;
    },
    addEventListener(type, fn) {
      if (type === "keydown") keyListeners.push(fn);
    },
    removeEventListener(type, fn) {
      if (type !== "keydown") return;
      const index = keyListeners.indexOf(fn);
      if (index >= 0) keyListeners.splice(index, 1);
    },
  };
  globalThis.document = document;
  return {
    document,
    button,
    press(key) {
      const event = { key, shiftKey: false, preventDefault() {}, stopPropagation() {} };
      for (const fn of [...keyListeners]) fn(event);
    },
  };
}

const modalApi = new Function(
  `${extractFunction("openQcConfirm")}
   ${extractFunction("openQcByteCheckConfirm")}
   return openQcByteCheckConfirm;`,
)();
const confirmDom = installQcConfirmDom();
const warning = confirmApi.qcReportByteCheckWarning("01");
const escaped = modalApi(warning);
confirmDom.press("Escape");
assert(await escaped === false, "Esc resolves the byte-check confirm false");
assert(confirmDom.document.getElementById("qcByteCheckConfirmBackdrop") == null, "Esc removes the byte-check confirm");
assert(confirmDom.document.activeElement === confirmDom.button, "Esc returns focus to Check bytes on server");
const cancelled = modalApi(warning);
confirmDom.document.getElementById("qcByteCheckConfirmCancel").click();
assert(await cancelled === false, "Cancel resolves the byte-check confirm false");
const acceptedModal = modalApi(warning);
assert(confirmDom.document.activeElement?.id === "qcByteCheckConfirmCancel", "the confirm focuses Cancel");
assert(confirmDom.document.getElementById("qcByteCheckConfirmTitle").textContent === "Check bytes on server", "the confirm title is Check bytes on server");
assert(confirmDom.document.getElementById("qcByteCheckConfirmBody").children[0].textContent === warning, "the confirm body is the byte-check warning");
confirmDom.document.getElementById("qcByteCheckConfirmOk").click();
assert(await acceptedModal === true, "OK resolves the byte-check confirm true");
const held = modalApi(warning);
const secondOpen = await modalApi(warning);
assert(secondOpen === false, "a second byte-check confirm resolves false while one is showing");
confirmDom.document.getElementById("qcByteCheckConfirmBackdrop").dispatch("click", {
  target: confirmDom.document.getElementById("qcByteCheckConfirmBackdrop"),
});
assert(await held === false, "a backdrop click resolves the byte-check confirm false");
delete globalThis.document;
const selection = new Function(
  `const state = {
     qcReportFile: { name: "nupal.pdf", size: 1200 },
     qcReportSha: "abc",
     qcReportFileError: "",
     qcReportFileProductId: 262,
     qcReportFilePreparationId: "prep-1",
   };
   ${extractFunction("clearQcReportSelectionIfScopeChanged")}
   const kept = clearQcReportSelectionIfScopeChanged(262, "prep-1");
   const keptName = state.qcReportFile && state.qcReportFile.name;
   const cleared = clearQcReportSelectionIfScopeChanged(261, "prep-1");
   return { kept, keptName, cleared, file: state.qcReportFile };`,
)();
assert(selection.kept === false && selection.keptName === "nupal.pdf", "the same product keeps the selected file");
assert(selection.cleared === true && selection.file === null, "a product change clears the selected file");
assert(!extractFunction("submitQcReportUpload").includes("input.files"), "upload does not read the file input after a redraw");
assert(!extractFunction("submitQcReportUpload").includes("forceNew: true"), "upload does not force a new reservation");
assert(extractFunction("reserveNewQcReportVersion").includes("forceNew: true"), "a new version is reserved only from the explicit action");
const pwaCard = cardApi({ electron: false });
assert(!pwaCard.includes("btnQcReportCheckBytes") && !pwaCard.includes("btnQcReportUpload"), "the PWA card stays read-only");
const notesApi = new Function(
  `const QC_PREP_BATCH_TEXT_RE = /^[A-Za-z0-9.\\/_-]+(?:,[A-Za-z0-9.\\/_-]+)*$/;
   ${extractFunction("qcPrepDateYearImplausible")}
   ${extractFunction("qcPrepBatchTextInvalid")}
   ${extractFunction("qcPrepFmtDate")}
   ${extractFunction("qcPrepGeneratedNotes")}
   return qcPrepGeneratedNotes;`,
)();
const v02Name = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V02.pdf";
const v02Note = notesApi({
  report_date: "2024-10-15",
  batches: "A101,A102",
  source_report_issuer: "NUPAL",
  report_filename: v02Name,
  report_sha256: SHA,
}, []);
assert(v02Note.report_evidence_note.includes(v02Name), "the report note uses a canonical V02 file name");
const fallbackNote = notesApi({
  report_date: "2024-10-15",
  batches: "A101,A102",
  source_report_issuer: "NUPAL",
  report_filename: "lab.pdf",
}, []);
assert(fallbackNote.report_evidence_note.includes("EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf"), "a non-canonical report name falls back to V01");
const edgeBytes = readFileSync(join(root, "supabase/functions/eaushadhi-qc-report-verify/index.ts"));
assert(edgeBytes.length === 4592, "edge function is 4592 bytes");
assert(createHash("sha256").update(edgeBytes).digest("hex") === "c469594ae10e5aafb1520b02cbc771c0de90ce0a5927f4238fd8af16a9b5044f", "edge function sha256 matches");
for (const relative of [
  "electron/eaushadhi-worker/qc-report-upload.js",
  "electron/eaushadhi-worker/ipc.js",
  "preload.js",
  "public/shared/js/eaushadhi-review-control.js",
  "public/shared/js/eaushadhi-review-worker-client.js",
  "public/shared/js/eaushadhi-review-api.js",
]) {
  assert(!/service_role|SERVICE_ROLE/.test(readFileSync(join(root, relative), "utf8")), `${relative} has no service role string`);
}
assert(!extractFunction("qcPrepWorkspaceHtml").includes("READY"), "QC register markup does not contain READY");
assert(extractFunction("qcReadinessSummaryText").includes("B1: Report registered") && extractFunction("qcReadinessSummaryText").includes("B2: Server byte check:"), "the readiness summary shows B1 and B2");
assert(!extractFunction("qcReadinessSummaryText").includes("READY"), "the readiness summary does not say READY");

if (failed) {
  console.error(`\n${failed} qc report upload assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-qc-report-upload-smoke: all assertions passed");
