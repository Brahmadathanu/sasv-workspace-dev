import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { QC_PORTAL_CONTRACT } = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { createQcPrepRunExecutor } = require(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"));
const { createInPageSaveObserveScript } = require(join(root, "electron/eaushadhi-worker/qc-register-save-observe.js"));
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");

const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RUN = "fc0cd11f-f844-4f2b-a225-070321849788";
const FILENAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const BYTES = Buffer.from("qc-d732-report-bytes");
const SHA = createHash("sha256").update(BYTES).digest("hex");
const FINGERPRINT = "fp-d732-karpooradi";
const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
const SECRET = "d732-pre-save-token-should-not-leak";
const FILL = {
  typeOfStudy: "Cross Sectional Approach (API Vol VIII Page No:226)",
  startDate: "2021-10-01",
  endDate: "2025-01-04",
  reportDate: "2025-01-04",
  batchNo: "3369,4896,2434,3250,3738,4601,5201",
  duration: "36",
  labName: "HARIDEV FORMULATIONS",
  qualityCntrl: "Out",
};
const PORTAL_ROW = {
  product_name: "Karpooradi Thailam",
  typeofstudy: FILL.typeOfStudy,
  startdate: "01-10-2021",
  enddate: "04-01-2025",
  reportdate: "04-01-2025",
  batchno: "3369, 4896, 2434, 3250, 3738, 4601, 5201",
  duration: 36,
  labname: "HARIDEV FORMULATIONS",
  qc: "Out",
  action: "<input id='hid77'><a onclick='edit_qc(88)'></a><a onclick='delete_qc(88)'></a>",
};
const preflight = {
  blockers: [],
  readiness: { status: "READY_PROVISIONAL", readiness_tuple: "t".repeat(64) },
  fill_fields: FILL,
  context: {
    product_id: 262,
    report_filename: FILENAME,
    report_sha256: SHA,
    report_size_bytes: BYTES.length,
    study_type_select_value: "Others",
    portal_product_ref: "portal-ref",
    laboratory_label: "HARIDEV FORMULATIONS",
    derived_facts: [{ fact: "study_start_date", basis_note: "Derived start date from the NUPAL report." }],
  },
  runs: [{ run_id: RUN, run_status: "SAVE_ARMED", save_outcome: null, preparation_id: PREP }],
};

let failed = 0;
function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
    return;
  }
  console.log(`OK ${message}`);
}

function portalPage() {
  return {
    origin: QC_PORTAL_CONTRACT.origin,
    route: QC_PORTAL_CONTRACT.route,
    heading: "Q.C (Quality Control) Register",
    productId: { value: "1234" },
    productSelected: { value: "1234", text: "Karpooradi Thailam" },
    productOptions: [{ value: "-1", text: "--Select--" }, { value: "1234", text: "Karpooradi Thailam" }],
    actiontype: { value: "add" },
    hiddenId: { value: "" },
    saveData: true,
    saveControl: { id: "save_btn", text: "Submit", onclick: "function () { return SaveData(); }" },
  };
}

function listPayload(rows) {
  return { success: true, coverageComplete: true, settled: true, rows, requestedPage: 0, totalCount: rows.length };
}

const rootDir = mkdtempSync(join(tmpdir(), "qc-d732-"));
const dryRunDir = join(rootDir, "dry");
mkdirSync(dryRunDir);
writeFileSync(join(dryRunDir, `${RUN}.json`), `${JSON.stringify({
  outcome: "DRY_RUN_PASS", preparationId: PREP, fingerprint: FINGERPRINT, run_id: RUN,
})}\n`);
const previousFlag = process.env.EAUSHADHI_QC_NATIVE_SAVE;
process.env.EAUSHADHI_QC_NATIVE_SAVE = "D7.3";

function liveFor(spy, options = {}) {
  let listed = 0;
  const afterPlan = options.afterPlan || [options.afterRows || []];
  return {
    listWaitMs: options.listWaitMs || 0,
    listPollMs: options.listPollMs || 20,
    async pageIdentity() { return portalPage(); },
    async fill() { return { ok: true, filled_values: { ...FILL } }; },
    async attach() { return { length: 1, name: FILENAME, size: BYTES.length }; },
    async readForm() {
      return { fields: { ...FILL }, file: { name: FILENAME, size: BYTES.length, length: 1 } };
    },
    async resetForm() { return { fields: {}, file: { length: 0 } }; },
    async readList() {
      listed += 1;
      spy.reads = listed;
      if (listed === 1) return listPayload([]);
      const rows = afterPlan[Math.min(listed - 2, afterPlan.length - 1)] || [];
      return listPayload(rows);
    },
    async observeSave() {
      spy.click += 1;
      return {
        clicked: true,
        invokeCount: 1,
        matchingRequestCount: options.matchingRequestCount == null ? 1 : options.matchingRequestCount,
        settled: options.settled !== false,
        httpStatus: options.httpStatus == null ? 200 : options.httpStatus,
        responseParsed: options.responseParsed !== false,
        status: options.status == null ? "1" : options.status,
        message: options.message == null ? "Data Saved Successfully" : options.message,
        businessFailure: false,
        transportError: options.transportError === true,
        dialogAppeared: false,
        dialogText: "",
      };
    },
  };
}

function callRpc(spy) {
  return async (_token, name, args) => {
    spy.rpc.push(String(name));
    if (String(name).endsWith("preflight_v1")) return preflight;
    if (String(name).endsWith("pre_save_v1")) return { go: true, run_status: "SAVE_ARMED", pre_save_token: SECRET };
    if (String(name).endsWith("record_save_v1")) {
      spy.recordSave += 1;
      spy.recordOutcome = args?.p_save_outcome || "";
      const outcome = args?.p_save_outcome;
      const status = outcome === "CONFIRMED" ? "SAVE_CONFIRMED" : outcome === "REJECTED" ? "SAVE_REJECTED" : "SAVE_AMBIGUOUS";
      return { run_status: status, reasons: [] };
    }
    if (String(name).endsWith("verify_row_v1")) {
      spy.verify += 1;
      return { run_status: "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED" };
    }
    return {};
  };
}

async function runCase(name, options) {
  const saveDir = join(rootDir, name);
  const spy = { click: 0, recordSave: 0, recordOutcome: "", rpc: [], reads: 0, verify: 0 };
  const runner = createQcPrepRunExecutor({ dryRunDir, saveDir, live: liveFor(spy, options) });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  let error = null;
  let result = null;
  try {
    result = await runner.performGuardedNativeSave({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP,
      fingerprint: FINGERPRINT,
      runId: RUN,
      confirmNonce: issued.nonce,
      filename: "local-copy.pdf",
      bytes: BYTES,
      provisionalAck: true,
      provisionalNote: "I acknowledge the provisional laboratory selection for this portal row.",
      derivedAck: true,
      derivedNote: "Derived start date from the NUPAL report.",
      callRpc: callRpc(spy),
    });
  } catch (caught) {
    error = caught;
  }
  return { spy, result, error, nonce: issued.nonce, saveDir };
}

const confirmed = await runCase("one-row", { afterRows: [PORTAL_ROW] });
assert(confirmed.error == null && confirmed.result?.outcome === "CONFIRMED" && confirmed.result?.report?.listDelta === "one-match", "the real portal row from 0 to 1 is one-match and CONFIRMED");
assert(confirmed.result?.report?.matched_row_id === "88" && confirmed.spy.recordOutcome === "CONFIRMED" && confirmed.spy.click === 1 && confirmed.spy.verify === 1, "the Edit action supplies the row id and the row is verified");

const late = await runCase("late-list", {
  listWaitMs: 400,
  listPollMs: 20,
  afterPlan: [[], [], [PORTAL_ROW]],
});
assert(late.result?.outcome === "CONFIRMED" && late.spy.reads >= 3, "a list that appears during the short reread wait is confirmed");

const wrongLab = await runCase("wrong-lab", { afterRows: [{ ...PORTAL_ROW, labname: "OTHER LAB" }] });
assert(wrongLab.result?.outcome !== "CONFIRMED" && wrongLab.result?.listDelta !== "one-match", "a new row with the wrong laboratory is not confirmed");

const twoRows = await runCase("two-rows", { afterRows: [PORTAL_ROW, { ...PORTAL_ROW, action: "<a onclick='edit_qc(89)'></a>" }] });
assert(twoRows.result?.outcome !== "CONFIRMED" && twoRows.spy.click === 1, "two new rows are not confirmed");

const noResponse = await runCase("no-response", {
  afterRows: [PORTAL_ROW],
  matchingRequestCount: 0,
  settled: false,
  responseParsed: false,
  status: "",
  message: "",
  transportError: true,
  httpStatus: 0,
});
assert(noResponse.result?.outcome === "AMBIGUOUS" && noResponse.result?.outcome !== "CONFIRMED", "a save with no captured response stays ambiguous");

const countedTwice = await runCase("counted-twice", { afterRows: [PORTAL_ROW], matchingRequestCount: 2 });
assert(countedTwice.result?.outcome === "AMBIGUOUS" && countedTwice.result?.outcome !== "CONFIRMED", "two Save responses are still ambiguous");

const stored = JSON.stringify(confirmed.result || {}) + readFileSync(join(confirmed.saveDir, `${RUN}.json`), "utf8");
assert(!stored.includes(SECRET) && !stored.includes(confirmed.nonce), "the confirmed report does not contain the token or nonce");

class MockXHR {
  constructor() { this.listeners = {}; this.headers = {}; this.status = 0; this.responseText = ""; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send() {}
  addEventListener(type, fn) { this.listeners[type] = fn; }
  dispatch(type) { if (this.listeners[type]) this.listeners[type](); }
  getResponseHeader() { return "application/json"; }
}
const ajaxHandlers = [];
function jquery() {
  return {
    on(event, fn) { ajaxHandlers.push({ event, fn }); },
    off(event) {
      for (let i = ajaxHandlers.length - 1; i >= 0; i -= 1) {
        if (ajaxHandlers[i].event === event) ajaxHandlers.splice(i, 1);
      }
    },
  };
}
function installPage(click) {
  ajaxHandlers.length = 0;
  global.XMLHttpRequest = MockXHR;
  global.window = { jQuery: jquery, $: jquery, XMLHttpRequest: MockXHR };
  global.document = {
    getElementById(id) { return id === "save_btn" ? { click } : null; },
    querySelector() { return null; },
  };
}
installPage(() => {
  const xhr = new MockXHR();
  xhr.open("POST", "/admin/SaveQCData");
  xhr.send();
  xhr.status = 200;
  xhr.responseText = "{\"status\":\"1\",\"message\":\"Data Saved Successfully\"}";
  xhr.dispatch("loadend");
  const jqXhr = { status: 200, responseText: xhr.responseText, getResponseHeader() { return "application/json"; } };
  ajaxHandlers.slice().forEach((item) => item.fn({}, jqXhr, { url: "/admin/SaveQCData" }));
});
const observe = new Function(createInPageSaveObserveScript())();
const doubled = await observe({ allowClick: true, controlId: "save_btn", timeoutMs: 200 });
assert(doubled.matchingRequestCount === 1 && doubled.status === "1" && doubled.message === "Data Saved Successfully", "the XHR watch and ajaxComplete count as one Save response");

installPage(() => {
  for (const message of ["Data Saved Successfully", "Data Saved Successfully"]) {
    const xhr = new MockXHR();
    xhr.open("POST", "/admin/SaveQCData");
    xhr.send();
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ status: "1", message });
    xhr.dispatch("loadend");
  }
});
const twice = await new Function(createInPageSaveObserveScript())()({ allowClick: true, controlId: "save_btn", timeoutMs: 200 });
assert(twice.matchingRequestCount === 2, "two real Save requests stay two");

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  let i = src.indexOf("{", start);
  let depth = 0;
  let mode = "code";
  const templateAt = [];
  for (; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (mode === "line") { if (ch === "\n") mode = "code"; continue; }
    if (mode === "block") { if (ch === "*" && next === "/") { mode = "code"; i += 1; } continue; }
    if (mode === "'" || mode === '"') { if (ch === "\\") { i += 1; continue; } if (ch === mode) mode = "code"; continue; }
    if (mode === "`") {
      if (ch === "\\") { i += 1; continue; }
      if (ch === "`") mode = "code";
      else if (ch === "$" && next === "{") { templateAt.push(depth); mode = "code"; depth += 1; i += 1; }
      continue;
    }
    if (ch === "/" && next === "/") { mode = "line"; i += 1; continue; }
    if (ch === "/" && next === "*") { mode = "block"; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { mode = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (templateAt.length && depth === templateAt[templateAt.length - 1]) { templateAt.pop(); mode = "`"; }
      else if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

const ui = new Function(
  `const state = {
     selectedProductId: 262,
     qcPrepServer: { preparation_id: ${JSON.stringify(PREP)} },
     qcFillPreflight: ${JSON.stringify(preflight)},
     qcFillLoadedFor: ${JSON.stringify(PREP)},
     qcFillAckScope: "",
     qcFillAckSeeded: false,
     qcFillProvisionalAck: false,
     qcFillProvisionalNote: "",
     qcFillDerivedAck: false,
     qcFillDerivedNote: "",
     qcFillDerivedNoteTouched: false,
     qcFillInspectOk: false,
     qcFillChosenReportName: "",
     qcFillInspectFileResult: null,
     qcPrepRunBusy: false,
     qcGovernanceConfirmOpen: false,
     qcFillRun: null,
     qcFillRunNotice: "",
     qcFillNotice: "",
     qcFillLoading: false,
     qcFillDryRun: null,
     qcFillRecapture: null,
     qcNativeSaveStatus: { buildAuthorized: true, tag: "D7.3" },
     qcNativeSaveReport: null,
     qcFillResolveNote: "",
     qcFillResolveNoteTouched: false
   };
   const access = { canView: true, canEdit: true };
   function canWrite() { return true; }
   function workerApiAvailable() { return true; }
   function qcHtmlEscape(value) { return String(value ?? ""); }
   function qcIstStamp() { return ""; }
   function qcReadinessFactLabel(fact) { return String(fact || ""); }
   const QC_FILL_PROVISIONAL_PREFILL = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection; NUPAL is the report issuer; legal identity and portal eligibility are not verified.";
   const QC_FILL_SAVE_BLOCKED = "The portal control that runs Save is labelled Submit. Save was not pressed.";
   const QC_FILL_QUALIFICATION = "Portal laboratory is an internal provisional selection.";
   const QC_FILL_FIELD_ROWS = [["typeOfStudy", "Type of study"], ["labName", "Laboratory"]];
   const QC_FILL_BLOCKER_TEXT = {};
   ${extractFunction(controlSrc, "qcFillBlockerText")}
   ${extractFunction(controlSrc, "qcSeedFillAcks")}
   ${extractFunction(controlSrc, "qcFillArmBlockReason")}
   ${extractFunction(controlSrc, "qcFillArmReady")}
   ${extractFunction(controlSrc, "qcFillPreflightCardHtml")}
   return { state, qcFillPreflightCardHtml };
  `,
)();
const needsHtml = ui.qcFillPreflightCardHtml();
assert(needsHtml.includes('id="btnQcNativeSave" disabled') && needsHtml.includes("Save needs: Check portal page passed · Dry run passed in this session · both acknowledgements ticked"), "a flagged build says what Save is waiting for");
ui.state.qcFillPreflight = { ...preflight, runs: [{ run_id: RUN, run_status: "SAVE_AMBIGUOUS", preparation_id: PREP }] };
ui.state.qcNativeSaveReport = { clicked: true, outcome: "AMBIGUOUS", after_count: 1, filled_values: FILL, listDelta: "unknown", message: "Check the portal list by hand." };
const doneHtml = ui.qcFillPreflightCardHtml();
assert(doneHtml.includes("Save already done for this run.") && doneHtml.includes('id="btnQcNativeSave" disabled'), "a clicked run says Save is already done");
assert(/Operator checked e-Aushadhi QC list on \d{2}-\d{2}-\d{4} \(IST\): 1 Karpooradi Thailam row\(s\) seen, lab HARIDEV FORMULATIONS\./.test(doneHtml), "the resolve note starts with the list the operator saw");
ui.state.qcFillResolveNoteTouched = true;
ui.state.qcFillResolveNote = "Operator typed a different note after checking the list.";
const editedHtml = ui.qcFillPreflightCardHtml();
assert(editedHtml.includes("Operator typed a different note after checking the list.") && !editedHtml.includes("row(s) seen"), "an edited resolve note is kept");

if (previousFlag == null) delete process.env.EAUSHADHI_QC_NATIVE_SAVE;
else process.env.EAUSHADHI_QC_NATIVE_SAVE = previousFlag;
rmSync(rootDir, { recursive: true, force: true });
if (failed) {
  console.error(`D7.3.2 smoke failed ${failed}`);
  process.exit(1);
}
console.log("D7.3.2 smoke passed");
