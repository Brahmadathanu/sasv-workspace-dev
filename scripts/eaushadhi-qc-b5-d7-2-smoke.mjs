import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  NATIVE_SAVE_AUTHORIZED,
  QC_PORTAL_CONTRACT,
  isPermittedSaveControl,
} = require(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"));
const { assessQcListResponse } = require(join(root, "electron/eaushadhi-worker/qc-register-list.js"));
const { createQcPrepRunExecutor } = require(join(root, "electron/eaushadhi-worker/qc-prep-run-executor.js"));

const TOKEN = `qc-fill-token-${"c".repeat(20)}`;
const PREP = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const RUN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const LEAK = "LEAK-TOKEN-dry-run-9f3a";
const NOTE = "I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection.";
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
const REPORT_NAME = "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf";
const REPORT_BYTES = Buffer.from("verified-qc-report-bytes");
const REPORT_SHA = createHash("sha256").update(REPORT_BYTES).digest("hex");
const dir = mkdtempSync(join(tmpdir(), "qc-dryrun-"));
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
    return;
  }
  console.log(`OK ${message}`);
}

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
    saveControl: { id: "save_btn", text: "Submit", onclick: "function () { return SaveData(); }" },
  };
}

function emptyForm() {
  return {
    fields: {
      typeOfStudy: "",
      startDate: "",
      endDate: "",
      reportDate: "",
      batchNo: "",
      duration: "",
      labName: "",
      qualityCntrl: "",
    },
    file: { name: "", size: 0, length: 0 },
    productValue: "1234",
  };
}

async function runCase(overrides = {}) {
  const counts = { arm: 0, preSave: 0, recordSave: 0, click: 0, saveData: 0 };
  const filled = { ...FILL, ...(overrides.fields || {}) };
  const executor = createQcPrepRunExecutor({
    dryRunDir: dir,
    contract: overrides.contract || QC_PORTAL_CONTRACT,
    live: {
      async pageIdentity() {
        return page();
      },
      async readList() {
        return assessQcListResponse({ status: "1", data: [], TotalCount: 0 }, { pageno: 0 });
      },
      async fill() {
        return { ok: true, filled: true, filled_values: FILL };
      },
      async attach() {
        return { length: 1, name: REPORT_NAME, size: REPORT_BYTES.length };
      },
      async readForm() {
        return {
          fields: filled,
          file: { name: REPORT_NAME, size: REPORT_BYTES.length, length: 1 },
          productValue: "1234",
        };
      },
      async payloadKeys() {
        return { keys: ["typeOfStudy", "startDate", "endDate", "reportDate", "batchNo", "duration", "labName", "qualityCntrl", "productId"] };
      },
      async resetForm() {
        return overrides.reset || emptyForm();
      },
      async evaluate() {
        counts.click += 1;
      },
      async observeSave() {
        counts.click += 1;
        counts.saveData += 1;
      },
      saveData() {
        counts.saveData += 1;
      },
    },
  });
  const result = await executor.dryRun({
    productId: 262,
    accessToken: TOKEN,
    preparationId: PREP,
    userConfirmed: true,
    provisionalAck: overrides.provisionalAck !== false,
    provisionalNote: NOTE,
    derivedAck: overrides.derivedAck !== false,
    derivedNote: NOTE,
    filename: REPORT_NAME,
    bytes: REPORT_BYTES,
    callRpc: async (_token, name) => {
      if (String(name).includes("record_save")) {
        counts.recordSave += 1;
        return {};
      }
      if (String(name).endsWith("preflight_v1")) {
        return {
          blockers: [],
          readiness: { status: "READY_PROVISIONAL", readiness_tuple: "tuple-1" },
          fill_fields: FILL,
          context: {
            portal_product_ref: "MTIzNDU2NzgxMjM0NTY3ODEyMzQ1Njc4MTIzNG8atnUB3i77xOliuhhG1VsNyCEv7W0",
            study_type_select_value: "Others",
            derived_facts: [{ fact: "study_start_date" }],
            report_sha256: REPORT_SHA,
            report_size_bytes: REPORT_BYTES.length,
            report_filename: REPORT_NAME,
          },
          runs: [],
        };
      }
      if (String(name).endsWith("arm_v1")) {
        counts.arm += 1;
        return { run_id: RUN, run_status: "SAVE_ARMED", fill_fields: FILL, qualification: "Portal laboratory is provisional." };
      }
      if (String(name).endsWith("pre_save_v1")) {
        counts.preSave += 1;
        return overrides.preSave || {
          go: true,
          run_status: "SAVE_ARMED",
          pre_save_token: LEAK,
          valid_until: new Date(Date.now() + 60000).toISOString(),
        };
      }
      return {};
    },
  });
  return { result, counts, executor };
}

try {
  const passed = await runCase();
  assert(passed.result.outcome === "DRY_RUN_PASS" && passed.result.clicked === false && passed.result.report.reset.ok === true, "a dry run that passes");
  assert(passed.counts.recordSave === 0 && passed.counts.click === 0 && passed.counts.saveData === 0, "the dry run never calls record-save, click, or SaveData");
  const stored = readFileSync(join(dir, `${RUN}.json`), "utf8");
  const blob = `${JSON.stringify(passed.result)}\n${JSON.stringify(passed.executor.status())}\n${stored}`;
  assert(!blob.includes(LEAK), "the token is never kept or logged");
  console.log(`DRY_RUN_SAMPLE ${JSON.stringify(passed.result.report)}`);

  const guard = createQcPrepRunExecutor({
    dryRunDir: dir,
    contract: { ...QC_PORTAL_CONTRACT, nativeSaveClickEnabled: true },
    live: {
      async pageIdentity() {
        return page();
      },
      async evaluate() {
        passed.counts.click += 1;
      },
    },
  });
  let guardError = null;
  try {
    await guard.performGuardedNativeSave({
      productId: 262,
      accessToken: TOKEN,
      preparationId: PREP,
      fingerprint: passed.result.report.fingerprint,
      runId: RUN,
      preSave: { go: true, pre_save_token: LEAK, valid_until: new Date(Date.now() + 60000).toISOString() },
      callRpc: async (_token, name) => {
        if (String(name).includes("record_save")) passed.counts.recordSave += 1;
        return {};
      },
    });
  } catch (error) {
    guardError = error;
  }
  assert(guardError?.code === "NATIVE_SAVE_DISABLED" && guardError.reasons.length === 1 && guardError.reasons[0] === "NATIVE_SAVE_AUTHORIZED" && passed.counts.click === 0 && passed.counts.recordSave === 0, "guarded Save throws NATIVE_SAVE_DISABLED with zero clicks");

  const mismatch = await runCase({ fields: { batchNo: "OTHER" } });
  assert(mismatch.result.outcome === "DRY_RUN_FAIL" && mismatch.result.reasons.some((reason) => reason.includes("batchNo")), "a field mismatch gives FAIL");

  const refused = await runCase({ preSave: { go: false, run_status: "PRE_SAVE_ABORTED", reasons: ["READINESS_TUPLE_CHANGED"], pre_save_token: LEAK } });
  assert(refused.result.outcome === "DRY_RUN_FAIL" && refused.result.report.pre_save.go === false, "pre_save go false gives FAIL");

  const sticky = await runCase({ reset: { ...emptyForm(), fields: { ...emptyForm().fields, batchNo: "LEFT" } } });
  assert(sticky.result.outcome === "DRY_RUN_FAIL" && sticky.result.banner === "Form contains UNSAVED dry-run values. Do not press Submit. Reload the page.", "a reset failure shows the banner and gives FAIL");

  const noAck = await runCase({ provisionalAck: false });
  assert(noAck.counts.arm === 0 && noAck.result.outcome === "DRY_RUN_FAIL", "a missing acknowledgement means no arm call");

  assert(isPermittedSaveControl("/admin/addQCRegister", "#save_btn") === true, "the permitted control is the Add QC Register Save button");
  assert(isPermittedSaveControl("/admin/other", "#save_btn") === false && isPermittedSaveControl("/admin/addQCRegister", "#delete_btn") === false, "any other page or selector is rejected");
  const contractSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-register-portal-contract.js"), "utf8");
  assert(/const NATIVE_SAVE_AUTHORIZED = false/.test(contractSrc) && NATIVE_SAVE_AUTHORIZED === false, "NATIVE_SAVE_AUTHORIZED is false");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`D7.2 smoke failed ${failed}`);
  process.exit(1);
}
console.log("D7.2 smoke passed");
