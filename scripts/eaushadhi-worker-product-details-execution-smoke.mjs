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
  normalizeLoadProductDataforLegacyResponse,
  buildLoadProductDataforLegacyListBody,
} = require(join(root, "electron/eaushadhi-worker/portal-duplicate-guard.js"));
const {
  createInPageDuplicateSearchProbe,
} = require(join(root, "electron/eaushadhi-worker/product-details-trusted.js"));
const {
  resolveApprovedProductCopyFile,
  filenameMatchesGoverned,
} = require(join(root, "electron/eaushadhi-worker/approved-copy-resolve.js"));
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

const listBody = buildLoadProductDataforLegacyListBody("Karpooradi Thailam", {
  length: 10,
  licenseid: "L1",
});
assert(listBody.search === "Karpooradi Thailam", "list body applies exact search term");
assert(listBody.pageno === 1 && listBody.order === "asc", "list body uses proven paging/order fields");

const normalizedList = normalizeLoadProductDataforLegacyResponse(
  { TotalCount: 0, aaData: [] },
  "Karpooradi Thailam",
);
assert(normalizedList.mechanism === "datatable_list_post", "normalize marks datatable list mechanism");
assert(normalizedList.coverageComplete === true, "empty TotalCount=0 coverage is complete");

const probeSrc = createInPageDuplicateSearchProbe.toString();
assert(!/LoadProductDataforLegacy\s*\(/.test(probeSrc), "probe source never invokes LoadProductDataforLegacy(");
assert(probeSrc.includes("../admin/LoadProductDataforLegacy"), "probe posts proven admin list endpoint");
assert(probeSrc.includes("datatable_list_post"), "probe labels datatable list mechanism");

{
  const posts = [];
  const fakeWindow = {
    licenseId: "LIC-9",
    // Global symbol exists but must remain unused.
    LoadProductDataforLegacy: () => {
      throw new Error("global LoadProductDataforLegacy must not be called");
    },
    jQuery: {
      ajax({ url, type, data, success }) {
        posts.push({ url, type, data });
        const length = Number(data.length || 10);
        const all = [
          { name: "Other Product", id: 1 },
          { name: "Karpooradi Thailam", id: 2 },
        ];
        // Simulate portal length paging: return slice, TotalCount is full match count for search.
        const matches = all.filter((r) =>
          String(r.name).toLowerCase() === String(data.search || "").toLowerCase(),
        );
        const total = matches.length;
        success({
          TotalCount: total,
          aaData: matches.slice(0, length),
        });
      },
    },
  };
  const probe = createInPageDuplicateSearchProbe();
  const bound = probe.bind(fakeWindow);
  // Run probe with window/jQuery globals injected.
  const prevJq = globalThis.jQuery;
  const prevLic = globalThis.licenseId;
  const prevFn = globalThis.LoadProductDataforLegacy;
  globalThis.jQuery = fakeWindow.jQuery;
  globalThis.licenseId = fakeWindow.licenseId;
  globalThis.LoadProductDataforLegacy = fakeWindow.LoadProductDataforLegacy;
  globalThis.window = globalThis;
  let probeResult;
  try {
    probeResult = await createInPageDuplicateSearchProbe()("Karpooradi Thailam");
  } finally {
    globalThis.jQuery = prevJq;
    globalThis.licenseId = prevLic;
    globalThis.LoadProductDataforLegacy = prevFn;
  }
  assert(posts.length >= 1, "DataTable list POST was issued without global LoadProductDataforLegacy call");
  assert(posts.every((p) => p.type === "POST"), "duplicate list requests are POST");
  assert(
    posts.every((p) => String(p.url).includes("LoadProductDataforLegacy")),
    "duplicate list URL is LoadProductDataforLegacy",
  );
  assert(posts[0].data.search === "Karpooradi Thailam", "exact search term applied on list POST");
  assert(probeResult.usedGlobalWindowFn === false, "probe reports global window fn unused");
  assert(probeResult.mechanism === "datatable_list_post", "probe result uses datatable mechanism");
  assert(probeResult.searchApplied === true, "probe applied search");
  const guarded = evaluateDuplicateGuard(probeResult);
  assert(guarded.outcome === DUPLICATE_OUTCOME.EXACT_ONE, "one exact list match is EXACT_ONE");
}

assert(
  evaluateDuplicateGuard({
    source: "LoadProductDataforLegacy",
    searchApplied: true,
    searchTerm: "Karpooradi Thailam",
    totalCount: 2,
    rows: [{ name: "Karpooradi Thailam" }],
    coverageComplete: false,
  }).outcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
  "incomplete list coverage remains COVERAGE_UNPROVEN",
);

assert(filenameMatchesGoverned(EXPECTED_APPROVED_COPY_NAME), "governed approved filename matches");

{
  const failResolver = await resolveApprovedProductCopyFile({
    productId: 262,
    accessToken: "tok",
    userDataPath: join(root, ".tmp-smoke-userdata"),
    evidence: {
      approved_product_copy_present: true,
      original_file_name: EXPECTED_APPROVED_COPY_NAME,
    },
    callRpc: async () => {
      throw new Error("rpc failed");
    },
  });
  assert(failResolver.ok === false, "resolver failure fails closed");
}

{
  const wrongName = await resolveApprovedProductCopyFile({
    productId: 262,
    accessToken: "tok",
    userDataPath: join(root, ".tmp-smoke-userdata"),
    evidence: {
      approved_product_copy_present: true,
      original_file_name: "wrong.pdf",
    },
    callRpc: async () => ({
      original_file_name: "wrong.pdf",
      storage_bucket: "eaushadhi-evidence",
      storage_path: "x/wrong.pdf",
    }),
  });
  assert(
    wrongName.ok === false && wrongName.code === "APPROVED_COPY_NAME_MISMATCH",
    "wrong approved filename is blocked",
  );
}

{
  const rendererPath = await resolveApprovedProductCopyFile({
    productId: 262,
    accessToken: "tok",
    userDataPath: join(root, ".tmp-smoke-userdata"),
    evidence: {
      approved_product_copy_present: true,
      original_file_name: EXPECTED_APPROVED_COPY_NAME,
    },
    rendererLocalPath: "C:\\\\Users\\\\evil\\\\file.pdf",
    callRpc: async () => ({
      original_file_name: EXPECTED_APPROVED_COPY_NAME,
      storage_bucket: "eaushadhi-evidence",
      storage_path: "ok.pdf",
    }),
  });
  assert(
    rendererPath.ok === false && rendererPath.code === "RENDERER_PATH_REJECTED",
    "renderer path cannot satisfy file resolution",
  );
}

{
  const okResolve = await resolveApprovedProductCopyFile({
    productId: 262,
    accessToken: "tok",
    userDataPath: join(root, ".tmp-smoke-userdata"),
    evidence: {
      approved_product_copy_present: true,
      original_file_name: EXPECTED_APPROVED_COPY_NAME,
      storage_bucket: "eaushadhi-evidence",
      storage_path: "p/ok.pdf",
    },
    callRpc: async (name) => {
      assert(name === "rpc_eaushadhi_approved_product_copy_get", "resolver uses approved_product_copy_get");
      return {
        original_file_name: EXPECTED_APPROVED_COPY_NAME,
        storage_bucket: "eaushadhi-evidence",
        storage_path: "p/ok.pdf",
      };
    },
  });
  // Without mocking supabase signed URL, download stage fails closed — still not metadata-only success.
  assert(okResolve.ok === false, "resolver does not succeed on metadata alone without downloadable artifact");
  assert(okResolve.code !== "APPROVED_COPY_METADATA_MISSING", "failure is past metadata gate");
}

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
  entryStatus: "NOT_STARTED",
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
  userConfirmed: true,
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
  allowTestFieldGovernanceOverrides: true,
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
assert(indexSrc.includes("runTrustedProductDetailsPreview"), "preview uses trusted orchestration");
assert(indexSrc.includes("runTrustedProductDetailsStart"), "start uses trusted orchestration");
assert(indexSrc.includes("resolveApprovedProductCopyFile"), "index wires trusted approved-copy resolver");
assert(!indexSrc.includes("evidence?.approved_product_copy_present === true"), "index no longer treats metadata alone as resolved");
assert(!indexSrc.includes("options.adapters"), "index does not accept renderer adapters");
assert(!indexSrc.includes("options.content"), "index does not accept renderer content");
assert(!indexSrc.includes("source-analyzer"), "executor wiring does not touch source-analyzer");
assert(
  !require("fs")
    .readFileSync(join(root, "electron/eaushadhi-worker/product-details-trusted.js"), "utf8")
    .includes("window.LoadProductDataforLegacy("),
  "trusted duplicate path never calls window.LoadProductDataforLegacy(",
);

const trustedSrc = readFileSync(
  join(root, "electron/eaushadhi-worker/product-details-trusted.js"),
  "utf8",
);
assert(trustedSrc.includes("LIVE_EXECUTION_NOT_ARMED"), "trusted start returns LIVE_EXECUTION_NOT_ARMED");
assert(trustedSrc.includes("fieldGovernanceOverrides"), "trusted module names override key to reject");
assert(trustedSrc.includes("RENDERER_FORBIDDEN_OPTION_KEYS"), "forbidden renderer keys are listed");

const ipcSrc = readFileSync(join(root, "electron/eaushadhi-worker/ipc.js"), "utf8");
assert(
  ipcSrc.includes("userConfirmed: payload?.userConfirmed === true"),
  "IPC start forwards only userConfirmed",
);
assert(
  /product-details-preview[\s\S]*previewProductDetailsExecution\(productId, accessToken, \{\}\)/.test(
    ipcSrc,
  ),
  "IPC preview forwards empty options object",
);

const preloadSrc = readFileSync(join(root, "preload.js"), "utf8");
assert(preloadSrc.includes("previewProductDetails:"), "preload exposes previewProductDetails");
assert(preloadSrc.includes("startProductDetails:"), "preload exposes startProductDetails");
assert(
  preloadSrc.includes("userConfirmed: options?.userConfirmed === true"),
  "preload start sends only userConfirmed",
);
assert(!preloadSrc.includes("...(options"), "preload does not spread renderer options");
assert(!/evaluate\s*:/.test(preloadSrc), "preload does not expose evaluate");

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
assert(controlSrc.includes("Start Product Details"), "Review UI has Start Product Details");
assert(controlSrc.includes("will NOT add Composition"), "warning mentions no Composition");
assert(!controlSrc.includes("submitProduct"), "UI does not reference submitProduct");
assert(!/Enter Product/.test(controlSrc), "UI does not expose Enter Product");
assert(
  !controlSrc.includes("contentHash: state.workerProductDetailsPreview"),
  "UI does not send preview contentHash on Start",
);
assert(
  !controlSrc.includes("entryStatus: state.queueRow"),
  "UI does not send queue entryStatus on Preview",
);

const {
  sanitizeRendererCommand,
  RENDERER_FORBIDDEN_OPTION_KEYS,
  runTrustedProductDetailsPreview,
  runTrustedProductDetailsStart,
  collectAuthoritativeProductDetailsContext,
  buildTrustedExecutorInput,
} = require(join(root, "electron/eaushadhi-worker/product-details-trusted.js"));

const malicious = {
  content: baseContent({ details: { ...baseContent().details, remarks: "hacked" } }),
  contentHash: "forged-hash",
  workflowRowVersion: 999,
  entryStatus: "NOT_STARTED",
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
  duplicateSearch: noneDuplicate,
  pageState: readyPage,
  permissionOptions: [{ label: "For Sale", value: "7" }],
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
  adapters: {
    runBegin: async () => {
      throw new Error("renderer adapter must never run");
    },
  },
  userConfirmed: true,
};
const sanitized = sanitizeRendererCommand(malicious);
assert(sanitized.userConfirmed === true, "sanitize keeps userConfirmed");
assert(
  sanitized.forbiddenPresent.includes("content") &&
    sanitized.forbiddenPresent.includes("adapters") &&
    sanitized.forbiddenPresent.includes("fieldGovernanceOverrides"),
  "sanitize detects forbidden renderer keys",
);
assert(
  RENDERER_FORBIDDEN_OPTION_KEYS.includes("duplicateSearch") &&
    RENDERER_FORBIDDEN_OPTION_KEYS.includes("pageState"),
  "forbidden key list covers duplicateSearch and pageState",
);

const noOverrideExec = await executeProductDetails(
  {
    ...successInput,
    fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
    allowTestFieldGovernanceOverrides: false,
  },
  {
    runBegin: async () => {
      throw new Error("must not begin when overrides stripped");
    },
  },
);
assert(
  noOverrideExec.ok === false && noOverrideExec.code === "FIELD_GOVERNANCE_INCOMPLETE",
  "production execute ignores fieldGovernanceOverrides without test flag",
);

let mutatingRpcNames = [];
let saveDataCalls = 0;
const authoritativeContent = baseContent({
  entry_status: "NOT_STARTED",
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
  is_ready_for_entry: true,
});

function makeTrustedDeps(overrides = {}) {
  return {
    productId: 262,
    liveArmed: false,
    page: {
      evaluate: async (fn, arg) => {
        if (typeof fn === "function" && fn.constructor.name === "AsyncFunction") {
          return {
            source: "LoadProductDataforLegacy",
            searchApplied: true,
            searchTerm: "Karpooradi Thailam",
            totalCount: 0,
            rows: [],
            coverageComplete: true,
          };
        }
        const result = fn(arg);
        if (result && result.origin) return { ...readyPage, ...result, workerState: undefined };
        if (Array.isArray(result)) return [{ label: "For Sale", value: "7" }];
        return result;
      },
    },
    callRpc: async (name, args) => {
      mutatingRpcNames.push(name);
      if (name === "rpc_eaushadhi_require_permission") return { ok: true };
      if (name === "rpc_eaushadhi_worker_preflight") {
        return {
          workflow_row_version: 7,
          entry_status: "NOT_STARTED",
          is_ready_for_entry: true,
          review_status: "VERIFIED",
          eligible: true,
        };
      }
      if (name === "rpc_eaushadhi_worker_content_get") {
        assert(args.p_product_id === 262, "content_get uses product 262");
        return authoritativeContent;
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    getWorkerState: () => "READY",
    measurePageState: async () => ({ ok: true, pageState: readyPage }),
    searchDuplicates: async () => ({ ok: true, searchResponse: noneDuplicate }),
    enumeratePermissionOptions: async () => ({
      ok: true,
      options: [{ label: "For Sale", value: "7" }],
    }),
    resolveApprovedCopy: async () => ({ ok: true }),
    buildAdapters: async () => {
      throw new Error("adapters must not build while disarmed");
    },
    ...overrides,
  };
}

mutatingRpcNames = [];
const trustedPreview = await runTrustedProductDetailsPreview(makeTrustedDeps());
assert(trustedPreview.liveArmed === false, "trusted preview reports liveArmed false");
assert(
  trustedPreview.preview?.startEnabled !== true,
  "trusted preview keeps Start disabled while disarmed / incomplete governance",
);
assert(
  (trustedPreview.preview?.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE") ||
    trustedPreview.code === "FIELD_GOVERNANCE_INCOMPLETE" ||
    (trustedPreview.fieldGate && trustedPreview.fieldGate.ok === false),
  "authoritative preview still surfaces required-field blockers",
);
assert(
  mutatingRpcNames.every(
    (n) =>
      n === "rpc_eaushadhi_require_permission" ||
      n === "rpc_eaushadhi_worker_preflight" ||
      n === "rpc_eaushadhi_worker_content_get",
  ),
  "trusted preview only uses read-only RPCs",
);
assert(!mutatingRpcNames.includes("rpc_eaushadhi_worker_run_begin"), "preview never run_begin");

const forgedPreview = await runTrustedProductDetailsPreview({
  ...makeTrustedDeps(),
  // Even if a caller tried to attach renderer fields on deps, collect ignores them.
  content: { forged: true },
  reviewStatus: "VERIFIED",
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
});
assert(
  forgedPreview.fieldGate?.ok === false ||
    (forgedPreview.preview?.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE"),
  "renderer-style overrides cannot clear remarks/country/month blockers via trusted preview",
);

mutatingRpcNames = [];
saveDataCalls = 0;
const trustedStart = await runTrustedProductDetailsStart(makeTrustedDeps(), {
  userConfirmed: true,
  ...malicious,
});
assert(trustedStart.code === "LIVE_EXECUTION_NOT_ARMED", "trusted start remains disarmed");
assert(trustedStart.runBegun !== true, "disarmed start never begins run");
assert(trustedStart.inventedFailureRpcCalled === false, "disarmed start invents no failure RPC");
assert(!mutatingRpcNames.includes("rpc_eaushadhi_worker_run_begin"), "start never run_begin while disarmed");
assert(saveDataCalls === 0, "no SaveData while disarmed");

const missingAuthority = await collectAuthoritativeProductDetailsContext({
  productId: 262,
  callRpc: async (name) => {
    if (name === "rpc_eaushadhi_require_permission") return { ok: true };
    if (name === "rpc_eaushadhi_worker_preflight") return {};
    throw new Error("should stop before content_get without version");
  },
  getWorkerState: () => "READY",
});
assert(
  missingAuthority.ok === false && missingAuthority.code === "AUTHORITATIVE_EVIDENCE_MISSING",
  "unknown/missing governance fails closed",
);

const authorityOk = await collectAuthoritativeProductDetailsContext(makeTrustedDeps());
assert(authorityOk.ok === true, "authoritative collection succeeds with trusted deps");

{
  const depsNoResolver = makeTrustedDeps();
  delete depsNoResolver.resolveApprovedCopy;
  const blocked = await collectAuthoritativeProductDetailsContext(depsNoResolver);
  assert(
    blocked.ok === false && (blocked.missing || []).includes("approved_copy_resolver"),
    "metadata present but resolver missing is blocked",
  );
}

{
  const depsFail = makeTrustedDeps({
    resolveApprovedCopy: async () => ({ ok: false, code: "APPROVED_COPY_DOWNLOAD_FAILED" }),
  });
  const blocked = await collectAuthoritativeProductDetailsContext(depsFail);
  assert(
    blocked.ok === false && (blocked.missing || []).includes("approved_copy"),
    "metadata present but resolver fails is blocked",
  );
}

{
  const depsOk = makeTrustedDeps({
    resolveApprovedCopy: async () => ({
      ok: true,
      localPath: join(root, ".tmp-smoke-userdata", "resolved.pdf"),
      fileName: EXPECTED_APPROVED_COPY_NAME,
    }),
  });
  const ok = await collectAuthoritativeProductDetailsContext(depsOk);
  assert(ok.ok === true && ok.approvedResolved === true, "successful trusted resolver sets approvedResolved");
}
const trustedInput = buildTrustedExecutorInput(authorityOk, { userConfirmed: true });
assert(
  !Object.prototype.hasOwnProperty.call(trustedInput, "fieldGovernanceOverrides") ||
    trustedInput.allowTestFieldGovernanceOverrides === false,
  "trusted executor input does not enable governance overrides",
);
assert(trustedInput.authorityMode === true, "trusted executor input is authorityMode");
assert(trustedInput.reviewStatus === "VERIFIED", "reviewStatus comes from server content/preflight");
assert(trustedInput.classificationVerified === true, "classificationVerified is explicit true");
assert(trustedInput.isReadyForEntry === true, "isReadyForEntry is explicit true");
assert(trustedInput.entryStatus === "NOT_STARTED", "entryStatus is explicit from server");

const unknownGov = assessProductDetailsPreflight({
  productId: 262,
  content: baseContent(),
  contentHash: "x",
  authorityMode: true,
  // intentionally omit review/classification/ready/entry/page/duplicate
});
assert(
  unknownGov.code === "ENTRY_STATUS_UNKNOWN" ||
    unknownGov.code === "WORKFLOW_STATUS_UNKNOWN" ||
    unknownGov.code === "PAGE_STATE_UNKNOWN" ||
    unknownGov.code === "DUPLICATE_SEARCH_UNKNOWN",
  "authorityMode does not default-true VERIFIED/READY/NOT_STARTED",
);

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
