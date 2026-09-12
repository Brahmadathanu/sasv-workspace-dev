/**
 * Offline Karpooradi Product Details execution smokes.
 * No Edge. No live portal. No mutating lifecycle RPC network calls.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  FIRST_CONTROLLED_PRODUCT_ID,
  EXPECTED_PORTAL_PRODUCT_NAME,
  assessProductDetailsPreflight,
  executeProductDetails,
  planResumeAction,
} = require(join(root, "electron/eaushadhi-worker/product-details-executor.js"));
const {
  EXPECTED_APPROVED_COPY_NAME,
  assessRequiredFieldGate,
  resolvePermissionPurposeByExactLabel,
  rejectKuzhambuSubtype,
} = require(join(root, "electron/eaushadhi-worker/product-details-field-map.js"));
const {
  evaluateDuplicateGuard,
  DUPLICATE_OUTCOME,
} = require(join(root, "electron/eaushadhi-worker/portal-duplicate-guard.js"));
const {
  compareProductDetailsReread,
  toMarkPortalVerifiedReport,
  OVERALL_COMPARE,
} = require(join(root, "electron/eaushadhi-worker/compare.js"));
const { classifySaveOutcome, SAVE_OUTCOME, createSaveMutex } = require(
  join(root, "electron/eaushadhi-worker/portal-save-observe.js"),
);
const { CHANNELS } = require(join(root, "electron/eaushadhi-worker/ipc.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const GOVERNANCE_OVERRIDES = Object.freeze({
  remarks: "smoke-governed-remarks",
  countryApplicable: "YES",
  countryId: "1",
  month: "24",
  shelfmonth: "24",
});

function baseContent(extra = {}) {
  return {
    content_hash: "hash-karpooradi-smoke-1",
    entry_status: "NOT_STARTED",
    versions: { workflow_row_version: 7 },
    product: {
      portal_product_name: "Karpooradi Thailam",
      canonical_product_name: "Karpooradi Thailam",
    },
    classification: {
      product_type: { portal_option_value: "1", label: "Ayurveda" },
      product_category: { portal_option_value: "10", label: "Thailam" },
      product_subtype: { portal_option_value: "31", label: "-" },
    },
    details: {
      permission_purpose_label: "For Sale",
      composition_title: "For 10 mL",
      diseases_conditions: "Sandhirujah, Śōpham",
      combined_restricted_declaration: "NO",
    },
    actions: [{ portal_option_value: "99", label: "Musculoskeletal System (Bones &Joints)" }],
    evidence: {
      approved_product_copy_present: true,
      original_file_name: EXPECTED_APPROVED_COPY_NAME,
    },
    ...extra,
  };
}

const noneDuplicate = {
  source: "LoadProductDataforLegacy",
  searchApplied: true,
  searchTerm: "Karpooradi Thailam",
  totalCount: 0,
  rows: [],
  coverageComplete: true,
};

const readyPage = {
  workerState: "READY",
  origin: "https://www.e-aushadhi.gov.in",
  path: "/admin/addproductforlegacy",
  actiontype: "add",
  hiddenId: "",
  staleEditState: false,
  saveDataAvailable: true,
};

assert(FIRST_CONTROLLED_PRODUCT_ID === 262, "product lock is 262");
assert(EXPECTED_PORTAL_PRODUCT_NAME === "Karpooradi Thailam", "portal name lock");
assert(
  EXPECTED_APPROVED_COPY_NAME ===
    "EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V01.pdf",
  "approved PDF name lock",
);

const kuzhambu = rejectKuzhambuSubtype({
  classification: { product_subtype: { portal_option_value: "X", label: "Kuzhambu" } },
});
assert(kuzhambu.ok === false, "Kuzhambu subtype is rejected");

const gateBlocked = assessRequiredFieldGate(baseContent());
assert(gateBlocked.ok === false, "1A: missing country/month/remarks blocks gate");
assert(
  gateBlocked.code === "FIELD_GOVERNANCE_INCOMPLETE",
  "1A code is FIELD_GOVERNANCE_INCOMPLETE",
);
assert(
  (gateBlocked.blockers || []).some((b) => b.key === "remarks"),
  "remarks is a governance blocker",
);
assert(
  (gateBlocked.blockers || []).some((b) => b.key === "countryId"),
  "countryId is a governance blocker",
);

const gatePass = assessRequiredFieldGate(baseContent(), {
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
});
assert(gatePass.ok === true, "harness overrides can pass field gate offline only");

const permZero = resolvePermissionPurposeByExactLabel("For Sale", [
  { label: "For Export", value: "1" },
]);
assert(permZero.code === "PERMISSION_LABEL_ZERO_MATCH", "2B zero match fails");
const permMulti = resolvePermissionPurposeByExactLabel("For Sale", [
  { label: "For Sale", value: "1" },
  { label: "For Sale", value: "2" },
]);
assert(permMulti.code === "PERMISSION_LABEL_MULTIPLE_MATCH", "2B multi match fails");
const permOk = resolvePermissionPurposeByExactLabel("For Sale", [
  { label: "For Sale", value: "7" },
]);
assert(permOk.ok === true && permOk.resolvedPortalValue === "7", "2B exact unique label resolves");

assert(
  evaluateDuplicateGuard({
    source: "LoadProductDataforLegacy",
    searchApplied: true,
    searchTerm: "Karpooradi Thailam",
    totalCount: 5,
    rows: [{ name: "Other" }],
  }).outcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
  "visible-page incompleteness vs TotalCount is COVERAGE_UNPROVEN",
);
assert(
  evaluateDuplicateGuard({
    searchApplied: true,
    searchTerm: "Karpooradi Thailam",
    totalCount: 0,
    rows: [],
  }).outcome === DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
  "missing LoadProductDataforLegacy source is SEARCH_INCOMPLETE",
);
assert(
  evaluateDuplicateGuard({
    ...noneDuplicate,
    totalCount: 1,
    rows: [{ name: "Karpooradi Thailam", id: "9001" }],
    coverageComplete: true,
  }).outcome === DUPLICATE_OUTCOME.EXACT_ONE,
  "exact one duplicate refuses create",
);
assert(
  evaluateDuplicateGuard(noneDuplicate).outcome === DUPLICATE_OUTCOME.NONE,
  "coverage-proven empty search is NONE",
);

const lockedOut = assessProductDetailsPreflight({
  productId: 999,
  content: baseContent(),
  contentHash: "x",
  duplicateSearch: noneDuplicate,
});
assert(lockedOut.code === "PRODUCT_LOCK_REJECTED", "non-262 product rejected");

const previewBlocked = assessProductDetailsPreflight({
  productId: 262,
  content: baseContent(),
  contentHash: "hash-karpooradi-smoke-1",
  duplicateSearch: noneDuplicate,
  pageState: readyPage,
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
});
assert(previewBlocked.ok === false, "production content without overrides keeps Start blocked");
assert(
  previewBlocked.preview.startEnabled === false,
  "Start disabled when FIELD_GOVERNANCE_INCOMPLETE",
);
assert(
  (previewBlocked.preview.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE"),
  "preview lists FIELD_GOVERNANCE_INCOMPLETE",
);

const resume = planResumeAction({ runStatus: "RUNNING" });
assert(resume.mayCreate === false, "resume never auto-creates");
assert(resume.action === "READ_ONLY_RECONCILE", "resume is read-only reconcile");

const mutex = createSaveMutex();
const saveOk = classifySaveOutcome({
  invoked: true,
  invokeCount: 1,
  httpOk: true,
  businessSuccess: true,
  portalProductId: "7788",
});
assert(saveOk.outcome === SAVE_OUTCOME.SUCCESS, "joint Save success classified");
const saveAmb = classifySaveOutcome({
  invoked: true,
  invokeCount: 1,
  httpOk: true,
  businessSuccess: false,
  portalProductId: null,
});
assert(saveAmb.outcome === SAVE_OUTCOME.AMBIGUOUS, "ambiguous Save classified");

let saveCalls = 0;
let markFailedCalls = 0;
let markPortalVerifiedArgs = null;
let runBeginCalls = 0;

const successInput = {
  productId: 262,
  content: baseContent(),
  contentHash: "hash-karpooradi-smoke-1",
  finalContentHash: "hash-karpooradi-smoke-1",
  workflowRowVersion: 7,
  payloadHash: "payload-1",
  duplicateSearch: noneDuplicate,
  pageState: readyPage,
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
  userConfirmed: true,
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
  permissionOptions: [{ label: "For Sale", value: "7" }],
  approvedFileName: EXPECTED_APPROVED_COPY_NAME,
};

const success = await executeProductDetails(successInput, {
  runBegin: async () => {
    runBeginCalls += 1;
    return { run_id: "run-smoke-1", workflow_row_version: 7 };
  },
  fillForm: async () => ({ ok: true }),
  saveOnce: async () => {
    saveCalls += 1;
    return {
      invoked: true,
      invokeCount: 1,
      httpOk: true,
      businessSuccess: true,
      portalProductId: "7788",
      hiddenId: "7788",
    };
  },
  markEntered: async () => ({ ok: true }),
  reread: async () => ({
    name: "Karpooradi Thailam",
    type: "1",
    categoryId: "10",
    subTypeId: "31",
    permissionPurpose: { label: "For Sale", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  }),
  markPortalVerified: async (args) => {
    markPortalVerifiedArgs = args;
    return { ok: true };
  },
  markFailed: async () => {
    markFailedCalls += 1;
  },
});

assert(success.ok === true, "mocked MATCH path reaches PORTAL_VERIFIED");
assert(success.code === "PORTAL_VERIFIED", "terminal code is PORTAL_VERIFIED");
assert(success.compositionExecuted === false, "Composition never executed");
assert(success.submitProductExecuted === false, "submitProduct never executed");
assert(success.inventedFailureRpcCalled === false, "no invented failure RPC on success");
assert(runBeginCalls === 1, "run_begin called once via mock");
assert(saveCalls === 1, "SaveData invoked exactly once");
assert(
  markPortalVerifiedArgs?.compareReport?.equal === true,
  "mark_portal_verified receives equal compare report",
);
assert(
  Array.isArray(markPortalVerifiedArgs?.compareReport?.items) &&
    markPortalVerifiedArgs.compareReport.items.length > 0,
  "mark_portal_verified compare report has items",
);

const drift = await executeProductDetails(
  { ...successInput, finalContentHash: "drifted" },
  {
    runBegin: async () => {
      runBeginCalls += 1;
      return { run_id: "x" };
    },
  },
);
assert(drift.code === "CONTENT_HASH_DRIFT", "content hash drift refuses run_begin");
assert(drift.runBegun === false, "drift never begins run");

saveCalls = 0;
markFailedCalls = 0;
const saveFail = await executeProductDetails(successInput, {
  runBegin: async () => ({ run_id: "run-fail-1", workflow_row_version: 7 }),
  fillForm: async () => ({ ok: true }),
  saveOnce: async () => {
    saveCalls += 1;
    return {
      invoked: true,
      invokeCount: 1,
      httpOk: false,
      businessSuccess: false,
      portalProductId: null,
    };
  },
  markFailed: async () => {
    markFailedCalls += 1;
  },
});
assert(saveFail.ok === false, "Save failure stops");
assert(saveFail.inventedFailureRpcCalled === false, "no invented mark_failed RPC on Save failure");
assert(markFailedCalls === 0, "markFailed adapter never invoked by executor");
assert(saveCalls === 1, "failed Save still one-shot");
assert(saveFail.requiresReadOnlyReconciliation === true, "failure requires read-only reconcile");

const mismatch = await executeProductDetails(successInput, {
  runBegin: async () => ({ run_id: "run-mm-1", workflow_row_version: 7 }),
  fillForm: async () => ({ ok: true }),
  saveOnce: async () => ({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: "7788",
  }),
  markEntered: async () => ({ ok: true }),
  reread: async () => ({
    name: "Wrong Name",
    type: "1",
    categoryId: "10",
    subTypeId: "31",
    permissionPurpose: { label: "For Sale", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  }),
  markPortalVerified: async () => {
    throw new Error("should not mark portal verified on mismatch");
  },
});
assert(mismatch.code === "COMPARE_MISMATCH", "mismatch does not mark portal_verified");
assert(mismatch.compareResult?.overall === OVERALL_COMPARE.MISMATCH, "overall MISMATCH");

const compareMatch = compareProductDetailsReread(
  {
    name: "Karpooradi Thailam",
    type: "1",
    categoryId: "10",
    subTypeId: "31",
    permissionPurpose: { label: "For Sale", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  },
  {
    name: "Karpooradi Thailam",
    type: "1",
    categoryId: "10",
    subTypeId: "31",
    permissionPurpose: { label: "For Sale", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  },
);
assert(compareMatch.overall === OVERALL_COMPARE.MATCH, "reread compare MATCH");
assert(toMarkPortalVerifiedReport(compareMatch).equal === true, "portal_verified report equal");

assert(
  CHANNELS.PRODUCT_DETAILS_PREVIEW === "eaushadhi-worker:product-details-preview",
  "preview IPC channel exists",
);
assert(
  CHANNELS.PRODUCT_DETAILS_START === "eaushadhi-worker:product-details-start",
  "start IPC channel exists",
);
assert(
  !Object.values(CHANNELS).some((name) => /evaluate|execute|run-script/i.test(name)),
  "no generic evaluate IPC",
);

const indexSrc = readFileSync(join(root, "electron/eaushadhi-worker/index.js"), "utf8");
assert(indexSrc.includes("PRODUCT_DETAILS_LIVE_ARMED = false"), "live execution remains disarmed");
assert(indexSrc.includes("LIVE_EXECUTION_NOT_ARMED"), "Start returns LIVE_EXECUTION_NOT_ARMED when disarmed");
assert(!indexSrc.includes("source-analyzer"), "executor wiring does not touch source-analyzer");

const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
assert(preloadSrc.includes("previewProductDetails:"), "preload exposes previewProductDetails");
assert(preloadSrc.includes("startProductDetails:"), "preload exposes startProductDetails");
assert(!/evaluate\s*:/.test(preloadSrc), "preload does not expose evaluate");

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
assert(controlSrc.includes("Start Product Details"), "Review UI has Start Product Details");
assert(controlSrc.includes("will NOT add Composition"), "warning mentions no Composition");
assert(!controlSrc.includes("submitProduct"), "UI does not reference submitProduct");
assert(!/Enter Product/.test(controlSrc), "UI does not expose Enter Product");

const concurrentFirst = mutex.runExclusive(async () => {
  await new Promise((r) => setTimeout(r, 40));
  return "a";
});
await new Promise((r) => setTimeout(r, 5));
const concurrentSecond = await mutex.runExclusive(async () => "b");
const concurrentFirstResult = await concurrentFirst;
assert(concurrentFirstResult === "a", "save mutex first caller runs");
assert(concurrentSecond?.code === "SAVE_MUTEX_BUSY", "save mutex blocks concurrent execution");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Product Details execution smokes passed (offline).");
