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

// ── Test Lines tab
const tlSectionTitle = document.getElementById("tlSectionTitle");
const tlProtocolSelect = document.getElementById("tlProtocolSelect");
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

// ── Family Mapping tab
const fmFormTitle = document.getElementById("fmFormTitle");
const fmFormBanner = document.getElementById("fmFormBanner");
const fmFamilyLabel = document.getElementById("fmFamilyLabel");
const fmFamilySelect = document.getElementById("fmFamilySelect");
const fmProtocolSelect = document.getElementById("fmProtocolSelect");
const fmRemarks = document.getElementById("fmRemarks");
const fmIsActive = document.getElementById("fmIsActive");
const fmSaveBtn = document.getElementById("fmSaveBtn");
const fmTableCard = document.getElementById("fmTableCard");
const fmTableTitle = document.getElementById("fmTableTitle");
const fmMappingCount = document.getElementById("fmMappingCount");
const fmTableBanner = document.getElementById("fmTableBanner");
const fmTableBody = document.getElementById("fmTableBody");
const fmThFamily = document.getElementById("fmThFamily");

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
let tlDeletedIds = []; // ids of existing rows that were deleted in the UI
/**
 * tlTestMaster — canonical test list with default method info.
 * Shape: { id, test_name, default_method_id, default_method_name }
 * Loaded from lab.v_test_with_default_method if available;
 * falls back to lab.test_master (no method info) when view is absent.
 */
let tlTestMaster = [];
let tlTestMasterLoaded = false;

// Family Mapping state
let fmProtocols = [];
let fmFamilies = [];

// Cross-tab shared selection
let currentProtocolId = null; // set when a protocol is selected in Protocol Master

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init();

function init() {
  homeBtn.addEventListener("click", () => Platform.goHome());
  wireSubjectPills();
  wireTabStrip();
  wirePmForm();
  wireTlTab();
  wireFmTab();
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
}

function resetAllState() {
  pmProtocols = [];
  pmSelectedId = null;
  currentProtocolId = null;
  tlProtocolId = null;
  tlLines = [];
  tlDirty = false;
  tlDeletedIds = [];
  tlTestMaster = [];
  tlTestMasterLoaded = false;
  fmProtocols = [];
  fmFamilies = [];
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
  // Sync immediately into already-populated selects (no-op if not yet loaded)
  _syncProtocolSelectValue(tlProtocolSelect);
  _syncProtocolSelectValue(fmProtocolSelect);
}

/** Set select value to currentProtocolId if that option already exists. */
function _syncProtocolSelectValue(selectEl) {
  if (!currentProtocolId) return;
  if (selectEl.querySelector(`option[value="${currentProtocolId}"]`))
    selectEl.value = String(currentProtocolId);
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
    clearPmForm();
    pmFormTitle.textContent = "New Protocol";
    pmSaveBtn.disabled = false;
    pmFieldCategoryCode.focus();
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
  tlDeletedIds = []; // FIX 2
  tlProtocolId = null;
  tlDirty = false;
}

function wireTlTab() {
  tlProtocolSelect.addEventListener("change", onTlProtocolChange);
  tlAddLineBtn.addEventListener("click", addTlLine);
  tlSaveLinesBtn.addEventListener("click", saveTlLines);
}

async function populateTlProtocolSelect() {
  tlProtocolSelect.disabled = true;
  tlProtocolSelect.innerHTML = '<option value="">Loading…</option>';

  const { data, error } = await labSupabase
    .from("protocol_category")
    .select("id, category_code, category_name")
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
// Primary source: lab.v_test_with_default_method
//   columns expected: id (or test_id), test_name, default_method_id, default_method_name
// Fallback: lab.test_master (no method info)
async function loadTlMasterData() {
  if (tlTestMasterLoaded) return;

  // Attempt primary source — canonical view with test→method mapping.
  // No .eq("is_active") filter here: is_active on the view may reflect the
  // mapping row's status, not the test's. We want ALL active tests visible
  // even if they have no default method mapped yet; the method cell will show
  // the ⚠️ cue for unmapped ones. Filter only on test_active if the view
  // exposes a dedicated test-active column.
  const { data: viewData, error: viewErr } = await labSupabase
    .from("v_test_with_default_method")
    .select("id, test_name, default_method_id, default_method_name")
    .order("test_name");

  if (!viewErr && viewData) {
    tlTestMaster = viewData;
    tlTestMasterLoaded = true;
    return;
  }

  // Fallback: plain test_master without method info
  // (default_method_id / default_method_name will be absent — method shows blank)
  const { data: fallbackData, error: fallbackErr } = await labSupabase
    .from("test_master")
    .select("id, test_name")
    .eq("is_active", true)
    .order("test_name");

  if (!fallbackErr) {
    tlTestMaster = (fallbackData ?? []).map((r) => ({
      ...r,
      default_method_id: null,
      default_method_name: null,
    }));
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
  tlTableBody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="spinner" style="margin:0 auto 6px;"></div>Loading…</td></tr>`;

  const { data, error } = await labSupabase
    .from("protocol_category_test")
    .select(
      "id, seq_no, test_id, method_id, display_text, is_required, is_active",
    )
    .eq("protocol_category_id", protocolId)
    .order("seq_no");

  hideBanner(tlBanner);

  if (error) {
    showBanner(
      tlBanner,
      "error",
      "Failed to load test lines: " + error.message,
    );
    tlTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Error loading lines.</td></tr>`;
    return;
  }

  tlLines = (data ?? []).map((r) => ({ ...r, _dirty: false, _new: false }));
  tlCtxCount.textContent = tlLines.length.toString();
  tlAddLineBtn.disabled = false;
  await loadTlMasterData();
  renderTlTable();
}

function renderTlTable() {
  tlLineCount.textContent = `${tlLines.length} line${tlLines.length !== 1 ? "s" : ""}`;

  if (tlLines.length === 0) {
    tlTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No test lines yet. Click <strong>Add Line</strong> to begin.</td></tr>`;
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
        testEntry?.default_method_name ??
        (line.test_id ? "(No default method assigned)" : "—");
      const methodCellColor = hasMethod ? "#374151" : "#9ca3af";
      const methodSelectHtml = `<select class="line-input" style="min-width:130px;color:${methodCellColor};background:#f9fafb" disabled>
        <option>${esc(methodDisplay)}</option>
      </select>`;

      return `
    <tr data-idx="${idx}">
      <td class="td-center">
        <input class="line-input narrow" type="number" min="1" data-field="seq_no" value="${esc(line.seq_no ?? idx + 1)}" style="text-align:center" />
      </td>
      <td><select class="line-input" data-field="test_id" style="min-width:160px">${testOpts}</select></td>
      <td>${methodSelectHtml}</td>
      <td><input class="line-input" type="text" data-field="display_text" value="${esc(line.display_text ?? "")}" placeholder="Optional display note" /></td>
      <td class="td-center"><input class="line-cb" type="checkbox" data-field="is_required" ${line.is_required ? "checked" : ""} /></td>
      <td class="td-center"><input class="line-cb" type="checkbox" data-field="is_active"   ${line.is_active !== false ? "checked" : ""} /></td>
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

  // Delete button
  tlTableBody.querySelectorAll(".del-line-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const removed = tlLines[idx];
      // FIX 2 — track existing rows for soft-delete on save
      if (removed.id) tlDeletedIds.push(removed.id);
      tlLines.splice(idx, 1);
      tlDirty = true;
      renderTlTable();
      tlSaveLinesBtn.disabled = false;
    });
  });

  tlSaveLinesBtn.disabled = !tlDirty;
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
    display_text: "",
    is_required: true,
    is_active: true,
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

  if (
    toInsert.length === 0 &&
    toUpdate.length === 0 &&
    tlDeletedIds.length === 0
  ) {
    toast("No changes to save.", "info");
    return;
  }

  setBtnLoading(tlSaveLinesBtn, true);
  hideBanner(tlBanner);

  // Soft-deactivate deleted rows via RPC
  for (const id of tlDeletedIds) {
    const { error: delErr } = await labSupabase.rpc(
      "fn_deactivate_protocol_test_line",
      { p_id: id },
    );
    if (delErr) {
      showBanner(
        tlBanner,
        "error",
        "Delete (deactivate) failed: " + delErr.message,
      );
      setBtnLoading(tlSaveLinesBtn, false);
      return;
    }
  }

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
      p_display_text: l.display_text || null,
      p_is_required: l.is_required !== false,
      p_is_active: l.is_active !== false,
    });
    if (error) {
      showBanner(tlBanner, "error", "Save failed: " + error.message);
      hasError = true;
    }
  }

  setBtnLoading(tlSaveLinesBtn, false);

  if (!hasError) {
    toast("Test lines saved.", "success");
    tlDirty = false;
    tlDeletedIds = []; // FIX 2 — clear after successful persist
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

  let saveError;
  if (currentSubject === "FG") {
    ({ error: saveError } = await labSupabase.rpc(
      "fn_save_protocol_family_mapping",
      {
        p_subject_type: "FG",
        p_protocol_category_id: Number(protocolId),
        p_product_group_id: Number(familyId),
        p_inv_group_id: null,
        p_remarks: fmRemarks.value.trim() || null,
        p_is_active: fmIsActive.checked,
      },
    ));
  } else if (currentSubject === "RM") {
    ({ error: saveError } = await labSupabase.rpc(
      "fn_save_protocol_family_mapping",
      {
        p_subject_type: "RM",
        p_protocol_category_id: Number(protocolId),
        p_product_group_id: null,
        p_inv_group_id: Number(familyId),
        p_remarks: fmRemarks.value.trim() || null,
        p_is_active: fmIsActive.checked,
      },
    ));
  } else {
    // PM: uses dedicated subcategory mapping RPC
    ({ error: saveError } = await labSupabase.rpc(
      "fn_save_protocol_pm_subcategory_mapping",
      {
        p_protocol_category_id: Number(protocolId),
        p_subcategory_id: Number(familyId),
        p_remarks: fmRemarks.value.trim() || null,
        p_is_active: fmIsActive.checked,
      },
    ));
  }

  setBtnLoading(fmSaveBtn, false);

  if (saveError) {
    showBanner(fmFormBanner, "error", "Save failed: " + saveError.message);
    return;
  }

  toast("Mapping saved.", "success");
  hideBanner(fmFormBanner);
  await loadFmMappings();
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
}

function resetSelect(selectEl, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder ?? "-- Select --"}</option>`;
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
