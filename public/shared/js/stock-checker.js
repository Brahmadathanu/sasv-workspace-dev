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
const VISIBLE_COLS = 15;
let page = 1;

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

    elTable = $("sc-table");
    elBody = $("sc-body");

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

/* ───────────────────── Query ───────────────────── */
async function runQuery() {
  try {
    setMsg("");
    if (elBody)
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">Loading…</td></tr>`;

    let q = supabase.from("v_stock_checker").select("*", { count: "exact" });

    // Primary
    if (selectedProductId) q = q.eq("product_id", selectedProductId);
    if (state.pack_size) q = q.eq("pack_size", state.pack_size);
    if (state.uom) q = q.eq("uom", state.uom);

    // Quick filters
    if (state.quick.mosLt3) q = q.lt("mos_overall", 3);
    if (state.quick.raso) q = q.in("sub_group_name", RASO_NAMES);

    // Classification
    if (state.category_id) q = q.eq("category_id", state.category_id);
    if (state.sub_category_id) {
      if (Array.isArray(state.sub_category_id))
        q = q.in("sub_category_id", state.sub_category_id);
      else q = q.eq("sub_category_id", state.sub_category_id);
    }
    if (state.product_group_id) {
      if (Array.isArray(state.product_group_id))
        q = q.in("product_group_id", state.product_group_id);
      else q = q.eq("product_group_id", state.product_group_id);
    }
    if (state.sub_group_id) {
      if (Array.isArray(state.sub_group_id))
        q = q.in("sub_group_id", state.sub_group_id);
      else q = q.eq("sub_group_id", state.sub_group_id);
    }

    // Advanced: exclusions
    function applyExclusion(col, ids) {
      if (!ids || !ids.length) return;
      if (ids.length === 1) {
        q = q.neq(col, ids[0]);
      } else {
        q = q.not(
          col,
          "in",
          `(${ids.map((x) => JSON.stringify(x)).join(",")})`
        );
      }
    }
    applyExclusion("category_id", state.ex.cats);
    applyExclusion("sub_category_id", state.ex.subcats);
    applyExclusion("product_group_id", state.ex.pgroups);
    applyExclusion("sub_group_id", state.ex.sgroups);

    // Advanced: MOS comparators
    function applyMos(col, rule) {
      if (!rule || !rule.en) return;
      const v1 = rule.v1 !== "" ? Number(rule.v1) : null;
      const v2 = rule.v2 !== "" ? Number(rule.v2) : null;
      if (rule.notNull) q = q.not(col, "is", null);

      switch (rule.op) {
        case "eq":
          if (v1 != null) q = q.eq(col, v1);
          break;
        case "gt":
          if (v1 != null) q = q.gt(col, v1);
          break;
        case "gte":
          if (v1 != null) q = q.gte(col, v1);
          break;
        case "lt":
          if (v1 != null) q = q.lt(col, v1);
          break;
        case "lte":
          if (v1 != null) q = q.lte(col, v1);
          break;
        case "between":
          if (v1 != null) q = q.gte(col, v1);
          if (v2 != null) q = q.lte(col, v2);
          break;
      }
    }
    applyMos("mos_ik", state.mos.ik);
    applyMos("mos_kkd", state.mos.kkd);
    applyMos("mos_ok", state.mos.ok);
    applyMos("mos_overall", state.mos.ov);

    // Sort
    q = q
      .order("category_name", { ascending: true })
      .order("product_group_name", { ascending: true })
      .order("sub_group_name", { ascending: true })
      .order("sub_category_name", { ascending: true })
      .order("item", { ascending: true })
      .order("pack_size", { ascending: true });

    // Pagination
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    renderRows(data || []);

    if (elTable && elTable.parentElement) {
      elTable.parentElement.scrollTop = 0;
    }

    const total = count ?? 0;
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = clamp(page, 1, maxPage);
    if (elCount) elCount.textContent = `${fmtInt(total)} rows`;
    if (elPage) elPage.textContent = `Page ${page} / ${maxPage}`;
    if (elPrev) elPrev.disabled = page <= 1;
    if (elNext) elNext.disabled = page >= maxPage;

    if (!data || data.length === 0) {
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">No rows found for the selected filters.</td></tr>`;
    }
    // update filters button state (reflect applied filters)
    try {
      updateFiltersButtonState();
    } catch {
      void 0;
    }
  } catch (err) {
    console.error(err);
    setMsg(err.message || String(err));
    if (elBody)
      elBody.innerHTML = `<tr><td colspan="${VISIBLE_COLS}">Error loading data.</td></tr>`;
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
      Array.from(elBody.querySelectorAll("tr.selected-row")).forEach((row) =>
        row.classList.remove("selected-row")
      );
      let targetTr = tr;
      if (e && e.target && e.target.tagName === "TD") {
        targetTr = e.target.parentElement;
      }
      targetTr.classList.add("selected-row");
    }
    tr.addEventListener("click", selectRowHandler, { passive: true });
    tr.addEventListener("touchstart", selectRowHandler, { passive: true });
    tr.addEventListener("touchend", selectRowHandler, { passive: true });
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

    let q = supabase.from("v_stock_checker").select("*");

    // Primary
    if (selectedProductId) q = q.eq("product_id", selectedProductId);
    if (state.pack_size) q = q.eq("pack_size", state.pack_size);
    if (state.uom) q = q.eq("uom", state.uom);

    // Quick
    if (state.quick.mosLt3) q = q.lt("mos_overall", 3);
    if (state.quick.raso) q = q.in("sub_group_name", RASO_NAMES);

    // Classification
    if (state.category_id) q = q.eq("category_id", state.category_id);
    if (state.sub_category_id) {
      if (Array.isArray(state.sub_category_id))
        q = q.in("sub_category_id", state.sub_category_id);
      else q = q.eq("sub_category_id", state.sub_category_id);
    }
    if (state.product_group_id) {
      if (Array.isArray(state.product_group_id))
        q = q.in("product_group_id", state.product_group_id);
      else q = q.eq("product_group_id", state.product_group_id);
    }
    if (state.sub_group_id) {
      if (Array.isArray(state.sub_group_id))
        q = q.in("sub_group_id", state.sub_group_id);
      else q = q.eq("sub_group_id", state.sub_group_id);
    }

    // Advanced: exclusions
    function applyExclusion(col, ids) {
      if (!ids || !ids.length) return;
      if (ids.length === 1) {
        q = q.neq(col, ids[0]);
      } else {
        q = q.not(
          col,
          "in",
          `(${ids.map((x) => JSON.stringify(x)).join(",")})`
        );
      }
    }
    applyExclusion("category_id", state.ex.cats);
    applyExclusion("sub_category_id", state.ex.subcats);
    applyExclusion("product_group_id", state.ex.pgroups);
    applyExclusion("sub_group_id", state.ex.sgroups);

    // Advanced: MOS comparators
    function applyMos(col, rule) {
      if (!rule?.en) return;
      const v1 = rule.v1 !== "" ? Number(rule.v1) : null;
      const v2 = rule.v2 !== "" ? Number(rule.v2) : null;
      if (rule.notNull) q = q.not(col, "is", null);
      switch (rule.op) {
        case "eq":
          if (v1 != null) q = q.eq(col, v1);
          break;
        case "gt":
          if (v1 != null) q = q.gt(col, v1);
          break;
        case "gte":
          if (v1 != null) q = q.gte(col, v1);
          break;
        case "lt":
          if (v1 != null) q = q.lt(col, v1);
          break;
        case "lte":
          if (v1 != null) q = q.lte(col, v1);
          break;
        case "between":
          if (v1 != null) q = q.gte(col, v1);
          if (v2 != null) q = q.lte(col, v2);
          break;
      }
    }
    applyMos("mos_ik", state.mos.ik);
    applyMos("mos_kkd", state.mos.kkd);
    applyMos("mos_ok", state.mos.ok);
    applyMos("mos_overall", state.mos.ov);

    // Sort & size
    q = q
      .order("category_name", { ascending: true })
      .order("product_group_name", { ascending: true })
      .order("sub_group_name", { ascending: true })
      .order("sub_category_name", { ascending: true })
      .order("item", { ascending: true })
      .order("pack_size", { ascending: true })
      .limit(20000);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
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
