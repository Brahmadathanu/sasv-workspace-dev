/* analysis-workspace.js
 * Lab ERP — Analysis Workspace Module
 *
 * Loads a single analysis by numeric bigint ID (URL param: ?id=<number>)
 * and provides full lifecycle execution:
 *   - Result entry (via fn_save_analysis_result RPC)
 *   - Reference capture and one-time exception (via confirmed RPCs)
 *   - Outsourced result source editing (via fn_upsert_outsourced_report_for_result)
 *   - Compliance badges
 *   - Validation summary
 *   - Workflow action bar (permission-gated, fully wired to confirmed RPCs)
 *   - Debounced auto-save (300 ms)
 *   - COA-generated read-only lock
 */

import { supabase, labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── Constants ──────────────────────────────────────────────────────────────────
const MODULE_ID = "analysis-workspace";
const DEBOUNCE_MS = 300;

// ── Result-choice helpers ──────────────────────────────────────────────────────

function normText(value) {
  return String(value ?? "").trim();
}

function pushUnique(list, value) {
  const v = normText(value);
  if (!v) return;
  const exists = list.some((x) => x.toLowerCase() === v.toLowerCase());
  if (!exists) list.push(v);
}

function getExpectedText(row) {
  return (
    normText(row.text_value_snapshot) || normText(row.spec_display_snapshot)
  );
}

/**
 * Build the ordered choice list for a dropdown result input.
 * Uses result_kind_snapshot (and spec_type_snapshot for future use) to
 * determine which standard options to include, always deduplicating.
 * @param {object} row  A v_analysis_result_entry row
 * @returns {string[]}  Ordered unique choice labels
 */
function buildChoiceList(row) {
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  // spec_type informs preferred input mode (numeric vs text); retained here
  // for future per-specType option customisation (see requirement §5).
  const specType = String(row.spec_type_snapshot || "").toUpperCase(); // eslint-disable-line no-unused-vars
  const current = normText(row.result_text);
  const expected = getExpectedText(row);
  const choices = [];

  pushUnique(choices, expected);

  if (kind === "PASS_FAIL") {
    [
      "Absent",
      "Present",
      "Pass",
      "Fail",
      "Complies",
      "Does Not Comply",
    ].forEach((v) => pushUnique(choices, v));
  } else if (kind === "BOOLEAN") {
    ["Yes", "No", "Pass", "Fail", "Complies", "Does Not Comply"].forEach((v) =>
      pushUnique(choices, v),
    );
  } else {
    // TEXT and everything else
    [
      "Complies",
      "Does Not Comply",
      "Characteristic",
      "Other / Manual Entry",
    ].forEach((v) => pushUnique(choices, v));
  }

  // Ensure any previously-saved value that isn't in the generated list is still selectable
  pushUnique(choices, current);

  return choices;
}

/** Workflow action codes that map to DB function parameter values */
const ACTION_CODES = {
  submitScrutiny: "SUBMIT_FOR_SCRUTINY",
  passScrutiny: "PASS_SCRUTINY",
  approveCoa: "APPROVE_FOR_COA",
  issueCoa: "ISSUE_COA",
  returnForCorrection: "RETURN_FOR_CORRECTION",
  reopenAfterApproval: "REOPEN_AFTER_APPROVAL",
};

const ANALYSIS_ACTION_CODES = [
  "ENTER_RESULT",
  "CREATE_REFERENCE_EXCEPTION",
  "SUBMIT_FOR_SCRUTINY",
  "PASS_SCRUTINY",
  "RETURN_FOR_CORRECTION",
  "APPROVE_FOR_COA",
  "REOPEN_AFTER_APPROVAL",
  "ISSUE_COA",
];

const PERMISSION_DENIED_MESSAGE =
  "You do not have permission to perform this action at the current workflow stage.";
const PERMISSION_VERIFY_FAILED_MESSAGE =
  "Could not verify workflow permissions. Actions are disabled for safety.";

const ANALYSIS_QUEUE_PAGE = "lab-analysis-queue.html";

function navigateToAnalysisQueue() {
  if (typeof Platform?.navigate === "function") {
    Platform.navigate(ANALYSIS_QUEUE_PAGE);
    return;
  }
  try {
    window.location.href = ANALYSIS_QUEUE_PAGE;
  } catch {
    /* ignore */
  }
}

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const pageSubtitle = $("pageSubtitle");
const readonlyBanner = $("readonlyBanner");
const hdrRegisterNo = $("hdrRegisterNo");
const hdrAnalysisId = $("hdrAnalysisId");
const hdrPhysicalRef = $("hdrPhysicalRef");
const hdrItemName = $("hdrItemName");
const hdrBatch = $("hdrBatch");
const hdrStatus = $("hdrStatus");
const hdrMode = $("hdrMode");
const hdrSampleDate = $("hdrSampleDate");
const resultsBody = $("resultsBody");
const mobileResultsList = $("mobileResultsList");
const mobileEditorSheetOverlay = $("mobileEditorSheetOverlay");
const mobileEditorSheet = $("mobileEditorSheet");
const mobileEditorTitle = $("mobileEditorTitle");
const mobileEditorSubtitle = $("mobileEditorSubtitle");
const mobileEditorBody = $("mobileEditorBody");
const mobileEditorCloseBtn = $("mobileEditorCloseBtn");
const mobileEditorPrevBtn = $("mobileEditorPrevBtn");
const mobileEditorNextBtn = $("mobileEditorNextBtn");
const mobileEditorCounter = $("mobileEditorCounter");
const vpMissing = $("vpMissing");
const vpFailed = $("vpFailed");
const vpNotEval = $("vpNotEval");
const vpRefMissing = $("vpRefMissing");
const vpLocks = $("vpLocks");
const btnSubmitScrutiny = $("btnSubmitScrutiny");
const btnPassScrutiny = $("btnPassScrutiny");
const btnApproveForCoa = $("btnApproveForCoa");
const btnIssueCoa = $("btnIssueCoa");
const btnReturnForCorrection = $("btnReturnForCorrection");
const btnReopenAfterApproval = $("btnReopenAfterApproval");
const btnSyncFromSpec = $("btnSyncFromSpec");
const btnAddOutsourcedTest = $("btnAddOutsourcedTest");
const btnViewCoa = $("btnViewCoa");
const actionBarStatus = $("actionBarStatus");
const refreshBtn = $("refreshBtn");
const btnBackToAnalysisQueue = $("btnBackToAnalysisQueue");
const homeBtn = $("homeBtn");
const toastContainer = $("toastContainer");
const loadingOverlay = $("loadingOverlay");

// TOLERANCE reference proposals require extended RPC params (server-side support).
const REFERENCE_PROPOSAL_SUPPORTS_TOLERANCE = true;

let refToleranceUomRows = [];
const referenceModal = $("referenceModal");
const refModalTitle = $("refModalTitle");
const refModalSub = $("refModalSub");
const refSpecTypeSelect = $("refSpecTypeSelect");
const refMinValueField = $("refMinValueField");
const refMinValueInput = $("refMinValueInput");
const refMaxValueField = $("refMaxValueField");
const refMaxValueInput = $("refMaxValueInput");
const refExactValueField = $("refExactValueField");
const refExactValueInput = $("refExactValueInput");
const refToleranceField = $("refToleranceField");
const refTargetValueInput = $("refTargetValueInput");
const refToleranceValueField = $("refToleranceValueField");
const refToleranceValueInput = $("refToleranceValueInput");
const refToleranceUomField = $("refToleranceUomField");
const refToleranceUomSelect = $("refToleranceUomSelect");
const refTextValueField = $("refTextValueField");
const refTextValueInput = $("refTextValueInput");
const refPassFailValueField = $("refPassFailValueField");
const refPassFailValueSelect = $("refPassFailValueSelect");
const refUomDisplayInput = $("refUomDisplayInput");
const refDisplayPreviewInput = $("refDisplayPreviewInput");
const refScopeAnalysisOnly = $("refScopeAnalysisOnly");
const refScopeProduct = $("refScopeProduct");
const refScopeFamily = $("refScopeFamily");
const refNoteInput = $("refNoteInput");
const btnAddException = $("btnAddException");
const btnRefCancel = $("btnRefCancel");
const btnRefSave = $("btnRefSave");

// Reference source capture
const REF_SOURCE_TYPE_DEFAULT = "IN_HOUSE_STANDARD";
const REF_SOURCE_SEARCH_DEBOUNCE_MS = 300;
const REF_SOURCE_BIBLIO_TYPES = new Set(["API", "BOOK", "MONOGRAPH"]);

const refSourceSection = $("refSourceSection");
const refSourceTypeSelect = $("refSourceTypeSelect");
const refSourceModeExisting = $("refSourceModeExisting");
const refSourceModeCreate = $("refSourceModeCreate");
const refSourceExistingPanel = $("refSourceExistingPanel");
const refSourceCreatePanel = $("refSourceCreatePanel");
const refSourceSearchInput = $("refSourceSearchInput");
const refSourceSearchStatus = $("refSourceSearchStatus");
const refSourceResultsList = $("refSourceSearchResults");
const refSourceSelectedSummary = $("refSourceSelectedSummary");
const refSourceSelectedLabel = $("refSourceSelectedLabel");
const refSourceClearSelection = $("refSourceClearSelection");
const refSourceCreateDisplayNameField = $("refSourceCreateDisplayNameField");
const refSourceCreateDisplayName = $("refSourceCreateDisplayName");
const refSourceInHouseFields = $("refSourceInHouseFields");
const refSourceInHouseCode = $("refSourceInHouseCode");
const refSourcePaperFields = $("refSourcePaperFields");
const refSourceDoiInput = $("refSourceDoiInput");
const btnRefSourceDoiLookup = $("btnRefSourceDoiLookup");
const refSourceCitationPreviewWrap = $("refSourceCitationPreviewWrap");
const refSourceCitationPreviewText = $("refSourceCitationPreviewText");
const refSourceCreateCitationField = $("refSourceCreateCitationField");
const refSourceCreateCitation = $("refSourceCreateCitation");
const refSourceDetailFields = $("refSourceDetailFields");
const refSourceCreateSourceTitle = $("refSourceCreateSourceTitle");
const refSourceCreatePart = $("refSourceCreatePart");
const refSourceCreateVolume = $("refSourceCreateVolume");
const refSourceCreateEdition = $("refSourceCreateEdition");
const refSourceCreatePubYear = $("refSourceCreatePubYear");
const refSourceCreatePublisher = $("refSourceCreatePublisher");
const refSourceCreateAuthorEditor = $("refSourceCreateAuthorEditor");
const refSourceCreateCommentator = $("refSourceCreateCommentator");
const refSourceCreateChapterSection = $("refSourceCreateChapterSection");
const refSourceCreatePageFrom = $("refSourceCreatePageFrom");
const refSourceCreatePageTo = $("refSourceCreatePageTo");
const refSourcePaperDetailFields = $("refSourcePaperDetailFields");
const refSourceCreateArticleTitle = $("refSourceCreateArticleTitle");
const refSourceCreateJournal = $("refSourceCreateJournal");
const refSourceCreateAuthors = $("refSourceCreateAuthors");
const refSourceCreatePaperYear = $("refSourceCreatePaperYear");
const refSourceCreatePaperPublisher = $("refSourceCreatePaperPublisher");
const refSourceCreateRemarksField = $("refSourceCreateRemarksField");
const refSourceCreateRemarks = $("refSourceCreateRemarks");

let refSourceMode = "existing";
let refSourceType = REF_SOURCE_TYPE_DEFAULT;
let refSelectedSourceId = null;
let refSelectedSourceDisplay = "";
let refSourceSearchRows = [];
let refSourceSearchTimer = null;
let refSourceSearchLoading = false;
let refSourceSaving = false;
let refDefaultInHouseSourceId = null;
let refDoiLookupLoading = false;
let refSourceDoiMetadata = null;
let refSourceLastLookupDoi = null;

// Outsourced modal
const outsourcedModal = $("outsourcedModal");
const outModalTitle = $("outModalTitle");
const outTestField = $("outTestField");
const outMethodField = $("outMethodField");
const outTestSelect = $("outTestSelect");
const outMethodDisplay = $("outMethodDisplay");
const outMethodSelect = $("outMethodSelect");
const outLabName = $("outLabName");
const outCoaNumber = $("outCoaNumber");
const outCoaDate = $("outCoaDate");
const outResultValue = $("outResultValue");
const btnOutCancel = $("btnOutCancel");
const btnOutSave = $("btnOutSave");

// Multi-value result entry modal
const MULTI_VALUE_INITIAL_BLANK_ROWS = 3;
const MULTI_VALUE_MAX_OBS_ROWS = 50;

const multiValueResultModal = $("multiValueResultModal");
const mvModalTitle = $("mvModalTitle");
const mvModalSub = $("mvModalSub");
const mvModalMeta = $("mvModalMeta");
const mvSummarySection = $("mvSummarySection");
const mvSummaryGrid = $("mvSummaryGrid");
const mvOutsideListSection = $("mvOutsideListSection");
const mvOutsideList = $("mvOutsideList");
const mvObsUomLabel = $("mvObsUomLabel");
const mvObsTableBody = $("mvObsTableBody");
const mvAddObsRowBtn = $("mvAddObsRowBtn");
const mvRemarksInput = $("mvRemarksInput");
const mvCancelBtn = $("mvCancelBtn");
const mvSaveBtn = $("mvSaveBtn");
const mvClearBtn = $("mvClearBtn");

const multiValueClearConfirmModal = $("multiValueClearConfirmModal");
const mvClearConfirmCancelBtn = $("mvClearConfirmCancelBtn");
const mvClearConfirmProceedBtn = $("mvClearConfirmProceedBtn");

// Issue COA modal
const issueCoaModal = $("issueCoaModal");
const coaIssueDate = $("coaIssueDate");
const coaPreparedBy = $("coaPreparedBy");
const coaCheckedBy = $("coaCheckedBy");
const coaApprovedBy = $("coaApprovedBy");
const coaRemarks = $("coaRemarks");
const btnIssueCoaCancel = $("btnIssueCoaCancel");
const btnIssueCoaConfirm = $("btnIssueCoaConfirm");

// Issue COA confirmation modal
const issueCoaConfirmModal = $("issueCoaConfirmModal");
const btnIssueCoaConfirmCancel = $("btnIssueCoaConfirmCancel");
const btnIssueCoaConfirmProceed = $("btnIssueCoaConfirmProceed");

// ── Module state ───────────────────────────────────────────────────────────────
let analysisId = null; // bigint from URL (?id=<number>)
let userId = null; // Authenticated user UUID
let isReadOnly = false; // true when status = COA_GENERATED
let rows = []; // Current result rows (from view)
let analysisInfo = null; // Analysis-level metadata (first row)
let debounceTimers = {}; // { [analysis_result_id]: timeoutId }
let analysisActionPermissions = new Map(); // key: `${analysisId}:${actionCode}`
let analysisPermissionVerified = false;
let analysisLocks = new Map(); // key: analysis_result_id
let mobileEditorResultId = null;
let mobileSwipeStartX = null;
let mobileSwipeStartY = null;
let mobileNavAnimTimer = null;

// Staff data for Issue COA modal (role-filtered from lab.v_coa_signatory_picker)
let preparedByList = []; // action_code = 'ENTER_RESULT'
let checkedByList = []; // action_code = 'PASS_SCRUTINY'
let approvedByList = []; // action_code = 'APPROVE_FOR_COA'
let signatoriesLoaded = false;
let currentUserStaffId = null; // mapped staff_id for the logged-in user

// Pending context for modals
let pendingRefRow = null; // Row awaiting reference capture
let pendingOutRow = null; // Row being edited (outsourced)
let outsourcedModalMode = "EDIT_EXISTING"; // EDIT_EXISTING | MARK_EXISTING | ADD_EXTRA
let outsourcedTestPickerRows = [];

// MULTI_VALUE result entry
let pendingMultiValueRow = null;
let multiValueObservations = [];
let multiValueCurrentSummary = null;
let multiValueSaving = false;
let multiValueClearing = false;

// ── Utility: escape HTML ───────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Utility: parse URL param ───────────────────────────────────────────────────
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Utility: format date ───────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

// ── Toast notifications ────────────────────────────────────────────────────────
/**
 * Show a transient toast message.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warn'} kind
 * @param {number} duration   milliseconds before auto-dismiss
 */
function toast(message, kind = "info", duration = 3500) {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ── Loading overlay ────────────────────────────────────────────────────────────
function showLoading() {
  loadingOverlay.classList.add("open");
}
function hideLoading() {
  loadingOverlay.classList.remove("open");
}

// ── Status chip builder ────────────────────────────────────────────────────────
const STATUS_CHIP_MAP = {
  DRAFT: ["sc-draft", "Draft"],
  IN_PROGRESS: ["sc-in-progress", "In Progress"],
  PENDING_SCRUTINY: ["sc-scrutiny", "Pending Scrutiny"],
  SCRUTINY_PASSED: ["sc-scrutiny-pass", "Scrutiny Passed"],
  APPROVED_FOR_COA: ["sc-approved", "Approved for COA"],
  COA_GENERATED: ["sc-coa", "COA Generated"],
};

function statusChip(status) {
  const key = String(status || "")
    .toUpperCase()
    .replace(/ /g, "_");
  const [cls, label] = STATUS_CHIP_MAP[key] ?? ["sc-draft", status || "—"];
  return `<span class="status-chip ${cls}">${esc(label)}</span>`;
}

const MODE_LABEL_MAP = {
  IN_HOUSE_ONLY: "In-house",
  MIXED: "Mixed",
  OUTSOURCED_ONLY: "Outsourced",
};

function modeLabel(mode) {
  const key = String(mode || "")
    .toUpperCase()
    .replace(/ /g, "_");
  return MODE_LABEL_MAP[key] ?? String(mode || "—");
}

// ── Compliance badge ────────────────────────────────────────────────────────────
function normalizeComplianceStatus(status) {
  const key = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (["PASS", "COMPLIANT", "WITHIN_SPEC"].includes(key)) return "PASS";
  if (["FAIL", "NON_COMPLIANT", "OUT_OF_SPEC"].includes(key)) return "FAIL";
  if (
    ["NOT_EVALUATED", "NOT_EVAL", "PENDING", "PENDING_EVALUATION"].includes(key)
  ) {
    return "NOT_EVALUATED";
  }
  return "UNKNOWN";
}

function complianceBadge(status) {
  const s = normalizeComplianceStatus(status);
  if (s === "PASS") return `<span class="badge badge-pass">Pass</span>`;
  if (s === "FAIL") return `<span class="badge badge-fail">Fail</span>`;
  if (s === "NOT_EVALUATED")
    return `<span class="badge badge-not-eval">Not Eval</span>`;
  return `<span class="badge badge-neutral">${esc(status) || "Unknown"}</span>`;
}

function complianceRowClass(status) {
  const s = normalizeComplianceStatus(status);
  if (s === "PASS") return "row-pass";
  if (s === "FAIL") return "row-fail";
  if (s === "NOT_EVALUATED") return "row-not-eval";
  return "row-unknown";
}

function complianceMobileCardClass(status) {
  const s = normalizeComplianceStatus(status);
  if (s === "PASS") return "mobile-pass";
  if (s === "FAIL") return "mobile-fail";
  if (s === "NOT_EVALUATED") return "mobile-not-eval";
  return "mobile-unknown";
}

// ── Source badge ────────────────────────────────────────────────────────────────
function sourceBadge(sourceType) {
  const s = String(sourceType || "").toUpperCase();
  if (s === "OUTSOURCED")
    return `<span class="badge badge-outsourced">Outsourced</span>`;
  return `<span class="badge badge-inhouse">In-house</span>`;
}

// ── Fetch analysis rows ─────────────────────────────────────────────────────────
/**
 * Load all result rows for this analysis from the view.
 * Returns an empty array on error (error is shown to user).
 */
async function loadAnalysisData() {
  const { data, error } = await labSupabase
    .from("v_analysis_result_entry")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("seq_no", { ascending: true });

  if (error) {
    toast(`Failed to load analysis: ${error.message}`, "error", 6000);
    return [];
  }
  return data ?? [];
}

async function loadAnalysisLocks() {
  analysisLocks.clear();
  if (!analysisId) return;

  const { data, error } = await labSupabase.rpc("fn_get_analysis_spec_locks", {
    p_analysis_id: analysisId,
  });

  if (error) {
    console.error("[AW] lock fetch failed:", error);
    return;
  }

  (data ?? []).forEach((row) => {
    if (row?.is_locked === true) {
      analysisLocks.set(Number(row.analysis_result_id), row);
    }
  });
}

function getRowLock(resultId) {
  return analysisLocks.get(Number(resultId)) || null;
}

function isRowLocked(resultId) {
  return !!getRowLock(resultId);
}

// ── Render header card ──────────────────────────────────────────────────────────
function renderHeader(info) {
  const itemName = info.item_name ?? "—";
  const batch = info.batch_no_snapshot || info.system_lot_no || "—";
  const registerNo = info.analysis_register_no ?? "—";

  const analysisIdDisplay = info.analysis_id ?? analysisId ?? "—";
  const physicalRef = info.physical_register_ref || "—";
  if (hdrAnalysisId) hdrAnalysisId.textContent = String(analysisIdDisplay);
  if (hdrRegisterNo) hdrRegisterNo.textContent = registerNo;
  if (hdrPhysicalRef) hdrPhysicalRef.textContent = physicalRef;
  hdrItemName.textContent = itemName;
  hdrBatch.textContent = batch;
  hdrStatus.innerHTML = statusChip(info.status);
  hdrMode.textContent = modeLabel(info.analysis_mode);
  hdrSampleDate.textContent = formatDate(info.sample_received_date);

  // Mobile pill
  const hdrPillText = $("hdrPillText");
  const hdrPillStatus = $("hdrPillStatus");
  if (hdrPillText) hdrPillText.textContent = `${itemName} — ${batch}`;
  if (hdrPillStatus) hdrPillStatus.innerHTML = statusChip(info.status);

  // Popover fields
  const hdrPopStatus = $("hdrPopStatus");
  const hdrPopRegisterNo = $("hdrPopRegisterNo");
  const hdrPopAnalysisId = $("hdrPopAnalysisId");
  const hdrPopPhysicalRef = $("hdrPopPhysicalRef");
  const hdrPopMode = $("hdrPopMode");
  const hdrPopSampleDate = $("hdrPopSampleDate");
  if (hdrPopStatus) hdrPopStatus.innerHTML = statusChip(info.status);
  if (hdrPopAnalysisId)
    hdrPopAnalysisId.textContent = String(analysisIdDisplay);
  if (hdrPopRegisterNo) hdrPopRegisterNo.textContent = registerNo;
  if (hdrPopPhysicalRef) hdrPopPhysicalRef.textContent = physicalRef;
  if (hdrPillText)
    hdrPillText.textContent = `${registerNo} · ${itemName} — ${batch}`;
  if (hdrPopAnalysisId)
    hdrPopAnalysisId.textContent = String(analysisIdDisplay);
  if (hdrPopPhysicalRef) hdrPopPhysicalRef.textContent = physicalRef;
  if (hdrPopMode) hdrPopMode.textContent = modeLabel(info.analysis_mode);
  if (hdrPopSampleDate)
    hdrPopSampleDate.textContent = formatDate(info.sample_received_date);

  pageSubtitle.textContent =
    itemName !== "—" ? `${itemName} — ${registerNo}` : registerNo;
}

// ── Render results table ────────────────────────────────────────────────────────
function renderResultsTable(data) {
  if (!data.length) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">
          No test results found for this analysis.
        </td>
      </tr>`;
    return;
  }

  resultsBody.innerHTML = data.map((row) => buildResultRow(row)).join("");
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 520px)").matches;
}

function getRowByResultId(resultId) {
  return rows.find((r) => String(r.analysis_result_id) === String(resultId));
}

function getDisplayableUnit(row) {
  const code = String(row?.uom_code_snapshot ?? "")
    .trim()
    .toUpperCase();
  const symbol = String(row?.uom_symbol_snapshot ?? "").trim();

  if (!symbol || code === "NONE") return "";
  return symbol;
}

function isMultiValueResultRow(row) {
  const entryMode = String(row?.result_entry_mode ?? "").toUpperCase();
  const inputMode = String(row?.input_mode ?? "").toUpperCase();
  return entryMode === "MULTI_VALUE" || inputMode === "MULTI_VALUE";
}

function getInitialBlankObservationCount() {
  return MULTI_VALUE_INITIAL_BLANK_ROWS;
}

function formatCalculationRuleLabel(code) {
  const c = String(code ?? "").trim();
  if (!c) return "—";
  const known = {
    WEIGHT_VARIATION_AVG_PERCENT: "Weight Variation (average % deviation)",
  };
  return known[c] ?? c.replace(/_/g, " ");
}

function buildBlankObservations(count = getInitialBlankObservationCount()) {
  const n = Math.max(
    1,
    Math.min(Number(count) || getInitialBlankObservationCount(), MULTI_VALUE_MAX_OBS_ROWS),
  );
  return Array.from({ length: n }, (_, i) => ({
    observation_no: i + 1,
    observed_value: null,
    server_is_within_limit: null,
    server_calculation_percent: null,
    _serverObservedValue: null,
  }));
}

function valueAlreadyEndsWithUnit(value, unit) {
  const base = String(value ?? "").trim();
  const uom = String(unit ?? "").trim();
  if (!base || !uom) return false;

  const escaped = uom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}$`, "i").test(base);
}

function buildClientResultDisplay(row) {
  if (isMultiValueResultRow(row)) {
    return String(
      row?.result_display_with_unit ??
        row?.result_display ??
        row?.result_text ??
        "",
    ).trim();
  }

  const kind = String(row?.result_kind_snapshot ?? "").trim().toUpperCase();
  const isNumeric =
    kind === "NUMERIC" ||
    (row?.result_numeric != null && row?.result_text == null);

  if (!isNumeric) {
    return String(row?.result_display ?? row?.result_text ?? "").trim();
  }

  const base = String(
    row?.result_display ??
      (row?.result_numeric == null ? "" : formatNumberForDisplay(row.result_numeric)),
  ).trim();

  if (!base) return "";

  const unit = getDisplayableUnit(row);
  if (!unit) return base;

  if (valueAlreadyEndsWithUnit(base, unit)) return base;
  return `${base} ${unit}`;
}

function formatResultDisplayWithUnit(row) {
  const clientDisplay = buildClientResultDisplay(row);
  if (clientDisplay) return clientDisplay;

  const serverDisplay = String(row?.result_display_with_unit ?? "").trim();
  if (serverDisplay) return serverDisplay;

  return "—";
}

function buildMobileResultCard(row) {
  const rid = esc(row.analysis_result_id);
  const rowLocked = isRowLocked(row.analysis_result_id);
  const resultDisplay = formatResultDisplayWithUnit(row);
  const complianceClass = complianceMobileCardClass(row.compliance_status);

  return `
    <div class="mobile-result-card ${complianceClass} ${rowLocked ? "row-locked" : ""}" data-rid="${rid}" role="button" tabindex="0" aria-label="Open result editor for ${esc(row.test_name ?? "test")}">
      <div class="mobile-card-head">
        <div class="mobile-card-name">${esc(row.test_name ?? "—")}</div>
        ${complianceBadge(row.compliance_status)}
      </div>
      <div class="mobile-card-result" title="${esc(String(resultDisplay))}"><strong>Result:</strong> ${esc(String(resultDisplay))}</div>
    </div>`;
}

function renderMobileResults(data) {
  if (!mobileResultsList) return;

  if (!data.length) {
    mobileResultsList.innerHTML = `
      <div class="mobile-result-card">
        <div class="mobile-card-name">No test results found for this analysis.</div>
      </div>`;
    return;
  }

  mobileResultsList.innerHTML = data
    .map((row) => buildMobileResultCard(row))
    .join("");
}

function renderMobileEditor() {
  if (!mobileEditorBody || !mobileEditorResultId) return;

  const row = getRowByResultId(mobileEditorResultId);
  if (!row) {
    closeMobileEditor();
    return;
  }

  const idx = rows.findIndex(
    (r) => String(r.analysis_result_id) === String(mobileEditorResultId),
  );
  const lockInfo = getRowLock(row.analysis_result_id);
  const rowLocked = !!lockInfo;
  const refRequired = row.reference_capture_required === true;
  const src = String(row.result_source_type || "").toUpperCase();
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  const isOutsourced = src === "OUTSOURCED";
  const canEnterResult = mayPerformAnalysisAction(analysisId, "ENTER_RESULT");
  const canCreateRefException = mayPerformAnalysisAction(
    analysisId,
    "CREATE_REFERENCE_EXCEPTION",
  );
  const resultDisabled = rowLocked || isReadOnly || !canEnterResult;
  const resultTitle = rowLocked
    ? String(lockInfo?.lock_message || "Pending specification review exists.")
    : !canEnterResult
      ? PERMISSION_DENIED_MESSAGE
      : "";
  const canMarkOutsourced =
    !rowLocked &&
    !isReadOnly &&
    canEnterResult &&
    statusAllowsAnalysisAction("ENTER_RESULT");
  const specDisplay = formatAnalysisSpecDisplay(row);
  const resultDisplay = formatResultDisplayWithUnit(row);

  mobileEditorTitle.textContent = row.test_name ?? "Result Editor";
  mobileEditorSubtitle.textContent = `Spec: ${specDisplay}`;
  mobileEditorCounter.textContent = `${idx + 1} / ${rows.length}`;
  mobileEditorPrevBtn.disabled = idx <= 0;
  mobileEditorNextBtn.disabled = idx >= rows.length - 1;

  let editorInputHtml = "";
  if (isOutsourced) {
    const labNameVal = esc(row.source_lab_name_snapshot ?? "—");
    const coaNoVal = esc(row.source_coa_no_snapshot ?? "—");
    const coaDateVal = formatDate(row.source_coa_date_snapshot);
    editorInputHtml = `
      <div class="outsourced-info">
        <span><strong>Lab:</strong> ${labNameVal}</span>
        <span><strong>COA:</strong> ${coaNoVal}</span>
        <span><strong>Date:</strong> ${esc(coaDateVal)}</span>
      </div>
      <div class="editor-sheet-actions">
        <button class="btn-sm btn-outsourced" data-mobile-action="edit-outsourced" data-rid="${esc(row.analysis_result_id)}">&#9998; Edit Source</button>
      </div>`;
  } else if (refRequired) {
    editorInputHtml = `
      <div class="editor-sheet-meta">Reference required before entering result.</div>
      <div class="editor-sheet-actions">
        <button class="btn-sm btn-ref ${canCreateRefException ? "btn-ref-add" : ""}" data-mobile-action="add-reference" data-rid="${esc(row.analysis_result_id)}" ${canCreateRefException ? "" : "disabled"} title="${esc(canCreateRefException ? "Add or review reference for this test" : PERMISSION_DENIED_MESSAGE)}">+ Add Reference</button>
      </div>`;
  } else if (isMultiValueResultRow(row)) {
    editorInputHtml = `
      <div class="editor-sheet-actions">
        <button type="button" class="btn-sm btn-multi-value" data-mobile-action="enter-observations" data-rid="${esc(row.analysis_result_id)}" ${resultDisabled ? "disabled" : ""} ${resultTitle ? `title="${esc(resultTitle)}"` : ""}>${esc(getMultiValueActionLabel(row))}</button>
      </div>`;
  } else if (kind === "NUMERIC") {
    editorInputHtml = `
      <label class="editor-sheet-meta" for="mobileResultNumericInput">Result Input</label>
      <input
        id="mobileResultNumericInput"
        class="result-input numeric-input"
        type="text"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        data-rid="${esc(row.analysis_result_id)}"
        data-kind="NUMERIC"
        value="${esc(formatDecimalForInput(row.result_numeric))}"
        ${resultDisabled ? "disabled" : ""}
        ${resultTitle ? `title="${esc(resultTitle)}"` : ""}
      />`;
  } else {
    const currentText = normText(row.result_text);
    const choices = buildChoiceList(row);
    const options = choices
      .map(
        (c) =>
          `<option value="${esc(c)}" ${currentText.toLowerCase() === c.toLowerCase() && currentText !== "" ? "selected" : ""}>${esc(c)}</option>`,
      )
      .join("");
    editorInputHtml = `
      <label class="editor-sheet-meta" for="mobileResultTextInput">Result Input</label>
      <select
        id="mobileResultTextInput"
        class="result-select"
        data-rid="${esc(row.analysis_result_id)}"
        data-kind="TEXT"
        ${resultDisabled ? "disabled" : ""}
        ${resultTitle ? `title="${esc(resultTitle)}"` : ""}
      >
        <option value="">— Select —</option>
        ${options}
      </select>`;
  }

  mobileEditorBody.innerHTML = `
        <div class="mobile-card-badges" data-mobile-badges="true">
      ${complianceBadge(row.compliance_status)}
      ${sourceBadge(row.result_source_type)}
      ${rowLocked ? `<span class="badge badge-lock" title="${esc(String(lockInfo?.lock_message || "Pending specification review exists."))}">Pending Spec Review</span>` : ""}
      ${row.has_active_reference_exception === true ? '<span class="badge badge-temp">TEMP</span>' : ""}
    </div>
    <div class="editor-sheet-meta" data-mobile-current-display="true"><strong>Current Display:</strong> ${esc(String(resultDisplay))}</div>
    ${editorInputHtml}
    <div class="editor-sheet-actions">
      ${!isOutsourced && !refRequired ? `<button class="btn-sm btn-ref btn-ref-modify" data-mobile-action="add-reference" data-rid="${esc(row.analysis_result_id)}" ${canCreateRefException ? "" : "disabled"}>Modify Reference</button>` : ""}
      ${!isOutsourced ? `<button class="btn-sm btn-outsourced" data-mobile-action="mark-outsourced" data-rid="${esc(row.analysis_result_id)}" ${canMarkOutsourced ? "" : "disabled"}>Mark Outsourced</button>` : ""}
      ${rowLocked ? `<span class="editor-sheet-meta">${esc(String(lockInfo?.lock_message || "Pending specification review exists."))}</span>` : ""}
    </div>`;
}

function openMobileEditor(resultId) {
  if (!isMobileViewport()) return;
  mobileEditorResultId = String(resultId);
  renderMobileEditor();
  mobileEditorSheetOverlay?.classList.add("open");
}

function closeMobileEditor() {
  mobileEditorResultId = null;
  mobileEditorSheetOverlay?.classList.remove("open");
}

function animateMobileEditorTransition(direction) {
  if (!mobileEditorBody) return;
  mobileEditorBody.classList.remove("nav-left", "nav-right");
  void mobileEditorBody.offsetWidth;
  mobileEditorBody.classList.add(
    direction === "left" ? "nav-left" : "nav-right",
  );

  if (mobileNavAnimTimer) clearTimeout(mobileNavAnimTimer);
  mobileNavAnimTimer = setTimeout(() => {
    mobileEditorBody.classList.remove("nav-left", "nav-right");
    mobileNavAnimTimer = null;
  }, 220);
}

function acknowledgeMobileSwipe() {
  if (!mobileEditorSheet) return;
  mobileEditorSheet.classList.remove("swipe-ack");
  void mobileEditorSheet.offsetWidth;
  mobileEditorSheet.classList.add("swipe-ack");
  setTimeout(() => mobileEditorSheet.classList.remove("swipe-ack"), 150);
}

function navigateMobileEditor(step, source = "button") {
  if (!mobileEditorResultId) return;
  const idx = rows.findIndex(
    (r) => String(r.analysis_result_id) === String(mobileEditorResultId),
  );
  if (idx < 0) return;
  const nextIdx = idx + step;
  if (nextIdx < 0 || nextIdx >= rows.length) return;

  mobileEditorResultId = String(rows[nextIdx].analysis_result_id);
  renderMobileEditor();
  if (source === "swipe") acknowledgeMobileSwipe();
  animateMobileEditorTransition(step > 0 ? "left" : "right");
}

/**
 * Build the HTML for a single result row.
 * Handles: reference lock, outsourced display, result input type.
 */
function buildResultRow(row) {
  const rid = esc(row.analysis_result_id);
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  const src = String(row.result_source_type || "").toUpperCase();
  const refRequired = row.reference_capture_required === true;
  const rowLocked = isRowLocked(row.analysis_result_id);
  const lockInfo = getRowLock(row.analysis_result_id);
  const hasTempException = row.has_active_reference_exception === true;
  const isOutsourced = src === "OUTSOURCED";
  const canEnterResult = mayPerformAnalysisAction(analysisId, "ENTER_RESULT");
  const canCreateRefException = mayPerformAnalysisAction(
    analysisId,
    "CREATE_REFERENCE_EXCEPTION",
  );
  const resultDisabled = rowLocked || isReadOnly || !canEnterResult;
  const resultTitle = rowLocked
    ? String(lockInfo?.lock_message || "Pending specification review exists.")
    : !canEnterResult
      ? PERMISSION_DENIED_MESSAGE
      : "";

  const specDisplay = formatAnalysisSpecDisplay(row);

  // Input cell
  let inputCell;
  if (isOutsourced) {
    const labNameVal = esc(row.source_lab_name_snapshot ?? "");
    const coaNoVal = esc(row.source_coa_no_snapshot ?? "");
    const coaDateVal = formatDate(row.source_coa_date_snapshot);
    inputCell = `
      <div class="outsourced-info">
        ${labNameVal ? `<span><strong>Lab:</strong> ${labNameVal}</span>` : ""}
        ${coaNoVal ? `<span><strong>COA:</strong> ${coaNoVal}</span>` : ""}
        ${coaDateVal !== "—" ? `<span><strong>Date:</strong> ${coaDateVal}</span>` : ""}
      </div>`;
  } else if (refRequired) {
    // Reference not yet captured — block entry
    inputCell = `<span style="color:var(--muted);font-size:0.78rem;">Reference required</span>`;
  } else if (isMultiValueResultRow(row)) {
    const reportHint = formatResultDisplayWithUnit(row);
    const hintHtml =
      reportHint && reportHint !== "—"
        ? `<div class="mv-input-hint" title="${esc(reportHint)}">${esc(reportHint.length > 40 ? `${reportHint.slice(0, 40)}…` : reportHint)}</div>`
        : "";
    inputCell = `
      <div class="mv-result-input-wrap">
        <button
          type="button"
          class="btn-sm btn-multi-value"
          data-action="enter-observations"
          data-rid="${rid}"
          ${resultDisabled ? "disabled" : ""}
          ${resultTitle ? `title="${esc(resultTitle)}"` : 'title="Enter observed values for multi-value calculation"'}
        >${esc(getMultiValueActionLabel(row))}</button>
        ${hintHtml}
      </div>`;
  } else if (kind === "NUMERIC") {
    const currentVal = formatDecimalForInput(row.result_numeric);
    inputCell = `
      <input
        class="result-input numeric-input"
        type="text"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        data-rid="${rid}"
        data-kind="NUMERIC"
        value="${esc(String(currentVal))}"
        ${resultDisabled ? "disabled" : ""}
        ${resultTitle ? `title="${esc(resultTitle)}"` : ""}
        aria-label="Numeric result for ${esc(row.test_name)}"
      />`;
  } else {
    // TEXT, PASS_FAIL, BOOLEAN — choices driven by row snapshots via buildChoiceList
    const currentText = normText(row.result_text);
    const choices = buildChoiceList(row);
    const options = choices
      .map(
        (c) =>
          `<option value="${esc(c)}" ${currentText.toLowerCase() === c.toLowerCase() && currentText !== "" ? "selected" : ""}>${esc(c)}</option>`,
      )
      .join("");
    inputCell = `
      <select
        class="result-select"
        data-rid="${rid}"
        data-kind="TEXT"
        ${resultDisabled ? "disabled" : ""}
        ${resultTitle ? `title="${esc(resultTitle)}"` : ""}
        aria-label="Text result for ${esc(row.test_name)}"
      >
        <option value="">— Select —</option>
        ${options}
      </select>`;
  }

  // Action cell — TEMP badge always visible when exception is active
  const tempBadge = hasTempException
    ? `<span class="badge badge-temp" title="One-time exception active">TEMP</span>`
    : "";
  const lockBadge = rowLocked
    ? `<span class="badge badge-lock" title="${esc(String(lockInfo?.lock_message || "Pending specification review exists."))}">Pending Spec Review</span>`
    : "";
  const canMarkOutsourced =
    !rowLocked &&
    !isReadOnly &&
    canEnterResult &&
    statusAllowsAnalysisAction("ENTER_RESULT");
  const markOutsourcedButton =
    !isOutsourced && !isReadOnly
      ? `<button
          class="btn-sm btn-outsourced"
          data-action="mark-outsourced"
          data-rid="${rid}"
          ${canMarkOutsourced ? "" : "disabled"}
          title="${esc(canMarkOutsourced ? "Mark this test as outsourced" : resultTitle || PERMISSION_DENIED_MESSAGE)}"
        >Mark Outsourced</button>`
      : "";

  let actionCell;
  if (!isReadOnly && isOutsourced) {
    actionCell = `
      ${lockBadge}
      ${tempBadge}
      <button
        class="btn-sm btn-outsourced"
        data-action="edit-outsourced"
        data-rid="${rid}"
        title="Edit outsourced source details"
      >&#9998; Edit Source</button>`;
  } else if (!isReadOnly && canCreateRefException) {
    const modifyIcon =
      '<svg class="btn-ref-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor"></path><path d="M20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z" fill="currentColor"></path></svg>';
    const refActionLabel = rowLocked
      ? `${modifyIcon} Modify Reference`
      : refRequired
        ? "+ Add Reference"
        : `${modifyIcon} Modify Reference`;
    const refActionTitle = refRequired
      ? "Add or review reference for this test"
      : "Review or modify reference for this test";
    const refActionClass = rowLocked
      ? "btn-ref-modify"
      : refRequired
        ? "btn-ref-add"
        : "btn-ref-modify";
    actionCell = `
      ${lockBadge}
      ${tempBadge}
      <button
        class="btn-sm btn-ref ${refActionClass}"
        data-action="add-reference"
        data-rid="${rid}"
        title="${esc(refActionTitle)}"
      >
        ${refActionLabel}
      </button>
      ${markOutsourcedButton}`;
  } else {
    // Reference satisfied (or read-only) — still show TEMP if exception active
    actionCell =
      `${lockBadge}${tempBadge}${markOutsourcedButton}`.trim() || "—";
  }

  const rowClass =
    `${complianceRowClass(row.compliance_status)} ${rowLocked ? "row-locked" : ""}`.trim();
  const methodDisplay = row.method_name_snapshot ?? row.method_name ?? "—";

  return `
    <tr data-rid="${rid}" class="${rowClass}">
      <td>${esc(String(row.seq_no ?? ""))}</td>
      <td title="${esc(row.test_name)}">${esc(row.test_name ?? "—")}</td>
      <td title="${esc(methodDisplay)}" style="color:var(--muted)">${esc(methodDisplay)}</td>
      <td title="${esc(specDisplay)}" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;">${esc(specDisplay)}</td>
      <td>${inputCell}</td>
      <td style="color:var(--muted)">${esc(formatResultDisplayWithUnit(row))}</td>
      <td>${complianceBadge(row.compliance_status)}</td>
      <td>${sourceBadge(row.result_source_type)}</td>
      <td style="white-space:nowrap"><div class="row-actions">${actionCell}</div></td>
    </tr>`;
}

// ── Update validation panel ─────────────────────────────────────────────────────
function updateValidationPanel(data) {
  let missing = 0;
  let failed = 0;
  let notEval = 0;
  let refMissing = 0;
  const lockCount = analysisLocks.size;

  data.forEach((row) => {
    const compliance = normalizeComplianceStatus(row.compliance_status);
    const hasResult =
      row.result_numeric != null ||
      (row.result_text != null && row.result_text !== "");
    if (!hasResult) missing++;
    if (compliance === "FAIL") failed++;
    if (compliance === "NOT_EVALUATED") notEval++;
    if (row.reference_capture_required === true) refMissing++;
  });

  const resolveKpiState = (n, profile) => {
    if (profile === "danger-if-positive") return n > 0 ? "danger" : "ok";
    if (profile === "warn-if-positive") return n > 0 ? "warn" : "ok";
    return "ok";
  };

  const fmt = (el, n, profile) => {
    el.textContent = String(n);
    const state = resolveKpiState(n, profile);
    el.className = `vp-count vp-${state}`;
    const chip = el.closest(".vp-chip");
    if (chip) {
      chip.classList.remove("vp-chip-ok", "vp-chip-warn", "vp-chip-danger");
      chip.classList.add(`vp-chip-${state}`);
    }
  };

  // KPI severity profile (ERP-style): operational gaps warn, hard blockers fail.
  fmt(vpMissing, missing, "warn-if-positive");
  fmt(vpFailed, failed, "danger-if-positive");
  fmt(vpNotEval, notEval, "warn-if-positive");
  fmt(vpRefMissing, refMissing, "warn-if-positive");
  if (vpLocks) fmt(vpLocks, lockCount, "danger-if-positive");
}

function parseNumericInput(value) {
  return parseDecimalOrNull(value);
}

function evaluateComplianceLocally(row) {
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  const specType = normalizeReferenceSpecType(row.spec_type_snapshot);

  if (kind === "NUMERIC") {
    const n = parseNumericInput(row.result_numeric);
    if (n == null) return "NOT_EVALUATED";

    const min = parseNumericInput(row.min_value_snapshot);
    const max = parseNumericInput(row.max_value_snapshot);

    if (specType === "RANGE") {
      if (min == null || max == null) return "NOT_EVALUATED";
      return n >= min && n <= max ? "PASS" : "FAIL";
    }
    if (specType === "MIN_ONLY") {
      if (min == null) return "NOT_EVALUATED";
      return n >= min ? "PASS" : "FAIL";
    }
    if (specType === "MAX_ONLY") {
      if (max == null) return "NOT_EVALUATED";
      return n <= max ? "PASS" : "FAIL";
    }
    if (specType === "EXACT_NUMERIC") {
      if (min == null) return "NOT_EVALUATED";
      return n === min ? "PASS" : "FAIL";
    }
    // TOLERANCE: target ± tolerance (percent or absolute per tolerance UOM)
    if (specType === "TOLERANCE") {
      const target = parseNumericInput(row.target_value_snapshot);
      const tolerance = parseNumericInput(row.tolerance_value_snapshot);
      if (target == null || tolerance == null) return "NOT_EVALUATED";
      let lower;
      let upper;
      if (isPercentToleranceUom(row)) {
        const delta = Math.abs((target * tolerance) / 100);
        lower = target - delta;
        upper = target + delta;
      } else {
        const delta = Math.abs(tolerance);
        lower = target - delta;
        upper = target + delta;
      }
      return n >= lower && n <= upper ? "PASS" : "FAIL";
    }
    return String(row.compliance_status || "NOT_EVALUATED").toUpperCase();
  }

  const actual = normText(row.result_text);
  if (!actual) return "NOT_EVALUATED";

  const expected = normText(row.text_value_snapshot);
  if (expected) {
    return actual.toLowerCase() === expected.toLowerCase() ? "PASS" : "FAIL";
  }

  const actualNorm = actual.toLowerCase();
  const passSet = new Set(["pass", "complies", "present", "yes"]);
  const failSet = new Set(["fail", "does not comply", "absent", "no"]);
  if (passSet.has(actualNorm)) return "PASS";
  if (failSet.has(actualNorm)) return "FAIL";

  return String(row.compliance_status || "NOT_EVALUATED").toUpperCase();
}

function applyOptimisticResultState(resultId, kind, value) {
  const idx = rows.findIndex(
    (r) => String(r.analysis_result_id) === String(resultId),
  );
  if (idx === -1) return;

  const nextRow = { ...rows[idx] };
  if (kind === "NUMERIC") {
    const parsed = parseDecimalOrNull(value);
    nextRow.result_numeric = Number.isNaN(parsed) ? null : parsed;
  } else {
    nextRow.result_text = value === "" ? null : String(value);
  }

  nextRow.result_display =
    kind === "NUMERIC"
      ? nextRow.result_numeric == null
        ? null
        : String(nextRow.result_numeric)
      : normText(nextRow.result_text) || null;
  if (kind === "NUMERIC" && Number.isNaN(parseDecimalOrNull(value))) {
    nextRow.result_display = null;
    nextRow.compliance_status = "NOT_EVALUATED";
  } else {
    nextRow.compliance_status = evaluateComplianceLocally(nextRow);
  }
  rows[idx] = nextRow;

  const tr = resultsBody.querySelector(`tr[data-rid="${resultId}"]`);
  if (tr) {
    const cells = tr.querySelectorAll("td");
    if (cells[5]) cells[5].textContent = formatResultDisplayWithUnit(nextRow);
    if (cells[6])
      cells[6].innerHTML = complianceBadge(nextRow.compliance_status);
    tr.classList.remove("row-pass", "row-fail", "row-not-eval", "row-unknown");
    tr.classList.add(complianceRowClass(nextRow.compliance_status));
  }

  updateValidationPanel(rows);
  renderMobileResults(rows);

  if (mobileEditorResultId) {
    const updatedRow = getRowByResultId(resultId);

    if (isEditingInsideMobileEditor()) {
      patchOpenMobileEditorDisplay(updatedRow);
    } else if (String(mobileEditorResultId) === String(resultId)) {
      renderMobileEditor();
    }
  }
}

function handleNumericControlInput(el) {
  if (!el || !el.classList?.contains("numeric-input")) return;

  const before = el.value;
  const after = sanitizeDecimalInputText(before);

  if (before !== after) {
    const pos = el.selectionStart ?? after.length;
    el.value = after;
    try {
      el.setSelectionRange(
        Math.min(pos, after.length),
        Math.min(pos, after.length),
      );
    } catch {
      // ignore unsupported selection handling
    }
  }

  const valid = isTemporarilyValidDecimalText(el.value);
  el.classList.toggle("input-invalid", !valid);

  const rid = el.dataset?.rid;
  if (rid && el.dataset?.kind === "NUMERIC") {
    applyOptimisticResultState(rid, "NUMERIC", el.value);
  }
}

function handleResultControlChange(el) {
  const rid = el?.dataset?.rid;
  const kind = el?.dataset?.kind;
  if (!rid || !kind) return;

  if (el.tagName === "SELECT" && el.value === "Other / Manual Entry") {
    const custom = (window.prompt("Enter result value") ?? "").trim();
    if (!custom) {
      el.value = "";
      return;
    }

    const otherOpt = el.querySelector('option[value="Other / Manual Entry"]');
    const newOpt = document.createElement("option");
    newOpt.value = custom;
    newOpt.textContent = custom;
    el.insertBefore(newOpt, otherOpt);
    el.value = custom;
    onResultChange(rid, "TEXT", custom);
    return;
  }

  if (kind === "NUMERIC" && !isValidDecimalText(el.value)) {
    el.classList.add("input-invalid");
    toast("Enter a valid numeric value.", "warn", 2500);
    return;
  }

  if (kind === "NUMERIC") {
    const numericValue = parseDecimalOrNull(el.value);

    if (Number.isNaN(numericValue)) {
      el.classList.add("input-invalid");
      toast("Enter a valid numeric value.", "warn", 2500);
      return;
    }

    el.value = numericValue === null ? "" : String(numericValue);
  }

  el.classList.remove("input-invalid");
  onResultChange(rid, kind, el.value);
}

function handleNumericControlBlur(el) {
  if (!el || !el.classList?.contains("numeric-input")) return;

  const n = parseDecimalOrNull(el.value);

  if (Number.isNaN(n)) {
    el.classList.add("input-invalid");
    return;
  }

  el.classList.remove("input-invalid");

  if (n !== null) {
    el.value = String(n);
  }
}

// ── Permission check for workflow buttons ───────────────────────────────────────
function makeAnalysisPermissionKey(id, actionCode) {
  return `${Number(id)}:${String(actionCode || "").toUpperCase()}`;
}

function getAnalysisStatus() {
  return String(analysisInfo?.status || "").toUpperCase();
}

function statusAllowsAnalysisAction(actionCode) {
  const status = getAnalysisStatus();

  if (isReadOnly) return false;

  switch (String(actionCode || "").toUpperCase()) {
    case "ENTER_RESULT":
      return status === "DRAFT" || status === "IN_PROGRESS";

    case "CREATE_REFERENCE_EXCEPTION":
      return status === "DRAFT" || status === "IN_PROGRESS";

    case "SUBMIT_FOR_SCRUTINY":
      return status === "DRAFT" || status === "IN_PROGRESS";

    case "PASS_SCRUTINY":
      return status === "PENDING_SCRUTINY";

    case "RETURN_FOR_CORRECTION":
      return status === "PENDING_SCRUTINY";

    case "APPROVE_FOR_COA":
      return status === "SCRUTINY_PASSED";

    case "REOPEN_AFTER_APPROVAL":
      return status === "APPROVED_FOR_COA";

    case "ISSUE_COA":
      return status === "APPROVED_FOR_COA";

    default:
      return false;
  }
}

function mayPerformAnalysisAction(id, actionCode) {
  if (!analysisPermissionVerified) return false;
  return (
    analysisActionPermissions.get(makeAnalysisPermissionKey(id, actionCode)) ===
    true
  );
}

async function fetchAnalysisPermissions() {
  analysisActionPermissions = new Map();
  analysisPermissionVerified = false;

  try {
    const { data, error } = await labSupabase.rpc(
      "fn_get_user_analysis_action_permissions",
      {
        p_user_id: userId,
        p_analysis_ids: [Number(analysisId)],
        p_action_codes: ANALYSIS_ACTION_CODES,
      },
    );

    if (error) throw error;

    (Array.isArray(data) ? data : []).forEach((row) => {
      const key = makeAnalysisPermissionKey(row?.analysis_id, row?.action_code);
      analysisActionPermissions.set(key, row?.is_allowed === true);
    });

    analysisPermissionVerified = true;
    return true;
  } catch (err) {
    console.error("[AW] permission fetch failed:", err);
    analysisPermissionVerified = false;
    analysisActionPermissions.clear();
    return false;
  }
}

function applyPermissionToButton(btn, statusAllows, permissionAllows, message) {
  if (!btn) return;
  btn.disabled = !(statusAllows && permissionAllows);
  if (!permissionAllows) btn.title = message || PERMISSION_DENIED_MESSAGE;
  else if (btn.title === message || btn.title === PERMISSION_DENIED_MESSAGE)
    btn.title = "";
}

// ── Apply permissions to workflow buttons ───────────────────────────────────────
function applyPermissions() {
  const denyMsg = analysisPermissionVerified
    ? PERMISSION_DENIED_MESSAGE
    : PERMISSION_VERIFY_FAILED_MESSAGE;

  applyPermissionToButton(
    btnSubmitScrutiny,
    statusAllowsAnalysisAction(ACTION_CODES.submitScrutiny),
    mayPerformAnalysisAction(analysisId, ACTION_CODES.submitScrutiny),
    denyMsg,
  );
  if (btnSubmitScrutiny && analysisLocks.size > 0) {
    btnSubmitScrutiny.disabled = true;
    btnSubmitScrutiny.title = "Pending specification review exists.";
  } else if (
    btnSubmitScrutiny &&
    btnSubmitScrutiny.title === "Pending specification review exists."
  ) {
    btnSubmitScrutiny.title = "";
  }
  applyPermissionToButton(
    btnPassScrutiny,
    statusAllowsAnalysisAction(ACTION_CODES.passScrutiny),
    mayPerformAnalysisAction(analysisId, ACTION_CODES.passScrutiny),
    denyMsg,
  );
  applyPermissionToButton(
    btnApproveForCoa,
    statusAllowsAnalysisAction(ACTION_CODES.approveCoa),
    mayPerformAnalysisAction(analysisId, ACTION_CODES.approveCoa),
    denyMsg,
  );
  applyPermissionToButton(
    btnIssueCoa,
    statusAllowsAnalysisAction(ACTION_CODES.issueCoa),
    mayPerformAnalysisAction(analysisId, ACTION_CODES.issueCoa),
    denyMsg,
  );
  applyPermissionToButton(
    btnReturnForCorrection,
    statusAllowsAnalysisAction(ACTION_CODES.returnForCorrection),
    mayPerformAnalysisAction(analysisId, ACTION_CODES.returnForCorrection),
    denyMsg,
  );
  applyPermissionToButton(
    btnReopenAfterApproval,
    statusAllowsAnalysisAction(ACTION_CODES.reopenAfterApproval),
    mayPerformAnalysisAction(analysisId, ACTION_CODES.reopenAfterApproval),
    denyMsg,
  );

  if (btnViewCoa) {
    btnViewCoa.disabled = !isReadOnly;
  }

  if (btnSyncFromSpec) {
    const canSync =
      statusAllowsAnalysisAction("ENTER_RESULT") &&
      mayPerformAnalysisAction(analysisId, "ENTER_RESULT");
    btnSyncFromSpec.disabled = !canSync;
    btnSyncFromSpec.title = canSync
      ? "Refresh analysis result lines from the current effective specification."
      : denyMsg;
  }
  if (btnAddOutsourcedTest) {
    const canAddOutsourced =
      statusAllowsAnalysisAction("ENTER_RESULT") &&
      mayPerformAnalysisAction(analysisId, "ENTER_RESULT");
    btnAddOutsourcedTest.disabled = !canAddOutsourced;
    btnAddOutsourcedTest.title = canAddOutsourced
      ? "Add outsourced test"
      : denyMsg;
  }
}

function normalizeDecimalText(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[٫,]/g, ".")
    .replace(/\s+/g, "");
}

function parseDecimalOrNull(raw) {
  const s = normalizeDecimalText(raw);
  if (!s) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) return Number.NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function isValidDecimalText(raw) {
  const parsed = parseDecimalOrNull(raw);
  return parsed === null || Number.isFinite(parsed);
}

function isTemporarilyValidDecimalText(raw) {
  const s = normalizeDecimalText(raw);
  if (!s) return true;
  return /^[+-]?(?:\d+\.?\d*|\.\d*)$/.test(s) || s === "+" || s === "-";
}

function formatDecimalForInput(raw) {
  const n = parseDecimalOrNull(raw);
  if (n === null) return "";
  if (Number.isNaN(n)) return String(raw ?? "").trim();
  return String(n);
}

function sanitizeDecimalInputText(raw) {
  let s = String(raw ?? "");

  s = s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[٫,]/g, ".")
    .replace(/[^\d.+-]/g, "");

  const hasLeadingMinus = s.startsWith("-");
  s = s.replace(/[+-]/g, "");
  if (hasLeadingMinus) s = `-${s}`;

  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  return s;
}

function isEditingInsideMobileEditor() {
  const active = document.activeElement;
  return !!(
    active &&
    mobileEditorBody?.contains(active) &&
    (active.matches("input, textarea, select") ||
      active.classList?.contains("numeric-input"))
  );
}

function patchOpenMobileEditorDisplay(row) {
  if (!mobileEditorResultId) return;
  if (!row) return;
  if (String(row.analysis_result_id) !== String(mobileEditorResultId)) return;

  const currentDisplayEl = mobileEditorBody?.querySelector(
    '[data-mobile-current-display="true"]',
  );

  if (currentDisplayEl) {
    currentDisplayEl.innerHTML = `<strong>Current Display:</strong> ${esc(
      String(formatResultDisplayWithUnit(row)),
    )}`;
  }

  const badgeWrap = mobileEditorBody?.querySelector(
    '[data-mobile-badges="true"]',
  );

  if (badgeWrap) {
    const lockInfo = getRowLock(row.analysis_result_id);
    badgeWrap.innerHTML = `
      ${complianceBadge(row.compliance_status)}
      ${sourceBadge(row.result_source_type)}
      ${
        lockInfo
          ? `<span class="badge badge-lock" title="${esc(String(lockInfo?.lock_message || "Pending specification review exists."))}">Pending Spec Review</span>`
          : ""
      }
      ${
        row.has_active_reference_exception === true
          ? '<span class="badge badge-temp">TEMP</span>'
          : ""
      }
    `;
  }
}

async function syncFromCurrentSpec() {
  if (isReadOnly) return;
  if (!statusAllowsAnalysisAction("ENTER_RESULT")) {
    toast(
      "Spec sync is allowed only in Draft or In Progress stage.",
      "warn",
      4000,
    );
    return;
  }
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, "ENTER_RESULT")) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }

  if (btnSyncFromSpec) btnSyncFromSpec.disabled = true;
  showLoading();
  try {
    const { data, error } = await labSupabase.rpc(
      "fn_sync_analysis_results_from_effective_spec",
      {
        p_user_id: userId,
        p_analysis_id: Number(analysisId),
        p_mode: "SAFE",
      },
    );
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const added = Number(result?.added_count ?? 0);
    const updated = Number(result?.updated_count ?? 0);
    const removed = Number(result?.removed_count ?? 0);
    const skipped = Number(result?.skipped_count ?? 0);
    const hasLineChanges = added > 0 || updated > 0 || removed > 0;

    if (hasLineChanges) {
      toast(
        `Spec sync completed. Added: ${added}, Updated: ${updated}, Removed: ${removed}, Skipped: ${skipped}.`,
        "success",
        5000,
      );
    } else if (skipped > 0) {
      toast(
        "No result lines changed. Existing lines already match current effective specification or were skipped by SAFE sync.",
        "warn",
        6000,
      );
    } else {
      toast(
        `Spec sync completed. Added: ${added}, Updated: ${updated}, Removed: ${removed}, Skipped: ${skipped}.`,
        "success",
        5000,
      );
    }
    await reloadAndRender();
  } catch (err) {
    toast(`Spec sync failed: ${err.message}`, "error", 6000);
  } finally {
    hideLoading();
    applyPermissions();
  }
}

// ── Save a single result to DB ──────────────────────────────────────────────────
/**
 * Persist result via fn_save_analysis_result RPC.
 * @param {number} resultId   analysis_result_id (view alias of base table id)
 * @param {'NUMERIC'|'TEXT'} kind
 * @param {string|number} value
 */
async function saveResult(resultId, kind, value) {
  if (isReadOnly) return;
  if (!statusAllowsAnalysisAction("ENTER_RESULT")) {
    toast(
      "Result entry is not allowed at the current workflow stage.",
      "warn",
      4000,
    );
    return;
  }
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, "ENTER_RESULT")) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }

  let numericValue = null;

  if (kind === "NUMERIC") {
    numericValue = parseDecimalOrNull(value);
    if (Number.isNaN(numericValue)) {
      toast("Enter a valid numeric value.", "warn", 3500);
      return;
    }
  }

  const { error } = await labSupabase.rpc("fn_save_analysis_result", {
    p_user_id: userId,
    p_analysis_result_id: resultId,
    p_result_numeric: kind === "NUMERIC" ? numericValue : null,
    p_result_text:
      kind !== "NUMERIC" ? (value === "" ? null : String(value)) : null,
  });

  if (error) {
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes("pending specification approval exists")) {
      toast(
        "Result entry blocked until specification review is completed.",
        "warn",
        5000,
      );
    } else {
      toast(`Save failed: ${error.message}`, "error", 5000);
    }
    return;
  }

  // Silently refresh this row's compliance display
  await refreshSingleRow(resultId);
}

/**
 * Refresh compliance and result_display for one row without full reload.
 */
async function refreshSingleRow(resultId) {
  const { data, error } = await labSupabase
    .from("v_analysis_result_entry")
    .select(
      "analysis_result_id, compliance_status, result_display, result_display_with_unit, result_numeric, result_text, result_kind_snapshot, uom_code_snapshot, uom_symbol_snapshot",
    )
    .eq("analysis_result_id", resultId)
    .single();

  if (error || !data) return;

  // Update in-memory store
  const idx = rows.findIndex((r) => r.analysis_result_id === resultId);
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...data };
  }

  const updatedRow = idx !== -1 ? rows[idx] : data;

  // Patch the compliance and result_display cells in the DOM
  const tr = resultsBody.querySelector(`tr[data-rid="${resultId}"]`);
  if (!tr) return;
  const cells = tr.querySelectorAll("td");
  // result_display is col index 5, compliance is col index 6
  if (cells[5]) cells[5].textContent = formatResultDisplayWithUnit(updatedRow);
  if (cells[6]) cells[6].innerHTML = complianceBadge(data.compliance_status);
  tr.classList.remove("row-pass", "row-fail", "row-not-eval", "row-unknown");
  tr.classList.add(complianceRowClass(data.compliance_status));

  updateValidationPanel(rows);
  renderMobileResults(rows);

  if (mobileEditorResultId) {
    const updatedRow = getRowByResultId(resultId);

    if (isEditingInsideMobileEditor()) {
      patchOpenMobileEditorDisplay(updatedRow);
    } else if (String(mobileEditorResultId) === String(resultId)) {
      renderMobileEditor();
    }
  }
}

function handleResultRowAction(action, row) {
  if (!row) return;

  if (action === "add-reference") {
    if (!analysisPermissionVerified) {
      toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
      return;
    }
    if (!mayPerformAnalysisAction(analysisId, "CREATE_REFERENCE_EXCEPTION")) {
      toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
      return;
    }
    openReferenceModal(row);
    return;
  }

  if (action === "edit-outsourced") {
    if (!analysisPermissionVerified) {
      toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
      return;
    }
    if (!mayPerformAnalysisAction(analysisId, "ENTER_RESULT")) {
      toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
      return;
    }
    openOutsourcedModal(row, "EDIT_EXISTING");
    return;
  }

  if (action === "mark-outsourced") {
    if (!analysisPermissionVerified) {
      toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
      return;
    }
    if (!mayPerformAnalysisAction(analysisId, "ENTER_RESULT")) {
      toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
      return;
    }
    openOutsourcedModal(row, "MARK_EXISTING");
    return;
  }

  if (action === "enter-observations") {
    const gate = canEnterMultiValueResult(row);
    if (!gate.ok) {
      toast(gate.message, gate.kind ?? "warn", 4000);
      return;
    }
    openMultiValueResultModal(row);
  }
}

// ── Debounced result change handler ─────────────────────────────────────────────
function onResultChange(resultId, kind, value) {
  clearTimeout(debounceTimers[resultId]);

  // Optimistic update so KPI and compliance indicators react immediately.
  applyOptimisticResultState(resultId, kind, value);

  debounceTimers[resultId] = setTimeout(() => {
    saveResult(resultId, kind, value);
  }, DEBOUNCE_MS);
}

// ── Reference modal ─────────────────────────────────────────────────────────────
function normalizeReferenceSpecType(raw) {
  const t = String(raw || "").toUpperCase();
  if (t === "NLT" || t === "MIN_ONLY") return "MIN_ONLY";
  if (t === "NMT" || t === "LIMIT" || t === "MAX_ONLY") return "MAX_ONLY";
  if (t === "RANGE") return "RANGE";
  if (t === "EXACT" || t === "EXACT_NUMERIC") return "EXACT_NUMERIC";
  if (t === "PASS_FAIL") return "PASS_FAIL";
  if (t === "TOLERANCE") return "TOLERANCE";
  return "TEXT";
}

/** Normalize UOM token for TOLERANCE display (mirrors SPM buildToleranceDisplayText). */
function normalizeToleranceUomSymbol(symbol) {
  const unit = String(symbol ?? "").trim();
  if (!unit) return "";
  const upper = unit.toUpperCase();
  if (upper === "NONE" || upper === "NO UOM" || upper === "NO_UNIT") return "";
  return unit;
}

/** TOLERANCE display: target [targetUOM] ± tolerance [toleranceUOM] */
function buildToleranceSpecDisplay(
  targetValue,
  toleranceValue,
  targetUomSymbol,
  toleranceUomSymbol,
) {
  const targetText = formatNumberForDisplay(targetValue);
  const toleranceText = formatNumberForDisplay(toleranceValue);
  if (!targetText || !toleranceText) return "";
  const targetUnit = normalizeToleranceUomSymbol(targetUomSymbol);
  const toleranceUnit = normalizeToleranceUomSymbol(toleranceUomSymbol);
  let text = targetUnit ? `${targetText} ${targetUnit}` : targetText;
  text += ` ± ${toleranceText}`;
  if (toleranceUnit) text += ` ${toleranceUnit}`;
  return text.trim();
}

function formatToleranceSpecDisplayFromRow(row) {
  if (!row) return "";
  const targetUom = normalizeToleranceUomSymbol(
    row.uom_symbol_snapshot ?? row.uom_code_snapshot ?? "",
  );
  const toleranceUom = normalizeToleranceUomSymbol(
    row.tolerance_uom_symbol_snapshot ?? row.tolerance_uom_code_snapshot ?? "",
  );
  return buildToleranceSpecDisplay(
    row.target_value_snapshot,
    row.tolerance_value_snapshot,
    targetUom,
    toleranceUom,
  );
}

function formatAnalysisSpecDisplay(row) {
  const specType = normalizeReferenceSpecType(row?.spec_type_snapshot);
  if (specType === "TOLERANCE") {
    const target = row?.target_value_snapshot;
    const tolerance = row?.tolerance_value_snapshot;
    const hasTarget = target != null && String(target).trim() !== "";
    const hasTolerance = tolerance != null && String(tolerance).trim() !== "";
    if (hasTarget && hasTolerance) {
      const built = formatToleranceSpecDisplayFromRow(row);
      if (built) return built;
    }
  }
  return row?.reference_range_display ?? row?.spec_display_snapshot ?? "—";
}

/** TOLERANCE compliance: true when tolerance UOM is percent (%). */
function isPercentToleranceUom(row) {
  const code = String(row?.tolerance_uom_code_snapshot ?? "")
    .trim()
    .toUpperCase();
  const symbol = String(row?.tolerance_uom_symbol_snapshot ?? "")
    .trim()
    .toUpperCase();
  return (
    code === "PCT" ||
    code === "PERCENT" ||
    code === "%" ||
    symbol === "%"
  );
}

function getAllowedReferenceSpecTypes(row) {
  const kind = String(row?.result_kind_snapshot || "").toUpperCase();
  if (kind === "NUMERIC") {
    return ["RANGE", "MIN_ONLY", "MAX_ONLY", "EXACT_NUMERIC", "TOLERANCE"];
  }
  if (kind === "PASS_FAIL") return ["PASS_FAIL"];
  return ["TEXT"];
}

function applyReferenceSpecTypeUI() {
  const specType = String(refSpecTypeSelect?.value || "TEXT").toUpperCase();

  if (refMinValueField)
    refMinValueField.style.display =
      specType === "RANGE" || specType === "MIN_ONLY" ? "" : "none";
  if (refMaxValueField)
    refMaxValueField.style.display =
      specType === "RANGE" || specType === "MAX_ONLY" ? "" : "none";
  if (refExactValueField)
    refExactValueField.style.display =
      specType === "EXACT_NUMERIC" ? "" : "none";
  if (refTextValueField)
    refTextValueField.style.display = specType === "TEXT" ? "" : "none";
  if (refPassFailValueField)
    refPassFailValueField.style.display =
      specType === "PASS_FAIL" ? "" : "none";
  const showTolerance = specType === "TOLERANCE";
  if (refToleranceField)
    refToleranceField.style.display = showTolerance ? "" : "none";
  if (refToleranceValueField)
    refToleranceValueField.style.display = showTolerance ? "" : "none";
  if (refToleranceUomField)
    refToleranceUomField.style.display = showTolerance ? "" : "none";

  // Block save when TOLERANCE reference RPC is not yet extended on server.
  if (btnRefSave) {
    const blocked = showTolerance && !REFERENCE_PROPOSAL_SUPPORTS_TOLERANCE;
    btnRefSave.disabled = blocked;
    btnRefSave.title = blocked
      ? "TOLERANCE reference proposals require server RPC support (p_target_value, p_tolerance_value, p_tolerance_uom_id)."
      : "";
  }
}

function getRefToleranceUomSymbol(uomId) {
  const row = refToleranceUomRows.find((u) => Number(u.id) === Number(uomId));
  return String(row?.symbol ?? row?.uom_code ?? "").trim();
}

function buildRefToleranceDisplayPreview(targetVal, toleranceVal, row) {
  const tolUomId = refToleranceUomSelect?.value;
  return buildToleranceSpecDisplay(
    targetVal,
    toleranceVal,
    getRowUnitLabel(row),
    getRefToleranceUomSymbol(tolUomId),
  );
}

async function ensureRefToleranceUomPicker() {
  if (refToleranceUomRows.length) return refToleranceUomRows;
  const { data, error } = await labSupabase.rpc("fn_get_lab_uom_picker");
  if (error) {
    console.error("[AW] tolerance UOM picker failed:", error);
    refToleranceUomRows = [];
    return refToleranceUomRows;
  }
  refToleranceUomRows = Array.isArray(data) ? data : [];
  return refToleranceUomRows;
}

function populateRefToleranceUomSelect(selectedId) {
  if (!refToleranceUomSelect) return;
  refToleranceUomSelect.innerHTML =
    '<option value="">— Select tolerance UOM —</option>' +
    refToleranceUomRows
      .map((u) => {
        const label = u.symbol
          ? `${u.uom_code} - ${u.symbol}`
          : `${u.uom_code} - ${u.uom_name}`;
        const sel =
          String(u.id) === String(selectedId ?? "") ? " selected" : "";
        return `<option value="${String(u.id)}"${sel}>${label}</option>`;
      })
      .join("");
}

function formatNumberForDisplay(value) {
  if (value == null || value === "") return "";
  const raw = normalizeDecimalText(value);
  const n = parseDecimalOrNull(raw);
  if (Number.isNaN(n)) return String(value).trim();
  if (n === null) return "";
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, "");
}

function getRowUnitLabel(row) {
  return getDisplayableUnit(row);
}

function appendUomIfNeeded(display, row) {
  const base = String(display ?? "").trim();
  const uom = getRowUnitLabel(row);
  if (!base || !uom) return base;
  if (base.toLowerCase().includes(uom.toLowerCase())) return base;
  return `${base} ${uom}`;
}

function updateReferenceDisplayPreview() {
  if (!pendingRefRow || !refDisplayPreviewInput) return;

  const specType = String(refSpecTypeSelect?.value || "TEXT").toUpperCase();
  const minVal = formatNumberForDisplay(refMinValueInput?.value?.trim());
  const maxVal = formatNumberForDisplay(refMaxValueInput?.value?.trim());
  const exactVal = formatNumberForDisplay(refExactValueInput?.value?.trim());
  const textVal = refTextValueInput?.value?.trim() ?? "";
  const passFailVal = refPassFailValueSelect?.value?.trim() ?? "";
  const targetVal = formatNumberForDisplay(refTargetValueInput?.value?.trim());
  const toleranceVal = formatNumberForDisplay(
    refToleranceValueInput?.value?.trim(),
  );

  let preview = "";
  if (specType === "RANGE") {
    preview = minVal && maxVal ? `${minVal} - ${maxVal}` : "";
    preview = appendUomIfNeeded(preview, pendingRefRow);
  } else if (specType === "MIN_ONLY") {
    preview = minVal ? `NLT ${minVal}` : "";
    preview = appendUomIfNeeded(preview, pendingRefRow);
  } else if (specType === "MAX_ONLY") {
    preview = maxVal ? `NMT ${maxVal}` : "";
    preview = appendUomIfNeeded(preview, pendingRefRow);
  } else if (specType === "EXACT_NUMERIC") {
    preview = exactVal ? appendUomIfNeeded(exactVal, pendingRefRow) : "";
  } else if (specType === "TOLERANCE") {
    preview = buildRefToleranceDisplayPreview(
      targetVal,
      toleranceVal,
      pendingRefRow,
    );
  } else if (specType === "PASS_FAIL") {
    preview = passFailVal;
  } else {
    preview = textVal;
  }

  refDisplayPreviewInput.value = preview;
}

function getReferenceSourceRowId(row) {
  if (!row) return null;
  const id = row.id ?? row.reference_source_id;
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractReferenceSourceIdFromRpcData(data) {
  if (data == null) return null;

  if (typeof data === "number") {
    return Number.isFinite(data) && data > 0 ? data : null;
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (Array.isArray(data)) {
    if (!data.length) return null;
    return extractReferenceSourceIdFromRpcData(data[0]);
  }

  if (typeof data === "object") {
    return getReferenceSourceRowId(data);
  }

  return null;
}

function extractReferenceSourceDisplayFromRpcData(data) {
  if (data == null) return "";
  if (Array.isArray(data)) {
    return data.length ? extractReferenceSourceDisplayFromRpcData(data[0]) : "";
  }
  if (typeof data === "object") {
    return getReferenceSourceRowDisplay(data);
  }
  return "";
}

function parseSubmitReferenceProposalResponse(data) {
  if (data == null) return { ok: true };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { ok: true };

  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "").trim(),
      message: String(
        row.message ?? "Reference proposal was not accepted.",
      ).trim(),
      existingRequestId: row.existing_request_id ?? null,
      requestCreated: row.request_created === true,
      lockCreated: row.lock_created === true,
    };
  }

  return {
    ok: true,
    requestCreated: row.request_created !== false,
    lockCreated: row.lock_created === true,
  };
}

function getReferenceSourceRowDisplay(row) {
  if (!row) return "";
  return String(
    row.reference_source_display ??
      row.display_text ??
      row.display_name ??
      "",
  ).trim();
}

function normalizeDoiInput(value) {
  let v = String(value ?? "").trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  v = v.replace(/^doi:\s*/i, "");
  return v.trim();
}

function isValidDoi(value) {
  const doi = normalizeDoiInput(value);
  if (!doi) return false;
  return /^10\.\d{4,9}\/\S+$/i.test(doi);
}

function optionalPayloadText(el) {
  const v = String(el?.value ?? "").trim();
  return v || null;
}

function optionalPayloadNumber(el) {
  const raw = String(el?.value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

function resetReferenceSourceCreateForm() {
  const fields = [
    refSourceCreateDisplayName,
    refSourceInHouseCode,
    refSourceDoiInput,
    refSourceCreateCitation,
    refSourceCreateSourceTitle,
    refSourceCreatePart,
    refSourceCreateVolume,
    refSourceCreateEdition,
    refSourceCreatePubYear,
    refSourceCreatePublisher,
    refSourceCreateAuthorEditor,
    refSourceCreateCommentator,
    refSourceCreateChapterSection,
    refSourceCreatePageFrom,
    refSourceCreatePageTo,
    refSourceCreateArticleTitle,
    refSourceCreateJournal,
    refSourceCreateAuthors,
    refSourceCreatePaperYear,
    refSourceCreatePaperPublisher,
    refSourceCreateRemarks,
  ];
  fields.forEach((el) => {
    if (el) el.value = "";
  });
  refSourceDoiMetadata = null;
  refSourceLastLookupDoi = null;
  if (refSourceDetailFields) refSourceDetailFields.open = false;
  if (refSourcePaperDetailFields) refSourcePaperDetailFields.open = false;
}

function resetReferenceSourceState() {
  refSourceMode = "existing";
  refSourceType = REF_SOURCE_TYPE_DEFAULT;
  refSelectedSourceId = null;
  refSelectedSourceDisplay = "";
  refSourceSearchRows = [];
  refSourceSearchLoading = false;
  refSourceSaving = false;
  if (refSourceSearchTimer) {
    clearTimeout(refSourceSearchTimer);
    refSourceSearchTimer = null;
  }
  refDoiLookupLoading = false;
  refSourceDoiMetadata = null;
  refSourceLastLookupDoi = null;
  if (refSourceTypeSelect) refSourceTypeSelect.value = REF_SOURCE_TYPE_DEFAULT;
  if (refSourceModeExisting) refSourceModeExisting.checked = true;
  if (refSourceModeCreate) refSourceModeCreate.checked = false;
  if (refSourceSearchInput) refSourceSearchInput.value = "";
  if (refSourceSearchStatus) refSourceSearchStatus.textContent = "";
  if (refSourceResultsList) refSourceResultsList.innerHTML = "";
  if (refSourceSelectedSummary) refSourceSelectedSummary.style.display = "none";
  if (refSourceSelectedLabel) refSourceSelectedLabel.textContent = "";
  resetReferenceSourceCreateForm();
  applyReferenceSourceUI();
}

function updateRefSourceSearchStatus() {
  if (!refSourceSearchStatus) return;
  if (refSourceSearchLoading) {
    refSourceSearchStatus.textContent = "Searching…";
    return;
  }
  if (refSourceMode !== "existing") {
    refSourceSearchStatus.textContent = "";
    return;
  }
  if (refSourceSearchRows.length) {
    refSourceSearchStatus.textContent = "";
    return;
  }
  const q = refSourceSearchInput?.value.trim() ?? "";
  refSourceSearchStatus.textContent = q
    ? "No matching sources."
    : "Showing recent sources for this type.";
}

function updateRefSourceSelectedSummary() {
  if (!refSourceSelectedSummary || !refSourceSelectedLabel) return;
  if (refSelectedSourceId && refSelectedSourceDisplay) {
    refSourceSelectedSummary.style.display = "";
    refSourceSelectedLabel.textContent = refSelectedSourceDisplay;
  } else {
    refSourceSelectedSummary.style.display = "none";
    refSourceSelectedLabel.textContent = "";
  }
}

function renderReferenceSourceResults(results) {
  if (!refSourceResultsList) return;
  const rows = Array.isArray(results) ? results : [];
  if (!rows.length) {
    refSourceResultsList.innerHTML = refSourceSearchLoading
      ? ""
      : '<div class="ref-source-result-empty">No matching sources.</div>';
    return;
  }
  refSourceResultsList.innerHTML = rows
    .map((row) => {
      const id = getReferenceSourceRowId(row);
      if (id == null) return "";
      const label =
        getReferenceSourceRowDisplay(row) || `Source #${id}`;
      const selected =
        String(id) === String(refSelectedSourceId)
          ? " ref-source-result-selected"
          : "";
      return `<button type="button" class="ref-source-result${selected}" data-source-id="${esc(String(id))}" data-source-display="${esc(label)}">${esc(label)}</button>`;
    })
    .join("");
}

function selectReferenceSource(source) {
  const id =
    typeof source === "object"
      ? getReferenceSourceRowId(source)
      : Number(source);
  if (id == null || Number.isNaN(id)) return;
  const display =
    typeof source === "object"
      ? getReferenceSourceRowDisplay(source)
      : refSelectedSourceDisplay;
  refSelectedSourceId = id;
  refSelectedSourceDisplay = String(display || "").trim() || `Source #${id}`;
  if (
    typeof source === "object" &&
    String(source.source_type ?? "").trim()
  ) {
    refSourceType = String(source.source_type).toUpperCase();
    if (refSourceTypeSelect) refSourceTypeSelect.value = refSourceType;
    applyReferenceSourceUI();
  }
  updateRefSourceSelectedSummary();
  renderReferenceSourceResults(refSourceSearchRows);
}

function clearReferenceSourceSelection() {
  refSelectedSourceId = null;
  refSelectedSourceDisplay = "";
  updateRefSourceSelectedSummary();
  renderReferenceSourceResults(refSourceSearchRows);
}

async function searchReferenceSources(query, sourceType) {
  refSourceSearchLoading = true;
  updateRefSourceSearchStatus();
  renderReferenceSourceResults(refSourceSearchRows);
  try {
    const { data, error } = await labSupabase.rpc(
      "fn_search_reference_sources",
      {
        p_query: query?.trim() || null,
        p_source_type: sourceType || null,
        p_limit: 6,
      },
    );
    if (error) throw error;
    refSourceSearchRows = Array.isArray(data) ? data : [];
    renderReferenceSourceResults(refSourceSearchRows);
    updateRefSourceSearchStatus();
    return refSourceSearchRows;
  } catch (err) {
    console.error("[AW] reference source search failed:", err);
    refSourceSearchRows = [];
    renderReferenceSourceResults([]);
    if (refSourceSearchStatus) {
      refSourceSearchStatus.textContent = "Search failed. Try again.";
    }
    return [];
  } finally {
    refSourceSearchLoading = false;
    updateRefSourceSearchStatus();
  }
}

function scheduleReferenceSourceSearch() {
  if (refSourceMode !== "existing") return;
  if (refSourceSearchTimer) clearTimeout(refSourceSearchTimer);
  refSourceSearchTimer = setTimeout(() => {
    refSourceSearchTimer = null;
    searchReferenceSources(
      refSourceSearchInput?.value ?? "",
      refSourceTypeSelect?.value ?? refSourceType,
    );
  }, REF_SOURCE_SEARCH_DEBOUNCE_MS);
}

function findDefaultInHouseSource(results) {
  const rows = Array.isArray(results) ? results : [];
  return (
    rows.find((r) => r.is_default === true) ||
    rows.find((r) =>
      /in-house standard/i.test(getReferenceSourceRowDisplay(r)),
    ) ||
    rows[0] ||
    null
  );
}

async function ensureDefaultReferenceSourceSelected() {
  const results = await searchReferenceSources(
    null,
    REF_SOURCE_TYPE_DEFAULT,
  );
  const defaultRow = findDefaultInHouseSource(results);
  if (!defaultRow) return false;
  const id = getReferenceSourceRowId(defaultRow);
  if (id == null) return false;
  refDefaultInHouseSourceId = id;
  selectReferenceSource(defaultRow);
  return true;
}

async function resolveDefaultInHouseSourceId() {
  if (refDefaultInHouseSourceId) return refDefaultInHouseSourceId;
  const results = await searchReferenceSources(
    null,
    REF_SOURCE_TYPE_DEFAULT,
  );
  const defaultRow = findDefaultInHouseSource(results);
  const id = getReferenceSourceRowId(defaultRow);
  if (id != null) refDefaultInHouseSourceId = id;
  return refDefaultInHouseSourceId;
}

function applyReferenceSourceUI() {
  refSourceType = String(
    refSourceTypeSelect?.value || REF_SOURCE_TYPE_DEFAULT,
  ).toUpperCase();
  refSourceMode = refSourceModeCreate?.checked ? "create" : "existing";

  if (refSourceExistingPanel) {
    refSourceExistingPanel.style.display =
      refSourceMode === "existing" ? "" : "none";
  }
  if (refSourceCreatePanel) {
    refSourceCreatePanel.style.display =
      refSourceMode === "create" ? "" : "none";
  }

  const isPaper = refSourceType === "RESEARCH_PAPER";
  const isInHouse = refSourceType === "IN_HOUSE_STANDARD";
  const isOther = refSourceType === "OTHER";
  const hasBibliographic = REF_SOURCE_BIBLIO_TYPES.has(refSourceType);

  if (refSourceCreateDisplayNameField) {
    refSourceCreateDisplayNameField.style.display = isPaper ? "none" : "";
  }
  if (refSourceInHouseFields) {
    refSourceInHouseFields.style.display = isInHouse ? "" : "none";
  }
  if (refSourcePaperFields) {
    refSourcePaperFields.style.display = isPaper ? "" : "none";
  }
  if (refSourceCreateCitationField) {
    refSourceCreateCitationField.style.display =
      isOther || isPaper ? "none" : "";
  }
  if (refSourceDetailFields) {
    refSourceDetailFields.style.display = hasBibliographic ? "" : "none";
  }
  if (refSourcePaperDetailFields) {
    refSourcePaperDetailFields.style.display = isPaper ? "" : "none";
  }
  if (refSourceCreateRemarksField) {
    refSourceCreateRemarksField.style.display = "";
  }

  updateRefSourceSelectedSummary();
  setRefSourceDoiLookupButtonState();
  updateReferenceSourceCitationPreview();
}

function getReferenceSourceCitationPreviewText() {
  const displayName = String(refSourceCreateDisplayName?.value ?? "").trim();
  if (displayName) return displayName;
  const citation = String(refSourceCreateCitation?.value ?? "").trim();
  if (citation) return citation;
  const doiRaw = refSourceDoiInput?.value ?? "";
  const doi = normalizeDoiInput(doiRaw);
  if (doi && isValidDoi(doiRaw)) return `DOI: ${doi}`;
  return "";
}

function updateReferenceSourceCitationPreview() {
  if (!refSourceCitationPreviewWrap || !refSourceCitationPreviewText) return;
  const showPaperCreate =
    refSourceMode === "create" &&
    String(refSourceTypeSelect?.value || refSourceType).toUpperCase() ===
      "RESEARCH_PAPER";
  if (!showPaperCreate) {
    refSourceCitationPreviewWrap.style.display = "none";
    refSourceCitationPreviewText.textContent = "";
    return;
  }
  const text = getReferenceSourceCitationPreviewText();
  if (!text) {
    refSourceCitationPreviewWrap.style.display = "none";
    refSourceCitationPreviewText.textContent = "";
    return;
  }
  refSourceCitationPreviewWrap.style.display = "";
  refSourceCitationPreviewText.textContent = text;
}

function handleRefSourceDoiInputChange() {
  const normalized = normalizeDoiInput(refSourceDoiInput?.value ?? "");
  if (refSourceLastLookupDoi && normalized !== refSourceLastLookupDoi) {
    refSourceDoiMetadata = null;
    refSourceLastLookupDoi = null;
    if (refSourceCreateDisplayName) refSourceCreateDisplayName.value = "";
  }
  setRefSourceDoiLookupButtonState();
  updateReferenceSourceCitationPreview();
}

function fillEmptyReferenceSourceInput(el, value) {
  if (!el) return;
  if (String(el.value ?? "").trim()) return;
  if (value == null || value === "") return;
  el.value = String(value);
}

function setRefSourceDoiLookupButtonState() {
  if (!btnRefSourceDoiLookup) return;
  const show =
    refSourceMode === "create" &&
    String(refSourceTypeSelect?.value || refSourceType).toUpperCase() ===
      "RESEARCH_PAPER";
  btnRefSourceDoiLookup.style.display = show ? "" : "none";
  if (!show) {
    btnRefSourceDoiLookup.disabled = true;
    btnRefSourceDoiLookup.textContent = "Look up DOI";
    return;
  }
  const doiRaw = refSourceDoiInput?.value ?? "";
  const canLookup = !refDoiLookupLoading && isValidDoi(doiRaw);
  btnRefSourceDoiLookup.disabled = !canLookup;
  btnRefSourceDoiLookup.textContent = refDoiLookupLoading
    ? "Looking up…"
    : "Look up DOI";
}

async function lookupReferenceDoi() {
  if (refDoiLookupLoading) return;
  const doiRaw = refSourceDoiInput?.value ?? "";
  const normalizedDoi = normalizeDoiInput(doiRaw);
  if (!normalizedDoi || !isValidDoi(doiRaw)) {
    toast("Enter a valid DOI (for example 10.1234/example).", "warn");
    refSourceDoiInput?.focus();
    return;
  }

  refDoiLookupLoading = true;
  setRefSourceDoiLookupButtonState();
  try {
    const { data, error } = await supabase.functions.invoke(
      "lookup-reference-doi",
      { body: { doi: normalizedDoi } },
    );
    if (error) throw error;

    const result = data && typeof data === "object" ? data : {};
    if (result.ok !== true) {
      toast(
        String(result.message || "No metadata found for this DOI.").trim(),
        "warn",
        5000,
      );
      return;
    }

    fillEmptyReferenceSourceInput(
      refSourceCreateDisplayName,
      result.display_name,
    );
    fillEmptyReferenceSourceInput(
      refSourceCreateCitation,
      result.short_citation,
    );
    fillEmptyReferenceSourceInput(
      refSourceCreateArticleTitle,
      result.article_title,
    );
    fillEmptyReferenceSourceInput(refSourceCreateJournal, result.journal_name);
    fillEmptyReferenceSourceInput(refSourceCreateAuthors, result.authors_text);
    fillEmptyReferenceSourceInput(
      refSourceCreatePaperYear,
      result.publication_year,
    );
    fillEmptyReferenceSourceInput(
      refSourceCreatePaperPublisher,
      result.publisher,
    );

    refSourceDoiMetadata =
      result.metadata_json && typeof result.metadata_json === "object"
        ? result.metadata_json
        : null;

    const hasArticleDetails =
      result.article_title ||
      result.journal_name ||
      result.authors_text ||
      result.publication_year ||
      result.publisher;
    if (refSourcePaperDetailFields && hasArticleDetails) {
      refSourcePaperDetailFields.open = true;
    }

    refSourceLastLookupDoi = normalizedDoi;
    updateReferenceSourceCitationPreview();
    toast("DOI details filled. Please review before saving.", "success", 4000);
  } catch (err) {
    console.error("[AW] DOI lookup failed:", err);
    toast("DOI lookup failed. You can still save DOI-only.", "warn", 5000);
  } finally {
    refDoiLookupLoading = false;
    setRefSourceDoiLookupButtonState();
  }
}

function collectBibliographicPayload() {
  return {
    source_title: optionalPayloadText(refSourceCreateSourceTitle),
    part: optionalPayloadText(refSourceCreatePart),
    volume: optionalPayloadText(refSourceCreateVolume),
    edition: optionalPayloadText(refSourceCreateEdition),
    publication_year: optionalPayloadNumber(refSourceCreatePubYear),
    publisher: optionalPayloadText(refSourceCreatePublisher),
    author_editor: optionalPayloadText(refSourceCreateAuthorEditor),
    commentator: optionalPayloadText(refSourceCreateCommentator),
    chapter_section: optionalPayloadText(refSourceCreateChapterSection),
    page_from: optionalPayloadText(refSourceCreatePageFrom),
    page_to: optionalPayloadText(refSourceCreatePageTo),
  };
}

function collectReferenceSourcePayload() {
  const sourceType = String(
    refSourceTypeSelect?.value || refSourceType,
  ).toUpperCase();
  const payload = {
    short_citation: optionalPayloadText(refSourceCreateCitation),
    remarks: optionalPayloadText(refSourceCreateRemarks),
  };

  if (sourceType === "RESEARCH_PAPER") {
    const doiRaw = refSourceDoiInput?.value ?? "";
    const doi = normalizeDoiInput(doiRaw);
    if (!doi) {
      toast("Research paper source requires a DOI.", "warn");
      refSourceDoiInput?.focus();
      return null;
    }
    if (!isValidDoi(doiRaw)) {
      toast(
        "Enter a valid DOI (for example 10.1234/example).",
        "warn",
      );
      refSourceDoiInput?.focus();
      return null;
    }
    let displayName = String(refSourceCreateDisplayName?.value ?? "").trim();
    if (!displayName) displayName = `DOI: ${doi}`;
    payload.display_name = displayName;
    payload.doi = doi;
    payload.short_citation =
      optionalPayloadText(refSourceCreateCitation) ?? payload.short_citation;
    payload.article_title = optionalPayloadText(refSourceCreateArticleTitle);
    payload.journal = optionalPayloadText(refSourceCreateJournal);
    payload.authors = optionalPayloadText(refSourceCreateAuthors);
    payload.publication_year = optionalPayloadNumber(refSourceCreatePaperYear);
    payload.publisher = optionalPayloadText(refSourceCreatePaperPublisher);
    if (refSourceDoiMetadata) {
      payload.metadata_json = refSourceDoiMetadata;
    }
    return payload;
  }

  const displayName = String(refSourceCreateDisplayName?.value ?? "").trim();
  if (!displayName) {
    toast("Display name is required for a new reference source.", "warn");
    refSourceCreateDisplayName?.focus();
    return null;
  }
  payload.display_name = displayName;

  if (sourceType === "IN_HOUSE_STANDARD") {
    payload.internal_reference_code = optionalPayloadText(refSourceInHouseCode);
    return payload;
  }

  if (sourceType === "OTHER") {
    return payload;
  }

  if (REF_SOURCE_BIBLIO_TYPES.has(sourceType)) {
    Object.assign(payload, collectBibliographicPayload());
    return payload;
  }

  return payload;
}

async function resolveReferenceSourceId() {
  if (refSourceSaving) return null;
  if (refSourceMode === "existing") {
    if (!refSelectedSourceId) {
      toast("Select a reference source.", "warn");
      return null;
    }
    return refSelectedSourceId;
  }

  const sourceType = String(
    refSourceTypeSelect?.value || refSourceType,
  ).toUpperCase();
  const payload = collectReferenceSourcePayload();
  if (!payload) return null;

  refSourceSaving = true;
  try {
    const { data, error } = await labSupabase.rpc(
      "fn_upsert_reference_source",
      {
        p_user_id: userId,
        p_source_type: sourceType,
        p_payload: payload,
      },
    );
    if (error) throw error;
    const id = extractReferenceSourceIdFromRpcData(data);
    if (id == null) {
      throw new Error("Server did not return a reference source id.");
    }
    const display =
      extractReferenceSourceDisplayFromRpcData(data) || payload.display_name;
    refSelectedSourceId = id;
    refSelectedSourceDisplay = display || `Source #${id}`;
    if (sourceType === REF_SOURCE_TYPE_DEFAULT) {
      refDefaultInHouseSourceId = id;
    }
    updateRefSourceSelectedSummary();
    return id;
  } finally {
    refSourceSaving = false;
  }
}

async function initReferenceSourceOnOpen(row) {
  resetReferenceSourceState();

  const effectiveId = row?.effective_reference_source_id;
  const effectiveDisplay = String(
    row?.effective_reference_source_display ?? "",
  ).trim();

  if (effectiveId != null && effectiveId !== "") {
    selectReferenceSource({
      id: effectiveId,
      reference_source_display: effectiveDisplay,
    });
    await searchReferenceSources("", refSourceType);
    return;
  }

  await ensureDefaultReferenceSourceSelected();
}

function openReferenceModal(row) {
  pendingRefRow = row;
  openReferenceModalAsync(row);
}

async function openReferenceModalAsync(row) {
  await ensureRefToleranceUomPicker();
  const refRequired = row.reference_capture_required === true;
  refModalTitle.textContent = `${refRequired ? "Add Reference" : "Modify Reference"} — ${row.test_name ?? "Test"}`;
  const specDisplay = formatAnalysisSpecDisplay(row);
  refModalSub.textContent = `Current specification: ${specDisplay}`;

  const allowedTypes = getAllowedReferenceSpecTypes(row);
  const normalizedType = normalizeReferenceSpecType(row.spec_type_snapshot);
  const selectedType = allowedTypes.includes(normalizedType)
    ? normalizedType
    : allowedTypes[0];

  Array.from(refSpecTypeSelect.options).forEach((opt) => {
    opt.hidden = !allowedTypes.includes(opt.value);
  });
  refSpecTypeSelect.value = selectedType;

  refMinValueInput.value =
    row.min_value_snapshot == null ? "" : String(row.min_value_snapshot);
  refMaxValueInput.value =
    row.max_value_snapshot == null ? "" : String(row.max_value_snapshot);
  refExactValueInput.value =
    row.min_value_snapshot == null ? "" : String(row.min_value_snapshot);
  refTextValueInput.value = row.text_value_snapshot ?? "";
  refPassFailValueSelect.value = row.text_value_snapshot ?? "Absent";
  refTargetValueInput.value =
    row.target_value_snapshot == null
      ? ""
      : String(row.target_value_snapshot);
  refToleranceValueInput.value =
    row.tolerance_value_snapshot == null
      ? ""
      : String(row.tolerance_value_snapshot);
  populateRefToleranceUomSelect(row.tolerance_uom_id_snapshot);
  refDisplayPreviewInput.value = row.spec_display_snapshot ?? "";
  const unitLabel = getRowUnitLabel(row);
  if (refUomDisplayInput) {
    refUomDisplayInput.value = unitLabel || "No unit configured";
  }
  if (
    !unitLabel &&
    String(row?.uom_code_snapshot ?? "").toUpperCase() !== "NONE"
  ) {
    console.debug("[AW] Missing unit for result row", {
      analysis_result_id: row.analysis_result_id,
      test_name: row.test_name,
      test_id: row.test_id,
      uom_id_snapshot: row.uom_id_snapshot,
      uom_code_snapshot: row.uom_code_snapshot,
      uom_symbol_snapshot: row.uom_symbol_snapshot,
    });
  }
  if (refScopeAnalysisOnly) refScopeAnalysisOnly.checked = true;
  if (refScopeProduct) refScopeProduct.checked = false;
  if (refScopeFamily) refScopeFamily.checked = false;
  refNoteInput.value = "";

  await initReferenceSourceOnOpen(row);

  applyReferenceSpecTypeUI();
  updateReferenceDisplayPreview();
  referenceModal.classList.add("open");

  if (selectedType === "RANGE" || selectedType === "MIN_ONLY") {
    refMinValueInput.focus();
  } else if (selectedType === "MAX_ONLY") {
    refMaxValueInput.focus();
  } else if (selectedType === "EXACT_NUMERIC") {
    refExactValueInput.focus();
  } else if (selectedType === "TOLERANCE") {
    refTargetValueInput.focus();
  } else if (selectedType === "PASS_FAIL") {
    refPassFailValueSelect.focus();
  } else {
    refTextValueInput.focus();
  }
}

function closeReferenceModal() {
  referenceModal.classList.remove("open");
  pendingRefRow = null;
  if (refSpecTypeSelect) refSpecTypeSelect.value = "TEXT";
  if (refMinValueInput) refMinValueInput.value = "";
  if (refMaxValueInput) refMaxValueInput.value = "";
  if (refExactValueInput) refExactValueInput.value = "";
  if (refTextValueInput) refTextValueInput.value = "";
  if (refPassFailValueSelect) refPassFailValueSelect.value = "Absent";
  if (refTargetValueInput) refTargetValueInput.value = "";
  if (refToleranceValueInput) refToleranceValueInput.value = "";
  if (refToleranceUomSelect) refToleranceUomSelect.value = "";
  if (refDisplayPreviewInput) refDisplayPreviewInput.value = "";
  if (refScopeAnalysisOnly) refScopeAnalysisOnly.checked = true;
  if (refScopeProduct) refScopeProduct.checked = false;
  if (refScopeFamily) refScopeFamily.checked = false;
  refNoteInput.value = "";
  resetReferenceSourceState();
}

async function saveReference() {
  if (!pendingRefRow) return;
  if (!statusAllowsAnalysisAction("CREATE_REFERENCE_EXCEPTION")) {
    toast(
      "Reference changes are not allowed at the current workflow stage.",
      "warn",
      4000,
    );
    return;
  }
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, "CREATE_REFERENCE_EXCEPTION")) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }

  const specType = String(refSpecTypeSelect.value || "TEXT").toUpperCase();
  const minRaw = refMinValueInput.value.trim();
  const maxRaw = refMaxValueInput.value.trim();
  const exactRaw = refExactValueInput.value.trim();
  const textRaw = refTextValueInput.value.trim();
  const passFailRaw = refPassFailValueSelect.value.trim();
  const targetRaw = refTargetValueInput?.value.trim() ?? "";
  const toleranceRaw = refToleranceValueInput?.value.trim() ?? "";

  let minVal = null;
  let maxVal = null;
  let textVal = null;
  let targetVal = null;
  let toleranceVal = null;
  let toleranceUomId = null;

  if (specType === "RANGE") {
    if (!minRaw || !maxRaw) {
      toast(
        "Range specification requires both Min Value and Max Value.",
        "warn",
      );
      return;
    }
    minVal = parseDecimalOrNull(minRaw);
    if (Number.isNaN(minVal)) {
      toast("Min Value must be a valid number.", "warn");
      refMinValueInput.focus();
      return;
    }
    maxVal = parseDecimalOrNull(maxRaw);
    if (Number.isNaN(maxVal)) {
      toast("Max Value must be a valid number.", "warn");
      refMaxValueInput.focus();
      return;
    }
  } else if (specType === "MIN_ONLY") {
    if (!minRaw) {
      toast("Min-only specification requires Min Value.", "warn");
      return;
    }
    minVal = parseDecimalOrNull(minRaw);
    if (Number.isNaN(minVal)) {
      toast("Min Value must be a valid number.", "warn");
      refMinValueInput.focus();
      return;
    }
  } else if (specType === "MAX_ONLY") {
    if (!maxRaw) {
      toast("Max-only specification requires Max Value.", "warn");
      return;
    }
    maxVal = parseDecimalOrNull(maxRaw);
    if (Number.isNaN(maxVal)) {
      toast("Max Value must be a valid number.", "warn");
      refMaxValueInput.focus();
      return;
    }
  } else if (specType === "EXACT_NUMERIC") {
    if (!exactRaw) {
      toast("Exact numeric specification requires Exact Value.", "warn");
      return;
    }
    minVal = parseDecimalOrNull(exactRaw);
    if (Number.isNaN(minVal)) {
      toast("Exact Value must be a valid number.", "warn");
      refExactValueInput.focus();
      return;
    }
    maxVal = minVal;
  } else if (specType === "TOLERANCE") {
    if (!REFERENCE_PROPOSAL_SUPPORTS_TOLERANCE) {
      toast(
        "TOLERANCE reference proposals require server RPC support (p_target_value, p_tolerance_value, p_tolerance_uom_id).",
        "warn",
        5000,
      );
      return;
    }
    if (!targetRaw || !toleranceRaw) {
      toast("TOLERANCE requires Target Value and Tolerance Value.", "warn");
      return;
    }
    targetVal = parseDecimalOrNull(targetRaw);
    if (Number.isNaN(targetVal)) {
      toast("Target Value must be a valid number.", "warn");
      refTargetValueInput.focus();
      return;
    }
    toleranceVal = parseDecimalOrNull(toleranceRaw);
    if (Number.isNaN(toleranceVal)) {
      toast("Tolerance Value must be a valid number.", "warn");
      refToleranceValueInput.focus();
      return;
    }
    const tolUomRaw = refToleranceUomSelect?.value || "";
    if (!tolUomRaw) {
      toast("TOLERANCE requires Tolerance UOM.", "warn");
      refToleranceUomSelect?.focus();
      return;
    }
    toleranceUomId = Number(tolUomRaw);
    minVal = null;
    maxVal = null;
    textVal = null;
  } else if (specType === "PASS_FAIL") {
    if (!passFailRaw) {
      toast("PASS/FAIL specification requires a selected value.", "warn");
      return;
    }
    textVal = passFailRaw;
  } else if (specType === "TEXT") {
    if (!textRaw) {
      toast("Text specification requires Text Value.", "warn");
      return;
    }
    textVal = textRaw;
  } else {
    toast(`Unsupported spec type: ${specType}`, "warn");
    return;
  }

  updateReferenceDisplayPreview();
  const displayText = refDisplayPreviewInput.value.trim();
  if (!displayText) {
    toast(
      "Display Preview is empty. Please enter valid reference inputs.",
      "warn",
    );
    return;
  }

  const note = refNoteInput.value.trim() || null;
  const requestScope = refScopeProduct?.checked
    ? "PRODUCT"
    : refScopeFamily?.checked
      ? "FAMILY"
      : "ANALYSIS_ONLY";

  let referenceSourceId;
  try {
    referenceSourceId = await resolveReferenceSourceId();
  } catch (err) {
    toast(`Failed to resolve reference source: ${err.message}`, "error", 5000);
    return;
  }
  if (!referenceSourceId) return;

  btnRefSave.disabled = true;
  showLoading();
  try {
    const { data, error } = await labSupabase.rpc(
      "fn_submit_analysis_reference_proposal",
      {
        p_user_id: userId,
        p_analysis_result_id: pendingRefRow.analysis_result_id,
        p_spec_type: specType,
        p_min_value: minVal,
        p_max_value: maxVal,
        p_text_value: textVal,
        p_target_value: targetVal,
        p_tolerance_value: toleranceVal,
        p_tolerance_uom_id: toleranceUomId,
        p_display_text: displayText,
        p_request_scope: requestScope,
        p_remarks: note,
        p_reference_source_id: referenceSourceId,
      },
    );
    if (error) throw error;

    const result = parseSubmitReferenceProposalResponse(data);
    if (!result.ok) {
      let message = result.message;
      if (result.existingRequestId != null && result.existingRequestId !== "") {
        message += ` Existing pending request ID: ${result.existingRequestId}.`;
      }
      const toastKind =
        result.code === "DUPLICATE_PENDING_SPEC_CHANGE_REQUEST"
          ? "warn"
          : "error";
      toast(message, toastKind, 5000);
      return;
    }

    toast(
      requestScope === "ANALYSIS_ONLY"
        ? "Reference saved for this analysis."
        : "Reference saved and submitted for specification review.",
      "success",
    );
    closeReferenceModal();
    await reloadAndRender();
  } catch (err) {
    toast(`Failed to save reference: ${err.message}`, "error", 5000);
  } finally {
    hideLoading();
    btnRefSave.disabled = false;
  }
}

async function grantException() {
  if (!pendingRefRow) return;
  if (!statusAllowsAnalysisAction("CREATE_REFERENCE_EXCEPTION")) {
    toast(
      "Reference changes are not allowed at the current workflow stage.",
      "warn",
      4000,
    );
    return;
  }
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, "CREATE_REFERENCE_EXCEPTION")) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }
  const note = refNoteInput.value.trim() || null;
  let referenceSourceId = refSelectedSourceId;
  if (!referenceSourceId) {
    referenceSourceId = await resolveDefaultInHouseSourceId();
  }
  btnAddException.disabled = true;
  showLoading();
  try {
    const { error } = await labSupabase.rpc("fn_create_reference_exception", {
      p_user_id: userId,
      p_analysis_result_id: pendingRefRow.analysis_result_id,
      p_display_text:
        "Reference not yet established - temporary first analysis entry",
      p_remarks: note,
      p_reference_source_id: referenceSourceId ?? null,
    });
    if (error) throw error;
    toast(
      "One-time exception granted. Result entry is now enabled (marked TEMP).",
      "warn",
      5000,
    );
    closeReferenceModal();
    await reloadAndRender();
  } catch (err) {
    toast(`Failed to grant exception: ${err.message}`, "error", 5000);
  } finally {
    hideLoading();
    btnAddException.disabled = false;
  }
}

// ── MULTI_VALUE result entry modal ──────────────────────────────────────────────

function canEnterMultiValueResult(row) {
  if (!row) return { ok: false, message: "Row not found." };
  if (row.reference_capture_required === true) {
    return { ok: false, message: "Reference required before entering result." };
  }
  if (isRowLocked(row.analysis_result_id)) {
    const lock = getRowLock(row.analysis_result_id);
    return {
      ok: false,
      message: String(
        lock?.lock_message || "Pending specification review exists.",
      ),
    };
  }
  if (isReadOnly || !statusAllowsAnalysisAction("ENTER_RESULT")) {
    return {
      ok: false,
      message: "Result entry is not allowed at the current workflow stage.",
    };
  }
  if (!analysisPermissionVerified) {
    return { ok: false, message: PERMISSION_VERIFY_FAILED_MESSAGE, kind: "error" };
  }
  if (!mayPerformAnalysisAction(analysisId, "ENTER_RESULT")) {
    return { ok: false, message: PERMISSION_DENIED_MESSAGE };
  }
  return { ok: true };
}

function getMultiValueActionLabel(row) {
  const hasResult = Boolean(
    String(row?.result_display ?? row?.result_text ?? "").trim(),
  );
  return hasResult ? "View / Edit Observations" : "Enter Observations";
}

function getMultiValueReferenceContext(row) {
  const target = parseDecimalOrNull(row?.target_value_snapshot);
  const tolerance = parseDecimalOrNull(row?.tolerance_value_snapshot);
  const isPercent = isPercentToleranceUom(row);
  let lower = null;
  let upper = null;
  if (target != null && tolerance != null && isPercent) {
    const delta = Math.abs((target * tolerance) / 100);
    lower = target - delta;
    upper = target + delta;
  }
  return {
    target,
    tolerance,
    isPercent,
    lower,
    upper,
    uom: getDisplayableUnit(row),
  };
}

function formatDeviationPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const sign = n >= 0 ? "" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function calculateMultiValuePreviewForObservation(row, observedValue) {
  const n = parseDecimalOrNull(observedValue);
  if (n == null || Number.isNaN(n)) return null;

  const ctx = getMultiValueReferenceContext(row);
  if (ctx.target == null || ctx.tolerance == null) return null;

  const deviation = n - ctx.target;
  const deviationPercent =
    ctx.target !== 0 ? (deviation / ctx.target) * 100 : null;

  let withinLimit = false;
  if (ctx.isPercent && deviationPercent != null) {
    withinLimit = Math.abs(deviationPercent) <= Math.abs(ctx.tolerance);
  } else if (ctx.lower != null && ctx.upper != null) {
    withinLimit = n >= ctx.lower && n <= ctx.upper;
  }

  return { deviation, deviationPercent, withinLimit };
}

function getObservationRowStatus(row, observation) {
  const hasValue =
    observation?.observed_value != null &&
    !Number.isNaN(Number(observation.observed_value));
  if (!hasValue) {
    return { statusKey: "pending", label: "Pending", deviationPct: null };
  }

  const serverValue = observation._serverObservedValue;
  const useServer =
    serverValue != null &&
    Number(serverValue) === Number(observation.observed_value) &&
    observation.server_is_within_limit != null &&
    observation.server_calculation_percent != null;

  if (useServer) {
    const within = observation.server_is_within_limit === true;
    return {
      statusKey: within ? "ok" : "fail",
      label: within ? "Within limit" : "Outside limit",
      deviationPct: Number(observation.server_calculation_percent),
    };
  }

  const preview = calculateMultiValuePreviewForObservation(
    row,
    observation.observed_value,
  );
  if (!preview || preview.deviationPercent == null) {
    return { statusKey: "pending", label: "Pending", deviationPct: null };
  }

  return {
    statusKey: preview.withinLimit ? "ok" : "fail",
    label: preview.withinLimit ? "Within limit" : "Outside limit",
    deviationPct: preview.deviationPercent,
  };
}

function mapLoadedObservations(data) {
  return (data ?? [])
    .map((r) => ({
      observation_no: Number(r.observation_no),
      observed_value:
        r.observed_value == null || r.observed_value === ""
          ? null
          : Number(r.observed_value),
      server_is_within_limit:
        r.is_within_limit === true
          ? true
          : r.is_within_limit === false
            ? false
            : null,
      server_calculation_percent:
        r.calculation_percent == null || r.calculation_percent === ""
          ? null
          : Number(r.calculation_percent),
      _serverObservedValue:
        r.observed_value == null || r.observed_value === ""
          ? null
          : Number(r.observed_value),
    }))
    .filter((r) => Number.isFinite(r.observation_no) && r.observation_no > 0)
    .sort((a, b) => a.observation_no - b.observation_no)
    .map((r, idx) => ({
      ...r,
      observation_no: idx + 1,
    }));
}

function renumberMultiValueObservations() {
  multiValueObservations.forEach((obs, idx) => {
    obs.observation_no = idx + 1;
  });
}

async function loadMultiValueObservations(analysisResultId) {
  const { data, error } = await labSupabase
    .from("v_analysis_result_observation")
    .select("*")
    .eq("analysis_result_id", analysisResultId)
    .order("observation_no", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadMultiValueSummary(analysisResultId) {
  const { data, error } = await labSupabase
    .from("v_analysis_result_calculation_summary")
    .select("*")
    .eq("analysis_result_id", analysisResultId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

function parseMultiValueSaveResponse(data) {
  if (data == null) return { ok: true };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { ok: true };
  if (row.ok === false) {
    return {
      ok: false,
      message: String(row.message ?? "Save failed.").trim(),
    };
  }
  return { ok: true };
}

function renderMultiValueModalMeta(row) {
  if (!mvModalMeta) return;
  const registerNo =
    analysisInfo?.analysis_register_no ?? row?.analysis_register_no ?? "—";
  const specDisplay = formatAnalysisSpecDisplay(row);
  const entryMode = row?.result_entry_mode ?? row?.input_mode ?? "—";
  const calcMode = row?.calculation_mode ?? "—";
  const rule = formatCalculationRuleLabel(row?.calculation_rule_code);
  mvModalMeta.innerHTML = `
    <div><strong>Register:</strong> ${esc(String(registerNo))}</div>
    <div><strong>Specification:</strong> ${esc(String(specDisplay))}</div>
    <div><strong>Entry mode:</strong> ${esc(String(entryMode))} · <strong>Calculation:</strong> ${esc(String(calcMode))}</div>
    <div><strong>Rule:</strong> ${esc(String(rule))}</div>`;
}

function renderMultiValueSummaryPanel(summary) {
  if (!mvSummarySection || !mvSummaryGrid) return;

  const fmtPct = (v) => {
    if (v == null || v === "") return "—";
    return formatDeviationPercent(v);
  };

  if (!summary) {
    mvSummarySection.hidden = true;
    mvSummaryGrid.innerHTML = "";
    return;
  }

  const items = [
    ["Final Status", summary.final_status ?? "—"],
    ["Reportable Result", summary.reportable_result_text ?? "—"],
    ["Average", formatNumberForDisplay(summary.calculated_average) || "—"],
    ["Min", formatNumberForDisplay(summary.calculated_min) || "—"],
    ["Max", formatNumberForDisplay(summary.calculated_max) || "—"],
    ["Max Deviation %", fmtPct(summary.max_deviation_percent)],
    [
      "Outside Limit Count",
      summary.outside_limit_count != null
        ? String(summary.outside_limit_count)
        : "—",
    ],
  ];

  mvSummarySection.hidden = false;
  mvSummaryGrid.innerHTML = items
    .map(
      ([label, val]) => `<div class="mv-summary-item">
      <span class="mv-summary-label">${esc(label)}</span>
      <span class="mv-summary-value">${esc(String(val))}</span>
    </div>`,
    )
    .join("");
}

function renderMultiValueOutsideList() {
  if (!mvOutsideListSection || !mvOutsideList) return;
  const row = pendingMultiValueRow;
  if (!row) {
    mvOutsideListSection.hidden = true;
    mvOutsideList.innerHTML = "";
    return;
  }

  syncMultiValueObservationsFromDom();
  const uom = getDisplayableUnit(row) || "";
  const outside = [];

  multiValueObservations.forEach((obs, idx) => {
    const status = getObservationRowStatus(row, obs);
    if (status.statusKey !== "fail") return;
    outside.push({
      rowNum: idx + 1,
      value: obs.observed_value,
      deviationPct: status.deviationPct,
    });
  });

  mvOutsideListSection.hidden = false;
  if (!outside.length) {
    mvOutsideListSection.classList.remove("mv-outside-has-fail");
    mvOutsideList.innerHTML =
      '<p class="mv-outside-none">All entered observations are within the current tolerance preview.</p>';
    return;
  }

  mvOutsideListSection.classList.add("mv-outside-has-fail");
  const lines = outside.map((o) => {
    const valText = formatNumberForDisplay(o.value);
    const uomText = uom ? ` ${uom}` : "";
    return `Row ${o.rowNum}: ${valText}${uomText}, deviation ${formatDeviationPercent(o.deviationPct)}`;
  });
  mvOutsideList.innerHTML = `<div class="mv-outside-title">Outside limit observations:</div><ul class="mv-outside-list">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

function renderMultiValueObservationRowHtml(obs, idx, uom) {
  const val =
    obs.observed_value == null ? "" : formatDecimalForInput(obs.observed_value);
  const status = pendingMultiValueRow
    ? getObservationRowStatus(pendingMultiValueRow, obs)
    : { statusKey: "pending", label: "Pending", deviationPct: null };
  const rowClass =
    status.statusKey === "ok"
      ? "mv-obs-row-ok"
      : status.statusKey === "fail"
        ? "mv-obs-row-fail"
        : "mv-obs-row-pending";
  const devText =
    status.deviationPct != null
      ? formatDeviationPercent(status.deviationPct)
      : "—";

  return `<tr class="${rowClass}" data-obs-row-index="${idx}">
    <td class="mv-obs-col-num">${esc(String(idx + 1))}</td>
    <td class="mv-obs-col-value">
      <input
        type="text"
        class="numeric-input mv-obs-input result-input"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        data-obs-index="${idx}"
        value="${esc(String(val))}"
        aria-label="Observation ${idx + 1}"
      />
    </td>
    <td class="mv-obs-col-uom">${esc(uom || "—")}</td>
    <td class="mv-obs-col-dev mv-obs-deviation" data-obs-index="${idx}">${esc(devText)}</td>
    <td class="mv-obs-col-status mv-obs-status" data-obs-index="${idx}">${esc(status.label)}</td>
    <td class="mv-obs-col-action">
      <button type="button" class="mv-obs-delete-btn" data-mv-delete-idx="${idx}" aria-label="Delete observation ${idx + 1}">Delete</button>
    </td>
  </tr>`;
}

function updateMultiValueObservationRowDisplay(idx) {
  if (!mvObsTableBody || !pendingMultiValueRow) return;
  const obs = multiValueObservations[idx];
  if (!obs) return;

  const tr = mvObsTableBody.querySelector(`tr[data-obs-row-index="${idx}"]`);
  if (!tr) return;

  const status = getObservationRowStatus(pendingMultiValueRow, obs);
  tr.classList.remove("mv-obs-row-ok", "mv-obs-row-fail", "mv-obs-row-pending");
  tr.classList.add(
    status.statusKey === "ok"
      ? "mv-obs-row-ok"
      : status.statusKey === "fail"
        ? "mv-obs-row-fail"
        : "mv-obs-row-pending",
  );

  const devCell = tr.querySelector(`.mv-obs-deviation[data-obs-index="${idx}"]`);
  const statusCell = tr.querySelector(`.mv-obs-status[data-obs-index="${idx}"]`);
  const devText =
    status.deviationPct != null
      ? formatDeviationPercent(status.deviationPct)
      : "—";
  if (devCell) devCell.textContent = devText;
  if (statusCell) statusCell.textContent = status.label;
}

function renderMultiValueObservationRows(preserveFocusIndex = null) {
  if (!mvObsTableBody) return;
  const uom = pendingMultiValueRow ? getDisplayableUnit(pendingMultiValueRow) : "";
  if (mvObsUomLabel) {
    mvObsUomLabel.textContent = uom ? `Unit: ${uom}` : "Unit: —";
  }

  const rowsHtml = multiValueObservations
    .map((obs, idx) => renderMultiValueObservationRowHtml(obs, idx, uom))
    .join("");

  const addRowHtml = `<tr class="mv-obs-add-row">
    <td colspan="6">
      <button type="button" class="btn-sm mv-add-obs-inline">+ Add Observation</button>
    </td>
  </tr>`;

  mvObsTableBody.innerHTML = rowsHtml + addRowHtml;
  renderMultiValueOutsideList();

  if (preserveFocusIndex != null) {
    const input = mvObsTableBody.querySelector(
      `input.mv-obs-input[data-obs-index="${preserveFocusIndex}"]`,
    );
    if (input) {
      input.focus();
      const len = input.value.length;
      try {
        input.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    }
  }
}

function syncMultiValueObservationsFromDom() {
  if (!mvObsTableBody) return;
  const inputs = mvObsTableBody.querySelectorAll(".mv-obs-input");
  inputs.forEach((input) => {
    const idx = Number(input.dataset.obsIndex);
    if (!Number.isFinite(idx) || idx < 0) return;
    if (!multiValueObservations[idx]) {
      multiValueObservations[idx] = {
        observation_no: idx + 1,
        observed_value: null,
      };
    }
    const raw = String(input.value ?? "").trim();
    if (!raw) {
      multiValueObservations[idx].observed_value = null;
      multiValueObservations[idx].observation_no = idx + 1;
      return;
    }
    const n = parseDecimalOrNull(raw);
    multiValueObservations[idx].observed_value = Number.isNaN(n) ? null : n;
    multiValueObservations[idx].observation_no = idx + 1;
  });
}

function appendMultiValueObservationRow(focusNewRow = false) {
  syncMultiValueObservationsFromDom();
  if (multiValueObservations.length >= MULTI_VALUE_MAX_OBS_ROWS) {
    toast(`Maximum ${MULTI_VALUE_MAX_OBS_ROWS} observation rows.`, "warn");
    return;
  }
  multiValueObservations.push({
    observation_no: multiValueObservations.length + 1,
    observed_value: null,
    server_is_within_limit: null,
    server_calculation_percent: null,
    _serverObservedValue: null,
  });
  renumberMultiValueObservations();
  const newIdx = multiValueObservations.length - 1;
  renderMultiValueObservationRows(focusNewRow ? newIdx : null);
}

function deleteMultiValueObservationRow(index) {
  syncMultiValueObservationsFromDom();
  if (!Number.isFinite(index) || index < 0 || index >= multiValueObservations.length) {
    return;
  }
  if (multiValueObservations.length <= 1) {
    multiValueObservations[0].observed_value = null;
    multiValueObservations[0].server_is_within_limit = null;
    multiValueObservations[0].server_calculation_percent = null;
    multiValueObservations[0]._serverObservedValue = null;
    toast("Cleared the observation value.", "info", 2200);
  } else {
    multiValueObservations.splice(index, 1);
  }
  renumberMultiValueObservations();
  renderMultiValueObservationRows();
}

function collectMultiValueObservationPayload() {
  syncMultiValueObservationsFromDom();
  const observations = [];
  let invalidCount = 0;

  multiValueObservations.forEach((obs, idx) => {
    const input = mvObsTableBody?.querySelector(
      `input.mv-obs-input[data-obs-index="${idx}"]`,
    );
    const raw = String(input?.value ?? "").trim();
    if (!raw) return;
    if (!isValidDecimalText(raw)) {
      invalidCount += 1;
      return;
    }
    const n = parseDecimalOrNull(raw);
    if (Number.isNaN(n) || n === null) {
      invalidCount += 1;
      return;
    }
    observations.push({
      observation_no: observations.length + 1,
      observed_value: n,
    });
  });

  if (invalidCount > 0) {
    return { error: "One or more observed values are not valid numbers." };
  }
  if (!observations.length) {
    return { error: "Enter at least one observed value." };
  }

  const remarks = String(mvRemarksInput?.value ?? "").trim() || null;
  return { observations, remarks };
}

function hasSavedMultiValueResult(row, observations, summary) {
  const hasResult = Boolean(
    String(row?.result_display ?? row?.result_text ?? "").trim(),
  );
  const hasLoadedObs = (observations ?? []).some(
    (o) =>
      o?.observed_value != null && !Number.isNaN(Number(o.observed_value)),
  );
  const hasSummary = summary != null && typeof summary === "object";
  return hasResult || hasLoadedObs || hasSummary;
}

function setMultiValueBusyState(isBusy) {
  if (mvSaveBtn) mvSaveBtn.disabled = isBusy;
  if (mvCancelBtn) mvCancelBtn.disabled = isBusy;
  if (mvAddObsRowBtn) mvAddObsRowBtn.disabled = isBusy;
  if (isBusy) {
    if (mvClearBtn) mvClearBtn.disabled = true;
  } else {
    updateMultiValueClearButtonState();
  }
}

function updateMultiValueClearButtonState() {
  if (!mvClearBtn) return;
  const canShow = hasSavedMultiValueResult(
    pendingMultiValueRow,
    multiValueObservations,
    multiValueCurrentSummary,
  );
  const busy = multiValueSaving || multiValueClearing;
  mvClearBtn.hidden = !canShow;
  mvClearBtn.disabled = busy || !canShow;
}

function resetMultiValueModalToBlank() {
  multiValueCurrentSummary = null;
  multiValueObservations = buildBlankObservations(getInitialBlankObservationCount());
  if (mvRemarksInput) mvRemarksInput.value = "";
  renderMultiValueSummaryPanel(null);
  renderMultiValueObservationRows();
  updateMultiValueClearButtonState();
}

function focusMultiValueObservationInput(index) {
  const input = mvObsTableBody?.querySelector(
    `input.mv-obs-input[data-obs-index="${index}"]`,
  );
  if (!input) return false;
  input.focus();
  const len = input.value.length;
  try {
    input.setSelectionRange(len, len);
  } catch {
    /* ignore */
  }
  return true;
}

function handleMultiValueObservationKeydown(event) {
  if (!event.target?.classList?.contains("mv-obs-input")) return;
  if (multiValueSaving || multiValueClearing) return;

  const idx = Number(event.target.dataset.obsIndex);
  if (!Number.isFinite(idx) || idx < 0) return;

  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "s" || event.key === "S")
  ) {
    event.preventDefault();
    saveMultiValueResult();
    return;
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === "Enter"
  ) {
    event.preventDefault();
    saveMultiValueResult();
    return;
  }

  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    if (idx > 0) focusMultiValueObservationInput(idx - 1);
    return;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    syncMultiValueObservationsFromDom();
    const nextIdx = idx + 1;
    if (nextIdx < multiValueObservations.length) {
      focusMultiValueObservationInput(nextIdx);
      return;
    }
    appendMultiValueObservationRow(true);
  }
}

function closeMultiValueResultModal() {
  if (multiValueSaving || multiValueClearing) return;
  closeMultiValueClearConfirmModal();
  multiValueResultModal?.classList.remove("open");
  pendingMultiValueRow = null;
  multiValueObservations = [];
  multiValueCurrentSummary = null;
  multiValueSaving = false;
  multiValueClearing = false;
  if (mvObsTableBody) mvObsTableBody.innerHTML = "";
  if (mvRemarksInput) mvRemarksInput.value = "";
  if (mvSummarySection) mvSummarySection.hidden = true;
  if (mvSummaryGrid) mvSummaryGrid.innerHTML = "";
  if (mvOutsideListSection) {
    mvOutsideListSection.hidden = true;
    mvOutsideListSection.classList.remove("mv-outside-has-fail");
  }
  if (mvOutsideList) mvOutsideList.innerHTML = "";
  if (mvClearBtn) {
    mvClearBtn.hidden = true;
    mvClearBtn.disabled = true;
  }
  setMultiValueBusyState(false);
}

async function openMultiValueResultModal(row) {
  const gate = canEnterMultiValueResult(row);
  if (!gate.ok) {
    toast(gate.message, gate.kind ?? "warn", 4000);
    return;
  }

  pendingMultiValueRow = row;
  if (mvModalTitle) {
    mvModalTitle.textContent = row.test_name ?? "Multi-value Entry";
  }
  if (mvModalSub) {
    mvModalSub.textContent = "Enter observed values for server-side calculation.";
  }
  renderMultiValueModalMeta(row);

  showLoading();
  try {
    const [obsRows, summary] = await Promise.all([
      loadMultiValueObservations(row.analysis_result_id),
      loadMultiValueSummary(row.analysis_result_id),
    ]);

    const mapped = mapLoadedObservations(obsRows);
    multiValueCurrentSummary = summary;
    multiValueObservations = mapped.length
      ? mapped
      : buildBlankObservations(getInitialBlankObservationCount());

    renderMultiValueSummaryPanel(summary);
    renderMultiValueObservationRows();
    if (mvRemarksInput) mvRemarksInput.value = "";
    updateMultiValueClearButtonState();
    multiValueResultModal?.classList.add("open");
  } catch (err) {
    console.error("[AW] multi-value load failed:", err);
    toast(
      `Could not load observations: ${err.message}. Opening blank grid.`,
      "warn",
      5000,
    );
    multiValueCurrentSummary = null;
    multiValueObservations = buildBlankObservations(getInitialBlankObservationCount());
    renderMultiValueSummaryPanel(null);
    renderMultiValueObservationRows();
    if (mvRemarksInput) mvRemarksInput.value = "";
    updateMultiValueClearButtonState();
    multiValueResultModal?.classList.add("open");
  } finally {
    hideLoading();
  }
}

async function saveMultiValueResult() {
  if (!pendingMultiValueRow || multiValueSaving) return;

  const gate = canEnterMultiValueResult(pendingMultiValueRow);
  if (!gate.ok) {
    toast(gate.message, gate.kind ?? "warn", 4000);
    return;
  }

  const collected = collectMultiValueObservationPayload();
  if (collected.error) {
    toast(collected.error, "warn", 4000);
    return;
  }

  multiValueSaving = true;
  setMultiValueBusyState(true);
  showLoading();

  try {
    const { data, error } = await labSupabase.rpc(
      "fn_save_multi_value_analysis_result",
      {
        p_user_id: userId,
        p_analysis_result_id: pendingMultiValueRow.analysis_result_id,
        p_observations: collected.observations,
        p_remarks: collected.remarks,
      },
    );
    if (error) throw error;

    const result = parseMultiValueSaveResponse(data);
    if (!result.ok) {
      toast(result.message, "error", 5000);
      return;
    }

    toast("Observations saved.", "success");
    closeMultiValueResultModal();
    await reloadAndRender();
  } catch (err) {
    const msg = String(err.message || "");
    if (msg.toLowerCase().includes("pending specification approval exists")) {
      toast(
        "Result entry blocked until specification review is completed.",
        "warn",
        5000,
      );
    } else {
      toast(`Save failed: ${msg}`, "error", 5000);
    }
  } finally {
    multiValueSaving = false;
    setMultiValueBusyState(false);
    hideLoading();
  }
}

function openMultiValueClearConfirmModal() {
  if (multiValueClearing) return;
  multiValueClearConfirmModal?.classList.add("open");
  window.setTimeout(() => mvClearConfirmCancelBtn?.focus(), 0);
}

function closeMultiValueClearConfirmModal() {
  if (multiValueClearing) return;
  multiValueClearConfirmModal?.classList.remove("open");
  if (mvClearConfirmProceedBtn) mvClearConfirmProceedBtn.disabled = false;
}

function clearMultiValueResult() {
  if (!pendingMultiValueRow || multiValueSaving || multiValueClearing) return;

  const gate = canEnterMultiValueResult(pendingMultiValueRow);
  if (!gate.ok) {
    toast(gate.message, gate.kind ?? "warn", 4000);
    return;
  }

  if (
    !hasSavedMultiValueResult(
      pendingMultiValueRow,
      multiValueObservations,
      multiValueCurrentSummary,
    )
  ) {
    return;
  }

  openMultiValueClearConfirmModal();
}

async function proceedMultiValueClearConfirmed() {
  if (!pendingMultiValueRow || multiValueSaving || multiValueClearing) return;

  const gate = canEnterMultiValueResult(pendingMultiValueRow);
  if (!gate.ok) {
    toast(gate.message, gate.kind ?? "warn", 4000);
    closeMultiValueClearConfirmModal();
    return;
  }

  const resultId = pendingMultiValueRow.analysis_result_id;
  closeMultiValueClearConfirmModal();
  multiValueClearing = true;
  setMultiValueBusyState(true);
  if (mvClearConfirmProceedBtn) mvClearConfirmProceedBtn.disabled = true;
  showLoading();

  try {
    const { data, error } = await labSupabase.rpc(
      "fn_clear_multi_value_analysis_result",
      {
        p_user_id: userId,
        p_analysis_result_id: resultId,
        p_clear_reason: "Cleared from Analysis Workspace",
      },
    );
    if (error) throw error;

    const result = parseMultiValueSaveResponse(data);
    if (!result.ok) {
      toast(result.message, "error", 5000);
      return;
    }

    toast("Observations cleared.", "success");
    await reloadAndRender();

    const refreshed = getRowByResultId(resultId);
    if (refreshed) {
      pendingMultiValueRow = refreshed;
      renderMultiValueModalMeta(refreshed);
    }

    resetMultiValueModalToBlank();
  } catch (err) {
    toast(`Clear failed: ${err.message}`, "error", 5000);
  } finally {
    multiValueClearing = false;
    setMultiValueBusyState(false);
    hideLoading();
    updateMultiValueClearButtonState();
  }
}

// ── Outsourced modal ────────────────────────────────────────────────────────────
function setOutsourcedPickerVisibility(show) {
  if (outTestField) outTestField.style.display = show ? "" : "none";
  if (outMethodField) outMethodField.style.display = show ? "" : "none";
}

function setOutMethodDisplay(value, title = "") {
  if (!outMethodDisplay) return;
  outMethodDisplay.value = value;
  outMethodDisplay.title = title;
}

function clearOutsourcedModalFields() {
  if (outTestSelect) outTestSelect.value = "";
  if (outMethodSelect) {
    outMethodSelect.innerHTML =
      '<option value="">— Select test first —</option>';
    outMethodSelect.value = "";
    outMethodSelect.title = "";
    outMethodSelect.disabled = true;
  }
  setOutMethodDisplay("Select a test first");
  outLabName.value = "";
  outCoaNumber.value = "";
  outCoaDate.value = "";
  outResultValue.value = "";
}

async function loadOutsourcedTestPicker() {
  if (outsourcedTestPickerRows.length) return outsourcedTestPickerRows;
  const { data, error } = await labSupabase
    .from("test_master")
    .select("id, test_name, result_kind, default_uom_id")
    .eq("is_active", true)
    .order("test_name", { ascending: true });
  if (error) throw error;
  outsourcedTestPickerRows = Array.isArray(data) ? data : [];
  populateOutsourcedTestSelect();
  return outsourcedTestPickerRows;
}

function populateOutsourcedTestSelect() {
  if (!outTestSelect) return;
  outTestSelect.innerHTML = '<option value="">— Select test —</option>';
  outsourcedTestPickerRows.forEach((row) => {
    const opt = document.createElement("option");
    opt.value = String(row.id);
    opt.textContent = row.test_name ?? `Test ${row.id}`;
    opt.dataset.resultKind = row.result_kind ?? "";
    outTestSelect.appendChild(opt);
  });
}

async function loadMethodsForOutsourcedTest(testId) {
  if (!outMethodSelect) return;
  outMethodSelect.innerHTML = '<option value="">Loading methods…</option>';
  outMethodSelect.value = "";
  outMethodSelect.disabled = true;
  outMethodSelect.title = "";
  setOutMethodDisplay("Loading methods…");

  try {
    const { data: mappings, error: mapError } = await labSupabase
      .from("test_default_method_map")
      .select("method_id")
      .eq("test_id", Number(testId))
      .eq("is_active", true);

    if (mapError) throw mapError;

    const methodIds = [
      ...new Set((mappings ?? []).map((m) => m.method_id).filter(Boolean)),
    ];
    let methods = [];

    if (methodIds.length > 0) {
      const { data, error } = await labSupabase
        .from("test_method")
        .select("id, method_name")
        .in("id", methodIds)
        .eq("is_active", true)
        .order("method_name", { ascending: true });

      if (error) throw error;
      methods = data ?? [];
    } else {
      const { data, error } = await labSupabase
        .from("test_method")
        .select("id, method_name")
        .eq("is_active", true)
        .order("method_name", { ascending: true });

      if (error) throw error;
      methods = data ?? [];
    }

    outMethodSelect.innerHTML = '<option value="">— Select method —</option>';
    methods.forEach((row) => {
      const opt = document.createElement("option");
      opt.value = String(row.id);
      opt.textContent = row.method_name ?? `Method ${row.id}`;
      outMethodSelect.appendChild(opt);
    });

    if (methods.length > 0) {
      const method = methods[0];
      const methodName = method.method_name ?? `Method ${method.id}`;
      outMethodSelect.value = String(method.id);
      outMethodSelect.title = "Method auto-populated from the selected test.";
      outMethodSelect.disabled = true;
      setOutMethodDisplay(methodName, outMethodSelect.title);
      return;
    }

    outMethodSelect.value = "";
    outMethodSelect.title = "";
    outMethodSelect.disabled = true;
    setOutMethodDisplay("No active method found");
  } catch (err) {
    console.error("[AW] outsourced method load failed:", err);
    outMethodSelect.value = "";
    outMethodSelect.title = "";
    outMethodSelect.disabled = true;
    outMethodSelect.innerHTML =
      '<option value="">Could not load methods</option>';
    setOutMethodDisplay("Could not load methods");
    toast(`Could not load methods: ${err.message}`, "error", 5000);
  }
}

function selectedOutsourcedTest() {
  if (!outTestSelect?.value) return null;
  return outsourcedTestPickerRows.find(
    (row) => String(row.id) === String(outTestSelect.value),
  );
}

async function openOutsourcedModal(row = null, mode = "EDIT_EXISTING") {
  outsourcedModalMode = mode;
  pendingOutRow = mode === "ADD_EXTRA" ? null : row;
  clearOutsourcedModalFields();
  setOutsourcedPickerVisibility(mode === "ADD_EXTRA");
  if (outModalTitle) {
    outModalTitle.textContent =
      mode === "ADD_EXTRA"
        ? "Add Outsourced Test"
        : mode === "MARK_EXISTING"
          ? "Mark Test as Outsourced"
          : "Edit Outsourced Source";
  }

  if (mode === "ADD_EXTRA") {
    outsourcedModal.classList.add("open");
    try {
      await loadOutsourcedTestPicker();
      outTestSelect?.focus();
    } catch (err) {
      toast(`Failed to load tests: ${err.message}`, "error", 5000);
      outLabName.focus();
    }
    return;
  }

  if (!row) return;
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  outLabName.value = row.source_lab_name_snapshot ?? "";
  outCoaNumber.value = row.source_coa_no_snapshot ?? "";
  outCoaDate.value = row.source_coa_date_snapshot ?? "";
  outResultValue.value =
    kind === "NUMERIC"
      ? row.result_numeric != null
        ? String(row.result_numeric)
        : ""
      : (row.result_text ?? "");
  outsourcedModal.classList.add("open");
  outLabName.focus();
}

function closeOutsourcedModal() {
  outsourcedModal.classList.remove("open");
  pendingOutRow = null;
  outsourcedModalMode = "EDIT_EXISTING";
  setOutsourcedPickerVisibility(false);
}

function validateOutsourcedModal(kind) {
  const labName = outLabName.value.trim();
  const coaNo = outCoaNumber.value.trim();
  const coaDate = outCoaDate.value || null;
  const resultVal = outResultValue.value.trim();

  if (outsourcedModalMode === "ADD_EXTRA") {
    if (!outTestSelect.value) {
      toast("Test is required.", "warn");
      outTestSelect.focus();
      return null;
    }
    if (!outMethodSelect.value) {
      toast("Method is required.", "warn");
      outMethodDisplay?.focus();
      return null;
    }
  }
  if (!labName) {
    toast("Laboratory name is required.", "warn");
    outLabName.focus();
    return null;
  }
  if (!coaNo) {
    toast("COA number is required.", "warn");
    outCoaNumber.focus();
    return null;
  }
  if (!coaDate) {
    toast("COA date is required.", "warn");
    outCoaDate.focus();
    return null;
  }
  if (!resultVal) {
    toast("Result value is required.", "warn");
    outResultValue.focus();
    return null;
  }

  const normalizedKind = String(kind || "").toUpperCase();
  let resultNumeric = null;
  let resultText = null;
  if (normalizedKind === "NUMERIC") {
    resultNumeric = Number(resultVal);
    if (!Number.isFinite(resultNumeric)) {
      toast("Numeric result must be a valid number.", "warn");
      outResultValue.focus();
      return null;
    }
  } else {
    resultText = resultVal;
  }

  return { labName, coaNo, coaDate, resultNumeric, resultText };
}

async function saveOutsourcedSource() {
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, "ENTER_RESULT")) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }

  const selectedTest = selectedOutsourcedTest();
  const kind =
    outsourcedModalMode === "ADD_EXTRA"
      ? String(selectedTest?.result_kind || "").toUpperCase()
      : String(pendingOutRow?.result_kind_snapshot || "").toUpperCase();
  const validated = validateOutsourcedModal(kind);
  if (!validated) return;

  btnOutSave.disabled = true;
  showLoading();
  try {
    let error;
    if (outsourcedModalMode === "ADD_EXTRA") {
      ({ error } = await labSupabase.rpc(
        "fn_add_outsourced_analysis_result_line",
        {
          p_user_id: userId,
          p_analysis_id: Number(analysisId),
          p_test_id: Number(outTestSelect.value),
          p_method_id: Number(outMethodSelect.value),
          p_partner_name_snapshot: validated.labName,
          p_external_coa_no: validated.coaNo,
          p_external_coa_date: validated.coaDate,
          p_result_numeric: validated.resultNumeric,
          p_result_text: validated.resultText,
        },
      ));
    } else {
      if (!pendingOutRow) return;
      ({ error } = await labSupabase.rpc(
        "fn_upsert_outsourced_report_for_result",
        {
          p_user_id: userId,
          p_analysis_result_id: pendingOutRow.analysis_result_id,
          p_partner_name_snapshot: validated.labName,
          p_external_coa_no: validated.coaNo,
          p_external_coa_date: validated.coaDate,
          p_result_numeric: validated.resultNumeric,
          p_result_text: validated.resultText,
        },
      ));
    }
    if (error) throw error;
    toast(
      outsourcedModalMode === "ADD_EXTRA"
        ? "Outsourced test added."
        : outsourcedModalMode === "MARK_EXISTING"
          ? "Test marked as outsourced."
          : "Outsourced source updated.",
      "success",
    );
    closeOutsourcedModal();
    await reloadAndRender();
  } catch (err) {
    toast(`Failed to save outsourced source: ${err.message}`, "error", 5000);
  } finally {
    hideLoading();
    btnOutSave.disabled = false;
  }
}

// ── Issue COA modal ─────────────────────────────────────────────────────────

/**
 * Load signatories from lab.v_coa_signatory_picker and split by action_code.
 * Populates each dropdown with the appropriate role's staff list.
 * Cached after first load.
 */
async function loadCoaSignatories() {
  if (signatoriesLoaded) return;

  try {
    const { data, error } = await supabase
      .schema("lab")
      .from("v_coa_signatory_picker")
      .select("staff_id, full_name, designation, action_code")
      .order("full_name", { ascending: true });

    if (error) throw error;
    const rows = data ?? [];
    preparedByList = rows.filter((r) => r.action_code === "ENTER_RESULT");
    checkedByList = rows.filter((r) => r.action_code === "PASS_SCRUTINY");
    approvedByList = rows.filter((r) => r.action_code === "APPROVE_FOR_COA");
  } catch (err) {
    console.warn("[AW] Signatories load failed:", err.message);
    preparedByList = [];
    checkedByList = [];
    approvedByList = [];
  }

  const makeOptions = (list) =>
    list
      .map(
        (s) =>
          `<option value="${s.staff_id}">${esc(s.full_name)}${s.designation ? ` — ${esc(s.designation)}` : ""}</option>`,
      )
      .join("");

  const blank = `<option value="">— Select staff —</option>`;
  coaPreparedBy.innerHTML = blank + makeOptions(preparedByList);
  coaCheckedBy.innerHTML = blank + makeOptions(checkedByList);
  coaApprovedBy.innerHTML = blank + makeOptions(approvedByList);

  signatoriesLoaded = true;
}

/**
 * Fetch status history rows for the current analysis to aid signatory prefill.
 * Returns rows for SCRUTINY_PASSED and APPROVED_FOR_COA, latest first.
 */
async function loadStatusHistory() {
  try {
    const { data, error } = await labSupabase
      .from("analysis_status_history")
      .select("new_status, changed_by_staff_id, changed_at")
      .eq("analysis_id", analysisId)
      .in("new_status", ["SCRUTINY_PASSED", "APPROVED_FOR_COA"])
      .order("changed_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn("[AW] Status history load failed:", err.message);
    return [];
  }
}

/**
 * Prefill COA dropdowns using status history and analysis snapshots.
 * - Prepared By: name-match analysed_by_name_snapshot in ENTER_RESULT list
 * - Checked By:  staff_id from latest SCRUTINY_PASSED history row
 * - Approved By: staff_id from latest APPROVED_FOR_COA history row,
 *                fallback to currentUserStaffId, fallback to person_in_charge name match
 * @param {Array} history   Rows from analysis_status_history
 */
function prefillCoaDropdowns(history = []) {
  if (!analysisInfo) return;

  // Prepared By — name match in ENTER_RESULT list
  const analysedName = String(analysisInfo.analysed_by_name_snapshot ?? "")
    .trim()
    .toLowerCase();
  if (analysedName) {
    const match = preparedByList.find(
      (s) => String(s.full_name).trim().toLowerCase() === analysedName,
    );
    if (match) coaPreparedBy.value = String(match.staff_id);
  }

  // Checked By — latest SCRUTINY_PASSED row with a staff_id in the picker
  const scrutinyRow = history.find((r) => r.new_status === "SCRUTINY_PASSED");
  if (scrutinyRow?.changed_by_staff_id) {
    const inList = checkedByList.find(
      (s) => String(s.staff_id) === String(scrutinyRow.changed_by_staff_id),
    );
    if (inList) coaCheckedBy.value = String(scrutinyRow.changed_by_staff_id);
  }

  // Approved By — priority: history → currentUserStaffId → name match
  const approvalRow = history.find((r) => r.new_status === "APPROVED_FOR_COA");
  if (approvalRow?.changed_by_staff_id) {
    const inList = approvedByList.find(
      (s) => String(s.staff_id) === String(approvalRow.changed_by_staff_id),
    );
    if (inList) {
      coaApprovedBy.value = String(approvalRow.changed_by_staff_id);
      return;
    }
  }
  if (currentUserStaffId) {
    const inList = approvedByList.find(
      (s) => String(s.staff_id) === String(currentUserStaffId),
    );
    if (inList) {
      coaApprovedBy.value = String(currentUserStaffId);
      return;
    }
  }
  const picName = String(analysisInfo.person_in_charge_name_snapshot ?? "")
    .trim()
    .toLowerCase();
  if (picName) {
    const match = approvedByList.find(
      (s) => String(s.full_name).trim().toLowerCase() === picName,
    );
    if (match) coaApprovedBy.value = String(match.staff_id);
  }
}

async function openIssueCoaModal() {
  // Default issue date to today
  const today = new Date().toISOString().slice(0, 10);
  coaIssueDate.value = today;
  coaRemarks.value = "";
  coaPreparedBy.value = "";
  coaCheckedBy.value = "";
  coaApprovedBy.value = "";

  // Load signatory picker (cached) and status history (always fresh) in parallel
  const [, history] = await Promise.all([
    loadCoaSignatories(),
    loadStatusHistory(),
  ]);
  prefillCoaDropdowns(history);

  issueCoaModal.classList.add("open");
  coaIssueDate.focus();
}

function closeIssueCoaModal() {
  issueCoaModal.classList.remove("open");
}

async function confirmIssueCoa() {
  const issueDate = coaIssueDate.value;
  const preparedBy = coaPreparedBy.value;
  const checkedBy = coaCheckedBy.value;
  const approvedBy = coaApprovedBy.value;

  // Validation
  if (!issueDate) {
    toast("Issue date is required.", "warn");
    coaIssueDate.focus();
    return;
  }
  if (!preparedBy) {
    toast("Prepared By is required.", "warn");
    coaPreparedBy.focus();
    return;
  }
  if (!checkedBy) {
    toast("Checked By is required.", "warn");
    coaCheckedBy.focus();
    return;
  }
  if (!approvedBy) {
    toast("Approved By is required.", "warn");
    coaApprovedBy.focus();
    return;
  }

  // Open in-page confirmation modal instead of native confirm
  openIssueCoaConfirmModal();
}

// ── Issue COA confirmation modal ──────────────────────────────────────────────

// Captured COA form values while the confirmation modal is open
let _pendingCoa = null;

function openIssueCoaConfirmModal() {
  // Snapshot form values so they can't change while confirm modal is shown
  _pendingCoa = {
    issueDate: coaIssueDate.value,
    preparedBy: coaPreparedBy.value,
    checkedBy: coaCheckedBy.value,
    approvedBy: coaApprovedBy.value,
    remarks: coaRemarks.value.trim(),
  };
  issueCoaConfirmModal.classList.add("open");
}

function closeIssueCoaConfirmModal() {
  issueCoaConfirmModal.classList.remove("open");
  _pendingCoa = null;
}

async function proceedIssueCoa() {
  if (!_pendingCoa) return;
  if (!statusAllowsAnalysisAction("ISSUE_COA")) {
    toast(
      "COA issue is not allowed at the current workflow stage.",
      "warn",
      4000,
    );
    return;
  }
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, "ISSUE_COA")) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }
  const { issueDate, preparedBy, checkedBy, approvedBy, remarks } = _pendingCoa;

  closeIssueCoaConfirmModal();
  btnIssueCoaConfirm.disabled = true;
  showLoading();
  try {
    const { error } = await labSupabase.rpc("fn_issue_coa", {
      p_analysis_id: analysisId,
      p_issue_date: issueDate,
      p_prepared_by_staff_id: Number(preparedBy),
      p_checked_by_staff_id: Number(checkedBy),
      p_approved_by_staff_id: Number(approvedBy),
      p_remarks: remarks || null,
    });
    if (error) throw error;
    toast("COA issued successfully.", "success");
    closeIssueCoaModal();
    await reloadAndRender();
  } catch (err) {
    toast(`COA issuance failed: ${err.message}`, "error", 6000);
    btnIssueCoaConfirm.disabled = false;
  } finally {
    hideLoading();
  }
}

// ── Workflow actions ────────────────────────────────────────────────────────────
/**
 * Execute a workflow action via the corresponding confirmed RPC.
 * @param {string} actionCode   One of the ACTION_CODES values
 * @param {string} label        Human-readable label for toasts
 * @param {HTMLButtonElement} btn   The button that triggered the action
 */
async function performWorkflowAction(actionCode, label, btn) {
  if (isReadOnly) return;
  if (!statusAllowsAnalysisAction(actionCode)) {
    toast(
      "This action is not allowed at the current workflow stage.",
      "warn",
      4000,
    );
    return;
  }
  if (!analysisPermissionVerified) {
    toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
    return;
  }
  if (!mayPerformAnalysisAction(analysisId, actionCode)) {
    toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
    return;
  }

  // Issue COA requires modal input — open modal and exit this function
  if (actionCode === "ISSUE_COA") {
    await openIssueCoaModal();
    return;
  }

  if (btn) btn.disabled = true;
  showLoading();
  try {
    let rpcError;

    if (actionCode === "SUBMIT_FOR_SCRUTINY") {
      ({ error: rpcError } = await labSupabase.rpc(
        "fn_submit_analysis_for_scrutiny",
        { p_user_id: userId, p_analysis_id: analysisId },
      ));
    } else if (actionCode === "PASS_SCRUTINY") {
      ({ error: rpcError } = await labSupabase.rpc(
        "fn_pass_analysis_scrutiny",
        { p_user_id: userId, p_analysis_id: analysisId },
      ));
    } else if (actionCode === "APPROVE_FOR_COA") {
      ({ error: rpcError } = await labSupabase.rpc(
        "fn_approve_analysis_for_coa",
        { p_user_id: userId, p_analysis_id: analysisId },
      ));
    } else if (actionCode === "RETURN_FOR_CORRECTION") {
      ({ error: rpcError } = await labSupabase.rpc(
        "fn_return_analysis_for_correction",
        {
          p_user_id: userId,
          p_analysis_id: analysisId,
          p_remarks: "Returned from workspace for correction",
        },
      ));
    } else if (actionCode === "REOPEN_AFTER_APPROVAL") {
      ({ error: rpcError } = await labSupabase.rpc(
        "fn_reopen_analysis_after_approval",
        {
          p_user_id: userId,
          p_analysis_id: analysisId,
          p_remarks: "Reopened from workspace for correction",
        },
      ));
    }

    if (rpcError) throw rpcError;
    toast(`${label} completed successfully.`, "success");
    await reloadAndRender(); // re-applies permissions and re-enables buttons
  } catch (err) {
    toast(`${label} failed: ${err.message}`, "error", 5000);
    if (btn) btn.disabled = false; // re-enable only on failure; success handled by reloadAndRender
  } finally {
    hideLoading();
  }
}

// ── Full reload and render cycle ────────────────────────────────────────────────
async function reloadAndRender() {
  rows = await loadAnalysisData();
  await loadAnalysisLocks();

  if (!rows.length) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">
          No data found. Verify the analysis ID in the URL.
        </td>
      </tr>`;
    renderMobileResults([]);
    closeMobileEditor();
    return;
  }

  // Use first row for analysis-level metadata
  analysisInfo = rows[0];

  // Determine read-only state
  const status = String(analysisInfo.status || "").toUpperCase();
  isReadOnly = status === "COA_GENERATED";

  if (userId) {
    await fetchAnalysisPermissions();
  } else {
    analysisPermissionVerified = false;
    analysisActionPermissions.clear();
  }

  // Render header
  renderHeader(analysisInfo);

  // Show/hide read-only banner
  readonlyBanner.style.display = isReadOnly ? "block" : "none";

  // Render table
  renderResultsTable(rows);
  renderMobileResults(rows);
  if (mobileEditorResultId && isMobileViewport()) {
    renderMobileEditor();
    mobileEditorSheetOverlay?.classList.add("open");
  }

  // Validation summary
  updateValidationPanel(rows);

  // Permission-gated workflow buttons
  applyPermissions();

  btnRefSave.disabled = !(
    statusAllowsAnalysisAction("CREATE_REFERENCE_EXCEPTION") &&
    mayPerformAnalysisAction(analysisId, "CREATE_REFERENCE_EXCEPTION")
  );
  btnAddException.disabled = !(
    statusAllowsAnalysisAction("CREATE_REFERENCE_EXCEPTION") &&
    mayPerformAnalysisAction(analysisId, "CREATE_REFERENCE_EXCEPTION")
  );
  btnOutSave.disabled = !(
    statusAllowsAnalysisAction("ENTER_RESULT") &&
    mayPerformAnalysisAction(analysisId, "ENTER_RESULT")
  );
  btnIssueCoaConfirmProceed.disabled = !(
    statusAllowsAnalysisAction("ISSUE_COA") &&
    mayPerformAnalysisAction(analysisId, "ISSUE_COA")
  );

  // Status hint in action bar
  if (!analysisPermissionVerified) {
    actionBarStatus.textContent = PERMISSION_VERIFY_FAILED_MESSAGE;
  } else {
    actionBarStatus.textContent = isReadOnly
      ? "Read only — no further actions permitted."
      : "";
  }
}

// ── Event wiring ────────────────────────────────────────────────────────────────
function wireEvents() {
  // Home — platform-aware, reliable fallback to ../index.html
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      if (typeof Platform?.goHome === "function") {
        Platform.goHome();
      } else {
        try {
          window.location.href = "../index.html";
        } catch {
          window.location.href = "index.html";
        }
      }
    });
  }

  // Refresh
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    await reloadAndRender();
    toast("Refreshed.", "info", 1800);
    refreshBtn.disabled = false;
  });

  if (btnBackToAnalysisQueue) {
    btnBackToAnalysisQueue.addEventListener("click", () => {
      navigateToAnalysisQueue();
    });
  }

  // Header card: mobile pill toggle + popover auto-collapse
  const hdrPillBtn = $("hdrPillBtn");
  const hdrPopover = $("hdrPopover");
  const analysisHeaderCard = $("analysisHeaderCard");
  if (hdrPillBtn && hdrPopover) {
    hdrPillBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = hdrPopover.classList.toggle("open");
      hdrPillBtn.classList.toggle("open", open);
      hdrPillBtn.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", (e) => {
      if (!analysisHeaderCard?.contains(e.target)) {
        hdrPopover.classList.remove("open");
        hdrPillBtn.classList.remove("open");
        hdrPillBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (btnSyncFromSpec) {
    btnSyncFromSpec.addEventListener("click", syncFromCurrentSpec);
  }

  // Result input changes (delegated on tbody)
  resultsBody.addEventListener("change", (e) => {
    handleResultControlChange(e.target);
  });

  // Live KPI refresh while typing in numeric inputs (fires on every keystroke,
  // before blur; does not trigger save — the change event handles that)
  resultsBody.addEventListener("input", (e) => {
    handleNumericControlInput(e.target);
  });
  resultsBody.addEventListener("focusout", (e) => {
    handleNumericControlBlur(e.target);
  });

  // Delegated action button clicks
  resultsBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const rid = btn.dataset.rid;
    const row = rows.find((r) => String(r.analysis_result_id) === String(rid));
    if (!row) return;

    handleResultRowAction(action, row);
  });

  // Mobile cards: tap card to open mobile result editor
  mobileResultsList?.addEventListener("click", (e) => {
    const card = e.target.closest(".mobile-result-card");
    if (!card) return;
    const rid = card.dataset.rid;
    if (!rid) return;
    card.classList.add("mobile-tap-pulse");
    setTimeout(() => card.classList.remove("mobile-tap-pulse"), 160);
    openMobileEditor(rid);
  });

  // Mobile cards: keyboard support
  mobileResultsList?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".mobile-result-card");
    if (!card) return;
    e.preventDefault();
    const rid = card.dataset.rid;
    if (!rid) return;
    openMobileEditor(rid);
  });

  // Mobile sheet close + backdrop close
  mobileEditorCloseBtn?.addEventListener("click", closeMobileEditor);
  mobileEditorSheetOverlay?.addEventListener("click", (e) => {
    if (e.target === mobileEditorSheetOverlay) closeMobileEditor();
  });

  // Mobile sheet next/previous
  mobileEditorPrevBtn?.addEventListener("click", () =>
    navigateMobileEditor(-1),
  );
  mobileEditorNextBtn?.addEventListener("click", () => navigateMobileEditor(1));

  // Mobile sheet: delegated result changes
  mobileEditorBody?.addEventListener("change", (e) => {
    handleResultControlChange(e.target);
  });

  mobileEditorBody?.addEventListener("input", (e) => {
    handleNumericControlInput(e.target);
  });
  mobileEditorBody?.addEventListener("focusout", (e) => {
    handleNumericControlBlur(e.target);
  });

  // Mobile sheet: delegated row action buttons
  mobileEditorBody?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mobile-action]");
    if (!btn) return;
    const action = btn.dataset.mobileAction;
    const rid = btn.dataset.rid;
    const row = getRowByResultId(rid);
    if (!row) return;
    handleResultRowAction(action, row);
  });

  // Swipe navigation in mobile editor sheet
  mobileEditorSheet?.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.changedTouches?.[0];
      if (!touch) return;
      mobileSwipeStartX = touch.clientX;
      mobileSwipeStartY = touch.clientY;
    },
    { passive: true },
  );
  mobileEditorSheet?.addEventListener(
    "touchend",
    (e) => {
      const touch = e.changedTouches?.[0];
      if (!touch || mobileSwipeStartX == null || mobileSwipeStartY == null)
        return;
      const dx = touch.clientX - mobileSwipeStartX;
      const dy = touch.clientY - mobileSwipeStartY;
      mobileSwipeStartX = null;
      mobileSwipeStartY = null;

      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) navigateMobileEditor(1, "swipe");
      else navigateMobileEditor(-1, "swipe");
    },
    { passive: true },
  );

  // Reference modal
  btnRefSave.addEventListener("click", saveReference);
  btnAddException.addEventListener("click", grantException);
  btnRefCancel.addEventListener("click", closeReferenceModal);
  refSpecTypeSelect?.addEventListener("change", () => {
    applyReferenceSpecTypeUI();
    updateReferenceDisplayPreview();
  });
  refMinValueInput?.addEventListener("input", updateReferenceDisplayPreview);
  refMaxValueInput?.addEventListener("input", updateReferenceDisplayPreview);
  refExactValueInput?.addEventListener("input", updateReferenceDisplayPreview);
  refMinValueInput?.addEventListener("input", (e) =>
    handleNumericControlInput(e.target),
  );
  refMaxValueInput?.addEventListener("input", (e) =>
    handleNumericControlInput(e.target),
  );
  refExactValueInput?.addEventListener("input", (e) =>
    handleNumericControlInput(e.target),
  );
  refMinValueInput?.addEventListener("blur", (e) =>
    handleNumericControlBlur(e.target),
  );
  refMaxValueInput?.addEventListener("blur", (e) =>
    handleNumericControlBlur(e.target),
  );
  refExactValueInput?.addEventListener("blur", (e) =>
    handleNumericControlBlur(e.target),
  );
  refTextValueInput?.addEventListener("input", updateReferenceDisplayPreview);
  refPassFailValueSelect?.addEventListener(
    "change",
    updateReferenceDisplayPreview,
  );
  refTargetValueInput?.addEventListener("input", updateReferenceDisplayPreview);
  refToleranceValueInput?.addEventListener(
    "input",
    updateReferenceDisplayPreview,
  );
  refToleranceUomSelect?.addEventListener(
    "change",
    updateReferenceDisplayPreview,
  );
  refTargetValueInput?.addEventListener("input", (e) =>
    handleNumericControlInput(e.target),
  );
  refToleranceValueInput?.addEventListener("input", (e) =>
    handleNumericControlInput(e.target),
  );
  refTargetValueInput?.addEventListener("blur", (e) =>
    handleNumericControlBlur(e.target),
  );
  refToleranceValueInput?.addEventListener("blur", (e) =>
    handleNumericControlBlur(e.target),
  );
  btnRefSourceDoiLookup?.addEventListener("click", lookupReferenceDoi);
  refSourceDoiInput?.addEventListener("input", handleRefSourceDoiInputChange);
  refSourceCreateCitation?.addEventListener(
    "input",
    updateReferenceSourceCitationPreview,
  );
  referenceModal.addEventListener("click", (e) => {
    if (e.target === referenceModal) closeReferenceModal();
  });

  refSourceTypeSelect?.addEventListener("change", () => {
    clearReferenceSourceSelection();
    applyReferenceSourceUI();
    if (refSourceMode === "existing") {
      searchReferenceSources(
        refSourceSearchInput?.value ?? "",
        refSourceTypeSelect.value,
      ).then((results) => {
        if (
          refSourceTypeSelect.value === REF_SOURCE_TYPE_DEFAULT &&
          !refSelectedSourceId
        ) {
          const defaultRow = findDefaultInHouseSource(results);
          if (defaultRow) selectReferenceSource(defaultRow);
        }
      });
    }
  });

  refSourceModeExisting?.addEventListener("change", () => {
    if (!refSourceModeExisting.checked) return;
    applyReferenceSourceUI();
    if (!refSelectedSourceId) {
      ensureDefaultReferenceSourceSelected();
    } else {
      scheduleReferenceSourceSearch();
    }
  });

  refSourceModeCreate?.addEventListener("change", () => {
    if (!refSourceModeCreate.checked) return;
    clearReferenceSourceSelection();
    applyReferenceSourceUI();
  });

  refSourceSearchInput?.addEventListener("input", scheduleReferenceSourceSearch);

  refSourceResultsList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".ref-source-result");
    if (!btn) return;
    const id = btn.dataset.sourceId;
    const display = btn.dataset.sourceDisplay;
    if (!id) return;
    selectReferenceSource({
      id,
      reference_source_display: display,
    });
  });

  refSourceClearSelection?.addEventListener("click", () => {
    clearReferenceSourceSelection();
    scheduleReferenceSourceSearch();
  });

  // Multi-value result modal
  mvSaveBtn?.addEventListener("click", saveMultiValueResult);
  mvClearBtn?.addEventListener("click", clearMultiValueResult);
  mvClearConfirmCancelBtn?.addEventListener(
    "click",
    closeMultiValueClearConfirmModal,
  );
  mvClearConfirmProceedBtn?.addEventListener(
    "click",
    proceedMultiValueClearConfirmed,
  );
  multiValueClearConfirmModal?.addEventListener("click", (e) => {
    if (e.target !== multiValueClearConfirmModal) return;
    if (multiValueClearing) return;
    closeMultiValueClearConfirmModal();
  });
  mvCancelBtn?.addEventListener("click", closeMultiValueResultModal);
  mvAddObsRowBtn?.addEventListener("click", appendMultiValueObservationRow);
  multiValueResultModal?.addEventListener("click", (e) => {
    if (e.target !== multiValueResultModal) return;
    if (multiValueSaving || multiValueClearing) return;
    closeMultiValueResultModal();
  });
  mvObsTableBody?.addEventListener("keydown", handleMultiValueObservationKeydown);
  multiValueResultModal?.addEventListener("keydown", (e) => {
    if (multiValueSaving || multiValueClearing) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      saveMultiValueResult();
    }
  });
  mvObsTableBody?.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-mv-delete-idx]");
    if (deleteBtn) {
      deleteMultiValueObservationRow(Number(deleteBtn.dataset.mvDeleteIdx));
      return;
    }
    const addBtn = e.target.closest(".mv-add-obs-inline");
    if (addBtn) appendMultiValueObservationRow();
  });
  mvObsTableBody?.addEventListener("input", (e) => {
    handleNumericControlInput(e.target);
    if (!e.target?.classList?.contains("mv-obs-input")) return;
    const idx = Number(e.target.dataset.obsIndex);
    syncMultiValueObservationsFromDom();
    if (multiValueObservations[idx]) {
      multiValueObservations[idx]._serverObservedValue = null;
      multiValueObservations[idx].server_is_within_limit = null;
      multiValueObservations[idx].server_calculation_percent = null;
    }
    updateMultiValueObservationRowDisplay(idx);
    renderMultiValueOutsideList();
  });
  mvObsTableBody?.addEventListener("focusout", (e) => {
    handleNumericControlBlur(e.target);
  });

  // Outsourced modal
  btnAddOutsourcedTest?.addEventListener("click", () => {
    if (!analysisPermissionVerified) {
      toast(PERMISSION_VERIFY_FAILED_MESSAGE, "error", 5000);
      return;
    }
    if (
      !statusAllowsAnalysisAction("ENTER_RESULT") ||
      !mayPerformAnalysisAction(analysisId, "ENTER_RESULT")
    ) {
      toast(PERMISSION_DENIED_MESSAGE, "warn", 4000);
      return;
    }
    openOutsourcedModal(null, "ADD_EXTRA");
  });
  outTestSelect?.addEventListener("change", () => {
    const testId = outTestSelect.value;
    if (!testId) {
      outMethodSelect.innerHTML =
        '<option value="">— Select test first —</option>';
      outMethodSelect.value = "";
      outMethodSelect.title = "";
      outMethodSelect.disabled = true;
      setOutMethodDisplay("Select a test first");
      return;
    }
    loadMethodsForOutsourcedTest(testId);
  });
  btnOutSave.addEventListener("click", saveOutsourcedSource);
  btnOutCancel.addEventListener("click", closeOutsourcedModal);
  outsourcedModal.addEventListener("click", (e) => {
    if (e.target === outsourcedModal) closeOutsourcedModal();
  });

  // Issue COA modal
  btnIssueCoaConfirm.addEventListener("click", confirmIssueCoa);
  btnIssueCoaCancel.addEventListener("click", closeIssueCoaModal);
  issueCoaModal.addEventListener("click", (e) => {
    if (e.target === issueCoaModal) closeIssueCoaModal();
  });

  // Issue COA confirmation modal
  btnIssueCoaConfirmProceed.addEventListener("click", proceedIssueCoa);
  btnIssueCoaConfirmCancel.addEventListener("click", closeIssueCoaConfirmModal);
  issueCoaConfirmModal.addEventListener("click", (e) => {
    if (e.target === issueCoaConfirmModal) closeIssueCoaConfirmModal();
  });

  // Keyboard: Escape closes whichever modal is open
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (multiValueClearConfirmModal?.classList.contains("open")) {
        if (!multiValueClearing) closeMultiValueClearConfirmModal();
        return;
      }
      if (mobileEditorSheetOverlay?.classList.contains("open"))
        closeMobileEditor();
      if (referenceModal.classList.contains("open")) closeReferenceModal();
      if (multiValueResultModal?.classList.contains("open")) {
        if (!multiValueSaving && !multiValueClearing) {
          closeMultiValueResultModal();
        }
        return;
      }
      if (outsourcedModal.classList.contains("open")) closeOutsourcedModal();
      if (issueCoaConfirmModal.classList.contains("open"))
        closeIssueCoaConfirmModal();
      else if (issueCoaModal.classList.contains("open")) closeIssueCoaModal();
    }
  });

  window.addEventListener("resize", () => {
    if (
      !isMobileViewport() &&
      mobileEditorSheetOverlay?.classList.contains("open")
    ) {
      closeMobileEditor();
    }
  });

  // Workflow buttons — pass btn reference so it can be re-enabled on failure
  btnSubmitScrutiny.addEventListener("click", () =>
    performWorkflowAction(
      ACTION_CODES.submitScrutiny,
      "Submit for Scrutiny",
      btnSubmitScrutiny,
    ),
  );
  btnPassScrutiny.addEventListener("click", () =>
    performWorkflowAction(
      ACTION_CODES.passScrutiny,
      "Pass Scrutiny",
      btnPassScrutiny,
    ),
  );
  btnApproveForCoa.addEventListener("click", () =>
    performWorkflowAction(
      ACTION_CODES.approveCoa,
      "Approve for COA",
      btnApproveForCoa,
    ),
  );
  btnIssueCoa.addEventListener("click", () =>
    performWorkflowAction(ACTION_CODES.issueCoa, "Issue COA", btnIssueCoa),
  );
  btnReturnForCorrection.addEventListener("click", () =>
    performWorkflowAction(
      ACTION_CODES.returnForCorrection,
      "Return for Correction",
      btnReturnForCorrection,
    ),
  );
  btnReopenAfterApproval.addEventListener("click", () =>
    performWorkflowAction(
      ACTION_CODES.reopenAfterApproval,
      "Reopen After Approval",
      btnReopenAfterApproval,
    ),
  );

  // View COA — enabled only when COA_GENERATED; does not go through workflow
  if (btnViewCoa) {
    btnViewCoa.addEventListener("click", () =>
      openIssuedCoaForAnalysis(analysisId),
    );
  }
}

// ── Open issued COA print page ──────────────────────────────────────────────────
async function openIssuedCoaForAnalysis(aid) {
  if (!aid) return;
  try {
    const { data, error } = await labSupabase
      .from("coa_issue")
      .select("id, analysis_id, is_current")
      .eq("analysis_id", aid)
      .eq("is_current", true)
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;

    const record = Array.isArray(data) ? data[0] : null;
    if (!record) {
      toast("Issued COA not found for this analysis", "warn", 4000);
      return;
    }

    const base = window.location.pathname.replace(/\/[^/]+$/, "/");
    const url =
      base + "coa-print.html?coa_issue_id=" + encodeURIComponent(record.id);

    try {
      if (typeof Platform?.open === "function") {
        Platform.open(url);
        return;
      }
      if (typeof Platform?.navigate === "function") {
        Platform.navigate(url);
        return;
      }
    } catch (e) {
      console.debug("[AW] Platform navigation failed, falling back:", e);
    }

    window.location.href = url;
  } catch (err) {
    console.error("[AW] openIssuedCoaForAnalysis error:", err);
    toast("Failed to look up issued COA: " + err.message, "error", 5000);
  }
}

// ── Module access check ─────────────────────────────────────────────────────────
/**
 * Returns true if the user is permitted to view this module.
 * Matches the same two-tier pattern used by lab-analysis-queue:
 *   1. get_user_permissions RPC (target: "module:<MODULE_ID>")
 *   2. fallback: user_permissions table direct query
 *   3. default allow when both fail (fail-open for permissions fetch errors)
 */
async function checkModuleAccess(userId) {
  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: userId,
    });
    if (!error && Array.isArray(perms)) {
      const entry = perms.find((r) => r?.target === `module:${MODULE_ID}`);
      if (entry) return !!entry.can_view;
    }
  } catch {
    /* fallthrough */
  }

  try {
    const { data: rows } = await supabase
      .from("user_permissions_canonical")
      .select("can_view")
      .eq("user_id", userId)
      .eq("target", `module:${MODULE_ID}`)
      .limit(1);
    if (Array.isArray(rows) && rows.length) return !!rows[0].can_view;
  } catch {
    /* allow access */
  }

  return true; // default allow if permission fetch fails
}

// ── Authenticate user ───────────────────────────────────────────────────────────
async function resolveUserId() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    if (session?.user?.id) return session.user.id;

    // Fallback to platform helper (Electron / PWA context)
    const p = await Platform.getSession?.();
    return p?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Module entry point ──────────────────────────────────────────────────────────
async function init() {
  // Read analysis ID from URL — expects a numeric bigint ID
  const rawId = getUrlParam("id");
  analysisId = rawId ? parseInt(rawId, 10) : null;

  if (!analysisId || isNaN(analysisId)) {
    toast("Select an analysis from the queue.", "info", 3000);
    setTimeout(() => {
      navigateToAnalysisQueue();
    }, 1200);
    return;
  }

  // Resolve authenticated user
  userId = await resolveUserId();
  if (!userId) {
    try {
      location.href = "login.html";
    } catch {
      /* ignore */
    }
    return;
  }

  // Try to get the current user's mapped staff_id from session metadata
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const meta = sessionData?.session?.user?.user_metadata ?? {};
    if (meta.staff_id) currentUserStaffId = meta.staff_id;
  } catch {
    /* non-critical; prefill will fall back to name match */
  }

  // Module-level access check
  const canView = await checkModuleAccess(userId);
  if (!canView) {
    toast(
      "Access denied. You do not have permission to view this module.",
      "error",
      0,
    );
    resultsBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:32px;color:#b91c1c;">
          Access denied. You do not have permission to view this module.
        </td>
      </tr>`;
    return;
  }

  // Wire UI events before data load so buttons are ready
  wireEvents();

  // Load and render
  showLoading();
  try {
    await reloadAndRender();
  } finally {
    hideLoading();
  }
}

init();
