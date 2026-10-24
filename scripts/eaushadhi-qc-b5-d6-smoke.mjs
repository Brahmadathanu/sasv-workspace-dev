import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = require(join(root, "electron/eaushadhi-worker/qc-preparation-workspace.js"));
const { ERROR_KINDS } = require(join(root, "electron/eaushadhi-worker/errors.js"));

const TOKEN = `workspace-token-${"b".repeat(24)}`;
const PREP_ID = "d5b425c3-486f-465d-96eb-b1f9d3565e63";
const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
const clientSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-worker-client.js"), "utf8");
const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
const workerSrc = readFileSync(join(root, "electron/eaushadhi-worker/qc-preparation-workspace.js"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/20261013095629_wp07_b5_r2_qc_prep_run.sql"));

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
    return error;
  }
  assert(false, `expected failure ${kind}`);
  return null;
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

assert(migration.length === 59779, "B5 migration length is 59779");
assert(createHash("md5").update(migration).digest("hex") === "866d19f7565f2520099e602e14ebbd55", "B5 migration md5 is exact");

const correctBase = {
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 7,
  supersedesAcceptanceId: 1,
  basisCategory: "OPERATOR_DERIVATION",
  basisNote: "Study start date derived by the operator from the batches.",
  correctionReason: "Earlier basis was inaccurate and is corrected here.",
  attest: true,
};

async function rejectCorrect(label, overrides = {}) {
  const rpc = mockRpc(async () => ({}));
  await expectFailure(
    () => workspace.correctQcFactAcceptance({ ...correctBase, callRpc: rpc.callRpc, ...overrides }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(rpc.calls.length === 0, `${label} makes no RPC call`);
}
await rejectCorrect("a bad correction UUID", { preparationId: "nope" });
await rejectCorrect("a bad correction version", { expectedRowVersion: 0 });
await rejectCorrect("a bad superseded acceptance", { supersedesAcceptanceId: 0 });
await rejectCorrect("a bad correction category", { basisCategory: "GUESS" });
await rejectCorrect("a short correction note", { basisNote: "too short" });
await rejectCorrect("a short correction reason", { correctionReason: "too short" });
await rejectCorrect("a missing correction attest", { attest: false });

const correctRpc = mockRpc(async () => ({
  acceptance_id: 8,
  supersedes_acceptance_id: 1,
  binding_id: 3,
  fact_key: "study_start_date",
  self_accepted: false,
}));
const corrected = await workspace.correctQcFactAcceptance({ ...correctBase, callRpc: correctRpc.callRpc });
assert(correctRpc.calls.length === 1 && correctRpc.calls[0].name === "rpc_eaushadhi_qc_fact_acceptance_correct_v1", "correction uses the correct RPC");
assert(
  Object.keys(correctRpc.calls[0].args).join(",") === "p_preparation_id,p_expected_row_version,p_supersedes_acceptance_id,p_basis_category,p_basis_note,p_correction_reason,p_attest",
  "correction argument names and order are exact",
);
assert(corrected.mutated === true && corrected.acceptance_id === 8 && corrected.supersedes_acceptance_id === 1, "correction returns the new head");

const verifyBase = {
  productId: 262,
  accessToken: TOKEN,
  mappingId: 32,
  expectedStatus: "DRAFT",
  expectedPortalOptionId: 493,
  mappingReason: "Others confirmed against the live Type of Study list.",
  attest: true,
};
async function rejectVerify(label, overrides = {}) {
  const rpc = mockRpc(async () => ({}));
  await expectFailure(
    () => workspace.verifyQcProtocolMapping({ ...verifyBase, callRpc: rpc.callRpc, ...overrides }),
    ERROR_KINDS.CONTRACT_INCOMPLETE,
  );
  assert(rpc.calls.length === 0, `${label} makes no RPC call`);
}
await rejectVerify("a non-draft mapping status", { expectedStatus: "VERIFIED" });
await rejectVerify("a bad mapping id", { mappingId: 0 });
await rejectVerify("a bad portal option id", { expectedPortalOptionId: 0 });
await rejectVerify("a short mapping reason", { mappingReason: "too short" });
await rejectVerify("a missing mapping attest", { attest: false });

const verifyRpc = mockRpc(async () => ({
  mapping_id: 32,
  mapping_status: "VERIFIED",
  term_code: "OTHER",
  portal_external_id: "493",
  portal_label: "Others",
  verified_by: "editor",
}));
const verified = await workspace.verifyQcProtocolMapping({ ...verifyBase, callRpc: verifyRpc.callRpc });
assert(verifyRpc.calls.length === 1 && verifyRpc.calls[0].name === "rpc_eaushadhi_qc_protocol_mapping_verify_v1", "mapping verify uses the verify RPC");
assert(
  Object.keys(verifyRpc.calls[0].args).join(",") === "p_mapping_id,p_expected_status,p_expected_portal_option_id,p_mapping_reason,p_attest",
  "mapping verify argument names and order are exact",
);
assert(verifyRpc.calls[0].args.p_expected_status === "DRAFT" && verifyRpc.calls[0].args.p_expected_portal_option_id === 493, "mapping verify sends DRAFT and the displayed option");
assert(verified.mutated === true && verified.mapping_status === "VERIFIED", "mapping verify returns VERIFIED");

const preflightRpc = mockRpc(async () => ({ blockers: [], readiness: { status: "NOT_READY" }, protocol_mapping: null, fill_fields: {}, context: {}, runs: [] }));
const preflight = await workspace.readQcFillPreflight({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  callRpc: preflightRpc.callRpc,
});
assert(preflightRpc.calls.length === 1 && preflightRpc.calls[0].name === "rpc_eaushadhi_qc_prep_run_preflight_v1", "preflight uses the preflight RPC");
assert(Object.keys(preflightRpc.calls[0].args).join(",") === "p_product_id,p_preparation_id", "preflight argument names and order are exact");
assert(preflight.mutated === false, "preflight is read-only");
const badPreflight = mockRpc(async () => ({}));
await expectFailure(
  () => workspace.readQcFillPreflight({ productId: 262, accessToken: TOKEN, preparationId: "nope", callRpc: badPreflight.callRpc }),
  ERROR_KINDS.CONTRACT_INCOMPLETE,
);
assert(badPreflight.calls.length === 0, "an invalid preflight id makes no RPC call");

const derivedAccept = mockRpc(async () => ({ acceptance_id: 3, binding_id: 3, fact_key: "study_start_date", self_accepted: false }));
await workspace.acceptQcFact({
  productId: 262,
  accessToken: TOKEN,
  preparationId: PREP_ID,
  expectedRowVersion: 7,
  factKey: "study_start_date",
  basisCategory: "OPERATOR_DERIVATION",
  basisNote: "Derived by the operator from the earliest batch date.",
  attest: true,
  callRpc: derivedAccept.callRpc,
});
assert(derivedAccept.calls.length === 1 && derivedAccept.calls[0].args.p_basis_category === "OPERATOR_DERIVATION", "acceptQcFact accepts OPERATOR_DERIVATION");

const errorRows = [
  ["ACCEPTANCE_ALREADY_SUPERSEDED", ERROR_KINDS.STALE, "Someone already corrected this acceptance. Reload and try again."],
  ["ACCEPTANCE_NOT_ON_CURRENT_BINDING", ERROR_KINDS.CONTRACT_INCOMPLETE, "This acceptance belongs to older evidence."],
  ["MAPPING_STATE_CHANGED", ERROR_KINDS.STALE, "The mapping changed. Reload and try again."],
  ["TERM_ALREADY_HAS_VERIFIED_MAPPING", ERROR_KINDS.CONTRACT_INCOMPLETE, "This protocol already has a verified mapping."],
  ["CORRECTION_REASON_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a correction reason of at least 10 characters."],
  ["MAPPING_REASON_REQUIRED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Write a mapping reason of at least 10 characters."],
  ["ONLY_DRAFT_CAN_BE_VERIFIED", ERROR_KINDS.CONTRACT_INCOMPLETE, "Only a draft mapping can be verified."],
  ["MAPPING_OPTION_CHANGED", ERROR_KINDS.STALE, "The portal option changed. Reload and try again."],
  ["MAPPING_NOT_FOUND", ERROR_KINDS.CONTRACT_INCOMPLETE, "The mapping was not found."],
  ["ACCEPTANCE_NOT_FOUND", ERROR_KINDS.CONTRACT_INCOMPLETE, "That acceptance was not found."],
  ["QC draft missing", ERROR_KINDS.CONTRACT_INCOMPLETE, "The QC draft is missing."],
];
for (const [token, kind, plain] of errorRows) {
  const mapped = workspace.mapQcGovernanceError({ message: token, code: "23514" }, "Fact correction failed.");
  assert(mapped.kind === kind && mapped.message === plain, `${token} maps to the plain sentence`);
}
const missingPreflight = workspace.mapQcFillPreflightError({ code: "PGRST202", message: "missing" });
assert(missingPreflight.message === "Not available on the server yet.", "a missing preflight RPC says it is not available yet");

assert(ipcSrc.includes("eaushadhi-worker:qc-fact-correct") && preloadSrc.includes("eaushadhi-worker:qc-fact-correct") && clientSrc.includes("correctQcFactAcceptance"), "fact correction is exposed on IPC, preload, and the client");
assert(ipcSrc.includes("eaushadhi-worker:qc-protocol-mapping-verify") && preloadSrc.includes("eaushadhi-worker:qc-protocol-mapping-verify") && clientSrc.includes("verifyQcProtocolMapping"), "mapping verify is exposed on IPC, preload, and the client");
assert(ipcSrc.includes("eaushadhi-worker:qc-fill-preflight") && preloadSrc.includes("eaushadhi-worker:qc-fill-preflight") && clientSrc.includes("readQcFillPreflight"), "fill preflight is exposed on IPC, preload, and the client");

const STUDY_NOTE = "Study start date 01-10-2021 derived by the operator as the earliest batch manufacturing date among batches 3369, 4896, 2434, 3250, 3738, 4601, 5201 stated on the NUPAL certificate of analysis / QC test report (EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf). The report does not state a study start date.";
const PROTOCOL_NOTE = 'Testing protocol "Others: Cross Sectional Approach (API Vol VIII Page No:226)" was chosen by the operator. It is not stated on the NUPAL report.';
const PRODUCT_FORM = {
  study_start_date: "2021-10-01",
  batches: "3369,4896,2434,3250,3738,4601,5201",
  source_report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
  report_filename: "EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf",
  testing_protocol_term_id: "14",
  other_testing_protocol_text: "Cross Sectional Approach (API Vol VIII Page No:226)",
};
const fieldsStart = controlSrc.indexOf("const QC_SOURCE_FACT_FIELDS = [");
const fieldsSrc = controlSrc.slice(fieldsStart, controlSrc.indexOf("];", fieldsStart) + 2);
const optionsStart = controlSrc.indexOf("const QC_BASIS_CATEGORY_OPTIONS = [");
const optionsSrc = controlSrc.slice(optionsStart, controlSrc.indexOf("];", optionsStart) + 2);
const ui = new Function(
  `${fieldsSrc}
   ${optionsSrc}
   const state = {
     selectedProductId: 262,
     qcPrepServer: { preparation_id: ${JSON.stringify(PREP_ID)} },
     qcPrepForm: ${JSON.stringify(PRODUCT_FORM)},
     qcPrepOptions: [{ term_id: 14, code: "OTHER", label: "Others" }],
     qcFactAcceptScope: "",
     qcFactAcceptDrafts: null,
     qcFactCorrectScope: "",
     qcFactCorrectDrafts: null,
     qcFactCorrectOpen: "",
     qcFactCorrectNotice: "",
     qcGovernanceRunning: false,
     qcGovernanceConfirmOpen: false,
     qcSourceConfirmOpen: false,
     qcSourceVerifyRunning: false,
     qcReopenRunning: false,
     qcReadiness: null,
     qcMappingScope: "",
     qcMappingReason: "",
     qcMappingAttest: false,
     qcMappingSeeded: false,
     qcMappingNotice: "",
     qcFillPreflight: null,
     qcFillLoading: false,
     qcFillNotice: "",
   };
   const access = { userId: "dff17104-1111-1111-1111-111111111111", canView: true, canEdit: true };
   const openQcConfirm = { showing: false };
   function qcPrepForm() { return state.qcPrepForm; }
   function canWrite() { return access.canEdit === true; }
   function workerApiAvailable() { return false; }
   function qcHtmlEscape(value) {
     return String(value ?? "")
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;");
   }
   ${extractFunction(controlSrc, "qcIssuerShortName")}
   ${extractFunction(controlSrc, "qcPrepFmtDate")}
   ${extractFunction(controlSrc, "qcActorLabel")}
   ${extractFunction(controlSrc, "qcIstStamp")}
   ${extractFunction(controlSrc, "qcReadinessFactLabel")}
   ${extractFunction(controlSrc, "qcGovernanceBlocked")}
   ${extractFunction(controlSrc, "qcFactBatchList")}
   ${extractFunction(controlSrc, "qcFactDisplayDate")}
   ${extractFunction(controlSrc, "qcFactBasisSuggestion")}
   ${extractFunction(controlSrc, "qcBasisCategoryLabel")}
   ${extractFunction(controlSrc, "qcFactAcceptDraft")}
   ${extractFunction(controlSrc, "qcFactAcceptReady")}
   ${extractFunction(controlSrc, "qcFactAcceptCardHtml")}
   ${extractFunction(controlSrc, "qcFactCorrectDraft")}
   ${extractFunction(controlSrc, "qcFactCorrectReady")}
   ${extractFunction(controlSrc, "qcFactCorrectCardHtml")}
   ${extractFunction(controlSrc, "qcEnsureMappingDraft")}
   ${extractFunction(controlSrc, "qcProtocolMappingCardHtml")}
   ${extractFunction(controlSrc, "qcFillBlockerText")}
   ${extractFunction(controlSrc, "qcSeedFillAcks")}
   ${extractFunction(controlSrc, "qcFillArmBlockReason")}
   ${extractFunction(controlSrc, "qcFillArmReady")}
   ${extractFunction(controlSrc, "qcFillPreflightCardHtml")}
   const QC_FILL_PROVISIONAL_PREFILL = ${JSON.stringify("I acknowledge HARIDEV FORMULATIONS is an internal provisional portal laboratory selection; NUPAL is the report issuer; legal identity and portal eligibility are not verified.")};
   const QC_FILL_SAVE_BLOCKED = ${JSON.stringify("The portal control that runs Save is labelled Submit. Save was not pressed.")};
   const QC_FILL_QUALIFICATION = ${JSON.stringify("Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified.")};
   const QC_FILL_BLOCKER_TEXT = ${JSON.stringify({
     READINESS_NOT_READY: "Readiness is not Ready (provisional) yet",
     PRODUCT_DETAILS_NOT_PORTAL_VERIFIED: "Product details are not verified on the portal",
     COMPOSITION_NOT_PORTAL_VERIFIED: "Composition is not verified on the portal",
     PROTOCOL_MAPPING_NOT_VERIFIED: "The 'Others' protocol mapping is not verified yet",
     STUDY_START_NOT_FLAGGED_DERIVED: "Study start date must be accepted as 'Operator derivation' (correct the acceptance)",
     OTHER_PROTOCOL_TEXT_MISSING: "Others protocol text is missing",
   })};
   const QC_FILL_FIELD_ROWS = ${JSON.stringify([
     ["typeOfStudy", "Type of study"],
     ["startDate", "Start date"],
     ["endDate", "End date"],
     ["reportDate", "Report date"],
     ["batchNo", "Batch numbers"],
     ["duration", "Duration (months)"],
     ["labName", "Laboratory (portal id)"],
     ["qualityCntrl", "Quality control"],
   ])};
   return { state, access, qcFactBasisSuggestion, qcFactAcceptCardHtml, qcFactCorrectCardHtml, qcProtocolMappingCardHtml, qcFillBlockerText, qcFillPreflightCardHtml };
  `,
)();

const startSuggestion = ui.qcFactBasisSuggestion("study_start_date", PRODUCT_FORM);
const protocolSuggestion = ui.qcFactBasisSuggestion("testing_protocol", PRODUCT_FORM);
assert(startSuggestion.category === "OPERATOR_DERIVATION" && startSuggestion.note === STUDY_NOTE, "study start suggestion matches the Product 262 note");
assert(protocolSuggestion.category === "OPERATOR_DETERMINATION" && protocolSuggestion.note === PROTOCOL_NOTE, "protocol suggestion matches the Product 262 note");
assert(ui.qcFactBasisSuggestion("batches", PRODUCT_FORM).note === "" && ui.qcFactBasisSuggestion("batches", PRODUCT_FORM).category === "", "another fact has no suggestion");

ui.state.qcReadiness = {
  preparation_row_version: 7,
  verified_by: "someone-else",
  operator_asserted_facts: [{ fact: "study_start_date", accepted: false, note: "old" }],
};
const acceptHtml = ui.qcFactAcceptCardHtml();
assert(acceptHtml.includes("Operator derivation") && acceptHtml.includes(STUDY_NOTE), "the acceptance card prefills from the helper");
ui.state.qcFactAcceptDrafts.study_start_date.note = "Operator edited this basis note and it must stay.";
ui.state.qcFactAcceptDrafts.study_start_date.category = "REGULATORY_GUIDANCE";
ui.state.qcFactAcceptDrafts.study_start_date.touched = true;
const acceptAgain = ui.qcFactAcceptCardHtml();
assert(acceptAgain.includes("Operator edited this basis note and it must stay.") && !acceptAgain.includes(STUDY_NOTE), "an operator edit on the acceptance card is kept");

ui.state.qcReadiness.operator_asserted_facts = [{
  fact: "study_start_date",
  accepted: true,
  acceptance_id: 1,
  basis_category: "LABORATORY_CORRESPONDENCE",
  basis_note: "Collected from the COA provided by the laboratory.",
  accepted_by: "b8fd6239-2222-2222-2222-222222222222",
  accepted_at: "2026-10-12T04:30:00Z",
  chain_length: 1,
}];
ui.state.qcFactCorrectOpen = "study_start_date";
const correctHtml = ui.qcFactCorrectCardHtml();
assert(correctHtml.includes(STUDY_NOTE) && correctHtml.includes("Original kept; history is append-only."), "the correction card prefills from the helper and keeps history");
assert(ui.state.qcFactCorrectDrafts.study_start_date.reason === 'Earlier basis "Laboratory correspondence: Collected from the COA provided by the laboratory." was inaccurate. Corrected to state the actual basis.', "the correction reason is prefilled from the old basis");
ui.state.qcFactCorrectDrafts.study_start_date.note = "Operator edited the correction note and it must stay.";
ui.state.qcFactCorrectDrafts.study_start_date.touched = true;
const correctAgain = ui.qcFactCorrectCardHtml();
assert(correctAgain.includes("Operator edited the correction note and it must stay.") && !correctAgain.includes(STUDY_NOTE), "an operator edit on the correction card is kept");

ui.access.userId = "dff17104-1111-1111-1111-111111111111";
ui.state.qcReadiness.verified_by = ui.access.userId;
const selfHtml = ui.qcFactCorrectCardHtml();
assert(selfHtml.includes("You verified this evidence. Your correction will be recorded but will not count. A different editor must correct or accept."), "a self-correction shows the distinct-editor warning");

const correctSubmit = extractFunction(controlSrc, "submitQcFactCorrect");
assert(correctSubmit.includes("supersedesAcceptanceId: item.acceptance_id"), "correction sends the head acceptance id");
assert(correctSubmit.includes("correctionReason: reason") && correctSubmit.includes("attest: true"), "correction sends the reason and the tick");
assert(correctSubmit.indexOf("if (accepted !== true) return;") < correctSubmit.indexOf("correctQcFactAcceptance("), "correction calls the worker only after confirm");
assert(extractFunction(controlSrc, "qcFactCorrectReady").includes("reason.length >= 10"), "correction requires a reason of at least 10 characters");
assert((controlSrc.match(/correctQcFactAcceptance\(/g) || []).length === 1, "correction is called from one place");

ui.state.qcFillPreflight = { protocol_mapping: { mapping_id: 32, mapping_status: "DRAFT", portal_option_id: 493, term_id: 14, term_code: "OTHER" } };
const draftMap = ui.qcProtocolMappingCardHtml();
assert(draftMap.includes("portal option 493") && draftMap.includes("Others (portal option 493) confirmed by the operator against the live addQCRegister Type of Study list."), "the draft mapping card shows the option and the prefilled reason");
ui.state.qcFillPreflight.protocol_mapping.mapping_status = "VERIFIED";
const verifiedMap = ui.qcProtocolMappingCardHtml();
assert(verifiedMap.includes("Others mapping verified") && !verifiedMap.includes("btnQcMappingVerify"), "a verified mapping is read-only");
ui.state.qcFillPreflight.protocol_mapping = null;
assert(ui.qcProtocolMappingCardHtml() === "", "the mapping card is hidden when there is no draft or verified mapping");
const mappingSubmit = extractFunction(controlSrc, "submitQcProtocolMapping");
assert(mappingSubmit.includes('expectedStatus: "DRAFT"') && mappingSubmit.includes("expectedPortalOptionId: optionId"), "mapping verify sends DRAFT and the displayed option id");
assert(mappingSubmit.indexOf("if (accepted !== true) return;") < mappingSubmit.indexOf("verifyQcProtocolMapping("), "mapping verify calls the worker only after confirm");
assert(mappingSubmit.includes('String(mapping?.mapping_status || "") !== "DRAFT"'), "mapping verify runs only for a draft");

const blockerCodes = [
  ["PROTOCOL_MAPPING_NOT_VERIFIED", "The 'Others' protocol mapping is not verified yet"],
  ["STUDY_START_NOT_FLAGGED_DERIVED", "Study start date must be accepted as 'Operator derivation' (correct the acceptance)"],
  ["READINESS_NOT_READY", "Readiness is not Ready (provisional) yet"],
  ["COMPOSITION_NOT_PORTAL_VERIFIED", "Composition is not verified on the portal"],
  ["PRODUCT_DETAILS_NOT_PORTAL_VERIFIED", "Product details are not verified on the portal"],
  ["OTHER_PROTOCOL_TEXT_MISSING", "Others protocol text is missing"],
  ["PROTOCOL_TERM_MISSING", "PROTOCOL_TERM_MISSING"],
  ["PROTOCOL_TERM_INVALID", "PROTOCOL_TERM_INVALID"],
  ["PROTOCOL_MAPPING_MISSING", "PROTOCOL_MAPPING_MISSING"],
  ["PROTOCOL_OPTION_INACTIVE", "PROTOCOL_OPTION_INACTIVE"],
  ["PREPARATION_MISSING", "PREPARATION_MISSING"],
  ["READINESS_CHANGED", "READINESS_CHANGED"],
];
for (const [code, plain] of blockerCodes) {
  assert(ui.qcFillBlockerText(code) === plain, `${code} uses the preflight wording`);
}
ui.state.qcFillPreflight = {
  blockers: [],
  fill_fields: { typeOfStudy: "Cross Sectional Approach (API Vol VIII Page No:226)" },
  context: {
    report_issuer: "New Udaya Pharmacy & Ayurvedic Laboratories (NUPAL)",
    laboratory_label: "HARIDEV FORMULATIONS",
    derived_facts: [{ fact: "study_start_date", acceptance_id: 1, basis_note: STUDY_NOTE }],
  },
  runs: [],
};
const preflightHtml = ui.qcFillPreflightCardHtml();
assert(preflightHtml.includes("No blockers") && preflightHtml.includes('style="color:#166534"'), "an empty blocker list is green");
assert(preflightHtml.includes("Portal laboratory is an internal provisional selection. It is not the report issuer, and legal laboratory identity and portal eligibility are not verified."), "the qualification statement is verbatim");
assert(preflightHtml.includes('id="qcFillDerivedAck" type="checkbox" disabled') && preflightHtml.includes('id="qcFillDerivedNote" disabled'), "derived acknowledgement stays disabled without the worker");
assert(preflightHtml.includes("Required when filling starts.") && preflightHtml.includes("Save only; Submit is not allowed."), "filling stays Save-only");

const forbidden = [
  "rpc_eaushadhi_qc_prep_run_arm_v1",
  "rpc_eaushadhi_qc_prep_run_pre_save_v1",
  "rpc_eaushadhi_qc_prep_run_record_save_v1",
  "rpc_eaushadhi_qc_prep_run_resolve_ambiguous_v1",
  "rpc_eaushadhi_qc_prep_run_verify_row_v1",
];
for (const name of forbidden) {
  assert(!controlSrc.includes(name) && !clientSrc.includes(name) && !preloadSrc.includes(name), `${name} is not called from the renderer`);
  assert(workerSrc.includes(name), `${name} stays on the worker`);
}
for (const name of ["loadQcFillPreflight", "queueQcFillPreflight", "renderQc", "loadQcReadiness"]) {
  const body = extractFunction(controlSrc, name);
  assert(!body.includes("correctQcFactAcceptance(") && !body.includes("verifyQcProtocolMapping("), `${name} does not write`);
}
assert(!controlSrc.includes("are the same laboratory") && !controlSrc.includes("is the same laboratory") && !workerSrc.includes("are the same laboratory"), "the client does not say the issuer and portal laboratory are the same");

if (failed) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("eaushadhi-qc-b5-d6-smoke passed");
