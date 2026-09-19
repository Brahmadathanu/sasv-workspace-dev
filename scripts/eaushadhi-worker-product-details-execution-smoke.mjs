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
  assessProductDetailsResumePreflight,
  executeProductDetails,
  executeProductDetailsResume,
  planResumeAction,
  assertPageGuards,
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
  buildLoadProductDataforLegacyListParams,
  buildLoadProductDataforLegacyListUrl,
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
const { classifySaveOutcome, SAVE_OUTCOME, createSaveMutex, parseSaveProductDataBusiness, createInPageSaveOnceScript } = require(
  join(root, "electron/eaushadhi-worker/portal-save-observe.js"),
);
const {
  PRODUCT_DETAILS_LIVE_ARM,
  isProductDetailsLiveArmedFor,
} = require(join(root, "electron/eaushadhi-worker/product-details-live-arm.js"));
const {
  buildProductDetailsLiveAdapters,
  createInPageRereadScript,
  RUN_BEGIN_RPC,
  MARK_ENTERED_RPC,
  MARK_PORTAL_VERIFIED_RPC,
} = require(join(root, "electron/eaushadhi-worker/product-details-live-adapters.js"));
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

{
  const freshAdd = assertPageGuards({
    workerState: "READY",
    origin: "https://www.e-aushadhi.gov.in",
    path: "/admin/addproductforlegacy",
    actiontype: "add",
    hiddenId: "preset-nonempty",
    staleEditState: false,
    saveDataAvailable: true,
  });
  assert(freshAdd.ok === true, "fresh Add with nonempty hiddenId passes page guards");
  assert(freshAdd.code !== "STALE_PRODUCT_ID", "fresh Add does not raise STALE_PRODUCT_ID");
}

{
  const editPage = assertPageGuards({
    workerState: "READY",
    origin: "https://www.e-aushadhi.gov.in",
    path: "/admin/addproductforlegacy",
    actiontype: "Edit",
    hiddenId: "9001",
    staleEditState: false,
    saveDataAvailable: true,
  });
  assert(editPage.ok === false && editPage.code === "NOT_ADD_MODE", "genuine Edit => NOT_ADD_MODE");
}

{
  const staleEdit = assertPageGuards({
    workerState: "READY",
    origin: "https://www.e-aushadhi.gov.in",
    path: "/admin/addproductforlegacy",
    actiontype: "add",
    hiddenId: "9001",
    staleEditState: true,
    saveDataAvailable: true,
  });
  assert(
    staleEdit.ok === false && staleEdit.code === "STALE_EDIT_STATE",
    "staleEditState true => STALE_EDIT_STATE",
  );
}

const listParams = buildLoadProductDataforLegacyListParams("Karpooradi Thailam", {
  length: 10,
  licenseid: "L1",
});
assert(listParams.search === "Karpooradi Thailam", "list params apply exact search term");
assert(listParams.pageno === 0, "list params default pageno is 0");
assert(listParams.length === 10, "list params default length is 10");
assert(listParams.order === "1,null", "list params default order is 1,null");
const listUrl = buildLoadProductDataforLegacyListUrl("../admin/LoadProductDataforLegacy", listParams);
assert(listUrl.includes("LoadProductDataforLegacy?"), "list URL uses query string");
assert(/[?&]pageno=0(?:&|$)/.test(listUrl), "list URL encodes pageno=0");
assert(/[?&]length=10(?:&|$)/.test(listUrl), "list URL encodes length");
assert(
  listUrl.includes(`search=${encodeURIComponent("Karpooradi Thailam")}`) ||
    listUrl.includes("search=Karpooradi+Thailam"),
  "list URL encodes exact Karpooradi Thailam search",
);
assert(
  /[?&]order=1%2Cnull(?:&|$)/.test(listUrl) || /[?&]order=1,null(?:&|$)/.test(listUrl),
  "list URL encodes order=1,null",
);
assert(/[?&]licenseid=L1(?:&|$)/.test(listUrl), "list URL encodes licenseid");
assert(
  buildLoadProductDataforLegacyListBody("Karpooradi Thailam", { length: 10 }).search ===
    "Karpooradi Thailam",
  "deprecated listBody helper still returns param object",
);
assert(
  buildLoadProductDataforLegacyListBody("Karpooradi Thailam").pageno === 0 &&
    buildLoadProductDataforLegacyListBody("Karpooradi Thailam").order === "1,null",
  "deprecated listBody helper inherits native pageno/order defaults",
);

const normalizedList = normalizeLoadProductDataforLegacyResponse(
  { TotalCount: 0, aaData: [] },
  "Karpooradi Thailam",
);
assert(normalizedList.mechanism === "datatable_list_post", "normalize marks datatable list mechanism");
assert(normalizedList.coverageComplete === true, "empty TotalCount=0 coverage is complete");
assert(
  evaluateDuplicateGuard(normalizedList).outcome === DUPLICATE_OUTCOME.NONE,
  "{ TotalCount, aaData } complete zero result => NONE",
);

{
  const liveShape = normalizeLoadProductDataforLegacyResponse(
    {
      TotalCount: 0,
      data: [],
      message: "Data Load Successfully",
      status: "1",
    },
    "Karpooradi Thailam",
  );
  assert(Array.isArray(liveShape.rows) && liveShape.rows.length === 0, "live-success shape maps data[] rows");
  assert(liveShape.totalCount === 0, "live-success shape maps TotalCount");
  assert(
    evaluateDuplicateGuard(liveShape).outcome === DUPLICATE_OUTCOME.NONE,
    "proven live-success TotalCount/data/status=1 => NONE",
  );
}

{
  const portalFail = normalizeLoadProductDataforLegacyResponse(
    {
      status: "0",
      message: "Something went wrong",
    },
    "Karpooradi Thailam",
  );
  const portalFailOutcome = evaluateDuplicateGuard({
    ...portalFail,
    searchApplied: true,
    source: "LoadProductDataforLegacy",
  });
  assert(
    portalFailOutcome.outcome === DUPLICATE_OUTCOME.SEARCH_INCOMPLETE ||
      portalFailOutcome.outcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
    "portal status=0 response => fail-closed",
  );
  assert(portalFailOutcome.outcome !== DUPLICATE_OUTCOME.NONE, "portal status=0 response never NONE");
}

const probeSrc = createInPageDuplicateSearchProbe.toString();
assert(!/LoadProductDataforLegacy\s*\(/.test(probeSrc), "probe source never invokes LoadProductDataforLegacy(");
assert(probeSrc.includes("../admin/LoadProductDataforLegacy"), "probe posts proven admin list endpoint");
assert(probeSrc.includes("datatable_list_post"), "probe labels datatable list mechanism");
assert(probeSrc.includes('getElementById("licenseid")'), "probe reads DOM #licenseid");
assert(
  !/licenseid\s*=\s*window\.licenseId/.test(probeSrc),
  "probe does not prefer window.licenseId as license authority",
);
assert(probeSrc.includes('contentType: "application/json"'), "probe sets application/json contentType");
assert(!probeSrc.includes("application/x-www-form-urlencoded"), "probe does not use form-urlencoded body");
assert(probeSrc.includes("pageno: 0"), "probe baseParams use pageno 0");
assert(probeSrc.includes('order: "1,null"'), "probe baseParams use order 1,null");
assert(!probeSrc.includes("pageno: 1"), "probe no longer hardcodes pageno 1");
assert(!probeSrc.includes('order: "asc"'), "probe no longer hardcodes order asc");
assert(
  !probeSrc.includes('"Karpooradi"') || probeSrc.includes("Karpooradi Thailam"),
  "probe keeps full governed search term Karpooradi Thailam",
);
{
  const posts = [];
  const fakeDoc = {
    getElementById(id) {
      if (id === "licenseid") return { value: "DOM-LIC-7" };
      return null;
    },
  };
  // Global symbol exists but must remain unused for license authority.
  const prevJq = globalThis.jQuery;
  const prevLic = globalThis.licenseId;
  const prevFn = globalThis.LoadProductDataforLegacy;
  const prevDoc = globalThis.document;
  const prevWindow = globalThis.window;
  globalThis.document = fakeDoc;
  globalThis.licenseId = "WINDOW-LIC-SHOULD-NOT-WIN";
  globalThis.LoadProductDataforLegacy = () => {
    throw new Error("global LoadProductDataforLegacy must not be called");
  };
  globalThis.window = globalThis;
  globalThis.jQuery = {
    ajax({ url, type, data, contentType, dataType, success }) {
      posts.push({ url, type, data, contentType, dataType });
      const parsed = new URL(String(url), "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
      const search = parsed.searchParams.get("search") || "";
      const length = Number(parsed.searchParams.get("length") || 10);
      const all = [
        { name: "Other Product", id: 1 },
        { name: "Karpooradi Thailam", id: 2 },
      ];
      const matches = all.filter(
        (r) => String(r.name).toLowerCase() === String(search).toLowerCase(),
      );
      const total = matches.length;
      success({
        TotalCount: total,
        aaData: matches.slice(0, length),
      });
    },
  };
  let probeResult;
  try {
    probeResult = await createInPageDuplicateSearchProbe()("Karpooradi Thailam");
  } finally {
    globalThis.jQuery = prevJq;
    globalThis.licenseId = prevLic;
    globalThis.LoadProductDataforLegacy = prevFn;
    globalThis.document = prevDoc;
    globalThis.window = prevWindow;
  }
  assert(posts.length >= 1, "DataTable list POST was issued without global LoadProductDataforLegacy call");
  assert(posts.every((p) => p.type === "POST"), "duplicate list requests are POST");
  assert(
    posts.every((p) => String(p.url).includes("LoadProductDataforLegacy?")),
    "jQuery path uses query URL",
  );
  assert(
    posts.every((p) => /[?&]pageno=0(?:&|$)/.test(String(p.url))),
    "duplicate-search URL includes encoded pageno=0",
  );
  assert(
    posts.every((p) => /[?&]length=/.test(String(p.url))),
    "duplicate-search URL includes encoded length",
  );
  assert(
    posts.every(
      (p) =>
        String(p.url).includes(`search=${encodeURIComponent("Karpooradi Thailam")}`) ||
        String(p.url).includes("search=Karpooradi+Thailam"),
    ),
    "exact search term Karpooradi Thailam in query URL",
  );
  assert(
    posts.every(
      (p) =>
        /[?&]order=1%2Cnull(?:&|$)/.test(String(p.url)) ||
        /[?&]order=1,null(?:&|$)/.test(String(p.url)),
    ),
    "duplicate-search URL includes encoded order=1,null",
  );
  assert(
    posts.every((p) => String(p.url).includes("licenseid=DOM-LIC-7")),
    "license source is DOM #licenseid value",
  );
  assert(
    posts.every((p) => !String(p.url).includes("WINDOW-LIC")),
    "window.licenseId is not used as license authority",
  );
  assert(
    posts.every((p) => p.data === undefined || p.data === null),
    "POST request contains no business fields in body",
  );
  assert(
    posts.every((p) => p.contentType === "application/json"),
    "jQuery contentType is application/json",
  );
  assert(probeResult.usedGlobalWindowFn === false, "probe reports global window fn unused");
  assert(probeResult.mechanism === "datatable_list_post", "probe result uses datatable mechanism");
  assert(probeResult.searchApplied === true, "probe applied search");
  const guarded = evaluateDuplicateGuard(probeResult);
  assert(guarded.outcome === DUPLICATE_OUTCOME.EXACT_ONE, "exact single match => EXACT_ONE");
}

{
  const posts = [];
  const fakeDoc = {
    getElementById(id) {
      if (id === "licenseid") return { value: "DOM-COV-3" };
      return null;
    },
  };
  const prevJq = globalThis.jQuery;
  const prevDoc = globalThis.document;
  const prevWindow = globalThis.window;
  const prevFn = globalThis.LoadProductDataforLegacy;
  globalThis.document = fakeDoc;
  globalThis.window = globalThis;
  globalThis.LoadProductDataforLegacy = () => {
    throw new Error("global LoadProductDataforLegacy must not be called");
  };
  globalThis.jQuery = {
    ajax({ url, type, data, contentType, success }) {
      posts.push({ url, type, data, contentType });
      const parsed = new URL(String(url), "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
      const length = Number(parsed.searchParams.get("length") || 10);
      const all = [
        { name: "Karpooradi Thailam", id: 2 },
        { name: "Karpooradi Thailam Extra", id: 3 },
      ];
      // First call uses default length=10 but intentionally returns an incomplete page.
      if (posts.length === 1) {
        success({
          TotalCount: all.length,
          data: all.slice(0, 1),
          message: "Data Load Successfully",
          status: "1",
        });
        return;
      }
      success({
        TotalCount: all.length,
        data: all.slice(0, length),
        message: "Data Load Successfully",
        status: "1",
      });
    },
  };
  let coverageProbe;
  try {
    coverageProbe = await createInPageDuplicateSearchProbe()("Karpooradi Thailam");
  } finally {
    globalThis.jQuery = prevJq;
    globalThis.document = prevDoc;
    globalThis.window = prevWindow;
    globalThis.LoadProductDataforLegacy = prevFn;
  }
  assert(posts.length === 2, "coverage refetch issues second list POST when page incomplete");
  const first = new URL(String(posts[0].url), "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
  const second = new URL(String(posts[1].url), "https://www.e-aushadhi.gov.in/admin/addproductforlegacy");
  assert(first.searchParams.get("pageno") === "0", "coverage first request pageno=0");
  assert(second.searchParams.get("pageno") === "0", "coverage refetch pageno remains 0");
  assert(first.searchParams.get("order") === "1,null", "coverage first request order=1,null");
  assert(second.searchParams.get("order") === "1,null", "coverage refetch order remains 1,null");
  assert(first.searchParams.get("search") === "Karpooradi Thailam", "coverage first search exact");
  assert(second.searchParams.get("search") === "Karpooradi Thailam", "coverage refetch search unchanged");
  assert(first.searchParams.get("licenseid") === "DOM-COV-3", "coverage first licenseid from DOM");
  assert(second.searchParams.get("licenseid") === "DOM-COV-3", "coverage refetch licenseid unchanged");
  assert(first.searchParams.get("length") === "10", "coverage first length=10");
  assert(second.searchParams.get("length") === "2", "coverage refetch only length changes to totalCount");
  assert(
    posts.every((p) => p.data === undefined || p.data === null),
    "coverage refetch posts have no business body",
  );
  assert(coverageProbe.coverageComplete === true, "coverage refetch completes when full page returned");
  assert(
    evaluateDuplicateGuard(coverageProbe).outcome === DUPLICATE_OUTCOME.AMBIGUOUS ||
      evaluateDuplicateGuard(coverageProbe).outcome === DUPLICATE_OUTCOME.EXACT_ONE,
    "coverage-complete multi-row result is classified (not NONE from incompleteness)",
  );
}

{
  const fetches = [];
  const prevFetch = globalThis.fetch;
  const prevJq = globalThis.jQuery;
  const prevDoc = globalThis.document;
  const prevWindow = globalThis.window;
  const prevFn = globalThis.LoadProductDataforLegacy;
  const prevLoc = globalThis.location;
  globalThis.jQuery = undefined;
  globalThis.location = {
    href: "https://www.e-aushadhi.gov.in/admin/addproductforlegacy",
  };
  globalThis.document = {
    getElementById(id) {
      if (id === "licenseid") return { value: "DOM-FETCH-9" };
      return null;
    },
  };
  globalThis.window = globalThis;
  globalThis.LoadProductDataforLegacy = () => {
    throw new Error("global LoadProductDataforLegacy must not be called");
  };
  globalThis.fetch = async (url, opts = {}) => {
    fetches.push({ url: String(url), opts });
    return {
      ok: true,
      async json() {
        return { TotalCount: 0, aaData: [] };
      },
    };
  };
  let fetchProbe;
  try {
    fetchProbe = await createInPageDuplicateSearchProbe()("Karpooradi Thailam");
  } finally {
    globalThis.fetch = prevFetch;
    globalThis.jQuery = prevJq;
    globalThis.document = prevDoc;
    globalThis.window = prevWindow;
    globalThis.LoadProductDataforLegacy = prevFn;
    globalThis.location = prevLoc;
  }
  assert(fetches.length >= 1, "fetch fallback issued list POST");
  assert(fetches.every((f) => f.opts.method === "POST"), "fetch fallback method is POST");
  assert(
    fetches.every((f) => f.url.includes("LoadProductDataforLegacy?")),
    "fetch fallback uses same query URL",
  );
  assert(
    fetches.every((f) => /[?&]pageno=0(?:&|$)/.test(f.url)),
    "fetch fallback uses pageno=0",
  );
  assert(
    fetches.every(
      (f) => /[?&]order=1%2Cnull(?:&|$)/.test(f.url) || /[?&]order=1,null(?:&|$)/.test(f.url),
    ),
    "fetch fallback uses order=1,null",
  );
  assert(
    fetches.every(
      (f) =>
        f.url.includes(`search=${encodeURIComponent("Karpooradi Thailam")}`) ||
        f.url.includes("search=Karpooradi+Thailam"),
    ),
    "fetch fallback keeps exact search Karpooradi Thailam",
  );
  assert(
    fetches.every((f) => f.url.includes("licenseid=DOM-FETCH-9")),
    "fetch fallback license comes from DOM #licenseid",
  );
  assert(
    fetches.every((f) => f.opts.body === undefined || f.opts.body === null || f.opts.body === ""),
    "fetch fallback has no form/business body",
  );
  assert(
    fetches.every(
      (f) =>
        f.opts.headers &&
        String(f.opts.headers["Content-Type"] || "").includes("application/json"),
    ),
    "fetch fallback uses application/json content type",
  );
  assert(
    fetches.every((f) => !String(f.opts.headers?.["Content-Type"] || "").includes("form-urlencoded")),
    "fetch fallback does not use form-urlencoded",
  );
  assert(fetchProbe.searchApplied === true, "fetch fallback marks search applied");
  assert(
    evaluateDuplicateGuard(fetchProbe).outcome === DUPLICATE_OUTCOME.NONE,
    "fetch fallback zero complete result => NONE",
  );
}

{
  const failed = evaluateDuplicateGuard({
    source: "LoadProductDataforLegacy",
    searchApplied: false,
    searchTerm: "Karpooradi Thailam",
    totalCount: null,
    rows: null,
    reason: "list_request_failed",
  });
  assert(
    failed.outcome === DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
    "request failure => SEARCH_INCOMPLETE",
  );
}

{
  const malformed = evaluateDuplicateGuard({
    source: "LoadProductDataforLegacy",
    searchApplied: true,
    searchTerm: "Karpooradi Thailam",
    totalCount: null,
    rows: null,
  });
  assert(
    malformed.outcome === DUPLICATE_OUTCOME.SEARCH_INCOMPLETE ||
      malformed.outcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
    "malformed response => fail-closed, never NONE",
  );
  assert(malformed.outcome !== DUPLICATE_OUTCOME.NONE, "malformed response is not NONE");
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
  "incomplete page vs total => COVERAGE_UNPROVEN",
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

const resumeContinuePlan = planResumeAction({
  entryStatus: "IN_PROGRESS",
  activeRunCount: 1,
  activeRun: { run_status: "RUNNING" },
  duplicateOutcome: DUPLICATE_OUTCOME.NONE,
});
assert(resumeContinuePlan.mayCreate === false, "resume never auto-creates");
assert(
  resumeContinuePlan.action === "CONTINUE_EXISTING_RUN",
  "IN_PROGRESS + 1 RUNNING + NONE => CONTINUE_EXISTING_RUN",
);
assert(resumeContinuePlan.resumeEnabled === true, "continue path enables resume");

const exactOnePlan = planResumeAction({
  activeRunCount: 1,
  duplicateOutcome: DUPLICATE_OUTCOME.EXACT_ONE,
});
assert(
  exactOnePlan.action === "READ_ONLY_RECONCILE_EXACT_ONE",
  "exact-one duplicate => READ_ONLY_RECONCILE_EXACT_ONE",
);
assert(exactOnePlan.resumeEnabled === true, "exact-one reconcile enables resume");

const inProgressStartBlocked = assessProductDetailsPreflight({
  productId: 262,
  content: baseContent({ entry_status: "IN_PROGRESS" }),
  contentHash: "hash-karpooradi-smoke-1",
  duplicateSearch: noneDuplicate,
  pageState: readyPage,
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
  authorityMode: true,
  entryStatus: "IN_PROGRESS",
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
  allowTestFieldGovernanceOverrides: true,
});
assert(inProgressStartBlocked.ok === false, "IN_PROGRESS without resume blocks ordinary start");
assert(
  inProgressStartBlocked.code === "ENTRY_NOT_STARTABLE",
  "IN_PROGRESS start preflight => ENTRY_NOT_STARTABLE",
);

const resumeRunId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const resumeBaseInput = {
  productId: 262,
  content: baseContent({ entry_status: "IN_PROGRESS" }),
  contentHash: "hash-karpooradi-smoke-1",
  finalContentHash: "hash-karpooradi-smoke-1",
  workflowRowVersion: 7,
  entryStatus: "IN_PROGRESS",
  activeRunCount: 1,
  activeRun: {
    run_id: resumeRunId,
    run_status: "RUNNING",
    start_content_hash: "hash-karpooradi-smoke-1",
  },
  duplicateSearch: noneDuplicate,
  pageState: readyPage,
  reviewStatus: "VERIFIED",
  classificationVerified: true,
  isReadyForEntry: true,
  authorityMode: true,
  userConfirmed: true,
  fieldGovernanceOverrides: GOVERNANCE_OVERRIDES,
  allowTestFieldGovernanceOverrides: true,
  permissionOptions: [{ label: "Regular", value: "7" }],
  approvedFileName: EXPECTED_APPROVED_COPY_NAME,
};

const resumePreflightOk = assessProductDetailsResumePreflight(resumeBaseInput);
assert(resumePreflightOk.ok === true, "continue resume preflight passes offline");
assert(resumePreflightOk.preview?.resumeEnabled === true, "resume preflight preview enables resume");

const resumeNoActiveRun = assessProductDetailsResumePreflight({
  ...resumeBaseInput,
  activeRunCount: 0,
  activeRun: null,
});
assert(resumeNoActiveRun.ok === false, "activeRunCount 0 blocks resume preflight");
assert(
  resumeNoActiveRun.code === "ACTIVE_RUN_INVALID",
  "zero active runs => ACTIVE_RUN_INVALID",
);

const resumeAmbiguousRuns = planResumeAction({ activeRunCount: 2, activeRun: { run_status: "RUNNING" } });
assert(
  resumeAmbiguousRuns.action === "STOP_ACTIVE_RUN_AMBIGUOUS",
  "activeRunCount > 1 blocks resume plan",
);
const resumeAmbiguousPreflight = assessProductDetailsResumePreflight({
  ...resumeBaseInput,
  activeRunCount: 2,
});
assert(resumeAmbiguousPreflight.ok === false, "assessProductDetailsResumePreflight blocks >1 active run");

const mutex = createSaveMutex();
const saveOk = classifySaveOutcome({
  invoked: true,
  invokeCount: 1,
  httpOk: true,
  businessSuccess: true,
  portalProductId: "7788",
  hiddenIdBefore: null,
  hiddenIdAfter: "7788",
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

// Audit: stale hidden #id provenance
{
  const staleHidden = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: null,
    hiddenIdBefore: "ABC",
    hiddenIdAfter: "ABC",
  });
  assert(staleHidden.outcome === SAVE_OUTCOME.AMBIGUOUS, "A: unchanged stale hidden id => AMBIGUOUS");
  assert(staleHidden.reason === "hidden_id_not_newly_established", "A: hidden_id_not_newly_established");

  const newFromNull = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: null,
    hiddenIdBefore: null,
    hiddenIdAfter: "7788",
  });
  assert(newFromNull.outcome === SAVE_OUTCOME.SUCCESS, "B: null→7788 newly established hidden id => SUCCESS");
  assert(newFromNull.portalProductId === "7788", "B: portal id is newly established after id");

  const changedHidden = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: null,
    hiddenIdBefore: "ABC",
    hiddenIdAfter: "7788",
  });
  assert(changedHidden.outcome === SAVE_OUTCOME.SUCCESS, "C: ABC→7788 newly established => SUCCESS");

  const responseWins = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: "7788",
    hiddenIdBefore: "ABC",
    hiddenIdAfter: "7788",
  });
  assert(responseWins.outcome === SAVE_OUTCOME.SUCCESS, "D: response id + matching after => SUCCESS");

  const mismatchIds = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: "7788",
    hiddenIdBefore: null,
    hiddenIdAfter: "9999",
  });
  assert(mismatchIds.outcome === SAVE_OUTCOME.AMBIGUOUS, "E: response vs after mismatch => AMBIGUOUS");

  const noNewId = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: null,
    hiddenIdBefore: null,
    hiddenIdAfter: null,
  });
  assert(noNewId.outcome === SAVE_OUTCOME.AMBIGUOUS, "F: no response id and no new hidden id => AMBIGUOUS");

  const internalId = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: "262",
    hiddenIdBefore: null,
    hiddenIdAfter: "262",
  });
  assert(internalId.outcome !== SAVE_OUTCOME.SUCCESS, "G: literal internal 262 never SUCCESS");
}

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
      hiddenIdBefore: null,
      hiddenIdAfter: "7788",
    };
  },
  markEntered: async () => ({ ok: true, workflow_row_version: 8 }),
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
  markPortalVerifiedArgs?.expectedWorkflowRowVersion === 8,
  "Start markPortalVerified uses ENTERED row version (not begin version 7)",
);
assert(
  markPortalVerifiedArgs?.compareReport?.equal === true,
  "mark_portal_verified receives equal compare report",
);
assert(
  Array.isArray(markPortalVerifiedArgs?.compareReport?.items) &&
    markPortalVerifiedArgs.compareReport.items.length > 0,
  "mark_portal_verified compare report has items",
);

{
  let resumeRunBeginCalls = 0;
  let resumeRunResumeCalls = 0;
  let resumeSaveCalls = 0;
  let resumeMarkEnteredArgs = null;
  let resumeMarkPortalVerifiedArgs = null;
  const resumeHasRunBegin = await executeProductDetailsResume(resumeBaseInput, {
    runBegin: async () => {
      resumeRunBeginCalls += 1;
      return { run_id: resumeRunId };
    },
    runResume: async () => ({ run_id: resumeRunId, workflow_row_version: 7 }),
  });
  assert(resumeHasRunBegin.code === "RESUME_HAS_RUN_BEGIN", "runBegin adapter => RESUME_HAS_RUN_BEGIN");
  assert(resumeRunBeginCalls === 0, "runBegin never invoked when structurally refused");
  assert(resumeHasRunBegin.mutated === false, "RESUME_HAS_RUN_BEGIN does not mutate");

  const resumeDrift = await executeProductDetailsResume(
    {
      ...resumeBaseInput,
      finalContentHash: "drifted-after-start",
      activeRun: {
        ...resumeBaseInput.activeRun,
        start_content_hash: "hash-karpooradi-smoke-1",
      },
    },
    {
      runResume: async () => {
        throw new Error("must not resume on drift");
      },
    },
  );
  assert(resumeDrift.code === "CONTENT_HASH_DRIFT", "resume content hash drift before mutation");
  assert(resumeDrift.mutated === false, "hash drift resume does not mutate");

  const ambiguousDuplicate = {
    source: "LoadProductDataforLegacy",
    searchApplied: true,
    searchTerm: "Karpooradi Thailam",
    totalCount: 2,
    rows: [{ name: "Karpooradi Thailam", id: "9001" }, { name: "Karpooradi Thailam", id: "9002" }],
    coverageComplete: true,
  };
  let ambiguousMutated = false;
  const resumeAmbiguousExec = await executeProductDetailsResume(
    {
      ...resumeBaseInput,
      duplicateSearch: ambiguousDuplicate,
    },
    {
      runResume: async () => {
        ambiguousMutated = true;
        return { run_id: resumeRunId };
      },
      fillForm: async () => {
        ambiguousMutated = true;
      },
    },
  );
  assert(resumeAmbiguousExec.ok === false, "ambiguous duplicate blocks resume execute");
  assert(ambiguousMutated === false, "ambiguous duplicate execute does not mutate");

  const noAttachment = await executeProductDetailsResume(resumeBaseInput, {
    runResume: async () => ({ run_id: resumeRunId, workflow_row_version: 7 }),
    fillForm: async () => ({ ok: true }),
  });
  assert(
    noAttachment.code === "APPROVED_COPY_NOT_APPLIED",
    "fillForm without approved proof => APPROVED_COPY_NOT_APPLIED",
  );
  assert(noAttachment.runResumed === true, "run_resume may succeed before attachment proof fails");

  assert(
    filenameMatchesGoverned("WRONG_NAME.pdf") === false,
    "wrong approved copy name fails governed filename match",
  );

  resumeRunResumeCalls = 0;
  resumeSaveCalls = 0;
  resumeMarkEnteredArgs = null;
  resumeMarkPortalVerifiedArgs = null;
  const resumeSuccess = await executeProductDetailsResume(resumeBaseInput, {
    runResume: async (args) => {
      resumeRunResumeCalls += 1;
      assert(args.runId === resumeRunId, "runResume receives exact runId");
      return { run_id: resumeRunId, workflow_row_version: 7 };
    },
    fillForm: async () => ({
      ok: true,
      approvedCopyProof: { applied: true, fileName: EXPECTED_APPROVED_COPY_NAME },
    }),
    saveOnce: async () => {
      resumeSaveCalls += 1;
      return {
        invoked: true,
        invokeCount: 1,
        httpOk: true,
        businessSuccess: true,
        portalProductId: "7788",
        hiddenIdBefore: null,
        hiddenIdAfter: "7788",
      };
    },
    markEntered: async (args) => {
      resumeMarkEnteredArgs = args;
      return { ok: true, workflow_row_version: 8 };
    },
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
      resumeMarkPortalVerifiedArgs = args;
      return { ok: true };
    },
  });
  assert(resumeSuccess.ok === true, "CONTINUE resume path reaches PORTAL_VERIFIED");
  assert(resumeSuccess.code === "PORTAL_VERIFIED", "resume terminal code is PORTAL_VERIFIED");
  assert(resumeSuccess.compositionExecuted === false, "resume success never executes Composition");
  assert(resumeSuccess.submitProductExecuted === false, "resume success never executes submitProduct");
  assert(resumeSuccess.runBegun === false, "resume path never calls run_begin");
  assert(resumeSuccess.runResumed === true, "resume path reports runResumed");
  assert(resumeRunResumeCalls === 1, "runResume called exactly once");
  assert(resumeSaveCalls === 1, "resume CONTINUE calls saveOnce once");
  assert(resumeMarkEnteredArgs?.runId === resumeRunId, "markEntered uses same runId");
  assert(resumeMarkPortalVerifiedArgs?.runId === resumeRunId, "markPortalVerified uses same runId");
  assert(
    resumeMarkPortalVerifiedArgs?.expectedWorkflowRowVersion === 8,
    "Resume markPortalVerified uses ENTERED row version (not resume version 7)",
  );

  const exactOneDuplicate = {
    source: "LoadProductDataforLegacy",
    searchApplied: true,
    searchTerm: "Karpooradi Thailam",
    totalCount: 1,
    rows: [{ name: "Karpooradi Thailam", id: "9001" }],
    coverageComplete: true,
  };
  let exactOneSaveCalls = 0;
  let exactOnePortalArgs = null;
  const exactOneResume = await executeProductDetailsResume(
    {
      ...resumeBaseInput,
      duplicateSearch: exactOneDuplicate,
    },
    {
      runResume: async () => ({ run_id: resumeRunId, workflow_row_version: 7 }),
      saveOnce: async () => {
        exactOneSaveCalls += 1;
        throw new Error("saveOnce must not run on EXACT_ONE reconcile");
      },
      markEntered: async () => ({ ok: true, workflow_row_version: 8 }),
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
        exactOnePortalArgs = args;
        return { ok: true };
      },
    },
  );
  assert(exactOneResume.ok === true, "EXACT_ONE reconcile can complete without Save");
  assert(exactOneSaveCalls === 0, "EXACT_ONE reconcile does not call saveOnce");
  assert(
    exactOnePortalArgs?.expectedWorkflowRowVersion === 8,
    "EXACT_ONE markPortalVerified uses ENTERED returned row version",
  );
}

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
    hiddenIdBefore: null,
    hiddenIdAfter: "7788",
  }),
  markEntered: async () => ({ ok: true, workflow_row_version: 8 }),
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

// --- ENTERED workflow row-version propagation regressions ---
{
  let startPortalArgs = null;
  let startPortalCalls = 0;
  const startRowPropagation = await executeProductDetails(
    { ...successInput, workflowRowVersion: 6 },
    {
      runBegin: async () => ({ run_id: "run-rv-start", workflow_row_version: 6 }),
      fillForm: async () => ({ ok: true }),
      saveOnce: async () => ({
        invoked: true,
        invokeCount: 1,
        httpOk: true,
        businessSuccess: true,
        portalProductId: "7788",
        hiddenIdBefore: null,
        hiddenIdAfter: "7788",
      }),
      markEntered: async () => ({ ok: true, workflow_row_version: 7 }),
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
        startPortalCalls += 1;
        startPortalArgs = args;
        return { ok: true };
      },
    },
  );
  assert(startRowPropagation.ok === true, "Start row-version regression reaches PORTAL_VERIFIED");
  assert(startPortalCalls === 1, "Start portal verified called once");
  assert(
    startPortalArgs?.expectedWorkflowRowVersion === 7,
    "Start: begin=6 entered=7 => portal verified receives 7",
  );

  let resumePortalArgs = null;
  const resumeRowPropagation = await executeProductDetailsResume(resumeBaseInput, {
    runResume: async () => ({ run_id: resumeRunId, workflow_row_version: 6 }),
    fillForm: async () => ({
      ok: true,
      approvedCopyProof: { applied: true, fileName: EXPECTED_APPROVED_COPY_NAME },
    }),
    saveOnce: async () => ({
      invoked: true,
      invokeCount: 1,
      httpOk: true,
      businessSuccess: true,
      portalProductId: "7788",
      hiddenIdBefore: null,
      hiddenIdAfter: "7788",
    }),
    markEntered: async () => ({ ok: true, workflow_row_version: 7 }),
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
      resumePortalArgs = args;
      return { ok: true };
    },
  });
  assert(resumeRowPropagation.ok === true, "Resume row-version regression reaches PORTAL_VERIFIED");
  assert(
    resumePortalArgs?.expectedWorkflowRowVersion === 7,
    "Resume: resume=6 entered=7 => portal verified receives 7",
  );
  assert(resumePortalArgs?.runId === resumeRunId, "Resume row-version path keeps same run_id");

  let missingVersionPortalCalls = 0;
  const missingEnteredVersion = await executeProductDetails(successInput, {
    runBegin: async () => ({ run_id: "run-rv-missing", workflow_row_version: 6 }),
    fillForm: async () => ({ ok: true }),
    saveOnce: async () => ({
      invoked: true,
      invokeCount: 1,
      httpOk: true,
      businessSuccess: true,
      portalProductId: "7788",
      hiddenIdBefore: null,
      hiddenIdAfter: "7788",
    }),
    markEntered: async () => ({ ok: true }),
    reread: async () => {
      throw new Error("reread must not run when ENTERED row version unproven");
    },
    markPortalVerified: async () => {
      missingVersionPortalCalls += 1;
      throw new Error("markPortalVerified must not run when ENTERED row version unproven");
    },
  });
  assert(
    missingEnteredVersion.code === "ENTERED_ROW_VERSION_UNPROVEN",
    "missing entered workflow row version fail-closes",
  );
  assert(missingVersionPortalCalls === 0, "missing entered version does not call markPortalVerified");

  const executorSrcRv = readFileSync(
    join(root, "electron/eaushadhi-worker/product-details-executor.js"),
    "utf8",
  );
  assert(
    !/workflow_row_version\s*\+\s*1|workflowRowVersion\s*\+\s*1/.test(executorSrcRv),
    "executor does not client-side +1 workflow row version",
  );
  assert(
    executorSrcRv.includes("ENTERED_ROW_VERSION_UNPROVEN"),
    "executor defines ENTERED_ROW_VERSION_UNPROVEN fail-closed code",
  );
  assert(
    executorSrcRv.includes("extractEnteredWorkflowRowVersion"),
    "executor uses extractEnteredWorkflowRowVersion helper",
  );
}

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
    attachmentFileName: null,
    attachmentRereadUnavailable: true,
  },
  { approvedCopyRereadUnavailable: true },
);
assert(compareMatch.overall === OVERALL_COMPARE.MATCH, "14. remarks/shelfmonth compare on reread MATCH");
assert(toMarkPortalVerifiedReport(compareMatch).equal === true, "portal_verified report equal");

{
  const emptyFileInput = compareProductDetailsReread(
    {
      name: "Karpooradi Thailam",
      type: "120",
      categoryId: "278",
      subTypeId: "274",
      drugs: "NO",
      attachmentFileName: EXPECTED_APPROVED_COPY_NAME,
    },
    {
      name: "Karpooradi Thailam",
      type: "120",
      categoryId: "278",
      subTypeId: "274",
      drugs: "NO",
      indications: [],
      attachmentFileName: null,
      attachmentRereadUnavailable: true,
    },
    { approvedCopyRereadUnavailable: true },
  );
  assert(
    emptyFileInput.overall === OVERALL_COMPARE.MATCH,
    "approved-copy reread unavailable does not false-fail MATCH",
  );
  const attachItem = emptyFileInput.items.find((i) => i.path === "attachment.fileName");
  assert(
    attachItem?.normalization_applied === "fill_time_proven_reread_unavailable",
    "approved-copy marked fill-time proven when reread unavailable",
  );
}

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
assert(
  PRODUCT_DETAILS_LIVE_ARM.enabled === true && isProductDetailsLiveArmedFor(262) === true,
  "Phase B live arm is enabled for product 262",
);
assert(
  indexSrc.includes("isProductDetailsLiveArmedFor") &&
    indexSrc.includes("buildProductDetailsLiveAdapters"),
  "index wires live arm gate and adapter builder",
);
assert(!indexSrc.includes("rpc_eaushadhi_worker_run_begin"), "index source does not embed run_begin RPC name");
assert(!/mark_entered|mark_portal_verified/.test(indexSrc), "index source does not embed mark_* RPC names");
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
  ipcSrc.includes("PRODUCT_DETAILS_RESUME") || ipcSrc.includes("product-details-resume"),
  "IPC defines PRODUCT_DETAILS_RESUME channel",
);
assert(
  /product-details-resume[\s\S]*userConfirmed: payload\?\.userConfirmed === true/.test(ipcSrc),
  "IPC resume forwards only userConfirmed",
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
assert(preloadSrc.includes("resumeProductDetails:"), "preload exposes resumeProductDetails");
assert(
  preloadSrc.includes("userConfirmed: options?.userConfirmed === true"),
  "preload start sends only userConfirmed",
);
assert(
  /resumeProductDetails:[\s\S]*userConfirmed: options\?\.userConfirmed === true/.test(preloadSrc),
  "preload resume sends only userConfirmed",
);
assert(!preloadSrc.includes("...(options"), "preload does not spread renderer options");
assert(!/evaluate\s*:/.test(preloadSrc), "preload does not expose evaluate");

const controlSrc = readFileSync(join(root, "public/shared/js/eaushadhi-review-control.js"), "utf8");
assert(controlSrc.includes("Start Product Details"), "Review UI has Start Product Details");
assert(controlSrc.includes("btnWorkerProductDetailsResume"), "Review UI has Resume Product Details button");
assert(controlSrc.includes("productDetailsConfirmBackdrop"), "Review UI has productDetailsConfirm modal");
assert(controlSrc.includes("resumeWorkerProductDetails"), "Review UI imports resumeWorkerProductDetails");
assert(
  !/async function submitWorkerProductDetailsStart[\s\S]*?window\.confirm/.test(controlSrc),
  "Start flow does not use window.confirm",
);
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
const resumeSpoof = sanitizeRendererCommand({
  run_id: resumeRunId,
  workflowRowVersion: 999,
  contentHash: "forged-hash",
  userConfirmed: true,
});
assert(resumeSpoof.forbiddenPresent.includes("run_id"), "sanitize strips run_id");
assert(
  resumeSpoof.forbiddenPresent.includes("workflowRowVersion"),
  "sanitize strips workflowRowVersion",
);
assert(resumeSpoof.forbiddenPresent.includes("contentHash"), "sanitize strips contentHash");
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

// --- Phase B live arm (product 262 only) focused coverage ---
{
  assert(
    JSON.stringify(PRODUCT_DETAILS_LIVE_ARM.productIds) === JSON.stringify([262]),
    "productIds exactly [262]",
  );
  assert(FIRST_CONTROLLED_PRODUCT_ID === 262, "FIRST_CONTROLLED_PRODUCT_ID remains 262");
  assert(isProductDetailsLiveArmedFor(999) === false, "non-262 never armed");
  assert(isProductDetailsLiveArmedFor(262) === true, "262 is armed when enabled=true");

  let adapterBuildOk = false;
  let adapterBuildError = null;
  try {
    const adapters = buildProductDetailsLiveAdapters({
      page: { evaluate: async () => null, $: async () => null },
      callRpc: async () => {
        throw new Error("adapter construction must not call portal/RPC");
      },
    });
    adapterBuildOk =
      adapters &&
      typeof adapters.runBegin === "function" &&
      typeof adapters.fillForm === "function" &&
      typeof adapters.saveOnce === "function" &&
      typeof adapters.markEntered === "function" &&
      typeof adapters.reread === "function" &&
      typeof adapters.markPortalVerified === "function";
  } catch (error) {
    adapterBuildError = error;
  }
  assert(adapterBuildOk === true && adapterBuildError == null, "live adapters construct under offline mocks when armed");
  assert(adapterBuildError == null, "no portal call is made during adapter-construction test");

  const liveAdapterSrc = readFileSync(
    join(root, "electron/eaushadhi-worker/product-details-live-adapters.js"),
    "utf8",
  );
  assert(liveAdapterSrc.includes(RUN_BEGIN_RPC), "live adapters declare run_begin RPC");
  assert(liveAdapterSrc.includes(MARK_ENTERED_RPC), "live adapters declare mark_entered RPC");
  assert(liveAdapterSrc.includes(MARK_PORTAL_VERIFIED_RPC), "live adapters declare mark_portal_verified RPC");
  assert(liveAdapterSrc.includes('mode === "resume"'), "live adapters branch on resume mode");
  assert(/if \(mode === "resume"\)[\s\S]*runResume/.test(liveAdapterSrc), "resume mode exposes runResume");
  assert(liveAdapterSrc.includes("APPROVED_COPY_NOT_APPLIED"), "fillForm enforces APPROVED_COPY_NOT_APPLIED");
  assert(liveAdapterSrc.includes("GetproductDataUpdate"), "reread uses GetproductDataUpdate");
  assert(!/submitProduct\s*\(/.test(liveAdapterSrc), "live adapters never call submitProduct(");
  assert(!/composition/i.test(liveAdapterSrc) || liveAdapterSrc.includes("compositionTitle"), "no Composition mutation adapter");
  assert(createInPageRereadScript().includes("GetproductDataUpdate"), "reread script names GetproductDataUpdate");
  assert(createInPageSaveOnceScript().includes("window.SaveData"), "save script uses page-native SaveData");
  assert(!createInPageSaveOnceScript().includes("http.request"), "save script is not Node HTTP");

  const parsedOk = parseSaveProductDataBusiness({
    status: "1",
    message: "Saved",
    id: "99001",
  });
  assert(parsedOk.businessSuccess === true && parsedOk.portalProductId === "99001", "business success + response id parsed");

  const parsedFail = parseSaveProductDataBusiness({
    status: "0",
    message: "Something went wrong",
  });
  assert(parsedFail.businessFailure === true, "business failure parsed from status 0");

  const noId = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: null,
    hiddenIdBefore: null,
    hiddenIdAfter: null,
  });
  assert(noId.outcome === SAVE_OUTCOME.AMBIGUOUS, "business success without portal id is not SUCCESS");

  const httpOnly = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: null,
    portalProductId: null,
  });
  assert(httpOnly.outcome === SAVE_OUTCOME.AMBIGUOUS, "HTTP success without business success is not ENTERED-eligible");

  const bizFail = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: false,
    businessFailure: true,
    portalProductId: null,
  });
  assert(bizFail.outcome === SAVE_OUTCOME.FAILURE, "portal business failure classified FAILURE");

  const joint = classifySaveOutcome({
    invoked: true,
    invokeCount: 1,
    httpOk: true,
    businessSuccess: true,
    portalProductId: "88001",
    hiddenIdBefore: null,
    hiddenIdAfter: "88001",
  });
  assert(joint.outcome === SAVE_OUTCOME.SUCCESS, "business success + proven id => SUCCESS");

  let markEnteredCalls = 0;
  const noPortalIdRun = await executeProductDetails(successInput, {
    runBegin: async () => ({ run_id: "run-noid-1", workflow_row_version: 7 }),
    fillForm: async () => ({ ok: true }),
    saveOnce: async () => ({
      invoked: true,
      invokeCount: 1,
      httpOk: true,
      businessSuccess: true,
      portalProductId: null,
      hiddenIdBefore: "STALE-PREEXISTING",
      hiddenIdAfter: "STALE-PREEXISTING",
    }),
    markEntered: async () => {
      markEnteredCalls += 1;
    },
  });
  assert(noPortalIdRun.ok === false, "stale hidden id does not complete");
  assert(markEnteredCalls === 0, "stale hidden id never marks ENTERED");
  assert(noPortalIdRun.requiresReadOnlyReconciliation === true, "missing portal id requires reconcile");

  markEnteredCalls = 0;
  const fakeInternalId = await executeProductDetails(successInput, {
    runBegin: async () => ({ run_id: "run-fake-262", workflow_row_version: 7 }),
    fillForm: async () => ({ ok: true }),
    saveOnce: async () => ({
      invoked: true,
      invokeCount: 1,
      httpOk: true,
      businessSuccess: true,
      portalProductId: "262",
      hiddenIdBefore: null,
      hiddenIdAfter: "262",
    }),
    markEntered: async () => {
      markEnteredCalls += 1;
    },
  });
  assert(
    fakeInternalId.code === "SAVE_AMBIGUOUS" || fakeInternalId.code === "PORTAL_ID_UNPROVEN",
    "internal product id 262 cannot satisfy portal id",
  );
  assert(markEnteredCalls === 0, "renderer/internal 262 id never marks ENTERED");

  let saveRetry = 0;
  const ambSave = await executeProductDetails(successInput, {
    runBegin: async () => ({ run_id: "run-amb-1", workflow_row_version: 7 }),
    fillForm: async () => ({ ok: true }),
    saveOnce: async () => {
      saveRetry += 1;
      return {
        invoked: true,
        invokeCount: 1,
        httpOk: true,
        businessSuccess: null,
        portalProductId: null,
        hiddenIdBefore: null,
        hiddenIdAfter: null,
      };
    },
  });
  assert(ambSave.code === "SAVE_AMBIGUOUS", "ambiguous save stops");
  assert(saveRetry === 1, "ambiguous save does not retry SaveData");
  assert(ambSave.requiresReadOnlyReconciliation === true, "ambiguous save requires reconcile");

  let order = [];
  await executeProductDetails(successInput, {
    runBegin: async () => {
      order.push("run_begin");
      return { run_id: "run-order-1", workflow_row_version: 7 };
    },
    fillForm: async () => {
      order.push("fill");
      return { ok: true };
    },
    saveOnce: async () => {
      order.push("save");
      return {
        invoked: true,
        invokeCount: 1,
        httpOk: true,
        businessSuccess: true,
        portalProductId: "9001",
        hiddenIdBefore: null,
        hiddenIdAfter: "9001",
      };
    },
    markEntered: async () => {
      order.push("entered");
      return { ok: true, workflow_row_version: 8 };
    },
    reread: async () => {
      order.push("reread");
      return {
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
        attachmentFileName: null,
        attachmentRereadUnavailable: true,
      };
    },
    markPortalVerified: async () => {
      order.push("verified");
      return { ok: true };
    },
  });
  assert(
    order.join(",") === "run_begin,fill,save,entered,reread,verified",
    "run_begin precedes first DOM mutation and retained reread precedes PORTAL_VERIFIED",
  );

  // Deterministic reread completion (offline harness around in-page script)
  {
    const rereadSrc = createInPageRereadScript();
    assert(rereadSrc.includes("reread_load_timeout"), "reread script has bounded load timeout");
    assert(rereadSrc.includes("reread_requested_id_mismatch"), "reread script proves requested id");
    assert(rereadSrc.includes("GetproductDataUpdate"), "reread observes GetproductDataUpdate");
    assert(!rereadSrc.includes("setTimeout(r, 400)"), "reread no longer relies on fixed 400ms sleep alone");

    async function runRereadHarness({ settleDelayMs, httpStatus, returnedHiddenId, requestedId }) {
      const prev = {
        XMLHttpRequest: globalThis.XMLHttpRequest,
        document: globalThis.document,
        window: globalThis.window,
        fetch: globalThis.fetch,
      };
      class FakeXHR {
        open(_m, url) {
          this.__sasvRereadUrl = url;
        }
        addEventListener(evt, cb) {
          this[`_${evt}`] = cb;
        }
        send() {
          setTimeout(() => {
            this.status = httpStatus;
            if (this._loadend) this._loadend();
          }, settleDelayMs);
        }
      }
      globalThis.XMLHttpRequest = FakeXHR;
      globalThis.document = {
        querySelector(sel) {
          if (sel === "#id") return { value: returnedHiddenId };
          if (sel === "#name") return { value: "Karpooradi Thailam" };
          if (sel === "#type") return { value: "120" };
          if (sel === "#categoryId") return { value: "278" };
          if (sel === "#subTypeId") return { value: "274" };
          if (sel === "#permissionPurpose") {
            return {
              value: "7",
              selectedIndex: 0,
              options: [{ textContent: "Regular" }],
            };
          }
          if (sel === "#compositionTitle") return { value: "For 10 mL" };
          if (sel === "#disease") return { value: "Sandhirujah, Śōpham" };
          if (sel === "#drugsValue") return { value: "" };
          if (sel === "#remarks") return { value: "x" };
          if (sel === "#month") return { value: "-1" };
          if (sel === "#actiontype" || sel === '[name="actiontype"]') return { value: "edit" };
          if (sel === 'input[name="shelfmonth"]:checked') return { value: "RegularAsPerClause" };
          if (sel === "select#indications") return { options: [] };
          return null;
        },
        getElementById(id) {
          if (id === "drug_no") return { checked: true };
          if (id === "drug_yes") return { checked: false };
          if (id === "id") return { value: returnedHiddenId };
          return null;
        },
      };
      globalThis.window = {
        GetproductDataUpdate() {
          const xhr = new FakeXHR();
          xhr.open("POST", "../admin/GetproductDataUpdate");
          xhr.send();
        },
      };
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(`${rereadSrc}; return __sasvRereadProductDetails;`)();
        return await fn(requestedId);
      } finally {
        globalThis.XMLHttpRequest = prev.XMLHttpRequest;
        globalThis.document = prev.document;
        globalThis.window = prev.window;
        globalThis.fetch = prev.fetch;
      }
    }

    const slowOk = await runRereadHarness({
      settleDelayMs: 120,
      httpStatus: 200,
      returnedHiddenId: "9001",
      requestedId: "9001",
    });
    assert(slowOk.ok === true, "slow async GetproductDataUpdate is awaited to completion");
    assert(slowOk.hiddenId === "9001", "requested portal id proven on reread snapshot");

    const timedOut = await runRereadHarness({
      settleDelayMs: 20000,
      httpStatus: 200,
      returnedHiddenId: "9001",
      requestedId: "9001",
    });
    assert(timedOut.ok === false && timedOut.reason === "reread_load_timeout", "timeout => reread failure");

    const wrongId = await runRereadHarness({
      settleDelayMs: 20,
      httpStatus: 200,
      returnedHiddenId: "1111",
      requestedId: "9001",
    });
    assert(
      wrongId.ok === false && wrongId.reason === "reread_requested_id_mismatch",
      "wrong returned id => reread failure",
    );
  }

  let fillBeforeBegin = false;
  const blockedPreflight = await executeProductDetails(
    {
      ...successInput,
      duplicateSearch: {
        source: "LoadProductDataforLegacy",
        searchApplied: true,
        searchTerm: "Karpooradi Thailam",
        totalCount: 1,
        rows: [{ name: "Karpooradi Thailam" }],
        coverageComplete: true,
      },
    },
    {
      runBegin: async () => {
        throw new Error("run_begin must not run");
      },
      fillForm: async () => {
        fillBeforeBegin = true;
      },
    },
  );
  assert(blockedPreflight.runBegun === false, "duplicate at Start blocks before run_begin");
  assert(fillBeforeBegin === false, "duplicate at Start blocks before DOM mutation");

  const wrongOrigin = assertPageGuards({
    ...readyPage,
    origin: "https://evil.example",
  });
  assert(wrongOrigin.ok === false && wrongOrigin.code === "WRONG_ORIGIN", "wrong origin blocks before run_begin");

  const wrongPath = assertPageGuards({
    ...readyPage,
    path: "/admin/other",
  });
  assert(wrongPath.ok === false && wrongPath.code === "WRONG_PATH", "wrong path blocks before run_begin");

  const editMode = assertPageGuards({
    ...readyPage,
    actiontype: "edit",
  });
  assert(editMode.ok === false && editMode.code === "NOT_ADD_MODE", "Edit mode blocks before run_begin");

  const liveArmedInject = sanitizeRendererCommand({
    liveArmed: true,
    portalProductId: "999",
    productIds: [262],
    userConfirmed: true,
  });
  assert(liveArmedInject.userConfirmed === true, "sanitize keeps userConfirmed only");
  assert(
    liveArmedInject.forbiddenPresent.includes("liveArmed") &&
      liveArmedInject.forbiddenPresent.includes("portalProductId"),
    "renderer cannot inject live arm or portal product id",
  );

  const fillSrc = createInPageFillScript();
  assert(fillSrc.includes("setSelectByValue"), "fill script uses exact select value sets");
  assert(!/submitProduct/.test(fillSrc), "fill script has no submitProduct");
  assert(!/SaveComposition|addcomposition/i.test(fillSrc), "fill script has no Composition mutation");

  assert(planResumeAction({ runStatus: "ENTERED" }).mayCreate === false, "resume mayCreate false after ENTERED");
  assert(
    !/SUBMITTED|mark_submitted|submitProduct\s*\(/.test(
      readFileSync(join(root, "electron/eaushadhi-worker/product-details-executor.js"), "utf8"),
    ),
    "SUBMITTED / submitProduct unreachable from executor",
  );

  const controlSrcPhaseA = readFileSync(
    join(root, "public/shared/js/eaushadhi-review-control.js"),
    "utf8",
  );
  assert(controlSrcPhaseA.includes("Will NOT add Composition"), "UI confirm mentions no Composition");
  assert(controlSrcPhaseA.includes("Will NOT final-submit"), "UI confirm mentions no final-submit");
  assert(
    controlSrcPhaseA.includes("Product ${FIRST_CONTROLLED_PRODUCT_ID}"),
    "UI confirm mentions Product 262 via FIRST_CONTROLLED_PRODUCT_ID",
  );
  assert(
    controlSrcPhaseA.includes("APPROVED_PRODUCT_COPY_V01"),
    "UI confirm mentions governed V01 approved copy attachment",
  );
  assert(
    controlSrcPhaseA.includes("openProductDetailsConfirmModal"),
    "UI uses governed modal instead of window.confirm",
  );
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Product Details execution smokes passed (offline).");
