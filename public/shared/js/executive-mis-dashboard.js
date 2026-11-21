import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "executive-mis-dashboard";
const PLAN_WARNING_STATUS =
  "CURRENT_MONTH_PLAN_NOT_AVAILABLE_USING_NEXT_AVAILABLE_PLAN_MONTH";

let PERM_CAN_VIEW = false;
let DATA_REFRESH_TIME = null;
let ACTIVE_INFO_BUTTON = null;
let ACTIVE_POPOVER = null;
let POPOVER_OPENED_BY_HOVER = false;
let ACTIVE_TAB = "finance";
let FINANCE_FILTER = "payables";
let FINANCE_SEARCH = "";
let FINANCE_CURRENT_PAGE = 1;
let FINANCE_PAGE_SIZE = 25;
let FINANCE_TOTAL_ROWS = 0;
let FINANCE_ROWS = [];
let FINANCE_SUMMARY = null;
let FINANCE_LAST_FOCUS = null;
let FINANCE_IS_LOADING = false;
let FINANCE_ERROR = "";
let SALES_SEARCH = "";
let SALES_CURRENT_PAGE = 1;
let SALES_PAGE_SIZE = 25;
let SALES_TOTAL_ROWS = 0;
let SALES_ROWS = [];
let SALES_SUMMARY = null;
let SALES_IS_LOADING = false;
let SALES_ERROR = "";
let INVENTORY_FILTER = "all";
let INVENTORY_SEARCH = "";
let INVENTORY_CURRENT_PAGE = 1;
let INVENTORY_PAGE_SIZE = 25;
let INVENTORY_TOTAL_ROWS = 0;
let INVENTORY_ROWS = [];
let INVENTORY_SUMMARY = null;
let INVENTORY_IS_LOADING = false;
let INVENTORY_ERROR = "";
let FG_FILTER = "all";
let FG_SEARCH = "";
let FG_CURRENT_PAGE = 1;
let FG_PAGE_SIZE = 25;
let FG_TOTAL_ROWS = 0;
let FG_ROWS = [];
let FG_SUMMARY = null;
let FG_IS_LOADING = false;
let FG_ERROR = "";
let PRODUCTION_SUMMARY = null;
// Canonical G7 production value summary (server computed; the browser never derives a rupee figure).
// status: loading | ok | error | denied | expired | invalid
let PRODUCTION_VALUE = { status: "loading", data: null, message: "" };
let PRODUCTION_VALUE_MONTH = ""; // first of month, YYYY-MM-01 (IST); set on first use
let PRODUCTION_VALUE_ASOF = ""; // optional YYYY-MM-DD cutoff, "" = server default (today IST)

// ---------------------------------------------------------------------------
// Async request-state guards (MIS-C1).
// Every server query takes a token from beginRequest(key). Only the holder of
// the latest token for that key may touch state, DOM or the loading mask; an
// older completion is dropped. invalidateTabRequests() (tab switch / refresh)
// retires every in-flight tab query so none can repaint a different panel.
// ---------------------------------------------------------------------------
const REQUEST_SEQ = Object.create(null);
const TAB_REQUEST_KEYS = [
  "finance:summary",
  "finance:page",
  "finance:modal",
  "sales:summary",
  "sales:page",
  "inventory:summary",
  "inventory:page",
  "fg:summary",
  "fg:page",
  "production",
  "production:value",
];
let TAB_LOAD_COUNT = 0;
let ACTIVE_TAB_FAILED = false;

function beginRequest(key) {
  REQUEST_SEQ[key] = (REQUEST_SEQ[key] || 0) + 1;
  return REQUEST_SEQ[key];
}

function isLatestRequest(key, token) {
  return REQUEST_SEQ[key] === token;
}

function invalidateTabRequests() {
  TAB_REQUEST_KEYS.forEach((key) => beginRequest(key));
}

// A rejected/thrown request must still settle into the error state rather
// than leaving the loading mask up forever.
async function settle(promise) {
  try {
    return await promise;
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function errorMessage(error) {
  return (error && error.message) || "See console for details.";
}

// Re-render a toolbar after a page load, except while the user is typing in
// its search box: rebuilding it would steal focus and overwrite characters
// typed after the request was sent.
function renderToolbarUnlessTyping(searchInputId, renderFn) {
  if (document.activeElement?.id === searchInputId) return;
  renderFn();
}

function renderTableState(prefix, { loading, error, loadingText, emptyText, errorText, retryKey }) {
  if (loading) {
    return `<div class="${prefix}-status" role="status">${escapeHtml(loadingText)}</div>`;
  }
  if (error) {
    return `<div class="${prefix}-status error" role="alert">${escapeHtml(errorText)} ${escapeHtml(error)}${
      retryKey
        ? ` <button type="button" class="mis-retry-btn" data-mis-retry="${escapeHtml(retryKey)}">Retry</button>`
        : ""
    }</div>`;
  }
  return `<div class="${prefix}-empty">${escapeHtml(emptyText)}</div>`;
}

const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const kpiGrid = $("kpiGrid");
const refreshBtn = $("refreshBtn");
const lastRefreshed = $("lastRefreshed");
const planningNotice = $("planningNotice");
const detailTabs = $("detailTabs");
const detailTabSelect = $("detailTabSelect");
const tabPanel = $("tabPanel");
const financeModalOverlay = $("financeModalOverlay");
const financeModalTitle = $("financeModalTitle");
const financeModalSubtitle = $("financeModalSubtitle");
const financeModalContent = $("financeModalContent");
const financeModalClose = $("financeModalClose");

const DETAIL_TABS = [
  { id: "finance", label: "Finance" },
  { id: "sales", label: "Sales" },
  { id: "inventory", label: "Inventory" },
  { id: "finished-goods", label: "Finished Goods" },
  { id: "production", label: "Production" },
  { id: "alerts", label: "Alerts" },
];

function setStatus(message, type = "info") {
  if (!statusArea) return;
  statusArea.textContent = message;
  statusArea.className = `status ${type}`;
  statusArea.style.display = "block";
}

function clearStatus() {
  if (!statusArea) return;
  statusArea.textContent = "";
  statusArea.className = "status";
  statusArea.style.display = "none";
}

function formatCurrencyINR(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNumberIN(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(n);
}

function formatIntegerIN(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateIN(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatDateTimeIN(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(d);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d);
  const year = new Intl.DateTimeFormat("en-IN", { year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
  return `${day}-${month}-${year} ${time}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sourceText(value, label = "Source date") {
  return value ? `${label}: ${formatDateIN(value)}` : "";
}

function relativeTimeLabel(value) {
  if (!value) return "Not loaded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Data refreshed";
  const elapsedMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (elapsedMin < 1) return "Data refreshed";
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHr = Math.floor(elapsedMin / 60);
  if (elapsedHr < 24) return `${elapsedHr}h ago`;
  return `${Math.floor(elapsedHr / 24)}d ago`;
}

// Returns "granted" | "denied" | "error". Only the server-supplied can_view
// flag grants access; a failed lookup never opens the module.
async function loadPermissions(sessionUserId) {
  PERM_CAN_VIEW = false;
  let outcome = "error";
  try {
    const { data: perms, error: permsErr } = await supabase.rpc(
      "get_user_permissions",
      { p_user_id: sessionUserId },
    );
    if (!permsErr && Array.isArray(perms)) {
      const p = perms.find((r) => r && r.target === `module:${MODULE_ID}`);
      if (p) PERM_CAN_VIEW = !!p.can_view;
      outcome = PERM_CAN_VIEW ? "granted" : "denied";
    } else {
      console.warn(
        "[MIS] Permission RPC failed",
        permsErr || "unexpected non-array result",
      );
    }
  } catch (e) {
    console.warn("[MIS] Permission RPC failed", e);
  }
  return outcome;
}

function setPlanningNotice(row) {
  if (!planningNotice) return;
  if (row.planning_period_status !== PLAN_WARNING_STATUS) {
    planningNotice.hidden = true;
    planningNotice.textContent = "";
    return;
  }
  planningNotice.textContent = `Production plan notice: Current month production plan is not available. Showing next available planning month: ${formatDateIN(row.planning_month_start)}.`;
  planningNotice.hidden = false;
}

async function loadExecutiveSummary() {
  const tabLoadMarker = TAB_LOAD_COUNT;
  try {
    if (refreshBtn) refreshBtn.disabled = true;
    if (kpiGrid) kpiGrid.innerHTML = "";
    closeKpiPopover();
    setStatus("Loading executive summary...", "info");

    const { data, error } = await supabase
      .from("mv_mis_executive_summary")
      .select("*")
      .eq("mis_summary_id", 1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        setStatus("No MIS executive summary data is available.", "warning");
        return;
      }
      console.error("[MIS] mv_mis_executive_summary load failed", error);
      setStatus(
        `Failed to load executive summary. ${error.message || "See console for details."}`,
        "error",
      );
      return;
    }

    console.log("[MIS] Materialized View Row", data);

    if (!data) {
      setStatus("No MIS executive summary data is available.", "warning");
      return;
    }

    renderKpiCards(data);
    setPlanningNotice(data);
    DATA_REFRESH_TIME = data.mv_refreshed_at
      ? new Date(data.mv_refreshed_at)
      : null;
    updateFreshnessIndicator();
    clearStatus();
    // If the user switched tab while the summary was loading, that tab has
    // already fetched its own data; reloading it here would be a duplicate.
    if (TAB_LOAD_COUNT === tabLoadMarker) await loadActiveTab();
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function renderKpiCards(row) {
  if (!kpiGrid) return;

  const financialDate = sourceText(
    row.financial_position_date,
    "Financial position",
  );
  const salesDate = sourceText(row.sales_position_date, "Sales position");
  const inventoryDate = sourceText(
    row.report_generated_date,
    "Report generated",
  );
  const productionDate = sourceText(
    row.production_report_month_start,
    "Production month",
  );

  const cards = [
    {
      title: "Payables \u2014 Sundry Creditors",
      value: formatCurrencyINR(row.payables_sundry_creditors),
      note: "Outstanding balance under Sundry Creditors as per latest Tally outstanding snapshot.",
      source: financialDate,
      detail: "Financial liability position from Sundry Creditors.",
    },
    {
      title: "Receivables \u2014 Sundry Debtors",
      value: formatCurrencyINR(row.receivables_sundry_debtors),
      note: "Outstanding balance under Sundry Debtors as per latest Tally outstanding snapshot.",
      source: financialDate,
      detail: "Financial asset position from Sundry Debtors.",
    },
    {
      title: "Net Sundry Position",
      value: formatCurrencyINR(row.net_sundry_position),
      note: "Receivables minus Payables. Negative value means payables exceed receivables.",
      source: financialDate,
      detail: "Calculation: Sundry Debtors minus Sundry Creditors.",
      state: Number(row.net_sundry_position) < 0 ? "caution" : "",
    },
    {
      title: "Month-to-Date Sales",
      value: formatCurrencyINR(row.sales_value_month_to_date),
      note: "Sales from first day of the month up to latest available sales date.",
      source: salesDate,
      detail: "Month-to-date sales value for the current reporting month.",
    },
    {
      title: "Manufacturing Inventory Value",
      value: formatCurrencyINR(row.manufacturing_inventory_value),
      note: "Raw material, packing material, consumables, and fuel inventory value.",
      source: inventoryDate,
      detail: "Manufacturing-side stock value from the generated report.",
    },
    {
      title: "Finished Goods Inventory Value",
      value: formatCurrencyINR(row.fg_inventory_value_overall),
      note: "Finished goods stock value from Inside Kerala, Kozhikode, and Outside Kerala stock.",
      source: inventoryDate,
      detail:
        "Overall finished goods inventory value across included locations.",
    },
    {
      title: "Active Pipeline Batches",
      value: formatNumberIN(row.active_pipeline_batch_count),
      note: "Batches currently in Not Initiated, Work in Process, Finished Goods Bulk, or Bottled Stock stages.",
      source: productionDate,
      detail: "Count of active batches in the production pipeline.",
    },
    {
      title: "Work in Process Batches",
      value: formatNumberIN(row.work_in_process_batch_count),
      note: "Batches currently in Work in Process stage.",
      source: productionDate,
      detail: "Subset of active pipeline batches currently in WIP.",
    },
    {
      title: "Overdue Work in Process Batches",
      value: formatNumberIN(row.overdue_work_in_process_batch_count),
      note: "Work in Process batches running beyond the expected production window.",
      source: productionDate,
      detail: "Positive values need operational follow-up.",
      state:
        Number(row.overdue_work_in_process_batch_count) > 0 ? "caution" : "",
    },
    {
      title: "Transferred to Finished Goods Value",
      value: formatCurrencyINR(row.transferred_to_finished_goods_value),
      note: "Executive-summary snapshot of production value moved into finished goods. A separate source from the Production tab's Tally book figure; the two are not expected to match.",
      source: productionDate,
      detail: "Source: executive summary (materialized view). Compare with the Production tab's Tally book value only as a different basis.",
    },
  ];

  kpiGrid.innerHTML = cards
    .map((card, index) => {
      const info = encodeURIComponent(
        JSON.stringify({
          title: card.title,
          note: card.note,
          source: card.source,
          detail: card.detail,
        }),
      );
      return `
        <article class="kpi-card ${card.state || ""}">
          <div class="kpi-title">${escapeHtml(card.title)}</div>
          <div class="kpi-value">${escapeHtml(card.value)}</div>
          <button
            class="kpi-info-btn"
            type="button"
            aria-label="Show details for ${escapeHtml(card.title)}"
            aria-expanded="false"
            data-kpi-index="${index}"
            data-kpi-info="${info}"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
        </article>
      `;
    })
    .join("");
}

function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const detail = $("sc-status-detail");
  const label = lastRefreshed.querySelector(".sc-snapshot-label");

  if (!DATA_REFRESH_TIME) {
    lastRefreshed.className = lastRefreshed.className
      .replace(/snapshot-\w+/g, "")
      .trim();
    if (label) label.textContent = "Not loaded";
    if (detail) detail.textContent = "Not yet loaded";
    lastRefreshed.setAttribute("aria-label", "Data not yet loaded");
    return;
  }

  const elapsedMin = Math.floor(
    (Date.now() - DATA_REFRESH_TIME.getTime()) / 60000,
  );
  let statusClass = "snapshot-fresh";
  if (elapsedMin >= 60) {
    statusClass = "snapshot-stale";
  } else if (elapsedMin >= 15) {
    statusClass = "snapshot-warning";
  }

  const detailText = `Dashboard data refreshed at: ${formatDateTimeIN(DATA_REFRESH_TIME)}`;
  if (label) label.textContent = relativeTimeLabel(DATA_REFRESH_TIME);
  if (detail) detail.textContent = detailText;
  lastRefreshed.className =
    lastRefreshed.className.replace(/snapshot-\w+/g, "").trim() +
    " " +
    statusClass;
  lastRefreshed.setAttribute("aria-label", detailText);
}

function closeKpiPopover() {
  if (ACTIVE_INFO_BUTTON) {
    ACTIVE_INFO_BUTTON.setAttribute("aria-expanded", "false");
  }
  if (ACTIVE_POPOVER) {
    ACTIVE_POPOVER.remove();
  }
  ACTIVE_INFO_BUTTON = null;
  ACTIVE_POPOVER = null;
  POPOVER_OPENED_BY_HOVER = false;
}

function positionKpiPopover(button, popover) {
  const margin = 12;
  const rect = button.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - margin * 2);
  popover.style.width = `${width}px`;
  const height = popover.offsetHeight;
  let left = rect.right - width;
  let top = rect.bottom + 8;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  if (top + height > window.innerHeight - margin) {
    top = rect.top - height - 8;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function openKpiPopover(button, toggle = true) {
  const raw = button.getAttribute("data-kpi-info");
  if (!raw) return;

  let info;
  try {
    info = JSON.parse(decodeURIComponent(raw));
  } catch (e) {
    console.warn("[MIS] KPI popover parse failed", e);
    return;
  }

  if (ACTIVE_INFO_BUTTON === button && toggle) {
    // A click right after a hover-open pins the popover instead of
    // immediately closing the one the pointer just opened.
    if (POPOVER_OPENED_BY_HOVER) {
      POPOVER_OPENED_BY_HOVER = false;
      return;
    }
    closeKpiPopover();
    return;
  }
  if (ACTIVE_INFO_BUTTON === button) return;

  closeKpiPopover();

  const popover = document.createElement("div");
  popover.className = "kpi-popover";
  popover.setAttribute("role", "dialog");
  popover.innerHTML = `
    <div class="kpi-popover-title">${escapeHtml(info.title)}</div>
    <div class="kpi-popover-row">
      <span class="kpi-popover-label">Explanation</span>
      ${escapeHtml(info.note)}
    </div>
    ${
      info.source
        ? `<div class="kpi-popover-row"><span class="kpi-popover-label">Source date</span>${escapeHtml(info.source)}</div>`
        : ""
    }
    ${
      info.detail
        ? `<div class="kpi-popover-row"><span class="kpi-popover-label">Calculation / interpretation</span>${escapeHtml(info.detail)}</div>`
        : ""
    }
  `;
  document.body.appendChild(popover);
  button.setAttribute("aria-expanded", "true");
  ACTIVE_INFO_BUTTON = button;
  ACTIVE_POPOVER = popover;
  POPOVER_OPENED_BY_HOVER = !toggle;
  positionKpiPopover(button, popover);
}

function renderDetailTabs() {
  if (detailTabs) {
    detailTabs.innerHTML = DETAIL_TABS.map(
      (tab) => `
      <button
        type="button"
        class="pill ${tab.id === ACTIVE_TAB ? "active" : ""}"
        data-tab="${tab.id}"
        role="tab"
        aria-selected="${tab.id === ACTIVE_TAB ? "true" : "false"}"
      >
        ${escapeHtml(tab.label)}
      </button>
    `,
    ).join("");
  }

  if (detailTabSelect) {
    detailTabSelect.innerHTML = DETAIL_TABS.map(
      (tab) =>
        `<option value="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</option>`,
    ).join("");
    detailTabSelect.value = ACTIVE_TAB;
  }
}

function renderPlaceholderTab() {
  if (!tabPanel) return;
  tabPanel.innerHTML = `<div class="tab-placeholder">This section will be added in the next phase.</div>`;
}

// Single entry point for (re)loading the active tab. Retires every in-flight
// tab query first so a late response can never repaint the wrong panel.
function loadActiveTab() {
  TAB_LOAD_COUNT += 1;
  ACTIVE_TAB_FAILED = false;
  invalidateTabRequests();
  cancelPendingSearches();
  tabPanel?.classList.toggle("production-panel", ACTIVE_TAB === "production");
  if (ACTIVE_TAB === "finance") return loadFinanceTab();
  if (ACTIVE_TAB === "sales") return loadSalesTab();
  if (ACTIVE_TAB === "inventory") return loadInventoryTab();
  if (ACTIVE_TAB === "finished-goods") return loadFinishedGoodsTab();
  if (ACTIVE_TAB === "production") return loadProductionTab();
  renderPlaceholderTab();
  return Promise.resolve();
}

function renderActiveTab() {
  renderDetailTabs();
  return loadActiveTab();
}

// Choosing the tab that is already showing is a no-op (no duplicate request)
// unless its last load failed, in which case it acts as a retry.
function selectTab(tabId) {
  const next = tabId || "finance";
  if (next === ACTIVE_TAB && !ACTIVE_TAB_FAILED) {
    if (detailTabSelect) detailTabSelect.value = ACTIVE_TAB;
    return;
  }
  ACTIVE_TAB = next;
  renderActiveTab();
}

function setTableLoading(
  shellSelector,
  isLoading,
  message = "Loading data...",
) {
  const shell = document.querySelector(shellSelector);
  if (!shell) return;

  let mask = shell.querySelector(".table-loading-mask");

  if (isLoading) {
    if (!mask) {
      mask = document.createElement("div");
      mask.className = "table-loading-mask";
      mask.setAttribute("role", "status");
      shell.appendChild(mask);
    }

    mask.innerHTML = `
      <div class="table-loading-card">
        <span class="table-loading-spinner" aria-hidden="true"></span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
    mask.hidden = false;
    shell.setAttribute("aria-busy", "true");
  } else {
    if (mask) mask.hidden = true;
    shell.removeAttribute("aria-busy");
  }
}

async function loadFinanceTab() {
  if (!tabPanel) return;
  FINANCE_ROWS = [];
  FINANCE_TOTAL_ROWS = 0;
  FINANCE_IS_LOADING = true;
  FINANCE_ERROR = "";
  renderFinanceTab();

  // Summary and first page are independent; run them together so neither
  // waits on the other (same two queries as before, no extras).
  await Promise.all([loadFinanceSummary(), loadFinancePartyPage()]);
}

async function loadFinanceSummary() {
  const token = beginRequest("finance:summary");
  const summaryResult = await settle(
    supabase
      .from("v_mis_finance_tab_summary")
      .select("finance_scope_note")
      .single(),
  );
  if (!isLatestRequest("finance:summary", token)) return;

  if (summaryResult.error) {
    console.error("[MIS] Finance summary load failed", summaryResult.error);
  } else {
    FINANCE_SUMMARY = summaryResult.data || null;
    renderFinanceScopeNote();
  }
}

function renderFinanceTab() {
  if (!tabPanel) return;
  tabPanel.innerHTML = `
    <div id="financeScopeNote" class="finance-scope-note"></div>
    <div id="financeToolbar"></div>
    <div class="finance-table-shell">
      <div id="financePagination" class="finance-pagination"></div>
      <div id="financePartyTableWrap" class="finance-table-wrap"></div>
    </div>
  `;
  renderFinanceScopeNote();
  renderFinanceToolbar();
  renderFinancePartyTable();
  renderFinancePagination();
}

function renderFinanceScopeNote() {
  const note = $("financeScopeNote");
  if (!note) return;
  note.textContent = FINANCE_SUMMARY?.finance_scope_note || "";
  note.hidden = !FINANCE_SUMMARY?.finance_scope_note;
}

function renderFinanceToolbar() {
  const toolbar = $("financeToolbar");
  if (!toolbar) return;
  const activeFilterCount = FINANCE_FILTER === "all" ? 0 : 1;
  toolbar.innerHTML = `
    <div class="finance-toolbar">
      <div class="finance-search-wrap">
        <input
          id="financeSearch"
          type="text"
          value="${escapeHtml(FINANCE_SEARCH)}"
          placeholder="Search party or group"
          aria-label="Search party or group"
        />
        <button
          id="financeSearchClear"
          type="button"
          class="input-clear-btn"
          title="Clear search"
          aria-label="Clear search"
          style="${FINANCE_SEARCH ? "" : "display:none"}"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
          </svg>
        </button>
      </div>
      <div id="financeFilterWrapper" class="finance-filter-wrapper">
        <button
          id="financeFilterBtn"
          type="button"
          class="finance-filter-btn ${activeFilterCount ? "finance-filter-btn--active" : ""}"
          title="Filters"
          aria-label="Filters"
          aria-haspopup="true"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span class="finance-filter-badge" style="${activeFilterCount ? "" : "display:none"}">${activeFilterCount || ""}</span>
        </button>
        <div id="financeFilterDrawer" class="finance-filter-drawer" role="dialog" aria-label="Finance filters">
          <div class="finance-filter-section-title">Outstanding Group</div>
          <ul class="finance-filter-list">
            <li><label><input type="radio" name="financeFilter" value="payables" ${FINANCE_FILTER === "payables" ? "checked" : ""} /> Payables \u2014 Sundry Creditors</label></li>
            <li><label><input type="radio" name="financeFilter" value="receivables" ${FINANCE_FILTER === "receivables" ? "checked" : ""} /> Receivables \u2014 Sundry Debtors</label></li>
            <li><label><input type="radio" name="financeFilter" value="all" ${FINANCE_FILTER === "all" ? "checked" : ""} /> All</label></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

async function loadFinancePartyPage() {
  const token = beginRequest("finance:page");
  FINANCE_IS_LOADING = true;
  FINANCE_ERROR = "";
  if (!FINANCE_ROWS.length) renderFinancePartyTable();

  setTableLoading(".finance-table-shell", true, "Loading finance parties...");

  const { data, error } = await settle(
    supabase.rpc("get_mis_finance_party_page", {
      p_group_filter: FINANCE_FILTER,
      p_search: FINANCE_SEARCH,
      p_limit: FINANCE_PAGE_SIZE,
      p_offset: (FINANCE_CURRENT_PAGE - 1) * FINANCE_PAGE_SIZE,
    }),
  );

  // A newer query owns the state and the loading mask; drop this response.
  if (!isLatestRequest("finance:page", token)) return;

  setTableLoading(".finance-table-shell", false);
  FINANCE_IS_LOADING = false;

  if (error) {
    console.error("[MIS] Finance party page load failed", error);
    FINANCE_ROWS = [];
    FINANCE_TOTAL_ROWS = 0;
    FINANCE_ERROR = errorMessage(error);
    ACTIVE_TAB_FAILED = true;
    renderFinancePartyTable();
    renderFinancePagination();
    return;
  }

  if (Array.isArray(data)) {
    FINANCE_ROWS = data;
    const totalFromRow =
      FINANCE_ROWS[0]?.total_rows ?? FINANCE_ROWS[0]?.total_count;
    FINANCE_TOTAL_ROWS = Number(totalFromRow ?? FINANCE_ROWS.length) || 0;
  } else {
    FINANCE_ROWS = data?.rows || [];
    FINANCE_TOTAL_ROWS =
      Number(data?.total_rows ?? data?.total_count ?? FINANCE_ROWS.length) || 0;
  }
  renderToolbarUnlessTyping("financeSearch", renderFinanceToolbar);
  renderFinancePartyTable();
  renderFinancePagination();
}

function renderFinancePartyTable() {
  const wrap = $("financePartyTableWrap");
  if (!wrap) return;
  const rows = FINANCE_ROWS;

  if (!rows.length) {
    wrap.innerHTML = renderTableState("finance", {
      loading: FINANCE_IS_LOADING,
      error: FINANCE_ERROR,
      loadingText: "Loading parties...",
      emptyText: "No parties found for this scope.",
      errorText: "Failed to load finance parties.",
      retryKey: "finance",
    });
    return;
  }

  wrap.innerHTML = `
    <table class="finance-table">
      <thead>
        <tr>
          <th>Party</th>
          <th>Group</th>
          <th class="num">Bills</th>
          <th class="num">Outstanding</th>
          <th class="num">Signed Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row, index) => `
              <tr data-party-index="${index}" tabindex="0" aria-haspopup="dialog" aria-label="View outstanding bills for ${escapeHtml(row.party_name || "party")}">
                <td>${escapeHtml(row.party_name || "-")}</td>
                <td>${escapeHtml(row.mis_group_name || "-")}</td>
                <td class="num">${escapeHtml(formatIntegerIN(row.bill_count))}</td>
                <td class="num">${escapeHtml(formatCurrencyINR(row.outstanding_amount_mis_value))}</td>
                <td class="num">${escapeHtml(formatCurrencyINR(row.signed_outstanding_tally_value))}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll("tbody tr").forEach((tr) => {
    const open = () => {
      const row = rows[Number(tr.getAttribute("data-party-index"))];
      if (row) openFinancePartyDetails(row);
    };
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open();
      }
    });
  });
}

function renderFinancePagination() {
  const el = $("financePagination");
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(FINANCE_TOTAL_ROWS / FINANCE_PAGE_SIZE));
  const start = FINANCE_TOTAL_ROWS
    ? (FINANCE_CURRENT_PAGE - 1) * FINANCE_PAGE_SIZE + 1
    : 0;
  const end = Math.min(FINANCE_CURRENT_PAGE * FINANCE_PAGE_SIZE, FINANCE_TOTAL_ROWS);
  el.innerHTML = `
    <span class="finance-row-count">Showing ${formatIntegerIN(start)}-${formatIntegerIN(end)} of ${formatIntegerIN(FINANCE_TOTAL_ROWS)} parties</span>
    <div class="finance-page-controls">
      <button id="financePrevPage" class="icon-btn" type="button" title="Previous page" aria-label="Previous page" ${FINANCE_CURRENT_PAGE <= 1 ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6"></path>
        </svg>
      </button>
      <span>Page ${formatIntegerIN(FINANCE_CURRENT_PAGE)} / ${formatIntegerIN(totalPages)}</span>
      <button id="financeNextPage" class="icon-btn" type="button" title="Next page" aria-label="Next page" ${FINANCE_CURRENT_PAGE >= totalPages ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6"></path>
        </svg>
      </button>
    </div>
  `;
}

function setFinanceFilter(value) {
  FINANCE_FILTER = value || "payables";
  FINANCE_CURRENT_PAGE = 1;
  closeFinanceFilterDrawer();
  loadFinancePartyPage();
}

function setFinanceSearch(value) {
  const next = String(value || "").trim();
  if (next === FINANCE_SEARCH) return;
  FINANCE_SEARCH = next;
  FINANCE_CURRENT_PAGE = 1;
  loadFinancePartyPage();
}

function clearFinanceSearch() {
  FINANCE_SEARCH = "";
  FINANCE_CURRENT_PAGE = 1;
  renderFinanceToolbar();
  loadFinancePartyPage();
}

function goFinancePrevPage() {
  if (FINANCE_CURRENT_PAGE <= 1) return;
  FINANCE_CURRENT_PAGE -= 1;
  loadFinancePartyPage();
}

function goFinanceNextPage() {
  const totalPages = Math.max(1, Math.ceil(FINANCE_TOTAL_ROWS / FINANCE_PAGE_SIZE));
  if (FINANCE_CURRENT_PAGE >= totalPages) return;
  FINANCE_CURRENT_PAGE += 1;
  loadFinancePartyPage();
}

async function loadSalesTab() {
  if (!tabPanel) return;
  SALES_ROWS = [];
  SALES_TOTAL_ROWS = 0;
  SALES_IS_LOADING = true;
  SALES_ERROR = "";
  renderSalesTab();

  await Promise.all([loadSalesSummary(), loadSalesProductPage()]);
}

async function loadSalesSummary() {
  const token = beginRequest("sales:summary");
  const summaryResult = await settle(
    supabase.from("v_mis_sales_tab_summary").select("*").single(),
  );
  if (!isLatestRequest("sales:summary", token)) return;

  if (summaryResult.error) {
    console.error("[MIS] Sales summary load failed", summaryResult.error);
  } else {
    SALES_SUMMARY = summaryResult.data || null;
    renderSalesScopeNote();
  }
}

function renderSalesTab() {
  if (!tabPanel) return;
  tabPanel.innerHTML = `
    <div id="salesScopeNote" class="sales-scope-note"></div>
    <div id="salesToolbar"></div>
    <div class="sales-table-shell">
      <div id="salesPagination" class="sales-pagination"></div>
      <div id="salesProductTableWrap" class="sales-table-wrap"></div>
    </div>
  `;
  renderSalesScopeNote();
  renderSalesToolbar();
  renderSalesProductTable();
  renderSalesPagination();
}

function renderSalesScopeNote() {
  const note = $("salesScopeNote");
  if (!note) return;

  const s = SALES_SUMMARY || {};

  const periodLine = `
    Sales period: ${formatDateIN(s.month_start)} to ${formatDateIN(s.month_upto_date)}
    | Sales days: ${formatIntegerIN(s.sales_days_available_in_month)}
    | Products sold: ${formatIntegerIN(s.products_sold_month_to_date)}
    | SKUs sold: ${formatIntegerIN(s.skus_sold_month_to_date)}
  `;

  note.innerHTML = `
    <div class="sales-period-line">${escapeHtml(periodLine)}</div>
    ${
      s.sales_scope_note
        ? `<div class="sales-note-line">${escapeHtml(s.sales_scope_note)}</div>`
        : ""
    }
  `;
}

function renderSalesToolbar() {
  const toolbar = $("salesToolbar");
  if (!toolbar) return;
  toolbar.innerHTML = `
    <div class="sales-toolbar">
      <div class="sales-search-wrap">
        <input
          id="salesSearch"
          type="text"
          value="${escapeHtml(SALES_SEARCH)}"
          placeholder="Search product"
          aria-label="Search product"
        />
        <button
          id="salesSearchClear"
          type="button"
          class="input-clear-btn"
          title="Clear search"
          aria-label="Clear search"
          style="${SALES_SEARCH ? "" : "display:none"}"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

async function loadSalesProductPage() {
  const token = beginRequest("sales:page");
  SALES_IS_LOADING = true;
  SALES_ERROR = "";
  if (!SALES_ROWS.length) renderSalesProductTable();

  setTableLoading(".sales-table-shell", true, "Loading sales products...");

  const { data, error } = await settle(
    supabase.rpc("get_mis_sales_product_page", {
      p_search: SALES_SEARCH,
      p_limit: SALES_PAGE_SIZE,
      p_offset: (SALES_CURRENT_PAGE - 1) * SALES_PAGE_SIZE,
    }),
  );

  if (!isLatestRequest("sales:page", token)) return;

  setTableLoading(".sales-table-shell", false);
  SALES_IS_LOADING = false;

  if (error) {
    console.error("[MIS] Sales product page load failed", error);
    SALES_ROWS = [];
    SALES_TOTAL_ROWS = 0;
    SALES_ERROR = errorMessage(error);
    ACTIVE_TAB_FAILED = true;
    renderSalesProductTable();
    renderSalesPagination();
    return;
  }

  SALES_ROWS = Array.isArray(data) ? data : [];
  SALES_TOTAL_ROWS =
    Number(SALES_ROWS[0]?.total_rows ?? SALES_ROWS.length) || 0;

  renderToolbarUnlessTyping("salesSearch", renderSalesToolbar);
  renderSalesProductTable();
  renderSalesPagination();
}

function renderSalesProductTable() {
  const wrap = $("salesProductTableWrap");
  if (!wrap) return;

  if (!SALES_ROWS.length) {
    wrap.innerHTML = renderTableState("sales", {
      loading: SALES_IS_LOADING,
      error: SALES_ERROR,
      loadingText: "Preparing sales table...",
      emptyText: "No products found.",
      errorText: "Failed to load sales products.",
      retryKey: "sales",
    });
    return;
  }

  wrap.innerHTML = `
    <table class="sales-table">
      <thead>
        <tr>
          <th>Product</th>
          <th class="num">SKUs</th>
          <th class="num">MTD Sales</th>
          <th class="num">MTD Units</th>
          <th class="num">Latest Day Sales</th>
          <th class="num">Average Daily Sales</th>
        </tr>
      </thead>
      <tbody>
        ${SALES_ROWS.map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.product_name || "-")}</td>
              <td class="num">${escapeHtml(formatIntegerIN(row.sku_count))}</td>
              <td class="num">${escapeHtml(formatCurrencyINR(row.sales_value))}</td>
              <td class="num">${escapeHtml(formatNumberIN(row.sales_units))}</td>
              <td class="num">${escapeHtml(formatCurrencyINR(row.latest_day_sales_value))}</td>
              <td class="num">${escapeHtml(formatCurrencyINR(row.average_daily_sales_value))}</td>
            </tr>
          `,
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderSalesPagination() {
  const el = $("salesPagination");
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(SALES_TOTAL_ROWS / SALES_PAGE_SIZE));
  const start = SALES_TOTAL_ROWS
    ? (SALES_CURRENT_PAGE - 1) * SALES_PAGE_SIZE + 1
    : 0;
  const end = Math.min(SALES_CURRENT_PAGE * SALES_PAGE_SIZE, SALES_TOTAL_ROWS);
  el.innerHTML = `
    <span class="sales-row-count">Showing ${formatIntegerIN(start)}-${formatIntegerIN(end)} of ${formatIntegerIN(SALES_TOTAL_ROWS)} products</span>
    <div class="sales-page-controls">
      <button id="salesPrevPage" class="icon-btn" type="button" title="Previous page" aria-label="Previous page" ${SALES_CURRENT_PAGE <= 1 ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6"></path>
        </svg>
      </button>
      <span>Page ${formatIntegerIN(SALES_CURRENT_PAGE)} / ${formatIntegerIN(totalPages)}</span>
      <button id="salesNextPage" class="icon-btn" type="button" title="Next page" aria-label="Next page" ${SALES_CURRENT_PAGE >= totalPages ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6"></path>
        </svg>
      </button>
    </div>
  `;
}

function setSalesSearch(value) {
  const next = String(value || "").trim();
  if (next === SALES_SEARCH) return;
  SALES_SEARCH = next;
  SALES_CURRENT_PAGE = 1;
  loadSalesProductPage();
}

function clearSalesSearch() {
  SALES_SEARCH = "";
  SALES_CURRENT_PAGE = 1;
  renderSalesToolbar();
  loadSalesProductPage();
}

function goSalesPrevPage() {
  if (SALES_CURRENT_PAGE <= 1) return;
  SALES_CURRENT_PAGE -= 1;
  loadSalesProductPage();
}

function goSalesNextPage() {
  const totalPages = Math.max(1, Math.ceil(SALES_TOTAL_ROWS / SALES_PAGE_SIZE));
  if (SALES_CURRENT_PAGE >= totalPages) return;
  SALES_CURRENT_PAGE += 1;
  loadSalesProductPage();
}

async function loadInventoryTab() {
  if (!tabPanel) return;
  INVENTORY_ROWS = [];
  INVENTORY_TOTAL_ROWS = 0;
  INVENTORY_IS_LOADING = true;
  INVENTORY_ERROR = "";
  renderInventoryTab();

  await Promise.all([loadInventorySummary(), loadInventoryItemPage()]);
}

async function loadInventorySummary() {
  const token = beginRequest("inventory:summary");
  const summaryResult = await settle(
    supabase.from("v_mis_inventory_tab_summary").select("*").single(),
  );
  if (!isLatestRequest("inventory:summary", token)) return;

  if (summaryResult.error) {
    console.error("[MIS] Inventory summary load failed", summaryResult.error);
  } else {
    INVENTORY_SUMMARY = summaryResult.data || null;
    renderInventoryScopeNote();
  }
}

function renderInventoryTab() {
  if (!tabPanel) return;
  tabPanel.innerHTML = `
    <div id="inventoryScopeNote" class="inventory-scope-note"></div>
    <div id="inventoryToolbar"></div>
    <div class="inventory-table-shell">
      <div id="inventoryPagination" class="inventory-pagination"></div>
      <div id="inventoryItemTableWrap" class="inventory-table-wrap"></div>
    </div>
  `;
  renderInventoryScopeNote();
  renderInventoryToolbar();
  renderInventoryItemTable();
  renderInventoryPagination();
}

function renderInventoryScopeNote() {
  const note = $("inventoryScopeNote");
  if (!note) return;
  const s = INVENTORY_SUMMARY || {};
  const scopeLine = `Inventory items: ${formatIntegerIN(s.total_inventory_item_count)} | Raw Material: ${formatIntegerIN(s.raw_material_item_count)} | Packing Material: ${formatIntegerIN(s.packing_material_item_count)} | Consumables: ${formatIntegerIN(s.consumables_item_count)} | Fuel: ${formatIntegerIN(s.fuel_item_count)}`;
  note.innerHTML = `
    <div class="inventory-scope-line">${escapeHtml(scopeLine)}</div>
    ${
      s.inventory_scope_note
        ? `<div class="inventory-note-line">${escapeHtml(s.inventory_scope_note)}</div>`
        : ""
    }
  `;
}

function renderInventoryToolbar() {
  const toolbar = $("inventoryToolbar");
  if (!toolbar) return;
  const activeFilterCount = INVENTORY_FILTER === "all" ? 0 : 1;
  toolbar.innerHTML = `
    <div class="inventory-toolbar">
      <div class="inventory-search-wrap">
        <input
          id="inventorySearch"
          type="text"
          value="${escapeHtml(INVENTORY_SEARCH)}"
          placeholder="Search item, code, or classification"
          aria-label="Search item, code, or classification"
        />
        <button
          id="inventorySearchClear"
          type="button"
          class="input-clear-btn"
          title="Clear search"
          aria-label="Clear search"
          style="${INVENTORY_SEARCH ? "" : "display:none"}"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
          </svg>
        </button>
      </div>
      <div id="inventoryFilterWrapper" class="inventory-filter-wrapper">
        <button
          id="inventoryFilterBtn"
          type="button"
          class="inventory-filter-btn ${activeFilterCount ? "inventory-filter-btn--active" : ""}"
          title="Filters"
          aria-label="Filters"
          aria-haspopup="true"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span class="inventory-filter-badge" style="${activeFilterCount ? "" : "display:none"}">${activeFilterCount || ""}</span>
        </button>
        <div id="inventoryFilterDrawer" class="inventory-filter-drawer" role="dialog" aria-label="Inventory filters">
          <div class="inventory-filter-section-title">Inventory Type</div>
          <ul class="inventory-filter-list">
            <li><label><input type="radio" name="inventoryFilter" value="all" ${INVENTORY_FILTER === "all" ? "checked" : ""} /> All</label></li>
            <li><label><input type="radio" name="inventoryFilter" value="rm" ${INVENTORY_FILTER === "rm" ? "checked" : ""} /> Raw Material</label></li>
            <li><label><input type="radio" name="inventoryFilter" value="plm" ${INVENTORY_FILTER === "plm" ? "checked" : ""} /> Packing Material</label></li>
            <li><label><input type="radio" name="inventoryFilter" value="consumable" ${INVENTORY_FILTER === "consumable" ? "checked" : ""} /> Consumables</label></li>
            <li><label><input type="radio" name="inventoryFilter" value="fuel" ${INVENTORY_FILTER === "fuel" ? "checked" : ""} /> Fuel</label></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

async function loadInventoryItemPage() {
  const token = beginRequest("inventory:page");
  INVENTORY_IS_LOADING = true;
  INVENTORY_ERROR = "";
  if (!INVENTORY_ROWS.length) renderInventoryItemTable();

  setTableLoading(
    ".inventory-table-shell",
    true,
    "Loading inventory items...",
  );

  const { data, error } = await settle(
    supabase.rpc("get_mis_inventory_item_page", {
      p_source_kind: INVENTORY_FILTER,
      p_search: INVENTORY_SEARCH,
      p_limit: INVENTORY_PAGE_SIZE,
      p_offset: (INVENTORY_CURRENT_PAGE - 1) * INVENTORY_PAGE_SIZE,
    }),
  );

  if (!isLatestRequest("inventory:page", token)) return;

  setTableLoading(".inventory-table-shell", false);
  INVENTORY_IS_LOADING = false;

  if (error) {
    console.error("[MIS] Inventory item page load failed", error);
    INVENTORY_ROWS = [];
    INVENTORY_TOTAL_ROWS = 0;
    INVENTORY_ERROR = errorMessage(error);
    ACTIVE_TAB_FAILED = true;
    renderInventoryItemTable();
    renderInventoryPagination();
    return;
  }

  INVENTORY_ROWS = Array.isArray(data) ? data : [];
  INVENTORY_TOTAL_ROWS =
    Number(INVENTORY_ROWS[0]?.total_rows ?? INVENTORY_ROWS.length) || 0;

  renderToolbarUnlessTyping("inventorySearch", renderInventoryToolbar);
  renderInventoryItemTable();
  renderInventoryPagination();
}

function formatInventoryClassification(row) {
  return [
    row.category_label,
    row.subcategory_label,
    row.group_label,
    row.subgroup_label,
  ]
    .filter((value) => value != null && String(value).trim() !== "")
    .join(" › ");
}

function renderInventoryItemTable() {
  const wrap = $("inventoryItemTableWrap");
  if (!wrap) return;

  if (!INVENTORY_ROWS.length) {
    wrap.innerHTML = renderTableState("inventory", {
      loading: INVENTORY_IS_LOADING,
      error: INVENTORY_ERROR,
      loadingText: "Preparing inventory table...",
      emptyText: "No items found.",
      errorText: "Failed to load inventory items.",
      retryKey: "inventory",
    });
    return;
  }

  wrap.innerHTML = `
    <table class="inventory-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Item</th>
          <th>Type</th>
          <th class="num">Quantity</th>
          <th class="num">Average Rate</th>
          <th class="num">Stock Value</th>
          <th>Classification</th>
        </tr>
      </thead>
      <tbody>
        ${INVENTORY_ROWS.map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.code || "-")}</td>
              <td>${escapeHtml(row.item_name || "-")}</td>
              <td>${escapeHtml(row.source_label || "-")}</td>
              <td class="num">${escapeHtml(formatNumberIN(row.qty_value))}</td>
              <td class="num">${escapeHtml(formatCurrencyINR(row.avg_rate_value))}</td>
              <td class="num">${escapeHtml(formatCurrencyINR(row.stock_value))}</td>
              <td>${escapeHtml(formatInventoryClassification(row) || "-")}</td>
            </tr>
          `,
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderInventoryPagination() {
  const el = $("inventoryPagination");
  if (!el) return;
  const totalPages = Math.max(
    1,
    Math.ceil(INVENTORY_TOTAL_ROWS / INVENTORY_PAGE_SIZE),
  );
  const start = INVENTORY_TOTAL_ROWS
    ? (INVENTORY_CURRENT_PAGE - 1) * INVENTORY_PAGE_SIZE + 1
    : 0;
  const end = Math.min(
    INVENTORY_CURRENT_PAGE * INVENTORY_PAGE_SIZE,
    INVENTORY_TOTAL_ROWS,
  );
  el.innerHTML = `
    <span class="inventory-row-count">Showing ${formatIntegerIN(start)}-${formatIntegerIN(end)} of ${formatIntegerIN(INVENTORY_TOTAL_ROWS)} items</span>
    <div class="inventory-page-controls">
      <button id="inventoryPrevPage" class="icon-btn" type="button" title="Previous page" aria-label="Previous page" ${INVENTORY_CURRENT_PAGE <= 1 ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6"></path>
        </svg>
      </button>
      <span>Page ${formatIntegerIN(INVENTORY_CURRENT_PAGE)} / ${formatIntegerIN(totalPages)}</span>
      <button id="inventoryNextPage" class="icon-btn" type="button" title="Next page" aria-label="Next page" ${INVENTORY_CURRENT_PAGE >= totalPages ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6"></path>
        </svg>
      </button>
    </div>
  `;
}

function setInventoryFilter(value) {
  INVENTORY_FILTER = value || "all";
  INVENTORY_CURRENT_PAGE = 1;
  closeInventoryFilterDrawer();
  loadInventoryItemPage();
}

function setInventorySearch(value) {
  const next = String(value || "").trim();
  if (next === INVENTORY_SEARCH) return;
  INVENTORY_SEARCH = next;
  INVENTORY_CURRENT_PAGE = 1;
  loadInventoryItemPage();
}

function clearInventorySearch() {
  INVENTORY_SEARCH = "";
  INVENTORY_CURRENT_PAGE = 1;
  renderInventoryToolbar();
  loadInventoryItemPage();
}

function goInventoryPrevPage() {
  if (INVENTORY_CURRENT_PAGE <= 1) return;
  INVENTORY_CURRENT_PAGE -= 1;
  loadInventoryItemPage();
}

function goInventoryNextPage() {
  const totalPages = Math.max(
    1,
    Math.ceil(INVENTORY_TOTAL_ROWS / INVENTORY_PAGE_SIZE),
  );
  if (INVENTORY_CURRENT_PAGE >= totalPages) return;
  INVENTORY_CURRENT_PAGE += 1;
  loadInventoryItemPage();
}

async function loadFinishedGoodsTab() {
  if (!tabPanel) return;
  FG_ROWS = [];
  FG_TOTAL_ROWS = 0;
  FG_IS_LOADING = true;
  FG_ERROR = "";
  renderFinishedGoodsTab();

  await Promise.all([loadFinishedGoodsSummary(), loadFinishedGoodsSkuPage()]);
}

async function loadFinishedGoodsSummary() {
  const token = beginRequest("fg:summary");
  const summaryResult = await settle(
    supabase.from("v_mis_finished_goods_tab_summary").select("*").single(),
  );
  if (!isLatestRequest("fg:summary", token)) return;

  if (summaryResult.error) {
    console.error(
      "[MIS] Finished Goods summary load failed",
      summaryResult.error,
    );
  } else {
    FG_SUMMARY = summaryResult.data || null;
    renderFinishedGoodsScopeNote();
  }
}

function renderFinishedGoodsTab() {
  if (!tabPanel) return;
  tabPanel.innerHTML = `
    <div id="fgScopeNote" class="fg-scope-note"></div>
    <div id="fgToolbar"></div>
    <div class="fg-table-shell">
      <div id="fgPagination" class="fg-pagination"></div>
      <div id="fgSkuTableWrap" class="fg-table-wrap"></div>
    </div>
  `;
  renderFinishedGoodsScopeNote();
  renderFinishedGoodsToolbar();
  renderFinishedGoodsSkuTable();
  renderFinishedGoodsPagination();
}

function renderFinishedGoodsScopeNote() {
  const note = $("fgScopeNote");
  if (!note) return;
  const s = FG_SUMMARY || {};
  const scopeLine = `SKUs: ${formatIntegerIN(s.sku_count)} | Stock Value: ${formatCurrencyINR(s.stock_value_overall)} | Zero Stock: ${formatIntegerIN(s.zero_stock_sku_count)} | Below 1 Month: ${formatIntegerIN(s.below_1_month_cover_count)} | Above 6 Months: ${formatIntegerIN(s.above_6_month_cover_count)}`;
  note.innerHTML = `
    <div class="fg-scope-line">${escapeHtml(scopeLine)}</div>
    ${
      s.finished_goods_scope_note
        ? `<div class="fg-note-line">${escapeHtml(s.finished_goods_scope_note)}</div>`
        : ""
    }
  `;
}

function renderFinishedGoodsToolbar() {
  const toolbar = $("fgToolbar");
  if (!toolbar) return;
  const activeFilterCount = FG_FILTER === "all" ? 0 : 1;
  toolbar.innerHTML = `
    <div class="fg-toolbar">
      <div class="fg-search-wrap">
        <input
          id="fgSearch"
          type="text"
          value="${escapeHtml(FG_SEARCH)}"
          placeholder="Search SKU, item, or classification"
          aria-label="Search SKU, item, or classification"
        />
        <button
          id="fgSearchClear"
          type="button"
          class="input-clear-btn"
          title="Clear search"
          aria-label="Clear search"
          style="${FG_SEARCH ? "" : "display:none"}"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
          </svg>
        </button>
      </div>
      <div id="fgFilterWrapper" class="fg-filter-wrapper">
        <button
          id="fgFilterBtn"
          type="button"
          class="fg-filter-btn ${activeFilterCount ? "fg-filter-btn--active" : ""}"
          title="Filters"
          aria-label="Filters"
          aria-haspopup="true"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span class="fg-filter-badge" style="${activeFilterCount ? "" : "display:none"}">${activeFilterCount || ""}</span>
        </button>
        <div id="fgFilterDrawer" class="fg-filter-drawer" role="dialog" aria-label="Finished Goods filters">
          <div class="fg-filter-section-title">MOS Status</div>
          <ul class="fg-filter-list">
            <li><label><input type="radio" name="fgFilter" value="all" ${FG_FILTER === "all" ? "checked" : ""} /> All</label></li>
            <li><label><input type="radio" name="fgFilter" value="zero_stock" ${FG_FILTER === "zero_stock" ? "checked" : ""} /> Zero Stock</label></li>
            <li><label><input type="radio" name="fgFilter" value="below_1_month" ${FG_FILTER === "below_1_month" ? "checked" : ""} /> Below 1 Month</label></li>
            <li><label><input type="radio" name="fgFilter" value="one_to_three_months" ${FG_FILTER === "one_to_three_months" ? "checked" : ""} /> 1 to 3 Months</label></li>
            <li><label><input type="radio" name="fgFilter" value="above_6_months" ${FG_FILTER === "above_6_months" ? "checked" : ""} /> Above 6 Months</label></li>
            <li><label><input type="radio" name="fgFilter" value="normal" ${FG_FILTER === "normal" ? "checked" : ""} /> Normal</label></li>
            <li><label><input type="radio" name="fgFilter" value="shaded" ${FG_FILTER === "shaded" ? "checked" : ""} /> Same IK/OK MRP</label></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

async function loadFinishedGoodsSkuPage() {
  const token = beginRequest("fg:page");
  FG_IS_LOADING = true;
  FG_ERROR = "";
  if (!FG_ROWS.length) renderFinishedGoodsSkuTable();

  setTableLoading(".fg-table-shell", true, "Loading Finished Goods SKUs...");

  const { data, error } = await settle(
    supabase.rpc("get_mis_finished_goods_sku_page", {
      p_mos_filter: FG_FILTER,
      p_search: FG_SEARCH,
      p_limit: FG_PAGE_SIZE,
      p_offset: (FG_CURRENT_PAGE - 1) * FG_PAGE_SIZE,
    }),
  );

  if (!isLatestRequest("fg:page", token)) return;

  setTableLoading(".fg-table-shell", false);
  FG_IS_LOADING = false;

  if (error) {
    console.error("[MIS] Finished Goods SKU page load failed", error);
    FG_ROWS = [];
    FG_TOTAL_ROWS = 0;
    FG_ERROR = errorMessage(error);
    ACTIVE_TAB_FAILED = true;
    renderFinishedGoodsSkuTable();
    renderFinishedGoodsPagination();
    return;
  }

  FG_ROWS = Array.isArray(data) ? data : [];
  FG_TOTAL_ROWS = Number(FG_ROWS[0]?.total_rows ?? FG_ROWS.length) || 0;

  renderToolbarUnlessTyping("fgSearch", renderFinishedGoodsToolbar);
  renderFinishedGoodsSkuTable();
  renderFinishedGoodsPagination();
}

function formatMosStatusLabel(value) {
  switch (value) {
    case "ZERO_STOCK":
      return "Zero Stock";
    case "BELOW_1_MONTH":
      return "Below 1 Month";
    case "ONE_TO_THREE_MONTHS":
      return "1 to 3 Months";
    case "ABOVE_6_MONTHS":
      return "Above 6 Months";
    case "NORMAL":
      return "Normal";
    default:
      return value || "-";
  }
}

function renderFinishedGoodsSkuTable() {
  const wrap = $("fgSkuTableWrap");
  if (!wrap) return;

  if (!FG_ROWS.length) {
    wrap.innerHTML = renderTableState("fg", {
      loading: FG_IS_LOADING,
      error: FG_ERROR,
      loadingText: "Preparing Finished Goods table...",
      emptyText: "No SKUs found.",
      errorText: "Failed to load Finished Goods SKUs.",
      retryKey: "finished-goods",
    });
    return;
  }

  wrap.innerHTML = `
    <table class="fg-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Pack</th>
          <th class="num">Stock</th>
          <th class="num">Forecast</th>
          <th class="num">MOS</th>
          <th class="num">Stock Value</th>
          <th>Status</th>
          <th>Classification</th>
        </tr>
      </thead>
      <tbody>
        ${FG_ROWS.map(
          (row) => {
            const pack = [row.pack_size, row.uom]
              .filter((value) => value != null && String(value).trim() !== "")
              .join(" ");
            return `
              <tr>
                <td>${escapeHtml(row.item || "-")}</td>
                <td>${escapeHtml(pack || "-")}</td>
                <td class="num">${escapeHtml(formatNumberIN(row.stock_overall))}</td>
                <td class="num">${escapeHtml(formatNumberIN(row.forecast_overall))}</td>
                <td class="num">${escapeHtml(formatNumberIN(row.mos_overall))}</td>
                <td class="num">${escapeHtml(formatCurrencyINR(row.stock_value_overall))}</td>
                <td>${escapeHtml(formatMosStatusLabel(row.mos_status))}</td>
                <td>${escapeHtml(row.classification || "-")}</td>
              </tr>
            `;
          },
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderFinishedGoodsPagination() {
  const el = $("fgPagination");
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(FG_TOTAL_ROWS / FG_PAGE_SIZE));
  const start = FG_TOTAL_ROWS
    ? (FG_CURRENT_PAGE - 1) * FG_PAGE_SIZE + 1
    : 0;
  const end = Math.min(FG_CURRENT_PAGE * FG_PAGE_SIZE, FG_TOTAL_ROWS);
  el.innerHTML = `
    <span class="fg-row-count">Showing ${formatIntegerIN(start)}-${formatIntegerIN(end)} of ${formatIntegerIN(FG_TOTAL_ROWS)} SKUs</span>
    <div class="fg-page-controls">
      <button id="fgPrevPage" class="icon-btn" type="button" title="Previous page" aria-label="Previous page" ${FG_CURRENT_PAGE <= 1 ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6"></path>
        </svg>
      </button>
      <span>Page ${formatIntegerIN(FG_CURRENT_PAGE)} / ${formatIntegerIN(totalPages)}</span>
      <button id="fgNextPage" class="icon-btn" type="button" title="Next page" aria-label="Next page" ${FG_CURRENT_PAGE >= totalPages ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6"></path>
        </svg>
      </button>
    </div>
  `;
}

function setFinishedGoodsFilter(value) {
  FG_FILTER = value || "all";
  FG_CURRENT_PAGE = 1;
  closeFinishedGoodsFilterDrawer();
  loadFinishedGoodsSkuPage();
}

function setFinishedGoodsSearch(value) {
  const next = String(value || "").trim();
  if (next === FG_SEARCH) return;
  FG_SEARCH = next;
  FG_CURRENT_PAGE = 1;
  loadFinishedGoodsSkuPage();
}

function clearFinishedGoodsSearch() {
  FG_SEARCH = "";
  FG_CURRENT_PAGE = 1;
  renderFinishedGoodsToolbar();
  loadFinishedGoodsSkuPage();
}

function goFinishedGoodsPrevPage() {
  if (FG_CURRENT_PAGE <= 1) return;
  FG_CURRENT_PAGE -= 1;
  loadFinishedGoodsSkuPage();
}

function goFinishedGoodsNextPage() {
  const totalPages = Math.max(1, Math.ceil(FG_TOTAL_ROWS / FG_PAGE_SIZE));
  if (FG_CURRENT_PAGE >= totalPages) return;
  FG_CURRENT_PAGE += 1;
  loadFinishedGoodsSkuPage();
}

// The Production tab is two independent sections: the canonical monetary section (mounted at once)
// and the subordinate legacy counts section. Each has its own request key, state, error and retry.
const PRODUCTION_COUNT_FIELDS = Object.freeze([
  "active_pipeline_batch_count",
  "work_in_process_batch_count",
  "overdue_work_in_process_batch_count",
  "finished_goods_bulk_batch_count",
  "bottled_stock_batch_count",
  "total_canonical_batch_count",
]);
let PRODUCTION_COUNTS = { status: "loading", message: "" };

function renderProductionShell() {
  tabPanel.innerHTML = `
    ${renderProductionValueSection()}
    <div id="productionCounts" class="production-counts"></div>
  `;
  renderProductionValueBody();
  renderProductionCountsBody();
}

async function loadProductionTab() {
  if (!tabPanel) return;
  if (!PRODUCTION_VALUE_MONTH) PRODUCTION_VALUE_MONTH = `${istToday().slice(0, 7)}-01`;
  renderProductionShell();
  await Promise.all([
    loadProductionValue(),
    loadProductionCounts(),
  ]);
}

async function loadProductionCounts() {
  const token = beginRequest("production");
  PRODUCTION_COUNTS = { status: "loading", message: "" };
  renderProductionCountsBody();

  const { data, error } = await settle(
    // Explicit six-field projection of the cheap live pipeline view. The legacy
    // v_mis_production_tab_summary (position x pipeline) is not queried: it times out (57014).
    supabase.from("v_mis_batch_pipeline").select(PRODUCTION_COUNT_FIELDS.join(",")).single(),
  );
  if (!isLatestRequest("production", token)) return;

  if (error) {
    console.error("[MIS] Production summary load failed", error);
    ACTIVE_TAB_FAILED = true;
    PRODUCTION_COUNTS = { status: "error", message: errorMessage(error) };
  } else {
    PRODUCTION_SUMMARY = data || null;
    PRODUCTION_COUNTS = { status: "ok", message: "" };
  }
  renderProductionCountsBody();
}

function istToday() {
  // YYYY-MM-DD in Asia/Kolkata (en-CA formats as ISO).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function productionValueMonthOptions() {
  const [y, m] = istToday().split("-").map(Number);
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    out.push({
      value: iso,
      label: new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(d),
    });
  }
  return out;
}

function productionValueAsOfBounds() {
  const today = istToday();
  const [y, m] = PRODUCTION_VALUE_MONTH.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { min: PRODUCTION_VALUE_MONTH, max: monthEnd < today ? monthEnd : today };
}

function classifyValueError(error) {
  const code = String((error && (error.code || error.status)) || "");
  const msg = String((error && error.message) || "");
  if (code === "42501" || code === "403" || /permission required/i.test(msg)) return "denied";
  if (code === "401" || code === "PGRST301" || /jwt|not authenticated|session/i.test(msg)) return "expired";
  if (code === "22023") return "invalid";
  return "error";
}

async function loadProductionValue() {
  if (!PRODUCTION_VALUE_MONTH) PRODUCTION_VALUE_MONTH = `${istToday().slice(0, 7)}-01`;
  const token = beginRequest("production:value");
  PRODUCTION_VALUE = { status: "loading", data: null, message: "" };
  renderProductionValueBody();

  const args = { p_report_month: PRODUCTION_VALUE_MONTH };
  if (PRODUCTION_VALUE_ASOF) args.p_as_of_date = PRODUCTION_VALUE_ASOF;
  const { data, error } = await settle(
    supabase.rpc("get_mis_production_value_summary", args),
  );
  if (!isLatestRequest("production:value", token)) return;

  if (error) {
    console.error("[MIS] Production value summary load failed", error);
    ACTIVE_TAB_FAILED = true;
    PRODUCTION_VALUE = {
      status: classifyValueError(error),
      data: null,
      message: errorMessage(error),
    };
  } else if (!data || typeof data !== "object" || Array.isArray(data)) {
    PRODUCTION_VALUE = {
      status: "error",
      data: null,
      message: "The server returned an unexpected response.",
    };
  } else {
    PRODUCTION_VALUE = { status: "ok", data, message: "" };
  }
  renderProductionValueBody();
}

function formatPercent(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${formatNumberIN(n)}%`;
}

const PV_STATUS_LABELS = {
  BULK_RECEIPT_COVERED_REFERENCE: "Bulk receipts, approved reference cost (covered subtotal)",
  NO_PREVIOUS_MONTH_APPROVED_COST: "No approved cost run for the previous month",
};
const PV_COMPONENT_POLICY_LABELS = {
  RM_STORES_PM_EXCLUDED:
    "Rate includes RM and RM materials-stores share only. PM stores, packing labour and PM costs are excluded from bulk.",
};

function pvCard({ cls = "", title, value, badge = "", caption = "", unavailable = false }) {
  return `
    <div class="pv-kpi ${cls}${unavailable ? " unavailable" : ""}">
      <div class="pv-kpi-title">${escapeHtml(title)}</div>
      <div class="pv-kpi-value">${escapeHtml(value)}</div>
      ${badge ? `<div class="pv-kpi-badge">${escapeHtml(badge)}</div>` : ""}
      ${caption ? `<div class="pv-kpi-caption">${escapeHtml(caption)}</div>` : ""}
    </div>`;
}

function pvHasValue(v) {
  return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
}

// Pure presentation of the server payload. No arithmetic: every rupee figure is shown exactly as
// supplied, and a missing figure is a word, never "₹0".
function buildProductionValueCards(d) {
  const noRun = d.status === "NO_PREVIOUS_MONTH_APPROVED_COST";
  const events = pvHasValue(d.receipt_event_count) ? Number(d.receipt_event_count) : null;
  const unvalued = pvHasValue(d.receipt_unvalued_count) ? Number(d.receipt_unvalued_count) : null;
  const corrections = pvHasValue(d.receipt_correction_event_count) ? Number(d.receipt_correction_event_count) : 0;
  const rStatus = d.receipt_value_status;

  // 1. Planned
  let planned;
  if (pvHasValue(d.planned_reference_covered_value)) {
    planned = pvCard({
      title: "Planned bulk value",
      value: formatCurrencyINR(d.planned_reference_covered_value),
      badge: d.plan_status === "FROZEN" ? "Frozen plan" : String(d.plan_status || "").replace(/_/g, " ").toLowerCase(),
      caption: pvHasValue(d.planned_unvalued_count) && Number(d.planned_unvalued_count) > 0
        ? `${formatIntegerIN(d.planned_unvalued_count)} planned product(s) unvalued - covered subtotal`
        : "Reference estimate",
    });
  } else {
    planned = pvCard({
      title: "Planned bulk value",
      value: "Unavailable",
      unavailable: true,
      badge: d.plan_status === "UNAVAILABLE_PENDING_FROZEN_PLAN" ? "Pending frozen plan" : "",
      caption: d.plan_status === "UNAVAILABLE_PENDING_FROZEN_PLAN"
        ? "No approved frozen plan snapshot yet; no planned amount is shown."
        : "No planned amount supplied for this period.",
    });
  }

  // 2. Actual bulk received (covered)
  let recv;
  if (noRun) {
    recv = pvCard({ title: "Bulk received - covered value", value: "Unavailable", unavailable: true, badge: "No approved cost", caption: "Previous month has no approved cost run, so receipts cannot be valued." });
  } else if (rStatus === "BLOCKED_CORRECTION_LINEAGE" || (!pvHasValue(d.receipt_reference_covered_value) && corrections > 0)) {
    recv = pvCard({ title: "Bulk received - covered value", value: "Withheld", unavailable: true, badge: "Correction lineage blocked", caption: `${formatIntegerIN(corrections)} correction event(s) in period; subtotal withheld until lineage is verified.` });
  } else if (!pvHasValue(d.receipt_reference_covered_value)) {
    const allUnvalued = events !== null && events > 0 && unvalued === events;
    recv = pvCard({
      title: "Bulk received - covered value",
      value: allUnvalued ? "Unvalued" : events === 0 ? "No receipts" : "Unavailable",
      unavailable: true,
      caption: allUnvalued ? `All ${formatIntegerIN(events)} receipt event(s) lack an approved rate.` : events === 0 ? "No bulk receipt events in this period." : "No covered value supplied.",
    });
  } else {
    const partial = rStatus === "PARTIAL_COVERAGE" || (unvalued !== null && unvalued > 0);
    recv = pvCard({
      title: "Bulk received - covered value",
      value: formatCurrencyINR(d.receipt_reference_covered_value),
      badge: partial ? "Partial coverage" : "Covered subtotal",
      caption: `${events === null ? "-" : formatIntegerIN(events)} receipt event(s)${unvalued ? `, ${formatIntegerIN(unvalued)} unvalued and excluded` : ""}. Not full cost or actual expense.`,
    });
  }

  // 3. Completed
  const completed = pvHasValue(d.completed_reference_value)
    ? pvCard({ title: "Completed bulk value", value: formatCurrencyINR(d.completed_reference_value), badge: String(d.completed_status || "").replace(/_/g, " ").toLowerCase(), caption: "Canonical completion events." })
    : pvCard({ title: "Completed bulk value", value: "N/A", unavailable: true, badge: d.completed_status === "NOT_VERIFIED" || !d.completed_status ? "Not verified" : String(d.completed_status).replace(/_/g, " ").toLowerCase(), caption: "No canonical batch-completion event is verified yet." });

  // 4. Transferred FG (Tally book basis; deliberately a separate card style)
  const lines = pvHasValue(d.transfer_line_count) ? Number(d.transfer_line_count) : null;
  const missing = pvHasValue(d.transfer_missing_amount_lines) ? Number(d.transfer_missing_amount_lines) : 0;
  const snap = d.tally_snapshot_as_of ? `Tally snapshot ${formatDateIN(d.tally_snapshot_as_of)}. ` : "";
  const recon = d.transfer_reconciliation_status === "NOT_CHECKED_BY_BOOK_TOTAL"
    ? "Not reconciled to batch log."
    : d.transfer_reconciliation_status ? `Reconciliation: ${String(d.transfer_reconciliation_status).replace(/_/g, " ").toLowerCase()}.` : "";
  const transfer = pvHasValue(d.tally_fg_transfer_book_value)
    ? pvCard({ cls: "book", title: "Transferred to FG - book value", value: formatCurrencyINR(d.tally_fg_transfer_book_value), badge: "Tally book basis", caption: `${lines === null ? "-" : formatIntegerIN(lines)} voucher line(s)${missing ? `, ${formatIntegerIN(missing)} without amount` : ""}. ${snap}${recon}` })
    : pvCard({ cls: "book", title: "Transferred to FG - book value", value: lines === 0 ? "No transfers" : "Unavailable", unavailable: true, badge: "Tally book basis", caption: lines === 0 ? `No Tally transfer lines in period. ${snap}`.trim() : `${snap}No book value supplied.`.trim() });

  return [planned, recv, completed, transfer].join("");
}

function renderProductionValueBody() {
  const body = $("productionValueBody");
  if (!body) return;
  const st = PRODUCTION_VALUE;
  body.setAttribute("aria-busy", st.status === "loading" ? "true" : "false");
  if (st.status === "loading") {
    body.innerHTML = `<div class="pv-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading production values...</div>`;
    return;
  }
  if (st.status !== "ok") {
    const text = {
      denied: "You do not have permission to view production values.",
      expired: "Your session has expired or could not be verified. Sign in again, then retry.",
      invalid: "That report month or cut-off date is not valid for the server.",
      error: "Failed to load production values.",
    }[st.status];
    const detail = st.status === "error" || st.status === "invalid" ? ` ${escapeHtml(st.message)}` : "";
    body.innerHTML = `<div class="pv-state error" role="alert">${escapeHtml(text)}${detail}${
      st.status === "denied" ? "" : ` <button type="button" class="mis-retry-btn" data-mis-retry="production-value">Retry</button>`
    }</div>`;
    return;
  }

  const d = st.data;
  const noRun = d.status === "NO_PREVIOUS_MONTH_APPROVED_COST";
  const comparable = d.comparability === "COMPARABLE" && pvHasValue(d.plan_achievement_pct);
  const policy = d.component_policy
    ? PV_COMPONENT_POLICY_LABELS[d.component_policy] || `Component policy: ${d.component_policy}`
    : "";
  const statusLabel = PV_STATUS_LABELS[d.status] || (d.status ? String(d.status).replace(/_/g, " ").toLowerCase() : "");
  const basis = [
    `Report month <b>${escapeHtml(formatDateIN(d.report_month))}</b>`,
    `Events to <b>${escapeHtml(formatDateIN(d.as_of_date))}</b>`,
    noRun ? "" : `Approved cost run <b>#${escapeHtml(d.approved_cost_run_id ?? "-")}</b> (valued ${escapeHtml(formatDateIN(d.approved_cost_valuation_date))})`,
  ].filter(Boolean).join(" &middot; ");

  body.innerHTML = `
    <div class="pv-basis">${basis}</div>
    <div class="pv-kpi-grid">${buildProductionValueCards(d)}</div>
    <div class="pv-achievement">
      <span class="pv-achievement-label">Plan achievement</span>
      <span class="pv-achievement-value">${comparable ? escapeHtml(formatPercent(d.plan_achievement_pct)) : "N/A"}</span>
      <span class="pv-achievement-note">${comparable ? "Server-confirmed comparable basis." : "Not comparable: no frozen plan or verified completion on the same cost basis. Receipts and Tally book value are never used as a plan percentage."}</span>
    </div>
    <details class="pv-notes">
      <summary>Basis, coverage and exclusions</summary>
      <ul>
        <li>Indicative covered subtotal at approved reference cost; it is not full COP or actual expense.</li>
        ${statusLabel ? `<li>Server status: ${escapeHtml(statusLabel)}.</li>` : ""}
        ${policy ? `<li>${escapeHtml(policy)}</li>` : ""}
        <li>Receipts use legacy physical storage postings; a stored receipt is not a formal batch completion.</li>
        <li>Tally book value is a separate accounting basis and is not comparable with the reference-cost figures.</li>
        <li>The top-of-page "Transferred to Finished Goods Value" card comes from the executive summary snapshot, not from this report; the two sources can differ.</li>
        <li>Physical quantities in Kg, L and Nos are never added together.</li>
      </ul>
    </details>`;
}

function renderProductionValueSection() {
  const opts = productionValueMonthOptions();
  if (!opts.some((o) => o.value === PRODUCTION_VALUE_MONTH)) {
    opts.unshift({ value: PRODUCTION_VALUE_MONTH, label: formatDateIN(PRODUCTION_VALUE_MONTH) });
  }
  const bounds = productionValueAsOfBounds();
  return `
    <section class="pv" id="productionValueSection" aria-labelledby="pvHeading">
      <div class="pv-head">
        <h2 class="pv-heading" id="pvHeading">Production value</h2>
        <div class="pv-controls">
          <label class="pv-field"><span>Month</span>
            <select id="pvMonth" class="pv-input">${opts
              .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === PRODUCTION_VALUE_MONTH ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
              .join("")}</select></label>
          <label class="pv-field"><span>As of</span>
            <input id="pvAsOf" class="pv-input" type="date" min="${escapeHtml(bounds.min)}" max="${escapeHtml(bounds.max)}" value="${escapeHtml(PRODUCTION_VALUE_ASOF)}" /></label>
        </div>
      </div>
      <div id="productionValueBody" class="pv-body"></div>
    </section>`;
}

function onProductionValueControlChange() {
  const month = $("pvMonth")?.value;
  if (month) PRODUCTION_VALUE_MONTH = month;
  let asof = $("pvAsOf")?.value || "";
  const b = productionValueAsOfBounds();
  if (asof && (asof < b.min || asof > b.max)) asof = "";
  PRODUCTION_VALUE_ASOF = asof;
  const input = $("pvAsOf");
  if (input) {
    input.min = b.min;
    input.max = b.max;
    input.value = asof;
  }
  loadProductionValue();
}

function renderProductionCountsBody() {
  const host = $("productionCounts");
  if (!host) return;
  const st = PRODUCTION_COUNTS;
  host.setAttribute("aria-busy", st.status === "loading" ? "true" : "false");
  if (st.status === "loading") {
    host.innerHTML = `<div class="production-summary-heading">Live batch pipeline &mdash; current state</div><div class="pv-state" role="status"><span class="table-loading-spinner" aria-hidden="true"></span> Loading batch counts...</div>`;
    return;
  }
  if (st.status === "error") {
    host.innerHTML = `<div class="production-summary-heading">Live batch pipeline &mdash; current state</div><div class="pv-state error" role="alert">Failed to load production batch counts. ${escapeHtml(st.message)} <button type="button" class="mis-retry-btn" data-mis-retry="production-counts">Retry</button></div>`;
    return;
  }
  const s = PRODUCTION_SUMMARY || {};
  // Counts only, straight from the server. Current state of the live pipeline; not month-bound.
  const cards = [
    { title: "Active Pipeline Batches", value: formatIntegerIN(s.active_pipeline_batch_count) },
    { title: "Work in Process Batches", value: formatIntegerIN(s.work_in_process_batch_count) },
    {
      title: "Overdue WIP Batches",
      value: formatIntegerIN(s.overdue_work_in_process_batch_count),
      state: Number(s.overdue_work_in_process_batch_count) > 0 ? "warning" : "",
    },
    { title: "FG Bulk Batches", value: formatIntegerIN(s.finished_goods_bulk_batch_count) },
    { title: "Bottled Stock Batches", value: formatIntegerIN(s.bottled_stock_batch_count) },
    { title: "Total Canonical Batches", value: formatIntegerIN(s.total_canonical_batch_count) },
  ];

  host.innerHTML = `
    <div class="production-summary-heading">Live batch pipeline &mdash; current state</div>
    <div class="production-scope-note">Counts of batches as they stand now. They are not tied to the report month selected above, which applies only to the production value section.</div>
    <div class="production-summary-grid">
      ${cards
        .map(
          (card) => `
            <div class="production-summary-card ${card.state || ""}">
              <div class="production-summary-title">${escapeHtml(card.title)}</div>
              <div class="production-summary-value">${escapeHtml(card.value)}</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function openFinanceFilterDrawer() {
  const drawer = $("financeFilterDrawer");
  const btn = $("financeFilterBtn");
  if (!drawer || !btn) return;
  drawer.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
}

function closeFinanceFilterDrawer() {
  const drawer = $("financeFilterDrawer");
  const btn = $("financeFilterBtn");
  if (!drawer || !btn) return;
  drawer.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function toggleFinanceFilterDrawer() {
  const drawer = $("financeFilterDrawer");
  if (!drawer) return;
  if (drawer.classList.contains("open")) closeFinanceFilterDrawer();
  else openFinanceFilterDrawer();
}

function openInventoryFilterDrawer() {
  const drawer = $("inventoryFilterDrawer");
  const btn = $("inventoryFilterBtn");
  if (!drawer || !btn) return;
  drawer.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
}

function closeInventoryFilterDrawer() {
  const drawer = $("inventoryFilterDrawer");
  const btn = $("inventoryFilterBtn");
  if (!drawer || !btn) return;
  drawer.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function toggleInventoryFilterDrawer() {
  const drawer = $("inventoryFilterDrawer");
  if (!drawer) return;
  if (drawer.classList.contains("open")) closeInventoryFilterDrawer();
  else openInventoryFilterDrawer();
}

function openFinishedGoodsFilterDrawer() {
  const drawer = $("fgFilterDrawer");
  const btn = $("fgFilterBtn");
  if (!drawer || !btn) return;
  drawer.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
}

function closeFinishedGoodsFilterDrawer() {
  const drawer = $("fgFilterDrawer");
  const btn = $("fgFilterBtn");
  if (!drawer || !btn) return;
  drawer.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function toggleFinishedGoodsFilterDrawer() {
  const drawer = $("fgFilterDrawer");
  if (!drawer) return;
  if (drawer.classList.contains("open")) closeFinishedGoodsFilterDrawer();
  else openFinishedGoodsFilterDrawer();
}

const debouncedSetFinanceSearch = debounce((value) => {
  setFinanceSearch(value);
}, 250);

const debouncedSetSalesSearch = debounce((value) => {
  setSalesSearch(value);
}, 250);

const debouncedSetInventorySearch = debounce((value) => {
  setInventorySearch(value);
}, 250);

const debouncedSetFinishedGoodsSearch = debounce((value) => {
  setFinishedGoodsSearch(value);
}, 250);

function isFinanceModalOpen() {
  return !!financeModalOverlay && !financeModalOverlay.classList.contains("hidden");
}

async function openFinancePartyDetails(row) {
  if (!financeModalOverlay || !financeModalContent) return;
  const token = beginRequest("finance:modal");
  // Keep the original trigger if a second row is opened while already open.
  if (!isFinanceModalOpen()) FINANCE_LAST_FOCUS = document.activeElement;
  financeModalOverlay.classList.remove("hidden");
  financeModalOverlay.setAttribute("aria-hidden", "false");
  if (financeModalTitle) financeModalTitle.textContent = row.party_name || "-";
  if (financeModalSubtitle) {
    financeModalSubtitle.textContent = `${row.mis_group_name || "-"} | ${formatCurrencyINR(row.outstanding_amount_mis_value)}`;
  }
  financeModalContent.innerHTML = `<div class="finance-status" role="status">Loading bill details...</div>`;
  financeModalClose?.focus?.();

  const { data, error } = await settle(
    supabase
      .from("v_mis_finance_outstanding_detail")
      .select(
        "report_date, mis_group_name, bill_date_text, bill_ref, party_name, outstanding_amount_tally_value, outstanding_amount_abs_line_value",
      )
      .eq("party_name", row.party_name)
      .eq("mis_group_name", row.mis_group_name)
      .order("bill_date_text", { ascending: true }),
  );

  // Closed, or another party opened, while this was in flight.
  if (!isLatestRequest("finance:modal", token) || !isFinanceModalOpen()) return;

  if (error) {
    console.error("[MIS] Finance bill detail load failed", error);
    financeModalContent.innerHTML = `<div class="finance-status error">Failed to load bill details. ${escapeHtml(error.message || "See console for details.")}</div>`;
    return;
  }

  const bills = data || [];
  if (!bills.length) {
    financeModalContent.innerHTML = `<div class="finance-empty">No bill details found for this party.</div>`;
    return;
  }

  financeModalContent.innerHTML = `
    <div class="finance-table-wrap">
      <table class="finance-table">
        <thead>
          <tr>
            <th>Bill Date</th>
            <th>Bill Ref</th>
            <th class="num">Tally Signed Amount</th>
            <th class="num">Line Absolute Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bills
            .map(
              (bill) => `
                <tr>
                  <td>${escapeHtml(bill.bill_date_text || "-")}</td>
                  <td>${escapeHtml(bill.bill_ref || "-")}</td>
                  <td class="num">${escapeHtml(formatCurrencyINR(bill.outstanding_amount_tally_value))}</td>
                  <td class="num">${escapeHtml(formatCurrencyINR(bill.outstanding_amount_abs_line_value))}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function closeFinanceModal() {
  if (!financeModalOverlay || !isFinanceModalOpen()) return;
  beginRequest("finance:modal");
  if (financeModalOverlay.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  financeModalOverlay.classList.add("hidden");
  financeModalOverlay.setAttribute("aria-hidden", "true");
  if (financeModalContent) financeModalContent.innerHTML = "";
  if (FINANCE_LAST_FOCUS && document.contains(FINANCE_LAST_FOCUS)) {
    FINANCE_LAST_FOCUS.focus?.();
  } else {
    // The table may have been re-rendered while the modal was open.
    ($("financeSearch") || tabPanel)?.focus?.();
  }
  FINANCE_LAST_FOCUS = null;
}

function wireEvents() {
  refreshBtn?.addEventListener("click", loadExecutiveSummary);
  $("homeBtn")?.addEventListener("click", () => Platform.goHome());
  detailTabs?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".pill");
    if (!btn) return;
    selectTab(btn.getAttribute("data-tab"));
  });
  detailTabSelect?.addEventListener("change", () => {
    selectTab(detailTabSelect.value);
  });
  tabPanel?.addEventListener("change", (ev) => {
    if (ev.target.id === "pvMonth" || ev.target.id === "pvAsOf") onProductionValueControlChange();
  });
  tabPanel?.addEventListener("click", (ev) => {
    const retryBtn = ev.target.closest("[data-mis-retry]");
    if (retryBtn) {
      const retryKey = retryBtn.getAttribute("data-mis-retry");
      if (retryKey === "production-value") {
        loadProductionValue();
        return;
      }
      if (retryKey === "production-counts") {
        loadProductionCounts();
        return;
      }
      loadActiveTab();
      return;
    }

    const filterBtn = ev.target.closest("#financeFilterBtn");
    if (filterBtn) {
      ev.stopPropagation();
      toggleFinanceFilterDrawer();
      return;
    }

    const inventoryFilterBtn = ev.target.closest("#inventoryFilterBtn");
    if (inventoryFilterBtn) {
      ev.stopPropagation();
      toggleInventoryFilterDrawer();
      return;
    }

    const fgFilterBtn = ev.target.closest("#fgFilterBtn");
    if (fgFilterBtn) {
      ev.stopPropagation();
      toggleFinishedGoodsFilterDrawer();
      return;
    }

    const clearBtn = ev.target.closest("#financeSearchClear");
    if (clearBtn) {
      clearFinanceSearch();
      return;
    }

    const salesClearBtn = ev.target.closest("#salesSearchClear");
    if (salesClearBtn) {
      clearSalesSearch();
      return;
    }

    const inventoryClearBtn = ev.target.closest("#inventorySearchClear");
    if (inventoryClearBtn) {
      clearInventorySearch();
      return;
    }

    const fgClearBtn = ev.target.closest("#fgSearchClear");
    if (fgClearBtn) {
      clearFinishedGoodsSearch();
      return;
    }

    const prevBtn = ev.target.closest("#financePrevPage");
    if (prevBtn) {
      goFinancePrevPage();
      return;
    }

    const nextBtn = ev.target.closest("#financeNextPage");
    if (nextBtn) {
      goFinanceNextPage();
      return;
    }

    const salesPrevBtn = ev.target.closest("#salesPrevPage");
    if (salesPrevBtn) {
      goSalesPrevPage();
      return;
    }

    const salesNextBtn = ev.target.closest("#salesNextPage");
    if (salesNextBtn) {
      goSalesNextPage();
      return;
    }

    const inventoryPrevBtn = ev.target.closest("#inventoryPrevPage");
    if (inventoryPrevBtn) {
      goInventoryPrevPage();
      return;
    }

    const inventoryNextBtn = ev.target.closest("#inventoryNextPage");
    if (inventoryNextBtn) {
      goInventoryNextPage();
      return;
    }

    const fgPrevBtn = ev.target.closest("#fgPrevPage");
    if (fgPrevBtn) {
      goFinishedGoodsPrevPage();
      return;
    }

    const fgNextBtn = ev.target.closest("#fgNextPage");
    if (fgNextBtn) {
      goFinishedGoodsNextPage();
    }
  });
  tabPanel?.addEventListener("input", (ev) => {
    const clearId = {
      financeSearch: "financeSearchClear",
      salesSearch: "salesSearchClear",
      inventorySearch: "inventorySearchClear",
      fgSearch: "fgSearchClear",
    }[ev.target?.id];
    if (clearId) {
      const clearBtn = $(clearId);
      if (clearBtn) clearBtn.style.display = ev.target.value ? "" : "none";
    }
    if (ev.target?.id === "financeSearch") {
      debouncedSetFinanceSearch(ev.target.value);
    } else if (ev.target?.id === "salesSearch") {
      debouncedSetSalesSearch(ev.target.value);
    } else if (ev.target?.id === "inventorySearch") {
      debouncedSetInventorySearch(ev.target.value);
    } else if (ev.target?.id === "fgSearch") {
      debouncedSetFinishedGoodsSearch(ev.target.value);
    }
  });
  tabPanel?.addEventListener("change", (ev) => {
    if (ev.target?.name === "financeFilter") {
      setFinanceFilter(ev.target.value);
    } else if (ev.target?.name === "inventoryFilter") {
      setInventoryFilter(ev.target.value);
    } else if (ev.target?.name === "fgFilter") {
      setFinishedGoodsFilter(ev.target.value);
    }
  });
  kpiGrid?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".kpi-info-btn");
    if (!btn) return;
    ev.stopPropagation();
    openKpiPopover(btn);
  });
  kpiGrid?.addEventListener("mouseover", (ev) => {
    if (!window.matchMedia?.("(hover: hover)").matches) return;
    const btn = ev.target.closest(".kpi-info-btn");
    if (!btn) return;
    openKpiPopover(btn, false);
  });
  lastRefreshed?.addEventListener("click", () => {
    const detail = $("sc-status-detail");
    if (!detail) return;
    const expanded = lastRefreshed.classList.toggle("sc-status-expanded");
    lastRefreshed.setAttribute("aria-expanded", String(expanded));
    detail.style.display = expanded ? "block" : "none";
  });
  lastRefreshed?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      lastRefreshed.click();
    }
  });
  document.addEventListener("click", (ev) => {
    const filterWrapper = $("financeFilterWrapper");
    if (filterWrapper && !filterWrapper.contains(ev.target)) {
      closeFinanceFilterDrawer();
    }
    const inventoryFilterWrapper = $("inventoryFilterWrapper");
    if (
      inventoryFilterWrapper &&
      !inventoryFilterWrapper.contains(ev.target)
    ) {
      closeInventoryFilterDrawer();
    }
    const fgFilterWrapper = $("fgFilterWrapper");
    if (fgFilterWrapper && !fgFilterWrapper.contains(ev.target)) {
      closeFinishedGoodsFilterDrawer();
    }
    if (!ACTIVE_POPOVER) return;
    if (ACTIVE_POPOVER.contains(ev.target)) return;
    if (ACTIVE_INFO_BUTTON && ACTIVE_INFO_BUTTON.contains(ev.target)) return;
    closeKpiPopover();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab" && isFinanceModalOpen()) {
      const focusable = [
        ...financeModalOverlay.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!financeModalOverlay.contains(document.activeElement)) {
        ev.preventDefault();
        first.focus();
      } else if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
      return;
    }
    if (ev.key === "Escape") {
      // If focus is inside an open filter drawer, hand it back to its button.
      [
        ["financeFilterDrawer", "financeFilterBtn"],
        ["inventoryFilterDrawer", "inventoryFilterBtn"],
        ["fgFilterDrawer", "fgFilterBtn"],
      ].forEach(([drawerId, btnId]) => {
        const drawer = $(drawerId);
        if (drawer?.classList.contains("open") && drawer.contains(document.activeElement)) {
          $(btnId)?.focus();
        }
      });
      closeKpiPopover();
      closeFinanceFilterDrawer();
      closeInventoryFilterDrawer();
      closeFinishedGoodsFilterDrawer();
      closeFinanceModal();
    }
  });
  financeModalClose?.addEventListener("click", closeFinanceModal);
  financeModalOverlay?.addEventListener("click", (ev) => {
    if (ev.target === financeModalOverlay) closeFinanceModal();
  });
  window.addEventListener("resize", closeKpiPopover);
  window.addEventListener("scroll", closeKpiPopover, { passive: true });
  setInterval(updateFreshnessIndicator, 60000);
}

function debounce(fn, wait) {
  let timer = null;
  const debounced = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

// A debounced search typed just before a tab switch must not fire into the
// next panel; the rebuilt toolbar renders from committed state anyway.
function cancelPendingSearches() {
  debouncedSetFinanceSearch.cancel();
  debouncedSetSalesSearch.cancel();
  debouncedSetInventorySearch.cancel();
  debouncedSetFinishedGoodsSearch.cancel();
}

(async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return (window.location.href = "/login.html");

  const permission = await loadPermissions(session.user.id);

  if (!PERM_CAN_VIEW) {
    // Deny by default. Access is decided server-side by get_user_permissions;
    // the client only reflects the result and never loads module data without it.
    document.body.classList.add("mis-denied");
    setStatus(
      permission === "error"
        ? "Could not verify your access to this module. Please refresh the page or try again shortly."
        : "You do not have permission to view this module.",
      "error",
    );
    return;
  }

  wireEvents();
  renderDetailTabs();
  updateFreshnessIndicator();
  await loadExecutiveSummary();
})();

