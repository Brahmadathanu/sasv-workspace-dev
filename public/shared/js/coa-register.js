/* coa-register.js
 * Lab ERP — COA Register
 *
 * Read-only register of all issued Certificates of Analysis.
 * Data source: lab.v_coa_register
 *
 * Filtering is performed client-side after a single bulk load.
 */

import { labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const statusArea = $("statusArea");
const tableWrap = $("tableWrap");
const tableBody = $("tableBody");
const emptyState = $("emptyState");
const coaRowCount = $("coaRowCount");
const toastContainer = $("toastContainer");

const kpiTotal = $("kpiTotal");
const kpiCurrent = $("kpiCurrent");
const kpiOld = $("kpiOld");

const coaSearch = $("coaSearch");
const coaSearchClear = $("coaSearchClear");
const streamFilter = $("streamFilter");
const dateFrom = $("dateFrom");
const dateTo = $("dateTo");
const currentOnlyToggle = $("currentOnlyToggle");
const currentToggleLabel = $("currentToggleLabel");
const clearFiltersBtn = $("clearFiltersBtn");

const refreshBtn = $("refreshBtn");
const homeBtn = $("homeBtn");

// Version modal refs
const verModal = $("verModal");
const verModalTitle = $("verModalTitle");
const verModalSubtitle = $("verModalSubtitle");
const verModalClose = $("verModalClose");
const verTableBody = $("verTableBody");

// ── Module state ───────────────────────────────────────────────────────────────
/** @type {Array<Object>} Full dataset loaded from the view */
let allRows = [];
/** @type {Array<Object>} Rows after client-side filtering */
let filteredRows = [];
/** @type {Array<Object>} All rows from v_coa_register_versions (loaded once) */
let allVersionRows = [];
/** @type {Map<number, Array<Object>>} analysis_id -> sorted version rows */
let versionsByAnalysis = new Map();
let searchDebounceTimer = null;

// ── Utility: escape HTML ───────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Utility: format date ───────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

// ── Utility: Batch / Lot display ──────────────────────────────────────────────
function batchLotDisplay(row) {
  return (
    row.batch_no_snapshot || row.system_lot_no || row.supplier_lot_no || "—"
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(message, kind = "info", duration = 3500) {
  const el = document.createElement("div");
  el.className = `cr-toast toast-${kind}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, duration);
}

// ── Status helpers ─────────────────────────────────────────────────────────────
function setStatus(msg, type = "loading") {
  statusArea.textContent = msg;
  statusArea.dataset.type = type;
  tableWrap.classList.remove("tw-visible");
}

function clearStatus() {
  statusArea.textContent = "";
  statusArea.dataset.type = "";
  tableWrap.classList.add("tw-visible");
}

// ── Platform-safe navigation ──────────────────────────────────────────────────
function navigate(url) {
  if (typeof Platform?.navigate === "function") {
    Platform.navigate(url);
  } else {
    window.location.href = url;
  }
}

// ── Open COA print page ────────────────────────────────────────────────────────
function openCoa(row) {
  const url = `coa-print.html?coa_issue_id=${encodeURIComponent(row.coa_issue_id)}`;
  // Open in new tab — COA print is a document page
  window.open(url, "_blank", "noopener");
}

// ── Open analysis workspace ────────────────────────────────────────────────────
function openAnalysis(row) {
  if (!row.analysis_id) {
    toast("No linked analysis record for this COA.", "info");
    return;
  }
  const url = `analysis-workspace.html?id=${encodeURIComponent(row.analysis_id)}`;
  navigate(url);
}

// ── Data loading ───────────────────────────────────────────────────────────────
async function loadRegisterRows() {
  setStatus("Loading COA register…");
  refreshBtn.disabled = true;

  try {
    // Load main register and version history in parallel
    const [mainRes, versRes] = await Promise.all([
      labSupabase
        .from("v_coa_register")
        .select("*")
        .order("issue_date", { ascending: false })
        .order("coa_no", { ascending: false }),
      labSupabase
        .from("v_coa_register_versions")
        .select("*")
        .order("issue_version", { ascending: false }),
    ]);

    if (mainRes.error) throw mainRes.error;
    // Version load failure is non-fatal — degrade gracefully
    if (versRes.error) {
      console.warn(
        "[COA Register] versions load failed:",
        versRes.error.message,
      );
    }

    allRows = mainRes.data ?? [];
    allVersionRows = versRes.data ?? [];
    buildVersionsMap();

    // Populate stream dropdown from actual data (beyond hard-coded defaults)
    populateStreamDropdown(allRows);

    applyFilters();
    toast("Register loaded", "success", 2000);
  } catch (err) {
    console.error("[COA Register] loadRegisterRows error:", err);
    setStatus(
      "Failed to load COA register: " + (err.message || String(err)),
      "error",
    );
  } finally {
    refreshBtn.disabled = false;
  }
}

// ── Build versions lookup map ─────────────────────────────────────────────────
function buildVersionsMap() {
  versionsByAnalysis = new Map();
  for (const row of allVersionRows) {
    const aid = row.analysis_id;
    if (aid == null) continue;
    if (!versionsByAnalysis.has(aid)) versionsByAnalysis.set(aid, []);
    versionsByAnalysis.get(aid).push(row);
  }
  // Each group is already ordered by issue_version desc from the query
}

// ── Populate stream dropdown with values from data ────────────────────────────
function populateStreamDropdown(rows) {
  const known = new Set(["AY", "RM"]);
  const fromData = new Set(
    rows
      .map((r) =>
        String(r.stream_code ?? "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  );

  // Add any streams from data that aren't already in the dropdown
  const extra = [...fromData].filter((s) => !known.has(s)).sort();
  if (!extra.length) return;

  extra.forEach((s) => {
    const existing = streamFilter.querySelector(`option[value="${s}"]`);
    if (!existing) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      streamFilter.appendChild(opt);
    }
  });
}

// ── Filters ────────────────────────────────────────────────────────────────────
/**
 * Apply all active filters to allRows and update the UI.
 * All filtering is purely client-side.
 */
function applyFilters() {
  const searchTerm = coaSearch.value.trim().toLowerCase();
  const stream = streamFilter.value.trim().toUpperCase();
  const currentOnly = currentOnlyToggle.checked;
  const from = dateFrom.value ? new Date(dateFrom.value) : null;
  const to = dateTo.value ? new Date(dateTo.value + "T23:59:59") : null;

  filteredRows = allRows.filter((row) => {
    // Current-only filter
    if (currentOnly && !row.is_current) return false;

    // Stream filter
    if (
      stream &&
      String(row.stream_code ?? "")
        .trim()
        .toUpperCase() !== stream
    )
      return false;

    // Date range filter (issue_date)
    if (from || to) {
      const d = row.issue_date ? new Date(row.issue_date) : null;
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
    }

    // Free-text search
    if (searchTerm) {
      const haystack = [
        row.coa_no,
        row.item_name,
        row.batch_no_snapshot,
        row.system_lot_no,
        row.supplier_lot_no,
        row.analysis_register_no,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });

  renderSummary();
  renderTable();
}

// ── Summary strip ──────────────────────────────────────────────────────────────
function renderSummary() {
  const total = filteredRows.length;
  const current = filteredRows.filter((r) => r.is_current).length;
  const old = total - current;

  kpiTotal.textContent = total;
  kpiCurrent.textContent = current;
  kpiOld.textContent = old;
  coaRowCount.textContent = `${total} record${total !== 1 ? "s" : ""}`;
}

// ── Table rendering ────────────────────────────────────────────────────────────
function renderTable() {
  if (!filteredRows.length) {
    tableBody.innerHTML = "";
    emptyState.classList.add("visible");
    clearStatus();
    return;
  }

  emptyState.classList.remove("visible");
  clearStatus();

  tableBody.innerHTML = filteredRows.map((row) => buildRow(row)).join("");

  // Wire action buttons
  tableBody.querySelectorAll(".btn-view-coa").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const issueId = Number(btn.dataset.issueId);
      const row = filteredRows.find((r) => r.coa_issue_id === issueId);
      if (row) openCoa(row);
    });
  });

  tableBody.querySelectorAll(".btn-open-analysis").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const issueId = Number(btn.dataset.issueId);
      const row = filteredRows.find((r) => r.coa_issue_id === issueId);
      if (row) openAnalysis(row);
    });
  });

  tableBody.querySelectorAll(".btn-versions").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const analysisId = Number(btn.dataset.analysisId);
      const issueId = Number(btn.dataset.issueId);
      const row = filteredRows.find((r) => r.coa_issue_id === issueId);
      openVersionsModal(analysisId, row?.item_name ?? "");
    });
  });
}

function buildRow(row) {
  const currentBadge = row.is_current
    ? `<span class="badge badge-current">Current</span>`
    : `<span class="badge badge-old">Old</span>`;

  const version =
    row.issue_version != null ? `v${esc(String(row.issue_version))}` : "—";

  const batchLot = esc(batchLotDisplay(row));

  const analysisBtn = row.analysis_id
    ? `<button class="btn-action btn-open-analysis"
          data-issue-id="${esc(String(row.coa_issue_id))}"
          title="Open linked analysis record"
          type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Analysis
        </button>`
    : `<button class="btn-action btn-open-analysis"
          data-issue-id="${esc(String(row.coa_issue_id))}"
          title="No linked analysis"
          type="button"
          style="opacity:0.4;cursor:default;"
          disabled>
          Analysis
        </button>`;

  // Versions button — only shown when the analysis has more than one issued COA
  const versions = row.analysis_id
    ? (versionsByAnalysis.get(row.analysis_id) ?? [])
    : [];
  const versionsBtn =
    versions.length > 1
      ? `<button class="btn-action btn-versions"
          data-issue-id="${esc(String(row.coa_issue_id))}"
          data-analysis-id="${esc(String(row.analysis_id))}"
          title="View all ${versions.length} issued versions for this analysis"
          type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          Versions
        </button>`
      : "";

  return `
    <tr class="coa-row">
      <td><strong>${esc(row.coa_no ?? "—")}</strong></td>
      <td style="white-space:nowrap">${esc(formatDate(row.issue_date))}</td>
      <td class="col-hide-mobile">
        <span class="item-primary">${esc(row.item_name ?? "—")}</span>
      </td>
      <td><span style="font-family:monospace;font-size:12px;">${batchLot}</span></td>
      <td class="col-hide-tablet">${esc(row.analysis_register_no ?? "—")}</td>
      <td class="col-hide-tablet">${esc(row.stream_code ?? "—")}</td>
      <td class="col-hide-mobile col-center"
          style="font-size:12px;color:var(--muted,#6b7280);">${version}</td>
      <td class="col-center">${currentBadge}</td>
      <td class="col-hide-tablet"
          style="font-size:12px;">${esc(row.approved_by_name_snapshot ?? "—")}</td>
      <td>
        <div class="action-btns">
          <button class="btn-action btn-view-coa"
            data-issue-id="${esc(String(row.coa_issue_id))}"
            title="View / print this COA"
            type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            View COA
          </button>
          ${analysisBtn}
          ${versionsBtn}
        </div>
      </td>
    </tr>`;
}

// ── Version history modal ─────────────────────────────────────────────────────
function openVersionsModal(analysisId, itemName) {
  const versions = versionsByAnalysis.get(analysisId) ?? [];
  if (!versions.length) {
    toast("No version data available.", "info");
    return;
  }

  verModalTitle.textContent = "Version History";
  verModalSubtitle.textContent = itemName
    ? `${itemName} — all issued COAs for this analysis`
    : `Analysis ID ${analysisId} — all issued COAs`;

  verTableBody.innerHTML = versions
    .map((v) => {
      const badge = v.is_current
        ? `<span class="badge badge-current">Current</span>`
        : `<span class="badge badge-old">Old</span>`;
      const ver =
        v.issue_version != null ? `v${esc(String(v.issue_version))}` : "—";
      const issueId = esc(String(v.coa_issue_id));
      return `
        <tr>
          <td><strong>${esc(v.coa_no ?? "—")}</strong></td>
          <td style="white-space:nowrap">${esc(formatDate(v.issue_date))}</td>
          <td style="font-size:12px;color:var(--muted,#6b7280);">${ver}</td>
          <td class="col-center">${badge}</td>
          <td>
            <button class="btn-action btn-view-coa ver-view-coa"
              data-issue-id="${issueId}"
              title="View this COA version"
              type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View COA
            </button>
          </td>
        </tr>`;
    })
    .join("");

  // Wire view-COA buttons inside modal
  verTableBody.querySelectorAll(".ver-view-coa").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.open(
        `coa-print.html?coa_issue_id=${encodeURIComponent(btn.dataset.issueId)}`,
        "_blank",
        "noopener",
      );
    });
  });

  verModal.classList.remove("hidden");
  verModalClose.focus();
}

function closeVersionsModal() {
  verModal.classList.add("hidden");
}

// ── Reset filters ──────────────────────────────────────────────────────────────
function resetFilters() {
  coaSearch.value = "";
  streamFilter.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  currentOnlyToggle.checked = true;
  currentToggleLabel.classList.add("active");
  coaSearchClear.classList.remove("visible");
  applyFilters();
}

// ── Event wiring ───────────────────────────────────────────────────────────────
function wireEvents() {
  // Refresh
  refreshBtn.addEventListener("click", () => loadRegisterRows());

  // Home
  homeBtn.addEventListener("click", () => {
    if (typeof Platform?.goHome === "function") {
      Platform.goHome();
    } else {
      window.location.href = "/";
    }
  });

  // Free-text search with debounce
  coaSearch.addEventListener("input", () => {
    const hasVal = coaSearch.value.length > 0;
    coaSearchClear.classList.toggle("visible", hasVal);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => applyFilters(), 220);
  });

  coaSearchClear.addEventListener("click", () => {
    coaSearch.value = "";
    coaSearchClear.classList.remove("visible");
    applyFilters();
    coaSearch.focus();
  });

  // Stream filter
  streamFilter.addEventListener("change", () => applyFilters());

  // Date range
  dateFrom.addEventListener("change", () => applyFilters());
  dateTo.addEventListener("change", () => applyFilters());

  // Current-only toggle
  currentOnlyToggle.addEventListener("change", () => {
    const isChecked = currentOnlyToggle.checked;
    currentToggleLabel.classList.toggle("active", isChecked);
    currentOnlyToggle.setAttribute("aria-checked", String(isChecked));
    applyFilters();
  });

  // Clear filters
  clearFiltersBtn.addEventListener("click", () => resetFilters());

  // Version modal — close on button, overlay click, or Escape
  verModalClose.addEventListener("click", closeVersionsModal);
  verModal.addEventListener("click", (e) => {
    if (e.target === verModal) closeVersionsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !verModal.classList.contains("hidden")) {
      closeVersionsModal();
    }
  });
}

// ── Entry point ────────────────────────────────────────────────────────────────
async function init() {
  wireEvents();
  await loadRegisterRows();
}

init();
