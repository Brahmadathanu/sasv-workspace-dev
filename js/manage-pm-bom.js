/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

// Elements
const el = (id) => document.getElementById(id);
const tplPicker = el("tplPicker");
// Tabs and Mapping elements
const tabBtnTemplates = el("tabBtnTemplates");
const tabBtnMapping = el("tabBtnMapping");
const tabBtnOverrides = el("tabBtnOverrides");
const tabBtnPreview = el("tabBtnPreview");
const tabPanelTemplates = el("tabTemplates");
const tabPanelMapping = el("tabMapping");
const tabPanelOverrides = el("tabOverrides");
const tabPanelPreview = el("tabPreview");
// mapping top-card elements removed: mapSkuPicker, mapTplPicker, mapSetBtn, mapClearBtn
const mapRefreshBtn = el("mapRefreshBtn");
const mapNewBtn = el("mapNewBtn");
const mapNewModal = el("mapNewModal");
const mapNewCloseBtn = el("mapNewCloseBtn");
const mapNewCancelBtn = el("mapNewCancelBtn");
const mapNewCreateBtn = el("mapNewCreateBtn");
const mapNewSkuPicker = el("mapNewSkuPicker");
const mapNewTplPicker = el("mapNewTplPicker");
// legacy top-card picker (may be absent) — keep a safe ref to avoid eslint no-undef
const mapTplPicker = el("mapTplPicker");
const mapMappedBody = el("mapMappedBody");
const mapSaveBtn = el("mapSaveBtn");
const mapCancelBtn = el("mapCancelBtn");
// Mapping UI state
const mapViewBtn = el("mapViewBtn");
const mapEditBtn = el("mapEditBtn");
const mapPanel = document.getElementById("mapPanel");
let MAP_EDIT_MODE = false;
let MAP_ROWS = [];
let MAP_SEARCH_TERM = "";
// MAP_EDITING_ROW removed — per-row editing now uses per-row handlers
let MAP_TPL_OPTIONS_HTML = "";
const tplCode = el("tplCode");
const refQty = el("refQty");
const refUom = el("refUom");
const lossPct = el("lossPct");
const linesBody = el("linesBody");
const selectionPills = el("selectionPills");
const renumberBtn = el("renumberBtn");
const saveBtn = el("saveBtn");
const newTplBtn = el("newTplBtn");
const editTplBtn = el("editTplBtn");
// New Template modal elements
const newTplModal = el("newTplModal");
const ntCloseBtn = el("ntCloseBtn");
const ntCancelBtn = el("ntCancelBtn");
const ntCreateBtn = el("ntCreateBtn");
const ntCodeInput = el("ntCode");
const ntRefQtyInput = el("ntRefQty");
const ntRefUomSel = el("ntRefUom");
const ntLossPctInput = el("ntLossPct");
// Edit Template modal elements
const editTplModal = el("editTplModal");
const etCloseBtn = el("etCloseBtn");
const etCancelBtn = el("etCancelBtn");
const etApplyBtn = el("etApplyBtn");
const etRefQtyInput = el("etRefQty");
const etRefUomSel = el("etRefUom");
const etLossPctInput = el("etLossPct");
const toastContainer = el("statusToastContainer");
const homeBtn = el("homeBtn");
const qaChip = el("qaChip");
const qaPopover = el("qaPopover");
// Export UI
const exportBtn = el("exportBtn");
const exportMenu = el("exportMenu");
const exportCsvBtn = el("exportCsv");
const exportPdfBtn = el("exportPdf");
const exportHtmlBtn = el("exportHtml");
// Rebuild tab elements (cloned from plm-rebuild-dashboard)
const rebuildTabBtn = el("tabBtnRebuild");
const tabPanelRebuild = el("tabRebuild");
const rebuildTplPicker = el("rebuildTplPicker");
const rebuildTplBtn = el("rebuildTplBtn");
const dryRunBtn = el("dryRunBtn");
const rebuildAllBtn = el("rebuildAllBtn");
const rebuildResultBody = el("rebuildResultBody");
const rebuildMenuBtn = el("rebuildMenuBtn");
const rebuildMenu = el("rebuildMenu");
// Mapping kebab (responsive fallback)
const mapKebabBtn = el("mapKebabBtn");
const mapKebabMenu = el("mapKebabMenu");
const mapKebabViewBtn = el("mapKebabViewBtn");
const mapKebabEditBtn = el("mapKebabEditBtn");
// Mapping search input (added below View/Edit toggle)
const mapSearchInput = el("mapSearchInput");
// Reload
const reloadBtn = el("reloadBtn");
// Lines view/edit and help
const linesViewBtn = el("linesViewBtn");
const linesEditBtn = el("linesEditBtn");
const kbHelpBtn = el("kbHelpBtn");
const kbHelpPopover = el("kbHelpPopover");
// Insert rows popover elements
const insertPopover = el("insertPopover");
const insCountInput = el("insCountInput");
const insCancelBtn = el("insCancelBtn");
const insOkBtn = el("insOkBtn");
const insModeLabel = el("insModeLabel");
// (RM-BOM parity) Using native selects for item choice; combobox popover not used.
// Delete Template menu and modal elements
const deleteTplBtn = el("deleteTplBtn");
const deleteTplModal = el("deleteTplModal");
const dtCloseBtn = el("dtCloseBtn");
const dtCancelBtn = el("dtCancelBtn");
const dtConfirmBtn = el("dtConfirmBtn");
const dtTplName = el("dtTplName");
// Delete line modal elements
const dlModal = el("deleteLineModal");
const dlCloseBtn = el("dlCloseBtn");
const dlCancelBtn = el("dlCancelBtn");
const dlConfirmBtn = el("dlConfirmBtn");
const dlText = el("dlText");

// Lines mode flag (default View mode like RM-BOM)
let LINES_EDIT_MODE = false;
// Horizontal scroll sync (parity with RM-BOM)
const linesScroll = document.getElementById("linesScroll");
const linesHScrollTop = document.getElementById("linesHScrollTop");
const linesHScrollInner = document.getElementById("linesHScrollInner");
const linesBackToTop = document.getElementById("linesBackToTop");
// Loading mask elements (ERP style)
const pageMask = el("pageMask");
const pageMaskText = el("pageMaskText");
let _hSyncing = false;
// Track focused row for keyboard shortcuts
let FOCUSED_ROW_INDEX = null;
// Insert popover state
let INSERT_TARGET_INDEX = null;
let INSERT_TARGET_MODE = null; // "above" | "below"
let insertPopoverResizeHandler = null;
let PENDING_DELETE_LINE_INDEX = null;
// Combobox-specific state removed (not used with native selects)

// Permissions
const MODULE_ID = "plm-templates";
const MAP_MODULE_ID = "plm-sku-map";
let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = true;
let MAP_PERM_CAN_VIEW = true;
let MAP_PERM_CAN_EDIT = true;
let MAP_INIT_DONE = false;
let MAP_MAPPED_SKUS = new Set();
// Overrides edit-mode global so tab switcher can reset it
let OVR_EDIT_MODE = false;

// Data caches
let UOMS = [];
let STOCK_ITEMS = []; // PLM-category items
let TEMPLATES = [];
let CURRENT_TPL_ID = null;
let CURRENT_LINES = [];
// Caches for rebuild rendering
const REBUILD_TPL_MAP = new Map(); // sku_id -> tpl_code
const REBUILD_SKU_LABEL_MAP = new Map(); // sku_id -> sku_label

async function ensureTplCodesForSkus(skuIds = []) {
  const missing = skuIds
    .map((s) => Number(s))
    .filter((s) => s && !REBUILD_TPL_MAP.has(s));
  const missingLabels = skuIds
    .map((s) => Number(s))
    .filter((s) => s && !REBUILD_SKU_LABEL_MAP.has(s));
  if (!missing.length && !missingLabels.length) return;

  // fetch mappings (tpl_id) for missing SKUs
  let maps = [];
  if (missing.length) {
    const { data: mdata, error: mapErr } = await supabase
      .from("plm_sku_pack_map")
      .select("sku_id, tpl_id")
      .in("sku_id", missing);
    if (mapErr) {
      // ignore mapping errors; still try to fetch labels
      maps = [];
    } else maps = mdata || [];
  }

  // fetch tpl codes for tpl_ids referenced
  const tplIds = Array.from(
    new Set((maps || []).map((m) => Number(m.tpl_id)).filter(Boolean))
  );
  let tplMap = new Map();
  if (tplIds.length) {
    const { data: tplRows, error: tplErr } = await supabase
      .from("plm_tpl_header")
      .select("id, code")
      .in("id", tplIds);
    if (!tplErr && tplRows)
      tplMap = new Map((tplRows || []).map((t) => [Number(t.id), t.code]));
  }
  (maps || []).forEach((m) => {
    const sid = Number(m.sku_id);
    const code = tplMap.get(Number(m.tpl_id)) || null;
    REBUILD_TPL_MAP.set(sid, code);
  });

  // fetch sku labels for missing labels
  if (missingLabels.length) {
    const { data: skuRows, error: skuErr } = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id, sku_label")
      .in("sku_id", missingLabels);
    if (!skuErr && skuRows) {
      skuRows.forEach((s) =>
        REBUILD_SKU_LABEL_MAP.set(Number(s.sku_id), s.sku_label)
      );
    }
  }
}

function showMask(msg = "Loading…") {
  if (pageMaskText) pageMaskText.textContent = msg;
  if (pageMask) pageMask.style.display = "flex";
}
function hideMask() {
  if (pageMask) pageMask.style.display = "none";
}

function setStatus(msg, kind = "info", timeoutMs = 4000) {
  if (!toastContainer) return;
  toastContainer.innerHTML = "";
  if (!msg) return;
  const node = document.createElement("div");
  node.className = `toast ${kind}`;
  node.innerHTML = `<div style="flex:1">${msg.replace(
    /&/g,
    "&amp;"
  )}</div><button class="toast-close" aria-label="Dismiss">×</button>`;
  node
    .querySelector(".toast-close")
    ?.addEventListener("click", () => node.remove());
  toastContainer.appendChild(node);
  if (timeoutMs) setTimeout(() => node.remove(), timeoutMs);
}

function escapeHtml(s = "") {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

function blankLine() {
  return {
    id: null, // line id if existing
    stock_item_id: null,
    qty_per_reference_output: null,
    uom_id: null,
    wastage_pct: null,
    is_optional: false,
    remarks: "",
  };
}

async function loadUoms() {
  const { data, error } = await supabase
    .from("inv_uom")
    .select("id, code")
    .order("code", { ascending: true });
  if (error) throw error;
  UOMS = data || [];
  refUom.innerHTML = UOMS.map(
    (u) => `<option value="${u.id}">${u.code}</option>`
  ).join("");
}

async function loadPlmItems() {
  // Robustly load ALL stock items mapped to PLM category
  // 1) Find PLM category id
  const { data: cats, error: catErr } = await supabase
    .from("inv_class_category")
    .select("id")
    .eq("code", "PLM")
    .limit(1);
  if (catErr) throw catErr;
  const catId = cats && cats[0] ? cats[0].id : null;
  if (!catId) {
    STOCK_ITEMS = [];
    return;
  }
  // 2) Get all stock_item_id mapped to this category
  const { data: maps, error: mapErr } = await supabase
    .from("inv_stock_item_class_map")
    .select("stock_item_id")
    .eq("category_id", catId);
  if (mapErr) throw mapErr;
  const ids = Array.from(
    new Set((maps || []).map((m) => m.stock_item_id).filter(Boolean))
  );
  if (!ids.length) {
    STOCK_ITEMS = [];
    return;
  }
  // 3) Fetch the items themselves ordered by name
  const { data: items, error: itemErr } = await supabase
    .from("inv_stock_item")
    .select("id,name,code")
    .in("id", ids)
    .order("name", { ascending: true });
  if (itemErr) throw itemErr;
  STOCK_ITEMS = (items || []).map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code || null,
  }));
}

async function loadTemplates() {
  // Use base header table to avoid missing-view 404s
  const { data, error } = await supabase
    .from("plm_tpl_header")
    .select("id, code")
    .order("code", { ascending: true });
  if (error) throw error;
  TEMPLATES = (data || []).map((r) => ({ tpl_id: r.id, tpl_code: r.code }));
  tplPicker.innerHTML = [
    "<option value=''>— select template —</option>",
    ...TEMPLATES.map(
      (t) => `<option value='${t.tpl_id}'>${escapeHtml(t.tpl_code)}</option>`
    ),
  ].join("");
}

// ---------- Mapping tab logic (cloned and adapted) ----------
// mapLoadSkus removed (top-card SKU picker removed)

async function mapLoadTemplates() {
  // Always fetch template list and cache options HTML for mapping editors
  const { data, error } = await supabase
    .from("plm_tpl_header")
    .select("tpl_id:id, tpl_code:code")
    .order("code", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  // Keep a lightweight cache for option rendering
  MAP_TPL_OPTIONS_HTML = [
    "<option value=''>— none —</option>",
    ...rows.map(
      (r) => `<option value='${r.tpl_id}'>${escapeHtml(r.tpl_code)}</option>`
    ),
  ].join("");
  // Also keep a TEMPLATES list usable elsewhere
  TEMPLATES = rows.map((r) => ({ tpl_id: r.tpl_id, tpl_code: r.tpl_code }));
  // If the old picker still exists (unlikely), populate it for parity
  if (typeof mapTplPicker !== "undefined" && mapTplPicker)
    mapTplPicker.innerHTML = rows
      .map(
        (r) => `<option value='${r.tpl_id}'>${escapeHtml(r.tpl_code)}</option>`
      )
      .join("");
}

// mapRefreshMap removed (top-card SKU/Template picker removed)

async function mapLoadMappedList() {
  if (!mapMappedBody) return;
  try {
    const { data, error } = await supabase
      .from("plm_sku_pack_map")
      .select("sku_id, tpl_id, notes, last_updated_at")
      .order("last_updated_at", { ascending: false });
    if (error) throw error;
    const rows = data || [];
    // Update in-memory set for immediate filtering in modal
    MAP_MAPPED_SKUS = new Set(
      rows.map((r) => Number(r.sku_id)).filter(Boolean)
    );
    const skuIds = [
      ...new Set(rows.map((r) => Number(r.sku_id)).filter(Boolean)),
    ];
    const tplIds = [
      ...new Set(rows.map((r) => Number(r.tpl_id)).filter(Boolean)),
    ];
    const [skuMetaRes, tplMetaRes] = await Promise.all([
      skuIds.length
        ? supabase
            .from("v_sku_catalog_enriched")
            .select("sku_id, sku_label, product_id, pack_size")
            .in("sku_id", skuIds)
        : Promise.resolve({ data: [] }),
      tplIds.length
        ? supabase.from("plm_tpl_header").select("id, code").in("id", tplIds)
        : Promise.resolve({ data: [] }),
    ]);
    const skuMap = new Map(
      (skuMetaRes.data || []).map((s) => [Number(s.sku_id), s.sku_label])
    );
    // map sku_id -> product_id (may be undefined for some SKUs)
    const skuToProduct = new Map(
      (skuMetaRes.data || []).map((s) => [
        Number(s.sku_id),
        Number(s.product_id) || null,
      ])
    );
    const tplMap = new Map(
      (tplMetaRes.data || []).map((t) => [Number(t.id), t.code])
    );
    const fmt = (d) => (d ? new Date(d).toLocaleString() : "");
    // Fetch product classification details for sorting (via v_product_details)
    const productIds = Array.from(
      new Set(Array.from(skuToProduct.values()).filter(Boolean))
    );
    let productMap = new Map();
    if (productIds.length) {
      // Product IDs can be many; Supabase/REST may reject very long query strings.
      // Fetch in small chunks to avoid 400 Bad Request (URI too long) errors.
      try {
        const chunkSize = 200;
        const pdRows = [];
        for (let i = 0; i < productIds.length; i += chunkSize) {
          const chunk = productIds.slice(i, i + chunkSize);
          const { data: pdData, error: pdErr } = await supabase
            .from("v_product_details")
            .select(
              "product_id,product_name,category_name,group_name,sub_group_name,subcategory_name"
            )
            .in("product_id", chunk);
          if (pdErr) {
            console.warn("v_product_details chunk fetch failed", pdErr);
            continue;
          }
          if (Array.isArray(pdData)) pdRows.push(...pdData);
        }
        if (pdRows.length) {
          productMap = new Map(pdRows.map((p) => [Number(p.product_id), p]));
        }
      } catch (e) {
        console.warn("Failed to load product details for mapping sort", e);
      }
    }

    // Store rows, augment with resolved labels and product classification, then sort
    MAP_ROWS = rows.map((r) => {
      const pid = skuToProduct.get(Number(r.sku_id)) || null;
      const pd = pid ? productMap.get(pid) || null : null;
      return {
        ...r,
        sku_label: skuMap.get(Number(r.sku_id)) || r.sku_id,
        tpl_code: tplMap.get(Number(r.tpl_id)) || r.tpl_id,
        last_updated_fmt: fmt(r.last_updated_at),
        _product: pd,
      };
    });

    // Sorting comparator: category, group, subgroup, subcategory, product_name, pack_size
    const cmp = (a, b) => {
      const aPd = a._product || {};
      const bPd = b._product || {};
      const s = (x) => (x == null ? "" : String(x));
      const fields = [
        s(aPd.category_name).localeCompare(s(bPd.category_name)),
        s(aPd.group_name).localeCompare(s(bPd.group_name)),
        s(aPd.sub_group_name).localeCompare(s(bPd.sub_group_name)),
        s(aPd.subcategory_name).localeCompare(s(bPd.subcategory_name)),
        s(aPd.product_name).localeCompare(s(bPd.product_name)),
      ];
      for (let v of fields) if (v !== 0) return v;
      // pack_size numeric if possible
      const pa = parseFloat(aPd.pack_size);
      const pb = parseFloat(bPd.pack_size);
      if (!isNaN(pa) && !isNaN(pb)) return pa - pb;
      return s(aPd.pack_size).localeCompare(s(bPd.pack_size));
    };
    MAP_ROWS.sort(cmp);
    // debug: log a small sample so we can verify sorting and product enrichment
    try {
      console.debug(
        "MAP_ROWS sample after sort:",
        (MAP_ROWS || []).slice(0, 20).map((r) => ({
          sku: r.sku_label || r.sku_id,
          category: r._product?.category_name || null,
          group: r._product?.group_name || null,
          subgroup: r._product?.sub_group_name || null,
          subcategory: r._product?.subcategory_name || null,
          product: r._product?.product_name || null,
          pack_size: r._product?.pack_size || null,
        }))
      );
    } catch {
      /* ignore debug failures in non-browser env */
    }
    renderMappedRows();
    // update the mapped/unmapped pills
    try {
      await mapUpdatePills();
    } catch (e) {
      // non-fatal
      console.error("mapUpdatePills failed", e);
    }
  } catch (e) {
    console.error(e);
    setStatus(`Load mapped list failed: ${e.message}`, "error");
    mapMappedBody.innerHTML = "";
  }
}

function renderMappedRows() {
  if (!mapMappedBody) return;
  // Use cached template options HTML (fast)
  const tplOpts =
    MAP_TPL_OPTIONS_HTML ||
    Array.from(mapTplPicker?.options || [])
      .map((o) => {
        const v = o.value || "";
        const t = o.textContent || "";
        if (!v) return "";
        return `<option value='${v}'>${escapeHtml(String(t))}</option>`;
      })
      .join("");

  // Build rows with original indices so edit/save operations map back to MAP_ROWS
  const source = MAP_ROWS || [];
  const term = String(MAP_SEARCH_TERM || "")
    .trim()
    .toLowerCase();
  const rowsWithIndex = source
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => {
      if (!term) return true;
      const lbl = String(r.sku_label || "").toLowerCase();
      const id = String(r.sku_id || "");
      return lbl.includes(term) || id.includes(term);
    });

  mapMappedBody.innerHTML = rowsWithIndex
    .map(({ r, idx }) => {
      const skuLabel = escapeHtml(String(r.sku_label || r.sku_id || ""));
      const tplCode = escapeHtml(String(r.tpl_code || r.tpl_id || ""));
      const notes = escapeHtml(r.notes || "");
      const updated = escapeHtml(r.last_updated_fmt || "");
      const editing = MAP_EDIT_MODE;
      const tplCell = editing
        ? `<select class="map-tpl-select">${tplOpts}</select>`
        : tplCode;
      const notesCell = editing
        ? `<input class="map-notes" type="text" value="${notes}" data-orig="${escapeHtml(
            String(r.notes || "")
          )}"/>`
        : notes;
      let actions = "";
      if (MAP_EDIT_MODE) {
        actions = `<div class="row-actions">`;
        actions += `<button class="icon-btn small" data-act="save-row" data-i="${idx}" disabled aria-label="Save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>`;
        actions += `<button class="icon-btn small" data-act="del" data-i="${idx}" aria-label="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>`;
        actions += `</div>`;
      }

      return `<tr data-i='${idx}'>
        <td>${skuLabel}</td>
        <td data-col="tpl">${tplCell}</td>
        <td data-col="notes">${notesCell}</td>
        <td>${updated}</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");

  // After rendering, wire input/change listeners for dirty tracking (fast)
  if (MAP_EDIT_MODE) {
    mapMappedBody.querySelectorAll("tr[data-i]").forEach((tr) => {
      const origIdx = Number(tr.getAttribute("data-i"));
      const sel = tr.querySelector("select.map-tpl-select");
      const notesIn = tr.querySelector("input.map-notes");
      const orig = MAP_ROWS[origIdx];
      if (sel) sel.value = orig && orig.tpl_id ? String(orig.tpl_id) : "";
      if (notesIn) notesIn.value = orig && orig.notes ? String(orig.notes) : "";
      const markDirty = () => {
        const o = MAP_ROWS[origIdx];
        const curTpl = sel
          ? sel.value
            ? parseInt(sel.value, 10)
            : null
          : null;
        const curNotes = notesIn ? String(notesIn.value || "") : "";
        const tplChanged = (o.tpl_id || null) !== (curTpl || null);
        const notesChanged = String(o.notes || "") !== curNotes;
        const dirty = tplChanged || notesChanged;
        tr.classList.toggle("dirty", dirty);
        const saveBtn = tr.querySelector("button[data-act='save-row']");
        if (saveBtn) saveBtn.disabled = !dirty;
      };
      if (sel) sel.addEventListener("change", markDirty);
      if (notesIn) notesIn.addEventListener("input", markDirty);
    });
  }
}

// Small confirm helper that reuses the Overrides confirm modal markup (`ovr_confirmModal`)
function mapOpenConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("ovr_confirmModal");
    const text = document.getElementById("ovr_confirmText");
    const btn = document.getElementById("ovrConfirmBtn");
    const cancel = document.getElementById("ovrConfirmCancelBtn");
    const close = document.getElementById("ovrConfirmClose");
    if (!modal || !text || !btn || !cancel) return resolve(false);
    text.textContent = message;
    modal.style.display = "flex";
    const cleanup = () => {
      modal.style.display = "none";
      btn.removeEventListener("click", onConfirm);
      cancel.removeEventListener("click", onCancel);
      close && close.removeEventListener("click", onCancel);
    };
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    btn.addEventListener("click", onConfirm);
    cancel.addEventListener("click", onCancel);
    close && close.addEventListener("click", onCancel);
  });
}

// Apply mapping mode view/edit
function applyMapMode() {
  if (mapPanel) {
    if (MAP_EDIT_MODE) mapPanel.classList.remove("view-mode");
    else mapPanel.classList.add("view-mode");
  }
  if (mapViewBtn) mapViewBtn.classList.toggle("active", !MAP_EDIT_MODE);
  if (mapEditBtn) mapEditBtn.classList.toggle("active", MAP_EDIT_MODE);
  // no-op: per-row editing handled via per-row buttons
  renderMappedRows();
  // hide global Save/Cancel in favor of per-row actions
  if (mapSaveBtn) mapSaveBtn.style.display = "none";
  if (mapCancelBtn) mapCancelBtn.style.display = "none";

  // (overrides mode UI is managed inside the OverridesModule scope)
}

// === Overrides embedded module (merged from manage-plm-overrides-clone.js) ===
(function OverridesModule() {
  // scoped to avoid polluting outer module
  const skuPicker = el("ovr_skuPicker");
  const addOverrideBtn = el("ovr_addOverrideBtn");
  const ovrBody = el("ovr_ovrBody");
  const previewBody = el("ovr_previewBody");
  const previewSkuPicker = el("ovr_previewSkuPicker");
  const ovrViewBtn = el("ovr_viewBtn");
  const ovrEditBtn = el("ovr_editBtn");
  let OVR_PERM_CAN_EDIT = true;

  let OVERRIDES = [];
  let ENSURED_STOCK_IDS = new Set();

  function applyOverridesMode() {
    if (tabPanelOverrides) {
      if (OVR_EDIT_MODE) tabPanelOverrides.classList.remove("view-mode");
      else tabPanelOverrides.classList.add("view-mode");
    }
    if (ovrViewBtn) ovrViewBtn.classList.toggle("active", !OVR_EDIT_MODE);
    if (ovrEditBtn) ovrEditBtn.classList.toggle("active", OVR_EDIT_MODE);
    renderOverrides();
  }

  // expose a small setter so outer code (tab switcher) can reset overrides mode
  try {
    window.setOvrEditMode = (v) => {
      OVR_EDIT_MODE = !!v;
      applyOverridesMode();
    };
  } catch {
    /* non-browser or restricted environment */
  }

  function ensureStockItemCodesLocal(ids = []) {
    const need = Array.from(
      new Set((ids || []).map((x) => Number(x)).filter(Boolean))
    );
    if (!need.length) return Promise.resolve();
    const unknown = need.filter(
      (id) => !STOCK_ITEMS.some((x) => Number(x.id) === Number(id))
    );
    if (!unknown.length) return Promise.resolve();
    return supabase
      .from("inv_stock_item")
      .select("id, name, code")
      .in("id", unknown)
      .then(({ data, error }) => {
        if (error) throw error;
        (data || []).forEach((r) => {
          const existing = STOCK_ITEMS.find(
            (x) => Number(x.id) === Number(r.id)
          );
          if (existing) {
            existing.code = existing.code || r.code || null;
            existing.name = existing.name || r.name || "";
          } else {
            STOCK_ITEMS.push({
              id: r.id,
              name: r.name || "",
              code: r.code || null,
            });
          }
        });
      })
      .catch((err) => console.warn("ensureStockItemCodesLocal failed", err));
  }

  function blankOverride() {
    return {
      id: null,
      op: "set",
      stock_item_id: null,
      qty_per_reference_output: null,
      uom_id: null,
      wastage_pct: null,
      is_optional: null,
      remarks: "",
    };
  }

  function getItemCodeLocal(id) {
    const it = STOCK_ITEMS.find((x) => x.id === id);
    return it?.code || "";
  }

  function renderPreview(rows) {
    const missing = new Set();
    const html = (rows || [])
      .map((ln, i) => {
        const code = ln.item_code || getItemCodeLocal(Number(ln.stock_item_id));
        const name = ln.item_name || ln.stock_item_name || "";
        if ((!code || String(code) === "") && ln.stock_item_id)
          missing.add(Number(ln.stock_item_id));
        const wastRaw = ln.wastage_pct;
        const wast =
          wastRaw == null
            ? ""
            : Number(wastRaw) <= 1.5
            ? Number(wastRaw) * 100
            : Number(wastRaw);
        return `<tr>
        <td>${i + 1}</td>
        <td class='code-cell'>${escapeHtml(
          code || String(ln.stock_item_id || "")
        )}</td>
        <td class='item-cell'>${escapeHtml(name)}</td>
        <td class='right'>${ln.qty_per_reference_output ?? ""}</td>
        <td>${escapeHtml(ln.uom_code || "")}</td>
        <td class='right'>${wast === "" ? "" : Number(wast).toFixed(2)}%</td>
        <td>${ln.is_optional ? "Yes" : "No"}</td>
        <td>${escapeHtml(ln.remarks || "")}</td>
      </tr>`;
      })
      .join("");
    if (previewBody) previewBody.innerHTML = html;
    if (missing.size) {
      ensureStockItemCodesLocal(Array.from(missing)).then(() => {
        if (previewBody)
          previewBody.innerHTML = (rows || [])
            .map((ln, i) => {
              const code2 =
                ln.item_code ||
                getItemCodeLocal(Number(ln.stock_item_id)) ||
                String(ln.stock_item_id || "");
              const name2 = ln.item_name || ln.stock_item_name || "";
              const wastRaw2 = ln.wastage_pct;
              const wast2 =
                wastRaw2 == null
                  ? ""
                  : Number(wastRaw2) <= 1.5
                  ? Number(wastRaw2) * 100
                  : Number(wastRaw2);
              return `<tr>
            <td>${i + 1}</td>
            <td class='code-cell'>${escapeHtml(code2)}</td>
            <td class='item-cell'>${escapeHtml(name2)}</td>
            <td class='right'>${ln.qty_per_reference_output ?? ""}</td>
            <td>${escapeHtml(ln.uom_code || "")}</td>
            <td class='right'>${
              wast2 === "" ? "" : Number(wast2).toFixed(2)
            }%</td>
            <td>${ln.is_optional ? "Yes" : "No"}</td>
            <td>${escapeHtml(ln.remarks || "")}</td>
          </tr>`;
            })
            .join("");
      });
    }
  }

  async function refreshPreview(skuId) {
    let id = skuId;
    if (typeof id === "undefined") {
      id = previewSkuPicker
        ? parseInt(previewSkuPicker.value, 10)
        : parseInt(skuPicker.value, 10);
    }
    id = parseInt(id, 10);
    if (!id) {
      renderPreview([]);
      return;
    }
    const { data, error } = await supabase.rpc("rpc_plm_preview_effective", {
      p_sku_id: id,
    });
    if (error) return setStatus(`Preview failed: ${error.message}`, "error");
    renderPreview(data || []);
  }

  async function loadOverridesForSku() {
    const skuId = parseInt(skuPicker?.value, 10);
    if (!skuId) {
      OVERRIDES = [];
      renderOverrides();
      renderPreview([]);
      return;
    }
    const { data, error } = await supabase.rpc("rpc_plm_ovr_list", {
      p_sku_id: skuId,
    });
    if (error) {
      setStatus(`Load overrides failed: ${error.message}`, "error");
      OVERRIDES = [];
    } else {
      OVERRIDES = (data || []).map((r) => ({
        id: r.id,
        op: r.op,
        stock_item_id: r.stock_item_id,
        qty_per_reference_output: r.qty_per_reference_output ?? null,
        uom_id: r.uom_id ?? null,
        wastage_pct: r.wastage_pct ?? null,
        is_optional: r.is_optional == null ? null : !!r.is_optional,
        remarks: r.remarks || "",
      }));
    }
    renderOverrides();
    await refreshPreview();
  }

  function renderOverrides() {
    const itemOptions = (sid) =>
      [
        "<option value=''>— select —</option>",
        ...STOCK_ITEMS.map(
          (x) =>
            `<option value='${x.id}' ${
              x.id === sid ? "selected" : ""
            }>${escapeHtml(x.name)}</option>`
        ),
      ].join("");
    const uomOptions = (uid) =>
      [
        "<option value=''>— select —</option>",
        ...UOMS.map(
          (u) =>
            `<option value='${u.id}' ${u.id === uid ? "selected" : ""}>${
              u.code
            }</option>`
        ),
      ].join("");
    const rows = OVERRIDES.length ? OVERRIDES : [blankOverride()];
    if (!OVR_EDIT_MODE) {
      ovrBody.innerHTML = rows
        .map((ovr, i) => {
          const eff = OVERRIDES.length ? ovr : blankOverride();
          const itemName = (() => {
            const item = STOCK_ITEMS.find((x) => x.id === eff.stock_item_id);
            if (item) return item.name;
            if (eff.stock_item_id) return `Item #${eff.stock_item_id}`;
            return "";
          })();
          const itemCode = getItemCodeLocal(eff.stock_item_id);
          const uomCode = (() => {
            const u = UOMS.find((u) => u.id === eff.uom_id);
            return u ? u.code : "";
          })();
          const qtyStr =
            eff.qty_per_reference_output == null
              ? ""
              : String(eff.qty_per_reference_output);
          const wastStr = (() => {
            if (eff.wastage_pct == null) return "";
            const raw = Number(eff.wastage_pct);
            const pct = raw <= 1.5 ? raw * 100 : raw;
            return `${pct.toFixed(2)}%`;
          })();
          const optStr = eff.is_optional ? "Yes" : "No";
          const remStr = escapeHtml(eff.remarks || "");
          return `\n        <tr data-i='${i}'>\n          <td class='code-cell'>${escapeHtml(
            itemCode
          )}</td>\n          <td class='item-cell'>${escapeHtml(
            itemName
          )}</td>\n          <td class='qty-col'>${escapeHtml(
            qtyStr
          )}</td>\n          <td class='uom-col'>${escapeHtml(
            uomCode
          )}</td>\n          <td class='wast-col'>${escapeHtml(
            wastStr
          )}</td>\n          <td class='opt-col'>${optStr}</td>\n          <td>${remStr}</td>\n          <td class='actions-col'></td>\n        </tr>`;
        })
        .join("");
      (function ensureMissingNames() {
        const missing = Array.from(
          new Set(
            rows.map((r) => Number(r.stock_item_id) || null).filter(Boolean)
          )
        ).filter((id) => !STOCK_ITEMS.some((s) => Number(s.id) === Number(id)));
        const toFetch = missing.filter(
          (id) => !ENSURED_STOCK_IDS.has(Number(id))
        );
        if (!toFetch.length) return;
        toFetch.forEach((id) => ENSURED_STOCK_IDS.add(Number(id)));
        ensureStockItemCodesLocal(toFetch)
          .then(() => renderOverrides())
          .catch((err) => console.warn("ensureMissingNames failed", err));
      })();
    } else {
      ovrBody.innerHTML = rows
        .map((ovr, i) => {
          const eff = OVERRIDES.length ? ovr : blankOverride();
          return `\n        <tr data-i='${i}'>\n          <td class='code-cell'><span class='muted'>${escapeHtml(
            getItemCodeLocal(eff.stock_item_id)
          )}</span></td>\n          <td class='item-cell'><select class='cell item' style='width:100%'>${itemOptions(
            eff.stock_item_id
          )}</select></td>\n          <td class='qty-col right'><input class='cell qty' type='number' step='0.0001' min='0' value='${
            eff.qty_per_reference_output ?? ""
          }' /></td>\n          <td class='uom-col'><select class='cell uom'>${uomOptions(
            eff.uom_id
          )}</select></td>\n          <td class='wast-col right'><input class='cell wast' type='number' step='0.0001' min='0' max='0.9999' value='${
            eff.wastage_pct ?? ""
          }' /></td>\n          <td class='opt-col'><input type='checkbox' class='cell opt' ${
            eff.is_optional ? "checked" : ""
          } /></td>\n          <td><input type='text' class='cell rem' value='${escapeHtml(
            eff.remarks || ""
          )}' /></td>\n          <td class='actions-col'>\n            <div class='row-actions'>\n              <button class='icon-btn small' data-act='save-row' data-i='${i}' title='Save' aria-label='Save' disabled>\n                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>\n              </button>\n              <button class='icon-btn small' data-act='del' data-i='${i}' title='Delete' aria-label='Delete'>\n                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/><path d='M10 11v6'/><path d='M14 11v6'/></svg>\n              </button>\n            </div>\n          </td>\n        </tr>`;
        })
        .join("");
      if (OVR_PERM_CAN_EDIT) {
        const colCount = 8;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="${colCount}" style="text-align:center; padding:10px;">\n        <button class="icon-btn small" data-act="addEnd" title="Add row" aria-label="Add row">\n          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>\n        </button>\n        <span class="hint" style="margin-left:6px; color:#64748b; font-size:12px;">Add new row</span>\n      </td>`;
        ovrBody.appendChild(tr);
      }
      (function ensureMissingNamesEdit() {
        const missing = Array.from(
          new Set(
            rows.map((r) => Number(r.stock_item_id) || null).filter(Boolean)
          )
        ).filter((id) => !STOCK_ITEMS.some((s) => Number(s.id) === Number(id)));
        const toFetch = missing.filter(
          (id) => !ENSURED_STOCK_IDS.has(Number(id))
        );
        if (!toFetch.length) return;
        toFetch.forEach((id) => ENSURED_STOCK_IDS.add(Number(id)));
        ensureStockItemCodesLocal(toFetch)
          .then(() => renderOverrides())
          .catch((err) => console.warn("ensureMissingNamesEdit failed", err));
      })();
    }

    // attach snapshots for editable rows
    try {
      if (!ovrBody) return;
      const trs = ovrBody.querySelectorAll("tr[data-i]");
      trs.forEach((tr) => {
        const i = parseInt(tr.dataset.i, 10);
        const snap = OVERRIDES && OVERRIDES[i] ? OVERRIDES[i] : blankOverride();
        try {
          tr.dataset.orig = JSON.stringify(snap);
        } catch {
          tr.dataset.orig = "";
        }
        const saveBtn = tr.querySelector("button[data-act='save-row']");
        if (saveBtn) saveBtn.disabled = true;
      });
    } catch {
      /* ignore */
    }
  }

  function openConfirm(msg) {
    return mapOpenConfirm ? mapOpenConfirm(msg) : Promise.resolve(false);
  }

  async function ovrSaveRow(i) {
    const r = OVERRIDES?.[i];
    if (!r) return;
    if (!OVR_PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
    const skuId = parseInt(skuPicker?.value, 10);
    if (!skuId) return setStatus("Select a SKU.", "error");
    const ok = await openConfirm("Save changes to this override?");
    if (!ok) {
      try {
        const tr = ovrBody.querySelector(`tr[data-i='${i}']`);
        if (tr) {
          const orig = tr.dataset.orig ? JSON.parse(tr.dataset.orig) : null;
          if (orig) OVERRIDES[i] = orig;
        }
      } catch {
        void 0;
      }
      renderOverrides();
      await refreshPreview();
      return;
    }
    try {
      const u = UOMS.find((x) => x.id === r.uom_id);
      const uomCode = u?.code || null;
      const { error } = await supabase.rpc("rpc_plm_ovr_upsert", {
        p_id: r.id,
        p_sku_id: skuId,
        p_op: "set",
        p_stock_item_id: r.stock_item_id,
        p_qty: r.qty_per_reference_output,
        p_uom_code: uomCode,
        p_wastage_pct: r.wastage_pct,
        p_is_optional: r.is_optional,
        p_remarks: r.remarks || null,
      });
      if (error) throw error;
      setStatus("Row saved.", "success");
      await loadOverridesForSku();
    } catch (e) {
      console.error(e);
      setStatus(`Save failed: ${e.message}`, "error");
    }
  }

  // delegate change/click handling
  ovrBody?.addEventListener("change", async (e) => {
    if (!OVR_EDIT_MODE) return;
    const tr = e.target.closest("tr[data-i]");
    if (!tr) return;
    const i = parseInt(tr.dataset.i, 10);
    if (!OVERRIDES.length) OVERRIDES = [blankOverride()];
    const row = OVERRIDES[i] || (OVERRIDES[i] = blankOverride());
    if (e.target.classList.contains("item")) {
      row.stock_item_id = e.target.value ? parseInt(e.target.value, 10) : null;
      const codeSpan = tr.querySelector(".code-cell .muted");
      if (codeSpan) codeSpan.textContent = getItemCodeLocal(row.stock_item_id);
    }
    if (e.target.classList.contains("qty"))
      row.qty_per_reference_output =
        e.target.value === "" ? null : parseFloat(e.target.value);
    if (e.target.classList.contains("uom"))
      row.uom_id = e.target.value ? parseInt(e.target.value, 10) : null;
    if (e.target.classList.contains("wast"))
      row.wastage_pct =
        e.target.value === "" ? null : parseFloat(e.target.value);
    if (e.target.classList.contains("opt")) row.is_optional = e.target.checked;
    if (e.target.classList.contains("rem")) row.remarks = e.target.value || "";
    await refreshPreview();
    try {
      const orig = tr.dataset.orig || null;
      const curr = JSON.stringify(row || null);
      const isDirty = orig ? curr !== orig : true;
      const saveBtn = tr.querySelector("button[data-act='save-row']");
      if (saveBtn) saveBtn.disabled = !isDirty;
    } catch {
      void 0;
    }
  });

  ovrBody?.addEventListener("click", async (e) => {
    if (!OVR_EDIT_MODE) return;
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "save-row") {
      const tr = btn.closest("tr[data-i]");
      const i = parseInt(tr.dataset.i, 10);
      await ovrSaveRow(i);
      return;
    }
    if (act === "del") {
      const tr = btn.closest("tr[data-i]");
      const i = parseInt(tr.dataset.i, 10);
      const row = OVERRIDES[i];
      const ok = await openConfirm("Delete this override?");
      if (!ok) return;
      if (row?.id) {
        const { error } = await supabase.rpc("rpc_plm_ovr_delete", {
          p_id: row.id,
        });
        if (error) return setStatus(`Delete failed: ${error.message}`, "error");
      }
      OVERRIDES.splice(i, 1);
      renderOverrides();
      await refreshPreview();
      return;
    }
    if (act === "addEnd") {
      OVERRIDES.push(blankOverride());
      renderOverrides();
      await refreshPreview();
      return;
    }
  });

  // top-level buttons
  if (addOverrideBtn)
    addOverrideBtn.addEventListener("click", () => {
      OVERRIDES.push(blankOverride());
      renderOverrides();
    });
  // Bulk Save / Apply & Rebuild removed — row-level actions are used instead

  if (ovrViewBtn)
    ovrViewBtn.addEventListener("click", () => {
      OVR_EDIT_MODE = false;
      applyOverridesMode();
    });
  if (ovrEditBtn)
    ovrEditBtn.addEventListener("click", () => {
      OVR_EDIT_MODE = true;
      applyOverridesMode();
    });

  async function loadSkus() {
    try {
      const { data, error } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id, sku_label")
        .order("sku_label", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      if (skuPicker)
        skuPicker.innerHTML = [
          "<option value=''>— select SKU —</option>",
          ...rows.map(
            (r) =>
              `<option value='${r.sku_id}'>${escapeHtml(r.sku_label)}</option>`
          ),
        ].join("");
      if (previewSkuPicker)
        previewSkuPicker.innerHTML = [
          "<option value=''>— select SKU —</option>",
          ...rows.map(
            (r) =>
              `<option value='${r.sku_id}'>${escapeHtml(r.sku_label)}</option>`
          ),
        ].join("");
    } catch (err) {
      console.warn("loadSkus failed", err);
    }
  }

  // init
  (async function initOverrides() {
    try {
      await loadPlmItems(); // ensure STOCK_ITEMS present
      await loadUoms();
      await loadSkus();
      await loadOverridesForSku();
      OVR_EDIT_MODE = false;
      applyOverridesMode();
      skuPicker?.addEventListener("change", loadOverridesForSku);
      previewSkuPicker?.addEventListener("change", () =>
        refreshPreview(parseInt(previewSkuPicker.value, 10))
      );
    } catch (e) {
      console.error("initOverrides failed", e);
    }
  })();
})();

// Delegated action handlers for mapping rows
mapMappedBody?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const i = parseInt(btn.dataset.i, 10);
  const row = MAP_ROWS?.[i];
  if (!row) return;
  const skuId = Number(row.sku_id);
  if (act === "del") {
    if (!MAP_PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
    try {
      const ok = await mapOpenConfirm("Delete this mapping?");
      if (!ok) return;
      const { error: clearErr } = await supabase.rpc("rpc_plm_map_clear", {
        p_sku_id: skuId,
      });
      if (clearErr) throw clearErr;
      setStatus("Mapping cleared.", "success");
      await mapLoadMappedList();
    } catch (err) {
      console.error(err);
      setStatus(`Delete failed: ${err.message}`, "error");
    }
    return;
  }
  if (act === "save-row") {
    try {
      const ok = await mapOpenConfirm("Save changes to this mapping?");
      if (!ok) return;
      return mapSaveRow(i);
    } catch (e) {
      console.error(e);
      return;
    }
  }
});

// Save all inline edits made in edit mode
async function mapSaveAll() {
  if (!MAP_PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
  const changes = [];
  (MAP_ROWS || []).forEach((r, i) => {
    const tr = mapMappedBody.querySelector(`tr[data-i='${i}']`);
    if (!tr) return;
    const sel = tr.querySelector("select.map-tpl-select");
    const notesIn = tr.querySelector("input.map-notes");
    const newTplId = sel ? (sel.value ? parseInt(sel.value, 10) : null) : null;
    const newNotes = notesIn ? String(notesIn.value || "") : "";
    const tplChanged = (r.tpl_id || null) !== (newTplId || null);
    const notesChanged = String(r.notes || "") !== newNotes;
    if (tplChanged || notesChanged) {
      changes.push({ skuId: Number(r.sku_id), newTplId, newNotes, orig: r });
    }
  });
  if (!changes.length) return setStatus("No changes to save.", "info");
  const results = await Promise.allSettled(
    changes.map(async (c) => {
      if (c.newTplId) {
        const { error: setErr } = await supabase.rpc("rpc_plm_map_set", {
          p_sku_id: c.skuId,
          p_tpl_id: c.newTplId,
        });
        if (setErr) throw setErr;
      } else {
        const { error: clrErr } = await supabase.rpc("rpc_plm_map_clear", {
          p_sku_id: c.skuId,
        });
        if (clrErr) throw clrErr;
      }
      if (String(c.orig.notes || "") !== String(c.newNotes || "")) {
        const { error: noteErr } = await supabase
          .from("plm_sku_pack_map")
          .update({ notes: c.newNotes })
          .eq("sku_id", c.skuId);
        if (noteErr) throw noteErr;
      }
      return { ok: true, skuId: c.skuId };
    })
  );
  const errors = results.filter((r) => r.status === "rejected");
  if (errors.length) {
    console.error(errors);
    setStatus(`${errors.length} changes failed.`, "error");
  } else {
    setStatus("All changes saved.", "success");
  }
  MAP_EDIT_MODE = false;
  await mapLoadMappedList();
}

// Cancel edits - reload original data
function mapCancelEdits() {
  MAP_EDIT_MODE = false;
  applyMapMode();
  mapLoadMappedList();
}

// Save changes for a single row (by index)
async function mapSaveRow(i) {
  const r = MAP_ROWS?.[i];
  if (!r) return;
  if (!MAP_PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
  const tr = mapMappedBody.querySelector(`tr[data-i='${i}']`);
  if (!tr) return;
  const sel = tr.querySelector("select.map-tpl-select");
  const notesIn = tr.querySelector("input.map-notes");
  const newTplId = sel ? (sel.value ? parseInt(sel.value, 10) : null) : null;
  const newNotes = notesIn ? String(notesIn.value || "") : "";
  try {
    if (newTplId) {
      const { error: setErr } = await supabase.rpc("rpc_plm_map_set", {
        p_sku_id: Number(r.sku_id),
        p_tpl_id: newTplId,
      });
      if (setErr) throw setErr;
    } else {
      const { error: clrErr } = await supabase.rpc("rpc_plm_map_clear", {
        p_sku_id: Number(r.sku_id),
      });
      if (clrErr) throw clrErr;
    }
    if (String(r.notes || "") !== newNotes) {
      const { error: noteErr } = await supabase
        .from("plm_sku_pack_map")
        .update({ notes: newNotes })
        .eq("sku_id", Number(r.sku_id));
      if (noteErr) throw noteErr;
    }
    setStatus("Row saved.", "success");
    await mapLoadMappedList();
  } catch (err) {
    console.error(err);
    setStatus(`Save failed: ${err.message}`, "error");
  }
}

// Cancel edits for a single row (revert inputs to original values)
// mapCancelRow removed — per-row Cancel button was removed from the UI.

function applyMappingPermissions() {
  const disable = !MAP_PERM_CAN_EDIT;
  if (mapNewBtn) mapNewBtn.disabled = disable;
  if (mapEditBtn) mapEditBtn.disabled = disable;
  if (mapSaveBtn) mapSaveBtn.disabled = disable;
  if (mapCancelBtn) mapCancelBtn.disabled = disable;
  // Kebab menu: disable edit action when no edit permission (keep view available)
  if (mapKebabEditBtn) mapKebabEditBtn.disabled = disable;
}

// --- Unmapped SKUs pills and modal helpers ---
let MAP_LAST_UNMAPPED = [];
let PREVIEW_LAST_NO_OVR = [];
let PREVIEW_INIT_DONE = false;

// Return a list of unmapped SKUs (objects with sku_id and sku_label).
// Uses pagination to avoid Supabase 1000-row limits and prefers cached mapped set when available.
async function mapGetUnmappedSkus() {
  const pageSize = 1000;
  try {
    // Build mapped set by paginating plm_sku_pack_map (avoid stale/truncated cache)
    let mappedSet = new Set();
    let mpage = 0;
    let mmore = true;
    while (mmore) {
      const { data: mdata, error: merr } = await supabase
        .from("plm_sku_pack_map")
        .select("sku_id")
        .range(mpage * pageSize, (mpage + 1) * pageSize - 1);
      if (merr) throw merr;
      if (mdata && mdata.length) {
        mdata.forEach((r) => mappedSet.add(Number(r.sku_id)));
        mpage++;
        mmore = mdata.length === pageSize;
      } else {
        mmore = false;
      }
    }
    // update cache with the full set for future use
    MAP_MAPPED_SKUS = new Set(mappedSet);

    // Read all SKUs from the SKU view, filtering out mapped ones
    const list = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id, sku_label")
        .order("sku_label", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (data && data.length) {
        const pageSkus = data
          .map((r) => ({ sku_id: Number(r.sku_id), sku_label: r.sku_label }))
          .filter((r) => !mappedSet.has(r.sku_id));
        list.push(...pageSkus);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    // Ensure sorted order by label
    list.sort((a, b) => String(a.sku_label).localeCompare(String(b.sku_label)));
    return list;
  } catch (e) {
    console.error("mapGetUnmappedSkus failed", e);
    return [];
  }
}

async function mapGetAllSkusCount() {
  // Return the total number of SKUs (from the authoritative SKU view).
  // Prefer Supabase head/count query to get an exact count efficiently.
  try {
    const headRes = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id", { head: true, count: "exact" });
    // headRes.count should contain the exact total when supported
    if (typeof headRes.count === "number") return headRes.count;
  } catch (e) {
    console.warn("Head/count query for total SKUs failed, falling back:", e);
  }

  // Fallback: paginate through `v_sku_catalog_enriched` to compute total.
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;
  let total = 0;
  try {
    while (hasMore) {
      const { data, error } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (data && data.length) {
        total += data.length;
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    return total;
  } catch (e) {
    console.error("mapGetAllSkusCount fallback failed:", e);
    return 0;
  }
}

async function mapGetMappedSkusCount() {
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;
  const set = new Set();
  try {
    while (hasMore) {
      const { data, error } = await supabase
        .from("plm_sku_pack_map")
        .select("sku_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (data && data.length) {
        data.forEach((r) => {
          if (r && r.sku_id != null) set.add(Number(r.sku_id));
        });
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    return set.size;
  } catch (e) {
    console.error("mapGetMappedSkusCount failed", e);
    return 0;
  }
}

async function mapUpdatePills() {
  try {
    // Get accurate counts from database
    const [totalSkus, mappedCount] = await Promise.all([
      mapGetAllSkusCount(),
      mapGetMappedSkusCount(),
    ]);

    const unmappedCount = Number(totalSkus || 0) - Number(mappedCount || 0);

    // no debug logs in production

    const mappedEl = el("mapPillMappedCount");
    const unmappedEl = el("mapPillUnmappedCount");
    const unmappedText = el("mapUnmappedCountText");

    if (mappedEl) {
      mappedEl.textContent = String(mappedCount || 0);
      mappedEl.dataset.state = mappedCount ? "ok" : "empty";
    }
    if (unmappedEl) {
      unmappedEl.textContent = String(unmappedCount || 0);
      unmappedEl.dataset.state = unmappedCount ? "ok" : "empty";
    }
    if (unmappedText) {
      unmappedText.textContent = `${unmappedCount || 0} unmapped SKUs`;
    }
  } catch (e) {
    console.error("Failed to update pills:", e);
    // Fallback to local counts
    const mappedCount = MAP_MAPPED_SKUS ? MAP_MAPPED_SKUS.size : 0;
    const mappedEl = el("mapPillMappedCount");
    if (mappedEl) {
      mappedEl.textContent = String(mappedCount || 0);
      mappedEl.dataset.state = mappedCount ? "ok" : "empty";
    }
  }
}

// ===== Preview pills / no-overrides modal helpers =====

// Preview now relies on server RPCs; client-side fallbacks removed.

// Removed client-side preview fallbacks: RPCs are used exclusively now.

function populatePreviewNoOvrList(list) {
  const body = el("previewNoOvrList");
  if (!body) return;
  body.innerHTML = (list || [])
    .map(
      (r, i) =>
        `<tr><td style="text-align:center">${i + 1}</td><td>${escapeHtml(
          String(r.sku_label || "")
        )}</td><td style="text-align:center">${r.sku_id}</td></tr>`
    )
    .join("");
}

async function openPreviewNoOvrModal() {
  const modal = el("previewNoOvrModal");
  if (!modal) {
    console.error("previewNoOvrModal element not found!");
    return;
  }

  // Move modal to document.body to escape any ancestor stacking/overflow contexts
  try {
    if (modal.parentElement !== document.body) {
      // store original position so we can restore on close
      modal.__origParent = modal.parentElement;
      modal.__origNext = modal.nextSibling;
      document.body.appendChild(modal);
    }
  } catch (e) {
    console.warn("Could not move modal to document.body:", e);
  }
  // Show loading mask while fetching real data from RPC
  try {
    showMask("Loading SKUs without overrides…");
  } catch {
    /* ignore if mask not present */
  }

  // Ensure explicit visible/backdrop styles (escape ancestor clipping)
  modal.style.display = "flex";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.zIndex = "99999";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";

  const inner = modal.querySelector(".modal");
  if (inner) {
    inner.style.zIndex = "100000";
    inner.style.position = "relative";
  }

  // Call RPC to fetch SKUs without overrides and populate list
  try {
    const { data, error } = await supabase.rpc("rpc_skus_without_overrides");
    if (error) throw error;
    const list = Array.isArray(data) ? data : data ? [data] : [];
    PREVIEW_LAST_NO_OVR = list;
    populatePreviewNoOvrList(list);
    const cntEl = el("previewNoOvrCountText");
    if (cntEl)
      cntEl.textContent = `${(list && list.length) || 0} without overrides`;
  } catch (err) {
    console.error("Failed to load SKUs without overrides via RPC", err);
    // Show empty list but keep modal open so user can still interact
    PREVIEW_LAST_NO_OVR = [];
    populatePreviewNoOvrList([]);
    const cntEl = el("previewNoOvrCountText");
    if (cntEl) cntEl.textContent = `0 without overrides`;
    setStatus && setStatus("Failed to load SKUs without overrides.", "warn");
  } finally {
    try {
      hideMask();
    } catch {
      /* ignore */
    }
  }

  // TODO: Re-enable RPC call once modal is working
  /*
  try {
    showMask("Loading SKUs without overrides…");
    // Try the RPC call, but show modal even if it fails
    let list = [];
    try {
      const { data, error } = await supabase.rpc("rpc_skus_without_overrides");
      if (error) {
        console.warn("RPC call failed:", error);
        throw error;
      }
      list = Array.isArray(data) ? data : data ? [data] : [];
      console.log("RPC returned list with", list.length, "items");
    } catch (rpcError) {
      console.warn("RPC failed, showing empty list:", rpcError);
      list = []; // Show empty list instead of failing completely
    }
    
    PREVIEW_LAST_NO_OVR = list;
    populatePreviewNoOvrList(list);
    const cnt = el("previewNoOvrCountText");
    if (cnt)
      cnt.textContent = `${(list && list.length) || 0} without overrides`;
    console.log("Showing modal...");
    modal.style.display = "flex";
  } catch (e) {
    console.error(e);
    setStatus(
      `Failed to load SKUs without overrides: ${e.message || e}`,
      "error"
    );
    // Show modal anyway with empty list
    modal.style.display = "flex";
  } finally {
    hideMask();
  }
  */
}

function closePreviewNoOvrModal() {
  const modal = el("previewNoOvrModal");
  if (!modal) return;
  // hide and restore original DOM position if we moved it
  try {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    const inner = modal.querySelector(".modal");
    if (inner) {
      inner.style.zIndex = "";
      inner.style.position = "";
    }
    if (modal.__origParent) {
      try {
        if (modal.__origNext)
          modal.__origParent.insertBefore(modal, modal.__origNext);
        else modal.__origParent.appendChild(modal);
      } catch {
        // ignore
      }
      delete modal.__origParent;
      delete modal.__origNext;
    }
  } catch (e) {
    console.warn("closePreviewNoOvrModal cleanup failed", e);
  }
}

async function copyPreviewNoOvrToClipboard() {
  const list = PREVIEW_LAST_NO_OVR || [];
  if (!list || !list.length) return setStatus("No SKUs to copy.", "info");
  const csv = [
    "sku_id,sku_label",
    ...list.map(
      (r) => `${r.sku_id},"${String(r.sku_label).replace(/"/g, '""')}"`
    ),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(csv);
    setStatus("Copied SKUs without overrides as CSV to clipboard.", "success");
  } catch (e) {
    console.error(e);
    setStatus("Clipboard copy failed.", "error");
  }
}

async function copyPreviewNoOvrAsMarkdown() {
  // Prefer exporting the currently-displayed Effective BOM preview if present
  const previewRows = (function () {
    const tb = el("ovr_previewBody");
    if (!tb) return [];
    return Array.from(tb.querySelectorAll("tr")).map((tr) => {
      const cells = tr.children;
      return {
        sn: cells[0]?.textContent?.trim() || "",
        item_code: cells[1]?.textContent?.trim() || "",
        item_name: cells[2]?.textContent?.trim() || "",
        qty: cells[3]?.textContent?.trim() || "",
        uom: cells[4]?.textContent?.trim() || "",
        wast: cells[5]?.textContent?.trim() || "",
        optional: cells[6]?.textContent?.trim() || "",
        remarks: cells[7]?.textContent?.trim() || "",
      };
    });
  })();

  const escapeCell = (s = "") =>
    String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
  if (previewRows.length) {
    const headers = [
      "SN",
      "Item Code",
      "Stock Item",
      "Qty per Ref",
      "UOM",
      "Wastage %",
      "Optional",
      "Remarks",
    ];
    const aligns = [
      "right",
      "left",
      "left",
      "right",
      "left",
      "right",
      "left",
      "left",
    ];
    const rows = previewRows.map((r) => [
      String(r.sn || ""),
      String(r.item_code || ""),
      String(r.item_name || ""),
      String(r.qty || ""),
      String(r.uom || ""),
      String(r.wast || ""),
      String(r.optional || ""),
      String(r.remarks || ""),
    ]);

    const widths = headers.map((h, ci) =>
      Math.max(h.length, ...rows.map((rr) => escapeCell(rr[ci]).length))
    );

    const padCell = (s, w, align) => {
      const t = escapeCell(s || "");
      return align === "right" ? t.padStart(w, " ") : t.padEnd(w, " ");
    };

    const mdLines = [];
    mdLines.push(
      `| ${headers.map((h, i) => padCell(h, widths[i], "left")).join(" | ")} |`
    );
    // build separator cells that respect alignment and column widths
    const sepCells = widths.map((w, i) => {
      const align = aligns[i] || "left";
      let inner;
      if (align === "right") {
        inner = "-".repeat(Math.max(1, w - 1)) + ":";
      } else if (align === "center") {
        if (w <= 2) inner = ":" + "-".repeat(Math.max(1, w - 1));
        else inner = ":" + "-".repeat(Math.max(1, w - 2)) + ":";
      } else {
        inner = "-".repeat(Math.max(1, w));
      }
      return padCell(inner, w, "left");
    });
    mdLines.push(`| ${sepCells.join(" | ")} |`);
    rows.forEach((r) =>
      mdLines.push(
        `| ${r.map((c, i) => padCell(c, widths[i], aligns[i])).join(" | ")} |`
      )
    );

    const md = mdLines.join("\n");
    try {
      await navigator.clipboard.writeText(md);
      return setStatus("Copied preview as Markdown to clipboard.", "success");
    } catch (e) {
      console.error(e);
      return setStatus("Clipboard copy failed.", "error");
    }
  }

  // Fallback: export SKUs without overrides list
  const list = PREVIEW_LAST_NO_OVR || [];
  if (!list || !list.length) return setStatus("No SKUs to copy.", "info");
  const hdrs = ["sku_id", "sku_label"];
  const rows2 = (list || []).map((r) => [
    String(r.sku_id || ""),
    String(r.sku_label || ""),
  ]);
  const widths2 = hdrs.map((h, ci) =>
    Math.max(h.length, ...rows2.map((rr) => escapeCell(rr[ci]).length))
  );
  const padCell2 = (s, w) => escapeCell(s || "").padEnd(w, " ");
  const mdLines2 = [];
  mdLines2.push(
    `| ${hdrs.map((h, i) => padCell2(h, widths2[i])).join(" | ")} |`
  );
  const sep2 = widths2.map((w) => padCell2("-".repeat(Math.max(1, w)), w));
  mdLines2.push(`| ${sep2.join(" | ")} |`);
  rows2.forEach((rr) =>
    mdLines2.push(
      `| ${rr.map((c, i) => padCell2(c, widths2[i])).join(" | ")} |`
    )
  );
  try {
    await navigator.clipboard.writeText(mdLines2.join("\n"));
    setStatus(
      "Copied SKUs without overrides as Markdown to clipboard.",
      "success"
    );
  } catch (e) {
    console.error(e);
    setStatus("Clipboard copy failed.", "error");
  }
}

function closePreviewExportMenu() {
  const menu = el("previewExportMenu");
  const btn = el("previewExportBtn");
  if (menu) menu.style.display = "none";
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function exportPreviewNoOvrCsv() {
  // Prefer exporting the current preview table if present
  const tb = el("ovr_previewBody");
  const rows = tb ? Array.from(tb.querySelectorAll("tr")) : [];
  if (rows.length) {
    const csvLines = [
      "sn,item_code,item_name,qty,uom,wastage_pct,optional,remarks",
      ...rows.map((tr) => {
        const cells = tr.children;
        const vals = [0, 1, 2, 3, 4, 5, 6, 7].map(
          (i) =>
            `"${String((cells[i]?.textContent || "").replace(/"/g, '""'))}"`
        );
        return vals.join(",");
      }),
    ].join("\n");
    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preview_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  // Fallback: export SKUs without overrides
  const list = PREVIEW_LAST_NO_OVR || [];
  if (!list.length) return setStatus("No SKUs to export.", "info");
  const csv = [
    "sku_id,sku_label",
    ...list.map(
      (r) => `${r.sku_id},"${String(r.sku_label).replace(/"/g, '""')}"`
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `skus_without_overrides_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function previewUpdatePills() {
  try {
    // Use server RPC to get exact counts (no client fallback)
    let withCount = 0;
    let withoutCount = 0;
    const { data, error } = await supabase.rpc("rpc_plm_override_counts");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const total = Number(row?.total_skus ?? 0);
    withCount = Number(row?.with_overrides ?? 0);
    withoutCount = Number(
      row?.without_overrides ?? Math.max(0, total - withCount)
    );
    const withEl = el("previewPillWithCount");
    const withoutEl = el("previewPillWithoutCount");
    if (withEl) {
      withEl.textContent = String(withCount || 0);
      withEl.dataset.state = withCount ? "ok" : "empty";
    }
    if (withoutEl) {
      withoutEl.textContent = String(withoutCount || 0);
      withoutEl.dataset.state = withoutCount ? "ok" : "empty";
    }
  } catch (e) {
    console.error("previewUpdatePills failed", e);
  }
}

async function initPreviewTab() {
  if (PREVIEW_INIT_DONE) return;
  try {
    // wire buttons and modal handlers
    const previewNoOvrBtn = el("previewNoOvrBtn");
    const previewNoOvrModalEl = el("previewNoOvrModal");
    const previewNoOvrCloseBtnEl = el("previewNoOvrCloseBtn");
    const previewNoOvrCloseBottomBtnEl = el("previewNoOvrCloseBottomBtn");
    const previewNoOvrCopyBtnEl = el("previewNoOvrCopyBtn");
    const previewNoOvrExportBtnEl = el("previewNoOvrExportBtn");
    const previewExportBtnEl = el("previewExportBtn");
    const previewExportMenuEl = el("previewExportMenu");
    const previewExportCopyMdEl = el("previewExportCopyMd");
    const previewExportDownloadCsvEl = el("previewExportDownloadCsv");
    try {
      if (previewExportBtnEl) {
        previewExportBtnEl.style.display = "inline-flex";
        previewExportBtnEl.style.visibility = "visible";
        previewExportBtnEl.style.opacity = "1";
        previewExportBtnEl.style.pointerEvents = "auto";
        previewExportBtnEl.style.position = "relative";
        previewExportBtnEl.style.zIndex = "10000";
        // preview export button forced visible
      }
    } catch (err) {
      console.warn("previewExportBtn style set failed", err);
    }
    // Place the Export button inside the Preview pills bar (after No Overrides pill)
    try {
      const previewHeader = tabPanelPreview?.querySelector(".panel-header");
      const pillsBar = previewHeader?.querySelector(".erp-pills-bar");
      if (pillsBar && previewExportBtnEl) {
        // If previewNoOvrBtn exists in the same bar, insert after it
        if (previewNoOvrBtn && previewNoOvrBtn.parentElement === pillsBar) {
          pillsBar.insertBefore(
            previewExportBtnEl,
            previewNoOvrBtn.nextSibling
          );
        } else {
          pillsBar.appendChild(previewExportBtnEl);
        }
        // Reset any debug/absolute styles so it flows inline with pills
        previewExportBtnEl.style.position = "";
        previewExportBtnEl.style.right = "";
        previewExportBtnEl.style.top = "";
        previewExportBtnEl.style.zIndex = "";
        previewExportBtnEl.style.background = "";
        previewExportBtnEl.style.border = "";
        previewExportBtnEl.style.boxShadow = "";
        previewExportBtnEl.style.padding = "";
        previewExportBtnEl.style.fontWeight = "";
        previewExportBtnEl.style.display = "inline-flex";
        // previewExportBtn moved into pills bar
      }
    } catch (e) {
      console.warn("Failed to place previewExportBtn in pills bar", e);
    }
    // Ensure the export menu is next to the button and will float above other content
    try {
      if (previewExportMenuEl && previewExportBtnEl) {
        // Move menu to be immediately after the button so relative positioning works
        if (previewExportBtnEl.parentElement)
          previewExportBtnEl.parentElement.insertBefore(
            previewExportMenuEl,
            previewExportBtnEl.nextSibling
          );
        // Make menu float above and appear below the button
        previewExportMenuEl.style.position = "absolute";
        previewExportMenuEl.style.top = "100%";
        previewExportMenuEl.style.right = "0";
        previewExportMenuEl.style.zIndex = "30000";
        previewExportMenuEl.style.display = "none";
        previewExportMenuEl.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
        previewExportMenuEl.style.background = "#fff";
      }
    } catch (err) {
      console.warn("Failed to relocate previewExportMenuEl", err);
    }
    // Restore intended gray button styling so it matches the UI and is obvious
    try {
      if (previewExportBtnEl) {
        previewExportBtnEl.style.background = "#f3f4f6"; // light gray
        previewExportBtnEl.style.border = "1px solid #e5e7eb";
        previewExportBtnEl.style.color = "#111827";
      }
    } catch {
      /* ignore */
    }
    previewNoOvrBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      openPreviewNoOvrModal();
    });
    previewNoOvrCloseBtnEl?.addEventListener("click", closePreviewNoOvrModal);
    previewNoOvrCloseBottomBtnEl?.addEventListener(
      "click",
      closePreviewNoOvrModal
    );
    previewNoOvrCopyBtnEl?.addEventListener("click", (e) => {
      e.preventDefault();
      copyPreviewNoOvrToClipboard();
    });
    previewNoOvrExportBtnEl?.addEventListener("click", (e) => {
      e.preventDefault();
      exportPreviewNoOvrCsv();
    });
    // Export menu toggle and actions — position the menu with fixed positioning
    previewExportBtnEl?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!previewExportMenuEl || !previewExportBtnEl) return;
      const isOpen =
        previewExportMenuEl.style.display === "flex" ||
        previewExportMenuEl.style.display === "block";
      if (isOpen) return closePreviewExportMenu();

      // compute button position and size
      try {
        const rect = previewExportBtnEl.getBoundingClientRect();
        // ensure menu is measured and then position it fixed beneath the button
        previewExportMenuEl.style.position = "fixed";
        // prefer left-aligned under button; if would overflow viewport, adjust
        const menuWidth = previewExportMenuEl.offsetWidth || 200;
        let left = rect.left;
        if (left + menuWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - menuWidth - 8);
        }
        previewExportMenuEl.style.left = `${left}px`;
        previewExportMenuEl.style.top = `${rect.bottom + 6}px`;
        previewExportMenuEl.style.zIndex = "30000";
        previewExportMenuEl.style.display = "block";
        previewExportBtnEl.setAttribute("aria-expanded", "true");
      } catch {
        // fallback: simply show inline
        previewExportMenuEl.style.display = "flex";
        previewExportBtnEl.setAttribute("aria-expanded", "true");
      }

      // close when clicking outside
      const onDocClick = (ev) => {
        if (
          !previewExportMenuEl.contains(ev.target) &&
          ev.target !== previewExportBtnEl
        ) {
          closePreviewExportMenu();
          document.removeEventListener("click", onDocClick);
        }
      };
      // attach after event loop so this click doesn't immediately trigger closure
      setTimeout(() => document.addEventListener("click", onDocClick), 0);
    });
    previewExportCopyMdEl?.addEventListener("click", (e) => {
      e.preventDefault();
      copyPreviewNoOvrAsMarkdown();
      closePreviewExportMenu();
    });
    previewExportDownloadCsvEl?.addEventListener("click", (e) => {
      e.preventDefault();
      exportPreviewNoOvrCsv();
      closePreviewExportMenu();
    });
    previewNoOvrModalEl?.addEventListener("click", (e) => {
      if (e.target === previewNoOvrModalEl) closePreviewNoOvrModal();
    });
    // initial counts
    await previewUpdatePills();
    PREVIEW_INIT_DONE = true;
  } catch (e) {
    console.error("initPreviewTab failed", e);
  }
}

function populateMapUnmappedList(list) {
  const body = el("mapUnmappedList");
  if (!body) return;
  body.innerHTML = (list || [])
    .map((r, i) => {
      return `<tr><td style="text-align:center">${i + 1}</td><td>${escapeHtml(
        String(r.sku_label || "")
      )}</td><td style="text-align:center">${r.sku_id}</td></tr>`;
    })
    .join("");
}

async function openMapUnmappedModal() {
  const modal = el("mapUnmappedModal");
  if (!modal) return;
  try {
    showMask("Loading unmapped SKUs…");
    const list = await mapGetUnmappedSkus();
    // removed debug logging
    MAP_LAST_UNMAPPED = list;
    populateMapUnmappedList(list);
    const countText = el("mapUnmappedCountText");
    if (countText)
      countText.textContent = `${(list && list.length) || 0} unmapped`;
    modal.style.display = "flex";
  } catch (e) {
    console.error(e);
    setStatus(`Failed to load unmapped SKUs: ${e.message}`, "error");
  } finally {
    hideMask();
  }
}

function closeMapUnmappedModal() {
  const modal = el("mapUnmappedModal");
  if (!modal) return;
  modal.style.display = "none";
}

async function copyUnmappedToClipboard() {
  const list = MAP_LAST_UNMAPPED || (await mapGetUnmappedSkus());
  if (!list || !list.length)
    return setStatus("No unmapped SKUs to copy.", "info");
  const csv = [
    "sku_id,sku_label",
    ...list.map(
      (r) => `${r.sku_id},"${String(r.sku_label).replace(/"/g, '""')}"`
    ),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(csv);
    setStatus("Copied unmapped SKUs as CSV to clipboard.", "success");
  } catch (e) {
    console.error(e);
    setStatus("Clipboard copy failed.", "error");
  }
}

function exportUnmappedCsv() {
  const list = MAP_LAST_UNMAPPED || [];
  if (!list.length) return setStatus("No unmapped SKUs to export.", "info");
  const csv = [
    "sku_id,sku_label",
    ...list.map(
      (r) => `${r.sku_id},"${String(r.sku_label).replace(/"/g, '""')}"`
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `unmapped_skus_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function initMappingTab() {
  if (MAP_INIT_DONE) return;
  try {
    await mapLoadTemplates();
    await mapLoadMappedList();
    mapRefreshBtn?.addEventListener("click", mapLoadMappedList);
    mapRefreshBtn?.addEventListener("click", mapLoadMappedList);
    // Wire search input (debounced) to filter mapped rows by SKU label or ID
    if (mapSearchInput) {
      const debounce = (fn, ms = 250) => {
        let t = null;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...args), ms);
        };
      };
      mapSearchInput.addEventListener(
        "input",
        debounce((e) => {
          MAP_SEARCH_TERM = String(e.target.value || "");
          renderMappedRows();
        }, 200)
      );
    }
    // New Mapping modal handlers
    async function getUnmappedSkus() {
      const allRes = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id, sku_label");
      let mappedSet = MAP_MAPPED_SKUS;
      if (!mappedSet || mappedSet.size === 0) {
        const mappedRes = await supabase
          .from("plm_sku_pack_map")
          .select("sku_id");
        mappedSet = new Set(
          (mappedRes.data || []).map((r) => Number(r.sku_id))
        );
      }
      const all = (allRes.data || []).map((r) => ({
        sku_id: Number(r.sku_id),
        sku_label: r.sku_label,
      }));
      return all
        .filter((r) => !mappedSet.has(r.sku_id))
        .sort((a, b) => String(a.sku_label).localeCompare(String(b.sku_label)));
    }

    const openMapNewModal = async () => {
      if (!MAP_PERM_CAN_EDIT)
        return setStatus("No permission to edit.", "error");
      if (!mapNewModal) return;
      // Populate SKU with only unmapped SKUs, with placeholder
      if (mapNewSkuPicker) {
        try {
          const rows = await getUnmappedSkus();
          mapNewSkuPicker.innerHTML = [
            "<option value=''>Select SKU</option>",
            ...rows.map(
              (r) =>
                `<option value='${r.sku_id}'>${escapeHtml(
                  String(r.sku_label)
                )}</option>`
            ),
          ].join("");
          mapNewSkuPicker.value = "";
        } catch (e) {
          console.error(e);
          setStatus(`Failed to load SKUs: ${e.message}`, "error");
          mapNewSkuPicker.innerHTML = "<option value=''>Select SKU</option>";
          mapNewSkuPicker.value = "";
        }
      }
      // Populate Templates from cached options (no top-card picker)
      if (mapNewTplPicker) {
        if (MAP_TPL_OPTIONS_HTML) {
          // remove the reserved "— none —" empty option for selection list
          const cleaned = MAP_TPL_OPTIONS_HTML.replace(
            "<option value=''>— none —</option>",
            ""
          );
          mapNewTplPicker.innerHTML = [
            "<option value=''>Select Template</option>",
            cleaned,
          ].join("");
        } else {
          // fallback to TEMPLATES array if available
          mapNewTplPicker.innerHTML = [
            "<option value=''>Select Template</option>",
            ...(TEMPLATES || []).map(
              (t) =>
                `<option value='${t.tpl_id}'>${escapeHtml(
                  String(t.tpl_code)
                )}</option>`
            ),
          ].join("");
        }
        mapNewTplPicker.value = "";
      }
      mapNewModal.style.display = "flex";
      setTimeout(() => mapNewSkuPicker?.focus(), 0);
    };
    const closeMapNewModal = () => {
      if (mapNewModal) mapNewModal.style.display = "none";
    };
    mapNewBtn?.addEventListener("click", openMapNewModal);
    mapNewCloseBtn?.addEventListener("click", closeMapNewModal);
    mapNewCancelBtn?.addEventListener("click", closeMapNewModal);
    mapNewModal?.addEventListener("click", (e) => {
      if (e.target === mapNewModal) closeMapNewModal();
    });
    mapNewCreateBtn?.addEventListener("click", async () => {
      if (!MAP_PERM_CAN_EDIT)
        return setStatus("No permission to edit.", "error");
      const skuId = parseInt(mapNewSkuPicker?.value || "", 10);
      const tplId = parseInt(mapNewTplPicker?.value || "", 10);
      if (!skuId || !tplId)
        return setStatus("Select both SKU and Template.", "error");
      const { error } = await supabase.rpc("rpc_plm_map_set", {
        p_sku_id: skuId,
        p_tpl_id: tplId,
      });
      if (error)
        return setStatus(`Set mapping failed: ${error.message}`, "error");
      setStatus("Mapping saved.", "success");
      closeMapNewModal();
      await mapLoadMappedList();
    });
    // top-card Set/Clear mapping handlers removed (controls deleted from HTML)
    applyMappingPermissions();
    // Wire unmapped modal/pill handlers
    const mapUnmappedBtnEl = el("mapUnmappedBtn");
    const mapUnmappedModalEl = el("mapUnmappedModal");
    const mapUnmappedCloseBtnEl = el("mapUnmappedCloseBtn");
    const mapUnmappedCloseBottomBtnEl = el("mapUnmappedCloseBottomBtn");
    const mapUnmappedCopyBtnEl = el("mapUnmappedCopyBtn");
    const mapUnmappedExportBtnEl = el("mapUnmappedExportBtn");
    mapUnmappedBtnEl?.addEventListener("click", (e) => {
      e.preventDefault();
      openMapUnmappedModal();
    });
    mapUnmappedCloseBtnEl?.addEventListener("click", closeMapUnmappedModal);
    mapUnmappedCloseBottomBtnEl?.addEventListener(
      "click",
      closeMapUnmappedModal
    );
    mapUnmappedCopyBtnEl?.addEventListener("click", (e) => {
      e.preventDefault();
      copyUnmappedToClipboard();
    });
    mapUnmappedExportBtnEl?.addEventListener("click", (e) => {
      e.preventDefault();
      exportUnmappedCsv();
    });
    mapUnmappedModalEl?.addEventListener("click", (e) => {
      if (e.target === mapUnmappedModalEl) closeMapUnmappedModal();
    });
    // Mapping view/edit toggle handlers
    mapViewBtn?.addEventListener("click", () => {
      MAP_EDIT_MODE = false;
      applyMapMode();
    });
    mapEditBtn?.addEventListener("click", () => {
      if (!MAP_PERM_CAN_EDIT)
        return setStatus("No permission to edit.", "error");
      // Show ERP-style loading mask immediately to avoid perceived lag
      showMask("Preparing edit view…");
      // Allow mask to render before heavy DOM updates
      setTimeout(() => {
        MAP_EDIT_MODE = true;
        applyMapMode();
        hideMask();
      }, 30);
    });
    mapSaveBtn?.addEventListener("click", mapSaveAll);
    mapCancelBtn?.addEventListener("click", mapCancelEdits);
    // default to view mode
    MAP_EDIT_MODE = false;
    applyMapMode();
    MAP_INIT_DONE = true;
    // Ensure native select dropdowns open downward by creating space
    // when a select receives focus or mousedown (useful on small viewports).
    const ensureDropdownSpace = (sel) => {
      if (!sel) return;
      const scroll = document.getElementById("mapScroll");
      const rect = sel.getBoundingClientRect();
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportH - rect.bottom;
      if (spaceBelow >= 160) return; // enough space already
      if (scroll) {
        // compute vertical offset of select inside scroll container
        const scrollRect = scroll.getBoundingClientRect();
        const offsetTop = rect.top - scrollRect.top + scroll.scrollTop;
        // target scroll so the select is positioned a bit above center
        const target = Math.max(
          0,
          offsetTop - Math.floor(scroll.clientHeight / 3)
        );
        // smooth scroll by amount needed (but not too large)
        try {
          scroll.scrollTo({ top: target, behavior: "smooth" });
        } catch {
          scroll.scrollTop = target;
        }
      } else {
        // fallback: scroll window to bring element up
        const targetWin = Math.max(
          0,
          window.scrollY + rect.top - Math.floor(viewportH / 3)
        );
        window.scrollTo({ top: targetWin, behavior: "smooth" });
      }
    };
    // Attach delegated listeners to handle focus/click on selects inside mapped body
    mapMappedBody?.addEventListener("focusin", (ev) => {
      const sel =
        ev.target.closest && ev.target.closest("select.map-tpl-select");
      if (sel) ensureDropdownSpace(sel);
    });
    mapMappedBody?.addEventListener("mousedown", (ev) => {
      const sel =
        ev.target.closest && ev.target.closest("select.map-tpl-select");
      if (sel) ensureDropdownSpace(sel);
    });
  } catch (err) {
    console.error(err);
    setStatus(`Mapping init error: ${err.message}`, "error");
  }
}

async function loadTemplateHeader(tplId) {
  const { data, error } = await supabase
    .from("plm_tpl_header")
    .select(
      "id, code, reference_output_qty, reference_output_uom_id, process_loss_pct"
    )
    .eq("id", tplId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data;
}

async function loadTemplateLines(tplId) {
  // Prefer RPC which returns resolved uom code and names
  const { data, error } = await supabase.rpc("rpc_plm_tpl_list_lines", {
    p_tpl_id: tplId,
  });
  if (error) throw error;
  // Expect fields: id, stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks (plus names)
  const normalized = (data || []).map((r) => {
    let uomId = r.uom_id ?? null;
    if (uomId == null && r.uom_code) {
      const match = UOMS.find(
        (u) => u.code?.toLowerCase?.() === String(r.uom_code).toLowerCase()
      );
      if (match) uomId = match.id;
    }
    return {
      id: r.id ?? r.line_id ?? null,
      stock_item_id: r.stock_item_id ?? null,
      qty_per_reference_output: r.qty_per_reference_output ?? null,
      uom_id: uomId,
      wastage_pct: r.wastage_pct ?? null,
      is_optional: !!r.is_optional,
      remarks: r.remarks || "",
    };
  });
  CURRENT_LINES = normalized.length ? normalized : [blankLine()];
}

function getItemCode(id) {
  const it = STOCK_ITEMS.find((x) => x.id === id);
  return it?.code || "";
}

function renderLines() {
  linesBody.innerHTML = CURRENT_LINES.map((ln, i) => {
    if (!LINES_EDIT_MODE) {
      const itemCode = getItemCode(ln.stock_item_id);
      const itemName = getItemNameById(ln.stock_item_id);
      const uomCode = getUomCodeById(ln.uom_id);
      const qtyStr =
        ln.qty_per_reference_output == null
          ? ""
          : String(ln.qty_per_reference_output);
      const wastStr = (() => {
        if (ln.wastage_pct == null) return "";
        const raw = Number(ln.wastage_pct);
        const pct = raw <= 1.5 ? raw * 100 : raw;
        return `${pct.toFixed(2)}%`;
      })();
      const optStr = ln.is_optional ? "Yes" : "No";
      const remStr = escapeHtml(ln.remarks || "");
      return `
      <tr data-i="${i}">
        <td class="nowrap" data-col="sn">${i + 1}</td>
        <td class="nowrap code-cell" data-col="code">${escapeHtml(
          itemCode
        )}</td>
        <td class="item-cell" data-col="item">${escapeHtml(itemName)}</td>
        <td class="right" data-col="qty">${escapeHtml(qtyStr)}</td>
        <td data-col="uom">${escapeHtml(uomCode)}</td>
        <td class="right" data-col="wast">${escapeHtml(wastStr)}</td>
        <td data-col="opt">${optStr}</td>
        <td data-col="rem">${remStr}</td>
        <td></td>
      </tr>`;
    }
    const itemOptions = [
      "<option value=''>— select —</option>",
      ...STOCK_ITEMS.map(
        (x) =>
          `<option value='${x.id}' ${
            x.id === ln.stock_item_id ? "selected" : ""
          }>${escapeHtml(x.name)}</option>`
      ),
    ].join("");
    const uomOptions = [
      "<option value=''>— select —</option>",
      ...UOMS.map(
        (u) =>
          `<option value='${u.id}' ${u.id === ln.uom_id ? "selected" : ""}>${
            u.code
          }</option>`
      ),
    ].join("");
    const itemCode = getItemCode(ln.stock_item_id);
    return `
    <tr data-i="${i}">
      <td class="nowrap" data-col="sn">${i + 1}</td>
      <td class="nowrap code-cell" data-col="code">${escapeHtml(itemCode)}</td>
      <td class="item-cell"><select class="cell item">${itemOptions}</select></td>
      <td class="right" data-col="qty"><input class="cell qty" type="number" step="0.0001" min="0" value="${
        ln.qty_per_reference_output ?? ""
      }"/></td>
      <td data-col="uom"><select class="cell uom">${uomOptions}</select></td>
      <td class="right" data-col="wast"><input class="cell wast" type="number" step="0.0001" min="0" max="0.9999" value="${
        ln.wastage_pct ?? ""
      }"/></td>
      <td data-col="opt"><input type="checkbox" class="cell opt" ${
        ln.is_optional ? "checked" : ""
      }/></td>
      <td data-col="rem"><input type="text" class="cell rem" value="${escapeHtml(
        ln.remarks || ""
      )}"/></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn small" data-act="up" title="Move up" aria-label="Move up">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="icon-btn small" data-act="down" title="Move down" aria-label="Move down">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="icon-btn small" data-act="insAbove" title="Insert rows above" aria-label="Insert rows above">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v8"/><path d="M8 9h8"/></svg>
          </button>
          <button class="icon-btn small" data-act="insBelow" title="Insert rows below" aria-label="Insert rows below">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v-8"/><path d="M8 15h8"/></svg>
          </button>
          <button class="icon-btn small" data-act="del" title="Delete row" aria-label="Delete row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join("");
  // After rendering rows, enforce disabled state in view-mode or when no edit permission
  const disable = !LINES_EDIT_MODE || !PERM_CAN_EDIT;
  const inputs = linesBody.querySelectorAll(
    "select.cell, input.cell, input[type='checkbox'].cell, input[type='text'].cell"
  );
  inputs.forEach((el) => {
    el.disabled = !!disable;
    if (el.tagName === "INPUT" && el.type === "text") {
      el.readOnly = !!disable;
    }
  });
  // Update sticky header shadow and sync horizontal scroll
  const scrollWrap = linesScroll;
  if (scrollWrap) {
    if (!scrollWrap.dataset.shadowBound) {
      scrollWrap.addEventListener("scroll", () => {
        if (scrollWrap.scrollTop > 2) scrollWrap.classList.add("scrolled");
        else scrollWrap.classList.remove("scrolled");
        if (!_hSyncing && linesHScrollTop) {
          _hSyncing = true;
          linesHScrollTop.scrollLeft = scrollWrap.scrollLeft;
          _hSyncing = false;
        }
        if (linesBackToTop) {
          if (scrollWrap.scrollTop > 120) linesBackToTop.classList.add("show");
          else linesBackToTop.classList.remove("show");
        }
      });
      scrollWrap.dataset.shadowBound = "1";
    }
    if (scrollWrap.scrollTop > 2) scrollWrap.classList.add("scrolled");
    else scrollWrap.classList.remove("scrolled");
    if (linesBackToTop) {
      if (scrollWrap.scrollTop > 120) linesBackToTop.classList.add("show");
      else linesBackToTop.classList.remove("show");
    }
  }
  setupHorizontalScrollSync();
  updateSelectionPills();
}

/* ---------------- Selection UI (view mode) - Complete Implementation ---------------- */
// make `linesBody` focusable so we can move focus off individual cells when needed
if (linesBody && typeof linesBody.setAttribute === "function")
  linesBody.tabIndex = -1;

// Column ordering used for rectangle selection and arrow navigation
const COL_ORDER = ["sn", "code", "item", "qty", "uom", "wast", "opt", "rem"];
function getColIndex(col) {
  return COL_ORDER.indexOf(col);
}
function getColByIndex(idx) {
  return COL_ORDER[Math.max(0, Math.min(COL_ORDER.length - 1, idx))];
}

function cellKey(i, col) {
  return `${i}:${col}`;
}
function parseCellKey(k) {
  const [sI, col] = String(k).split(":");
  return { i: parseInt(sI, 10), col };
}

function isNumericColumn(col) {
  return col === "qty" || col === "wast";
}

function getCellValue(i, col) {
  const ln = CURRENT_LINES[i];
  if (!ln) return null;
  if (col === "qty")
    return ln.qty_per_reference_output == null
      ? null
      : Number(ln.qty_per_reference_output);
  if (col === "wast") {
    if (ln.wastage_pct == null) return null;
    const raw = Number(ln.wastage_pct);
    return raw <= 1.5 ? raw * 100 : raw; // return percent
  }
  if (col === "code") return getItemCode(ln.stock_item_id) || "";
  if (col === "item") return getItemNameById(ln.stock_item_id) || "";
  if (col === "uom") return getUomCodeById(ln.uom_id) || "";
  if (col === "opt") return ln.is_optional ? "Yes" : "No";
  if (col === "rem") return ln.remarks || "";
  if (col === "sn") return i + 1;
  return null;
}

// Selection state
let SELECTED_CELLS = new Set();
let LAST_SELECTED = null; // {i, col}
let ANCHOR = null; // {i, col}
let SELECTION_OP = false;
let LAST_DRAG_AT = 0;
let LAST_DRAG_POS = null;

function clearSelection() {
  SELECTED_CELLS.clear();
  ANCHOR = null;
  LAST_SELECTED = null;
  refreshSelectionVisuals();
  updateSelectionPills();
}

function refreshSelectionVisuals() {
  const isSelected = (r, c) => SELECTED_CELLS.has(cellKey(r, c));
  Array.from(linesBody.querySelectorAll("td[data-col]")).forEach((td) => {
    const tr = td.closest("tr[data-i]");
    const i = tr ? parseInt(tr.dataset.i, 10) : null;
    const col = td.dataset.col;
    if (!Number.isFinite(i) || !col) return;
    const k = cellKey(i, col);
    const selected = SELECTED_CELLS.has(k);
    td.classList.remove(
      "cell-selected",
      "sel-t",
      "sel-b",
      "sel-l",
      "sel-r",
      "cell-active",
      "cell-focused"
    );
    if (selected) {
      td.classList.add("cell-selected");
      const upSel = isSelected(i - 1, col);
      const downSel = isSelected(i + 1, col);
      const leftCol = getColByIndex(getColIndex(col) - 1);
      const rightCol = getColByIndex(getColIndex(col) + 1);
      const leftSel = leftCol ? isSelected(i, leftCol) : false;
      const rightSel = rightCol ? isSelected(i, rightCol) : false;
      if (!upSel) td.classList.add("sel-t");
      if (!downSel) td.classList.add("sel-b");
      if (!leftSel) td.classList.add("sel-l");
      if (!rightSel) td.classList.add("sel-r");
    }
    td.setAttribute("aria-selected", selected ? "true" : "false");
    td.setAttribute("role", "gridcell");
    td.setAttribute("aria-rowindex", String(i + 1));
    td.setAttribute("aria-colindex", String(getColIndex(col) + 1));
    td.tabIndex = 0;
    if (tr) tr.setAttribute("role", "row");
  });
  if (LAST_SELECTED) {
    const lastEl = linesBody.querySelector(
      `tr[data-i='${LAST_SELECTED.i}'] td[data-col='${LAST_SELECTED.col}']`
    );
    if (lastEl) {
      lastEl.classList.add("cell-active");
      try {
        lastEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (err) {
        void err;
      }
    }
  }
}

function getNeighborCoords(i, col) {
  const idx = getColIndex(col);
  const neighbors = [];
  neighbors.push({ i: i - 1, col });
  neighbors.push({ i: i + 1, col });
  if (idx - 1 >= 0) neighbors.push({ i, col: getColByIndex(idx - 1) });
  if (idx + 1 < COL_ORDER.length)
    neighbors.push({ i, col: getColByIndex(idx + 1) });
  return neighbors;
}

function getConnectedComponent(anchor) {
  if (!anchor) return new Set();
  const startKey = cellKey(anchor.i, anchor.col);
  if (!SELECTED_CELLS.has(startKey)) return new Set([startKey]);
  const visited = new Set();
  const q = [anchor];
  while (q.length) {
    const cur = q.shift();
    const k = cellKey(cur.i, cur.col);
    if (visited.has(k)) continue;
    if (!SELECTED_CELLS.has(k)) continue;
    visited.add(k);
    const neigh = getNeighborCoords(cur.i, cur.col);
    for (const n of neigh) {
      const nk = cellKey(n.i, n.col);
      if (!visited.has(nk) && SELECTED_CELLS.has(nk)) q.push(n);
    }
  }
  return visited;
}

function componentBottomRight(component) {
  let maxI = -Infinity;
  let maxColIdx = -Infinity;
  for (const k of component) {
    const { i, col } = parseCellKey(k);
    if (i > maxI) maxI = i;
    const cidx = getColIndex(col);
    if (cidx > maxColIdx) maxColIdx = cidx;
  }
  if (maxI === -Infinity) return null;
  return { i: maxI, col: getColByIndex(maxColIdx) };
}

function selectRectangle(a, b, additive = false) {
  if (!a || !b) return;
  const r1 = Math.min(a.i, b.i);
  const r2 = Math.max(a.i, b.i);
  const c1 = Math.min(getColIndex(a.col), getColIndex(b.col));
  const c2 = Math.max(getColIndex(a.col), getColIndex(b.col));
  if (!additive) SELECTED_CELLS.clear();
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const col = getColByIndex(c);
      SELECTED_CELLS.add(cellKey(r, col));
    }
  }
  refreshSelectionVisuals();
  updateSelectionPills();
}

// Selection pills update function
function updateSelectionPills() {
  if (!selectionPills) return;
  const totalLines = CURRENT_LINES.length;
  const selCount = SELECTED_CELLS.size;
  const cols = new Map();
  for (const k of SELECTED_CELLS) {
    const { i, col } = parseCellKey(k);
    if (!cols.has(col)) cols.set(col, []);
    cols.get(col).push(i);
  }
  const parts = [];

  parts.push(
    `<div class="erp-pill-chip small"><span class="pill-seg title"><span class="title-text">Lines</span></span><span class="pill-seg value">${totalLines}</span></div>`
  );
  if (selCount) {
    parts.push(
      `<div class="erp-pill-chip small" title="Selected cells"><span class="pill-seg title"><span class="title-text">Selected</span></span><span class="pill-seg value">${selCount}</span></div>`
    );
    if (cols.size === 1) {
      const col = Array.from(cols.keys())[0];
      if (isNumericColumn(col)) {
        const vals = cols
          .get(col)
          .map((r) => getCellValue(r, col))
          .filter((v) => Number.isFinite(v));
        if (vals.length) {
          const sum = vals.reduce((a, b) => a + b, 0);
          const avg = sum / vals.length;
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          parts.push(
            `<div class="erp-pill-chip small" title="Sum"><span class="pill-seg title"><span class="title-text">Sum</span></span><span class="pill-seg value">${sum.toFixed(
              3
            )}</span></div>`
          );
          parts.push(
            `<div class="erp-pill-chip small" title="Avg"><span class="pill-seg title"><span class="title-text">Avg</span></span><span class="pill-seg value">${avg.toFixed(
              3
            )}</span></div>`
          );
          parts.push(
            `<div class="erp-pill-chip small" title="Min"><span class="pill-seg title"><span class="title-text">Min</span></span><span class="pill-seg value">${min.toFixed(
              3
            )}</span></div>`
          );
          parts.push(
            `<div class="erp-pill-chip small" title="Max"><span class="pill-seg title"><span class="title-text">Max</span></span><span class="pill-seg value">${max.toFixed(
              3
            )}</span></div>`
          );
        }
      } else {
        const uniq = new Set(
          cols.get(col).map((r) => String(getCellValue(r, col)))
        );
        parts.push(
          `<div class="erp-pill-chip small" title="Unique values"><span class="pill-seg title"><span class="title-text">Unique</span></span><span class="pill-seg value">${uniq.size}</span></div>`
        );
      }
    } else if (cols.size > 1) {
      for (const [col, rows] of cols) {
        parts.push(
          `<div class="erp-pill-chip small" title="${col}"><span class="pill-seg title"><span class="title-text">${col}</span></span><span class="pill-seg value">${rows.length}</span></div>`
        );
      }
    }
    parts.push(
      `<button id="selCopyBtn" class="btn ghost" title="Copy selection" style="padding:6px 8px">Copy</button>`
    );
    parts.push(
      `<button id="selCsvBtn" class="btn ghost" title="Export selection CSV" style="padding:6px 8px">Export CSV</button>`
    );
    parts.push(
      `<button id="selClearBtn" class="btn ghost" title="Clear selection" style="padding:6px 8px">Clear</button>`
    );
  }
  selectionPills.innerHTML = parts.join("");
  const copyBtn = document.getElementById("selCopyBtn");
  const csvBtn = document.getElementById("selCsvBtn");
  const clearBtn = document.getElementById("selClearBtn");
  if (copyBtn) copyBtn.addEventListener("click", copySelection);
  if (csvBtn) csvBtn.addEventListener("click", exportSelectionCsv);
  if (clearBtn)
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearSelection();
    });
}

// Export selection as text
function formatDateStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, "_");
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copySelection() {
  if (!SELECTED_CELLS.size) return;
  const lines = ["Row,Column,Value"];
  for (const k of SELECTED_CELLS) {
    const { i, col } = parseCellKey(k);
    const v = getCellValue(i, col);
    lines.push(`${i + 1},${col},"${String(v ?? "").replace(/"/g, '""')}"`);
  }
  const text = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => setStatus("Copied selection to clipboard.", "success", 1400));
  } else {
    setStatus("Clipboard unavailable.", "error", 2000);
  }
}

function exportSelectionCsv() {
  if (!SELECTED_CELLS.size) return;
  const rows = [["Row", "Column", "Value"]];
  for (const k of SELECTED_CELLS) {
    const { i, col } = parseCellKey(k);
    const v = getCellValue(i, col);
    rows.push([String(i + 1), col, v == null ? "" : String(v)]);
  }
  const esc = (s) => {
    const ss = s == null ? "" : String(s);
    if (/[",\n]/.test(ss)) return `"${ss.replace(/"/g, '""')}"`;
    return ss;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const filename = `selection_${formatDateStamp()}.csv`;
  downloadBlob(csv, "text/csv;charset=utf-8", filename);
  setStatus("Selection exported.", "success", 1400);
}

// Mouse/keyboard selection handling
function getTdFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest("td[data-col]") : null;
}

// Prevent native select during selection operations
document.addEventListener("selectstart", (e) => {
  if (SELECTION_OP) e.preventDefault();
});

// Drag selection
linesBody.addEventListener("mousedown", (e) => {
  if (LINES_EDIT_MODE) return;
  if (e.button !== 0) return; // left button only
  const td = e.target.closest("td[data-col]");
  if (!td) return;
  if (e.shiftKey || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  const tr = td.closest("tr[data-i]");
  const i = parseInt(tr.dataset.i, 10);
  const col = td.dataset.col;
  if (!Number.isFinite(i) || !col) return;
  ANCHOR = { i, col };
  LAST_SELECTED = { i, col };
  selectRectangle(ANCHOR, ANCHOR, false);
  SELECTION_OP = true;
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  const onMove = (ev) => {
    const ctd = getTdFromPoint(ev.clientX, ev.clientY);
    if (!ctd) return;
    const ctr = ctd.closest("tr[data-i]");
    const ci = parseInt(ctr.dataset.i, 10);
    const ccol = ctd.dataset.col;
    if (!Number.isFinite(ci) || !ccol) return;
    selectRectangle(ANCHOR, { i: ci, col: ccol }, false);
    LAST_SELECTED = { i: ci, col: ccol };
  };
  const onUp = (ev) => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    SELECTION_OP = false;
    document.body.style.userSelect = prevUserSelect || "";
    refreshSelectionVisuals();
    updateSelectionPills();
    LAST_DRAG_AT = Date.now();
    LAST_DRAG_POS = { x: ev.clientX, y: ev.clientY };
    setTimeout(() => {
      LAST_DRAG_AT = 0;
      LAST_DRAG_POS = null;
    }, 300);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
});

// Click / Ctrl / Shift handling
linesBody.addEventListener("click", (e) => {
  if (LINES_EDIT_MODE) return;
  const td = e.target.closest("td[data-col]");
  if (!td) return;
  const tr = td.closest("tr[data-i]");
  if (!tr) return;
  const i = parseInt(tr.dataset.i, 10);
  const col = td.dataset.col;
  if (!Number.isFinite(i) || !col) return;
  const coord = { i, col };

  try {
    window.getSelection()?.removeAllRanges();
  } catch (err) {
    void err;
  }

  if (LAST_DRAG_AT && Date.now() - LAST_DRAG_AT < 300) {
    if (LAST_DRAG_POS) {
      const dx = Math.abs((e.clientX || 0) - LAST_DRAG_POS.x);
      const dy = Math.abs((e.clientY || 0) - LAST_DRAG_POS.y);
      if (dx < 6 && dy < 6) return;
    }
  }

  const resolveAnchor = () => {
    if (ANCHOR) return ANCHOR;
    if (LAST_SELECTED) return LAST_SELECTED;
    if (SELECTED_CELLS.size) {
      const first = SELECTED_CELLS.values().next().value;
      if (first) return parseCellKey(first);
    }
    return null;
  };

  if (e.shiftKey) {
    const base = resolveAnchor();
    if (base) {
      const additive = e.ctrlKey || e.metaKey;
      selectRectangle(base, coord, additive);
      if (additive) {
        const comp = getConnectedComponent(ANCHOR || base || coord);
        const br = componentBottomRight(comp);
        if (br) LAST_SELECTED = br;
      } else {
        LAST_SELECTED = coord;
        ANCHOR = base;
      }
      refreshSelectionVisuals();
      updateSelectionPills();
      try {
        td.blur && td.blur();
      } catch (err) {
        void err;
      }
      return;
    }
  }

  if (e.ctrlKey || e.metaKey) {
    const k = cellKey(i, col);
    const had = SELECTED_CELLS.has(k);
    const domHas =
      td.classList.contains("cell-selected") ||
      td.classList.contains("cell-active");
    const treatAsHad = had || (!had && domHas);
    if (treatAsHad) SELECTED_CELLS.delete(k);
    else SELECTED_CELLS.add(k);

    if (SELECTED_CELLS.size === 0) {
      ANCHOR = null;
      LAST_SELECTED = null;
      refreshSelectionVisuals();
      updateSelectionPills();
      return;
    }

    const beforeSize = SELECTED_CELLS.size;
    if (beforeSize === 1) {
      ANCHOR = coord;
      LAST_SELECTED = coord;
    } else {
      if (ANCHOR && !SELECTED_CELLS.has(cellKey(ANCHOR.i, ANCHOR.col))) {
        const first = SELECTED_CELLS.values().next().value;
        ANCHOR = first ? parseCellKey(first) : null;
      }
      const comp = getConnectedComponent(ANCHOR || LAST_SELECTED || coord);
      const br = componentBottomRight(comp);
      if (br) LAST_SELECTED = br;
    }
    refreshSelectionVisuals();
    updateSelectionPills();
    return;
  }

  // Simple click: single select
  SELECTED_CELLS.clear();
  SELECTED_CELLS.add(cellKey(i, col));
  ANCHOR = coord;
  LAST_SELECTED = coord;
  refreshSelectionVisuals();
  updateSelectionPills();
});

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (LINES_EDIT_MODE) return;
  const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const specials = ["Home", "End"];
  if (e.key === "Escape") {
    if (SELECTED_CELLS.size) clearSelection();
    return;
  }
  if (!arrows.includes(e.key) && !specials.includes(e.key)) return;
  const focused = LAST_SELECTED || ANCHOR;
  if (!focused) return;
  e.preventDefault();
  let target = { i: focused.i, col: focused.col };
  const colIdx = getColIndex(focused.col);

  if (e.key === "Home") {
    if (e.ctrlKey) {
      target.i = 0;
      target.col = getColByIndex(0);
    } else {
      target.col = getColByIndex(0);
    }
  }
  if (e.key === "End") {
    if (e.ctrlKey) {
      target.i = Math.max(0, CURRENT_LINES.length - 1);
      target.col = getColByIndex(COL_ORDER.length - 1);
    } else {
      target.col = getColByIndex(COL_ORDER.length - 1);
    }
  }
  if (arrows.includes(e.key)) {
    if (e.key === "ArrowUp") {
      target.i = e.ctrlKey ? 0 : Math.max(0, focused.i - 1);
    }
    if (e.key === "ArrowDown") {
      target.i = e.ctrlKey
        ? Math.min(CURRENT_LINES.length - 1, CURRENT_LINES.length - 1)
        : Math.min(CURRENT_LINES.length - 1, focused.i + 1);
    }
    if (e.key === "ArrowLeft") {
      target.col = getColByIndex(e.ctrlKey ? 0 : Math.max(0, colIdx - 1));
    }
    if (e.key === "ArrowRight") {
      target.col = getColByIndex(
        e.ctrlKey
          ? COL_ORDER.length - 1
          : Math.min(COL_ORDER.length - 1, colIdx + 1)
      );
    }
  }

  if (e.shiftKey) {
    const base = ANCHOR || focused;
    selectRectangle(base, target, !!e.ctrlKey);
    LAST_SELECTED = target;
    refreshSelectionVisuals();
    updateSelectionPills();
  } else if (e.ctrlKey || e.metaKey) {
    if (!e.shiftKey) {
      SELECTED_CELLS.clear();
      SELECTED_CELLS.add(cellKey(target.i, target.col));
      ANCHOR = target;
      LAST_SELECTED = target;
      refreshSelectionVisuals();
      updateSelectionPills();
    } else {
      ANCHOR = target;
      LAST_SELECTED = target;
      refreshSelectionVisuals();
    }
  } else {
    SELECTED_CELLS.clear();
    SELECTED_CELLS.add(cellKey(target.i, target.col));
    ANCHOR = target;
    LAST_SELECTED = target;
    refreshSelectionVisuals();
    updateSelectionPills();
  }
});

function setupHorizontalScrollSync() {
  if (!linesScroll || !linesHScrollTop || !linesHScrollInner) return;
  const needH = linesScroll.scrollWidth > linesScroll.clientWidth + 1;
  if (needH) {
    linesHScrollTop.classList.add("visible");
    linesHScrollInner.style.width = `${linesScroll.scrollWidth}px`;
  } else {
    linesHScrollTop.classList.remove("visible");
    linesHScrollInner.style.width = "0px";
  }
  if (!linesHScrollTop.dataset.bound) {
    linesHScrollTop.addEventListener("scroll", () => {
      if (_hSyncing) return;
      _hSyncing = true;
      linesScroll.scrollLeft = linesHScrollTop.scrollLeft;
      _hSyncing = false;
    });
    linesHScrollTop.dataset.bound = "1";
  }
}

// Back-to-top action
linesBackToTop?.addEventListener("click", () => {
  if (!linesScroll) return;
  linesScroll.scrollTo({ top: 0, behavior: "smooth" });
});

function formatRefOutputPill() {
  const qty = refQty?.value === "" ? null : parseFloat(refQty.value);
  const uomId = refUom?.value ? parseInt(refUom.value, 10) : null;
  const uomCode = UOMS.find((u) => u.id === uomId)?.code || "";
  const elVal = document.getElementById("pillRefOutput");
  if (!elVal) return;
  if (qty && uomCode) {
    elVal.textContent = `${qty} ${uomCode}`;
    elVal.dataset.state = "";
  } else {
    elVal.textContent = "—";
    elVal.dataset.state = "empty";
  }
}

function formatLossPctPill() {
  const p = lossPct?.value === "" ? null : parseFloat(lossPct.value);
  const elVal = document.getElementById("pillLossPct");
  if (!elVal) return;
  if (p != null && !Number.isNaN(p)) {
    elVal.textContent = `${p.toFixed(2)}%`;
    elVal.dataset.state = "";
  } else {
    elVal.textContent = "—";
    elVal.dataset.state = "empty";
  }
}

function syncHeaderPills() {
  formatRefOutputPill();
  formatLossPctPill();
}

function collectHeader() {
  const q = refQty.value === "" ? null : parseFloat(refQty.value);
  const u = refUom.value ? parseInt(refUom.value, 10) : null;
  const p = lossPct.value === "" ? null : parseFloat(lossPct.value);
  return {
    reference_output_qty: q,
    reference_output_uom_id: u,
    process_loss_pct_display: p,
  };
}

function collectLines() {
  return Array.from(linesBody.querySelectorAll("tr[data-i]"))
    .map((tr) => parseInt(tr.dataset.i, 10))
    .map((i) => ({ ...CURRENT_LINES[i] }));
}

function updateExportVisibility() {
  // Visible only when a template is selected and user has permission
  const canShow = !!CURRENT_TPL_ID && PERM_CAN_VIEW && PERM_CAN_EDIT;
  if (exportBtn) exportBtn.style.display = canShow ? "" : "none";
  if (!canShow && exportMenu) {
    exportMenu.classList.remove("open");
    exportBtn?.setAttribute("aria-expanded", "false");
  }
  // Reload available to viewers too (no edit required)
  const canShowReload = !!CURRENT_TPL_ID && PERM_CAN_VIEW;
  if (reloadBtn) reloadBtn.style.display = canShowReload ? "" : "none";
  // Save visible only when a template is selected and user can edit
  const canShowSave = !!CURRENT_TPL_ID && PERM_CAN_EDIT;
  if (saveBtn) saveBtn.style.display = canShowSave ? "" : "none";
  // Kebab items enable/disable
  if (editTplBtn) editTplBtn.disabled = !(PERM_CAN_EDIT && !!CURRENT_TPL_ID);
  if (renumberBtn) renumberBtn.disabled = !CURRENT_TPL_ID;
  if (newTplBtn) newTplBtn.disabled = !PERM_CAN_EDIT;
  if (deleteTplBtn)
    deleteTplBtn.disabled = !(PERM_CAN_EDIT && !!CURRENT_TPL_ID);
}

/* ---------- Export helpers ---------- */
function getUomCodeById(id) {
  const u = UOMS.find((x) => x.id === id);
  return u?.code || "";
}

function getItemNameById(id) {
  const it = STOCK_ITEMS.find((x) => x.id === id);
  return it?.name || (id ? `Item #${id}` : "");
}

function buildExportSnapshot() {
  const code = (tplCode?.value || "").trim();
  const header = collectHeader();
  const refUomCode = getUomCodeById(header.reference_output_uom_id);
  const lossDisp = header.process_loss_pct_display;
  const lines = collectLines();
  const rows = lines.map((ln, i) => {
    const uomCode = getUomCodeById(ln.uom_id);
    const itemCode = getItemCode(ln.stock_item_id);
    const itemName = getItemNameById(ln.stock_item_id);
    const wastPct =
      ln.wastage_pct == null
        ? ""
        : (Number(ln.wastage_pct) <= 1.5
            ? Number(ln.wastage_pct) * 100
            : Number(ln.wastage_pct)
          ).toFixed(2);
    return {
      sn: i + 1,
      itemCode,
      itemName,
      qtyPerRef: ln.qty_per_reference_output ?? "",
      uom: uomCode,
      wastagePct: wastPct,
      optional: ln.is_optional ? "Yes" : "No",
      remarks: ln.remarks || "",
    };
  });
  return {
    code,
    refOutput: header.reference_output_qty,
    refUomCode,
    lossPct: lossDisp,
    rows,
  };
}

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// downloadBlob function defined earlier for selection export

function exportAsCsv() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_TPL_ID) {
    setStatus("Select a template to export.", "error");
    return;
  }
  const snap = buildExportSnapshot();
  const headerLines = [
    ["Template", snap.code],
    [
      "Reference Output",
      snap.refOutput != null && snap.refUomCode
        ? `${snap.refOutput} ${snap.refUomCode}`
        : "",
    ],
    [
      "Process Loss %",
      snap.lossPct != null && snap.lossPct !== ""
        ? Number(snap.lossPct).toFixed(2)
        : "",
    ],
    [],
    [
      "SN",
      "Item Code",
      "Stock Item (PLM)",
      "Qty per Ref",
      "UOM",
      "Wastage %",
      "Optional",
      "Remarks",
    ],
  ];
  const lineRows = snap.rows.map((r) => [
    r.sn,
    r.itemCode,
    r.itemName,
    r.qtyPerRef,
    r.uom,
    r.wastagePct,
    r.optional,
    r.remarks,
  ]);
  const all = headerLines.concat(lineRows);
  const csv = all.map((row) => row.map(csvEscape).join(",")).join("\n");
  const fname = `plm-template_${sanitizeFilename(
    snap.code || String(CURRENT_TPL_ID)
  )}_${formatDateStamp()}.csv`;
  downloadBlob(fname, csv, "text/csv;charset=utf-8");
}

function buildHtmlDocument() {
  const snap = buildExportSnapshot();
  const rowsHtml = snap.rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(String(r.sn))}</td>
        <td>${escapeHtml(r.itemCode)}</td>
        <td>${escapeHtml(r.itemName)}</td>
        <td class="right">${escapeHtml(String(r.qtyPerRef ?? ""))}</td>
        <td>${escapeHtml(r.uom)}</td>
        <td class="right">${escapeHtml(String(r.wastagePct ?? ""))}</td>
        <td>${escapeHtml(r.optional)}</td>
        <td>${escapeHtml(r.remarks)}</td>
      </tr>`
    )
    .join("");
  const headerMeta = `
    <div class="meta">
      <div><strong>Template:</strong> ${escapeHtml(snap.code || "")}</div>
      <div><strong>Reference Output:</strong> ${
        snap.refOutput != null && snap.refUomCode
          ? escapeHtml(`${snap.refOutput} ${snap.refUomCode}`)
          : ""
      }</div>
      <div><strong>Process Loss %:</strong> ${
        snap.lossPct != null && snap.lossPct !== ""
          ? escapeHtml(Number(snap.lossPct).toFixed(2))
          : ""
      }</div>
    </div>`;
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>PLM Template ${escapeHtml(snap.code || "")}</title>
      <style>
        body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; font-size: 13px; color:#0f172a; }
        h1 { font-size: 18px; margin: 12px 0; }
        .meta { margin: 8px 0 14px; display:grid; gap:4px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align:left; }
        thead th { background: #f1f5f9; }
        td.right { text-align: right; }
      </style>
    </head>
    <body>
      <h1>PLM Template</h1>
      ${headerMeta}
      <table>
        <thead>
          <tr>
            <th>SN</th>
            <th>Item Code</th>
            <th>Stock Item (PLM)</th>
            <th>Qty per Ref</th>
            <th>UOM</th>
            <th>Wastage %</th>
            <th>Optional</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
  </html>`;
}

function exportAsHtml() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_TPL_ID) {
    setStatus("Select a template to export.", "error");
    return;
  }
  const html = buildHtmlDocument();
  const code = (tplCode?.value || CURRENT_TPL_ID || "template").toString();
  const fname = `plm-template_${sanitizeFilename(
    code
  )}_${formatDateStamp()}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 800);
}

function sanitizeFilename(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_");
}
// formatDateStamp function defined earlier for selection export

function exportAsPdf() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to export.", "error");
  if (!CURRENT_TPL_ID) {
    setStatus("Select a template to export.", "error");
    return;
  }
  const snap = buildExportSnapshot();
  const jspdfNS = window.jspdf || window.jsPDF || {};
  const jsPDF = jspdfNS.jsPDF || jspdfNS;
  if (typeof jsPDF !== "function") {
    return setStatus(
      "PDF generator unavailable. Check network or jsPDF load.",
      "error"
    );
  }
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const margin = 36;
  const page = doc.internal.pageSize;
  const pageWidth = page.getWidth ? page.getWidth() : page.width;
  const pageHeight = page.getHeight ? page.getHeight() : page.height;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`PLM Template — ${snap.code || CURRENT_TPL_ID}`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const meta = [
    ["Template", snap.code || ""],
    [
      "Reference Output",
      snap.refOutput != null && snap.refUomCode
        ? `${snap.refOutput} ${snap.refUomCode}`
        : "—",
    ],
    [
      "Process Loss %",
      snap.lossPct != null && snap.lossPct !== ""
        ? Number(snap.lossPct).toFixed(2) + "%"
        : "—",
    ],
    ["Exported At", new Date().toLocaleString()],
  ];
  const labelWidth = 150;
  meta.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || ""), margin + labelWidth, y);
    y += 14;
  });
  y += 8;
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;
  const head = [
    [
      "SN",
      "Item Code",
      "Stock Item (PLM)",
      "Qty per Ref",
      "UOM",
      "Wastage %",
      "Optional",
      "Remarks",
    ],
  ];
  const body = snap.rows.map((r) => [
    String(r.sn),
    r.itemCode || "",
    r.itemName || "",
    r.qtyPerRef == null ? "" : String(r.qtyPerRef),
    r.uom || "",
    r.wastagePct === "" ? "" : Number(r.wastagePct).toFixed(2),
    r.optional,
    r.remarks || "",
  ]);
  if (doc.autoTable) {
    doc.autoTable({
      head,
      body,
      startY: y,
      styles: {
        font: "helvetica",
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        textColor: [0, 0, 0],
        cellPadding: 4,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.75,
        fontStyle: "bold",
      },
      columnStyles: {
        2: { halign: "left" },
        3: { halign: "right" },
        5: { halign: "right" },
        7: { halign: "left" },
      },
      didDrawPage: () => {
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.text(str, pageWidth - margin, pageHeight - 12, { align: "right" });
      },
      margin: { left: margin, right: margin },
    });
  } else {
    doc.setFontSize(10);
    const colX = [
      margin,
      margin + 40,
      margin + 140,
      margin + 380,
      margin + 440,
      margin + 480,
      margin + 540,
      margin + 590,
    ];
    const headers = head[0];
    headers.forEach((t, i) => doc.text(String(t), colX[i], y));
    doc.setLineWidth(0.5);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);
    y += 16;
    body.forEach((r) => {
      if (y > pageHeight - margin - 20) {
        doc.addPage();
        y = margin + 10;
      }
      r.forEach((t, i) => {
        const text = String(t ?? "");
        doc.text(text, colX[i], y);
      });
      y += 14;
    });
  }
  const filename = `plm-template_${sanitizeFilename(
    snap.code || String(CURRENT_TPL_ID)
  )}_${formatDateStamp()}.pdf`;
  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    setStatus("PDF export initiated.", "success", 1800);
  } catch (e) {
    console.warn("PDF blob download failed; falling back to doc.save", e);
    doc.save(filename);
  }
}

function renderQA() {
  // Hide QA when no template is selected
  if (!CURRENT_TPL_ID) {
    if (qaChip) qaChip.style.display = "none";
    if (qaPopover) qaPopover.style.display = "none";
    return [];
  }
  const issues = [];
  const h = collectHeader();
  const percentVal = lossPct.value === "" ? null : parseFloat(lossPct.value);
  if (!h.reference_output_qty || h.reference_output_qty <= 0)
    issues.push("Header: reference output qty must be > 0");
  if (!h.reference_output_uom_id)
    issues.push("Header: reference output UOM required");
  if (percentVal != null && (percentVal < 0 || percentVal > 100))
    issues.push("Header: process loss % must be between 0 and 100");
  const lines = collectLines();
  if (!lines.length) issues.push("No lines defined");
  lines.forEach((ln, i) => {
    if (!ln.stock_item_id) issues.push(`Line ${i + 1}: stock item required`);
    if (!ln.uom_id) issues.push(`Line ${i + 1}: UOM required`);
    if (ln.qty_per_reference_output == null || ln.qty_per_reference_output <= 0)
      issues.push(`Line ${i + 1}: qty per reference must be > 0`);
  });
  if (qaChip) {
    qaChip.style.display = "inline-flex";
    if (issues.length) {
      qaChip.classList.remove("ok");
      qaChip.classList.add("warn");
      const warnSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      const icon = qaChip.querySelector(".qa-icon");
      if (icon) icon.innerHTML = warnSvg;
      qaChip.setAttribute("aria-label", `Validation issues: ${issues.length}`);
    } else {
      qaChip.classList.remove("warn");
      qaChip.classList.add("ok");
      const okSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      const icon = qaChip.querySelector(".qa-icon");
      if (icon) icon.innerHTML = okSvg;
      qaChip.setAttribute("aria-label", "All checks passed");
    }
  }
  if (qaPopover) {
    if (issues.length) {
      qaPopover.innerHTML = `<button type="button" class="qa-popover-close" aria-label="Close">×</button><h4 id="qaPopoverTitle">Validation Issues (${
        issues.length
      })</h4><ul class="qa-issues">${issues
        .map((m) => `<li class="danger">${escapeHtml(m)}</li>`)
        .join("")}</ul>`;
    } else {
      qaPopover.innerHTML = `<button type="button" class="qa-popover-close" aria-label="Close">×</button><h4 id="qaPopoverTitle">All Checks Passed</h4><p class="success-msg">No validation issues detected.</p>`;
    }
  }
  return issues;
}

async function ensureMissingItems() {
  const missing = Array.from(
    new Set(
      CURRENT_LINES.map((l) => l.stock_item_id).filter(
        (id) => id && !STOCK_ITEMS.some((x) => x.id === id)
      )
    )
  );
  if (!missing.length) return;
  const { data } = await supabase
    .from("inv_stock_item")
    .select("id,name,code")
    .in("id", missing);
  (data || []).forEach((r) =>
    STOCK_ITEMS.push({ id: r.id, name: r.name, code: r.code || null })
  );
}

async function saveAll() {
  if (!PERM_CAN_EDIT)
    return setStatus("You do not have permission to edit.", "error");
  const code = (tplCode.value || "").trim();
  const header = collectHeader();
  if (!code) return setStatus("Template Code is required.", "error");
  if (!header.reference_output_qty || header.reference_output_qty <= 0)
    return setStatus("Reference Output Qty must be > 0.", "error");
  if (!header.reference_output_uom_id)
    return setStatus("Reference Output UOM is required.", "error");
  const uom = UOMS.find((u) => u.id === header.reference_output_uom_id);
  const uomCode = uom?.code;
  if (!uomCode) return setStatus("Invalid UOM selected.", "error");
  const p = header.process_loss_pct_display;
  if (p != null && (p < 0 || p > 100))
    return setStatus("Process Loss % must be 0–100.", "error");

  setStatus("Saving…", "info", 2500);
  // Upsert header by code
  const { error: upErr } = await supabase.rpc("rpc_plm_tpl_upsert_header", {
    p_code: code,
    p_reference_output_qty: header.reference_output_qty,
    p_ref_uom_code: uomCode,
    p_process_loss_pct: p == null ? null : p / 100,
  });
  if (upErr) {
    console.error(upErr);
    return setStatus(`Header save failed: ${upErr.message}`, "error");
  }
  // Refresh header id by code
  const { data: hdr } = await supabase
    .from("plm_tpl_header")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  CURRENT_TPL_ID = hdr?.id || CURRENT_TPL_ID;

  // Compute deletes based on current DB state
  let dbLines = [];
  try {
    const { data } = await supabase.rpc("rpc_plm_tpl_list_lines", {
      p_tpl_id: CURRENT_TPL_ID,
    });
    dbLines = data || [];
  } catch {
    dbLines = [];
  }
  const lines = collectLines();
  const toKey = (sid, uid) => `${sid}::${uid}`;
  const dbKeys = new Set(dbLines.map((r) => toKey(r.stock_item_id, r.uom_id)));
  const newKeys = new Set(lines.map((l) => toKey(l.stock_item_id, l.uom_id)));
  // Deletes
  for (const key of dbKeys) {
    if (!newKeys.has(key)) {
      // find line id in dbLines
      const row = dbLines.find((r) => toKey(r.stock_item_id, r.uom_id) === key);
      if (row?.id)
        await supabase.rpc("rpc_plm_tpl_delete_line", { p_line_id: row.id });
    }
  }
  // Upserts
  const upTasks = lines.map((l) => {
    const u = UOMS.find((x) => x.id === l.uom_id);
    const code = u?.code;
    if (!l.stock_item_id || !code || !l.qty_per_reference_output)
      return Promise.resolve();
    return supabase.rpc("rpc_plm_tpl_upsert_line", {
      p_tpl_id: CURRENT_TPL_ID,
      p_stock_item_id: l.stock_item_id,
      p_qty: l.qty_per_reference_output,
      p_uom_code: code,
      p_wastage_pct: l.wastage_pct,
      p_is_optional: l.is_optional,
      p_remarks: l.remarks || null,
    });
  });
  await Promise.all(upTasks);

  // Renumber lines at end
  await supabase.rpc("rpc_plm_tpl_renumber", { p_tpl_id: CURRENT_TPL_ID });

  setStatus("Saved successfully.", "success");
  await refreshTemplate();
}

async function refreshTemplate() {
  if (!CURRENT_TPL_ID) return;
  // reload header values
  const hdr = await loadTemplateHeader(CURRENT_TPL_ID);
  if (hdr) {
    tplCode.value = hdr.code || "";
    refQty.value = hdr.reference_output_qty ?? "";
    refUom.value = hdr.reference_output_uom_id ?? "";
    if (hdr.process_loss_pct == null) lossPct.value = "";
    else lossPct.value = (Number(hdr.process_loss_pct) * 100).toFixed(2);
  }
  await loadTemplateLines(CURRENT_TPL_ID);
  await ensureMissingItems();
  renderLines();
  syncHeaderPills();
  renderQA();
  updateExportVisibility();
}

// Events
tplPicker.addEventListener("change", async () => {
  CURRENT_TPL_ID = tplPicker.value ? parseInt(tplPicker.value, 10) : null;
  setStatus("");
  // Keep hidden code field in sync with selected template text
  if (tplCode) {
    tplCode.value = CURRENT_TPL_ID
      ? tplPicker.selectedOptions?.[0]?.textContent || ""
      : "";
  }
  if (!CURRENT_TPL_ID) {
    if (tplCode) tplCode.value = "";
    refQty.value = "";
    refUom.value = "";
    lossPct.value = "";
    CURRENT_LINES = [blankLine()];
    renderLines();
    syncHeaderPills();
    renderQA();
    updateExportVisibility();
    return;
  }
  showMask("Loading…");
  try {
    await refreshTemplate();
  } finally {
    hideMask();
  }
  // refreshTemplate already syncs pills and QA
});

// Open 'New Template' modal
function openNewTplModal() {
  if (!newTplModal) return;
  newTplModal.style.display = "flex";
  setTimeout(() => ntCodeInput?.focus(), 0);
}
function closeNewTplModal() {
  if (!newTplModal) return;
  newTplModal.style.display = "none";
  if (ntCodeInput) ntCodeInput.value = "";
}
async function createNewTemplateFromModal() {
  const code = (ntCodeInput?.value || "").trim();
  if (!code) {
    setStatus("Template Code is required to create a new template.", "error");
    return;
  }
  // Validate header fields
  const q =
    ntRefQtyInput?.value === "" ? null : parseFloat(ntRefQtyInput.value);
  const u = ntRefUomSel?.value ? parseInt(ntRefUomSel.value, 10) : null;
  const p =
    ntLossPctInput?.value === "" ? null : parseFloat(ntLossPctInput.value);
  if (q == null || !(q > 0))
    return setStatus("Reference Output Qty must be > 0.", "error");
  if (!u) return setStatus("Reference Output UOM is required.", "error");
  if (p != null && (p < 0 || p > 100))
    return setStatus("Process Loss % must be 0–100.", "error");

  // Initialize header + a blank line, then save immediately
  tplPicker.value = "";
  CURRENT_TPL_ID = null;
  if (tplCode) tplCode.value = code;
  refQty.value = q != null ? String(q) : "1.000";
  lossPct.value = p != null ? String(p) : "";
  refUom.value = u != null ? String(u) : UOMS[0]?.id ? String(UOMS[0].id) : "";
  CURRENT_LINES = [blankLine()];
  renderLines();
  syncHeaderPills();
  renderQA();
  closeNewTplModal();
  // Persist header + lines; refreshTemplate will set CURRENT_TPL_ID
  await saveAll();
  setStatus("Template created.", "success");
}
newTplBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  openNewTplModal();
});
ntCloseBtn?.addEventListener("click", closeNewTplModal);
ntCancelBtn?.addEventListener("click", closeNewTplModal);
ntCreateBtn?.addEventListener("click", createNewTemplateFromModal);
// Submit on Enter anywhere in the modal, close on Escape
newTplModal?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    createNewTemplateFromModal();
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeNewTplModal();
  }
});

// Edit Template modal logic
function openEditTplModal() {
  if (!editTplModal) return;
  if (etRefQtyInput) etRefQtyInput.value = refQty.value || "";
  if (etRefUomSel) etRefUomSel.value = refUom.value || "";
  if (etLossPctInput) etLossPctInput.value = lossPct.value || "";
  editTplModal.style.display = "flex";
  setTimeout(() => etRefQtyInput?.focus(), 0);
}
function closeEditTplModal() {
  if (!editTplModal) return;
  editTplModal.style.display = "none";
}
function applyEditTemplate() {
  const q =
    etRefQtyInput?.value === "" ? null : parseFloat(etRefQtyInput.value);
  const u = etRefUomSel?.value ? parseInt(etRefUomSel.value, 10) : null;
  const p =
    etLossPctInput?.value === "" ? null : parseFloat(etLossPctInput.value);
  if (q == null || !(q > 0))
    return setStatus("Reference Output Qty must be > 0.", "error");
  if (!u) return setStatus("Reference Output UOM is required.", "error");
  if (p != null && (p < 0 || p > 100))
    return setStatus("Process Loss % must be 0–100.", "error");
  refQty.value = String(q);
  refUom.value = String(u);
  lossPct.value = p == null ? "" : String(p);
  syncHeaderPills();
  renderQA();
  closeEditTplModal();
  setStatus("Changes apply locally; press Save to persist to server.", "info");
}
editTplBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!CURRENT_TPL_ID) return;
  openEditTplModal();
});
etCloseBtn?.addEventListener("click", closeEditTplModal);
etCancelBtn?.addEventListener("click", closeEditTplModal);
etApplyBtn?.addEventListener("click", applyEditTemplate);
editTplModal?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    applyEditTemplate();
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeEditTplModal();
  }
});

linesBody.addEventListener("change", (e) => {
  if (!LINES_EDIT_MODE) return;
  const tr = e.target.closest("tr[data-i]");
  if (!tr) return;
  FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
  const i = parseInt(tr.dataset.i, 10);
  const ln = CURRENT_LINES[i];
  if (e.target.classList.contains("item")) {
    ln.stock_item_id = e.target.value ? parseInt(e.target.value, 10) : null;
    const codeCell = tr.querySelector(".code-cell");
    if (codeCell) codeCell.textContent = getItemCode(ln.stock_item_id);
  }
  if (e.target.classList.contains("qty"))
    ln.qty_per_reference_output =
      e.target.value === "" ? null : parseFloat(e.target.value);
  if (e.target.classList.contains("uom"))
    ln.uom_id = e.target.value ? parseInt(e.target.value, 10) : null;
  if (e.target.classList.contains("wast"))
    ln.wastage_pct = e.target.value === "" ? null : parseFloat(e.target.value);
  if (e.target.classList.contains("opt")) ln.is_optional = e.target.checked;
  if (e.target.classList.contains("rem")) ln.remarks = e.target.value || "";
  renderQA();
});

linesBody.addEventListener("click", (e) => {
  if (!LINES_EDIT_MODE) return;
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = e.target.closest("tr[data-i]");
  const i = parseInt(tr.dataset.i, 10);
  FOCUSED_ROW_INDEX = i;
  switch (btn.dataset.act) {
    case "del": {
      PENDING_DELETE_LINE_INDEX = i;
      if (dlText) dlText.textContent = `Delete line ${i + 1}?`;
      if (dlModal) dlModal.style.display = "flex";
      break;
    }
    case "up":
      if (i > 0) {
        const tmp = CURRENT_LINES[i - 1];
        CURRENT_LINES[i - 1] = CURRENT_LINES[i];
        CURRENT_LINES[i] = tmp;
        renderLines();
        renderQA();
        FOCUSED_ROW_INDEX = i - 1;
        focusLineRow(FOCUSED_ROW_INDEX);
      }
      break;
    case "down":
      if (i < CURRENT_LINES.length - 1) {
        const tmp2 = CURRENT_LINES[i + 1];
        CURRENT_LINES[i + 1] = CURRENT_LINES[i];
        CURRENT_LINES[i] = tmp2;
        renderLines();
        renderQA();
        FOCUSED_ROW_INDEX = i + 1;
        focusLineRow(FOCUSED_ROW_INDEX);
      }
      break;
    case "insAbove":
      openInsertPopover(btn, i, "above");
      break;
    case "insBelow":
      openInsertPopover(btn, i, "below");
      break;
  }
});

// Track focus/click within lines to maintain focused row index
linesBody.addEventListener("focusin", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
});
linesBody.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (tr) FOCUSED_ROW_INDEX = parseInt(tr.dataset.i, 10);
});

function focusLineRow(idx) {
  if (!LINES_EDIT_MODE) return;
  setTimeout(() => {
    const tr = linesBody.querySelector(`tr[data-i='${idx}']`);
    if (!tr) return;
    const focusEl = tr.querySelector(
      "select.cell.item, input.cell.qty, input.cell.wast, select.cell.uom, input.cell.rem"
    );
    focusEl?.focus?.();
  }, 30);
}

// Insert popover logic
function positionInsertPopover(anchorBtn) {
  if (!insertPopover || !anchorBtn) return;
  insertPopover.style.display = "block";
  insertPopover.style.top = "0px";
  insertPopover.style.left = "0px";
  const rect = anchorBtn.getBoundingClientRect();
  const w = insertPopover.offsetWidth || 260;
  const h = insertPopover.offsetHeight || 140;
  let top = rect.bottom + 6;
  let left = rect.left;
  if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
  if (left < 8) left = 8;
  if (top + h > window.innerHeight - 8) top = rect.top - h - 8;
  if (top < 8) top = 8;
  insertPopover.style.top = `${top + window.scrollY}px`;
  insertPopover.style.left = `${left + window.scrollX}px`;
}
function openInsertPopover(anchorBtn, index, mode) {
  if (!LINES_EDIT_MODE || !PERM_CAN_EDIT) return;
  INSERT_TARGET_INDEX = index;
  INSERT_TARGET_MODE = mode === "below" ? "below" : "above";
  if (insModeLabel) insModeLabel.textContent = INSERT_TARGET_MODE;
  if (insCountInput) insCountInput.value = "1";
  positionInsertPopover(anchorBtn);
  const onDoc = (e) => {
    if (!insertPopover.contains(e.target) && e.target !== anchorBtn) {
      closeInsertPopover();
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    }
  };
  const onEsc = (e) => {
    if (e.key === "Escape") {
      closeInsertPopover();
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    }
  };
  if (insertPopoverResizeHandler) {
    window.removeEventListener("resize", insertPopoverResizeHandler);
    insertPopoverResizeHandler = null;
  }
  insertPopoverResizeHandler = () => {
    if (insertPopover.style.display === "block")
      positionInsertPopover(anchorBtn);
  };
  window.addEventListener("resize", insertPopoverResizeHandler);
  document.addEventListener("mousedown", onDoc);
  document.addEventListener("keydown", onEsc);
}
function closeInsertPopover() {
  if (insertPopover) insertPopover.style.display = "none";
  INSERT_TARGET_INDEX = null;
  INSERT_TARGET_MODE = null;
  if (insertPopoverResizeHandler) {
    window.removeEventListener("resize", insertPopoverResizeHandler);
    insertPopoverResizeHandler = null;
  }
}
function performInsertRows(count) {
  if (INSERT_TARGET_INDEX == null || !INSERT_TARGET_MODE) return;
  const n = Math.min(Math.max(count, 1), 100);
  if (n > 0) {
    const arr = Array.from({ length: n }, () => blankLine());
    const pos =
      INSERT_TARGET_MODE === "above"
        ? INSERT_TARGET_INDEX
        : INSERT_TARGET_INDEX + 1;
    CURRENT_LINES.splice(pos, 0, ...arr);
    renderLines();
    renderQA();
    setStatus(
      `${n} row${n > 1 ? "s" : ""} inserted ${INSERT_TARGET_MODE}.`,
      "success",
      3000
    );
    FOCUSED_ROW_INDEX = pos;
    focusLineRow(FOCUSED_ROW_INDEX);
  }
  closeInsertPopover();
}
insCancelBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  closeInsertPopover();
});
insOkBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  const val = parseInt(insCountInput?.value || "1", 10);
  performInsertRows(Number.isFinite(val) ? val : 1);
});
insertPopover?.addEventListener("click", (e) => {
  const qBtn = e.target.closest("button[data-q]");
  if (qBtn) {
    const q = parseInt(qBtn.dataset.q, 10);
    if (Number.isFinite(q)) performInsertRows(q);
  }
});

// Nudge scroll so native selects open downward (ensure space below)
function ensureSpaceBelowForDropdown(targetEl, minSpace = 280) {
  try {
    if (!targetEl) return;
    const container = linesScroll;
    if (!container) {
      // Fallback to default behavior
      targetEl.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }
    // Compute available space within the scroll container bounded by viewport
    const elRect = targetEl.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const margin = 8;
    const containerBottom = Math.min(window.innerHeight, cRect.bottom);
    let spaceBelow = containerBottom - elRect.bottom - margin;
    // If not enough space below, scroll the container down
    if (spaceBelow < minSpace) {
      const delta = minSpace - spaceBelow;
      container.scrollTop = Math.min(
        container.scrollTop + delta,
        container.scrollHeight - container.clientHeight
      );
    }
    // If item is too close to the top, nudge down a bit for comfort
    const desiredTopPad = 40;
    const containerTop = Math.max(0, cRect.top);
    const spaceAbove = elRect.top - containerTop;
    if (spaceAbove < desiredTopPad) {
      const upShift = desiredTopPad - spaceAbove;
      container.scrollTop = Math.max(0, container.scrollTop - upShift);
    }
    // Re-evaluate once frame is painted to improve reliability in some browsers
    requestAnimationFrame(() => {
      const elR = targetEl.getBoundingClientRect();
      const cR = container.getBoundingClientRect();
      const cBottom = Math.min(window.innerHeight, cR.bottom);
      const avail = cBottom - elR.bottom - margin;
      if (avail < minSpace) {
        const d = minSpace - avail;
        const prev = container.scrollTop;
        container.scrollTop = Math.min(
          container.scrollTop + d,
          container.scrollHeight - container.clientHeight
        );
        // If container can't scroll enough, adjust window scroll as a last resort
        if (container.scrollTop === prev) {
          window.scrollBy({ top: d + 16, behavior: "instant" });
        }
      }
    });
  } catch {
    /* ignore */
  }
}
// Apply before the dropdown opens (capture phase to run before native open)
const onSelectMouseDownCapture = (e) => {
  if (!LINES_EDIT_MODE) return;
  const sel = e.target.closest("select.cell.item, select.cell.uom");
  if (!sel) return;
  // Mirror RM-BOM: always use native selects; just nudge scroll to open downward
  ensureSpaceBelowForDropdown(sel);
};
linesBody.addEventListener("mousedown", onSelectMouseDownCapture, true);
// Also support pointer events for earlier trigger on some browsers
linesBody.addEventListener("pointerdown", onSelectMouseDownCapture, true);
// Also handle keyboard focus (Tab into select)
linesBody.addEventListener("focusin", (e) => {
  if (!LINES_EDIT_MODE) return;
  const sel = e.target.closest("select.cell.item");
  if (sel) ensureSpaceBelowForDropdown(sel);
});

// Use capture to adjust scroll before the browser opens the list via keyboard
linesBody.addEventListener(
  "keydown",
  (e) => {
    if (!LINES_EDIT_MODE) return;
    const sel = e.target.closest && e.target.closest("select.cell.item");
    if (!sel) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      // Let native select handle keyboard open; nudge scroll like RM-BOM
      ensureSpaceBelowForDropdown(sel);
      // Do not preventDefault to allow native dropdown
    }
  },
  true
);
document.addEventListener("keydown", (e) => {
  if (insertPopover?.style.display === "block") return;
  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";
  const idx = FOCUSED_ROW_INDEX != null ? FOCUSED_ROW_INDEX : 0;
  // Alt+ArrowUp
  if (e.altKey && e.key === "ArrowUp") {
    e.preventDefault();
    if (idx > 0) {
      const tmp = CURRENT_LINES[idx - 1];
      CURRENT_LINES[idx - 1] = CURRENT_LINES[idx];
      CURRENT_LINES[idx] = tmp;
      FOCUSED_ROW_INDEX = idx - 1;
      renderLines();
      renderQA();
      setStatus("Line moved up.", "success", 1600);
      focusLineRow(FOCUSED_ROW_INDEX);
    }
    return;
  }
  // Alt+ArrowDown
  if (e.altKey && e.key === "ArrowDown") {
    e.preventDefault();
    if (idx < CURRENT_LINES.length - 1) {
      const tmp = CURRENT_LINES[idx + 1];
      CURRENT_LINES[idx + 1] = CURRENT_LINES[idx];
      CURRENT_LINES[idx] = tmp;
      FOCUSED_ROW_INDEX = idx + 1;
      renderLines();
      renderQA();
      setStatus("Line moved down.", "success", 1600);
      focusLineRow(FOCUSED_ROW_INDEX);
    }
    return;
  }
  // Shift+Insert -> open popover for Insert Above
  if (
    e.key === "Insert" &&
    e.shiftKey &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !isTyping
  ) {
    e.preventDefault();
    const tr = linesBody.querySelector(`tr[data-i='${idx}']`);
    const btn = tr?.querySelector('button[data-act="insAbove"]');
    if (btn) openInsertPopover(btn, idx, "above");
    return;
  }
  // Insert -> insert one row below
  if (
    e.key === "Insert" &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !isTyping
  ) {
    e.preventDefault();
    const pos = Math.min(idx + 1, CURRENT_LINES.length);
    CURRENT_LINES.splice(pos, 0, blankLine());
    FOCUSED_ROW_INDEX = pos;
    renderLines();
    renderQA();
    setStatus("Row inserted below.", "success", 1800);
    focusLineRow(FOCUSED_ROW_INDEX);
    return;
  }
  // Delete -> delete focused row (when not typing in a field)
  if (
    e.key === "Delete" &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !isTyping
  ) {
    e.preventDefault();
    if (CURRENT_LINES.length && idx >= 0 && idx < CURRENT_LINES.length) {
      PENDING_DELETE_LINE_INDEX = idx;
      if (dlText) dlText.textContent = `Delete line ${idx + 1}?`;
      if (dlModal) dlModal.style.display = "flex";
    }
  }
});

// Delete line modal handlers
function closeDeleteLineModal() {
  if (dlModal) dlModal.style.display = "none";
  PENDING_DELETE_LINE_INDEX = null;
}
dlCloseBtn?.addEventListener("click", closeDeleteLineModal);
dlCancelBtn?.addEventListener("click", closeDeleteLineModal);
dlConfirmBtn?.addEventListener("click", () => {
  if (PENDING_DELETE_LINE_INDEX == null) return closeDeleteLineModal();
  const idx = PENDING_DELETE_LINE_INDEX;
  CURRENT_LINES.splice(idx, 1);
  if (!CURRENT_LINES.length) CURRENT_LINES.push(blankLine());
  FOCUSED_ROW_INDEX = Math.max(0, Math.min(idx, CURRENT_LINES.length - 1));
  renderLines();
  renderQA();
  setStatus("Row deleted.", "success", 1600);
  focusLineRow(FOCUSED_ROW_INDEX);
  closeDeleteLineModal();
});
dlModal?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    closeDeleteLineModal();
  } else if (e.key === "Enter") {
    e.preventDefault();
    dlConfirmBtn?.click();
  }
});

renumberBtn.addEventListener("click", async () => {
  if (!CURRENT_TPL_ID)
    return setStatus("Select a template to renumber.", "error");
  const { error } = await supabase.rpc("rpc_plm_tpl_renumber", {
    p_tpl_id: CURRENT_TPL_ID,
  });
  if (error) return setStatus(`Renumber failed: ${error.message}`, "error");
  setStatus("Renumbered.", "success");
});

saveBtn?.addEventListener("click", saveAll);

// --- Rebuild tab behavior (cloned/adapted from plm-rebuild-dashboard) ---
function renderRebuildDryRun(rows) {
  if (!rebuildResultBody) return;
  rebuildResultBody.innerHTML = (rows || [])
    .map((r) => {
      const sku =
        r.sku_label ||
        REBUILD_SKU_LABEL_MAP.get(Number(r.sku_id)) ||
        r.sku_id ||
        "";
      const tpl =
        r.tpl_code ||
        r.tpl_id ||
        REBUILD_TPL_MAP.get(Number(r.sku_id)) ||
        r.template ||
        "";
      const status = r.action || r.status || "would rebuild";
      return `<tr><td>${escapeHtml(String(sku))}</td><td>${escapeHtml(
        String(tpl)
      )}</td><td>${escapeHtml(String(status))}</td></tr>`;
    })
    .join("");
}

rebuildTplBtn?.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to rebuild.", "error");
  const tplId = parseInt(rebuildTplPicker?.value || "", 10);
  if (!tplId) return setStatus("Select a template.", "error");
  try {
    showMask("Rebuilding template…");
    const { data, error } = await supabase.rpc("rpc_plm_rebuild_skus_for_tpl", {
      p_tpl_id: tplId,
    });
    if (error) return setStatus(`Rebuild failed: ${error.message}`, "error");
    // data contains the integer count returned by the RPC
    setStatus(`Rebuild completed: ${data} SKUs rebuilt`, "success");
  } catch (e) {
    setStatus(`Rebuild failed: ${e.message}`, "error");
  } finally {
    hideMask();
  }
});

dryRunBtn?.addEventListener("click", async () => {
  // Use batching for dry run to avoid ambiguous RPC overload and long runs
  const batchSize = 200;
  const results = [];
  let offset = 0;
  try {
    showMask("Performing dry run…");
    while (true) {
      const { data, error } = await supabase.rpc("rpc_plm_rebuild_all", {
        p_dry_run: true,
        p_limit: batchSize,
        p_offset: offset,
      });
      if (error) return setStatus(`Dry run failed: ${error.message}`, "error");
      if (!data || (Array.isArray(data) && data.length === 0)) break;
      if (Array.isArray(data)) {
        // ensure we have tpl_code for the returned SKUs
        const newSkus = Array.from(
          new Set((data || []).map((d) => Number(d.sku_id)).filter(Boolean))
        );
        if (newSkus.length) await ensureTplCodesForSkus(newSkus);
        results.push(...data);
        renderRebuildDryRun(results);
        if (data.length < batchSize) break;
      } else if (typeof data === "number") {
        // older behavior: returned count only
        setStatus(`Dry run reported: ${data} SKUs`, "success");
        break;
      } else {
        break;
      }
      offset += batchSize;
      await new Promise((r) => setTimeout(r, 50));
    }
    setStatus(`Dry run complete: ${results.length} SKUs`, "success");
  } catch (e) {
    setStatus(`Dry run failed: ${e.message}`, "error");
  } finally {
    hideMask();
  }
});

rebuildAllBtn?.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to rebuild.", "error");
  // Process in batches to avoid long single transactions on the DB
  const batchSize = 100; // adjust as needed
  const results = [];
  let offset = 0;
  try {
    showMask("Rebuilding all templates…");
    while (true) {
      const { data, error } = await supabase.rpc("rpc_plm_rebuild_all", {
        p_dry_run: false,
        p_limit: batchSize,
        p_offset: offset,
      });
      if (error) {
        setStatus(
          `Rebuild all failed at offset ${offset}: ${error.message}`,
          "error"
        );
        break;
      }
      if (!data || (Array.isArray(data) && data.length === 0)) break;
      if (Array.isArray(data)) {
        const newSkus = Array.from(
          new Set((data || []).map((d) => Number(d.sku_id)).filter(Boolean))
        );
        if (newSkus.length) await ensureTplCodesForSkus(newSkus);
        results.push(...data);
        renderRebuildDryRun(results);
        setStatus(`Processed ${results.length} SKUs...`, "info", 2000);
        if (data.length < batchSize) break;
      } else if (typeof data === "number") {
        setStatus(`Rebuild all completed: ${data} SKUs rebuilt`, "success");
        break;
      } else {
        setStatus("Rebuild all completed.", "success");
        break;
      }
      offset += batchSize;
      // small pause to yield UI and reduce DB pressure
      await new Promise((r) => setTimeout(r, 100));
    }
    if (results.length)
      setStatus(
        `Rebuild all completed: ${results.length} SKUs processed`,
        "success"
      );
  } catch (e) {
    setStatus(`Rebuild all failed: ${e.message}`, "error");
  } finally {
    hideMask();
  }
});

// When a template is selected in Rebuild tab, load SKUs mapped to it
rebuildTplPicker?.addEventListener("change", async () => {
  const tplId = parseInt(rebuildTplPicker?.value || "", 10);
  if (!tplId) {
    renderRebuildDryRun([]);
    return;
  }
  try {
    const { data: maps, error: mapErr } = await supabase
      .from("plm_sku_pack_map")
      .select("sku_id")
      .eq("tpl_id", tplId);
    if (mapErr) throw mapErr;
    const skuIds = Array.from(
      new Set((maps || []).map((m) => Number(m.sku_id)).filter(Boolean))
    );
    if (!skuIds.length) return renderRebuildDryRun([]);
    const { data: skuRows, error: skuErr } = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id, sku_label")
      .in("sku_id", skuIds);
    if (skuErr) throw skuErr;
    const skuMap = new Map(
      (skuRows || []).map((s) => [Number(s.sku_id), s.sku_label])
    );
    const tplCode =
      (TEMPLATES || []).find((t) => Number(t.tpl_id) === Number(tplId))
        ?.tpl_code || "";
    const rows = skuIds.map((sid) => ({
      sku_id: sid,
      sku_label: skuMap.get(sid) || sid,
      tpl_code: tplCode,
      status: "mapped",
    }));
    renderRebuildDryRun(rows);
  } catch (err) {
    console.error(err);
    setStatus(`Load mapped SKUs failed: ${err.message}`, "error");
  }
});

(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "login.html");
    try {
      const { data: permRows } = await supabase
        .from("user_permissions")
        .select("module_id, can_view, can_edit")
        .eq("user_id", session.user.id)
        .in("module_id", [MODULE_ID, MAP_MODULE_ID]);
      if (Array.isArray(permRows) && permRows.length) {
        const tPerm = permRows.find((r) => r.module_id === MODULE_ID);
        if (tPerm) {
          PERM_CAN_VIEW = !!tPerm.can_view;
          PERM_CAN_EDIT = !!tPerm.can_edit;
        }
        const mPerm = permRows.find((r) => r.module_id === MAP_MODULE_ID);
        if (mPerm) {
          MAP_PERM_CAN_VIEW = !!mPerm.can_view;
          MAP_PERM_CAN_EDIT = !!mPerm.can_edit;
        }
      }
    } catch (pErr) {
      console.warn("Permission load failed", pErr);
    }
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }
    await loadUoms();
    await loadPlmItems();
    await loadTemplates();
    // Populate rebuild tab template picker (if present)
    if (rebuildTplPicker && Array.isArray(TEMPLATES)) {
      rebuildTplPicker.innerHTML = [
        "<option value=''>— select template —</option>",
        ...TEMPLATES.map(
          (t) =>
            `<option value='${t.tpl_id}'>${escapeHtml(t.tpl_code)}</option>`
        ),
      ].join("");
    }
    // Wire the compact Rebuild menu (single button with dropdown)
    if (rebuildMenuBtn && rebuildMenu) {
      rebuildMenuBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const isOpen = rebuildMenu.style.display === "block";
        rebuildMenu.style.display = isOpen ? "none" : "block";
      });
      // close when clicking outside
      document.addEventListener("click", () => {
        if (rebuildMenu && rebuildMenu.style.display === "block")
          rebuildMenu.style.display = "none";
      });
      // prevent clicks inside menu from closing immediately
      rebuildMenu.addEventListener("click", (ev) => ev.stopPropagation());
      // close on Escape
      document.addEventListener("keydown", (ev) => {
        if (
          ev.key === "Escape" &&
          rebuildMenu &&
          rebuildMenu.style.display === "block"
        ) {
          rebuildMenu.style.display = "none";
        }
      });
    }
    // Auto-select first template by default (parity with RM-BOM selecting first BOM)
    if (Array.isArray(TEMPLATES) && TEMPLATES.length > 0) {
      CURRENT_TPL_ID = TEMPLATES[0].tpl_id;
      if (tplPicker) tplPicker.value = String(CURRENT_TPL_ID);
      if (tplCode) tplCode.value = TEMPLATES[0].tpl_code || "";
      await refreshTemplate();
    }
    // Populate New Template UOM select
    if (ntRefUomSel) {
      ntRefUomSel.innerHTML = UOMS.map(
        (u) => `<option value="${u.id}">${u.code}</option>`
      ).join("");
      if (UOMS[0]?.id) ntRefUomSel.value = String(UOMS[0].id);
    }
    // Populate Edit Template UOM select
    if (etRefUomSel) {
      etRefUomSel.innerHTML = UOMS.map(
        (u) => `<option value="${u.id}">${u.code}</option>`
      ).join("");
    }
    // default state when no template exists
    if (!CURRENT_TPL_ID) {
      CURRENT_LINES = [blankLine()];
      renderLines();
      syncHeaderPills();
      renderQA();
      updateExportVisibility();
    }
    // Permission-based global class like RM-BOM
    if (!PERM_CAN_EDIT) document.body.classList.add("no-edit");
    else document.body.classList.remove("no-edit");
    homeBtn?.addEventListener("click", () =>
      window.Platform && typeof window.Platform.goHome === "function"
        ? window.Platform.goHome()
        : (window.location.href = "index.html")
    );
    // Kebab menu interactions (simple fixed-positioning like RM-BOM)
    const moreMenuBtn = document.getElementById("moreMenuBtn");
    const moreMenu = document.getElementById("moreMenu");
    if (moreMenuBtn && moreMenu) {
      const closeMenu = () => {
        moreMenu.classList.remove("open");
        moreMenuBtn.setAttribute("aria-expanded", "false");
        moreMenu.style.position = "";
        moreMenu.style.top = "";
        moreMenu.style.left = "";
        moreMenu.style.right = "";
        moreMenu.style.bottom = "";
        moreMenu.style.display = "";
        window.removeEventListener("resize", onMenuResize);
      };
      const positionMenu = () => {
        if (!moreMenu.classList.contains("open")) return;
        moreMenu.style.position = "fixed";
        moreMenu.style.display = "block";
        const rect = moreMenuBtn.getBoundingClientRect();
        // clear conflicting anchors from CSS
        moreMenu.style.right = "";
        moreMenu.style.bottom = "";
        const menuW = moreMenu.offsetWidth || 220;
        const menuH = moreMenu.offsetHeight || 160;
        let top = rect.bottom + 6;
        let left = rect.left;
        if (left + menuW > window.innerWidth - 8)
          left = window.innerWidth - menuW - 8;
        if (left < 8) left = 8;
        if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 8;
        if (top < 8) top = 8;
        moreMenu.style.top = `${top}px`;
        moreMenu.style.left = `${left}px`;
      };
      const onMenuResize = () => positionMenu();
      moreMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !moreMenu.classList.contains("open");
        if (willOpen) {
          moreMenu.classList.add("open");
          moreMenuBtn.setAttribute("aria-expanded", "true");
          positionMenu();
          window.addEventListener("resize", onMenuResize);
          setTimeout(() => {
            const onDocClick = (ev) => {
              if (!moreMenu.contains(ev.target) && ev.target !== moreMenuBtn) {
                closeMenu();
                document.removeEventListener("click", onDocClick);
                document.removeEventListener("keydown", onEsc);
              }
            };
            const onEsc = (ev) => {
              if (ev.key === "Escape") {
                closeMenu();
                document.removeEventListener("click", onDocClick);
                document.removeEventListener("keydown", onEsc);
              }
            };
            document.addEventListener("click", onDocClick);
            document.addEventListener("keydown", onEsc);
          }, 0);
        } else {
          closeMenu();
        }
      });
      moreMenu.addEventListener("click", (e) => {
        if (e.target.closest(".menu-item")) closeMenu();
      });
    }
    // Keep header pills in sync on input changes
    refQty?.addEventListener("input", syncHeaderPills);
    refUom?.addEventListener("change", syncHeaderPills);
    lossPct?.addEventListener("input", syncHeaderPills);
    // Also keep export visibility tied to selection changes implicitly handled above
    // QA chip popover interactions
    if (qaChip && qaPopover) {
      let qaHideTimer = null;
      const positionQaPopover = () => {
        const rect = qaChip.getBoundingClientRect();
        const top = rect.bottom + 6 + window.scrollY;
        const centerX = rect.left + rect.width / 2 + window.scrollX;
        // ensure we have width for clamping
        const w = qaPopover.offsetWidth || 320;
        let leftPx = centerX - w / 2;
        const maxLeft = window.innerWidth - w - 8;
        if (leftPx > maxLeft) leftPx = Math.max(8, maxLeft);
        if (leftPx < 8) leftPx = 8;
        qaPopover.style.top = `${top}px`;
        qaPopover.style.left = `${leftPx}px`;
      };
      const showQaPopover = () => {
        if (qaHideTimer) {
          clearTimeout(qaHideTimer);
          qaHideTimer = null;
        }
        if (qaPopover.style.display === "none") {
          qaPopover.style.display = "block";
          qaChip.setAttribute("aria-expanded", "true");
          positionQaPopover();
        } else positionQaPopover();
      };
      const hideQaPopover = (force = false) => {
        if (force) {
          qaPopover.style.display = "none";
          qaChip.setAttribute("aria-expanded", "false");
          return;
        }
        qaHideTimer = setTimeout(() => {
          qaPopover.style.display = "none";
          qaChip.setAttribute("aria-expanded", "false");
        }, 160);
      };
      qaChip.addEventListener("mouseenter", showQaPopover);
      qaChip.addEventListener("focus", showQaPopover);
      qaChip.addEventListener("mouseleave", () => hideQaPopover());
      qaChip.addEventListener("blur", () => hideQaPopover());
      qaChip.addEventListener("click", () => {
        if (qaPopover.style.display === "none") showQaPopover();
        else hideQaPopover(true);
      });
      qaPopover.addEventListener("mouseenter", () => {
        if (qaHideTimer) {
          clearTimeout(qaHideTimer);
          qaHideTimer = null;
        }
      });
      qaPopover.addEventListener("mouseleave", () => hideQaPopover());
      qaPopover.addEventListener("click", (e) => {
        const btn = e.target.closest(".qa-popover-close");
        if (btn) hideQaPopover(true);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && qaPopover.style.display !== "none") {
          hideQaPopover(true);
          qaChip.focus();
        }
      });
      window.addEventListener(
        "scroll",
        () => {
          if (qaPopover.style.display !== "none") positionQaPopover();
        },
        { passive: true }
      );
    }
    // Export menu interactions (fixed positioning to avoid panel overflow clipping)
    if (exportBtn && exportMenu) {
      const positionMenu = () => {
        if (!exportMenu.classList.contains("open")) return;
        exportMenu.style.position = "fixed";
        exportMenu.style.display = "block";
        const rect = exportBtn.getBoundingClientRect();
        const menuW = exportMenu.offsetWidth || 220;
        const menuH = exportMenu.offsetHeight || 160;
        let top = rect.bottom + 6;
        let left = rect.left;
        if (left + menuW > window.innerWidth - 8)
          left = window.innerWidth - menuW - 8;
        if (left < 8) left = 8;
        if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 8;
        if (top < 8) top = 8;
        exportMenu.style.top = `${top}px`;
        exportMenu.style.left = `${left}px`;
      };
      const closeMenu = () => {
        exportMenu.classList.remove("open");
        exportBtn.setAttribute("aria-expanded", "false");
        exportMenu.style.position = "";
        exportMenu.style.top = "";
        exportMenu.style.left = "";
        exportMenu.style.display = "";
        window.removeEventListener("resize", positionMenu);
        window.removeEventListener("scroll", positionMenu);
      };
      exportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !exportMenu.classList.contains("open");
        if (willOpen) {
          exportMenu.classList.add("open");
          exportBtn.setAttribute("aria-expanded", "true");
          positionMenu();
          window.addEventListener("resize", positionMenu);
          window.addEventListener("scroll", positionMenu, { passive: true });
          setTimeout(() => {
            const onDocClick = (ev) => {
              if (!exportMenu.contains(ev.target) && ev.target !== exportBtn) {
                closeMenu();
                document.removeEventListener("click", onDocClick);
                document.removeEventListener("keydown", onEsc);
              }
            };
            const onEsc = (ev) => {
              if (ev.key === "Escape") {
                closeMenu();
                document.removeEventListener("click", onDocClick);
                document.removeEventListener("keydown", onEsc);
              }
            };
            document.addEventListener("click", onDocClick);
            document.addEventListener("keydown", onEsc);
          }, 0);
        } else {
          closeMenu();
        }
      });
      exportMenu.addEventListener("click", (e) => {
        const item = e.target.closest(".menu-item");
        if (!item) return;
        closeMenu();
      });
    }
    // Mapping kebab/menu interactions (responsive fallback)
    if (mapKebabBtn && mapKebabMenu) {
      const positionMapMenu = () => {
        if (!mapKebabMenu.classList.contains("open")) return;
        mapKebabMenu.style.position = "fixed";
        mapKebabMenu.style.display = "block";
        const rect = mapKebabBtn.getBoundingClientRect();
        const menuW = mapKebabMenu.offsetWidth || 160;
        const menuH = mapKebabMenu.offsetHeight || 120;
        let top = rect.bottom + 6;
        let left = rect.left;
        if (left + menuW > window.innerWidth - 8)
          left = window.innerWidth - menuW - 8;
        if (left < 8) left = 8;
        if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 8;
        if (top < 8) top = 8;
        mapKebabMenu.style.top = `${top}px`;
        mapKebabMenu.style.left = `${left}px`;
      };
      const closeMapMenu = () => {
        mapKebabMenu.classList.remove("open");
        mapKebabBtn.setAttribute("aria-expanded", "false");
        mapKebabMenu.style.position = "";
        mapKebabMenu.style.top = "";
        mapKebabMenu.style.left = "";
        mapKebabMenu.style.display = "";
        window.removeEventListener("resize", positionMapMenu);
        window.removeEventListener("scroll", positionMapMenu);
      };
      mapKebabBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !mapKebabMenu.classList.contains("open");
        if (willOpen) {
          mapKebabMenu.classList.add("open");
          mapKebabBtn.setAttribute("aria-expanded", "true");
          positionMapMenu();
          window.addEventListener("resize", positionMapMenu);
          window.addEventListener("scroll", positionMapMenu, { passive: true });
          setTimeout(() => {
            const onDocClick = (ev) => {
              if (
                !mapKebabMenu.contains(ev.target) &&
                ev.target !== mapKebabBtn
              ) {
                closeMapMenu();
                document.removeEventListener("click", onDocClick);
                document.removeEventListener("keydown", onEsc);
              }
            };
            const onEsc = (ev) => {
              if (ev.key === "Escape") {
                closeMapMenu();
                document.removeEventListener("click", onDocClick);
                document.removeEventListener("keydown", onEsc);
              }
            };
            document.addEventListener("click", onDocClick);
            document.addEventListener("keydown", onEsc);
          }, 0);
        } else {
          closeMapMenu();
        }
      });
      mapKebabMenu.addEventListener("click", (e) => {
        const item = e.target.closest(".menu-item");
        if (!item) return;
        closeMapMenu();
        // forward actions to existing seg-toggle handlers
        if (item === mapKebabViewBtn) {
          mapViewBtn?.click();
        } else if (item === mapKebabEditBtn) {
          mapEditBtn?.click();
        }
      });
    }
    // Export actions
    exportCsvBtn?.addEventListener("click", exportAsCsv);
    exportHtmlBtn?.addEventListener("click", exportAsHtml);
    exportPdfBtn?.addEventListener("click", exportAsPdf);
    // Reload action
    reloadBtn?.addEventListener("click", async () => {
      if (!CURRENT_TPL_ID)
        return setStatus("Select a template to reload.", "error");
      showMask("Refreshing…");
      try {
        await refreshTemplate();
      } finally {
        hideMask();
      }
      setStatus("Reloaded current template.", "success", 1600);
    });
    const closeDeleteModal = () => {
      if (deleteTplModal) deleteTplModal.style.display = "none";
      if (dtTplName) dtTplName.textContent = "";
    };
    dtCloseBtn?.addEventListener("click", closeDeleteModal);
    dtCancelBtn?.addEventListener("click", closeDeleteModal);
    dtConfirmBtn?.addEventListener("click", async () => {
      if (!CURRENT_TPL_ID) return closeDeleteModal();
      setStatus("Deleting…", "info", 2200);
      try {
        // List lines and delete via RPC per line (ensures server-side invariants)
        let lineIds = [];
        try {
          const { data } = await supabase.rpc("rpc_plm_tpl_list_lines", {
            p_tpl_id: CURRENT_TPL_ID,
          });
          lineIds = (data || []).map((r) => r.id || r.line_id).filter(Boolean);
        } catch {
          lineIds = [];
        }
        if (lineIds.length) {
          await Promise.all(
            lineIds.map((id) =>
              supabase.rpc("rpc_plm_tpl_delete_line", { p_line_id: id })
            )
          );
        }
        // Delete header
        const { error: delErr } = await supabase
          .from("plm_tpl_header")
          .delete()
          .eq("id", CURRENT_TPL_ID);
        if (delErr) throw delErr;
        // Reset UI and reload list
        CURRENT_TPL_ID = null;
        tplPicker.value = "";
        if (tplCode) tplCode.value = "";
        refQty.value = "";
        refUom.value = "";
        lossPct.value = "";
        CURRENT_LINES = [blankLine()];
        await loadTemplates();
        renderLines();
        syncHeaderPills();
        renderQA();
        updateExportVisibility();
        setStatus("Template deleted.", "success");
      } catch (err) {
        console.error(err);
        setStatus(`Delete failed: ${err.message}`, "error");
      } finally {
        closeDeleteModal();
      }
    });
    // Lines view/edit toggle (render static rows in View mode)
    const linesPanel = document.getElementById("linesPanel");
    function applyLinesMode() {
      if (linesPanel) {
        if (LINES_EDIT_MODE) linesPanel.classList.remove("view-mode");
        else linesPanel.classList.add("view-mode");
      }
      if (linesViewBtn)
        linesViewBtn.classList.toggle("active", !LINES_EDIT_MODE);
      if (linesEditBtn)
        linesEditBtn.classList.toggle("active", LINES_EDIT_MODE);
      if (!LINES_EDIT_MODE && kbHelpPopover)
        kbHelpPopover.style.display = "none";
      renderLines();
    }
    linesViewBtn?.addEventListener("click", () => {
      LINES_EDIT_MODE = false;
      applyLinesMode();
    });
    linesEditBtn?.addEventListener("click", () => {
      if (!PERM_CAN_EDIT) return;
      LINES_EDIT_MODE = true;
      applyLinesMode();
    });
    // Default to View mode
    LINES_EDIT_MODE = false;
    applyLinesMode();

    // Keyboard help popover (position near button)
    if (kbHelpBtn && kbHelpPopover) {
      const positionKb = () => {
        const rect = kbHelpBtn.getBoundingClientRect();
        const top = rect.bottom + 6 + window.scrollY;
        const w = kbHelpPopover.offsetWidth || 280;
        let left = rect.left + rect.width / 2 - w / 2 + window.scrollX;
        const maxLeft = window.innerWidth - w - 8;
        if (left > maxLeft) left = Math.max(8, maxLeft);
        if (left < 8) left = 8;
        kbHelpPopover.style.top = `${top}px`;
        kbHelpPopover.style.left = `${left}px`;
      };
      const openKb = () => {
        kbHelpPopover.style.display = "block";
        positionKb();
        setTimeout(() => {
          const onDocClick = (ev) => {
            if (!kbHelpPopover.contains(ev.target) && ev.target !== kbHelpBtn) {
              kbHelpPopover.style.display = "none";
              document.removeEventListener("click", onDocClick);
              document.removeEventListener("keydown", onEsc);
            }
          };
          const onEsc = (ev) => {
            if (ev.key === "Escape") {
              kbHelpPopover.style.display = "none";
              document.removeEventListener("click", onDocClick);
              document.removeEventListener("keydown", onEsc);
            }
          };
          document.addEventListener("click", onDocClick);
          document.addEventListener("keydown", onEsc);
        }, 0);
      };
      kbHelpBtn.addEventListener("click", () => {
        if (kbHelpPopover.style.display === "none") openKb();
        else kbHelpPopover.style.display = "none";
      });
      window.addEventListener(
        "scroll",
        () => {
          if (kbHelpPopover.style.display !== "none") positionKb();
        },
        { passive: true }
      );
      window.addEventListener("resize", () => {
        if (kbHelpPopover.style.display !== "none") positionKb();
      });
    }
    // Tabs behavior
    function activateTab(which) {
      const isTemplates = which === "templates";
      const isMapping = which === "mapping";
      const isOverrides = which === "overrides";
      const isPreview = which === "preview";
      const isRebuild = which === "rebuild";
      tabBtnTemplates?.setAttribute("aria-selected", String(isTemplates));
      tabBtnMapping?.setAttribute("aria-selected", String(isMapping));
      tabBtnOverrides?.setAttribute("aria-selected", String(isOverrides));
      tabBtnPreview?.setAttribute("aria-selected", String(isPreview));
      rebuildTabBtn?.setAttribute("aria-selected", String(isRebuild));
      if (tabPanelTemplates) {
        tabPanelTemplates.classList.toggle("active", isTemplates);
        tabPanelTemplates.setAttribute("aria-hidden", String(!isTemplates));
      }
      if (tabPanelMapping) {
        tabPanelMapping.classList.toggle("active", isMapping);
        tabPanelMapping.setAttribute("aria-hidden", String(!isMapping));
      }
      if (tabPanelOverrides) {
        tabPanelOverrides.classList.toggle("active", isOverrides);
        tabPanelOverrides.setAttribute("aria-hidden", String(!isOverrides));
      }
      if (tabPanelPreview) {
        tabPanelPreview.classList.toggle("active", isPreview);
        tabPanelPreview.setAttribute("aria-hidden", String(!isPreview));
      }
      if (tabPanelRebuild) {
        tabPanelRebuild.classList.toggle("active", isRebuild);
        tabPanelRebuild.setAttribute("aria-hidden", String(!isRebuild));
      }
      if (isMapping) {
        if (!MAP_PERM_CAN_VIEW) {
          setStatus("You do not have permission to view Mapping.", "error");
          return;
        }
        // reset mapping to default (view) whenever the tab is activated
        MAP_EDIT_MODE = false;
        applyMapMode();
        initMappingTab();
      }
      if (isPreview) {
        initPreviewTab();
      }
      // reset template/lines edit mode when templates tab is activated
      if (isTemplates) {
        LINES_EDIT_MODE = false;
        applyLinesMode();
      }
      // reset overrides to view mode when overrides tab is activated
      if (isOverrides) {
        if (window && typeof window.setOvrEditMode === "function") {
          window.setOvrEditMode(false);
        } else {
          OVR_EDIT_MODE = false;
        }
      }
    }
    tabBtnTemplates?.addEventListener("click", () => activateTab("templates"));
    tabBtnMapping?.addEventListener("click", () => activateTab("mapping"));
    tabBtnOverrides?.addEventListener("click", () => activateTab("overrides"));
    tabBtnPreview?.addEventListener("click", () => activateTab("preview"));
    rebuildTabBtn?.addEventListener("click", () => activateTab("rebuild"));
    // ERP-style tabs chevrons: horizontal scroll controls
    const tabsWrap = document.querySelector(".tabs-wrap");
    const tabsBar = document.querySelector(".tabs-wrap .tabs");
    const chevLeft = document.querySelector(".tabs-wrap .tabs-chevron.left");
    const chevRight = document.querySelector(".tabs-wrap .tabs-chevron.right");
    if (tabsWrap && tabsBar && chevLeft && chevRight) {
      const updateChevrons = () => {
        const maxScroll =
          (tabsBar.scrollWidth || 0) - (tabsBar.clientWidth || 0);
        const atStart = (tabsBar.scrollLeft || 0) <= 0;
        const atEnd = (tabsBar.scrollLeft || 0) >= maxScroll - 1;
        chevLeft.disabled = atStart;
        chevRight.disabled = atEnd;
      };
      const scrollByAmount = (dx) => {
        tabsBar.scrollBy({ left: dx, top: 0, behavior: "smooth" });
      };
      chevLeft.addEventListener("click", () => scrollByAmount(-160));
      chevRight.addEventListener("click", () => scrollByAmount(160));
      tabsBar.addEventListener("scroll", updateChevrons, { passive: true });
      window.addEventListener("resize", updateChevrons, { passive: true });
      // Initial state
      setTimeout(updateChevrons, 0);
    }
    // Keyboard support for tabs (left/right navigation across Templates, Mapping, Overrides, Preview, Rebuild)
    [
      tabBtnTemplates,
      tabBtnMapping,
      tabBtnOverrides,
      tabBtnPreview,
      rebuildTabBtn,
    ].forEach((btn, idx, arr) => {
      btn?.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          // find next button index, clamp within 0..len-1
          let next = idx + dir;
          if (next < 0) next = 0;
          if (next >= arr.length) next = arr.length - 1;
          const nextBtn = arr[next];
          if (nextBtn) {
            nextBtn.focus();
            // determine which tab to activate based on button
            if (nextBtn === tabBtnTemplates) activateTab("templates");
            else if (nextBtn === tabBtnMapping) activateTab("mapping");
            else if (nextBtn === tabBtnOverrides) activateTab("overrides");
            else if (nextBtn === tabBtnPreview) activateTab("preview");
            else if (nextBtn === rebuildTabBtn) activateTab("rebuild");
          }
        }
      });
    });
    if (!MAP_PERM_CAN_VIEW && tabBtnMapping) {
      tabBtnMapping.disabled = true;
      tabBtnMapping.title = "No permission";
    }
  } catch (err) {
    console.error(err);
    setStatus(`Init error: ${err.message}`, "error");
  }
})();
