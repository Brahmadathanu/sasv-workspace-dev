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
const homeBtn = $("homeBtn");
const toastContainer = $("toastContainer");
const loadingOverlay = $("loadingOverlay");

// Reference modal
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

function valueAlreadyEndsWithUnit(value, unit) {
  const base = String(value ?? "").trim();
  const uom = String(unit ?? "").trim();
  if (!base || !uom) return false;

  const escaped = uom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}$`, "i").test(base);
}

function buildClientResultDisplay(row) {
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
  const specDisplay =
    row.reference_range_display ?? row.spec_display_snapshot ?? "—";
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

  // Use reference_range_display if available, fall back to spec_display_snapshot
  const specDisplay =
    row.reference_range_display ?? row.spec_display_snapshot ?? "—";

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

  return `
    <tr data-rid="${rid}" class="${rowClass}">
      <td>${esc(String(row.seq_no ?? ""))}</td>
      <td title="${esc(row.test_name)}">${esc(row.test_name ?? "—")}</td>
      <td title="${esc(row.method_name)}" style="color:var(--muted)">${esc(row.method_name ?? "—")}</td>
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

    toast(
      `Spec sync completed. Added: ${added}, Updated: ${updated}, Removed: ${removed}, Skipped: ${skipped}.`,
      "success",
      5000,
    );
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
  return "TEXT";
}

function getAllowedReferenceSpecTypes(row) {
  const kind = String(row?.result_kind_snapshot || "").toUpperCase();
  if (kind === "NUMERIC") {
    return ["RANGE", "MIN_ONLY", "MAX_ONLY", "EXACT_NUMERIC"];
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
  } else if (specType === "PASS_FAIL") {
    preview = passFailVal;
  } else {
    preview = textVal;
  }

  refDisplayPreviewInput.value = preview;
}

function openReferenceModal(row) {
  pendingRefRow = row;
  const refRequired = row.reference_capture_required === true;
  refModalTitle.textContent = `${refRequired ? "Add Reference" : "Modify Reference"} — ${row.test_name ?? "Test"}`;
  const specDisplay =
    row.reference_range_display ?? row.spec_display_snapshot ?? "None on file";
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

  applyReferenceSpecTypeUI();
  updateReferenceDisplayPreview();
  referenceModal.classList.add("open");

  if (selectedType === "RANGE" || selectedType === "MIN_ONLY") {
    refMinValueInput.focus();
  } else if (selectedType === "MAX_ONLY") {
    refMaxValueInput.focus();
  } else if (selectedType === "EXACT_NUMERIC") {
    refExactValueInput.focus();
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
  if (refDisplayPreviewInput) refDisplayPreviewInput.value = "";
  if (refScopeAnalysisOnly) refScopeAnalysisOnly.checked = true;
  if (refScopeProduct) refScopeProduct.checked = false;
  if (refScopeFamily) refScopeFamily.checked = false;
  refNoteInput.value = "";
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

  let minVal = null;
  let maxVal = null;
  let textVal = null;

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
  } else if (specType === "PASS_FAIL") {
    if (!passFailRaw) {
      toast("PASS/FAIL specification requires a selected value.", "warn");
      return;
    }
    textVal = passFailRaw;
  } else {
    if (!textRaw) {
      toast("Text specification requires Text Value.", "warn");
      return;
    }
    textVal = textRaw;
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
  btnRefSave.disabled = true;
  showLoading();
  try {
    const { error } = await labSupabase.rpc(
      "fn_submit_analysis_reference_proposal",
      {
        p_user_id: userId,
        p_analysis_result_id: pendingRefRow.analysis_result_id,
        p_spec_type: specType,
        p_min_value: minVal,
        p_max_value: maxVal,
        p_text_value: textVal,
        p_display_text: displayText,
        p_request_scope: requestScope,
        p_remarks: note,
      },
    );
    if (error) throw error;
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
  btnAddException.disabled = true;
  showLoading();
  try {
    const { error } = await labSupabase.rpc("fn_create_reference_exception", {
      p_user_id: userId,
      p_analysis_result_id: pendingRefRow.analysis_result_id,
      p_display_text:
        "Reference not yet established - temporary first analysis entry",
      p_remarks: note,
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
  mobileEditorSheet?.addEventListener("touchstart", (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    mobileSwipeStartX = touch.clientX;
    mobileSwipeStartY = touch.clientY;
  });
  mobileEditorSheet?.addEventListener("touchend", (e) => {
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
  });

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
  referenceModal.addEventListener("click", (e) => {
    if (e.target === referenceModal) closeReferenceModal();
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
      if (mobileEditorSheetOverlay?.classList.contains("open"))
        closeMobileEditor();
      if (referenceModal.classList.contains("open")) closeReferenceModal();
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
      const queuePage = "lab-analysis-queue.html";
      if (typeof Platform?.navigate === "function") {
        Platform.navigate(queuePage);
      } else {
        try {
          window.location.href = queuePage;
        } catch {
          /* ignore */
        }
      }
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
