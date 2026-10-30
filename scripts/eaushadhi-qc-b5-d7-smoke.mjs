import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { QC_PORTAL_CONTRACT } = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { decideSaveClick } = require(join(root, "electron/eaushadhi-worker/qc-register-save-guard.js"));
const { classifyQcSaveObservation, createInPageSaveObserveScript, createInPageSaveWatchScript } = require(join(root, "electron/eaushadhi-worker/qc-register-save-observe.js"));
const { createInPageIdentityScript, createInPageQcFillScript } = require(join(root, "electron/eaushadhi-worker/qc-register-dom-fill.js"));
const { assessQcListDuplicate, assessQcListResponse, mapGetqcDataResponse } = require(join(root, "electron/eaushadhi-worker/qc-register-list.js"));
const { buildQcRecapture, createInPageRecaptureScript, parseSaveDataQcdetailsKeys } = require(join(root, "electron/eaushadhi-worker/qc-register-recapture.js"));
const {
  assessPageIdentity,
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
const PORTAL_REF = "MTIzNDU2NzgxMjM0NTY3ODEyMzQ1Njc4MTIzNG8atnUB3i77xOliuhhG1VsNyCEv7W0";
const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
function qcPage(overrides = {}) {
  return {
    origin: QC_PORTAL_CONTRACT.origin,
    route: QC_PORTAL_CONTRACT.route,
    heading: "Q.C (Quality Control) Register",
    productId: { value: "1234" },
    productSelected: { value: "1234", text: " Karpooradi Thailam " },
    productOptions: [
      { value: "-1", text: "--Select--" },
      { value: "1234", text: "Karpooradi Thailam" },
      { value: "77", text: "Other Oil" },
    ],
    actiontype: { value: "add" },
    hiddenId: { value: "" },
    saveData: true,
    saveControl: { present: true, id: "save_btn", text: "Submit" },
    ...overrides,
  };
}
const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RUN = "11111111-1111-4111-8111-111111111111";
const FILL = {
  typeOfStudy: "Cross Sectional Approach (API Vol VIII Page No:226)",
  startDate: "2021-10-01",
  endDate: "2024-09-30",
  reportDate: "2024-10-15",
  batchNo: "3369,4896,2434,3250,3738,4601,5201",
  duration: "36",
  labName: "HARIDEV FORMULATIONS",
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

const studyOptions = [
  { value: "", text: "Select" },
  { value: "3 Month Accelarated Stability", text: "3 Month Accelarated Stability" },
  { value: "6 Month Accelarated Stability", text: "6 Month Accelarated Stability" },
  { value: "Real Time Stability", text: "Real Time Stability" },
  { value: "N/A", text: "N/A" },
  { value: "Others", text: "Others" },
];
const fields = {
  typeofstudy: element("typeofstudy", { value: "", options: studyOptions }),
  otherText: element("otherText"),
  sdate: element("sdate"),
  edate: element("edate"),
  reportdate: element("reportdate"),
  duration: element("duration"),
  batchno: element("batchno"),
  qc_in: element("qc_in", { value: "In" }),
  qc_out: element("qc_out", { value: "Out" }),
  lab_name: element("lab_name", {
    value: "",
    options: [
      { value: "-1", text: "--Select--" },
      { value: "HARIDEV FORMULATIONS", text: "HARIDEV FORMULATIONS" },
      { value: "Other", text: "Other" },
    ],
  }),
};
fields.sdate.addEventListener("change", () => { fields.duration.value = "0"; });
fields.edate.addEventListener("change", () => { fields.duration.value = "0"; });
installDocument(fields);
const fillFn = new Function(createInPageQcFillScript())();
const filled = await fillFn({ fillFields: FILL, studyTypeSelectValue: "Others" });
assert(filled.filled_values.duration === "36", "duration is restored after date change");
assert(fields.typeofstudy.value === "Others", "the type of study option value is Others");
assert(fields.otherText.value === FILL.typeOfStudy, "Others text is the server description");
assert(filled.filled_values.typeOfStudy === FILL.typeOfStudy, "the filled type of study equals the server projection");
assert(Object.keys(filled.filled_values).length === 8, "readback has eight keys");
assert(filled.filled_values.qualityCntrl === "Out", "quality control reads the checked value");
assert(fixture.includes('id="save_btn"') && fixture.includes("Submit"), "fixture keeps the captured Submit label");
assert(fixture.includes('id="duration"'), "fixture includes the duration control");

assert(QC_PORTAL_CONTRACT.nativeSaveClickEnabled === false, "native Save stays disabled");
assert(QC_PORTAL_CONTRACT.saveControlCapturedText === "Submit", "captured save control text is Submit");
const passingPage = {
  route: QC_PORTAL_CONTRACT.route,
  saveData: true,
};
const passingControl = {
  id: "save_btn",
  text: "Submit",
  onclick: "function () { return SaveData(); }",
};
const refused = decideSaveClick({ control: passingControl, page: passingPage });
assert(refused.allow === false && refused.reason === "NATIVE_SAVE_BUILD_OFF" && refused.click === "not-clicked", "a passing identity is still not clicked while Save is disabled");
assert(refused.identity.checks.controlPresent && refused.identity.checks.routeExact && refused.identity.checks.handler && refused.identity.checks.label, "identity checks are reported separately");
const enabledContract = { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true };
assert(decideSaveClick({ contract: enabledContract, control: null, page: passingPage }).reason === "SAVE_CONTROL_MISSING", "a missing control has its own reason");
assert(decideSaveClick({ contract: enabledContract, control: passingControl, page: { route: "/admin/other", saveData: true } }).reason === "ROUTE_MISMATCH", "the wrong route has its own reason");
assert(decideSaveClick({ contract: enabledContract, control: { ...passingControl, onclick: "function () { return ResetInput(); }" }, page: passingPage }).reason === "HANDLER_MISMATCH", "a control that does not call SaveData has its own reason");
assert(decideSaveClick({ contract: enabledContract, control: { ...passingControl, text: "Save" }, page: passingPage }).reason === "LABEL_UNEXPECTED", "a label other than Submit or Update is refused");
const enabled = decideSaveClick({ contract: enabledContract, control: passingControl, page: passingPage });
assert(enabled.allow === true && enabled.click === "allowed", "Submit can pass only when the flag is on and every identity check matches");
const clickAt = observeSrc.indexOf("target.click()");
const guardAt = observeSrc.indexOf("allowClick === true");
assert(clickAt > guardAt && guardAt > 0, "the observe script clicks only when the caller allows it");
const generatedObserve = createInPageSaveObserveScript();
assert(generatedObserve.includes("async function __sasvQcObserveSave") && !generatedObserve.includes("return __sasvQcInstallSaveWatch"), "the page script watches Save and does not return the installer early");
assert(observeSrc.includes("scope.XMLHttpRequest") && observeSrc.includes("prototype.open") && observeSrc.includes("prototype.send"), "Save observation wraps XMLHttpRequest");
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
    return qcPage();
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
    return { ...(await live.pageIdentity()), saveControl: { id: "save_btn", text: "Submit", onclick: "function () { return SaveData(); }" } };
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
        context: { portal_product_ref: PORTAL_REF, derived_facts: [], report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName, study_type_select_value: "Others" },
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
      context: { portal_product_ref: PORTAL_REF, derived_facts: [], report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName, study_type_select_value: "Others", report_issuer: "NUPAL", laboratory_label: "HARIDEV FORMULATIONS" },
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
        context: { portal_product_ref: PORTAL_REF, derived_facts: [] },
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
      return { blockers: [], readiness: { status: "READY", readiness_tuple: "tuple-ready" }, fill_fields: FILL, context: { portal_product_ref: PORTAL_REF, derived_facts: [] }, runs: [] };
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
    async reread() {
      return {
        payload: {
          typeofstudy: FILL.typeOfStudy,
          startdate: FILL.startDate,
          enddate: FILL.endDate,
          reportdate: FILL.reportDate,
          batchno: FILL.batchNo,
          duration: FILL.duration,
          qc: FILL.qualityCntrl,
          labname: FILL.labName,
          count1: 1,
        },
      };
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
assert(partialPage.coverageComplete === false && partialPage.reason === "LIST_INCOMPLETE" && partialPage.message === "List incomplete" && partialPage.rowPresenceDecided === false, "a short page is incomplete and row presence is not decided");
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
      return { origin: QC_PORTAL_CONTRACT.origin, route: QC_PORTAL_CONTRACT.route, productId: { value: "1234" }, productSelected: { value: "1234", text: " Karpooradi Thailam " }, productOptions: [{ value: "-1", text: "--Select--" }, { value: "1234", text: "Karpooradi Thailam" }, { value: "77", text: "Other Oil" }], actiontype: { value: "add" }, hiddenId: { value: "" }, saveData: true, saveControl: { id: "save_btn", text: "Submit" } };
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
        context: { portal_product_ref: PORTAL_REF, study_type_select_value: "Others", report_sha256: goodSha, report_size_bytes: goodBytes.length, report_filename: reportName },
        runs: [],
      };
    }
    return {};
  },
});
assert(inspectArmCalls === 0 && inspectResult.armed === false && inspectResult.clickedSave === false, "the portal check does not arm or click");
assert(inspectResult.nativeSaveEnabled === false && inspectResult.list.coverageComplete === false, "the check keeps Save disabled and reports unproven coverage");
assert(inspectResult.laboratory.optionPresent === true && inspectResult.laboratory.optionValue === "HARIDEV FORMULATIONS", "the laboratory name is an option value");
assert(inspectResult.studyType.optionPresent === true && inspectResult.studyType.optionValue === "Others", "the study option value is Others");
assert(inspectResult.report?.attached === false && inspectResult.report?.ok === false, "a mismatched PDF is not attached");
assert(Array.isArray(inspectResult.recapture?.listRowKeys) && inspectResult.recapture.listRowKeys.length === 0 && inspectResult.recapture.scriptHash === "", "an empty list recapture does not invent keys");

const studyIdPage = await createQcPrepRunExecutor({
  live: {
    async pageIdentity() {
      return { origin: QC_PORTAL_CONTRACT.origin, route: QC_PORTAL_CONTRACT.route, productId: { value: "1234" }, productSelected: { value: "1234", text: " Karpooradi Thailam " }, productOptions: [{ value: "-1", text: "--Select--" }, { value: "1234", text: "Karpooradi Thailam" }, { value: "77", text: "Other Oil" }], actiontype: { value: "add" }, hiddenId: { value: "" }, saveData: true, saveControl: { id: "save_btn", text: "Submit" } };
    },
    async readList() {
      return { ...assessQcListResponse({ status: "1", data: [], TotalCount: 0 }, { pageno: 0 }), payload: { status: "1", data: [], TotalCount: 0 } };
    },
    async readPortalFacts() {
      return { laboratory: { options: [{ value: "HARIDEV FORMULATIONS", label: "HARIDEV FORMULATIONS" }] }, studyType: { options: [{ value: "493", label: "Others" }] } };
    },
  },
}).inspect({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  callRpc: async (_token, name) => {
    if (name.endsWith("preflight_v1")) {
      return {
        blockers: [],
        readiness: { status: "READY_PROVISIONAL" },
        fill_fields: FILL,
        context: { portal_product_ref: PORTAL_REF, study_type_select_value: "Others" },
        runs: [],
      };
    }
    return {};
  },
});
assert(studyIdPage.studyType.optionPresent === false && studyIdPage.ok === false, "a study option value of 493 is not the server value");

const realistic = assessPageIdentity(qcPage(), PORTAL_REF);
assert(realistic.ok === true && realistic.checks.product === true && realistic.evidence.actualPortalProductRef === "1234" && realistic.evidence.productDetailsRef === PORTAL_REF, "the realistic QC page passes without comparing the encrypted reference");
const identitySrc = createInPageIdentityScript();
assert(identitySrc.includes("productSelected") && identitySrc.includes("productOptions") && identitySrc.includes("Quality Control") && !identitySrc.includes("dispatchEvent"), "page identity only reads the product list and heading");
const blankProduct = assessPageIdentity(qcPage({
  productId: { value: "-1" },
  productSelected: { value: "-1", text: "--Select--" },
}), PORTAL_REF);
assert(blankProduct.ok === false && blankProduct.checks.product === false, "the placeholder product option fails");
const otherProduct = assessPageIdentity(qcPage({
  productId: { value: "77" },
  productSelected: { value: "77", text: "Other Oil" },
}), PORTAL_REF);
assert(otherProduct.ok === false && otherProduct.checks.product === false, "a different selected product fails");
const duplicateLabel = assessPageIdentity(qcPage({
  productOptions: [
    { value: "1234", text: "Karpooradi Thailam" },
    { value: "88", text: "Karpooradi  Thailam" },
  ],
}), PORTAL_REF);
assert(duplicateLabel.ok === false && duplicateLabel.checks.product === false, "two options with the same product name fail");
const wrongRoute = assessPageIdentity(qcPage({ route: "/admin/other" }), PORTAL_REF);
assert(wrongRoute.ok === false && wrongRoute.checks.route === false && wrongRoute.detail.includes("route"), "a wrong route fails and names route");
const editMode = assessPageIdentity(qcPage({ actiontype: { value: "Edit" } }), PORTAL_REF);
assert(editMode.ok === false && editMode.checks.actionAdd === false, "Edit mode fails the add check");
const existingRow = assessPageIdentity(qcPage({ hiddenId: { value: "55" } }), PORTAL_REF);
assert(existingRow.ok === false && existingRow.checks.freshRow === false, "an existing row id fails the fresh-row check");
const routeSummary = await createQcPrepRunExecutor({
  live: {
    async pageIdentity() { return qcPage({ route: "/admin/other" }); },
    async readList() { return assessQcListResponse({ status: "1", data: [], TotalCount: 0 }, { pageno: 0 }); },
    async readPortalFacts() {
      return { laboratory: { options: [{ value: "HARIDEV FORMULATIONS", label: "HARIDEV FORMULATIONS" }] }, studyType: { options: [{ value: "Others", label: "Others" }] } };
    },
  },
}).inspect({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP,
  userConfirmed: true,
  callRpc: async (_token, name) => {
    if (name.endsWith("preflight_v1")) {
      return { blockers: [], readiness: { status: "READY_PROVISIONAL" }, fill_fields: FILL, context: { portal_product_ref: PORTAL_REF, study_type_select_value: "Others" }, runs: [] };
    }
    return {};
  },
});
assert(routeSummary.message.includes("failed: route") && routeSummary.message.includes("seen product"), "the summary lists the failed checks and the values seen");
assert(QC_PORTAL_CONTRACT.nativeSaveClickEnabled === false && routeSummary.nativeSaveEnabled === false && routeSummary.clickedSave === false, "the native Save click is still disabled");

assert(controlSrc.includes("Save only; Submit is not allowed."), "the review modal says Save only");
assert(readFileSync(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"), "utf8").includes("Row verified — document not verified (trusted document check not available yet)"), "row verified wording is the document-not-verified sentence");
assert(!controlSrc.includes("fully verified"), "the screen does not say fully verified");
assert(controlSrc.includes(QC_PORTAL_CONTRACT.saveControlCapturedText) || controlSrc.includes("labelled Submit"), "the screen explains the Submit label");
assert(/const CACHE_NAME = "hub-cache-v378"/.test(swSrc), "service worker cache is v378");

const counted = assessQcListResponse({ status: "1", data: [{ id: "1" }, { id: "2" }], TotalCount: 2, total: 9 }, { pageno: 0 });
assert(counted.coverageComplete === true && counted.totalSource === "TotalCount" && counted.totalCount === 2, "TotalCount is the list total");
const shortList = assessQcListResponse({ status: "1", data: [], TotalCount: 3 }, { pageno: 0 });
const shortDup = assessQcListDuplicate(shortList, FILL);
assert(shortList.message === "List incomplete" && shortDup.code === "LIST_INCOMPLETE", "a short list is incomplete and row presence is not decided");
const filteredApart = assessQcListResponse({ status: "1", data: [{ id: "1" }], TotalCount: 1, recordsFiltered: 2 }, { pageno: 0 });
assert(filteredApart.reason === "LIST_COVERAGE_UNPROVEN", "a filtered total that disagrees is not complete");
const domSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-register-dom-fill.js"), "utf8");
const rereadSrc = domSrc.slice(domSrc.indexOf("function createInPageRereadScript"), domSrc.indexOf("function createInPagePortalFactsScript"));
assert(domSrc.includes("LoadQCData?pageno=0&&length=-1&&search=&&order=&&licenseid="), "the list uses the portal query form");
assert(rereadSrc.includes("GetqcData") && !rereadSrc.includes("sdate") && !rereadSrc.includes("edate") && !rereadSrc.includes("reportdate"), "reread uses GetqcData and does not read the date inputs");
const unknownDate = mapGetqcDataResponse({ typeofstudy: "Others", startdate: "01/10/2021", enddate: "2024-09-30", reportdate: "2024-10-15", batchno: "1", duration: "36", qc: "Out", labname: "HARIDEV FORMULATIONS", count1: 1 });
assert(unknownDate.runStatus === "ROW_MISMATCH" && unknownDate.reason === "date format unknown", "an unrecognised raw date is a row mismatch");
const knownDate = mapGetqcDataResponse({ typeofstudy: FILL.typeOfStudy, startdate: "2021-10-01", enddate: "2024-09-30", reportdate: "2024-10-15", batchno: FILL.batchNo, duration: "36", qc: "Out", labname: "HARIDEV FORMULATIONS", count1: 1 });
assert(knownDate.ok === true && knownDate.values.startDate === "2021-10-01" && knownDate.values.labName === "HARIDEV FORMULATIONS", "a raw ISO date is compared as YYYY-MM-DD");

const nameOptions = [{ value: "-1", text: "--Select--" }, { value: "HARIDEV FORMULATIONS", text: "HARIDEV FORMULATIONS" }, { value: "Other", text: "Other" }];
function labDocument() {
  fields.lab_name = element("lab_name", { value: "", options: nameOptions.map((option) => ({ ...option })) });
  installDocument(fields);
}
labDocument();
const namedFill = await fillFn({ fillFields: { ...FILL, labName: "HARIDEV FORMULATIONS" }, studyTypeSelectValue: "Others" });
assert(namedFill.ok === true && namedFill.filled_values.labName === "HARIDEV FORMULATIONS", "an exact laboratory name fills");
for (const refusedLab of ["3980", "haridev formulations", "HARIDEV FORMULATIONS "]) {
  labDocument();
  fields.duration.value = "untouched";
  const refusedFill = await fillFn({ fillFields: { ...FILL, labName: refusedLab }, studyTypeSelectValue: "Others" });
  assert(refusedFill.ok === false && refusedFill.filled === false && refusedFill.message === "Laboratory not in the portal list" && fields.duration.value === "untouched", `laboratory ${JSON.stringify(refusedLab)} fills nothing`);
}
assert(fixture.includes('value="Others"') && fixture.includes("3 Month Accelarated Stability") && !fixture.includes('value="493"'), "the fixture study option value is Others");
const fixtureKeys = parseSaveDataQcdetailsKeys(fixture);
assert(fixtureKeys.add.join(",") === "reportDate,labName,qualityCntrl,productId", "the add jsondata keys are parsed from the fixture");
assert(fixtureKeys.edit.join(",") === "reportDate,labName,qualityCntrl,productId,id", "the edit jsondata keys are parsed from the fixture");
const sampleRow = {
  status: "1",
  data: [{
    product_name: "Karpooradi Thailam",
    startdate: "01-10-2021",
    enddate: "30/09/2024",
    reportdate: "2024-10-15",
    action: "<input id='hid77'><a onclick='edit_qc(1)'></a><a onclick='delete_qc(1)'></a><button class='downloadButtonClass'></button>",
  }],
};
const sample = buildQcRecapture({ payload: sampleRow, saveDataSource: fixture, scriptText: "function SaveData(){return 1;}" });
assert(sample.listRowKeys.join(",") === "action,enddate,product_name,reportdate,startdate", "list row keys come from the first row");
assert(sample.listActionMarkup.hid === true && sample.listActionMarkup.edit_qc === true && sample.listActionMarkup.delete_qc === true && sample.listActionMarkup.downloadButtonClass === true, "action markup is recorded as booleans");
assert(sample.listDateSamples.startdate === "01-10-2021" && sample.listDateSamples.enddate === "30/09/2024" && sample.listDateSamples.reportdate === "2024-10-15", "list dates stay raw");
assert(sample.scriptHash === createHash("sha256").update("function SaveData(){return 1;}").digest("hex"), "the script hash is the fetched text");
const recaptureSrc = createInPageRecaptureScript();
assert(recaptureSrc.includes("String(window.SaveData)") && !recaptureSrc.includes("SaveData()") && !recaptureSrc.includes("GetqcData") && !recaptureSrc.includes(".click("), "recapture reads the script text and does not call Save");
assert(controlSrc.includes("Recapture (read-only)"), "the portal check shows a read-only recapture panel");
assert(QC_PORTAL_CONTRACT.saveHandler === "SaveData" && QC_PORTAL_CONTRACT.saveEndpointPath === "/admin/SaveQCData", "the Save exception fields are recorded");
assert(QC_PORTAL_CONTRACT.saveEnableNote.includes("Enabling the click needs a recorded operator decision."), "enabling Save still needs an operator decision");

class MockXHR {
  constructor() {
    this.headers = {};
    this.status = 0;
    this.responseText = "";
    this.listeners = {};
  }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send() { this.sent = true; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  dispatch(type) { if (this.listeners[type]) this.listeners[type](); }
}
function watchSession() {
  global.window = globalThis;
  const originalOpen = MockXHR.prototype.open;
  global.XMLHttpRequest = MockXHR;
  global.fetch = async () => ({ status: 200, clone() { return this; }, async text() { return "{\"status\":\"1\",\"message\":\"saved\"}"; } });
  const install = new Function(createInPageSaveWatchScript())();
  return { session: install(), originalOpen };
}
{
  const { session, originalOpen } = watchSession();
  const xhr = new MockXHR();
  xhr.open("POST", "../admin/SaveQCData");
  xhr.setRequestHeader("X-Action-Type", "add");
  xhr.send();
  xhr.status = 200;
  xhr.responseText = "{\"status\":\"1\",\"message\":\"saved\"}";
  xhr.dispatch("loadend");
  const observed = session.finish();
  assert(observed.status === "1" && observed.method === "POST" && observed.actionType === "add" && observed.responseParsed === true, "a jQuery-style XHR save with status 1 is observed");
  assert(MockXHR.prototype.open === originalOpen, "XMLHttpRequest open is restored");
}
{
  const { session } = watchSession();
  const xhr = new MockXHR();
  xhr.open("POST", "https://www.e-aushadhi.gov.in/admin/SaveQCData");
  xhr.setRequestHeader("X-Action-Type", "add");
  xhr.send();
  xhr.status = 200;
  xhr.responseText = "{\"status\":\"0\",\"message\":\"no\"}";
  xhr.dispatch("loadend");
  const observed = session.finish();
  assert(observed.status === "0" && observed.businessFailure === true && observed.outcome === "OBSERVED", "a non-1 XHR save is observed and not retried");
}
{
  const { session } = watchSession();
  await global.fetch("../admin/SaveQCData", { method: "POST", headers: { "X-Action-Type": "add" } });
  const observed = session.finish();
  assert(observed.status === "1" && observed.method === "POST", "a fetch save is observed");
}
{
  const { session } = watchSession();
  const xhr = new MockXHR();
  xhr.open("POST", "../admin/SaveQCData");
  xhr.send();
  xhr.status = 0;
  xhr.dispatch("error");
  const observed = session.finish();
  assert(observed.outcome === "AMBIGUOUS" && observed.reason === "SAVE_AMBIGUOUS", "an XHR network error is ambiguous");
}
{
  const { session } = watchSession();
  const xhr = new MockXHR();
  xhr.open("POST", "../admin/SaveQCData");
  xhr.send();
  xhr.dispatch("timeout");
  const observed = session.finish();
  assert(observed.outcome === "AMBIGUOUS", "an XHR timeout is ambiguous");
}
{
  const { session } = watchSession();
  const listCall = new MockXHR();
  listCall.open("POST", "../admin/LoadQCData?pageno=0");
  listCall.send();
  listCall.status = 200;
  listCall.responseText = "{\"status\":\"1\"}";
  listCall.dispatch("loadend");
  const editCall = new MockXHR();
  editCall.open("POST", "../admin/GetqcData");
  editCall.send();
  editCall.status = 200;
  editCall.responseText = "{\"status\":\"1\"}";
  editCall.dispatch("loadend");
  const observed = session.finish();
  assert(observed.matchingRequestCount === 0, "LoadQCData and GetqcData are not Save observations");
}

if (failed) {
  console.error(`D7 smoke failed: ${failed}`);
  process.exit(1);
}
console.log("D7 smoke passed");
