/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";
import { loadAccessContext } from "../public/shared/js/mrpAccess.js";
import { Platform } from "../public/shared/js/platform.js";
import {
  ensureDetailModal,
  openDetailModal,
} from "../public/shared/js/detailModal.js";
import { downloadCSV, downloadJSON } from "../public/shared/js/mrpExports.js";
import {
  monthInputToDateString,
  computePresetRange,
} from "../public/shared/js/mrpPlanRange.js";

// Small adapters
function getStockItemId(row) {
  return (
    row.stock_item_id ??
    row.rm_stock_item_id ??
    row.purchase_stock_item_id ??
    null
  );
}
function getStockItemName(row) {
  return (
    row.stock_item_name ??
    row.rm_name ??
    row.purchase_item_name ??
    row.name ??
    ""
  );
}
function getMonthStart(row) {
  return row.month_start ?? row.period_start ?? null;
}

// Generic RPC paged fetch helper. Returns { rows: Array, total: number }
async function rpcFetchPaged(fnName, params) {
  const res = await supabase.rpc(fnName, params);
  if (res.error) throw res.error;
  const rows = (res.data || []).map((r) => r.row_data);
  const total =
    res.data && res.data.length ? Number(res.data[0].total_count) : 0;
  return { rows, total };
}

// DOM helpers
const $ = (id) => document.getElementById(id);

// simple debounce helper
function debounce(fn, wait = 300) {
  let t = null;
  return function (...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Final Procurement Plan: visible columns in the table (rest shown in detail modal)
const FP_VISIBLE_COLS = [
  "month_start",
  "stock_item_id",
  "stock_item_name",
  "uom_code",
  "net_need_qty",
  "procure_qty",
  "closing_qty",
];

// Traceability grid should show unified (horizon) columns only.
// Batch-specific fields are shown inside the detail modal (RM Batch Execution).
const TR_GRID_COLS = [
  "material_kind",
  "period_start",
  "stock_item_id",
  "stock_item_name",
  "product_id",
  "product_name",
  "sku_id",
  "region_code",
  "planned_qty",
  "issued_qty",
  "remaining_qty",
  "allocation_approx",
  "has_unassigned_issues",
  "first_issue_date",
  "last_issue_date",
];

function chooseTraceCols() {
  return TR_GRID_COLS;
}

const COL_LABELS = {
  material_kind: "Material Kind",
  stock_item_id: "Stock Item ID",
  stock_item_name: "Stock Item",
  uom_id: "UOM ID",
  uom_code: "UOM",
  uom_dimension_id: "UOM Dimension ID",
  month_start: "Month",
  opening_qty: "Opening Qty",
  gross_required_qty_pre_ceiling: "Gross Req (Pre Ceiling)",
  gross_required_qty_post_ceiling: "GROSS Req (Post Ceiling)",
  gross_required_qty: "Gross Req",
  gross_ceiling_applied: "Gross Ceiling Applied?",
  net_need_qty: "Net Need Qty",
  moq_qty: "MOQ Qty",
  procure_qty_pre_ceiling: "Procure Qty (Pre Ceiling)",
  procure_qty_post_ceiling: "Procure Qty (Post Ceiling)",
  procure_qty: "Procure Qty",
  closing_qty: "Closing Qty",
  carry_in_excess: "Carry In Excess",
  carry_out_excess: "Carry Out Excess",
};

function prettyKey(k) {
  if (!k) return "";
  if (COL_LABELS[k]) return COL_LABELS[k];
  return k
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// Format a month value like '2026-11-01' -> 'Nov 2026'
function formatMonthValue(v) {
  if (!v && v !== 0) return "";
  try {
    let d = v instanceof Date ? v : new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch {
    return String(v);
  }
}

// Return computed master range using master-* controls
function getMasterRange() {
  const preset = $("master-preset")?.value || "next12";
  const startVal = $("master-start")?.value || null;
  const endVal = $("master-end")?.value || null;
  const range = computePresetRange(preset, startVal, new Date().getFullYear());
  const start = monthInputToDateString(range.start || startVal || null);
  const end = monthInputToDateString(range.end || endVal || null);
  return { preset, start, end };
}

// Format numbers: integers shown without decimals, floats with 3 decimal places
function formatNumberValue(n) {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

// Global overlay selection + result caches
let selectedOverlayRunId = null;
// cache last rendered rows (for exports to match what user sees)
let fpLastRows = [];
let overlayLastRows = [];
let convLastRows = [];
let traceLastRows = [];

// Suppress master-start/master-end change handling when programmatically updating
let suppressMasterRangeChange = false;

// Detail modal data cache
const detailModalCache = new Map();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(stockItemId, month, sectionType) {
  return `${stockItemId}|${month || "null"}|${sectionType}`;
}

function getCachedData(stockItemId, month, sectionType) {
  const key = getCacheKey(stockItemId, month, sectionType);
  const cached = detailModalCache.get(key);
  if (!cached) return null;

  // Check if cache is expired
  if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
    detailModalCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedData(stockItemId, month, sectionType, data) {
  const key = getCacheKey(stockItemId, month, sectionType);
  detailModalCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function invalidateDetailCache(stockItemId) {
  // Clear all cache entries for a specific stock item
  for (const [key] of detailModalCache) {
    if (key.startsWith(`${stockItemId}|`)) {
      detailModalCache.delete(key);
    }
  }
}

// Export for potential external usage
window.invalidateDetailCache = invalidateDetailCache;

// Async section loaders with caching and error handling
async function loadPMContributors(stockItemId, month) {
  const cached = getCachedData(stockItemId, month, "pm_contrib");
  if (cached) return cached;

  try {
    const { data } = await supabase
      .from("v_mrp_pm_contrib_detail")
      .select("*")
      .eq("month_start", month)
      .eq("stock_item_id", stockItemId)
      .order("month_start", { ascending: true })
      .limit(2000);

    const result = { data: data || [], error: null };
    setCachedData(stockItemId, month, "pm_contrib", result);
    return result;
  } catch (error) {
    const result = { data: [], error: error.message };
    return result;
  }
}

async function loadConversionContributors(stockItemId, month) {
  const cached = getCachedData(stockItemId, month, "conversion_contrib");
  if (cached) return cached;

  try {
    const { data } = await supabase
      .from("v_mrp_rm_conversion_contrib_detail")
      .select("*")
      .eq("month_start", month)
      .eq("consume_stock_item_id", stockItemId)
      .order("month_start", { ascending: true })
      .limit(2000);

    const result = { data: data || [], error: null };
    setCachedData(stockItemId, month, "conversion_contrib", result);
    return result;
  } catch (error) {
    const result = { data: [], error: error.message };
    return result;
  }
}

async function loadRMTraceHorizon(stockItemId, month) {
  const cacheKeyMonth = month || "any";
  const cached = getCachedData(stockItemId, cacheKeyMonth, "rm_trace_horizon");
  if (cached) return cached;

  try {
    let q = supabase
      .from("v_mrp_rm_trace_horizon")
      .select("*")
      .eq("rm_stock_item_id", stockItemId)
      .order("period_start", { ascending: true })
      .limit(2000);

    if (month) q = q.eq("period_start", month);

    const { data, error } = await q;
    const result = { data: data || [], error: error ? error.message : null };
    setCachedData(stockItemId, cacheKeyMonth, "rm_trace_horizon", result);
    return result;
  } catch (e) {
    return { data: [], error: e.message };
  }
}

async function loadRMTraceBatch(stockItemId) {
  const cached = getCachedData(stockItemId, "any", "rm_trace_batch");
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from("v_mrp_rm_trace_batch")
      .select("*")
      .eq("rm_stock_item_id", stockItemId)
      .order("period_start", { ascending: true })
      .limit(2000);

    const result = { data: data || [], error: error ? error.message : null };
    setCachedData(stockItemId, "any", "rm_trace_batch", result);
    return result;
  } catch (e) {
    return { data: [], error: e.message };
  }
}

// Helper: detect whether a month string (YYYY-MM-01 or Date) is strictly after current month
function isFutureMonth(monthStr) {
  if (!monthStr) return false;
  const d = monthStr instanceof Date ? monthStr : new Date(String(monthStr));
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const m = new Date(d.getFullYear(), d.getMonth(), 1);
  return m > cur;
}

async function loadOverlayContributions(stockItemId, month) {
  const cached = getCachedData(stockItemId, month, "overlay");
  if (cached) return cached;

  try {
    const { data } = await supabase
      .from("v_mrp_rm_overlay_season_monthly_active")
      .select("*")
      .eq("month_start", month)
      .eq("rm_stock_item_id", stockItemId)
      .order("overlay_run_id", { ascending: false })
      .limit(2000);

    const result = { data: data || [], error: null };
    setCachedData(stockItemId, month, "overlay", result);
    return result;
  } catch (error) {
    const result = { data: [], error: error.message };
    return result;
  }
}

// Pager state for each tab
const pagerState = {
  fp: { page: 0, perPage: 100, total: null },
  ov: { page: 0, perPage: 100, total: null },
  conv: { page: 0, perPage: 100, total: null },
  tr: { page: 0, perPage: 100, total: null },
};

function updatePagerUI(prefix) {
  try {
    const state = pagerState[prefix];
    const info = $(`${prefix}-pager-info`);
    const prev = $(`${prefix}-pager-prev`);
    const next = $(`${prefix}-pager-next`);
    const pill = $(`${prefix}-rowcount`);
    if (!info) return;
    const per = state.perPage;
    const page = state.page || 0;
    const total = Number.isFinite(state.total) ? state.total : null;
    if (total === null) {
      info.textContent = `Page ${page + 1}`;
      if (prev) prev.disabled = page <= 0;
      if (next) next.disabled = false;
      // update pill with currently shown count
      if (pill) {
        const shown = {
          fp: fpLastRows.length,
          ov: overlayLastRows.length,
          conv: convLastRows.length,
          tr: traceLastRows.length,
        }[prefix];
        pill.textContent = shown != null ? `${shown} shown` : "—";
      }
      return;
    }
    const totalPages = Math.max(1, Math.ceil(total / per));
    info.textContent = `Page ${page + 1} of ${totalPages}`;
    if (prev) prev.disabled = page <= 0;
    if (next) next.disabled = page >= totalPages - 1;
    if (pill) pill.textContent = `${total.toLocaleString()} rows`;
  } catch (e) {
    console.debug("updatePagerUI failed", e);
  }
}

// Loading overlay helpers (mirror master console)
// Loading overlay helpers (mirror master console)
// Implement a reference-counted overlay manager so multiple background
// processes can show/hide the mask without racing each other. Also
// reparent overlay to the active tab container when the active tab changes.
if (!window.__mrpLoadingState)
  window.__mrpLoadingState = { count: 0, container: null };

function _findActiveOverlayContainer() {
  const activeTab = document.querySelector(".tab.active");
  let container = null;
  if (activeTab && activeTab.dataset && activeTab.dataset.tab) {
    const pane = document.getElementById(activeTab.dataset.tab);
    if (pane)
      container =
        pane.querySelector(".table-wrap") ||
        pane.querySelector("#trace-panels") ||
        pane;
  }
  if (!container)
    container = document.querySelector(".console-wrapper") || document.body;
  return container;
}

function showLoading(msg) {
  try {
    const el = document.getElementById("mrpLoadingOverlay");
    if (!el) return;
    const txt = el.querySelector(".loader-text");
    if (txt && msg) txt.textContent = msg;

    // ensure overlay is parented to the active container every time
    try {
      const container = _findActiveOverlayContainer();
      if (container) {
        const cs = window.getComputedStyle(container);
        if (cs.position === "static") container.style.position = "relative";
        if (el.parentNode !== container) container.appendChild(el);
        window.__mrpLoadingState.container = container;
      }
    } catch (e) {
      console.debug("attach overlay failed", e);
    }

    // increment refcount and show
    window.__mrpLoadingState.count = (window.__mrpLoadingState.count || 0) + 1;
    el.setAttribute("aria-hidden", "false");
    el.classList.add("active");
  } catch (e) {
    console.debug(e);
  }
}

function hideLoading() {
  try {
    const el = document.getElementById("mrpLoadingOverlay");
    if (!el) return;
    // decrement refcount and only hide when zero
    window.__mrpLoadingState.count = Math.max(
      0,
      (window.__mrpLoadingState.count || 1) - 1,
    );
    if (window.__mrpLoadingState.count === 0) {
      el.classList.remove("active");
      el.setAttribute("aria-hidden", "true");
    }
  } catch (e) {
    console.debug(e);
  }
}

// When user clicks tabs (or any element that toggles .tab.active), reparent overlay
// so it remains centered over the active pane while loading. This listener is
// lightweight and only reparents when the overlay is active (count>0).
document.addEventListener("click", (ev) => {
  try {
    if (!(window.__mrpLoadingState && window.__mrpLoadingState.count > 0))
      return;
    const tab = ev.target.closest && ev.target.closest(".tab");
    if (!tab) return;
    const el = document.getElementById("mrpLoadingOverlay");
    if (!el) return;
    const container = _findActiveOverlayContainer();
    if (container && el.parentNode !== container) {
      const cs = window.getComputedStyle(container);
      if (cs.position === "static") container.style.position = "relative";
      container.appendChild(el);
      window.__mrpLoadingState.container = container;
    }
  } catch {
    /* ignore */
  }
});

async function showAccess() {
  const badge = $("accessBadge");
  try {
    const ctx = await loadAccessContext();
    const mods = ctx.module_permissions || {};
    const allowed =
      mods["mrp.procurement_workbench"]?.can_view ||
      mods["mrp.procurement"]?.can_view ||
      (ctx.roles && ctx.roles.length > 0);
    if (!allowed) {
      badge.textContent = "Access denied";
      document.body.innerHTML = '<div style="padding:24px">Access denied</div>';
      return false;
    }
    // Roles list is not relevant on this module UI — hide the badge
    badge.style.display = "none";
    return true;
  } catch (e) {
    badge.textContent = "Access check failed";
    console.debug(e);
    return false;
  }
}

function renderTable(theadId, tbodyId, rows, visibleCols) {
  const thead = $(theadId);
  const tbody = $(tbodyId);
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!rows || !rows.length) {
    if (visibleCols && visibleCols.length) {
      const tr = document.createElement("tr");
      visibleCols.forEach((k) => {
        const th = document.createElement("th");
        th.textContent = prettyKey(k);
        // Force sticky positioning to work
        const label = prettyKey(k);
        th.textContent = label;
        // Alignment rules for headers
        const leftAlign = ["stock_item_name", "product_name"];
        const centerAlign = [
          "material_kind",
          "period_start",
          "stock_item_id",
          "sku_id",
          "region_code",
        ];
        const rightAlign = [
          "planned_qty",
          "issued_qty",
          "remaining_qty",
          "batch_size",
        ];
        if (leftAlign.includes(k)) th.style.textAlign = "left";
        else if (centerAlign.includes(k)) th.style.textAlign = "center";
        else if (rightAlign.includes(k)) th.style.textAlign = "right";
        else th.style.textAlign = "center";
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    } else {
      const noDataTr = document.createElement("tr");
      const noDataTh = document.createElement("th");
      noDataTh.textContent = "No data";
      // Force sticky positioning and centering
      noDataTh.style.cssText =
        "position: -webkit-sticky !important; position: sticky !important; top: 0 !important; z-index: 100 !important; background: linear-gradient(180deg, #f8fafc, #ffffff) !important; vertical-align: middle; text-align: center;";
      noDataTr.appendChild(noDataTh);
      thead.appendChild(noDataTr);
    }
    return;
  }
  const keys =
    visibleCols && visibleCols.length ? visibleCols : Object.keys(rows[0]);
  const tr = document.createElement("tr");
  keys.forEach((k) => {
    const th = document.createElement("th");
    const label = prettyKey(k);
    th.textContent = label;
    // Force sticky positioning to work; align headers per key
    const baseCss =
      "position: -webkit-sticky !important; position: sticky !important; top: 0 !important; z-index: 100 !important; background: linear-gradient(180deg, #f8fafc, #ffffff) !important;";
    const leftAlign = ["stock_item_name", "product_name"];
    const centerAlign = [
      "material_kind",
      "period_start",
      "stock_item_id",
      "sku_id",
      "region_code",
    ];
    const rightAlign = [
      "planned_qty",
      "issued_qty",
      "remaining_qty",
      "batch_size",
    ];
    if (leftAlign.includes(k))
      th.style.cssText = baseCss + " text-align: left;";
    else if (centerAlign.includes(k))
      th.style.cssText = baseCss + " text-align: center;";
    else if (rightAlign.includes(k))
      th.style.cssText = baseCss + " text-align: right;";
    else th.style.cssText = baseCss + " text-align: center;";
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  // Setup a sticky header clone fallback for environments where CSS sticky fails
  try {
    const tableEl = thead.closest && thead.closest("table");
    if (tableEl) setupStickyHeaderFallback(tableEl);
  } catch {
    /* ignore */
  }
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    // vertically center all row cells
    keys.forEach((k) => {
      const td = document.createElement("td");
      // Resolve common trace field name variants for robust rendering
      const v = resolveCellValue(r, k);
      // Format month-like columns
      if (k === "month_start" || k === "period_start") {
        const mval = v === null || v === undefined ? "" : formatMonthValue(v);
        td.textContent = mval;

        // If this row is future and issued_qty is 0, add a subtle badge
        try {
          const issued = resolveCellValue(r, "issued_qty");
          if (
            k === "period_start" &&
            isFutureMonth(v) &&
            Number(issued || 0) === 0
          ) {
            td.innerHTML = `${mval}<div style="margin-top:4px;font-size:11px;color:#64748b">Planned (future)</div>`;
          }
        } catch {
          /* ignore */
        }
      } else if (
        v !== null &&
        v !== undefined &&
        v !== "" &&
        !Number.isNaN(Number(v))
      ) {
        td.textContent = formatNumberValue(Number(v));
      } else {
        td.textContent = v === null || v === undefined ? "" : String(v);
      }
      td.style.verticalAlign = "middle";
      // horizontal alignment rules for body cells
      const leftAlignBody = ["stock_item_name", "product_name"];
      const centerAlignBody = [
        "material_kind",
        "period_start",
        "stock_item_id",
        "sku_id",
        "region_code",
      ];
      const rightAlignBody = [
        "planned_qty",
        "issued_qty",
        "remaining_qty",
        "batch_size",
      ];
      if (leftAlignBody.includes(k)) td.style.textAlign = "left";
      else if (centerAlignBody.includes(k)) td.style.textAlign = "center";
      else if (rightAlignBody.includes(k)) td.style.textAlign = "right";
      // fallback: if no explicit alignment chosen, keep left for names
      else if (!td.style.textAlign) td.style.textAlign = "center";
      tr.appendChild(td);
    });
    tr.addEventListener("click", () => onRowClick(r));
    tbody.appendChild(tr);
  });
}

// Resolve cell value for common alternative keys found in trace RPCs
function resolveCellValue(row, key) {
  if (!row) return null;
  // stock item id/name variants
  if (key === "stock_item_id") return getStockItemId(row);
  if (key === "stock_item_name") return getStockItemName(row);
  // planned/issued/remaining variants
  if (key === "planned_qty")
    return row.planned_qty ?? row.planned_rm_qty ?? row.planned_pm_qty ?? null;
  if (key === "issued_qty")
    return row.issued_qty ?? row.issued_rm_qty ?? row.issued_pm_qty ?? null;
  if (key === "remaining_qty")
    return (
      row.remaining_qty ?? row.remaining_rm_qty ?? row.remaining_pm_qty ?? null
    );
  // batch fields may be prefixed for RM
  if (key === "batch_number")
    return row.batch_number ?? row.rm_batch_number ?? null;
  if (key === "batch_size") return row.batch_size ?? row.rm_batch_size ?? null;
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  return null;
}

// Fallback: clone the table header into an absolutely positioned element
// inside the table-wrap and toggle visibility on scroll. This keeps headers
// visible in environments (some Electron/Chromium setups) where position:sticky
// is unreliable due to stacking contexts or platform quirks.
function setupStickyHeaderFallback(table) {
  if (!table || table.__stickyCloneInstalled) return;
  const wrap = table.closest(".table-wrap") || table.parentElement;
  if (!wrap) return;

  // Create holder
  const holder = document.createElement("div");
  holder.className = "ppw-sticky-clone-holder";
  holder.style.position = "absolute";
  holder.style.top = "0";
  holder.style.left = "0";
  holder.style.right = "0";
  holder.style.pointerEvents = "none";
  holder.style.overflow = "hidden";
  holder.style.display = "none";
  holder.style.zIndex = "200";

  // Clone minimal header structure
  const cloneTable = document.createElement("table");
  cloneTable.className = table.className + " ppw-table-clone";
  cloneTable.style.borderCollapse =
    getComputedStyle(table).borderCollapse || "separate";
  cloneTable.style.background = "transparent";
  const thead = table.querySelector("thead");
  if (!thead) return;
  const clonedThead = thead.cloneNode(true);
  cloneTable.appendChild(clonedThead);
  holder.appendChild(cloneTable);
  wrap.appendChild(holder);

  function updateWidths() {
    try {
      const ths = Array.from(table.querySelectorAll("thead th"));
      const cths = Array.from(cloneTable.querySelectorAll("thead th"));
      const tableRect = table.getBoundingClientRect();
      cloneTable.style.width = tableRect.width + "px";
      ths.forEach((t, i) => {
        const w = t.getBoundingClientRect().width;
        if (cths[i]) cths[i].style.width = w + "px";
      });
    } catch {
      /* ignore */
    }
  }

  function onScroll() {
    const show = wrap.scrollTop > 0;
    holder.style.display = show ? "block" : "none";
    if (show) updateWidths();
  }

  // Recompute on resize/paint
  const ro = new ResizeObserver(() => updateWidths());
  ro.observe(table);
  window.addEventListener("resize", updateWidths, { passive: true });
  wrap.addEventListener("scroll", onScroll, { passive: true });

  // mark installed so we don't duplicate
  table.__stickyCloneInstalled = true;
  // initial widths
  updateWidths();
}

async function onRowClick(row) {
  ensureDetailModal();
  const kind = row.material_kind ?? null;
  const id = getStockItemId(row);
  const month = getMonthStart(row);
  const sections = [];

  // Enhanced metadata display with key metrics first
  function buildSummarySection(r) {
    const materialKindMap = {
      raw_material: "Raw Material",
      packaging_material: "Packaging Material",
    };
    const keyMetrics = {
      "Stock Item ID": r.stock_item_id,
      "Material Kind":
        materialKindMap[r.material_kind] ||
        prettyKey(r.material_kind || "") ||
        r.material_kind ||
        "",
      Month: formatMonthValue(r.month_start || ""),
      UOM: r.uom_code || "",
      "Net Need Qty": formatNumberValue(r.net_need_qty || 0),
      "Procure Qty": formatNumberValue(r.procure_qty || 0),
      "Closing Qty": formatNumberValue(r.closing_qty || 0),
    };

    const detailedData = {};
    Object.keys(r || {}).forEach((k) => {
      const prettyK = prettyKey(k);
      if (!Object.values(keyMetrics).includes(r[k]) && prettyK !== k) {
        const value = r[k];
        // Format numbers with proper localization
        if (typeof value === "number" && !Number.isNaN(value)) {
          detailedData[prettyK] = formatNumberValue(value);
        } else {
          detailedData[prettyK] =
            value === null || value === undefined ? "—" : String(value);
        }
      }
    });

    return { keyMetrics, detailedData };
  }

  const summaryData = buildSummarySection(row);

  // Key metrics section (always first)
  sections.push({
    title:
      '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M3 3v10a1 1 0 001 1h6a1 1 0 001-1V6.414l1-1V13a2 2 0 01-2 2H4a2 2 0 01-2-2V3a2 2 0 012-2h5.586l-1 1H4a1 1 0 00-1 1z"/><path d="M13.5 1.5L15 3l-8 8-2 .5.5-2 8-8z"/></svg>Key Metrics',
    type: "enhanced-kv",
    data: summaryData.keyMetrics,
    isKeySection: true,
  });

  // Detailed attributes section
  if (Object.keys(summaryData.detailedData).length > 0) {
    sections.push({
      title:
        '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M3 2a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1H3zm0-1h10a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2z"/><path d="M5.5 6.5A.5.5 0 016 6h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5zM6 8a.5.5 0 000 1h4a.5.5 0 000-1H6zm0 2a.5.5 0 000 1h4a.5.5 0 000-1H6z"/></svg>Detailed Attributes',
      type: "enhanced-kv",
      data: summaryData.detailedData,
      isDetailSection: true,
    });
  }

  const itemName = getStockItemName(row);
  const subtitle = `${kind ? prettyKey(kind) + " • " : ""}ID: ${id} • ${
    month || "No date"
  }`;

  // Open modal immediately with basic sections, then load additional data
  openDetailModal({
    title: itemName || `Stock Item ${id}`,
    subtitle: subtitle,
    sections: [
      ...sections,
      {
        title:
          '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px;animation:spin 1s linear infinite"><path d="M8 3a5 5 0 104.546 2.914.5.5 0 11-.908-.417A4 4 0 108 4a.5.5 0 010-1z"/></svg>Loading additional data...',
        type: "loading-state",
        data: "Fetching contributors, overlays, and trace data...",
      },
    ],
    actions: [
      {
        label: "Export Data",
        onClick: () => {
          const exportData = {
            stock_item_id: id,
            stock_item_name: itemName,
            material_kind: kind,
            month_start: month,
            base_data: row,
            sections: sections
              .filter((s) => s.rows)
              .map((s) => ({
                title: s.title,
                type: s.tableMeta?.type,
                row_count: s.rows?.length || 0,
                data: s.rows,
              })),
          };

          import("../public/shared/js/mrpExports.js").then(
            ({ downloadJSON }) => {
              downloadJSON(
                `procurement_detail_${id}_${month || "current"}`,
                exportData,
              );
            },
          );
        },
      },
    ],
  });

  // Load additional data sections asynchronously
  const additionalSections = [];

  try {
    // Load data for different material types
    if (kind === "packaging_material") {
      const pmResult = await loadPMContributors(id, month);

      if (pmResult.error) {
        additionalSections.push({
          title:
            '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M6 1a1 1 0 00-1 1v1H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1H11V2a1 1 0 00-1-1H6zM5 3V2h4v1H5zm-1 1h8v9H4V4z"/><path d="M7 6a1 1 0 112 0v3a1 1 0 11-2 0V6z"/></svg>PM Contributors',
          type: "error-state",
          data: `Unable to load PM contributor data: ${pmResult.error}`,
        });
      } else if (pmResult.data.length === 0) {
        additionalSections.push({
          title:
            '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M6 1a1 1 0 00-1 1v1H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1H11V2a1 1 0 00-1-1H6zM5 3V2h4v1H5zm-1 1h8v9H4V4z"/><path d="M7 6a1 1 0 112 0v3a1 1 0 11-2 0V6z"/></svg>PM Contributors',
          type: "empty-state",
          data: "No PM contributor records found for this item and period.",
        });
      } else {
        additionalSections.push({
          title: `<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M6 1a1 1 0 00-1 1v1H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1H11V2a1 1 0 00-1-1H6zM5 3V2h4v1H5zm-1 1h8v9H4V4z"/><path d="M7 6a1 1 0 112 0v3a1 1 0 11-2 0V6z"/></svg>PM Contributors (${pmResult.data.length} records)`,
          type: "enhanced-table",
          rows: pmResult.data,
          tableMeta: { type: "pm_contrib", recordCount: pmResult.data.length },
        });
      }
    } else {
      // Load conversion contributors and RM horizon + batch traces in parallel
      const [convResult, rmHorizonResult, rmBatchResult] = await Promise.all([
        loadConversionContributors(id, month),
        loadRMTraceHorizon(id, month),
        loadRMTraceBatch(id),
      ]);

      // Conversion contributors (unchanged behavior)
      if (convResult.error) {
        additionalSections.push({
          title:
            '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/></svg>Conversion Contributors',
          type: "error-state",
          data: `Unable to load conversion contributor data: ${convResult.error}`,
        });
      } else if (convResult.data.length > 0) {
        additionalSections.push({
          title: `<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/></svg>Conversion Contributors (${convResult.data.length} records)`,
          type: "enhanced-table",
          rows: convResult.data,
          tableMeta: {
            type: "conversion_contrib",
            recordCount: convResult.data.length,
          },
        });
      }

      // RM Planning Trace (horizon)
      if (rmHorizonResult.error) {
        additionalSections.push({
          title: "RM Planning Trace (Horizon)",
          type: "error-state",
          data: `Unable to load RM planning trace: ${rmHorizonResult.error}`,
        });
      } else if (!rmHorizonResult.data || rmHorizonResult.data.length === 0) {
        additionalSections.push({
          title: "RM Planning Trace (Horizon)",
          type: "empty-state",
          data: "No RM planning trace rows for this item/month.",
        });
      } else {
        additionalSections.push({
          title: `RM Planning Trace (Horizon) (${rmHorizonResult.data.length})`,
          type: "enhanced-table",
          rows: rmHorizonResult.data,
          tableMeta: {
            type: "rm_trace_horizon",
            recordCount: rmHorizonResult.data.length,
          },
        });
      }

      // RM Batch Execution Trace
      if (rmBatchResult.error) {
        additionalSections.push({
          title: "RM Batch Execution (BMR/Issues)",
          type: "error-state",
          data: `Unable to load RM batch execution trace: ${rmBatchResult.error}`,
        });
      } else if (!rmBatchResult.data || rmBatchResult.data.length === 0) {
        additionalSections.push({
          title: "RM Batch Execution (BMR/Issues)",
          type: "empty-state",
          data: "No RM batch execution rows found for this item.",
        });
      } else {
        additionalSections.push({
          title: `RM Batch Execution (BMR/Issues) (${rmBatchResult.data.length})`,
          type: "enhanced-table",
          rows: rmBatchResult.data,
          tableMeta: {
            type: "rm_trace_batch",
            recordCount: rmBatchResult.data.length,
          },
        });
      }
    }

    // Load overlay contributions for raw materials
    if (!kind || kind === "raw_material") {
      const overlayResult = await loadOverlayContributions(id, month);

      if (overlayResult.error) {
        additionalSections.push({
          title:
            '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M4.5 5.5a.5.5 0 00-1 0V7a.5.5 0 001 0V5.5zm3-2a.5.5 0 00-1 0V7a.5.5 0 001 0V3.5zm3 .5a.5.5 0 00-1 0V7a.5.5 0 001 0V4z"/><path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/><path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z"/></svg>Overlay Contributions',
          type: "error-state",
          data: `Unable to load overlay data: ${overlayResult.error}`,
        });
      } else if (overlayResult.data.length > 0) {
        additionalSections.push({
          title: `<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M4.5 5.5a.5.5 0 00-1 0V7a.5.5 0 001 0V5.5zm3-2a.5.5 0 00-1 0V7a.5.5 0 001 0V3.5zm3 .5a.5.5 0 00-1 0V7a.5.5 0 001 0V4z"/><path d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/><path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3-1A1.5 1.5 0 005 1.5v1A1.5 1.5 0 006.5 4h3A1.5 1.5 0 0011 2.5v-1A1.5 1.5 0 009.5 0h-3z"/></svg>Overlay Contributions (${overlayResult.data.length} records)`,
          type: "enhanced-table",
          rows: overlayResult.data,
          tableMeta: {
            type: "overlay",
            recordCount: overlayResult.data.length,
          },
        });
      }
    }
  } catch (error) {
    console.debug("Error loading additional modal data:", error);
    additionalSections.push({
      title:
        '<svg width="16" height="16" fill="currentColor" style="display:inline;margin-right:6px;vertical-align:-2px"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 100 2 1 1 0 000-2z"/></svg>Data Loading Error',
      type: "error-state",
      data: "An unexpected error occurred while loading data. Please try again.",
    });
  }

  // Update modal with all sections
  const finalSections = [...sections, ...additionalSections];

  // Update export action with complete data
  // preserve modal scroll position when updating content
  const _modalRoot = document.getElementById("copilot-detail-modal");
  const _prevScroll =
    _modalRoot?.querySelector("#copilot-modal-body")?.scrollTop || 0;

  openDetailModal({
    title: itemName || `Stock Item ${id}`,
    subtitle: subtitle,
    sections: finalSections,
    actions: [
      {
        label: "Export Data",
        onClick: () => {
          const exportData = {
            stock_item_id: id,
            stock_item_name: itemName,
            material_kind: kind,
            month_start: month,
            base_data: row,
            sections: finalSections
              .filter((s) => s.rows)
              .map((s) => ({
                title: s.title,
                type: s.tableMeta?.type,
                row_count: s.rows?.length || 0,
                data: s.rows,
              })),
            exported_at: new Date().toISOString(),
            cache_info: {
              cached_sections: additionalSections.filter((s) =>
                getCachedData(id, month, s.tableMeta?.type),
              ).length,
              total_sections: additionalSections.length,
            },
          };

          import("../public/shared/js/mrpExports.js").then(
            ({ downloadJSON }) => {
              downloadJSON(
                `procurement_detail_${id}_${month || "current"}`,
                exportData,
              );
            },
          );
        },
      },
    ],
  });

  // restore previous scroll position
  try {
    const _body = document.getElementById("copilot-modal-body");
    if (_body) _body.scrollTop = _prevScroll;
  } catch {
    /* ignore */
  }
}

// Tab loaders
async function loadFinalPlan() {
  showLoading("Loading final procurement plan...");
  const { start, end } = getMasterRange();
  const search = ($("fp-search").value || "").trim();
  const mk = $("fp-material-kind").value;
  const onlyNet = $("fp-only-net").checked;
  // pagination params from state
  const { page, perPage } = pagerState.fp;
  const rpcParams = {
    p_start: start || null,
    p_end: end || null,
    p_search: search || null,
    p_material_kind: mk && mk !== "all" ? mk : null,
    p_only_net: Boolean(onlyNet),
    p_page: (page || 0) + 1,
    p_per_page: perPage || 100,
  };

  try {
    const { rows, total } = await rpcFetchPaged(
      "rpc_procurement_plan_search",
      rpcParams,
    );
    fpLastRows = rows || [];
    pagerState.fp.total = total || 0;
    renderTable("fp-thead", "fp-tbody", fpLastRows, FP_VISIBLE_COLS);
    updatePagerUI("fp");
  } catch (err) {
    console.debug(err);
    renderTable("fp-thead", "fp-tbody", []);
  } finally {
    hideLoading();
  }
}

async function loadOverlayRuns() {
  showLoading("Loading overlay runs...");
  const runEl = $("overlay-runs");
  runEl.innerHTML = "Loading runs…";

  const { data: runs, error } = await supabase
    .from("mrp_rm_overlay_season_runs")
    .select("*")
    .order("built_at", { ascending: false })
    .limit(200);

  if (error) {
    console.debug(error);
    runEl.textContent = "Runs not available";
    hideLoading();
    return;
  }
  if (!runs || !runs.length) {
    runEl.textContent = "No runs";
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    hideLoading();
    return;
  }

  // Keep selection if it still exists
  const stillExists =
    selectedOverlayRunId &&
    runs.some((r) => r.overlay_run_id === selectedOverlayRunId);

  if (!stillExists) {
    const active = runs.find((r) => r.is_active) || runs[0];
    selectedOverlayRunId = active?.overlay_run_id ?? null;
  }

  runEl.innerHTML = "";
  runs.forEach((r) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.marginRight = "6px";

    const label = `${r.overlay_run_id}${r.is_active ? " (active)" : ""}`;
    b.textContent = label;

    // simple highlight
    if (r.overlay_run_id === selectedOverlayRunId) {
      b.style.outline = "2px solid #3b82f6";
    }

    b.addEventListener("click", () => {
      selectedOverlayRunId = r.overlay_run_id;
      pagerState.ov.page = 0;
      loadOverlayRuns();
      loadOverlayForRun(selectedOverlayRunId);
    });

    runEl.appendChild(b);
  });

  // Load current selection
  hideLoading();
  if (selectedOverlayRunId) {
    loadOverlayForRun(selectedOverlayRunId);
  }
}

async function loadOverlayForRun(runId) {
  showLoading("Loading overlay rows...");
  if (!runId) {
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    hideLoading();
    return;
  }

  const { start, end } = getMasterRange();
  const search = ($("ov-search").value || "").trim();
  const onlyNonZero = $("ov-only-nonzero").checked;

  // pagination
  // pagerState.ov used directly when calling RPC (server-side paging)

  let baseRows = [];
  let error = null;
  try {
    // If search is present, fetch a larger page so client-side enrichment/filtering
    // has enough data (Option B). Otherwise use normal server-side paging.
    const rpcParams = {
      p_start: start || null,
      p_end: end || null,
      p_search: search || null,
      p_run_id: runId || null,
      p_only_nonzero: Boolean(onlyNonZero),
      p_page: (pagerState.ov.page || 0) + 1,
      p_per_page: pagerState.ov.perPage || 100,
    };
    if (rpcParams.p_search) {
      rpcParams.p_page = 1;
      rpcParams.p_per_page = 2000;
    }

    const res = await supabase.rpc("rpc_overlay_monthly_search", rpcParams);
    if (res.error) {
      error = res.error;
    } else {
      baseRows = (res.data || []).map((r) => r.row_data);
      pagerState.ov.total =
        res.data && res.data.length ? Number(res.data[0].total_count) : 0;
    }
  } finally {
    // hide later after enrichment
  }
  if (error) {
    console.debug(error);
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    hideLoading();
    return;
  }

  const rows = baseRows || [];
  if (!rows.length) {
    overlayLastRows = [];
    renderTable("ov-thead", "ov-tbody", []);
    hideLoading();
    return;
  }

  // Use RPC-returned rows directly (server-side search/paging applied)
  overlayLastRows = rows;

  renderTable("ov-thead", "ov-tbody", overlayLastRows);
  updatePagerUI("ov");
  hideLoading();
}

async function loadConversionSummary() {
  showLoading("Loading conversion summary...");

  const search = ($("conv-search").value || "").trim();
  const { page, perPage } = pagerState.conv;

  const { start, end } = getMasterRange();

  try {
    const rpcParams = {
      p_start: start || null,
      p_end: end || null,
      p_search: search || null,
      p_page: (page || 0) + 1,
      p_per_page: perPage || 100,
    };

    const { rows, total } = await rpcFetchPaged(
      "rpc_conversion_summary_search",
      rpcParams,
    );

    convLastRows = rows || [];
    pagerState.conv.total = total || 0;

    renderTable("conv-thead", "conv-tbody", convLastRows);
    updatePagerUI("conv");
  } catch (err) {
    console.debug(err);
    convLastRows = [];
    pagerState.conv.total = null;
    renderTable("conv-thead", "conv-tbody", []);
    updatePagerUI("conv");
  } finally {
    hideLoading();
  }
}

// wire up UI
function initUi() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      document
        .querySelectorAll(".tab-pane")
        .forEach((p) => (p.style.display = "none"));
      const id = t.dataset.tab;
      $(id).style.display = "";
      if (id === "final-plan") loadFinalPlan();
      if (id === "rm-overlay") {
        loadOverlayRuns();
      }
      if (id === "rm-conversion") loadConversionSummary();
      if (id === "traceability") loadTraceability();
    });
  });

  // filters
  [
    "master-preset",
    "master-start",
    "master-end",
    "fp-search",
    "fp-material-kind",
    "fp-only-net",
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      if (document.querySelector(".tab.active").dataset.tab === "final-plan") {
        pagerState.fp.page = 0;
        loadFinalPlan();
      }
    });
  });
  // Auto-populate master start/end when master preset changes; update end when start changes for next12
  const masterPresetEl = $("master-preset");
  if (masterPresetEl) {
    masterPresetEl.addEventListener("change", () => {
      try {
        const preset = masterPresetEl.value;
        const startVal = $("master-start")?.value || null;
        const range = computePresetRange(
          preset,
          startVal,
          new Date().getFullYear(),
        );
        // mark programmatic update so change handlers won't treat this as manual edit
        suppressMasterRangeChange = true;
        if ($("master-start")) $("master-start").value = range.start || "";
        if ($("master-end")) $("master-end").value = range.end || "";
        setTimeout(() => (suppressMasterRangeChange = false), 0);
        // reload active tab
        const active = document.querySelector(".tab.active");
        if (active) {
          const id = active.dataset.tab;
          if (id === "final-plan") {
            pagerState.fp.page = 0;
            loadFinalPlan();
          } else if (id === "rm-overlay") {
            pagerState.ov.page = 0;
            if (selectedOverlayRunId) loadOverlayForRun(selectedOverlayRunId);
          } else if (id === "rm-conversion") {
            pagerState.conv.page = 0;
            loadConversionSummary();
          } else if (id === "traceability") {
            pagerState.tr.page = 0;
            loadTraceability();
          }
        }
      } catch (e) {
        console.debug("master preset update failed", e);
      }
    });
  }

  const masterStartEl = $("master-start");
  if (masterStartEl) {
    masterStartEl.addEventListener("change", () => {
      if (suppressMasterRangeChange) return;
      try {
        // If user manually edits the start while a preset is active, switch to custom
        if ($("master-preset")?.value !== "custom") {
          suppressMasterRangeChange = true;
          $("master-preset").value = "custom";
          setTimeout(() => (suppressMasterRangeChange = false), 0);
        }
        if ($("master-preset")?.value === "next12") {
          const startVal = masterStartEl.value || null;
          const range = computePresetRange(
            "next12",
            startVal,
            new Date().getFullYear(),
          );
          if ($("master-end")) $("master-end").value = range.end || "";
        }
        const active = document.querySelector(".tab.active");
        if (active) {
          const id = active.dataset.tab;
          if (id === "final-plan") {
            pagerState.fp.page = 0;
            loadFinalPlan();
          } else if (id === "rm-overlay") {
            pagerState.ov.page = 0;
            if (selectedOverlayRunId) loadOverlayForRun(selectedOverlayRunId);
          } else if (id === "rm-conversion") {
            pagerState.conv.page = 0;
            loadConversionSummary();
          } else if (id === "traceability") {
            pagerState.tr.page = 0;
            loadTraceability();
          }
        }
      } catch (e) {
        console.debug("master start change handler failed", e);
      }
    });
  }

  // master-end change handler: switch preset to custom on manual edit and reload active tab
  const masterEndEl = $("master-end");
  if (masterEndEl) {
    masterEndEl.addEventListener("change", () => {
      if (suppressMasterRangeChange) return;
      try {
        if ($("master-preset")?.value !== "custom") {
          suppressMasterRangeChange = true;
          $("master-preset").value = "custom";
          setTimeout(() => (suppressMasterRangeChange = false), 0);
        }
        const active = document.querySelector(".tab.active");
        if (active) {
          const id = active.dataset.tab;
          if (id === "final-plan") {
            pagerState.fp.page = 0;
            loadFinalPlan();
          } else if (id === "rm-overlay") {
            pagerState.ov.page = 0;
            if (selectedOverlayRunId) loadOverlayForRun(selectedOverlayRunId);
          } else if (id === "rm-conversion") {
            pagerState.conv.page = 0;
            loadConversionSummary();
          } else if (id === "traceability") {
            pagerState.tr.page = 0;
            loadTraceability();
          }
        }
      } catch (e) {
        console.debug("master end update failed", e);
      }
    });
  }

  // FP search: debounced input filtering + clear button
  const fpSearchEl = $("fp-search");
  const fpSearchClear = $("fp-search-clear");
  if (fpSearchEl) {
    const debouncedLoad = debounce(() => {
      if (document.querySelector(".tab.active").dataset.tab === "final-plan")
        loadFinalPlan();
    }, 350);

    fpSearchEl.addEventListener("input", (ev) => {
      const v = (ev.target.value || "").trim();
      if (fpSearchClear) fpSearchClear.style.display = v ? "" : "none";
      debouncedLoad();
    });

    fpSearchEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        fpSearchEl.value = "";
        if (fpSearchClear) fpSearchClear.style.display = "none";
        loadFinalPlan();
      }
    });

    if (fpSearchClear) {
      fpSearchClear.addEventListener("click", () => {
        fpSearchEl.value = "";
        fpSearchClear.style.display = "none";
        loadFinalPlan();
        fpSearchEl.focus();
      });
    }

    // master-end handler moved out of fp-search input scope; see below
  }
  // OV search: debounced input + clear
  const ovSearchEl = $("ov-search");
  const ovSearchClear = $("ov-search-clear");
  if (ovSearchEl) {
    const debouncedOv = debounce(() => {
      if (document.querySelector(".tab.active").dataset.tab !== "rm-overlay")
        return;
      pagerState.ov.page = 0;
      if (selectedOverlayRunId) loadOverlayForRun(selectedOverlayRunId);
    }, 350);

    ovSearchEl.addEventListener("input", (ev) => {
      const v = (ev.target.value || "").trim();
      if (ovSearchClear) ovSearchClear.style.display = v ? "" : "none";
      debouncedOv();
    });

    if (ovSearchClear) {
      ovSearchClear.addEventListener("click", () => {
        ovSearchEl.value = "";
        ovSearchClear.style.display = "none";
        pagerState.ov.page = 0;
        if (selectedOverlayRunId) loadOverlayForRun(selectedOverlayRunId);
        ovSearchEl.focus();
      });
    }
  }

  // CONV search: debounced
  const convSearchEl = $("conv-search");
  if (convSearchEl) {
    const debConv = debounce(() => {
      if (
        document.querySelector(".tab.active").dataset.tab === "rm-conversion"
      ) {
        pagerState.conv.page = 0;
        loadConversionSummary();
      }
    }, 350);
    convSearchEl.addEventListener("input", () => {
      debConv();
    });
  }

  // TRACE search: debounced
  const trSearchEl = $("tr-search");
  if (trSearchEl) {
    const debTr = debounce(() => {
      if (
        document.querySelector(".tab.active").dataset.tab === "traceability"
      ) {
        pagerState.tr.page = 0;
        loadTraceability();
      }
    }, 350);
    trSearchEl.addEventListener("input", () => debTr());
  }
  ["ov-search", "ov-only-nonzero"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      if (document.querySelector(".tab.active").dataset.tab !== "rm-overlay")
        return;
      pagerState.ov.page = 0;
      if (!selectedOverlayRunId) return;
      loadOverlayForRun(selectedOverlayRunId);
    });
  });
  ["conv-search"].forEach((id) => {
    const el = $(id);
    if (el)
      el.addEventListener("change", () => {
        if (
          document.querySelector(".tab.active").dataset.tab === "rm-conversion"
        ) {
          pagerState.conv.page = 0;
          loadConversionSummary();
        }
      });
  });
  ["tr-search", "tr-material-kind"].forEach((id) => {
    const el = $(id);
    if (el)
      el.addEventListener("change", () => {
        if (
          document.querySelector(".tab.active").dataset.tab === "traceability"
        ) {
          pagerState.tr.page = 0;
          loadTraceability();
        }
      });
  });

  // exports
  $("fp-export-csv").addEventListener("click", () => {
    downloadCSV(`final_procurement_plan_${Date.now()}`, fpLastRows || []);
  });
  $("fp-export-json").addEventListener("click", () => {
    downloadJSON(`final_procurement_plan_${Date.now()}`, {
      generated_at: new Date().toISOString(),
      filters: {},
      rows: fpLastRows || [],
    });
  });

  if ($("ov-export-csv")) {
    $("ov-export-csv").addEventListener("click", () => {
      const runId = selectedOverlayRunId || "unknown";
      downloadCSV(`rm_season_overlay_monthly_${runId}`, overlayLastRows || []);
    });
  }
  if ($("ov-export-json")) {
    $("ov-export-json").addEventListener("click", () => {
      const runId = selectedOverlayRunId || "unknown";
      downloadJSON(`rm_season_overlay_run_${runId}`, {
        generated_at: new Date().toISOString(),
        overlay_run_id: runId,
        rows: overlayLastRows || [],
      });
    });
  }

  if ($("conv-export-csv")) {
    $("conv-export-csv").addEventListener("click", () => {
      downloadCSV(`rm_conversion_summary_${Date.now()}`, convLastRows || []);
    });
  }
  if ($("conv-export-json")) {
    $("conv-export-json").addEventListener("click", () => {
      downloadJSON(`rm_conversion_summary_${Date.now()}`, {
        generated_at: new Date().toISOString(),
        rows: convLastRows || [],
      });
    });
  }

  $("tr-export-json").addEventListener("click", async () => {
    const search = ($("tr-search").value || "").trim();
    if (!search) return alert("Enter stock item search");
    const { start, end } = getMasterRange();
    const mk = $("tr-material-kind")?.value || "all";
    // Use server-side RPCs to fetch bundle components (future-proofed)
    const rpcPlanParams = {
      p_start: start || null,
      p_end: end || null,
      p_search: search || null,
      p_material_kind: null,
      p_only_net: false,
      p_page: 1,
      p_per_page: 2000,
    };
    const planRes = await supabase.rpc(
      "rpc_procurement_plan_search",
      rpcPlanParams,
    );
    const plan = planRes.error
      ? []
      : (planRes.data || []).map((r) => r.row_data);

    // overlay: fetch base rows via RPC and use returned row_data directly
    let ov = [];
    try {
      const { start: mstart, end: mend } = getMasterRange();
      const rpcOvParams = {
        p_start: mstart || null,
        p_end: mend || null,
        p_search: search || null,
        p_run_id: null,
        p_only_nonzero: false,
        p_page: 1,
        p_per_page: 2000,
      };
      const ovRes = await supabase.rpc(
        "rpc_overlay_monthly_search",
        rpcOvParams,
      );
      ov = ovRes.error ? [] : (ovRes.data || []).map((r) => r.row_data);
    } catch (err) {
      console.debug(err);
      ov = [];
    }

    // conversion summary via RPC
    const convRes = await supabase.rpc("rpc_conversion_summary_search", {
      p_start: start || null,
      p_end: end || null,
      p_search: search || null,
      p_page: 1,
      p_per_page: 2000,
    });
    const conv = convRes.error
      ? []
      : (convRes.data || []).map((r) => r.row_data);

    // trace via RPC
    const traceRes = await supabase.rpc("rpc_trace_search", {
      p_start: start || null,
      p_end: end || null,
      p_search: search || null,
      p_material_kind: mk !== "all" ? mk : null,
      p_page: 1,
      p_per_page: 2000,
    });
    const trace = traceRes.error
      ? []
      : (traceRes.data || []).map((r) => r.row_data);
    const bundle = {
      generated_at: new Date().toISOString(),
      search,
      start,
      end,
      material_kind_filter: mk,
      plan: plan || [],
      overlay: ov || [],
      conversion: conv || [],
      trace: trace || [],
    };
    downloadJSON(`trace_bundle_${search}_${Date.now()}`, bundle);
  });

  // Pager controls wiring
  [
    { prefix: "fp", loader: loadFinalPlan },
    {
      prefix: "ov",
      loader: () =>
        selectedOverlayRunId && loadOverlayForRun(selectedOverlayRunId),
    },
    { prefix: "conv", loader: loadConversionSummary },
    { prefix: "tr", loader: loadTraceability },
  ].forEach(({ prefix, loader }) => {
    const prev = $(`${prefix}-pager-prev`);
    const next = $(`${prefix}-pager-next`);
    if (prev)
      prev.addEventListener("click", () => {
        const s = pagerState[prefix];
        if (s.page > 0) s.page -= 1;
        loader();
      });
    if (next)
      next.addEventListener("click", () => {
        const s = pagerState[prefix];
        const total = pagerState[prefix].total;
        const per = pagerState[prefix].perPage || 100;
        if (typeof total === "number" && total >= 0) {
          const maxPage = Math.max(0, Math.ceil(total / per) - 1);
          if (s.page < maxPage) s.page += 1;
        } else {
          s.page += 1;
        }
        loader();
      });
    // per-page selector removed — page size is fixed via `pagerState` defaults
  });

  // New master export buttons: show small menu with CSV/JSON options
  function showExportMenu(anchorEl, items) {
    // remove existing menu
    const existing = document.getElementById("__ppw_export_menu");
    if (existing) existing.remove();
    const menu = document.createElement("div");
    menu.id = "__ppw_export_menu";
    menu.style.position = "absolute";
    menu.style.minWidth = "140px";
    menu.style.background = "#fff";
    menu.style.border = "1px solid #e5e7eb";
    menu.style.borderRadius = "6px";
    menu.style.boxShadow = "0 8px 24px rgba(2,6,23,0.08)";
    menu.style.zIndex = 2000;
    menu.style.padding = "6px 0";
    items.forEach((it) => {
      const row = document.createElement("button");
      row.className = "btn";
      row.style.display = "block";
      row.style.width = "100%";
      row.style.textAlign = "left";
      row.style.padding = "8px 12px";
      row.style.border = "none";
      // ensure visible on white backgrounds: explicit foreground/background
      row.style.background = "#ffffff";
      row.style.color = "#0f172a";
      row.style.cursor = "pointer";
      row.style.fontWeight = "400";
      row.style.fontSize = "0.9rem";
      row.style.fontFamily = "inherit";
      row.textContent = it.label;
      // subtle hover effect
      row.addEventListener(
        "mouseover",
        () => (row.style.background = "#f3f4f6"),
      );
      row.addEventListener(
        "mouseout",
        () => (row.style.background = "#ffffff"),
      );
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        it.onClick();
        menu.remove();
      });
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    // position near anchor; prefer rightward placement but flip left if overflowing
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    let left = rect.left + window.scrollX;
    const viewportRight = window.scrollX + window.innerWidth;
    if (left + menuWidth > viewportRight - 8) {
      // open to the left of the anchor
      left = rect.right + window.scrollX - menuWidth;
      if (left < 8) left = 8;
    }
    menu.style.left = `${left}px`;
    // vertical placement: prefer below, but open above if not enough space
    const menuHeight = menu.offsetHeight;
    let top = rect.bottom + window.scrollY + 6;
    const viewportBottom = window.scrollY + window.innerHeight;
    if (top + menuHeight > viewportBottom - 8) {
      // try opening above
      const altTop = rect.top + window.scrollY - menuHeight - 6;
      if (altTop > 8) top = altTop;
    }
    menu.style.top = `${top}px`;
    // close on outside click
    const onDoc = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener("click", onDoc);
      }
    };
    setTimeout(() => document.addEventListener("click", onDoc), 10);
  }

  const fpMaster = $("fp-export");
  if (fpMaster) {
    fpMaster.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showExportMenu(fpMaster, [
        {
          label: "Export CSV",
          onClick: () => {
            const el = $("fp-export-csv");
            if (el) el.click();
          },
        },
        {
          label: "Export JSON",
          onClick: () => {
            const el = $("fp-export-json");
            if (el) el.click();
          },
        },
      ]);
    });
  }

  const ovMaster = $("ov-export");
  if (ovMaster) {
    ovMaster.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showExportMenu(ovMaster, [
        {
          label: "Export CSV",
          onClick: () => {
            const el = $("ov-export-csv");
            if (el) el.click();
          },
        },
        {
          label: "Export JSON",
          onClick: () => {
            const el = $("ov-export-json");
            if (el) el.click();
          },
        },
      ]);
    });
  }

  const convMaster = $("conv-export");
  if (convMaster) {
    convMaster.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showExportMenu(convMaster, [
        {
          label: "Export CSV",
          onClick: () => {
            const el = $("conv-export-csv");
            if (el) el.click();
          },
        },
        {
          label: "Export JSON",
          onClick: () => {
            const el = $("conv-export-json");
            if (el) el.click();
          },
        },
      ]);
    });
  }

  const trMaster = $("tr-export");
  if (trMaster) {
    trMaster.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showExportMenu(trMaster, [
        {
          label: "Export JSON",
          onClick: () => {
            const el = $("tr-export-json");
            if (el) el.click();
          },
        },
      ]);
    });
  }
}

// fetch helpers removed — exports use cached rows (fpLastRows, overlayLastRows, convLastRows)

// bootstrap
// Override previous trace loader with RPC-backed implementation (keeps original name)
async function loadTraceability() {
  showLoading("Loading traceability...");
  // Use server-side RPC for procurement-plan style trace listing
  const search = ($("tr-search").value || "").trim();
  // use master range (period_start fixed)
  const { start, end } = getMasterRange();
  // material-kind not used for trace RPC (keep for future enhancements)
  const { page, perPage } = pagerState.tr;

  try {
    const mk = $("tr-material-kind")?.value || "all";
    const rpcParams = {
      p_start: start || null,
      p_end: end || null,
      p_search: search || null,
      p_material_kind: mk !== "all" ? mk : null,
      p_page: (page || 0) + 1,
      p_per_page: perPage || 100,
    };
    try {
      const { rows, total } = await rpcFetchPaged(
        "rpc_trace_search",
        rpcParams,
      );
      traceLastRows = rows || [];
      pagerState.tr.total = total || 0;
      console.debug(
        "[trace] rows:",
        traceLastRows.length,
        "total:",
        pagerState.tr.total,
        "mk:",
        mk,
      );
    } catch (err) {
      console.debug(err);
      traceLastRows = [];
      pagerState.tr.total = null;
    }
  } catch (err) {
    console.debug(err);
    traceLastRows = [];
    pagerState.tr.total = null;
  } finally {
    // Render into the dedicated trace table using trace-specific visible columns
    const cols = chooseTraceCols();
    renderTable("tr-thead", "tr-tbody", traceLastRows, cols);
    updatePagerUI("tr");
    hideLoading();
  }
}
window.addEventListener("DOMContentLoaded", async () => {
  initUi();
  const hb = document.getElementById("homeBtn");
  if (hb) hb.addEventListener("click", () => Platform.goHome());
  const ok = await showAccess();
  if (!ok) return;
  // initial range population (ensure master presets auto-fill on first load)
  try {
    const mp = $("master-preset")?.value;
    const msEl = $("master-start");
    const meEl = $("master-end");
    let startVal = msEl?.value || null;
    if (mp === "next12" && !startVal) {
      const now = new Date();
      startVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0",
      )}`;
    }
    const range = computePresetRange(mp, startVal, new Date().getFullYear());
    if (msEl && range.start) msEl.value = range.start;
    if (meEl && range.end) meEl.value = range.end;
  } catch (e) {
    console.debug("initial master range populate failed", e);
  }

  // initial loads
  loadFinalPlan();
});
