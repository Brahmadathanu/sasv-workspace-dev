/**
 * execution-gate.js  —  Production Execution Gate v2
 *
 * Sections:
 *  1. Imports & constants
 *  2. State
 *  3. Helpers (formatting, dates)
 *  4. Lens / tab config & navigation
 *  5. Data fetching
 *  6. KPI computation
 *  7. Signal / guidance helpers
 *  8. Render (table, modal, KPI strip)
 *  9. Init & event wiring
 */

// ─────────────────────────────────────────────────────────────────
// 1. Imports & Constants
// ─────────────────────────────────────────────────────────────────
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const VIEW_PM = "pm_issue_priority_snapshot_current_month";
const VIEW_RM = "rm_issue_priority_snapshot_current_month";
const VIEW_UNASS = "rm_unassigned_issues_snapshot_current_month";
const VIEW_PM_LEV = "pm_leverage_snapshot_current_month";
const VIEW_RM_LEV = "rm_leverage_snapshot_current_month";

// ─────────────────────────────────────────────────────────────────
// KPI Help Definitions
// ─────────────────────────────────────────────────────────────────
const KPI_HELP = {
  // Action Required — PM/RM tabs
  "Shortage Items": {
    text: "Number of distinct RM/PM items currently having actionable shortages after reservation-aware allocation.",
  },
  "Batches Blocked": {
    text: "Total number of production batches currently impacted due to material shortages or issue constraints.",
  },
  "Total Shortage Qty": {
    text: "Aggregate quantity still required to unblock all affected batches. This is the net shortage after considering available stock.",
  },
  "Risk Unlockable (units)": {
    text: "Total production output (in units) that can be unlocked if the shortages on this set of items are resolved. Used for prioritisation.",
  },
  // Action Required — Unassigned tab
  "Items with Unassigned Issues": {
    text: "Distinct RM items that have issue vouchers not yet assigned to a production batch.",
  },
  "Affected Batches (total)": {
    text: "Total batches affected by unassigned issue traceability problems.",
  },
  "Total Risk Locked (units)": {
    text: "Production output currently locked because unassigned issues prevent batch progress.",
  },
  "Latest Activity": {
    text: "Most recent issue voucher date among the items shown, indicating how recently the unassigned issues were last transacted.",
  },
  // Leverage Insight
  "Critical Shortage Items": {
    text: "Items with zero or near-zero stock compared to requirement. Immediate procurement needed.",
  },
  "Partial Coverage Items": {
    text: "Items where stock exists but is insufficient to cover total requirement. Requires planning.",
  },
  "Sufficient Coverage": {
    text: "Items where stock fully satisfies current requirement. No immediate action needed.",
  },
  "Lowest Coverage": {
    text: "Lowest stock-to-requirement ratio among items in this snapshot. Indicates the most critical coverage gap.",
  },
};

const LENS_CONFIG = {
  action: {
    label: "Action Required",
    tabs: [
      {
        id: "pm",
        label: "PM Shortages",
        view: VIEW_PM,
        idField: "pm_stock_item_id",
        nameField: "pm_name",
        uomField: "pm_uom",
        shortageField: "total_remaining_pm_qty",
        blockedField: "blocked_batch_count",
        riskField: "total_risk_unlocked_units",
        tableTitle: "PM shortages requiring action",
        sortOptions: [
          { value: "blocked_batch_count:desc", label: "Most Batches Blocked" },
          {
            value: "total_remaining_pm_qty:desc",
            label: "Largest Remaining Qty",
          },
          { value: "total_risk_unlocked_units:desc", label: "Highest Risk" },
          { value: "pm_name:asc", label: "Item Name A→Z" },
        ],
      },
      {
        id: "rm",
        label: "RM Shortages",
        view: VIEW_RM,
        idField: "rm_stock_item_id",
        nameField: "rm_name",
        uomField: "rm_uom",
        shortageField: "total_remaining_rm_qty",
        blockedField: "blocked_batch_count",
        riskField: "total_risk_share_units",
        tableTitle: "RM shortages requiring action",
        sortOptions: [
          { value: "blocked_batch_count:desc", label: "Most Batches Blocked" },
          {
            value: "total_remaining_rm_qty:desc",
            label: "Largest Remaining Qty",
          },
          { value: "total_risk_share_units:desc", label: "Highest Risk" },
          { value: "rm_name:asc", label: "Item Name A→Z" },
        ],
      },
      {
        id: "unassigned",
        label: "RM Unassigned Issues",
        view: VIEW_UNASS,
        idField: "rm_stock_item_id",
        nameField: "rm_name",
        uomField: "rm_uom",
        shortageField: null,
        blockedField: null,
        affectedField: "affected_batches",
        riskField: "total_risk_locked_units",
        tableTitle: "RM items with unassigned issues",
        sortOptions: [
          { value: "affected_batches:desc", label: "Most Affected Batches" },
          {
            value: "total_risk_locked_units:desc",
            label: "Highest Risk Locked",
          },
          {
            value: "last_issue_voucher_date:desc",
            label: "Most Recent Activity",
          },
          { value: "rm_name:asc", label: "Item Name A→Z" },
        ],
      },
    ],
  },
  leverage: {
    label: "Leverage Insight",
    tabs: [
      {
        id: "pm_leverage",
        label: "PM Leverage",
        view: VIEW_PM_LEV,
        idField: "pm_stock_item_id",
        nameField: "pm_name",
        uomField: "pm_uom",
        tableTitle: "PM leverage — coverage & impact analysis",
        sortOptions: [
          { value: "blocked_batch_count:desc", label: "Most Batches Affected" },
          { value: "shortage_qty:desc", label: "Largest Shortage" },
          { value: "coverage_ratio:asc", label: "Lowest Coverage First" },
          { value: "pm_name:asc", label: "Item Name A→Z" },
        ],
      },
      {
        id: "rm_leverage",
        label: "RM Leverage",
        view: VIEW_RM_LEV,
        idField: "rm_stock_item_id",
        nameField: "rm_name",
        uomField: "rm_uom",
        tableTitle: "RM leverage — coverage & impact analysis",
        sortOptions: [
          { value: "blocked_batch_count:desc", label: "Most Batches Affected" },
          { value: "shortage_qty:desc", label: "Largest Shortage" },
          { value: "coverage_ratio:asc", label: "Lowest Coverage First" },
          { value: "rm_name:asc", label: "Item Name A→Z" },
        ],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────
// 2. State
// ─────────────────────────────────────────────────────────────────
let ACTIVE_LENS = "action";
let ACTIVE_TAB = "pm";
let PAGE = 1;
const PAGE_SIZE = 50;
let SORT_FIELD = null;
let SORT_ASC = false;
let TOTAL_COUNT = null;
let CURRENT_ROWS = [];
let DISPLAY_ROWS = [];
let PERM_CAN_VIEW = true;
let SELECTED_ROW = null;
let LAST_FETCH_TIME = null;
let freshnessTimer = null;

// ─────────────────────────────────────────────────────────────────
// 3. Helper utilities
// ─────────────────────────────────────────────────────────────────
function formatNumber(val, decimals = 0) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function currentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function timeAgoLabel(date) {
  if (!date) return "Not loaded";
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─────────────────────────────────────────────────────────────────
// 4. Lens / tab config & navigation
// ─────────────────────────────────────────────────────────────────
function isActionLens() {
  return ACTIVE_LENS === "action";
}
function isLeverageLens() {
  return ACTIVE_LENS === "leverage";
}

function getCurrentLensConfig() {
  return LENS_CONFIG[ACTIVE_LENS];
}

function getCurrentTabConfig() {
  const lens = getCurrentLensConfig();
  return lens.tabs.find((t) => t.id === ACTIVE_TAB) || lens.tabs[0];
}

function buildTopLensBar() {
  document.querySelectorAll("#topLensBar .lens-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lens === ACTIVE_LENS);
  });
}

function buildSubTabs() {
  const lensCfg = getCurrentLensConfig();
  const pills = document.getElementById("lensPills");
  const sel = document.getElementById("tabSelect");
  pills.innerHTML = "";
  sel.innerHTML = "";
  lensCfg.tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = `pill${tab.id === ACTIVE_TAB ? " active" : ""}`;
    btn.dataset.tab = tab.id;
    btn.type = "button";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => switchTab(tab.id));
    pills.appendChild(btn);

    const opt = document.createElement("option");
    opt.value = tab.id;
    opt.textContent = tab.label;
    opt.selected = tab.id === ACTIVE_TAB;
    sel.appendChild(opt);
  });
}

function switchLens(lensId) {
  if (lensId === ACTIVE_LENS) return;
  ACTIVE_LENS = lensId;
  ACTIVE_TAB = LENS_CONFIG[lensId].tabs[0].id;
  PAGE = 1;
  buildTopLensBar();
  buildSubTabs();
  buildSortSelect();
  updateModalTabs();
  loadData();
}

function switchTab(tabId) {
  if (tabId === ACTIVE_TAB) return;
  ACTIVE_TAB = tabId;
  PAGE = 1;
  buildSubTabs();
  buildSortSelect();
  loadData();
}

function buildSortSelect() {
  const cfg = getCurrentTabConfig();
  const sel = document.getElementById("sortSelect");
  const prev = sel.value;
  sel.innerHTML = "";
  cfg.sortOptions.forEach((opt) => {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    sel.appendChild(el);
  });
  if (prev && sel.querySelector(`option[value="${prev}"]`)) {
    sel.value = prev;
  } else {
    sel.value = cfg.sortOptions[0].value;
  }
  const [field, dir] = sel.value.split(":");
  SORT_FIELD = field;
  SORT_ASC = dir === "asc";
}

// ─────────────────────────────────────────────────────────────────
// 5. Data fetching
// ─────────────────────────────────────────────────────────────────
async function loadData() {
  if (!PERM_CAN_VIEW) {
    showStatus("You don't have permission to view this data.", "error");
    return;
  }
  const cfg = getCurrentTabConfig();
  showStatus("Loading…", "loading");

  try {
    let q = supabase
      .from(cfg.view)
      .select("*")
      .eq("month_start", currentMonthStart());

    // Sort
    if (SORT_FIELD) q = q.order(SORT_FIELD, { ascending: SORT_ASC });

    // Fetch all
    const { data, error } = await q;
    if (error) throw error;

    CURRENT_ROWS = data || [];
    LAST_FETCH_TIME = new Date();
    updateFreshnessIndicator();

    applyClientFilters();
  } catch (err) {
    showStatus(`Error loading data: ${err.message}`, "error");
    console.error(err);
  }
}

function applyClientFilters() {
  const cfg = getCurrentTabConfig();
  const search = (document.getElementById("searchBox")?.value || "")
    .toLowerCase()
    .trim();

  DISPLAY_ROWS = CURRENT_ROWS.filter((row) => {
    // Search filter
    if (search) {
      const name = String(row[cfg.nameField] || "").toLowerCase();
      const id = String(row[cfg.idField] || "").toLowerCase();
      if (!name.includes(search) && !id.includes(search)) return false;
    }
    return true;
  });

  TOTAL_COUNT = DISPLAY_ROWS.length;
  PAGE = 1;
  renderPage();
}

function getPageRows() {
  const start = (PAGE - 1) * PAGE_SIZE;
  return DISPLAY_ROWS.slice(start, start + PAGE_SIZE);
}

// ─────────────────────────────────────────────────────────────────
// 6. KPI computation
// ─────────────────────────────────────────────────────────────────

/** Renders a single KPI card with a floating popover info button aligned right. */
const _KPI_INFO_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8" stroke-width="3"/><path d="M12 12v5"/></svg>`;

function kpiCard(cls, label, value) {
  return `<div class="kpi ${cls}"><div class="kpi-header"><span class="kpi-label">${label}</span><button class="kpi-info-btn" type="button" data-kpi="${label}" aria-label="About: ${label}">${_KPI_INFO_SVG}</button></div><div class="kpi-value">${value}</div></div>`;
}

function renderKpis(rows) {
  const el = document.getElementById("kpiStrip");
  if (!el) return;
  const html = isActionLens()
    ? computeActionKpis(rows, ACTIVE_TAB)
    : computeLeverageKpis(rows, ACTIVE_TAB);
  el.innerHTML = html;
}

function computeActionKpis(rows, tabId) {
  if (tabId === "unassigned") {
    const items = rows.length;
    const batches = rows.reduce(
      (s, r) => s + (parseInt(r.affected_batches) || 0),
      0,
    );
    const riskLocked = rows.reduce(
      (s, r) => s + (parseFloat(r.total_risk_locked_units) || 0),
      0,
    );
    const lastDate = rows.reduce((best, r) => {
      const d = r.last_issue_voucher_date;
      return !best || d > best ? d : best;
    }, null);
    return [
      kpiCard("items", "Items with Unassigned Issues", formatNumber(items)),
      kpiCard("blocked", "Affected Batches (total)", formatNumber(batches)),
      kpiCard("risk", "Total Risk Locked (units)", formatNumber(riskLocked)),
      kpiCard("leverage", "Latest Activity", lastDate || "—"),
    ].join("");
  }
  const cfg = getCurrentTabConfig();
  const items = rows.length;
  const batches = rows.reduce(
    (s, r) => s + (parseInt(r[cfg.blockedField]) || 0),
    0,
  );
  const shortage = rows.reduce(
    (s, r) => s + (parseFloat(r[cfg.shortageField]) || 0),
    0,
  );
  const risk = rows.reduce(
    (s, r) => s + (parseFloat(r[cfg.riskField]) || 0),
    0,
  );
  return [
    kpiCard("items", "Shortage Items", formatNumber(items)),
    kpiCard("blocked", "Batches Blocked", formatNumber(batches)),
    kpiCard("risk", "Total Shortage Qty", formatNumber(shortage)),
    kpiCard("leverage", "Risk Unlockable (units)", formatNumber(risk)),
  ].join("");
}

function computeLeverageKpis(rows) {
  const critical = rows.filter(
    (r) => r.leverage_category === "CRITICAL_SHORTAGE",
  ).length;
  const partial = rows.filter((r) => r.leverage_category === "PARTIAL").length;
  const sufficient = rows.filter(
    (r) => r.leverage_category === "SUFFICIENT",
  ).length;
  const coverages = rows
    .map((r) => parseFloat(r.coverage_ratio))
    .filter((v) => !isNaN(v));
  const minCov = coverages.length ? Math.min(...coverages) : null;
  return [
    kpiCard("risk", "Critical Shortage Items", formatNumber(critical)),
    kpiCard("blocked", "Partial Coverage Items", formatNumber(partial)),
    kpiCard("items", "Sufficient Coverage", formatNumber(sufficient)),
    kpiCard(
      "leverage",
      "Lowest Coverage",
      minCov !== null ? formatNumber(minCov * 100, 1) + "%" : "—",
    ),
  ].join("");
}

// ─────────────────────────────────────────────────────────────────
// 7. Signal / guidance helpers
// ─────────────────────────────────────────────────────────────────
/**
 * Returns true when a row is in the action snapshot but shortage is zero/negative
 * while blocked batches still exist. This is a soft inference — the row is present
 * in the snapshot and warrants review, not a proven reservation conflict.
 */
function isAllocationConflictRow(row, tabId) {
  if (tabId === "unassigned") return false;
  const cfg = getCurrentTabConfig();
  const shortage = parseFloat(row[cfg.shortageField]) || 0;
  const blocked = parseInt(row[cfg.blockedField]) || 0;
  return shortage <= 0 && blocked > 0;
}

function getActionSignal(row, tabId) {
  if (tabId === "unassigned") {
    return { label: "Assignment Issue", css: "sig-assign" };
  }
  const cfg = getCurrentTabConfig();
  const shortage = parseFloat(row[cfg.shortageField]) || 0;
  // stock_qty is absent from action snapshots — do not use it to infer severity
  if (shortage > 0) {
    return { label: "Shortage", css: "sig-shortage" };
  }
  if (isAllocationConflictRow(row, tabId)) {
    return { label: "Needs Review", css: "sig-conflict" };
  }
  // Fallback: still in action snapshot but no clear trigger — flag for review
  return { label: "Needs Review", css: "sig-conflict" };
}

function getLeverageSignal(row) {
  const cat = row.leverage_category;
  if (cat === "CRITICAL_SHORTAGE")
    return { label: "Critical Coverage Gap", css: "sig-gap" };
  if (cat === "PARTIAL")
    return { label: "Partial Coverage", css: "sig-widespread" };
  if (cat === "SUFFICIENT")
    return { label: "Coverage Adequate", css: "sig-adequate" };
  const batches = parseInt(row.blocked_batch_count) || 0;
  if (batches > 5) return { label: "Widespread Usage", css: "sig-widespread" };
  return { label: "High Leverage", css: "sig-hi-lev" };
}

function getActionGuidance(row, tabId) {
  if (tabId === "unassigned") {
    return {
      heading: "Resolve Assignment Issue",
      body: "This material has RM issues that have not been assigned to a batch. Investigate the issue voucher and assign it to the correct batch or close the issue if superseded.",
      style: "action-info",
    };
  }
  const cfg = getCurrentTabConfig();
  const shortage = parseFloat(row[cfg.shortageField]) || 0;
  const blocked = parseInt(row[cfg.blockedField]) || 0;
  // stock_qty is not available in action snapshots — only check it if actually present
  const stockPresent = row.stock_qty !== undefined && row.stock_qty !== null;
  const stock = stockPresent ? parseFloat(row.stock_qty) || 0 : null;

  if (shortage > 0) {
    if (stockPresent && stock <= 0) {
      return {
        heading: "Initiate Procurement",
        body: `Stock is at or near zero and a shortage of ${formatNumber(shortage)} ${row[cfg.uomField] || ""} remains unresolved. Raise a purchase requisition or expedite an existing order to clear this shortage.`,
        style: "action-warn",
      };
    }
    if (stockPresent && stock > 0) {
      return {
        heading: "Allocate Available Stock & Procure Balance",
        body: `Available stock exists but does not fully cover the current requirement. Allocate stock to the highest-priority batches first, then procure the remaining balance of ${formatNumber(shortage)} ${row[cfg.uomField] || ""}.`,
        style: "",
      };
    }
    // stock_qty not available — give a safe, actionable shortage message
    return {
      heading: "Shortage Requires Attention",
      body: `A shortage of ${formatNumber(shortage)} ${row[cfg.uomField] || ""} is recorded on this item. Review open purchase orders and batch reservations to determine the fastest path to resolution.`,
      style: "action-warn",
    };
  }
  if (blocked > 0) {
    return {
      heading: "Review Allocation Priority",
      body: "No direct shortage is recorded on this item, but associated batches remain present in the action snapshot. Review batch sequencing and reservation priority before changing issue decisions.",
      style: "action-info",
    };
  }
  return {
    heading: "No Immediate Action Required",
    body: "This item does not show an actionable shortage at this time. Monitor production progress and recheck if status changes.",
    style: "action-ok",
  };
}

function getLeverageGuidance(row) {
  if (!parseFloat(row.total_required_qty)) {
    return {
      heading: "No Current Requirement Recorded",
      body: "No current shortage requirement is recorded in this snapshot. Continue monitoring.",
      style: "action-ok",
    };
  }
  const cat = row.leverage_category;
  if (cat === "CRITICAL_SHORTAGE") {
    return {
      heading: "Strategic Blocker — Immediate Replenishment Needed",
      body: "Coverage is critically low. This item is a strategic blocker for multiple batches. Prioritise replenishment in the procurement planning workbench.",
      style: "action-warn",
    };
  }
  if (cat === "PARTIAL") {
    return {
      heading: "Plan Replenishment",
      body: "Partial stock coverage exists. Plan replenishment to avoid future shortages. Review MRP output and update production schedules as needed.",
      style: "",
    };
  }
  return {
    heading: "Coverage Currently Sufficient",
    body: "Stock coverage meets current requirements. No immediate action is needed. Continue monitoring usage patterns and recheck at next planning cycle.",
    style: "action-ok",
  };
}

function coverageChip(category) {
  if (!category) return "—";
  const map = {
    CRITICAL_SHORTAGE: ["cov-critical", "Critical Shortage"],
    PARTIAL: ["cov-partial", "Partial"],
    SUFFICIENT: ["cov-sufficient", "Sufficient"],
  };
  const [cls, label] = map[category] || ["", category];
  return `<span class="signal-chip ${cls}">${label}</span>`;
}

function signalChip(label, css) {
  return `<span class="signal-chip ${css}">${label}</span>`;
}

// ─────────────────────────────────────────────────────────────────
// 8. Render
// ─────────────────────────────────────────────────────────────────

// ── 8a. Status area / loading ───────────────────────────────────
function showStatus(msg, type = "info") {
  const sa = document.getElementById("statusArea");
  const tw = document.getElementById("tableWrap");
  if (!sa || !tw) return;
  sa.textContent = msg;
  sa.style.display = "block";
  sa.dataset.type = type;
  tw.classList.remove("tw-visible");
}

function hideStatus() {
  const sa = document.getElementById("statusArea");
  const tw = document.getElementById("tableWrap");
  if (!sa || !tw) return;
  sa.style.display = "none";
  tw.classList.add("tw-visible");
}

// ── 8b. Table ───────────────────────────────────────────────────
function getActionColumns(tabId) {
  if (tabId === "unassigned") {
    return [
      { label: "Item", key: "_item", cls: "c-left" },
      { label: "UOM", key: "rm_uom", cls: "c-center" },
      { label: "Affected Batches", key: "affected_batches", cls: "c-right" },
      { label: "Risk Locked", key: "total_risk_locked_units", cls: "c-right" },
      {
        label: "Last Activity",
        key: "last_issue_voucher_date",
        cls: "c-center",
      },
      { label: "Signal", key: "_signal", cls: "c-center" },
    ];
  }
  const cfg = getCurrentTabConfig();
  return [
    { label: "Item", key: "_item", cls: "c-left" },
    { label: "UOM", key: cfg.uomField, cls: "c-center" },
    { label: "Batches Blocked", key: cfg.blockedField, cls: "c-right" },
    { label: "Shortage Qty", key: cfg.shortageField, cls: "c-right" },
    { label: "Risk (units)", key: cfg.riskField, cls: "c-right" },
    { label: "Signal", key: "_signal", cls: "c-center" },
  ];
}

function getLeverageColumns() {
  const cfg = getCurrentTabConfig();
  return [
    { label: "Item", key: "_item", cls: "c-left" },
    { label: "UOM", key: cfg.uomField, cls: "c-center" },
    { label: "Affected Batches", key: "blocked_batch_count", cls: "c-right" },
    { label: "Required Qty", key: "total_required_qty", cls: "c-right" },
    { label: "Stock Qty", key: "stock_qty", cls: "c-right" },
    { label: "Shortage Qty", key: "shortage_qty", cls: "c-right" },
    { label: "Coverage", key: "_coverage", cls: "c-center" },
    { label: "Signal", key: "_signal", cls: "c-center" },
  ];
}

function renderTableHead(columns) {
  const thead = document.getElementById("tableHead");
  if (!thead) return;
  thead.innerHTML = `<tr>${columns.map((c) => `<th class="${c.cls}">${c.label}</th>`).join("")}</tr>`;
}

function renderTableBody(rows, columns, tabId) {
  const tbody = document.getElementById("tableBody");
  const cfg = getCurrentTabConfig();
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="c-center" style="padding:24px;color:var(--muted)">No items found</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((row) => {
      const cells = columns.map((col) => {
        let val;
        if (col.key === "_item") {
          val = `<div class="item-cell"><span class="item-name">${row[cfg.nameField] || "—"}</span><span class="item-id-muted">${row[cfg.idField] || ""}</span></div>`;
        } else if (col.key === "_signal") {
          if (isActionLens()) {
            const sig = getActionSignal(row, tabId);
            val = signalChip(sig.label, sig.css);
          } else {
            const sig = getLeverageSignal(row);
            val = signalChip(sig.label, sig.css);
          }
        } else if (col.key === "_coverage") {
          val = coverageChip(row.leverage_category);
        } else {
          const raw = row[col.key];
          if (raw === null || raw === undefined) {
            val = "—";
          } else if (
            typeof raw === "number" ||
            (!isNaN(parseFloat(raw)) && col.cls === "c-right")
          ) {
            val = formatNumber(raw);
          } else {
            val = raw;
          }
        }
        return `<td class="${col.cls}">${val}</td>`;
      });
      return `<tr class="clickable" data-id="${row[cfg.idField]}">${cells.join("")}</tr>`;
    })
    .join("");

  // Row click → open modal
  tbody.querySelectorAll("tr.clickable").forEach((tr, i) => {
    tr.addEventListener("click", () => {
      SELECTED_ROW = rows[i];
      openModal(rows[i]);
    });
  });
}

function renderPage() {
  const cfg = getCurrentTabConfig();
  const rows = getPageRows();

  // Table title
  const tt = document.getElementById("tableTitle");
  if (tt) tt.textContent = cfg.tableTitle;

  // KPIs from all filtered rows (not just page)
  renderKpis(DISPLAY_ROWS);

  // Columns
  const columns = isActionLens()
    ? getActionColumns(ACTIVE_TAB)
    : getLeverageColumns();

  renderTableHead(columns);
  renderTableBody(rows, columns, ACTIVE_TAB);

  if (rows.length > 0) hideStatus();
  else if (!DISPLAY_ROWS.length)
    showStatus("No items match the current filters.", "info");

  renderPagination();
}

// ── 8c. Pagination ──────────────────────────────────────────────
function renderPagination() {
  const total = TOTAL_COUNT || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pi = document.getElementById("pageInfo");
  const prevB = document.getElementById("prevBtn");
  const nextB = document.getElementById("nextBtn");
  if (pi) pi.textContent = `Page ${PAGE} of ${pages}`;
  if (prevB) prevB.disabled = PAGE <= 1;
  if (nextB) nextB.disabled = PAGE >= pages;
}

// ── 8d. Modal ───────────────────────────────────────────────────
function updateModalTabs() {
  const tabsEl = document.getElementById("modalTabs");
  if (!tabsEl) return;
  let tabs;
  if (isActionLens()) {
    tabs = [
      { key: "overview", label: "Overview" },
      { key: "secondary", label: "Why Blocking" },
      { key: "guidance", label: "Action Guidance" },
    ];
  } else {
    tabs = [
      { key: "overview", label: "Overview" },
      { key: "secondary", label: "Coverage" },
      { key: "guidance", label: "Planning Guidance" },
    ];
  }
  tabsEl.innerHTML = tabs
    .map(
      (t, i) =>
        `<button class="modal-tab${i === 0 ? " active" : ""}" data-tab="${t.key}" type="button">${t.label}</button>`,
    )
    .join("");
  tabsEl.querySelectorAll(".modal-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsEl
        .querySelectorAll(".modal-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (SELECTED_ROW) renderModalContent(SELECTED_ROW, btn.dataset.tab);
    });
  });
}

function openModal(row) {
  const overlay = document.getElementById("detailsModal");
  const titleEl = document.getElementById("modalTitle");
  const subEl = document.getElementById("modalSubtitle");
  if (!overlay) return;

  const cfg = getCurrentTabConfig();
  const name = row[cfg.nameField] || "—";
  const id = row[cfg.idField] || "";
  if (titleEl) titleEl.textContent = name;
  if (subEl)
    subEl.innerHTML = `<span>${id}</span><span>${cfg.label || cfg.id}</span>`;

  updateModalTabs();
  renderModalContent(row, "overview");

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const overlay = document.getElementById("detailsModal");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  SELECTED_ROW = null;
}

function renderModalContent(row, tab) {
  const el = document.getElementById("modalContent");
  if (!el) return;

  if (tab === "overview") {
    el.innerHTML = isActionLens()
      ? renderActionOverview(row)
      : renderLeverageOverview(row);
  } else if (tab === "secondary") {
    el.innerHTML = isLeverageLens()
      ? renderCoverageTab(row)
      : renderWhyBlocking(row);
  } else if (tab === "guidance") {
    el.innerHTML = isActionLens()
      ? renderActionGuidanceTab(row)
      : renderPlanningGuidanceTab(row);
  }
}

function renderActionOverview(row) {
  const cfg = getCurrentTabConfig();
  const tabId = ACTIVE_TAB;
  const sig = getActionSignal(row, tabId);
  const blockedVal =
    tabId === "unassigned"
      ? formatNumber(row.affected_batches)
      : formatNumber(row[cfg.blockedField]);

  const shortage =
    tabId === "unassigned" ? null : parseFloat(row[cfg.shortageField]) || 0;
  const shortageDisplay =
    shortage == null ? null : shortage > 0 ? formatNumber(shortage) : "—";
  const qtyLabel =
    tabId === "unassigned"
      ? "Risk Locked (units)"
      : "Current actionable shortage";
  const qtyVal =
    tabId === "unassigned"
      ? formatNumber(row.total_risk_locked_units)
      : shortageDisplay;

  const riskLabel =
    tabId === "unassigned" ? "Last Activity" : "Risk Unlockable (units)";
  const riskVal =
    tabId === "unassigned"
      ? row.last_issue_voucher_date || "—"
      : formatNumber(row[cfg.riskField]);

  // Execution interpretation
  let execInterp;
  if (tabId === "unassigned") execInterp = "Assignment issue";
  else if (shortage > 0) execInterp = "Direct shortage";
  else if (isAllocationConflictRow(row, tabId)) execInterp = "Needs review";
  else execInterp = "Needs review";

  // Stock qty if present in row (leverage views have it; action views may not)
  const hasStock = row.stock_qty !== undefined && row.stock_qty !== null;
  const stockLine = hasStock
    ? `<div class="eg-kv"><span class="eg-k">Stock Qty</span><span class="eg-v">${formatNumber(row.stock_qty)}</span></div>`
    : "";

  return `
    <div class="eg-card">
      <div class="eg-card-title">Material Overview</div>
      <div class="eg-kv"><span class="eg-k">Item ID</span><span class="eg-v">${row[cfg.idField] || "—"}</span></div>
      <div class="eg-kv"><span class="eg-k">Item Name</span><span class="eg-v">${row[cfg.nameField] || "—"}</span></div>
      <div class="eg-kv"><span class="eg-k">UOM</span><span class="eg-v">${row[cfg.uomField] || "—"}</span></div>
      <div class="eg-kv"><span class="eg-k">Signal</span><span class="eg-v">${signalChip(sig.label, sig.css)}</span></div>
      <div class="eg-kv"><span class="eg-k">Execution interpretation</span><span class="eg-v">${execInterp}</span></div>
    </div>
    <div class="eg-grid">
      <div class="eg-card">
        <div class="eg-card-title">Impact</div>
        <div class="eg-kv"><span class="eg-k">${tabId === "unassigned" ? "Affected Batches" : "Batches Blocked"}</span><span class="eg-v">${blockedVal}</span></div>
        <div class="eg-kv"><span class="eg-k">${qtyLabel}</span><span class="eg-v">${qtyVal}</span></div>
        ${stockLine}
        <div class="eg-kv"><span class="eg-k">${riskLabel}</span><span class="eg-v">${riskVal}</span></div>
      </div>
    </div>`;
}

function renderLeverageOverview(row) {
  const cfg = getCurrentTabConfig();
  const sig = getLeverageSignal(row);
  return `
    <div class="eg-card">
      <div class="eg-card-title">Material Overview</div>
      <div class="eg-kv"><span class="eg-k">Item ID</span><span class="eg-v">${row[cfg.idField] || "—"}</span></div>
      <div class="eg-kv"><span class="eg-k">Item Name</span><span class="eg-v">${row[cfg.nameField] || "—"}</span></div>
      <div class="eg-kv"><span class="eg-k">UOM</span><span class="eg-v">${row[cfg.uomField] || "—"}</span></div>
      <div class="eg-kv"><span class="eg-k">Signal</span><span class="eg-v">${signalChip(sig.label, sig.css)}</span></div>
      <div class="eg-kv"><span class="eg-k">Coverage Status</span><span class="eg-v">${coverageChip(row.leverage_category)}</span></div>
    </div>
    <div class="eg-grid">
      <div class="eg-card">
        <div class="eg-card-title">Usage</div>
        <div class="eg-kv"><span class="eg-k">Affected Batches</span><span class="eg-v">${formatNumber(row.blocked_batch_count)}</span></div>
        <div class="eg-kv"><span class="eg-k">Required Qty</span><span class="eg-v">${formatNumber(row.total_required_qty)}</span></div>
      </div>
      <div class="eg-card">
        <div class="eg-card-title">Stock Position</div>
        <div class="eg-kv"><span class="eg-k">Stock Qty</span><span class="eg-v">${formatNumber(row.stock_qty)}</span></div>
        <div class="eg-kv"><span class="eg-k">Shortage Qty</span><span class="eg-v">${formatNumber(row.shortage_qty)}</span></div>
      </div>
    </div>`;
}

function renderWhyBlocking(row) {
  const cfg = getCurrentTabConfig();
  const tabId = ACTIVE_TAB;
  const shortage = parseFloat(row[cfg.shortageField] || row.shortage_qty) || 0;
  const batches =
    parseInt(row[cfg.blockedField] || row.blocked_batch_count) || 0;

  let explanation;
  if (tabId === "unassigned") {
    explanation =
      "This item is blocked by issue assignment / traceability mismatch rather than physical stock shortage.";
  } else if (shortage > 0) {
    explanation =
      "This item is contributing to production blocks because the current actionable requirement remains unresolved in the latest snapshot. Reservation-aware allocation may be a contributing factor.";
  } else if (batches > 0) {
    explanation =
      "This item is present in the action snapshot with associated batches still recorded. No direct shortage is shown, but the situation warrants a review of batch sequencing and reservation priority.";
  } else {
    explanation =
      "No active blocking condition is currently recorded for this item.";
  }

  const shortageDisplay =
    shortage > 0 ? `${formatNumber(shortage)} ${row[cfg.uomField] || ""}` : "—";

  return `
    <div class="eg-info-box">
      ${explanation}
    </div>
    <div class="eg-card">
      <div class="eg-card-title">Blocking Analysis</div>
      <div class="eg-kv"><span class="eg-k">Batches currently blocked</span><span class="eg-v">${formatNumber(batches)}</span></div>
      <div class="eg-kv"><span class="eg-k">Current actionable shortage</span><span class="eg-v">${shortageDisplay}</span></div>
      ${row.total_risk_unlocked_units != null ? `<div class="eg-kv"><span class="eg-k">Risk unlockable if resolved</span><span class="eg-v">${formatNumber(row.total_risk_unlocked_units)} units</span></div>` : ""}
    </div>`;
}

function renderCoverageTab(row) {
  const cov = parseFloat(row.coverage_ratio);
  const covPct = isNaN(cov) ? "—" : formatNumber(cov * 100, 1) + "%";
  return `
    <div class="eg-card">
      <div class="eg-card-title">Coverage Detail</div>
      <div class="eg-kv"><span class="eg-k">Coverage Ratio</span><span class="eg-v">${covPct}</span></div>
      <div class="eg-kv"><span class="eg-k">Stock Qty</span><span class="eg-v">${formatNumber(row.stock_qty)}</span></div>
      <div class="eg-kv"><span class="eg-k">Required Qty</span><span class="eg-v">${formatNumber(row.total_required_qty)}</span></div>
      <div class="eg-kv"><span class="eg-k">Shortage Qty</span><span class="eg-v">${formatNumber(row.shortage_qty)}</span></div>
      <div class="eg-kv"><span class="eg-k">Coverage Status</span><span class="eg-v">${coverageChip(row.leverage_category)}</span></div>
    </div>`;
}

function renderActionGuidanceTab(row) {
  const g = getActionGuidance(row, ACTIVE_TAB);
  return `
    <div class="eg-action-card ${g.style}">
      <div class="eg-action-label">Recommended Action</div>
      <strong>${g.heading}</strong><br><br>${g.body}
    </div>`;
}

function renderPlanningGuidanceTab(row) {
  const g = getLeverageGuidance(row);
  return `
    <div class="eg-action-card ${g.style}">
      <div class="eg-action-label">Planning Guidance</div>
      <strong>${g.heading}</strong><br><br>${g.body}
    </div>`;
}

// ── 8e. Freshness indicator ─────────────────────────────────────
function updateFreshnessIndicator() {
  const container = document.getElementById("lastRefreshed");
  const label = document.querySelector("#lastRefreshed .sc-snapshot-label");
  const detail = document.getElementById("sc-status-detail");
  if (!container || !label) return;
  const t = LAST_FETCH_TIME;
  if (!t) {
    container.className = "sc-snapshot";
    label.textContent = "Not loaded";
    if (detail) detail.textContent = "Last refreshed: —";
    return;
  }
  const s = Math.round((Date.now() - t.getTime()) / 1000);
  const statusClass =
    s < 120
      ? "snapshot-fresh"
      : s < 600
        ? "snapshot-warning"
        : "snapshot-stale";
  container.className = `sc-snapshot ${statusClass}`;
  label.textContent = timeAgoLabel(t);
  if (detail) detail.textContent = `Last refreshed: ${t.toLocaleTimeString()}`;
}

// ── 8f. CSV Export ──────────────────────────────────────────────
async function exportCsvPage() {
  const cfg = getCurrentTabConfig();
  showToast("Preparing export…", "info");
  try {
    const { data, error } = await supabase
      .from(cfg.view)
      .select("*")
      .eq("month_start", currentMonthStart());
    if (error) throw error;
    if (!data || !data.length) {
      showToast("No data to export.", "info");
      return;
    }
    const headers = Object.keys(data[0]);
    const rows = data.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          if (v === null || v === undefined) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cfg.view}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${formatNumber(data.length)} rows.`, "success");
  } catch (err) {
    showToast(`Export failed: ${err.message}`, "error");
  }
}

// ── 8g. Toast ───────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const container = document.getElementById("egToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `eg-toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  }, 3200);
}

// ─────────────────────────────────────────────────────────────────
// 9. Init & event wiring
// ─────────────────────────────────────────────────────────────────
async function loadPermissions() {
  // Permissions check — extend as needed
  PERM_CAN_VIEW = true;
}

async function refreshSnapshotAndReload() {
  // Lightweight reload — just re-fetch data (no heavy snapshot rebuild)
  showStatus("Reloading latest served snapshots\u2026", "loading");
  PAGE = 1;
  await loadData();
  showToast("Latest execution gate snapshots reloaded.", "success");
}

// ─────────────────────────────────────────────────────────────────
// Output actions — settings, row building, copy, PDF
// ─────────────────────────────────────────────────────────────────

/** Read current output filter settings from the Refine output panel. */
function getOutputOptions() {
  return {
    severity: document.getElementById("outSeverity")?.value || "all",
    minShortage:
      parseFloat(document.getElementById("outMinShortage")?.value) || 0,
    topN: parseInt(document.getElementById("outTopN")?.value) || 0,
    sort: document.getElementById("outSort")?.value || "priority",
  };
}

/** Plain-language recommendation for one action-sheet row. */
function getItemRecommendation(d) {
  if (d._isUnassigned) return "Resolve assignment issue";
  if (d.shortage > 0) {
    if (d.stock !== null && d.stock > 0)
      return "Allocate available stock and procure balance";
    return "Initiate procurement";
  }
  if (d.batches > 0) return "Review allocation priority";
  return "Monitor coverage";
}

/**
 * Build, filter, sort, and rank action-sheet rows from a raw row array.
 * Uses the active tab config plus output options.
 */
function buildActionSheetRows(rows, options = {}) {
  const cfg = getCurrentTabConfig();
  const isUnassigned = ACTIVE_TAB === "unassigned";
  const {
    severity = "all",
    minShortage = 0,
    topN = 0,
    sort = "priority",
  } = options;

  // Field resolution — leverage tabs omit these from config; fall back to view column names
  const shortageField = cfg.shortageField || "shortage_qty";
  const blockedField =
    cfg.blockedField || cfg.affectedField || "blocked_batch_count";
  const riskField = cfg.riskField || null;

  let mapped = rows.map((r) => ({
    _isUnassigned: isUnassigned,
    name: r[cfg.nameField] || "\u2014",
    uom: r[cfg.uomField] || "",
    stock:
      r.stock_qty !== undefined && r.stock_qty !== null
        ? parseFloat(r.stock_qty)
        : null,
    shortage: parseFloat(r[shortageField]) || 0,
    coverage:
      r.coverage_ratio !== undefined && r.coverage_ratio !== null
        ? parseFloat(r.coverage_ratio)
        : null,
    batches: parseInt(r[blockedField]) || 0,
    risk: riskField ? parseFloat(r[riskField]) || 0 : 0,
  }));

  // Actionability filter
  if (isUnassigned) {
    mapped = mapped.filter((d) => d.batches > 0);
  } else {
    mapped = mapped.filter((d) => d.shortage > 0);
  }

  // Minimum shortage threshold
  if (minShortage > 0) {
    mapped = mapped.filter((d) => d.shortage >= minShortage);
  }

  // Severity filter — only meaningful when coverage_ratio is available
  if (severity !== "all" && mapped.some((d) => d.coverage !== null)) {
    if (severity === "critical") {
      mapped = mapped.filter((d) => d.coverage === null || d.coverage < 0.1);
    } else if (severity === "partial") {
      mapped = mapped.filter(
        (d) => d.coverage !== null && d.coverage >= 0.1 && d.coverage < 1.0,
      );
    }
  }

  // Sort
  switch (sort) {
    case "shortage":
      mapped.sort((a, b) => b.shortage - a.shortage);
      break;
    case "batches":
      mapped.sort((a, b) => b.batches - a.batches);
      break;
    case "risk":
      mapped.sort((a, b) => b.risk - a.risk);
      break;
    default: // "priority" — shortage desc, then batches desc
      mapped.sort((a, b) =>
        b.shortage !== a.shortage
          ? b.shortage - a.shortage
          : b.batches - a.batches,
      );
  }

  // Top N
  if (topN > 0) mapped = mapped.slice(0, topN);

  // Rank and recommendation
  return mapped.map((d, idx) => ({
    ...d,
    rank: idx + 1,
    recommendation: getItemRecommendation(d),
  }));
}

/** Generate plain-text action list. No emoji, no branding footer. */
function generateActionListText(rows, context) {
  const { tabLabel } = context;
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  let text = `Material Action List (${tabLabel})\nDate: ${date}\n\n`;
  rows.forEach((d) => {
    text += `${d.rank}. ${d.name}\n`;
    if (d.stock !== null)
      text += `   Stock: ${formatNumber(d.stock)} ${d.uom}\n`;
    if (d.shortage > 0)
      text += `   Shortage: ${formatNumber(d.shortage)} ${d.uom}\n`;
    if (d.coverage !== null)
      text += `   Coverage: ${(d.coverage * 100).toFixed(1)}%\n`;
    let impact = `   Impact: ${d.batches} ${d.batches === 1 ? "batch" : "batches"}`;
    if (d.risk) impact += ` | ${formatNumber(d.risk)} units unlockable`;
    text += impact + "\n";
    text += `   Action: ${d.recommendation}\n\n`;
  });
  return text.trimEnd();
}

/** Generate styled HTML document for PDF export — purpose-built, not a UI screenshot. */
function generateActionListHtml(rows, context, options = {}) {
  const { tabLabel } = context;
  const { severity = "all", minShortage = 0, topN = 0 } = options;
  const date = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const ts = new Date().toLocaleString("en-GB");

  const filterParts = [];
  if (severity === "critical") filterParts.push("Critical shortage only");
  else if (severity === "partial") filterParts.push("Partial coverage only");
  if (minShortage > 0)
    filterParts.push(`Min shortage: ${formatNumber(minShortage)}`);
  if (topN > 0) filterParts.push(`Top ${topN}`);
  const filterLine = filterParts.length
    ? filterParts.join("  \u00b7  ")
    : "All actionable items";

  const rowsHtml = rows
    .map(
      (d) => `<tr>
    <td class="rank">${d.rank}</td>
    <td><span class="nm">${d.name}</span></td>
    <td class="r">${d.uom}</td>
    <td class="r">${d.stock !== null ? formatNumber(d.stock) : "\u2014"}</td>
    <td class="r">${d.shortage > 0 ? formatNumber(d.shortage) : "\u2014"}</td>
    <td class="r">${d.coverage !== null ? (d.coverage * 100).toFixed(1) + "%" : "\u2014"}</td>
    <td class="r">${d.batches}</td>
    <td>${d.recommendation}</td>
  </tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Material Action List \u2014 ${tabLabel}</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;font-size:12px;color:#1a1a1a;margin:0;padding:28px 32px}
  h1{font-size:16px;font-weight:700;color:#1e3a8a;margin:0 0 2px}
  .meta{font-size:11px;color:#64748b;margin-bottom:4px}
  .filter-line{display:inline-block;background:#f0f4ff;border:1px solid #bfdbfe;border-radius:4px;padding:2px 10px;font-size:10.5px;color:#1e40af;margin-bottom:14px}
  table{border-collapse:collapse;width:100%}
  th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;color:#475569;padding:6px 8px;text-align:left;border-bottom:2px solid #e2e8f0}
  td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11.5px;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .rank{color:#94a3b8;font-weight:600;white-space:nowrap;width:24px}
  .nm{font-weight:600;color:#0f172a}
  .r{text-align:right;white-space:nowrap}
  .footer{margin-top:14px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:5px}
</style>
</head><body>
<h1>Material Action List \u2014 ${tabLabel}</h1>
<div class="meta">Date: ${date} &emsp; Generated: ${ts}</div>
<div class="filter-line">${filterLine} &ensp;&middot;&ensp; ${rows.length} item${rows.length !== 1 ? "s" : ""}</div>
<table><thead><tr>
  <th>#</th><th>Item</th><th>UOM</th>
  <th class="r">Stock</th><th class="r">Shortage</th>
  <th class="r">Coverage</th><th class="r">Batches</th>
  <th>Recommendation</th>
</tr></thead>
<tbody>${rowsHtml}</tbody></table>
</body></html>`;
}

/**
 * Export action sheet as PDF.
 * Uses Electron sopAPI (window.print-free) when available; falls back to HTML blob download.
 */
async function exportActionSheetPdf(rows, context, options) {
  const { tabLabel } = context;
  const html = generateActionListHtml(rows, context, options);
  const stem = `Action-Sheet-${tabLabel.replace(/[^A-Za-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;

  if (window.sopAPI?.exportPdfFromHtml) {
    showToast("Generating PDF\u2026", "info");
    try {
      const res = await window.sopAPI.exportPdfFromHtml(stem, html, {
        pageSize: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "18mm", bottom: "14mm", left: "14mm", right: "14mm" },
      });
      if (res?.ok && res.pdfBase64) {
        const bytes = new Uint8Array(
          [...atob(res.pdfBase64)].map((c) => c.charCodeAt(0)),
        );
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.suggestedName || `${stem}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("PDF saved.", "success");
      } else {
        showToast(res?.error || "PDF generation failed.", "error");
      }
    } catch (err) {
      showToast(`PDF export error: ${err.message}`, "error");
    }
  } else {
    // Fallback: HTML blob download — user can open and save as PDF from browser
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stem}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Saved as HTML \u2014 open in browser and save as PDF.", "info");
  }
}

function toggleOutputMenu() {
  const menu = document.getElementById("outputMenu");
  if (!menu) return;
  const nowHidden = menu.classList.toggle("output-menu--hidden");
  document
    .getElementById("outputBtn")
    ?.setAttribute("aria-expanded", String(!nowHidden));
}

function closeOutputMenu() {
  const menu = document.getElementById("outputMenu");
  if (!menu || menu.classList.contains("output-menu--hidden")) return;
  menu.classList.add("output-menu--hidden");
  document.getElementById("outputBtn")?.setAttribute("aria-expanded", "false");
}

function init() {
  // Build navigation
  buildTopLensBar();
  buildSubTabs();
  buildSortSelect();
  updateModalTabs();

  // Lens selector
  document.querySelectorAll("#topLensBar .lens-pill").forEach((btn) => {
    btn.addEventListener("click", () => switchLens(btn.dataset.lens));
  });

  // Tab select (mobile)
  const tabSel = document.getElementById("tabSelect");
  if (tabSel) tabSel.addEventListener("change", () => switchTab(tabSel.value));

  // Sort select
  const sortSel = document.getElementById("sortSelect");
  if (sortSel) {
    sortSel.addEventListener("change", () => {
      const [f, d] = sortSel.value.split(":");
      SORT_FIELD = f;
      SORT_ASC = d === "asc";
      PAGE = 1;
      loadData();
    });
  }

  // Search
  const searchBox = document.getElementById("searchBox");
  const searchClear = document.getElementById("searchClear");
  const debouncedSearch = debounce(() => {
    PAGE = 1;
    applyClientFilters();
  });
  if (searchBox) {
    searchBox.addEventListener("input", () => {
      if (searchClear)
        searchClear.style.display = searchBox.value ? "flex" : "none";
      debouncedSearch();
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", () => {
      if (searchBox) {
        searchBox.value = "";
        searchBox.focus();
      }
      searchClear.style.display = "none";
      PAGE = 1;
      applyClientFilters();
    });
  }

  // Pagination
  document.getElementById("prevBtn")?.addEventListener("click", () => {
    if (PAGE > 1) {
      PAGE--;
      renderPage();
    }
  });
  document.getElementById("nextBtn")?.addEventListener("click", () => {
    const pages = Math.ceil((TOTAL_COUNT || 0) / PAGE_SIZE);
    if (PAGE < pages) {
      PAGE++;
      renderPage();
    }
  });

  // Refresh / Home
  document
    .getElementById("refreshBtn")
    ?.addEventListener("click", refreshSnapshotAndReload);
  document
    .getElementById("homeBtn")
    ?.addEventListener("click", () => Platform.goHome());

  // Output menu — open/close
  document.getElementById("outputBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOutputMenu();
  });
  document.addEventListener("click", (e) => {
    const wrap = document.getElementById("outputMenuWrap");
    if (wrap && !wrap.contains(e.target)) closeOutputMenu();
  });

  // Output menu — Refine toggle
  document.getElementById("refineToggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const panel = document.getElementById("refinePanel");
    const btn = document.getElementById("refineToggle");
    if (!panel || !btn) return;
    const nowHidden = panel.classList.toggle("omenu-refine--hidden");
    btn.setAttribute("aria-expanded", String(!nowHidden));
  });

  // Output menu — actions
  document.getElementById("menuExportCsv")?.addEventListener("click", () => {
    closeOutputMenu();
    exportCsvPage();
  });
  document
    .getElementById("menuCopyList")
    ?.addEventListener("click", async () => {
      closeOutputMenu();
      const cfg = getCurrentTabConfig();
      const options = getOutputOptions();
      const rows = buildActionSheetRows(CURRENT_ROWS, options);
      if (!rows.length) {
        showToast(
          "No actionable rows found for the current output filters.",
          "info",
        );
        return;
      }
      const text = generateActionListText(rows, { tabLabel: cfg.label });
      await navigator.clipboard.writeText(text);
      showToast(
        `${rows.length} item${rows.length !== 1 ? "s" : ""} copied to clipboard.`,
        "success",
      );
    });
  document
    .getElementById("menuDownloadPdf")
    ?.addEventListener("click", async () => {
      closeOutputMenu();
      const cfg = getCurrentTabConfig();
      const options = getOutputOptions();
      const rows = buildActionSheetRows(CURRENT_ROWS, options);
      if (!rows.length) {
        showToast(
          "No actionable rows found for the current output filters.",
          "info",
        );
        return;
      }
      await exportActionSheetPdf(rows, { tabLabel: cfg.label }, options);
    });

  // Modal close
  document
    .getElementById("modalCloseBtn")
    ?.addEventListener("click", closeModal);
  document.getElementById("detailsModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeOutputMenu();
    }
  });

  // About toggle
  const aboutToggle = document.getElementById("aboutToggle");
  const aboutPanel = document.getElementById("aboutPanel");
  if (aboutToggle && aboutPanel) {
    aboutToggle.addEventListener("click", () => {
      const open = aboutPanel.classList.toggle("open");
      aboutToggle.textContent = open ? "Hide ▴" : "About this view";
    });
  }

  // Freshness click to expand
  const freshnessEl = document.getElementById("lastRefreshed");
  const detailEl = document.getElementById("sc-status-detail");
  if (freshnessEl && detailEl) {
    freshnessEl.addEventListener("click", () => {
      const expanded = freshnessEl.getAttribute("aria-expanded") === "true";
      freshnessEl.setAttribute("aria-expanded", String(!expanded));
      detailEl.style.display = expanded ? "none" : "block";
    });
    freshnessEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        freshnessEl.click();
      }
    });
  }

  // Freshenss auto-update timer
  if (freshnessTimer) clearInterval(freshnessTimer);
  freshnessTimer = setInterval(updateFreshnessIndicator, 30_000);

  // Initial load
  loadPermissions().then(loadData);
  setupKpiPopover();
}

// ─────────────────────────────────────────────────────────────────
// KPI floating popover
// ─────────────────────────────────────────────────────────────────
function setupKpiPopover() {
  const pop = document.createElement("div");
  pop.id = "kpiPopover";
  pop.className = "kpi-popover kpi-popover--hidden";
  pop.setAttribute("role", "tooltip");
  pop.innerHTML = `<div class="kpi-pop-header">About this metric</div><div class="kpi-pop-body"></div>`;
  document.body.appendChild(pop);

  function closePop() {
    pop.classList.add("kpi-popover--hidden");
    pop.dataset.activeKpi = "";
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".kpi-info-btn");
    if (!btn) {
      if (!pop.classList.contains("kpi-popover--hidden")) closePop();
      return;
    }
    e.stopPropagation();
    const label = btn.dataset.kpi;
    if (
      pop.dataset.activeKpi === label &&
      !pop.classList.contains("kpi-popover--hidden")
    ) {
      closePop();
      return;
    }
    const help = KPI_HELP[label];
    pop.querySelector(".kpi-pop-body").textContent = help
      ? help.text
      : "No additional information available.";
    pop.dataset.activeKpi = label;
    // Reveal so offsetHeight is measurable
    pop.classList.remove("kpi-popover--hidden");
    // Position
    const POP_W = Math.min(240, window.innerWidth - 16);
    pop.style.width = POP_W + "px";
    const br = btn.getBoundingClientRect();
    const btnCX = br.left + br.width / 2;
    const popH = pop.offsetHeight;
    const spaceBelow = window.innerHeight - br.bottom;
    let top, arrowDir;
    if (spaceBelow >= popH + 14) {
      top = br.bottom + 8;
      arrowDir = "top";
    } else {
      top = br.top - popH - 8;
      arrowDir = "bottom";
    }
    let left = btnCX - POP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - POP_W - 8));
    const arrowLeft = Math.max(
      10,
      Math.min(Math.round(btnCX - left - 4), POP_W - 18),
    );
    pop.dataset.arrow = arrowDir;
    pop.style.top = top + "px";
    pop.style.left = left + "px";
    pop.style.setProperty("--kpi-arrow-left", arrowLeft + "px");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePop();
  });
}

document.addEventListener("DOMContentLoaded", init);
