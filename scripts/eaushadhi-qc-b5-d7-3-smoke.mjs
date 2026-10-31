import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { QC_PORTAL_CONTRACT, NATIVE_SAVE_AUTHORIZED } = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { createQcPrepRunExecutor } = require(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"));
const { createInPageSaveObserveScript } = require(join(root, "electron/eaushadhi-worker/qc-register-save-observe.js"));

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const executorSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"), "utf8");
const contractSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"), "utf8");
const observeSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-register-save-observe.js"), "utf8");
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const indexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");

const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RUN = "fc0cd11f-f844-4f2b-a225-070321849788";
const OTHER_RUN = "11111111-1111-4111-8111-111111111111";
const FILENAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const BYTES = Buffer.from("qc-d73-report-bytes");
const SHA = createHash("sha256").update(BYTES).digest("hex");
const FINGERPRINT = "fp-d73-karpooradi";
const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
const SECRET = "d73-pre-save-token-should-not-leak";
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
    report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
    laboratory_label: "HARIDEV FORMULATIONS",
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
    if (mode === "line") {
      if (ch === "\n") mode = "code";
      continue;
    }
    if (mode === "block") {
      if (ch === "*" && next === "/") {
        mode = "code";
        i += 1;
      }
      continue;
    }
    if (mode === "'" || mode === '"') {
      if (ch === "\\") { i += 1; continue; }
      if (ch === mode) mode = "code";
      continue;
    }
    if (mode === "`") {
      if (ch === "\\") { i += 1; continue; }
      if (ch === "`") mode = "code";
      else if (ch === "$" && next === "{") {
        templateAt.push(depth);
        mode = "code";
        depth += 1;
        i += 1;
      }
      continue;
    }
    if (ch === "/" && next === "/") { mode = "line"; i += 1; continue; }
    if (ch === "/" && next === "*") { mode = "block"; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { mode = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (templateAt.length && depth === templateAt[templateAt.length - 1]) {
        templateAt.pop();
        mode = "`";
      } else if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

function portalPage(overrides = {}) {
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
    ...overrides,
  };
}

function observed(partial = {}) {
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
    dialogAppeared: true,
    dialogText: "Row saved",
    ...partial,
  };
}

function makeUi() {
  return new Function(
    `const state = {
       selectedProductId: 262,
       qcPrepServer: {},
       qcFillPreflight: null,
       qcFillLoadedFor: null,
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
       qcNativeSaveStatus: { buildAuthorized: false, tag: "D7.3" },
       qcNativeSaveReport: null
     };
     const access = { canView: true, canEdit: true };
     function canWrite() { return access.canEdit === true; }
     function workerApiAvailable() { return true; }
     function qcHtmlEscape(value) {
       return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
     }
     function qcIstStamp() { return ""; }
     function qcReadinessFactLabel(fact) { return String(fact || ""); }
     const QC_FILL_PROVISIONAL_PREFILL = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection; NUPAL is the report issuer; legal identity and portal eligibility are not verified.";
     const QC_FILL_SAVE_BLOCKED = "The portal control that runs Save is labelled Submit. Save was not pressed.";
     const QC_FILL_QUALIFICATION = "Portal laboratory is an internal provisional selection.";
     const QC_FILL_FIELD_ROWS = [["typeOfStudy", "Type of study"]];
     const QC_FILL_BLOCKER_TEXT = {};
     ${extractFunction(controlSrc, "qcFillBlockerText")}
     ${extractFunction(controlSrc, "qcSeedFillAcks")}
     ${extractFunction(controlSrc, "qcFillArmBlockReason")}
     ${extractFunction(controlSrc, "qcFillArmReady")}
     ${extractFunction(controlSrc, "qcFillPreflightCardHtml")}
     return { state, qcFillPreflightCardHtml };
    `,
  )();
}

const dir = mkdtempSync(join(tmpdir(), "qc-d73-"));
const saveDir = join(dir, "qc-save");
writeFileSync(join(dir, `${RUN}.json`), `${JSON.stringify({
  outcome: "DRY_RUN_PASS",
  preparationId: PREP,
  fingerprint: FINGERPRINT,
  run_id: RUN,
})}\n`);

const previousFlag = process.env.EAUSHADHI_QC_NATIVE_SAVE;
delete process.env.EAUSHADHI_QC_NATIVE_SAVE;

function spies() {
  return { click: 0, saveData: 0, recordSave: 0, preSave: 0, verify: 0, reset: 0, recordOutcome: "", rpc: [] };
}

function liveFor(spy, options = {}) {
  let listed = 0;
  const before = options.beforeRows || [];
  const after = options.afterRows == null ? before : options.afterRows;
  return {
    async pageIdentity() {
      return portalPage(options.page || {});
    },
    async fill() {
      return { ok: true, filled_values: { ...FILL } };
    },
    async attach() {
      return { length: 1, name: FILENAME, size: BYTES.length };
    },
    async readForm() {
      if (options.mismatch) {
        return { fields: { ...FILL, batchNo: "OTHER" }, file: { name: FILENAME, size: BYTES.length, length: 1 } };
      }
      return { fields: { ...FILL }, file: { name: FILENAME, size: BYTES.length, length: 1 } };
    },
    async resetForm() {
      spy.reset += 1;
      return { fields: {}, file: { length: 0, size: 0, name: "" }, productValue: "1234" };
    },
    async readList() {
      listed += 1;
      const rows = listed === 1 ? before : after;
      return { success: true, coverageComplete: true, settled: true, rows, requestedPage: 0, totalCount: rows.length };
    },
    async observeSave() {
      spy.click += 1;
      if (options.transport) {
        return observed({
          matchingRequestCount: 0,
          settled: false,
          responseParsed: false,
          status: "",
          message: "",
          transportError: true,
        });
      }
      return observed(options.observation || {});
    },
    saveData() { spy.saveData += 1; },
    async evaluate() { spy.click += 1; },
  };
}

function callRpc(spy, options = {}) {
  return async (_token, name, args) => {
    spy.rpc.push(String(name));
    if (String(name).endsWith("preflight_v1")) return preflight;
    if (String(name).endsWith("pre_save_v1")) {
      spy.preSave += 1;
      if (options.preSaveGo === false) {
        return { go: false, run_status: "PRE_SAVE_ABORTED", reasons: ["READINESS_TUPLE_CHANGED"] };
      }
      return {
        go: true,
        run_status: "SAVE_ARMED",
        pre_save_token: SECRET,
        valid_until: new Date(Date.now() + 60000).toISOString(),
      };
    }
    if (String(name).endsWith("record_save_v1")) {
      spy.recordSave += 1;
      spy.recordOutcome = args?.p_save_outcome || "";
      if (options.unauthorized) return { run_status: "SAVE_UNAUTHORIZED", reasons: [] };
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

let saveSerial = 0;
function executor(spy, options = {}) {
  saveSerial += 1;
  return createQcPrepRunExecutor({
    dryRunDir: dir,
    saveDir: join(saveDir, `case-${saveSerial}`),
    live: liveFor(spy, options),
  });
}

async function attempt(options = {}) {
  const spy = options.spy || spies();
  const runner = options.runner || executor(spy, options);
  let error = null;
  let result = null;
  try {
    result = await runner.performGuardedNativeSave({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP,
      fingerprint: options.fingerprint || FINGERPRINT,
      runId: options.runId || RUN,
      confirmNonce: options.confirmNonce,
      now: options.now,
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
  return { spy, result, error, runner };
}

const ui = makeUi();
ui.state.qcPrepServer = { preparation_id: PREP };
ui.state.qcFillPreflight = preflight;
ui.state.qcFillLoadedFor = PREP;
const offHtml = ui.qcFillPreflightCardHtml();
const offSave = attempt();
const off = await offSave;
assert(off.error?.code === "NATIVE_SAVE_DISABLED" && off.error.reasons.includes("NATIVE_SAVE_BUILD_OFF"), "flag absent throws NATIVE_SAVE_DISABLED");
assert(off.spy.click === 0 && off.spy.saveData === 0 && off.spy.recordSave === 0, "flag absent does not click, call SaveData, or record");
assert(offHtml.includes('id="btnQcNativeSave" disabled') && offHtml.includes("Save is off in this build (start with EAUSHADHI_QC_NATIVE_SAVE=D7.3)"), "the button is disabled with the off hint");

process.env.EAUSHADHI_QC_NATIVE_SAVE = "D7.3";
const unconfirmed = await attempt();
assert(unconfirmed.error?.code === "NATIVE_SAVE_DISABLED" && unconfirmed.error.reasons.includes("CONFIRM_REQUIRED") && unconfirmed.spy.click === 0, "flag on without confirmation does not click");

const expiredSpy = spies();
const expiredRunner = executor(expiredSpy);
const expiredIssued = expiredRunner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT, now: Date.now() - 61000 });
const expired = await attempt({
  spy: expiredSpy,
  runner: expiredRunner,
  confirmNonce: expiredIssued.nonce,
  now: Date.now(),
});
assert(expired.error?.reasons?.includes("CONFIRM_EXPIRED") && expired.spy.click === 0, "an expired confirmation does not click");

const reusedSpy = spies();
const reusedRunner = executor(reusedSpy, {
  afterRows: [{ ...FILL, id: "88", productId: "262" }],
});
const reusedIssued = reusedRunner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
await attempt({
  spy: reusedSpy,
  runner: reusedRunner,
  confirmNonce: reusedIssued.nonce,
});
const reusedSecond = await attempt({ spy: reusedSpy, runner: reusedRunner, confirmNonce: reusedIssued.nonce });
assert(reusedSecond.error?.reasons?.includes("CONFIRM_REUSED") && reusedSpy.click === 1, "a reused confirmation does not click again");

const wrongSpy = spies();
const wrong = executor(wrongSpy);
const wrongIssued = wrong.issueNativeSaveConfirm({ runId: OTHER_RUN, fingerprint: "other-fingerprint" });
const wrongRun = await attempt({ spy: wrongSpy, runner: wrong, confirmNonce: wrongIssued.nonce, runId: RUN, fingerprint: FINGERPRINT });
assert(wrongRun.error?.reasons?.includes("CONFIRM_MISMATCH") && wrongRun.spy.click === 0, "a confirmation for another run does not click");

const confirmedFresh = await (async () => {
  const spy = spies();
  const runner = executor(spy, { afterRows: [{ ...FILL, id: "88", productId: "262" }] });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({
    spy,
    runner,
    confirmNonce: issued.nonce,
  });
})();
assert(confirmedFresh.result?.outcome === "CONFIRMED" && confirmedFresh.spy.recordOutcome === "CONFIRMED" && confirmedFresh.spy.verify === 1, "one matching row is confirmed and the row is verified");
assert(confirmedFresh.result?.runStatus === "ROW_VERIFIED_DOCUMENT_NOT_VERIFIED" && confirmedFresh.spy.click === 1, "the verified result follows exactly one click");
console.log(`CONFIRMED_SAMPLE ${JSON.stringify(confirmedFresh.result?.report)}`);

const noRow = await (async () => {
  const spy = spies();
  const runner = executor(spy, { afterRows: [] });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({ spy, runner, confirmNonce: issued.nonce });
})();
assert(noRow.result?.outcome === "AMBIGUOUS" && noRow.result?.outcome !== "CONFIRMED" && noRow.spy.click === 1, "status 1 with no new row is ambiguous");
console.log(`AMBIGUOUS_SAMPLE ${JSON.stringify(noRow.result?.report)}`);

const timeout = await (async () => {
  const spy = spies();
  const runner = executor(spy, {
    afterRows: [{ ...FILL, id: "89", productId: "262" }],
    observation: { matchingRequestCount: 0, settled: false, responseParsed: false, status: "", message: "", transportError: false },
  });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({
    spy,
    runner,
    confirmNonce: issued.nonce,
    observation: { matchingRequestCount: 0, settled: false, responseParsed: false, status: "", message: "", transportError: false },
  });
})();
assert(timeout.result?.outcome === "AMBIGUOUS" && timeout.spy.click === 1, "a new row with a timeout is ambiguous");

const twice = await (async () => {
  const spy = spies();
  const runner = executor(spy, {
    afterRows: [{ ...FILL, id: "90", productId: "262" }],
    observation: { matchingRequestCount: 2, invokeCount: 1, status: "1", settled: true, responseParsed: true },
  });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({
    spy,
    runner,
    confirmNonce: issued.nonce,
    observation: { matchingRequestCount: 2, invokeCount: 1, status: "1", settled: true, responseParsed: true },
  });
})();
assert(twice.result?.outcome === "AMBIGUOUS" && twice.spy.click === 1, "two Save requests are ambiguous");

const duplicate = await (async () => {
  const spy = spies();
  const runner = executor(spy, {
    observation: {
      status: "0",
      message: "Duplicate",
      businessFailure: true,
      responseParsed: true,
      settled: true,
      matchingRequestCount: 1,
    },
  });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({
    spy,
    runner,
    confirmNonce: issued.nonce,
    observation: {
      status: "0",
      message: "Duplicate",
      businessFailure: true,
      responseParsed: true,
      settled: true,
      matchingRequestCount: 1,
    },
  });
})();
assert(duplicate.result?.outcome === "REJECTED" && duplicate.spy.recordOutcome === "REJECTED" && duplicate.spy.click === 1, "a business refusal with no new row is rejected");

const transport = await (async () => {
  const spy = spies();
  const runner = executor(spy, { transport: true });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({ spy, runner, confirmNonce: issued.nonce, transport: true });
})();
assert(transport.result?.outcome === "AMBIGUOUS" && transport.spy.click === 1, "a transport error is ambiguous and is not retried");

const stopped = await (async () => {
  const spy = spies();
  const runner = executor(spy, { preSaveGo: false });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({ spy, runner, confirmNonce: issued.nonce, preSaveGo: false });
})();
assert(stopped.result?.outcome === "PRE_SAVE_ABORTED" && stopped.spy.click === 0 && stopped.spy.recordSave === 0 && stopped.spy.reset === 1, "pre-save refusal resets the form and does not click");

const mismatch = await (async () => {
  const spy = spies();
  const runner = executor(spy, { mismatch: true });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({ spy, runner, confirmNonce: issued.nonce, mismatch: true });
})();
assert(mismatch.result?.outcome === "PRE_SAVE_LOCAL_MISMATCH" && mismatch.spy.click === 0 && mismatch.spy.preSave === 0, "a local reread mismatch does not click or call pre-save");

const unauthorized = await (async () => {
  const spy = spies();
  const runner = executor(spy, { unauthorized: true, afterRows: [{ ...FILL, id: "91", productId: "262" }] });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({ spy, runner, confirmNonce: issued.nonce, unauthorized: true });
})();
assert(unauthorized.result?.serverStatus === "SAVE_UNAUTHORIZED" && String(unauthorized.result?.message || "").includes("SAVE_UNAUTHORIZED") && unauthorized.spy.verify === 0 && unauthorized.spy.click === 1, "SAVE_UNAUTHORIZED is shown and the row is not verified");

const edited = await (async () => {
  const spy = spies();
  const runner = executor(spy, {
    page: {
      actiontype: { value: "Edit" },
      saveControl: { id: "save_btn", text: "Update", onclick: "function () { return SaveData(); }" },
    },
  });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({
    spy,
    runner,
    confirmNonce: issued.nonce,
    page: {
      actiontype: { value: "Edit" },
      saveControl: { id: "save_btn", text: "Update", onclick: "function () { return SaveData(); }" },
    },
  });
})();
assert(edited.error?.code === "EDIT_MODE_REFUSED" && edited.spy.click === 0, "Edit mode with Update is refused");

const otherRoute = await (async () => {
  const spy = spies();
  const runner = executor(spy, { page: { route: "/admin/other" } });
  const issued = runner.issueNativeSaveConfirm({ runId: RUN, fingerprint: FINGERPRINT });
  return attempt({ spy, runner, confirmNonce: issued.nonce, page: { route: "/admin/other" } });
})();
assert(otherRoute.error?.code === "NATIVE_SAVE_DISABLED" && otherRoute.spy.click === 0, "another route is refused");

function readSavedReports(folder) {
  if (!existsSync(folder)) return "";
  let text = "";
  for (const name of readdirSync(folder)) {
    const full = join(folder, name);
    if (statSync(full).isDirectory()) text += readSavedReports(full);
    else if (name.endsWith(".json")) text += readFileSync(full, "utf8");
  }
  return text;
}

const captured = [
  JSON.stringify(confirmedFresh.result || {}),
  JSON.stringify(noRow.result || {}),
  JSON.stringify(confirmedFresh.runner ? {} : {}),
  readSavedReports(saveDir),
].join("\n");
assert(!captured.includes(SECRET), "the pre-save token is absent from the report and renderer result");
assert(!JSON.stringify(confirmedFresh.result?.report || {}).includes(SECRET) && !JSON.stringify(noRow.result?.report || {}).includes(SECRET), "sample reports do not contain the token");

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
const okClicks = { n: 0 };
const reloads = { n: 0 };
global.window = globalThis;
global.XMLHttpRequest = MockXHR;
global.location = { reload() { reloads.n += 1; } };
global.document = {
  getElementById(id) {
    if (id !== "save_btn") return null;
    return {
      id: "save_btn",
      click() {
        const xhr = new MockXHR();
        xhr.open("POST", "/admin/SaveQCData");
        xhr.send();
        xhr.status = 200;
        xhr.responseText = "{\"status\":\"1\",\"message\":\"saved\"}";
        xhr.dispatch("loadend");
      },
    };
  },
  querySelector() {
    return {
      textContent: "Saved ok",
      querySelector() {
        return { click() { okClicks.n += 1; } };
      },
    };
  },
};
const observe = new Function(createInPageSaveObserveScript())();
const watched = await observe({ allowClick: true, controlId: "save_btn", timeoutMs: 200 });
assert(watched.clicked === true && watched.invokeCount === 1 && okClicks.n === 0 && reloads.n === 0, "the page script clicks save once and does not press the confirm OK");
assert(!observeSrc.includes("location.reload") && !executorSrc.includes("location.reload") && !controlSrc.includes("location.reload"), "the app does not call location.reload");

assert(!executorSrc.includes('saveOutcome: "CONFIRMED"'), "the executor has no hard-coded confirmed outcome");
assert(/const NATIVE_SAVE_AUTHORIZED = false/.test(contractSrc) && NATIVE_SAVE_AUTHORIZED === false, "NATIVE_SAVE_AUTHORIZED stays false");
const flagRead = /env\.EAUSHADHI_QC_NATIVE_SAVE/;
assert(flagRead.test(contractSrc) && !flagRead.test(executorSrc) && !flagRead.test(indexSrc) && !flagRead.test(controlSrc), "the build flag is read only in the contract");
assert(/const CACHE_NAME = "hub-cache-v382"/.test(swSrc), "service worker cache is v382");
assert(offHtml.includes('data-build="D7.3.2"') && offHtml.includes('id="qcFillBuild"'), "the card shows UI build D7.3.2");
assert([off, unconfirmed, expired, reusedSecond, wrongRun, confirmedFresh, noRow, timeout, twice, duplicate, transport, stopped, mismatch, unauthorized, edited, otherRoute].every((item) => (item.spy?.click || 0) <= 1), "no case clicks more than once");

if (previousFlag == null) delete process.env.EAUSHADHI_QC_NATIVE_SAVE;
else process.env.EAUSHADHI_QC_NATIVE_SAVE = previousFlag;
rmSync(dir, { recursive: true, force: true });

if (failed) {
  console.error(`D7.3 smoke failed ${failed}`);
  process.exit(1);
}
console.log("D7.3 smoke passed");
