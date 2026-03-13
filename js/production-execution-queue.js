/* production-execution-queue.js */
import { supabase } from "../public/shared/js/supabaseClient.js";

const MODULE_ID = "production-execution-queue";
let PERM_CAN_VIEW = true;

// Elements
const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableBody = $("tableBody");
const refreshBtn = $("refreshBtn");
const searchBox = $("searchBox");
const rowCount = $("rowCount");
const lastRefreshed = $("lastRefreshed");
const kpiStrip = $("kpiStrip");
const lensPills = $("lensPills");
const detailsDrawer = $("detailsDrawer");
const drawerClose = $("drawerClose");
const drawerContent = $("drawerContent");
const drawerTabs = $("drawerTabs");
const drawerTitle = $("drawerTitle");

// Data
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

function setStatus(msg, type = "normal") {
  statusArea.textContent = msg;
  statusArea.style.display = "block";
  tableWrap.style.display = "none";

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
    setStatus("Refreshing snapshot...");
    const { error } = await supabase.rpc("refresh_priority_queue_snapshot");
    if (error) throw error;
    setStatus("Snapshot refreshed successfully.");
    await loadQueue();
  } catch (e) {
    console.error("Snapshot refresh failed", e);
    const msg = (e && (e.message || e.error || e.code || "")).toString();
    if (/permission|privileg|42501/i.test(msg)) {
      setStatus("You do not have permission to refresh snapshot.", "error");
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
  });
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

function applyLensFilter() {
  if (!Array.isArray(QUEUE)) QUEUE = [];
  let rows = [...QUEUE];
  switch (CURRENT_LENS) {
    case "ready":
      rows = rows.filter((r) => isPmOk(r) && isRmClearForExecution(r));
      break;
    case "fast_conversion":
      rows = rows.filter((r) => isFastConversion(r));
      break;
    case "pm_blocked":
      rows = rows.filter((r) => !isPmOk(r));
      break;
    case "rm_blocked":
      rows = rows.filter((r) => !isRmClearForExecution(r));
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
  const readyCount = QUEUE.filter(
    (r) => isPmOk(r) && isRmClearForExecution(r),
  ).length;
  const pmBlocked = QUEUE.filter((r) => !isPmOk(r)).length;
  const rmBlocked = QUEUE.filter((r) => !isRmClearForExecution(r)).length;
  const fastConv = QUEUE.filter((r) => isFastConversion(r)).length;

  const visibleRows = Array.isArray(rowsDisplayed) ? rowsDisplayed : VIEW;
  const visibleRisk = (visibleRows || []).reduce(
    (s, r) => s + Number(r.total_risk_reduction_units || 0),
    0,
  );

  kpiStrip.innerHTML = "";
  const items = [
    ["Total Batches", total],
    ["Ready to Execute", readyCount],
    ["PM Blocked", pmBlocked],
    ["RM Blocked", rmBlocked],
    ["Fast Conversion", fastConv],
    ["Visible Risk Reduction", visibleRisk],
  ];
  items.forEach(([label, value]) => {
    const el = document.createElement("div");
    el.className = "kpi";
    el.innerHTML = `<div style="font-weight:600">${label}</div><div style="font-size:0.95rem;color:var(--muted)">${value}</div>`;
    kpiStrip.appendChild(el);
  });
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  if (!rows || rows.length === 0) {
    setStatus("No rows match the current filter.");
    rowCount.textContent = `Rows: 0`;
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

  pageRows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.tabIndex = 0;
    tr.addEventListener("click", () => openDetails(r));

    const make = (txt, cls) => {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = txt;
      return td;
    };

    const rank = make(r.priority_rank_v4 ?? "", "c-center");
    const batch = make(r.batch_number || "-", "c-center");
    const prod = make(
      r.product_id != null
        ? String(r.product_id)
        : r.top_sku_id != null
          ? String(r.top_sku_id)
          : "-",
      "c-left",
    );
    // New Item column (product_name) — show snapshot-provided name
    const item = make(r.product_name || "-", "c-left");
    const state = make(r.primary_state || "-", "c-center");

    // Lane: show queue_lane and a status chip
    const laneTd = document.createElement("td");
    laneTd.className = "c-center";
    const chip = document.createElement("span");
    chip.className = "chip gray";
    if (!isRmClearForExecution(r)) {
      chip.className = "chip red";
      chip.textContent = "RM Blocked";
    } else if (!isPmOk(r)) {
      chip.className = "chip amber";
      chip.textContent = "PM Blocked";
    } else if (isFastConversion(r)) {
      chip.className = "chip blue";
      chip.textContent = "Fast Conv";
    } else if (isPmOk(r) && isRmClearForExecution(r)) {
      chip.className = "chip green";
      chip.textContent = "Ready";
    } else {
      chip.className = "chip gray";
      chip.textContent = "Unknown";
    }
    // keep numeric queue_lane available in data model; do not display it here
    laneTd.appendChild(chip);

    const pmTd = make(
      r.pm_gate_status ||
        (r.is_pm_blocked ? "PM_BLOCKED" : r.is_pm_ok ? "PM_OK" : "-"),
      "c-center",
    );
    const rmTd = make(
      r.rm_gate_status_display ||
        r.rm_gate_status ||
        (r.is_rm_ok_for_stage === false ? "RM_BLOCKED" : "-"),
      "c-center",
    );
    const riskTd = make(
      r.total_risk_reduction_units != null
        ? String(r.total_risk_reduction_units)
        : "-",
      "c-right",
    );
    const regionTd = make(r.top_region || "-", "c-center");

    tr.appendChild(rank);
    tr.appendChild(batch);
    tr.appendChild(prod);
    tr.appendChild(item);
    tr.appendChild(state);
    tr.appendChild(laneTd);
    tr.appendChild(pmTd);
    tr.appendChild(rmTd);
    tr.appendChild(riskTd);
    tr.appendChild(regionTd);

    tableBody.appendChild(tr);
  });

  rowCount.textContent = `Rows: ${rows.length}`;
  document.getElementById("paginationInfo").textContent =
    `Page ${CURRENT_PAGE} / ${totalPages}`;
  // remember for export
  LAST_PAGE_ROWS = pageRows;
  renderSummaryStrip(pageRows);
}

function openDetails(row) {
  SELECTED_ROW = row;
  drawerTitle.textContent = `${row.batch_number || "Batch"} — ${row.product_id || ""}`;
  // show drawer (mobile: open class will display below table)
  detailsDrawer.classList.remove("hidden");
  detailsDrawer.classList.add("open");
  detailsDrawer.setAttribute("aria-hidden", "false");
  // render structured Batch Detail Panel
  renderDetailPanel(row);
}

function closeDetails() {
  // If focus is inside the drawer, move it to a sensible element
  // before hiding the drawer to avoid blocking assistive tech.
  try {
    const active = document.activeElement;
    if (detailsDrawer.contains(active)) {
      if (searchBox && typeof searchBox.focus === "function") {
        searchBox.focus();
      } else if (refreshBtn && typeof refreshBtn.focus === "function") {
        refreshBtn.focus();
      } else if (active && typeof active.blur === "function") {
        active.blur();
      }
    }
  } catch {
    // ignore focus management errors
  }

  detailsDrawer.classList.add("hidden");
  detailsDrawer.classList.remove("open");
  detailsDrawer.setAttribute("aria-hidden", "true");
  SELECTED_ROW = null;
}

function setDrawerTab(id) {
  const tabs = Array.from(drawerTabs.querySelectorAll(".tab"));
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === id));
  if (!SELECTED_ROW) {
    drawerContent.innerHTML = "Select a row to view details.";
    return;
  }
  if (id === "details") {
    renderDetailPanel(SELECTED_ROW);
  } else if (id === "why") {
    loadWhyMatters(SELECTED_ROW);
  } else if (id === "pm") {
    drawerContent.innerHTML = `<div><strong>PM Gate Status</strong><div style="margin-top:8px">${SELECTED_ROW.pm_gate_status || "-"}</div></div>`;
  } else if (id === "rm") {
    drawerContent.innerHTML = `<div><strong>RM Gate Status</strong><div style="margin-top:8px">${SELECTED_ROW.rm_gate_status_display || SELECTED_ROW.rm_gate_status || "-"}</div></div>`;
  }
}

function renderDetailPanel(row) {
  const out = document.createElement("div");
  out.style.display = "grid";
  out.style.gap = "12px";

  // Section 1 - Batch summary
  const s1 = document.createElement("div");
  s1.innerHTML = `<h3 style="margin:0 0 6px 0">Batch summary</h3>`;
  const list1 = document.createElement("div");
  list1.innerHTML = `<div><strong>Batch Number:</strong> ${row.batch_number || "-"}</div><div><strong>Product ID:</strong> ${row.product_id || row.top_sku_id || "-"}</div><div><strong>Item:</strong> ${row.product_name || "-"}</div><div><strong>Primary State:</strong> ${row.primary_state || "-"}</div><div><strong>Queue Lane:</strong> ${row.queue_lane || "-"}</div>`;
  s1.appendChild(list1);

  // Section 2 - Execution status
  const s2 = document.createElement("div");
  s2.innerHTML = `<h3 style="margin:0 0 6px 0">Execution status</h3>`;
  const list2 = document.createElement("div");
  list2.innerHTML = `<div><strong>PM Gate Status:</strong> ${row.pm_gate_status || "-"}</div><div><strong>RM Gate Status:</strong> ${row.rm_gate_status_display || row.rm_gate_status || "-"}</div>`;
  s2.appendChild(list2);

  // Section 3 - Impact
  const s3 = document.createElement("div");
  s3.innerHTML = `<h3 style="margin:0 0 6px 0">Impact</h3>`;
  const list3 = document.createElement("div");
  list3.innerHTML = `<div><strong>Candidate Supply Quantity:</strong> ${row.candidate_supply_base_qty ?? "-"}</div><div><strong>Total Risk Reduction Units:</strong> ${row.total_risk_reduction_units ?? "-"}</div><div><strong>Top Impacted Region:</strong> ${row.top_region || "-"}</div><div><strong>Top Impacted SKU:</strong> ${row.top_sku_label || row.top_sku_id || "-"}</div>`;
  s3.appendChild(list3);

  // Section 4 - Priority reasoning
  const s4 = document.createElement("div");
  s4.innerHTML = `<h3 style="margin:0 0 6px 0">Priority reasoning</h3>`;
  const list4 = document.createElement("div");
  list4.innerHTML = `<div><strong>Time Sensitivity Score:</strong> ${row.time_sensitivity_score ?? "-"}</div><div><strong>Supply Continuity Score:</strong> ${row.supply_continuity_score ?? "-"}</div>`;
  s4.appendChild(list4);

  // Section 5 - Recommended action
  const s5 = document.createElement("div");
  s5.innerHTML = `<h3 style="margin:0 0 6px 0">Recommended action</h3>`;
  const action = document.createElement("div");
  if (!isRmClearForExecution(row)) {
    action.textContent =
      "Resolve raw material blocker first. Refer to Execution Gate → RM tab.";
  } else if (!isPmOk(row)) {
    action.textContent =
      "Resolve packing material blocker first. Refer to Execution Gate → PM tab.";
  } else if (isFastConversion(row)) {
    action.textContent =
      "Prioritize this batch for quick conversion into finished supply.";
  } else if (isPmOk(row) && isRmClearForExecution(row)) {
    action.textContent = "Proceed with production execution for this batch.";
  } else {
    action.textContent = "Review batch details and decide next steps.";
  }
  s5.appendChild(action);

  out.appendChild(s1);
  out.appendChild(s2);
  out.appendChild(s3);
  out.appendChild(s4);
  out.appendChild(s5);

  drawerContent.innerHTML = "";
  drawerContent.appendChild(out);
}

async function loadWhyMatters(row) {
  drawerContent.innerHTML = "Loading...";
  try {
    const key = { column: "batch_number", value: row.batch_number };
    if (!key.value) {
      drawerContent.innerHTML = "No batch identifier available.";
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
      drawerContent.innerHTML =
        "No risk-reduction info available for this batch.";
      return;
    }
    // Render small table: Region | SKU | Risk Reduction Units (desc)
    const rows = data.map((d) => ({
      region: d.region_code || "-",
      sku: d.sku_label || d.sku_id || "-",
      units: Number(d.risk_reduction_units ?? 0),
    }));
    rows.sort((a, b) => b.units - a.units);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.innerHTML = `<thead><tr><th>Region</th><th>SKU</th><th style="text-align:right">Risk Reduction Units</th></tr></thead>`;
    const tb = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td style="padding:6px;border-bottom:1px solid var(--border)">${r.region}</td><td style="padding:6px;border-bottom:1px solid var(--border)">${r.sku}</td><td style="padding:6px;border-bottom:1px solid var(--border);text-align:right">${r.units}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    drawerContent.innerHTML = "";
    drawerContent.appendChild(table);
  } catch (e) {
    console.error(e);
    drawerContent.innerHTML = `Error loading details: ${e.message || e}`;
  }
}

function exportCsvForRows(rows, pageNumber) {
  if (!Array.isArray(rows)) rows = [];
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ts = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `production_execution_queue_${ym}_page${pageNumber}_${ts}.csv`;
  const headers = [
    "priority_rank_v4",
    "batch_number",
    "product_id",
    "primary_state",
    "queue_lane",
    "pm_gate_status",
    "rm_gate_status",
    "rm_gate_status_display",
    "total_risk_reduction_units",
    "top_region",
    "top_sku_id",
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
      rowCount.textContent = "Rows: 0";
      lastRefreshed.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
      renderLensPills();
      applyLensFilter();
      return;
    }

    lastRefreshed.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
    renderLensPills();
    // Pagination & export controls
    const pageSizeEl = document.getElementById("pageSize");
    pageSizeEl.value = String(PAGE_SIZE);
    pageSizeEl.addEventListener("change", () => {
      PAGE_SIZE = Number(pageSizeEl.value) || 25;
      CURRENT_PAGE = 1;
      applySearch();
    });
    document.getElementById("prevPage").addEventListener("click", () => {
      if (CURRENT_PAGE > 1) {
        CURRENT_PAGE -= 1;
        applySearch();
      }
    });
    document.getElementById("nextPage").addEventListener("click", () => {
      // next page: applySearch will clamp page
      CURRENT_PAGE += 1;
      applySearch();
    });
    document.getElementById("exportCsv").addEventListener("click", () => {
      exportCsvForRows(LAST_PAGE_ROWS, CURRENT_PAGE);
    });
    applyLensFilter();
    clearStatus();
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
    if (!session) return (window.location.href = "login.html");
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
    drawerClose.addEventListener("click", closeDetails);
    drawerTabs.addEventListener("click", (ev) => {
      const t = ev.target.closest(".tab");
      if (t) setDrawerTab(t.dataset.tab);
    });
    renderLensPills();
    // Home button: platform-aware navigation (mirror other modules)
    const _homeBtn = document.getElementById("homeBtn");
    if (_homeBtn) {
      _homeBtn.addEventListener("click", () => {
        if (window.Platform && typeof window.Platform.goHome === "function") {
          try {
            window.Platform.goHome();
          } catch (err) {
            console.warn(err);
            window.location.href = "index.html";
          }
        } else {
          window.location.href = "index.html";
        }
      });
    }
    await loadQueue();
  } catch (e) {
    console.error(e);
    setStatus("Initialization error. See console.");
  }
})();

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
