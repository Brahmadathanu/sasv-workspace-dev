import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { QC_PORTAL_CONTRACT, NATIVE_SAVE_AUTHORIZED } = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { createQcPrepRunExecutor } = require(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"));
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const BASIS = "Study start date 01-10-2021 derived by the operator as the earliest batch manufacturing date among batches 3369, 4896, 2434, 3250, 3738, 4601, 5201 stated on the NUPAL certificate of analysis / QC test report (EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf). The report does not state a study start date.";
const PREFILL = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection; NUPAL is the report issuer; legal identity and portal eligibility are not verified.";
const TYPED = "Operator typed this acknowledgement and it must stay.";
const preflight = {
  blockers: [],
  readiness: { status: "READY_PROVISIONAL", readiness_tuple: "t".repeat(64) },
  fill_fields: {
    typeOfStudy: "Cross Sectional Approach (API Vol VIII Page No:226)",
    startDate: "2021-10-01",
    endDate: "2025-01-04",
    reportDate: "2025-01-04",
    batchNo: "3369,4896,2434,3250,3738,4601,5201",
    duration: "36",
    labName: "HARIDEV FORMULATIONS",
    qualityCntrl: "Out",
  },
  context: {
    product_id: 262,
    report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
    laboratory_label: "HARIDEV FORMULATIONS",
    report_filename: "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf",
    derived_facts: [{ fact: "study_start_date", acceptance_id: 29, basis_note: BASIS }],
  },
  runs: [{ run_id: "fc0cd11f-f844-4f2b-a225-070321849788", run_status: "SAVE_ARMED", save_outcome: null }],
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
       qcFillRecapture: null
     };
     const access = { canView: true, canEdit: true };
     function canWrite() { return access.canEdit === true; }
     function workerApiAvailable() { return true; }
     function qcHtmlEscape(value) {
       return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
     }
     function qcIstStamp() { return ""; }
     function qcReadinessFactLabel(fact) { return String(fact || ""); }
     const QC_FILL_PROVISIONAL_PREFILL = ${JSON.stringify(PREFILL)};
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

function noteField(html) {
  const start = html.indexOf('id="qcFillDerivedNote"');
  return html.slice(start, html.indexOf("</textarea>", start));
}

const ui = makeUi();
ui.qcFillPreflightCardHtml();
ui.state.qcPrepServer = { preparation_id: PREP };
ui.state.qcFillPreflight = null;
ui.state.qcFillLoadedFor = "";
ui.qcFillPreflightCardHtml();
ui.state.qcFillLoadedFor = PREP;
ui.state.qcFillPreflight = preflight;
const loadedHtml = ui.qcFillPreflightCardHtml();
assert(noteField(loadedHtml).includes(BASIS), "the loaded card puts the basis note in the acknowledgement box");
assert(ui.state.qcFillProvisionalNote === PREFILL, "the provisional note stays the laboratory prefill");
assert(ui.state.qcFillProvisionalAck !== true && ui.state.qcFillDerivedAck !== true, "neither acknowledgement is ticked automatically");

const harden = makeUi();
harden.state.qcPrepServer = { preparation_id: PREP };
harden.state.qcFillLoadedFor = PREP;
harden.state.qcFillPreflight = preflight;
harden.state.qcFillAckScope = `262:${PREP}:loaded`;
harden.state.qcFillDerivedNote = "";
harden.state.qcFillDerivedNoteTouched = false;
const hardenedHtml = harden.qcFillPreflightCardHtml();
assert(harden.state.qcFillDerivedNote === BASIS && noteField(hardenedHtml).includes(BASIS), "an empty untouched note still fills when the scope is already loaded");
assert(harden.state.qcFillProvisionalAck !== true && harden.state.qcFillDerivedAck !== true, "the hardening fill does not tick either box");

const refresh = makeUi();
refresh.state.qcPrepServer = { preparation_id: PREP };
refresh.state.qcFillLoadedFor = PREP;
refresh.state.qcFillPreflight = preflight;
refresh.qcFillPreflightCardHtml();
refresh.state.qcFillPreflight = null;
refresh.state.qcFillLoadedFor = "";
refresh.qcFillPreflightCardHtml();
refresh.state.qcFillLoadedFor = PREP;
refresh.state.qcFillPreflight = preflight;
refresh.qcFillPreflightCardHtml();
assert(refresh.state.qcFillDerivedNote === BASIS, "a refresh and reload keeps the basis note");

function keepTyped(label, run) {
  const card = makeUi();
  card.state.qcFillDerivedNote = TYPED;
  card.state.qcFillDerivedNoteTouched = true;
  run(card);
  assert(card.state.qcFillDerivedNote === TYPED && card.state.qcFillDerivedNoteTouched === true, label);
}
keepTyped("a typed note survives the loaded render", (card) => {
  card.state.qcPrepServer = { preparation_id: PREP };
  card.state.qcFillPreflight = null;
  card.state.qcFillLoadedFor = "";
  card.qcFillPreflightCardHtml();
  card.state.qcFillDerivedNote = TYPED;
  card.state.qcFillDerivedNoteTouched = true;
  card.state.qcFillLoadedFor = PREP;
  card.state.qcFillPreflight = preflight;
  card.qcFillPreflightCardHtml();
});
keepTyped("a typed note survives the already-loaded scope", (card) => {
  card.state.qcPrepServer = { preparation_id: PREP };
  card.state.qcFillLoadedFor = PREP;
  card.state.qcFillPreflight = preflight;
  card.state.qcFillAckScope = `262:${PREP}:loaded`;
  card.qcFillPreflightCardHtml();
});
keepTyped("a typed note survives a refresh and reload", (card) => {
  card.state.qcPrepServer = { preparation_id: PREP };
  card.state.qcFillAckScope = `262:${PREP}:loaded`;
  card.state.qcFillLoadedFor = "";
  card.state.qcFillPreflight = null;
  card.qcFillPreflightCardHtml();
  card.state.qcFillLoadedFor = PREP;
  card.state.qcFillPreflight = preflight;
  card.qcFillPreflightCardHtml();
});

const ready = makeUi();
ready.state.qcPrepServer = { preparation_id: PREP };
ready.state.qcFillLoadedFor = PREP;
ready.state.qcFillPreflight = preflight;
ready.qcFillPreflightCardHtml();
assert(ready.state.qcFillProvisionalAck !== true && ready.state.qcFillDerivedAck !== true, "ticks stay off after the real load");
ready.state.qcFillProvisionalAck = true;
ready.state.qcFillDerivedAck = true;
ready.state.qcFillInspectOk = true;
const readyHtml = ready.qcFillPreflightCardHtml();
const reasonAt = readyHtml.indexOf('id="qcFillButtonsReason"');
const reasonText = readyHtml.slice(reasonAt, readyHtml.indexOf("</p>", reasonAt));
assert(readyHtml.includes('id="btnQcFillDryRun">') && reasonText === 'id="qcFillButtonsReason">', "Dry run is enabled and the reason line is empty");
assert(readyHtml.includes('data-build="D7.3.1"') && readyHtml.includes('id="qcFillBuild"'), "the card shows UI build D7.3.1");

const networkAt = swSrc.indexOf("eaushadhi-review-");
const cacheFirstAt = swSrc.indexOf("// Static → cache-first");
const networkBranch = swSrc.slice(networkAt, cacheFirstAt);
const reviewPath = "/shared/js/eaushadhi-review-control.js";
assert(/const CACHE_NAME = "hub-cache-v372"/.test(swSrc), "service worker cache is v372");
assert(networkAt > 0 && networkAt < cacheFirstAt && networkBranch.includes('fetch(req, { cache: "no-store" })'), "the review renderer is in the network-first branch");
assert(/\/shared\/js\/eaushadhi-review-.*\.js$/.test(reviewPath) && /\/shared\/js\/eaushadhi-.*\.js$/.test(reviewPath), "the review-control path matches the network-first rules");
assert(!swSrc.slice(cacheFirstAt).includes("eaushadhi-review-control.js"), "the cache-first fallback does not name the review renderer");

const spies = { click: 0, saveData: 0, recordSave: 0 };
const guard = createQcPrepRunExecutor({
  live: {
    async pageIdentity() {
      return { origin: QC_PORTAL_CONTRACT.origin, route: QC_PORTAL_CONTRACT.route, saveControl: { id: "save_btn" } };
    },
    async evaluate() { spies.click += 1; },
    saveData() { spies.saveData += 1; },
  },
});
let guardError = null;
try {
  await guard.performGuardedNativeSave({
    productId: 262,
    accessToken: `qc-fill-token-${"c".repeat(20)}`,
    preparationId: PREP,
    callRpc: async (_token, name) => {
      if (String(name).includes("record_save")) spies.recordSave += 1;
      return {};
    },
  });
} catch (error) {
  guardError = error;
}
assert(guardError?.code === "NATIVE_SAVE_DISABLED" && spies.click === 0 && spies.saveData === 0 && spies.recordSave === 0 && NATIVE_SAVE_AUTHORIZED === false, "guarded Save still cannot click");

if (failed) {
  console.error(`D7.2.2 smoke failed ${failed}`);
  process.exit(1);
}
console.log("D7.2.2 smoke passed");
