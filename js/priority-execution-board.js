/* priority-execution-board.js */
import { supabase } from "../public/shared/js/supabaseClient.js";

const MODULE_ID = "priority-execution-board";
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
let CURRENT_LENS = "manufacture_now";
let SELECTED_ROW = null;

const LENSES = [
  { id: "manufacture_now", label: "Manufacture Now" },
  { id: "fast_conversion", label: "Fast Conversion" },
  { id: "unblock_pm", label: "Unblock PM" },
  { id: "unblock_rm", label: "Unblock RM" },
  { id: "all", label: "All Candidates" },
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

function isReadyForManufacture(r) {
  if (!r) return false;

  const pmStatus = String(r.pm_gate_status || "").toUpperCase();
  const rmStatus = String(r.rm_gate_status || "").toUpperCase();

  const pmOk = r.is_pm_ok === true || pmStatus === "PM_OK";
  const rmOk = r.is_rm_ok_for_stage === true || rmStatus === "RM_OK";

  if (pmOk && rmOk) return true;

  // legacy flags
  if (r.is_ready === true || r.ready === true) return true;

  return false;
}

function applyLensFilter() {
  if (!Array.isArray(QUEUE)) QUEUE = [];
  let rows = [...QUEUE];
  switch (CURRENT_LENS) {
    case "manufacture_now":
      rows = rows.filter((r) => isReadyForManufacture(r));
      break;
    case "fast_conversion":
      rows = rows.filter((r) => {
        const s = (r.primary_state || "").toUpperCase();
        return s === "FG_BULK" || s === "BOTTLED";
      });
      break;
    case "unblock_pm":
      rows = rows.filter(
        (r) => (r.pm_gate_status || "").toUpperCase() === "PM_BLOCKED",
      );
      break;
    case "unblock_rm":
      rows = rows.filter((r) => {
        const rs = (r.rm_gate_status || "").toUpperCase();
        return rs === "RM_BLOCKED" || r.is_rm_ok_for_stage === false;
      });
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
  applySearch();
  renderSummaryStrip();
}

function applySearch() {
  const q = (searchBox.value || "").trim().toLowerCase();
  let filtered = VIEW;
  if (q) {
    filtered = VIEW.filter((r) => {
      const hay = [
        r.batch_number,
        r.product_id != null ? String(r.product_id) : null,
        r.top_sku_id != null ? String(r.top_sku_id) : null,
        r.primary_state,
        r.pm_gate_status,
        r.rm_gate_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  renderTable(filtered);
}

function renderSummaryStrip() {
  const total = QUEUE.length || 0;
  const lane1 = QUEUE.filter(isReadyForManufacture).length;
  const pmBlocked = QUEUE.filter(
    (r) =>
      r.is_pm_blocked === true ||
      (r.pm_gate_status || "").toUpperCase() === "PM_BLOCKED",
  ).length;
  const rmBlocked = QUEUE.filter(
    (r) =>
      r.is_rm_ok_for_stage === false ||
      (r.rm_gate_status || "").toUpperCase() === "RM_BLOCKED",
  ).length;
  const fgBulk = QUEUE.filter(
    (r) => (r.primary_state || "").toUpperCase() === "FG_BULK",
  ).length;
  const bottled = QUEUE.filter(
    (r) => (r.primary_state || "").toUpperCase() === "BOTTLED",
  ).length;
  kpiStrip.innerHTML = "";
  const items = [
    ["Total", total],
    ["Lane 1 ready", lane1],
    ["PM blocked", pmBlocked],
    ["RM blocked", rmBlocked],
    ["FG_BULK", fgBulk],
    ["BOTTLED", bottled],
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
    // leave `lastRefreshed` unchanged
    return;
  }
  clearStatus();
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.tabIndex = 0;
    tr.addEventListener("click", () => openDetails(r));
    const rank = document.createElement("td");
    rank.textContent = r.priority_rank_v4 ?? "";
    const batch = document.createElement("td");
    batch.textContent = r.batch_number || "-";
    const prod = document.createElement("td");
    // product name not available on this view; show product_id or top_sku_id
    prod.textContent =
      r.product_id != null
        ? String(r.product_id)
        : r.top_sku_id != null
          ? String(r.top_sku_id)
          : "-";
    const state = document.createElement("td");
    state.textContent = r.primary_state || "-";
    const pm = document.createElement("td");
    pm.textContent =
      r.pm_gate_status ||
      (r.is_pm_blocked ? "PM_BLOCKED" : r.is_pm_ok ? "PM_OK" : "-");
    const rm = document.createElement("td");
    rm.textContent =
      r.rm_gate_status || (r.is_rm_ok_for_stage === false ? "RM_BLOCKED" : "-");
    const planned = document.createElement("td");
    planned.textContent = r.month_start || "-";
    tr.appendChild(rank);
    tr.appendChild(batch);
    tr.appendChild(prod);
    tr.appendChild(state);
    tr.appendChild(pm);
    tr.appendChild(rm);
    tr.appendChild(planned);
    tableBody.appendChild(tr);
  });
  rowCount.textContent = `Rows: ${rows.length}`;
}

function openDetails(row) {
  SELECTED_ROW = row;
  drawerTitle.textContent = `${row.batch_number || "Batch"} — ${row.product_id || ""}`;
  // show drawer
  detailsDrawer.classList.remove("hidden");
  if (window.matchMedia && window.matchMedia("(max-width:800px)").matches) {
    detailsDrawer.classList.add("open");
  }
  detailsDrawer.setAttribute("aria-hidden", "false");
  // default tab
  setDrawerTab("why");
}

function closeDetails() {
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
  if (id === "why") {
    loadWhyMatters(SELECTED_ROW);
  } else if (id === "pm") {
    drawerContent.innerHTML = `<div><strong>PM blockers</strong><div>TODO: integrate PM detail view here.</div></div>`;
  } else if (id === "rm") {
    drawerContent.innerHTML = `<div><strong>RM blockers</strong><div>TODO: integrate RM detail view here.</div></div>`;
  }
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
      .select("*")
      .eq(key.column, key.value)
      .limit(100);
    if (error) throw error;
    if (!data || !data.length) {
      drawerContent.innerHTML =
        "No risk-reduction info available for this batch.";
      return;
    }
    // Simple rendering
    const out = document.createElement("div");
    data.forEach((d) => {
      const block = document.createElement("div");
      block.style.borderBottom = "1px solid var(--border)";
      block.style.padding = "8px 0";
      block.innerHTML = `<div style="font-weight:600">${d.batch_number || (d.sku_id ? `SKU ${d.sku_id}` : "Batch")}</div><div style="color:var(--muted)">State: ${d.primary_state || "-"} — Risk units: ${d.risk_reduction_units ?? d.risk_reduction_base_qty ?? "-"}</div>`;
      out.appendChild(block);
    });
    drawerContent.innerHTML = "";
    drawerContent.appendChild(out);
  } catch (e) {
    console.error(e);
    drawerContent.innerHTML = `Error loading details: ${e.message || e}`;
  }
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
      "batch_number",
      "primary_state",
      "pm_gate_status",
      "rm_gate_status",
      "is_pm_ok",
      "is_pm_blocked",
      "is_rm_ok_for_stage",
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
      console.error("Snapshot load error", error);
      setStatus("Failed to load snapshot.", "error");
      return;
    }

    QUEUE = data || [];
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
      debounce(() => applySearch(), 200),
    );
    drawerClose.addEventListener("click", closeDetails);
    drawerTabs.addEventListener("click", (ev) => {
      const t = ev.target.closest(".tab");
      if (t) setDrawerTab(t.dataset.tab);
    });
    renderLensPills();
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
