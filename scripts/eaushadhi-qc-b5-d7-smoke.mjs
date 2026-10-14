import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { QC_PORTAL_CONTRACT } = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { decideSaveClick } = require(join(root, "electron/eaushadhi-worker/qc-register-save-guard.js"));
const { classifyQcSaveObservation, createInPageSaveObserveScript } = require(join(root, "electron/eaushadhi-worker/qc-register-save-observe.js"));
const { createInPageQcFillScript } = require(join(root, "electron/eaushadhi-worker/qc-register-dom-fill.js"));
const { assessQcListDuplicate, assessQcListResponse } = require(join(root, "electron/eaushadhi-worker/qc-register-list.js"));
const {
  compareReportBytes,
  createQcPrepRunExecutor,
  recoveryDisposition,
  verifyDisplay,
} = require(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"));
const { recordQcPrepRunSave } = require(join(root, "electron/eaushadhi-worker/qc-preparation-workspace.js"));

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const observeSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-register-save-observe.js"), "utf8");
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const fixture = readFileSync(join(root, "scripts/fixtures/qc-addQCRegister-offline.html"), "utf8");
const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RUN = "11111111-1111-4111-8111-111111111111";
const FILL = {
  typeOfStudy: "Cross Sectional Approach (API Vol VIII Page No:226)",
  startDate: "2021-10-01",
  endDate: "2024-09-30",
  reportDate: "2024-10-15",
  batchNo: "3369,4896,2434,3250,3738,4601,5201",
  duration: "36",
  labName: "3980",
  qualityCntrl: "Out",
};

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

function element(id, props = {}) {
  const el = {
    id,
    _value: props.value || "",
    text: props.text || "",
    checked: false,
    files: props.files || [],
    options: props.options || [],
    selectedIndex: 0,
    listeners: {},
    textContent: props.text || "",
    get value() { return this._value; },
    set value(next) {
      this._value = next == null ? "" : String(next);
      if (this.options.length) {
        const index = this.options.findIndex((option) => option.value === this._value);
        if (index >= 0) this.selectedIndex = index;
      }
    },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    dispatchEvent(event) { if (this.listeners[event.type]) this.listeners[event.type](); },
  };
  el.value = props.value || "";
  return el;
}

function installDocument(map) {
  global.document = {
    getElementById(id) { return map[id] || null; },
    querySelectorAll() { return []; },
  };
  global.requestAnimationFrame = (fn) => fn();
  global.Event = class Event { constructor(type) { this.type = type; } };
}

const fields = {
  typeofstudy: element("typeofstudy", {
    value: "",
    options: [{ value: "", text: "Select" }, { value: "493", text: "Others" }],
  }),
  otherText: element("otherText"),
  sdate: element("sdate"),
  edate: element("edate"),
  reportdate: element("reportdate"),
  duration: element("duration"),
  batchno: element("batchno"),
  qc_in: element("qc_in", { value: "In" }),
  qc_out: element("qc_out", { value: "Out" }),
  lab_name: element("lab_name", { value: "", options: [{ value: "", text: "Select" }, { value: "3980", text: "HARIDEV FORMULATIONS" }] }),
};
fields.sdate.addEventListener("change", () => { fields.duration.value = "0"; });
fields.edate.addEventListener("change", () => { fields.duration.value = "0"; });
fields.typeofstudy.options = [{ value: "", text: "Select" }, { value: "493", text: "Others" }];
installDocument(fields);
const fillFn = new Function(createInPageQcFillScript())();
const filled = await fillFn({ fillFields: FILL, studyTypeSelectValue: "493" });
assert(filled.filled_values.duration === "36", "duration is restored after date change");
assert(filled.filled_values.typeOfStudy === FILL.typeOfStudy, "Others text is read back as typeOfStudy");
assert(Object.keys(filled.filled_values).length === 8, "readback has eight keys");
assert(filled.filled_values.qualityCntrl === "Out", "quality control reads the checked value");
assert(fixture.includes('id="save_btn"') && fixture.includes("Submit"), "fixture keeps the captured Submit label");
assert(fixture.includes('id="duration"'), "fixture includes the duration control");

assert(QC_PORTAL_CONTRACT.nativeSaveClickEnabled === false, "native Save stays disabled");
assert(QC_PORTAL_CONTRACT.saveControlCapturedText === "Submit", "captured save control text is Submit");
const refused = decideSaveClick({ control: { id: "save_btn", text: "Submit" } });
assert(refused.allow === false && refused.click === "not-clicked", "Submit target is not clicked");
const enabled = decideSaveClick({
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
  control: { id: "save_btn", text: "Save" },
});
assert(enabled.allow === true, "a control labelled Save can pass the guard only when enabled");
const stillSubmit = decideSaveClick({
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
  control: { id: "save_btn", text: "Submit" },
});
assert(stillSubmit.allow === false && stillSubmit.reason === "SUBMIT_TARGET", "enabling the flag still refuses Submit");
const clickAt = observeSrc.indexOf("target.click()");
const guardAt = observeSrc.indexOf('text !== "Save"');
assert(clickAt > guardAt && guardAt > 0, "the observe script returns before clicking a non-Save control");
assert(!/getElementById\(["']submit["']\)/.test(observeSrc), "no Submit id is clicked");

const reportName = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const goodBytes = Buffer.from("qc-report-bytes");
const goodSha = createHash("sha256").update(goodBytes).digest("hex");
const mismatch = compareReportBytes({
  name: reportName,
  bytes: Buffer.from("other"),
  context: { report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName },
});
assert(mismatch.ok === false, "SHA mismatch is refused");
const match = compareReportBytes({
  name: reportName,
  bytes: goodBytes,
  context: { report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName },
});
assert(match.ok === true, "matching PDF bytes pass");

const calls = [];
const callRpc = async (_token, name, args) => {
  calls.push({ name, args });
  if (name === "rpc_eaushadhi_qc_prep_run_pre_save_v1") {
    return { go: false, run_status: "PRE_SAVE_ABORTED", reasons: ["FILLED_VALUE_DIFFERS:duration"], qualification: {} };
  }
  if (name === "rpc_eaushadhi_qc_prep_run_record_save_v1") {
    return { run_status: args.p_save_outcome === "AMBIGUOUS" ? "SAVE_AMBIGUOUS" : "SAVE_CONFIRMED", reasons: [], auto_retry: false, qualification: {} };
  }
  return {};
};
let attached = 0;
const live = {
  async pageIdentity() {
    return {
      origin: QC_PORTAL_CONTRACT.origin,
      route: QC_PORTAL_CONTRACT.route,
      productId: { value: "9001" },
      actiontype: { value: "add" },
      hiddenId: { value: "" },
      saveData: true,
      saveControl: { present: true, id: "save_btn", text: "Submit" },
    };
  },
  async readList() {
    return { settled: true, success: true, coverageComplete: true, rows: [], domRowIds: [] };
  },
  async attach() { attached += 1; return { length: 1, name: reportName }; },
  async fill() { return { filled_values: { ...FILL, duration: "0" } }; },
  async observeSave() { throw new Error("observe should not run"); },
};
const executor = createQcPrepRunExecutor({ live });
const blockedPreSave = await executor.preSave({
  productId: 262,
  accessToken: TOKEN,
  userConfirmed: true,
  callRpc,
});
assert(blockedPreSave.clickState === "not-clicked", "pre-save is not called when Save is labelled Submit");
assert(calls.length === 0, "no server call is made for a refused Save");
assert(recoveryDisposition({ clickState: "not-clicked", observed: false }, "SAVE_ARMED") === "DEFINITELY_NOT_CLICKED", "a refused click stays definitely not clicked");

const ambiguous = classifyQcSaveObservation({
  clicked: true,
  settled: true,
  status: "1",
  matchingRequestCount: 1,
  listDelta: "unknown",
});
assert(ambiguous.outcome === "AMBIGUOUS", "a success response without a proven row is ambiguous");
const confirmed = classifyQcSaveObservation({
  clicked: true,
  settled: true,
  status: "1",
  matchingRequestCount: 1,
  invokeCount: 1,
  listDelta: "one-match",
});
assert(confirmed.outcome === "CONFIRMED", "one matching new row can be confirmed");
assert(verifyDisplay({ run_status: "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED", fully_verified: true }).text
  === "Row verified — document not verified (trusted document check not available yet)", "verified wording never says fully verified");
assert(verifyDisplay({ run_status: "ROW_MISMATCH", differences: ["batchNo"] }).text
  === "The saved row does not match. It was not verified.", "mismatch wording is blocking");

const dup = assessQcListDuplicate({
  success: true,
  coverageComplete: true,
  rows: [{ product_name: "Karpooradi Thailam" }],
}, FILL);
assert(dup.code === "DUPLICATE_UNPROVEN", "unmapped list rows refuse arm");

let records = 0;
const recordingRpc = async (_token, name, args) => {
  if (name === "rpc_eaushadhi_qc_prep_run_record_save_v1") {
    records += 1;
    assert(args.p_save_evidence.action === "SAVE", "record evidence action is SAVE");
    assert(args.p_save_evidence.submitted !== true, "record evidence does not submit");
    return { run_status: "SAVE_AMBIGUOUS", reasons: [], auto_retry: false };
  }
  if (name === "rpc_eaushadhi_qc_prep_run_preflight_v1") {
    return { blockers: [], readiness: { status: "READY_PROVISIONAL", readiness_tuple: "tuple" }, fill_fields: FILL, context: {}, runs: [{ run_id: RUN, run_status: "SAVE_ARMED" }] };
  }
  return {};
};
const armedLive = {
  ...live,
  async pageIdentity() {
    return { ...(await live.pageIdentity()), saveControl: { id: "save_btn", text: "Save" } };
  },
  async observeSave() {
    return { clicked: true, settled: false, matchingRequestCount: 0 };
  },
};
const armedExecutor = createQcPrepRunExecutor({
  live: armedLive,
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true, nativeSaveBlockedReason: "" },
});
armedExecutor.status();
const sessionHolder = armedExecutor;
await sessionHolder.arm({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  provisionalAck: true,
  provisionalNote: "I acknowledge the provisional laboratory selection for this portal row.",
  derivedAck: false,
  derivedNote: "",
  callRpc: async (_token, name) => {
    if (name.endsWith("preflight_v1")) {
      return {
        blockers: [],
        readiness: { status: "READY", readiness_tuple: "tuple-ready" },
        fill_fields: FILL,
        context: { portal_product_ref: "9001", derived_facts: [], report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName, study_type_select_value: "493" },
        runs: [],
      };
    }
    if (name.endsWith("arm_v1")) {
      return { run_id: RUN, run_status: "SAVE_ARMED", fill_fields: FILL, projection_sha256: "ab".repeat(32), qualification: { statement: "Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified." } };
    }
    return {};
  },
});
await sessionHolder.fill({
  productId: 262,
  accessToken: TOKEN,
  callRpc: async () => ({ go: false, run_status: "PRE_SAVE_ABORTED", reasons: ["FILLED_VALUE_DIFFERS:duration"] }),
});
assert(attached === 0, "a mismatched fill does not attach a file");

let saveListReads = 0;
const saveExecutor = createQcPrepRunExecutor({
  live: {
    ...armedLive,
    async fill() { return { filled_values: { ...FILL } }; },
    async observeSave() { return { clicked: true, settled: true, status: "1", matchingRequestCount: 1 }; },
    async readList() {
      saveListReads += 1;
      if (saveListReads === 1) {
        return { settled: true, success: true, coverageComplete: true, rows: [], domRowIds: [] };
      }
      return { settled: true, success: true, coverageComplete: true, rows: [{ only: "name" }], domRowIds: [] };
    },
  },
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
});
const armRpc = async (_token, name) => {
  if (name.endsWith("preflight_v1")) {
    return {
      blockers: [],
      readiness: { status: "READY", readiness_tuple: "tuple-ready" },
      fill_fields: FILL,
      context: { portal_product_ref: "9001", derived_facts: [], report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName, study_type_select_value: "493", report_issuer: "NUPAL", laboratory_label: "HARIDEV FORMULATIONS" },
      runs: [],
    };
  }
  if (name.endsWith("arm_v1")) {
    return { run_id: RUN, run_status: "SAVE_ARMED", fill_fields: FILL, projection_sha256: "cd".repeat(32), qualification: {} };
  }
  if (name.endsWith("pre_save_v1")) {
    return { go: true, pre_save_token: "22222222-2222-4222-8222-222222222222", valid_until: new Date(Date.now() + 60000).toISOString(), single_use: true };
  }
  if (name.endsWith("record_save_v1")) {
    records += 1;
    return { run_status: "SAVE_AMBIGUOUS", reasons: [], auto_retry: false };
  }
  return {};
};
await saveExecutor.arm({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  provisionalAck: false,
  derivedAck: false,
  callRpc: armRpc,
});
await saveExecutor.fill({ productId: 262, accessToken: TOKEN, callRpc: armRpc });
const checked = await saveExecutor.checkPdf({ productId: 262, accessToken: TOKEN, filename: reportName, bytes: goodBytes, callRpc: armRpc });
assert(checked.ok === true, "matching PDF attaches");
const pre = await saveExecutor.preSave({ productId: 262, accessToken: TOKEN, userConfirmed: true, callRpc: armRpc });
assert(pre.ok === true && pre.pre_save_token == null && pre.token == null, "the pre-save token is not returned to the caller");
const saved = await saveExecutor.save({ productId: 262, accessToken: TOKEN, callRpc: armRpc });
assert(saved.runStatus === "SAVE_AMBIGUOUS", "ambiguous save is recorded");
let second = false;
try {
  await saveExecutor.save({ productId: 262, accessToken: TOKEN, callRpc: armRpc });
} catch {
  second = true;
}
assert(second && records === 1, "a second Save record is refused");

const refusedRecord = await recordQcPrepRunSave({
  accessToken: TOKEN,
  runId: RUN,
  preSaveToken: RUN,
  saveOutcome: "CONFIRMED",
  saveEvidence: { action: "SAVE", submitted: true },
  callRpc: recordingRpc,
}).then(() => false).catch((error) => error.message);
assert(String(refusedRecord).includes("Submit is not allowed"), "submitted evidence is refused before the server call");

const missingControl = decideSaveClick({
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
  control: null,
});
assert(missingControl.allow === false && missingControl.click === "not-clicked", "a missing Save control is not clicked");

let wrongPageArmed = 0;
let wrongPageMessage = "";
try {
  await createQcPrepRunExecutor({
    live: {
      async pageIdentity() {
        return { origin: "https://example.invalid", route: "/admin/other", productId: { value: "1" }, actiontype: { value: "add" }, hiddenId: { value: "" }, saveData: false, saveControl: { id: "save_btn", text: "Submit" } };
      },
      async readList() {
        return { settled: true, success: true, coverageComplete: true, rows: [], domRowIds: [] };
      },
    },
  }).arm({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP,
    userConfirmed: true,
    callRpc: async (_token, name) => {
      if (name.endsWith("arm_v1")) wrongPageArmed += 1;
      return {
        blockers: [],
        readiness: { status: "READY", readiness_tuple: "tuple-ready" },
        fill_fields: FILL,
        context: { portal_product_ref: "9001", derived_facts: [] },
        runs: [],
      };
    },
  });
} catch (error) {
  wrongPageMessage = error.message;
}
assert(wrongPageArmed === 0 && wrongPageMessage.includes("Nothing was armed"), "the wrong page does not arm");

let recoverRecords = 0;
const recoverExecutor = createQcPrepRunExecutor({ live });
await recoverExecutor.arm({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  callRpc: async (_token, name) => {
    if (name.endsWith("preflight_v1")) {
      return { blockers: [], readiness: { status: "READY", readiness_tuple: "tuple-ready" }, fill_fields: FILL, context: { portal_product_ref: "9001", derived_facts: [] }, runs: [] };
    }
    if (name.endsWith("arm_v1")) {
      return { run_id: RUN, run_status: "SAVE_ARMED", fill_fields: FILL, projection_sha256: "ef".repeat(32), qualification: {} };
    }
    return {};
  },
});
const recovered = await recoverExecutor.recover({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  callRpc: async (_token, name) => {
    if (name.endsWith("record_save_v1")) recoverRecords += 1;
    if (name.endsWith("preflight_v1")) {
      return { blockers: [], readiness: { status: "READY", readiness_tuple: "tuple-ready" }, fill_fields: FILL, context: {}, runs: [{ run_id: RUN, run_status: "SAVE_ARMED" }] };
    }
    return {};
  },
});
assert(recovered.disposition === "DEFINITELY_NOT_CLICKED" && recoverRecords === 0, "a run that was not clicked is not recorded again");

let expiredObserved = 0;
const expiredExecutor = createQcPrepRunExecutor({
  live: {
    ...armedLive,
    async fill() { return { filled_values: { ...FILL } }; },
    async observeSave() { expiredObserved += 1; return { clicked: true }; },
    async readList() { return { settled: true, success: true, coverageComplete: true, rows: [], domRowIds: [] }; },
  },
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
});
await expiredExecutor.arm({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  callRpc: armRpc,
});
await expiredExecutor.fill({ productId: 262, accessToken: TOKEN, callRpc: armRpc });
await expiredExecutor.checkPdf({ productId: 262, accessToken: TOKEN, filename: reportName, bytes: goodBytes, callRpc: armRpc });
const beforeExpiredRecords = records;
await expiredExecutor.preSave({
  productId: 262,
  accessToken: TOKEN,
  userConfirmed: true,
  callRpc: async (_token, name) => {
    if (name.endsWith("pre_save_v1")) {
      return { go: true, pre_save_token: "33333333-3333-4333-8333-333333333333", valid_until: new Date(Date.now() - 1000).toISOString(), single_use: true };
    }
    return armRpc(_token, name);
  },
});
const expired = await expiredExecutor.save({ productId: 262, accessToken: TOKEN, callRpc: armRpc });
assert(expired.clickState === "not-clicked" && expiredObserved === 0 && records === beforeExpiredRecords, "an expired token is not clicked and not recorded");

const listedRow = { ...FILL, id: "77" };
const verifyExecutor = createQcPrepRunExecutor({
  live: {
    async readList() {
      return { settled: true, success: true, coverageComplete: true, rows: [listedRow], domRowIds: [{ value: "77" }] };
    },
  },
});
const verified = await verifyExecutor.verify({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  callRpc: async (_token, name) => {
    if (name.endsWith("preflight_v1")) {
      return { blockers: [], readiness: {}, fill_fields: FILL, context: {}, runs: [{ run_id: RUN, run_status: "SAVE_CONFIRMED" }] };
    }
    if (name.endsWith("verify_row_v1")) {
      return { run_status: "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED", fully_verified: true, document_verified: false };
    }
    return {};
  },
});
assert(verified.display.text === "Row verified — document not verified (trusted document check not available yet)", "a restart verify still withholds full verification");

const emptyPage = assessQcListResponse({ status: "1", data: [] }, { pageno: 0 });
assert(emptyPage.success === true && emptyPage.coverageComplete === false && emptyPage.reason === "LIST_TOTAL_UNPROVEN", "an empty page without a total is not complete");
const provenEmpty = assessQcListResponse({ status: "1", data: [], recordsTotal: 0 }, { pageno: 0 });
assert(provenEmpty.coverageComplete === true && provenEmpty.totalCount === 0, "page 0 with total 0 is complete");
const partialPage = assessQcListResponse({ status: "1", data: [{ id: "1" }], total: 2 }, { pageno: 0 });
assert(partialPage.coverageComplete === false && partialPage.reason === "LIST_COVERAGE_UNPROVEN", "a short page is not complete");
const unpaged = assessQcListResponse({ status: "1", data: [], total: 0 }, {});
assert(unpaged.coverageComplete === false && unpaged.reason === "LIST_PAGE_UNPROVEN", "a total without page 0 is not complete");

const executorSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"), "utf8");
const inspectBody = executorSrc.slice(executorSrc.indexOf("async inspect"), executorSrc.indexOf("async verify"));
assert(!/armQcPrepRun|observeSave|SaveData|save_btn|target\.click/.test(inspectBody), "the portal check does not arm or press Save");
assert(QC_PORTAL_CONTRACT.nativeSaveClickEnabled === false, "native Save remains disabled for the dry run");

let inspectArmCalls = 0;
const inspectResult = await createQcPrepRunExecutor({
  live: {
    async pageIdentity() {
      return { origin: QC_PORTAL_CONTRACT.origin, route: QC_PORTAL_CONTRACT.route, productId: { value: "9001" }, actiontype: { value: "add" }, hiddenId: { value: "" }, saveData: true, saveControl: { id: "save_btn", text: "Submit" } };
    },
    async readList() {
      return assessQcListResponse({ status: "1", data: [] }, { pageno: 0 });
    },
    async readPortalFacts() {
      return { laboratory: { options: [{ value: "HARIDEV FORMULATIONS", label: "HARIDEV FORMULATIONS" }] }, studyType: { options: [{ value: "Others", label: "Others" }] } };
    },
    async observeSave() { throw new Error("inspect must not observe Save"); },
    async attach() { throw new Error("inspect must not attach"); },
  },
}).inspect({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  filename: reportName,
  bytes: Buffer.from("other"),
  callRpc: async (_token, name) => {
    if (name.endsWith("arm_v1") || name.endsWith("record_save_v1") || name.endsWith("pre_save_v1")) inspectArmCalls += 1;
    if (name.endsWith("preflight_v1")) {
      return {
        blockers: [],
        readiness: { status: "READY_PROVISIONAL" },
        fill_fields: FILL,
        protocol_mapping: { mapping_id: 32, mapping_status: "VERIFIED" },
        context: { portal_product_ref: "9001", study_type_select_value: "Others", report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName },
        runs: [],
      };
    }
    return {};
  },
});
assert(inspectArmCalls === 0 && inspectResult.armed === false && inspectResult.clickedSave === false, "the portal check does not arm or click");
assert(inspectResult.nativeSaveEnabled === false && inspectResult.list.coverageComplete === false, "the check keeps Save disabled and reports unproven coverage");
assert(inspectResult.laboratory.optionPresent === false, "a laboratory name is not treated as the frozen portal id");
assert(inspectResult.report?.attached === false && inspectResult.report?.ok === false, "a mismatched PDF is not attached");

assert(controlSrc.includes("Save only; Submit is not allowed."), "the review modal says Save only");
assert(readFileSync(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"), "utf8").includes("Row verified — document not verified (trusted document check not available yet)"), "row verified wording is the document-not-verified sentence");
assert(!controlSrc.includes("fully verified"), "the screen does not say fully verified");
assert(controlSrc.includes(QC_PORTAL_CONTRACT.saveControlCapturedText) || controlSrc.includes("labelled Submit"), "the screen explains the Submit label");
assert(/const CACHE_NAME = "hub-cache-v365"/.test(swSrc), "service worker cache is v365");

if (failed) {
  console.error(`D7 smoke failed: ${failed}`);
  process.exit(1);
}
console.log("D7 smoke passed");
