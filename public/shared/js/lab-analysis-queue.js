/* lab-analysis-queue.js */
import { supabase, labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const MODULE_ID = "lab-analysis-queue";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const statusArea = $("statusArea");
const kpiStrip = $("kpiStrip");
const tableWrap = $("tableWrap");
const tableBody = $("tableBody");
const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");
const labSearch = $("labSearch");
const labSearchClear = $("labSearchClear");
const labRowCount = $("labRowCount");
const lensPills = $("lensPills");
const lensSelect = $("lensSelect");
const detailsModal = $("detailsModal");
const modalCloseBtn = $("modalCloseBtn");
const modalTitle = $("modalTitle");
const modalSubtitle = $("modalSubtitle");
const overviewContent = $("overviewContent");
const queueSummaryContent = $("queueSummaryContent");
const statusHistoryContent = $("statusHistoryContent");
const lastRefreshed = $("lastRefreshed");
const btnOpenWorkspace = $("btnOpenWorkspace");
const btnViewCoa = $("btnViewCoa");

// ── State ─────────────────────────────────────────────────────────────────────
let rows = []; // merged, full dataset
let filteredRows = []; // after lens + search
let currentLens = "open";
let searchTerm = "";
let searchDebounceTimer = null;
let selectedRow = null;
let historyLoaded = false;
let LAST_REFRESH_TIME = null;
let prevFocus = null;

// ── Lens definitions ──────────────────────────────────────────────────────────
const LENSES = [
  { id: "open", label: "Open" },
  { id: "inprogress", label: "In Progress" },
  { id: "scrutiny", label: "Pending Scrutiny" },
  { id: "approved", label: "Approved for COA" },
  { id: "coa", label: "COA Generated" },
  { id: "mixed", label: "Outsourced / Mixed" },
  { id: "all", label: "All" },
];

// ── Label maps ────────────────────────────────────────────────────────────────
const SUBJECT_LABELS = {
  FG: "Finished Goods",
  RM: "Raw Material",
  PM: "Packing Material",
};

const STATUS_LABELS = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  PENDING_SCRUTINY: "Pending Scrutiny",
  SCRUTINY_PASSED: "Scrutiny Passed",
  APPROVED_FOR_COA: "Approved for COA",
  COA_GENERATED: "COA Generated",
};

const MODE_LABELS = {
  IN_HOUSE_ONLY: "In-house",
  MIXED: "Mixed",
  OUTSOURCED_ONLY: "Outsourced",
};

// ── Helpers: formatters ───────────────────────────────────────────────────────
function formatSubjectLabel(subject) {
  const s = normalizeSubject(String(subject || ""));
  return SUBJECT_LABELS[s] || subject || "—";
}

function formatSubjectChip(subject) {
  const norm = normalizeSubject(String(subject || ""));
  const label = SUBJECT_LABELS[norm] || subject || "—";
  const cls =
    norm === "FG"
      ? "subject-fg"
      : norm === "RM"
        ? "subject-rm"
        : norm === "PM"
          ? "subject-pm"
          : "subject-other";
  return `<span class="subject-chip ${cls}">${escHtml(label)}</span>`;
}

function formatStatusChip(status) {
  const s = String(status || "")
    .toUpperCase()
    .replace(/ /g, "_");
  const label = STATUS_LABELS[s] || String(status || "—").replace(/_/g, " ");
  const cls =
    s === "DRAFT"
      ? "lsc-draft"
      : s === "IN_PROGRESS"
        ? "lsc-in-progress"
        : s === "PENDING_SCRUTINY"
          ? "lsc-pending-scrutiny"
          : s === "SCRUTINY_PASSED"
            ? "lsc-scrutiny-passed"
            : s === "APPROVED_FOR_COA"
              ? "lsc-approved-coa"
              : s === "COA_GENERATED"
                ? "lsc-coa-generated"
                : "lsc-draft";
  return `<span class="lab-status-chip ${cls}">${escHtml(label)}</span>`;
}

function formatModeChip(mode) {
  const m = String(mode || "")
    .toUpperCase()
    .replace(/ /g, "_");
  const label = MODE_LABELS[m] || String(mode || "—").replace(/_/g, " ");
  const cls =
    m === "IN_HOUSE_ONLY"
      ? "lmc-inhouse"
      : m === "MIXED"
        ? "lmc-mixed"
        : m === "OUTSOURCED_ONLY"
          ? "lmc-outsourced"
          : "lmc-inhouse";
  return `<span class="lab-mode-chip ${cls}">${escHtml(label)}</span>`;
}

function formatModeLabel(mode) {
  const m = String(mode || "")
    .toUpperCase()
    .replace(/ /g, "_");
  return MODE_LABELS[m] || String(mode || "—").replace(/_/g, " ");
}

function formatStatusLabel(status) {
  const s = String(status || "")
    .toUpperCase()
    .replace(/ /g, "_");
  return STATUS_LABELS[s] || String(status || "—").replace(/_/g, " ");
}

function updateFreshnessIndicator() {
  if (!lastRefreshed) return;
  const lbl = lastRefreshed.querySelector(".sc-snapshot-label");
  if (!LAST_REFRESH_TIME) {
    lastRefreshed.className = lastRefreshed.className
      .replace(/snapshot-\w+/g, "")
      .trim();
    if (lbl) lbl.textContent = "Not loaded";
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
  if (lbl) lbl.textContent = label;
  lastRefreshed.className =
    lastRefreshed.className.replace(/snapshot-\w+/g, "").trim() +
    " " +
    statusClass;
  lastRefreshed.setAttribute("aria-label", detailText);
}

function formatSampleRef(row) {
  const s = normalizeSubject(String(row?.analysis_subject_type || ""));
  if (s === "FG") return row?.batch_no_snapshot || row?.system_lot_no || "—";
  if (s === "RM") return row?.system_lot_no || row?.batch_no_snapshot || "—";
  if (s === "PM") return row?.system_lot_no || row?.batch_no_snapshot || "—";
  return row?.batch_no_snapshot || row?.system_lot_no || "—";
}

function normalizeSubject(val) {
  const s = String(val || "").toUpperCase();
  if (s.startsWith("FG")) return "FG";
  if (s.startsWith("RM")) return "RM";
  if (s.startsWith("PM")) return "PM";
  return s;
}

function formatTimestamp(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d
      .toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\u200E/g, "");
  } catch {
    return String(val);
  }
}

function formatDate(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function formatCountBadge(count, type) {
  const n = count == null ? "—" : Number(count);
  if (n === "—") return `<span class="count-badge cb-zero">—</span>`;
  const cls =
    type === "missing" && n > 0
      ? "cb-missing"
      : type === "fail" && n > 0
        ? "cb-fail"
        : "cb-zero";
  return `<span class="count-badge ${cls}">${n}</span>`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemName(row) {
  return row?.item_name || row?.product_name || row?.stock_item_name || "—";
}

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(msg, type = "normal") {
  statusArea.textContent = msg;
  statusArea.style.display = "block";
  statusArea.dataset.type = type;
  tableWrap.classList.remove("tw-visible");
}

function clearStatus() {
  statusArea.style.display = "none";
  statusArea.dataset.type = "";
  tableWrap.classList.add("tw-visible");
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = $("labToastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `lab-toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3000);
}

// ── Permission check ──────────────────────────────────────────────────────────
async function checkPermissions(userId) {
  try {
    const { data: perms, error } = await supabase.rpc("get_user_permissions", {
      p_user_id: userId,
    });
    if (!error && Array.isArray(perms)) {
      const p = perms.find((r) => r?.target === `module:${MODULE_ID}`);
      if (p) return !!p.can_view;
    }
  } catch {
    /* fallthrough to table-based check */
  }

  try {
    const { data: rows } = await supabase
      .from("user_permissions")
      .select("can_view")
      .eq("user_id", userId)
      .eq("module_id", MODULE_ID)
      .limit(1);
    if (Array.isArray(rows) && rows.length) return !!rows[0].can_view;
  } catch {
    /* allow access */
  }

  return true; // default allow if permission fetch fails
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadQueue() {
  setStatus("Loading analysis work queue…");
  refreshBtn.disabled = true;

  try {
    const [headerRes, scrutinyRes] = await Promise.all([
      labSupabase.from("v_analysis_header").select("*"),
      labSupabase.from("v_analysis_pending_scrutiny").select("*"),
    ]);

    if (headerRes.error)
      throw new Error(
        "Failed to load analysis header: " + headerRes.error.message,
      );

    if (scrutinyRes.error)
      throw new Error(
        "Failed to load analysis pending scrutiny view: " +
          scrutinyRes.error.message,
      );

    rows = mergeQueueData(headerRes.data || [], scrutinyRes.data || []);

    applyLens();
    renderKpis();
    LAST_REFRESH_TIME = new Date();
    updateFreshnessIndicator();
    showToast("Queue refreshed", "success");
  } catch (err) {
    console.error("[LAQ] loadQueue error:", err);
    setStatus("Error loading queue: " + (err.message || String(err)), "error");
  } finally {
    refreshBtn.disabled = false;
  }
}

function mergeQueueData(headers, scrutiny) {
  // Build scrutiny lookup keyed by analysis_id
  const scrutinyMap = new Map();
  (scrutiny || []).forEach((s) => {
    if (s?.analysis_id != null) scrutinyMap.set(String(s.analysis_id), s);
  });

  return (headers || []).map((h) => {
    // v_analysis_header exposes `id`; normalize to analysis_id for internal use
    const aid = h.analysis_id ?? h.id;
    const sc = scrutinyMap.get(String(aid)) || {};
    return {
      analysis_id: aid,
      analysis_register_no: h.analysis_register_no,
      analysis_subject_type: h.analysis_subject_type,
      stream_code: h.stream_code,
      status: h.status,
      analysis_mode: h.analysis_mode,
      has_outsourced_tests: h.has_outsourced_tests,
      sample_received_date: h.sample_received_date,
      analysis_completed_date: h.analysis_completed_date,
      batch_no_snapshot: h.batch_no_snapshot,
      system_lot_no: h.system_lot_no,
      supplier_lot_no: h.supplier_lot_no,
      supplier_name_snapshot: h.supplier_name_snapshot,
      item_name: h.item_name || h.product_name || h.stock_item_name,
      total_test_count: sc.total_test_count ?? h.total_test_count,
      missing_result_count: sc.missing_result_count ?? h.missing_result_count,
      fail_count: sc.fail_count ?? h.fail_count,
      outsourced_test_count:
        sc.outsourced_test_count ?? h.outsourced_test_count,
      mfg_date: h.mfg_date,
      exp_date: h.exp_date,
    };
  });
}

// ── KPI rendering ─────────────────────────────────────────────────────────────
function renderKpis() {
  // KPIs reflect the overall queue (full dataset) to avoid confusion
  const visible = rows;
  const totalOpen = rows.filter(
    (r) => String(r.status || "").toUpperCase() !== "COA_GENERATED",
  ).length;
  const inProgress = rows.filter(
    (r) => String(r.status || "").toUpperCase() === "IN_PROGRESS",
  ).length;
  const pendingScrutiny = rows.filter(
    (r) => String(r.status || "").toUpperCase() === "PENDING_SCRUTINY",
  ).length;
  const approvedCoa = rows.filter(
    (r) => String(r.status || "").toUpperCase() === "APPROVED_FOR_COA",
  ).length;
  const mixedOutsourced = rows.filter((r) => !!r.has_outsourced_tests).length;
  const missingTotal = visible.reduce(
    (s, r) => s + (Number(r.missing_result_count) || 0),
    0,
  );

  const kpis = [
    { cls: "kpi-total", label: "Total Open", value: totalOpen },
    { cls: "kpi-inprogress", label: "In Progress", value: inProgress },
    { cls: "kpi-scrutiny", label: "Pending Scrutiny", value: pendingScrutiny },
    { cls: "kpi-approved", label: "Approved for COA", value: approvedCoa },
    { cls: "kpi-mixed", label: "Mixed / Outsourced", value: mixedOutsourced },
    { cls: "kpi-missing", label: "Missing Results", value: missingTotal },
  ];

  kpiStrip.innerHTML = kpis
    .map(
      (k) =>
        `<div class="kpi ${k.cls}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
        </div>`,
    )
    .join("");
}

// ── Lens filter ───────────────────────────────────────────────────────────────
function applyLens() {
  const statusUp = (r) => String(r.status || "").toUpperCase();

  switch (currentLens) {
    case "open":
      filteredRows = rows.filter((r) => statusUp(r) !== "COA_GENERATED");
      break;
    case "inprogress":
      filteredRows = rows.filter((r) => statusUp(r) === "IN_PROGRESS");
      break;
    case "scrutiny":
      filteredRows = rows.filter((r) => statusUp(r) === "PENDING_SCRUTINY");
      break;
    case "approved":
      filteredRows = rows.filter((r) => statusUp(r) === "APPROVED_FOR_COA");
      break;
    case "coa":
      filteredRows = rows.filter((r) => statusUp(r) === "COA_GENERATED");
      break;
    case "mixed":
      filteredRows = rows.filter((r) => !!r.has_outsourced_tests);
      break;
    case "all":
    default:
      filteredRows = [...rows];
      break;
  }

  // Sort: open / in-progress first, then by received date desc
  filteredRows.sort((a, b) => {
    // Prefer Draft before In Progress for a logical workflow order
    const order = [
      "DRAFT",
      "IN_PROGRESS",
      "PENDING_SCRUTINY",
      "SCRUTINY_PASSED",
      "APPROVED_FOR_COA",
      "COA_GENERATED",
    ];
    const ai = order.indexOf(String(a.status || "").toUpperCase());
    const bi = order.indexOf(String(b.status || "").toUpperCase());
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    const ad = a.sample_received_date
      ? new Date(a.sample_received_date).getTime()
      : 0;
    const bd = b.sample_received_date
      ? new Date(b.sample_received_date).getTime()
      : 0;
    return bd - ad;
  });

  applySearch();
  renderKpis();
}

// ── Search ────────────────────────────────────────────────────────────────────
function applySearch() {
  const q = searchTerm.trim().toLowerCase();
  let result = filteredRows;

  if (q) {
    result = filteredRows.filter((r) => {
      const hay = [
        r.analysis_register_no,
        itemName(r),
        r.batch_no_snapshot,
        r.system_lot_no,
        r.supplier_lot_no,
        r.supplier_name_snapshot,
        r.status,
        r.analysis_subject_type,
        formatSubjectLabel(r.analysis_subject_type),
        formatModeLabel(r.analysis_mode),
        formatStatusLabel(r.status),
        formatSampleRef(r),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  updateRowCount(result.length, filteredRows.length);
  renderTable(result);
}

function updateRowCount(shown, total) {
  if (!labRowCount) return;
  if (shown === total) {
    labRowCount.textContent = `Showing ${total} records`;
  } else {
    labRowCount.textContent = `Showing ${shown} of ${total} records`;
  }
}

// ── Table rendering ───────────────────────────────────────────────────────────
function renderTable(displayRows) {
  tableBody.innerHTML = "";

  if (!displayRows || displayRows.length === 0) {
    // show subtle empty-state card inside table instead of hiding the table
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state-card" style="padding:18px;border:1px solid var(--border,#e5e7eb);border-radius:8px;background:var(--panel-bg,#fff);">
            <div style="font-weight:700;font-size:15px;color:var(--muted,#374151);">No analyses found for this queue.</div>
            <div style="margin-top:6px;color:var(--muted,#6b7280);">Try clearing filters or refreshing the queue.</div>
          </div>
        </td>
      </tr>`;
    labRowCount.textContent = "";
    clearStatus();
    return;
  }

  clearStatus();

  displayRows.forEach((r) => {
    const tr = document.createElement("tr");
    // Add priority classes for visual signals
    const failCount = Number(r.fail_count) || 0;
    const missingCount = Number(r.missing_result_count) || 0;
    let extraCls = "";
    if (failCount > 0) extraCls = " row-fail";
    else if (missingCount > 0) extraCls = " row-missing";
    tr.className = `lab-row${extraCls}`;
    tr.tabIndex = 0;
    tr.setAttribute("role", "row");

    tr.addEventListener("click", () => openDetails(r));
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails(r);
      }
    });

    // Secondary line for item cell
    const secondaryParts = [];
    if (r.stream_code) secondaryParts.push(escHtml(r.stream_code));
    if (
      normalizeSubject(r.analysis_subject_type) === "RM" &&
      r.supplier_name_snapshot
    ) {
      secondaryParts.push(escHtml(r.supplier_name_snapshot));
    }
    const secondaryLine = secondaryParts.length
      ? `<span class="item-secondary">${secondaryParts.join(" · ")}</span>`
      : "";

    tr.innerHTML = `
      <td>${formatSubjectChip(r.analysis_subject_type)}</td>
      <td>${escHtml(r.analysis_register_no || "—")}</td>
      <td>
        <span class="item-primary">${escHtml(itemName(r))}</span>
        ${secondaryLine}
      </td>
      <td class="col-hide-mobile">${escHtml(formatSampleRef(r))}</td>
      <td>${formatStatusChip(r.status)}</td>
      <td class="col-hide-mobile">${formatModeChip(r.analysis_mode)}</td>
      <td class="c-center col-hide-mobile">${formatCountBadge(r.missing_result_count, "missing")}</td>
      <td class="c-center col-hide-mobile">${formatCountBadge(r.fail_count, "fail")}</td>
      <td class="col-hide-mobile">${escHtml(formatDate(r.sample_received_date))}</td>
    `;

    tableBody.appendChild(tr);
  });
}

// ── Lens pills rendering ──────────────────────────────────────────────────────
function renderLensPills() {
  lensPills.innerHTML = "";
  if (lensSelect) lensSelect.innerHTML = "";

  LENSES.forEach((l) => {
    const btn = document.createElement("button");
    btn.className = `pill${l.id === currentLens ? " active" : ""}`;
    btn.textContent = l.label;
    btn.dataset.lens = l.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", l.id === currentLens ? "true" : "false");
    btn.addEventListener("click", () => {
      currentLens = l.id;
      renderLensPills();
      applyLens();
    });
    lensPills.appendChild(btn);

    if (lensSelect) {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.label;
      if (l.id === currentLens) opt.selected = true;
      lensSelect.appendChild(opt);
    }
  });
}

// ── Modal: open / close ───────────────────────────────────────────────────────
function openDetails(row) {
  selectedRow = row;
  historyLoaded = false;
  // store previous focus for restoration when modal closes
  try {
    prevFocus = document.activeElement;
  } catch {
    prevFocus = null;
  }

  modalTitle.textContent = row.analysis_register_no || "Analysis Details";
  modalSubtitle.innerHTML = [
    formatSubjectChip(row.analysis_subject_type),
    formatStatusChip(row.status),
    formatModeChip(row.analysis_mode),
  ].join(" ");

  // Show View COA button only when a COA has been generated
  const isCoa = String(row.status || "").toUpperCase() === "COA_GENERATED";
  if (btnViewCoa) {
    btnViewCoa.style.display = isCoa ? "" : "none";
    btnViewCoa.title = isCoa ? "View Issued COA" : "COA not yet generated";
  }

  // Reset to Overview tab
  setDrawerTab("overview");
  renderOverview(row);
  renderQueueSummary(row);

  // Reset status history panel
  statusHistoryContent.innerHTML = `<p id="historyLoading" style="font-size:13px;color:var(--muted,#6b7280);padding:12px 0;">Click to load status history.</p>`;

  detailsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  modalCloseBtn.focus();
}

function closeDetails() {
  detailsModal.classList.add("hidden");
  document.body.style.overflow = "";
  selectedRow = null;
  // restore previous focus if possible
  try {
    if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
  } catch {
    // ignore
  }
  prevFocus = null;
}

// ── Open issued COA print page ──────────────────────────────────────────────
async function openIssuedCoaForAnalysis(analysisId) {
  if (!analysisId) return;
  try {
    const { data, error } = await labSupabase
      .from("coa_issue")
      .select("id, analysis_id, coa_no, is_current")
      .eq("analysis_id", analysisId)
      .eq("is_current", true)
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;

    const record = Array.isArray(data) ? data[0] : null;
    if (!record) {
      showToast("Issued COA not found for this analysis", "warn");
      return;
    }

    const base = window.location.pathname.replace(/\/[^/]+$/, "/");
    const url =
      base + "coa-print.html?coa_issue_id=" + encodeURIComponent(record.id);

    try {
      if (typeof Platform?.open === "function") {
        Platform.open(url);
        return;
      }
      if (typeof Platform?.navigate === "function") {
        Platform.navigate(url);
        return;
      }
    } catch (e) {
      console.debug("[LAQ] Platform navigation failed, falling back:", e);
    }

    window.location.href = url;
  } catch (err) {
    console.error("[LAQ] openIssuedCoaForAnalysis error:", err);
    showToast("Failed to look up issued COA: " + err.message, "error");
  }
}

// ── Open analysis workspace (navigation helper) ─────────────────────────────
function openAnalysisWorkspace(row) {
  const target = row || selectedRow;
  if (!target || !target.analysis_id) return;

  const aid = String(target.analysis_id);
  const base = window.location.pathname.replace(/\/[^/]+$/, "/");
  const url = base + "analysis-workspace.html?id=" + encodeURIComponent(aid);

  try {
    if (typeof Platform?.open === "function") {
      Platform.open(url);
      return;
    }
    if (typeof Platform?.navigate === "function") {
      Platform.navigate(url);
      return;
    }
  } catch (e) {
    console.debug("[LAQ] Platform navigation failed, falling back:", e);
  }

  window.location.href = url;
}

function setDrawerTab(tabId) {
  document.querySelectorAll(".modal-tab").forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab${toCamelCase(tabId)}`);
  });
}

function toCamelCase(str) {
  return str
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^([a-z])/, (_, c) => c.toUpperCase());
}

// ── Modal: Overview tab ───────────────────────────────────────────────────────
function renderOverview(row) {
  const kvHtml = (key, val) =>
    `<div class="kv-row">
      <span class="kv-key">${escHtml(key)}</span>
      <span class="kv-val">${val}</span>
    </div>`;

  const card = (title, rows) =>
    `<div class="detail-card">
      <div class="detail-card-title">${title}</div>
      ${rows.join("")}
    </div>`;

  overviewContent.innerHTML = `
    <div class="detail-grid">
      ${card("Analysis Identity", [
        kvHtml("Register No", escHtml(row.analysis_register_no || "—")),
        kvHtml(
          "Subject Type",
          escHtml(formatSubjectLabel(row.analysis_subject_type)),
        ),
        kvHtml("Stream", escHtml(row.stream_code || "—")),
        kvHtml("Status", formatStatusChip(row.status)),
        kvHtml("Mode", formatModeChip(row.analysis_mode)),
      ])}
      ${card("Item Details", [
        kvHtml("Item Name", escHtml(itemName(row))),
        kvHtml("Batch / Lot Ref", escHtml(formatSampleRef(row))),
        kvHtml("Supplier Lot", escHtml(row.supplier_lot_no || "—")),
        kvHtml("Supplier", escHtml(row.supplier_name_snapshot || "—")),
      ])}
      ${card("Dates", [
        kvHtml(
          "Sample Received",
          escHtml(formatDate(row.sample_received_date)),
        ),
        kvHtml("MFG Date", escHtml(formatDate(row.mfg_date))),
        kvHtml("EXP Date", escHtml(formatDate(row.exp_date))),
        kvHtml(
          "Analysis Completed",
          escHtml(formatDate(row.analysis_completed_date)),
        ),
      ])}
    </div>`;
}

// ── Modal: Queue Summary tab ──────────────────────────────────────────────────
function renderQueueSummary(row) {
  const total = row.total_test_count ?? "—";
  const missing = row.missing_result_count ?? "—";
  const fail = row.fail_count ?? "—";
  const outsourced = row.outsourced_test_count ?? "—";

  queueSummaryContent.innerHTML = `
    <div class="queue-summary-strip">
      <div class="qs-card">
        <div class="qs-label">Total Tests</div>
        <div class="qs-value">${escHtml(String(total))}</div>
      </div>
      <div class="qs-card qs-missing">
        <div class="qs-label">Missing Results</div>
        <div class="qs-value">${escHtml(String(missing))}</div>
      </div>
      <div class="qs-card qs-fail">
        <div class="qs-label">Fail Count</div>
        <div class="qs-value">${escHtml(String(fail))}</div>
      </div>
      <div class="qs-card">
        <div class="qs-label">Outsourced Tests</div>
        <div class="qs-value">${escHtml(String(outsourced))}</div>
      </div>
    </div>
    <div class="qs-note">
      All counts are as provided by the system. No recalculation is performed in this view.
    </div>`;
}

// ── Modal: Status History tab ─────────────────────────────────────────────────
async function renderStatusHistory(analysisId) {
  if (historyLoaded) return;

  if (!analysisId) {
    statusHistoryContent.innerHTML = `<p style="font-size:13px;color:#92400e;padding:12px 0;">Analysis history cannot be loaded because analysis_id is unavailable.</p>`;
    return;
  }

  statusHistoryContent.innerHTML = `<p style="font-size:13px;color:var(--muted,#6b7280);padding:12px 0;">Loading status history…</p>`;

  try {
    const { data, error } = await labSupabase
      .from("analysis_status_history")
      .select("old_status, new_status, changed_at")
      .eq("analysis_id", analysisId)
      .order("changed_at", { ascending: false });

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      statusHistoryContent.innerHTML = `<p style="font-size:13px;color:var(--muted,#6b7280);padding:12px 0;">No status history recorded for this analysis.</p>`;
      historyLoaded = true;
      return;
    }

    const rowHtml = data
      .map(
        (h) =>
          `<tr>
            <td>${formatStatusChip(h.old_status)}</td>
            <td>${formatStatusChip(h.new_status)}</td>
            <td>${escHtml(formatTimestamp(h.changed_at))}</td>
          </tr>`,
      )
      .join("");

    statusHistoryContent.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Previous Status</th>
            <th>New Status</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>`;

    historyLoaded = true;
  } catch (err) {
    console.error("[LAQ] status history error:", err);
    statusHistoryContent.innerHTML = `<p style="font-size:13px;color:#991b1b;padding:12px 0;">Error loading history: ${escHtml(err.message)}</p>`;
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function wireEvents() {
  // Refresh
  refreshBtn.addEventListener("click", () => loadQueue());

  // Home — use Platform.goHome if available, otherwise fallback to index.html
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      if (typeof Platform?.goHome === "function") {
        Platform.goHome();
      } else {
        const base = window.location.pathname.replace(/\/[^/]+$/, "/");
        window.location.href = base + "index.html";
      }
    });
  }

  // Search
  labSearch.addEventListener("input", () => {
    searchTerm = labSearch.value;
    labSearchClear.classList.toggle("visible", searchTerm.length > 0);
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applySearch();
      searchDebounceTimer = null;
    }, 250);
  });

  labSearchClear.addEventListener("click", () => {
    labSearch.value = "";
    searchTerm = "";
    labSearchClear.classList.remove("visible");
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    labSearch.focus();
    applySearch();
  });

  // Mobile lens select
  if (lensSelect) {
    lensSelect.addEventListener("change", () => {
      currentLens = lensSelect.value;
      renderLensPills();
      applyLens();
    });
  }

  // Modal close
  modalCloseBtn.addEventListener("click", closeDetails);
  detailsModal.addEventListener("click", (e) => {
    if (e.target === detailsModal) closeDetails();
  });

  // Open workspace from modal
  if (btnOpenWorkspace) {
    btnOpenWorkspace.addEventListener("click", () =>
      openAnalysisWorkspace(selectedRow),
    );
  }

  // View COA from modal
  if (btnViewCoa) {
    btnViewCoa.addEventListener("click", () => {
      if (selectedRow?.analysis_id) {
        openIssuedCoaForAnalysis(selectedRow.analysis_id);
      }
    });
  }

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detailsModal.classList.contains("hidden")) {
      closeDetails();
    }
  });

  // Modal tabs
  document.querySelectorAll(".modal-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      setDrawerTab(tabId);
      if (tabId === "status-history" && selectedRow) {
        renderStatusHistory(selectedRow.analysis_id);
      }
    });
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function init() {
  // Show loading
  statusArea.style.display = "block";
  statusArea.textContent = "Loading analysis work queue…";

  // Platform / session
  let userId = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    if (session && session.user) userId = session.user.id;
    else {
      // fallback to platform helper if present
      const p = await Platform.getSession?.();
      userId = p?.user?.id ?? null;
    }
  } catch {
    /* no session helper — skip */
  }

  // Permission check and redirect if no session
  if (!userId) {
    // mirror app behavior: redirect to login.html
    try {
      location.href = "login.html";
    } catch {
      setStatus("Access denied. Please login to continue.", "error");
    }
    return;
  }

  const canView = await checkPermissions(userId);
  if (!canView) {
    setStatus(
      "Access denied. You do not have permission to view this module.",
      "error",
    );
    return;
  }

  // Wire events first so buttons work during loading
  wireEvents();
  renderLensPills();
  updateFreshnessIndicator();

  // Load data
  await loadQueue();

  // Re-run freshness label every 60 seconds so elapsed time stays accurate
  setInterval(updateFreshnessIndicator, 60_000);
}

init();
