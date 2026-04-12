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

/** Dropdown choices for PASS_FAIL result kind */
const PASS_FAIL_CHOICES = ["Absent", "Present", "Complies", "Does Not Comply"];

/** Base dropdown choices for TEXT result kind (text_value_snapshot prepended if present) */
const TEXT_BASE_CHOICES = ["Characteristic", "Complies", "Does Not Comply"];

/** Workflow action codes that map to DB function parameter values */
const ACTION_CODES = {
  submitScrutiny: "SUBMIT_FOR_SCRUTINY",
  passScrutiny: "PASS_SCRUTINY",
  approveCoa: "APPROVE_FOR_COA",
  issueCoa: "ISSUE_COA",
  returnForCorrection: "RETURN_FOR_CORRECTION",
  reopenAfterApproval: "REOPEN_AFTER_APPROVAL",
};

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const pageSubtitle = $("pageSubtitle");
const readonlyBanner = $("readonlyBanner");
const hdrRegisterNo = $("hdrRegisterNo");
const hdrItemName = $("hdrItemName");
const hdrBatch = $("hdrBatch");
const hdrStatus = $("hdrStatus");
const hdrMode = $("hdrMode");
const hdrSampleDate = $("hdrSampleDate");
const resultsBody = $("resultsBody");
const vpMissing = $("vpMissing");
const vpFailed = $("vpFailed");
const vpNotEval = $("vpNotEval");
const vpRefMissing = $("vpRefMissing");
const btnSubmitScrutiny = $("btnSubmitScrutiny");
const btnPassScrutiny = $("btnPassScrutiny");
const btnApproveForCoa = $("btnApproveForCoa");
const btnIssueCoa = $("btnIssueCoa");
const btnReturnForCorrection = $("btnReturnForCorrection");
const btnReopenAfterApproval = $("btnReopenAfterApproval");
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
const refValueInput = $("refValueInput");
const refNoteInput = $("refNoteInput");
const btnAddException = $("btnAddException");
const btnRefCancel = $("btnRefCancel");
const btnRefSave = $("btnRefSave");

// Outsourced modal
const outsourcedModal = $("outsourcedModal");
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

// Staff data for Issue COA modal (role-filtered from lab.v_coa_signatory_picker)
let preparedByList = []; // action_code = 'ENTER_RESULT'
let checkedByList = []; // action_code = 'PASS_SCRUTINY'
let approvedByList = []; // action_code = 'APPROVE_FOR_COA'
let signatoriesLoaded = false;
let currentUserStaffId = null; // mapped staff_id for the logged-in user

// Pending context for modals
let pendingRefRow = null; // Row awaiting reference capture
let pendingOutRow = null; // Row being edited (outsourced)

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
function complianceBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PASS") return `<span class="badge badge-pass">Pass</span>`;
  if (s === "FAIL") return `<span class="badge badge-fail">Fail</span>`;
  if (s === "NOT_EVALUATED")
    return `<span class="badge badge-not-eval">Not Eval</span>`;
  return `<span class="badge badge-not-eval">${esc(status) || "—"}</span>`;
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

// ── Render header card ──────────────────────────────────────────────────────────
function renderHeader(info) {
  hdrRegisterNo.textContent = info.analysis_register_no ?? "—";
  hdrItemName.textContent = info.item_name ?? "—";
  hdrBatch.textContent = info.batch_no_snapshot || info.system_lot_no || "—";
  hdrStatus.innerHTML = statusChip(info.status);
  hdrMode.textContent = modeLabel(info.analysis_mode);
  hdrSampleDate.textContent = formatDate(info.sample_received_date);

  pageSubtitle.textContent = info.item_name
    ? `${info.item_name} — ${info.analysis_register_no ?? ""}`
    : (info.analysis_register_no ?? "");
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

/**
 * Build the HTML for a single result row.
 * Handles: reference lock, outsourced display, result input type.
 */
function buildResultRow(row) {
  const rid = esc(row.analysis_result_id);
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  const src = String(row.result_source_type || "").toUpperCase();
  const refRequired = row.reference_capture_required === true;
  const hasTempException = row.has_active_reference_exception === true;
  const isOutsourced = src === "OUTSOURCED";

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
    const currentVal = row.result_numeric ?? "";
    inputCell = `
      <input
        class="result-input"
        type="number"
        step="any"
        data-rid="${rid}"
        data-kind="NUMERIC"
        value="${esc(String(currentVal))}"
        ${isReadOnly ? "disabled" : ""}
        aria-label="Numeric result for ${esc(row.test_name)}"
      />`;
  } else {
    // TEXT or PASS_FAIL — kind-specific choices
    const currentText = row.result_text ?? "";
    let choices;
    if (kind === "PASS_FAIL") {
      choices = PASS_FAIL_CHOICES;
    } else {
      // TEXT — prepend text_value_snapshot if it's present and not already in the base list
      const snap = row.text_value_snapshot;
      choices =
        snap && !TEXT_BASE_CHOICES.includes(snap)
          ? [snap, ...TEXT_BASE_CHOICES]
          : [...TEXT_BASE_CHOICES];
    }
    const options = choices
      .map(
        (c) =>
          `<option value="${esc(c)}" ${currentText === c ? "selected" : ""}>${esc(c)}</option>`,
      )
      .join("");
    inputCell = `
      <select
        class="result-select"
        data-rid="${rid}"
        data-kind="TEXT"
        ${isReadOnly ? "disabled" : ""}
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

  let actionCell;
  if (!isReadOnly && isOutsourced) {
    actionCell = `
      ${tempBadge}
      <button
        class="btn-sm btn-outsourced"
        data-action="edit-outsourced"
        data-rid="${rid}"
        title="Edit outsourced source details"
      >&#9998; Edit Source</button>`;
  } else if (!isReadOnly && refRequired) {
    actionCell = `
      <button
        class="btn-sm btn-ref"
        data-action="add-reference"
        data-rid="${rid}"
        title="Add or review reference for this test"
      >
        ${tempBadge}
        + Add Reference
      </button>`;
  } else {
    // Reference satisfied (or read-only) — still show TEMP if exception active
    actionCell = tempBadge || "—";
  }

  return `
    <tr data-rid="${rid}">
      <td>${esc(String(row.seq_no ?? ""))}</td>
      <td title="${esc(row.test_name)}">${esc(row.test_name ?? "—")}</td>
      <td title="${esc(row.method_name)}" style="color:var(--muted)">${esc(row.method_name ?? "—")}</td>
      <td title="${esc(specDisplay)}" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;">${esc(specDisplay)}</td>
      <td>${inputCell}</td>
      <td style="color:var(--muted)">${esc(row.result_display ?? "—")}</td>
      <td>${complianceBadge(row.compliance_status)}</td>
      <td>${sourceBadge(row.result_source_type)}</td>
      <td style="white-space:nowrap">${actionCell}</td>
    </tr>`;
}

// ── Update validation panel ─────────────────────────────────────────────────────
function updateValidationPanel(data) {
  let missing = 0;
  let failed = 0;
  let notEval = 0;
  let refMissing = 0;

  data.forEach((row) => {
    const compliance = String(row.compliance_status || "").toUpperCase();
    const hasResult =
      row.result_numeric != null ||
      (row.result_text != null && row.result_text !== "");
    if (!hasResult) missing++;
    if (compliance === "FAIL") failed++;
    if (compliance === "NOT_EVALUATED") notEval++;
    if (row.reference_capture_required === true) refMissing++;
  });

  const fmt = (el, n, danger, warn) => {
    el.textContent = String(n);
    el.className = `vp-count ${n >= danger ? "vp-danger" : n >= warn ? "vp-warn" : "vp-ok"}`;
  };

  fmt(vpMissing, missing, 1, 1);
  fmt(vpFailed, failed, 1, 1);
  fmt(vpNotEval, notEval, 1, 1);
  fmt(vpRefMissing, refMissing, 1, 1);
}

// ── Permission check for workflow buttons ───────────────────────────────────────
/**
 * Calls lab.fn_user_may_perform_analysis_action for each action code.
 * Returns a map { actionCode: boolean }.
 */
async function fetchPermissions() {
  const checks = Object.entries(ACTION_CODES);
  const results = await Promise.all(
    checks.map(async ([key, code]) => {
      try {
        const { data, error } = await labSupabase.rpc(
          "fn_user_may_perform_analysis_action",
          {
            p_user_id: userId,
            p_analysis_id: analysisId,
            p_action_code: code,
          },
        );
        if (error) return [key, false];
        return [key, !!data];
      } catch {
        return [key, false];
      }
    }),
  );
  return Object.fromEntries(results);
}

// ── Apply permissions to workflow buttons ───────────────────────────────────────
function applyPermissions(perms) {
  btnSubmitScrutiny.disabled = !perms.submitScrutiny || isReadOnly;
  btnPassScrutiny.disabled = !perms.passScrutiny || isReadOnly;
  btnApproveForCoa.disabled = !perms.approveCoa || isReadOnly;
  btnIssueCoa.disabled = !perms.issueCoa || isReadOnly;
  btnReturnForCorrection.disabled = !perms.returnForCorrection || isReadOnly;
  btnReopenAfterApproval.disabled = !perms.reopenAfterApproval || isReadOnly;
  // View COA: enabled only when status is COA_GENERATED (available in read-only mode)
  if (btnViewCoa) {
    btnViewCoa.disabled = !isReadOnly; // isReadOnly is true only when COA_GENERATED
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

  const { error } = await labSupabase.rpc("fn_save_analysis_result", {
    p_user_id: userId,
    p_analysis_result_id: resultId,
    p_result_numeric:
      kind === "NUMERIC" ? (value === "" ? null : Number(value)) : null,
    p_result_text:
      kind !== "NUMERIC" ? (value === "" ? null : String(value)) : null,
  });

  if (error) {
    toast(`Save failed: ${error.message}`, "error", 5000);
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
      "analysis_result_id, compliance_status, result_display, result_numeric, result_text",
    )
    .eq("analysis_result_id", resultId)
    .single();

  if (error || !data) return;

  // Update in-memory store
  const idx = rows.findIndex((r) => r.analysis_result_id === resultId);
  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...data };
  }

  // Patch the compliance and result_display cells in the DOM
  const tr = resultsBody.querySelector(`tr[data-rid="${resultId}"]`);
  if (!tr) return;
  const cells = tr.querySelectorAll("td");
  // result_display is col index 5, compliance is col index 6
  if (cells[5]) cells[5].textContent = data.result_display ?? "—";
  if (cells[6]) cells[6].innerHTML = complianceBadge(data.compliance_status);

  updateValidationPanel(rows);
}

// ── Debounced result change handler ─────────────────────────────────────────────
function onResultChange(resultId, kind, value) {
  clearTimeout(debounceTimers[resultId]);
  debounceTimers[resultId] = setTimeout(() => {
    saveResult(resultId, kind, value);
  }, DEBOUNCE_MS);
}

// ── Reference modal ─────────────────────────────────────────────────────────────
function openReferenceModal(row) {
  pendingRefRow = row;
  refModalTitle.textContent = `Add Reference — ${row.test_name ?? "Test"}`;
  const specDisplay =
    row.reference_range_display ?? row.spec_display_snapshot ?? "None on file";
  const exceptionText = row.reference_exception_display_text
    ? ` | Exception: ${row.reference_exception_display_text}`
    : "";
  refModalSub.textContent = `Specification: ${specDisplay}${exceptionText}`;
  refValueInput.value = "";
  refNoteInput.value = "";
  referenceModal.classList.add("open");
  refValueInput.focus();
}

function closeReferenceModal() {
  referenceModal.classList.remove("open");
  pendingRefRow = null;
  refValueInput.value = "";
  refNoteInput.value = "";
}

async function saveReference() {
  if (!pendingRefRow) return;
  const val = refValueInput.value.trim();
  if (!val) {
    toast("Please enter a reference value.", "warn");
    refValueInput.focus();
    return;
  }

  // Parse range input: "3.0 - 8.0" → RANGE spec type
  let specType, minVal, maxVal, textVal;
  if (val.includes("-")) {
    const parts = val.split("-").map((s) => s.trim());
    const lo = parseFloat(parts[0]);
    const hi = parseFloat(parts[parts.length - 1]);
    if (isNaN(lo) || isNaN(hi)) {
      toast(
        "Could not parse range. Use format: 3.0 - 8.0 (min - max).",
        "warn",
        4000,
      );
      return;
    }
    specType = "RANGE";
    minVal = lo;
    maxVal = hi;
    textVal = null;
  } else {
    specType = "TEXT";
    minVal = null;
    maxVal = null;
    textVal = val;
  }

  const note = refNoteInput.value.trim() || null;
  btnRefSave.disabled = true;
  showLoading();
  try {
    const { error } = await labSupabase.rpc("fn_save_result_reference", {
      p_user_id: userId,
      p_analysis_result_id: pendingRefRow.analysis_result_id,
      p_spec_type: specType,
      p_min_value: minVal,
      p_max_value: maxVal,
      p_text_value: textVal,
      p_display_text: val,
      p_remarks: note,
    });
    if (error) throw error;
    toast("Reference saved.", "success");
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
function openOutsourcedModal(row) {
  pendingOutRow = row;
  const kind = String(row.result_kind_snapshot || "").toUpperCase();
  outLabName.value = row.source_lab_name_snapshot ?? "";
  outCoaNumber.value = row.source_coa_no_snapshot ?? "";
  outCoaDate.value = row.source_coa_date_snapshot ?? "";
  // Pre-fill result value from the correct field based on kind
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
}

async function saveOutsourcedSource() {
  if (!pendingOutRow) return;
  const labName = outLabName.value.trim();
  const coaNo = outCoaNumber.value.trim();
  const coaDate = outCoaDate.value || null;
  const resultVal = outResultValue.value.trim();
  const kind = String(pendingOutRow.result_kind_snapshot || "").toUpperCase();

  if (!labName) {
    toast("Laboratory name is required.", "warn");
    outLabName.focus();
    return;
  }

  btnOutSave.disabled = true;
  showLoading();
  try {
    const { error } = await labSupabase.rpc(
      "fn_upsert_outsourced_report_for_result",
      {
        p_user_id: userId,
        p_analysis_result_id: pendingOutRow.analysis_result_id,
        p_partner_name_snapshot: labName || null,
        p_external_coa_no: coaNo || null,
        p_external_coa_date: coaDate,
        p_result_numeric:
          kind === "NUMERIC"
            ? resultVal === ""
              ? null
              : Number(resultVal)
            : null,
        p_result_text: kind !== "NUMERIC" ? resultVal || null : null,
      },
    );
    if (error) throw error;
    toast("Outsourced source updated.", "success");
    closeOutsourcedModal();
    await reloadAndRender();
  } catch (err) {
    toast(`Failed to update outsourced source: ${err.message}`, "error", 5000);
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

  if (!rows.length) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">
          No data found. Verify the analysis ID in the URL.
        </td>
      </tr>`;
    return;
  }

  // Use first row for analysis-level metadata
  analysisInfo = rows[0];

  // Determine read-only state
  const status = String(analysisInfo.status || "").toUpperCase();
  isReadOnly = status === "COA_GENERATED";

  // Render header
  renderHeader(analysisInfo);

  // Show/hide read-only banner
  readonlyBanner.style.display = isReadOnly ? "block" : "none";

  // Render table
  renderResultsTable(rows);

  // Validation summary
  updateValidationPanel(rows);

  // Permission-gated workflow buttons
  if (userId) {
    const perms = await fetchPermissions();
    applyPermissions(perms);
  } else {
    applyPermissions({
      submitScrutiny: false,
      passScrutiny: false,
      approveCoa: false,
      issueCoa: false,
      returnForCorrection: false,
      reopenAfterApproval: false,
    });
  }

  // Status hint in action bar
  actionBarStatus.textContent = isReadOnly
    ? "Read only — no further actions permitted."
    : "";
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

  // Result input changes (delegated on tbody)
  resultsBody.addEventListener("change", (e) => {
    const el = e.target;
    const rid = el.dataset.rid;
    const kind = el.dataset.kind;
    if (!rid || !kind) return;
    onResultChange(rid, kind, el.value);
  });

  // Delegated action button clicks
  resultsBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const rid = btn.dataset.rid;
    const row = rows.find((r) => String(r.analysis_result_id) === String(rid));
    if (!row) return;

    if (action === "add-reference") openReferenceModal(row);
    if (action === "edit-outsourced") openOutsourcedModal(row);
  });

  // Reference modal
  btnRefSave.addEventListener("click", saveReference);
  btnAddException.addEventListener("click", grantException);
  btnRefCancel.addEventListener("click", closeReferenceModal);
  referenceModal.addEventListener("click", (e) => {
    if (e.target === referenceModal) closeReferenceModal();
  });

  // Outsourced modal
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
      if (referenceModal.classList.contains("open")) closeReferenceModal();
      if (outsourcedModal.classList.contains("open")) closeOutsourcedModal();
      if (issueCoaConfirmModal.classList.contains("open"))
        closeIssueCoaConfirmModal();
      else if (issueCoaModal.classList.contains("open")) closeIssueCoaModal();
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
