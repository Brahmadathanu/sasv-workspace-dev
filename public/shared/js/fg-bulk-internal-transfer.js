import { supabase } from "./supabaseClient.js";
import { mountModuleHome, mountModuleIcon } from "./sasv-module-chrome.js";

// FG Bulk Internal Transfer - modal-driven ERP UX
// DB / RPC contract preserved exactly.

const state = {
  masters: { sections: [], subsections: [], areas: [] },
  selectedKey: null,
  selectedRow: null,
  // Server-side source-stock infinite scroll
  sourceRows: [],
  sourcePageSize: 50,
  sourceTotalRows: 0,
  sourceOffset: 0,
  sourceHasMore: true,
  sourceLoadError: false,
  sourceIsLoading: false,
  sourceQueryVersion: 0,
  selectedSourceIdentity: null,
  // Modal lifecycle (FG-BIT-UX-1): posting guard + focus return target
  isPosting: false,
  openerIdx: null,
  openerKey: null,
};

// Debounce handle for filter inputs
let sourceFilterTimer = null;
// IntersectionObserver for infinite scroll
let sourceObserver = null;

const els = {};

function cacheDom() {
  // Filters
  els.filterItem = document.getElementById("filterItem");
  els.filterBatch = document.getElementById("filterBatch");
  els.filterItemClear = document.getElementById("filterItemClear");
  els.filterBatchClear = document.getElementById("filterBatchClear");
  els.rowCount = document.getElementById("rowCount");
  // Collapsible guidance (narrow screens)
  els.guidance = document.getElementById("guidance");
  els.guidanceToggle = document.getElementById("guidanceToggle");
  // Source table
  els.sourceTbody = document.getElementById("sourceTbody");
  els.sourceTableWrap = document.querySelector(".source-table-wrap");
  // Infinite scroll footer + sentinel
  els.sourceSentinel = document.getElementById("sourceSentinel");
  els.sourceFooter = document.getElementById("sourceFooter");
  els.sourceFooterStatus = document.getElementById("sourceFooterStatus");
  els.sourceLoadMore = document.getElementById("sourceLoadMore");
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
  if (type === "error") span.setAttribute("role", "alert");
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
    window.location.href = window.location.protocol === "file:"
      ? "../../login.html"
      : "/utilities-hub/index.html";
    throw new Error("No session");
  }
  return session;
}

/* -- Data loads -------------------------------------------- */
// Server-side, RPC-backed infinite-scroll loader.
// Loads at most one page (p_limit = sourcePageSize) per call and appends to the
// rows already loaded. Never requests all rows at once.
async function loadSourceStock({ reset = false } = {}) {
  // Guard against overlapping requests (scroll + button + filter races).
  if (state.sourceIsLoading) return;
  if (!reset && !state.sourceHasMore) return;

  if (reset) {
    state.sourceRows = [];
    state.sourceOffset = 0;
    state.sourceHasMore = true;
    state.sourceLoadError = false;
  }

  state.sourceIsLoading = true;
  const myVersion = ++state.sourceQueryVersion;

  if (reset && !state.sourceRows.length) {
    showSourceLoading();
  }
  renderSourceFooter();

  const itemFilter = (els.filterItem.value || "").trim();
  const batchFilter = (els.filterBatch.value || "").trim();
  const offset = state.sourceOffset;

  let data = null;
  let error = null;
  try {
    const res = await supabase.rpc(
      "rpc_fg_bulk_internal_transfer_source_page",
      {
        p_item_filter: itemFilter || null,
        p_batch_filter: batchFilter || null,
        p_limit: state.sourcePageSize,
        p_offset: offset,
      },
    );
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }

  // Stale-response guard: a newer request has superseded this one.
  if (myVersion !== state.sourceQueryVersion) return;

  state.sourceIsLoading = false;

  if (error) {
    state.sourceLoadError = true;
    console.error("loadSourceStock:", error);
    // Preserve any rows already loaded; only show a hard error when empty.
    if (!state.sourceRows.length) {
      state.sourceTotalRows = 0;
      state.sourceHasMore = false;
      renderSourceError();
    }
    renderSourceFooter();
    return;
  }

  state.sourceLoadError = false;
  const rows = Array.isArray(data) ? data : [];

  if (reset) {
    state.sourceRows = rows;
    state.sourceTotalRows = rows.length ? Number(rows[0].total_count ?? 0) : 0;
  } else {
    state.sourceRows = state.sourceRows.concat(rows);
    if (rows.length) {
      state.sourceTotalRows = Number(rows[0].total_count ?? state.sourceTotalRows);
    }
  }

  state.sourceOffset = state.sourceRows.length;
  state.sourceHasMore = state.sourceRows.length < state.sourceTotalRows;

  renderSourceTable();
  renderSourceFooter();

  // If the loaded content is short enough that the sentinel is still visible,
  // proactively pull the next page so the list fills the viewport.
  maybeAutoLoadMore();
}

function showSourceLoading() {
  if (els.sourceTbody) {
    els.sourceTbody.innerHTML = `<tr class="empty-row"><td colspan="7">Loading source stock…</td></tr>`;
  }
  if (els.rowCount) els.rowCount.textContent = "Loading source stock…";
}

function renderSourceError() {
  if (els.sourceTbody) {
    els.sourceTbody.innerHTML = `<tr class="empty-row"><td colspan="7">Unable to load source stock. Please try again.</td></tr>`;
  }
  if (els.rowCount) els.rowCount.textContent = "";
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

/* -- Source identity & filters ----------------------------- */
// Structured identity for RPC lookups. Never parse source_key for business
// logic - plant_id can legitimately be null.
function buildSourceIdentity(row) {
  return {
    product_id: row.product_id ?? null,
    batch_number: row.batch_number ?? null,
    uom: row.uom ?? null,
    section_id: row.section_id ?? null,
    subsection_id: row.subsection_id ?? null,
    area_id: row.area_id ?? null,
    plant_id: row.plant_id ?? null,
  };
}

// Fetch a single current positive-balance source row by exact identity.
// Returns the row, or null when the source balance is exhausted.
async function fetchSourceByIdentity(identity) {
  if (!identity) return null;
  try {
    const { data, error } = await supabase.rpc(
      "rpc_fg_bulk_internal_transfer_source_by_identity",
      {
        p_product_id: identity.product_id,
        p_batch_number: identity.batch_number,
        p_uom: identity.uom,
        p_section_id: identity.section_id,
        p_subsection_id: identity.subsection_id,
        p_area_id: identity.area_id,
        p_plant_id: identity.plant_id ?? null,
      },
    );
    if (error) {
      console.error("fetchSourceByIdentity:", error);
      return null;
    }
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error("fetchSourceByIdentity unexpected:", err);
    return null;
  }
}

// Debounced, server-side filtering. Resets loaded source list on every change.
function onSourceFilterChanged() {
  if (sourceFilterTimer) clearTimeout(sourceFilterTimer);
  sourceFilterTimer = setTimeout(() => {
    loadSourceStock({ reset: true });
  }, 250);
}

/* -- Source footer / infinite scroll ----------------------- */
// The footer is intentionally quiet: the top-right #rowCount is the primary
// count display. The footer is only shown when loading more rows or when the
// Load more fallback is available. It stays hidden at rest and when the list
// is fully loaded ("End of list" text is not shown).
function renderSourceFooter() {
  const loaded = state.sourceRows.length;
  const loadingMore = state.sourceIsLoading && loaded > 0;
  const showLoadMore = state.sourceHasMore && !state.sourceIsLoading && loaded > 0 && (!sourceObserver || state.sourceLoadError);

  if (els.sourceFooterStatus) {
    els.sourceFooterStatus.textContent = loadingMore ? "Loading more…" : "";
  }

  if (els.sourceLoadMore) {
    els.sourceLoadMore.hidden = !showLoadMore;
    els.sourceLoadMore.disabled = state.sourceIsLoading;
  }

  if (els.sourceFooter) {
    const visible = loadingMore || showLoadMore;
    els.sourceFooter.hidden = !visible;
  }

  adjustSourceListHeight();
}

/* -- Search filter clear controls -------------------------- */
// Toggle each inline clear button based on whether its field has text.
function syncFilterClearButtons() {
  if (els.filterItemClear) {
    els.filterItemClear.hidden = !(els.filterItem.value || "").length;
  }
  if (els.filterBatchClear) {
    els.filterBatchClear.hidden = !(els.filterBatch.value || "").length;
  }
}

// Clear a single field, refocus it, update button visibility, and reload the
// source list from offset 0 through the existing server-side filter flow.
function clearFilterField(fieldEl) {
  if (!fieldEl) return;
  fieldEl.value = "";
  fieldEl.focus();
  syncFilterClearButtons();
  if (sourceFilterTimer) clearTimeout(sourceFilterTimer);
  loadSourceStock({ reset: true });
}

/* -- Dynamic list height ----------------------------------- */
// Height is now handled purely by the CSS flex chain (body 100vh → panel →
// card → source-table-wrap), so the list fills the remaining viewport height
// and scrolls internally with no leftover space under the card. This clears
// any stale inline max-height that an earlier version may have set so it can
// never fight the flex sizing.
function adjustSourceListHeight() {
  const wrap = els.sourceTableWrap;
  if (!wrap) return;
  if (wrap.style.maxHeight) wrap.style.maxHeight = "";
}

function maybeAutoLoadMore() {
  if (!els.sourceTableWrap || !els.sourceSentinel) return;
  if (state.sourceIsLoading || !state.sourceHasMore) return;

  const wrapRect = els.sourceTableWrap.getBoundingClientRect();
  const sentinelRect = els.sourceSentinel.getBoundingClientRect();

  // If sentinel is already visible at/above bottom edge, pull next page.
  if (sentinelRect.top <= wrapRect.bottom + 8) {
    loadSourceStock({ reset: false });
  }
}

function setupSourceInfiniteObserver() {
  if (!els.sourceSentinel || !els.sourceTableWrap || typeof IntersectionObserver === "undefined") {
    sourceObserver = null;
    renderSourceFooter(); // accessible fallback when auto-paging is unavailable
    return;
  }
  if (sourceObserver) sourceObserver.disconnect();

  sourceObserver = new IntersectionObserver(
    (entries) => {
      const first = entries && entries[0];
      if (!first || !first.isIntersecting) return;
      // After an auto-load error, pause observer retries until the user chooses recovery.
      if (state.sourceIsLoading || !state.sourceHasMore || state.sourceLoadError) return;
      loadSourceStock({ reset: false });
    },
    {
      root: els.sourceTableWrap,
      rootMargin: "0px 0px 120px 0px",
      threshold: 0,
    },
  );

  sourceObserver.observe(els.sourceSentinel);
  renderSourceFooter(); // hide manual fallback when automatic paging is working
}

// Combine section / sub-section / area into one readable Location label.
function formatLocationLabel(row) {
  const parts = [row.section_name, row.subsection_name, row.area_name].filter(
    (p) => p !== null && p !== undefined && String(p).trim() !== "",
  );
  return parts.length ? parts.join(" › ") : "—";
}

// Available quantity with UOM, e.g. "1,500 L".
function formatAvailable(row) {
  const qty = fmtQty(row.qty_base);
  const uom = row.uom ? escapeHtml(row.uom) : "";
  return uom ? `${qty} ${uom}` : qty;
}

function renderSourceTable() {
  const rows = state.sourceRows;
  if (!rows.length) {
    els.sourceTbody.innerHTML = `<tr class="empty-row"><td colspan="7">No source stock found. Try adjusting the filters.</td></tr>`;
    els.rowCount.textContent = "No source stock found";
    adjustSourceListHeight();
    return;
  }
  els.sourceTbody.innerHTML = rows
    .map((r, idx) => {
      const key = r.source_key ?? "";
      const sel =
        state.selectedKey && state.selectedKey === key ? " row-selected" : "";
      const item = escapeHtml(r.item);
      const batch = escapeHtml(r.batch_number);
      const section = escapeHtml(r.section_name || "—");
      const subsection = escapeHtml(r.subsection_name || "—");
      const area = escapeHtml(r.area_name || "—");
      const plant = r.plant_name ? escapeHtml(r.plant_name) : "—";
      const available = formatAvailable(r);
      // Secondary line for the <=520px card layout only.
      const mobileLine = `${escapeHtml(formatLocationLabel(r))} · ${plant}`;
      return `<tr data-idx="${idx}" class="${sel}" tabindex="0">
        <td class="col-item" title="${item}">${item}</td>
        <td class="col-batch" title="${batch}">${batch}</td>
        <td class="col-num">${available}</td>
        <td class="col-section" title="${section}">${section}</td>
        <td class="col-subsection" title="${subsection}">${subsection}</td>
        <td class="col-area" title="${area}">${area}</td>
        <td class="col-plant" title="${plant}">${plant}</td>
        <td class="src-mobile-line">${mobileLine}</td>
      </tr>`;
    })
    .join("");

  const total = state.sourceTotalRows || rows.length;
  const shown = rows.length;
  els.rowCount.textContent = `Showing ${shown} of ${total}`;
  adjustSourceListHeight();
}

function handleSourceRowClick(ev) {
  const tr = ev.target.closest("tr[data-idx]");
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  const row = state.sourceRows[idx];
  if (row) openTransferModal(row, idx);
}

// Keyboard activation for source rows (Enter / Space).
function handleSourceRowKeydown(ev) {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  const tr = ev.target.closest && ev.target.closest("tr[data-idx]");
  if (!tr || ev.target !== tr) return;
  ev.preventDefault();
  const idx = Number(tr.dataset.idx);
  const row = state.sourceRows[idx];
  if (row) openTransferModal(row, idx);
}

/* -- Selection & modal ------------------------------------- */
function selectSourceRow(row) {
  // source_key is used only for row highlight, never parsed for RPC args.
  state.selectedKey = row.source_key ?? null;
  state.selectedRow = { ...row };
  state.selectedSourceIdentity = buildSourceIdentity(row);
  renderSourceTable();
}

function clearSelectedSource() {
  state.selectedKey = null;
  state.selectedRow = null;
  state.selectedSourceIdentity = null;
  renderSourceTable();
}

function openTransferModal(row, idx = null) {
  state.openerIdx = Number.isInteger(idx) ? idx : null;
  state.openerKey = row.source_key ?? null;
  selectSourceRow(row);
  populateSelectedSourceCard(row);
  resetTransferForm();
  clearMessage();
  els.transferModal.removeAttribute("hidden");
  setBackgroundInert(true);
  // Initial focus: first field, applied synchronously once the dialog is shown.
  if (els.transferDate) els.transferDate.focus();
}

// Background (header + main) is inert while the modal is open so focus and
// pointer interaction cannot reach the page behind it.
function setBackgroundInert(on) {
  document.body.classList.toggle("fgbit-modal-open", on);
  document.querySelectorAll("body > header, body > main").forEach((el) => {
    if (on) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  });
}

// Return focus to the originating row; if the list was refreshed and the row
// is gone, fall back deterministically to the source list scroll region.
function restoreOpenerFocus() {
  const { openerIdx, openerKey } = state;
  state.openerIdx = null;
  state.openerKey = null;
  let target = null;
  if (openerKey !== null && els.sourceTbody) {
    const rows = els.sourceTbody.querySelectorAll("tr[data-idx]");
    for (const tr of rows) {
      const r = state.sourceRows[Number(tr.dataset.idx)];
      if (r && (r.source_key ?? null) === openerKey) {
        target = tr;
        break;
      }
    }
  }
  if (!target) target = els.sourceTableWrap || els.filterItem;
  if (target && target.focus) target.focus({ preventScroll: false });
  return openerIdx;
}

// User-initiated close (Esc / backdrop / X / Cancel). Ignored while posting so
// an in-flight transfer cannot be orphaned or double-submitted.
function requestCloseTransferModal() {
  if (state.isPosting) return;
  closeTransferModal();
}

function closeTransferModal() {
  els.transferModal.setAttribute("hidden", "");
  setBackgroundInert(false);
  clearMessage();
  clearSelectedSource(); // closing clears selection highlight per requirement
  restoreOpenerFocus();
}

// Keep Tab / Shift+Tab inside the dialog.
function trapModalTab(e) {
  if (e.key !== "Tab" || els.transferModal.hasAttribute("hidden")) return;
  const focusables = Array.from(
    els.transferModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.disabled && !el.hidden && el.getClientRects().length);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (!els.transferModal.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
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
  sel.innerHTML = '<option value="">- Select Sub-section -</option>';
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
  syncSubmitReadiness();
}

function populateDestinationAreas(sectionId, subsectionId) {
  const sel = els.dstArea;
  sel.innerHTML = '<option value="">- Select Area -</option>';
  sel.disabled = true;
  if (!sectionId) return;

  // Governed master hierarchy: every area belongs to a subsection.
  // No cross-subsection area selection is permitted.
  if (!subsectionId) return;
  const areas = state.masters.areas.filter(
    (a) => String(a.section_id) === String(sectionId) &&
      String(a.subsection_id) === String(subsectionId),
  );
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
  sel.innerHTML = '<option value="">- No plant / area-level -</option>';
  sel.disabled = true;
  if (!sectionId || !areaId) { syncSubmitReadiness(); return; }

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
    syncSubmitReadiness();
    return;
  }
  if (!data || !data.length) {
    syncSubmitReadiness();
    return;
  }

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
      '<option value="">- Select Sub-section -</option>';
    els.dstSubsection.disabled = true;
  }
  if (level === "section" || level === "subsection") {
    els.dstArea.innerHTML = '<option value="">- Select Area -</option>';
    els.dstArea.disabled = true;
  }
  if (level === "section" || level === "subsection" || level === "area") {
    els.dstPlant.innerHTML = '<option value="">- No plant / area-level -</option>';
    els.dstPlant.disabled = true;
  }
}

/* -- Posting summary --------------------------------------- */
function getSelectText(sel) {
  const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
  return opt && opt.value ? opt.text : "";
}

function syncPostingSummary() {
  syncSubmitReadiness();
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
      <span class="sum-val sum-val-sub">${escapeHtml(s.batch_number)}</span>
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
      <span class="sum-val">${escapeHtml(remarks)}</span>
    </div>`
        : ""
    }`;
}

/* UI-only readiness: preserve the authoritative submit-time validation and RPC. */
function isTransferReady() {
  const source = state.selectedRow;
  if (!source || !els.transferDate.value || !els.dstSection.value ||
      !els.dstSubsection.value || !els.dstArea.value) return false;
  const area = state.masters.areas.find(a => String(a.id) === String(els.dstArea.value));
  if (!area || String(area.section_id) !== String(els.dstSection.value) ||
      String(area.subsection_id) !== String(els.dstSubsection.value)) return false;
  const qty = Number(els.transferQty.value);
  const available = Number(source.qty_base ?? source.qty ?? 0);
  if (!els.transferQty.value || !Number.isFinite(qty) || qty <= 0 || qty > available) return false;
  const sameLocation =
    String(source.section_id ?? "") === String(els.dstSection.value ?? "") &&
    String(source.subsection_id ?? "") === String(els.dstSubsection.value ?? "") &&
    String(source.area_id ?? "") === String(els.dstArea.value ?? "") &&
    String(source.plant_id ?? "") === String(els.dstPlant.value ?? "");
  return !sameLocation;
}
function syncSubmitReadiness() {
  if (els.submitBtn) els.submitBtn.disabled = state.isPosting || !isTransferReady();
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
  if (!els.dstSubsection.value) {
    showMessage("error", "Destination sub-section is required.");
    els.dstSubsection.focus();
    return false;
  }
  if (!els.dstArea.value) {
    showMessage("error", "Destination area is required.");
    els.dstArea.focus();
    return false;
  }
  // Plant / Machinery is an optional, more granular location inside an area.
  // The governed area-subsection relationship is mandatory.
  const area = state.masters.areas.find(a => String(a.id) === String(els.dstArea.value));
  if (!area || String(area.section_id) !== String(els.dstSection.value) ||
      String(area.subsection_id) !== String(els.dstSubsection.value)) {
    showMessage("error", "Destination area must belong to the selected sub-section.");
    els.dstArea.focus();
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
  state.isPosting = isBusy;
  els.transferModal.setAttribute("aria-busy", isBusy ? "true" : "false");
  els.submitBtn.disabled = isBusy || !isTransferReady();
  els.resetBtn.disabled = isBusy;
  els.cancelBtn.disabled = isBusy;
  els.submitBtn.textContent = isBusy ? "Posting..." : "Submit Transfer";
  // A disabled control drops focus; keep it inside the dialog once re-enabled.
  if (
    !isBusy &&
    !els.transferModal.hasAttribute("hidden") &&
    !els.transferModal.contains(document.activeElement)
  ) {
    els.submitBtn.focus();
  }
}

async function submitTransfer(ev) {
  ev.preventDefault();
  if (state.isPosting) return; // non-reentrant while a post is in flight
  clearMessage();
  if (!validateTransferForm()) return;

  const payload = buildRpcPayload();
  const priorIdentity = state.selectedSourceIdentity;
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

    // Refresh source list from offset 0 so stock balances are up to date.
    await loadSourceStock({ reset: true });

    // Ask the server whether this exact source location still has balance.
    const stillExists = await fetchSourceByIdentity(priorIdentity);

    if (stillExists && Number(stillExists.qty_base) > 0) {
      // Source location still has stock - refresh card and keep modal open
      state.selectedRow = { ...stillExists };
      state.selectedSourceIdentity = buildSourceIdentity(stillExists);
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
      state.selectedRow = null;
      state.selectedSourceIdentity = null;
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

  await Promise.all([loadSourceStock({ reset: true }), loadMasterData()]);

  // Canonical chrome: HOME icon + label and Close icon (idempotent re-mount;
  // the page also ships equivalent static markup).
  mountModuleHome(els.homeBtn);
  mountModuleIcon(els.modalCloseBtn, "close");
  els.modalCloseBtn.setAttribute("aria-label", "Close");

  // Home button navigation (if present)
  if (els.homeBtn)
    els.homeBtn.addEventListener(
      "click",
      () => {
        // Both clients render the same shared HTML; navigation depends on runtime.
        window.location.href = window.location.protocol === "file:"
          ? "../../index.html"
          : "/utilities-hub/index.html";
      },
    );

  // Collapsible guidance toggle (only visible on narrow screens via CSS)
  if (els.guidanceToggle && els.guidance) {
    els.guidanceToggle.addEventListener("click", () => {
      const open = els.guidance.classList.toggle("is-open");
      els.guidanceToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Filters (debounced, server-side). Typing also toggles the inline × button.
  const onFilterInput = () => {
    syncFilterClearButtons();
    onSourceFilterChanged();
  };
  els.filterItem.addEventListener("input", onFilterInput);
  els.filterBatch.addEventListener("input", onFilterInput);

  // Inline clear buttons: clear only their own field.
  if (els.filterItemClear) {
    els.filterItemClear.addEventListener("click", () =>
      clearFilterField(els.filterItem),
    );
  }
  if (els.filterBatchClear) {
    els.filterBatchClear.addEventListener("click", () =>
      clearFilterField(els.filterBatch),
    );
  }

  // Initial clear-button state + list height, and keep height in sync on resize
  syncFilterClearButtons();
  adjustSourceListHeight();
  window.addEventListener("resize", adjustSourceListHeight);

  // Infinite-scroll fallback button
  if (els.sourceLoadMore) {
    els.sourceLoadMore.addEventListener("click", () => {
      if (state.sourceIsLoading || !state.sourceHasMore) return;
      loadSourceStock({ reset: false });
    });
  }

  // Infinite-scroll observer
  setupSourceInfiniteObserver();

  // Source table row click
  els.sourceTbody.addEventListener("click", handleSourceRowClick);
  els.sourceTbody.addEventListener("keydown", handleSourceRowKeydown);

  // Destination dropdown cascade
  els.dstSection.addEventListener("change", (e) => {
    const sec = e.target.value;
    resetDestinationControls("section");
    if (!sec) {
      syncPostingSummary();
      return;
    }
    populateDestinationSubsections(sec);
    // Area options follow a selected governed subsection.
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
  els.cancelBtn.addEventListener("click", requestCloseTransferModal);
  els.modalCloseBtn.addEventListener("click", requestCloseTransferModal);

  // Escape handling (capture phase so it fires before native input handling,
  // e.g. the date field, and does not depend on event bubbling).
  // Modal close takes priority; filter Escape-clear only when modal is closed.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Tab") {
        trapModalTab(e);
        return;
      }
      if (e.key !== "Escape") return;
      if (!els.transferModal.hasAttribute("hidden")) {
        e.preventDefault();
        e.stopPropagation();
        requestCloseTransferModal();
        return;
      }
      const active = document.activeElement;
      if (
        (active === els.filterItem || active === els.filterBatch) &&
        active.value
      ) {
        clearFilterField(active);
      }
    },
    true,
  );

  // Backdrop click - click directly on overlay (not modal-box) closes it
  els.transferModal.addEventListener("click", (e) => {
    if (e.target === els.transferModal) requestCloseTransferModal();
  });
}

window.addEventListener("DOMContentLoaded", initPage);
