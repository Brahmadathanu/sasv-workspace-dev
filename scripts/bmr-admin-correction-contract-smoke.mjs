/**
 * BMR Administrative Correction — contract smoke test (Node assert script).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_CORRECTION_ROLE,
  CLIENT_SUPPORTED_OPERATIONS,
  COPY,
  HISTORY_OPERATION_FILTER_OPTIONS,
  HISTORY_RESULT_FILTER_OPTIONS,
  HISTORY_INFINITE_PAGE_SIZE,
  HISTORY_SEARCH_DEBOUNCE_MS,
  MIN_REASON_LENGTH,
  OPERATION_TYPES,
  RETIRED_OPERATION_LABEL,
  createClientRequestId,
  createCorrectionSession,
  formatExecutedByName,
  labelForOperationResult,
  labelForOperationType,
  parseSnapshotSync,
  parseValidationEvidence,
  previewSizeOutcome,
  searchAdminCorrectionHistory,
  sizesMatch,
  validateCorrectionForm,
  validateReason,
} from "../public/shared/js/bmr-admin-correction.js";
import { __historyTestHooks } from "../public/shared/js/bmr-admin-correction-history.js";

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const typesSrc = read("public/shared/js/types/supabase.ts");
const serviceSrc = read("public/shared/js/bmr-admin-correction.js");
const modalSrc = read("public/shared/js/bmr-admin-correction-modal.js");
const manageJs = read("public/shared/js/manage-bmr.js");
const manageHtml = read("public/shared/manage-bmr.html");
const sbpSrc = read("js/supply-batch-plan.js");

const RPCS = [
  "rpc_preview_bmr_admin_correction",
  "rpc_admin_correct_bmr_plan_mapping",
  "rpc_get_bmr_admin_correction_history",
];

for (const name of RPCS) {
  assert(typesSrc.includes(`${name}: {`), `Supabase types include ${name}`);
  assert(
    serviceSrc.includes(`"${name}"`) || serviceSrc.includes(`'${name}'`),
    `service calls ${name}`,
  );
}

assert(
  ADMIN_CORRECTION_ROLE === "role:manager-bmr-admin-correction",
  "exceptional permission target constant",
);

assert(
  CLIENT_SUPPORTED_OPERATIONS.length === 3 &&
    CLIENT_SUPPORTED_OPERATIONS[0] === "REMAP_BMR" &&
    CLIENT_SUPPORTED_OPERATIONS[1] === "UNLINK_BMR" &&
    CLIENT_SUPPORTED_OPERATIONS[2] === "CORRECT_BMR_SIZE",
  "supported operation list is exactly REMAP_BMR, UNLINK_BMR, CORRECT_BMR_SIZE",
);
assert(
  !Object.prototype.hasOwnProperty.call(OPERATION_TYPES, "CORRECT_BMR_NUMBER") &&
    !CLIENT_SUPPORTED_OPERATIONS.includes("CORRECT_BMR_NUMBER"),
  "CORRECT_BMR_NUMBER is absent from live operation constants/allowlist",
);
assert(
  !modalSrc.includes("bacNewBn") &&
    !modalSrc.includes("bacPanelBn") &&
    !modalSrc.includes("Proposed BN") &&
    !modalSrc.includes("Correct BMR number"),
  "no BMR-number correction form/input is rendered",
);
assert(
  !modalSrc.includes('ops.push(OPERATION_TYPES.CORRECT_BMR_NUMBER)') &&
    modalSrc.includes("CLIENT_SUPPORTED_OPERATIONS"),
  "CORRECT_BMR_NUMBER is not rendered as an interactive operation",
);
assert(
  !/\.from\(\s*["']bmr_details["']\s*\)\s*\.update\([^)]*bn/.test(serviceSrc) &&
    !/\.from\(\s*["']bmr_details["']\s*\)\s*\.update\([^)]*bn/.test(modalSrc) &&
    !serviceSrc.includes("p_new_bn: bn") &&
    !serviceSrc.includes("p_new_bn = bn"),
  "no client administrative path updates bmr_details.bn / sends corrected BN",
);
assert(
  serviceSrc.includes("p_new_bn: null") &&
    /p_new_bn:\s*null/.test(serviceSrc),
  "p_new_bn is null for supported correction submissions",
);
assert(
  !serviceSrc.includes('p_operation_type: "CORRECT_BMR_NUMBER"') &&
    !modalSrc.includes('value="CORRECT_BMR_NUMBER"'),
  "no client path submits CORRECT_BMR_NUMBER",
);

assert(
  COPY.createAndRemapGuidance.includes("Need a different BMR number?") &&
    COPY.createAndRemapGuidance.includes("Remap BMR") &&
    modalSrc.includes("createAndRemapGuidance") &&
    modalSrc.includes("bacCreateRemapGuide"),
  "create-and-remap guidance is present",
);
assert(
  COPY.remapBlockedEvidence.includes(
    "cannot be reassigned through the ordinary administrative remap workflow",
  ) && modalSrc.includes("remapBlockedEvidence"),
  "existing remap operational-evidence blocking remains",
);
assert(
  COPY.sizeSnapshotSyncNotice.includes("work-log") &&
    COPY.sizeSnapshotSyncNotice.includes("laboratory") &&
    modalSrc.includes("sizeSnapshotSyncNotice"),
  "correct-size snapshot synchronisation wording remains",
);
assert(
  COPY.bmrNumberImmutable.includes("immutable batch identity"),
  "immutable BMR number wording present",
);
assert(
  labelForOperationType("CORRECT_BMR_NUMBER") === RETIRED_OPERATION_LABEL &&
    RETIRED_OPERATION_LABEL === "BMR Number Correction — Retired",
  "retired history operation label renders safely",
);

assert(
  manageJs.includes("ADMIN_CORRECTION_ROLE") &&
    manageJs.includes("hasPermission(ADMIN_CORRECTION_ROLE"),
  "Manage BMR imports and checks exceptional permission role",
);
assert(
  serviceSrc.includes("role:manager-bmr-admin-correction"),
  "service module defines exceptional permission target",
);
assert(
  manageHtml.includes("Administrative Correction") &&
    manageHtml.includes("detailAdminCorrectBtn"),
  "Manage BMR contains Administrative Correction entry",
);
assert(
  manageJs.includes("openBmrAdminCorrectionModal") &&
    manageJs.includes("openAdminCorrectionFromDetail"),
  "Manage BMR opens shared Administrative Correction workflow",
);

assert(
  !sbpSrc.includes('rpc("force_unlink_plan_batch"') &&
    !sbpSrc.includes("rpc('force_unlink_plan_batch'") &&
    !/\.rpc\(\s*["']force_unlink_plan_batch["']/.test(sbpSrc),
  "Supply Batch Plan no longer calls force_unlink_plan_batch",
);
assert(
  !/\.rpc\(\s*["']force_unlink_plan_batch["']/.test(serviceSrc) &&
    !/\.rpc\(\s*["']force_unlink_plan_batch["']/.test(modalSrc),
  "admin-correction modules never call force_unlink_plan_batch",
);

assert(
  !/\.from\(\s*["']bmr_details["']\s*\)\s*\.(update|delete)/.test(serviceSrc) &&
    !/\.from\(\s*["']bmr_details["']\s*\)\s*\.(update|delete)/.test(modalSrc),
  "correction modules do not write bmr_details",
);
assert(
  !/\.from\(\s*["']batch_plan_batches["']\s*\)\s*\.(update|delete|insert)/.test(
    serviceSrc,
  ) &&
    !/\.from\(\s*["']batch_plan_batches["']\s*\)\s*\.(update|delete|insert)/.test(
      modalSrc,
    ),
  "correction modules do not write batch_plan_batches",
);
assert(
  !serviceSrc.includes("bmr_administrative_corrections") &&
    !modalSrc.includes("bmr_administrative_corrections"),
  "correction modules do not touch bmr_administrative_corrections table",
);

const shortReason = validateReason("short");
assert(!shortReason.ok, "reason shorter than 10 trimmed chars fails");
const okReason = validateReason("  1234567890  ");
assert(okReason.ok, "reason with 10 trimmed chars passes");
assert(MIN_REASON_LENGTH === 10, "MIN_REASON_LENGTH is 10");

assert(previewSizeOutcome(100, 100) === "retain", "exact size match => retain");
assert(
  previewSizeOutcome(100 + 1e-7, 100) === "retain",
  "size within 1e-6 => retain",
);
assert(
  previewSizeOutcome(100 + 1e-5, 100) === "auto_unlink",
  "size beyond 1e-6 => auto_unlink",
);
assert(sizesMatch(10, 10 + 1e-7), "sizesMatch tolerance holds at 1e-7");
assert(!sizesMatch(10, 10 + 1e-5), "sizesMatch rejects larger delta");

const session = createCorrectionSession();
const id1 = session.clientRequestId;
assert(typeof id1 === "string" && id1.length > 8, "session request id created");
const retryPayload = validateCorrectionForm({
  operationType: OPERATION_TYPES.UNLINK_BMR,
  reason: "Adequate reason text",
  supportingReference: "",
  impactAcknowledged: true,
  clientRequestId: id1,
  batchPlanBatchId: 42,
});
assert(retryPayload.ok, "unlink form validates");
assert(
  retryPayload.payload.p_client_request_id === id1,
  "stable request id reused in payload",
);
assert(
  retryPayload.payload.p_new_bn === null,
  "validated payload keeps p_new_bn null",
);
const retiredRejected = validateCorrectionForm({
  operationType: "CORRECT_BMR_NUMBER",
  reason: "Adequate reason text",
  impactAcknowledged: true,
  clientRequestId: id1,
  batchPlanBatchId: 42,
  newBn: "X-1",
});
assert(!retiredRejected.ok, "CORRECT_BMR_NUMBER form validation is rejected");
const id2 = createClientRequestId();
assert(id2 !== id1, "new id helper can create a different id for a new session");

assert(
  COPY.sizeMismatchWarning.includes(
    "The corrected BMR size will not match the planned batch size.",
  ) &&
    COPY.sizeMismatchWarning.includes("automatically unlinked") &&
    COPY.sizeMatchNotice.includes("mapping will be retained") &&
    COPY.unlinkNotice.includes(
      "The BMR will be removed from this planned batch.",
    ) &&
    COPY.sizeAutoUnlinkSuccess.includes("automatically unlinked") &&
    COPY.sizeAutoUnlinkSuccess.includes("planned size was preserved"),
  "required warning and success wording present",
);
assert(
  modalSrc.includes("sizeMismatchWarning"),
  "modal uses size mismatch warning",
);
assert(
  modalSrc.includes("Administrative Correction"),
  "modal title is Administrative Correction",
);

assert(
  manageJs.includes("els.editModal.bn.disabled = mapped") &&
    manageJs.includes("els.editModal.size.disabled = mapped"),
  "ordinary mapped edit lock code remains present",
);
assert(
  manageJs.includes("Mapped BMR cannot be deleted"),
  "mapped delete remains blocked",
);

assert(
  sbpSrc.includes("openBmrAdminCorrectionModal") &&
    sbpSrc.includes("OPERATION_TYPES.UNLINK_BMR") &&
    sbpSrc.includes("Administrative Correction"),
  "Supply Batch Plan governed unlink opens shared Administrative Correction workflow",
);
assert(
  sbpSrc.includes("ADMIN_CORRECTION_ROLE") && sbpSrc.includes("_canAdminCorrect"),
  "Supply Batch Plan gates admin unlink on exceptional permission",
);

assert(
  !manageJs.includes("p_limit: 500") && !manageJs.includes("p_limit:500"),
  "Manage BMR does not use global history list-badge strategy",
);

assert(
  modalSrc.includes("max-width: 520px") &&
    modalSrc.includes("height: 100%") &&
    modalSrc.includes("border-radius: 0"),
  "narrow viewport full-page modal hooks remain",
);
assert(
  modalSrc.includes("font-weight: 400") &&
    modalSrc.includes("bac-tab") &&
    modalSrc.includes("bac-identity"),
  "compact ERP typography and layout hooks remain",
);

assert(
  !serviceSrc.includes("rpc_admin_correct_bmr_plan_mapping_internal") &&
    !modalSrc.includes("rpc_admin_correct_bmr_plan_mapping_internal") &&
    !manageJs.includes("rpc_admin_correct_bmr_plan_mapping_internal") &&
    !sbpSrc.includes("rpc_admin_correct_bmr_plan_mapping_internal"),
  "client never calls retired/internal number-correction RPC",
);

/* ── Change History register ───────────────────────────────── */
const historySrc = read("public/shared/js/bmr-admin-correction-history.js");

assert(
  manageHtml.includes('data-tab="history"') &&
    manageHtml.includes('id="panel-history"') &&
    manageHtml.includes("Change History"),
  "Change History tab exists",
);
assert(
  typesSrc.includes("rpc_search_bmr_admin_correction_history: {"),
  "Supabase types include rpc_search_bmr_admin_correction_history",
);
assert(
  serviceSrc.includes("rpc_search_bmr_admin_correction_history") &&
    historySrc.includes("searchAdminCorrectionHistory"),
  "search uses only rpc_search_bmr_admin_correction_history adapter",
);
assert(
  !historySrc.includes('from("bmr_administrative_corrections")') &&
    !serviceSrc.includes('from("bmr_administrative_corrections")') &&
    !manageJs.includes('from("bmr_administrative_corrections")'),
  "no direct query of the audit table",
);
assert(
  serviceSrc.includes("p_search") &&
    serviceSrc.includes("p_date_from") &&
    serviceSrc.includes("p_date_to") &&
    serviceSrc.includes("p_operation_type") &&
    serviceSrc.includes("p_operation_result") &&
    serviceSrc.includes("p_product_id") &&
    serviceSrc.includes("p_executed_by") &&
    serviceSrc.includes("p_page") &&
    serviceSrc.includes("p_page_size"),
  "exact RPC filter mapping present in adapter",
);
assert(
  /p_executed_by:\s*null/.test(serviceSrc) &&
    historySrc.includes("p_executed_by: null") &&
    !manageHtml.includes("histFilterExecutedBy") &&
    !manageHtml.includes("Executed By UUID"),
  "p_executed_by is null from this UI with no visible UUID input",
);

/* Compact icon toolbar + infinite scroll */
assert(
  manageHtml.includes('id="histFiltersBtn"') &&
    manageHtml.includes('id="histFilterSearch"') &&
    manageHtml.includes("hist-register-toolbar") &&
    /id="histFiltersBtn"[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?histFilterBadge/.test(
      manageHtml,
    ) &&
    !/>\s*Filters\s*</.test(
      manageHtml.slice(
        manageHtml.indexOf('id="histFiltersBtn"'),
        manageHtml.indexOf('id="histFilterDrawer"'),
      ),
    ),
  "filter control is an SVG/icon-only button",
);
assert(
  manageHtml.indexOf("hist-filter-wrap") <
    manageHtml.indexOf("hist-search-wrap") &&
    manageHtml.indexOf('id="histFiltersBtn"') <
      manageHtml.indexOf('id="histFilterSearch"'),
  "filter icon is positioned before General Search",
);
assert(
  manageHtml.includes('title="Filters"') &&
    manageHtml.includes('aria-label="Filters"') &&
    manageHtml.includes('aria-expanded') &&
    manageHtml.includes('aria-controls="histFilterDrawer"'),
  "tooltip/aria-label exists",
);
assert(
  manageHtml.includes("histFilterBadge") &&
    historySrc.includes("countActiveAdvancedFilters"),
  "active-filter badge remains",
);
assert(
  !manageHtml.includes('id="histCount"') &&
    !manageHtml.includes("hist-toolbar-pager") &&
    !manageHtml.includes("records total"),
  "visible total-record count is removed",
);
assert(
  !manageHtml.includes('id="histPageSize"') &&
    !/#panel-history[\s\S]*?>Rows</.test(manageHtml),
  "page-size selector is removed",
);
assert(
  !manageHtml.includes('id="histPrevBtn"') &&
    !manageHtml.includes('id="histNextBtn"') &&
    !manageHtml.includes('id="histPageInfo"'),
  "Previous/Page/Next controls are removed",
);
assert(
  historySrc.includes("FIXED_PAGE_SIZE") &&
    (HISTORY_INFINITE_PAGE_SIZE === 50 || HISTORY_INFINITE_PAGE_SIZE === 25) &&
    historySrc.includes("p_page_size: state.fixedPageSize") &&
    !historySrc.includes("histPageSize"),
  "fixed internal page size is used",
);
assert(
  historySrc.includes("IntersectionObserver") &&
    historySrc.includes("attachSentinel") &&
    historySrc.includes("maybeLoadMore"),
  "IntersectionObserver or established infinite-scroll mechanism exists",
);
assert(
  manageHtml.includes('id="histSentinel"') &&
    historySrc.includes("histSentinel"),
  "sentinel exists",
);
assert(
  historySrc.includes("state.page + 1") &&
    historySrc.includes("p_page: page") &&
    historySrc.includes("loadMorePage"),
  "next page uses p_page + 1",
);
assert(
  historySrc.includes("insertAdjacentHTML") &&
    historySrc.includes('replace: false') &&
    historySrc.includes("acceptRows"),
  "additional rows append rather than replace",
);
assert(
  historySrc.includes("loadedIds") &&
    historySrc.includes("loadedIds.has") &&
    historySrc.includes("loadedIds.add"),
  "rows deduplicate by correction id",
);
assert(
  /loadingMore[\s\S]*return/.test(historySrc) &&
    historySrc.includes("if (state.initialLoading || state.loadingMore) return"),
  "loadingMore prevents concurrent next-page calls",
);
assert(
  historySrc.includes("resetAndFetchPage1") &&
    /applyAdvancedFilters[\s\S]*resetAndFetchPage1/.test(historySrc) &&
    /applySearchNow[\s\S]*resetAndFetchPage1/.test(historySrc) &&
    historySrc.includes("state.rows = []") &&
    historySrc.includes("loadedIds = new Set()"),
  "search/filter change resets page and loaded rows",
);
assert(
  historySrc.includes("_requestSeq") &&
    historySrc.includes("seq !== _requestSeq"),
  "stale response protection remains",
);
assert(
  historySrc.includes("appendError") &&
    historySrc.includes("Could not load more records") &&
    historySrc.includes("histAppendRetryBtn") &&
    historySrc.includes("loadMorePage"),
  "append error retains existing rows and offers retry",
);
assert(
  historySrc.includes("hasMore") &&
    historySrc.includes("recomputeHasMore") &&
    /if \(!state\.hasMore\) return/.test(historySrc),
  "hasMore stops further fetching",
);
assert(
  historySrc.includes("totalCount") &&
    historySrc.includes("totalPages") &&
    !manageHtml.includes("histCount") &&
    historySrc.includes("recomputeHasMore"),
  "total_count/total_pages are used internally only",
);
assert(
  historySrc.includes("No records match the selected filters.") &&
    historySrc.includes("No correction records exist.") &&
    historySrc.includes('emptyKind === "no-match"'),
  "initial empty and filtered-empty states remain distinct",
);
assert(
  !manageHtml.includes('id="histApplyBtn"') &&
    !/#panel-history[\s\S]*?>Apply</.test(manageHtml) &&
    !manageHtml.includes("histApplyBtn"),
  "old Apply button is absent",
);
assert(
  manageHtml.includes("hist-register-toolbar") &&
    !/id="histRegisterToolbar"[\s\S]*?id="histFilterDateFrom"/.test(
      manageHtml.split('id="histFilterDrawer"')[0],
    ) &&
    manageHtml.includes('id="histFilterDrawer"') &&
    manageHtml.includes('id="histFilterDateFrom"') &&
    manageHtml.includes('id="histFilterDateTo"'),
  "old permanent date-from/date-to inputs are absent from the header",
);
assert(
  manageHtml.includes('id="histOperationChips"') &&
    manageHtml.includes('id="histResultChips"') &&
    manageHtml.includes("hist-chip") &&
    !manageHtml.includes('id="histFilterOperation"') &&
    !manageHtml.includes('id="histFilterResult"'),
  "operation and result are selectable choices in the advanced filter panel",
);
assert(
  manageHtml.includes('id="histFilterProduct"') &&
    manageHtml.includes("histFilterDrawer") &&
    manageHtml.indexOf("histFilterDrawer") <
      manageHtml.indexOf('id="histFilterProduct"'),
  "product filter is inside the advanced filter panel",
);
assert(
  !HISTORY_OPERATION_FILTER_OPTIONS.some(
    (o) => o.value === "CORRECT_BMR_NUMBER",
  ) &&
    !HISTORY_RESULT_FILTER_OPTIONS.some(
      (o) => o.value === "BMR_NUMBER_CORRECTED_MAPPING_RETAINED",
    ) &&
    !historySrc.includes("CORRECT_BMR_NUMBER") &&
    HISTORY_OPERATION_FILTER_OPTIONS.every((o) =>
      ["REMAP_BMR", "UNLINK_BMR", "CORRECT_BMR_SIZE"].includes(o.value),
    ),
  "CORRECT_BMR_NUMBER is not present in active filter options",
);
assert(
  labelForOperationType("CORRECT_BMR_NUMBER") === RETIRED_OPERATION_LABEL &&
    labelForOperationResult("BMR_NUMBER_CORRECTED_MAPPING_RETAINED").includes(
      "Retired",
    ) &&
    historySrc.includes("hist-retired-label") &&
    !historySrc.includes("openBmrAdminCorrectionModal") &&
    !historySrc.includes("Administrative Correction"),
  "retired number-correction rendering remains defensive",
);
assert(
  historySrc.includes("SEARCH_DEBOUNCE_MS") &&
    (historySrc.includes("400") || HISTORY_SEARCH_DEBOUNCE_MS === 400) &&
    historySrc.includes("scheduleSearchApply") &&
    historySrc.includes("setTimeout"),
  "search debounce exists and uses an appropriate delay",
);
assert(
  historySrc.includes('e.key === "Enter"') &&
    historySrc.includes("applySearchNow"),
  "Enter can trigger immediate search where implemented",
);
assert(
  historySrc.includes("histSearchClear") &&
    /histSearchClear[\s\S]*applySearchNow\(""/.test(historySrc),
  "search clear triggers an immediate reset/fetch",
);
assert(
  historySrc.includes("applyAdvancedFilters") &&
    !historySrc.includes("draftFilters") &&
    !historySrc.includes("appliedFilters") &&
    !historySrc.includes("function applyFilters"),
  "existing debounce and auto-apply filters remain",
);
assert(
  typeof __historyTestHooks.countActiveAdvancedFilters === "function" &&
    __historyTestHooks.countActiveAdvancedFilters({
      dateFrom: "2026-08-05",
      dateTo: "2026-08-05",
      operationType: "REMAP_BMR",
      operationResult: "",
      productId: "12",
    }) === 3 &&
    manageHtml.includes("histFilterBadge"),
  "active advanced-filter count is correct",
);
assert(
  historySrc.includes("p_date_from: state.filters.dateFrom") &&
    historySrc.includes("p_date_to: state.filters.dateTo") &&
    manageHtml.includes("histDateTrigger") &&
    manageHtml.includes("data-hist-date-preset"),
  "date range maps to p_date_from and p_date_to",
);
assert(
  historySrc.includes("isDateRangeInvalid") &&
    __historyTestHooks.isDateRangeInvalid("2026-08-10", "2026-08-05") ===
      true &&
    /isDateRangeInvalid[\s\S]*return null/.test(
      historySrc.slice(historySrc.indexOf("async function fetchHistoryPage")),
    ),
  "invalid reversed date range does not call the RPC",
);
assert(
  historySrc.includes("searchAdminCorrectionHistory") &&
    historySrc.includes("p_page") &&
    historySrc.includes("p_page_size") &&
    !historySrc.includes(".sort("),
  "existing server pagination remains intact",
);
assert(
  formatExecutedByName({ executed_by_name: null, executed_by: null }) ===
    "Unknown user" &&
    formatExecutedByName({
      executed_by_name: null,
      executed_by: "abcdefgh-ijkl-mnop-qrst-uvwxyz012345",
    }).startsWith("abcdefgh"),
  "null executed-by name has a safe fallback",
);
assert(
  parseValidationEvidence({ validation_snapshot: null }).work_log_count ===
    null &&
    parseSnapshotSync({
      validation_snapshot: {
        snapshot_sync: {
          work_logs_updated: 2,
          lab_analyses_updated: 0,
          process_output_quantities_changed: false,
        },
      },
    }).work_logs_updated === 2,
  "snapshot parsers are defensive",
);
assert(
  historySrc.includes("Technical Audit Payload") &&
    historySrc.includes("tech.open = false") &&
    manageHtml.includes("hist-tech"),
  "technical payload is collapsed by default",
);
assert(
  historySrc.includes("Operational evidence") &&
    historySrc.includes("Snapshot synchronisation") &&
    historySrc.includes("work_logs_updated") &&
    manageHtml.includes("historyDetailModal"),
  "existing detail modal remains",
);
assert(
  manageHtml.includes("max-width: 720px") &&
    manageHtml.includes("max-width: 520px") &&
    manageHtml.includes("hist-filter-drawer") &&
    manageHtml.includes("historyDetailModal"),
  "existing responsive hooks remain",
);
assert(
  manageHtml.includes('data-tab="explore"') &&
    manageHtml.includes('data-tab="manage"') &&
    manageHtml.includes('data-tab="add"') &&
    manageHtml.includes('id="panel-explore"') &&
    manageHtml.includes('id="panel-manage"') &&
    manageHtml.includes('id="panel-add"'),
  "Explore, Manage BMR and Create BMR tabs remain intact",
);
assert(
  modalSrc.includes("rpc_get_bmr_admin_correction_history") ||
    serviceSrc.includes("rpc_get_bmr_admin_correction_history"),
  "existing contextual modal history remains",
);
assert(
  modalSrc.includes("bmr-admin-correction:completed") &&
    historySrc.includes("ensureCompletionListener") &&
    historySrc.includes("if (_completionListening) return"),
  "correction-success refresh listener cannot be registered repeatedly",
);
assert(
  typeof searchAdminCorrectionHistory === "function",
  "searchAdminCorrectionHistory export exists",
);
assert(
  __historyTestHooks.COMPLETION_EVENT === "bmr-admin-correction:completed",
  "completion event name is stable",
);
assert(
  labelForOperationResult("BMR_SIZE_CORRECTED_MAPPING_RETAINED").includes(
    "retained",
  ) &&
    labelForOperationResult(
      "BMR_SIZE_CORRECTED_AUTO_UNLINKED_SIZE_MISMATCH",
    ).includes("automatically unlinked"),
  "size-correction result labels distinguish retained vs auto-unlinked",
);
assert(
  !manageHtml.includes("CREATE TABLE") &&
    !historySrc.includes("supabase.migration") &&
    !serviceSrc.includes("ALTER TABLE bmr_administrative"),
  "no database/server changes are introduced",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll BMR admin-correction contract checks passed.");
