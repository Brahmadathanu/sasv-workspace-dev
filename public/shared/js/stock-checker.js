/***************************************************************************
 * stock-checker.js — SASV Stock Checker (Primary + Quick + Drawers)
 * Drop-in, refactored & robust (Electron + PWA)
 ***************************************************************************/
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ─────────────────────────── Config (adjust paths if needed) ───────────────────────────
const PDF_LOAD_MODE = "auto"; // "auto" | "umd" | "esm"
const PDF_UMD_PATHS = {
  jsPDF: "/libs/jspdf.umd.min.js",
  autoTable: "/libs/jspdf.plugin.autotable.min.js",
};

// last query total rows (set in runQuery)
// lastQueryTotal removed; totals now provided by RPC via __lastTotals

// DOM refs for new UI pieces (filled in init)
let elTotalValue, elToggleValue;
let elValueModal, elValueModalClose, elValueBody, elValueSnapshot;
let elRowModal,
  elRowModalClose,
  elRowHeader,
  elRowClassif,
  elRowQty,
  elRowValue,
  elRowFooter;
let __lastOpenTs = 0; // guard for double-open on touch
let __sc_isDragging = false; // set while the user is dragging the table to avoid accidental opens
let __sc_mouseDown = false;
const PDF_ESM_PATHS = {
  jsPDF: "/libs/jspdf.es.min.js",
  autoTable: "/libs/jspdf-autotable.es.js",
};
let __pdfExporting = false; // reentrancy guard for exportCoveragePDF

// ────────────── Utility functions ──────────────
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else fn();
}

function openRowModal(r) {
  if (!elRowModal) return;
  try {
    // remember element focused before opening so we can restore focus on close
    __lastFocusBeforeRowModal =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // header: item / pack / uom
    elRowHeader.innerHTML = `<strong>${escapeHtml(
      r.item || ""
    )}</strong> &nbsp; ${escapeHtml(String(r.pack_size ?? ""))} ${escapeHtml(
      r.uom || ""
    )}`;
    // classification
    const parts = [
      r.category_name,
      r.sub_category_name,
      r.product_group_name,
      r.sub_group_name,
    ].filter(Boolean);
    elRowClassif.textContent = parts.join(" → ");

    // Qty & MOS column: show stocks/demand/mos by IK/KKD/OK/overall
    const stIK = Number(r.stock_ik) || 0;
    const stKKD = Number(r.stock_kkd) || 0;
    const stOK = Number(r.stock_ok) || 0;
    const stockOverall = stIK + stKKD + stOK;
    const fIK = Number(r.forecast_ik) || 0;
    const fKKD = Number(r.forecast_kkd) || 0;
    const fOK = Number(r.forecast_ok) || 0;
    const forecastOverall = fIK + fKKD + fOK;
    elRowQty.innerHTML = `
      <div><strong>Stock</strong></div>
      <div>IK: ${fmtInt(stIK)}</div>
      <div>KKD: ${fmtInt(stKKD)}</div>
      <div>OK: ${fmtInt(stOK)}</div>
      <div style="margin-top:8px"><strong>Overall: ${fmtInt(
        stockOverall
      )}</strong></div>
      <hr/>
      <div><strong>Demand</strong></div>
      <div>IK: ${fmtInt(fIK)}</div>
      <div>KKD: ${fmtInt(fKKD)}</div>
      <div>OK: ${fmtInt(fOK)}</div>
      <div style="margin-top:8px"><strong>Overall: ${fmtInt(
        forecastOverall
      )}</strong></div>
    `;

    // Values & Rates
    elRowValue.innerHTML = `
      <div><strong>Value</strong></div>
      <div>IK: ${fmtINR(r.stock_value_ik)}</div>
      <div>KKD: ${fmtINR(r.stock_value_kkd)}</div>
      <div>OK: ${fmtINR(r.stock_value_ok)}</div>
      <div style="margin-top:8px"><strong>Overall: ${fmtINR(
        r.stock_value_overall
      )}</strong></div>
      <hr/>
      <div><strong>Rate</strong></div>
      <div>IK: ${fmtRate(r.rate_ik)}</div>
      <div>KKD: ${fmtRate(r.rate_kkd)}</div>
      <div>OK: ${fmtRate(r.rate_ok)}</div>
      <div style="margin-top:8px"><strong>Overall: ${fmtRate(
        r.rate_overall
      )}</strong></div>
    `;

    elRowFooter.textContent = `MRP IK: ${fmtRate(r.mrp_ik)} / MRP OK: ${fmtRate(
      r.mrp_ok
    )} ${r.shade_flag ? " • Shade" : ""}`;

    // open modal
    elRowModal.style.display = "flex";
    elRowModal.setAttribute("aria-hidden", "false");
    // focus close button
    setTimeout(() => {
      elRowModalClose?.focus();
    }, 20);
  } catch (err) {
    console.error("openRowModal", err);
  }
}
function $(id) {
  return document.getElementById(id);
}
function setMsg(msg) {
  const el = $("sc-msg");
  if (el) el.textContent = msg || "";
}
function fmtInt(n) {
  return (n ?? 0).toLocaleString("en-IN");
}
function fmt3(n) {
  return n == null ? "" : Number(n).toFixed(3);
}
function fmtINR(n, decimals = 2) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  return (
    "₹ " +
    Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}
function fmtRate(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  return (
    "₹ " +
    Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
// Simple debounce helper
function debounce(fn, wait = 100) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
// Returns true when any filter is active
function filtersAreActive() {
  try {
    if (selectedProductId) return true;
    if (state.pack_size) return true;
    if (state.uom) return true;
    if (state.quick?.mosLt3 || state.quick?.raso) return true;
    if (state.category_id) return true;
    if (state.sub_category_id && state.sub_category_id.length) return true;
    if (state.product_group_id && state.product_group_id.length) return true;
    if (state.sub_group_id && state.sub_group_id.length) return true;
    if (state.ex) {
      if ((state.ex.cats || []).length) return true;
      if ((state.ex.subcats || []).length) return true;
      if ((state.ex.pgroups || []).length) return true;
      if ((state.ex.sgroups || []).length) return true;
    }
    if (state.mos) {
      for (const k of ["ik", "kkd", "ok", "ov"]) {
        if (state.mos[k]?.en) return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

function updateFiltersButtonState() {
  try {
    const btn = document.getElementById("sc-filters-btn");
    if (!btn) return;
    const active = filtersAreActive();
    btn.classList.toggle("filters-active", active);
    btn.setAttribute("aria-pressed", String(active));
    try {
      const reset = document.getElementById("sc-clear");
      if (reset) reset.disabled = !active;
    } catch {
      void 0;
    }
  } catch {
    void 0;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Build filters payload for RPC `stock_checker_query` from current UI state
function buildStockCheckerFiltersPayload() {
  const payload = {};
  payload.product_id = selectedProductId || null;
  payload.pack_size =
    state.pack_size && state.pack_size !== "" ? state.pack_size : null;
  payload.uom = state.uom && state.uom !== "" ? state.uom : null;
  payload.quick = {
    mosLt3: !!(state.quick && state.quick.mosLt3),
    raso: !!(state.quick && state.quick.raso),
  };

  payload.category_id =
    state.category_id && state.category_id !== "" ? state.category_id : null;
  payload.sub_category_id = Array.isArray(state.sub_category_id)
    ? state.sub_category_id
    : state.sub_category_id && state.sub_category_id !== ""
    ? state.sub_category_id
    : null;
  payload.product_group_id = Array.isArray(state.product_group_id)
    ? state.product_group_id
    : state.product_group_id && state.product_group_id !== ""
    ? state.product_group_id
    : null;
  payload.sub_group_id = Array.isArray(state.sub_group_id)
    ? state.sub_group_id
    : state.sub_group_id && state.sub_group_id !== ""
    ? state.sub_group_id
    : null;

  payload.ex = {
    cats: Array.isArray(state.ex?.cats) ? state.ex.cats : [],
    subcats: Array.isArray(state.ex?.subcats) ? state.ex.subcats : [],
    pgroups: Array.isArray(state.ex?.pgroups) ? state.ex.pgroups : [],
    sgroups: Array.isArray(state.ex?.sgroups) ? state.ex.sgroups : [],
  };

  // MOS rules: keep same shape as state (en/op/v1/v2/notNull)
  payload.mos = { ik: null, kkd: null, ok: null, ov: null };
  for (const k of ["ik", "kkd", "ok", "ov"]) {
    const r = state.mos?.[k] || {
      en: false,
      op: "gt",
      v1: "",
      v2: "",
      notNull: false,
    };
    payload.mos[k] = {
      en: !!r.en,
      op: r.op || "gt",
      v1: r.v1 !== undefined && r.v1 !== "" ? r.v1 : null,
      v2: r.v2 !== undefined && r.v2 !== "" ? r.v2 : null,
      notNull: !!r.notNull,
    };
  }

  return payload;
}

// ────────────── jsPDF / autoTable loader & guards ──────────────
function ensurePdfReady() {
  const hasJsPDF = !!(window.jspdf && window.jspdf.jsPDF);
  const hasAutoV2 = !!(window.jspdf && window.jspdf.autoTable);
  const hasAutoV3 = !!window.jspdf?.jsPDF?.API?.autoTable;
  const ok = hasJsPDF && (hasAutoV2 || hasAutoV3);
  if (!ok) setMsg("PDF engine not loaded yet. Please try again in a second.");
  return ok;
}
function runAutoTable(doc, opts) {
  if (typeof doc.autoTable === "function") {
    doc.autoTable(opts); // v3 style on doc
  } else if (typeof window.jspdf?.autoTable === "function") {
    window.jspdf.autoTable(doc, opts); // v2 UMD style
  } else {
    throw new Error("autoTable plugin not found");
  }
}
let __pdfLoading = null;
async function loadScriptUMD(src) {
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.defer = true;
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load script: " + src));
    document.head.appendChild(s);
  });
}
async function loadPdfEngine() {
  if (ensurePdfReady()) return;
  if (__pdfLoading) {
    await __pdfLoading;
    return;
  }
  __pdfLoading = (async () => {
    try {
      if (PDF_LOAD_MODE === "umd" || PDF_LOAD_MODE === "auto") {
        await loadScriptUMD(PDF_UMD_PATHS.jsPDF);
        await loadScriptUMD(PDF_UMD_PATHS.autoTable);
      }
      // If still not ready (or forced ESM), try ESM paths
      if (
        !ensurePdfReady() &&
        (PDF_LOAD_MODE === "esm" || PDF_LOAD_MODE === "auto")
      ) {
        const jspdfMod = await import(/* @vite-ignore */ PDF_ESM_PATHS.jsPDF);
        await import(/* @vite-ignore */ PDF_ESM_PATHS.autoTable);
        if (!window.jspdf) window.jspdf = {};
        window.jspdf.jsPDF = jspdfMod.jsPDF;
      }
    } finally {
      // no-op
    }
  })();
  await __pdfLoading;
}

// ---- Quick-chip helpers ----
function setChip(btn, pressed) {
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(pressed));
  btn.classList.toggle("is-active", pressed);
}
function toggleChip(btn, stateKey) {
  if (!btn) return;
  const now = btn.getAttribute("aria-pressed") === "true";
  const next = !now;
  setChip(btn, next);
  if (stateKey === "mosLt3") state.quick.mosLt3 = next;
  if (stateKey === "raso") state.quick.raso = next;
  page = 1;
  runQuery();
}

// Use names directly for filtering (mirrors SQL)
const RASO_NAMES = [
  "Bhasmam",
  "Chendooram",
  "Chunnam",
  "Kalimbu",
  "Karpam",
  "Karuppu",
  "Ksharam",
  "Kuzhambu (Siddha)",
  "Louham",
  "Mai",
  "Mandooram",
  "Mathirai",
  "Mezhuku",
  "Parpam",
  "Pasai",
  "Pathangam",
  "Patru",
  "Podi",
  "Rasam",
  "Sindooram",
  "Vennei",
];

/* ───────────────────── DOM refs ───────────────────── */
let elItemSel, elPackSize, elUOM;
let drawerCat, drawerSubcat, drawerPgroup, drawerSgroup;

// Filters modal refs (needed across init)
let elFiltersBtn, elFiltersModal, elFiltersModalClose, elFiltersModalBody;
let elFiltersApply, elFiltersCancel;
let closeFiltersModalFn = null;

let elExport, elExportPDF, elHome, elClear;
let elCount, elUpdated, elPrev, elNext, elPage;
let elTable, elBody;

let elQfMosLt3, elQfRaso;

// Advanced drawer controls
let exCat, exSubcat, exPgroup, exSgroup;

let mosIkEn, mosIkOp, mosIkV1, mosIkV2, mosIkNN;
let mosKkdEn, mosKkdOp, mosKkdV1, mosKkdV2, mosKkdNN;
let mosOkEn, mosOkOp, mosOkV1, mosOkV2, mosOkNN;
let mosOvEn, mosOvOp, mosOvV1, mosOvV2, mosOvNN;

let advApply, advCount;

/* ─────────────────────────── State ─────────────────────────── */
const PAGE_SIZE = 50;
const BASE_VISIBLE_COLS = 15;
function visibleCols() {
  try {
    return BASE_VISIBLE_COLS + (state?.showValue ? 4 : 0);
  } catch {
    return BASE_VISIBLE_COLS;
  }
}
let page = 1;

// Client-side sort state and last fetched rows (kept for responsive sorting)
let sortState = { keys: [], userOverride: false };
let __lastRows = [];
// Last totals object returned by RPC (value aggregates etc.)
let __lastTotals = null;
// remember element focused before opening modals so we can restore focus
let __lastFocusBeforeRowModal = null;
let __lastFocusBeforeValueModal = null;

let selectedProductId = "";

const state = {
  pack_size: "",
  uom: "",
  quick: { mosLt3: false, raso: false },
  category_id: "",
  sub_category_id: "",
  product_group_id: "",
  sub_group_id: "",
  ex: { cats: [], subcats: [], pgroups: [], sgroups: [] },
  mos: {
    ik: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    kkd: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    ok: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    ov: { en: false, op: "gt", v1: "", v2: "", notNull: false },
  },
};

let __advExInitDone = false;

/* ─────────────────────────── Init ─────────────────────────── */
onReady(init);

async function init() {
  try {
    await loadPdfEngine();

    // 0) Grab DOM refs
    elItemSel = $("sc-item");
    elPackSize = $("sc-packsize");
    elUOM = $("sc-uom");
    // inline clear buttons for Item and Pack Size
    const elItemClearBtn = $("sc-item-clear");
    const elPackClearBtn = $("sc-packsize-clear");

    drawerCat = $("drawer-cat");
    drawerSubcat = $("drawer-subcat");
    drawerPgroup = $("drawer-pgroup");
    drawerSgroup = $("drawer-sgroup");

    elExport = $("sc-export");
    elExportPDF = $("sc-export-pdf");
    const elDownload = $("sc-download");
    const elExportModal = $("sc-export-modal");
    const elExportModalClose = $("sc-export-modal-close");
    elHome = $("homeBtn");
    elClear = $("sc-clear");

    elCount = $("sc-count");
    elUpdated = $("sc-updated");
    elPrev = $("sc-prev");
    elNext = $("sc-next");
    elPage = $("sc-page");

    // New UI elements
    elTotalValue = $("sc-total-value");
    elToggleValue = $("toggle-value");
    elValueModal = $("sc-value-modal");
    elValueModalClose = $("sc-value-modal-close");
    elValueBody = $("sc-value-body-content");
    elValueSnapshot = $("sc-value-snapshot");

    elRowModal = $("sc-row-modal");
    elRowModalClose = $("sc-row-modal-close");
    elRowHeader = $("sc-row-header");
    elRowClassif = $("sc-row-classif");
    elRowQty = $("sc-row-qty");
    elRowValue = $("sc-row-value");
    elRowFooter = $("sc-row-footer-info");

    elTable = $("sc-table");
    elBody = $("sc-body");

    // Add drag/scroll detection on the table body to avoid opening modals while scrolling
    if (elBody) {
      elBody.addEventListener(
        "touchstart",
        function () {
          __sc_isDragging = false;
        },
        { passive: true }
      );
      elBody.addEventListener(
        "touchmove",
        function () {
          __sc_isDragging = true;
        },
        { passive: true }
      );
      elBody.addEventListener(
        "touchend",
        function () {
          setTimeout(() => (__sc_isDragging = false), 50);
        },
        { passive: true }
      );

      elBody.addEventListener(
        "mousedown",
        function () {
          __sc_mouseDown = true;
          __sc_isDragging = false;
        },
        { passive: true }
      );
      elBody.addEventListener(
        "mousemove",
        function () {
          if (__sc_mouseDown) __sc_isDragging = true;
        },
        { passive: true }
      );
      elBody.addEventListener(
        "mouseup",
        function () {
          __sc_mouseDown = false;
          setTimeout(() => (__sc_isDragging = false), 50);
        },
        { passive: true }
      );
    }

    elQfMosLt3 = $("qf-moslt3");
    elQfRaso = $("qf-raso");

    // Advanced
    exCat = $("ex-cat");
    exSubcat = $("ex-subcat");
    exPgroup = $("ex-pgroup");
    exSgroup = $("ex-sgroup");

    // MOS controls (advanced filters) - wire DOM refs so v2 can be hidden when not needed
    mosIkOp = $("mosik-op");
    mosIkV1 = $("mosik-v1");
    mosIkV2 = $("mosik-v2");
    mosIkNN = $("mosik-nnull");

    mosKkdOp = $("moskkd-op");
    mosKkdV1 = $("moskkd-v1");
    mosKkdV2 = $("moskkd-v2");
    mosKkdNN = $("moskkd-nnull");

    mosOkOp = $("mosok-op");
    mosOkV1 = $("mosok-v1");
    mosOkV2 = $("mosok-v2");
    mosOkNN = $("mosok-nnull");

    mosOvOp = $("mosov-op");
    mosOvV1 = $("mosov-v1");
    mosOvV2 = $("mosov-v2");
    mosOvNN = $("mosov-nnull");

    // Snapshot status: professional inline detail with adaptive width/position
    if (elUpdated) {
      const margin = 8;
      const MIN_WIDTH = 160;
      const PREFERRED_MIN = 180;
      const MAX_WIDTH = 420;

      function hideStatusDetail(statusDetail) {
        try {
          if (!statusDetail) return;
          statusDetail.style.display = "none";
          statusDetail.style.position = "";
          statusDetail.style.left = "";
          statusDetail.style.top = "";
          statusDetail.style.width = "";
          statusDetail.style.maxWidth = "";
          statusDetail.style.boxSizing = "";
          statusDetail.style.zIndex = "";
        } catch {
          void 0;
        }
      }

      function positionStatusDetail(statusDetail) {
        try {
          if (!statusDetail || !elUpdated) return;
          // Ensure detail is visible and detached from ancestor clipping
          if (statusDetail.parentElement !== document.body)
            document.body.appendChild(statusDetail);
          statusDetail.style.display = "block";
          statusDetail.style.position = "absolute";
          statusDetail.style.boxSizing = "border-box";
          statusDetail.style.zIndex = 9999;

          const rect = elUpdated.getBoundingClientRect();
          const vw = Math.max(
            document.documentElement.clientWidth || 0,
            window.innerWidth || 0
          );
          const scrollX = window.scrollX || window.pageXOffset || 0;
          const scrollY = window.scrollY || window.pageYOffset || 0;

          const availableRight = Math.max(0, vw - rect.right - margin);
          const availableLeft = Math.max(0, rect.left - margin);

          // Choose side: prefer right, fall back to left if right is too small
          let side = "right";
          if (availableRight < PREFERRED_MIN && availableLeft >= PREFERRED_MIN)
            side = "left";
          else if (availableRight < MIN_WIDTH && availableLeft >= MIN_WIDTH)
            side = "left";
          else if (availableRight < MIN_WIDTH && availableLeft < MIN_WIDTH)
            side = availableLeft > availableRight ? "left" : "right";

          let avail = side === "right" ? availableRight : availableLeft;
          // Let content define natural width when it fits the available space
          statusDetail.style.width = "auto";
          const natural = Math.ceil(
            Math.max(
              statusDetail.scrollWidth || 0,
              statusDetail.getBoundingClientRect().width || 0
            )
          );
          const cap = Math.min(MAX_WIDTH, vw - margin * 2);
          let width;
          if (natural && natural <= cap && (!avail || natural <= avail)) {
            // content fits — use natural width (no enforced MIN_WIDTH)
            width = natural;
          } else {
            // fallback to adaptive sizing based on available space
            width = Math.min(
              cap,
              Math.max(PREFERRED_MIN, avail || PREFERRED_MIN)
            );
            if (avail && avail < PREFERRED_MIN)
              width = Math.max(MIN_WIDTH, avail);
            width = Math.min(width, cap);
          }

          // Compute left coordinate
          let left;
          if (side === "right") {
            left = rect.left + scrollX;
            if (left + width > vw + scrollX - margin)
              left = vw + scrollX - width - margin;
            if (left < margin + scrollX) left = margin + scrollX;
          } else {
            left = rect.right + scrollX - width;
            if (left < margin + scrollX) left = margin + scrollX;
            if (left + width > vw + scrollX - margin)
              left = vw + scrollX - width - margin;
          }

          const top = rect.bottom + scrollY + 6;

          statusDetail.style.left = left + "px";
          statusDetail.style.top = top + "px";
          statusDetail.style.width = width + "px";
          statusDetail.style.maxWidth =
            Math.min(MAX_WIDTH, vw - margin * 2) + "px";
        } catch {
          // fallback: show inline
          try {
            statusDetail.style.position = "";
            statusDetail.style.display = "block";
          } catch {
            void 0;
          }
        }
      }

      // Add professional status expansion on click
      elUpdated.addEventListener("click", (ev) => {
        try {
          ev.preventDefault();
          const expanded = elUpdated.classList.toggle("sc-status-expanded");
          elUpdated.setAttribute("aria-expanded", String(expanded));
          const statusDetail = document.getElementById("sc-status-detail");
          if (!statusDetail) return;
          if (expanded) {
            positionStatusDetail(statusDetail);
          } else {
            hideStatusDetail(statusDetail);
          }
        } catch {
          void 0;
        }
      });

      elUpdated.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          elUpdated.click();
        }
      });

      // Close status detail when clicking outside
      document.addEventListener("click", (ev) => {
        try {
          if (!elUpdated) return;
          const statusDetail = document.getElementById("sc-status-detail");
          // If click is inside the snapshot control or status detail, don't close
          if (elUpdated.contains(ev.target)) return;
          if (statusDetail && statusDetail.contains(ev.target)) return;

          // Close if currently expanded
          if (elUpdated.classList.contains("sc-status-expanded")) {
            elUpdated.classList.remove("sc-status-expanded");
            elUpdated.setAttribute("aria-expanded", "false");
            if (statusDetail) hideStatusDetail(statusDetail);
          }
        } catch {
          void 0;
        }
      });

      // Reposition while open on resize/scroll
      const repositionDebounced = debounce(() => {
        try {
          const statusDetail = document.getElementById("sc-status-detail");
          if (
            statusDetail &&
            elUpdated.classList.contains("sc-status-expanded")
          )
            positionStatusDetail(statusDetail);
        } catch {
          void 0;
        }
      }, 120);
      window.addEventListener("resize", repositionDebounced);
      window.addEventListener("scroll", repositionDebounced, { passive: true });
    }

    advApply = $("adv-apply");
    // advClear removed from markup; no element to reference
    advCount = $("adv-count");

    // Dynamic table offset: compute and set CSS variable so the table card
    // fills remaining viewport space and vertical scroll is inside the card.
    const tableWrap = document.querySelector(".table-wrap");
    // Move the page-level message element into the table card so it doesn't
    // add to the document height. Style class `sc-msg-overlay` will anchor
    // it inside the card.
    const scMsgEl = document.getElementById("sc-msg");
    if (scMsgEl && tableWrap && scMsgEl.parentElement !== tableWrap) {
      tableWrap.appendChild(scMsgEl);
      scMsgEl.classList.add("sc-msg-overlay");
    }
    function computeTableOffset() {
      if (!tableWrap) return;
      const rect = tableWrap.getBoundingClientRect();
      const top = Math.max(0, Math.round(rect.top));
      const gutter = 18; // small breathing room below filters
      const offset = top + gutter;
      // Set CSS variable (legacy) and also set inline max-height on the
      // .table-wrap so we precisely control vertical space and avoid a
      // persistent page-level scrollbar.
      document.documentElement.style.setProperty(
        "--sc-table-offset",
        offset + "px"
      );
      try {
        const available = Math.max(160, window.innerHeight - offset - 8); // keep a small bottom gap
        tableWrap.style.maxHeight = available + "px";
      } catch {
        // ignore in non-browser contexts
      }
    }
    const debouncedComputeTableOffset = debounce(computeTableOffset, 120);

    // Initial compute after layout stabilises
    setTimeout(computeTableOffset, 80);
    // Recompute on resize / orientation change
    window.addEventListener("resize", debouncedComputeTableOffset);
    window.addEventListener("orientationchange", debouncedComputeTableOffset);

    // Recompute when drawers toggle (details elements open/close)
    document
      .querySelectorAll("details.drawer")
      .forEach((d) =>
        d.addEventListener("toggle", () => setTimeout(computeTableOffset, 60))
      );

    // Wire export buttons early
    elExport && elExport.addEventListener("click", exportCSV);
    elExportPDF &&
      elExportPDF.addEventListener("click", () => {
        // toggle drawer
        const dr = $("sc-export-drawer");
        if (!dr) return;
        const expanded = elExportPDF.getAttribute("aria-expanded") === "true";
        if (expanded) {
          dr.style.display = "none";
          dr.setAttribute("aria-hidden", "true");
          elExportPDF.setAttribute("aria-expanded", "false");
        } else {
          dr.style.display = "block";
          dr.setAttribute("aria-hidden", "false");
          elExportPDF.setAttribute("aria-expanded", "true");
        }
      });
    // Open export modal (accessible: manage focus and inertness)
    if (elDownload && elExportModal) {
      const setModalInert = (on) => {
        try {
          // modern browsers support inert property
          elExportModal.inert = !!on;
        } catch {
          // ignore if not supported
        }
      };

      const closeExportModal = () => {
        // If focus is inside the modal, move it back to the trigger first
        try {
          const active = document.activeElement;
          if (active && elExportModal.contains(active)) {
            if (typeof active.blur === "function") active.blur();
            elDownload.focus();
          }
        } catch {
          /* ignore focus errors */
        }
        setModalInert(true);
        elExportModal.style.display = "none";
        elExportModal.setAttribute("aria-hidden", "true");
        elDownload.setAttribute("aria-expanded", "false");
      };

      elDownload.addEventListener("click", (ev) => {
        ev.preventDefault();
        setModalInert(false);
        elExportModal.style.display = "flex";
        elExportModal.setAttribute("aria-hidden", "false");
        elDownload.setAttribute("aria-expanded", "true");
        // Focus primary action if present, otherwise the close button
        setTimeout(() => {
          const primary = $("sc-export");
          if (primary) primary.focus();
          else elExportModalClose?.focus();
        }, 20);
      });

      // Close button: blur and return focus to trigger before hiding
      elExportModalClose?.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeExportModal();
      });

      // click backdrop to close
      elExportModal?.addEventListener("click", (ev) => {
        if (
          ev.target &&
          ev.target.classList &&
          ev.target.classList.contains("sc-modal-backdrop")
        ) {
          closeExportModal();
        }
      });

      // escape key
      document.addEventListener("keydown", (ev) => {
        if (
          ev.key === "Escape" &&
          elExportModal &&
          elExportModal.style.display !== "none"
        ) {
          closeExportModal();
        }
      });
      // ------------- Value modal and Row modal wiring -------------
      // Toggle value columns
      if (elToggleValue) {
        elToggleValue.addEventListener("click", () => {
          state.showValue = !state.showValue;
          elToggleValue.setAttribute("aria-pressed", String(!!state.showValue));
          elToggleValue.classList.toggle("active", !!state.showValue);
          elToggleValue.textContent = state.showValue
            ? "Hide Value"
            : "Show Value";
          // show/hide header ths
          Array.from(
            document.querySelectorAll("#sc-table thead th.col-value")
          ).forEach((th) => {
            th.style.display = state.showValue ? "table-cell" : "none";
          });
          // re-render rows (they include value TDs when flag is ON)
          renderRows(__lastRows || []);
        });
      }

      // Total value pill click: open modal and compute totals when needed
      if (elTotalValue) {
        elTotalValue.addEventListener("click", async () => {
          // remember prior focus so we can restore it on close
          __lastFocusBeforeValueModal =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          if (!elValueModal) return;
          elValueModal.style.display = "flex";
          elValueModal.setAttribute("aria-hidden", "false");
          elValueBody.textContent = "Calculating…";
          try {
            let totals = __lastTotals;
            if (!totals) {
              const filters = buildStockCheckerFiltersPayload();
              const { data, error } = await supabase.rpc(
                "stock_checker_query",
                {
                  p_filters: filters,
                  p_page: 1,
                  p_page_size: 1,
                }
              );
              if (error) throw error;
              totals = (data && data.totals) || null;
              __lastTotals = totals;
            }

            const t = totals || {
              value_ik: 0,
              value_kkd: 0,
              value_ok: 0,
              value_overall: 0,
              snapshot_date: null,
            };
            elValueBody.innerHTML = `
              <div>IK: <strong>${fmtINR(t.value_ik)}</strong></div>
              <div>KKD: <strong>${fmtINR(t.value_kkd)}</strong></div>
              <div>OK: <strong>${fmtINR(t.value_ok)}</strong></div>
              <div style="margin-top:8px">Overall: <strong>${fmtINR(
                t.value_overall
              )}</strong></div>
            `;
            if (elValueSnapshot)
              elValueSnapshot.textContent = t.snapshot_date
                ? `Snapshot: ${new Date(t.snapshot_date).toLocaleString()}`
                : "";
          } catch (err) {
            console.error(err);
            elValueBody.textContent = "Failed to compute totals.";
          }
        });

        // Close handlers: close button, backdrop click, escape
        elValueModalClose?.addEventListener("click", (ev) => {
          ev.preventDefault();
          closeValueModal();
        });
        elValueModal?.addEventListener("click", (ev) => {
          if (
            ev.target &&
            ev.target.classList &&
            ev.target.classList.contains("sc-modal-backdrop")
          )
            closeValueModal();
        });
        document.addEventListener("keydown", (ev) => {
          if (
            ev.key === "Escape" &&
            elValueModal &&
            elValueModal.style.display !== "none"
          )
            closeValueModal();
        });
      }

      // Row modal close / backdrop / escape
      function closeRowModal() {
        if (!elRowModal) return;
        try {
          // if a descendant still has focus, blur it first to avoid aria-hidden on focused element
          const active = document.activeElement;
          if (
            active &&
            elRowModal.contains(active) &&
            typeof active.blur === "function"
          )
            active.blur();
        } catch {
          void 0;
        }
        elRowModal.style.display = "none";
        elRowModal.setAttribute("aria-hidden", "true");
        try {
          if (
            __lastFocusBeforeRowModal &&
            typeof __lastFocusBeforeRowModal.focus === "function"
          ) {
            __lastFocusBeforeRowModal.focus();
          } else {
            // fallback: focus table body or count pill
            elBody?.focus?.();
            elCount?.focus?.();
          }
        } catch {
          void 0;
        }
        __lastFocusBeforeRowModal = null;
      }
      elRowModalClose?.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeRowModal();
      });
      elRowModal?.addEventListener("click", (ev) => {
        if (
          ev.target &&
          ev.target.classList &&
          ev.target.classList.contains("sc-modal-backdrop")
        )
          closeRowModal();
      });
      document.addEventListener("keydown", (ev) => {
        if (
          ev.key === "Escape" &&
          elRowModal &&
          elRowModal.style.display !== "none"
        )
          closeRowModal();
      });

      // Value modal close / backdrop / escape
      function closeValueModal() {
        if (!elValueModal) return;
        try {
          const active = document.activeElement;
          if (
            active &&
            elValueModal.contains(active) &&
            typeof active.blur === "function"
          )
            active.blur();
        } catch {
          void 0;
        }
        elValueModal.style.display = "none";
        elValueModal.setAttribute("aria-hidden", "true");
        try {
          if (
            __lastFocusBeforeValueModal &&
            typeof __lastFocusBeforeValueModal.focus === "function"
          ) {
            __lastFocusBeforeValueModal.focus();
          } else {
            elTotalValue?.focus?.();
          }
        } catch {
          void 0;
        }
        __lastFocusBeforeValueModal = null;
      }
      elValueModalClose?.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeValueModal();
      });
      elValueModal?.addEventListener("click", (ev) => {
        if (
          ev.target &&
          ev.target.classList &&
          ev.target.classList.contains("sc-modal-backdrop")
        )
          closeValueModal();
      });
      document.addEventListener("keydown", (ev) => {
        if (
          ev.key === "Escape" &&
          elValueModal &&
          elValueModal.style.display !== "none"
        )
          closeValueModal();
      });
      // Filters modal: move filters into a centered modal to save space on demand
      elFiltersBtn = $("sc-filters-btn");
      elFiltersModal = $("sc-filters-modal");
      elFiltersModalClose = $("sc-filters-modal-close");
      elFiltersModalBody = $("sc-filters-modal-body");
      elFiltersApply = $("sc-filters-apply");
      elFiltersCancel = $("sc-filters-cancel");

      // Will be set to close function when modal wiring happens (assigned to outer-scoped variable)
      // closeFiltersModalFn declared in outer scope above

      const filterNodeIds = [
        "sc-filters",
        "drawer-classification",
        "drawer-advanced",
      ];
      window.__origFilterPlacement = window.__origFilterPlacement || {};

      function moveFiltersToModal() {
        if (!elFiltersModalBody) return;
        filterNodeIds.forEach((id) => {
          const el = $(id);
          if (!el) return;
          // remember original parent and nextSibling for precise restore
          if (!window.__origFilterPlacement[id]) {
            window.__origFilterPlacement[id] = {
              parent: el.parentNode,
              nextSibling: el.nextSibling,
            };
          }
          elFiltersModalBody.appendChild(el);
        });
        // recompute table offset since top layout changed
        try {
          if (typeof debouncedComputeTableOffset === "function")
            debouncedComputeTableOffset();
        } catch {
          void 0;
        }
      }

      function restoreFiltersFromModal() {
        filterNodeIds.forEach((id) => {
          const el = $(id);
          const orig = window.__origFilterPlacement[id];
          if (!el || !orig || !orig.parent) return;
          // If the original nextSibling is still present append before it,
          // otherwise append to the original parent.
          try {
            if (
              orig.nextSibling &&
              orig.nextSibling.parentNode === orig.parent
            ) {
              orig.parent.insertBefore(el, orig.nextSibling);
            } else {
              orig.parent.appendChild(el);
            }
          } catch {
            // best-effort: try append
            try {
              orig.parent.appendChild(el);
            } catch {
              void 0;
            }
          }
          delete window.__origFilterPlacement[id];
        });
        try {
          if (typeof debouncedComputeTableOffset === "function")
            debouncedComputeTableOffset();
        } catch {
          void 0;
        }
      }

      if (elFiltersBtn && elFiltersModal) {
        const setFiltersModalInert = (on) => {
          try {
            elFiltersModal.inert = !!on;
          } catch {
            void 0;
          }
        };

        elFiltersBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          // Move filters into the modal and open it
          moveFiltersToModal();
          // ensure Reset button state reflects current filters
          try {
            updateFiltersButtonState();
          } catch {
            void 0;
          }
          setFiltersModalInert(false);
          elFiltersModal.style.display = "flex";
          elFiltersModal.setAttribute("aria-hidden", "false");
          setTimeout(() => {
            const first =
              $("sc-item") ||
              elFiltersModalBody.querySelector("input,select,button");
            if (first && typeof first.focus === "function") first.focus();
          }, 20);
        });

        const closeFiltersModal = () => {
          // If focus is inside, blur then return focus to trigger
          try {
            const active = document.activeElement;
            if (active && elFiltersModal.contains(active)) {
              if (typeof active.blur === "function") active.blur();
              elFiltersBtn.focus();
            }
          } catch {
            void 0;
          }
          // restore filters to original position
          restoreFiltersFromModal();
          setFiltersModalInert(true);
          elFiltersModal.style.display = "none";
          elFiltersModal.setAttribute("aria-hidden", "true");
        };

        // expose for other handlers (quick chips) to close modal
        try {
          closeFiltersModalFn = closeFiltersModal;
        } catch {
          void 0;
        }

        elFiltersModalClose?.addEventListener("click", (ev) => {
          ev.preventDefault();
          closeFiltersModal();
        });

        elFiltersCancel?.addEventListener("click", (ev) => {
          ev.preventDefault();
          closeFiltersModal();
        });

        elFiltersModal?.addEventListener("click", (ev) => {
          if (
            ev.target &&
            ev.target.classList &&
            ev.target.classList.contains("sc-modal-backdrop")
          ) {
            closeFiltersModal();
          }
        });

        elFiltersApply?.addEventListener("click", (ev) => {
          ev.preventDefault();
          // move filters back then apply
          restoreFiltersFromModal();
          // read advanced state (was previously done by inner advApply)
          try {
            readAdvancedState();
            const n = countAdvancedActive();
            if (advCount) {
              if (n > 0) {
                advCount.style.display = "";
                advCount.textContent = `Advanced • ${n}`;
              } else {
                advCount.style.display = "none";
              }
            }
          } catch {
            void 0;
          }
          setFiltersModalInert(true);
          elFiltersModal.style.display = "none";
          elFiltersModal.setAttribute("aria-hidden", "true");
          elFiltersBtn.focus();
          page = 1;
          runQuery();
        });

        document.addEventListener("keydown", (ev) => {
          if (
            ev.key === "Escape" &&
            elFiltersModal &&
            elFiltersModal.style.display !== "none"
          ) {
            closeFiltersModal();
          }
        });
        // Ensure Reset button also closes the filters modal after clearing.
        // Use a deferred call so `clearAll()` (other listener) runs first.
        elClear &&
          elClear.addEventListener("click", () => {
            setTimeout(() => {
              try {
                if (elFiltersModal && elFiltersModal.style.display !== "none")
                  closeFiltersModal();
              } catch {
                try {
                  // best-effort fallback
                  restoreFiltersFromModal();
                  if (elFiltersModal) {
                    elFiltersModal.style.display = "none";
                    elFiltersModal.setAttribute("aria-hidden", "true");
                  }
                } catch {
                  void 0;
                }
              }
            }, 0);
          });
      }
    }
    // wire drawer buttons if present
    const drGod = $("sc-export-godowns");
    const drReg = $("sc-export-region");
    const drHO = $("sc-export-ho");
    if (Object.keys(window.__origFilterPlacement || {}).length === 0)
      runQuery();
    if (drGod)
      drGod.addEventListener("click", async () => {
        try {
          await exportCoveragePDF();
        } finally {
          const d = $("sc-export-drawer");
          if (d) {
            d.style.display = "none";
            d.setAttribute("aria-hidden", "true");
            elExportPDF.setAttribute("aria-expanded", "false");
          }
        }
      });
    if (drReg)
      drReg.addEventListener("click", async () => {
        try {
          await exportCoveragePDFRegion();
        } finally {
          const d = $("sc-export-drawer");
          if (d) {
            d.style.display = "none";
            d.setAttribute("aria-hidden", "true");
            elExportPDF.setAttribute("aria-expanded", "false");
          }
        }
      });
    if (drHO)
      drHO.addEventListener("click", async () => {
        try {
          await exportCoveragePDFHODepot();
        } finally {
          const d = $("sc-export-drawer");
          if (d) {
            d.style.display = "none";
            d.setAttribute("aria-hidden", "true");
            elExportPDF.setAttribute("aria-expanded", "false");
          }
        }
      });

    // Explode controls (show/hide full groups). No persistence; default collapsed.
    const btnExplodeStock = $("explode-stock");
    const btnExplodeDemand = $("explode-demand");
    const btnExplodeMos = $("explode-mos");
    const tbl = $("sc-table");

    function toggleExplode(btn, cls) {
      if (!btn || !tbl) return;
      const now = btn.getAttribute("aria-pressed") === "true";
      const next = !now;
      btn.setAttribute("aria-pressed", String(next));
      btn.classList.toggle("is-active", next);
      if (next) tbl.classList.add(cls);
      else tbl.classList.remove(cls);
      // Adjust table offset after layout changes so the table height stays
      // within the viewport. Use a small timeout to let CSS class changes settle.
      setTimeout(() => {
        try {
          // debouncedComputeTableOffset may be available from init; prefer it
          if (typeof debouncedComputeTableOffset === "function")
            debouncedComputeTableOffset();
          else if (typeof computeTableOffset === "function")
            computeTableOffset();
        } catch {
          /* ignore */
        }
      }, 60);
    }

    btnExplodeStock &&
      btnExplodeStock.addEventListener("click", () =>
        toggleExplode(btnExplodeStock, "explode-stock-active")
      );
    btnExplodeDemand &&
      btnExplodeDemand.addEventListener("click", () =>
        toggleExplode(btnExplodeDemand, "explode-demand-active")
      );
    btnExplodeMos &&
      btnExplodeMos.addEventListener("click", () =>
        toggleExplode(btnExplodeMos, "explode-mos-active")
      );

    // Pagination
    elPrev &&
      elPrev.addEventListener("click", () => {
        if (page > 1) {
          page--;
          runQuery();
        }
      });
    elNext &&
      elNext.addEventListener("click", () => {
        page++;
        runQuery();
      });

    // Navigation
    elHome && elHome.addEventListener("click", () => Platform.goHome());
    elClear && elClear.addEventListener("click", clearAll);

    // Primary filters
    if (elPackSize) {
      elPackSize.addEventListener("input", () => {
        // Enforce digits-only for pack size (handles typing and paste)
        const raw = elPackSize.value || "";
        const cleaned = raw.replace(/[^0-9]/g, "");
        if (cleaned !== raw) {
          // attempt to preserve caret position
          const delta = raw.length - cleaned.length;
          const caret = (elPackSize.selectionStart || 0) - delta;
          elPackSize.value = cleaned;
          try {
            elPackSize.setSelectionRange(caret, caret);
          } catch {
            void 0;
          }
        }
        state.pack_size = (elPackSize.value || "").trim();
        autoFillUOM();
        page = 1;
        runQuery();
      });
      // show/hide packsize clear button
      if (elPackClearBtn) {
        const toggle = () => {
          elPackClearBtn.style.display = elPackSize.value ? "flex" : "none";
        };
        elPackSize.addEventListener("input", toggle);
        elPackClearBtn.addEventListener("click", () => {
          elPackSize.value = "";
          state.pack_size = "";
          elPackClearBtn.style.display = "none";
          autoFillUOM();
          page = 1;
          runQuery();
          elPackSize.focus();
        });
        // init visibility
        toggle();
      }
    }

    // Item clear button wiring
    if (elItemSel && elItemClearBtn) {
      const toggleIt = () => {
        elItemClearBtn.style.display = elItemSel.value ? "flex" : "none";
      };
      elItemSel.addEventListener("input", toggleIt);
      elItemClearBtn.addEventListener("click", () => {
        if (typeof elItemSel._clear === "function") elItemSel._clear();
        else elItemSel.value = "";
        selectedProductId = "";
        // ensure UOM is cleared when item is cleared
        autoFillUOM();
        elItemClearBtn.style.display = "none";
        page = 1;
        runQuery();
        elItemSel.focus();
      });
      // init visibility
      toggleIt();
    }

    if (elQfMosLt3) {
      elQfMosLt3.addEventListener("click", () => {
        toggleChip(elQfMosLt3, "mosLt3");
        try {
          if (typeof closeFiltersModalFn === "function") closeFiltersModalFn();
        } catch {
          void 0;
        }
      });
      setChip(elQfMosLt3, state.quick.mosLt3 === true);
    }
    if (elQfRaso) {
      elQfRaso.addEventListener("click", () => {
        toggleChip(elQfRaso, "raso");
        try {
          if (typeof closeFiltersModalFn === "function") closeFiltersModalFn();
        } catch {
          void 0;
        }
      });
      setChip(elQfRaso, state.quick.raso === true);
    }

    wireClassificationFilters();
    await populateDrawerClassificationFilters();
    await populateAdvancedExclusions();
    initItemAutocomplete();
    wireAdvanced();

    // Attach column header sorting handlers (client-side)
    try {
      attachHeaderSorting();
    } catch {
      void 0;
    }

    updateStockSnapshotLabel();
    await runQuery();
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
  }
}

/* ───────────────────── Tom Select (Item) ───────────────────── */
function initItemAutocomplete() {
  if (!elItemSel) return;

  const listEl = document.getElementById("sc-item-list");
  let q = "";
  let loading = false;
  let pageNo = 1;
  let hasMore = false;
  let items = [];
  let activeIndex = -1;

  function clearList() {
    if (!listEl) return;
    listEl.innerHTML = "";
    listEl.hidden = true;
    items = [];
    pageNo = 1;
    hasMore = false;
    activeIndex = -1;
  }

  async function fetchPage(query, page) {
    loading = true;
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = page * PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("products")
        .select("id,item")
        .ilike("item", `%${query}%`)
        .order("item", { ascending: true })
        .range(from, to);
      if (error) {
        console.error("Item load failed:", error.message);
        return [];
      }
      return data || [];
    } finally {
      loading = false;
    }
  }

  function render() {
    if (!listEl) return;
    let html = "";
    if ((items || []).length > 0) {
      html = items
        .map(
          (it, idx) =>
            `<div class="ac-item" role="option" data-id="${escapeHtml(
              it.id
            )}" data-idx="${idx}" aria-selected="${
              idx === activeIndex
            }">${escapeHtml(it.item)}</div>`
        )
        .join("");
    } else if (loading) {
      html = `<div class="ac-loading"><span class="ac-spinner" aria-hidden="true"></span><span>Loading…</span></div>`;
    } else if (q) {
      html = `<div class="ac-item" role="option" aria-selected="false">No results for "${escapeHtml(
        q
      )}"</div>`;
    }
    listEl.innerHTML = html;
    listEl.hidden = !loading && !(items || []).length && !q;
  }

  async function loadMore() {
    if (loading || (!hasMore && pageNo > 1 && items.length > 0)) return;
    const data = await fetchPage(q, pageNo);
    if (data.length) {
      items = items.concat(data);
      hasMore = data.length === PAGE_SIZE;
      pageNo += 1;
    } else {
      hasMore = false;
    }
    render();
  }

  const doSearch = debounce(async (term) => {
    q = String(term || "").trim();
    items = [];
    pageNo = 1;
    hasMore = false;
    activeIndex = -1;
    if (!q) {
      clearList();
      return;
    }
    // load first page
    const data = await fetchPage(q, pageNo);
    items = data || [];
    hasMore = (data || []).length === PAGE_SIZE;
    pageNo = 2;
    render();
  }, 220);

  // input handlers
  elItemSel.addEventListener("input", (ev) => {
    const v = ev.target.value;
    doSearch(v);
  });

  elItemSel.addEventListener("focus", () => {
    if (items.length) {
      document.getElementById("sc-item-list").hidden = false;
    }
  });

  elItemSel.addEventListener("keydown", (ev) => {
    const list = listEl;
    if (!list) return;
    const visibleItems = list.querySelectorAll(".ac-item[role=option]");
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      activeIndex = Math.min(activeIndex + 1, visibleItems.length - 1);
      scrollIntoViewIfNeeded(visibleItems[activeIndex]);
      render();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      scrollIntoViewIfNeeded(visibleItems[activeIndex]);
      render();
    } else if (ev.key === "Enter") {
      if (activeIndex >= 0 && visibleItems[activeIndex]) {
        ev.preventDefault();
        const el = visibleItems[activeIndex];
        selectItem(el.dataset.id, el.textContent || el.innerText);
      }
    } else if (ev.key === "Escape") {
      clearList();
    }
  });

  function scrollIntoViewIfNeeded(el) {
    if (!el) return;
    const p = el.parentElement;
    const r = el.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    if (r.top < pr.top) p.scrollTop -= pr.top - r.top + 6;
    else if (r.bottom > pr.bottom) p.scrollTop += r.bottom - pr.bottom + 6;
  }

  listEl?.addEventListener("click", (ev) => {
    const it = ev.target.closest(".ac-item");
    if (!it) return;
    selectItem(it.dataset.id, it.textContent || it.innerText);
  });

  listEl?.addEventListener(
    "scroll",
    debounce(() => {
      if (!listEl) return;
      const nearBottom =
        listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 40;
      if (nearBottom && hasMore && !loading) {
        loadMore();
      }
    }, 120)
  );

  function selectItem(id, label) {
    selectedProductId = id || "";
    elItemSel.value = label || "";
    clearList();
    page = 1;
    runQuery();
    if (state.pack_size) autoFillUOM();
    setTimeout(() => {
      elPackSize?.focus();
      elPackSize?.select();
    }, 0);
  }

  // click outside closes
  document.addEventListener("click", (ev) => {
    if (!elItemSel) return;
    if (ev.target === elItemSel || ev.target.closest?.(".autocomplete")) return;
    clearList();
  });

  // expose a small API on element for clearing if other code expects it
  elItemSel._clear = () => {
    elItemSel.value = "";
    selectedProductId = "";
    clearList();
  };
}

/* ─────────────────── Classification filters ─────────────────── */
function wireClassificationFilters() {
  if (!drawerCat || !drawerSubcat || !drawerPgroup || !drawerSgroup) return;

  // (resetBelow helper removed — unused; classification listeners are wired
  // in populateDrawerClassificationFilters() to avoid duplicate bindings)
  // Classification listeners are wired in populateDrawerClassificationFilters()
  // to avoid duplicate bindings. This function exists for backward
  // compatibility and intentionally does not attach change handlers here.
}

// Populate and wire up classification filters in the drawer
async function populateDrawerClassificationFilters() {
  if (!drawerCat || !drawerSubcat || !drawerPgroup || !drawerSgroup) return;

  function fillSelect(select, rows, valueKey, labelKey) {
    select.innerHTML = '<option value="">All</option>';
    (rows || []).forEach((row) => {
      const opt = document.createElement("option");
      opt.value = row[valueKey];
      opt.textContent = row[labelKey];
      select.appendChild(opt);
    });
  }

  // Build a checkbox-dropdown UI that mirrors a hidden <select multiple>
  function buildMultiFromSelect(selectId, listId, buttonText) {
    const sel = document.getElementById(selectId);
    const list = document.getElementById(listId);
    if (!sel || !list) return;
    // render items from select options (skip the "All" placeholder option if present)
    list.innerHTML = "";
    // header with close button
    const hdr = document.createElement("div");
    hdr.className = "mc-header";
    const hdrTitle = document.createElement("div");
    hdrTitle.className = "mc-title";
    hdrTitle.textContent = buttonText || "";
    const hdrClose = document.createElement("button");
    hdrClose.type = "button";
    hdrClose.className = "mc-close-btn";
    hdrClose.textContent = "✕";
    hdrClose.addEventListener("click", (ev) => {
      ev.stopPropagation();
      list.hidden = true;
    });
    hdr.appendChild(hdrTitle);
    hdr.appendChild(hdrClose);
    list.appendChild(hdr);

    Array.from(sel.options).forEach((opt) => {
      if (opt.value === "") return; // skip All placeholder
      const item = document.createElement("div");
      item.className = "mc-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.value = opt.value;
      cb.checked = opt.selected || false;
      const lbl = document.createElement("label");
      lbl.textContent = opt.textContent;
      item.appendChild(cb);
      item.appendChild(lbl);
      list.appendChild(item);

      cb.addEventListener("change", () => {
        // sync to underlying select
        const value = cb.dataset.value;
        const targetOpt = Array.from(sel.options).find(
          (o) => String(o.value) === String(value)
        );
        if (targetOpt) targetOpt.selected = cb.checked;
        // update button summary
        try {
          updateButtonText();
          if (Object.keys(window.__origFilterPlacement || {}).length === 0)
            updateFiltersButtonState();
        } catch {
          void 0;
        }
      });
    });

    // wire button toggle
    const parent = list.parentElement;
    const btn = parent?.querySelector(".multi-btn");
    if (!btn) return;
    const updateButtonText = () => {
      const selected = Array.from(sel.options)
        .filter((o) => o.value !== "" && o.selected)
        .map((o) => o.textContent);
      btn.textContent = selected.length
        ? selected.join(", ")
        : buttonText || btn.textContent;
    };
    // expose for use in change handler
    btn._updateText = updateButtonText;
    btn.textContent = buttonText || btn.textContent;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const hid = list.hidden;
      // close any other open lists
      document
        .querySelectorAll(".multi-list")
        .forEach((l) => (l.hidden = true));
      list.hidden = !hid;
    });
    // prevent clicks inside list from bubbling to document (which closes lists)
    list.addEventListener("click", (ev) => ev.stopPropagation());
    // initialize button text
    try {
      updateButtonText();
    } catch {
      void 0;
    }
  }

  // Build helper maps and a smarter fill that disambiguates duplicate names

  // 1) Categories
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, category_name")
    .order("category_name");
  if (catErr) console.error("Error fetching categories:", catErr);
  fillSelect(drawerCat, cats, "id", "category_name");

  // Prefetch all sub-categories, product groups and sub-groups so we
  // can populate every select upfront and filter client-side on changes.
  let allSubcats = [];
  let allPgroups = [];
  let allSgroups = [];
  try {
    const [subRes, pgRes, sgRes] = await Promise.all([
      supabase
        .from("sub_categories")
        .select("id, subcategory_name, category_id")
        .order("subcategory_name"),
      supabase
        .from("product_groups")
        .select("id, group_name, sub_category_id")
        .order("group_name"),
      supabase
        .from("sub_groups")
        .select("id, sub_group_name, product_group_id")
        .order("sub_group_name"),
    ]);
    if (subRes.error)
      console.error("Error fetching subcategories:", subRes.error);
    if (pgRes.error)
      console.error("Error fetching product groups:", pgRes.error);
    if (sgRes.error) console.error("Error fetching sub-groups:", sgRes.error);
    allSubcats = subRes.data || [];
    allPgroups = pgRes.data || [];
    allSgroups = sgRes.data || [];
  } catch (err) {
    console.error("Error prefetching classification lists:", err);
  }

  // Build lookup maps for parents (kept for potential future use)
  // Build name -> ids map for sub-categories so we can show unique names
  // in the sub-category select while still mapping a chosen name to the
  // underlying sub-category ids (union across categories). This implements
  // the ERP-style behaviour the user requested: choose "xx" and get all
  // xx rows regardless of Category, but if Category is selected we will
  // restrict the names shown to those within that Category.
  let subcatNameToIds = {};
  const buildSubcatNameMap = (rows) => {
    subcatNameToIds = {};
    (rows || []).forEach((r) => {
      const name = String(r.subcategory_name || "").trim();
      if (!name) return;
      subcatNameToIds[name] = subcatNameToIds[name] || [];
      subcatNameToIds[name].push(String(r.id));
    });
  };

  // product-group name -> ids map and helpers
  let pgroupNameToIds = {};
  const buildPgroupNameMap = (rows) => {
    pgroupNameToIds = {};
    (rows || []).forEach((r) => {
      const name = String(r.group_name || "").trim();
      if (!name) return;
      pgroupNameToIds[name] = pgroupNameToIds[name] || [];
      pgroupNameToIds[name].push(String(r.id));
    });
  };
  function fillPgroupSelectUnique(select, rows) {
    select.innerHTML = '<option value="">All</option>';
    const seen = new Set();
    (rows || []).forEach((r) => {
      const name = String(r.group_name || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  // sub-group name -> ids map and helpers
  let sgroupNameToIds = {};
  const buildSgroupNameMap = (rows) => {
    sgroupNameToIds = {};
    (rows || []).forEach((r) => {
      const name = String(r.sub_group_name || "").trim();
      if (!name) return;
      sgroupNameToIds[name] = sgroupNameToIds[name] || [];
      sgroupNameToIds[name].push(String(r.id));
    });
  };
  function fillSgroupSelectUnique(select, rows) {
    select.innerHTML = '<option value="">All</option>';
    const seen = new Set();
    (rows || []).forEach((r) => {
      const name = String(r.sub_group_name || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  // Populate all selects initially (user requested all enabled by default)
  // For sub-categories we show unique names (no parent suffix) by default.
  buildSubcatNameMap(allSubcats);
  function fillSubcatSelectUnique(select, rows) {
    select.innerHTML = '<option value="">All</option>';
    const seen = new Set();
    (rows || []).forEach((r) => {
      const name = String(r.subcategory_name || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  fillSubcatSelectUnique(drawerSubcat, allSubcats);
  // Populate product-group and sub-group selects with unique names
  buildPgroupNameMap(allPgroups);
  buildSgroupNameMap(allSgroups);
  fillPgroupSelectUnique(drawerPgroup, allPgroups);
  fillSgroupSelectUnique(drawerSgroup, allSgroups);

  // Also populate advanced exclusion selects (hidden) and build checkbox UIs
  try {
    const exCatEl = document.getElementById("ex-cat");
    const exSubcatEl = document.getElementById("ex-subcat");
    const exPgroupEl = document.getElementById("ex-pgroup");
    const exSgroupEl = document.getElementById("ex-sgroup");
    if (exCatEl && cats) {
      fillSelect(exCatEl, cats, "id", "category_name");
      buildMultiFromSelect(
        "ex-cat",
        "ex-cat-list",
        "Select categories to exclude"
      );
    }
    if (exSubcatEl && allSubcats) {
      fillSelect(exSubcatEl, allSubcats, "id", "subcategory_name");
      buildMultiFromSelect(
        "ex-subcat",
        "ex-subcat-list",
        "Select sub-categories to exclude"
      );
    }
    if (exPgroupEl && allPgroups) {
      fillSelect(exPgroupEl, allPgroups, "id", "group_name");
      buildMultiFromSelect(
        "ex-pgroup",
        "ex-pgroup-list",
        "Select groups to exclude"
      );
    }
    if (exSgroupEl && allSgroups) {
      fillSelect(exSgroupEl, allSgroups, "id", "sub_group_name");
      buildMultiFromSelect(
        "ex-sgroup",
        "ex-sgroup-list",
        "Select sub-groups to exclude"
      );
    }
  } catch {
    void 0;
  }

  // Close any open multi-lists when clicking outside (one-time wire)
  try {
    if (!window.__mcWired) {
      document.addEventListener("click", (ev) => {
        // if click is inside an open multi-list or on its button, do nothing
        if (
          ev.target.closest &&
          (ev.target.closest(".multi-list") || ev.target.closest(".multi-btn"))
        )
          return;
        document
          .querySelectorAll(".multi-list")
          .forEach((l) => (l.hidden = true));
      });
      // allow Escape to close open multi-lists
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape")
          document
            .querySelectorAll(".multi-list")
            .forEach((l) => (l.hidden = true));
      });
      window.__mcWired = true;
    }
  } catch {
    void 0;
  }

  // 2) Category → Sub-categories (filter client-side; keep controls enabled)
  drawerCat.addEventListener("change", () => {
    const catId = drawerCat.value || "";
    state.category_id = catId;
    state.sub_category_id = "";
    state.product_group_id = "";
    state.sub_group_id = "";

    const filtered = catId
      ? allSubcats.filter((s) => String(s.category_id) === String(catId))
      : allSubcats;
    // Rebuild name -> ids map within this filtered set and populate unique names
    buildSubcatNameMap(filtered);
    fillSubcatSelectUnique(drawerSubcat, filtered);

    // Narrow Product Groups to those under the filtered sub-categories
    const filteredSubcatIds = (filtered || []).map((s) => String(s.id));
    const pgFiltered = filteredSubcatIds.length
      ? allPgroups.filter((p) =>
          filteredSubcatIds.includes(String(p.sub_category_id))
        )
      : allPgroups;
    buildPgroupNameMap(pgFiltered);
    fillPgroupSelectUnique(drawerPgroup, pgFiltered);

    // Narrow Sub-groups to those under the filtered product-groups
    const pgFilteredIds = (pgFiltered || []).map((p) => String(p.id));
    const sgFiltered = pgFilteredIds.length
      ? allSgroups.filter((s) =>
          pgFilteredIds.includes(String(s.product_group_id))
        )
      : allSgroups;
    buildSgroupNameMap(sgFiltered);
    fillSgroupSelectUnique(drawerSgroup, sgFiltered);

    page = 1;
    if (Object.keys(window.__origFilterPlacement || {}).length === 0) {
      runQuery();
      updateFiltersButtonState();
    }
  });

  // 3) Sub-category → Product groups
  drawerSubcat.addEventListener("change", () => {
    const selName = drawerSubcat.value || "";
    // Map selected sub-category NAME to underlying ids (could be multiple)
    let subcatIdsForSel = [];
    if (selName)
      subcatIdsForSel = subcatNameToIds[selName]
        ? subcatNameToIds[selName].slice()
        : [];

    // State: if single id, keep as scalar; if multiple, store array; if none, clear
    state.sub_category_id =
      subcatIdsForSel.length === 1
        ? subcatIdsForSel[0]
        : subcatIdsForSel.length
        ? subcatIdsForSel
        : "";
    state.product_group_id = "";
    state.sub_group_id = "";

    const filtered = subcatIdsForSel.length
      ? allPgroups.filter((p) =>
          subcatIdsForSel.includes(String(p.sub_category_id))
        )
      : allPgroups;
    // populate product-group select with unique names from filtered list
    buildPgroupNameMap(filtered);
    fillPgroupSelectUnique(drawerPgroup, filtered);

    // Reset sub-groups to full list (unique names)
    buildSgroupNameMap(allSgroups);
    fillSgroupSelectUnique(drawerSgroup, allSgroups);

    page = 1;
    if (Object.keys(window.__origFilterPlacement || {}).length === 0) {
      runQuery();
      updateFiltersButtonState();
    }
  });

  // 4) Product group → Sub-groups
  drawerPgroup.addEventListener("change", () => {
    const selName = drawerPgroup.value || "";
    let pgroupIdsForSel = [];
    if (selName)
      pgroupIdsForSel = pgroupNameToIds[selName]
        ? pgroupNameToIds[selName].slice()
        : [];

    state.product_group_id =
      pgroupIdsForSel.length === 1
        ? pgroupIdsForSel[0]
        : pgroupIdsForSel.length
        ? pgroupIdsForSel
        : "";
    state.sub_group_id = "";

    const filtered = pgroupIdsForSel.length
      ? allSgroups.filter((s) =>
          pgroupIdsForSel.includes(String(s.product_group_id))
        )
      : allSgroups;
    buildSgroupNameMap(filtered);
    fillSgroupSelectUnique(drawerSgroup, filtered);

    // Do not auto-select parent fields here. Upper-level selections should
    // narrow lower-level selects; selecting a lower-level field shouldn't
    // change upper fields. This keeps fields independent and ERP-like.

    page = 1;
    if (Object.keys(window.__origFilterPlacement || {}).length === 0)
      runQuery();
  });

  // 5) Sub-group change just sets the state and filters
  drawerSgroup.addEventListener("change", () => {
    const selName = drawerSgroup.value || "";
    let sgroupIdsForSel = [];
    if (selName)
      sgroupIdsForSel = sgroupNameToIds[selName]
        ? sgroupNameToIds[selName].slice()
        : [];
    state.sub_group_id =
      sgroupIdsForSel.length === 1
        ? sgroupIdsForSel[0]
        : sgroupIdsForSel.length
        ? sgroupIdsForSel
        : "";
    page = 1;
    if (Object.keys(window.__origFilterPlacement || {}).length === 0) {
      runQuery();
      updateFiltersButtonState();
    }
  });
}

async function populateAdvancedExclusions() {
  if (__advExInitDone) return;
  __advExInitDone = true;

  const getSel = (el) =>
    Array.from(el?.selectedOptions || []).map((o) => o.value);

  const dedupeById = (rows) => {
    const seen = new Set();
    const out = [];
    for (const r of rows || []) {
      const id = String(r.id);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(r);
      }
    }
    return out;
  };

  const disable = (els, on = true) => {
    (Array.isArray(els) ? els : [els]).forEach((el) => {
      if (el) el.disabled = !!on;
    });
  };

  const fillMulti = (select, rows, valueKey, labelKey) => {
    if (!select) return;
    const prev = new Set(
      Array.from(select.selectedOptions).map((o) => o.value)
    );
    select.innerHTML = "";
    dedupeById(rows).forEach((row) => {
      const val = String(row[valueKey]);
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = row[labelKey];
      if (prev.has(val)) opt.selected = true;
      select.appendChild(opt);
    });
  };

  const loadCats = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, category_name")
      .order("category_name");
    if (error) throw error;
    return data;
  };

  const loadSubcats = async (catIds) => {
    let q = supabase
      .from("sub_categories")
      .select("id, subcategory_name, category_id")
      .order("subcategory_name");
    if (catIds?.length) q = q.in("category_id", catIds);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  };

  const loadPgroups = async (subcatIds) => {
    let q = supabase
      .from("product_groups")
      .select("id, group_name, sub_category_id")
      .order("group_name");
    if (subcatIds?.length) q = q.in("sub_category_id", subcatIds);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  };

  const loadSgroups = async (pgroupIds) => {
    let q = supabase
      .from("sub_groups")
      .select("id, sub_group_name, product_group_id")
      .order("sub_group_name");
    if (pgroupIds?.length) q = q.in("product_group_id", pgroupIds);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  };

  disable([exCat, exSubcat, exPgroup, exSgroup], true);
  try {
    const [cats, subs, grps, sgrp] = await Promise.all([
      loadCats(),
      loadSubcats([]),
      loadPgroups([]),
      loadSgroups([]),
    ]);
    fillMulti(exCat, cats, "id", "category_name");
    fillMulti(exSubcat, subs, "id", "subcategory_name");
    fillMulti(exPgroup, grps, "id", "group_name");
    fillMulti(exSgroup, sgrp, "id", "sub_group_name");
  } finally {
    disable([exCat, exSubcat, exPgroup, exSgroup], false);
  }

  exCat.onchange = async () => {
    disable([exSubcat, exPgroup, exSgroup], true);
    const subs = await loadSubcats(getSel(exCat));
    fillMulti(exSubcat, subs, "id", "subcategory_name");
    const pg = await loadPgroups(getSel(exSubcat));
    fillMulti(exPgroup, pg, "id", "group_name");
    const sg = await loadSgroups(getSel(exPgroup));
    fillMulti(exSgroup, sg, "id", "sub_group_name");
    disable([exSubcat, exPgroup, exSgroup], false);
  };

  exSubcat.onchange = async () => {
    disable([exPgroup, exSgroup], true);
    const pg = await loadPgroups(getSel(exSubcat));
    fillMulti(exPgroup, pg, "id", "group_name");
    const sg = await loadSgroups(getSel(exPgroup));
    fillMulti(exSgroup, sg, "id", "sub_group_name");
    disable([exPgroup, exSgroup], false);
  };

  exPgroup.onchange = async () => {
    disable(exSgroup, true);
    const sg = await loadSgroups(getSel(exPgroup));
    fillMulti(exSgroup, sg, "id", "sub_group_name");
    disable(exSgroup, false);
  };
}

/* ───────────────────── Advanced drawer ───────────────────── */
function wireAdvanced() {
  const wireBetween = (opSel, v2) => {
    if (!opSel || !v2) return;
    const toggle = () => {
      const isBetween = String(opSel.value || "").toLowerCase() === "between";
      try {
        v2.style.display = isBetween ? "" : "none";
      } catch {
        void 0;
      }
      try {
        // find the corresponding v1 within same .mos-row
        const row =
          opSel.closest && opSel.closest(".mos-row")
            ? opSel.closest(".mos-row")
            : opSel.parentElement;
        const v1 = row
          ? row.querySelector('input[type="number"][id$="-v1"]')
          : null;
        if (v1) v1.placeholder = isBetween ? "Min" : "Value";
        if (v2) {
          v2.placeholder = isBetween ? "Max" : "";
          if (!isBetween) v2.value = "";
        }
      } catch {
        void 0;
      }
    };
    opSel.addEventListener("change", toggle);
    // ensure initial state
    setTimeout(toggle, 0);
  };

  wireBetween(mosIkOp, mosIkV2);
  wireBetween(mosKkdOp, mosKkdV2);
  wireBetween(mosOkOp, mosOkV2);
  wireBetween(mosOvOp, mosOvV2);

  // Wire MOS inputs so changes update the advanced count and filters button state
  function bindMosEvents(opEl, v1El, v2El, nnEl) {
    if (!opEl && !v1El) return;
    const notify = debounce(() => {
      try {
        readAdvancedState();
        const n = countAdvancedActive();
        if (advCount) {
          if (n > 0) {
            advCount.style.display = "";
            advCount.textContent = `Advanced • ${n}`;
          } else {
            advCount.style.display = "none";
          }
        }
        if (Object.keys(window.__origFilterPlacement || {}).length === 0)
          updateFiltersButtonState();
      } catch {
        void 0;
      }
    }, 160);

    [opEl, v1El, v2El, nnEl].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", notify);
      el.addEventListener("change", notify);
    });
    // initialize state from current inputs
    notify();
  }

  bindMosEvents(mosIkOp, mosIkV1, mosIkV2, mosIkNN);
  bindMosEvents(mosKkdOp, mosKkdV1, mosKkdV2, mosKkdNN);
  bindMosEvents(mosOkOp, mosOkV1, mosOkV2, mosOkNN);
  bindMosEvents(mosOvOp, mosOvV1, mosOvV2, mosOvNN);

  if (advApply) {
    advApply.addEventListener("click", () => {
      readAdvancedState();
      const n = countAdvancedActive();
      if (advCount) {
        if (n > 0) {
          advCount.style.display = "";
          advCount.textContent = `Advanced • ${n}`;
        } else {
          advCount.style.display = "none";
        }
      }
      page = 1;
      runQuery();
    });
  }

  // advClear button removed from HTML; advanced reset handled by modal-level Reset/Apply
}

function readAdvancedState() {
  state.ex.cats = Array.from(exCat?.selectedOptions || []).map((o) => o.value);
  state.ex.subcats = Array.from(exSubcat?.selectedOptions || []).map(
    (o) => o.value
  );
  state.ex.pgroups = Array.from(exPgroup?.selectedOptions || []).map(
    (o) => o.value
  );
  state.ex.sgroups = Array.from(exSgroup?.selectedOptions || []).map(
    (o) => o.value
  );

  const getMosRule = (opEl, v1El, v2El, nnEl) => {
    const op = opEl?.value ?? "gt";
    const v1 = v1El?.value ?? "";
    const v2 = v2El?.value ?? "";
    const en = v1 !== "" || (op === "between" && v2 !== "");
    return { en, op, v1, v2, notNull: !!nnEl?.checked };
  };

  state.mos.ik = getMosRule(mosIkOp, mosIkV1, mosIkV2, mosIkNN);
  state.mos.kkd = getMosRule(mosKkdOp, mosKkdV1, mosKkdV2, mosKkdNN);
  state.mos.ok = getMosRule(mosOkOp, mosOkV1, mosOkV2, mosOkNN);
  state.mos.ov = getMosRule(mosOvOp, mosOvV1, mosOvV2, mosOvNN);
}

function countAdvancedActive() {
  let c = 0;
  c += state.ex.cats.length ? 1 : 0;
  c += state.ex.subcats.length ? 1 : 0;
  c += state.ex.pgroups.length ? 1 : 0;
  c += state.ex.sgroups.length ? 1 : 0;
  ["ik", "kkd", "ok", "ov"].forEach((k) => {
    if (state.mos[k].en) c++;
  });
  return c;
}

async function updateStockSnapshotLabel() {
  if (!elUpdated) return;

  try {
    const { data, error } = await supabase
      .from("sku_stock_snapshot")
      .select("as_of_date")
      .order("as_of_date", { ascending: false })
      .limit(1);

    if (error || !data || !data.length) {
      // No snapshot data available
      const labelEl = elUpdated.querySelector(".sc-snapshot-label");
      if (labelEl) labelEl.textContent = "No snapshot data";
      elUpdated.className =
        elUpdated.className.replace(/snapshot-\w+/g, "") + " snapshot-stale";

      // Update status detail
      const statusDetail = document.getElementById("sc-status-detail");
      if (statusDetail) {
        statusDetail.textContent = "No stock snapshot data available";
      }
      return;
    }

    const asOfDate = data[0].as_of_date;
    const snapshotDate = new Date(asOfDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    snapshotDate.setHours(0, 0, 0, 0);

    const diffMs = today - snapshotDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const labelEl = elUpdated.querySelector(".sc-snapshot-label");
    const statusDetail = document.getElementById("sc-status-detail");

    let statusClass = "snapshot-fresh";
    let statusText = "";
    let detailText = "";

    if (diffDays === 0) {
      statusText = "Today";
      detailText = `Stock snapshot: ${snapshotDate.toLocaleDateString()} (today)`;
      statusClass = "snapshot-fresh";
    } else if (diffDays === 1) {
      statusText = "Yesterday";
      detailText = `Stock snapshot: ${snapshotDate.toLocaleDateString()} (1 day ago)`;
      statusClass = "snapshot-warning";
    } else if (diffDays > 1 && diffDays <= 7) {
      statusText = `${diffDays}d ago`;
      detailText = `Stock snapshot: ${snapshotDate.toLocaleDateString()} (${diffDays} days ago)`;
      statusClass = "snapshot-warning";
    } else {
      statusText = `${diffDays}d ago`;
      detailText = `Stock snapshot: ${snapshotDate.toLocaleDateString()} (${diffDays} days ago) - Data may be outdated`;
      statusClass = "snapshot-stale";
    }

    if (labelEl) labelEl.textContent = statusText;
    if (statusDetail) statusDetail.textContent = detailText;

    // Update CSS classes for styling
    elUpdated.className =
      elUpdated.className.replace(/snapshot-\w+/g, "") + " " + statusClass;
    elUpdated.setAttribute("aria-label", detailText);
  } catch (err) {
    console.error("Failed to update stock snapshot label:", err);
    const labelEl = elUpdated.querySelector(".sc-snapshot-label");
    if (labelEl) labelEl.textContent = "Error";
  }
}
async function autoFillUOM() {
  // Clear UOM display unless we have both product and pack size to lookup
  state.uom = "";
  if (!selectedProductId || !state.pack_size) {
    if (elUOM) elUOM.textContent = "";
    return;
  }

  // Show placeholder while resolving
  if (elUOM) elUOM.textContent = "—";

  const { data, error } = await supabase
    .from("v_stock_checker")
    .select("uom")
    .eq("product_id", selectedProductId)
    .eq("pack_size", state.pack_size)
    .limit(1);

  if (!error && data && data.length) {
    const uom = data[0].uom || "";
    if (elUOM) elUOM.textContent = uom || "—";
    state.uom = uom;
  }
}

/* ───────────────────── Sorting helpers (client-side) ───────────────────── */
function computeDerivedFields(rows) {
  if (!Array.isArray(rows)) return;
  for (const r of rows) {
    // numeric-safe helpers
    const stIK = Number(r.stock_ik) || 0;
    const stKKD = Number(r.stock_kkd) || 0;
    const stOK = Number(r.stock_ok) || 0;
    r.stock_overall = stIK + stKKD + stOK;

    const fIK = Number(r.forecast_ik) || 0;
    const fKKD = Number(r.forecast_kkd) || 0;
    const fOK = Number(r.forecast_ok) || 0;
    r.demand_overall = fIK + fKKD + fOK;

    const mosIK =
      r.mos_ik == null || r.mos_ik === "" ? Infinity : Number(r.mos_ik);
    const mosKKD =
      r.mos_kkd == null || r.mos_kkd === "" ? Infinity : Number(r.mos_kkd);
    const mosOK =
      r.mos_ok == null || r.mos_ok === "" ? Infinity : Number(r.mos_ok);
    const mosOV =
      r.mos_overall == null || r.mos_overall === ""
        ? Infinity
        : Number(r.mos_overall);
    r.minMOS = Math.min(mosIK, mosKKD, mosOK, mosOV);

    // shortage: use reorder_level if present, else 0
    const reorder = Number(r.reorder_level || r.reorder || 0) || 0;
    r.shortage = Math.max(0, reorder - (r.stock_overall || 0));

    // quick flag (RASO) - use sub_group_name membership if available
    try {
      r.isRaso =
        (r.sub_group_name && RASO_NAMES.includes(String(r.sub_group_name))) ||
        !!r.is_raso ||
        false;
    } catch {
      r.isRaso = false;
    }

    // demand ratio (guard)
    r.demandRatio =
      r.demand_overall && r.stock_overall
        ? r.demand_overall / Math.max(1, r.stock_overall)
        : 0;

    // riskScore: composite (higher = more urgent)
    // weights: mos 0.45, shortage 0.30, demand 0.20, flag 0.05
    const mosRisk = isFinite(r.minMOS)
      ? (100 - clamp(r.minMOS, 0, 100)) / 100
      : 1; // 0..1
    const shortRisk = r.shortage
      ? Math.min(1, r.shortage / (r.shortage + 10))
      : 0; // 0..1
    const demandRisk = Math.min(1, r.demandRatio); // 0..1
    const flagRisk = r.isRaso ? 1 : 0;
    r.riskScore =
      mosRisk * 0.45 + shortRisk * 0.3 + demandRisk * 0.2 + flagRisk * 0.05;
    // keep numeric-friendly copies
    r._risk = Number(r.riskScore || 0);
  }
}

function numericCmp(a, b, opts = { nullsLast: true }) {
  const A =
    a == null || a === "" ? (opts.nullsLast ? Infinity : -Infinity) : Number(a);
  const B =
    b == null || b === "" ? (opts.nullsLast ? Infinity : -Infinity) : Number(b);
  if (A < B) return -1;
  if (A > B) return 1;
  return 0;
}

function textCmp(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    sensitivity: "base",
  });
}

function compareRows(a, b, sortKeys) {
  if (!Array.isArray(sortKeys) || !sortKeys.length) return 0;
  for (const k of sortKeys) {
    const dir = k.dir === "desc" ? -1 : 1;
    let res = 0;
    switch (k.col) {
      case "risk":
        res = numericCmp(a._risk, b._risk, { nullsLast: false });
        res = -res; // higher risk first by default
        break;
      case "minMOS":
        res = numericCmp(a.minMOS, b.minMOS);
        break;
      case "shortage":
        // shortages first
        res = (b.shortage > 0 ? 1 : 0) - (a.shortage > 0 ? 1 : 0);
        break;
      case "stock_overall":
      case "stock_ik":
      case "stock_kkd":
      case "stock_ok":
      case "demand_overall":
      case "mos_overall":
        res = numericCmp(a[k.col], b[k.col]);
        break;
      case "product_group_name":
      case "sub_group_name":
      case "category_name":
      case "item":
      case "pack_size":
      case "uom":
        res = textCmp(a[k.col], b[k.col]);
        break;
      default:
        // fallback: try numeric then text
        if (!isNaN(Number(a[k.col])) || !isNaN(Number(b[k.col])))
          res = numericCmp(a[k.col], b[k.col]);
        else res = textCmp(a[k.col], b[k.col]);
    }
    if (res !== 0) return dir * res;
  }
  // stable tiebreaker
  return textCmp(a.product_id || a.id || "", b.product_id || b.id || "");
}

function attachHeaderSorting() {
  if (!elTable) return;
  const ths = Array.from(elTable.querySelectorAll("thead th"));
  // Map header ordering to column keys (keeps in sync with HTML order)
  const keys = [
    "item",
    "pack_size",
    "uom",
    "stock_ik",
    "stock_kkd",
    "stock_ok",
    "stock_overall",
    "demand_ik",
    "demand_kkd",
    "demand_ok",
    "demand_overall",
    "mos_ik",
    "mos_kkd",
    "mos_ok",
    "mos_overall",
  ];

  ths.forEach((th, idx) => {
    const col = keys[idx] || `col_${idx}`;
    th.dataset.col = col;
    th.setAttribute("role", "button");
    th.tabIndex = 0;
    // ensure a visible caret indicator inside the header for tri-state
    let ind = th.querySelector(".sc-sort-indicator");
    if (!ind) {
      ind = document.createElement("span");
      ind.className = "sc-sort-indicator";
      ind.setAttribute("aria-hidden", "true");
      th.appendChild(ind);
    }
    // visual styling is provided by shared CSS (`css/shared-ui.css`)
    const caretSvg = (dir) => {
      // dir: 'asc' | 'desc'
      if (!dir) return "";
      if (dir === "asc") {
        return `<svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
      }
      return `<svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
    };

    const updateVisual = () => {
      // clear previous indicators
      th.classList.remove("sort-asc", "sort-desc");
      const top =
        sortState.keys && sortState.keys[0] ? sortState.keys[0] : null;
      if (top && top.col === col) {
        th.classList.add(top.dir === "desc" ? "sort-desc" : "sort-asc");
        ind.innerHTML = caretSvg(top.dir === "desc" ? "desc" : "asc");
        th.setAttribute(
          "aria-sort",
          top.dir === "desc" ? "descending" : "ascending"
        );
      } else {
        ind.innerHTML = "";
        th.setAttribute("aria-sort", "none");
      }
    };

    const cycle = (ev) => {
      ev.preventDefault();
      const multi = ev.shiftKey;
      const existingIndex = (sortState.keys || []).findIndex(
        (k) => k.col === col
      );
      if (!multi) {
        // single-click: make this the only key, cycle asc->desc->none
        if (existingIndex === -1) {
          sortState.keys = [{ col, dir: "asc" }];
          sortState.userOverride = true;
        } else if (sortState.keys[existingIndex].dir === "asc") {
          sortState.keys = [{ col, dir: "desc" }];
          sortState.userOverride = true;
        } else {
          // remove -> revert to server-side default ordering
          sortState.keys = [];
          sortState.userOverride = false;
        }
      } else {
        // shift-click: toggle this column in multi-sort
        if (existingIndex === -1) {
          sortState.keys.push({ col, dir: "asc" });
          sortState.userOverride = true;
        } else {
          const cur = sortState.keys[existingIndex];
          if (cur.dir === "asc") cur.dir = "desc";
          else sortState.keys.splice(existingIndex, 1);
        }
      }
      // apply to last rows and re-render — do not mutate the cached __lastRows
      try {
        if (__lastRows && __lastRows.length) {
          const rowsToRender =
            sortState.keys && sortState.keys.length
              ? __lastRows
                  .slice()
                  .sort((a, b) => compareRows(a, b, sortState.keys))
              : __lastRows.slice();
          renderRows(rowsToRender);
        }
      } catch (e) {
        console.error("Header sort apply failed", e);
      }

      // update all headers visuals (also update SVG indicator)
      ths.forEach((t) => t.classList.remove("sort-asc", "sort-desc"));
      ths.forEach((t) => {
        const c = t.dataset.col;
        const top =
          sortState.keys && sortState.keys[0] ? sortState.keys[0] : null;
        if (top && top.col === c)
          t.classList.add(top.dir === "desc" ? "sort-desc" : "sort-asc");
        t.setAttribute(
          "aria-sort",
          top && top.col === c
            ? top.dir === "desc"
              ? "descending"
              : "ascending"
            : "none"
        );
        const indEl = t.querySelector(".sc-sort-indicator");
        if (indEl) {
          if (top && top.col === c) {
            indEl.innerHTML = caretSvg(top.dir === "desc" ? "desc" : "asc");
          } else {
            indEl.innerHTML = "";
          }
        }
      });
    };

    th.addEventListener("click", cycle);
    th.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") cycle(ev);
    });
    updateVisual();
  });
}

/* ───────────────────── Query ───────────────────── */
async function runQuery() {
  try {
    setMsg("");
    if (elBody)
      elBody.innerHTML = `<tr><td colspan="${visibleCols()}">Loading…</td></tr>`;

    const filters = buildStockCheckerFiltersPayload();

    const { data, error } = await supabase.rpc("stock_checker_query", {
      p_filters: filters,
      p_page: page,
      p_page_size: PAGE_SIZE,
    });

    if (error) throw error;

    const rows = (data && data.rows) || [];
    const total = (data && (data.count ?? data.total ?? 0)) || 0;
    const totals = (data && data.totals) || null;
    const snapshot_date =
      data && data.snapshot_date ? data.snapshot_date : null;

    // cache rows/totals for UI actions
    __lastRows = Array.isArray(rows) ? rows.slice() : [];
    __lastTotals = totals;

    // compute derived fields and apply client-side sort only when user has
    // explicitly changed the sort (clicking headers). Default order comes
    // from the RPC result.
    try {
      computeDerivedFields(__lastRows);
      if (
        sortState &&
        sortState.userOverride &&
        Array.isArray(sortState.keys) &&
        sortState.keys.length
      )
        __lastRows.sort((a, b) => compareRows(a, b, sortState.keys));
    } catch (e) {
      console.error("Sorting error", e);
    }

    renderRows(__lastRows);

    if (elTable && elTable.parentElement) {
      elTable.parentElement.scrollTop = 0;
    }

    // total is available in RPC response (kept in __lastTotals)
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = clamp(page, 1, maxPage);
    if (elCount) elCount.textContent = `${fmtInt(total)} rows`;
    if (elPage) elPage.textContent = `Page ${page} / ${maxPage}`;
    if (elPrev) elPrev.disabled = page <= 1;
    if (elNext) elNext.disabled = page >= maxPage;

    // Update total value pill from totals returned by RPC
    try {
      if (elTotalValue) {
        if (
          totals &&
          (totals.value_overall != null || totals.value_overall === 0)
        ) {
          elTotalValue.textContent = `Value: ${fmtINR(totals.value_overall)}`;
        } else {
          elTotalValue.textContent = `Value: —`;
        }
      }
    } catch {
      void 0;
    }

    // Update snapshot label from RPC if present, otherwise fallback
    if (snapshot_date) {
      try {
        const asOf = new Date(snapshot_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        asOf.setHours(0, 0, 0, 0);
        const diffMs = today - asOf;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const labelEl =
          elUpdated && elUpdated.querySelector(".sc-snapshot-label");
        const statusDetail = document.getElementById("sc-status-detail");
        let statusClass = "snapshot-fresh";
        let statusText = "";
        let detailText = "";
        if (diffDays === 0) {
          statusText = "Today";
          detailText = `Stock snapshot: ${asOf.toLocaleDateString()} (today)`;
          statusClass = "snapshot-fresh";
        } else if (diffDays === 1) {
          statusText = "Yesterday";
          detailText = `Stock snapshot: ${asOf.toLocaleDateString()} (1 day ago)`;
          statusClass = "snapshot-warning";
        } else if (diffDays > 1 && diffDays <= 7) {
          statusText = `${diffDays}d ago`;
          detailText = `Stock snapshot: ${asOf.toLocaleDateString()} (${diffDays} days ago)`;
          statusClass = "snapshot-warning";
        } else {
          statusText = `${diffDays}d ago`;
          detailText = `Stock snapshot: ${asOf.toLocaleDateString()} (${diffDays} days ago) - Data may be outdated`;
          statusClass = "snapshot-stale";
        }
        if (labelEl) labelEl.textContent = statusText;
        if (statusDetail) statusDetail.textContent = detailText;
        if (elUpdated) {
          elUpdated.className =
            elUpdated.className.replace(/snapshot-\w+/g, "") +
            " " +
            statusClass;
          elUpdated.setAttribute("aria-label", detailText);
        }
      } catch (err) {
        console.error("Failed to update snapshot from RPC", err);
      }
    } else {
      try {
        // fallback to existing DB-based label updater
        updateStockSnapshotLabel();
      } catch {
        void 0;
      }
    }

    if (!rows || rows.length === 0) {
      elBody.innerHTML = `<tr><td colspan="${visibleCols()}">No rows found for the selected filters.</td></tr>`;
    }

    try {
      updateFiltersButtonState();
    } catch {
      void 0;
    }
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
    if (elBody)
      elBody.innerHTML = `<tr><td colspan="${visibleCols()}">Error loading data.</td></tr>`;
    try {
      updateFiltersButtonState();
    } catch {
      void 0;
    }
  }
}

/* ───────────────────── Render ───────────────────── */
function renderRows(rows) {
  if (!elBody) return;
  elBody.innerHTML = rows
    .map((r, i) => {
      // compute row-wise overall aggregates (safely treat null/undefined as 0)
      const stIK = Number(r.stock_ik) || 0;
      const stKKD = Number(r.stock_kkd) || 0;
      const stOK = Number(r.stock_ok) || 0;
      const stockOverall = stIK + stKKD + stOK;

      const fIK = Number(r.forecast_ik) || 0;
      const fKKD = Number(r.forecast_kkd) || 0;
      const fOK = Number(r.forecast_ok) || 0;
      const forecastOverall = fIK + fKKD + fOK;

      return `
    <tr data-row-idx="${i}">
      <td class="col-item" style="text-align:left">${escapeHtml(
        r.item || ""
      )}</td>
      <td class="col-meta" style="text-align:center">${escapeHtml(
        String(r.pack_size ?? "")
      )}</td>
      <td class="col-meta" style="text-align:center">${escapeHtml(
        r.uom || ""
      )}</td>
      <td class="col-stock" style="text-align:center">${fmtInt(r.stock_ik)}</td>
      <td class="col-stock" style="text-align:center">${fmtInt(
        r.stock_kkd
      )}</td>
      <td class="col-stock" style="text-align:center">${fmtInt(r.stock_ok)}</td>
      <td class="col-overall" style="text-align:center">${fmtInt(
        stockOverall
      )}</td>
      ${
        state.showValue
          ? `
      <td class="col-value" style="text-align:center">${fmtINR(
        r.stock_value_ik
      )}</td>
      <td class="col-value" style="text-align:center">${fmtINR(
        r.stock_value_kkd
      )}</td>
      <td class="col-value" style="text-align:center">${fmtINR(
        r.stock_value_ok
      )}</td>
      <td class="col-value" style="text-align:center">${fmtINR(
        r.stock_value_overall
      )}</td>
      `
          : ""
      }
      <td class="col-demand" style="text-align:center">${fmtInt(
        r.forecast_ik
      )}</td>
      <td class="col-demand" style="text-align:center">${fmtInt(
        r.forecast_kkd
      )}</td>
      <td class="col-demand" style="text-align:center">${fmtInt(
        r.forecast_ok
      )}</td>
      <td class="col-overall" style="text-align:center">${fmtInt(
        forecastOverall
      )}</td>
      <td class="col-mos" style="text-align:center">${fmt3(r.mos_ik)}</td>
      <td class="col-mos" style="text-align:center">${fmt3(r.mos_kkd)}</td>
      <td class="col-mos" style="text-align:center">${fmt3(r.mos_ok)}</td>
      <td class="col-overall" style="text-align:center">${fmt3(
        r.mos_overall
      )}</td>
    </tr>`;
    })
    .join("");

  // iOS-friendly row selection
  Array.from(elBody.querySelectorAll("tr")).forEach((tr) => {
    function selectRowHandler(e) {
      // ignore selection if the user is currently dragging/scrolling
      try {
        if (window.__sc_isDragging || __sc_isDragging) {
          // reset flag and do not open modal
          __sc_isDragging = false;
          return;
        }
      } catch {
        /* ignore */
      }
      Array.from(elBody.querySelectorAll("tr.selected-row")).forEach((row) =>
        row.classList.remove("selected-row")
      );
      let targetTr = tr;
      if (e && e.target && e.target.tagName === "TD") {
        targetTr = e.target.parentElement;
      }
      targetTr.classList.add("selected-row");
      // open row details modal (guard touch double events)
      try {
        const idx = Number(targetTr.getAttribute("data-row-idx"));
        const r =
          Array.isArray(__lastRows) && __lastRows[idx] ? __lastRows[idx] : null;
        const now = Date.now();
        if (r && now - (__lastOpenTs || 0) > 250) {
          __lastOpenTs = now;
          openRowModal(r);
        }
      } catch {
        /* ignore */
      }
    }
    tr.addEventListener("click", selectRowHandler, { passive: true });
    tr.addEventListener("touchstart", selectRowHandler, { passive: true });
    tr.addEventListener("touchend", selectRowHandler, { passive: true });
    // track pointer movement to detect drag/scroll gestures
    tr.addEventListener(
      "touchmove",
      function () {
        __sc_isDragging = true;
      },
      { passive: true }
    );
    tr.addEventListener(
      "mousemove",
      function () {
        __sc_isDragging = true;
      },
      { passive: true }
    );
    // reset drag flag shortly after end to allow subsequent clicks
    tr.addEventListener(
      "mouseup",
      function () {
        setTimeout(() => (__sc_isDragging = false), 50);
      },
      { passive: true }
    );
    tr.addEventListener(
      "touchend",
      function () {
        setTimeout(() => (__sc_isDragging = false), 50);
      },
      { passive: true }
    );
    Array.from(tr.children).forEach((td) => {
      if (td.tagName === "TD") {
        td.addEventListener("touchstart", selectRowHandler, { passive: true });
        td.addEventListener("touchend", selectRowHandler, { passive: true });
      }
    });
  });
}

/* ───────────────────── Export CSV ───────────────────── */
async function exportCSV() {
  try {
    setMsg("");
    // Use RPC to fetch pages so export matches the table exactly
    const filters = buildStockCheckerFiltersPayload();
    const PAGE = 500; // RPC page size
    const CAP = 20000;
    let out = [];
    let p = 1;
    while (out.length < CAP) {
      const { data, error } = await supabase.rpc("stock_checker_query", {
        p_filters: filters,
        p_page: p,
        p_page_size: PAGE,
      });
      if (error) throw error;
      const rows = (data && data.rows) || [];
      if (!rows || !rows.length) break;
      out = out.concat(rows);
      if (rows.length < PAGE) break;
      p++;
    }

    const rows = out;
    if (!rows.length) {
      setMsg("No rows to export.");
      return;
    }

    const headers = [
      "Category",
      "Sub-category",
      "Group",
      "Sub-group",
      "Item",
      "Pack Size",
      "UOM",
      "Stock IK",
      "Stock KKD",
      "Stock OK",
      "Stock (overall)",
      "Demand IK",
      "Demand KKD",
      "Demand OK",
      "Demand (overall)",
      "MOS IK",
      "MOS KKD",
      "MOS OK",
      "MOS overall",
      "Product ID",
      "SKU ID",
      "Value IK",
      "Value KKD",
      "Value OK",
      "Value Overall",
      "Rate IK",
      "Rate KKD",
      "Rate OK",
      "Rate Overall",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.category_name,
          r.sub_category_name,
          r.product_group_name,
          r.sub_group_name,
          r.item,
          r.pack_size,
          r.uom,
          r.stock_ik,
          r.stock_kkd,
          r.stock_ok,
          // compute overalls for CSV too (treat null as 0)
          (Number(r.stock_ik) || 0) +
            (Number(r.stock_kkd) || 0) +
            (Number(r.stock_ok) || 0),
          r.forecast_ik,
          r.forecast_kkd,
          r.forecast_ok,
          (Number(r.forecast_ik) || 0) +
            (Number(r.forecast_kkd) || 0) +
            (Number(r.forecast_ok) || 0),
          r.mos_ik,
          r.mos_kkd,
          r.mos_ok,
          r.mos_overall,
          r.product_id,
          r.sku_id,
          r.stock_value_ik,
          r.stock_value_kkd,
          r.stock_value_ok,
          r.stock_value_overall,
          r.rate_ik,
          r.rate_kkd,
          r.rate_ok,
          r.rate_overall,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_checker_export_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  } catch (err) {
    console.error(err);
    setMsg("Export failed: " + (err.message || String(err)));
  }
}

/* ───────────────────── Export Coverage PDF (page break at 'SIDDHA') ───────────────────── */
async function exportCoveragePDF() {
  if (__pdfExporting) return;
  __pdfExporting = true;
  const btn = $("sc-export-pdf");
  if (btn) btn.disabled = true;

  try {
    setMsg("");
    await loadPdfEngine();
    if (!ensurePdfReady()) return;

    // 1) FETCH DATA
    const sel =
      "category_name,product_group_name,sub_group_name," +
      "item,pack_size," +
      "stock_ik,forecast_ik,mos_ik," +
      "stock_kkd,forecast_kkd,mos_kkd," +
      "stock_ok,forecast_ok,mos_ok," +
      "shade_flag";

    const { data: rows, error } = await supabase
      .from("v_stock_checker")
      .select(sel)
      .order("category_name")
      .order("product_group_name")
      .order("sub_group_name")
      .order("item")
      .order("pack_size")
      .limit(20000);

    if (error) throw error;
    const records = (rows || []).filter((r) => r && r.item);

    // 2) CONSTANTS / HELPERS
    const HEAD = [
      "SN",
      "ITEM PACK",
      "STOCK\nIK",
      "DEMAND\nIK",
      "MOS\nIK",
      "STOCK\nKKD",
      "DEMAND\nKKD",
      "MOS\nKKD",
      "STOCK\nOK",
      "DEMAND\nOK",
      "MOS\nOK",
    ];
    const I = (v) => (v == null ? "" : Number(v).toFixed(0));
    const M = (v) => (v == null ? "" : Number(v).toFixed(2));
    const itemPack = (r) =>
      `${(r.item || "").trim()}_${String(r.pack_size ?? "").trim()}`;
    const isSiddha = (cat) =>
      String(cat || "")
        .trim()
        .toUpperCase() === "SIDDHA";

    // Build one unified body creator so both tables look the same.
    function buildBody(recs) {
      const body = [];
      let prevCat = null;
      let prevSub = null;
      let sn = 0;

      for (const r of recs) {
        const cat = r.category_name || "";
        const sub = r.sub_group_name || "";

        // Category header, also resets SN
        if (cat !== prevCat) {
          body.push([{ content: String(cat).toUpperCase(), _h: "cat" }]);
          prevCat = cat;
          prevSub = null;
          sn = 0;
        }

        // Sub-group header
        if (sub !== prevSub) {
          body.push([{ content: sub, _h: "sub" }]);
          prevSub = sub;
        }

        const shade = r.shade_flag === true;
        body.push([
          { content: ++sn, __shade: shade },
          { content: itemPack(r), __shade: shade },
          I(r.stock_ik),
          I(r.forecast_ik),
          M(r.mos_ik),
          I(r.stock_kkd),
          I(r.forecast_kkd),
          M(r.mos_kkd),
          I(r.stock_ok),
          I(r.forecast_ok),
          M(r.mos_ok),
        ]);
      }
      return body;
    }

    // 3) SPLIT at first 'SIDDHA'
    let splitIdx = records.findIndex((r) => isSiddha(r.category_name));
    if (splitIdx < 0) splitIdx = records.length; // no SIDDHA → single table

    const partA = records.slice(0, splitIdx); // before SIDDHA
    const partB = records.slice(splitIdx); // SIDDHA and after

    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    const margin = { l: 36, r: 36, t: 56, b: 48 };
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const TITLE = "STOCK COVERAGE REPORT";
    const ORG = "Santhigiri Ayurveda Siddha Vaidyasala";
    const today = new Date().toLocaleDateString("en-GB");

    const drawHeaderFooter = () => {
      // header
      doc.setFont("helvetica", "bold").setFontSize(10);
      doc.text(TITLE, margin.l, margin.t - 26, { baseline: "bottom" });
      doc.setFont("helvetica", "normal");
      doc.text(today, pageW - margin.r, margin.t - 26, {
        align: "right",
        baseline: "bottom",
      });

      // footer
      const y = pageH - 16;
      doc.text(ORG, margin.l, y, { baseline: "bottom" });
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageW - margin.r,
        y,
        { align: "right", baseline: "bottom" }
      );
    };

    const W_SN = 24;
    const W_PACK = 150;
    const columnStyles = {
      0: { cellWidth: W_SN, halign: "center" },
      1: { cellWidth: W_PACK, halign: "left", overflow: "linebreak" },
    };

    const didParseCell = ({ section, row, cell }) => {
      if (section !== "body" || !row || !cell) return;

      // Expand category/sub headers across all columns
      if (
        Array.isArray(row.raw) &&
        row.raw.length === 1 &&
        row.raw[0] &&
        row.raw[0]._h
      ) {
        cell.colSpan = HEAD.length;
        cell.styles.fontStyle = "bold";
        cell.styles.halign = "left";
        cell.styles.fillColor = [255, 255, 255];
        return;
      }

      // Shading for data rows (marked in first two cells)
      const shaded =
        Array.isArray(row.raw) &&
        ((row.raw[0] && row.raw[0].__shade === true) ||
          (row.raw[1] && row.raw[1].__shade === true));
      if (shaded) cell.styles.fillColor = [235, 235, 235];
    };

    function renderTable(body) {
      runAutoTable(doc, {
        head: [HEAD],
        body,
        margin,
        startY: margin.t + 2,
        tableWidth: "auto",
        theme: "grid",
        styles: {
          fontSize: 8.5,
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          textColor: [0, 0, 0],
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          overflow: "visible",
        },
        headStyles: {
          fontStyle: "bold",
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          overflow: "linebreak",
        },
        bodyStyles: { fillColor: [255, 255, 255] },
        columnStyles,
        showHead: "everyPage",
        rowPageBreak: "avoid",
        didParseCell,
        didDrawPage: drawHeaderFooter,
      });
    }

    // 4) RENDER
    if (partA.length > 0) {
      renderTable(buildBody(partA));
    }

    if (partB.length > 0) {
      if (partA.length > 0) doc.addPage(); // force new page exactly at SIDDHA
      renderTable(buildBody(partB));
    }

    // 5) SAVE
    doc.save(
      `Stock_Coverage_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  } catch (err) {
    console.error(err);
    setMsg("PDF export failed: " + (err.message || String(err)));
  } finally {
    __pdfExporting = false;
    if (btn) btn.disabled = false;
  }
}

// Aggregated region report: IK + KKD combined into IK columns
async function exportCoveragePDFRegion() {
  if (__pdfExporting) return;
  __pdfExporting = true;
  const btn = $("sc-export-region");
  if (btn) btn.disabled = true;

  try {
    setMsg("");
    await loadPdfEngine();
    if (!ensurePdfReady()) return;

    // 1) FETCH DATA (same fields)
    const sel =
      "category_name,product_group_name,sub_group_name," +
      "item,pack_size," +
      "stock_ik,forecast_ik,mos_ik," +
      "stock_kkd,forecast_kkd,mos_kkd," +
      "stock_ok,forecast_ok,mos_ok," +
      "shade_flag";

    const { data: rows, error } = await supabase
      .from("v_stock_checker")
      .select(sel)
      .order("category_name")
      .order("product_group_name")
      .order("sub_group_name")
      .order("item")
      .order("pack_size")
      .limit(20000);

    if (error) throw error;
    const records = (rows || []).filter((r) => r && r.item);

    // 2) BUILD HEAD and helpers (aggregated)
    const HEAD = [
      "SN",
      "ITEM PACK",
      "STOCK\nIK",
      "DEMAND\nIK",
      "MOS\nIK",
      "STOCK\nOK",
      "DEMAND\nOK",
      "MOS\nOK",
    ];
    const I = (v) => (v == null ? "" : Number(v).toFixed(0));
    const M = (v) => (v == null ? "" : Number(v).toFixed(2));
    const itemPack = (r) =>
      `${(r.item || "").trim()}_${String(r.pack_size ?? "").trim()}`;
    const isSiddha = (cat) =>
      String(cat || "")
        .trim()
        .toUpperCase() === "SIDDHA";

    function buildBodyAgg(recs) {
      const body = [];
      let prevCat = null;
      let prevSub = null;
      let sn = 0;

      for (const r of recs) {
        const cat = r.category_name || "";
        const sub = r.sub_group_name || "";

        if (cat !== prevCat) {
          body.push([{ content: String(cat).toUpperCase(), _h: "cat" }]);
          prevCat = cat;
          prevSub = null;
          sn = 0;
        }

        if (sub !== prevSub) {
          body.push([{ content: sub, _h: "sub" }]);
          prevSub = sub;
        }

        const shade = r.shade_flag === true;

        // Aggregate IK + KKD into IK columns
        const stockIK = (Number(r.stock_ik) || 0) + (Number(r.stock_kkd) || 0);
        const forecastIK =
          (Number(r.forecast_ik) || 0) + (Number(r.forecast_kkd) || 0);
        // Compute MOS IK as a ratio of aggregated stock/demand; guard zero/blank demand
        const mosIK = forecastIK > 0 ? stockIK / forecastIK : null;

        body.push([
          { content: ++sn, __shade: shade },
          { content: itemPack(r), __shade: shade },
          I(stockIK),
          I(forecastIK),
          M(mosIK),
          I(r.stock_ok),
          I(r.forecast_ok),
          M(r.mos_ok),
        ]);
      }
      return body;
    }

    // 3) split at SIDDHA (same as original)
    let splitIdx = records.findIndex((r) => isSiddha(r.category_name));
    if (splitIdx < 0) splitIdx = records.length;

    const partA = records.slice(0, splitIdx);
    const partB = records.slice(splitIdx);

    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    const margin = { l: 36, r: 36, t: 56, b: 48 };
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const TITLE = "STOCK COVERAGE REPORT (REGION AGG)";
    const ORG = "Santhigiri Ayurveda Siddha Vaidyasala";
    const today = new Date().toLocaleDateString("en-GB");

    const drawHeaderFooter = () => {
      doc.setFont("helvetica", "bold").setFontSize(10);
      doc.text(TITLE, margin.l, margin.t - 26, { baseline: "bottom" });
      doc.setFont("helvetica", "normal");
      doc.text(today, pageW - margin.r, margin.t - 26, {
        align: "right",
        baseline: "bottom",
      });

      const y = pageH - 16;
      doc.text(ORG, margin.l, y, { baseline: "bottom" });
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageW - margin.r,
        y,
        { align: "right", baseline: "bottom" }
      );
    };

    const W_SN = 24;
    const W_PACK = 150;
    const columnStyles = {
      0: { cellWidth: W_SN, halign: "center" },
      1: { cellWidth: W_PACK, halign: "left", overflow: "linebreak" },
    };

    const didParseCell = ({ section, row, cell }) => {
      if (section !== "body" || !row || !cell) return;
      if (
        Array.isArray(row.raw) &&
        row.raw.length === 1 &&
        row.raw[0] &&
        row.raw[0]._h
      ) {
        cell.colSpan = HEAD.length;
        cell.styles.fontStyle = "bold";
        cell.styles.halign = "left";
        cell.styles.fillColor = [255, 255, 255];
        return;
      }

      const shaded =
        Array.isArray(row.raw) &&
        ((row.raw[0] && row.raw[0].__shade === true) ||
          (row.raw[1] && row.raw[1].__shade === true));
      if (shaded) cell.styles.fillColor = [235, 235, 235];
    };

    function renderTable(body) {
      runAutoTable(doc, {
        head: [HEAD],
        body,
        margin,
        startY: margin.t + 2,
        tableWidth: "auto",
        theme: "grid",
        styles: {
          fontSize: 8.5,
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          textColor: [0, 0, 0],
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          overflow: "visible",
        },
        headStyles: {
          fontStyle: "bold",
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          overflow: "linebreak",
        },
        bodyStyles: { fillColor: [255, 255, 255] },
        columnStyles,
        showHead: "everyPage",
        rowPageBreak: "avoid",
        didParseCell,
        didDrawPage: drawHeaderFooter,
      });
    }

    if (partA.length > 0) {
      renderTable(buildBodyAgg(partA));
    }

    if (partB.length > 0) {
      if (partA.length > 0) doc.addPage();
      renderTable(buildBodyAgg(partB));
    }

    doc.save(
      `Stock_Coverage_Report_Region_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  } catch (err) {
    console.error(err);
    setMsg("PDF export failed: " + (err.message || String(err)));
  } finally {
    __pdfExporting = false;
    if (btn) btn.disabled = false;
  }
}

// HO Depot report: Godown-level without considering KKD depot values
async function exportCoveragePDFHODepot() {
  if (__pdfExporting) return;
  __pdfExporting = true;
  const btn = $("sc-export-ho");
  if (btn) btn.disabled = true;

  try {
    setMsg("");
    await loadPdfEngine();
    if (!ensurePdfReady()) return;

    // 1) FETCH DATA (same fields as others)
    const sel =
      "category_name,product_group_name,sub_group_name," +
      "item,pack_size," +
      "stock_ik,forecast_ik,mos_ik," +
      "stock_kkd,forecast_kkd,mos_kkd," +
      "stock_ok,forecast_ok,mos_ok," +
      "shade_flag";

    const { data: rows, error } = await supabase
      .from("v_stock_checker")
      .select(sel)
      .order("category_name")
      .order("product_group_name")
      .order("sub_group_name")
      .order("item")
      .order("pack_size")
      .limit(20000);

    if (error) throw error;
    const records = (rows || []).filter((r) => r && r.item);

    // 2) HEAD and helpers: omit KKD entirely, compute MOS IK without KKD influence
    const HEAD = [
      "SN",
      "ITEM PACK",
      "STOCK\nIK",
      "DEMAND\nIK",
      "MOS\nIK",
      "STOCK\nOK",
      "DEMAND\nOK",
      "MOS\nOK",
    ];
    const I = (v) => (v == null ? "" : Number(v).toFixed(0));
    const M = (v) => (v == null ? "" : Number(v).toFixed(2));
    const itemPack = (r) =>
      `${(r.item || "").trim()}_${String(r.pack_size ?? "").trim()}`;
    const isSiddha = (cat) =>
      String(cat || "")
        .trim()
        .toUpperCase() === "SIDDHA";

    function buildBodyHO(recs) {
      const body = [];
      let prevCat = null;
      let prevSub = null;
      let sn = 0;

      for (const r of recs) {
        const cat = r.category_name || "";
        const sub = r.sub_group_name || "";

        if (cat !== prevCat) {
          body.push([{ content: String(cat).toUpperCase(), _h: "cat" }]);
          prevCat = cat;
          prevSub = null;
          sn = 0;
        }

        if (sub !== prevSub) {
          body.push([{ content: sub, _h: "sub" }]);
          prevSub = sub;
        }

        const shade = r.shade_flag === true;

        // IK only (no KKD influence)
        const stockIK = Number(r.stock_ik) || 0;
        const forecastIK = Number(r.forecast_ik) || 0;
        const mosIK = forecastIK > 0 ? stockIK / forecastIK : null;

        body.push([
          { content: ++sn, __shade: shade },
          { content: itemPack(r), __shade: shade },
          I(stockIK),
          I(forecastIK),
          M(mosIK),
          I(r.stock_ok),
          I(r.forecast_ok),
          M(r.mos_ok),
        ]);
      }
      return body;
    }

    // 3) split at SIDDHA (same behavior)
    let splitIdx = records.findIndex((r) => isSiddha(r.category_name));
    if (splitIdx < 0) splitIdx = records.length;

    const partA = records.slice(0, splitIdx);
    const partB = records.slice(splitIdx);

    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    const margin = { l: 36, r: 36, t: 56, b: 48 };
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const TITLE = "STOCK COVERAGE REPORT - HO DEPOT";
    const ORG = "Santhigiri Ayurveda Siddha Vaidyasala";
    const today = new Date().toLocaleDateString("en-GB");

    const drawHeaderFooter = () => {
      doc.setFont("helvetica", "bold").setFontSize(10);
      doc.text(TITLE, margin.l, margin.t - 26, { baseline: "bottom" });
      doc.setFont("helvetica", "normal");
      doc.text(today, pageW - margin.r, margin.t - 26, {
        align: "right",
        baseline: "bottom",
      });

      const y = pageH - 16;
      doc.text(ORG, margin.l, y, { baseline: "bottom" });
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageW - margin.r,
        y,
        { align: "right", baseline: "bottom" }
      );
    };

    const W_SN = 24;
    const W_PACK = 150;
    const columnStyles = {
      0: { cellWidth: W_SN, halign: "center" },
      1: { cellWidth: W_PACK, halign: "left", overflow: "linebreak" },
    };

    const didParseCell = ({ section, row, cell }) => {
      if (section !== "body" || !row || !cell) return;

      if (
        Array.isArray(row.raw) &&
        row.raw.length === 1 &&
        row.raw[0] &&
        row.raw[0]._h
      ) {
        cell.colSpan = HEAD.length;
        cell.styles.fontStyle = "bold";
        cell.styles.halign = "left";
        cell.styles.fillColor = [255, 255, 255];
        return;
      }

      const shaded =
        Array.isArray(row.raw) &&
        ((row.raw[0] && row.raw[0].__shade === true) ||
          (row.raw[1] && row.raw[1].__shade === true));
      if (shaded) cell.styles.fillColor = [235, 235, 235];
    };

    function renderTable(body) {
      runAutoTable(doc, {
        head: [HEAD],
        body,
        margin,
        startY: margin.t + 2,
        tableWidth: "auto",
        theme: "grid",
        styles: {
          fontSize: 8.5,
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          textColor: [0, 0, 0],
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          overflow: "visible",
        },
        headStyles: {
          fontStyle: "bold",
          fontSize: 7.5,
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          overflow: "linebreak",
        },
        bodyStyles: { fillColor: [255, 255, 255] },
        columnStyles,
        showHead: "everyPage",
        rowPageBreak: "avoid",
        didParseCell,
        didDrawPage: drawHeaderFooter,
      });
    }

    if (partA.length > 0) {
      renderTable(buildBodyHO(partA));
    }

    if (partB.length > 0) {
      if (partA.length > 0) doc.addPage();
      renderTable(buildBodyHO(partB));
    }

    doc.save(
      `Stock_Coverage_Report_HO_Depot_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  } catch (err) {
    console.error(err);
    setMsg("PDF export failed: " + (err.message || String(err)));
  } finally {
    __pdfExporting = false;
    if (btn) btn.disabled = false;
  }
}

/* ────────────── CLEAR (for PWA HOME) ────────────── */
function clearAll() {
  if (elItemSel) {
    if (typeof elItemSel._clear === "function") elItemSel._clear();
    else elItemSel.value = "";
  }
  selectedProductId = "";

  if (elPackSize) elPackSize.value = "";
  if (elUOM) elUOM.textContent = "";

  if (drawerCat) drawerCat.value = "";
  if (drawerSubcat) drawerSubcat.value = "";
  if (drawerPgroup) drawerPgroup.value = "";
  if (drawerSgroup) drawerSgroup.value = "";

  setChip(elQfMosLt3, false);
  setChip(elQfRaso, false);
  state.quick = { mosLt3: false, raso: false };

  const classifDrawer = $("drawer-classification");
  const advDrawer = $("drawer-advanced");
  if (classifDrawer) {
    if (typeof classifDrawer.open !== "undefined") classifDrawer.open = false;
    classifDrawer.removeAttribute("open");
  }
  if (advDrawer) {
    if (typeof advDrawer.open !== "undefined") advDrawer.open = false;
    advDrawer.removeAttribute("open");
  }

  [exCat, exSubcat, exPgroup, exSgroup].forEach((sel) => {
    if (!sel) return;
    Array.from(sel.options).forEach((o) => (o.selected = false));
  });
  // If multi-checkbox dropdowns exist, uncheck their checkboxes and
  // refresh the trigger button text so the UI reflects cleared selects.
  try {
    document.querySelectorAll(".multi-btn").forEach((btn) => {
      try {
        const tgt = btn.dataset.target;
        if (tgt) {
          const list = document.getElementById(tgt);
          if (list)
            list
              .querySelectorAll('input[type="checkbox"]')
              .forEach((cb) => (cb.checked = false));
          // derive select id by removing -list suffix (ex-cat-list -> ex-cat)
          const selId = tgt.replace(/-list$/, "");
          const sel = document.getElementById(selId);
          if (sel) {
            // ensure underlying select has no selected options (already done above)
          }
        }
        if (typeof btn._updateText === "function") btn._updateText();
      } catch {
        void 0;
      }
    });
  } catch {
    void 0;
  }
  [mosIkEn, mosOkEn, mosOvEn, mosKkdEn].forEach(
    (el) => el && (el.checked = false)
  );
  [mosIkOp, mosOkOp, mosOvOp, mosKkdOp].forEach((el) => {
    if (!el) return;
    try {
      el.value = "gt";
      // Programmatic value change should also notify listeners so placeholders
      // and v2 visibility update via wireBetween()
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      try {
        el.value = "gt";
      } catch {
        void 0;
      }
    }
  });
  [
    mosIkV1,
    mosOkV1,
    mosOvV1,
    mosIkV2,
    mosOkV2,
    mosOvV2,
    mosKkdV1,
    mosKkdV2,
  ].forEach((el) => el && (el.value = ""));
  [mosIkNN, mosOkNN, mosOvNN, mosKkdNN].forEach(
    (el) => el && (el.checked = false)
  );
  if (advCount) advCount.style.display = "none";

  Object.assign(state, {
    pack_size: "",
    uom: "",
    category_id: "",
    sub_category_id: "",
    product_group_id: "",
    sub_group_id: "",
    ex: { cats: [], subcats: [], pgroups: [], sgroups: [] },
    mos: {
      ik: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      kkd: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      ok: { en: false, op: "gt", v1: "", v2: "", notNull: false },
      ov: { en: false, op: "gt", v1: "", v2: "", notNull: false },
    },
    quick: { mosLt3: false, raso: false },
  });

  setChip(elQfMosLt3, false);
  setChip(elQfRaso, false);

  page = 1;
  runQuery();
}
