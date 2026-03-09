/* execution-gate.js */
import { supabase } from "./supabaseClient.js";

// Snapshot tables (server-side snapshots per month)
const VIEW_PM = "pm_issue_priority_snapshot_current_month";
const VIEW_RM = "rm_issue_priority_snapshot_current_month";
const VIEW_UNASS = "rm_unassigned_issues_snapshot_current_month";

// Elements
const $ = (id) => document.getElementById(id);
const monthSelect = $("monthSelect");
const searchBox = $("searchBox");
const sortSelect = $("sortSelect");
const refreshBtn = $("refreshBtn");
const exportBtn = $("exportBtn");
const pageSizeSelect = $("pageSizeSelect");
const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");
const pageInfo = $("pageInfo");
const rowCount = $("rowCount");
const lastRefreshed = $("lastRefreshed");
const lastSnapshot = $("lastSnapshot");
const minRiskInput = $("minRisk");
const minBlockedInput = $("minBlocked");
const kpiStrip = $("kpiStrip");
const tableHead = $("tableHead");
const tableBody = $("tableBody");
const statusArea = $("statusArea");
const detailContent = $("detailContent");

// State
let ACTIVE_TAB = "pm"; // pm | rm | unassigned
let PAGE = 1;
let PAGE_SIZE = Number(pageSizeSelect?.value || 50);
let SORT_FIELD = null;
let SORT_ASC = false;
let TOTAL_COUNT = null;
let CURRENT_ROWS = [];
let DISPLAY_ROWS = [];
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
    labels: [
      "PM Item",
      "UOM",
      "Blocked Batches",
      "Remaining Qty",
      "Risk Unlocked",
      "Risk per Qty",
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
    labels: [
      "RM Item",
      "UOM",
      "Blocked Batches",
      "Remaining Qty",
      "Risk Share",
      "Risk per Qty",
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
    labels: [
      "RM Item",
      "UOM",
      "Affected Batches",
      "Risk Locked",
      "Last Issue Date",
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
    // detect asc/desc from label (label should include '(asc)' or '(desc)')
    opt.dataset.asc = /\(asc\)/i.test(label) ? "true" : "false";
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
  const labels = cfg.labels || cfg.cols.map((c) => c.replace(/_/g, " "));
  labels.forEach((lbl) => {
    const th = document.createElement("th");
    th.textContent = lbl;
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
      monthToStart(monthSelect?.value) ||
      new Date().toISOString().slice(0, 7) + "-01";
    let qb = supabase
      .from(cfg.view)
      .select(cfg.cols.join(","), {
        count: PAGE === 1 ? "exact" : undefined,
      })
      .eq("month_start", monthStart);

    // NOTE: search is performed client-side on current page only (as spec'd)
    const q = (searchBox.value || "").trim();

    // server-side numeric filters
    const minRiskVal = ((minRiskInput && minRiskInput.value) || "").trim();
    if (minRiskVal !== "") {
      const minRisk = Number(minRiskVal);
      const riskField =
        cfg.cols.find((c) => /per_|risk/i.test(c)) ||
        cfg.cols.find((c) => /total_risk/i.test(c));
      if (riskField) qb = qb.gte(riskField, minRisk);
    }
    const minBlockedVal = (
      (minBlockedInput && minBlockedInput.value) ||
      ""
    ).trim();
    if (minBlockedVal !== "") {
      const minBlocked = Number(minBlockedVal);
      const blockedField = cfg.cols.find((c) => /blocked|affected/i.test(c));
      if (blockedField) qb = qb.gte(blockedField, minBlocked);
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
    // apply client-side search on the current page
    const applyClientSearch = (rows, term) => {
      if (!term) return rows;
      const t = term.toLowerCase();
      const idCols = ["pm_stock_item_id", "rm_stock_item_id"];
      const nameCols = ["pm_name", "rm_name"];
      return rows.filter((r) => {
        // id match
        for (const c of idCols)
          if (r[c] && String(r[c]).toLowerCase().includes(t)) return true;
        // name match
        for (const c of nameCols)
          if (r[c] && String(r[c]).toLowerCase().includes(t)) return true;
        return false;
      });
    };
    const filteredRows = applyClientSearch(CURRENT_ROWS, q);
    DISPLAY_ROWS = filteredRows;
    if (typeof count === "number") TOTAL_COUNT = count;
    renderTable(filteredRows);
    renderKPIs(filteredRows);
    rowCount.textContent = `Rows: ${TOTAL_COUNT ?? filteredRows.length}`;
    lastRefreshed.textContent = `Fetched: ${new Date().toLocaleString()}`;
    renderPagination();

    // show last snapshot refresh time from the snapshot table
    try {
      const { data: lastRows, error: lerr } = await supabase
        .from(cfg.view)
        .select("refreshed_at")
        .eq("month_start", monthStart)
        .order("refreshed_at", { ascending: false })
        .limit(1);
      if (!lerr && lastRows && lastRows.length) {
        lastSnapshot.textContent = new Date(
          lastRows[0].refreshed_at,
        ).toLocaleString();
      } else {
        lastSnapshot.textContent = "-";
      }
    } catch (e) {
      console.warn(e);
      lastSnapshot.textContent = "-";
    }
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
      if (/^pm_name$|^rm_name$/.test(c)) td.style.textAlign = "left";
      if (/^pm_uom$|^rm_uom$/.test(c)) td.style.textAlign = "center";
      if (/blocked|affected|count|batches/.test(c))
        td.style.textAlign = "center";
      if (/qty|risk|units/.test(c)) td.style.textAlign = "right";
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
  const pageTotalLabel = TOTAL_COUNT
    ? `${rows.length} / ${totalRows}`
    : `${rows.length}`;
  // compute metrics per tab with human-friendly labels
  const cfg = TAB_CONFIG[ACTIVE_TAB];
  const metricField = cfg.defaultSort.field;
  const sortedByMetric = [...rows].sort(
    (a, b) => Number(b[metricField] || 0) - Number(a[metricField] || 0),
  );
  const topItemMetric = sortedByMetric.length
    ? (sortedByMetric[0][metricField] ?? "-")
    : "-";
  const blockedSum = rows.reduce(
    (s, r) => s + Number(r.blocked_batch_count || r.affected_batches || 0),
    0,
  );
  const totalRisk = rows.reduce((s, r) => {
    const rf = cfg.cols.find((c) => /risk/i.test(c));
    return s + Number(r[rf] || 0);
  }, 0);
  const topItem = sortedByMetric[0] || null;

  let items = [];
  if (ACTIVE_TAB === "pm") {
    items = [
      ["PM items in queue (page/total)", pageTotalLabel],
      ["Total blocked batches (page)", blockedSum],
      ["Total risk unlocked (page)", totalRisk],
      [
        "Highest leverage item (page)",
        topItem ? `${topItem.pm_name || "-"} (${topItemMetric})` : "-",
      ],
    ];
  } else if (ACTIVE_TAB === "rm") {
    items = [
      ["RM items in queue (page/total)", pageTotalLabel],
      ["Total blocked batches (page)", blockedSum],
      ["Total risk share (page)", totalRisk],
      [
        "Highest leverage item (page)",
        topItem ? `${topItem.rm_name || "-"} (${topItemMetric})` : "-",
      ],
    ];
  } else {
    // unassigned
    const mostRecent = rows.reduce((m, r) => {
      const d = r.last_issue_voucher_date
        ? new Date(r.last_issue_voucher_date)
        : null;
      if (!d) return m;
      return !m || d > m ? d : m;
    }, null);
    items = [
      ["Items with unassigned issues (page/total)", pageTotalLabel],
      ["Total affected batches (page)", blockedSum],
      ["Total risk locked (page)", totalRisk],
      [
        "Most recent issue date (page)",
        mostRecent ? mostRecent.toLocaleDateString() : "-",
      ],
    ];
  }
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
  const panel = detailContent || document.getElementById("detailContent");
  if (!panel) return;
  const itemName = row.pm_name || row.rm_name || "Item";
  const itemId = row.pm_stock_item_id || row.rm_stock_item_id || "";
  const uom = row.pm_uom || row.rm_uom || "";
  // build structured detail panel
  const html = [];
  html.push(
    `<div style="margin-bottom:8px"><strong style="font-size:1.05rem">${itemName}</strong><div style="color:var(--muted)">${itemId}</div><div style="margin-top:6px">${ACTIVE_TAB.toUpperCase()} &nbsp;•&nbsp; ${uom}</div></div>`,
  );
  // impact block
  if (ACTIVE_TAB === "pm" || ACTIVE_TAB === "rm") {
    const blocked = row.blocked_batch_count ?? 0;
    const remaining =
      row.total_remaining_pm_qty ?? row.total_remaining_rm_qty ?? 0;
    const risk =
      row.total_risk_unlocked_units ?? row.total_risk_share_units ?? 0;
    const leverage = row.risk_per_pm_qty ?? row.risk_share_per_rm_qty ?? 0;
    html.push(
      `<div style="margin-top:8px"><strong>Impact</strong><div>Blocked batches: ${blocked}</div><div>Remaining qty: ${remaining}</div><div>Production impact unlocked: ${risk}</div><div>Leverage (risk per qty): ${leverage}</div></div>`,
    );
    const rec =
      ACTIVE_TAB === "pm"
        ? "Issue or procure this PM item to unblock production."
        : "Issue from stores if available, otherwise initiate procurement.";
    html.push(
      `<div style="margin-top:8px"><strong>Recommended action</strong><div>${rec}</div></div>`,
    );
  } else {
    const affected = row.affected_batches ?? 0;
    const riskLocked = row.total_risk_locked_units ?? 0;
    const lastDate = row.last_issue_voucher_date
      ? new Date(row.last_issue_voucher_date).toLocaleString()
      : "-";
    html.push(
      `<div style="margin-top:8px"><strong>Impact</strong><div>Affected batches: ${affected}</div><div>Risk locked: ${riskLocked}</div><div>Last issue date: ${lastDate}</div></div>`,
    );
    html.push(
      `<div style="margin-top:8px"><strong>Recommended action</strong><div>Fix RM issue assignment or traceability for the affected batches.</div></div>`,
    );
  }
  html.push(
    `<div style="margin-top:12px;display:flex;gap:8px"><button id="copyNameBtn">Copy item name</button><button id="copyIdBtn">Copy item id</button></div>`,
  );
  panel.innerHTML = html.join("");
  // wire copy buttons
  const copyNameBtn = document.getElementById("copyNameBtn");
  if (copyNameBtn)
    copyNameBtn.addEventListener("click", () =>
      navigator.clipboard.writeText(itemName),
    );
  const copyIdBtn = document.getElementById("copyIdBtn");
  if (copyIdBtn)
    copyIdBtn.addEventListener("click", () =>
      navigator.clipboard.writeText(itemId),
    );
}

// closeDetails removed — detail panel is static and reset via other UI actions

async function exportCsvPage() {
  exportBtn.disabled = true;
  try {
    const cfg = TAB_CONFIG[ACTIVE_TAB];
    const hdr = cfg.cols;
    const lines = [hdr.join(",")];
    // export current displayed rows (page + client-side search applied)
    DISPLAY_ROWS.forEach((r) => {
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
    const month = monthSelect?.value || new Date().toISOString().slice(0, 7);
    a.download = `execution_gate_${ACTIVE_TAB}_${month}_page${PAGE}_${new Date().toISOString()}.csv`;
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
    if (!session) return (window.location.href = "/login.html");
    await loadPermissions(session.user.id);
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.");
      return;
    }

    // defaults
    const now = new Date();
    if (monthSelect) {
      monthSelect.value = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}`;
    }

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
        // hide/disable minBlocked on unassigned tab
        if (minBlockedInput) {
          if (ACTIVE_TAB === "unassigned") {
            minBlockedInput.style.display = "none";
          } else {
            minBlockedInput.style.display = "inline-block";
          }
        }
        // update month label in header
        const monthLabelEl = document.getElementById("monthLabel");
        if (monthLabelEl)
          monthLabelEl.textContent =
            (monthSelect && monthSelect.value) ||
            new Date().toISOString().slice(0, 7);
        // update table title per tab
        const tableTitle = document.getElementById("tableTitle");
        if (tableTitle) {
          if (ACTIVE_TAB === "pm")
            tableTitle.textContent =
              "PM items ranked by production unblock impact";
          else if (ACTIVE_TAB === "rm")
            tableTitle.textContent =
              "RM items ranked by production unblock impact";
          else
            tableTitle.textContent =
              "RM assignment issues affecting production";
        }
        await loadPage();
      }),
    );

    buildSortOptions();
    renderTableHeader();

    // events
    if (refreshBtn)
      refreshBtn.addEventListener("click", async () => {
        const monthStart =
          monthToStart(monthSelect?.value) ||
          new Date().toISOString().slice(0, 7) + "-01";
        if (!confirm(`Refresh execution-gate snapshots for ${monthStart}?`))
          return;
        refreshBtn.disabled = true;
        setStatus("Refreshing snapshots (RPC)... This may take a moment.");
        try {
          const { error } = await supabase.rpc(
            "refresh_execution_gate_snapshots_current_month",
            {
              p_month_start: monthStart,
            },
          );
          if (error) {
            console.error(error);
            setStatus("Snapshot refresh failed. See console.", "error");
          } else {
            setStatus("Snapshots refreshed. Reloading page...");
            PAGE = 1;
            await loadPage();
          }
        } catch (e) {
          console.error(e);
          setStatus("Snapshot refresh failed. See console.", "error");
        } finally {
          refreshBtn.disabled = false;
        }
      });
    if (exportBtn) exportBtn.addEventListener("click", exportCsvPage);
    if (searchBox)
      searchBox.addEventListener(
        "input",
        debounce(async () => {
          PAGE = 1;
          await loadPage();
        }, 300),
      );
    if (sortSelect)
      sortSelect.addEventListener("change", async (ev) => {
        SORT_FIELD = ev.target.value;
        SORT_ASC = ev.target.selectedOptions[0]?.dataset?.asc === "true";
        PAGE = 1;
        await loadPage();
      });
    if (pageSizeSelect)
      pageSizeSelect.addEventListener("change", async (ev) => {
        PAGE_SIZE = Number(ev.target.value || 50);
        PAGE = 1;
        await loadPage();
      });
    if (prevBtn)
      prevBtn.addEventListener("click", async () => {
        if (PAGE > 1) {
          PAGE -= 1;
          await loadPage();
        }
      });
    if (nextBtn)
      nextBtn.addEventListener("click", async () => {
        PAGE += 1;
        await loadPage();
      });
    if (monthSelect)
      monthSelect.addEventListener("change", async () => {
        PAGE = 1;
        await loadPage();
      });

    // initial load
    await loadPage();
  } catch (e) {
    console.error(e);
    setStatus("Initialization error. See console.", "error");
  }
})();

export {};
