/* production-execution-queue.js */
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "production-execution-queue";
let PERM_CAN_VIEW = true;

// Elements
const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableBody = $("tableBody");
const refreshBtn = $("refreshBtn");
const searchBox = $("search");
const lastRefreshed = $("lastRefreshed");
const kpiStrip = $("kpiStrip");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const drawerClose = $("drawerClose");
const drawerTabs = $("drawerTabs");
const searchClear = $("searchClear");

// Data
let LAST_REFRESH_TIME = null;

function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const statusDetail = document.getElementById("sc-status-detail");
  if (!LAST_REFRESH_TIME) {
    lastRefreshed.className = lastRefreshed.className
      .replace(/snapshot-\w+/g, "")
      .trim();
    const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
    if (lbl) lbl.textContent = "Not loaded";
    if (statusDetail) statusDetail.textContent = "Not yet loaded";
    lastRefreshed.setAttribute("aria-label", "Data not yet loaded");
    return;
  }
  const elapsedMs = Date.now() - LAST_REFRESH_TIME.getTime();
  const elapsedMin = Math.floor(elapsedMs / 60000);
  let label, statusClass;
  if (elapsedMin < 1) {
    label = "Just now";
    statusClass = "snapshot-fresh";
  } else if (elapsedMin < 15) {
    label = `${elapsedMin}m ago`;
    statusClass = "snapshot-fresh";
  } else if (elapsedMin < 60) {
    label = `${elapsedMin}m ago`;
    statusClass = "snapshot-warning";
  } else {
    const elapsedHr = Math.floor(elapsedMin / 60);
    label = `${elapsedHr}h ago`;
    statusClass = "snapshot-stale";
  }
  const detailText = `Last refreshed: ${LAST_REFRESH_TIME.toLocaleString()}`;
  const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
  if (lbl) lbl.textContent = label;
  if (statusDetail) statusDetail.textContent = detailText;
  lastRefreshed.className =
    lastRefreshed.className.replace(/snapshot-\w+/g, "").trim() +
    " " +
    statusClass;
  lastRefreshed.setAttribute("aria-label", detailText);
}
let QUEUE = [];
let VIEW = [];
let CURRENT_LENS = "ready";
let SELECTED_ROW = null;
let CURRENT_PAGE = 1;
let PAGE_SIZE = 25;
let LAST_PAGE_ROWS = [];

const LENSES = [
  { id: "ready", label: "Ready to Execute" },
  { id: "fast_conversion", label: "Fast Conversion" },
  { id: "pm_blocked", label: "PM Blocked" },
  { id: "rm_blocked", label: "RM Blocked" },
  { id: "all", label: "All Batches" },
];

// ── Per-batch blocker caches (populated lazily on tab open) ────────────────
const PM_BLOCKER_CACHE = new Map();
const RM_BLOCKER_CACHE = new Map();

function getBatchKey(row) {
  return `${row.product_id}::${row.batch_number}`;
}

function setStatus(msg, type = "normal") {
  statusArea.textContent = msg;
  statusArea.style.display = "block";
  tableWrap.style.display = "none";
  tableWrap.classList.remove("tw-visible");

  // reflect type for styling or automated tests
  try {
    statusArea.dataset.type = type;
  } catch {
    // ignore in environments that disallow dataset
  }
}

async function refreshSnapshotAndReload() {
  try {
    refreshBtn.disabled = true;
    setStatus("Refreshing queue snapshot (1/2)…");
    const { error: e1 } = await supabase.rpc("refresh_priority_queue_snapshot");
    if (e1) throw e1;
    setStatus("Refreshing blocker snapshots (2/2)…");
    const { error: e2 } = await supabase.rpc(
      "refresh_blocker_snapshots_current_month",
    );
    if (e2) throw e2;
    // Invalidate per-batch blocker caches so re-opened modals fetch fresh data
    PM_BLOCKER_CACHE.clear();
    RM_BLOCKER_CACHE.clear();
    setStatus("Snapshots refreshed successfully.");
    await loadQueue();
  } catch (e) {
    console.error("Snapshot refresh failed", e);
    const msg = (e && (e.message || e.error || e.code || "")).toString();
    if (/permission|privileg|42501/i.test(msg)) {
      setStatus("You do not have permission to refresh snapshots.", "error");
    } else {
      setStatus("Refresh failed: " + (e.message || e), "error");
    }
    // attempt to load existing snapshot even if refresh fails
    await loadQueue();
  } finally {
    refreshBtn.disabled = false;
  }
}

function clearStatus() {
  statusArea.style.display = "none";
  tableWrap.style.display = "block";
  tableWrap.classList.add("tw-visible");
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
      // fallback
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
        console.warn("Permission fallback failed", e);
      }
    }
  } catch (e) {
    console.warn("Permission RPC failed", e);
  }
}

function renderLensPills() {
  lensPills.innerHTML = "";
  // keep compact select in sync (rebuild options)
  if (lensSelect) {
    lensSelect.innerHTML = "";
  }
  LENSES.forEach((l) => {
    const btn = document.createElement("button");
    btn.className = `pill${l.id === CURRENT_LENS ? " active" : ""}`;
    btn.textContent = l.label;
    btn.dataset.lens = l.id;

    btn.addEventListener("click", () => {
      CURRENT_LENS = l.id;
      renderLensPills();
      applyLensFilter();
    });

    lensPills.appendChild(btn);
    // add option for small-screen select
    if (lensSelect) {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.label;
      if (l.id === CURRENT_LENS) opt.selected = true;
      lensSelect.appendChild(opt);
    }
  });

  // sync select value
  if (lensSelect) lensSelect.value = CURRENT_LENS;
}

// Status helper utilities
function isPmOk(row) {
  const s = String(row?.pm_gate_status || "").toUpperCase();
  return s === "OK" || s === "PM_OK";
}
// Stage-aware RM readiness helper (preferred)
function isRmClearForExecution(row) {
  return row?.is_rm_ok_for_stage === true;
}

function isFastConversion(row) {
  const s = String(row?.primary_state || "").toUpperCase();
  return s === "FG_BULK" || s === "BOTTLED";
}

function getRmDisplay(row) {
  const state = String(row?.primary_state || "").toUpperCase();
  if (state === "FG_BULK" || state === "BOTTLED") {
    return { text: "N/A", cls: "rm-na" };
  }
  return isRmClearForExecution(row)
    ? { text: "RM OK", cls: "rm-ok" }
    : { text: "RM Blocked", cls: "rm-block" };
}

// ── Modal display helpers ───────────────────────────────────────────
function formatStatusBadge(text, type) {
  const S = {
    ok: "background:#e7f8ef;color:#1d8f54",
    block: "background:#fdecea;color:#c0392b",
    warn: "background:#fff4e5;color:#d97706",
    na: "background:#f3f4f6;color:#6b7280",
    info: "background:#eff6ff;color:#2563eb",
  };
  return `<span class="peq-badge" style="${S[type] || S.na}">${text}</span>`;
}

function makeSummaryCardHtml(label, value) {
  return `<div class="peq-summary-card"><div class="peq-k">${label}</div><div class="peq-v">${value}</div></div>`;
}

function getLaneLabel(row) {
  const l = Number(row?.queue_lane);
  if (l === 1) return { text: "Ready", type: "ok" };
  if (l === 2) return { text: "PM Blocked", type: "warn" };
  if (l === 3) return { text: "RM Blocked", type: "block" };
  return { text: `Lane ${l || "?"}`, type: "na" };
}

function getRecommendedAction(row) {
  const fgBtl = isFastConversion(row);
  const rmClear = fgBtl || isRmClearForExecution(row);
  const pmClear = isPmOk(row);
  if (!rmClear)
    return {
      text: "Resolve raw material blocker first. Refer to the RM Status tab.",
      cls: "action-warn",
    };
  if (!pmClear)
    return {
      text: "Resolve packing material blocker first. Refer to the PM Status tab.",
      cls: "action-warn",
    };
  if (fgBtl)
    return {
      text: "Prioritize this batch for fast conversion into finished supply.",
      cls: "action-ok",
    };
  return {
    text: "All gates clear. Proceed with production execution for this batch.",
    cls: "action-ok",
  };
}

// Formatter: human-readable batch size
function formatBatchSize(row) {
  if (row?.batch_size_declared == null) return "-";
  const qty = row.batch_size_declared;
  const uom = row.batch_uom || "";
  return `${qty} ${uom}`.trim();
}

// Formatter: storage quantity depending on primary_state
function formatStorageQty(row) {
  const state = String(row?.primary_state || "").toUpperCase();

  if (state === "FG_BULK") {
    if (row?.fg_bulk_on_hand_base_qty == null) return "-";
    const uom = row.batch_uom || "";
    return `${row.fg_bulk_on_hand_base_qty} ${uom}`.trim();
  }

  if (state === "BOTTLED") {
    const units = row?.bottled_on_hand_units;
    const baseQty = row?.bottled_on_hand_base_qty;
    const uom = row.batch_uom || "";

    if (units == null && baseQty == null) return "-";
    if (units != null && baseQty != null) {
      return `${units} Nos / ${baseQty} ${uom}`.trim();
    }
    if (units != null) return `${units} Nos`;
    return `${baseQty} ${uom}`.trim();
  }

  return "-";
}

function applyLensFilter() {
  if (!Array.isArray(QUEUE)) QUEUE = [];
  let rows = [...QUEUE];
  switch (CURRENT_LENS) {
    case "ready":
      rows = rows.filter((r) => Number(r.queue_lane) === 1);
      break;
    case "fast_conversion":
      rows = rows.filter((r) => isFastConversion(r));
      break;
    case "pm_blocked":
      rows = rows.filter((r) => Number(r.queue_lane) === 2);
      break;
    case "rm_blocked":
      rows = rows.filter((r) => Number(r.queue_lane) === 3);
      break;
    case "all":
    default:
      break;
  }
  // Default sort by priority_rank_v4 ascending
  rows.sort((a, b) => {
    const A = Number(a.priority_rank_v4 ?? 0);
    const B = Number(b.priority_rank_v4 ?? 0);
    return A - B;
  });
  VIEW = rows;
  console.debug("PEQ rows after lens:", CURRENT_LENS, VIEW.length);
  // reset pagination when lens changes
  CURRENT_PAGE = 1;
  applySearch();
  // show copy button only for Ready to Execute lens
  const _copyBtn = document.getElementById("copyReadyBtn");
  if (_copyBtn) _copyBtn.style.display = CURRENT_LENS === "ready" ? "" : "none";
}

function applySearch() {
  const q = (searchBox.value || "").trim().toLowerCase();
  let filtered = VIEW;
  if (q) {
    filtered = VIEW.filter((r) => {
      const hay = [
        r.batch_number,
        r.product_id != null ? String(r.product_id) : null,
        r.product_name != null ? String(r.product_name) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  renderTable(filtered);
}

function renderSummaryStrip(rowsDisplayed) {
  const total = QUEUE.length || 0;
  const readyCount = QUEUE.filter((r) => Number(r.queue_lane) === 1).length;
  const pmBlocked = QUEUE.filter((r) => Number(r.queue_lane) === 2).length;
  const rmBlocked = QUEUE.filter((r) => Number(r.queue_lane) === 3).length;
  const fastConv = QUEUE.filter((r) => isFastConversion(r)).length;

  const visibleRows = Array.isArray(rowsDisplayed) ? rowsDisplayed : VIEW;
  const visibleRisk = (visibleRows || []).reduce(
    (s, r) => s + Number(r.total_risk_reduction_units || 0),
    0,
  );

  kpiStrip.innerHTML = "";
  function formatNumeric(v) {
    if (v == null || Number.isNaN(Number(v))) return "-";
    const n = Number(v);
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toFixed(2)));
  }

  const items = [
    { key: "total", label: "Total Batches", value: total },
    { key: "ready", label: "Ready to Execute", value: readyCount },
    { key: "pm-blocked", label: "PM Blocked", value: pmBlocked },
    { key: "rm-blocked", label: "RM Blocked", value: rmBlocked },
    { key: "fast-conv", label: "Fast Conversion", value: fastConv },
    {
      key: "visible-risk",
      label: "Visible Risk Reduction",
      value: visibleRisk,
    },
  ];

  items.forEach((it) => {
    const el = document.createElement("div");
    el.className = `kpi ${it.key}`;
    const displayVal =
      it.key === "visible-risk"
        ? formatNumeric(it.value)
        : formatNumeric(it.value);
    el.innerHTML = `<div>${it.label}</div><div>${displayVal}</div>`;
    kpiStrip.appendChild(el);
  });
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  if (!rows || rows.length === 0) {
    setStatus("No rows match the current filter.");
    document.getElementById("paginationInfo").textContent = "";
    renderSummaryStrip([]);
    return;
  }
  clearStatus();

  // pagination
  const pageSize = PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;
  const start = (CURRENT_PAGE - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = rows.slice(start, end);
  console.debug("renderTable total rows:", rows.length);
  console.debug(
    "renderTable current page:",
    CURRENT_PAGE,
    "page size:",
    pageSize,
  );
  console.debug("renderTable pageRows:", pageRows.length, pageRows.slice(0, 3));

  pageRows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.tabIndex = 0;
    tr.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetails(r);
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.stopPropagation();
        openDetails(r);
      }
    });

    const make = (txt, cls) => {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = txt;
      return td;
    };

    // Lane indicator: narrow coloured td (background only, no content)
    const laneNum = Number(r.queue_lane);
    const laneCls =
      laneNum === 1
        ? "lane-ready"
        : laneNum === 2
          ? "lane-pm-block"
          : laneNum === 3
            ? "lane-rm-block"
            : "";
    const laneTd = document.createElement("td");
    laneTd.className = `lane-col${laneCls ? " " + laneCls : ""}`;

    // Priority
    const priorityTd = make(r.priority_rank_v4 ?? "", "c-center priority-col");

    // Product cell: name bold + muted id below
    const productTd = document.createElement("td");
    productTd.className = "product-cell c-left";
    const nameSpan = document.createElement("span");
    nameSpan.className = "product-name";
    nameSpan.textContent = r.product_name || String(r.product_id || "-");
    productTd.appendChild(nameSpan);
    if (r.product_id != null) {
      const idSpan = document.createElement("span");
      idSpan.className = "product-id-muted";
      idSpan.textContent = `ID ${r.product_id}`;
      productTd.appendChild(idSpan);
    }

    // Batch
    const batchTd = make(r.batch_number || "-", "c-center");

    // State
    const stateTd = make(r.primary_state || "-", "c-center");

    // PM chip
    const pmTd = document.createElement("td");
    pmTd.className = "c-center";
    const pmChip = document.createElement("span");
    pmChip.className = `status-chip ${isPmOk(r) ? "pm-ok" : "pm-block"}`;
    pmChip.textContent = isPmOk(r) ? "PM OK" : "PM Blocked";
    pmTd.appendChild(pmChip);

    // RM chip
    const rmTd = document.createElement("td");
    rmTd.className = "c-center";
    const rmChip = document.createElement("span");
    const rmDisplay = getRmDisplay(r);
    rmChip.className = `status-chip ${rmDisplay.cls}`;
    rmChip.textContent = rmDisplay.text;
    rmTd.appendChild(rmChip);

    tr.appendChild(laneTd);
    tr.appendChild(priorityTd);
    tr.appendChild(productTd);
    tr.appendChild(batchTd);
    tr.appendChild(stateTd);
    tr.appendChild(pmTd);
    tr.appendChild(rmTd);

    tableBody.appendChild(tr);
  });

  const pageInfoEl = document.getElementById("peqPage");
  if (pageInfoEl) {
    pageInfoEl.textContent = `Page ${CURRENT_PAGE}/${totalPages}`;
    pageInfoEl.title = `Page ${CURRENT_PAGE} of ${totalPages}`;
  }
  // enable/disable prev/next buttons
  try {
    const _prev = document.getElementById("prevPage");
    const _next = document.getElementById("nextPage");
    if (_prev) _prev.disabled = CURRENT_PAGE <= 1;
    if (_next) _next.disabled = CURRENT_PAGE >= totalPages;
  } catch {
    /* ignore */
  }
  // remember for export
  LAST_PAGE_ROWS = pageRows;
  renderSummaryStrip(pageRows);
}

function openDetails(row) {
  try {
    SELECTED_ROW = row;
    const _modal = document.getElementById("detailsModal");
    const _title = document.getElementById("drawerTitle");
    const _subtitle = document.getElementById("drawerSubtitle");
    if (_title)
      _title.textContent = `${row.product_name || ""} — Batch ${row.batch_number || ""}`;
    if (_subtitle) {
      const laneInfo = getLaneLabel(row);
      _subtitle.innerHTML =
        `<span>${row.primary_state || "-"}</span>` +
        `<span style="opacity:0.4">·</span>` +
        `<span>Priority #${row.priority_rank_v4 ?? "-"}</span>` +
        `<span style="opacity:0.4">·</span>` +
        formatStatusBadge(laneInfo.text, laneInfo.type);
    }
    if (_modal) {
      _modal.classList.remove("hidden");
      _modal.setAttribute("aria-hidden", "false");
    }
    // synchronous — #detailsModal is a sibling of .table-card, not an ancestor,
    // so row click events never bubble into it; setTimeout is not needed
    setDrawerTab("details");
  } catch (err) {
    console.error("[PEQ] openDetails error:", err);
  }
}

function closeDetails() {
  const _modal = document.getElementById("detailsModal");
  if (!_modal) return;
  const focused = document.activeElement;
  if (focused && _modal.contains(focused)) focused.blur();
  _modal.classList.add("hidden");
  _modal.setAttribute("aria-hidden", "true");
  SELECTED_ROW = null;
}

// ── Blocker formatters ───────────────────────────────────────────────────
function formatProcurementMode(value) {
  const v = String(value || "").toUpperCase();
  if (v === "JIT" || v === "JIT_PROCURED") return "JIT Procured";
  return "Stock Required";
}

function formatPmBlockerType(value) {
  if (!value) return "-";
  return String(value).replace(/_/g, " ");
}

function formatRmBlockerType(r) {
  if (r.has_unassigned_issues) return "Unassigned Issue";
  return "Shortage";
}

// ── Blocker loaders (snapshot tables) ────────────────────────────────
function _getMonthStart() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-01"
  );
}

async function loadPmBlockers(row) {
  const key = getBatchKey(row);
  if (PM_BLOCKER_CACHE.has(key)) return PM_BLOCKER_CACHE.get(key);
  const { data, error } = await supabase
    .from("pm_blockers_snapshot_current_month")
    .select(
      "pm_stock_item_id,pm_name,pm_uom,planned_pm_qty,issued_pm_qty,remaining_pm_qty,stock_qty,pm_blocker_class",
    )
    .eq("month_start", _getMonthStart())
    .eq("product_id", row.product_id)
    .eq("batch_number", row.batch_number)
    .order("remaining_pm_qty", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  PM_BLOCKER_CACHE.set(key, rows);
  return rows;
}

async function loadRmBlockers(row) {
  const key = getBatchKey(row);
  if (RM_BLOCKER_CACHE.has(key)) return RM_BLOCKER_CACHE.get(key);
  const { data, error } = await supabase
    .from("rm_blockers_snapshot_current_month")
    .select(
      "rm_stock_item_id,rm_name,rm_uom,planned_rm_qty,issued_rm_qty,remaining_rm_qty,rm_blocker_class,is_optional_rm,rm_procurement_mode,has_unassigned_issues",
    )
    .eq("month_start", _getMonthStart())
    .eq("product_id", row.product_id)
    .eq("batch_number", row.batch_number)
    .order("remaining_rm_qty", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  RM_BLOCKER_CACHE.set(key, rows);
  return rows;
}

// ── Blocker renderers ───────────────────────────────────────────────────
const _th = (t, align = "left") =>
  `<th style="text-align:${align};padding:5px 8px;border-bottom:2px solid var(--border);font-size:11px;text-transform:uppercase;color:var(--muted,#6b7280);font-weight:600;white-space:nowrap">${t}</th>`;
const _td = (t, align = "left") =>
  `<td style="text-align:${align};padding:6px 8px;border-bottom:1px solid var(--border);font-size:12.5px">${t ?? "-"}</td>`;

function renderPmBlockers(row, rows) {
  const _content = document.getElementById("drawerContent");
  if (!_content) return;
  const pmOk = isPmOk(row);
  const headerHtml = `
    <div class="peq-card" style="margin-bottom:14px">
      <div class="peq-card-title">PM Gate</div>
      <div class="peq-kv"><span class="peq-k">Decision</span><span class="peq-v">${formatStatusBadge(pmOk ? "PM OK" : "PM Blocked", pmOk ? "ok" : "block")}</span></div>
      <div class="peq-kv"><span class="peq-k">Status</span><span class="peq-v">${row.pm_gate_status || "-"}</span></div>
    </div>`;

  if (String(row.pm_gate_status || "").toUpperCase() !== "PM_BLOCKED") {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">No active PM blockers for this batch.</p>`;
    return;
  }
  if (!rows.length) {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">No PM blocker rows returned.</p>`;
    return;
  }

  const tbody = rows
    .map(
      (r) => `<tr>
    ${_td(r.pm_name || r.pm_stock_item_id)}
    ${_td(r.pm_uom)}
    ${_td(r.planned_pm_qty ?? "-", "right")}
    ${_td(r.issued_pm_qty ?? "-", "right")}
    ${_td(r.stock_qty ?? "-", "right")}
    ${_td(r.remaining_pm_qty ?? "-", "right")}
    ${_td(formatPmBlockerType(r.pm_blocker_class))}
  </tr>`,
    )
    .join("");

  _content.innerHTML =
    headerHtml +
    `
    <div class="peq-card-title" style="margin-bottom:8px">PM Blocker Lines</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${_th("PM Item")}${_th("UOM")}${_th("Planned", "right")}${_th("Issued", "right")}${_th("Stock", "right")}${_th("Shortage", "right")}${_th("Type")}
        </tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function renderRmBlockers(row, rows) {
  const _content = document.getElementById("drawerContent");
  if (!_content) return;
  const rmD = getRmDisplay(row);
  const rmTypeKey =
    rmD.cls === "rm-ok" ? "ok" : rmD.cls === "rm-block" ? "block" : "na";
  const headerHtml = `
    <div class="peq-card" style="margin-bottom:14px">
      <div class="peq-card-title">RM Gate</div>
      <div class="peq-kv"><span class="peq-k">Decision</span><span class="peq-v">${formatStatusBadge(rmD.text, rmTypeKey)}</span></div>
      <div class="peq-kv"><span class="peq-k">Status</span><span class="peq-v">${row.rm_gate_status_display || row.rm_gate_status || "-"}</span></div>
    </div>`;

  if (String(row.rm_gate_status_display || "") === "N/A") {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">RM is not an active execution gate at this stage.</p>`;
    return;
  }
  if (String(row.rm_gate_status || "").toUpperCase() !== "RM_BLOCKED") {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">No active RM blockers for this batch.</p>`;
    return;
  }
  if (!rows.length) {
    _content.innerHTML =
      headerHtml +
      `<p style="color:var(--muted,#6b7280);font-size:13px">No RM blocker rows returned.</p>`;
    return;
  }

  const tbody = rows
    .map((r) => {
      let typeTxt = formatRmBlockerType(r);
      if (r.is_optional_rm)
        typeTxt += ` <span class="peq-badge" style="background:#eff6ff;color:#2563eb;font-size:10px">Optional</span>`;
      return `<tr>
      ${_td(r.rm_name || r.rm_stock_item_id)}
      ${_td(r.rm_uom)}
      ${_td(r.planned_rm_qty ?? "-", "right")}
      ${_td(r.issued_rm_qty ?? "-", "right")}
      ${_td(r.remaining_rm_qty ?? "-", "right")}
      ${_td(formatProcurementMode(r.rm_procurement_mode))}
      ${_td(typeTxt)}
    </tr>`;
    })
    .join("");

  _content.innerHTML =
    headerHtml +
    `
    <div class="peq-card-title" style="margin-bottom:8px">RM Blocker Lines</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${_th("RM Item")}${_th("UOM")}${_th("Planned", "right")}${_th("Issued", "right")}${_th("Remaining", "right")}${_th("Mode")}${_th("Type")}
        </tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function setDrawerTab(id) {
  const _tabsEl = document.getElementById("drawerTabs");
  const _content = document.getElementById("drawerContent");
  if (!_tabsEl || !_content) {
    console.error("[PEQ] setDrawerTab: elements not found", {
      tabs: !!_tabsEl,
      content: !!_content,
    });
    return;
  }
  Array.from(_tabsEl.querySelectorAll(".tab")).forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === id),
  );
  if (!SELECTED_ROW) {
    _content.innerHTML = "<p>Select a row to view details.</p>";
    return;
  }
  if (id === "details") {
    try {
      renderDetailPanel(SELECTED_ROW);
    } catch (err) {
      console.error("[PEQ] renderDetailPanel threw:", err);
      _content.innerHTML = `<p style="color:red;padding:8px">Error rendering details: ${err.message || err}</p>`;
    }
  } else if (id === "why") {
    renderImpactTab(SELECTED_ROW);
  } else if (id === "pm") {
    const _r = SELECTED_ROW;
    _content.innerHTML = `<p style="color:var(--muted,#6b7280);font-size:13px;padding:8px">Loading PM blockers…</p>`;
    loadPmBlockers(_r)
      .then((rows) => renderPmBlockers(_r, rows))
      .catch((err) => {
        console.error("[PEQ] loadPmBlockers error:", err);
        _content.innerHTML = `<p style="color:red;padding:8px">Error loading PM blockers: ${err.message || err}</p>`;
      });
  } else if (id === "rm") {
    const _r = SELECTED_ROW;
    _content.innerHTML = `<p style="color:var(--muted,#6b7280);font-size:13px;padding:8px">Loading RM blockers…</p>`;
    loadRmBlockers(_r)
      .then((rows) => renderRmBlockers(_r, rows))
      .catch((err) => {
        console.error("[PEQ] loadRmBlockers error:", err);
        _content.innerHTML = `<p style="color:red;padding:8px">Error loading RM blockers: ${err.message || err}</p>`;
      });
  }
}

function renderDetailPanel(row) {
  console.log("[PEQ] renderDetailPanel:", row?.batch_number, row?.product_name);
  const _content = document.getElementById("drawerContent");
  if (!row) throw new Error("renderDetailPanel called with no row");
  if (!_content) throw new Error("#drawerContent not found in DOM");

  const laneInfo = getLaneLabel(row);
  const rmD = getRmDisplay(row);
  const action = getRecommendedAction(row);
  const fgBtl = isFastConversion(row);
  const rmTypeKey =
    rmD.cls === "rm-ok" ? "ok" : rmD.cls === "rm-block" ? "block" : "na";

  _content.innerHTML = `
    <div class="peq-summary-strip">
      ${makeSummaryCardHtml("State", row.primary_state || "-")}
      ${makeSummaryCardHtml("PM Status", formatStatusBadge(isPmOk(row) ? "PM OK" : "PM Blocked", isPmOk(row) ? "ok" : "block"))}
      ${makeSummaryCardHtml("RM Status", formatStatusBadge(rmD.text, rmTypeKey))}
      ${makeSummaryCardHtml("Risk Reduc.", String(row.total_risk_reduction_units ?? "-"))}
      ${makeSummaryCardHtml("Storage Qty", formatStorageQty(row))}
    </div>
    <div class="peq-section-grid">
      <div class="peq-card">
        <div class="peq-card-title">Batch Identity</div>
        <div class="peq-kv"><span class="peq-k">Product ID</span><span class="peq-v">${row.product_id ?? "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Item</span><span class="peq-v">${row.product_name || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Batch Number</span><span class="peq-v">${row.batch_number || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Primary State</span><span class="peq-v">${row.primary_state || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Queue Lane</span><span class="peq-v">${formatStatusBadge(laneInfo.text, laneInfo.type)}</span></div>
        <div class="peq-kv"><span class="peq-k">Priority Rank</span><span class="peq-v">${row.priority_rank_v4 ?? "-"}</span></div>
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Batch Quantity &amp; Storage</div>
        <div class="peq-kv"><span class="peq-k">Batch Size</span><span class="peq-v">${formatBatchSize(row)}</span></div>
        <div class="peq-kv"><span class="peq-k">Storage Qty</span><span class="peq-v">${formatStorageQty(row)}</span></div>
        <div class="peq-kv"><span class="peq-k">Candidate Supply Qty</span><span class="peq-v">${row.candidate_supply_base_qty ?? "-"}</span></div>
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Execution Gate Status</div>
        <div class="peq-kv"><span class="peq-k">PM Gate</span><span class="peq-v">${formatStatusBadge(isPmOk(row) ? "PM OK" : "PM Blocked", isPmOk(row) ? "ok" : "block")}</span></div>
        <div class="peq-kv"><span class="peq-k">PM Status</span><span class="peq-v">${row.pm_gate_status || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">RM Gate</span><span class="peq-v">${formatStatusBadge(rmD.text, rmTypeKey)}</span></div>
        <div class="peq-kv"><span class="peq-k">RM Status</span><span class="peq-v">${row.rm_gate_status_display || row.rm_gate_status || "-"}</span></div>
        ${fgBtl ? '<div class="peq-note">RM is not an active gate for FG_BULK / BOTTLED stages.</div>' : ""}
      </div>
      <div class="peq-card">
        <div class="peq-card-title">Priority Signals</div>
        <div class="peq-kv"><span class="peq-k">Time Sensitivity</span><span class="peq-v">${row.time_sensitivity_score ?? "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Supply Continuity</span><span class="peq-v">${row.supply_continuity_score ?? "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Top Region</span><span class="peq-v">${row.top_region || "-"}</span></div>
        <div class="peq-kv"><span class="peq-k">Top SKU</span><span class="peq-v">${row.top_sku_label || row.top_sku_id || "-"}</span></div>
      </div>
      <div class="peq-action-card ${action.cls}">
        <div class="peq-action-label">Recommended Action</div>
        ${action.text}
      </div>
    </div>`;
  console.log("[PEQ] renderDetailPanel: done");
}

function renderImpactTab(row) {
  const _content = document.getElementById("drawerContent");
  if (!_content || !row) return;
  const thStyle = `text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:11px;text-transform:uppercase;color:var(--muted,#6b7280);font-weight:600`;
  const tdL = `padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted,#6b7280)`;
  const tdR = `padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px;font-weight:500;text-align:right`;
  _content.innerHTML = `
    <div class="peq-card" style="margin-bottom:14px">
      <div class="peq-card-title">Batch Impact Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="${thStyle}">Metric</th>
            <th style="${thStyle};text-align:right">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="${tdL}">Risk Reduction Units</td><td style="${tdR}">${row.total_risk_reduction_units ?? "-"}</td></tr>
          <tr><td style="${tdL}">Top Impacted Region</td><td style="${tdR}">${row.top_region || "-"}</td></tr>
          <tr><td style="${tdL}">Top Impacted SKU</td><td style="${tdR}">${row.top_sku_label || row.top_sku_id || "-"}</td></tr>
          <tr><td style="${tdL}">Time Sensitivity Score</td><td style="${tdR}">${row.time_sensitivity_score ?? "-"}</td></tr>
          <tr><td style="${tdL}" style="border-bottom:none">Supply Continuity Score</td><td style="${tdR};border-bottom:none">${row.supply_continuity_score ?? "-"}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="peq-card-title" style="margin-bottom:8px">Risk Breakdown by Region &amp; SKU</div>
    <div id="whyRiskTable"><p style="color:var(--muted,#6b7280);font-size:13px">Loading risk breakdown…</p></div>`;
  loadWhyMatters(row);
}

async function loadWhyMatters(row) {
  const _target =
    document.getElementById("whyRiskTable") ||
    document.getElementById("drawerContent");
  try {
    const key = { column: "batch_number", value: row.batch_number };
    if (!key.value) {
      if (_target) _target.innerHTML = "<p>No batch identifier available.</p>";
      return;
    }
    const { data, error } = await supabase
      .from("v_batch_risk_reduction_current_month")
      .select(
        "sku_id, sku_label, region_code, risk_reduction_units, risk_reduction_base_qty",
      )
      .eq(key.column, key.value)
      .limit(100);
    if (error) throw error;
    if (!data || !data.length) {
      if (_target)
        _target.innerHTML =
          '<p style="color:var(--muted)">No risk-reduction info available for this batch.</p>';
      return;
    }
    const rows = data.map((d) => ({
      region: d.region_code || "-",
      sku: d.sku_label || d.sku_id || "-",
      units: Number(d.risk_reduction_units ?? 0),
    }));
    rows.sort((a, b) => b.units - a.units);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.innerHTML = `<thead><tr>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border)">Region</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border)">SKU</th>
      <th style="text-align:right;padding:6px 8px;border-bottom:2px solid var(--border)">Risk Reduction Units</th>
    </tr></thead>`;
    const tb = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td style="padding:6px 8px;border-bottom:1px solid var(--border)">${r.region}</td><td style="padding:6px 8px;border-bottom:1px solid var(--border)">${r.sku}</td><td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:right">${r.units}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    if (_target) {
      _target.innerHTML = "";
      _target.appendChild(table);
    }
  } catch (e) {
    console.error(e);
    if (_target)
      _target.innerHTML = `<p style="color:red">Error loading details: ${e.message || e}</p>`;
  }
}

function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("peqToastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `peq-toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  }, duration);
}

function copyReadyList() {
  const now = new Date();
  const dateStr = now
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
  const lines = [`*READY TO EXECUTE (AS ON ${dateStr})*`, ""];
  (LAST_PAGE_ROWS || []).forEach((r) => {
    const storage = formatStorageQty(r);
    lines.push(
      `${r.priority_rank_v4} ${r.product_name || r.product_id} - ${r.batch_number} - ${r.primary_state} - ${storage}`,
    );
  });
  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => {
      showToast("List copied to clipboard", "success");
    })
    .catch((err) => {
      console.error("Copy to clipboard failed:", err);
      showToast("Copy failed — check browser permissions", "error");
    });
}

function exportCsvForRows(rows, pageNumber) {
  if (!Array.isArray(rows)) rows = [];
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ts = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `production_execution_queue_${ym}_page${pageNumber}_${ts}.csv`;
  const headers = [
    "priority_rank_v4",
    "product_id",
    "product_name",
    "batch_number",
    "primary_state",
    "batch_size_declared",
    "batch_uom",
    "fg_bulk_on_hand_base_qty",
    "bottled_on_hand_units",
    "bottled_on_hand_base_qty",
    "candidate_supply_base_qty",
    "queue_lane",
    "pm_gate_status",
    "rm_gate_status",
    "rm_gate_status_display",
    "is_rm_ok_for_stage",
    "total_risk_reduction_units",
    "top_region",
    "top_sku_id",
    "top_sku_label",
    "time_sensitivity_score",
    "supply_continuity_score",
  ];
  const csv = [headers.join(",")];
  rows.forEach((r) => {
    const vals = headers.map((h) => {
      const v = r[h];
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      if (s.search(/[",\n]/) >= 0) return `"${s}"`;
      return s;
    });
    csv.push(vals.join(","));
  });
  const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("CSV exported", "info");
}

async function loadQueue() {
  setStatus("Loading snapshot...");
  try {
    // build month start as YYYY-MM-01 (avoid timezone issues)
    const now = new Date();
    const monthStart =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-01";

    const cols = [
      "month_start",
      "product_id",
      "product_name",
      "batch_size_declared",
      "batch_uom",
      "fg_bulk_on_hand_base_qty",
      "bottled_on_hand_units",
      "bottled_on_hand_base_qty",
      "batch_number",
      "primary_state",
      "pm_gate_status",
      "rm_gate_status",
      "rm_gate_status_display",
      "is_pm_ok",
      "is_pm_blocked",
      "is_rm_ok_for_stage",
      "candidate_supply_base_qty",
      "top_region",
      "top_sku_id",
      "top_sku_label",
      "total_risk_reduction_units",
      "stage_rank",
      "queue_lane",
      "priority_rank_v4",
      "time_sensitivity_score",
      "supply_continuity_score",
    ].join(",");

    const { data, error } = await supabase
      .from("priority_queue_snapshot_current_month")
      .select(cols)
      .eq("month_start", monthStart)
      .order("priority_rank_v4", { ascending: true })
      .limit(1000);

    if (error) {
      console.error(
        "Snapshot load error",
        error,
        error?.message || error?.details || "",
      );
      setStatus("Failed to load snapshot.", "error");
      return;
    }

    QUEUE = data || [];
    console.debug("PEQ rows loaded:", QUEUE.length, QUEUE.slice(0, 5));
    if (!QUEUE.length) {
      setStatus("Snapshot not yet generated. Click Refresh.");
      tableBody.innerHTML = "";
      LAST_REFRESH_TIME = new Date();
      updateFreshnessIndicator();
      renderLensPills();
      applyLensFilter();
      return;
    }

    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();
    renderLensPills();
    console.debug("DOM check", {
      tableWrap: !!tableWrap,
      tableBody: !!tableBody,
      statusArea: !!statusArea,
      paginationInfo: !!document.getElementById("paginationInfo"),
      pageSize: !!document.getElementById("pageSize"),
      prevPage: !!document.getElementById("prevPage"),
      nextPage: !!document.getElementById("nextPage"),
      exportCsv: !!document.getElementById("exportCsv"),
    });
    applyLensFilter();
    return;
  } catch (e) {
    console.error("Load snapshot failed", e);
    setStatus("Failed to load snapshot.", "error");
  }
}

/* ---------------- Boot ---------------- */
(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "/login.html");
    await loadPermissions(session.user.id);
    if (!PERM_CAN_VIEW) {
      // friendly access denied
      statusArea.innerHTML = "You do not have permission to view this module.";
      statusArea.style.display = "block";
      return;
    }
    // wire UI
    refreshBtn.addEventListener("click", refreshSnapshotAndReload);
    searchBox.addEventListener(
      "input",
      debounce(() => {
        CURRENT_PAGE = 1;
        applySearch();
      }, 200),
    );
    // show/hide clear button immediately when user types
    if (searchClear) {
      searchClear.style.display = searchBox.value ? "" : "none";
      searchBox.addEventListener("input", () => {
        try {
          searchClear.style.display = searchBox.value ? "" : "none";
        } catch {
          /* ignore */
        }
      });
      searchClear.addEventListener("click", () => {
        try {
          searchBox.value = "";
          searchClear.style.display = "none";
          CURRENT_PAGE = 1;
          applySearch();
          searchBox.focus();
        } catch (e) {
          console.warn("searchClear click failed", e);
        }
      });
    }
    drawerClose.addEventListener("click", closeDetails);
    drawerTabs.addEventListener("click", (ev) => {
      const t = ev.target.closest(".tab");
      if (t) setDrawerTab(t.dataset.tab);
    });
    // Pagination & export controls — registered once to avoid duplicate listeners on refresh
    const pageSizeEl = document.getElementById("pageSize");
    if (pageSizeEl) {
      try {
        pageSizeEl.value = String(PAGE_SIZE);
        pageSizeEl.addEventListener("change", () => {
          PAGE_SIZE = Number(pageSizeEl.value) || 25;
          CURRENT_PAGE = 1;
          applySearch();
        });
      } catch (e) {
        console.warn("pageSize element wiring failed", e);
      }
    }
    document.getElementById("prevPage").addEventListener("click", () => {
      if (CURRENT_PAGE > 1) {
        CURRENT_PAGE -= 1;
        applySearch();
      }
    });
    document.getElementById("nextPage").addEventListener("click", () => {
      CURRENT_PAGE += 1;
      applySearch();
    });
    document.getElementById("exportCsv").addEventListener("click", () => {
      exportCsvForRows(LAST_PAGE_ROWS, CURRENT_PAGE);
    });
    const _copyReadyBtn = document.getElementById("copyReadyBtn");
    if (_copyReadyBtn) {
      _copyReadyBtn.addEventListener("click", copyReadyList);
      _copyReadyBtn.style.display = CURRENT_LENS === "ready" ? "" : "none";
    }
    renderLensPills();
    // Home button
    const _homeBtn = document.getElementById("homeBtn");
    _homeBtn && _homeBtn.addEventListener("click", () => Platform.goHome());
    // Small-screen lens select: keep behavior consistent with pills
    if (lensSelect) {
      // sync initial value
      lensSelect.value = CURRENT_LENS;
      lensSelect.addEventListener("change", () => {
        const val = lensSelect.value;
        if (val) {
          CURRENT_LENS = val;
          renderLensPills();
          applyLensFilter();
        }
      });

      function syncLensSelectVisibility() {
        try {
          if (window.innerWidth <= 520) lensSelect.style.display = "block";
          else lensSelect.style.display = "none";
        } catch {
          /* ignore */
        }
      }
      syncLensSelectVisibility();
      window.addEventListener(
        "resize",
        debounce(() => {
          syncLensSelectVisibility();
        }, 120),
      );
    }
    // Freshness indicator — click to expand/collapse detail, matching stock-checker
    if (lastRefreshed) {
      const margin = 8;
      const MIN_WIDTH = 160;
      const PREFERRED_MIN = 180;
      const MAX_WIDTH = 420;
      function hideFreshnessDetail(detail) {
        try {
          if (!detail) return;
          detail.style.display = "none";
          detail.style.position = "";
          detail.style.left = "";
          detail.style.top = "";
          detail.style.width = "";
          detail.style.maxWidth = "";
          detail.style.boxSizing = "";
          detail.style.zIndex = "";
        } catch {
          void 0;
        }
      }
      function positionFreshnessDetail(detail) {
        try {
          if (!detail || !lastRefreshed) return;
          if (detail.parentElement !== document.body)
            document.body.appendChild(detail);
          detail.style.display = "block";
          detail.style.position = "absolute";
          detail.style.boxSizing = "border-box";
          detail.style.zIndex = 9999;
          const rect = lastRefreshed.getBoundingClientRect();
          const vw = Math.max(
            document.documentElement.clientWidth || 0,
            window.innerWidth || 0,
          );
          const scrollX = window.scrollX || window.pageXOffset || 0;
          const scrollY = window.scrollY || window.pageYOffset || 0;
          const availableRight = Math.max(0, vw - rect.right - margin);
          const availableLeft = Math.max(0, rect.left - margin);
          let side = "right";
          if (availableRight < PREFERRED_MIN && availableLeft >= PREFERRED_MIN)
            side = "left";
          else if (availableRight < MIN_WIDTH && availableLeft >= MIN_WIDTH)
            side = "left";
          else if (availableRight < MIN_WIDTH && availableLeft < MIN_WIDTH)
            side = availableLeft > availableRight ? "left" : "right";
          const avail = side === "right" ? availableRight : availableLeft;
          detail.style.width = "auto";
          const natural = Math.ceil(
            Math.max(
              detail.scrollWidth || 0,
              detail.getBoundingClientRect().width || 0,
            ),
          );
          const cap = Math.min(MAX_WIDTH, vw - margin * 2);
          let width;
          if (natural && natural <= cap && (!avail || natural <= avail)) {
            width = natural;
          } else {
            width = Math.min(
              cap,
              Math.max(PREFERRED_MIN, avail || PREFERRED_MIN),
            );
            if (avail && avail < PREFERRED_MIN)
              width = Math.max(MIN_WIDTH, avail);
            width = Math.min(width, cap);
          }
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
          detail.style.left = left + "px";
          detail.style.top = rect.bottom + scrollY + 6 + "px";
          detail.style.width = width + "px";
          detail.style.maxWidth = Math.min(MAX_WIDTH, vw - margin * 2) + "px";
        } catch {
          try {
            detail.style.position = "";
            detail.style.display = "block";
          } catch {
            void 0;
          }
        }
      }
      lastRefreshed.addEventListener("click", (ev) => {
        try {
          ev.preventDefault();
          const expanded = lastRefreshed.classList.toggle("sc-status-expanded");
          lastRefreshed.setAttribute("aria-expanded", String(expanded));
          const detail = document.getElementById("sc-status-detail");
          if (!detail) return;
          if (expanded) positionFreshnessDetail(detail);
          else hideFreshnessDetail(detail);
        } catch {
          void 0;
        }
      });
      lastRefreshed.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          lastRefreshed.click();
        }
      });
      document.addEventListener("click", (ev) => {
        try {
          if (!lastRefreshed) return;
          const detail = document.getElementById("sc-status-detail");
          if (lastRefreshed.contains(ev.target)) return;
          if (detail && detail.contains(ev.target)) return;
          if (lastRefreshed.classList.contains("sc-status-expanded")) {
            lastRefreshed.classList.remove("sc-status-expanded");
            lastRefreshed.setAttribute("aria-expanded", "false");
            if (detail) hideFreshnessDetail(detail);
          }
        } catch {
          void 0;
        }
      });
      const _reposFreshness = debounce(() => {
        try {
          const detail = document.getElementById("sc-status-detail");
          if (detail && lastRefreshed.classList.contains("sc-status-expanded"))
            positionFreshnessDetail(detail);
        } catch {
          void 0;
        }
      }, 120);
      window.addEventListener("resize", _reposFreshness);
      window.addEventListener("scroll", _reposFreshness, { passive: true });
    }
    setInterval(updateFreshnessIndicator, 60000);
    await loadQueue();
  } catch (e) {
    console.error(e);
    setStatus("Initialization error. See console.");
  }
})();

const _overlayEl = document.getElementById("detailsModal");
if (_overlayEl) {
  _overlayEl.addEventListener("click", (e) => {
    if (e.target === _overlayEl) closeDetails();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const _modal = document.getElementById("detailsModal");
    if (_modal && !_modal.classList.contains("hidden")) closeDetails();
  }
});

function debounce(fn, wait) {
  let t = null;
  return function (...a) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, a), wait);
  };
}

export {
  loadQueue,
  applyLensFilter,
  renderSummaryStrip,
  renderTable,
  openDetails,
  loadWhyMatters,
};
