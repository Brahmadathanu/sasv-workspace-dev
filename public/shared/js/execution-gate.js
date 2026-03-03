/* execution-gate.js */
import { supabase } from "./supabaseClient.js";

// Views (no new DB objects)
const VIEW_PM = "v_pm_issue_priority_current_month";
const VIEW_RM = "v_rm_issue_priority_current_month";
const VIEW_UNASS = "v_rm_unassigned_issues_current_month";

// Elements
const $ = (id) => document.getElementById(id);
const monthSelect = $("monthSelect");
const searchBox = $("searchBox");
const sortSelect = $("sortSelect");
const refreshBtn = $("refreshBtn");
const exportBtn = $("exportBtn");
const showCount = $("showCount");
const pageSizeSelect = $("pageSizeSelect");
const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");
const pageInfo = $("pageInfo");
const rowCount = $("rowCount");
const lastRefreshed = $("lastRefreshed");
const kpiStrip = $("kpiStrip");
const tableHead = $("tableHead");
const tableBody = $("tableBody");
const statusArea = $("statusArea");
const detailsDrawer = $("detailsDrawer");
const drawerClose = $("drawerClose");
const drawerContent = $("drawerContent");
const drawerTitle = $("drawerTitle");

// State
let ACTIVE_TAB = "pm"; // pm | rm | unassigned
let PAGE = 1;
let PAGE_SIZE = Number(pageSizeSelect?.value || 50);
let SORT_FIELD = null;
let SORT_ASC = false;
let TOTAL_COUNT = null;
let CURRENT_ROWS = [];
let PERM_CAN_VIEW = true;

const TAB_CONFIG = {
  pm: {
    view: VIEW_PM,
    cols: [
      "pm_stock_item_id",
      "pm_name",
      "pm_uom",
      "blocked_batch_count",
      "total_remaining_pm_qty",
      "total_risk_unlocked_units",
      "risk_per_pm_qty",
    ],
    defaultSort: { field: "total_risk_unlocked_units", asc: false },
    sortOptions: [
      ["total_risk_unlocked_units", "Total risk unlocked (desc)"],
      ["risk_per_pm_qty", "Risk per PM qty (desc)"],
      ["blocked_batch_count", "Blocked batch count (desc)"],
      ["total_remaining_pm_qty", "Total remaining PM qty (desc)"],
      ["pm_name", "PM name (asc)"],
    ],
  },
  rm: {
    view: VIEW_RM,
    cols: [
      "rm_stock_item_id",
      "rm_name",
      "rm_uom",
      "blocked_batch_count",
      "total_remaining_rm_qty",
      "total_risk_share_units",
      "risk_share_per_rm_qty",
    ],
    defaultSort: { field: "total_risk_share_units", asc: false },
    sortOptions: [
      ["total_risk_share_units", "Total risk share (desc)"],
      ["risk_share_per_rm_qty", "Risk share per RM qty (desc)"],
      ["blocked_batch_count", "Blocked batch count (desc)"],
      ["total_remaining_rm_qty", "Total remaining RM qty (desc)"],
      ["rm_name", "RM name (asc)"],
    ],
  },
  unassigned: {
    view: VIEW_UNASS,
    cols: [
      "rm_stock_item_id",
      "rm_name",
      "rm_uom",
      "affected_batches",
      "total_risk_locked_units",
      "last_issue_voucher_date",
    ],
    defaultSort: { field: "total_risk_locked_units", asc: false },
    sortOptions: [
      ["total_risk_locked_units", "Total risk locked (desc)"],
      ["affected_batches", "Affected batches (desc)"],
      ["last_issue_voucher_date", "Last issue date (desc)"],
      ["rm_name", "RM name (asc)"],
    ],
  },
};

function setStatus(msg, type = "normal") {
  statusArea.textContent = msg;
  statusArea.style.display = "block";
  statusArea.dataset.type = type;
}
function clearStatus() {
  statusArea.style.display = "none";
}

async function loadPermissions(sessionUserId) {
  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: sessionUserId,
    });
    if (!error && Array.isArray(perms)) {
      const p = perms.find((r) => r && r.target === "module:execution-gate");
      if (p) PERM_CAN_VIEW = !!p.can_view;
    }
  } catch (e) {
    console.warn("Permission RPC failed", e);
  }
}

function monthToStart(inputVal) {
  if (!inputVal) return null;
  const [y, m] = inputVal.split("-");
  return `${y}-${m}-01`;
}

function buildSortOptions() {
  sortSelect.innerHTML = "";
  const cfg = TAB_CONFIG[ACTIVE_TAB];
  cfg.sortOptions.forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    sortSelect.appendChild(opt);
  });
  const ds = cfg.defaultSort;
  SORT_FIELD = ds.field;
  SORT_ASC = ds.asc;
}

function renderTableHeader() {
  const cfg = TAB_CONFIG[ACTIVE_TAB];
  tableHead.innerHTML = "";
  const tr = document.createElement("tr");
  cfg.cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c.replace(/_/g, " ");
    th.style.whiteSpace = "nowrap";
    tr.appendChild(th);
  });
  tableHead.appendChild(tr);
}

async function loadPage() {
  try {
    setStatus("Loading...");
    PAGE_SIZE = Number(pageSizeSelect.value || 50);
    const cfg = TAB_CONFIG[ACTIVE_TAB];
    const monthStart =
      monthToStart(monthSelect.value) ||
      new Date().toISOString().slice(0, 7) + "-01";
    let qb = supabase
      .from(cfg.view)
      .select(cfg.cols.join(","), {
        count: showCount.checked || PAGE === 1 ? "exact" : undefined,
      })
      .eq("month_start", monthStart);

    const q = (searchBox.value || "").trim();
    if (q) {
      if (/^[0-9]+$/.test(q)) {
        const idCols = cfg.cols.filter((c) => /id$/i.test(c));
        if (idCols.length)
          qb = qb.or(idCols.map((c) => `${c}.eq.${q}`).join(","));
      } else {
        const nameCols = cfg.cols.filter((c) => /name$/i.test(c));
        if (nameCols.length)
          qb = qb.or(
            nameCols
              .map((c) => `${c}.ilike.%25${encodeURIComponent(q)}%25`)
              .join(","),
          );
      }
    }

    if (SORT_FIELD) qb = qb.order(SORT_FIELD, { ascending: SORT_ASC });

    const offset = (PAGE - 1) * PAGE_SIZE;
    qb = qb.range(offset, offset + PAGE_SIZE - 1);

    const { data, error, count } = await qb;
    if (error) {
      console.error({
        view: cfg.view,
        filterMonth: monthStart,
        sort: SORT_FIELD,
        page: PAGE,
        pageSize: PAGE_SIZE,
        error,
      });
      setStatus("Failed to load. See console.", "error");
      return;
    }
    CURRENT_ROWS = data || [];
    if (typeof count === "number") TOTAL_COUNT = count;
    renderTable(CURRENT_ROWS);
    renderKPIs(CURRENT_ROWS);
    rowCount.textContent = `Rows: ${TOTAL_COUNT ?? CURRENT_ROWS.length}`;
    lastRefreshed.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
    renderPagination();
    clearStatus();
  } catch (e) {
    console.error(e);
    setStatus("Failed to load. See console.", "error");
  }
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  if (!rows || rows.length === 0) {
    setStatus("No rows match current filters.");
    return;
  }
  clearStatus();
  const cfg = TAB_CONFIG[ACTIVE_TAB];
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.className = "clickable";
    tr.addEventListener("click", () => openDetails(r));
    cfg.cols.forEach((c) => {
      const td = document.createElement("td");
      const v = r[c];
      if (/id$|count$|qty$|units$|batches$/.test(c))
        td.style.textAlign = "center";
      if (/name$/i.test(c)) td.style.whiteSpace = "normal";
      if (/date$/i.test(c)) td.style.textAlign = "center";
      td.textContent = v == null ? "-" : String(v);
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function renderKPIs(rows) {
  kpiStrip.innerHTML = "";
  if (!rows) return;
  const totalRows = TOTAL_COUNT ?? rows.length;
  const topMetric = (() => {
    const cfg = TAB_CONFIG[ACTIVE_TAB];
    const metric = cfg.defaultSort.field;
    const sorted = [...rows].sort(
      (a, b) => Number(b[metric] || 0) - Number(a[metric] || 0),
    );
    return sorted.length ? (sorted[0][metric] ?? "-") : "-";
  })();
  const blockedSum = rows.reduce(
    (s, r) => s + Number(r.blocked_batch_count || r.affected_batches || 0),
    0,
  );
  const leverage = rows.filter((r) => {
    const cfg = TAB_CONFIG[ACTIVE_TAB];
    const perField = cfg.cols.find((c) => /per_/.test(c));
    return perField ? Number(r[perField] || 0) > 1 : false;
  }).length;

  const items = [
    ["Page rows", rows.length],
    ["Top metric", topMetric],
    ["Blocked batches (page)", blockedSum],
    ["High leverage (page)", leverage],
  ];
  items.forEach(([label, value]) => {
    const el = document.createElement("div");
    el.className = "kpi";
    el.innerHTML = `<div style="font-weight:600">${label}</div><div style="font-size:0.95rem;color:var(--muted)">${value}</div>`;
    kpiStrip.appendChild(el);
  });
}

function renderPagination() {
  const maxPage =
    PAGE_SIZE > 0 && TOTAL_COUNT
      ? Math.ceil(TOTAL_COUNT / PAGE_SIZE)
      : PAGE + 1;
  prevBtn.disabled = PAGE <= 1;
  nextBtn.disabled = TOTAL_COUNT ? PAGE >= maxPage : false;
  pageInfo.textContent = `Page ${PAGE}${TOTAL_COUNT ? ` of ${maxPage}` : ""}`;
}

function openDetails(row) {
  drawerTitle.textContent =
    (row.pm_name || row.rm_name || "Item") +
    (row.pm_stock_item_id || row.rm_stock_item_id
      ? ` — ${row.pm_stock_item_id || row.rm_stock_item_id}`
      : "");
  drawerContent.innerHTML = "";
  const wrap = document.createElement("div");
  Object.keys(row).forEach((k) => {
    const d = document.createElement("div");
    d.innerHTML = `<strong>${k}:</strong> ${row[k] ?? "-"}`;
    wrap.appendChild(d);
  });
  const copyName = document.createElement("button");
  copyName.textContent = "Copy item name";
  copyName.addEventListener("click", () =>
    navigator.clipboard.writeText(row.pm_name || row.rm_name || ""),
  );
  const copyId = document.createElement("button");
  copyId.textContent = "Copy item id";
  copyId.addEventListener("click", () =>
    navigator.clipboard.writeText(
      row.pm_stock_item_id || row.rm_stock_item_id || "",
    ),
  );
  drawerContent.appendChild(wrap);
  drawerContent.appendChild(copyName);
  drawerContent.appendChild(copyId);
  detailsDrawer.classList.add("open");
  detailsDrawer.setAttribute("aria-hidden", "false");
}

function closeDetails() {
  detailsDrawer.classList.remove("open");
  detailsDrawer.setAttribute("aria-hidden", "true");
}

async function exportCsvPage() {
  exportBtn.disabled = true;
  try {
    const cfg = TAB_CONFIG[ACTIVE_TAB];
    const hdr = cfg.cols;
    const lines = [hdr.join(",")];
    CURRENT_ROWS.forEach((r) => {
      const vals = hdr.map((c) => {
        const v = r[c];
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      });
      lines.push(vals.join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution_gate_page_${ACTIVE_TAB}_${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    setStatus("Export failed", "error");
  } finally {
    exportBtn.disabled = false;
  }
}

function debounce(fn, wait = 200) {
  let t = null;
  return function (...a) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, a), wait);
  };
}

/* ---------------- Init ---------------- */
(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "login.html");
    await loadPermissions(session.user.id);
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.");
      return;
    }

    // defaults
    const now = new Date();
    monthSelect.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // wire tabs
    document.querySelectorAll(".tabbtn").forEach((b) =>
      b.addEventListener("click", async (ev) => {
        document
          .querySelectorAll(".tabbtn")
          .forEach((x) => x.classList.remove("active"));
        ev.target.classList.add("active");
        ACTIVE_TAB = ev.target.dataset.tab;
        PAGE = 1;
        buildSortOptions();
        renderTableHeader();
        await loadPage();
      }),
    );

    buildSortOptions();
    renderTableHeader();

    // events
    refreshBtn.addEventListener("click", async () => {
      PAGE = 1;
      await loadPage();
    });
    exportBtn.addEventListener("click", exportCsvPage);
    searchBox.addEventListener(
      "input",
      debounce(async () => {
        PAGE = 1;
        await loadPage();
      }, 300),
    );
    sortSelect.addEventListener("change", async (ev) => {
      SORT_FIELD = ev.target.value;
      SORT_ASC = /asc/i.test(ev.target.value) ? true : SORT_ASC;
      PAGE = 1;
      await loadPage();
    });
    pageSizeSelect.addEventListener("change", async (ev) => {
      PAGE_SIZE = Number(ev.target.value || 50);
      PAGE = 1;
      await loadPage();
    });
    prevBtn.addEventListener("click", async () => {
      if (PAGE > 1) {
        PAGE -= 1;
        await loadPage();
      }
    });
    nextBtn.addEventListener("click", async () => {
      PAGE += 1;
      await loadPage();
    });
    monthSelect.addEventListener("change", async () => {
      PAGE = 1;
      await loadPage();
    });
    drawerClose.addEventListener("click", closeDetails);

    // initial load
    await loadPage();
  } catch (e) {
    console.error(e);
    setStatus("Initialization error. See console.", "error");
  }
})();

export {};
