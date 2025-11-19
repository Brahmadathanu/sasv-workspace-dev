/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

// Elements
const el = (id) => document.getElementById(id);
const tplPicker = el("tplPicker");
// Tabs and Mapping elements
const tabBtnTemplates = el("tabBtnTemplates");
const tabBtnMapping = el("tabBtnMapping");
const tabPanelTemplates = el("tabTemplates");
const tabPanelMapping = el("tabMapping");
const mapSkuPicker = el("mapSkuPicker");
const mapTplPicker = el("mapTplPicker");
const mapSetBtn = el("mapSetBtn");
const mapClearBtn = el("mapClearBtn");
const mapRefreshBtn = el("mapRefreshBtn");
const mapNewBtn = el("mapNewBtn");
const mapNewModal = el("mapNewModal");
const mapNewCloseBtn = el("mapNewCloseBtn");
const mapNewCancelBtn = el("mapNewCancelBtn");
const mapNewCreateBtn = el("mapNewCreateBtn");
const mapNewSkuPicker = el("mapNewSkuPicker");
const mapNewTplPicker = el("mapNewTplPicker");
const mapMappedBody = el("mapMappedBody");
const tplCode = el("tplCode");
const refQty = el("refQty");
const refUom = el("refUom");
const lossPct = el("lossPct");
const linesBody = el("linesBody");
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

// Data caches
let UOMS = [];
let STOCK_ITEMS = []; // PLM-category items
let TEMPLATES = [];
let CURRENT_TPL_ID = null;
let CURRENT_LINES = [];
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
async function mapLoadSkus() {
  if (!mapSkuPicker) return;
  const { data, error } = await supabase
    .from("v_sku_catalog_enriched")
    .select("sku_id, sku_label")
    .order("sku_label", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  mapSkuPicker.innerHTML = rows
    .map(
      (r) => `<option value='${r.sku_id}'>${escapeHtml(r.sku_label)}</option>`
    )
    .join("");
}

async function mapLoadTemplates() {
  if (!mapTplPicker) return;
  const { data, error } = await supabase
    .from("plm_tpl_header")
    .select("tpl_id:id, tpl_code:code")
    .order("code", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  mapTplPicker.innerHTML = rows
    .map(
      (r) => `<option value='${r.tpl_id}'>${escapeHtml(r.tpl_code)}</option>`
    )
    .join("");
}

async function mapRefreshMap() {
  if (!mapSkuPicker || !mapTplPicker) return;
  const skuId = parseInt(mapSkuPicker.value, 10);
  if (!skuId) return;
  const { data, error } = await supabase.rpc("rpc_plm_map_get_for_sku", {
    p_sku_id: skuId,
  });
  if (error) return setStatus(`Load map failed: ${error.message}`, "error");
  if (data?.tpl_id) mapTplPicker.value = String(data.tpl_id);
}

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
            .select("sku_id, sku_label")
            .in("sku_id", skuIds)
        : Promise.resolve({ data: [] }),
      tplIds.length
        ? supabase.from("plm_tpl_header").select("id, code").in("id", tplIds)
        : Promise.resolve({ data: [] }),
    ]);
    const skuMap = new Map(
      (skuMetaRes.data || []).map((s) => [Number(s.sku_id), s.sku_label])
    );
    const tplMap = new Map(
      (tplMetaRes.data || []).map((t) => [Number(t.id), t.code])
    );
    const fmt = (d) => (d ? new Date(d).toLocaleString() : "");
    mapMappedBody.innerHTML = rows
      .map((r) => {
        const skuLabel = skuMap.get(Number(r.sku_id)) || r.sku_id;
        const tplCode = tplMap.get(Number(r.tpl_id)) || r.tpl_id;
        return `<tr>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            String(skuLabel)
          )}</td>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            String(tplCode)
          )}</td>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            r.notes || ""
          )}</td>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            fmt(r.last_updated_at)
          )}</td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    console.error(e);
    setStatus(`Load mapped list failed: ${e.message}`, "error");
    mapMappedBody.innerHTML = "";
  }
}

function applyMappingPermissions() {
  const disable = !MAP_PERM_CAN_EDIT;
  if (mapSetBtn) mapSetBtn.disabled = disable;
  if (mapClearBtn) mapClearBtn.disabled = disable;
  if (mapNewBtn) mapNewBtn.disabled = disable;
}

async function initMappingTab() {
  if (MAP_INIT_DONE) return;
  try {
    await mapLoadSkus();
    await mapLoadTemplates();
    await mapRefreshMap();
    await mapLoadMappedList();
    mapSkuPicker?.addEventListener("change", mapRefreshMap);
    mapRefreshBtn?.addEventListener("click", mapLoadMappedList);
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
      // Populate Templates from mapping picker with placeholder, no default
      if (mapNewTplPicker && mapTplPicker) {
        const opts = Array.from(mapTplPicker.options || []).map((o) => {
          const val = o.value || "";
          const txt = o.textContent || "";
          if (!val) return ""; // skip any placeholder that may exist
          return `<option value='${val}'>${escapeHtml(String(txt))}</option>`;
        });
        mapNewTplPicker.innerHTML = [
          "<option value=''>Select Template</option>",
          ...opts,
        ].join("");
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
      await mapRefreshMap();
      await mapLoadMappedList();
    });
    mapSetBtn?.addEventListener("click", async () => {
      if (!MAP_PERM_CAN_EDIT)
        return setStatus("No permission to edit.", "error");
      const skuId = parseInt(mapSkuPicker.value, 10);
      const tplId = parseInt(mapTplPicker.value, 10);
      if (!skuId || !tplId)
        return setStatus("Select both SKU and Template.", "error");
      const { error } = await supabase.rpc("rpc_plm_map_set", {
        p_sku_id: skuId,
        p_tpl_id: tplId,
      });
      if (error)
        return setStatus(`Set mapping failed: ${error.message}`, "error");
      setStatus("Mapping saved.", "success");
      await mapLoadMappedList();
    });
    mapClearBtn?.addEventListener("click", async () => {
      if (!MAP_PERM_CAN_EDIT)
        return setStatus("No permission to edit.", "error");
      const skuId = parseInt(mapSkuPicker.value, 10);
      if (!skuId) return setStatus("Select a SKU.", "error");
      const { error } = await supabase.rpc("rpc_plm_map_clear", {
        p_sku_id: skuId,
      });
      if (error) return setStatus(`Clear failed: ${error.message}`, "error");
      setStatus("Mapping cleared.", "success");
      await mapRefreshMap();
      await mapLoadMappedList();
    });
    applyMappingPermissions();
    MAP_INIT_DONE = true;
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
        <td class="nowrap">${i + 1}</td>
        <td class="nowrap code-cell">${escapeHtml(itemCode)}</td>
        <td class="item-cell">${escapeHtml(itemName)}</td>
        <td class="right">${escapeHtml(qtyStr)}</td>
        <td>${escapeHtml(uomCode)}</td>
        <td class="right">${escapeHtml(wastStr)}</td>
        <td>${optStr}</td>
        <td>${remStr}</td>
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
      <td class="nowrap">${i + 1}</td>
      <td class="nowrap code-cell">${escapeHtml(itemCode)}</td>
      <td class="item-cell"><select class="cell item">${itemOptions}</select></td>
      <td class="right"><input class="cell qty" type="number" step="0.0001" min="0" value="${
        ln.qty_per_reference_output ?? ""
      }"/></td>
      <td><select class="cell uom">${uomOptions}</select></td>
      <td class="right"><input class="cell wast" type="number" step="0.0001" min="0" max="0.9999" value="${
        ln.wastage_pct ?? ""
      }"/></td>
      <td><input type="checkbox" class="cell opt" ${
        ln.is_optional ? "checked" : ""
      }/></td>
      <td><input type="text" class="cell rem" value="${escapeHtml(
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
}

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

function downloadBlob(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
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
}

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
function formatDateStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

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
// Keyboard shortcuts (Edit mode)
document.addEventListener("keydown", (e) => {
  if (!LINES_EDIT_MODE) return;
  // Ignore when template modals/popovers are open
  if (
    newTplModal?.style.display === "flex" ||
    editTplModal?.style.display === "flex" ||
    deleteTplModal?.style.display === "flex"
  )
    return;
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

    // Delete Template action
    deleteTplBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!CURRENT_TPL_ID) return;
      if (dtTplName)
        dtTplName.textContent =
          tplPicker.selectedOptions?.[0]?.textContent ||
          tplCode.value ||
          `#${CURRENT_TPL_ID}`;
      if (deleteTplModal) deleteTplModal.style.display = "flex";
    });
    const closeDeleteModal = () => {
      if (deleteTplModal) deleteTplModal.style.display = "none";
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
      tabBtnTemplates?.setAttribute("aria-selected", String(isTemplates));
      tabBtnMapping?.setAttribute("aria-selected", String(!isTemplates));
      if (tabPanelTemplates) {
        tabPanelTemplates.classList.toggle("active", isTemplates);
        tabPanelTemplates.setAttribute("aria-hidden", String(!isTemplates));
      }
      if (tabPanelMapping) {
        tabPanelMapping.classList.toggle("active", !isTemplates);
        tabPanelMapping.setAttribute("aria-hidden", String(isTemplates));
      }
      if (!isTemplates) {
        if (!MAP_PERM_CAN_VIEW) {
          setStatus("You do not have permission to view Mapping.", "error");
          return;
        }
        initMappingTab();
      }
    }
    tabBtnTemplates?.addEventListener("click", () => activateTab("templates"));
    tabBtnMapping?.addEventListener("click", () => activateTab("mapping"));
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
    // Keyboard support for tabs
    [tabBtnTemplates, tabBtnMapping].forEach((btn) => {
      btn?.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const toMapping = btn === tabBtnTemplates && e.key === "ArrowRight";
          const toTemplates = btn === tabBtnMapping && e.key === "ArrowLeft";
          if (toMapping) {
            tabBtnMapping.focus();
            activateTab("mapping");
          } else if (toTemplates) {
            tabBtnTemplates.focus();
            activateTab("templates");
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
