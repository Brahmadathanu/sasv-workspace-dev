/**
 * Focused smoke: EXACT_ONE ambiguous-save identity recovery (hid* parse + resume block).
 * Offline only — no live portal / Supabase mutation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const {
  evaluateDuplicateGuard,
  deriveExactOnePortalProductId,
  extractHidValuesFromEditHtml,
  normalizeLoadProductDataforLegacyResponse,
  DUPLICATE_OUTCOME,
} = require("../electron/eaushadhi-worker/portal-duplicate-guard.js");
const {
  planResumeAction,
  assessProductDetailsResumePreflight,
  assessExactOneIdentityRecoveryPreflight,
  RESUME_ACTION,
  PHASE,
} = require("../electron/eaushadhi-worker/product-details-executor.js");
const {
  EXPECTED_APPROVED_COPY_NAME,
} = require("../electron/eaushadhi-worker/product-details-field-map.js");
const {
  deriveAmbiguousSaveRecoverable,
  deriveAmbiguousSaveExactOneRecoverable,
  runTrustedAmbiguousSaveExactOneRecovery,
  assessRecoveryAttachmentEligibility,
  ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC,
  PORTAL_TEXT_GET_RPC,
  buildTrustedExecutorInput,
} = require("../electron/eaushadhi-worker/product-details-trusted.js");

const PROVEN_HID =
  "MTIzNDU2NzgxMjM0NTY3ODEyMzQ1Njc4MTIzNG8atnUB3i77xOliuhhG1VsNyCEv7W0";
const APPROVED_V01 = EXPECTED_APPROVED_COPY_NAME;
const REMARKS = "recovery-smoke-remarks";
const SHELF = "RegularAsPerClause";

function editHtml(hidValue, hidId = "hid1") {
  return `<button class="edit_productdata">Edit</button><input type="hidden" id="${hidId}" value="${hidValue}" />`;
}

function blankCoverage(rows) {
  return {
    source: "LoadProductDataforLegacy",
    mechanism: "datatable_list_post",
    transportSearch: "",
    transportSearchBlank: true,
    targetName: "Karpooradi Thailam",
    localExactEvaluation: true,
    totalCount: rows.length,
    rows,
    coverageComplete: true,
  };
}

const readyPage = {
  workerState: "READY",
  origin: "https://www.e-aushadhi.gov.in",
  path: "/admin/addproductforlegacy",
  actiontype: "add",
  hiddenId: "",
  staleEditState: false,
  saveDataAvailable: true,
};

function recoveryContent() {
  return {
    content_hash: "hash1",
    entry_status: "IN_PROGRESS",
    versions: { workflow_row_version: 3 },
    product: {
      portal_product_name: "Karpooradi Thailam",
      canonical_product_name: "Karpooradi Thailam",
      review_status: "VERIFIED",
    },
    classification: {
      review_status: "VERIFIED",
      is_verified: true,
      product_type: { portal_option_value: "1", label: "Ayurveda" },
      product_category: { portal_option_value: "10", label: "Thailam" },
      product_subtype: { portal_option_value: "31", label: "-" },
    },
    details: {
      permission_purpose_label: "Regular",
      composition_title: "For 10 mL",
      diseases_conditions: "Sandhirujah, Śōpham",
      combined_restricted_declaration: "NO",
      portal_remarks: REMARKS,
      portal_shelfmonth_route: SHELF,
    },
    actions: [{ portal_option_value: "99", label: "Musculoskeletal System (Bones &Joints)" }],
    evidence: {
      approved_product_copy_present: true,
      original_file_name: APPROVED_V01,
    },
  };
}

function saveEvidenceFields(overrides = {}) {
  return {
    last_save_evidence_outcome: "AMBIGUOUS",
    last_save_invoked: true,
    last_save_invoke_count: 1,
    last_save_settled: true,
    last_save_business_success: true,
    last_save_phase: PHASE.SAVE_CONFIRMED,
    ...overrides,
  };
}

function buildAuthority(overrides = {}) {
  const content = recoveryContent();
  const activeRun = {
    run_id: "run-1",
    run_status: "RUNNING",
    last_save_outcome: "AMBIGUOUS",
    last_save_observed_at: "2026-09-20T00:00:00Z",
    portal_product_ref: null,
    start_content_hash: "hash1",
    ...saveEvidenceFields(),
  };
  return {
    ok: true,
    code: "AUTHORITY_COLLECTED",
    productId: 262,
    preflightObtained: true,
    content,
    contentHash: "hash1",
    workflowRowVersion: 3,
    reviewStatus: "VERIFIED",
    classificationVerified: true,
    isReadyForEntry: false,
    entryStatus: "IN_PROGRESS",
    pageState: readyPage,
    duplicateSearch: blankCoverage([
      { name: "Karpooradi Thailam", edit: editHtml(PROVEN_HID) },
    ]),
    permissionOptions: [{ value: "7", label: "Regular" }],
    approvedFileName: APPROVED_V01,
    approvedResolved: true,
    approvedLocalPath: `C:\\tmp\\${APPROVED_V01}`,
    activeRunCount: 1,
    activeRun,
    contentHashMatchesRunStart: true,
    workflowPortalRef: null,
    resumeSourceReady: true,
    compositionReviewComplete: true,
    classificationReviewComplete: true,
    dossierReady: true,
    openBlockers: 0,
    openPortalIssues: 0,
    ...overrides,
    activeRun: { ...activeRun, ...(overrides.activeRun || {}) },
  };
}

function matchingReread(portalProductId) {
  return {
    ok: true,
    source: "GetproductDataUpdate",
    requestedId: portalProductId,
    loadedHiddenId: portalProductId,
    hiddenId: portalProductId,
    idMatch: true,
    name: "Karpooradi Thailam",
    type: "1",
    categoryId: "10",
    subTypeId: "31",
    permissionPurpose: { label: "Regular", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    drugsValue: null,
    remarks: REMARKS,
    shelfmonth: SHELF,
    attachmentFileName: null,
    attachmentRereadUnavailable: true,
  };
}

function trustedUnavailableReread(portalProductId, evidenceOverrides = {}) {
  return {
    ...matchingReread(portalProductId),
    shelfmonth: null,
    shelfmonthRereadUnavailable: true,
    shelfmonthEvidence: {
      source: "GetproductDataUpdate_response",
      responseValue: null,
      domCheckedValue: null,
      responseMonth: -1,
      domMonth: "-1",
      ...evidenceOverrides,
    },
  };
}

function shelfmonthUnprovenError(evidence = {}) {
  const error = new Error("SHELFMONTH_REREAD_UNPROVEN");
  error.code = "SHELFMONTH_REREAD_UNPROVEN";
  error.shelfmonthEvidence = evidence;
  return error;
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    failed += 1;
    console.log("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

// --- hid parser ---
{
  const good = extractHidValuesFromEditHtml(editHtml(PROVEN_HID));
  ok(good.ok === true && good.portalProductId === PROVEN_HID, "parses single hid* value");

  const noTopLevelNeeded = deriveExactOnePortalProductId({
    name: "Karpooradi Thailam",
    edit: editHtml(PROVEN_HID),
  });
  ok(
    noTopLevelNeeded.ok === true && noTopLevelNeeded.portalProductId === PROVEN_HID,
    "no top-level id required",
  );

  ok(extractHidValuesFromEditHtml("").ok === false, "blank edit blocked");
  ok(extractHidValuesFromEditHtml("<div>no hid</div>").ok === false, "missing hid blocked");
  ok(
    extractHidValuesFromEditHtml(editHtml("a", "hid1") + editHtml("b", "hid2")).ok === false,
    "multiple hid blocked",
  );
  for (const bad of ["0", "-1", "262", ""]) {
    ok(
      extractHidValuesFromEditHtml(editHtml(bad)).ok === false,
      `forbidden/blank hid ${JSON.stringify(bad)} blocked`,
    );
  }
}

// --- normalize preserves edit; EXACT_ONE exposes portalProductId from hid ---
{
  const normalized = normalizeLoadProductDataforLegacyResponse({
    status: 1,
    TotalCount: 1,
    aaData: [{ name: "Karpooradi Thailam", edit: editHtml(PROVEN_HID) }],
  });
  ok(typeof normalized.rows[0].edit === "string", "normalize preserves edit HTML");
  const guard = evaluateDuplicateGuard({
    ...normalized,
    transportSearchBlank: true,
    localExactEvaluation: true,
    coverageComplete: true,
  });
  ok(guard.outcome === DUPLICATE_OUTCOME.EXACT_ONE, "EXACT_ONE only");
  ok(guard.portalProductId === PROVEN_HID, "guard exposes hid portalProductId");
  ok(guard.matches[0].portalProductId === PROVEN_HID, "match carries portalProductId");
}

// --- fresh coverage required ---
{
  const incomplete = evaluateDuplicateGuard({
    source: "LoadProductDataforLegacy",
    transportSearch: "",
    transportSearchBlank: true,
    targetName: "Karpooradi Thailam",
    localExactEvaluation: true,
    totalCount: 5,
    rows: [{ name: "Karpooradi Thailam", edit: editHtml(PROVEN_HID) }],
    coverageComplete: false,
  });
  ok(
    incomplete.outcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
    "fresh coverage required",
  );
}

// --- Resume safety for AMBIGUOUS + EXACT_ONE ---
{
  const plan = planResumeAction({
    entryStatus: "IN_PROGRESS",
    activeRunCount: 1,
    activeRun: {
      run_status: "RUNNING",
      last_save_outcome: "AMBIGUOUS",
    },
    duplicateOutcome: DUPLICATE_OUTCOME.EXACT_ONE,
  });
  ok(
    plan.code === "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY",
    "ordinary Resume blocked for AMBIGUOUS+EXACT_ONE",
  );
  ok(
    plan.action ===
      RESUME_ACTION.STOP_AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY,
    "resume action is dedicated stop",
  );
  ok(plan.resumeEnabled !== true, "resume not enabled");
  ok(plan.continueCreateOnSameRun !== true, "no continue-create");
}

// --- NONE path unchanged ---
{
  const nonePlan = planResumeAction({
    entryStatus: "IN_PROGRESS",
    activeRunCount: 1,
    activeRun: { run_status: "RUNNING", last_save_outcome: "AMBIGUOUS" },
    duplicateOutcome: DUPLICATE_OUTCOME.NONE,
  });
  ok(
    nonePlan.action === RESUME_ACTION.CONTINUE_EXISTING_RUN ||
      nonePlan.code === "RESUME_CONTINUE_EXISTING_RUN",
    "NONE path still continue-existing when AMBIGUOUS save + NONE duplicate",
  );

  const noneGuard = evaluateDuplicateGuard(
    blankCoverage([{ name: "Other Product", edit: editHtml("999") }]),
  );
  ok(noneGuard.outcome === DUPLICATE_OUTCOME.NONE, "NONE path unchanged for non-match");
}

// --- eligibility flags ---
{
  const baseAuth = {
    preflightObtained: true,
    activeRunCount: 1,
    entryStatus: "IN_PROGRESS",
    workflowPortalRef: null,
    activeRun: {
      run_status: "RUNNING",
      last_save_outcome: "AMBIGUOUS",
      portal_product_ref: null,
    },
    duplicateSearch: blankCoverage([
      { name: "Karpooradi Thailam", edit: editHtml(PROVEN_HID) },
    ]),
  };
  ok(deriveAmbiguousSaveRecoverable(baseAuth) === true, "ambiguousSaveRecoverable true");
  ok(
    deriveAmbiguousSaveExactOneRecoverable(baseAuth) === true,
    "exact-one recoverable when hid proven",
  );
  ok(
    deriveAmbiguousSaveExactOneRecoverable({
      ...baseAuth,
      duplicateSearch: blankCoverage([{ name: "Other", edit: editHtml(PROVEN_HID) }]),
    }) === false,
    "exact-one recoverable false for NONE",
  );
}

// --- recovery preflight proceeds despite ordinary Resume blocked ---
{
  const authority = buildAuthority();
  const executorInput = buildTrustedExecutorInput(authority, {
    userConfirmed: true,
    resume: false,
  });
  const resumeBlocked = assessProductDetailsResumePreflight({
    ...executorInput,
    resume: true,
  });
  ok(resumeBlocked.ok === false, "ordinary Resume preflight remains blocked");
  ok(
    resumeBlocked.resumePlan?.code ===
      "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY" ||
      resumeBlocked.code === "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY" ||
      resumeBlocked.resumePlan?.resumeEnabled !== true,
    "ordinary Resume block code/plan preserved",
  );

  const recoveryPf = assessExactOneIdentityRecoveryPreflight(executorInput);
  ok(recoveryPf.ok === true, "recovery preflight proceeds despite Resume blocked");
  ok(recoveryPf.code === "RECOVERY_PREFLIGHT_PASS", "recovery preflight pass code");
  ok(recoveryPf.fieldGate?.ok === true, "recovery fieldGate produced");
  ok(recoveryPf.pageGuard?.ok === true, "recovery pageGuard produced");
  ok(Boolean(recoveryPf.fillPlan), "recovery fillPlan produced");
  ok(
    recoveryPf.ordinaryResumeBlocked === true &&
      recoveryPf.ordinaryResumeBlockCode ===
        "AMBIGUOUS_SAVE_EXACT_ONE_REQUIRES_IDENTITY_RECOVERY",
    "recovery documents ordinary Resume remains blocked",
  );
  ok(recoveryPf.resumePlan?.resumeEnabled !== true, "recovery does not enable resume");

  const missingHashProof = assessExactOneIdentityRecoveryPreflight({
    ...executorInput,
    contentHashMatchesRunStart: null,
  });
  ok(
    missingHashProof.ok === false && missingHashProof.code === "CONTENT_HASH_DRIFT",
    "recovery requires affirmative active-run content hash proof",
  );
}

// --- attachment evidence: V01 + server save proof ---
{
  const good = assessRecoveryAttachmentEligibility(buildAuthority());
  ok(good.ok === true, "attachment eligible when V01 + save evidence proven");

  const noV01 = assessRecoveryAttachmentEligibility(
    buildAuthority({ approvedResolved: false, approvedLocalPath: null }),
  );
  ok(
    noV01.ok === false && noV01.code === "ATTACHMENT_EVIDENCE_UNPROVEN",
    "missing V01 => ATTACHMENT_EVIDENCE_UNPROVEN",
  );

  const noSave = assessRecoveryAttachmentEligibility(
    buildAuthority({
      activeRun: {
        ...saveEvidenceFields({ last_save_invoked: false }),
      },
    }),
  );
  ok(
    noSave.ok === false && noSave.code === "ATTACHMENT_EVIDENCE_UNPROVEN",
    "false save invoked => ATTACHMENT_EVIDENCE_UNPROVEN",
  );

  const missingPhase = assessRecoveryAttachmentEligibility(
    buildAuthority({
      activeRun: { ...saveEvidenceFields({ last_save_phase: null }) },
    }),
  );
  ok(
    missingPhase.ok === false && missingPhase.code === "ATTACHMENT_EVIDENCE_UNPROVEN",
    "missing save phase => ATTACHMENT_EVIDENCE_UNPROVEN",
  );

  const badCount = assessRecoveryAttachmentEligibility(
    buildAuthority({
      activeRun: { ...saveEvidenceFields({ last_save_invoke_count: 2 }) },
    }),
  );
  ok(
    badCount.ok === false && badCount.code === "ATTACHMENT_EVIDENCE_UNPROVEN",
    "invokeCount!=1 => ATTACHMENT_EVIDENCE_UNPROVEN",
  );
}

// --- full recovery path: EXACT_ONE -> reread -> compare -> adopt -> reread -> mark verified ---
{
  const calls = [];
  const authority = buildAuthority();
  const rereadCalls = [];
  const adapterCalls = [];

  const result = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => authority,
      callRpc: async (name, args) => {
        calls.push({ name, args });
        if (name === PORTAL_TEXT_GET_RPC) {
          return {
            portal_review_status: "VERIFIED",
            selected_portal_text: "Sandhirujah, Śōpham",
          };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          return {
            run_id: "run-1",
            workflow_row_version: 4,
            portal_product_ref: PROVEN_HID,
            run_status: "ENTERED",
            entry_status: "ENTERED",
            content_hash: "hash1",
            last_save_outcome: "AMBIGUOUS",
          };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async ({ portalProductId }) => {
          rereadCalls.push(portalProductId);
          adapterCalls.push("reread");
          return matchingReread(portalProductId);
        },
        markPortalVerified: async (args) => {
          adapterCalls.push("markPortalVerified");
          calls.push({ name: "markPortalVerified", args });
          return { ok: true };
        },
        saveOnce: async () => {
          adapterCalls.push("saveOnce");
          throw new Error("SaveData must not be called");
        },
        fillForm: async () => {
          adapterCalls.push("fillForm");
          throw new Error("fill must not be called");
        },
        uploadApprovedCopy: async () => {
          adapterCalls.push("upload");
          throw new Error("upload must not be called");
        },
        runResume: async () => {
          adapterCalls.push("runResume");
          throw new Error("run_resume must not be called");
        },
        runBegin: async () => {
          adapterCalls.push("runBegin");
          throw new Error("run_begin must not be called");
        },
      }),
    },
    { userConfirmed: true },
  );

  ok(result.ok === true && result.code === "PORTAL_VERIFIED", "full recovery reaches PORTAL_VERIFIED");
  ok(result.adopted === true, "adoption occurred");
  ok(result.saved !== true && result.filled !== true && result.uploaded !== true, "no fill/save/upload");
  ok(result.runResumed !== true && result.runBegun !== true, "no run_resume/run_begin");
  ok(rereadCalls.length === 2, "reread before and after adoption");
  ok(
    adapterCalls.filter((c) => c === "reread").length === 2 &&
      adapterCalls.includes("markPortalVerified") &&
      !adapterCalls.includes("saveOnce") &&
      !adapterCalls.includes("fillForm") &&
      !adapterCalls.includes("upload") &&
      !adapterCalls.includes("runResume"),
    "no SaveData/run_resume/fill/upload in recovery",
  );
  ok(
    calls.some((c) => c.name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC),
    "adoption RPC invoked",
  );
  ok(result.workflowRowVersion === 4, "post-adopt workflow row version returned");
  ok(!Object.hasOwn(result, "compareResult"), "successful renderer result exposes no raw compare result");
  ok(
    !Object.hasOwn(result, "candidateId") &&
      !Object.hasOwn(result, "portalProductId") &&
      !Object.hasOwn(result, "runId"),
    "successful renderer result exposes no portal or run identifiers",
  );
  ok(
    !JSON.stringify(result).includes('"items"'),
    "successful renderer result contains no raw compare items",
  );
  const verifiedCall = calls.find((call) => call.name === "markPortalVerified");
  ok(
    verifiedCall?.args?.compareReport?.equal === true &&
      Array.isArray(verifiedCall?.args?.compareReport?.items) &&
      verifiedCall.args.compareReport.items.length > 0 &&
      verifiedCall.args.compareReport.items.every((item) => item.result === "MATCH"),
    "mark_portal_verified receives the full trusted MATCH report internally",
  );
}

// --- pre-adoption compare mismatch is bounded, diagnostic, and non-mutating ---
{
  const rpcCalls = [];
  const rereadArgs = [];
  let verifiedArgs = null;
  const special = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name, args) => {
        rpcCalls.push({ name, args });
        if (name === PORTAL_TEXT_GET_RPC) {
          return { portal_review_status: "VERIFIED", selected_portal_text: "Sandhirujah, ÅšÅpham" };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          return { run_id: "run-1", workflow_row_version: 4, content_hash: "hash1" };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async (args) => {
          rereadArgs.push(args);
          return trustedUnavailableReread(args.portalProductId);
        },
        markPortalVerified: async (args) => {
          verifiedArgs = args;
          return { ok: true };
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(special.ok === true && special.code === "PORTAL_VERIFIED", "valid trusted unavailable first and second rereads portal-verify");
  ok(
    rereadArgs.length === 2 && rereadArgs.every((args) => args.allowTrustedShelfmonthUnavailable === true),
    "both recovery rereads independently arm the trusted adapter-only mode",
  );
  const adoptCall = rpcCalls.find((call) => call.name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC);
  ok(
    adoptCall?.args?.p_recovery_evidence?.compare_equal === false &&
      adoptCall.args.p_recovery_evidence.compare_overall === "MATCH_WITH_TRUSTED_UNAVAILABLE" &&
      adoptCall.args.p_recovery_evidence.compare_verification_acceptable === true,
    "special adoption evidence is truthful and verification-acceptable",
  );
  ok(
    verifiedArgs?.compareReport?.equal === false &&
      verifiedArgs.compareReport.overall === "MATCH_WITH_TRUSTED_UNAVAILABLE" &&
      verifiedArgs.compareReport.items.some(
        (item) => item.result === "PORTAL_REREAD_UNAVAILABLE_TRUSTED",
      ),
    "mark_portal_verified receives the full special trusted report internally",
  );
}

for (const invalidAt of [1, 2]) {
  let rereadCount = 0;
  let adoptionCalls = 0;
  let markCalls = 0;
  const result = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return { portal_review_status: "VERIFIED", selected_portal_text: "Sandhirujah, ÅšÅpham" };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          adoptionCalls += 1;
          return { run_id: "run-1", workflow_row_version: 4, content_hash: "hash1" };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async ({ portalProductId }) => {
          rereadCount += 1;
          return trustedUnavailableReread(
            portalProductId,
            rereadCount === invalidAt ? { domCheckedValue: "RegularAsPerClause" } : {},
          );
        },
        markPortalVerified: async () => {
          markCalls += 1;
        },
      }),
    },
    { userConfirmed: true },
  );
  if (invalidAt === 1) {
    ok(
      result.code === "RECOVERY_COMPARE_MISMATCH" && adoptionCalls === 0 && markCalls === 0,
      "invalid first trusted-unavailable proof blocks adoption",
    );
  } else {
    ok(
      result.code === "RECOVERY_POST_ADOPT_COMPARE_MISMATCH" &&
        result.entryStatus === "ENTERED" && adoptionCalls === 1 && markCalls === 0,
      "invalid second trusted-unavailable proof remains ENTERED without portal verification",
    );
  }
}

// --- adoption-returned content hash must match before the second reread/transition ---
{
  let rereadCount = 0;
  let markCalls = 0;
  const blocked = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return { portal_review_status: "VERIFIED", selected_portal_text: "Sandhirujah, ÅšÅpham" };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          return { run_id: "run-1", workflow_row_version: 4, content_hash: "changed-hash" };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async ({ portalProductId }) => {
          rereadCount += 1;
          return matchingReread(portalProductId);
        },
        markPortalVerified: async () => {
          markCalls += 1;
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(blocked.code === "ADOPT_CONTENT_HASH_MISMATCH", "adoption-returned hash mismatch has a specific blocker");
  ok(
    blocked.entryStatus === "ENTERED" && blocked.adopted === true && rereadCount === 1 && markCalls === 0,
    "hash mismatch remains ENTERED and prevents second reread/mark_portal_verified",
  );
}

// --- pre-adoption compare mismatch is bounded, diagnostic, and non-mutating ---
{
  let adoptionCalls = 0;
  let markCalls = 0;
  const mismatch = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return {
            portal_review_status: "VERIFIED",
            selected_portal_text: "Sandhirujah, ÅšÅpham",
          };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          adoptionCalls += 1;
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async ({ portalProductId }) => ({
          ...matchingReread(portalProductId),
          indications: ["wrong-value"],
          indicationLabels: ["A harmless display label"],
        }),
        markPortalVerified: async () => {
          markCalls += 1;
          throw new Error("portal verification must not run after mismatch");
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(mismatch.ok === false && mismatch.code === "RECOVERY_COMPARE_MISMATCH", "compare mismatch blocks recovery");
  ok(adoptionCalls === 0 && markCalls === 0, "compare mismatch causes no adoption or portal verification mutation");
  ok(mismatch.adopted !== true && mismatch.mutated !== true, "compare mismatch reports no mutation");
  ok(!Object.hasOwn(mismatch, "compareResult"), "raw compare result is not exposed");
  ok(!Object.hasOwn(mismatch, "candidateId") && !Object.hasOwn(mismatch, "runId"), "candidate and run identifiers are not exposed on mismatch");
  ok(
    Array.isArray(mismatch.compareMismatches) &&
      mismatch.compareMismatches.some((item) => item.path === "indications") &&
      mismatch.compareMismatches.every(
        (item) =>
          JSON.stringify(Object.keys(item).sort()) ===
          JSON.stringify(["actual", "expected", "path", "result"]),
      ),
    "mismatch returns only bounded whitelisted diagnostic fields",
  );
}

// --- unproven response shelfmonth stops before adoption ---
{
  let adoptionCalls = 0;
  let markCalls = 0;
  const blocked = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return {
            portal_review_status: "VERIFIED",
            selected_portal_text: "Sandhirujah, ÅšÅpham",
          };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) adoptionCalls += 1;
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async () => {
          throw shelfmonthUnprovenError({
            source: "forged-source",
            responseValue: null,
            domCheckedValue: "RegularAsPerClause",
            responseMonth: -1,
            domMonth: "-1",
            rawResponse: { token: "must-not-escape" },
          });
        },
        markPortalVerified: async () => {
          markCalls += 1;
          throw new Error("markPortalVerified must not run");
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(blocked.code === "SHELFMONTH_REREAD_UNPROVEN", "unproven shelfmonth has a specific pre-adoption blocker");
  ok(adoptionCalls === 0 && markCalls === 0, "unproven first reread causes no adoption or portal verification");
  ok(blocked.mutated !== true && blocked.adopted !== true, "unproven first reread retains non-mutating flags");
  ok(
    JSON.stringify(Object.keys(blocked.shelfmonthEvidence).sort()) ===
      JSON.stringify(["domCheckedValue", "domMonth", "responseMonth", "responseValue", "source"]),
    "pre-adoption blocker exposes bounded shelfmonth evidence only",
  );
  ok(
    !Object.hasOwn(blocked, "candidateId") &&
      !Object.hasOwn(blocked, "runId") &&
      !Object.hasOwn(blocked, "requestedId") &&
      !Object.hasOwn(blocked, "loadedHiddenId") &&
      !JSON.stringify(blocked).includes("must-not-escape"),
    "new pre-adoption blocker exposes no ids or raw response content",
  );
}

// --- post-adoption compare mismatch is bounded and never portal-verified ---
{
  let rereadCount = 0;
  let adoptionCalls = 0;
  let markCalls = 0;
  const mismatch = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return {
            portal_review_status: "VERIFIED",
            selected_portal_text: "Sandhirujah, ÅšÅpham",
          };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          adoptionCalls += 1;
          return {
            run_id: "run-1",
            workflow_row_version: 4,
            portal_product_ref: PROVEN_HID,
            run_status: "ENTERED",
            entry_status: "ENTERED",
            content_hash: "hash1",
            last_save_outcome: "AMBIGUOUS",
          };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async ({ portalProductId }) => {
          rereadCount += 1;
          const retained = matchingReread(portalProductId);
          return rereadCount === 1
            ? retained
            : { ...retained, indications: ["post-adopt-wrong-value"] };
        },
        markPortalVerified: async () => {
          markCalls += 1;
          throw new Error("portal verification must not run after post-adopt mismatch");
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(
    mismatch.ok === false && mismatch.code === "RECOVERY_POST_ADOPT_COMPARE_MISMATCH",
    "post-adoption compare mismatch remains fail-closed",
  );
  ok(adoptionCalls === 1 && rereadCount === 2, "post-adoption mismatch occurs only after adoption and second reread");
  ok(markCalls === 0, "post-adoption mismatch never calls mark_portal_verified");
  ok(!Object.hasOwn(mismatch, "compareResult"), "post-adoption mismatch exposes no raw compare result");
  ok(
    Array.isArray(mismatch.compareMismatches) &&
      mismatch.compareMismatches.some((item) => item.path === "indications"),
    "post-adoption mismatch exposes bounded compareMismatches",
  );
}

// --- post-adoption unproven response shelfmonth remains ENTERED ---
{
  let rereadCount = 0;
  let adoptionCalls = 0;
  let markCalls = 0;
  const blocked = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => buildAuthority(),
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return {
            portal_review_status: "VERIFIED",
            selected_portal_text: "Sandhirujah, ÅšÅpham",
          };
        }
        if (name === ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC) {
          adoptionCalls += 1;
          return {
            run_id: "run-1",
            workflow_row_version: 4,
            portal_product_ref: PROVEN_HID,
            run_status: "ENTERED",
            entry_status: "ENTERED",
            content_hash: "hash1",
            last_save_outcome: "AMBIGUOUS",
          };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async ({ portalProductId }) => {
          rereadCount += 1;
          if (rereadCount === 1) return matchingReread(portalProductId);
          throw shelfmonthUnprovenError({
            responseValue: null,
            domCheckedValue: null,
            responseMonth: null,
            domMonth: "-1",
          });
        },
        markPortalVerified: async () => {
          markCalls += 1;
          throw new Error("markPortalVerified must not run");
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(
    blocked.code === "RECOVERY_POST_ADOPT_SHELFMONTH_REREAD_UNPROVEN",
    "post-adoption shelfmonth blocker is specific",
  );
  ok(adoptionCalls === 1 && rereadCount === 2, "post-adoption blocker follows adoption and second reread");
  ok(markCalls === 0, "post-adoption shelfmonth blocker does not portal-verify");
  ok(
    blocked.mutated === true && blocked.adopted === true && blocked.entryStatus === "ENTERED",
    "post-adoption shelfmonth blocker remains ENTERED with accurate mutation flags",
  );
  ok(
    !Object.hasOwn(blocked, "candidateId") &&
      !Object.hasOwn(blocked, "runId") &&
      JSON.stringify(Object.keys(blocked.shelfmonthEvidence).sort()) ===
        JSON.stringify(["domCheckedValue", "domMonth", "responseMonth", "responseValue", "source"]),
    "post-adoption blocker exposes bounded evidence without identifiers",
  );
}

// --- missing save evidence blocks recovery before adopt ---
{
  const authority = buildAuthority({
    activeRun: { ...saveEvidenceFields({ last_save_business_success: false }) },
  });
  const blocked = await runTrustedAmbiguousSaveExactOneRecovery(
    {
      liveArmed: true,
      collectAuthoritativeProductDetailsContext: async () => authority,
      callRpc: async (name) => {
        if (name === PORTAL_TEXT_GET_RPC) {
          return {
            portal_review_status: "VERIFIED",
            selected_portal_text: "Sandhirujah",
          };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      buildAdapters: async () => ({
        reread: async () => {
          throw new Error("reread must not run");
        },
        markPortalVerified: async () => {
          throw new Error("mark must not run");
        },
      }),
    },
    { userConfirmed: true },
  );
  ok(
    blocked.code === "ATTACHMENT_EVIDENCE_UNPROVEN",
    "recovery refuses when save evidence false",
  );
  ok(blocked.adopted !== true && blocked.mutated !== true, "no mutation without attachment proof");
}

// --- disarmed path ---
{
  const disarmed = await runTrustedAmbiguousSaveExactOneRecovery(
    { liveArmed: false, callRpc: async () => ({}) },
    { userConfirmed: true },
  );
  ok(disarmed.code === "LIVE_EXECUTION_NOT_ARMED", "disarmed recovery does not mutate");
  ok(disarmed.saved !== true && disarmed.runResumed !== true, "no Save/resume when disarmed");
}

ok(
  ADOPT_AMBIGUOUS_SAVE_IDENTITY_RPC ===
    "rpc_eaushadhi_worker_adopt_ambiguous_save_identity",
  "adoption RPC name",
);

// --- migration / source contracts ---
{
  const migration = fs.readFileSync(
    path.join(
      root,
      "supabase/migrations/20260920161931_eaushadhi_adopt_ambiguous_save_identity.sql",
    ),
    "utf8",
  );
  ok(migration.includes("ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY"), "audit event kind");
  ok(migration.includes("last_save_outcome is distinct from 'AMBIGUOUS'"), "RPC requires AMBIGUOUS");
  ok(migration.includes("duplicate_outcome"), "RPC checks duplicate_outcome");
  ok(migration.includes("reread_id_match"), "RPC checks reread_id_match");
  ok(
    migration.includes("-- Does not weaken rpc_eaushadhi_worker_mark_entered"),
    "migration documents mark_entered not weakened",
  );
  ok(
    !/create or replace function[^\n]*mark_entered/i.test(migration),
    "does not redefine mark_entered",
  );
  ok(
    /v_payload\s*:=\s*public\.rpc_eaushadhi_worker_content_get\s*\(/.test(migration),
    "adoption RPC calls worker_content_get",
  );
  ok(
    /v_current_hash\s*:=\s*v_payload->>'content_hash'/.test(migration),
    "current hash from content_get payload",
  );
  ok(
    !/v_current_hash\s*:=\s*v_run\.start_content_hash/.test(migration),
    "does not assign current hash from start hash",
  );
  ok(
    /current_workflow_row_version\s*=\s*v_workflow\.row_version\s*\+\s*1/.test(migration),
    "run current_workflow_row_version increments",
  );
  ok(
    /entered_by\s*=\s*v_actor/.test(migration) && /updated_by\s*=\s*v_actor/.test(migration),
    "actor entered/updated fields are set",
  );
  ok(
    /'last_save_evidence_outcome'/.test(migration) &&
      /'last_save_invoked'/.test(migration) &&
      /'last_save_invoke_count'/.test(migration) &&
      /'last_save_settled'/.test(migration) &&
      /'last_save_business_success'/.test(migration) &&
      /'last_save_phase'/.test(migration),
    "preflight exposes bounded save-evidence category fields",
  );
  ok(
    !/'last_save_evidence',\s*v_run\.last_save_evidence/.test(migration),
    "preflight does not expose full last_save_evidence blob",
  );
  ok(
    /Retain historical last_save_outcome/i.test(migration),
    "does not clear historical last_save_outcome",
  );

  const trusted = fs.readFileSync(
    path.join(root, "electron/eaushadhi-worker/product-details-trusted.js"),
    "utf8",
  );
  ok(
    trusted.includes("assessExactOneIdentityRecoveryPreflight"),
    "recovery uses dedicated recovery preflight",
  );
  ok(
    !/runTrustedAmbiguousSaveExactOneRecovery[\s\S]*assessProductDetailsResumePreflight\(/.test(
      trusted,
    ),
    "recovery function does not call resume preflight",
  );

  const preload = fs.readFileSync(path.join(root, "preload.js"), "utf8");
  ok(
    preload.includes("recoverAmbiguousSaveExactOneProductDetails"),
    "preload exposes recovery",
  );
  const ui = fs.readFileSync(
    path.join(root, "public/shared/js/eaushadhi-review-control.js"),
    "utf8",
  );
  ok(ui.includes("Recover Saved Portal Identity"), "UI action label");
  ok(
    ui.includes(
      "No Save will occur; existing portal product will be reread and adopted only if exact governed comparison matches.",
    ),
    "UI copy exact",
  );
  ok(ui.includes("ambiguousSaveExactOneRecoverable"), "hard refresh reconstructs via preview flag");
}

if (failed > 0) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("ALL_OK exact-one identity recovery smoke");
