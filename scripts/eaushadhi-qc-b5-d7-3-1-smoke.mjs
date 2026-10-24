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

const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RUN = "fc0cd11f-f844-4f2b-a225-070321849788";
const FILENAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const BYTES = Buffer.from("qc-d731-report-bytes");
const SHA = createHash("sha256").update(BYTES).digest("hex");
const FINGERPRINT = "fp-d731-karpooradi";
const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
const SECRET = "d731-pre-save-token-should-not-leak";
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
    productOptions: [
      { value: "-1", text: "--Select--" },
      { value: "1234", text: "Karpooradi Thailam" },
    ],
    actiontype: { value: "add" },
    hiddenId: { value: "" },
    saveData: true,
    saveControl: {
      id: "save_btn",
      text: "Submit",
      onclick: "function () { return SaveData(); }",
    },
  };
}

function observed() {
  return {
    clicked: true,
    invokeCount: 1,
    matchingRequestCount: 1,
    settled: true,
    httpStatus: 200,
    responseParsed: true,
    status: "1",
    message: "saved",
    businessFailure: false,
    transportError: false,
    dialogAppeared: false,
    dialogText: "",
  };
}

const rootDir = mkdtempSync(join(tmpdir(), "qc-d731-"));
const dryRunDir = join(rootDir, "dry");
mkdirSync(dryRunDir);
writeFileSync(join(dryRunDir, `${RUN}.json`), `${JSON.stringify({
  outcome: "DRY_RUN_PASS",
  preparationId: PREP,
  fingerprint: FINGERPRINT,
  run_id: RUN,
})}\n`);

const previousFlag = process.env.EAUSHADHI_QC_NATIVE_SAVE;
process.env.EAUSHADHI_QC_NATIVE_SAVE = "D7.3";

function liveFor(spy, saveDir, options = {}) {
  let listed = 0;
  return {
    async pageIdentity() { return portalPage(); },
    async fill() { return { ok: true, filled_values: { ...FILL } }; },
    async attach() { return { length: 1, name: FILENAME, size: BYTES.length }; },
    async readForm() {
      return { fields: { ...FILL }, file: { name: FILENAME, size: BYTES.length, length: 1 } };
    },
    async resetForm() { spy.reset += 1; return { fields: {}, file: { length: 0 } }; },
    async readList() {
      listed += 1;
      if (options.afterListThrows && listed > 1) throw new Error("after list failed");
      return { success: true, coverageComplete: true, settled: true, rows: [], requestedPage: 0, totalCount: 0 };
    },
    async observeSave() {
      const marker = JSON.parse(readFileSync(join(saveDir, `${RUN}.clicked.json`), "utf8"));
      spy.markerAtClick = marker;
      spy.click += 1;
      return observed();
    },
  };
}

function callRpc(spy, options = {}) {
  return async (_token, name, args) => {
    spy.rpc.push(String(name));
    if (String(name).endsWith("preflight_v1")) return preflight;
    if (String(name).endsWith("pre_save_v1")) {
      spy.preSave += 1;
      return { go: true, run_status: "SAVE_ARMED", pre_save_token: SECRET };
    }
    if (String(name).endsWith("record_save_v1")) {
      spy.recordSave += 1;
      spy.recordOutcome = args?.p_save_outcome || "";
      if (options.recordThrows) throw new Error("record failed");
      const outcome = args?.p_save_outcome;
      const status = outcome === "CONFIRMED" ? "SAVE_CONFIRMED" : outcome === "REJECTED" ? "SAVE_REJECTED" : "SAVE_AMBIGUOUS";
      return { run_status: status, reasons: [] };
    }
    if (String(name).endsWith("arm_v1")) spy.arm += 1;
    return {};
  };
}

function spies() {
  return { click: 0, recordSave: 0, preSave: 0, arm: 0, recordOutcome: "", rpc: [], reset: 0, markerAtClick: null };
}

async function runCase(name, options) {
  const saveDir = join(rootDir, name);
  const spy = spies();
  const runner = createQcPrepRunExecutor({ dryRunDir, saveDir, live: liveFor(spy, saveDir, options) });
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
      callRpc: callRpc(spy, options),
    });
  } catch (caught) {
    error = caught;
  }
  return { spy, result, error, runner, saveDir, nonce: issued.nonce };
}

const listDown = await runCase("list-down", { afterListThrows: true });
const listReportPath = join(listDown.saveDir, `${RUN}.json`);
const listMarkerPath = join(listDown.saveDir, `${RUN}.clicked.json`);
const listReport = readFileSync(listReportPath, "utf8");
const listMarker = JSON.parse(readFileSync(listMarkerPath, "utf8"));
assert(listDown.error == null && listDown.spy.click === 1, "a failed after-list still clicks once");
assert(listDown.spy.recordSave === 1 && listDown.spy.recordOutcome === "AMBIGUOUS", "a failed after-list records AMBIGUOUS once");
assert(listDown.result?.outcome === "AMBIGUOUS" && listReport.includes('"outcome": "AMBIGUOUS"'), "a failed after-list writes the local report");
assert(listDown.spy.markerAtClick?.recorded === false && listMarker.recorded === true && listMarker.serverStatus === "SAVE_AMBIGUOUS", "the clicked marker is written before the click and updated after the record");

const recordDown = await runCase("record-down", { recordThrows: true });
const recordReport = JSON.parse(readFileSync(join(recordDown.saveDir, `${RUN}.json`), "utf8"));
const recordMarker = JSON.parse(readFileSync(join(recordDown.saveDir, `${RUN}.clicked.json`), "utf8"));
assert(recordDown.error == null && recordDown.spy.click === 1, "a failed record returns after the report instead of throwing");
assert(recordReport.serverStatus === "NOT_RECORDED" && recordReport.message === "Save was pressed but not recorded. Check the portal list by hand. Do not press Save again.", "a failed record writes NOT_RECORDED");
assert(recordMarker.recorded === false, "a failed record leaves the clicked marker unrecorded");

async function secondSave(done) {
  const beforeClick = done.spy.click;
  const beforeRpc = done.spy.rpc.length;
  const again = done.runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  let error = null;
  try {
    await done.runner.performGuardedNativeSave({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP,
      fingerprint: FINGERPRINT,
      runId: RUN,
      confirmNonce: again.nonce,
      filename: "local-copy.pdf",
      bytes: BYTES,
      provisionalAck: true,
      provisionalNote: "I acknowledge the provisional laboratory selection for this portal row.",
      derivedAck: true,
      derivedNote: "Derived start date from the NUPAL report.",
      callRpc: callRpc(done.spy, {}),
    });
  } catch (caught) {
    error = caught;
  }
  const later = done.spy.rpc.slice(beforeRpc);
  return { error, beforeClick, later, nonce: again.nonce };
}

const secondAfterList = await secondSave(listDown);
assert(secondAfterList.error?.code === "NATIVE_SAVE_DISABLED" && secondAfterList.error.reasons.includes("ALREADY_CLICKED"), "a second save after a lost after-list is ALREADY_CLICKED");
assert(listDown.spy.click === secondAfterList.beforeClick && !secondAfterList.later.some((name) => name.includes("arm_v1") || name.includes("pre_save_v1")), "a second save after a lost after-list does not click, arm, or pre-save");

const secondAfterRecord = await secondSave(recordDown);
assert(secondAfterRecord.error?.code === "NATIVE_SAVE_DISABLED" && secondAfterRecord.error.reasons.includes("ALREADY_CLICKED"), "a second save after a lost record is ALREADY_CLICKED");
assert(recordDown.spy.click === secondAfterRecord.beforeClick && !secondAfterRecord.later.some((name) => name.includes("arm_v1") || name.includes("pre_save_v1")), "a second save after a lost record does not click, arm, or pre-save");

const stored = [
  readFileSync(listReportPath, "utf8"),
  readFileSync(listMarkerPath, "utf8"),
  JSON.stringify(recordReport),
  JSON.stringify(recordMarker),
  JSON.stringify(listDown.result || {}),
  JSON.stringify(recordDown.result || {}),
].join("\n");
assert(!stored.includes(SECRET) && !stored.includes(listDown.nonce) && !stored.includes(recordDown.nonce) && !stored.includes(secondAfterList.nonce) && !stored.includes(secondAfterRecord.nonce), "clicked markers and reports never contain the token or nonce");

class MockXHR {
  constructor() { this.listeners = {}; this.status = 0; this.responseText = ""; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader() {}
  send() {}
  addEventListener(type, fn) { this.listeners[type] = fn; }
  dispatch(type) { if (this.listeners[type]) this.listeners[type](); }
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
global.window = { jQuery: jquery, $: jquery };
global.XMLHttpRequest = MockXHR;
global.document = {
  getElementById(id) {
    if (id !== "save_btn") return null;
    return {
      click() {
        const xhr = new MockXHR();
        xhr.open("POST", "/admin/SaveQCData");
        xhr.status = 200;
        xhr.responseText = "{\"status\":\"1\",\"message\":\"saved\"}";
        xhr.dispatch("loadend");
      },
    };
  },
  querySelector() { return null; },
};
const observe = new Function(createInPageSaveObserveScript())();
await observe({ allowClick: true, controlId: "save_btn", timeoutMs: 200 });
assert(ajaxHandlers.length === 0, "the ajaxComplete handler count returns to 0 after observation");

if (previousFlag == null) delete process.env.EAUSHADHI_QC_NATIVE_SAVE;
else process.env.EAUSHADHI_QC_NATIVE_SAVE = previousFlag;
rmSync(rootDir, { recursive: true, force: true });

if (failed) {
  console.error(`D7.3.1 smoke failed ${failed}`);
  process.exit(1);
}
console.log("D7.3.1 smoke passed");
