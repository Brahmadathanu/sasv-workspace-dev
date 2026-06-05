import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "executive-mis-dashboard";
const PLAN_WARNING_STATUS =
  "CURRENT_MONTH_PLAN_NOT_AVAILABLE_USING_NEXT_AVAILABLE_PLAN_MONTH";

let PERM_CAN_VIEW = true;
let DATA_REFRESH_TIME = null;
let ACTIVE_INFO_BUTTON = null;
let ACTIVE_POPOVER = null;
let ACTIVE_TAB = "finance";
let FINANCE_FILTER = "payables";
let FINANCE_SEARCH = "";
let FINANCE_CURRENT_PAGE = 1;
let FINANCE_PAGE_SIZE = 25;
let FINANCE_TOTAL_ROWS = 0;
let FINANCE_ROWS = [];
let FINANCE_SUMMARY = null;
let FINANCE_LAST_FOCUS = null;
let SALES_SEARCH = "";
let SALES_CURRENT_PAGE = 1;
let SALES_PAGE_SIZE = 25;
let SALES_TOTAL_ROWS = 0;
let SALES_ROWS = [];
let SALES_SUMMARY = null;
let SALES_IS_LOADING = false;
let INVENTORY_FILTER = "all";
let INVENTORY_SEARCH = "";
let INVENTORY_CURRENT_PAGE = 1;
let INVENTORY_PAGE_SIZE = 25;
let INVENTORY_TOTAL_ROWS = 0;
let INVENTORY_ROWS = [];
let INVENTORY_SUMMARY = null;
let INVENTORY_IS_LOADING = false;
let FG_FILTER = "all";
let FG_SEARCH = "";
let FG_CURRENT_PAGE = 1;
let FG_PAGE_SIZE = 25;
let FG_TOTAL_ROWS = 0;
let FG_ROWS = [];
let FG_SUMMARY = null;
let FG_IS_LOADING = false;
let PRODUCTION_SUMMARY = null;

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

async function loadPermissions(sessionUserId) {
  try {
    const { data: perms, error: permsErr } = await supabase.rpc(
      "get_user_permissions",
      { p_user_id: sessionUserId },
    );
    if (!permsErr && Array.isArray(perms)) {
      const p = perms.find((r) => r && r.target === `module:${MODULE_ID}`);
      if (p) PERM_CAN_VIEW = !!p.can_view;
    } else {
      try {
        const { data: permRows } = await supabase
          .from("user_permissions")
          .select("module_id, can_view")
          .eq("user_id", sessionUserId)
          .eq("module_id", MODULE_ID)
          .limit(1);
        if (Array.isArray(permRows) && permRows.length) {
          PERM_CAN_VIEW = !!permRows[0].can_view;
        }
      } catch (e) {
        console.warn("[MIS] Permission fallback failed", e);
      }
    }
  } catch (e) {
    console.warn("[MIS] Permission RPC failed", e);
  }
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
    if (ACTIVE_TAB === "finance") await loadFinanceTab();
    if (ACTIVE_TAB === "sales") await loadSalesTab();
    if (ACTIVE_TAB === "inventory") await loadInventoryTab();
    if (ACTIVE_TAB === "finished-goods") await loadFinishedGoodsTab();
    if (ACTIVE_TAB === "production") await loadProductionTab();
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
      note: "Value of production transferred to finished goods in the current reporting period.",
      source: productionDate,
      detail: "Production value moved into finished goods.",
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

function renderActiveTab() {
  renderDetailTabs();
  tabPanel?.classList.toggle("production-panel", ACTIVE_TAB === "production");
  if (ACTIVE_TAB === "finance") {
    loadFinanceTab();
  } else if (ACTIVE_TAB === "sales") {
    loadSalesTab();
  } else if (ACTIVE_TAB === "inventory") {
    loadInventoryTab();
  } else if (ACTIVE_TAB === "finished-goods") {
    loadFinishedGoodsTab();
  } else if (ACTIVE_TAB === "production") {
    loadProductionTab();
  } else {
    renderPlaceholderTab();
  }
}

function setFinanceStatus(message, type = "info") {
  if (!tabPanel) return;
  tabPanel.innerHTML = `<div class="finance-status ${escapeHtml(type)}">${escapeHtml(message)}</div>`;
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
      shell.appendChild(mask);
    }

    mask.innerHTML = `
      <div class="table-loading-card">
        <span class="table-loading-spinner" aria-hidden="true"></span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
    mask.hidden = false;
  } else if (mask) {
    mask.hidden = true;
  }
}

async function loadFinanceTab() {
  if (!tabPanel) return;
  setFinanceStatus("Loading finance parties...");
  FINANCE_ROWS = [];
  FINANCE_TOTAL_ROWS = 0;
  renderFinanceTab();

  const summaryResult = await supabase
    .from("v_mis_finance_tab_summary")
    .select("finance_scope_note")
    .single();

  if (summaryResult.error) {
    console.error("[MIS] Finance summary load failed", summaryResult.error);
  } else {
    FINANCE_SUMMARY = summaryResult.data || null;
    renderFinanceScopeNote();
  }

  await loadFinancePartyPage();
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
  const wrap = $("financePartyTableWrap");
  if (wrap && !FINANCE_ROWS.length) {
    wrap.innerHTML = `<div class="finance-status">Loading parties...</div>`;
  }

  setTableLoading(".finance-table-shell", true, "Loading finance parties...");

  const { data, error } = await supabase.rpc("get_mis_finance_party_page", {
    p_group_filter: FINANCE_FILTER,
    p_search: FINANCE_SEARCH,
    p_limit: FINANCE_PAGE_SIZE,
    p_offset: (FINANCE_CURRENT_PAGE - 1) * FINANCE_PAGE_SIZE,
  });

  setTableLoading(".finance-table-shell", false);

  if (error) {
    console.error("[MIS] Finance party page load failed", error);
    FINANCE_ROWS = [];
    FINANCE_TOTAL_ROWS = 0;
    if (wrap) {
      wrap.innerHTML = `<div class="finance-status error">Failed to load finance parties. ${escapeHtml(error.message || "See console for details.")}</div>`;
    }
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
  renderFinanceToolbar();
  renderFinancePartyTable();
  renderFinancePagination();
}

function renderFinancePartyTable() {
  const wrap = $("financePartyTableWrap");
  if (!wrap) return;
  const rows = FINANCE_ROWS;

  if (!rows.length) {
    wrap.innerHTML = `<div class="finance-empty">No parties found for this scope.</div>`;
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
              <tr data-party-index="${index}">
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
    tr.addEventListener("click", () => {
      const row = rows[Number(tr.getAttribute("data-party-index"))];
      if (row) openFinancePartyDetails(row);
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
  FINANCE_SEARCH = String(value || "").trim();
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
  setFinanceStatus("Loading sales products...");
  SALES_ROWS = [];
  SALES_TOTAL_ROWS = 0;
  SALES_IS_LOADING = true;
  renderSalesTab();
  setTableLoading(".sales-table-shell", true, "Loading sales products...");

  const summaryResult = await supabase
    .from("v_mis_sales_tab_summary")
    .select("*")
    .single();

  if (summaryResult.error) {
    console.error("[MIS] Sales summary load failed", summaryResult.error);
  } else {
    SALES_SUMMARY = summaryResult.data || null;
    renderSalesScopeNote();
  }

  await loadSalesProductPage();
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
  const wrap = $("salesProductTableWrap");
  if (wrap && !SALES_ROWS.length) {
    wrap.innerHTML = `<div class="sales-status">Preparing sales table...</div>`;
  }

  setTableLoading(".sales-table-shell", true, "Loading sales products...");

  const { data, error } = await supabase.rpc("get_mis_sales_product_page", {
    p_search: SALES_SEARCH,
    p_limit: SALES_PAGE_SIZE,
    p_offset: (SALES_CURRENT_PAGE - 1) * SALES_PAGE_SIZE,
  });

  setTableLoading(".sales-table-shell", false);

  if (error) {
    console.error("[MIS] Sales product page load failed", error);
    SALES_IS_LOADING = false;
    SALES_ROWS = [];
    SALES_TOTAL_ROWS = 0;
    if (wrap) {
      wrap.innerHTML = `<div class="sales-status error">Failed to load sales products. ${escapeHtml(error.message || "See console for details.")}</div>`;
    }
    renderSalesPagination();
    return;
  }

  SALES_ROWS = Array.isArray(data) ? data : [];
  SALES_TOTAL_ROWS =
    Number(SALES_ROWS[0]?.total_rows ?? SALES_ROWS.length) || 0;
  SALES_IS_LOADING = false;

  renderSalesToolbar();
  renderSalesProductTable();
  renderSalesPagination();
}

function renderSalesProductTable() {
  const wrap = $("salesProductTableWrap");
  if (!wrap) return;

  if (!SALES_ROWS.length) {
    wrap.innerHTML = SALES_IS_LOADING
      ? `<div class="sales-status">Preparing sales table...</div>`
      : `<div class="sales-empty">No products found.</div>`;
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
  SALES_SEARCH = String(value || "").trim();
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
  setFinanceStatus("Loading inventory items...");
  INVENTORY_ROWS = [];
  INVENTORY_TOTAL_ROWS = 0;
  INVENTORY_IS_LOADING = true;
  renderInventoryTab();
  setTableLoading(
    ".inventory-table-shell",
    true,
    "Loading inventory items...",
  );

  const summaryResult = await supabase
    .from("v_mis_inventory_tab_summary")
    .select("*")
    .single();

  if (summaryResult.error) {
    console.error("[MIS] Inventory summary load failed", summaryResult.error);
  } else {
    INVENTORY_SUMMARY = summaryResult.data || null;
    renderInventoryScopeNote();
  }

  await loadInventoryItemPage();
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
  const wrap = $("inventoryItemTableWrap");
  if (wrap && !INVENTORY_ROWS.length) {
    wrap.innerHTML = `<div class="inventory-status">Preparing inventory table...</div>`;
  }

  setTableLoading(
    ".inventory-table-shell",
    true,
    "Loading inventory items...",
  );

  const { data, error } = await supabase.rpc("get_mis_inventory_item_page", {
    p_source_kind: INVENTORY_FILTER,
    p_search: INVENTORY_SEARCH,
    p_limit: INVENTORY_PAGE_SIZE,
    p_offset: (INVENTORY_CURRENT_PAGE - 1) * INVENTORY_PAGE_SIZE,
  });

  setTableLoading(".inventory-table-shell", false);

  if (error) {
    console.error("[MIS] Inventory item page load failed", error);
    INVENTORY_IS_LOADING = false;
    INVENTORY_ROWS = [];
    INVENTORY_TOTAL_ROWS = 0;
    if (wrap) {
      wrap.innerHTML = `<div class="inventory-status error">Failed to load inventory items. ${escapeHtml(error.message || "See console for details.")}</div>`;
    }
    renderInventoryPagination();
    return;
  }

  INVENTORY_ROWS = Array.isArray(data) ? data : [];
  INVENTORY_TOTAL_ROWS =
    Number(INVENTORY_ROWS[0]?.total_rows ?? INVENTORY_ROWS.length) || 0;
  INVENTORY_IS_LOADING = false;

  renderInventoryToolbar();
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
    wrap.innerHTML = INVENTORY_IS_LOADING
      ? `<div class="inventory-status">Preparing inventory table...</div>`
      : `<div class="inventory-empty">No items found.</div>`;
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
  INVENTORY_SEARCH = String(value || "").trim();
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
  setFinanceStatus("Loading Finished Goods SKUs...");
  FG_ROWS = [];
  FG_TOTAL_ROWS = 0;
  FG_IS_LOADING = true;
  renderFinishedGoodsTab();
  setTableLoading(".fg-table-shell", true, "Loading Finished Goods SKUs...");

  const summaryResult = await supabase
    .from("v_mis_finished_goods_tab_summary")
    .select("*")
    .single();

  if (summaryResult.error) {
    console.error(
      "[MIS] Finished Goods summary load failed",
      summaryResult.error,
    );
  } else {
    FG_SUMMARY = summaryResult.data || null;
    renderFinishedGoodsScopeNote();
  }

  await loadFinishedGoodsSkuPage();
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
  const wrap = $("fgSkuTableWrap");
  if (wrap && !FG_ROWS.length) {
    wrap.innerHTML = `<div class="fg-status">Preparing Finished Goods table...</div>`;
  }

  setTableLoading(".fg-table-shell", true, "Loading Finished Goods SKUs...");

  const { data, error } = await supabase.rpc(
    "get_mis_finished_goods_sku_page",
    {
      p_mos_filter: FG_FILTER,
      p_search: FG_SEARCH,
      p_limit: FG_PAGE_SIZE,
      p_offset: (FG_CURRENT_PAGE - 1) * FG_PAGE_SIZE,
    },
  );

  setTableLoading(".fg-table-shell", false);

  if (error) {
    console.error("[MIS] Finished Goods SKU page load failed", error);
    FG_IS_LOADING = false;
    FG_ROWS = [];
    FG_TOTAL_ROWS = 0;
    if (wrap) {
      wrap.innerHTML = `<div class="fg-status error">Failed to load Finished Goods SKUs. ${escapeHtml(error.message || "See console for details.")}</div>`;
    }
    renderFinishedGoodsPagination();
    return;
  }

  FG_ROWS = Array.isArray(data) ? data : [];
  FG_TOTAL_ROWS = Number(FG_ROWS[0]?.total_rows ?? FG_ROWS.length) || 0;
  FG_IS_LOADING = false;

  renderFinishedGoodsToolbar();
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
    wrap.innerHTML = FG_IS_LOADING
      ? `<div class="fg-status">Preparing Finished Goods table...</div>`
      : `<div class="fg-empty">No SKUs found.</div>`;
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
  FG_SEARCH = String(value || "").trim();
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

async function loadProductionTab() {
  if (!tabPanel) return;
  tabPanel.innerHTML = `
    <div class="production-loading-shell">
      <div class="production-status">Preparing production summary...</div>
    </div>
  `;
  setTableLoading(
    ".production-loading-shell",
    true,
    "Loading production summary...",
  );

  const { data, error } = await supabase
    .from("v_mis_production_tab_summary")
    .select("*")
    .single();

  setTableLoading(".production-loading-shell", false);

  if (error) {
    console.error("[MIS] Production summary load failed", error);
    tabPanel.innerHTML = `<div class="finance-status error">Failed to load production summary.</div>`;
    return;
  }

  PRODUCTION_SUMMARY = data || null;
  renderProductionTab();
}

function formatPlanningStatusLabel(value) {
  switch (value) {
    case "CURRENT_MONTH_PLAN_AVAILABLE":
      return "Current Month Plan Available";
    case "CURRENT_MONTH_PLAN_NOT_AVAILABLE_USING_NEXT_AVAILABLE_PLAN_MONTH":
      return "Current Month Plan Not Available - Using Next Available Plan Month";
    default:
      return value || "-";
  }
}

function formatPercent(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${formatNumberIN(n)}%`;
}

function renderProductionTab() {
  if (!tabPanel) return;
  const s = PRODUCTION_SUMMARY || {};
  const periodLine = `Report month: ${formatDateIN(s.report_month_start)} to ${formatDateIN(s.report_month_end)} | Planning month: ${formatDateIN(s.planning_month_start)} | Status: ${formatPlanningStatusLabel(s.planning_period_status)}`;
  const cards = [
    {
      title: "Planned Production",
      value: formatNumberIN(s.planned_production_base_qty),
    },
    {
      title: "Bulk Produced",
      value: formatNumberIN(s.bulk_produced_base_qty),
    },
    {
      title: "Transferred to Finished Goods",
      value: formatNumberIN(s.transferred_to_finished_goods_base_qty),
    },
    {
      title: "Bulk Achievement %",
      value: formatPercent(s.bulk_production_achievement_pct),
    },
    {
      title: "FG Transfer Achievement %",
      value: formatPercent(s.fg_transfer_achievement_pct),
    },
    {
      title: "Active Pipeline Batches",
      value: formatIntegerIN(s.active_pipeline_batch_count),
    },
    {
      title: "Overdue WIP Batches",
      value: formatIntegerIN(s.overdue_work_in_process_batch_count),
      state:
        Number(s.overdue_work_in_process_batch_count) > 0 ? "warning" : "",
    },
  ];

  const achievementRows = [
    {
      metric: "Planned Production",
      quantity: formatNumberIN(s.planned_production_base_qty),
      variance: "-",
      achievement: "-",
      explanation: s.planned_production_note,
    },
    {
      metric: "Bulk Produced",
      quantity: formatNumberIN(s.bulk_produced_base_qty),
      variance: formatNumberIN(s.bulk_production_variance_base_qty),
      achievement: formatPercent(s.bulk_production_achievement_pct),
      explanation: s.bulk_produced_note,
    },
    {
      metric: "Transferred to Finished Goods",
      quantity: formatNumberIN(s.transferred_to_finished_goods_base_qty),
      variance: formatNumberIN(s.fg_transfer_variance_base_qty),
      achievement: formatPercent(s.fg_transfer_achievement_pct),
      explanation: s.transferred_to_finished_goods_note,
    },
    {
      metric: "Transferred to Finished Goods Value",
      quantity: formatCurrencyINR(s.transferred_to_finished_goods_value),
      variance: "-",
      achievement: "-",
      explanation: s.fg_transfer_achievement_note,
    },
  ];

  const pipelineRows = [
    {
      stage: "Not Initiated",
      count: formatIntegerIN(s.not_initiated_batch_count),
      baseQty: formatNumberIN(s.not_initiated_expected_output_base_qty),
      explanation: s.not_initiated_note,
    },
    {
      stage: "Work in Process",
      count: formatIntegerIN(s.work_in_process_batch_count),
      baseQty: formatNumberIN(s.work_in_process_expected_output_base_qty),
      explanation: s.work_in_process_note,
    },
    {
      stage: "Finished Goods Bulk",
      count: formatIntegerIN(s.finished_goods_bulk_batch_count),
      baseQty: formatNumberIN(s.finished_goods_bulk_on_hand_base_qty),
      explanation: s.finished_goods_bulk_note,
    },
    {
      stage: "Bottled Stock",
      count: formatIntegerIN(s.bottled_stock_batch_count),
      baseQty: formatNumberIN(s.bottled_stock_on_hand_base_qty),
      explanation: s.bottled_stock_note,
    },
    {
      stage: "Active Pipeline Total",
      count: formatIntegerIN(s.active_pipeline_batch_count),
      baseQty: "-",
      explanation: s.active_pipeline_batch_count_note,
    },
    {
      stage: "Overdue Work in Process",
      count: formatIntegerIN(s.overdue_work_in_process_batch_count),
      baseQty: "-",
      explanation: "Positive values require production follow-up.",
    },
    {
      stage: "Transferred Only",
      count: formatIntegerIN(s.transferred_only_batch_count),
      baseQty: formatNumberIN(s.transferred_only_base_qty),
      explanation: s.transferred_only_note,
    },
    {
      stage: "Total Canonical Batches",
      count: formatIntegerIN(s.total_canonical_batch_count),
      baseQty: "-",
      explanation: s.total_canonical_batch_count_note,
    },
  ];

  tabPanel.innerHTML = `
    <div class="production-scope-note">
      <div class="production-period-line">${escapeHtml(periodLine)}</div>
      ${
        s.production_scope_note
          ? `<div>${escapeHtml(s.production_scope_note)}</div>`
          : ""
      }
    </div>

    <div class="production-summary-heading">Production Summary</div>
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

    <div class="production-section">
      <div class="production-section-title">Production Achievement</div>
      <div class="production-table-wrap">
        <table class="production-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th class="num">Quantity / Value</th>
              <th class="num">Variance</th>
              <th class="num">Achievement</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            ${achievementRows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.metric)}</td>
                    <td class="num">${escapeHtml(row.quantity)}</td>
                    <td class="num">${escapeHtml(row.variance)}</td>
                    <td class="num">${escapeHtml(row.achievement)}</td>
                    <td>${escapeHtml(row.explanation || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="production-section">
      <div class="production-section-title">Batch Pipeline</div>
      <div class="production-table-wrap">
        <table class="production-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th class="num">Batch Count</th>
              <th class="num">Base Quantity</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            ${pipelineRows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.stage)}</td>
                    <td class="num">${escapeHtml(row.count)}</td>
                    <td class="num">${escapeHtml(row.baseQty)}</td>
                    <td>${escapeHtml(row.explanation || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
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

async function openFinancePartyDetails(row) {
  if (!financeModalOverlay || !financeModalContent) return;
  FINANCE_LAST_FOCUS = document.activeElement;
  financeModalOverlay.classList.remove("hidden");
  financeModalOverlay.setAttribute("aria-hidden", "false");
  if (financeModalTitle) financeModalTitle.textContent = row.party_name || "-";
  if (financeModalSubtitle) {
    financeModalSubtitle.textContent = `${row.mis_group_name || "-"} | ${formatCurrencyINR(row.outstanding_amount_mis_value)}`;
  }
  financeModalContent.innerHTML = `<div class="finance-status">Loading bill details...</div>`;

  const { data, error } = await supabase
    .from("v_mis_finance_outstanding_detail")
    .select(
      "report_date, mis_group_name, bill_date_text, bill_ref, party_name, outstanding_amount_tally_value, outstanding_amount_abs_line_value",
    )
    .eq("party_name", row.party_name)
    .eq("mis_group_name", row.mis_group_name)
    .order("bill_date_text", { ascending: true });

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
  if (!financeModalOverlay) return;
  if (financeModalOverlay.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  financeModalOverlay.classList.add("hidden");
  financeModalOverlay.setAttribute("aria-hidden", "true");
  if (financeModalContent) financeModalContent.innerHTML = "";
  if (FINANCE_LAST_FOCUS && document.contains(FINANCE_LAST_FOCUS)) {
    FINANCE_LAST_FOCUS.focus?.();
  }
  FINANCE_LAST_FOCUS = null;
}

function wireEvents() {
  refreshBtn?.addEventListener("click", loadExecutiveSummary);
  $("homeBtn")?.addEventListener("click", () => Platform.goHome());
  detailTabs?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".pill");
    if (!btn) return;
    ACTIVE_TAB = btn.getAttribute("data-tab") || "finance";
    renderActiveTab();
  });
  detailTabSelect?.addEventListener("change", () => {
    ACTIVE_TAB = detailTabSelect.value || "finance";
    renderActiveTab();
  });
  tabPanel?.addEventListener("click", (ev) => {
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
    if (ev.key === "Escape") {
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
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

(async function init() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return (window.location.href = "/login.html");

  await loadPermissions(session.user.id);

  if (!PERM_CAN_VIEW) {
    setStatus("You do not have permission to view this module.", "error");
    return;
  }

  wireEvents();
  renderDetailTabs();
  updateFreshnessIndicator();
  await loadExecutiveSummary();
})();

