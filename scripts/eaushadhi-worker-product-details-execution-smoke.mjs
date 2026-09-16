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
  PORTAL_SHELFMONTH_ROUTE_VALUES,
  assessRequiredFieldGate,
  buildFillPlan,
  resolvePermissionPurposeByExactLabel,
  rejectKuzhambuSubtype,
} = require(join(root, "electron/eaushadhi-worker/product-details-field-map.js"));
const { createInPageFillScript } = require(join(root, "electron/eaushadhi-worker/portal-dom-fill.js"));
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
  shelfmonth: "RegularAsPerClause",
});

function baseContent(extra = {}) {
  const base = {
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
      permission_purpose_label: "Regular",
      composition_title: "For 10 mL",
      diseases_conditions: "Sandhirujah, Śōpham",
      combined_restricted_declaration: "NO",
      portal_remarks: null,
      portal_shelfmonth_route: null,
    },
    actions: [{ portal_option_value: "99", label: "Musculoskeletal System (Bones &Joints)" }],
    evidence: {
      approved_product_copy_present: true,
      original_file_name: EXPECTED_APPROVED_COPY_NAME,
    },
  };
  return {
    ...base,
    ...extra,
    product: { ...base.product, ...(extra.product || {}) },
    classification: { ...base.classification, ...(extra.classification || {}) },
    details: { ...base.details, ...(extra.details || {}) },
    evidence: { ...base.evidence, ...(extra.evidence || {}) },
    actions: extra.actions || base.actions,
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
assert(gateBlocked.ok === false, "1A: missing portal remarks/shelfmonth blocks gate");
assert(
  gateBlocked.code === "FIELD_GOVERNANCE_INCOMPLETE",
  "1A code is FIELD_GOVERNANCE_INCOMPLETE",
);
assert(
  (gateBlocked.blockers || []).some((b) => b.key === "remarks"),
  "1. null remarks blocks",
);
assert(
  (gateBlocked.blockers || []).some((b) => b.key === "shelfmonth"),
  "3. null shelfmonth blocks",
);
assert(
  !(gateBlocked.blockers || []).some((b) => b.key === "month"),
  "7. month does not block ADD",
);
assert(
  !(gateBlocked.blockers || []).some((b) => b.key === "countryApplicable"),
  "9. countryApplicable does not block Regular",
);
assert(
  !(gateBlocked.blockers || []).some((b) => b.key === "countryId"),
  "9. countryId does not block Regular",
);

const blankRemarks = assessRequiredFieldGate(
  baseContent({ details: { portal_remarks: "   ", portal_shelfmonth_route: "RegularAsPerClause" } }),
);
assert(blankRemarks.ok === false, "2. blank remarks blocks");
assert((blankRemarks.blockers || []).some((b) => b.key === "remarks"), "blank remarks blocker key");

const invalidShelf = assessRequiredFieldGate(
  baseContent({
    details: { portal_remarks: "ok", portal_shelfmonth_route: "NotARealRoute" },
  }),
);
assert(invalidShelf.ok === false, "4. invalid shelfmonth blocks");
assert((invalidShelf.blockers || []).some((b) => b.key === "shelfmonth"), "invalid shelfmonth blocker key");

const regularClause = assessRequiredFieldGate(
  baseContent({
    details: { portal_remarks: "Portal remarks", portal_shelfmonth_route: "RegularAsPerClause" },
  }),
);
assert(regularClause.ok === true, "5. RegularAsPerClause passes field governance");

const applyAccess = assessRequiredFieldGate(
  baseContent({
    details: {
      portal_remarks: "Portal remarks",
      portal_shelfmonth_route: "Applyforaccessofshelflife",
    },
  }),
);
assert(applyAccess.ok === true, "6. Applyforaccessofshelflife passes field governance");

const monthPlan = buildFillPlan(
  baseContent({ details: { portal_remarks: "x", portal_shelfmonth_route: "RegularAsPerClause" } }),
);
const monthField = (monthPlan.fields || []).find((f) => f.key === "month");
assert(monthField?.fill === false && monthField?.skipped === true, "8. month is not DOM-filled");

const exportOnlyBlocked = assessRequiredFieldGate(
  baseContent({
    details: {
      permission_purpose_label: "Export Only",
      portal_remarks: "Portal remarks",
      portal_shelfmonth_route: "RegularAsPerClause",
    },
  }),
);
assert(exportOnlyBlocked.ok === false, "11. Export Only remains fail-closed for country fields");
assert(
  (exportOnlyBlocked.blockers || []).some((b) => b.key === "countryApplicable"),
  "Export Only blocks countryApplicable",
);

const regularPlan = buildFillPlan(
  baseContent({ details: { portal_remarks: "Exact remarks", portal_shelfmonth_route: "RegularAsPerClause" } }),
);
const countryField = (regularPlan.fields || []).find((f) => f.key === "countryApplicable");
assert(countryField?.fill === false && countryField?.skipped === true, "10. country fields are not DOM-filled for Regular");
assert(
  (regularPlan.fields || []).find((f) => f.key === "remarks")?.expected === "Exact remarks",
  "12. remarks fills exactly from portal_remarks",
);
assert(
  (regularPlan.fields || []).find((f) => f.key === "shelfmonth")?.expected === "RegularAsPerClause",
  "12. shelfmonth uses exact enum token",
);
assert(
  PORTAL_SHELFMONTH_ROUTE_VALUES.includes("RegularAsPerClause") &&
    PORTAL_SHELFMONTH_ROUTE_VALUES.includes("Applyforaccessofshelflife"),
  "shelfmonth enum lock",
);
assert(createInPageFillScript().includes('input[name="shelfmonth"]'), "13. shelfmonth checks exact radio");

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

assert(filenameMatchesGoverned(EXPECTED_APPROVED_COPY_NAME), "exact V01 approved filename passes");
assert(
  filenameMatchesGoverned("EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V00.pdf") === false,
  "V00 approved filename fails",
);
assert(
  filenameMatchesGoverned("EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V02.pdf") === false,
  "V02 approved filename fails",
);
assert(
  filenameMatchesGoverned(
    "EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V01_backup.pdf",
  ) === false,
  "backup suffix approved filename fails",
);
assert(
  filenameMatchesGoverned("EAUSHADHI_P0262_KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY_V01.docx") ===
    false,
  "different extension approved filename fails",
);
assert(
  filenameMatchesGoverned("KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY") === false,
  "substring KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY fails",
);

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
  permissionOptions: [{ label: "Regular", value: "7" }],
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
    permissionPurpose: { label: "Regular", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    remarks: GOVERNANCE_OVERRIDES.remarks,
    shelfmonth: GOVERNANCE_OVERRIDES.shelfmonth,
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
    permissionPurpose: { label: "Regular", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    remarks: GOVERNANCE_OVERRIDES.remarks,
    shelfmonth: GOVERNANCE_OVERRIDES.shelfmonth,
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
    permissionPurpose: { label: "Regular", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    remarks: GOVERNANCE_OVERRIDES.remarks,
    shelfmonth: GOVERNANCE_OVERRIDES.shelfmonth,
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  },
  {
    name: "Karpooradi Thailam",
    type: "1",
    categoryId: "10",
    subTypeId: "31",
    permissionPurpose: { label: "Regular", value: "7" },
    compositionTitle: "For 10 mL",
    disease: "Sandhirujah, Śōpham",
    indications: ["99"],
    drugs: "NO",
    remarks: GOVERNANCE_OVERRIDES.remarks,
    shelfmonth: GOVERNANCE_OVERRIDES.shelfmonth,
    attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
  },
);
assert(compareMatch.overall === OVERALL_COMPARE.MATCH, "14. remarks/shelfmonth compare on reread MATCH");
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
  content: baseContent({
    details: {
      portal_remarks: "hacked",
      portal_shelfmonth_route: "RegularAsPerClause",
    },
  }),
  remarks: "hacked",
  portal_remarks: "hacked",
  shelfmonth: "Applyforaccessofshelflife",
  portal_shelfmonth_route: "Applyforaccessofshelflife",
  contentHash: "forged-hash",
  workflowRowVersion: 999,
  entryStatus: "NOT_STARTED",
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
  duplicateSearch: noneDuplicate,
  pageState: readyPage,
  permissionOptions: [{ label: "Regular", value: "7" }],
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
    sanitized.forbiddenPresent.includes("fieldGovernanceOverrides") &&
    sanitized.forbiddenPresent.includes("portal_remarks") &&
    sanitized.forbiddenPresent.includes("portal_shelfmonth_route") &&
    sanitized.forbiddenPresent.includes("remarks") &&
    sanitized.forbiddenPresent.includes("shelfmonth"),
  "15. renderer spoof cannot override remarks/shelfmonth",
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
let permissionEditFlags = [];
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
        if (Array.isArray(result)) return [{ label: "Regular", value: "7" }];
        return result;
      },
    },
    callRpc: async (name, args) => {
      mutatingRpcNames.push(name);
      if (name === "rpc_eaushadhi_require_permission") {
        permissionEditFlags.push(args?.p_edit);
        return { ok: true };
      }
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
      options: [{ label: "Regular", value: "7" }],
    }),
    resolveApprovedCopy: async () => ({ ok: true }),
    buildAdapters: async () => {
      throw new Error("adapters must not build while disarmed");
    },
    ...overrides,
  };
}

mutatingRpcNames = [];
permissionEditFlags = [];
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
assert(
  permissionEditFlags.length >= 1 && permissionEditFlags.every((v) => v === false),
  "Preview permission RPC uses p_edit=false",
);

const forgedPreview = await runTrustedProductDetailsPreview({
  ...makeTrustedDeps({ requireEditPermission: true }),
  content: { forged: true },
  reviewStatus: "VERIFIED",
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
  p_edit: true,
  requireEditPermission: true,
});
assert(
  forgedPreview.authority?.requireEditPermission === false ||
    forgedPreview.fieldGate?.ok === false ||
    (forgedPreview.preview?.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE"),
  "renderer-style requireEditPermission cannot force preview into edit mode",
);
permissionEditFlags = [];
await runTrustedProductDetailsPreview(
  makeTrustedDeps({ requireEditPermission: true, p_edit: true }),
);
assert(
  permissionEditFlags.every((v) => v === false),
  "renderer cannot override preview p_edit to true via deps",
);
assert(
  forgedPreview.fieldGate?.ok === false ||
    (forgedPreview.preview?.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE"),
  "renderer-style overrides cannot clear remarks/country/month blockers via trusted preview",
);

mutatingRpcNames = [];
permissionEditFlags = [];
saveDataCalls = 0;
const trustedStart = await runTrustedProductDetailsStart(makeTrustedDeps(), {
  userConfirmed: true,
  ...malicious,
  requireEditPermission: false,
  p_edit: false,
});
assert(trustedStart.code === "LIVE_EXECUTION_NOT_ARMED", "trusted start remains disarmed");
assert(trustedStart.runBegun !== true, "disarmed start never begins run");
assert(trustedStart.inventedFailureRpcCalled === false, "disarmed start invents no failure RPC");
assert(!mutatingRpcNames.includes("rpc_eaushadhi_worker_run_begin"), "start never run_begin while disarmed");
assert(saveDataCalls === 0, "no SaveData while disarmed");
assert(
  permissionEditFlags.length >= 1 && permissionEditFlags.every((v) => v === true),
  "Start permission RPC uses p_edit=true",
);
assert(trustedStart.requireEditPermission === true, "start result records requireEditPermission true");
assert(
  RENDERER_FORBIDDEN_OPTION_KEYS.includes("requireEditPermission") &&
    RENDERER_FORBIDDEN_OPTION_KEYS.includes("p_edit"),
  "renderer cannot supply requireEditPermission/p_edit through sanitize allowlist",
);

{
  let beginCalls = 0;
  permissionEditFlags = [];
  const denied = await runTrustedProductDetailsStart(
    makeTrustedDeps({
      liveArmed: true,
      callRpc: async (name, args) => {
        mutatingRpcNames.push(name);
        if (name === "rpc_eaushadhi_require_permission") {
          permissionEditFlags.push(args?.p_edit);
          throw new Error("edit permission denied");
        }
        throw new Error(`unexpected rpc ${name}`);
      },
      buildAdapters: async () => ({
        runBegin: async () => {
          beginCalls += 1;
          return { run_id: "should-not-run" };
        },
      }),
    }),
    { userConfirmed: true },
  );
  assert(denied.code === "PERMISSION_DENIED", "denied edit permission blocks Start");
  assert(denied.runBegun !== true, "edit denial never begins run");
  assert(beginCalls === 0, "no run_begin after edit-permission denial");
  assert(
    permissionEditFlags.length === 1 && permissionEditFlags[0] === true,
    "denied Start still requested p_edit=true",
  );
  assert(!mutatingRpcNames.includes("rpc_eaushadhi_worker_run_begin"), "edit denial never calls run_begin RPC");
}

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

// --- Preview controlled-page wiring + stage-failure hardening ---
{
  const depsFnMatch = indexSrc.match(
    /function buildProductDetailsTrustedDeps\([\s\S]*?\n  \}/,
  );
  assert(Boolean(depsFnMatch), "buildProductDetailsTrustedDeps function present");
  const depsFn = depsFnMatch[0];
  assert(depsFn.includes("const activePage = controlledPage"), "deps snapshot controlledPage as activePage");
  assert(!/\bpage\s*\|\|\s*null/.test(depsFn), "deps do not reference undeclared bare page || null");
  assert(!/measureConnectedPageState\(\{\s*page\s*,/.test(depsFn), "measurePageState does not pass bare page");
  assert(!/runLiveDuplicateSearch\(\s*page\s*,/.test(depsFn), "searchDuplicates does not pass bare page");
  assert(
    !/enumerateLivePermissionOptions\(\s*page\s*\)/.test(depsFn),
    "enumeratePermissionOptions does not pass bare page",
  );
  assert(depsFn.includes("page: activePage"), "deps page property uses activePage");
  assert(
    depsFn.includes("measureConnectedPageState({ page: activePage, workerState })"),
    "measurePageState wires activePage",
  );
  assert(
    depsFn.includes("runLiveDuplicateSearch(activePage, searchTerm)"),
    "searchDuplicates wires activePage",
  );
  assert(
    depsFn.includes("enumerateLivePermissionOptions(activePage)"),
    "enumeratePermissionOptions wires activePage",
  );
  assert(indexSrc.includes("PRODUCT_DETAILS_PREVIEW_FAILED"), "preview outer boundary code present");
  assert(
    indexSrc.includes('phase: "product-details-preview"'),
    "preview unexpected failures log product-details-preview phase",
  );
}

{
  const diagCalls = [];
  const pageProbeFail = await runTrustedProductDetailsPreview(
    makeTrustedDeps({
      measurePageState: async () => {
        throw new Error("evaluate boom secret-token-xyz");
      },
      reportPreviewStageFailure: (payload) => {
        diagCalls.push(payload);
      },
    }),
  );
  assert(pageProbeFail.code === "PAGE_PROBE_FAILED", "page-state probe throw => PAGE_PROBE_FAILED");
  assert(pageProbeFail.preview?.startEnabled !== true, "page probe failure keeps Start disabled");
  assert(diagCalls.length === 1, "page probe diagnostic callback invoked once");
  assert(
    diagCalls[0]?.stage === "page_state" && diagCalls[0]?.code === "PAGE_PROBE_FAILED",
    "page probe diagnostic receives stage/code",
  );
  assert(
    !JSON.stringify(pageProbeFail).includes("secret-token-xyz"),
    "page probe failure does not leak raw exception text",
  );
  assert(pageProbeFail.liveArmed === false, "page probe failure reports liveArmed false");
}

{
  const diagCalls = [];
  const dupFail = await runTrustedProductDetailsPreview(
    makeTrustedDeps({
      searchDuplicates: async () => {
        throw new Error("duplicate evaluate boom bearer abc");
      },
      reportPreviewStageFailure: (payload) => {
        diagCalls.push(payload);
      },
    }),
  );
  assert(dupFail.code === "DUPLICATE_SEARCH_FAILED", "duplicate-search throw => DUPLICATE_SEARCH_FAILED");
  assert(dupFail.preview?.startEnabled !== true, "duplicate search failure keeps Start disabled");
  assert(diagCalls.length === 1, "duplicate search diagnostic callback invoked once");
  assert(
    diagCalls[0]?.stage === "duplicate_search" &&
      diagCalls[0]?.code === "DUPLICATE_SEARCH_FAILED",
    "duplicate search diagnostic receives stage/code",
  );
  assert(
    !JSON.stringify(dupFail).includes("bearer abc"),
    "duplicate search failure does not leak raw exception text",
  );
}

{
  const diagCalls = [];
  const permFail = await runTrustedProductDetailsPreview(
    makeTrustedDeps({
      enumeratePermissionOptions: async () => {
        throw new Error("permission evaluate boom");
      },
      reportPreviewStageFailure: (payload) => {
        diagCalls.push(payload);
      },
    }),
  );
  assert(
    permFail.code === "PERMISSION_OPTIONS_FAILED",
    "permission enumeration throw => PERMISSION_OPTIONS_FAILED",
  );
  assert(permFail.preview?.startEnabled !== true, "permission options failure keeps Start disabled");
  assert(diagCalls.length === 1, "permission options diagnostic callback invoked once");
  assert(
    diagCalls[0]?.stage === "permission_options" &&
      diagCalls[0]?.code === "PERMISSION_OPTIONS_FAILED",
    "permission options diagnostic receives stage/code",
  );
}

{
  const diagCalls = [];
  const copyThrow = await runTrustedProductDetailsPreview(
    makeTrustedDeps({
      resolveApprovedCopy: async () => {
        throw new Error("resolver explode signedUrl=https://evil/x");
      },
      reportPreviewStageFailure: (payload) => {
        diagCalls.push(payload);
      },
    }),
  );
  assert(
    copyThrow.code === "APPROVED_COPY_RESOLUTION_FAILED",
    "approved-copy resolver throw => APPROVED_COPY_RESOLUTION_FAILED",
  );
  assert(copyThrow.preview?.startEnabled !== true, "approved-copy throw keeps Start disabled");
  assert(diagCalls.length === 1, "approved-copy diagnostic callback invoked once");
  assert(
    diagCalls[0]?.stage === "approved_copy" &&
      diagCalls[0]?.code === "APPROVED_COPY_RESOLUTION_FAILED",
    "approved-copy diagnostic receives stage/code",
  );
  assert(
    !JSON.stringify(copyThrow).includes("signedUrl") &&
      !JSON.stringify(copyThrow).includes("https://evil"),
    "approved-copy throw does not leak signed URL",
  );
}

{
  const diagThrowPreview = await runTrustedProductDetailsPreview(
    makeTrustedDeps({
      measurePageState: async () => {
        throw new Error("probe still fails");
      },
      reportPreviewStageFailure: () => {
        throw new Error("diagnostic callback must not break preview");
      },
    }),
  );
  assert(
    diagThrowPreview.code === "PAGE_PROBE_FAILED",
    "diagnostic callback throw still returns PAGE_PROBE_FAILED",
  );
  assert(
    diagThrowPreview.preview?.startEnabled !== true,
    "diagnostic callback throw keeps Start disabled",
  );
}

{
  assert(
    RENDERER_FORBIDDEN_OPTION_KEYS.includes("reportPreviewStageFailure"),
    "reportPreviewStageFailure is renderer-forbidden",
  );
  const forgedDiag = sanitizeRendererCommand({
    reportPreviewStageFailure: () => {
      throw new Error("renderer must never inject diagnostics");
    },
    userConfirmed: true,
  });
  assert(
    forgedDiag.forbiddenPresent.includes("reportPreviewStageFailure"),
    "sanitize marks reportPreviewStageFailure as forbidden",
  );
  assert(
    !Object.prototype.hasOwnProperty.call(forgedDiag, "reportPreviewStageFailure"),
    "sanitize does not forward reportPreviewStageFailure",
  );
  assert(
    indexSrc.includes("reportPreviewStageFailure:") &&
      indexSrc.includes('phase: "product-details-preview"'),
    "index wires trusted reportPreviewStageFailure into deps only",
  );
  assert(
    /product-details-preview[\s\S]*previewProductDetailsExecution\(productId, accessToken, \{\}\)/.test(
      ipcSrc,
    ),
    "IPC preview still forwards empty options (no diagnostic callback from renderer)",
  );
}

{
  const copyReturnFail = await runTrustedProductDetailsPreview(
    makeTrustedDeps({
      resolveApprovedCopy: async () => ({
        ok: false,
        code: "APPROVED_COPY_DOWNLOAD_FAILED",
        message: "Approved copy download HTTP 403.",
      }),
    }),
  );
  assert(
    copyReturnFail.code === "AUTHORITATIVE_EVIDENCE_MISSING" &&
      (copyReturnFail.missing || []).includes("approved_copy"),
    "structured resolver {ok:false} keeps AUTHORITATIVE_EVIDENCE_MISSING semantics",
  );
  assert(
    copyReturnFail.code !== "APPROVED_COPY_RESOLUTION_FAILED",
    "structured resolver return is not remapped to APPROVED_COPY_RESOLUTION_FAILED",
  );
}

{
  const fs = require("fs");
  const origMkdir = fs.mkdirSync;
  fs.mkdirSync = () => {
    throw new Error("EACCES /secret/user/path/approved-cache");
  };
  let cacheFail;
  try {
    cacheFail = await resolveApprovedProductCopyFile({
      productId: 262,
      accessToken: "tok",
      userDataPath: join(root, ".tmp-smoke-userdata"),
      evidence: {
        approved_product_copy_present: true,
        original_file_name: EXPECTED_APPROVED_COPY_NAME,
      },
      callRpc: async () => ({
        original_file_name: EXPECTED_APPROVED_COPY_NAME,
        storage_bucket: "eaushadhi-evidence",
        storage_path: "p/ok.pdf",
      }),
    });
  } finally {
    fs.mkdirSync = origMkdir;
  }
  assert(
    cacheFail.ok === false && cacheFail.code === "APPROVED_COPY_CACHE_FAILED",
    "approved-copy cache mkdir failure => APPROVED_COPY_CACHE_FAILED",
  );
  assert(
    !JSON.stringify(cacheFail).includes("/secret/user/path") &&
      !JSON.stringify(cacheFail).includes("EACCES"),
    "approved-copy cache failure does not expose filesystem details",
  );
}

{
  const { createEaushadhiWorker } = require(join(root, "electron/eaushadhi-worker/index.js"));
  const worker = createEaushadhiWorker({
    getUserDataPath: () => join(root, ".tmp-smoke-userdata"),
    // Factory rpcCall signature matches callWorkerRpc(accessToken, name, args).
    callRpc: async (_accessToken, name) => {
      if (name === "rpc_eaushadhi_require_permission") return { ok: true };
      if (name === "rpc_eaushadhi_worker_preflight") {
        return {
          workflow_row_version: 7,
          entry_status: "NOT_STARTED",
          is_ready_for_entry: true,
          review_status: "VERIFIED",
        };
      }
      if (name === "rpc_eaushadhi_worker_content_get") {
        // Proxy throws on post-await property access. `then` must be undefined so
        // await does not treat the result as a thenable inside the RPC try/catch.
        return new Proxy(
          {},
          {
            get(_target, prop) {
              if (prop === "then") return undefined;
              throw new Error("unexpected-secret-token-xyz bearer leak");
            },
          },
        );
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  });
  const outer = await worker.previewProductDetailsExecution(262, "a".repeat(20));
  assert(
    outer.code === "PRODUCT_DETAILS_PREVIEW_FAILED",
    "unexpected outer preview failure => PRODUCT_DETAILS_PREVIEW_FAILED",
  );
  assert(outer.message === "Product Details preview failed in the worker.", "outer preview uses safe message");
  assert(outer.preview?.startEnabled === false, "outer preview failure keeps Start disabled");
  assert(
    Array.isArray(outer.preview?.blockers) &&
      outer.preview.blockers.includes("PRODUCT_DETAILS_PREVIEW_FAILED"),
    "outer preview blockers include PRODUCT_DETAILS_PREVIEW_FAILED",
  );
  assert(
    !JSON.stringify(outer).includes("secret-token") &&
      !JSON.stringify(outer).includes("bearer leak") &&
      outer.message !== "Worker IPC failed.",
    "outer preview failure is not generic Worker IPC failed and leaks no secrets",
  );
}

{
  mutatingRpcNames = [];
  const validPreview = await runTrustedProductDetailsPreview(makeTrustedDeps());
  assert(validPreview.liveArmed === false, "valid trusted preview keeps liveArmed false");
  assert(
    validPreview.code === "FIELD_GOVERNANCE_INCOMPLETE" ||
      validPreview.ok === false ||
      (validPreview.preview?.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE") ||
      (validPreview.preview?.blockers || []).includes("LIVE_EXECUTION_NOT_ARMED"),
    "valid trusted preview still reaches normal assessment",
  );
  assert(
    !mutatingRpcNames.includes("rpc_eaushadhi_worker_run_begin") &&
      !mutatingRpcNames.includes("rpc_eaushadhi_worker_mark_entered") &&
      !mutatingRpcNames.includes("rpc_eaushadhi_worker_mark_portal_verified"),
    "Preview never calls run_begin / mark_entered / mark_portal_verified",
  );
}

{
  const forgedAuthority = await runTrustedProductDetailsPreview({
    ...makeTrustedDeps(),
    content: baseContent({
      details: {
        portal_remarks: "forged-remarks",
        portal_shelfmonth_route: "RegularAsPerClause",
      },
    }),
    reviewStatus: "VERIFIED",
    classificationVerified: true,
    isReadyForEntry: true,
    fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
    pageState: readyPage,
    duplicateSearch: noneDuplicate,
  });
  assert(
    forgedAuthority.fieldGate?.ok === false ||
      (forgedAuthority.preview?.blockers || []).includes("FIELD_GOVERNANCE_INCOMPLETE") ||
      forgedAuthority.code === "FIELD_GOVERNANCE_INCOMPLETE",
    "renderer-supplied authority keys remain ignored on trusted preview",
  );
}

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
