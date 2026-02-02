// js/fg-transfer-reconciliation.js
/* eslint-env browser */
import { supabase, handleSupabaseError } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// =========================================================================
// STATE MANAGEMENT
// =========================================================================

const state = {
  currentTab: "overview",
  // Global filters
  dateFrom: getDefaultFromDate(),
  dateTo: getDefaultToDate(),
  searchText: "",
  statusFilter: null, // null = no filter, array = selected values
  problemFilter: null, // null = no filter, array = selected values
  hideMatched: true,
  hideLegacy: true,

  // Local filters per tab
  tallyEventsOnlyUnmapped: false,
  tallyEventsOnlyNullGodown: false,
  dwlEventsOnlyUnmapped: false,
  dwlEventsOnlyNotDone: false,
  normalizedOnlyUnmapped: false,
  normalizedOnlyInactive: false,

  // Pagination
  pageReconciliation: 1,
  pageTallyEvents: 1,
  pageDwlEvents: 1,
  pageNormalized: 1,
  pageFixQueue: 1,
  pageSize: 30,

  // Selected row for inspector
  selectedRow: null,
  inspectorTab: "summary",

  // Track whether overview has been initialized (avoid resetting on every visit)
  _overviewVisited: false,
  // Last refresh time
  lastRefresh: null,
};

// Master filter options (single source of truth)
const RECON_STATUS_OPTIONS = [
  "LEGACY_PRE_LOGGING",
  "MATCHED",
  "MISMATCH",
  "MISSING_LOG",
  "EXTRA_LOG",
  "UNKNOWN",
];

const PROBLEM_KIND_OPTIONS = [
  "LEGACY_PRE_LOGGING",
  "TALLY_UNMAPPED",
  "LOG_UNMAPPED",
  "LOG_MISSING",
  "TALLY_MISSING",
  "BREAKDOWN_MISMATCH",
  "MATCHED_OK",
  "OTHER",
];

// Modal working selections (do NOT directly mutate state until Apply)
let mfWorkingStatus = new Set();
let mfWorkingProblem = new Set();

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

function getDefaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return formatDate(d);
}

function getDefaultToDate() {
  return formatDate(new Date());
}

function formatDate(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function formatDateForDB(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split("-");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatDateFromDBToDDMMYYYY(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const s =
    typeof yyyyMmDd === "string"
      ? yyyyMmDd
      : new Date(yyyyMmDd).toISOString().slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return String(yyyyMmDd);
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function setSingleDayRangeFromDBDate(dbDate) {
  const ddmmyyyy = formatDateFromDBToDDMMYYYY(dbDate);
  state.dateFrom = ddmmyyyy;
  state.dateTo = ddmmyyyy;
  const inp = document.getElementById("dateRange");
  if (inp) {
    inp.value = `${ddmmyyyy} to ${ddmmyyyy}`;
    if (inp._flatpickr) {
      // Construct a Date at midnight to avoid timezone shifts
      try {
        const iso =
          typeof dbDate === "string" && dbDate.length >= 10
            ? `${dbDate}T00:00:00`
            : undefined;
        const dateObj = iso ? new Date(iso) : new Date();
        // Ensure flatpickr reflects the selected single-day range without
        // firing the onChange handler (use false to avoid programmatic onChange)
        inp._flatpickr.setDate([dateObj, dateObj], false);
      } catch {
        // If flatpickr setDate fails, leave the input value updated at least
      }
    }
  }
}

function showToast(msg, type = "info", timeout = 3000) {
  const container = document.getElementById("statusToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  toast.style.opacity = "0";
  toast.style.transform = "translateY(6px)";
  requestAnimationFrame(() => {
    toast.style.transition = "opacity 0.22s ease, transform 0.22s ease";
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    setTimeout(() => {
      try {
        container.removeChild(toast);
      } catch {
        /* ignore */
      }
    }, 240);
  }, timeout);
}

function showLoading() {
  const area = document.getElementById("tableArea");
  if (!area) return;
  area.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
    </div>
  `;
}

function showError(message) {
  const area = document.getElementById("tableArea");
  if (!area) return;
  area.innerHTML = `
    <div class="empty-state">
      <h3>⚠️ Error</h3>
      <p>${message}</p>
    </div>
  `;
}

function showEmpty(message = "No data available") {
  const area = document.getElementById("tableArea");
  if (!area) return;
  area.innerHTML = `
    <div class="empty-state">
      <h3>📭 ${message}</h3>
      <p>Try adjusting your filters</p>
    </div>
  `;
}

function buildActiveFilterSummary() {
  const parts = [];
  if (state.dateFrom && state.dateTo) {
    parts.push(`Date: ${state.dateFrom} → ${state.dateTo}`);
  }
  if (state.searchText && state.searchText.trim()) {
    parts.push(`Search: "${state.searchText.trim()}"`);
  }
  const s = Array.isArray(state.statusFilter) ? state.statusFilter : [];
  const p = Array.isArray(state.problemFilter) ? state.problemFilter : [];
  if (s.length) parts.push(`Status: ${s.join(", ")}`);
  if (p.length) parts.push(`Problem: ${p.join(", ")}`);
  const toggles = [];
  if (state.hideMatched) toggles.push("HideMatched");
  if (state.hideLegacy) toggles.push("HideLegacy");
  if (toggles.length) parts.push(`Toggles: ${toggles.join(" + ")}`);
  return parts.join(" · ");
}

function updateStatusBar(info) {
  const statusInfo = document.getElementById("statusInfo");
  const tabLabel = state.currentTab
    ? state.currentTab.replace(/-/g, " ").toUpperCase()
    : "READY";
  const filterSummary = buildActiveFilterSummary();
  const finalText = filterSummary
    ? `[${tabLabel}] ${info} · ${filterSummary}`
    : `[${tabLabel}] ${info}`;
  if (statusInfo) statusInfo.textContent = finalText;
  const lastRefresh = document.getElementById("lastRefresh");
  if (lastRefresh) {
    const now = new Date().toLocaleTimeString();
    lastRefresh.textContent = `Last refresh: ${now}`;
    state.lastRefresh = now;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------------- Raw names / display label helpers ----------------
function formatRawNames(rawNames) {
  if (!rawNames) return "";
  if (Array.isArray(rawNames)) return rawNames.filter(Boolean).join(", ");
  if (typeof rawNames === "string") {
    // handle Postgres array-like string fallback: "{A,B}" or plain comma list
    const s = rawNames.replace(/^{|}$/g, "");
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .join(", ");
  }
  try {
    return String(rawNames);
  } catch {
    return "";
  }
}

function firstRawName(rawNames) {
  if (!rawNames) return null;
  if (Array.isArray(rawNames)) return rawNames.length ? rawNames[0] : null;
  if (typeof rawNames === "string") {
    const s = rawNames
      .replace(/^{|}$/g, "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return s.length ? s[0] : null;
  }
  return null;
}

function getDisplayProductLabelForReconRow(row) {
  if (!row) return "—";
  return (
    row.display_product_label ||
    row.product_name ||
    row.raw_item_hint ||
    row.tally_item_hint ||
    firstRawName(row.raw_item_names) ||
    "—"
  );
}

function getReconProductSubline(row) {
  if (!row) return "";
  if (row.problem_kind !== "TALLY_UNMAPPED") return "";
  const raw =
    row.raw_item_hint ||
    row.tally_item_hint ||
    formatRawNames(row.raw_item_names);
  if (!raw) return "";
  const main = getDisplayProductLabelForReconRow(row) || "";
  try {
    if (main.trim().toLowerCase() === String(raw).trim().toLowerCase())
      return "";
  } catch {
    /* ignore comparison errors */
  }
  return raw;
}

function getDisplayProductLabelForTallyEvent(row) {
  if (!row) return "—";
  return (
    row.product_name ||
    row.raw_item_hint ||
    firstRawName(row.raw_item_names) ||
    "—"
  );
}

// =========================================================================
// CRITICAL: NULL vs [] handling for filters
// =========================================================================

function getFilteredStatusArray() {
  // Build an effective include list. Start from explicit master selection
  // if present; otherwise start from the full set and apply exclusions.
  let base =
    Array.isArray(state.statusFilter) && state.statusFilter.length
      ? Array.from(state.statusFilter)
      : Array.from(RECON_STATUS_OPTIONS);

  if (state.hideMatched) {
    base = base.filter((s) => s !== "MATCHED");
  }
  if (state.hideLegacy) {
    base = base.filter((s) => s !== "LEGACY_PRE_LOGGING");
  }

  // If the effective set equals the full options (no constraint), return null
  const equalToAll =
    base.length === RECON_STATUS_OPTIONS.length &&
    RECON_STATUS_OPTIONS.every((v) => base.includes(v));
  if (equalToAll) return null;

  // Otherwise return the effective array (never empty)
  return base.length > 0 ? base : null;
}

function getFilteredProblemArray() {
  let base =
    Array.isArray(state.problemFilter) && state.problemFilter.length
      ? Array.from(state.problemFilter)
      : Array.from(PROBLEM_KIND_OPTIONS);

  if (state.hideMatched) {
    base = base.filter((p) => p !== "MATCHED_OK");
  }
  if (state.hideLegacy) {
    base = base.filter((p) => p !== "LEGACY_PRE_LOGGING");
  }

  const equalToAll =
    base.length === PROBLEM_KIND_OPTIONS.length &&
    PROBLEM_KIND_OPTIONS.every((v) => base.includes(v));
  if (equalToAll) return null;

  return base.length > 0 ? base : null;
}

// =========================================================================
// MODAL MANAGEMENT
// =========================================================================

function openModal(title, content) {
  const modal = document.getElementById("detailModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalContent = document.getElementById("modalContent");

  if (modalTitle) modalTitle.textContent = title;
  if (modalContent) modalContent.innerHTML = content;
  if (modal) modal.classList.add("open");
}

function closeModal() {
  const modal = document.getElementById("detailModal");
  if (modal) modal.classList.remove("open");
  state.selectedRow = null;
}

// ---------------- Master Filters Modal Helpers ----------------
function qs(id) {
  return document.getElementById(id);
}

function openMasterFiltersModal() {
  const modal = qs("masterFiltersModal");
  if (!modal) return;

  // initialize working sets from current state
  mfWorkingStatus = new Set(
    Array.isArray(state.statusFilter) ? state.statusFilter : [],
  );
  mfWorkingProblem = new Set(
    Array.isArray(state.problemFilter) ? state.problemFilter : [],
  );

  renderMasterFilterChips();

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    const apply = qs("mfApplyBtn");
    if (apply) apply.focus();
  }, 0);
  // Re-evaluate tableArea overflow after modal visibility changes
  setTimeout(() => adjustTableAreaOverflow(), 50);
}

function closeMasterFiltersModal() {
  const modal = qs("masterFiltersModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  // Re-evaluate tableArea overflow after modal closes
  setTimeout(() => adjustTableAreaOverflow(), 50);
}

function renderMasterFilterChips() {
  const statusWrap = qs("mfStatusChips");
  const problemWrap = qs("mfProblemChips");
  if (!statusWrap || !problemWrap) return;

  statusWrap.innerHTML = "";
  problemWrap.innerHTML = "";

  for (const s of RECON_STATUS_OPTIONS) {
    statusWrap.appendChild(makeChipButton(s, "status"));
  }
  for (const p of PROBLEM_KIND_OPTIONS) {
    problemWrap.appendChild(makeChipButton(p, "problem"));
  }
}

function makeChipButton(value, kind) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mf-chip";
  btn.textContent = value;

  const workingSet = kind === "status" ? mfWorkingStatus : mfWorkingProblem;

  // Default UI: chips are off unless explicitly selected in working set.
  const uiSelected = workingSet.has(value);
  if (uiSelected) btn.classList.add("selected");

  // Determine applicability of this chip for the current tab
  function isChipApplicable(val, k) {
    const tab = state.currentTab || "overview";
    // Disable all master-filter chips when on the Overview tab
    if (tab === "overview") return false;
    if (k === "status") {
      // Status/outcome filters only apply to Reconciliation (overview disabled above)
      return tab === "reconciliation";
    }
    // problem-kind applicability map
    const map = {
      TALLY_UNMAPPED: ["tally-events", "normalized-lines", "reconciliation"],
      TALLY_MISSING: ["reconciliation"],
      LOG_UNMAPPED: ["dwl-events", "reconciliation"],
      LOG_MISSING: ["reconciliation"],
      BREAKDOWN_MISMATCH: ["reconciliation"],
      MATCHED_OK: ["reconciliation"],
      LEGACY_PRE_LOGGING: ["reconciliation", "overview"],
      OTHER: ["overview", "reconciliation"],
    };
    const applicable = map[val] || ["overview", "reconciliation"];
    return applicable.includes(tab);
  }

  const applicable = isChipApplicable(value, kind);
  if (!applicable) {
    btn.disabled = true;
    btn.title = "Not applicable to this tab";
    btn.classList.add("disabled-chip");
  } else {
    btn.addEventListener("click", () => {
      // Toggle selection normally: add/remove from working set and update UI
      toggleSet(workingSet, value);
      btn.classList.toggle("selected");
    });
  }

  return btn;
}

function toggleSet(setObj, value) {
  if (setObj.has(value)) setObj.delete(value);
  else setObj.add(value);
}

// Apply button -> write into state with correct NULL vs ARRAY handling
function applyMasterFilters() {
  const statusArr = Array.from(mfWorkingStatus);
  const problemArr = Array.from(mfWorkingProblem);

  state.statusFilter = statusArr.length > 0 ? statusArr : null;
  state.problemFilter = problemArr.length > 0 ? problemArr : null;

  // If master filters explicitly include legacy or matched selections,
  // ensure the corresponding hide-toggles are turned OFF so the explicit
  // inclusion is respected.
  try {
    const status = Array.isArray(state.statusFilter) ? state.statusFilter : [];
    const problem = Array.isArray(state.problemFilter)
      ? state.problemFilter
      : [];

    const includesLegacy =
      status.includes("LEGACY_PRE_LOGGING") ||
      problem.includes("LEGACY_PRE_LOGGING");
    if (includesLegacy) state.hideLegacy = false;

    const includesMatched =
      status.includes("MATCHED") || problem.includes("MATCHED_OK");
    if (includesMatched) state.hideMatched = false;
  } catch {
    /* ignore any unexpected issues when reading working sets */
  }

  // Sync quick-toggle checkboxes in the UI so their visual state matches
  // the updated `state` values (they may have been changed above).
  try {
    const hideMatchedCheckbox = document.getElementById("hideMatched");
    if (hideMatchedCheckbox) {
      hideMatchedCheckbox.checked = !!state.hideMatched;
      try {
        hideMatchedCheckbox.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      } catch {
        /* ignore */
      }
    }
    const hideLegacyCheckbox = document.getElementById("hideLegacy");
    if (hideLegacyCheckbox) {
      hideLegacyCheckbox.checked = !!state.hideLegacy;
      try {
        hideLegacyCheckbox.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore DOM sync errors */
  }

  resetPages();
  closeMasterFiltersModal();
  updateMasterFiltersButtonState();
  switchTab(state.currentTab);
}

function clearMasterFilters() {
  mfWorkingStatus.clear();
  mfWorkingProblem.clear();
  renderMasterFilterChips();
}

// Note: resetAllFilters removed because it's unused; use Apply/Clear in Master Filters modal instead.

// `masterFilterSummary` indicator removed — function deleted to avoid unused-var lint

// Update master filters button visual state
function updateMasterFiltersButtonState() {
  const btn = qs("masterFiltersBtn");
  if (!btn) return;

  // Consider toggles active only if they differ from the initial defaults
  const togglesActive =
    typeof state._initialHideMatched !== "undefined" &&
    typeof state._initialHideLegacy !== "undefined"
      ? state.hideMatched !== state._initialHideMatched ||
        state.hideLegacy !== state._initialHideLegacy
      : state.hideMatched || state.hideLegacy;

  const hasActiveFilters =
    (state.statusFilter && state.statusFilter.length > 0) ||
    (state.problemFilter && state.problemFilter.length > 0) ||
    togglesActive;

  if (hasActiveFilters) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
}

// =========================================================================
// BADGE & ICON HELPERS
// =========================================================================

function getStatusBadge(status) {
  const map = {
    MATCHED: "matched",
    MISMATCH: "mismatch",
    MISSING_LOG: "missing-log",
    EXTRA_LOG: "extra-log",
    LEGACY_PRE_LOGGING: "legacy",
    UNKNOWN: "unmapped",
  };
  const cls = map[status] || "unmapped";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function getProblemBadge(problem) {
  const map = {
    MATCHED_OK: "matched",
    BREAKDOWN_MISMATCH: "mismatch",
    LOG_MISSING: "missing-log",
    TALLY_MISSING: "extra-log",
    TALLY_UNMAPPED: "unmapped",
    LOG_UNMAPPED: "unmapped",
    LEGACY_PRE_LOGGING: "legacy",
    OTHER: "unmapped",
  };
  const cls = map[problem] || "unmapped";
  return `<span class="badge ${cls}">${escapeHtml(problem)}</span>`;
}

function getBoolIcon(value) {
  if (value === true) return '<span class="icon success">✓</span>';
  if (value === false) return '<span class="icon error">✗</span>';
  return '<span class="icon" style="color: #9ca3af;">—</span>';
}

// Render compact mapping dots: only show green dots for OK flags
function renderMappingDotsOnlyOk(row) {
  try {
    const parts = [];
    if (row && row.all_godown_mapped) {
      parts.push('<span class="map-dot ok" title="Godown mapped">G</span>');
    }
    if (row && row.all_sku_mapped) {
      parts.push('<span class="map-dot ok" title="All SKU mapped">S</span>');
    }
    if (row && row.is_product_mapped) {
      parts.push('<span class="map-dot ok" title="Product mapped">P</span>');
    }
    if (row && row.all_lines_sku_mapped) {
      parts.push(
        '<span class="map-dot ok" title="All lines SKU mapped">L</span>',
      );
    }
    if (parts.length === 0) return "—";
    return `<div class="mapping-dots">${parts.join("")}</div>`;
  } catch {
    return "—";
  }
}

// =========================================================================
// Tooltip maps and helper for Overview (Outcome vs Diagnosis)
// =========================================================================

const perOutcomeTooltipMap = {
  TOTAL:
    "Total = all reconciliation records returned for the selected date range (including Legacy and Unknown). It is simply the sum of all Recon Status outcomes shown here.",
  MATCHED: "Matched: Exists in both Tally and DWL, and breakdown matches.",
  MISMATCH:
    "Mismatch: Exists in both Tally and DWL, but breakdown differs OR mapping issues causing mismatch classification.",
  MISSING_LOG:
    "Missing Log: Exists in Tally but missing in DWL for this Batch+Product+Date.",
  EXTRA_LOG:
    "Extra Log: Exists in DWL but missing in Tally for this Batch+Product+Date.",
  LEGACY_PRE_LOGGING:
    "Legacy: Tally record predates DWL logging period / excluded from reconciliation workflow.",
  UNKNOWN: "Other/Unknown: Not classified into standard outcomes.",
  OTHER: "Other/Unknown: Not classified into standard outcomes.",
};

const perDiagnosisTooltipMap = {
  MATCHED_OK: "No issue: matched outcome and breakdown is consistent.",
  BREAKDOWN_MISMATCH:
    "Breakdown mismatch: both sides exist but SKU-wise breakdown differs.",
  LOG_MISSING: "DWL entry missing: Tally has transfer, DWL entry not found.",
  TALLY_MISSING:
    "Tally missing: DWL has entry, Tally transfer not found for same key.",
  TALLY_UNMAPPED:
    "Tally unmapped: Missing Log or Mismatch because Tally lines are not mapped to Product/SKU (product_id is null OR all_sku_mapped=false).",
  LOG_UNMAPPED:
    "Log unmapped: Extra Log or Mismatch because DWL lines are not mapped correctly (is_product_mapped=false OR all_lines_sku_mapped=false).",
  LEGACY_PRE_LOGGING: "Legacy: record belongs to pre-logging period.",
  OTHER: "Other: catch-all diagnosis when none of the above rules apply.",
};

const Tooltip = {
  el: null,
  openFor: null,
};

function ensureTooltipEl() {
  if (Tooltip.el) return Tooltip.el;
  const el = document.getElementById("erpTooltip");
  Tooltip.el = el;
  return el;
}

function openTooltip(anchorEl, title, body) {
  const el = ensureTooltipEl();
  if (!el || !anchorEl) return;
  // Close existing
  closeTooltip();

  el.innerHTML = `<div class="tt-title">${escapeHtml(title || "")}</div><div class="tt-body">${escapeHtml(body || "")}</div>`;
  // Respect per-anchor tooltip style (e.g. white/light tooltip when
  // `data-tooltip-style="white"` is present on the anchor element).
  try {
    const style = (anchorEl.dataset && anchorEl.dataset.tooltipStyle) || null;
    if (style === "white") el.classList.add("white");
    else el.classList.remove("white");
  } catch {
    /* ignore dataset errors */
  }

  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  Tooltip.openFor = anchorEl;

  // Positioning
  const rect = anchorEl.getBoundingClientRect();
  el.style.display = "block";
  el.style.left = "0px";
  el.style.top = "0px";
  const tw = el.offsetWidth;
  const th = el.offsetHeight;
  const padding = 8;
  let left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(padding, Math.min(left, window.innerWidth - tw - padding));
  // Prefer below
  let top = rect.bottom + 8;
  if (top + th + padding > window.innerHeight) {
    // place above
    top = rect.top - th - 8;
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function closeTooltip() {
  const el = ensureTooltipEl();
  if (!el) return;
  if (window.__FGTR_TOOLTIP_LOCKED) return;
  el.classList.remove("open");
  el.style.display = "none";
  el.setAttribute("aria-hidden", "true");
  Tooltip.openFor = null;
}

function closeTooltipForce() {
  const el = ensureTooltipEl();
  if (!el) return;
  window.__FGTR_TOOLTIP_LOCKED = false;
  el.classList.remove("open");
  el.style.display = "none";
  el.setAttribute("aria-hidden", "true");
  Tooltip.openFor = null;
}

function bindTooltip(buttonEl, title, body) {
  if (!buttonEl) return;

  // Desktop hover
  buttonEl.addEventListener("mouseenter", () => {
    if (window.__FGTR_TOOLTIP_LOCKED) return;
    openTooltip(buttonEl, title, body);
  });
  buttonEl.addEventListener("mouseleave", () => {
    if (window.__FGTR_TOOLTIP_LOCKED) return;
    closeTooltipForce();
  });

  // Keyboard focus
  buttonEl.addEventListener("focus", () => {
    if (window.__FGTR_TOOLTIP_LOCKED) return;
    openTooltip(buttonEl, title, body);
  });
  buttonEl.addEventListener("blur", () => {
    if (window.__FGTR_TOOLTIP_LOCKED) return;
    closeTooltipForce();
  });

  // Mobile / click toggle (stop propagation so parent clicks don't fire)
  buttonEl.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ensureTooltipEl();
    const isOpen = el && el.classList.contains("open");
    if (isOpen && window.__FGTR_TOOLTIP_LOCKED) {
      closeTooltipForce();
      return;
    }
    window.__FGTR_TOOLTIP_LOCKED = true;
    openTooltip(buttonEl, title, body);
  });
}

// Global handlers (one-time)
if (!window.__fgtr_tooltip_handlers_installed) {
  document.addEventListener("click", (e) => {
    const el = Tooltip.el;
    if (!el || !Tooltip.openFor) return;
    if (el.contains(e.target) || Tooltip.openFor.contains(e.target)) return;
    closeTooltipForce();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTooltip();
  });
  window.addEventListener("scroll", () => closeTooltip(), true);
  window.__fgtr_tooltip_handlers_installed = true;
}

// Resize-aware helpers: compute available vertical space and toggle
// outer `#tableArea` overflow when content exceeds available viewport.
function debounce(fn, delay = 120) {
  let t = null;
  return function (...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

function getStatusBarHeight() {
  const sb =
    document.querySelector(".status-bar") ||
    document.getElementById("statusBar");
  return sb ? sb.getBoundingClientRect().height : 0;
}

function adjustTableAreaOverflow() {
  const tableAreaEl = document.getElementById("tableArea");
  if (!tableAreaEl) return;

  // Ensure display styles expected by layout
  tableAreaEl.style.display = tableAreaEl.style.display || "flex";
  tableAreaEl.style.flexDirection = tableAreaEl.style.flexDirection || "column";

  // Measure available height below tableArea's top to bottom of viewport,
  // subtracting any sticky status bar at bottom.
  const rect = tableAreaEl.getBoundingClientRect();
  const availableHeight = Math.max(
    0,
    window.innerHeight - rect.top - getStatusBarHeight() - 8,
  );

  // If a scrolling inner wrapper exists, manage its overflow instead so
  // header and pagination remain outside the scroller and visible.
  const innerWrap = tableAreaEl.querySelector(".table-body-wrap");
  const topRow = tableAreaEl.querySelector(".table-top-row");
  const topRowHeight = topRow ? topRow.getBoundingClientRect().height : 0;

  if (innerWrap) {
    const availableInner = Math.max(
      0,
      window.innerHeight - rect.top - getStatusBarHeight() - 8 - topRowHeight,
    );
    // constrain inner wrapper height so it scrolls independently
    if (innerWrap.scrollHeight > availableInner) {
      innerWrap.style.maxHeight = `${availableInner}px`;
      innerWrap.style.overflowY = "auto";
    } else {
      innerWrap.style.maxHeight = "none";
      innerWrap.style.overflowY = "hidden";
    }
    // outer area should not scroll when inner wrapper manages scrolling
    tableAreaEl.style.overflowY = "visible";
    return;
  }

  // Fallback: no inner wrapper — control outer scroll as before
  const contentHeight = tableAreaEl.scrollHeight;
  if (contentHeight > availableHeight) {
    tableAreaEl.style.overflowY = "auto";
  } else {
    tableAreaEl.style.overflowY = "hidden";
  }
}

function installTableAreaResizeHandler() {
  if (window.__fgtr_tablearea_resize_installed) return;
  window.addEventListener(
    "resize",
    debounce(() => adjustTableAreaOverflow(), 120),
  );
  // also observe mutations inside tableArea since its content height changes
  const tableAreaEl = document.getElementById("tableArea");
  if (tableAreaEl && window.MutationObserver) {
    const mo = new MutationObserver(
      debounce(() => adjustTableAreaOverflow(), 80),
    );
    mo.observe(tableAreaEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.__fgtr_tablearea_mo = mo;
  }
  window.__fgtr_tablearea_resize_installed = true;
}

// =========================================================================
// CHIP MODAL FUNCTIONALITY
// =========================================================================

function openChipModal(title, chipsHtml) {
  const modal = document.getElementById("chipModal");
  const modalTitle = document.getElementById("chipModalTitle");
  const modalChips = document.getElementById("chipModalChips");

  if (!modal || !modalTitle || !modalChips) return;
  // remember the element that had focus so we can restore it on close
  try {
    window.__fgtr_last_focused = document.activeElement;
  } catch {
    window.__fgtr_last_focused = null;
  }

  modalTitle.textContent = title;
  modalChips.innerHTML = chipsHtml;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  // focus the close button for keyboard users
  setTimeout(() => {
    const closeBtn = document.getElementById("chipModalClose");
    if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();
  }, 0);

  // Re-bind chip click handlers in modal
  rebindChipHandlers();
}

function closeChipModal() {
  const modal = document.getElementById("chipModal");
  if (!modal) return;
  // Move focus back to the opener before hiding the modal to avoid
  // If any element inside the modal currently has focus, blur it first
  // so we don't apply aria-hidden to an element that still retains focus.
  try {
    const active = document.activeElement;
    if (active && modal.contains(active) && typeof active.blur === "function") {
      active.blur();
    }
  } catch {
    /* ignore */
  }

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  // Now restore focus to the element that opened the modal (if available).
  try {
    const returnTo = window.__fgtr_last_focused;
    if (returnTo && typeof returnTo.focus === "function") {
      returnTo.focus();
    } else {
      const mf = document.getElementById("masterFiltersBtn");
      if (mf && typeof mf.focus === "function") mf.focus();
      else if (document.body && typeof document.body.focus === "function")
        document.body.focus();
    }
  } catch {
    /* ignore focus errors */
  }

  // clear stored opener
  window.__fgtr_last_focused = null;
}

function rebindChipHandlers() {
  // Re-attach outcome chip handlers
  document.querySelectorAll("#chipModalChips .outcome-chip").forEach((chip) => {
    // Skip TOTAL chip - it's not a filter
    if (chip.dataset.status === "TOTAL") {
      // Only bind tooltip for TOTAL chip, no click handler
      const info = chip.querySelector(".info-icon");
      if (info) {
        const title = chip.querySelector(".chip-label")?.textContent || "";
        const body =
          perOutcomeTooltipMap[info.dataset.tooltipKey] ||
          perOutcomeTooltipMap["OTHER"] ||
          "";
        bindTooltip(info, title, body);
      }
      return;
    }

    chip.addEventListener("click", () => {
      state.statusFilter = [chip.dataset.status || null];
      state.problemFilter = null;
      updateMasterFiltersButtonState();
      closeChipModal();
      switchTab("reconciliation");
    });

    // Re-bind tooltip for info icons
    const info = chip.querySelector(".info-icon");
    if (info) {
      const title = chip.querySelector(".chip-label")?.textContent || "";
      const body =
        perOutcomeTooltipMap[info.dataset.tooltipKey] ||
        perOutcomeTooltipMap["OTHER"] ||
        "";
      bindTooltip(info, title, body);
    }
  });

  // Re-attach diagnosis chip handlers
  document
    .querySelectorAll("#chipModalChips .diagnosis-chip")
    .forEach((chip) => {
      chip.addEventListener("click", () => {
        state.problemFilter = [chip.dataset.problem || null];
        state.statusFilter = null;
        updateMasterFiltersButtonState();
        closeChipModal();
        switchTab("reconciliation");
      });

      // Re-bind tooltip for info icons
      const info = chip.querySelector(".info-icon");
      if (info) {
        const title = chip.querySelector(".chip-label")?.textContent || "";
        const body =
          perDiagnosisTooltipMap[info.dataset.tooltipKey] ||
          perDiagnosisTooltipMap["OTHER"] ||
          "";
        bindTooltip(info, title, body);
      }
    });
}

function attachDrawerToggleHandlers() {
  // Attach click handlers to clickable headers
  document.querySelectorAll(".clickable-header").forEach((header) => {
    header.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetId = header.dataset.drawer;
      const chipRow = document.querySelector(`[data-chips="${targetId}"]`);

      if (chipRow) {
        // Extract chips from the hidden chip row
        const chipsHtml = chipRow.innerHTML;
        const title =
          targetId === "outcome-chips"
            ? "Outcome (Recon Result)"
            : "Diagnosis (Reason)";
        openChipModal(title, chipsHtml);
      }
    });
  });

  // Close modal when clicking outside or pressing escape
  if (!window.__fgtr_chip_modal_handlers_installed) {
    document.addEventListener("click", (e) => {
      const modal = document.getElementById("chipModal");
      if (
        modal &&
        modal.classList.contains("open") &&
        !e.target.closest(".chip-modal-content") &&
        !e.target.closest(".clickable-header")
      ) {
        closeChipModal();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeChipModal();
      }
    });

    // Close button handler
    const closeBtn = document.getElementById("chipModalClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeChipModal);
    }

    window.__fgtr_chip_modal_handlers_installed = true;
  }
}

// =========================================================================
// DATA FETCHING
// =========================================================================

async function fetchOverviewData() {
  const from = formatDateForDB(state.dateFrom);
  const to = formatDateForDB(state.dateTo);

  try {
    // Fetch counts
    const { data: counts, error: countsError } = await supabase.rpc(
      "rpc_fg_transfer_recon_counts",
      { p_from: from, p_to: to },
    );
    if (countsError) {
      console.error("rpc_fg_transfer_recon_counts returned error", countsError);
      throw countsError;
    }

    // Fetch problem counts
    const { data: problems, error: problemsError } = await supabase.rpc(
      "rpc_fg_transfer_recon_problem_counts",
      { p_from: from, p_to: to },
    );
    if (problemsError) {
      console.error(
        "rpc_fg_transfer_recon_problem_counts returned error",
        problemsError,
      );
      throw problemsError;
    }

    // Fetch counts by date (if available)
    const { data: byDate, error: byDateError } = await supabase.rpc(
      "rpc_fg_transfer_recon_counts_by_date",
      { p_from: from, p_to: to },
    );
    // Don't throw error if this RPC is missing
    const countsByDate = byDateError ? null : byDate;

    return { counts, problems, countsByDate };
  } catch (error) {
    console.error("fetchOverviewData failed", { from, to, error });
    handleSupabaseError(error);
    throw error;
  }
}

async function fetchReconciliationList(page = 1) {
  const from = formatDateForDB(state.dateFrom);
  const to = formatDateForDB(state.dateTo);
  const offset = (page - 1) * state.pageSize;

  const statusArray = getFilteredStatusArray();
  const problemArray = getFilteredProblemArray();

  try {
    const payload = {
      p_from: from,
      p_to: to,
      p_status: statusArray,
      p_problem: problemArray,
      p_search: state.searchText || null,
      p_limit: state.pageSize,
      p_offset: offset,
    };

    const { data, error } = await supabase.rpc(
      "rpc_fg_transfer_recon_list_enriched",
      payload,
    );
    if (error) {
      console.error(
        "rpc_fg_transfer_recon_list_enriched returned error",
        error,
        payload,
      );
      throw error;
    }

    // RPC now returns jsonb { rows: [...], total: bigint }
    const payloadObj = data ?? { rows: [], total: 0 };
    const rows = Array.isArray(payloadObj.rows) ? payloadObj.rows : [];
    const total = Number(payloadObj.total ?? 0);
    return { rows, total };
  } catch (error) {
    console.error("fetchReconciliationList failed", {
      page,
      from,
      to,
      statusArray,
      problemArray,
      error,
    });
    handleSupabaseError(error);
    throw error;
  }
}

async function fetchReconciliationDetail(transferDate, batchCode, productId) {
  try {
    const payload = {
      p_transfer_date: transferDate,
      p_batch_code: batchCode,
      p_product_id: productId || null,
    };

    const { data, error } = await supabase.rpc(
      "rpc_fg_transfer_recon_get_v2",
      payload,
    );
    if (error) {
      console.error(
        "rpc_fg_transfer_recon_get_v2 returned error",
        error,
        payload,
      );
      throw error;
    }
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error("fetchReconciliationDetail failed", {
      transferDate,
      batchCode,
      productId,
      error,
    });
    handleSupabaseError(error);
    throw error;
  }
}

async function fetchTallyEvents(page = 1) {
  const from = formatDateForDB(state.dateFrom);
  const to = formatDateForDB(state.dateTo);
  const offset = (page - 1) * state.pageSize;

  try {
    // Determine whether master filters request only-unmapped tally events
    const problemFilterIsArray = Array.isArray(state.problemFilter)
      ? state.problemFilter
      : [];
    const derivedOnlyUnmapped = problemFilterIsArray.includes("TALLY_UNMAPPED");

    const payload = {
      p_from: from,
      p_to: to,
      // send an explicit boolean (true/false). Previously we sent `null`
      // when not filtering which, due to SQL NULL semantics, caused the
      // WHERE clause to behave like an "only unmapped" filter. Explicit
      // false ensures the RPC returns all rows when the flag is not set.
      p_only_unmapped: derivedOnlyUnmapped,
      p_search: state.searchText || null,
      p_limit: state.pageSize,
      p_offset: offset,
    };

    const { data, error } = await supabase.rpc(
      "rpc_fg_transfer_tally_event_list",
      payload,
    );
    if (error) {
      console.error(
        "rpc_fg_transfer_tally_event_list returned error",
        error,
        payload,
      );
      throw error;
    }

    // RPC returns jsonb { rows: [...], total: bigint }
    const payloadObj = data ?? { rows: [], total: 0 };
    const rows = Array.isArray(payloadObj.rows) ? payloadObj.rows : [];
    const total = Number(payloadObj.total ?? 0);
    return { rows, total };
  } catch (error) {
    console.error("fetchTallyEvents failed", { page, from, to, error });
    handleSupabaseError(error);
    throw error;
  }
}

async function fetchDwlEvents(page = 1) {
  const from = formatDateForDB(state.dateFrom);
  const to = formatDateForDB(state.dateTo);
  // Allow export to override page size when fetching large exports
  const pageSize =
    typeof arguments[1] !== "undefined" && arguments[1] !== null
      ? arguments[1]
      : state.pageSize;
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase
    .from("v_dwl_fg_transfer_event")
    .select("*")
    .gte("log_date", from || "1900-01-01")
    .lte("log_date", to || "2100-01-01")
    .order("log_date", { ascending: false })
    .order("batch_code", { ascending: true })
    .range(offset, offset + pageSize - 1);

  // Apply filters
  if (state.searchText) {
    query = query.or(
      `batch_code.ilike.%${state.searchText}%,product_name.ilike.%${state.searchText}%`,
    );
  }
  // Apply master-filter LOG_UNMAPPED OR local toggle (backwards compat)
  const problemFilterIsArray = Array.isArray(state.problemFilter)
    ? state.problemFilter
    : [];
  const derivedOnlyUnmapped = problemFilterIsArray.includes("LOG_UNMAPPED");
  if (state.dwlEventsOnlyUnmapped || derivedOnlyUnmapped) {
    query = query.or(
      "is_product_mapped.eq.false,all_lines_sku_mapped.eq.false",
    );
  }
  if (state.dwlEventsOnlyNotDone) {
    query = query.neq("log_status", "Done");
  }
  try {
    const { data, error } = await query;
    if (error) {
      console.error("v_dwl_fg_transfer_event query returned error", error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error("fetchDwlEvents failed", { page, from, to, error });
    handleSupabaseError(error);
    throw error;
  }
}

async function fetchNormalizedLines(page = 1) {
  const from = formatDateForDB(state.dateFrom);
  const to = formatDateForDB(state.dateTo);
  // Allow export to override page size when fetching large exports
  const pageSize =
    typeof arguments[1] !== "undefined" && arguments[1] !== null
      ? arguments[1]
      : state.pageSize;
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase
    .from("v_tally_fg_transfer_normalized")
    .select("*")
    .gte("transfer_date", from || "1900-01-01")
    .lte("transfer_date", to || "2100-01-01")
    .order("transfer_date", { ascending: false })
    .order("batch_code", { ascending: true })
    .range(offset, offset + pageSize - 1);

  // Apply filters
  if (state.searchText) {
    query = query.or(
      `batch_code.ilike.%${state.searchText}%,product_name.ilike.%${state.searchText}%,item_name_raw.ilike.%${state.searchText}%`,
    );
  }
  // Apply master-filter TALLY_UNMAPPED instead of per-tab flag
  const problemFilterIsArray = Array.isArray(state.problemFilter)
    ? state.problemFilter
    : [];
  const derivedOnlyUnmapped = problemFilterIsArray.includes("TALLY_UNMAPPED");
  if (derivedOnlyUnmapped) {
    query = query.or(
      "is_sku_mapped.eq.false,is_godown_mapped.eq.false,product_id.is.null",
    );
  }
  if (state.normalizedOnlyInactive) {
    query = query.eq("sku_is_active", false);
  }

  try {
    const { data, error } = await query;
    if (error) {
      console.error(
        "v_tally_fg_transfer_normalized query returned error",
        error,
      );
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error("fetchNormalizedLines failed", { page, from, to, error });
    handleSupabaseError(error);
    throw error;
  }
}

async function fetchFixSuggestions(page = 1) {
  const from = formatDateForDB(state.dateFrom);
  const to = formatDateForDB(state.dateTo);
  const offset = (page - 1) * state.pageSize;
  try {
    // Call list RPC which returns jsonb { rows, total }
    const payload = {
      p_from: from,
      p_to: to,
      p_limit: state.pageSize,
      p_offset: offset,
    };
    const { data, error } = await supabase.rpc(
      "rpc_fg_transfer_recon_fix_suggestions",
      payload,
    );
    if (error) {
      console.error(
        "rpc_fg_transfer_recon_fix_suggestions returned error",
        error,
        payload,
      );
      throw error;
    }

    const payloadObj = data ?? { rows: [], total: 0 };
    const rows = Array.isArray(payloadObj.rows) ? payloadObj.rows : [];
    const total = Number(payloadObj.total ?? 0);
    return { rows, total };
  } catch (error) {
    console.error("fetchFixSuggestions failed", { page, from, to, error });
    handleSupabaseError(error);
    throw error;
  }
}

// =========================================================================
// TAB RENDERERS
// =========================================================================

async function renderOverviewTab() {
  showLoading();
  try {
    const { counts, problems, countsByDate } = await fetchOverviewData();

    // Build KPI cards
    // KPI cards removed; overview will render compact chips only
    const statusOrder = [
      "total",
      "matched",
      "mismatch",
      "missing_log",
      "extra_log",
      "unmapped",
      "legacy",
    ];
    const statusLabels = {
      total: "Total",
      matched: "Matched",
      mismatch: "Mismatch",
      missing_log: "Missing Log",
      extra_log: "Extra Log",
      unmapped: "Unmapped",
      legacy: "Legacy",
    };

    // Convert counts array to map
    const countMap = {};
    let total = 0;
    counts.forEach((c) => {
      countMap[c.recon_status.toLowerCase()] = c.rows;
      total += c.rows;
    });
    countMap.total = total;

    const keyToRecon = {
      matched: "MATCHED",
      mismatch: "MISMATCH",
      missing_log: "MISSING_LOG",
      extra_log: "EXTRA_LOG",
      unmapped: "UNKNOWN",
      legacy: "LEGACY_PRE_LOGGING",
    };

    // Diagnosis summary (compact) - aggregate problem counts across recon_status
    const diagTotals = {};
    (problems || []).forEach((p) => {
      const k = p.problem_kind || "OTHER";
      diagTotals[k] = (diagTotals[k] || 0) + (p.rows || 0);
    });

    // Sort problem kinds by descending count
    const diagEntries = Object.keys(diagTotals)
      .map((k) => ({ kind: k, count: diagTotals[k] }))
      .sort((a, b) => b.count - a.count);

    // Section tooltips text
    const outcomeTip =
      "Outcome (Recon Result) is the final reconciliation result from v_fg_transfer_reconciliation.recon_status. It describes what happened for each Batch+Product+Date record.";
    const diagnosisTip =
      "Diagnosis (Reason) is computed from Outcome + mapping flags (see rpc_fg_transfer_recon_problem_counts CASE). It describes why the outcome occurred (mapping issue vs missing entry vs breakdown mismatch).";

    // Build overview blocks with clickable headers arranged side by side
    let overviewHeadersHtml = `<div class="overview-headers-container">`;

    // Outcome header (clickable)
    overviewHeadersHtml += `<div class="overview-header clickable-header" data-drawer="outcome-chips">`;
    overviewHeadersHtml += `<div class="overview-title">Outcome (Recon Result)</div>`;
    overviewHeadersHtml += `<div class="section-info" data-section="outcome">i</div>`;
    overviewHeadersHtml += `</div>`;

    // Diagnosis header (clickable)
    overviewHeadersHtml += `<div class="overview-header clickable-header" data-drawer="diagnosis-chips">`;
    overviewHeadersHtml += `<div class="overview-title">Diagnosis (Reason)</div>`;
    overviewHeadersHtml += `<div class="section-info" data-section="diagnosis">i</div>`;
    overviewHeadersHtml += `</div>`;

    overviewHeadersHtml += `</div>`;

    // Build hidden chip rows for extraction
    let outcomeChipsHtml = `<div class="chip-row" data-chips="outcome-chips">`;
    statusOrder.forEach((key) => {
      const value = countMap[key] || 0;
      const reconKey = key === "total" ? "TOTAL" : keyToRecon[key] || "OTHER";
      const variant = key || "other"; // already lower-case keys from statusOrder
      outcomeChipsHtml += `
        <div class="chip kpi-chip outcome-chip${reconKey === "TOTAL" ? " non-clickable" : ""}" data-variant="${escapeHtml(
          variant,
        )}" data-status="${escapeHtml(reconKey)}">
          <span class="chip-label">${escapeHtml(statusLabels[key])}</span>
          <span class="chip-count">${value.toLocaleString()}</span>
          <span class="info-icon" data-tooltip-type="outcome" data-tooltip-key="${escapeHtml(reconKey)}">i</span>
        </div>
      `;
    });
    outcomeChipsHtml += `</div>`;

    let diagnosisChipsHtml = `<div class="chip-row" data-chips="diagnosis-chips">`;
    diagEntries.forEach((d) => {
      const kindKey = (d.kind || "OTHER").toLowerCase();
      diagnosisChipsHtml += `
        <div class="chip kpi-chip diagnosis-chip" data-variant="${escapeHtml(
          kindKey,
        )}" data-problem="${escapeHtml(d.kind)}">
          <span class="chip-label">${escapeHtml(d.kind)}</span>
          <span class="chip-count">${d.count.toLocaleString()}</span>
          <span class="info-icon" data-tooltip-type="diagnosis" data-tooltip-key="${escapeHtml(d.kind)}">i</span>
        </div>
      `;
    });
    diagnosisChipsHtml += `</div>`;

    // Counts by date (if available) - NEW RPC returns one row per date with columns
    // transfer_date, total, matched, mismatch, missing_log, extra_log, legacy
    let byDateHtml = "";
    if (countsByDate && countsByDate.length > 0) {
      const fmt = (n) =>
        n === null || n === undefined ? "—" : n.toLocaleString();
      byDateHtml = `
        <div class="breakdown-section">
          <div class="row-head">
            <h4>By Date Summary <span class="section-info" data-section="bydate">i</span></h4>
          </div>
          <div class="bydate-wrapper">
            <table class="bydate-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Matched</th>
                  <th>Mismatch</th>
                  <th>Missing Log</th>
                  <th>Extra Log</th>
                  <th>Legacy</th>
                  <th>Unknown</th>
                </tr>
              </thead>
              <tbody>
      `;
      countsByDate.forEach((d) => {
        byDateHtml += `
          <tr class="bydate-row" data-date="${escapeHtml(String(d.transfer_date))}" title="Click to drill down">
            <td>${escapeHtml(formatDateFromDBToDDMMYYYY(d.transfer_date))}</td>
            <td>${fmt(d.total)}</td>
            <td>${fmt(d.matched)}</td>
            <td>${fmt(d.mismatch)}</td>
            <td>${fmt(d.missing_log)}</td>
            <td>${fmt(d.extra_log)}</td>
            <td>${fmt(d.legacy)}</td>
            <td>${fmt(d.unknown)}</td>
          </tr>
        `;
      });
      byDateHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    const html = `<div class="overview-content">${overviewHeadersHtml + outcomeChipsHtml + diagnosisChipsHtml + byDateHtml}</div>`;
    const tableAreaEl = document.getElementById("tableArea");
    if (tableAreaEl) {
      // On narrow screens allow the outer area to scroll so users can reach
      // chips and the full breakdown; on wider screens keep outer overflow hidden
      // so the inner .bydate-wrapper handles table scrolling.
      // ensure tableArea is a flex container so .overview-content can flex-grow
      tableAreaEl.style.display = "flex";
      tableAreaEl.style.flexDirection = "column";
      tableAreaEl.innerHTML = html;
      // Adjust overflow based on available vertical space (and install resize observer)
      adjustTableAreaOverflow();
      installTableAreaResizeHandler();
    }

    // Attach chip click handlers
    document.querySelectorAll(".outcome-chip").forEach((chip) => {
      // Skip TOTAL chip - it's not a filter
      if (chip.dataset.status === "TOTAL") return;

      chip.addEventListener("click", () => {
        // clicking chip body applies status filter and clears problem filter
        state.statusFilter = [chip.dataset.status || null];
        state.problemFilter = null;
        updateMasterFiltersButtonState();
        switchTab("reconciliation");
      });
      // info icon inside chip (bind tooltip handlers)
      const info = chip.querySelector(".info-icon");
      if (info) {
        const title = chip.querySelector(".chip-label")?.textContent || "";
        const body =
          perOutcomeTooltipMap[info.dataset.tooltipKey] ||
          perOutcomeTooltipMap["OTHER"] ||
          "";
        bindTooltip(info, title, body);
      }
    });

    document.querySelectorAll(".diagnosis-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.problemFilter = [chip.dataset.problem || null];
        state.statusFilter = null;
        updateMasterFiltersButtonState();
        switchTab("reconciliation");
      });
      const info = chip.querySelector(".info-icon");
      if (info) {
        const title = chip.querySelector(".chip-label")?.textContent || "";
        const body =
          perDiagnosisTooltipMap[info.dataset.tooltipKey] ||
          perDiagnosisTooltipMap["OTHER"] ||
          "";
        bindTooltip(info, title, body);
      }
    });

    // Section info icons
    document.querySelectorAll(".section-info").forEach((si) => {
      const section = si.dataset.section;
      let title = "";
      let body = "";
      if (section === "outcome") {
        title = "Outcome (Recon Result)";
        body = outcomeTip;
      } else if (section === "diagnosis") {
        title = "Diagnosis (Reason)";
        body = diagnosisTip;
      } else if (section === "bydate") {
        title = "By Date Summary";
        body = "One row per day. Counts reflect Recon Status outcomes.";
      }
      if (title) bindTooltip(si, title, body);
    });

    // Drawer toggle handlers for narrow screens
    attachDrawerToggleHandlers();

    // By Date row click: jump to single-day reconciliation
    document.querySelectorAll(".bydate-row").forEach((tr) => {
      tr.addEventListener("click", () => {
        const dbDate = tr.dataset.date;
        if (!dbDate) return;
        setSingleDayRangeFromDBDate(dbDate);
        showToast("Drill-down: " + state.dateFrom, "info", 1200);
        resetPages();
        switchTab("reconciliation");
      });
    });

    // KPI grid removed; outcome chips handled via .outcome-chip

    // (old handlers removed; new chip and tooltip handlers attached above)

    // Quick actions moved to Reconciliation tab

    updateStatusBar(`Overview loaded: ${total} total records`);
  } catch (error) {
    showError(error.message);
  }
}

async function renderReconciliationTab() {
  showLoading();
  try {
    const result = await fetchReconciliationList(state.pageReconciliation);
    const data = result && result.rows ? result.rows : [];
    const totalCount =
      result && typeof result.total === "number" ? result.total : null;

    // store total for pagination guards
    state._totalReconciliation = totalCount;

    if (!data || data.length === 0) {
      showEmpty("No reconciliation records found");
      return;
    }

    // Compute total pages if we have a total count
    const totalPages = totalCount
      ? Math.max(1, Math.ceil(totalCount / state.pageSize))
      : null;

    // Build table HTML separately so we can place pagination above it
    const paginationHtml = renderReconciliationPagination(
      state.pageReconciliation,
      data.length,
      totalPages,
      "reconciliation",
    );

    let html = `
      <div class="table-top-row">
        <div style="flex:1 1 auto"></div>
        <div class="pagination-top">${paginationHtml}</div>
      </div>
        <div class="table-body-wrap">
        <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Batch</th>
            <th>Product</th>
            <th>Status</th>
            <th>Problem</th>
            <th>In Tally</th>
            <th>In Log</th>
            <th>Tally Packs</th>
            <th>Log Packs</th>
            <th>Breakdown Match</th>
            <th>Mapping</th>
          </tr>
        </thead>
        <tbody>
    `;

    // store current page rows in state and render each row with a safe index
    state._pageRows = data;
    data.forEach((row, idx) => {
      const mappingHtml = renderMappingDotsOnlyOk(row);

      html += `
        <tr class="reconciliation-row" data-idx="${idx}">
          <td>${escapeHtml(String(row.transfer_date || "—"))}</td>
          <td>${escapeHtml(row.batch_code || "—")}</td>
          <td>
            <div class="cell-main">${escapeHtml(getDisplayProductLabelForReconRow(row))}</div>
            ${getReconProductSubline(row) ? `<div class="cell-sub muted" style="font-size:12px;">${escapeHtml("Raw: " + getReconProductSubline(row))}</div>` : ""}
          </td>
          <td>${getStatusBadge(row.recon_status)}</td>
          <td>${getProblemBadge(row.problem_kind)}</td>
          <td>${getBoolIcon(row.exists_in_tally)}</td>
          <td>${getBoolIcon(row.exists_in_log)}</td>
          <td>${row.tally_total_packs || "—"}</td>
          <td>${row.log_total_packs || "—"}</td>
          <td>${getBoolIcon(row.is_exact_breakdown_match)}</td>
          <td style="font-size: 11px;">${mappingHtml}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      </div>
    `;

    const tableAreaEl = document.getElementById("tableArea");
    if (tableAreaEl) {
      tableAreaEl.style.overflowY = "visible";
      tableAreaEl.innerHTML = html;

      // Prev/Next use native browser `title` tooltips (no custom tooltip)
    }

    // Attach row click listeners using safe index lookup
    document.querySelectorAll(".reconciliation-row").forEach((row) => {
      row.addEventListener("click", async () => {
        const idx = Number(row.dataset.idx);
        const rowData = Array.isArray(state._pageRows)
          ? state._pageRows[idx]
          : null;
        if (!rowData) return;
        await openReconciliationInspector(rowData);
      });
    });

    // Quick Actions removed from UI — no listeners to attach

    // Attach pagination listeners
    attachPaginationListeners("reconciliation");

    const reconDisplayCount =
      typeof totalCount === "number" && totalCount !== null
        ? totalCount
        : data.length;
    updateStatusBar(
      `${reconDisplayCount.toLocaleString()} reconciliation records`,
    );
    // Ensure overflow adjustments and resize handler are active
    installTableAreaResizeHandler();
    adjustTableAreaOverflow();
  } catch (error) {
    showError(error.message);
  }
}

async function openReconciliationInspector(rowData) {
  showToast("Loading details...", "info", 1000);

  try {
    const detail = await fetchReconciliationDetail(
      rowData.transfer_date,
      rowData.batch_code,
      rowData.product_id,
    );

    if (!detail) {
      showToast("No detail found", "error");
      return;
    }

    state.selectedRow = detail;
    state.inspectorTab = "summary";

    const titleProduct =
      detail.display_product_label ||
      detail.product_name ||
      detail.raw_item_hint ||
      detail.tally_item_hint ||
      (Array.isArray(detail.raw_item_names)
        ? detail.raw_item_names[0]
        : null) ||
      "—";
    const title = `${detail.batch_code} — ${titleProduct}`;
    const content = renderInspectorContent(detail);
    openModal(title, content);

    // Attach inspector tab listeners
    attachInspectorTabListeners();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderInspectorContent(detail) {
  // Summary header
  let html = `
    <div class="inspector-tabs">
      <button class="inspector-tab-btn active" data-inspector-tab="summary">Summary</button>
      <button class="inspector-tab-btn" data-inspector-tab="tally">Tally Breakdown</button>
      <button class="inspector-tab-btn" data-inspector-tab="dwl">DWL Breakdown</button>
      <button class="inspector-tab-btn" data-inspector-tab="fix">Fix Guidance</button>
    </div>
    <div id="inspectorTabContent">
  `;

  html += renderInspectorSummary(detail);
  html += "</div>";
  return html;
}

function renderInspectorSummary(detail) {
  const delta = (detail.tally_total_packs || 0) - (detail.log_total_packs || 0);
  const deltaClass = delta === 0 ? "" : delta > 0 ? "error" : "warning";

  const productLabel =
    detail.display_product_label ||
    detail.product_name ||
    detail.raw_item_hint ||
    detail.tally_item_hint ||
    firstRawName(detail.raw_item_names) ||
    "—";

  const rawLine =
    detail.problem_kind === "TALLY_UNMAPPED"
      ? detail.raw_item_hint ||
        detail.tally_item_hint ||
        formatRawNames(detail.raw_item_names)
      : "";
  let showInspectorRaw = false;
  try {
    showInspectorRaw =
      rawLine &&
      String(productLabel).trim().toLowerCase() !==
        String(rawLine).trim().toLowerCase();
  } catch {
    showInspectorRaw = !!rawLine;
  }

  return `
    <div class="summary-grid">
      <div class="summary-item">
        <label>Transfer Date</label>
        <div class="value">${detail.transfer_date}</div>
      </div>
      <div class="summary-item">
        <label>Batch Code</label>
        <div class="value">${escapeHtml(detail.batch_code)}</div>
      </div>
      <div class="summary-item">
        <label>Product</label>
        <div class="value">${escapeHtml(productLabel)}</div>
        ${showInspectorRaw ? `<div class="value muted" style="font-size:12px;">Raw: ${escapeHtml(rawLine)}</div>` : ""}
      </div>
      <div class="summary-item">
        <label>Recon Status</label>
        <div class="value">${getStatusBadge(detail.recon_status)}</div>
      </div>
      <div class="summary-item">
        <label>Problem Kind</label>
        <div class="value">${getProblemBadge(detail.problem_kind || "—")}</div>
      </div>
    </div>

    <div class="breakdown-section">
      <h4>Packs Comparison</h4>
      <div class="summary-grid">
        <div class="summary-item">
          <label>Tally Total Packs</label>
          <div class="value">${detail.tally_total_packs || 0}</div>
        </div>
        <div class="summary-item">
          <label>DWL Total Packs</label>
          <div class="value">${detail.log_total_packs || 0}</div>
        </div>
        <div class="summary-item">
          <label>Delta</label>
          <div class="value ${deltaClass}">${delta > 0 ? "+" : ""}${delta}</div>
        </div>
      </div>
    </div>

    <div class="breakdown-section">
      <h4>Flags</h4>
      <div class="summary-grid">
        <div class="summary-item">
          <label>Exists in Tally</label>
          <div class="value">${getBoolIcon(detail.exists_in_tally)}</div>
        </div>
        <div class="summary-item">
          <label>Exists in Log</label>
          <div class="value">${getBoolIcon(detail.exists_in_log)}</div>
        </div>
        <div class="summary-item">
          <label>Exact Breakdown Match</label>
          <div class="value">${getBoolIcon(detail.is_exact_breakdown_match)}</div>
        </div>
        <div class="summary-item">
          <label>Product Mapped</label>
          <div class="value">${getBoolIcon(detail.is_product_mapped)}</div>
        </div>
        <div class="summary-item">
          <label>All SKU Mapped</label>
          <div class="value">${getBoolIcon(detail.all_sku_mapped)}</div>
        </div>
        <div class="summary-item">
          <label>All Godown Mapped</label>
          <div class="value">${getBoolIcon(detail.all_godown_mapped)}</div>
        </div>
        <div class="summary-item">
          <label>All Lines SKU Mapped</label>
          <div class="value">${getBoolIcon(detail.all_lines_sku_mapped)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderInspectorTally(detail) {
  let html = '<div class="breakdown-section"><h4>Tally Breakdown Lines</h4>';
  if (
    detail.tally_breakdown_lines &&
    Array.isArray(detail.tally_breakdown_lines)
  ) {
    if (detail.tally_breakdown_lines.length === 0) {
      html += "<p>No breakdown lines available</p>";
    } else {
      html += `
        <div class="breakdown-table-wrap">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>SKU Label</th>
                <th>Qty</th>
                <th>UOM</th>
                <th>Qty (Base)</th>
                <th>Base Unit</th>
                <th>Amount</th>
                <th>Per Pack</th>
              </tr>
            </thead>
            <tbody>
      `;
      detail.tally_breakdown_lines.forEach((line) => {
        const qty =
          typeof line.qty === "number"
            ? line.qty.toLocaleString()
            : line.qty || "—";
        const qtyBase =
          typeof line.qty_base === "number"
            ? line.qty_base.toLocaleString()
            : line.qty_base || "—";
        const amount =
          typeof line.amount === "number"
            ? line.amount.toLocaleString()
            : line.amount || "—";
        const perPack =
          typeof line.amount_per_pack_raw === "number"
            ? line.amount_per_pack_raw.toLocaleString()
            : line.amount_per_pack_raw || "—";
        html += `
          <tr>
            <td>${escapeHtml(line.sku_label || "—")}</td>
            <td>${qty}</td>
            <td>${escapeHtml(line.uom || "—")}</td>
            <td>${qtyBase}</td>
            <td>${escapeHtml(line.uom_base || "—")}</td>
            <td>${amount}</td>
            <td>${perPack}</td>
          </tr>
        `;
      });
      html += `
            </tbody>
          </table>
        </div>
      `;
    }
  } else {
    html += "<p>No breakdown available</p>";
  }
  html += "</div>";

  html += '<div class="breakdown-section"><h4>By SKU ID</h4>';
  if (
    detail.tally_breakdown_by_skuid &&
    typeof detail.tally_breakdown_by_skuid === "object"
  ) {
    const entries = Object.entries(detail.tally_breakdown_by_skuid);
    if (entries.length === 0) {
      html += "<p>No SKU breakdown available</p>";
    } else {
      html += '<div class="breakdown-cards">';
      entries.forEach(([skuId, qty]) => {
        const formattedQty =
          typeof qty === "number" ? qty.toLocaleString() : String(qty || "—");
        html += `
          <div class="breakdown-card">
            <div class="card-label">SKU ID: ${escapeHtml(skuId)}</div>
            <div class="card-value">${formattedQty}</div>
          </div>
        `;
      });
      html += "</div>";
    }
  } else {
    html += "<p>No breakdown available</p>";
  }
  html += "</div>";

  html += '<div class="breakdown-section"><h4>By Godown</h4>';
  if (
    detail.tally_breakdown_by_godown &&
    typeof detail.tally_breakdown_by_godown === "object"
  ) {
    const entries = Object.entries(detail.tally_breakdown_by_godown);
    if (entries.length === 0) {
      html += "<p>No godown breakdown available</p>";
    } else {
      html += '<div class="breakdown-cards">';
      entries.forEach(([godown, qty]) => {
        const formattedQty =
          typeof qty === "number" ? qty.toLocaleString() : String(qty || "—");
        const displayGodown =
          godown === "NULL_GODOWN" ? "Unmapped Godown" : escapeHtml(godown);
        html += `
          <div class="breakdown-card">
            <div class="card-label">${displayGodown}</div>
            <div class="card-value">${formattedQty}</div>
          </div>
        `;
      });
      html += "</div>";
    }
  } else {
    html += "<p>No breakdown available</p>";
  }
  html += "</div>";

  html += '<div class="breakdown-section"><h4>By Store</h4>';
  if (
    detail.tally_breakdown_by_store &&
    typeof detail.tally_breakdown_by_store === "object"
  ) {
    const entries = Object.entries(detail.tally_breakdown_by_store);
    if (entries.length === 0) {
      html += "<p>No store breakdown available</p>";
    } else {
      html += '<div class="breakdown-cards">';
      entries.forEach(([store, qty]) => {
        const formattedQty =
          typeof qty === "number" ? qty.toLocaleString() : String(qty || "—");
        html += `
          <div class="breakdown-card">
            <div class="card-label">${escapeHtml(store)}</div>
            <div class="card-value">${formattedQty}</div>
          </div>
        `;
      });
      html += "</div>";
    }
  } else {
    html += "<p>No breakdown available</p>";
  }
  html += "</div>";

  return html;
}

function renderInspectorDwl(detail) {
  let html = '<div class="breakdown-section"><h4>DWL Breakdown Lines</h4>';
  if (detail.log_breakdown_lines && Array.isArray(detail.log_breakdown_lines)) {
    if (detail.log_breakdown_lines.length === 0) {
      html += "<p>No breakdown lines available</p>";
    } else {
      html += `
        <div class="breakdown-table-wrap">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>SKU Label</th>
                <th>Qty</th>
                <th>UOM</th>
                <th>Qty (Base)</th>
                <th>Base Unit</th>
                <th>Amount</th>
                <th>Per Pack</th>
              </tr>
            </thead>
            <tbody>
      `;
      detail.log_breakdown_lines.forEach((line) => {
        const qty =
          typeof line.qty === "number"
            ? line.qty.toLocaleString()
            : line.qty || "—";
        const qtyBase =
          typeof line.qty_base === "number"
            ? line.qty_base.toLocaleString()
            : line.qty_base || "—";
        const amount =
          typeof line.amount === "number"
            ? line.amount.toLocaleString()
            : line.amount || "—";
        const perPack =
          typeof line.amount_per_pack_raw === "number"
            ? line.amount_per_pack_raw.toLocaleString()
            : line.amount_per_pack_raw || "—";
        html += `
          <tr>
            <td>${escapeHtml(line.sku_label || "—")}</td>
            <td>${qty}</td>
            <td>${escapeHtml(line.uom || "—")}</td>
            <td>${qtyBase}</td>
            <td>${escapeHtml(line.uom_base || "—")}</td>
            <td>${amount}</td>
            <td>${perPack}</td>
          </tr>
        `;
      });
      html += `
            </tbody>
          </table>
        </div>
      `;
    }
  } else {
    html += "<p>No breakdown available</p>";
  }
  html += "</div>";

  html += '<div class="breakdown-section"><h4>By SKU ID</h4>';
  if (
    detail.log_breakdown_by_skuid &&
    typeof detail.log_breakdown_by_skuid === "object"
  ) {
    const entries = Object.entries(detail.log_breakdown_by_skuid);
    if (entries.length === 0) {
      html += "<p>No SKU breakdown available</p>";
    } else {
      html += '<div class="breakdown-cards">';
      entries.forEach(([skuId, qty]) => {
        const formattedQty =
          typeof qty === "number" ? qty.toLocaleString() : String(qty || "—");
        html += `
          <div class="breakdown-card">
            <div class="card-label">SKU ID: ${escapeHtml(skuId)}</div>
            <div class="card-value">${formattedQty}</div>
          </div>
        `;
      });
      html += "</div>";
    }
  } else {
    html += "<p>No breakdown available</p>";
  }
  html += "</div>";

  html += '<div class="breakdown-section"><h4>DWL Metadata</h4>';
  html += `
    <div class="summary-grid">
      <div class="summary-item">
        <label>DWL ID</label>
        <div class="value">${detail.any_dwl_id || "—"}</div>
      </div>
      <div class="summary-item">
        <label>Row Count</label>
        <div class="value">${detail.dwl_row_count || 0}</div>
      </div>
      <div class="summary-item">
        <label>Status</label>
        <div class="value">${escapeHtml(detail.log_status || "—")}</div>
      </div>
      <div class="summary-item">
        <label>Completed On</label>
        <div class="value">${detail.log_completed_on || "—"}</div>
      </div>
      <div class="summary-item">
        <label>Uploaded By</label>
        <div class="value">${escapeHtml(detail.log_uploaded_by || "—")}</div>
      </div>
      <div class="summary-item">
        <label>Created At</label>
        <div class="value">${detail.log_created_at || "—"}</div>
      </div>
    </div>
  `;
  html += "</div>";

  return html;
}

function renderInspectorFix(detail) {
  const problem = detail.problem_kind;
  let html = '<div class="breakdown-section"><h4>Fix Guidance</h4>';

  if (problem === "TALLY_UNMAPPED") {
    html += `
      <p>Some items in Tally are not mapped to SKUs or godowns.</p>
      <div class="action-buttons">
        <button class="action-btn" data-fix-action="goto-normalized">
          Open Normalized Lines (filtered)
        </button>
      </div>
    `;
  } else if (problem === "LOG_UNMAPPED") {
    html += `
      <p>Some items in DWL are not mapped to SKUs.</p>
      <div class="action-buttons">
        <button class="action-btn" data-fix-action="goto-dwl-events">
          Open DWL Events (filtered)
        </button>
      </div>
    `;
  } else if (problem === "LOG_MISSING") {
    html += `
      <p>This transfer exists in Tally but not in DWL. Consider creating a DWL entry.</p>
      <ol>
        <li>Navigate to DWL entry form</li>
        <li>Enter batch: ${escapeHtml(detail.batch_code)}</li>
        <li>Enter date: ${detail.transfer_date}</li>
        <li>Enter breakdown matching Tally</li>
      </ol>
    `;
  } else if (problem === "TALLY_MISSING") {
    html += `
      <p>This transfer exists in DWL but not in Tally. Verify Tally pipeline and godown mapping.</p>
      <ol>
        <li>Check Tally import logs for date: ${detail.transfer_date}</li>
        <li>Verify godown mapping configuration</li>
        <li>Ensure batch code is consistent: ${escapeHtml(
          detail.batch_code,
        )}</li>
      </ol>
    `;
  } else if (problem === "BREAKDOWN_MISMATCH") {
    html += `
      <p>The total packs match, but the breakdown by SKU differs.</p>
      <div class="action-buttons">
        <button class="action-btn" data-fix-action="compare-breakdowns">
          Compare Breakdowns Side-by-Side
        </button>
      </div>
    `;
  } else if (problem === "MATCHED_OK") {
    html += `<p>✅ No issues detected. Everything is reconciled.</p>`;
  } else {
    html += `<p>No specific guidance available for: ${escapeHtml(
      problem || "UNKNOWN",
    )}</p>`;
  }

  html += "</div>";
  return html;
}

function attachInspectorTabListeners() {
  document.querySelectorAll(".inspector-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.inspectorTab;
      state.inspectorTab = tab;

      // Update active state
      document.querySelectorAll(".inspector-tab-btn").forEach((b) => {
        b.classList.remove("active");
      });
      btn.classList.add("active");

      // Render content
      const content = document.getElementById("inspectorTabContent");
      if (!content || !state.selectedRow) return;

      if (tab === "summary") {
        content.innerHTML = renderInspectorSummary(state.selectedRow);
      } else if (tab === "tally") {
        content.innerHTML = renderInspectorTally(state.selectedRow);
      } else if (tab === "dwl") {
        content.innerHTML = renderInspectorDwl(state.selectedRow);
      } else if (tab === "fix") {
        content.innerHTML = renderInspectorFix(state.selectedRow);
        attachFixActionListeners();
      }
    });
  });
}

function attachFixActionListeners() {
  document.querySelectorAll("[data-fix-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.fixAction;
      if (action === "goto-normalized") {
        closeModal();
        // Use master-filter selection instead of per-tab flag
        state.problemFilter = ["TALLY_UNMAPPED"];
        resetPages();
        updateMasterFiltersButtonState();
        switchTab("normalized-lines");
      } else if (action === "goto-dwl-events") {
        closeModal();
        // Use master-filter selection so DWL tab respects global filters
        state.problemFilter = ["LOG_UNMAPPED"];
        state.statusFilter = null;
        resetPages();
        updateMasterFiltersButtonState();
        switchTab("dwl-events");
      } else if (action === "compare-breakdowns") {
        // Could open a side-by-side comparison view
        showToast("Comparison feature coming soon", "info");
      }
    });
  });
}

async function renderTallyEventsTab() {
  showLoading();
  try {
    const result = await fetchTallyEvents(state.pageTallyEvents);
    const data = result && result.rows ? result.rows : [];
    const totalCount =
      result && typeof result.total === "number" ? result.total : null;

    // store total for pagination guards
    state._totalTallyEvents = totalCount;

    if (!data || data.length === 0) {
      showEmpty("No Tally events found");
      return;
    }

    const totalPages = totalCount
      ? Math.max(1, Math.ceil(totalCount / state.pageSize))
      : null;
    const paginationHtml = renderReconciliationPagination(
      state.pageTallyEvents,
      data.length,
      totalPages,
      "tally-events",
    );

    let html = `
      <div class="table-top-row">
        <div style="flex:1 1 auto"></div>
        <div class="pagination-top">${paginationHtml}</div>
      </div>
      <div class="table-body-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Batch</th>
            <th>Product</th>
            <th>Total Packs</th>
            <th>Total (Base)</th>
            <th>Base Unit</th>
            <th>SKU Mapped</th>
            <th>Godown Mapped</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((row) => {
      const productLabel = getDisplayProductLabelForTallyEvent(row) || "—";
      const rawVal =
        row.raw_item_hint || formatRawNames(row.raw_item_names) || "";
      let showRaw = false;
      try {
        showRaw =
          rawVal &&
          String(productLabel).trim().toLowerCase() !==
            String(rawVal).trim().toLowerCase();
      } catch {
        showRaw = !!rawVal;
      }

      html += `
        <tr>
          <td>${escapeHtml(String(row.transfer_date || "—"))}</td>
          <td>${escapeHtml(row.batch_code)}</td>
          <td>
            <div class="cell-main">${escapeHtml(productLabel)}</div>
            ${!row.product_name && showRaw ? `<div class="cell-sub muted" style="font-size:12px;">Raw: ${escapeHtml(rawVal)}</div>` : ""}
          </td>
          <td>${row.tally_total_packs || "—"}</td>
          <td>${row.tally_total_in_base || "—"}</td>
          <td>${escapeHtml(row.tally_uom_base_unit || "—")}</td>
          <td>${getBoolIcon(row.all_sku_mapped)}</td>
          <td>${getBoolIcon(row.all_godown_mapped)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    // Bottom paginator removed; top paginator (SVG) used for parity with Reconciliation tab.

    const tableAreaEl = document.getElementById("tableArea");
    if (tableAreaEl) {
      tableAreaEl.style.overflowY = "visible";
      tableAreaEl.innerHTML = html;
      installTableAreaResizeHandler();
      adjustTableAreaOverflow();
    }

    // (Removed: "Only Unmapped (SKU/Godown)" checkbox and wiring)

    attachPaginationListeners("tally-events");
    const displayCount =
      typeof totalCount === "number" && totalCount !== null
        ? totalCount
        : data.length;
    updateStatusBar(`${displayCount.toLocaleString()} Tally events`);
  } catch (error) {
    showError(error.message);
  }
}

async function renderDwlEventsTab() {
  showLoading();
  try {
    const data = await fetchDwlEvents(state.pageDwlEvents);

    if (!data || data.length === 0) {
      showEmpty("No DWL events found");
      return;
    }

    // Compute an exact total count for DWL events using a head/count query
    const from = formatDateForDB(state.dateFrom);
    const to = formatDateForDB(state.dateTo);
    let totalCount = null;
    try {
      let q = supabase
        .from("v_dwl_fg_transfer_event")
        .select("log_date", { count: "exact", head: true })
        .gte("log_date", from || "1900-01-01")
        .lte("log_date", to || "2100-01-01");

      if (state.searchText) {
        q = q.or(
          `batch_code.ilike.%${state.searchText}%,product_name.ilike.%${state.searchText}%`,
        );
      }
      const problemFilterIsArray = Array.isArray(state.problemFilter)
        ? state.problemFilter
        : [];
      const derivedOnlyUnmapped = problemFilterIsArray.includes("LOG_UNMAPPED");
      if (state.dwlEventsOnlyUnmapped || derivedOnlyUnmapped) {
        q = q.or("is_product_mapped.eq.false,all_lines_sku_mapped.eq.false");
      }
      if (state.dwlEventsOnlyNotDone) {
        q = q.neq("log_status", "Done");
      }

      const { count, error: countErr } = await q;
      if (!countErr && typeof count === "number") totalCount = count;
    } catch {
      // Count query failed; continue without exact total
    }

    // store total for pagination guards
    state._totalDwlEvents = totalCount;

    const totalPages = totalCount
      ? Math.max(1, Math.ceil(totalCount / state.pageSize))
      : null;
    const paginationHtml = renderReconciliationPagination(
      state.pageDwlEvents,
      data.length,
      totalPages,
      "dwl-events",
    );

    let html = `
      <div class="local-filters" style="margin:0;padding:0;display:flex;align-items:center;gap:12px;">
        <div class="toggle-item">
          <input type="checkbox" id="dwlOnlyNotDone" ${
            state.dwlEventsOnlyNotDone ? "checked" : ""
          } />
          <label for="dwlOnlyNotDone">Only Status != Done</label>
        </div>
        <div style="flex:1 1 auto"></div>
        <div class="pagination-top" style="margin-left:auto">${paginationHtml}</div>
      </div>
      <div class="table-body-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Batch</th>
            <th>Product</th>
            <th>Total Packs</th>
            <th>Product Mapped</th>
            <th>Lines SKU Mapped</th>
            <th>DWL ID</th>
            <th>Row Count</th>
            <th>Status</th>
            <th>Uploaded By</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((row) => {
      html += `
        <tr>
          <td>${escapeHtml(String(row.log_date || "—"))}</td>
          <td>${escapeHtml(row.batch_code)}</td>
          <td>${escapeHtml(row.product_name)}</td>
          <td>${row.log_total_packs || "—"}</td>
          <td>${getBoolIcon(row.is_product_mapped)}</td>
          <td>${getBoolIcon(row.all_lines_sku_mapped)}</td>
          <td>${row.any_dwl_id || "—"}</td>
          <td>${row.dwl_row_count || 0}</td>
          <td>${escapeHtml(row.log_status || "—")}</td>
          <td>${escapeHtml(row.log_uploaded_by || "—")}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    const tableAreaEl = document.getElementById("tableArea");
    if (tableAreaEl) {
      tableAreaEl.style.overflowY = "visible";
      tableAreaEl.innerHTML = html;
      installTableAreaResizeHandler();
      adjustTableAreaOverflow();
    }

    // Attach filter listeners
    const dwlNotDoneCheckbox = document.getElementById("dwlOnlyNotDone");
    if (dwlNotDoneCheckbox) {
      dwlNotDoneCheckbox.addEventListener("change", () => {
        state.dwlEventsOnlyNotDone = dwlNotDoneCheckbox.checked;
        state.pageDwlEvents = 1;
        renderDwlEventsTab();
      });
    }

    attachPaginationListeners("dwl-events");
    const infoCount =
      typeof totalCount === "number"
        ? `${totalCount} DWL events`
        : `${data.length} DWL events`;
    updateStatusBar(infoCount);
  } catch (error) {
    showError(error.message);
  }
}

async function renderNormalizedLinesTab() {
  showLoading();
  try {
    const data = await fetchNormalizedLines(state.pageNormalized);

    if (!data || data.length === 0) {
      showEmpty("No normalized lines found");
      return;
    }
    // Compute an exact total count for Normalized lines using a head/count query
    const from = formatDateForDB(state.dateFrom);
    const to = formatDateForDB(state.dateTo);
    let totalCount = null;
    try {
      let q = supabase
        .from("v_tally_fg_transfer_normalized")
        .select("transfer_date", { count: "exact", head: true })
        .gte("transfer_date", from || "1900-01-01")
        .lte("transfer_date", to || "2100-01-01");

      if (state.searchText) {
        q = q.or(
          `batch_code.ilike.%${state.searchText}%,product_name.ilike.%${state.searchText}%,item_name_raw.ilike.%${state.searchText}%`,
        );
      }
      const problemFilterIsArray = Array.isArray(state.problemFilter)
        ? state.problemFilter
        : [];
      const derivedOnlyUnmapped =
        problemFilterIsArray.includes("TALLY_UNMAPPED");
      if (derivedOnlyUnmapped) {
        q = q.or(
          "is_sku_mapped.eq.false,is_godown_mapped.eq.false,product_id.is.null",
        );
      }
      if (state.normalizedOnlyInactive) {
        q = q.eq("sku_is_active", false);
      }

      const { count, error: countErr } = await q;
      if (!countErr && typeof count === "number") totalCount = count;
    } catch {
      // Count query failed; continue without exact total
    }

    const totalPages = totalCount
      ? Math.max(1, Math.ceil(totalCount / state.pageSize))
      : null;
    const paginationHtml = renderReconciliationPagination(
      state.pageNormalized,
      data.length,
      totalPages,
      "normalized-lines",
    );

    // store total for pagination guards
    state._totalNormalized = totalCount;

    let html = `
      <div class="local-filters" style="margin:0;padding:0;display:flex;align-items:center;gap:12px;">
        <div class="toggle-item">
          <input type="checkbox" id="normalizedOnlyInactive" ${
            state.normalizedOnlyInactive ? "checked" : ""
          } />
          <label for="normalizedOnlyInactive">Only Inactive SKU</label>
        </div>
        <div style="flex:1 1 auto"></div>
        <div class="pagination-top" style="margin-left:auto">${paginationHtml}</div>
      </div>
      <div class="table-body-wrap">
      <table style="font-size: 12px;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Batch</th>
            <th>Store</th>
            <th>Godown</th>
            <th>Item Name (Raw)</th>
            <th>Qty Raw</th>
            <th>Unit Raw</th>
            <th>Unit Norm</th>
            <th>Qty Base</th>
            <th>Base Unit</th>
            <th>SKU ID</th>
            <th>SKU Label</th>
            <th>Pack Size</th>
            <th>SKU Mapped</th>
            <th>Godown Mapped</th>
            <th>Product</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((row) => {
      html += `
        <tr>
          <td>${escapeHtml(String(row.transfer_date || "—"))}</td>
          <td>${escapeHtml(row.batch_code)}</td>
          <td>${escapeHtml(row.transfer_store_raw || "—")}</td>
          <td>${escapeHtml(row.transfer_godown_code || "—")}</td>
          <td>${escapeHtml(row.item_name_raw)}</td>
          <td>${row.qty_value_raw || "—"}</td>
          <td>${escapeHtml(row.qty_unit_text_raw || "—")}</td>
          <td>${escapeHtml(row.qty_unit_norm || "—")}</td>
          <td>${row.qty_in_uom_base || "—"}</td>
          <td>${escapeHtml(row.qty_in_uom_base_unit || "—")}</td>
          <td>${row.sku_id || "—"}</td>
          <td>${escapeHtml(row.sku_label || "—")}</td>
          <td>${row.pack_size || "—"}</td>
          <td>${getBoolIcon(row.is_sku_mapped)}</td>
          <td>${getBoolIcon(row.is_godown_mapped)}</td>
          <td>${escapeHtml(row.product_name || "—")}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    const tableAreaEl = document.getElementById("tableArea");
    if (tableAreaEl) {
      tableAreaEl.style.overflowY = "visible";
      tableAreaEl.innerHTML = html;
      installTableAreaResizeHandler();
      adjustTableAreaOverflow();
    }

    // Attach filter listeners
    const normalizedInactiveCheckbox = document.getElementById(
      "normalizedOnlyInactive",
    );
    if (normalizedInactiveCheckbox) {
      normalizedInactiveCheckbox.addEventListener("change", () => {
        state.normalizedOnlyInactive = normalizedInactiveCheckbox.checked;
        state.pageNormalized = 1;
        renderNormalizedLinesTab();
      });
    }

    attachPaginationListeners("normalized-lines");
    const infoCount =
      typeof totalCount === "number"
        ? `${totalCount} normalized lines`
        : `${data.length} normalized lines`;
    updateStatusBar(infoCount);
  } catch (error) {
    showError(error.message);
  }
}

async function renderFixQueueTab() {
  showLoading();
  try {
    const result = await fetchFixSuggestions(state.pageFixQueue);
    const data = result.rows || [];
    const totalCount = typeof result.total === "number" ? result.total : null;
    // store total for pagination guards
    state._totalFixQueue = totalCount;

    if (!data || data.length === 0) {
      showEmpty("No fix suggestions available");
      return;
    }

    // store fix suggestions in state for safe lookup
    state._fixSuggestions = data;

    const totalPages = totalCount
      ? Math.max(1, Math.ceil(totalCount / state.pageSize))
      : null;
    const paginationHtml = renderReconciliationPagination(
      state.pageFixQueue,
      data.length,
      totalPages,
      "fix-queue",
    );

    let html = `
      <div class="table-top-row">
        <div style="flex:1 1 auto"></div>
        <div class="pagination-top">${paginationHtml}</div>
      </div>
      <div class="table-body-wrap">
      <table>
        <thead>
          <tr>
            <th>Suggestion Kind</th>
            <th>Suggestion Key</th>
            <th>Rows</th>
            <th>First Date</th>
            <th>Last Date</th>
            <th>Sample Ref</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((row, idx) => {
      html += `
        <tr data-suggestion-idx="${idx}" style="cursor: pointer;">
          <td>${getProblemBadge(row.suggestion_kind)}</td>
          <td>${escapeHtml(row.suggestion_key)}</td>
          <td>${row.rows}</td>
          <td>${escapeHtml(String(row.first_date || "—"))}</td>
          <td>${escapeHtml(String(row.last_date || "—"))}</td>
          <td style="font-size: 11px;">${escapeHtml(row.sample_ref || "—")}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    const tableAreaEl = document.getElementById("tableArea");
    if (tableAreaEl) {
      tableAreaEl.style.overflowY = "visible";
      tableAreaEl.innerHTML = html;
      installTableAreaResizeHandler();
      adjustTableAreaOverflow();
    }

    // Attach click listeners to table rows so clicking a row applies the
    // suggestion filters (replaces the former per-row Apply button).
    document.querySelectorAll("tr[data-suggestion-idx]").forEach((rowEl) => {
      rowEl.addEventListener("click", () => {
        const idx = Number(rowEl.dataset.suggestionIdx);
        const suggestion = Array.isArray(state._fixSuggestions)
          ? state._fixSuggestions[idx]
          : null;
        if (!suggestion) return;
        applySuggestionFilters(suggestion);
        // Give quick feedback to the user
        try {
          showToast(
            `Applied filters for ${suggestion.suggestion_kind}`,
            "info",
            2200,
          );
        } catch {
          /* ignore toast errors */
        }
      });
    });

    attachPaginationListeners("fix-queue");
    const infoCount =
      typeof totalCount === "number"
        ? `${totalCount.toLocaleString()} fix suggestions`
        : `${data.length} fix suggestions`;
    updateStatusBar(infoCount);
  } catch (error) {
    showError(error.message);
  }
}

function applySuggestionFilters(suggestion) {
  const kind = suggestion.suggestion_kind;
  const key = suggestion.suggestion_key;

  if (kind === "TALLY_UNMAPPED") {
    // Route this through master filters so normalized tab respects global filter
    state.problemFilter = ["TALLY_UNMAPPED"];
    // Use sample_ref (human-friendly item name) when available — the
    // suggestion_key is an alias_key|uom string which may not match
    // normalized view search fields.
    state.searchText = suggestion.sample_ref || key || "";
    resetPages();
    updateMasterFiltersButtonState();
    switchTab("normalized-lines");
    // Reflect search text in the search input at the top
    try {
      const si = document.getElementById("search");
      if (si) si.value = state.searchText;
      const sc = document.getElementById("searchClear");
      if (sc)
        sc.style.display =
          state.searchText && state.searchText.trim() ? "flex" : "none";
    } catch {
      /* ignore DOM sync errors */
    }
  } else if (kind === "LOG_UNMAPPED") {
    state.problemFilter = ["LOG_UNMAPPED"];
    state.dwlEventsOnlyUnmapped = false;
    state.searchText = key;
    // Reflect search text in the search input at the top
    try {
      const si = document.getElementById("search");
      if (si) si.value = state.searchText;
      const sc = document.getElementById("searchClear");
      if (sc)
        sc.style.display =
          state.searchText && state.searchText.trim() ? "flex" : "none";
    } catch {
      /* ignore DOM sync errors */
    }
    resetPages();
    updateMasterFiltersButtonState();
    switchTab("dwl-events");
  } else if (kind === "BREAKDOWN_MISMATCH") {
    state.problemFilter = ["BREAKDOWN_MISMATCH"];
    state.searchText = key;
    try {
      const si = document.getElementById("search");
      if (si) si.value = state.searchText;
      const sc = document.getElementById("searchClear");
      if (sc)
        sc.style.display =
          state.searchText && state.searchText.trim() ? "flex" : "none";
    } catch {
      /* ignore DOM sync errors */
    }
    resetPages();
    updateMasterFiltersButtonState();
    switchTab("reconciliation");
  } else {
    showToast(`No filter action defined for: ${kind}`, "info");
  }
}

// =========================================================================
// PAGINATION
// =========================================================================

// Reconciliation-specific pagination: SVG-only prev/next buttons with tooltips
function renderReconciliationPagination(
  currentPage,
  dataLength,
  totalPages = null,
  tabName = "reconciliation",
) {
  const hasMore = dataLength >= state.pageSize;
  let pageLabel;
  if (totalPages && typeof totalPages === "number") {
    pageLabel = `Page ${currentPage} of ${totalPages}`;
  } else {
    pageLabel = `Page ${currentPage} (showing ${dataLength} rows)`;
  }

  const prevDisabled = currentPage === 1 ? "disabled" : "";
  const nextDisabled =
    totalPages && typeof totalPages === "number"
      ? currentPage >= totalPages
        ? "disabled"
        : ""
      : !hasMore
        ? "disabled"
        : "";

  // SVG icons kept minimal and accessible via aria-label; IDs namespaced per tab
  const prevId = `prevPage-${tabName}`;
  const nextId = `nextPage-${tabName}`;
  return `
    <div class="pagination svg-pagination">
      <button id="${prevId}" ${prevDisabled} class="svg-page-btn prev" aria-label="Previous page" title="Previous page">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="page-info">${pageLabel}</span>
      <button id="${nextId}" ${nextDisabled} class="svg-page-btn next" aria-label="Next page" title="Next page">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;
}

function attachPaginationListeners(tab) {
  const prevBtn = document.getElementById(`prevPage-${tab}`);
  const nextBtn = document.getElementById(`nextPage-${tab}`);

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (tab === "reconciliation" && state.pageReconciliation > 1) {
        state.pageReconciliation--;
        renderReconciliationTab();
      } else if (tab === "tally-events" && state.pageTallyEvents > 1) {
        state.pageTallyEvents--;
        renderTallyEventsTab();
      } else if (tab === "dwl-events" && state.pageDwlEvents > 1) {
        state.pageDwlEvents--;
        renderDwlEventsTab();
      } else if (tab === "normalized-lines" && state.pageNormalized > 1) {
        state.pageNormalized--;
        renderNormalizedLinesTab();
      } else if (tab === "fix-queue" && state.pageFixQueue > 1) {
        state.pageFixQueue--;
        renderFixQueueTab();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (tab === "reconciliation") {
        // guard using stored total when available
        const total = state._totalReconciliation;
        const totalPages = total
          ? Math.max(1, Math.ceil(total / state.pageSize))
          : null;
        if (totalPages && state.pageReconciliation >= totalPages) return;
        state.pageReconciliation++;
        renderReconciliationTab();
      } else if (tab === "tally-events") {
        const total = state._totalTallyEvents;
        const totalPages = total
          ? Math.max(1, Math.ceil(total / state.pageSize))
          : null;
        if (totalPages && state.pageTallyEvents >= totalPages) return;
        state.pageTallyEvents++;
        renderTallyEventsTab();
      } else if (tab === "dwl-events") {
        const total = state._totalDwlEvents;
        const totalPages = total
          ? Math.max(1, Math.ceil(total / state.pageSize))
          : null;
        if (totalPages && state.pageDwlEvents >= totalPages) return;
        state.pageDwlEvents++;
        renderDwlEventsTab();
      } else if (tab === "normalized-lines") {
        const total = state._totalNormalized;
        const totalPages = total
          ? Math.max(1, Math.ceil(total / state.pageSize))
          : null;
        if (totalPages && state.pageNormalized >= totalPages) return;
        state.pageNormalized++;
        renderNormalizedLinesTab();
      } else if (tab === "fix-queue") {
        const total = state._totalFixQueue;
        const totalPages = total
          ? Math.max(1, Math.ceil(total / state.pageSize))
          : null;
        if (totalPages && state.pageFixQueue >= totalPages) return;
        state.pageFixQueue++;
        renderFixQueueTab();
      }
    });
  }
}

// =========================================================================
// TAB SWITCHING
// =========================================================================

function switchTab(tabName) {
  state.currentTab = tabName;

  // Sync small-screen select if present
  const _tabSelect = document.getElementById("tabSelect");
  if (_tabSelect) _tabSelect.value = tabName;

  // Update active button
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  // Render tab content
  if (tabName === "overview") {
    // Only reset filters the first time user lands on Overview. Subsequent
    // visits should preserve the current filter set; explicit Reset Filters
    // action will perform a full reset.
    if (!state._overviewVisited) {
      // If user navigates to Overview initially, reset filters to defaults
      state.dateFrom = getDefaultFromDate();
      state.dateTo = getDefaultToDate();
      state.searchText = "";
      state.statusFilter = null;
      state.problemFilter = null;
      // Restore to the initial defaults captured at init()
      state.hideMatched =
        typeof state._initialHideMatched !== "undefined"
          ? state._initialHideMatched
          : true;
      state.hideLegacy =
        typeof state._initialHideLegacy !== "undefined"
          ? state._initialHideLegacy
          : true;
      // reset local tab filters
      state.tallyEventsOnlyUnmapped = false;
      state.tallyEventsOnlyNullGodown = false;
      state.dwlEventsOnlyUnmapped = false;
      state.dwlEventsOnlyNotDone = false;
      state.normalizedOnlyUnmapped = false;
      state.normalizedOnlyInactive = false;

      // Sync master filters modal working sets
      mfWorkingStatus = new Set();
      mfWorkingProblem = new Set();
      updateMasterFiltersButtonState();

      // Sync quick-toggle checkboxes to match the reset state
      try {
        const hideMatchedCheckbox = document.getElementById("hideMatched");
        if (hideMatchedCheckbox)
          hideMatchedCheckbox.checked = !!state.hideMatched;
        const hideLegacyCheckbox = document.getElementById("hideLegacy");
        if (hideLegacyCheckbox) hideLegacyCheckbox.checked = !!state.hideLegacy;
      } catch {
        /* ignore DOM sync errors */
      }

      // Update UI inputs (date range, search)
      const dateRangeInput = document.getElementById("dateRange");
      if (dateRangeInput) {
        dateRangeInput.value = `${state.dateFrom} to ${state.dateTo}`;
        if (dateRangeInput._flatpickr) {
          try {
            dateRangeInput._flatpickr.setDate(
              [state.dateFrom, state.dateTo],
              false,
            );
          } catch {
            // ignore if flatpickr parsing fails
          }
        }
      }
      const searchInput = document.getElementById("search");
      if (searchInput) searchInput.value = "";

      // Ensure the quick-toggle checkboxes reflect the reset defaults
      try {
        const hideMatchedCheckbox = document.getElementById("hideMatched");
        if (hideMatchedCheckbox)
          hideMatchedCheckbox.checked = !!state.hideMatched;
        const hideLegacyCheckbox = document.getElementById("hideLegacy");
        if (hideLegacyCheckbox) hideLegacyCheckbox.checked = !!state.hideLegacy;
      } catch {
        /* ignore DOM sync errors */
      }

      // Reset pagination
      resetPages();

      renderOverviewTab();
      state._overviewVisited = true;
    } else {
      // Preserve filters: just render current overview
      renderOverviewTab();
    }
  } else if (tabName === "reconciliation") {
    renderReconciliationTab();
  } else if (tabName === "tally-events") {
    renderTallyEventsTab();
  } else if (tabName === "dwl-events") {
    renderDwlEventsTab();
  } else if (tabName === "normalized-lines") {
    renderNormalizedLinesTab();
  } else if (tabName === "fix-queue") {
    renderFixQueueTab();
  }

  // Occasionally switching innerHTML-rich tabs can leave an unwanted text
  // selection active (user reports the entire tab text becomes highlighted).
  // Clear any accidental selection here so navigation feels clean.
  try {
    const sel = window.getSelection && window.getSelection();
    if (sel && typeof sel.removeAllRanges === "function" && sel.rangeCount) {
      sel.removeAllRanges();
    }
  } catch {
    /* ignore selection clearing errors */
  }
}

// =========================================================================
// EXPORT FUNCTIONALITY
// =========================================================================

async function exportCurrentTab() {
  showToast("Preparing export...", "info", 1000);

  try {
    let data = [];
    let filename = "fg-transfer-recon";

    if (state.currentTab === "overview") {
      showToast("Overview tab cannot be exported", "warning");
      return;
    } else if (state.currentTab === "reconciliation") {
      // Export full reconciliation using returned total from RPC
      const EXPORT_PAGE_SIZE = 500;
      const from = formatDateForDB(state.dateFrom);
      const to = formatDateForDB(state.dateTo);
      const statusArray = getFilteredStatusArray();
      const problemArray = getFilteredProblemArray();

      let offset = 0;
      let total = Infinity;
      const acc = [];
      while (offset < total) {
        const payload = {
          p_from: from,
          p_to: to,
          p_status: statusArray,
          p_problem: problemArray,
          p_search: state.searchText || null,
          p_limit: EXPORT_PAGE_SIZE,
          p_offset: offset,
        };
        const { data: pageData, error } = await supabase.rpc(
          "rpc_fg_transfer_recon_list_enriched",
          payload,
        );
        if (error) throw error;
        const pagePayload = pageData ?? { rows: [], total: 0 };
        const rows = Array.isArray(pagePayload.rows) ? pagePayload.rows : [];
        total = Number(pagePayload.total ?? 0);
        if (!rows || !rows.length) break;
        acc.push(...rows);
        offset += EXPORT_PAGE_SIZE;
      }
      data = acc.slice(0, 5000);
      filename = "fg-transfer-reconciliation.csv";
    } else if (state.currentTab === "tally-events") {
      // Export full tally events using returned total from RPC
      const EXPORT_PAGE_SIZE = 500;
      const from = formatDateForDB(state.dateFrom);
      const to = formatDateForDB(state.dateTo);
      const problemFilterIsArray = Array.isArray(state.problemFilter)
        ? state.problemFilter
        : [];
      const derivedOnlyUnmapped =
        problemFilterIsArray.includes("TALLY_UNMAPPED");

      let offset = 0;
      let total = Infinity;
      const acc = [];
      while (offset < total) {
        const payload = {
          p_from: from,
          p_to: to,
          p_only_unmapped: !!derivedOnlyUnmapped,
          p_search: state.searchText || null,
          p_limit: EXPORT_PAGE_SIZE,
          p_offset: offset,
        };
        const { data: pageData, error } = await supabase.rpc(
          "rpc_fg_transfer_tally_event_list",
          payload,
        );
        if (error) throw error;
        const pagePayload = pageData ?? { rows: [], total: 0 };
        const rows = Array.isArray(pagePayload.rows) ? pagePayload.rows : [];
        total = Number(pagePayload.total ?? 0);
        if (!rows || !rows.length) break;
        acc.push(...rows);
        offset += EXPORT_PAGE_SIZE;
      }
      data = acc.slice(0, 5000);
      filename = "tally-events.csv";
    } else if (state.currentTab === "dwl-events") {
      // Export full DWL events by paging the PostgREST select until empty
      const EXPORT_PAGE_SIZE = 500;
      let page = 1;
      const acc = [];
      while (acc.length < 5000) {
        const rows = await fetchDwlEvents(page, EXPORT_PAGE_SIZE);
        if (!rows || rows.length === 0) break;
        acc.push(...rows);
        if (rows.length < EXPORT_PAGE_SIZE) break;
        page++;
      }
      data = acc.slice(0, 5000);
      filename = "dwl-events.csv";
    } else if (state.currentTab === "normalized-lines") {
      // Export full Normalized lines by paging the PostgREST select until empty
      const EXPORT_PAGE_SIZE = 500;
      let page = 1;
      const acc = [];
      while (acc.length < 5000) {
        const rows = await fetchNormalizedLines(page, EXPORT_PAGE_SIZE);
        if (!rows || rows.length === 0) break;
        acc.push(...rows);
        if (rows.length < EXPORT_PAGE_SIZE) break;
        page++;
      }
      data = acc.slice(0, 5000);
      filename = "normalized-lines.csv";
    } else if (state.currentTab === "fix-queue") {
      // Export full fix suggestions using returned total from RPC
      const EXPORT_PAGE_SIZE = 500;
      const from = formatDateForDB(state.dateFrom);
      const to = formatDateForDB(state.dateTo);

      let offset = 0;
      let total = Infinity;
      const acc = [];
      while (offset < total) {
        const payload = {
          p_from: from,
          p_to: to,
          p_limit: EXPORT_PAGE_SIZE,
          p_offset: offset,
        };
        const { data: pageData, error } = await supabase.rpc(
          "rpc_fg_transfer_recon_fix_suggestions",
          payload,
        );
        if (error) throw error;
        const pagePayload = pageData ?? { rows: [], total: 0 };
        const rows = Array.isArray(pagePayload.rows) ? pagePayload.rows : [];
        total = Number(pagePayload.total ?? 0);
        if (!rows || !rows.length) break;
        acc.push(...rows);
        offset += EXPORT_PAGE_SIZE;
      }
      data = acc.slice(0, 5000);
      filename = "fix-suggestions.csv";
    }

    if (!data || data.length === 0) {
      showToast("No data to export", "warning");
      return;
    }

    // Convert to CSV
    const csv = convertToCSV(data);
    downloadCSV(csv, filename);

    if (data.length >= 5000) {
      showToast(`Exported ${data.length} rows (limit reached)`, "warning");
    } else {
      showToast(`Exported ${data.length} rows`, "success");
    }
  } catch (error) {
    showToast(`Export failed: ${error.message}`, "error");
  }
}

function convertToCSV(data) {
  if (!data || data.length === 0) return "";

  // RFC4180-safe CSV cell escaping
  function csvCell(v) {
    if (v === null || typeof v === "undefined") return "";

    // stringify objects/arrays safely
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);

    // remove/normalize newlines inside a cell (prevents row breaks in Excel)
    s = s.replace(/\r\n|\n|\r/g, " ");

    // escape quotes by doubling
    if (s.includes('"')) s = s.replace(/"/g, '""');

    // quote if it contains delimiter, quote, or newline
    if (/[",\n\r]/.test(s)) s = `"${s}"`;

    return s;
  }

  const headers = Object.keys(data[0]);
  const bom = "\ufeff"; // UTF-8 BOM for Excel

  const headerLine = headers.map(csvCell).join(",");
  const bodyLines = data.map((row) =>
    headers.map((h) => csvCell(row[h])).join(","),
  );

  // Use CRLF per RFC4180
  return bom + headerLine + "\r\n" + bodyLines.join("\r\n") + "\r\n";
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================================
// INITIALIZATION
// =========================================================================

async function initFilters() {
  // Initialize date range picker
  const dateRangeInput = document.getElementById("dateRange");
  if (dateRangeInput) {
    const fp = window.flatpickr;

    fp(dateRangeInput, {
      mode: "range",
      dateFormat: "d-m-Y",
      defaultDate: [state.dateFrom, state.dateTo],
      allowInput: true,
      clickOpens: true,
      onChange: function (selectedDates) {
        if (!selectedDates || !selectedDates.length) {
          state.dateFrom = getDefaultFromDate();
          state.dateTo = getDefaultToDate();
        } else if (selectedDates.length === 1) {
          state.dateFrom = formatDate(selectedDates[0]);
          state.dateTo = formatDate(selectedDates[0]);
        } else {
          state.dateFrom = formatDate(selectedDates[0]);
          state.dateTo = formatDate(selectedDates[1]);
        }
        resetPages();
        switchTab(state.currentTab);
      },
    });
  }

  // Initialize search input
  const searchInput = document.getElementById("search");
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.searchText = searchInput.value.trim();
        resetPages();
        // Don't call switchTab when already on Overview — switchTab(overview)
        // resets filters and will clear the input. Render the active tab
        // directly instead so the search field isn't reset.
        if (state.currentTab === "overview") {
          renderOverviewTab();
        } else {
          switchTab(state.currentTab);
        }
      }, 400);
    });
    // Clear-button functionality: show when input has content, hide otherwise
    const searchClear = document.getElementById("searchClear");
    let toggleSearchClear;
    if (searchClear) {
      toggleSearchClear = function () {
        if (searchInput.value && searchInput.value.trim()) {
          searchClear.style.display = "flex";
        } else {
          searchClear.style.display = "none";
        }
      };

      // initialize visibility
      toggleSearchClear();

      // keep clear button visibility in sync
      searchInput.addEventListener("input", toggleSearchClear);

      // clicking clear empties input and triggers same behavior as manual clear
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        // Update state and reload current tab without triggering overview reset
        state.searchText = "";
        resetPages();
        toggleSearchClear();
        if (state.currentTab === "overview") {
          renderOverviewTab();
        } else {
          switchTab(state.currentTab);
        }
      });
    }
  }

  // Status/problem multi-selects removed — managed via Master Filters modal

  // Initialize quick toggles
  const hideMatchedCheckbox = document.getElementById("hideMatched");
  if (hideMatchedCheckbox) {
    hideMatchedCheckbox.addEventListener("change", () => {
      state.hideMatched = hideMatchedCheckbox.checked;
      resetPages();
      switchTab(state.currentTab);
    });
  }

  const hideLegacyCheckbox = document.getElementById("hideLegacy");
  if (hideLegacyCheckbox) {
    hideLegacyCheckbox.addEventListener("change", () => {
      state.hideLegacy = hideLegacyCheckbox.checked;
      resetPages();
      switchTab(state.currentTab);
    });
  }
}

function resetPages() {
  state.pageReconciliation = 1;
  state.pageTallyEvents = 1;
  state.pageDwlEvents = 1;
  state.pageNormalized = 1;
  state.pageFixQueue = 1;
}

async function init() {
  // Check permission
  // Note: Permission checking should follow the same pattern as Stock & Purchase Explorer
  // For now, we'll assume access is granted. Add proper permission check if needed.
  // Required permission: "module:fg-transfer-reconciliation"

  // Initialize filters
  await initFilters();
  // Remember initial toggle defaults so the master-filters button does not
  // appear active on first load just because system defaults are "on".
  state._initialHideMatched = state.hideMatched;
  state._initialHideLegacy = state.hideLegacy;

  // Update master filters button state on load
  updateMasterFiltersButtonState();
  // Ensure the table-area resize/overflow handler is installed once
  installTableAreaResizeHandler();
  // (only once on init)

  // Attach tab listeners
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Small-screen tab selector (keeps behavior consistent with tabs)
  const tabSelect = document.getElementById("tabSelect");
  if (tabSelect) {
    // Sync initial value
    tabSelect.value = state.currentTab || "overview";
    tabSelect.addEventListener("change", () => {
      const val = tabSelect.value;
      switchTab(val);
    });
  }

  // Ensure the compact tab select is visible on narrow viewports even if
  // external CSS overrides the media query. Keep it in sync on resize.
  function syncTabSelectVisibility() {
    const sel = document.getElementById("tabSelect");
    if (!sel) return;
    if (window.innerWidth <= 520) sel.style.display = "block";
    else sel.style.display = "none";
  }
  // Initial sync and on resize (debounced)
  syncTabSelectVisibility();
  window.addEventListener(
    "resize",
    debounce(() => {
      syncTabSelectVisibility();
    }, 120),
  );

  // Attach header action listeners
  // Home navigation (platform-aware)
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn)
    homeBtn.addEventListener("click", () => {
      try {
        Platform.goHome();
      } catch {
        // Fallback for environments without Platform: use window.location
        try {
          window.location.href = "/index.html";
        } catch {
          /* ignore */
        }
      }
    });

  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportCurrentTab);
  }

  // Reset Filters button: restore defaults and navigate to Overview
  const resetBtn = document.getElementById("resetFiltersBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      // Close master filters modal if open
      const mfModal = qs("masterFiltersModal");
      if (mfModal && mfModal.classList.contains("open"))
        closeMasterFiltersModal();

      // Clear master-working sets
      try {
        mfWorkingStatus.clear();
        mfWorkingProblem.clear();
      } catch {
        /* ignore */
      }

      // Explicitly reset filter state to defaults (do not rely on switchTab
      // behavior because Overview will preserve filters after first visit).
      state.dateFrom = getDefaultFromDate();
      state.dateTo = getDefaultToDate();
      state.searchText = "";
      state.statusFilter = null;
      state.problemFilter = null;
      // Restore to initial defaults captured at init()
      state.hideMatched =
        typeof state._initialHideMatched !== "undefined"
          ? state._initialHideMatched
          : true;
      state.hideLegacy =
        typeof state._initialHideLegacy !== "undefined"
          ? state._initialHideLegacy
          : true;
      state.tallyEventsOnlyUnmapped = false;
      state.tallyEventsOnlyNullGodown = false;
      state.dwlEventsOnlyUnmapped = false;
      state.dwlEventsOnlyNotDone = false;
      state.normalizedOnlyUnmapped = false;
      state.normalizedOnlyInactive = false;

      mfWorkingStatus = new Set();
      mfWorkingProblem = new Set();
      updateMasterFiltersButtonState();

      // Also sync the quick-toggle checkboxes and dispatch change so any
      // listeners update immediately.
      try {
        const hideMatchedCheckbox = document.getElementById("hideMatched");
        if (hideMatchedCheckbox) {
          hideMatchedCheckbox.checked = !!state.hideMatched;
          try {
            hideMatchedCheckbox.dispatchEvent(
              new Event("change", { bubbles: true }),
            );
          } catch {
            void 0;
          }
        }
        const hideLegacyCheckbox = document.getElementById("hideLegacy");
        if (hideLegacyCheckbox) {
          hideLegacyCheckbox.checked = !!state.hideLegacy;
          try {
            hideLegacyCheckbox.dispatchEvent(
              new Event("change", { bubbles: true }),
            );
          } catch {
            void 0;
          }
        }
      } catch {
        /* ignore DOM sync errors */
      }

      // Update UI inputs
      const dateRangeInput = document.getElementById("dateRange");
      if (dateRangeInput) {
        dateRangeInput.value = `${state.dateFrom} to ${state.dateTo}`;
        if (dateRangeInput._flatpickr) {
          try {
            dateRangeInput._flatpickr.setDate(
              [state.dateFrom, state.dateTo],
              false,
            );
          } catch {
            /* ignore */
          }
        }
      }
      const searchInput = document.getElementById("search");
      if (searchInput) searchInput.value = "";

      // Reset pagination and re-render the active tab (do not force Overview)
      resetPages();
      if (state.currentTab === "overview") {
        // If already on Overview, render it and mark visited so subsequent
        // navigations don't auto-reset filters.
        state._overviewVisited = true;
        renderOverviewTab();
      } else {
        // Re-render the currently active tab so the user remains where they are
        switchTab(state.currentTab);
      }
      showToast("Filters reset to defaults", "info", 1200);
    });
  }

  // Master Filters button
  const masterBtn = qs("masterFiltersBtn");
  if (masterBtn) {
    masterBtn.addEventListener("click", openMasterFiltersModal);
  }

  // Attach modal close listener
  const modalClose = document.querySelector(".modal-close");
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  const modal = document.getElementById("detailModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Wire Master Filters modal controls
  const mfApplyBtn = qs("mfApplyBtn");
  if (mfApplyBtn) mfApplyBtn.addEventListener("click", applyMasterFilters);

  const mfClearBtn = qs("mfClearBtn");
  if (mfClearBtn) mfClearBtn.addEventListener("click", clearMasterFilters);

  const mfModal = qs("masterFiltersModal");
  if (mfModal) {
    mfModal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.mfClose === "true") {
        closeMasterFiltersModal();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mfModal.classList.contains("open")) {
        closeMasterFiltersModal();
      }
    });
  }

  // Initial render
  // Ensure master filters button reflects initial state
  updateMasterFiltersButtonState();
  switchTab("overview");
}

// Start the app
init();
