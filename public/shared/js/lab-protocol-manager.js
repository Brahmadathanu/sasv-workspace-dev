/**
 * lab-protocol-manager.js
 * Master-data module for protocol setup.
 *
 * Tabs:
 *   1. Protocol Master  – CRUD on lab.protocol_category
 *   2. Test Lines       – editable lines on lab.protocol_category_test
 *   3. Family Mapping   – maps protocol → Product Group (FG) or Inv Group (RM)
 *   4. Usage Preview    – placeholder
 *
 * Subject types: FG | RM | PM
 */

import { labSupabase, supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const homeBtn = document.getElementById("homeBtn");
const subjectPills = document.getElementById("subjectPills");
const tabStrip = document.getElementById("tabStrip");

// Tab buttons
const tabProtocolMaster = document.getElementById("tabProtocolMaster");
const tabTestLines = document.getElementById("tabTestLines");
const tabFamilyMapping = document.getElementById("tabFamilyMapping");
const tabUsagePreview = document.getElementById("tabUsagePreview");

// Tab panels
const panelProtocolMaster = document.getElementById("panelProtocolMaster");
const panelTestLines = document.getElementById("panelTestLines");
const panelFamilyMapping = document.getElementById("panelFamilyMapping");
const panelUsagePreview = document.getElementById("panelUsagePreview");

// ── Protocol Master tab
const pmListTitle = document.getElementById("pmListTitle");
const pmListCount = document.getElementById("pmListCount");
const pmListLoading = document.getElementById("pmListLoading");
const pmListBody = document.getElementById("pmListBody");
const pmFormTitle = document.getElementById("pmFormTitle");
const pmFormBanner = document.getElementById("pmFormBanner");
const pmNewBtn = document.getElementById("pmNewBtn");
const pmSaveBtn = document.getElementById("pmSaveBtn");
const pmDeactivateBtn = document.getElementById("pmDeactivateBtn");
const pmFieldSubjectType = document.getElementById("pmFieldSubjectType");
const pmFieldCategoryCode = document.getElementById("pmFieldCategoryCode");
const pmFieldCategoryName = document.getElementById("pmFieldCategoryName");
const pmFieldSourceDocument = document.getElementById("pmFieldSourceDocument");
const pmFieldRemarks = document.getElementById("pmFieldRemarks");
const pmFieldIsActive = document.getElementById("pmFieldIsActive");
const pmEditModal = document.getElementById("pmEditModal");
const pmModalCloseBtn = document.getElementById("pmModalCloseBtn");
const pmModalCancelBtn = document.getElementById("pmModalCancelBtn");

// ── Test Lines tab
const tlSectionTitle = document.getElementById("tlSectionTitle");
const tlProtocolSelect = document.getElementById("tlProtocolSelect");
const tlProtocolSearchInput = document.getElementById("tlProtocolSearchInput");
const tlProtocolSearchResults = document.getElementById(
  "tlProtocolSearchResults",
);
const tlAddLineBtn = document.getElementById("tlAddLineBtn");
const tlContextStrip = document.getElementById("tlContextStrip");
const tlCtxCode = document.getElementById("tlCtxCode");
const tlCtxDoc = document.getElementById("tlCtxDoc");
const tlCtxCount = document.getElementById("tlCtxCount");
const tlTableCard = document.getElementById("tlTableCard");
const tlTableBody = document.getElementById("tlTableBody");
const tlLineCount = document.getElementById("tlLineCount");
const tlSaveLinesBtn = document.getElementById("tlSaveLinesBtn");
const tlBanner = document.getElementById("tlBanner");
const tlEmptyBanner = document.getElementById("tlEmptyBanner");
const tlOrderHint = document.getElementById("tlOrderHint");

// ── Confirm-delete modal
const tlConfirmModal = document.getElementById("tlConfirmModal");
const tlConfirmMsg = document.getElementById("tlConfirmMsg");
const tlConfirmOk = document.getElementById("tlConfirmOk");
const tlConfirmCancel = document.getElementById("tlConfirmCancel");

// ── Protocol default spec type modal
const tlSpecDefaultModal = document.getElementById("tlSpecDefaultModal");
const tlSpecDefaultModalClose = document.getElementById("tlSpecDefaultModalClose");
const tlSpecDefaultModalCancel = document.getElementById(
  "tlSpecDefaultModalCancel",
);
const tlSpecDefaultModalApply = document.getElementById(
  "tlSpecDefaultModalApply",
);
const tlSpecDefaultModalCtx = document.getElementById("tlSpecDefaultModalCtx");
const tlSpecDefaultModalSelect = document.getElementById(
  "tlSpecDefaultModalSelect",
);
const tlSpecDefaultModalSource = document.getElementById(
  "tlSpecDefaultModalSource",
);
const tlSpecDefaultModalReviewNote = document.getElementById(
  "tlSpecDefaultModalReviewNote",
);
const tlSpecDefaultModalLockedWarn = document.getElementById(
  "tlSpecDefaultModalLockedWarn",
);
const tlSpecDefaultModalBanner = document.getElementById(
  "tlSpecDefaultModalBanner",
);
const tlSpecDefaultModalConfirm = document.getElementById(
  "tlSpecDefaultModalConfirm",
);
const tlSpecDefaultModalConfirmMsg = document.getElementById(
  "tlSpecDefaultModalConfirmMsg",
);
const tlSpecDefaultModalConfirmOk = document.getElementById(
  "tlSpecDefaultModalConfirmOk",
);
const tlSpecDefaultModalConfirmCancel = document.getElementById(
  "tlSpecDefaultModalConfirmCancel",
);
const tlSpecDefaultModalFooter = document.getElementById(
  "tlSpecDefaultModalFooter",
);

// ── Family Mapping tab
const fmFormTitle = document.getElementById("fmFormTitle");
const fmFormBanner = document.getElementById("fmFormBanner");
const fmFamilyLabel = document.getElementById("fmFamilyLabel");
const fmFamilySelect = document.getElementById("fmFamilySelect");
const fmFamilySearchInput = document.getElementById("fmFamilySearchInput");
const fmFamilySearchResults = document.getElementById("fmFamilySearchResults");
const fmProtocolSelect = document.getElementById("fmProtocolSelect");
const fmProtocolSearchInput = document.getElementById("fmProtocolSearchInput");
const fmProtocolSearchResults = document.getElementById(
  "fmProtocolSearchResults",
);
const fmRemarks = document.getElementById("fmRemarks");
const fmIsActive = document.getElementById("fmIsActive");
const fmSaveBtn = document.getElementById("fmSaveBtn");
const fmTableCard = document.getElementById("fmTableCard");
const fmTableTitle = document.getElementById("fmTableTitle");
const fmMappingCount = document.getElementById("fmMappingCount");
const fmTableBanner = document.getElementById("fmTableBanner");
const fmTableBody = document.getElementById("fmTableBody");
const fmThFamily = document.getElementById("fmThFamily");

// ── Usage Preview tab
const upProtocolSelect = document.getElementById("upProtocolSelect");
const upProtocolSearchInput = document.getElementById("upProtocolSearchInput");
const upProtocolSearchResults = document.getElementById(
  "upProtocolSearchResults",
);
const upSummaryStrip = document.getElementById("upSummaryStrip");
const upMappedCount = document.getElementById("upMappedCount");
const upCoveredCount = document.getElementById("upCoveredCount");
const upTestLineCount = document.getElementById("upTestLineCount");
const upReadyCount = document.getElementById("upReadyCount");
const upBanner = document.getElementById("upBanner");
const upTableCard = document.getElementById("upTableCard");
const upTableBody = document.getElementById("upTableBody");
const upEmptyBanner = document.getElementById("upEmptyBanner");

// ── Confirm-delete modal helper ──────────────────────────────────────────────
/**
 * Shows the in-page confirm modal and resolves true (OK) or false (Cancel).
 */
function showConfirmModal(message) {
  return new Promise((resolve) => {
    tlConfirmMsg.textContent = message;
    tlConfirmModal.classList.remove("hidden");
    tlConfirmOk.focus();

    const finish = (result) => {
      tlConfirmModal.classList.add("hidden");
      tlConfirmOk.removeEventListener("click", onOk);
      tlConfirmCancel.removeEventListener("click", onCancel);
      tlConfirmModal.removeEventListener("click", onBackdrop);
      resolve(result);
    };

    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (e) => {
      if (e.target === tlConfirmModal) finish(false);
    };

    tlConfirmOk.addEventListener("click", onOk);
    tlConfirmCancel.addEventListener("click", onCancel);
    tlConfirmModal.addEventListener("click", onBackdrop);
  });
}

function openPmEditModal() {
  pmEditModal?.classList.remove("hidden");
  pmFieldCategoryCode.focus();
}

function closePmEditModal() {
  pmEditModal?.classList.add("hidden");
  hideBanner(pmFormBanner);
}

// ── Module state ──────────────────────────────────────────────────────────────
let currentSubject = null; // "FG" | "RM" | "PM"
let currentTab = "protocolMaster";

// Protocol Master state
let pmProtocols = []; // loaded protocol list
let pmSelectedId = null; // currently selected row id (null = new)

// Test Lines state
let tlProtocolId = null;
let tlLines = []; // [{id, seq_no, test_id, ...}, ...]  (null id = new row)
let tlDirty = false;
/**
 * tlTestMaster — canonical test list with default method info.
 * Shape: { id, test_name, default_method_id, default_method_name, result_kind }
 * Loaded from lab.v_test_with_default_method + result_kind from test_master;
 * falls back to lab.test_master (no method info) when view is absent.
 */
let tlTestMaster = [];
let tlTestMasterLoaded = false;
let tlDraggedLineId = null;
let tlBatchReorderRpcAvailable = null;
let tlSpecModalLineIdx = null;
let tlSpecModalOrigType = null;
let tlSpecModalPendingType = null;

const VALID_PROTOCOL_SPEC_TYPES = [
  "RANGE",
  "MAX_ONLY",
  "MIN_ONLY",
  "TEXT",
  "PASS_FAIL",
  "TOLERANCE",
];

const PROTOCOL_SPEC_TYPE_SOURCE_LABELS = {
  AUTO_SINGLE_TYPE: "Auto",
  ADMIN_SET: "Admin Set",
  PROFILE_EXCEPTION_ALLOWED: "Exception Allowed",
  MIGRATED_LEGACY: "Migrated",
  MANUAL_REVIEW: "Review",
};

const PROTOCOL_SPEC_TYPE_DISPLAY_LABELS = {
  RANGE: "Range",
  MAX_ONLY: "Max Only",
  MIN_ONLY: "Min Only",
  TEXT: "Text",
  PASS_FAIL: "Pass/Fail",
  TOLERANCE: "Tolerance",
};

// Family Mapping state
let fmProtocols = [];
let fmFamilies = [];

// Usage Preview state
let upRows = [];

// Cross-tab shared selection
let currentProtocolId = null; // set when a protocol is selected in Protocol Master

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init();

function init() {
  homeBtn.addEventListener("click", () => Platform.goHome());
  wireSubjectPills();
  wireTabStrip();
  wireSearchableSelectComboboxes();
  wirePmForm();
  wireTlTab();
  wireFmTab();
  wireUpTab();
  applyInitialHidden();
}

// ── Initial hidden state ──────────────────────────────────────────────────────
function applyInitialHidden() {
  tabStrip.classList.add("hidden");
  [
    panelProtocolMaster,
    panelTestLines,
    panelFamilyMapping,
    panelUsagePreview,
  ].forEach((p) => p.classList.add("hidden"));
}

// ── Subject pills ─────────────────────────────────────────────────────────────
function wireSubjectPills() {
  subjectPills.querySelectorAll(".type-pill:not(.disabled)").forEach((pill) => {
    pill.addEventListener("click", () => {
      // GAP 2 (UI) — ignore disabled pills even if selector misses them
      if (!pill.dataset.type || pill.classList.contains("disabled")) return;
      const type = pill.dataset.type;
      if (type === currentSubject) return;
      currentSubject = type;
      subjectPills.querySelectorAll(".type-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.type === type);
        p.setAttribute(
          "aria-pressed",
          p.dataset.type === type ? "true" : "false",
        );
      });
      onSubjectChange();
    });
  });
}

function onSubjectChange() {
  resetAllState();
  applySubjectVisibility();
  tabStrip.classList.remove("hidden");
  switchTab(currentTab, true);
}

// GAP (UI1) — reset selects that hold subject-specific data on subject switch
function applySubjectVisibility() {
  resetSelect(fmFamilySelect, "-- Select --");
  resetSelect(fmProtocolSelect, "-- Select Protocol --");
  resetSelect(upProtocolSelect, "-- Select Protocol --");
  upSummaryStrip.classList.add("hidden");
  upTableCard.classList.add("hidden");
  upEmptyBanner.classList.add("hidden");
}

function resetAllState() {
  pmProtocols = [];
  pmSelectedId = null;
  currentProtocolId = null;
  tlProtocolId = null;
  tlLines = [];
  tlDirty = false;
  tlTestMaster = [];
  tlTestMasterLoaded = false;
  fmProtocols = [];
  fmFamilies = [];
  upRows = [];
  clearPmForm();
  clearTlTab();
  clearFmTab();
}

// ── Tab strip ─────────────────────────────────────────────────────────────────
function wireTabStrip() {
  [tabProtocolMaster, tabTestLines, tabFamilyMapping, tabUsagePreview].forEach(
    (btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    },
  );
}

function switchTab(tabId, force = false) {
  if (tabId === currentTab && !force) return;
  currentTab = tabId;

  [tabProtocolMaster, tabTestLines, tabFamilyMapping, tabUsagePreview].forEach(
    (btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    },
  );
  panelProtocolMaster.classList.toggle("hidden", tabId !== "protocolMaster");
  panelTestLines.classList.toggle("hidden", tabId !== "testLines");
  panelFamilyMapping.classList.toggle("hidden", tabId !== "familyMapping");
  panelUsagePreview.classList.toggle("hidden", tabId !== "usagePreview");

  onTabActivated(tabId);
}

function onTabActivated(tabId) {
  if (!currentSubject) return;

  if (tabId === "protocolMaster") {
    if (pmProtocols.length === 0) loadProtocolList();
    updatePmLabels();
  }
  if (tabId === "testLines") {
    updateTlLabels();
    if (tlProtocolSelect.options.length <= 1) populateTlProtocolSelect();
    if (!tlTestMasterLoaded) loadTlMasterData();
  }
  if (tabId === "familyMapping") {
    updateFmLabels();
    if (fmProtocolSelect.options.length <= 1) populateFmProtocolSelect();
    if (fmFamilySelect.options.length <= 1) loadFmFamilies();
    if (!fmTableCard.classList.contains("hidden") || fmProtocolSelect.value) {
      // keep existing state
    } else {
      loadFmMappings();
    }
  }
  if (tabId === "usagePreview") {
    updateUsagePreviewLabels();
    if (upProtocolSelect.options.length <= 1) populateUpProtocolSelect();
  }
}

// ── Helpers: labels per subject ───────────────────────────────────────────────
function updatePmLabels() {
  const pmTitleMap = {
    FG: "FG Protocols",
    RM: "RM Protocols",
    PM: "PM Protocols",
  };
  pmListTitle.textContent = pmTitleMap[currentSubject] ?? "Protocols";
  pmFieldSubjectType.value = currentSubject;
}

function updateTlLabels() {
  const tlTitleMap = {
    FG: "Select FG Protocol",
    RM: "Select RM Protocol",
    PM: "Select PM Protocol",
  };
  tlSectionTitle.textContent = tlTitleMap[currentSubject] ?? "Select Protocol";
  const tlTableTitleEl = document.querySelector(".lines-table-title");
  if (tlTableTitleEl) {
    const linesLabelMap = {
      FG: "FG Test Lines",
      RM: "RM Test Lines",
      PM: "PM Test Lines",
    };
    tlTableTitleEl.textContent = linesLabelMap[currentSubject] ?? "Test Lines";
  }
}

function updateFmLabels() {
  const isFG = currentSubject === "FG";
  const isRM = currentSubject === "RM";
  fmFormTitle.textContent = isFG
    ? "Map Protocol → Product Group"
    : isRM
      ? "Map Protocol → Raw Material Group"
      : "Map Protocol → Packing Material Subcategory";
  const familyLabel = isFG
    ? "Product Group"
    : isRM
      ? "Raw Material Group"
      : "Packing Material Subcategory";
  fmFamilyLabel.innerHTML = familyLabel + ' <span class="req">*</span>';
  fmThFamily.textContent = familyLabel;
  fmTableTitle.textContent = isFG
    ? "Product Group Mappings"
    : isRM
      ? "Raw Material Group Mappings"
      : "Packing Material Subcategory Mappings";
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — PROTOCOL MASTER
// ══════════════════════════════════════════════════════════════════════════════

async function loadProtocolList() {
  pmListLoading.classList.remove("hidden");
  pmListBody.innerHTML = "";

  const { data, error } = await labSupabase
    .from("protocol_category")
    .select(
      "id, category_code, category_name, source_document, subject_type, is_active, remarks",
    )
    .eq("subject_type", currentSubject)
    .order("category_code");

  pmListLoading.classList.add("hidden");

  if (error) {
    toast("Failed to load protocols: " + error.message, "error");
    pmListBody.innerHTML = `<tr><td colspan="3" class="empty-state"><strong>Error loading protocols</strong>${error.message}</td></tr>`;
    return;
  }

  pmProtocols = data ?? [];
  pmListCount.textContent = pmProtocols.length
    ? `${pmProtocols.length} record${pmProtocols.length !== 1 ? "s" : ""}`
    : "";
  renderPmList();
}

function renderPmList() {
  if (pmProtocols.length === 0) {
    pmListBody.innerHTML = `<tr><td colspan="3" class="empty-state"><strong>No ${currentSubject} protocols found</strong>Click "New Protocol" to create one.</td></tr>`;
    return;
  }
  pmListBody.innerHTML = pmProtocols
    .map(
      (p) => `
    <tr data-id="${p.id}" class="${pmSelectedId === p.id ? "selected" : ""}">
      <td style="font-weight:600;font-size:12.5px">${esc(p.category_code)}</td>
      <td>${esc(p.category_name)}</td>
      <td style="text-align:center">
        <span class="badge ${p.is_active ? "badge-active" : "badge-inactive"}">${p.is_active ? "Yes" : "No"}</span>
      </td>
    </tr>
  `,
    )
    .join("");

  pmListBody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => selectProtocol(Number(row.dataset.id)));
  });
}

function selectProtocol(id) {
  const proto = pmProtocols.find((p) => p.id === id);
  if (!proto) return;
  pmSelectedId = id;
  currentProtocolId = id; // FIX 4 — shared state; synced into other tabs when they load
  renderPmList();
  populatePmForm(proto);
  openPmEditModal();
  // Sync immediately into already-populated selects (no-op if not yet loaded)
  _syncProtocolSelectValue(tlProtocolSelect);
  _syncProtocolSelectValue(fmProtocolSelect);
}

/** Set select value to currentProtocolId if that option already exists. */
function _syncProtocolSelectValue(selectEl) {
  if (!currentProtocolId) return;
  if (selectEl.querySelector(`option[value="${currentProtocolId}"]`)) {
    selectEl.value = String(currentProtocolId);
    syncSearchInputFromSelect(selectEl);
  }
}

function populatePmForm(proto) {
  pmFieldSubjectType.value = proto.subject_type ?? currentSubject;
  pmFieldCategoryCode.value = proto.category_code ?? "";
  pmFieldCategoryName.value = proto.category_name ?? "";
  pmFieldSourceDocument.value = proto.source_document ?? "";
  pmFieldRemarks.value = proto.remarks ?? "";
  pmFieldIsActive.checked = proto.is_active !== false;
  pmFormTitle.textContent = "Edit Protocol";
  pmSaveBtn.disabled = false;
  pmDeactivateBtn.disabled = proto.is_active === false;
  hideBanner(pmFormBanner);
}

function clearPmForm() {
  pmFieldSubjectType.value = currentSubject ?? "";
  pmFieldCategoryCode.value = "";
  pmFieldCategoryName.value = "";
  pmFieldSourceDocument.value = "";
  pmFieldRemarks.value = "";
  pmFieldIsActive.checked = true;
  pmFormTitle.textContent = "Protocol Detail";
  pmSaveBtn.disabled = true;
  pmDeactivateBtn.disabled = true;
  hideBanner(pmFormBanner);
  pmSelectedId = null;
  renderPmList();
}

function wirePmForm() {
  pmNewBtn.addEventListener("click", () => {
    pmSelectedId = null;
    pmFieldSubjectType.value = currentSubject ?? "";
    pmFieldCategoryCode.value = "";
    pmFieldCategoryName.value = "";
    pmFieldSourceDocument.value = "";
    pmFieldRemarks.value = "";
    pmFieldIsActive.checked = true;
    pmFormTitle.textContent = "New Protocol";
    pmSaveBtn.disabled = false;
    pmDeactivateBtn.disabled = true;
    hideBanner(pmFormBanner);
    openPmEditModal();
    pmFieldCategoryCode.focus();
  });

  pmModalCloseBtn?.addEventListener("click", closePmEditModal);
  pmModalCancelBtn?.addEventListener("click", closePmEditModal);
  pmEditModal?.addEventListener("click", (e) => {
    if (e.target === pmEditModal) closePmEditModal();
  });

  pmSaveBtn.addEventListener("click", saveProtocol);
  pmDeactivateBtn.addEventListener("click", deactivateProtocol);
}

async function saveProtocol() {
  const code = pmFieldCategoryCode.value.trim();
  const name = pmFieldCategoryName.value.trim();
  if (!code || !name) {
    showBanner(
      pmFormBanner,
      "error",
      "Category Code and Category Name are required.",
    );
    return;
  }

  setBtnLoading(pmSaveBtn, true);
  hideBanner(pmFormBanner);

  const { data: savedId, error } = await labSupabase.rpc(
    "fn_save_protocol_category",
    {
      p_id: pmSelectedId ?? null,
      p_subject_type: currentSubject,
      p_category_code: code,
      p_category_name: name,
      p_source_document: pmFieldSourceDocument.value.trim() || null,
      p_remarks: pmFieldRemarks.value.trim() || null,
      p_is_active: pmFieldIsActive.checked,
    },
  );

  setBtnLoading(pmSaveBtn, false);

  if (error) {
    showBanner(pmFormBanner, "error", "Save failed: " + error.message);
    return;
  }

  if (savedId) pmSelectedId = savedId;

  toast("Protocol saved successfully.", "success");
  pmProtocols = []; // force reload
  await loadProtocolList();
  if (pmSelectedId) selectProtocol(pmSelectedId);
  closePmEditModal();

  // Invalidate TL + FM pickers so they reload on next visit
  resetSelect(tlProtocolSelect, "-- Select Protocol --");
  resetSelect(fmProtocolSelect, "-- Select Protocol --");
}

async function deactivateProtocol() {
  if (!pmSelectedId) return;
  if (
    !confirm(
      "Mark this protocol as inactive? Existing mappings referencing it will remain but should be reviewed.",
    )
  )
    return;

  const { error } = await labSupabase.rpc("fn_deactivate_protocol_category", {
    p_id: pmSelectedId,
  });

  if (error) {
    toast("Deactivate failed: " + error.message, "error");
    return;
  }
  toast("Protocol deactivated.", "warn");
  pmProtocols = [];
  await loadProtocolList();
  selectProtocol(pmSelectedId);
  closePmEditModal();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — TEST LINES
// ══════════════════════════════════════════════════════════════════════════════

function clearTlTab() {
  resetSelect(tlProtocolSelect, "-- Select Protocol --");
  tlContextStrip.classList.add("hidden");
  tlTableCard.classList.add("hidden");
  tlEmptyBanner.classList.add("hidden");
  tlAddLineBtn.disabled = true;
  tlSaveLinesBtn.disabled = true;
  tlTableBody.innerHTML = "";
  tlLines = [];
  tlProtocolId = null;
  tlDirty = false;
  hideTlOrderHint();
}

function wireTlTab() {
  tlProtocolSelect.addEventListener("change", onTlProtocolChange);
  tlAddLineBtn.addEventListener("click", addTlLine);
  tlSaveLinesBtn.addEventListener("click", saveTlLines);
  wireTlSpecDefaultModal();
}

function normalizeProtocolSpecType(specType) {
  const t = String(specType ?? "")
    .trim()
    .toUpperCase();
  if (t === "NMT") return "MAX_ONLY";
  if (t === "NLT") return "MIN_ONLY";
  if (VALID_PROTOCOL_SPEC_TYPES.includes(t)) return t;
  return "";
}

function formatSpecTypeSourceLabel(source) {
  const key = String(source ?? "")
    .trim()
    .toUpperCase();
  if (!key) return "—";
  return PROTOCOL_SPEC_TYPE_SOURCE_LABELS[key] ?? String(source).trim();
}

function isProtocolSpecTypeLocked(locked, source) {
  if (locked === true) return true;
  const s = String(locked ?? "").trim().toUpperCase();
  if (s === "TRUE" || s === "READY_LOCKED" || s === "LOCKED") return true;
  return false;
}

function isProfileExceptionAllowed(locked, source) {
  const src = String(source ?? "")
    .trim()
    .toUpperCase();
  const s = String(locked ?? "")
    .trim()
    .toUpperCase();
  if (src === "PROFILE_EXCEPTION_ALLOWED") return true;
  if (
    s === "READY_EXCEPTION_ALLOWED" ||
    s === "PROFILE_EXCEPTION_ALLOWED"
  ) {
    return true;
  }
  if (
    (locked === false || s === "FALSE") &&
    src === "PROFILE_EXCEPTION_ALLOWED"
  ) {
    return true;
  }
  return false;
}

function formatDefaultSpecTypeDisplay(specType) {
  const normalized = normalizeProtocolSpecType(specType);
  if (!normalized) return "Not set";
  return PROTOCOL_SPEC_TYPE_DISPLAY_LABELS[normalized] ?? normalized;
}

function defaultSpecTypeForResultKind(resultKind) {
  const rk = String(resultKind ?? "").trim().toUpperCase();
  if (rk === "TEXT") return "TEXT";
  if (rk === "PASS_FAIL") return "PASS_FAIL";
  if (rk === "NUMERIC") return "RANGE";
  return "RANGE";
}

function specTypeOptionsForResultKind(resultKind) {
  const rk = String(resultKind ?? "").trim().toUpperCase();
  if (rk === "TEXT") {
    return [["TEXT", "TEXT — free text"]];
  }
  if (rk === "PASS_FAIL") {
    return [["PASS_FAIL", "PASS / FAIL"]];
  }
  return [
    ["RANGE", "Range"],
    ["MIN_ONLY", "Min Only"],
    ["MAX_ONLY", "Max Only"],
    ["TOLERANCE", "Tolerance (target ± value)"],
  ];
}

function populateProtocolSpecTypeSelect(selectEl, resultKind, selectedValue) {
  if (!selectEl) return;
  const options = specTypeOptionsForResultKind(resultKind);
  const normalized = normalizeProtocolSpecType(selectedValue);
  selectEl.innerHTML = options
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}">${esc(label)}</option>`,
    )
    .join("");
  if (options.some(([value]) => value === normalized)) {
    selectEl.value = normalized;
  } else if (options.length) {
    selectEl.value = options[0][0];
  }
}

function renderProtocolSpecTypeBadge(specType) {
  const normalized = normalizeProtocolSpecType(specType);
  if (!normalized) {
    return `<span class="tl-spec-type-badge tl-spec-not-set">Not set</span>`;
  }
  const label = formatDefaultSpecTypeDisplay(normalized);
  return `<span class="tl-spec-type-badge">${esc(label)}</span>`;
}

function renderProtocolMetaBadges(locked, source) {
  const sourceLabel = formatSpecTypeSourceLabel(source);
  const parts = [
    `<span class="tl-meta-badge tl-meta-source" title="${esc(String(source ?? ""))}">${esc(sourceLabel)}</span>`,
  ];
  if (isProtocolSpecTypeLocked(locked, source)) {
    parts.push(
      `<span class="tl-meta-badge tl-meta-locked">Locked</span>`,
    );
  } else if (isProfileExceptionAllowed(locked, source)) {
    parts.push(
      `<span class="tl-meta-badge tl-meta-exception">Exception Allowed</span>`,
    );
  }
  return `<div class="tl-meta-badges">${parts.join("")}</div>`;
}

function getTestEntryForLine(line) {
  return tlTestMaster.find((t) => String(t.id) === String(line?.test_id));
}

function wireTlSpecDefaultModal() {
  tlSpecDefaultModalClose?.addEventListener("click", closeTlSpecDefaultModal);
  tlSpecDefaultModalCancel?.addEventListener("click", closeTlSpecDefaultModal);
  tlSpecDefaultModalApply?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyTlSpecDefaultModal();
  });
  tlSpecDefaultModalConfirmCancel?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideTlSpecDefaultConfirm();
  });
  tlSpecDefaultModalConfirmOk?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tlSpecModalPendingType) {
      commitTlSpecDefaultChange(tlSpecModalPendingType);
    }
  });
  tlSpecDefaultModalSelect?.addEventListener("change", () => {
    hideTlSpecDefaultConfirm();
  });
  tlSpecDefaultModal?.addEventListener("click", (e) => {
    if (e.target === tlSpecDefaultModal) closeTlSpecDefaultModal();
  });
}

function hideTlSpecDefaultConfirm() {
  tlSpecDefaultModalConfirm?.classList.add("hidden");
  tlSpecDefaultModalFooter?.classList.remove("hidden");
  tlSpecModalPendingType = null;
}

function showTlSpecDefaultConfirm(fromType, toType) {
  tlSpecModalPendingType = normalizeProtocolSpecType(toType);
  if (tlSpecDefaultModalConfirmMsg) {
    tlSpecDefaultModalConfirmMsg.textContent =
      `This line is locked as the protocol default expression. Change default spec type from ${formatDefaultSpecTypeDisplay(fromType)} to ${formatDefaultSpecTypeDisplay(toType)}?`;
  }
  hideBanner(tlSpecDefaultModalBanner);
  tlSpecDefaultModalConfirm?.classList.remove("hidden");
  tlSpecDefaultModalFooter?.classList.add("hidden");
  tlSpecDefaultModalConfirmOk?.focus();
}

function commitTlSpecDefaultChange(specType) {
  if (tlSpecModalLineIdx == null) return;
  const line = tlLines[tlSpecModalLineIdx];
  if (!line) return;

  const selected = normalizeProtocolSpecType(specType);
  if (!selected) return;

  line.default_spec_type = selected;
  line._dirty = true;
  tlDirty = true;
  tlSaveLinesBtn.disabled = false;
  hideTlSpecDefaultConfirm();
  closeTlSpecDefaultModal();
  renderTlTable();
  toast("Default spec type updated. Save test lines to persist.", "info");
}

function openTlSpecDefaultModal(lineIdx) {
  const line = tlLines[lineIdx];
  if (!line) return;

  const testEntry = getTestEntryForLine(line);
  if (!line.test_id) {
    toast("Select a test for this line before editing the default spec type.", "warn");
    return;
  }

  tlSpecModalLineIdx = lineIdx;
  tlSpecModalOrigType = normalizeProtocolSpecType(line.default_spec_type);

  const testName = testEntry?.test_name ?? line.test_name ?? "—";
  const methodName =
    line.method_name ||
    testEntry?.default_method_name ||
    "(No default method assigned)";
  tlSpecDefaultModalCtx.textContent = `${testName} · ${methodName}`;

  const resultKind = testEntry?.result_kind ?? "NUMERIC";
  populateProtocolSpecTypeSelect(
    tlSpecDefaultModalSelect,
    resultKind,
    line.default_spec_type,
  );

  tlSpecDefaultModalSource.textContent = formatSpecTypeSourceLabel(
    line.spec_type_source,
  );
  const reviewNote = String(line.spec_type_review_note ?? "").trim();
  tlSpecDefaultModalReviewNote.textContent = reviewNote || "—";

  const locked = isProtocolSpecTypeLocked(
    line.spec_type_locked,
    line.spec_type_source,
  );
  tlSpecDefaultModalLockedWarn?.classList.toggle("hidden", !locked);
  hideBanner(tlSpecDefaultModalBanner);
  hideTlSpecDefaultConfirm();

  tlSpecDefaultModal?.classList.remove("hidden");
  tlSpecDefaultModalSelect?.focus();
}

function closeTlSpecDefaultModal() {
  tlSpecDefaultModal?.classList.add("hidden");
  tlSpecModalLineIdx = null;
  tlSpecModalOrigType = null;
  hideBanner(tlSpecDefaultModalBanner);
  hideTlSpecDefaultConfirm();
}

function applyTlSpecDefaultModal() {
  if (tlSpecModalLineIdx == null) return;
  const line = tlLines[tlSpecModalLineIdx];
  if (!line) {
    closeTlSpecDefaultModal();
    return;
  }

  const selected = normalizeProtocolSpecType(tlSpecDefaultModalSelect?.value);
  if (!selected) {
    showBanner(
      tlSpecDefaultModalBanner,
      "error",
      "Default spec type is required for active test lines.",
    );
    return;
  }

  const locked = isProtocolSpecTypeLocked(
    line.spec_type_locked,
    line.spec_type_source,
  );
  if (
    locked &&
    tlSpecModalOrigType &&
    selected !== tlSpecModalOrigType
  ) {
    showTlSpecDefaultConfirm(tlSpecModalOrigType, selected);
    return;
  }

  commitTlSpecDefaultChange(selected);
}

async function populateTlProtocolSelect() {
  tlProtocolSelect.disabled = true;
  tlProtocolSelect.innerHTML = '<option value="">Loading…</option>';

  const { data, error } = await labSupabase
    .from("protocol_category")
    .select("id, category_code, category_name, source_document")
    .eq("subject_type", currentSubject)
    .eq("is_active", true)
    .order("category_code");

  if (error) {
    tlProtocolSelect.innerHTML =
      '<option value="">-- Error loading --</option>';
    tlProtocolSelect.disabled = false;
    toast("Failed to load protocols: " + error.message, "error");
    return;
  }

  fmProtocols = data ?? []; // cache for FM tab too
  populateSelect(
    tlProtocolSelect,
    data ?? [],
    "id",
    (r) => `${r.category_code} — ${r.category_name}`,
    "-- Select Protocol --",
  );
  tlProtocolSelect.disabled = false;
  _syncProtocolSelectValue(tlProtocolSelect); // FIX 4 — apply shared selection
  tlEmptyBanner.classList.remove("hidden");
}

// ── Test master: load tests with canonical default-method mapping ─────────────
// Primary source: lab.v_test_with_default_method (method columns only on view)
// result_kind merged from lab.test_master (not exposed on the view)
// Fallback: lab.test_master without method info if the view query fails
async function loadTlMasterData() {
  if (tlTestMasterLoaded) return;

  const [viewResult, masterResult] = await Promise.all([
    labSupabase
      .from("v_test_with_default_method")
      .select(
        "id, test_name, default_method_id, default_method_name, is_active",
      )
      .order("test_name"),
    labSupabase
      .from("test_master")
      .select("id, test_name, result_kind")
      .eq("is_active", true)
      .order("test_name"),
  ]);

  const { data: viewData, error: viewErr } = viewResult;
  const { data: masterData, error: masterErr } = masterResult;

  const resultKindById = new Map(
    (masterData ?? []).map((r) => [Number(r.id), r.result_kind]),
  );

  if (!viewErr && viewData) {
    tlTestMaster = viewData.map((r) => {
      const id = Number(r.id);
      return {
        id,
        test_name: r.test_name,
        default_method_id:
          r.default_method_id == null ? null : Number(r.default_method_id),
        default_method_name: r.default_method_name ?? null,
        is_active: r.is_active,
        result_kind: resultKindById.get(id) ?? "NUMERIC",
      };
    });
    tlTestMasterLoaded = true;
    return;
  }

  console.error("[lab-protocol-manager] v_test_with_default_method:", viewErr);

  if (!masterErr && masterData) {
    tlTestMaster = masterData.map((r) => ({
      id: Number(r.id),
      test_name: r.test_name,
      result_kind: r.result_kind,
      default_method_id: null,
      default_method_name: null,
    }));
  } else if (masterErr) {
    console.error("[lab-protocol-manager] test_master:", masterErr);
  }
  tlTestMasterLoaded = true;
}

async function onTlProtocolChange() {
  const id = tlProtocolSelect.value;
  tlContextStrip.classList.add("hidden");
  tlTableCard.classList.add("hidden");
  hideBanner(tlBanner);
  tlLines = [];
  tlProtocolId = null;
  tlAddLineBtn.disabled = true;
  tlSaveLinesBtn.disabled = true;
  tlDirty = false;

  if (!id) {
    tlEmptyBanner.classList.remove("hidden");
    return;
  }

  tlEmptyBanner.classList.add("hidden");
  tlProtocolId = Number(id);

  // Populate context strip
  const proto =
    fmProtocols.find((p) => String(p.id) === id) ??
    pmProtocols.find((p) => String(p.id) === id);
  if (proto) {
    tlCtxCode.textContent = proto.category_code ?? "—";
    tlCtxDoc.textContent = proto.source_document ?? "—";
    tlContextStrip.classList.remove("hidden");
  }

  await loadTlLines(tlProtocolId);
}

async function loadTlLines(protocolId) {
  showBanner(tlBanner, "info", "Loading test lines…");
  tlTableCard.classList.remove("hidden");
  tlTableBody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="spinner" style="margin:0 auto 6px;"></div>Loading…</td></tr>`;

  await loadTlMasterData();

  const { data, error } = await labSupabase
    .from("protocol_category_test")
    .select(
      "id, sort_order, seq_no, test_id, method_id, is_required, is_active, default_spec_type, spec_type_locked, spec_type_source, spec_type_review_note",
    )
    .eq("protocol_category_id", protocolId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("seq_no", { ascending: true });

  hideBanner(tlBanner);

  if (error) {
    showBanner(
      tlBanner,
      "error",
      "Failed to load test lines: " + error.message,
    );
    tlTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Error loading lines.</td></tr>`;
    return;
  }

  tlLines = (data ?? []).map((r) => {
    const testEntry = tlTestMaster.find(
      (t) => String(t.id) === String(r.test_id),
    );
    const methodId = r.method_id ?? testEntry?.default_method_id ?? null;
    const methodName =
      testEntry?.default_method_name ?? r.method_name ?? "";
    return {
      ...r,
      method_id: methodId,
      default_spec_type: normalizeProtocolSpecType(r.default_spec_type) || null,
      test_name: testEntry?.test_name ?? r.test_name ?? "",
      method_name: methodName,
      _dirty: false,
      _new: false,
    };
  });
  tlCtxCount.textContent = tlLines.length.toString();
  tlAddLineBtn.disabled = false;
  renderTlTable();
}

function renderTlTable() {
  tlLineCount.textContent = `${tlLines.length} line${tlLines.length !== 1 ? "s" : ""}`;

  if (tlLines.length === 0) {
    tlTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No test lines yet. Click <strong>Add Line</strong> to begin.</td></tr>`;
    tlSaveLinesBtn.disabled = true;
    return;
  }

  tlTableBody.innerHTML = tlLines
    .map((line, idx) => {
      const testOpts =
        '<option value="">-- Select Test --</option>' +
        tlTestMaster
          .map(
            (t) =>
              `<option value="${t.id}" ${String(line.test_id) === String(t.id) ? "selected" : ""}>${esc(t.test_name)}</option>`,
          )
          .join("");

      // Canonical method: look up from tlTestMaster using current line.test_id
      const testEntry = tlTestMaster.find(
        (t) => String(t.id) === String(line.test_id),
      );
      // Show method as a disabled select so the name is readable but not editable.
      // Only show a subtle cue when truly unmapped (edge case).
      const hasMethod = !!testEntry?.default_method_id;
      const methodDisplay =
        line.method_name ||
        (testEntry?.default_method_name ??
          (line.test_id ? "(No default method assigned)" : "—"));
      const methodCellColor = hasMethod ? "#374151" : "#9ca3af";
      const methodSelectHtml = `<input class="line-input" type="text" style="min-width:130px;color:${methodCellColor};background:#f9fafb" value="${esc(methodDisplay)}" disabled />`;
      const canDrag =
        tlBatchReorderRpcAvailable !== false &&
        !!line.id &&
        line.is_active !== false &&
        !line._new;
      const dragHandleHtml = canDrag
        ? `<span class="drag-handle" title="Drag to reorder" role="button" tabindex="0" aria-label="Drag to reorder test">⋮⋮</span>`
        : `<span class="drag-handle drag-handle-disabled" title="Drag unavailable" aria-hidden="true">⋮⋮</span>`;
      const specTypeHtml = renderProtocolSpecTypeBadge(line.default_spec_type);
      const metaHtml = renderProtocolMetaBadges(
        line.spec_type_locked,
        line.spec_type_source,
      );
      const editSpecDisabled = !line.test_id;
      const editSpecTitle = editSpecDisabled
        ? "Select a test first"
        : "Edit protocol default spec type";

      return `
    <tr data-idx="${idx}" data-line-id="${esc(line.id ?? "")}" data-seq-no="${esc(line.seq_no ?? "")}" data-sort-order="${esc(line.sort_order ?? "")}" draggable="${canDrag ? "true" : "false"}" class="${canDrag ? "" : "drag-disabled"}">
      <td class="td-center">
        <div class="order-cell">
          <span class="order-index">${idx + 1}</span>
          ${dragHandleHtml}
        </div>
      </td>
      <td><select class="line-input" data-field="test_id" style="min-width:160px">${testOpts}</select></td>
      <td>${methodSelectHtml}</td>
      <td class="td-center"><input class="line-cb" type="checkbox" data-field="is_required" ${line.is_required ? "checked" : ""} /></td>
      <td>${specTypeHtml}</td>
      <td>${metaHtml}</td>
      <td class="td-edit-spec">
        <button type="button" class="tl-edit-spec-btn" data-idx="${idx}" title="${esc(editSpecTitle)}" ${editSpecDisabled ? "disabled" : ""}>Edit</button>
      </td>
      <td class="td-actions">
        <button class="del-line-btn" data-idx="${idx}" title="Remove line" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>
  `;
    })
    .join("");

  // Bind input events
  tlTableBody
    .querySelectorAll("input[data-field], select[data-field]")
    .forEach((el) => {
      el.addEventListener("change", () => {
        const idx = Number(el.closest("tr").dataset.idx);
        const field = el.dataset.field;
        tlLines[idx][field] =
          el.type === "checkbox"
            ? el.checked
            : field === "seq_no"
              ? el.value === ""
                ? null
                : Number(el.value)
              : el.value;

        // CHANGE 2 — when test changes, auto-populate method_id from canonical mapping
        if (field === "test_id") {
          const testEntry = tlTestMaster.find(
            (t) => String(t.id) === String(el.value),
          );
          tlLines[idx].method_id = testEntry?.default_method_id ?? null;
          tlLines[idx].method_name = testEntry?.default_method_name ?? null;
          if (tlLines[idx]._new && el.value) {
            tlLines[idx].default_spec_type = defaultSpecTypeForResultKind(
              testEntry?.result_kind,
            );
          }
          // Re-render so the read-only method cell updates
          tlLines[idx]._dirty = true;
          tlDirty = true;
          tlSaveLinesBtn.disabled = false;
          renderTlTable();
          return; // renderTlTable re-binds, bail out
        }

        tlLines[idx]._dirty = true;
        el.classList.add("edited");
        tlDirty = true;
        tlSaveLinesBtn.disabled = false;
      });
    });

  wireTlDragAndDrop();

  tlTableBody.querySelectorAll(".tl-edit-spec-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      if (Number.isNaN(idx)) return;
      openTlSpecDefaultModal(idx);
    });
  });

  // Legacy move controls are intentionally kept for compatibility.
  // Buttons are hidden in UI, so this normally binds to zero elements.
  tlTableBody.querySelectorAll(".move-line-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.idx);
      const direction = btn.dataset.direction;
      const line = tlLines[idx];
      if (!line?.id || line.is_active === false || !direction) return;
      await moveTlLine(line.id, direction, btn);
    });
  });

  // Delete button
  tlTableBody.querySelectorAll(".del-line-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.idx);
      const removed = tlLines[idx];

      if (removed.id) {
        // Persisted row — confirm before deactivating
        const testName =
          tlTestMaster.find((t) => String(t.id) === String(removed.test_id))
            ?.test_name ?? `row #${removed.id}`;
        const confirmed = await showConfirmModal(
          `Remove test line "${testName}" (Seq ${removed.seq_no})? This will permanently deactivate the line and cannot be undone from this screen.`,
        );
        if (!confirmed) return;

        btn.disabled = true;
        const { error: delErr } = await labSupabase.rpc(
          "fn_deactivate_protocol_test_line",
          { p_id: removed.id },
        );
        if (delErr) {
          btn.disabled = false;
          showBanner(
            tlBanner,
            "error",
            "Could not remove line: " + delErr.message,
          );
          return;
        }
      }

      // Remove from local array and re-render (works for both saved and unsaved rows)
      tlLines.splice(idx, 1);
      tlDirty = tlLines.some((l) => l._dirty);
      renderTlTable();
      tlSaveLinesBtn.disabled = !tlDirty;
    });
  });

  tlSaveLinesBtn.disabled = !tlDirty;
}

function rpcMoveChanged(data) {
  const value = Array.isArray(data) ? data[0] : data;
  if (value && typeof value === "object" && "changed" in value) {
    return value.changed !== false;
  }
  if (value === false) return false;
  return true;
}

function getTlScrollState() {
  const scrollContainer = document.querySelector(".page-scroll") || window;
  const previousScrollTop =
    scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
  return { scrollContainer, previousScrollTop };
}

function restoreTlScrollState({ scrollContainer, previousScrollTop }) {
  requestAnimationFrame(() => {
    if (scrollContainer === window) {
      window.scrollTo({ top: previousScrollTop, behavior: "auto" });
    } else {
      scrollContainer.scrollTop = previousScrollTop;
    }
  });
}

function showTlOrderHint(message) {
  if (!tlOrderHint) return;
  if (
    tlOrderHint.textContent === message &&
    !tlOrderHint.classList.contains("hidden")
  )
    return;
  tlOrderHint.textContent = message;
  tlOrderHint.classList.remove("hidden");
}

function hideTlOrderHint() {
  if (!tlOrderHint) return;
  tlOrderHint.textContent = "";
  tlOrderHint.classList.add("hidden");
}

function isMissingBatchReorderRpc(error) {
  const msg = String(error?.message ?? "");
  return (
    /Could not find the function/i.test(msg) ||
    /not found in the schema cache/i.test(msg) ||
    /fn_reorder_protocol_test_lines/i.test(msg)
  );
}

function wireTlDragAndDrop() {
  tlTableBody.querySelectorAll('tr[draggable="true"]').forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      if (tlDirty) {
        e.preventDefault();
        toast("Save pending test-line changes before reordering.", "info");
        return;
      }
      const lineId = Number(row.dataset.lineId);
      if (!lineId) {
        e.preventDefault();
        return;
      }
      tlDraggedLineId = lineId;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(lineId));
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tlDraggedLineId = null;
      clearTlDragOver();
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      const sourceId = tlDraggedLineId;
      const targetId = Number(row.dataset.lineId);
      if (!sourceId || !targetId || sourceId === targetId) return;
      clearTlDragOver();
      row.classList.add("drag-over");
      e.dataTransfer.dropEffect = "move";
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const targetId = Number(row.dataset.lineId);
      const draggedId =
        Number(e.dataTransfer.getData("text/plain")) || tlDraggedLineId;
      row.classList.remove("drag-over");
      if (!draggedId || !targetId || draggedId === targetId) return;
      await reorderTlByDragDrop(draggedId, targetId, e.clientY, row);
    });
  });
}

function clearTlDragOver() {
  tlTableBody
    .querySelectorAll("tr.drag-over")
    .forEach((row) => row.classList.remove("drag-over"));
}

function computeDraggedOrderIds(
  draggedLineId,
  targetLineId,
  clientY,
  targetRow,
) {
  const activeIds = tlLines
    .filter((line) => line.id && line.is_active !== false && !line._new)
    .map((line) => Number(line.id));

  const fromIdx = activeIds.indexOf(Number(draggedLineId));
  const targetIdx = activeIds.indexOf(Number(targetLineId));
  if (fromIdx < 0 || targetIdx < 0) return null;

  const rect = targetRow.getBoundingClientRect();
  const dropAfter = clientY > rect.top + rect.height / 2;
  const ordered = [...activeIds];
  const [moved] = ordered.splice(fromIdx, 1);

  let insertIdx = targetIdx;
  if (fromIdx < targetIdx) insertIdx -= 1;
  if (dropAfter) insertIdx += 1;
  ordered.splice(Math.max(0, Math.min(insertIdx, ordered.length)), 0, moved);

  return ordered;
}

async function reorderTlByDragDrop(
  draggedLineId,
  targetLineId,
  clientY,
  targetRow,
) {
  if (!tlProtocolId) return;
  if (tlBatchReorderRpcAvailable === false) {
    console.warn("Batch reorder RPC not deployed.");
    toast("Batch reorder RPC not deployed.", "warn");
    return;
  }

  const orderedIds = computeDraggedOrderIds(
    draggedLineId,
    targetLineId,
    clientY,
    targetRow,
  );
  if (!orderedIds || orderedIds.length <= 1) return;

  const scrollState = getTlScrollState();

  const { error } = await labSupabase.rpc("fn_reorder_protocol_test_lines", {
    p_protocol_category_id: Number(tlProtocolId),
    p_ordered_line_ids: orderedIds,
  });

  if (error) {
    if (isMissingBatchReorderRpc(error)) {
      tlBatchReorderRpcAvailable = false;
      renderTlTable();
      console.warn("Batch reorder RPC not deployed.");
      toast("Batch reorder RPC not deployed.", "warn");
      return;
    }
    console.error("Protocol drag reorder failed", error);
    toast(`Could not update test order: ${error.message}`, "error");
    return;
  }

  tlBatchReorderRpcAvailable = true;
  showTlOrderHint(
    "Order changed. Rebuild/sync base specs if this order must flow downstream.",
  );
  toast("Test order updated.", "success");
  await loadTlLines(tlProtocolId);
  restoreTlScrollState(scrollState);
}

async function moveTlLine(lineId, direction, btn) {
  if (!tlProtocolId) return;
  if (tlDirty) {
    toast("Save pending test-line changes before reordering.", "info");
    return;
  }

  btn.disabled = true;
  const { data, error } = await labSupabase.rpc("fn_move_protocol_test_line", {
    p_protocol_category_test_id: Number(lineId),
    p_direction: direction,
  });

  if (error) {
    console.error("Protocol test move failed", error);
    toast(`Could not update test order: ${error.message}`, "error");
    btn.disabled = false;
    return;
  }

  if (!rpcMoveChanged(data)) {
    toast("Line is already at the boundary.", "info");
    const scrollState = getTlScrollState();
    await loadTlLines(tlProtocolId);
    restoreTlScrollState(scrollState);
    return;
  }

  const scrollState = getTlScrollState();
  await loadTlLines(tlProtocolId);
  restoreTlScrollState(scrollState);
  toast("Test order updated.", "success");
  showTlOrderHint(
    "Order changed. Rebuild/sync base specs if this order must flow downstream.",
  );
}

function addTlLine() {
  const nextSeq =
    tlLines.length > 0
      ? Math.max(...tlLines.map((l) => Number(l.seq_no) || 0)) + 10
      : 10;
  tlLines.push({
    id: null,
    seq_no: nextSeq,
    test_id: null,
    method_id: null,
    is_required: true,
    is_active: true,
    default_spec_type: null,
    spec_type_locked: null,
    spec_type_source: null,
    spec_type_review_note: null,
    _dirty: true,
    _new: true,
  });
  tlDirty = true;
  renderTlTable();
  tlSaveLinesBtn.disabled = false;
  // Scroll to last row
  tlTableBody.lastElementChild?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

async function saveTlLines() {
  if (!tlProtocolId) return;

  // GAP 5 — validate test lines before saving
  for (const l of tlLines) {
    if (!l.test_id) {
      showBanner(tlBanner, "error", "Test is required for all lines.");
      return;
    }
    if (!l.method_id) {
      const testEntry = tlTestMaster.find(
        (t) => String(t.id) === String(l.test_id),
      );
      showBanner(
        tlBanner,
        "error",
        `No default method is mapped for test "${testEntry?.test_name ?? l.test_id}". Cannot save until mapping is resolved.`,
      );
      return;
    }
    const specType = normalizeProtocolSpecType(l.default_spec_type);
    if (!specType) {
      const testEntry = tlTestMaster.find(
        (t) => String(t.id) === String(l.test_id),
      );
      showBanner(
        tlBanner,
        "error",
        `Default spec type is required for "${testEntry?.test_name ?? l.test_id}". Use Edit Default to set it.`,
      );
      return;
    }
    l.default_spec_type = specType;
  }
  const seqSet = new Set();
  for (const l of tlLines) {
    if (seqSet.has(l.seq_no)) {
      showBanner(
        tlBanner,
        "error",
        `Duplicate sequence number: ${l.seq_no}. Each line must have a unique Seq No.`,
      );
      return;
    }
    seqSet.add(l.seq_no);
  }

  const toInsert = tlLines.filter((l) => l._new && l._dirty && l.test_id);
  const toUpdate = tlLines.filter((l) => !l._new && l._dirty);

  if (toInsert.length === 0 && toUpdate.length === 0) {
    toast("No changes to save.", "info");
    return;
  }

  setBtnLoading(tlSaveLinesBtn, true);
  hideBanner(tlBanner);

  let hasError = false;

  // Save (insert or update) each dirty line via RPC
  const toSave = [
    ...tlLines.filter((l) => l._new && l._dirty && l.test_id),
    ...tlLines.filter((l) => !l._new && l._dirty),
  ];

  for (const l of toSave) {
    if (hasError) break;
    const { error } = await labSupabase.rpc("fn_save_protocol_test_line", {
      p_id: l.id ?? null,
      p_protocol_category_id: tlProtocolId,
      p_seq_no: l.seq_no,
      p_test_id: l.test_id || null,
      p_method_id: l.method_id || null,
      p_display_text: null,
      p_is_required: l.is_required !== false,
      p_is_active: true,
      p_default_spec_type: normalizeProtocolSpecType(l.default_spec_type) || null,
    });
    if (error) {
      const isDupe = /unique|duplicate/i.test(error.message ?? "");
      showBanner(
        tlBanner,
        "error",
        isDupe
          ? "Duplicate active test or sequence number. Reload protocol lines and try again."
          : "Save failed: " + error.message,
      );
      hasError = true;
    }
  }

  setBtnLoading(tlSaveLinesBtn, false);

  if (!hasError) {
    toast("Test lines saved.", "success");
    tlDirty = false;
    await loadTlLines(tlProtocolId);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — FAMILY MAPPING
// ══════════════════════════════════════════════════════════════════════════════

function clearFmTab() {
  resetSelect(fmFamilySelect, "-- Select --");
  resetSelect(fmProtocolSelect, "-- Select Protocol --");
  fmRemarks.value = "";
  fmIsActive.checked = true;
  fmSaveBtn.disabled = true;
  fmTableCard.classList.add("hidden");
  fmTableBody.innerHTML = "";
  hideBanner(fmFormBanner);
  hideBanner(fmTableBanner);
  fmMappingCount.textContent = "";
}

function wireFmTab() {
  fmFamilySelect.addEventListener("change", () => {
    fmSyncSaveBtn();
    loadFmMappings();
  });
  fmProtocolSelect.addEventListener("change", () => fmSyncSaveBtn());
  fmSaveBtn.addEventListener("click", saveFmMapping);
}

function fmSyncSaveBtn() {
  fmSaveBtn.disabled = !(fmFamilySelect.value && fmProtocolSelect.value);
}

async function populateFmProtocolSelect() {
  if (fmProtocols.length > 0) {
    _buildFmProtocolOptions();
    return;
  }
  fmProtocolSelect.innerHTML = '<option value="">Loading…</option>';
  fmProtocolSelect.disabled = true;

  const { data, error } = await labSupabase
    .from("protocol_category")
    .select("id, category_code, category_name")
    .eq("subject_type", currentSubject)
    .eq("is_active", true)
    .order("category_code");

  if (error) {
    fmProtocolSelect.innerHTML = '<option value="">-- Error --</option>';
    fmProtocolSelect.disabled = false;
    toast("Failed to load protocols: " + error.message, "error");
    return;
  }
  fmProtocols = data ?? [];
  _buildFmProtocolOptions();
  fmProtocolSelect.disabled = false;
}

function _buildFmProtocolOptions() {
  populateSelect(
    fmProtocolSelect,
    fmProtocols,
    "id",
    (r) => `${r.category_code} — ${r.category_name}`,
    "-- Select Protocol --",
  );
  _syncProtocolSelectValue(fmProtocolSelect); // FIX 4 — apply shared selection
}

async function loadFmFamilies() {
  fmFamilySelect.disabled = true;
  fmFamilySelect.innerHTML = '<option value="">Loading…</option>';

  let data, error;

  if (currentSubject === "FG") {
    ({ data, error } = await supabase
      .schema("public")
      .from("product_groups")
      .select("id, group_name")
      .order("group_name"));

    if (!error) {
      // dedupe by normalised group_name
      const seen = new Map();
      for (const row of data ?? []) {
        const key = String(row.group_name ?? "")
          .trim()
          .toLowerCase();
        if (!seen.has(key))
          seen.set(key, { id: row.id, label: row.group_name });
        else if (row.id < seen.get(key).id) seen.get(key).id = row.id;
      }
      fmFamilies = [...seen.values()].sort((a, b) =>
        (a.label ?? "").localeCompare(b.label ?? ""),
      );
    }
  } else if (currentSubject === "RM") {
    ({ data, error } = await labSupabase
      .from("v_rm_pm_item_with_group")
      .select("inv_group_id, inv_group_label")
      .eq("category_code", "RM")
      .order("inv_group_label"));

    if (!error) {
      const seen = new Map();
      for (const row of data ?? []) {
        if (!seen.has(row.inv_group_id))
          seen.set(row.inv_group_id, {
            id: row.inv_group_id,
            label: row.inv_group_label,
          });
      }
      fmFamilies = [...seen.values()].sort((a, b) =>
        (a.label ?? "").localeCompare(b.label ?? ""),
      );
    }
  } else {
    // PM: canonicalized at subcategory level
    ({ data, error } = await labSupabase
      .from("v_rm_pm_item_with_group")
      .select("subcategory_id, subcategory_label")
      .eq("category_code", "PLM")
      .order("subcategory_label"));

    if (!error) {
      const seen = new Map();
      for (const row of data ?? []) {
        if (!seen.has(row.subcategory_id))
          seen.set(row.subcategory_id, {
            id: row.subcategory_id,
            label: row.subcategory_label,
          });
      }
      fmFamilies = [...seen.values()].sort((a, b) =>
        (a.label ?? "").localeCompare(b.label ?? ""),
      );
    }
  }

  if (error) {
    fmFamilySelect.innerHTML = '<option value="">-- Error --</option>';
    fmFamilySelect.disabled = false;
    toast("Failed to load family list: " + error.message, "error");
    return;
  }

  const placeholder =
    currentSubject === "FG"
      ? "-- Select Product Group --"
      : currentSubject === "RM"
        ? "-- Select Inventory Group --"
        : "-- Select Packing Material Subcategory --";
  populateSelect(fmFamilySelect, fmFamilies, "id", "label", placeholder);
  fmFamilySelect.disabled = false;
}

async function loadFmMappings() {
  const familyId = fmFamilySelect.value;
  fmTableBanner && hideBanner(fmTableBanner);
  fmTableBody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="spinner" style="margin:0 auto 6px;"></div>Loading…</td></tr>`;
  fmTableCard.classList.remove("hidden");
  fmMappingCount.textContent = "";

  let query;

  if (currentSubject === "FG") {
    query = labSupabase
      .from("protocol_category_product_group_map")
      .select(
        "id, product_group_id, protocol_category_id, is_active, remarks, protocol_category(category_code, category_name)",
      )
      .order("product_group_id");
    if (familyId) query = query.eq("product_group_id", familyId);
  } else if (currentSubject === "RM") {
    query = labSupabase
      .from("protocol_category_inv_group_map")
      .select(
        "id, inv_group_id, protocol_category_id, is_active, remarks, protocol_category(category_code, category_name)",
      )
      .order("inv_group_id");
    if (familyId) query = query.eq("inv_group_id", familyId);
  } else {
    // PM: uses subcategory mapping table
    query = labSupabase
      .from("protocol_category_pm_subcategory_map")
      .select(
        "id, subcategory_id, protocol_category_id, is_active, remarks, protocol_category(category_code, category_name)",
      )
      .order("subcategory_id");
    if (familyId) query = query.eq("subcategory_id", familyId);
  }

  const { data, error } = await query;

  if (error) {
    fmTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Error loading mappings.</td></tr>`;
    showBanner(fmTableBanner, "error", "Load failed: " + error.message);
    return;
  }

  const rows = data ?? [];
  fmMappingCount.textContent = rows.length
    ? `${rows.length} mapping${rows.length !== 1 ? "s" : ""}`
    : "";

  if (rows.length === 0) {
    fmTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No mappings found${familyId ? " for this selection" : ""}.</td></tr>`;
    return;
  }

  // Build family label lookup
  const familyLookup = new Map(fmFamilies.map((f) => [String(f.id), f.label]));

  fmTableBody.innerHTML = rows
    .map((r) => {
      const rawFamilyId =
        currentSubject === "FG"
          ? r.product_group_id
          : currentSubject === "RM"
            ? r.inv_group_id
            : r.subcategory_id;
      const familyLabel =
        familyLookup.get(String(rawFamilyId)) ?? `#${rawFamilyId}`;
      const proto = r.protocol_category ?? {};
      return `
      <tr data-map-id="${r.id}">
        <td>${esc(familyLabel)}</td>
        <td style="font-weight:600">${esc(proto.category_code ?? "—")}</td>
        <td>${esc(proto.category_name ?? "—")}</td>
        <td style="text-align:center">
          <span class="badge ${r.is_active ? "badge-active" : "badge-inactive"}">${r.is_active ? "Yes" : "No"}</span>
        </td>
        <td>${esc(r.remarks ?? "")}</td>
        <td style="text-align:center">
          <button class="btn-secondary btn-sm fm-toggle-btn" data-map-id="${r.id}" data-active="${r.is_active}" type="button"
            style="font-size:11.5px;padding:3px 9px">
            ${r.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  // Bind toggle buttons
  fmTableBody.querySelectorAll(".fm-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      toggleFmMapping(Number(btn.dataset.mapId), btn.dataset.active === "true"),
    );
  });
}

async function saveFmMapping() {
  const familyId = fmFamilySelect.value;
  const protocolId = fmProtocolSelect.value;
  if (!familyId || !protocolId) {
    showBanner(
      fmFormBanner,
      "error",
      "Please select both a family and a protocol.",
    );
    return;
  }

  // FIX 3 — verify selected protocol belongs to the current subject
  if (fmProtocols.length > 0) {
    const protocolValid = fmProtocols.some(
      (p) => String(p.id) === String(protocolId),
    );
    if (!protocolValid) {
      showBanner(
        fmFormBanner,
        "error",
        "Selected protocol is not valid for the current subject.",
      );
      return;
    }
  }

  setBtnLoading(fmSaveBtn, true);
  hideBanner(fmFormBanner);

  const remarks =
    fmRemarks.value.trim() ||
    "Activated via Protocol Manager family-aware mapping";

  const getAffectedCount = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (
      typeof val === "string" &&
      val.trim() !== "" &&
      !Number.isNaN(Number(val))
    ) {
      return Number(val);
    }
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === "number") return first;
      if (first && typeof first === "object") {
        for (const k of ["count", "affected_count", "affected", "result"]) {
          if (first[k] !== undefined && !Number.isNaN(Number(first[k]))) {
            return Number(first[k]);
          }
        }
      }
    }
    if (val && typeof val === "object") {
      for (const k of ["count", "affected_count", "affected", "result"]) {
        if (val[k] !== undefined && !Number.isNaN(Number(val[k]))) {
          return Number(val[k]);
        }
      }
    }
    return null;
  };

  let saveError;
  let saveData;
  if (currentSubject === "FG") {
    ({ data: saveData, error: saveError } = await labSupabase.rpc(
      "fn_set_active_fg_protocol_for_group_family",
      {
        p_product_group_id: Number(familyId),
        p_protocol_category_id: Number(protocolId),
        p_remarks: remarks,
      },
    ));
  } else if (currentSubject === "RM") {
    ({ data: saveData, error: saveError } = await labSupabase.rpc(
      "fn_set_active_rm_protocol_for_group_family",
      {
        p_inv_group_id: Number(familyId),
        p_protocol_category_id: Number(protocolId),
        p_remarks: remarks,
      },
    ));
  } else {
    ({ data: saveData, error: saveError } = await labSupabase.rpc(
      "fn_set_active_pm_protocol_for_subcategory_family",
      {
        p_subcategory_id: Number(familyId),
        p_protocol_category_id: Number(protocolId),
        p_remarks: remarks,
      },
    ));
  }

  setBtnLoading(fmSaveBtn, false);

  if (saveError) {
    showBanner(fmFormBanner, "error", "Save failed: " + saveError.message);
    return;
  }

  const affectedCount = getAffectedCount(saveData);
  if (affectedCount === null) {
    toast("Protocol mapping saved successfully.", "success");
  } else {
    toast(
      `Protocol mapped successfully to ${affectedCount} equivalent family record(s).`,
      "success",
    );
  }
  hideBanner(fmFormBanner);
  await loadFmMappings();
  if (currentTab === "usagePreview" && upProtocolSelect?.value) {
    await loadUsagePreview();
  }
  // GAP 1 — warn if the mapped protocol has no active test lines
  await checkProtocolHasTestLines(Number(protocolId));
}

// GAP 1 — post-save soft validation: warn if protocol has no active test lines
async function checkProtocolHasTestLines(protocolId) {
  const { count, error } = await labSupabase
    .from("protocol_category_test")
    .select("id", { count: "exact", head: true })
    .eq("protocol_category_id", protocolId)
    .eq("is_active", true);
  if (error) return; // non-critical; don't surface
  if (!count || count === 0) {
    toast(
      "Warning: This protocol has no active test lines. Spec generation will produce an empty profile.",
      "warn",
      6000,
    );
  }
}

async function toggleFmMapping(mapId, currentlyActive) {
  const rpcName =
    currentSubject === "PM"
      ? "fn_toggle_protocol_pm_subcategory_mapping"
      : "fn_toggle_protocol_family_mapping";
  const payload =
    currentSubject === "PM"
      ? { p_map_id: mapId, p_is_active: !currentlyActive }
      : {
          p_subject_type: currentSubject,
          p_map_id: mapId,
          p_is_active: !currentlyActive,
        };
  const { error } = await labSupabase.rpc(rpcName, payload);

  if (error) {
    toast("Update failed: " + error.message, "error");
    return;
  }
  toast(
    currentlyActive ? "Mapping deactivated." : "Mapping reactivated.",
    "success",
  );
  await loadFmMappings();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — USAGE PREVIEW
// ══════════════════════════════════════════════════════════════════════════════

function wireUpTab() {
  upProtocolSelect.addEventListener("change", loadUsagePreview);
}

function updateUsagePreviewLabels() {
  const titleMap = {
    FG: "FG Usage Preview",
    RM: "RM Usage Preview",
    PM: "PM Usage Preview",
  };
  const titleEl = document.getElementById("upFormTitle");
  if (titleEl)
    titleEl.textContent = titleMap[currentSubject] ?? "Usage Preview";
}

async function populateUpProtocolSelect() {
  upProtocolSelect.disabled = true;
  upProtocolSelect.innerHTML = '<option value="">Loading…</option>';

  const { data, error } = await labSupabase
    .from("protocol_category")
    .select("id, category_code, category_name")
    .eq("subject_type", currentSubject)
    .eq("is_active", true)
    .order("category_code");

  if (error) {
    upProtocolSelect.innerHTML =
      '<option value="">-- Error loading --</option>';
    upProtocolSelect.disabled = false;
    toast("Failed to load protocols: " + error.message, "error");
    return;
  }

  populateSelect(
    upProtocolSelect,
    data ?? [],
    "id",
    (r) => `${r.category_code} — ${r.category_name}`,
    "-- Select Protocol --",
  );
  upProtocolSelect.disabled = false;

  // Auto-select if protocol was already chosen in another tab
  if (currentProtocolId) {
    const opt = upProtocolSelect.querySelector(
      `option[value="${currentProtocolId}"]`,
    );
    if (opt) {
      upProtocolSelect.value = String(currentProtocolId);
      await loadUsagePreview();
      return;
    }
  }

  // Show idle hint
  upEmptyBanner.classList.remove("hidden");
}

async function loadUsagePreview() {
  const id = upProtocolSelect.value;

  // Reset UI
  upSummaryStrip.classList.add("hidden");
  upTableCard.classList.add("hidden");
  upEmptyBanner.classList.add("hidden");
  hideBanner(upBanner);
  upRows = [];

  if (!id) {
    upEmptyBanner.classList.remove("hidden");
    return;
  }

  showBanner(upBanner, "info", "Loading coverage data…");
  upTableCard.classList.remove("hidden");
  upTableBody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="spinner" style="margin:0 auto 6px;"></div>Loading…</td></tr>`;

  const { data, error } = await labSupabase
    .from("v_protocol_usage_preview")
    .select("*")
    .eq("protocol_id", Number(id))
    .order("mapped_family_name");

  hideBanner(upBanner);

  if (error) {
    showBanner(
      upBanner,
      "error",
      "Failed to load usage preview: " + error.message,
    );
    upTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Error loading data.</td></tr>`;
    return;
  }

  upRows = data ?? [];

  if (upRows.length === 0) {
    upTableCard.classList.remove("hidden");
    upTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No active family mappings found for this protocol.</td></tr>`;
    return;
  }

  // Summary
  const totalMapped = upRows.length;
  const covered = upRows.reduce(
    (sum, r) => sum + Number(r.covered_item_count || 0),
    0,
  );
  const testLines = upRows.length
    ? Number(upRows[0].active_test_line_count || 0)
    : 0;
  const ready = upRows.filter((r) => r.status === "READY").length;

  upMappedCount.textContent = String(totalMapped);
  upCoveredCount.textContent = String(covered);
  upTestLineCount.textContent = String(testLines);
  upReadyCount.textContent = String(ready);
  upSummaryStrip.classList.remove("hidden");

  // Table
  upTableBody.innerHTML = upRows
    .map((r) => {
      const statusBadge =
        r.status === "READY"
          ? `<span class="badge badge-active">Ready</span>`
          : r.status === "BASE_SPEC_PENDING"
            ? `<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">Base Spec Pending</span>`
            : `<span class="badge badge-inactive">${esc(r.status ?? "—")}</span>`;

      const version = r.base_spec_version ? `v${r.base_spec_version}` : "—";

      return `
        <tr>
          <td style="font-weight:600">${esc(r.mapped_family_name || "—")}</td>
          <td>${esc(r.mapped_family_type || "—")}</td>
          <td>${esc(r.base_spec_name || "Not configured")}</td>
          <td style="text-align:center">${esc(version)}</td>
          <td style="text-align:center">${Number(r.covered_item_count || 0)}</td>
          <td style="text-align:center">${Number(r.active_test_line_count || 0)}</td>
          <td style="text-align:center">${statusBadge}</td>
        </tr>
      `;
    })
    .join("");

  upTableCard.classList.remove("hidden");
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared Utilities
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Populate a <select> from an array of objects.
 * labelFn can be a string key or a function.
 */
function populateSelect(selectEl, items, valueKey, labelFn, placeholder) {
  const fn = typeof labelFn === "function" ? labelFn : (r) => r[labelFn];
  selectEl.innerHTML =
    `<option value="">${esc(placeholder ?? "-- Select --")}</option>` +
    items
      .map(
        (item) =>
          `<option value="${esc(String(item[valueKey]))}">${esc(fn(item))}</option>`,
      )
      .join("");
  syncSearchInputFromSelect(selectEl);
}

function resetSelect(selectEl, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder ?? "-- Select --"}</option>`;
  syncSearchInputFromSelect(selectEl);
}

function getSearchableBinding(selectEl) {
  if (selectEl === tlProtocolSelect) {
    return {
      inputEl: tlProtocolSearchInput,
      resultsEl: tlProtocolSearchResults,
    };
  }
  if (selectEl === fmFamilySelect) {
    return { inputEl: fmFamilySearchInput, resultsEl: fmFamilySearchResults };
  }
  if (selectEl === fmProtocolSelect) {
    return {
      inputEl: fmProtocolSearchInput,
      resultsEl: fmProtocolSearchResults,
    };
  }
  if (selectEl === upProtocolSelect) {
    return {
      inputEl: upProtocolSearchInput,
      resultsEl: upProtocolSearchResults,
    };
  }
  return null;
}

function wireSearchableSelectComboboxes() {
  [
    tlProtocolSelect,
    fmFamilySelect,
    fmProtocolSelect,
    upProtocolSelect,
  ].forEach((selectEl) => {
    const binding = getSearchableBinding(selectEl);
    if (!binding?.inputEl || !binding?.resultsEl || !selectEl) return;
    const { inputEl, resultsEl } = binding;

    inputEl.addEventListener("focus", async () => {
      await ensureSearchOptionsLoaded(selectEl);
      renderSearchResults(selectEl, inputEl.value);
    });

    inputEl.addEventListener("input", async () => {
      const q = inputEl.value.trim();
      if (!q && selectEl.value) {
        selectEl.value = "";
        selectEl.dispatchEvent(new Event("change", { bubbles: false }));
      }
      await ensureSearchOptionsLoaded(selectEl);
      renderSearchResults(selectEl, q);
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        resultsEl.classList.add("hidden");
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (resultsEl.classList.contains("hidden")) {
          renderSearchResults(selectEl, inputEl.value);
        }
        const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
        if (!items.length) return;
        const currentIndex = Number(resultsEl.dataset.activeIndex ?? "-1");
        const nextIndex =
          e.key === "ArrowDown"
            ? Math.min(currentIndex + 1, items.length - 1)
            : currentIndex <= 0
              ? 0
              : currentIndex - 1;
        setSearchActiveIndex(resultsEl, nextIndex);
        items[nextIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key !== "Enter") return;
      const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
      if (!items.length) return;
      const activeIndex = Number(resultsEl.dataset.activeIndex ?? "-1");
      const targetBtn = activeIndex >= 0 ? items[activeIndex] : items[0];
      if (!targetBtn) return;
      e.preventDefault();
      targetBtn.click();
    });

    inputEl.addEventListener("blur", () => {
      window.setTimeout(() => resultsEl.classList.add("hidden"), 120);
    });

    selectEl.addEventListener("change", () => {
      syncSearchInputFromSelect(selectEl);
    });
  });
}

async function ensureSearchOptionsLoaded(selectEl) {
  if (!currentSubject) return;
  if (selectEl.options.length > 1) return;

  if (selectEl === tlProtocolSelect) {
    await populateTlProtocolSelect();
    return;
  }

  if (selectEl === fmProtocolSelect) {
    await populateFmProtocolSelect();
    return;
  }

  if (selectEl === fmFamilySelect) {
    await loadFmFamilies();
    return;
  }

  if (selectEl === upProtocolSelect) {
    await populateUpProtocolSelect();
  }
}

function renderSearchResults(selectEl, query) {
  const binding = getSearchableBinding(selectEl);
  if (!binding?.resultsEl || !binding?.inputEl) return;
  const { resultsEl, inputEl } = binding;

  const options = [...selectEl.options].filter((o) => o.value !== "");
  const needle = String(query ?? "")
    .trim()
    .toLowerCase();
  const filtered = needle
    ? options.filter((o) => o.text.toLowerCase().includes(needle))
    : options.slice(0, 40);
  const rows = filtered.slice(0, 120);

  if (!rows.length) {
    resultsEl.innerHTML =
      '<div class="erp-combobox-empty">No matching records</div>';
    resultsEl.dataset.activeIndex = "-1";
    resultsEl.classList.remove("hidden");
    return;
  }

  resultsEl.innerHTML = rows
    .map(
      (opt) =>
        `<button type="button" class="erp-combobox-item" data-id="${esc(String(opt.value))}">${esc(opt.text)}</button>`,
    )
    .join("");

  resultsEl.querySelectorAll(".erp-combobox-item").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("mouseenter", () => {
      const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
      setSearchActiveIndex(resultsEl, items.indexOf(btn));
    });
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const row = rows.find((x) => String(x.value) === id);
      if (!row) return;
      inputEl.value = row.text;
      selectEl.value = String(row.value);
      resultsEl.classList.add("hidden");
      selectEl.dispatchEvent(new Event("change", { bubbles: false }));
    });
  });

  const selectedIdx = rows.findIndex(
    (x) => String(x.value) === String(selectEl.value),
  );
  setSearchActiveIndex(resultsEl, selectedIdx >= 0 ? selectedIdx : 0);
  resultsEl.classList.remove("hidden");
}

function setSearchActiveIndex(resultsEl, idx) {
  const items = [...resultsEl.querySelectorAll(".erp-combobox-item")];
  const safeIdx = idx >= 0 && idx < items.length ? idx : -1;
  resultsEl.dataset.activeIndex = String(safeIdx);
  items.forEach((item, i) => {
    item.classList.toggle("active", i === safeIdx);
    item.setAttribute("aria-selected", i === safeIdx ? "true" : "false");
  });
}

function syncSearchInputFromSelect(selectEl) {
  const binding = getSearchableBinding(selectEl);
  if (!binding?.inputEl || !binding?.resultsEl) return;
  const { inputEl, resultsEl } = binding;

  if (!selectEl.value) {
    inputEl.value = "";
    resultsEl.classList.add("hidden");
    return;
  }

  const selectedText = selectEl.options[selectEl.selectedIndex]?.text ?? "";
  inputEl.value = selectedText;
  resultsEl.classList.add("hidden");
}

function showBanner(el, type, message) {
  if (!el) return;
  el.className = `info-banner ${type}`;
  el.textContent = message;
}

function hideBanner(el) {
  if (!el) return;
  el.className = "info-banner hidden";
  el.textContent = "";
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
  const spinner = btn.querySelector(".btn-spinner");
  if (spinner) spinner.style.display = loading ? "inline-block" : "none";
}

/** HTML-escape a value safely */
function esc(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(message, type = "info", durationMs = 3500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `pm-toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, durationMs);
}
