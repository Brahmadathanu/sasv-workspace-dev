import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { QC_PORTAL_CONTRACT, NATIVE_SAVE_AUTHORIZED } = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { assessQcListResponse } = require(join(root, "electron/eaushadhi-worker/qc-register-list.js"));
const { compareReportBytes, createQcPrepRunExecutor } = require(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"));

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const BASIS = "Study start date 01-10-2021 derived by the operator from the NUPAL report.";
const NOTE = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection.";
const TUPLE = "a".repeat(64);
const OTHER_TUPLE = "b".repeat(64);
const REUSE = "fc0cd11f-1111-4111-8111-111111111111";
const NEW_RUN = "bbbbbbbb-2222-4222-8222-222222222222";
const REPORT_NAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const LOCAL_NAME = "KARPOORADI THAILAM.pdf";
const REPORT_BYTES = Buffer.from("verified-qc-report-bytes");
const REPORT_SHA = createHash("sha256").update(REPORT_BYTES).digest("hex");
const FILL = {
  typeOfStudy: "Cross Sectional Approach (API Vol VIII Page No:226)",
  startDate: "2021-10-01",
  endDate: "2022-10-01",
  reportDate: "2022-10-15",
  batchNo: "B-262",
  duration: "12",
  labName: "HARIDEV FORMULATIONS",
  qualityCntrl: "In",
};
const dir = mkdtempSync(join(tmpdir(), "qc-dryrun-721-"));
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
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === mode) mode = "code";
      continue;
    }
    if (mode === "`") {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "`") mode = "code";
      else if (ch === "$" && next === "{") {
        templateAt.push(depth);
        mode = "code";
        depth += 1;
        i += 1;
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      mode = "line";
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      mode = "block";
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      mode = ch;
      continue;
    }
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

const ui = new Function(
  `const state = {
     selectedProductId: 262,
     qcPrepServer: { preparation_id: ${JSON.stringify(PREP)} },
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
     qcFillRecapture: null
   };
   const access = { canView: true, canEdit: true };
   let workerOn = true;
   function canWrite() { return access.canEdit === true; }
   function workerApiAvailable() { return workerOn; }
   function qcHtmlEscape(value) {
     return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
   }
   function qcIstStamp() { return ""; }
   function qcReadinessFactLabel(fact) { return String(fact || ""); }
   const QC_FILL_PROVISIONAL_PREFILL = ${JSON.stringify(NOTE)};
   const QC_FILL_SAVE_BLOCKED = "The portal control that runs Save is labelled Submit. Save was not pressed.";
   const QC_FILL_QUALIFICATION = "Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified.";
   const QC_FILL_FIELD_ROWS = [["typeOfStudy", "Type of study"]];
   const QC_FILL_BLOCKER_TEXT = { READINESS_NOT_READY: "Readiness is not Ready (provisional) yet" };
   ${extractFunction(controlSrc, "qcFillBlockerText")}
   ${extractFunction(controlSrc, "qcSeedFillAcks")}
   ${extractFunction(controlSrc, "qcFillArmBlockReason")}
   ${extractFunction(controlSrc, "qcFillArmReady")}
   ${extractFunction(controlSrc, "qcFillPreflightCardHtml")}
   return { state, access, setWorker(value) { workerOn = value; }, qcFillPreflightCardHtml, qcFillArmReady };
  `,
)();

function preflight(extra = {}) {
  return {
    blockers: [],
    readiness: { status: "READY_PROVISIONAL", readiness_tuple: TUPLE },
    fill_fields: FILL,
    context: {
      report_issuer: "NUPAL",
      laboratory_label: "HARIDEV FORMULATIONS",
      derived_facts: [{ fact: "study_start_date", basis_note: BASIS }],
    },
    runs: [],
    ...extra,
  };
}

function readyCard() {
  ui.access.canEdit = true;
  ui.setWorker(true);
  ui.state.qcPrepRunBusy = false;
  ui.state.qcGovernanceConfirmOpen = false;
  ui.state.qcFillInspectOk = true;
  ui.state.qcFillLoadedFor = PREP;
  ui.state.qcFillPreflight = preflight();
  ui.state.qcFillAckScope = "";
  ui.qcFillPreflightCardHtml();
  ui.state.qcFillProvisionalAck = true;
  ui.state.qcFillDerivedAck = true;
}

ui.qcFillPreflightCardHtml();
assert(ui.state.qcFillDerivedNote === "", "the derived note stays empty before preflight loads");
ui.state.qcFillLoadedFor = PREP;
ui.state.qcFillPreflight = preflight();
ui.qcFillPreflightCardHtml();
assert(ui.state.qcFillDerivedNote === BASIS, "the derived note is filled from the basis note");
ui.state.qcFillProvisionalAck = true;
ui.state.qcFillDerivedAck = true;
const armedHtml = ui.qcFillPreflightCardHtml();
assert(armedHtml.includes('id="btnQcFillArm">') && ui.qcFillArmReady() === true, "Arm becomes enabled once both ticks are set");

ui.state.qcFillDerivedNote = "Operator typed this acknowledgement and it must stay.";
ui.state.qcFillDerivedNoteTouched = true;
ui.state.qcFillAckScope = `${ui.state.selectedProductId}:${PREP}:pending`;
ui.state.qcFillPreflight = preflight();
ui.state.qcFillPreflight.context.derived_facts = [{ fact: "study_start_date", basis_note: `${BASIS} replacement` }];
ui.qcFillPreflightCardHtml();
assert(ui.state.qcFillDerivedNote === "Operator typed this acknowledgement and it must stay.", "an operator-typed note is not overwritten");

const reasons = [
  ["preflight", () => { ui.state.qcFillPreflight = null; }, "Preflight has not loaded."],
  ["blockers", () => { readyCard(); ui.state.qcFillPreflight = preflight({ blockers: ["READINESS_NOT_READY"] }); }, "Blockers are still present."],
  ["rights", () => { readyCard(); ui.access.canEdit = false; }, "You do not have edit rights."],
  ["worker", () => { readyCard(); ui.setWorker(false); }, "The portal worker is not available."],
  ["busy", () => { readyCard(); ui.state.qcPrepRunBusy = true; }, "A QC filling step is already running."],
  ["lab tick", () => { readyCard(); ui.state.qcFillProvisionalAck = false; }, "Tick the provisional laboratory acknowledgement."],
  ["lab note", () => { readyCard(); ui.state.qcFillProvisionalNote = "short"; }, "The laboratory note must be 10–2000 characters."],
  ["derived tick", () => { readyCard(); ui.state.qcFillDerivedAck = false; }, "Tick the derived-date acknowledgement."],
  ["derived note", () => { readyCard(); ui.state.qcFillDerivedNote = "short"; ui.state.qcFillDerivedNoteTouched = true; }, "The derived note must be 10–2000 characters."],
];
for (const [name, setup, text] of reasons) {
  setup();
  const html = ui.qcFillPreflightCardHtml();
  const reason = html.slice(html.indexOf('id="qcFillButtonsReason"'), html.indexOf("</p>", html.indexOf('id="qcFillButtonsReason"')));
  assert(reason.includes(text), `${name} appears in the button reason`);
}

readyCard();
ui.state.qcFillInspectOk = false;
const beforeInspect = ui.qcFillPreflightCardHtml();
assert(beforeInspect.includes("Run Check portal page first (it must pass).") && beforeInspect.includes('id="btnQcFillDryRun" disabled'), "Dry run explains that Check portal page must pass first");
ui.state.qcFillInspectOk = true;
const afterInspect = ui.qcFillPreflightCardHtml();
assert(afterInspect.includes('id="btnQcFillDryRun">'), "Dry run is enabled after a passing check and ready acknowledgements");
ui.state.qcFillChosenReportName = LOCAL_NAME;
assert(ui.qcFillPreflightCardHtml().includes(`id="qcFillInspectFileName">Report to check: ${LOCAL_NAME}`), "choosing a file shows the report name");

function page() {
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
    saveControl: { id: "save_btn", text: "Submit" },
  };
}

function emptyForm() {
  return {
    fields: Object.fromEntries(Object.keys(FILL).map((key) => [key, ""])),
    file: { name: "", size: 0, length: 0 },
    productValue: "1234",
  };
}

async function runDry({ bytes = REPORT_BYTES, filename = LOCAL_NAME, runs = [], runId = NEW_RUN } = {}) {
  const counts = { arm: 0, preSave: 0, recordSave: 0, click: 0, saveData: 0, attachedName: "" };
  const executor = createQcPrepRunExecutor({
    dryRunDir: dir,
    live: {
      async pageIdentity() { return page(); },
      async readList() { return assessQcListResponse({ status: "1", data: [], TotalCount: 0 }, { pageno: 0 }); },
      async fill() { return { ok: true, filled: true, filled_values: FILL }; },
      async attach(file) {
        counts.attachedName = file.filename;
        return { length: 1, name: file.filename, size: file.buffer.length };
      },
      async readForm() {
        return { fields: FILL, file: { name: REPORT_NAME, size: REPORT_BYTES.length, length: 1 }, productValue: "1234" };
      },
      async payloadKeys() { return { keys: Object.keys(FILL) }; },
      async resetForm() { return emptyForm(); },
      async evaluate() { counts.click += 1; },
      saveData() { counts.saveData += 1; },
    },
  });
  const result = await executor.dryRun({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP,
    userConfirmed: true,
    provisionalAck: true,
    provisionalNote: NOTE,
    derivedAck: true,
    derivedNote: NOTE,
    filename,
    bytes,
    callRpc: async (_token, name, args) => {
      if (String(name).includes("record_save")) {
        counts.recordSave += 1;
        return {};
      }
      if (String(name).endsWith("preflight_v1")) {
        return {
          blockers: [],
          readiness: { status: "READY_PROVISIONAL", readiness_tuple: TUPLE },
          fill_fields: FILL,
          context: {
            portal_product_ref: "MTIzNDU2Nzgx",
            study_type_select_value: "Others",
            derived_facts: [{ fact: "study_start_date" }],
            report_sha256: REPORT_SHA,
            report_size_bytes: REPORT_BYTES.length,
            report_filename: REPORT_NAME,
          },
          runs,
        };
      }
      if (String(name).endsWith("arm_v1")) {
        counts.arm += 1;
        return { run_id: runId, run_status: "SAVE_ARMED", fill_fields: FILL, qualification: "Portal laboratory is provisional." };
      }
      if (String(name).endsWith("pre_save_v1")) {
        counts.preSave += 1;
        counts.preSaveRun = args.p_run_id;
        return { go: true, run_status: "SAVE_ARMED", pre_save_token: "LEAK-TOKEN-dry-run-9f3a", valid_until: new Date(Date.now() + 60000).toISOString() };
      }
      return {};
    },
  });
  return { result, counts, executor };
}

const context = { report_sha256: REPORT_SHA, report_size_bytes: REPORT_BYTES.length, report_filename: REPORT_NAME };
const renamed = compareReportBytes({ name: LOCAL_NAME, bytes: REPORT_BYTES, context });
assert(renamed.ok === true && renamed.filename === REPORT_NAME && renamed.chosenFilename === LOCAL_NAME, "a renamed file matches by content");
const changed = Buffer.from(REPORT_BYTES);
changed[0] = changed[0] === 65 ? 66 : 65;
assert(compareReportBytes({ name: LOCAL_NAME, bytes: changed, context }).reason === "SHA256_DIFFERS", "one changed byte is SHA256_DIFFERS");
assert(compareReportBytes({ name: LOCAL_NAME, bytes: REPORT_BYTES.subarray(0, 4), context }).reason === "SIZE_DIFFERS", "a truncated file is SIZE_DIFFERS");
assert(compareReportBytes({ name: LOCAL_NAME, bytes: null, context }).reason === "NO_FILE", "no file is NO_FILE");

const attached = await runDry();
assert(attached.result.report.file.match === true && attached.counts.attachedName === REPORT_NAME, "the renamed file is attached under the registered name");
assert(attached.result.report.file.expected.filename === REPORT_NAME && attached.result.report.file.chosen.filename === LOCAL_NAME, "the report shows the expected and seen file");
const shaRun = await runDry({ bytes: changed, runId: "cccccccc-3333-4333-8333-333333333333" });
assert(shaRun.result.report.file.reason === "SHA256_DIFFERS" && shaRun.counts.attachedName === "", "a changed file is not attached");
const shortRun = await runDry({ bytes: REPORT_BYTES.subarray(0, 4), runId: "dddddddd-4444-4444-8444-444444444444" });
assert(shortRun.result.report.file.reason === "SIZE_DIFFERS", "a truncated file fails on size");
const noneRun = await runDry({ bytes: null, runId: "eeeeeeee-5555-4555-8555-555555555555" });
assert(noneRun.result.report.file.reason === "NO_FILE" && noneRun.result.report.file.expected.filename === REPORT_NAME, "no file is reported with the expected name");

const reused = await runDry({
  runs: [{
    run_id: REUSE,
    run_status: "SAVE_ARMED",
    preparation_id: PREP,
    readiness_tuple: TUPLE,
    save_outcome: null,
    pre_save_token_consumed_at: null,
    fill_fields: FILL,
  }],
});
assert(reused.counts.arm === 0 && reused.counts.preSave === 1 && reused.counts.preSaveRun === REUSE && reused.result.report.arm.reused === true, "an open dry-run is reused without a new arm");
console.log(`DRY_RUN_SAMPLE ${JSON.stringify({ arm: reused.result.report.arm, file: reused.result.report.file, clicked: reused.result.clicked })}`);

const otherTuple = await runDry({
  runs: [{ run_id: REUSE, run_status: "SAVE_ARMED", preparation_id: PREP, readiness_tuple: OTHER_TUPLE, save_outcome: null, pre_save_token_consumed_at: null }],
});
assert(otherTuple.counts.arm === 0 && otherTuple.result.reasons.includes("ACTIVE_RUN") && otherTuple.result.message.includes("SAVE_ARMED"), "a different readiness tuple stays ACTIVE_RUN");
const ambiguous = await runDry({ runs: [{ run_id: REUSE, run_status: "SAVE_AMBIGUOUS", save_outcome: "AMBIGUOUS" }] });
assert(ambiguous.counts.arm === 0 && ambiguous.result.reasons.includes("ACTIVE_RUN") && ambiguous.result.message.includes("SAVE_AMBIGUOUS"), "SAVE_AMBIGUOUS stays ACTIVE_RUN");
const aborted = await runDry({ runs: [{ run_id: REUSE, run_status: "PRE_SAVE_ABORTED" }] });
assert(aborted.counts.arm === 1 && aborted.result.message.includes("previous run was aborted, a new run was armed"), "an aborted run arms a new run");

const guardCounts = { click: 0, recordSave: 0, saveData: 0 };
const guard = createQcPrepRunExecutor({
  dryRunDir: dir,
  contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
  live: {
    async pageIdentity() { return page(); },
    async evaluate() { guardCounts.click += 1; },
    saveData() { guardCounts.saveData += 1; },
  },
});
let guardError = null;
try {
  await guard.performGuardedNativeSave({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP,
    fingerprint: reused.result.report.fingerprint,
    runId: REUSE,
    preSave: { go: true, pre_save_token: "LEAK-TOKEN-dry-run-9f3a", valid_until: new Date(Date.now() + 60000).toISOString() },
    callRpc: async (_token, name) => {
      if (String(name).includes("record_save")) guardCounts.recordSave += 1;
      return {};
    },
  });
} catch (error) {
  guardError = error;
}
assert(guardError?.code === "NATIVE_SAVE_DISABLED" && guardCounts.click === 0 && guardCounts.recordSave === 0 && guardCounts.saveData === 0 && NATIVE_SAVE_AUTHORIZED === false, "guarded Save still cannot click");
assert(reused.counts.click === 0 && reused.counts.saveData === 0 && reused.counts.recordSave === 0, "the dry run spies stay at zero");

rmSync(dir, { recursive: true, force: true });
if (failed) {
  console.error(`D7.2.1 smoke failed ${failed}`);
  process.exit(1);
}
console.log("D7.2.1 smoke passed");
