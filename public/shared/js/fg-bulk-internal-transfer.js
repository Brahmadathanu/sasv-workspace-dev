import { supabase } from "./supabaseClient.js";

// FG Bulk Internal Transfer - modal-driven ERP UX
// DB / RPC contract preserved exactly.

const state = {
  sourceRows: [],
  filteredRows: [],
  masters: { sections: [], subsections: [], areas: [] },
  selectedKey: null,
  selectedRow: null,
};

const els = {};

function cacheDom() {
  // Filters
  els.filterItem = document.getElementById("filterItem");
  els.filterBatch = document.getElementById("filterBatch");
  els.clearFilters = document.getElementById("clearFilters");
  els.rowCount = document.getElementById("rowCount");
  // Source table
  els.sourceTbody = document.getElementById("sourceTbody");
  // Modal
  els.transferModal = document.getElementById("transferModal");
  els.modalCloseBtn = document.getElementById("modalCloseBtn");
  els.cancelBtn = document.getElementById("cancelBtn");
  els.modalSubtitle = document.getElementById("modalSubtitle");
  // Modal cards
  els.selectedSourceBody = document.getElementById("selectedSourceBody");
  els.postingSummaryBody = document.getElementById("postingSummaryBody");
  // Form
  els.transferForm = document.getElementById("transferForm");
  els.transferDate = document.getElementById("transferDate");
  els.transferQty = document.getElementById("transferQty");
  els.remarks = document.getElementById("remarks");
  // Destination dropdowns
  els.dstSection = document.getElementById("dstSection");
  els.dstSubsection = document.getElementById("dstSubsection");
  els.dstArea = document.getElementById("dstArea");
  els.dstPlant = document.getElementById("dstPlant");
  // Actions
  els.submitBtn = document.getElementById("submitBtn");
  els.resetBtn = document.getElementById("resetBtn");
  els.modalMsgArea = document.getElementById("modalMsgArea");
  // Home button (optional)
  els.homeBtn = document.getElementById("homeBtn");
}

/* -- Message system ---------------------------------------- */
function clearMessage() {
  if (els.modalMsgArea) els.modalMsgArea.innerHTML = "";
}

function showMessage(type, text) {
  if (!els.modalMsgArea) return;
  clearMessage();
  const span = document.createElement("span");
  span.className =
    type === "success"
      ? "msg-success"
      : type === "error"
        ? "msg-error"
        : "msg-info";
  span.textContent = text;
  els.modalMsgArea.appendChild(span);
}

/* -- Utilities --------------------------------------------- */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtQty(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return isNaN(n)
    ? ""
    : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/* -- Session guard ----------------------------------------- */
async function requireSession() {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    throw new Error("No session");
  }
  return session;
}

/* -- Data loads -------------------------------------------- */
async function loadSourceStock() {
  const res = await supabase
    .from("v_fg_bulk_batch_balance_by_location")
    .select(
      "product_id,item,batch_number,uom,section_id,section_name," +
        "subsection_id,subsection_name,area_id,area_name,plant_id,plant_name,qty,qty_base",
    )
    .gt("qty_base", 0)
    .order("item", { ascending: true });

  if (res.error) {
    console.error("loadSourceStock:", res.error);
    state.sourceRows = [];
  } else {
    state.sourceRows = res.data || [];
  }
  applySourceFilters();
}

async function loadMasterData() {
  const [secRes, subRes, areaRes] = await Promise.all([
    supabase.from("sections").select("id,section_name").order("section_name"),
    supabase
      .from("subsections")
      .select("id,subsection_name,section_id")
      .order("subsection_name"),
    supabase
      .from("areas")
      .select("id,area_name,section_id,subsection_id")
      .order("area_name"),
  ]);

  if (secRes.error || subRes.error || areaRes.error) {
    console.error(
      "loadMasterData:",
      secRes.error || subRes.error || areaRes.error,
    );
    return;
  }
  state.masters.sections = secRes.data || [];
  state.masters.subsections = subRes.data || [];
  state.masters.areas = areaRes.data || [];
  populateDestinationSections();
}

/* -- Source table ------------------------------------------ */
function makeSourceKey(row) {
  return [
    row.product_id ?? "",
    String(row.batch_number ?? ""),
    row.section_id ?? "",
    row.subsection_id ?? "",
    row.area_id ?? "",
    row.plant_id ?? "",
  ].join("|");
}

function applySourceFilters() {
  const it = (els.filterItem.value || "").trim().toLowerCase();
  const bt = (els.filterBatch.value || "").trim().toLowerCase();
  state.filteredRows = state.sourceRows.filter((r) => {
    if (!r.qty_base || Number(r.qty_base) <= 0) return false;
    if (it && !(r.item || "").toLowerCase().includes(it)) return false;
    if (bt && !(r.batch_number || "").toLowerCase().includes(bt)) return false;
    return true;
  });
  renderSourceTable();
}

function renderSourceTable() {
  const rows = state.filteredRows;
  if (!rows.length) {
    els.sourceTbody.innerHTML = `<tr class="empty-row"><td colspan="8">No matching stock found. Try adjusting the filters.</td></tr>`;
    els.rowCount.textContent = "";
    return;
  }
  els.sourceTbody.innerHTML = rows
    .map((r, idx) => {
      const key = makeSourceKey(r);
      const sel = state.selectedKey === key ? " row-selected" : "";
      const sub = r.subsection_name ? escapeHtml(r.subsection_name) : "-";
      return `<tr data-idx="${idx}" class="${sel}">
        <td>${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.batch_number)}</td>
        <td>${escapeHtml(r.uom)}</td>
        <td class="col-num">${fmtQty(r.qty_base)}</td>
        <td>${escapeHtml(r.section_name || "")}</td>
        <td>${sub}</td>
        <td>${escapeHtml(r.area_name || "")}</td>
        <td>${escapeHtml(r.plant_name || "")}</td>
      </tr>`;
    })
    .join("");

  els.rowCount.textContent = `${rows.length} row${rows.length !== 1 ? "s" : ""} shown`;
}

function handleSourceRowClick(ev) {
  const tr = ev.target.closest("tr[data-idx]");
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  const row = state.filteredRows[idx];
  if (row) openTransferModal(row);
}

/* -- Selection & modal ------------------------------------- */
function selectSourceRow(row) {
  state.selectedKey = makeSourceKey(row);
  state.selectedRow = { ...row };
  renderSourceTable();
}

function clearSelectedSource() {
  state.selectedKey = null;
  state.selectedRow = null;
  renderSourceTable();
}

function openTransferModal(row) {
  selectSourceRow(row);
  populateSelectedSourceCard(row);
  resetTransferForm();
  clearMessage();
  els.transferModal.removeAttribute("hidden");
  // Defer focus so the modal is visible first
  setTimeout(() => els.transferDate && els.transferDate.focus(), 60);
}

function closeTransferModal() {
  els.transferModal.setAttribute("hidden", "");
  clearMessage();
  clearSelectedSource(); // closing clears selection highlight per requirement
}

function populateSelectedSourceCard(row) {
  const s = row || state.selectedRow;
  if (!s) {
    els.selectedSourceBody.innerHTML =
      '<span class="muted-text">No source selected.</span>';
    return;
  }
  els.selectedSourceBody.innerHTML = `
    <div class="src-field">
      <span class="src-lbl">Item</span>
      <span class="src-val prominent">${escapeHtml(s.item)}</span>
    </div>
    <div class="src-field">
      <span class="src-lbl">Batch</span>
      <span class="src-val">${escapeHtml(s.batch_number)}</span>
    </div>
    <div class="src-field">
      <span class="src-lbl">UOM</span>
      <span class="src-val">${escapeHtml(s.uom)}</span>
    </div>
    <div class="src-field">
      <span class="src-lbl">Available Qty</span>
      <span class="src-val available">${fmtQty(s.qty_base)}</span>
    </div>
    <hr class="src-divider" />
    <div class="src-field">
      <span class="src-lbl">Section</span>
      <span class="src-val">${escapeHtml(s.section_name || "-")}</span>
    </div>
    <div class="src-field">
      <span class="src-lbl">Sub-section</span>
      <span class="src-val">${escapeHtml(s.subsection_name || "-")}</span>
    </div>
    <div class="src-field">
      <span class="src-lbl">Area</span>
      <span class="src-val">${escapeHtml(s.area_name || "-")}</span>
    </div>
    <div class="src-field">
      <span class="src-lbl">Plant</span>
      <span class="src-val">${escapeHtml(s.plant_name || "-")}</span>
    </div>`;
}

/* -- Destination dropdowns --------------------------------- */
function populateDestinationSections() {
  const sel = els.dstSection;
  sel.innerHTML = '<option value="">- Select Section -</option>';
  state.masters.sections.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.section_name;
    sel.appendChild(o);
  });
  resetDestinationControls("section");
}

function populateDestinationSubsections(sectionId) {
  const sel = els.dstSubsection;
  sel.innerHTML = '<option value="">- None / Not applicable -</option>';
  const subs = state.masters.subsections.filter(
    (s) => String(s.section_id) === String(sectionId),
  );
  if (!subs.length) {
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  subs.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.subsection_name;
    sel.appendChild(o);
  });
}

function populateDestinationAreas(sectionId, subsectionId) {
  const sel = els.dstArea;
  sel.innerHTML = '<option value="">- Select Area -</option>';
  sel.disabled = true;
  if (!sectionId) return;

  // When a subsection is selected, narrow to matching areas.
  // When no subsection is selected, show all areas for the section to avoid
  // incorrectly hiding areas that are valid without a subsection context.
  let areas = state.masters.areas.filter(
    (a) => String(a.section_id) === String(sectionId),
  );
  if (subsectionId) {
    areas = areas.filter(
      (a) => String(a.subsection_id) === String(subsectionId),
    );
  }
  if (!areas.length) return;

  sel.disabled = false;
  areas.forEach((a) => {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = a.area_name;
    sel.appendChild(o);
  });
}

async function populateDestinationPlants(sectionId, subsectionId, areaId) {
  const sel = els.dstPlant;
  sel.innerHTML = '<option value="">- Select Plant -</option>';
  sel.disabled = true;
  if (!sectionId || !areaId) return;

  let q = supabase
    .from("plant_machinery")
    .select("id,plant_name")
    .eq("section_id", sectionId)
    .eq("area_id", areaId);

  // Filter by subsection only when one is actually selected.
  // Do not restrict to subsection_id IS NULL when none is selected -
  // that would incorrectly hide plants not assigned to any subsection.
  if (subsectionId) {
    q = q.eq("subsection_id", subsectionId);
  }

  const { data, error } = await q.order("plant_name");
  if (error) {
    console.error("populateDestinationPlants:", error);
    return;
  }
  if (!data || !data.length) return;

  sel.disabled = false;
  data.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.plant_name;
    sel.appendChild(o);
  });
}

function resetDestinationControls(level) {
  if (level === "section") {
    els.dstSubsection.innerHTML =
      '<option value="">- None / Not applicable -</option>';
    els.dstSubsection.disabled = true;
  }
  if (level === "section" || level === "subsection") {
    els.dstArea.innerHTML = '<option value="">- Select Area -</option>';
    els.dstArea.disabled = true;
  }
  if (level === "section" || level === "subsection" || level === "area") {
    els.dstPlant.innerHTML = '<option value="">- Select Plant -</option>';
    els.dstPlant.disabled = true;
  }
}

/* -- Posting summary --------------------------------------- */
function getSelectText(sel) {
  const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
  return opt && opt.value ? opt.text : "";
}

function syncPostingSummary() {
  const s = state.selectedRow;
  if (!s) {
    els.postingSummaryBody.innerHTML =
      '<span class="muted-text">Fill in transfer details to preview.</span>';
    return;
  }

  const fromParts = [
    s.section_name,
    s.subsection_name,
    s.area_name,
    s.plant_name,
  ].filter(Boolean);

  const toParts = [
    getSelectText(els.dstSection),
    getSelectText(els.dstSubsection),
    getSelectText(els.dstArea),
    getSelectText(els.dstPlant),
  ].filter(Boolean);

  const qty = els.transferQty.value;
  const date = els.transferDate.value;
  const remarks = els.remarks.value.trim();

  els.postingSummaryBody.innerHTML = `
    <div class="sum-item">
      <span class="sum-lbl">Item / Batch</span>
      <span class="sum-val accent">${escapeHtml(s.item)}</span>
      <span class="sum-val" style="font-size:0.78rem;color:#6b7280">${escapeHtml(s.batch_number)}</span>
    </div>
    <hr class="sum-divider" />
    <div class="sum-item">
      <span class="sum-lbl">Transfer Date</span>
      <span class="sum-val">${escapeHtml(date) || "-"}</span>
    </div>
    <div class="sum-item">
      <span class="sum-lbl">Quantity</span>
      <span class="sum-val qty">${escapeHtml(qty) || "-"} ${escapeHtml(s.uom)}</span>
    </div>
    <hr class="sum-divider" />
    <div class="sum-item">
      <span class="sum-lbl">From</span>
      <span class="sum-val">${fromParts.map(escapeHtml).join(" > ") || "-"}</span>
    </div>
    <div class="sum-item">
      <span class="sum-lbl">To</span>
      <span class="sum-val">${toParts.map(escapeHtml).join(" > ") || "-"}</span>
    </div>
    ${
      remarks
        ? `<hr class="sum-divider" />
    <div class="sum-item">
      <span class="sum-lbl">Remarks</span>
      <span class="sum-val" style="font-size:0.82rem">${escapeHtml(remarks)}</span>
    </div>`
        : ""
    }`;
}

/* -- Validation -------------------------------------------- */
function validateTransferForm() {
  if (!state.selectedRow) {
    showMessage("error", "No source row selected.");
    return false;
  }
  if (!els.transferDate.value) {
    showMessage("error", "Transfer date is required.");
    els.transferDate.focus();
    return false;
  }
  const qty = parseFloat(els.transferQty.value);
  if (!els.transferQty.value || isNaN(qty) || qty <= 0) {
    showMessage("error", "Transfer quantity must be greater than zero.");
    els.transferQty.focus();
    return false;
  }
  const avail = Number(
    state.selectedRow.qty_base ?? state.selectedRow.qty ?? 0,
  );
  if (qty > avail) {
    showMessage(
      "error",
      "Transfer quantity cannot exceed the available balance.",
    );
    els.transferQty.focus();
    return false;
  }
  if (!els.dstSection.value) {
    showMessage("error", "Destination section is required.");
    els.dstSection.focus();
    return false;
  }
  if (!els.dstArea.value) {
    showMessage("error", "Destination area is required.");
    els.dstArea.focus();
    return false;
  }
  if (!els.dstPlant.value) {
    showMessage("error", "Destination plant is required.");
    els.dstPlant.focus();
    return false;
  }

  // Identical location check - compare all six identity components
  const s = state.selectedRow;
  if (
    String(s.section_id ?? "") === String(els.dstSection.value ?? "") &&
    String(s.subsection_id ?? "") === String(els.dstSubsection.value ?? "") &&
    String(s.area_id ?? "") === String(els.dstArea.value ?? "") &&
    String(s.plant_id ?? "") === String(els.dstPlant.value ?? "")
  ) {
    showMessage(
      "error",
      "Destination location must differ from the source location.",
    );
    return false;
  }
  return true;
}

/* -- RPC payload ------------------------------------------- */
function buildRpcPayload() {
  const s = state.selectedRow;
  return {
    p_transfer_date: els.transferDate.value,
    p_product_id: s.product_id,
    p_item: s.item,
    p_batch_number: s.batch_number,
    p_qty: parseFloat(els.transferQty.value),
    p_uom: s.uom,
    p_from_section_id: s.section_id ?? null,
    p_from_subsection_id: s.subsection_id ?? null,
    p_from_area_id: s.area_id ?? null,
    p_from_plant_id: s.plant_id ?? null,
    p_to_section_id: els.dstSection.value ? Number(els.dstSection.value) : null,
    p_to_subsection_id: els.dstSubsection.value
      ? Number(els.dstSubsection.value)
      : null,
    p_to_area_id: els.dstArea.value ? Number(els.dstArea.value) : null,
    p_to_plant_id: els.dstPlant.value ? Number(els.dstPlant.value) : null,
    p_remarks: (els.remarks.value || "").trim() || null,
    p_source_work_log_id: null,
  };
}

/* -- Submit ------------------------------------------------ */
function setBusyState(isBusy) {
  els.submitBtn.disabled = isBusy;
  els.resetBtn.disabled = isBusy;
  els.cancelBtn.disabled = isBusy;
  els.submitBtn.textContent = isBusy ? "Posting..." : "Submit Transfer";
}

async function submitTransfer(ev) {
  ev.preventDefault();
  clearMessage();
  if (!validateTransferForm()) return;

  const payload = buildRpcPayload();
  const priorKey = state.selectedKey;
  setBusyState(true);

  try {
    const { error } = await supabase.rpc(
      "rpc_create_fg_bulk_internal_transfer",
      payload,
    );

    if (error) {
      console.error("rpc error:", error);
      showMessage(
        "error",
        error.message ||
          "Unable to post transfer. Please review and try again.",
      );
      return;
    }

    // Reload table data
    await loadSourceStock();

    // Check whether the source location still has a positive balance
    const stillExists = state.sourceRows.find(
      (r) => makeSourceKey(r) === priorKey && Number(r.qty_base) > 0,
    );

    if (stillExists) {
      // Source location still has stock - refresh card and keep modal open
      selectSourceRow(stillExists);
      populateSelectedSourceCard(stillExists);
      els.transferQty.value = "";
      els.remarks.value = "";
      els.dstSection.value = "";
      resetDestinationControls("section");
      syncPostingSummary();
      showMessage(
        "success",
        "Transfer posted successfully. Source balance updated.",
      );
    } else {
      // Source is now exhausted - close modal cleanly
      closeTransferModal();
    }
  } catch (err) {
    console.error("submitTransfer unexpected:", err);
    showMessage("error", "Unexpected error. Please try again.");
  } finally {
    setBusyState(false);
  }
}

/* -- Reset form -------------------------------------------- */
function resetTransferForm() {
  els.transferDate.value = new Date().toISOString().slice(0, 10);
  els.transferQty.value = "";
  els.remarks.value = "";
  els.dstSection.value = "";
  resetDestinationControls("section");
  clearMessage();
  syncPostingSummary();
}

/* -- Event wiring ------------------------------------------ */
async function initPage() {
  cacheDom();
  try {
    await requireSession();
  } catch {
    return;
  }

  await Promise.all([loadSourceStock(), loadMasterData()]);

  // Home button navigation (if present)
  if (els.homeBtn)
    els.homeBtn.addEventListener(
      "click",
      () => (window.location.href = "index.html"),
    );

  // Filters
  els.filterItem.addEventListener("input", applySourceFilters);
  els.filterBatch.addEventListener("input", applySourceFilters);
  els.clearFilters.addEventListener("click", () => {
    els.filterItem.value = "";
    els.filterBatch.value = "";
    applySourceFilters();
  });

  // Source table row click
  els.sourceTbody.addEventListener("click", handleSourceRowClick);

  // Destination dropdown cascade
  els.dstSection.addEventListener("change", (e) => {
    const sec = e.target.value;
    resetDestinationControls("section");
    if (!sec) {
      syncPostingSummary();
      return;
    }
    populateDestinationSubsections(sec);
    populateDestinationAreas(sec, "");
    syncPostingSummary();
  });

  els.dstSubsection.addEventListener("change", (e) => {
    const sec = els.dstSection.value;
    const sub = e.target.value;
    resetDestinationControls("subsection");
    if (!sec) {
      syncPostingSummary();
      return;
    }
    populateDestinationAreas(sec, sub);
    syncPostingSummary();
  });

  els.dstArea.addEventListener("change", async (e) => {
    const sec = els.dstSection.value;
    const sub = els.dstSubsection.value;
    const area = e.target.value;
    resetDestinationControls("area");
    if (!area) {
      syncPostingSummary();
      return;
    }
    await populateDestinationPlants(sec, sub, area);
    syncPostingSummary();
  });

  els.dstPlant.addEventListener("change", syncPostingSummary);
  els.transferDate.addEventListener("change", syncPostingSummary);
  els.transferQty.addEventListener("input", syncPostingSummary);
  els.remarks.addEventListener("input", syncPostingSummary);

  // Form submit (triggered by submitBtn via form= association)
  els.transferForm.addEventListener("submit", submitTransfer);

  // Reset - re-apply current source to card, clear transfer inputs
  els.resetBtn.addEventListener("click", () => {
    resetTransferForm();
    if (state.selectedRow) populateSelectedSourceCard(state.selectedRow);
  });

  // Cancel / close modal
  els.cancelBtn.addEventListener("click", closeTransferModal);
  els.modalCloseBtn.addEventListener("click", closeTransferModal);

  // Escape key closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.transferModal.hasAttribute("hidden")) {
      closeTransferModal();
    }
  });

  // Backdrop click - click directly on overlay (not modal-box) closes it
  els.transferModal.addEventListener("click", (e) => {
    if (e.target === els.transferModal) closeTransferModal();
  });
}

window.addEventListener("DOMContentLoaded", initPage);
