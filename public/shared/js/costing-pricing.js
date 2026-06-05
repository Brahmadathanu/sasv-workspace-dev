import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "costing-pricing";
let PERM_CAN_VIEW = true;

const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableHead = $("tableHead");
const tableBody = $("tableBody");
const refreshBtn = $("refreshBtn");
const snapshotRefreshBtn = $("snapshotRefreshBtn");
const exportBtn = $("exportCsv");
const searchBox = $("search");
const searchClear = $("searchClear");
const lastRefreshed = $("lastRefreshed");
const kpiStrip = $("kpiStrip");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const drawerClose = $("drawerClose");
const drawerTabs = $("drawerTabs");
const drawerContent = $("drawerContent");
const detailsModal = $("detailsModal");
const rowCount = $("peqRowCount");
const pageLabel = $("peqPage");
const prevPage = $("prevPage");
const nextPage = $("nextPage");
const workbenchSummary = $("workbenchSummary");
const costingLoadingMask = $("costingLoadingMask");
const costingLoadingText = $("costingLoadingText");
const costSheetModal = $("costSheetModal");
const costSheetA4 = $("costSheetA4");
const costSheetModalTitle = $("costSheetModalTitle");
const costSheetModalSubtitle = $("costSheetModalSubtitle");
const costSheetCloseBtn = $("costSheetCloseBtn");
const costSheetPdfBtn = $("costSheetPdfBtn");
const costSheetSignModal = $("costSheetSignModal");
const costSheetSignCloseBtn = $("costSheetSignCloseBtn");
const costSheetSignCancelBtn = $("costSheetSignCancelBtn");
const costSheetSignConfirmBtn = $("costSheetSignConfirmBtn");
const snapshotConfirmModal = $("snapshotConfirmModal");
const snapshotConfirmPeriod = $("snapshotConfirmPeriod");
const snapshotConfirmCloseBtn = $("snapshotConfirmCloseBtn");
const snapshotConfirmCancelBtn = $("snapshotConfirmCancelBtn");
const snapshotConfirmProceedBtn = $("snapshotConfirmProceedBtn");
const csPreparedRole = $("csPreparedRole");
const csPreparedOrg = $("csPreparedOrg");
const csVerifiedRole = $("csVerifiedRole");
const csVerifiedOrg = $("csVerifiedOrg");
const csApprovedRole = $("csApprovedRole");
const csApprovedOrg = $("csApprovedOrg");

let ACTIVE_PERIOD_START = null;
let CURRENT_LENS = "dashboard";
let ALL_ROWS = [];
let VIEW = [];
let CURRENT_PAGE = 1;
let PAGE_SIZE = 25;
let SELECTED_ROW = null;
let LAST_REFRESH_TIME = null;
let DASHBOARD_SUMMARY = null;
let WORKBENCH_SUMMARY = [];
let PRINTABLE_LINES = [];
let CURRENT_COST_SHEET_PRODUCT_ID = null;
let CURRENT_EXPORT_USER = "--";
let DETAILS_RETURN_FOCUS = null;
let COST_SHEET_RETURN_FOCUS = null;
let COST_SHEET_SIGN_RETURN_FOCUS = null;
let ACTIVE_FILTERS = {
  status: [],
  issue: [],
  source: [],
};
let _filterDrawerOpen = false;

const COST_SHEET_SIGN_DEFAULTS = {
  preparedRole: "Addl. Medical Officer (Production - Siddha)",
  preparedOrg: "Santhigiri Ayurveda Siddha Vaidyasala",
  verifiedRole: "DGM (Production Control)",
  verifiedOrg: "Santhigiri Ayurveda Siddha Vaidyasala",
  approvedRole: "General Manager (Production)",
  approvedOrg: "Santhigiri Ayurveda Siddha Vaidyasala",
};

let COST_SHEET_SIGNATORIES = { ...COST_SHEET_SIGN_DEFAULTS };

const LENSES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sku-cost-sheet", label: "SKU Cost Details" },
  { id: "printable-cost-sheet", label: "Cost Sheet" },
  { id: "cost-comparison", label: "Cost Comparison" },
  { id: "scheme-comparison", label: "Scheme Comparison" },
  { id: "pricing-diagnostics", label: "Pricing Diagnostics" },
  { id: "costing-review-workbench", label: "Costing Review Workbench" },
];

const VIEW_BY_LENS = {
  dashboard: "v_costing_pricing_dashboard_summary",
  "sku-cost-sheet": "v_costing_pricing_sku_selector",
  "printable-cost-sheet": "v_costing_pricing_printable_cost_sheet_lines",
  "cost-comparison": "v_cost_sheet_snapshot_sku_monthly_comparison",
  "scheme-comparison": "v_costing_pricing_sku_scheme_comparison",
  "pricing-diagnostics": "v_costing_pricing_workflow_diagnostics",
  "costing-review-workbench": "v_costing_pricing_review_top_action_items",
};

function costingFrom(viewName) {
  return supabase.from(viewName);
}

async function costingRpc(name, params) {
  return supabase.rpc(name, params);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function text(value, fallback = "--") {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(value);
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleString("en-IN");
}

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function statusClass(status) {
  const s = normalizeStatus(status);
  if (s === "READY" || s === "SUCCESS" || s === "OK") return "green";
  if (s === "REVIEW_REQUIRED" || s === "WARNING" || s.includes("REVIEW"))
    return "amber";
  if (s === "BLOCKED" || s === "FAILED" || s === "ERROR") return "red";
  if (s.includes("SCHEME")) return "indigo";
  return "gray";
}

function laneClass(row) {
  const status = getRowStatus(row);
  const cls = statusClass(status);
  if (cls === "green") return "ready";
  if (cls === "amber") return "review";
  if (cls === "red") return "blocked";
  if (cls === "indigo") return "scheme";
  return "";
}

function statusChip(status) {
  if (!status) return '<span class="status-chip gray">--</span>';
  return `<span class="status-chip ${statusClass(status)}">${text(status)}</span>`;
}

function compactStatusText(status) {
  if (!status) return '<span class="cp-status-text">--</span>';
  const cls = statusClass(status);
  return `<span class="cp-status-text cp-status-text--${cls}">${text(status)}</span>`;
}

function marginBandChip(value) {
  if (!value) return '<span class="status-chip gray">--</span>';
  const v = normalizeStatus(value);
  const cls =
    v.includes("NEG") || v.includes("LOW") || v.includes("LOSS")
      ? "red"
      : v.includes("WATCH") || v.includes("MID")
        ? "amber"
        : "green";
  return `<span class="status-chip ${cls}">${text(value)}</span>`;
}

function issueCodeLabel(code) {
  if (!code) return "--";
  return String(code).replace(/_/g, " ");
}

function setStatus(message, type = "info") {
  if (!statusArea) return;
  const color = type === "error" ? "#b91c1c" : "var(--muted, #6b7280)";
  statusArea.style.display = "block";
  statusArea.style.color = color;
  statusArea.innerHTML = escapeHtml(message);
}

function clearStatus() {
  if (statusArea) statusArea.style.display = "none";
}

function setLoadingMask(visible, message = "Loading...") {
  if (!costingLoadingMask) return;
  if (costingLoadingText) costingLoadingText.textContent = message;
  costingLoadingMask.classList.toggle("hidden", !visible);
  costingLoadingMask.setAttribute("aria-busy", visible ? "true" : "false");
}

function formatPeriodMonth(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text(value);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function getExportedAtIst() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function toKebabSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatTodayIsoIst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

function getCurrentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function loadPermissions(sessionUserId) {
  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: sessionUserId,
    });
    if (!error && Array.isArray(perms)) {
      const entry = perms.find((r) => r?.target === `module:${MODULE_ID}`);
      if (entry) PERM_CAN_VIEW = !!entry.can_view;
      return;
    }
    if (error) console.warn("[costing-pricing] permission RPC failed", error);
  } catch (err) {
    console.warn("[costing-pricing] permission RPC exception", err);
  }

  try {
    const { data } = await supabase
      .from("user_permissions")
      .select("module_id, can_view")
      .eq("user_id", sessionUserId)
      .eq("module_id", MODULE_ID)
      .limit(1);
    if (Array.isArray(data) && data.length) PERM_CAN_VIEW = !!data[0].can_view;
  } catch (err) {
    console.warn("[costing-pricing] permission fallback failed", err);
  }
}

async function resolveActivePeriodStart() {
  const currentMonth = getCurrentMonthStart();
  const { data: currentRows, error: currentErr } = await costingFrom(
    "v_costing_pricing_dashboard_summary",
  )
    .select("period_start")
    .eq("period_start", currentMonth)
    .limit(1);
  if (currentErr) throw currentErr;
  if (currentRows?.length) return currentMonth;

  const { data: latestRows, error: latestErr } = await costingFrom(
    "v_costing_pricing_dashboard_summary",
  )
    .select("period_start")
    .order("period_start", { ascending: false })
    .limit(1);
  if (latestErr) throw latestErr;
  return latestRows?.[0]?.period_start || currentMonth;
}

async function loadDashboardSummary() {
  const { data, error } = await costingFrom(
    "v_costing_pricing_dashboard_summary",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .limit(1);
  if (error) throw error;
  DASHBOARD_SUMMARY = data?.[0] || null;
  renderKpiStrip();
}

async function loadWorkbenchSummary() {
  if (CURRENT_LENS !== "costing-review-workbench") return;
  const { data, error } = await costingFrom(
    "v_costing_pricing_review_workbench_summary",
  )
    .select("*")
    .limit(250);
  if (error) throw error;
  WORKBENCH_SUMMARY = data || [];
}

async function fetchAllPrintableLinesForPeriod(periodStart) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await costingFrom(
      "v_costing_pricing_printable_cost_sheet_lines",
    )
      .select("*")
      .eq("period_start", periodStart)
      .order("product_name", { ascending: true })
      .order("product_id", { ascending: true })
      .order("pack_size", { ascending: true })
      .order("section_code", { ascending: true })
      .order("line_order", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const pageRows = data || [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchAllRows(queryBuilderFactory, pageSize = 1000) {
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const query = queryBuilderFactory().range(from, to);
    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function loadRowsForLens() {
  const lensLabel = LENSES.find((l) => l.id === CURRENT_LENS)?.label || "view";
  setLoadingMask(true, `Loading ${lensLabel}...`);
  try {
    setStatus("Loading costing/pricing view...");
    tableWrap?.classList.remove("tw-visible");
    closeCostSheetModal();
    ALL_ROWS = [];
    VIEW = [];
    PRINTABLE_LINES = [];
    CURRENT_PAGE = 1;

    await loadDashboardSummary();
    await loadWorkbenchSummary();

    const viewName = VIEW_BY_LENS[CURRENT_LENS];
    if (CURRENT_LENS === "printable-cost-sheet") {
      PRINTABLE_LINES =
        await fetchAllPrintableLinesForPeriod(ACTIVE_PERIOD_START);
      ALL_ROWS = groupPrintableLinesByProduct(PRINTABLE_LINES);
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    if (CURRENT_LENS === "scheme-comparison") {
      ALL_ROWS = await fetchAllRows(() =>
        costingFrom("v_costing_pricing_sku_scheme_comparison")
          .select("*")
          .eq("period_start", ACTIVE_PERIOD_START)
          .order("sku_display_name", { ascending: true }),
      );
      applyFilters();
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      return;
    }

    let query = costingFrom(viewName).select("*");
    if (CURRENT_LENS === "dashboard") {
      query = query.eq("period_start", ACTIVE_PERIOD_START).limit(1);
    } else if (CURRENT_LENS === "cost-comparison") {
      query = query.eq("snapshot_period_start", ACTIVE_PERIOD_START);
    } else if (CURRENT_LENS !== "costing-review-workbench") {
      query = query.eq("period_start", ACTIVE_PERIOD_START);
    }

    if (CURRENT_LENS === "sku-cost-sheet")
      query = query.order("product_name", { ascending: true });
    if (CURRENT_LENS === "printable-cost-sheet")
      query = query.order("product_name", { ascending: true });
    if (CURRENT_LENS === "cost-comparison")
      query = query
        .order("product_name", { ascending: true })
        .order("sku_column_label", { ascending: true });
    if (CURRENT_LENS === "scheme-comparison")
      query = query.order("sku_display_name", { ascending: true });
    if (CURRENT_LENS === "pricing-diagnostics")
      query = query.order("product_name", { ascending: true });
    if (CURRENT_LENS === "costing-review-workbench")
      query = query.order("affected_sku_count", { ascending: false });

    const { data, error } = await query.limit(2000);
    if (error) throw error;
    ALL_ROWS = data || [];
    applyFilters();
    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();
  } finally {
    setLoadingMask(false);
  }
}

function uniqueValues(rows, key) {
  return [
    ...new Set(
      rows
        .map((r) => r[key])
        .filter((v) => v !== null && v !== undefined && v !== ""),
    ),
  ];
}

function groupPrintableLinesByProduct(lines) {
  const byProduct = new Map();
  lines.forEach((line) => {
    const key = String(line.product_id ?? "");
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(line);
  });

  return [...byProduct.entries()]
    .map(([productId, rows]) => {
      const first = rows[0] || {};
      const skuLabels = uniqueValues(rows, "sku_column_label");
      const statuses = uniqueValues(rows, "cost_sheet_status");
      const status = statuses.includes("BLOCKED")
        ? "BLOCKED"
        : statuses.includes("REVIEW_REQUIRED")
          ? "REVIEW_REQUIRED"
          : statuses[0] || first.cost_sheet_status || "";
      const refreshedAt = rows
        .map((r) => r.refreshed_at)
        .filter(Boolean)
        .sort()
        .at(-1);
      return {
        product_id: productId,
        product_name: first.product_name,
        category_name: first.category_name,
        subcategory_name: first.subcategory_name,
        group_name: first.group_name,
        sub_group_name: first.sub_group_name,
        product_hierarchy: first.product_hierarchy,
        period_start: first.period_start,
        product_cost_sheet_status: status,
        cost_sheet_note: first.cost_sheet_note,
        refreshed_at: refreshedAt || first.refreshed_at,
        sku_count: uniqueValues(rows, "sku_id").length,
        sku_column_labels: skuLabels.join(", "),
      };
    })
    .sort((a, b) =>
      String(a.product_name || "").localeCompare(String(b.product_name || "")),
    );
}

function renderKpiStrip() {
  if (!kpiStrip) return;
  const r = DASHBOARD_SUMMARY || {};
  const cards = [
    ["Pricing SKUs", r.pricing_bridge_sku_count, "total"],
    ["Pricing Blocked", r.pricing_bridge_blocked_count, "blocked"],
    ["Pricing Review", r.pricing_bridge_review_required_count, "review"],
    ["Selling Price SKUs", r.selling_price_sku_count, "ready"],
    ["Scheme Rows", r.scheme_viability_row_count, "scheme"],
    ["Scheme Blocked", r.scheme_blocked_count, "blocked"],
    ["Scheme Review", r.scheme_review_required_count, "review"],
    [
      "Refresh Status",
      r.latest_refresh_status || "--",
      statusClass(r.latest_refresh_status) === "green" ? "ready" : "total",
    ],
  ];
  kpiStrip.innerHTML = cards
    .map(
      ([label, value, cls]) =>
        `<div class="kpi ${cls}"><div>${label}</div><div>${typeof value === "number" ? formatNumber(value) : text(value)}</div></div>`,
    )
    .join("");
}

function renderLensPills() {
  if (lensPills) {
    lensPills.innerHTML = LENSES.map(
      (l) =>
        `<button type="button" class="pill ${l.id === CURRENT_LENS ? "active" : ""}" data-lens="${l.id}">${l.label}</button>`,
    ).join("");
    lensPills.querySelectorAll(".pill").forEach((btn) => {
      btn.addEventListener("click", () => switchLens(btn.dataset.lens));
    });
  }
  if (lensSelect) {
    lensSelect.innerHTML = LENSES.map(
      (l) => `<option value="${l.id}">${l.label}</option>`,
    ).join("");
    lensSelect.value = CURRENT_LENS;
  }
}

async function switchLens(lensId) {
  if (!lensId || lensId === CURRENT_LENS) return;
  closeCostSheetModal();
  CURRENT_LENS = lensId;
  SELECTED_ROW = null;
  renderLensPills();
  closeDetails();
  try {
    await loadRowsForLens();
  } catch (err) {
    handleError("Failed to load selected lens", err);
  }
}

function getRowStatus(row) {
  return (
    row.costing_status ||
    row.cost_sheet_status ||
    row.product_cost_sheet_status ||
    row.product_costing_status ||
    row.status ||
    row.pricing_bridge_status ||
    row.selling_price_bridge_status ||
    row.scheme_viability_status ||
    row.material_line_status ||
    row.latest_refresh_status ||
    ""
  );
}

function getSearchBlob(row) {
  return [
    row.product_name,
    row.sku_display_name,
    row.sku_id,
    row.sku_column_label,
    row.product_id,
    row.category_name,
    row.subcategory_name,
    row.group_name,
    row.sub_group_name,
    row.product_hierarchy,
    row.sku_column_labels,
    row.stock_item_name,
    row.material_issue_code,
    row.primary_diagnostic_code,
    row.scheme_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterMatch(row, group, selected) {
  if (!selected.length) return true;
  const values = {
    status: [
      row.costing_status,
      row.cost_sheet_status,
      row.product_cost_sheet_status,
      row.product_costing_status,
      row.status,
      row.pricing_bridge_status,
      row.selling_price_bridge_status,
      row.scheme_viability_status,
      row.internal_loaded_cost_status,
      row.manufacturing_cop_status,
      row.material_line_status,
    ],
    issue: [
      row.material_issue_code,
      row.primary_diagnostic_code,
      row.warning_code,
    ],
    source: [row.bom_source, row.source],
  }[group];
  return values.some((v) => selected.includes(normalizeStatus(v)));
}

function applyFilters() {
  let rows = [...ALL_ROWS];
  rows = rows.filter(
    (row) =>
      filterMatch(row, "status", ACTIVE_FILTERS.status) &&
      filterMatch(row, "issue", ACTIVE_FILTERS.issue) &&
      filterMatch(row, "source", ACTIVE_FILTERS.source),
  );
  VIEW = rows;
  applySearch();
}

function applySearch() {
  const q = String(searchBox?.value || "")
    .trim()
    .toLowerCase();
  let rows = [...ALL_ROWS].filter(
    (row) =>
      filterMatch(row, "status", ACTIVE_FILTERS.status) &&
      filterMatch(row, "issue", ACTIVE_FILTERS.issue) &&
      filterMatch(row, "source", ACTIVE_FILTERS.source),
  );
  if (q) rows = rows.filter((row) => getSearchBlob(row).includes(q));
  VIEW = rows;
  CURRENT_PAGE = 1;
  renderTable();
  updateSearchClear();
}

function updateSearchClear() {
  if (searchClear) searchClear.style.display = searchBox?.value ? "" : "none";
}

function renderTableHeaderForLens() {
  const headers = {
    dashboard: [
      "Period",
      "Pricing SKUs",
      "Pricing Blocked",
      "Pricing Review",
      "Selling Price SKUs",
      "Selling Blocked",
      "Selling Review",
      "Scheme Rows",
      "Scheme Blocked",
      "Scheme Review",
      "Refresh Status",
      "Scope",
      "Finished At",
    ],
    "sku-cost-sheet": [
      "",
      "Product / SKU",
      "SKU ID",
      "MRP IK",
      "MRP OK",
      "Internal Loaded Cost",
      "IK Selling Price",
      "OK Selling Price",
      "Status",
    ],
    "printable-cost-sheet": [
      "Product",
      "Category",
      "Group",
      "SKU Columns",
      "Status",
      "Refreshed At",
    ],
    "cost-comparison": [
      "Product / SKU",
      "Manufacturing COP",
      "Previous Month COP",
      "MoM COP Change %",
      "Internal Loaded Cost",
      "Previous Month Internal Loaded Cost",
      "MoM Internal Loaded Cost Change %",
      "Profit IK",
      "MoM Profit IK Change",
      "Profit OK",
      "MoM Profit OK Change",
    ],
    "scheme-comparison": [
      "Product / SKU",
      "Scheme",
      "IK Net Realisation",
      "IK Margin %",
      "IK Margin Band",
      "OK Net Realisation",
      "OK Margin %",
      "OK Margin Band",
      "Status",
    ],
    "pricing-diagnostics": [
      "Product",
      "SKU",
      "Pack",
      "Pricing Status",
      "Selling Price Status",
      "Internal Loaded Cost Status",
      "Manufacturing COP Status",
      "Primary Diagnostic Code",
      "Primary Diagnostic Note",
    ],
    "costing-review-workbench": [
      "",
      "Issue Code",
      "Source",
      "Stock Item",
      "Selected Rate",
      "Rate Source",
      "Rate Date",
      "Affected Products",
      "Affected SKUs",
      "Recommended Action",
    ],
  }[CURRENT_LENS];
  const alignments = {
    dashboard: [
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
      "c-left",
      "c-left",
    ],
    "sku-cost-sheet": [
      "c-center",
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
      "c-left",
    ],
    "printable-cost-sheet": [
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
      "c-left",
    ],
    "cost-comparison": [
      "c-left",
      "c-right",
      "c-right",
      "c-center",
      "c-right",
      "c-right",
      "c-center",
      "c-right",
      "c-right",
      "c-right",
      "c-right",
    ],
    "scheme-comparison": [
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-left",
      "c-right",
      "c-right",
      "c-left",
      "c-left",
    ],
    "pricing-diagnostics": Array(9).fill("c-left"),
    "costing-review-workbench": [
      "c-center",
      "c-left",
      "c-left",
      "c-left",
      "c-right",
      "c-left",
      "c-left",
      "c-right",
      "c-right",
      "c-left",
    ],
  }[CURRENT_LENS] || [];
  tableHead.innerHTML = `<tr>${headers
    .map((h, i) => {
      const classes = [alignments[i] || "c-left"];
      if (i === 0 && h === "") classes.push("lane-col");
      return `<th class="${classes.join(" ")}">${text(h, "")}</th>`;
    })
    .join("")}</tr>`;
}

function productSkuLabel(row) {
  const product = row.product_name || row.product_id || "--";
  const sku = row.sku_display_name || row.sku_column_label || row.sku_id || "";
  return `<strong>${text(product)}</strong>${sku ? `<div style="color:var(--muted,#6b7280);font-size:12px">${text(sku)}</div>` : ""}`;
}

function renderRowForLens(row, idx) {
  const trAttrs = `class="clickable" data-row-index="${idx}"`;
  if (CURRENT_LENS === "dashboard") {
    return `<tr ${trAttrs}>
      <td>${formatDate(row.period_start)}</td>
      <td class="c-right">${formatNumber(row.pricing_bridge_sku_count)}</td>
      <td class="c-right">${formatNumber(row.pricing_bridge_blocked_count)}</td>
      <td class="c-right">${formatNumber(row.pricing_bridge_review_required_count)}</td>
      <td class="c-right">${formatNumber(row.selling_price_sku_count)}</td>
      <td class="c-right">${formatNumber(row.selling_price_blocked_count)}</td>
      <td class="c-right">${formatNumber(row.selling_price_review_required_count)}</td>
      <td class="c-right">${formatNumber(row.scheme_viability_row_count)}</td>
      <td class="c-right">${formatNumber(row.scheme_blocked_count)}</td>
      <td class="c-right">${formatNumber(row.scheme_review_required_count)}</td>
      <td>${statusChip(row.latest_refresh_status)}</td>
      <td>${text(row.latest_refresh_scope)}</td>
      <td>${formatDateTime(row.latest_refresh_finished_at)}</td>
    </tr>`;
  }
  if (CURRENT_LENS === "sku-cost-sheet") {
    return `<tr ${trAttrs}>
      <td class="lane-col"><span class="lane ${laneClass(row)}"></span></td>
      <td>${productSkuLabel(row)}</td>
      <td>${text(row.sku_id)}</td>
      <td class="c-right">${formatMoney(row.mrp_ik)}</td>
      <td class="c-right">${formatMoney(row.mrp_ok)}</td>
      <td class="c-right">${formatMoney(row.internal_loaded_cost_per_sku)}</td>
      <td class="c-right">${formatMoney(row.ik_selling_price)}</td>
      <td class="c-right">${formatMoney(row.ok_selling_price)}</td>
      <td>${statusChip(getRowStatus(row))}</td>
    </tr>`;
  }
  if (CURRENT_LENS === "printable-cost-sheet") {
    return `<tr ${trAttrs}>
      <td><strong>${text(row.product_name || row.product_id)}</strong></td>
      <td>${text(row.category_name)}<div class="cp-muted-text">${text(row.subcategory_name)}</div></td>
      <td>${text(row.group_name)}<div class="cp-muted-text">${text(row.sub_group_name)}</div></td>
      <td>${text(row.sku_column_labels)}</td>
      <td>${compactStatusText(row.product_cost_sheet_status)}</td>
      <td>${formatDateTime(row.refreshed_at)}</td>
    </tr>`;
  }
  if (CURRENT_LENS === "cost-comparison") {
    return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      ${comparisonCell(costComparisonValue(row, "manufacturingCop"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "previousMonthCop"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momCopChangePercent"), formatPercent, "percent")}
      ${comparisonCell(costComparisonValue(row, "internalLoadedCost"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "previousMonthInternalLoadedCost"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momInternalLoadedCostChangePercent"), formatPercent, "percent")}
      ${comparisonCell(costComparisonValue(row, "profitIk"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momProfitIkChange"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "profitOk"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momProfitOkChange"), formatMoney, "money")}
    </tr>`;
  }
  if (CURRENT_LENS === "scheme-comparison") {
    return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      <td>${text(row.scheme_name)}</td>
      <td class="c-right">${formatMoney(row.ik_net_sales_realisation)}</td>
      <td class="c-right">${formatPercent(row.ik_margin_percent_after_scheme)}</td>
      <td class="cp-muted-text">${text(row.ik_scheme_margin_band)}</td>
      <td class="c-right">${formatMoney(row.ok_net_sales_realisation)}</td>
      <td class="c-right">${formatPercent(row.ok_margin_percent_after_scheme)}</td>
      <td class="cp-muted-text">${text(row.ok_scheme_margin_band)}</td>
      <td>${compactStatusText(row.scheme_viability_status)}</td>
    </tr>`;
  }
  if (CURRENT_LENS === "pricing-diagnostics") {
    return `<tr ${trAttrs}>
      <td>${text(row.product_name)}</td>
      <td>${text(row.sku_display_name || row.sku_id)}</td>
      <td>${text(row.pack_size || row.sku_uom)}</td>
      <td>${compactStatusText(row.pricing_bridge_status)}</td>
      <td>${compactStatusText(row.selling_price_bridge_status)}</td>
      <td>${compactStatusText(row.internal_loaded_cost_status)}</td>
      <td>${compactStatusText(row.manufacturing_cop_status)}</td>
      <td>${text(issueCodeLabel(row.primary_diagnostic_code))}</td>
      <td>${text(row.primary_diagnostic_note)}</td>
    </tr>`;
  }
  return `<tr ${trAttrs}>
    <td class="lane-col"><span class="lane ${laneClass(row)}"></span></td>
    <td>${text(issueCodeLabel(row.material_issue_code))}</td>
    <td>${text(row.bom_source)}</td>
    <td>${text(row.stock_item_name || row.stock_item_id)}</td>
    <td class="c-right">${formatMoney(row.selected_rate)}</td>
    <td>${text(row.rate_source)}</td>
    <td>${formatDate(row.rate_date)}</td>
    <td class="c-right">${formatNumber(row.affected_product_count)}</td>
    <td class="c-right">${formatNumber(row.affected_sku_count)}</td>
    <td>${text(row.recommended_action)}</td>
  </tr>`;
}

function renderTable() {
  renderTableHeaderForLens();
  renderWorkbenchSummary();
  const totalPages = Math.max(1, Math.ceil(VIEW.length / PAGE_SIZE));
  if (CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;
  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  const pageRows = VIEW.slice(start, start + PAGE_SIZE);

  if (!VIEW.length) {
    tableBody.innerHTML = "";
    tableWrap?.classList.remove("tw-visible");
    setStatus(
      `No rows found for ${LENSES.find((l) => l.id === CURRENT_LENS)?.label || CURRENT_LENS}.`,
    );
  } else {
    clearStatus();
    tableWrap?.classList.add("tw-visible");
    tableBody.innerHTML = pageRows
      .map((row, idx) => renderRowForLens(row, start + idx))
      .join("");
  }

  tableBody.querySelectorAll("tr[data-row-index]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const row = VIEW[Number(tr.dataset.rowIndex)];
      if (CURRENT_LENS === "printable-cost-sheet") {
        openCostSheetModal(row.product_id);
        return;
      }
      const preferred =
        CURRENT_LENS === "scheme-comparison"
          ? "scheme"
          : CURRENT_LENS === "pricing-diagnostics"
            ? "diagnostics"
            : undefined;
      openDetails(row, preferred);
    });
  });

  if (rowCount) {
    rowCount.style.display = "";
    rowCount.textContent = `${VIEW.length.toLocaleString("en-IN")} row${VIEW.length === 1 ? "" : "s"}`;
  }
  if (pageLabel) pageLabel.textContent = `Page ${CURRENT_PAGE}/${totalPages}`;
  if (prevPage) prevPage.disabled = CURRENT_PAGE <= 1;
  if (nextPage) nextPage.disabled = CURRENT_PAGE >= totalPages;
}

function renderWorkbenchSummary() {
  if (!workbenchSummary) return;
  if (CURRENT_LENS !== "costing-review-workbench") {
    workbenchSummary.classList.remove("is-visible");
    workbenchSummary.innerHTML = "";
    return;
  }
  workbenchSummary.classList.add("is-visible");
  if (!WORKBENCH_SUMMARY.length) {
    workbenchSummary.innerHTML = `<div class="status" style="padding:4px 6px">No issue summary rows for this period.</div>`;
    return;
  }
  workbenchSummary.innerHTML = `
    <div class="cp-section-title">Issue Summary</div>
    ${simpleTable(
      [
        "Issue Code",
        "Source",
        "Status",
        "Affected Products",
        "Affected SKUs",
        "Recommended Action",
      ],
      WORKBENCH_SUMMARY,
      (r) =>
        `<tr><td>${text(issueCodeLabel(r.material_issue_code))}</td><td>${text(r.bom_source)}</td><td>${statusChip(r.material_line_status || r.status)}</td><td class="c-right">${formatNumber(r.affected_product_count)}</td><td class="c-right">${formatNumber(r.affected_sku_count)}</td><td>${text(r.recommended_action)}</td></tr>`,
    )}
  `;
}

function kvCards(items) {
  return `<div class="cp-summary-strip">${items
    .map(
      ([label, value]) =>
        `<div class="cp-card"><div class="cp-card-label">${text(label)}</div><div class="cp-card-value">${value}</div></div>`,
    )
    .join("")}</div>`;
}

function simpleTable(headers, rows, renderer) {
  if (!rows?.length) return `<div class="status">No rows available.</div>`;
  const renderedRows = rows.map(renderer);
  const rowCells = renderedRows.map((rowHtml) => [
    ...String(rowHtml).matchAll(/<td(?:\s+class="([^"]*)")?[^>]*>/g),
  ]);
  const headerHtml = headers
    .map((header, index) => {
      const columnClasses = rowCells
        .map((cells) => cells[index]?.[1] || "")
        .filter(Boolean);
      const hasRight = columnClasses.some((classes) =>
        /(?:^|\s)(?:c-right|cp-num-cell)(?:\s|$)/.test(classes),
      );
      const hasCenter = columnClasses.some((classes) =>
        /(?:^|\s)(?:c-center|cp-pct-cell|cp-blank-cell)(?:\s|$)/.test(
          classes,
        ),
      );
      const alignmentClass = hasRight
        ? "c-right"
        : hasCenter
          ? "c-center"
          : "c-left";
      return `<th class="${alignmentClass}">${text(header)}</th>`;
    })
    .join("");
  return `<div class="cp-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${renderedRows.join("")}</tbody></table></div>`;
}

const COST_COMPARISON_FIELDS = {
  manufacturingCop: [
    "manufacturing_cop_per_sku",
    "manufacturing_cop",
    "current_month_manufacturing_cop",
    "current_manufacturing_cop",
  ],
  previousMonthCop: [
    "previous_month_manufacturing_cop_per_sku",
    "previous_month_manufacturing_cop",
    "previous_month_cop",
    "previous_manufacturing_cop",
  ],
  momCopChangePercent: [
    "mom_manufacturing_cop_change_percent",
    "mom_cop_change_percent",
    "manufacturing_cop_mom_change_percent",
    "mom_manufacturing_cop_percent",
  ],
  internalLoadedCost: [
    "internal_loaded_cost_per_sku",
    "internal_loaded_cost",
    "current_month_internal_loaded_cost",
    "current_internal_loaded_cost",
  ],
  previousMonthInternalLoadedCost: [
    "previous_month_internal_loaded_cost_per_sku",
    "previous_month_internal_loaded_cost",
    "previous_internal_loaded_cost",
  ],
  momInternalLoadedCostChangePercent: [
    "mom_internal_loaded_cost_change_percent",
    "internal_loaded_cost_mom_change_percent",
    "mom_ilc_change_percent",
  ],
  profitIk: [
    "profit_value_ik",
    "profit_ik",
    "ik_profit",
    "ik_profit_value",
    "current_profit_ik",
  ],
  previousMonthProfitIk: [
    "previous_month_profit_value_ik",
    "previous_month_profit_ik",
    "previous_month_ik_profit",
    "previous_month_ik_profit_value",
  ],
  momProfitIkChange: [
    "profit_value_ik_mom_change",
    "mom_profit_ik_change",
    "mom_ik_profit_change",
    "ik_profit_mom_change",
    "mom_profit_ik_change_amount",
  ],
  profitOk: [
    "profit_value_ok",
    "profit_ok",
    "ok_profit",
    "ok_profit_value",
    "current_profit_ok",
  ],
  previousMonthProfitOk: [
    "previous_month_profit_value_ok",
    "previous_month_profit_ok",
    "previous_month_ok_profit",
    "previous_month_ok_profit_value",
  ],
  momProfitOkChange: [
    "profit_value_ok_mom_change",
    "mom_profit_ok_change",
    "mom_ok_profit_change",
    "ok_profit_mom_change",
    "mom_profit_ok_change_amount",
  ],
  previousYearCop: [
    "previous_year_manufacturing_cop_per_sku",
    "previous_year_manufacturing_cop",
    "previous_year_cop",
  ],
  yoyCopChangePercent: [
    "yoy_manufacturing_cop_change_percent",
    "yoy_cop_change_percent",
    "manufacturing_cop_yoy_change_percent",
  ],
  previousYearInternalLoadedCost: [
    "previous_year_internal_loaded_cost_per_sku",
    "previous_year_internal_loaded_cost",
  ],
  yoyInternalLoadedCostChangePercent: [
    "yoy_internal_loaded_cost_change_percent",
    "internal_loaded_cost_yoy_change_percent",
  ],
  previousYearProfitIk: [
    "previous_year_profit_value_ik",
    "previous_year_profit_ik",
    "previous_year_ik_profit",
    "previous_year_ik_profit_value",
  ],
  yoyProfitIkChange: [
    "profit_value_ik_yoy_change",
    "yoy_profit_ik_change",
    "yoy_ik_profit_change",
    "ik_profit_yoy_change",
  ],
  previousYearProfitOk: [
    "previous_year_profit_value_ok",
    "previous_year_profit_ok",
    "previous_year_ok_profit",
    "previous_year_ok_profit_value",
  ],
  yoyProfitOkChange: [
    "profit_value_ok_yoy_change",
    "yoy_profit_ok_change",
    "yoy_ok_profit_change",
    "ok_profit_yoy_change",
  ],
};

function costComparisonValue(row, key) {
  const fields = COST_COMPARISON_FIELDS[key] || [key];
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  }
  return null;
}

function comparisonCell(value, formatter, type = "money") {
  const isBlank = value === null || value === undefined || value === "";
  if (isBlank) {
    return `<td class="cp-blank-cell">--</td>`;
  }

  const cellClass = type === "percent" ? "cp-pct-cell" : "cp-num-cell";
  const wrapClass = type === "percent" ? "cp-pct-wrap" : "cp-num-wrap";

  return `<td class="${cellClass}">
    <span class="${wrapClass}">${formatter(value)}</span>
  </td>`;
}

async function fetchSkuDetail(row) {
  const skuId = row.sku_id;
  if (!skuId) return row;
  const { data, error } = await costingFrom(
    "v_costing_pricing_sku_detailed_cost_sheet",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .eq("sku_id", skuId)
    .limit(1);
  if (error) throw error;
  return data?.[0] || row;
}

async function fetchSkuSchemes(row) {
  if (!row.sku_id) return [];
  const { data, error } = await costingFrom(
    "v_costing_pricing_sku_scheme_comparison",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .eq("sku_id", row.sku_id)
    .limit(500);
  if (error) throw error;
  return data || [];
}

async function fetchSkuDiagnostics(row) {
  if (!row.sku_id) return null;
  const { data, error } = await costingFrom(
    "v_costing_pricing_workflow_diagnostics",
  )
    .select("*")
    .eq("period_start", ACTIVE_PERIOD_START)
    .eq("sku_id", row.sku_id)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function fetchActionDrilldown(row) {
  const { data, error } = await costingFrom(
    "v_costing_pricing_review_action_item_drilldown",
  )
    .select("*")
    .eq("stock_item_id", row.stock_item_id)
    .eq("material_issue_code", row.material_issue_code)
    .eq("bom_source", row.bom_source)
    .limit(1000);
  if (error) throw error;
  return data || [];
}

function renderDashboardOverview() {
  const r = SELECTED_ROW || DASHBOARD_SUMMARY || {};
  return kvCards([
    ["Period", formatDate(r.period_start)],
    ["Pricing SKUs", formatNumber(r.pricing_bridge_sku_count)],
    ["Pricing Blocked", formatNumber(r.pricing_bridge_blocked_count)],
    ["Pricing Review", formatNumber(r.pricing_bridge_review_required_count)],
    ["Selling Price SKUs", formatNumber(r.selling_price_sku_count)],
    ["Selling Blocked", formatNumber(r.selling_price_blocked_count)],
    ["Selling Review", formatNumber(r.selling_price_review_required_count)],
    ["Scheme Rows", formatNumber(r.scheme_viability_row_count)],
    ["Scheme Blocked", formatNumber(r.scheme_blocked_count)],
    ["Scheme Review", formatNumber(r.scheme_review_required_count)],
    ["Refresh Status", statusChip(r.latest_refresh_status)],
    ["Refresh Scope", text(r.latest_refresh_scope)],
    ["Finished At", formatDateTime(r.latest_refresh_finished_at)],
  ]);
}

function printableRowsForProduct(productId) {
  return PRINTABLE_LINES.filter(
    (r) => String(r.product_id ?? "") === String(productId ?? ""),
  );
}

function getPrintableSkuColumns(rows) {
  const bySku = new Map();
  rows.forEach((row) => {
    const key = String(row.sku_id ?? row.sku_column_label ?? "");
    if (!key) return;
    if (!bySku.has(key)) {
      bySku.set(key, {
        sku_id: row.sku_id,
        label: row.sku_column_label || row.sku_id || "--",
        pack_size: Number(row.pack_size),
        pack_uom: row.pack_uom,
      });
    }
  });
  return [...bySku.values()].sort((a, b) => {
    const an = Number.isFinite(a.pack_size)
      ? a.pack_size
      : Number.MAX_SAFE_INTEGER;
    const bn = Number.isFinite(b.pack_size)
      ? b.pack_size
      : Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return String(a.label).localeCompare(String(b.label));
  });
}

function formatPrintableValue(row) {
  if (!row) return "--";
  const type = String(row.value_type || "").toLowerCase();
  if (type === "currency") return formatMoney(row.value_numeric);
  if (type === "percent") return formatPercent(row.value_numeric);
  if (type === "text") return text(row.value_text);
  if (
    row.value_text !== null &&
    row.value_text !== undefined &&
    row.value_text !== ""
  )
    return text(row.value_text);
  return formatNumber(row.value_numeric);
}

function closeCostSheetModal() {
  if (!costSheetModal) return;

  const active = document.activeElement;
  if (active && costSheetModal.contains(active)) {
    active.blur();
  }

  closeCostSheetSignModal();

  costSheetModal.classList.add("hidden");
  costSheetModal.setAttribute("aria-hidden", "true");

  if (costSheetA4) costSheetA4.innerHTML = "";
  CURRENT_COST_SHEET_PRODUCT_ID = null;

  const returnTarget =
    COST_SHEET_RETURN_FOCUS &&
    COST_SHEET_RETURN_FOCUS !== document.body &&
    document.contains(COST_SHEET_RETURN_FOCUS)
      ? COST_SHEET_RETURN_FOCUS
      : searchBox;

  COST_SHEET_RETURN_FOCUS = null;

  if (returnTarget && typeof returnTarget.focus === "function") {
    setTimeout(() => returnTarget.focus(), 0);
  }
}

function openCostSheetSignModal() {
  if (!costSheetSignModal) return;
  COST_SHEET_SIGN_RETURN_FOCUS = document.activeElement;
  if (csPreparedRole)
    csPreparedRole.value = COST_SHEET_SIGNATORIES.preparedRole;
  if (csPreparedOrg) csPreparedOrg.value = COST_SHEET_SIGNATORIES.preparedOrg;
  if (csVerifiedRole)
    csVerifiedRole.value = COST_SHEET_SIGNATORIES.verifiedRole;
  if (csVerifiedOrg) csVerifiedOrg.value = COST_SHEET_SIGNATORIES.verifiedOrg;
  if (csApprovedRole)
    csApprovedRole.value = COST_SHEET_SIGNATORIES.approvedRole;
  if (csApprovedOrg) csApprovedOrg.value = COST_SHEET_SIGNATORIES.approvedOrg;
  costSheetSignModal.classList.remove("hidden");
  costSheetSignModal.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    costSheetSignConfirmBtn?.focus();
  }, 0);
}

function closeCostSheetSignModal() {
  if (!costSheetSignModal) return;

  const active = document.activeElement;
  if (active && costSheetSignModal.contains(active)) {
    active.blur();
  }

  costSheetSignModal.classList.add("hidden");
  costSheetSignModal.setAttribute("aria-hidden", "true");

  const returnTarget =
    COST_SHEET_SIGN_RETURN_FOCUS &&
    COST_SHEET_SIGN_RETURN_FOCUS !== document.body &&
    document.contains(COST_SHEET_SIGN_RETURN_FOCUS)
      ? COST_SHEET_SIGN_RETURN_FOCUS
      : costSheetPdfBtn;

  COST_SHEET_SIGN_RETURN_FOCUS = null;

  if (returnTarget && typeof returnTarget.focus === "function") {
    setTimeout(() => returnTarget.focus(), 0);
  }
}

function readCostSheetSignatoriesFromModal() {
  COST_SHEET_SIGNATORIES = {
    preparedRole:
      csPreparedRole?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.preparedRole,
    preparedOrg:
      csPreparedOrg?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.preparedOrg,
    verifiedRole:
      csVerifiedRole?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.verifiedRole,
    verifiedOrg:
      csVerifiedOrg?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.verifiedOrg,
    approvedRole:
      csApprovedRole?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.approvedRole,
    approvedOrg:
      csApprovedOrg?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.approvedOrg,
  };
}

async function confirmCostSheetSignatories() {
  readCostSheetSignatoriesFromModal();
  const productId = CURRENT_COST_SHEET_PRODUCT_ID;
  if (productId) openCostSheetModal(productId);
  closeCostSheetSignModal();
  await generateCostSheetPdf(productId);
}

function shouldShowCalculationInPrint(line) {
  const label = String(line?.line_label || "").toLowerCase();
  return (
    label.includes("cost of production") ||
    label.includes("manufacturing cop") ||
    label.includes("internal loaded cost") ||
    label.includes("basic price") ||
    label.includes("discount value") ||
    label.includes("selling price") ||
    label.includes("scheme value") ||
    label.includes("sales realisation") ||
    label.includes("profit value") ||
    label.includes("profit on") ||
    label.includes("cop percentage")
  );
}

function sectionDescription(sectionCode) {
  const code = String(sectionCode || "");
  if (code === "A_COP")
    return "(Values here flow downward - each row adds up to the next.)";
  if (code === "C_IK_PRICING")
    return "(This section calculates net Sales Realisation for Inside Kerala.)";
  if (code === "D_OK_PRICING")
    return "(This section calculates net Sales Realisation for Outside Kerala.)";
  if (code === "E_PROFIT") return "";
  return "";
}

function costSheetFirstColumnHeader(sectionCode) {
  const code = String(sectionCode || "");
  if (code === "A_COP" || code === "B_INTERNAL_COST") return "Cost Component";
  if (code === "C_IK_PRICING" || code === "D_OK_PRICING")
    return "Pricing Component";
  if (code === "E_PROFIT") return "Component";
  return "Component";
}

function costSheetLineClass(line) {
  const label = String(line?.line_label || "")
    .trim()
    .toLowerCase();
  const strongRows = [
    "total material cost",
    "manufacturing cop",
    "internal loaded cost",
    "sales realisation: ik",
    "sales realisation: ok",
    "profit value: ik",
    "profit value: ok",
  ];
  const subRows = [
    "production overhead",
    "quality control overhead",
    "materials / stores overhead",
    "administrative overhead",
    "finance admin overhead",
  ];
  if (strongRows.includes(label)) return "cost-sheet-row-strong";
  if (subRows.includes(label)) return "cost-sheet-row-sub";
  return "";
}

function buildCostSheetA4Table(rows, skuColumns) {
  const sectionMap = new Map();
  rows.forEach((row) => {
    if (row.section_code === "Z_STATUS") return;
    const sectionKey = `${row.section_code || ""}::${row.section_title || ""}`;
    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        section_code: row.section_code,
        section_title: row.section_title,
        lines: new Map(),
      });
    }
    const section = sectionMap.get(sectionKey);
    const lineKey = [
      row.section_code || "",
      row.section_title || "",
      row.line_order ?? "",
      row.line_label || "",
    ].join("::");
    if (!section.lines.has(lineKey)) {
      section.lines.set(lineKey, {
        section_code: row.section_code,
        section_title: row.section_title,
        line_order: row.line_order,
        line_label: row.line_label,
        calculation_basis: row.calculation_basis,
        source_note: row.source_note,
        values: new Map(),
      });
    }
    section.lines
      .get(lineKey)
      .values.set(String(row.sku_id ?? row.sku_column_label ?? ""), row);
  });

  return [...sectionMap.values()]
    .sort((a, b) => {
      const section = String(a.section_code || "").localeCompare(
        String(b.section_code || ""),
      );
      if (section) return section;
      return String(a.section_title || "").localeCompare(
        String(b.section_title || ""),
      );
    })
    .map((section) => {
      const lines = [...section.lines.values()].sort((a, b) => {
        const ao = Number(a.line_order ?? 0);
        const bo = Number(b.line_order ?? 0);
        if (ao !== bo) return ao - bo;
        return String(a.line_label || "").localeCompare(
          String(b.line_label || ""),
        );
      });
      const desc = sectionDescription(section.section_code);
      const bodyRows = lines
        .map((line) => {
          const calc =
            line.calculation_basis && shouldShowCalculationInPrint(line)
              ? `<span class="cost-sheet-line-calc">${text(line.calculation_basis)}</span>`
              : "";
          return `<tr class="${costSheetLineClass(line)}">
            <td><span class="cost-sheet-line-label">${text(line.line_label)}</span>${calc}</td>
            ${skuColumns
              .map((sku) => {
                const valueRow = line.values.get(
                  String(sku.sku_id ?? sku.label ?? ""),
                );
                const isText =
                  String(valueRow?.value_type || "").toLowerCase() === "text";
                return `<td class="${isText ? "cost-sheet-text-cell" : ""}">${formatPrintableValue(valueRow)}</td>`;
              })
              .join("")}
          </tr>`;
        })
        .join("");
      return `
        <div class="cost-sheet-section-title">${text(section.section_title || section.section_code || "Section")}</div>
        ${desc ? `<div class="cost-sheet-section-desc">${text(desc)}</div>` : ""}
        <table class="cost-sheet-table">
          <thead>
            <tr>
              <th>${text(costSheetFirstColumnHeader(section.section_code))}</th>
              ${skuColumns.map((sku) => `<th>${text(sku.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>`;
    })
    .join("");
}

function buildCostSheetStatusNote(rows) {
  const statusNotes = uniqueValues(rows, "cost_sheet_note");
  const status = uniqueValues(rows, "cost_sheet_status").map(normalizeStatus);
  const note = statusNotes.find(Boolean);
  const stat = status.includes("BLOCKED")
    ? "BLOCKED"
    : status.includes("REVIEW_REQUIRED")
      ? "REVIEW_REQUIRED"
      : status[0] || "";
  if (!note && !stat) return "";
  return `<div class="cost-sheet-status-note"><strong>Status:</strong> ${text(stat || "--")}${note ? ` &mdash; ${text(note)}` : ""}</div>`;
}

function openCostSheetModal(productId) {
  if (!costSheetModal || !costSheetA4) return;
  if (costSheetModal.classList.contains("hidden")) {
    COST_SHEET_RETURN_FOCUS = document.activeElement;
  }
  CURRENT_COST_SHEET_PRODUCT_ID = productId;
  const rows = printableRowsForProduct(productId);
  if (!rows.length) {
    showToast("No printable cost sheet lines found for this product.", "info");
    return;
  }

  const first = rows[0] || {};
  const productRow = groupPrintableLinesByProduct(rows)[0] || first;
  const skuColumns = getPrintableSkuColumns(rows);
  const tableHtml = buildCostSheetA4Table(rows, skuColumns);
  const notesHtml = buildCostSheetStatusNote(rows);

  if (costSheetModalTitle) costSheetModalTitle.textContent = "Cost Sheet";
  if (costSheetModalSubtitle) {
    costSheetModalSubtitle.textContent = `${productRow.product_name || productRow.product_id || ""} | ${formatPeriodMonth(productRow.period_start)}`;
  }

  const exportedAt = getExportedAtIst();
  costSheetA4.innerHTML = `
    <div class="cost-sheet-letterhead">
      <div class="cost-sheet-company">
        <div class="cost-sheet-org">Santhigiri Ayurveda Siddha Vaidyasala</div>
        <div class="cost-sheet-address">
          Santhigiri Ashram, Santhigiri P O, Thiruvananthapuram, Kerala, 695589
        </div>
        <div class="cost-sheet-title">Cost Sheet - ${text(productRow.product_name || productRow.product_id)}</div>
      </div>
      <div class="cost-sheet-logo-wrap">
        <img src="./assets/santhigiri-logo.png" class="cost-sheet-logo" alt="Santhigiri Logo" onerror="this.style.display='none'">
      </div>
    </div>

    <div class="cost-sheet-hierarchy-line">
      <span><strong>Category:</strong> ${text(productRow.category_name)}</span>
      <span class="cs-sep">||</span>
      <span><strong>Sub-category:</strong> ${text(productRow.subcategory_name)}</span>
      <span class="cs-sep">||</span>
      <span><strong>Group:</strong> ${text(productRow.group_name)}</span>
      <span class="cs-sep">||</span>
      <span><strong>Sub-group:</strong> ${text(productRow.sub_group_name)}</span>
    </div>

    <div class="cost-sheet-date-line">Costing Period: ${formatPeriodMonth(productRow.period_start)}</div>

    ${tableHtml}

    ${notesHtml}

    <div class="cost-sheet-signatures">
      <div>
        <div class="cost-sheet-sig-title">Prepared By</div>
        <div class="cost-sheet-sig-role">${text(COST_SHEET_SIGNATORIES.preparedRole)}</div>
        <div class="cost-sheet-sig-org">${text(COST_SHEET_SIGNATORIES.preparedOrg)}</div>
      </div>
      <div>
        <div class="cost-sheet-sig-title">Verified By</div>
        <div class="cost-sheet-sig-role">${text(COST_SHEET_SIGNATORIES.verifiedRole)}</div>
        <div class="cost-sheet-sig-org">${text(COST_SHEET_SIGNATORIES.verifiedOrg)}</div>
      </div>
      <div>
        <div class="cost-sheet-sig-title">Approved By</div>
        <div class="cost-sheet-sig-role">${text(COST_SHEET_SIGNATORIES.approvedRole)}</div>
        <div class="cost-sheet-sig-org">${text(COST_SHEET_SIGNATORIES.approvedOrg)}</div>
      </div>
    </div>
    <div class="cost-sheet-bottom-line"></div>
    <div class="cost-sheet-export-footer">
      Exported by: ${text(CURRENT_EXPORT_USER)} | Exported at: ${text(exportedAt)} IST
    </div>`;
  costSheetModal.classList.remove("hidden");
  costSheetModal.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    costSheetPdfBtn?.focus();
  }, 0);
}

function formatPrintablePdfValue(row) {
  if (!row) return "--";
  const type = String(row.value_type || "").toLowerCase();
  if (type === "currency") {
    if (
      row.value_numeric === null ||
      row.value_numeric === undefined ||
      row.value_numeric === ""
    )
      return "--";
    const n = Number(row.value_numeric);
    return Number.isFinite(n)
      ? `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : String(row.value_numeric);
  }
  if (type === "percent") {
    if (
      row.value_numeric === null ||
      row.value_numeric === undefined ||
      row.value_numeric === ""
    )
      return "--";
    const n = Number(row.value_numeric);
    return Number.isFinite(n)
      ? `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
      : String(row.value_numeric);
  }
  if (type === "text") return String(row.value_text || "--");
  if (
    row.value_text !== null &&
    row.value_text !== undefined &&
    row.value_text !== ""
  )
    return String(row.value_text);
  if (
    row.value_numeric === null ||
    row.value_numeric === undefined ||
    row.value_numeric === ""
  )
    return "--";
  const n = Number(row.value_numeric);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 3 })
    : String(row.value_numeric);
}

function isStrongCostSheetLine(label) {
  const l = String(label || "").toLowerCase();
  return (
    l.includes("total material cost") ||
    l.includes("manufacturing cop") ||
    l.includes("internal loaded cost") ||
    l.includes("sales realisation") ||
    l.includes("profit value")
  );
}

function isSubCostSheetLine(label) {
  const l = String(label || "").toLowerCase();
  return (
    l.includes("production overhead") ||
    l.includes("quality control overhead") ||
    l.includes("materials / stores overhead") ||
    l.includes("administrative overhead") ||
    l.includes("finance admin overhead")
  );
}

function buildCostSheetPdfBody(rows, skuColumns) {
  const lineMap = new Map();

  rows.forEach((row) => {
    if (row.section_code === "Z_STATUS") return;

    const key = [
      row.section_code || "",
      row.section_title || "",
      row.line_order ?? "",
      row.line_label || "",
    ].join("::");

    if (!lineMap.has(key)) {
      lineMap.set(key, {
        section_code: row.section_code,
        section_title: row.section_title,
        line_order: row.line_order,
        line_label: row.line_label,
        calculation_basis: row.calculation_basis,
        values: new Map(),
      });
    }

    lineMap
      .get(key)
      .values.set(String(row.sku_id ?? row.sku_column_label ?? ""), row);
  });

  const lines = [...lineMap.values()].sort((a, b) => {
    const section = String(a.section_code || "").localeCompare(
      String(b.section_code || ""),
    );
    if (section) return section;
    const ao = Number(a.line_order ?? 0);
    const bo = Number(b.line_order ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a.line_label || "").localeCompare(String(b.line_label || ""));
  });

  const head = [
    ["Component", ...skuColumns.map((sku) => String(sku.label || "--"))],
  ];
  const bodyRows = [];
  let currentKey = null;

  lines.forEach((line) => {
    const key = `${line.section_code || ""}::${line.section_title || ""}`;
    if (currentKey !== key) {
      currentKey = key;
      const sectionRow = [
        {
          content: line.section_title || line.section_code || "Section",
          colSpan: skuColumns.length + 1,
        },
      ];
      sectionRow._marker = "section";
      sectionRow._sectionCode = line.section_code;
      bodyRows.push(sectionRow);

      const desc = sectionDescription(line.section_code);
      if (desc) {
        const descRow = [
          {
            content: desc,
            colSpan: skuColumns.length + 1,
          },
        ];
        descRow._marker = "section_desc";
        bodyRows.push(descRow);
      }
    }

    const hasFormula = Boolean(
      line.calculation_basis && shouldShowCalculationInPrint(line),
    );
    const componentText = hasFormula
      ? `${line.line_label || ""}\nCalculation: ${line.calculation_basis}`
      : String(line.line_label || "");
    const valueRow = [
      componentText,
      ...skuColumns.map((sku) => {
        const row = line.values.get(String(sku.sku_id ?? sku.label ?? ""));
        return formatPrintablePdfValue(row);
      }),
    ];
    valueRow._marker = isStrongCostSheetLine(line.line_label)
      ? "strong"
      : isSubCostSheetLine(line.line_label)
        ? "sub"
        : "";
    valueRow._hasFormula = hasFormula;
    valueRow._label = String(line.line_label || "");
    valueRow._formula = hasFormula
      ? `Calculation: ${line.calculation_basis}`
      : "";
    valueRow._lineLabel = String(line.line_label || "");
    bodyRows.push(valueRow);
  });

  return { head, bodyRows };
}

function addCostSheetPdfFooter(doc, dims, exportedBy, exportedAt) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90);
    doc.text(
      `Exported by: ${exportedBy} | Exported at: ${exportedAt} IST`,
      dims.ML,
      dims.PH - 6,
      {
        maxWidth: dims.CW * 0.78,
      },
    );
    doc.text(`Page ${i} of ${pageCount}`, dims.PW - dims.MR, dims.PH - 6, {
      align: "right",
    });
  }
  doc.setTextColor(17, 24, 39);
}

function loadImageAsDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          nw: canvas.width,
          nh: canvas.height,
        });
      } catch (err) {
        console.warn("[Cost Sheet PDF] Logo conversion failed", err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function generateCostSheetPdf(productId) {
  const jspdfLib = window.jspdf;
  if (!jspdfLib?.jsPDF) {
    showToast("PDF library is not available. Please reload the page.", "error");
    return;
  }

  const rows = printableRowsForProduct(productId);
  if (!rows.length) {
    showToast("No cost sheet rows available for PDF.", "error");
    return;
  }

  const first = rows[0] || {};
  const productRow = groupPrintableLinesByProduct(rows)[0] || first;
  const skuColumns = getPrintableSkuColumns(rows);
  const exportedAt = getExportedAtIst();

  const { jsPDF } = jspdfLib;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  if (typeof doc.autoTable !== "function") {
    showToast(
      "PDF table plugin is not available. Please reload the page.",
      "error",
    );
    return;
  }

  const PW = 210;
  const PH = 297;
  const ML = 12;
  const MR = 12;
  const MT = 10;
  const MB = 12;
  const CW = PW - ML - MR;
  const dims = { PW, PH, ML, MR, MT, MB, CW };
  const { head, bodyRows } = buildCostSheetPdfBody(rows, skuColumns);
  const componentColWidth = CW * 0.44;
  const skuColWidth = (CW - componentColWidth) / Math.max(1, skuColumns.length);
  const columnStyles = {
    0: {
      cellWidth: componentColWidth,
      halign: "left",
      overflow: "linebreak",
    },
  };
  skuColumns.forEach((_, idx) => {
    columnStyles[idx + 1] = {
      cellWidth: skuColWidth,
      halign: "right",
      overflow: "linebreak",
    };
  });
  let y = MT;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 24, 39);
  doc.setLineWidth(0.35);
  doc.setDrawColor(75, 85, 99);
  doc.line(ML, y, PW - MR, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Santhigiri Ayurveda Siddha Vaidyasala", ML, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.text("Santhigiri Ashram, Santhigiri P O", ML, y);
  y += 3.2;
  doc.text("Thiruvananthapuram, Kerala, 695589", ML, y);

  try {
    const logoInfo = await loadImageAsDataUrl("./assets/santhigiri-logo.png");
    if (logoInfo) {
      const maxW = 22;
      const maxH = 22;
      const aspect = logoInfo.nw / logoInfo.nh;
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      doc.addImage(logoInfo.dataUrl, "PNG", PW - MR - w, MT + 3, w, h);
    }
  } catch (err) {
    console.warn("[Cost Sheet PDF] Logo load failed", err);
  }

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    `COST SHEET - ${String(productRow.product_name || "").toUpperCase()}`,
    ML,
    y,
  );
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  const hierarchyText =
    `Category: ${productRow.category_name || "--"}  ||  ` +
    `Sub-category: ${productRow.subcategory_name || "--"}  ||  ` +
    `Group: ${productRow.group_name || "--"}  ||  ` +
    `Sub-group: ${productRow.sub_group_name || "--"}`;
  const hierarchyLines = doc.splitTextToSize(hierarchyText, CW);
  doc.text(hierarchyLines, ML, y);
  y += hierarchyLines.length * 3.4 + 1.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.text(
    `Costing Period: ${formatPeriodMonth(productRow.period_start)}`,
    ML,
    y,
  );
  y += 4;

  doc.autoTable({
    startY: y,
    head,
    body: bodyRows,
    theme: "grid",
    showHead: "everyPage",
    margin: { left: ML, right: MR, top: MT + 4, bottom: MB + 8 },
    tableWidth: CW,
    rowPageBreak: "avoid",
    tableLineColor: [80, 80, 80],
    tableLineWidth: 0.12,
    styles: {
      font: "helvetica",
      fontSize: 6.7,
      cellPadding: { top: 0.75, right: 1.0, bottom: 0.75, left: 1.0 },
      lineColor: [90, 90, 90],
      lineWidth: 0.12,
      textColor: [17, 24, 39],
      overflow: "linebreak",
      valign: "middle",
      fontStyle: "normal",
      lineHeightFactor: 1.05,
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: "bold",
      fontSize: 6.9,
      halign: "center",
      lineColor: [80, 80, 80],
      lineWidth: 0.12,
    },
    columnStyles,
    didParseCell: (data) => {
      const raw = data.row.raw;
      const marker = raw?._marker;

      if (marker === "section") {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8.0;
        data.cell.styles.halign = "left";
        data.cell.styles.textColor = [17, 24, 39];
        data.cell.styles.lineColor = [51, 51, 51];
        data.cell.styles.lineWidth = {
          top: 0.22,
          right: 0,
          bottom: 0.22,
          left: 0,
        };
        data.cell.styles.cellPadding = {
          top: 1.05,
          right: 1,
          bottom: 1.05,
          left: 1.4,
        };
      }

      if (marker === "section_desc") {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.fontStyle = "italic";
        data.cell.styles.fontSize = 6.4;
        data.cell.styles.halign = "left";
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.textColor = [55, 65, 81];
        data.cell.styles.lineWidth = 0;
        data.cell.styles.cellPadding = {
          top: 0.55,
          right: 1,
          bottom: 0.55,
          left: 1.4,
        };
      }

      if (marker === "strong") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 6.9;
      }

      if (marker === "sub" && data.column.index === 0) {
        data.cell.styles.cellPadding = {
          top: 0.85,
          right: 1.1,
          bottom: 0.85,
          left: 3.5,
        };
      }

      if (data.section === "body" && data.column.index > 0) {
        data.cell.styles.halign = "right";
        data.cell.styles.valign = "middle";
      }

      if (
        marker === "strong" &&
        data.section === "body" &&
        data.column.index > 0
      ) {
        data.cell.styles.fontStyle = "bold";
      }

      if (
        data.section === "body" &&
        data.column.index === 0 &&
        data.row.raw?._hasFormula
      ) {
        data.cell.styles.fontSize = 6.2;
        data.cell.styles.fontStyle = "normal";
        data.cell.styles.textColor = [17, 24, 39];
        data.cell.styles.overflow = "linebreak";
        data.cell.styles.valign = "top";
        data.cell.styles.lineHeightFactor = 1.5;
        data.cell.styles.cellPadding = {
          top: 0.9,
          right: 1,
          bottom: 0.8,
          left: 1,
        };
      }
    },
  });

  y = doc.lastAutoTable.finalY + 4;

  const statusNotes = uniqueValues(rows, "cost_sheet_note").filter(Boolean);
  const statuses = uniqueValues(rows, "cost_sheet_status")
    .map(normalizeStatus)
    .filter(Boolean);
  const status = statuses.includes("BLOCKED")
    ? "BLOCKED"
    : statuses.includes("REVIEW_REQUIRED")
      ? "REVIEW_REQUIRED"
      : statuses[0] || "--";

  const requiredSigH = 34;
  if (y + requiredSigH > PH - MB) {
    doc.addPage();
    y = MT + 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.text(
    `Status: ${status}${statusNotes[0] ? ` - ${statusNotes[0]}` : ""}`,
    ML,
    y,
    { maxWidth: CW },
  );
  y += 16;

  const sigW = CW / 3;
  const sigY = y;
  const sigs = [
    [
      "Prepared By",
      COST_SHEET_SIGNATORIES.preparedRole,
      COST_SHEET_SIGNATORIES.preparedOrg,
    ],
    [
      "Verified By",
      COST_SHEET_SIGNATORIES.verifiedRole,
      COST_SHEET_SIGNATORIES.verifiedOrg,
    ],
    [
      "Approved By",
      COST_SHEET_SIGNATORIES.approvedRole,
      COST_SHEET_SIGNATORIES.approvedOrg,
    ],
  ];

  sigs.forEach((sig, idx) => {
    const x = ML + idx * sigW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(sig[0], x, sigY);
    doc.setLineWidth(0.18);
    doc.line(x, sigY + 10, x + sigW - 8, sigY + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.9);
    doc.text(sig[1], x, sigY + 14, { maxWidth: sigW - 8 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(sig[2], x, sigY + 18, { maxWidth: sigW - 8 });
  });

  const filename = `cs-${toKebabSlug(productRow.product_name)}-${formatTodayIsoIst()}.pdf`;
  addCostSheetPdfFooter(doc, dims, CURRENT_EXPORT_USER, exportedAt);
  doc.save(filename);
  showToast(`Saved: ${filename}`, "success", 4000);
}

async function renderCostComparisonTab(tabId) {
  const row = SELECTED_ROW || {};
  if (tabId === "overview") {
    return kvCards([
      ["Product", text(row.product_name || row.product_id)],
      ["SKU", text(row.sku_column_label || row.sku_display_name || row.sku_id)],
      ["Snapshot Period", formatPeriodMonth(row.snapshot_period_start)],
      ["Manufacturing COP", formatMoney(costComparisonValue(row, "manufacturingCop"))],
      [
        "Internal Loaded Cost",
        formatMoney(costComparisonValue(row, "internalLoadedCost")),
      ],
      ["Profit IK", formatMoney(costComparisonValue(row, "profitIk"))],
      ["Profit OK", formatMoney(costComparisonValue(row, "profitOk"))],
    ]);
  }

  if (tabId === "month-on-month") {
    const rows = [
      [
        "Manufacturing COP",
        costComparisonValue(row, "manufacturingCop"),
        costComparisonValue(row, "previousMonthCop"),
        costComparisonValue(row, "momCopChangePercent"),
        "percent",
      ],
      [
        "Internal Loaded Cost",
        costComparisonValue(row, "internalLoadedCost"),
        costComparisonValue(row, "previousMonthInternalLoadedCost"),
        costComparisonValue(row, "momInternalLoadedCostChangePercent"),
        "percent",
      ],
      [
        "Profit IK",
        costComparisonValue(row, "profitIk"),
        costComparisonValue(row, "previousMonthProfitIk"),
        costComparisonValue(row, "momProfitIkChange"),
        "money",
      ],
      [
        "Profit OK",
        costComparisonValue(row, "profitOk"),
        costComparisonValue(row, "previousMonthProfitOk"),
        costComparisonValue(row, "momProfitOkChange"),
        "money",
      ],
    ];
    return simpleTable(
      ["Metric", "Current", "Previous Month", "MoM Change"],
      rows,
      ([label, current, previous, change, changeType]) =>
        `<tr><td>${text(label)}</td><td class="c-right">${formatMoney(current)}</td><td class="c-right">${formatMoney(previous)}</td><td class="c-right">${changeType === "percent" ? formatPercent(change) : formatMoney(change)}</td></tr>`,
    );
  }

  const rows = [
    [
      "Manufacturing COP",
      costComparisonValue(row, "manufacturingCop"),
      costComparisonValue(row, "previousYearCop"),
      costComparisonValue(row, "yoyCopChangePercent"),
      "percent",
    ],
    [
      "Internal Loaded Cost",
      costComparisonValue(row, "internalLoadedCost"),
      costComparisonValue(row, "previousYearInternalLoadedCost"),
      costComparisonValue(row, "yoyInternalLoadedCostChangePercent"),
      "percent",
    ],
    [
      "Profit IK",
      costComparisonValue(row, "profitIk"),
      costComparisonValue(row, "previousYearProfitIk"),
      costComparisonValue(row, "yoyProfitIkChange"),
      "money",
    ],
    [
      "Profit OK",
      costComparisonValue(row, "profitOk"),
      costComparisonValue(row, "previousYearProfitOk"),
      costComparisonValue(row, "yoyProfitOkChange"),
      "money",
    ],
  ];
  return simpleTable(
    ["Metric", "Current", "Previous Year", "YoY Change"],
    rows,
    ([label, current, previous, change, changeType]) =>
      `<tr><td>${text(label)}</td><td class="c-right">${formatMoney(current)}</td><td class="c-right">${formatMoney(previous)}</td><td class="c-right">${changeType === "percent" ? formatPercent(change) : formatMoney(change)}</td></tr>`,
  );
}

async function renderSkuTab(tabId) {
  const detail = await fetchSkuDetail(SELECTED_ROW);
  if (tabId === "overview") {
    return kvCards([
      ["Product", text(detail.product_name || detail.product_id)],
      ["SKU", text(detail.sku_display_name || detail.sku_id)],
      [
        "MRP IK / OK",
        `${formatMoney(detail.mrp_ik)} / ${formatMoney(detail.mrp_ok)}`,
      ],
      [
        "Internal Loaded Cost",
        formatMoney(detail.internal_loaded_cost_per_sku),
      ],
      ["Pricing Cost", formatMoney(detail.pricing_cost_per_sku)],
      ["IK Selling Price", formatMoney(detail.ik_selling_price)],
      ["OK Selling Price", formatMoney(detail.ok_selling_price)],
      ["Status", statusChip(getRowStatus(detail))],
    ]);
  }
  if (tabId === "cost-layers") {
    const layers = [
      ["Material Cost", detail.material_cost_per_sku],
      ["Direct Labour", detail.direct_labour_cost_per_sku],
      ["Prime Cost", detail.prime_cost_per_sku],
      ["Production Overhead", detail.production_overhead_cost_per_sku],
      [
        "Quality Control Overhead",
        detail.quality_control_overhead_cost_per_sku,
      ],
      [
        "Materials / Stores Overhead",
        detail.materials_stores_overhead_cost_per_sku,
      ],
      ["Manufacturing COP", detail.manufacturing_cop_per_sku],
      ["Admin Overhead", detail.admin_overhead_cost_per_sku],
      ["Finance Admin Overhead", detail.finance_admin_overhead_cost_per_sku],
      ["Internal Loaded Cost", detail.internal_loaded_cost_per_sku],
      ["Marketing Expense", detail.marketing_expense_cost_per_sku],
      ["Pricing Cost", detail.pricing_cost_per_sku],
    ];
    return simpleTable(
      ["Layer", "Amount"],
      layers,
      ([label, value]) =>
        `<tr><td>${text(label)}</td><td class="c-right">${formatMoney(value)}</td></tr>`,
    );
  }
  if (tabId === "selling-price") {
    const rows = [
      ["MRP", detail.mrp_ik, detail.mrp_ok],
      ["GST %", detail.gst_percent, detail.gst_percent],
      ["Basic Price", detail.ik_basic_price, detail.ok_basic_price],
      ["Discount %", detail.ik_discount_percent, detail.ok_discount_percent],
      ["Discount Amount", detail.ik_discount_amount, detail.ok_discount_amount],
      ["Selling Price", detail.ik_selling_price, detail.ok_selling_price],
      ["Contingency %", detail.contingency_percent, detail.contingency_percent],
      [
        "Contingency Value",
        detail.ik_contingency_value,
        detail.ok_contingency_value,
      ],
    ];
    return simpleTable(
      ["Metric", "IK", "OK"],
      rows,
      ([label, ik, ok]) =>
        `<tr><td>${text(label)}</td><td class="c-right">${label.includes("%") ? formatPercent(ik) : formatMoney(ik)}</td><td class="c-right">${label.includes("%") ? formatPercent(ok) : formatMoney(ok)}</td></tr>`,
    );
  }
  if (tabId === "scheme") {
    const rows = await fetchSkuSchemes(SELECTED_ROW);
    return simpleTable(
      [
        "Scheme",
        "IK Effective SP",
        "IK Net Sales",
        "IK Margin",
        "IK Margin %",
        "IK Band",
        "OK Effective SP",
        "OK Net Sales",
        "OK Margin",
        "OK Margin %",
        "OK Band",
        "Status",
      ],
      rows,
      (r) =>
        `<tr><td>${text(r.scheme_name)}</td><td class="c-right">${formatMoney(r.ik_scheme_effective_selling_price)}</td><td class="c-right">${formatMoney(r.ik_net_sales_realisation)}</td><td class="c-right">${formatMoney(r.ik_margin_amount_after_scheme)}</td><td class="c-right">${formatPercent(r.ik_margin_percent_after_scheme)}</td><td>${marginBandChip(r.ik_scheme_margin_band)}</td><td class="c-right">${formatMoney(r.ok_scheme_effective_selling_price)}</td><td class="c-right">${formatMoney(r.ok_net_sales_realisation)}</td><td class="c-right">${formatMoney(r.ok_margin_amount_after_scheme)}</td><td class="c-right">${formatPercent(r.ok_margin_percent_after_scheme)}</td><td>${marginBandChip(r.ok_scheme_margin_band)}</td><td>${statusChip(r.scheme_viability_status)}</td></tr>`,
    );
  }
  const d = await fetchSkuDiagnostics(SELECTED_ROW);
  if (!d) return `<div class="status">No diagnostics found for this SKU.</div>`;
  return kvCards([
    ["Pricing Bridge Status", statusChip(d.pricing_bridge_status)],
    ["Selling Price Bridge Status", statusChip(d.selling_price_bridge_status)],
    ["Scheme Viability Status", statusChip(d.scheme_viability_status)],
    ["Internal Loaded Cost Status", statusChip(d.internal_loaded_cost_status)],
    ["Manufacturing COP Status", statusChip(d.manufacturing_cop_status)],
    [
      "Primary Diagnostic Code",
      text(issueCodeLabel(d.primary_diagnostic_code)),
    ],
    ["Primary Diagnostic Note", text(d.primary_diagnostic_note)],
  ]);
}

async function renderWorkbenchTab(tabId) {
  const r = SELECTED_ROW;
  if (tabId === "action") {
    return kvCards([
      ["Status", statusChip(r.material_line_status)],
      ["Issue Code", text(issueCodeLabel(r.material_issue_code))],
      ["Source", text(r.bom_source)],
      ["Stock Item ID", text(r.stock_item_id)],
      ["Stock Item", text(r.stock_item_name)],
      ["Selected Rate", formatMoney(r.selected_rate)],
      ["Rate Source", text(r.rate_source)],
      ["Rate Date", formatDate(r.rate_date)],
      ["Affected Products", formatNumber(r.affected_product_count)],
      ["Affected SKUs", formatNumber(r.affected_sku_count)],
      ["Recommended Action", text(r.recommended_action)],
    ]);
  }
  const rows = await fetchActionDrilldown(r);
  if (tabId === "affected") {
    return simpleTable(
      [
        "Product",
        "SKU",
        "Pack",
        "UOM",
        "Line",
        "Qty / Ref Output",
        "Optional",
        "Action Required",
        "Warning",
      ],
      rows,
      (x) =>
        `<tr><td>${text(x.product_name)}</td><td>${text(x.sku_id || "Product-level RM")}</td><td>${text(x.pack_size)}</td><td>${text(x.sku_uom)}</td><td>${text(x.line_no)}</td><td class="c-right">${formatNumber(x.qty_per_reference_output)}</td><td>${text(x.is_optional)}</td><td>${text(x.action_required)}</td><td>${text(x.warning_text)}</td></tr>`,
    );
  }
  return simpleTable(
    [
      "Selected Rate",
      "Rate Source",
      "Rate Date",
      "Warning Code",
      "Warning Text",
      "Approval Block",
    ],
    rows,
    (x) =>
      `<tr><td class="c-right">${formatMoney(x.selected_rate)}</td><td>${text(x.rate_source)}</td><td>${formatDate(x.rate_date)}</td><td>${text(x.warning_code)}</td><td>${text(x.warning_text)}</td><td>${text(x.approval_block_flag)}</td></tr>`,
  );
}

function setModalTabs(tabs, activeId) {
  drawerTabs.innerHTML = tabs
    .map(
      (t) =>
        `<div class="tab ${t.id === activeId ? "active" : ""}" data-tab="${t.id}">${t.label}</div>`,
    )
    .join("");
  drawerTabs
    .querySelectorAll(".tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => setDrawerTab(tab.dataset.tab)),
    );
}

async function setDrawerTab(tabId) {
  if (!SELECTED_ROW) return;
  drawerTabs
    .querySelectorAll(".tab")
    .forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.tab === tabId),
    );
  drawerContent.innerHTML = `<div class="status">Loading...</div>`;
  try {
    if (CURRENT_LENS === "dashboard") {
      drawerContent.innerHTML = renderDashboardOverview();
    } else if (CURRENT_LENS === "costing-review-workbench") {
      drawerContent.innerHTML = await renderWorkbenchTab(tabId);
    } else if (CURRENT_LENS === "cost-comparison") {
      drawerContent.innerHTML = await renderCostComparisonTab(tabId);
    } else {
      drawerContent.innerHTML = await renderSkuTab(tabId);
    }
  } catch (err) {
    handleError("Failed to load detail tab", err, true);
  }
}

function openDetails(row, preferredTab) {
  DETAILS_RETURN_FOCUS = document.activeElement;
  SELECTED_ROW = row;
  if (!detailsModal) return;
  const title = $("drawerTitle");
  const subtitle = $("drawerSubtitle");
  if (CURRENT_LENS === "costing-review-workbench") {
    title.textContent = issueCodeLabel(row.material_issue_code);
    subtitle.textContent = row.stock_item_name || row.stock_item_id || "";
    setModalTabs(
      [
        { id: "action", label: "Action Item" },
        { id: "affected", label: "Affected Products/SKUs" },
        { id: "raw", label: "Raw Issue Lines" },
      ],
      preferredTab || "action",
    );
    setDrawerTab(preferredTab || "action");
  } else if (CURRENT_LENS === "dashboard") {
    title.textContent = "Dashboard Summary";
    subtitle.textContent = `Period ${ACTIVE_PERIOD_START || "--"}`;
    setModalTabs([{ id: "overview", label: "Overview" }], "overview");
    setDrawerTab("overview");
  } else if (CURRENT_LENS === "cost-comparison") {
    title.textContent =
      row.sku_column_label || row.sku_display_name || row.sku_id || "Cost Comparison";
    subtitle.textContent = row.product_name || row.product_id || "";
    const active = preferredTab || "overview";
    setModalTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "month-on-month", label: "Month-on-Month" },
        { id: "year-on-year", label: "Year-on-Year" },
      ],
      active,
    );
    setDrawerTab(active);
  } else {
    title.textContent = row.sku_display_name || row.sku_id || "SKU Details";
    subtitle.textContent = row.product_name || row.product_id || "";
    const active = preferredTab || "overview";
    setModalTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "cost-layers", label: "Cost Layers" },
        { id: "selling-price", label: "Selling Price" },
        { id: "scheme", label: "Scheme Comparison" },
        { id: "diagnostics", label: "Diagnostics" },
      ],
      active,
    );
    setDrawerTab(active);
  }
  detailsModal.classList.remove("hidden");
  detailsModal.setAttribute("aria-hidden", "false");
}

function closeDetails() {
  if (!detailsModal) return;

  const active = document.activeElement;
  if (active && detailsModal.contains(active)) {
    active.blur();
  }

  SELECTED_ROW = null;
  detailsModal.classList.add("hidden");
  detailsModal.setAttribute("aria-hidden", "true");

  const returnTarget =
    DETAILS_RETURN_FOCUS &&
    DETAILS_RETURN_FOCUS !== document.body &&
    document.contains(DETAILS_RETURN_FOCUS)
      ? DETAILS_RETURN_FOCUS
      : searchBox;
  DETAILS_RETURN_FOCUS = null;
  if (returnTarget && typeof returnTarget.focus === "function") {
    setTimeout(() => returnTarget.focus(), 0);
  }
}

async function refreshCostingChain() {
  if (!ACTIVE_PERIOD_START) ACTIVE_PERIOD_START = getCurrentMonthStart();
  refreshBtn.disabled = true;
  setLoadingMask(true, "Refreshing costing/pricing snapshots...");
  setStatus("Refreshing costing/pricing snapshots...");
  try {
    const { error } = await costingRpc("rpc_refresh_costing_pricing_chain", {
      p_period_start: ACTIVE_PERIOD_START,
    });
    if (error) throw error;
    await loadRowsForLens();
    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();
    showToast("Costing/pricing snapshots refreshed", "success");
  } catch (err) {
    handleError("Refresh failed", err);
  } finally {
    setLoadingMask(false);
    refreshBtn.disabled = false;
  }
}

function openSnapshotConfirmModal() {
  if (!ACTIVE_PERIOD_START) ACTIVE_PERIOD_START = getCurrentMonthStart();

  if (snapshotConfirmPeriod) {
    snapshotConfirmPeriod.textContent = formatPeriodMonth(ACTIVE_PERIOD_START);
  }

  snapshotConfirmModal?.classList.remove("hidden");
  snapshotConfirmModal?.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    snapshotConfirmProceedBtn?.focus();
  }, 0);
}

function closeSnapshotConfirmModal() {
  if (!snapshotConfirmModal) return;

  const active = document.activeElement;
  if (active && snapshotConfirmModal.contains(active)) {
    active.blur();
  }

  snapshotConfirmModal.classList.add("hidden");
  snapshotConfirmModal.setAttribute("aria-hidden", "true");

  if (snapshotRefreshBtn && typeof snapshotRefreshBtn.focus === "function") {
    setTimeout(() => snapshotRefreshBtn.focus(), 0);
  }
}

async function refreshMonthlySnapshot() {
  if (!ACTIVE_PERIOD_START) ACTIVE_PERIOD_START = getCurrentMonthStart();

  const periodLabel = formatPeriodMonth(ACTIVE_PERIOD_START);

  if (snapshotRefreshBtn) snapshotRefreshBtn.disabled = true;
  setLoadingMask(true, `Refreshing monthly snapshot for ${periodLabel}...`);
  setStatus(`Refreshing monthly snapshot for ${periodLabel}...`);

  try {
    const { data, error } = await costingRpc(
      "rpc_refresh_cost_sheet_line_monthly_snapshot",
      {
        p_period_start: ACTIVE_PERIOD_START,
      },
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const deletedRows = result?.deleted_rows ?? "--";
    const insertedRows = result?.inserted_rows ?? "--";

    await loadRowsForLens();

    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();

    showToast(
      `Monthly snapshot refreshed. Deleted: ${deletedRows}, Inserted: ${insertedRows}`,
      "success",
      5200,
    );
  } catch (err) {
    handleError("Monthly snapshot refresh failed", err);
  } finally {
    setLoadingMask(false);
    if (snapshotRefreshBtn) snapshotRefreshBtn.disabled = false;
  }
}

function exportCsvForRows(rows) {
  if (!rows.length) {
    showToast("No rows to export", "info");
    return;
  }
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    keys.map(csvEscape).join(","),
    ...rows.map((row) => keys.map((k) => csvEscape(row[k])).join(",")),
  ].join("\n");
  const yyyymm = String(ACTIVE_PERIOD_START || "")
    .slice(0, 7)
    .replace("-", "");
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const filename = `ERP_COSTING_PRICING_${CURRENT_LENS.toUpperCase().replace(/-/g, "_")}_PERIOD_${yyyymm}_ROWS_${rows.length}_TS_${ts}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} rows`, "success");
}

function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const statusDetail = $("sc-status-detail");
  const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
  if (!LAST_REFRESH_TIME) {
    if (lbl) lbl.textContent = "Not loaded";
    if (statusDetail) statusDetail.textContent = "Not yet loaded";
    lastRefreshed.setAttribute("aria-label", "Data not yet loaded");
    return;
  }
  const elapsedMin = Math.floor(
    (Date.now() - LAST_REFRESH_TIME.getTime()) / 60000,
  );
  let label = "Just now";
  let statusClass = "snapshot-fresh";
  if (elapsedMin >= 1 && elapsedMin < 15) label = `${elapsedMin}m ago`;
  else if (elapsedMin >= 15 && elapsedMin < 60) {
    label = `${elapsedMin}m ago`;
    statusClass = "snapshot-warning";
  } else if (elapsedMin >= 60) {
    label = `${Math.floor(elapsedMin / 60)}h ago`;
    statusClass = "snapshot-stale";
  }
  if (lbl) lbl.textContent = label;
  const detailText = `Last refreshed: ${LAST_REFRESH_TIME.toLocaleString()}`;
  if (statusDetail) statusDetail.textContent = detailText;
  lastRefreshed.className = `${lastRefreshed.className.replace(/snapshot-\w+/g, "").trim()} ${statusClass}`;
  lastRefreshed.setAttribute("aria-label", detailText);
}

function showToast(message, type = "info", duration = 3200) {
  const container = $("peqToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `peq-toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

function updateFilterButtonState() {
  const btn = $("peqFilterBtn");
  if (!btn) return;
  const count =
    ACTIVE_FILTERS.status.length +
    ACTIVE_FILTERS.issue.length +
    ACTIVE_FILTERS.source.length;
  btn.classList.toggle("peq-filter-btn--active", count > 0);
  const badge = btn.querySelector(".peq-filter-badge");
  if (badge) {
    badge.textContent = count || "";
    badge.style.display = count ? "" : "none";
  }
  const summary = document.querySelector(".peq-filter-summary");
  if (summary)
    summary.textContent = count
      ? `${count} filter${count === 1 ? "" : "s"} applied`
      : "No filters applied";
}

function syncFilterCheckboxes() {
  document
    .querySelectorAll("#peqFilterDrawer input[data-filter-group]")
    .forEach((cb) => {
      const group = cb.dataset.filterGroup;
      cb.checked = ACTIVE_FILTERS[group].includes(normalizeStatus(cb.value));
    });
  updateFilterButtonState();
}

function toggleFilterDrawer() {
  const drawer = $("peqFilterDrawer");
  if (!drawer) return;
  _filterDrawerOpen = !_filterDrawerOpen;
  drawer.classList.toggle("open", _filterDrawerOpen);
}

function closeFilterDrawer() {
  _filterDrawerOpen = false;
  $("peqFilterDrawer")?.classList.remove("open");
}

function wireFilterDrawer() {
  $("peqFilterBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFilterDrawer();
  });
  $("peqFilterDrawer")?.addEventListener("change", (e) => {
    const cb = e.target;
    if (!(cb instanceof HTMLInputElement) || !cb.dataset.filterGroup) return;
    const group = cb.dataset.filterGroup;
    const value = normalizeStatus(cb.value);
    if (cb.checked) {
      if (!ACTIVE_FILTERS[group].includes(value))
        ACTIVE_FILTERS[group].push(value);
    } else {
      ACTIVE_FILTERS[group] = ACTIVE_FILTERS[group].filter((v) => v !== value);
    }
    updateFilterButtonState();
    applyFilters();
  });
  $("peqFilterClear")?.addEventListener("click", () => {
    ACTIVE_FILTERS = { status: [], issue: [], source: [] };
    syncFilterCheckboxes();
    applyFilters();
  });
  $("peqFilterSelectAll")?.addEventListener("click", () => {
    document
      .querySelectorAll("#peqFilterDrawer input[data-filter-group]")
      .forEach((cb) => {
        const group = cb.dataset.filterGroup;
        const value = normalizeStatus(cb.value);
        if (!ACTIVE_FILTERS[group].includes(value))
          ACTIVE_FILTERS[group].push(value);
      });
    syncFilterCheckboxes();
    applyFilters();
  });
  document.addEventListener("click", (e) => {
    const wrapper = $("peqFilterWrapper");
    if (wrapper && !wrapper.contains(e.target)) closeFilterDrawer();
  });
}

function handleError(message, err, inModal = false) {
  console.error(`[costing-pricing] ${message}`, err);
  const detail = err?.message ? `${message}: ${err.message}` : message;
  if (inModal && drawerContent)
    drawerContent.innerHTML = `<div class="status" style="color:#b91c1c">${escapeHtml(detail)}</div>`;
  else setStatus(detail, "error");
  showToast(message, "error", 4200);
}

async function init() {
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/login.html";
      return;
    }
    CURRENT_EXPORT_USER = session?.user?.email || "--";
    await loadPermissions(session.user.id);
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }
    ACTIVE_PERIOD_START = await resolveActivePeriodStart();
    renderLensPills();
    wireFilterDrawer();
    syncFilterCheckboxes();
    await loadRowsForLens();
  } catch (err) {
    handleError("Initialization error", err);
  }
}

refreshBtn?.addEventListener("click", refreshCostingChain);
snapshotRefreshBtn?.addEventListener("click", openSnapshotConfirmModal);
snapshotConfirmCloseBtn?.addEventListener("click", closeSnapshotConfirmModal);
snapshotConfirmCancelBtn?.addEventListener("click", closeSnapshotConfirmModal);
snapshotConfirmProceedBtn?.addEventListener("click", async () => {
  closeSnapshotConfirmModal();
  await refreshMonthlySnapshot();
});
snapshotConfirmModal?.addEventListener("click", (e) => {
  if (e.target === snapshotConfirmModal) closeSnapshotConfirmModal();
});
exportBtn?.addEventListener("click", () => exportCsvForRows(VIEW));
$("homeBtn")?.addEventListener("click", () => Platform.goHome());
searchBox?.addEventListener("input", applySearch);
searchClear?.addEventListener("click", () => {
  searchBox.value = "";
  applySearch();
  searchBox.focus();
});
lensSelect?.addEventListener("change", () => switchLens(lensSelect.value));
prevPage?.addEventListener("click", () => {
  if (CURRENT_PAGE > 1) {
    CURRENT_PAGE -= 1;
    renderTable();
  }
});
nextPage?.addEventListener("click", () => {
  if (CURRENT_PAGE < Math.ceil(VIEW.length / PAGE_SIZE)) {
    CURRENT_PAGE += 1;
    renderTable();
  }
});
drawerClose?.addEventListener("click", closeDetails);
detailsModal?.addEventListener("click", (e) => {
  if (e.target === detailsModal) closeDetails();
});
costSheetCloseBtn?.addEventListener("click", closeCostSheetModal);
costSheetPdfBtn?.addEventListener("click", openCostSheetSignModal);
costSheetModal?.addEventListener("click", (e) => {
  if (e.target === costSheetModal) closeCostSheetModal();
});
costSheetSignCloseBtn?.addEventListener("click", closeCostSheetSignModal);
costSheetSignCancelBtn?.addEventListener("click", closeCostSheetSignModal);
costSheetSignConfirmBtn?.addEventListener("click", confirmCostSheetSignatories);
costSheetSignModal?.addEventListener("click", (e) => {
  if (e.target === costSheetSignModal) closeCostSheetSignModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeFilterDrawer();
    if (!costSheetSignModal?.classList.contains("hidden")) {
      closeCostSheetSignModal();
      return;
    }
    if (!detailsModal?.classList.contains("hidden")) closeDetails();
    if (!snapshotConfirmModal?.classList.contains("hidden")) {
      closeSnapshotConfirmModal();
      return;
    }
    if (!costSheetModal?.classList.contains("hidden")) closeCostSheetModal();
  }
});
lastRefreshed?.addEventListener("click", () => {
  const detail = $("sc-status-detail");
  if (!detail) return;
  const expanded = lastRefreshed.classList.toggle("sc-status-expanded");
  lastRefreshed.setAttribute("aria-expanded", String(expanded));
  detail.style.display = expanded ? "block" : "none";
});
setInterval(updateFreshnessIndicator, 60000);

init();

export {
  init,
  loadPermissions,
  getCurrentMonthStart,
  resolveActivePeriodStart,
  refreshCostingChain,
  refreshMonthlySnapshot,
  loadDashboardSummary,
  loadRowsForLens,
  applyFilters,
  applySearch,
  renderKpiStrip,
  renderLensPills,
  renderTable,
  openDetails,
  closeDetails,
  setDrawerTab,
  showToast,
  exportCsvForRows,
  updateFreshnessIndicator,
};
